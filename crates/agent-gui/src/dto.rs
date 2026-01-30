//! Data transfer objects for the GUI layer.
//!
//! These types represent the data presented to the user in the desktop interface.
//! They are intentionally decoupled from internal domain types so the GUI can
//! evolve independently of the core runtime.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Overall agent status displayed in the GUI dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GuiAgentStatus {
    /// Agent is running and connected to the server.
    Connected,
    /// Agent is running but not connected to the server.
    Disconnected,
    /// Agent is paused by the user.
    Paused,
    /// Agent is performing a scan.
    Scanning,
    /// Agent encountered an error.
    Error,
    /// Agent is starting up.
    Starting,
}

/// Summary view of the agent state for the GUI main panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct AgentSummary {
    /// Current agent status.
    pub status: GuiAgentStatus,
    /// Agent version string.
    pub version: String,
    /// Current hostname.
    pub hostname: String,
    /// Agent unique identifier (if enrolled).
    pub agent_id: Option<String>,
    /// Organization name (if enrolled).
    pub organization: Option<String>,
    /// Overall compliance score (0-100), if available.
    pub compliance_score: Option<f32>,
    /// Timestamp of last successful compliance check.
    pub last_check_at: Option<DateTime<Utc>>,
    /// Timestamp of last successful server sync.
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Number of items pending sync.
    pub pending_sync_count: u32,
    /// Uptime in seconds.
    pub uptime_secs: u64,
}

/// A single compliance check result for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiCheckResult {
    /// Check rule identifier.
    pub check_id: String,
    /// Human-readable check name.
    pub name: String,
    /// Check category.
    pub category: String,
    /// Result status.
    pub status: GuiCheckStatus,
    /// Severity level.
    pub severity: String,
    /// Compliance score (0-100).
    pub score: Option<i32>,
    /// Summary message.
    pub message: Option<String>,
    /// Detailed results as JSON.
    pub details: Option<serde_json::Value>,
    /// When the check was last executed.
    pub executed_at: Option<DateTime<Utc>>,
    /// Applicable frameworks (e.g., "NIS2", "DORA").
    pub frameworks: Vec<String>,
}

/// Check status for GUI display.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GuiCheckStatus {
    /// Check passed.
    Pass,
    /// Check failed.
    Fail,
    /// Check encountered an error.
    Error,
    /// Check was skipped.
    Skipped,
    /// Check is pending.
    Pending,
    /// Check is currently running.
    Running,
}

/// Resource usage snapshot for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiResourceUsage {
    /// CPU usage percentage.
    pub cpu_percent: f64,
    /// Memory usage percentage (0-100).
    pub memory_percent: f64,
    /// Memory currently used in megabytes.
    pub memory_used_mb: u64,
    /// Total memory available in megabytes.
    pub memory_total_mb: u64,
    /// Disk I/O operations per second.
    pub disk_iops: u32,
    /// Uptime in seconds.
    pub uptime_secs: u64,
    /// Disk usage percentage (0-100).
    pub disk_percent: f64,
}

/// Vulnerability scan summary for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub struct GuiVulnerabilitySummary {
    /// Number of critical vulnerabilities.
    pub critical: u32,
    /// Number of high-severity vulnerabilities.
    pub high: u32,
    /// Number of medium-severity vulnerabilities.
    pub medium: u32,
    /// Number of low-severity vulnerabilities.
    pub low: u32,
    /// Timestamp of last vulnerability scan.
    pub last_scan_at: Option<DateTime<Utc>>,
}

/// A log entry for GUI display (recent activity).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiLogEntry {
    /// Unique identifier.
    pub id: Uuid,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Log level (info, warn, error).
    pub level: String,
    /// Log message.
    pub message: String,
    /// Optional source module.
    pub source: Option<String>,
}

/// Notification displayed in the GUI notification panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNotification {
    /// Unique identifier.
    pub id: Uuid,
    /// Notification title.
    pub title: String,
    /// Notification body.
    pub body: String,
    /// Severity (info, warning, error, critical).
    pub severity: String,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Whether the notification has been read.
    pub read: bool,
    /// Optional action URL or command.
    pub action: Option<String>,
}

