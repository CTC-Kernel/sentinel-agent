//! SSH Hardening compliance check.
//!
//! Verifies SSH server and client configuration follows security best practices:
//! - Protocol version 2 only
//! - Root login disabled or restricted
//! - Key-based authentication preferred
//! - Strong ciphers and MACs
//! - MaxAuthTries and LoginGraceTime limits
//!
//! Supported platforms:
//! - Linux: Checks /etc/ssh/sshd_config and systemd status
//! - macOS: Checks /etc/ssh/sshd_config and Remote Login status
//! - Windows: Checks OpenSSH server configuration if installed

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for SSH hardening.
pub const CHECK_ID: &str = "ssh_hardening";

/// Weak ciphers that should be disabled.
const WEAK_CIPHERS: &[&str] = &[
    "3des-cbc",
    "aes128-cbc",
    "aes192-cbc",
    "aes256-cbc",
    "blowfish-cbc",
    "cast128-cbc",
    "arcfour",
    "arcfour128",
    "arcfour256",
];

/// Weak MACs that should be disabled.
const WEAK_MACS: &[&str] = &[
    "hmac-md5",
    "hmac-md5-96",
    "hmac-sha1",
    "hmac-sha1-96",
    "umac-64",
    "hmac-sha1-etm@openssh.com",
];

/// Weak key exchange algorithms.
#[allow(dead_code)] // Reserved for future KEX validation
const WEAK_KEX: &[&str] = &[
    "diffie-hellman-group1-sha1",
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group-exchange-sha1",
];

/// SSH hardening status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHardeningStatus {
    /// Whether SSH is properly hardened.
    pub hardened: bool,

    /// Whether SSH server is installed/running.
    pub ssh_server_active: bool,

    /// Whether root login is disabled.
    pub root_login_disabled: bool,

    /// Whether password authentication is disabled.
    pub password_auth_disabled: bool,

    /// Whether public key authentication is enabled.
    pub pubkey_auth_enabled: bool,

    /// Whether protocol version 2 is enforced.
    pub protocol_v2_only: bool,

    /// Whether X11 forwarding is disabled.
    pub x11_forwarding_disabled: bool,

    /// Whether agent forwarding is disabled.
    pub agent_forwarding_disabled: bool,

    /// Whether TCP forwarding is disabled.
    pub tcp_forwarding_disabled: bool,

    /// Whether strict modes are enabled.
    pub strict_modes_enabled: bool,

    /// Max authentication tries (recommended: 3-4).
    pub max_auth_tries: Option<u32>,

    /// Login grace time in seconds (recommended: 60 or less).
    pub login_grace_time: Option<u32>,

    /// List of configured ciphers.
    pub ciphers: Vec<String>,

    /// List of configured MACs.
    pub macs: Vec<String>,

    /// Whether weak ciphers are disabled.
    pub weak_ciphers_disabled: bool,

    /// Whether weak MACs are disabled.
    pub weak_macs_disabled: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Recommendations for improvement.
    #[serde(default)]
    pub recommendations: Vec<String>,

    /// Raw configuration content.
    #[serde(default)]
    pub raw_output: String,
}

/// SSH hardening compliance check.
pub struct SshHardeningCheck {
    definition: CheckDefinition,
}

