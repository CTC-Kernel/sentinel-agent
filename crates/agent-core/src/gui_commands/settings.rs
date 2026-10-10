// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Settings changed from the interface.

use agent_common::config::AgentConfig;
use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use super::CommandContext;

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::UpdateCheckInterval { interval_secs } => {
            update_check_interval(ctx, interval_secs).await
        }
        GuiCommand::UpdateAllowlist { rules } => update_allowlist(ctx, rules).await,
        GuiCommand::SetLogLevel { level } => set_log_level(ctx, level).await,
        GuiCommand::SetRansomwareCanaries { enabled } => {
            set_ransomware_canaries(ctx, enabled).await
        }
        GuiCommand::UpdateSiemConfig {
            enabled,
            format,
            transport,
            destination,
        } => update_siem_config(ctx, enabled, format, transport, destination).await,
        GuiCommand::UpdateLogCollectorConfig {
            enabled,
            sources,
            poll_interval_secs,
        } => update_log_collector_config(ctx, enabled, sources, poll_interval_secs).await,
        other => super::misrouted("settings", &other),
    }
}

/// Update the check interval.
async fn update_check_interval(ctx: &mut CommandContext, interval_secs: u64) {
    info!(
        "[AUDIT] GUI user updated check interval to {} seconds",
        interval_secs
    );
    ctx.handle.set_check_interval(interval_secs);
}

/// Replace the local triage authorizations applied by the agent core
/// (notifications, detection rules and playbooks skip covered events).
async fn update_allowlist(ctx: &mut CommandContext, rules: Vec<agent_gui::dto::AllowlistRule>) {
    info!(
        "[AUDIT] GUI updated triage authorizations: {} rule(s) [{}]",
        rules.len(),
        rules
            .iter()
            .map(|r| format!("{:?}={} by {}", r.rule_type, r.pattern, r.created_by))
            .collect::<Vec<_>>()
            .join(", ")
    );
    ctx.handle.set_allowlist_rules(rules);
}

/// Handle `GuiCommand::SetLogLevel`.
async fn set_log_level(ctx: &mut CommandContext, level: u8) {
    ctx.handle.set_log_level(level);
}

/// Turn the ransomware canary files (decoys in user directories) on or off.
async fn set_ransomware_canaries(ctx: &mut CommandContext, enabled: bool) {
    info!(
        "[AUDIT] GUI user set ransomware canary files to {}",
        enabled
    );
    // Applied now; persisted so it survives a restart.
    if let Err(e) = AgentConfig::persist_value_to(
        &AgentConfig::platform_config_path(),
        "ransomware_canaries",
        serde_json::Value::Bool(enabled),
    ) {
        warn!(
            "Ransomware canary setting applied but not saved to the config file: {}",
            e
        );
    }
    ctx.handle.state.set_ransomware_canaries(enabled);
}

/// Update the SIEM forwarder configuration.
async fn update_siem_config(
    ctx: &mut CommandContext,
    enabled: bool,
    format: String,
    transport: String,
    destination: String,
) {
    info!(
        "[AUDIT] SIEM config updated via GUI: enabled={}, format={}, transport={}, dest={}",
        enabled, format, transport, destination
    );
    // Update the runtime SIEM config and notify the GUI
    ctx.handle.update_siem_config(
        enabled,
        format.clone(),
        transport.clone(),
        destination.clone(),
    );
    let _ = ctx.events.send(AgentEvent::SiemConfigUpdate {
        enabled,
        format,
        transport,
        destination,
    });
}

/// Update the SIEM log collector configuration.
async fn update_log_collector_config(
    ctx: &mut CommandContext,
    enabled: bool,
    sources: Vec<String>,
    poll_interval_secs: u64,
) {
    info!(
        "[AUDIT] Log collector config updated via GUI: enabled={}, sources={:?}, poll={}s",
        enabled, sources, poll_interval_secs
    );
    // Update runtime log collector config
    ctx.handle
        .update_log_collector_config(enabled, &sources, poll_interval_secs);
}
