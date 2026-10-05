// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! File Integrity Monitoring page -- FIM alerts and acknowledgments.

use egui::Ui;

use crate::app::AppState;
use crate::dto::FimChangeType;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct FimPage;

impl FimPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        let _ = widgets::page_header_nav(
            ui,
            &["Détection & réponse", "FIM"],
            "Surveillance d'Intégrité",
            Some("D\u{00e9}tection des modifications sur les fichiers syst\u{00e8}me critiques."),
            Some(
                "Surveillance en temps réel des modifications de fichiers critiques. Chaque événement est horodaté et classé par type pour une analyse forensique complète.",
            ),
        );
        ui.add_space(theme::SPACE_LG);
        crate::pages::security_navigation(ui, state);
        ui.add_space(theme::SPACE_MD);

        // ── Summary cards (AAA Grade) ───────────────────────────────────
        {
            let unacked: String = state
                .fim
                .alerts
                .iter()
                .filter(|a| !a.acknowledged)
                .count()
                .to_string();
            let items: Vec<(&str, String, egui::Color32, &str)> = vec![
                (
                    "FICHIERS SURVEILLÉS",
                    crate::format::int(state.fim.monitored_count),
                    theme::INFO,
                    icons::FILE_SHIELD,
                ),
                (
                    "MODIFICATIONS AUJOURD'HUI",
                    state.fim.changes_today.to_string(),
                    theme::WARNING,
                    icons::PENCIL,
                ),
                (
                    "ALERTES ACTIVES",
                    state.fim.alerts.len().to_string(),
                    theme::ERROR,
                    icons::WARNING,
                ),
                ("NON ACQUITTÉES", unacked, theme::ACCENT, icons::CLOCK),
            ];

            let grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
            grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
                if Self::summary_card(ui, width, label, value, *color, icon) {
                    widgets::open_data_panel(ui.ctx(), "Alertes d’intégrité des fichiers");
                }
            });
        }

        ui.add_space(theme::SPACE_LG);

        // ── Change mix + triage ─────────────────────────────────────────
        if !state.fim.alerts.is_empty() {
            Self::activity_card(ui, &state.fim.alerts);
        }

        ui.add_space(theme::SPACE_MD);

        // ── Alerts table (AAA Grade) ─────────────────────────────────────
        if state.fim.alerts.is_empty() {
            widgets::data_card(ui, "Alertes d’intégrité des fichiers", |ui| {
                widgets::empty_state(
                    ui,
                    icons::FILE_SHIELD,
                    "Aucune alerte FIM",
                    Some(
                        "Aucune modification de fichier critique détectée. La surveillance est active et fonctionnelle.",
                    ),
                );
            });
            ui.add_space(theme::SPACE_XL);
        } else {
            widgets::data_card(
                ui,
                "Alertes d’intégrité des fichiers",
                |ui: &mut egui::Ui| {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ALERTES FIM RÉCENTES")
                                .font(theme::font_label())
                                .color(theme::text_secondary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD))
                                    .clicked()
                                {
                                    let all_indices: Vec<usize> =
                                        (0..state.fim.alerts.len()).collect();
                                    Self::export_events_csv(state, &all_indices);
                                }
                            },
                        );
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Collect ack commands before the table (borrow-safe)
                    let alert_ids: Vec<String> =
                        state.fim.alerts.iter().map(|a| a.id.clone()).collect();
                    let alert_acked: Vec<bool> =
                        state.fim.alerts.iter().map(|a| a.acknowledged).collect();
                    let admin_unlocked = state.security.admin_unlocked;
                    let mut ack_command = None;
                    let mut unlock_requested = false;

                    const FIM_PER_PAGE: usize = 50;
                    let (fim_start, fim_len, _) = widgets::page_window(
                        state.fim.alerts.len(),
                        FIM_PER_PAGE,
                        &mut state.fim.page,
                    );

                    use widgets::table;

                    let selected = state.fim.selected_alert;
                    let mut clicked_row: Option<usize> = None;

                    table::fluid_clickable(
                        ui,
                        &[
                            table::Col::fluid(96.0, 0.0),  // Type
                            table::Col::fluid(240.0, 4.0), // Chemin
                            table::Col::fluid(110.0, 0.5), // Date
                            table::Col::fixed(120.0),      // Statut
                        ],
                    )
                    .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "TYPE");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "CHEMIN");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "DATE");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "STATUT");
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_DATA_ROW_HEIGHT, fim_len, |mut row| {
                            let idx = fim_start + row.index();
                            let Some(alert) = state.fim.alerts.get(idx) else {
                                return;
                            };
                            let is_selected = selected == Some(idx);
                            row.set_selected(is_selected);

                            row.col(|ui: &mut egui::Ui| {
                                let (label, color) = Self::change_type_display(&alert.change_type);
                                widgets::status_badge(ui, label, color);
                            });

                            row.col(|ui: &mut egui::Ui| {
                                let hash_text = match (&alert.old_hash, &alert.new_hash) {
                                    (Some(old), Some(new)) => {
                                        format!("HASH : {} \u{2192} {}", old, new)
                                    }
                                    (Some(old), None) => format!("HASH : {}", old),
                                    (None, Some(new)) => format!("HASH : {}", new),
                                    (None, None) => String::new(),
                                };
                                table::cell_stack_mono(ui, &alert.path, &hash_text);
                            });

                            row.col(|ui: &mut egui::Ui| {
                                table::cell_mono_muted(
                                    ui,
                                    &alert.timestamp.format("%d/%m %H:%M:%S").to_string(),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                if alert_acked[idx] {
                                    table::cell_muted(
                                        ui,
                                        &format!("{}  ACQUITT\u{00c9}", icons::CIRCLE_CHECK),
                                    );
                                } else if admin_unlocked {
                                    if widgets::chip_button(
                                        ui,
                                        &format!("{}  Acquitter", icons::CHECK),
                                        false,
                                        theme::ACCENT,
                                    )
                                    .clicked()
                                    {
                                        ack_command = Some(idx);
                                    }
                                } else if widgets::chip_button(
                                    ui,
                                    &format!("{}  Acquitter", icons::LOCK),
                                    false,
                                    theme::text_tertiary(),
                                )
                                .on_hover_text("Nécessite le mode administrateur")
                                .clicked()
                                {
                                    unlock_requested = true;
                                }
                            });

                            if table::row_interaction(&row, is_selected) {
                                clicked_row = Some(idx);
                            }
                        });
                    });

                    if let Some(idx) = clicked_row {
                        state.fim.selected_alert = Some(idx);
                        state.fim.detail_open = true;
                    }

                    // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
                    let mut position = state.fim.selected_alert;
                    if widgets::navigate_list(
                        ui.ctx(),
                        &mut position,
                        state.fim.alerts.len(),
                        &mut state.fim.detail_open,
                    ) && let Some(pos) = position
                    {
                        state.fim.selected_alert = Some(pos);
                        state.fim.page = pos / FIM_PER_PAGE;
                    }

                    if unlock_requested {
                        state
                            .security
                            .request_unlock("Acquitter une alerte d'intégrité");
                    }

                    // Apply acknowledgment after the table
                    if let Some(idx) = ack_command
                        && state.acknowledge_threat_item("fim", idx)
                    {
                        let alert = &state.fim.alerts[idx];
                        command = Some(GuiCommand::AcknowledgeFimAlert {
                            alert_id: alert_ids[idx].clone(),
                            path: alert.path.clone(),
                            timestamp: alert.timestamp,
                        });
                        // Close drawer if acknowledged alert was selected
                        if state.fim.selected_alert == Some(idx) {
                            state.fim.detail_open = false;
                        }
                    }

                    widgets::paginate_controls(
                        ui,
                        state.fim.alerts.len(),
                        FIM_PER_PAGE,
                        &mut state.fim.page,
                    );
                },
            );
        }

        ui.add_space(theme::SPACE_XL);

        let ctx = ui.ctx().clone();
        if let Some(sel) = state.fim.selected_alert
            && sel < state.fim.alerts.len()
        {
            let alert = state.fim.alerts[sel].clone();
            let (type_label, type_color) = Self::change_type_display(&alert.change_type);
            let mut actions = Vec::new();
            if !alert.acknowledged {
                actions.push(widgets::DetailAction::primary("Acquitter", icons::CHECK));
            }
            actions.push(widgets::DetailAction::secondary(
                "Exporter",
                icons::DOWNLOAD,
            ));

            let action = widgets::DetailDrawer::new("fim_detail", &alert.path, icons::FILE_SHIELD)
                .accent(type_color)
                .subtitle("Alerte FIM")
                .show(
                    &ctx,
                    &mut state.fim.detail_open,
                    |ui| {
                        widgets::detail_section(ui, "D\u{00c9}TAILS DE L'ALERTE");
                        widgets::detail_mono(ui, "ID", &alert.id);
                        widgets::detail_mono(ui, "Chemin du fichier", &alert.path);
                        widgets::detail_field_badge(
                            ui,
                            "Type de modification",
                            type_label,
                            type_color,
                        );
                        widgets::detail_field(
                            ui,
                            "Date de d\u{00e9}tection",
                            &alert.timestamp.format("%d/%m/%Y %H:%M:%S").to_string(),
                        );

                        widgets::detail_section(ui, "HACHAGES");
                        if let Some(ref old) = alert.old_hash {
                            widgets::detail_mono(ui, "Hash pr\u{00e9}c\u{00e9}dent", old);
                        }
                        if let Some(ref new) = alert.new_hash {
                            widgets::detail_mono(ui, "Hash actuel", new);
                        }

                        widgets::detail_section(ui, "STATUT");
                        if alert.acknowledged {
                            widgets::detail_field_badge(
                                ui,
                                "Acquitt\u{00e9}e",
                                "OUI",
                                theme::SUCCESS,
                            );
                        } else {
                            widgets::detail_field_badge(
                                ui,
                                "Acquitt\u{00e9}e",
                                "NON",
                                theme::WARNING,
                            );
                        }
                    },
                    &actions,
                );

            if let Some(action_idx) = action {
                if !alert.acknowledged && action_idx == 0 {
                    state.acknowledge_threat_item("fim", sel);
                    let acked = &state.fim.alerts[sel];
                    command = Some(GuiCommand::AcknowledgeFimAlert {
                        alert_id: acked.id.clone(),
                        path: acked.path.clone(),
                        timestamp: acked.timestamp,
                    });
                } else {
                    let export_idx = if alert.acknowledged { 0 } else { 1 };
                    if action_idx == export_idx {
                        let time = ctx.input(|i| i.time);
                        if Self::export_events_csv(state, &[sel]) {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Alerte FIM export\u{00e9}e en CSV",
                                )
                                .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("\u{00c9}chec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                }
            }
        }

        command
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /// What changed and how far triage has got: the change-type mix as a
    /// proportion bar with a legend, beside the acknowledgement ring and
    /// the last seven days of changes.
    fn activity_card(ui: &mut Ui, alerts: &std::collections::VecDeque<crate::dto::GuiFimAlert>) {
        widgets::data_card(
            ui,
            "Activité et traitement des alertes",
            |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("ACTIVITÉ ET TRAITEMENT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);
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
                    let inner = ui.spacing().item_spacing;
                    ui.spacing_mut().item_spacing = egui::vec2(gap, theme::SPACE_LG);
                    ui.vertical(|ui| {
                        ui.spacing_mut().item_spacing = inner;
                        ui.set_width(column_w);
                        change_mix(ui, alerts);
                    });
                    ui.vertical(|ui| {
                        ui.spacing_mut().item_spacing = inner;
                        ui.set_width(column_w);
                        triage(ui, alerts);
                    });
                });
            },
        );
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
            .on_hover_text("Consulter les données associées")
            .clicked();
        });
        clicked
    }

    fn change_type_display(change_type: &FimChangeType) -> (&'static str, egui::Color32) {
        match change_type {
            FimChangeType::Created => ("CRÉÉ", theme::SUCCESS),
            FimChangeType::Modified => ("MODIFIÉ", theme::WARNING),
            FimChangeType::Deleted => ("SUPPRIMÉ", theme::ERROR),
            FimChangeType::PermissionChanged => ("PERMISSIONS", theme::INFO),
            // Its own hue: sharing amber with "modified" made the two
            // indistinguishable in the change-mix bar.
            FimChangeType::Renamed => ("RENOMMÉ", theme::AI),
        }
    }

    fn export_events_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["chemin", "modification", "date", "statut"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let e = state.fim.alerts.get(i)?;
                Some(vec![
                    e.path.clone(),
                    e.change_type.to_string(),
                    e.timestamp.to_rfc3339(),
                    if e.acknowledged {
                        "Acquitté"
                    } else {
                        "En attente"
                    }
                    .to_string(),
                ])
            })
            .collect();

        let path = crate::export::default_export_path("fim_alertes.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV FIM failed: {}", e);
                false
            }
        }
    }
}

