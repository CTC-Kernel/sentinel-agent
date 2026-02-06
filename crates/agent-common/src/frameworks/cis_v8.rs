//! CIS Controls v8 mappings.
//!
//! Maps agent checks to CIS Controls v8:
//! - 18 top-level controls
//! - Implementation Groups (IG1, IG2, IG3)

use super::{ControlMapping, FrameworkInfo};
use std::collections::HashMap;

/// CIS Controls v8 framework mapping.
pub struct CisV8Mapping;

impl CisV8Mapping {
    /// Get framework metadata.
    pub fn framework_info() -> FrameworkInfo {
        FrameworkInfo {
            id: "CIS_V8".to_string(),
            name: "CIS Controls".to_string(),
            version: "8.0".to_string(),
            description: "Prioritized set of actions to protect against cyber attacks".to_string(),
            applicability: vec![
                "All Organizations".to_string(),
                "Global".to_string(),
            ],
            reference_url: "https://www.cisecurity.org/controls/v8".to_string(),
        }
    }

    /// Get all check-to-control mappings.
    pub fn mappings() -> HashMap<String, Vec<ControlMapping>> {
        let mut mappings = HashMap::new();

        // Disk Encryption -> CIS 3: Data Protection
        mappings.insert(
            "disk_encryption".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "3.6".to_string(),
                    control_name: "Encrypt Data on End-User Devices".to_string(),
                    category: "Data Protection".to_string(),
                    description: "Encrypt data on end-user devices containing sensitive data".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "3.11".to_string(),
                    control_name: "Encrypt Sensitive Data at Rest".to_string(),
                    category: "Data Protection".to_string(),
                    description: "Encrypt sensitive data at rest on servers, applications, and databases".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Firewall -> CIS 4: Secure Configuration, CIS 13: Network Monitoring
        mappings.insert(
            "firewall".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.4".to_string(),
                    control_name: "Implement Host-Based Firewalls".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Implement and manage a host-based firewall or port filtering tool".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "13.4".to_string(),
                    control_name: "Perform Traffic Filtering".to_string(),
                    category: "Network Monitoring".to_string(),
                    description: "Perform traffic filtering between network segments".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Antivirus -> CIS 10: Malware Defenses
        mappings.insert(
            "antivirus".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "10.1".to_string(),
                    control_name: "Deploy and Maintain Anti-Malware Software".to_string(),
                    category: "Malware Defenses".to_string(),
                    description: "Deploy and maintain anti-malware software on all enterprise assets".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "10.2".to_string(),
                    control_name: "Configure Automatic Anti-Malware Updates".to_string(),
                    category: "Malware Defenses".to_string(),
                    description: "Configure automatic updates for anti-malware signature files".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // MFA -> CIS 6: Access Control Management
        mappings.insert(
            "mfa".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "6.3".to_string(),
                control_name: "Require MFA for Externally-Exposed Applications".to_string(),
                category: "Access Control".to_string(),
                description: "Require MFA for externally-exposed enterprise or third-party applications".to_string(),
                weight: 0.95,
                is_critical: true,
            },
            ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "6.4".to_string(),
                control_name: "Require MFA for Remote Network Access".to_string(),
                category: "Access Control".to_string(),
                description: "Require MFA for remote network access".to_string(),
                weight: 0.95,
                is_critical: true,
            },
            ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "6.5".to_string(),
                control_name: "Require MFA for Administrative Access".to_string(),
                category: "Access Control".to_string(),
                description: "Require MFA for all administrative access accounts".to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Password Policy -> CIS 5: Account Management
        mappings.insert(
            "password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "5.2".to_string(),
                control_name: "Use Unique Passwords".to_string(),
                category: "Account Management".to_string(),
                description: "Use unique passwords for all enterprise assets".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // System Updates -> CIS 7: Continuous Vulnerability Management
        mappings.insert(
            "system_updates".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "7.3".to_string(),
                    control_name: "Perform Automated Operating System Patch Management".to_string(),
                    category: "Vulnerability Management".to_string(),
                    description: "Perform operating system updates on enterprise assets".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "7.4".to_string(),
                    control_name: "Perform Automated Application Patch Management".to_string(),
                    category: "Vulnerability Management".to_string(),
                    description: "Perform application updates on enterprise assets".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Audit Logging -> CIS 8: Audit Log Management
        mappings.insert(
            "audit_logging".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "8.2".to_string(),
                    control_name: "Collect Audit Logs".to_string(),
                    category: "Audit Log Management".to_string(),
                    description: "Collect audit logs on enterprise assets".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "8.5".to_string(),
                    control_name: "Collect Detailed Audit Logs".to_string(),
                    category: "Audit Log Management".to_string(),
                    description: "Configure detailed audit logging for enterprise assets".to_string(),
                    weight: 0.8,
                    is_critical: false,
                },
            ],
        );

        // Session Lock -> CIS 4: Secure Configuration
        mappings.insert(
            "session_lock".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "4.3".to_string(),
                control_name: "Configure Automatic Session Locking".to_string(),
                category: "Secure Configuration".to_string(),
                description: "Configure automatic session locking on enterprise assets".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Backup -> CIS 11: Data Recovery
        mappings.insert(
            "backup".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "11.1".to_string(),
                    control_name: "Establish and Maintain a Data Recovery Process".to_string(),
                    category: "Data Recovery".to_string(),
                    description: "Establish and maintain a data recovery process".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "11.2".to_string(),
                    control_name: "Perform Automated Backups".to_string(),
                    category: "Data Recovery".to_string(),
                    description: "Perform automated backups of in-scope enterprise assets".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Admin Accounts -> CIS 5: Account Management
        mappings.insert(
            "admin_accounts".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "5.4".to_string(),
                    control_name: "Restrict Administrator Privileges".to_string(),
                    category: "Account Management".to_string(),
                    description: "Restrict administrator privileges to dedicated administrator accounts".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "5.1".to_string(),
                    control_name: "Establish and Maintain an Inventory of Accounts".to_string(),
                    category: "Account Management".to_string(),
                    description: "Establish and maintain an inventory of all accounts".to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
            ],
        );

        // Remote Access -> CIS 12: Network Infrastructure Management
        mappings.insert(
            "remote_access".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "12.7".to_string(),
                control_name: "Ensure Remote Devices Utilize a VPN".to_string(),
                category: "Network Infrastructure".to_string(),
                description: "Ensure remote devices utilize VPN and are connecting to enterprise infrastructure".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // USB Storage -> CIS 10: Malware Defenses
        mappings.insert(
            "usb_storage".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "10.3".to_string(),
                control_name: "Disable Autorun and Autoplay".to_string(),
                category: "Malware Defenses".to_string(),
                description: "Disable autorun and autoplay auto-execute functionality".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Kernel Hardening -> CIS 4: Secure Configuration
        mappings.insert(
            "kernel_hardening".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "4.1".to_string(),
                control_name: "Establish and Maintain Secure Configuration Process".to_string(),
                category: "Secure Configuration".to_string(),
                description: "Establish and maintain a secure configuration process for enterprise assets".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Time Sync -> CIS 8: Audit Log Management
        mappings.insert(
            "time_sync".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "8.4".to_string(),
                control_name: "Standardize Time Synchronization".to_string(),
                category: "Audit Log Management".to_string(),
                description: "Standardize time synchronization across all enterprise assets".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Obsolete Protocols -> CIS 4: Secure Configuration
        mappings.insert(
            "obsolete_protocols".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "4.8".to_string(),
                control_name: "Uninstall or Disable Unnecessary Services".to_string(),
                category: "Secure Configuration".to_string(),
                description: "Uninstall or disable unnecessary services on enterprise assets".to_string(),
                weight: 0.75,
                is_critical: false,
            }],
        );

        // Browser Security -> CIS 9: Email and Web Browser Protections
        mappings.insert(
            "browser_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "9.2".to_string(),
                    control_name: "Use DNS Filtering Services".to_string(),
                    category: "Email and Web Browser".to_string(),
                    description: "Use DNS filtering services on all enterprise assets".to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "9.3".to_string(),
                    control_name: "Maintain and Enforce Network-Based URL Filters".to_string(),
                    category: "Email and Web Browser".to_string(),
                    description: "Maintain and enforce network-based URL filters".to_string(),
                    weight: 0.7,
                    is_critical: false,
                },
            ],
        );

        // Log Rotation -> CIS 8: Audit Log Management
        mappings.insert(
            "log_rotation".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "8.3".to_string(),
                control_name: "Ensure Adequate Audit Log Storage".to_string(),
                category: "Audit Log Management".to_string(),
                description: "Ensure that logging destinations maintain adequate storage".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Guest Account -> CIS 5: Account Management
        mappings.insert(
            "guest_account".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "5.3".to_string(),
                control_name: "Disable Dormant Accounts".to_string(),
                category: "Account Management".to_string(),
                description: "Disable dormant accounts".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Auto Login -> CIS 6: Access Control
        mappings.insert(
            "auto_login".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "6.1".to_string(),
                control_name: "Establish an Access Granting Process".to_string(),
                category: "Access Control".to_string(),
                description: "Establish and follow a process for granting access".to_string(),
                weight: 0.65,
                is_critical: false,
            }],
        );

        // Bluetooth -> CIS 12: Network Infrastructure
        mappings.insert(
            "bluetooth".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "12.1".to_string(),
                control_name: "Ensure Network Infrastructure is Up-to-Date".to_string(),
                category: "Network Infrastructure".to_string(),
                description: "Ensure network infrastructure stays up-to-date".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // IPv6 Config -> CIS 12: Network Infrastructure
        mappings.insert(
            "ipv6_config".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "12.2".to_string(),
                control_name: "Establish and Maintain Secure Network Architecture".to_string(),
                category: "Network Infrastructure".to_string(),
                description: "Establish and maintain a secure network architecture".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Windows Hardening -> CIS 4: Secure Configuration
        mappings.insert(
            "windows_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.1".to_string(),
                    control_name: "Establish and Maintain a Secure Configuration Process".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Establish and maintain a secure configuration process for enterprise assets".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.7".to_string(),
                    control_name: "Manage Default Accounts on Enterprise Assets".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Manage default accounts on enterprise assets and software".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Linux Hardening -> CIS 4: Secure Configuration
        mappings.insert(
            "linux_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.1".to_string(),
                    control_name: "Establish and Maintain a Secure Configuration Process".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Establish and maintain a secure configuration process for enterprise assets".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.6".to_string(),
                    control_name: "Securely Manage Enterprise Assets and Software".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Securely manage enterprise assets and software".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Update Status -> CIS 7: Vulnerability Management
        mappings.insert(
            "update_status".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "7.3".to_string(),
                    control_name: "Perform Automated Operating System Patch Management".to_string(),
                    category: "Vulnerability Management".to_string(),
                    description: "Perform operating system updates on enterprise assets".to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "7.1".to_string(),
                    control_name: "Establish and Maintain a Vulnerability Management Process".to_string(),
                    category: "Vulnerability Management".to_string(),
                    description: "Establish and maintain a documented vulnerability management process".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Secure Boot -> CIS 4: Secure Configuration
        mappings.insert(
            "secure_boot".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "4.1".to_string(),
                control_name: "Establish and Maintain a Secure Configuration Process".to_string(),
                category: "Secure Configuration".to_string(),
                description: "UEFI Secure Boot ensures only trusted firmware and OS boot loaders execute".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Password Policy -> CIS 5: Account Management
        mappings.insert(
            "gpo_password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "5.2".to_string(),
                control_name: "Use Unique Passwords".to_string(),
                category: "Account Management".to_string(),
                description: "Group Policy password settings ensure unique, strong passwords".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Lockout Policy -> CIS 5: Account Management
        mappings.insert(
            "gpo_lockout_policy".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "5.5".to_string(),
                control_name: "Establish and Maintain an Inventory of Service Accounts".to_string(),
                category: "Account Management".to_string(),
                description: "Account lockout policies protect against brute-force attacks".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // GPO Audit Policy -> CIS 8: Audit Log Management
        mappings.insert(
            "gpo_audit_policy".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "8.5".to_string(),
                control_name: "Collect Detailed Audit Logs".to_string(),
                category: "Audit Log Management".to_string(),
                description: "Group Policy audit settings for comprehensive event logging".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // Privileged Groups -> CIS 5: Account Management
        mappings.insert(
            "privileged_groups".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "5.4".to_string(),
                    control_name: "Restrict Administrator Privileges".to_string(),
                    category: "Account Management".to_string(),
                    description: "Restrict administrator privileges to dedicated administrator accounts".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "6.8".to_string(),
                    control_name: "Define and Maintain Role-Based Access Control".to_string(),
                    category: "Access Control".to_string(),
                    description: "Define and maintain role-based access control".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // LDAP Security -> CIS 12: Network Infrastructure
        mappings.insert(
            "ldap_security".to_string(),
            vec![ControlMapping {
                framework_id: "CIS_V8".to_string(),
                control_id: "12.8".to_string(),
                control_name: "Establish and Maintain Dedicated Computing Resources".to_string(),
                category: "Network Infrastructure".to_string(),
                description: "LDAP/LDAPS security for directory services".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // DNS Security -> CIS 9: Email and Web Browser Protections
        mappings.insert(
            "dns_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "9.2".to_string(),
                    control_name: "Use DNS Filtering Services".to_string(),
                    category: "Email and Web Browser".to_string(),
                    description: "Use DNS filtering services to block access to known malicious domains".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "12.3".to_string(),
                    control_name: "Securely Manage Network Infrastructure".to_string(),
                    category: "Network Infrastructure".to_string(),
                    description: "Securely manage DNS infrastructure with encrypted DNS (DoH/DoT)".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // SSH Hardening -> CIS 4: Secure Configuration, CIS 6: Access Control
        mappings.insert(
            "ssh_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.1".to_string(),
                    control_name: "Establish and Maintain Secure Configuration Process".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "SSH server hardening with secure ciphers, protocols, and authentication".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "6.7".to_string(),
                    control_name: "Centralize Access Control".to_string(),
                    category: "Access Control".to_string(),
                    description: "Key-based authentication and restricted root access".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "12.7".to_string(),
                    control_name: "Ensure Remote Devices Utilize a VPN and are Connecting to Enterprise Infrastructure".to_string(),
                    category: "Network Infrastructure".to_string(),
                    description: "Secure remote access via hardened SSH".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Container Security -> CIS 4: Secure Configuration, CIS 16: Application Software Security
        mappings.insert(
            "container_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "4.1".to_string(),
                    control_name: "Establish and Maintain Secure Configuration Process".to_string(),
                    category: "Secure Configuration".to_string(),
                    description: "Container runtime hardening (rootless, seccomp, AppArmor/SELinux)".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "16.1".to_string(),
                    control_name: "Establish and Maintain a Secure Application Development Process".to_string(),
                    category: "Application Security".to_string(),
                    description: "Container security best practices for application deployment".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "16.7".to_string(),
                    control_name: "Use Standard Hardening Configuration Templates".to_string(),
                    category: "Application Security".to_string(),
                    description: "Apply CIS Docker/Kubernetes Benchmarks".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Certificate Validation -> CIS 3: Data Protection, CIS 12: Network Infrastructure
        mappings.insert(
            "certificate_validation".to_string(),
            vec![
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "3.10".to_string(),
                    control_name: "Encrypt Sensitive Data in Transit".to_string(),
                    category: "Data Protection".to_string(),
                    description: "Valid certificates required for encrypted communications".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "CIS_V8".to_string(),
                    control_id: "12.3".to_string(),
                    control_name: "Securely Manage Network Infrastructure".to_string(),
                    category: "Network Infrastructure".to_string(),
                    description: "Certificate store integrity and expiration management".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        mappings
    }
}
