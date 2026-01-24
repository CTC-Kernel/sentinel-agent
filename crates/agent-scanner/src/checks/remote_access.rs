//! Remote access security compliance check.
//!
//! Verifies remote access security configuration:
//! - Windows: RDP settings, remote management
//! - Linux: SSH configuration
//! - macOS: Screen sharing, SSH, remote management

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for remote access security.
pub const CHECK_ID: &str = "remote_access";

/// Remote access security status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAccessStatus {
    /// Whether remote access is enabled.
    pub remote_access_enabled: bool,

    /// SSH configuration details.
    #[serde(default)]
    pub ssh_config: Option<SshConfig>,

    /// RDP configuration details (Windows).
    #[serde(default)]
    pub rdp_config: Option<RdpConfig>,

    /// Screen sharing enabled (macOS).
    pub screen_sharing_enabled: Option<bool>,

    /// Remote management enabled.
    pub remote_management_enabled: Option<bool>,

    /// List of security issues found.
    #[serde(default)]
    pub security_issues: Vec<String>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// SSH configuration details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    /// Whether SSH is enabled/running.
    pub enabled: bool,

    /// Whether root login is permitted.
    pub permit_root_login: Option<bool>,

    /// Whether password authentication is enabled.
    pub password_auth: Option<bool>,

    /// Whether public key authentication is enabled.
    pub pubkey_auth: Option<bool>,

    /// SSH port.
    pub port: Option<u16>,

    /// Allowed authentication methods.
    #[serde(default)]
    pub auth_methods: Vec<String>,
}

/// RDP configuration details (Windows).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdpConfig {
    /// Whether RDP is enabled.
    pub enabled: bool,

    /// Whether NLA (Network Level Authentication) is required.
    pub nla_required: Option<bool>,

    /// RDP port.
    pub port: Option<u16>,

    /// Whether high encryption is required.
    pub high_encryption: Option<bool>,
}

/// Remote access security compliance check.
pub struct RemoteAccessCheck {
    definition: CheckDefinition,
}

impl RemoteAccessCheck {
    /// Create a new remote access security check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Remote Access Security")
            .description("Verify remote access security configuration")
            .category(CheckCategory::RemoteAccess)
            .severity(CheckSeverity::High)
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

    /// Check remote access on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<RemoteAccessStatus> {
        debug!("Checking Windows remote access security");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Check RDP status
                $rdpEnabled = (Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name 'fDenyTSConnections' -ErrorAction SilentlyContinue).fDenyTSConnections
                $results['RdpEnabled'] = ($rdpEnabled -eq 0)

                # Check NLA requirement
                $nlaRequired = (Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'UserAuthentication' -ErrorAction SilentlyContinue).UserAuthentication
                $results['NlaRequired'] = ($nlaRequired -eq 1)

                # Check RDP port
                $rdpPort = (Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'PortNumber' -ErrorAction SilentlyContinue).PortNumber
                $results['RdpPort'] = $rdpPort

                # Check encryption level
                $encLevel = (Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name 'MinEncryptionLevel' -ErrorAction SilentlyContinue).MinEncryptionLevel
                $results['EncryptionLevel'] = $encLevel

                # Check WinRM status
                try {
                    $winrmService = Get-Service WinRM -ErrorAction SilentlyContinue
                    $results['WinRMRunning'] = ($winrmService.Status -eq 'Running')
                } catch {
                    $results['WinRMRunning'] = $false
                }

                # Check SSH Server status (Windows 10+)
                try {
                    $sshService = Get-Service sshd -ErrorAction SilentlyContinue
                    $results['SshEnabled'] = ($sshService -and $sshService.Status -eq 'Running')
                } catch {
                    $results['SshEnabled'] = $false
                }

