//! Directory auditing types.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Type of directory service being audited.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirectoryType {
    /// Local security policy (no domain).
    LocalPolicy,
    /// Microsoft Active Directory.
    ActiveDirectory,
    /// OpenLDAP server.
    OpenLDAP,
    /// Azure Active Directory / Entra ID.
    AzureAD,
    /// FreeIPA.
    FreeIPA,
}

/// Severity of a directory finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirectorySeverity {
    /// Informational finding.
    Info,
    /// Low severity.
    Low,
    /// Medium severity.
    Medium,
    /// High severity.
    High,
    /// Critical severity.
    Critical,
}

/// Compliance status of a policy setting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComplianceStatus {
    /// Setting is compliant.
    Compliant,
    /// Setting is non-compliant.
    NonCompliant,
    /// Setting not configured (using default).
    NotConfigured,
    /// Unable to determine compliance.
    Unknown,
}

/// A directory audit finding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryFinding {
    /// Finding identifier.
    pub id: String,
    /// Policy or setting name.
    pub policy_name: String,
    /// Category of the finding.
    pub category: DirectoryCategory,
    /// Severity level.
    pub severity: DirectorySeverity,
    /// Compliance status.
    pub compliance_status: ComplianceStatus,
    /// Current value.
    pub current_value: String,
    /// Expected/recommended value.
    pub expected_value: String,
    /// Description of the finding.
    pub description: String,
    /// Remediation guidance.
    pub remediation: String,
    /// Applicable frameworks.
    pub frameworks: Vec<String>,
    /// Detection timestamp.
    pub detected_at: DateTime<Utc>,
}

/// Category of directory finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirectoryCategory {
    /// Password policy.
    PasswordPolicy,
    /// Account lockout policy.
    AccountLockout,
    /// Kerberos policy.
    KerberosPolicy,
    /// Audit policy.
    AuditPolicy,
    /// User rights assignment.
    UserRights,
    /// Security options.
    SecurityOptions,
    /// Privileged access.
    PrivilegedAccess,
    /// LDAP configuration.
    LdapConfig,
    /// TLS/SSL configuration.
    TlsConfig,
    /// Access control.
    AccessControl,
}

/// Result of a directory audit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryAuditResult {
    /// Type of directory audited.
    pub directory_type: DirectoryType,
    /// Audit timestamp.
    pub audited_at: DateTime<Utc>,
    /// Overall compliance score (0-100).
    pub compliance_score: f32,
    /// Individual findings.
    pub findings: Vec<DirectoryFinding>,
    /// GPO security settings (if applicable).
    pub gpo_settings: Option<super::GpoSecuritySettings>,
    /// LDAP security config (if applicable).
    pub ldap_config: Option<super::LdapSecurityConfig>,
    /// Privileged group memberships.
    pub privileged_groups: Vec<PrivilegedGroupInfo>,
}

impl DirectoryAuditResult {
    /// Create a new audit result.
    pub fn new(directory_type: DirectoryType) -> Self {
        Self {
            directory_type,
            audited_at: Utc::now(),
            compliance_score: 0.0,
            findings: Vec::new(),
            gpo_settings: None,
            ldap_config: None,
            privileged_groups: Vec::new(),
        }
    }

    /// Calculate compliance score based on findings.
    pub fn calculate_score(&mut self) {
        if self.findings.is_empty() {
            self.compliance_score = 100.0;
            return;
        }

        let total_weight: f32 = self
            .findings
            .iter()
            .map(|f| severity_weight(f.severity))
            .sum();
        let compliant_weight: f32 = self
            .findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::Compliant)
            .map(|f| severity_weight(f.severity))
            .sum();

        self.compliance_score = if total_weight > 0.0 {
            (compliant_weight / total_weight) * 100.0
        } else {
            100.0
        };
    }

    /// Get findings by severity.
    pub fn findings_by_severity(&self, severity: DirectorySeverity) -> Vec<&DirectoryFinding> {
        self.findings
            .iter()
            .filter(|f| f.severity == severity)
            .collect()
    }

    /// Get non-compliant findings.
    pub fn non_compliant_findings(&self) -> Vec<&DirectoryFinding> {
        self.findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
            .collect()
    }
}

