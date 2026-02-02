//! File Integrity Monitoring (FIM) page -- events and summary.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct FimPage;

impl FimPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Int\u{00e9}grit\u{00e9} des fichiers",
            Some("Surveillance de l\u{2019}int\u{00e9}grit\u{00e9} des fichiers syst\u{00e8}me"),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary cards row ───────────────────────────────────────────
        let monitored = state.fim_monitored_count;
        let changes_today = state.fim_changes_today;
        let active_alerts = state
            .fim_alerts
            .iter()
            .filter(|a| !a.acknowledged)
            .count();

        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(
                ui,
                card_w,
                "FICHIERS SURVEILL\u{00c9}S",
                &monitored.to_string(),
                theme::ACCENT,
                // fa-file
                "\u{f15b}",
            );
            Self::summary_card(
                ui,
                card_w,
                "MODIFICATIONS AUJOURD\u{2019}HUI",
                &changes_today.to_string(),
                if changes_today > 0 { theme::WARNING } else { theme::text_tertiary() },
                icons::CLOCK,
            );
            Self::summary_card(
                ui,
                card_w,
                "ALERTES ACTIVES",
                &active_alerts.to_string(),
                if active_alerts > 0 { theme::ERROR } else { theme::text_tertiary() },
                icons::WARNING,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // ── Search / filter bar ─────────────────────────────────────────
        let created_active = state.fim_filter.as_deref() == Some("created");
        let modified_active = state.fim_filter.as_deref() == Some("modified");
        let deleted_active = state.fim_filter.as_deref() == Some("deleted");
        let perm_active = state.fim_filter.as_deref() == Some("permission_changed");

        let search_lower = state.fim_search.to_lowercase();
        let filtered: Vec<usize> = state
            .fim_alerts
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {}",
                        a.path.to_lowercase(),
                        a.change_type.to_lowercase(),
                    );
                    if !haystack.contains(&search_lower) {
                        return false;
                    }
                }
                if let Some(ref filter) = state.fim_filter {
                    a.change_type == *filter
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.fim_search,
            "Rechercher (chemin, type de modification)...",
        )
        .chip("CR\u{00c9}\u{00c9}", created_active, theme::SUCCESS)
        .chip("MODIFI\u{00c9}", modified_active, theme::WARNING)
        .chip("SUPPRIM\u{00c9}", deleted_active, theme::ERROR)
        .chip("PERMISSIONS", perm_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("created"),
                1 => Some("modified"),
                2 => Some("deleted"),
                3 => Some("permission_changed"),
                _ => None,
            };
            if state.fim_filter.as_deref() == target {
                state.fim_filter = None;
            } else {
                state.fim_filter = target.map(|s| s.to_string());
            }
        }

        ui.add_space(theme::SPACE_SM);

        // ── Events table ────────────────────────────────────────────────
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("\u{00c9}V\u{00c9}NEMENTS FIM")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    "\u{f15b}",
                    "Aucun \u{00e9}v\u{00e9}nement",
                    Some("La surveillance FIM n\u{2019}a d\u{00e9}tect\u{00e9} aucune modification."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(140.0).at_least(100.0))   // Timestamp
                    .column(Column::remainder().at_least(180.0))      // File path
                    .column(Column::initial(120.0).at_least(90.0))    // Change type
                    .column(Column::initial(100.0).at_least(80.0));   // Action

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| { ui.strong("HORODATAGE"); });
                        header.col(|ui| { ui.strong("FICHIER"); });
                        header.col(|ui| { ui.strong("TYPE"); });
                        header.col(|ui| { ui.strong("ACTION"); });
                    })
                    .body(|body| {
                        body.rows(44.0, filtered.len(), |mut row| {
                            let idx = filtered[row.index()];

                            // Timestamp column
                            row.col(|ui| {
                                let ts = state.fim_alerts[idx]
                                    .timestamp
                                    .format("%d/%m/%Y %H:%M:%S")
                                    .to_string();
                                ui.label(
                                    egui::RichText::new(ts)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                );
                            });

                            // File path column (truncated if long)
                            row.col(|ui| {
                                let path = &state.fim_alerts[idx].path;
                                let display_path = if path.len() > 60 {
                                    format!("...{}", &path[path.len() - 57..])
                                } else {
                                    path.clone()
                                };
                                ui.label(
                                    egui::RichText::new(format!("\u{f15b}  {}", display_path))
                                        .font(theme::font_body())
                                        .color(theme::text_primary()),
                                ).on_hover_text(path);
                            });

                            // Change type badge
                            row.col(|ui| {
                                let (label, color) =
                                    Self::change_type_display(&state.fim_alerts[idx].change_type);
                                widgets::status_badge(ui, label, color);
                            });

                            // Acknowledge button
                            row.col(|ui| {
                                let alert = &state.fim_alerts[idx];
                                if alert.acknowledged {
                                    ui.label(
                                        egui::RichText::new(format!("{}  Acquitt\u{00e9}", icons::CIRCLE_CHECK))
                                            .font(theme::font_small())
                                            .color(theme::text_tertiary()),
                                    );
                                } else {
                                    let btn = egui::Button::new(
                                        egui::RichText::new(format!("{}  Acquitter", icons::CHECK))
                                            .font(theme::font_small())
                                            .color(theme::text_on_accent())
                                            .strong(),
                                    )
                                    .fill(theme::ACCENT)
                                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                                    if ui.add(btn).clicked() {
                                        let alert_id = state.fim_alerts[idx].id.clone();
                                        state.fim_alerts[idx].acknowledged = true;
                                        command = Some(GuiCommand::AcknowledgeFimAlert { alert_id });
                                    }
                                }
                            });
                        });
                    });
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .size(24.0)
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }

    fn change_type_display(change_type: &str) -> (&'static str, egui::Color32) {
        match change_type {
            "created" => ("CR\u{00c9}\u{00c9}", theme::SUCCESS),
            "modified" => ("MODIFI\u{00c9}", theme::WARNING),
            "deleted" => ("SUPPRIM\u{00c9}", theme::ERROR),
            "permission_changed" => ("PERMISSIONS", theme::INFO),
            "renamed" => ("RENOMM\u{00c9}", theme::WARNING),
            _ => ("INCONNU", theme::text_tertiary()),
        }
    }
}
