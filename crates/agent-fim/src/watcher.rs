// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! File system watcher using the `notify` crate.
//!
//! Uses inotify (Linux), FSEvents (macOS), or ReadDirectoryChanges (Windows)
//! to detect file system changes in real time.

use crate::FimError;
use crate::baseline::BaselineManager;
use agent_common::types::{FimAlert, FimChangeType, FimDetection, FimPolicy};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Paths remembered at most by the event loop (last reads, pending reads).
const MAX_TRACKED_PATHS: usize = 10_000;

/// Start watching files according to the FIM policy.
///
/// Events received before `ready` is set are kept and read once it is: the
/// watcher is started before the baseline is compared with the disk, so no
/// change slips between the two, and it must not report against a baseline
/// that is still being read.
///
/// This function blocks until the shutdown signal is set.
pub async fn watch_files(
    policy: FimPolicy,
    baseline: Arc<BaselineManager>,
    alert_tx: mpsc::Sender<FimAlert>,
    shutdown: Arc<AtomicBool>,
    ready: Arc<AtomicBool>,
) -> Result<(), FimError> {
    // notify's EventHandler is only implemented for std::sync::mpsc::Sender (not SyncSender).
    // The event loop bounds what it remembers instead.
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

    let mut events = EventLoop::new(
        baseline,
        alert_tx,
        Duration::from_millis(policy.debounce_ms),
        policy.ignore_patterns.clone(),
    );

    // Process events in a background thread (notify uses std channels).
    // Move the watcher into the closure to keep it alive for the lifetime of the loop;
    // dropping it would close the sender side of the mpsc channel.
    tokio::task::spawn_blocking(move || {
        let _watcher = watcher; // prevent drop until this closure exits

        loop {
            if shutdown.load(Ordering::Acquire) {
                info!("FIM watcher shutting down");
                break;
            }

            let is_ready = ready.load(Ordering::Acquire);
            match rx.recv_timeout(events.next_wait()) {
                Ok(Ok(event)) => events.handle(event, is_ready),
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
            if is_ready {
                events.read_pending(Instant::now());
            }
        }
    })
    .await
    .map_err(|e| FimError::Watcher(format!("Watcher task failed: {e}")))?;

    Ok(())
}

/// What the event loop of one watcher remembers between two events.
struct EventLoop {
    baseline: Arc<BaselineManager>,
    alert_tx: mpsc::Sender<FimAlert>,
    debounce: Duration,
    ignore_patterns: Vec<String>,
    /// When each path was last reported.
    last_reported: HashMap<PathBuf, Instant>,
    /// Paths to read, and from when: their event arrived while the path was
    /// being debounced, or before the baseline was ready. Reading them once
    /// the burst is over is what records the final state of a file written
    /// in several steps.
    pending: HashMap<PathBuf, Instant>,
}

impl EventLoop {
    fn new(
        baseline: Arc<BaselineManager>,
        alert_tx: mpsc::Sender<FimAlert>,
        debounce: Duration,
        ignore_patterns: Vec<String>,
    ) -> Self {
        Self {
            baseline,
            alert_tx,
            debounce,
            ignore_patterns,
            last_reported: HashMap::new(),
            pending: HashMap::new(),
        }
    }

    /// How long to wait for the next event: no longer than the debounce
    /// interval while paths are waiting to be read.
    fn next_wait(&self) -> Duration {
        let second = Duration::from_secs(1);
        if self.pending.is_empty() {
            second
        } else {
            self.debounce.clamp(Duration::from_millis(50), second)
        }
    }

    /// The files an event path stands for.
    ///
    /// The path with its symbolic links resolved, as before: exclusions are
    /// tested on the real location. And, when the path itself is a link that
    /// has taken the place of a watched file, that file too — it is gone, and
    /// resolving the link would hide it.
    fn targets(&self, raw_path: &Path) -> Vec<PathBuf> {
        let literal = crate::baseline::entry_path(raw_path);
        match raw_path.canonicalize() {
            Ok(resolved) if resolved == literal => vec![resolved],
            Ok(resolved) => {
                if self.baseline.has_entry(&literal) {
                    vec![literal, resolved]
                } else {
                    vec![resolved]
                }
            }
            // Removed files cannot be resolved. Only accept a path already
            // recorded in the baseline, never an arbitrary missing link.
            Err(_) if self.baseline.has_entry(&literal) => vec![literal],
            Err(_) => {
                debug!(
                    "FIM: skipping {} (not resolvable and not in the baseline)",
                    raw_path.display()
                );
                Vec::new()
            }
        }
    }

    /// Process a single file system event.
    fn handle(&mut self, event: Event, ready: bool) {
        let hint = match event.kind {
            EventKind::Create(_) => FimChangeType::Created,
            EventKind::Modify(notify::event::ModifyKind::Data(_)) => FimChangeType::Modified,
            EventKind::Modify(notify::event::ModifyKind::Metadata(_)) => {
                FimChangeType::PermissionChanged
            }
            EventKind::Modify(notify::event::ModifyKind::Name(_)) => FimChangeType::Renamed,
            EventKind::Remove(_) => FimChangeType::Deleted,
            _ => return, // Ignore other events
        };

        let now = Instant::now();
        self.forget_old(now);

        for raw_path in &event.paths {
            for path in self.targets(raw_path) {
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

                if is_ignored_path(&path, &self.ignore_patterns) {
                    continue;
                }

                if !ready {
                    self.defer(path, now, now);
                    continue;
                }

                // Debounce: a path reported a moment ago is read again once
                // the burst is over. A removal is reported at once.
                if let Some(last) = self.last_reported.get(&path).copied()
                    && now.duration_since(last) < self.debounce
                    && !matches!(hint, FimChangeType::Deleted | FimChangeType::Renamed)
                {
                    self.defer(path, last + self.debounce, now);
                    continue;
                }

                debug!("FIM event: {:?} on {}", hint, path.display());
                self.read(&path, Some(hint), now);
            }
        }
    }

    /// Keep `path` to be read from `due`. When too many paths are waiting,
    /// it is read at once rather than forgotten.
    fn defer(&mut self, path: PathBuf, due: Instant, now: Instant) {
        if self.pending.len() >= MAX_TRACKED_PATHS && !self.pending.contains_key(&path) {
            self.read(&path, None, now);
        } else {
            self.pending.entry(path).or_insert(due);
        }
    }

    /// Read the pending paths whose time has come.
    fn read_pending(&mut self, now: Instant) {
        if self.pending.is_empty() {
            return;
        }
        let due: Vec<PathBuf> = self
            .pending
            .iter()
            .filter(|(_, at)| **at <= now)
            .map(|(path, _)| path.clone())
            .collect();
        for path in due {
            self.pending.remove(&path);
            self.read(&path, None, now);
        }
    }

    /// Read a file against the baseline and report what changed.
    ///
    /// The baseline says what happened; the event only names it where the
    /// baseline cannot: a rename, or a change to a file it did not hold.
    fn read(&mut self, path: &Path, hint: Option<FimChangeType>, now: Instant) {
        let observation = self.baseline.observe(path);
        let Some(mut alert) = observation.into_alert(FimDetection::Realtime) else {
            return;
        };
        alert.change = match (hint, alert.change) {
            (Some(FimChangeType::Renamed), FimChangeType::Created | FimChangeType::Deleted) => {
                FimChangeType::Renamed
            }
            (
                Some(hint @ (FimChangeType::Modified | FimChangeType::PermissionChanged)),
                FimChangeType::Created,
            ) => hint,
            (_, observed) => observed,
        };
        self.last_reported.insert(path.to_path_buf(), now);

        // Send alert (non-blocking). Log if channel is full to avoid silent data loss.
        if let Err(e) = self.alert_tx.try_send(alert) {
            warn!(
                "FIM alert channel full, alert dropped for {}: {}",
                path.display(),
                e
            );
        }
    }

    /// Bound what is remembered of past reports.
    fn forget_old(&mut self, now: Instant) {
        if self.last_reported.len() > MAX_TRACKED_PATHS {
            let before = self.last_reported.len();
            let debounce = self.debounce;
            self.last_reported
                .retain(|_, at| now.duration_since(*at) < debounce);
            debug!(
                "FIM debounce eviction: {} → {} entries",
                before,
                self.last_reported.len()
            );
        }
    }
}

/// Check if a path should be ignored based on patterns.
fn is_ignored_path(path: &Path, patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();

    // Case-insensitive on every platform, and separators normalized.
    //
    // This used to be Windows-only, which broke the agent's own self-exclusion
    // on macOS: the data directory is `SentinelGRC` (capitalized), so the
    // lowercase `sentinel/**` pattern never matched and the agent would watch
    // its own config and database if either fell under a watched path.
    let path_norm = path_str.to_lowercase().replace('\\', "/");

    for pattern in patterns {
        let pattern_norm = pattern.to_lowercase().replace('\\', "/");

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

    const LONG: Duration = Duration::from_secs(5);

    /// An event loop on an empty baseline, and the alerts it sends.
    fn event_loop(debounce: Duration) -> (EventLoop, mpsc::Receiver<FimAlert>) {
        let (tx, rx) = mpsc::channel(8);
        let baseline = Arc::new(BaselineManager::new());
        (EventLoop::new(baseline, tx, debounce, Vec::new()), rx)
    }

    /// A file of a fresh directory, by its resolved path.
    fn file_in(dir: &tempfile::TempDir, name: &str, content: &str) -> PathBuf {
        let path = dir.path().canonicalize().unwrap().join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    fn created(path: &Path) -> Event {
        Event::new(EventKind::Create(notify::event::CreateKind::File)).add_path(path.into())
    }

    fn written(path: &Path) -> Event {
        Event::new(EventKind::Modify(notify::event::ModifyKind::Data(
            notify::event::DataChange::Content,
        )))
        .add_path(path.into())
    }

    fn removed(path: &Path) -> Event {
        Event::new(EventKind::Remove(notify::event::RemoveKind::File)).add_path(path.into())
    }

    fn renamed(path: &Path) -> Event {
        Event::new(EventKind::Modify(notify::event::ModifyKind::Name(
            notify::event::RenameMode::Any,
        )))
        .add_path(path.into())
    }

    fn metadata_changed(path: &Path) -> Event {
        Event::new(EventKind::Modify(notify::event::ModifyKind::Metadata(
            notify::event::MetadataKind::Any,
        )))
        .add_path(path.into())
    }

    #[test]
    fn deleted_file_is_reported_even_inside_debounce_window() {
        let dir = tempfile::tempdir().unwrap();
        let path = file_in(&dir, "deleted.txt", "content");
        let (mut events, mut rx) = event_loop(LONG);
        events.baseline.update(&path).unwrap();
        events.last_reported.insert(path.clone(), Instant::now());
        std::fs::remove_file(&path).unwrap();

        events.handle(removed(&path), true);

        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Deleted);
        assert!(events.baseline.get(&path).is_none());
    }

    #[test]
    fn replayed_creation_is_silent_and_does_not_hide_a_subsequent_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = file_in(&dir, "existing.txt", "before");
        let (mut events, mut rx) = event_loop(LONG);
        events.baseline.update(&path).unwrap();

        events.handle(created(&path), true);
        assert!(rx.try_recv().is_err());

        std::fs::write(&path, "after").unwrap();
        events.handle(created(&path), true);
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Modified);
    }

    /// A file written in several steps used to keep the hash of its first
    /// step: the later events fell inside the debounce interval and were
    /// dropped, so the baseline and the YARA scan saw a partial file.
    #[test]
    fn a_write_inside_the_debounce_interval_is_read_once_it_is_over() {
        let dir = tempfile::tempdir().unwrap();
        let path = file_in(&dir, "report.txt", "first half");
        let (mut events, mut rx) = event_loop(Duration::from_millis(200));

        events.handle(created(&path), true);
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Created);

        std::fs::write(&path, "first half, second half").unwrap();
        events.handle(written(&path), true);
        assert!(rx.try_recv().is_err(), "held back, not read yet");

        // Not due yet: nothing is read.
        events.read_pending(Instant::now());
        assert!(rx.try_recv().is_err());

        events.read_pending(Instant::now() + Duration::from_millis(250));
        let alert = rx.try_recv().unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert_eq!(
            alert.new_hash,
            Some(crate::baseline::compute_blake3(&path).unwrap())
        );
        assert!(events.pending.is_empty());
    }

    /// The watcher starts before the baseline is compared with the disk. An
    /// event of that interval is kept, then read against the finished
    /// baseline: a file the scan has seen meanwhile is not reported twice.
    #[test]
    fn events_received_before_the_baseline_is_ready_are_read_afterwards() {
        let dir = tempfile::tempdir().unwrap();
        let seen_by_the_scan = file_in(&dir, "scanned.txt", "content");
        let changed_since = file_in(&dir, "changed.txt", "before");
        let (mut events, mut rx) = event_loop(LONG);

        events.handle(created(&seen_by_the_scan), false);
        events.handle(created(&changed_since), false);
        assert!(rx.try_recv().is_err());

        // The scan runs, then the second file is written.
        events.baseline.scan(&[dir.path().to_path_buf()], &[], true);
        std::fs::write(&changed_since, "after").unwrap();

        events.read_pending(Instant::now());
        let alert = rx.try_recv().unwrap();
        assert_eq!(alert.path, changed_since);
        assert_eq!(alert.change, FimChangeType::Modified);
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn a_rename_is_named_by_the_event_and_a_replacement_by_what_changed() {
        let dir = tempfile::tempdir().unwrap();
        let (mut events, mut rx) = event_loop(Duration::ZERO);
        let old_name = file_in(&dir, "old.conf", "content");
        events.baseline.update(&old_name).unwrap();

        // Moved: the old name is gone, the new one appears.
        let new_name = old_name.with_file_name("new.conf");
        std::fs::rename(&old_name, &new_name).unwrap();
        events.handle(renamed(&old_name), true);
        events.handle(renamed(&new_name), true);
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Renamed);
        assert_eq!(rx.try_recv().unwrap().change, FimChangeType::Renamed);

        // An editor saving through a temporary file renames it over the
        // watched one: the watched file was rewritten, not renamed.
        let temporary = file_in(&dir, "new.conf.swap", "edited");
        std::fs::rename(&temporary, &new_name).unwrap();
        events.handle(renamed(&new_name), true);
        let alert = rx.try_recv().unwrap();
        assert_eq!(alert.change, FimChangeType::Modified);
        assert!(alert.old_hash.is_some() && alert.new_hash.is_some());
    }

    #[cfg(unix)]
    #[test]
    fn a_metadata_event_reports_only_a_real_change_and_says_which() {
        use agent_common::types::FimAttribute;
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let path = file_in(&dir, "sudoers", "root ALL=(ALL) ALL");
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o440)).unwrap();
        let (mut events, mut rx) = event_loop(Duration::ZERO);
        events.baseline.update(&path).unwrap();

        // An access time or extended attribute update: nothing changed.
        events.handle(metadata_changed(&path), true);
        assert!(rx.try_recv().is_err());

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o666)).unwrap();
        events.handle(metadata_changed(&path), true);
        let alert = rx.try_recv().unwrap();
        assert_eq!(alert.change, FimChangeType::PermissionChanged);
        assert_eq!(alert.changed_attributes, vec![FimAttribute::Permissions]);
        assert_eq!(alert.attribute_summary(), "permissions 440 -> 666");
        assert!(alert.widens_access());
    }

    /// Resolving the links of an event path hid this: the watched file is
    /// replaced by a link, the link resolves to a file elsewhere, and the
    /// watched file's own disappearance was never reported.
    #[cfg(unix)]
    #[test]
    fn a_watched_file_replaced_by_a_link_is_reported_gone() {
        let dir = tempfile::tempdir().unwrap();
        let watched = file_in(&dir, "passwd", "root:x:0:0");
        let elsewhere = file_in(&dir, "forged", "attacker:x:0:0");
        let (mut events, mut rx) = event_loop(Duration::ZERO);
        events.baseline.update(&watched).unwrap();
        events.baseline.update(&elsewhere).unwrap();

        std::fs::remove_file(&watched).unwrap();
        std::os::unix::fs::symlink(&elsewhere, &watched).unwrap();
        events.handle(created(&watched), true);

        let alert = rx.try_recv().unwrap();
        assert_eq!(alert.path, watched);
        assert_eq!(alert.change, FimChangeType::Deleted);
        assert!(events.baseline.get(&elsewhere).is_some());
        assert!(!events.baseline.has_entry(&watched));
    }

    #[test]
    fn an_event_for_an_unknown_missing_path_is_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().canonicalize().unwrap().join("never-existed");
        let (mut events, mut rx) = event_loop(Duration::ZERO);
        events.handle(removed(&path), true);
        assert!(rx.try_recv().is_err());
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
}
