//! Reports page — generate and export compliance, executive, and incident reports.

use egui::Ui;
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
use crate::dto::{GeneratedReport, GuiCheckStatus, ReportType, Severity};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Reports page.
pub struct ReportsPage;

impl ReportsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Rapports"],
            "Centre de Rapports",
            Some("G\u{00c9}N\u{00c9}RATION ET EXPORT DE RAPPORTS CONFORMIT\u{00c9} / AUDIT / INCIDENTS"),
            Some(
                "G\u{00e9}n\u{00e9}rez des rapports d\u{00e9}taill\u{00e9}s pour vos audits de conformit\u{00e9}, synth\u{00e8}ses ex\u{00e9}cutives et rapports d\u{2019}incidents. Chaque rapport peut \u{00ea}tre export\u{00e9} au format HTML.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Tab bar
        let tab_labels = &[
            "SYNTH\u{00c8}SE EX\u{00c9}CUTIVE",
            "AUDIT CONFORMIT\u{00c9}",
            "INCIDENTS",
            "HISTORIQUE",
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
                    widgets::DetailAction::primary("Exporter HTML", icons::DOWNLOAD),
                ];

                let drawer_action = widgets::DetailDrawer::new(
                    "report_detail",
                    &report.title,
                    icons::FILE_EXPORT,
                )
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
                            &report.generated_at.format("%d/%m/%Y %H:%M").to_string(),
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
                                &format!("{:.0}%", score),
                                theme::score_color(score),
                            );
                        }

                        widgets::detail_section(ui, "R\u{00c9}SUM\u{00c9}");
                        widgets::detail_text(ui, "", &report.summary);
                    },
                    &actions,
                );

                if let Some(0) = drawer_action {
                    Self::export_html(state, &report);
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
        let is_generating = state.reports.generating;

        // Generate button
        ui.horizontal(|ui: &mut egui::Ui| {
            let btn_label = if is_generating {
                format!("{}  G\u{00c9}N\u{00c9}RATION EN COURS...", icons::CIRCLE_NOTCH)
            } else {
                format!("{}  G\u{00c9}N\u{00c9}RER LE RAPPORT", icons::PLAY)
            };

            if widgets::button::primary_button_loading(ui, btn_label, !is_generating, is_generating)
                .clicked()
            {
                let framework = state
                    .summary
                    .active_frameworks
                    .as_ref()
                    .and_then(|fws| fws.first().cloned());

                // Generate locally and store
                let report = Self::generate_report(state, report_type, framework.as_deref());
                state.reports.reports.push_front(report);
                if state.reports.reports.len() > 50 {
                    state.reports.reports.pop_back();
                }
                state.push_toast(
                    crate::widgets::toast::Toast::success("Rapport g\u{00e9}n\u{00e9}r\u{00e9} avec succ\u{00e8}s"),
                    ui.ctx(),
                );
                // Also emit command for runtime awareness
                *command = Some(GuiCommand::GenerateReport {
                    report_type,
                    framework,
                });
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Show latest report of this type if one exists
        let latest = state
            .reports
            .reports
            .iter()
            .find(|r| r.report_type == report_type);

        if let Some(report) = latest {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!("{}  {}", icons::FILE_EXPORT, report.title))
                            .font(theme::font_body())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(
                                    report.generated_at.format("%d/%m/%Y %H:%M").to_string(),
                                )
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                            );
                        },
                    );
                });
                ui.add_space(theme::SPACE_SM);

                if let Some(score) = report.compliance_score {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("SCORE :")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(format!("{:.0}%", score))
                                .font(theme::font_stat())
                                .color(theme::score_color(score))
                                .strong(),
                        );
                    });
                    ui.add_space(theme::SPACE_SM);
                }

                if let Some(ref fw) = report.framework {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("R\u{00c9}F\u{00c9}RENTIEL :")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                        widgets::status_badge(ui, &fw.to_uppercase(), theme::INFO);
                    });
                    ui.add_space(theme::SPACE_SM);
                }

                ui.label(
                    egui::RichText::new(&report.summary)
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);

                ui.horizontal(|ui: &mut egui::Ui| {
                    if widgets::ghost_button(
                        ui,
                        format!("{}  EXPORTER HTML", icons::DOWNLOAD),
                    )
                    .clicked()
                    {
                        Self::export_html(state, report);
                    }
                });
            });
        } else {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::FILE_EXPORT,
                    "AUCUN RAPPORT DE CE TYPE",
                    Some("Cliquez sur \u{00ab} G\u{00e9}n\u{00e9}rer le rapport \u{00bb} pour cr\u{00e9}er une nouvelle synth\u{00e8}se."),
                );
            });
        }
    }

    fn show_history_tab(
        ui: &mut Ui,
        state: &mut AppState,
        _command: &mut Option<GuiCommand>,
    ) {
        if state.reports.reports.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::FILE_EXPORT,
                    "AUCUN RAPPORT G\u{00c9}N\u{00c9}R\u{00c9}",
                    Some("G\u{00e9}n\u{00e9}rez un rapport depuis l\u{2019}un des onglets pour le retrouver ici."),
                );
            });
            return;
        }

        widgets::card(ui, |ui: &mut egui::Ui| {
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
                let ctx = ui.ctx().clone();
                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(140.0).at_least(100.0))
                    .column(Column::initial(250.0).range(150.0..=500.0))
                    .column(Column::initial(130.0).at_least(100.0))
                    .column(Column::initial(80.0).at_least(60.0))
                    .column(Column::remainder());

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TITRE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DATE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("SCORE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ACTIONS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(
                            theme::TABLE_ROW_HEIGHT,
                            reports_vec.len(),
                            |mut row| {
                                let row_idx = row.index();
                                let (real_idx, report) = &reports_vec[row_idx];
                                let is_selected =
                                    state.reports.selected_report == Some(*real_idx);
                                row.set_selected(is_selected);

                                row.col(|ui: &mut egui::Ui| {
                                    let (label, color) =
                                        Self::report_type_display(&report.report_type);
                                    widgets::status_badge(ui, label, color);
                                });

                                row.col(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&report.title)
                                            .font(theme::font_body())
                                            .color(theme::accent_text())
                                            .strong(),
                                    );
                                });

                                row.col(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(
                                            report
                                                .generated_at
                                                .format("%d/%m/%Y %H:%M")
                                                .to_string(),
                                        )
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                    );
                                });

                                row.col(|ui: &mut egui::Ui| {
                                    if let Some(score) = report.compliance_score {
                                        ui.label(
                                            egui::RichText::new(format!("{:.0}%", score))
                                                .font(theme::font_body())
                                                .color(theme::score_color(score))
                                                .strong(),
                                        );
                                    } else {
                                        ui.label(
                                            egui::RichText::new("--")
                                                .color(theme::text_tertiary()),
                                        );
                                    }
                                });

                                row.col(|ui: &mut egui::Ui| {
                                    if widgets::ghost_button(
                                        ui,
                                        format!("{}  HTML", icons::DOWNLOAD),
                                    )
                                    .clicked()
                                    {
                                        Self::export_html(state, report);
                                    }
                                });

                                if row.response().clicked() {
                                    clicked_idx = Some(*real_idx);
                                }
                                if row.response().hovered() {
                                    ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
                                }
                            },
                        );
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
        let date_str = now.format("%d/%m/%Y %H:%M").to_string();

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

        let score_display = score.map_or("N/A".to_string(), |s| format!("{:.0}%", s));

        let summary_text = format!(
            "Score de conformit\u{00e9} : {}. {} contr\u{00f4}les audit\u{00e9}s, {} d\u{00e9}faillants. {} vuln\u{00e9}rabilit\u{00e9}s d\u{00e9}tect\u{00e9}es. {} menaces actives.",
            score_display, check_count, fail_count, vuln_count, threat_count
        );

        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Synth&egrave;se Ex&eacute;cutive</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1d1d1f; }}
