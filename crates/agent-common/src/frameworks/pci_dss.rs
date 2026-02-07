//! PCI DSS v4.0 mappings.
//!
//! Maps agent checks to PCI DSS requirements for
//! payment card industry data security.

use super::{ControlMapping, FrameworkInfo};
use std::collections::HashMap;

/// PCI DSS v4.0 framework mapping.
pub struct PciDssMapping;

impl PciDssMapping {
    /// Get framework metadata.
    pub fn framework_info() -> FrameworkInfo {
        FrameworkInfo {
            id: "PCI_DSS".to_string(),
            name: "PCI DSS".to_string(),
            version: "4.0".to_string(),
            description: "Payment Card Industry Data Security Standard".to_string(),
            applicability: vec![
                "Payment Processing".to_string(),
                "Financial Services".to_string(),
                "Retail".to_string(),
                "E-commerce".to_string(),
            ],
            reference_url: "https://www.pcisecuritystandards.org/".to_string(),
        }
    }

    /// Get all check-to-control mappings.
    pub fn mappings() -> HashMap<String, Vec<ControlMapping>> {
        let mut mappings = HashMap::new();

        // Disk Encryption -> Req 3: Protect Stored Account Data
        mappings.insert(
            "disk_encryption".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "3.5.1".to_string(),
                control_name: "Render PAN unreadable anywhere it is stored".to_string(),
                category: "Protect Stored Data".to_string(),
                description: "Disk-level encryption to protect stored cardholder data".to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Firewall -> Req 1: Install and Maintain Network Security Controls
        mappings.insert(
            "firewall".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "1.2.1".to_string(),
                    control_name: "Configuration standards for network security controls"
                        .to_string(),
                    category: "Network Security".to_string(),
                    description:
                        "Configuration standards for firewall and network security controls"
                            .to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "1.4.1".to_string(),
                    control_name: "NSCs are implemented between trusted and untrusted networks"
                        .to_string(),
                    category: "Network Security".to_string(),
                    description: "Network security controls implemented between networks"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Antivirus -> Req 5: Protect All Systems Against Malware
        mappings.insert(
            "antivirus".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "5.2.1".to_string(),
                    control_name: "Anti-malware solution deployed on all system components"
                        .to_string(),
                    category: "Anti-Malware".to_string(),
                    description:
                        "Anti-malware solution deployed and maintained on all system components"
                            .to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "5.2.2".to_string(),
                    control_name: "Anti-malware solution detects all known types of malware"
                        .to_string(),
                    category: "Anti-Malware".to_string(),
                    description: "Anti-malware solution detects all known types of malware"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // MFA -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "mfa".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "8.4.2".to_string(),
                    control_name: "MFA for all access into the CDE".to_string(),
                    category: "Authentication".to_string(),
                    description:
                        "MFA is implemented for all access into the cardholder data environment"
                            .to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "8.4.3".to_string(),
                    control_name: "MFA for all remote network access".to_string(),
                    category: "Authentication".to_string(),
                    description: "MFA is implemented for all remote network access".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
            ],
        );

        // Password Policy -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "password_policy".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "8.3.6".to_string(),
                    control_name: "Passwords meet minimum complexity requirements".to_string(),
                    category: "Authentication".to_string(),
                    description: "If passwords are used, minimum complexity requirements are met"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "8.3.7".to_string(),
                    control_name: "Password change requirements".to_string(),
                    category: "Authentication".to_string(),
                    description: "Passwords are changed at least once every 90 days".to_string(),
                    weight: 0.75,
                    is_critical: false,
                },
            ],
        );

        // System Updates -> Req 6: Develop and Maintain Secure Systems
        mappings.insert(
            "system_updates".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "6.3.3".to_string(),
                control_name: "Security patches installed within one month".to_string(),
                category: "Secure Systems".to_string(),
                description:
                    "Security patches for all software installed within one month of release"
                        .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Audit Logging -> Req 10: Log and Monitor All Access
        mappings.insert(
            "audit_logging".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "10.2.1".to_string(),
                    control_name: "Audit logs are enabled and active".to_string(),
                    category: "Logging and Monitoring".to_string(),
                    description: "Audit logs are enabled and active for all system components".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "10.3.1".to_string(),
                    control_name: "Read access to audit logs".to_string(),
                    category: "Logging and Monitoring".to_string(),
                    description: "Read access to time-sensitive audit log data is provided only to those with job need".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Session Lock -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "session_lock".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "8.2.8".to_string(),
                control_name: "Session idle timeout".to_string(),
                category: "Authentication".to_string(),
                description:
                    "If a session has been idle for more than 15 minutes, require re-authentication"
                        .to_string(),
                weight: 0.75,
                is_critical: false,
            }],
        );

        // Admin Accounts -> Req 7: Restrict Access to System Components
        mappings.insert(
            "admin_accounts".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "7.2.1".to_string(),
                    control_name: "Access control system restricts access".to_string(),
                    category: "Access Control".to_string(),
                    description: "An access control system is implemented that restricts access based on job classification".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "7.2.2".to_string(),
                    control_name: "Privileges assigned to individuals based on job classification".to_string(),
                    category: "Access Control".to_string(),
                    description: "Access is assigned to users, including privileged users, based on job classification".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Remote Access -> Req 2: Apply Secure Configurations
        mappings.insert(
            "remote_access".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "2.2.7".to_string(),
                control_name: "All non-console administrative access is encrypted".to_string(),
                category: "Secure Configurations".to_string(),
                description:
                    "All non-console administrative access is encrypted using strong cryptography"
                        .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Time Sync -> Req 10: Log and Monitor All Access
        mappings.insert(
            "time_sync".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "10.6.1".to_string(),
                control_name: "System clocks are synchronized".to_string(),
                category: "Logging and Monitoring".to_string(),
                description: "System clocks and time on all systems are synchronized using time-synchronization technology".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Obsolete Protocols -> Req 4: Protect Cardholder Data
        mappings.insert(
            "obsolete_protocols".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "4.2.1".to_string(),
                control_name: "Strong cryptography and security protocols".to_string(),
                category: "Data Transmission".to_string(),
                description:
                    "Strong cryptography and security protocols are implemented to safeguard PAN"
                        .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Log Rotation -> Req 10: Log and Monitor All Access
        mappings.insert(
            "log_rotation".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "10.5.1".to_string(),
                control_name: "Retain audit log history for at least 12 months".to_string(),
                category: "Logging and Monitoring".to_string(),
                description: "Retain audit log history for at least 12 months, with 3 months immediately available".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // USB Storage -> Req 3: Protect Stored Account Data
        mappings.insert(
            "usb_storage".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "3.3.2".to_string(),
                control_name: "Encrypt stored data or render unreadable".to_string(),
                category: "Data Storage".to_string(),
                description: "SAD is not stored after authorization, even if encrypted".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Backup -> Req 9: Restrict Physical Access
        mappings.insert(
            "backup".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "9.4.5".to_string(),
                control_name: "Securely store backup media".to_string(),
                category: "Physical Access".to_string(),
                description:
                    "Securely store backup media with cardholder data in a secure location"
                        .to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Kernel Hardening -> Req 2: Apply Secure Configurations
        mappings.insert(
            "kernel_hardening".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "2.2.1".to_string(),
                control_name: "Configuration standards for all system components".to_string(),
                category: "Secure Configurations".to_string(),
                description: "Configuration standards are developed, implemented, and maintained"
                    .to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Guest Account -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "guest_account".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "8.2.2".to_string(),
                control_name: "Group, shared, or generic accounts are not used".to_string(),
                category: "Authentication".to_string(),
                description: "Group, shared, or generic accounts, or other shared authentication credentials are only used when necessary".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Auto Login -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "auto_login".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "8.2.1".to_string(),
                control_name: "Unique IDs assigned to each user".to_string(),
                category: "Authentication".to_string(),
                description: "All users are assigned a unique ID before access to system components is allowed".to_string(),
                weight: 0.75,
                is_critical: false,
            }],
        );

        // Windows Hardening -> Req 2: Apply Secure Configurations
        mappings.insert(
            "windows_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.1".to_string(),
                    control_name: "Configuration standards for all system components".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Windows configuration standards are developed and maintained"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.4".to_string(),
                    control_name: "Only necessary services, protocols enabled".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Only necessary services and security features are enabled"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Linux Hardening -> Req 2: Apply Secure Configurations
        mappings.insert(
            "linux_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.1".to_string(),
                    control_name: "Configuration standards for all system components".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Linux kernel configuration standards are maintained".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.5".to_string(),
                    control_name: "All insecure services and protocols removed".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Insecure kernel parameters are disabled".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Update Status -> Req 6: Develop and Maintain Secure Systems
        mappings.insert(
            "update_status".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "6.3.3".to_string(),
                    control_name: "Security patches installed within one month".to_string(),
                    category: "Secure Systems".to_string(),
                    description: "Security patches are tracked and installed promptly".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "6.3.1".to_string(),
                    control_name: "Identify security vulnerabilities".to_string(),
                    category: "Secure Systems".to_string(),
                    description: "Pending security updates are identified and tracked".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Secure Boot -> Req 2: Apply Secure Configurations
        mappings.insert(
            "secure_boot".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "2.2.1".to_string(),
                control_name: "Configuration standards for all system components".to_string(),
                category: "Secure Configurations".to_string(),
                description: "UEFI Secure Boot ensures trusted boot process".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // GPO Password Policy -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "gpo_password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "8.3.6".to_string(),
                control_name: "Passwords meet minimum complexity requirements".to_string(),
                category: "Authentication".to_string(),
                description: "Domain password policies enforce complexity requirements".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // GPO Lockout Policy -> Req 8: Identify Users and Authenticate Access
        mappings.insert(
            "gpo_lockout_policy".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "8.3.4".to_string(),
                control_name: "Invalid authentication attempts are limited".to_string(),
                category: "Authentication".to_string(),
                description: "Account lockout limits invalid authentication attempts".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Audit Policy -> Req 10: Log and Monitor All Access
        mappings.insert(
            "gpo_audit_policy".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "10.2.1".to_string(),
                control_name: "Audit logs are enabled and active".to_string(),
                category: "Logging and Monitoring".to_string(),
                description: "Domain audit policies enable comprehensive logging".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Privileged Groups -> Req 7: Restrict Access to System Components
        mappings.insert(
            "privileged_groups".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "7.2.1".to_string(),
                    control_name: "Access control system restricts access".to_string(),
                    category: "Access Control".to_string(),
                    description: "Privileged group membership is controlled".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "7.2.3".to_string(),
                    control_name: "Privileges are set to least privilege".to_string(),
                    category: "Access Control".to_string(),
                    description: "Privileged access follows least privilege principle".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // LDAP Security -> Req 4: Protect Cardholder Data
        mappings.insert(
            "ldap_security".to_string(),
            vec![ControlMapping {
                framework_id: "PCI_DSS".to_string(),
                control_id: "4.2.1".to_string(),
                control_name: "Strong cryptography and security protocols".to_string(),
                category: "Data Transmission".to_string(),
                description: "LDAP communications use strong encryption (LDAPS)".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // DNS Security -> Req 1: Firewall and Network Security, Req 4: Protect Data
        mappings.insert(
            "dns_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "1.3.2".to_string(),
                    control_name: "Network connections are restricted".to_string(),
                    category: "Network Security".to_string(),
                    description: "Secure DNS prevents unauthorized network access".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "4.2.1".to_string(),
                    control_name: "Strong cryptography and security protocols".to_string(),
                    category: "Data Transmission".to_string(),
                    description: "DNS queries encrypted with DoH/DoT".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // SSH Hardening -> Req 2: Secure Configurations, Req 8: Authentication
        mappings.insert(
            "ssh_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.7".to_string(),
                    control_name: "Encryption used for non-console administrative access"
                        .to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "SSH provides encrypted administrative access".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "8.3.1".to_string(),
                    control_name: "Strong authentication for all users".to_string(),
                    category: "Authentication".to_string(),
                    description: "SSH key-based authentication instead of passwords".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "4.2.1".to_string(),
                    control_name: "Strong cryptography and security protocols".to_string(),
                    category: "Data Transmission".to_string(),
                    description: "SSH uses strong ciphers and protocols".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Container Security -> Req 2: Secure Configurations, Req 6: Secure Systems
        mappings.insert(
            "container_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.1".to_string(),
                    control_name: "Configuration standards for all system components".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Container runtime follows security configuration standards"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "6.3.2".to_string(),
                    control_name: "Custom software is developed securely".to_string(),
                    category: "Secure Systems".to_string(),
                    description: "Containers are hardened with minimal privileges".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "2.2.4".to_string(),
                    control_name: "Only necessary services enabled".to_string(),
                    category: "Secure Configurations".to_string(),
                    description: "Containers run with minimal capabilities".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Certificate Validation -> Req 4: Protect Cardholder Data
        mappings.insert(
            "certificate_validation".to_string(),
            vec![
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "4.2.1".to_string(),
                    control_name: "Strong cryptography and security protocols".to_string(),
                    category: "Data Transmission".to_string(),
                    description: "Valid certificates ensure strong encryption for cardholder data"
                        .to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "PCI_DSS".to_string(),
                    control_id: "4.2.2".to_string(),
                    control_name: "Trusted keys and certificates".to_string(),
                    category: "Data Transmission".to_string(),
                    description: "Only trusted and non-expired certificates are used".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        mappings
    }
}
