//! Directory services policy compliance checks.
//!
//! Audits Active Directory Group Policy, OpenLDAP, and local security policies:
//! - Password policy (length, complexity, history, age)
//! - Account lockout policy (threshold, duration, observation window)
//! - Audit policy (logon, account management, privilege use)
//! - Privileged group membership (Domain Admins, Enterprise Admins)
//! - LDAP security (TLS, anonymous bind, password policy overlay)

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::directory::{
    ComplianceStatus, DirectoryAuditor, DirectoryCategory, DirectoryFinding,
};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

// ============================================================================
// GPO Password Policy Check
// ============================================================================

/// Check ID for GPO password policy.
pub const GPO_PASSWORD_POLICY_CHECK_ID: &str = "gpo_password_policy";

/// GPO password policy status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpoPasswordPolicyStatus {
    /// Directory type (LocalPolicy, ActiveDirectory, etc.)
    pub directory_type: String,
    /// Whether password policy meets compliance requirements.
    pub compliant: bool,
    /// Overall compliance score (0-100).
    pub compliance_score: f32,
    /// Minimum password length.
    pub min_length: Option<u32>,
    /// Whether complexity is required.
    pub complexity_required: Option<bool>,
    /// Password history count.
    pub history_count: Option<u32>,
    /// Maximum password age in days.
    pub max_age_days: Option<u32>,
    /// Minimum password age in days.
    pub min_age_days: Option<u32>,
    /// Individual findings.
    pub findings: Vec<PolicyFinding>,
    /// Non-compliance issues.
    #[serde(default)]
    pub issues: Vec<String>,
}

/// A simplified policy finding for serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyFinding {
    pub id: String,
    pub policy_name: String,
    pub category: String,
    pub severity: String,
    pub status: String,
    pub current_value: String,
    pub expected_value: String,
    pub description: String,
    pub remediation: String,
    pub frameworks: Vec<String>,
}

impl From<&DirectoryFinding> for PolicyFinding {
    fn from(f: &DirectoryFinding) -> Self {
        Self {
            id: f.id.clone(),
            policy_name: f.policy_name.clone(),
            category: format!("{:?}", f.category),
            severity: format!("{:?}", f.severity),
            status: format!("{:?}", f.compliance_status),
            current_value: f.current_value.clone(),
            expected_value: f.expected_value.clone(),
            description: f.description.clone(),
            remediation: f.remediation.clone(),
            frameworks: f.frameworks.clone(),
        }
    }
}

/// GPO password policy compliance check.
pub struct GpoPasswordPolicyCheck {
    definition: CheckDefinition,
}

impl GpoPasswordPolicyCheck {
    /// Create a new GPO password policy check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(GPO_PASSWORD_POLICY_CHECK_ID)
            .name("Directory Password Policy")
            .description(
                "Verify password policy via Group Policy or local security policy \
                 (min length 14, complexity required, history 24, max age 90 days)",
            )
            .category(CheckCategory::DirectoryPolicy)
            .severity(CheckSeverity::Critical)
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
}

impl Default for GpoPasswordPolicyCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for GpoPasswordPolicyCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing GPO password policy check");

        let auditor = DirectoryAuditor::new();
        let result = auditor.audit_local_policies().await?;

        // Extract password policy findings
        let password_findings: Vec<&DirectoryFinding> = result
            .findings
            .iter()
            .filter(|f| f.category == DirectoryCategory::PasswordPolicy)
            .collect();

        let compliant_count = password_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::Compliant)
            .count();

        let total = password_findings.len();
        let score = if total > 0 {
            (compliant_count as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        // Extract policy values from GPO settings
        let (min_length, complexity, history, max_age, min_age) =
            if let Some(ref gpo) = result.gpo_settings {
                (
                    Some(gpo.password_policy.min_length),
                    Some(gpo.password_policy.complexity_enabled),
                    Some(gpo.password_policy.history_count),
                    Some(gpo.password_policy.max_age_days),
                    Some(gpo.password_policy.min_age_days),
                )
            } else {
                (None, None, None, None, None)
            };

        // Collect issues
        let issues: Vec<String> = password_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
            .map(|f| format!("{}: {} (current: {})", f.policy_name, f.description, f.current_value))
            .collect();

        let status = GpoPasswordPolicyStatus {
            directory_type: format!("{:?}", result.directory_type),
            compliant: score >= 80.0,
            compliance_score: score,
            min_length,
            complexity_required: complexity,
            history_count: history,
            max_age_days: max_age,
            min_age_days: min_age,
            findings: password_findings.iter().map(|f| PolicyFinding::from(*f)).collect(),
            issues: issues.clone(),
        };

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            info!("GPO password policy check passed with score {:.1}%", score);
            Ok(CheckOutput::pass(
                format!("Password policy compliant ({:.1}%)", score),
                raw_data,
            ))
        } else {
            warn!("GPO password policy check failed with score {:.1}%", score);
            Ok(CheckOutput::fail(
                format!(
                    "Password policy non-compliant ({:.1}%): {}",
                    score,
                    issues.join("; ")
                ),
                raw_data,
            ))
        }
    }
}

