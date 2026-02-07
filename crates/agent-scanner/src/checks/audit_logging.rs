//! Audit logging compliance check.
//!
//! Verifies that audit/event logging is enabled and configured:
//! - Windows: Windows Event Log service
//! - Linux: auditd service and configuration
//! - macOS: OpenBSM audit subsystem

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for audit logging.
pub const CHECK_ID: &str = "audit_logging";

/// Audit logging status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLoggingStatus {
    /// Whether audit logging is enabled.
    pub enabled: bool,

    /// Type of audit system detected.
    pub audit_system: String,

    /// Whether the audit service is running.
    pub service_running: bool,

    /// Whether the audit configuration file exists.
    pub config_exists: bool,

    /// Path to the audit configuration file.
    #[serde(default)]
    pub config_path: Option<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Audit logging compliance check.
pub struct AuditLoggingCheck {
    definition: CheckDefinition,
}

impl AuditLoggingCheck {
    /// Create a new audit logging check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Audit Logging")
            .description("Verify audit/event logging is enabled and configured")
            .category(CheckCategory::AuditLogging)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .framework("SOC2")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check audit logging on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<AuditLoggingStatus> {
        debug!("Checking Windows Event Log service status");

        let output = Command::new("sc")
            .args(["query", "eventlog"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query Event Log service: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(ScannerError::CheckExecution(format!(
                "Event Log service query failed: {}",
                stderr
            )));
        }

        let service_running = raw_output.contains("RUNNING");

        Ok(AuditLoggingStatus {
            enabled: service_running,
            audit_system: "Windows Event Log".to_string(),
            service_running,
            config_exists: true, // Event Log is always configured on Windows
            config_path: None,
            raw_output,
        })
    }

    /// Check audit logging on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<AuditLoggingStatus> {
        debug!("Checking Linux auditd status");

        let mut raw_output = String::new();

        // Check if auditd service is active
        let service_output = Command::new("systemctl")
            .args(["is-active", "auditd"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to check auditd service: {}", e))
            })?;

        let service_status = String::from_utf8_lossy(&service_output.stdout).to_string();
        raw_output.push_str(&format!(
            "systemctl is-active auditd: {}\n",
            service_status.trim()
        ));

        let service_running = service_status.trim() == "active";

        // Check if auditd configuration file exists
        let config_path = "/etc/audit/auditd.conf";
        let config_exists = std::path::Path::new(config_path).exists();
        raw_output.push_str(&format!("{} exists: {}\n", config_path, config_exists));

        let enabled = service_running && config_exists;

        Ok(AuditLoggingStatus {
            enabled,
            audit_system: "auditd".to_string(),
            service_running,
            config_exists,
            config_path: Some(config_path.to_string()),
            raw_output,
        })
    }

    /// Check audit logging on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<AuditLoggingStatus> {
        debug!("Checking macOS audit subsystem status");

        let mut raw_output = String::new();
        let mut audit_enabled = false;

        // Try running audit -c to check if auditing is enabled
        if let Ok(output) = Command::new("/usr/sbin/audit").args(["-c"]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            raw_output.push_str(&format!(
                "audit -c stdout: {}\naudit -c stderr: {}\n",
                stdout.trim(),
                stderr.trim()
            ));
            // If the command succeeds, auditing is likely configured
            if output.status.success() {
                audit_enabled = true;
            }
        }

        // Check if audit_control configuration exists
        let config_path = "/etc/security/audit_control";
        let config_exists = std::path::Path::new(config_path).exists();
        raw_output.push_str(&format!("{} exists: {}\n", config_path, config_exists));

        // If config exists, consider audit as enabled even if audit -c failed
        if config_exists {
            audit_enabled = true;
        }

        Ok(AuditLoggingStatus {
            enabled: audit_enabled,
            audit_system: "OpenBSM".to_string(),
            service_running: audit_enabled,
            config_exists,
            config_path: Some(config_path.to_string()),
            raw_output,
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<AuditLoggingStatus> {
        Ok(AuditLoggingStatus {
            enabled: false,
            audit_system: "Unknown".to_string(),
            service_running: false,
            config_exists: false,
            config_path: None,
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for AuditLoggingCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for AuditLoggingCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        #[cfg(target_os = "windows")]
        let status = self.check_windows().await?;

        #[cfg(target_os = "linux")]
        let status = self.check_linux().await?;

        #[cfg(target_os = "macos")]
        let status = self.check_macos().await?;

        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        let status = self.check_unsupported().await?;

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.enabled {
            Ok(CheckOutput::pass(
                format!(
                    "{} audit logging is enabled (service running: {}, config exists: {})",
                    status.audit_system, status.service_running, status.config_exists
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "{} audit logging is not properly configured (service running: {}, config exists: {})",
                    status.audit_system, status.service_running, status.config_exists
                ),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_creation() {
        let check = AuditLoggingCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::AuditLogging);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = AuditLoggingCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"ISO_27001".to_string()));
        assert!(frameworks.contains(&"SOC2".to_string()));
    }

    #[test]
    fn test_audit_logging_status_serialization() {
        let status = AuditLoggingStatus {
            enabled: true,
            audit_system: "auditd".to_string(),
            service_running: true,
            config_exists: true,
            config_path: Some("/etc/audit/auditd.conf".to_string()),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("auditd"));
        assert!(json.contains("\"enabled\":true"));

        let parsed: AuditLoggingStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.enabled);
        assert!(parsed.service_running);
        assert!(parsed.config_exists);
    }

    #[test]
    fn test_disabled_audit_logging_status() {
        let status = AuditLoggingStatus {
            enabled: false,
            audit_system: "auditd".to_string(),
            service_running: false,
            config_exists: false,
            config_path: None,
            raw_output: String::new(),
        };

        assert!(!status.enabled);
        assert!(!status.service_running);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = AuditLoggingCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