h1 {{ color: #0071e3; border-bottom: 2px solid #0071e3; padding-bottom: 12px; }}
h2 {{ color: #333; margin-top: 24px; }}
.score {{ font-size: 48px; font-weight: bold; color: #0071e3; }}
.stat {{ display: inline-block; margin-right: 32px; text-align: center; }}
.stat-value {{ font-size: 28px; font-weight: bold; }}
.stat-label {{ font-size: 12px; color: #86868b; text-transform: uppercase; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }}
th {{ color: #86868b; font-size: 11px; text-transform: uppercase; }}
.footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #86868b; }}
</style></head>
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
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel Agent &mdash; {date_str}</div>
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
            state
                .summary
                .active_frameworks
                .clone()
                .unwrap_or_default()
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
                "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{:.0}%</td></tr>",
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

        let score_display = overall_pct.map_or("N/A".to_string(), |s| format!("{:.0}%", s));

        let summary_text = format!(
            "Audit de conformit\u{00e9} : {} contr\u{00f4}les analys\u{00e9}s sur {} r\u{00e9}f\u{00e9}rentiels. Taux de conformit\u{00e9} global : {}.",
            total_checks,
            frameworks.len(),
            score_display
        );

        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Audit de Conformit&eacute;</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1d1d1f; }}
h1 {{ color: #0071e3; border-bottom: 2px solid #0071e3; padding-bottom: 12px; }}
h2 {{ color: #333; margin-top: 24px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }}
th {{ color: #86868b; font-size: 11px; text-transform: uppercase; }}
.footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #86868b; }}
</style></head>
<body>
<h1>Audit de Conformit&eacute;</h1>
<p>G&eacute;n&eacute;r&eacute; le {date_str}</p>
<h2>R&eacute;sultat par R&eacute;f&eacute;rentiel</h2>
<table>
<tr><th>R&eacute;f&eacute;rentiel</th><th>Total</th><th>Conforme</th><th>D&eacute;faillant</th><th>Taux</th></tr>
{fw_rows}
</table>
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel Agent &mdash; {date_str}</div>
</body></html>"#
        );

        let title = if let Some(fw) = framework {
            format!("Audit conformit\u{00e9} {} \u{2014} {}", fw.to_uppercase(), date_str)
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
                "<tr><td>{}</td><td>{}</td><td>{}%</td><td>{}</td></tr>",
                html_escape(&proc.process_name),
                html_escape(&proc.reason),
                proc.confidence,
                proc.detected_at.format("%d/%m/%Y %H:%M"),
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
                inc.detected_at.format("%d/%m/%Y %H:%M"),
            ));
        }

        let summary_text = format!(
            "{} processus suspects d\u{00e9}tect\u{00e9}s. {} incidents syst\u{00e8}me enregistr\u{00e9}s.",
            threat_count, incident_count
        );

        let html = format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Rapport d'Incidents</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1d1d1f; }}
h1 {{ color: #e30000; border-bottom: 2px solid #e30000; padding-bottom: 12px; }}
h2 {{ color: #333; margin-top: 24px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }}
th {{ color: #86868b; font-size: 11px; text-transform: uppercase; }}
.footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #86868b; }}
</style></head>
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
<div class="footer">Rapport g&eacute;n&eacute;r&eacute; par Sentinel Agent &mdash; {date_str}</div>
</body></html>"#
        );

        (
            format!("Rapport d\u{2019}incidents \u{2014} {}", date_str),
            summary_text,
            html,
            None,
        )
    }

    fn export_html(state: &AppState, report: &GeneratedReport) {
        let html = report.html_content.clone();
        let filename = format!(
            "rapport_{}_{}.html",
            match report.report_type {
                ReportType::Executive => "executif",
                ReportType::ComplianceAudit => "conformite",
                ReportType::Incident => "incidents",
            },
            report.generated_at.format("%Y%m%d_%H%M%S"),
        );
        let path = crate::export::default_export_path(&filename);

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                match std::fs::write(&path, html.as_bytes()) {
                    Ok(()) => {
                        let msg = format!(
                            "Rapport HTML export\u{00e9} : {}",
                            path.display()
                        );
                        if let Err(e) =
                            tx.send(crate::app::AsyncTaskResult::HtmlExport(true, msg))
                        {
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

/// Minimal HTML entity escaping for user data injected into report HTML.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
