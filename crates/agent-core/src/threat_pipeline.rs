//! Autonomous threat detection -> classification -> response pipeline.
//!
//! After each security scan cycle, this module:
//! 1. Evaluates detection rules against live threat data
//! 2. Classifies matched threats with AI (when LLM available)
//! 3. Triggers matching playbooks automatically
//! 4. Emits events to the GUI for visibility

#[cfg(feature = "gui")]
use tracing::{info, warn, debug};
use crate::playbook_engine::{ThreatContext, ProcessInfo, NetworkAlertInfo, FimAlertInfo};

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
#[cfg(feature = "gui")]
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
            let matched = match condition.condition_type {
                DetectionConditionType::ProcessNameContains => {
                    context.suspicious_processes.iter().find(|p| {
                        p.name.to_lowercase().contains(&condition.value.to_lowercase())
                    }).map(|p| format!("Process: {} (PID {})", p.name, p.pid))
                }
                DetectionConditionType::CommandLineContains => {
                    context.suspicious_processes.iter().find(|p| {
                        p.command_line.to_lowercase().contains(&condition.value.to_lowercase())
                    }).map(|p| format!("Command line match in process {} (PID {})", p.name, p.pid))
                }
                DetectionConditionType::NetworkPort => {
                    if let Ok(port) = condition.value.parse::<u16>() {
                        context.network_alerts.iter().find(|a| {
                            a.port == Some(port)
                        }).map(|a| format!("Network alert on port {}: {}", port, a.description))
                    } else {
                        // Fallback: text match on description
                        context.network_alerts.iter().find(|a| {
                            a.description.to_lowercase().contains(&condition.value.to_lowercase())
                        }).map(|a| format!("Network alert: {}", a.description))
                    }
                }
                DetectionConditionType::FimPathMatch => {
                    context.fim_alerts.iter().find(|f| {
                        f.path.to_lowercase().contains(&condition.value.to_lowercase())
                    }).map(|f| format!("FIM: {} ({})", f.path, f.change_type))
                }
                DetectionConditionType::SeverityLevel => {
                    // Match if any alert has severity >= threshold
                    let threshold = severity_to_level(&condition.value);
                    context.network_alerts.iter().find(|a| {
                        severity_to_level(&a.severity) >= threshold
                    }).map(|a| format!("Severity {} >= {}", a.severity, condition.value))
                }
            };

            if let Some(matched_value) = matched {
                matches.push(RuleMatch {
                    rule_id: rule.id.to_string(),
                    rule_name: rule.name.clone(),
                    severity: rule.severity.as_str().to_string(),
                    matched_value,
                    confidence: 0.7, // Base confidence, enhanced by AI
                    ai_classification: None,
                });
            }
        }
    }

    matches
}

/// Classify rule matches with AI and filter false positives.
#[cfg(all(feature = "gui", feature = "llm"))]
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
                rule_match.confidence = classification.confidence as f32 / 100.0;
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
                debug!("AI classification failed for rule '{}': {}", rule_match.rule_name, e);
            }
        }
    }
}

