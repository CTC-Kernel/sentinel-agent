// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Control of the running agent from the interface: pause, shutdown, the
//! checks, syncs and remediations it is asked for, and its notifications.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{debug, error, info, warn};

use super::{CommandContext, Flow};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) -> Flow {
    match command {
        GuiCommand::Pause => pause(ctx).await,
        GuiCommand::Resume => resume(ctx).await,
        GuiCommand::Shutdown => return shutdown(ctx).await,
        GuiCommand::Restart => return restart(ctx).await,
        GuiCommand::RunCheck => run_check(ctx).await,
        GuiCommand::ForceSync => force_sync(ctx).await,
        GuiCommand::RunSync => run_sync(ctx).await,
        GuiCommand::StartDiscovery => start_discovery(ctx).await,
        GuiCommand::StopDiscovery => stop_discovery(ctx).await,
        GuiCommand::RefreshMdmDeployments => refresh_mdm_deployments(ctx).await,
        GuiCommand::CheckUpdate => check_update(ctx).await,
        GuiCommand::ProposeAsset {
            ip,
            hostname,
            device_type,
        } => propose_asset(ctx, ip, hostname, device_type).await,
        GuiCommand::Remediate { check_id } => remediate(ctx, check_id).await,
        GuiCommand::RemediatePreview { check_id } => remediate_preview(ctx, check_id).await,
        GuiCommand::ApplyAiRemediation { action } => apply_ai_remediation(ctx, action).await,
        GuiCommand::ConnectToPlatform => connect_to_platform().await,
        GuiCommand::GetSummary => get_summary().await,
        GuiCommand::GetCheckResults => get_check_results().await,
        GuiCommand::MarkNotificationRead { notification_id } => {
            mark_notification_read(ctx, notification_id).await
        }
        GuiCommand::MarkAllNotificationsRead => mark_all_notifications_read(ctx).await,
        GuiCommand::DeleteNotification { notification_id } => {
            delete_notification(ctx, notification_id).await
        }
        GuiCommand::SaveNotification { notification } => {
            save_notification(ctx, *notification).await
        }
        GuiCommand::LoadNotifications { limit } => load_notifications(ctx, limit).await,
        // Expanded by the dispatcher before it reaches a group.
        GuiCommand::RestoreSettings { .. } => {}
        // Requests to a background service: they leave the interface on
        // the service channel. Without one there is nobody to ask, and the
        // interface checks the administrator password itself.
        GuiCommand::ServiceAdminUnlock { .. }
        | GuiCommand::ServiceAdminSetPassword { .. }
        | GuiCommand::ServiceAdminLock => {
            debug!("Administrator request for a service, but the agent runs in the interface");
        }
        other => super::misrouted("control", &other),
    }
    Flow::Continue
}

/// Pause agent operations.
async fn pause(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI user requested agent pause");
    ctx.handle.pause();
}

/// Resume agent operations.
async fn resume(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI user requested agent resume");
    ctx.handle.resume();
}

/// Request shutdown.
async fn shutdown(ctx: &mut CommandContext) -> Flow {
    info!("[AUDIT] GUI user requested agent shutdown");
    ctx.handle.request_shutdown();
    Flow::Stop
}

/// Relaunch the agent process, then shut this one down: what a
/// standalone agent does once it has joined a platform.
async fn restart(ctx: &mut CommandContext) -> Flow {
    info!("[AUDIT] GUI user requested agent restart");
    match crate::spawn_relaunch() {
        Ok(()) => {
            ctx.handle.request_shutdown();
            return Flow::Stop;
        }
        Err(e) => {
            error!("Failed to relaunch the agent: {}", e);
            let _ = ctx.events.send(AgentEvent::Notification {
                notification: agent_gui::dto::GuiNotification::error(
                    "Redémarrage impossible",
                    format!(
                        "L'agent n'a pas pu se relancer ({}). \
                         Fermez-le et rouvrez-le pour activer la \
                         connexion à la plateforme.",
                        e
                    ),
                ),
            });
        }
    }
    Flow::Continue
}

/// Trigger an immediate compliance check.
async fn run_check(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI user requested manual check run");
    ctx.handle.trigger_check();
}

/// Force a sync with the server.
async fn force_sync(ctx: &mut CommandContext) {
    info!("GUI requested force sync");
    ctx.handle.trigger_sync();
}

/// Trigger a sync with the server.
async fn run_sync(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI user requested sync");
    ctx.handle.trigger_sync();
}

/// Start network discovery scan.
async fn start_discovery(ctx: &mut CommandContext) {
    info!("GUI requested network discovery");
    ctx.handle.trigger_discovery();
}

/// Stop network discovery scan.
async fn stop_discovery(ctx: &mut CommandContext) {
    info!("GUI requested discovery cancellation");
    ctx.handle.cancel_discovery();
}

