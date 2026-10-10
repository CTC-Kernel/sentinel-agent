// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Playbooks and detection rules edited or run from the interface.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use std::sync::Arc;

use agent_core::playbook_engine::{ActionResult, ResolvedAction};

use super::{CommandContext, expected};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::ExecutePlaybook { playbook_id } => execute_playbook(ctx, playbook_id).await,
        GuiCommand::TogglePlaybook {
            playbook_id,
            enabled,
        } => toggle_playbook(ctx, playbook_id, enabled).await,
        GuiCommand::SavePlaybook { playbook } => save_playbook(ctx, playbook).await,
        GuiCommand::DeletePlaybook { playbook_id } => delete_playbook(ctx, playbook_id).await,
        GuiCommand::SaveDetectionRule { rule } => save_detection_rule(ctx, rule).await,
        GuiCommand::DeleteDetectionRule { rule_id } => delete_detection_rule(ctx, rule_id).await,
        GuiCommand::ToggleDetectionRule { rule_id, enabled } => {
            toggle_detection_rule(ctx, rule_id, enabled).await
        }
        other => super::misrouted("playbooks", &other),
    }
}

/// Execute a playbook manually.
async fn execute_playbook(ctx: &mut CommandContext, playbook_id: String) {
    info!("[AUDIT] GUI requested playbook execution: {}", playbook_id);
    let tx = ctx.events.clone();
    let pid = playbook_id.clone();
    let db_clone = ctx.db.clone();
    let sync_client_clone = ctx.sync_client.clone();
    ctx.tasks
        .spawn_expected("execute playbook", expected::ACTION, async move {
            match load_playbook(db_clone.as_ref(), &pid).await {
                Some(playbook) => {
                    run_playbook_manually(playbook, db_clone, tx, sync_client_clone).await;
                }
                None => warn!("Cannot execute playbook '{}': not found in database", pid),
            }
        });
}

/// Load a playbook from the local database.
async fn load_playbook(
    db: Option<&Arc<agent_storage::Database>>,
    id: &str,
) -> Option<agent_gui::dto::Playbook> {
    let repo = agent_storage::repositories::grc::PlaybookRepository::new(db?);
    match repo.get_all().await {
        Ok(all) => all.into_iter().find(|s| s.id == id).map(|stored| {
            let actions: Vec<agent_gui::dto::PlaybookAction> =
                serde_json::from_str(&stored.steps).unwrap_or_default();
            agent_gui::dto::Playbook {
                id: stored.id.clone(),
                name: stored.name.clone(),
                description: stored.description.clone(),
                enabled: stored.enabled,
                conditions: vec![],
                actions,
                created_at: chrono::DateTime::parse_from_rfc3339(&stored.created_at)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now()),
                last_triggered: None,
                trigger_count: 0,
                is_template: false,
            }
        }),
        Err(e) => {
            warn!("Failed to load playbooks from database: {}", e);
            None
        }
    }
}

/// The actions a playbook runs when the operator starts it by hand: its
/// conditions are not evaluated, each action takes its target from its own
/// parameters. A kill without a readable `name:pid` is left out.
fn resolve_manual_actions(playbook: &agent_gui::dto::Playbook) -> Vec<ResolvedAction> {
    let mut resolved_actions = Vec::new();
    for action in &playbook.actions {
        match action.action_type {
            agent_gui::dto::PlaybookActionType::KillProcess => {
                // parameters format: "process_name:pid"
                let parts: Vec<&str> = action.parameters.splitn(2, ':').collect();
                if parts.len() == 2
                    && let Ok(pid_val) = parts[1].parse::<u32>()
                {
                    resolved_actions.push(ResolvedAction::KillProcess {
                        name: parts[0].to_string(),
                        pid: pid_val,
                    });
                }
            }
            agent_gui::dto::PlaybookActionType::QuarantineFile => {
                resolved_actions.push(ResolvedAction::QuarantineFile {
                    path: action.parameters.clone(),
                });
            }
            agent_gui::dto::PlaybookActionType::BlockIp => {
                // parameters format: "ip:duration_secs"
                let parts: Vec<&str> = action.parameters.splitn(2, ':').collect();
                let ip = parts.first().unwrap_or(&"").to_string();
                let duration = parts
                    .get(1)
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(3600);
                resolved_actions.push(ResolvedAction::BlockIp {
                    ip,
                    duration_secs: duration,
                });
            }
            agent_gui::dto::PlaybookActionType::IsolateHost => {
                resolved_actions.push(ResolvedAction::IsolateHost {
                    duration_secs: agent_core::playbook_engine::isolation_duration(
                        &action.parameters,
                    ),
                });
            }
            agent_gui::dto::PlaybookActionType::SendSiemAlert => {
                resolved_actions.push(ResolvedAction::Alert {
                    title: format!("Playbook '{}' SIEM alert", playbook.name),
                    severity: "medium".to_string(),
                    description: action.parameters.clone(),
                });
            }
            agent_gui::dto::PlaybookActionType::CreateNotification => {
                resolved_actions.push(ResolvedAction::Notify {
                    message: action.parameters.clone(),
                });
            }
        }
    }
    resolved_actions
}

