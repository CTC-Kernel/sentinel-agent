// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What one pass of the main loop gathers before the threat pipeline runs.

use agent_network::NetworkSecurityAlert;
use agent_scanner::SecurityIncident;

use crate::threat_pipeline::ObservedActivity;

/// Findings of the detection stages of one pass, handed to the threat
/// pipeline at the end of that pass.
pub(crate) struct LoopPass {
    /// The agent was paused when the pass started: periodic scans are skipped.
    pub is_paused: bool,
    /// A scan or a collection ran: the resource limits are checked.
    pub is_active: bool,
    pub incidents: Vec<SecurityIncident>,
    pub network_alerts: Vec<NetworkSecurityAlert>,
    /// File changes as (path, change type).
    pub fim_alerts: Vec<(String, String)>,
    /// Every process and connection seen in this pass, flagged or not: the
    /// custom detection rules apply to all of them.
    pub observed: ObservedActivity,
    /// Incidents of this pass only, so each KPI snapshot reflects the current
    /// cycle and not a cumulative total.
    #[cfg(feature = "gui")]
    pub kpi_incident_count: u32,
}

impl LoopPass {
    pub(crate) fn new(is_paused: bool) -> Self {
        Self {
            is_paused,
            is_active: false,
            incidents: Vec::new(),
            network_alerts: Vec::new(),
            fim_alerts: Vec::new(),
            observed: ObservedActivity::default(),
            #[cfg(feature = "gui")]
            kpi_incident_count: 0,
        }
    }

    /// Whether a detection engine flagged something in this pass. Playbooks
    /// act on the host: they only run on what an engine flagged.
    pub(crate) fn has_flagged_activity(&self) -> bool {
        !self.incidents.is_empty() || !self.network_alerts.is_empty() || !self.fim_alerts.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::playbook_engine::ProcessInfo;

    #[test]
    fn a_new_pass_is_idle_and_empty() {
        let pass = LoopPass::new(true);
        assert!(pass.is_paused);
        assert!(!pass.is_active);
        assert!(!pass.has_flagged_activity());
        assert!(pass.observed.is_empty());
    }

    #[test]
    fn a_file_change_alone_counts_as_flagged_activity() {
        let mut pass = LoopPass::new(false);
        pass.fim_alerts
            .push(("/etc/passwd".to_string(), "modified".to_string()));
        assert!(pass.has_flagged_activity());
    }

    #[test]
    fn observed_activity_alone_is_not_flagged() {
        let mut pass = LoopPass::new(false);
        pass.observed.processes.push(ProcessInfo {
            name: "curl".to_string(),
            pid: 4242,
            command_line: "curl https://example.org".to_string(),
        });
        assert!(!pass.observed.is_empty());
        assert!(!pass.has_flagged_activity());
    }
}
