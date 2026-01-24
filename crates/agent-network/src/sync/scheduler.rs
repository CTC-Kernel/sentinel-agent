//! Smart scheduler for network data collection.
//!
//! Features:
//! - Differentiated intervals for different data types
//! - Jitter to prevent thundering herd
//! - Deployment group staggering

use crate::types::NetworkSchedulerConfig;
use rand::Rng;
use std::time::Duration;
use tracing::debug;

/// Type of scheduled task.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskType {
    /// Static info collection (interfaces, routes, DNS)
    StaticInfo,
    /// Active connections scan
    Connections,
    /// Security detection scan
    Security,
}

/// A scheduled task with timing information.
#[derive(Debug, Clone)]
pub struct ScheduledTask {
    /// Type of task
    pub task_type: TaskType,
    /// Base interval without jitter
    pub base_interval: Duration,
    /// Actual interval with jitter applied
    pub actual_interval: Duration,
    /// Time until next execution
    pub next_in: Duration,
}

/// Network data collection scheduler with anti-thundering-herd features.
pub struct NetworkScheduler {
    config: NetworkSchedulerConfig,
    /// Last jittered intervals for each task type
    last_static_interval: Option<Duration>,
    last_connection_interval: Option<Duration>,
    last_security_interval: Option<Duration>,
}

impl NetworkScheduler {
    /// Create a new scheduler with default config.
    pub fn new() -> Self {
        Self::with_config(NetworkSchedulerConfig::default())
    }

    /// Create a scheduler with custom config.
    pub fn with_config(config: NetworkSchedulerConfig) -> Self {
        debug!(
            "NetworkScheduler initialized: static={}s, connections={}s, security={}s, jitter={}%, group={}",
            config.static_info_interval_secs,
            config.connection_scan_interval_secs,
            config.security_scan_interval_secs,
            config.jitter_percent,
            config.deployment_group
        );
        Self {
            config,
            last_static_interval: None,
            last_connection_interval: None,
            last_security_interval: None,
        }
    }

    /// Get the next interval for static info collection.
    pub fn next_static_info_interval(&mut self) -> Duration {
        let interval = self.calculate_interval(
            self.config.static_info_interval_secs,
            self.config.jitter_percent,
            self.config.deployment_group,
        );
        self.last_static_interval = Some(interval);
        interval
    }

    /// Get the next interval for connection scanning.
    pub fn next_connection_interval(&mut self) -> Duration {
        let interval = self.calculate_interval(
            self.config.connection_scan_interval_secs,
            self.config.jitter_percent,
            self.config.deployment_group,
        );
        self.last_connection_interval = Some(interval);
        interval
    }

    /// Get the next interval for security scanning.
    pub fn next_security_interval(&mut self) -> Duration {
        // Security scans use lower jitter for more consistent detection
        let security_jitter = (self.config.jitter_percent / 4).max(5);
        let interval = self.calculate_interval(
            self.config.security_scan_interval_secs,
            security_jitter,
            self.config.deployment_group,
        );
        self.last_security_interval = Some(interval);
        interval
    }

    /// Calculate interval with jitter and group offset.
    ///
    /// Formula: base + group_offset + random_jitter
    /// - group_offset: Distributes agents across time based on deployment group (0-9)
    /// - random_jitter: Random variation within ±jitter_percent
    fn calculate_interval(&self, base_secs: u64, jitter_percent: u8, group: u8) -> Duration {
        let mut rng = rand::rng();

        // Group offset: spread agents evenly across the interval
        // Group 0 starts at base, group 9 starts at base + 90% of interval
        let group_offset_secs = (base_secs * group as u64) / 10;

        // Random jitter: ±jitter_percent of base interval
        let jitter_range = (base_secs as f64 * jitter_percent as f64 / 100.0) as i64;
        let jitter: i64 = if jitter_range > 0 {
            rng.random_range(-jitter_range..=jitter_range)
        } else {
            0
        };

        // Calculate final interval, ensuring it's positive
        let final_secs = (base_secs as i64 + group_offset_secs as i64 + jitter).max(1) as u64;

        debug!(
            "Calculated interval: base={}s, group_offset={}s, jitter={}s, final={}s",
            base_secs, group_offset_secs, jitter, final_secs
        );

        Duration::from_secs(final_secs)
    }