/// The log entry of a manual execution: a success only when every action
/// succeeded, and there was at least one to run.
fn manual_log_entry(
    playbook: &agent_gui::dto::Playbook,
    results: &[ActionResult],
) -> agent_gui::dto::PlaybookLogEntry {
    let actions_executed: Vec<String> = results.iter().map(|r| r.action.clone()).collect();
    let all_success = !results.is_empty() && results.iter().all(|r| r.success);
    let first_error = if results.is_empty() {
        Some("No executable action resolved for the configured playbook".to_string())
    } else {
        results
            .iter()
            .find(|r| !r.success)
            .and_then(|r| r.error.clone())
    };

    agent_gui::dto::PlaybookLogEntry {
        id: uuid::Uuid::new_v4(),
        playbook_id: playbook.id.clone(),
        playbook_name: playbook.name.clone(),
        triggered_at: chrono::Utc::now(),
        trigger_event: "Manual execution".to_string(),
        actions_executed,
        success: all_success,
        error: first_error,
    }
}

/// Run the actions of a playbook started by hand, then log the execution
/// to the platform and to the interface.
async fn run_playbook_manually(
    playbook: agent_gui::dto::Playbook,
    db: Option<Arc<agent_storage::Database>>,
    tx: std::sync::mpsc::Sender<AgentEvent>,
    sync_client: Option<Arc<agent_sync::AuthenticatedClient>>,
) {
    // Execute playbook actions directly (manual trigger bypasses condition evaluation)
    let resolved_actions = resolve_manual_actions(&playbook);

    let results = {
        let audit_trail = db
            .as_ref()
            .map(|db| Arc::new(agent_core::audit_trail::LocalAuditTrail::new(db.clone())));
        agent_core::playbook_engine::execute_playbook_actions_with_delivery(
            &playbook.name,
            &resolved_actions,
            audit_trail.as_ref(),
            Some(&tx),
            None,
        )
        .await
    };

    // Build playbook log entry
    let log_entry = manual_log_entry(&playbook, &results);

    // Sync playbook log to platform
    if let Some(ref client) = sync_client {
        let payload = agent_sync::PlaybookLogPayload {
            id: log_entry.id.to_string(),
            playbook_id: log_entry.playbook_id.to_string(),
            playbook_name: log_entry.playbook_name.clone(),
            triggered_at: log_entry.triggered_at,
            trigger_event: log_entry.trigger_event.clone(),
            actions_executed: log_entry.actions_executed.clone(),
            success: log_entry.success,
            error: log_entry.error.clone(),
        };
        if let Err(e) = client.sync_playbook_logs(vec![payload]).await {
            tracing::warn!("Failed to sync manual playbook log: {}", e);
        }
    }

    // Emit PlaybookTriggered event to GUI
    let _ = tx.send(AgentEvent::PlaybookTriggered {
        log_entry: Box::new(log_entry),
    });
}

