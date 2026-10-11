// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection stages of the main loop: what was observed since the last pass
//! and must reach the threat pipeline. They run on every pass, paused or not.

use agent_fim::canary::CanaryIncident;
use agent_scanner::SecurityIncident;
use agent_siem::SiemEvent;
use std::sync::atomic::Ordering;
use tracing::{info, warn};

use super::LoopPass;
use crate::log_analysis::LogFindings;
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
            if !intel.file_hashes.is_empty() {
                info!(
                    "Threat intelligence in use: {} malicious file hashes",
                    intel.file_hashes.len()
                );
            }
            *self.malicious_file_hashes.write().await = intel.file_hashes;
            *self.feed_threat_intel.write().await = Some(intel.network);
            self.apply_threat_intel().await;
        }
    }

    /// Report what the rules found in the logs: platform, interface, SIEM,
    /// then the threat pipeline of this pass. Who the system's audit says
    /// touched a file is kept for the file changes read later in the pass.
    pub(crate) async fn report_log_findings(&self, pass: &mut LoopPass, findings: LogFindings) {
        if !findings.file_actors.is_empty() {
            let now = std::time::Instant::now();
            let mut attribution = self
                .fim_attribution
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            for (path, actor) in findings.file_actors {
                attribution.audited(&path, actor, now);
            }
        }
        for incident in findings.incidents {
            warn!("{}", incident.title);
            self.queue_incident(&incident, "log detection incident")
                .await;
            #[cfg(feature = "gui")]
            {
                self.emit_system_incident(&incident);
                let level = match incident.severity {
                    agent_scanner::IncidentSeverity::Critical
                    | agent_scanner::IncidentSeverity::High => "error",
                    _ => "warning",
                };
                self.emit_notification(
                    "Détection dans les journaux",
                    incident.title.trim_start_matches("Sigma: "),
                    level,
                );
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            pass.incidents.push(incident);
        }
        self.queue_siem_events(findings.records).await;
    }

    /// Log events written since the last pass, evaluated against the rules.
    pub(crate) async fn analyse_logs(&self, pass: &mut LoopPass) {
        if !self.config.log_analysis {
            return;
        }
        #[cfg(target_os = "windows")]
        self.read_windows_events().await;
        // Log files are read and the rules evaluated: neither waits.
        let findings = tokio::task::block_in_place(|| self.take_log_findings());
        self.report_log_findings(pass, findings).await;
    }

    /// Report what changed in the inventory: platform, interface, SIEM,
    /// then the threat pipeline of this pass.
    pub(crate) async fn report_inventory_changes(
        &self,
        pass: &mut LoopPass,
        incidents: Vec<SecurityIncident>,
        records: Vec<SiemEvent>,
    ) {
        for incident in incidents {
            warn!("{}", incident.title);
            self.queue_incident(&incident, "inventory change incident")
                .await;
            #[cfg(feature = "gui")]
            {
                self.emit_system_incident(&incident);
                self.emit_notification(
                    "Changement dans l'inventaire du poste",
                    &incident.description,
                    "warning",
                );
                pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
            }
            pass.incidents.push(incident);
        }
        self.queue_siem_events(records).await;
    }

    /// Accounts, services and listening ports: what changed since the last
    /// inventory, when its time has come.
    pub(crate) async fn inventory_stage(&self, pass: &mut LoopPass) {
        let (incidents, records) = self.inventory_pass().await;
        self.report_inventory_changes(pass, incidents, records)
            .await;
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
            self.queue_incident(&incident, "process incident").await;
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
            self.queue_incident(&incident, "ransomware canary incident")
                .await;
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
    use crate::main_loop::outbox::Outbound;
    use crate::main_loop::testing::standalone_runtime;
    use crate::ransomware_canary;
    use agent_fim::canary::{CanaryIncident, CanaryTamper};
    #[cfg(feature = "gui")]
    use agent_gui::events::AgentEvent;
    use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};
    use std::path::PathBuf;

    /// SHA-256 of the EICAR test file.
    const EICAR_SHA256: &str = "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f";

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
        // The upload is queued, not waited for.
        match test.runtime.outbox.take_queued().await.as_slice() {
            [Outbound::Incident { incident, what }] => {
                assert_eq!(incident.incident_type, IncidentType::CryptoMiner);
                assert_eq!(*what, "process incident");
            }
            other => panic!("expected one queued incident, got {other:?}"),
        }
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
        assert_eq!(test.runtime.outbox.unsent(), 1);
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
        let intel = crate::threat_intel_feeds::FeedIntel {
            network: agent_network::ThreatIntelligence {
                malicious_ips: vec!["203.0.113.7".to_string()],
                ..Default::default()
            },
            file_hashes: std::sync::Arc::new([EICAR_SHA256.to_string()].into()),
        };
        *test.runtime.pending_feed_intel.lock().unwrap() = Some(intel);

        test.runtime.apply_fresh_feed_intel().await;

        assert!(test.runtime.pending_feed_intel.lock().unwrap().is_none());
        let kept = test.runtime.feed_threat_intel.read().await;
        assert_eq!(
            kept.as_ref().map(|intel| intel.malicious_ips.clone()),
            Some(vec!["203.0.113.7".to_string()])
        );
        assert!(
            test.runtime
                .malicious_file_hashes
                .read()
                .await
                .contains(EICAR_SHA256)
        );
    }

    fn incident(incident_type: IncidentType, title: &str) -> SecurityIncident {
        SecurityIncident {
            incident_type,
            severity: IncidentSeverity::High,
            title: title.to_string(),
            description: "what happened".to_string(),
            evidence: serde_json::Value::Null,
            confidence: 90,
            detected_at: chrono::Utc::now(),
        }
    }

    fn siem_event(name: &str) -> agent_siem::SiemEvent {
        agent_siem::SiemEvent {
            timestamp: chrono::Utc::now(),
            severity: 7,
            category: agent_siem::EventCategory::Authentication,
            name: name.to_string(),
            description: String::new(),
            source_host: "host".to_string(),
            source_ip: None,
            destination_ip: None,
            destination_port: None,
            user: None,
            process_name: None,
            process_id: None,
            file_path: None,
            custom_fields: serde_json::Value::Null,
            event_id: uuid::Uuid::new_v4().to_string(),
            agent_version: "test".to_string(),
        }
    }

    #[tokio::test]
    async fn a_log_detection_reaches_the_pipeline_the_siem_and_the_file_attribution() {
        let test = standalone_runtime();
        test.runtime.init_siem_forwarder().await;
        let mut pass = LoopPass::new(true);
        let findings = crate::log_analysis::LogFindings {
            file_actors: vec![(
                "/etc/hosts".to_string(),
                agent_common::types::FimActor {
                    user: Some("alice".to_string()),
                    process: Some("vim".to_string()),
                    pid: Some(4242),
                    command: None,
                    exact: true,
                    source: "audit".to_string(),
                },
            )],
            incidents: vec![incident(
                IncidentType::CredentialTheft,
                "Sigma: SSH brute force",
            )],
            records: vec![siem_event("SSH brute force")],
        };

        test.runtime.report_log_findings(&mut pass, findings).await;

        assert_eq!(pass.incidents.len(), 1);
        assert!(pass.has_flagged_activity());
        let actor = test
            .runtime
            .fim_attribution
            .lock()
            .unwrap()
            .actor_for("/etc/hosts", std::time::Instant::now());
        assert_eq!(actor.and_then(|actor| actor.user).as_deref(), Some("alice"));
        // Upload and SIEM record are queued, not waited for.
        let queued = test.runtime.outbox.take_queued().await;
        assert!(matches!(
            queued.as_slice(),
            [Outbound::Incident { .. }, Outbound::SiemEvents(_)]
        ));
        for item in queued {
            test.runtime.send_outbound(item).await;
        }
        let siem = test.runtime.siem_forwarder.read().await;
        let recorded = siem.as_ref().unwrap().take_recent_events().await;
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].name, "SSH brute force");
        #[cfg(feature = "gui")]
        {
            assert_eq!(pass.kpi_incident_count, 1);
            // Setting up the SIEM forwarder also tells the interface about it.
            let events: Vec<AgentEvent> =
                std::iter::from_fn(|| test.events.try_recv().ok()).collect();
            assert!(
                events
                    .iter()
                    .any(|event| matches!(event, AgentEvent::SystemIncident { .. }))
            );
            let notification = events
                .iter()
                .find_map(|event| match event {
                    AgentEvent::Notification { notification } => Some(notification),
                    _ => None,
                })
                .expect("a notification");
            assert_eq!(notification.title, "Détection dans les journaux");
            assert_eq!(notification.body, "SSH brute force");
            assert_eq!(notification.severity, "error");
        }
    }

    #[tokio::test]
    async fn an_inventory_change_reaches_the_pipeline_and_the_siem() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime
            .report_inventory_changes(
                &mut pass,
                vec![incident(
                    IncidentType::UnauthorizedChange,
                    "Nouveau compte : backdoor",
                )],
                vec![siem_event("Account created")],
            )
            .await;

        assert_eq!(pass.incidents.len(), 1);
        match test.runtime.outbox.take_queued().await.as_slice() {
            [
                Outbound::Incident { what, .. },
                Outbound::SiemEvents(events),
            ] => {
                assert_eq!(*what, "inventory change incident");
                assert_eq!(events.len(), 1);
            }
            other => panic!("expected an incident and its SIEM record, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn nothing_found_queues_nothing() {
        let test = standalone_runtime();
        let mut pass = LoopPass::new(false);

        test.runtime
            .report_log_findings(&mut pass, crate::log_analysis::LogFindings::default())
            .await;
        test.runtime
            .report_inventory_changes(&mut pass, Vec::new(), Vec::new())
            .await;

        assert!(!pass.has_flagged_activity());
        assert_eq!(test.runtime.outbox.unsent(), 0);
    }

    #[tokio::test]
    async fn without_fresh_intelligence_nothing_changes() {
        let test = standalone_runtime();
        test.runtime.apply_fresh_feed_intel().await;
        assert!(test.runtime.feed_threat_intel.read().await.is_none());
    }
}
