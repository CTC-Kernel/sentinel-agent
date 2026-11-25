// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reports page — generate and export compliance, executive, and incident reports.

use egui::Ui;

use super::compliance::{CompliancePage, framework_key, framework_label};
use crate::app::AppState;
use crate::dto::{GeneratedReport, GuiCheckResult, GuiCheckStatus, ReportType, Severity};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Name the sort of the history table is kept under.
const HISTORY_TABLE: &str = "report_history";

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
            0 => Self::show_report_tab(ui, state, ReportType::Executive),
            1 => Self::show_report_tab(ui, state, ReportType::ComplianceAudit),
            2 => Self::show_report_tab(ui, state, ReportType::Incident),
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

    fn show_report_tab(ui: &mut Ui, state: &mut AppState, report_type: ReportType) {
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
            if let Some(action) = Self::report_preview(ui, report, &of_type[1..]) {
                match action {
                    PreviewAction::Regenerate => {
                        Self::generate_now(ui.ctx(), state, report_type);
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
                    Self::generate_now(ui.ctx(), state, report_type);
                }
            });
        }
    }

    /// The latest report as a preview: header with type, date and actions;
    /// the score dial beside the summary, the score trend across reports
    /// and what the report contains; then the earlier reports of this type.
    fn report_preview(
        ui: &mut Ui,
        report: &GeneratedReport,
        earlier: &[GeneratedReport],
    ) -> Option<PreviewAction> {
        let mut action = None;
        let (type_label, type_color) = Self::report_type_display(&report.report_type);

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
                    // The report is built from the state at hand, at once.
                    if widgets::primary_button(ui, format!("{}  Régénérer", icons::SYNC), true)
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
            if report.compliance_score.is_none() {
                // No score to show (incident reports): no empty dial.
                body(ui);
            } else if stacked {
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
                            if widgets::ghost_button(ui, format!("{}  HTML", icons::DOWNLOAD))
                                .clicked()
                            {
                                action = Some(PreviewAction::Export(offset + 1));
                            }
                            if widgets::ghost_button(ui, format!("{}  PDF", icons::DOWNLOAD))
                                .clicked()
                            {
                                action = Some(PreviewAction::ExportPdf(offset + 1));
                            }
                        });
                    });
                }
            });
        }
        action
    }

    /// Generate a report of `report_type` now and store it.
    ///
    /// The report is built here, from the state the interface holds, and
    /// kept with the preferences so the history survives a restart. The
    /// compliance audit covers every active framework.
    fn generate_now(ctx: &egui::Context, state: &mut AppState, report_type: ReportType) {
        let framework: Option<String> = None;

        // push_front shifts all indices — invalidate selection BEFORE mutating
        state.reports.selected_report = None;
        state.reports.detail_open = false;
        let report = Self::generate_report(state, report_type, framework.as_deref());
        // The history file changes here and nowhere else: one file for the
        // new report, and the one that leaves the history removed.
        let stored = state
            .reports
            .history_dir
            .as_deref()
            .map(|dir| store_report(dir, &report));
        state.reports.reports.push_front(report);
        while state.reports.reports.len() > MAX_REPORT_HISTORY {
            if let Some(dropped) = state.reports.reports.pop_back()
                && let Some(dir) = state.reports.history_dir.as_deref()
            {
                remove_report(dir, dropped.id);
            }
        }
        if let Some(Err(e)) = stored {
            tracing::warn!("Report history not written: {}", e);
            state.push_toast(
                crate::widgets::toast::Toast::error(format!(
                    "Rapport g\u{00e9}n\u{00e9}r\u{00e9}, mais non conserv\u{00e9} dans l\u{2019}historique : {e}"
                )),
                ctx,
            );
            return;
        }
        state.push_toast(
            crate::widgets::toast::Toast::success(
                "Rapport g\u{00e9}n\u{00e9}r\u{00e9} avec succ\u{00e8}s",
            ),
            ctx,
        );
    }

    /// Load the reports kept in `dir` and keep the next ones there. Called
    /// once at start by the main window; the tray popup never calls it, so
    /// it neither reads nor writes the history.
    pub fn restore_history(state: &mut AppState, dir: std::path::PathBuf) {
        for report in load_history(&dir) {
            if state.reports.reports.len() < MAX_REPORT_HISTORY
                && !state.reports.reports.iter().any(|r| r.id == report.id)
            {
                state.reports.reports.push_back(report);
            }
        }
        state.reports.history_dir = Some(dir);
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

            let mut reports_vec: Vec<(usize, &GeneratedReport)> =
                state.reports.reports.iter().enumerate().collect();
            sort_history(
                &mut reports_vec,
                &widgets::table::sort_of(ui.ctx(), HISTORY_TABLE),
            );

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
                        table::Col::fixed(168.0),      // Actions
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    for (label, key) in [
                        ("TYPE", "type"),
                        ("TITRE", "title"),
                        ("DATE", "date"),
                        ("SCORE", "score"),
                    ] {
                        header.col(|ui| {
                            // Rows are selected by their place in the
                            // history, which a new order does not change.
                            table::header_cell_sortable(ui, label, HISTORY_TABLE, key);
                        });
                    }
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
                            if widgets::ghost_button(ui, format!("{}  PDF", icons::DOWNLOAD))
                                .clicked()
                            {
                                Self::export_pdf(state, report);
                            }
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

        let score_display = score.map_or(NO_SCORE.to_string(), |s| crate::format::pct(s, 0));

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
<h2>Indicateurs cl&eacute;s</h2>
<div class="stat"><div class="stat-value">{check_count}</div><div class="stat-label">Contr&ocirc;les</div></div>
<div class="stat"><div class="stat-value">{fail_count}</div><div class="stat-label">D&eacute;faillants</div></div>
<div class="stat"><div class="stat-value">{vuln_count}</div><div class="stat-label">Vuln&eacute;rabilit&eacute;s</div></div>
<div class="stat"><div class="stat-value">{threat_count}</div><div class="stat-label">Menaces</div></div>
<h2>Top 5 contr&ocirc;les d&eacute;faillants</h2>
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
        // Frameworks by canonical id: the configuration says "CIS" where the
        // checks are tagged "CIS_V8". Without active frameworks, those the
        // checks name.
        let mut frameworks: Vec<String> = match framework {
            Some(fw) => vec![framework_key(fw)],
            None => state
                .summary
                .active_frameworks
                .iter()
                .flatten()
                .map(|fw| framework_key(fw))
                .collect(),
        };
        if frameworks.is_empty() {
            frameworks = state
                .checks
                .iter()
                .flat_map(|c| c.frameworks.iter().map(|fw| framework_key(fw)))
                .collect();
        }
        frameworks.sort();
        frameworks.dedup();

        let covers = |check: &GuiCheckResult, key: &str| {
            check.frameworks.iter().any(|fw| framework_key(fw) == key)
        };

        let mut fw_rows = String::new();
        for fw in &frameworks {
            let fw_checks: Vec<&GuiCheckResult> =
                state.checks.iter().filter(|c| covers(c, fw)).collect();
            let pass = fw_checks
                .iter()
                .filter(|c| c.status == GuiCheckStatus::Pass)
                .count();
            let fail = fw_checks
                .iter()
                .filter(|c| c.status == GuiCheckStatus::Fail)
                .count();
            let total = fw_checks.len();
            let rate = if total > 0 {
                crate::format::pct((pass as f32 / total as f32) * 100.0, 0)
            } else {
                NO_SCORE.to_string()
            };
            fw_rows.push_str(&format!(
                "<tr><td>{}</td><td>{total}</td><td>{pass}</td><td>{fail}</td><td>{rate}</td></tr>",
                html_escape(framework_label(fw)),
            ));
        }

        // The controls of the audited frameworks, each counted once.
        let audited: Vec<&GuiCheckResult> = state
            .checks
            .iter()
            .filter(|c| frameworks.iter().any(|fw| covers(c, fw)))
            .collect();
        let total_checks = audited.len();
        let total_pass = audited
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Pass)
            .count();

        // All frameworks: the score of the Conformité page. One framework:
        // its share of compliant controls.
        let overall_pct = match framework {
            None => state.summary.compliance_score,
            Some(_) if total_checks > 0 => Some((total_pass as f32 / total_checks as f32) * 100.0),
            Some(_) => None,
        };
        let score_display = overall_pct.map_or(NO_SCORE.to_string(), |s| crate::format::pct(s, 0));

        let mut check_rows = String::new();
        for check in &audited {
            check_rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                html_escape(&check.name),
                html_escape(&CompliancePage::format_category(&check.category)),
                check_status_label(check.status),
                check.severity.label(),
            ));
        }

        // Gaps: failed controls, the most severe first, with what was found
        // and how to correct it.
        let mut gaps: Vec<&GuiCheckResult> = audited
            .iter()
            .copied()
            .filter(|c| c.status == GuiCheckStatus::Fail)
            .collect();
        gaps.sort_by_key(|c| severity_rank(c.severity));
        let gaps_html = if gaps.is_empty() {
            "<p>Aucun \u{00e9}cart : aucun contr\u{00f4}le audit\u{00e9} n\u{2019}est non conforme.</p>"
                .to_string()
        } else {
            let rows: String = gaps
                .iter()
                .map(|check| {
                    format!(
                        "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                        html_escape(&check.name),
                        check.severity.label(),
                        html_escape(check.message.as_deref().unwrap_or("\u{2014}")),
                        html_escape(check.remediation.as_deref().unwrap_or("\u{2014}")),
                    )
                })
                .collect();
            format!(
                "<table>\n<tr><th>Contr\u{00f4}le</th><th>S\u{00e9}v\u{00e9}rit\u{00e9}</th><th>Constat</th><th>Correction</th></tr>\n{rows}\n</table>"
            )
        };

        let summary_text = format!(
            "Audit de conformit\u{00e9} : {} sur {}, {}. Score de conformit\u{00e9} : {}.",
            analysed(total_checks),
            crate::format::count(frameworks.len(), "r\u{00e9}f\u{00e9}rentiel"),
            crate::format::count(gaps.len(), "\u{00e9}cart"),
            score_display
        );

        let css = report_css("#0071e3");
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Audit de conformit&eacute;</title>
<style>{css}</style></head>
<body>
<h1>Audit de conformit&eacute;</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<div class="score">{score_display}</div>
<p>Score de conformit&eacute;</p>
<h2>Score par r&eacute;f&eacute;rentiel</h2>
<table>
<tr><th>R&eacute;f&eacute;rentiel</th><th>Contr&ocirc;les</th><th>Conformes</th><th>Non conformes</th><th>Taux</th></tr>
{fw_rows}
</table>
<h2>Contr&ocirc;les et statuts</h2>
<table>
<tr><th>Contr&ocirc;le</th><th>Domaine</th><th>Statut</th><th>S&eacute;v&eacute;rit&eacute;</th></tr>
{check_rows}
</table>
<h2>&Eacute;carts &agrave; corriger</h2>
{gaps_html}
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel GRC Nexus &mdash; {date_str}</div>
</body></html>"#
        );

        let title = if let Some(fw) = framework {
            format!(
                "Audit de conformit\u{00e9} {} \u{2014} {}",
                framework_label(fw),
                date_str
            )
        } else {
            format!("Audit de conformit\u{00e9} \u{2014} {}", date_str)
        };

        (title, summary_text, html, overall_pct)
    }

    fn build_incident_report(
        state: &AppState,
        date_str: &str,
    ) -> (String, String, String, Option<f32>) {
        let threat_count = state.threats.suspicious_processes.len();
        let no_rows = |columns: usize, text: &str| {
            format!(
                "<tr><td>{text}</td>{}</tr>",
                "<td></td>".repeat(columns - 1)
            )
        };

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
        if process_rows.is_empty() {
            process_rows = no_rows(4, "Aucun processus suspect.");
        }

        let incident_count = state.threats.system_incidents.len();
        let mut incident_rows = String::new();
        for inc in state.threats.system_incidents.iter().take(50) {
            incident_rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td>{}\u{202f}%</td><td>{}</td></tr>",
                html_escape(&inc.title),
                inc.severity.label(),
                inc.confidence,
                crate::format::local_datetime(inc.detected_at),
            ));
        }
        if incident_rows.is_empty() {
            incident_rows = no_rows(4, "Aucun incident syst\u{00e8}me.");
        }

        // Chronology: detections and response actions on one time line,
        // the most recent first.
        let mut timeline: Vec<(chrono::DateTime<chrono::Utc>, &str, String)> = Vec::new();
        for proc in &state.threats.suspicious_processes {
            timeline.push((
                proc.detected_at,
                "Processus suspect",
                format!("{} \u{2014} {}", proc.process_name, proc.reason),
            ));
        }
        for inc in &state.threats.system_incidents {
            timeline.push((
                inc.detected_at,
                "Incident syst\u{00e8}me",
                inc.title.clone(),
            ));
        }
        for entry in &state.threats.response_log {
            timeline.push((
                entry.timestamp,
                "Action de r\u{00e9}ponse",
                format!("{} \u{2014} {}", entry.action_type.label_fr(), entry.target),
            ));
        }
        timeline.sort_by_key(|(at, _, _)| std::cmp::Reverse(*at));
        let mut timeline_rows: String = timeline
            .iter()
            .take(100)
            .map(|(at, kind, what)| {
                format!(
                    "<tr><td>{}</td><td>{kind}</td><td>{}</td></tr>",
                    crate::format::local_datetime(*at),
                    html_escape(what),
                )
            })
            .collect();
        if timeline_rows.is_empty() {
            timeline_rows = no_rows(3, "Aucun \u{00e9}v\u{00e9}nement.");
        }

        let response_count = state.threats.response_log.len();
        let mut response_rows: String = state
            .threats
            .response_log
            .iter()
            .take(50)
            .map(|entry| {
                format!(
                    "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                    crate::format::local_datetime(entry.timestamp),
                    entry.action_type.label_fr(),
                    html_escape(&entry.target),
                    entry.status.label_fr(),
                    html_escape(&entry.operator),
                )
            })
            .collect();
        if response_rows.is_empty() {
            response_rows = no_rows(5, "Aucune action de r\u{00e9}ponse enregistr\u{00e9}e.");
        }

        let plural = |n: usize| crate::format::plural_suffix(n);
        let summary_text = format!(
            "{} processus suspect{} d\u{00e9}tect\u{00e9}{}. {} incident{} syst\u{00e8}me enregistr\u{00e9}{}. {} action{} de r\u{00e9}ponse men\u{00e9}e{}.",
            crate::format::int(threat_count),
            plural(threat_count),
            plural(threat_count),
            crate::format::int(incident_count),
            plural(incident_count),
            plural(incident_count),
            crate::format::int(response_count),
            plural(response_count),
            plural(response_count),
        );

        let css = report_css("#e30000");
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Rapport d'incidents</title>
<style>{css}</style></head>
<body>
<h1>Rapport d'incidents</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<h2>Processus suspects ({threat_count})</h2>
<table>
<tr><th>Processus</th><th>Raison</th><th>Confiance</th><th>D&eacute;tect&eacute;</th></tr>
{process_rows}
</table>
<h2>Incidents syst&egrave;me ({incident_count})</h2>
<table>
<tr><th>Titre</th><th>S&eacute;v&eacute;rit&eacute;</th><th>Confiance</th><th>D&eacute;tect&eacute;</th></tr>
{incident_rows}
</table>
<h2>Chronologie</h2>
<table>
<tr><th>Date</th><th>Type</th><th>&Eacute;v&eacute;nement</th></tr>
{timeline_rows}
</table>
<h2>Actions de r&eacute;ponse ({response_count})</h2>
<table>
<tr><th>Date</th><th>Action</th><th>Cible</th><th>Statut</th><th>Op&eacute;rateur</th></tr>
{response_rows}
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

