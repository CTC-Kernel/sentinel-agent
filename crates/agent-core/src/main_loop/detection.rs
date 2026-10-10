// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection stages of the main loop: what was observed since the last pass
//! and must reach the threat pipeline. They run on every pass, paused or not.

use agent_fim::canary::CanaryIncident;
use agent_scanner::SecurityIncident;
use std::sync::atomic::Ordering;
use tracing::{error, warn};

use super::LoopPass;
use crate::{AgentRuntime, ransomware_canary};

impl AgentRuntime {
    /// Apply the indicator feeds refreshed in the background, if any.
    pub(crate) async fn apply_fresh_feed_intel(&self) {
        let fresh_feed_intel = self
            .pending_feed_intel
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take();
        if let Some(intel) = fresh_feed_intel {
            *self.feed_threat_intel.write().await = Some(intel);
            self.apply_threat_intel().await;
        }
    }

    /// Report the processes flagged as they started: platform, interface,
    /// then the threat pipeline of this pass.
    pub(crate) async fn report_process_start_incidents(
        &self,
        pass: &mut LoopPass,
        process_start_incidents: Vec<SecurityIncident>,
    ) {
        for incident in process_start_incidents {
            warn!("{}", incident.title);
            if let Err(e) = self.upload_incident(&incident).await {
                error!("Failed to upload process incident: {}", e);
            }
            #[cfg(feature = "gui")]
            {
                self.emit_process_incident(&incident);
                self.emit_notification(
                    "Processus suspect détecté à son lancement",
                    &incident.title,
                    "error",
                );
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            pass.incidents.push(incident);
        }
    }

    /// Processes started since the last pass, evaluated as they start.
    pub(crate) async fn report_started_processes(&self, pass: &mut LoopPass) {
        let (process_starts, process_start_incidents) = self.take_process_starts();
        pass.observed
            .add_processes(process_starts.iter().map(|start| &start.process));
        self.report_process_start_incidents(pass, process_start_incidents)
            .await;
    }

    /// Report tampered decoy folders: platform, interface, then the threat
    /// pipeline of this pass (as a file change when it calls for a response).
    pub(crate) async fn report_canary_incidents(
        &self,
        pass: &mut LoopPass,
        canaries: Vec<CanaryIncident>,
    ) {
        for canary in canaries {
            let incident = ransomware_canary::incident_from(&canary);
            warn!("{}: {}", incident.title, canary.folder.display());
            if let Err(e) = self.upload_incident(&incident).await {
                error!("Failed to upload ransomware canary incident: {}", e);
            }
            #[cfg(feature = "gui")]
            {
                self.emit_system_incident(&incident);
                self.emit_notification(&incident.title, &incident.description, "error");
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            if ransomware_canary::triggers_response(&canary) {
                pass.fim_alerts.push((
                    canary.folder.to_string_lossy().to_string(),
                    ransomware_canary::PLAYBOOK_CHANGE_TYPE.to_string(),
                ));
            }
            pass.incidents.push(incident);
        }
    }

    /// Ransomware canaries: restart the watcher when the option changed,
    /// then report what it found. Always runs: security-critical even when
    /// paused.
    pub(crate) async fn check_ransomware_canaries(&self, pass: &mut LoopPass) {
        if self
            .state
            .ransomware_canaries_changed
            .swap(false, Ordering::AcqRel)
        {
            self.stop_ransomware_canaries();
            self.start_ransomware_canaries().await;
        }
        let canaries = self.take_canary_incidents().await;
        self.report_canary_incidents(pass, canaries).await;
    }
}

#[cfg(test)]
mod tests {
    use crate::main_loop::LoopPass;
    use crate::main_loop::testing::standalone_runtime;
    use crate::ransomware_canary;
    use agent_fim::canary::{CanaryIncident, CanaryTamper};
    #[cfg(feature = "gui")]
    use agent_gui::events::AgentEvent;
    use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};
    use std::path::PathBuf;

    fn miner_started() -> SecurityIncident {
        SecurityIncident {
            incident_type: IncidentType::CryptoMiner,
            severity: IncidentSeverity::High,
            title: "Mineur de cryptomonnaie lancé : xmrig".to_string(),
            description: "Le processus xmrig correspond à un mineur connu.".to_string(),
            evidence: serde_json::json!({ "process_name": "xmrig", "pid": 4242 }),
            confidence: 95,
            detected_at: chrono::Utc::now(),
        }
    }

    #[tokio::test]
    async fn a_process_flagged_at_start_reaches_the_pipeline_and_the_interface() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime
            .report_process_start_incidents(&mut pass, vec![miner_started()])
            .await;

        assert_eq!(pass.incidents.len(), 1);
        assert_eq!(pass.incidents[0].incident_type, IncidentType::CryptoMiner);
        assert!(pass.has_flagged_activity());
        #[cfg(feature = "gui")]
        {
            assert_eq!(pass.kpi_incident_count, 1);
            match test.events.try_recv() {
                Ok(AgentEvent::SuspiciousProcess { process }) => {
                    assert_eq!(process.process_name, "xmrig");
                    assert_eq!(process.pid, 4242);
                }
                other => panic!("expected the process, got {:?}", other.map(|_| ())),
            }
            match test.events.try_recv() {
                Ok(AgentEvent::Notification { notification }) => {
                    assert_eq!(notification.severity, "error");
                    assert_eq!(notification.body, "Mineur de cryptomonnaie lancé : xmrig");
                }
                other => panic!("expected a notification, got {:?}", other.map(|_| ())),
            }
        }
    }