fn fim_column_title(ui: &mut Ui, icon: &str, title: &str) {
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

/// Change types as one proportion bar and a legend with counts and shares.
fn change_mix(ui: &mut Ui, alerts: &std::collections::VecDeque<crate::dto::GuiFimAlert>) {
    fim_column_title(ui, icons::PENCIL, "Types de modification");
    let kinds = [
        FimChangeType::Modified,
        FimChangeType::Created,
        FimChangeType::Deleted,
        FimChangeType::PermissionChanged,
        FimChangeType::Renamed,
    ];
    let counts: Vec<(&'static str, usize, egui::Color32)> = kinds
        .iter()
        .map(|kind| {
            let (label, color) = FimPage::change_type_display(kind);
            let count = alerts.iter().filter(|a| a.change_type == *kind).count();
            (label, count, color)
        })
        .collect();
    let total = alerts.len().max(1);

    let height = 8.0;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if ui.is_rect_visible(rect) {
        let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
        ui.painter().rect_filled(rect, radius, theme::bg_tertiary());
        let live: Vec<_> = counts.iter().filter(|(_, n, _)| *n > 0).collect();
        let gap = 2.0;
        let usable = rect.width() - gap * live.len().saturating_sub(1) as f32;
        let mut x = rect.left();
        for (_, n, color) in live {
            let w = usable * *n as f32 / total as f32;
            ui.painter().rect_filled(
                egui::Rect::from_min_size(egui::pos2(x, rect.top()), egui::vec2(w, height)),
                radius,
                theme::readable_color(*color),
            );
            x += w + gap;
        }
    }
    ui.add_space(theme::SPACE_SM);
    for (label, count, color) in counts.iter().filter(|(_, n, _)| *n > 0) {
        ui.horizontal(|ui| {
            let (dot, _) = ui.allocate_exact_size(egui::vec2(10.0, 10.0), egui::Sense::hover());
            ui.painter()
                .circle_filled(dot.center(), 4.0, theme::readable_color(*color));
            ui.label(
                egui::RichText::new(*label)
                    .font(theme::font_body())
                    .color(theme::text_primary()),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(crate::format::pct(
                        *count as f32 / total as f32 * 100.0,
                        0,
                    ))
                    .font(theme::font_caption())
                    .color(theme::text_tertiary()),
                );
                ui.label(
                    egui::RichText::new(count.to_string())
                        .font(theme::font_body_strong())
                        .color(theme::readable_color(*color)),
                );
            });
        });
    }
}

