//! Audit Trail page -- historical security and system events.
//! Premium AAA design using high-performance tables.

use egui::Ui;
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
use crate::events::GuiCommand;
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
        ui.add_space(theme::SPACE_LG);

        // Filters (AAA Grade)
        // Count filtered results (matching the same logic as render_table)
        let n_items = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter {
                    if log.level.to_lowercase() != filter.to_lowercase() {
                        return false;
                    }
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
        }

        ui.add_space(theme::SPACE_MD);

        // Log Table
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_height(ui.available_height() - theme::SPACE_XL);
            Self::render_table(ui, state);
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn render_table(ui: &mut Ui, state: &AppState) {
        let text_height = 18.0; // Estimate for better row spacing

        let filtered_logs: Vec<_> = state
            .logs
            .iter()
            .filter(|log| {
                if let Some(ref filter) = state.audit_trail_filter {
                    if log.level.to_lowercase() != filter.to_lowercase() {
                        return false;
                    }
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
            .striped(true)
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
                    let log = filtered_logs[row.index()];

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
                });
            });
    }
}
