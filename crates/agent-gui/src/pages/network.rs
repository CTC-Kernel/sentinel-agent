//! Network page -- interfaces, connections, alerts.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct NetworkPage;

impl NetworkPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "R\u{00e9}seau",
                Some("Interfaces, connexions et alertes r\u{00e9}seau"),
            );

            // Summary row
            ui.horizontal(|ui| {
                widgets::card(ui, |ui| {
                    ui.set_min_width(140.0);
                    ui.vertical_centered(|ui| {
                        ui.label(
                            egui::RichText::new(state.network_interfaces.to_string())
                                .font(theme::font_title())
                                .color(theme::ACCENT)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new("Interfaces")
                                .font(theme::font_small())
                                .color(theme::TEXT_SECONDARY),
                        );
                    });
                });
                widgets::card(ui, |ui| {
                    ui.set_min_width(140.0);
                    ui.vertical_centered(|ui| {
                        ui.label(
                            egui::RichText::new(state.network_connections.to_string())
                                .font(theme::font_title())
                                .color(theme::ACCENT)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new("Connexions")
                                .font(theme::font_small())
                                .color(theme::TEXT_SECONDARY),
                        );
                    });
                });
                widgets::card(ui, |ui| {
                    ui.set_min_width(140.0);
                    ui.vertical_centered(|ui| {
                        let alert_color = if state.network_alerts > 0 {
                            theme::ERROR
                        } else {
                            theme::SUCCESS
                        };
                        ui.label(
                            egui::RichText::new(state.network_alerts.to_string())
                                .font(theme::font_title())
                                .color(alert_color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new("Alertes")
                                .font(theme::font_small())
                                .color(theme::TEXT_SECONDARY),
                        );
                    });
                });
            });

            ui.add_space(theme::SPACE);

            // Network status detail
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("D\u{00e9}tails r\u{00e9}seau")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                if let Some(ref ip) = state.primary_ip {
                    Self::detail_row(ui, "IP principale", ip);
                }
                if let Some(ref mac) = state.primary_mac {
                    Self::detail_row(ui, "Adresse MAC", mac);
                }
                if let Some(ref ts) = state.last_network_scan {
                    Self::detail_row(ui, "Dernier scan", &ts.format("%d/%m/%Y %H:%M").to_string());
                }

                if state.primary_ip.is_none() {
                    ui.label(
                        egui::RichText::new("Aucune donn\u{00e9}e r\u{00e9}seau disponible")
                            .color(theme::TEXT_TERTIARY),
                    );
                }
            });

            ui.add_space(theme::SPACE);

            // Alerts section
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Alertes de s\u{00e9}curit\u{00e9} r\u{00e9}seau")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                if state.network_alerts == 0 {
                    ui.label(
                        egui::RichText::new("Aucune alerte d\u{00e9}tect\u{00e9}e")
                            .color(theme::SUCCESS),
                    );
                } else {
                    ui.label(
                        egui::RichText::new(format!(
                            "{} alerte(s) d\u{00e9}tect\u{00e9}e(s)",
                            state.network_alerts
                        ))
                        .color(theme::ERROR),
                    );
                }
            });
        });
    }

    fn detail_row(ui: &mut Ui, label: &str, value: &str) {
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
