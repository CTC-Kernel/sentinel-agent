//! ISO 27001:2022 mappings.
//!
//! Maps agent checks to ISO 27001:2022 Annex A controls.

use super::{ControlMapping, FrameworkInfo};
use std::collections::HashMap;

/// ISO 27001:2022 framework mapping.
pub struct Iso27001Mapping;

impl Iso27001Mapping {
    /// Get framework metadata.
    pub fn framework_info() -> FrameworkInfo {
        FrameworkInfo {
            id: "ISO_27001".to_string(),
            name: "ISO/IEC 27001".to_string(),
            version: "2022".to_string(),
            description: "International standard for information security management systems"
                .to_string(),
            applicability: vec![
                "All Organizations".to_string(),
                "Global".to_string(),
                "Certification".to_string(),
            ],
            reference_url: "https://www.iso.org/standard/27001".to_string(),
        }
    }

    /// Get all check-to-control mappings.
    pub fn mappings() -> HashMap<String, Vec<ControlMapping>> {
        let mut mappings = HashMap::new();

        // Disk Encryption -> A.8.24 Use of cryptography
        mappings.insert(
            "disk_encryption".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.24".to_string(),
                control_name: "Use of cryptography".to_string(),
                category: "Technological Controls".to_string(),
                description:
                    "Rules for the effective use of cryptography shall be defined and implemented"
                        .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Firewall -> A.8.20 Network security
        mappings.insert(
            "firewall".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.20".to_string(),
                    control_name: "Network security".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Networks and network devices shall be secured, managed and controlled".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.21".to_string(),
                    control_name: "Security of network services".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Security mechanisms, service levels and service requirements of network services shall be identified".to_string(),
                    weight: 0.8,
                    is_critical: false,
                },
            ],
        );

