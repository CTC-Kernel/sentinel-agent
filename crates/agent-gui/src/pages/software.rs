//! Software page -- installed software inventory.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct SoftwarePage;

impl SoftwarePage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Logiciels",
                    Some("Inventaire complet des applications install\u{00e9}es et suivi des versions"),
                );
                ui.add_space(theme::SPACE_LG);

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
                        "TOTAL",
                        &total.to_string(),
                        theme::TEXT_PRIMARY,
                        "◆",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "\u{00c0} JOUR",
                        &up_to_date.to_string(),
                        theme::SUCCESS,
                        "✓",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "OBSOL\u{00c8}TES",
                        &outdated.to_string(),
                        if outdated > 0 { theme::WARNING } else { theme::TEXT_TERTIARY },
                        "↑",
                    );
                });

                ui.add_space(theme::SPACE_LG);

                // Software table
                widgets::card(ui, |ui| {
                    ui.label(egui::RichText::new("INVENTAIRE LOGICIEL").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                    ui.add_space(theme::SPACE_MD);

                    if state.software_packages.is_empty() {
                        widgets::empty_state(
                            ui,
                            "◆",
                            "Aucun logiciel recens\u{00e9}",
                            Some("L'inventaire logiciel est en cours de constitution ou aucun paquet n'a \u{00e9}t\u{00e9} d\u{00e9}tect\u{00e9}."),
                        );
                    } else {
                        let tw = ui.available_width();
                        let col_name = (tw * 0.28).max(100.0);
                        let col_ver = (tw * 0.16).max(80.0);
                        let col_pub = (tw * 0.20).max(80.0);
                        let col_status = (tw * 0.16).max(80.0);

                        // Table header
                        ui.horizontal(|ui| {
                            ui.set_min_height(32.0);
                            Self::table_header_cell(ui, "NOM DU LOGICIEL", col_name);
                            Self::table_header_cell(ui, "VERSION", col_ver);
                            Self::table_header_cell(ui, "\u{00c9}DITEUR", col_pub);
                            Self::table_header_cell(ui, "STATUT", col_status);
                            ui.label(egui::RichText::new("MAJ DISPONIBLE").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                        });
                        ui.add_space(theme::SPACE_XS);
                        ui.separator();
                        ui.add_space(theme::SPACE_SM);

                        for pkg in &state.software_packages {
                            ui.horizontal(|ui| {
                                ui.set_min_height(40.0);

                                // Name
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_name, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        ui.label(
                                            egui::RichText::new(&pkg.name)
                                                .font(theme::font_body())
                                                .color(theme::TEXT_PRIMARY)
                                                .strong(),
                                        );
                                    },
                                );

                                // Version
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_ver, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        ui.label(
                                            egui::RichText::new(&pkg.version)
                                                .font(theme::font_mono())
                                                .color(theme::TEXT_SECONDARY),
                                        );
                                    },
                                );

                                // Publisher
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_pub, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        let publisher = pkg
                                            .publisher
                                            .as_deref()
                                            .unwrap_or("--");
                                        ui.label(
                                            egui::RichText::new(publisher)
                                                .font(theme::font_small())
                                                .color(theme::TEXT_TERTIARY),
                                        );
                                    },
                                );

                                // Status badge
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_status, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        if pkg.up_to_date {
                                            widgets::status_badge(ui, "✓ \u{00c0} JOUR", theme::SUCCESS.linear_multiply(0.8));
                                        } else {
                                            widgets::status_badge(ui, "↑ OBSOL\u{00c8}TE", theme::WARNING.linear_multiply(0.8));
                                        }
                                    },
                                );

                                // Latest version
                                if let Some(latest) = &pkg.latest_version {
                                    if !pkg.up_to_date {
                                        ui.horizontal(|ui| {
                                            ui.label(
                                                egui::RichText::new(format!("→ {}", latest))
                                                    .font(theme::font_mono())
                                                    .color(theme::ACCENT_LIGHT)
                                                    .strong(),
                                            );
                                        });
                                    } else {
                                        ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                    }
                                } else {
                                    ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                }
                            });

                            ui.add_space(theme::SPACE_XS);
                            ui.separator();
                            ui.add_space(theme::SPACE_XS);
                        }
                    }
                });
                
                ui.add_space(theme::SPACE_XL);
            });
    }

    fn summary_card(ui: &mut Ui, label: &str, value: &str, color: egui::Color32, icon: &str) {
        widgets::card(ui, |ui| {
            ui.set_min_width(150.0);
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

    fn table_header_cell(ui: &mut Ui, text: &str, width: f32) {
        ui.allocate_ui_with_layout(
            egui::Vec2::new(width, 28.0),
            egui::Layout::left_to_right(egui::Align::Center),
            |ui| {
                ui.label(
                    egui::RichText::new(text)
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY)
                        .strong(),
                );
            },
        );
    }
}
