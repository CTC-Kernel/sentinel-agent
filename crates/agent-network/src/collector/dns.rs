//! DNS configuration collector.
//!
//! Collects DNS configuration:
//! - DNS server addresses
//! - Search domains
//! - DNS suffix

use crate::error::{NetworkError, NetworkResult};
use crate::types::DnsConfiguration;
use std::process::Command;
use tracing::debug;

/// Collects DNS configuration.
pub struct DnsCollector;

impl DnsCollector {
    /// Create a new DNS collector.
    pub fn new() -> Self {
        Self
    }

    /// Collect DNS configuration.
    pub async fn collect(&self) -> NetworkResult<DnsConfiguration> {
        #[cfg(target_os = "linux")]
        {
            self.collect_linux().await
        }

        #[cfg(target_os = "macos")]
        {
            self.collect_macos().await
        }

        #[cfg(target_os = "windows")]
        {
            self.collect_windows().await
        }

        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        {
            Err(NetworkError::PlatformNotSupported(
                "Unknown platform".to_string(),
            ))
        }
    }

    #[cfg(target_os = "linux")]
    async fn collect_linux(&self) -> NetworkResult<DnsConfiguration> {
        use std::fs;

        let mut config = DnsConfiguration::default();

        // Try /etc/resolv.conf first
        if let Ok(content) = fs::read_to_string("/etc/resolv.conf") {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }

                if line.starts_with("nameserver") {
                    if let Some(server) = line.split_whitespace().nth(1) {
                        // Skip loopback (systemd-resolved stub)
                        if server != "127.0.0.53" && server != "127.0.0.1" {
                            config.servers.push(server.to_string());
                        }
                    }
                } else if line.starts_with("search") {
                    config.search_domains = line
                        .split_whitespace()
                        .skip(1)
                        .map(String::from)
                        .collect();
                } else if line.starts_with("domain") {
                    config.suffix = line.split_whitespace().nth(1).map(String::from);
                }
            }
        }

        // If resolv.conf points to systemd-resolved, try to get real servers
        if config.servers.is_empty() {
            // Try systemd-resolve --status
            if let Ok(output) = Command::new("systemd-resolve").arg("--status").output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let line = line.trim();
                    if line.starts_with("DNS Servers:") {
                        if let Some(server) = line.strip_prefix("DNS Servers:") {
                            config.servers.push(server.trim().to_string());
                        }
                    } else if line.starts_with("DNS Domain:") {
                        if let Some(domain) = line.strip_prefix("DNS Domain:") {
                            config.suffix = Some(domain.trim().to_string());
                        }
                    }
                }
            }

            // Alternative: resolvectl status
            if config.servers.is_empty() {
                if let Ok(output) = Command::new("resolvectl").arg("status").output() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let mut in_global = false;
                    for line in stdout.lines() {
                        if line.contains("Global") {
                            in_global = true;
                            continue;
                        }
                        if in_global {
                            let line = line.trim();
                            if line.starts_with("DNS Servers:") {
                                if let Some(servers) = line.strip_prefix("DNS Servers:") {
                                    for server in servers.split_whitespace() {
                                        config.servers.push(server.to_string());
                                    }
                                }
                            } else if line.starts_with("Link ") {
                                // End of global section
                                break;
                            }
                        }
                    }
                }
            }
        }

        debug!(
            "Collected DNS config on Linux: {} servers",
            config.servers.len()
        );
        Ok(config)
    }

    #[cfg(target_os = "macos")]
    async fn collect_macos(&self) -> NetworkResult<DnsConfiguration> {
        let mut config = DnsConfiguration::default();

        // Use scutil --dns for DNS configuration
        let output = Command::new("scutil")
            .arg("--dns")
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("scutil failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut in_resolver = false;

        for line in stdout.lines() {
            let line = line.trim();

            if line.starts_with("resolver #") {
                in_resolver = true;
                continue;
            }

            if in_resolver {
                if line.starts_with("nameserver[") {
                    // nameserver[0] : 8.8.8.8
                    if let Some(server) = line.split(':').nth(1) {
                        let server = server.trim().to_string();
                        if !config.servers.contains(&server) {
                            config.servers.push(server);
                        }
                    }
                } else if line.starts_with("domain") {
                    if let Some(domain) = line.split(':').nth(1) {
                        config.suffix = Some(domain.trim().to_string());
                    }
                } else if line.starts_with("search domain[") {
                    if let Some(domain) = line.split(':').nth(1) {
                        let domain = domain.trim().to_string();
                        if !config.search_domains.contains(&domain) {
                            config.search_domains.push(domain);
                        }
                    }
                }
            }
        }

        debug!(
            "Collected DNS config on macOS: {} servers",
            config.servers.len()
        );
        Ok(config)
    }

    #[cfg(target_os = "windows")]
    async fn collect_windows(&self) -> NetworkResult<DnsConfiguration> {
        let mut config = DnsConfiguration::default();

        // Use PowerShell Get-DnsClientServerAddress
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses } | Select-Object -ExpandProperty ServerAddresses | Select-Object -Unique"#,
            ])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("PowerShell failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let server = line.trim();
            if !server.is_empty() && !config.servers.contains(&server.to_string()) {
                config.servers.push(server.to_string());
            }
        }

        // Get search suffix and search domains
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-DnsClientGlobalSetting | Select-Object SuffixSearchList | ConvertTo-Json"#,
            ])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if let Some(suffix_list) = json["SuffixSearchList"].as_array() {
                    for suffix in suffix_list {
                        if let Some(s) = suffix.as_str() {
                            config.search_domains.push(s.to_string());
                        }
                    }
                }
            }
        }

        // Get primary DNS suffix
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"(Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name Domain -ErrorAction SilentlyContinue).Domain"#,
            ])
            .output();

        if let Ok(output) = output {
            let suffix = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !suffix.is_empty() {
                config.suffix = Some(suffix);
            }
        }

        debug!(
            "Collected DNS config on Windows: {} servers",
            config.servers.len()
        );
        Ok(config)
    }
}

impl Default for DnsCollector {
    fn default() -> Self {
        Self::new()
    }
}