/// File of a report in the history folder: one JSON file per report, so
/// keeping a new report never rewrites the others.
fn report_path(dir: &std::path::Path, id: uuid::Uuid) -> std::path::PathBuf {
    dir.join(format!("{id}.json"))
}

/// Write `report` to the history folder. Written beside its final name and
/// renamed, so an interrupted write never leaves half a report.
fn store_report(dir: &std::path::Path, report: &GeneratedReport) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let json = serde_json::to_vec(report).map_err(std::io::Error::other)?;
    let path = report_path(dir, report.id);
    let partial = path.with_extension("json.partial");
    std::fs::write(&partial, json)?;
    std::fs::rename(&partial, &path)
}

/// Forget a report that left the history. A file already gone is not an error.
fn remove_report(dir: &std::path::Path, id: uuid::Uuid) {
    if let Err(e) = std::fs::remove_file(report_path(dir, id))
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!("Report {} not removed from the history: {}", id, e);
    }
}

/// The reports kept in `dir`, latest first, at most [`MAX_REPORT_HISTORY`].
/// A missing folder is an empty history; an unreadable file is skipped.
fn load_history(dir: &std::path::Path) -> Vec<GeneratedReport> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut reports: Vec<GeneratedReport> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .filter_map(|path| match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map_err(|e| tracing::warn!("Report {} unreadable: {}", path.display(), e))
                .ok(),
            Err(e) => {
                tracing::warn!("Report {} unreadable: {}", path.display(), e);
                None
            }
        })
        .collect();
    reports.sort_by_key(|report| std::cmp::Reverse(report.generated_at));
    reports.truncate(MAX_REPORT_HISTORY);
    reports
}

