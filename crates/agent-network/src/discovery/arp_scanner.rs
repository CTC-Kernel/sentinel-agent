//! ARP table scanner.
//!
//! Parses the system ARP table to discover devices on the local network
//! without requiring any special privileges.

use crate::error::{NetworkError, NetworkResult};
use tokio::process::Command;
use tracing::debug;

/// An entry parsed from the system ARP table.
#[derive(Debug, Clone)]
pub struct ArpEntry {
    /// IP address.
    pub ip: String,
    /// MAC address (if resolved).
    pub mac: Option<String>,
    /// Network interface name.
    pub interface: Option<String>,
    /// Whether this is a permanent/static entry.
    pub is_permanent: bool,
}

/// Scans the system ARP table for known neighbours.
pub struct ArpScanner;

impl ArpScanner {
    /// Parse the system ARP table and return all entries.
    pub async fn scan() -> NetworkResult<Vec<ArpEntry>> {
        let output = Command::new("arp")
            .arg("-a")
            .output()
            .await
            .map_err(|e| NetworkError::CommandFailed(format!("arp -a failed: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NetworkError::CommandFailed(format!(
                "arp -a returned non-zero: {}",
                stderr
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let entries = Self::parse_arp_output(&stdout);

        debug!("ARP scan found {} entries", entries.len());
        Ok(entries)
    }

    /// Parse `arp -a` output (supports macOS and Linux formats).
    fn parse_arp_output(output: &str) -> Vec<ArpEntry> {
        let mut entries = Vec::new();

        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Try macOS format first:
            //   ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
            //   ? (192.168.1.5) at (incomplete) on en0 ifscope [ethernet]
            // Then Linux format:
            //   ? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
            //   ? (192.168.1.5) at <incomplete> on eth0
            if let Some(entry) = Self::parse_line(line) {
                entries.push(entry);
            }
        }

        entries
    }

    fn parse_line(line: &str) -> Option<ArpEntry> {
        // Both formats contain "(ip) at mac_or_incomplete"
        let ip_start = line.find('(')?;
        let ip_end = line.find(')')?;
        if ip_start >= ip_end {
            return None;
        }
        let ip = line[ip_start + 1..ip_end].to_string();

        // Skip non-IP entries
        if ip.parse::<std::net::Ipv4Addr>().is_err() {
            return None;
        }

        let after_ip = &line[ip_end + 1..];

        // Find " at "
        let at_idx = after_ip.find(" at ")?;
        let after_at = after_ip[at_idx + 4..].trim();

        // Check for incomplete entries
        let is_incomplete = after_at.starts_with("(incomplete)")
            || after_at.starts_with("<incomplete>");

        let mac = if is_incomplete {
            None
        } else {
            // MAC is the next token (e.g., "aa:bb:cc:dd:ee:ff")
            let mac_str = after_at.split_whitespace().next()?;
            // Validate it looks like a MAC address
            if mac_str.contains(':') && mac_str.len() >= 11 {
                Some(mac_str.to_uppercase())
            } else {
                None
            }
        };

        // Extract interface — look for " on <iface>"
        let interface = after_at
            .find(" on ")
            .map(|idx| {
                let iface_part = &after_at[idx + 4..];
                iface_part
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string()
            })
            .filter(|s| !s.is_empty());

        // Check for permanent flag
        let is_permanent = after_at.contains("permanent")
            || after_at.contains("PERM")
            || after_at.contains("static");

        Some(ArpEntry {
            ip,
            mac,
            interface,
            is_permanent,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_macos_arp_output() {
        let output = r#"
? (192.168.1.1) at 0:1a:2b:3c:4d:5e on en0 ifscope [ethernet]
? (192.168.1.50) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
? (192.168.1.100) at (incomplete) on en0 ifscope [ethernet]
? (192.168.1.254) at 11:22:33:44:55:66 on en0 ifscope permanent [ethernet]
"#;
        let entries = ArpScanner::parse_arp_output(output);
        assert_eq!(entries.len(), 4);

        assert_eq!(entries[0].ip, "192.168.1.1");
        assert_eq!(
            entries[0].mac.as_deref(),
            Some("0:1A:2B:3C:4D:5E")
        );
        assert_eq!(entries[0].interface.as_deref(), Some("en0"));
        assert!(!entries[0].is_permanent);

        assert_eq!(entries[1].ip, "192.168.1.50");
        assert!(entries[1].mac.is_some());

        // Incomplete entry
        assert_eq!(entries[2].ip, "192.168.1.100");
        assert!(entries[2].mac.is_none());

        // Permanent entry
        assert_eq!(entries[3].ip, "192.168.1.254");
        assert!(entries[3].is_permanent);
    }

    #[test]
    fn test_parse_linux_arp_output() {
        let output = r#"
? (10.0.0.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
? (10.0.0.5) at <incomplete> on eth0
? (10.0.0.10) at 11:22:33:44:55:66 [ether] PERM on eth0
"#;
        let entries = ArpScanner::parse_arp_output(output);
        assert_eq!(entries.len(), 3);

        assert_eq!(entries[0].ip, "10.0.0.1");
        assert_eq!(
            entries[0].mac.as_deref(),
            Some("AA:BB:CC:DD:EE:FF")
        );
        assert_eq!(entries[0].interface.as_deref(), Some("eth0"));

        // Incomplete
        assert_eq!(entries[1].ip, "10.0.0.5");
        assert!(entries[1].mac.is_none());

        // Permanent
        assert!(entries[2].is_permanent);
    }

    #[test]
    fn test_parse_empty_output() {
        let entries = ArpScanner::parse_arp_output("");
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_garbage_input() {
        let entries = ArpScanner::parse_arp_output("not a valid arp line\nrandom garbage");
        assert!(entries.is_empty());
    }
}
