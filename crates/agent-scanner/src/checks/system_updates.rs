//! System updates compliance check.
//!
//! Verifies system updates are current:
//! - Windows: Windows Update status
//! - Linux: apt/yum/dnf package manager status
//! - macOS: softwareupdate

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;
#[cfg(target_os = "macos")]
use tracing::warn;

/// Check ID for system updates.
pub const CHECK_ID: &str = "patches_current";

/// Maximum days security updates can be pending before non-compliance.
const MAX_PENDING_DAYS: i64 = 7;

/// Timeout for external update check commands (macOS softwareupdate, etc.).
#[cfg(target_os = "macos")]
const UPDATE_CMD_TIMEOUT_SECS: u64 = 30;

/// System updates status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemUpdatesStatus {
    /// Whether system is up to date (no pending security updates).
    pub up_to_date: bool,

    /// Last time update check was performed.
    pub last_check_date: Option<DateTime<Utc>>,

    /// Last time updates were installed.
    pub last_install_date: Option<DateTime<Utc>>,

    /// Total number of pending updates.
    pub pending_updates_count: u32,

    /// Number of pending security updates.
    pub pending_security_updates: u32,

    /// Number of upgradable packages (Linux).
    pub upgradable_packages: u32,

    /// Package manager detected (Linux).
    #[serde(default)]
    pub package_manager: Option<String>,

    /// Whether automatic updates are enabled.
    pub auto_updates_enabled: Option<bool>,

    /// Days since last update check.
    pub days_since_check: Option<i64>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// System updates compliance check.
pub struct SystemUpdatesCheck {
    definition: CheckDefinition,
}

impl SystemUpdatesCheck {
    /// Create a new system updates check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("System Updates")
            .description("Verify system updates are current (security updates < 7 days)")
            .category(CheckCategory::Updates)
            .severity(CheckSeverity::High)
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
            .nfr_limit(30_000) // 30s NFR limit for I/O heavy update check
            .build();

