//! Backup configuration compliance check.
//!
//! Verifies backup is configured and recent:
//! - Windows: Windows Backup / File History
//! - Linux: rsync, timeshift, restic, borgbackup detection
//! - macOS: Time Machine

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

/// Check ID for backup configuration.
pub const CHECK_ID: &str = "backup_config";

/// Maximum days since last backup for compliance.
const MAX_BACKUP_AGE_DAYS: i64 = 30;

/// Backup configuration status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupStatus {
    /// Whether backup is configured.
    pub backup_configured: bool,

    /// Whether backup is enabled/active.
    pub backup_enabled: bool,

    /// Last successful backup date.
    pub last_backup_date: Option<DateTime<Utc>>,

    /// Days since last backup.
    pub days_since_backup: Option<i64>,

    /// Backup destination/location.
    #[serde(default)]
    pub backup_destination: Option<String>,

    /// Approximate backup size in bytes.
    pub backup_size_bytes: Option<u64>,

    /// Type of backup solution detected.
    #[serde(default)]
    pub backup_type: Option<String>,

    /// Backup schedule if configured.
    #[serde(default)]
    pub backup_schedule: Option<String>,

    /// Whether backup includes system state.
    pub includes_system: Option<bool>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Backup configuration compliance check.
pub struct BackupCheck {
    definition: CheckDefinition,
}

