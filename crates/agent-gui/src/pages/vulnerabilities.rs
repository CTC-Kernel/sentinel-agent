//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, Severity};

use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Vulnérabilités"],
            "Vulnérabilités",
            Some("ANALYSE DYNAMIQUE DES FAILLES ET EXPOSITION AUX CVE"),
            Some(
                "Identifiez les failles de sécurité connues (CVE) affectant vos logiciels. Le score critique (V3) priorise les vulnérabilités les plus dangereuses nécessitant une mise à jour immédiate.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    if is_scanning {
                        "SCAN EN COURS"
                    } else {
                        "LANCER LE SCAN"
                    },
                    icons::PLAY
                ),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let search_lower = state.vulnerability.search.to_lowercase();
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
                                        f.description.to_lowercase()
                                    );
                                    if !haystack.contains(&search_lower) {
                                        return false;
                                    }
                                }
                                if let Some(ref sev) = state.vulnerability.severity_filter {
                                    f.severity == *sev
                                } else {
                                    true
                                }
                            })
                            .map(|(i, _)| i)
                            .collect();
                        let success = Self::export_csv(state, &filtered_indices);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV réussi")
                                    .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("Échec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Summary cards row (AAA Grade)
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
                "ÉLEVÉES",
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
                if low > 0 {
                    theme::INFO
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_LOW,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let crit_active = state.vulnerability.severity_filter == Some(Severity::Critical);
        let high_active = state.vulnerability.severity_filter == Some(Severity::High);
        let med_active = state.vulnerability.severity_filter == Some(Severity::Medium);
        let low_active = state.vulnerability.severity_filter == Some(Severity::Low);

        let search_lower = state.vulnerability.search.to_lowercase();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.vulnerability.search,
            "RECHERCHER (CVE, LOGICIEL, DESCRIPTION)...",
        )
        .chip("CRITIQUE", crit_active, theme::ERROR)
        .chip("ÉLEVÉE", high_active, theme::SEVERITY_HIGH)
        .chip("MOYENNE", med_active, theme::SEVERITY_MEDIUM)
        .chip("FAIBLE", low_active, theme::INFO)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some(Severity::Critical),
                1 => Some(Severity::High),
                2 => Some(Severity::Medium),
                3 => Some(Severity::Low),
                _ => None,
            };
            if state.vulnerability.severity_filter == target {
                state.vulnerability.severity_filter = None;
            } else {
                state.vulnerability.severity_filter = target;
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Vulnerability findings table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("FAILLES DE SÉCURITÉ IDENTIFIÉES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::show_findings(ui, state, &search_lower, &mut command);
        });

        ui.add_space(theme::SPACE_XL);
        command
    }

    fn show_findings(ui: &mut Ui, state: &mut AppState, search_lower: &str, command: &mut Option<GuiCommand>) {
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
                        f.description.to_lowercase()
                    );
                    if !haystack.contains(search_lower) {
                        return false;
                    }
                }
                if let Some(ref sev) = state.vulnerability.severity_filter {
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
                "AUCUNE VULNÉRABILITÉ DÉTECTÉE",
                "Le système est à jour et ne présente aucune faille connue à ce jour.",
            );
        } else if filtered.is_empty() {
            widgets::empty_state(
                ui,
                icons::VULNERABILITIES,
                "AUCUN RÉSULTAT",
                Some("Ajustez vos filtres de recherche pour voir les vulnérabilités."),
            );
        } else {
            use egui_extras::{Column, TableBuilder};

            let table = TableBuilder::new(ui)
                .striped(false)
                .resizable(true)
                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                .column(Column::initial(100.0).at_least(80.0)) // CVE
                .column(Column::initial(120.0).at_least(100.0)) // Software
                .column(Column::initial(80.0).at_least(60.0)) // Severity
                .column(Column::initial(60.0).at_least(50.0)) // Score
                .column(Column::remainder()) // Fix
                .column(Column::initial(100.0).at_least(90.0)); // Actions

            table
                .header(28.0, |mut header| {
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("IDENTIFIANT")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("LOGICIEL AFF\u{00c9}RENT")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("S\u{00c9}V\u{00c9}RIT\u{00c9}")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("SCORE CVSS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ANALYSE ET CORRECTIFS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ACTIONS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                    });
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT + 16.0, filtered.len(), |mut row| {
                        let finding = &state.vulnerability_findings[filtered[row.index()]];

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&finding.cve_id)
                                    .font(egui::FontId::monospace(12.0))
                                    .color(theme::ACCENT_LIGHT)
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&finding.affected_software)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(&finding.affected_version)
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                );
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) = Self::severity_display(&finding.severity);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
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

                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&finding.description)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                );
                                if finding.fix_available {
                                    ui.add_space(2.0);
                                    widgets::status_badge(ui, "CORRECTIF DISPONIBLE", theme::SUCCESS);
                                }
                                if let Some(dt) = finding.discovered_at {
                                    ui.add_space(2.0);
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "{} {}",
                                            icons::CLOCK,
                                            dt.format("%d/%m/%Y %H:%M")
                                        ))
                                        .font(theme::font_min())
                                        .color(theme::text_tertiary()),
                                    );
                                }
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            if widgets::ghost_button(ui, format!("{}  CORRIGER", icons::WRENCH)).clicked() {
                                *command = Some(GuiCommand::Remediate {
                                    check_id: finding.cve_id.clone(),
                                });
                            }
                        });
                    });
                });
        }
    }

    /// Draw a summary card (AAA Grade)
    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(0.5)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(color.linear_multiply(theme::OPACITY_DISABLED)),
                            );
                        },
                    );
                });
            });
        });
    }

    fn severity_display(severity: &Severity) -> (&'static str, egui::Color32) {
        match severity {
            Severity::Critical => ("CRITIQUE", theme::ERROR),
            Severity::High => ("\u{00c9}LEV\u{00c9}E", theme::SEVERITY_HIGH),
            Severity::Medium => ("MOYENNE", theme::SEVERITY_MEDIUM),
            Severity::Low => ("FAIBLE", theme::INFO),
            Severity::Info => ("INFO", theme::text_tertiary()),
        }
    }

    fn export_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &[
            "cve_id",
            "logiciel",
            "version",
            "severite",
            "cvss",
            "description",
            "fix_disponible",
        ];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let f = &state.vulnerability_findings[i];
                vec![
                    f.cve_id.clone(),
                    f.affected_software.clone(),
                    f.affected_version.clone(),
                    f.severity.to_string(),
                    f.cvss_score.map_or("--".into(), |s| format!("{:.1}", s)),
                    f.description.clone(),
                    if f.fix_available { "Oui" } else { "Non" }.to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("vulnerabilites.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
