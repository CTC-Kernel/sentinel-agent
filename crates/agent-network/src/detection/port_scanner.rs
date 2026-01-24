//! Suspicious port scanner.
//!
//! Detects connections on suspicious ports:
//! - IRC ports (botnet C2)
//! - Tor network ports (anonymization)
//! - Remote access ports from unusual sources

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
};
use chrono::Utc;
use serde_json::json;

/// Detector for suspicious port usage.
pub struct PortScanner {
    tor_ports: Vec<u16>,
    irc_ports: Vec<u16>,
    suspicious_ports: Vec<u16>,
}

impl PortScanner {
    /// Create a new port scanner with rules.
    pub fn new(rules: &DetectionRules) -> Self {
        Self {
            tor_ports: rules.tor_ports.iter().copied().collect(),
            irc_ports: rules.irc_ports.iter().copied().collect(),
            suspicious_ports: rules.suspicious_ports.iter().copied().collect(),
        }
    }

    /// Detect suspicious port usage in connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        for conn in connections {
            // Check both established and listening connections
            if !matches!(
                conn.state,
                ConnectionState::Established | ConnectionState::Listen
            ) {
                continue;
            }

            if let Some(remote_port) = conn.remote_port {
                // Check for Tor usage
                if self.tor_ports.contains(&remote_port) {
                    alerts.push(self.create_tor_alert(conn, remote_port));
                    continue;
                }

                // Check for IRC (potential botnet)
                if self.irc_ports.contains(&remote_port) {
                    alerts.push(self.create_irc_alert(conn, remote_port));
                    continue;
                }
            }

            // Check for suspicious outbound connections
            if conn.state == ConnectionState::Established
                && let Some(remote_port) = conn.remote_port
                && self.suspicious_ports.contains(&remote_port)
            {
                alerts.push(self.create_suspicious_outbound_alert(conn, remote_port));
            }

            // Check for suspicious listening ports (backdoors)
            if conn.state == ConnectionState::Listen
                && self.is_suspicious_listening_port(conn.local_port)
            {
                alerts.push(self.create_suspicious_listening_alert(conn));
            }
        }

        alerts
    }

    fn is_suspicious_listening_port(&self, port: u16) -> bool {
        // Common backdoor/RAT listening ports
        matches!(
            port,
            4444 | 5555 | 6666 | 7777 | 8888 | 9999 | 1337 | 31337 | 12345 | 65535
        )
    }

    fn create_tor_alert(&self, conn: &NetworkConnection, port: u16) -> NetworkSecurityAlert {
        let port_desc = match port {
            9001 => "Tor OR port",
            9030 => "Tor directory port",
            9050 => "Tor SOCKS proxy",
            9051 => "Tor control port",
            9150 => "Tor Browser SOCKS",
            _ => "Tor network port",
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::AnonymizationNetwork,
            severity: AlertSeverity::Medium,
            title: format!("Tor network connection detected ({})", port_desc),
            description: format!(
                "Connection to {} on port {} ({}). \
                Tor usage may indicate attempt to anonymize traffic or access dark web. Process: {}",
                conn.remote_address.as_deref().unwrap_or("unknown"),
                port,
                port_desc,
                conn.process_name.as_deref().unwrap_or("unknown")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "port": port,
                "port_description": port_desc,
                "remote_address": conn.remote_address,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "detection_reason": "tor_port"
            }),
            confidence: 80,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("tor_port:{}", port)],
        }
    }

    fn create_irc_alert(&self, conn: &NetworkConnection, port: u16) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type: NetworkAlertType::SuspiciousPort,
            severity: AlertSeverity::Medium,
            title: format!("IRC connection detected on port {}", port),
            description: format!(
                "Connection to IRC port {} at {}. \
                IRC is commonly used by botnets for command and control. Process: {}",
                port,
                conn.remote_address.as_deref().unwrap_or("unknown"),
                conn.process_name.as_deref().unwrap_or("unknown")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "port": port,
                "remote_address": conn.remote_address,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "detection_reason": "irc_port"
            }),
            confidence: 70,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("irc_port:{}", port)],
        }
    }

    fn create_suspicious_outbound_alert(
        &self,
        conn: &NetworkConnection,
        port: u16,
    ) -> NetworkSecurityAlert {
        let port_desc = match port {
            22 => "SSH - unusual outbound from workstation",
            23 => "Telnet - insecure protocol",
            3389 => "RDP - potential lateral movement",
            5900..=5902 => "VNC - remote desktop",
            _ => "suspicious port",
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::SuspiciousPort,
            severity: AlertSeverity::Low,
            title: format!("Suspicious outbound connection on port {}", port),
            description: format!(
                "Outbound connection to {}:{} ({}). \
                This type of outbound connection may warrant investigation. Process: {}",
                conn.remote_address.as_deref().unwrap_or("unknown"),
                port,
                port_desc,
                conn.process_name.as_deref().unwrap_or("unknown")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "port": port,
                "port_description": port_desc,
                "remote_address": conn.remote_address,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "detection_reason": "suspicious_outbound"
            }),
            confidence: 40,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("suspicious_port:{}", port)],
        }
    }

    fn create_suspicious_listening_alert(&self, conn: &NetworkConnection) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type: NetworkAlertType::SuspiciousPort,
            severity: AlertSeverity::High,
            title: format!("Suspicious listening port detected: {}", conn.local_port),
            description: format!(
                "Process '{}' is listening on port {} which is commonly associated with backdoors or RATs. \
                Verify this is a legitimate service.",
                conn.process_name.as_deref().unwrap_or("unknown"),
                conn.local_port
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "local_port": conn.local_port,
                "local_address": conn.local_address,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "suspicious_listening"
            }),
            confidence: 65,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("backdoor_port:{}", conn.local_port)],
        }
    }
}