        Self { definition }
    }

    /// Check system updates on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<SystemUpdatesStatus> {
        debug!("Checking Windows Update status");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Get Windows Update service status
                $wuService = Get-Service -Name wuauserv -ErrorAction SilentlyContinue
                if ($wuService) {
                    $results['ServiceStatus'] = $wuService.Status.ToString()
                }

                # Try to get update history
                try {
                    $session = New-Object -ComObject Microsoft.Update.Session
                    $searcher = $session.CreateUpdateSearcher()

                    # Get last search date
                    $results['LastSearchSuccessDate'] = $searcher.GetTotalHistoryCount()

                    # Search for pending updates
                    $searchResult = $searcher.Search("IsInstalled=0")
                    $results['PendingUpdatesCount'] = $searchResult.Updates.Count

                    $securityCount = 0
                    foreach ($update in $searchResult.Updates) {
                        foreach ($category in $update.Categories) {
                            if ($category.Name -like "*Security*") {
                                $securityCount++
                                break
                            }
                        }
                    }
                    $results['PendingSecurityUpdates'] = $securityCount

                    # Get last installed update date
                    $history = $searcher.QueryHistory(0, 10)
                    if ($history.Count -gt 0) {
                        $results['LastInstallDate'] = $history[0].Date.ToString("o")
                    }
                } catch {
                    $results['Error'] = $_.Exception.Message
                }

                # Check auto-update settings
                $au = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue)
                if ($au) {
                    $results['AUOptions'] = $au.AUOptions
                    $results['NoAutoUpdate'] = $au.NoAutoUpdate
                }

                $results | ConvertTo-Json -Depth 3
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: Some("Windows Update".to_string()),
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // Pending updates
            if let Some(count) = json.get("PendingUpdatesCount").and_then(|v| v.as_u64()) {
                status.pending_updates_count = count as u32;
            }

            if let Some(count) = json.get("PendingSecurityUpdates").and_then(|v| v.as_u64()) {
                status.pending_security_updates = count as u32;
            }

            // Last install date
            if let Some(date_str) = json.get("LastInstallDate").and_then(|v| v.as_str()) {
                if let Ok(date) = DateTime::parse_from_rfc3339(date_str) {
                    status.last_install_date = Some(date.with_timezone(&Utc));
                }
            }

            // Auto-update settings
            if let Some(no_auto) = json.get("NoAutoUpdate").and_then(|v| v.as_u64()) {
                status.auto_updates_enabled = Some(no_auto == 0);
            }
        }

        // Determine if up to date
        status.up_to_date = status.pending_security_updates == 0;

        // Calculate days since last install
        if let Some(install_date) = status.last_install_date {
            let days = (Utc::now() - install_date).num_days();
            status.days_since_check = Some(days);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check system updates on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<SystemUpdatesStatus> {
        debug!("Checking Linux package updates");

        let mut status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Try apt (Debian/Ubuntu)
        if self.check_apt(&mut status) {
            // apt found and processed
        }
        // Try dnf (Fedora/RHEL 8+)
        else if self.check_dnf(&mut status) {
            // dnf found and processed
        }
        // Try yum (RHEL/CentOS 7)
        else if self.check_yum(&mut status) {
            // yum found and processed
        }

        // Determine if up to date
        status.up_to_date = status.pending_security_updates == 0;

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "linux")]
    fn check_apt(&self, status: &mut SystemUpdatesStatus) -> bool {
        // Check if apt is available
        let apt_check = Command::new("which").args(["apt"]).output();

        if apt_check.is_err() || !apt_check.unwrap().status.success() {
            return false;
        }

        status.package_manager = Some("apt".to_string());

        // Get last update time
        if let Ok(metadata) = std::fs::metadata("/var/lib/apt/periodic/update-stamp") {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.elapsed() {
                    let days = duration.as_secs() / 86400;
                    status.days_since_check = Some(days as i64);
                }
            }
        } else if let Ok(metadata) = std::fs::metadata("/var/cache/apt/pkgcache.bin") {
            if let Ok(modified) = metadata.modified() {
                status.last_check_date = modified
                    .duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| DateTime::from_timestamp(d.as_secs() as i64, 0))
                    .flatten();

                if let Ok(duration) = modified.elapsed() {
                    let days = duration.as_secs() / 86400;
                    status.days_since_check = Some(days as i64);
                }
            }
        }

        // Check upgradable packages (doesn't require sudo)
        if let Ok(output) = Command::new("apt").args(["list", "--upgradable"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== apt list --upgradable ===\n{}\n", result));

            // Count upgradable packages (exclude header line)
            let upgradable: u32 =
                result.lines().filter(|l| l.contains("upgradable")).count() as u32;
            status.upgradable_packages = upgradable;
            status.pending_updates_count = upgradable;

            // Count security updates
            let security: u32 = result
                .lines()
                .filter(|l| l.to_lowercase().contains("security"))
                .count() as u32;
            status.pending_security_updates = security;
        }

        // Check unattended-upgrades status
        if let Ok(content) = std::fs::read_to_string("/etc/apt/apt.conf.d/20auto-upgrades") {
            status
                .raw_output
                .push_str(&format!("=== 20auto-upgrades ===\n{}\n", content));

            status.auto_updates_enabled = Some(
                content.contains("APT::Periodic::Unattended-Upgrade \"1\"")
                    || content.contains("Unattended-Upgrade \"1\""),
            );
        }

        true
    }

    #[cfg(target_os = "linux")]
    fn check_dnf(&self, status: &mut SystemUpdatesStatus) -> bool {
        let dnf_check = Command::new("which").args(["dnf"]).output();

        if dnf_check.is_err() || !dnf_check.unwrap().status.success() {
            return false;
        }

        status.package_manager = Some("dnf".to_string());

        // Check for available updates
        if let Ok(output) = Command::new("dnf").args(["check-update", "-q"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== dnf check-update ===\n{}\n", result));

            // Count lines (each non-empty line is an update)
            let updates: u32 = result.lines().filter(|l| !l.trim().is_empty()).count() as u32;
            status.pending_updates_count = updates;
            status.upgradable_packages = updates;
        }

        // Check for security updates
        if let Ok(output) = Command::new("dnf")
            .args(["updateinfo", "list", "security", "-q"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== dnf security updates ===\n{}\n", result));

            let security: u32 = result.lines().filter(|l| !l.trim().is_empty()).count() as u32;
            status.pending_security_updates = security;
        }

        // Check dnf-automatic status
        if let Ok(output) = Command::new("systemctl")
            .args(["is-enabled", "dnf-automatic.timer"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.auto_updates_enabled = Some(result.trim() == "enabled");
        }

        true
    }

    #[cfg(target_os = "linux")]
    fn check_yum(&self, status: &mut SystemUpdatesStatus) -> bool {
        let yum_check = Command::new("which").args(["yum"]).output();

        if yum_check.is_err() || !yum_check.unwrap().status.success() {
            return false;
        }

        status.package_manager = Some("yum".to_string());

        // Check for available updates
        if let Ok(output) = Command::new("yum").args(["check-update", "-q"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== yum check-update ===\n{}\n", result));

            let updates: u32 = result
                .lines()
                .filter(|l| !l.trim().is_empty() && !l.starts_with("Obsoleting"))
                .count() as u32;
            status.pending_updates_count = updates;
            status.upgradable_packages = updates;
        }

        // Check for security updates
        if let Ok(output) = Command::new("yum")
            .args(["updateinfo", "list", "security", "-q"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== yum security updates ===\n{}\n", result));

            let security: u32 = result.lines().filter(|l| !l.trim().is_empty()).count() as u32;
            status.pending_security_updates = security;
        }

        true
    }

    /// Check system updates on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<SystemUpdatesStatus> {
        debug!("Checking macOS software updates");

        let mut status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: Some("softwareupdate".to_string()),
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // List available updates (with timeout — softwareupdate can be very slow)
        let timeout_duration = std::time::Duration::from_secs(UPDATE_CMD_TIMEOUT_SECS);
        let su_result = tokio::time::timeout(
            timeout_duration,
            tokio::process::Command::new("softwareupdate")
                .args(["--list"])
                .output(),
        )
        .await;

        match su_result {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                status.raw_output.push_str(&format!(
                    "=== softwareupdate --list ===\n{}\n{}\n",
                    stdout, stderr
                ));

                // Count updates (lines starting with * or containing "Label:")
                let combined = format!("{}{}", stdout, stderr);
                let updates: u32 = combined
                    .lines()
                    .filter(|l| l.trim().starts_with('*') || l.contains("Label:"))
                    .count() as u32;
                status.pending_updates_count = updates;
                status.upgradable_packages = updates;

                // Check for security updates
                let security: u32 = combined
                    .lines()
                    .filter(|l| l.to_lowercase().contains("security"))
                    .count() as u32;
                status.pending_security_updates = security;

                // Check if "No new software available" message
                if combined.contains("No new software available") {
                    status.pending_updates_count = 0;
                    status.pending_security_updates = 0;
                }
            }
            Ok(Err(e)) => {
                warn!("softwareupdate command failed: {}", e);
                status
                    .raw_output
                    .push_str(&format!("softwareupdate error: {}\n", e));
            }
            Err(_) => {
                warn!(
                    "softwareupdate --list timed out after {}s",
                    UPDATE_CMD_TIMEOUT_SECS
                );
                status.raw_output.push_str(&format!(
                    "softwareupdate --list timed out after {}s\n",
                    UPDATE_CMD_TIMEOUT_SECS
                ));
            }
        }

        // Check auto-update settings (fast command, no timeout needed)
        if let Ok(output) = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.SoftwareUpdate",
                "AutomaticCheckEnabled",
            ])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("AutomaticCheckEnabled: {}\n", result.trim()));
            status.auto_updates_enabled = Some(result.trim() == "1");
        }

        // Get last check date (fast command, no timeout needed)
        if let Ok(output) = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.SoftwareUpdate",
                "LastSuccessfulDate",
            ])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("LastSuccessfulDate: {}\n", result.trim()));
        }

        // Determine if up to date
        status.up_to_date = status.pending_security_updates == 0;

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<SystemUpdatesStatus> {
        Ok(SystemUpdatesStatus {
            up_to_date: false,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &SystemUpdatesStatus) -> Vec<String> {
        let mut issues = Vec::new();

        // Check for pending security updates
        if status.pending_security_updates > 0 {
            issues.push(format!(
                "{} security update(s) pending installation",
                status.pending_security_updates
            ));
        }

        // Check if updates haven't been checked recently
        if let Some(days) = status.days_since_check
            && days > MAX_PENDING_DAYS
        {
            issues.push(format!(
                "Updates not checked for {} days (max: {} days)",
                days, MAX_PENDING_DAYS
            ));
        }

        issues
    }
}

impl Default for SystemUpdatesCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for SystemUpdatesCheck {
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

        if status.compliant {
            let mut details = Vec::new();
            if let Some(pm) = &status.package_manager {
                details.push(format!("manager={}", pm));
            }
            if status.pending_updates_count == 0 {
                details.push("no_pending_updates".to_string());
            }
            if let Some(true) = status.auto_updates_enabled {
                details.push("auto_updates=enabled".to_string());
            }

            Ok(CheckOutput::pass(
                format!("System is up to date: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("System updates issues: {}", status.issues.join("; ")),
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
        let check = SystemUpdatesCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Updates);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = SystemUpdatesCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_system_updates_status_serialization() {
        let status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: Some(Utc::now()),
            last_install_date: Some(Utc::now()),
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: Some("apt".to_string()),
            auto_updates_enabled: Some(true),
            days_since_check: Some(1),
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"up_to_date\":true"));
        assert!(json.contains("\"pending_updates_count\":0"));

        let parsed: SystemUpdatesStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.up_to_date);
        assert_eq!(parsed.package_manager, Some("apt".to_string()));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = SystemUpdatesCheck::new();
        let status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 5,
            pending_security_updates: 0,
            upgradable_packages: 5,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: Some(1),
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_security_updates() {
        let check = SystemUpdatesCheck::new();
        let status = SystemUpdatesStatus {
            up_to_date: false,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 10,
            pending_security_updates: 3,
            upgradable_packages: 10,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("security update")));
    }

    #[test]
    fn test_compliance_check_fail_old_check() {
        let check = SystemUpdatesCheck::new();
        let status = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 0,
            pending_security_updates: 0,
            upgradable_packages: 0,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: Some(14), // > 7 days
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("not checked")));
    }

    #[test]
    fn test_up_to_date_determination() {
        let status_up_to_date = SystemUpdatesStatus {
            up_to_date: true,
            last_check_date: None,
            last_install_date: None,
            pending_updates_count: 10,
            pending_security_updates: 0, // No security updates
            upgradable_packages: 10,
            package_manager: None,
            auto_updates_enabled: None,
            days_since_check: None,
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        // Non-security updates don't affect "up to date" status
        assert!(status_up_to_date.up_to_date);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = SystemUpdatesCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
