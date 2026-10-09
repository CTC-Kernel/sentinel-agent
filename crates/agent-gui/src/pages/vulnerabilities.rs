// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiExploitIntelStatus, GuiVulnerabilityFinding, PatchPriority, Severity};

use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// What a button of the vulnerability detail does.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VulnAction {
    CopyUpgrade,
    AiFix,
    AiAnalyze,
    Export,
}

/// Confirmation dialog shown before running an AI-generated script.
const AI_FIX_CONFIRM: &str = "vulnerability_ai_fix_confirm";

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Détection & réponse", "Vulnérabilités"],
            "Vulnérabilités",
            Some("Failles détectées et exposition aux CVE connues."),
            Some(
                "Identifiez les failles de sécurité connues (CVE) affectant vos logiciels. La priorité de correction place d'abord les failles déjà exploitées (catalogue CISA KEV), puis celles dont l'exploitation est probable (score EPSS), puis la gravité (CVSS).",
            ),
        );
        ui.add_space(theme::SPACE_LG);

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
            if Self::summary_card(ui, width, label, value, *color, icon) {
                widgets::open_data_panel(ui.ctx(), "Failles de sécurité");
                state.vulnerability.search.clear();
                state.vulnerability.page = 0;
                state.vulnerability.pressing_only = false;
                state.vulnerability.severity_filter = Some(match *label {
                    "CRITIQUES" => Severity::Critical,
                    "ÉLEVÉES" => Severity::High,
                    "MOYENNES" => Severity::Medium,
                    _ => Severity::Low,
                });
            }
        });

        ui.add_space(theme::SPACE_MD);

        if let Some(message) = pressing_summary(&state.vulnerability_findings) {
            widgets::banner(ui, widgets::AlertLevel::Error, &message, false);
            ui.add_space(theme::SPACE_MD);
        }

        Self::remediation_card(ui, state);

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let crit_active = state.vulnerability.severity_filter == Some(Severity::Critical);
        let high_active = state.vulnerability.severity_filter == Some(Severity::High);
        let med_active = state.vulnerability.severity_filter == Some(Severity::Medium);
        let low_active = state.vulnerability.severity_filter == Some(Severity::Low);
        let pressing_active = state.vulnerability.pressing_only;

        let search_id = ui.id().with("vuln_search_cache");
        let search_lower: String = ui
            .memory(|mem| {
                mem.data
                    .get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.vulnerability.search)
                    .map(|(_, lower)| lower)
            })
            .unwrap_or_else(|| {
                let lower = state.vulnerability.search.to_lowercase();
                ui.memory_mut(|mem| {
                    mem.data.insert_temp(
                        search_id,
                        (state.vulnerability.search.clone(), lower.clone()),
                    )
                });
                lower
            });

        let (toggled, export_clicked) = widgets::SearchFilterBar::new(
            &mut state.vulnerability.search,
            "Rechercher une CVE, un logiciel ou une description…",
        )
        .chip("Critique", crit_active, theme::ERROR)
        .chip("Élevée", high_active, theme::SEVERITY_HIGH)
        .chip("Moyenne", med_active, theme::SEVERITY_MEDIUM)
        .chip("Faible", low_active, theme::INFO)
        .chip("À corriger d'abord", pressing_active, theme::ERROR)
        .action(format!("{}  CSV", icons::DOWNLOAD))
        .show_with_action(ui);
        if export_clicked {
            Self::export_filtered(ui, state);
        }

        if toggled == Some(4) {
            state.vulnerability.pressing_only = !state.vulnerability.pressing_only;
        } else if let Some(idx) = toggled {
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
        widgets::data_card(ui, "Failles de sécurité", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("FAILLES DE SÉCURITÉ IDENTIFIÉES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            if !state.vulnerability_findings.is_empty() {
                let (note, degraded) = intel_note(state.vulnerability_intel.as_ref());
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(note)
                        .font(theme::font_small())
                        .color(if degraded {
                            theme::readable_color(theme::WARNING)
                        } else {
                            theme::text_tertiary()
                        }),
                );
            }
            ui.add_space(theme::SPACE_MD);

            Self::show_findings(ui, state, &search_lower, &mut command);
        });

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.vulnerability.selected_vuln
            && sel_idx < state.vulnerability_findings.len()
        {
            let finding = state.vulnerability_findings[sel_idx].clone();
            let intel = state.vulnerability_intel.clone();
            let (sev_label, sev_color) = Self::severity_display(&finding.severity);
            let cvss_color = if let Some(s) = finding.cvss_score {
                if s > 7.0 {
                    theme::ERROR
                } else if s > 4.0 {
                    theme::WARNING
                } else {
                    theme::SUCCESS
                }
            } else {
                theme::text_tertiary()
            };

            // The footer is built from a typed list, so a button and its
            // handler cannot drift apart when one of them is absent.
            let has_ai_analysis = finding.ai_analysis.is_some();
            let has_ai_fix = finding.ai_remediation_script.is_some();
            let mut kinds = Vec::new();
            let mut actions = Vec::new();
            if finding.fix_available {
                kinds.push(VulnAction::CopyUpgrade);
                actions.push(widgets::DetailAction::primary(
                    "Copier la commande de mise à jour",
                    icons::WRENCH,
                ));
            }
            if has_ai_fix {
                kinds.push(VulnAction::AiFix);
                // One primary per footer: the known fix when there is one,
                // the AI-proposed script only when it is the sole remedy.
                actions.push(if finding.fix_available {
                    widgets::DetailAction::secondary(
                        "Exécuter le script proposé par l'IA",
                        icons::WAND_SPARKLES,
                    )
                } else {
                    widgets::DetailAction::primary(
                        "Exécuter le script proposé par l'IA",
                        icons::WAND_SPARKLES,
                    )
                });
            }
            if !has_ai_analysis {
                kinds.push(VulnAction::AiAnalyze);
                actions.push(if actions.is_empty() {
                    widgets::DetailAction::primary("Analyser avec l'IA", icons::BRAIN)
                } else {
                    widgets::DetailAction::secondary("Analyser avec l'IA", icons::BRAIN)
                });
            }
            kinds.push(VulnAction::Export);
            actions.push(widgets::DetailAction::secondary(
                "Exporter",
                icons::DOWNLOAD,
            ));

            let cve_display = &finding.cve_id;
            let source_display = if !finding.source.is_empty() {
                finding.source.replace('/', " / ").to_uppercase()
            } else {
                String::new()
            };
            let drawer_action =
                widgets::DetailDrawer::new("vuln_detail", cve_display, icons::VULNERABILITIES)
                    .accent(sev_color)
                    .subtitle(&finding.affected_software)
                    .show(
                        ui.ctx(),
                        &mut state.vulnerability.detail_open,
                        |ui| {
                            widgets::detail_section(ui, "VULN\u{00c9}RABILIT\u{00c9}");
                            widgets::detail_mono(ui, "Identifiant CVE", cve_display);
                            widgets::detail_field(
                                ui,
                                "Logiciel affect\u{00e9}",
                                &finding.affected_software,
                            );
                            widgets::detail_field(
                                ui,
                                "Version affect\u{00e9}e",
                                &finding.affected_version,
                            );
                            widgets::detail_field_badge(
                                ui,
                                "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                sev_label,
                                sev_color,
                            );
                            if let Some(s) = finding.cvss_score {
                                widgets::detail_field_colored(
                                    ui,
                                    "Score CVSS",
                                    &crate::format::decimal(s, 1),
                                    theme::readable_color(cvss_color),
                                );
                            }
                            if !source_display.is_empty() {
                                widgets::detail_field(ui, "Source", &source_display);
                            }
                            widgets::detail_text(ui, "Description", &finding.description);

                            exploitation_section(ui, &finding, intel.as_ref());

                            // False positive indicator
                            if finding.is_false_positive == Some(true) {
                                ui.add_space(theme::SPACE_XS);
                                widgets::status_badge(ui, "FAUX POSITIF", theme::WARNING);
                                ui.add_space(theme::SPACE_XS);
                            }

                            widgets::detail_section(ui, "REM\u{00c9}DIATION");
                            if finding.fix_available {
                                widgets::detail_field_badge(
                                    ui,
                                    "Correctif disponible",
                                    "OUI",
                                    theme::SUCCESS,
                                );
                            } else {
                                widgets::detail_field_badge(
                                    ui,
                                    "Correctif disponible",
                                    "NON",
                                    theme::ERROR,
                                );
                            }
                            if let Some(ref fv) = finding.fixed_version {
                                widgets::detail_field(ui, "Version corrig\u{00e9}e", fv);
                            }
                            if let Some(ref remediation) = finding.remediation {
                                widgets::detail_text(
                                    ui,
                                    "Instructions de rem\u{00e9}diation",
                                    remediation,
                                );
                            }
                            if let Some(dt) = finding.discovered_at {
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}couverte",
                                    &crate::format::local_datetime(dt),
                                );
                            }

                            // AI Remediation Proposal section
                            if let (Some(explanation), Some(script)) = (
                                &finding.ai_remediation_explanation,
                                &finding.ai_remediation_script,
                            ) {
                                widgets::detail_ai_proposal(ui, explanation, script);
                            }

                            // AI Analysis section
                            if let Some(ref analysis) = finding.ai_analysis {
                                widgets::detail_section(ui, "ANALYSE IA");

                                // Confidence badge
                                if let Some(confidence) = finding.ai_confidence {
                                    let conf_color = if confidence >= 80 {
                                        theme::SUCCESS
                                    } else if confidence >= 50 {
                                        theme::WARNING
                                    } else {
                                        theme::ERROR
                                    };
                                    widgets::detail_field_badge(
                                        ui,
                                        "Confiance",
                                        &format!("{}\u{202f}%", confidence),
                                        conf_color,
                                    );
                                }

                                // False positive indicator in AI section
                                if let Some(fp) = finding.is_false_positive {
                                    if fp {
                                        widgets::detail_field_badge(
                                            ui,
                                            "Faux positif",
                                            "OUI",
                                            theme::WARNING,
                                        );
                                    } else {
                                        widgets::detail_field_badge(
                                            ui,
                                            "Faux positif",
                                            "NON",
                                            theme::SUCCESS,
                                        );
                                    }
                                }

                                widgets::detail_text(ui, "Analyse", analysis);
                            }
                        },
                        &actions,
                    );

            match drawer_action.and_then(|index| kinds.get(index).copied()) {
                Some(VulnAction::CopyUpgrade) => {
                    let safe_name = finding.affected_software.replace('\'', "'\\''");
                    let cmd = platform_upgrade_command(&safe_name);
                    ui.ctx().copy_text(cmd);
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::success(
                            "Commande de mise \u{00e0} jour copi\u{00e9}e : ex\u{00e9}cutez-la \
                             dans un terminal administrateur",
                        )
                        .with_time(time),
                    );
                }
                Some(VulnAction::AiFix) => {
                    // A generated script runs with administrator rights:
                    // administrator mode, then show the script and confirm.
                    if state.require_admin("Exécuter un script de correction proposé par l'IA") {
                        widgets::modal::ask_confirmation(ui.ctx(), AI_FIX_CONFIRM, sel_idx);
                    }
                }
                Some(VulnAction::AiAnalyze) => {
                    command = Some(GuiCommand::LlmAnalyzeVulnerability {
                        finding_index: sel_idx,
                        target_id: crate::state::vulnerability_identity(
                            &state.vulnerability_findings[sel_idx],
                        ),
                    });
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::info("Analyse IA en cours\u{2026}")
                            .with_time(time),
                    );
                }
                Some(VulnAction::Export) => {
                    let success = Self::export_csv(state, &[sel_idx]);
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        if success {
                            crate::widgets::toast::Toast::success("Export CSV r\u{00e9}ussi")
                        } else {
                            crate::widgets::toast::Toast::error(
                                "Export CSV impossible : v\u{00e9}rifiez les droits d'\u{00e9}criture",
                            )
                        }
                        .with_time(time),
                    );
                }
                None => {}
            }
        }

        if let Some(index) = widgets::modal::pending_confirmation::<usize>(ui.ctx(), AI_FIX_CONFIRM)
            && let Some(finding) = state.vulnerability_findings.get(index).cloned()
            && let Some(script) = finding.ai_remediation_script.clone()
        {
            const SHOWN_LINES: usize = 20;
            let mut preview = script
                .iter()
                .take(SHOWN_LINES)
                .cloned()
                .collect::<Vec<_>>()
                .join("\n");
            if script.len() > SHOWN_LINES {
                preview.push_str(&format!(
                    "\n… {} lignes de plus",
                    script.len() - SHOWN_LINES
                ));
            }
            if widgets::modal::resolve_confirmation::<usize>(
                ui.ctx(),
                AI_FIX_CONFIRM,
                "Exécuter le script proposé par l'IA ?",
                &format!(
                    "{} — {}\n\nLe script s'exécute avec les droits administrateur et \
                     n'a pas de retour arrière automatique. Relisez-le :\n\n{preview}",
                    finding.cve_id, finding.affected_software
                ),
                "Exécuter",
            ) {
                let action = agent_common::types::RemediationAction {
                    id: uuid::Uuid::new_v4(),
                    check_id: finding.cve_id.clone(),
                    description: finding.description.clone(),
                    platform: if cfg!(target_os = "macos") {
                        "macos"
                    } else if cfg!(target_os = "windows") {
                        "windows"
                    } else {
                        "linux"
                    }
                    .to_string(),
                    script: script.join("\n"),
                    requires_reboot: false,
                    requires_admin: true,
                    risk_level: agent_common::types::RemediationRisk::Moderate,
                    rollback_script: None,
                    status: agent_common::types::RemediationStatus::Pending,
                    is_ai_generated: true,
                };
                command = Some(GuiCommand::ApplyAiRemediation { action });
                state.push_toast(
                    crate::widgets::toast::Toast::info("Ex\u{00e9}cution du script IA\u{2026}"),
                    ui.ctx(),
                );
            }
        }

        command
    }

    /// Export what the search and severity chip currently show.
    fn export_filtered(ui: &Ui, state: &mut AppState) {
        let search_lower = state.vulnerability.search.to_lowercase();
        let filtered_indices = displayed_indices(
            &state.vulnerability_findings,
            &search_lower,
            state.vulnerability.severity_filter,
            state.vulnerability.pressing_only,
        );
        let success = Self::export_csv(state, &filtered_indices);
        let time = ui.input(|i| i.time);
        state.toasts.push(
            if success {
                crate::widgets::toast::Toast::success("Export CSV réussi")
            } else {
                crate::widgets::toast::Toast::error("Échec de l'export CSV")
            }
            .with_time(time),
        );
    }

    /// Remediation progress beside the CVSS distribution.
    ///
    /// Replaces a lone progress bar and an average: the operator sees how
    /// much can be fixed now, where the scores sit, and why a finding's
    /// severity can sit below its CVSS band.
    fn remediation_card(ui: &mut Ui, state: &AppState) {
        let findings = &state.vulnerability_findings;
        widgets::data_card(ui, "Remédiation et gravité", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REMÉDIATION ET GRAVITÉ")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);
            if findings.is_empty() {
                ui.label(
                    egui::RichText::new("Aucune vulnérabilité détaillée pour l'instant.")
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
                return;
            }
            let columns = ui.available_width() >= 720.0;
            let gap = theme::SPACE_XL;
            let column_w = if columns {
                (ui.available_width() - gap) / 2.0
            } else {
                ui.available_width()
            };
            let layout = if columns {
                egui::Layout::left_to_right(egui::Align::Min)
            } else {
                egui::Layout::top_down(egui::Align::Min)
            };
            ui.with_layout(layout, |ui| {
                // Only the gap between the two columns; each column keeps
                // the default spacing for its own rows.
                let inner = ui.spacing().item_spacing;
                ui.spacing_mut().item_spacing = egui::vec2(gap, theme::SPACE_LG);
                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing = inner;
                    ui.set_width(column_w);
                    remediation_column(ui, findings);
                });
                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing = inner;
                    ui.set_width(column_w);
                    cvss_column(ui, findings);
                });
            });
        });
    }

    fn show_findings(
        ui: &mut Ui,
        state: &mut AppState,
        search_lower: &str,
        _command: &mut Option<GuiCommand>,
    ) {
        let filtered = displayed_indices(
            &state.vulnerability_findings,
            search_lower,
            state.vulnerability.severity_filter,
            state.vulnerability.pressing_only,
        );

        // Pagination window over the filtered results.
        const VULNS_PER_PAGE: usize = 25;
        let (page_start, page_len, _) = widgets::page_window(
            filtered.len(),
            VULNS_PER_PAGE,
            &mut state.vulnerability.page,
        );

        if state.vulnerability_findings.is_empty() {
            let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                || state.sync.in_progress;

            if is_loading {
                ui.push_id("vulns_skeletons", |ui: &mut egui::Ui| {
                    let cols = 8;
                    let column_widths = [
                        100.0,
                        120.0,
                        90.0,
                        80.0,
                        60.0,
                        90.0,
                        ui.available_width() - 640.0,
                        100.0,
                    ];
                    for _ in 0..5 {
                        crate::widgets::skeleton::skeleton_table_row(ui, cols, &column_widths);
                        ui.add_space(theme::SPACE_MD);
                    }
                });
            } else {
                widgets::protected_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "Aucune vuln\u{00e9}rabilit\u{00e9} d\u{00e9}tect\u{00e9}e",
                    "Le syst\u{00e8}me est \u{00e0} jour et ne pr\u{00e9}sente aucune faille connue \u{00e0} ce jour.",
                );
            }
        } else if filtered.is_empty() {
            widgets::empty_state(
                ui,
                icons::VULNERABILITIES,
                "Aucun r\u{00e9}sultat",
                Some(
                    "Ajustez vos filtres de recherche pour voir les vuln\u{00e9}rabilit\u{00e9}s.",
                ),
            );
        } else {
            use widgets::table;

            let mut clicked_idx: Option<usize> = None;
            let selected = state.vulnerability.selected_vuln;

            table::fluid_clickable(
                ui,
                &[
                    table::Col::fluid(124.0, 1.0), // Identifiant
                    table::Col::fluid(120.0, 1.5), // Logiciel
                    table::Col::fluid(100.0, 0.0), // Priorité
                    table::Col::fluid(96.0, 0.0),  // Sévérité
                    table::Col::fixed(56.0),       // CVSS
                    table::Col::fluid(64.0, 0.5),  // Source
                    table::Col::fluid(104.0, 0.5), // Correctif
                    table::Col::fluid(140.0, 4.0), // Description
                    table::Col::fixed(88.0),       // Actions
                ],
            )
            .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                header.col(|ui| {
                    table::header_cell(ui, "IDENTIFIANT");
                });
                header.col(|ui| {
                    table::header_cell(ui, "LOGICIEL");
                });
                header.col(|ui| {
                    table::header_cell(ui, "PRIORIT\u{00c9}");
                });
                header.col(|ui| {
                    table::header_cell(ui, "S\u{00c9}V\u{00c9}RIT\u{00c9}");
                });
                header.col(|ui| {
                    table::header_cell_right(ui, "CVSS");
                });
                header.col(|ui| {
                    table::header_cell(ui, "SOURCE");
                });
                header.col(|ui| {
                    table::header_cell(ui, "CORRECTIF");
                });
                header.col(|ui| {
                    table::header_cell(ui, "DESCRIPTION");
                });
                header.col(|_| {});
            })
            .body(|body| {
                body.rows(theme::TABLE_DATA_ROW_HEIGHT, page_len, |mut row| {
                    let Some(&real_idx) = filtered.get(page_start + row.index()) else {
                        return;
                    };
                    let Some(finding) = state.vulnerability_findings.get(real_idx) else {
                        return;
                    };
                    let is_selected = selected == Some(real_idx);
                    row.set_selected(is_selected);

                    row.col(|ui| {
                        let discovered = finding
                            .discovered_at
                            .map(crate::format::local_datetime)
                            .unwrap_or_default();
                        if table::cell_link_stack(ui, &finding.cve_id, &discovered).clicked() {
                            clicked_idx = Some(real_idx);
                        }
                    });

                    row.col(|ui| {
                        table::cell_stack(
                            ui,
                            &finding.affected_software,
                            &finding.affected_version,
                        );
                    });

                    row.col(|ui| {
                        let (label, color) = priority_display(finding.priority);
                        widgets::status_badge(ui, label, color);
                    });

                    row.col(|ui| {
                        let (label, color) = Self::severity_display(&finding.severity);
                        widgets::status_badge(ui, label, color);
                        if finding.is_false_positive == Some(true) {
                            ui.add_space(theme::SPACE_XS);
                            widgets::status_badge(ui, "FP", theme::WARNING);
                        }
                    });

                    row.col(|ui| {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if let Some(s) = finding.cvss_score {
                                table::cell_colored(
                                    ui,
                                    &crate::format::decimal(s, 1),
                                    theme::readable_color(theme::score_color(100.0 - s * 10.0)),
                                );
                            } else {
                                table::cell_empty(ui);
                            }
                        });
                    });

                    row.col(|ui| {
                        if finding.source.is_empty() {
                            table::cell_empty(ui);
                        } else {
                            table::cell_muted(
                                ui,
                                &finding.source.replace('/', " / ").to_uppercase(),
                            );
                        }
                    });

                    row.col(|ui| {
                        if finding.fix_available {
                            match finding.fixed_version.as_deref() {
                                Some(fv) => widgets::status_badge(
                                    ui,
                                    &format!("{} {}", icons::ARROW_UP, fv),
                                    theme::SUCCESS,
                                ),
                                None => widgets::status_badge(ui, "DISPONIBLE", theme::SUCCESS),
                            }
                        } else {
                            table::cell_empty(ui);
                        }
                    });

                    row.col(|ui| {
                        table::cell_small(ui, &finding.description);
                    });

                    row.col(|ui| {
                        if widgets::ghost_button(ui, format!("{}  D\u{00e9}tails", icons::EYE))
                            .clicked()
                        {
                            clicked_idx = Some(real_idx);
                        }
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(real_idx);
                    }
                });
            });

            if let Some(idx) = clicked_idx {
                state.vulnerability.selected_vuln = Some(idx);
                state.vulnerability.detail_open = true;
            }

            // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
            // and the page follows the selection.
            let mut position = state
                .vulnerability
                .selected_vuln
                .and_then(|real| filtered.iter().position(|&r| r == real));
            if widgets::navigate_list(
                ui.ctx(),
                &mut position,
                filtered.len(),
                &mut state.vulnerability.detail_open,
            ) && let Some(pos) = position
            {
                state.vulnerability.selected_vuln = Some(filtered[pos]);
                state.vulnerability.page = pos / VULNS_PER_PAGE;
            }

            widgets::paginate_controls(
                ui,
                filtered.len(),
                VULNS_PER_PAGE,
                &mut state.vulnerability.page,
            );
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
    ) -> bool {
        widgets::metric_card(ui, width, label, value, color, icon)
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
            "priorite",
            "exploitee_kev",
            "rancongiciel",
            "epss",
            "severite",
            "cvss",
            "source",
            "description",
            "fix_disponible",
            "version_corrigee",
            "faux_positif",
            "confiance_ia",
        ];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let f = state.vulnerability_findings.get(i)?;
                Some(vec![
                    f.cve_id.clone(),
                    f.affected_software.clone(),
                    f.affected_version.clone(),
                    priority_display(f.priority).0.to_lowercase(),
                    if f.known_exploited { "Oui" } else { "Non" }.to_string(),
                    if f.ransomware_use { "Oui" } else { "Non" }.to_string(),
                    f.epss_probability
                        .map_or("--".into(), |p| format!("{:.4}", p)),
                    f.severity.to_string(),
                    f.cvss_score.map_or("--".into(), |s| format!("{:.1}", s)),
                    f.source.clone(),
                    f.description.clone(),
                    if f.fix_available { "Oui" } else { "Non" }.to_string(),
                    f.fixed_version.clone().unwrap_or_default(),
                    f.is_false_positive
                        .map_or("--".into(), |fp| if fp { "Oui" } else { "Non" }.to_string()),
                    f.ai_confidence.map_or("--".into(), |c| format!("{}", c)),
                ])
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

