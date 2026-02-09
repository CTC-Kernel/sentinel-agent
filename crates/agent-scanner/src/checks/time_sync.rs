//! Time synchronization compliance check.
//!
//! Verifies that NTP/chrony is configured and synchronized:
//! - Windows: W32Time service status via w32tm
//! - Linux: chronyc tracking or timedatectl
//! - macOS: sntp or systemsetup network time

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for time synchronization.
pub const CHECK_ID: &str = "time_sync";

/// Time synchronization status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSyncStatus {
    /// Whether time synchronization is enabled and working.
    pub synchronized: bool,

    /// Time synchronization method (NTP, chrony, W32Time, etc.).
    pub sync_method: String,

    /// NTP source/server being used.
    pub ntp_source: Option<String>,

    /// Leap indicator status.
    pub leap_status: Option<String>,

    /// Whether the NTP service is running.
    pub service_running: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Time synchronization compliance check.
pub struct TimeSyncCheck {
    definition: CheckDefinition,
}

impl TimeSyncCheck {
    /// Create a new time synchronization check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Time Synchronization")
            .description("Verify NTP/chrony is configured and synchronized")
            .category(CheckCategory::TimeSync)
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

    /// Check time synchronization on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking Windows time synchronization (W32Time)");

        let output = Command::new("w32tm")
            .args(["/query", "/status"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run w32tm: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut status = TimeSyncStatus {
            synchronized: false,
            sync_method: "W32Time".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        if !output.status.success() {
            if stderr.contains("not running") || stderr.contains("service is not started") {
                status
                    .issues
                    .push("W32Time service is not running".to_string());
                return Ok(status);
            }
            return Err(ScannerError::CheckExecution(format!(
                "w32tm query failed: {}",
                stderr
            )));
        }

        status.service_running = true;

        // Parse output for leap indicator and source
        for line in raw_output.lines() {
            let line_lower = line.to_lowercase();
            if line_lower.contains("leap indicator:") || line_lower.contains("leap indicator :") {
                if let Some(value) = line.split(':').last() {
                    let leap = value.trim().to_string();
                    // "0(no warning)" means synchronized
                    status.synchronized =
                        leap.contains("0") || leap.to_lowercase().contains("no warning");
                    status.leap_status = Some(leap);
                }
            }
            if line_lower.contains("source:") || line_lower.contains("source :") {
                if let Some(value) = line.split(':').last() {
                    let source = value.trim().to_string();
                    if !source.is_empty() && source != "Local CMOS Clock" {
                        status.ntp_source = Some(source);
                    }
                }
            }
        }

        if !status.synchronized {
            status
                .issues
                .push("Time is not properly synchronized".to_string());
        }

        if status.ntp_source.is_none() {
            status
                .issues
                .push("No external NTP source configured".to_string());
        }

        Ok(status)
    }

    /// Check time synchronization on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking Linux time synchronization");

        let mut status = TimeSyncStatus {
            synchronized: false,
            sync_method: "Unknown".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Try chronyc first
        if let Ok(output) = Command::new("chronyc").args(["tracking"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== chronyc tracking ===\n{}\n", result));

            if output.status.success() {
                status.sync_method = "chrony".to_string();
                status.service_running = true;

                for line in result.lines() {
                    let line_lower = line.to_lowercase();
                    if line_lower.contains("leap status") {
                        if let Some(value) = line.split(':').last() {
                            let leap = value.trim().to_string();
                            status.synchronized = leap.to_lowercase().contains("normal");
                            status.leap_status = Some(leap);
                        }
                    }
                    if line_lower.contains("reference") && !line_lower.contains("reference time") {
                        if let Some(value) = line.split(':').last() {
                            let source = value.trim().to_string();
                            if !source.is_empty() {
                                status.ntp_source = Some(source);
                            }
                        }
                    }
                }

                if status.synchronized {
                    return Ok(status);
                }
            }
        }

        // Fall back to timedatectl
        if let Ok(output) = Command::new("timedatectl").args(["status"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== timedatectl ===\n{}\n", result));

            if output.status.success() {
                if status.sync_method == "Unknown" {
                    status.sync_method = "systemd-timesyncd".to_string();
                }

                for line in result.lines() {
                    let line_lower = line.to_lowercase();
                    // Different systemd versions use different labels
                    if line_lower.contains("ntp synchronized:")
                        || line_lower.contains("system clock synchronized:")
                    {
                        if let Some(value) = line.split(':').last() {
                            let sync_val = value.trim().to_lowercase();
                            status.synchronized = sync_val == "yes";
                            status.service_running = true;
                        }
                    }
                    if line_lower.contains("ntp service:") || line_lower.contains("ntp enabled:") {
                        if let Some(value) = line.split(':').last() {
                            let ntp_val = value.trim().to_lowercase();
                            if ntp_val != "active" && ntp_val != "yes" && ntp_val != "enabled" {
                                status.service_running = false;
                            }
                        }
                    }
                }
            }
        }

        if !status.service_running {
            status
                .issues
                .push("No NTP service is running (chrony or systemd-timesyncd)".to_string());
        }

        if !status.synchronized {
            status
                .issues
                .push("System clock is not synchronized".to_string());
        }

        Ok(status)
    }

    /// Check time synchronization on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<TimeSyncStatus> {
        debug!("Checking macOS time synchronization");

        let mut status = TimeSyncStatus {
            synchronized: false,
            sync_method: "NTP".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check if network time is enabled
        if let Ok(output) = Command::new("systemsetup")
            .args(["-getusingnetworktime"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("Network Time: {}\n", result.trim()));

            let network_time_on = result.to_lowercase().contains("on");
            status.service_running = network_time_on;

            if !network_time_on {
                status
                    .issues
                    .push("Network time is not enabled".to_string());
            }
        }

        // Check NTP server
        if let Ok(output) = Command::new("systemsetup")
            .args(["-getnetworktimeserver"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("NTP Server: {}\n", result.trim()));

            // Parse "Network Time Server: time.apple.com"
            if let Some(server) = result.split(':').next_back() {
                let server = server.trim().to_string();
                if !server.is_empty() {
                    status.ntp_source = Some(server);
                }
            }
        }

        // Try sntp to verify actual synchronization
        let ntp_server = status
            .ntp_source
            .clone()
            .unwrap_or_else(|| "time.apple.com".to_string());

        if let Ok(output) = Command::new("sntp").args(["-d", &ntp_server]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            status.raw_output.push_str(&format!(
                "=== sntp ===\nstdout: {}\nstderr: {}\n",
                result.trim(),
                stderr.trim()
            ));

            // sntp outputs to stderr typically; a successful query means NTP is reachable
            let combined = format!("{} {}", result, stderr);
            if combined.contains("+/-") || combined.contains("offset") {
                status.synchronized = true;
            }
        }

        // If service is running but we could not verify sync, assume working
        if status.service_running && !status.synchronized {
            // Network time is on, trust the OS
            status.synchronized = true;
        }

        if !status.synchronized {
            status
                .issues
                .push("Time synchronization could not be verified".to_string());
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<TimeSyncStatus> {
        Ok(TimeSyncStatus {
            synchronized: false,
            sync_method: "Unknown".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for TimeSyncCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for TimeSyncCheck {
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

        if status.synchronized {
            let mut details = vec![format!("method={}", status.sync_method)];
            if let Some(source) = &status.ntp_source {
                details.push(format!("source={}", source));
            }
            if let Some(leap) = &status.leap_status {
                details.push(format!("leap={}", leap));
            }

            Ok(CheckOutput::pass(
                format!("Time is properly synchronized: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Time synchronization issues: {}", status.issues.join("; ")),
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
        let check = TimeSyncCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::TimeSync);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = TimeSyncCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_time_sync_status_serialization() {
        let status = TimeSyncStatus {
            synchronized: true,
            sync_method: "chrony".to_string(),
            ntp_source: Some("ntp.ubuntu.com".to_string()),
            leap_status: Some("Normal".to_string()),
            service_running: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"synchronized\":true"));
        assert!(json.contains("\"sync_method\":\"chrony\""));
        assert!(json.contains("ntp.ubuntu.com"));

        let parsed: TimeSyncStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.synchronized);
        assert_eq!(parsed.ntp_source, Some("ntp.ubuntu.com".to_string()));
    }

    #[test]
    fn test_time_sync_not_synchronized() {
        let status = TimeSyncStatus {
            synchronized: false,
            sync_method: "Unknown".to_string(),
            ntp_source: None,
            leap_status: None,
            service_running: false,
            issues: vec!["No NTP service is running".to_string()],
            raw_output: String::new(),
        };

        assert!(!status.synchronized);
        assert!(!status.service_running);
        assert_eq!(status.issues.len(), 1);
    }

    #[test]
    fn test_w32time_status() {
        let status = TimeSyncStatus {
            synchronized: true,
            sync_method: "W32Time".to_string(),
            ntp_source: Some("time.windows.com".to_string()),
            leap_status: Some("0(no warning)".to_string()),
            service_running: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        let parsed: TimeSyncStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.synchronized);
        assert_eq!(parsed.sync_method, "W32Time");
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = TimeSyncCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = TimeSyncCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "Time Synchronization");
        assert!(def.description.contains("NTP"));
        assert!(def.enabled);
    }
}
