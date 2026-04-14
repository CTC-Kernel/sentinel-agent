// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Data exfiltration detector.
//!
//! Detects potential data exfiltration patterns:
//! - Multiple connections to same destination
//! - Unusual protocols for data transfer
//! - High volume outbound connections

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionProtocol, ConnectionState, NetworkAlertType, NetworkConnection,
    NetworkSecurityAlert,
};
use chrono::Utc;
use serde_json::json;
use std::collections::HashMap;

/// Threshold for connections to same destination to flag as suspicious.
const CONNECTIONS_THRESHOLD: usize = 10;

/// Detector for data exfiltration patterns.
pub struct ExfilDetector {
    _rules: DetectionRules,
}

impl ExfilDetector {
    /// Create a new exfiltration detector with rules.
    pub fn new(rules: &DetectionRules) -> Self {
        Self {
            _rules: rules.clone(),
        }
    }

    /// Detect potential data exfiltration in connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        // Analyze connection patterns
        alerts.extend(self.detect_multiple_connections(connections));
        alerts.extend(self.detect_unusual_protocols(connections));

        alerts
    }

    /// Detect multiple connections to the same destination (potential staged exfil).
    fn detect_multiple_connections(
        &self,
        connections: &[NetworkConnection],
    ) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();
        let mut dest_counts: HashMap<String, Vec<&NetworkConnection>> = HashMap::new();

        // Count connections per destination
        for conn in connections {
            if conn.state != ConnectionState::Established {
                continue;
            }
            if let Some(ref remote_addr) = conn.remote_address {
                // Skip private/internal IPs
                if self.is_private_ip(remote_addr) {
                    continue;
                }
                dest_counts
                    .entry(remote_addr.clone())
                    .or_default()
                    .push(conn);
            }
        }

        // Flag destinations with many connections
        for (dest, conns) in dest_counts {
            if conns.len() >= CONNECTIONS_THRESHOLD {
                alerts.push(self.create_multiple_connections_alert(&dest, &conns));
            }
        }

        alerts
    }

    /// Detect unusual protocols that might be used for exfiltration.
    fn detect_unusual_protocols(
        &self,
        connections: &[NetworkConnection],
    ) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        for conn in connections {
            if conn.state != ConnectionState::Established {
                continue;
            }

            // DNS over non-standard ports (potential DNS tunneling)
            if let Some(remote_port) = conn.remote_port
                && remote_port == 53
                && !matches!(conn.protocol, ConnectionProtocol::Udp)
                && let Some(ref remote_addr) = conn.remote_address
                && !self.is_known_dns_server(remote_addr)
            {
                // TCP DNS could be legitimate but also used for tunneling
                alerts.push(self.create_dns_tunnel_alert(conn));
            }
        }

        alerts
    }

    fn is_private_ip(&self, ip: &str) -> bool {
        // Try to parse as a proper IP address for accurate matching
        if let Ok(addr) = ip.parse::<std::net::IpAddr>() {
            return match addr {
                std::net::IpAddr::V4(v4) => {
                    v4.is_loopback()            // 127.0.0.0/8
                        || v4.is_private()       // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                        || v4.is_link_local()    // 169.254.0.0/16
                        || v4.is_unspecified() // 0.0.0.0
                }
                std::net::IpAddr::V6(v6) => {
                    v6.is_loopback()             // ::1
                        || v6.is_unspecified()   // ::
                        || {
                            let segments = v6.segments();
                            // fe80::/10 (link-local)
                            (segments[0] & 0xffc0) == 0xfe80
                            // fc00::/7 (unique local)
                            || (segments[0] & 0xfe00) == 0xfc00
                            // ::ffff:0:0/96 (IPv4-mapped) — check the embedded IPv4
                            || (segments[0..5] == [0, 0, 0, 0, 0]
                                && segments[5] == 0xffff
                                && {
                                    let v4 = std::net::Ipv4Addr::new(
                                        (segments[6] >> 8) as u8,
                                        segments[6] as u8,
                                        (segments[7] >> 8) as u8,
                                        segments[7] as u8,
                                    );
                                    v4.is_loopback() || v4.is_private() || v4.is_link_local()
                                })
                        }
                }
            };
        }

        // Fallback: string-based check if parsing fails (e.g., scoped IPv6 with %iface)
        ip.starts_with("10.")
            || ip.starts_with("192.168.")
            || ip.starts_with("172.") && {
                ip.split('.')
                    .nth(1)
                    .and_then(|s| s.parse::<u8>().ok())
                    .is_some_and(|second| (16..=31).contains(&second))
            }
            || ip == "127.0.0.1"
            || ip.starts_with("::1")
            || ip.starts_with("fe80:")
            || ip.starts_with("fc00:")
            || ip.starts_with("fd00:")
    }

    fn is_known_dns_server(&self, ip: &str) -> bool {
        // Common public DNS servers
        matches!(
            ip,
            "8.8.8.8"
                | "8.8.4.4"
                | "1.1.1.1"
                | "1.0.0.1"
                | "9.9.9.9"
                | "208.67.222.222"
                | "208.67.220.220"
        )
    }

    fn create_multiple_connections_alert(
        &self,
        destination: &str,
        connections: &[&NetworkConnection],
    ) -> NetworkSecurityAlert {
        let processes: Vec<_> = connections
            .iter()
            .filter_map(|c| c.process_name.as_ref())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let ports: Vec<_> = connections
            .iter()
            .filter_map(|c| c.remote_port)
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::DataExfiltration,
            severity: AlertSeverity::Medium,
            title: format!(
                "Multiple connections to single destination: {}",
                destination
            ),
            description: format!(
                "Detected {} simultaneous connections to external IP {}. \
                This pattern may indicate data exfiltration or tunneling. \
                Processes involved: {:?}. Ports: {:?}",
                connections.len(),
                destination,
                processes,
                ports
            ),
            connection: connections.first().map(|c| (*c).clone()),
            evidence: json!({
                "destination": destination,
                "connection_count": connections.len(),
                "processes": processes,
                "ports": ports,
                "detection_reason": "multiple_connections"
            }),
            confidence: 50,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("multi_conn:{}", destination)],
        }
    }

    fn create_dns_tunnel_alert(&self, conn: &NetworkConnection) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type: NetworkAlertType::DnsTunneling,
            severity: AlertSeverity::Medium,
            title: "Potential DNS tunneling detected".to_string(),
            description: format!(
                "TCP connection to non-standard DNS server {} on port 53. \
                This could indicate DNS tunneling for data exfiltration. Process: {}",
                conn.remote_address.as_deref().unwrap_or("unknown"),
                conn.process_name.as_deref().unwrap_or("unknown")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "remote_address": conn.remote_address,
                "protocol": format!("{:?}", conn.protocol),
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "detection_reason": "dns_tunneling"
            }),
            confidence: 60,
            detected_at: Utc::now(),
            iocs_matched: vec!["dns_tunnel".to_string()],
        }
    }
}
