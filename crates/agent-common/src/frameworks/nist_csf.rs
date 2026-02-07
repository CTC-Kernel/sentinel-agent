//! NIST Cybersecurity Framework (CSF) v2.0 mappings.
//!
//! Maps agent checks to NIST CSF functions:
//! - Identify (ID)
//! - Protect (PR)
//! - Detect (DE)
//! - Respond (RS)
//! - Recover (RC)

use super::{ControlMapping, FrameworkInfo};
use std::collections::HashMap;

/// NIST CSF v2.0 framework mapping.
pub struct NistCsfMapping;

impl NistCsfMapping {
    /// Get framework metadata.
    pub fn framework_info() -> FrameworkInfo {
        FrameworkInfo {
            id: "NIST_CSF".to_string(),
            name: "NIST Cybersecurity Framework".to_string(),
            version: "2.0".to_string(),
            description: "Framework for improving critical infrastructure cybersecurity"
                .to_string(),
            applicability: vec![
                "Critical Infrastructure".to_string(),
                "Federal Agencies".to_string(),
                "Global Organizations".to_string(),
            ],
            reference_url: "https://www.nist.gov/cyberframework".to_string(),
        }
    }

    /// Get all check-to-control mappings.
    pub fn mappings() -> HashMap<String, Vec<ControlMapping>> {
        let mut mappings = HashMap::new();

        // Disk Encryption
        mappings.insert(
            "disk_encryption".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-1".to_string(),
                    control_name: "Data-at-rest is protected".to_string(),
                    category: "Protect".to_string(),
                    description: "Data-at-rest is protected using encryption".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-5".to_string(),
                    control_name: "Protections against data leaks".to_string(),
                    category: "Protect".to_string(),
                    description: "Protections against data leaks are implemented".to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
            ],
        );

