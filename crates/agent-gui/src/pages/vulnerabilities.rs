//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;

use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Vuln\u{00e9}rabilit\u{00e9}s",
            Some("D\u{00e9}tection des failles de s\u{00e9}curit\u{00e9} et exposition CVE"),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar
        ui.horizontal(|ui| {
            if widgets::button::primary_button(
                ui,
                format!("{}  Lancer le scan", icons::PLAY),
                state.summary.status != GuiAgentStatus::Scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Summary cards row
        let summary = state.vulnerability_summary.as_ref();
        let critical = summary.map_or(0, |s| s.critical);
        let high = summary.map_or(0, |s| s.high);
        let medium = summary.map_or(0, |s| s.medium);
        let low = summary.map_or(0, |s| s.low);

        let card_grid = widgets::ResponsiveGrid::new(230.0, theme::SPACE_SM);
        let items = vec![
            (
                "CRITIQUES",
                critical.to_string(),
                if critical > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_CRITICAL,
            ),
            (
                "\u{00c9}LEV\u{00c9}ES",
                high.to_string(),
                if high > 0 {
                    theme::SEVERITY_HIGH
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_HIGH,
            ),
            (
                "MOYENNES",
                medium.to_string(),
                if medium > 0 {
                    theme::SEVERITY_MEDIUM
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_MEDIUM,
            ),
            (
                "FAIBLES",
                low.to_string(),
                theme::text_tertiary(),
                icons::SEVERITY_LOW,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar
        let crit_active = state.vulnerability_severity_filter.as_deref() == Some("critical");
        let high_active = state.vulnerability_severity_filter.as_deref() == Some("high");
        let med_active = state.vulnerability_severity_filter.as_deref() == Some("medium");
        let low_active = state.vulnerability_severity_filter.as_deref() == Some("low");

        let search_lower = state.vulnerability_search.to_lowercase();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.vulnerability_search,
            "Rechercher (CVE, logiciel, description)...",
        )
        .chip("CRITIQUE", crit_active, theme::ERROR)
        .chip("\u{00c9}LEV\u{00c9}E", high_active, theme::SEVERITY_HIGH)
        .chip("MOYENNE", med_active, theme::SEVERITY_MEDIUM)
        .chip("FAIBLE", low_active, theme::text_tertiary())
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("critical"),
                1 => Some("high"),
                2 => Some("medium"),
                3 => Some("low"),
                _ => None,
            };
            if state.vulnerability_severity_filter.as_deref() == target {
                state.vulnerability_severity_filter = None;
            } else {
                state.vulnerability_severity_filter = target.map(|s| s.to_string());
            }
        }

        ui.add_space(theme::SPACE_SM);

        // CSV export
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    let filtered_indices: Vec<usize> = state
                        .vulnerability_findings
                        .iter()
                        .enumerate()
                        .filter(|(_, f)| {
                            if !search_lower.is_empty() {
                                let haystack = format!(
                                    "{} {} {}",
                                    f.cve_id.to_lowercase(),
                                    f.affected_software.to_lowercase(),
                                    f.description.to_lowercase(),
                                );
                                if !haystack.contains(&search_lower) {
                                    return false;
                                }
                            }
                            if let Some(ref sev) = state.vulnerability_severity_filter {
                                f.severity == *sev
                            } else {
                                true
                            }
                        })
                        .map(|(i, _)| i)
                        .collect();
                    Self::export_csv(state, &filtered_indices);
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        // Vulnerability findings table
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("FAILLES D\u{00c9}TECT\u{00c9}ES")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.push_id("vulnerabilities_table", |ui| {
                Self::table(ui, state, &search_lower);
            });
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn table(ui: &mut Ui, state: &mut AppState, search_lower: &str) {
        let filtered: Vec<usize> = state
            .vulnerability_findings
            .iter()
            .enumerate()
            .filter(|(_, f)| {
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {} {}",
                        f.cve_id.to_lowercase(),
                        f.affected_software.to_lowercase(),
                        f.description.to_lowercase(),
                    );
                    if !haystack.contains(search_lower) {
                        return false;
                    }
                }
                if let Some(ref sev) = state.vulnerability_severity_filter {
                    f.severity == *sev
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect();

        if state.vulnerability_findings.is_empty() {
            widgets::protected_state(
                ui,
                icons::SHIELD_CHECK,
                "Système Sain",
                "Aucune vulnérabilité connue détectée sur ce système.",
            );
        } else if filtered.is_empty() {
            widgets::empty_state(
                ui,
                icons::VULNERABILITIES,
                "Aucune vulnérabilité correspondante",
                Some("Modifiez vos filtres pour voir les résultats."),
            );
        } else {
            use egui_extras::{Column, TableBuilder};

            let table = TableBuilder::new(ui)
                .striped(false)
                .resizable(true)
                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                .column(Column::initial(100.0).at_least(80.0))
                .column(Column::initial(150.0).range(100.0..=300.0).at_least(100.0))
                .column(Column::initial(100.0).at_least(70.0))
                .column(Column::initial(60.0).at_least(40.0))
                .column(Column::remainder());

            table
                .header(28.0, |mut header| {
                    header.col(|ui| {
                        ui.strong("CVE");
                    });
                    header.col(|ui| {
                        ui.strong("LOGICIEL");
                    });
                    header.col(|ui| {
                        ui.strong("S\u{00c9}V\u{00c9}RIT\u{00c9}");
                    });
                    header.col(|ui| {
                        ui.strong("CVSS");
                    });
                    header.col(|ui| {
                        ui.strong("DESCRIPTION / CORRECTIF");
                    });
                })
                .body(|body| {
                    body.rows(48.0, filtered.len(), |mut row| {
                        let finding = &state.vulnerability_findings[filtered[row.index()]];

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
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(&finding.affected_version)
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
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
                                ui.label(egui::RichText::new("--").color(theme::text_tertiary()));
                            }
                        });

                        row.col(|ui| {
                            ui.vertical(|ui| {
                                ui.label(
                                    egui::RichText::new(&finding.description)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                );
                                if finding.fix_available {
                                    widgets::status_badge(
                                        ui,
                                        &format!("{} CORRECTIF", icons::CHECK),
                                        theme::SUCCESS.linear_multiply(0.8),
                                    );
                                }
                            });
                        });
                    });
                });
        }
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let headers = &[
            "cve_id",
            "logiciel",
            "version",
            "severite",
            "cvss",
            "description",
            "correctif",
        ];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let f = &state.vulnerability_findings[i];
                vec![
                    f.cve_id.clone(),
                    f.affected_software.clone(),
                    f.affected_version.clone(),
                    f.severity.clone(),
                    f.cvss_score.map_or("--".into(), |s| format!("{:.1}", s)),
                    f.description.clone(),
                    if f.fix_available { "Oui" } else { "Non" }.to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("vulnerabilites.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new(value).size(24.0).color(color).strong());
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }

    fn severity_display(severity: &str) -> (&'static str, egui::Color32) {
        match severity {
            "critical" => ("CRITIQUE", theme::ERROR),
            "high" => ("\u{00c9}LEV\u{00c9}E", theme::WARNING),
            "medium" => ("MOYENNE", theme::INFO),
            "low" => ("FAIBLE", theme::text_tertiary()),
            _ => ("INCONNUE", theme::text_tertiary()),
        }
    }
}