/// Run the full autonomous pipeline: detect -> classify -> respond.
///
/// Call this after each security scan cycle in the main loop.
/// Returns the list of detection rule matches for sync to the platform.
#[cfg(feature = "gui")]
pub async fn run_threat_pipeline(
    rules: &[agent_gui::dto::DetectionRule],
    playbooks: &[agent_gui::dto::Playbook],
    context: &ThreatContext,
    gui_tx: &Option<std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
    #[cfg(feature = "llm")]
    llm_service: Option<&crate::llm_service::LLMService>,
) -> Vec<RuleMatch> {
    // Step 1: Evaluate detection rules
    #[allow(unused_mut)]
    let mut matches = evaluate_detection_rules(rules, context);

    if matches.is_empty() {
        debug!("Threat pipeline: no detection rule matches");
        return Vec::new();
    }

    info!("Threat pipeline: {} detection rule matches found", matches.len());

    // Step 2: AI classification (if available)
    #[cfg(feature = "llm")]
    if let Some(svc) = llm_service {
        ai_classify_matches(&mut matches, svc).await;

        // Filter out low-confidence matches (likely false positives)
        let before = matches.len();
        matches.retain(|m| m.confidence >= 0.3);
        if before != matches.len() {
            info!(
                "AI filtered {} low-confidence matches ({} remaining)",
                before - matches.len(), matches.len()
            );
        }
    }

    // Step 3: Find and trigger matching playbooks
    for playbook in playbooks {
        if !playbook.enabled {
            continue;
        }

        let evaluation = crate::playbook_engine::evaluate_playbook(
            playbook,
            context,
            #[cfg(feature = "llm")]
            llm_service,
        ).await;

        if evaluation.triggered && evaluation.confidence >= 0.3 {
            info!(
                "Playbook '{}' triggered with confidence {:.2}",
                evaluation.playbook_name, evaluation.confidence
            );

            // Execute the playbook actions
            let results = crate::playbook_engine::execute_playbook_actions(&evaluation.actions).await;

            let success_count = results.iter().filter(|r| r.success).count();
            let total = results.len();

            info!(
                "Playbook '{}' executed: {}/{} actions succeeded",
                evaluation.playbook_name, success_count, total
            );

            // Emit playbook triggered event to GUI
            if let Some(tx) = gui_tx {
                let log_entry = agent_gui::dto::PlaybookLogEntry {
                    id: uuid::Uuid::new_v4(),
                    playbook_id: playbook.id,
                    playbook_name: evaluation.playbook_name.clone(),
                    triggered_at: chrono::Utc::now(),
                    trigger_event: evaluation.matched_conditions.join("; "),
                    actions_executed: results.iter().map(|r| r.action.clone()).collect(),
                    success: success_count == total,
                    error: if success_count < total {
                        Some(results.iter()
                            .filter_map(|r| r.error.as_ref())
                            .cloned()
                            .collect::<Vec<_>>()
                            .join("; "))
                    } else {
                        None
                    },
                };

                if let Err(e) = tx.send(agent_gui::events::AgentEvent::PlaybookTriggered {
                    log_entry: Box::new(log_entry),
                }) {
                    warn!("Failed to send PlaybookTriggered event: {}", e);
                }
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
                    rule_match.ai_classification.as_ref()
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

    matches
}

/// Convert stored detection rules from the database into GUI DTOs for pipeline evaluation.
#[cfg(feature = "gui")]
pub fn stored_rules_to_dto(
    stored: &[agent_storage::repositories::grc::StoredDetectionRule],
) -> Vec<agent_gui::dto::DetectionRule> {
    stored.iter().filter_map(|s| {
        let id = uuid::Uuid::parse_str(&s.id).ok()?;
        let severity = match s.severity.to_lowercase().as_str() {
            "critical" => agent_gui::dto::Severity::Critical,
            "high" => agent_gui::dto::Severity::High,
            "medium" => agent_gui::dto::Severity::Medium,
            "low" => agent_gui::dto::Severity::Low,
            "info" => agent_gui::dto::Severity::Info,
            _ => agent_gui::dto::Severity::Medium,
        };
        let conditions: Vec<agent_gui::dto::DetectionCondition> =
            serde_json::from_str(&s.conditions).unwrap_or_default();
        let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());

        Some(agent_gui::dto::DetectionRule {
            id,
            name: s.name.clone(),
            description: s.description.clone(),
            severity,
            conditions,
            actions: Vec::new(), // Actions are resolved at playbook level
            enabled: s.enabled,
            created_at,
            last_match: None,
            match_count: 0,
        })
    }).collect()
}

/// Convert stored playbooks from the database into GUI DTOs for pipeline evaluation.
#[cfg(feature = "gui")]
pub fn stored_playbooks_to_dto(
    stored: &[agent_storage::repositories::grc::StoredPlaybook],
) -> Vec<agent_gui::dto::Playbook> {
    stored.iter().filter_map(|s| {
        let id = uuid::Uuid::parse_str(&s.id).ok()?;
        let actions: Vec<agent_gui::dto::PlaybookAction> =
            serde_json::from_str(&s.steps).unwrap_or_default();
        let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());

        Some(agent_gui::dto::Playbook {
            id,
            name: s.title.clone(),
            description: s.description.clone(),
            enabled: s.status == "active",
            conditions: Vec::new(), // Conditions stored separately
            actions,
            created_at,
            last_triggered: None,
            trigger_count: 0,
            is_template: false,
        })
    }).collect()
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
    let suspicious_processes = incidents.iter().filter_map(|incident| {
        if incident.incident_type == agent_scanner::IncidentType::SuspiciousProcess
            || incident.incident_type == agent_scanner::IncidentType::CryptoMiner
            || incident.incident_type == agent_scanner::IncidentType::ReverseShell
        {
            let name = incident.evidence.get("process_name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let pid = incident.evidence.get("pid")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;
            let command_line = incident.evidence.get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Some(ProcessInfo { name, pid, command_line })
        } else {
            None
        }
    }).collect();

    let net_alerts = network_alerts.iter().map(|alert| {
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
    }).collect();

    let fim = fim_alerts.iter().map(|(path, change_type)| {
        FimAlertInfo {
            path: path.clone(),
            change_type: change_type.clone(),
        }
    }).collect();

    ThreatContext {
        suspicious_processes,
        network_alerts: net_alerts,
        fim_alerts: fim,
    }
}

#[cfg(feature = "gui")]
fn severity_to_level(severity: &str) -> u8 {
    match severity.to_lowercase().as_str() {
        "critical" => 4,
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        "info" => 0,
        _ => 1,
    }
}
