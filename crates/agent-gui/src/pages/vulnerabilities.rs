// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Détection & réponse", "Vulnérabilités"],
            "Vulnérabilités",
            Some("Failles détectées et exposition aux CVE connues."),
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
                    icons::PLAY,
                    if is_scanning {
                        "Analyse en cours"
                    } else {
                        "Lancer l'analyse"
                    }
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
                                if !search_lower.is_empty()
                                    && !f.cve_id.to_lowercase().contains(&search_lower)
                                    && !f.affected_software.to_lowercase().contains(&search_lower)
                                    && !f.description.to_lowercase().contains(&search_lower)
                                {
                                    return false;
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

        ui.add_space(theme::SPACE_MD);

        // Coverage and distribution indicators (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("INDICATEURS DE COUVERTURE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let total_findings = state.vulnerability_findings.len();
            if total_findings == 0 {
                ui.label(
                    egui::RichText::new(
                        "Aucun détail de vulnérabilité disponible pour calculer la couverture.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
                return;
            }
            let fix_available_count = state
                .vulnerability_findings
                .iter()
                .filter(|v| v.fix_available)
                .count();

            // A. Fix availability ratio
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::WRENCH)
                        .color(theme::accent_text().linear_multiply(theme::OPACITY_STRONG))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                let fix_pct = if total_findings > 0 {
                    (fix_available_count as f32 / total_findings as f32) * 100.0
                } else {
                    0.0
                };
                ui.label(
                    egui::RichText::new(format!(
                        "Correctifs disponibles : {}/{} ({:.0}\u{202f}%)",
                        fix_available_count, total_findings, fix_pct
                    ))
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
                );
            });
            ui.add_space(theme::SPACE_XS);
            let fix_ratio = if total_findings > 0 {
                fix_available_count as f32 / total_findings as f32
            } else {
                0.0
            };
            let fix_style = if fix_ratio >= 0.8 {
                widgets::ProgressStyle::Success
            } else if fix_ratio >= 0.5 {
                widgets::ProgressStyle::Warning
            } else {
                widgets::ProgressStyle::Error
            };
            widgets::progress_bar_styled(ui, fix_ratio, fix_style, None);

            ui.add_space(theme::SPACE_MD);

            ui.label(
                egui::RichText::new(
                    "Un correctif disponible doit encore être appliqué puis vérifié.",
                )
                .font(theme::font_small())
                .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_MD);

            // C. Average CVSS score
            let (cvss_sum, cvss_count) =
                state
                    .vulnerability_findings
                    .iter()
                    .fold((0.0_f32, 0_u32), |(sum, count), v| {
                        if let Some(score) = v.cvss_score {
                            (sum + score, count + 1)
                        } else {
                            (sum, count)
                        }
                    });
            let avg_cvss = if cvss_count > 0 {
                cvss_sum / cvss_count as f32
            } else {
                0.0
            };
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::GAUGE_HIGH)
                        .color(theme::readable_color(theme::score_color(
                            100.0 - avg_cvss * 10.0,
                        )))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(format!(
                        "Score CVSS moyen : {}",
                        if cvss_count == 0 {
                            "Non disponible".to_owned()
                        } else {
                            crate::format::decimal(avg_cvss, 1)
                        }
                    ))
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(format!("({} CVE avec score)", cvss_count))
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            });
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let crit_active = state.vulnerability.severity_filter == Some(Severity::Critical);
        let high_active = state.vulnerability.severity_filter == Some(Severity::High);
        let med_active = state.vulnerability.severity_filter == Some(Severity::Medium);
        let low_active = state.vulnerability.severity_filter == Some(Severity::Low);

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

        let toggled = widgets::SearchFilterBar::new(
            &mut state.vulnerability.search,
            "Rechercher une CVE, un logiciel ou une description…",
        )
        .chip("Critique", crit_active, theme::ERROR)
        .chip("Élevée", high_active, theme::SEVERITY_HIGH)
        .chip("Moyenne", med_active, theme::SEVERITY_MEDIUM)
        .chip("Faible", low_active, theme::INFO)
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
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::show_findings(ui, state, &search_lower, &mut command);
        });

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.vulnerability.selected_vuln
            && sel_idx < state.vulnerability_findings.len()
        {
            let finding = state.vulnerability_findings[sel_idx].clone();
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

            let mut actions = Vec::new();
            if finding.fix_available {
                actions.push(widgets::DetailAction::primary(
                    "Appliquer le correctif",
                    icons::WRENCH,
                ));
            }
            // "Analyser avec l'IA" button — only if no AI analysis yet
            let has_ai_analysis = finding.ai_analysis.is_some();
            if !has_ai_analysis {
                actions.push(widgets::DetailAction::primary(
                    "Analyser avec l'IA",
                    icons::BRAIN,
                ));
            }
            actions.push(widgets::DetailAction::secondary("Ignorer", icons::XMARK));
            actions.push(widgets::DetailAction::secondary(
                "Exporter",
                icons::DOWNLOAD,
            ));

            // "Appliquer le correctif IA" button — only if AI script is available
            let has_ai_fix = finding.ai_remediation_script.is_some();
            if has_ai_fix {
                actions.insert(
                    0,
                    widgets::DetailAction::primary("Appliquer correctif IA", icons::WAND_SPARKLES),
                );
            }

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
                            widgets::detail_mono(ui, "CVE ID", cve_display);
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
                                    "Fix disponible",
                                    "OUI",
                                    theme::SUCCESS,
                                );
                            } else {
                                widgets::detail_field_badge(
                                    ui,
                                    "Fix disponible",
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
                                    &dt.format("%d/%m/%Y %H:%M").to_string(),
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

            if let Some(action_idx) = drawer_action {
                // Action indices depend on which buttons are present:
                // [fix_available?] -> [AI analyze?] -> Ignorer -> Exporter
                let mut next_idx = 0_usize;
                let fix_action_idx = if finding.fix_available {
                    let i = next_idx;
                    next_idx += 1;
                    Some(i)
                } else {
                    None
                };
                let ai_action_idx = if !has_ai_analysis {
                    let i = next_idx;
                    next_idx += 1;
                    Some(i)
                } else {
                    None
                };
                let ignore_action_idx = next_idx;
                let export_action_idx = next_idx + 1;

                if fix_action_idx == Some(action_idx) {
                    let safe_name = finding.affected_software.replace('\'', "'\\''");
                    let cmd = platform_upgrade_command(&safe_name);
                    ui.ctx().copy_text(cmd);
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::success(
                            "Commande de mise \u{00e0} jour copi\u{00e9}e dans le presse-papiers",
                        )
                        .with_time(time),
                    );
                } else if has_ai_fix && action_idx == 0 {
                    // Apply AI Fix action
                    if let Some(script) = &finding.ai_remediation_script {
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

                        let time = ui.input(|i| i.time);
                        state.toasts.push(
                            crate::widgets::toast::Toast::info("Application du correctif IA…")
                                .with_time(time),
                        );
                    }
                } else if ai_action_idx == Some(action_idx) {
                    command = Some(GuiCommand::LlmAnalyzeVulnerability {
                        finding_index: sel_idx,
                    });
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::info("Analyse IA en cours\u{2026}")
                            .with_time(time),
                    );
                } else if action_idx == ignore_action_idx {
                    state.vulnerability.detail_open = false;
                } else if action_idx == export_action_idx {
                    let success = Self::export_csv(state, &[sel_idx]);
                    let time = ui.input(|i| i.time);
                    if success {
                        state.toasts.push(
                            crate::widgets::toast::Toast::success("Export CSV r\u{00e9}ussi")
                                .with_time(time),
                        );
                    }
                }
            }
        }

        command
    }

    fn show_findings(
        ui: &mut Ui,
        state: &mut AppState,
        search_lower: &str,
        _command: &mut Option<GuiCommand>,
    ) {
        let filtered: Vec<usize> = state
            .vulnerability_findings
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
                if let Some(ref sev) = state.vulnerability.severity_filter {
                    f.severity == *sev
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect();

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
                    let cols = 7;
                    let column_widths = [
                        100.0,
                        120.0,
                        80.0,
                        60.0,
                        90.0,
                        ui.available_width() - 550.0,
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
                            .map(|dt| dt.format("%d/%m/%Y %H:%M").to_string())
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
    ) {
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.set_min_height(theme::SUMMARY_CARD_MIN_HEIGHT);
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(safe_color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(safe_color.linear_multiply(theme::OPACITY_DISABLED)),
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

/// Generate a platform-appropriate package upgrade command.
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
