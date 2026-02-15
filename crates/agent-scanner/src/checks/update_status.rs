//! Windows Update status compliance check.
//!
//! Comprehensive update management verification:
//! - Last update installation date
//! - Pending updates count and severity
//! - Windows Update service status
//! - WSUS configuration
//! - Reboot pending status
//! - Update policy compliance

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// Check ID for update status.
pub const UPDATE_STATUS_CHECK_ID: &str = "update_status";

/// Maximum days since last system update before flagging non-compliance.
#[cfg(any(target_os = "windows", target_os = "linux"))]
const MAX_DAYS_SINCE_UPDATE: i64 = 30;

/// Maximum total pending updates before flagging non-compliance.
#[cfg(any(target_os = "windows", target_os = "linux"))]
const MAX_TOTAL_PENDING: usize = 10;

/// Maximum critical pending updates before flagging non-compliance.
#[cfg(target_os = "windows")]
const MAX_CRITICAL_PENDING: usize = 0;

/// Pending update information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub title: String,
    pub kb_article: Option<String>,
    pub severity: String,
    pub category: String,
    pub size_mb: Option<f64>,
    pub published_date: Option<DateTime<Utc>>,
}

/// Update history entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateHistoryEntry {
    pub title: String,
    pub kb_article: Option<String>,
    pub installed_on: DateTime<Utc>,
    pub result: String,
}

/// Windows Update service status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateServiceStatus {
    pub service_running: bool,
    pub start_type: String,
    pub last_check_time: Option<DateTime<Utc>>,
    pub wsus_server: Option<String>,
    pub auto_update_enabled: bool,
    pub auto_update_day: Option<String>,
    pub auto_update_time: Option<String>,
}

/// Comprehensive update status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub compliant: bool,
    pub compliance_score: f32,
    pub last_update_date: Option<DateTime<Utc>>,
    pub days_since_last_update: Option<i64>,
    pub pending_updates: Vec<PendingUpdate>,
    pub critical_pending_count: usize,
    pub important_pending_count: usize,
    pub moderate_pending_count: usize,
    pub total_pending_count: usize,
    pub reboot_required: bool,
    pub reboot_pending_since: Option<DateTime<Utc>>,
    pub service_status: UpdateServiceStatus,
    pub recent_history: Vec<UpdateHistoryEntry>,
    #[serde(default)]
    pub issues: Vec<String>,
}

/// Update status compliance check.
pub struct UpdateStatusCheck {
    definition: CheckDefinition,
}

