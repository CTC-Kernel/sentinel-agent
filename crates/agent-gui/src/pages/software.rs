//! Software page -- installed software inventory.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct SoftwarePage;

impl SoftwarePage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "Logiciels",
                Some("Inventaire des logiciels install\u{00e9}s"),
            );

            // Summary cards row
            let total = state.software_packages.len() as u32;
            let up_to_date = state
                .software_packages
                .iter()
                .filter(|p| p.up_to_date)
                .count() as u32;
            let outdated = total - up_to_date;

            ui.horizontal(|ui| {
                Self::summary_card(
                    ui,
                    "Total",
                    &total.to_string(),
                    theme::TEXT_PRIMARY,
                );
                Self::summary_card(
                    ui,
                    "\u{00c0} jour",
                    &up_to_date.to_string(),
                    theme::SUCCESS,
                );
                Self::summary_card(
                    ui,
                    "Obsolète",
                    &outdated.to_string(),
                    if outdated > 0 { theme::WARNING } else { theme::TEXT_TERTIARY },
                );
            });

            ui.add_space(theme::SPACE);

            // Software table
            widgets::card(ui, |ui| {
                if state.software_packages.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new("Aucun logiciel recens\u{00e9}")
                                .color(theme::TEXT_TERTIARY),
                        );
                        ui.add_space(theme::SPACE_LG);
                    });
                } else {
                    // Table header
                    ui.horizontal(|ui| {
                        ui.set_min_height(28.0);
                        Self::table_header_cell(ui, "Nom", 200.0);
                        Self::table_header_cell(ui, "Version", 120.0);
                        Self::table_header_cell(ui, "\u{00c9}diteur", 150.0);
                        Self::table_header_cell(ui, "Statut", 100.0);
                        Self::table_header_cell(ui, "Derni\u{00e8}re version", 120.0);
                    });
                    ui.separator();

                    for pkg in &state.software_packages {
                        ui.horizontal(|ui| {
                            ui.set_min_height(32.0);

                            // Name
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(200.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&pkg.name)
                                            .font(theme::font_body())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Version
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(120.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&pkg.version)
                                            .font(theme::font_mono())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Publisher
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(150.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let publisher = pkg
                                        .publisher
                                        .as_deref()
                                        .unwrap_or("--");
                                    ui.label(
                                        egui::RichText::new(publisher)
                                            .font(theme::font_small())
                                            .color(theme::TEXT_SECONDARY),
                                    );
                                },
                            );

                            // Status badge
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(100.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    if pkg.up_to_date {
                                        widgets::status_badge(ui, "\u{00c0} jour", theme::SUCCESS);
                                    } else {
                                        widgets::status_badge(ui, "Obsolète", theme::WARNING);
                                    }
                                },
                            );

                            // Latest version
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(120.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let latest = pkg
                                        .latest_version
                                        .as_deref()
                                        .unwrap_or("--");
                                    ui.label(
                                        egui::RichText::new(latest)
                                            .font(theme::font_mono())
                                            .color(theme::TEXT_SECONDARY),
                                    );
                                },
                            );
                        });

                        ui.separator();
                    }
                }
            });
        });
    }

    fn summary_card(ui: &mut Ui, label: &str, value: &str, color: egui::Color32) {
        widgets::card(ui, |ui| {
            ui.set_min_width(100.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_title())
                        .color(color)
                        .strong(),
                );
                ui.label(
                    egui::RichText::new(label)
                        .font(theme::font_small())
                        .color(theme::TEXT_SECONDARY),
                );
            });
        });
    }

    fn table_header_cell(ui: &mut Ui, text: &str, width: f32) {
        ui.allocate_ui_with_layout(
            egui::Vec2::new(width, 28.0),
            egui::Layout::left_to_right(egui::Align::Center),
            |ui| {
                ui.label(
                    egui::RichText::new(text)
                        .font(theme::font_small())
                        .color(theme::TEXT_SECONDARY)
                        .strong(),
                );
            },
        );
    }
}
