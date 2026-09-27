// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Autonomous threat detection -> classification -> response pipeline.
//!
//! After each security scan cycle, this module:
//! 1. Evaluates detection rules against live threat data
//! 2. Classifies matched threats with AI (when LLM available)
//! 3. Triggers matching playbooks automatically
//! 4. Emits events to the GUI for visibility

use crate::playbook_engine::{FimAlertInfo, NetworkAlertInfo, ProcessInfo, ThreatContext};
#[cfg(feature = "llm")]
use tracing::debug;
use tracing::{info, warn};

/// A detection rule match result.
#[derive(Debug, Clone)]
pub struct RuleMatch {
    pub rule_id: String,
    pub rule_name: String,
    pub severity: String,
    pub matched_value: String,
    pub confidence: f32,
    pub ai_classification: Option<String>,
}

/// Evaluate all enabled detection rules against the current threat context.
///
/// Returns a list of matched rules.
pub fn evaluate_detection_rules(
    rules: &[agent_gui::dto::DetectionRule],
    context: &ThreatContext,
) -> Vec<RuleMatch> {
    use agent_gui::dto::DetectionConditionType;

    let mut matches = Vec::new();

    for rule in rules {
        if !rule.enabled {
            continue;
        }

        for condition in &rule.conditions {
            // An empty substring matches every entity; malformed rules must not fire.
            if condition.value.trim().is_empty() {
                continue;
            }
            let matched = match condition.condition_type {
                DetectionConditionType::ProcessNameContains => context
                    .suspicious_processes
                    .iter()
                    .find(|p| {
                        p.name
                            .to_lowercase()
                            .contains(&condition.value.to_lowercase())
                    })
                    .map(|p| format!("Process: {} (PID {})", p.name, p.pid)),
                DetectionConditionType::CommandLineContains => context
                    .suspicious_processes
                    .iter()
                    .find(|p| {
                        p.command_line
                            .to_lowercase()
                            .contains(&condition.value.to_lowercase())
                    })
                    .map(|p| format!("Command line match in process {} (PID {})", p.name, p.pid)),
                DetectionConditionType::NetworkPort => {
                    if let Ok(port) = condition.value.parse::<u16>() {
                        context
                            .network_alerts
                            .iter()
                            .find(|a| a.port == Some(port))
                            .map(|a| format!("Network alert on port {}: {}", port, a.description))
                    } else {
                        None
                    }
                }
                DetectionConditionType::FimPathMatch => context
                    .fim_alerts
                    .iter()
                    .find(|f| {
                        f.path
                            .to_lowercase()
                            .contains(&condition.value.to_lowercase())
                    })
                    .map(|f| format!("FIM: {} ({})", f.path, f.change_type)),
                DetectionConditionType::SeverityLevel => {
                    // Match if any alert has severity >= threshold
                    let Some(threshold) = severity_to_level(&condition.value) else {
                        continue;
                    };
                    context
                        .network_alerts
                        .iter()
                        .find(|a| {
                            severity_to_level(&a.severity).is_some_and(|level| level >= threshold)
                        })
                        .map(|a| format!("Severity {} >= {}", a.severity, condition.value))
                }
            };

            if let Some(matched_value) = matched {
                matches.push(RuleMatch {
                    rule_id: rule.id.to_string(),
                    rule_name: rule.name.clone(),
                    severity: rule.severity.as_str().to_string(),
                    matched_value,
                    confidence: 0.7, // Deterministic rule confidence; AI is advisory.
                    ai_classification: None,
                });
            }
        }
    }

    matches
}