impl UpdateStatusCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(UPDATE_STATUS_CHECK_ID)
            .name("Update Management Status")
            .description(
                "Verify Windows Update status: last update within 30 days, \
                 no critical updates pending, reboot status, update service health",
            )
            .category(CheckCategory::Updates)
            .severity(CheckSeverity::Critical)
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
            .nfr_limit(10_000)
            .build();

        Self { definition }
    }

    #[cfg(target_os = "windows")]
    async fn check_update_status(&self) -> ScannerResult<UpdateStatus> {
        let mut issues = Vec::new();

        // Get Windows Update service status
        let service_status = self.get_service_status().await;

        // Get last update date and history
        let (last_update, history) = self.get_update_history().await;

        // Calculate days since last update
        let days_since = last_update.map(|d| {
            let now = Utc::now();
            (now - d).num_days()
        });

        if let Some(days) = days_since {
            if days > MAX_DAYS_SINCE_UPDATE {
                issues.push(format!(
                    "Last update was {} days ago (max: {} days)",
                    days, MAX_DAYS_SINCE_UPDATE
                ));
            }
        } else {
            issues.push("Could not determine last update date".to_string());
        }

        // Get pending updates
        let pending = self.get_pending_updates().await;

        let critical_count = pending
            .iter()
            .filter(|u| u.severity.eq_ignore_ascii_case("critical"))
            .count();
        let important_count = pending
            .iter()
            .filter(|u| u.severity.eq_ignore_ascii_case("important"))
            .count();
        let moderate_count = pending
            .iter()
            .filter(|u| u.severity.eq_ignore_ascii_case("moderate"))
            .count();

        if critical_count > MAX_CRITICAL_PENDING {
            issues.push(format!("{} critical updates pending", critical_count));
        }

        if pending.len() > MAX_TOTAL_PENDING {
            issues.push(format!(
                "{} total updates pending (max: {})",
                pending.len(),
                MAX_TOTAL_PENDING
            ));
        }

        // Check reboot status
        let (reboot_required, reboot_since) = self.check_reboot_pending().await;

        if reboot_required {
            issues.push("System reboot required to complete updates".to_string());
            if let Some(since) = reboot_since {
                let days = (Utc::now() - since).num_days();
                if days > 3 {
                    issues.push(format!("Reboot pending for {} days", days));
                }
            }
        }

        // Check service status
        if !service_status.service_running {
            issues.push("Windows Update service is not running".to_string());
        }

        if !service_status.auto_update_enabled {
            issues.push("Automatic updates are disabled".to_string());
        }

        // Calculate compliance score
        let mut score = 100.0;
        if critical_count > 0 {
            score -= 30.0;
        }
        if important_count > 5 {
            score -= 20.0;
        }
        if let Some(days) = days_since {
            if days > MAX_DAYS_SINCE_UPDATE {
                score -= (days - MAX_DAYS_SINCE_UPDATE).min(30) as f32;
            }
        }
        if reboot_required {
            score -= 10.0;
        }
        if !service_status.service_running {
            score -= 20.0;
        }
        score = score.max(0.0);

        let compliant = issues.is_empty() && score >= 80.0;

        Ok(UpdateStatus {
            compliant,
            compliance_score: score,
            last_update_date: last_update,
            days_since_last_update: days_since,
            pending_updates: pending.clone(),
            critical_pending_count: critical_count,
            important_pending_count: important_count,
            moderate_pending_count: moderate_count,
            total_pending_count: pending.len(),
            reboot_required,
            reboot_pending_since: reboot_since,
            service_status,
            recent_history: history,
            issues,
        })
    }

    #[cfg(target_os = "windows")]
    async fn get_service_status(&self) -> UpdateServiceStatus {
        use std::process::Command;

        let mut status = UpdateServiceStatus {
            service_running: false,
            start_type: "Unknown".to_string(),
            last_check_time: None,
            wsus_server: None,
            auto_update_enabled: false,
            auto_update_day: None,
            auto_update_time: None,
        };

        // Check Windows Update service
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $wu = Get-Service wuauserv
                $auOptions = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -ErrorAction SilentlyContinue)
                $wsus = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -ErrorAction SilentlyContinue)

                @{
                    "Running" = $wu.Status -eq "Running"
                    "StartType" = $wu.StartType.ToString()
                    "AutoUpdate" = if ($auOptions.NoAutoUpdate -eq 1) { $false } else { $true }
                    "WsusServer" = $wsus.WUServer
                    "AUOptions" = $auOptions.AUOptions
                    "ScheduledDay" = $auOptions.ScheduledInstallDay
                    "ScheduledTime" = $auOptions.ScheduledInstallTime
                } | ConvertTo-Json
                "#,
            ])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    status.service_running = json
                        .get("Running")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    status.start_type = json
                        .get("StartType")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    status.auto_update_enabled = json
                        .get("AutoUpdate")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    status.wsus_server = json
                        .get("WsusServer")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
            }
        }

        status
    }

    #[cfg(target_os = "windows")]
    async fn get_update_history(&self) -> (Option<DateTime<Utc>>, Vec<UpdateHistoryEntry>) {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $Session = New-Object -ComObject Microsoft.Update.Session
                $Searcher = $Session.CreateUpdateSearcher()
                $History = $Searcher.QueryHistory(0, 20)

                $History | ForEach-Object {
                    @{
                        "Title" = $_.Title
                        "Date" = $_.Date.ToString("o")
                        "Result" = switch ($_.ResultCode) {
                            0 { "Not Started" }
                            1 { "In Progress" }
                            2 { "Succeeded" }
                            3 { "Succeeded With Errors" }
                            4 { "Failed" }
                            5 { "Aborted" }
                            default { "Unknown" }
                        }
                    }
                } | ConvertTo-Json -Compress
                "#,
            ])
            .output();

        let mut entries = Vec::new();
        let mut last_update: Option<DateTime<Utc>> = None;

        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                    for item in items {
                        if let Some(date_str) = item.get("Date").and_then(|v| v.as_str()) {
                            if let Ok(date) = DateTime::parse_from_rfc3339(date_str) {
                                let date_utc = date.with_timezone(&Utc);
                                if last_update.is_none()
                                    || last_update.map(|d| d < date_utc).unwrap_or(false)
                                {
                                    let result = item
                                        .get("Result")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown");
                                    if result.contains("Succeeded") {
                                        last_update = Some(date_utc);
                                    }
                                }

                                entries.push(UpdateHistoryEntry {
                                    title: item
                                        .get("Title")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string(),
                                    kb_article: None,
                                    installed_on: date_utc,
                                    result: item
                                        .get("Result")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("Unknown")
                                        .to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        (last_update, entries)
    }

    #[cfg(target_os = "windows")]
    async fn get_pending_updates(&self) -> Vec<PendingUpdate> {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $Session = New-Object -ComObject Microsoft.Update.Session
                $Searcher = $Session.CreateUpdateSearcher()
                $Results = $Searcher.Search("IsInstalled=0 and IsHidden=0")

                $Results.Updates | ForEach-Object {
                    $severity = "Moderate"
                    if ($_.MsrcSeverity) { $severity = $_.MsrcSeverity }
                    elseif ($_.AutoSelectOnWebSites) { $severity = "Important" }

                    @{
                        "Title" = $_.Title
                        "Severity" = $severity
                        "Category" = ($_.Categories | Select-Object -First 1).Name
                        "SizeMB" = [math]::Round($_.MaxDownloadSize / 1MB, 2)
                    }
                } | ConvertTo-Json -Compress
                "#,
            ])
            .output();

        let mut updates = Vec::new();

        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                // Handle both single object and array
                if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                    for item in items {
                        updates.push(PendingUpdate {
                            title: item
                                .get("Title")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Unknown")
                                .to_string(),
                            kb_article: None,
                            severity: item
                                .get("Severity")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Moderate")
                                .to_string(),
                            category: item
                                .get("Category")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Updates")
                                .to_string(),
                            size_mb: item.get("SizeMB").and_then(|v| v.as_f64()),
                            published_date: None,
                        });
                    }
                } else if let Ok(item) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    // Single update
                    updates.push(PendingUpdate {
                        title: item
                            .get("Title")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown")
                            .to_string(),
                        kb_article: None,
                        severity: item
                            .get("Severity")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Moderate")
                            .to_string(),
                        category: item
                            .get("Category")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Updates")
                            .to_string(),
                        size_mb: item.get("SizeMB").and_then(|v| v.as_f64()),
                        published_date: None,
                    });
                }
            }
        }

        updates
    }

    #[cfg(target_os = "windows")]
    async fn check_reboot_pending(&self) -> (bool, Option<DateTime<Utc>>) {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $reboot = $false
                $since = $null

                # Check Windows Update reboot flag
                if (Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired") {
                    $reboot = $true
                }

                # Check Component Based Servicing
                if (Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending") {
                    $reboot = $true
                }

                # Check pending file rename operations
                $pendingRename = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name PendingFileRenameOperations -ErrorAction SilentlyContinue
                if ($pendingRename.PendingFileRenameOperations) {
                    $reboot = $true
                }

                @{
                    "RebootRequired" = $reboot
                } | ConvertTo-Json
                "#,
            ])
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let reboot = json
                        .get("RebootRequired")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    return (reboot, None);
                }
            }
        }

        (false, None)
    }

    #[cfg(not(target_os = "windows"))]
    async fn check_update_status(&self) -> ScannerResult<UpdateStatus> {
        // For non-Windows, check package manager last update
        #[cfg(target_os = "linux")]
        {
            return self.check_linux_updates().await;
        }

        #[cfg(target_os = "macos")]
        {
            return self.check_macos_updates().await;
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            Ok(UpdateStatus {
                compliant: true,
                compliance_score: 100.0,
                last_update_date: None,
                days_since_last_update: None,
                pending_updates: vec![],
                critical_pending_count: 0,
                important_pending_count: 0,
                moderate_pending_count: 0,
                total_pending_count: 0,
                reboot_required: false,
                reboot_pending_since: None,
                service_status: UpdateServiceStatus {
                    service_running: true,
                    start_type: "N/A".to_string(),
                    last_check_time: None,
                    wsus_server: None,
                    auto_update_enabled: true,
                    auto_update_day: None,
                    auto_update_time: None,
                },
                recent_history: vec![],
                issues: vec![],
            })
        }
    }

    #[cfg(target_os = "linux")]
    async fn check_linux_updates(&self) -> ScannerResult<UpdateStatus> {
        use std::fs;
        use std::process::Command;

        let mut issues = Vec::new();
        let mut last_update: Option<DateTime<Utc>> = None;

        // Check apt/dpkg history
        if let Ok(content) = fs::read_to_string("/var/log/dpkg.log") {
            // Parse last update from dpkg log
            for line in content.lines().rev() {
                if line.contains(" install ") || line.contains(" upgrade ") {
                    // Format: 2024-01-15 10:30:00 install package
                    if let Some(date_part) = line
                        .split_whitespace()
                        .take(2)
                        .collect::<Vec<_>>()
                        .join(" ")
                        .parse::<String>()
                        .ok()
                    {
                        if let Ok(date) =
                            chrono::NaiveDateTime::parse_from_str(&date_part, "%Y-%m-%d %H:%M:%S")
                        {
                            last_update = Some(DateTime::from_naive_utc_and_offset(date, Utc));
                            break;
                        }
                    }
                }
            }
        }

        // Check for pending updates
        let pending_count = Command::new("sh")
            .args([
                "-c",
                "apt list --upgradable 2>/dev/null | grep -c upgradable || echo 0",
            ])
            .output()
            .ok()
            .and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<usize>()
                    .ok()
            })
            .unwrap_or(0);

        if pending_count > MAX_TOTAL_PENDING {
            issues.push(format!("{} updates pending", pending_count));
        }

        let days_since = last_update.map(|d| (Utc::now() - d).num_days());
        if let Some(days) = days_since {
            if days > MAX_DAYS_SINCE_UPDATE {
                issues.push(format!("Last update was {} days ago", days));
            }
        }

        let score = if issues.is_empty() { 100.0 } else { 60.0 };

        Ok(UpdateStatus {
            compliant: issues.is_empty(),
            compliance_score: score,
            last_update_date: last_update,
            days_since_last_update: days_since,
            pending_updates: vec![],
            critical_pending_count: 0,
            important_pending_count: 0,
            moderate_pending_count: 0,
            total_pending_count: pending_count,
            reboot_required: std::path::Path::new("/var/run/reboot-required").exists(),
            reboot_pending_since: None,
            service_status: UpdateServiceStatus {
                service_running: true,
                start_type: "automatic".to_string(),
                last_check_time: None,
                wsus_server: None,
                auto_update_enabled: true,
                auto_update_day: None,
                auto_update_time: None,
            },
            recent_history: vec![],
            issues,
        })
    }

    #[cfg(target_os = "macos")]
    async fn check_macos_updates(&self) -> ScannerResult<UpdateStatus> {
        use std::process::Command;

        let mut issues = Vec::new();

        // Check for pending updates using softwareupdate
        let output = Command::new("softwareupdate").args(["--list"]).output();

        let pending_count = if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.lines().filter(|l| l.starts_with("*")).count()
        } else {
            0
        };

        if pending_count > 0 {
            issues.push(format!("{} updates pending", pending_count));
        }

        let score = if issues.is_empty() { 100.0 } else { 70.0 };

        Ok(UpdateStatus {
            compliant: issues.is_empty(),
            compliance_score: score,
            last_update_date: None,
            days_since_last_update: None,
            pending_updates: vec![],
            critical_pending_count: 0,
            important_pending_count: 0,
            moderate_pending_count: 0,
            total_pending_count: pending_count,
            reboot_required: false,
            reboot_pending_since: None,
            service_status: UpdateServiceStatus {
                service_running: true,
                start_type: "automatic".to_string(),
                last_check_time: None,
                wsus_server: None,
                auto_update_enabled: true,
                auto_update_day: None,
                auto_update_time: None,
            },
            recent_history: vec![],
            issues,
        })
    }
}

