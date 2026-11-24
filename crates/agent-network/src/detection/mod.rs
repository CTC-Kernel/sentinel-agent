// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network security detection modules.
//!
//! Detects malicious network activity:
//! - C2 communication patterns
//! - Crypto mining traffic
//! - Data exfiltration attempts
//! - Suspicious port usage
//! - DGA (Domain Generation Algorithm) domains
//! - Beaconing patterns

mod beaconing_detector;
mod c2_detector;
mod cooldown;
mod dga_detector;
mod exfil_detector;
mod miner_detector;
mod port_scanner;
mod rules;

pub use beaconing_detector::{BeaconingAnalysis, BeaconingConfig, BeaconingDetector};
pub use c2_detector::C2Detector;
pub use cooldown::{AlertCooldown, AlertKey, DEFAULT_ALERT_COOLDOWN};
pub use dga_detector::{DgaConfig, DgaDetector};
pub use exfil_detector::ExfilDetector;
pub use miner_detector::MinerDetector;
pub use port_scanner::PortScanner;
pub use rules::{DetectionRules, IocType};

use crate::collector::ObservedName;
use crate::error::NetworkResult;
use crate::types::{
    AlertSeverity, ConnectionState, NetworkAlertType, NetworkConnection, NetworkSecurityAlert,
    ThreatIntelligence,
};
use tracing::{debug, info};

/// Main security detector that orchestrates all detection modules.
pub struct SecurityDetector {
    rules: DetectionRules,
    c2_detector: C2Detector,
    miner_detector: MinerDetector,
    exfil_detector: ExfilDetector,
    port_scanner: PortScanner,
    dga_detector: DgaDetector,
    beaconing_detector: BeaconingDetector,
}

impl SecurityDetector {
    /// Create a new security detector with default rules.
    pub fn new() -> Self {
        let rules = DetectionRules::default();
        Self {
            c2_detector: C2Detector::new(&rules),
            miner_detector: MinerDetector::new(&rules),
            exfil_detector: ExfilDetector::new(&rules),
            port_scanner: PortScanner::new(&rules),
            dga_detector: DgaDetector::new(&rules),
            beaconing_detector: BeaconingDetector::new(&rules),
            rules,
        }
    }

    /// Create a security detector with custom threat intelligence.
    pub fn with_threat_intel(threat_intel: ThreatIntelligence) -> Self {
        let rules = DetectionRules::from_threat_intel(threat_intel);
        Self {
            c2_detector: C2Detector::new(&rules),
            miner_detector: MinerDetector::new(&rules),
            exfil_detector: ExfilDetector::new(&rules),
            port_scanner: PortScanner::new(&rules),
            dga_detector: DgaDetector::new(&rules),
            beaconing_detector: BeaconingDetector::new(&rules),
            rules,
        }
    }

    /// Update threat intelligence data.
    pub fn update_threat_intel(&mut self, threat_intel: ThreatIntelligence) {
        self.rules = DetectionRules::from_threat_intel(threat_intel);
        self.c2_detector = C2Detector::new(&self.rules);
        self.miner_detector = MinerDetector::new(&self.rules);
        self.exfil_detector = ExfilDetector::new(&self.rules);
        self.port_scanner = PortScanner::new(&self.rules);
        self.dga_detector = DgaDetector::new(&self.rules);
        self.beaconing_detector = BeaconingDetector::new(&self.rules);
        info!("Updated threat intelligence data");
    }

    /// Analyze connections for security threats.
    pub async fn analyze(
        &self,
        connections: &[NetworkConnection],
    ) -> NetworkResult<Vec<NetworkSecurityAlert>> {
        // Anti-Draper: exclude the agent's own connections from analysis to
        // prevent self-detection (heartbeat flagged as C2/beaconing, etc.).
        let my_pid = std::process::id();
        let filtered: Vec<_> = connections
            .iter()
            .filter(|c| c.pid != Some(my_pid))
            .cloned()
            .collect();
        debug!(
            "Analyzing {} connections for threats ({} excluded as own-process)",
            filtered.len(),
            connections.len() - filtered.len()
        );
        let mut alerts = Vec::new();

        // Run all detectors
        alerts.extend(self.c2_detector.detect(&filtered));
        alerts.extend(self.miner_detector.detect(&filtered));
        alerts.extend(self.exfil_detector.detect(&filtered));
        alerts.extend(self.port_scanner.detect(&filtered));
        alerts.extend(self.dga_detector.detect(&filtered));
        alerts.extend(self.beaconing_detector.detect(&filtered));

        // Sort by severity (highest first)
        alerts.sort_by_key(|a| std::cmp::Reverse(a.severity));

        if !alerts.is_empty() {
            info!(
                "Security analysis complete: {} alerts generated",
                alerts.len()
            );
        } else {
            debug!("Security analysis complete: no threats detected");
        }

        Ok(alerts)
    }