        // Antivirus -> A.8.7 Protection against malware
        mappings.insert(
            "antivirus".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.7".to_string(),
                control_name: "Protection against malware".to_string(),
                category: "Technological Controls".to_string(),
                description: "Protection against malware shall be implemented and supported by appropriate user awareness".to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // MFA -> A.8.5 Secure authentication
        mappings.insert(
            "mfa".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.5".to_string(),
                control_name: "Secure authentication".to_string(),
                category: "Technological Controls".to_string(),
                description: "Secure authentication technologies and procedures shall be implemented based on information access restrictions".to_string(),
                weight: 0.95,
                is_critical: true,
            }],
        );

        // Password Policy -> A.5.17 Authentication information
        mappings.insert(
            "password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.5.17".to_string(),
                control_name: "Authentication information".to_string(),
                category: "People Controls".to_string(),
                description:
                    "Allocation and management of authentication information shall be controlled"
                        .to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // System Updates -> A.8.8 Management of technical vulnerabilities
        mappings.insert(
            "system_updates".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.8".to_string(),
                    control_name: "Management of technical vulnerabilities".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Information about technical vulnerabilities of information systems in use shall be obtained".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.19".to_string(),
                    control_name: "Installation of software on operational systems".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Procedures and measures shall be implemented to securely manage software installation".to_string(),
                    weight: 0.75,
                    is_critical: false,
                },
            ],
        );

        // Audit Logging -> A.8.15 Logging
        mappings.insert(
            "audit_logging".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.15".to_string(),
                    control_name: "Logging".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Logs that record activities, exceptions, faults and other relevant events shall be produced".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.16".to_string(),
                    control_name: "Monitoring activities".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Networks, systems and applications shall be monitored for anomalous behaviour".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Session Lock -> A.8.1 User endpoint devices
        mappings.insert(
            "session_lock".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.1".to_string(),
                control_name: "User endpoint devices".to_string(),
                category: "Technological Controls".to_string(),
                description: "Information stored on, processed by or accessible via user endpoint devices shall be protected".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Backup -> A.8.13 Information backup
        mappings.insert(
            "backup".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.13".to_string(),
                control_name: "Information backup".to_string(),
                category: "Technological Controls".to_string(),
                description: "Backup copies of information, software and systems shall be maintained and regularly tested".to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Admin Accounts -> A.5.18 Access rights
        mappings.insert(
            "admin_accounts".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.5.18".to_string(),
                    control_name: "Access rights".to_string(),
                    category: "People Controls".to_string(),
                    description: "Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.2".to_string(),
                    control_name: "Privileged access rights".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "The allocation and use of privileged access rights shall be restricted and managed".to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
            ],
        );

        // Remote Access -> A.8.22 Segregation of networks
        mappings.insert(
            "remote_access".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.22".to_string(),
                control_name: "Segregation of networks".to_string(),
                category: "Technological Controls".to_string(),
                description: "Groups of information services, users and information systems shall be segregated in networks".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Kernel Hardening -> A.8.9 Configuration management
        mappings.insert(
            "kernel_hardening".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.9".to_string(),
                control_name: "Configuration management".to_string(),
                category: "Technological Controls".to_string(),
                description: "Configurations, including security configurations, of hardware, software, services and networks shall be established".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // Time Sync -> A.8.17 Clock synchronization
        mappings.insert(
            "time_sync".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.17".to_string(),
                control_name: "Clock synchronization".to_string(),
                category: "Technological Controls".to_string(),
                description: "The clocks of information processing systems used by the organization shall be synchronized".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Obsolete Protocols -> A.8.24 Use of cryptography
        mappings.insert(
            "obsolete_protocols".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.24".to_string(),
                control_name: "Use of cryptography".to_string(),
                category: "Technological Controls".to_string(),
                description: "Rules for the effective use of cryptography, including secure protocols, shall be defined".to_string(),
                weight: 0.8,
                is_critical: false,
            }],
        );

        // USB Storage -> A.8.12 Data leakage prevention
        mappings.insert(
            "usb_storage".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.12".to_string(),
                control_name: "Data leakage prevention".to_string(),
                category: "Technological Controls".to_string(),
                description: "Data leakage prevention measures shall be applied to systems, networks and any other devices".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Bluetooth -> A.8.20 Network security
        mappings.insert(
            "bluetooth".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.20".to_string(),
                control_name: "Network security".to_string(),
                category: "Technological Controls".to_string(),
                description: "Wireless network security measures shall be implemented".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Browser Security -> A.8.23 Web filtering
        mappings.insert(
            "browser_security".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.23".to_string(),
                control_name: "Web filtering".to_string(),
                category: "Technological Controls".to_string(),
                description: "Access to external websites shall be managed to reduce exposure to malicious content".to_string(),
                weight: 0.7,
                is_critical: false,
            }],
        );

        // Log Rotation -> A.8.15 Logging
        mappings.insert(
            "log_rotation".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.15".to_string(),
                control_name: "Logging".to_string(),
                category: "Technological Controls".to_string(),
                description: "Log facilities and log information shall be protected against tampering and unauthorized access".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Guest Account -> A.5.16 Identity management
        mappings.insert(
            "guest_account".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.5.16".to_string(),
                control_name: "Identity management".to_string(),
                category: "People Controls".to_string(),
                description: "The full life cycle of identities shall be managed".to_string(),
                weight: 0.6,
                is_critical: false,
            }],
        );

        // Auto Login -> A.8.5 Secure authentication
        mappings.insert(
            "auto_login".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.5".to_string(),
                control_name: "Secure authentication".to_string(),
                category: "Technological Controls".to_string(),
                description: "Automatic login shall be disabled to ensure proper authentication"
                    .to_string(),
                weight: 0.65,
                is_critical: false,
            }],
        );

        // IPv6 Config -> A.8.20 Network security
        mappings.insert(
            "ipv6_config".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.20".to_string(),
                control_name: "Network security".to_string(),
                category: "Technological Controls".to_string(),
                description: "Network protocols shall be properly configured".to_string(),
                weight: 0.5,
                is_critical: false,
            }],
        );

        // Windows Hardening -> A.8.9 Configuration management
        mappings.insert(
            "windows_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.9".to_string(),
                    control_name: "Configuration management".to_string(),
                    category: "Technological Controls".to_string(),
                    description:
                        "Windows security configurations shall be established and maintained"
                            .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.8".to_string(),
                    control_name: "Management of technical vulnerabilities".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Windows hardening reduces technical vulnerabilities".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Linux Hardening -> A.8.9 Configuration management
        mappings.insert(
            "linux_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.9".to_string(),
                    control_name: "Configuration management".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Linux kernel security configurations shall be maintained"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.8".to_string(),
                    control_name: "Management of technical vulnerabilities".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Kernel hardening mitigates technical vulnerabilities".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Update Status -> A.8.8 Management of technical vulnerabilities
        mappings.insert(
            "update_status".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.8".to_string(),
                    control_name: "Management of technical vulnerabilities".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Update status tracking ensures vulnerabilities are addressed"
                        .to_string(),
                    weight: 0.95,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.19".to_string(),
                    control_name: "Installation of software on operational systems".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Software updates are tracked and managed".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Secure Boot -> A.8.9 Configuration management
        mappings.insert(
            "secure_boot".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.9".to_string(),
                control_name: "Configuration management".to_string(),
                category: "Technological Controls".to_string(),
                description: "UEFI Secure Boot ensures system integrity at boot time".to_string(),
                weight: 0.8,
                is_critical: true,
            }],
        );

        // GPO Password Policy -> A.5.17 Authentication information
        mappings.insert(
            "gpo_password_policy".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.5.17".to_string(),
                control_name: "Authentication information".to_string(),
                category: "People Controls".to_string(),
                description: "Domain password policies enforce authentication information controls"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // GPO Lockout Policy -> A.8.5 Secure authentication
        mappings.insert(
            "gpo_lockout_policy".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.5".to_string(),
                control_name: "Secure authentication".to_string(),
                category: "Technological Controls".to_string(),
                description: "Account lockout policies prevent authentication attacks".to_string(),
                weight: 0.85,
                is_critical: true,
            }],
        );

        // GPO Audit Policy -> A.8.15 Logging
        mappings.insert(
            "gpo_audit_policy".to_string(),
            vec![ControlMapping {
                framework_id: "ISO_27001".to_string(),
                control_id: "A.8.15".to_string(),
                control_name: "Logging".to_string(),
                category: "Technological Controls".to_string(),
                description: "Domain audit policies ensure comprehensive security logging"
                    .to_string(),
                weight: 0.9,
                is_critical: true,
            }],
        );

        // Privileged Groups -> A.8.2 Privileged access rights
        mappings.insert(
            "privileged_groups".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.2".to_string(),
                    control_name: "Privileged access rights".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Privileged group membership shall be restricted and managed"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.5.18".to_string(),
                    control_name: "Access rights".to_string(),
                    category: "People Controls".to_string(),
                    description:
                        "Access rights to privileged groups shall be provisioned and reviewed"
                            .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // LDAP Security -> A.8.24 Use of cryptography
        mappings.insert(
            "ldap_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.24".to_string(),
                    control_name: "Use of cryptography".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "LDAP communications shall use cryptographic protection (LDAPS)"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.5.15".to_string(),
                    control_name: "Access control".to_string(),
                    category: "Organizational Controls".to_string(),
                    description: "Directory services access shall be controlled".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // DNS Security -> A.8.20 Networks security, A.8.24 Cryptography
        mappings.insert(
            "dns_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.20".to_string(),
                    control_name: "Networks security".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "DNS infrastructure shall be secured against attacks".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.24".to_string(),
                    control_name: "Use of cryptography".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "DNS queries shall be encrypted using DoH/DoT".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // SSH Hardening -> A.8.5 Secure authentication, A.8.20 Networks security
        mappings.insert(
            "ssh_hardening".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.5".to_string(),
                    control_name: "Secure authentication".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "SSH authentication shall use secure methods (key-based)"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.20".to_string(),
                    control_name: "Networks security".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "SSH configuration shall follow security best practices"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.24".to_string(),
                    control_name: "Use of cryptography".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "SSH shall use strong cryptographic algorithms".to_string(),
                    weight: 0.8,
                    is_critical: true,
                },
            ],
        );

        // Container Security -> A.8.9 Configuration management, A.8.25 Secure development
        mappings.insert(
            "container_security".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.9".to_string(),
                    control_name: "Configuration management".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Container runtime configurations shall be managed securely"
                        .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.25".to_string(),
                    control_name: "Secure development life cycle".to_string(),
                    category: "Technological Controls".to_string(),
                    description: "Container images shall be developed and deployed securely"
                        .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.3".to_string(),
                    control_name: "Information access restriction".to_string(),
                    category: "Technological Controls".to_string(),
                    description:
                        "Containers shall run with least privilege (rootless, minimal capabilities)"
                            .to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        // Certificate Validation -> A.8.24 Use of cryptography
        mappings.insert(
            "certificate_validation".to_string(),
            vec![
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.8.24".to_string(),
                    control_name: "Use of cryptography".to_string(),
                    category: "Technological Controls".to_string(),
                    description:
                        "Valid and trusted certificates shall be used for cryptographic protection"
                            .to_string(),
                    weight: 0.9,
                    is_critical: true,
                },
                ControlMapping {
                    framework_id: "ISO_27001".to_string(),
                    control_id: "A.5.14".to_string(),
                    control_name: "Information transfer".to_string(),
                    category: "Organizational Controls".to_string(),
                    description: "Certificate-based security for information transfer".to_string(),
                    weight: 0.85,
                    is_critical: true,
                },
            ],
        );

        mappings
    }
}
