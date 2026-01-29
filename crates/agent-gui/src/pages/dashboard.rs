//! Dashboard page -- main overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::theme;
use crate::widgets;

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(ui, "Tableau de bord", Some("Vue d'ensemble de l'agent"));

            // Top row: status + compliance gauge
            ui.horizontal(|ui| {
                // Status card
                widgets::card(ui, |ui| {
                    ui.set_min_width(280.0);
                    ui.label(
                        egui::RichText::new("Statut de l'agent")
                            .font(theme::font_heading())
                            .color(theme::TEXT_PRIMARY),
                    );
                    ui.add_space(theme::SPACE_SM);

                    let (status_text, status_color) = match state.summary.status {
                        GuiAgentStatus::Connected => ("Connect\u{00e9}", theme::SUCCESS),
                        GuiAgentStatus::Disconnected => {
                            ("D\u{00e9}connect\u{00e9}", theme::WARNING)
                        }
                        GuiAgentStatus::Paused => ("En pause", theme::TEXT_TERTIARY),
                        GuiAgentStatus::Scanning => ("Analyse en cours", theme::INFO),
                        GuiAgentStatus::Error => ("Erreur", theme::ERROR),
                        GuiAgentStatus::Starting => ("D\u{00e9}marrage", theme::TEXT_SECONDARY),
                    };
                    widgets::status_badge(ui, status_text, status_color);

                    ui.add_space(theme::SPACE_SM);

                    Self::info_row(ui, "Version", &state.summary.version);
                    Self::info_row(ui, "H\u{00f4}te", &state.summary.hostname);
                    if let Some(ref id) = state.summary.agent_id {
                        Self::info_row(ui, "ID Agent", &id[..8.min(id.len())]);
                    }
                    if let Some(ref org) = state.summary.organization {
                        Self::info_row(ui, "Organisation", org);
                    }

                    if let Some(ts) = state.summary.last_check_at {
                        Self::info_row(
                            ui,
                            "Derni\u{00e8}re v\u{00e9}rification",
                            &ts.format("%d/%m/%Y %H:%M").to_string(),
                        );
                    }
                    if let Some(ts) = state.summary.last_sync_at {
                        Self::info_row(
                            ui,
                            "Derni\u{00e8}re synchro",
                            &ts.format("%d/%m/%Y %H:%M").to_string(),
                        );
                    }
                });

                ui.add_space(theme::SPACE);

                // Compliance gauge card
                widgets::card(ui, |ui| {
                    ui.set_min_width(200.0);
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_SM);
                        widgets::compliance_gauge(ui, state.summary.compliance_score, 64.0);
                    });
                });
            });

            ui.add_space(theme::SPACE);

            // Resource usage
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Ressources syst\u{00e8}me")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                widgets::resource_bar(
                    ui,
                    "CPU",
                    &format!("{:.1}%", state.resources.cpu_percent),
                    (state.resources.cpu_percent / 100.0) as f32,
                );
                ui.add_space(theme::SPACE_XS);
                widgets::resource_bar(
                    ui,
                    "M\u{00e9}moire",
                    &format!("{} Mo", state.resources.memory_mb),
                    (state.resources.memory_mb as f32 / 512.0).min(1.0),
                );
            });

            ui.add_space(theme::SPACE);

            // Sync status
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new("Synchronisation")
                            .font(theme::font_heading())
                            .color(theme::TEXT_PRIMARY),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if state.summary.pending_sync_count > 0 {
                            widgets::status_badge(
                                ui,
                                &format!("{} en attente", state.summary.pending_sync_count),
                                theme::WARNING,
                            );
                        } else {
                            widgets::status_badge(ui, "\u{00c0} jour", theme::SUCCESS);
                        }
                    });
                });
            });

            // Recent activity
            ui.add_space(theme::SPACE);
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Activit\u{00e9} r\u{00e9}cente")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                if state.logs.is_empty() {
                    ui.label(
                        egui::RichText::new("Aucune activit\u{00e9} r\u{00e9}cente")
                            .color(theme::TEXT_TERTIARY),
                    );
                } else {
                    for entry in state.logs.iter().take(5) {
                        ui.horizontal(|ui| {
                            let level_color = match entry.level.as_str() {
                                "error" => theme::ERROR,
                                "warn" => theme::WARNING,
                                "info" => theme::INFO,
                                _ => theme::TEXT_SECONDARY,
                            };
                            ui.label(
                                egui::RichText::new(entry.level.to_uppercase())
                                    .font(theme::font_small())
                                    .color(level_color),
                            );
                            ui.label(
                                egui::RichText::new(entry.timestamp.format("%H:%M:%S").to_string())
                                    .font(theme::font_small())
                                    .color(theme::TEXT_TERTIARY),
                            );
                            ui.label(
                                egui::RichText::new(&entry.message)
                                    .font(theme::font_small())
                                    .color(theme::TEXT_PRIMARY),
                            );
                        });
                    }
                }
            });
        });
    }

    fn info_row(ui: &mut Ui, label: &str, value: &str) {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(format!("{}:", label))
                    .font(theme::font_small())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_small())
                    .color(theme::TEXT_PRIMARY),
            );
        });
    }
}
