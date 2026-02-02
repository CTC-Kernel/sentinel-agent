//! Guest account disabled compliance check.
//!
//! Verifies that the guest/anonymous account is disabled:
//! - Windows: Guest account via net user
//! - Linux: Guest account in /etc/passwd and lock status
//! - macOS: Guest account via dscl and loginwindow preferences

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for guest account disabled.
pub const CHECK_ID: &str = "guest_account_disabled";

/// Guest account status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestAccountStatus {
    /// Whether guest account is disabled (compliant = true means disabled).
    pub guest_disabled: bool,

    /// Whether the guest account exists on the system.
    pub account_exists: bool,

    /// Whether the guest account is locked.
    #[serde(default)]
    pub account_locked: Option<bool>,

    /// Detection method used.
    pub detection_method: String,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Guest account disabled compliance check.
pub struct GuestAccountCheck {
    definition: CheckDefinition,
}

impl GuestAccountCheck {
    /// Create a new guest account check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Guest Account Disabled")
            .description("Verify guest/anonymous account is disabled")
            .category(CheckCategory::Accounts)
            .severity(CheckSeverity::Medium)
            .framework("CIS")
            .framework("NIS2")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check guest account on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<GuestAccountStatus> {
        debug!("Checking Windows Guest account status");

        let output = Command::new("net")
            .args(["user", "Guest"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query Guest account: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // If the command fails, the Guest account might not exist
        if !output.status.success() {
            return Ok(GuestAccountStatus {
                guest_disabled: true,
                account_exists: false,
                account_locked: None,
                detection_method: "net user Guest (account not found)".to_string(),
                raw_output: format!("stdout: {}\nstderr: {}", raw_output, stderr),
            });
        }

        // Parse "Account active" line
        let account_active = raw_output
            .lines()
            .any(|line| line.contains("Account active") && line.to_lowercase().contains("yes"));

        Ok(GuestAccountStatus {
            guest_disabled: !account_active,
            account_exists: true,
            account_locked: Some(!account_active),
            detection_method: "net user Guest".to_string(),
            raw_output,
        })
    }

    /// Check guest account on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<GuestAccountStatus> {
        debug!("Checking Linux guest account status");

        let mut raw_output = String::new();

        // Check /etc/passwd for guest account
        let passwd_content = std::fs::read_to_string("/etc/passwd").map_err(|e| {
            ScannerError::CheckExecution(format!("Failed to read /etc/passwd: {}", e))
        })?;

        let guest_line = passwd_content
            .lines()
            .find(|line| line.starts_with("guest:"));

        raw_output.push_str(&format!(
            "Guest in /etc/passwd: {}\n",
            guest_line.unwrap_or("not found")
        ));

        let account_exists = guest_line.is_some();

        if !account_exists {
            return Ok(GuestAccountStatus {
                guest_disabled: true,
                account_exists: false,
                account_locked: None,
                detection_method: "/etc/passwd".to_string(),
                raw_output,
            });
        }

        // Check if guest account is locked via passwd -S
        let lock_output = Command::new("passwd").args(["-S", "guest"]).output();

        let account_locked = match lock_output {
            Ok(output) => {
                let lock_status = String::from_utf8_lossy(&output.stdout).to_string();
                raw_output.push_str(&format!("passwd -S guest: {}\n", lock_status.trim()));

                // passwd -S output format: "username L ..." where L = locked, P = password set
                let is_locked = lock_status
                    .split_whitespace()
                    .nth(1)
                    .map(|s| s == "L" || s == "LK")
                    .unwrap_or(false);

                Some(is_locked)
            }
            Err(e) => {
                raw_output.push_str(&format!("Failed to run passwd -S: {}\n", e));
                None
            }
        };

        let guest_disabled = account_locked.unwrap_or(false);

        Ok(GuestAccountStatus {
            guest_disabled,
            account_exists: true,
            account_locked,
            detection_method: "/etc/passwd + passwd -S".to_string(),
            raw_output,
        })
    }

    /// Check guest account on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<GuestAccountStatus> {
        debug!("Checking macOS Guest account status");

        let mut raw_output = String::new();

        // Check GuestEnabled preference first
        let defaults_output = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.loginwindow",
                "GuestEnabled",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!(
                    "Failed to read loginwindow preferences: {}",
                    e
                ))
            })?;

        let defaults_raw = String::from_utf8_lossy(&defaults_output.stdout).to_string();
        let defaults_stderr = String::from_utf8_lossy(&defaults_output.stderr).to_string();
        raw_output.push_str(&format!(
            "=== GuestEnabled ===\nstdout: {}\nstderr: {}\n",
            defaults_raw.trim(),
            defaults_stderr.trim()
        ));

        if defaults_output.status.success() {
            let guest_enabled = defaults_raw.trim() == "1";

            return Ok(GuestAccountStatus {
                guest_disabled: !guest_enabled,
                account_exists: true,
                account_locked: Some(!guest_enabled),
                detection_method: "defaults (GuestEnabled)".to_string(),
                raw_output,
            });
        }

        // Fallback: Check via dscl
        let dscl_output = Command::new("dscl")
            .args([".", "-read", "/Users/Guest", "AuthenticationAuthority"])
            .output();

        match dscl_output {
            Ok(output) => {
                let dscl_raw = String::from_utf8_lossy(&output.stdout).to_string();
                let dscl_stderr = String::from_utf8_lossy(&output.stderr).to_string();
                raw_output.push_str(&format!(
                    "=== dscl Guest ===\nstdout: {}\nstderr: {}\n",
                    dscl_raw.trim(),
                    dscl_stderr.trim()
                ));

                if output.status.success() {
                    // Guest account exists and has authentication authority
                    let is_disabled = dscl_raw.contains("DisabledUser");

                    Ok(GuestAccountStatus {
                        guest_disabled: is_disabled,
                        account_exists: true,
                        account_locked: Some(is_disabled),
                        detection_method: "dscl (AuthenticationAuthority)".to_string(),
                        raw_output,
                    })
                } else {
                    // dscl failed - Guest account may not exist or is disabled
                    Ok(GuestAccountStatus {
                        guest_disabled: true,
                        account_exists: false,
                        account_locked: None,
                        detection_method: "dscl (account not found)".to_string(),
                        raw_output,
                    })
                }
            }
            Err(e) => {
                raw_output.push_str(&format!("Failed to run dscl: {}\n", e));

                Ok(GuestAccountStatus {
                    guest_disabled: true,
                    account_exists: false,
                    account_locked: None,
                    detection_method: "dscl (command failed)".to_string(),
                    raw_output,
                })
            }
        }
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<GuestAccountStatus> {
        Ok(GuestAccountStatus {
            guest_disabled: false,
            account_exists: false,
            account_locked: None,
            detection_method: "Unknown".to_string(),
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for GuestAccountCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for GuestAccountCheck {
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

        if status.guest_disabled {
            let detail = if !status.account_exists {
                "account does not exist"
            } else {
                "account is disabled"
            };

            Ok(CheckOutput::pass(
                format!(
                    "Guest account is disabled ({}, detection: {})",
                    detail, status.detection_method
                ),
                raw_data,
            ))
        } else {
            let locked_info = match status.account_locked {
                Some(true) => " (locked)",
                Some(false) => " (unlocked)",
                None => "",
            };

            Ok(CheckOutput::fail(
                format!(
                    "Guest account is enabled{} (detection: {})",
                    locked_info, status.detection_method
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
        let check = GuestAccountCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Accounts);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = GuestAccountCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS".to_string()));
        assert!(frameworks.contains(&"NIS2".to_string()));
    }

    #[test]
    fn test_guest_account_status_serialization() {
        let status = GuestAccountStatus {
            guest_disabled: true,
            account_exists: true,
            account_locked: Some(true),
            detection_method: "net user Guest".to_string(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"guest_disabled\":true"));
        assert!(json.contains("\"account_exists\":true"));

        let parsed: GuestAccountStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.guest_disabled);
        assert!(parsed.account_exists);
        assert_eq!(parsed.account_locked, Some(true));
    }

    #[test]
    fn test_guest_account_not_found() {
        let status = GuestAccountStatus {
            guest_disabled: true,
            account_exists: false,
            account_locked: None,
            detection_method: "/etc/passwd".to_string(),
            raw_output: String::new(),
        };

        assert!(status.guest_disabled);
        assert!(!status.account_exists);
    }

    #[test]
    fn test_guest_account_enabled_status() {
        let status = GuestAccountStatus {
            guest_disabled: false,
            account_exists: true,
            account_locked: Some(false),
            detection_method: "net user Guest".to_string(),
            raw_output: String::new(),
        };

        assert!(!status.guest_disabled);
        assert!(status.account_exists);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = GuestAccountCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