    /// Analyze the host names the machine resolved.
    ///
    /// The connections only carry addresses, so nothing that goes by name
    /// could ever match on them: generated domains (DGA), mining pools and
    /// the malicious domains of the threat intelligence are looked for
    /// here. An established connection to one of the addresses of a name,
    /// when there is one, is attached to the alert: it names the process.
    pub fn analyze_names(
        &self,
        names: &[ObservedName],
        connections: &[NetworkConnection],
    ) -> Vec<NetworkSecurityAlert> {
        let my_pid = std::process::id();
        let mut alerts = Vec::new();
        for observed in names {
            let conn = connections.iter().find(|conn| {
                conn.state == ConnectionState::Established
                    && conn.pid != Some(my_pid)
                    && conn
                        .remote_address
                        .as_ref()
                        .is_some_and(|remote| observed.addresses.contains(remote))
            });
            let name = observed.name.as_str();
            if self.rules.is_mining_pool(name) {
                alerts.push(name_alert(
                    NetworkAlertType::CryptoMining,
                    "Pool de minage",
                    "un pool de minage de cryptomonnaie connu",
                    "known_mining_pool",
                    format!("pool:{name}"),
                    observed,
                    conn,
                ));
            } else if self.rules.is_malicious_domain(name) {
                alerts.push(name_alert(
                    NetworkAlertType::MaliciousDestination,
                    "Domaine malveillant",
                    "un domaine malveillant connu du renseignement sur les menaces",
                    "known_malicious_domain",
                    format!("domain:{name}"),
                    observed,
                    conn,
                ));
            } else if let Some(alert) = self.dga_detector.analyze_name(name, conn) {
                alerts.push(alert);
            }
        }
        alerts.sort_by_key(|a| std::cmp::Reverse(a.severity));
        alerts
    }

    /// Get the current detection rules.
    pub fn rules(&self) -> &DetectionRules {
        &self.rules
    }

    /// Get access to the DGA detector for domain analysis.
    pub fn dga_detector(&self) -> &DgaDetector {
        &self.dga_detector
    }

    /// Get mutable access to the beaconing detector for recording connections.
    pub fn beaconing_detector_mut(&mut self) -> &mut BeaconingDetector {
        &mut self.beaconing_detector
    }
}

/// Alert for a name known to the rules. Without a connection the name was
/// resolved, not necessarily reached: the alert says so and is one notch
/// less certain.
fn name_alert(
    alert_type: NetworkAlertType,
    what: &str,
    known_as: &str,
    reason: &str,
    ioc: String,
    observed: &ObservedName,
    conn: Option<&NetworkConnection>,
) -> NetworkSecurityAlert {
    let name = &observed.name;
    let description = match conn {
        Some(conn) => format!(
            "Connexion active vers « {name} » ({}), {known_as}. Processus : {}.",
            conn.remote_address.as_deref().unwrap_or("adresse inconnue"),
            conn.process_name.as_deref().unwrap_or("inconnu")
        ),
        None => format!(
            "Ce poste a r\u{e9}solu « {name} », {known_as}. Aucune connexion active vers ses adresses n'a \u{e9}t\u{e9} vue au moment de l'analyse."
        ),
    };
    NetworkSecurityAlert {
        alert_type,
        severity: if conn.is_some() {
            AlertSeverity::High
        } else {
            AlertSeverity::Medium
        },
        // The name is in the title: it is what tells two such alerts apart
        // when no connection does.
        title: format!("{what} : {name}"),
        description,
        connection: conn.cloned(),
        evidence: serde_json::json!({
            "domain": name,
            "resolved_addresses": observed.addresses,
            "source": "dns_cache",
            "process_name": conn.and_then(|c| c.process_name.clone()),
            "process_path": conn.and_then(|c| c.process_path.clone()),
            "pid": conn.and_then(|c| c.pid),
            "detection_reason": reason,
        }),
        confidence: if conn.is_some() { 95 } else { 80 },
        detected_at: chrono::Utc::now(),
        iocs_matched: vec![ioc],
    }
}

impl Default for SecurityDetector {
    fn default() -> Self {
        Self::new()
    }
}
