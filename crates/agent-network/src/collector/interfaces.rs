//! Network interface collector.
//!
//! Collects network interface information:
//! - Interface names
//! - MAC addresses
//! - IPv4/IPv6 addresses
//! - Link status and speed
//! - Interface type (Ethernet, WiFi, VPN, etc.)

use crate::error::{NetworkError, NetworkResult};
use crate::types::{InterfaceStatus, InterfaceType, NetworkInterface};
use std::process::Command;
use tracing::debug;

/// Collects network interface information.
pub struct InterfaceCollector;

impl InterfaceCollector {
    /// Create a new interface collector.
    pub fn new() -> Self {
        Self
    }

    /// Collect all network interfaces.
    pub async fn collect(&self) -> NetworkResult<Vec<NetworkInterface>> {
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
    async fn collect_linux(&self) -> NetworkResult<Vec<NetworkInterface>> {
        use std::fs;
        use std::path::Path;

        let mut interfaces = Vec::new();
        let net_path = Path::new("/sys/class/net");

        if !net_path.exists() {
            return Err(NetworkError::InterfaceCollection(
                "/sys/class/net not found".to_string(),
            ));
        }

        let entries = fs::read_dir(net_path).map_err(|e| {
            NetworkError::InterfaceCollection(format!("Failed to read /sys/class/net: {}", e))
        })?;

        for entry in entries.flatten() {
            let iface_name = entry.file_name().to_string_lossy().to_string();
            let iface_path = entry.path();

            // Read MAC address
            let mac_address = fs::read_to_string(iface_path.join("address"))
                .ok()
                .map(|s| s.trim().to_uppercase())
                .filter(|s| s != "00:00:00:00:00:00");

            // Read operstate for status
            let status = fs::read_to_string(iface_path.join("operstate"))
                .map(|s| match s.trim() {
                    "up" => InterfaceStatus::Up,
                    "down" => InterfaceStatus::Down,
                    _ => InterfaceStatus::Unknown,
                })
                .unwrap_or(InterfaceStatus::Unknown);

            // Read speed (may not exist for all interfaces)
            let speed_mbps = fs::read_to_string(iface_path.join("speed"))
                .ok()
                .and_then(|s| s.trim().parse().ok())
                .filter(|&s: &i32| s > 0)
                .map(|s| s as u32);

            // Read MTU
            let mtu = fs::read_to_string(iface_path.join("mtu"))
                .ok()
                .and_then(|s| s.trim().parse().ok());

            // Determine interface type
            let interface_type = self.detect_interface_type_linux(&iface_name, &iface_path);

            // Check if virtual
            let is_virtual = iface_name == "lo"
                || iface_name.starts_with("veth")
                || iface_name.starts_with("docker")
                || iface_name.starts_with("br-")
                || iface_name.starts_with("virbr");

            // Get IP addresses using ip command
            let (ipv4_addresses, ipv6_addresses) = self.get_ip_addresses_linux(&iface_name);

            interfaces.push(NetworkInterface {
                name: iface_name,
                mac_address,
                ipv4_addresses,
                ipv6_addresses,
                status,
                speed_mbps,
                mtu,
                is_virtual,
                interface_type,
            });
        }

        debug!("Collected {} network interfaces on Linux", interfaces.len());
        Ok(interfaces)
    }

    #[cfg(target_os = "linux")]
    fn detect_interface_type_linux(&self, name: &str, path: &std::path::Path) -> InterfaceType {
        use std::fs;

        if name == "lo" {
            return InterfaceType::Loopback;
        }

        // Check for wireless
        if path.join("wireless").exists() || name.starts_with("wl") {
            return InterfaceType::WiFi;
        }

        // Check for bridge
        if path.join("bridge").exists() || name.starts_with("br") {
            return InterfaceType::Bridge;
        }

        // Check for virtual interfaces
        if name.starts_with("veth")
            || name.starts_with("docker")
            || name.starts_with("virbr")
            || name.starts_with("vnet")
        {
            return InterfaceType::Virtual;
        }

        // Check for VPN interfaces
        if name.starts_with("tun") || name.starts_with("tap") || name.starts_with("wg") {
            return InterfaceType::Vpn;
        }

        // Check device type
        if let Ok(uevent) = fs::read_to_string(path.join("device/uevent"))
            && uevent.contains("DEVTYPE=wlan")
        {
            return InterfaceType::WiFi;
        }

        // Default to Ethernet for physical interfaces
        if name.starts_with("eth") || name.starts_with("en") || name.starts_with("eno") {
            return InterfaceType::Ethernet;
        }

        InterfaceType::Unknown
    }

    #[cfg(target_os = "linux")]
    fn get_ip_addresses_linux(&self, iface_name: &str) -> (Vec<String>, Vec<String>) {
        let mut ipv4 = Vec::new();
        let mut ipv6 = Vec::new();

        // Use ip addr show to get addresses
        if let Ok(output) = Command::new("ip")
            .args(["addr", "show", "dev", iface_name])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let line = line.trim();
                if line.starts_with("inet ") {
                    // IPv4: inet 192.168.1.100/24 brd ...
                    if let Some(addr) = line.split_whitespace().nth(1) {
                        // Remove CIDR notation
                        let ip = addr.split('/').next().unwrap_or(addr);
                        ipv4.push(ip.to_string());
                    }
                } else if line.starts_with("inet6 ") {
                    // IPv6: inet6 fe80::1/64 scope link
                    if let Some(addr) = line.split_whitespace().nth(1) {
                        let ip = addr.split('/').next().unwrap_or(addr);
                        // Skip link-local addresses starting with fe80
                        if !ip.starts_with("fe80") {
                            ipv6.push(ip.to_string());
                        }
                    }
                }
            }
        }

