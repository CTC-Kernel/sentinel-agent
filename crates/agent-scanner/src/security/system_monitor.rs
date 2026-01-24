//! System monitoring for security configuration changes.

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use crate::error::ScannerResult;
use tracing::{debug, info, warn};

/// System checks to perform.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemCheck {
    /// Check if a new admin account was created.
    NewAdminAccount,
    /// Check if firewall is disabled.
    FirewallDisabled,
    /// Check if antivirus is disabled.
    AntivirusDisabled,
    /// Check if SSH root login is enabled.
    SshRootEnabled,
    /// Check if remote desktop is enabled (Windows).
    RemoteDesktopEnabled,
    /// Check for suspicious scheduled tasks/cron jobs.
    SuspiciousScheduledTask,
}

impl SystemCheck {
    /// Get all system checks.
    pub fn all() -> Vec<SystemCheck> {
        vec![
            Self::NewAdminAccount,
            Self::FirewallDisabled,
            Self::AntivirusDisabled,
            Self::SshRootEnabled,
            Self::RemoteDesktopEnabled,
            Self::SuspiciousScheduledTask,
        ]
    }
}

/// System monitor for detecting security configuration changes.
pub struct SystemMonitor {
    /// List of known admin users (to detect new ones).
    known_admins: Vec<String>,
}

impl SystemMonitor {
    /// Create a new system monitor.
    pub fn new() -> Self {
        Self {
            known_admins: Vec::new(),
        }
    }

    /// Set the list of known admin users.
    pub fn set_known_admins(&mut self, admins: Vec<String>) {
        self.known_admins = admins;
    }

    /// Check firewall status.
    #[cfg(target_os = "linux")]
    async fn check_firewall(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        // Check ufw status
        let ufw_output = Command::new("ufw").args(["status"]).output();

        if let Ok(output) = ufw_output {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("inactive") || stdout.contains("disabled") {
                return Some(SecurityIncident::firewall_disabled(serde_json::json!({
                    "firewall": "ufw",
                    "status": "inactive",
                })));
            }
        }

        // Check iptables (fallback)
        let iptables_output = Command::new("iptables").args(["-L", "-n"]).output();

        if let Ok(output) = iptables_output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // If there are very few rules, firewall might be effectively disabled
            let rule_count = stdout
                .lines()
                .filter(|l| !l.is_empty() && !l.starts_with("Chain"))
                .count();
            if rule_count < 3 {
                debug!("iptables has very few rules ({})", rule_count);
                // Don't alert on this as it might be intentional
            }
        }

