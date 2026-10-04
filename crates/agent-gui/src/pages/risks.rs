// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Risk management page — risk matrix, entries, and SLA tracking.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiCheckStatus, RiskEntry, RiskStatus, Severity};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Risk management page.
pub struct RisksPage;

impl RisksPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Conformité & risques", "Risques"],
            "Registre des Risques",
            Some("Matrice des risques et suivi des mesures d\u{2019}att\u{00e9}nuation."),
            Some(
                "\u{00c9}valuez et suivez vos risques de s\u{00e9}curit\u{00e9} selon une matrice probabilit\u{00e9}/impact. Identifiez les risques critiques, assignez des propri\u{00e9}taires et mesurez l\u{2019}avancement des plans d\u{2019}att\u{00e9}nuation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Summary cards
        let total = state.risks.entries.len();
        let open_count = state
            .risks
            .entries
            .iter()
            .filter(|r| r.status == RiskStatus::Open)
            .count();
        let critical_count = state
            .risks
            .entries
            .iter()
            .filter(|r| r.score() >= 16)
            .count();
        let now = chrono::Utc::now();
        let sla_overdue = state
            .risks
            .entries
            .iter()
            .filter(|r| {
                r.status == RiskStatus::Open
                    && r.sla_target_days
                        .map(|days| {
                            let elapsed =
                                now.signed_duration_since(r.created_at).num_days().max(0) as u32;
                            elapsed > days
                        })
                        .unwrap_or(false)
            })
            .count();

        let card_grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
        let items = vec![
            (
                "TOTAL",
                total.to_string(),
                theme::text_primary(),
                icons::SCALE_BALANCED,
            ),
            (
                "OUVERTS",
                open_count.to_string(),
                if open_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::WARNING,
            ),
            (
                "CRITIQUES",
                critical_count.to_string(),
                if critical_count > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_CRITICAL,
            ),
            (
                "SLA D\u{00c9}PASS\u{00c9}",
                sla_overdue.to_string(),
                if sla_overdue > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::CLOCK,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            if Self::summary_card(ui, width, label, value, *color, icon) {
                widgets::open_data_panel(ui.ctx(), "Registre des risques");
                state.risks.matrix_filter = None;
                state.risks.search.clear();
                state.risks.page = 0;
                state.risks.status_filter = if *label == "OUVERTS" {
                    Some(RiskStatus::Open)
                } else {
                    None
                };
                state.risks.critical_only = *label == "CRITIQUES";
                state.risks.overdue_only = *label == "SLA DÉPASSÉ";
            }
        });

        ui.add_space(theme::SPACE_MD);

        // The heat map is this page's summary: shown in its card, not folded
        // behind a bare collapsing header.
        Self::draw_risk_matrix(ui, state);
        ui.add_space(theme::SPACE_MD);

        if state.risks.critical_only || state.risks.overdue_only {
            let text = if state.risks.critical_only {
                "Risques critiques · Effacer le filtre"
            } else {
                "SLA dépassé · Effacer le filtre"
            };
            if widgets::chip_button(ui, text, true, theme::ACCENT).clicked() {
                state.risks.critical_only = false;
                state.risks.overdue_only = false;
                state.risks.page = 0;
            }
        }
        if let Some((probability, impact)) = state.risks.matrix_filter
            && widgets::chip_button(
                ui,
                &format!("Probabilité {probability} · Impact {impact} · Effacer"),
                true,
                theme::ACCENT,
            )
            .clicked()
        {
            state.risks.matrix_filter = None;
            state.risks.page = 0;
        }
        // Action bar
        ui.horizontal(|ui: &mut egui::Ui| {
            if state.security.admin_unlocked {
                if widgets::primary_button(
                    ui,
                    format!("{}  Générer automatiquement", icons::WAND_SPARKLES),
                    true,
                )
                .clicked()
                {
                    let before = state.risks.entries.len();
                    Self::auto_populate(state);
                    let added = state.risks.entries.len() - before;
                    // Save the first new risk to trigger backend persistence;
                    // remaining risks are auto-generated by the runtime after each scan.
                    if added > 0 {
                        command = Some(GuiCommand::SaveRisk {
                            risk: Box::new(state.risks.entries[before].clone()),
                        });
                    }
                    state.push_toast(
                        crate::widgets::toast::Toast::info(format!(
                            "{} risques auto-générés",
                            added
                        )),
                        ui.ctx(),
                    );
                }
            } else {
                widgets::primary_button(
                    ui,
                    format!("{}  Générer automatiquement · admin", icons::WAND_SPARKLES),
                    false,
                );
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::secondary_button(
                ui,
                format!("{}  Nouveau risque", icons::PLUS),
                state.security.admin_unlocked,
            )
            .clicked()
            {
                let new_risk = RiskEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    title: "Nouveau risque".to_string(),
                    description: String::new(),
                    probability: 3,
                    impact: 3,
                    owner: String::new(),
                    status: RiskStatus::Open,
                    mitigation: String::new(),
                    source: "manual".to_string(),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    sla_target_days: Some(30),
                };
                state.risks.entries.push(new_risk);
                let idx = state.risks.entries.len().saturating_sub(1);
                state.risks.selected_risk = Some(idx);
                state.risks.detail_open = true;
                state.risks.editing = true;
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let filtered = Self::filtered_indices(state);
                        Self::export_csv(state, &filtered);
                        state.push_toast(
                            crate::widgets::toast::Toast::info("Export CSV en cours…"),
                            ui.ctx(),
                        );
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Search + status filter
        let open_active = state.risks.status_filter == Some(RiskStatus::Open);
        let mit_active = state.risks.status_filter == Some(RiskStatus::Mitigating);
        let acc_active = state.risks.status_filter == Some(RiskStatus::Accepted);
        let closed_active = state.risks.status_filter == Some(RiskStatus::Closed);

        let filtered = Self::filtered_indices(state);
        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.risks.search,
            "Rechercher un risque par titre, propri\u{00e9}taire ou source…",
        )
        .chip("Ouvert", open_active, theme::WARNING)
        .chip("Att\u{00e9}nuation", mit_active, theme::INFO)
        .chip("Accept\u{00e9}", acc_active, theme::text_tertiary())
        .chip("Cl\u{00f4}tur\u{00e9}", closed_active, theme::SUCCESS)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some(RiskStatus::Open),
                1 => Some(RiskStatus::Mitigating),
                2 => Some(RiskStatus::Accepted),
                3 => Some(RiskStatus::Closed),
                _ => None,
            };
            if state.risks.status_filter == target {
                state.risks.status_filter = None;
            } else {
                state.risks.status_filter = target;
            }
        }

        ui.add_space(theme::SPACE_MD);

        // Risk table
        widgets::data_card(ui, "Registre des risques", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REGISTRE DES RISQUES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let filtered = Self::filtered_indices(state);

            if filtered.is_empty() {
                if state.risks.entries.is_empty() {
                    let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                        || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                        || state.sync.in_progress;

                    if is_loading {
                        ui.push_id("risks_skeletons", |ui: &mut egui::Ui| {
                            let cols = 4;
                            let column_widths = [ui.available_width() - 250.0, 60.0, 60.0, 80.0];
                            for _ in 0..5 {
                                crate::widgets::skeleton::skeleton_table_row(
                                    ui,
                                    cols,
                                    &column_widths,
                                );
                                ui.add_space(theme::SPACE_MD);
                            }
                        });
                    } else {
                        widgets::empty_state(
                            ui,
                            icons::SCALE_BALANCED,
                            "Aucun risque enregistr\u{00e9}",
                            Some(
                                "Utilisez \u{00ab} G\u{00e9}n\u{00e9}rer automatiquement \u{00bb} pour g\u{00e9}n\u{00e9}rer des risques depuis vos contr\u{00f4}les ou ajoutez-en manuellement.",
                            ),
                        );
                    }
                } else {
                    widgets::empty_state(
                        ui,
                        icons::SCALE_BALANCED,
                        "Aucun r\u{00e9}sultat",
                        Some("Modifiez vos crit\u{00e8}res de recherche ou de filtrage."),
                    );
                }
            } else {
                Self::render_risk_table(ui, state, &filtered, &mut command);
            }
        });

        ui.add_space(theme::SPACE_XL);

        // Detail drawer
        Self::detail_drawer(ui, state, &mut command);

        command
    }

    /// Draw the 5x5 risk matrix heatmap using the painter.
    fn draw_risk_matrix(ui: &mut Ui, state: &mut AppState) {
        widgets::data_card(ui, "Matrice des risques", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("MATRICE DE RISQUES (PROBABILIT\u{00c9} \u{00d7} IMPACT)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let cell_size = 48.0_f32;
            let label_margin = 40.0_f32;
            let total_width = label_margin + cell_size * 5.0 + theme::SPACE_SM;
            let total_height = label_margin + cell_size * 5.0 + theme::SPACE_SM;

            ui.horizontal_top(|ui: &mut egui::Ui| {
                let (rect, _) = ui.allocate_exact_size(
                    egui::vec2(total_width, total_height),
                    egui::Sense::hover(),
                );

                if ui.is_rect_visible(rect) {
                    let painter = ui.painter_at(rect);
                    let origin = rect.min + egui::vec2(label_margin, 0.0);

                    // Build count matrix [prob][impact] — indices 0..5 map to values 1..5
                    let mut counts = [[0_u32; 5]; 5];
                    for risk in &state.risks.entries {
                        let p = (risk.probability.clamp(1, 5) as usize).saturating_sub(1);
                        let i = (risk.impact.clamp(1, 5) as usize).saturating_sub(1);
                        counts[p][i] = counts[p][i].saturating_add(1);
                    }

                    // Y-axis label
                    painter.text(
                        egui::pos2(rect.min.x + 4.0, origin.y + cell_size * 2.5),
                        egui::Align2::LEFT_CENTER,
                        "P",
                        theme::font_label(),
                        theme::text_tertiary(),
                    );

                    // Draw cells (Y axis: probability 5 at top, 1 at bottom)
                    for (prob_idx, count_row) in counts.iter().enumerate() {
                        let display_row = 4_usize.saturating_sub(prob_idx); // row 0 = prob 5

                        // Y-axis tick
                        painter.text(
                            egui::pos2(
                                origin.x - theme::SPACE_SM,
                                origin.y + display_row as f32 * cell_size + cell_size * 0.5,
                            ),
                            egui::Align2::RIGHT_CENTER,
                            format!("{}", prob_idx + 1),
                            theme::font_label(),
                            theme::text_tertiary(),
                        );

                        for (impact_idx, count) in count_row.iter().enumerate() {
                            let score = (prob_idx + 1).saturating_mul(impact_idx + 1);
                            let color = Self::matrix_cell_color(score as u8);
                            let count = *count;
                            // Empty cells only hint at their band; a cell with
                            // risks in it is the one that should be seen.
                            let (fill, ring) = if count > 0 {
                                (
                                    theme::color_blend_pub(theme::bg_secondary(), color, 0.6),
                                    color,
                                )
                            } else {
                                (
                                    theme::color_blend_pub(theme::bg_secondary(), color, 0.18),
                                    theme::color_blend_pub(theme::bg_secondary(), color, 0.38),
                                )
                            };

                            let cell_rect = egui::Rect::from_min_size(
                                origin
                                    + egui::vec2(
                                        impact_idx as f32 * cell_size,
                                        display_row as f32 * cell_size,
                                    ),
                                egui::vec2(cell_size - 2.0, cell_size - 2.0),
                            );

                            let response = ui.interact(cell_rect, ui.id().with(("risk_cell", prob_idx, impact_idx)), egui::Sense::click())
                                .on_hover_cursor(egui::CursorIcon::PointingHand)
                                .on_hover_text(format!("Probabilité {} · Impact {} · {} risque(s) — ouvrir le registre", prob_idx + 1, impact_idx + 1, count));
                            response.widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, true, format!("Probabilité {}, impact {}, {} risques", prob_idx + 1, impact_idx + 1, count)));
                            if response.clicked() {
                                state.risks.search.clear();
                                state.risks.status_filter = None;
                                state.risks.critical_only = false;
                                state.risks.overdue_only = false;
                                state.risks.matrix_filter = Some(((prob_idx + 1) as u8, (impact_idx + 1) as u8));
                                state.risks.page = 0;
                                widgets::open_data_panel(ui.ctx(), "Registre des risques");
                            }
                            if response.has_focus() {
                                painter.rect_stroke(cell_rect.expand(2.0), theme::ROUNDING_SM as f32, theme::focus_ring(), egui::StrokeKind::Outside);
                            }
                            painter.rect_filled(
                                cell_rect,
                                egui::CornerRadius::same(theme::ROUNDING_SM),
                                fill,
                            );
                            painter.rect_stroke(
                                cell_rect,
                                egui::CornerRadius::same(theme::ROUNDING_SM),
                                egui::Stroke::new(theme::BORDER_THIN, ring),
                                egui::StrokeKind::Inside,
                            );

                            if count > 0 {
                                painter.text(
                                    cell_rect.center(),
                                    egui::Align2::CENTER_CENTER,
                                    count.to_string(),
                                    theme::font_body(),
                                    theme::text_primary(),
                                );
                            }
                        }
                    }

                    // X-axis labels
                    for impact_idx in 0..5_usize {
                        painter.text(
                            egui::pos2(
                                origin.x + impact_idx as f32 * cell_size + cell_size * 0.5,
                                origin.y + cell_size * 5.0 + theme::SPACE_XS,
                            ),
                            egui::Align2::CENTER_TOP,
                            format!("{}", impact_idx + 1),
                            theme::font_label(),
                            theme::text_tertiary(),
                        );
                    }

                    // X-axis label
                    painter.text(
                        egui::pos2(
                            origin.x + cell_size * 2.5,
                            origin.y + cell_size * 5.0 + theme::SPACE_MD + theme::SPACE_SM,
                        ),
                        egui::Align2::CENTER_TOP,
                        "Impact",
                        theme::font_label(),
                        theme::text_tertiary(),
                    );
                }

                ui.add_space(theme::SPACE_2XL);
                Self::matrix_legend(ui, state);
            });
        });
    }

    /// Beside the matrix: what each band means and how many open risks sit
    /// in it, then the open risks that score highest — the question the
    /// matrix is there to answer, without reading twenty-five cells.
    fn matrix_legend(ui: &mut Ui, state: &AppState) {
        const LEGEND_WIDTH: f32 = 320.0;
        const BANDS: [(&str, &str, u8, u8); 4] = [
            ("Critique", "16 \u{2013} 25", 16, 25),
            ("\u{00c9}lev\u{00e9}", "10 \u{2013} 15", 10, 15),
            ("Mod\u{00e9}r\u{00e9}", "5 \u{2013} 9", 5, 9),
            ("Faible", "1 \u{2013} 4", 1, 4),
        ];
        let open = |r: &&crate::dto::RiskEntry| {
            !matches!(
                r.status,
                crate::dto::RiskStatus::Closed | crate::dto::RiskStatus::Accepted
            )
        };

        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_max_width(LEGEND_WIDTH);
            // The matrix places every risk; these counts leave out accepted
            // and closed ones, and say so, or the two disagree on sight.
            ui.label(
                egui::RichText::new("NIVEAUX \u{00b7} RISQUES OUVERTS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);
            for (name, range, lo, hi) in BANDS {
                let count = state
                    .risks
                    .entries
                    .iter()
                    .filter(open)
                    .filter(|r| (lo..=hi).contains(&r.score()))
                    .count();
                let color = Self::matrix_cell_color(lo);
                ui.horizontal(|ui: &mut egui::Ui| {
                    let (swatch, _) = ui.allocate_exact_size(
                        egui::vec2(theme::ICON_XS, theme::ICON_XS),
                        egui::Sense::hover(),
                    );
                    ui.painter().rect_filled(
                        swatch,
                        egui::CornerRadius::same(3),
                        theme::color_blend_pub(theme::bg_secondary(), color, 0.6),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(name)
                            .font(theme::font_body_sm())
                            .color(theme::text_primary()),
                    );
                    ui.label(
                        egui::RichText::new(range)
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(crate::format::int(count))
                                    .font(theme::font_body_strong())
                                    .color(if count > 0 {
                                        theme::readable_color(color)
                                    } else {
                                        theme::text_tertiary()
                                    }),
                            );
                        },
                    );
                });
                ui.add_space(theme::SPACE_XS);
            }

            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new("\u{00c0} TRAITER EN PRIORIT\u{00c9}")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);
            let mut top: Vec<&crate::dto::RiskEntry> =
                state.risks.entries.iter().filter(open).collect();
            top.sort_by_key(|r| std::cmp::Reverse(r.score()));
            if top.is_empty() {
                ui.label(
                    egui::RichText::new("Aucun risque ouvert.")
                        .font(theme::font_body_sm())
                        .color(theme::text_tertiary()),
                );
            }
            for risk in top.iter().take(3) {
                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(
                        ui,
                        &risk.score().to_string(),
                        Self::matrix_cell_color(risk.score()),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.add(
                        egui::Label::new(
                            egui::RichText::new(&risk.title)
                                .font(theme::font_body_sm())
                                .color(theme::text_primary()),
                        )
                        .truncate(),
                    );
                });
                ui.add_space(theme::SPACE_XS);
            }
        });
    }

    fn matrix_cell_color(score: u8) -> egui::Color32 {
        if score >= 16 {
            theme::ERROR
        } else if score >= 10 {
            theme::SEVERITY_HIGH
        } else if score >= 5 {
            theme::WARNING
        } else {
            theme::SUCCESS
        }
    }

    fn filtered_indices(state: &AppState) -> Vec<usize> {
        let search_lower = state.risks.search.to_lowercase();
        state
            .risks
            .entries
            .iter()
            .enumerate()
            .filter(|(_, r)| {
                if state.risks.matrix_filter.is_some_and(|(p, i)| {
                    r.probability.clamp(1, 5) != p || r.impact.clamp(1, 5) != i
                }) {
                    return false;
                }
                if state.risks.critical_only && r.score() < 16 {
                    return false;
                }
                if state.risks.overdue_only
                    && !(r.status == RiskStatus::Open
                        && r.sla_target_days.is_some_and(|days| {
                            chrono::Utc::now()
                                .signed_duration_since(r.created_at)
                                .num_days()
                                .max(0)
                                > i64::from(days)
                        }))
                {
                    return false;
                }
                if !search_lower.is_empty()
                    && !r.title.to_lowercase().contains(&search_lower)
                    && !r.owner.to_lowercase().contains(&search_lower)
                    && !r.source.to_lowercase().contains(&search_lower)
                {
                    return false;
                }
                if let Some(filter) = &state.risks.status_filter {
                    r.status == *filter
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect()
    }

    fn render_risk_table(
        ui: &mut Ui,
        state: &mut AppState,
        indices: &[usize],
        _command: &mut Option<GuiCommand>,
    ) {
        let mut clicked_idx: Option<usize> = None;

        const RISKS_PER_PAGE: usize = 50;
        let (r_start, r_len, _) =
            widgets::page_window(indices.len(), RISKS_PER_PAGE, &mut state.risks.page);

        ui.push_id("risks_table", |ui: &mut egui::Ui| {
            use widgets::table;

            let selected = state.risks.selected_risk;

            table::fluid_clickable(
                ui,
                &[
                    table::Col::fluid(180.0, 3.0), // Titre
                    table::Col::fixed(64.0),       // Prob.
                    table::Col::fixed(64.0),       // Impact
                    table::Col::fixed(68.0),       // Score
                    table::Col::fluid(124.0, 0.0), // Statut: "ATTÉNUATION" whole
                    table::Col::fluid(120.0, 1.0), // Propriétaire
                    table::Col::fluid(90.0, 0.5),  // Date
                ],
            )
            .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                header.col(|ui| {
                    table::header_cell(ui, "TITRE");
                });
                header.col(|ui| {
                    table::header_cell_right(ui, "PROB.");
                });
                header.col(|ui| {
                    table::header_cell_right(ui, "IMPACT");
                });
                header.col(|ui| {
                    table::header_cell_right(ui, "SCORE");
                });
                header.col(|ui| {
                    table::header_cell(ui, "STATUT");
                });
                header.col(|ui| {
                    table::header_cell(ui, "PROPRI\u{00c9}TAIRE");
                });
                header.col(|ui| {
                    table::header_cell(ui, "DATE");
                });
            })
            .body(|body| {
                body.rows(theme::TABLE_ROW_HEIGHT, r_len, |mut row| {
                    let row_idx = r_start + row.index();
                    let Some(&real_idx) = indices.get(row_idx) else {
                        return;
                    };
                    let Some(risk) = state.risks.entries.get(real_idx) else {
                        return;
                    };
                    let is_selected = selected == Some(real_idx);
                    row.set_selected(is_selected);

                    let score = risk.score();
                    let score_color = Self::matrix_cell_color(score);
                    let (status_label, status_color) = Self::status_display(&risk.status);

                    row.col(|ui| {
                        if table::cell_link_text(ui, &risk.title).clicked() {
                            clicked_idx = Some(real_idx);
                        }
                    });

                    // Probability and impact as five dots: a 1-5 scale reads
                    // faster as a level than as a bare digit.
                    row.col(|ui| {
                        level_dots(ui, risk.probability);
                    });

                    row.col(|ui| {
                        level_dots(ui, risk.impact);
                    });

                    row.col(|ui| {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            table::cell_colored(
                                ui,
                                &score.to_string(),
                                theme::readable_color(score_color),
                            );
                        });
                    });

                    row.col(|ui| {
                        widgets::status_badge(ui, status_label, status_color);
                    });

                    row.col(|ui| {
                        if risk.owner.is_empty() {
                            table::cell_empty(ui);
                        } else {
                            table::cell_small(ui, &risk.owner);
                        }
                    });

                    row.col(|ui| {
                        table::cell_muted(ui, &risk.created_at.format("%d/%m/%Y").to_string());
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(real_idx);
                    }
                });
            });
        });

        if let Some(idx) = clicked_idx {
            state.risks.selected_risk = Some(idx);
            state.risks.detail_open = true;
            state.risks.editing = false;
        }

        // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
        // and the page follows the selection.
        let mut position = state
            .risks
            .selected_risk
            .and_then(|real| indices.iter().position(|&r| r == real));
        if widgets::navigate_list(
            ui.ctx(),
            &mut position,
            indices.len(),
            &mut state.risks.detail_open,
        ) && let Some(pos) = position
        {
            state.risks.selected_risk = Some(indices[pos]);
            state.risks.page = pos / RISKS_PER_PAGE;
        }

        widgets::paginate_controls(ui, indices.len(), RISKS_PER_PAGE, &mut state.risks.page);
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let selected = match state.risks.selected_risk {
            Some(idx) if idx < state.risks.entries.len() => idx,
            _ => return,
        };

        let risk = state.risks.entries[selected].clone();
        let score = risk.score();
        let score_color = Self::matrix_cell_color(score);
        let (status_label, status_color) = Self::status_display(&risk.status);
        let is_editing = state.risks.editing;

        let now = chrono::Utc::now();
        let is_saving = if let Some(until) = state.risks.saving_until {
            if now < until {
                true
            } else {
                state.risks.saving_until = None;
                state.risks.editing = false;
                false
            }
        } else {
            false
        };

        let actions = if is_editing {
            let mut save_action = widgets::DetailAction::primary("Enregistrer", icons::SAVE);
            save_action.loading = is_saving;

            vec![
                save_action,
                widgets::DetailAction::secondary("Annuler", icons::XMARK),
            ]
        } else {
            vec![
                widgets::DetailAction::primary("Modifier", icons::PENCIL),
                widgets::DetailAction::danger("Supprimer", icons::TRASH),
            ]
        };

        let ctx = ui.ctx().clone();
        let mut detail_open = state.risks.detail_open;

        let drawer_action =
            widgets::DetailDrawer::new("risk_detail", &risk.title, icons::SCALE_BALANCED)
                .accent(score_color)
                .subtitle(&format!("Score : {}", score))
                .show(
                    &ctx,
                    &mut detail_open,
                    |ui| {
                        if is_editing {
                            Self::render_edit_form(ui, state, selected);
                        } else {
                            widgets::detail_section(ui, "RISQUE");
                            widgets::detail_field(ui, "Titre", &risk.title);
                            widgets::detail_text(ui, "Description", &risk.description);
                            widgets::detail_field(
                                ui,
                                "Probabilit\u{00e9}",
                                &format!("{}/5", risk.probability),
                            );
                            widgets::detail_field(ui, "Impact", &format!("{}/5", risk.impact));
                            widgets::detail_field_colored(
                                ui,
                                "Score",
                                &format!("{}", score),
                                theme::readable_color(score_color),
                            );
                            widgets::detail_field_badge(ui, "Statut", status_label, status_color);

                            widgets::detail_section(ui, "GESTION");
                            let owner_display = if risk.owner.is_empty() {
                                "Non assign\u{00e9}"
                            } else {
                                &risk.owner
                            };
                            widgets::detail_field(ui, "Propri\u{00e9}taire", owner_display);
                            widgets::detail_field(ui, "Source", &risk.source);
                            if let Some(sla) = risk.sla_target_days {
                                widgets::detail_field(ui, "SLA cible", &format!("{} jours", sla));
                            }

                            widgets::detail_section(ui, "ATT\u{00c9}NUATION");
                            let mitigation_display = if risk.mitigation.is_empty() {
                                "Aucun plan d\u{00e9}fini"
                            } else {
                                &risk.mitigation
                            };
                            widgets::detail_text(ui, "Plan", mitigation_display);

                            // AI Risk Analysis section
                            widgets::detail_section(ui, "ANALYSE IA");
                            let is_analyzing = state.risks.ai_analyzing == Some(risk.id.clone());
                            if is_analyzing {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.spinner();
                                    ui.label(
                                        egui::RichText::new("  Analyse en cours…")
                                            .font(theme::font_small())
                                            .color(theme::text_secondary()),
                                    );
                                });
                            } else if widgets::secondary_button(
                                ui,
                                format!("{}  Analyser avec l\u{2019}IA", icons::BRAIN),
                                true,
                            )
                            .clicked()
                            {
                                state.risks.ai_analyzing = Some(risk.id.clone());
                                state.risks.ai_analysis_result = None;
                                state.risks.ai_mitigation_suggestions.clear();
                                *command = Some(GuiCommand::LlmAnalyzeRisk {
                                    risk_id: risk.id.to_string(),
                                    risk_title: risk.title.clone(),
                                    risk_description: risk.description.clone(),
                                    current_probability: risk.probability,
                                    current_impact: risk.impact,
                                });
                            }

                            // Display AI analysis result if available
                            if let Some(ref analysis_text) = state.risks.ai_analysis_result {
                                ui.add_space(theme::SPACE_XS);
                                widgets::detail_text(ui, "R\u{00e9}sultat", analysis_text);
                                if !state.risks.ai_mitigation_suggestions.is_empty() {
                                    ui.add_space(theme::SPACE_XS);
                                    ui.label(
                                        egui::RichText::new("Suggestions de mitigation :")
                                            .font(theme::font_label())
                                            .color(theme::text_tertiary())
                                            .strong(),
                                    );
                                    for suggestion in &state.risks.ai_mitigation_suggestions {
                                        ui.horizontal(|ui: &mut egui::Ui| {
                                            ui.label(
                                                egui::RichText::new(format!(
                                                    "  \u{2022} {}",
                                                    suggestion
                                                ))
                                                .font(theme::font_small())
                                                .color(theme::text_secondary()),
                                            );
                                        });
                                    }
                                }
                            }

                            widgets::detail_section(ui, "TEMPORALIT\u{00c9}");
                            widgets::detail_field(
                                ui,
                                "Cr\u{00e9}\u{00e9} le",
                                &risk.created_at.format("%d/%m/%Y %H:%M").to_string(),
                            );
                            widgets::detail_field(
                                ui,
                                "Mis \u{00e0} jour le",
                                &risk.updated_at.format("%d/%m/%Y %H:%M").to_string(),
                            );
                        }
                    },
                    &actions,
                );

        state.risks.detail_open = detail_open;

        if let Some(action_idx) = drawer_action {
            if state.risks.editing {
                // Ignore clicks if we are already saving
                if is_saving {
                    return;
                }

                match action_idx {
                    0 => {
                        // Save - start saving state
                        state.risks.saving_until = Some(now + chrono::Duration::milliseconds(650));

                        if selected < state.risks.entries.len() {
                            state.risks.entries[selected].updated_at = chrono::Utc::now();
                            let saved = state.risks.entries[selected].clone();
                            *command = Some(GuiCommand::SaveRisk {
                                risk: Box::new(saved.clone()),
                            });
                            // Audit trail - record the UI action
                            state.logs.push_front(crate::dto::GuiLogEntry {
                                id: uuid::Uuid::new_v4(),
                                level: "INFO".to_string(),
                                message: format!("Modification locale du risque: {}", saved.title),
                                source: Some("GUI".to_string()),
                                timestamp: chrono::Utc::now(),
                            });
                            if state.logs.len() > 1000 {
                                state.logs.pop_back();
                            }

                            let time = ui.input(|i| i.time);
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Risque sauvegard\u{00e9} localement",
                                )
                                .with_time(time),
                            );
                        }
                    }
                    1 => {
                        // Cancel
                        state.risks.editing = false;
                        state.risks.saving_until = None;
                    }
                    _ => {}
                }
            } else {
                match action_idx {
                    0 => {
                        // Edit
                        state.risks.editing = true;
                    }
                    1
                        // Delete
                        if selected < state.risks.entries.len() => {
                            let id = state.risks.entries[selected].id.to_string();
                            state.risks.entries.remove(selected);
                            state.risks.selected_risk = None;
                            state.risks.detail_open = false;
                            *command = Some(GuiCommand::DeleteRisk { risk_id: id });
                        }
                    _ => {}
                }
            }
        }
    }

    fn render_edit_form(ui: &mut Ui, state: &mut AppState, idx: usize) {
        if idx >= state.risks.entries.len() {
            return;
        }

        widgets::detail_section(ui, "MODIFIER LE RISQUE");

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Titre")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });
        ui.add(
            egui::TextEdit::singleline(&mut state.risks.entries[idx].title)
                .desired_width(f32::INFINITY),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Description")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });
        ui.add(
            egui::TextEdit::multiline(&mut state.risks.entries[idx].description)
                .desired_width(f32::INFINITY)
                .desired_rows(3),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Probabilit\u{00e9} (1-5)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            let mut prob_val = state.risks.entries[idx].probability as i32;
            ui.add(egui::DragValue::new(&mut prob_val).range(1..=5).speed(0.1));
            state.risks.entries[idx].probability = (prob_val.clamp(1, 5)) as u8;
        });
        ui.add_space(theme::SPACE_XS);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Impact (1-5)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            let mut impact_val = state.risks.entries[idx].impact as i32;
            ui.add(
                egui::DragValue::new(&mut impact_val)
                    .range(1..=5)
                    .speed(0.1),
            );
            state.risks.entries[idx].impact = (impact_val.clamp(1, 5)) as u8;
        });
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Propri\u{00e9}taire")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });
        ui.add(
            egui::TextEdit::singleline(&mut state.risks.entries[idx].owner)
                .desired_width(f32::INFINITY),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Statut")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            for status in RiskStatus::all() {
                let active = state.risks.entries[idx].status == *status;
                if widgets::chip_button(ui, status.label_fr(), active, theme::ACCENT).clicked() {
                    state.risks.entries[idx].status = *status;
                }
            }
        });
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("Plan d\u{2019}att\u{00e9}nuation")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        });
        ui.add(
            egui::TextEdit::multiline(&mut state.risks.entries[idx].mitigation)
                .desired_width(f32::INFINITY)
                .desired_rows(3),
        );
    }

    /// Auto-populate risks from failing checks, critical vulnerabilities, and high-confidence threats.
    fn auto_populate(state: &mut AppState) {
        let existing_titles: std::collections::HashSet<String> = state
            .risks
            .entries
            .iter()
            .map(|r| r.title.clone())
            .collect();

        let now = chrono::Utc::now();
        let max_entries = 200_usize;

        // From failing compliance checks (Critical/High severity)
        for check in &state.checks {
            if state.risks.entries.len() >= max_entries {
                break;
            }
            if check.status != GuiCheckStatus::Fail {
                continue;
            }
            if check.severity != Severity::Critical && check.severity != Severity::High {
                continue;
            }
            let title = format!("Contr\u{00f4}le d\u{00e9}faillant : {}", check.name);
            if existing_titles.contains(&title) {
                continue;
            }
            let (prob, impact) = match check.severity {
                Severity::Critical => (4_u8, 5_u8),
                Severity::High => (3, 4),
                _ => (2, 3),
            };
            state.risks.entries.push(RiskEntry {
                id: uuid::Uuid::new_v4().to_string(),
                title,
                description: check.message.clone().unwrap_or_else(|| {
                    "D\u{00e9}tect\u{00e9} par audit de conformit\u{00e9}".to_string()
                }),
                probability: prob,
                impact,
                owner: String::new(),
                status: RiskStatus::Open,
                mitigation: String::new(),
                source: "compliance".to_string(),
                created_at: now,
                updated_at: now,
                sla_target_days: Some(30),
            });
        }

        // From critical vulnerabilities
        for vuln in &state.vulnerability_findings {
            if state.risks.entries.len() >= max_entries {
                break;
            }
            if vuln.severity != Severity::Critical {
                continue;
            }
            let title = format!(
                "Vuln\u{00e9}rabilit\u{00e9} : {} ({})",
                vuln.cve_id, vuln.affected_software
            );
            if existing_titles.contains(&title) {
                continue;
            }
            state.risks.entries.push(RiskEntry {
                id: uuid::Uuid::new_v4().to_string(),
                title,
                description: vuln.description.clone(),
                probability: 4,
                impact: 5,
                owner: String::new(),
                status: RiskStatus::Open,
                mitigation: if vuln.fix_available {
                    "Correctif disponible".to_string()
                } else {
                    String::new()
                },
                source: "vulnerability".to_string(),
                created_at: now,
                updated_at: now,
                sla_target_days: Some(14),
            });
        }

        // From high-confidence threats
        for proc in &state.threats.suspicious_processes {
            if state.risks.entries.len() >= max_entries {
                break;
            }
            if proc.confidence < 80 {
                continue;
            }
            let title = format!(
                "Menace : processus suspect \u{00ab} {} \u{00bb}",
                proc.process_name
            );
            if existing_titles.contains(&title) {
                continue;
            }
            state.risks.entries.push(RiskEntry {
                id: uuid::Uuid::new_v4().to_string(),
                title,
                description: proc.reason.clone(),
                probability: 3,
                impact: 4,
                owner: String::new(),
                status: RiskStatus::Open,
                mitigation: String::new(),
                source: "threat".to_string(),
                created_at: now,
                updated_at: now,
                sla_target_days: Some(7),
            });
        }
    }

    fn status_display(status: &RiskStatus) -> (&'static str, egui::Color32) {
        match status {
            RiskStatus::Open => ("OUVERT", theme::WARNING),
            RiskStatus::Mitigating => ("ATT\u{00c9}NUATION", theme::INFO),
            RiskStatus::Accepted => ("ACCEPT\u{00c9}", theme::text_tertiary()),
            RiskStatus::Closed => ("CL\u{00d4}TUR\u{00c9}", theme::SUCCESS),
        }
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) -> bool {
        let mut clicked = false;
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            clicked = widgets::clickable_card(ui, label, |ui: &mut egui::Ui| {
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
            })
            .on_hover_text("Afficher les éléments correspondants")
            .clicked();
        });
        clicked
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let r = state.risks.entries.get(i)?;
                Some(vec![
                    r.title.clone(),
                    r.probability.to_string(),
                    r.impact.to_string(),
                    r.score().to_string(),
                    r.status.label_fr().to_string(),
                    r.owner.clone(),
                    r.source.clone(),
                    r.created_at.format("%d/%m/%Y").to_string(),
                ])
            })
            .collect();

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "titre",
                    "probabilite",
                    "impact",
                    "score",
                    "statut",
                    "proprietaire",
                    "source",
                    "date",
                ];
                let path = crate::export::default_export_path("risques.csv");
                match crate::export::export_csv(headers, &rows, &path) {
                    Ok(()) => {
                        if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            true,
                            "Export CSV risques r\u{00e9}ussi".to_string(),
                        )) {
                            tracing::warn!("Failed to send CSV export success: {}", e);
                        }
                    }
                    Err(e) => {
                        if let Err(send_err) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            false,
                            format!("\u{00c9}chec export : {}", e),
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
}

