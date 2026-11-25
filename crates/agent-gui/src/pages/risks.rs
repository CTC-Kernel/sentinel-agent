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

/// Name the sort of the register table is kept under.
const REGISTER_TABLE: &str = "risk_register";

/// Confirmation dialog for deleting a risk.
const DELETE_CONFIRM: &str = "risk_delete_confirm";

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
            // Writing the register is an administrator action. Locked, the
            // buttons stay clickable and ask for the password.
            let unlocked = state.security.admin_unlocked;
            let lock = if unlocked {
                String::new()
            } else {
                format!("  {}", icons::LOCK)
            };
            let generate = widgets::primary_button(
                ui,
                format!("{}  Générer automatiquement{lock}", icons::WAND_SPARKLES),
                true,
            )
            .on_hover_text(
                "Propose des risques à partir des vulnérabilités, menaces et contrôles \
                 en échec. Nécessite le mode administrateur.",
            );
            if generate.clicked() && state.require_admin("Générer des risques automatiquement") {
                let before = state.risks.entries.len();
                Self::auto_populate(state);
                // Every generated risk is stored: the runtime only derives
                // the compliance ones by itself.
                let added: Vec<RiskEntry> = state.risks.entries[before..].to_vec();
                let toast = if added.is_empty() {
                    crate::widgets::toast::Toast::info("Aucun nouveau risque à générer")
                } else {
                    crate::widgets::toast::Toast::success(format!(
                        "{} généré{}",
                        crate::format::count(added.len(), "risque"),
                        crate::format::plural_suffix(added.len())
                    ))
                };
                if !added.is_empty() {
                    command = Some(GuiCommand::SaveRisks { risks: added });
                }
                state.push_toast(toast, ui.ctx());
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::secondary_button(ui, format!("{}  Nouveau risque{lock}", icons::PLUS), true)
                .clicked()
                && state.require_admin("Ajouter un risque au registre")
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
                // A draft: the register only gains the risk once it is saved.
                state.risks.draft = Some(new_risk);
                state.risks.draft_is_new = true;
                state.risks.detail_open = true;
                state.risks.editing = true;
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        // The export follows the order on screen.
                        let filtered = Self::displayed_indices(ui.ctx(), state);
                        Self::export_csv(state, &filtered);
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
            state.risks.page = 0;
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

            let filtered = Self::displayed_indices(ui.ctx(), state);

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
                    && !source_label(&r.source)
                        .to_lowercase()
                        .contains(&search_lower)
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

    /// The filtered risks in the order the sorted column asks for; the
    /// register order without a sort. Stable.
    fn displayed_indices(ctx: &egui::Context, state: &AppState) -> Vec<usize> {
        let sort = widgets::table::sort_of(ctx, REGISTER_TABLE);
        Self::sorted(state, Self::filtered_indices(state), &sort)
    }

    fn sorted(
        state: &AppState,
        mut indices: Vec<usize>,
        sort: &widgets::data_table::TableSort,
    ) -> Vec<usize> {
        if let Some(key) = widgets::table::sort_key(sort) {
            let entries = &state.risks.entries;
            indices.sort_by(|&a, &b| match (entries.get(a), entries.get(b)) {
                (Some(a), Some(b)) => widgets::table::directed(sort, compare_risks(key, a, b)),
                _ => std::cmp::Ordering::Equal,
            });
        }
        indices
    }

    fn render_risk_table(
        ui: &mut Ui,
        state: &mut AppState,
        indices: &[usize],
        _command: &mut Option<GuiCommand>,
    ) {
        let mut clicked_idx: Option<usize> = None;
        let mut sort_changed = false;

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
                for (label, key) in [
                    ("TITRE", "title"),
                    ("PROB.", "probability"),
                    ("IMPACT", "impact"),
                    ("SCORE", "score"),
                    ("STATUT", "status"),
                    ("PROPRI\u{00c9}TAIRE", "owner"),
                    ("DATE", "created"),
                ] {
                    header.col(|ui| {
                        sort_changed |= table::header_cell_sortable(ui, label, REGISTER_TABLE, key);
                    });
                }
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
                        table::cell_muted(ui, &crate::format::local_date(risk.created_at));
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(real_idx);
                    }
                });
            });
        });

        if sort_changed {
            state.risks.page = 0;
        }
        if let Some(idx) = clicked_idx {
            state.risks.selected_risk = Some(idx);
            state.risks.detail_open = true;
            Self::discard_draft(state);
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

    /// Drop the form being filled, leaving the register untouched.
    fn discard_draft(state: &mut AppState) {
        state.risks.editing = false;
        state.risks.draft = None;
        state.risks.draft_is_new = false;
    }

    /// Write the form to the register and return the command storing it.
    /// Nothing is saved while the title is blank.
    fn save_draft(state: &mut AppState, ctx: &egui::Context) -> Option<GuiCommand> {
        let mut saved = state.risks.draft.take()?;
        saved.title = saved.title.trim().to_string();
        if saved.title.is_empty() {
            state.risks.draft = Some(saved);
            return None;
        }
        saved.updated_at = chrono::Utc::now();
        let is_new = state.risks.draft_is_new;
        match state.risks.entries.iter().position(|r| r.id == saved.id) {
            Some(idx) => {
                state.risks.entries[idx] = saved.clone();
                state.risks.selected_risk = Some(idx);
            }
            None => {
                state.risks.entries.push(saved.clone());
                state.risks.selected_risk = Some(state.risks.entries.len() - 1);
            }
        }
        Self::discard_draft(state);

        // Audit trail - record the UI action
        state.logs.push_front(crate::dto::GuiLogEntry {
            id: uuid::Uuid::new_v4(),
            level: "info".to_string(),
            message: if is_new {
                format!("Risque ajout\u{00e9} au registre : {}", saved.title)
            } else {
                format!("Risque modifi\u{00e9} : {}", saved.title)
            },
            source: Some("Interface".to_string()),
            timestamp: chrono::Utc::now(),
        });
        state.logs.truncate(1000);
        state.push_toast(
            crate::widgets::toast::Toast::success("Risque enregistr\u{00e9}"),
            ctx,
        );
        Some(GuiCommand::SaveRisk {
            risk: Box::new(saved),
        })
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        // A form whose drawer was closed is abandoned, like "Annuler".
        if state.risks.editing && (!state.risks.detail_open || state.risks.draft.is_none()) {
            Self::discard_draft(state);
        }
        let is_editing = state.risks.editing;
        let selected = state
            .risks
            .selected_risk
            .filter(|&idx| idx < state.risks.entries.len());
        let risk = match (&state.risks.draft, selected) {
            (Some(draft), _) if is_editing => draft.clone(),
            (_, Some(idx)) => state.risks.entries[idx].clone(),
            _ => return,
        };
        let score = risk.score();
        let score_color = Self::matrix_cell_color(score);
        let (status_label, status_color) = Self::status_display(&risk.status);

        let actions = if is_editing {
            vec![
                widgets::DetailAction::primary("Enregistrer", icons::SAVE)
                    .enabled(!risk.title.trim().is_empty()),
                widgets::DetailAction::secondary("Annuler", icons::XMARK),
            ]
        } else {
            vec![
                widgets::DetailAction::primary("Modifier", icons::PENCIL),
                widgets::DetailAction::danger("Supprimer", icons::TRASH),
            ]
        };
        let drawer_title = if risk.title.trim().is_empty() {
            "Nouveau risque"
        } else {
            risk.title.as_str()
        };

        let ctx = ui.ctx().clone();
        let mut detail_open = state.risks.detail_open;

        let drawer_action = widgets::DetailDrawer::new(
            "risk_detail",
            drawer_title,
            icons::SCALE_BALANCED,
        )
        .accent(score_color)
        .subtitle(&format!("Score : {}", score))
        .show(
            &ctx,
            &mut detail_open,
            |ui| {
                if is_editing {
                    Self::render_edit_form(ui, state);
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
                    widgets::detail_field(ui, "Source", source_label(&risk.source));
                    if let Some(sla) = risk.sla_target_days {
                        widgets::detail_field(ui, "SLA cible", &crate::format::count(sla, "jour"));
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
                    let is_analyzing =
                        state.risks.ai_analyzing.as_deref() == Some(risk.id.as_str());
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
                        state.risks.ai_analysis_for = None;
                        state.risks.ai_analysis_result = None;
                        state.risks.ai_suggested_scores = None;
                        state.risks.ai_mitigation_suggestions.clear();
                        *command = Some(GuiCommand::LlmAnalyzeRisk {
                            risk_id: risk.id.to_string(),
                            risk_title: risk.title.clone(),
                            risk_description: risk.description.clone(),
                            current_probability: risk.probability,
                            current_impact: risk.impact,
                        });
                    }

                    // The analysis is shown on the risk it is about only.
                    let analysis = state.risks.ai_analysis_result.clone().filter(|_| {
                        state.risks.ai_analysis_for.as_deref() == Some(risk.id.as_str())
                    });
                    if let Some(analysis_text) = analysis {
                        ui.add_space(theme::SPACE_XS);
                        widgets::detail_text(ui, "R\u{00e9}sultat", &analysis_text);
                        if let Some((probability, impact)) = state.risks.ai_suggested_scores {
                            widgets::detail_field(
                                ui,
                                "Scores sugg\u{00e9}r\u{00e9}s",
                                &format!(
                                    "Probabilit\u{00e9} {probability}/5 \u{00b7} Impact {impact}/5"
                                ),
                            );
                            if widgets::secondary_button(
                                ui,
                                format!(
                                    "{}  Appliquer les scores sugg\u{00e9}r\u{00e9}s",
                                    icons::CIRCLE_CHECK
                                ),
                                true,
                            )
                            .clicked()
                                && state.require_admin("Modifier les scores d\u{2019}un risque")
                                && let Some(saved) = Self::apply_suggested_scores(
                                    state,
                                    &risk.id,
                                    probability,
                                    impact,
                                )
                            {
                                *command = Some(saved);
                            }
                        }
                        if !state.risks.ai_mitigation_suggestions.is_empty() {
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new(
                                    "Mesures d\u{2019}att\u{00e9}nuation sugg\u{00e9}r\u{00e9}es :",
                                )
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                            );
                            for suggestion in &state.risks.ai_mitigation_suggestions {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(format!("  \u{2022} {}", suggestion))
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
                        &crate::format::local_datetime(risk.created_at),
                    );
                    widgets::detail_field(
                        ui,
                        "Mis \u{00e0} jour le",
                        &crate::format::local_datetime(risk.updated_at),
                    );
                }
            },
            &actions,
        );

        state.risks.detail_open = detail_open;

        if let Some(action_idx) = drawer_action {
            if is_editing {
                match action_idx {
                    0 => {
                        if let Some(saved) = Self::save_draft(state, ui.ctx()) {
                            *command = Some(saved);
                        }
                    }
                    1 => {
                        // Cancel: a risk that was never saved has nothing to show.
                        if state.risks.draft_is_new {
                            state.risks.detail_open = false;
                        }
                        Self::discard_draft(state);
                    }
                    _ => {}
                }
            } else {
                match action_idx {
                    // Edit: writing the register is an administrator action.
                    0 if state.require_admin("Modifier un risque du registre") => {
                        state.risks.draft = Some(risk.clone());
                        state.risks.draft_is_new = false;
                        state.risks.editing = true;
                    }
                    // Delete: administrator mode, then a confirmation.
                    1 if state.require_admin("Supprimer un risque du registre") => {
                        widgets::modal::ask_confirmation(
                            ui.ctx(),
                            DELETE_CONFIRM,
                            risk.id.to_string(),
                        );
                    }
                    _ => {}
                }
            }
        }

        if let Some(id) = widgets::modal::pending_confirmation::<String>(ui.ctx(), DELETE_CONFIRM) {
            let title = state
                .risks
                .entries
                .iter()
                .find(|r| r.id == id)
                .map_or_else(|| id.clone(), |r| r.title.clone());
            if widgets::modal::resolve_confirmation::<String>(
                ui.ctx(),
                DELETE_CONFIRM,
                "Supprimer le risque ?",
                &format!(
                    "« {title} » sera retiré du registre de ce poste et de la plateforme. \
                     Pour garder une trace, préférez le statut « Clôturé »."
                ),
                "Supprimer",
            ) {
                state.risks.entries.retain(|r| r.id != id);
                state.risks.selected_risk = None;
                state.risks.detail_open = false;
                *command = Some(GuiCommand::DeleteRisk { risk_id: id });
            }
        }
    }

    /// Set the scores the analysis suggested on its risk and return the
    /// command storing the change.
    fn apply_suggested_scores(
        state: &mut AppState,
        risk_id: &str,
        probability: u8,
        impact: u8,
    ) -> Option<GuiCommand> {
        let entry = state.risks.entries.iter_mut().find(|r| r.id == risk_id)?;
        entry.probability = probability.clamp(1, 5);
        entry.impact = impact.clamp(1, 5);
        entry.updated_at = chrono::Utc::now();
        let saved = entry.clone();
        state.risks.ai_suggested_scores = None;
        Some(GuiCommand::SaveRisk {
            risk: Box::new(saved),
        })
    }

    fn render_edit_form(ui: &mut Ui, state: &mut AppState) {
        let is_new = state.risks.draft_is_new;
        let Some(draft) = state.risks.draft.as_mut() else {
            return;
        };
        let field_label = |ui: &mut Ui, text: &str| {
            ui.label(
                egui::RichText::new(text)
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        };

        widgets::detail_section(
            ui,
            if is_new {
                "NOUVEAU RISQUE"
            } else {
                "MODIFIER LE RISQUE"
            },
        );

        field_label(ui, "Titre");
        ui.add(egui::TextEdit::singleline(&mut draft.title).desired_width(f32::INFINITY));
        if draft.title.trim().is_empty() {
            ui.label(
                egui::RichText::new("Le titre est obligatoire.")
                    .font(theme::font_small())
                    .color(theme::readable_color(theme::ERROR)),
            );
        }
        ui.add_space(theme::SPACE_SM);

        field_label(ui, "Description");
        ui.add(
            egui::TextEdit::multiline(&mut draft.description)
                .desired_width(f32::INFINITY)
                .desired_rows(3),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            field_label(ui, "Probabilit\u{00e9} (1-5)");
            let mut value = i32::from(draft.probability);
            ui.add(egui::DragValue::new(&mut value).range(1..=5).speed(0.1));
            draft.probability = value.clamp(1, 5) as u8;
        });
        ui.add_space(theme::SPACE_XS);

        ui.horizontal(|ui: &mut egui::Ui| {
            field_label(ui, "Impact (1-5)");
            let mut value = i32::from(draft.impact);
            ui.add(egui::DragValue::new(&mut value).range(1..=5).speed(0.1));
            draft.impact = value.clamp(1, 5) as u8;
        });
        ui.add_space(theme::SPACE_SM);

        field_label(ui, "Propri\u{00e9}taire");
        ui.add(egui::TextEdit::singleline(&mut draft.owner).desired_width(f32::INFINITY));
        ui.add_space(theme::SPACE_SM);

        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            field_label(ui, "Statut");
            for status in RiskStatus::all() {
                let active = draft.status == *status;
                if widgets::chip_button(ui, status.label_fr(), active, theme::ACCENT).clicked() {
                    draft.status = *status;
                }
            }
        });
        ui.add_space(theme::SPACE_SM);

        // The delay the "SLA dépassé" count is measured against.
        ui.horizontal(|ui: &mut egui::Ui| {
            field_label(ui, "SLA cible (jours)");
            let mut days = draft.sla_target_days.unwrap_or(30).clamp(1, 365);
            ui.add(egui::DragValue::new(&mut days).range(1..=365).speed(0.5));
            draft.sla_target_days = Some(days.clamp(1, 365));
        });
        ui.add_space(theme::SPACE_SM);

        field_label(ui, "Plan d\u{2019}att\u{00e9}nuation");
        ui.add(
            egui::TextEdit::multiline(&mut draft.mitigation)
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
        widgets::metric_card(ui, width, label, value, color, icon)
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let r = state.risks.entries.get(i)?;
                Some(vec![
                    r.id.to_string(),
                    r.title.clone(),
                    r.description.clone(),
                    r.probability.to_string(),
                    r.impact.to_string(),
                    r.score().to_string(),
                    r.status.label_fr().to_string(),
                    r.owner.clone(),
                    source_label(&r.source).to_string(),
                    r.mitigation.clone(),
                    r.sla_target_days.map(|d| d.to_string()).unwrap_or_default(),
                    crate::format::local_datetime(r.created_at),
                    crate::format::local_datetime(r.updated_at),
                ])
            })
            .collect();

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "identifiant",
                    "titre",
                    "description",
                    "probabilite",
                    "impact",
                    "score",
                    "statut",
                    "proprietaire",
                    "source",
                    "plan_attenuation",
                    "sla_jours",
                    "cree_le",
                    "mis_a_jour_le",
                ];
                let result = match crate::export::export_csv_timestamped("risques", headers, &rows)
                {
                    Ok(path) => (
                        true,
                        format!("Registre des risques export\u{00e9} : {}", path.display()),
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
}

/// Rank of a status for sorting, along the life of a risk.
fn status_rank(status: RiskStatus) -> u8 {
    match status {
        RiskStatus::Open => 0,
        RiskStatus::Mitigating => 1,
        RiskStatus::Accepted => 2,
        RiskStatus::Closed => 3,
    }
}

/// Natural (ascending) order of two risks on the column `key`.
fn compare_risks(key: &str, a: &RiskEntry, b: &RiskEntry) -> std::cmp::Ordering {
    let text = |a: &str, b: &str| a.to_lowercase().cmp(&b.to_lowercase());
    match key {
        "title" => text(&a.title, &b.title),
        "probability" => a.probability.cmp(&b.probability),
        "impact" => a.impact.cmp(&b.impact),
        "score" => a.score().cmp(&b.score()),
        "status" => status_rank(a.status).cmp(&status_rank(b.status)),
        "owner" => text(&a.owner, &b.owner),
        "created" => a.created_at.cmp(&b.created_at),
        _ => std::cmp::Ordering::Equal,
    }
}

/// What a risk came from, in French. The stored value stays the identifier
/// the runtime and the platform exchange.
fn source_label(source: &str) -> &str {
    match source {
        "manual" => "Manuel",
        "compliance" => "Conformit\u{00e9}",
        "vulnerability" => "Vuln\u{00e9}rabilit\u{00e9}",
        "threat" => "Menace",
        other => other,
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

    #[test]
    fn the_register_sorts_on_what_the_column_means() {
        use widgets::data_table::{SortDirection, TableSort};
        let mut state = AppState::default();
        let mut first = risk(5, 2, RiskStatus::Closed, 3); // score 10
        first.title = "zone inondable".into();
        let mut second = risk(3, 3, RiskStatus::Open, 10); // score 9
        second.title = "Accès distant".into();
        let mut third = risk(4, 5, RiskStatus::Mitigating, 1); // score 20
        third.title = "Bail informatique".into();
        state.risks.entries = vec![first, second, third];
        let order = |key: &str, direction| {
            RisksPage::sorted(&state, vec![0, 1, 2], &TableSort::by(key, direction))
        };
        // Numeric: 9 < 10 < 20, where the text order would put "10" first.
        assert_eq!(order("score", SortDirection::Ascending), [1, 0, 2]);
        assert_eq!(order("score", SortDirection::Descending), [2, 0, 1]);
        // Open, mitigating, closed: not the alphabet.
        assert_eq!(order("status", SortDirection::Ascending), [1, 2, 0]);
        // Oldest first.
        assert_eq!(order("created", SortDirection::Ascending), [1, 0, 2]);
        // Text without case.
        assert_eq!(order("title", SortDirection::Ascending), [1, 2, 0]);
        assert_eq!(order("title", SortDirection::None), [0, 1, 2]);
    }

    #[test]
    fn the_search_finds_a_risk_by_its_french_source() {
        let mut state = AppState::default();
        let mut generated = risk(4, 5, RiskStatus::Open, 1);
        generated.source = "compliance".into();
        state.risks.entries = vec![risk(1, 1, RiskStatus::Open, 2), generated];
        state.risks.search = "conformité".into();
        assert_eq!(RisksPage::filtered_indices(&state), vec![1]);
    }

    #[test]
    fn cancelling_the_form_leaves_the_register_untouched() {
        let mut state = AppState::default();
        state.risks.entries = vec![risk(2, 2, RiskStatus::Open, 1)];
        let mut draft = state.risks.entries[0].clone();
        draft.title = "Titre modifié".into();
        state.risks.draft = Some(draft);
        state.risks.editing = true;

        RisksPage::discard_draft(&mut state);

        assert_eq!(state.risks.entries[0].title, "Risque de test");
        assert!(state.risks.draft.is_none() && !state.risks.editing);
    }

    #[test]
    fn saving_the_form_writes_the_risk_and_asks_to_store_it() {
        let ctx = egui::Context::default();
        let mut state = AppState::default();
        state.risks.entries = vec![risk(2, 2, RiskStatus::Open, 1)];

        // A new risk joins the register only when saved.
        let mut new_risk = risk(3, 3, RiskStatus::Open, 0);
        new_risk.id = "nouveau".into();
        new_risk.title = "  ".into();
        state.risks.draft = Some(new_risk);
        state.risks.draft_is_new = true;
        state.risks.editing = true;
        assert!(
            RisksPage::save_draft(&mut state, &ctx).is_none(),
            "blank title"
        );
        assert_eq!(state.risks.entries.len(), 1);

        state.risks.draft.as_mut().unwrap().title = " Perte de sauvegardes ".into();
        let command = RisksPage::save_draft(&mut state, &ctx);
        assert!(matches!(command, Some(GuiCommand::SaveRisk { .. })));
        assert_eq!(state.risks.entries.len(), 2);
        assert_eq!(state.risks.entries[1].title, "Perte de sauvegardes");
        assert_eq!(state.risks.selected_risk, Some(1));
        assert!(state.risks.draft.is_none() && !state.risks.editing);

        // An edited risk replaces its entry.
        let mut edited = state.risks.entries[0].clone();
        edited.status = RiskStatus::Closed;
        state.risks.draft = Some(edited);
        state.risks.editing = true;
        assert!(RisksPage::save_draft(&mut state, &ctx).is_some());
        assert_eq!(state.risks.entries.len(), 2);
        assert_eq!(state.risks.entries[0].status, RiskStatus::Closed);
    }

    #[test]
    fn suggested_scores_are_applied_only_on_request() {
        let mut state = AppState::default();
        state.risks.entries = vec![risk(2, 2, RiskStatus::Open, 1)];
        let id = state.risks.entries[0].id.clone();
        state.apply_event(crate::events::AgentEvent::LlmRiskAnalysis {
            risk_id: id.clone(),
            suggested_probability: Some(4),
            suggested_impact: Some(5),
            analysis: "Analyse".into(),
            mitigation_suggestions: vec![],
        });
        assert_eq!(
            state.risks.entries[0].probability, 2,
            "not applied silently"
        );
        assert_eq!(state.risks.ai_analysis_for.as_deref(), Some(id.as_str()));
        assert_eq!(state.risks.ai_suggested_scores, Some((4, 5)));

        let command = RisksPage::apply_suggested_scores(&mut state, &id, 4, 5);
        assert!(matches!(command, Some(GuiCommand::SaveRisk { .. })));
        assert_eq!(state.risks.entries[0].score(), 20);
        assert!(state.risks.ai_suggested_scores.is_none());
    }
}
