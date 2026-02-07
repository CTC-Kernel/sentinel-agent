//! Directory compliance checks.
//!
//! Implements security checks for:
//! - Password policy compliance (NIS2, DORA, CIS, NIST)
//! - Account lockout policy
//! - Audit policy
//! - Privileged group membership
//! - LDAP security configuration

use super::ad_gpo::*;
use super::ldap::*;
use super::types::*;
use chrono::Utc;

/// A directory compliance check.
pub struct DirectoryCheck {
    /// Check identifier.
    pub id: String,
    /// Check name.
    pub name: String,
    /// Check description.
    pub description: String,
    /// Applicable frameworks.
    pub frameworks: Vec<String>,
}

/// Result of a directory check.
pub struct DirectoryCheckResult {
    /// The check that was run.
    pub check: DirectoryCheck,
    /// Finding from the check.
    pub finding: DirectoryFinding,
}

/// Run all policy checks against GPO settings.
pub fn run_policy_checks(settings: &GpoSecuritySettings) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    // Password Policy Checks
    findings.extend(check_password_policy(&settings.password_policy));

    // Account Lockout Checks
    findings.extend(check_lockout_policy(&settings.lockout_policy));

    // Audit Policy Checks
    findings.extend(check_audit_policy(&settings.audit_policy));

    findings
}