    /// Get all scheduled tasks with their intervals.
    pub fn get_scheduled_tasks(&mut self) -> Vec<ScheduledTask> {
        vec![
            ScheduledTask {
                task_type: TaskType::StaticInfo,
                base_interval: Duration::from_secs(self.config.static_info_interval_secs),
                actual_interval: self.next_static_info_interval(),
                next_in: self.last_static_interval.unwrap_or_default(),
            },
            ScheduledTask {
                task_type: TaskType::Connections,
                base_interval: Duration::from_secs(self.config.connection_scan_interval_secs),
                actual_interval: self.next_connection_interval(),
                next_in: self.last_connection_interval.unwrap_or_default(),
            },
            ScheduledTask {
                task_type: TaskType::Security,
                base_interval: Duration::from_secs(self.config.security_scan_interval_secs),
                actual_interval: self.next_security_interval(),
                next_in: self.last_security_interval.unwrap_or_default(),
            },
        ]
    }

    /// Update config (e.g., from server response).
    pub fn update_config(&mut self, config: NetworkSchedulerConfig) {
        debug!(
            "Updating scheduler config: static={}s, connections={}s, security={}s",
            config.static_info_interval_secs,
            config.connection_scan_interval_secs,
            config.security_scan_interval_secs
        );
        self.config = config;
    }

    /// Get current config.
    pub fn config(&self) -> &NetworkSchedulerConfig {
        &self.config
    }

    /// Set deployment group (0-9).
    pub fn set_deployment_group(&mut self, group: u8) {
        self.config.deployment_group = group.min(9);
        debug!("Set deployment group to {}", self.config.deployment_group);
    }

    /// Calculate initial delay for agent startup.
    /// Distributes initial syncs across the first interval.
    pub fn initial_delay(&self, task_type: TaskType) -> Duration {
        let mut rng = rand::rng();

        let base_secs = match task_type {
            TaskType::StaticInfo => self.config.static_info_interval_secs,
            TaskType::Connections => self.config.connection_scan_interval_secs,
            TaskType::Security => self.config.security_scan_interval_secs,
        };

        // Initial delay is random within first quarter of interval
        // plus group offset
        let max_initial = base_secs / 4;
        let group_offset = (base_secs * self.config.deployment_group as u64) / 10;
        let random_delay: u64 = rng.random_range(0..=max_initial.max(1));

        Duration::from_secs(random_delay + group_offset)
    }
}

impl Default for NetworkScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_intervals() {
        let config = NetworkSchedulerConfig::default();
        assert_eq!(config.static_info_interval_secs, 15 * 60); // 15 minutes
        assert_eq!(config.connection_scan_interval_secs, 5 * 60); // 5 minutes
        assert_eq!(config.security_scan_interval_secs, 60); // 1 minute
    }

    #[test]
    fn test_jitter_applied() {
        let mut scheduler = NetworkScheduler::new();

        // Get multiple intervals and verify they're not all identical
        let intervals: Vec<_> = (0..10)
            .map(|_| scheduler.next_static_info_interval())
            .collect();

        // With 20% jitter, we should see some variation
        let first = intervals[0];
        let has_variation = intervals.iter().any(|&i| i != first);
        assert!(has_variation, "Expected jitter to cause variation");
    }

    #[test]
    fn test_group_offset() {
        let config = NetworkSchedulerConfig {
            static_info_interval_secs: 100,
            jitter_percent: 0,   // No jitter for predictable test
            deployment_group: 5, // Group 5 = 50% offset
            ..Default::default()
        };
        let mut scheduler = NetworkScheduler::with_config(config);

        let interval = scheduler.next_static_info_interval();

        // Base 100s + group offset 50s = 150s
        assert_eq!(interval.as_secs(), 150);
    }

    #[test]
    fn test_scheduled_tasks() {
        let mut scheduler = NetworkScheduler::new();
        let tasks = scheduler.get_scheduled_tasks();

        assert_eq!(tasks.len(), 3);
        assert!(tasks.iter().any(|t| t.task_type == TaskType::StaticInfo));
        assert!(tasks.iter().any(|t| t.task_type == TaskType::Connections));
        assert!(tasks.iter().any(|t| t.task_type == TaskType::Security));
    }
}
