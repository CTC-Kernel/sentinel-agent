// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Autonomous threat detection -> classification -> response pipeline.
//!
//! After each security scan cycle, this module:
//! 1. Evaluates detection rules against live threat data and against the
//!    activity observed on the host (every process and connection, flagged
//!    or not)
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

/// A connection with a remote peer, observed on the host.
#[derive(Debug, Clone)]
pub struct ObservedConnection {
    pub remote_ip: String,
    pub port: u16,
    pub process_name: Option<String>,
}

/// Activity observed on the host during one pass of the main loop, whether or
/// not a detection engine flagged it.
///
/// Only the custom detection rules read it. Playbooks keep evaluating the
/// [`ThreatContext`] alone: they act on the host, so they stay bound to what
/// an engine has flagged.
#[derive(Debug, Default)]
pub struct ObservedActivity {
    pub processes: Vec<ProcessInfo>,
    pub connections: Vec<ObservedConnection>,
}

impl ObservedActivity {
    pub fn is_empty(&self) -> bool {
        self.processes.is_empty() && self.connections.is_empty()
    }

    /// Record processes seen by the scanner. The agent's own process is left
    /// out, as in the scanner, so a rule cannot match the agent itself.
    pub fn add_processes<'a>(
        &mut self,
        processes: impl IntoIterator<Item = &'a agent_scanner::security::process_monitor::ProcessInfo>,
    ) {
        let own_pid = std::process::id();
        self.processes.extend(
            processes
                .into_iter()
                .filter(|p| p.pid != own_pid && !p.name.trim().is_empty())
                .map(|p| ProcessInfo {
                    name: p.name.clone(),
                    pid: p.pid,
                    command_line: p.cmdline.clone().unwrap_or_default(),
                }),
        );
    }

    /// Record the connections that have a remote peer.
    pub fn add_connections(&mut self, connections: &[agent_network::types::NetworkConnection]) {
        self.connections.extend(connections.iter().filter_map(|c| {
            let remote_ip = c.remote_address.as_deref()?.trim();
            let port = c.remote_port.filter(|port| *port != 0)?;
            (!remote_ip.is_empty()).then(|| ObservedConnection {
                remote_ip: remote_ip.to_string(),
                port,
                process_name: c.process_name.clone(),
            })
        }));
    }
}

/// Observations a rule has already reported, so that a long-running process or
/// a persistent connection is reported when it appears, not at every scan.
#[derive(Debug, Default)]
pub struct RuleHitMemory {
    reported: std::collections::HashMap<String, std::time::Instant>,
}

impl RuleHitMemory {
    /// An observation that is still present is reported again after this delay.
    pub const REMINDER: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);
    /// Observations remembered; beyond it the oldest half is forgotten.
    const CAPACITY: usize = 20_000;

    /// Whether `key` is to be reported now. It is then remembered.
    fn report(&mut self, key: String, now: std::time::Instant) -> bool {
        if let Some(at) = self.reported.get(&key)
            && now.saturating_duration_since(*at) < Self::REMINDER
        {
            return false;
        }
        if self.reported.len() >= Self::CAPACITY {
            self.forget_oldest(now);
        }
        self.reported.insert(key, now);
        true
    }

    fn forget_oldest(&mut self, now: std::time::Instant) {
        self.reported
            .retain(|_, at| now.saturating_duration_since(*at) < Self::REMINDER);
        if self.reported.len() < Self::CAPACITY {
            return;
        }
        let mut ages: Vec<std::time::Instant> = self.reported.values().copied().collect();
        ages.sort_unstable();
        let median = ages[ages.len() / 2];
        self.reported.retain(|_, at| *at > median);
    }
}

