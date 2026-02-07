//! Linux kernel and system hardening compliance checks.
//!
//! Comprehensive sysctl-based security checks:
//! - Kernel ASLR (randomize_va_space)
//! - Kernel exploit mitigations (exec-shield, dmesg_restrict)
//! - Network hardening (syn_cookies, ip_forward, rp_filter)
//! - File system hardening (protected_symlinks, protected_hardlinks)
//! - AppArmor/SELinux status
//! - Core dump restrictions

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// Check ID for Linux hardening.
pub const LINUX_HARDENING_CHECK_ID: &str = "linux_hardening";

/// Individual sysctl setting status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SysctlSetting {
    pub name: String,
    pub category: String,
    pub path: String,
    pub current_value: Option<String>,
    pub expected_value: String,
    pub compliant: bool,
    pub severity: String,
    pub description: String,
    pub remediation: String,
}

/// Security module status (AppArmor/SELinux).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityModuleStatus {
    pub apparmor_enabled: bool,
    pub apparmor_enforcing: bool,
    pub apparmor_profiles_count: usize,
    pub selinux_enabled: bool,
    pub selinux_mode: String,
    pub selinux_policy: Option<String>,
}

/// Linux hardening status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinuxHardeningStatus {
    pub compliant: bool,
    pub compliance_score: f32,
    pub total_checks: usize,
    pub passed_checks: usize,
    pub failed_checks: usize,
    pub sysctl_settings: Vec<SysctlSetting>,
    pub security_module: SecurityModuleStatus,
    pub core_dumps_disabled: bool,
    pub ptrace_restricted: bool,
    #[serde(default)]
    pub critical_issues: Vec<String>,
}

/// Linux hardening compliance check.
pub struct LinuxHardeningCheck {
    definition: CheckDefinition,
}