/// Read the deployment history again. It comes from the database, not
/// from this process's runtime: on Windows the service runs the
/// deployments and the interface only reads what it kept.
async fn refresh_mdm_deployments(ctx: &mut CommandContext) {
    let Some(db) = ctx.db.clone() else {
        return;
    };
    let tx = ctx.events.clone();
    ctx.tasks
        .spawn_expected("list mdm deployments", super::expected::SHORT, async move {
            let config = agent_common::config::AgentConfig::load(None).ok();
            let _ = tx.send(agent_core::mdm::gui_history(&db, config.as_ref()).await);
        });
}

/// Trigger a check for updates.
async fn check_update(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI user requested manual update check");
    ctx.handle.trigger_update();
}

/// Propose a discovered device as an asset.
async fn propose_asset(
    ctx: &mut CommandContext,
    ip: String,
    hostname: Option<String>,
    device_type: String,
) {
    info!("[AUDIT] GUI user proposed asset: {}", ip);
    ctx.handle.propose_asset(ip, hostname, device_type);
}

/// Execute remediation for a check.
async fn remediate(ctx: &mut CommandContext, check_id: String) {
    info!(
        "[AUDIT] GUI user requested remediation for check: {}",
        check_id
    );
    ctx.handle.remediate(check_id);
}

/// Preview remediation (dry-run).
async fn remediate_preview(ctx: &mut CommandContext, check_id: String) {
    info!(
        "[AUDIT] GUI user previewed remediation for check: {}",
        check_id
    );
    ctx.handle.remediate_preview(check_id);
}

/// Apply an AI-suggested remediation fix.
async fn apply_ai_remediation(
    ctx: &mut CommandContext,
    action: agent_common::types::RemediationAction,
) {
    info!(
        "[AUDIT] GUI user applying AI remediation for check: {}",
        action.check_id
    );
    ctx.handle.apply_ai_remediation(action);
}

/// Leave standalone mode: open the platform connection wizard. Handled by
/// the shell itself; the runtime learns about it through the enrollment.
async fn connect_to_platform() {
    // Handled by the shell (it opens the wizard); the
    // runtime hears the enrollment that follows.
    debug!("ConnectToPlatform reached the runtime; nothing to do here");
}

/// Request the current agent summary.
async fn get_summary() {
    // Summary is emitted continuously via status updates; this is a no-op
    debug!("GUI requested summary (already sent via periodic updates)");
}

/// Request list of check results.
async fn get_check_results() {
    // Check results are emitted via CheckCompleted events; this is a no-op
    debug!("GUI requested check results (already sent via events)");
}

// The notification centre is kept in the agent's database: what the
// interface shows, reads and deletes survives a restart. These handlers
// run in the order of the commands (nothing is spawned): a notification is
// stored before the command that marks it read or deletes it is handled.

/// How long a notification is kept.
const NOTIFICATION_RETENTION_DAYS: i64 = 90;

/// The severity the store knows for the one the interface uses, which has
/// more names (`success`, `high`, `medium`…).
fn stored_severity(
    severity: &str,
) -> agent_persistence::repositories::notifications::NotificationSeverity {
    use agent_persistence::repositories::notifications::NotificationSeverity;
    match severity.to_ascii_lowercase().as_str() {
        "critical" => NotificationSeverity::Critical,
        "error" | "high" => NotificationSeverity::Error,
        "warning" | "warn" | "medium" => NotificationSeverity::Warning,
        _ => NotificationSeverity::Info,
    }
}

/// Keep a notification of this session.
async fn save_notification(
    ctx: &mut CommandContext,
    notification: agent_gui::dto::GuiNotification,
) {
    let Some(db) = ctx.db.as_ref() else {
        return;
    };
    let stored = agent_persistence::repositories::notifications::Notification {
        id: notification.id.to_string(),
        title: notification.title,
        body: notification.body,
        severity: stored_severity(&notification.severity),
        read: notification.read,
        action: notification.action,
        created_at: notification.timestamp,
        read_at: None,
    };
    if let Err(e) = agent_persistence::NotificationsRepository::new(db)
        .insert_if_absent(&stored)
        .await
    {
        warn!("Notification not stored: {}", e);
    }
}

/// Send the stored notifications to the interface, after dropping those
/// past the retention.
async fn load_notifications(ctx: &mut CommandContext, limit: u32) {
    let Some(db) = ctx.db.as_ref() else {
        return;
    };
    let repo = agent_persistence::NotificationsRepository::new(db);
    let oldest_kept = chrono::Utc::now() - chrono::Duration::days(NOTIFICATION_RETENTION_DAYS);
    if let Err(e) = repo.delete_older_than(oldest_kept).await {
        warn!("Old notifications not purged: {}", e);
    }
    match repo.get_all(i64::from(limit.min(1000))).await {
        Ok(stored) => {
            let notifications = stored
                .into_iter()
                .filter_map(|n| {
                    Some(agent_gui::dto::GuiNotification {
                        // Stored under the identifier the interface gave it.
                        id: uuid::Uuid::parse_str(&n.id).ok()?,
                        title: n.title,
                        body: n.body,
                        severity: n.severity.as_str().to_string(),
                        timestamp: n.created_at,
                        read: n.read,
                        action: n.action,
                    })
                })
                .collect();
            let _ = ctx
                .events
                .send(AgentEvent::NotificationsLoaded { notifications });
        }
        Err(e) => warn!("Stored notifications not read: {}", e),
    }
}