/// Findings shown by the table and the export: those matching the search,
/// the severity chip and the "fix first" chip, most pressing first. Findings
/// of equal priority keep the scan order.
fn displayed_indices(
    findings: &[GuiVulnerabilityFinding],
    search_lower: &str,
    severity: Option<Severity>,
    pressing_only: bool,
) -> Vec<usize> {
    let mut indices: Vec<usize> = findings
        .iter()
        .enumerate()
        .filter(|(_, f)| {
            if !search_lower.is_empty()
                && !f.cve_id.to_lowercase().contains(search_lower)
                && !f.affected_software.to_lowercase().contains(search_lower)
                && !f.description.to_lowercase().contains(search_lower)
            {
                return false;
            }
            if pressing_only && !f.priority.is_pressing() {
                return false;
            }
            severity.is_none_or(|sev| f.severity == sev)
        })
        .map(|(i, _)| i)
        .collect();
    indices.sort_by_key(|&i| findings[i].priority);
    indices
}

/// One sentence naming what to fix before anything else, or `None` when no
/// finding is known or likely to be exploited.
fn pressing_summary(findings: &[GuiVulnerabilityFinding]) -> Option<String> {
    let count =
        |priority: PatchPriority| findings.iter().filter(|f| f.priority == priority).count();
    let exploited = count(PatchPriority::Immediate);
    let likely = count(PatchPriority::Urgent);

    let exploited_part = match exploited {
        0 => None,
        1 => Some("1 faille d\u{00e9}j\u{00e0} exploit\u{00e9}e (CISA KEV)".to_string()),
        n => Some(format!(
            "{n} failles d\u{00e9}j\u{00e0} exploit\u{00e9}es (CISA KEV)"
        )),
    };
    let likely_part = match likely {
        0 => None,
        1 => Some("1 faille dont l'exploitation est probable (EPSS)".to_string()),
        n => Some(format!(
            "{n} failles dont l'exploitation est probable (EPSS)"
        )),
    };
    let parts: Vec<String> = [exploited_part, likely_part]
        .into_iter()
        .flatten()
        .collect();
    if parts.is_empty() {
        return None;
    }
    Some(format!("\u{00c0} corriger d'abord : {}.", parts.join(", ")))
}

