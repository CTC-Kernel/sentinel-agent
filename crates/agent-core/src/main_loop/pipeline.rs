// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The response stage of the main loop: what the detection stages gathered
//! in this pass goes through the detection rules and the playbooks.

use agent_common::constants::AGENT_VERSION;
use agent_network::NetworkSecurityAlert;
use agent_scanner::SecurityIncident;
use agent_siem::{SiemEvent, SiemForwarder};
use tracing::{debug, info, warn};

use super::outbox::Outbound;
use super::{LoopPass, LoopState};
use crate::threat_pipeline::{PipelineResult, RuleMatch};
use crate::{AgentRuntime, siem_enrichment, threat_pipeline, triage_allowlist};

/// The detection rule matches of a pass, as the platform receives them.
fn detection_match_payloads(matches: &[RuleMatch]) -> Vec<agent_sync::DetectionMatchPayload> {
    matches
        .iter()
        .map(|m| agent_sync::DetectionMatchPayload {
            rule_id: m.rule_id.clone(),
            rule_name: m.rule_name.clone(),
            matched_at: m.matched_at,
            trigger_details: m.matched_value.clone(),
            severity: m.severity.clone(),
        })
        .collect()
}

/// Matches per rule: (rule id, number, last match as RFC 3339).
fn rule_match_counts(matches: &[RuleMatch]) -> Vec<(String, u32, String)> {
    let mut counts: Vec<(String, u32, chrono::DateTime<chrono::Utc>)> = Vec::new();
    for rule_match in matches {
        match counts
            .iter_mut()
            .find(|(id, _, _)| *id == rule_match.rule_id)
        {
            Some((_, count, last)) => {
                *count = count.saturating_add(1);
                *last = (*last).max(rule_match.matched_at);
            }
            None => counts.push((rule_match.rule_id.clone(), 1, rule_match.matched_at)),
        }
    }
    counts
        .into_iter()
        .map(|(id, count, last)| (id, count, last.to_rfc3339()))
        .collect()
}

/// The SIEM event recorded for a detection rule match seen on `host`.
fn rule_match_siem_event(rule_match: &RuleMatch, host: &str) -> SiemEvent {
    use crate::threat_pipeline::RuleTarget;
    let severity = match rule_match.severity.as_str() {
        "critical" => 9,
        "high" => 7,
        "medium" => 5,
        "low" => 3,
        _ => 1,
    };
    let process = rule_match.targets.iter().find_map(|target| match target {
        RuleTarget::Process { name, pid } => Some((name.clone(), *pid)),
        _ => None,
    });
    let connection = rule_match.targets.iter().find_map(|target| match target {
        RuleTarget::Connection { remote_ip, port } => Some((remote_ip.clone(), *port)),
        _ => None,
    });
    let file = rule_match.targets.iter().find_map(|target| match target {
        RuleTarget::File { path, .. } => Some(path.clone()),
        _ => None,
    });
    SiemEvent {
        timestamp: rule_match.matched_at,
        severity,
        category: agent_siem::EventCategory::Security,
        name: format!("Règle « {} » déclenchée", rule_match.rule_name),
        description: rule_match.matched_value.clone(),
        source_host: host.to_string(),
        source_ip: None,
        destination_ip: connection.as_ref().map(|(ip, _)| ip.clone()),
        destination_port: connection.map(|(_, port)| port).filter(|port| *port != 0),
        user: None,
        process_name: process.as_ref().map(|(name, _)| name.clone()),
        process_id: process.map(|(_, pid)| pid),
        file_path: file,
        custom_fields: serde_json::json!({
            "detection": "detection_rule",
            "rule_id": rule_match.rule_id,
            "rule_name": rule_match.rule_name,
        }),
        event_id: uuid::Uuid::new_v4().to_string(),
        agent_version: AGENT_VERSION.to_string(),
    }
}

