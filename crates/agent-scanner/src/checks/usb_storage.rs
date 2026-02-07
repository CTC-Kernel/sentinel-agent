//! USB mass storage device control compliance check.
//!
//! Verifies that USB mass storage devices are blocked by policy:
//! - Windows: USBSTOR service registry key (Start value = 4 means disabled)
//! - Linux: usb-storage module blacklisted in /etc/modprobe.d/ or not loaded
//! - macOS: MDM profiles restricting USB or profiles -C output

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for USB mass storage disabled.
pub const CHECK_ID: &str = "usb_storage_disabled";

/// USB storage control status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbStorageStatus {
    /// Whether USB mass storage is disabled/blocked.
    pub blocked: bool,

    /// Method used to block USB storage.
    pub block_method: Option<String>,

    /// Whether the USB storage driver/module is loaded.
    pub module_loaded: Option<bool>,

    /// Whether the module is blacklisted (Linux).
    pub module_blacklisted: Option<bool>,

    /// USBSTOR service start type (Windows: 3=manual, 4=disabled).
    pub service_start_type: Option<u32>,

    /// Whether an MDM profile restricts USB (macOS).
    pub mdm_restricted: Option<bool>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// USB mass storage device control compliance check.
pub struct UsbStorageCheck {
    definition: CheckDefinition,
}

impl UsbStorageCheck {
    /// Create a new USB mass storage check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("USB Mass Storage Disabled")
            .description("Verify USB mass storage devices are blocked by policy")
            .category(CheckCategory::DeviceControl)
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

    /// Check USB storage on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<UsbStorageStatus> {
        debug!("Checking Windows USB mass storage policy");

        let output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Services\USBSTOR",
                "/v",
                "Start",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query USBSTOR registry: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut status = UsbStorageStatus {
            blocked: false,
            block_method: None,
            module_loaded: None,
            module_blacklisted: None,
            service_start_type: None,
            mdm_restricted: None,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        if !output.status.success() {
            if stderr.contains("unable to find") || stderr.contains("ERROR") {
                status
                    .issues
                    .push("USBSTOR registry key not found".to_string());
                return Ok(status);
            }
            return Err(ScannerError::CheckExecution(format!(
                "USBSTOR registry check failed: {}",
                stderr
            )));
        }

        // Parse the Start value
        // Start = 3 (REG_DWORD) means manual start (enabled)
        // Start = 4 (REG_DWORD) means disabled
        for line in raw_output.lines() {
            if line.contains("Start") {
                if let Some(hex_val) = line.split_whitespace().last() {
                    let hex_str = hex_val.trim_start_matches("0x");
                    if let Ok(value) = u32::from_str_radix(hex_str, 16) {
                        status.service_start_type = Some(value);
                        status.blocked = value == 4;
                        if status.blocked {
                            status.block_method = Some("Registry (USBSTOR Start=4)".to_string());
                        }
                    }
                }
            }
        }

        if !status.blocked {
            status.issues.push(format!(
                "USB mass storage is not disabled (USBSTOR Start = {}, should be 4)",
                status.service_start_type.unwrap_or(3)
            ));
        }

        Ok(status)
    }

    /// Check USB storage on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<UsbStorageStatus> {
        debug!("Checking Linux USB mass storage policy");

