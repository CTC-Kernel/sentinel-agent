//! Session lock compliance check.
//!
//! Verifies automatic session lock is configured:
//! - Windows: Screen saver lock settings via registry
//! - Linux: Desktop environment settings (GNOME, KDE, etc.)
//! - macOS: Screen saver and screen lock settings

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for session lock.
pub const CHECK_ID: &str = "screen_lock";

/// Maximum allowed timeout in minutes for compliance.
const MAX_TIMEOUT_MINUTES: u32 = 15;

/// Session lock status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLockStatus {
    /// Whether session lock is enabled.
    pub lock_enabled: bool,

    /// Idle timeout in minutes before lock activates.
    pub timeout_minutes: Option<u32>,

    /// Whether password is required on resume.
    pub require_password: bool,

    /// Whether lock activates on suspend/sleep.
    pub lock_on_suspend: bool,

    /// Desktop environment detected (Linux).
    #[serde(default)]
    pub desktop_environment: Option<String>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Session lock compliance check.
pub struct SessionLockCheck {
    definition: CheckDefinition,
}

impl SessionLockCheck {
    /// Create a new session lock check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Session Lock")
            .description("Verify automatic session lock is configured (timeout <= 15 min)")
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

    /// Check session lock on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<SessionLockStatus> {
        debug!("Checking Windows session lock settings");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Check screen saver timeout (in seconds)
                $timeout = Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -ErrorAction SilentlyContinue
                if ($timeout) { $results['ScreenSaveTimeOut'] = $timeout.ScreenSaveTimeOut }

                # Check if screen saver is active
                $active = Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive' -ErrorAction SilentlyContinue
                if ($active) { $results['ScreenSaveActive'] = $active.ScreenSaveActive }

                # Check if password on wake is required
                $secure = Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaverIsSecure' -ErrorAction SilentlyContinue
                if ($secure) { $results['ScreenSaverIsSecure'] = $secure.ScreenSaverIsSecure }

                # Check power settings for lock on sleep
                $powerCfg = powercfg /q | Select-String -Pattern 'CONSOLELOCK|Require a password'
                if ($powerCfg) { $results['PowerSettings'] = ($powerCfg -join '; ') }

                # Check for GPO enforced settings
                $gpo = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop' -ErrorAction SilentlyContinue
                if ($gpo) {
                    if ($gpo.ScreenSaveTimeOut) { $results['GPO_ScreenSaveTimeOut'] = $gpo.ScreenSaveTimeOut }
                    if ($gpo.ScreenSaverIsSecure) { $results['GPO_ScreenSaverIsSecure'] = $gpo.ScreenSaverIsSecure }
                }