/// The playbook executions of a pass, as the platform receives them.
fn playbook_log_payloads(
    logs: &[agent_gui::dto::PlaybookLogEntry],
) -> Vec<agent_sync::PlaybookLogPayload> {
    logs.iter()
        .map(|l| agent_sync::PlaybookLogPayload {
            id: l.id.to_string(),
            playbook_id: l.playbook_id.to_string(),
            playbook_name: l.playbook_name.clone(),
            triggered_at: l.triggered_at,
            trigger_event: l.trigger_event.clone(),
            actions_executed: l.actions_executed.clone(),
            success: l.success,
            error: l.error.clone(),
        })
        .collect()
}

/// The SIEM event recorded for a security incident seen on `host`.
fn incident_siem_event(inc: &SecurityIncident, host: &str) -> SiemEvent {
    let severity = match inc.severity {
        agent_scanner::IncidentSeverity::Critical => 9,
        agent_scanner::IncidentSeverity::High => 7,
        agent_scanner::IncidentSeverity::Medium => 5,
        agent_scanner::IncidentSeverity::Low => 3,
    };
    let process_name = inc
        .evidence
        .get("process_name")
        .and_then(|v| v.as_str())
        .map(String::from);
    SiemEvent {
        timestamp: inc.detected_at,
        severity,
        category: agent_siem::EventCategory::Security,
        name: inc.title.clone(),
        description: inc.description.clone(),
        source_host: host.to_string(),
        source_ip: None,
        destination_ip: None,
        destination_port: None,
        user: None,
        process_name,
        process_id: None,
        file_path: None,
        custom_fields: serde_json::json!({
            "incident_type": format!("{}", inc.incident_type),
            "confidence": inc.confidence,
        }),
        event_id: uuid::Uuid::new_v4().to_string(),
        agent_version: AGENT_VERSION.to_string(),
    }
}

/// The SIEM event recorded for a network alert seen on `host`.
fn network_alert_siem_event(alert: &NetworkSecurityAlert, host: &str) -> SiemEvent {
    let severity = match alert.severity {
        agent_network::AlertSeverity::Critical => 9,
        agent_network::AlertSeverity::High => 7,
        agent_network::AlertSeverity::Medium => 5,
        agent_network::AlertSeverity::Low => 3,
    };
    let (src_ip, dst_ip, dst_port) = if let Some(ref conn) = alert.connection {
        (
            Some(conn.local_address.clone()),
            conn.remote_address.clone(),
            conn.remote_port,
        )
    } else {
        (None, None, None)
    };
    SiemEvent {
        timestamp: alert.detected_at,
        severity,
        category: agent_siem::EventCategory::Network,
        name: alert.title.clone(),
        description: alert.description.clone(),
        source_host: host.to_string(),
        source_ip: src_ip,
        destination_ip: dst_ip,
        destination_port: dst_port,
        user: None,
        process_name: None,
        process_id: None,
        file_path: None,
        custom_fields: serde_json::json!({
            "alert_type": format!("{}", alert.alert_type),
            "confidence": alert.confidence,
            "iocs_matched": alert.iocs_matched,
        }),
        event_id: uuid::Uuid::new_v4().to_string(),
        agent_version: AGENT_VERSION.to_string(),
    }
}

