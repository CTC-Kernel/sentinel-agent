// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! File Integrity Monitoring (FIM) Engine for the Sentinel GRC Agent.
//!
//! This crate provides real-time file system monitoring using the `notify` crate
//! (inotify on Linux, FSEvents on macOS, ReadDirectoryChanges on Windows).
//!
//! Three things find a change, and an alert says which ([`FimDetection`]):
//!
//! - the watcher, as the operating system reports it;
//! - the comparison made at start with the baseline saved by the previous
//!   run ([`store`]), for what was changed while the agent was stopped;
//! - a periodic full scan, for what the operating system did not report
//!   (event queue overflow, watch limit, a path replaced as a whole).
//!
//! A change is a difference in contents, permission bits, owner or group;
//! the alert carries the values before and after.
//!
//! # Architecture
//!
//! ```text
//! ┌───────────┐     ┌──────────┐     ┌───────────┐
//! │ FimEngine │────▶│ Watcher  │────▶│  Events   │
//! └───────────┘     └──────────┘     └───────────┘
//!       │                                  │
//!       ▼                                  ▼
//! ┌───────────┐                    ┌───────────┐
//! │ Baseline  │                    │  Alerts   │
//! └───────────┘                    └───────────┘
//! ```

pub mod alerts;
pub mod baseline;
pub mod canary;
pub mod content;
pub mod policy;
pub mod store;
pub mod watcher;

use agent_common::types::{FimAlert, FimDetection, FimPolicy};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use store::Coverage;

/// Re-export FimPolicy as FimConfig for compatibility
pub type FimConfig = FimPolicy;
use std::sync::RwLock;
use tokio::sync::mpsc;
use tracing::{info, warn};

/// How often a baseline that changed is written to disk.
const SAVE_INTERVAL: Duration = Duration::from_secs(60);

/// FIM engine that coordinates watching, baselining, and alerting.
pub struct FimEngine {
    /// Active FIM policy.
    policy: Arc<RwLock<FimPolicy>>,

    /// Baseline manager for hash comparisons.
    baseline_mgr: Arc<baseline::BaselineManager>,

    /// Channel for sending FIM alerts to the runtime.
    alert_tx: mpsc::Sender<FimAlert>,

    /// Shutdown flag.
    shutdown: RwLock<Arc<AtomicBool>>,

    /// Watcher task handle for monitoring termination.
    watcher_handle: RwLock<Option<tokio::task::JoinHandle<()>>>,

    /// Where the baseline is kept between two runs. Without it the baseline
    /// lives in memory only and a change made while the agent is stopped is
    /// not found.
    state_file: Option<PathBuf>,

    /// What the baseline in memory was built from, once it has been.
    coverage: Arc<RwLock<Option<Coverage>>>,

    /// Changes found at start against the baseline saved by the previous run.
    startup_findings: Arc<std::sync::atomic::AtomicUsize>,
}

/// Everything a full scan needs, detached from the engine so it can run on
/// the periodic task as well.
#[derive(Clone)]
struct Scanner {
    baseline: Arc<baseline::BaselineManager>,
    alert_tx: mpsc::Sender<FimAlert>,
    coverage: Arc<RwLock<Option<Coverage>>>,
    state_file: Option<PathBuf>,
}

impl Scanner {
    /// Compare the watched paths with the baseline and report the
    /// differences. Returns how many were reported.
    ///
    /// A file absent from the baseline is reported as created only where the
    /// baseline already looked (see [`Coverage::knew`]). Without a previous
    /// baseline nothing is reported: this is the first one.
    async fn scan(&self, policy: &FimPolicy, detection: FimDetection) -> usize {
        let previous = self
            .coverage
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let now = Coverage::new(&policy.watched_paths, &policy.ignore_patterns);

        let baseline = self.baseline.clone();
        let roots = policy.watched_paths.clone();
        let patterns = policy.ignore_patterns.clone();
        let recursive = policy.recursive;
        let started = Instant::now();
        let report =
            match tokio::task::spawn_blocking(move || baseline.scan(&roots, &patterns, recursive))
                .await
            {
                Ok(report) => report,
                Err(e) => {
                    warn!("FIM scan failed: {}", e);
                    return 0;
                }
            };
        info!(
            "FIM scan ({}): {} files read, {} differences, in {:.1}s",
            detection,
            report.files,
            report.changes.len(),
            started.elapsed().as_secs_f32()
        );

        let alerts: Vec<FimAlert> = match &previous {
            None => Vec::new(),
            Some(previous) => report
                .changes
                .into_iter()
                .filter(|change| match change {
                    baseline::Observation::Created(new) => previous.knew(&new.path, &now),
                    _ => true,
                })
                .filter_map(|change| change.into_alert(detection))
                .collect(),
        };
        *self.coverage.write().unwrap_or_else(|e| e.into_inner()) = Some(now);

        let reported = alerts.len();
        if reported > 0 {
            // Delivered apart from the scan: the channel is bounded and the
            // runtime may not be reading it yet. Waiting, rather than
            // dropping, keeps every finding of a scan.
            let alert_tx = self.alert_tx.clone();
            tokio::spawn(async move {
                for alert in alerts {
                    if alert_tx.send(alert).await.is_err() {
                        break;
                    }
                }
            });
        }
        reported
    }

