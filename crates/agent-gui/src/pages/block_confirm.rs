// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Confirmation of a permanent block of an address, shared by the pages
//! that offer one (Discovery, Network).
//!
//! Nothing is sent before the operator confirms, and the toast says that
//! the request left, not that the address is blocked: the outcome arrives
//! with the agent's answer (`AgentEvent::ResponseActionResult`), which is
//! what announces it.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::widgets;

/// Ask the operator to confirm the block of `ip`. `key` names the dialog of
/// the page asking.
pub(crate) fn ask(ctx: &egui::Context, key: &str, ip: String) {
    widgets::modal::ask_confirmation(ctx, key, ip);
}

/// Draw the pending confirmation of `key`, if any, and return the block to
/// send once confirmed.
pub(crate) fn resolve(
    ui: &mut Ui,
    state: &mut AppState,
    key: &str,
    title: &str,
) -> Option<GuiCommand> {
    let ip = widgets::modal::pending_confirmation::<String>(ui.ctx(), key)?;
    let confirmed = widgets::modal::resolve_confirmation::<String>(
        ui.ctx(),
        key,
        title,
        &format!(
            "Tout le trafic avec {ip} sera bloqu\u{00e9} sur ce poste, sans limite de dur\u{00e9}e, \
             jusqu'\u{00e0} un d\u{00e9}blocage manuel (Menaces \u{203a} R\u{00e9}ponse \u{203a} Adresses bloqu\u{00e9}es)."
        ),
        "Bloquer",
    );
    if !confirmed {
        return None;
    }
    let time = ui.input(|i| i.time);
    state.toasts.push(
        widgets::toast::Toast::info(format!("Demande de blocage envoy\u{00e9}e : {ip}"))
            .with_time(time),
    );
    Some(GuiCommand::BlockIp {
        ip,
        duration_secs: 0,
    })
}
