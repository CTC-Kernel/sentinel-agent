//! Browser security settings compliance check.
//!
//! Checks default browser security configuration:
//! - Windows: Chrome enterprise policies via registry
//! - Linux: Chrome/Firefox managed policies directories
//! - macOS: Chrome managed preferences

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for browser security.
pub const CHECK_ID: &str = "browser_security";

/// Browser security status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSecurityStatus {
    /// Whether browser security policies are configured.
    pub policies_configured: bool,

    /// Whether Safe Browsing is enabled.
    #[serde(default)]
    pub safe_browsing_enabled: Option<bool>,

    /// Browsers with detected managed policies.
    #[serde(default)]
    pub managed_browsers: Vec<String>,

    /// Policy sources detected.
    #[serde(default)]
    pub policy_sources: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Browser security settings compliance check.
pub struct BrowserSecurityCheck {
    definition: CheckDefinition,
}

impl BrowserSecurityCheck {
    /// Create a new browser security check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Browser Security Settings")
            .description("Check default browser security configuration")
            .category(CheckCategory::BrowserSecurity)
            .severity(CheckSeverity::Medium)
            .framework("CIS")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check browser security on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<BrowserSecurityStatus> {
        debug!("Checking Windows browser security policies");

        let mut raw_output = String::new();
        let mut managed_browsers = Vec::new();
        let mut policy_sources = Vec::new();
        let mut safe_browsing_enabled = None;

        // Check Chrome enterprise policies
        let chrome_output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SOFTWARE\Policies\Google\Chrome",
                "/v",
                "SafeBrowsingEnabled",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!(
                    "Failed to query Chrome policies: {}",
                    e
                ))
            })?;

        let chrome_raw = String::from_utf8_lossy(&chrome_output.stdout).to_string();
        let chrome_stderr = String::from_utf8_lossy(&chrome_output.stderr).to_string();
        raw_output.push_str(&format!(
            "=== Chrome SafeBrowsingEnabled ===\nstdout: {}\nstderr: {}\n",
            chrome_raw.trim(),
            chrome_stderr.trim()
        ));

        if chrome_output.status.success() {
            managed_browsers.push("Google Chrome".to_string());
            policy_sources.push("Registry (HKLM\\SOFTWARE\\Policies\\Google\\Chrome)".to_string());

            // Parse the value - REG_DWORD 0x1 means enabled
            let sb_enabled = chrome_raw
                .lines()
                .any(|line| {
                    line.contains("SafeBrowsingEnabled")
                        && (line.contains("0x1") || line.trim().ends_with("1"))
                });
            safe_browsing_enabled = Some(sb_enabled);
        }

        // Check Edge enterprise policies
        if let Ok(edge_output) = Command::new("reg")
            .args([
                "query",
                r"HKLM\SOFTWARE\Policies\Microsoft\Edge",
            ])
            .output()
        {
            if edge_output.status.success() {
                managed_browsers.push("Microsoft Edge".to_string());
                policy_sources.push("Registry (HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge)".to_string());
                let edge_raw = String::from_utf8_lossy(&edge_output.stdout).to_string();
                raw_output.push_str(&format!("=== Edge Policies ===\n{}\n", edge_raw.trim()));
            }
        }

        let policies_configured = !managed_browsers.is_empty();

        Ok(BrowserSecurityStatus {
            policies_configured,
            safe_browsing_enabled,
            managed_browsers,
            policy_sources,
            raw_output,
        })
    }

    /// Check browser security on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<BrowserSecurityStatus> {
        debug!("Checking Linux browser security policies");

        let mut raw_output = String::new();
        let mut managed_browsers = Vec::new();
        let mut policy_sources = Vec::new();

        // Check Chrome managed policies directory
        let chrome_policy_dir = "/etc/opt/chrome/policies/managed/";
        let chrome_policies_exist = std::path::Path::new(chrome_policy_dir).exists();
        raw_output.push_str(&format!(
            "Chrome policies dir ({}) exists: {}\n",
            chrome_policy_dir, chrome_policies_exist
        ));

        if chrome_policies_exist {
            managed_browsers.push("Google Chrome".to_string());
            policy_sources.push(chrome_policy_dir.to_string());

            // List policy files
            if let Ok(entries) = std::fs::read_dir(chrome_policy_dir) {
                for entry in entries.flatten() {
                    raw_output.push_str(&format!(
                        "  Chrome policy file: {}\n",
                        entry.path().display()
                    ));
                }
            }
        }

        // Check Firefox managed policies
        let firefox_policy_path = "/usr/lib/firefox/distribution/policies.json";
        let firefox_policies_exist = std::path::Path::new(firefox_policy_path).exists();
        raw_output.push_str(&format!(
            "Firefox policies ({}) exists: {}\n",
            firefox_policy_path, firefox_policies_exist
        ));

        if firefox_policies_exist {
            managed_browsers.push("Firefox".to_string());
            policy_sources.push(firefox_policy_path.to_string());
        }

        // Also check Chromium policies
        let chromium_policy_dir = "/etc/chromium/policies/managed/";
        let chromium_policies_exist = std::path::Path::new(chromium_policy_dir).exists();
        raw_output.push_str(&format!(
            "Chromium policies dir ({}) exists: {}\n",
            chromium_policy_dir, chromium_policies_exist
        ));

        if chromium_policies_exist {
            managed_browsers.push("Chromium".to_string());
            policy_sources.push(chromium_policy_dir.to_string());
        }

        let policies_configured = !managed_browsers.is_empty();

        Ok(BrowserSecurityStatus {
            policies_configured,
            safe_browsing_enabled: None,
            managed_browsers,
            policy_sources,
            raw_output,
        })
    }

    /// Check browser security on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<BrowserSecurityStatus> {
        debug!("Checking macOS browser security settings");

        let mut raw_output = String::new();
        let mut managed_browsers = Vec::new();
        let mut policy_sources = Vec::new();
        let mut safe_browsing_enabled = None;

        // Check Chrome SafeBrowsingEnabled preference
        let chrome_output = Command::new("defaults")
            .args(["read", "com.google.Chrome", "SafeBrowsingEnabled"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!(
                    "Failed to read Chrome preferences: {}",
                    e
                ))
            })?;

        let chrome_raw = String::from_utf8_lossy(&chrome_output.stdout).to_string();
        let chrome_stderr = String::from_utf8_lossy(&chrome_output.stderr).to_string();
        raw_output.push_str(&format!(
            "=== Chrome SafeBrowsingEnabled ===\nstdout: {}\nstderr: {}\n",
            chrome_raw.trim(),
            chrome_stderr.trim()
        ));

        if chrome_output.status.success() {
            managed_browsers.push("Google Chrome".to_string());
            policy_sources.push("defaults (com.google.Chrome)".to_string());
            safe_browsing_enabled = Some(chrome_raw.trim() == "1");
        }

        // Check for Chrome managed preferences directory
        let chrome_managed_dir = "/Library/Managed Preferences/com.google.Chrome.plist";
        let managed_prefs_exist = std::path::Path::new(chrome_managed_dir).exists();
        raw_output.push_str(&format!(
            "Chrome managed prefs ({}) exists: {}\n",
            chrome_managed_dir, managed_prefs_exist
        ));

        if managed_prefs_exist && !managed_browsers.contains(&"Google Chrome".to_string()) {
            managed_browsers.push("Google Chrome".to_string());
            policy_sources.push(chrome_managed_dir.to_string());
        }

        // Check Safari managed preferences
        let safari_managed = "/Library/Managed Preferences/com.apple.Safari.plist";
        let safari_managed_exists = std::path::Path::new(safari_managed).exists();
        raw_output.push_str(&format!(
            "Safari managed prefs ({}) exists: {}\n",
            safari_managed, safari_managed_exists
        ));

        if safari_managed_exists {
            managed_browsers.push("Safari".to_string());
            policy_sources.push(safari_managed.to_string());
        }

        let policies_configured = !managed_browsers.is_empty();

        Ok(BrowserSecurityStatus {
            policies_configured,
            safe_browsing_enabled,
            managed_browsers,
            policy_sources,
            raw_output,
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<BrowserSecurityStatus> {
        Ok(BrowserSecurityStatus {
            policies_configured: false,
            safe_browsing_enabled: None,
            managed_browsers: vec![],
            policy_sources: vec![],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for BrowserSecurityCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for BrowserSecurityCheck {
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

        if status.policies_configured {
            let browser_list = status.managed_browsers.join(", ");
            let sb_info = match status.safe_browsing_enabled {
                Some(true) => ", Safe Browsing: enabled",
                Some(false) => ", Safe Browsing: disabled",
                None => "",
            };

            Ok(CheckOutput::pass(
                format!(
                    "Browser security policies configured for: {}{}",
                    browser_list, sb_info
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                "No browser security policies detected. Consider deploying managed browser policies".to_string(),
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
        let check = BrowserSecurityCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::BrowserSecurity);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = BrowserSecurityCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS".to_string()));
    }

    #[test]
    fn test_browser_security_status_serialization() {
        let status = BrowserSecurityStatus {
            policies_configured: true,
            safe_browsing_enabled: Some(true),
            managed_browsers: vec!["Google Chrome".to_string()],
            policy_sources: vec!["Registry".to_string()],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"policies_configured\":true"));
        assert!(json.contains("Google Chrome"));

        let parsed: BrowserSecurityStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.policies_configured);
        assert_eq!(parsed.safe_browsing_enabled, Some(true));
        assert_eq!(parsed.managed_browsers.len(), 1);
    }

    #[test]
    fn test_no_policies_status() {
        let status = BrowserSecurityStatus {
            policies_configured: false,
            safe_browsing_enabled: None,
            managed_browsers: vec![],
            policy_sources: vec![],
            raw_output: String::new(),
        };

        assert!(!status.policies_configured);
        assert!(status.managed_browsers.is_empty());
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = BrowserSecurityCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