    /// Write the baseline to disk if it changed since it was last written.
    fn save_if_changed(&self) {
        let Some(path) = &self.state_file else {
            return;
        };
        if !self.baseline.take_dirty() {
            return;
        }
        let coverage = self
            .coverage
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
            .unwrap_or_default();
        let snapshot = store::Snapshot::new(coverage, self.baseline.entries());
        if let Err(e) = store::save(path, &snapshot) {
            warn!(
                "Failed to save the FIM baseline to {}: {}",
                path.display(),
                e
            );
            self.baseline.mark_dirty();
        }
    }
}

impl FimEngine {
    /// Create a new FIM engine with the given policy and alert channel.
    pub fn new(policy: FimPolicy, alert_tx: mpsc::Sender<FimAlert>) -> Self {
        let baseline_mgr = Arc::new(baseline::BaselineManager::new());

        Self {
            policy: Arc::new(RwLock::new(policy)),
            baseline_mgr,
            alert_tx,
            shutdown: RwLock::new(Arc::new(AtomicBool::new(false))),
            watcher_handle: RwLock::new(None),
            state_file: None,
            coverage: Arc::new(RwLock::new(None)),
            startup_findings: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        }
    }

    /// Create a new FIM engine with default policy.
    pub fn with_defaults(alert_tx: mpsc::Sender<FimAlert>) -> Self {
        Self::new(FimPolicy::default(), alert_tx)
    }

    /// Keep the baseline in `path` between two runs, so the changes made
    /// while the agent is stopped are found at the next start.
    #[must_use]
    pub fn with_state_file(mut self, path: PathBuf) -> Self {
        self.state_file = Some(path);
        self
    }

    /// Keep the last contents of the small text files every account may
    /// read in `dir`, so a change says which lines were removed and added.
    /// To call before the engine is started.
    #[must_use]
    pub fn with_content_dir(mut self, dir: PathBuf) -> Self {
        self.baseline_mgr = Arc::new(
            baseline::BaselineManager::new().with_content_store(content::ContentStore::new(dir)),
        );
        self
    }

    fn scanner(&self) -> Scanner {
        Scanner {
            baseline: self.baseline_mgr.clone(),
            alert_tx: self.alert_tx.clone(),
            coverage: self.coverage.clone(),
            state_file: self.state_file.clone(),
        }
    }

    /// Bring back the baseline saved by the previous run, the first time the
    /// engine starts. Returns whether one was brought back.
    fn restore_saved_baseline(&self) -> bool {
        let Some(path) = &self.state_file else {
            return false;
        };
        if self
            .coverage
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .is_some()
        {
            return false; // restarted within the same run: memory is the reference
        }
        match store::load(path) {
            Ok(Some(snapshot)) => {
                info!(
                    "FIM baseline of {} ({} files) loaded",
                    snapshot.saved_at.to_rfc3339(),
                    snapshot.entries.len()
                );
                self.baseline_mgr.restore(snapshot.entries);
                *self.coverage.write().unwrap_or_else(|e| e.into_inner()) = Some(snapshot.coverage);
                true
            }
            Ok(None) => {
                info!("No saved FIM baseline: this run creates the first one");
                false
            }
            Err(reason) => {
                warn!(
                    "The saved FIM baseline {} {}. A new one is created: changes made while \
                     the agent was stopped cannot be found this time",
                    path.display(),
                    reason
                );
                false
            }
        }
    }

