//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{ComplianceGroupBy, GuiAgentStatus, GuiCheckStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

impl CompliancePage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Conformité"],
            "Conformité Réglementaire",
            Some("ANALYSE DES ÉCARTS ET MATRICE DE CONTRÔLES ISO 27001 / 27005"),
            Some(
                "Évaluez votre posture de sécurité par rapport aux référentiels ISO 27001/27005. Chaque contrôle indique son statut et propose des actions de remédiation directes.",
            ),
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
                        if is_scanning {
                            "SCAN EN COURS"
                        } else {
                            "LANCER L'AUDIT"
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
            } else {
                // Disabled button for non-admin users
                widgets::button::primary_button_loading(
                    ui,
                    format!("{}  {}", "LANCER L'AUDIT", icons::LOCK),
                    false,
                    false,
                );
            }
        });
        
        // Last audit timestamp
        if let Some(last_check) = state.summary.last_check_at {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!("Dernier audit : {}", last_check.format("%d/%m/%Y %H:%M")))
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
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
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                for fw in frameworks {
                    widgets::status_badge(ui, &fw.to_uppercase(), theme::INFO);
                    ui.add_space(theme::SPACE_XS);
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
                            .extra_letter_spacing(0.5)
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
                                widgets::status_badge(ui, fw, theme::ACCENT);
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
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                for fw in frameworks {
                    let fw_checks: Vec<&crate::dto::GuiCheckResult> = state
                        .checks
                        .iter()
                        .filter(|c| c.frameworks.iter().any(|f| f == fw))
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
                            egui::RichText::new(fw.to_uppercase())
                                .font(theme::font_label())
                                .color(theme::text_primary())
                                .extra_letter_spacing(0.5)
                                .strong(),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{:.0}% ({}/{})",
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
        let search_lower: String = ui.memory(|mem| {
            mem.data.get_temp::<(String, String)>(search_id)
                .filter(|(orig, _)| orig == &state.compliance.search)
                .map(|(_, lower)| lower)
        }).unwrap_or_else(|| {
            let lower = state.compliance.search.to_ascii_lowercase();
            ui.memory_mut(|mem| mem.data.insert_temp(search_id, (state.compliance.search.clone(), lower.clone())));
            lower
        });

        let filter_fp = (state.checks.len(), search_lower.clone(), state.compliance.status_filter, state.compliance.group_by.index());
        let filter_fp_id = ui.id().with("compliance_filter_fp");
        let filter_cache_id = ui.id().with("compliance_filter_cache");
        let prev_fp: Option<(usize, String, Option<GuiCheckStatus>, u8)> = ui.memory(|mem| mem.data.get_temp(filter_fp_id));
        let filtered: Vec<usize> = if prev_fp.as_ref() == Some(&filter_fp) {
            ui.memory(|mem| mem.data.get_temp(filter_cache_id)).unwrap_or_default()
        } else {
            let result: Vec<usize> = if search_lower.is_empty()
                && state.compliance.status_filter.is_none()
            {
                (0..state.checks.len()).collect()
            } else {
                state
                    .checks
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        if !search_lower.is_empty() {
                            let haystack = format!(
                                "{} {} {}",
                                c.name.to_ascii_lowercase(),
                                c.category.to_ascii_lowercase(),
                                c.check_id.to_ascii_lowercase()
                            );
                            if !haystack.contains(&search_lower) {
                                return false;
                            }
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
            "Rechercher un contrôle, un identifiant ou une catégorie...",
        )
        .chip("CONFORME", pass_active, theme::SUCCESS)
        .chip("DÉFAILLANT", fail_active, theme::ERROR)
        .chip("ERREUR", err_active, theme::WARNING)
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
        }

        ui.add_space(theme::SPACE_SM);

        // Group-by buttons (AAA Styling)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("STRUCTURE D'AFFICHAGE :")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            for (val, label) in [
                (ComplianceGroupBy::None, "LISTE PLATE"),
                (ComplianceGroupBy::Category, "PAR CATÉGORIE"),
                (ComplianceGroupBy::Framework, "PAR RÉFÉRENTIEL"),
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
                        state.push_toast(crate::widgets::toast::Toast::info("Export CSV en cours..."), ui.ctx());
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Check results table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("MATRICE DES CONTRÔLES D'AUDIT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
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
                        "OBJECTIF DE CONFORMITÉ ATTEINT",
                        "Tous les contrôles audités sont conformes aux référentiels actifs.",
                    );
                } else if state.checks.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "AUCUNE BASE DE CONTRÔLES",
                        Some(
                            "En attente de synchronisation des politiques avec le serveur central...",
                        ),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "AUCUN RÉSULTAT CORRESPONDANT",
                        Some("Modifiez vos critères de recherche ou de filtrage."),
                    );
                }
            } else if state.compliance.group_by == ComplianceGroupBy::None {
                ui.push_id("compliance_table_flat", |ui: &mut egui::Ui| {
                    Self::render_check_table(ui, state, &filtered, &mut command);
                });
            } else {
                let groups = Self::build_groups(state, &filtered);
                for (group_name, indices) in &groups {
                    let pass_count = indices
                        .iter()
                        .filter(|&&i| state.checks[i].status == GuiCheckStatus::Pass)
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
                                .extra_letter_spacing(0.5),
                        );
                        ui.add_space(theme::SPACE_SM);
                        let score_color = theme::score_color(pct);
                        widgets::status_badge(
                            ui,
                            &format!("{:.0}% CONFORMITÉ ({}/{})", pct, pass_count, total),
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

                let actions = vec![
                    widgets::DetailAction::primary("Relancer le contr\u{00f4}le", icons::PLAY),
                    widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
                ];

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
                            widgets::detail_field_colored(ui, "Score", &format!("{score}%"), theme::score_color(sc));
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
                            widgets::detail_mono(ui, "D\u{00e9}tails", &json_str);
                        }
                        if let Some(dt) = check.executed_at {
                            widgets::detail_field(ui, "Ex\u{00e9}cut\u{00e9} le", &dt.format("%d/%m/%Y %H:%M").to_string());
                        }
                    }, &actions);

                if let Some(action_idx) = drawer_action {
                    match action_idx {
                        0 => command = Some(GuiCommand::RunCheck),
                        1 => {
                            Self::export_csv(state, &[sel_idx]);
                            state.push_toast(crate::widgets::toast::Toast::info("Export CSV en cours..."), ui.ctx());
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
            let check = &state.checks[i];
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
        use egui_extras::{Column, TableBuilder};

        let mut clicked_idx: Option<usize> = None;
        let ctx = ui.ctx().clone();

        let table = TableBuilder::new(ui)
            .striped(false)
            .resizable(true)
            .sense(egui::Sense::click())
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
            .column(Column::initial(250.0).range(120.0..=600.0).at_least(150.0))
            .column(Column::initial(120.0).at_least(80.0))
            .column(Column::initial(110.0).at_least(90.0))
            .column(Column::initial(100.0).at_least(90.0))
            .column(Column::initial(60.0).at_least(50.0))
            .column(Column::remainder());

        table
            .header(30.0, |mut header| {
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("DÉSIGNATION DU POINT")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("DOMAINE")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("STATUT")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("IMPACT")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("TAUX")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("RÉFÉRENCES RÉGLEMENTAIRES")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                });
            })
            .body(|mut body| {
                for &idx in indices {
                    let check = &state.checks[idx];
                    let is_selected = state.compliance.selected_check == Some(idx);

                    body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&check.name)
                                    .font(theme::font_body())
                                    .color(theme::accent_text())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(Self::format_category(&check.category))
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) = Self::status_display(&check.status);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let color = theme::severity_color_typed(&check.severity);
                            ui.horizontal(|ui: &mut egui::Ui| {
                                ui.painter().circle_filled(
                                    ui.available_rect_before_wrap().min + egui::vec2(6.0, 10.0),
                                    3.0,
                                    color,
                                );
                                ui.add_space(14.0);
                                ui.label(
                                    egui::RichText::new(check.severity.label())
                                        .font(theme::font_label())
                                        .color(color)
                                        .strong(),
                                );
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            if let Some(s) = check.score {
                                ui.label(
                                    egui::RichText::new(format!("{:.0}%", s))
                                        .font(theme::font_body())
                                        .color(theme::readable_color(theme::score_color(s as f32)))
                                        .strong(),
                                );
                            } else {
                                ui.label(egui::RichText::new("--").color(theme::text_tertiary()));
                            }
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                                    for fw in &check.frameworks {
                                        widgets::status_badge(
                                            ui,
                                            fw,
                                            theme::INFO,
                                        );
                                        ui.add_space(theme::SPACE_XS);
                                    }
                                });
                                if let Some(dt) = check.executed_at {
                                    ui.label(
                                        egui::RichText::new(
                                            dt.format("%d/%m %H:%M").to_string(),
                                        )
                                        .font(theme::font_min())
                                        .color(theme::text_tertiary()),
                                    );
                                }
                            });
                        });

                        if row.response().clicked() {
                            clicked_idx = Some(idx);
                        }
                        if row.response().hovered() {
                            ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
                        }
                    });
                }
            });

        if let Some(idx) = clicked_idx {
            state.compliance.selected_check = Some(idx);
            state.compliance.detail_open = true;
        }
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let c = &state.checks[i];
                let (st, _) = Self::status_display(&c.status);
                vec![
                    c.check_id.clone(),
                    c.name.clone(),
                    c.category.clone(),
                    st.to_string(),
                    c.severity.as_str().to_string(),
                    c.score.map_or("--".into(), |s| format!("{}", s)),
                    c.frameworks.join(", "),
                ]
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
                        if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(true, "Export CSV réussi".to_string())) {
                            tracing::warn!("Failed to send CSV export success: {}", e);
                        }
                    }
                    Err(e) => {
                        if let Err(send_err) = tx.send(crate::app::AsyncTaskResult::CsvExport(false, format!("Échec export: {}", e))) {
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
            ui.label(
                egui::RichText::new(icon)
                    .color(color.linear_multiply(theme::OPACITY_STRONG))
                    .size(theme::ICON_INLINE),
            );
            ui.add_space(-4.0);
            ui.label(egui::RichText::new(value).color(color).strong());
            ui.add_space(-4.0);
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