/// Check password policy compliance.
pub fn check_password_policy(policy: &PasswordPolicy) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    // Minimum Password Length (CIS: 14+, NIST: 8+)
    findings.push(DirectoryFinding {
        id: "DIR-PWD-001".to_string(),
        policy_name: "Minimum Password Length".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if policy.min_length < 8 {
            DirectorySeverity::Critical
        } else if policy.min_length < 14 {
            DirectorySeverity::Medium
        } else {
            DirectorySeverity::Info
        },
        compliance_status: if policy.min_length >= 14 {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant // <8 or 8-13: Meets NIST but not CIS
        },
        current_value: policy.min_length.to_string(),
        expected_value: ">=14 characters (CIS), >=8 (NIST)".to_string(),
        description: "Minimum password length controls the shortest password users can create."
            .to_string(),
        remediation:
            "Set 'Minimum password length' to 14 or more characters via GPO or local policy."
                .to_string(),
        frameworks: vec![
            "NIS2".to_string(),
            "DORA".to_string(),
            "CIS".to_string(),
            "NIST".to_string(),
        ],
        detected_at: Utc::now(),
    });

    // Password Complexity
    findings.push(DirectoryFinding {
        id: "DIR-PWD-002".to_string(),
        policy_name: "Password Complexity".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if policy.complexity_enabled {
            DirectorySeverity::Info
        } else {
            DirectorySeverity::High
        },
        compliance_status: if policy.complexity_enabled {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: if policy.complexity_enabled {
            "Enabled"
        } else {
            "Disabled"
        }
        .to_string(),
        expected_value: "Enabled".to_string(),
        description:
            "Password complexity requires passwords to contain characters from multiple categories."
                .to_string(),
        remediation: "Enable 'Password must meet complexity requirements' in GPO.".to_string(),
        frameworks: vec!["NIS2".to_string(), "DORA".to_string(), "CIS".to_string()],
        detected_at: Utc::now(),
    });

    // Password History
    findings.push(DirectoryFinding {
        id: "DIR-PWD-003".to_string(),
        policy_name: "Password History".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if policy.history_count >= 24 {
            DirectorySeverity::Info
        } else if policy.history_count >= 12 {
            DirectorySeverity::Low
        } else {
            DirectorySeverity::Medium
        },
        compliance_status: if policy.history_count >= 24 {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: policy.history_count.to_string(),
        expected_value: ">=24 passwords remembered".to_string(),
        description: "Password history prevents users from reusing recent passwords.".to_string(),
        remediation: "Set 'Enforce password history' to 24 or more passwords.".to_string(),
        frameworks: vec!["CIS".to_string(), "NIST".to_string()],
        detected_at: Utc::now(),
    });

    // Maximum Password Age
    findings.push(DirectoryFinding {
        id: "DIR-PWD-004".to_string(),
        policy_name: "Maximum Password Age".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if policy.max_age_days == 0 {
            DirectorySeverity::Medium // Never expires - NIST actually recommends this
        } else if policy.max_age_days <= 365 {
            DirectorySeverity::Info
        } else {
            DirectorySeverity::Low
        },
        compliance_status: if policy.max_age_days <= 365 {
            ComplianceStatus::Compliant // NIST SP 800-63B recommends no expiration (0) or <=365
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: if policy.max_age_days == 0 {
            "Never expires".to_string()
        } else {
            format!("{} days", policy.max_age_days)
        },
        expected_value: "<=365 days or never (NIST SP 800-63B)".to_string(),
        description: "Maximum password age determines when passwords must be changed.".to_string(),
        remediation: "Set maximum password age per organizational policy. Note: NIST now recommends against forced periodic changes.".to_string(),
        frameworks: vec!["CIS".to_string()],
        detected_at: Utc::now(),
    });

    // Reversible Encryption (CRITICAL - should never be enabled)
    findings.push(DirectoryFinding {
        id: "DIR-PWD-005".to_string(),
        policy_name: "Reversible Encryption".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if policy.reversible_encryption {
            DirectorySeverity::Critical
        } else {
            DirectorySeverity::Info
        },
        compliance_status: if policy.reversible_encryption {
            ComplianceStatus::NonCompliant
        } else {
            ComplianceStatus::Compliant
        },
        current_value: if policy.reversible_encryption {
            "Enabled"
        } else {
            "Disabled"
        }
        .to_string(),
        expected_value: "Disabled".to_string(),
        description:
            "Storing passwords with reversible encryption is equivalent to storing plaintext."
                .to_string(),
        remediation: "Disable 'Store passwords using reversible encryption' immediately."
            .to_string(),
        frameworks: vec![
            "NIS2".to_string(),
            "DORA".to_string(),
            "CIS".to_string(),
            "PCI-DSS".to_string(),
        ],
        detected_at: Utc::now(),
    });

    findings
}

/// Check account lockout policy compliance.
pub fn check_lockout_policy(policy: &AccountLockoutPolicy) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    // Lockout Threshold
    findings.push(DirectoryFinding {
        id: "DIR-LOCK-001".to_string(),
        policy_name: "Account Lockout Threshold".to_string(),
        category: DirectoryCategory::AccountLockout,
        severity: if policy.threshold == 0 {
            DirectorySeverity::High // No lockout at all
        } else if policy.threshold > 10 {
            DirectorySeverity::Medium
        } else if policy.threshold >= 3 && policy.threshold <= 5 {
            DirectorySeverity::Info
        } else {
            DirectorySeverity::Low
        },
        compliance_status: if (3..=10).contains(&policy.threshold) {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: if policy.threshold == 0 {
            "Disabled (no lockout)".to_string()
        } else {
            format!("{} attempts", policy.threshold)
        },
        expected_value: "3-10 invalid attempts".to_string(),
        description: "Account lockout threshold prevents brute force attacks.".to_string(),
        remediation: "Set 'Account lockout threshold' to 5 invalid logon attempts.".to_string(),
        frameworks: vec![
            "NIS2".to_string(),
            "DORA".to_string(),
            "CIS".to_string(),
            "PCI-DSS".to_string(),
        ],
        detected_at: Utc::now(),
    });

    // Lockout Duration
    if policy.threshold > 0 {
        findings.push(DirectoryFinding {
            id: "DIR-LOCK-002".to_string(),
            policy_name: "Account Lockout Duration".to_string(),
            category: DirectoryCategory::AccountLockout,
            severity: if policy.duration_minutes == 0 || policy.duration_minutes >= 15 {
                DirectorySeverity::Info // 0 = requires admin unlock (most secure), >=15 = acceptable
            } else {
                DirectorySeverity::Medium
            },
            compliance_status: if policy.duration_minutes >= 15 || policy.duration_minutes == 0 {
                ComplianceStatus::Compliant
            } else {
                ComplianceStatus::NonCompliant
            },
            current_value: if policy.duration_minutes == 0 {
                "Until admin unlock".to_string()
            } else {
                format!("{} minutes", policy.duration_minutes)
            },
            expected_value: ">=15 minutes or until admin unlock".to_string(),
            description: "Lockout duration determines how long an account remains locked."
                .to_string(),
            remediation:
                "Set 'Account lockout duration' to 15 minutes or more, or 0 for manual unlock."
                    .to_string(),
            frameworks: vec!["CIS".to_string(), "PCI-DSS".to_string()],
            detected_at: Utc::now(),
        });

        // Reset Counter
        findings.push(DirectoryFinding {
            id: "DIR-LOCK-003".to_string(),
            policy_name: "Reset Lockout Counter".to_string(),
            category: DirectoryCategory::AccountLockout,
            severity: if policy.observation_window_minutes >= 15 {
                DirectorySeverity::Info
            } else {
                DirectorySeverity::Low
            },
            compliance_status: if policy.observation_window_minutes >= 15 {
                ComplianceStatus::Compliant
            } else {
                ComplianceStatus::NonCompliant
            },
            current_value: format!("{} minutes", policy.observation_window_minutes),
            expected_value: ">=15 minutes".to_string(),
            description: "Time after which the bad password count resets.".to_string(),
            remediation: "Set 'Reset account lockout counter after' to 15 minutes or more."
                .to_string(),
            frameworks: vec!["CIS".to_string()],
            detected_at: Utc::now(),
        });
    }

    findings
}

/// Check audit policy compliance.
pub fn check_audit_policy(policy: &AuditPolicy) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    let audit_checks = [
        (
            "DIR-AUDIT-001",
            "Logon Events",
            &policy.logon_events,
            AuditSetting::SuccessAndFailure,
        ),
        (
            "DIR-AUDIT-002",
            "Account Logon",
            &policy.account_logon,
            AuditSetting::SuccessAndFailure,
        ),
        (
            "DIR-AUDIT-003",
            "Account Management",
            &policy.account_management,
            AuditSetting::SuccessAndFailure,
        ),
        (
            "DIR-AUDIT-004",
            "Privilege Use",
            &policy.privilege_use,
            AuditSetting::SuccessAndFailure,
        ),
        (
            "DIR-AUDIT-005",
            "Policy Change",
            &policy.policy_change,
            AuditSetting::SuccessAndFailure,
        ),
        (
            "DIR-AUDIT-006",
            "System Events",
            &policy.system_events,
            AuditSetting::Success,
        ),
    ];

    for (id, name, current, expected) in audit_checks {
        let is_compliant = *current == expected || (*current == AuditSetting::SuccessAndFailure);

        findings.push(DirectoryFinding {
            id: id.to_string(),
            policy_name: format!("Audit {}", name),
            category: DirectoryCategory::AuditPolicy,
            severity: if *current == AuditSetting::NoAuditing {
                DirectorySeverity::High
            } else if !is_compliant {
                DirectorySeverity::Medium
            } else {
                DirectorySeverity::Info
            },
            compliance_status: if is_compliant {
                ComplianceStatus::Compliant
            } else {
                ComplianceStatus::NonCompliant
            },
            current_value: format!("{:?}", current),
            expected_value: format!("{:?}", expected),
            description: format!("Audit policy for {} events.", name.to_lowercase()),
            remediation: format!(
                "Configure 'Audit {}' to log {} events.",
                name,
                if expected == AuditSetting::SuccessAndFailure {
                    "success and failure"
                } else {
                    "success"
                }
            ),
            frameworks: vec![
                "NIS2".to_string(),
                "DORA".to_string(),
                "CIS".to_string(),
                "ISO27001".to_string(),
            ],
            detected_at: Utc::now(),
        });
    }

    findings
}

/// Check privileged group membership.
pub fn check_privileged_groups(groups: &[PrivilegedGroupInfo]) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    for group in groups {
        // Check for excessive membership in critical groups
        let (threshold, severity) = match group.name.as_str() {
            "Domain Admins" | "Enterprise Admins" | "Schema Admins" => {
                (5, DirectorySeverity::Critical)
            }
            "Administrators" => (10, DirectorySeverity::High),
            _ => (20, DirectorySeverity::Medium),
        };

        if group.member_count > threshold {
            findings.push(DirectoryFinding {
                id: format!("DIR-PRIV-{}", group.name.replace(' ', "_").to_uppercase()),
                policy_name: format!("{} Group Membership", group.name),
                category: DirectoryCategory::PrivilegedAccess,
                severity,
                compliance_status: ComplianceStatus::NonCompliant,
                current_value: format!("{} members", group.member_count),
                expected_value: format!("<={} members", threshold),
                description: format!(
                    "The {} group has {} members. Large privileged groups increase attack surface.",
                    group.name, group.member_count
                ),
                remediation: format!(
                    "Review membership of {} and remove unnecessary accounts. Implement least privilege.",
                    group.name
                ),
                frameworks: vec!["NIS2".to_string(), "DORA".to_string(), "CIS".to_string(), "ISO27001".to_string()],
                detected_at: Utc::now(),
            });
        }
    }

    findings
}

