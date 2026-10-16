// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
            9001 => "port de relais Tor",
            9030 => "port d'annuaire Tor",
            9050 => "proxy SOCKS Tor",
            9051 => "port de contrôle Tor",
            9150 => "SOCKS du navigateur Tor",
            _ => "port du réseau Tor",
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::AnonymizationNetwork,
            severity: AlertSeverity::Medium,
            title: format!("Connexion au réseau Tor ({})", port_desc),
            description: format!(
                "Connexion vers {} sur le port {} ({}). \
                Tor sert à rendre le trafic anonyme ou à joindre des services cachés. Processus : {}.",
                conn.remote_address.as_deref().unwrap_or("inconnue"),
                port,
                port_desc,
                conn.process_name.as_deref().unwrap_or("inconnu")
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
            title: format!("Connexion IRC sur le port {}", port),
            description: format!(
                "Connexion au port IRC {} de {}. \
                Des réseaux de machines compromises (botnets) reçoivent leurs ordres par IRC. \
                Processus : {}.",
                port,
                conn.remote_address.as_deref().unwrap_or("inconnue"),
                conn.process_name.as_deref().unwrap_or("inconnu")
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
            22 => "SSH, inhabituel depuis un poste de travail",
            23 => "Telnet, protocole non chiffré",
            3389 => "RDP, déplacement latéral possible",
            5900..=5902 => "VNC, bureau à distance",
            _ => "port suspect",
        };

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::SuspiciousPort,
            severity: AlertSeverity::Low,
            title: format!("Connexion sortante suspecte sur le port {}", port),
            description: format!(
                "Connexion sortante vers {}:{} ({}). \
                Ce type de connexion mérite d'être examiné. Processus : {}.",
                conn.remote_address.as_deref().unwrap_or("inconnue"),
                port,
                port_desc,
                conn.process_name.as_deref().unwrap_or("inconnu")
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
            title: format!("Port en écoute suspect : {}", conn.local_port),
            description: format!(
                "Le processus « {} » écoute sur le port {}, souvent associé aux portes dérobées et \
                aux outils de prise de contrôle à distance. Vérifier qu'il s'agit d'un service légitime.",
                conn.process_name.as_deref().unwrap_or("inconnu"),
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