                $results | ConvertTo-Json
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = SessionLockStatus {
            lock_enabled: false,
            timeout_minutes: None,
            require_password: false,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // Screen saver active
            if let Some(active) = json.get("ScreenSaveActive").and_then(|v| v.as_str()) {
                status.lock_enabled = active == "1";
            }

            // GPO overrides user settings
            if let Some(active) = json.get("GPO_ScreenSaveActive").and_then(|v| v.as_str()) {
                status.lock_enabled = active == "1";
            }

            // Timeout in seconds -> convert to minutes
            if let Some(timeout) = json
                .get("GPO_ScreenSaveTimeOut")
                .or_else(|| json.get("ScreenSaveTimeOut"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok())
            {
                status.timeout_minutes = Some(timeout / 60);
            }

            // Password required
            if let Some(secure) = json
                .get("GPO_ScreenSaverIsSecure")
                .or_else(|| json.get("ScreenSaverIsSecure"))
                .and_then(|v| v.as_str())
            {
                status.require_password = secure == "1";
            }

            // Lock on suspend (from power settings)
            if let Some(power) = json.get("PowerSettings").and_then(|v| v.as_str()) {
                status.lock_on_suspend =
                    power.to_lowercase().contains("yes") || power.contains("0x001");
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check session lock on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<SessionLockStatus> {
        debug!("Checking Linux session lock settings");

        let mut status = SessionLockStatus {
            lock_enabled: false,
            timeout_minutes: None,
            require_password: true, // Linux typically requires password by default
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Detect desktop environment
        let de = std::env::var("XDG_CURRENT_DESKTOP")
            .or_else(|_| std::env::var("DESKTOP_SESSION"))
            .unwrap_or_default();

        status.desktop_environment = if de.is_empty() {
            None
        } else {
            Some(de.clone())
        };
        status.raw_output.push_str(&format!("Desktop: {}\n\n", de));

        // Try GNOME settings
        if de.to_lowercase().contains("gnome") || de.to_lowercase().contains("unity") {
            self.check_gnome_settings(&mut status);
        }
        // Try KDE settings
        else if de.to_lowercase().contains("kde") || de.to_lowercase().contains("plasma") {
            self.check_kde_settings(&mut status);
        }
        // Try XFCE settings
        else if de.to_lowercase().contains("xfce") {
            self.check_xfce_settings(&mut status);
        }

        // Also check systemd logind settings (applies to all DEs)
        self.check_logind_settings(&mut status);

        // If no desktop-specific settings found, check xss-lock or xautolock
        if status.timeout_minutes.is_none() {
            self.check_generic_lock_tools(&mut status);
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "linux")]
    fn check_gnome_settings(&self, status: &mut SessionLockStatus) {
        // Check GNOME idle settings
        if let Ok(output) = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.session", "idle-delay"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("GNOME idle-delay: {}\n", result.trim()));

            // Parse "uint32 N" format
            if let Some(seconds) = result
                .split_whitespace()
                .last()
                .and_then(|s| s.parse::<u32>().ok())
            {
                if seconds > 0 {
                    status.timeout_minutes = Some(seconds / 60);
                }
            }
        }

        // Check if lock on idle is enabled
        if let Ok(output) = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.screensaver", "lock-enabled"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("GNOME lock-enabled: {}\n", result.trim()));
            status.lock_enabled = result.trim() == "true";
        }

        // Check lock delay
        if let Ok(output) = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.screensaver", "lock-delay"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("GNOME lock-delay: {}\n", result.trim()));
        }
    }

    #[cfg(target_os = "linux")]
    fn check_kde_settings(&self, status: &mut SessionLockStatus) {
        // Check KDE PowerDevil settings
        let kde_config = directories::BaseDirs::new()
            .map(|b| b.config_dir().join("powermanagementprofilesrc"))
            .unwrap_or_default();

        if let Ok(content) = std::fs::read_to_string(&kde_config) {
            status
                .raw_output
                .push_str(&format!("KDE config:\n{}\n", content));

            for line in content.lines() {
                if line.starts_with("idleTime=") {
                    if let Some(ms) = line.split('=').last().and_then(|s| s.parse::<u32>().ok()) {
                        status.timeout_minutes = Some(ms / 60000); // milliseconds to minutes
                    }
                }
                if line.contains("LockScreen=true") {
                    status.lock_enabled = true;
                }
            }
        }

        // Check kscreenlockerrc
        let screenlocker_config = directories::BaseDirs::new()
            .map(|b| b.config_dir().join("kscreenlockerrc"))
            .unwrap_or_default();

        if let Ok(content) = std::fs::read_to_string(&screenlocker_config) {
            status
                .raw_output
                .push_str(&format!("KDE screenlocker config:\n{}\n", content));

            for line in content.lines() {
                if line.starts_with("Timeout=") {
                    if let Some(mins) = line.split('=').last().and_then(|s| s.parse::<u32>().ok()) {
                        status.timeout_minutes = Some(mins);
                    }
                }
                if line.contains("Autolock=true") {
                    status.lock_enabled = true;
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn check_xfce_settings(&self, status: &mut SessionLockStatus) {
        // Check xfce4-screensaver settings
        if let Ok(output) = Command::new("xfconf-query")
            .args(["-c", "xfce4-screensaver", "-p", "/lock/enabled"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("XFCE lock enabled: {}\n", result.trim()));
            status.lock_enabled = result.trim() == "true";
        }

        if let Ok(output) = Command::new("xfconf-query")
            .args([
                "-c",
                "xfce4-screensaver",
                "-p",
                "/lock/saver-activation/delay",
            ])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("XFCE lock delay: {}\n", result.trim()));
            if let Ok(mins) = result.trim().parse::<u32>() {
                status.timeout_minutes = Some(mins);
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn check_logind_settings(&self, status: &mut SessionLockStatus) {
        // Check systemd-logind settings for lock on suspend
        if let Ok(content) = std::fs::read_to_string("/etc/systemd/logind.conf") {
            status
                .raw_output
                .push_str(&format!("=== /etc/systemd/logind.conf ===\n{}\n", content));

            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }

                if line.contains("HandleSuspendKey=lock") || line.contains("HandleLidSwitch=lock") {
                    status.lock_on_suspend = true;
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn check_generic_lock_tools(&self, status: &mut SessionLockStatus) {
        // Check for xss-lock or xautolock
        if let Ok(output) = Command::new("pgrep")
            .args(["-a", "xss-lock|xautolock|light-locker"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            if !result.is_empty() {
                status
                    .raw_output
                    .push_str(&format!("Lock daemon: {}\n", result.trim()));
                status.lock_enabled = true;
            }
        }
    }

    /// Check session lock on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<SessionLockStatus> {
        debug!("Checking macOS session lock settings");

        let mut status = SessionLockStatus {
            lock_enabled: false,
            timeout_minutes: None,
            require_password: false,
            lock_on_suspend: false,
            desktop_environment: Some("macOS".to_string()),
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check screen saver settings
        if let Ok(output) = Command::new("defaults")
            .args(["read", "com.apple.screensaver", "idleTime"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("Screen saver idleTime: {}\n", result.trim()));

            if let Ok(seconds) = result.trim().parse::<u32>() {
                status.timeout_minutes = Some(seconds / 60);
                if seconds > 0 {
                    status.lock_enabled = true;
                }
            }
        }

        // Check askForPassword setting
        if let Ok(output) = Command::new("defaults")
            .args(["read", "com.apple.screensaver", "askForPassword"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("askForPassword: {}\n", result.trim()));
            status.require_password = result.trim() == "1";
        }

        // Check askForPasswordDelay (seconds delay before requiring password)
        if let Ok(output) = Command::new("defaults")
            .args(["read", "com.apple.screensaver", "askForPasswordDelay"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("askForPasswordDelay: {}s\n", result.trim()));
        }

        // Check system preferences for display sleep
        if let Ok(output) = Command::new("pmset").args(["-g", "custom"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== pmset ===\n{}\n", result));

            for line in result.lines() {
                if line.contains("displaysleep")
                    && let Some(mins) = line
                        .split_whitespace()
                        .last()
                        .and_then(|s| s.parse::<u32>().ok())
                    && (status.timeout_minutes.is_none() || mins > 0)
                {
                    status.timeout_minutes = Some(mins);
                }
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<SessionLockStatus> {
        Ok(SessionLockStatus {
            lock_enabled: false,
            timeout_minutes: None,
            require_password: false,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &SessionLockStatus) -> Vec<String> {
        let mut issues = Vec::new();

        // Check if lock is enabled
        if !status.lock_enabled {
            issues.push("Session lock is not enabled".to_string());
        }

        // Check timeout
        if let Some(timeout) = status.timeout_minutes {
            if timeout > MAX_TIMEOUT_MINUTES {
                issues.push(format!(
                    "Session lock timeout ({} min) exceeds maximum allowed ({} min)",
                    timeout, MAX_TIMEOUT_MINUTES
                ));
            }
            if timeout == 0 {
                issues.push("Session lock timeout is set to 0 (never)".to_string());
            }
        } else if status.lock_enabled {
            // Lock is enabled but no timeout configured
            issues.push("Session lock timeout not configured".to_string());
        }

        // Check password requirement
        if status.lock_enabled && !status.require_password {
            issues.push("Password not required on session unlock".to_string());
        }

        issues
    }
}

impl Default for SessionLockCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for SessionLockCheck {
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
            if let Some(timeout) = status.timeout_minutes {
                details.push(format!("timeout={}min", timeout));
            }
            if status.require_password {
                details.push("password=required".to_string());
            }
            if status.lock_on_suspend {
                details.push("lock_on_suspend=yes".to_string());
            }

            Ok(CheckOutput::pass(
                format!(
                    "Session lock is properly configured: {}",
                    details.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Session lock issues: {}", status.issues.join("; ")),
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
        let check = SessionLockCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Authentication);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = SessionLockCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_session_lock_status_serialization() {
        let status = SessionLockStatus {
            lock_enabled: true,
            timeout_minutes: Some(10),
            require_password: true,
            lock_on_suspend: true,
            desktop_environment: Some("GNOME".to_string()),
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"lock_enabled\":true"));
        assert!(json.contains("\"timeout_minutes\":10"));

        let parsed: SessionLockStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.lock_enabled);
        assert_eq!(parsed.timeout_minutes, Some(10));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = SessionLockCheck::new();
        let status = SessionLockStatus {
            lock_enabled: true,
            timeout_minutes: Some(10),
            require_password: true,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_timeout() {
        let check = SessionLockCheck::new();
        let status = SessionLockStatus {
            lock_enabled: true,
            timeout_minutes: Some(30), // > 15 min
            require_password: true,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("exceeds maximum")));
    }

    #[test]
    fn test_compliance_check_fail_disabled() {
        let check = SessionLockCheck::new();
        let status = SessionLockStatus {
            lock_enabled: false,
            timeout_minutes: None,
            require_password: false,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("not enabled")));
    }

    #[test]
    fn test_compliance_check_fail_no_password() {
        let check = SessionLockCheck::new();
        let status = SessionLockStatus {
            lock_enabled: true,
            timeout_minutes: Some(10),
            require_password: false,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("Password not required")));
    }

    #[test]
    fn test_compliance_check_fail_zero_timeout() {
        let check = SessionLockCheck::new();
        let status = SessionLockStatus {
            lock_enabled: true,
            timeout_minutes: Some(0),
            require_password: true,
            lock_on_suspend: false,
            desktop_environment: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("set to 0")));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = SessionLockCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