impl BackupCheck {
    /// Create a new backup check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Backup Configuration")
            .description("Verify backup is configured and recent (< 30 days)")
            .category(CheckCategory::Backup)
            .severity(CheckSeverity::Medium)
            .framework("NIS2")
            .framework("DORA")
            .platforms(vec![
                "windows".to_string(),
                "linux".to_string(),
                "macos".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check backup on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<BackupStatus> {
        debug!("Checking Windows backup configuration");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Check File History status
                try {
                    $fh = Get-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\FileHistory' -ErrorAction SilentlyContinue
                    if ($fh) {
                        $results['FileHistory_Enabled'] = $fh.ProtectedUpToDate
                    }
                } catch {}

                # Check Windows Backup status (wbadmin)
                try {
                    $wbadminOutput = wbadmin get versions 2>&1
                    $results['WBAdmin_Output'] = $wbadminOutput | Out-String

                    if ($wbadminOutput -notmatch 'ERROR') {
                        $results['WindowsBackup_Configured'] = $true

                        # Parse last backup date
                        $versionMatch = $wbadminOutput | Select-String -Pattern 'Backup time: (.+)'
                        if ($versionMatch) {
                            $results['LastBackupDate'] = $versionMatch.Matches[0].Groups[1].Value
                        }
                    }
                } catch {
                    $results['WindowsBackup_Configured'] = $false
                }

                # Check System Restore
                try {
                    $sr = Get-ComputerRestorePoint | Select-Object -Last 1
                    if ($sr) {
                        $results['SystemRestore_LastPoint'] = $sr.CreationTime.ToString('o')
                    }
                } catch {}

                # Check VSS (Volume Shadow Copy)
                try {
                    $vss = Get-WmiObject Win32_ShadowCopy | Select-Object -Last 1
                    if ($vss) {
                        $results['VSS_LastCopy'] = $vss.InstallDate
                        $results['VSS_DeviceObject'] = $vss.DeviceObject
                    }
                } catch {}

                # Check third-party backup (common paths)
                $backupPaths = @(
                    'C:\Program Files\Veeam',
                    'C:\Program Files\Acronis',
                    'C:\Program Files\BackupExec'
                )
                foreach ($path in $backupPaths) {
                    if (Test-Path $path) {
                        $results['ThirdParty_' + (Split-Path $path -Leaf)] = $true
                    }
                }

                $results | ConvertTo-Json -Depth 3
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = BackupStatus {
            backup_configured: false,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // Windows Backup
            if json
                .get("WindowsBackup_Configured")
                .and_then(|v| v.as_bool())
                == Some(true)
            {
                status.backup_configured = true;
                status.backup_enabled = true;
                status.backup_type = Some("Windows Backup".to_string());

                if let Some(date_str) = json.get("LastBackupDate").and_then(|v| v.as_str()) {
                    // Parse Windows date format
                    status.last_backup_date = Self::parse_windows_date(date_str);
                }
            }

            // File History
            if json.get("FileHistory_Enabled").and_then(|v| v.as_u64()) == Some(1) {
                status.backup_configured = true;
                status.backup_enabled = true;
                if status.backup_type.is_none() {
                    status.backup_type = Some("File History".to_string());
                }
            }

            // System Restore
            if let Some(date_str) = json.get("SystemRestore_LastPoint").and_then(|v| v.as_str()) {
                if !status.backup_configured {
                    status.backup_configured = true;
                    status.backup_type = Some("System Restore".to_string());
                }
                if let Ok(date) = DateTime::parse_from_rfc3339(date_str) {
                    status.last_backup_date = Some(date.with_timezone(&Utc));
                }
                status.includes_system = Some(true);
            }

            // VSS
            if json.get("VSS_LastCopy").is_some() {
                if !status.backup_configured {
                    status.backup_configured = true;
                    status.backup_type = Some("Volume Shadow Copy".to_string());
                }
            }

            // Third-party backup
            for (key, _) in json.as_object().unwrap_or(&serde_json::Map::new()) {
                if key.starts_with("ThirdParty_") {
                    status.backup_configured = true;
                    status.backup_enabled = true;
                    status.backup_type = Some(key.replace("ThirdParty_", ""));
                    break;
                }
            }
        }

        // Calculate days since backup
        if let Some(backup_date) = status.last_backup_date {
            let days = (Utc::now() - backup_date).num_days();
            status.days_since_backup = Some(days);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "windows")]
    fn parse_windows_date(date_str: &str) -> Option<DateTime<Utc>> {
        // Try common Windows date formats (varies by locale)
        let formats = [
            "%m/%d/%Y %I:%M %p",     // US format: 01/15/2024 10:00 AM
            "%m/%d/%Y %H:%M:%S",     // US format 24h
            "%d/%m/%Y %H:%M:%S",     // EU format: 15/01/2024 10:00:00
            "%Y-%m-%d %H:%M:%S",     // ISO format
            "%Y-%m-%dT%H:%M:%S",     // ISO with T
            "%d.%m.%Y %H:%M:%S",     // German format
            "%m/%d/%Y, %I:%M:%S %p", // US with comma
        ];

        let trimmed = date_str.trim();
        for fmt in formats {
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, fmt) {
                return Some(DateTime::from_naive_utc_and_offset(dt, Utc));
            }
        }

        // Log parsing failure for debugging
        debug!(
            "Failed to parse Windows backup date: '{}' - tried {} formats",
            trimmed,
            formats.len()
        );
        None
    }

    /// Check backup on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<BackupStatus> {
        debug!("Checking Linux backup configuration");

        let mut status = BackupStatus {
            backup_configured: false,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check Timeshift
        if self.check_timeshift(&mut status) {
            // Timeshift found
        }
        // Check restic
        else if self.check_restic(&mut status) {
            // restic found
        }
        // Check borgbackup
        else if self.check_borg(&mut status) {
            // borgbackup found
        }
        // Check rsync in cron
        else if self.check_rsync_cron(&mut status) {
            // rsync backup found
        }
        // Check for backup scripts in cron
        else {
            self.check_backup_cron(&mut status);
        }

        // Calculate days since backup
        if let Some(backup_date) = status.last_backup_date {
            let days = (Utc::now() - backup_date).num_days();
            status.days_since_backup = Some(days);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "linux")]
    fn check_timeshift(&self, status: &mut BackupStatus) -> bool {
        // Check if timeshift is installed
        if let Ok(output) = Command::new("which").args(["timeshift"]).output() {
            if !output.status.success() {
                return false;
            }
        } else {
            return false;
        }

        status.backup_type = Some("Timeshift".to_string());
        status.includes_system = Some(true);

        // Get timeshift snapshots
        if let Ok(output) = Command::new("timeshift").args(["--list"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== timeshift --list ===\n{}\n", result));

            if result.contains("No snapshots") {
                status.backup_configured = true;
                status.backup_enabled = false;
            } else {
                status.backup_configured = true;
                status.backup_enabled = true;

                // Parse last snapshot date
                for line in result.lines().rev() {
                    if line.contains("rsync") || line.contains("btrfs") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            // Try to parse date from snapshot name like "2024-01-15_10-00-00"
                            if let Some(date) = Self::parse_snapshot_date(parts[1]) {
                                status.last_backup_date = Some(date);
                            }
                        }
                        break;
                    }
                }
            }
        }

        status.backup_configured
    }