impl AgentRuntime {
    /// Autonomous threat pipeline: evaluate the detection rules against
    /// what this pass gathered (incidents, network alerts, file changes) and
    /// against the activity observed, flagged or not. Playbooks act on the
    /// host: they only run on what an engine flagged.
    pub(crate) async fn threat_pipeline_stage(&self, st: &mut LoopState, pass: &mut LoopPass) {
        let flagged_activity = pass.has_flagged_activity();
        if flagged_activity || !pass.observed.is_empty() {
            // Authorized events still reach the SIEM below (audit trail) but
            // never match detection rules nor trigger playbooks.
            let allowlist = self.state.allowlist_snapshot();
            let (triaged_incidents, triaged_network, triaged_fim) =
                triage_allowlist::unauthorized_pipeline_inputs(
                    &allowlist,
                    &pass.incidents,
                    &pass.network_alerts,
                    &pass.fim_alerts,
                );
            let unauthorized_activity = triage_allowlist::unauthorized_observed(
                &allowlist,
                std::mem::take(&mut pass.observed),
            );
            let threat_context = threat_pipeline::build_threat_context(
                &triaged_incidents,
                &triaged_network,
                &triaged_fim,
            );

            let (detection_rules, playbooks) = self.load_pipeline_rules(flagged_activity).await;

            if !detection_rules.is_empty() || !playbooks.is_empty() {
                let siem_delivery = self.siem_forwarder.read().await;
                let pipeline_result = threat_pipeline::run_threat_pipeline(
                    &detection_rules,
                    &playbooks,
                    &threat_context,
                    &unauthorized_activity,
                    &mut st.rule_hit_memory,
                    #[cfg(feature = "gui")]
                    &self.gui_event_tx,
                    #[cfg(not(feature = "gui"))]
                    &None,
                    #[cfg(feature = "llm")]
                    self.llm_service.as_ref().map(|s| s.as_ref()),
                    self.audit_trail.as_ref(),
                    siem_delivery.as_ref(),
                    self.config.playbook_simulation,
                )
                .await;
                drop(siem_delivery);

                if !pipeline_result.rule_matches.is_empty()
                    || !pipeline_result.playbook_logs.is_empty()
                {
                    self.outbox
                        .push(Outbound::PipelineResult(pipeline_result))
                        .await;
                }
            }

            // Recorded in the SIEM by the upload task: each event is first
            // classified by the AI model, which the next pass must not wait for.
            if !pass.incidents.is_empty() || !pass.network_alerts.is_empty() {
                self.outbox
                    .push(Outbound::SiemFindings {
                        incidents: pass.incidents.clone(),
                        network_alerts: pass.network_alerts.clone(),
                    })
                    .await;
            }
        }
    }

    /// Load the detection rules, and the playbooks when something was
    /// flagged, from the database.
    async fn load_pipeline_rules(
        &self,
        with_playbooks: bool,
    ) -> (
        Vec<agent_gui::dto::DetectionRule>,
        Vec<agent_gui::dto::Playbook>,
    ) {
        let mut detection_rules: Vec<agent_gui::dto::DetectionRule> = Vec::new();
        let mut playbooks: Vec<agent_gui::dto::Playbook> = Vec::new();

        if let Some(ref db) = self.db {
            let rule_repo = agent_storage::repositories::grc::DetectionRuleRepository::new(db);
            match rule_repo.get_all().await {
                Ok(stored_rules) => {
                    detection_rules = threat_pipeline::stored_rules_to_dto(&stored_rules);
                    debug!(
                        "Loaded {} detection rules for pipeline",
                        detection_rules.len()
                    );
                }
                Err(e) => warn!("Failed to load detection rules for pipeline: {}", e),
            }

            if with_playbooks {
                let pb_repo = agent_storage::repositories::grc::PlaybookRepository::new(db);
                match pb_repo.get_all().await {
                    Ok(stored_pbs) => {
                        playbooks = threat_pipeline::stored_playbooks_to_dto(&stored_pbs);
                        debug!("Loaded {} playbooks for pipeline", playbooks.len());
                    }
                    Err(e) => warn!("Failed to load playbooks for pipeline: {}", e),
                }
            }
        }

        (detection_rules, playbooks)
    }

    /// Count the matches of each rule in the database, and record them in
    /// the SIEM (for the platform, and the external SIEM when there is one),
    /// as the detections of the engines are.
    pub(crate) async fn record_rule_matches(&self, matches: &[RuleMatch]) {
        if matches.is_empty() {
            return;
        }
        if let Some(ref db) = self.db {
            let counts = rule_match_counts(matches);
            if let Err(e) = agent_storage::repositories::grc::DetectionRuleRepository::new(db)
                .record_matches(&counts)
                .await
            {
                warn!("Detection rule matches not counted: {}", e);
            }
        }
        let siem_guard = self.siem_forwarder.read().await;
        if let Some(siem) = siem_guard.as_ref() {
            let host = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_default();
            for rule_match in matches {
                self.enrich_record_and_forward(
                    siem,
                    rule_match_siem_event(rule_match, &host),
                    "detection rule match",
                )
                .await;
            }
        }
    }

