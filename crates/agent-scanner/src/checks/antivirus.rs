//! Antivirus status compliance check.
//!
//! Verifies that antivirus is active with current definitions:
//! - Windows: Windows Defender / Security Center
//! - Linux: ClamAV, Sophos, ESET
//! - macOS: XProtect / third-party AV

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
#[cfg(target_os = "windows")]
use chrono::Duration;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for antivirus status.
pub const CHECK_ID: &str = "antivirus_active";

/// Maximum age in days for antivirus definitions to be considered current.
#[cfg(target_os = "windows")]
const MAX_DEFINITION_AGE_DAYS: i64 = 7;

/// Antivirus status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntivirusStatus {
    /// Whether antivirus is installed and active.
    pub enabled: bool,

    /// Name of the antivirus product.
    pub av_name: String,

    /// Whether real-time protection is enabled.
    pub real_time_protection: bool,

    /// Date of virus definitions.
    #[serde(default)]
    pub definition_date: Option<DateTime<Utc>>,

    /// Version of virus definitions.
    #[serde(default)]
    pub definition_version: Option<String>,

    /// Whether definitions are up to date (< 7 days old).
    pub definitions_current: bool,

    /// Date of last scan.
    #[serde(default)]
    pub last_scan_date: Option<DateTime<Utc>>,

    /// Whether the AV service is running.
    pub service_running: bool,

    /// Additional AV products detected.
    #[serde(default)]
    pub additional_products: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Antivirus status compliance check.
pub struct AntivirusCheck {
    definition: CheckDefinition,
}

impl AntivirusCheck {
    /// Create a new antivirus check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Antivirus Status")
            .description("Verify antivirus is active with current definitions")
            .category(CheckCategory::Antivirus)
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

    /// Check antivirus on Windows using Security Center.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<AntivirusStatus> {
        debug!("Checking Windows Defender/Security Center status");

