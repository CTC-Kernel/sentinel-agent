// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Response actions asked for from the interface: stop a process, quarantine a
//! file, block an address, isolate the host.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use super::CommandContext;

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::AcknowledgeFimAlert {
            alert_id,
            path,
            timestamp,
        } => acknowledge_fim_alert(ctx, alert_id, path, timestamp).await,
        GuiCommand::KillProcess { process_name, pid } => kill_process(ctx, process_name, pid).await,
        GuiCommand::QuarantineFile { path } => quarantine_file(ctx, path).await,
        GuiCommand::RestoreQuarantinedFile { quarantine_id } => {
            restore_quarantined_file(ctx, quarantine_id).await
        }
        GuiCommand::BlockIp { ip, duration_secs } => block_ip(ctx, ip, duration_secs).await,
        GuiCommand::UnblockIp { ip } => unblock_ip(ctx, ip).await,
        GuiCommand::IsolateHost { duration_secs } => isolate_host(ctx, duration_secs).await,
        GuiCommand::ReleaseHost => release_host(ctx).await,
        other => super::misrouted("response", &other),
    }
}

/// Acknowledge a FIM alert.
async fn acknowledge_fim_alert(
    ctx: &mut CommandContext,
    alert_id: String,
    path: String,
    timestamp: chrono::DateTime<chrono::Utc>,
) {
    info!("[AUDIT] GUI acknowledged FIM alert: {}", alert_id);
    // Report acknowledgment to the platform. `alert_id` is
    // local to the desktop app: the platform derives its
    // document id from (agent, path, upload timestamp).
    let client_clone = ctx.sync_client.clone();
    let aid = alert_id.clone();
    tokio::spawn(async move {
        if let Some(ref client) = client_clone {
            match client.agent_id().await {
                Ok(agent_id) => {
                    let body = agent_sync::types::fim_acknowledge_body(&path, &timestamp);
                    let result: Result<serde_json::Value, _> = client
                        .post_json(
                            &format!("/v1/agents/{}/fim-alerts/{}/acknowledge", agent_id, aid),
                            &body,
                        )
                        .await;
                    if let Err(e) = result {
                        warn!("Failed to acknowledge FIM alert on platform: {}", e);
                    }
                }
                Err(e) => warn!("Failed to get agent_id for FIM ack: {}", e),
            }
        }
    });
}

/// Kill a suspicious process.
async fn kill_process(ctx: &mut CommandContext, process_name: String, pid: u32) {
    info!(
        "[AUDIT] GUI requested process kill: {} (PID {})",
        process_name, pid
    );
    let tx = ctx.events.clone();
    let pname = process_name.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        // Emit pending action before executing
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::KillProcess,
                target: pname.clone(),
                target_detail: format!("PID {}", pid),
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        match agent_core::edr_actions::kill_process(&pname, pid).await {
            Ok(()) => {
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                warn!("Kill process failed: {}", e);
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    });
}

/// Quarantine a file (move to secure location).
async fn quarantine_file(ctx: &mut CommandContext, path: String) {
    info!("[AUDIT] GUI requested file quarantine: {}", path);
    let tx = ctx.events.clone();
    let file_path = path.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        // Emit pending action before executing
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::QuarantineFile,
                target: file_path.clone(),
                target_detail: String::new(),
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        match agent_core::edr_actions::quarantine_file(&file_path).await {
            Ok(quarantine_id) => {
                info!("File quarantined successfully: {}", quarantine_id);
                // Emit quarantine entry
                let _ = tx.send(AgentEvent::FileQuarantined {
                    entry: agent_gui::dto::QuarantinedFile {
                        id: uuid::Uuid::parse_str(&quarantine_id)
                            .unwrap_or_else(|_| uuid::Uuid::new_v4()),
                        original_path: file_path.clone(),
                        sha256: String::new(),
                        size_bytes: 0,
                        quarantined_at: chrono::Utc::now(),
                        reason: "User-initiated quarantine".to_string(),
                        restored: false,
                    },
                });
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                warn!("Quarantine file failed: {}", e);
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    });
}