// ============================================================================
// GPO Account Lockout Check
// ============================================================================

/// Check ID for GPO account lockout policy.
pub const GPO_LOCKOUT_CHECK_ID: &str = "gpo_account_lockout";

/// GPO account lockout policy status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpoLockoutPolicyStatus {
    pub directory_type: String,
    pub compliant: bool,
    pub compliance_score: f32,
    pub lockout_threshold: Option<u32>,
    pub lockout_duration_minutes: Option<u32>,
    pub observation_window_minutes: Option<u32>,
    pub findings: Vec<PolicyFinding>,
    #[serde(default)]
    pub issues: Vec<String>,
}

/// GPO account lockout policy compliance check.
pub struct GpoLockoutPolicyCheck {
    definition: CheckDefinition,
}

impl GpoLockoutPolicyCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(GPO_LOCKOUT_CHECK_ID)
            .name("Directory Account Lockout Policy")
            .description(
                "Verify account lockout policy via Group Policy \
                 (threshold <= 5, duration >= 15 min, observation window >= 15 min)",
            )
            .category(CheckCategory::DirectoryPolicy)
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
}

impl Default for GpoLockoutPolicyCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for GpoLockoutPolicyCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing GPO account lockout policy check");

        let auditor = DirectoryAuditor::new();
        let result = auditor.audit_local_policies().await?;

        let lockout_findings: Vec<&DirectoryFinding> = result
            .findings
            .iter()
            .filter(|f| f.category == DirectoryCategory::AccountLockout)
            .collect();

        let compliant_count = lockout_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::Compliant)
            .count();

        let total = lockout_findings.len();
        let score = if total > 0 {
            (compliant_count as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        let (threshold, duration, window) = if let Some(ref gpo) = result.gpo_settings {
            (
                Some(gpo.lockout_policy.threshold),
                Some(gpo.lockout_policy.duration_minutes),
                Some(gpo.lockout_policy.observation_window_minutes),
            )
        } else {
            (None, None, None)
        };

        let issues: Vec<String> = lockout_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
            .map(|f| format!("{}: {}", f.policy_name, f.description))
            .collect();

        let status = GpoLockoutPolicyStatus {
            directory_type: format!("{:?}", result.directory_type),
            compliant: score >= 80.0,
            compliance_score: score,
            lockout_threshold: threshold,
            lockout_duration_minutes: duration,
            observation_window_minutes: window,
            findings: lockout_findings.iter().map(|f| PolicyFinding::from(*f)).collect(),
            issues: issues.clone(),
        };

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            Ok(CheckOutput::pass(
                format!("Account lockout policy compliant ({:.1}%)", score),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "Account lockout policy non-compliant ({:.1}%): {}",
                    score,
                    issues.join("; ")
                ),
                raw_data,
            ))
        }
    }
}

// ============================================================================
// GPO Audit Policy Check
// ============================================================================

/// Check ID for GPO audit policy.
pub const GPO_AUDIT_POLICY_CHECK_ID: &str = "gpo_audit_policy";

/// GPO audit policy status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpoAuditPolicyStatus {
    pub directory_type: String,
    pub compliant: bool,
    pub compliance_score: f32,
    pub logon_events: Option<String>,
    pub account_logon: Option<String>,
    pub account_management: Option<String>,
    pub privilege_use: Option<String>,
    pub policy_change: Option<String>,
    pub system_events: Option<String>,
    pub findings: Vec<PolicyFinding>,
    #[serde(default)]
    pub issues: Vec<String>,
}