/// Reorder the history rows on the sorted column; latest first without a
/// sort. Stable.
fn sort_history(rows: &mut [(usize, &GeneratedReport)], sort: &widgets::data_table::TableSort) {
    if let Some(key) = widgets::table::sort_key(sort) {
        rows.sort_by(|(_, a), (_, b)| widgets::table::directed(sort, compare_reports(key, a, b)));
    }
}

/// Natural (ascending) order of two reports on the column `key`.
fn compare_reports(key: &str, a: &GeneratedReport, b: &GeneratedReport) -> std::cmp::Ordering {
    let type_label =
        |report: &GeneratedReport| ReportsPage::report_type_display(&report.report_type).0;
    let score = |report: &GeneratedReport| report.compliance_score.filter(|s| s.is_finite());
    match key {
        "type" => type_label(a).cmp(type_label(b)),
        "title" => a.title.to_lowercase().cmp(&b.title.to_lowercase()),
        "date" => a.generated_at.cmp(&b.generated_at),
        // A report without score sorts before those that have one.
        "score" => match (score(a), score(b)) {
            (Some(a), Some(b)) => a.total_cmp(&b),
            (a, b) => a.is_some().cmp(&b.is_some()),
        },
        _ => std::cmp::Ordering::Equal,
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
        ReportType::Incident => &[
            "Processus suspects",
            "Incidents système",
            "Chronologie",
            "Actions de réponse",
        ],
    }
}