                $results | ConvertTo-Json
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = RemoteAccessStatus {
            remote_access_enabled: false,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // RDP configuration
            let rdp_enabled = json
                .get("RdpEnabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let nla_required = json.get("NlaRequired").and_then(|v| v.as_bool());
            let rdp_port = json
                .get("RdpPort")
                .and_then(|v| v.as_u64())
                .map(|p| p as u16);
            let enc_level = json.get("EncryptionLevel").and_then(|v| v.as_u64());

            if rdp_enabled {
                status.remote_access_enabled = true;

                status.rdp_config = Some(RdpConfig {
                    enabled: true,
                    nla_required,
                    port: rdp_port,
                    high_encryption: enc_level.map(|e| e >= 3),
                });

                // Check RDP security
                if nla_required != Some(true) {
                    status
                        .security_issues
                        .push("RDP: NLA not required".to_string());
                }
                if enc_level.map(|e| e < 3).unwrap_or(false) {
                    status
                        .security_issues
                        .push("RDP: Low encryption level".to_string());
                }
            }

            // SSH configuration
            if json.get("SshEnabled").and_then(|v| v.as_bool()) == Some(true) {
                status.remote_access_enabled = true;
                status.ssh_config = Some(SshConfig {
                    enabled: true,
                    permit_root_login: None,
                    password_auth: None,
                    pubkey_auth: None,
                    port: Some(22),
                    auth_methods: vec![],
                });
            }

            // WinRM
            if json.get("WinRMRunning").and_then(|v| v.as_bool()) == Some(true) {
                status.remote_management_enabled = Some(true);
                status.remote_access_enabled = true;
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check remote access on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<RemoteAccessStatus> {
        debug!("Checking Linux remote access security");

        let mut status = RemoteAccessStatus {
            remote_access_enabled: false,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check SSH service status
        let ssh_running = if let Ok(output) = Command::new("systemctl")
            .args(["is-active", "sshd"])
            .output()
        {
            String::from_utf8_lossy(&output.stdout).trim() == "active"
        } else if let Ok(output) = Command::new("systemctl")
            .args(["is-active", "ssh"])
            .output()
        {
            String::from_utf8_lossy(&output.stdout).trim() == "active"
        } else {
            false
        };

        if ssh_running {
            status.remote_access_enabled = true;

            let mut ssh_config = SshConfig {
                enabled: true,
                permit_root_login: None,
                password_auth: None,
                pubkey_auth: None,
                port: Some(22),
                auth_methods: vec![],
            };

            // Parse sshd_config
            if let Ok(content) = std::fs::read_to_string("/etc/ssh/sshd_config") {
                status
                    .raw_output
                    .push_str(&format!("=== /etc/ssh/sshd_config ===\n"));

                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || line.is_empty() {
                        continue;
                    }

                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        match parts[0].to_lowercase().as_str() {
                            "permitrootlogin" => {
                                let value = parts[1].to_lowercase();
                                ssh_config.permit_root_login = Some(value == "yes");
                                if value == "yes" {
                                    status
                                        .security_issues
                                        .push("SSH: Root login permitted".to_string());
                                }
                                status
                                    .raw_output
                                    .push_str(&format!("PermitRootLogin: {}\n", parts[1]));
                            }
                            "passwordauthentication" => {
                                let value = parts[1].to_lowercase();
                                ssh_config.password_auth = Some(value == "yes");
                                if value == "yes" {
                                    status
                                        .security_issues
                                        .push("SSH: Password authentication enabled".to_string());
                                }
                                status
                                    .raw_output
                                    .push_str(&format!("PasswordAuthentication: {}\n", parts[1]));
                            }
                            "pubkeyauthentication" => {
                                ssh_config.pubkey_auth = Some(parts[1].to_lowercase() == "yes");
                            }
                            "port" => {
                                ssh_config.port = parts[1].parse().ok();
                            }
                            _ => {}
                        }
                    }
                }
            }

            status.ssh_config = Some(ssh_config);
        }

        // Check for VNC servers
        if let Ok(output) = Command::new("pgrep").args(["-a", "vnc"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            if !result.is_empty() {
                status.screen_sharing_enabled = Some(true);
                status.remote_access_enabled = true;
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check remote access on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<RemoteAccessStatus> {
        debug!("Checking macOS remote access security");

        let mut status = RemoteAccessStatus {
            remote_access_enabled: false,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check Screen Sharing
        if let Ok(output) = Command::new("launchctl")
            .args(["list", "com.apple.screensharing"])
            .output()
        {
            let enabled = output.status.success();
            status.screen_sharing_enabled = Some(enabled);
            if enabled {
                status.remote_access_enabled = true;
            }
        }

        // Check Remote Management (ARD)
        if let Ok(output) = Command::new("launchctl")
            .args(["list", "com.apple.RemoteDesktop.agent"])
            .output()
        {
            let enabled = output.status.success();
            status.remote_management_enabled = Some(enabled);
            if enabled {
                status.remote_access_enabled = true;
            }
        }

        // Check SSH (Remote Login)
        if let Ok(output) = Command::new("systemsetup")
            .args(["-getremotelogin"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("Remote Login: {}\n", result.trim()));

            if result.to_lowercase().contains("on") {
                status.remote_access_enabled = true;

                let mut ssh_config = SshConfig {
                    enabled: true,
                    permit_root_login: None,
                    password_auth: Some(true), // Default on macOS
                    pubkey_auth: Some(true),
                    port: Some(22),
                    auth_methods: vec!["publickey".to_string(), "password".to_string()],
                };

                // Parse sshd_config
                if let Ok(content) = std::fs::read_to_string("/etc/ssh/sshd_config") {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with('#') || line.is_empty() {
                            continue;
                        }

                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            match parts[0].to_lowercase().as_str() {
                                "permitrootlogin" => {
                                    let value = parts[1].to_lowercase();
                                    ssh_config.permit_root_login = Some(value == "yes");
                                    if value == "yes" {
                                        status
                                            .security_issues
                                            .push("SSH: Root login permitted".to_string());
                                    }
                                }
                                "passwordauthentication" => {
                                    let value = parts[1].to_lowercase();
                                    ssh_config.password_auth = Some(value == "yes");
                                }
                                _ => {}
                            }
                        }
                    }
                }

                status.ssh_config = Some(ssh_config);
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<RemoteAccessStatus> {
        Ok(RemoteAccessStatus {
            remote_access_enabled: false,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &RemoteAccessStatus) -> Vec<String> {
        let issues = status.security_issues.clone();

        // If remote access is enabled, there should be proper security
        if status.remote_access_enabled && issues.is_empty() {
            // Remote access is enabled with good security
            return vec![];
        }

        issues
    }
}

impl Default for RemoteAccessCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for RemoteAccessCheck {
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
            if !status.remote_access_enabled {
                details.push("remote_access=disabled".to_string());
            } else {
                if status.ssh_config.is_some() {
                    details.push("ssh=secure".to_string());
                }
                if let Some(rdp) = &status.rdp_config {
                    if rdp.nla_required == Some(true) {
                        details.push("rdp=nla_enabled".to_string());
                    }
                }
            }

            Ok(CheckOutput::pass(
                format!("Remote access is secure: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "Remote access security issues: {}",
                    status.issues.join("; ")
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
        let check = RemoteAccessCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::RemoteAccess);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = RemoteAccessCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_remote_access_status_serialization() {
        let status = RemoteAccessStatus {
            remote_access_enabled: true,
            ssh_config: Some(SshConfig {
                enabled: true,
                permit_root_login: Some(false),
                password_auth: Some(false),
                pubkey_auth: Some(true),
                port: Some(22),
                auth_methods: vec!["publickey".to_string()],
            }),
            rdp_config: None,
            screen_sharing_enabled: Some(false),
            remote_management_enabled: Some(false),
            security_issues: vec![],
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"remote_access_enabled\":true"));
        assert!(json.contains("\"permit_root_login\":false"));

        let parsed: RemoteAccessStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.remote_access_enabled);
        assert!(parsed.ssh_config.is_some());
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = RemoteAccessCheck::new();
        let status = RemoteAccessStatus {
            remote_access_enabled: true,
            ssh_config: Some(SshConfig {
                enabled: true,
                permit_root_login: Some(false),
                password_auth: Some(false),
                pubkey_auth: Some(true),
                port: Some(22),
                auth_methods: vec![],
            }),
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_root_login() {
        let check = RemoteAccessCheck::new();
        let status = RemoteAccessStatus {
            remote_access_enabled: true,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec!["SSH: Root login permitted".to_string()],
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("Root login")));
    }

    #[test]
    fn test_compliance_disabled() {
        let check = RemoteAccessCheck::new();
        let status = RemoteAccessStatus {
            remote_access_enabled: false,
            ssh_config: None,
            rdp_config: None,
            screen_sharing_enabled: None,
            remote_management_enabled: None,
            security_issues: vec![],
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = RemoteAccessCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