/// Toggle playbook enabled state.
async fn toggle_playbook(ctx: &mut CommandContext, playbook_id: String, enabled: bool) {
    info!(
        "[AUDIT] GUI toggled playbook {}: enabled={}",
        playbook_id, enabled
    );
    // Persist toggle to SQLite so it survives restarts
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let pid = playbook_id.clone();
        ctx.tasks
            .spawn_expected("toggle playbook", expected::SHORT, async move {
                let repo = agent_storage::repositories::grc::PlaybookRepository::new(&db_clone);
                match repo.get_all().await {
                    Ok(playbooks) => {
                        if let Some(mut pb) = playbooks.into_iter().find(|p| p.id == pid) {
                            pb.enabled = enabled;
                            pb.synced = false;
                            if let Err(e) = repo.upsert(&pb).await {
                                warn!("Failed to persist playbook toggle: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to load playbooks for toggle: {}", e);
                    }
                }
            });
    }
    // Remote sync
    if let Some(ref c) = ctx.sync_client {
        let c = std::sync::Arc::clone(c);
        let pid = playbook_id.clone();
        ctx.tasks
            .spawn_expected("toggle playbook: platform", expected::SHORT, async move {
                if let Err(e) = c.toggle_playbook(&pid, enabled).await {
                    warn!("Failed to sync playbook toggle: {}", e);
                }
            });
    }
}

/// Save or update a playbook.
async fn save_playbook(ctx: &mut CommandContext, playbook: Box<agent_gui::dto::Playbook>) {
    info!("[AUDIT] GUI saved playbook: {}", playbook.name);
    if let Some(ref trail) = ctx.audit_trail {
        let trail: std::sync::Arc<agent_core::audit_trail::LocalAuditTrail> =
            std::sync::Arc::clone(trail);
        let pb_name = playbook.name.clone();
        ctx.tasks
            .spawn_expected("save playbook: audit trail", expected::SHORT, async move {
                trail
                    .log(
                        agent_core::audit_trail::AuditAction::PlaybookActionExecuted {
                            playbook_name: pb_name,
                            action: "SAVE".to_string(),
                            success: true,
                        },
                        "user",
                        None,
                    )
                    .await;
            });
    }
    let payload = agent_core::sync_converters::playbook_to_payload(&playbook);
    // Persist to dedicated SQLite table for offline resilience
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let pb_clone = playbook.clone();
        let payload_clone = payload.clone();
        ctx.tasks
            .spawn_expected("save playbook", expected::SHORT, async move {
                let now = chrono::Utc::now().to_rfc3339();
                let stored = agent_storage::repositories::grc::StoredPlaybook {
                    id: pb_clone.id.to_string(),
                    name: pb_clone.name.clone(),
                    description: pb_clone.description.clone(),
                    trigger_type: "general".to_string(),
                    severity: "medium".to_string(),
                    steps: serde_json::to_string(&pb_clone.actions).unwrap_or_default(),
                    enabled: pb_clone.enabled,
                    created_at: pb_clone.created_at.to_rfc3339(),
                    updated_at: now,
                    synced: false,
                    conditions: serde_json::to_string(&pb_clone.conditions)
                        .unwrap_or_else(|_| "[]".to_string()),
                };
                let repo = agent_storage::repositories::grc::PlaybookRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist playbook to SQLite: {}", e);
                }
                if let Ok(json) = serde_json::to_string(&payload_clone) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Playbook,
                        pb_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
            });
    }
}

/// Delete a playbook.
async fn delete_playbook(ctx: &mut CommandContext, playbook_id: String) {
    info!(
        "[AUDIT] GUI requested durable playbook deletion: {}",
        playbook_id
    );
    if let Some(ref db_arc) = ctx.db {
        let db = std::sync::Arc::clone(db_arc);
        ctx.tasks
            .spawn_expected("delete playbook", expected::SHORT, async move {
                let queue = agent_storage::SyncQueueRepository::new(&db);
                if let Err(e) = queue
                    .delete_grc(agent_storage::SyncEntityType::Playbook, &playbook_id)
                    .await
                {
                    warn!("Failed to persist EDR deletion: {}", e);
                }
            });
    }
}

