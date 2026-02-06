//! IPv6 hardening compliance check.
//!
//! Verifies that IPv6 router advertisements and unnecessary features are disabled:
//! - Windows: Registry key DisabledComponents under Tcpip6\Parameters
//! - Linux: sysctl net.ipv6.conf.all.accept_ra
//! - macOS: sysctl net.inet6.ip6.accept_rtadv

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for IPv6 hardening.
pub const CHECK_ID: &str = "ipv6_hardening";

/// IPv6 hardening status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ipv6HardeningStatus {
    /// Whether IPv6 hardening is properly configured.
    pub hardened: bool,

    /// Whether router advertisements are disabled.
    pub ra_disabled: bool,

    /// Whether IPv6 is fully disabled (Windows).
    pub ipv6_fully_disabled: Option<bool>,

    /// The DisabledComponents registry value (Windows).
    pub disabled_components: Option<u32>,

    /// The accept_ra sysctl value (Linux).
    pub accept_ra_value: Option<u32>,

    /// The accept_rtadv sysctl value (macOS).
    pub accept_rtadv_value: Option<u32>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// IPv6 hardening compliance check.
pub struct Ipv6ConfigCheck {
    definition: CheckDefinition,
}

impl Ipv6ConfigCheck {
    /// Create a new IPv6 hardening check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("IPv6 Hardening")
            .description("Verify IPv6 router advertisements and unnecessary features are disabled")
            .category(CheckCategory::NetworkHardening)
            .severity(CheckSeverity::Low)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
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

    /// Check IPv6 hardening on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<Ipv6HardeningStatus> {
        debug!("Checking Windows IPv6 hardening settings");

        let output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters",
                "/v",
                "DisabledComponents",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query IPv6 registry: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut status = Ipv6HardeningStatus {
            hardened: false,
            ra_disabled: false,
            ipv6_fully_disabled: None,
            disabled_components: None,
            accept_ra_value: None,
            accept_rtadv_value: None,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        if !output.status.success() {
            // Registry key not found means IPv6 is not hardened
            if stderr.contains("unable to find") || stderr.contains("ERROR") {
                status
                    .issues
                    .push("DisabledComponents registry key not set".to_string());
                return Ok(status);
            }
            return Err(ScannerError::CheckExecution(format!(
                "IPv6 registry check failed: {}",
                stderr
            )));
        }

        // Parse the registry value (hex)
        for line in raw_output.lines() {
            if line.contains("DisabledComponents") {
                if let Some(hex_val) = line.split_whitespace().last() {
                    let hex_str = hex_val.trim_start_matches("0x");
                    if let Ok(value) = u32::from_str_radix(hex_str, 16) {
                        status.disabled_components = Some(value);
                        // 0xFF = fully disabled
                        status.ipv6_fully_disabled = Some(value == 0xFF);
                        // Bit 0 disables all IPv6 tunnel interfaces
                        // Bit 4 disables IPv6 over all non-tunnel interfaces
                        // 0x20 disables router advertisements
                        status.ra_disabled = (value & 0x20) != 0 || value == 0xFF;
                        status.hardened = value == 0xFF || (value & 0x20) != 0;
                    }
                }
            }
        }

        if !status.hardened {
            status.issues.push(
                "IPv6 router advertisements are not disabled (DisabledComponents should include 0x20 or be 0xFF)".to_string(),
            );
        }

        Ok(status)
    }

    /// Check IPv6 hardening on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<Ipv6HardeningStatus> {
        debug!("Checking Linux IPv6 hardening settings");

