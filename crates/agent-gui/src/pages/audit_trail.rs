//! Audit Trail page -- historical security and system events.
//! Premium AAA design using high-performance tables.

use egui::Ui;
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct AuditTrailPage;

impl AuditTrailPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Journal d'audit"],
            "Journal d'Audit",
            Some("TRAÇABILITÉ COMPLÈTE DES ÉVÉNEMENTS DE SÉCURITÉ ET DU SYSTÈME"),
            Some(
                "Consultez l'historique détaillé des actions de l'agent, des détections de menaces et des changements de configuration.",
            ),
        );
        ui.add_space(theme::SPACE_MD);

        // Action bar with Export
        ui.horizontal(|ui: &mut egui::Ui| {
            if widgets::button::secondary_button(ui, format!("{}  EXPORTER CSV", crate::icons::DOWNLOAD), true).clicked() {
                let success = Self::export_audit_trail_csv(state);
                let time = ui.input(|i| i.time);
                if success {
                    state.toasts.push(
                        crate::widgets::toast::Toast::success("Journal d'audit exporté avec succès")
                            .with_time(time),
                    );
                } else {
                    state.toasts.push(
                        crate::widgets::toast::Toast::error("Échec de l'export du journal d'audit")
                            .with_time(time),
                    );
                }
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Filters (AAA Grade)
        // Count filtered results (matching the same logic as render_table)
        let n_items = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter
                    && log.level.to_lowercase() != filter.to_lowercase() {
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
        let toggled = widgets::SearchFilterBar::new(
            &mut state.audit_trail_search,
            "RECHERCHER UN ÉVÉNEMENT...",
        )
        .chip(
            "INFO",
            state.audit_trail_filter.as_deref() == Some("info"),
            theme::INFO,
        )
        .chip(
            "WARN",
            state.audit_trail_filter.as_deref() == Some("warn"),
            theme::WARNING,
        )
        .chip(
            "ERROR",
            state.audit_trail_filter.as_deref() == Some("error"),
            theme::ERROR,
        )
        .result_count(n_items)
        .show(ui);

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
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_height(ui.available_height() - theme::SPACE_XL);
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
                    && log.level.to_lowercase() != filter.to_lowercase() {
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
            .show(ui.ctx(), &mut state.audit_detail_open, |ui| {
                widgets::detail_section(ui, "ÉVÉNEMENT D'AUDIT");
                widgets::detail_mono(ui, "ID", &id_str);
                widgets::detail_field(ui, "Horodatage", &ts);
                widgets::detail_field_badge(ui, "Niveau", &level.to_uppercase(), level_color);
                if let Some(ref s) = source {
                    widgets::detail_mono(ui, "Source", s);
                }

                widgets::detail_section(ui, "DÉTAILS");
                widgets::detail_text(ui, "Message", &message);
            }, &actions);

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
            .map(|l| {
                vec![
                    l.timestamp.to_rfc3339(),
                    l.level.clone(),
                    l.message.clone(),
                ]
            })
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
        let text_height = 18.0; // Estimate for better row spacing

        let filtered_logs: Vec<_> = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter
                    && log.level.to_lowercase() != filter.to_lowercase() {
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
            ui.vertical_centered(|ui| {
                ui.add_space(theme::SPACE_XL);
                ui.label(
                    egui::RichText::new("AUCUN ÉVÉNEMENT TROUVÉ")
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_XL);
            });
            return;
        }

        TableBuilder::new(ui)
            .striped(false)
            .resizable(true)
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
            .column(Column::auto().at_least(180.0)) // Timestamp
            .column(Column::auto().at_least(100.0)) // Level
            .column(Column::remainder()) // Message
            .header(25.0, |mut header| {
                header.col(|ui| {
                    ui.strong("HORODATAGE");
                });
                header.col(|ui| {
                    ui.strong("NIVEAU");
                });
                header.col(|ui| {
                    ui.strong("DÉTAILS DE L'ÉVÉNEMENT");
                });
            })
            .body(|body| {
                body.rows(text_height + 12.0, filtered_logs.len(), |mut row| {
                    let idx = row.index();
                    let log = filtered_logs[idx];

                    row.set_selected(state.selected_audit_entry == Some(idx));

                    row.col(|ui| {
                        ui.label(
                            egui::RichText::new(
                                log.timestamp.format("%d/%m/%Y %H:%M:%S").to_string(),
                            )
                            .font(theme::font_label())
                            .color(theme::text_secondary()),
                        );
                    });

                    row.col(|ui| {
                        let color = match log.level.to_lowercase().as_str() {
                            "error" | "critical" => theme::ERROR,
                            "warn" | "warning" => theme::WARNING,
                            _ => theme::INFO,
                        };
                        widgets::status_badge(ui, &log.level.to_uppercase(), color);
                    });

                    row.col(|ui| {
                        ui.label(
                            egui::RichText::new(&log.message)
                                .font(theme::font_body())
                                .color(theme::text_primary()),
                        );
                    });

                    if row.response().clicked() {
                        state.selected_audit_entry = Some(idx);
                        state.audit_detail_open = true;
                    }
                });
            });
    }
}