fn priority_display(priority: PatchPriority) -> (&'static str, egui::Color32) {
    match priority {
        PatchPriority::Immediate => ("IMM\u{00c9}DIATE", theme::ERROR),
        PatchPriority::Urgent => ("URGENTE", theme::SEVERITY_HIGH),
        PatchPriority::Planned => ("PLANIFI\u{00c9}E", theme::SEVERITY_MEDIUM),
        PatchPriority::Routine => ("COURANTE", theme::text_tertiary()),
    }
}

/// Day of an EPSS score date as published (`2026-10-03T12:00:21Z`), for display.
fn epss_day(score_date: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(score_date)
        .map(|date| date.format("%d/%m/%Y").to_string())
        .unwrap_or_else(|_| score_date.to_string())
}

/// What the priority of the last scan rests on, and whether a source is
/// missing or outdated.
fn intel_note(intel: Option<&GuiExploitIntelStatus>) -> (String, bool) {
    let Some(intel) = intel else {
        return (
            "Priorit\u{00e9} \u{00e9}tablie sur la gravit\u{00e9} seule : les donn\u{00e9}es d'exploitation (CISA KEV, EPSS) n'ont pas \u{00e9}t\u{00e9} consult\u{00e9}es.".to_string(),
            true,
        );
    };
    let kev = intel
        .kev_available
        .then(|| match &intel.kev_catalog_version {
            Some(version) => format!("catalogue CISA KEV {version}"),
            None => "catalogue CISA KEV".to_string(),
        });
    let epss = intel.epss_available.then(|| match &intel.epss_score_date {
        Some(date) => format!("scores EPSS du {}", epss_day(date)),
        None => "scores EPSS".to_string(),
    });
    match (kev, epss) {
        (Some(kev), Some(epss)) if intel.stale => (
            format!(
                "Priorit\u{00e9} \u{00e9}tablie avec le {kev} et les {epss} (derni\u{00e8}re copie locale : l'actualisation a \u{00e9}chou\u{00e9})."
            ),
            true,
        ),
        (Some(kev), Some(epss)) => (
            format!("Priorit\u{00e9} \u{00e9}tablie avec le {kev} et les {epss}."),
            false,
        ),
        (Some(kev), None) => (
            format!(
                "Priorit\u{00e9} \u{00e9}tablie avec le {kev} ; scores EPSS indisponibles."
            ),
            true,
        ),
        (None, Some(epss)) => (
            format!(
                "Priorit\u{00e9} \u{00e9}tablie avec les {epss} ; catalogue CISA KEV indisponible, les failles d\u{00e9}j\u{00e0} exploit\u{00e9}es ne sont pas signal\u{00e9}es."
            ),
            true,
        ),
        (None, None) => (
            "Priorit\u{00e9} \u{00e9}tablie sur la gravit\u{00e9} seule : catalogue CISA KEV et scores EPSS indisponibles.".to_string(),
            true,
        ),
    }
}