impl LinuxHardeningCheck {
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(LINUX_HARDENING_CHECK_ID)
            .name("Linux Kernel Hardening")
            .description(
                "Comprehensive Linux kernel hardening: ASLR, sysctl security, \
                 AppArmor/SELinux, network hardening, file system protections",
            )
            .category(CheckCategory::KernelSecurity)
            .severity(CheckSeverity::Critical)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec!["linux".to_string()])
            .build();

        Self { definition }
    }

    #[cfg(target_os = "linux")]
    async fn check_hardening(&self) -> ScannerResult<LinuxHardeningStatus> {
        let mut settings = Vec::new();
        let mut critical_issues = Vec::new();

        // Define sysctl checks
        let checks = self.get_sysctl_checks();

        for check in checks {
            let result = self.check_sysctl_value(&check);
            if !result.compliant && result.severity == "critical" {
                critical_issues.push(format!("{}: {}", result.name, result.description));
            }
            settings.push(result);
        }

        let passed = settings.iter().filter(|s| s.compliant).count();
        let total = settings.len();

        // Check security modules
        let security_module = self.check_security_modules().await;

        // Add security module to score
        let mut security_bonus = 0.0;
        if security_module.selinux_enabled && security_module.selinux_mode == "Enforcing" {
            security_bonus = 10.0;
        } else if security_module.apparmor_enabled && security_module.apparmor_enforcing {
            security_bonus = 10.0;
        } else {
            critical_issues
                .push("No mandatory access control (SELinux/AppArmor) enforcing".to_string());
        }

        // Check core dumps
        let core_dumps_disabled = self.check_core_dumps_disabled();
        if !core_dumps_disabled {
            critical_issues.push("Core dumps are enabled (security risk)".to_string());
        }

        // Check ptrace restriction
        let ptrace_restricted = self.check_ptrace_restricted();

        let base_score = if total > 0 {
            (passed as f32 / total as f32) * 90.0
        } else {
            0.0
        };

        let score = (base_score + security_bonus).min(100.0);

        Ok(LinuxHardeningStatus {
            compliant: score >= 80.0 && critical_issues.is_empty(),
            compliance_score: score,
            total_checks: total,
            passed_checks: passed,
            failed_checks: total - passed,
            sysctl_settings: settings,
            security_module,
            core_dumps_disabled,
            ptrace_restricted,
            critical_issues,
        })
    }

    #[cfg(target_os = "linux")]
    fn get_sysctl_checks(&self) -> Vec<SysctlCheckDef> {
        vec![
            // ASLR
            SysctlCheckDef {
                name: "ASLR Enabled",
                category: "Memory Protection",
                path: "/proc/sys/kernel/randomize_va_space",
                expected: "2", // Full randomization
                severity: "critical",
                description: "Address Space Layout Randomization must be fully enabled",
                remediation: "sysctl -w kernel.randomize_va_space=2",
            },
            // Kernel pointer hiding
            SysctlCheckDef {
                name: "Kernel Pointer Hiding",
                category: "Kernel Protection",
                path: "/proc/sys/kernel/kptr_restrict",
                expected: "2",
                severity: "high",
                description: "Kernel pointers should be hidden from unprivileged users",
                remediation: "sysctl -w kernel.kptr_restrict=2",
            },
            // dmesg restriction
            SysctlCheckDef {
                name: "dmesg Restriction",
                category: "Kernel Protection",
                path: "/proc/sys/kernel/dmesg_restrict",
                expected: "1",
                severity: "high",
                description: "Restrict access to kernel ring buffer",
                remediation: "sysctl -w kernel.dmesg_restrict=1",
            },
            // Kernel module loading
            SysctlCheckDef {
                name: "Module Loading Restriction",
                category: "Kernel Protection",
                path: "/proc/sys/kernel/modules_disabled",
                expected: "1",
                severity: "medium",
                description: "Disable kernel module loading (after boot)",
                remediation: "sysctl -w kernel.modules_disabled=1 (careful: permanent until reboot)",
            },
            // SYN cookies
            SysctlCheckDef {
                name: "SYN Cookies",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/tcp_syncookies",
                expected: "1",
                severity: "critical",
                description: "SYN cookies protect against SYN flood attacks",
                remediation: "sysctl -w net.ipv4.tcp_syncookies=1",
            },
            // IP forwarding (should be disabled unless router)
            SysctlCheckDef {
                name: "IPv4 Forwarding Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/ip_forward",
                expected: "0",
                severity: "high",
                description: "IP forwarding should be disabled unless acting as router",
                remediation: "sysctl -w net.ipv4.ip_forward=0",
            },
            // IPv6 forwarding
            SysctlCheckDef {
                name: "IPv6 Forwarding Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv6/conf/all/forwarding",
                expected: "0",
                severity: "high",
                description: "IPv6 forwarding should be disabled",
                remediation: "sysctl -w net.ipv6.conf.all.forwarding=0",
            },
            // ICMP redirects
            SysctlCheckDef {
                name: "ICMP Redirects Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/accept_redirects",
                expected: "0",
                severity: "high",
                description: "ICMP redirects should be ignored",
                remediation: "sysctl -w net.ipv4.conf.all.accept_redirects=0",
            },
            // Secure ICMP redirects
            SysctlCheckDef {
                name: "Secure ICMP Redirects",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/secure_redirects",
                expected: "0",
                severity: "medium",
                description: "Secure ICMP redirects should be disabled",
                remediation: "sysctl -w net.ipv4.conf.all.secure_redirects=0",
            },
            // Send redirects
            SysctlCheckDef {
                name: "Send Redirects Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/send_redirects",
                expected: "0",
                severity: "medium",
                description: "Should not send ICMP redirects",
                remediation: "sysctl -w net.ipv4.conf.all.send_redirects=0",
            },
            // Source routing
            SysctlCheckDef {
                name: "Source Routing Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/accept_source_route",
                expected: "0",
                severity: "critical",
                description: "Source routing must be disabled",
                remediation: "sysctl -w net.ipv4.conf.all.accept_source_route=0",
            },
            // Reverse path filtering
            SysctlCheckDef {
                name: "Reverse Path Filtering",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/rp_filter",
                expected: "1",
                severity: "high",
                description: "Reverse path filtering prevents IP spoofing",
                remediation: "sysctl -w net.ipv4.conf.all.rp_filter=1",
            },
            // Log martians
            SysctlCheckDef {
                name: "Log Martian Packets",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/conf/all/log_martians",
                expected: "1",
                severity: "medium",
                description: "Log packets with impossible addresses",
                remediation: "sysctl -w net.ipv4.conf.all.log_martians=1",
            },
            // Ignore ICMP broadcasts
            SysctlCheckDef {
                name: "Ignore ICMP Broadcasts",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/icmp_echo_ignore_broadcasts",
                expected: "1",
                severity: "high",
                description: "Ignore ICMP broadcast requests (Smurf attack)",
                remediation: "sysctl -w net.ipv4.icmp_echo_ignore_broadcasts=1",
            },
            // Bogus ICMP responses
            SysctlCheckDef {
                name: "Ignore Bogus ICMP Errors",
                category: "Network Security",
                path: "/proc/sys/net/ipv4/icmp_ignore_bogus_error_responses",
                expected: "1",
                severity: "medium",
                description: "Ignore bogus ICMP error responses",
                remediation: "sysctl -w net.ipv4.icmp_ignore_bogus_error_responses=1",
            },
            // Protected symlinks
            SysctlCheckDef {
                name: "Protected Symlinks",
                category: "File System",
                path: "/proc/sys/fs/protected_symlinks",
                expected: "1",
                severity: "high",
                description: "Protect against symlink attacks in world-writable dirs",
                remediation: "sysctl -w fs.protected_symlinks=1",
            },
            // Protected hardlinks
            SysctlCheckDef {
                name: "Protected Hardlinks",
                category: "File System",
                path: "/proc/sys/fs/protected_hardlinks",
                expected: "1",
                severity: "high",
                description: "Protect against hardlink attacks",
                remediation: "sysctl -w fs.protected_hardlinks=1",
            },
            // Protected FIFOs
            SysctlCheckDef {
                name: "Protected FIFOs",
                category: "File System",
                path: "/proc/sys/fs/protected_fifos",
                expected: "2",
                severity: "medium",
                description: "Protect against FIFO attacks in sticky directories",
                remediation: "sysctl -w fs.protected_fifos=2",
            },
            // Protected regular files
            SysctlCheckDef {
                name: "Protected Regular Files",
                category: "File System",
                path: "/proc/sys/fs/protected_regular",
                expected: "2",
                severity: "medium",
                description: "Protect against regular file creation in sticky dirs",
                remediation: "sysctl -w fs.protected_regular=2",
            },
            // SUID dumpable
            SysctlCheckDef {
                name: "SUID Core Dump Disabled",
                category: "Core Dump",
                path: "/proc/sys/fs/suid_dumpable",
                expected: "0",
                severity: "high",
                description: "SUID programs should not create core dumps",
                remediation: "sysctl -w fs.suid_dumpable=0",
            },
            // Yama ptrace scope
            SysctlCheckDef {
                name: "Ptrace Scope",
                category: "Process Security",
                path: "/proc/sys/kernel/yama/ptrace_scope",
                expected: "1", // Or higher
                severity: "high",
                description: "Restrict ptrace to parent-child only",
                remediation: "sysctl -w kernel.yama.ptrace_scope=1",
            },
            // Perf events
            SysctlCheckDef {
                name: "Perf Events Restriction",
                category: "Kernel Protection",
                path: "/proc/sys/kernel/perf_event_paranoid",
                expected: "3", // Highest restriction
                severity: "medium",
                description: "Restrict perf events to privileged users",
                remediation: "sysctl -w kernel.perf_event_paranoid=3",
            },
            // ExecShield (if available)
            SysctlCheckDef {
                name: "NX/ExecShield",
                category: "Memory Protection",
                path: "/proc/sys/kernel/exec-shield",
                expected: "1",
                severity: "high",
                description: "NX/ExecShield prevents code execution in data pages",
                remediation: "sysctl -w kernel.exec-shield=1 (if available)",
            },
            // IPv6 router advertisements
            SysctlCheckDef {
                name: "IPv6 RA Disabled",
                category: "Network Security",
                path: "/proc/sys/net/ipv6/conf/all/accept_ra",
                expected: "0",
                severity: "medium",
                description: "Disable IPv6 router advertisements",
                remediation: "sysctl -w net.ipv6.conf.all.accept_ra=0",
            },
        ]
    }

    #[cfg(target_os = "linux")]
    fn check_sysctl_value(&self, check: &SysctlCheckDef) -> SysctlSetting {
        let current_value = fs::read_to_string(check.path)
            .ok()
            .map(|s| s.trim().to_string());

        let compliant = current_value
            .as_ref()
            .map(|v| {
                v == check.expected
                    || v.parse::<i32>().unwrap_or(-1) >= check.expected.parse::<i32>().unwrap_or(0)
            })
            .unwrap_or(false);

        SysctlSetting {
            name: check.name.to_string(),
            category: check.category.to_string(),
            path: check.path.to_string(),
            current_value,
            expected_value: check.expected.to_string(),
            compliant,
            severity: check.severity.to_string(),
            description: check.description.to_string(),
            remediation: check.remediation.to_string(),
        }
    }

    #[cfg(target_os = "linux")]
    async fn check_security_modules(&self) -> SecurityModuleStatus {
        let mut status = SecurityModuleStatus {
            apparmor_enabled: false,
            apparmor_enforcing: false,
            apparmor_profiles_count: 0,
            selinux_enabled: false,
            selinux_mode: "Disabled".to_string(),
            selinux_policy: None,
        };

        // Check AppArmor
        if Path::new("/sys/kernel/security/apparmor").exists() {
            status.apparmor_enabled = true;
            if let Ok(profiles) = fs::read_dir("/sys/kernel/security/apparmor/policy/profiles") {
                status.apparmor_profiles_count = profiles.count();
                status.apparmor_enforcing = status.apparmor_profiles_count > 0;
            }
        }

        // Check SELinux
        if Path::new("/sys/fs/selinux").exists() {
            status.selinux_enabled = true;
            if let Ok(mode) = fs::read_to_string("/sys/fs/selinux/enforce") {
                status.selinux_mode = if mode.trim() == "1" {
                    "Enforcing".to_string()
                } else {
                    "Permissive".to_string()
                };
            }
            if let Ok(policy) = fs::read_to_string("/etc/selinux/config") {
                for line in policy.lines() {
                    if line.starts_with("SELINUXTYPE=") {
                        status.selinux_policy =
                            Some(line.replace("SELINUXTYPE=", "").trim().to_string());
                    }
                }
            }
        }

        status
    }

    #[cfg(target_os = "linux")]
    fn check_core_dumps_disabled(&self) -> bool {
        // Check /proc/sys/kernel/core_pattern
        if let Ok(pattern) = fs::read_to_string("/proc/sys/kernel/core_pattern") {
            let pattern = pattern.trim();
            // If pattern starts with |, it's piped to a program (might be for systemd-coredump)
            // If it's empty or /dev/null, core dumps are disabled
            if pattern.is_empty() || pattern == "/dev/null" {
                return true;
            }
        }

        // Check ulimit via /proc/self/limits
        if let Ok(limits) = fs::read_to_string("/proc/self/limits") {
            for line in limits.lines() {
                if line.contains("core file size") && line.contains("0") {
                    return true;
                }
            }
        }

        false
    }

    #[cfg(target_os = "linux")]
    fn check_ptrace_restricted(&self) -> bool {
        if let Ok(val) = fs::read_to_string("/proc/sys/kernel/yama/ptrace_scope") {
            val.trim().parse::<i32>().unwrap_or(0) >= 1
        } else {
            false
        }
    }

    #[cfg(not(target_os = "linux"))]
    async fn check_hardening(&self) -> ScannerResult<LinuxHardeningStatus> {
        Ok(LinuxHardeningStatus {
            compliant: true,
            compliance_score: 100.0,
            total_checks: 0,
            passed_checks: 0,
            failed_checks: 0,
            sysctl_settings: vec![],
            security_module: SecurityModuleStatus {
                apparmor_enabled: false,
                apparmor_enforcing: false,
                apparmor_profiles_count: 0,
                selinux_enabled: false,
                selinux_mode: "N/A".to_string(),
                selinux_policy: None,
            },
            core_dumps_disabled: true,
            ptrace_restricted: true,
            critical_issues: vec![],
        })
    }
}

