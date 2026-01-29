//! Event types for communication between the agent runtime and the GUI layer.
//!
//! The runtime emits [`AgentEvent`] variants that the GUI subscribes to via a channel.
//! The GUI sends [`GuiCommand`] variants back to the runtime.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::dto::{AgentSummary, GuiCheckResult, GuiNotification, GuiResourceUsage};

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
    /// Enrollment completed (success or failure).
    EnrollmentResult {
        /// Whether enrollment succeeded.
        success: bool,
        /// Status message.
        message: String,
        /// Agent ID if enrollment succeeded.
        agent_id: Option<String>,
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
