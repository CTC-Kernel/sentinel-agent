// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Crypto miner detection.
//!
//! Detects crypto mining activity:
//! - Connections to known mining pools
//! - Stratum protocol connections (ports 3333-9999)
//! - Known miner process names

use super::rules::DetectionRules;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
};
use chrono::Utc;
use serde_json::json;

/// Mining pool port range.
const STRATUM_PORT_MIN: u16 = 3333;
const STRATUM_PORT_MAX: u16 = 9999;

/// Detector for crypto mining activity.
pub struct MinerDetector {
    mining_pools: Vec<String>,
    miner_processes: Vec<String>,
}

impl MinerDetector {
    /// Create a new miner detector with rules.
    pub fn new(rules: &DetectionRules) -> Self {
        Self {
            mining_pools: rules.mining_pools.iter().cloned().collect(),
            miner_processes: rules.miner_processes.iter().cloned().collect(),
        }
    }

    /// Detect crypto mining activity in connections.
    pub fn detect(&self, connections: &[NetworkConnection]) -> Vec<NetworkSecurityAlert> {
        let mut alerts = Vec::new();

        for conn in connections {
            // Check for established connections only
            if conn.state != ConnectionState::Established {
                continue;
            }

            // Check process name for known miners
            if let Some(ref process_name) = conn.process_name
                && self.is_miner_process(process_name)
            {
                alerts.push(self.create_miner_process_alert(conn, process_name));
                continue; // Don't duplicate alerts for same connection
            }

            // Check for connections to stratum ports
            if let Some(remote_port) = conn.remote_port
                && self.is_stratum_port(remote_port)
            {
                // Additional check: is it connecting to a known pool?
                let is_known_pool = conn
                    .remote_address
                    .as_ref()
                    .is_some_and(|addr| self.is_mining_pool(addr));

                if is_known_pool {
                    alerts.push(self.create_mining_pool_alert(conn, remote_port));
                }
            }
        }

        alerts
    }

    fn is_miner_process(&self, name: &str) -> bool {
        let lower = name.to_lowercase();
        let executable = lower.rsplit(['/', '\\']).next().unwrap_or(&lower);
        self.miner_processes.iter().any(|p| {
            executable.trim_end_matches(".exe") == p.to_lowercase().trim_end_matches(".exe")
        })
    }

    fn is_stratum_port(&self, port: u16) -> bool {
        (STRATUM_PORT_MIN..=STRATUM_PORT_MAX).contains(&port)
    }

    fn is_mining_pool(&self, addr: &str) -> bool {
        let host = addr.trim_end_matches('.').to_lowercase();
        self.mining_pools
            .iter()
            .any(|pool| host == *pool || host.ends_with(&format!(".{pool}")))
    }

    fn create_miner_process_alert(
        &self,
        conn: &NetworkConnection,
        process_name: &str,
    ) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type: NetworkAlertType::CryptoMining,
            severity: AlertSeverity::High,
            title: format!("Mineur de cryptomonnaie : {}", process_name),
            description: format!(
                "Le processus « {} » est un mineur de cryptomonnaie connu, connecté à {}:{}. \
                Un minage non autorisé consomme les ressources du poste.",
                process_name,
                conn.remote_address.as_deref().unwrap_or("inconnue"),
                conn.remote_port.unwrap_or(0)
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "process_name": process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "remote_address": conn.remote_address,
                "remote_port": conn.remote_port,
                "detection_reason": "known_miner_process"
            }),
            confidence: 90,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("process:{}", process_name)],
        }
    }

    fn create_mining_pool_alert(
        &self,
        conn: &NetworkConnection,
        port: u16,
    ) -> NetworkSecurityAlert {
        let remote_addr = conn.remote_address.as_deref().unwrap_or("inconnue");

        NetworkSecurityAlert {
            alert_type: NetworkAlertType::CryptoMining,
            severity: AlertSeverity::High,
            title: "Connexion à un pool de minage connu".to_string(),
            description: format!(
                "Connexion active vers le pool de minage {} sur le port stratum {}. \
                Processus : {}. Du minage de cryptomonnaie est en cours.",
                remote_addr,
                port,
                conn.process_name.as_deref().unwrap_or("inconnu")
            ),
            connection: Some(conn.clone()),
            evidence: json!({
                "pool_address": remote_addr,
                "port": port,
                "process_name": conn.process_name,
                "process_path": conn.process_path,
                "pid": conn.pid,
                "detection_reason": "known_mining_pool"
            }),
            confidence: 95,
            detected_at: Utc::now(),
            iocs_matched: vec![format!("pool:{}", remote_addr)],
        }
    }
}
