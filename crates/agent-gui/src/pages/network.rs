//! Network page -- interfaces, connections, alerts.

use egui::Ui;

use crate::app::AppState;
use crate::icons;
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
                let card_gap = theme::SPACE_SM;
                let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
                let (alert_color, alert_icon) = if state.network_alerts > 0 {
                    (theme::ERROR, icons::WARNING)
                } else {
                    (theme::SUCCESS, icons::CIRCLE_CHECK)
                };
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = card_gap;
                    Self::summary_card(ui, card_w, "INTERFACES", &state.network_interfaces.to_string(), theme::ACCENT, icons::WIFI);
                    Self::summary_card(ui, card_w, "CONNEXIONS", &state.network_connections.to_string(), theme::ACCENT_LIGHT, icons::NETWORK);
                    Self::summary_card(ui, card_w, "ALERTES", &state.network_alerts.to_string(), alert_color, alert_icon);
                });

                ui.add_space(theme::SPACE_LG);

                let total_width = ui.available_width();
                let col_gap = theme::SPACE;
                let left_w = (total_width - col_gap) * 0.55;
                let right_w = total_width - col_gap - left_w;
                ui.horizontal_top(|ui| {
                    ui.spacing_mut().item_spacing.x = col_gap;
                    ui.vertical(|ui| {
                    ui.set_width(left_w);
                    // Network status detail
                    widgets::card(ui, |ui| {
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
                                Self::detail_row(ui, "Adresse IP", ip, icons::ARROW_RIGHT);
                            }
                            if let Some(ref mac) = state.primary_mac {
                                Self::detail_row(ui, "Adresse MAC", mac, icons::ARROW_RIGHT);
                            }
                            ui.separator();
                            if let Some(ref ts) = state.last_network_scan {
                                Self::detail_row(ui, "Dernier scan", &ts.format("%H:%M:%S").to_string(), icons::ARROW_RIGHT);
                            }
                        }
                    });
                    }); // end left vertical

                    // Security section
                    ui.vertical(|ui| {
                    ui.set_width(right_w);
                    widgets::card(ui, |ui| {
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
                                ui.label(egui::RichText::new(icons::CIRCLE_CHECK).size(48.0).color(theme::SUCCESS.linear_multiply(0.4)));
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new("AUCUNE MENACE").font(theme::font_small()).color(theme::SUCCESS).strong());
                                ui.label(egui::RichText::new("Le trafic r\u{00e9}seau semble sain").font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            } else {
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new(icons::WARNING).size(48.0).color(theme::ERROR.linear_multiply(0.4)));
                                ui.add_space(theme::SPACE_SM);
                                ui.label(egui::RichText::new(format!("{} ALERTE(S)", state.network_alerts)).font(theme::font_small()).color(theme::ERROR).strong());
                                ui.label(egui::RichText::new("Actions requises imm\u{00e9}diatement").font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            }
                        });
                    });
                    }); // end right vertical
                });

                ui.add_space(theme::SPACE_XL);
            });
    }

    fn summary_card(ui: &mut Ui, width: f32, label: &str, value: &str, color: egui::Color32, icon: &str) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
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