/// Drawer section: why the finding has its priority.
fn exploitation_section(
    ui: &mut Ui,
    finding: &GuiVulnerabilityFinding,
    intel: Option<&GuiExploitIntelStatus>,
) {
    let date = |d: chrono::NaiveDate| d.format("%d/%m/%Y").to_string();
    let (priority_label, priority_color) = priority_display(finding.priority);

    widgets::detail_section(ui, "EXPLOITATION");
    widgets::detail_field_badge(
        ui,
        "Priorit\u{00e9} de correction",
        priority_label,
        priority_color,
    );

    if finding.known_exploited {
        widgets::detail_field_badge(
            ui,
            "Exploitation connue",
            "OUI \u{2014} CISA KEV",
            theme::ERROR,
        );
        if let Some(added) = finding.kev_date_added {
            widgets::detail_field(ui, "Ajout\u{00e9}e au catalogue le", &date(added));
        }
        if let Some(due) = finding.kev_due_date {
            widgets::detail_field(
                ui,
                "\u{00c9}ch\u{00e9}ance fix\u{00e9}e par la CISA",
                &date(due),
            );
        }
        if finding.ransomware_use {
            widgets::detail_field_badge(
                ui,
                "Ran\u{00e7}ongiciels",
                "UTILIS\u{00c9}E",
                theme::ERROR,
            );
        }
    } else if intel.is_some_and(|intel| intel.kev_available) {
        widgets::detail_field(
            ui,
            "Exploitation connue",
            "Non r\u{00e9}pertori\u{00e9}e (CISA KEV)",
        );
    } else {
        widgets::detail_field(ui, "Exploitation connue", "Non v\u{00e9}rifi\u{00e9}e");
    }

    match (finding.epss_probability, finding.epss_percentile) {
        (Some(probability), Some(percentile)) => widgets::detail_field(
            ui,
            "Probabilit\u{00e9} d'exploitation (30 j)",
            &format!(
                "{} \u{2014} plus que {} des CVE",
                crate::format::pct(probability * 100.0, 1),
                crate::format::pct(percentile * 100.0, 1)
            ),
        ),
        (Some(probability), None) => widgets::detail_field(
            ui,
            "Probabilit\u{00e9} d'exploitation (30 j)",
            &crate::format::pct(probability * 100.0, 1),
        ),
        _ => widgets::detail_field(
            ui,
            "Probabilit\u{00e9} d'exploitation (30 j)",
            "Non disponible (EPSS)",
        ),
    }
}

