//! Bluetooth service disabled compliance check.
//!
//! Verifies that Bluetooth service is disabled (recommended for servers):
//! - Windows: Bluetooth Support Service (bthserv)
//! - Linux: bluetooth systemd service
//! - macOS: Bluetooth ControllerPowerState preference

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::{ScannerError, ScannerResult};
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for Bluetooth disabled.
pub const CHECK_ID: &str = "bluetooth_disabled";

/// Bluetooth service status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothStatus {
    /// Whether Bluetooth is disabled (compliant = true means disabled).
    pub bluetooth_disabled: bool,

    /// Current state of the Bluetooth service.
    pub service_state: String,

    /// Type of Bluetooth service checked.
    pub service_type: String,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Bluetooth service disabled compliance check.
pub struct BluetoothCheck {
    definition: CheckDefinition,
}

impl BluetoothCheck {
    /// Create a new Bluetooth check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Bluetooth Service Disabled")
            .description("Verify Bluetooth service is disabled (recommended for servers)")
            .category(CheckCategory::DeviceControl)
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

    /// Check Bluetooth on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<BluetoothStatus> {
        debug!("Checking Windows Bluetooth Support Service status");

        let output = Command::new("sc")
            .args(["query", "bthserv"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query Bluetooth service: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // If the service doesn't exist, Bluetooth is considered disabled
        if !output.status.success() {
            return Ok(BluetoothStatus {
                bluetooth_disabled: true,
                service_state: "not_found".to_string(),
                service_type: "Bluetooth Support Service (bthserv)".to_string(),
                raw_output: format!("stdout: {}\nstderr: {}", raw_output, stderr),
            });
        }

        let is_running = raw_output.contains("RUNNING");
        let is_stopped = raw_output.contains("STOPPED");

        let service_state = if is_running {
            "running".to_string()
        } else if is_stopped {
            "stopped".to_string()
        } else {
            "unknown".to_string()
        };

        Ok(BluetoothStatus {
            bluetooth_disabled: !is_running,
            service_state,
            service_type: "Bluetooth Support Service (bthserv)".to_string(),
            raw_output,
        })
    }

    /// Check Bluetooth on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<BluetoothStatus> {
        debug!("Checking Linux Bluetooth service status");

        let output = Command::new("systemctl")
            .args(["is-active", "bluetooth"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to check bluetooth service: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let service_active = raw_output.trim() == "active";

        let service_state = if service_active {
            "active".to_string()
        } else {
            raw_output.trim().to_string()
        };

        Ok(BluetoothStatus {
            bluetooth_disabled: !service_active,
            service_state,
            service_type: "bluetooth (systemd)".to_string(),
            raw_output,
        })
    }

    /// Check Bluetooth on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<BluetoothStatus> {
        debug!("Checking macOS Bluetooth power state");

        let output = Command::new("defaults")
            .args([
                "read",
                "/Library/Preferences/com.apple.Bluetooth",
                "ControllerPowerState",
            ])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to read Bluetooth preferences: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // If the key doesn't exist, check failed to read - try to determine state
        if !output.status.success() {
            return Ok(BluetoothStatus {
                bluetooth_disabled: false, // Cannot determine, assume not disabled
                service_state: "unknown".to_string(),
                service_type: "macOS Bluetooth".to_string(),
                raw_output: format!("stdout: {}\nstderr: {}", raw_output.trim(), stderr.trim()),
            });
        }

        // ControllerPowerState: 0 = off, 1 = on
        let power_state = raw_output.trim();
        let bluetooth_on = power_state == "1";

        let service_state = if bluetooth_on {
            "on".to_string()
        } else {
            "off".to_string()
        };

        Ok(BluetoothStatus {
            bluetooth_disabled: !bluetooth_on,
            service_state,
            service_type: "macOS Bluetooth".to_string(),
            raw_output: format!("ControllerPowerState: {}", power_state),
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<BluetoothStatus> {
        Ok(BluetoothStatus {
            bluetooth_disabled: false,
            service_state: "unknown".to_string(),
            service_type: "Unknown".to_string(),
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for BluetoothCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for BluetoothCheck {
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

        if status.bluetooth_disabled {
            Ok(CheckOutput::pass(
                format!(
                    "Bluetooth is disabled ({}: {})",
                    status.service_type, status.service_state
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "Bluetooth is enabled ({}: {}). Recommended to disable on servers",
                    status.service_type, status.service_state
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
        let check = BluetoothCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::DeviceControl);
        assert_eq!(check.definition().severity, CheckSeverity::Low);
    }

    #[test]
    fn test_check_frameworks() {
        let check = BluetoothCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_bluetooth_status_serialization() {
        let status = BluetoothStatus {
            bluetooth_disabled: true,
            service_state: "stopped".to_string(),
            service_type: "bthserv".to_string(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"bluetooth_disabled\":true"));
        assert!(json.contains("stopped"));

        let parsed: BluetoothStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.bluetooth_disabled);
        assert_eq!(parsed.service_state, "stopped");
    }

    #[test]
    fn test_bluetooth_enabled_status() {
        let status = BluetoothStatus {
            bluetooth_disabled: false,
            service_state: "running".to_string(),
            service_type: "bthserv".to_string(),
            raw_output: String::new(),
        };

        assert!(!status.bluetooth_disabled);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = BluetoothCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
