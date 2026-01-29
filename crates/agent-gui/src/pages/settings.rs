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

        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(ui, "Param\u{00e8}tres", Some("Configuration de l'agent"));

            // Agent controls
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Contr\u{00f4}les de l'agent")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                ui.horizontal(|ui| {
                    let (label, cmd) = if state.is_paused {
                        ("Reprendre l'agent", GuiCommand::Resume)
                    } else {
                        ("Mettre en pause", GuiCommand::Pause)
                    };

                    let btn_color = if state.is_paused {
                        theme::SUCCESS
                    } else {
                        theme::WARNING
                    };

                    let btn = egui::Button::new(
                        egui::RichText::new(label)
                            .font(theme::font_body())
                            .color(theme::TEXT_ON_ACCENT),
                    )
                    .fill(btn_color)
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                    if ui.add(btn).clicked() {
                        state.is_paused = !state.is_paused;
                        command = Some(cmd);
                    }

                    ui.add_space(theme::SPACE);

                    let check_btn = egui::Button::new(
                        egui::RichText::new("V\u{00e9}rifier maintenant")
                            .font(theme::font_body())
                            .color(theme::TEXT_ON_ACCENT),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                    if ui.add_enabled(!state.is_paused, check_btn).clicked() {
                        command = Some(GuiCommand::RunCheck);
                    }
                });
            });

            ui.add_space(theme::SPACE);

            // Connection info
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Connexion au serveur")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                Self::setting_row(ui, "Serveur", &state.server_url);
                if let Some(ref id) = state.summary.agent_id {
                    Self::setting_row(ui, "Identifiant agent", id);
                }
                if let Some(ref org) = state.summary.organization {
                    Self::setting_row(ui, "Organisation", org);
                }
            });

            ui.add_space(theme::SPACE);

            // Intervals
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Intervalles")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                Self::setting_row(
                    ui,
                    "V\u{00e9}rification",
                    &format!("{} secondes", state.check_interval_secs),
                );
                Self::setting_row(
                    ui,
                    "Battement de coeur",
                    &format!("{} secondes", state.heartbeat_interval_secs),
                );
            });

            ui.add_space(theme::SPACE);

            // Danger zone
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Zone dangereuse")
                        .font(theme::font_heading())
                        .color(theme::ERROR),
                );
                ui.add_space(theme::SPACE_SM);

                let quit_btn = egui::Button::new(
                    egui::RichText::new("Quitter l'agent")
                        .font(theme::font_body())
                        .color(theme::TEXT_ON_ACCENT),
                )
                .fill(theme::ERROR)
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                if ui.add(quit_btn).clicked() {
                    command = Some(GuiCommand::Shutdown);
                }
            });
        });

        command
    }

    fn setting_row(ui: &mut Ui, label: &str, value: &str) {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(format!("{}:", label))
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_mono())
                    .color(theme::TEXT_PRIMARY),
            );
        });
    }
}