/// What a rule condition found in the observed activity and has not reported
/// yet: a description of the first observation and the number of others.
fn observed_match(
    rule_id: &str,
    condition: &agent_gui::dto::DetectionCondition,
    observed: &ObservedActivity,
    memory: &mut RuleHitMemory,
    now: std::time::Instant,
) -> Option<String> {
    use agent_gui::dto::DetectionConditionType as Kind;

    let needle = condition.value.to_lowercase();
    let mut new_hits: Vec<String> = Vec::new();
    match condition.condition_type {
        Kind::ProcessNameContains | Kind::CommandLineContains => {
            let by_name = condition.condition_type == Kind::ProcessNameContains;
            for process in &observed.processes {
                let haystack = if by_name {
                    &process.name
                } else {
                    &process.command_line
                };
                if !haystack.to_lowercase().contains(&needle) {
                    continue;
                }
                let key = format!(
                    "{rule_id}\u{1f}process\u{1f}{}\u{1f}{}",
                    process.pid,
                    process.name.to_lowercase()
                );
                if memory.report(key, now) {
                    new_hits.push(if by_name {
                        format!("Process: {} (PID {})", process.name, process.pid)
                    } else {
                        format!(
                            "Command line match in process {} (PID {})",
                            process.name, process.pid
                        )
                    });
                }
            }
        }
        Kind::NetworkPort => {
            let port = condition.value.trim().parse::<u16>().ok()?;
            for connection in observed.connections.iter().filter(|c| c.port == port) {
                let key = format!(
                    "{rule_id}\u{1f}connection\u{1f}{}\u{1f}{port}",
                    connection.remote_ip
                );
                if memory.report(key, now) {
                    new_hits.push(match &connection.process_name {
                        Some(process) if !process.trim().is_empty() => {
                            format!("Connection to {}:{port} by {process}", connection.remote_ip)
                        }
                        _ => format!("Connection to {}:{port}", connection.remote_ip),
                    });
                }
            }
        }
        // File changes and alert severities are not raw activity: they are
        // matched in the threat context.
        Kind::FimPathMatch | Kind::SeverityLevel => {}
    }

    let others = new_hits.len().saturating_sub(1);
    let first = new_hits.into_iter().next()?;
    Some(if others > 0 {
        format!("{first} (+{others} more)")
    } else {
        first
    })
}

