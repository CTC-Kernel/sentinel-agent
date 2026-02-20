//! Risk management page — risk matrix, entries, and SLA tracking.

use egui::Ui;
use egui_extras::{Column, TableBuilder};

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

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Gouvernance", "Risques"],
            "Registre des Risques",
            Some("MATRICE DE RISQUES ET SUIVI DES MESURES D\u{2019}ATT\u{00c9}NUATION"),
            Some(
                "\u{00c9}valuez et suivez vos risques de s\u{00e9}curit\u{00e9} selon une matrice probabilit\u{00e9}/impact. Identifiez les risques critiques, assignez des propri\u{00e9}taires et mesurez l\u{2019}avancement des plans d\u{2019}att\u{00e9}nuation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Risk matrix heatmap
        Self::draw_risk_matrix(ui, state);
        ui.add_space(theme::SPACE_MD);

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
                            let elapsed = now
                                .signed_duration_since(r.created_at)
                                .num_days()
                                .max(0) as u32;
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
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_MD);

        // Action bar
        ui.horizontal(|ui: &mut egui::Ui| {
            if state.security.admin_unlocked {
                if widgets::primary_button(
                    ui,
                    format!("{}  AUTO-POPULER", icons::WAND_SPARKLES),
                    true,
                )
                .clicked()
                {
                    Self::auto_populate(state);
                    state.push_toast(
                        crate::widgets::toast::Toast::info(
                            "Risques auto-g\u{00e9}n\u{00e9}r\u{00e9}s depuis les contr\u{00f4}les et vuln\u{00e9}rabilit\u{00e9}s",
                        ),
                        ui.ctx(),
                    );
                }
            } else {
                widgets::primary_button(
                    ui,
                    format!("{}  AUTO-POPULER", icons::LOCK),
                    false,
                );
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::secondary_button(
                ui,
                format!("{}  NOUVEAU RISQUE", icons::PLUS),
                state.security.admin_unlocked,
            )
            .clicked()
            {
                let new_risk = RiskEntry {
                    id: uuid::Uuid::new_v4(),
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
                            crate::widgets::toast::Toast::info("Export CSV en cours..."),
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
            "Rechercher un risque par titre, propri\u{00e9}taire ou source...",
        )
        .chip("OUVERT", open_active, theme::WARNING)
        .chip("ATT\u{00c9}NUATION", mit_active, theme::INFO)
        .chip("ACCEPT\u{00c9}", acc_active, theme::text_tertiary())
        .chip("CL\u{00d4}TUR\u{00c9}", closed_active, theme::SUCCESS)
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

        ui.add_space(theme::SPACE_SM);

        // Risk table
        widgets::card(ui, |ui: &mut egui::Ui| {
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
                    widgets::empty_state(
                        ui,
                        icons::SCALE_BALANCED,
                        "AUCUN RISQUE ENREGISTR\u{00c9}",
                        Some("Utilisez \u{00ab} Auto-populer \u{00bb} pour g\u{00e9}n\u{00e9}rer des risques depuis vos contr\u{00f4}les ou ajoutez-en manuellement."),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::SCALE_BALANCED,
                        "AUCUN R\u{00c9}SULTAT",
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
    fn draw_risk_matrix(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
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

                        let cell_rect = egui::Rect::from_min_size(
                            origin
                                + egui::vec2(
                                    impact_idx as f32 * cell_size,
                                    display_row as f32 * cell_size,
                                ),
                            egui::vec2(cell_size - 2.0, cell_size - 2.0),
                        );

                        painter.rect_filled(
                            cell_rect,
                            egui::CornerRadius::same(theme::ROUNDING_SM),
                            color.linear_multiply(0.25),
                        );
                        painter.rect_stroke(
                            cell_rect,
                            egui::CornerRadius::same(theme::ROUNDING_SM),
                            egui::Stroke::new(theme::BORDER_THIN, color.linear_multiply(0.5)),
                            egui::StrokeKind::Inside,
                        );

                        if count > 0 {
                            painter.text(
                                cell_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                count.to_string(),
                                theme::font_body(),
                                color,
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
                        origin.y + cell_size * 5.0 + theme::SPACE_MD,
                    ),
                    egui::Align2::CENTER_TOP,
                    "Impact",
                    theme::font_label(),
                    theme::text_tertiary(),
                );
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
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {} {}",
                        r.title.to_lowercase(),
                        r.owner.to_lowercase(),
                        r.source.to_lowercase()
                    );
                    if !haystack.contains(&search_lower) {
                        return false;
                    }
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

        ui.push_id("risks_table", |ui: &mut egui::Ui| {
            let ctx = ui.ctx().clone();
            let table = TableBuilder::new(ui)
                .striped(false)
                .resizable(true)
                .sense(egui::Sense::click())
                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                .column(Column::initial(200.0).range(120.0..=400.0))
                .column(Column::initial(60.0).at_least(50.0))
                .column(Column::initial(60.0).at_least(50.0))
                .column(Column::initial(60.0).at_least(50.0))
                .column(Column::initial(110.0).at_least(90.0))
                .column(Column::initial(120.0).at_least(80.0))
                .column(Column::remainder());

            table
                .header(30.0, |mut header| {
                    for label in [
                        "TITRE",
                        "PROB.",
                        "IMPACT",
                        "SCORE",
                        "STATUT",
                        "PROPRI\u{00c9}TAIRE",
                        "DATE",
                    ] {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(label)
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                    }
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, indices.len(), |mut row| {
                        let row_idx = row.index();
                        let real_idx = indices[row_idx];
                        let risk = &state.risks.entries[real_idx];
                        let is_selected = state.risks.selected_risk == Some(real_idx);
                        row.set_selected(is_selected);

                        let score = risk.score();
                        let score_color = Self::matrix_cell_color(score);
                        let (status_label, status_color) = Self::status_display(&risk.status);

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&risk.title)
                                    .font(theme::font_body())
                                    .color(theme::accent_text())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!("{}", risk.probability))
                                    .font(theme::font_body())
                                    .color(theme::text_primary()),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!("{}", risk.impact))
                                    .font(theme::font_body())
                                    .color(theme::text_primary()),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!("{}", score))
                                    .font(theme::font_body())
                                    .color(theme::readable_color(score_color))
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            widgets::status_badge(ui, status_label, status_color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let owner_display = if risk.owner.is_empty() {
                                "--"
                            } else {
                                &risk.owner
                            };
                            ui.label(
                                egui::RichText::new(owner_display)
                                    .font(theme::font_small())
                                    .color(theme::text_secondary()),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(
                                    risk.created_at.format("%d/%m/%Y").to_string(),
                                )
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                            );
                        });

                        if row.response().clicked() {
                            clicked_idx = Some(real_idx);
                        }
                        if row.response().hovered() {
                            ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
                        }
                    });
                });
        });

        if let Some(idx) = clicked_idx {
            state.risks.selected_risk = Some(idx);
            state.risks.detail_open = true;
            state.risks.editing = false;
        }
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

        let actions = if is_editing {
            vec![
                widgets::DetailAction::primary("Enregistrer", icons::SAVE),
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

        let drawer_action = widgets::DetailDrawer::new(
            "risk_detail",
            &risk.title,
            icons::SCALE_BALANCED,
        )
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
                        widgets::detail_field(
                            ui,
                            "SLA cible",
                            &format!("{} jours", sla),
                        );
                    }

                    widgets::detail_section(ui, "ATT\u{00c9}NUATION");
                    let mitigation_display = if risk.mitigation.is_empty() {
                        "Aucun plan d\u{00e9}fini"
                    } else {
                        &risk.mitigation
                    };
                    widgets::detail_text(ui, "Plan", mitigation_display);

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
                match action_idx {
                    0 => {
                        // Save
                        state.risks.editing = false;
                        if selected < state.risks.entries.len() {
                            state.risks.entries[selected].updated_at = chrono::Utc::now();
                            let saved = state.risks.entries[selected].clone();
                            *command = Some(GuiCommand::SaveRisk {
                                risk: Box::new(saved),
                            });
                        }
                    }
                    1 => {
                        // Cancel
                        state.risks.editing = false;
                    }
                    _ => {}
                }
            } else {
                match action_idx {
                    0 => {
                        // Edit
                        state.risks.editing = true;
                    }
                    1 => {
                        // Delete
                        if selected < state.risks.entries.len() {
                            let id = state.risks.entries[selected].id.to_string();
                            state.risks.entries.remove(selected);
                            state.risks.selected_risk = None;
                            state.risks.detail_open = false;
                            *command = Some(GuiCommand::DeleteRisk { risk_id: id });
                        }
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
            ui.add(egui::DragValue::new(&mut impact_val).range(1..=5).speed(0.1));
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
                id: uuid::Uuid::new_v4(),
                title,
                description: check
                    .message
                    .clone()
                    .unwrap_or_else(|| "D\u{00e9}tect\u{00e9} par audit de conformit\u{00e9}".to_string()),
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
            let title = format!("Vuln\u{00e9}rabilit\u{00e9} : {} ({})", vuln.cve_id, vuln.affected_software);
            if existing_titles.contains(&title) {
                continue;
            }
            state.risks.entries.push(RiskEntry {
                id: uuid::Uuid::new_v4(),
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
            let title = format!("Menace : processus suspect \u{00ab} {} \u{00bb}", proc.process_name);
            if existing_titles.contains(&title) {
                continue;
            }
            state.risks.entries.push(RiskEntry {
                id: uuid::Uuid::new_v4(),
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
    ) {
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
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

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let r = &state.risks.entries[i];
                vec![
                    r.title.clone(),
                    r.probability.to_string(),
                    r.impact.to_string(),
                    r.score().to_string(),
                    r.status.label_fr().to_string(),
                    r.owner.clone(),
                    r.source.clone(),
                    r.created_at.format("%d/%m/%Y").to_string(),
                ]
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
