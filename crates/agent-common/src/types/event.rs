//! Shared event types used across agent crates.
//!
//! These types define the common event vocabulary that flows between
//! the core runtime, storage, and (optionally) the GUI layer.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Severity level for events and notifications.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    /// Informational.
    Info,
    /// Warning - action may be needed.
    Warning,
    /// Error - something failed.
    Error,
    /// Critical - immediate attention required.
    Critical,
}

impl Severity {
    /// Convert to string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Warning => "warning",
            Severity::Error => "error",
            Severity::Critical => "critical",
        }
    }

    /// Parse from string representation.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "info" => Some(Severity::Info),
            "warning" => Some(Severity::Warning),
            "error" => Some(Severity::Error),
            "critical" => Some(Severity::Critical),
            _ => None,
        }
    }
}

/// Categories of runtime events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeEventKind {
    /// A compliance check was completed.
    CheckCompleted,
    /// Server sync started.
    SyncStarted,
    /// Server sync completed.
    SyncCompleted,
    /// Server sync failed.
    SyncFailed,
    /// Agent enrolled or re-enrolled.
    Enrolled,
    /// Agent entered offline mode.
    OfflineMode,
    /// Agent reconnected after offline.
    Reconnected,
    /// Security incident detected.
    SecurityIncident,
    /// Network alert detected.
    NetworkAlert,
    /// Vulnerability found.
    VulnerabilityFound,
    /// Configuration changed.
    ConfigChanged,
    /// Agent started.
    AgentStarted,
    /// Agent shutting down.
    AgentStopping,
    /// File integrity change detected.
    FimAlert,
    /// USB device connected or disconnected.
    UsbDeviceChange,
    /// Suspicious process detected.
    SuspiciousProcess,
    /// Remediation action executed.
    RemediationExecuted,
}

/// A lightweight runtime event record.
///
/// Used to communicate significant events between subsystems without
/// coupling to any specific storage or GUI layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RuntimeEvent {
    /// Event category.
    pub kind: RuntimeEventKind,
    /// Severity level.
    pub severity: Severity,
    /// Human-readable title.
    pub title: String,
    /// Optional detailed description.
    pub detail: Option<String>,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Source subsystem (e.g., "scanner", "sync", "network").
    pub source: Option<String>,
}

impl RuntimeEvent {
    /// Create a new runtime event.
    pub fn new(kind: RuntimeEventKind, severity: Severity, title: impl Into<String>) -> Self {
        Self {
            kind,
            severity,
            title: title.into(),
            detail: None,
            timestamp: Utc::now(),
            source: None,
        }
    }

    /// Set the detail.
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Set the source.
    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        self.source = Some(source.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_roundtrip() {
        let variants = [
            (Severity::Info, "info"),
            (Severity::Warning, "warning"),
            (Severity::Error, "error"),
            (Severity::Critical, "critical"),
        ];

        for (severity, expected_str) in variants {
            assert_eq!(severity.as_str(), expected_str);
            assert_eq!(Severity::parse_str(expected_str), Some(severity));
        }
        assert_eq!(Severity::parse_str("invalid"), None);
    }

    #[test]
    fn test_runtime_event_creation() {
        let event = RuntimeEvent::new(
            RuntimeEventKind::CheckCompleted,
            Severity::Info,
            "Disk encryption check passed",
        )
        .with_detail("All drives encrypted")
        .with_source("scanner");

        assert_eq!(event.kind, RuntimeEventKind::CheckCompleted);
        assert_eq!(event.severity, Severity::Info);
        assert_eq!(event.detail, Some("All drives encrypted".to_string()));
        assert_eq!(event.source, Some("scanner".to_string()));
    }

    #[test]
    fn test_runtime_event_serialization() {
        let event = RuntimeEvent::new(
            RuntimeEventKind::SyncCompleted,
            Severity::Info,
            "Sync completed",
        );

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("sync_completed"));
        assert!(json.contains("\"info\""));

        let parsed: RuntimeEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.kind, RuntimeEventKind::SyncCompleted);
    }
}
