//! Active Directory Group Policy (GPO) auditing.
//!
//! Extracts and analyzes Group Policy settings for compliance:
//! - Password policies
//! - Account lockout policies
//! - Kerberos policies
//! - Audit policies
//! - User rights assignments
//! - Security options

use super::types::*;
#[cfg(target_os = "windows")]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use serde::{Deserialize, Serialize};
use tracing::info;
#[cfg(target_os = "windows")]
use tracing::{debug, warn};

/// Group Policy Object auditor.
pub struct GpoAuditor {
    /// Cache of retrieved settings.
    #[allow(dead_code)] // Reserved for caching in future
    cached_settings: Option<GpoSecuritySettings>,
}

impl GpoAuditor {
    /// Create a new GPO auditor.
    pub fn new() -> Self {
        Self {
            cached_settings: None,
        }
    }

    /// Get local security policy settings.
    pub async fn get_local_security_policy(&self) -> ScannerResult<GpoSecuritySettings> {
        info!("Retrieving local security policy settings");

        #[cfg(target_os = "windows")]
        {
            self.get_windows_local_policy().await
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows, return simulated/empty settings
            Ok(GpoSecuritySettings::default())
        }
    }

    /// Get domain Group Policy settings.
    #[cfg(target_os = "windows")]
    pub async fn get_domain_policy(
        &self,
        _domain: Option<&str>,
    ) -> ScannerResult<GpoSecuritySettings> {
        info!("Retrieving domain Group Policy settings");
        self.get_windows_domain_policy().await
    }

    /// Get privileged group memberships.
    pub async fn get_privileged_groups(
        &self,
        _domain: Option<&str>,
    ) -> ScannerResult<Vec<PrivilegedGroupInfo>> {
        info!("Enumerating privileged group memberships");

        #[cfg(target_os = "windows")]
        {
            self.get_windows_privileged_groups().await
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows, try to get local admin groups
            self.get_unix_privileged_groups().await
        }
    }

