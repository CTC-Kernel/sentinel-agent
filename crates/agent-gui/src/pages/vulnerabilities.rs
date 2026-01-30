//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Vuln\u{00e9}rabilit\u{00e9}s",
                    Some("Analyse continue des failles de s\u{00e9}curit\u{00e9} logicielles et correctifs"),
                );
                ui.add_space(theme::SPACE_LG);

                // Summary cards row
                let summary = state.vulnerability_summary.as_ref();
                let critical = summary.map_or(0, |s| s.critical);
                let high = summary.map_or(0, |s| s.high);
                let medium = summary.map_or(0, |s| s.medium);
                let low = summary.map_or(0, |s| s.low);

                ui.horizontal(|ui| {
                    Self::summary_card(
                        ui,
                        "CRITIQUES",
                        &critical.to_string(),
                        if critical > 0 { theme::ERROR } else { theme::TEXT_TERTIARY },
                        "■",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "\u{00c9}LEV\u{00c9}ES",
                        &high.to_string(),
                        if high > 0 { theme::WARNING } else { theme::TEXT_TERTIARY },
                        "▲",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "MOYENNES",
                        &medium.to_string(),
                        if medium > 0 { theme::INFO } else { theme::TEXT_TERTIARY },
                        "●",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "FAIBLES",
                        &low.to_string(),
                        theme::TEXT_TERTIARY,
                        "○",
                    );
                });

                ui.add_space(theme::SPACE_LG);

                // Vulnerability findings table
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("FAILLES DÉTECTÉES")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    if state.vulnerability_findings.is_empty() {
                        widgets::empty_state(
                            ui,
                            "▲",
                            "Aucune vulnérabilité détectée",
                            Some("Votre système semble protégé. Les scans continus vérifient les failles connues."),
                        );
                    } else {
                        use egui_extras::{Column, TableBuilder};

                        let table = TableBuilder::new(ui)
                            .striped(true)
                            .resizable(true)
                            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                            .column(Column::initial(100.0).at_least(80.0)) // CVE
                            .column(Column::initial(150.0).range(100.0..=300.0).at_least(100.0)) // Software
                            .column(Column::initial(100.0).at_least(70.0)) // Severity
                            .column(Column::initial(60.0).at_least(40.0)) // CVSS
                            .column(Column::remainder()); // Description

                        table
                            .header(28.0, |mut header| {
                                header.col(|ui| {
                                    ui.strong("CVE");
                                });
                                header.col(|ui| {
                                    ui.strong("LOGICIEL");
                                });
                                header.col(|ui| {
                                    ui.strong("SÉVÉRITÉ");
                                });
                                header.col(|ui| {
                                    ui.strong("CVSS");
                                });
                                header.col(|ui| {
                                    ui.strong("DESCRIPTION / CORRECTIF");
                                });
                            })
                            .body(|body| {
                                body.rows(48.0, state.vulnerability_findings.len(), |mut row| {
                                    let finding = &state.vulnerability_findings[row.index()];
                                    
                                    row.col(|ui| {
                                        ui.label(
                                            egui::RichText::new(&finding.cve_id)
                                                .font(theme::font_mono())
                                                .color(theme::ACCENT_LIGHT)
                                                .strong(),
                                        );
                                    });
                                    
                                    row.col(|ui| {
                                        ui.vertical(|ui| {
                                            ui.label(
                                                egui::RichText::new(&finding.affected_software)
                                                    .font(theme::font_body())
                                                    .color(theme::TEXT_PRIMARY)
                                                    .strong(),
                                            );
                                            ui.label(
                                                egui::RichText::new(&finding.affected_version)
                                                    .font(theme::font_small())
                                                    .color(theme::TEXT_TERTIARY),
                                            );
                                        });
                                    });
                                    
                                    row.col(|ui| {
                                        let (label, color) = Self::severity_display(&finding.severity);
                                        widgets::status_badge(ui, label, color);
                                    });
                                    
                                    row.col(|ui| {
                                        if let Some(s) = finding.cvss_score {
                                            ui.label(
                                                egui::RichText::new(format!("{:.1}", s))
                                                    .font(theme::font_body())
                                                    .color(theme::score_color(s * 10.0))
                                                    .strong(),
                                            );
                                        } else {
                                            ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                        }
                                    });
                                    
                                    row.col(|ui| {
                                        ui.vertical(|ui| {
                                            ui.label(
                                                egui::RichText::new(&finding.description)
                                                    .font(theme::font_small())
                                                    .color(theme::TEXT_SECONDARY),
                                            );
                                            if finding.fix_available {
                                                widgets::status_badge(ui, "✓ CORRECTIF", theme::SUCCESS.linear_multiply(0.8));
                                            }
                                        });
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
            ui.set_min_width(140.0);
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


    fn severity_display(severity: &str) -> (&'static str, egui::Color32) {
        match severity {
            "critical" => ("CRITIQUE", theme::ERROR),
            "high" => ("\u{00c9}LEV\u{00c9}E", theme::WARNING),
            "medium" => ("MOYENNE", theme::INFO),
            "low" => ("FAIBLE", theme::TEXT_TERTIARY),
            _ => ("INCONNUE", theme::TEXT_TERTIARY),
        }
    }
}
