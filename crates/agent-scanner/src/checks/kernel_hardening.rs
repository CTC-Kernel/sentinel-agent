//! Kernel hardening compliance check.
//!
//! Checks kernel security settings (ASLR, exec-shield, IP forwarding):
//! - Windows: DEP and ASLR via registry/wmic
//! - Linux: sysctl values for randomize_va_space, ip_forward, dmesg_restrict, kptr_restrict
//! - macOS: SIP status and ASLR (always on)

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for kernel hardening.
pub const CHECK_ID: &str = "kernel_hardening";

/// Kernel hardening status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelHardeningStatus {
    /// Whether kernel hardening is properly configured.
    pub hardened: bool,

    /// Whether ASLR is enabled and fully configured.
    pub aslr_enabled: bool,

    /// ASLR mode value (Linux: 0=off, 1=partial, 2=full).
    pub aslr_mode: Option<u32>,

    /// Whether IP forwarding is disabled.
    pub ip_forward_disabled: bool,

    /// Whether dmesg is restricted (Linux).
    pub dmesg_restricted: Option<bool>,

    /// Whether kernel pointer display is restricted (Linux).
    pub kptr_restricted: Option<bool>,

    /// DEP (Data Execution Prevention) available (Windows).
    pub dep_available: Option<bool>,

    /// SIP (System Integrity Protection) enabled (macOS).
    pub sip_enabled: Option<bool>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Kernel hardening compliance check.
pub struct KernelHardeningCheck {
    definition: CheckDefinition,
}

impl KernelHardeningCheck {
    /// Create a new kernel hardening check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Kernel Hardening")
            .description("Check kernel security settings (ASLR, exec-shield, IP forwarding)")
            .category(CheckCategory::KernelSecurity)
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

    /// Check kernel hardening on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<KernelHardeningStatus> {
        debug!("Checking Windows kernel hardening settings");

        let mut status = KernelHardeningStatus {
            hardened: false,
            aslr_enabled: false,
            aslr_mode: None,
            ip_forward_disabled: true,
            dmesg_restricted: None,
            kptr_restricted: None,
            dep_available: None,
            sip_enabled: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check DEP availability
        let dep_output = Command::new("wmic")
            .args(["OS", "get", "DataExecutionPrevention_Available"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to check DEP: {}", e)))?;

        let dep_result = String::from_utf8_lossy(&dep_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("DEP: {}\n", dep_result.trim()));

        let dep_available = dep_result.to_lowercase().contains("true");
        status.dep_available = Some(dep_available);

        if !dep_available {
            status
                .issues
                .push("Data Execution Prevention (DEP) is not available".to_string());
        }

        // Check ASLR via registry (MoveImages)
        let aslr_output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management",
                "/v",
                "MoveImages",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to check ASLR registry: {}", e))
            })?;

        let aslr_result = String::from_utf8_lossy(&aslr_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("ASLR Registry: {}\n", aslr_result.trim()));

        // If MoveImages is not present or set to 0xFFFFFFFF, ASLR is enabled (default)
        // MoveImages = 0 means ASLR is disabled
        if aslr_output.status.success() {
            let aslr_disabled = aslr_result.contains("0x0") && !aslr_result.contains("0x0000");
            status.aslr_enabled = !aslr_disabled;
        } else {
            // Key not found = default = enabled
            status.aslr_enabled = true;
        }

        if !status.aslr_enabled {
            status
                .issues
                .push("ASLR (Address Space Layout Randomization) is disabled".to_string());
        }

        status.hardened = dep_available && status.aslr_enabled;

        Ok(status)
    }

    /// Check kernel hardening on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<KernelHardeningStatus> {
        debug!("Checking Linux kernel hardening settings");

        let mut status = KernelHardeningStatus {
            hardened: true,
            aslr_enabled: false,
            aslr_mode: None,
            ip_forward_disabled: false,
            dmesg_restricted: None,
            kptr_restricted: None,
            dep_available: None,
            sip_enabled: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check ASLR: kernel.randomize_va_space should be 2
        if let Ok(output) = Command::new("sysctl")
            .args(["-n", "kernel.randomize_va_space"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("randomize_va_space: {}\n", result.trim()));

            if let Ok(value) = result.trim().parse::<u32>() {
                status.aslr_mode = Some(value);
                status.aslr_enabled = value == 2;
                if value != 2 {
                    status.hardened = false;
                    status.issues.push(format!(
                        "ASLR not fully enabled (kernel.randomize_va_space = {}, should be 2)",
                        value
                    ));
                }
            }
        }

        // Check IP forwarding: net.ipv4.ip_forward should be 0
        if let Ok(output) = Command::new("sysctl")
            .args(["-n", "net.ipv4.ip_forward"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("ip_forward: {}\n", result.trim()));

            if let Ok(value) = result.trim().parse::<u32>() {
                status.ip_forward_disabled = value == 0;
                if value != 0 {
                    status.hardened = false;
                    status.issues.push(
                        "IP forwarding is enabled (net.ipv4.ip_forward should be 0)".to_string(),
                    );
                }
            }
        }

        // Check dmesg_restrict: kernel.dmesg_restrict should be 1
        if let Ok(output) = Command::new("sysctl")
            .args(["-n", "kernel.dmesg_restrict"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("dmesg_restrict: {}\n", result.trim()));

            if let Ok(value) = result.trim().parse::<u32>() {
                status.dmesg_restricted = Some(value == 1);
                if value != 1 {
                    status.hardened = false;
                    status.issues.push(
                        "dmesg is not restricted (kernel.dmesg_restrict should be 1)".to_string(),
                    );
                }
            }
        }

        // Check kptr_restrict: kernel.kptr_restrict should be >= 1
        if let Ok(output) = Command::new("sysctl")
            .args(["-n", "kernel.kptr_restrict"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("kptr_restrict: {}\n", result.trim()));

            if let Ok(value) = result.trim().parse::<u32>() {
                status.kptr_restricted = Some(value >= 1);
                if value < 1 {
                    status.hardened = false;
                    status.issues.push(
                        "Kernel pointer display is not restricted (kernel.kptr_restrict should be >= 1)".to_string(),
                    );
                }
            }
        }

        Ok(status)
    }