/// Save or update a detection rule.
async fn save_detection_rule(ctx: &mut CommandContext, rule: Box<agent_gui::dto::DetectionRule>) {
    info!("[AUDIT] GUI saved detection rule: {}", rule.name);
    let payload = agent_core::sync_converters::detection_rule_to_payload(&rule);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rule_clone = rule.clone();
        let payload_clone = payload.clone();
        ctx.tasks
            .spawn_expected("save detection rule", expected::SHORT, async move {
                let stored = agent_storage::repositories::grc::StoredDetectionRule {
                    id: rule_clone.id.to_string(),
                    name: rule_clone.name.clone(),
                    description: rule_clone.description.clone(),
                    severity: rule_clone.severity.as_str().to_string(),
                    conditions: serde_json::to_string(&rule_clone.conditions).unwrap_or_default(),
                    actions: serde_json::to_string(&rule_clone.actions).unwrap_or_default(),
                    enabled: rule_clone.enabled,
                    created_at: rule_clone.created_at.to_rfc3339(),
                    last_match: rule_clone.last_match.map(|d| d.to_rfc3339()),
                    match_count: rule_clone.match_count as i32,
                    synced: false,
                };
                let repo =
                    agent_storage::repositories::grc::DetectionRuleRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist detection rule to SQLite: {}", e);
                }
                if let Ok(json) = serde_json::to_string(&payload_clone) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::DetectionRule,
                        rule_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
            });
    }
}

/// Delete a detection rule.
async fn delete_detection_rule(ctx: &mut CommandContext, rule_id: String) {
    info!(
        "[AUDIT] GUI requested durable detection rule deletion: {}",
        rule_id
    );
    if let Some(ref db_arc) = ctx.db {
        let db = std::sync::Arc::clone(db_arc);
        ctx.tasks
            .spawn_expected("delete detection rule", expected::SHORT, async move {
                let queue = agent_storage::SyncQueueRepository::new(&db);
                if let Err(e) = queue
                    .delete_grc(agent_storage::SyncEntityType::DetectionRule, &rule_id)
                    .await
                {
                    warn!("Failed to persist EDR deletion: {}", e);
                }
            });
    }
}