/// Acknowledgement ring beside the last seven days of changes.
fn triage(ui: &mut Ui, alerts: &std::collections::VecDeque<crate::dto::GuiFimAlert>) {
    fim_column_title(ui, icons::CHECK, "Traitement");
    let total = alerts.len();
    let acked = alerts.iter().filter(|a| a.acknowledged).count();
    let ratio = acked as f32 / total.max(1) as f32;
    let color = if ratio >= 0.8 {
        theme::SUCCESS
    } else if ratio >= 0.5 {
        theme::SEVERITY_MEDIUM
    } else {
        theme::ERROR
    };

    ui.horizontal_top(|ui| {
        // Ring.
        let size = 96.0;
        let (rect, _) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());
        if ui.is_rect_visible(rect) {
            let painter = ui.painter();
            let center = rect.center();
            let r = size / 2.0 - 6.0;
            painter.circle_stroke(center, r, egui::Stroke::new(8.0_f32, theme::bg_tertiary()));
            if ratio > 0.0 {
                let steps = (64.0 * ratio).ceil().max(2.0) as usize;
                let start = -std::f32::consts::FRAC_PI_2;
                let points: Vec<egui::Pos2> = (0..=steps)
                    .map(|i| {
                        let a = start + std::f32::consts::TAU * ratio * i as f32 / steps as f32;
                        center + egui::vec2(a.cos(), a.sin()) * r
                    })
                    .collect();
                painter.add(egui::Shape::line(
                    points,
                    egui::Stroke::new(8.0_f32, theme::readable_color(color)),
                ));
            }
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                crate::format::pct(ratio * 100.0, 0),
                theme::font_body_strong(),
                theme::readable_color(color),
            );
        }
        ui.add_space(theme::SPACE_MD);
        ui.vertical(|ui| {
            ui.label(
                egui::RichText::new(format!("{acked} / {total}"))
                    .font(theme::font_h2())
                    .color(theme::text_primary()),
            );
            ui.label(
                egui::RichText::new("alertes acquittées")
                    .font(theme::font_caption())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);
            week_bars(ui, alerts);
        });
    });
}

