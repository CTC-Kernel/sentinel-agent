//! Log rotation compliance check.
//!
//! Verifies that log rotation is configured and active:
//! - Windows: Event Log retention settings via wevtutil
//! - Linux: logrotate installation and configuration
//! - macOS: newsyslog or ASL configuration

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
#[cfg(any(target_os = "windows", target_os = "linux"))]
use crate::error::ScannerError;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "windows", target_os = "linux"))]
use std::process::Command;
use tracing::debug;

/// Check ID for log rotation.
pub const CHECK_ID: &str = "log_rotation";

/// Log rotation status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogRotationStatus {
    /// Whether log rotation is properly configured.
    pub configured: bool,

    /// Type of log rotation detected.
    pub rotation_type: String,

    /// Whether the log rotation tool is installed.
    pub tool_installed: bool,

    /// Whether the configuration file exists.
    pub config_exists: bool,

    /// Number of log rotation configuration files (Linux /etc/logrotate.d/).
    pub config_file_count: Option<u32>,

    /// Maximum log size configured (Windows Event Log).
    pub max_log_size: Option<u64>,

    /// Whether retention is configured (Windows).
    pub retention_configured: Option<bool>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Log rotation compliance check.
pub struct LogRotationCheck {
    definition: CheckDefinition,
}

