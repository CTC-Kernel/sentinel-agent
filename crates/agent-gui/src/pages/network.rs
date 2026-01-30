//! Network page -- interfaces, connections, alerts.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct NetworkPage;

impl NetworkPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "R\u{00e9}seau",
                    Some("Supervision des interfaces, connexions actives et alertes de s\u{00e9}curit\u{00e9}"),
                );
                ui.add_space(theme::SPACE_LG);

                // Summary row
                ui.horizontal(|ui| {
                    Self::summary_card(
                        ui,
                        "INTERFACES",
                        &state.network_interfaces.to_string(),
                        theme::ACCENT,
                        "󰖩",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "CONNEXIONS",
                        &state.network_connections.to_string(),
                        theme::ACCENT_LIGHT,
                        "󰌘",
                    );
                    ui.add_space(theme::SPACE_SM);
                    let (alert_color, alert_icon) = if state.network_alerts > 0 {
                        (theme::ERROR, "󰀦")
                    } else {
                        (theme::SUCCESS, "󰄲")
                    };
                    Self::summary_card(
                        ui,
                        "ALERTES",
                        &state.network_alerts.to_string(),
                        alert_color,
                        alert_icon,
                    );
                });

                ui.add_space(theme::SPACE_LG);

                ui.horizontal_top(|ui| {
                    // Network status detail
                    widgets::card(ui, |ui| {
                        ui.set_min_width(400.0);
                        ui.label(
                            egui::RichText::new("PARAM\u{00c8}TRES R\u{00c9}SEAU")
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY)
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_MD);

                        if state.primary_ip.is_none() && state.primary_mac.is_none() {
                            ui.vertical_centered(|ui| {
                                ui.add_space(theme::SPACE_MD);
                                ui.label(egui::RichText::new("Aucune donn\u{00e9}e r\u{00e9}seau").color(theme::TEXT_TERTIARY));
                                ui.add_space(theme::SPACE_MD);
                            });
                        } else {
                            if let Some(ref ip) = state.primary_ip {
                                Self::detail_row(ui, "Adresse IP", ip, "󰩟");
                            }
                            if let Some(ref mac) = state.primary_mac {
                                Self::detail_row(ui, "Adresse MAC", mac, "󰇧");
                            }
                            ui.separator();
                            if let Some(ref ts) = state.last_network_scan {
                                Self::detail_row(ui, "Dernier scan", &ts.format("%H:%M:%S").to_string(), "󰄐");
                            }
                        }
                    });

                    ui.add_space(theme::SPACE);

                    // Security section
                    widgets::card(ui, |ui| {
                        ui.set_min_width(300.0);
                        ui.label(
                            egui::RichText::new("S\u{00c9}CURIT\u{00c9}")
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY)
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_MD);

                        ui.vertical_centered(|ui| {
                            if state.network_alerts == 0 {
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new("󰄲").size(48.0).color(theme::SUCCESS.linear_multiply(0.4)));
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new("AUCNE MENACE").font(theme::font_small()).color(theme::SUCCESS).strong());
                                ui.label(egui::RichText::new("Le trafic r\u{00e9}seau semble sain").font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            } else {
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new("󰀦").size(48.0).color(theme::ERROR.linear_multiply(0.4)));
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new(format!("{} ALERTE(S)", state.network_alerts)).font(theme::font_small()).color(theme::ERROR).strong());
                                ui.label(egui::RichText::new("Actions requises imm\u{00e9}diatement").font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            }
                        });
                    });
                });
                
                ui.add_space(theme::SPACE_XL);
            });
    }

    fn summary_card(ui: &mut Ui, label: &str, value: &str, color: egui::Color32, icon: &str) {
        widgets::card(ui, |ui| {
            ui.set_min_width(160.0);
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new(value)
                            .size(24.0)
                            .color(color)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new(label)
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                });
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.label(egui::RichText::new(icon).size(28.0).color(color.linear_multiply(0.4)));
                });
            });
        });
    }

    fn detail_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui| {
            ui.set_min_height(32.0);
            ui.label(egui::RichText::new(icon).font(theme::font_body()).color(theme::ACCENT).strong());
            ui.add_space(8.0);
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
