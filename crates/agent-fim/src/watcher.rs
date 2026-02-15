//! File system watcher using the `notify` crate.
//!
//! Uses inotify (Linux), FSEvents (macOS), or ReadDirectoryChanges (Windows)
//! to detect file system changes in real time.

use crate::FimError;
use crate::baseline::BaselineManager;
use agent_common::types::{FimAlert, FimChangeType, FimPolicy};
use chrono::Utc;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Start watching files according to the FIM policy.
///
/// This function blocks until the shutdown signal is set.
pub async fn watch_files(
    policy: FimPolicy,
    baseline: Arc<BaselineManager>,
    alert_tx: mpsc::Sender<FimAlert>,
    shutdown: Arc<AtomicBool>,
) -> Result<(), FimError> {
    // notify's EventHandler is only implemented for std::sync::mpsc::Sender (not SyncSender).
    // The debounce_map in the processing loop bounds effective memory usage instead.
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;

    // Watch all configured paths
    let mode = if policy.recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    for path in &policy.watched_paths {
        if path.exists() {
            match watcher.watch(path, mode) {
                Ok(()) => info!("FIM watching: {}", path.display()),
                Err(e) => warn!("Failed to watch {}: {}", path.display(), e),
            }
        }
    }

    let debounce_duration = Duration::from_millis(policy.debounce_ms);
    let ignore_patterns = policy.ignore_patterns.clone();

    // Process events in a background thread (notify uses std channels)
    tokio::task::spawn_blocking(move || {
        let mut debounce_map: HashMap<PathBuf, Instant> = HashMap::new();
        const MAX_DEBOUNCE_ENTRIES: usize = 50_000;

        loop {
            if shutdown.load(Ordering::Acquire) {
                info!("FIM watcher shutting down");
                break;
            }

            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(Ok(event)) => {
                    // Evict stale debounce entries to bound memory usage
                    if debounce_map.len() > MAX_DEBOUNCE_ENTRIES {
                        let cutoff = Instant::now() - debounce_duration;
                        debounce_map.retain(|_, t| *t > cutoff);
                    }
                    process_event(
                        event,
                        &baseline,
                        &alert_tx,
                        &mut debounce_map,
                        debounce_duration,
                        &ignore_patterns,
                    );
                }
                Ok(Err(e)) => {
                    warn!("FIM watch error: {}", e);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Normal timeout, check shutdown flag
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    warn!("FIM watcher channel disconnected");
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Process a single file system event.
fn process_event(
    event: Event,
    baseline: &BaselineManager,
    alert_tx: &mpsc::Sender<FimAlert>,
    debounce_map: &mut HashMap<PathBuf, Instant>,
    debounce_duration: Duration,
    ignore_patterns: &[String],
) {
    let change_type = match event.kind {
        EventKind::Create(_) => FimChangeType::Created,
        EventKind::Modify(notify::event::ModifyKind::Data(_)) => FimChangeType::Modified,
        EventKind::Modify(notify::event::ModifyKind::Metadata(_)) => {
            FimChangeType::PermissionChanged
        }
        EventKind::Modify(notify::event::ModifyKind::Name(_)) => FimChangeType::Renamed,
        EventKind::Remove(_) => FimChangeType::Deleted,
        _ => return, // Ignore other events
    };

    for path in &event.paths {
        // Skip ignored patterns
        if is_ignored_path(path, ignore_patterns) {
            continue;
        }

        // Debounce: skip if we recently processed this path
        let now = Instant::now();
        if let Some(last) = debounce_map.get(path)
            && now.duration_since(*last) < debounce_duration
        {
            continue;
        }
        debounce_map.insert(path.clone(), now);

        debug!("FIM event: {:?} on {}", change_type, path.display());

        // Build the alert
        let old_baseline = baseline.get(path);
        let old_hash = old_baseline.as_ref().map(|b| b.hash.clone());

        let (new_hash, new_size) = if change_type != FimChangeType::Deleted && path.exists() {
            match crate::baseline::compute_blake3(path) {
                Ok(hash) => {
                    let size = std::fs::metadata(path).map(|m| m.len()).ok();
                    (Some(hash), size)
                }
                Err(_) => (None, None),
            }
        } else {
            (None, None)
        };

        // Skip if hash hasn't changed (false positive from metadata-only events)
        if change_type == FimChangeType::Modified
            && let (Some(old), Some(new)) = (&old_hash, &new_hash)
            && old == new
        {
            continue;
        }

        let alert = FimAlert {
            path: path.clone(),
            change: change_type,
            old_hash,
            new_hash: new_hash.clone(),
            new_size,
            timestamp: Utc::now(),
            acknowledged: false,
        };

        // Update baseline
        match change_type {
            FimChangeType::Deleted => {
                baseline.remove(path);
            }
            _ => {
                if let Err(e) = baseline.update(path) {
                    tracing::warn!("Failed to update FIM baseline for {}: {}", path.display(), e);
                }
            }
        }

        // Send alert (non-blocking). Log if channel is full to avoid silent data loss.
        if let Err(e) = alert_tx.try_send(alert) {
            tracing::warn!(
                "FIM alert channel full, alert dropped for {}: {}",
                path.display(),
                e
            );
        }
    }
}

/// Check if a path should be ignored based on patterns.
fn is_ignored_path(path: &Path, patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();
    for pattern in patterns {
        if let Some(suffix) = pattern.strip_prefix('*') {
            if path_str.ends_with(suffix) {
                return true;
            }
        } else if let Some(prefix) = pattern.strip_suffix("/**") {
            if path_str.contains(prefix) {
                return true;
            }
        } else if path_str.contains(pattern.as_str()) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ignored_path() {
        let patterns = vec!["*.log".to_string(), "*.tmp".to_string()];

        assert!(is_ignored_path(
            &PathBuf::from("/var/log/syslog.log"),
            &patterns
        ));
        assert!(is_ignored_path(&PathBuf::from("/tmp/file.tmp"), &patterns));
        assert!(!is_ignored_path(&PathBuf::from("/etc/passwd"), &patterns));
    }
}
