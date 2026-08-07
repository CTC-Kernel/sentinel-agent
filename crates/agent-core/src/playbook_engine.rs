// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Playbook execution engine -- evaluates conditions and triggers response actions.
//!
//! This module evaluates playbook conditions against the current threat state
//! and executes the appropriate response chain. When the `llm` feature is
//! enabled, AI-powered confidence scoring enriches the evaluation.

#[cfg(all(feature = "gui", feature = "llm"))]
use tracing::debug;
use tracing::{info, warn};

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
                        if (alert.severity == "critical" && threshold <= 9.0)
                            || (alert.severity == "high" && threshold <= 7.0)
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

/// Decide whether a playbook fires, given how many of its conditions matched.
///
/// `conditions_matched` counts distinct *conditions*, not matched entities: one
/// `ProcessNameMatch` condition can match many processes. Conflating the two is
/// what made a two-condition "all" playbook fire on a single condition that
/// happened to hit two processes, quietly turning a narrow rule into a
/// disjunctive one.
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
        _ => Ok(()),
    }
}

/// Execute playbook actions and collect results.
pub async fn execute_playbook_actions(
    playbook_name: &str,
    actions: &[ResolvedAction],
    audit_trail: Option<&std::sync::Arc<crate::audit_trail::LocalAuditTrail>>,
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
    /// layer.
    #[tokio::test]
    async fn destructive_actions_are_capped_per_run() {
        let over_cap = MAX_DESTRUCTIVE_ACTIONS_PER_RUN + 3;
        let actions: Vec<ResolvedAction> = (0..over_cap)
            .map(|i| ResolvedAction::QuarantineFile {
                path: format!("/nonexistent-sentinel-cap-test-{}", i),
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

#[cfg(all(test, feature = "gui"))]
mod tests {
    use super::*;
    use agent_gui::dto::{Playbook, PlaybookCondition, PlaybookConditionType};

    fn make_playbook(conditions: Vec<PlaybookCondition>) -> Playbook {
        Playbook {
            id: uuid::Uuid::new_v4(),
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

    #[tokio::test]
    async fn matching_process_name_kills_only_the_match() {
        let pb = make_playbook(vec![PlaybookCondition {
            condition_type: PlaybookConditionType::ProcessNameMatch,
            operator: "any".to_string(),
            value: "evil".to_string(),
        }]);
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
}