        let output = Command::new("sysctl")
            .args(["-n", "net.ipv6.conf.all.accept_ra"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run sysctl: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = Ipv6HardeningStatus {
            hardened: false,
            ra_disabled: false,
            ipv6_fully_disabled: None,
            disabled_components: None,
            accept_ra_value: None,
            accept_rtadv_value: None,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        if let Ok(value) = raw_output.trim().parse::<u32>() {
            status.accept_ra_value = Some(value);
            // 0 = disabled, 1 = enabled, 2 = overrule forwarding
            status.ra_disabled = value == 0;
            status.hardened = value == 0;
        }

        if !status.hardened {
            status.issues.push(format!(
                "IPv6 router advertisements are enabled (net.ipv6.conf.all.accept_ra = {}, should be 0)",
                status.accept_ra_value.unwrap_or(1)
            ));
        }

        // Also check if IPv6 is fully disabled
        if let Ok(disable_output) = Command::new("sysctl")
            .args(["-n", "net.ipv6.conf.all.disable_ipv6"])
            .output()
        {
            let disable_str = String::from_utf8_lossy(&disable_output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("\ndisable_ipv6: {}", disable_str.trim()));
            if let Ok(val) = disable_str.trim().parse::<u32>() {
                status.ipv6_fully_disabled = Some(val == 1);
            }
        }

        Ok(status)
    }

    /// Check IPv6 hardening on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<Ipv6HardeningStatus> {
        debug!("Checking macOS IPv6 hardening settings");

        let output = Command::new("sysctl")
            .args(["net.inet6.ip6.accept_rtadv"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run sysctl: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = Ipv6HardeningStatus {
            hardened: false,
            ra_disabled: false,
            ipv6_fully_disabled: None,
            disabled_components: None,
            accept_ra_value: None,
            accept_rtadv_value: None,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse "net.inet6.ip6.accept_rtadv: N"
        if let Some(value_str) = raw_output.split(':').last() {
            if let Ok(value) = value_str.trim().parse::<u32>() {
                status.accept_rtadv_value = Some(value);
                // 0 = disabled (hardened), 1 = enabled
                status.ra_disabled = value == 0;
                status.hardened = value == 0;
            }
        }

        if !status.hardened {
            status.issues.push(format!(
                "IPv6 router advertisements are enabled (net.inet6.ip6.accept_rtadv = {}, should be 0)",
                status.accept_rtadv_value.unwrap_or(1)
            ));
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<Ipv6HardeningStatus> {
        Ok(Ipv6HardeningStatus {
            hardened: false,
            ra_disabled: false,
            ipv6_fully_disabled: None,
            disabled_components: None,
            accept_ra_value: None,
            accept_rtadv_value: None,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for Ipv6ConfigCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for Ipv6ConfigCheck {
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

        if status.hardened {
            Ok(CheckOutput::pass(
                "IPv6 router advertisements are disabled".to_string(),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("IPv6 hardening issues: {}", status.issues.join("; ")),
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
        let check = Ipv6ConfigCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::NetworkHardening);
        assert_eq!(check.definition().severity, CheckSeverity::Low);
    }

    #[test]
    fn test_check_frameworks() {
        let check = Ipv6ConfigCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_ipv6_status_serialization() {
        let status = Ipv6HardeningStatus {
            hardened: true,
            ra_disabled: true,
            ipv6_fully_disabled: Some(true),
            disabled_components: Some(0xFF),
            accept_ra_value: None,
            accept_rtadv_value: None,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"hardened\":true"));
        assert!(json.contains("\"ra_disabled\":true"));

        let parsed: Ipv6HardeningStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.hardened);
        assert!(parsed.ra_disabled);
    }

    #[test]
    fn test_ipv6_status_not_hardened() {
        let status = Ipv6HardeningStatus {
            hardened: false,
            ra_disabled: false,
            ipv6_fully_disabled: None,
            disabled_components: None,
            accept_ra_value: Some(1),
            accept_rtadv_value: None,
            issues: vec!["IPv6 router advertisements are enabled".to_string()],
            raw_output: String::new(),
        };

        assert!(!status.hardened);
        assert!(!status.ra_disabled);
        assert_eq!(status.issues.len(), 1);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = Ipv6ConfigCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = Ipv6ConfigCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "IPv6 Hardening");
        assert!(def.description.contains("IPv6"));
        assert!(def.enabled);
    }
}
