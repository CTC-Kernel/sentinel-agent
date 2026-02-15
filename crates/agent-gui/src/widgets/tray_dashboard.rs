//! Premium "Satellite" View for the system tray dashboard.

use egui::{Context, Ui};
use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct TrayDashboard;

impl TrayDashboard {
    /// Render the premium satellite tray view.
    pub fn show(ctx: &Context, state: &mut AppState) -> Option<bool> {
        let mut close_requested = None;

        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(0.0),
            )
            .show(ctx, |ui: &mut Ui| {
                ui.vertical(|ui: &mut Ui| {
                    // Title Bar (Satellite style)
                    widgets::card(ui, |ui: &mut Ui| {
                        ui.horizontal(|ui: &mut Ui| {
                            ui.label(egui::RichText::new(icons::SHIELD).color(theme::ACCENT));
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("RAPPORT CYBER RAPIDE")
                                    .font(theme::font_title())
                                    .size(11.0)
                                    .strong(),
                            );
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut Ui| {
                                    if ui.button(icons::XMARK).clicked() {
                                        close_requested = Some(false);
                                    }
                                    if ui.button(icons::EXTERNAL_LINK).clicked() {
                                        close_requested = Some(true); // Signal to open main window
                                    }
                                },
                            );
                        });
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Radar Chart Section
                    ui.vertical(|ui: &mut Ui| {
                        let (compliance, threats, vulns, resources, network) = state.radar_scores();

                        let radar = widgets::TrayRadar::new(
                            compliance,
                            threats,
                            vulns,
                            resources,
                            network,
                        );
                        radar.show(ui, 240.0);
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Quick Stats Cards
                    ui.horizontal(|ui: &mut Ui| {
                        widgets::card(ui, |ui: &mut Ui| {
                            ui.set_width(135.0);
                            ui.vertical(|ui: &mut Ui| {
                                ui.label(egui::RichText::new("SCORE").font(theme::font_small()));
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{:.0}%",
                                        state.summary.compliance_score.unwrap_or(0.0)
                                    ))
                                    .font(theme::font_title())
                                    .color(theme::ACCENT),
                                );
                            });
                        });
                        ui.add_space(theme::SPACE_MD);
                        widgets::card(ui, |ui: &mut Ui| {
                            ui.set_width(135.0);
                            ui.vertical(|ui: &mut Ui| {
                                ui.label(egui::RichText::new("MENACES").font(theme::font_small()));
                                ui.add_space(theme::SPACE_XS);
                                let count = state.threats.suspicious_processes.len();
                                ui.label(
                                    egui::RichText::new(count.to_string())
                                        .font(theme::font_title())
                                        .color(if count > 0 {
                                            theme::ERROR
                                        } else {
                                            theme::SUCCESS
                                        }),
                                );
                            });
                        });
                    });

                    ui.add_space(theme::SPACE_LG);

                    // Actions
                    ui.vertical_centered(|ui: &mut Ui| {
                        if ui.button("LANCER UNE ANALYSE COMPLÈTE").clicked() {
                            // In real app, we should bubble up a command, but here we just
                            // keep the UI logic. The parent handles GuiCommand::RunCheck.
                        }
                    });
                });
            });

        close_requested
    }
}