        // Firewall
        mappings.insert(
            "firewall".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.AC-5".to_string(),
                    control_name: "Network integrity is protected".to_string(),
                    category: "Protect".to_string(),
                    description: "Network integrity is protected using network segmentation"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "DE.CM-1".to_string(),
                    control_name: "Network is monitored".to_string(),
                    category: "Detect".to_string(),
                    description:
                        "The network is monitored to detect potential cybersecurity events"
                            .to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
            ],
        );

        // Antivirus
        mappings.insert(
            "antivirus".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "DE.CM-4".to_string(),
                    control_name: "Malicious code is detected".to_string(),
                    category: "Detect".to_string(),
                    description: "Malicious code is detected".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-6".to_string(),
                    control_name: "Integrity checking mechanisms".to_string(),
                    category: "Protect".to_string(),
                    description:
                        "Integrity checking mechanisms are used to verify software integrity"
                            .to_string(),
                    weight: 0.6,
                    is_critical: false,
                },
            ],
        );

        // MFA
        mappings.insert(
            "mfa".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-7".to_string(),
                control_name: "Users and devices are authenticated".to_string(),
                category: "Protect".to_string(),
                description:
                    "Users, devices, and other assets are authenticated commensurate with risk"
                        .to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Password Policy
        mappings.insert(
            "password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-1".to_string(),
                control_name: "Identities and credentials are issued".to_string(),
                category: "Protect".to_string(),
                description: "Identities and credentials are issued, managed, verified, revoked"
                    .to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // System Updates
        mappings.insert(
            "system_updates".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-12".to_string(),
                    control_name: "Vulnerability management plan".to_string(),
                    category: "Protect".to_string(),
                    description: "A vulnerability management plan is developed and implemented"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "ID.RA-1".to_string(),
                    control_name: "Asset vulnerabilities identified".to_string(),
                    category: "Identify".to_string(),
                    description: "Asset vulnerabilities are identified and documented".to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
            ],
        );

        // Audit Logging
        mappings.insert(
            "audit_logging".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "DE.AE-3".to_string(),
                    control_name: "Event data are collected".to_string(),
                    category: "Detect".to_string(),
                    description: "Event data are collected and correlated".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.PT-1".to_string(),
                    control_name: "Audit logs are determined".to_string(),
                    category: "Protect".to_string(),
                    description: "Audit/log records are determined, documented, implemented"
                        .to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Session Lock
        mappings.insert(
            "session_lock".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-4".to_string(),
                control_name: "Access permissions managed".to_string(),
                category: "Protect".to_string(),
                description: "Access permissions and authorizations are managed".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Backup
        mappings.insert(
            "backup".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-4".to_string(),
                    control_name: "Backups are conducted".to_string(),
                    category: "Protect".to_string(),
                    description: "Backups of information are conducted, maintained, and tested"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "RC.RP-1".to_string(),
                    control_name: "Recovery plan is executed".to_string(),
                    category: "Recover".to_string(),
                    description:
                        "Recovery plan is executed during or after a cybersecurity incident"
                            .to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Admin Accounts
        mappings.insert(
            "admin_accounts".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-4".to_string(),
                control_name: "Access permissions managed".to_string(),
                category: "Protect".to_string(),
                description: "Access permissions and authorizations are managed".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Remote Access
        mappings.insert(
            "remote_access".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-3".to_string(),
                control_name: "Remote access is managed".to_string(),
                category: "Protect".to_string(),
                description: "Remote access is managed".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Kernel Hardening
        mappings.insert(
            "kernel_hardening".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.IP-1".to_string(),
                control_name: "Baseline configuration".to_string(),
                category: "Protect".to_string(),
                description: "A baseline configuration is created and maintained".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Time Sync
        mappings.insert(
            "time_sync".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.PT-1".to_string(),
                control_name: "Audit logs are determined".to_string(),
                category: "Protect".to_string(),
                description: "Accurate time synchronization for log correlation".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Obsolete Protocols
        mappings.insert(
            "obsolete_protocols".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.DS-2".to_string(),
                control_name: "Data-in-transit is protected".to_string(),
                category: "Protect".to_string(),
                description: "Data-in-transit is protected".to_string(),
                weight: 0.75,
                is_critical: false,
            }],
        );

        // USB Storage
        mappings.insert(
            "usb_storage".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.PT-2".to_string(),
                control_name: "Removable media is protected".to_string(),
                category: "Protect".to_string(),
                description: "Removable media is protected and its use restricted".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Bluetooth
        mappings.insert(
            "bluetooth".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-5".to_string(),
                control_name: "Network integrity is protected".to_string(),
                category: "Protect".to_string(),
                description: "Wireless communication is controlled".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Browser Security
        mappings.insert(
            "browser_security".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.IP-1".to_string(),
                control_name: "Baseline configuration".to_string(),
                category: "Protect".to_string(),
                description: "Browser security baseline is maintained".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Guest Account
        mappings.insert(
            "guest_account".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-1".to_string(),
                control_name: "Identities and credentials are issued".to_string(),
                category: "Protect".to_string(),
                description: "Guest and shared accounts are controlled".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Auto Login
        mappings.insert(
            "auto_login".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-7".to_string(),
                control_name: "Users are authenticated".to_string(),
                category: "Protect".to_string(),
                description: "Automatic login is disabled to ensure authentication".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Log Rotation
        mappings.insert(
            "log_rotation".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.PT-1".to_string(),
                control_name: "Audit logs maintained".to_string(),
                category: "Protect".to_string(),
                description: "Log files are properly rotated and retained".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // IPv6 Config
        mappings.insert(
            "ipv6_config".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-5".to_string(),
                control_name: "Network integrity".to_string(),
                category: "Protect".to_string(),
                description: "IPv6 is properly configured or disabled if not needed".to_string(),
                weight: 0.4,
                is_critical: false,
            }],
        );

        // Windows Hardening
        mappings.insert(
            "windows_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-1".to_string(),
                    control_name: "Baseline configuration".to_string(),
                    category: "Protect".to_string(),
                    description: "Windows security baseline configuration is maintained"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.PT-3".to_string(),
                    control_name: "Least functionality principle".to_string(),
                    category: "Protect".to_string(),
                    description: "Systems are configured with least functionality principle"
                        .to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Linux Hardening
        mappings.insert(
            "linux_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-1".to_string(),
                    control_name: "Baseline configuration".to_string(),
                    category: "Protect".to_string(),
                    description: "Linux kernel security baseline configuration is maintained"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-6".to_string(),
                    control_name: "Integrity checking mechanisms".to_string(),
                    category: "Protect".to_string(),
                    description: "Kernel integrity protection mechanisms are enabled".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Update Status
        mappings.insert(
            "update_status".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-12".to_string(),
                    control_name: "Vulnerability management plan".to_string(),
                    category: "Protect".to_string(),
                    description: "Patch management and update status monitoring".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "ID.RA-1".to_string(),
                    control_name: "Asset vulnerabilities identified".to_string(),
                    category: "Identify".to_string(),
                    description: "Pending updates and vulnerabilities are tracked".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Secure Boot
        mappings.insert(
            "secure_boot".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.DS-6".to_string(),
                control_name: "Integrity checking mechanisms".to_string(),
                category: "Protect".to_string(),
                description: "UEFI Secure Boot ensures boot-time integrity".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Password Policy
        mappings.insert(
            "gpo_password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-1".to_string(),
                control_name: "Identities and credentials are issued".to_string(),
                category: "Protect".to_string(),
                description: "Domain password policies enforce credential strength".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Lockout Policy
        mappings.insert(
            "gpo_lockout_policy".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-7".to_string(),
                control_name: "Users are authenticated".to_string(),
                category: "Protect".to_string(),
                description: "Account lockout protects against authentication attacks".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // GPO Audit Policy
        mappings.insert(
            "gpo_audit_policy".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "DE.AE-3".to_string(),
                control_name: "Event data are collected".to_string(),
                category: "Detect".to_string(),
                description: "Domain audit policies ensure security events are logged".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Privileged Groups
        mappings.insert(
            "privileged_groups".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.AC-4".to_string(),
                control_name: "Access permissions managed".to_string(),
                category: "Protect".to_string(),
                description: "Privileged group membership is monitored and controlled".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // LDAP Security
        mappings.insert(
            "ldap_security".to_string(),
            vec![ControlMapping {
                framework_id: "NIST_CSF".to_string(),
                control_id: "PR.DS-2".to_string(),
                control_name: "Data-in-transit is protected".to_string(),
                category: "Protect".to_string(),
                description: "LDAP communications are secured with TLS".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // DNS Security
        mappings.insert(
            "dns_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-2".to_string(),
                    control_name: "Data-in-transit is protected".to_string(),
                    category: "Protect".to_string(),
                    description: "DNS queries protected with encryption (DoH/DoT)".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.PT-4".to_string(),
                    control_name: "Communications and control networks are protected".to_string(),
                    category: "Protect".to_string(),
                    description: "Secure DNS prevents DNS-based attacks and data exfiltration"
                        .to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // SSH Hardening
        mappings.insert(
            "ssh_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.AC-7".to_string(),
                    control_name: "Users, devices, and other assets are authenticated".to_string(),
                    category: "Protect".to_string(),
                    description: "SSH key-based authentication and hardened configuration"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.PT-4".to_string(),
                    control_name: "Communications and control networks are protected".to_string(),
                    category: "Protect".to_string(),
                    description: "SSH secure protocols and ciphers".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.AC-4".to_string(),
                    control_name: "Access permissions and authorizations are managed".to_string(),
                    category: "Protect".to_string(),
                    description: "SSH access restricted (no root login, authorized users only)"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Container Security
        mappings.insert(
            "container_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.IP-1".to_string(),
                    control_name: "Baseline configuration is created and maintained".to_string(),
                    category: "Protect".to_string(),
                    description: "Container runtime security baseline (rootless, seccomp, MAC)"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.PT-3".to_string(),
                    control_name: "Least functionality principle is incorporated".to_string(),
                    category: "Protect".to_string(),
                    description: "Containers run with minimal privileges and capabilities"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-6".to_string(),
                    control_name: "Integrity checking mechanisms are used".to_string(),
                    category: "Protect".to_string(),
                    description: "Container image signing and integrity verification".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Certificate Validation
        mappings.insert(
            "certificate_validation".to_string(),
            vec![
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "PR.DS-2".to_string(),
                    control_name: "Data-in-transit is protected".to_string(),
                    category: "Protect".to_string(),
                    description: "Valid certificates ensure secure data transmission".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "NIST_CSF".to_string(),
                    control_id: "ID.AM-4".to_string(),
                    control_name: "External information systems are catalogued".to_string(),
                    category: "Identify".to_string(),
                    description: "Certificate inventory and expiration tracking".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        mappings
    }
}
