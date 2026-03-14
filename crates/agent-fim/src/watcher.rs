// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
        if !path.exists() {
            debug!("FIM: skipping non-existent path: {}", path.display());
            continue;
        }

        match watcher.watch(path, mode) {
            Ok(()) => info!("FIM watching: {}", path.display()),
            Err(e) => {
                // On Windows, protected OS directories (e.g. C:\Windows\System32\config)
                // exist but deny ReadDirectoryChanges access to non-SYSTEM processes.
                // Demote these to debug instead of warning to avoid noisy logs.
                if matches!(e.kind, notify::ErrorKind::PathNotFound)
                    || matches!(e.kind, notify::ErrorKind::Io(_))
                {
                    debug!(
                        "FIM: cannot watch {} (access denied or protected): {}",
                        path.display(),
                        e
                    );
                } else {
                    warn!("Failed to watch {}: {}", path.display(), e);
                }
            }
        }
    }

    let debounce_duration = Duration::from_millis(policy.debounce_ms);
    let ignore_patterns = policy.ignore_patterns.clone();

    // Process events in a background thread (notify uses std channels).
    // Move the watcher into the closure to keep it alive for the lifetime of the loop;
    // dropping it would close the sender side of the mpsc channel.
    tokio::task::spawn_blocking(move || {
        let _watcher = watcher; // prevent drop until this closure exits
        let mut debounce_map: HashMap<PathBuf, Instant> = HashMap::new();
        const MAX_DEBOUNCE_ENTRIES: usize = 10_000;

        loop {
            if shutdown.load(Ordering::Acquire) {
                info!("FIM watcher shutting down");
                break;
            }

            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(Ok(event)) => {
                    // Evict stale debounce entries to bound memory usage
                    if debounce_map.len() > MAX_DEBOUNCE_ENTRIES {
                        let before = debounce_map.len();
                        let cutoff = Instant::now() - debounce_duration;
                        debounce_map.retain(|_, t| *t > cutoff);
                        tracing::debug!(
                            "FIM debounce eviction: {} → {} entries",
                            before,
                            debounce_map.len()
                        );
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
                    // PathNotFound errors are common for protected OS directories
                    // (e.g., C:\Windows\System32\config) — demote to debug.
                    if matches!(e.kind, notify::ErrorKind::PathNotFound) {
                        debug!(
                            "FIM: skipping inaccessible path {:?}: {}",
                            e.paths, e
                        );
                    } else {
                        warn!("FIM watch error: {}", e);
                    }
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

    for raw_path in &event.paths {
        // SECURITY: Resolve symlinks to detect evasion via symlink-to-ignored-path.
        // If canonicalize fails (broken symlink, race), skip the path to avoid
        // processing an unresolved symlink that could bypass ignore patterns.
        let path = match raw_path.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                debug!(
                    "FIM: skipping {} (canonicalize failed, possible broken symlink)",
                    raw_path.display()
                );
                continue;
            }
        };

        // Skip ignored patterns (checked against the canonical path)
        if is_ignored_path(&path, ignore_patterns) {
            continue;
        }

        // Debounce: skip if we recently processed this path
        let now = Instant::now();
        if let Some(last) = debounce_map.get(&path)
            && now.duration_since(*last) < debounce_duration
        {
            continue;
        }
        debounce_map.insert(path.clone(), now);

        debug!("FIM event: {:?} on {}", change_type, path.display());

        // Build the alert
        let old_baseline = baseline.get(&path);
        let old_hash = old_baseline.as_ref().map(|b| b.hash.clone());

        let (new_hash, new_size) = if change_type != FimChangeType::Deleted && path.exists() {
            match crate::baseline::compute_blake3(&path) {
                Ok(hash) => {
                    let size = std::fs::metadata(&path).map(|m| m.len()).ok();
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
                baseline.remove(&path);
            }
            _ => {
                if let Err(e) = baseline.update(&path) {
                    tracing::warn!(
                        "Failed to update FIM baseline for {}: {}",
                        path.display(),
                        e
                    );
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

    // On Windows, use case-insensitive matching and normalize separators
    #[cfg(target_os = "windows")]
    let path_norm = path_str.to_lowercase().replace('\\', "/");
    #[cfg(not(target_os = "windows"))]
    let path_norm = path_str;

    for pattern in patterns {
        #[cfg(target_os = "windows")]
        let pattern_norm = pattern.to_lowercase().replace('\\', "/");
        #[cfg(not(target_os = "windows"))]
        let pattern_norm = pattern.clone();

        if let Some(suffix) = pattern_norm.strip_prefix('*') {
            if path_norm.ends_with(suffix) {
                return true;
            }
        } else if let Some(prefix) = pattern_norm.strip_suffix("/**") {
            if path_norm.contains(prefix) {
                return true;
            }
        } else if path_norm.contains(&pattern_norm) {
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
