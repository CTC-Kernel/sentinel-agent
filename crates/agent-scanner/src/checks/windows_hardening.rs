//! Windows system hardening compliance checks.
//!
//! Comprehensive registry-based security checks for Windows:
//! - UAC configuration
//! - DEP/ASLR/SEHOP settings
//! - Credential Guard and LSA Protection
//! - Secure Boot status
//! - SMB/LDAP signing
//! - PowerShell security
//! - Cryptographic settings

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info, warn};

// ============================================================================
// Registry-based Hardening Check
// ============================================================================

/// Check ID for Windows hardening.
pub const WINDOWS_HARDENING_CHECK_ID: &str = "windows_hardening";

/// Individual hardening setting status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardeningSetting {
    pub name: String,
    pub category: String,
    pub registry_path: String,
    pub registry_value: String,
    pub current_value: Option<String>,
    pub expected_value: String,
    pub compliant: bool,
    pub severity: String,
    pub description: String,
    pub remediation: String,
}

/// Windows hardening status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowsHardeningStatus {
    pub compliant: bool,
    pub compliance_score: f32,
    pub total_checks: usize,
    pub passed_checks: usize,
    pub failed_checks: usize,
    pub settings: Vec<HardeningSetting>,
    #[serde(default)]
    pub critical_issues: Vec<String>,
}

/// Windows hardening compliance check.
pub struct WindowsHardeningCheck {
    definition: CheckDefinition,
}