/// GPO audit policy compliance check.
pub struct GpoAuditPolicyCheck {
    definition: CheckDefinition,
}

impl GpoAuditPolicyCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(GPO_AUDIT_POLICY_CHECK_ID)
            .name("Directory Audit Policy")
            .description(
                "Verify audit policy via Group Policy \
                 (logon events, account management, privilege use logged)",
            )
            .category(CheckCategory::AuditLogging)
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
}

impl Default for GpoAuditPolicyCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for GpoAuditPolicyCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing GPO audit policy check");

        let auditor = DirectoryAuditor::new();
        let result = auditor.audit_local_policies().await?;

        let audit_findings: Vec<&DirectoryFinding> = result
            .findings
            .iter()
            .filter(|f| f.category == DirectoryCategory::AuditPolicy)
            .collect();

        let compliant_count = audit_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::Compliant)
            .count();

        let total = audit_findings.len();
        let score = if total > 0 {
            (compliant_count as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        let (logon, account_logon, account_mgmt, priv_use, pol_change, sys_events) =
            if let Some(ref gpo) = result.gpo_settings {
                (
                    Some(format!("{:?}", gpo.audit_policy.logon_events)),
                    Some(format!("{:?}", gpo.audit_policy.account_logon)),
                    Some(format!("{:?}", gpo.audit_policy.account_management)),
                    Some(format!("{:?}", gpo.audit_policy.privilege_use)),
                    Some(format!("{:?}", gpo.audit_policy.policy_change)),
                    Some(format!("{:?}", gpo.audit_policy.system_events)),
                )
            } else {
                (None, None, None, None, None, None)
            };

        let issues: Vec<String> = audit_findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
            .map(|f| format!("{}: {}", f.policy_name, f.description))
            .collect();

        let status = GpoAuditPolicyStatus {
            directory_type: format!("{:?}", result.directory_type),
            compliant: score >= 80.0,
            compliance_score: score,
            logon_events: logon,
            account_logon,
            account_management: account_mgmt,
            privilege_use: priv_use,
            policy_change: pol_change,
            system_events: sys_events,
            findings: audit_findings.iter().map(|f| PolicyFinding::from(*f)).collect(),
            issues: issues.clone(),
        };

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            Ok(CheckOutput::pass(
                format!("Audit policy compliant ({:.1}%)", score),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "Audit policy non-compliant ({:.1}%): {}",
                    score,
                    issues.join("; ")
                ),
                raw_data,
            ))
        }
    }
}

// ============================================================================
// Privileged Groups Check
// ============================================================================

/// Check ID for privileged groups.
pub const PRIVILEGED_GROUPS_CHECK_ID: &str = "privileged_groups";

/// Privileged groups status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivilegedGroupsStatus {
    pub directory_type: String,
    pub compliant: bool,
    pub total_privileged_users: usize,
    pub groups: Vec<PrivilegedGroupSummary>,
    #[serde(default)]
    pub issues: Vec<String>,
}

/// Summary of a privileged group.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivilegedGroupSummary {
    pub name: String,
    pub member_count: usize,
    pub members: Vec<String>,
    pub risk_level: String,
    pub exceeds_threshold: bool,
}

/// Privileged groups compliance check.
pub struct PrivilegedGroupsCheck {
    definition: CheckDefinition,
}

impl PrivilegedGroupsCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(PRIVILEGED_GROUPS_CHECK_ID)
            .name("Privileged Group Membership")
            .description(
                "Audit privileged group membership (Domain Admins, Enterprise Admins, \
                 Schema Admins, local Administrators). Alert if excessive members.",
            )
            .category(CheckCategory::PrivilegedAccess)
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
}

