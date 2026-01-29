//! Sync page -- synchronization status and history.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::theme;
use crate::widgets;

pub struct SyncPage;

impl SyncPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command = None;

        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "Synchronisation",
                Some("\u{00c9}tat de la synchronisation avec le serveur"),
            );

            // Status card
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new("\u{00c9}tat actuel")
                            .font(theme::font_heading())
                            .color(theme::TEXT_PRIMARY),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if state.sync_in_progress {
                            widgets::status_badge(ui, "Synchronisation...", theme::INFO);
                        } else if state.summary.pending_sync_count > 0 {
                            widgets::status_badge(
                                ui,
                                &format!("{} en attente", state.summary.pending_sync_count),
                                theme::WARNING,
                            );
                        } else {
                            widgets::status_badge(ui, "Synchronis\u{00e9}", theme::SUCCESS);
                        }
                    });
                });

                ui.add_space(theme::SPACE_SM);

                if let Some(ref ts) = state.summary.last_sync_at {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("Derni\u{00e8}re synchronisation:")
                                .font(theme::font_body())
                                .color(theme::TEXT_SECONDARY),
                        );
                        ui.label(
                            egui::RichText::new(ts.format("%d/%m/%Y %H:%M:%S").to_string())
                                .font(theme::font_body())
                                .color(theme::TEXT_PRIMARY),
                        );
                    });
                }

                if let Some(ref err) = state.sync_error {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(format!("Erreur: {}", err))
                            .font(theme::font_body())
                            .color(theme::ERROR),
                    );
                }

                ui.add_space(theme::SPACE);

                // Force sync button
                let btn = egui::Button::new(
                    egui::RichText::new("Forcer la synchronisation")
                        .font(theme::font_body())
                        .color(theme::TEXT_ON_ACCENT),
                )
                .fill(theme::ACCENT)
                .rounding(egui::Rounding::same(theme::BUTTON_ROUNDING));

                let enabled = !state.sync_in_progress;
                if ui.add_enabled(enabled, btn).clicked() {
                    command = Some(GuiCommand::ForceSync);
                }
            });

            ui.add_space(theme::SPACE);

            // Sync history
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Historique de synchronisation")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                if state.sync_history.is_empty() {
                    ui.label(
                        egui::RichText::new("Aucun historique disponible")
                            .color(theme::TEXT_TERTIARY),
                    );
                } else {
                    for entry in &state.sync_history {
                        ui.horizontal(|ui| {
                            let color = if entry.success {
                                theme::SUCCESS
                            } else {
                                theme::ERROR
                            };
                            ui.label(
                                egui::RichText::new(if entry.success { "\u{2713}" } else { "\u{2717}" })
                                    .color(color),
                            );
                            ui.label(
                                egui::RichText::new(
                                    entry.timestamp.format("%d/%m %H:%M:%S").to_string(),
                                )
                                .font(theme::font_small())
                                .color(theme::TEXT_SECONDARY),
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

        command
    }
}
