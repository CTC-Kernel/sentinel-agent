//! MFA configuration compliance check.
//!
//! Verifies multi-factor authentication is configured:
//! - Windows: Azure AD / Windows Hello status
//! - Linux: PAM MFA modules (Google Authenticator, Duo, etc.)
//! - macOS: Touch ID / Smart Card status

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for MFA configuration.
pub const CHECK_ID: &str = "mfa_enabled";

/// MFA configuration status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MfaStatus {
    /// Whether MFA is configured/available.
    pub mfa_configured: bool,

    /// Whether MFA is enforced/required.
    pub mfa_enforced: bool,

    /// MFA provider/method detected.
    #[serde(default)]
    pub mfa_provider: Option<String>,

    /// List of available MFA methods.
    #[serde(default)]
    pub available_methods: Vec<String>,

    /// Enrollment status.
    #[serde(default)]
    pub enrollment_status: Option<String>,

    /// Whether device is domain-joined (Windows).
    pub domain_joined: Option<bool>,

    /// Whether device is Azure AD joined (Windows).
    pub azure_ad_joined: Option<bool>,

    /// Whether configuration meets compliance requirements.
    pub compliant: bool,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// MFA configuration compliance check.
pub struct MfaCheck {
    definition: CheckDefinition,
}

impl MfaCheck {
    /// Create a new MFA check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("MFA Configuration")
            .description("Verify multi-factor authentication is configured")
            .category(CheckCategory::Mfa)
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

    /// Check MFA on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<MfaStatus> {
        debug!("Checking Windows MFA configuration");

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $results = @{}

                # Check domain join status
                $computerInfo = Get-WmiObject Win32_ComputerSystem
                $results['DomainJoined'] = $computerInfo.PartOfDomain

                # Check Azure AD join status
                $dsregStatus = dsregcmd /status 2>&1 | Out-String
                $results['DsregOutput'] = $dsregStatus

                $azureJoined = $dsregStatus -match 'AzureAdJoined\s*:\s*YES'
                $results['AzureAdJoined'] = $azureJoined

                # Check Windows Hello status
                try {
                    $helloPath = 'HKLM:\SOFTWARE\Microsoft\PolicyManager\current\device\DeviceLock'
                    $helloEnabled = (Get-ItemProperty -Path $helloPath -Name 'DevicePasswordEnabled' -ErrorAction SilentlyContinue).DevicePasswordEnabled
                    $results['WindowsHelloPolicy'] = $helloEnabled

                    # Check NGC (Next Generation Credentials) container
                    $ngcPath = "$env:SystemRoot\ServiceProfiles\LocalService\AppData\Local\Microsoft\Ngc"
                    $results['NgcConfigured'] = Test-Path $ngcPath
                } catch {}

                # Check for Smart Card
                try {
                    $smartCard = Get-WmiObject -Query "SELECT * FROM Win32_SmartCardReader"
                    $results['SmartCardReader'] = if ($smartCard) { $true } else { $false }
                } catch {}

                # Check for credential providers
                try {
                    $credProviders = Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\Credential Providers'
                    $results['CredentialProviders'] = $credProviders.Name | ForEach-Object { Split-Path $_ -Leaf }
                } catch {}

