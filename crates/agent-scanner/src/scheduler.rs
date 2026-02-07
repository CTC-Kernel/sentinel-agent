//! Check scheduler for periodic execution.

use crate::check::CheckRegistry;
use crate::runner::{CheckExecutionResult, CheckRunner, RunnerConfig, ScanSummary};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{Instant, interval};
use tracing::{debug, info, warn};

/// Default scan interval (4 hours).
const DEFAULT_INTERVAL_SECS: u64 = 4 * 60 * 60;

/// Minimum scan interval (15 minutes).
const MIN_INTERVAL_SECS: u64 = 15 * 60;

/// Maximum scan interval (24 hours).
const MAX_INTERVAL_SECS: u64 = 24 * 60 * 60;

/// Event emitted by the scheduler.
#[derive(Debug, Clone)]
pub enum SchedulerEvent {
    /// A scan has started.
    ScanStarted {
        /// Timestamp when the scan started.
        started_at: DateTime<Utc>,
        /// Number of checks to run.
        check_count: usize,
    },
    /// A scan has completed.
    ScanCompleted {
        /// Scan summary.
        summary: ScanSummary,
        /// Timestamp when the scan completed.
        completed_at: DateTime<Utc>,
    },
    /// A scan was skipped (previous scan still running).
    ScanSkipped {
        /// Reason for skipping.
        reason: String,
    },
    /// Scheduler was stopped.
    Stopped,
}

/// Configuration for the scheduler.
#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    /// Interval between scans in seconds.
    pub interval_secs: u64,
    /// Whether to run a scan immediately on start.
    pub run_on_start: bool,
    /// Runner configuration.
    pub runner_config: RunnerConfig,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            interval_secs: DEFAULT_INTERVAL_SECS,
            run_on_start: true,
            runner_config: RunnerConfig::default(),
        }
    }
}

impl SchedulerConfig {
    /// Validate the configuration.
    pub fn validate(&self) -> Result<(), String> {
        if self.interval_secs < MIN_INTERVAL_SECS {
            return Err(format!(
                "Interval too short: {} < {} seconds",
                self.interval_secs, MIN_INTERVAL_SECS
            ));
        }
        if self.interval_secs > MAX_INTERVAL_SECS {
            return Err(format!(
                "Interval too long: {} > {} seconds",
                self.interval_secs, MAX_INTERVAL_SECS
            ));
        }
        Ok(())
    }
}

/// State of the scheduler.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SchedulerState {
    /// Scheduler is idle, waiting for next scan.
    Idle,
    /// A scan is currently running.
    Running,
    /// Scheduler is stopped.
    Stopped,
}

/// Scheduler status information.
#[derive(Debug, Clone)]
pub struct SchedulerStatus {
    /// Current state.
    pub state: SchedulerState,
    /// Last scan timestamp.
    pub last_scan_at: Option<DateTime<Utc>>,
    /// Last scan summary.
    pub last_summary: Option<ScanSummary>,
    /// Next scheduled scan.
    pub next_scan_at: Option<DateTime<Utc>>,
    /// Number of scans completed.
    pub scan_count: u64,
}

/// Check scheduler for periodic compliance scanning.
pub struct Scheduler {
    registry: Arc<CheckRegistry>,
    config: SchedulerConfig,
    running: Arc<AtomicBool>,
    status: Arc<RwLock<SchedulerStatus>>,
}

impl Scheduler {
    /// Create a new scheduler.
    pub fn new(registry: Arc<CheckRegistry>, config: SchedulerConfig) -> Self {
        Self {
            registry,
            config,
            running: Arc::new(AtomicBool::new(false)),
            status: Arc::new(RwLock::new(SchedulerStatus {
                state: SchedulerState::Stopped,
                last_scan_at: None,
                last_summary: None,
                next_scan_at: None,
                scan_count: 0,
            })),
        }
    }

    /// Create a scheduler with default configuration.
    pub fn with_defaults(registry: Arc<CheckRegistry>) -> Self {
        Self::new(registry, SchedulerConfig::default())
    }