        let mut status = UsbStorageStatus {
            blocked: false,
            block_method: None,
            module_loaded: None,
            module_blacklisted: None,
            service_start_type: None,
            mdm_restricted: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check if usb-storage module is loaded
        let lsmod_output = Command::new("lsmod")
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run lsmod: {}", e)))?;

        let lsmod_result = String::from_utf8_lossy(&lsmod_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("=== lsmod (usb_storage) ===\n"));

        let module_loaded = lsmod_result
            .lines()
            .any(|l| l.starts_with("usb_storage") || l.starts_with("usb-storage"));

        status.module_loaded = Some(module_loaded);

        if module_loaded {
            status.raw_output.push_str("usb_storage module is loaded\n");
        } else {
            status
                .raw_output
                .push_str("usb_storage module is NOT loaded\n");
        }

        // Check if module is blacklisted in /etc/modprobe.d/
        let modprobe_d = std::path::Path::new("/etc/modprobe.d/");
        let mut blacklisted = false;

        if modprobe_d.exists() && modprobe_d.is_dir() {
            if let Ok(entries) = std::fs::read_dir(modprobe_d) {
                for entry in entries.flatten() {
                    if entry.path().is_file() {
                        if let Ok(content) = std::fs::read_to_string(entry.path()) {
                            for line in content.lines() {
                                let line_trimmed = line.trim();
                                if line_trimmed.starts_with('#') {
                                    continue;
                                }
                                if (line_trimmed.contains("blacklist")
                                    && line_trimmed.contains("usb-storage"))
                                    || (line_trimmed.contains("blacklist")
                                        && line_trimmed.contains("usb_storage"))
                                    || (line_trimmed.contains("install usb-storage /bin/true"))
                                    || (line_trimmed.contains("install usb_storage /bin/true"))
                                    || (line_trimmed.contains("install usb-storage /bin/false"))
                                    || (line_trimmed.contains("install usb_storage /bin/false"))
                                {
                                    blacklisted = true;
                                    status.raw_output.push_str(&format!(
                                        "Found blacklist in {}: {}\n",
                                        entry.path().display(),
                                        line_trimmed
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        status.module_blacklisted = Some(blacklisted);

        // USB storage is blocked if module is blacklisted or not loaded
        if blacklisted {
            status.blocked = true;
            status.block_method = Some("Module blacklisted in /etc/modprobe.d/".to_string());
        } else if !module_loaded {
            status.blocked = true;
            status.block_method = Some("Module not loaded".to_string());
        }

        if !status.blocked {
            status
                .issues
                .push("USB mass storage module is loaded and not blacklisted".to_string());
        }

        Ok(status)
    }

    /// Check USB storage on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<UsbStorageStatus> {
        debug!("Checking macOS USB mass storage policy");

        let mut status = UsbStorageStatus {
            blocked: false,
            block_method: None,
            module_loaded: None,
            module_blacklisted: None,
            service_start_type: None,
            mdm_restricted: None,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check for MDM profiles that restrict USB
        if let Ok(output) = Command::new("profiles")
            .args(["-C", "-o", "stdout"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            status.raw_output.push_str(&format!(
                "=== profiles -C ===\nstdout: {}\nstderr: {}\n",
                result.trim(),
                stderr.trim()
            ));

            // Check for USB restriction profiles
            let combined = format!("{} {}", result, stderr);
            let has_usb_restriction = combined.to_lowercase().contains("usb")
                && (combined.to_lowercase().contains("restrict")
                    || combined.to_lowercase().contains("block")
                    || combined.to_lowercase().contains("disallow"));

            let has_removable_media_restriction = combined.to_lowercase().contains("removable")
                && (combined.to_lowercase().contains("restrict")
                    || combined.to_lowercase().contains("block"));

            let has_storage_restriction = combined.to_lowercase().contains("allowexternalstorage")
                || combined.to_lowercase().contains("mass-storage");

            if has_usb_restriction || has_removable_media_restriction || has_storage_restriction {
                status.blocked = true;
                status.mdm_restricted = Some(true);
                status.block_method = Some("MDM profile restricting USB storage".to_string());
            } else {
                status.mdm_restricted = Some(false);
            }
        } else {
            // profiles command may require elevated privileges
            status
                .raw_output
                .push_str("profiles command failed (may need elevated privileges)\n");
        }

        // Check if any configuration profile is installed
        if let Ok(output) = Command::new("profiles")
            .args(["list", "-o", "stdout"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("\n=== profiles list ===\n{}\n", result.trim()));
        }

        if !status.blocked {
            status
                .issues
                .push("No MDM profile restricting USB mass storage detected".to_string());
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<UsbStorageStatus> {
        Ok(UsbStorageStatus {
            blocked: false,
            block_method: None,
            module_loaded: None,
            module_blacklisted: None,
            service_start_type: None,
            mdm_restricted: None,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for UsbStorageCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for UsbStorageCheck {
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

        if status.blocked {
            Ok(CheckOutput::pass(
                format!(
                    "USB mass storage is blocked: {}",
                    status.block_method.as_deref().unwrap_or("policy enforced")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "USB mass storage is not blocked: {}",
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
        let check = UsbStorageCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::DeviceControl);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = UsbStorageCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_usb_status_serialization() {
        let status = UsbStorageStatus {
            blocked: true,
            block_method: Some("Registry (USBSTOR Start=4)".to_string()),
            module_loaded: None,
            module_blacklisted: None,
            service_start_type: Some(4),
            mdm_restricted: None,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"blocked\":true"));
        assert!(json.contains("\"service_start_type\":4"));

        let parsed: UsbStorageStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.blocked);
        assert_eq!(parsed.service_start_type, Some(4));
    }

    #[test]
    fn test_usb_status_not_blocked() {
        let status = UsbStorageStatus {
            blocked: false,
            block_method: None,
            module_loaded: Some(true),
            module_blacklisted: Some(false),
            service_start_type: None,
            mdm_restricted: None,
            issues: vec!["USB mass storage module is loaded and not blacklisted".to_string()],
            raw_output: String::new(),
        };

        assert!(!status.blocked);
        assert_eq!(status.module_loaded, Some(true));
        assert_eq!(status.module_blacklisted, Some(false));
        assert_eq!(status.issues.len(), 1);
    }

    #[test]
    fn test_usb_status_linux_blacklisted() {
        let status = UsbStorageStatus {
            blocked: true,
            block_method: Some("Module blacklisted in /etc/modprobe.d/".to_string()),
            module_loaded: Some(false),
            module_blacklisted: Some(true),
            service_start_type: None,
            mdm_restricted: None,
            issues: vec![],
            raw_output: String::new(),
        };

        let json = serde_json::to_string(&status).unwrap();
        let parsed: UsbStorageStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.blocked);
        assert_eq!(parsed.module_blacklisted, Some(true));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = UsbStorageCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = UsbStorageCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "USB Mass Storage Disabled");
        assert!(def.description.contains("USB"));
        assert!(def.enabled);
    }
}