    #[cfg(target_os = "windows")]
    async fn get_windows_local_policy(&self) -> ScannerResult<GpoSecuritySettings> {
        use tokio::process::Command;

        let mut settings = GpoSecuritySettings::default();

        // Use secedit to export local policy
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                # Get password policy
                $policy = @{}

                # Use net accounts for basic settings
                $netAccounts = net accounts 2>$null
                foreach ($line in $netAccounts) {
                    if ($line -match "Minimum password length:\s+(\d+)") {
                        $policy["MinimumPasswordLength"] = [int]$Matches[1]
                    }
                    if ($line -match "Maximum password age \(days\):\s+(\d+)") {
                        $policy["MaximumPasswordAge"] = [int]$Matches[1]
                    }
                    if ($line -match "Minimum password age \(days\):\s+(\d+)") {
                        $policy["MinimumPasswordAge"] = [int]$Matches[1]
                    }
                    if ($line -match "Password history length:\s+(\d+)") {
                        $policy["PasswordHistorySize"] = [int]$Matches[1]
                    }
                    if ($line -match "Lockout threshold:\s+(\w+)") {
                        $val = $Matches[1]
                        if ($val -eq "Never") { $policy["LockoutThreshold"] = 0 }
                        else { $policy["LockoutThreshold"] = [int]$val }
                    }
                    if ($line -match "Lockout duration \(minutes\):\s+(\d+)") {
                        $policy["LockoutDuration"] = [int]$Matches[1]
                    }
                    if ($line -match "Lockout observation window \(minutes\):\s+(\d+)") {
                        $policy["LockoutObservationWindow"] = [int]$Matches[1]
                    }
                }

                # Check if complexity is enabled (requires secedit)
                try {
                    $tempFile = [System.IO.Path]::GetTempFileName()
                    secedit /export /cfg $tempFile /quiet 2>$null
                    $content = Get-Content $tempFile -Raw
                    if ($content -match "PasswordComplexity\s*=\s*(\d+)") {
                        $policy["PasswordComplexity"] = [int]$Matches[1]
                    }
                    if ($content -match "ClearTextPassword\s*=\s*(\d+)") {
                        $policy["ClearTextPassword"] = [int]$Matches[1]
                    }
                    Remove-Item $tempFile -Force 2>$null
                } catch {}

                $policy | ConvertTo-Json
                "#,
            ])
            .output()
            .await
            .map_err(|e| ScannerError::Io(e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(policy) = serde_json::from_str::<serde_json::Value>(&stdout) {
                settings.password_policy = PasswordPolicy {
                    min_length: policy
                        .get("MinimumPasswordLength")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    max_age_days: policy
                        .get("MaximumPasswordAge")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(42),
                    min_age_days: policy
                        .get("MinimumPasswordAge")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    history_count: policy
                        .get("PasswordHistorySize")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    complexity_enabled: policy
                        .get("PasswordComplexity")
                        .and_then(|v| v.as_i64())
                        .map(|v| v == 1)
                        .unwrap_or(false),
                    reversible_encryption: policy
                        .get("ClearTextPassword")
                        .and_then(|v| v.as_i64())
                        .map(|v| v == 1)
                        .unwrap_or(false),
                };

                settings.lockout_policy = AccountLockoutPolicy {
                    threshold: policy
                        .get("LockoutThreshold")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    duration_minutes: policy
                        .get("LockoutDuration")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    observation_window_minutes: policy
                        .get("LockoutObservationWindow")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                };
            }
        }

        // Get audit policy settings
        settings.audit_policy = self.get_audit_policy().await?;

        debug!(
            "Retrieved local security policy: {:?}",
            settings.password_policy
        );
        Ok(settings)
    }

    #[cfg(target_os = "windows")]
    async fn get_windows_domain_policy(&self) -> ScannerResult<GpoSecuritySettings> {
        use tokio::process::Command;

        // First check if we're domain-joined
        let domain_check = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(Get-WmiObject Win32_ComputerSystem).PartOfDomain",
            ])
            .output()
            .await
            .map_err(|e| ScannerError::Io(e))?;

        let is_domain = String::from_utf8_lossy(&domain_check.stdout)
            .trim()
            .to_lowercase()
            == "true";

        if !is_domain {
            warn!("System is not domain-joined, returning local policy");
            return self.get_windows_local_policy().await;
        }

        // Get domain password policy using Get-ADDefaultDomainPasswordPolicy
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                try {
                    Import-Module ActiveDirectory -ErrorAction SilentlyContinue
                    $policy = Get-ADDefaultDomainPasswordPolicy -ErrorAction Stop

                    @{
                        MinPasswordLength = $policy.MinPasswordLength
                        MaxPasswordAge = $policy.MaxPasswordAge.Days
                        MinPasswordAge = $policy.MinPasswordAge.Days
                        PasswordHistoryCount = $policy.PasswordHistoryCount
                        ComplexityEnabled = $policy.ComplexityEnabled
                        ReversibleEncryptionEnabled = $policy.ReversibleEncryptionEnabled
                        LockoutThreshold = $policy.LockoutThreshold
                        LockoutDuration = $policy.LockoutDuration.TotalMinutes
                        LockoutObservationWindow = $policy.LockoutObservationWindow.TotalMinutes
                    } | ConvertTo-Json
                } catch {
                    Write-Error "Failed to get domain policy: $_"
                    exit 1
                }
                "#,
            ])
            .output()
            .await
            .map_err(|e| ScannerError::Io(e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(policy) = serde_json::from_str::<serde_json::Value>(&stdout) {
                let mut settings = GpoSecuritySettings::default();

                settings.password_policy = PasswordPolicy {
                    min_length: policy
                        .get("MinPasswordLength")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    max_age_days: policy
                        .get("MaxPasswordAge")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(42),
                    min_age_days: policy
                        .get("MinPasswordAge")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    history_count: policy
                        .get("PasswordHistoryCount")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    complexity_enabled: policy
                        .get("ComplexityEnabled")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                    reversible_encryption: policy
                        .get("ReversibleEncryptionEnabled")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                };

                settings.lockout_policy = AccountLockoutPolicy {
                    threshold: policy
                        .get("LockoutThreshold")
                        .and_then(|v| v.as_i64())
                        .and_then(|v| u32::try_from(v).ok())
                        .unwrap_or(0),
                    duration_minutes: policy
                        .get("LockoutDuration")
                        .and_then(|v| v.as_f64())
                        .map(|v| v.clamp(0.0, u32::MAX as f64) as u32)
                        .unwrap_or(0),
                    observation_window_minutes: policy
                        .get("LockoutObservationWindow")
                        .and_then(|v| v.as_f64())
                        .map(|v| v.clamp(0.0, u32::MAX as f64) as u32)
                        .unwrap_or(0),
                };

                settings.audit_policy = self.get_audit_policy().await?;
                return Ok(settings);
            }
        }

        // Fall back to local policy
        self.get_windows_local_policy().await
    }

    #[cfg(target_os = "windows")]
    async fn get_audit_policy(&self) -> ScannerResult<AuditPolicy> {
        use tokio::process::Command;

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"
                $policy = @{}
                $auditpol = auditpol /get /category:* 2>$null

                foreach ($line in $auditpol) {
                    if ($line -match "^\s+(.+?)\s+(Success|Failure|Success and Failure|No Auditing)\s*$") {
                        $setting = $Matches[1].Trim()
                        $value = $Matches[2].Trim()
                        $policy[$setting] = $value
                    }
                }

                $policy | ConvertTo-Json
                "#,
            ])
            .output()
            .await
            .map_err(|e| ScannerError::Io(e))?;

        let mut audit = AuditPolicy::default();

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(policy) = serde_json::from_str::<serde_json::Value>(&stdout) {
                let get_setting = |key: &str| -> AuditSetting {
                    policy
                        .get(key)
                        .and_then(|v| v.as_str())
                        .map(|s| match s {
                            "Success" => AuditSetting::Success,
                            "Failure" => AuditSetting::Failure,
                            "Success and Failure" => AuditSetting::SuccessAndFailure,
                            _ => AuditSetting::NoAuditing,
                        })
                        .unwrap_or(AuditSetting::NoAuditing)
                };

                audit.logon_events = get_setting("Logon");
                audit.account_logon = get_setting("Credential Validation");
                audit.account_management = get_setting("User Account Management");
                audit.privilege_use = get_setting("Sensitive Privilege Use");
                audit.policy_change = get_setting("Audit Policy Change");
                audit.object_access = get_setting("File System");
                audit.system_events = get_setting("Security State Change");
            }
        }

        Ok(audit)
    }

    #[cfg(not(target_os = "windows"))]
    #[allow(dead_code)] // Called from Windows-only code paths
    async fn get_audit_policy(&self) -> ScannerResult<AuditPolicy> {
        Ok(AuditPolicy::default())
    }

    #[cfg(target_os = "windows")]
    async fn get_windows_privileged_groups(&self) -> ScannerResult<Vec<PrivilegedGroupInfo>> {
        use tokio::process::Command;

        let mut groups = Vec::new();

        // List of privileged groups to check
        let privileged_groups = [
            ("Administrators", "S-1-5-32-544", "Full system access"),
            (
                "Domain Admins",
                "S-1-5-21-*-512",
                "Domain-wide admin access",
            ),
            (
                "Enterprise Admins",
                "S-1-5-21-*-519",
                "Forest-wide admin access",
            ),
            (
                "Schema Admins",
                "S-1-5-21-*-518",
                "AD schema modification rights",
            ),
            (
                "Account Operators",
                "S-1-5-32-548",
                "Account creation/modification",
            ),
            (
                "Backup Operators",
                "S-1-5-32-551",
                "Backup/restore any file",
            ),
            (
                "Server Operators",
                "S-1-5-32-549",
                "Server management rights",
            ),
        ];

        for (group_name, sid_pattern, description) in privileged_groups {
            // Safety: group_name values are hardcoded above — no user input reaches format!().
            debug_assert!(
                !group_name.contains('$')
                    && !group_name.contains('`')
                    && !group_name.contains('"')
                    && !group_name.contains('\'')
                    && !group_name.contains(';')
                    && !group_name.contains('|')
                    && !group_name.contains('&'),
                "group_name must not contain PowerShell metacharacters"
            );
            let output = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        r#"
                        try {{
                            $members = Get-LocalGroupMember -Group "{}" -ErrorAction SilentlyContinue |
                                Select-Object -ExpandProperty Name
                            $members -join ","
                        }} catch {{
                            ""
                        }}
                        "#,
                        group_name
                    ),
                ])
                .output()
                .await;

            if let Ok(output) = output {
                if output.status.success() {
                    let members_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let members: Vec<String> = if members_str.is_empty() {
                        Vec::new()
                    } else {
                        members_str
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .collect()
                    };

                    let risk_level = match group_name {
                        "Administrators" | "Domain Admins" | "Enterprise Admins" => {
                            DirectorySeverity::Critical
                        }
                        "Schema Admins" | "Account Operators" => DirectorySeverity::High,
                        _ => DirectorySeverity::Medium,
                    };

                    groups.push(PrivilegedGroupInfo {
                        name: group_name.to_string(),
                        sid: Some(sid_pattern.to_string()),
                        dn: None,
                        member_count: members.len(),
                        members,
                        risk_level,
                        description: description.to_string(),
                    });
                }
            }
        }

        Ok(groups)
    }

    #[cfg(not(target_os = "windows"))]
    async fn get_unix_privileged_groups(&self) -> ScannerResult<Vec<PrivilegedGroupInfo>> {
        use tokio::process::Command;

        let mut groups = Vec::new();

        // Check sudo/wheel group
        for group_name in ["sudo", "wheel", "admin", "root"] {
            let output = Command::new("getent")
                .args(["group", group_name])
                .output()
                .await;

            if let Ok(output) = output
                && output.status.success() {
                    let line = String::from_utf8_lossy(&output.stdout);
                    let parts: Vec<&str> = line.trim().split(':').collect();

                    if parts.len() >= 4 {
                        let members: Vec<String> = parts[3]
                            .split(',')
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                            .collect();

                        groups.push(PrivilegedGroupInfo {
                            name: group_name.to_string(),
                            sid: None,
                            dn: None,
                            member_count: members.len(),
                            members,
                            risk_level: if group_name == "root" {
                                DirectorySeverity::Critical
                            } else {
                                DirectorySeverity::High
                            },
                            description: format!(
                                "Unix {} group with elevated privileges",
                                group_name
                            ),
                        });
                    }
                }
        }

        Ok(groups)
    }
}

