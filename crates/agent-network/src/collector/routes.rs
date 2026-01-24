//! Routing table collector.
//!
//! Collects routing table entries:
//! - Destination networks
//! - Gateways
//! - Interfaces
//! - Metrics

use crate::error::{NetworkError, NetworkResult};
use crate::types::RouteEntry;
use std::process::Command;
use tracing::debug;

/// Collects routing table information.
pub struct RouteCollector;

impl RouteCollector {
    /// Create a new route collector.
    pub fn new() -> Self {
        Self
    }

    /// Collect routing table entries.
    pub async fn collect(&self) -> NetworkResult<Vec<RouteEntry>> {
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
    async fn collect_linux(&self) -> NetworkResult<Vec<RouteEntry>> {
        use std::fs;

        let mut routes = Vec::new();

        // Try reading /proc/net/route first (IPv4)
        if let Ok(content) = fs::read_to_string("/proc/net/route") {
            for line in content.lines().skip(1) {
                // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 8 {
                    let interface = parts[0].to_string();
                    let destination = Self::hex_to_ip(parts[1]);
                    let gateway = Self::hex_to_ip(parts[2]);
                    let flags = Self::parse_route_flags(parts[3]);
                    let mask = Self::hex_to_ip(parts[7]);
                    let metric = parts[6].parse().ok();

                    let is_default = destination == "0.0.0.0";

                    routes.push(RouteEntry {
                        destination,
                        gateway: if gateway != "0.0.0.0" {
                            Some(gateway)
                        } else {
                            None
                        },
                        netmask: mask,
                        interface,
                        metric,
                        flags,
                        is_default,
                    });
                }
            }
        }

        // Also try ip route for more detailed info
        if let Ok(output) = Command::new("ip").args(["route", "show"]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(route) = self.parse_ip_route_line(line) {
                    // Add if not already present (avoid duplicates)
                    if !routes.iter().any(|r| {
                        r.destination == route.destination && r.interface == route.interface
                    }) {
                        routes.push(route);
                    }
                }
            }
        }