#[cfg(target_os = "linux")]
struct SysctlCheckDef {
    name: &'static str,
    category: &'static str,
    path: &'static str,
    expected: &'static str,
    severity: &'static str,
    description: &'static str,
    remediation: &'static str,
}

impl Default for LinuxHardeningCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for LinuxHardeningCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        debug!("Executing Linux hardening check");

        let status = self.check_hardening().await?;
        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.compliant {
            info!(
                "Linux hardening check passed: {}/{} sysctl checks, SELinux/AppArmor active",
                status.passed_checks, status.total_checks
            );
            Ok(CheckOutput::pass(
                format!(
                    "Kernel hardening compliant ({}/{} checks, {:.1}%)",
                    status.passed_checks, status.total_checks, status.compliance_score
                ),
                raw_data,
            ))
        } else {
            warn!(
                "Linux hardening check failed: {} critical issues",
                status.critical_issues.len()
            );
            Ok(CheckOutput::fail(
                format!(
                    "Kernel hardening non-compliant: {} critical issues, {}/{} passed",
                    status.critical_issues.len(),
                    status.passed_checks,
                    status.total_checks
                ),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linux_hardening_check_creation() {
        let check = LinuxHardeningCheck::new();
        assert_eq!(check.definition().id, LINUX_HARDENING_CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::KernelSecurity);
    }

    #[test]
    fn test_sysctl_setting_serialization() {
        let setting = SysctlSetting {
            name: "ASLR".to_string(),
            category: "Memory Protection".to_string(),
            path: "/proc/sys/kernel/randomize_va_space".to_string(),
            current_value: Some("2".to_string()),
            expected_value: "2".to_string(),
            compliant: true,
            severity: "critical".to_string(),
            description: "ASLR enabled".to_string(),
            remediation: "sysctl -w kernel.randomize_va_space=2".to_string(),
        };

        let json = serde_json::to_string(&setting).unwrap();
        assert!(json.contains("ASLR"));
    }

    #[test]
    fn test_security_module_status() {
        let status = SecurityModuleStatus {
            apparmor_enabled: true,
            apparmor_enforcing: true,
            apparmor_profiles_count: 50,
            selinux_enabled: false,
            selinux_mode: "Disabled".to_string(),
            selinux_policy: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("apparmor_enabled"));
    }
}