                $results | ConvertTo-Json -Depth 3
                "#,
            ])
            .output()
            .map_err(|e| ScannerError::CheckExecution(format!("Failed to run PowerShell: {}", e)))?;

        let raw_output = String::from_utf8_lossy(&output.stdout).to_string();

        let mut status = MfaStatus {
            mfa_configured: false,
            mfa_enforced: false,
            mfa_provider: None,
            available_methods: vec![],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: false,
            issues: vec![],
            raw_output: raw_output.clone(),
        };

        // Parse JSON output
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_output) {
            // Domain join status
            status.domain_joined = json.get("DomainJoined").and_then(|v| v.as_bool());

            // Azure AD join status
            status.azure_ad_joined = json.get("AzureAdJoined").and_then(|v| v.as_bool());

            // Windows Hello
            if json.get("NgcConfigured").and_then(|v| v.as_bool()) == Some(true) {
                status.mfa_configured = true;
                status.available_methods.push("Windows Hello".to_string());
                status.mfa_provider = Some("Windows Hello".to_string());
            }

            // Smart Card
            if json.get("SmartCardReader").and_then(|v| v.as_bool()) == Some(true) {
                status.mfa_configured = true;
                status.available_methods.push("Smart Card".to_string());
                if status.mfa_provider.is_none() {
                    status.mfa_provider = Some("Smart Card".to_string());
                }
            }

            // Azure AD MFA (if joined)
            if status.azure_ad_joined == Some(true) {
                status.mfa_configured = true;
                status.available_methods.push("Azure AD MFA".to_string());
                status.mfa_provider = Some("Azure AD".to_string());
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check MFA on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<MfaStatus> {
        debug!("Checking Linux MFA configuration");

        let mut status = MfaStatus {
            mfa_configured: false,
            mfa_enforced: false,
            mfa_provider: None,
            available_methods: vec![],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check PAM configuration for MFA modules
        let pam_paths = [
            "/etc/pam.d/sshd",
            "/etc/pam.d/login",
            "/etc/pam.d/common-auth",
            "/etc/pam.d/system-auth",
        ];

        let mfa_modules = [
            ("pam_google_authenticator.so", "Google Authenticator"),
            ("pam_duo.so", "Duo Security"),
            ("pam_yubico.so", "YubiKey"),
            ("pam_u2f.so", "FIDO U2F"),
            ("pam_pkcs11.so", "Smart Card (PKCS#11)"),
            ("pam_oath.so", "OATH TOTP"),
        ];

        for path in &pam_paths {
            if let Ok(content) = std::fs::read_to_string(path) {
                status.raw_output.push_str(&format!("=== {} ===\n", path));

                for line in content.lines() {
                    let line_trimmed = line.trim();

                    // Skip comments and empty lines
                    if line_trimmed.starts_with('#') || line_trimmed.is_empty() {
                        continue;
                    }

                    for (module, name) in &mfa_modules {
                        if line_trimmed.contains(*module) {
                            status
                                .raw_output
                                .push_str(&format!("Found active: {} in {}\n", name, line_trimmed));

                            // Parse PAM line format: type control module-path [module-arguments]
                            // Examples:
                            //   auth required pam_google_authenticator.so
                            //   auth [success=1 default=ignore] pam_google_authenticator.so
                            let parts: Vec<&str> = line_trimmed.split_whitespace().collect();

                            // Verify this is an auth line (MFA should be in auth stack)
                            if parts.first().map(|&s| s == "auth").unwrap_or(false) {
                                status.mfa_configured = true;

                                // Only add if not already present
                                if !status.available_methods.contains(&name.to_string()) {
                                    status.available_methods.push(name.to_string());
                                }

                                if status.mfa_provider.is_none() {
                                    status.mfa_provider = Some(name.to_string());
                                }

                                // Check control field for enforcement level
                                if let Some(&control) = parts.get(1) {
                                    // "required" or "requisite" means MFA is enforced
                                    if control == "required" || control == "requisite" {
                                        status.mfa_enforced = true;
                                    }
                                    // Complex control like [success=ok new_authtok_reqd=ok...]
                                    // containing "die" or without "ignore" typically means required
                                    if control.starts_with('[') && control.contains("die") {
                                        status.mfa_enforced = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check for Google Authenticator config
        let home = std::env::var("HOME").unwrap_or_default();
        if std::path::Path::new(&format!("{}/.google_authenticator", home)).exists() {
            status.enrollment_status = Some("Enrolled".to_string());
            if !status
                .available_methods
                .contains(&"Google Authenticator".to_string())
            {
                status
                    .available_methods
                    .push("Google Authenticator".to_string());
            }
        }

        // Check for U2F devices
        if let Ok(output) = Command::new("lsusb").output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            if result.contains("YubiKey") || result.contains("Yubico") {
                status.mfa_configured = true;
                if !status.available_methods.contains(&"YubiKey".to_string()) {
                    status.available_methods.push("YubiKey".to_string());
                }
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Check MFA on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<MfaStatus> {
        debug!("Checking macOS MFA configuration");

        let mut status = MfaStatus {
            mfa_configured: false,
            mfa_enforced: false,
            mfa_provider: None,
            available_methods: vec![],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        // Check Touch ID status
        if let Ok(output) = Command::new("bioutil").args(["--status"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("=== bioutil status ===\n{}\n", result));

            if result.contains("Touch ID functionality: 1")
                || result.contains("User fingerprint enrolled")
            {
                status.mfa_configured = true;
                status.available_methods.push("Touch ID".to_string());
                status.mfa_provider = Some("Touch ID".to_string());
                status.enrollment_status = Some("Enrolled".to_string());
            }
        }

        // Check for Smart Card support
        if let Ok(output) = Command::new("security")
            .args(["smartcards", "list", "all"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            status.raw_output.push_str(&format!(
                "=== security smartcards ===\n{}\n{}\n",
                result, stderr
            ));

            if !result.contains("No smartcards") && !stderr.contains("No smartcards") {
                status.mfa_configured = true;
                status.available_methods.push("Smart Card".to_string());
                if status.mfa_provider.is_none() {
                    status.mfa_provider = Some("Smart Card".to_string());
                }
            }
        }

        // Check PAM for MFA modules (macOS)
        if let Ok(content) = std::fs::read_to_string("/etc/pam.d/authorization") {
            status
                .raw_output
                .push_str(&format!("=== /etc/pam.d/authorization ===\n{}\n", content));

            if content.contains("pam_tid.so") {
                status.mfa_configured = true;
                if !status.available_methods.contains(&"Touch ID".to_string()) {
                    status.available_methods.push("Touch ID (PAM)".to_string());
                }
            }
        }

        // Check for Apple Watch unlock
        if let Ok(output) = Command::new("defaults")
            .args(["read", "com.apple.security.authorization", "useSmartCards"])
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            if result.trim() == "1" {
                status.mfa_enforced = true;
            }
        }

        // Validate compliance
        status.issues = self.check_compliance(&status);
        status.compliant = status.issues.is_empty();

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<MfaStatus> {
        Ok(MfaStatus {
            mfa_configured: false,
            mfa_enforced: false,
            mfa_provider: None,
            available_methods: vec![],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: false,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }

    /// Check compliance based on parsed status.
    fn check_compliance(&self, status: &MfaStatus) -> Vec<String> {
        let mut issues = Vec::new();

        if !status.mfa_configured {
            issues.push("No MFA method configured".to_string());
        }

        issues
    }
}

impl Default for MfaCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for MfaCheck {
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
            if let Some(provider) = &status.mfa_provider {
                details.push(format!("provider={}", provider));
            }
            if !status.available_methods.is_empty() {
                details.push(format!("methods={}", status.available_methods.join("+")));
            }
            if status.mfa_enforced {
                details.push("enforced=yes".to_string());
            }

            Ok(CheckOutput::pass(
                format!("MFA is configured: {}", details.join(", ")),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("MFA issues: {}", status.issues.join("; ")),
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
        let check = MfaCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::Mfa);
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = MfaCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"DORA".to_string()));
    }

    #[test]
    fn test_mfa_status_serialization() {
        let status = MfaStatus {
            mfa_configured: true,
            mfa_enforced: true,
            mfa_provider: Some("Windows Hello".to_string()),
            available_methods: vec!["Windows Hello".to_string(), "Smart Card".to_string()],
            enrollment_status: Some("Enrolled".to_string()),
            domain_joined: Some(true),
            azure_ad_joined: Some(true),
            compliant: true,
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"mfa_configured\":true"));
        assert!(json.contains("Windows Hello"));

        let parsed: MfaStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.mfa_configured);
        assert_eq!(parsed.mfa_provider, Some("Windows Hello".to_string()));
    }

    #[test]
    fn test_compliance_check_pass() {
        let check = MfaCheck::new();
        let status = MfaStatus {
            mfa_configured: true,
            mfa_enforced: false,
            mfa_provider: Some("Touch ID".to_string()),
            available_methods: vec!["Touch ID".to_string()],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: true,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(issues.is_empty());
    }

    #[test]
    fn test_compliance_check_fail() {
        let check = MfaCheck::new();
        let status = MfaStatus {
            mfa_configured: false,
            mfa_enforced: false,
            mfa_provider: None,
            available_methods: vec![],
            enrollment_status: None,
            domain_joined: None,
            azure_ad_joined: None,
            compliant: false,
            issues: vec![],
            raw_output: String::new(),
        };

        let issues = check.check_compliance(&status);
        assert!(!issues.is_empty());
        assert!(issues.iter().any(|i| i.contains("No MFA")));
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = MfaCheck::new();
        let result = check.execute().await;

        // Should complete without error
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