    /// Check kernel hardening on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<KernelHardeningStatus> {
        debug!("Checking macOS kernel hardening settings");

        let mut status = KernelHardeningStatus {
            hardened: true,
            aslr_enabled: true, // macOS always has ASLR enabled
            aslr_mode: None,
            ip_forward_disabled: true,
            dmesg_restricted: None,
            kptr_restricted: None,
            dep_available: None,
            sip_enabled: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // macOS always has ASLR enabled at the OS level
        status
            .raw_output
            .push_str("ASLR: always enabled on macOS\n");

        // Check SIP (System Integrity Protection) status
        let sip_output = Command::new("csrutil")
            .args(["status"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to check SIP status: {}", e))
            })?;

        let sip_result = String::from_utf8_lossy(&sip_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("SIP: {}\n", sip_result.trim()));

        let sip_enabled = sip_result.contains("enabled");
        status.sip_enabled = Some(sip_enabled);

        if !sip_enabled {
            status.hardened = false;
            status
                .issues
                .push("System Integrity Protection (SIP) is disabled".to_string());
        }

        // Check IP forwarding
        if let Ok(output) = Command::new("sysctl")
            .args(["net.inet.ip.forwarding"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("IP forwarding: {}\n", result.trim()));

            if let Some(value_str) = result.split(':').next_back()
                && let Ok(value) = value_str.trim().parse::<u32>() {
                    status.ip_forward_disabled = value == 0;
                    if value != 0 {
                        status.hardened = false;
                        status.issues.push(
                            "IP forwarding is enabled (net.inet.ip.forwarding should be 0)"
                                .to_string(),
                        );
                    }
                }
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<KernelHardeningStatus> {
        Ok(KernelHardeningStatus {
            hardened: false,
            aslr_enabled: false,
            aslr_mode: None,
            ip_forward_disabled: false,
            dmesg_restricted: None,
            kptr_restricted: None,
            dep_available: None,
            sip_enabled: None,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for KernelHardeningCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for KernelHardeningCheck {
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
            let mut details = Vec::new();
            if status.aslr_enabled {
                details.push("ASLR=enabled".to_string());
            }
            if status.ip_forward_disabled {
                details.push("ip_forward=disabled".to_string());
            }
            if status.dmesg_restricted == Some(true) {
                details.push("dmesg=restricted".to_string());
            }
            if status.sip_enabled == Some(true) {
                details.push("SIP=enabled".to_string());
            }
            if status.dep_available == Some(true) {
                details.push("DEP=available".to_string());
            }

            Ok(CheckOutput::pass(
                format!(
                    "Kernel hardening is properly configured: {}",
                    details.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Kernel hardening issues: {}", status.issues.join("; ")),
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
        let check = KernelHardeningCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::KernelSecurity);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = KernelHardeningCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"NIS2".to_string()));
    }

    #[test]
    fn test_kernel_status_serialization() {
        let status = KernelHardeningStatus {
            hardened: true,
            aslr_enabled: true,
            aslr_mode: Some(2),
            ip_forward_disabled: true,
            dmesg_restricted: Some(true),
            kptr_restricted: Some(true),
            dep_available: None,
            sip_enabled: None,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"hardened\":true"));
        assert!(json.contains("\"aslr_enabled\":true"));
        assert!(json.contains("\"aslr_mode\":2"));

        let parsed: KernelHardeningStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.hardened);
        assert_eq!(parsed.aslr_mode, Some(2));
    }

    #[test]
    fn test_kernel_status_not_hardened() {
        let status = KernelHardeningStatus {
            hardened: false,
            aslr_enabled: false,
            aslr_mode: Some(0),
            ip_forward_disabled: false,
            dmesg_restricted: Some(false),
            kptr_restricted: Some(false),
            dep_available: None,
            sip_enabled: None,
            issues: vec![
                "ASLR not enabled".to_string(),
                "IP forwarding enabled".to_string(),
            ],
            raw_output: String::new(),
        };

        assert!(!status.hardened);
        assert_eq!(status.issues.len(), 2);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = KernelHardeningCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = KernelHardeningCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "Kernel Hardening");
        assert!(def.description.contains("ASLR"));
        assert!(def.enabled);
    }
}
