//! Network information collection and malicious activity detection.
//!
//! This crate provides:
//! - Network interface collection (IP, MAC, status)
//! - Active connection monitoring (ports, processes)
//! - Route and DNS configuration collection
//! - Malicious activity detection (C2, mining, exfiltration)
//! - Smart scheduling with jitter for scalable deployment
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                   NetworkManager                         │
//! │  (Main entry point - orchestrates collection & sync)    │
//! └─────────────────────────┬───────────────────────────────┘
//!                           │
//!          ┌────────────────┼────────────────┐
//!          ▼                ▼                ▼
//! ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
//! │   Collectors   │ │   Detection    │ │     Sync       │
//! │  - interfaces  │ │  - c2          │ │  - delta       │
//! │  - connections │ │  - mining      │ │  - scheduler   │
//! │  - routes      │ │  - exfil       │ │                │
//! │  - dns         │ │  - ports       │ │                │
//! └────────────────┘ └────────────────┘ └────────────────┘
//! ```
//!
//! # Usage
//!
//! ```no_run
//! use agent_network::{NetworkManager, NetworkSchedulerConfig};
//!
//! #[tokio::main]
//! async fn main() {
//!     // Create manager with default config
//!     let mut manager = NetworkManager::new();
//!
//!     // Collect network snapshot
//!     let snapshot = manager.collect_snapshot().await.unwrap();
//!     println!("Found {} interfaces", snapshot.interfaces.len());
//!
//!     // Run security detection
//!     let alerts = manager.detect_threats(&snapshot.connections).await.unwrap();
//!     for alert in alerts {
//!         println!("Alert: {} (severity: {:?})", alert.title, alert.severity);
//!     }
//! }
//! ```
//!
//! # Scheduling
//!
//! The scheduler uses jitter and deployment groups to prevent thundering herd:
//!
//! | Task Type | Default Interval | Jitter |
//! |-----------|-----------------|--------|
//! | Static Info | 15 minutes | ±20% |
//! | Connections | 5 minutes | ±20% |
//! | Security | 1 minute | ±5% |

pub mod collector;
pub mod detection;
pub mod error;
pub mod sync;
pub mod types;

pub use collector::NetworkCollector;
pub use detection::SecurityDetector;
pub use error::{NetworkError, NetworkResult};
pub use sync::{NetworkScheduler, ScheduledTask, SyncManager, TaskType};
pub use types::*;

use tracing::{debug, info};

/// Main network manager that coordinates collection, detection, and sync.
pub struct NetworkManager {
    collector: NetworkCollector,
    detector: SecurityDetector,
    sync_manager: SyncManager,
    scheduler: NetworkScheduler,
}

impl NetworkManager {
    /// Create a new network manager with default configuration.
    pub fn new() -> Self {
        info!("Initializing NetworkManager");
        Self {
            collector: NetworkCollector::new(),
            detector: SecurityDetector::new(),
            sync_manager: SyncManager::new(),
            scheduler: NetworkScheduler::new(),
        }
    }

    /// Create a network manager with custom scheduler config.
    pub fn with_scheduler_config(config: NetworkSchedulerConfig) -> Self {
        info!("Initializing NetworkManager with custom scheduler config");
        Self {
            collector: NetworkCollector::new(),
            detector: SecurityDetector::new(),
            sync_manager: SyncManager::new(),
            scheduler: NetworkScheduler::with_config(config),
        }
    }

    /// Collect a full network snapshot.
    pub async fn collect_snapshot(&self) -> NetworkResult<NetworkSnapshot> {
        debug!("Collecting network snapshot");
        self.collector.collect_snapshot().await
    }

    /// Collect only static info (interfaces, routes, DNS).
    pub async fn collect_static_info(
        &self,
    ) -> NetworkResult<(Vec<NetworkInterface>, Vec<RouteEntry>, DnsConfiguration)> {
        self.collector.collect_static_info().await
    }

    /// Collect only active connections.
    pub async fn collect_connections(&self) -> NetworkResult<Vec<NetworkConnection>> {
        self.collector.collect_connections().await
    }

    /// Run security detection on connections.
    pub async fn detect_threats(
        &self,
        connections: &[NetworkConnection],
    ) -> NetworkResult<Vec<NetworkSecurityAlert>> {
        self.detector.analyze(connections).await
    }

    /// Process a snapshot and return delta if there are changes.
    pub fn process_for_sync(
        &mut self,
        snapshot: NetworkSnapshot,
    ) -> NetworkResult<Option<NetworkDelta>> {
        self.sync_manager.process_snapshot(snapshot)
    }

    /// Force a full sync (ignore delta).
    pub fn force_full_sync(&mut self, snapshot: &NetworkSnapshot) -> NetworkDelta {
        self.sync_manager.force_full_sync(snapshot)
    }

    /// Get the next interval for static info collection.
    pub fn next_static_interval(&mut self) -> std::time::Duration {
        self.scheduler.next_static_info_interval()
    }

    /// Get the next interval for connection collection.
    pub fn next_connection_interval(&mut self) -> std::time::Duration {
        self.scheduler.next_connection_interval()
    }

    /// Get the next interval for security scanning.
    pub fn next_security_interval(&mut self) -> std::time::Duration {
        self.scheduler.next_security_interval()
    }

    /// Get initial delay for a task type (for startup staggering).
    pub fn initial_delay(&self, task_type: TaskType) -> std::time::Duration {
        self.scheduler.initial_delay(task_type)
    }

    /// Update threat intelligence data.
    pub fn update_threat_intel(&mut self, intel: ThreatIntelligence) {
        self.detector.update_threat_intel(intel);
    }

    /// Update scheduler configuration.
    pub fn update_scheduler_config(&mut self, config: NetworkSchedulerConfig) {
        self.scheduler.update_config(config);
    }

    /// Set deployment group for scheduling.
    pub fn set_deployment_group(&mut self, group: u8) {
        self.scheduler.set_deployment_group(group);
    }

    /// Get scheduler reference.
    pub fn scheduler(&self) -> &NetworkScheduler {
        &self.scheduler
    }

    /// Get mutable scheduler reference.
    pub fn scheduler_mut(&mut self) -> &mut NetworkScheduler {
        &mut self.scheduler
    }
}

impl Default for NetworkManager {
    fn default() -> Self {
        Self::new()
    }
}
