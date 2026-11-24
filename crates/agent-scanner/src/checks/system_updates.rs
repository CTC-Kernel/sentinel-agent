// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! System updates compliance check.
//!
//! Verifies system updates are current:
//! - Windows: Windows Update status
//! - Linux: apt/yum/dnf package manager status
//! - macOS: softwareupdate

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
#[cfg(target_os = "macos")]
use agent_common::process::silent_async_command;
use agent_common::process::silent_command;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
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

/// What `softwareupdate --list` reported.
#[cfg(any(target_os = "macos", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SoftwareUpdateList {
    /// Updates offered.
    pub pending: u32,
    /// Lines of the listing that mention security.
    pub security: u32,
    /// What the command printed, standard output then standard error.
    pub raw: String,
}

/// Read the listing of `softwareupdate --list`.
///
/// The command writes the updates on one stream and its progress and its
/// "No new software available." on the other, and which is which changed
/// between macOS versions: both are read. `None` when the listing says
/// neither that updates exist nor that there are none (no network, catalog
/// unreachable, empty output): nothing was measured.
#[cfg(any(target_os = "macos", test))]
pub(crate) fn parse_softwareupdate_list(stdout: &str, stderr: &str) -> Option<SoftwareUpdateList> {
    let raw = format!("{}\n{}", stdout, stderr);
    let count = |keep: &dyn Fn(&str) -> bool| -> u32 {
        raw.lines()
            .filter(|l| keep(l))
            .count()
            .min(u32::MAX as usize) as u32
    };

    if raw.contains("No new software available") {
        return Some(SoftwareUpdateList {
            pending: 0,
            security: 0,
            raw,
        });
    }

    // One entry per update: "* Label: ..." (or "* name" before macOS 10.15).
    let pending = count(&|l| l.trim().starts_with('*') || l.contains("Label:"));
    if pending == 0 {
        return None;
    }
    let security = count(&|l| l.to_lowercase().contains("security"));
    Some(SoftwareUpdateList {
        pending,
        security,
        raw,
    })
}