/// Run LDAP-specific compliance checks.
pub fn run_ldap_checks(config: &LdapSecurityConfig) -> Vec<DirectoryFinding> {
    let mut findings = Vec::new();

    // TLS/SSL Check
    findings.push(DirectoryFinding {
        id: "DIR-LDAP-001".to_string(),
        policy_name: "LDAP TLS Encryption".to_string(),
        category: DirectoryCategory::TlsConfig,
        severity: if config.uses_tls || config.uses_starttls {
            DirectorySeverity::Info
        } else {
            DirectorySeverity::Critical
        },
        compliance_status: if config.uses_tls || config.uses_starttls {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: if config.uses_tls {
            "LDAPS enabled".to_string()
        } else if config.uses_starttls {
            "STARTTLS enabled".to_string()
        } else {
            "Unencrypted".to_string()
        },
        expected_value: "LDAPS or STARTTLS".to_string(),
        description: "LDAP traffic should be encrypted to protect credentials and directory data."
            .to_string(),
        remediation: "Configure LDAP server for LDAPS (port 636) or enable STARTTLS.".to_string(),
        frameworks: vec![
            "NIS2".to_string(),
            "DORA".to_string(),
            "CIS".to_string(),
            "PCI-DSS".to_string(),
        ],
        detected_at: Utc::now(),
    });

    // TLS Version Check
    if config.uses_tls {
        findings.push(DirectoryFinding {
            id: "DIR-LDAP-002".to_string(),
            policy_name: "LDAP TLS Version".to_string(),
            category: DirectoryCategory::TlsConfig,
            severity: if config.tls_config.supports_tls_1_3 {
                DirectorySeverity::Info
            } else if config.tls_config.supports_tls_1_2 {
                DirectorySeverity::Low
            } else {
                DirectorySeverity::High
            },
            compliance_status: if config.tls_config.supports_tls_1_2 {
                ComplianceStatus::Compliant
            } else {
                ComplianceStatus::NonCompliant
            },
            current_value: config
                .tls_version
                .clone()
                .unwrap_or_else(|| "Unknown".to_string()),
            expected_value: "TLSv1.2 or TLSv1.3".to_string(),
            description: "LDAP should use modern TLS versions.".to_string(),
            remediation: "Configure LDAP server to require TLS 1.2 or higher.".to_string(),
            frameworks: vec!["NIS2".to_string(), "PCI-DSS".to_string()],
            detected_at: Utc::now(),
        });

        // Weak Ciphers Check
        if config.tls_config.weak_ciphers_enabled {
            findings.push(DirectoryFinding {
                id: "DIR-LDAP-003".to_string(),
                policy_name: "LDAP Weak Ciphers".to_string(),
                category: DirectoryCategory::TlsConfig,
                severity: DirectorySeverity::High,
                compliance_status: ComplianceStatus::NonCompliant,
                current_value: "Weak ciphers enabled".to_string(),
                expected_value: "No weak ciphers (RC4, DES, NULL, MD5)".to_string(),
                description: "LDAP server accepts weak cipher suites.".to_string(),
                remediation: "Disable RC4, DES, NULL, and MD5-based cipher suites.".to_string(),
                frameworks: vec!["NIS2".to_string(), "PCI-DSS".to_string(), "CIS".to_string()],
                detected_at: Utc::now(),
            });
        }
    }

    // Anonymous Bind Check
    findings.push(DirectoryFinding {
        id: "DIR-LDAP-004".to_string(),
        policy_name: "LDAP Anonymous Bind".to_string(),
        category: DirectoryCategory::AccessControl,
        severity: if config.allows_anonymous_bind {
            DirectorySeverity::Medium
        } else {
            DirectorySeverity::Info
        },
        compliance_status: if config.allows_anonymous_bind {
            ComplianceStatus::NonCompliant
        } else {
            ComplianceStatus::Compliant
        },
        current_value: if config.allows_anonymous_bind {
            "Allowed"
        } else {
            "Denied"
        }
        .to_string(),
        expected_value: "Denied".to_string(),
        description: "Anonymous LDAP binds can expose directory information.".to_string(),
        remediation: "Disable anonymous binds in LDAP server configuration.".to_string(),
        frameworks: vec!["CIS".to_string(), "ISO27001".to_string()],
        detected_at: Utc::now(),
    });

    // Password Policy Check
    findings.push(DirectoryFinding {
        id: "DIR-LDAP-005".to_string(),
        policy_name: "LDAP Password Policy".to_string(),
        category: DirectoryCategory::PasswordPolicy,
        severity: if config.has_password_policy {
            DirectorySeverity::Info
        } else {
            DirectorySeverity::High
        },
        compliance_status: if config.has_password_policy {
            ComplianceStatus::Compliant
        } else {
            ComplianceStatus::NonCompliant
        },
        current_value: if config.has_password_policy {
            "Configured"
        } else {
            "Not configured"
        }
        .to_string(),
        expected_value: "Password policy overlay configured".to_string(),
        description: "LDAP server should enforce password policies.".to_string(),
        remediation: "Enable and configure ppolicy overlay in OpenLDAP.".to_string(),
        frameworks: vec!["NIS2".to_string(), "CIS".to_string()],
        detected_at: Utc::now(),
    });

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_policy_checks() {
        let policy = PasswordPolicy {
            min_length: 14,
            max_age_days: 90,
            min_age_days: 1,
            history_count: 24,
            complexity_enabled: true,
            reversible_encryption: false,
        };

        let findings = check_password_policy(&policy);
        assert!(!findings.is_empty());

        // All should be compliant with these settings
        let non_compliant: Vec<_> = findings
            .iter()
            .filter(|f| f.compliance_status == ComplianceStatus::NonCompliant)
            .collect();

        assert!(
            non_compliant.is_empty(),
            "Expected all compliant, found: {:?}",
            non_compliant
        );
    }

    #[test]
    fn test_weak_password_policy() {
        let policy = PasswordPolicy {
            min_length: 4,
            max_age_days: 0,
            min_age_days: 0,
            history_count: 0,
            complexity_enabled: false,
            reversible_encryption: true,
        };

        let findings = check_password_policy(&policy);

        let critical: Vec<_> = findings
            .iter()
            .filter(|f| f.severity == DirectorySeverity::Critical)
            .collect();

        // Should have critical findings for min length and reversible encryption
        assert!(!critical.is_empty());
    }

    #[test]
    fn test_lockout_policy_checks() {
        let policy = AccountLockoutPolicy {
            threshold: 5,
            duration_minutes: 30,
            observation_window_minutes: 30,
        };

        let findings = check_lockout_policy(&policy);
        assert!(!findings.is_empty());

        // All should be compliant
        for finding in &findings {
            assert_eq!(finding.compliance_status, ComplianceStatus::Compliant);
        }
    }

    #[test]
    fn test_ldap_checks_no_tls() {
        let config = LdapSecurityConfig {
            server_uri: "ldap://server:389".to_string(),
            uses_tls: false,
            uses_starttls: false,
            allows_anonymous_bind: true,
            has_password_policy: false,
            ..Default::default()
        };

        let findings = run_ldap_checks(&config);

        let critical: Vec<_> = findings
            .iter()
            .filter(|f| f.severity == DirectorySeverity::Critical)
            .collect();

        // Should have critical finding for no TLS
        assert!(!critical.is_empty());
    }
}
