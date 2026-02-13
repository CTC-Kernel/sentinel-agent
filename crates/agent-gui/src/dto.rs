//! Data transfer objects for the GUI layer.
//!
//! These types represent the data presented to the user in the desktop interface.
//! They are intentionally decoupled from internal domain types so the GUI can
//! evolve independently of the core runtime.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use agent_common::types::UpdateStatus;

// ============================================================================
// Type-safe enums (replacing String-based fields)
// ============================================================================

/// Severity level for compliance checks and vulnerabilities.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Critical => "critical",
            Severity::High => "high",
            Severity::Medium => "medium",
            Severity::Low => "low",
            Severity::Info => "info",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Severity::Critical => "CRITIQUE",
            Severity::High => "ÉLEVÉ",
            Severity::Medium => "MOYEN",
            Severity::Low => "FAIBLE",
            Severity::Info => "INFO",
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Log level for terminal and log filtering.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "TRACE",
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn from_index(idx: usize) -> Self {
        match idx {
            0 => LogLevel::Trace,
            1 => LogLevel::Debug,
            2 => LogLevel::Info,
            3 => LogLevel::Warn,
            4 => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }

    pub fn index(&self) -> usize {
        *self as usize
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Compliance grouping mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ComplianceGroupBy {
    #[default]
    None,
    Category,
    Framework,
}

impl ComplianceGroupBy {
    pub fn index(&self) -> u8 {
        match self {
            ComplianceGroupBy::None => 0,
            ComplianceGroupBy::Category => 1,
            ComplianceGroupBy::Framework => 2,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            1 => ComplianceGroupBy::Category,
            2 => ComplianceGroupBy::Framework,
            _ => ComplianceGroupBy::None,
        }
    }
}

/// Software page tab selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SoftwareTab {
    #[default]
    Packages,
    Applications,
}

impl SoftwareTab {
    pub fn index(&self) -> u8 {
        match self {
            SoftwareTab::Packages => 0,
            SoftwareTab::Applications => 1,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            1 => SoftwareTab::Applications,
            _ => SoftwareTab::Packages,
        }
    }
}

/// FIM change type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FimChangeType {
    Created,
    Modified,
    Deleted,
    PermissionChanged,
    Renamed,
}

impl FimChangeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FimChangeType::Created => "created",
            FimChangeType::Modified => "modified",
            FimChangeType::Deleted => "deleted",
            FimChangeType::PermissionChanged => "permission_changed",
            FimChangeType::Renamed => "renamed",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            FimChangeType::Created => "Créé",
            FimChangeType::Modified => "Modifié",
            FimChangeType::Deleted => "Supprimé",
            FimChangeType::PermissionChanged => "Permissions",
            FimChangeType::Renamed => "Renommé",
        }
    }
}

impl std::fmt::Display for FimChangeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// USB event type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UsbEventType {
    Connected,
    Disconnected,
}

impl UsbEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            UsbEventType::Connected => "connected",
            UsbEventType::Disconnected => "disconnected",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            UsbEventType::Connected => "Connecté",
            UsbEventType::Disconnected => "Déconnecté",
        }
    }
}

impl std::fmt::Display for UsbEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct GuiPolicySummary {
    pub total_policies: u32,
    pub passing: u32,
    pub failing: u32,
    pub errors: u32,
    pub pending: u32,
}

/// Overall agent status displayed in the GUI dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
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
    /// Agent is synchronizing data with the server.
    Syncing,
    /// Agent encountered an error.
    Error,
    /// Agent is starting up.
    #[default]
    Starting,
}

/// Summary view of the agent state for the GUI main panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
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
    /// Active compliance frameworks.
    pub active_frameworks: Option<Vec<String>>,
    /// Summary of compliance policy status.
    pub policy_summary: Option<GuiPolicySummary>,
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
    /// Severity level (typed).
    pub severity: Severity,
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
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
    /// Disk I/O throughput (kilobytes per second).
    pub disk_kbps: u32,
    /// Uptime in seconds.
    pub uptime_secs: u64,
    /// Disk usage percentage (0-100).
    pub disk_percent: f64,
    /// Network I/O throughput (bytes per second).
    pub network_io_bytes: u64,
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

impl GuiNotification {
    /// Create a new info notification.
    pub fn info(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            title: title.into(),
            body: body.into(),
            severity: "info".to_string(),
            timestamp: chrono::Utc::now(),
            read: false,
            action: None,
        }
    }

    /// Create a new error notification.
    pub fn error(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            title: title.into(),
            body: body.into(),
            severity: "error".to_string(),
            timestamp: chrono::Utc::now(),
            read: false,
            action: None,
        }
    }
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

/// A macOS native application entry for GUI display.
#[derive(Debug, Clone, PartialEq)]
pub struct GuiMacOsApp {
    /// Application name (from Info.plist or folder name).
    pub name: String,
    /// Bundle version string.
    pub version: String,
    /// Bundle identifier (e.g. com.apple.Safari).
    pub bundle_id: String,
    /// Publisher / developer.
    pub publisher: String,
    /// Path on disk.
    pub path: String,
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
    /// Severity level (typed).
    pub severity: Severity,
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

/// A network interface for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNetworkInterface {
    /// Interface name (e.g. "en0").
    pub name: String,
    /// MAC address.
    pub mac_address: Option<String>,
    /// IPv4 addresses assigned.
    pub ipv4_addresses: Vec<String>,
    /// Interface status (up/down).
    pub status: String,
    /// Interface type (ethernet, wifi, loopback, etc.).
    pub interface_type: String,
}

/// A network connection for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiNetworkConnection {
    /// Protocol (TCP/UDP).
    pub protocol: String,
    /// Local address.
    pub local_address: String,
    /// Local port.
    pub local_port: u16,
    /// Remote address.
    pub remote_address: Option<String>,
    /// Remote port.
    pub remote_port: Option<u16>,
    /// Connection state (ESTABLISHED, LISTEN, etc.).
    pub state: String,
    /// Process name.
    pub process_name: Option<String>,
}

/// A FIM alert for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiFimAlert {
    /// Unique identifier.
    pub id: String,
    /// File path that changed.
    pub path: String,
    /// Change type (typed).
    pub change_type: FimChangeType,
    /// Previous file hash.
    pub old_hash: Option<String>,
    /// New file hash.
    pub new_hash: Option<String>,
    /// When the change was detected.
    pub timestamp: DateTime<Utc>,
    /// Whether the alert has been acknowledged.
    pub acknowledged: bool,
}

/// A suspicious process event for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiSuspiciousProcess {
    /// Process name.
    pub process_name: String,
    /// Full command line.
    pub command_line: String,
    /// Why this process was flagged.
    pub reason: String,
    /// Confidence score (0-100).
    pub confidence: u8,
    /// When detected.
    pub detected_at: DateTime<Utc>,
}

/// A USB device event for GUI display.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct GuiUsbEvent {
    /// Device description.
    pub device_name: String,
    /// USB vendor ID.
    pub vendor_id: u16,
    /// USB product ID.
    pub product_id: u16,
    /// Event type (typed).
    pub event_type: UsbEventType,
    /// When the event occurred.
    pub timestamp: DateTime<Utc>,
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
            active_frameworks: None,
            policy_summary: None,
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
            severity: Severity::High,
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