/// Toggle detection rule enabled state.
async fn toggle_detection_rule(ctx: &mut CommandContext, rule_id: String, enabled: bool) {
    info!(
        "[AUDIT] GUI toggled detection rule {}: enabled={}",
        rule_id, enabled
    );
    // Persist toggle to SQLite so it survives restarts
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rid = rule_id.clone();
        ctx.tasks
            .spawn_expected("toggle detection rule", expected::SHORT, async move {
                let repo =
                    agent_storage::repositories::grc::DetectionRuleRepository::new(&db_clone);
                match repo.get_all().await {
                    Ok(rules) => {
                        if let Some(mut rule) = rules.into_iter().find(|r| r.id == rid) {
                            rule.enabled = enabled;
                            rule.synced = false;
                            if let Err(e) = repo.upsert(&rule).await {
                                warn!("Failed to persist detection rule toggle: {}", e);
                            }
                            // Queue for remote sync
                            let payload = agent_sync::types::DetectionRulePayload {
                                id: rule.id.clone(),
                                name: rule.name.clone(),
                                description: rule.description.clone(),
                                severity: rule.severity.clone(),
                                conditions: serde_json::from_str(&rule.conditions)
                                    .unwrap_or_default(),
                                actions: serde_json::from_str(&rule.actions).unwrap_or_default(),
                                enabled: rule.enabled,
                                created_at: chrono::DateTime::parse_from_rfc3339(&rule.created_at)
                                    .map(|dt| dt.with_timezone(&chrono::Utc))
                                    .unwrap_or_else(|_| chrono::Utc::now()),
                                last_match: rule.last_match.as_ref().and_then(|s| {
                                    chrono::DateTime::parse_from_rfc3339(s)
                                        .ok()
                                        .map(|dt| dt.with_timezone(&chrono::Utc))
                                }),
                                match_count: rule.match_count as u32,
                            };
                            if let Ok(json) = serde_json::to_string(&payload) {
                                let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                let entry = agent_storage::SyncQueueEntry::new(
                                    agent_storage::SyncEntityType::DetectionRule,
                                    rule.id.clone(),
                                    json,
                                );
                                let _ = repo2.enqueue(&entry).await;
                            }
                        }
                    }
                    Err(e) => warn!("Failed to load detection rules for toggle: {}", e),
                }
            });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_gui::dto::{Playbook, PlaybookAction, PlaybookActionType};

    fn playbook(actions: &[(PlaybookActionType, &str)]) -> Playbook {
        Playbook {
            id: "pb-1".to_string(),
            name: "Contenir le poste".to_string(),
            description: String::new(),
            enabled: true,
            conditions: Vec::new(),
            actions: actions
                .iter()
                .map(|(action_type, parameters)| PlaybookAction {
                    action_type: *action_type,
                    parameters: parameters.to_string(),
                })
                .collect(),
            created_at: chrono::Utc::now(),
            last_triggered: None,
            trigger_count: 0,
            is_template: false,
        }
    }

    fn result(action: &str, error: Option<&str>) -> ActionResult {
        ActionResult {
            action: action.to_string(),
            success: error.is_none(),
            error: error.map(str::to_string),
        }
    }

    #[test]
    fn a_manual_run_takes_each_target_from_the_action_parameters() {
        let resolved = resolve_manual_actions(&playbook(&[
            (PlaybookActionType::KillProcess, "xmrig:4242"),
            (PlaybookActionType::QuarantineFile, "/tmp/xmrig"),
            (PlaybookActionType::BlockIp, "203.0.113.7:600"),
            (PlaybookActionType::CreateNotification, "Poste contenu"),
        ]));

        assert!(matches!(
            resolved.as_slice(),
            [
                ResolvedAction::KillProcess { name, pid: 4242 },
                ResolvedAction::QuarantineFile { path },
                ResolvedAction::BlockIp { ip, duration_secs: 600 },
                ResolvedAction::Notify { message },
            ] if name == "xmrig" && path == "/tmp/xmrig" && ip == "203.0.113.7" && message == "Poste contenu"
        ));
    }

    #[test]
    fn a_block_without_a_duration_lasts_an_hour() {
        let resolved =
            resolve_manual_actions(&playbook(&[(PlaybookActionType::BlockIp, "203.0.113.7")]));
        assert!(matches!(
            resolved.as_slice(),
            [ResolvedAction::BlockIp {
                duration_secs: 3600,
                ..
            }]
        ));
    }

    #[test]
    fn a_kill_without_a_readable_pid_is_left_out() {
        for parameters in ["xmrig", "xmrig:not-a-pid", ""] {
            let resolved =
                resolve_manual_actions(&playbook(&[(PlaybookActionType::KillProcess, parameters)]));
            assert!(resolved.is_empty(), "{parameters:?}");
        }
    }

    #[test]
    fn a_manual_run_succeeds_only_when_every_action_did() {
        let pb = playbook(&[]);

        let ok = manual_log_entry(&pb, &[result("kill_process", None), result("notify", None)]);
        assert!(ok.success);
        assert_eq!(ok.error, None);
        assert_eq!(ok.actions_executed, ["kill_process", "notify"]);
        assert_eq!(ok.trigger_event, "Manual execution");
        assert_eq!(ok.playbook_id, "pb-1");

        let failed = manual_log_entry(
            &pb,
            &[
                result("kill_process", Some("permission denied")),
                result("notify", None),
            ],
        );
        assert!(!failed.success);
        assert_eq!(failed.error.as_deref(), Some("permission denied"));
    }

    #[test]
    fn a_manual_run_without_any_action_is_a_failure_that_says_so() {
        let entry = manual_log_entry(&playbook(&[]), &[]);
        assert!(!entry.success);
        assert_eq!(
            entry.error.as_deref(),
            Some("No executable action resolved for the configured playbook")
        );
    }

    #[tokio::test]
    async fn without_a_database_there_is_no_playbook_to_load() {
        assert!(load_playbook(None, "pb-1").await.is_none());
    }
}