/// Policy summary for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiPolicySummary {
    /// Total number of active policies.
    pub total_policies: u32,
    /// Number of policies passing.
    pub passing: u32,
    /// Number of policies failing.
    pub failing: u32,
    /// Number of policies with errors.
    pub errors: u32,
    /// Number of policies not yet evaluated.
    pub pending: u32,
}

/// A software package entry for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiSoftwarePackage {
    /// Package name.
    pub name: String,
    /// Installed version.
    pub version: String,
    /// Publisher / vendor.
    pub publisher: Option<String>,
    /// Installation date.
    pub installed_at: Option<DateTime<Utc>>,
    /// Whether the package is up to date.
    pub up_to_date: bool,
    /// Latest available version (if known).
    pub latest_version: Option<String>,
}

/// A vulnerability finding for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiVulnerabilityFinding {
    /// CVE identifier.
    pub cve_id: String,
    /// Affected software name.
    pub affected_software: String,
    /// Affected version.
    pub affected_version: String,
    /// Severity level (critical, high, medium, low).
    pub severity: String,
    /// CVSS score (0.0 - 10.0).
    pub cvss_score: Option<f32>,
    /// Short description.
    pub description: String,
    /// Whether a fix is available.
    pub fix_available: bool,
    /// Timestamp of discovery.
    pub discovered_at: Option<DateTime<Utc>>,
}

/// Discovered network device for display in the Discovery and Cartography pages.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuiDiscoveredDevice {
    /// IP address.
    pub ip: String,
    /// MAC address.
    pub mac: Option<String>,
    /// Hostname (reverse DNS).
    pub hostname: Option<String>,
    /// Hardware vendor (OUI lookup).
    pub vendor: Option<String>,
    /// Device type classification.
    pub device_type: String,
    /// Open TCP ports.
    pub open_ports: Vec<u16>,
    /// When first seen.
    pub first_seen: chrono::DateTime<chrono::Utc>,
    /// When last seen.
    pub last_seen: chrono::DateTime<chrono::Utc>,
    /// Whether device is a gateway.
    pub is_gateway: bool,
    /// Subnet this device belongs to.
    pub subnet: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_summary_serialization() {
        let summary = AgentSummary {
            status: GuiAgentStatus::Connected,
            version: "1.0.0".to_string(),
            hostname: "test-host".to_string(),
            agent_id: Some("agent-123".to_string()),
            organization: Some("Test Org".to_string()),
            compliance_score: Some(85.5),
            last_check_at: None,
            last_sync_at: None,
            pending_sync_count: 3,
            uptime_secs: 3600,
        };

        let json = serde_json::to_string(&summary).unwrap();
        let parsed: AgentSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.hostname, "test-host");
        assert_eq!(parsed.status, GuiAgentStatus::Connected);
    }

    #[test]
    fn test_gui_check_result_serialization() {
        let result = GuiCheckResult {
            check_id: "disk_encryption".to_string(),
            name: "Disk Encryption".to_string(),
            category: "encryption".to_string(),
            status: GuiCheckStatus::Pass,
            severity: "high".to_string(),
            score: Some(100),
            message: Some("BitLocker enabled".to_string()),
            details: None,
            executed_at: Some(Utc::now()),
            frameworks: vec!["NIS2".to_string(), "DORA".to_string()],
        };

        let json = serde_json::to_string(&result).unwrap();
        let parsed: GuiCheckResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.check_id, "disk_encryption");
        assert_eq!(parsed.status, GuiCheckStatus::Pass);
    }

    #[test]
    fn test_gui_notification_serialization() {
        let notification = GuiNotification {
            id: Uuid::new_v4(),
            title: "Check Failed".to_string(),
            body: "Firewall check has failed".to_string(),
            severity: "warning".to_string(),
            timestamp: Utc::now(),
            read: false,
            action: None,
        };

        let json = serde_json::to_string(&notification).unwrap();
        assert!(json.contains("Check Failed"));
    }
}
