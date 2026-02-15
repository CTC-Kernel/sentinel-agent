//! Auto-login disabled compliance check.
//!
//! Verifies that automatic login is disabled:
//! - Windows: AutoAdminLogon registry setting
//! - Linux: GDM automatic login configuration
//! - macOS: loginwindow autoLoginUser preference

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::process::Command;
use tracing::debug;

/// Check ID for auto-login disabled.
pub const CHECK_ID: &str = "auto_login_disabled";

/// Auto-login status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoLoginStatus {
    /// Whether auto-login is disabled (compliant = true means disabled).
    pub auto_login_disabled: bool,

    /// The auto-login user, if configured.
    #[serde(default)]
    pub auto_login_user: Option<String>,

    /// Method used to detect the setting.
    pub detection_method: String,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Auto-login disabled compliance check.
pub struct AutoLoginCheck {
    definition: CheckDefinition,
}

impl AutoLoginCheck {
    /// Create a new auto-login check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Auto-Login Disabled")
            .description("Verify automatic login is disabled")
            .category(CheckCategory::Authentication)
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

    /// Check auto-login on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<AutoLoginStatus> {
        debug!("Checking Windows auto-login registry settings");

        let output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
                "/v",
                "AutoAdminLogon",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!(
                    "Failed to query AutoAdminLogon registry: {}",
                    e
                ))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // If the key doesn't exist, auto-login is disabled (compliant)
        if !output.status.success() {
            return Ok(AutoLoginStatus {
                auto_login_disabled: true,
                auto_login_user: None,
                detection_method: "Registry (key not found)".to_string(),
                raw_output: format!("stdout: {}\nstderr: {}", raw_output, stderr),
            });
        }

        // Parse the registry value - look for AutoAdminLogon value
        // Expected format: "    AutoAdminLogon    REG_SZ    0"
        let auto_login_enabled = raw_output.lines().any(|line| {
            line.contains("AutoAdminLogon") && !line.contains("0x0") && !line.trim().ends_with("0")
        });

        // Also check for DefaultUserName if auto-login is enabled
        let mut auto_login_user = None;
        if auto_login_enabled {
            if let Ok(user_output) = Command::new("reg")
                .args([
                    "query",
                    r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
                    "/v",
                    "DefaultUserName",
                ])
                .output()
            {
                let user_str = String::from_utf8_lossy(&user_output.stdout).to_string();
                for line in user_str.lines() {
                    if line.contains("DefaultUserName") {
                        if let Some(value) = line.split_whitespace().last() {
                            auto_login_user = Some(value.to_string());
                        }
                    }
                }
            }
        }

        Ok(AutoLoginStatus {
            auto_login_disabled: !auto_login_enabled,
            auto_login_user,
            detection_method: "Registry (AutoAdminLogon)".to_string(),
            raw_output,
        })
    }

    /// Check auto-login on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<AutoLoginStatus> {
        debug!("Checking Linux GDM auto-login settings");

        let mut raw_output = String::new();

        // Check GDM3 configuration
        let gdm3_path = "/etc/gdm3/custom.conf";
        let gdm_path = "/etc/gdm/custom.conf";

        let config_path = if std::path::Path::new(gdm3_path).exists() {
            Some(gdm3_path)
        } else if std::path::Path::new(gdm_path).exists() {
            Some(gdm_path)
        } else {
            None
        };

        if let Some(path) = config_path {
            match std::fs::read_to_string(path) {
                Ok(content) => {
                    raw_output.push_str(&format!("=== {} ===\n{}\n", path, content));

                    // Check for AutomaticLoginEnable setting
                    let auto_login_enabled = content.lines().any(|line| {
                        let trimmed = line.trim();
                        !trimmed.starts_with('#')
                            && trimmed.contains("AutomaticLoginEnable")
                            && (trimmed.contains("true") || trimmed.contains("True"))
                    });

                    // Extract auto-login user if enabled
                    let mut auto_login_user = None;
                    if auto_login_enabled {
                        for line in content.lines() {
                            let trimmed = line.trim();
                            if !trimmed.starts_with('#') && trimmed.contains("AutomaticLogin=") {
                                if let Some(user) = trimmed.split('=').last() {
                                    let user = user.trim();
                                    if !user.is_empty() {
                                        auto_login_user = Some(user.to_string());
                                    }
                                }
                            }
                        }
                    }

                    return Ok(AutoLoginStatus {
                        auto_login_disabled: !auto_login_enabled,
                        auto_login_user,
                        detection_method: format!("GDM config ({})", path),
                        raw_output,
                    });
                }
                Err(e) => {
                    raw_output.push_str(&format!("Failed to read {}: {}\n", path, e));
                }
            }
        } else {
            raw_output.push_str("No GDM configuration found (neither /etc/gdm3/custom.conf nor /etc/gdm/custom.conf)\n");
        }

        // If no GDM config found, auto-login is considered disabled
        Ok(AutoLoginStatus {
            auto_login_disabled: true,
            auto_login_user: None,
            detection_method: "GDM config (not found)".to_string(),
            raw_output,
        })
    }

    /// Check auto-login on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<AutoLoginStatus> {
        debug!("Checking macOS auto-login settings");

        let output = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.loginwindow",
                "autoLoginUser",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!(
                    "Failed to read loginwindow preferences: {}",
                    e
                ))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // If the command fails (key doesn't exist), auto-login is disabled (compliant)
        if !output.status.success() {
            return Ok(AutoLoginStatus {
                auto_login_disabled: true,
                auto_login_user: None,
                detection_method: "defaults (autoLoginUser not set)".to_string(),
                raw_output: format!("stdout: {}\nstderr: {}", raw_output.trim(), stderr.trim()),
            });
        }

        // If the command succeeds, auto-login is configured with the returned user
        let auto_login_user = raw_output.trim().to_string();

        Ok(AutoLoginStatus {
            auto_login_disabled: false,
            auto_login_user: if auto_login_user.is_empty() {
                None
            } else {
                Some(auto_login_user)
            },
            detection_method: "defaults (autoLoginUser)".to_string(),
            raw_output: format!("stdout: {}\nstderr: {}", raw_output.trim(), stderr.trim()),
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<AutoLoginStatus> {
        Ok(AutoLoginStatus {
            auto_login_disabled: false,
            auto_login_user: None,
            detection_method: "Unknown".to_string(),
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for AutoLoginCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for AutoLoginCheck {
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

        if status.auto_login_disabled {
            Ok(CheckOutput::pass(
                format!(
                    "Auto-login is disabled (detection: {})",
                    status.detection_method
                ),
                raw_data,
            ))
        } else {
            let user_info = status
                .auto_login_user
                .as_deref()
                .map(|u| format!(" (user: {})", u))
                .unwrap_or_default();

            Ok(CheckOutput::fail(
                format!(
                    "Auto-login is enabled{} (detection: {})",
                    user_info, status.detection_method
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
        let check = AutoLoginCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Authentication);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = AutoLoginCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"NIS2".to_string()));
    }

    #[test]
    fn test_auto_login_status_serialization() {
        let status = AutoLoginStatus {
            auto_login_disabled: true,
            auto_login_user: None,
            detection_method: "Registry".to_string(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"auto_login_disabled\":true"));

        let parsed: AutoLoginStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.auto_login_disabled);
        assert!(parsed.auto_login_user.is_none());
    }

    #[test]
    fn test_auto_login_enabled_status() {
        let status = AutoLoginStatus {
            auto_login_disabled: false,
            auto_login_user: Some("admin".to_string()),
            detection_method: "defaults".to_string(),
            raw_output: "admin".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        let parsed: AutoLoginStatus = serde_json::from_str(&json).unwrap();
        assert!(!parsed.auto_login_disabled);
        assert_eq!(parsed.auto_login_user, Some("admin".to_string()));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = AutoLoginCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