/// Changes per day over the last seven days, today last.
fn week_bars(ui: &mut Ui, alerts: &std::collections::VecDeque<crate::dto::GuiFimAlert>) {
    use chrono::Datelike;
    let today = chrono::Local::now().date_naive();
    let mut days = [0_usize; 7];
    for alert in alerts {
        let day = alert.timestamp.with_timezone(&chrono::Local).date_naive();
        let back = (today - day).num_days();
        if (0..7).contains(&back) {
            days[6 - back as usize] += 1;
        }
    }
    let tallest = days.iter().copied().max().unwrap_or(0).max(1);
    let (rect, _) = ui.allocate_exact_size(egui::vec2(7.0 * 22.0, 44.0), egui::Sense::hover());
    if !ui.is_rect_visible(rect) {
        return;
    }
    let painter = ui.painter();
    let plot_h = 30.0;
    for (i, count) in days.iter().enumerate() {
        let x = rect.left() + i as f32 * 22.0;
        let h = if *count == 0 {
            2.0
        } else {
            (plot_h * *count as f32 / tallest as f32).max(4.0)
        };
        painter.rect_filled(
            egui::Rect::from_min_max(
                egui::pos2(x + 3.0, rect.top() + plot_h - h),
                egui::pos2(x + 19.0, rect.top() + plot_h),
            ),
            egui::CornerRadius {
                nw: 2,
                ne: 2,
                sw: 0,
                se: 0,
            },
            if *count == 0 {
                theme::bg_tertiary()
            } else if i == 6 {
                theme::accent_text()
            } else {
                theme::accent_text().linear_multiply(0.55)
            },
        );
        let weekday = (today - chrono::Duration::days(6 - i as i64)).weekday();
        let letter = ["L", "M", "M", "J", "V", "S", "D"][weekday.num_days_from_monday() as usize];
        painter.text(
            egui::pos2(x + 11.0, rect.top() + plot_h + 3.0),
            egui::Align2::CENTER_TOP,
            letter,
            theme::font_micro(),
            theme::text_tertiary(),
        );
    }
}
