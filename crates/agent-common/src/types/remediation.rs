//! Automated remediation types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Risk level of a remediation action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemediationRisk {
    /// Safe to execute automatically (e.g., enabling a service).
    Safe,
    /// Moderate risk (e.g., changing a system setting that could affect functionality).
    Moderate,
    /// High risk (e.g., modifying firewall rules, disabling protocols).
    Risky,
}

impl RemediationRisk {
    /// Human-readable label.
    pub fn label(&self) -> &'static str {
        match self {
            RemediationRisk::Safe => "Safe",
            RemediationRisk::Moderate => "Moderate",
            RemediationRisk::Risky => "Risky",
        }
    }
}

/// Status of a remediation execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemediationStatus {
    /// Ready to execute.
    Pending,
    /// Dry-run preview shown.
    Previewed,
    /// Currently executing.
    Running,
    /// Completed successfully.
    Success,
    /// Failed to execute.
    Failed,
    /// Rolled back after failure.
    RolledBack,
}

/// A remediation action for a specific compliance check failure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationAction {
    /// ID of the check this remediates.
    pub check_id: String,

    /// Target platform (windows, linux, macos).
    pub platform: String,

    /// Shell/PowerShell command to execute.
    pub script: String,

    /// Whether a reboot is required after execution.
    pub requires_reboot: bool,

    /// Whether admin/root privileges are required.
    pub requires_admin: bool,

    /// Risk level assessment.
    pub risk_level: RemediationRisk,

    /// Human-readable description of what this action does.
    pub description: String,

    /// Optional rollback command.
    pub rollback_script: Option<String>,
}

/// Result of a remediation execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationResult {
    /// Check ID that was remediated.
    pub check_id: String,

    /// Whether the remediation succeeded.
    pub status: RemediationStatus,

    /// Output from the remediation script.
    pub output: String,

    /// Error message if failed.
    pub error: Option<String>,

    /// When the remediation was executed.
    pub executed_at: DateTime<Utc>,

    /// Duration in milliseconds.
    pub duration_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remediation_risk_label() {
        assert_eq!(RemediationRisk::Safe.label(), "Safe");
        assert_eq!(RemediationRisk::Risky.label(), "Risky");
    }

    #[test]
    fn test_remediation_action_serialization() {
        let action = RemediationAction {
            check_id: "firewall_config".to_string(),
            platform: "linux".to_string(),
            script: "ufw enable".to_string(),
            requires_reboot: false,
            requires_admin: true,
            risk_level: RemediationRisk::Moderate,
            description: "Enable the UFW firewall".to_string(),
            rollback_script: Some("ufw disable".to_string()),
        };

        let json = serde_json::to_string(&action).unwrap();
        let parsed: RemediationAction = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.check_id, "firewall_config");
        assert_eq!(parsed.risk_level, RemediationRisk::Moderate);
    }

    #[test]
    fn test_remediation_result_serialization() {
        let result = RemediationResult {
            check_id: "firewall_config".to_string(),
            status: RemediationStatus::Success,
            output: "Firewall enabled".to_string(),
            error: None,
            executed_at: Utc::now(),
            duration_ms: 250,
        };

        let json = serde_json::to_string(&result).unwrap();
        let parsed: RemediationResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, RemediationStatus::Success);
    }
}