/// Annotate rule matches with advisory AI classification without suppressing evidence.
#[cfg(feature = "llm")]
pub async fn ai_classify_matches(
    matches: &mut [RuleMatch],
    llm_service: &crate::llm_service::LLMService,
) {
    if !llm_service.is_available().await {
        return;
    }

    let manager = match llm_service.get_manager().await {
        Some(m) => m,
        None => return,
    };

    for rule_match in matches.iter_mut().take(10) {
        let event = agent_llm::SecurityEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: format!("detection_rule:{}", rule_match.rule_id),
            description: format!(
                "Detection rule '{}' matched: {}",
                rule_match.rule_name, rule_match.matched_value
            ),
            system_info: std::env::consts::OS.to_string(),
            historical_context: String::new(),
            timestamp: chrono::Utc::now(),
            source: "detection_engine".to_string(),
            severity: rule_match.severity.clone(),
            raw_data: serde_json::json!({
                "rule_name": rule_match.rule_name,
                "matched_value": rule_match.matched_value,
            }),
        };

        match manager.classifier().classify_event(&event).await {
            Ok(classification) => {
                // AI enriches evidence but cannot erase or promote the rule verdict.
                // Model confidence is recorded in the annotation only.
                rule_match.ai_classification = Some(format!(
                    "{:?} (threat: {:?}, confidence: {}%)",
                    classification.threat_type,
                    classification.threat_level,
                    classification.confidence,
                ));
                debug!(
                    "AI classified rule '{}': {:?} confidence={}%",
                    rule_match.rule_name, classification.threat_type, classification.confidence
                );
            }
            Err(e) => {
                debug!(
                    "AI classification failed for rule '{}': {}",
                    rule_match.rule_name, e
                );
            }
        }
    }
}

/// Result of running the full threat pipeline.
pub struct PipelineResult {
    /// Detection rule matches (for upload to platform).
    pub rule_matches: Vec<RuleMatch>,
    /// Playbook execution log entries (for upload to platform).
    pub playbook_logs: Vec<agent_gui::dto::PlaybookLogEntry>,
}

/// Run the full autonomous pipeline: detect -> classify -> respond.
///
/// Call this after each security scan cycle in the main loop.
/// Returns the detection rule matches and playbook logs for sync to the platform.
pub async fn run_threat_pipeline(
    rules: &[agent_gui::dto::DetectionRule],
    playbooks: &[agent_gui::dto::Playbook],
    context: &ThreatContext,
    gui_tx: &Option<std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
    #[cfg(feature = "llm")] llm_service: Option<&crate::llm_service::LLMService>,
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
    siem: Option<&agent_siem::SiemForwarder>,
) -> PipelineResult {
    // Step 1: Evaluate detection rules
    #[allow(unused_mut)]
    let mut matches = evaluate_detection_rules(rules, context);

    info!(
        "Threat pipeline: {} detection rule matches found",
        matches.len()
    );

    // Step 2: AI classification (if available)
    #[cfg(feature = "llm")]
    if let Some(svc) = llm_service {
        ai_classify_matches(&mut matches, svc).await;
    }

    // Step 3: Find and trigger matching playbooks
    let mut playbook_logs = Vec::new();
    for playbook in playbooks {
        if !playbook.enabled {
            continue;
        }

        let evaluation = crate::playbook_engine::evaluate_playbook(
            playbook,
            context,
            #[cfg(feature = "llm")]
            llm_service,
        )
        .await;

        if evaluation.triggered {
            info!(
                "Playbook '{}' triggered with confidence {:.2}",
                evaluation.playbook_name, evaluation.confidence
            );

            // Execute the playbook actions
            let results = crate::playbook_engine::execute_playbook_actions_with_delivery(
                &evaluation.playbook_name,
                &evaluation.actions,
                audit_trail,
                gui_tx.as_ref(),
                siem,
            )
            .await;

            let success_count = results.iter().filter(|r| r.success).count();
            let total = results.len();

            info!(
                "Playbook '{}' executed: {}/{} actions succeeded",
                evaluation.playbook_name, success_count, total
            );

            // Build playbook log entry
            let log_entry = agent_gui::dto::PlaybookLogEntry {
                id: uuid::Uuid::new_v4(),
                playbook_id: playbook.id.clone(),
                playbook_name: evaluation.playbook_name.clone(),
                triggered_at: chrono::Utc::now(),
                trigger_event: evaluation.matched_conditions.join("; "),
                actions_executed: results.iter().map(|r| r.action.clone()).collect(),
                success: total > 0 && success_count == total,
                error: if total == 0 {
                    Some("No executable action resolved for the configured playbook".into())
                } else if success_count < total {
                    Some(
                        results
                            .iter()
                            .filter_map(|r| r.error.as_ref())
                            .cloned()
                            .collect::<Vec<_>>()
                            .join("; "),
                    )
                } else {
                    None
                },
            };

            // Collect for platform sync
            playbook_logs.push(log_entry.clone());

            // Emit playbook triggered event to GUI
            if let Some(tx) = gui_tx
                && let Err(e) = tx.send(agent_gui::events::AgentEvent::PlaybookTriggered {
                    log_entry: Box::new(log_entry),
                })
            {
                warn!("Failed to send PlaybookTriggered event: {}", e);
            }
        }
    }

    // Step 4: Emit rule match notifications
    for rule_match in &matches {
        if let Some(tx) = gui_tx {
            let notification = agent_gui::dto::GuiNotification {
                id: uuid::Uuid::new_v4(),
                title: format!("Regle '{}' declenchee", rule_match.rule_name),
                body: format!(
                    "{}\nConfiance: {:.0}%{}",
                    rule_match.matched_value,
                    rule_match.confidence * 100.0,
                    rule_match
                        .ai_classification
                        .as_ref()
                        .map(|c| format!("\nClassification IA: {}", c))
                        .unwrap_or_default()
                ),
                severity: rule_match.severity.clone(),
                timestamp: chrono::Utc::now(),
                read: false,
                action: None,
            };

            if let Err(e) = tx.send(agent_gui::events::AgentEvent::Notification { notification }) {
                warn!("Failed to send detection rule notification: {}", e);
            }
        }
    }

    PipelineResult {
        rule_matches: matches,
        playbook_logs,
    }
}

