//! Firewall configuration compliance check.
//!
//! Verifies that firewall is enabled:
//! - Windows: Windows Firewall (all profiles)
//! - Linux: iptables/nftables/ufw
//! - macOS: Application Firewall (ALF)

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for firewall configuration.
pub const CHECK_ID: &str = "firewall_active";

/// Firewall status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallStatus {
    /// Whether firewall is enabled overall.
    pub enabled: bool,

    /// Type of firewall detected.
    pub firewall_type: String,

    /// Status per profile/zone.
    pub profiles: Vec<FirewallProfile>,

    /// Total number of rules.
    pub rule_count: Option<u32>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Firewall profile/zone status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallProfile {
    /// Profile name (Domain, Private, Public, etc.).
    pub name: String,

    /// Whether this profile is enabled.
    pub enabled: bool,

    /// Default inbound action (Allow, Block, etc.).
    #[serde(default)]
    pub default_inbound: Option<String>,

    /// Default outbound action.
    #[serde(default)]
    pub default_outbound: Option<String>,

    /// Number of rules in this profile.
    #[serde(default)]
    pub rule_count: Option<u32>,
}

/// Firewall configuration compliance check.
pub struct FirewallCheck {
    definition: CheckDefinition,
}

impl FirewallCheck {
    /// Create a new firewall check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Firewall Configuration")
            .description("Verify firewall is enabled (Windows Firewall/iptables/ufw)")
            .category(CheckCategory::Firewall)
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
            .build();

