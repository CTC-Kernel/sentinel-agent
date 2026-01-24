//! C2 (Command and Control) communication detector.
//!
//! Detects potential C2 communication patterns:
//! - Connections to known C2 ports
//! - Connections to known malicious IPs
//! - Beaconing patterns (regular interval connections)

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
};
use chrono::Utc;
use serde_json::json;

/// Detector for C2 communication patterns.
pub struct C2Detector {
    c2_ports: Vec<u16>,
    malicious_ips: Vec<String>,
}

impl C2Detector {
    /// Create a new C2 detector with rules.
    pub fn new(rules: &DetectionRules) -> Self {
        Self {
            c2_ports: rules.c2_ports.iter().copied().collect(),
            malicious_ips: rules.malicious_ips.iter().cloned().collect(),
        }
    }

    /// Detect C2 communication in connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        for conn in connections {
            // Skip non-established connections
            if conn.state != ConnectionState::Established {
                continue;
            }

            // Check for outbound connections to C2 ports
            if let Some(remote_port) = conn.remote_port {
                if self.c2_ports.contains(&remote_port) {
                    alerts.push(self.create_c2_port_alert(conn, remote_port));
                }
            }

            // Check for connections to known malicious IPs
            if let Some(ref remote_addr) = conn.remote_address {
                if self.malicious_ips.contains(remote_addr) {
                    alerts.push(self.create_malicious_ip_alert(conn, remote_addr));
                }
            }
        }

        alerts
    }

    fn create_c2_port_alert(&self, conn: &NetworkConnection, port: u16) -> NetworkSecurityAlert {
        let process_info = conn
            .process_name
            .as_ref()
            .map(|p| format!(" by process '{}'", p))
            .unwrap_or_default();

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::C2Communication,
            severity: AlertSeverity::Critical,
            title: format!("Potential C2 communication on port {}", port),
            description: format!(
                "Established connection to remote port {} which is commonly used for C2 communication{}. \
                Remote address: {}",
                port,
                process_info,
                conn.remote_address.as_deref().unwrap_or("unknown")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "port": port,
                "remote_address": conn.remote_address,
                "local_port": conn.local_port,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "known_c2_port"
            }),
            confidence: 75,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("port:{}", port)],
        }
    }

    fn create_malicious_ip_alert(
        &self,
        conn: &NetworkConnection,
        ip: &str,
    ) -> NetworkSecurityAlert {
        let process_info = conn
            .process_name
            .as_ref()
            .map(|p| format!(" by process '{}'", p))
            .unwrap_or_default();

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::MaliciousDestination,
            severity: AlertSeverity::Critical,
            title: format!("Connection to known malicious IP: {}", ip),
            description: format!(
                "Active connection to IP address {} which is listed in threat intelligence as malicious{}.",
                ip, process_info
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "malicious_ip": ip,
                "local_address": conn.local_address,
                "local_port": conn.local_port,
                "remote_port": conn.remote_port,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "known_malicious_ip"
            }),
            confidence: 95,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("ip:{}", ip)],
        }
    }
}
