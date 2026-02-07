//! Disk encryption compliance check.
//!
//! Verifies that disk encryption is enabled on the system:
//! - Windows: BitLocker
//! - Linux: LUKS (dm-crypt)
//! - macOS: FileVault

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;
#[cfg(target_os = "macos")]
use tracing::warn;

/// Check ID for disk encryption.
pub const CHECK_ID: &str = "disk_encryption";

/// Disk encryption status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionStatus {
    /// Whether encryption is enabled.
    pub enabled: bool,

    /// Encryption type (BitLocker, LUKS, FileVault).
    pub encryption_type: String,

    /// List of encrypted volumes.
    pub encrypted_volumes: Vec<VolumeEncryptionInfo>,

    /// Overall protection status.
    pub protection_status: String,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Information about an encrypted volume.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeEncryptionInfo {
    /// Volume identifier (drive letter or mount point).
    pub volume: String,

    /// Whether this volume is encrypted.
    pub encrypted: bool,

    /// Encryption percentage (0-100).
    #[serde(default)]
    pub encryption_percentage: Option<u8>,

    /// Protection status for this volume.
    #[serde(default)]
    pub protection_status: Option<String>,

    /// Key protectors (Windows BitLocker).
    #[serde(default)]
    pub key_protectors: Vec<String>,

    /// Encryption algorithm.
    #[serde(default)]
    pub algorithm: Option<String>,
}

/// Disk encryption compliance check.
pub struct DiskEncryptionCheck {
    definition: CheckDefinition,
}

impl DiskEncryptionCheck {
    /// Create a new disk encryption check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Disk Encryption")
            .description("Verify disk encryption is enabled (BitLocker/LUKS/FileVault)")
            .category(CheckCategory::Encryption)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("RGPD")
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

    /// Check disk encryption on Windows using PowerShell.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<EncryptionStatus> {
        debug!("Checking BitLocker status on Windows");