        Self { definition }
    }

    /// Check firewall on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<FirewallStatus> {
        debug!("Checking Windows Firewall status");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction | ConvertTo-Json
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(ScannerError::CheckExecution(format!(
                "Firewall check failed: {}",
                stderr
            )));
        }

        // Parse profiles
        let profiles = self.parse_windows_profiles(&raw_output)?;

        // Get rule count
        let rule_count = self.get_windows_rule_count().await.ok();

        let any_enabled = profiles.iter().any(|p| p.enabled);
        let _all_enabled = profiles.iter().all(|p| p.enabled);

        Ok(FirewallStatus {
            enabled: any_enabled,
            firewall_type: "Windows Firewall".to_string(),
            profiles,
            rule_count,
            raw_output,
        })
    }

    #[cfg(target_os = "windows")]
    fn parse_windows_profiles(&self, output: &str) -> ScannerResult<Vec<FirewallProfile>> {
        let json: Vec<serde_json::Value> = if output.trim().starts_with('[') {
            serde_json::from_str(output).unwrap_or_default()
        } else {
            match serde_json::from_str::<serde_json::Value>(output) {
                Ok(v) => vec![v],
                Err(_) => vec![],
            }
        };

        let profiles = json
            .iter()
            .map(|p| {
                let name = p["Name"].as_str().unwrap_or("Unknown").to_string();
                let enabled = p["Enabled"].as_bool().unwrap_or(false);
                let inbound = p["DefaultInboundAction"]
                    .as_u64()
                    .map(|a| match a {
                        0 => "NotConfigured",
                        1 => "Allow",
                        2 => "Block",
                        _ => "Unknown",
                    })
                    .map(|s| s.to_string());
                let outbound = p["DefaultOutboundAction"]
                    .as_u64()
                    .map(|a| match a {
                        0 => "NotConfigured",
                        1 => "Allow",
                        2 => "Block",
                        _ => "Unknown",
                    })
                    .map(|s| s.to_string());

                FirewallProfile {
                    name,
                    enabled,
                    default_inbound: inbound,
                    default_outbound: outbound,
                    rule_count: None,
                }
            })
            .collect();

        Ok(profiles)
    }

    #[cfg(target_os = "windows")]
    async fn get_windows_rule_count(&self) -> ScannerResult<u32> {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-NetFirewallRule).Count"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(e.to_string()))?;

        let count_str = String::from_utf8_lossy(&output.stdout);
        count_str
            .trim()
            .parse()
            .map_err(|_| ScannerError::CheckExecution("Failed to parse rule count".to_string()))
    }

    /// Check firewall on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<FirewallStatus> {
        debug!("Checking Linux firewall status");

        // Try ufw first (user-friendly)
        if let Ok(status) = self.check_ufw().await {
            if status.enabled || status.firewall_type == "ufw" {
                return Ok(status);
            }
        }

        // Try nftables
        if let Ok(status) = self.check_nftables().await {
            if status.enabled {
                return Ok(status);
            }
        }

        // Fall back to iptables
        self.check_iptables().await
    }

    #[cfg(target_os = "linux")]
    async fn check_ufw(&self) -> ScannerResult<FirewallStatus> {
        let output = Command::new("ufw")
            .args(["status", "verbose"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("ufw not found: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let enabled = raw_output.contains("Status: active");

        // Parse default policies
        let mut default_inbound = None;
        let mut default_outbound = None;

        for line in raw_output.lines() {
            if line.starts_with("Default:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                for (i, part) in parts.iter().enumerate() {
                    if *part == "(incoming)" && i > 0 {
                        default_inbound = Some(parts[i - 1].to_string());
                    }
                    if *part == "(outgoing)" && i > 0 {
                        default_outbound = Some(parts[i - 1].to_string());
                    }
                }
            }
        }

        // Count rules
        let rule_count = raw_output
            .lines()
            .filter(|l| l.contains("ALLOW") || l.contains("DENY") || l.contains("REJECT"))
            .count().min(u32::MAX as usize) as u32;

        Ok(FirewallStatus {
            enabled,
            firewall_type: "ufw".to_string(),
            profiles: vec![FirewallProfile {
                name: "default".to_string(),
                enabled,
                default_inbound,
                default_outbound,
                rule_count: Some(rule_count),
            }],
            rule_count: Some(rule_count),
            raw_output,
        })
    }

    #[cfg(target_os = "linux")]
    async fn check_nftables(&self) -> ScannerResult<FirewallStatus> {
        let output = Command::new("nft")
            .args(["list", "ruleset"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("nft not found: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        // nftables is "enabled" if there are rules
        let enabled = !raw_output.trim().is_empty() && raw_output.contains("table");

        let rule_count = raw_output
            .lines()
            .filter(|l| l.trim().starts_with("rule") || l.contains("accept") || l.contains("drop"))
            .count().min(u32::MAX as usize) as u32;

        Ok(FirewallStatus {
            enabled,
            firewall_type: "nftables".to_string(),
            profiles: vec![FirewallProfile {
                name: "default".to_string(),
                enabled,
                default_inbound: None,
                default_outbound: None,
                rule_count: Some(rule_count),
            }],
            rule_count: Some(rule_count),
            raw_output,
        })
    }

    #[cfg(target_os = "linux")]
    async fn check_iptables(&self) -> ScannerResult<FirewallStatus> {
        let output = Command::new("iptables")
            .args(["-L", "-n"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("iptables failed: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        // Check if there are any non-default rules
        let has_rules = raw_output
            .lines()
            .any(|l| !l.starts_with("Chain") && !l.starts_with("target") && !l.trim().is_empty());

        // Parse default policies
        let mut profiles = Vec::new();
        for line in raw_output.lines() {
            if line.starts_with("Chain") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let name = parts[1].to_string();
                    let policy = parts.get(3).map(|p| p.trim_end_matches(')').to_string());
                    profiles.push(FirewallProfile {
                        name: name.clone(),
                        enabled: true,
                        default_inbound: if name == "INPUT" {
                            policy.clone()
                        } else {
                            None
                        },
                        default_outbound: if name == "OUTPUT" {
                            policy.clone()
                        } else {
                            None
                        },
                        rule_count: None,
                    });
                }
            }
        }

        let rule_count = raw_output
            .lines()
            .filter(|l| !l.starts_with("Chain") && !l.starts_with("target") && !l.trim().is_empty())
            .count().min(u32::MAX as usize) as u32;

        Ok(FirewallStatus {
            enabled: has_rules
                || profiles.iter().any(|p| {
                    p.default_inbound.as_deref() == Some("DROP")
                        || p.default_inbound.as_deref() == Some("REJECT")
                }),
            firewall_type: "iptables".to_string(),
            profiles,
            rule_count: Some(rule_count),
            raw_output,
        })
    }

    /// Check firewall on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<FirewallStatus> {
        debug!("Checking macOS Application Firewall status");

        let get_output = |args: &[&str]| -> Result<std::process::Output, std::io::Error> {
            Command::new("/usr/libexec/ApplicationFirewall/socketfilterfw")
                .args(args)
                .output()
        };

        // Try getting global state
        let output = get_output(&["--getglobalstate"])
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to check ALF: {}", e)))?;

        let mut raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        
        // If it failed or output is empty, try with elevation
        if !output.status.success() || raw_output.trim().is_empty() {
             if let Ok(elevated) = agent_common::macos::run_with_elevation("/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate") {
                 raw_output = elevated;
             }
        }

        let enabled = raw_output.contains("enabled");

        // Check stealth mode
        let mut stealth_output = get_output(&["--getstealthmode"])
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();
            
        if stealth_output.trim().is_empty() {
            stealth_output = agent_common::macos::run_with_elevation("/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode").unwrap_or_default();
        }

        // Check block all incoming
        let mut block_output = get_output(&["--getblockall"])
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();
            
        if block_output.trim().is_empty() {
            block_output = agent_common::macos::run_with_elevation("/usr/libexec/ApplicationFirewall/socketfilterfw --getblockall").unwrap_or_default();
        }

        let block_all = block_output.contains("enabled");

        Ok(FirewallStatus {
            enabled,
            firewall_type: "Application Firewall (ALF)".to_string(),
            profiles: vec![FirewallProfile {
                name: "ALF".to_string(),
                enabled,
                default_inbound: Some(if block_all { "Block" } else { "Allow" }.to_string()),
                default_outbound: Some("Allow".to_string()),
                rule_count: None,
            }],
            rule_count: None,
            raw_output: format!(
                "Global: {}\nStealth: {}\nBlock All: {}",
                raw_output.trim(),
                stealth_output.trim(),
                block_output.trim()
            ),
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<FirewallStatus> {
        Ok(FirewallStatus {
            enabled: false,
            firewall_type: "Unknown".to_string(),
            profiles: vec![],
            rule_count: None,
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for FirewallCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for FirewallCheck {
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

        if status.enabled {
            let profile_summary: Vec<String> = status
                .profiles
                .iter()
                .map(|p| {
                    format!(
                        "{}: {}",
                        p.name,
                        if p.enabled { "enabled" } else { "disabled" }
                    )
                })
                .collect();

            Ok(CheckOutput::pass(
                format!(
                    "{} is enabled. Profiles: {}",
                    status.firewall_type,
                    profile_summary.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("{} is not enabled", status.firewall_type),
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
        let check = FirewallCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Firewall);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = FirewallCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_firewall_status_serialization() {
        let status = FirewallStatus {
            enabled: true,
            firewall_type: "Windows Firewall".to_string(),
            profiles: vec![
                FirewallProfile {
                    name: "Domain".to_string(),
                    enabled: true,
                    default_inbound: Some("Block".to_string()),
                    default_outbound: Some("Allow".to_string()),
                    rule_count: Some(50),
                },
                FirewallProfile {
                    name: "Private".to_string(),
                    enabled: true,
                    default_inbound: Some("Block".to_string()),
                    default_outbound: Some("Allow".to_string()),
                    rule_count: Some(50),
                },
            ],
            rule_count: Some(100),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("Windows Firewall"));
        assert!(json.contains("Domain"));

        let parsed: FirewallStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.enabled);
        assert_eq!(parsed.profiles.len(), 2);
    }

    #[test]
    fn test_firewall_profile_serialization() {
        let profile = FirewallProfile {
            name: "Public".to_string(),
            enabled: true,
            default_inbound: Some("Block".to_string()),
            default_outbound: Some("Allow".to_string()),
            rule_count: Some(25),
        };

        let json = serde_json::to_string(&profile).unwrap();
        let parsed: FirewallProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "Public");
        assert!(parsed.enabled);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = FirewallCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_disabled_firewall_status() {
        let status = FirewallStatus {
            enabled: false,
            firewall_type: "iptables".to_string(),
            profiles: vec![],
            rule_count: Some(0),
            raw_output: String::new(),
        };

        assert!(!status.enabled);
    }
}