/// Shown where a report has no score to give.
const NO_SCORE: &str = "Non évalué";

/// "12 contrôles analysés", agreeing in number.
fn analysed(checks: usize) -> String {
    format!(
        "{} analysé{}",
        crate::format::count(checks, "contrôle"),
        crate::format::plural_suffix(checks)
    )
}

fn check_status_label(status: GuiCheckStatus) -> &'static str {
    match status {
        GuiCheckStatus::Pass => "Conforme",
        GuiCheckStatus::Fail => "Non conforme",
        GuiCheckStatus::Error => "Erreur",
        GuiCheckStatus::Skipped => "Ignoré",
        GuiCheckStatus::Pending => "En attente",
        GuiCheckStatus::Running => "En cours",
    }
}

/// Order of the gaps: the most severe first.
fn severity_rank(severity: Severity) -> u8 {
    match severity {
        Severity::Critical => 0,
        Severity::High => 1,
        Severity::Medium => 2,
        Severity::Low => 3,
        Severity::Info => 4,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Generating a report stores exactly one report, complete.
    #[test]
    fn generate_now_stores_one_complete_report() {
        let ctx = egui::Context::default();
        let mut state = AppState::default();

        ReportsPage::generate_now(&ctx, &mut state, ReportType::Executive);

        assert_eq!(state.reports.reports.len(), 1);
        let report = &state.reports.reports[0];
        assert_eq!(report.report_type, ReportType::Executive);
        assert!(report.html_content.len() > 200, "the report has a body");
        assert_eq!(state.toasts.len(), 1);
    }

    fn check(id: &str, status: &str, frameworks: &[&str]) -> GuiCheckResult {
        serde_json::from_value(serde_json::json!({
            "check_id": id, "name": format!("Contrôle {id}"), "category": "firewall",
            "status": status, "severity": "high", "frameworks": frameworks,
            "message": "Pare-feu inactif", "remediation": "Activer le pare-feu"
        }))
        .unwrap()
    }

    fn texts(html: &str) -> Vec<String> {
        crate::pdf::html_to_blocks(html)
            .into_iter()
            .filter_map(|block| match block {
                crate::pdf::Block::Heading { text, .. } | crate::pdf::Block::Paragraph(text) => {
                    Some(text.to_lowercase())
                }
                _ => None,
            })
            .collect()
    }

    /// Regression: the audit compared the configured name ("CIS") with the
    /// tag of the checks ("CIS_V8") and reported zero controls, for the
    /// first framework only.
    #[test]
    fn the_compliance_audit_covers_every_active_framework() {
        let mut state = AppState::default();
        state.summary.active_frameworks = Some(vec!["CIS".into(), "NIS 2".into()]);
        state.checks = vec![
            check("a", "fail", &["CIS_V8"]),
            check("b", "pass", &["CIS_V8", "NIS2"]),
            check("c", "pass", &["NIS2"]),
        ];

        let (title, summary, html, _) =
            ReportsPage::build_compliance_report(&state, None, "01/01/2026 08:00");

        assert!(!title.contains("CIS"), "{title}");
        assert!(
            summary.contains("3 contrôles analysés sur 2 référentiels"),
            "{summary}"
        );
        assert!(summary.contains("1 écart"), "{summary}");
        // CIS: 2 controls, 1 compliant, 1 not. NIS 2: 2 compliant.
        assert!(html.contains("<td>2</td><td>1</td><td>1</td>"), "{html}");
        assert!(html.contains("<td>2</td><td>2</td><td>0</td>"), "{html}");
        // The gap carries what was found and how to correct it.
        assert!(html.contains("Pare-feu inactif") && html.contains("Activer le pare-feu"));
    }

    /// The preview lists what each report holds: every name it shows must be
    /// a section of the report.
    #[test]
    fn every_announced_section_is_in_the_report() {
        let state = AppState::default();
        for report_type in [
            ReportType::Executive,
            ReportType::ComplianceAudit,
            ReportType::Incident,
        ] {
            let report = ReportsPage::generate_report(&state, report_type, None);
            let texts = texts(&report.html_content);
            for section in report_sections(&report_type) {
                let wanted = section.to_lowercase();
                assert!(
                    texts.iter().any(|text| text.contains(&wanted)),
                    "{report_type:?}: « {section} » is announced but missing"
                );
            }
        }
    }

    fn stored_report(score: Option<f32>, minutes_ago: i64, title: &str) -> GeneratedReport {
        GeneratedReport {
            id: uuid::Uuid::new_v4(),
            report_type: ReportType::Executive,
            title: title.into(),
            generated_at: chrono::Utc::now() - chrono::Duration::minutes(minutes_ago),
            html_content: "<h1>Rapport</h1>".into(),
            summary: String::new(),
            compliance_score: score,
            framework: None,
        }
    }

    fn history_dir(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("sentinel_reports_{name}_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    /// The history has its own folder: written when a report is generated,
    /// read back at start, and absent from the preferences.
    #[test]
    fn report_history_survives_a_restart_outside_the_preferences() {
        let ctx = egui::Context::default();
        let dir = history_dir("restart");

        let mut state = AppState::default();
        ReportsPage::restore_history(&mut state, dir.clone());
        assert!(
            state.reports.reports.is_empty(),
            "no folder yet: empty history"
        );
        ReportsPage::generate_now(&ctx, &mut state, ReportType::Incident);
        ReportsPage::generate_now(&ctx, &mut state, ReportType::Executive);
        assert_eq!(
            std::fs::read_dir(&dir).unwrap().count(),
            2,
            "one file per report"
        );

        let preferences =
            serde_json::to_string(&crate::state::GuiPreferences::from_state(&state)).unwrap();
        assert!(
            !preferences.contains("html_content"),
            "not in the preferences"
        );

        let mut restarted = AppState::default();
        ReportsPage::restore_history(&mut restarted, dir.clone());
        let ids = |state: &AppState| {
            state
                .reports
                .reports
                .iter()
                .map(|r| r.id)
                .collect::<Vec<_>>()
        };
        assert_eq!(ids(&restarted), ids(&state), "same reports, latest first");

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Without a history folder (tray popup, previews, tests) nothing is
    /// read or written.
    #[test]
    fn a_state_without_history_folder_writes_nothing() {
        let ctx = egui::Context::default();
        let mut state = AppState::default();
        assert!(state.reports.history_dir.is_none());
        ReportsPage::generate_now(&ctx, &mut state, ReportType::Executive);
        assert_eq!(state.reports.reports.len(), 1);
        assert_eq!(state.toasts.len(), 1, "generated, no storage error");
    }

    #[test]
    fn the_history_is_capped_and_its_files_follow() {
        let ctx = egui::Context::default();
        let dir = history_dir("cap");
        let mut state = AppState::default();
        ReportsPage::restore_history(&mut state, dir.clone());
        for _ in 0..MAX_REPORT_HISTORY + 2 {
            ReportsPage::generate_now(&ctx, &mut state, ReportType::Incident);
        }
        assert_eq!(state.reports.reports.len(), MAX_REPORT_HISTORY);
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), MAX_REPORT_HISTORY);

        // A damaged file is skipped, not fatal.
        std::fs::write(dir.join("abime.json"), b"{").unwrap();
        assert_eq!(load_history(&dir).len(), MAX_REPORT_HISTORY);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_history_sorts_scores_as_numbers_and_dates_by_time() {
        use widgets::data_table::{SortDirection, TableSort};
        let reports = [
            stored_report(Some(9.0), 10, "beta"),
            stored_report(Some(100.0), 30, "Alpha"),
            stored_report(None, 1, "gamma"),
        ];
        let order = |key: &str, direction| {
            let mut rows: Vec<(usize, &GeneratedReport)> = reports.iter().enumerate().collect();
            sort_history(&mut rows, &TableSort::by(key, direction));
            rows.iter().map(|(index, _)| *index).collect::<Vec<_>>()
        };
        assert_eq!(order("score", SortDirection::Ascending), [2, 0, 1]);
        assert_eq!(order("score", SortDirection::Descending), [1, 0, 2]);
        assert_eq!(order("date", SortDirection::Ascending), [1, 0, 2]);
        assert_eq!(order("title", SortDirection::Ascending), [1, 0, 2]);
        assert_eq!(order("title", SortDirection::None), [0, 1, 2]);
    }
}