impl Default for UpdateStatusCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for UpdateStatusCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing update status check");

        let status = self.check_update_status().await?;
        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            info!(
                "Update status check passed: {} pending, last update {:?}",
                status.total_pending_count, status.days_since_last_update
            );
            Ok(CheckOutput::pass(
                format!(
                    "Updates compliant: {} pending, last update {} days ago",
                    status.total_pending_count,
                    status.days_since_last_update.unwrap_or(0)
                ),
                raw_data,
            ))
        } else {
            warn!("Update status check failed: {} issues", status.issues.len());
            Ok(CheckOutput::fail(
                format!("Update issues: {}", status.issues.join("; ")),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_status_check_creation() {
        let check = UpdateStatusCheck::new();
        assert_eq!(check.definition().id, UPDATE_STATUS_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Updates);
        assert!(
            check
                .definition()
                .frameworks
                .contains(&"PCI_DSS".to_string())
        );
    }

    #[test]
    fn test_pending_update_serialization() {
        let update = PendingUpdate {
            title: "Security Update KB12345".to_string(),
            kb_article: Some("KB12345".to_string()),
            severity: "Critical".to_string(),
            category: "Security Updates".to_string(),
            size_mb: Some(15.5),
            published_date: None,
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("KB12345"));
        assert!(json.contains("Critical"));
    }
}