/// CVSS band a score falls in, as a severity rank: 3 critical .. 0 low.
fn cvss_rank(score: f32) -> u8 {
    if score >= 9.0 {
        3
    } else if score >= 7.0 {
        2
    } else if score >= 4.0 {
        1
    } else {
        0
    }
}

fn severity_rank(severity: &Severity) -> u8 {
    match severity {
        Severity::Critical => 3,
        Severity::High => 2,
        Severity::Medium => 1,
        Severity::Low | Severity::Info => 0,
    }
}

fn band_color(rank: u8) -> egui::Color32 {
    match rank {
        3 => theme::ERROR,
        2 => theme::SEVERITY_HIGH,
        1 => theme::SEVERITY_MEDIUM,
        _ => theme::INFO,
    }
}

fn column_title(ui: &mut Ui, icon: &str, title: &str) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(icon)
                .size(theme::ICON_XS)
                .color(theme::accent_text()),
        );
        ui.label(
            egui::RichText::new(title)
                .font(theme::font_body_strong())
                .color(theme::text_primary()),
        );
    });
    ui.add_space(theme::SPACE_SM);
}

fn remediation_column(ui: &mut Ui, findings: &[crate::dto::GuiVulnerabilityFinding]) {
    column_title(ui, icons::WRENCH, "Remédiation");
    let total = findings.len();
    let fixable = findings.iter().filter(|f| f.fix_available).count();
    let ratio = fixable as f32 / total.max(1) as f32;
    let color = if ratio >= 0.8 {
        theme::SUCCESS
    } else if ratio >= 0.5 {
        theme::SEVERITY_MEDIUM
    } else {
        theme::ERROR
    };
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(format!("{fixable} / {total}"))
                .font(theme::font_h2())
                .color(theme::readable_color(color)),
        );
        ui.label(
            egui::RichText::new(format!(
                "correctifs disponibles · {}",
                crate::format::pct(ratio * 100.0, 0)
            ))
            .font(theme::font_caption())
            .color(theme::text_secondary()),
        );
    });
    ui.add_space(theme::SPACE_XS);
    split_bar(
        ui,
        &[
            (fixable as f32, theme::readable_color(color)),
            ((total - fixable) as f32, theme::bg_elevated()),
        ],
    );
    ui.add_space(theme::SPACE_XS);
    ui.label(
        egui::RichText::new("Un correctif disponible doit encore être appliqué puis vérifié.")
            .font(theme::font_caption())
            .color(theme::text_tertiary()),
    );

    // Findings whose severity sits below their CVSS band: the scanner
    // weighed exposure (e.g. a service not reachable here) and lowered it.
    let contextual = findings
        .iter()
        .filter(|f| {
            f.cvss_score
                .is_some_and(|score| severity_rank(&f.severity) < cvss_rank(score))
        })
        .count();
    if contextual > 0 {
        ui.add_space(theme::SPACE_SM);
        ui.horizontal_wrapped(|ui| {
            widgets::status_badge(ui, "Contextualisée", theme::INFO);
            ui.label(
                egui::RichText::new(format!(
                    "{} CVE à sévérité abaissée sous leur score CVSS, selon l\'exposition du poste",
                    crate::format::int(contextual)
                ))
                .font(theme::font_caption())
                .color(theme::text_secondary()),
            );
        });
    }
}

