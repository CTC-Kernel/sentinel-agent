//! Settings page.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::theme;
use crate::widgets;

pub struct SettingsPage;

impl SettingsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(ui, "Configuration", Some("Gestion des param\u{00e8}tres de l'agent et contr\u{00f4}le du service"));
                ui.add_space(theme::SPACE_LG);

                // Agent controls
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("CONTR\u{00d4}LES DU SERVICE")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    ui.horizontal(|ui| {
                        let (label, cmd) = if state.is_paused {
                            ("▶  REPRENDRE L'AGENT", GuiCommand::Resume)
                        } else {
                            ("||  METTRE EN PAUSE", GuiCommand::Pause)
                        };

                        let btn_color = if state.is_paused {
                            theme::SUCCESS
                        } else {
                            theme::WARNING
                        };

                        let btn = egui::Button::new(
                            egui::RichText::new(label)
                                .font(theme::font_body())
                                .color(theme::TEXT_ON_ACCENT)
                                .strong(),
                        )
                        .fill(btn_color)
                        .min_size(egui::vec2(160.0, 40.0))
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                        if ui.add(btn).clicked() {
                            state.is_paused = !state.is_paused;
                            command = Some(cmd);
                        }

                        ui.add_space(theme::SPACE);

                        let check_btn = egui::Button::new(
                            egui::RichText::new("✓  V\u{00c9}RIFIER MAINTENANT")
                                .font(theme::font_body())
                                .color(theme::TEXT_ON_ACCENT)
                                .strong(),
                        )
                        .fill(theme::ACCENT)
                        .min_size(egui::vec2(200.0, 40.0))
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                        if ui.add_enabled(!state.is_paused, check_btn).clicked() {
                            command = Some(GuiCommand::RunCheck);
                        }
                    });
                });

                ui.add_space(theme::SPACE);

                let total_width = ui.available_width();
                ui.horizontal_top(|ui| {
                    let gap = theme::SPACE;
                    let col_w = ((total_width - gap) * 0.5).max(200.0);
                    ui.vertical(|ui| {
                        // Connection info
                        widgets::card(ui, |ui| {
                            ui.set_width(col_w);
                            ui.label(
                                egui::RichText::new("CONNEXION SERVEUR")
                                    .font(theme::font_small())
                                    .color(theme::TEXT_TERTIARY)
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_MD);

                            Self::setting_row(ui, "Serveur", &state.server_url, "→");
                            if let Some(ref id) = state.summary.agent_id {
                                Self::setting_row(ui, "ID Agent", id, "→");
                            }
                            if let Some(ref org) = state.summary.organization {
                                Self::setting_row(ui, "Organisation", org, "→");
                            }
                        });

                        ui.add_space(theme::SPACE);

                        // Intervals
                        widgets::card(ui, |ui| {
                           ui.set_width(col_w);
                            ui.label(
                                egui::RichText::new("INTERVALLES")
                                    .font(theme::font_small())
                                    .color(theme::TEXT_TERTIARY)
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_MD);

                            Self::setting_row(
                                ui,
                                "Scan",
                                &format!("{} sec", state.check_interval_secs),
                                "→",
                            );
                            Self::setting_row(
                                ui,
                                "Heartbeat",
                                &format!("{} sec", state.heartbeat_interval_secs),
                                "→",
                            );
                        });
                    });

                    ui.add_space(theme::SPACE);

                    ui.vertical(|ui| {
                        // Web app link
                        widgets::card(ui, |ui| {
                            ui.set_width(col_w);
                            ui.label(
                                egui::RichText::new("ACC\u{00c8}S CLOUD")
                                    .font(theme::font_small())
                                    .color(theme::TEXT_TERTIARY)
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_MD);

                            if let Some(ref id) = state.summary.agent_id {
                                let url = format!("https://app.sentinel-grc.com/agents/{}", id);

                                ui.label(egui::RichText::new("G\u{00e9}rez vos politiques et visualisez vos rapports d\u{00e9}taill\u{00e9}s en ligne.").font(theme::font_small()).color(theme::TEXT_SECONDARY));
                                ui.add_space(theme::SPACE_MD);

                                let btn = egui::Button::new(
                                    egui::RichText::new("→  VOIR SUR LE PORTAIL WEB")
                                        .font(theme::font_body())
                                        .color(theme::TEXT_ON_ACCENT)
                                        .strong(),
                                )
                                .fill(theme::ACCENT)
                                .min_size(egui::vec2(ui.available_width(), 40.0))
                                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                                if ui.add(btn).clicked() {
                                    let _ = open::that(&url);
                                }
                            } else {
                                ui.label(
                                    egui::RichText::new("Agent non enregistr\u{00e9}")
                                        .color(theme::TEXT_TERTIARY),
                                );
                            }
                        });

                        ui.add_space(theme::SPACE);

                        // Danger zone
                        widgets::card(ui, |ui| {
                            ui.set_width(col_w);
                            ui.label(
                                egui::RichText::new("ZONE DANGEREUSE")
                                    .font(theme::font_small())
                                    .color(theme::ERROR)
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_MD);

                            let quit_btn = egui::Button::new(
                                egui::RichText::new("✕  QUITTER L'AGENT")
                                    .font(theme::font_body())
                                    .color(theme::TEXT_ON_ACCENT)
                                    .strong(),
                            )
                            .fill(theme::ERROR.linear_multiply(0.8))
                            .min_size(egui::vec2(ui.available_width(), 40.0))
                            .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                            if ui.add(quit_btn).clicked() {
                                command = Some(GuiCommand::Shutdown);
                            }
                        });
                    });
                });
                
                ui.add_space(theme::SPACE_XL);
            });

        command
    }

    fn setting_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui| {
            ui.set_min_height(32.0);
            ui.label(egui::RichText::new(icon).color(theme::TEXT_TERTIARY).strong());
            ui.add_space(4.0);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_mono())
                        .color(theme::TEXT_PRIMARY)
                        .strong(),
                );
            });
        });
    }
}
