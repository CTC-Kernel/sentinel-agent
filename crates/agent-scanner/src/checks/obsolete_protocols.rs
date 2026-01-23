//! Obsolete protocols compliance check.
//!
//! Verifies that obsolete/insecure protocols are disabled:
//! - Windows: SMBv1, TLS 1.0/1.1, SSLv3 via registry
//! - Linux: OpenSSL/system crypto policy
//! - macOS: System crypto settings

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for obsolete protocols.
pub const CHECK_ID: &str = "obsolete_protocols";

/// Obsolete protocols status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsoleteProtocolsStatus {
    /// Whether system is compliant (no obsolete protocols enabled).
    pub compliant: bool,

    /// SMBv1 protocol status.
    pub smbv1_enabled: Option<bool>,

    /// TLS 1.0 protocol status.
    pub tls10_enabled: Option<bool>,

    /// TLS 1.1 protocol status.
    pub tls11_enabled: Option<bool>,

    /// SSLv3 protocol status.
    pub sslv3_enabled: Option<bool>,

    /// SSLv2 protocol status.
    pub sslv2_enabled: Option<bool>,

    /// Minimum TLS version configured.
    pub min_tls_version: Option<String>,

    /// Whether weak ciphers are enabled.
    pub weak_ciphers_enabled: Option<bool>,

    /// System crypto policy (Linux).
    #[serde(default)]
    pub crypto_policy: Option<String>,

    /// List of enabled obsolete protocols.
    #[serde(default)]
    pub obsolete_enabled: Vec<String>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Obsolete protocols compliance check.
pub struct ObsoleteProtocolsCheck {
    definition: CheckDefinition,
}

impl ObsoleteProtocolsCheck {
    /// Create a new obsolete protocols check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Obsolete Protocols")
            .description("Verify obsolete protocols are disabled (SMBv1, TLS 1.0/1.1, SSLv3)")
            .category(CheckCategory::Protocols)
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

    /// Check obsolete protocols on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<ObsoleteProtocolsStatus> {
        debug!("Checking Windows obsolete protocols");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Check SMBv1
                $smb1Feature = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction SilentlyContinue
                if ($smb1Feature) {
                    $results['SMBv1_Feature'] = $smb1Feature.State
                }
                $smb1Client = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters' -Name 'SMB1' -ErrorAction SilentlyContinue).SMB1
                $results['SMBv1_Client'] = $smb1Client
                $smb1Server = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters' -Name 'SMB1' -ErrorAction SilentlyContinue).SMB1
                $results['SMBv1_Server'] = $smb1Server

                # Check TLS/SSL protocols
                $protocols = @('SSL 2.0', 'SSL 3.0', 'TLS 1.0', 'TLS 1.1', 'TLS 1.2', 'TLS 1.3')
                foreach ($protocol in $protocols) {
                    $clientPath = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\$protocol\Client"
                    $serverPath = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\$protocol\Server"

                    $clientEnabled = (Get-ItemProperty -Path $clientPath -Name 'Enabled' -ErrorAction SilentlyContinue).Enabled
                    $serverEnabled = (Get-ItemProperty -Path $serverPath -Name 'Enabled' -ErrorAction SilentlyContinue).Enabled
                    $clientDisabled = (Get-ItemProperty -Path $clientPath -Name 'DisabledByDefault' -ErrorAction SilentlyContinue).DisabledByDefault
                    $serverDisabled = (Get-ItemProperty -Path $serverPath -Name 'DisabledByDefault' -ErrorAction SilentlyContinue).DisabledByDefault

                    $key = $protocol -replace ' ', ''
                    $results["${key}_ClientEnabled"] = $clientEnabled
                    $results["${key}_ServerEnabled"] = $serverEnabled
                    $results["${key}_ClientDisabled"] = $clientDisabled
                    $results["${key}_ServerDisabled"] = $serverDisabled
                }