/// Convert a single stored detection rule to GUI DTO.
pub fn stored_rule_to_single_dto(
    s: &agent_storage::repositories::grc::StoredDetectionRule,
) -> agent_gui::dto::DetectionRule {
    let id = s.id.clone();
    let severity = match s.severity.to_lowercase().as_str() {
        "critical" => agent_gui::dto::Severity::Critical,
        "high" => agent_gui::dto::Severity::High,
        "medium" => agent_gui::dto::Severity::Medium,
        "low" => agent_gui::dto::Severity::Low,
        "info" => agent_gui::dto::Severity::Info,
        _ => agent_gui::dto::Severity::Medium,
    };
    let conditions = serde_json::from_str::<Vec<agent_gui::dto::DetectionCondition>>(&s.conditions);
    let actions = serde_json::from_str::<Vec<agent_gui::dto::PlaybookActionType>>(&s.actions);
    let valid = conditions.is_ok() && actions.is_ok();
    if !valid {
        warn!(
            "Detection rule {} disabled: incompatible conditions or actions",
            s.id
        );
    }
    let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());
    agent_gui::dto::DetectionRule {
        id,
        name: s.name.clone(),
        description: s.description.clone(),
        severity,
        conditions: conditions.unwrap_or_default(),
        actions: actions.unwrap_or_default(),
        enabled: s.enabled && valid,
        created_at,
        last_match: s
            .last_match
            .as_deref()
            .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc)),
        match_count: s.match_count.max(0) as u32,
    }
}

/// Convert stored detection rules from the database into GUI DTOs for pipeline evaluation.
pub fn stored_rules_to_dto(
    stored: &[agent_storage::repositories::grc::StoredDetectionRule],
) -> Vec<agent_gui::dto::DetectionRule> {
    stored.iter().map(stored_rule_to_single_dto).collect()
}

