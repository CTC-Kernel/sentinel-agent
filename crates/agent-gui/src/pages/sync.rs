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

        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Synchronisation",
                    Some("Gestion de la connectivit\u{00e9} et transfert de donn\u{00e9}es avec le serveur"),
                );
                ui.add_space(theme::SPACE_LG);

                // Status card
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("\u{00c9}TAT DE LA CONNEXION")
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if state.sync_in_progress {
                                widgets::status_badge(ui, "↻ SYNCHRONISATION...", theme::INFO);
                            } else if state.summary.pending_sync_count > 0 {
                                widgets::status_badge(
                                    ui,
                                    &format!("↑ {} EN ATTENTE", state.summary.pending_sync_count),
                                    theme::WARNING,
                                );
                            } else {
                                widgets::status_badge(ui, "✓ \u{00c0} JOUR", theme::SUCCESS);
                            }
                        });
                    });

                    ui.add_space(theme::SPACE_MD);

                    ui.horizontal(|ui| {
                        ui.vertical(|ui| {
                            if let Some(ref ts) = state.summary.last_sync_at {
                                ui.label(
                                    egui::RichText::new("Derni\u{00e8}re synchronisation r\u{00e9}ussie :")
                                        .font(theme::font_small())
                                        .color(theme::TEXT_SECONDARY),
                                );
                                ui.label(
                                    egui::RichText::new(ts.format("%d/%m/%Y \u{00e0} %H:%M:%S").to_string())
                                        .font(theme::font_body())
                                        .color(theme::TEXT_PRIMARY)
                                        .strong(),
                                );
                            } else {
                                ui.label(egui::RichText::new("Aucune synchronisation effectu\u{00e9}e").color(theme::TEXT_TERTIARY));
                            }
                        });
                        
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                             // Force sync button
                            let btn = egui::Button::new(
                                egui::RichText::new("↻  SYNCHRONISER MAINTENANT")
                                    .font(theme::font_body())
                                    .color(theme::TEXT_ON_ACCENT)
                                    .strong(),
                            )
                            .fill(theme::ACCENT)
                            .min_size(egui::vec2(220.0, 40.0))
                            .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                            let enabled = !state.sync_in_progress;
                            if ui.add_enabled(enabled, btn).clicked() {
                                command = Some(GuiCommand::ForceSync);
                            }
                        });
                    });

                    if let Some(ref err) = state.sync_error {
                        ui.add_space(theme::SPACE_MD);
                        ui.painter().rect_filled(
                            ui.available_rect_before_wrap().shrink2(egui::vec2(0.0, 4.0)),
                            egui::CornerRadius::same(4),
                            theme::ERROR.linear_multiply(0.1),
                        );
                        ui.label(
                            egui::RichText::new(format!("▲ ERREUR : {}", err))
                                .font(theme::font_small())
                                .color(theme::ERROR),
                        );
                    }
                });

                ui.add_space(theme::SPACE_LG);

                // Sync history
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("HISTORIQUE DES TRANSFERTS")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    if state.sync_history.is_empty() {
                        ui.vertical_centered(|ui| {
                             ui.add_space(theme::SPACE_LG);
                            ui.label(
                                egui::RichText::new("Aucun historique disponible")
                                    .color(theme::TEXT_TERTIARY),
                            );
                             ui.add_space(theme::SPACE_LG);
                        });
                    } else {
                        for entry in &state.sync_history {
                            ui.horizontal(|ui| {
                                ui.set_min_height(32.0);
                                let (icon, color) = if entry.success {
                                    ("✓", theme::SUCCESS)
                                } else {
                                    ("✕", theme::ERROR)
                                };
                                ui.label(
                                    egui::RichText::new(icon)
                                        .size(18.0)
                                        .color(color),
                                );
                                ui.add_space(4.0);
                                ui.label(
                                    egui::RichText::new(
                                        entry.timestamp.format("%H:%M:%S").to_string(),
                                    )
                                    .font(theme::font_mono())
                                    .color(theme::TEXT_TERTIARY),
                                );
                                ui.add_space(8.0);
                                ui.label(
                                    egui::RichText::new(&entry.message)
                                        .font(theme::font_body())
                                        .color(theme::TEXT_PRIMARY),
                                );
                            });
                            ui.separator();
                        }
                    }
                });
                
                ui.add_space(theme::SPACE_XL);
            });

        command
    }
}