impl Default for GpoAuditor {
    fn default() -> Self {
        Self::new()
    }
}

/// GPO security settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GpoSecuritySettings {
    /// Password policy settings.
    pub password_policy: PasswordPolicy,
    /// Account lockout policy.
    pub lockout_policy: AccountLockoutPolicy,
    /// Kerberos policy (domain only).
    pub kerberos_policy: KerberosPolicy,
    /// Audit policy settings.
    pub audit_policy: AuditPolicy,
    /// User rights assignments.
    pub user_rights: Vec<UserRightAssignment>,
    /// Security options.
    pub security_options: Vec<SecurityOption>,
}

/// A specific GPO setting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpoSetting {
    /// Setting name.
    pub name: String,
    /// Setting path in GPO.
    pub path: String,
    /// Current value.
    pub value: String,
    /// Expected value for compliance.
    pub expected_value: Option<String>,
    /// Whether this is a security-critical setting.
    pub is_security_critical: bool,
}

/// Password policy settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PasswordPolicy {
    /// Minimum password length.
    pub min_length: u32,
    /// Maximum password age in days.
    pub max_age_days: u32,
    /// Minimum password age in days.
    pub min_age_days: u32,
    /// Password history count.
    pub history_count: u32,
    /// Whether complexity requirements are enabled.
    pub complexity_enabled: bool,
    /// Whether reversible encryption is enabled (should be false).
    pub reversible_encryption: bool,
}

