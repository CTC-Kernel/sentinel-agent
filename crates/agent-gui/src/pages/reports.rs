// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reports page — generate and export compliance, executive, and incident reports.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GeneratedReport, GuiCheckStatus, ReportType, Severity};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Maximum number of reports kept in history.
const MAX_REPORT_HISTORY: usize = 50;

/// Reports page.
pub struct ReportsPage;

impl ReportsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Conformité & risques", "Rapports"],
            "Centre de Rapports",
            Some(
                "G\u{00e9}n\u{00e9}ration et export des rapports de conformit\u{00e9}, d\u{2019}audit et d\u{2019}incident.",
            ),
            Some(
                "G\u{00e9}n\u{00e9}rez des rapports d\u{00e9}taill\u{00e9}s pour vos audits de conformit\u{00e9}, synth\u{00e8}ses ex\u{00e9}cutives et rapports d\u{2019}incidents. Chaque rapport peut \u{00ea}tre export\u{00e9} au format PDF ou HTML.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Tab bar
        let tab_labels = &[
            "Synth\u{00e8}se ex\u{00e9}cutive",
            "Audit de conformit\u{00e9}",
            "Incidents",
            "Historique",
        ];
        widgets::tabs(ui, tab_labels, &mut state.reports.active_tab);
        ui.add_space(theme::SPACE_MD);

        match state.reports.active_tab {
            0 => Self::show_report_tab(ui, state, ReportType::Executive, &mut command),
            1 => Self::show_report_tab(ui, state, ReportType::ComplianceAudit, &mut command),
            2 => Self::show_report_tab(ui, state, ReportType::Incident, &mut command),
            3 => Self::show_history_tab(ui, state, &mut command),
            _ => {}
        }

        ui.add_space(theme::SPACE_XL);

        // Detail drawer
        if let Some(sel_idx) = state.reports.selected_report {
            let reports_vec: Vec<&GeneratedReport> = state.reports.reports.iter().collect();
            if sel_idx < reports_vec.len() {
                let report = reports_vec[sel_idx].clone();
                let accent = match report.report_type {
                    ReportType::Executive => theme::ACCENT,
                    ReportType::ComplianceAudit => theme::INFO,
                    ReportType::Incident => theme::ERROR,
                };

                let actions = vec![
                    widgets::DetailAction::primary("Exporter PDF", icons::DOWNLOAD),
                    widgets::DetailAction::secondary("Exporter HTML", icons::DOWNLOAD),
                ];

                let drawer_action =
                    widgets::DetailDrawer::new("report_detail", &report.title, icons::FILE_EXPORT)
                        .accent(accent)
                        .subtitle(report.report_type.label_fr())
                        .show(
                            ui.ctx(),
                            &mut state.reports.detail_open,
                            |ui| {
                                widgets::detail_section(ui, "INFORMATIONS G\u{00c9}N\u{00c9}RALES");
                                widgets::detail_field(ui, "Titre", &report.title);
                                widgets::detail_field(ui, "Type", report.report_type.label_fr());
                                widgets::detail_field(
                                    ui,
                                    "G\u{00e9}n\u{00e9}r\u{00e9} le",
                                    &crate::format::local_datetime(report.generated_at),
                                );
                                if let Some(fw) = &report.framework {
                                    widgets::detail_field_badge(
                                        ui,
                                        "R\u{00e9}f\u{00e9}rentiel",
                                        &fw.to_uppercase(),
                                        theme::INFO,
                                    );
                                }
                                if let Some(score) = report.compliance_score {
                                    widgets::detail_field_colored(
                                        ui,
                                        "Score de conformit\u{00e9}",
                                        &crate::format::pct(score, 0),
                                        theme::readable_color(theme::score_color(score)),
                                    );
                                }

                                widgets::detail_section(ui, "R\u{00c9}SUM\u{00c9}");
                                widgets::detail_text(ui, "", &report.summary);
                            },
                            &actions,
                        );

                match drawer_action {
                    Some(0) => Self::export_pdf(state, &report),
                    Some(1) => Self::export_html(state, &report),
                    _ => {}
                }
            }
        }

        command
    }

    fn show_report_tab(
        ui: &mut Ui,
        state: &mut AppState,
        report_type: ReportType,
        command: &mut Option<GuiCommand>,
    ) {
        // Latest report of this type first; the ones before it make the
        // score trend and the history list.
        let of_type: Vec<GeneratedReport> = state
            .reports
            .reports
            .iter()
            .filter(|r| r.report_type == report_type)
            .cloned()
            .collect();

        if let Some(report) = of_type.first() {
            if let Some(action) = Self::report_preview(ui, state, report, &of_type[1..]) {
                match action {
                    PreviewAction::Regenerate => {
                        Self::generate_now(ui, state, report_type, command);
                    }
                    PreviewAction::Export(index) => {
                        if let Some(report) = of_type.get(index) {
                            Self::export_html(state, report);
                        }
                    }
                    PreviewAction::ExportPdf(index) => {
                        if let Some(report) = of_type.get(index) {
                            Self::export_pdf(state, report);
                        }
                    }
                }
            }
        } else {
            widgets::card(ui, |ui: &mut egui::Ui| {
                // The empty state carries the action it describes, instead of
                // sending the reader back up the page to find a button.
                if widgets::empty_state_with_action(
                    ui,
                    icons::FILE_EXPORT,
                    "Aucun rapport de ce type",
                    Some(
                        "La premi\u{00e8}re synth\u{00e8}se appara\u{00ee}tra ici, avec son score et ses exports.",
                    ),
                    Some((
                        format!("{}  G\u{00e9}n\u{00e9}rer le rapport", icons::PLAY).as_str(),
                        || {},
                    )),
                ) {
                    Self::generate_now(ui, state, report_type, command);
                }
            });
        }
    }

    /// The latest report as a preview: header with type, date and actions;
    /// the score dial beside the summary, the score trend across reports
    /// and what the report contains; then the earlier reports of this type.
    fn report_preview(
        ui: &mut Ui,
        state: &AppState,
        report: &GeneratedReport,
        earlier: &[GeneratedReport],
    ) -> Option<PreviewAction> {
        let mut action = None;
        let (type_label, type_color) = Self::report_type_display(&report.report_type);
        let generating = state.reports.generating;

        widgets::data_card(ui, "Aperçu du rapport", |ui: &mut egui::Ui| {
            // Header.
            ui.horizontal(|ui| {
                widgets::icon_tile(ui, icons::FILE_EXPORT, type_color, 36.0);
                ui.add_space(theme::SPACE_SM);
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(&report.title)
                                .font(theme::font_h3())
                                .color(theme::text_primary()),
                        );
                        widgets::status_badge(ui, type_label, type_color);
                    });
                    ui.label(
                        egui::RichText::new(format!(
                            "Généré le {} à {} · {}",
                            crate::format::local_date(report.generated_at),
                            crate::format::local_time(report.generated_at),
                            crate::format::ago(chrono::Utc::now(), report.generated_at)
                        ))
                        .font(theme::font_caption())
                        .color(theme::text_tertiary()),
                    );
                });
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let label = if generating {
                        format!("{}  Génération…", icons::CIRCLE_NOTCH)
                    } else {
                        format!("{}  Régénérer", icons::SYNC)
                    };
                    if widgets::button::primary_button_loading(ui, label, !generating, generating)
                        .clicked()
                    {
                        action = Some(PreviewAction::Regenerate);
                    }
                    ui.add_space(theme::SPACE_SM);
                    if widgets::button::secondary_button(
                        ui,
                        format!("{}  Exporter PDF", icons::DOWNLOAD),
                        true,
                    )
                    .on_hover_text(
                        "PDF portant l'empreinte SHA-256 du contenu sur chaque page, avec un fichier .sha256 pour vérifier le fichier.",
                    )
                    .clicked()
                    {
                        action = Some(PreviewAction::ExportPdf(0));
                    }
                    ui.add_space(theme::SPACE_SM);
                    if widgets::button::secondary_button(
                        ui,
                        format!("{}  Exporter HTML", icons::DOWNLOAD),
                        true,
                    )
                    .clicked()
                    {
                        action = Some(PreviewAction::Export(0));
                    }
                });
            });
            ui.add_space(theme::SPACE_MD);
            ui.separator();
            ui.add_space(theme::SPACE_MD);

            // Body: dial, then summary, trend and contents.
            let stacked = ui.available_width() < 640.0;
            let dial_w = 150.0;
            let body = |ui: &mut Ui| {
                ui.label(
                    egui::RichText::new("SYNTHÈSE")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                ui.add(
                    egui::Label::new(
                        egui::RichText::new(&report.summary)
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    )
                    .wrap_mode(egui::TextWrapMode::Wrap),
                );
                ui.add_space(theme::SPACE_MD);
                score_trend(ui, report, earlier);
                ui.add_space(theme::SPACE_MD);
                ui.label(
                    egui::RichText::new("CONTENU DU RAPPORT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                ui.horizontal_wrapped(|ui| {
                    for section in report_sections(&report.report_type) {
                        widgets::status_badge(ui, section, theme::ACCENT);
                    }
                    if let Some(fw) = &report.framework {
                        widgets::status_badge(ui, &fw.to_uppercase(), theme::INFO);
                    }
                });
            };
            if stacked {
                ui.vertical_centered(|ui| {
                    widgets::compliance_gauge(ui, report.compliance_score, 56.0);
                });
                ui.add_space(theme::SPACE_MD);
                body(ui);
            } else {
                let body_w = (ui.available_width()
                    - dial_w
                    - theme::SPACE_LG
                    - ui.spacing().item_spacing.x * 2.0)
                    .max(1.0);
                ui.horizontal_top(|ui| {
                    ui.vertical(|ui| {
                        ui.set_width(dial_w);
                        widgets::compliance_gauge(ui, report.compliance_score, 60.0);
                    });
                    ui.add_space(theme::SPACE_LG);
                    ui.vertical(|ui| {
                        ui.set_width(body_w);
                        body(ui);
                    });
                });
            }
        });

        if !earlier.is_empty() {
            ui.add_space(theme::SPACE_MD);
            widgets::data_card(ui, "Rapports précédents", |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("RAPPORTS PRÉCÉDENTS")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                for (offset, previous) in earlier.iter().take(5).enumerate() {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(icons::FILE_EXPORT)
                                .size(theme::ICON_XS)
                                .color(theme::text_tertiary()),
                        );
                        ui.label(
                            egui::RichText::new(crate::format::local_datetime(
                                previous.generated_at,
                            ))
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                        );
                        if let Some(score) = previous.compliance_score {
                            widgets::status_badge(
                                ui,
                                &crate::format::pct(score, 0),
                                theme::score_color(score),
                            );
                        }
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if widgets::button::icon_button(
                                ui,
                                icons::DOWNLOAD,
                                Some("Exporter en HTML"),
                            )
                            .clicked()
                            {
                                action = Some(PreviewAction::Export(offset + 1));
                            }
                        });
                    });
                }
            });
        }
        action
    }

    /// Generate a report of `report_type` now, store it, and tell the runtime.
    fn generate_now(
        ui: &Ui,
        state: &mut AppState,
        report_type: ReportType,
        command: &mut Option<GuiCommand>,
    ) {
        let framework = state
            .summary
            .active_frameworks
            .as_ref()
            .and_then(|fws| fws.first().cloned());

        // push_front shifts all indices — invalidate selection BEFORE mutating
        state.reports.selected_report = None;
        state.reports.detail_open = false;
        let report = Self::generate_report(state, report_type, framework.as_deref());
        state.reports.reports.push_front(report);
        if state.reports.reports.len() > MAX_REPORT_HISTORY {
            state.reports.reports.pop_back();
        }
        state.push_toast(
            crate::widgets::toast::Toast::success(
                "Rapport g\u{00e9}n\u{00e9}r\u{00e9} avec succ\u{00e8}s",
            ),
            ui.ctx(),
        );
        // Also emit command for runtime awareness
        *command = Some(GuiCommand::GenerateReport {
            report_type,
            framework,
        });
    }

    fn show_history_tab(ui: &mut Ui, state: &mut AppState, _command: &mut Option<GuiCommand>) {
        if state.reports.reports.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::FILE_EXPORT,
                    "Aucun rapport g\u{00e9}n\u{00e9}r\u{00e9}",
                    Some(
                        "G\u{00e9}n\u{00e9}rez un rapport depuis l\u{2019}un des onglets pour le retrouver ici.",
                    ),
                );
            });
            return;
        }

        widgets::data_card(ui, "Historique des rapports", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("HISTORIQUE DES RAPPORTS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let reports_vec: Vec<(usize, &GeneratedReport)> =
                state.reports.reports.iter().enumerate().collect();

            let mut clicked_idx: Option<usize> = None;

            ui.push_id("reports_history_table", |ui: &mut egui::Ui| {
                use widgets::table;

                let selected = state.reports.selected_report;

                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fluid(110.0, 0.0), // Type
                        table::Col::fluid(200.0, 3.0), // Titre
                        table::Col::fluid(120.0, 0.5), // Date
                        table::Col::fixed(60.0),       // Score
                        table::Col::fixed(88.0),       // Actions
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui| {
                        table::header_cell(ui, "TYPE");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "TITRE");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "DATE");
                    });
                    header.col(|ui| {
                        table::header_cell_right(ui, "SCORE");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "ACTIONS");
                    });
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, reports_vec.len(), |mut row| {
                        let row_idx = row.index();
                        let Some((real_idx, report)) = reports_vec.get(row_idx) else {
                            return;
                        };
                        let is_selected = selected == Some(*real_idx);
                        row.set_selected(is_selected);

                        row.col(|ui| {
                            let (label, color) = Self::report_type_display(&report.report_type);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui| {
                            if table::cell_link_text(ui, &report.title).clicked() {
                                clicked_idx = Some(*real_idx);
                            }
                        });

                        row.col(|ui| {
                            table::cell_small(
                                ui,
                                &crate::format::local_datetime(report.generated_at),
                            );
                        });

                        row.col(|ui| {
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if let Some(score) = report.compliance_score {
                                        table::cell_colored(
                                            ui,
                                            &crate::format::pct(score, 0),
                                            theme::readable_color(theme::score_color(score)),
                                        );
                                    } else {
                                        table::cell_empty(ui);
                                    }
                                },
                            );
                        });

                        row.col(|ui| {
                            if widgets::ghost_button(ui, format!("{}  HTML", icons::DOWNLOAD))
                                .clicked()
                            {
                                Self::export_html(state, report);
                            }
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked_idx = Some(*real_idx);
                        }
                    });
                });
            });

            if let Some(idx) = clicked_idx {
                state.reports.selected_report = Some(idx);
                state.reports.detail_open = true;
            }
        });
    }

    /// Generate a report client-side from current state data.
    fn generate_report(
        state: &AppState,
        report_type: ReportType,
        framework: Option<&str>,
    ) -> GeneratedReport {
        let now = chrono::Utc::now();
        let date_str = crate::format::local_datetime(now);

        let (title, summary, html_content, compliance_score) = match report_type {
            ReportType::Executive => Self::build_executive_report(state, &date_str),
            ReportType::ComplianceAudit => {
                Self::build_compliance_report(state, framework, &date_str)
            }
            ReportType::Incident => Self::build_incident_report(state, &date_str),
        };

        GeneratedReport {
            id: uuid::Uuid::new_v4(),
            report_type,
            title,
            generated_at: now,
            html_content,
            summary,
            compliance_score,
            framework: framework.map(String::from),
        }
    }

    fn build_executive_report(
        state: &AppState,
        date_str: &str,
    ) -> (String, String, String, Option<f32>) {
        let score = state.summary.compliance_score;
        let threat_count = state.threats.suspicious_processes.len();
        let vuln_count = state.vulnerability_findings.len();
        let check_count = state.checks.len();
        let fail_count = state
            .checks
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Fail)
            .count();

        // Top 5 failing checks
        let top_failing: Vec<String> = state
            .checks
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Fail)
            .take(5)
            .map(|c| format!("<li>{} ({})</li>", html_escape(&c.name), c.severity.label()))
            .collect();

        let top_failing_html = if top_failing.is_empty() {
            "<p>Aucun contr\u{00f4}le d\u{00e9}faillant.</p>".to_string()
        } else {
            format!("<ul>{}</ul>", top_failing.join(""))
        };

        // Vulnerability summary
        let crit_vulns = state
            .vulnerability_findings
            .iter()
            .filter(|v| v.severity == Severity::Critical)
            .count();
        let high_vulns = state
            .vulnerability_findings
            .iter()
            .filter(|v| v.severity == Severity::High)
            .count();

        let score_display = score.map_or("N/A".to_string(), |s| crate::format::pct(s, 0));

        let summary_text = format!(
            "Score de conformit\u{00e9} : {}. {} contr\u{00f4}les audit\u{00e9}s, {} d\u{00e9}faillants. {} vuln\u{00e9}rabilit\u{00e9}s d\u{00e9}tect\u{00e9}es. {} menaces actives.",
            score_display, check_count, fail_count, vuln_count, threat_count
        );

        let css = report_css("#0071e3");
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Synth&egrave;se Ex&eacute;cutive</title>
<style>{css}</style></head>
<body>
<h1>Synth&egrave;se Ex&eacute;cutive</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<div class="score">{score_display}</div>
<p>Score global de conformit&eacute;</p>
<h2>Indicateurs Cl&eacute;s</h2>
<div class="stat"><div class="stat-value">{check_count}</div><div class="stat-label">Contr&ocirc;les</div></div>
<div class="stat"><div class="stat-value">{fail_count}</div><div class="stat-label">D&eacute;faillants</div></div>
<div class="stat"><div class="stat-value">{vuln_count}</div><div class="stat-label">Vuln&eacute;rabilit&eacute;s</div></div>
<div class="stat"><div class="stat-value">{threat_count}</div><div class="stat-label">Menaces</div></div>
<h2>Top 5 Contr&ocirc;les D&eacute;faillants</h2>
{top_failing_html}
<h2>Vuln&eacute;rabilit&eacute;s</h2>
<p>{crit_vulns} critiques, {high_vulns} &eacute;lev&eacute;es sur {vuln_count} au total.</p>
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel GRC Nexus &mdash; {date_str}</div>
</body></html>"#
        );

        (
            format!("Synth\u{00e8}se ex\u{00e9}cutive \u{2014} {}", date_str),
            summary_text,
            html,
            score,
        )
    }

    fn build_compliance_report(
        state: &AppState,
        framework: Option<&str>,
        date_str: &str,
    ) -> (String, String, String, Option<f32>) {
        let mut fw_rows = String::new();
        let frameworks: Vec<String> = if let Some(fw) = framework {
            vec![fw.to_string()]
        } else {
            state.summary.active_frameworks.clone().unwrap_or_default()
        };

        let mut total_pass = 0_usize;
        let mut total_checks = 0_usize;

        for fw in &frameworks {
            let fw_checks: Vec<&crate::dto::GuiCheckResult> = state
                .checks
                .iter()
                .filter(|c| c.frameworks.iter().any(|f| f == fw))
                .collect();
            let pass = fw_checks
                .iter()
                .filter(|c| c.status == GuiCheckStatus::Pass)
                .count();
            let fail = fw_checks
                .iter()
                .filter(|c| c.status == GuiCheckStatus::Fail)
                .count();
            let total = fw_checks.len();
            total_pass = total_pass.saturating_add(pass);
            total_checks = total_checks.saturating_add(total);
            let pct = if total > 0 {
                (pass as f32 / total as f32) * 100.0
            } else {
                0.0
            };
            fw_rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{:.0}\u{202f}%</td></tr>",
                html_escape(fw),
                total,
                pass,
                fail,
                pct
            ));
        }

        let overall_pct = if total_checks > 0 {
            Some((total_pass as f32 / total_checks as f32) * 100.0)
        } else {
            state.summary.compliance_score
        };

        let score_display = overall_pct.map_or("N/A".to_string(), |s| crate::format::pct(s, 0));

        let summary_text = format!(
            "Audit de conformit\u{00e9} : {} contr\u{00f4}les analys\u{00e9}s sur {} r\u{00e9}f\u{00e9}rentiels. Taux de conformit\u{00e9} global : {}.",
            total_checks,
            frameworks.len(),
            score_display
        );

        let css = report_css("#0071e3");
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Audit de Conformit&eacute;</title>
<style>{css}</style></head>
<body>
<h1>Audit de Conformit&eacute;</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<h2>R&eacute;sultat par R&eacute;f&eacute;rentiel</h2>
<table>
<tr><th>R&eacute;f&eacute;rentiel</th><th>Total</th><th>Conforme</th><th>D&eacute;faillant</th><th>Taux</th></tr>
{fw_rows}
</table>
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel GRC Nexus &mdash; {date_str}</div>
</body></html>"#
        );

        let title = if let Some(fw) = framework {
            format!(
                "Audit conformit\u{00e9} {} \u{2014} {}",
                fw.to_uppercase(),
                date_str
            )
        } else {
            format!("Audit conformit\u{00e9} global \u{2014} {}", date_str)
        };

        (title, summary_text, html, overall_pct)
    }

    fn build_incident_report(
        state: &AppState,
        date_str: &str,
    ) -> (String, String, String, Option<f32>) {
        let threat_count = state.threats.suspicious_processes.len();

        let mut process_rows = String::new();
        for proc in state.threats.suspicious_processes.iter().take(50) {
            process_rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}\u{202f}%</td><td>{}</td></tr>",
                html_escape(&proc.process_name),
                html_escape(&proc.reason),
                proc.confidence,
                crate::format::local_datetime(proc.detected_at),
            ));
        }

        let incident_count = state.threats.system_incidents.len();
        let mut incident_rows = String::new();
        for inc in state.threats.system_incidents.iter().take(50) {
            incident_rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                html_escape(&inc.title),
                inc.severity.label(),
                inc.confidence,
                crate::format::local_datetime(inc.detected_at),
            ));
        }

        let summary_text = format!(
            "{} processus suspects d\u{00e9}tect\u{00e9}s. {} incidents syst\u{00e8}me enregistr\u{00e9}s.",
            threat_count, incident_count
        );

        let css = report_css("#e30000");
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Rapport d'Incidents</title>
<style>{css}</style></head>
<body>
<h1>Rapport d'Incidents</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<h2>Processus Suspects ({threat_count})</h2>
<table>
<tr><th>Processus</th><th>Raison</th><th>Confiance</th><th>D&eacute;tect&eacute;</th></tr>
{process_rows}
</table>
<h2>Incidents Syst&egrave;me ({incident_count})</h2>
<table>
<tr><th>Titre</th><th>S&eacute;v&eacute;rit&eacute;</th><th>Confiance</th><th>D&eacute;tect&eacute;</th></tr>
{incident_rows}
</table>
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel GRC Nexus &mdash; {date_str}</div>
</body></html>"#
        );

        (
            format!("Rapport d\u{2019}incidents \u{2014} {}", date_str),
            summary_text,
            html,
            None,
        )
    }

    /// File name of an exported report, without its extension.
    fn export_stem(report: &GeneratedReport) -> String {
        format!(
            "rapport_{}_{}",
            match report.report_type {
                ReportType::Executive => "executif",
                ReportType::ComplianceAudit => "conformite",
                ReportType::Incident => "incidents",
            },
            report.generated_at.format("%Y%m%d_%H%M%S"),
        )
    }

    /// Export the report as a PDF, with a `.sha256` file beside it holding
    /// the fingerprint of the PDF file (in `sha256sum` format).
    fn export_pdf(state: &AppState, report: &GeneratedReport) {
        let pdf = crate::pdf::report_pdf(&report.title, &report.html_content, report.generated_at);
        let filename = format!("{}.pdf", Self::export_stem(report));
        let path = crate::export::default_export_path(&filename);
        let write = move || -> (bool, String) {
            let checksum = format!("{}  {filename}\n", crate::pdf::file_fingerprint(&pdf));
            let mut checksum_path = path.as_os_str().to_owned();
            checksum_path.push(".sha256");
            match std::fs::write(&path, &pdf)
                .and_then(|()| std::fs::write(&checksum_path, checksum))
            {
                Ok(()) => (
                    true,
                    format!("Rapport PDF export\u{00e9} : {}", path.display()),
                ),
                Err(e) => (false, format!("\u{00c9}chec export PDF : {e}")),
            }
        };

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let (success, message) = write();
                if let Err(e) = tx.send(crate::app::AsyncTaskResult::HtmlExport(success, message)) {
                    tracing::warn!("Failed to send PDF export result: {}", e);
                }
            });
        } else {
            let (success, message) = write();
            if success {
                tracing::info!("{}", message);
            } else {
                tracing::error!("{}", message);
            }
        }
    }

    fn export_html(state: &AppState, report: &GeneratedReport) {
        let html = report.html_content.clone();
        let filename = format!("{}.html", Self::export_stem(report));
        let path = crate::export::default_export_path(&filename);

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || match std::fs::write(&path, html.as_bytes()) {
                Ok(()) => {
                    let msg = format!("Rapport HTML export\u{00e9} : {}", path.display());
                    if let Err(e) = tx.send(crate::app::AsyncTaskResult::HtmlExport(true, msg)) {
                        tracing::warn!("Failed to send HTML export success: {}", e);
                    }
                }
                Err(e) => {
                    let msg = format!("\u{00c9}chec export HTML : {}", e);
                    if let Err(send_err) =
                        tx.send(crate::app::AsyncTaskResult::HtmlExport(false, msg))
                    {
                        tracing::warn!("Failed to send HTML export error: {}", send_err);
                    }
                }
            });
        } else {
            // Fallback: synchronous write
            match std::fs::write(&path, html.as_bytes()) {
                Ok(()) => {
                    tracing::info!("HTML export: {}", path.display());
                }
                Err(e) => {
                    tracing::error!("HTML export failed: {}", e);
                }
            }
        }
    }

    fn report_type_display(rt: &ReportType) -> (&'static str, egui::Color32) {
        match rt {
            ReportType::Executive => ("EX\u{00c9}CUTIF", theme::ACCENT),
            ReportType::ComplianceAudit => ("CONFORMIT\u{00c9}", theme::INFO),
            ReportType::Incident => ("INCIDENTS", theme::ERROR),
        }
    }
}

