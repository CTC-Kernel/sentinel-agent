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

        ui.add_space(theme::SPACE_XS);
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
        widgets::data_card(ui, "Journal d’activité", |ui| {
            Self::terminal_viewport(ui, state)
        });

        ui.add_space(theme::SPACE_XL);

        Self::detail_drawer(ui, state);

        command
    }

    // ------------------------------------------------------------------
    // Stats bar
    // ------------------------------------------------------------------

    fn stats_bar(ui: &mut Ui, state: &mut AppState) {
        widgets::data_card(ui, "Indicateurs d’activité", |ui: &mut egui::Ui| {
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

                // Throughput per minute, or per hour when that would round
                // to zero: 1 300 events over three days read as "0".
                let per_min = if uptime_secs > 0 {
                    state.terminal.event_count as f64 / (uptime_secs as f64 / 60.0)
                } else {
                    0.0
                };
                let (label, value) = if per_min >= 1.0 || uptime_secs == 0 {
                    (
                        "DÉBIT (ÉV./MIN)",
                        crate::format::int(per_min.round() as u64),
                    )
                } else {
                    (
                        "DÉBIT (ÉV./H)",
                        crate::format::int((per_min * 60.0).round() as u64),
                    )
                };
                Self::stat_item(ui, label, &value, theme::text_primary());

                ui.add_space(theme::SPACE_LG);

                // Errors
                if Self::stat_item(
                    ui,
                    "ERREURS DÉTECTÉES",
                    &state.terminal.error_count.to_string(),
                    if state.terminal.error_count > 0 {
                        theme::ERROR
                    } else {
                        theme::SUCCESS
                    },
                ) {
                    state.terminal.filter_level = LogLevel::Error;
                    state.terminal.search.clear();
                    widgets::open_data_panel(ui.ctx(), "Journal d’activité");
                }
            });
        });
    }

    fn stat_item(ui: &mut Ui, label: &str, value: &str, color: Color32) -> bool {
        let item = ui.vertical(|ui: &mut egui::Ui| {
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
                    .color(theme::readable_color(color))
                    .strong(),
            );
        });
        let response = ui
            .interact(
                item.response.rect,
                item.response.id.with("stat_detail"),
                egui::Sense::click(),
            )
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .on_hover_text("Consulter le journal d’activité");
        if response.clicked() {
            widgets::open_data_panel(ui.ctx(), "Journal d’activité");
        }
        response.clicked()
    }

    // ------------------------------------------------------------------
    // Filter bar
    // ------------------------------------------------------------------

    fn filter_bar(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("Niveau")
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
            });
            ui.add_space(theme::SPACE_SM);
            ui.horizontal(|ui| {
                // Search field
                ui.label(
                    egui::RichText::new("Rechercher")
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
                        if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD))
                            .on_hover_text("Exporter les lignes affichées au format CSV")
                            .clicked()
                        {
                            let sort = widgets::table::sort_of(ui.ctx(), TERMINAL_TABLE);
                            let toast = match Self::export_logs_csv(state, &sort) {
                                Ok(path) => crate::widgets::toast::Toast::success(format!(
                                    "Export CSV enregistré : {}",
                                    path.display()
                                )),
                                Err(error) => crate::widgets::toast::Toast::error(format!(
                                    "Export CSV impossible : {error}"
                                )),
                            };
                            state.toasts.push(toast.with_time(ui.input(|i| i.time)));
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

        let sort = widgets::table::sort_of(ui.ctx(), TERMINAL_TABLE);
        let filtered = displayed_lines(
            &state.terminal.lines,
            filter_level_index,
            &search_lower,
            &sort,
        );
        let buffer_empty = state.terminal.lines.is_empty();

        egui::Frame::new()
            .fill(terminal_bg)
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
            .show(ui, |ui: &mut egui::Ui| {
                ui.set_min_height(theme::VIEWPORT_MIN_HEIGHT);

                if filtered.is_empty() {
                    if buffer_empty {
                        crate::widgets::empty_state(
                            ui,
                            icons::TERMINAL,
                            "Aucun événement détecté",
                            Some("Les événements système apparaîtront ici."),
                        );
                    } else {
                        // Lines exist: the level or the search hides them.
                        crate::widgets::empty_state(
                            ui,
                            icons::SEARCH,
                            "Aucun résultat",
                            Some("Aucune ligne ne correspond au niveau ou à la recherche."),
                        );
                    }
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
                        table::Col::fluid(120.0, 1.0), // Source
                        table::Col::fluid(200.0, 4.0), // Message
                    ],
                )
                .vscroll(true)
                .max_scroll_height(theme::VIEWPORT_MIN_HEIGHT)
                .stick_to_bottom(true)
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    for (label, key) in [
                        ("HEURE", "time"),
                        ("NIVEAU", "level"),
                        ("SOURCE", "source"),
                        ("MESSAGE D'ACTIVITÉ", "message"),
                    ] {
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell_sortable(ui, label, TERMINAL_TABLE, key);
                        });
                    }
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                        let Some(&(original_idx, entry)) = filtered.get(row.index()) else {
                            return;
                        };
                        let ts = crate::format::local_time_secs(entry.timestamp);
                        let color = level_color(&entry.level);
                        let target_short = shorten_target(&entry.target);
                        let is_selected = selected == Some(original_idx);

                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            table::cell_mono_muted(ui, &ts);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            widgets::status_badge(ui, &entry.level, color);
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
        let ts = crate::format::local_datetime_millis(entry.timestamp);
        let level = entry.level.clone();
        let target = entry.target.clone();
        let message = entry.message.clone();
        let level_clr = level_color(&level);

        let actions = [
            widgets::DetailAction::secondary("Copier", icons::COPY),
            widgets::DetailAction::secondary("Filtrer par source", icons::SEARCH),
        ];

        let action =
            widgets::DetailDrawer::new("terminal_detail", "Entrée du journal", icons::TERMINAL)
                .accent(level_clr)
                .subtitle(&level)
                .show(
                    ui.ctx(),
                    &mut state.terminal.detail_open,
                    |ui| {
                        widgets::detail_section(ui, "ENTRÉE DU JOURNAL");
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

    /// Export the lines the level filter and the search leave on screen, in
    /// the displayed order.
    fn export_logs_csv(
        state: &AppState,
        sort: &widgets::TableSort,
    ) -> Result<std::path::PathBuf, String> {
        let headers = &["horodatage", "niveau", "source", "message"];
        let level = state.terminal.filter_level.index();
        let search = state.terminal.search.to_lowercase();
        let rows: Vec<Vec<String>> = displayed_lines(&state.terminal.lines, level, &search, sort)
            .into_iter()
            .map(|(_, l)| {
                vec![
                    l.timestamp.to_rfc3339(),
                    l.level.clone(),
                    l.target.clone(),
                    l.message.clone(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("agent_terminal_logs.csv");
        crate::export::export_csv(headers, &rows, &path)?;
        Ok(path)
    }
}

/// Name of the console table, for its sort state.
const TERMINAL_TABLE: &str = "terminal_journal";

/// The lines on screen with their index in the buffer: filtered, then in the
/// order `sort` asks for (stable; the stream's own order without a sort).
fn displayed_lines<'a>(
    lines: &'a std::collections::VecDeque<crate::events::TerminalLogEntry>,
    min_level: usize,
    search_lower: &str,
    sort: &widgets::TableSort,
) -> Vec<(usize, &'a crate::events::TerminalLogEntry)> {
    let mut lines: Vec<_> = lines
        .iter()
        .enumerate()
        .filter(|(_, e)| line_matches(e, min_level, search_lower))
        .collect();
    if let Some(key) = widgets::table::sort_key(sort) {
        lines.sort_by(|(_, a), (_, b)| widgets::table::directed(sort, compare_lines(a, b, key)));
    }
    lines
}

/// Natural (ascending) order of two lines on a column.
fn compare_lines(
    a: &crate::events::TerminalLogEntry,
    b: &crate::events::TerminalLogEntry,
    key: &str,
) -> std::cmp::Ordering {
    match key {
        "time" => a.timestamp.cmp(&b.timestamp),
        // TRACE to ERROR, not alphabetical.
        "level" => level_index(&a.level).cmp(&level_index(&b.level)),
        "source" => shorten_target(&a.target)
            .to_lowercase()
            .cmp(&shorten_target(&b.target).to_lowercase()),
        "message" => a.message.to_lowercase().cmp(&b.message.to_lowercase()),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Whether a line passes the minimum level and the lower-cased search text.
fn line_matches(
    entry: &crate::events::TerminalLogEntry,
    min_level: usize,
    search_lower: &str,
) -> bool {
    level_index(&entry.level) >= min_level
        && (search_lower.is_empty()
            || entry.level.to_lowercase().contains(search_lower)
            || entry.target.to_lowercase().contains(search_lower)
            || entry.message.to_lowercase().contains(search_lower))
}

/// Shorten a module target path for display.
/// e.g. "agent_core::api_client" -> "api_client"
fn shorten_target(target: &str) -> &str {
    target.rsplit("::").next().unwrap_or(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::widgets::{SortDirection, TableSort};

    fn state_with(lines: &[(&str, &str, &str)]) -> AppState {
        let mut state = AppState::default();
        for (second, (level, target, message)) in lines.iter().enumerate() {
            state
                .terminal
                .lines
                .push_back(crate::events::TerminalLogEntry {
                    timestamp: chrono::DateTime::parse_from_rfc3339(&format!(
                        "2026-06-30T12:00:{second:02}Z"
                    ))
                    .unwrap()
                    .with_timezone(&chrono::Utc),
                    level: (*level).into(),
                    target: (*target).into(),
                    message: (*message).into(),
                });
        }
        state
    }

    #[test]
    fn displayed_lines_are_filtered_then_sorted_by_meaning() {
        let state = state_with(&[
            ("WARN", "agent_core::sync", "b"),
            ("DEBUG", "agent_core::Api", "a"),
            ("ERROR", "agent_core::fim", "C"),
            ("INFO", "agent_core::api", "d"),
        ]);
        let messages = |min_level: usize, search: &str, sort: &TableSort| -> Vec<&str> {
            displayed_lines(&state.terminal.lines, min_level, search, sort)
                .into_iter()
                .map(|(_, line)| line.message.as_str())
                .collect()
        };
        assert_eq!(messages(0, "", &TableSort::default()), ["b", "a", "C", "d"]);
        // By level rank: DEBUG, INFO, WARN, ERROR.
        assert_eq!(
            messages(0, "", &TableSort::by("level", SortDirection::Ascending)),
            ["a", "d", "b", "C"]
        );
        assert_eq!(
            messages(0, "", &TableSort::by("message", SortDirection::Descending)),
            ["d", "C", "b", "a"]
        );
        // Stable on the shortened, case-folded source: api, api, fim, sync.
        assert_eq!(
            messages(0, "", &TableSort::by("source", SortDirection::Ascending)),
            ["a", "d", "C", "b"]
        );
        // The filters apply first; the buffer index is kept.
        let filtered = displayed_lines(
            &state.terminal.lines,
            3,
            "",
            &TableSort::by("time", SortDirection::Descending),
        );
        let indices: Vec<usize> = filtered.iter().map(|(idx, _)| *idx).collect();
        assert_eq!(indices, [2, 0]);
    }
}
