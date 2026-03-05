// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Playbook execution engine -- evaluates conditions and triggers response actions.
//!
//! This module evaluates playbook conditions against the current threat state
//! and executes the appropriate response chain. When the `llm` feature is
//! enabled, AI-powered confidence scoring enriches the evaluation.

#[cfg(all(feature = "gui", feature = "llm"))]
use tracing::debug;
use tracing::info;

/// Playbook condition evaluation result.
#[derive(Debug)]
pub struct PlaybookEvaluation {
    pub playbook_id: String,
    pub playbook_name: String,
    pub triggered: bool,
    pub matched_conditions: Vec<String>,
    pub confidence: f32,
    pub actions: Vec<ResolvedAction>,
}

/// A resolved action to execute as part of a playbook.
#[derive(Debug, Clone)]
pub enum ResolvedAction {
    KillProcess {
        name: String,
        pid: u32,
    },
    QuarantineFile {
        path: String,
    },
    BlockIp {
        ip: String,
        duration_secs: u64,
    },
    Alert {
        title: String,
        severity: String,
        description: String,
    },
    Notify {
        message: String,
    },
}

/// Result of a single playbook action execution.
#[derive(Debug)]
pub struct ActionResult {
    pub action: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Threat context for playbook evaluation.
///
/// Populated from the agent's security scan results, network alerts, and FIM
/// alerts so the playbook engine can check conditions against live data.
#[derive(Debug, Default)]
pub struct ThreatContext {
    pub suspicious_processes: Vec<ProcessInfo>,
    pub network_alerts: Vec<NetworkAlertInfo>,
    pub fim_alerts: Vec<FimAlertInfo>,
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub command_line: String,
}

#[derive(Debug, Clone)]
pub struct NetworkAlertInfo {
    pub remote_ip: Option<String>,
    pub port: Option<u16>,
    pub severity: String,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct FimAlertInfo {
    pub path: String,
    pub change_type: String,
}

/// Evaluate playbook conditions against the current threat context.
///
/// This function checks each enabled playbook's conditions against:
/// - Suspicious processes detected by the security scanner
/// - Network security alerts
/// - FIM alerts
///
/// When the `llm` feature is enabled and a service is available, AI confidence
/// scoring enriches the evaluation.
#[cfg(feature = "gui")]
pub async fn evaluate_playbook(
    playbook: &agent_gui::dto::Playbook,
    threat_context: &ThreatContext,
    #[cfg(feature = "llm")] llm_service: Option<&crate::llm_service::LLMService>,
) -> PlaybookEvaluation {
    use agent_gui::dto::PlaybookConditionType;

    let mut matched_conditions = Vec::new();
    let mut actions = Vec::new();
    let mut base_confidence: f32 = 0.0;

    if !playbook.enabled {
        return PlaybookEvaluation {
            playbook_id: playbook.id.to_string(),
            playbook_name: playbook.name.clone(),
            triggered: false,
            matched_conditions: vec![],
            confidence: 0.0,
            actions: vec![],
        };
    }

    // Evaluate each condition
    for condition in &playbook.conditions {
        let condition_value = condition.value.to_lowercase();

        match condition.condition_type {
            PlaybookConditionType::ProcessNameMatch => {
                for process in &threat_context.suspicious_processes {
                    if process.name.to_lowercase().contains(&condition_value) {
                        matched_conditions.push(format!(
                            "Process '{}' matches '{}'",
                            process.name, condition.value
                        ));
                        actions.push(ResolvedAction::KillProcess {
                            name: process.name.clone(),
                            pid: process.pid,
                        });
                        base_confidence += 0.3;
                    }
                }
            }
            PlaybookConditionType::NetworkAlertType => {
                for alert in &threat_context.network_alerts {
                    if alert.description.to_lowercase().contains(&condition_value)
                        || alert.severity.to_lowercase() == condition_value
                    {
                        matched_conditions
                            .push(format!("Network alert matches '{}'", condition.value));
                        if let Some(ref ip) = alert.remote_ip {
                            actions.push(ResolvedAction::BlockIp {
                                ip: ip.clone(),
                                duration_secs: 3600,
                            });
                        }
                        base_confidence += 0.3;
                    }
                }
            }
            PlaybookConditionType::FimChange => {
                for fim_alert in &threat_context.fim_alerts {
                    if fim_alert.path.to_lowercase().contains(&condition_value)
                        || fim_alert.change_type.to_lowercase() == condition_value
                    {
                        matched_conditions
                            .push(format!("FIM alert on path matching '{}'", condition.value));
                        actions.push(ResolvedAction::QuarantineFile {
                            path: fim_alert.path.clone(),
                        });
                        base_confidence += 0.3;
                    }
                }
            }
            PlaybookConditionType::SeverityThreshold => {
                for alert in &threat_context.network_alerts {
                    if alert.severity.to_lowercase() == condition_value {
                        matched_conditions
                            .push(format!("Severity '{}' matches threshold", condition.value));
                        base_confidence += 0.2;
                    }
                }
            }
            PlaybookConditionType::CvssScore => {
                // CVSS score matching -- requires numeric parsing
                if let Ok(threshold) = condition_value.parse::<f32>() {
                    for alert in &threat_context.network_alerts {
                        // If the alert description contains a CVSS-like score, compare
                        if alert.severity == "critical" && threshold <= 9.0
                            || alert.severity == "high" && threshold <= 7.0
                        {
                            matched_conditions.push(format!(
                                "CVSS threshold {:.1} matched by {} alert",
                                threshold, alert.severity
                            ));
                            base_confidence += 0.2;
                        }
                    }
                }
            }
        }
    }

    let triggered = !matched_conditions.is_empty();

    // Use the first condition's operator to determine AND/OR logic.
    // Default to "any" (OR) if no operator is set.
    let operator = playbook
        .conditions
        .first()
        .map(|c| c.operator.as_str())
        .unwrap_or("any");

    let actually_triggered = match operator {
        "all" | "and" | "AND" => matched_conditions.len() >= playbook.conditions.len(),
        _ => triggered, // "any" / "or" -- at least one match
    };

    // Add notification action for any triggered playbook
    if actually_triggered {
        actions.push(ResolvedAction::Alert {
            title: format!("Playbook '{}' triggered", playbook.name),
            severity: "medium".to_string(),
            description: format!("Conditions matched: {}", matched_conditions.join(", ")),
        });

        // Enhance confidence with LLM if available
        #[cfg(feature = "llm")]
        {
            if let Some(svc) = llm_service
                && svc.is_available().await
                && let Some(manager) = svc.get_manager().await
            {
                let event_desc = format!(
                    "Playbook '{}' triggered. Conditions: {}. Context: {} suspicious processes, {} network alerts, {} FIM alerts.",
                    playbook.name,
                    matched_conditions.join("; "),
                    threat_context.suspicious_processes.len(),
                    threat_context.network_alerts.len(),
                    threat_context.fim_alerts.len(),
                );
                let event = agent_llm::SecurityEvent {
                    id: uuid::Uuid::new_v4().to_string(),
                    event_type: "playbook_trigger".to_string(),
                    description: event_desc,
                    system_info: std::env::consts::OS.to_string(),
                    historical_context: String::new(),
                    timestamp: chrono::Utc::now(),
                    source: "playbook_engine".to_string(),
                    severity: "medium".to_string(),
                    raw_data: serde_json::json!({ "matched_conditions": matched_conditions }),
                };

                match manager.classifier().classify_event(&event).await {
                    Ok(classification) => {
                        // Use AI confidence to modulate base confidence
                        let ai_confidence = classification.confidence as f32 / 100.0;
                        base_confidence = (base_confidence + ai_confidence) / 2.0;
                        debug!("AI-enhanced playbook confidence: {:.2}", base_confidence);
                    }
                    Err(e) => {
                        debug!("LLM classification for playbook failed: {}", e);
                    }
                }
            }
        }
    }

    let confidence = base_confidence.clamp(0.0, 1.0);

    PlaybookEvaluation {
        playbook_id: playbook.id.to_string(),
        playbook_name: playbook.name.clone(),
        triggered: actually_triggered,
        matched_conditions,
        confidence,
        actions,
    }
}

/// Execute playbook actions and collect results.
pub async fn execute_playbook_actions(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
) -> Vec<ActionResult> {
    let mut results = Vec::new();

    for action in actions {
        let result = match action {
            ResolvedAction::KillProcess { name, pid } => {
                match crate::edr_actions::kill_process(name, *pid).await {
                    Ok(()) => ActionResult {
                        action: format!("Kill process {} (PID {})", name, pid),
                        success: true,
                        error: None,
                    },
                    Err(e) => ActionResult {
                        action: format!("Kill process {} (PID {})", name, pid),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            }
            ResolvedAction::QuarantineFile { path } => {
                match crate::edr_actions::quarantine_file(path).await {
                    Ok(_id) => ActionResult {
                        action: format!("Quarantine {}", path),
                        success: true,
                        error: None,
                    },
                    Err(e) => ActionResult {
                        action: format!("Quarantine {}", path),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            }
            ResolvedAction::BlockIp { ip, duration_secs } => {
                match crate::edr_actions::block_ip(ip, *duration_secs).await {
                    Ok(()) => ActionResult {
                        action: format!("Block IP {}", ip),
                        success: true,
                        error: None,
                    },
                    Err(e) => ActionResult {
                        action: format!("Block IP {}", ip),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            }
            ResolvedAction::Alert {
                title,
                severity,
                description,
            } => {
                info!(
                    "Playbook alert: [{}] {} -- {}",
                    severity, title, description
                );
                ActionResult {
                    action: format!("Alert: {}", title),
                    success: true,
                    error: None,
                }
            }
            ResolvedAction::Notify { message } => {
                info!("Playbook notification: {}", message);
                ActionResult {
                    action: format!("Notify: {}", message),
                    success: true,
                    error: None,
                }
            }
        };

        if let Some(trail) = audit_trail {
            trail.log(crate::audit_trail::AuditAction::PlaybookActionExecuted {
                playbook_name: playbook_name.to_string(),
                action: result.action.clone(),
                success: result.success,
            }, "system", result.error.clone()).await;
        }

        results.push(result);
    }

    results
}