    /// Start the FIM engine: watch the paths, then compare them with the
    /// baseline (the saved one, or a first one created here).
    pub async fn start(&self) -> Result<(), FimError> {
        let policy = { self.policy.read().unwrap().clone() };

        // Against a baseline saved by the previous run, a difference was made
        // while the agent was stopped; against the one in memory (a restart
        // for a new policy), it is one the watcher did not report.
        let detection = if self.restore_saved_baseline() {
            FimDetection::Startup
        } else {
            FimDetection::Rescan
        };

        // Start the file system watcher
        let watcher_policy = policy.clone();
        let baseline = self.baseline_mgr.clone();
        let alert_tx = self.alert_tx.clone();
        // Every generation owns its cancellation flag. Restarting must never
        // clear the flag still used by the previous blocking watcher.
        let shutdown = Arc::new(AtomicBool::new(false));
        {
            let mut current = self.shutdown.write().unwrap();
            current.store(true, Ordering::Release);
            *current = shutdown.clone();
        }

        // The watcher starts before the scan, so nothing changes unseen
        // between the two; it holds its events until the scan is done.
        let ready = Arc::new(AtomicBool::new(false));
        let watcher_shutdown = shutdown.clone();
        let watcher_ready = ready.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) = watcher::watch_files(
                watcher_policy,
                baseline,
                alert_tx,
                watcher_shutdown,
                watcher_ready,
            )
            .await
            {
                warn!("FIM watcher stopped with error: {}", e);
            }
        });

        // Store the handle so we can detect if the watcher panics or stops
        if let Ok(mut handle_guard) = self.watcher_handle.write() {
            *handle_guard = Some(handle);
        }

        for path in &policy.watched_paths {
            if !path.exists() {
                tracing::debug!("FIM: watched path does not exist yet: {}", path.display());
            }
        }
        let scanner = self.scanner();
        let found = scanner.scan(&policy, detection).await;
        ready.store(true, Ordering::Release);
        if found > 0 {
            warn!(
                "FIM: {} change(s) made while the agent was not watching",
                found
            );
        }
        if detection == FimDetection::Startup {
            self.startup_findings.fetch_add(found, Ordering::AcqRel);
        }
        self.baseline_mgr.mark_dirty();
        scanner.save_if_changed();

        // Periodic work of this generation: save the baseline when it
        // changed, and scan again for what the system did not report.
        let rescan_every = Duration::from_secs(policy.rescan_interval_secs);
        tokio::spawn(async move {
            let mut last_scan = Instant::now();
            loop {
                tokio::time::sleep(SAVE_INTERVAL).await;
                if shutdown.load(Ordering::Acquire) {
                    break;
                }
                if !rescan_every.is_zero() && last_scan.elapsed() >= rescan_every {
                    last_scan = Instant::now();
                    scanner.scan(&policy, FimDetection::Rescan).await;
                    if shutdown.load(Ordering::Acquire) {
                        break;
                    }
                }
                scanner.save_if_changed();
            }
        });

        info!("FIM engine started");
        Ok(())
    }

    /// Scan the watched paths now and report what differs from the baseline.
    /// Returns the number of changes reported.
    pub async fn rescan(&self) -> usize {
        let policy = { self.policy.read().unwrap().clone() };
        let scanner = self.scanner();
        let found = scanner.scan(&policy, FimDetection::Rescan).await;
        scanner.save_if_changed();
        found
    }

    /// Changes found at start against the saved baseline, since the engine
    /// was created.
    pub fn startup_findings(&self) -> usize {
        self.startup_findings.load(Ordering::Acquire)
    }

    /// Stop the FIM engine.
    pub fn stop(&self) {
        self.shutdown.read().unwrap().store(true, Ordering::Release);
        self.scanner().save_if_changed();
        info!("FIM engine stopped");
    }

    /// Update the FIM configuration.
    ///
    /// This stops the current watcher and restarts it with the new policy,
    /// ensuring new watched paths are applied immediately.
    pub async fn update_config(&self, policy: FimPolicy) -> Result<(), FimError> {
        // Stop the current watcher
        self.stop();

        // Re-apply the agent's self-exclusion patterns. Policies arriving from
        // the platform replace the local one wholesale, and `ignore_patterns`
        // deserializes to an empty vec when the field is absent -- so without
        // this a server config could silently put the agent's own database and
        // config under watch.
        let policy = policy.with_self_exclusions();

        // Update the policy
        {
            if let Ok(mut current) = self.policy.write() {
                *current = policy;
            }
        }

        // Restart with the new config
        self.start().await?;

        info!("FIM configuration updated and watcher restarted");
        Ok(())
    }

    /// Get the current baseline file count.
    pub fn baseline_count(&self) -> usize {
        self.baseline_mgr.count()
    }

    /// Re-scan and update baseline for a specific path.
    ///
    /// Applies the active policy's ignore patterns. Passing an empty pattern
    /// list here would baseline the agent's own files even though the watcher
    /// excludes them, so any later change to them would alert.
    pub fn refresh_baseline(&self, path: &std::path::Path) -> Result<usize, FimError> {
        let patterns = self
            .policy
            .read()
            .map(|p| p.ignore_patterns.clone())
            .unwrap_or_default();
        self.baseline_mgr.create_baseline(path, &patterns)
    }

    /// Get the number of alerts pending in the channel.
    pub fn is_running(&self) -> bool {
        !self.shutdown.read().unwrap().load(Ordering::Acquire)
            && self
                .watcher_handle
                .read()
                .unwrap()
                .as_ref()
                .is_none_or(|h| !h.is_finished())
    }
}