impl WindowsHardeningCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(WINDOWS_HARDENING_CHECK_ID)
            .name("Windows System Hardening")
            .description(
                "Comprehensive Windows hardening check: UAC, DEP, ASLR, SEHOP, \
                 Credential Guard, LSA Protection, Secure Boot, SMB/LDAP signing",
            )
            .category(CheckCategory::KernelSecurity)
            .severity(CheckSeverity::Critical)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec!["windows".to_string()])
            .build();

        Self { definition }
    }

    #[cfg(target_os = "windows")]
    async fn check_hardening(&self) -> ScannerResult<WindowsHardeningStatus> {
        use std::process::Command;

        let mut settings = Vec::new();
        let mut critical_issues = Vec::new();

        // Define all hardening checks
        let checks = self.get_hardening_checks();

        for check in checks {
            let result = self.check_registry_value(&check).await;
            if !result.compliant && result.severity == "critical" {
                critical_issues.push(format!("{}: {}", result.name, result.description));
            }
            settings.push(result);
        }

        let passed = settings.iter().filter(|s| s.compliant).count();
        let total = settings.len();
        let score = if total > 0 {
            (passed as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        Ok(WindowsHardeningStatus {
            compliant: score >= 80.0 && critical_issues.is_empty(),
            compliance_score: score,
            total_checks: total,
            passed_checks: passed,
            failed_checks: total - passed,
            settings,
            critical_issues,
        })
    }

    #[cfg(target_os = "windows")]
    fn get_hardening_checks(&self) -> Vec<HardeningCheckDef> {
        vec![
            // UAC Settings
            HardeningCheckDef {
                name: "UAC Enabled",
                category: "User Account Control",
                path: r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System",
                value: "EnableLUA",
                expected: "1",
                severity: "critical",
                description: "User Account Control must be enabled",
                remediation: "Enable UAC in Control Panel > User Accounts",
            },
            HardeningCheckDef {
                name: "UAC Admin Approval Mode",
                category: "User Account Control",
                path: r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System",
                value: "ConsentPromptBehaviorAdmin",
                expected: "2", // Prompt for consent on secure desktop
                severity: "high",
                description: "Admin Approval Mode should prompt on secure desktop",
                remediation: "Set UAC to 'Always notify' in Control Panel",
            },
            HardeningCheckDef {
                name: "UAC Virtualization",
                category: "User Account Control",
                path: r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System",
                value: "EnableVirtualization",
                expected: "1",
                severity: "medium",
                description: "File and registry virtualization should be enabled",
                remediation: "Enable virtualization via Group Policy",
            },

            // DEP/ASLR/SEHOP
            HardeningCheckDef {
                name: "DEP OptOut Mode",
                category: "Memory Protection",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management",
                value: "MoveImages",
                expected: "1", // ASLR enabled
                severity: "critical",
                description: "ASLR (Address Space Layout Randomization) must be enabled",
                remediation: "Enable ASLR via bcdedit or Group Policy",
            },
            HardeningCheckDef {
                name: "SEHOP Enabled",
                category: "Memory Protection",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\kernel",
                value: "DisableExceptionChainValidation",
                expected: "0", // SEHOP enabled (0 = not disabled)
                severity: "high",
                description: "Structured Exception Handling Overwrite Protection",
                remediation: "Enable SEHOP via registry or EMET",
            },

            // Credential Protection
            HardeningCheckDef {
                name: "Credential Guard",
                category: "Credential Protection",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard",
                value: "EnableVirtualizationBasedSecurity",
                expected: "1",
                severity: "critical",
                description: "Virtualization-based security for credential protection",
                remediation: "Enable Credential Guard via Group Policy",
            },
            HardeningCheckDef {
                name: "LSA Protection",
                category: "Credential Protection",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Lsa",
                value: "RunAsPPL",
                expected: "1",
                severity: "critical",
                description: "LSA must run as Protected Process Light",
                remediation: "Set RunAsPPL=1 in registry and reboot",
            },
            HardeningCheckDef {
                name: "WDigest Disabled",
                category: "Credential Protection",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest",
                value: "UseLogonCredential",
                expected: "0",
                severity: "critical",
                description: "WDigest authentication must be disabled (prevents plaintext creds)",
                remediation: "Set UseLogonCredential=0 in registry",
            },
            HardeningCheckDef {
                name: "Cached Credentials Limit",
                category: "Credential Protection",
                path: r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
                value: "CachedLogonsCount",
                expected: "2", // CIS recommends 4 or less, we check for 2
                severity: "medium",
                description: "Limit cached domain credentials",
                remediation: "Reduce CachedLogonsCount to 2 or less",
            },

            // SMB Security
            HardeningCheckDef {
                name: "SMBv1 Disabled",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
                value: "SMB1",
                expected: "0",
                severity: "critical",
                description: "SMBv1 must be disabled (vulnerable to EternalBlue)",
                remediation: "Disable SMBv1 via PowerShell or Features",
            },
            HardeningCheckDef {
                name: "SMB Signing Required (Server)",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
                value: "RequireSecuritySignature",
                expected: "1",
                severity: "high",
                description: "Server must require SMB signing",
                remediation: "Enable via Group Policy: Network server: Digitally sign communications",
            },
            HardeningCheckDef {
                name: "SMB Signing Required (Client)",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters",
                value: "RequireSecuritySignature",
                expected: "1",
                severity: "high",
                description: "Client must require SMB signing",
                remediation: "Enable via Group Policy: Network client: Digitally sign communications",
            },
            HardeningCheckDef {
                name: "SMB Encryption Required",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
                value: "EncryptData",
                expected: "1",
                severity: "medium",
                description: "SMB encryption should be required",
                remediation: "Set-SmbServerConfiguration -EncryptData $true",
            },

            // LDAP Security
            HardeningCheckDef {
                name: "LDAP Signing Required",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\NTDS\Parameters",
                value: "LDAPServerIntegrity",
                expected: "2", // Require signing
                severity: "high",
                description: "LDAP server must require signing",
                remediation: "Set LDAP server signing requirement via Group Policy",
            },
            HardeningCheckDef {
                name: "LDAP Channel Binding",
                category: "Network Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Services\NTDS\Parameters",
                value: "LdapEnforceChannelBinding",
                expected: "2", // Always
                severity: "high",
                description: "LDAP channel binding should be enforced",
                remediation: "Enable LDAP channel binding via Group Policy",
            },

            // NTLM Security
            HardeningCheckDef {
                name: "NTLMv2 Only",
                category: "Authentication",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Lsa",
                value: "LmCompatibilityLevel",
                expected: "5", // Send NTLMv2 only, refuse LM & NTLM
                severity: "critical",
                description: "Only NTLMv2 should be accepted (refuse LM/NTLM)",
                remediation: "Set LAN Manager authentication level to 'Send NTLMv2 only'",
            },
            HardeningCheckDef {
                name: "LM Hash Storage Disabled",
                category: "Authentication",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Lsa",
                value: "NoLMHash",
                expected: "1",
                severity: "critical",
                description: "LM hash storage must be disabled",
                remediation: "Enable 'Do not store LAN Manager hash' in Group Policy",
            },

            // PowerShell Security
            HardeningCheckDef {
                name: "PowerShell Script Block Logging",
                category: "Audit & Logging",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging",
                value: "EnableScriptBlockLogging",
                expected: "1",
                severity: "high",
                description: "PowerShell script block logging should be enabled",
                remediation: "Enable via Group Policy: Turn on PowerShell Script Block Logging",
            },
            HardeningCheckDef {
                name: "PowerShell Transcription",
                category: "Audit & Logging",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription",
                value: "EnableTranscripting",
                expected: "1",
                severity: "medium",
                description: "PowerShell transcription should be enabled",
                remediation: "Enable via Group Policy: Turn on PowerShell Transcription",
            },
            HardeningCheckDef {
                name: "PowerShell Module Logging",
                category: "Audit & Logging",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging",
                value: "EnableModuleLogging",
                expected: "1",
                severity: "medium",
                description: "PowerShell module logging should be enabled",
                remediation: "Enable via Group Policy: Turn on Module Logging",
            },
            HardeningCheckDef {
                name: "PowerShell Constrained Language Mode",
                category: "Application Control",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
                value: "__PSLockdownPolicy",
                expected: "4", // ConstrainedLanguage
                severity: "medium",
                description: "PowerShell should use Constrained Language Mode",
                remediation: "Enable via AppLocker or WDAC policies",
            },

            // Cryptographic Settings
            HardeningCheckDef {
                name: "TLS 1.0 Disabled (Server)",
                category: "Cryptography",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.0\Server",
                value: "Enabled",
                expected: "0",
                severity: "critical",
                description: "TLS 1.0 must be disabled (insecure)",
                remediation: "Disable TLS 1.0 via registry or IIS Crypto",
            },
            HardeningCheckDef {
                name: "TLS 1.1 Disabled (Server)",
                category: "Cryptography",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server",
                value: "Enabled",
                expected: "0",
                severity: "high",
                description: "TLS 1.1 should be disabled",
                remediation: "Disable TLS 1.1 via registry or IIS Crypto",
            },
            HardeningCheckDef {
                name: "SSL 3.0 Disabled",
                category: "Cryptography",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 3.0\Server",
                value: "Enabled",
                expected: "0",
                severity: "critical",
                description: "SSL 3.0 must be disabled (POODLE vulnerability)",
                remediation: "Disable SSL 3.0 via registry",
            },
            HardeningCheckDef {
                name: "RC4 Cipher Disabled",
                category: "Cryptography",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Ciphers\RC4 128/128",
                value: "Enabled",
                expected: "0",
                severity: "critical",
                description: "RC4 cipher must be disabled",
                remediation: "Disable RC4 via registry or IIS Crypto",
            },
            HardeningCheckDef {
                name: "3DES Cipher Disabled",
                category: "Cryptography",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Ciphers\Triple DES 168",
                value: "Enabled",
                expected: "0",
                severity: "high",
                description: "3DES cipher should be disabled (SWEET32)",
                remediation: "Disable 3DES via registry or IIS Crypto",
            },

            // Windows Defender / Security
            HardeningCheckDef {
                name: "Windows Defender Enabled",
                category: "Antimalware",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender",
                value: "DisableAntiSpyware",
                expected: "0", // 0 means NOT disabled
                severity: "critical",
                description: "Windows Defender must not be disabled",
                remediation: "Enable Windows Defender via Group Policy",
            },
            HardeningCheckDef {
                name: "Defender Real-Time Protection",
                category: "Antimalware",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection",
                value: "DisableRealtimeMonitoring",
                expected: "0",
                severity: "critical",
                description: "Real-time protection must not be disabled",
                remediation: "Enable real-time protection in Windows Security",
            },
            HardeningCheckDef {
                name: "Defender Cloud Protection",
                category: "Antimalware",
                path: r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet",
                value: "SpynetReporting",
                expected: "2", // Advanced
                severity: "medium",
                description: "Cloud-delivered protection should be enabled",
                remediation: "Enable cloud protection in Windows Security",
            },

            // Remote Desktop Security
            HardeningCheckDef {
                name: "RDP NLA Required",
                category: "Remote Access",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp",
                value: "UserAuthentication",
                expected: "1",
                severity: "high",
                description: "Network Level Authentication required for RDP",
                remediation: "Enable NLA in Remote Desktop settings",
            },
            HardeningCheckDef {
                name: "RDP Encryption Level",
                category: "Remote Access",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp",
                value: "MinEncryptionLevel",
                expected: "3", // High
                severity: "high",
                description: "RDP encryption level should be High",
                remediation: "Set encryption level to High via Group Policy",
            },

            // AutoRun/AutoPlay
            HardeningCheckDef {
                name: "AutoRun Disabled",
                category: "Device Control",
                path: r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer",
                value: "NoDriveTypeAutoRun",
                expected: "255", // Disable all
                severity: "high",
                description: "AutoRun must be disabled for all drives",
                remediation: "Disable AutoRun via Group Policy",
            },

            // Safe DLL Search
            HardeningCheckDef {
                name: "Safe DLL Search Mode",
                category: "Application Security",
                path: r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager",
                value: "SafeDllSearchMode",
                expected: "1",
                severity: "high",
                description: "Safe DLL search mode must be enabled",
                remediation: "Enable SafeDllSearchMode in registry",
            },
        ]
    }

    #[cfg(target_os = "windows")]
    async fn check_registry_value(&self, check: &HardeningCheckDef) -> HardeningSetting {
        use std::process::Command;

        // Use reg query to get the value
        let output = Command::new("reg")
            .args(["query", check.path, "/v", check.value])
            .output();

        let (current_value, compliant) = match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                // Parse the output to extract the value
                if let Some(value) = self.parse_reg_output(&stdout, check.value) {
                    let is_compliant = self.check_value_compliance(&value, check.expected);
                    (Some(value), is_compliant)
                } else {
                    (None, false)
                }
            }
            _ => {
                // Registry key doesn't exist - might be compliant by default or not
                // For security settings, missing usually means default (often insecure)
                (None, false)
            }
        };

        HardeningSetting {
            name: check.name.to_string(),
            category: check.category.to_string(),
            registry_path: check.path.to_string(),
            registry_value: check.value.to_string(),
            current_value,
            expected_value: check.expected.to_string(),
            compliant,
            severity: check.severity.to_string(),
            description: check.description.to_string(),
            remediation: check.remediation.to_string(),
        }
    }

    #[cfg(target_os = "windows")]
    fn parse_reg_output(&self, output: &str, value_name: &str) -> Option<String> {
        for line in output.lines() {
            let line = line.trim();
            if line.contains(value_name) {
                // Format: "ValueName    REG_TYPE    Data"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    // The value is the last part (might be hex like 0x1)
                    let value = parts.last().unwrap_or(&"");
                    // Convert hex to decimal if needed
                    if value.starts_with("0x") {
                        if let Ok(num) = u32::from_str_radix(&value[2..], 16) {
                            return Some(num.to_string());
                        }
                    }
                    return Some(value.to_string());
                }
            }
        }
        None
    }

    #[cfg(target_os = "windows")]
    fn check_value_compliance(&self, current: &str, expected: &str) -> bool {
        // Handle numeric comparisons
        if let (Ok(curr_num), Ok(exp_num)) = (current.parse::<i64>(), expected.parse::<i64>()) {
            return curr_num == exp_num;
        }
        // String comparison
        current.eq_ignore_ascii_case(expected)
    }

    #[cfg(not(target_os = "windows"))]
    async fn check_hardening(&self) -> ScannerResult<WindowsHardeningStatus> {
        Ok(WindowsHardeningStatus {
            compliant: true,
            compliance_score: 100.0,
            total_checks: 0,
            passed_checks: 0,
            failed_checks: 0,
            settings: vec![],
            critical_issues: vec![],
        })
    }
}

