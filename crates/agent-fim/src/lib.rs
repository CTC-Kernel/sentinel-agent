//! File Integrity Monitoring (FIM) Engine for the Sentinel GRC Agent.
//!
//! This crate provides real-time file system monitoring using the `notify` crate
//! (inotify on Linux, FSEvents on macOS, ReadDirectoryChanges on Windows).
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
pub mod policy;
pub mod watcher;

use agent_common::types::{FimAlert, FimPolicy};
use std::sync::Arc;

/// Re-export FimPolicy as FimConfig for compatibility
pub type FimConfig = FimPolicy;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, warn};

/// FIM engine that coordinates watching, baselining, and alerting.
pub struct FimEngine {
    /// Active FIM policy.
    policy: Arc<RwLock<FimPolicy>>,

    /// Baseline manager for hash comparisons.
    baseline_mgr: Arc<baseline::BaselineManager>,

    /// Channel for sending FIM alerts to the runtime.
    alert_tx: mpsc::Sender<FimAlert>,

    /// Shutdown flag.
    shutdown: Arc<std::sync::atomic::AtomicBool>,
}

impl FimEngine {
    /// Create a new FIM engine with the given policy and alert channel.
    pub fn new(policy: FimPolicy, alert_tx: mpsc::Sender<FimAlert>) -> Self {
        let baseline_mgr = Arc::new(baseline::BaselineManager::new());

        Self {
            policy: Arc::new(RwLock::new(policy)),
            baseline_mgr,
            alert_tx,
            shutdown: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Create a new FIM engine with default policy.
    pub fn with_defaults(alert_tx: mpsc::Sender<FimAlert>) -> Self {
        Self::new(FimPolicy::default(), alert_tx)
    }

    /// Start the FIM engine: create baseline then begin watching.
    pub async fn start(&self) -> Result<(), FimError> {
        let policy = self.policy.read().await;

        // Create initial baseline for all watched paths
        info!(
            "Creating FIM baseline for {} watched paths",
            policy.watched_paths.len()
        );
        for path in &policy.watched_paths {
            if path.exists() {
                match self
                    .baseline_mgr
                    .create_baseline(path, &policy.ignore_patterns)
                {
                    Ok(count) => info!("Baselined {} files in {}", count, path.display()),
                    Err(e) => warn!("Failed to baseline {}: {}", path.display(), e),
                }
            } else {
                warn!("Watched path does not exist: {}", path.display());
            }
        }

        // Start the file system watcher
        let watcher_policy = policy.clone();
        let baseline = self.baseline_mgr.clone();
        let alert_tx = self.alert_tx.clone();
        let shutdown = self.shutdown.clone();

        drop(policy); // Release the read lock

        tokio::spawn(async move {
            if let Err(e) = watcher::watch_files(watcher_policy, baseline, alert_tx, shutdown).await
            {
                warn!("FIM watcher stopped with error: {}", e);
            }
        });

        info!("FIM engine started");
        Ok(())
    }

    /// Stop the FIM engine.
    pub fn stop(&self) {
        self.shutdown
            .store(true, std::sync::atomic::Ordering::Release);
        info!("FIM engine stopped");
    }

    /// Update the FIM configuration.
    pub async fn update_config(&self, policy: FimPolicy) -> Result<(), FimError> {
        let mut current = self.policy.write().await;
        *current = policy;
        info!("FIM configuration updated");
        Ok(())
    }

    /// Get the current baseline file count.
    pub fn baseline_count(&self) -> usize {
        self.baseline_mgr.count()
    }

    /// Re-scan and update baseline for a specific path.
    pub fn refresh_baseline(&self, path: &std::path::Path) -> Result<usize, FimError> {
        self.baseline_mgr.create_baseline(path, &[])
    }

    /// Get the number of alerts pending in the channel.
    pub fn is_running(&self) -> bool {
        !self.shutdown.load(std::sync::atomic::Ordering::Acquire)
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
    async fn test_fim_engine_stop() {
        let (tx, _rx) = mpsc::channel(100);
        let engine = FimEngine::with_defaults(tx);
        engine.stop();
        assert!(!engine.is_running());
    }
}