impl Drop for FimEngine {
    fn drop(&mut self) {
        self.stop();
    }
}

/// FIM-specific errors.
#[derive(Debug, thiserror::Error)]
pub enum FimError {
    /// File system watcher error.
    #[error("Watcher error: {0}")]
    Watcher(String),

    /// Baseline error.
    #[error("Baseline error: {0}")]
    Baseline(String),

    /// I/O error.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Notify error.
    #[error("Notify error: {0}")]
    Notify(#[from] notify::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fim_engine_creation() {
        let (tx, _rx) = mpsc::channel(100);
        let engine = FimEngine::with_defaults(tx);
        assert_eq!(engine.baseline_count(), 0);
        assert!(engine.is_running());
    }

    #[tokio::test]
    async fn restart_keeps_previous_generation_cancelled() {
        let (tx, _rx) = mpsc::channel(16);
        let engine = FimEngine::new(
            FimPolicy {
                watched_paths: vec![],
                ..Default::default()
            },
            tx,
        );
        engine.start().await.unwrap();
        let previous = engine.shutdown.read().unwrap().clone();
        engine.stop();
        engine.start().await.unwrap();
        assert!(previous.load(std::sync::atomic::Ordering::Acquire));
        assert!(engine.is_running());
        let current = engine.shutdown.read().unwrap().clone();
        drop(engine);
        assert!(current.load(std::sync::atomic::Ordering::Acquire));
    }

    fn policy_for(roots: &[&std::path::Path]) -> FimPolicy {
        FimPolicy {
            watched_paths: roots.iter().map(|root| root.to_path_buf()).collect(),
            ignore_patterns: vec![],
            recursive: true,
            debounce_ms: 100,
            rescan_interval_secs: 0,
        }
    }

    /// Alerts received within `wait`, once nothing more arrives.
    async fn drain(rx: &mut mpsc::Receiver<FimAlert>, wait: Duration) -> Vec<FimAlert> {
        let mut alerts = Vec::new();
        while let Ok(Some(alert)) = tokio::time::timeout(wait, rx.recv()).await {
            alerts.push(alert);
        }
        alerts
    }

    fn named(alerts: &[FimAlert]) -> Vec<(String, agent_common::types::FimChangeType)> {
        let mut named: Vec<_> = alerts
            .iter()
            .map(|alert| {
                let name = alert
                    .path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                (name, alert.change)
            })
            .collect();
        named.sort_by(|a, b| a.0.cmp(&b.0));
        named
    }