/// Evaluate all enabled detection rules against the current threat context
/// and the activity observed on the host.
///
/// A condition matches what a detection engine flagged (`context`) or, for
/// process names, command lines and ports, anything observed on the host
/// (`observed`). An observation is reported once: `memory` remembers it.
///
/// Returns a list of matched rules.
pub fn evaluate_detection_rules(
    rules: &[agent_gui::dto::DetectionRule],
    context: &ThreatContext,
    observed: &ObservedActivity,
    memory: &mut RuleHitMemory,
) -> Vec<RuleMatch> {
    use agent_gui::dto::DetectionConditionType;

    let now = std::time::Instant::now();
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

            // Always evaluated, so what the engines flagged is remembered too
            // and not reported a second time as a plain observation.
            let observed_hit = observed_match(&rule.id, condition, observed, memory, now);

            if let Some(matched_value) = matched.or(observed_hit) {
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
#[allow(clippy::too_many_arguments)]
pub async fn run_threat_pipeline(
    rules: &[agent_gui::dto::DetectionRule],
    playbooks: &[agent_gui::dto::Playbook],
    context: &ThreatContext,
    observed: &ObservedActivity,
    rule_memory: &mut RuleHitMemory,
    gui_tx: &Option<std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
    #[cfg(feature = "llm")] llm_service: Option<&crate::llm_service::LLMService>,
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
    siem: Option<&agent_siem::SiemForwarder>,
) -> PipelineResult {
    // Step 1: Evaluate detection rules
    #[allow(unused_mut)]
    let mut matches = evaluate_detection_rules(rules, context, observed, rule_memory);

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

    /// Rules evaluated on what the engines flagged only, as before raw activity.
    fn evaluate(
        rules: &[agent_gui::dto::DetectionRule],
        context: &ThreatContext,
    ) -> Vec<RuleMatch> {
        evaluate_detection_rules(
            rules,
            context,
            &ObservedActivity::default(),
            &mut RuleHitMemory::default(),
        )
    }

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
                assert!(evaluate(&[rule.clone()], &context).is_empty());
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
            assert_eq!(evaluate(&[rule.clone()], &context).len(), count);
        }
        rule.enabled = false;
        assert!(evaluate(&[rule], &context).is_empty());
    }

    fn rule_with(
        kind: agent_gui::dto::DetectionConditionType,
        value: &str,
    ) -> agent_gui::dto::DetectionRule {
        agent_gui::dto::DetectionRule {
            id: "rule-1".into(),
            name: "test".into(),
            description: String::new(),
            severity: agent_gui::dto::Severity::High,
            conditions: vec![agent_gui::dto::DetectionCondition {
                condition_type: kind,
                value: value.into(),
            }],
            actions: vec![],
            enabled: true,
            created_at: chrono::Utc::now(),
            last_match: None,
            match_count: 0,
        }
    }

    fn process(name: &str, pid: u32, command_line: &str) -> ProcessInfo {
        ProcessInfo {
            name: name.into(),
            pid,
            command_line: command_line.into(),
        }
    }

    #[test]
    fn rules_match_processes_no_engine_flagged_and_report_them_once() {
        use agent_gui::dto::DetectionConditionType as Kind;
        let nothing_flagged = ThreatContext::default();
        let observed = ObservedActivity {
            processes: vec![
                process(
                    "AnyDesk",
                    4312,
                    "/Applications/AnyDesk.app/AnyDesk --service",
                ),
                process("Safari", 900, "/Applications/Safari.app/Safari"),
            ],
            connections: vec![],
        };
        let mut memory = RuleHitMemory::default();

        let by_name = rule_with(Kind::ProcessNameContains, "anydesk");
        let matches = evaluate_detection_rules(
            std::slice::from_ref(&by_name),
            &nothing_flagged,
            &observed,
            &mut memory,
        );
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].matched_value, "Process: AnyDesk (PID 4312)");
        // The process is still running at the next scan: not reported again.
        assert!(
            evaluate_detection_rules(&[by_name], &nothing_flagged, &observed, &mut memory)
                .is_empty()
        );

        let mut by_command = rule_with(Kind::CommandLineContains, "--SERVICE");
        by_command.id = "rule-2".into();
        let matches = evaluate_detection_rules(
            &[by_command],
            &nothing_flagged,
            &observed,
            &mut RuleHitMemory::default(),
        );
        assert_eq!(
            matches[0].matched_value,
            "Command line match in process AnyDesk (PID 4312)"
        );
    }

    #[test]
    fn several_new_observations_of_a_condition_make_one_match() {
        use agent_gui::dto::DetectionConditionType as Kind;
        let observed = ObservedActivity {
            processes: vec![
                process("helper", 10, ""),
                process("helper", 11, ""),
                process("helper", 12, ""),
            ],
            connections: vec![],
        };
        let mut memory = RuleHitMemory::default();
        let rule = rule_with(Kind::ProcessNameContains, "helper");
        let matches = evaluate_detection_rules(
            std::slice::from_ref(&rule),
            &ThreatContext::default(),
            &observed,
            &mut memory,
        );
        assert_eq!(matches.len(), 1);
        assert_eq!(
            matches[0].matched_value,
            "Process: helper (PID 10) (+2 more)"
        );

        // A new instance appears among the known ones: it alone is reported.
        let observed = ObservedActivity {
            processes: vec![process("helper", 10, ""), process("helper", 13, "")],
            connections: vec![],
        };
        let matches =
            evaluate_detection_rules(&[rule], &ThreatContext::default(), &observed, &mut memory);
        assert_eq!(matches[0].matched_value, "Process: helper (PID 13)");
    }

    #[test]
    fn port_rules_match_observed_connections_only_on_the_exact_port() {
        use agent_gui::dto::DetectionConditionType as Kind;
        let observed = ObservedActivity {
            processes: vec![],
            connections: vec![
                ObservedConnection {
                    remote_ip: "203.0.113.7".into(),
                    port: 3389,
                    process_name: Some("mstsc".into()),
                },
                ObservedConnection {
                    remote_ip: "203.0.113.8".into(),
                    port: 33890,
                    process_name: None,
                },
            ],
        };
        let mut memory = RuleHitMemory::default();
        let rule = rule_with(Kind::NetworkPort, "3389");
        let matches = evaluate_detection_rules(
            std::slice::from_ref(&rule),
            &ThreatContext::default(),
            &observed,
            &mut memory,
        );
        assert_eq!(matches.len(), 1);
        assert_eq!(
            matches[0].matched_value,
            "Connection to 203.0.113.7:3389 by mstsc"
        );
        assert!(
            evaluate_detection_rules(&[rule], &ThreatContext::default(), &observed, &mut memory)
                .is_empty()
        );
    }

    #[test]
    fn file_and_severity_rules_ignore_raw_activity() {
        use agent_gui::dto::DetectionConditionType as Kind;
        let observed = ObservedActivity {
            processes: vec![process("high", 10, "/etc/passwd high")],
            connections: vec![ObservedConnection {
                remote_ip: "203.0.113.7".into(),
                port: 22,
                process_name: None,
            }],
        };
        for (kind, value) in [(Kind::FimPathMatch, "passwd"), (Kind::SeverityLevel, "low")] {
            assert!(
                evaluate_detection_rules(
                    &[rule_with(kind, value)],
                    &ThreatContext::default(),
                    &observed,
                    &mut RuleHitMemory::default(),
                )
                .is_empty()
            );
        }
    }

    #[test]
    fn a_flagged_process_is_not_reported_again_as_a_plain_observation() {
        use agent_gui::dto::DetectionConditionType as Kind;
        let flagged = ThreatContext {
            suspicious_processes: vec![process("nc", 77, "nc -l 4444")],
            ..Default::default()
        };
        let observed = ObservedActivity {
            processes: vec![process("nc", 77, "nc -l 4444")],
            connections: vec![],
        };
        let mut memory = RuleHitMemory::default();
        let rule = rule_with(Kind::ProcessNameContains, "nc");
        assert_eq!(
            evaluate_detection_rules(
                std::slice::from_ref(&rule),
                &flagged,
                &observed,
                &mut memory
            )
            .len(),
            1
        );
        // Next scan: the engine no longer flags it, the process is still there.
        assert!(
            evaluate_detection_rules(&[rule], &ThreatContext::default(), &observed, &mut memory)
                .is_empty()
        );
    }

    #[test]
    fn an_observation_is_reported_again_after_the_reminder_delay() {
        let mut memory = RuleHitMemory::default();
        let start = std::time::Instant::now();
        assert!(memory.report("rule\u{1f}process\u{1f}1\u{1f}x".into(), start));
        let before = start + RuleHitMemory::REMINDER - std::time::Duration::from_secs(1);
        assert!(!memory.report("rule\u{1f}process\u{1f}1\u{1f}x".into(), before));
        let after = start + RuleHitMemory::REMINDER;
        assert!(memory.report("rule\u{1f}process\u{1f}1\u{1f}x".into(), after));
    }

    #[test]
    fn the_memory_stays_bounded() {
        let mut memory = RuleHitMemory::default();
        let start = std::time::Instant::now();
        for i in 0..(RuleHitMemory::CAPACITY + 10) {
            let at = start + std::time::Duration::from_millis(i as u64);
            assert!(memory.report(format!("key-{i}"), at));
        }
        assert!(memory.reported.len() <= RuleHitMemory::CAPACITY);
        // The most recent observations are the ones kept.
        let last = format!("key-{}", RuleHitMemory::CAPACITY + 9);
        assert!(memory.reported.contains_key(&last));
    }

    #[test]
    fn observed_activity_leaves_out_the_agent_and_peerless_connections() {
        use agent_scanner::security::process_monitor::ProcessInfo as Scanned;
        let scanned = |pid: u32, name: &str| Scanned {
            pid,
            name: name.into(),
            path: None,
            cmdline: Some(format!("{name} --flag")),
            ppid: None,
            user: None,
        };
        let mut observed = ObservedActivity::default();
        assert!(observed.is_empty());
        observed.add_processes(&[
            scanned(std::process::id(), "agent"),
            scanned(42, "bash"),
            scanned(43, "  "),
        ]);
        assert_eq!(observed.processes.len(), 1);
        assert_eq!(observed.processes[0].command_line, "bash --flag");
        assert!(!observed.is_empty());
    }
}