    /// Upload the detection matches and the playbook execution logs of a
    /// pass to the platform.
    pub(crate) async fn upload_pipeline_result(&self, pipeline_result: &PipelineResult) {
        if let Some(ref client) = self.authenticated_client {
            // Upload detection matches to the platform
            if !pipeline_result.rule_matches.is_empty() {
                let match_payloads = detection_match_payloads(&pipeline_result.rule_matches);
                match client.sync_detection_matches(match_payloads).await {
                    Ok(resp) => info!(
                        "Uploaded {} detection matches to platform",
                        resp.received_count
                    ),
                    Err(e) => warn!("Failed to upload detection matches: {}", e),
                }
            }

            // Upload playbook execution logs to the platform
            if !pipeline_result.playbook_logs.is_empty() {
                let log_payloads = playbook_log_payloads(&pipeline_result.playbook_logs);
                match client.sync_playbook_logs(log_payloads).await {
                    Ok(resp) => {
                        info!("Uploaded {} playbook logs to platform", resp.received_count)
                    }
                    Err(e) => warn!("Failed to upload playbook logs: {}", e),
                }
            }
        }
    }

    /// Forward security incidents and network alerts to SIEM (record for
    /// platform + optional external). Authorized events are included: the
    /// SIEM is the audit trail.
    pub(crate) async fn forward_findings_to_siem(
        &self,
        incidents: &[SecurityIncident],
        network_alerts: &[NetworkSecurityAlert],
    ) {
        let siem_guard = self.siem_forwarder.read().await;
        if let Some(siem) = siem_guard.as_ref() {
            let host = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_default();

            // Security incidents → SIEM
            for inc in incidents {
                self.enrich_record_and_forward(
                    siem,
                    incident_siem_event(inc, &host),
                    "security incident",
                )
                .await;
            }

            // Network alerts → SIEM
            for alert in network_alerts {
                self.enrich_record_and_forward(
                    siem,
                    network_alert_siem_event(alert, &host),
                    "network alert",
                )
                .await;
            }

            if !incidents.is_empty() || !network_alerts.is_empty() {
                info!(
                    "Forwarded {} security incidents and {} network alerts to SIEM",
                    incidents.len(),
                    network_alerts.len(),
                );
            }
        }
    }