/// A 1-5 level as five dots, filled up to the level and coloured by it.
fn level_dots(ui: &mut Ui, level: u8) {
    let level = level.clamp(0, 5);
    let color = theme::readable_color(match level {
        5 => theme::ERROR,
        4 => theme::SEVERITY_HIGH,
        3 => theme::SEVERITY_MEDIUM,
        _ => theme::INFO,
    });
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(5.0 * 9.0, 16.0), egui::Sense::hover());
    if ui.is_rect_visible(rect) {
        for i in 0..5_u8 {
            let center = egui::pos2(rect.left() + 4.0 + f32::from(i) * 9.0, rect.center().y);
            if i < level {
                ui.painter().circle_filled(center, 3.0, color);
            } else {
                ui.painter()
                    .circle_filled(center, 3.0, theme::bg_tertiary());
            }
        }
    }
    response.on_hover_text(format!("{level} / 5"));
}

#[cfg(test)]
mod interaction_tests {
    use super::*;

    fn risk(probability: u8, impact: u8, status: RiskStatus, age: i64) -> RiskEntry {
        let date = chrono::Utc::now() - chrono::Duration::days(age);
        RiskEntry {
            id: format!("{probability}-{impact}-{age}"),
            title: "Risque de test".into(),
            description: String::new(),
            probability,
            impact,
            owner: String::new(),
            status,
            mitigation: String::new(),
            source: "manual".into(),
            created_at: date,
            updated_at: date,
            sla_target_days: Some(30),
        }
    }

    #[test]
    fn metric_and_matrix_filters_select_the_underlying_risks() {
        let mut state = AppState::default();
        state.risks.entries = vec![
            risk(5, 5, RiskStatus::Open, 35),
            risk(2, 3, RiskStatus::Open, 30),
            risk(5, 4, RiskStatus::Closed, 40),
        ];
        state.risks.critical_only = true;
        assert_eq!(RisksPage::filtered_indices(&state), vec![0, 2]);
        state.risks.critical_only = false;
        state.risks.overdue_only = true;
        assert_eq!(RisksPage::filtered_indices(&state), vec![0]);
        state.risks.overdue_only = false;
        state.risks.matrix_filter = Some((2, 3));
        assert_eq!(RisksPage::filtered_indices(&state), vec![1]);
        state.risks.matrix_filter = Some((1, 1));
        assert!(RisksPage::filtered_indices(&state).is_empty());
        state.risks.matrix_filter = None;
        assert_eq!(RisksPage::filtered_indices(&state), vec![0, 1, 2]);
    }
}