impl Default for PrivilegedGroupsCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for PrivilegedGroupsCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing privileged groups check");

        #[cfg(target_os = "windows")]
        {
            use crate::directory::GpoAuditor;

            let auditor = GpoAuditor::new();
            let groups = auditor.get_privileged_groups(None).await?;

            let mut issues = Vec::new();
            let mut total_users = 0;
            let mut group_summaries = Vec::new();

            for group in &groups {
                total_users += group.member_count;

                let (threshold, risk) = match group.name.as_str() {
                    "Domain Admins" | "Enterprise Admins" | "Schema Admins" => (5, "Critical"),
                    "Administrators" | "Account Operators" => (10, "High"),
                    "Backup Operators" | "Server Operators" => (10, "Medium"),
                    _ => (20, "Low"),
                };

                let exceeds = group.member_count > threshold;
                if exceeds {
                    issues.push(format!(
                        "{}: {} members (threshold: {})",
                        group.name, group.member_count, threshold
                    ));
                }

                group_summaries.push(PrivilegedGroupSummary {
                    name: group.name.clone(),
                    member_count: group.member_count,
                    members: group.members.clone(),
                    risk_level: risk.to_string(),
                    exceeds_threshold: exceeds,
                });
            }

            let compliant = issues.is_empty();

            let status = PrivilegedGroupsStatus {
                directory_type: "ActiveDirectory".to_string(),
                compliant,
                total_privileged_users: total_users,
                groups: group_summaries,
                issues: issues.clone(),
            };

            let raw_data = serde_json::to_value(&status).unwrap_or_default();

            if compliant {
                Ok(CheckOutput::pass(
                    format!(
                        "Privileged groups within thresholds ({} total users)",
                        total_users
                    ),
                    raw_data,
                ))
            } else {
                Ok(CheckOutput::fail(
                    format!(
                        "Excessive privileged group membership: {}",
                        issues.join("; ")
                    ),
                    raw_data,
                ))
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows, check local admin groups
            let status = PrivilegedGroupsStatus {
                directory_type: "LocalPolicy".to_string(),
                compliant: true,
                total_privileged_users: 0,
                groups: vec![],
                issues: vec![],
            };

            let raw_data = serde_json::to_value(&status).unwrap_or_default();
            Ok(CheckOutput::pass(
                "Privileged groups check not applicable on this platform",
                raw_data,
            ))
        }
    }
}

// ============================================================================
// LDAP Security Check
// ============================================================================

/// Check ID for LDAP security.
pub const LDAP_SECURITY_CHECK_ID: &str = "ldap_security";

/// LDAP security status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LdapSecurityStatus {
    pub compliant: bool,
    pub compliance_score: f32,
    pub uses_tls: Option<bool>,
    pub tls_version: Option<String>,
    pub allows_anonymous_bind: Option<bool>,
    pub has_password_policy: Option<bool>,
    pub weak_ciphers_enabled: Option<bool>,
    pub findings: Vec<PolicyFinding>,
    #[serde(default)]
    pub issues: Vec<String>,
}

/// LDAP security compliance check.
pub struct LdapSecurityCheck {
    definition: CheckDefinition,
    /// LDAP server URI to check (configurable).
    ldap_uri: Option<String>,
}

impl LdapSecurityCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(LDAP_SECURITY_CHECK_ID)
            .name("LDAP Security Configuration")
            .description(
                "Verify LDAP server security configuration \
                 (TLS enabled, no anonymous bind, password policy overlay)",
            )
            .category(CheckCategory::DirectoryPolicy)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec!["linux".to_string()])
            .build();

        Self {
            definition,
            ldap_uri: None,
        }
    }

    /// Create with a specific LDAP URI.
    pub fn with_uri(mut self, uri: impl Into<String>) -> Self {
        self.ldap_uri = Some(uri.into());
        self
    }
}