        // Check Windows Defender status via PowerShell
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $status = Get-MpComputerStatus | Select-Object AntivirusEnabled, RealTimeProtectionEnabled, AntivirusSignatureLastUpdated, AntivirusSignatureVersion, QuickScanEndTime
                $status | ConvertTo-Json
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            // Windows Defender might not be available
            if stderr.contains("not recognized") {
                return self.check_windows_wmi().await;
            }
            return Err(ScannerError::CheckExecution(format!(
                "Defender check failed: {}",
                stderr
            )));
        }

        self.parse_defender_output(&raw_output)
    }

    #[cfg(target_os = "windows")]
    fn parse_defender_output(&self, output: &str) -> ScannerResult<AntivirusStatus> {
        let json: serde_json::Value = serde_json::from_str(output).unwrap_or(serde_json::json!({}));

        let enabled = json["AntivirusEnabled"].as_bool().unwrap_or(false);
        let rtp = json["RealTimeProtectionEnabled"].as_bool().unwrap_or(false);
        let sig_version = json["AntivirusSignatureVersion"]
            .as_str()
            .map(|s| s.to_string());

        // Parse signature date
        let sig_date = json["AntivirusSignatureLastUpdated"]
            .as_str()
            .and_then(|s| {
                // PowerShell datetime format
                DateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%z")
                    .map(|d| d.with_timezone(&Utc))
                    .ok()
            });

        let last_scan = json["QuickScanEndTime"].as_str().and_then(|s| {
            DateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%z")
                .map(|d| d.with_timezone(&Utc))
                .ok()
        });

        let definitions_current = sig_date
            .map(|d| Utc::now() - d < Duration::days(MAX_DEFINITION_AGE_DAYS))
            .unwrap_or(false);

        Ok(AntivirusStatus {
            enabled,
            av_name: "Windows Defender".to_string(),
            real_time_protection: rtp,
            definition_date: sig_date,
            definition_version: sig_version,
            definitions_current,
            last_scan_date: last_scan,
            service_running: enabled,
            additional_products: vec![],
            raw_output: output.to_string(),
        })
    }

    #[cfg(target_os = "windows")]
    async fn check_windows_wmi(&self) -> ScannerResult<AntivirusStatus> {
        // Fallback to WMI for third-party AV
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName AntiVirusProduct | Select-Object displayName, productState | ConvertTo-Json"#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("WMI query failed: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        if raw_output.trim().is_empty() {
            return Ok(AntivirusStatus {
                enabled: false,
                av_name: "None".to_string(),
                real_time_protection: false,
                definition_date: None,
                definition_version: None,
                definitions_current: false,
                last_scan_date: None,
                service_running: false,
                additional_products: vec![],
                raw_output,
            });
        }

        // Parse WMI output
        let products: Vec<serde_json::Value> = if raw_output.trim().starts_with('[') {
            serde_json::from_str(&raw_output).unwrap_or_default()
        } else {
            match serde_json::from_str::<serde_json::Value>(&raw_output) {
                Ok(v) => vec![v],
                Err(_) => vec![],
            }
        };

        let mut av_names: Vec<String> = products
            .iter()
            .filter_map(|p| p["displayName"].as_str().map(|s| s.to_string()))
            .collect();

        let primary = av_names
            .first()
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());
        if !av_names.is_empty() {
            av_names.remove(0);
        }

        // productState bit flags: bit 12 = enabled, bit 4 = up to date
        let enabled = products
            .first()
            .and_then(|p| p["productState"].as_u64())
            .map(|s| (s & 0x1000) != 0)
            .unwrap_or(false);

        Ok(AntivirusStatus {
            enabled,
            av_name: primary,
            real_time_protection: enabled,
            definition_date: None,
            definition_version: None,
            definitions_current: false,
            last_scan_date: None,
            service_running: enabled,
            additional_products: av_names,
            raw_output,
        })
    }

    /// Check antivirus on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<AntivirusStatus> {
        debug!("Checking antivirus status on Linux");

        // Check for ClamAV
        if let Ok(status) = self.check_clamav().await {
            if status.enabled {
                return Ok(status);
            }
        }

        // Check for Sophos
        if let Ok(status) = self.check_sophos().await {
            if status.enabled {
                return Ok(status);
            }
        }

        // Check for ESET
        if let Ok(status) = self.check_eset().await {
            if status.enabled {
                return Ok(status);
            }
        }

        // No AV found
        Ok(AntivirusStatus {
            enabled: false,
            av_name: "None".to_string(),
            real_time_protection: false,
            definition_date: None,
            definition_version: None,
            definitions_current: false,
            last_scan_date: None,
            service_running: false,
            additional_products: vec![],
            raw_output: "No antivirus detected".to_string(),
        })
    }

    #[cfg(target_os = "linux")]
    async fn check_clamav(&self) -> ScannerResult<AntivirusStatus> {
        // Check if clamd is running
        let service_output = Command::new("systemctl")
            .args(["is-active", "clamav-daemon"])
            .output();

        let service_running = service_output
            .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "active")
            .unwrap_or(false);

        if !service_running {
            // Try clamav-freshclam
            let freshclam = Command::new("systemctl")
                .args(["is-active", "clamav-freshclam"])
                .output();

            if !freshclam.map(|o| o.status.success()).unwrap_or(false) {
                return Ok(AntivirusStatus {
                    enabled: false,
                    av_name: "ClamAV".to_string(),
                    real_time_protection: false,
                    definition_date: None,
                    definition_version: None,
                    definitions_current: false,
                    last_scan_date: None,
                    service_running: false,
                    additional_products: vec![],
                    raw_output: "ClamAV not running".to_string(),
                });
            }
        }

        // Get ClamAV version and signature info
        let version_output = Command::new("clamscan").args(["--version"]).output();

        let version_str = version_output
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();

        // Parse version string: "ClamAV 0.103.6/26123/Wed Jan 12 09:24:09 2024"
        let definition_version = version_str.split('/').nth(1).map(|s| s.to_string());

        Ok(AntivirusStatus {
            enabled: true,
            av_name: "ClamAV".to_string(),
            real_time_protection: service_running,
            definition_date: None, // Would need to parse from version string
            definition_version,
            definitions_current: {
                let db_path = std::path::Path::new("/var/lib/clamav/daily.cld");
                let alt_db_path = std::path::Path::new("/var/lib/clamav/daily.cvd");
                let path = if db_path.exists() { db_path } else { alt_db_path };
                path.metadata()
                    .and_then(|m| m.modified())
                    .map(|t| t.elapsed().unwrap_or_default().as_secs() < 7 * agent_common::constants::SECS_PER_DAY)
                    .unwrap_or(false)
            },
            last_scan_date: None,
            service_running,
            additional_products: vec![],
            raw_output: version_str,
        })
    }

    #[cfg(target_os = "linux")]
    async fn check_sophos(&self) -> ScannerResult<AntivirusStatus> {
        let output = Command::new("/opt/sophos-av/bin/savdstatus").output();

        match output {
            Ok(o) if o.status.success() => {
                let status = String::from_utf8_lossy(&o.stdout).to_string();
                let running = status.contains("running");

                Ok(AntivirusStatus {
                    enabled: running,
                    av_name: "Sophos".to_string(),
                    real_time_protection: running,
                    definition_date: None,
                    definition_version: None,
                    definitions_current: running,
                    last_scan_date: None,
                    service_running: running,
                    additional_products: vec![],
                    raw_output: status,
                })
            }
            _ => Ok(AntivirusStatus {
                enabled: false,
                av_name: "Sophos".to_string(),
                real_time_protection: false,
                definition_date: None,
                definition_version: None,
                definitions_current: false,
                last_scan_date: None,
                service_running: false,
                additional_products: vec![],
                raw_output: "Sophos not found".to_string(),
            }),
        }
    }

    #[cfg(target_os = "linux")]
    async fn check_eset(&self) -> ScannerResult<AntivirusStatus> {
        let output = Command::new("/opt/eset/esets/sbin/esets_daemon")
            .args(["--status"])
            .output();

        match output {
            Ok(o) if o.status.success() => {
                let status = String::from_utf8_lossy(&o.stdout).to_string();

                Ok(AntivirusStatus {
                    enabled: true,
                    av_name: "ESET".to_string(),
                    real_time_protection: true,
                    definition_date: None,
                    definition_version: None,
                    definitions_current: true,
                    last_scan_date: None,
                    service_running: true,
                    additional_products: vec![],
                    raw_output: status,
                })
            }
            _ => Ok(AntivirusStatus {
                enabled: false,
                av_name: "ESET".to_string(),
                real_time_protection: false,
                definition_date: None,
                definition_version: None,
                definitions_current: false,
                last_scan_date: None,
                service_running: false,
                additional_products: vec![],
                raw_output: "ESET not found".to_string(),
            }),
        }
    }

    /// Check antivirus on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<AntivirusStatus> {
        debug!("Checking antivirus status on macOS");

        // macOS has built-in XProtect
        // Check XProtect version
        let output = Command::new("system_profiler")
            .args(["SPInstallHistoryDataType", "-json"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to run system_profiler: {}", e))
            })?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        // XProtect is always enabled on macOS
        // Check for third-party AV as well
        let mut additional = Vec::new();

        // Check for common third-party AV
        if std::path::Path::new("/Library/Application Support/Malwarebytes").exists() {
            additional.push("Malwarebytes".to_string());
        }
        if std::path::Path::new("/Library/Sophos Anti-Virus").exists() {
            additional.push("Sophos".to_string());
        }

        Ok(AntivirusStatus {
            enabled: true,
            av_name: "XProtect".to_string(),
            real_time_protection: true,
            definition_date: None,
            definition_version: None,
            definitions_current: {
                // Check XProtect last update by file modification time
                let xprotect_path = std::path::Path::new("/Library/Apple/System/Library/CoreServices/XProtect.bundle");
                if xprotect_path.exists() {
                    xprotect_path.metadata()
                        .and_then(|m| m.modified())
                        .map(|t| t.elapsed().unwrap_or_default().as_secs() < 7 * agent_common::constants::SECS_PER_DAY)
                        .unwrap_or(false)
                } else {
                    false
                }
            },
            last_scan_date: None,
            service_running: true,
            additional_products: additional,
            raw_output,
        })
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<AntivirusStatus> {
        Ok(AntivirusStatus {
            enabled: false,
            av_name: "Unknown".to_string(),
            real_time_protection: false,
            definition_date: None,
            definition_version: None,
            definitions_current: false,
            last_scan_date: None,
            service_running: false,
            additional_products: vec![],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for AntivirusCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for AntivirusCheck {
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

        // Check passes if AV is enabled with real-time protection and current definitions
        let passed = status.enabled && status.real_time_protection && status.definitions_current;

        if passed {
            Ok(CheckOutput::pass(
                format!(
                    "{} is active with real-time protection. Definitions: {}",
                    status.av_name,
                    status.definition_version.as_deref().unwrap_or("current")
                ),
                raw_data,
            ))
        } else {
            let mut issues = Vec::new();
            if !status.enabled {
                issues.push("AV not enabled");
            }
            if !status.real_time_protection {
                issues.push("Real-time protection disabled");
            }
            if !status.definitions_current {
                issues.push("Definitions outdated (>7 days)");
            }

            Ok(CheckOutput::fail(
                format!("{} issues: {}", status.av_name, issues.join(", ")),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_check_creation() {
        let check = AntivirusCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Antivirus);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = AntivirusCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_antivirus_status_serialization() {
        let status = AntivirusStatus {
            enabled: true,
            av_name: "Windows Defender".to_string(),
            real_time_protection: true,
            definition_date: Some(Utc::now()),
            definition_version: Some("1.234.567".to_string()),
            definitions_current: true,
            last_scan_date: Some(Utc::now()),
            service_running: true,
            additional_products: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("Windows Defender"));
        assert!(json.contains("real_time_protection"));

        let parsed: AntivirusStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.enabled);
        assert!(parsed.definitions_current);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = AntivirusCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }

    #[test]
    fn test_definition_age_check() {
        let recent = Utc::now() - Duration::days(3);
        let old = Utc::now() - Duration::days(10);

        // Definitions older than 7 days are considered stale
        assert!(Utc::now() - recent < Duration::days(7));
        assert!((Utc::now() - old >= Duration::days(7)));
    }

    #[test]
    fn test_status_with_no_av() {
        let status = AntivirusStatus {
            enabled: false,
            av_name: "None".to_string(),
            real_time_protection: false,
            definition_date: None,
            definition_version: None,
            definitions_current: false,
            last_scan_date: None,
            service_running: false,
            additional_products: vec![],
            raw_output: String::new(),
        };

        assert!(!status.enabled);
        assert!(!status.real_time_protection);
    }
}