/// Definition of a hardening check.
#[cfg(target_os = "windows")]
struct HardeningCheckDef {
    name: &'static str,
    category: &'static str,
    path: &'static str,
    value: &'static str,
    expected: &'static str,
    severity: &'static str,
    description: &'static str,
    remediation: &'static str,
}

impl Default for WindowsHardeningCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for WindowsHardeningCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing Windows hardening check");

        let status = self.check_hardening().await?;
        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            info!(
                "Windows hardening check passed: {}/{} settings compliant ({:.1}%)",
                status.passed_checks, status.total_checks, status.compliance_score
            );
            Ok(CheckOutput::pass(
                format!(
                    "System hardening compliant ({}/{} checks, {:.1}%)",
                    status.passed_checks, status.total_checks, status.compliance_score
                ),
                raw_data,
            ))
        } else {
            warn!(
                "Windows hardening check failed: {} critical issues, {:.1}% compliant",
                status.critical_issues.len(),
                status.compliance_score
            );
            Ok(CheckOutput::fail(
                format!(
                    "System hardening non-compliant: {} critical issues, {}/{} passed ({:.1}%)",
                    status.critical_issues.len(),
                    status.passed_checks,
                    status.total_checks,
                    status.compliance_score
                ),
                raw_data,
            ))
        }
    }
}