fn cvss_column(ui: &mut Ui, findings: &[crate::dto::GuiVulnerabilityFinding]) {
    column_title(ui, icons::GAUGE_HIGH, "Distribution des scores CVSS");
    let scores: Vec<f32> = findings
        .iter()
        .filter_map(|f| f.cvss_score)
        .filter(|s| s.is_finite())
        .collect();
    if scores.is_empty() {
        ui.label(
            egui::RichText::new("Aucun score CVSS fourni par les sources.")
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
        return;
    }
    // Ten one-point buckets, the last one closed at 10.
    let mut buckets = [0_usize; 10];
    for score in &scores {
        buckets[(score.clamp(0.0, 9.99) as usize).min(9)] += 1;
    }
    let tallest = *buckets.iter().max().unwrap_or(&1);
    let height = 64.0;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height + 16.0),
        egui::Sense::hover(),
    );
    if ui.is_rect_visible(rect) {
        let painter = ui.painter();
        let plot = egui::Rect::from_min_size(rect.min, egui::vec2(rect.width(), height));
        let slot = plot.width() / 10.0;
        for (index, count) in buckets.iter().enumerate() {
            let x = plot.left() + slot * index as f32;
            let bar_h = if *count == 0 {
                2.0
            } else {
                (height * *count as f32 / tallest as f32).max(4.0)
            };
            let bar = egui::Rect::from_min_max(
                egui::pos2(x + 2.0, plot.bottom() - bar_h),
                egui::pos2(x + slot - 2.0, plot.bottom()),
            );
            let color = band_color(cvss_rank(index as f32 + 0.5));
            painter.rect_filled(
                bar,
                egui::CornerRadius {
                    nw: 3,
                    ne: 3,
                    sw: 0,
                    se: 0,
                },
                if *count == 0 {
                    theme::bg_tertiary()
                } else {
                    theme::readable_color(color)
                },
            );
            if *count > 0 {
                painter.text(
                    egui::pos2(bar.center().x, bar.top() - 2.0),
                    egui::Align2::CENTER_BOTTOM,
                    count.to_string(),
                    theme::font_micro(),
                    theme::text_secondary(),
                );
            }
        }
        for tick in [0, 4, 7, 9, 10] {
            painter.text(
                egui::pos2(plot.left() + slot * tick as f32, plot.bottom() + 3.0),
                if tick == 10 {
                    egui::Align2::RIGHT_TOP
                } else {
                    egui::Align2::LEFT_TOP
                },
                tick.to_string(),
                theme::font_micro(),
                theme::text_tertiary(),
            );
        }
    }
    let average = scores.iter().sum::<f32>() / scores.len() as f32;
    ui.add_space(theme::SPACE_XS);
    ui.horizontal_wrapped(|ui| {
        ui.label(
            egui::RichText::new(format!("Moyenne {}", crate::format::decimal(average, 1)))
                .font(theme::font_body_strong())
                .color(theme::readable_color(band_color(cvss_rank(average)))),
        );
        ui.label(
            egui::RichText::new(format!("· {} CVE notées", crate::format::int(scores.len())))
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
    });
}

