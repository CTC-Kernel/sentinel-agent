// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{ComplianceGroupBy, ComplianceViewMode, GuiCheckStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

/// Name the sort of the checks list is kept under.
const CHECKS_TABLE: &str = "compliance_checks";

impl CompliancePage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        // Build a subtitle from the actually-active frameworks so the header
        // reflects the real scope instead of a hardcoded ISO reference.
        let active_label = state
            .summary
            .active_frameworks
            .as_ref()
            .filter(|f| !f.is_empty())
            .map(|f| {
                f.iter()
                    .take(4)
                    .map(|fw| agent_common::frameworks::framework_display_name(fw))
                    .collect::<Vec<_>>()
                    .join(" · ")
            })
            .unwrap_or_else(|| {
                "CIS · NIST CSF · ISO 27001 · ANSSI · NIS 2 · DORA · SOC 2".to_string()
            });
        let _ = widgets::page_header_nav(
            ui,
            &["Conformité & risques", "Conformité"],
            "Conformité Réglementaire",
            Some("Écarts et matrice de contrôles, tous référentiels confondus."),
            Some(&format!(
                "Évaluez votre posture de sécurité par rapport à vos référentiels actifs ({active_label}). Chaque contrôle indique son statut et propose des actions de remédiation directes.",
            )),
        );
        ui.add_space(theme::SPACE_LG);

        // Last audit timestamp
        if let Some(last_check) = state.summary.last_check_at {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!(
                        "Dernier audit : {}",
                        crate::format::local_datetime(last_check)
                    ))
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
                );
            });
        }
        ui.add_space(theme::SPACE_MD);

        widgets::data_card(ui, "Synthèse des contrôles", |ui| {
            let width = ui.available_width();
            if width >= 640.0 {
                ui.horizontal_top(|ui| {
                    ui.spacing_mut().item_spacing.x = theme::SPACE_LG;
                    ui.vertical(|ui| {
                        ui.set_width(180.0);
                        widgets::compliance_gauge(ui, state.summary.compliance_score, 70.0);
                    });
                    ui.vertical(|ui| {
                        ui.set_width((width - 180.0 - theme::SPACE_LG).max(1.0));
                        Self::control_summary(ui, state);
                    });
                });
            } else {
                ui.vertical_centered(|ui| {
                    widgets::compliance_gauge(ui, state.summary.compliance_score, 70.0);
                });
                ui.add_space(theme::SPACE_MD);
                Self::control_summary(ui, state);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Per-framework score breakdown (AAA Grade)
        if let Some(ref frameworks) = state.summary.active_frameworks
            && !frameworks.is_empty()
            && !state.checks.is_empty()
        {
            widgets::data_card(ui, "Scores par référentiel", |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("SCORE PAR R\u{00c9}F\u{00c9}RENTIEL")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                for fw in frameworks {
                    // Match on canonical framework ids so config names ("CIS",
                    // "ISO 27001") align with check tags ("CIS_V8", "ISO_27001").
                    let fw_canon = agent_common::frameworks::normalize_framework_id(fw)
                        .map(str::to_string)
                        .unwrap_or_else(|| fw.trim().to_ascii_uppercase());
                    let fw_checks: Vec<&crate::dto::GuiCheckResult> = state
                        .checks
                        .iter()
                        .filter(|c| {
                            c.frameworks.iter().any(|f| {
                                agent_common::frameworks::normalize_framework_id(f)
                                    .map(str::to_string)
                                    .unwrap_or_else(|| f.trim().to_ascii_uppercase())
                                    == fw_canon
                            })
                        })
                        .collect();

                    if fw_checks.is_empty() {
                        continue;
                    }

                    let total_count = fw_checks.len();
                    let pass_count = fw_checks
                        .iter()
                        .filter(|c| c.status == GuiCheckStatus::Pass)
                        .count();
                    let pct = (pass_count as f32 / total_count as f32) * 100.0;
                    let ratio = pass_count as f32 / total_count as f32;

                    let bar_color = if pct >= 80.0 {
                        theme::SUCCESS
                    } else if pct >= 60.0 {
                        theme::WARNING
                    } else {
                        theme::ERROR
                    };

                    let bar_style = if pct >= 80.0 {
                        widgets::ProgressStyle::Success
                    } else if pct >= 60.0 {
                        widgets::ProgressStyle::Warning
                    } else {
                        widgets::ProgressStyle::Error
                    };

                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(agent_common::frameworks::framework_display_name(
                                fw,
                            ))
                            .font(theme::font_label())
                            .color(theme::text_primary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{:.0}\u{202f}% ({}/{})",
                                        pct, pass_count, total_count
                                    ))
                                    .font(theme::font_body())
                                    .color(theme::readable_color(bar_color))
                                    .strong(),
                                );
                            },
                        );
                    });
                    ui.add_space(theme::SPACE_XS);
                    widgets::progress_bar_styled(ui, ratio, bar_style, None);
                    ui.add_space(theme::SPACE_SM);
                }
            });
            ui.add_space(theme::SPACE_MD);
        }

        // Search / filter bar (AAA Grade)
        let pass_active = state.compliance.status_filter == Some(GuiCheckStatus::Pass);
        let fail_active = state.compliance.status_filter == Some(GuiCheckStatus::Fail);
        let err_active = state.compliance.status_filter == Some(GuiCheckStatus::Error);

        // Recomputed on every frame: check results are replaced in place, so
        // a list cached on their number went on showing a control under
        // « Défaillant » after it had passed.
        // The flat list is sortable; grouped and matrix views keep the audit
        // order. The CSV export follows what is displayed.
        let filtered = Self::filtered_indices(state);
        let flat_list = state.compliance.view_mode == ComplianceViewMode::List
            && state.compliance.group_by == ComplianceGroupBy::None;
        let filtered = if flat_list {
            let sort = widgets::table::sort_of(ui.ctx(), CHECKS_TABLE);
            Self::sorted(state, filtered, &sort)
        } else {
            filtered
        };
        let result_count = filtered.len();
        let search_before = state.compliance.search.clone();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.compliance.search,
            "Rechercher un contrôle, un identifiant ou une catégorie…",
        )
        .chip("Conforme", pass_active, theme::SUCCESS)
        .chip("Défaillant", fail_active, theme::ERROR)
        .chip("Erreur", err_active, theme::WARNING)
        .result_count(result_count)
        .show(ui);
        if state.compliance.search != search_before {
            state.compliance.current_page = 0;
        }

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some(GuiCheckStatus::Pass),
                1 => Some(GuiCheckStatus::Fail),
                2 => Some(GuiCheckStatus::Error),
                _ => None,
            };
            if state.compliance.status_filter == target {
                state.compliance.status_filter = None;
            } else {
                state.compliance.status_filter = target;
            }
            // Reset pagination when filter changes
            state.compliance.current_page = 0;
        }

        ui.add_space(theme::SPACE_SM);

        // One toolbar row: grouping, then list or matrix, export at the edge.
        // It was two rows, each led by a shouting caption.
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.y = theme::SPACE_XS;
            ui.label(
                egui::RichText::new("Regrouper")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            for (val, label) in [
                (ComplianceGroupBy::None, "Aucun"),
                (ComplianceGroupBy::Category, "Par catégorie"),
                (ComplianceGroupBy::Framework, "Par référentiel"),
            ] {
                let active = state.compliance.group_by == val;
                if widgets::chip_button(ui, label, active, theme::ACCENT).clicked() {
                    state.compliance.group_by = val;
                }
            }
            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new("Affichage")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            for (mode, label) in [
                (ComplianceViewMode::List, "Liste"),
                (ComplianceViewMode::Matrix, "Matrice"),
            ] {
                let active = state.compliance.view_mode == mode;
                if widgets::chip_button(ui, label, active, theme::ACCENT).clicked() {
                    state.compliance.view_mode = mode;
                }
            }
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        Self::export_csv(state, &filtered);
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Check results table (AAA Grade)
        widgets::data_card(ui, "Résultats des contrôles", |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(match state.compliance.view_mode {
                        ComplianceViewMode::List => "CONTRÔLES D'AUDIT",
                        ComplianceViewMode::Matrix => "MATRICE CONTRÔLES × RÉFÉRENTIELS",
                    })
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
                );
            });
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                if state.compliance.status_filter == Some(GuiCheckStatus::Fail) {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "Objectif de conformit\u{00e9} atteint",
                        "Tous les contr\u{00f4}les audit\u{00e9}s sont conformes aux r\u{00e9}f\u{00e9}rentiels actifs.",
                    );
                } else if state.checks.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "Aucune base de contr\u{00f4}les",
                        Some(
                            "En attente de synchronisation des politiques avec le serveur central…",
                        ),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "Aucun r\u{00e9}sultat correspondant",
                        Some("Modifiez vos crit\u{00e8}res de recherche ou de filtrage."),
                    );
                }
            } else if state.compliance.view_mode == ComplianceViewMode::Matrix {
                // ── Matrix view ──
                let mut clicked = None;
                ui.push_id("compliance_matrix", |ui: &mut egui::Ui| {
                    clicked = Self::render_matrix_view(ui, state, &filtered);
                });
                if let Some(idx) = clicked {
                    Self::open_check(state, idx);
                }
            } else if state.compliance.group_by == ComplianceGroupBy::None {
                const PAGE_SIZE: usize = 50;
                let (start, len, _) = widgets::page_window(
                    filtered.len(),
                    PAGE_SIZE,
                    &mut state.compliance.current_page,
                );
                let page_indices: Vec<usize> = filtered[start..start + len].to_vec();

                ui.push_id("compliance_table_flat", |ui: &mut egui::Ui| {
                    Self::render_check_table(ui, state, &page_indices, true);
                });
                widgets::paginate_controls(
                    ui,
                    filtered.len(),
                    PAGE_SIZE,
                    &mut state.compliance.current_page,
                );
            } else {
                let groups = Self::build_groups(state, &filtered);
                for (group_name, indices) in &groups {
                    let pass_count = indices
                        .iter()
                        .filter(|&&i| {
                            state
                                .checks
                                .get(i)
                                .is_some_and(|c| c.status == GuiCheckStatus::Pass)
                        })
                        .count();
                    let total = indices.len();
                    let pct = if total > 0 {
                        (pass_count as f32 / total as f32) * 100.0
                    } else {
                        0.0
                    };

                    ui.add_space(theme::SPACE_SM);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(group_name.to_uppercase())
                                .font(theme::font_min())
                                .color(theme::text_primary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                        ui.add_space(theme::SPACE_SM);
                        let score_color = theme::score_color(pct);
                        widgets::status_badge(
                            ui,
                            &format!(
                                "{:.0}\u{202f}% CONFORMIT\u{00c9} ({}/{})",
                                pct, pass_count, total
                            ),
                            score_color,
                        );
                    });
                    ui.add_space(theme::SPACE_XS);

                    ui.push_id(
                        format!("compliance_group_{}", group_name),
                        |ui: &mut egui::Ui| {
                            Self::render_check_table(ui, state, indices, false);
                        },
                    );
                    ui.add_space(theme::SPACE_SM);
                }
            }
        });

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.compliance.selected_check
            && sel_idx < state.checks.len()
        {
            let check = state.checks[sel_idx].clone();
            let (status_label, status_color) = Self::status_display(&check.status);
            let sev_color = theme::severity_color_typed(&check.severity);
            let accent = match check.status {
                GuiCheckStatus::Pass => theme::SUCCESS,
                GuiCheckStatus::Fail => theme::ERROR,
                GuiCheckStatus::Error => theme::WARNING,
                _ => theme::ACCENT,
            };

            let is_failed = check.status == GuiCheckStatus::Fail;
            let mut actions = vec![
                // The runtime runs the whole audit; it has no single-check run.
                widgets::DetailAction::primary("Relancer l\u{2019}audit", icons::PLAY),
                widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
            ];
            if is_failed {
                actions.push(widgets::DetailAction::primary(
                    "Analyser avec l'IA",
                    icons::BRAIN,
                ));
                actions.push(widgets::DetailAction::secondary(
                    "Rem\u{00e9}dier",
                    icons::SHIELD_CHECK,
                ));
                actions.push(widgets::DetailAction::primary(
                    "Ouvrir les param\u{00e8}tres syst\u{00e8}me",
                    icons::SETTINGS,
                ));
            }

            // The remediation under review: asked for this check, and what
            // the agent answered it would run.
            if !state.compliance.detail_open {
                Self::close_remediation_review(state);
            }
            let reviewing =
                state.compliance.remediation_requested.as_deref() == Some(check.check_id.as_str());
            let remediation = state
                .compliance
                .remediation_preview
                .clone()
                .filter(|preview| reviewing && preview.check_id == check.check_id);
            let mut remediation_choice: Option<bool> = None;

            let ai_analyzing = state.compliance.ai_analyzing;
            let ai_result = state.compliance.ai_analysis_result.clone();
            let check_id_for_prompt = check.check_id.clone();
            let check_name_for_prompt = check.name.clone();
            let check_msg_for_prompt = check.message.clone();

            let drawer_action = widgets::DetailDrawer::new("compliance_detail", &check.name, icons::COMPLIANCE)
                    .accent(accent)
                    .subtitle(&check.check_id)
                    .show(ui.ctx(), &mut state.compliance.detail_open, |ui| {
                        if reviewing {
                            remediation_choice = remediation_review(ui, remediation.as_ref());
                        }
                        widgets::detail_section(ui, "CONTR\u{00d4}LE DE CONFORMIT\u{00c9}");
                        widgets::detail_mono(ui, "ID", &check.check_id);
                        widgets::detail_field(ui, "Nom", &check.name);
                        widgets::detail_field(ui, "Cat\u{00e9}gorie", &Self::format_category(&check.category));
                        widgets::detail_field_badge(ui, "Statut", status_label, status_color);
                        widgets::detail_field_badge(ui, "S\u{00e9}v\u{00e9}rit\u{00e9}", check.severity.label(), sev_color);
                        if let Some(score) = check.score {
                            let sc = score as f32;
                            widgets::detail_field_colored(ui, "Score", &format!("{score}%"), theme::readable_color(theme::score_color(sc)));
                        }

                        if check.description.is_some() || check.rationale.is_some() {
                            widgets::detail_section(ui, "CE QUI EST V\u{00c9}RIFI\u{00c9}");
                        }
                        if let Some(ref text) = check.description {
                            widgets::detail_text(ui, "Description", text);
                        }
                        if let Some(ref text) = check.rationale {
                            widgets::detail_text(ui, "Pourquoi", text);
                        }
                        if let Some(ref text) = check.remediation {
                            widgets::detail_section(ui, if is_failed { "\u{00c0} CORRIGER" } else { "CORRECTION" });
                            widgets::detail_text(ui, "Comment se mettre en conformit\u{00e9}", text);
                        }

                        widgets::detail_section(ui, "R\u{00c9}F\u{00c9}RENTIELS");
                        for fw in &check.frameworks {
                            widgets::detail_field_badge(ui, "", framework_label(fw), theme::INFO);
                        }
                        if check.frameworks.is_empty() {
                            widgets::detail_field(ui, "", "Aucun r\u{00e9}f\u{00e9}rentiel");
                        }

                        widgets::detail_section(ui, "R\u{00c9}SULTAT");
                        if let Some(ref msg) = check.message {
                            widgets::detail_text(ui, "Message", msg);
                        }
                        if let Some(ref details) = check.details {
                            let json_str = serde_json::to_string_pretty(details).unwrap_or_default();
                            let display_str = if json_str.chars().count() > 500 {
                                let truncated: String = json_str.chars().take(497).collect();
                                format!("{}…", truncated)
                            } else {
                                json_str
                            };
                            widgets::detail_mono(ui, "D\u{00e9}tails", &display_str);
                        }
                        if let Some(dt) = check.executed_at {
                            widgets::detail_field(ui, "Ex\u{00e9}cut\u{00e9} le", &crate::format::local_datetime(dt));
                        }

                        // AI Analysis section
                        if is_failed {
                            widgets::detail_section(ui, "ANALYSE IA");
                            if ai_analyzing {
                                ui.horizontal(|ui| {
                                    ui.spinner();
                                    ui.label(
                                        egui::RichText::new("Analyse en cours…")
                                            .font(theme::font_small())
                                            .color(theme::readable_color(theme::INFO)),
                                    );
                                });
                            } else if let Some(ref result) = ai_result {
                                widgets::detail_text(ui, "R\u{00e9}sultat", result);
                            } else {
                                ui.label(
                                    egui::RichText::new("Cliquez sur \"Analyser avec l'IA\" pour obtenir une analyse d\u{00e9}taill\u{00e9}e.")
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                );
                            }
                        }
                    }, &actions);

            if let Some(action_idx) = drawer_action {
                match action_idx {
                    0 => {
                        command = Some(GuiCommand::RunCheck);
                        state.push_toast(
                            crate::widgets::toast::Toast::info(
                                "Audit relanc\u{00e9} : tous les contr\u{00f4}les sont r\u{00e9}ex\u{00e9}cut\u{00e9}s",
                            ),
                            ui.ctx(),
                        );
                    }
                    1 => Self::export_csv(state, &[sel_idx]),
                    2 if is_failed => {
                        // Analyze with AI
                        state.compliance.ai_analyzing = true;
                        state.compliance.ai_analysis_result = None;
                        let prompt = format!(
                            "Analyse de conformit\u{00e9} du contr\u{00f4}le \u{00e9}chou\u{00e9} '{}' (ID: {}). Message: {}. Explique pourquoi ce contr\u{00f4}le a \u{00e9}chou\u{00e9}, le risque associ\u{00e9}, et propose des \u{00e9}tapes de rem\u{00e9}diation.",
                            check_name_for_prompt,
                            check_id_for_prompt,
                            check_msg_for_prompt
                                .as_deref()
                                .unwrap_or("Aucun d\u{00e9}tail"),
                        );
                        command = Some(GuiCommand::LlmPrompt {
                            prompt,
                            context: Some(crate::dto::LlmPromptContext::Compliance),
                            speak_response: false,
                        });
                    }
                    // Remediate: administrator mode, then the review of what
                    // would run. Nothing is executed before the operator
                    // confirms it in the drawer.
                    3 if is_failed
                        && state.require_admin("Appliquer une rem\u{00e9}diation automatique") =>
                    {
                        state.compliance.remediation_requested = Some(check_id_for_prompt.clone());
                        state.compliance.remediation_preview = None;
                        command = Some(GuiCommand::RemediatePreview {
                            check_id: check_id_for_prompt,
                        });
                    }
                    4 if is_failed => {
                        // Open OS system settings for this specific check
                        if !crate::os_settings::open_for_check(&check_id_for_prompt) {
                            // Fallback: navigate to agent Settings page if no OS mapping
                            state.pending_navigation = Some(crate::app::Page::Settings);
                        }
                        state.compliance.detail_open = false;
                    }
                    _ => {}
                }
            }

            match remediation_choice {
                Some(true)
                    if state.require_admin("Appliquer une rem\u{00e9}diation automatique") =>
                {
                    Self::close_remediation_review(state);
                    command = Some(GuiCommand::Remediate {
                        check_id: check.check_id.clone(),
                    });
                    state.push_toast(
                        crate::widgets::toast::Toast::info(
                            "Rem\u{00e9}diation lanc\u{00e9}e : le r\u{00e9}sultat arrive en notification",
                        ),
                        ui.ctx(),
                    );
                }
                Some(false) => Self::close_remediation_review(state),
                _ => {}
            }
        }

        command
    }

    /// Checks matching the search field and the status chip, in audit order.
    fn filtered_indices(state: &AppState) -> Vec<usize> {
        let search_lower = state.compliance.search.to_lowercase();
        state
            .checks
            .iter()
            .enumerate()
            .filter(|(_, c)| {
                if !search_lower.is_empty()
                    && !c.name.to_lowercase().contains(&search_lower)
                    && !c.category.to_lowercase().contains(&search_lower)
                    && !Self::format_category(&c.category)
                        .to_lowercase()
                        .contains(&search_lower)
                    && !c.check_id.to_lowercase().contains(&search_lower)
                {
                    return false;
                }
                match state.compliance.status_filter {
                    Some(GuiCheckStatus::Pass) => c.status == GuiCheckStatus::Pass,
                    Some(GuiCheckStatus::Fail) => c.status == GuiCheckStatus::Fail,
                    Some(GuiCheckStatus::Error) => c.status == GuiCheckStatus::Error,
                    _ => true,
                }
            })
            .map(|(i, _)| i)
            .collect()
    }

    /// `indices` in the order the sorted column asks for; untouched without
    /// a sort. Stable, so equal rows keep the audit order.
    fn sorted(
        state: &AppState,
        mut indices: Vec<usize>,
        sort: &widgets::data_table::TableSort,
    ) -> Vec<usize> {
        if let Some(key) = widgets::table::sort_key(sort) {
            indices.sort_by(|&a, &b| match (state.checks.get(a), state.checks.get(b)) {
                (Some(a), Some(b)) => widgets::table::directed(sort, compare_checks(key, a, b)),
                _ => std::cmp::Ordering::Equal,
            });
        }
        indices
    }

    /// Stop reviewing an automatic remediation.
    fn close_remediation_review(state: &mut AppState) {
        state.compliance.remediation_requested = None;
        state.compliance.remediation_preview = None;
    }

    /// Select a check and open its drawer.
    fn open_check(state: &mut AppState, idx: usize) {
        if state.compliance.selected_check != Some(idx) {
            state.compliance.ai_analysis_result = None;
            state.compliance.ai_analyzing = false;
            Self::close_remediation_review(state);
        }
        state.compliance.selected_check = Some(idx);
        state.compliance.detail_open = true;
    }

    fn build_groups(state: &AppState, indices: &[usize]) -> Vec<(String, Vec<usize>)> {
        use std::collections::BTreeMap;
        let mut map: BTreeMap<String, Vec<usize>> = BTreeMap::new();
        for &i in indices {
            let Some(check) = state.checks.get(i) else {
                continue;
            };
            if state.compliance.group_by == ComplianceGroupBy::Category {
                let key = Self::format_category(&check.category);
                map.entry(key).or_default().push(i);
            } else if check.frameworks.is_empty() {
                map.entry("NON CLASSÉ".to_string()).or_default().push(i);
            } else {
                // Grouped by framework, not by tag: "CIS" and "CIS_V8" are one.
                for fw in &check.frameworks {
                    let group = map
                        .entry(framework_label(&framework_key(fw)).to_string())
                        .or_default();
                    if !group.contains(&i) {
                        group.push(i);
                    }
                }
            }
        }
        map.into_iter().collect()
    }

    fn render_check_table(ui: &mut Ui, state: &mut AppState, indices: &[usize], sortable: bool) {
        use widgets::table;

        /// Framework badges shown inline before the "+N" overflow badge.
        const INLINE_FRAMEWORKS: usize = 3;

        let mut clicked_idx: Option<usize> = None;
        let mut sort_changed = false;
        let selected = state.compliance.selected_check;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(180.0, 3.0), // Désignation
                table::Col::fluid(100.0, 0.5), // Domaine
                table::Col::fluid(128.0, 0.0), // Statut: fits "NON-CONFORME" at 12px
                table::Col::fluid(90.0, 0.0),  // Impact
                table::Col::fixed(56.0),       // Taux
                table::Col::fluid(150.0, 1.5), // Référentiels
                table::Col::fluid(80.0, 0.0),  // Exécuté
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for (label, key) in [
                ("D\u{00c9}SIGNATION DU POINT", "name"),
                ("DOMAINE", "category"),
                ("STATUT", "status"),
                ("IMPACT", "severity"),
                ("TAUX", "score"),
                ("R\u{00c9}F\u{00c9}RENTIELS", "frameworks"),
                ("EX\u{00c9}CUT\u{00c9}", "executed"),
            ] {
                header.col(|ui| {
                    // A grouped view draws this table once per group: only
                    // the flat list carries the sort.
                    if sortable {
                        sort_changed |= table::header_cell_sortable(ui, label, CHECKS_TABLE, key);
                    } else {
                        table::header_cell(ui, label);
                    }
                });
            }
        })
        .body(|mut body| {
            for &idx in indices {
                let Some(check) = state.checks.get(idx) else {
                    continue;
                };
                let is_selected = selected == Some(idx);

                body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                    row.set_selected(is_selected);

                    row.col(|ui| {
                        if table::cell_link_text(ui, &check.name).clicked() {
                            clicked_idx = Some(idx);
                        }
                    });

                    row.col(|ui| {
                        table::cell_styled(
                            ui,
                            &Self::format_category(&check.category),
                            theme::font_label(),
                            theme::text_tertiary(),
                        );
                    });

                    row.col(|ui| {
                        let (label, color) = Self::status_display(&check.status);
                        widgets::status_badge(ui, label, color);
                    });

                    row.col(|ui| {
                        widgets::status_badge(
                            ui,
                            check.severity.label(),
                            theme::severity_color_typed(&check.severity),
                        );
                    });

                    row.col(|ui| {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if let Some(s) = check.score {
                                table::cell_colored(
                                    ui,
                                    &crate::format::pct(s, 0),
                                    theme::readable_color(theme::score_color(s as f32)),
                                );
                            } else {
                                table::cell_empty(ui);
                            }
                        });
                    });

                    row.col(|ui| {
                        if check.frameworks.is_empty() {
                            table::cell_empty(ui);
                        } else {
                            // One line of badges; the rest folds into "+N" and
                            // the full list lives in the drawer.
                            ui.horizontal(|ui| {
                                ui.spacing_mut().item_spacing.x = theme::SPACE_XS;
                                for fw in check.frameworks.iter().take(INLINE_FRAMEWORKS) {
                                    widgets::status_badge(ui, framework_label(fw), theme::INFO);
                                }
                                let rest = check.frameworks.len().saturating_sub(INLINE_FRAMEWORKS);
                                if rest > 0 {
                                    widgets::status_badge(
                                        ui,
                                        &format!("+{rest}"),
                                        theme::text_tertiary(),
                                    );
                                }
                            });
                        }
                    });

                    row.col(|ui| match check.executed_at {
                        Some(dt) => {
                            table::cell_muted(ui, &crate::format::local_day_time(dt));
                        }
                        None => {
                            table::cell_empty(ui);
                        }
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(idx);
                    }
                });
            }
        });

        if sort_changed {
            state.compliance.current_page = 0;
        }
        if let Some(idx) = clicked_idx {
            Self::open_check(state, idx);
        }
    }

    /// The controls against the frameworks they belong to. Returns the check
    /// whose row was clicked, to open in the drawer.
    fn render_matrix_view(ui: &mut Ui, state: &AppState, indices: &[usize]) -> Option<usize> {
        use std::collections::BTreeSet;

        // Unique frameworks of the filtered checks, by canonical id.
        let covers = |check: &crate::dto::GuiCheckResult, key: &str| {
            check.frameworks.iter().any(|fw| framework_key(fw) == key)
        };
        let frameworks: Vec<String> = indices
            .iter()
            .filter_map(|&i| state.checks.get(i))
            .flat_map(|check| check.frameworks.iter().map(|fw| framework_key(fw)))
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();

        if frameworks.is_empty() {
            widgets::empty_state(
                ui,
                icons::COMPLIANCE,
                "Aucun r\u{00e9}f\u{00e9}rentiel",
                Some(
                    "Les contr\u{00f4}les s\u{00e9}lectionn\u{00e9}s ne sont associ\u{00e9}s \u{00e0} aucun r\u{00e9}f\u{00e9}rentiel.",
                ),
            );
            return None;
        }

        // Compute per-framework scores for the header
        let mut fw_pass: Vec<u32> = vec![0; frameworks.len()];
        let mut fw_total: Vec<u32> = vec![0; frameworks.len()];
        for &i in indices {
            let Some(check) = state.checks.get(i) else {
                continue;
            };
            for (fi, fw) in frameworks.iter().enumerate() {
                if covers(check, fw) {
                    fw_total[fi] = fw_total[fi].saturating_add(1);
                    if check.status == GuiCheckStatus::Pass {
                        fw_pass[fi] = fw_pass[fi].saturating_add(1);
                    }
                }
            }
        }

        // Build table: the control name takes the width the framework
        // columns leave, every framework column is the same width.
        use widgets::table;

        let mut cols = Vec::with_capacity(frameworks.len() + 1);
        cols.push(table::Col::fluid(180.0, 2.0));
        cols.extend(frameworks.iter().map(|_| table::Col::fluid(96.0, 1.0)));

        let selected = state.compliance.selected_check;
        let mut clicked_idx: Option<usize> = None;

        table::fluid_clickable(ui, &cols)
            .cell_layout(egui::Layout::centered_and_justified(
                egui::Direction::LeftToRight,
            ))
            .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                header.col(|ui| {
                    ui.with_layout(egui::Layout::left_to_right(egui::Align::Center), |ui| {
                        table::header_cell(ui, "CONTR\u{00d4}LE");
                    });
                });
                for (fi, fw) in frameworks.iter().enumerate() {
                    header.col(|ui| {
                        let pct = if fw_total[fi] > 0 {
                            (fw_pass[fi] as f32 / fw_total[fi] as f32) * 100.0
                        } else {
                            0.0
                        };
                        let score_color = theme::readable_color(theme::score_color(pct));
                        ui.vertical_centered(|ui| {
                            ui.spacing_mut().item_spacing.y = 0.0;
                            table::header_cell(ui, &framework_label(fw).to_uppercase());
                            table::cell_styled(
                                ui,
                                &crate::format::pct(pct, 0),
                                theme::font_label(),
                                score_color,
                            );
                        });
                    });
                }
            })
            .body(|mut body| {
                for &idx in indices {
                    let Some(check) = state.checks.get(idx) else {
                        continue;
                    };
                    let is_selected = selected == Some(idx);
                    body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                        row.set_selected(is_selected);
                        row.col(|ui| {
                            ui.with_layout(
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    if table::cell_link_text(ui, &check.name).clicked() {
                                        clicked_idx = Some(idx);
                                    }
                                },
                            );
                        });
                        for fw in &frameworks {
                            row.col(|ui| {
                                if covers(check, fw) {
                                    let (symbol, color) = match check.status {
                                        GuiCheckStatus::Pass => ("\u{2713}", theme::SUCCESS),
                                        GuiCheckStatus::Fail => ("\u{2717}", theme::ERROR),
                                        GuiCheckStatus::Error => ("!", theme::WARNING),
                                        _ => ("\u{2014}", theme::text_tertiary()),
                                    };
                                    table::cell_colored(ui, symbol, color);
                                } else {
                                    table::cell_empty(ui);
                                }
                            });
                        }
                        if table::row_interaction(&row, is_selected) {
                            clicked_idx = Some(idx);
                        }
                    });
                }
            });

        // Gap analysis footer
        ui.add_space(theme::SPACE_MD);
        ui.label(
            egui::RichText::new("ANALYSE DES \u{00c9}CARTS")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_XS);

        for (fi, fw) in frameworks.iter().enumerate() {
            let fail_count = fw_total[fi].saturating_sub(fw_pass[fi]);
            if fail_count > 0 {
                ui.label(
                    egui::RichText::new(format!(
                        "{} : {} contr\u{00f4}le{s} non conforme{s} sur {}",
                        framework_label(fw),
                        fail_count,
                        fw_total[fi],
                        s = crate::format::plural_suffix(fail_count)
                    ))
                    .font(theme::font_small())
                    .color(theme::readable_color(theme::ERROR)),
                );
            } else {
                ui.label(
                    egui::RichText::new(format!(
                        "{} : tous les contr\u{00f4}les conformes ({}/{})",
                        framework_label(fw),
                        fw_pass[fi],
                        fw_total[fi]
                    ))
                    .font(theme::font_small())
                    .color(theme::readable_color(theme::SUCCESS)),
                );
            }
        }
        clicked_idx
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let c = state.checks.get(i)?;
                let (st, _) = Self::status_display(&c.status);
                Some(vec![
                    c.check_id.clone(),
                    c.name.clone(),
                    Self::format_category(&c.category),
                    st.to_string(),
                    c.severity.label().to_string(),
                    c.score.map(|s| s.to_string()).unwrap_or_default(),
                    c.frameworks
                        .iter()
                        .map(|fw| framework_label(fw))
                        .collect::<Vec<_>>()
                        .join(", "),
                    c.executed_at
                        .map(crate::format::local_datetime)
                        .unwrap_or_default(),
                    c.message.clone().unwrap_or_default(),
                    c.remediation.clone().unwrap_or_default(),
                ])
            })
            .collect();

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "identifiant",
                    "nom",
                    "categorie",
                    "statut",
                    "severite",
                    "score",
                    "referentiels",
                    "execute_le",
                    "message",
                    "remediation",
                ];
                let result =
                    match crate::export::export_csv_timestamped("conformite", headers, &rows) {
                        Ok(path) => (
                            true,
                            format!("Contr\u{00f4}les export\u{00e9}s : {}", path.display()),
                        ),
                        Err(e) => (false, format!("\u{00c9}chec de l\u{2019}export : {e}")),
                    };
                if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(result.0, result.1))
                {
                    tracing::warn!("Failed to send CSV export result: {}", e);
                }
            });
        } else {
            tracing::error!("Dysfonctionnement interne: Canal async non disponible");
        }
    }

    fn control_summary(ui: &mut Ui, state: &mut AppState) {
        widgets::eyebrow(ui, "ANALYSE DES CONTRÔLES");
        ui.add_space(theme::SPACE_SM);
        let items = [
            (
                "TOTAL",
                state.policy.total_policies,
                theme::INFO,
                icons::LIST,
                None,
            ),
            (
                "CONFORMES",
                state.policy.passing,
                theme::SUCCESS,
                icons::CIRCLE_CHECK,
                Some(GuiCheckStatus::Pass),
            ),
            (
                "DÉFAILLANTS",
                state.policy.failing,
                theme::ERROR,
                icons::CIRCLE_XMARK,
                Some(GuiCheckStatus::Fail),
            ),
            (
                "ERREURS",
                state.policy.errors,
                theme::WARNING,
                icons::WARNING,
                Some(GuiCheckStatus::Error),
            ),
        ];
        widgets::ResponsiveGrid::new(115.0, theme::SPACE_SM).show(
            ui,
            &items,
            |ui, width, (label, count, color, icon, filter)| {
                if widgets::metric_card(ui, width, label, &crate::format::int(*count), *color, icon)
                {
                    state.compliance.status_filter = *filter;
                    state.compliance.search.clear();
                    state.compliance.current_page = 0;
                    widgets::open_data_panel(ui.ctx(), "Résultats des contrôles");
                }
            },
        );
        if let Some(frameworks) = state
            .summary
            .active_frameworks
            .as_ref()
            .filter(|f| !f.is_empty())
        {
            ui.add_space(theme::SPACE_MD);
            ui.horizontal_wrapped(|ui| {
                for framework in frameworks {
                    widgets::status_badge(
                        ui,
                        agent_common::frameworks::framework_display_name(framework),
                        theme::ACCENT,
                    );
                }
            });
        }
    }

    fn status_display(status: &GuiCheckStatus) -> (&'static str, egui::Color32) {
        match status {
            GuiCheckStatus::Pass => ("CONFORME", theme::SUCCESS),
            GuiCheckStatus::Fail => ("NON-CONFORME", theme::ERROR),
            // Same colour as the « Erreur » chip and metric: the check could
            // not run, which is not a failed control.
            GuiCheckStatus::Error => ("ERREUR", theme::WARNING),
            GuiCheckStatus::Skipped => ("IGNOR\u{00c9}", theme::text_tertiary()),
            GuiCheckStatus::Pending => ("EN ATTENTE", theme::WARNING),
            GuiCheckStatus::Running => ("EN COURS", theme::INFO),
        }
    }

    /// Format category name for display (snake_case -> TITLE CASE)
    pub(super) fn format_category(category: &str) -> String {
        match category {
            "encryption" => "CHIFFREMENT".to_string(),
            "antivirus" => "ANTIVIRUS".to_string(),
            "firewall" => "PARE-FEU".to_string(),
            "authentication" => "AUTHENTIFICATION".to_string(),
            "session_lock" => "VERROUILLAGE".to_string(),
            "updates" => "MISES À JOUR".to_string(),
            "protocols" => "PROTOCOLES".to_string(),
            "backup" => "SAUVEGARDE".to_string(),
            "accounts" => "COMPTES".to_string(),
            "mfa" => "MFA".to_string(),
            "remote_access" => "ACCÈS DISTANT".to_string(),
            "audit_logging" => "AUDIT".to_string(),
            "device_control" => "PÉRIPHÉRIQUES".to_string(),
            "kernel_security" => "NOYAU".to_string(),
            "network_hardening" => "RÉSEAU".to_string(),
            "time_sync" => "SYNCHRONISATION".to_string(),
            "browser_security" => "NAVIGATEUR".to_string(),
            "directory_policy" => "STRATÉGIES GPO".to_string(),
            "privileged_access" => "ACCÈS PRIVILÉGIÉS".to_string(),
            "general" => "GÉNÉRAL".to_string(),
            "network_security" => "SÉCURITÉ RÉSEAU".to_string(),
            "access_control" => "CONTRÔLE D'ACCÈS".to_string(),
            "container_security" => "CONTENEURS".to_string(),
            "certificate_management" => "CERTIFICATS".to_string(),
            "data_protection" => "PROTECTION DONNÉES".to_string(),
            "cloud_security" => "SÉCURITÉ CLOUD".to_string(),
            // Short category names some collectors emit; they used to reach
            // the table as English capitals ("PASSWORD", "ACCESS").
            "password" | "passwords" => "MOTS DE PASSE".to_string(),
            "access" => "ACCÈS".to_string(),
            "logging" | "logs" => "JOURNALISATION".to_string(),
            "network" => "RÉSEAU".to_string(),
            "system" => "SYSTÈME".to_string(),
            _ => category.to_uppercase().replace('_', " "),
        }
    }
}