                $results | ConvertTo-Json -Depth 3
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = ObsoleteProtocolsStatus {
            compliant: true,
            smbv1_enabled: None,
            tls10_enabled: None,
            tls11_enabled: None,
            sslv3_enabled: None,
            sslv2_enabled: None,
            min_tls_version: None,
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // SMBv1 - enabled if feature is enabled or registry value is not 0
            // Windows 10 1709+ has SMBv1 disabled by default, so missing keys = disabled
            let smb1_feature = json.get("SMBv1_Feature")
                .and_then(|v| v.as_str())
                .map(|s| s == "Enabled");
            let smb1_client = json.get("SMBv1_Client")
                .and_then(|v| v.as_u64())
                .map(|v| v != 0);
            let smb1_server = json.get("SMBv1_Server")
                .and_then(|v| v.as_u64())
                .map(|v| v != 0);

            // Only consider SMBv1 enabled if explicitly enabled via feature or registry
            // Missing registry keys on modern Windows mean SMBv1 is disabled by default
            let smb1_enabled = smb1_feature.unwrap_or(false)
                || smb1_client.unwrap_or(false)
                || smb1_server.unwrap_or(false);
            status.smbv1_enabled = Some(smb1_enabled);

            // SSLv2
            let ssl2_enabled = Self::is_protocol_enabled(&json, "SSL20");
            status.sslv2_enabled = Some(ssl2_enabled);

            // SSLv3
            let ssl3_enabled = Self::is_protocol_enabled(&json, "SSL30");
            status.sslv3_enabled = Some(ssl3_enabled);

            // TLS 1.0
            let tls10_enabled = Self::is_protocol_enabled(&json, "TLS10");
            status.tls10_enabled = Some(tls10_enabled);

            // TLS 1.1
            let tls11_enabled = Self::is_protocol_enabled(&json, "TLS11");
            status.tls11_enabled = Some(tls11_enabled);

            // Determine minimum TLS version
            let tls12_enabled = Self::is_protocol_enabled(&json, "TLS12");
            let tls13_enabled = Self::is_protocol_enabled(&json, "TLS13");

            status.min_tls_version = Some(
                if tls10_enabled { "1.0" }
                else if tls11_enabled { "1.1" }
                else if tls12_enabled { "1.2" }
                else if tls13_enabled { "1.3" }
                else { "Unknown" }
                .to_string()
            );
        }

