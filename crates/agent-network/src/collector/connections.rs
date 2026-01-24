//! Network connections collector.
//!
//! Collects active TCP/UDP connections with process information.

use crate::error::{NetworkError, NetworkResult};
use crate::types::{ConnectionProtocol, ConnectionState, NetworkConnection};
use std::process::Command;
use tracing::debug;

/// Collects active network connections.
pub struct ConnectionCollector;

impl ConnectionCollector {
    /// Create a new connection collector.
    pub fn new() -> Self {
        Self
    }

    /// Collect all active connections.
    pub async fn collect(&self) -> NetworkResult<Vec<NetworkConnection>> {
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
    async fn collect_linux(&self) -> NetworkResult<Vec<NetworkConnection>> {
        use std::collections::HashMap;
        use std::fs;

        let mut connections = Vec::new();

        // Build inode to PID/process mapping
        let inode_map = self.build_inode_map_linux();

        // Parse /proc/net/tcp
        if let Ok(content) = fs::read_to_string("/proc/net/tcp") {
            for line in content.lines().skip(1) {
                if let Some(conn) = self.parse_proc_net_line(line, ConnectionProtocol::Tcp, &inode_map) {
                    connections.push(conn);
                }
            }
        }

        // Parse /proc/net/tcp6
        if let Ok(content) = fs::read_to_string("/proc/net/tcp6") {
            for line in content.lines().skip(1) {
                if let Some(conn) = self.parse_proc_net_line(line, ConnectionProtocol::Tcp6, &inode_map) {
                    connections.push(conn);
                }
            }
        }

        // Parse /proc/net/udp
        if let Ok(content) = fs::read_to_string("/proc/net/udp") {
            for line in content.lines().skip(1) {
                if let Some(conn) = self.parse_proc_net_line(line, ConnectionProtocol::Udp, &inode_map) {
                    connections.push(conn);
                }
            }
        }

        // Parse /proc/net/udp6
        if let Ok(content) = fs::read_to_string("/proc/net/udp6") {
            for line in content.lines().skip(1) {
                if let Some(conn) = self.parse_proc_net_line(line, ConnectionProtocol::Udp6, &inode_map) {
                    connections.push(conn);
                }
            }
        }

        debug!("Collected {} network connections on Linux", connections.len());
        Ok(connections)
    }

    #[cfg(target_os = "linux")]
    fn build_inode_map_linux(&self) -> std::collections::HashMap<u64, (u32, String, Option<String>)> {
        use std::fs;

        let mut map = std::collections::HashMap::new();

        // Iterate through /proc/[pid]/fd to map inodes to processes
        if let Ok(entries) = fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if let Ok(pid) = name.parse::<u32>() {
                    let fd_path = entry.path().join("fd");
                    if let Ok(fds) = fs::read_dir(&fd_path) {
                        for fd in fds.flatten() {
                            if let Ok(link) = fs::read_link(fd.path()) {
                                let link_str = link.to_string_lossy();
                                if link_str.starts_with("socket:[") {
                                    if let Some(inode_str) = link_str
                                        .strip_prefix("socket:[")
                                        .and_then(|s| s.strip_suffix(']'))
                                    {
                                        if let Ok(inode) = inode_str.parse::<u64>() {
                                            // Get process name
                                            let comm = fs::read_to_string(entry.path().join("comm"))
                                                .map(|s| s.trim().to_string())
                                                .ok();
                                            // Get process path
                                            let exe = fs::read_link(entry.path().join("exe"))
                                                .map(|p| p.to_string_lossy().to_string())
                                                .ok();

                                            if let Some(name) = comm {
                                                map.insert(inode, (pid, name, exe));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        map
    }

    #[cfg(target_os = "linux")]
    fn parse_proc_net_line(
        &self,
        line: &str,
        protocol: ConnectionProtocol,
        inode_map: &std::collections::HashMap<u64, (u32, String, Option<String>)>,
    ) -> Option<NetworkConnection> {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 10 {
            return None;
        }

        // Parse local address:port
        let local = parts[1];
        let (local_address, local_port) = self.parse_hex_address(local, &protocol)?;

        // Parse remote address:port
        let remote = parts[2];
        let (remote_address, remote_port) = self.parse_hex_address(remote, &protocol)?;

        // Parse state
        let state_hex = parts[3];
        let state = self.parse_tcp_state(state_hex);

        // Parse inode
        let inode: u64 = parts[9].parse().ok()?;

        // Look up process info
        let (pid, process_name, process_path) = inode_map
            .get(&inode)
            .map(|(p, n, path)| (Some(*p), Some(n.clone()), path.clone()))
            .unwrap_or((None, None, None));

        // For remote, convert 0.0.0.0:0 to None
        let remote_address = if remote_address == "0.0.0.0" || remote_address == "::" {
            None
        } else {
            Some(remote_address)
        };
        let remote_port = if remote_port == 0 {
            None
        } else {
            Some(remote_port)
        };

        Some(NetworkConnection {
            protocol,
            local_address,
            local_port,
            remote_address,
            remote_port,
            state,
            pid,
            process_name,
            process_path,
        })
    }

    #[cfg(target_os = "linux")]
    fn parse_hex_address(&self, hex_str: &str, protocol: &ConnectionProtocol) -> Option<(String, u16)> {
        let parts: Vec<&str> = hex_str.split(':').collect();
        if parts.len() != 2 {
            return None;
        }

        let port = u16::from_str_radix(parts[1], 16).ok()?;

        let address = match protocol {
            ConnectionProtocol::Tcp | ConnectionProtocol::Udp => {
                // IPv4: reverse byte order
                let addr_hex = parts[0];
                if addr_hex.len() != 8 {
                    return None;
                }
                let addr_int = u32::from_str_radix(addr_hex, 16).ok()?;
                format!(
                    "{}.{}.{}.{}",
                    addr_int & 0xFF,
                    (addr_int >> 8) & 0xFF,
                    (addr_int >> 16) & 0xFF,
                    (addr_int >> 24) & 0xFF
                )
            }
            ConnectionProtocol::Tcp6 | ConnectionProtocol::Udp6 => {
                // IPv6: parse as 32 hex chars
                let addr_hex = parts[0];
                if addr_hex.len() != 32 {
                    return None;
                }
                // Parse as 4 groups of 4 bytes, reversed within each group
                let mut segments = Vec::new();
                for i in 0..4 {
                    let start = i * 8;
                    let group = &addr_hex[start..start + 8];
                    // Reverse byte order within group
                    let bytes: Vec<u8> = (0..4)
                        .map(|j| u8::from_str_radix(&group[j * 2..j * 2 + 2], 16).unwrap_or(0))
                        .collect();
                    segments.push(format!(
                        "{:02x}{:02x}:{:02x}{:02x}",
                        bytes[3], bytes[2], bytes[1], bytes[0]
                    ));
                }
                segments.join(":")
            }
        };

        Some((address, port))
    }

    #[cfg(target_os = "linux")]
    fn parse_tcp_state(&self, hex_state: &str) -> ConnectionState {
        match u8::from_str_radix(hex_state, 16).unwrap_or(0) {
            0x01 => ConnectionState::Established,
            0x02 => ConnectionState::SynSent,
            0x03 => ConnectionState::SynReceived,
            0x04 => ConnectionState::FinWait1,
            0x05 => ConnectionState::FinWait2,
            0x06 => ConnectionState::TimeWait,
            0x07 => ConnectionState::Closed,
            0x08 => ConnectionState::CloseWait,
            0x09 => ConnectionState::LastAck,
            0x0A => ConnectionState::Listen,
            0x0B => ConnectionState::Closing,
            _ => ConnectionState::Unknown,
        }
    }

    #[cfg(target_os = "macos")]
    async fn collect_macos(&self) -> NetworkResult<Vec<NetworkConnection>> {
        let mut connections = Vec::new();

        // Use lsof to get connections with process info
        let output = Command::new("lsof")
            .args(["-i", "-n", "-P"])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("lsof failed: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines().skip(1) {
            if let Some(conn) = self.parse_lsof_line(line) {
                connections.push(conn);
            }
        }

        debug!("Collected {} network connections on macOS", connections.len());
        Ok(connections)
    }

    #[cfg(target_os = "macos")]
    fn parse_lsof_line(&self, line: &str) -> Option<NetworkConnection> {
        // lsof output format:
        // COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
        // ssh      123 user   3u   IPv4 0x...   0t0  TCP 192.168.1.1:22->10.0.0.1:54321 (ESTABLISHED)

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            return None;
        }

        let process_name = Some(parts[0].to_string());
        let pid = parts[1].parse().ok();
        let type_col = parts[4];
        let name_col = parts.last()?;

        // Determine protocol
        let protocol = if type_col == "IPv4" {
            if name_col.contains("TCP") {
                ConnectionProtocol::Tcp
            } else {
                ConnectionProtocol::Udp
            }
        } else if type_col == "IPv6" {
            if name_col.contains("TCP") {
                ConnectionProtocol::Tcp6
            } else {
                ConnectionProtocol::Udp6
            }
        } else {
            return None;
        };

        // Parse connection string like "192.168.1.1:22->10.0.0.1:54321" or "*:22"
        let name_str = parts[8..].join(" ");
        let name_parts: Vec<&str> = name_str.split("->").collect();

        let local_str = name_parts.first()?.replace("TCP ", "").replace("UDP ", "");
        let (local_address, local_port) = self.parse_lsof_address(&local_str)?;

        let (remote_address, remote_port) = if name_parts.len() > 1 {
            let remote = name_parts[1].split_whitespace().next()?;
            let (addr, port) = self.parse_lsof_address(remote)?;
            (Some(addr), Some(port))
        } else {
            (None, None)
        };

        // Parse state from parentheses
        let state = if let Some(state_start) = line.rfind('(') {
            let state_str = &line[state_start + 1..line.len() - 1];
            match state_str {
                "ESTABLISHED" => ConnectionState::Established,
                "LISTEN" => ConnectionState::Listen,
                "TIME_WAIT" => ConnectionState::TimeWait,
                "CLOSE_WAIT" => ConnectionState::CloseWait,
                "SYN_SENT" => ConnectionState::SynSent,
                "SYN_RECEIVED" => ConnectionState::SynReceived,
                "FIN_WAIT_1" => ConnectionState::FinWait1,
                "FIN_WAIT_2" => ConnectionState::FinWait2,
                "CLOSING" => ConnectionState::Closing,
                "LAST_ACK" => ConnectionState::LastAck,
                "CLOSED" => ConnectionState::Closed,
                _ => ConnectionState::Unknown,
            }
        } else {
            ConnectionState::Unknown
        };

        Some(NetworkConnection {
            protocol,
            local_address,
            local_port,
            remote_address,
            remote_port,
            state,
            pid,
            process_name,
            process_path: None,
        })
    }

    #[cfg(target_os = "macos")]
    fn parse_lsof_address(&self, addr_str: &str) -> Option<(String, u16)> {
        // Handle formats like "192.168.1.1:22", "*:22", "[::1]:22"
        let addr_str = addr_str.trim();

        if addr_str.starts_with('[') {
            // IPv6 with brackets
            let end_bracket = addr_str.find(']')?;
            let addr = &addr_str[1..end_bracket];
            let port_str = addr_str.get(end_bracket + 2..)?;
            let port = port_str.parse().ok()?;
            Some((addr.to_string(), port))
        } else {
            // IPv4 or hostname
            let parts: Vec<&str> = addr_str.rsplitn(2, ':').collect();
            if parts.len() != 2 {
                return None;
            }
            let port = parts[0].parse().ok()?;
            let addr = if parts[1] == "*" {
                "0.0.0.0".to_string()
            } else {
                parts[1].to_string()
            };
            Some((addr, port))
        }
    }

    #[cfg(target_os = "windows")]
    async fn collect_windows(&self) -> NetworkResult<Vec<NetworkConnection>> {
        let mut connections = Vec::new();

        // Get TCP connections
        let tcp_output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-NetTCPConnection | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | ConvertTo-Json -Depth 2"#,
            ])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("PowerShell failed: {}", e)))?;

        let tcp_stdout = String::from_utf8_lossy(&tcp_output.stdout);
        let tcp_conns: Vec<serde_json::Value> = serde_json::from_str(&tcp_stdout).unwrap_or_default();

        for conn in tcp_conns {
            if let Some(nc) = self.parse_windows_tcp_connection(&conn) {
                connections.push(nc);
            }
        }

        // Get UDP endpoints
        let udp_output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                r#"Get-NetUDPEndpoint | Select-Object LocalAddress, LocalPort, OwningProcess | ConvertTo-Json -Depth 2"#,
            ])
            .output()
            .map_err(|e| NetworkError::CommandFailed(format!("PowerShell failed: {}", e)))?;

        let udp_stdout = String::from_utf8_lossy(&udp_output.stdout);
        let udp_endpoints: Vec<serde_json::Value> = serde_json::from_str(&udp_stdout).unwrap_or_default();

        for endpoint in udp_endpoints {
            if let Some(nc) = self.parse_windows_udp_endpoint(&endpoint) {
                connections.push(nc);
            }
        }

        debug!(
            "Collected {} network connections on Windows",
            connections.len()
        );
        Ok(connections)
    }

    #[cfg(target_os = "windows")]
    fn parse_windows_tcp_connection(&self, conn: &serde_json::Value) -> Option<NetworkConnection> {
        let local_address = conn["LocalAddress"].as_str()?.to_string();
        let local_port = conn["LocalPort"].as_i64()? as u16;
        let remote_address = conn["RemoteAddress"].as_str().map(String::from);
        let remote_port = conn["RemotePort"].as_i64().map(|p| p as u16);
        let pid = conn["OwningProcess"].as_i64().map(|p| p as u32);

        let state = match conn["State"].as_i64() {
            Some(1) => ConnectionState::Closed,
            Some(2) => ConnectionState::Listen,
            Some(3) => ConnectionState::SynSent,
            Some(4) => ConnectionState::SynReceived,
            Some(5) => ConnectionState::Established,
            Some(6) => ConnectionState::FinWait1,
            Some(7) => ConnectionState::FinWait2,
            Some(8) => ConnectionState::CloseWait,
            Some(9) => ConnectionState::Closing,
            Some(10) => ConnectionState::LastAck,
            Some(11) => ConnectionState::TimeWait,
            _ => ConnectionState::Unknown,
        };

        let protocol = if local_address.contains(':') {
            ConnectionProtocol::Tcp6
        } else {
            ConnectionProtocol::Tcp
        };

        // Get process name
        let process_name = pid.and_then(|p| self.get_process_name_windows(p));

        // Filter out 0.0.0.0 remote
        let remote_address = remote_address.filter(|a| a != "0.0.0.0" && a != "::");
        let remote_port = if remote_address.is_some() {
            remote_port
        } else {
            None
        };

        Some(NetworkConnection {
            protocol,
            local_address,
            local_port,
            remote_address,
            remote_port,
            state,
            pid,
            process_name,
            process_path: None,
        })
    }

    #[cfg(target_os = "windows")]
    fn parse_windows_udp_endpoint(&self, endpoint: &serde_json::Value) -> Option<NetworkConnection> {
        let local_address = endpoint["LocalAddress"].as_str()?.to_string();
        let local_port = endpoint["LocalPort"].as_i64()? as u16;
        let pid = endpoint["OwningProcess"].as_i64().map(|p| p as u32);

        let protocol = if local_address.contains(':') {
            ConnectionProtocol::Udp6
        } else {
            ConnectionProtocol::Udp
        };

        let process_name = pid.and_then(|p| self.get_process_name_windows(p));

        Some(NetworkConnection {
            protocol,
            local_address,
            local_port,
            remote_address: None,
            remote_port: None,
            state: ConnectionState::Listen,
            pid,
            process_name,
            process_path: None,
        })
    }

    #[cfg(target_os = "windows")]
    fn get_process_name_windows(&self, pid: u32) -> Option<String> {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("(Get-Process -Id {} -ErrorAction SilentlyContinue).ProcessName", pid),
            ])
            .output()
            .ok()?;

        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    }
}

impl Default for ConnectionCollector {
    fn default() -> Self {
        Self::new()
    }
}