        None
    }

    #[cfg(target_os = "macos")]
    async fn check_firewall(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        let output = Command::new("defaults")
            .args(["read", "/Library/Preferences/com.apple.alf", "globalstate"])
            .output();

        if let Ok(result) = output
            && result.status.success()
        {
            let state: i32 = String::from_utf8_lossy(&result.stdout)
                .trim()
                .parse()
                .unwrap_or(0);

            // 0 = disabled, 1 = enabled for specific services, 2 = enabled for essential services
            if state == 0 {
                return Some(SecurityIncident::firewall_disabled(serde_json::json!({
                    "firewall": "application_firewall",
                    "globalstate": state,
                })));
            }
        }

        None
    }

    #[cfg(target_os = "windows")]
    async fn check_firewall(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-NetFirewallProfile | Select-Object Name,Enabled | ConvertTo-Json",
            ])
            .output();

        if let Ok(result) = output {
            if result.status.success() {
                #[derive(serde::Deserialize)]
                #[serde(rename_all = "PascalCase")]
                struct FirewallProfile {
                    name: String,
                    enabled: bool,
                }

                let stdout = String::from_utf8_lossy(&result.stdout);
                let profiles: Vec<FirewallProfile> =
                    serde_json::from_str(&stdout).unwrap_or_default();

                let disabled: Vec<&FirewallProfile> =
                    profiles.iter().filter(|p| !p.enabled).collect();

                if !disabled.is_empty() {
                    let disabled_names: Vec<&str> =
                        disabled.iter().map(|p| p.name.as_str()).collect();
                    return Some(SecurityIncident::firewall_disabled(serde_json::json!({
                        "firewall": "windows_firewall",
                        "disabled_profiles": disabled_names,
                    })));
                }
            }
        }

        None
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    async fn check_firewall(&self) -> Option<SecurityIncident> {
        None
    }

    /// Check antivirus status.
    #[cfg(target_os = "windows")]
    async fn check_antivirus(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        // Check Windows Defender status
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $mpStatus = Get-MpComputerStatus -ErrorAction SilentlyContinue
                if ($mpStatus) {
                    [PSCustomObject]@{
                        RealTimeEnabled = $mpStatus.RealTimeProtectionEnabled
                        AntivirusEnabled = $mpStatus.AntivirusEnabled
                        AntispywareEnabled = $mpStatus.AntispywareEnabled
                        BehaviorMonitorEnabled = $mpStatus.BehaviorMonitorEnabled
                    } | ConvertTo-Json
                }
                "#,
            ])
            .output();

        if let Ok(result) = output {
            if result.status.success() {
                #[derive(serde::Deserialize)]
                #[serde(rename_all = "PascalCase")]
                struct DefenderStatus {
                    real_time_enabled: Option<bool>,
                    antivirus_enabled: Option<bool>,
                    antispyware_enabled: Option<bool>,
                    behavior_monitor_enabled: Option<bool>,
                }

                let stdout = String::from_utf8_lossy(&result.stdout);
                if let Ok(status) = serde_json::from_str::<DefenderStatus>(&stdout) {
                    if status.real_time_enabled == Some(false)
                        || status.antivirus_enabled == Some(false)
                    {
                        return Some(SecurityIncident::antivirus_disabled(
                            "Windows Defender",
                            serde_json::json!({
                                "real_time_enabled": status.real_time_enabled,
                                "antivirus_enabled": status.antivirus_enabled,
                                "antispyware_enabled": status.antispyware_enabled,
                                "behavior_monitor_enabled": status.behavior_monitor_enabled,
                            }),
                        ));
                    }
                }
            }
        }

        None
    }

    #[cfg(target_os = "linux")]
    async fn check_antivirus(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        // Check ClamAV daemon status
        let output = Command::new("systemctl")
            .args(["is-active", "clamav-daemon"])
            .output();

        if let Ok(result) = output {
            let status = String::from_utf8_lossy(&result.stdout).trim().to_string();
            if status != "active" && status != "activating" {
                // ClamAV not running - this might be intentional, so only warn
                debug!("ClamAV daemon not active: {}", status);
            }
        }

        // Linux doesn't typically have mandatory AV, so no incident
        None
    }

    #[cfg(target_os = "macos")]
    async fn check_antivirus(&self) -> Option<SecurityIncident> {
        // macOS has XProtect built-in, which is always active
        // Check if Gatekeeper is enabled
        use std::process::Command;

        let output = Command::new("spctl").args(["--status"]).output();

        if let Ok(result) = output {
            let stdout = String::from_utf8_lossy(&result.stdout).to_lowercase();
            if stdout.contains("disabled") {
                return Some(
                    SecurityIncident::new(
                        IncidentType::AntivirusDisabled,
                        IncidentSeverity::Medium,
                        "Gatekeeper disabled",
                        "macOS Gatekeeper (application verification) is disabled",
                    )
                    .with_evidence(serde_json::json!({
                        "component": "gatekeeper",
                        "status": "disabled",
                    })),
                );
            }
        }

        None
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    async fn check_antivirus(&self) -> Option<SecurityIncident> {
        None
    }

    /// Check for SSH configuration issues.
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    async fn check_ssh_config(&self) -> Option<SecurityIncident> {
        use std::fs;

        let sshd_config = fs::read_to_string("/etc/ssh/sshd_config").ok()?;

        for line in sshd_config.lines() {
            let line = line.trim().to_lowercase();
            if line.starts_with("permitrootlogin")
                && !line.starts_with('#')
                && (line.contains("yes") || line.contains("without-password"))
            {
                return Some(SecurityIncident::system_change(
                    "SSH root login enabled",
                    "SSH server allows root login, which is a security risk",
                    IncidentSeverity::Medium,
                    serde_json::json!({
                        "setting": "PermitRootLogin",
                        "value": if line.contains("yes") { "yes" } else { "without-password" },
                    }),
                ));
            }
        }

        None
    }

    #[cfg(target_os = "windows")]
    async fn check_ssh_config(&self) -> Option<SecurityIncident> {
        // Windows SSH server is less common, skip for now
        None
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    async fn check_ssh_config(&self) -> Option<SecurityIncident> {
        None
    }

    /// Check for new admin accounts.
    #[cfg(target_os = "linux")]
    async fn check_admin_accounts(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        // Get members of sudo/wheel group
        let output = Command::new("getent").args(["group", "sudo"]).output();

        let admins: Vec<String> = if let Ok(result) = output {
            if result.status.success() {
                let stdout = String::from_utf8_lossy(&result.stdout);
                // Format: sudo:x:27:user1,user2
                if let Some(users) = stdout.split(':').nth(3) {
                    users.trim().split(',').map(|s| s.to_string()).collect()
                } else {
                    Vec::new()
                }
            } else {
                // Try wheel group instead
                let wheel_output = Command::new("getent").args(["group", "wheel"]).output();
                if let Ok(wheel_result) = wheel_output {
                    if wheel_result.status.success() {
                        let stdout = String::from_utf8_lossy(&wheel_result.stdout);
                        if let Some(users) = stdout.split(':').nth(3) {
                            users.trim().split(',').map(|s| s.to_string()).collect()
                        } else {
                            Vec::new()
                        }
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        };

        // Check for new admins (not in known list)
        if !self.known_admins.is_empty() {
            let new_admins: Vec<&String> = admins
                .iter()
                .filter(|a| !self.known_admins.contains(a))
                .collect();

            if !new_admins.is_empty() {
                return Some(SecurityIncident::system_change(
                    "New administrator account",
                    &format!(
                        "New user(s) with administrator privileges detected: {:?}",
                        new_admins
                    ),
                    IncidentSeverity::High,
                    serde_json::json!({
                        "new_admins": new_admins,
                        "known_admins": self.known_admins,
                    }),
                ));
            }
        }

        None
    }

    #[cfg(target_os = "macos")]
    async fn check_admin_accounts(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        let output = Command::new("dscl")
            .args([".", "-read", "/Groups/admin", "GroupMembership"])
            .output();

        if let Ok(result) = output
            && result.status.success()
        {
            let stdout = String::from_utf8_lossy(&result.stdout);
            // Format: GroupMembership: user1 user2
            let admins: Vec<String> = stdout
                .strip_prefix("GroupMembership: ")
                .unwrap_or(&stdout)
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();

            if !self.known_admins.is_empty() {
                let new_admins: Vec<&String> = admins
                    .iter()
                    .filter(|a| !self.known_admins.contains(a))
                    .collect();

                if !new_admins.is_empty() {
                    return Some(SecurityIncident::system_change(
                        "New administrator account",
                        &format!(
                            "New user(s) with administrator privileges detected: {:?}",
                            new_admins
                        ),
                        IncidentSeverity::High,
                        serde_json::json!({
                            "new_admins": new_admins,
                            "known_admins": self.known_admins,
                        }),
                    ));
                }
            }
        }

        None
    }

    #[cfg(target_os = "windows")]
    async fn check_admin_accounts(&self) -> Option<SecurityIncident> {
        use std::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-LocalGroupMember -Group "Administrators" | Select-Object -ExpandProperty Name"#,
            ])
            .output();

        if let Ok(result) = output {
            if result.status.success() {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let admins: Vec<String> = stdout.lines().map(|s| s.trim().to_string()).collect();

                if !self.known_admins.is_empty() {
                    let new_admins: Vec<&String> = admins
                        .iter()
                        .filter(|a| !self.known_admins.contains(a))
                        .collect();

                    if !new_admins.is_empty() {
                        return Some(SecurityIncident::system_change(
                            "New administrator account",
                            &format!(
                                "New user(s) with administrator privileges detected: {:?}",
                                new_admins
                            ),
                            IncidentSeverity::High,
                            serde_json::json!({
                                "new_admins": new_admins,
                                "known_admins": self.known_admins,
                            }),
                        ));
                    }
                }
            }
        }

        None
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    async fn check_admin_accounts(&self) -> Option<SecurityIncident> {
        None
    }

    /// Run all system security checks.
    pub async fn check_system(&self) -> ScannerResult<(Vec<SecurityIncident>, u32)> {
        let mut incidents = Vec::new();
        let mut checks_performed = 0u32;

        // Check firewall
        debug!("Checking firewall status...");
        checks_performed += 1;
        if let Some(incident) = self.check_firewall().await {
            warn!("Firewall issue detected");
            incidents.push(incident);
        }

        // Check antivirus
        debug!("Checking antivirus status...");
        checks_performed += 1;
        if let Some(incident) = self.check_antivirus().await {
            warn!("Antivirus issue detected");
            incidents.push(incident);
        }

        // Check SSH config
        debug!("Checking SSH configuration...");
        checks_performed += 1;
        if let Some(incident) = self.check_ssh_config().await {
            warn!("SSH configuration issue detected");
            incidents.push(incident);
        }

        // Check admin accounts
        debug!("Checking administrator accounts...");
        checks_performed += 1;
        if let Some(incident) = self.check_admin_accounts().await {
            warn!("Admin account change detected");
            incidents.push(incident);
        }

        info!(
            "System checks complete: {} issues found from {} checks",
            incidents.len(),
            checks_performed
        );

        Ok((incidents, checks_performed))
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_monitor_creation() {
        let monitor = SystemMonitor::new();
        assert!(monitor.known_admins.is_empty());
    }

    #[test]
    fn test_set_known_admins() {
        let mut monitor = SystemMonitor::new();
        monitor.set_known_admins(vec!["admin".to_string(), "root".to_string()]);
        assert_eq!(monitor.known_admins.len(), 2);
    }

    #[test]
    fn test_system_check_all() {
        let checks = SystemCheck::all();
        assert!(!checks.is_empty());
        assert!(checks.contains(&SystemCheck::FirewallDisabled));
    }
}
