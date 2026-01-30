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
                    ui.label(egui::RichText::new("FAILLES D\u{00c9}TECT\u{00c9}ES").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                    ui.add_space(theme::SPACE_MD);

                    if state.vulnerability_findings.is_empty() {
                        widgets::empty_state(
                            ui,
                            "▲",
                            "Aucune vuln\u{00e9}rabilit\u{00e9} d\u{00e9}tect\u{00e9}e",
                            Some("Votre syst\u{00e8}me semble prot\u{00e9}g\u{00e9}. Les scans continus v\u{00e9}rifient les failles connues."),
                        );
                    } else {
                        let tw = ui.available_width();
                        let col_cve = (tw * 0.18).max(80.0);
                        let col_soft = (tw * 0.22).max(100.0);
                        let col_sev = (tw * 0.14).max(70.0);
                        let col_cvss = (tw * 0.08).max(40.0);

                        // Table header
                        ui.horizontal(|ui| {
                            ui.set_min_height(32.0);
                            Self::table_header_cell(ui, "CVE", col_cve);
                            Self::table_header_cell(ui, "LOGICIEL", col_soft);
                            Self::table_header_cell(ui, "S\u{00c9}V\u{00c9}RIT\u{00c9}", col_sev);
                            Self::table_header_cell(ui, "CVSS", col_cvss);
                            ui.label(egui::RichText::new("DESCRIPTION").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                        });
                        ui.add_space(theme::SPACE_XS);
                        ui.separator();
                        ui.add_space(theme::SPACE_SM);

                        for finding in &state.vulnerability_findings {
                            ui.horizontal(|ui| {
                                ui.set_min_height(42.0);

                                // CVE ID
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_cve, 42.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        ui.label(
                                            egui::RichText::new(&finding.cve_id)
                                                .font(theme::font_mono())
                                                .color(theme::ACCENT_LIGHT)
                                                .strong(),
                                        );
                                    },
                                );

                                // Affected software
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_soft, 42.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
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
                                    },
                                );

                                // Severity badge
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_sev, 42.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        let (label, color) =
                                            Self::severity_display(&finding.severity);
                                        widgets::status_badge(ui, label, color);
                                    },
                                );

                                // CVSS score
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(col_cvss, 42.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
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
                                    },
                                );

                                // Description (takes remaining space) + fix badge inline
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