impl SshHardeningCheck {
    /// Create a new SSH hardening check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("SSH Hardening")
            .description("Verify SSH server configuration follows security best practices")
            .category(CheckCategory::AccessControl)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec![
                "linux".to_string(),
                "macos".to_string(),
                "windows".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Parse SSH configuration value (handles yes/no, numbers, strings).
    fn parse_config_value(line: &str, key: &str) -> Option<String> {
        let line_lower = line.to_lowercase();
        let key_lower = key.to_lowercase();

        if line_lower.starts_with(&key_lower) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                return Some(parts[1].to_string());
            }
        }
        None
    }

    /// Check if a value indicates "yes" or enabled.
    fn is_enabled(value: &str) -> bool {
        let v = value.to_lowercase();
        v == "yes" || v == "true" || v == "1"
    }

    /// Check if a value indicates "no" or disabled.
    fn is_disabled(value: &str) -> bool {
        let v = value.to_lowercase();
        v == "no" || v == "false" || v == "0"
    }

    /// Parse sshd_config and populate status.
    fn parse_sshd_config(&self, config: &str, status: &mut SshHardeningStatus) {
        for line in config.lines() {
            let line = line.trim();

            // Skip comments and empty lines
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Root login
            if let Some(value) = Self::parse_config_value(line, "PermitRootLogin") {
                status.root_login_disabled = value.to_lowercase() == "no";
            }

            // Password authentication
            if let Some(value) = Self::parse_config_value(line, "PasswordAuthentication") {
                status.password_auth_disabled = Self::is_disabled(&value);
            }

            // Public key authentication
            if let Some(value) = Self::parse_config_value(line, "PubkeyAuthentication") {
                status.pubkey_auth_enabled = Self::is_enabled(&value);
            }

            // Protocol version (legacy, SSH2 is default in modern OpenSSH)
            if let Some(value) = Self::parse_config_value(line, "Protocol") {
                status.protocol_v2_only = value == "2";
            }

            // X11 forwarding
            if let Some(value) = Self::parse_config_value(line, "X11Forwarding") {
                status.x11_forwarding_disabled = Self::is_disabled(&value);
            }

            // Agent forwarding
            if let Some(value) = Self::parse_config_value(line, "AllowAgentForwarding") {
                status.agent_forwarding_disabled = Self::is_disabled(&value);
            }

            // TCP forwarding
            if let Some(value) = Self::parse_config_value(line, "AllowTcpForwarding") {
                status.tcp_forwarding_disabled = Self::is_disabled(&value);
            }

            // Strict modes
            if let Some(value) = Self::parse_config_value(line, "StrictModes") {
                status.strict_modes_enabled = Self::is_enabled(&value);
            }

            // Max auth tries
            if let Some(value) = Self::parse_config_value(line, "MaxAuthTries") {
                if let Ok(v) = value.parse::<u32>() {
                    status.max_auth_tries = Some(v);
                }
            }

            // Login grace time
            if let Some(value) = Self::parse_config_value(line, "LoginGraceTime") {
                // Parse value (can be in seconds or with suffix like 2m)
                let v = value.trim_end_matches('s').trim_end_matches('m');
                if let Ok(num) = v.parse::<u32>() {
                    let seconds = if value.ends_with('m') { num * 60 } else { num };
                    status.login_grace_time = Some(seconds);
                }
            }

            // Ciphers
            if let Some(value) = Self::parse_config_value(line, "Ciphers") {
                status.ciphers = value.split(',').map(|s| s.trim().to_string()).collect();
            }

            // MACs
            if let Some(value) = Self::parse_config_value(line, "MACs") {
                status.macs = value.split(',').map(|s| s.trim().to_string()).collect();
            }
        }

        // Check for weak ciphers
        status.weak_ciphers_disabled = !status.ciphers.iter().any(|c| {
            WEAK_CIPHERS.iter().any(|weak| c.to_lowercase() == *weak)
        });

        // Check for weak MACs
        status.weak_macs_disabled = !status.macs.iter().any(|m| {
            WEAK_MACS.iter().any(|weak| m.to_lowercase() == *weak)
        });

        // Set defaults for unspecified values (OpenSSH defaults)
        if !status.pubkey_auth_enabled && !config.to_lowercase().contains("pubkeyauthentication") {
            status.pubkey_auth_enabled = true; // Default is yes
        }

        if !config.to_lowercase().contains("protocol") {
            status.protocol_v2_only = true; // SSH2 is default in modern OpenSSH
        }

        if !config.to_lowercase().contains("strictmodes") {
            status.strict_modes_enabled = true; // Default is yes
        }
    }

    /// Generate issues and recommendations based on status.
    fn generate_findings(&self, status: &mut SshHardeningStatus) {
        // Critical issues
        if !status.root_login_disabled {
            status.issues.push("Root login is permitted".to_string());
            status.recommendations.push("Set PermitRootLogin no".to_string());
        }

        if !status.password_auth_disabled {
            status.issues.push("Password authentication is enabled".to_string());
            status.recommendations.push("Set PasswordAuthentication no and use key-based auth".to_string());
        }

        if !status.pubkey_auth_enabled {
            status.issues.push("Public key authentication is disabled".to_string());
            status.recommendations.push("Set PubkeyAuthentication yes".to_string());
        }

        // High severity issues
        if !status.weak_ciphers_disabled {
            status.issues.push("Weak ciphers are enabled".to_string());
            status.recommendations.push("Remove weak ciphers: 3des-cbc, *-cbc, arcfour*".to_string());
        }

        if !status.weak_macs_disabled {
            status.issues.push("Weak MACs are enabled".to_string());
            status.recommendations.push("Remove weak MACs: hmac-md5*, hmac-sha1*".to_string());
        }

        if let Some(tries) = status.max_auth_tries {
            if tries > 4 {
                status.issues.push(format!("MaxAuthTries is too high: {}", tries));
                status.recommendations.push("Set MaxAuthTries 3 or 4".to_string());
            }
        }

        if let Some(grace) = status.login_grace_time {
            if grace > 60 {
                status.issues.push(format!("LoginGraceTime is too high: {}s", grace));
                status.recommendations.push("Set LoginGraceTime 60 or lower".to_string());
            }
        }

        // Medium severity issues
        if !status.x11_forwarding_disabled {
            status.recommendations.push("Consider disabling X11Forwarding".to_string());
        }

        if !status.tcp_forwarding_disabled {
            status.recommendations.push("Consider disabling AllowTcpForwarding".to_string());
        }

        // Determine overall hardened status
        status.hardened = status.root_login_disabled
            && status.pubkey_auth_enabled
            && status.weak_ciphers_disabled
            && status.protocol_v2_only;
    }

    /// Check SSH hardening on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<SshHardeningStatus> {
        debug!("Checking Linux SSH hardening");

        let mut status = SshHardeningStatus {
            hardened: false,
            ssh_server_active: false,
            root_login_disabled: false,
            password_auth_disabled: false,
            pubkey_auth_enabled: false,
            protocol_v2_only: true, // Default for modern OpenSSH
            x11_forwarding_disabled: false,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: true,
            max_auth_tries: None,
            login_grace_time: None,
            ciphers: Vec::new(),
            macs: Vec::new(),
            weak_ciphers_disabled: true,
            weak_macs_disabled: true,
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check if SSH server is running
        if let Ok(output) = Command::new("systemctl")
            .args(["is-active", "sshd"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.ssh_server_active = result.trim() == "active";
            status.raw_output.push_str(&format!("sshd service: {}\n", result.trim()));
        } else if let Ok(output) = Command::new("systemctl")
            .args(["is-active", "ssh"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.ssh_server_active = result.trim() == "active";
            status.raw_output.push_str(&format!("ssh service: {}\n", result.trim()));
        }

        // Read sshd_config
        let config_path = "/etc/ssh/sshd_config";
        if let Ok(config) = std::fs::read_to_string(config_path) {
            status.raw_output.push_str(&format!("=== {} ===\n{}\n", config_path, config));
            self.parse_sshd_config(&config, &mut status);
        } else {
            status.issues.push("Cannot read /etc/ssh/sshd_config".to_string());
        }

        // Check sshd_config.d for drop-in configs
        let config_d = "/etc/ssh/sshd_config.d";
        if std::path::Path::new(config_d).exists() {
            if let Ok(entries) = std::fs::read_dir(config_d) {
                for entry in entries.filter_map(|e| e.ok()) {
                    if entry.path().extension().map_or(false, |e| e == "conf") {
                        if let Ok(content) = std::fs::read_to_string(entry.path()) {
                            status.raw_output.push_str(&format!(
                                "=== {} ===\n{}\n",
                                entry.path().display(),
                                content
                            ));
                            self.parse_sshd_config(&content, &mut status);
                        }
                    }
                }
            }
        }

        self.generate_findings(&mut status);

        Ok(status)
    }

    /// Check SSH hardening on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<SshHardeningStatus> {
        debug!("Checking macOS SSH hardening");

        let mut status = SshHardeningStatus {
            hardened: false,
            ssh_server_active: false,
            root_login_disabled: false,
            password_auth_disabled: false,
            pubkey_auth_enabled: false,
            protocol_v2_only: true,
            x11_forwarding_disabled: false,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: true,
            max_auth_tries: None,
            login_grace_time: None,
            ciphers: Vec::new(),
            macs: Vec::new(),
            weak_ciphers_disabled: true,
            weak_macs_disabled: true,
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check Remote Login status (macOS SSH server)
        if let Ok(output) = Command::new("systemsetup")
            .args(["-getremotelogin"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.ssh_server_active = result.to_lowercase().contains("on");
            status.raw_output.push_str(&format!("Remote Login: {}\n", result.trim()));
        }

        // Read sshd_config
        let config_path = "/etc/ssh/sshd_config";
        if let Ok(config) = std::fs::read_to_string(config_path) {
            status.raw_output.push_str(&format!("=== {} ===\n{}\n", config_path, config));
            self.parse_sshd_config(&config, &mut status);
        }

        self.generate_findings(&mut status);

        Ok(status)
    }

    /// Check SSH hardening on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<SshHardeningStatus> {
        debug!("Checking Windows SSH hardening (OpenSSH)");

        let mut status = SshHardeningStatus {
            hardened: false,
            ssh_server_active: false,
            root_login_disabled: true, // Different model on Windows
            password_auth_disabled: false,
            pubkey_auth_enabled: false,
            protocol_v2_only: true,
            x11_forwarding_disabled: true,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: true,
            max_auth_tries: None,
            login_grace_time: None,
            ciphers: Vec::new(),
            macs: Vec::new(),
            weak_ciphers_disabled: true,
            weak_macs_disabled: true,
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check if OpenSSH server is installed and running
        let service_output = Command::new("sc")
            .args(["query", "sshd"])
            .output();

        if let Ok(output) = service_output {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.ssh_server_active = result.contains("RUNNING");
            status.raw_output.push_str(&format!("sshd service:\n{}\n", result));

            if !output.status.success() {
                // OpenSSH not installed
                status.issues.push("OpenSSH server not installed".to_string());
                return Ok(status);
            }
        }

        // Check OpenSSH config
        let config_path = r"C:\ProgramData\ssh\sshd_config";
        if let Ok(config) = std::fs::read_to_string(config_path) {
            status.raw_output.push_str(&format!("=== {} ===\n{}\n", config_path, config));
            self.parse_sshd_config(&config, &mut status);
        } else {
            // Try alternative path
            let alt_path = r"C:\Windows\System32\OpenSSH\sshd_config_default";
            if let Ok(config) = std::fs::read_to_string(alt_path) {
                status.raw_output.push_str(&format!("=== {} ===\n{}\n", alt_path, config));
                self.parse_sshd_config(&config, &mut status);
            }
        }

        self.generate_findings(&mut status);

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<SshHardeningStatus> {
        Ok(SshHardeningStatus {
            hardened: false,
            ssh_server_active: false,
            root_login_disabled: false,
            password_auth_disabled: false,
            pubkey_auth_enabled: false,
            protocol_v2_only: false,
            x11_forwarding_disabled: false,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: false,
            max_auth_tries: None,
            login_grace_time: None,
            ciphers: Vec::new(),
            macs: Vec::new(),
            weak_ciphers_disabled: false,
            weak_macs_disabled: false,
            issues: vec!["Unsupported platform".to_string()],
            recommendations: Vec::new(),
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for SshHardeningCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for SshHardeningCheck {
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

        if !status.ssh_server_active {
            return Ok(CheckOutput::pass(
                "SSH server is not active (no hardening required)".to_string(),
                raw_data,
            ));
        }

        if status.hardened {
            let mut details = Vec::new();
            if status.root_login_disabled {
                details.push("root_login=disabled".to_string());
            }
            if status.password_auth_disabled {
                details.push("password_auth=disabled".to_string());
            }
            if status.pubkey_auth_enabled {
                details.push("pubkey_auth=enabled".to_string());
            }
            if status.weak_ciphers_disabled {
                details.push("weak_ciphers=disabled".to_string());
            }

            Ok(CheckOutput::pass(
                format!("SSH is properly hardened: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "SSH hardening issues ({}): {}",
                    status.issues.len(),
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
        let check = SshHardeningCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::AccessControl);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = SshHardeningCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"ISO_27001".to_string()));
    }

    #[test]
    fn test_config_parsing() {
        let check = SshHardeningCheck::new();
        let mut status = SshHardeningStatus {
            hardened: false,
            ssh_server_active: true,
            root_login_disabled: false,
            password_auth_disabled: false,
            pubkey_auth_enabled: false,
            protocol_v2_only: false,
            x11_forwarding_disabled: false,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: false,
            max_auth_tries: None,
            login_grace_time: None,
            ciphers: Vec::new(),
            macs: Vec::new(),
            weak_ciphers_disabled: true,
            weak_macs_disabled: true,
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        let config = r#"
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 60
X11Forwarding no
        "#;

        check.parse_sshd_config(config, &mut status);

        assert!(status.root_login_disabled);
        assert!(status.password_auth_disabled);
        assert!(status.pubkey_auth_enabled);
        assert_eq!(status.max_auth_tries, Some(3));
        assert_eq!(status.login_grace_time, Some(60));
        assert!(status.x11_forwarding_disabled);
    }

    #[test]
    fn test_ssh_status_serialization() {
        let status = SshHardeningStatus {
            hardened: true,
            ssh_server_active: true,
            root_login_disabled: true,
            password_auth_disabled: true,
            pubkey_auth_enabled: true,
            protocol_v2_only: true,
            x11_forwarding_disabled: true,
            agent_forwarding_disabled: false,
            tcp_forwarding_disabled: false,
            strict_modes_enabled: true,
            max_auth_tries: Some(3),
            login_grace_time: Some(60),
            ciphers: vec!["chacha20-poly1305@openssh.com".to_string()],
            macs: vec!["hmac-sha2-256-etm@openssh.com".to_string()],
            weak_ciphers_disabled: true,
            weak_macs_disabled: true,
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"hardened\":true"));
        assert!(json.contains("\"root_login_disabled\":true"));

        let parsed: SshHardeningStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.hardened);
        assert_eq!(parsed.max_auth_tries, Some(3));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = SshHardeningCheck::new();
        let result = check.execute().await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