impl LogRotationCheck {
    /// Create a new log rotation check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Log Rotation")
            .description("Verify log rotation is configured and active")
            .category(CheckCategory::AuditLogging)
            .severity(CheckSeverity::Medium)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check log rotation on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<LogRotationStatus> {
        debug!("Checking Windows Event Log retention settings");

        let output = Command::new("wevtutil")
            .args(["gl", "System"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run wevtutil: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(ScannerError::CheckExecution(format!(
                "wevtutil check failed: {}",
                stderr
            )));
        }

        let mut status = LogRotationStatus {
            configured: false,
            rotation_type: "Windows Event Log".to_string(),
            tool_installed: true,
            config_exists: true,
            config_file_count: None,
            max_log_size: None,
            retention_configured: None,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse maxSize and retention from wevtutil output
        for line in raw_output.lines() {
            let line_lower = line.to_lowercase();
            if line_lower.contains("maxsize:") || line_lower.contains("maxsize :") {
                if let Some(size_str) = line.split(':').last() {
                    if let Ok(size) = size_str.trim().parse::<u64>() {
                        status.max_log_size = Some(size);
                    }
                }
            }
            if line_lower.contains("retention:") || line_lower.contains("retention :") {
                if let Some(retention_str) = line.split(':').last() {
                    let retention = retention_str.trim().to_lowercase();
                    status.retention_configured = Some(retention == "true" || retention == "yes");
                }
            }
        }

        // Consider configured if maxSize is set and reasonable (> 0)
        if let Some(max_size) = status.max_log_size {
            status.configured = max_size > 0;
        }

        // Also check Application and Security logs
        for log_name in &["Application", "Security"] {
            if let Ok(log_output) = Command::new("wevtutil").args(["gl", log_name]).output() {
                let log_result = String::from_utf8_lossy(&log_output.stdout).to_string();
                status
                    .raw_output
                    .push_str(&format!("\n=== {} Log ===\n{}", log_name, log_result));
            }
        }

        if !status.configured {
            status
                .issues
                .push("Event Log retention is not properly configured".to_string());
        }

        Ok(status)
    }

    /// Check log rotation on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<LogRotationStatus> {
        debug!("Checking Linux logrotate configuration");

        let mut status = LogRotationStatus {
            configured: false,
            rotation_type: "logrotate".to_string(),
            tool_installed: false,
            config_exists: false,
            config_file_count: None,
            max_log_size: None,
            retention_configured: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check if logrotate is installed
        let which_output = Command::new("which")
            .args(["logrotate"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to check logrotate: {}", e))
            })?;

        let which_result = String::from_utf8_lossy(&which_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("which logrotate: {}\n", which_result.trim()));

        status.tool_installed = which_output.status.success() && !which_result.trim().is_empty();

        if !status.tool_installed {
            status.issues.push("logrotate is not installed".to_string());
            return Ok(status);
        }

        // Check if main config exists
        let config_path = std::path::Path::new("/etc/logrotate.conf");
        status.config_exists = config_path.exists();

        if !status.config_exists {
            status
                .issues
                .push("/etc/logrotate.conf does not exist".to_string());
        } else {
            // Read the main config
            if let Ok(content) = std::fs::read_to_string(config_path) {
                status
                    .raw_output
                    .push_str(&format!("=== /etc/logrotate.conf ===\n{}\n", content));
            }
        }

        // Check /etc/logrotate.d/ for config files
        let logrotate_d = std::path::Path::new("/etc/logrotate.d/");
        if logrotate_d.exists() && logrotate_d.is_dir() {
            if let Ok(entries) = std::fs::read_dir(logrotate_d) {
                let count = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_file())
                    .count() as u32;
                status.config_file_count = Some(count);
                status.raw_output.push_str(&format!(
                    "/etc/logrotate.d/ contains {} config files\n",
                    count
                ));
            }
        } else {
            status
                .raw_output
                .push_str("/etc/logrotate.d/ does not exist\n");
        }

        // Log rotation is configured if tool is installed, config exists, and there are config files
        status.configured = status.tool_installed
            && status.config_exists
            && status.config_file_count.unwrap_or(0) > 0;

        if !status.configured && status.tool_installed && status.config_exists {
            status
                .issues
                .push("No log rotation configuration files found in /etc/logrotate.d/".to_string());
        }

        Ok(status)
    }

    /// Check log rotation on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<LogRotationStatus> {
        debug!("Checking macOS log rotation configuration");

        let mut status = LogRotationStatus {
            configured: false,
            rotation_type: "newsyslog".to_string(),
            tool_installed: true, // newsyslog is always available on macOS
            config_exists: false,
            config_file_count: None,
            max_log_size: None,
            retention_configured: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check newsyslog configuration
        let newsyslog_conf = std::path::Path::new("/etc/newsyslog.conf");
        if newsyslog_conf.exists() {
            status.config_exists = true;
            if let Ok(content) = std::fs::read_to_string(newsyslog_conf) {
                status
                    .raw_output
                    .push_str(&format!("=== /etc/newsyslog.conf ===\n{}\n", content));

                // Count active (non-comment) rotation entries
                let active_entries = content
                    .lines()
                    .filter(|l| {
                        let trimmed = l.trim();
                        !trimmed.is_empty() && !trimmed.starts_with('#')
                    })
                    .count() as u32;

                status.config_file_count = Some(active_entries);
                status.configured = active_entries > 0;
            }
        }

        // Also check for ASL (Apple System Log) configuration
        let asl_conf = std::path::Path::new("/etc/asl.conf");
        if asl_conf.exists() {
            if let Ok(content) = std::fs::read_to_string(asl_conf) {
                status
                    .raw_output
                    .push_str(&format!("\n=== /etc/asl.conf ===\n{}\n", content));

                // ASL configuration exists, consider as additional log management
                if !status.configured {
                    status.configured = true;
                    status.rotation_type = "ASL".to_string();
                }
            }
        }

        // Check /etc/newsyslog.d/ for additional configs
        let newsyslog_d = std::path::Path::new("/etc/newsyslog.d/");
        if newsyslog_d.exists() && newsyslog_d.is_dir() {
            if let Ok(entries) = std::fs::read_dir(newsyslog_d) {
                let count = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_file())
                    .count() as u32;
                status.raw_output.push_str(&format!(
                    "/etc/newsyslog.d/ contains {} config files\n",
                    count
                ));
            }
        }

        if !status.configured {
            status.issues.push(
                "No log rotation configuration found (newsyslog.conf or asl.conf)".to_string(),
            );
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<LogRotationStatus> {
        Ok(LogRotationStatus {
            configured: false,
            rotation_type: "Unknown".to_string(),
            tool_installed: false,
            config_exists: false,
            config_file_count: None,
            max_log_size: None,
            retention_configured: None,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for LogRotationCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for LogRotationCheck {
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

        if status.configured {
            let mut details = vec![format!("type={}", status.rotation_type)];
            if let Some(count) = status.config_file_count {
                details.push(format!("configs={}", count));
            }
            if let Some(max_size) = status.max_log_size {
                details.push(format!("max_size={}", max_size));
            }

            Ok(CheckOutput::pass(
                format!(
                    "Log rotation is properly configured: {}",
                    details.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Log rotation issues: {}", status.issues.join("; ")),
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
        let check = LogRotationCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::AuditLogging);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = LogRotationCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"ISO_27001".to_string()));
    }

    #[test]
    fn test_log_rotation_status_serialization() {
        let status = LogRotationStatus {
            configured: true,
            rotation_type: "logrotate".to_string(),
            tool_installed: true,
            config_exists: true,
            config_file_count: Some(15),
            max_log_size: None,
            retention_configured: None,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"configured\":true"));
        assert!(json.contains("\"rotation_type\":\"logrotate\""));
        assert!(json.contains("\"config_file_count\":15"));

        let parsed: LogRotationStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.configured);
        assert_eq!(parsed.config_file_count, Some(15));
    }

    #[test]
    fn test_log_rotation_not_configured() {
        let status = LogRotationStatus {
            configured: false,
            rotation_type: "logrotate".to_string(),
            tool_installed: false,
            config_exists: false,
            config_file_count: None,
            max_log_size: None,
            retention_configured: None,
            issues: vec!["logrotate is not installed".to_string()],
            raw_output: String::new(),
        };

        assert!(!status.configured);
        assert!(!status.tool_installed);
        assert_eq!(status.issues.len(), 1);
    }

    #[test]
    fn test_windows_event_log_status() {
        let status = LogRotationStatus {
            configured: true,
            rotation_type: "Windows Event Log".to_string(),
            tool_installed: true,
            config_exists: true,
            config_file_count: None,
            max_log_size: Some(20971520),
            retention_configured: Some(true),
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        let parsed: LogRotationStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.max_log_size, Some(20971520));
        assert_eq!(parsed.retention_configured, Some(true));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = LogRotationCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = LogRotationCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "Log Rotation");
        assert!(def.description.contains("log rotation"));
        assert!(def.enabled);
    }
}