// ============================================================================
// Secure Boot Check
// ============================================================================

/// Check ID for Secure Boot.
pub const SECURE_BOOT_CHECK_ID: &str = "secure_boot";

/// Secure Boot status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecureBootStatus {
    pub enabled: bool,
    pub uefi_mode: bool,
    pub setup_mode: bool,
    pub secure_boot_policy: Option<String>,
    pub platform_key_installed: bool,
}

/// Secure Boot compliance check.
pub struct SecureBootCheck {
    definition: CheckDefinition,
}

impl SecureBootCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(SECURE_BOOT_CHECK_ID)
            .name("Secure Boot Status")
            .description("Verify Secure Boot is enabled to prevent rootkit/bootkit attacks")
            .category(CheckCategory::KernelSecurity)
            .severity(CheckSeverity::Critical)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec!["windows".to_string()])
            .build();

        Self { definition }
    }

    #[cfg(target_os = "windows")]
    async fn check_secure_boot(&self) -> ScannerResult<SecureBootStatus> {
        use std::process::Command;

        // Use PowerShell to check Secure Boot status
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                try {
                    $sb = Confirm-SecureBootUEFI
                    @{
                        "Enabled" = $sb
                        "UefiMode" = $true
                    } | ConvertTo-Json
                } catch {
                    @{
                        "Enabled" = $false
                        "UefiMode" = $false
                        "Error" = $_.Exception.Message
                    } | ConvertTo-Json
                }
                "#,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let enabled = json.get("Enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                    let uefi = json.get("UefiMode").and_then(|v| v.as_bool()).unwrap_or(false);

                    return Ok(SecureBootStatus {
                        enabled,
                        uefi_mode: uefi,
                        setup_mode: false,
                        secure_boot_policy: None,
                        platform_key_installed: enabled,
                    });
                }
            }
            _ => {}
        }

        Ok(SecureBootStatus {
            enabled: false,
            uefi_mode: false,
            setup_mode: false,
            secure_boot_policy: None,
            platform_key_installed: false,
        })
    }

    #[cfg(not(target_os = "windows"))]
    async fn check_secure_boot(&self) -> ScannerResult<SecureBootStatus> {
        Ok(SecureBootStatus {
            enabled: true, // Assume compliant on non-Windows
            uefi_mode: true,
            setup_mode: false,
            secure_boot_policy: None,
            platform_key_installed: true,
        })
    }
}

