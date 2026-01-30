//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "Vuln\u{00e9}rabilit\u{00e9}s",
                Some("R\u{00e9}sultats de l\u{2019}analyse des vuln\u{00e9}rabilit\u{00e9}s"),
            );

            // Summary cards row
            let summary = state.vulnerability_summary.as_ref();
            let critical = summary.map_or(0, |s| s.critical);
            let high = summary.map_or(0, |s| s.high);
            let medium = summary.map_or(0, |s| s.medium);
            let low = summary.map_or(0, |s| s.low);
            let total = critical + high + medium + low;

            ui.horizontal(|ui| {
                Self::summary_card(
                    ui,
                    "Total",
                    &total.to_string(),
                    theme::TEXT_PRIMARY,
                );
                Self::summary_card(
                    ui,
                    "Critiques",
                    &critical.to_string(),
                    if critical > 0 { theme::ERROR } else { theme::TEXT_TERTIARY },
                );
                Self::summary_card(
                    ui,
                    "\u{00c9}lev\u{00e9}es",
                    &high.to_string(),
                    if high > 0 {
                        egui::Color32::from_rgb(255, 100, 80)
                    } else {
                        theme::TEXT_TERTIARY
                    },
                );
                Self::summary_card(
                    ui,
                    "Moyennes",
                    &medium.to_string(),
                    if medium > 0 { theme::WARNING } else { theme::TEXT_TERTIARY },
                );
                Self::summary_card(
                    ui,
                    "Faibles",
                    &low.to_string(),
                    if low > 0 { theme::INFO } else { theme::TEXT_TERTIARY },
                );
            });

            ui.add_space(theme::SPACE);

            // Vulnerability findings table
            widgets::card(ui, |ui| {
                if state.vulnerability_findings.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new(
                                "Aucune vuln\u{00e9}rabilit\u{00e9} d\u{00e9}tect\u{00e9}e",
                            )
                            .color(theme::TEXT_TERTIARY),
                        );
                        ui.add_space(theme::SPACE_LG);
                    });
                } else {
                    // Table header
                    ui.horizontal(|ui| {
                        ui.set_min_height(28.0);
                        Self::table_header_cell(ui, "CVE", 140.0);
                        Self::table_header_cell(ui, "Logiciel", 140.0);
                        Self::table_header_cell(ui, "S\u{00e9}v\u{00e9}rit\u{00e9}", 90.0);
                        Self::table_header_cell(ui, "CVSS", 60.0);
                        Self::table_header_cell(ui, "Description", 200.0);
                        Self::table_header_cell(ui, "Correctif", 90.0);
                    });
                    ui.separator();

                    for finding in &state.vulnerability_findings {
                        ui.horizontal(|ui| {
                            ui.set_min_height(32.0);

                            // CVE ID
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(140.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&finding.cve_id)
                                            .font(theme::font_mono())
                                            .color(theme::ACCENT_LIGHT),
                                    );
                                },
                            );

                            // Affected software
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(140.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "{} {}",
                                            finding.affected_software, finding.affected_version
                                        ))
                                        .font(theme::font_body())
                                        .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Severity badge
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(90.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let (label, color) =
                                        Self::severity_display(&finding.severity);
                                    widgets::status_badge(ui, label, color);
                                },
                            );

                            // CVSS score
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(60.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let score_text = finding
                                        .cvss_score
                                        .map(|s| format!("{:.1}", s))
                                        .unwrap_or_else(|| "--".to_string());
                                    ui.label(
                                        egui::RichText::new(score_text)
                                            .font(theme::font_small())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Description
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(200.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&finding.description)
                                            .font(theme::font_small())
                                            .color(theme::TEXT_SECONDARY),
                                    );
                                },
                            );

                            // Fix available
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(90.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    if finding.fix_available {
                                        widgets::status_badge(
                                            ui,
                                            "Disponible",
                                            theme::SUCCESS,
                                        );
                                    } else {
                                        widgets::status_badge(
                                            ui,
                                            "Aucun",
                                            theme::TEXT_TERTIARY,
                                        );
                                    }
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

    fn severity_display(severity: &str) -> (&'static str, egui::Color32) {
        match severity {
            "critical" => ("Critique", theme::ERROR),
            "high" => ("\u{00c9}lev\u{00e9}e", egui::Color32::from_rgb(255, 100, 80)),
            "medium" => ("Moyenne", theme::WARNING),
            "low" => ("Faible", theme::INFO),
            _ => ("Inconnue", theme::TEXT_TERTIARY),
        }
    }
}