/// Ask macOS for the pending updates. An error when the command cannot be
/// run, does not answer in time or answers nothing usable: the caller must
/// not report a system it could not question as up to date.
#[cfg(target_os = "macos")]
pub(crate) async fn softwareupdate_list() -> ScannerResult<SoftwareUpdateList> {
    let timeout_duration = std::time::Duration::from_secs(UPDATE_CMD_TIMEOUT_SECS);
    let output = tokio::time::timeout(
        timeout_duration,
        silent_async_command("softwareupdate")
            .args(["--list"])
            .output(),
    )
    .await
    .map_err(|_| {
        warn!(
            "softwareupdate --list timed out after {}s",
            UPDATE_CMD_TIMEOUT_SECS
        );
        ScannerError::CheckExecution(format!(
            "softwareupdate --list timed out after {}s: pending updates unknown",
            UPDATE_CMD_TIMEOUT_SECS
        ))
    })?
    .map_err(|e| {
        warn!("softwareupdate command failed: {}", e);
        ScannerError::CheckExecution(format!("Failed to run softwareupdate: {}", e))
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_softwareupdate_list(&stdout, &stderr).ok_or_else(|| {
        warn!(
            "softwareupdate --list gave no usable answer ({})",
            output.status
        );
        ScannerError::CheckExecution(format!(
            "softwareupdate --list gave no usable answer ({}): pending updates unknown",
            output.status
        ))
    })
}

/// Why the Windows Update search produced no count, or `None` when it did.
/// The script catches a failed search (service stopped, no access to the
/// update server) and reports it under `Error` without any count.
#[cfg(any(target_os = "windows", test))]
fn windows_search_failure(json: &serde_json::Value) -> Option<String> {
    if json
        .get("PendingUpdatesCount")
        .and_then(|v| v.as_u64())
        .is_some()
    {
        return None;
    }
    Some(
        json.get("Error")
            .and_then(|v| v.as_str())
            .unwrap_or("the update search returned no count")
            .to_string(),
    )
}

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
            .framework("HDS")
            .framework("ANSSI_HYGIENE")
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

        let output = silent_command("powershell")
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

                    # Get last search date from registry if possible
                    $lastSearch = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Detect" -Name LastSuccessTime -ErrorAction SilentlyContinue
                    if ($lastSearch) {
                        $results['LastSearchSuccessDate'] = $lastSearch.LastSuccessTime
                    }

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

                # Check auto-update settings (check both GPO and standard paths)
                $au = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue)
                if (!$au) {
                    $au = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\AU' -ErrorAction SilentlyContinue)
                }

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

        // No readable answer, or a search that failed: the pending updates
        // are unknown, which is not "none pending".
        let answer = serde_json::from_str::<serde_json::Value>(&raw_output).map_err(|e| {
            ScannerError::CheckExecution(format!(
                "Windows Update status could not be read ({}): {}",
                output.status, e
            ))
        })?;
        if let Some(reason) = windows_search_failure(&answer) {
            return Err(ScannerError::CheckExecution(format!(
                "Windows Update search failed: {}",
                reason
            )));
        }

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
                status.pending_updates_count = u32::try_from(count).unwrap_or(u32::MAX);
            }

            if let Some(count) = json.get("PendingSecurityUpdates").and_then(|v| v.as_u64()) {
                status.pending_security_updates = u32::try_from(count).unwrap_or(u32::MAX);
            }

            // Last install date
            if let Some(date_str) = json.get("LastInstallDate").and_then(|v| v.as_str())
                && let Ok(date) = DateTime::parse_from_rfc3339(date_str)
            {
                status.last_install_date = Some(date.with_timezone(&Utc));
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
        let Ok(apt_output) = silent_command("which").args(["apt"]).output() else {
            return false;
        };
        if !apt_output.status.success() {
            return false;
        }

        status.package_manager = Some("apt".to_string());

        // Get last update time
        if let Ok(metadata) = std::fs::metadata("/var/lib/apt/periodic/update-stamp") {
            if let Ok(modified) = metadata.modified()
                && let Ok(duration) = modified.elapsed()
            {
                let days = duration.as_secs() / agent_common::constants::SECS_PER_DAY;
                status.days_since_check = Some(days as i64);
            }
        } else if let Ok(metadata) = std::fs::metadata("/var/cache/apt/pkgcache.bin")
            && let Ok(modified) = metadata.modified()
        {
            status.last_check_date = modified
                .duration_since(std::time::UNIX_EPOCH)
                .ok()
                .and_then(|d| DateTime::from_timestamp(d.as_secs() as i64, 0));

            if let Ok(duration) = modified.elapsed() {
                let days = duration.as_secs() / agent_common::constants::SECS_PER_DAY;
                status.days_since_check = Some(days as i64);
            }
        }

        // Check upgradable packages (doesn't require sudo)
        if let Ok(output) = silent_command("apt")
            .args(["list", "--upgradable"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== apt list --upgradable ===\n{}\n", result));

            // Count upgradable packages (exclude header line)
            let upgradable: u32 = result
                .lines()
                .filter(|l| l.contains("upgradable"))
                .count()
                .min(u32::MAX as usize) as u32;
            status.upgradable_packages = upgradable;
            status.pending_updates_count = upgradable;

            // Count security updates
            let security: u32 = result
                .lines()
                .filter(|l| l.to_lowercase().contains("security"))
                .count()
                .min(u32::MAX as usize) as u32;
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
        let Ok(dnf_output) = silent_command("which").args(["dnf"]).output() else {
            return false;
        };
        if !dnf_output.status.success() {
            return false;
        }

        status.package_manager = Some("dnf".to_string());

        // Check for available updates
        if let Ok(output) = silent_command("dnf").args(["check-update", "-q"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== dnf check-update ===\n{}\n", result));

            // Count lines (each non-empty line is an update)
            let updates: u32 = result
                .lines()
                .filter(|l| !l.trim().is_empty())
                .count()
                .min(u32::MAX as usize) as u32;
            status.pending_updates_count = updates;
            status.upgradable_packages = updates;
        }

        // Check for security updates
        if let Ok(output) = silent_command("dnf")
            .args(["updateinfo", "list", "security", "-q"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== dnf security updates ===\n{}\n", result));

            let security: u32 = result
                .lines()
                .filter(|l| !l.trim().is_empty())
                .count()
                .min(u32::MAX as usize) as u32;
            status.pending_security_updates = security;
        }

        // Check dnf-automatic status
        if let Ok(output) = silent_command("systemctl")
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
        let Ok(yum_output) = silent_command("which").args(["yum"]).output() else {
            return false;
        };
        if !yum_output.status.success() {
            return false;
        }

        status.package_manager = Some("yum".to_string());

        // Check for available updates
        if let Ok(output) = silent_command("yum").args(["check-update", "-q"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== yum check-update ===\n{}\n", result));

            let updates: u32 = result
                .lines()
                .filter(|l| !l.trim().is_empty() && !l.starts_with("Obsoleting"))
                .count()
                .min(u32::MAX as usize) as u32;
            status.pending_updates_count = updates;
            status.upgradable_packages = updates;
        }

        // Check for security updates
        if let Ok(output) = silent_command("yum")
            .args(["updateinfo", "list", "security", "-q"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== yum security updates ===\n{}\n", result));

            let security: u32 = result
                .lines()
                .filter(|l| !l.trim().is_empty())
                .count()
                .min(u32::MAX as usize) as u32;
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

        // List available updates (with timeout — softwareupdate can be very
        // slow). A listing that could not be obtained is an error, never a
        // system reported as up to date.
        let listing = softwareupdate_list().await?;
        status
            .raw_output
            .push_str(&format!("=== softwareupdate --list ===\n{}\n", listing.raw));
        status.pending_updates_count = listing.pending;
        status.upgradable_packages = listing.pending;
        status.pending_security_updates = listing.security;

        // Check auto-update settings (fast command, no timeout needed)
        if let Ok(output) = silent_command("defaults")
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
        if let Ok(output) = silent_command("defaults")
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

        // Linux without apt, dnf or yum (pacman, zypper, apk, an immutable
        // image): nothing was asked, so nothing can be said.
        #[cfg(target_os = "linux")]
        if status.package_manager.is_none() {
            return Ok(CheckOutput::not_applicable(
                "No supported package manager (apt, dnf, yum): pending updates were not measured",
                raw_data,
            ));
        }

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

        // Without network or in time, the update tool may give no answer.
        // That must be an explicit error, not a passing result.
        match check.execute().await {
            Ok(output) => assert!(!output.message.is_empty()),
            Err(crate::error::ScannerError::CheckExecution(message)) => {
                assert!(!message.is_empty())
            }
            Err(error) => panic!("Unexpected check error: {error}"),
        }
    }

    #[test]
    fn softwareupdate_without_an_answer_is_not_measured() {
        // Offline: only the progress line, on either stream.
        assert_eq!(parse_softwareupdate_list("", ""), None);
        assert_eq!(
            parse_softwareupdate_list(
                "Software Update Tool\n\nFinding available software\n",
                "Can't connect to the Apple Software Update server.\n"
            ),
            None
        );
    }

    #[test]
    fn softwareupdate_listing_is_read_on_both_streams() {
        let none = "No new software available.\n";
        let progress = "Software Update Tool\n\nFinding available software\n";
        for (stdout, stderr) in [(progress, none), (none, progress)] {
            let listing = parse_softwareupdate_list(stdout, stderr).unwrap();
            assert_eq!((listing.pending, listing.security), (0, 0));
        }

        let found = "Software Update found the following new or updated software:\n\
            * Label: Safari18.1-18.1\n\
            \tTitle: Safari, Version: 18.1, Size: 150000KiB, Recommended: YES,\n\
            * Label: Security Response 15.1 (a)\n\
            \tTitle: Security Response, Version: 15.1, Size: 9000KiB, Recommended: YES,\n";
        for (stdout, stderr) in [(found, progress), (progress, found)] {
            let listing = parse_softwareupdate_list(stdout, stderr).unwrap();
            assert_eq!(listing.pending, 2);
            assert!(listing.security >= 1);
        }
    }

    #[test]
    fn a_failed_windows_search_is_not_zero_pending_updates() {
        let failed = serde_json::json!({ "ServiceStatus": "Stopped", "Error": "0x8024402C" });
        assert_eq!(
            windows_search_failure(&failed),
            Some("0x8024402C".to_string())
        );
        assert!(windows_search_failure(&serde_json::json!({})).is_some());

        let measured = serde_json::json!({ "PendingUpdatesCount": 0 });
        assert_eq!(windows_search_failure(&measured), None);
    }
}