    fn canary(tamper: CanaryTamper) -> CanaryIncident {
        CanaryIncident {
            folder: PathBuf::from("/Users/alice/Documents/.0-archives-1a2b3c"),
            tamper,
            modified: vec![PathBuf::from(
                "/Users/alice/Documents/.0-archives-1a2b3c/contrat-signe.pdf",
            )],
            missing: Vec::new(),
            foreign: Vec::new(),
            detected_at: chrono::Utc::now(),
            while_stopped: false,
        }
    }

    #[tokio::test]
    async fn encrypted_decoys_reach_the_playbooks_as_a_file_change() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(true);

        test.runtime
            .report_canary_incidents(&mut pass, vec![canary(CanaryTamper::Encrypted)])
            .await;

        assert_eq!(pass.incidents.len(), 1);
        assert_eq!(
            pass.fim_alerts,
            vec![(
                "/Users/alice/Documents/.0-archives-1a2b3c".to_string(),
                ransomware_canary::PLAYBOOK_CHANGE_TYPE.to_string()
            )]
        );
        #[cfg(feature = "gui")]
        {
            assert_eq!(pass.kpi_incident_count, 1);
            assert!(matches!(
                test.events.try_recv(),
                Ok(AgentEvent::SystemIncident { .. })
            ));
            assert!(matches!(
                test.events.try_recv(),
                Ok(AgentEvent::Notification { .. })
            ));
        }
    }

    #[tokio::test]
    async fn removed_decoys_are_reported_without_triggering_a_response() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime
            .report_canary_incidents(&mut pass, vec![canary(CanaryTamper::Removed)])
            .await;

        assert_eq!(pass.incidents.len(), 1);
        assert!(pass.fim_alerts.is_empty());
    }

    #[tokio::test]
    async fn without_process_telemetry_the_stage_gathers_nothing() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime.report_started_processes(&mut pass).await;

        assert!(pass.incidents.is_empty());
        assert!(pass.observed.is_empty());
    }

    #[tokio::test]
    async fn fresh_feed_intelligence_is_taken_and_kept() {
        let test = standalone_runtime();
        let intel = agent_network::ThreatIntelligence {
            malicious_ips: vec!["203.0.113.7".to_string()],
            ..Default::default()
        };
        *test.runtime.pending_feed_intel.lock().unwrap() = Some(intel);

        test.runtime.apply_fresh_feed_intel().await;

        assert!(test.runtime.pending_feed_intel.lock().unwrap().is_none());
        let kept = test.runtime.feed_threat_intel.read().await;
        assert_eq!(
            kept.as_ref().map(|intel| intel.malicious_ips.clone()),
            Some(vec!["203.0.113.7".to_string()])
        );
    }

    #[tokio::test]
    async fn without_fresh_intelligence_nothing_changes() {
        let test = standalone_runtime();
        test.runtime.apply_fresh_feed_intel().await;
        assert!(test.runtime.feed_threat_intel.read().await.is_none());
    }
}
