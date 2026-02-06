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
mod dga_detector;
mod exfil_detector;
mod miner_detector;
mod port_scanner;
mod rules;

pub use beaconing_detector::{BeaconingAnalysis, BeaconingConfig, BeaconingDetector};
pub use c2_detector::C2Detector;
pub use dga_detector::{DgaConfig, DgaDetector};
pub use exfil_detector::ExfilDetector;
pub use miner_detector::MinerDetector;
pub use port_scanner::PortScanner;
pub use rules::{DetectionRules, IocType};

use crate::error::NetworkResult;
use crate::types::{NetworkConnection, NetworkSecurityAlert, ThreatIntelligence};
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
        debug!("Analyzing {} connections for threats", connections.len());
        let mut alerts = Vec::new();

        // Run all detectors
        alerts.extend(self.c2_detector.detect(connections));
        alerts.extend(self.miner_detector.detect(connections));
        alerts.extend(self.exfil_detector.detect(connections));
        alerts.extend(self.port_scanner.detect(connections));
        alerts.extend(self.dga_detector.detect(connections));
        alerts.extend(self.beaconing_detector.detect(connections));

        // Sort by severity (highest first)
        alerts.sort_by(|a, b| b.severity.cmp(&a.severity));

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

impl Default for SecurityDetector {
    fn default() -> Self {
        Self::new()
    }
}
