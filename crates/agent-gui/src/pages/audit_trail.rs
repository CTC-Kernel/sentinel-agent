// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Audit Trail page -- historical security and system events.
//! Premium AAA design using high-performance tables.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct AuditTrailPage;

impl AuditTrailPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_XS);
        let _ = widgets::page_header_nav(
            ui,
            &["Système", "Journal d'audit"],
            "Journal d'Audit",
            Some(
                "Traçabilit\u{00e9} compl\u{00e8}te des \u{00e9}v\u{00e9}nements de s\u{00e9}curit\u{00e9} et du syst\u{00e8}me.",
            ),
            Some(
                "Consultez l'historique d\u{00e9}taill\u{00e9} des actions de l'agent, des d\u{00e9}tections de menaces et des changements de configuration.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Filters (AAA Grade)
        // Count filtered results (matching the same logic as render_table)
        let n_items = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter
                    && log.level.to_lowercase() != filter.to_lowercase()
                {
                    return false;
                }
                if !state.audit_trail_search.is_empty() {
                    let search = state.audit_trail_search.to_lowercase();
                    return log.message.to_lowercase().contains(&search)
                        || log
                            .source
                            .as_ref()
                            .is_some_and(|s| s.to_lowercase().contains(&search));
                }
                true
            })
            .count();
        let (toggled, export_clicked) = widgets::SearchFilterBar::new(
            &mut state.audit_trail_search,
            "Rechercher un événement…",
        )
        .chip(
            "Info",
            state.audit_trail_filter.as_deref() == Some("info"),
            theme::INFO,
        )
        .chip(
            "Avertissement",
            state.audit_trail_filter.as_deref() == Some("warn"),
            theme::WARNING,
        )
        .chip(
            "Erreur",
            state.audit_trail_filter.as_deref() == Some("error"),
            theme::ERROR,
        )
        .result_count(n_items)
        .action(format!("{}  CSV", crate::icons::DOWNLOAD))
        .show_with_action(ui);
        // The export lives in the search bar's action slot, beside what it
        // exports; on a row of its own it left a band of empty space.
        if export_clicked {
            let success = Self::export_audit_trail_csv(state);
            let toast = if success {
                crate::widgets::toast::Toast::success("Journal d'audit exporté avec succès")
            } else {
                crate::widgets::toast::Toast::error("Échec de l'export du journal d'audit")
            };
            state.toasts.push(toast.with_time(ui.input(|i| i.time)));
        }

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("info"),
                1 => Some("warn"),
                2 => Some("error"),
                _ => None,
            };
            if state.audit_trail_filter.as_deref() == target {
                state.audit_trail_filter = None;
            } else {
                state.audit_trail_filter = target.map(|s| s.to_string());
            }
            // Clear selection when filter changes — indices are no longer valid
            state.selected_audit_entry = None;
            state.audit_detail_open = false;
        }

        ui.add_space(theme::SPACE_MD);

        // Log Table
        widgets::data_card(ui, "Journal d’audit", |ui: &mut egui::Ui| {
            Self::render_table(ui, state);
        });

        ui.add_space(theme::SPACE_XL);

        Self::detail_drawer(ui, state);

        command
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState) {
        let filtered_logs: Vec<_> = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter
                    && log.level.to_lowercase() != filter.to_lowercase()
                {
                    return false;
                }
                if !state.audit_trail_search.is_empty() {
                    let search = state.audit_trail_search.to_lowercase();
                    return log.message.to_lowercase().contains(&search)
                        || log
                            .source
                            .as_ref()
                            .is_some_and(|s| s.to_lowercase().contains(&search));
                }
                true
            })
            .collect();

        let selected = match state.selected_audit_entry {
            Some(idx) if idx < filtered_logs.len() => idx,
            _ => return,
        };

        let log = &filtered_logs[selected];
        let id_str = log.id.to_string();
        let ts = log.timestamp.format("%d/%m/%Y %H:%M:%S").to_string();
        let level = log.level.clone();
        let message = log.message.clone();
        let source = log.source.clone();
        let level_color = match level.to_lowercase().as_str() {
            "error" | "critical" => theme::ERROR,
            "warn" | "warning" => theme::WARNING,
            _ => theme::INFO,
        };

        let actions = [
            widgets::DetailAction::secondary("Copier l'ID", icons::COPY),
            widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
        ];

        let action = widgets::DetailDrawer::new("audit_detail", "Événement d'audit", icons::LIST)
            .accent(level_color)
            .subtitle(&ts)
            .show(
                ui.ctx(),
                &mut state.audit_detail_open,
                |ui| {
                    widgets::detail_section(ui, "ÉVÉNEMENT D'AUDIT");
                    widgets::detail_mono(ui, "ID", &id_str);
                    widgets::detail_field(ui, "Horodatage", &ts);
                    widgets::detail_field_badge(ui, "Niveau", &level.to_uppercase(), level_color);
                    if let Some(ref s) = source {
                        widgets::detail_mono(ui, "Source", s);
                    }

                    widgets::detail_section(ui, "DÉTAILS");
                    widgets::detail_text(ui, "Message", &message);
                },
                &actions,
            );

        match action {
            Some(0) => {
                ui.ctx().copy_text(id_str);
            }
            Some(1) => {
                Self::export_audit_trail_csv(state);
            }
            _ => {}
        }
    }

    fn export_audit_trail_csv(state: &AppState) -> bool {
        let headers = &["date", "niveau", "message"];
        let rows: Vec<Vec<String>> = state
            .logs
            .iter()
            .map(|l| vec![l.timestamp.to_rfc3339(), l.level.clone(), l.message.clone()])
            .collect();
        let path = crate::export::default_export_path("audit_trail.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }

    fn render_table(ui: &mut Ui, state: &mut AppState) {
        let filtered_logs: Vec<_> = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter
                    && log.level.to_lowercase() != filter.to_lowercase()
                {
                    return false;
                }
                if !state.audit_trail_search.is_empty() {
                    let search = state.audit_trail_search.to_lowercase();
                    return log.message.to_lowercase().contains(&search)
                        || log
                            .source
                            .as_ref()
                            .map(|s| s.to_lowercase().contains(&search))
                            .unwrap_or(false);
                }
                true
            })
            .collect();

        if filtered_logs.is_empty() {
            widgets::empty_state(ui, icons::CLIPBOARD, "Aucun événement trouvé", None);
            return;
        }

        // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
        let mut position = state.selected_audit_entry;
        if widgets::navigate_list(
            ui.ctx(),
            &mut position,
            filtered_logs.len(),
            &mut state.audit_detail_open,
        ) && let Some(pos) = position
        {
            state.selected_audit_entry = Some(pos);
            state.audit_trail_page = pos / AUDIT_PER_PAGE;
        }

        const AUDIT_PER_PAGE: usize = 50;
        let (at_start, at_len, _) = widgets::page_window(
            filtered_logs.len(),
            AUDIT_PER_PAGE,
            &mut state.audit_trail_page,
        );

        use widgets::table;

        let selected = state.selected_audit_entry;
        let mut clicked_row: Option<usize> = None;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(150.0, 0.0), // Horodatage
                table::Col::fluid(136.0, 0.0), // Niveau: "AVERTISSEMENT" whole
                table::Col::fluid(200.0, 1.0), // Détails de l'événement
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            header.col(|ui| {
                table::header_cell(ui, "HORODATAGE");
            });
            header.col(|ui| {
                table::header_cell(ui, "NIVEAU");
            });
            header.col(|ui| {
                table::header_cell(ui, "D\u{00c9}TAILS DE L'\u{00c9}V\u{00c9}NEMENT");
            });
        })
        .body(|body| {
            body.rows(theme::TABLE_ROW_HEIGHT, at_len, |mut row| {
                let idx = at_start + row.index();
                let Some(log) = filtered_logs.get(idx) else {
                    return;
                };
                let log = *log;
                let is_selected = selected == Some(idx);
                row.set_selected(is_selected);

                row.col(|ui| {
                    table::cell_secondary(
                        ui,
                        &log.timestamp.format("%d/%m/%Y %H:%M:%S").to_string(),
                    );
                });

                row.col(|ui| {
                    let (level_upper, color) = match log.level.to_lowercase().as_str() {
                        "error" | "critical" => ("ERREUR", theme::ERROR),
                        "warn" | "warning" => ("AVERTISSEMENT", theme::WARNING),
                        _ => ("INFO", theme::INFO),
                    };
                    widgets::status_badge(ui, level_upper, color);
                });

                row.col(|ui| {
                    table::cell(ui, &log.message);
                });

                if table::row_interaction(&row, is_selected) {
                    clicked_row = Some(idx);
                }
            });
        });

        if let Some(idx) = clicked_row {
            state.selected_audit_entry = Some(idx);
            state.audit_detail_open = true;
        }

        widgets::paginate_controls(
            ui,
            filtered_logs.len(),
            AUDIT_PER_PAGE,
            &mut state.audit_trail_page,
        );
    }
}