    /// Start the scheduler.
    ///
    /// Returns a channel to receive scheduler events.
    pub async fn start(&self) -> mpsc::Receiver<SchedulerEvent> {
        let (tx, rx) = mpsc::channel(100);

        if self.running.swap(true, Ordering::SeqCst) {
            warn!("Scheduler already running");
            return rx;
        }

        info!(
            "Starting scheduler with interval {}s",
            self.config.interval_secs
        );

        // Update status
        {
            let mut status = self.status.write().await;
            status.state = SchedulerState::Idle;
        }

        // Clone for the spawned task
        let registry = self.registry.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        let status = self.status.clone();

        tokio::spawn(async move {
            Self::run_loop(registry, config, running, status, tx).await;
        });

        rx
    }

    /// Stop the scheduler.
    pub async fn stop(&self) {
        info!("Stopping scheduler");
        self.running.store(false, Ordering::SeqCst);

        let mut status = self.status.write().await;
        status.state = SchedulerState::Stopped;
        status.next_scan_at = None;
    }

    /// Get the current scheduler status.
    pub async fn status(&self) -> SchedulerStatus {
        self.status.read().await.clone()
    }

    /// Check if the scheduler is running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Trigger an immediate scan.
    pub async fn trigger_scan(&self) -> Vec<CheckExecutionResult> {
        let runner = CheckRunner::new(self.registry.clone(), self.config.runner_config.clone());
        runner.run_all().await
    }

    /// Update the scan interval.
    pub async fn set_interval(&self, interval_secs: u64) -> Result<(), String> {
        if !(MIN_INTERVAL_SECS..=MAX_INTERVAL_SECS).contains(&interval_secs) {
            return Err(format!(
                "Invalid interval: must be between {} and {} seconds",
                MIN_INTERVAL_SECS, MAX_INTERVAL_SECS
            ));
        }

        info!("Updating scan interval to {}s", interval_secs);
        // Note: In a real implementation, we'd need to restart the scheduler
        // or use a more sophisticated approach to update the interval
        Ok(())
    }

    /// Run the scheduler loop.
    async fn run_loop(
        registry: Arc<CheckRegistry>,
        config: SchedulerConfig,
        running: Arc<AtomicBool>,
        status: Arc<RwLock<SchedulerStatus>>,
        tx: mpsc::Sender<SchedulerEvent>,
    ) {
        let mut ticker = interval(Duration::from_secs(config.interval_secs));

        // Run immediately if configured
        if config.run_on_start {
            Self::run_scan(&registry, &config, &status, &tx).await;
        }

        while running.load(Ordering::SeqCst) {
            // Update next scan time
            {
                let mut s = status.write().await;
                s.next_scan_at =
                    Some(Utc::now() + chrono::Duration::seconds(config.interval_secs as i64));
            }

            ticker.tick().await;

            if !running.load(Ordering::SeqCst) {
                break;
            }

            Self::run_scan(&registry, &config, &status, &tx).await;
        }

        // Send stopped event
        if let Err(e) = tx.send(SchedulerEvent::Stopped).await {
            debug!("Failed to send scheduler stopped event (receiver dropped): {}", e);
        }
    }

