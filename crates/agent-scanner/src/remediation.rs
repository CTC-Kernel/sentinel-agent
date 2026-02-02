//! Automated remediation engine for compliance check failures.
//!
//! Provides pre-built remediation actions for common compliance issues,
//! with dry-run preview, execution, and rollback support.

use agent_common::types::{
    RemediationAction, RemediationResult, RemediationRisk, RemediationStatus,
};
use chrono::Utc;
use std::collections::HashMap;
use std::process::Command;
use std::time::Instant;
use tracing::{info, warn};

/// Remediation engine managing actions for check failures.
pub struct RemediationEngine {
    /// Available remediation actions per check_id and platform.
    actions: HashMap<String, Vec<RemediationAction>>,
}

impl RemediationEngine {
    /// Create a new remediation engine with pre-built actions.
    pub fn new() -> Self {
        let mut engine = Self {
            actions: HashMap::new(),
        };
        engine.register_builtin_actions();
        engine
    }

    /// Get available remediation actions for a check.
    pub fn get_remediation(&self, check_id: &str) -> Option<&[RemediationAction]> {
        self.actions.get(check_id).map(|v| v.as_slice())
    }

    /// Get all available remediations filtered by current platform.
    pub fn get_platform_remediation(&self, check_id: &str) -> Vec<&RemediationAction> {
        let platform = current_platform();
        self.actions
            .get(check_id)
            .map(|actions| {
                actions
                    .iter()
                    .filter(|a| a.platform == platform || a.platform == "all")
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Preview what a remediation action would do (dry-run).
    pub fn dry_run(&self, action: &RemediationAction) -> String {
        format!(
            "--- Remediation Preview ---\n\
             Check: {}\n\
             Platform: {}\n\
             Risk: {}\n\
             Requires Admin: {}\n\
             Requires Reboot: {}\n\
             \n\
             Description: {}\n\
             \n\
             Command to execute:\n  {}\n\
             \n\
             Rollback command:\n  {}\n\
             ---",
            action.check_id,
            action.platform,
            action.risk_level.label(),
            action.requires_admin,
            action.requires_reboot,
            action.description,
            action.script,
            action
                .rollback_script
                .as_deref()
                .unwrap_or("(no rollback available)"),
        )
    }

    /// Execute a remediation action.
    pub fn execute(&self, action: &RemediationAction) -> RemediationResult {
        let start = Instant::now();

        info!(
            "Executing remediation for check '{}': {}",
            action.check_id, action.description
        );

        let result = execute_script(&action.script, &action.platform);
        let duration_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(output) => {
                info!(
                    "Remediation for '{}' completed successfully",
                    action.check_id
                );
                RemediationResult {
                    check_id: action.check_id.clone(),
                    status: RemediationStatus::Success,
                    output,
                    error: None,
                    executed_at: Utc::now(),
                    duration_ms,
                }
            }
            Err(error) => {
                warn!("Remediation for '{}' failed: {}", action.check_id, error);
                RemediationResult {
                    check_id: action.check_id.clone(),
                    status: RemediationStatus::Failed,
                    output: String::new(),
                    error: Some(error),
                    executed_at: Utc::now(),
                    duration_ms,
                }
            }
        }
    }

    /// Execute a rollback for a remediation action.
    pub fn rollback(&self, action: &RemediationAction) -> Option<RemediationResult> {
        let rollback_script = action.rollback_script.as_ref()?;
        let start = Instant::now();

        info!("Rolling back remediation for '{}'", action.check_id);

        let result = execute_script(rollback_script, &action.platform);
        let duration_ms = start.elapsed().as_millis() as u64;

        Some(match result {
            Ok(output) => RemediationResult {
                check_id: action.check_id.clone(),
                status: RemediationStatus::RolledBack,
                output,
                error: None,
                executed_at: Utc::now(),
                duration_ms,
            },
            Err(error) => RemediationResult {
                check_id: action.check_id.clone(),
                status: RemediationStatus::Failed,
                output: String::new(),
                error: Some(format!("Rollback failed: {}", error)),
                executed_at: Utc::now(),
                duration_ms,
            },
        })
    }

    /// Check which checks have available remediations.
    pub fn available_check_ids(&self) -> Vec<&str> {
        self.actions.keys().map(|s| s.as_str()).collect()
    }

    /// Register all built-in remediation actions.
    fn register_builtin_actions(&mut self) {
        // Firewall
        self.register(
            "firewall_active",
            vec![
                RemediationAction {
                    check_id: "firewall_active".to_string(),
                    platform: "linux".to_string(),
                    script: "ufw --force enable".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Moderate,
                    description: "Enable the UFW firewall with default deny incoming policy"
                        .to_string(),
                    rollback_script: Some("ufw disable".to_string()),
                },
                RemediationAction {
                    check_id: "firewall_active".to_string(),
                    platform: "windows".to_string(),
                    script: "netsh advfirewall set allprofiles state on".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Moderate,
                    description: "Enable Windows Firewall for all profiles".to_string(),
                    rollback_script: Some(
                        "netsh advfirewall set allprofiles state off".to_string(),
                    ),
                },
                RemediationAction {
                    check_id: "firewall_active".to_string(),
                    platform: "macos".to_string(),
                    script: "/usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on"
                        .to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Moderate,
                    description: "Enable macOS Application Firewall".to_string(),
                    rollback_script: Some(
                        "/usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off"
                            .to_string(),
                    ),
                },
            ],
        );

        // Session lock
        self.register("screen_lock", vec![
            RemediationAction {
                check_id: "screen_lock".to_string(),
                platform: "linux".to_string(),
                script: "gsettings set org.gnome.desktop.session idle-delay 300 && gsettings set org.gnome.desktop.screensaver lock-enabled true".to_string(),
                requires_reboot: false,
                requires_admin: false,
                risk_level: RemediationRisk::Safe,
                description: "Set screen lock timeout to 5 minutes on GNOME".to_string(),
                rollback_script: None,
            },
            RemediationAction {
                check_id: "screen_lock".to_string(),
                platform: "windows".to_string(),
                script: r#"powershell -NoProfile -Command "Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'InactivityTimeoutSecs' -Value 300""#.to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Set Windows inactivity timeout to 5 minutes".to_string(),
                rollback_script: None,
            },
            RemediationAction {
                check_id: "screen_lock".to_string(),
                platform: "macos".to_string(),
                script: "defaults write com.apple.screensaver idleTime -int 300 && defaults write com.apple.screensaver askForPassword -int 1".to_string(),
                requires_reboot: false,
                requires_admin: false,
                risk_level: RemediationRisk::Safe,
                description: "Set macOS screen lock to 5 minutes with password".to_string(),
                rollback_script: None,
            },
        ]);

        // System updates
        self.register(
            "patches_current",
            vec![
                RemediationAction {
                    check_id: "patches_current".to_string(),
                    platform: "linux".to_string(),
                    script: "apt update && apt list --upgradable".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Check for available system updates".to_string(),
                    rollback_script: None,
                },
                RemediationAction {
                    check_id: "patches_current".to_string(),
                    platform: "macos".to_string(),
                    script: "softwareupdate --list".to_string(),
                    requires_reboot: false,
                    requires_admin: false,
                    risk_level: RemediationRisk::Safe,
                    description: "Check for available macOS updates".to_string(),
                    rollback_script: None,
                },
            ],
        );

        // Obsolete protocols
        self.register("obsolete_protocols", vec![
            RemediationAction {
                check_id: "obsolete_protocols".to_string(),
                platform: "linux".to_string(),
                script: "sed -i 's/^\\(ssl_protocols.*\\)TLSv1 /\\1/' /etc/nginx/nginx.conf && sed -i 's/^\\(ssl_protocols.*\\)TLSv1.1 /\\1/' /etc/nginx/nginx.conf".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Risky,
                description: "Disable TLS 1.0 and 1.1 in nginx configuration".to_string(),
                rollback_script: None,
            },
            RemediationAction {
                check_id: "obsolete_protocols".to_string(),
                platform: "windows".to_string(),
                script: r#"powershell -NoProfile -Command "New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Force | New-ItemProperty -Name Enabled -Value 0 -PropertyType DWord""#.to_string(),
                requires_reboot: true,
                requires_admin: true,
                risk_level: RemediationRisk::Risky,
                description: "Disable TLS 1.0 in Windows Schannel registry".to_string(),
                rollback_script: Some(r#"powershell -NoProfile -Command "Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Name Enabled -Value 1""#.to_string()),
            },
        ]);

        // Audit logging
        self.register(
            "audit_logging",
            vec![RemediationAction {
                check_id: "audit_logging".to_string(),
                platform: "linux".to_string(),
                script: "systemctl enable auditd && systemctl start auditd".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Enable and start the Linux audit daemon".to_string(),
                rollback_script: Some("systemctl stop auditd".to_string()),
            }],
        );

        // Time sync
        self.register(
            "time_sync",
            vec![
                RemediationAction {
                    check_id: "time_sync".to_string(),
                    platform: "linux".to_string(),
                    script: "timedatectl set-ntp true".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable NTP time synchronization".to_string(),
                    rollback_script: Some("timedatectl set-ntp false".to_string()),
                },
                RemediationAction {
                    check_id: "time_sync".to_string(),
                    platform: "macos".to_string(),
                    script: "systemsetup -setusingnetworktime on".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable network time synchronization on macOS".to_string(),
                    rollback_script: None,
                },
            ],
        );

        // Bluetooth disabled
        self.register(
            "bluetooth_disabled",
            vec![RemediationAction {
                check_id: "bluetooth_disabled".to_string(),
                platform: "linux".to_string(),
                script: "systemctl disable bluetooth && systemctl stop bluetooth".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Moderate,
                description: "Disable the Bluetooth service".to_string(),
                rollback_script: Some(
                    "systemctl enable bluetooth && systemctl start bluetooth".to_string(),
                ),
            }],
        );

        // Guest account
        self.register("guest_account_disabled", vec![
            RemediationAction {
                check_id: "guest_account_disabled".to_string(),
                platform: "windows".to_string(),
                script: "net user Guest /active:no".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Disable the Windows Guest account".to_string(),
                rollback_script: Some("net user Guest /active:yes".to_string()),
            },
            RemediationAction {
                check_id: "guest_account_disabled".to_string(),
                platform: "macos".to_string(),
                script: "defaults write /Library/Preferences/com.apple.loginwindow GuestEnabled -bool false".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Disable macOS Guest account".to_string(),
                rollback_script: Some("defaults write /Library/Preferences/com.apple.loginwindow GuestEnabled -bool true".to_string()),
            },
        ]);
    }

    /// Register remediation actions for a check.
    fn register(&mut self, check_id: &str, actions: Vec<RemediationAction>) {
        self.actions.insert(check_id.to_string(), actions);
    }
}

impl Default for RemediationEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Execute a script on the current platform.
fn execute_script(script: &str, platform: &str) -> Result<String, String> {
    let output = if platform == "windows" || cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", script]).output()
    } else {
        Command::new("sh").args(["-c", script]).output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();

            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Exit code {}: {}", out.status, stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute: {}", e)),
    }
}

