// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{ComplianceGroupBy, ComplianceViewMode, GuiAgentStatus, GuiCheckStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

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
            .unwrap_or_else(|| "CIS · NIST CSF · ISO 27001 · ANSSI · NIS 2 · DORA".to_string());
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

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;

            // Audit button - Admin only
            if state.security.admin_unlocked {
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
            } else {
                // Disabled button for non-admin users
                widgets::button::primary_button_loading(
                    ui,
                    format!("{}  {}", "Lancer l'analyse", icons::LOCK),
                    false,
                    false,
                );
            }
        });

        // Last audit timestamp
        if let Some(last_check) = state.summary.last_check_at {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!(
                        "Dernier audit : {}",
                        last_check.format("%d/%m/%Y %H:%M")
                    ))
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
                );
            });
        }
        ui.add_space(theme::SPACE_MD);

        // Active Frameworks indicator (AAA)
        if let Some(frameworks) = &state.summary.active_frameworks
            && !frameworks.is_empty()
        {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("RÉFÉRENTIELS ACTIFS :")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                let fw_count = frameworks.len();
                for fw in frameworks.iter().take(3) {
                    widgets::status_badge(
                        ui,
                        agent_common::frameworks::framework_display_name(fw),
                        theme::INFO,
                    );
                    ui.add_space(theme::SPACE_XS);
                }
                if fw_count > 3 {
                    widgets::status_badge(
                        ui,
                        &format!("+{}", fw_count - 3),
                        theme::text_tertiary(),
                    );
                }
            });
            ui.add_space(theme::SPACE_MD);
        }

        // Summary Area (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Left: Large Gauge
                ui.vertical(|ui| {
                    ui.set_width(180.0);
                    widgets::compliance_gauge(ui, state.summary.compliance_score, 70.0);
                });

                ui.add_space(theme::SPACE_LG);

                // Right: Detailed counters
                ui.vertical(|ui| {
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new("ANALYSE SYNTHÉTIQUE DES CONTRÔLES")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    ui.horizontal(|ui| {
                        Self::mini_stat(
                            ui,
                            "TOTAL",
                            &state.policy.total_policies.to_string(),
                            theme::text_primary(),
                            icons::LIST,
                        );
                        ui.add_space(theme::SPACE_MD);
                        Self::mini_stat(
                            ui,
                            "CONFORME",
                            &state.policy.passing.to_string(),
                            theme::SUCCESS,
                            icons::CIRCLE_CHECK,
                        );
                        ui.add_space(theme::SPACE_MD);
                        Self::mini_stat(
                            ui,
                            "DÉFAILLANT",
                            &state.policy.failing.to_string(),
                            theme::ERROR,
                            icons::CIRCLE_XMARK,
                        );
                        ui.add_space(theme::SPACE_MD);
                        Self::mini_stat(
                            ui,
                            "ERREUR",
                            &state.policy.errors.to_string(),
                            theme::WARNING,
                            icons::WARNING,
                        );
                    });

                    if let Some(ref frameworks) = state.summary.active_frameworks
                        && !frameworks.is_empty()
                    {
                        ui.add_space(theme::SPACE_MD);
                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new("RÉFÉRENTIELS ACTIFS:")
                                    .font(theme::font_min())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                            for fw in frameworks.iter().take(4) {
                                widgets::status_badge(
                                    ui,
                                    agent_common::frameworks::framework_display_name(fw),
                                    theme::ACCENT,
                                );
                            }
                        });
                    }
                });
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Per-framework score breakdown (AAA Grade)
        if let Some(ref frameworks) = state.summary.active_frameworks
            && !frameworks.is_empty()
            && !state.checks.is_empty()
        {
            widgets::card(ui, |ui: &mut egui::Ui| {
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
                                    .color(bar_color)
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

        let search_id = ui.id().with("compliance_search_cache");
        let search_lower: String = ui
            .memory(|mem| {
                mem.data
                    .get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.compliance.search)
                    .map(|(_, lower)| lower)
            })
            .unwrap_or_else(|| {
                let lower = state.compliance.search.to_lowercase();
                ui.memory_mut(|mem| {
                    mem.data
                        .insert_temp(search_id, (state.compliance.search.clone(), lower.clone()))
                });
                lower
            });

        let filter_fp = (
            state.checks.len(),
            search_lower.clone(),
            state.compliance.status_filter,
            state.compliance.group_by.index(),
        );
        let filter_fp_id = ui.id().with("compliance_filter_fp");
        let filter_cache_id = ui.id().with("compliance_filter_cache");
        let prev_fp: Option<(usize, String, Option<GuiCheckStatus>, u8)> =
            ui.memory(|mem| mem.data.get_temp(filter_fp_id));
        let filtered: Vec<usize> = if prev_fp.as_ref() == Some(&filter_fp) {
            ui.memory(|mem| mem.data.get_temp(filter_cache_id))
                .unwrap_or_default()
        } else {
            let result: Vec<usize> =
                if search_lower.is_empty() && state.compliance.status_filter.is_none() {
                    (0..state.checks.len()).collect()
                } else {
                    state
                        .checks
                        .iter()
                        .enumerate()
                        .filter(|(_, c)| {
                            if !search_lower.is_empty()
                                && !c.name.to_lowercase().contains(&search_lower)
                                && !c.category.to_lowercase().contains(&search_lower)
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
                };
            ui.memory_mut(|mem| {
                mem.data.insert_temp(filter_fp_id, filter_fp);
                mem.data.insert_temp(filter_cache_id, result.clone());
            });
            result
        };

        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.compliance.search,
            "Rechercher un contrôle, un identifiant ou une catégorie…",
        )
        .chip("Conforme", pass_active, theme::SUCCESS)
        .chip("Défaillant", fail_active, theme::ERROR)
        .chip("Erreur", err_active, theme::WARNING)
        .result_count(result_count)
        .show(ui);

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

        // Group-by buttons (AAA Styling)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("STRUCTURE D'AFFICHAGE :")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            for (val, label) in [
                (ComplianceGroupBy::None, "Liste plate"),
                (ComplianceGroupBy::Category, "Par catégorie"),
                (ComplianceGroupBy::Framework, "Par référentiel"),
            ] {
                let active = state.compliance.group_by == val;

                if widgets::chip_button(ui, label, active, theme::ACCENT).clicked() {
                    state.compliance.group_by = val;
                }
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        Self::export_csv(state, &filtered);
                        state.push_toast(
                            crate::widgets::toast::Toast::info("Export CSV en cours…"),
                            ui.ctx(),
                        );
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_SM);

        // View mode toggle (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("MODE D'AFFICHAGE :")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            for (mode, label) in [
                (ComplianceViewMode::List, "Liste"),
                (ComplianceViewMode::Matrix, "Matrice"),
            ] {
                let active = state.compliance.view_mode == mode;
                if widgets::chip_button(ui, label, active, theme::ACCENT).clicked() {
                    state.compliance.view_mode = mode;
                }
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Check results table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("MATRICE DES CONTRÔLES D'AUDIT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if !state.checks.is_empty() {
                            ui.label(
                                egui::RichText::new(format!("{} ÉLÉMENTS AFFICHÉS", result_count))
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        }
                    },
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
                ui.push_id("compliance_matrix", |ui: &mut egui::Ui| {
                    Self::render_matrix_view(ui, state, &filtered);
                });
            } else if state.compliance.group_by == ComplianceGroupBy::None {
                // Paginated flat list (50 items per page)
                const PAGE_SIZE: usize = 50;
                let total_pages = filtered.len().div_ceil(PAGE_SIZE);
                let page = state
                    .compliance
                    .current_page
                    .min(total_pages.saturating_sub(1));
                let start = page * PAGE_SIZE;
                let end = (start + PAGE_SIZE).min(filtered.len());
                let page_indices: Vec<usize> = filtered[start..end].to_vec();

                ui.push_id("compliance_table_flat", |ui: &mut egui::Ui| {
                    Self::render_check_table(ui, state, &page_indices, &mut command);
                });

                // Pagination controls
                if total_pages > 1 {
                    ui.add_space(theme::SPACE_MD);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.with_layout(
                            egui::Layout::centered_and_justified(egui::Direction::LeftToRight),
                            |ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    let prev_resp =
                                        widgets::ghost_button(ui, icons::CHEVRON_LEFT.to_string())
                                            .on_hover_text("Page précédente");
                                    if prev_resp.clicked() && page > 0 {
                                        state.compliance.current_page = page - 1;
                                    }
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "Page {} / {}",
                                            page + 1,
                                            total_pages
                                        ))
                                        .font(theme::font_body())
                                        .color(theme::text_secondary()),
                                    );
                                    let next_resp =
                                        widgets::ghost_button(ui, icons::CHEVRON_RIGHT.to_string())
                                            .on_hover_text("Page suivante");
                                    if next_resp.clicked() && page + 1 < total_pages {
                                        state.compliance.current_page = page + 1;
                                    }
                                });
                            },
                        );
                    });
                }
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
                            Self::render_check_table(ui, state, indices, &mut command);
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
                widgets::DetailAction::primary("Relancer le contr\u{00f4}le", icons::PLAY),
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

            let ai_analyzing = state.compliance.ai_analyzing;
            let ai_result = state.compliance.ai_analysis_result.clone();
            let check_id_for_prompt = check.check_id.clone();
            let check_name_for_prompt = check.name.clone();
            let check_msg_for_prompt = check.message.clone();

            let drawer_action = widgets::DetailDrawer::new("compliance_detail", &check.name, icons::COMPLIANCE)
                    .accent(accent)
                    .subtitle(&check.check_id)
                    .show(ui.ctx(), &mut state.compliance.detail_open, |ui| {
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

                        widgets::detail_section(ui, "R\u{00c9}F\u{00c9}RENTIELS");
                        for fw in &check.frameworks {
                            widgets::detail_field_badge(ui, "", &fw.to_uppercase(), theme::INFO);
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
                            widgets::detail_field(ui, "Ex\u{00e9}cut\u{00e9} le", &dt.format("%d/%m/%Y %H:%M").to_string());
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
                    0 => command = Some(GuiCommand::RunCheck),
                    1 => {
                        Self::export_csv(state, &[sel_idx]);
                        state.push_toast(
                            crate::widgets::toast::Toast::info("Export CSV en cours…"),
                            ui.ctx(),
                        );
                    }
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
                        });
                    }
                    3 if is_failed => {
                        // Remediate
                        command = Some(GuiCommand::Remediate {
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
        }

        command
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
                for fw in &check.frameworks {
                    map.entry(fw.clone()).or_default().push(i);
                }
            }
        }
        map.into_iter().collect()
    }

    fn render_check_table(
        ui: &mut Ui,
        state: &mut AppState,
        indices: &[usize],
        _command: &mut Option<GuiCommand>,
    ) {
        use widgets::table;

        /// Framework badges shown inline before the "+N" overflow badge.
        const INLINE_FRAMEWORKS: usize = 3;

        let mut clicked_idx: Option<usize> = None;
        let selected = state.compliance.selected_check;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(180.0, 3.0), // Désignation
                table::Col::fluid(100.0, 0.5), // Domaine
                table::Col::fluid(96.0, 0.0),  // Statut
                table::Col::fluid(90.0, 0.0),  // Impact
                table::Col::fixed(56.0),       // Taux
                table::Col::fluid(150.0, 1.5), // Référentiels
                table::Col::fluid(80.0, 0.0),  // Exécuté
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            header.col(|ui| {
                table::header_cell(ui, "D\u{00c9}SIGNATION DU POINT");
            });
            header.col(|ui| {
                table::header_cell(ui, "DOMAINE");
            });
            header.col(|ui| {
                table::header_cell(ui, "STATUT");
            });
            header.col(|ui| {
                table::header_cell(ui, "IMPACT");
            });
            header.col(|ui| {
                table::header_cell_right(ui, "TAUX");
            });
            header.col(|ui| {
                table::header_cell(ui, "R\u{00c9}F\u{00c9}RENTIELS");
            });
            header.col(|ui| {
                table::header_cell(ui, "EX\u{00c9}CUT\u{00c9}");
            });
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
                        if table::cell_link(ui, &check.name).clicked() {
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
                        let color = theme::severity_color_typed(&check.severity);
                        table::cell_icon(ui, icons::CIRCLE, color, check.severity.label());
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
                                    widgets::status_badge(ui, fw, theme::INFO);
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
                            table::cell_muted(ui, &dt.format("%d/%m %H:%M").to_string());
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

        if let Some(idx) = clicked_idx {
            if state.compliance.selected_check != Some(idx) {
                state.compliance.ai_analysis_result = None;
                state.compliance.ai_analyzing = false;
            }
            state.compliance.selected_check = Some(idx);
            state.compliance.detail_open = true;
        }
    }

    fn render_matrix_view(ui: &mut Ui, state: &AppState, indices: &[usize]) {
        use std::collections::BTreeSet;

        // Collect unique frameworks from filtered checks
        let mut frameworks_set = BTreeSet::new();
        for &i in indices {
            let Some(check) = state.checks.get(i) else {
                continue;
            };
            for fw in &check.frameworks {
                frameworks_set.insert(fw.clone());
            }
        }
        let frameworks: Vec<String> = frameworks_set.into_iter().collect();

        if frameworks.is_empty() {
            widgets::empty_state(
                ui,
                icons::COMPLIANCE,
                "Aucun r\u{00e9}f\u{00e9}rentiel",
                Some(
                    "Les contr\u{00f4}les s\u{00e9}lectionn\u{00e9}s ne sont associ\u{00e9}s \u{00e0} aucun r\u{00e9}f\u{00e9}rentiel.",
                ),
            );
            return;
        }

        // Compute per-framework scores for the header
        let mut fw_pass: Vec<u32> = vec![0; frameworks.len()];
        let mut fw_total: Vec<u32> = vec![0; frameworks.len()];
        for &i in indices {
            let Some(check) = state.checks.get(i) else {
                continue;
            };
            for (fi, fw) in frameworks.iter().enumerate() {
                if check.frameworks.contains(fw) {
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
        cols.extend(frameworks.iter().map(|_| table::Col::fluid(72.0, 1.0)));

        table::fluid(ui, &cols)
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
                            table::header_cell(ui, &fw.to_uppercase());
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
                    body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                        row.col(|ui| {
                            ui.with_layout(
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    table::cell(ui, &check.name);
                                },
                            );
                        });
                        for fw in &frameworks {
                            row.col(|ui| {
                                if check.frameworks.contains(fw) {
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
                        "{} : {} contr\u{00f4}le{s} \u{00e9}chou\u{00e9}{s} sur {}",
                        fw.to_uppercase(),
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
                        fw.to_uppercase(),
                        fw_pass[fi],
                        fw_total[fi]
                    ))
                    .font(theme::font_small())
                    .color(theme::readable_color(theme::SUCCESS)),
                );
            }
        }
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
                    c.category.clone(),
                    st.to_string(),
                    c.severity.as_str().to_string(),
                    c.score.map_or("--".into(), |s| format!("{}", s)),
                    c.frameworks.join(", "),
                ])
            })
            .collect();

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "check_id",
                    "nom",
                    "categorie",
                    "statut",
                    "severite",
                    "score",
                    "frameworks",
                ];
                let path = crate::export::default_export_path("conformite.csv");
                match crate::export::export_csv(headers, &rows, &path) {
                    Ok(_) => {
                        if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            true,
                            "Export CSV réussi".to_string(),
                        )) {
                            tracing::warn!("Failed to send CSV export success: {}", e);
                        }
                    }
                    Err(e) => {
                        if let Err(send_err) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            false,
                            format!("Échec export: {}", e),
                        )) {
                            tracing::warn!("Failed to send CSV export error: {}", send_err);
                        }
                    }
                }
            });
        } else {
            tracing::error!("Dysfonctionnement interne: Canal async non disponible");
        }
    }

    fn mini_stat(ui: &mut Ui, label: &str, value: &str, color: egui::Color32, icon: &str) {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = theme::SPACE_MICRO;
            ui.label(
                egui::RichText::new(icon)
                    .color(color.linear_multiply(theme::OPACITY_STRONG))
                    .size(theme::ICON_INLINE),
            );
            ui.label(egui::RichText::new(value).color(color).strong());
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_min())
                    .color(theme::text_tertiary()),
            );
        });
    }

    fn status_display(status: &GuiCheckStatus) -> (&'static str, egui::Color32) {
        match status {
            GuiCheckStatus::Pass => ("CONFORME", theme::SUCCESS),
            GuiCheckStatus::Fail => ("NON-CONFORME", theme::ERROR),
            GuiCheckStatus::Error => ("ERREUR", theme::ERROR),
            GuiCheckStatus::Skipped => ("IGNOR\u{00c9}", theme::text_tertiary()),
            GuiCheckStatus::Pending => ("EN ATTENTE", theme::WARNING),
            GuiCheckStatus::Running => ("EN COURS", theme::INFO),
        }
    }

    /// Format category name for display (snake_case -> TITLE CASE)
    fn format_category(category: &str) -> String {
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
            _ => category.to_uppercase().replace('_', " "),
        }
    }
}