/// What the report preview asked for.
enum PreviewAction {
    Regenerate,
    /// Export the report at this index among the reports of the type.
    Export(usize),
    /// Same, as a PDF.
    ExportPdf(usize),
}

/// Sections each report type's HTML carries, as shown in the preview.
fn report_sections(report_type: &ReportType) -> &'static [&'static str] {
    match report_type {
        ReportType::Executive => &[
            "Score global",
            "Indicateurs clés",
            "Top 5 contrôles défaillants",
            "Vulnérabilités",
        ],
        ReportType::ComplianceAudit => &[
            "Score par référentiel",
            "Contrôles et statuts",
            "Écarts à corriger",
        ],
        ReportType::Incident => &["Incidents EDR", "Chronologie", "Actions de réponse"],
    }
}

/// Score of this report against the earlier ones of its type: a sparkline
/// oldest to newest and the change since the previous report.
fn score_trend(ui: &mut Ui, report: &GeneratedReport, earlier: &[GeneratedReport]) {
    let Some(score) = report.compliance_score else {
        return;
    };
    ui.label(
        egui::RichText::new("ÉVOLUTION DU SCORE")
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
    ui.add_space(theme::SPACE_XS);
    let points: Vec<[f64; 2]> = earlier
        .iter()
        .rev()
        .filter_map(|r| r.compliance_score)
        .chain(std::iter::once(score))
        .enumerate()
        .map(|(i, s)| [i as f64, s as f64])
        .collect();
    if points.len() < 2 {
        ui.label(
            egui::RichText::new("Premier rapport de ce type : l'évolution apparaîtra au suivant.")
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
        return;
    }
    ui.horizontal(|ui| {
        let config = widgets::SparklineConfig {
            color: theme::score_color(score),
            ..Default::default()
        };
        // The latest twelve, still oldest to newest. The sparkline's axis
        // starts at zero, which flattened 78 → 87 % into a line; the shape
        // is what matters here, so the series sits just above its minimum.
        let recent = &points[points.len().saturating_sub(12)..];
        let floor = recent.iter().map(|p| p[1]).fold(f64::MAX, f64::min) - 2.0;
        let recent: Vec<[f64; 2]> = recent.iter().map(|p| [p[0], p[1] - floor]).collect();
        widgets::sparkline(
            ui,
            "report_trend",
            &recent,
            egui::vec2(180.0, 36.0),
            &config,
        );
        ui.add_space(theme::SPACE_SM);
        if let Some(previous) = earlier.iter().find_map(|r| r.compliance_score) {
            let diff = score - previous;
            let (arrow, color) = if diff >= 0.0 {
                ("▲", theme::SUCCESS)
            } else {
                ("▼", theme::ERROR)
            };
            ui.label(
                egui::RichText::new(format!(
                    "{arrow} {} pt depuis le rapport précédent",
                    crate::format::decimal(diff.abs(), 1)
                ))
                .font(theme::font_caption())
                .color(theme::readable_color(color)),
            );
        }
    });
}

/// Generate shared CSS for HTML report exports with light/dark mode support.
///
/// `accent_color` is injected as the accent for `h1`, `.score`, and borders
/// (e.g. `"#0071e3"` for executive/compliance, `"#e30000"` for incident).
///
/// Colors are aligned with the GUI theme system for consistency and WCAG AAA
/// contrast compliance in both light and dark modes.
fn report_css(accent_color: &str) -> String {
    format!(
        r#"body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #000; background: #f3f4fa; }}
h1 {{ color: {accent}; border-bottom: 2px solid {accent}; padding-bottom: 12px; }}
h2 {{ color: #000; margin-top: 24px; }}
.score {{ font-size: 48px; font-weight: bold; color: {accent}; }}
.stat {{ display: inline-block; margin-right: 32px; text-align: center; }}
.stat-value {{ font-size: 28px; font-weight: bold; }}
.stat-label {{ font-size: 12px; color: #48484d; text-transform: uppercase; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #c0c2d0; }}
th {{ color: #48484d; font-size: 11px; text-transform: uppercase; }}
.footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #c0c2d0; font-size: 11px; color: #58585c; }}
@media (prefers-color-scheme: dark) {{
  body {{ background: #0c0d12; color: #fff; }}
  h2 {{ color: #afafb4; }}
  th, td {{ border-bottom-color: #3a3b44; }}
  th {{ color: #9b9ba0; }}
  .stat-label {{ color: #9b9ba0; }}
  .footer {{ border-top-color: #3a3b44; color: #9b9ba0; }}
}}"#,
        accent = accent_color
    )
}

/// Minimal HTML entity escaping for user data injected into report HTML.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