/// Get the current platform string.
fn current_platform() -> String {
    #[cfg(target_os = "windows")]
    {
        "windows".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "linux".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "macos".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        "unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remediation_engine_creation() {
        let engine = RemediationEngine::new();
        assert!(!engine.available_check_ids().is_empty());
    }

    #[test]
    fn test_get_remediation() {
        let engine = RemediationEngine::new();
        let actions = engine.get_remediation("firewall_active");
        assert!(actions.is_some());
        assert!(!actions.unwrap().is_empty());
    }

    #[test]
    fn test_get_nonexistent_remediation() {
        let engine = RemediationEngine::new();
        assert!(engine.get_remediation("nonexistent_check").is_none());
    }

    #[test]
    fn test_dry_run() {
        let engine = RemediationEngine::new();
        let actions = engine.get_remediation("firewall_active").unwrap();
        let preview = engine.dry_run(&actions[0]);
        assert!(preview.contains("Remediation Preview"));
        assert!(preview.contains("firewall_active"));
    }

    #[test]
    fn test_platform_remediation() {
        let engine = RemediationEngine::new();
        let actions = engine.get_platform_remediation("firewall_active");
        // Should have at most 1 action for the current platform
        assert!(actions.len() <= 1);
    }

    #[test]
    fn test_available_check_ids() {
        let engine = RemediationEngine::new();
        let ids = engine.available_check_ids();
        assert!(ids.contains(&"firewall_active"));
        assert!(ids.contains(&"screen_lock"));
        assert!(ids.contains(&"patches_current"));
    }
}
