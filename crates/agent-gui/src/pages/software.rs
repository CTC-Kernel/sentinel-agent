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
                    ui.label(
                        egui::RichText::new("INVENTAIRE LOGICIEL")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    if state.software_packages.is_empty() {
                        widgets::empty_state(
                            ui,
                            "◆",
                            "Aucun logiciel recensé",
                            Some("L'inventaire logiciel est en cours de constitution ou aucun paquet n'a été détecté."),
                        );
                    } else {
                        use egui_extras::{Column, TableBuilder};

                        let table = TableBuilder::new(ui)
                            .striped(true)
                            .resizable(true)
                            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                            .column(Column::initial(150.0).range(100.0..=400.0).at_least(100.0)) // Name
                            .column(Column::initial(100.0).at_least(80.0)) // Version
                            .column(Column::initial(120.0).at_least(100.0)) // Publisher
                            .column(Column::initial(100.0).at_least(80.0)) // Status
                            .column(Column::remainder()); // Latest version

                        table
                            .header(28.0, |mut header| {
                                header.col(|ui| {
                                    ui.strong("NOM DU LOGICIEL");
                                });
                                header.col(|ui| {
                                    ui.strong("VERSION");
                                });
                                header.col(|ui| {
                                    ui.strong("ÉDITEUR");
                                });
                                header.col(|ui| {
                                    ui.strong("STATUT");
                                });
                                header.col(|ui| {
                                    ui.strong("MAJ DISPONIBLE");
                                });
                            })
                            .body(|body| {
                                body.rows(40.0, state.software_packages.len(), |mut row| {
                                    let pkg = &state.software_packages[row.index()];
                                    
                                    row.col(|ui| {
                                        ui.label(
                                            egui::RichText::new(&pkg.name)
                                                .font(theme::font_body())
                                                .color(theme::TEXT_PRIMARY)
                                                .strong(),
                                        );
                                    });
                                    
                                    row.col(|ui| {
                                        ui.label(
                                            egui::RichText::new(&pkg.version)
                                                .font(theme::font_mono())
                                                .color(theme::TEXT_SECONDARY),
                                        );
                                    });
                                    
                                    row.col(|ui| {
                                        let publisher = pkg.publisher.as_deref().unwrap_or("--");
                                        ui.label(
                                            egui::RichText::new(publisher)
                                                .font(theme::font_small())
                                                .color(theme::TEXT_TERTIARY),
                                        );
                                    });
                                    
                                    row.col(|ui| {
                                        if pkg.up_to_date {
                                            widgets::status_badge(ui, "✓ À JOUR", theme::SUCCESS.linear_multiply(0.8));
                                        } else {
                                            widgets::status_badge(ui, "↑ OBSOLÈTE", theme::WARNING.linear_multiply(0.8));
                                        }
                                    });
                                    
                                    row.col(|ui| {
                                        if let Some(latest) = &pkg.latest_version {
                                            if !pkg.up_to_date {
                                                ui.label(
                                                    egui::RichText::new(format!("→ {}", latest))
                                                        .font(theme::font_mono())
                                                        .color(theme::ACCENT_LIGHT)
                                                        .strong(),
                                                );
                                            } else {
                                                ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                            }
                                        } else {
                                            ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                        }
                                    });
                                });
                            });
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

}
