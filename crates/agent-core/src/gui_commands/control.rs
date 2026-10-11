// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Control of the running agent from the interface: pause, shutdown, the
//! checks, syncs and remediations it is asked for, and its notifications.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{debug, error, info};

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
            mark_notification_read(notification_id).await
        }
        GuiCommand::MarkAllNotificationsRead => mark_all_notifications_read().await,
        GuiCommand::DeleteNotification { notification_id } => {
            delete_notification(notification_id).await
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

/// Mark a notification as read.
async fn mark_notification_read(notification_id: String) {
    info!(
        "[AUDIT] GUI marked notification {} as read",
        notification_id
    );
    // Notification read state is managed in GUI state
}

/// Mark all notifications as read.
async fn mark_all_notifications_read() {
    info!("[AUDIT] GUI marked all notifications as read");
    // Notification read state is managed in GUI state
}

/// Delete a notification.
async fn delete_notification(notification_id: String) {
    // Notifications are local to the desktop app (the GUI
    // already removed it): the platform has no such resource.
    info!("[AUDIT] GUI deleted notification: {}", notification_id);
}