/// Restore a quarantined file to its original location.
async fn restore_quarantined_file(ctx: &mut CommandContext, quarantine_id: String) {
    info!(
        "[AUDIT] GUI requested quarantine restore: {}",
        quarantine_id
    );
    let tx = ctx.events.clone();
    let qid = quarantine_id.clone();
    // Emit pending action before spawning async work
    let action_id = uuid::Uuid::new_v4();
    let _ = tx.send(AgentEvent::ResponseActionSubmitted {
        action: agent_gui::dto::ResponseAction {
            id: action_id,
            action_type: agent_gui::dto::ResponseActionType::RestoreFile,
            target: quarantine_id.clone(),
            target_detail: String::new(),
            status: agent_gui::dto::ResponseStatus::Pending,
            created_at: chrono::Utc::now(),
            completed_at: None,
            error: None,
        },
    });
    tokio::spawn(async move {
        match agent_core::edr_actions::restore_quarantined_file(&qid).await {
            Ok(()) => {
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                warn!("Restore quarantined file failed: {}", e);
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    });
}

/// Block an IP address via firewall rules.
async fn block_ip(ctx: &mut CommandContext, ip: String, duration_secs: u64) {
    info!(
        "[AUDIT] GUI requested IP block: {} ({}s)",
        ip, duration_secs
    );
    let tx = ctx.events.clone();
    let ip_addr = ip.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        // Emit pending action before executing
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::BlockIp,
                target: ip_addr.clone(),
                target_detail: format!("{}s", duration_secs),
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        match agent_core::edr_actions::block_ip(&ip_addr, duration_secs).await {
            Ok(()) => {
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                warn!("Block IP failed: {}", e);
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    });
}

/// Unblock a previously blocked IP address.
async fn unblock_ip(ctx: &mut CommandContext, ip: String) {
    info!("[AUDIT] GUI requested IP unblock: {}", ip);
    let tx = ctx.events.clone();
    let ip_addr = ip.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        // Emit pending action before executing
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::UnblockIp,
                target: ip_addr.clone(),
                target_detail: "unblock".to_string(),
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        match agent_core::edr_actions::unblock_ip(&ip_addr).await {
            Ok(()) => {
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                warn!("Unblock IP failed: {}", e);
                let _ = tx.send(AgentEvent::ResponseActionResult {
                    action_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    });
}

/// Cut the endpoint off the network (the platform stays reachable).
async fn isolate_host(ctx: &mut CommandContext, duration_secs: u64) {
    info!(
        "[AUDIT] GUI requested host isolation for {}s (0: until released)",
        duration_secs
    );
    let tx = ctx.events.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::IsolateHost,
                target: "Ce poste".to_string(),
                target_detail: if duration_secs == 0 {
                    "jusqu'à levée manuelle".to_string()
                } else {
                    format!("{} min", duration_secs / 60)
                },
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        let result = agent_core::host_isolation::isolate_host(
            "Action manuelle depuis l'interface",
            duration_secs,
        )
        .await;
        if let Err(e) = &result {
            warn!("Host isolation failed: {}", e);
        }
        let _ = tx.send(AgentEvent::ResponseActionResult {
            action_id,
            success: result.is_ok(),
            error: result.err().map(|e| e.to_string()),
        });
    });
}

/// Lift the network isolation of the endpoint.
async fn release_host(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI requested the host isolation to be lifted");
    let tx = ctx.events.clone();
    tokio::spawn(async move {
        let action_id = uuid::Uuid::new_v4();
        let _ = tx.send(AgentEvent::ResponseActionSubmitted {
            action: agent_gui::dto::ResponseAction {
                id: action_id,
                action_type: agent_gui::dto::ResponseActionType::ReleaseHost,
                target: "Ce poste".to_string(),
                target_detail: "levée de l'isolation".to_string(),
                status: agent_gui::dto::ResponseStatus::Pending,
                created_at: chrono::Utc::now(),
                completed_at: None,
                error: None,
            },
        });
        let result = agent_core::host_isolation::release_host().await;
        if let Err(e) = &result {
            warn!("Lifting the host isolation failed: {}", e);
        }
        let _ = tx.send(AgentEvent::ResponseActionResult {
            action_id,
            success: result.is_ok(),
            error: result.err().map(|e| e.to_string()),
        });
    });
}