impl Default for SecureBootCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for SecureBootCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing Secure Boot check");

        let status = self.check_secure_boot().await?;
        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.enabled && status.uefi_mode {
            Ok(CheckOutput::pass("Secure Boot is enabled", raw_data))
        } else if !status.uefi_mode {
            Ok(CheckOutput::fail(
                "System is not in UEFI mode - Secure Boot unavailable",
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                "Secure Boot is disabled - system vulnerable to bootkits",
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_hardening_check_creation() {
        let check = WindowsHardeningCheck::new();
        assert_eq!(check.definition().id, WINDOWS_HARDENING_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::KernelSecurity);
        assert!(check.definition().frameworks.contains(&"CIS_V8".to_string()));
    }

    #[test]
    fn test_secure_boot_check_creation() {
        let check = SecureBootCheck::new();
        assert_eq!(check.definition().id, SECURE_BOOT_CHECK_ID);
        assert_eq!(check.definition().severity, CheckSeverity::Critical);
    }

    #[test]
    fn test_hardening_setting_serialization() {
        let setting = HardeningSetting {
            name: "Test Setting".to_string(),
            category: "Test Category".to_string(),
            registry_path: "HKLM\\Test".to_string(),
            registry_value: "TestValue".to_string(),
            current_value: Some("1".to_string()),
            expected_value: "1".to_string(),
            compliant: true,
            severity: "high".to_string(),
            description: "Test description".to_string(),
            remediation: "Test remediation".to_string(),
        };

        let json = serde_json::to_string(&setting).unwrap();
        assert!(json.contains("Test Setting"));
    }
}