    /// Run a single scan.
    async fn run_scan(
        registry: &Arc<CheckRegistry>,
        config: &SchedulerConfig,
        status: &Arc<RwLock<SchedulerStatus>>,
        tx: &mpsc::Sender<SchedulerEvent>,
    ) {
        // Check if already running
        {
            let s = status.read().await;
            if s.state == SchedulerState::Running {
                if let Err(e) = tx
                    .send(SchedulerEvent::ScanSkipped {
                        reason: "Previous scan still running".to_string(),
                    })
                    .await
                {
                    debug!("Failed to send scan skipped event: {}", e);
                }
                return;
            }
        }

        // Update status to running
        let check_count = registry.enabled_checks().len();
        {
            let mut s = status.write().await;
            s.state = SchedulerState::Running;
        }

        let started_at = Utc::now();
        if let Err(e) = tx
            .send(SchedulerEvent::ScanStarted {
                started_at,
                check_count,
            })
            .await
        {
            debug!("Failed to send scan started event: {}", e);
        }

        // Run the scan
        let start = Instant::now();
        let runner = CheckRunner::new(registry.clone(), config.runner_config.clone());
        let results = runner.run_all().await;
        let duration_ms = start.elapsed().as_millis() as u64;

        // Create summary
        let summary = ScanSummary::from_results(&results, duration_ms);
        let completed_at = Utc::now();

        // Update status
        {
            let mut s = status.write().await;
            s.state = SchedulerState::Idle;
            s.last_scan_at = Some(completed_at);
            s.last_summary = Some(summary.clone());
            s.scan_count += 1;
        }

        info!(
            "Scan completed: {} checks, score: {:.1}%, duration: {}ms",
            summary.total_checks, summary.score, summary.duration_ms
        );

        if let Err(e) = tx
            .send(SchedulerEvent::ScanCompleted {
                summary,
                completed_at,
            })
            .await
        {
            debug!("Failed to send scan completed event: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
    use agent_common::types::CheckCategory;
    use async_trait::async_trait;
    struct QuickCheck {
        definition: agent_common::types::CheckDefinition,
    }

    #[async_trait]
    impl Check for QuickCheck {
        fn definition(&self) -> &agent_common::types::CheckDefinition {
            &self.definition
        }

        async fn execute(&self) -> crate::error::ScannerResult<CheckOutput> {
            Ok(CheckOutput::pass("Quick check", serde_json::json!({})))
        }
    }

    fn create_test_registry() -> CheckRegistry {
        let mut registry = CheckRegistry::new();
        registry.register(Arc::new(QuickCheck {
            definition: CheckDefinitionBuilder::new("quick1")
                .name("Quick Check 1")
                .category(CheckCategory::General)
                .build(),
        }));
        registry.register(Arc::new(QuickCheck {
            definition: CheckDefinitionBuilder::new("quick2")
                .name("Quick Check 2")
                .category(CheckCategory::General)
                .build(),
        }));
        registry
    }

    #[test]
    fn test_scheduler_config_default() {
        let config = SchedulerConfig::default();
        assert_eq!(config.interval_secs, DEFAULT_INTERVAL_SECS);
        assert!(config.run_on_start);
    }

    #[test]
    #[allow(clippy::field_reassign_with_default)]
    fn test_scheduler_config_validation() {
        let mut config = SchedulerConfig::default();

        config.interval_secs = MIN_INTERVAL_SECS;
        assert!(config.validate().is_ok());

        config.interval_secs = MIN_INTERVAL_SECS - 1;
        assert!(config.validate().is_err());

        config.interval_secs = MAX_INTERVAL_SECS + 1;
        assert!(config.validate().is_err());
    }

    #[tokio::test]
    async fn test_scheduler_creation() {
        let registry = Arc::new(create_test_registry());
        let scheduler = Scheduler::with_defaults(registry);

        let status = scheduler.status().await;
        assert_eq!(status.state, SchedulerState::Stopped);
        assert!(status.last_scan_at.is_none());
        assert_eq!(status.scan_count, 0);
    }

    #[tokio::test]
    async fn test_trigger_scan() {
        let registry = Arc::new(create_test_registry());
        let config = SchedulerConfig {
            interval_secs: MIN_INTERVAL_SECS,
            run_on_start: false,
            runner_config: RunnerConfig {
                generate_proofs: false,
                ..Default::default()
            },
        };
        let scheduler = Scheduler::new(registry, config);

        let results = scheduler.trigger_scan().await;
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_scheduler_start_stop() {
        let registry = Arc::new(create_test_registry());
        let config = SchedulerConfig {
            interval_secs: MIN_INTERVAL_SECS,
            run_on_start: false,
            runner_config: RunnerConfig::default(),
        };
        let scheduler = Scheduler::new(registry, config);

        assert!(!scheduler.is_running());

        let _rx = scheduler.start().await;
        assert!(scheduler.is_running());

        // Give it a moment to update state
        tokio::time::sleep(Duration::from_millis(50)).await;

        let status = scheduler.status().await;
        assert_eq!(status.state, SchedulerState::Idle);

        scheduler.stop().await;
        assert!(!scheduler.is_running());
    }

    #[tokio::test]
    async fn test_set_interval() {
        let registry = Arc::new(create_test_registry());
        let scheduler = Scheduler::with_defaults(registry);

        assert!(scheduler.set_interval(MIN_INTERVAL_SECS).await.is_ok());
        assert!(scheduler.set_interval(MAX_INTERVAL_SECS).await.is_ok());
        assert!(scheduler.set_interval(MIN_INTERVAL_SECS - 1).await.is_err());
        assert!(scheduler.set_interval(MAX_INTERVAL_SECS + 1).await.is_err());
    }

    #[test]
    fn test_scheduler_state() {
        assert_eq!(SchedulerState::Idle, SchedulerState::Idle);
        assert_ne!(SchedulerState::Idle, SchedulerState::Running);
    }
}
