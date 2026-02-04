//! Compliance check types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Status of a compliance check execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    /// Check passed - system is compliant.
    Pass,
    /// Check failed - system is non-compliant.
    Fail,
    /// Check encountered an error during execution.
    Error,
    /// Check was skipped (not applicable or disabled).
    Skipped,
    /// Check is pending execution.
    Pending,
}

/// Severity level of a compliance check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckSeverity {
    /// Critical severity - immediate attention required.
    Critical,
    /// High severity - should be addressed soon.
    High,
    /// Medium severity - should be planned for remediation.
    Medium,
    /// Low severity - informational or best practice.
    Low,
    /// Informational - no action required.
    Info,
}

/// Category of compliance check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckCategory {
    /// Disk encryption checks.
    Encryption,
    /// Antivirus and malware protection.
    Antivirus,
    /// Firewall configuration.
    Firewall,
    /// Password and authentication policies.
    Authentication,
    /// Session and screen lock settings.
    SessionLock,
    /// System updates and patching.
    Updates,
    /// Protocol security (SSL/TLS, SMB).
    Protocols,
    /// Backup configuration.
    Backup,
    /// User account management.
    Accounts,
    /// Multi-factor authentication.
    Mfa,
    /// Remote access security.
    RemoteAccess,
    /// Audit logging and event monitoring.
    AuditLogging,
    /// Device control (USB, Bluetooth, peripherals).
    DeviceControl,
    /// Kernel and OS hardening.
    KernelSecurity,
    /// Network hardening (IPv6, routing).
    NetworkHardening,
    /// Time synchronization.
    TimeSync,
    /// Browser security settings.
    BrowserSecurity,
    /// General security configuration.
    General,
}

/// Definition of a compliance check.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct CheckDefinition {
    /// Unique identifier for the check.
    pub id: String,

    /// Human-readable name.
    pub name: String,

    /// Detailed description.
    pub description: String,

    /// Category of the check.
    pub category: CheckCategory,

    /// Severity if the check fails.
    pub severity: CheckSeverity,

    /// Applicable regulatory frameworks (e.g., "NIS2", "DORA", "RGPD").
    pub frameworks: Vec<String>,

    /// Whether the check is enabled.
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// Platform applicability (e.g., ["windows", "linux"]).
    #[serde(default)]
    pub platforms: Vec<String>,

    /// Check-specific parameters.
    #[serde(default)]
    pub parameters: serde_json::Value,

    /// Optional performance requirement (NFR) for this check in milliseconds.
    /// If execution exceeds this duration, a warning may be logged.
    #[serde(default)]
    pub nfr_duration_ms: Option<u64>,
}

fn default_enabled() -> bool {
    true
}

/// Result of a compliance check execution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub struct CheckResult {
    /// Unique identifier for this result.
    pub id: Uuid,

    /// ID of the check that was executed.
    pub check_id: String,

    /// Execution status.
    pub status: CheckStatus,

    /// Timestamp of execution.
    pub executed_at: DateTime<Utc>,

    /// Duration of the check in milliseconds.
    pub duration_ms: u64,

    /// Human-readable message.
    #[serde(default)]
    pub message: Option<String>,

    /// Reference to the proof (if generated).
    #[serde(default)]
    pub proof_id: Option<Uuid>,

    /// Additional details about the result.
    #[serde(default)]
    pub details: serde_json::Value,

    /// Whether this result has been synced to the server.
    #[serde(default)]
    pub synced: bool,
}

impl CheckResult {
    /// Create a new passing check result.
    pub fn pass(check_id: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            check_id: check_id.into(),
            status: CheckStatus::Pass,
            executed_at: Utc::now(),
            duration_ms: 0,
            message: None,
            proof_id: None,
            details: serde_json::Value::Null,
            synced: false,
        }
    }

    /// Create a new failing check result.
    pub fn fail(check_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            check_id: check_id.into(),
            status: CheckStatus::Fail,
            executed_at: Utc::now(),
            duration_ms: 0,
            message: Some(message.into()),
            proof_id: None,
            details: serde_json::Value::Null,
            synced: false,
        }
    }

    /// Create an error check result.
    pub fn error(check_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            check_id: check_id.into(),
            status: CheckStatus::Error,
            executed_at: Utc::now(),
            duration_ms: 0,
            message: Some(message.into()),
            proof_id: None,
            details: serde_json::Value::Null,
            synced: false,
        }
    }

    /// Set the duration of the check.
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
    }

    /// Set the proof ID.
    pub fn with_proof(mut self, proof_id: Uuid) -> Self {
        self.proof_id = Some(proof_id);
        self
    }

    /// Set additional details.
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = details;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_status_serialization() {
        let status = CheckStatus::Pass;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"pass\"");

        let parsed: CheckStatus = serde_json::from_str("\"fail\"").unwrap();
        assert_eq!(parsed, CheckStatus::Fail);
    }

    #[test]
    fn test_check_result_pass() {
        let result = CheckResult::pass("disk_encryption");
        assert_eq!(result.status, CheckStatus::Pass);
        assert_eq!(result.check_id, "disk_encryption");
        assert!(!result.synced);
    }

    #[test]
    fn test_check_result_fail() {
        let result = CheckResult::fail("firewall", "Firewall is disabled");
        assert_eq!(result.status, CheckStatus::Fail);
        assert_eq!(result.message, Some("Firewall is disabled".to_string()));
    }

    #[test]
    fn test_check_result_serialization() {
        let result = CheckResult::pass("test_check")
            .with_duration(150)
            .with_details(serde_json::json!({"key": "value"}));

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("check_id"));
        assert!(json.contains("executed_at"));
        assert!(json.contains("duration_ms"));

        let parsed: CheckResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.check_id, "test_check");
        assert_eq!(parsed.duration_ms, 150);
    }

    #[test]
    fn test_check_definition_serialization() {
        let def = CheckDefinition {
            id: "disk_encryption".to_string(),
            name: "Disk Encryption".to_string(),
            description: "Verify disk encryption is enabled".to_string(),
            category: CheckCategory::Encryption,
            severity: CheckSeverity::High,
            frameworks: vec!["NIS2".to_string(), "DORA".to_string()],
            enabled: true,
            platforms: vec!["windows".to_string(), "linux".to_string()],
            parameters: serde_json::Value::Null,
            nfr_duration_ms: Some(2000),
        };

        let json = serde_json::to_string(&def).unwrap();
        let parsed: CheckDefinition = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "disk_encryption");
        assert_eq!(parsed.category, CheckCategory::Encryption);
        assert_eq!(parsed.nfr_duration_ms, Some(2000));
    }
}