/// Convert a single stored playbook to GUI DTO.
pub fn stored_playbook_to_single_dto(
    s: &agent_storage::repositories::grc::StoredPlaybook,
) -> agent_gui::dto::Playbook {
    let id = s.id.clone();
    let actions = serde_json::from_str::<Vec<agent_gui::dto::PlaybookAction>>(&s.steps);
    let conditions = serde_json::from_str::<Vec<agent_gui::dto::PlaybookCondition>>(&s.conditions);
    let valid = conditions.is_ok() && actions.is_ok();
    if !valid {
        warn!(
            "Playbook {} disabled: incompatible conditions or actions",
            s.id
        );
    }
    let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());
    agent_gui::dto::Playbook {
        id,
        name: s.name.clone(),
        description: s.description.clone(),
        enabled: s.enabled && valid,
        conditions: conditions.unwrap_or_default(),
        actions: actions.unwrap_or_default(),
        created_at,
        last_triggered: None,
        trigger_count: 0,
        is_template: false,
    }
}

/// Convert stored playbooks from the database into GUI DTOs for pipeline evaluation.
pub fn stored_playbooks_to_dto(
    stored: &[agent_storage::repositories::grc::StoredPlaybook],
) -> Vec<agent_gui::dto::Playbook> {
    stored.iter().map(stored_playbook_to_single_dto).collect()
}

/// Build a `ThreatContext` from security scan incidents, network alerts, and FIM alerts.
///
/// This is the glue function that converts heterogeneous scan results into
/// the unified `ThreatContext` consumed by the detection and playbook engines.
pub fn build_threat_context(
    incidents: &[agent_scanner::SecurityIncident],
    network_alerts: &[agent_network::NetworkSecurityAlert],
    fim_alerts: &[(String, String)], // (path, change_type)
) -> ThreatContext {
    let suspicious_processes = incidents
        .iter()
        .filter_map(|incident| {
            // Consume any incident carrying valid process evidence, including
            // malware and credential theft, not only three incident categories.
            let evidence = &incident.evidence;
            let name = evidence.get("process_name").and_then(|v| v.as_str())?;
            let pid = u32::try_from(evidence.get("pid")?.as_u64()?).ok()?;
            if !name.trim().is_empty() && pid > 1 {
                let command_line = evidence
                    .get("cmdline")
                    .and_then(|v| v.as_str())
                    .or_else(|| evidence.get("command_line").and_then(|v| v.as_str()))
                    .unwrap_or("")
                    .to_string();
                Some(ProcessInfo {
                    name: name.to_string(),
                    pid,
                    command_line,
                })
            } else {
                None
            }
        })
        .collect();

    let net_alerts = network_alerts
        .iter()
        .map(|alert| {
            let severity_str = match alert.severity {
                agent_network::types::AlertSeverity::Critical => "critical",
                agent_network::types::AlertSeverity::High => "high",
                agent_network::types::AlertSeverity::Medium => "medium",
                agent_network::types::AlertSeverity::Low => "low",
            };
            let (remote_ip, port) = if let Some(conn) = &alert.connection {
                (conn.remote_address.clone(), conn.remote_port)
            } else {
                (None, None)
            };
            NetworkAlertInfo {
                remote_ip,
                port,
                severity: severity_str.to_string(),
                description: alert.description.clone(),
            }
        })
        .collect();

    let fim = fim_alerts
        .iter()
        .map(|(path, change_type)| FimAlertInfo {
            path: path.clone(),
            change_type: change_type.clone(),
        })
        .collect();

    ThreatContext {
        suspicious_processes,
        network_alerts: net_alerts,
        fim_alerts: fim,
    }
}