/// Account lockout policy settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountLockoutPolicy {
    /// Number of failed attempts before lockout (0 = disabled).
    pub threshold: u32,
    /// Lockout duration in minutes.
    pub duration_minutes: u32,
    /// Observation window in minutes.
    pub observation_window_minutes: u32,
}

/// Kerberos policy settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct KerberosPolicy {
    /// Maximum ticket lifetime in hours.
    pub max_ticket_lifetime_hours: u32,
    /// Maximum renewal age in days.
    pub max_renewal_days: u32,
    /// Maximum clock skew in minutes.
    pub max_clock_skew_minutes: u32,
}

/// Audit policy settings.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuditPolicy {
    /// Logon events auditing.
    pub logon_events: AuditSetting,
    /// Account logon events.
    pub account_logon: AuditSetting,
    /// Account management events.
    pub account_management: AuditSetting,
    /// Privilege use events.
    pub privilege_use: AuditSetting,
    /// Policy change events.
    pub policy_change: AuditSetting,
    /// Object access events.
    pub object_access: AuditSetting,
    /// System events.
    pub system_events: AuditSetting,
}

/// Audit setting values.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditSetting {
    #[default]
    NoAuditing,
    Success,
    Failure,
    SuccessAndFailure,
}

/// User right assignment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRightAssignment {
    /// Right name.
    pub name: String,
    /// Assigned users/groups.
    pub assigned_to: Vec<String>,
    /// Whether this is a sensitive right.
    pub is_sensitive: bool,
}

/// Security option setting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityOption {
    /// Option name.
    pub name: String,
    /// Current value.
    pub value: String,
    /// Recommended value.
    pub recommended_value: String,
    /// Whether current matches recommended.
    pub is_compliant: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpo_auditor_creation() {
        let auditor = GpoAuditor::new();
        assert!(auditor.cached_settings.is_none());
    }

    #[test]
    fn test_password_policy_defaults() {
        let policy = PasswordPolicy::default();
        assert_eq!(policy.min_length, 0);
        assert!(!policy.complexity_enabled);
        assert!(!policy.reversible_encryption);
    }

    #[test]
    fn test_audit_setting_default() {
        let setting = AuditSetting::default();
        assert_eq!(setting, AuditSetting::NoAuditing);
    }
}
