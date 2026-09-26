// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compact organization context; scan and sync actions live in the action bar.

use crate::{app::AppState, dto::GuiAgentStatus, events::GuiCommand, icons, theme, widgets};
use egui::{RichText, Ui};

pub fn org_banner(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
    if state.summary.standalone {
        return standalone_banner(ui, state);
    }
    widgets::card(ui, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(icons::BUILDING)
                    .font(theme::font_icon(theme::ICON_SM))
                    .color(theme::accent_text()),
            );
            ui.label(
                RichText::new(
                    state
                        .summary
                        .organization
                        .as_deref()
                        .unwrap_or("Organisation non configurée"),
                )
                .font(theme::font_body())
                .color(theme::text_primary())
                .strong(),
            );
            let (label, color) = match state.summary.status {
                GuiAgentStatus::Connected => ("Connecté", theme::SUCCESS),
                GuiAgentStatus::Scanning => ("Analyse en cours", theme::INFO),
                GuiAgentStatus::Syncing => ("Synchronisation en cours", theme::INFO),
                GuiAgentStatus::Disconnected => ("Hors connexion", theme::WARNING),
                GuiAgentStatus::Error => ("Erreur de connexion", theme::ERROR),
                _ => ("En attente", theme::INFO),
            };
            widgets::status_badge(ui, label, color);
            ui.separator();
            let sync = state
                .summary
                .last_sync_at
                .map(|at| format!("Synchronisé {}", crate::format::ago(chrono::Utc::now(), at)))
                .unwrap_or_else(|| "Première synchronisation en attente".to_owned());
            ui.label(
                RichText::new(sync)
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            if state.summary.pending_sync_count > 0 {
                widgets::status_badge(
                    ui,
                    &format!(
                        "{} en attente",
                        crate::format::int(state.summary.pending_sync_count)
                    ),
                    theme::INFO,
                );
            }
            if widgets::ghost_button(ui, "Ouvrir la console ↗").clicked() {
                let url = format!("{}/dashboard", crate::pages::about::branding::CONSOLE);
                if url.starts_with("https://")
                    && let Err(error) = open::that(&url)
                {
                    tracing::warn!("Failed to open console: {error}");
                }
            }
            if let Some(agent_id) = &state.summary.agent_id {
                let response =
                    widgets::ghost_button(ui, "Copier l’identifiant").on_hover_text(agent_id);
                if response.clicked() {
                    ui.ctx().copy_text(agent_id.clone());
                }
            }
        });
    });
    None
}

/// The standalone counterpart: what protects this endpoint, and that
/// nothing leaves it. Connecting to a platform is one click away, in the
/// settings, never a nag.
fn standalone_banner(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
    let mut command = None;
    widgets::card(ui, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(icons::SHIELD_CHECK)
                    .font(theme::font_icon(theme::ICON_SM))
                    .color(theme::readable_color(theme::SUCCESS)),
            );
            ui.label(
                RichText::new("Mode autonome")
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
            );
            let (label, color) = match state.summary.status {
                GuiAgentStatus::Scanning => ("Analyse en cours", theme::INFO),
                GuiAgentStatus::Paused => ("En pause", theme::WARNING),
                GuiAgentStatus::Error => ("Erreur", theme::ERROR),
                GuiAgentStatus::Starting => ("D\u{00e9}marrage", theme::INFO),
                _ => ("Protection locale active", theme::SUCCESS),
            };
            widgets::status_badge(ui, label, color);
        });
        ui.add_space(theme::SPACE_SM);
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(
                    "D\u{00e9}tection, int\u{00e9}grit\u{00e9} des fichiers, conformit\u{00e9} et \
                     vuln\u{00e9}rabilit\u{00e9}s sur ce poste \u{00b7} aucune donn\u{00e9}e envoy\u{00e9}e",
                )
                .font(theme::font_small())
                .color(theme::text_secondary()),
            );
            if widgets::ghost_button(ui, "Connecter \u{00e0} une plateforme")
                .on_hover_text(
                    "Rejoindre une plateforme Sentinel GRC avec un jeton d'enr\u{00f4}lement",
                )
                .clicked()
            {
                command = Some(GuiCommand::ConnectToPlatform);
            }
        });
    });
    command
}
