// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Terminal Activity Monitor -- real-time view of all agent background activity.

use egui::{Color32, Ui};

use crate::app::AppState;
use crate::dto::LogLevel;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Level names used for filtering buttons.
const LEVEL_NAMES: &[&str] = &["TRACE", "DEBUG", "INFO", "WARN", "ERROR"];

/// Map a level string to its display colour.
fn level_color(level: &str) -> Color32 {
    match level {
        "ERROR" => theme::ERROR,
        "WARN" => theme::WARNING,
        "INFO" => theme::accent_text(),
        "DEBUG" => theme::text_tertiary(),
        _ => theme::text_secondary(), // TRACE & unknown
    }
}

/// Map a level string to an index (0..4).
fn level_index(level: &str) -> usize {
    match level {
        "TRACE" => 0,
        "DEBUG" => 1,
        "INFO" => 2,
        "WARN" => 3,
        "ERROR" => 4,
        _ => 0,
    }
}

pub struct TerminalPage;

impl TerminalPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Système", "Terminal"],
            "Terminal Analytique",
            Some("Flux temps réel des événements et de l'activité de l'agent."),
            Some(
                "Suivez en temps réel l'activité technique de l'agent. Ce flux bas niveau est utile pour le diagnostic et la vérification du bon fonctionnement des modules de scan et de surveillance.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Stats bar
        Self::stats_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // Filter bar
        Self::filter_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // Terminal viewport
        Self::terminal_viewport(ui, state);

        ui.add_space(theme::SPACE_XL);

        Self::detail_drawer(ui, state);

        command
    }

    // ------------------------------------------------------------------
    // Stats bar
    // ------------------------------------------------------------------

    fn stats_bar(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Uptime
                let uptime_secs = state.resources.uptime_secs;
                Self::stat_item(
                    ui,
                    "DURÉE D'ACTIVITÉ",
                    &crate::format::duration_short(uptime_secs),
                    theme::accent_text(),
                );

                ui.add_space(theme::SPACE_LG);

                // Total events
                Self::stat_item(
                    ui,
                    "ÉVÉNEMENTS GÉNÉRÉS",
                    &crate::format::int(state.terminal.event_count),
                    theme::text_primary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Events per minute
                let epm = if uptime_secs > 0 {
                    (state.terminal.event_count as f64 / (uptime_secs as f64 / 60.0)) as u64
                } else {
                    0
                };
                Self::stat_item(
                    ui,
                    "DÉBIT (ÉV./MIN)",
                    &epm.to_string(),
                    theme::text_tertiary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Errors
                Self::stat_item(
                    ui,
                    "ERREURS DÉTECTÉES",
                    &state.terminal.error_count.to_string(),
                    if state.terminal.error_count > 0 {
                        theme::ERROR
                    } else {
                        theme::SUCCESS
                    },
                );
            });
        });
    }

    fn stat_item(ui: &mut Ui, label: &str, value: &str, color: Color32) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_card_value())
                    .color(color)
                    .strong(),
            );
        });
    }

    // ------------------------------------------------------------------
    // Filter bar
    // ------------------------------------------------------------------

    fn filter_bar(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("NIVEAU D'EXPOSITION :")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong()
                        .extra_letter_spacing(theme::TRACKING_NORMAL),
                );
                ui.add_space(theme::SPACE_SM);

                for (i, name) in LEVEL_NAMES.iter().enumerate() {
                    let level = LogLevel::from_index(i);
                    let selected = state.terminal.filter_level == level;
                    let color = level_color(name);

                    if widgets::chip_button(ui, name, selected, color).clicked() {
                        state.terminal.filter_level = level;
                    }
                    ui.add_space(theme::SPACE_XS);
                }

                ui.add_space(theme::SPACE_LG);

                // Search field
                ui.label(
                    egui::RichText::new("FILTRAGE ANALYTIQUE :")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong()
                        .extra_letter_spacing(theme::TRACKING_NORMAL),
                );
                ui.add_space(theme::SPACE_XS);
                let search_width = (ui.available_width() - 120.0).clamp(150.0, 480.0);
                widgets::SearchInput::new(&mut state.terminal.search, "Rechercher…")
                    .width(search_width)
                    .height(theme::SEARCH_INPUT_HEIGHT)
                    .font(theme::font_mono_sm())
                    .id_salt("terminal_search")
                    .show(ui);

                // Export lives on the row it applies to, as on every list page.
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked()
                        {
                            let success = Self::export_logs_csv(state);
                            let time = ui.input(|i| i.time);
                            state.toasts.push(if success {
                                crate::widgets::toast::Toast::success(
                                    "Export CSV du terminal réussi",
                                )
                                .with_time(time)
                            } else {
                                crate::widgets::toast::Toast::error(
                                    "Échec de l'export CSV du terminal",
                                )
                                .with_time(time)
                            });
                        }
                    },
                );
            });
        });
    }

    // ------------------------------------------------------------------
    // Terminal viewport
    // ------------------------------------------------------------------

    fn terminal_viewport(ui: &mut Ui, state: &mut AppState) {
        let terminal_bg = theme::bg_deep();
        let filter_level_index = state.terminal.filter_level.index();
        let search_id = ui.id().with("terminal_search_cache");
        let search_lower: String = ui
            .memory(|mem| {
                mem.data
                    .get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.terminal.search)
                    .map(|(_, lower)| lower)
            })
            .unwrap_or_else(|| {
                let lower = if state.terminal.search.is_empty() {
                    String::new()
                } else {
                    state.terminal.search.to_lowercase()
                };
                ui.memory_mut(|mem| {
                    mem.data
                        .insert_temp(search_id, (state.terminal.search.clone(), lower.clone()))
                });
                lower
            });

        let filtered: Vec<(usize, &_)> = state
            .terminal
            .lines
            .iter()
            .enumerate()
            .filter(|(_, e)| {
                let entry_level = level_index(&e.level);
                if entry_level < filter_level_index {
                    return false;
                }
                if !search_lower.is_empty()
                    && !e.level.to_lowercase().contains(&search_lower)
                    && !e.target.to_lowercase().contains(&search_lower)
                    && !e.message.to_lowercase().contains(&search_lower)
                {
                    return false;
                }
                true
            })
            .collect();

        egui::Frame::new()
            .fill(terminal_bg)
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
            .show(ui, |ui: &mut egui::Ui| {
                ui.set_min_height(theme::VIEWPORT_MIN_HEIGHT);

                if filtered.is_empty() {
                    crate::widgets::empty_state(
                        ui,
                        icons::TERMINAL,
                        "Aucun événement détecté",
                        Some("Les événements système apparaîtront ici."),
                    );
                    return;
                }

                use widgets::table;

                let selected = state.terminal.selected_log;
                let mut clicked: Option<usize> = None;

                // The console is a live stream, so unlike the list pages it
                // keeps a bounded scroll of its own; the wheel still reaches
                // the page once the console has nothing more to scroll.
                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fixed(100.0),      // Heure
                        table::Col::fixed(64.0),       // Niveau
                        table::Col::fluid(120.0, 1.0), // Cible
                        table::Col::fluid(200.0, 4.0), // Message
                    ],
                )
                .vscroll(true)
                .max_scroll_height(theme::VIEWPORT_MIN_HEIGHT)
                .stick_to_bottom(true)
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "HEURE");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "NIVEAU");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "CIBLE");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "MESSAGE D'ACTIVITÉ");
                    });
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                        let Some(&(original_idx, entry)) = filtered.get(row.index()) else {
                            return;
                        };
                        let ts = entry.timestamp.format("%H:%M:%S%.3f").to_string();
                        let color = level_color(&entry.level);
                        let target_short = shorten_target(&entry.target);
                        let is_selected = selected == Some(original_idx);

                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            table::cell_mono_muted(ui, &ts);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            table::cell_colored(ui, &entry.level, color);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            table::cell_mono(ui, target_short);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            table::cell_mono(ui, &entry.message);
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked = Some(original_idx);
                        }
                    });
                });

                if let Some(idx) = clicked {
                    state.terminal.selected_log = Some(idx);
                    state.terminal.detail_open = true;
                }
            });
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState) {
        let selected = match state.terminal.selected_log {
            Some(idx) if idx < state.terminal.lines.len() => idx,
            _ => return,
        };

        let entry = &state.terminal.lines[selected];
        let ts = entry.timestamp.format("%d/%m/%Y %H:%M:%S%.3f").to_string();
        let level = entry.level.clone();
        let target = entry.target.clone();
        let message = entry.message.clone();
        let level_clr = level_color(&level);

        let actions = [
            widgets::DetailAction::secondary("Copier", icons::COPY),
            widgets::DetailAction::secondary("Filtrer par source", icons::SEARCH),
        ];

        let action =
            widgets::DetailDrawer::new("terminal_detail", "Entrée de log", icons::TERMINAL)
                .accent(level_clr)
                .subtitle(&level)
                .show(
                    ui.ctx(),
                    &mut state.terminal.detail_open,
                    |ui| {
                        widgets::detail_section(ui, "ENTRÉE DE LOG");
                        widgets::detail_field(ui, "Horodatage", &ts);
                        widgets::detail_field_badge(ui, "Niveau", &level, level_clr);
                        widgets::detail_mono(ui, "Source", &target);

                        widgets::detail_section(ui, "MESSAGE");
                        widgets::detail_text(ui, "Contenu", &message);
                    },
                    &actions,
                );

        match action {
            Some(0) => {
                let text = format!("[{}] {} {} {}", ts, level, target, message);
                ui.ctx().copy_text(text);
            }
            Some(1) => {
                state.terminal.search = shorten_target(&target).to_string();
            }
            _ => {}
        }
    }

    fn export_logs_csv(state: &AppState) -> bool {
        let headers = &["timestamp", "level", "target", "message"];
        let rows: Vec<Vec<String>> = state
            .terminal
            .lines
            .iter()
            .map(|l| {
                vec![
                    l.timestamp.to_rfc3339(),
                    l.level.clone(),
                    l.target.clone(),
                    l.message.clone(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("agent_terminal_logs.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}

/// Shorten a module target path for display.
/// e.g. "agent_core::api_client" -> "api_client"
fn shorten_target(target: &str) -> &str {
    target.rsplit("::").next().unwrap_or(target)
}
