// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The response stage of the main loop: what the detection stages gathered
//! in this pass goes through the detection rules and the playbooks.

use agent_common::constants::AGENT_VERSION;
use tracing::{debug, info, warn};

use super::{LoopPass, LoopState};
use crate::{AgentRuntime, siem_enrichment, threat_pipeline, triage_allowlist};

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

            // Load detection rules and playbooks from the database
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

                if flagged_activity {
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
                )
                .await;
                drop(siem_delivery);

                if let Some(ref client) = self.authenticated_client {
                    // Upload detection matches to the platform
                    if !pipeline_result.rule_matches.is_empty() {
                        let match_payloads: Vec<agent_sync::DetectionMatchPayload> =
                            pipeline_result
                                .rule_matches
                                .iter()
                                .map(|m| agent_sync::DetectionMatchPayload {
                                    rule_id: m.rule_id.clone(),
                                    rule_name: m.rule_name.clone(),
                                    matched_at: chrono::Utc::now(),
                                    trigger_details: m.matched_value.clone(),
                                    severity: m.severity.clone(),
                                })
                                .collect();
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
                        let log_payloads: Vec<agent_sync::PlaybookLogPayload> = pipeline_result
                            .playbook_logs
                            .iter()
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
                            .collect();
                        match client.sync_playbook_logs(log_payloads).await {
                            Ok(resp) => {
                                info!("Uploaded {} playbook logs to platform", resp.received_count)
                            }
                            Err(e) => warn!("Failed to upload playbook logs: {}", e),
                        }
                    }
                }
            }

            // Forward security incidents and network alerts to SIEM (record for platform + optional external)
            let siem_guard = self.siem_forwarder.read().await;
            if let Some(siem) = siem_guard.as_ref() {
                let host = hostname::get()
                    .map(|h| h.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Security incidents → SIEM
                for inc in &pass.incidents {
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
                    let mut event = agent_siem::SiemEvent {
                        timestamp: inc.detected_at,
                        severity,
                        category: agent_siem::EventCategory::Security,
                        name: inc.title.clone(),
                        description: inc.description.clone(),
                        source_host: host.clone(),
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
                    };
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
                        warn!(
                            "Failed to forward security incident to external SIEM: {}",
                            e
                        );
                    }
                }

                // Network alerts → SIEM
                for alert in &pass.network_alerts {
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
                    let mut event = agent_siem::SiemEvent {
                        timestamp: alert.detected_at,
                        severity,
                        category: agent_siem::EventCategory::Network,
                        name: alert.title.clone(),
                        description: alert.description.clone(),
                        source_host: host.clone(),
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
                    };
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
                        warn!("Failed to forward network alert to external SIEM: {}", e);
                    }
                }

                if !pass.incidents.is_empty() || !pass.network_alerts.is_empty() {
                    info!(
                        "Forwarded {} security incidents and {} network alerts to SIEM",
                        pass.incidents.len(),
                        pass.network_alerts.len(),
                    );
                }
            }
            drop(siem_guard);
        }
    }
}
