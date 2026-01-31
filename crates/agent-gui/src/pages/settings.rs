//! Settings page.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SettingsPage;

impl SettingsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

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
                    (format!("{}  REPRENDRE L'AGENT", icons::PLAY), GuiCommand::Resume)
                } else {
                    (format!("{}  METTRE EN PAUSE", icons::STOP), GuiCommand::Pause)
                };

                let btn_color = if state.is_paused {
                    theme::SUCCESS
                } else {
                    theme::WARNING
                };

                let btn = egui::Button::new(
                    egui::RichText::new(&label)
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
                    egui::RichText::new(format!("{}  V\u{00c9}RIFIER MAINTENANT", icons::CHECK))
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

        // Scan interval slider
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("INTERVALLE DE SCAN")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("P\u{00e9}riode entre les analyses de conformit\u{00e9}")
                        .font(theme::font_body())
                        .color(theme::TEXT_SECONDARY),
                );
            });
            ui.add_space(theme::SPACE_SM);

            let mut interval_min = (state.check_interval_secs / 60) as f32;
            if interval_min < 5.0 {
                interval_min = 5.0;
            }

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("5 min")
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY),
                );
                let slider = egui::Slider::new(&mut interval_min, 5.0..=120.0)
                    .text("min")
                    .step_by(5.0)
                    .clamping(egui::SliderClamping::Always);
                let response = ui.add(slider);
                if response.changed() {
                    state.check_interval_secs = (interval_min as u64) * 60;
                    command = Some(GuiCommand::UpdateCheckInterval {
                        interval_secs: state.check_interval_secs,
                    });
                }
                ui.label(
                    egui::RichText::new("120 min")
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY),
                );
            });

            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(format!(
                    "Actuellement : {} minutes ({} secondes)",
                    state.check_interval_secs / 60,
                    state.check_interval_secs
                ))
                .font(theme::font_small())
                .color(theme::TEXT_TERTIARY),
            );
        });

        ui.add_space(theme::SPACE);

        // Log level selector
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("NIVEAU DE LOG")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.label(
                egui::RichText::new("Contr\u{00f4}le la verbosit\u{00e9} des journaux de l'agent")
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui| {
                let levels: &[(u8, &str, egui::Color32)] = &[
                    (0, "ERROR", theme::ERROR),
                    (1, "WARN", theme::WARNING),
                    (2, "INFO", theme::INFO),
                    (3, "DEBUG", theme::TEXT_SECONDARY),
                    (4, "TRACE", theme::TEXT_TERTIARY),
                ];

                for &(val, label, color) in levels {
                    let active = state.log_level == val;
                    let (bg, fg) = if active {
                        (color, theme::TEXT_ON_ACCENT)
                    } else {
                        (theme::BG_ELEVATED, color)
                    };
                    let btn = egui::Button::new(
                        egui::RichText::new(label)
                            .font(theme::font_small())
                            .color(fg)
                            .strong(),
                    )
                    .fill(bg)
                    .corner_radius(egui::CornerRadius::same(theme::BADGE_ROUNDING))
                    .min_size(egui::vec2(60.0, 28.0));
                    if ui.add(btn).clicked() && !active {
                        state.log_level = val;
                        command = Some(GuiCommand::SetLogLevel { level: val });
                    }
                }
            });
        });

        ui.add_space(theme::SPACE);

        // Dark mode toggle (prepared for future)
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("APPARENCE")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Mode sombre")
                        .font(theme::font_body())
                        .color(theme::TEXT_SECONDARY),
                );
                ui.add_space(theme::SPACE_MD);
                ui.checkbox(&mut state.dark_mode, "");
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("Actuellement toujours actif. Le mode clair sera disponible dans une version future.")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY),
            );
        });

        ui.add_space(theme::SPACE);

        // Discovery toggle
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("D\u{00c9}COUVERTE R\u{00c9}SEAU")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Activer la d\u{00e9}couverte r\u{00e9}seau automatique")
                        .font(theme::font_body())
                        .color(theme::TEXT_SECONDARY),
                );
                ui.add_space(theme::SPACE_MD);
                if ui.checkbox(&mut state.discovery_enabled, "").changed() {
                    // State is already updated by checkbox
                }
            });
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new("Lorsque activ\u{00e9}, l'agent scanne p\u{00e9}riodiquement le r\u{00e9}seau local pour d\u{00e9}couvrir de nouveaux appareils.")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY),
            );
        });

        ui.add_space(theme::SPACE);
        let total_width = ui.available_width();
        let col_gap = theme::SPACE;
        let col_w = (total_width - col_gap) * 0.5;
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = col_gap;
            ui.vertical(|ui| {
                ui.set_width(col_w);
                // Connection info
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("CONNEXION SERVEUR")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    Self::setting_row(ui, "Serveur", &state.server_url, icons::ARROW_RIGHT);
                    if let Some(ref id) = state.summary.agent_id {
                        Self::setting_row(ui, "ID Agent", id, icons::ARROW_RIGHT);
                    }
                    if let Some(ref org) = state.summary.organization {
                        Self::setting_row(ui, "Organisation", org, icons::ARROW_RIGHT);
                    }
                });

                ui.add_space(theme::SPACE);

                // Intervals
                widgets::card(ui, |ui| {
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
                        icons::ARROW_RIGHT,
                    );
                    Self::setting_row(
                        ui,
                        "Heartbeat",
                        &format!("{} sec", state.heartbeat_interval_secs),
                        icons::ARROW_RIGHT,
                    );
                });
            });

            ui.vertical(|ui| {
                ui.set_width(col_w);
                // Web app link
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("ACC\u{00c8}S CLOUD")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    if let Some(ref id) = state.summary.agent_id {
                        let url = format!("https://app.cyber-threat-consulting.com/agents/{}", id);

                        ui.label(egui::RichText::new("G\u{00e9}rez vos politiques et visualisez vos rapports d\u{00e9}taill\u{00e9}s en ligne.").font(theme::font_small()).color(theme::TEXT_SECONDARY));
                        ui.add_space(theme::SPACE_MD);

                        let btn = egui::Button::new(
                            egui::RichText::new(format!("{}  VOIR SUR LE PORTAIL WEB", icons::EXTERNAL_LINK))
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
                    ui.label(
                        egui::RichText::new("ZONE DANGEREUSE")
                            .font(theme::font_small())
                            .color(theme::ERROR)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    let quit_btn = egui::Button::new(
                        egui::RichText::new(format!("{}  QUITTER L'AGENT", icons::XMARK))
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
