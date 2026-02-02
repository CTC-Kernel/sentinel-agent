//! FIM alert processing and aggregation.

use agent_common::types::{FimAlert, FimChangeType};
use chrono::{DateTime, Duration, Utc};
use std::collections::VecDeque;

/// Maximum number of alerts to keep in memory.
const MAX_ALERTS: usize = 1000;

/// Manages FIM alert history and aggregation.
pub struct AlertManager {
    /// Recent alerts (bounded circular buffer).
    alerts: VecDeque<FimAlert>,

    /// Maximum number of alerts to keep.
    max_alerts: usize,
}

impl AlertManager {
    /// Create a new alert manager.
    pub fn new() -> Self {
        Self {
            alerts: VecDeque::with_capacity(MAX_ALERTS),
            max_alerts: MAX_ALERTS,
        }
    }

    /// Add an alert.
    pub fn push(&mut self, alert: FimAlert) {
        if self.alerts.len() >= self.max_alerts {
            self.alerts.pop_front();
        }
        self.alerts.push_back(alert);
    }

    /// Get all alerts.
    pub fn all(&self) -> &VecDeque<FimAlert> {
        &self.alerts
    }

    /// Get alerts from the last N hours.
    pub fn recent(&self, hours: i64) -> Vec<&FimAlert> {
        let cutoff = Utc::now() - Duration::hours(hours);
        self.alerts
            .iter()
            .filter(|a| a.timestamp > cutoff)
            .collect()
    }

    /// Get unacknowledged alerts.
    pub fn unacknowledged(&self) -> Vec<&FimAlert> {
        self.alerts.iter().filter(|a| !a.acknowledged).collect()
    }

    /// Acknowledge an alert by timestamp.
    pub fn acknowledge(&mut self, timestamp: DateTime<Utc>) -> bool {
        for alert in &mut self.alerts {
            if alert.timestamp == timestamp {
                alert.acknowledged = true;
                return true;
            }
        }
        false
    }

    /// Acknowledge all alerts.
    pub fn acknowledge_all(&mut self) {
        for alert in &mut self.alerts {
            alert.acknowledged = true;
        }
    }

    /// Get alert counts by change type.
    pub fn counts_by_type(&self) -> AlertCounts {
        let mut counts = AlertCounts::default();
        for alert in &self.alerts {
            match alert.change {
                FimChangeType::Created => counts.created += 1,
                FimChangeType::Modified => counts.modified += 1,
                FimChangeType::Deleted => counts.deleted += 1,
                FimChangeType::PermissionChanged => counts.permission_changed += 1,
                FimChangeType::Renamed => counts.renamed += 1,
            }
        }
        counts
    }

    /// Total number of alerts.
    pub fn count(&self) -> usize {
        self.alerts.len()
    }

    /// Clear all alerts.
    pub fn clear(&mut self) {
        self.alerts.clear();
    }
}

impl Default for AlertManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Aggregated alert counts by type.
#[derive(Debug, Default, Clone)]
pub struct AlertCounts {
    pub created: usize,
    pub modified: usize,
    pub deleted: usize,
    pub permission_changed: usize,
    pub renamed: usize,
}

impl AlertCounts {
    /// Total number of alerts.
    pub fn total(&self) -> usize {
        self.created + self.modified + self.deleted + self.permission_changed + self.renamed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn make_alert(change: FimChangeType) -> FimAlert {
        FimAlert {
            path: PathBuf::from("/test/file"),
            change,
            old_hash: None,
            new_hash: None,
            new_size: None,
            timestamp: Utc::now(),
            acknowledged: false,
        }
    }

    #[test]
    fn test_alert_manager_push() {
        let mut mgr = AlertManager::new();
        mgr.push(make_alert(FimChangeType::Created));
        mgr.push(make_alert(FimChangeType::Modified));
        assert_eq!(mgr.count(), 2);
    }

    #[test]
    fn test_alert_manager_counts() {
        let mut mgr = AlertManager::new();
        mgr.push(make_alert(FimChangeType::Created));
        mgr.push(make_alert(FimChangeType::Modified));
        mgr.push(make_alert(FimChangeType::Modified));
        mgr.push(make_alert(FimChangeType::Deleted));

        let counts = mgr.counts_by_type();
        assert_eq!(counts.created, 1);
        assert_eq!(counts.modified, 2);
        assert_eq!(counts.deleted, 1);
        assert_eq!(counts.total(), 4);
    }

    #[test]
    fn test_alert_manager_acknowledge() {
        let mut mgr = AlertManager::new();
        let alert = make_alert(FimChangeType::Created);
        let ts = alert.timestamp;
        mgr.push(alert);

        assert_eq!(mgr.unacknowledged().len(), 1);
        assert!(mgr.acknowledge(ts));
        assert_eq!(mgr.unacknowledged().len(), 0);
    }

    #[test]
    fn test_alert_manager_bounded() {
        let mut mgr = AlertManager {
            alerts: VecDeque::new(),
            max_alerts: 3,
        };
        mgr.push(make_alert(FimChangeType::Created));
        mgr.push(make_alert(FimChangeType::Modified));
        mgr.push(make_alert(FimChangeType::Deleted));
        mgr.push(make_alert(FimChangeType::Renamed));

        assert_eq!(mgr.count(), 3); // Oldest was evicted
    }
}
