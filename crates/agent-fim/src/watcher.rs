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
                        debug!("FIM: skipping inaccessible path {:?}: {}", e.paths, e);
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
    })
    .await
    .map_err(|e| FimError::Watcher(format!("Watcher task failed: {e}")))?;

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
            Err(_) if matches!(change_type, FimChangeType::Deleted | FimChangeType::Renamed) => {
                // Removed files cannot be canonicalized. Only accept a path
                // already recorded in the baseline, never an arbitrary missing link.
                let candidate = raw_path
                    .parent()
                    .and_then(|p| p.canonicalize().ok())
                    .and_then(|parent| raw_path.file_name().map(|name| parent.join(name)))
                    .unwrap_or_else(|| raw_path.clone());
                if baseline.get(&candidate).is_none() {
                    continue;
                }
                candidate
            }
            Err(_) => {
                debug!(
                    "FIM: skipping {} (canonicalize failed, possible broken symlink)",
                    raw_path.display()
                );
                continue;
            }
        };

        // Skip NTFS internal paths (deleted file journal, recycle bin, etc.)
        // These are transient system paths that generate spurious alerts on Windows.
        #[cfg(target_os = "windows")]
        {
            let path_str = path.to_string_lossy();
            if path_str.contains(r"\$Extend\")
                || path_str.contains(r"\$Recycle.Bin\")
                || path_str.contains(r"\System Volume Information\")
            {
                continue;
            }
        }

        // Skip ignored patterns (checked against the canonical path). An
        // excluded directory is skipped along with its content, so that a
        // chmod of the agent's own config directory does not alert either.
        let ignored = if path.is_dir() {
            is_ignored_dir(&path, ignore_patterns)
        } else {
            is_ignored_path(&path, ignore_patterns)
        };
        if ignored {
            continue;
        }

        // Debounce: skip if we recently processed this path
        let now = Instant::now();
        if let Some(last) = debounce_map.get(&path)
            && now.duration_since(*last) < debounce_duration
            && !matches!(change_type, FimChangeType::Deleted | FimChangeType::Renamed)
        {
            continue;
        }

        debug!("FIM event: {:?} on {}", change_type, path.display());

        // Build the alert
        let old_baseline = baseline.get(&path);
        let old_hash = old_baseline.as_ref().map(|b| b.hash.clone());
        // FSEvents can replay a creation event for a file already baselined.
        // Compare its contents instead of declaring a new file unconditionally.
        let change_type = if change_type == FimChangeType::Created && old_baseline.is_some() {
            FimChangeType::Modified
        } else {
            change_type
        };

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
        debounce_map.insert(path.clone(), now);

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
///
/// Three pattern forms are understood:
///
/// - `*suffix`: the path ends with `suffix` (`*.log`).
/// - `dir/**`: the path lies inside a directory named `dir`.
/// - `name`: the path is, or lies inside, a file or directory named `name`.
///
/// `dir` and `name` may span several components (`systemprofile/AppData/**`).
pub(crate) fn is_ignored_path(path: &Path, patterns: &[String]) -> bool {
    matches_ignore_pattern(path, patterns, false)
}

/// Check if a directory should be ignored along with everything in it.
///
/// Same as [`is_ignored_path`], except that the directory a `dir/**` pattern
/// names counts as ignored too. Only call this on a path known to be a
/// directory: a *file* called `dir` is not covered by `dir/**`.
pub(crate) fn is_ignored_dir(dir: &Path, patterns: &[String]) -> bool {
    matches_ignore_pattern(dir, patterns, true)
}

fn matches_ignore_pattern(path: &Path, patterns: &[String], is_dir: bool) -> bool {
    let path_str = path.to_string_lossy();

    // Case-insensitive on every platform, and separators normalized.
    //
    // This used to be Windows-only, which broke the agent's own self-exclusion
    // on macOS: the data directory is `SentinelGRC` (capitalized), so the
    // lowercase `sentinel/**` pattern never matched and the agent would watch
    // its own config and database if either fell under a watched path.
    let path_norm = path_str.to_lowercase().replace('\\', "/");
    let components: Vec<&str> = path_norm.split('/').filter(|c| !c.is_empty()).collect();

    for pattern in patterns {
        let pattern_norm = pattern.to_lowercase().replace('\\', "/");

        if let Some(suffix) = pattern_norm.strip_prefix('*') {
            if path_norm.ends_with(suffix) {
                return true;
            }
        } else if let Some(dir) = pattern_norm.strip_suffix("/**") {
            // Only what lies inside the directory: something must follow
            // `dir`, otherwise a file that merely shares the directory's name
            // (`/etc/cron.d/sentinel`) would escape monitoring.
            if has_component_run(&components, dir, !is_dir) {
                return true;
            }
        } else if has_component_run(&components, &pattern_norm, false) {
            return true;
        }
    }
    false
}

/// Whether the names in `wanted` (separated by `/`) appear in `components` as
/// consecutive, whole path components.
///
/// SECURITY: names are compared component by component, never as substrings.
/// A substring test turned `sentinel/**` into "any path containing `sentinel`",
/// so `/etc/cron.d/sentinel-update` was silently left unmonitored.
///
/// With `needs_child`, at least one more component must follow the run.
fn has_component_run(components: &[&str], wanted: &str, needs_child: bool) -> bool {
    let wanted: Vec<&str> = wanted.split('/').filter(|c| !c.is_empty()).collect();
    // A pattern naming nothing matches nothing (a substring test made the
    // empty pattern match every path).
    if wanted.is_empty() {
        return false;
    }
    let searchable = if needs_child {
        &components[..components.len().saturating_sub(1)]
    } else {
        components
    };
    searchable
        .windows(wanted.len())
        .any(|run| run == wanted.as_slice())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deleted_file_is_reported_even_inside_debounce_window() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("deleted.txt");
        std::fs::write(&path, "content").unwrap();
        let path = path.canonicalize().unwrap();
        let baseline = BaselineManager::new();
        baseline.update(&path).unwrap();
        let (tx, mut rx) = mpsc::channel(8);
        let mut debounce = HashMap::from([(path.clone(), Instant::now())]);
        std::fs::remove_file(&path).unwrap();
        process_event(
            Event::new(EventKind::Remove(notify::event::RemoveKind::File)).add_path(path.clone()),
            &baseline,
            &tx,
            &mut debounce,
            Duration::from_secs(5),
            &[],
        );
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Deleted);
        assert!(baseline.get(&path).is_none());
    }

    #[test]
    fn replayed_creation_is_silent_and_does_not_hide_a_subsequent_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("existing.txt");
        std::fs::write(&path, "before").unwrap();
        let path = path.canonicalize().unwrap();
        let baseline = BaselineManager::new();
        baseline.update(&path).unwrap();
        let (tx, mut rx) = mpsc::channel(8);
        let mut debounce = HashMap::new();
        let event =
            Event::new(EventKind::Create(notify::event::CreateKind::File)).add_path(path.clone());
        process_event(
            event.clone(),
            &baseline,
            &tx,
            &mut debounce,
            Duration::from_secs(5),
            &[],
        );
        assert!(rx.try_recv().is_err());
        std::fs::write(&path, "after").unwrap();
        process_event(
            event,
            &baseline,
            &tx,
            &mut debounce,
            Duration::from_secs(5),
            &[],
        );
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Modified);
    }

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

    /// The agent's macOS data directory is `SentinelGRC`, capitalized. Matching
    /// used to be case-sensitive off Windows, so the lowercase self-exclusion
    /// patterns never matched it and the agent would have watched its own
    /// config and database.
    #[test]
    fn self_exclusion_matches_capitalized_macos_paths() {
        let patterns = agent_common::types::fim::SELF_EXCLUSION_PATTERNS
            .iter()
            .map(|p| (*p).to_string())
            .collect::<Vec<_>>();

        for path in [
            "/Users/x/Library/Application Support/SentinelGRC/agent.db",
            "/Users/x/Library/Application Support/SentinelGRC/agent.json",
            "/Applications/SentinelAgent.app/Contents/MacOS/sentinel-agent",
            "/var/lib/sentinel-grc/agent.db",
        ] {
            assert!(
                is_ignored_path(&PathBuf::from(path), &patterns),
                "agent-owned path must be ignored: {}",
                path
            );
        }

        // The exclusion must stay narrow enough to keep watching real targets.
        assert!(!is_ignored_path(&PathBuf::from("/etc/passwd"), &patterns));
        assert!(!is_ignored_path(&PathBuf::from("/usr/bin/sudo"), &patterns));
    }

    fn self_exclusions() -> Vec<String> {
        agent_common::types::fim::SELF_EXCLUSION_PATTERNS
            .iter()
            .map(|p| (*p).to_string())
            .collect()
    }

    /// `sentinel/**` used to be tested as a substring, so any path with
    /// "sentinel" in it went unmonitored: an attacker only had to name a
    /// dropper after the agent.
    #[test]
    fn self_exclusion_does_not_hide_files_named_after_the_agent() {
        let patterns = self_exclusions();

        for path in [
            "/etc/sentinel-update",
            "/etc/cron.d/sentinel-job",
            "/etc/cron.d/sentinel-update",
            "/etc/sentinel-e2e-dropper.conf",
            "/etc/hosts.sentinel-test",
            "/etc/sentinel.conf",
            "/etc/SentinelGRC.conf",
            "/etc/sentinel.d/job",
            "/etc/mysentinel/job",
            // A file bearing the exact name of an agent directory.
            "/etc/cron.d/sentinel",
            "/usr/bin/sentinel-grc",
            // The launchd log names only count under /var/log.
            "/etc/cron.d/sentinel-agent.log",
            "/usr/bin/sentinel-agent.err",
        ] {
            assert!(
                !is_ignored_path(&PathBuf::from(path), &patterns),
                "must stay monitored: {}",
                path
            );
        }
    }

    #[test]
    fn file_named_after_the_agent_raises_an_alert_but_agent_files_do_not() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::create_dir(root.join("sentinel")).unwrap();
        std::fs::create_dir(root.join("cron.d")).unwrap();
        let own_dir = root.join("sentinel");
        let own = own_dir.join("agent.json");
        let dropper = root.join("sentinel-update");
        // A file, not a directory, bearing the agent directory's exact name.
        let namesake = root.join("cron.d").join("sentinel");
        for path in [&own, &dropper, &namesake] {
            std::fs::write(path, "payload").unwrap();
        }
        let baseline = BaselineManager::new();
        let (tx, mut rx) = mpsc::channel(8);
        let mut debounce = HashMap::new();
        for path in [&own_dir, &own, &dropper, &namesake] {
            process_event(
                Event::new(EventKind::Create(notify::event::CreateKind::Any))
                    .add_path(path.clone()),
                &baseline,
                &tx,
                &mut debounce,
                Duration::from_secs(5),
                &self_exclusions(),
            );
        }
        for expected in [&dropper, &namesake] {
            let alert = rx.try_recv().unwrap();
            assert_eq!(&alert.path, expected);
            assert_eq!(alert.change, FimChangeType::Created);
        }
        assert!(rx.try_recv().is_err());
    }

    /// Every directory the agent writes to must stay excluded, whatever the
    /// platform: watching any of them feeds FIM its own alerts.
    #[test]
    fn self_exclusion_covers_agent_directories_on_every_platform() {
        let patterns = self_exclusions();

        for path in [
            // Linux
            "/etc/sentinel/agent.json",
            "/var/lib/sentinel-grc/agent.db",
            "/var/lib/sentinel-grc/cache/threat-intel/feeds.json",
            "/var/log/sentinel/agent.log.2026-10-10",
            "/var/log/sentinel-grc/agent.log.2026-10-10",
            "/home/x/.local/share/sentinel/logs/agent.log.2026-10-10",
            "/home/x/.local/share/sentinel-grc/quarantine/0b0e6f0e.meta",
            "/home/x/.local/share/sentinelagent/app.ron",
            "/tmp/sentinel-logs/agent.log.2026-10-10",
            // macOS
            "/Users/x/Library/Application Support/SentinelGRC/agent.db",
            "/Users/x/Library/Application Support/SentinelGRC/logs/agent.log.2026-10-10",
            "/Users/x/Library/Application Support/com.sentinel-grc.Sentinel/logs/agent.log.2026-10-10",
            "/Users/x/Library/Application Support/sentinel-grc/quarantine/0b0e6f0e.meta",
            "/Users/x/Library/Application Support/com.CyberThreatConsulting.SentinelAgent/app.ron",
            "/Applications/SentinelAgent.app/Contents/MacOS/SentinelAgent",
            "/private/var/log/sentinel/agent.log.2026-10-10",
            "/private/var/log/sentinel-agent.log",
            "/private/var/log/sentinel-agent.err",
            "/private/var/log/sentinel-agent-helper.log",
            // Windows, with and without the verbatim prefix `canonicalize` adds.
            r"C:\ProgramData\Sentinel\agent.json",
            r"C:\ProgramData\Sentinel\data\agent.db",
            r"\\?\C:\ProgramData\Sentinel\logs\agent.log.2026-10-10",
            r"C:\Users\x\AppData\Local\Sentinel\agent.json",
            r"C:\Users\x\AppData\Local\sentinel-grc\quarantine\0b0e6f0e.meta",
            r"C:\Users\x\AppData\Local\sentinel-grc\Sentinel\data\logs\agent.log.2026-10-10",
            r"C:\Users\x\AppData\Local\CyberThreatConsulting\SentinelAgent\data\app.ron",
        ] {
            assert!(
                is_ignored_path(&PathBuf::from(path), &patterns),
                "agent-owned path must be ignored: {}",
                path
            );
        }
    }

    #[test]
    fn directory_patterns_match_whole_components_only() {
        let patterns = vec![
            ".git/**".to_string(),
            "systemprofile/AppData/**".to_string(),
        ];

        for path in [
            "/repo/.git/config",
            "/repo/.git/objects/ab/cdef",
            r"C:\Windows\System32\config\systemprofile\AppData\Local\D3DSCache\x.bin",
        ] {
            assert!(is_ignored_path(&PathBuf::from(path), &patterns), "{}", path);
        }

        for path in [
            "/repo/.gitignore",
            "/repo/.github/workflows/ci.yml",
            "/repo/x.git/config",
            // The bare name may just as well be a file: not covered unless
            // the caller knows it is a directory (`is_ignored_dir`).
            "/repo/.git",
            r"C:\Windows\System32\config\systemprofile\AppDataBackup\x.bin",
            r"C:\Windows\System32\config\systemprofile\Local\AppData\x.bin",
        ] {
            assert!(
                !is_ignored_path(&PathBuf::from(path), &patterns),
                "{}",
                path
            );
        }

        assert!(is_ignored_dir(&PathBuf::from("/repo/.git"), &patterns));
        assert!(!is_ignored_dir(&PathBuf::from("/repo/.github"), &patterns));
    }

    #[test]
    fn plain_patterns_match_whole_components_only() {
        let patterns = vec!["node_modules".to_string(), "etc/resolv.conf".to_string()];

        for path in [
            "/srv/app/node_modules",
            "/srv/app/node_modules/left-pad/index.js",
            "/etc/resolv.conf",
            "/private/etc/resolv.conf",
        ] {
            assert!(is_ignored_path(&PathBuf::from(path), &patterns), "{}", path);
        }

        for path in [
            "/srv/app/node_modules_evil/index.js",
            "/srv/app/my-node_modules/index.js",
            "/etc/resolv.conf.bak",
            "/etc/cron.d/resolv.conf",
        ] {
            assert!(
                !is_ignored_path(&PathBuf::from(path), &patterns),
                "{}",
                path
            );
        }
    }

    /// An empty pattern (a blank entry in a pushed config) used to match every
    /// path and switch monitoring off altogether.
    #[test]
    fn patterns_naming_nothing_ignore_nothing() {
        let patterns = vec![String::new(), "/".to_string(), "/**".to_string()];

        assert!(!is_ignored_path(&PathBuf::from("/etc/passwd"), &patterns));
        assert!(!is_ignored_dir(&PathBuf::from("/etc"), &patterns));
    }
}