/// Mark a notification as read.
async fn mark_notification_read(ctx: &mut CommandContext, notification_id: String) {
    info!(
        "[AUDIT] GUI marked notification {} as read",
        notification_id
    );
    if let Some(db) = ctx.db.as_ref()
        && let Err(e) = agent_persistence::NotificationsRepository::new(db)
            .mark_read(&notification_id)
            .await
    {
        warn!("Notification not marked as read in the store: {}", e);
    }
}

/// Mark all notifications as read.
async fn mark_all_notifications_read(ctx: &mut CommandContext) {
    info!("[AUDIT] GUI marked all notifications as read");
    if let Some(db) = ctx.db.as_ref()
        && let Err(e) = agent_persistence::NotificationsRepository::new(db)
            .mark_all_read()
            .await
    {
        warn!("Notifications not marked as read in the store: {}", e);
    }
}

/// Delete a notification. They are local to the desktop app: the platform
/// has no such resource.
async fn delete_notification(ctx: &mut CommandContext, notification_id: String) {
    info!("[AUDIT] GUI deleted notification: {}", notification_id);
    if let Some(db) = ctx.db.as_ref()
        && let Err(e) = agent_persistence::NotificationsRepository::new(db)
            .delete(&notification_id)
            .await
    {
        warn!("Notification not deleted from the store: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gui_commands::testing;
    use agent_storage::{Database, DatabaseConfig, KeyManager};

    async fn context_with_store() -> (
        CommandContext,
        std::sync::mpsc::Receiver<AgentEvent>,
        tempfile::TempDir,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let key = KeyManager::new_with_key(b"01234567890123456789012345678901");
        let db =
            Database::open(DatabaseConfig::with_path(dir.path().join("test.db")), &key).unwrap();
        db.with_connection_mut(|conn| {
            agent_persistence::run_v2_migrations(conn)
                .map_err(|e| agent_storage::StorageError::Migration(e.to_string()))
        })
        .await
        .unwrap();
        let (mut ctx, events) = testing::context();
        ctx.db = Some(std::sync::Arc::new(db));
        (ctx, events, dir)
    }

    async fn stored(
        ctx: &mut CommandContext,
        events: &std::sync::mpsc::Receiver<AgentEvent>,
    ) -> Vec<agent_gui::dto::GuiNotification> {
        handle(ctx, GuiCommand::LoadNotifications { limit: 100 }).await;
        match events.try_recv() {
            Ok(AgentEvent::NotificationsLoaded { notifications }) => notifications,
            other => panic!(
                "expected the stored notifications, got {:?}",
                other.map(|_| ())
            ),
        }
    }

    /// Read, mark-all and delete were logged and nothing else: the
    /// notification centre was empty after every restart.
    #[tokio::test]
    async fn notifications_are_kept_with_their_read_mark_until_deleted() {
        let (mut ctx, events, _dir) = context_with_store().await;
        let first = agent_gui::dto::GuiNotification::error("Blocage impossible", "pfctl");
        let second = agent_gui::dto::GuiNotification::info("SBOM exporté", "42 composants");
        let third = agent_gui::dto::GuiNotification::info("Rapport", "prêt");
        for n in [&first, &second, &third] {
            handle(
                &mut ctx,
                GuiCommand::SaveNotification {
                    notification: Box::new(n.clone()),
                },
            )
            .await;
        }

        handle(
            &mut ctx,
            GuiCommand::MarkNotificationRead {
                notification_id: first.id.to_string(),
            },
        )
        .await;
        handle(
            &mut ctx,
            GuiCommand::DeleteNotification {
                notification_id: second.id.to_string(),
            },
        )
        .await;

        let kept = stored(&mut ctx, &events).await;
        assert_eq!(kept.len(), 2);
        let by_id = |id: uuid::Uuid| kept.iter().find(|n| n.id == id).unwrap();
        assert!(by_id(first.id).read);
        assert_eq!(by_id(first.id).severity, "error");
        assert_eq!(by_id(first.id).title, "Blocage impossible");
        assert!(!by_id(third.id).read);

        handle(&mut ctx, GuiCommand::MarkAllNotificationsRead).await;
        assert!(stored(&mut ctx, &events).await.iter().all(|n| n.read));
    }

    #[tokio::test]
    async fn without_a_database_the_notification_commands_do_nothing() {
        let (mut ctx, events) = testing::context();
        handle(&mut ctx, GuiCommand::LoadNotifications { limit: 10 }).await;
        handle(&mut ctx, GuiCommand::MarkAllNotificationsRead).await;
        assert!(events.try_recv().is_err());
    }

    #[test]
    fn the_severities_of_the_interface_map_to_those_of_the_store() {
        use agent_persistence::repositories::notifications::NotificationSeverity;
        assert_eq!(stored_severity("critical"), NotificationSeverity::Critical);
        assert_eq!(stored_severity("high"), NotificationSeverity::Error);
        assert_eq!(stored_severity("warning"), NotificationSeverity::Warning);
        assert_eq!(stored_severity("success"), NotificationSeverity::Info);
    }
}
