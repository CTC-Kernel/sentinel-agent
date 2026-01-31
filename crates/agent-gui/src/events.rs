//! Event types for communication between the agent runtime and the GUI layer.
//!
//! The runtime emits [`AgentEvent`] variants that the GUI subscribes to via a channel.
//! The GUI sends [`GuiCommand`] variants back to the runtime.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::dto::{
    AgentSummary, GuiCheckResult, GuiNetworkConnection, GuiNetworkInterface, GuiNotification,
    GuiResourceUsage, GuiSoftwarePackage, GuiVulnerabilityFinding, GuiVulnerabilitySummary,
};

/// A single terminal log entry captured from the tracing subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalLogEntry {
    /// Timestamp of the log event.
    pub timestamp: DateTime<Utc>,
    /// Log level (TRACE, DEBUG, INFO, WARN, ERROR).
    pub level: String,
    /// Module / target that emitted the log.
    pub target: String,
    /// Human-readable message.
    pub message: String,
}

/// Events emitted by the agent runtime for the GUI to consume.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    /// Agent status has changed.
    StatusChanged {
        /// Updated agent summary.
        summary: AgentSummary,
    },
    /// A compliance check completed.
    CheckCompleted {
        /// The check result.
        result: GuiCheckResult,
    },
    /// Resource usage updated.
    ResourceUpdate {
        /// Current resource usage.
        usage: GuiResourceUsage,
    },
    /// A new notification was generated.
    Notification {
        /// The notification.
        notification: GuiNotification,
    },
    /// Sync status changed (started, completed, failed).
    SyncStatus {
        /// Whether sync is in progress.
        syncing: bool,
        /// Number of pending items.
        pending_count: u32,
        /// Last sync timestamp.
        last_sync_at: Option<DateTime<Utc>>,
        /// Error message if sync failed.
        error: Option<String>,
    },
    /// Network data updated.
    NetworkUpdate {
        /// Number of network interfaces.
        interfaces_count: u32,
        /// Number of active connections.
        connections_count: u32,
        /// Number of security alerts.
        alerts_count: u32,
        /// Primary IP address.
        primary_ip: Option<String>,
        /// Primary MAC address.
        primary_mac: Option<String>,
    },
    /// Detailed network data (interfaces + connections) for the Network page.
    NetworkDetailUpdate {
        /// Network interfaces.
        interfaces: Vec<GuiNetworkInterface>,
        /// Active network connections.
        connections: Vec<GuiNetworkConnection>,
    },
    /// Enrollment completed (success or failure).
    EnrollmentResult {
        /// Whether enrollment succeeded.
        success: bool,
        /// Status message.
        message: String,
        /// Agent ID if enrollment succeeded.
        agent_id: Option<String>,
    },
    /// Vulnerability scan results updated.
    VulnerabilityUpdate {
        /// Vulnerability summary.
        summary: GuiVulnerabilitySummary,
    },
    /// Software inventory updated.
    SoftwareUpdate {
        /// List of installed software packages.
        packages: Vec<GuiSoftwarePackage>,
    },
    /// Vulnerability findings updated.
    VulnerabilityFindings {
        /// List of vulnerability findings.
        findings: Vec<GuiVulnerabilityFinding>,
    },
    /// A tracing log event captured for the terminal view.
    TerminalLog {
        /// The captured log entry.
        entry: TerminalLogEntry,
    },
    /// Discovery results updated.
    DiscoveryUpdate {
        /// Discovered devices.
        devices: Vec<crate::dto::GuiDiscoveredDevice>,
    },
    /// Discovery scan progress.
    DiscoveryProgress {
        /// Current phase description.
        phase: String,
        /// Progress percentage (0.0-1.0).
        progress: f32,
        /// Number of devices found so far.
        devices_found: usize,
    },
    /// Agent is shutting down.
    ShuttingDown,
}

/// Commands sent from the GUI to the agent runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GuiCommand {
    /// Pause agent operations.
    Pause,
    /// Resume agent operations.
    Resume,
    /// Trigger an immediate compliance check.
    RunCheck,
    /// Force a sync with the server.
    ForceSync,
    /// Request the current agent summary.
    GetSummary,
    /// Request the list of check results.
    GetCheckResults,
    /// Mark a notification as read.
    MarkNotificationRead {
        /// Notification ID.
        notification_id: String,
    },
    /// Request shutdown.
    Shutdown,
    /// Start network discovery scan.
    StartDiscovery,
    /// Stop network discovery scan.
    StopDiscovery,
    /// Propose a discovered device as an asset.
    ProposeAsset {
        /// IP address.
        ip: String,
        /// Hostname if resolved.
        hostname: Option<String>,
        /// Device type classification.
        device_type: String,
    },
    /// Update the check interval.
    UpdateCheckInterval {
        /// New interval in seconds.
        interval_secs: u64,
    },
    /// Set the log level.
    SetLogLevel {
        /// Log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE).
        level: u8,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_event_serialization() {
        let event = AgentEvent::SyncStatus {
            syncing: true,
            pending_count: 5,
            last_sync_at: Some(Utc::now()),
            error: None,
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"sync_status\""));
        assert!(json.contains("\"syncing\":true"));
    }

    #[test]
    fn test_gui_command_serialization() {
        let cmd = GuiCommand::Pause;
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"type\":\"pause\""));

        let cmd = GuiCommand::MarkNotificationRead {
            notification_id: "abc-123".to_string(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("notification_id"));
    }

    #[test]
    fn test_shutting_down_event() {
        let event = AgentEvent::ShuttingDown;
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("shutting_down"));
    }
}