    #[cfg(target_os = "linux")]
    fn check_restic(&self, status: &mut BackupStatus) -> bool {
        // Check for restic cache or config
        let home = std::env::var("HOME").unwrap_or_default();
        let cache_path = format!("{}/.cache/restic", home);

        if std::path::Path::new(&cache_path).exists() {
            status.backup_configured = true;
            status.backup_enabled = true;
            status.backup_type = Some("restic".to_string());
            status.raw_output.push_str("restic cache directory found\n");
            return true;
        }

        false
    }

    #[cfg(target_os = "linux")]
    fn check_borg(&self, status: &mut BackupStatus) -> bool {
        // Check for borgbackup
        if let Ok(output) = Command::new("which").args(["borg"]).output() {
            if !output.status.success() {
                return false;
            }
        } else {
            return false;
        }

        // Check for borg repos in common locations
        let home = std::env::var("HOME").unwrap_or_default();
        let borg_paths = [
            format!("{}/.config/borg", home),
            "/var/lib/borg".to_string(),
        ];

        for path in borg_paths {
            if std::path::Path::new(&path).exists() {
                status.backup_configured = true;
                status.backup_enabled = true;
                status.backup_type = Some("BorgBackup".to_string());
                status.backup_destination = Some(path);
                return true;
            }
        }

        false
    }

