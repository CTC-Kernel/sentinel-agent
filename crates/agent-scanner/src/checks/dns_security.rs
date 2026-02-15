//! DNS Security compliance check.
//!
//! Verifies secure DNS configuration across platforms:
//! - DNS-over-HTTPS (DoH) or DNS-over-TLS (DoT) enabled
//! - DNSSEC validation enabled
//! - Secure DNS providers configured
//! - No plaintext DNS leakage
//!
//! Supported platforms:
//! - Windows: Checks DoH settings in registry and netsh
//! - Linux: Checks systemd-resolved, NetworkManager, and /etc/resolv.conf
//! - macOS: Checks DNS configuration profiles and scutil settings

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
#[cfg(any(target_os = "windows", target_os = "macos"))]
use crate::error::ScannerError;
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for DNS security.
pub const CHECK_ID: &str = "dns_security";

/// Well-known secure DNS providers.
const SECURE_DNS_PROVIDERS: &[&str] = &[
    // Cloudflare
    "1.1.1.1",
    "1.0.0.1",
    "2606:4700:4700::1111",
    "2606:4700:4700::1001",
    // Google
    "8.8.8.8",
    "8.8.4.4",
    "2001:4860:4860::8888",
    "2001:4860:4860::8844",
    // Quad9
    "9.9.9.9",
    "149.112.112.112",
    "2620:fe::fe",
    "2620:fe::9",
    // OpenDNS
    "208.67.222.222",
    "208.67.220.220",
    // NextDNS
    "45.90.28.0",
    "45.90.30.0",
    // CleanBrowsing
    "185.228.168.168",
    "185.228.169.168",
];

/// DNS security status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsSecurityStatus {
    /// Whether secure DNS is properly configured.
    pub secure: bool,

    /// Whether DNS-over-HTTPS is enabled.
    pub doh_enabled: bool,

    /// Whether DNS-over-TLS is enabled.
    pub dot_enabled: bool,

    /// Whether DNSSEC validation is enabled.
    pub dnssec_enabled: bool,

    /// Configured DNS servers.
    pub dns_servers: Vec<String>,

    /// Whether using secure DNS providers.
    pub using_secure_provider: bool,

    /// DNS configuration method detected.
    pub config_method: String,

    /// DoH template/endpoint if configured.
    pub doh_endpoint: Option<String>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// DNS security compliance check.
pub struct DnsSecurityCheck {
    definition: CheckDefinition,
}

impl DnsSecurityCheck {
    /// Create a new DNS security check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("DNS Security")
            .description("Verify secure DNS configuration (DoH/DoT, DNSSEC)")
            .category(CheckCategory::NetworkSecurity)
            .severity(CheckSeverity::Medium)
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

    /// Check if a DNS server is a known secure provider.
    fn is_secure_provider(server: &str) -> bool {
        SECURE_DNS_PROVIDERS.iter().any(|&s| server.contains(s))
    }

    /// Check DNS security on Windows.
    #[cfg(target_os = "windows")]
    async fn check_windows(&self) -> ScannerResult<DnsSecurityStatus> {
        debug!("Checking Windows DNS security settings");

        let mut status = DnsSecurityStatus {
            secure: false,
            doh_enabled: false,
            dot_enabled: false,
            dnssec_enabled: false,
            dns_servers: Vec::new(),
            using_secure_provider: false,
            config_method: "Windows DNS Client".to_string(),
            doh_endpoint: None,
            issues: Vec::new(),
            raw_output: String::new(),
        };

        // Check DoH settings via registry
        let doh_output = Command::new("reg")
            .args([
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters",
                "/v",
                "EnableAutoDoh",
            ])
            .output();

        if let Ok(output) = doh_output {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("DoH Registry: {}\n", result.trim()));

            // EnableAutoDoh: 2 = automatic, 1 = off
            if result.contains("0x2") {
                status.doh_enabled = true;
            }
        }

        // Check DNS server configuration
        let dns_output = Command::new("netsh")
            .args(["interface", "ip", "show", "dns"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query DNS config: {}", e))
            })?;