/// The review of an automatic remediation, at the top of the drawer: what
/// would run, then « Corriger » or « Annuler ». `preview` is `None` until the
/// agent has answered. Returns `Some(true)` to run it, `Some(false)` to give up.
fn remediation_review(
    ui: &mut Ui,
    preview: Option<&crate::state::RemediationPreview>,
) -> Option<bool> {
    let mut choice = None;
    widgets::detail_section(ui, "CORRECTION AUTOMATIQUE");
    let available = preview.is_some_and(|p| p.available);
    match preview {
        None => {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(
                    egui::RichText::new("Pr\u{00e9}paration de l\u{2019}aper\u{00e7}u…")
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
            });
        }
        Some(preview) if !preview.available => {
            ui.label(
                egui::RichText::new(
                    "Aucune rem\u{00e9}diation automatique n\u{2019}existe pour ce contr\u{00f4}le sur ce syst\u{00e8}me. Suivez la proc\u{00e9}dure de correction d\u{00e9}crite plus bas.",
                )
                .font(theme::font_small())
                .color(theme::readable_color(theme::WARNING)),
            );
        }
        Some(preview) => {
            widgets::detail_text(ui, "Action", &preview.description);
            ui.label(
                egui::RichText::new("Commande ex\u{00e9}cut\u{00e9}e")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            ui.add(
                egui::Label::new(
                    egui::RichText::new(&preview.command)
                        .font(theme::font_mono_sm())
                        .color(theme::text_primary()),
                )
                .wrap_mode(egui::TextWrapMode::Wrap),
            );
            ui.add_space(theme::SPACE_XS);
            widgets::detail_field(ui, "Risque", &preview.risk);
            widgets::detail_field(
                ui,
                "Red\u{00e9}marrage requis",
                if preview.requires_reboot {
                    "Oui"
                } else {
                    "Non"
                },
            );
            ui.label(
                egui::RichText::new(
                    "La commande modifie la configuration du poste. Relisez-la avant de confirmer.",
                )
                .font(theme::font_small())
                .color(theme::text_tertiary()),
            );
        }
    }
    ui.add_space(theme::SPACE_SM);
    ui.horizontal(|ui| {
        if widgets::primary_button(ui, format!("{}  Corriger", icons::SHIELD_CHECK), available)
            .clicked()
            && available
        {
            choice = Some(true);
        }
        if widgets::secondary_button(ui, "Annuler", true).clicked() {
            choice = Some(false);
        }
    });
    choice
}

