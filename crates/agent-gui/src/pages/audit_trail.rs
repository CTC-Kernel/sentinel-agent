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

/// Name the sort of the journal table is kept under.
const JOURNAL_TABLE: &str = "audit_journal";

/// The three levels the journal shows. Entries arrive with the level of a
/// log line ("warn") or the severity of a notification ("warning", "high",
/// "critical"…): the chip, the badge and the drawer all read them here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LevelClass {
    Info,
    Warning,
    Error,
}

impl LevelClass {
    fn of(level: &str) -> Self {
        match level.to_lowercase().as_str() {
            "error" | "critical" | "high" | "fatal" => Self::Error,
            "warn" | "warning" | "medium" => Self::Warning,
            _ => Self::Info,
        }
    }

    /// The value of the level chip that selects this class.
    fn filter_key(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warn",
            Self::Error => "error",
        }
    }

    fn display(self) -> (&'static str, egui::Color32) {
        match self {
            Self::Info => ("INFO", theme::INFO),
            Self::Warning => ("AVERTISSEMENT", theme::WARNING),
            Self::Error => ("ERREUR", theme::ERROR),
        }
    }
}

impl AuditTrailPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        // What the agent recorded in its database is asked for when the
        // page opens and refreshed while it is shown.
        let command = state.take_audit_history_refresh(ui.input(|i| i.time));

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
        let n_items = Self::filtered(state).len();
        let search_before = state.audit_trail_search.clone();
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
        // Rows are selected by position in the filtered list: a new search
        // changes what each position holds.
        if state.audit_trail_search != search_before {
            state.selected_audit_entry = None;
            state.audit_detail_open = false;
            state.audit_trail_page = 0;
        }
        if export_clicked {
            let rows: Vec<crate::dto::GuiLogEntry> = Self::displayed(ui.ctx(), state)
                .into_iter()
                .cloned()
                .collect();
            Self::export_with_toast(ui, state, &rows);
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
            state.audit_trail_page = 0;
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

    /// The rows shown: the persistent trail and the session, most recent
    /// first, narrowed by the level chip and the search field.
    fn filtered(state: &AppState) -> Vec<&crate::dto::GuiLogEntry> {
        let level = state.audit_trail_filter.as_deref();
        let search = state.audit_trail_search.to_lowercase();
        state
            .audit_entries()
            .into_iter()
            .filter(|log| {
                if let Some(level) = level
                    && LevelClass::of(&log.level).filter_key() != level
                {
                    return false;
                }
                search.is_empty()
                    || log.message.to_lowercase().contains(&search)
                    || log
                        .source
                        .as_ref()
                        .is_some_and(|s| s.to_lowercase().contains(&search))
            })
            .collect()
    }

    /// The filtered rows in the order the sorted column asks for; most
    /// recent first without a sort. The table, the drawer (rows are selected
    /// by position) and the export all read this list.
    fn displayed<'a>(ctx: &egui::Context, state: &'a AppState) -> Vec<&'a crate::dto::GuiLogEntry> {
        let mut rows = Self::filtered(state);
        sort_rows(&mut rows, &widgets::table::sort_of(ctx, JOURNAL_TABLE));
        rows
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState) {
        let filtered_logs = Self::displayed(ui.ctx(), state);

        let selected = match state.selected_audit_entry {
            Some(idx) if idx < filtered_logs.len() => idx,
            _ => return,
        };

        let log = filtered_logs[selected].clone();
        let id_str = log.id.to_string();
        let ts = crate::format::local_datetime_secs(log.timestamp);
        let message = log.message.clone();
        let source = log.source.clone();
        let (level_label, level_color) = LevelClass::of(&log.level).display();

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
                    widgets::detail_field_badge(ui, "Niveau", level_label, level_color);
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
                state.push_toast(
                    crate::widgets::toast::Toast::success("Identifiant copié"),
                    ui.ctx(),
                );
            }
            Some(1) => Self::export_with_toast(ui, state, std::slice::from_ref(&log)),
            _ => {}
        }
    }

    /// Export `rows` and tell the operator where the file is, or that it failed.
    fn export_with_toast(ui: &Ui, state: &mut AppState, rows: &[crate::dto::GuiLogEntry]) {
        let toast = match Self::export_csv(rows) {
            Ok(path) => crate::widgets::toast::Toast::success(format!(
                "{} : {}",
                if rows.len() == 1 {
                    "Événement exporté".to_string()
                } else {
                    format!(
                        "{} exporté{}",
                        crate::format::count(rows.len(), "événement"),
                        crate::format::plural_suffix(rows.len())
                    )
                },
                path.display()
            )),
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                crate::widgets::toast::Toast::error(format!(
                    "Échec de l’export du journal d’audit : {e}"
                ))
            }
        };
        state.push_toast(toast, ui.ctx());
    }

    /// Write `rows` to a timestamped CSV file and return its path.
    fn export_csv(rows: &[crate::dto::GuiLogEntry]) -> Result<std::path::PathBuf, String> {
        let headers = &["identifiant", "date", "niveau", "message", "source"];
        let rows: Vec<Vec<String>> = rows.iter().map(Self::csv_row).collect();
        crate::export::export_csv_timestamped("journal_audit", headers, &rows)
    }

    fn csv_row(entry: &crate::dto::GuiLogEntry) -> Vec<String> {
        vec![
            entry.id.to_string(),
            entry.timestamp.to_rfc3339(),
            entry.level.clone(),
            entry.message.clone(),
            entry.source.clone().unwrap_or_default(),
        ]
    }

    fn render_table(ui: &mut Ui, state: &mut AppState) {
        // Owned: the table below needs `state` again for its selection.
        let filtered_logs: Vec<crate::dto::GuiLogEntry> = Self::displayed(ui.ctx(), state)
            .into_iter()
            .cloned()
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
        let mut sort_changed = false;

        table::fluid_clickable(
            ui,
            &[
                table::Col::fluid(150.0, 0.0), // Horodatage
                table::Col::fluid(136.0, 0.0), // Niveau: "AVERTISSEMENT" whole
                table::Col::fluid(200.0, 1.0), // Détails de l'événement
            ],
        )
        .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
            for (label, key) in [
                ("HORODATAGE", "time"),
                ("NIVEAU", "level"),
                ("D\u{00c9}TAILS DE L'\u{00c9}V\u{00c9}NEMENT", "message"),
            ] {
                header.col(|ui| {
                    sort_changed |= table::header_cell_sortable(ui, label, JOURNAL_TABLE, key);
                });
            }
        })
        .body(|body| {
            body.rows(theme::TABLE_ROW_HEIGHT, at_len, |mut row| {
                let idx = at_start + row.index();
                let Some(log) = filtered_logs.get(idx) else {
                    return;
                };
                let is_selected = selected == Some(idx);
                row.set_selected(is_selected);

                row.col(|ui| {
                    table::cell_secondary(ui, &crate::format::local_datetime_secs(log.timestamp));
                });

                row.col(|ui| {
                    let (label, color) = LevelClass::of(&log.level).display();
                    widgets::status_badge(ui, label, color);
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
        // Rows are selected by position: a new order changes what each
        // position holds.
        if sort_changed {
            state.selected_audit_entry = None;
            state.audit_detail_open = false;
            state.audit_trail_page = 0;
        }

        widgets::paginate_controls(
            ui,
            filtered_logs.len(),
            AUDIT_PER_PAGE,
            &mut state.audit_trail_page,
        );
    }
}

/// Reorder the rows on the sorted column; untouched without a sort. Stable.
fn sort_rows(rows: &mut [&crate::dto::GuiLogEntry], sort: &widgets::data_table::TableSort) {
    if let Some(key) = widgets::table::sort_key(sort) {
        rows.sort_by(|a, b| widgets::table::directed(sort, compare_entries(key, a, b)));
    }
}

/// Natural (ascending) order of two entries on the column `key`: oldest
/// first, information before warning before error, text without case.
fn compare_entries(
    key: &str,
    a: &crate::dto::GuiLogEntry,
    b: &crate::dto::GuiLogEntry,
) -> std::cmp::Ordering {
    let rank = |entry: &crate::dto::GuiLogEntry| match LevelClass::of(&entry.level) {
        LevelClass::Info => 0_u8,
        LevelClass::Warning => 1,
        LevelClass::Error => 2,
    };
    match key {
        "time" => a.timestamp.cmp(&b.timestamp),
        "level" => rank(a).cmp(&rank(b)),
        "message" => a.message.to_lowercase().cmp(&b.message.to_lowercase()),
        _ => std::cmp::Ordering::Equal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(level: &str, message: &str) -> crate::dto::GuiLogEntry {
        crate::dto::GuiLogEntry {
            id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            level: level.into(),
            message: message.into(),
            source: None,
        }
    }

    /// Regression: the chips compared the raw level, so a "warning" or
    /// "critical" notification was shown with its badge but never filtered in.
    #[test]
    fn level_chips_select_what_the_badges_show() {
        let mut state = AppState::default();
        for (level, message) in [
            ("info", "a"),
            ("warn", "b"),
            ("warning", "c"),
            ("medium", "d"),
            ("error", "e"),
            ("critical", "f"),
            ("high", "g"),
            ("INFO", "h"),
        ] {
            state.logs.push_back(entry(level, message));
        }
        let shown = |state: &AppState| {
            let mut messages: Vec<String> = AuditTrailPage::filtered(state)
                .iter()
                .map(|log| log.message.clone())
                .collect();
            messages.sort();
            messages.concat()
        };
        state.audit_trail_filter = Some("info".into());
        assert_eq!(shown(&state), "ah");
        state.audit_trail_filter = Some("warn".into());
        assert_eq!(shown(&state), "bcd");
        state.audit_trail_filter = Some("error".into());
        assert_eq!(shown(&state), "efg");
        state.audit_trail_filter = None;
        assert_eq!(shown(&state), "abcdefgh");
    }

    #[test]
    fn the_journal_sorts_levels_by_gravity_and_dates_by_time() {
        use widgets::data_table::{SortDirection, TableSort};
        let mut first = entry("warning", "beta");
        let mut second = entry("critical", "Alpha");
        let mut third = entry("info", "gamma");
        let now = chrono::Utc::now();
        first.timestamp = now - chrono::Duration::minutes(5);
        second.timestamp = now - chrono::Duration::minutes(50);
        third.timestamp = now;
        let order = |key: &str, direction| {
            let mut rows = vec![&first, &second, &third];
            sort_rows(&mut rows, &TableSort::by(key, direction));
            rows.iter()
                .map(|row| row.message.clone())
                .collect::<Vec<_>>()
                .concat()
        };
        // Info, warning, error — "critical" is not before "info".
        assert_eq!(order("level", SortDirection::Ascending), "gammabetaAlpha");
        assert_eq!(order("level", SortDirection::Descending), "Alphabetagamma");
        assert_eq!(order("time", SortDirection::Ascending), "Alphabetagamma");
        assert_eq!(order("message", SortDirection::Ascending), "Alphabetagamma");
        assert_eq!(order("message", SortDirection::None), "betaAlphagamma");
    }

    #[test]
    fn a_csv_row_carries_the_identifier() {
        let log = entry("warn", "Isolement levé");
        let row = AuditTrailPage::csv_row(&log);
        assert_eq!(row[0], log.id.to_string());
        assert_eq!(&row[2..4], ["warn", "Isolement levé"]);
    }
}
