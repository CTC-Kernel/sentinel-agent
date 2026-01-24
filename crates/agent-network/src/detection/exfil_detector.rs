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
            if let Some(remote_port) = conn.remote_port {
                if remote_port == 53 && !matches!(conn.protocol, ConnectionProtocol::Udp) {
                    // TCP DNS could be legitimate but also used for tunneling
                    if let Some(ref remote_addr) = conn.remote_address {
                        if !self.is_known_dns_server(remote_addr) {
                            alerts.push(self.create_dns_tunnel_alert(conn));
                        }
                    }
                }

                // ICMP/unusual protocol usage would require raw socket monitoring
                // This is a simplified check

                // Large number of connections on ephemeral ports to same host
                // could indicate chunked data transfer
            }
        }

        alerts
    }

    fn is_private_ip(&self, ip: &str) -> bool {
        // Simple check for private IP ranges
        ip.starts_with("10.")
            || ip.starts_with("172.16.")
            || ip.starts_with("172.17.")
            || ip.starts_with("172.18.")
            || ip.starts_with("172.19.")
            || ip.starts_with("172.20.")
            || ip.starts_with("172.21.")
            || ip.starts_with("172.22.")
            || ip.starts_with("172.23.")
            || ip.starts_with("172.24.")
            || ip.starts_with("172.25.")
            || ip.starts_with("172.26.")
            || ip.starts_with("172.27.")
            || ip.starts_with("172.28.")
            || ip.starts_with("172.29.")
            || ip.starts_with("172.30.")
            || ip.starts_with("172.31.")
            || ip.starts_with("192.168.")
            || ip == "127.0.0.1"
            || ip.starts_with("::1")
            || ip.starts_with("fe80:")
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