    #[cfg(target_os = "linux")]
    fn check_rsync_cron(&self, status: &mut BackupStatus) -> bool {
        // Check user crontab for rsync
        if let Ok(output) = Command::new("crontab").args(["-l"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();

            if result.contains("rsync") && !result.contains("no crontab") {
                status.backup_configured = true;
                status.backup_enabled = true;
                status.backup_type = Some("rsync (cron)".to_string());
                status
                    .raw_output
                    .push_str(&format!("rsync found in crontab:\n{}\n", result));
                return true;
            }
        }

        false
    }

    #[cfg(target_os = "linux")]
    fn check_backup_cron(&self, status: &mut BackupStatus) {
        // Check for backup-related cron jobs in all standard cron directories
        let cron_dirs = [
            "/etc/cron.d",
            "/etc/cron.hourly",
            "/etc/cron.daily",
            "/etc/cron.weekly",
            "/etc/cron.monthly",
        ];

        // Keywords to search for (case-insensitive)
        let backup_keywords = [
            "backup",
            "rsync",
            "borg",
            "restic",
            "duplicity",
            "rclone",
            "tar",
        ];

        for dir in cron_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();

                    // Check if filename contains any backup-related keyword
                    if backup_keywords.iter().any(|kw| name.contains(kw)) {
                        status.backup_configured = true;
                        status.backup_enabled = true;
                        status.backup_type = Some("cron backup".to_string());
                        status
                            .raw_output
                            .push_str(&format!("Backup cron job: {}\n", entry.path().display()));
                    }
                }
            }
        }

        // Also check systemd timer units for backup services
        let systemd_dirs = ["/etc/systemd/system", "/usr/lib/systemd/system"];

        for dir in systemd_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();

                    // Check for backup-related timer units
                    if name.ends_with(".timer")
                        && backup_keywords.iter().any(|kw| name.contains(kw))
                    {
                        status.backup_configured = true;
                        status.backup_type = Some("systemd timer".to_string());
                        status
                            .raw_output
                            .push_str(&format!("Backup timer unit: {}\n", entry.path().display()));

                        // Check if timer is enabled
                        if let Ok(output) = std::process::Command::new("systemctl")
                            .args(["is-enabled", &name])
                            .output()
                        {
                            let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                            if result == "enabled" {
                                status.backup_enabled = true;
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn parse_snapshot_date(date_str: &str) -> Option<DateTime<Utc>> {
        // Timeshift snapshot formats vary:
        // - BTRFS: "2024-01-15_10-00-00"
        // - RSYNC: "2024-01-15_10-00-00" or just date part extracted from path
        // - General: "2024-01-15", "20240115", etc.
        let datetime_formats = [
            "%Y-%m-%d_%H-%M-%S", // Standard Timeshift format
            "%Y-%m-%d-%H%M%S",   // Alternative format
            "%Y-%m-%dT%H:%M:%S", // ISO format
            "%Y%m%d_%H%M%S",     // Compact format
        ];

        let date_formats = [
            "%Y-%m-%d", // ISO date
            "%Y%m%d",   // Compact date
        ];

        let trimmed = date_str.trim();

        // Try datetime formats first
        for fmt in datetime_formats {
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(trimmed, fmt) {
                return Some(DateTime::from_naive_utc_and_offset(dt, Utc));
            }
        }

        // Try date-only formats
        for fmt in date_formats {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(trimmed, fmt) {
                return Some(DateTime::from_naive_utc_and_offset(
                    d.and_hms_opt(0, 0, 0).unwrap(),
                    Utc,
                ));
            }
        }

        // Try to extract date from longer strings (e.g., "snapshot_2024-01-15_description")
        if trimmed.len() >= 10 {
            // Look for YYYY-MM-DD pattern anywhere in the string
            for i in 0..=(trimmed.len() - 10) {
                let slice = &trimmed[i..i + 10];
                if let Ok(d) = chrono::NaiveDate::parse_from_str(slice, "%Y-%m-%d") {
                    return Some(DateTime::from_naive_utc_and_offset(
                        d.and_hms_opt(0, 0, 0).unwrap(),
                        Utc,
                    ));
                }
            }
        }

        debug!("Failed to parse snapshot date: '{}'", trimmed);
        None
    }

    /// Check backup on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<BackupStatus> {
        debug!("Checking macOS Time Machine configuration");

        let mut status = BackupStatus {
            backup_configured: false,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: Some("Time Machine".to_string()),
            backup_schedule: None,
            includes_system: Some(true),
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check Time Machine status
        if let Ok(output) = Command::new("tmutil").args(["status"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== tmutil status ===\n{}\n", result));

            // If tmutil runs successfully, Time Machine is configured
            if output.status.success() && !result.contains("Backup session not running") {
                status.backup_enabled = true;
            }
        }

        // Check Time Machine destination
        if let Ok(output) = Command::new("tmutil").args(["destinationinfo"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== tmutil destinationinfo ===\n{}\n", result));

            if !result.contains("No destinations") && output.status.success() {
                status.backup_configured = true;

                // Parse destination name
                for line in result.lines() {
                    if line.contains("Name") {
                        status.backup_destination =
                            line.split(':').last().map(|s| s.trim().to_string());
                    }
                }
            }
        }

        // Get latest backup info
        if let Ok(output) = Command::new("tmutil").args(["latestbackup"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("Latest backup: {}\n", result.trim()));

            if output.status.success() && !result.is_empty() {
                status.backup_enabled = true;
                // Extract date from path like "/Volumes/Backup/Backups.backupdb/Mac/2024-01-15-120000"
                if let Some(date) = Self::parse_time_machine_date(&result) {
                    status.last_backup_date = Some(date);
                }
            }
        }

        // Check if auto-backup is enabled
        if let Ok(output) = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.TimeMachine",
                "AutoBackup",
            ])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            if result.trim() == "1" {
                status.backup_schedule = Some("Automatic".to_string());
            }
        }

        // Calculate days since backup
        if let Some(backup_date) = status.last_backup_date {
            let days = (Utc::now() - backup_date).num_days();
            status.days_since_backup = Some(days);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "macos")]
    fn parse_time_machine_date(path: &str) -> Option<DateTime<Utc>> {
        // Extract date from path like ".../2024-01-15-120000"
        let parts: Vec<&str> = path.trim().split('/').collect();
        if let Some(last) = parts.last() {
            // Format: 2024-01-15-120000
            if last.len() >= 10 {
                let date_part = &last[..10];
                let time_part = if last.len() > 10 {
                    &last[11..]
                } else {
                    "000000"
                };

                let datetime_str = format!("{} {}", date_part, time_part);
                if let Ok(dt) =
                    chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %H%M%S")
                {
                    return Some(DateTime::from_naive_utc_and_offset(dt, Utc));
                }
                if let Ok(d) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                    return Some(DateTime::from_naive_utc_and_offset(
                        d.and_hms_opt(0, 0, 0).unwrap(),
                        Utc,
                    ));
                }
            }
        }
        None
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<BackupStatus> {
        Ok(BackupStatus {
            backup_configured: false,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &BackupStatus) -> Vec<String> {
        let mut issues = Vec::new();

        if !status.backup_configured {
            issues.push("No backup solution configured".to_string());
            return issues; // Early return - no point checking further
        }

        if !status.backup_enabled {
            issues.push("Backup is configured but not enabled".to_string());
            return issues; // Early return - backup not running
        }

        // Backup is configured and enabled, check recency
        match (status.last_backup_date, status.days_since_backup) {
            (Some(_), Some(days)) if days > MAX_BACKUP_AGE_DAYS => {
                issues.push(format!(
                    "Last backup was {} days ago (max: {} days)",
                    days, MAX_BACKUP_AGE_DAYS
                ));
            }
            (Some(_), Some(_)) => {
                // Backup is recent - compliant
            }
            (None, _) => {
                // No backup date found - could be first run or parsing issue
                // Check raw output to determine severity
                if status.raw_output.contains("No snapshots")
                    || status.raw_output.contains("No backups")
                    || status.raw_output.is_empty()
                {
                    issues.push("No backup history found - backup may never have run".to_string());
                } else {
                    // Backup exists but date couldn't be parsed
                    debug!("Backup detected but date could not be parsed");
                    issues.push(
                        "Backup exists but last backup date could not be determined".to_string(),
                    );
                }
            }
            _ => {}
        }

        issues
    }
}

impl Default for BackupCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for BackupCheck {
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
            if let Some(backup_type) = &status.backup_type {
                details.push(format!("type={}", backup_type));
            }
            if let Some(days) = status.days_since_backup {
                details.push(format!("last_backup={}d_ago", days));
            }
            if let Some(dest) = &status.backup_destination {
                details.push(format!("dest={}", dest));
            }

            Ok(CheckOutput::pass(
                format!("Backup is properly configured: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Backup issues: {}", status.issues.join("; ")),
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
        let check = BackupCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Backup);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = BackupCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_backup_status_serialization() {
        let status = BackupStatus {
            backup_configured: true,
            backup_enabled: true,
            last_backup_date: Some(Utc::now()),
            days_since_backup: Some(1),
            backup_destination: Some("/Volumes/Backup".to_string()),
            backup_size_bytes: Some(1024 * 1024 * 1024),
            backup_type: Some("Time Machine".to_string()),
            backup_schedule: Some("Automatic".to_string()),
            includes_system: Some(true),
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"backup_configured\":true"));
        assert!(json.contains("Time Machine"));

        let parsed: BackupStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.backup_configured);
        assert_eq!(parsed.backup_type, Some("Time Machine".to_string()));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = BackupCheck::new();
        let status = BackupStatus {
            backup_configured: true,
            backup_enabled: true,
            last_backup_date: Some(Utc::now()),
            days_since_backup: Some(1),
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_not_configured() {
        let check = BackupCheck::new();
        let status = BackupStatus {
            backup_configured: false,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("No backup")));
    }

    #[test]
    fn test_compliance_check_fail_old_backup() {
        let check = BackupCheck::new();
        let status = BackupStatus {
            backup_configured: true,
            backup_enabled: true,
            last_backup_date: Some(Utc::now() - chrono::Duration::days(45)),
            days_since_backup: Some(45),
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("45 days ago")));
    }

    #[test]
    fn test_compliance_check_fail_not_enabled() {
        let check = BackupCheck::new();
        let status = BackupStatus {
            backup_configured: true,
            backup_enabled: false,
            last_backup_date: None,
            days_since_backup: None,
            backup_destination: None,
            backup_size_bytes: None,
            backup_type: None,
            backup_schedule: None,
            includes_system: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("not enabled")));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = BackupCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
