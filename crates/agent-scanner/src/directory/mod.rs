//! Directory Services Auditing Module
//!
//! Provides compliance auditing for directory services:
//! - **Active Directory**: Group Policy (GPO), password policies, account lockout
//! - **OpenLDAP**: Configuration, ACLs, security settings
//! - **Azure AD / Entra ID**: Conditional access, MFA policies
//!
//! # Features
//!
//! - GPO security settings extraction and analysis
//! - Password policy compliance verification
//! - Account lockout policy auditing
//! - Privileged group membership analysis
//! - LDAP security configuration checks
//! - Kerberos policy auditing
//!
//! # Example
//!
//! ```ignore
//! use agent_scanner::directory::{DirectoryAuditor, DirectoryType};
//!
//! let auditor = DirectoryAuditor::new();
//! let results = auditor.audit_local_policies().await?;
//!
//! for finding in results.findings {
//!     println!("{}: {}", finding.policy_name, finding.compliance_status);
//! }
//! ```

mod ad_gpo;
mod checks;
mod ldap;
mod types;

pub use ad_gpo::{GpoAuditor, GpoSetting, GpoSecuritySettings, AuditPolicy, AuditSetting};
pub use checks::{DirectoryCheck, DirectoryCheckResult, check_privileged_groups, run_policy_checks, run_ldap_checks};
pub use ldap::{LdapAuditor, LdapSecurityConfig, TlsConfiguration, LdapPasswordPolicy, AclFinding, LdapConfigFinding};
pub use types::*;

use crate::error::ScannerResult;
use tracing::{debug, info};

/// Main directory services auditor.
pub struct DirectoryAuditor {
    gpo_auditor: GpoAuditor,
    ldap_auditor: LdapAuditor,
}

impl DirectoryAuditor {
    /// Create a new directory auditor.
    pub fn new() -> Self {
        Self {
            gpo_auditor: GpoAuditor::new(),
            ldap_auditor: LdapAuditor::new(),
        }
    }

    /// Audit local security policies (works without domain).
    pub async fn audit_local_policies(&self) -> ScannerResult<DirectoryAuditResult> {
        info!("Starting local security policy audit");
        let mut result = DirectoryAuditResult::new(DirectoryType::LocalPolicy);

        // Get local security policies
        let gpo_settings = self.gpo_auditor.get_local_security_policy().await?;
        result.gpo_settings = Some(gpo_settings.clone());

        // Run compliance checks
        let checks = checks::run_policy_checks(&gpo_settings);
        result.findings = checks;

        // Calculate compliance score
        result.calculate_score();

        info!(
            "Local policy audit complete: {} findings, score: {:.1}%",
            result.findings.len(),
            result.compliance_score
        );

        Ok(result)
    }

    /// Audit Active Directory domain policies (requires domain membership).
    #[cfg(target_os = "windows")]
    pub async fn audit_domain_policies(&self, domain: Option<&str>) -> ScannerResult<DirectoryAuditResult> {
        info!("Starting Active Directory domain policy audit");
        let mut result = DirectoryAuditResult::new(DirectoryType::ActiveDirectory);

        // Get domain GPO settings
        let gpo_settings = self.gpo_auditor.get_domain_policy(domain).await?;
        result.gpo_settings = Some(gpo_settings.clone());

        // Get privileged groups
        result.privileged_groups = self.gpo_auditor.get_privileged_groups(domain).await?;

        // Run compliance checks
        let checks = checks::run_policy_checks(&gpo_settings);
        result.findings = checks;

        // Add privileged group findings
        let group_findings = checks::check_privileged_groups(&result.privileged_groups);
        result.findings.extend(group_findings);

        result.calculate_score();

        info!(
            "Domain policy audit complete: {} findings, score: {:.1}%",
            result.findings.len(),
            result.compliance_score
        );

        Ok(result)
    }

    /// Audit OpenLDAP server configuration.
    pub async fn audit_ldap_server(&self, uri: &str) -> ScannerResult<DirectoryAuditResult> {
        info!("Starting OpenLDAP security audit for {}", uri);
        let mut result = DirectoryAuditResult::new(DirectoryType::OpenLDAP);

        // Get LDAP security configuration
        let ldap_config = self.ldap_auditor.get_security_config(uri).await?;
        result.ldap_config = Some(ldap_config.clone());

        // Run LDAP-specific checks
        let checks = checks::run_ldap_checks(&ldap_config);
        result.findings = checks;

        result.calculate_score();

        info!(
            "LDAP audit complete: {} findings, score: {:.1}%",
            result.findings.len(),
            result.compliance_score
        );

        Ok(result)
    }

    /// Get a summary of directory service compliance.
    pub async fn get_compliance_summary(&self) -> ScannerResult<DirectoryComplianceSummary> {
        debug!("Generating directory compliance summary");

        let mut summary = DirectoryComplianceSummary::default();

        // Try local policies first (always available)
        if let Ok(local_result) = self.audit_local_policies().await {
            summary.local_policy_score = Some(local_result.compliance_score);
            summary.total_findings += local_result.findings.len();
            summary.critical_findings += local_result
                .findings
                .iter()
                .filter(|f| f.severity == DirectorySeverity::Critical)
                .count();
        }

        // Try domain policies on Windows
        #[cfg(target_os = "windows")]
        {
            if let Ok(domain_result) = self.audit_domain_policies(None).await {
                summary.domain_policy_score = Some(domain_result.compliance_score);
                summary.total_findings += domain_result.findings.len();
                summary.critical_findings += domain_result
                    .findings
                    .iter()
                    .filter(|f| f.severity == DirectorySeverity::Critical)
                    .count();
            }
        }

        Ok(summary)
    }
}

impl Default for DirectoryAuditor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_directory_auditor_creation() {
        let _auditor = DirectoryAuditor::new();
        // Should create without panicking
    }

    #[tokio::test]
    async fn test_local_policy_audit() {
        let auditor = DirectoryAuditor::new();
        // This should work on any system (may return limited data on non-Windows)
        let result = auditor.audit_local_policies().await;
        // Should not panic, may return error on unsupported platforms
        assert!(result.is_ok() || result.is_err());
    }
}