/// Rank of a status for sorting: compliant first, failed last.
fn status_rank(status: GuiCheckStatus) -> u8 {
    match status {
        GuiCheckStatus::Pass => 0,
        GuiCheckStatus::Skipped => 1,
        GuiCheckStatus::Pending => 2,
        GuiCheckStatus::Running => 3,
        GuiCheckStatus::Error => 4,
        GuiCheckStatus::Fail => 5,
    }
}

/// Rank of a severity for sorting: informational first, critical last.
fn severity_rank(severity: crate::dto::Severity) -> u8 {
    use crate::dto::Severity;
    match severity {
        Severity::Info => 0,
        Severity::Low => 1,
        Severity::Medium => 2,
        Severity::High => 3,
        Severity::Critical => 4,
    }
}

/// Natural (ascending) order of two checks on the column `key`.
fn compare_checks(
    key: &str,
    a: &crate::dto::GuiCheckResult,
    b: &crate::dto::GuiCheckResult,
) -> std::cmp::Ordering {
    let text = |a: &str, b: &str| a.to_lowercase().cmp(&b.to_lowercase());
    let frameworks = |c: &crate::dto::GuiCheckResult| {
        c.frameworks
            .iter()
            .map(|fw| framework_label(fw).to_lowercase())
            .collect::<Vec<_>>()
            .join(", ")
    };
    match key {
        "name" => text(&a.name, &b.name),
        "category" => text(
            &CompliancePage::format_category(&a.category),
            &CompliancePage::format_category(&b.category),
        ),
        "status" => status_rank(a.status).cmp(&status_rank(b.status)),
        "severity" => severity_rank(a.severity).cmp(&severity_rank(b.severity)),
        "score" => a.score.cmp(&b.score),
        "frameworks" => frameworks(a).cmp(&frameworks(b)),
        "executed" => a.executed_at.cmp(&b.executed_at),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Canonical id of a framework tag, so that "CIS" and "CIS_V8" are one
/// framework; an unknown tag stands for itself.
pub(super) fn framework_key(raw: &str) -> String {
    agent_common::frameworks::normalize_framework_id(raw)
        .map(str::to_string)
        .unwrap_or_else(|| raw.trim().to_ascii_uppercase())
}

/// Name of a framework as shown to the operator.
pub(super) fn framework_label(raw: &str) -> &str {
    agent_common::frameworks::framework_display_name(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(id: &str, status: &str) -> crate::dto::GuiCheckResult {
        serde_json::from_value(serde_json::json!({
            "check_id": id, "name": id, "category": "firewall",
            "status": status, "severity": "high", "frameworks": ["CIS"]
        }))
        .unwrap()
    }

    /// Regression: the list was cached on the number of checks, so a control
    /// that passed after a new audit stayed under « Défaillant ».
    #[test]
    fn the_status_filter_follows_results_replaced_in_place() {
        let mut state = AppState {
            checks: vec![check("a", "fail"), check("b", "pass")],
            ..Default::default()
        };
        state.compliance.status_filter = Some(GuiCheckStatus::Fail);
        assert_eq!(CompliancePage::filtered_indices(&state), vec![0]);

        state.checks[0] = check("a", "pass");
        state.checks[1] = check("b", "fail");
        assert_eq!(CompliancePage::filtered_indices(&state), vec![1]);
    }

    #[test]
    fn checks_sort_by_rank_not_by_label() {
        use widgets::data_table::{SortDirection, TableSort};
        let mut state = AppState::default();
        let mut critical: crate::dto::GuiCheckResult = check("Zèbre", "pass");
        critical.severity = crate::dto::Severity::Critical;
        critical.score = Some(100);
        let mut low = check("alpha", "fail");
        low.severity = crate::dto::Severity::Low;
        low.score = Some(9);
        let error = check("Beta", "error");
        state.checks = vec![critical, low, error];

        let order = |key: &str, direction| {
            CompliancePage::sorted(&state, vec![0, 1, 2], &TableSort::by(key, direction))
        };
        // Text ignores case; « É » and friends do not jump ahead of ASCII.
        assert_eq!(order("name", SortDirection::Ascending), [1, 2, 0]);
        // Compliant, then in error, then failed: not the alphabet.
        assert_eq!(order("status", SortDirection::Ascending), [0, 2, 1]);
        assert_eq!(order("severity", SortDirection::Descending), [0, 2, 1]);
        // Numeric: 9 before 100; a check without score sorts first.
        assert_eq!(order("score", SortDirection::Ascending), [2, 1, 0]);
        // No sort: the audit order.
        assert_eq!(order("name", SortDirection::None), [0, 1, 2]);
    }

    #[test]
    fn a_remediation_preview_is_kept_only_for_the_check_under_review() {
        let preview = |id: &str| crate::events::AgentEvent::RemediationPreview {
            check_id: id.into(),
            available: true,
            description: "Activer le pare-feu".into(),
            command: "ufw enable".into(),
            risk: "Faible".into(),
            requires_reboot: false,
        };
        let mut state = AppState::default();
        state.apply_event(preview("a"));
        assert!(
            state.compliance.remediation_preview.is_none(),
            "nobody asked"
        );

        state.compliance.remediation_requested = Some("a".into());
        state.apply_event(preview("b"));
        assert!(
            state.compliance.remediation_preview.is_none(),
            "another check"
        );
        state.apply_event(preview("a"));
        assert_eq!(
            state
                .compliance
                .remediation_preview
                .as_ref()
                .map(|p| p.command.as_str()),
            Some("ufw enable")
        );

        CompliancePage::close_remediation_review(&mut state);
        assert!(state.compliance.remediation_requested.is_none());
        assert!(state.compliance.remediation_preview.is_none());
    }

    #[test]
    fn the_search_matches_the_category_as_displayed() {
        let mut state = AppState {
            checks: vec![check("a", "fail")],
            ..Default::default()
        };
        state.compliance.search = "pare-feu".into();
        assert_eq!(CompliancePage::filtered_indices(&state), vec![0]);
    }
}