        let dns_result = String::from_utf8_lossy(&dns_output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("DNS Servers:\n{}\n", dns_result));

        // Parse DNS servers from output
        for line in dns_result.lines() {
            if line.contains("DNS Servers") || line.contains("Statically Configured") {
                if let Some(server) = line.split_whitespace().last() {
                    if server.contains('.') || server.contains(':') {
                        status.dns_servers.push(server.to_string());
                    }
                }
            }
        }

        // Check if using secure providers
        status.using_secure_provider = status
            .dns_servers
            .iter()
            .any(|s| Self::is_secure_provider(s));

        // Check DoH templates
        let template_output = Command::new("netsh")
            .args(["dns", "show", "encryption"])
            .output();

        if let Ok(output) = template_output {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("DoH Templates:\n{}\n", result));

            if Self::is_doh_endpoint(&result) {
                status.doh_enabled = true;
                // Extract endpoint
                for line in result.lines() {
                    if line.contains("https://") {
                        status.doh_endpoint = Some(line.trim().to_string());
                        break;
                    }
                }
            }
        }

        // Determine overall security status
        status.secure = status.doh_enabled || status.dot_enabled || status.using_secure_provider;

        if !status.doh_enabled && !status.dot_enabled {
            status
                .issues
                .push("DNS-over-HTTPS/TLS not enabled".to_string());
        }

        if !status.using_secure_provider && status.dns_servers.is_empty() {
            status
                .issues
                .push("No secure DNS provider configured".to_string());
        }

        Ok(status)
    }

    /// Check DNS security on Linux.
    #[cfg(target_os = "linux")]
    async fn check_linux(&self) -> ScannerResult<DnsSecurityStatus> {
        debug!("Checking Linux DNS security settings");

        let mut status = DnsSecurityStatus {
            secure: false,
            doh_enabled: false,
            dot_enabled: false,
            dnssec_enabled: false,
            dns_servers: Vec::new(),
            using_secure_provider: false,
            config_method: "Unknown".to_string(),
            doh_endpoint: None,
            issues: Vec::new(),
            raw_output: String::new(),
        };

        // Check systemd-resolved (modern Linux)
        if let Ok(output) = Command::new("resolvectl").args(["status"]).output() {
            let result = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("resolvectl status:\n{}\n", result));
            status.config_method = "systemd-resolved".to_string();

            // Parse DNS servers
            for line in result.lines() {
                let line_lower = line.to_lowercase();
                if line_lower.contains("dns servers:") || line_lower.contains("current dns server:")
                {
                    if let Some(server_part) = line.split(':').last() {
                        for server in server_part.split_whitespace() {
                            if server.contains('.') || server.contains(':') {
                                status.dns_servers.push(server.to_string());
                            }
                        }
                    }
                }

                // Check DNSSEC
                if line_lower.contains("dnssec setting:") {
                    status.dnssec_enabled =
                        line_lower.contains("yes") || line_lower.contains("allow-downgrade");
                }

                // Check DNS over TLS
                if line_lower.contains("dns over tls:") {
                    status.dot_enabled =
                        line_lower.contains("yes") || line_lower.contains("opportunistic");
                }
            }
        }

        // Check /etc/resolv.conf for traditional configuration
        if let Ok(content) = std::fs::read_to_string("/etc/resolv.conf") {
            status
                .raw_output
                .push_str(&format!("/etc/resolv.conf:\n{}\n", content));

            if status.config_method == "Unknown" {
                status.config_method = "resolv.conf".to_string();
            }

            for line in content.lines() {
                if line.starts_with("nameserver") {
                    if let Some(server) = line.split_whitespace().nth(1) {
                        if !status.dns_servers.contains(&server.to_string()) {
                            status.dns_servers.push(server.to_string());
                        }
                    }
                }
            }
        }

        // Check for dnscrypt-proxy
        if std::path::Path::new("/etc/dnscrypt-proxy").exists() {
            status.doh_enabled = true;
            status.config_method = "dnscrypt-proxy".to_string();
            status.raw_output.push_str("dnscrypt-proxy detected\n");
        }

        // Check for stubby (DNS-over-TLS client)
        if std::path::Path::new("/etc/stubby").exists() {
            status.dot_enabled = true;
            status.raw_output.push_str("stubby DoT client detected\n");
        }

        // Check if using secure providers
        status.using_secure_provider = status
            .dns_servers
            .iter()
            .any(|s| Self::is_secure_provider(s));

        // Determine overall security status
        status.secure = status.doh_enabled
            || status.dot_enabled
            || (status.dnssec_enabled && status.using_secure_provider);

        if !status.doh_enabled && !status.dot_enabled {
            status
                .issues
                .push("DNS-over-HTTPS/TLS not enabled".to_string());
        }

        if !status.dnssec_enabled {
            status
                .issues
                .push("DNSSEC validation not enabled".to_string());
        }

        if !status.using_secure_provider {
            status
                .issues
                .push("No secure DNS provider configured".to_string());
        }

        Ok(status)
    }

    /// Check DNS security on macOS.
    #[cfg(target_os = "macos")]
    async fn check_macos(&self) -> ScannerResult<DnsSecurityStatus> {
        debug!("Checking macOS DNS security settings");

        let mut status = DnsSecurityStatus {
            secure: false,
            doh_enabled: false,
            dot_enabled: false,
            dnssec_enabled: false,
            dns_servers: Vec::new(),
            using_secure_provider: false,
            config_method: "macOS DNS".to_string(),
            doh_endpoint: None,
            issues: Vec::new(),
            raw_output: String::new(),
        };

        // Check current DNS configuration via scutil
        let output = Command::new("scutil")
            .args(["--dns"])
            .output()
            .map_err(|e| {
                ScannerError::CheckExecution(format!("Failed to query DNS config: {}", e))
            })?;

        let result = String::from_utf8_lossy(&output.stdout).to_string();
        status
            .raw_output
            .push_str(&format!("scutil --dns:\n{}\n", result));

        // Parse DNS servers
        for line in result.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("nameserver")
                && let Some(addr_part) = trimmed.split_whitespace().last() {
                    // Extract just the IP address (remove brackets if present)
                    let server = addr_part.trim_matches(|c| c == '[' || c == ']');
                    if !status.dns_servers.contains(&server.to_string()) {
                        status.dns_servers.push(server.to_string());
                    }
                }
        }

        // Check for DNS configuration profiles (DoH/DoT)
        let profiles_output = Command::new("profiles").args(["list"]).output();

        if let Ok(output) = profiles_output {
            let profiles = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("profiles list:\n{}\n", profiles));

            // Check for DNS settings profiles
            if profiles.to_lowercase().contains("dns") {
                // Further check profile details
                if let Ok(detail_output) = Command::new("profiles")
                    .args(["show", "-type", "configuration"])
                    .output()
                {
                    let details = String::from_utf8_lossy(&detail_output.stdout).to_string();
                    if details.contains("DNSSettings")
                        || details.contains("doh")
                        || details.contains("dot")
                    {
                        status.doh_enabled = true;
                        status.config_method = "DNS Configuration Profile".to_string();
                    }
                }
            }
        }

        // Check for DoH/DoT in /etc/resolver
        if std::path::Path::new("/etc/resolver").exists()
            && let Ok(entries) = std::fs::read_dir("/etc/resolver") {
                for entry in entries.filter_map(|e| e.ok()) {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        status.raw_output.push_str(&format!(
                            "/etc/resolver/{}:\n{}\n",
                            entry.file_name().to_string_lossy(),
                            content
                        ));
                    }
                }
            }

        // Check for dnscrypt-proxy (Homebrew)
        if std::path::Path::new("/usr/local/etc/dnscrypt-proxy.toml").exists()
            || std::path::Path::new("/opt/homebrew/etc/dnscrypt-proxy.toml").exists()
        {
            status.doh_enabled = true;
            status.config_method = "dnscrypt-proxy".to_string();
            status.raw_output.push_str("dnscrypt-proxy detected\n");
        }

        // Check if using secure providers
        status.using_secure_provider = status
            .dns_servers
            .iter()
            .any(|s| Self::is_secure_provider(s));

        // macOS 14+ supports native DoH
        if let Ok(output) = Command::new("sw_vers").args(["-productVersion"]).output() {
            let version = String::from_utf8_lossy(&output.stdout).to_string();
            if let Some(major) = version.trim().split('.').next()
                && let Ok(major_num) = major.parse::<u32>()
                    && major_num >= 14 {
                        status
                            .raw_output
                            .push_str("macOS 14+ detected (native DoH support)\n");
                    }
        }

        // Determine overall security status
        status.secure = status.doh_enabled || status.dot_enabled || status.using_secure_provider;

        if !status.doh_enabled && !status.dot_enabled {
            status
                .issues
                .push("DNS-over-HTTPS/TLS not enabled".to_string());
        }

        if !status.using_secure_provider && !status.doh_enabled {
            status
                .issues
                .push("No secure DNS provider configured".to_string());
        }

        Ok(status)
    }

    /// Fallback for unsupported platforms.
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    async fn check_unsupported(&self) -> ScannerResult<DnsSecurityStatus> {
        Ok(DnsSecurityStatus {
            secure: false,
            doh_enabled: false,
            dot_enabled: false,
            dnssec_enabled: false,
            dns_servers: Vec::new(),
            using_secure_provider: false,
            config_method: "Unknown".to_string(),
            doh_endpoint: None,
            issues: vec!["Unsupported platform".to_string()],
            raw_output: "Unsupported platform".to_string(),
        })
    }
}