fn severity_to_level(severity: &str) -> Option<u8> {
    match severity.trim().to_lowercase().as_str() {
        "critical" => Some(4),
        "high" => Some(3),
        "medium" => Some(2),
        "low" => Some(1),
        "info" => Some(0),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};

    fn incident(kind: IncidentType, evidence: serde_json::Value) -> SecurityIncident {
        SecurityIncident::new(kind, IncidentSeverity::High, "test", "test").with_evidence(evidence)
    }

    #[test]
    fn process_evidence_preserves_arguments_and_all_threat_categories() {
        for kind in [
            IncidentType::SuspiciousProcess,
            IncidentType::Malware,
            IncidentType::CredentialTheft,
            IncidentType::CryptoMiner,
            IncidentType::ReverseShell,
            IncidentType::PrivilegeEscalation,
        ] {
            let context = build_threat_context(
                &[incident(
                    kind,
                    serde_json::json!({
                        "process_name": "powershell", "pid": 42,
                        "path": "C:/powershell.exe", "cmdline": "powershell -EncodedCommand example"
                    }),
                )],
                &[],
                &[],
            );
            assert_eq!(context.suspicious_processes.len(), 1);
            assert_eq!(
                context.suspicious_processes[0].command_line,
                "powershell -EncodedCommand example"
            );
        }
    }

    #[test]
    fn invalid_process_identity_is_not_converted_to_an_action_target() {
        for pid in [0_u64, 1, u32::MAX as u64 + 42, u64::MAX] {
            let context = build_threat_context(
                &[incident(
                    IncidentType::Malware,
                    serde_json::json!({"process_name": "test", "pid": pid}),
                )],
                &[],
                &[],
            );
            assert!(context.suspicious_processes.is_empty());
        }
        let context = build_threat_context(
            &[incident(
                IncidentType::Malware,
                serde_json::json!({"pid": 42}),
            )],
            &[],
            &[],
        );
        assert!(context.suspicious_processes.is_empty());
    }

    #[test]
    fn command_line_alias_is_supported_but_path_is_not_a_command_line() {
        for (extra, expected) in [
            (
                serde_json::json!({"command_line": "sh -c test"}),
                "sh -c test",
            ),
            (serde_json::json!({"path": "/tmp/-encodedcommand"}), ""),
        ] {
            let mut evidence = serde_json::json!({"process_name": "sh", "pid": 42});
            evidence
                .as_object_mut()
                .unwrap()
                .extend(extra.as_object().unwrap().clone());
            let context = build_threat_context(
                &[incident(IncidentType::SuspiciousProcess, evidence)],
                &[],
                &[],
            );
            assert_eq!(context.suspicious_processes[0].command_line, expected);
        }
    }

    #[test]
    fn malformed_detection_conditions_do_not_match_live_context() {
        use agent_gui::dto::{
            DetectionCondition, DetectionConditionType as Kind, DetectionRule, Severity,
        };
        let context = ThreatContext {
            suspicious_processes: vec![ProcessInfo {
                name: "powershell".into(),
                pid: 42,
                command_line: "powershell -enc example".into(),
            }],
            network_alerts: vec![NetworkAlertInfo {
                remote_ip: None,
                port: Some(443),
                severity: "high".into(),
                description: "invalid-port".into(),
            }],
            fim_alerts: vec![FimAlertInfo {
                path: "/tmp/test".into(),
                change_type: "modified".into(),
            }],
        };
        let mut rule = DetectionRule {
            id: uuid::Uuid::new_v4().to_string(),
            name: "test".into(),
            description: String::new(),
            severity: Severity::High,
            conditions: vec![],
            actions: vec![],
            enabled: true,
            created_at: chrono::Utc::now(),
            last_match: None,
            match_count: 0,
        };
        for kind in Kind::all() {
            for value in ["", "   "] {
                rule.conditions = vec![DetectionCondition {
                    condition_type: *kind,
                    value: value.into(),
                }];
                assert!(evaluate_detection_rules(&[rule.clone()], &context).is_empty());
            }
        }
        for (kind, value, count) in [
            (Kind::NetworkPort, "invalid-port", 0),
            (Kind::SeverityLevel, "typo", 0),
            (Kind::NetworkPort, "443", 1),
            (Kind::SeverityLevel, "medium", 1),
            (Kind::CommandLineContains, "-ENC", 1),
        ] {
            rule.conditions = vec![DetectionCondition {
                condition_type: kind,
                value: value.into(),
            }];
            assert_eq!(
                evaluate_detection_rules(&[rule.clone()], &context).len(),
                count
            );
        }
        rule.enabled = false;
        assert!(evaluate_detection_rules(&[rule], &context).is_empty());
    }
}