fn severity_weight(severity: DirectorySeverity) -> f32 {
    match severity {
        DirectorySeverity::Critical => 4.0,
        DirectorySeverity::High => 3.0,
        DirectorySeverity::Medium => 2.0,
        DirectorySeverity::Low => 1.0,
        DirectorySeverity::Info => 0.5,
    }
}

/// Information about a privileged group.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivilegedGroupInfo {
    /// Group name.
    pub name: String,
    /// Group SID (for AD).
    pub sid: Option<String>,
    /// Distinguished name (for LDAP).
    pub dn: Option<String>,
    /// Number of members.
    pub member_count: usize,
    /// List of member names.
    pub members: Vec<String>,
    /// Risk level of this group.
    pub risk_level: DirectorySeverity,
    /// Description.
    pub description: String,
}

/// Summary of directory compliance.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DirectoryComplianceSummary {
    /// Local policy compliance score.
    pub local_policy_score: Option<f32>,
    /// Domain policy compliance score.
    pub domain_policy_score: Option<f32>,
    /// LDAP compliance score.
    pub ldap_score: Option<f32>,
    /// Total number of findings.
    pub total_findings: usize,
    /// Number of critical findings.
    pub critical_findings: usize,
    /// Summary timestamp.
    pub generated_at: DateTime<Utc>,
}

impl DirectoryComplianceSummary {
    /// Get overall compliance score.
    pub fn overall_score(&self) -> f32 {
        let mut scores = Vec::new();

        if let Some(s) = self.local_policy_score {
            scores.push(s);
        }
        if let Some(s) = self.domain_policy_score {
            scores.push(s);
        }
        if let Some(s) = self.ldap_score {
            scores.push(s);
        }

        if scores.is_empty() {
            return 0.0;
        }

        scores.iter().sum::<f32>() / scores.len() as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_ordering() {
        assert!(DirectorySeverity::Critical > DirectorySeverity::High);
        assert!(DirectorySeverity::High > DirectorySeverity::Medium);
        assert!(DirectorySeverity::Medium > DirectorySeverity::Low);
        assert!(DirectorySeverity::Low > DirectorySeverity::Info);
    }

    #[test]
    fn test_audit_result_score_calculation() {
        let mut result = DirectoryAuditResult::new(DirectoryType::LocalPolicy);

        // Add some findings
        result.findings.push(DirectoryFinding {
            id: "1".to_string(),
            policy_name: "Test Policy".to_string(),
            category: DirectoryCategory::PasswordPolicy,
            severity: DirectorySeverity::High,
            compliance_status: ComplianceStatus::Compliant,
            current_value: "14".to_string(),
            expected_value: ">=14".to_string(),
            description: "Test".to_string(),
            remediation: "None needed".to_string(),
            frameworks: vec!["NIS2".to_string()],
            detected_at: Utc::now(),
        });

        result.findings.push(DirectoryFinding {
            id: "2".to_string(),
            policy_name: "Test Policy 2".to_string(),
            category: DirectoryCategory::PasswordPolicy,
            severity: DirectorySeverity::High,
            compliance_status: ComplianceStatus::NonCompliant,
            current_value: "7".to_string(),
            expected_value: ">=14".to_string(),
            description: "Test".to_string(),
            remediation: "Increase value".to_string(),
            frameworks: vec!["NIS2".to_string()],
            detected_at: Utc::now(),
        });

        result.calculate_score();

        // 1 compliant (weight 3) + 1 non-compliant (weight 3) = 50%
        assert!((result.compliance_score - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_compliance_summary() {
        let summary = DirectoryComplianceSummary {
            local_policy_score: Some(80.0),
            domain_policy_score: Some(90.0),
            ..Default::default()
        };

        assert!((summary.overall_score() - 85.0).abs() < 0.1);
    }
}