        debug!("Collected {} routes on Linux", routes.len());
        Ok(routes)
    }

    #[cfg(target_os = "linux")]
    fn hex_to_ip(hex: &str) -> String {
        if let Ok(val) = u32::from_str_radix(hex, 16) {
            // Linux stores in little-endian
            format!(
                "{}.{}.{}.{}",
                val & 0xff,
                (val >> 8) & 0xff,
                (val >> 16) & 0xff,
                (val >> 24) & 0xff
            )
        } else {
            "0.0.0.0".to_string()
        }
    }

    #[cfg(target_os = "linux")]
    fn parse_route_flags(flags_hex: &str) -> Vec<String> {
        let mut result = Vec::new();
        if let Ok(flags) = u32::from_str_radix(flags_hex, 16) {
            if flags & 0x0001 != 0 {
                result.push("U".to_string()); // Up
            }
            if flags & 0x0002 != 0 {
                result.push("G".to_string()); // Gateway
            }
            if flags & 0x0004 != 0 {
                result.push("H".to_string()); // Host
            }
        }
        result
    }

    #[cfg(target_os = "linux")]
    fn parse_ip_route_line(&self, line: &str) -> Option<RouteEntry> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            return None;
        }

        let (destination, netmask, is_default) = if parts[0] == "default" {
            ("0.0.0.0".to_string(), "0.0.0.0".to_string(), true)
        } else {
            let dest_parts: Vec<&str> = parts[0].split('/').collect();
            let dest = dest_parts[0].to_string();
            let prefix_len = dest_parts
                .get(1)
                .and_then(|s| s.parse::<u8>().ok())
                .unwrap_or(32);
            let mask = Self::prefix_to_netmask(prefix_len);
            (dest, mask, false)
        };

        let mut gateway = None;
        let mut interface = String::new();
        let mut metric = None;
        let mut flags = Vec::new();

        let mut i = 1;
        while i < parts.len() {
            match parts[i] {
                "via" => {
                    gateway = parts.get(i + 1).map(|s| s.to_string());
                    flags.push("G".to_string());
                    i += 2;
                }
                "dev" => {
                    interface = parts.get(i + 1).unwrap_or(&"").to_string();
                    i += 2;
                }
                "metric" => {
                    metric = parts.get(i + 1).and_then(|s| s.parse().ok());
                    i += 2;
                }
                _ => i += 1,
            }
        }

        flags.push("U".to_string()); // Up

        Some(RouteEntry {
            destination,
            gateway,
            netmask,
            interface,
            metric,
            flags,
            is_default,
        })
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn prefix_to_netmask(prefix: u8) -> String {
        if prefix == 0 {
            return "0.0.0.0".to_string();
        }
        if prefix >= 32 {
            return "255.255.255.255".to_string();
        }
        let mask: u32 = !((1u32 << (32 - prefix)) - 1);
        format!(
            "{}.{}.{}.{}",
            (mask >> 24) & 0xff,
            (mask >> 16) & 0xff,
            (mask >> 8) & 0xff,
            mask & 0xff
        )
    }

    #[cfg(target_os = "macos")]
    async fn collect_macos(&self) -> NetworkResult<Vec<RouteEntry>> {
        let mut routes = Vec::new();

        // Use netstat -rn for routing table
        let output = Command::new("netstat")
            .args(["-rn"])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("netstat failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut in_ipv4_section = false;

        for line in stdout.lines() {
            // Skip until we find the IPv4 routing table
            if line.contains("Internet:") {
                in_ipv4_section = true;
                continue;
            }
            if line.contains("Internet6:") {
                in_ipv4_section = false;
                continue;
            }
            if !in_ipv4_section || line.starts_with("Destination") || line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let destination = parts[0].to_string();
                let gateway = parts[1].to_string();
                let flags_str = parts[2];
                let interface = parts.last().unwrap_or(&"").to_string();

                let is_default = destination == "default";

                // Parse flags
                let flags: Vec<String> = flags_str.chars().map(|c| c.to_string()).collect();

                // Parse destination for netmask
                let (dest, netmask) = if is_default {
                    ("0.0.0.0".to_string(), "0.0.0.0".to_string())
                } else if destination.contains('/') {
                    let parts: Vec<&str> = destination.split('/').collect();
                    let prefix: u8 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(32);
                    (parts[0].to_string(), Self::prefix_to_netmask(prefix))
                } else {
                    (destination.clone(), "255.255.255.255".to_string())
                };

                routes.push(RouteEntry {
                    destination: dest,
                    gateway: if gateway != "link#" && !gateway.starts_with("link#") {
                        Some(gateway)
                    } else {
                        None
                    },
                    netmask,
                    interface,
                    metric: None, // macOS doesn't show metric in netstat
                    flags,
                    is_default,
                });
            }
        }

        debug!("Collected {} routes on macOS", routes.len());
        Ok(routes)
    }

    #[cfg(target_os = "windows")]
    async fn collect_windows(&self) -> NetworkResult<Vec<RouteEntry>> {
        let mut routes = Vec::new();

        // Use PowerShell Get-NetRoute
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-NetRoute -AddressFamily IPv4 | Select-Object DestinationPrefix, NextHop, InterfaceAlias, InterfaceMetric, RouteMetric | ConvertTo-Json -Depth 2"#,
            ])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("PowerShell failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse JSON output
        let route_entries: Vec<serde_json::Value> =
            serde_json::from_str(&stdout).unwrap_or_default();

        for entry in route_entries {
            let dest_prefix = entry["DestinationPrefix"].as_str().unwrap_or("0.0.0.0/0");
            let parts: Vec<&str> = dest_prefix.split('/').collect();
            let destination = parts[0].to_string();
            let prefix_len: u8 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            let netmask = Self::prefix_to_netmask_windows(prefix_len);

            let next_hop = entry["NextHop"].as_str().unwrap_or("").to_string();
            let interface = entry["InterfaceAlias"].as_str().unwrap_or("").to_string();

            let metric = entry["RouteMetric"]
                .as_i64()
                .or_else(|| entry["InterfaceMetric"].as_i64())
                .map(|m| m as u32);

            let is_default = destination == "0.0.0.0" && prefix_len == 0;

            let gateway = if next_hop.is_empty() || next_hop == "0.0.0.0" {
                None
            } else {
                Some(next_hop)
            };

            let mut flags = vec!["U".to_string()];
            if gateway.is_some() {
                flags.push("G".to_string());
            }

            routes.push(RouteEntry {
                destination,
                gateway,
                netmask,
                interface,
                metric,
                flags,
                is_default,
            });
        }

        debug!("Collected {} routes on Windows", routes.len());
        Ok(routes)
    }

    #[cfg(target_os = "windows")]
    fn prefix_to_netmask_windows(prefix: u8) -> String {
        if prefix == 0 {
            return "0.0.0.0".to_string();
        }
        if prefix >= 32 {
            return "255.255.255.255".to_string();
        }
        let mask: u32 = !((1u32 << (32 - prefix)) - 1);
        format!(
            "{}.{}.{}.{}",
            (mask >> 24) & 0xff,
            (mask >> 16) & 0xff,
            (mask >> 8) & 0xff,
            mask & 0xff
        )
    }
}

impl Default for RouteCollector {
    fn default() -> Self {
        Self::new()
    }
}