        // Use PowerShell to get BitLocker status
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, EncryptionPercentage, ProtectionStatus, KeyProtector | ConvertTo-Json",
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            // BitLocker might not be available (Home edition)
            if stderr.contains("not recognized") || stderr.contains("cmdlet") {
                return Ok(EncryptionStatus {
                    enabled: false,
                    encryption_type: "BitLocker".to_string(),
                    encrypted_volumes: vec![],
                    protection_status: "Not Available".to_string(),
                    raw_output: stderr,
                });
            }
            return Err(ScannerError::CheckExecution(format!(
                "BitLocker check failed: {}",
                stderr
            )));
        }

        // Parse JSON output
        let volumes = self.parse_bitlocker_output(&raw_output)?;

        let any_encrypted = volumes.iter().any(|v| v.encrypted);
        let all_protected = volumes
            .iter()
            .filter(|v| v.encrypted)
            .all(|v| v.protection_status.as_deref() == Some("On"));

        let protection_status = if !any_encrypted {
            "Not Encrypted"
        } else if all_protected {
            "Protected"
        } else {
            "Partially Protected"
        };

        Ok(EncryptionStatus {
            enabled: any_encrypted,
            encryption_type: "BitLocker".to_string(),
            encrypted_volumes: volumes,
            protection_status: protection_status.to_string(),
            raw_output,
        })
    }

    #[cfg(target_os = "windows")]
    fn parse_bitlocker_output(&self, output: &str) -> ScannerResult<Vec<VolumeEncryptionInfo>> {
        if output.trim().is_empty() {
            return Ok(vec![]);
        }

        // Try to parse as JSON array or single object
        let volumes: Vec<serde_json::Value> = if output.trim().starts_with('[') {
            serde_json::from_str(output).unwrap_or_default()
        } else {
            // Single volume returns as object, not array
            match serde_json::from_str::<serde_json::Value>(output) {
                Ok(v) => vec![v],
                Err(_) => vec![],
            }
        };

        let mut result = Vec::new();
        for vol in volumes {
            let mount_point = vol["MountPoint"].as_str().unwrap_or("").to_string();
            let volume_status = vol["VolumeStatus"].as_str().unwrap_or("");
            let encryption_pct = vol["EncryptionPercentage"]
                .as_u64()
                .map(|p| p.min(100) as u8);
            let protection = vol["ProtectionStatus"].as_str().map(|s| s.to_string());

            let encrypted = volume_status == "FullyEncrypted"
                || volume_status == "EncryptionInProgress"
                || encryption_pct.unwrap_or(0) > 0;

            // Parse key protectors
            let key_protectors: Vec<String> = vol["KeyProtector"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|kp| kp["KeyProtectorType"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            result.push(VolumeEncryptionInfo {
                volume: mount_point,
                encrypted,
                encryption_percentage: encryption_pct,
                protection_status: protection,
                key_protectors,
                algorithm: Some("AES-256".to_string()), // BitLocker default
            });
        }

        Ok(result)
    }

    /// Check disk encryption on Linux using cryptsetup.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<EncryptionStatus> {
        debug!("Checking LUKS status on Linux");

        // Check for LUKS encrypted partitions
        let output = Command::new("lsblk")
            .args(["--json", "-o", "NAME,TYPE,FSTYPE,MOUNTPOINT"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run lsblk: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        if !output.status.success() {
            return Err(ScannerError::CheckExecution(
                "Failed to get block device info".to_string(),
            ));
        }

        let volumes = self.parse_linux_encryption(&raw_output)?;
        let any_encrypted = volumes.iter().any(|v| v.encrypted);

        Ok(EncryptionStatus {
            enabled: any_encrypted,
            encryption_type: "LUKS".to_string(),
            encrypted_volumes: volumes,
            protection_status: if any_encrypted {
                "Encrypted"
            } else {
                "Not Encrypted"
            }
            .to_string(),
            raw_output,
        })
    }

    #[cfg(target_os = "linux")]
    fn parse_linux_encryption(&self, output: &str) -> ScannerResult<Vec<VolumeEncryptionInfo>> {
        let json: serde_json::Value =
            serde_json::from_str(output).unwrap_or(serde_json::json!({"blockdevices": []}));

        let mut volumes = Vec::new();
        if let Some(devices) = json["blockdevices"].as_array() {
            for device in devices {
                self.check_linux_device(device, &mut volumes);
            }
        }

        Ok(volumes)
    }

    #[cfg(target_os = "linux")]
    fn check_linux_device(
        &self,
        device: &serde_json::Value,
        volumes: &mut Vec<VolumeEncryptionInfo>,
    ) {
        let fstype = device["fstype"].as_str().unwrap_or("");
        let name = device["name"].as_str().unwrap_or("");
        let mount = device["mountpoint"].as_str().unwrap_or("");
        let dev_type = device["type"].as_str().unwrap_or("");

        // Check if this is a LUKS/crypt device
        let is_encrypted = fstype == "crypto_LUKS" || dev_type == "crypt";

        if is_encrypted || (dev_type == "part" && !mount.is_empty()) {
            volumes.push(VolumeEncryptionInfo {
                volume: if mount.is_empty() {
                    format!("/dev/{}", name)
                } else {
                    mount.to_string()
                },
                encrypted: is_encrypted,
                encryption_percentage: if is_encrypted { Some(100) } else { None },
                protection_status: if is_encrypted {
                    Some("Unlocked".to_string())
                } else {
                    None
                },
                key_protectors: vec![],
                algorithm: if is_encrypted {
                    Some("AES-256-XTS".to_string())
                } else {
                    None
                },
            });
        }

        // Check children (nested partitions)
        if let Some(children) = device["children"].as_array() {
            for child in children {
                self.check_linux_device(child, volumes);
            }
        }
    }

    /// Check disk encryption on macOS using fdesetup.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<EncryptionStatus> {
        debug!("Checking FileVault status on macOS");

        // Check FileVault status
        let output = Command::new("fdesetup")
            .args(["status"])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run fdesetup: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // fdesetup may require root, check for permission error
        if !stderr.is_empty() && stderr.contains("root") {
            warn!("FileVault check may require root privileges");
        }

        let is_enabled = raw_output.contains("FileVault is On");
        let is_encrypting = raw_output.contains("Encryption in progress");

        let encryption_percentage = if is_enabled && !is_encrypting {
            Some(100u8)
        } else if is_encrypting {
            // Try to get progress
            self.get_filevault_progress().await
        } else {
            None
        };

        let volumes = vec![VolumeEncryptionInfo {
            volume: "/".to_string(),
            encrypted: is_enabled || is_encrypting,
            encryption_percentage,
            protection_status: Some(
                if is_enabled {
                    "On"
                } else if is_encrypting {
                    "Encrypting"
                } else {
                    "Off"
                }
                .to_string(),
            ),
            key_protectors: vec!["Recovery Key".to_string()],
            algorithm: Some("AES-XTS".to_string()),
        }];

        Ok(EncryptionStatus {
            enabled: is_enabled || is_encrypting,
            encryption_type: "FileVault".to_string(),
            encrypted_volumes: volumes,
            protection_status: if is_enabled {
                "Protected"
            } else if is_encrypting {
                "Encrypting"
            } else {
                "Not Encrypted"
            }
            .to_string(),
            raw_output,
        })
    }

    #[cfg(target_os = "macos")]
    async fn get_filevault_progress(&self) -> Option<u8> {
        let output = Command::new("diskutil")
            .args(["apfs", "list"])
            .output()
            .ok()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse encryption progress from diskutil output if available
        // This is a simplified implementation
        if stdout.contains("Encryption Progress") {
            // Extract percentage - would need proper parsing
            None
        } else {
            None
        }
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<EncryptionStatus> {
        Ok(EncryptionStatus {
            enabled: false,
            encryption_type: "Unknown".to_string(),
            encrypted_volumes: vec![],
            protection_status: "Unsupported Platform".to_string(),
            raw_output: String::new(),
        })
    }
}

impl Default for DiskEncryptionCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for DiskEncryptionCheck {
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
            Ok(CheckOutput::pass(
                format!(
                    "{} encryption is enabled. Status: {}",
                    status.encryption_type, status.protection_status
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "{} encryption is not enabled. Status: {}",
                    status.encryption_type, status.protection_status
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
        let check = DiskEncryptionCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Encryption);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = DiskEncryptionCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
        assert!(frameworks.contains(&"RGPD".to_string()));
    }

    #[test]
    fn test_encryption_status_serialization() {
        let status = EncryptionStatus {
            enabled: true,
            encryption_type: "BitLocker".to_string(),
            encrypted_volumes: vec![VolumeEncryptionInfo {
                volume: "C:".to_string(),
                encrypted: true,
                encryption_percentage: Some(100),
                protection_status: Some("On".to_string()),
                key_protectors: vec!["TPM".to_string()],
                algorithm: Some("AES-256".to_string()),
            }],
            protection_status: "Protected".to_string(),
            raw_output: "test output".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("BitLocker"));
        assert!(json.contains("encrypted"));

        let parsed: EncryptionStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.enabled);
        assert_eq!(parsed.encrypted_volumes.len(), 1);
    }

    #[test]
    fn test_volume_info_serialization() {
        let vol = VolumeEncryptionInfo {
            volume: "/dev/sda1".to_string(),
            encrypted: true,
            encryption_percentage: Some(100),
            protection_status: Some("Unlocked".to_string()),
            key_protectors: vec![],
            algorithm: Some("AES-256-XTS".to_string()),
        };

        let json = serde_json::to_string(&vol).unwrap();
        let parsed: VolumeEncryptionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.volume, "/dev/sda1");
        assert!(parsed.encrypted);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = DiskEncryptionCheck::new();
        // This will run the actual check on the current platform
        let result = check.execute().await;

        // The check should complete without error (may pass or fail depending on system)
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_check_is_platform_supported() {
        let check = DiskEncryptionCheck::new();

        // Should be supported on Windows, Linux, macOS
        #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
        assert!(check.is_platform_supported());
    }

    #[test]
    fn test_check_definition_builder() {
        let check = DiskEncryptionCheck::new();
        let def = check.definition();

        assert_eq!(def.name, "Disk Encryption");
        assert!(def.description.contains("BitLocker"));
        assert!(def.enabled);
    }
}