    /// The reason the baseline is saved: stop the agent, change a watched
    /// file, start the agent. The baseline used to be rebuilt from the
    /// changed files and the change was never reported.
    #[tokio::test]
    async fn a_change_made_while_the_agent_is_stopped_is_found_at_the_next_start() {
        use agent_common::types::FimChangeType;
        let watched = tempfile::tempdir().unwrap();
        let state = tempfile::tempdir().unwrap();
        let state_file = state.path().join("fim").join("baseline.json");
        std::fs::write(watched.path().join("sudoers"), "root ALL=(ALL) ALL").unwrap();
        std::fs::write(watched.path().join("hosts"), "127.0.0.1 localhost").unwrap();
        std::fs::write(watched.path().join("motd"), "welcome").unwrap();

        // First run: the first baseline is taken, nothing is reported.
        let (tx, mut rx) = mpsc::channel(16);
        let first =
            FimEngine::new(policy_for(&[watched.path()]), tx).with_state_file(state_file.clone());
        first.start().await.unwrap();
        assert_eq!(first.baseline_count(), 3);
        assert_eq!(first.startup_findings(), 0);
        assert!(drain(&mut rx, Duration::from_millis(200)).await.is_empty());
        drop(first);

        // The agent is stopped.
        std::fs::write(
            watched.path().join("sudoers"),
            "root ALL=(ALL) ALL\nintruder ALL=(ALL) NOPASSWD: ALL",
        )
        .unwrap();
        std::fs::remove_file(watched.path().join("motd")).unwrap();
        std::fs::write(watched.path().join("backdoor.sh"), "#!/bin/sh").unwrap();

        // Next run.
        let (tx, mut rx) = mpsc::channel(16);
        let second = FimEngine::new(policy_for(&[watched.path()]), tx).with_state_file(state_file);
        second.start().await.unwrap();
        let alerts = drain(&mut rx, Duration::from_millis(1500)).await;
        assert_eq!(
            named(&alerts),
            vec![
                ("backdoor.sh".to_string(), FimChangeType::Created),
                ("motd".to_string(), FimChangeType::Deleted),
                ("sudoers".to_string(), FimChangeType::Modified),
            ]
        );
        assert!(
            alerts
                .iter()
                .all(|alert| alert.detection == FimDetection::Startup)
        );
        assert_eq!(second.startup_findings(), 3);
        assert_eq!(second.baseline_count(), 3);
    }

    #[tokio::test]
    async fn a_path_watched_for_the_first_time_is_adopted_without_alerts() {
        let already = tempfile::tempdir().unwrap();
        let added = tempfile::tempdir().unwrap();
        let state = tempfile::tempdir().unwrap();
        let state_file = state.path().join("baseline.json");
        std::fs::write(already.path().join("a.conf"), "a").unwrap();
        std::fs::write(added.path().join("b.conf"), "b").unwrap();

        let (tx, _rx) = mpsc::channel(16);
        let first =
            FimEngine::new(policy_for(&[already.path()]), tx).with_state_file(state_file.clone());
        first.start().await.unwrap();
        drop(first);

        let (tx, mut rx) = mpsc::channel(16);
        let second = FimEngine::new(policy_for(&[already.path(), added.path()]), tx)
            .with_state_file(state_file);
        second.start().await.unwrap();
        assert!(drain(&mut rx, Duration::from_millis(1500)).await.is_empty());
        assert_eq!(second.baseline_count(), 2);
    }

    #[tokio::test]
    async fn an_unusable_saved_baseline_is_replaced_and_invents_no_alert() {
        let watched = tempfile::tempdir().unwrap();
        let state = tempfile::tempdir().unwrap();
        let state_file = state.path().join("baseline.json");
        std::fs::write(watched.path().join("a.conf"), "a").unwrap();
        std::fs::write(&state_file, "{ not a baseline").unwrap();

        let (tx, mut rx) = mpsc::channel(16);
        let engine =
            FimEngine::new(policy_for(&[watched.path()]), tx).with_state_file(state_file.clone());
        engine.start().await.unwrap();
        assert!(drain(&mut rx, Duration::from_millis(1500)).await.is_empty());

        let saved = store::load(&state_file)
            .unwrap()
            .expect("a usable baseline");
        assert_eq!(saved.entries.len(), 1);
    }

    /// The watcher and a full scan read the same file: whichever comes first
    /// records the change, and the other finds nothing left to report.
    #[tokio::test]
    async fn a_change_seen_by_the_watcher_and_by_a_scan_is_reported_once() {
        let watched = tempfile::tempdir().unwrap();
        let path = watched.path().join("hosts");
        std::fs::write(&path, "127.0.0.1 localhost").unwrap();
        let (tx, mut rx) = mpsc::channel(16);
        let engine = FimEngine::new(policy_for(&[watched.path()]), tx);
        engine.start().await.unwrap();

        std::fs::write(&path, "127.0.0.1 localhost\n10.0.0.9 update.example").unwrap();
        engine.rescan().await;

        let alerts = drain(&mut rx, Duration::from_secs(3)).await;
        assert_eq!(alerts.len(), 1, "{alerts:?}");
        assert_eq!(
            alerts[0].change,
            agent_common::types::FimChangeType::Modified
        );
    }

    #[tokio::test]
    async fn test_fim_engine_stop() {
        let (tx, _rx) = mpsc::channel(100);
        let engine = FimEngine::with_defaults(tx);
        engine.stop();
        assert!(!engine.is_running());
    }
}