/// A thin bar split in proportion to each value.
fn split_bar(ui: &mut Ui, parts: &[(f32, egui::Color32)]) {
    let height = 6.0;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if !ui.is_rect_visible(rect) {
        return;
    }
    let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
    let total: f32 = parts.iter().map(|(v, _)| *v).sum();
    ui.painter().rect_filled(rect, radius, theme::bg_tertiary());
    if total <= 0.0 {
        return;
    }
    let mut x = rect.left();
    for (value, color) in parts.iter().filter(|(v, _)| *v > 0.0) {
        let w = rect.width() * value / total;
        ui.painter().rect_filled(
            egui::Rect::from_min_size(egui::pos2(x, rect.top()), egui::vec2(w, height)),
            radius,
            *color,
        );
        x += w;
    }
}

fn platform_upgrade_command(safe_name: &str) -> String {
    if cfg!(target_os = "macos") {
        format!(
            "# Vérifier le nom du paquet avant exécution :\nbrew upgrade '{}'",
            safe_name
        )
    } else if cfg!(target_os = "linux") {
        format!(
            "# Vérifier le gestionnaire de paquets :\nsudo apt upgrade '{}' || sudo dnf upgrade '{}'",
            safe_name, safe_name
        )
    } else if cfg!(target_os = "windows") {
        format!("# Vérifier l'ID Winget :\nwinget upgrade '{}'", safe_name)
    } else {
        format!("# Mettez a jour '{}' manuellement", safe_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn finding(cve: &str, severity: &str, priority: PatchPriority) -> GuiVulnerabilityFinding {
        let mut finding: GuiVulnerabilityFinding = serde_json::from_value(serde_json::json!({
            "cve_id": cve, "affected_software": "pkg", "affected_version": "1",
            "severity": severity, "cvss_score": null, "description": "desc",
            "fix_available": false, "discovered_at": null, "source": "test"
        }))
        .unwrap();
        finding.priority = priority;
        finding
    }

    #[test]
    fn findings_are_listed_most_pressing_first_in_scan_order() {
        let findings = vec![
            finding("CVE-1", "critical", PatchPriority::Planned),
            finding("CVE-2", "low", PatchPriority::Routine),
            finding("CVE-3", "medium", PatchPriority::Immediate),
            finding("CVE-4", "high", PatchPriority::Planned),
            finding("CVE-5", "low", PatchPriority::Urgent),
        ];
        assert_eq!(
            displayed_indices(&findings, "", None, false),
            [2, 4, 0, 3, 1]
        );
    }

    #[test]
    fn fix_first_chip_combines_with_search_and_severity() {
        let findings = vec![
            finding("CVE-1", "critical", PatchPriority::Planned),
            finding("CVE-2", "medium", PatchPriority::Immediate),
            finding("CVE-3", "low", PatchPriority::Urgent),
        ];
        assert_eq!(displayed_indices(&findings, "", None, true), [1, 2]);
        assert_eq!(
            displayed_indices(&findings, "", Some(Severity::Low), true),
            [2]
        );
        assert_eq!(displayed_indices(&findings, "cve-2", None, true), [1]);
        assert!(displayed_indices(&findings, "", Some(Severity::Critical), true).is_empty());
    }

    #[test]
    fn pressing_summary_names_exploited_then_likely_findings() {
        assert_eq!(pressing_summary(&[]), None);
        assert_eq!(
            pressing_summary(&[finding("CVE-1", "critical", PatchPriority::Planned)]),
            None
        );
        assert_eq!(
            pressing_summary(&[finding("CVE-1", "low", PatchPriority::Urgent)]).as_deref(),
            Some("À corriger d'abord : 1 faille dont l'exploitation est probable (EPSS).")
        );
        let findings = vec![
            finding("CVE-1", "medium", PatchPriority::Immediate),
            finding("CVE-2", "medium", PatchPriority::Immediate),
            finding("CVE-3", "low", PatchPriority::Urgent),
            finding("CVE-4", "high", PatchPriority::Routine),
        ];
        assert_eq!(
            pressing_summary(&findings).as_deref(),
            Some(
                "À corriger d'abord : 2 failles déjà exploitées (CISA KEV), \
                 1 faille dont l'exploitation est probable (EPSS)."
            )
        );
    }

    #[test]
    fn older_snapshots_without_priority_default_to_routine() {
        let finding = finding("CVE-1", "high", PatchPriority::default());
        assert_eq!(finding.priority, PatchPriority::Routine);
        assert!(!finding.known_exploited && finding.epss_probability.is_none());
    }

    #[test]
    fn intel_note_says_what_the_priority_rests_on() {
        let (note, degraded) = intel_note(None);
        assert!(degraded && note.contains("gravité seule"));

        let full = GuiExploitIntelStatus {
            kev_available: true,
            kev_catalog_version: Some("2026.10.02".into()),
            epss_available: true,
            epss_score_date: Some("2026-10-03T12:00:21Z".into()),
            stale: false,
        };
        let (note, degraded) = intel_note(Some(&full));
        assert!(!degraded);
        assert!(note.contains("CISA KEV 2026.10.02") && note.contains("03/10/2026"));

        let (note, degraded) = intel_note(Some(&GuiExploitIntelStatus {
            stale: true,
            ..full.clone()
        }));
        assert!(degraded && note.contains("copie locale"));

        let (note, degraded) = intel_note(Some(&GuiExploitIntelStatus {
            kev_available: false,
            kev_catalog_version: None,
            ..full.clone()
        }));
        assert!(degraded && note.contains("CISA KEV indisponible"));

        let (note, degraded) = intel_note(Some(&GuiExploitIntelStatus::default()));
        assert!(degraded && note.contains("gravité seule"));
    }
}