        // Build list of enabled obsolete protocols
        if status.smbv1_enabled == Some(true) {
            status.obsolete_enabled.push("SMBv1".to_string());
        }
        if status.sslv2_enabled == Some(true) {
            status.obsolete_enabled.push("SSLv2".to_string());
        }
        if status.sslv3_enabled == Some(true) {
            status.obsolete_enabled.push("SSLv3".to_string());
        }
        if status.tls10_enabled == Some(true) {
            status.obsolete_enabled.push("TLS 1.0".to_string());
        }
        if status.tls11_enabled == Some(true) {
            status.obsolete_enabled.push("TLS 1.1".to_string());
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    #[cfg(target_os = "windows")]
    fn is_protocol_enabled(json: &serde_json::Value, prefix: &str) -> bool {
        // Protocol is enabled if:
        // - ClientEnabled or ServerEnabled is 1
        // Protocol is disabled if:
        // - Enabled is 0, OR
        // - DisabledByDefault is 1, OR
        // - No registry keys exist (modern Windows defaults)
        //
        // On Windows 10 1607+ and Server 2016+:
        // - SSLv2, SSLv3, TLS 1.0, TLS 1.1 are disabled by default
        // - TLS 1.2, TLS 1.3 are enabled by default
        // Missing registry keys means the system default applies.

        let client_enabled = json.get(&format!("{}_ClientEnabled", prefix)).and_then(|v| v.as_u64());
        let server_enabled = json.get(&format!("{}_ServerEnabled", prefix)).and_then(|v| v.as_u64());
        let client_disabled = json.get(&format!("{}_ClientDisabled", prefix)).and_then(|v| v.as_u64());
        let server_disabled = json.get(&format!("{}_ServerDisabled", prefix)).and_then(|v| v.as_u64());

        // If explicitly disabled
        if client_enabled == Some(0) && server_enabled == Some(0) {
            return false;
        }
        if client_disabled == Some(1) || server_disabled == Some(1) {
            return false;
        }

        // If explicitly enabled
        if client_enabled == Some(1) || server_enabled == Some(1) {
            return true;
        }

        // If not explicitly configured, determine default based on protocol
        // Modern Windows (10 1607+/Server 2016+) has legacy protocols disabled by default
        let is_legacy = matches!(prefix, "SSL20" | "SSL30" | "TLS10" | "TLS11");
        if client_enabled.is_none() && server_enabled.is_none()
            && client_disabled.is_none() && server_disabled.is_none() {
            // Legacy protocols default to disabled, modern protocols default to enabled
            return !is_legacy;
        }

        // If we have some keys but not all, be conservative: assume disabled for legacy
        !is_legacy
    }

    /// Check obsolete protocols on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<ObsoleteProtocolsStatus> {
        debug!("Checking Linux obsolete protocols");

        let mut status = ObsoleteProtocolsStatus {
            compliant: true,
            smbv1_enabled: None,
            tls10_enabled: None,
            tls11_enabled: None,
            sslv3_enabled: None,
            sslv2_enabled: None,
            min_tls_version: None,
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        // Check system crypto policy (RHEL/Fedora)
        if let Ok(content) = std::fs::read_to_string("/etc/crypto-policies/config") {
            let policy = content.trim().to_string();
            status.raw_output.push_str(&format!("Crypto policy: {}\n", policy));
            status.crypto_policy = Some(policy.clone());

            // Policies like LEGACY allow old protocols
            if policy.to_uppercase() == "LEGACY" {
                status.tls10_enabled = Some(true);
                status.tls11_enabled = Some(true);
                status.obsolete_enabled.push("TLS 1.0 (LEGACY policy)".to_string());
                status.obsolete_enabled.push("TLS 1.1 (LEGACY policy)".to_string());
            } else if policy.to_uppercase() == "DEFAULT" || policy.to_uppercase() == "FUTURE" {
                status.tls10_enabled = Some(false);
                status.tls11_enabled = Some(false);
                status.sslv3_enabled = Some(false);
                status.min_tls_version = Some("1.2".to_string());
            }
        }

        // Check OpenSSL configuration
        if let Ok(content) = std::fs::read_to_string("/etc/ssl/openssl.cnf") {
            status.raw_output.push_str(&format!("=== /etc/ssl/openssl.cnf ===\n{}\n", content));

            for line in content.lines() {
                let line = line.trim().to_lowercase();

                if line.contains("minprotocol") {
                    if line.contains("tlsv1.2") || line.contains("tls1.2") {
                        status.min_tls_version = Some("1.2".to_string());
                        status.tls10_enabled = Some(false);
                        status.tls11_enabled = Some(false);
                    } else if line.contains("tlsv1.3") || line.contains("tls1.3") {
                        status.min_tls_version = Some("1.3".to_string());
                    } else if line.contains("tlsv1.1") || line.contains("tls1.1") {
                        status.min_tls_version = Some("1.1".to_string());
                        status.tls10_enabled = Some(false);
                        status.tls11_enabled = Some(true);
                        status.obsolete_enabled.push("TLS 1.1".to_string());
                    } else if line.contains("tlsv1") || line.contains("tls1.0") {
                        status.min_tls_version = Some("1.0".to_string());
                        status.tls10_enabled = Some(true);
                        status.obsolete_enabled.push("TLS 1.0".to_string());
                    }
                }
            }
        }

        // Check SMB configuration
        if let Ok(content) = std::fs::read_to_string("/etc/samba/smb.conf") {
            status.raw_output.push_str(&format!("=== /etc/samba/smb.conf ===\n{}\n", content));

            let content_lower = content.to_lowercase();
            if content_lower.contains("server min protocol = nt1")
                || content_lower.contains("server min protocol = lanman")
                || content_lower.contains("server min protocol = core")
            {
                status.smbv1_enabled = Some(true);
                status.obsolete_enabled.push("SMBv1".to_string());
            } else if content_lower.contains("server min protocol") {
                status.smbv1_enabled = Some(false);
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check obsolete protocols on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<ObsoleteProtocolsStatus> {
        debug!("Checking macOS obsolete protocols");

        let mut status = ObsoleteProtocolsStatus {
            compliant: true,
            smbv1_enabled: None,
            tls10_enabled: None,
            tls11_enabled: None,
            sslv3_enabled: None,
            sslv2_enabled: None,
            min_tls_version: None,
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        // Check SMB configuration
        if let Ok(output) = Command::new("defaults")
            .args(["read", "/Library/Preferences/SystemConfiguration/com.apple.smb.server"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status.raw_output.push_str(&format!("SMB Server Config:\n{}\n", result));

            // Check for SMB1 signing requirement (older systems)
            if result.contains("SigningRequired = 0") || result.contains("RequireSMB1 = 1") {
                status.smbv1_enabled = Some(true);
                status.obsolete_enabled.push("SMBv1".to_string());
            }
        }

        // Check macOS version to determine TLS defaults
        // macOS 10.15 (Catalina)+ disabled TLS 1.0/1.1 for App Transport Security
        // macOS 12 (Monterey)+ fully deprecated legacy TLS
        if let Ok(output) = Command::new("sw_vers")
            .args(["-productVersion"])
            .output()
        {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            status.raw_output.push_str(&format!("macOS version: {}\n", version));

            // Parse major version number
            let major_version: u32 = version.split('.').next()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);

            // SSLv2/SSLv3 have been disabled since macOS 10.8
            status.sslv2_enabled = Some(false);
            status.sslv3_enabled = Some(false);

            if major_version >= 12 {
                // macOS 12+ (Monterey): TLS 1.0/1.1 fully deprecated
                status.tls10_enabled = Some(false);
                status.tls11_enabled = Some(false);
                status.min_tls_version = Some("1.2".to_string());
            } else if major_version >= 10 {
                // macOS 10.x - need to check minor version
                let minor_version: u32 = version.split('.').nth(1)
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);

                if minor_version >= 15 {
                    // macOS 10.15+ (Catalina): TLS 1.0/1.1 disabled by default for ATS
                    status.tls10_enabled = Some(false);
                    status.tls11_enabled = Some(false);
                    status.min_tls_version = Some("1.2".to_string());
                } else {
                    // Older macOS: TLS 1.0/1.1 may be enabled
                    // Cannot determine definitively without more checks
                    status.tls10_enabled = None;
                    status.tls11_enabled = None;
                    status.min_tls_version = Some("Unknown".to_string());
                    status.issues.push("Older macOS version - TLS status unknown".to_string());
                }
            } else {
                // Very old macOS or parsing failed
                status.issues.push("Unable to determine macOS version for TLS status".to_string());
            }
        } else {
            status.issues.push("Failed to check macOS version".to_string());
        }

        // Check nscurl for TLS support
        if let Ok(output) = Command::new("nscurl")
            .args(["--ats-diagnostics", "--verbose"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stderr).to_string();
            status.raw_output.push_str(&format!("ATS Diagnostics:\n{}\n", result));

            // App Transport Security enforces TLS 1.2+
            if result.contains("ATS Default") && result.contains("PASS") {
                status.min_tls_version = Some("1.2".to_string());
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<ObsoleteProtocolsStatus> {
        Ok(ObsoleteProtocolsStatus {
            compliant: false,
            smbv1_enabled: None,
            tls10_enabled: None,
            tls11_enabled: None,
            sslv3_enabled: None,
            sslv2_enabled: None,
            min_tls_version: None,
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &ObsoleteProtocolsStatus) -> Vec<String> {
        let mut issues = Vec::new();

        if status.smbv1_enabled == Some(true) {
            issues.push("SMBv1 is enabled (known vulnerability)".to_string());
        }

        if status.sslv2_enabled == Some(true) {
            issues.push("SSLv2 is enabled (severely insecure)".to_string());
        }

        if status.sslv3_enabled == Some(true) {
            issues.push("SSLv3 is enabled (POODLE vulnerability)".to_string());
        }

        if status.tls10_enabled == Some(true) {
            issues.push("TLS 1.0 is enabled (deprecated protocol)".to_string());
        }

        if status.tls11_enabled == Some(true) {
            issues.push("TLS 1.1 is enabled (deprecated protocol)".to_string());
        }

        if status.weak_ciphers_enabled == Some(true) {
            issues.push("Weak ciphers are enabled".to_string());
        }

        issues
    }
}

impl Default for ObsoleteProtocolsCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for ObsoleteProtocolsCheck {
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
            if let Some(min_tls) = &status.min_tls_version {
                details.push(format!("min_tls={}", min_tls));
            }
            if status.smbv1_enabled == Some(false) {
                details.push("smbv1=disabled".to_string());
            }

            Ok(CheckOutput::pass(
                format!("No obsolete protocols enabled: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("Obsolete protocols enabled: {}", status.obsolete_enabled.join(", ")),
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
        let check = ObsoleteProtocolsCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Protocols);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = ObsoleteProtocolsCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_obsolete_protocols_status_serialization() {
        let status = ObsoleteProtocolsStatus {
            compliant: true,
            smbv1_enabled: Some(false),
            tls10_enabled: Some(false),
            tls11_enabled: Some(false),
            sslv3_enabled: Some(false),
            sslv2_enabled: Some(false),
            min_tls_version: Some("1.2".to_string()),
            weak_ciphers_enabled: Some(false),
            crypto_policy: Some("DEFAULT".to_string()),
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"compliant\":true"));
        assert!(json.contains("\"min_tls_version\":\"1.2\""));

        let parsed: ObsoleteProtocolsStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.compliant);
        assert_eq!(parsed.min_tls_version, Some("1.2".to_string()));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = ObsoleteProtocolsCheck::new();
        let status = ObsoleteProtocolsStatus {
            compliant: true,
            smbv1_enabled: Some(false),
            tls10_enabled: Some(false),
            tls11_enabled: Some(false),
            sslv3_enabled: Some(false),
            sslv2_enabled: Some(false),
            min_tls_version: Some("1.2".to_string()),
            weak_ciphers_enabled: Some(false),
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail_smbv1() {
        let check = ObsoleteProtocolsCheck::new();
        let status = ObsoleteProtocolsStatus {
            compliant: false,
            smbv1_enabled: Some(true),
            tls10_enabled: Some(false),
            tls11_enabled: Some(false),
            sslv3_enabled: Some(false),
            sslv2_enabled: Some(false),
            min_tls_version: Some("1.2".to_string()),
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec!["SMBv1".to_string()],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("SMBv1")));
    }

    #[test]
    fn test_compliance_check_fail_tls10() {
        let check = ObsoleteProtocolsCheck::new();
        let status = ObsoleteProtocolsStatus {
            compliant: false,
            smbv1_enabled: Some(false),
            tls10_enabled: Some(true),
            tls11_enabled: Some(false),
            sslv3_enabled: Some(false),
            sslv2_enabled: Some(false),
            min_tls_version: Some("1.0".to_string()),
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec!["TLS 1.0".to_string()],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("TLS 1.0")));
    }

    #[test]
    fn test_compliance_check_multiple_failures() {
        let check = ObsoleteProtocolsCheck::new();
        let status = ObsoleteProtocolsStatus {
            compliant: false,
            smbv1_enabled: Some(true),
            tls10_enabled: Some(true),
            tls11_enabled: Some(true),
            sslv3_enabled: Some(true),
            sslv2_enabled: Some(false),
            min_tls_version: Some("1.0".to_string()),
            weak_ciphers_enabled: None,
            crypto_policy: None,
            obsolete_enabled: vec![],
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert_eq!(issues.len(), 4); // SMBv1, SSLv3, TLS 1.0, TLS 1.1
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = ObsoleteProtocolsCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