    /// Enrich an event with the AI classification, record it for the
    /// platform and, when an external SIEM is configured, send it there.
    /// `what` names the event in the log when that delivery fails.
    async fn enrich_record_and_forward(
        &self,
        siem: &SiemForwarder,
        mut event: SiemEvent,
        what: &str,
    ) {
        #[cfg(feature = "llm")]
        {
            if let Some(ref llm_svc) = self.llm_service {
                siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
            }
        }
        #[cfg(not(feature = "llm"))]
        {
            siem_enrichment::enrich_siem_event(&mut event).await;
        }
        siem.record_event(event.clone()).await;
        if siem.is_enabled()
            && let Err(e) = siem.send_event(&event).await
        {
            warn!("Failed to forward {} to external SIEM: {}", what, e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use agent_scanner::{IncidentSeverity, IncidentType};
    use std::time::Instant;

    fn incident(severity: IncidentSeverity) -> SecurityIncident {
        SecurityIncident {
            incident_type: IncidentType::CryptoMiner,
            severity,
            title: "Mineur de cryptomonnaie".to_string(),
            description: "xmrig correspond à un mineur connu".to_string(),
            evidence: serde_json::json!({ "process_name": "xmrig", "pid": 4242 }),
            confidence: 95,
            detected_at: chrono::Utc::now(),
        }
    }

    fn network_alert(with_connection: bool) -> NetworkSecurityAlert {
        NetworkSecurityAlert {
            alert_type: agent_network::NetworkAlertType::C2Communication,
            severity: agent_network::AlertSeverity::Critical,
            title: "Connexion vers un serveur de commande".to_string(),
            description: "203.0.113.7:443 figure dans les indicateurs".to_string(),
            connection: with_connection.then(|| agent_network::types::NetworkConnection {
                protocol: agent_network::types::ConnectionProtocol::Tcp,
                local_address: "10.0.0.12".to_string(),
                local_port: 51000,
                remote_address: Some("203.0.113.7".to_string()),
                remote_port: Some(443),
                state: agent_network::types::ConnectionState::Established,
                pid: Some(4242),
                process_name: Some("xmrig".to_string()),
                process_path: None,
            }),
            evidence: serde_json::Value::Null,
            confidence: 90,
            detected_at: chrono::Utc::now(),
            iocs_matched: vec!["203.0.113.7".to_string()],
        }
    }

    #[test]
    fn incidents_are_rated_on_the_siem_scale() {
        let rated = |severity| incident_siem_event(&incident(severity), "poste-01").severity;
        assert_eq!(rated(IncidentSeverity::Critical), 9);
        assert_eq!(rated(IncidentSeverity::High), 7);
        assert_eq!(rated(IncidentSeverity::Medium), 5);
        assert_eq!(rated(IncidentSeverity::Low), 3);
    }

    #[test]
    fn an_incident_event_names_host_process_and_type() {
        let event = incident_siem_event(&incident(IncidentSeverity::High), "poste-01");
        assert_eq!(event.name, "Mineur de cryptomonnaie");
        assert_eq!(event.source_host, "poste-01");
        assert_eq!(event.process_name.as_deref(), Some("xmrig"));
        assert_eq!(
            event.custom_fields["incident_type"],
            format!("{}", IncidentType::CryptoMiner)
        );
        assert_eq!(event.custom_fields["confidence"], 95);
    }

    #[test]
    fn a_network_alert_event_carries_its_connection() {
        let event = network_alert_siem_event(&network_alert(true), "poste-01");
        assert_eq!(event.severity, 9);
        assert_eq!(event.source_ip.as_deref(), Some("10.0.0.12"));
        assert_eq!(event.destination_ip.as_deref(), Some("203.0.113.7"));
        assert_eq!(event.destination_port, Some(443));
        assert_eq!(event.custom_fields["iocs_matched"][0], "203.0.113.7");

        let bare = network_alert_siem_event(&network_alert(false), "poste-01");
        assert!(bare.source_ip.is_none() && bare.destination_ip.is_none());
        assert_eq!(bare.destination_port, None);
    }

    fn rule_match(rule_id: &str, targets: Vec<crate::threat_pipeline::RuleTarget>) -> RuleMatch {
        RuleMatch {
            rule_id: rule_id.to_string(),
            rule_name: "Mineur".to_string(),
            severity: "high".to_string(),
            matched_value: "xmrig".to_string(),
            confidence: 0.9,
            ai_classification: None,
            targets,
            matched_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn rule_matches_are_counted_per_rule() {
        let mut first = rule_match("rule-1", vec![]);
        first.matched_at -= chrono::Duration::minutes(5);
        let latest = rule_match("rule-1", vec![]);
        let counts = rule_match_counts(&[first, latest.clone(), rule_match("rule-2", vec![])]);
        assert_eq!(counts.len(), 2);
        assert_eq!(
            counts[0],
            ("rule-1".to_string(), 2, latest.matched_at.to_rfc3339())
        );
        assert_eq!(counts[1].1, 1);
    }

    #[test]
    fn a_rule_match_event_names_what_it_found() {
        use crate::threat_pipeline::RuleTarget;
        let event = rule_match_siem_event(
            &rule_match(
                "default-crypto-mining",
                vec![
                    RuleTarget::Process {
                        name: "xmrig".into(),
                        pid: 4242,
                    },
                    RuleTarget::Connection {
                        remote_ip: "203.0.113.7".into(),
                        port: 3333,
                    },
                ],
            ),
            "poste-01",
        );
        assert_eq!(event.name, "Règle « Mineur » déclenchée");
        assert_eq!(event.severity, 7);
        assert_eq!(event.process_name.as_deref(), Some("xmrig"));
        assert_eq!(event.process_id, Some(4242));
        assert_eq!(event.destination_ip.as_deref(), Some("203.0.113.7"));
        assert_eq!(event.destination_port, Some(3333));
        assert_eq!(event.custom_fields["rule_id"], "default-crypto-mining");
    }

    #[test]
    fn rule_matches_are_sent_with_their_trigger() {
        let payloads = detection_match_payloads(&[rule_match("rule-1", vec![])]);
        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0].rule_id, "rule-1");
        assert_eq!(payloads[0].trigger_details, "xmrig");
        assert_eq!(payloads[0].severity, "high");
    }

    #[test]
    fn playbook_logs_keep_their_outcome() {
        let id = uuid::Uuid::new_v4();
        let playbook_id = uuid::Uuid::new_v4();
        let payloads = playbook_log_payloads(&[agent_gui::dto::PlaybookLogEntry {
            id,
            playbook_id: playbook_id.to_string(),
            playbook_name: "Isoler le poste".to_string(),
            triggered_at: chrono::Utc::now(),
            trigger_event: "Mineur de cryptomonnaie".to_string(),
            actions_executed: vec!["kill_process".to_string()],
            success: false,
            error: Some("permission denied".to_string()),
        }]);
        assert_eq!(payloads[0].id, id.to_string());
        assert_eq!(payloads[0].playbook_id, playbook_id.to_string());
        assert_eq!(payloads[0].actions_executed, vec!["kill_process"]);
        assert!(!payloads[0].success);
        assert_eq!(payloads[0].error.as_deref(), Some("permission denied"));
    }

    #[tokio::test]
    async fn findings_reach_the_siem_even_without_rules_or_playbooks() {
        let test = standalone_runtime();
        test.runtime.init_siem_forwarder().await;
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let mut pass = LoopPass::new(false);
        pass.incidents.push(incident(IncidentSeverity::High));
        pass.network_alerts.push(network_alert(true));

        test.runtime.threat_pipeline_stage(&mut st, &mut pass).await;

        // Queued by the stage, recorded once the queue is sent.
        let queued = test.runtime.outbox.take_queued().await;
        assert!(matches!(queued.as_slice(), [Outbound::SiemFindings { .. }]));
        for item in queued {
            test.runtime.send_outbound(item).await;
        }
        let forwarder = test.runtime.siem_forwarder.read().await;
        let recorded = forwarder.as_ref().unwrap().take_recent_events().await;
        let names: Vec<&str> = recorded.iter().map(|event| event.name.as_str()).collect();
        assert_eq!(
            names,
            [
                "Mineur de cryptomonnaie",
                "Connexion vers un serveur de commande"
            ]
        );
    }

    #[tokio::test]
    async fn a_quiet_pass_records_nothing() {
        let test = standalone_runtime();
        test.runtime.init_siem_forwarder().await;
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);

        test.runtime
            .threat_pipeline_stage(&mut st, &mut LoopPass::new(false))
            .await;

        assert_eq!(test.runtime.outbox.unsent(), 0);
        let forwarder = test.runtime.siem_forwarder.read().await;
        assert!(
            forwarder
                .as_ref()
                .unwrap()
                .take_recent_events()
                .await
                .is_empty()
        );
    }

    #[tokio::test]
    async fn playbooks_are_loaded_only_when_something_was_flagged() {
        let test = standalone_runtime();
        let (rules, playbooks) = test.runtime.load_pipeline_rules(false).await;
        assert!(rules.is_empty() && playbooks.is_empty());
        let (_, playbooks) = test.runtime.load_pipeline_rules(true).await;
        assert!(playbooks.is_empty());
    }
}