impl Default for DnsSecurityCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for DnsSecurityCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        #[cfg(target_os = "windows")]
        let status = self.check_windows().await?;

        #[cfg(target_os = "linux")]
        let status = self.check_linux().await?;

        #[cfg(target_os = "macos")]
        let status = self.check_macos().await?;

        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        let status = self.check_unsupported().await?;

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if status.secure {
            let mut details = vec![format!("method={}", status.config_method)];
            if status.doh_enabled {
                details.push("DoH=enabled".to_string());
            }
            if status.dot_enabled {
                details.push("DoT=enabled".to_string());
            }
            if status.dnssec_enabled {
                details.push("DNSSEC=enabled".to_string());
            }
            if status.using_secure_provider {
                details.push("secure_provider=yes".to_string());
            }

            Ok(CheckOutput::pass(
                format!(
                    "DNS security is properly configured: {}",
                    details.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!("DNS security issues: {}", status.issues.join("; ")),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_creation() {
        let check = DnsSecurityCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(check.definition().category, CheckCategory::NetworkSecurity);
        assert_eq!(check.definition().severity, CheckSeverity::Medium);
    }

    #[test]
    fn test_check_frameworks() {
        let check = DnsSecurityCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"NIST_CSF".to_string()));
    }

    #[test]
    fn test_secure_provider_detection() {
        assert!(DnsSecurityCheck::is_secure_provider("1.1.1.1"));
        assert!(DnsSecurityCheck::is_secure_provider("8.8.8.8"));
        assert!(DnsSecurityCheck::is_secure_provider("9.9.9.9"));
        assert!(!DnsSecurityCheck::is_secure_provider("192.168.1.1"));
    }

    #[test]
    fn test_dns_status_serialization() {
        let status = DnsSecurityStatus {
            secure: true,
            doh_enabled: true,
            dot_enabled: false,
            dnssec_enabled: true,
            dns_servers: vec!["1.1.1.1".to_string(), "1.0.0.1".to_string()],
            using_secure_provider: true,
            config_method: "systemd-resolved".to_string(),
            doh_endpoint: Some("https://cloudflare-dns.com/dns-query".to_string()),
            issues: vec![],
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"secure\":true"));
        assert!(json.contains("\"doh_enabled\":true"));
        assert!(json.contains("cloudflare-dns.com"));

        let parsed: DnsSecurityStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.secure);
        assert!(parsed.doh_enabled);
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = DnsSecurityCheck::new();
        let result = check.execute().await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