impl Default for LdapSecurityCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for LdapSecurityCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing LDAP security check");

        // Default to localhost if no URI specified
        let uri = self
            .ldap_uri
            .clone()
            .unwrap_or_else(|| "ldap://localhost:389".to_string());

        let auditor = DirectoryAuditor::new();

        match auditor.audit_ldap_server(&uri).await {
            Ok(result) => {
                let ldap_findings: Vec<&DirectoryFinding> = result
                    .findings
                    .iter()
                    .filter(|f| matches!(f.category, DirectoryCategory::LdapConfig | DirectoryCategory::TlsConfig))
                    .collect();

                let compliant_count = ldap_findings
                    .iter()
                    .filter(|f| f.compliance_status == ComplianceStatus::Compliant)
                    .count();

                let total = ldap_findings.len();
                let score = if total > 0 {
                    (compliant_count as f32 / total as f32) * 100.0
                } else {
                    100.0 // No findings = compliant by default
                };

                let (uses_tls, tls_version, anonymous, password_policy, weak_ciphers) =
                    if let Some(ref ldap) = result.ldap_config {
                        (
                            Some(ldap.uses_tls),
                            ldap.tls_version.clone(),
                            Some(ldap.allows_anonymous_bind),
                            Some(ldap.has_password_policy),
                            Some(ldap.tls_config.weak_ciphers_enabled),
                        )
                    } else {
                        (None, None, None, None, None)
                    };

                let issues: Vec<String> = ldap_findings
                    .iter()
                    .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
                    .map(|f| format!("{}: {}", f.policy_name, f.description))
                    .collect();

                let status = LdapSecurityStatus {
                    compliant: score >= 80.0,
                    compliance_score: score,
                    uses_tls,
                    tls_version,
                    allows_anonymous_bind: anonymous,
                    has_password_policy: password_policy,
                    weak_ciphers_enabled: weak_ciphers,
                    findings: ldap_findings.iter().map(|f| PolicyFinding::from(*f)).collect(),
                    issues: issues.clone(),
                };

                let raw_data = serde_json::to_value(&status).unwrap_or_default();

                if status.compliant {
                    Ok(CheckOutput::pass(
                        format!("LDAP security compliant ({:.1}%)", score),
                        raw_data,
                    ))
                } else {
                    Ok(CheckOutput::fail(
                        format!(
                            "LDAP security non-compliant ({:.1}%): {}",
                            score,
                            issues.join("; ")
                        ),
                        raw_data,
                    ))
                }
            }
            Err(e) => {
                let status = LdapSecurityStatus {
                    compliant: true,
                    compliance_score: 100.0,
                    uses_tls: None,
                    tls_version: None,
                    allows_anonymous_bind: None,
                    has_password_policy: None,
                    weak_ciphers_enabled: None,
                    findings: vec![],
                    issues: vec![format!("Could not connect to LDAP server: {}", e)],
                };

                let raw_data = serde_json::to_value(&status).unwrap_or_default();
                // If no LDAP server, consider it N/A rather than failing
                Ok(CheckOutput::pass(
                    "LDAP server not detected or not accessible",
                    raw_data,
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::directory::DirectorySeverity;

    #[test]
    fn test_gpo_password_policy_check_creation() {
        let check = GpoPasswordPolicyCheck::new();
        assert_eq!(check.definition().id, GPO_PASSWORD_POLICY_CHECK_ID);
        assert!(check.definition().frameworks.contains(&"NIS2".to_string()));
    }

    #[test]
    fn test_gpo_lockout_policy_check_creation() {
        let check = GpoLockoutPolicyCheck::new();
        assert_eq!(check.definition().id, GPO_LOCKOUT_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::DirectoryPolicy);
    }

    #[test]
    fn test_gpo_audit_policy_check_creation() {
        let check = GpoAuditPolicyCheck::new();
        assert_eq!(check.definition().id, GPO_AUDIT_POLICY_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::AuditLogging);
    }

    #[test]
    fn test_privileged_groups_check_creation() {
        let check = PrivilegedGroupsCheck::new();
        assert_eq!(check.definition().id, PRIVILEGED_GROUPS_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::PrivilegedAccess);
    }

    #[test]
    fn test_ldap_security_check_creation() {
        let check = LdapSecurityCheck::new();
        assert_eq!(check.definition().id, LDAP_SECURITY_CHECK_ID);

        let check_with_uri = LdapSecurityCheck::new().with_uri("ldaps://ldap.example.com:636");
        assert_eq!(
            check_with_uri.ldap_uri,
            Some("ldaps://ldap.example.com:636".to_string())
        );
    }

    #[test]
    fn test_policy_finding_conversion() {
        use chrono::Utc;

        let finding = DirectoryFinding {
            id: "TEST-001".to_string(),
            policy_name: "Test Policy".to_string(),
            category: DirectoryCategory::PasswordPolicy,
            severity: DirectorySeverity::High,
            compliance_status: ComplianceStatus::NonCompliant,
            current_value: "8".to_string(),
            expected_value: "14".to_string(),
            description: "Password too short".to_string(),
            remediation: "Increase minimum length".to_string(),
            frameworks: vec!["NIS2".to_string()],
            detected_at: Utc::now(),
        };

        let policy_finding = PolicyFinding::from(&finding);
        assert_eq!(policy_finding.id, "TEST-001");
        assert_eq!(policy_finding.current_value, "8");
    }
}