        (ipv4, ipv6)
    }

    #[cfg(target_os = "macos")]
    async fn collect_macos(&self) -> NetworkResult<Vec<NetworkInterface>> {
        let mut interfaces = Vec::new();

        // Use ifconfig to get interface info
        let output = Command::new("ifconfig")
            .arg("-a")
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("ifconfig failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut current_iface: Option<NetworkInterface> = None;

        for line in stdout.lines() {
            if !line.starts_with('\t') && !line.starts_with(' ') && line.contains(':') {
                // New interface line
                if let Some(iface) = current_iface.take() {
                    interfaces.push(iface);
                }

                let name = line.split(':').next().unwrap_or("").to_string();
                let is_virtual = name == "lo0"
                    || name.starts_with("bridge")
                    || name.starts_with("utun")
                    || name.starts_with("awdl");

                let interface_type = self.detect_interface_type_macos(&name);

                current_iface = Some(NetworkInterface {
                    name,
                    mac_address: None,
                    ipv4_addresses: Vec::new(),
                    ipv6_addresses: Vec::new(),
                    status: InterfaceStatus::Unknown,
                    speed_mbps: None,
                    mtu: None,
                    is_virtual,
                    interface_type,
                });
            } else if let Some(ref mut iface) = current_iface {
                let line = line.trim();

                if line.starts_with("ether ") {
                    iface.mac_address =
                        line.strip_prefix("ether ").map(|s| s.trim().to_uppercase());
                } else if line.starts_with("inet ") {
                    // inet 192.168.1.100 netmask ...
                    if let Some(addr) = line.split_whitespace().nth(1) {
                        iface.ipv4_addresses.push(addr.to_string());
                    }
                } else if line.starts_with("inet6 ") {
                    if let Some(addr) = line.split_whitespace().nth(1) {
                        // Skip link-local
                        if !addr.starts_with("fe80") {
                            // Remove %interface suffix
                            let ip = addr.split('%').next().unwrap_or(addr);
                            iface.ipv6_addresses.push(ip.to_string());
                        }
                    }
                } else if line.starts_with("status: ") {
                    iface.status = if line.contains("active") {
                        InterfaceStatus::Up
                    } else {
                        InterfaceStatus::Down
                    };
                } else if line.starts_with("mtu ") {
                    iface.mtu = line
                        .strip_prefix("mtu ")
                        .and_then(|s| s.split_whitespace().next())
                        .and_then(|s| s.parse().ok());
                }
            }
        }

        if let Some(iface) = current_iface {
            interfaces.push(iface);
        }

        debug!("Collected {} network interfaces on macOS", interfaces.len());
        Ok(interfaces)
    }

    #[cfg(target_os = "macos")]
    fn detect_interface_type_macos(&self, name: &str) -> InterfaceType {
        if name == "lo0" {
            InterfaceType::Loopback
        } else if name.starts_with("en") {
            // en0 is usually WiFi on MacBooks, en1+ can be Ethernet
            // We'd need to query more to be sure
            InterfaceType::Ethernet
        } else if name.starts_with("bridge") {
            InterfaceType::Bridge
        } else if name.starts_with("utun") || name.starts_with("ipsec") {
            InterfaceType::Vpn
        } else if name.starts_with("awdl") || name.starts_with("llw") {
            InterfaceType::Virtual
        } else {
            InterfaceType::Unknown
        }
    }

    #[cfg(target_os = "windows")]
    async fn collect_windows(&self) -> NetworkResult<Vec<NetworkInterface>> {
        let mut interfaces = Vec::new();

        // Use PowerShell to get network adapter info
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-NetAdapter | Select-Object Name, InterfaceDescription, MacAddress, Status, LinkSpeed, ifIndex | ConvertTo-Json -Depth 2"#,
            ])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("PowerShell failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse JSON output
        let adapters: Vec<serde_json::Value> = serde_json::from_str(&stdout).unwrap_or_default();

        for adapter in adapters {
            let name = adapter["Name"].as_str().unwrap_or("").to_string();
            let description = adapter["InterfaceDescription"]
                .as_str()
                .unwrap_or("")
                .to_lowercase();

            let mac_address = adapter["MacAddress"]
                .as_str()
                .map(|s| s.replace('-', ":").to_uppercase());

            let status = match adapter["Status"].as_str() {
                Some("Up") => InterfaceStatus::Up,
                Some("Down") | Some("Disconnected") => InterfaceStatus::Down,
                _ => InterfaceStatus::Unknown,
            };

            let speed_mbps = adapter["LinkSpeed"]
                .as_str()
                .and_then(|s| self.parse_link_speed(s));

            let if_index = adapter["ifIndex"].as_i64().map(|i| i as u32);

            // Get IP addresses for this interface
            let (ipv4_addresses, ipv6_addresses) = if let Some(idx) = if_index {
                self.get_ip_addresses_windows(idx)
            } else {
                (Vec::new(), Vec::new())
            };

            let interface_type = self.detect_interface_type_windows(&description);
            let is_virtual = description.contains("virtual")
                || description.contains("loopback")
                || description.contains("hyper-v");

            interfaces.push(NetworkInterface {
                name,
                mac_address,
                ipv4_addresses,
                ipv6_addresses,
                status,
                speed_mbps,
                mtu: None,
                is_virtual,
                interface_type,
            });
        }

        debug!(
            "Collected {} network interfaces on Windows",
            interfaces.len()
        );
        Ok(interfaces)
    }

    #[cfg(target_os = "windows")]
    fn parse_link_speed(&self, speed_str: &str) -> Option<u32> {
        // Parse speeds like "1 Gbps", "100 Mbps"
        let parts: Vec<&str> = speed_str.split_whitespace().collect();
        if parts.len() >= 2 {
            let value: f64 = parts[0].parse().ok()?;
            let unit = parts[1].to_lowercase();
            match unit.as_str() {
                "gbps" => Some((value * 1000.0) as u32),
                "mbps" => Some(value as u32),
                _ => None,
            }
        } else {
            None
        }
    }

    #[cfg(target_os = "windows")]
    fn get_ip_addresses_windows(&self, if_index: u32) -> (Vec<String>, Vec<String>) {
        let mut ipv4 = Vec::new();
        let mut ipv6 = Vec::new();

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    r#"Get-NetIPAddress -InterfaceIndex {} | Select-Object IPAddress, AddressFamily | ConvertTo-Json"#,
                    if_index
                ),
            ])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let addresses: Vec<serde_json::Value> =
                serde_json::from_str(&stdout).unwrap_or_default();

            for addr in addresses {
                let ip = addr["IPAddress"].as_str().unwrap_or("");
                let family = addr["AddressFamily"].as_i64().unwrap_or(0);

                match family {
                    2 => ipv4.push(ip.to_string()), // IPv4
                    23 => {
                        // IPv6 - skip link-local
                        if !ip.starts_with("fe80") {
                            ipv6.push(ip.to_string());
                        }
                    }
                    _ => {}
                }
            }
        }

        (ipv4, ipv6)
    }

    #[cfg(target_os = "windows")]
    fn detect_interface_type_windows(&self, description: &str) -> InterfaceType {
        let desc = description.to_lowercase();
        if desc.contains("loopback") {
            InterfaceType::Loopback
        } else if desc.contains("wi-fi") || desc.contains("wireless") || desc.contains("wlan") {
            InterfaceType::WiFi
        } else if desc.contains("vpn") || desc.contains("tap") || desc.contains("tun") {
            InterfaceType::Vpn
        } else if desc.contains("virtual") || desc.contains("hyper-v") {
            InterfaceType::Virtual
        } else if desc.contains("ethernet") || desc.contains("realtek") || desc.contains("intel") {
            InterfaceType::Ethernet
        } else {
            InterfaceType::Unknown
        }
    }
}

impl Default for InterfaceCollector {
    fn default() -> Self {
        Self::new()
    }
}
