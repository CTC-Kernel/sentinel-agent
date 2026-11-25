// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Forensic timeline sub-tab — unified event timeline with search, filters,
//! CSV export and a correlation modal.

use chrono::{DateTime, Duration, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::{Severity, TimelineRange};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{Cell, ColumnAlign, ColumnWidth, DataTable, TableColumn};
use crate::widgets::pagination::PaginationState;

const ITEMS_PER_PAGE: usize = 25;
/// Correlation window: events within +/- 5 minutes.
const CORRELATION_WINDOW_SECS: i64 = 300;

/// A unified timeline event from any source.
#[derive(Clone)]
struct TimelineEvent {
    timestamp: DateTime<Utc>,
    source: &'static str,
    severity: Severity,
    title: String,
    detail: String,
    /// Index in the source collection: with `source`, the event's identity.
    source_index: usize,
}

/// Name of the timeline table, under which its sort order is kept.
const TABLE: &str = "forensic_timeline";

/// Rank of a severity, lowest first.
fn severity_rank(severity: Severity) -> u8 {
    match severity {
        Severity::Critical => 4,
        Severity::High => 3,
        Severity::Medium => 2,
        Severity::Low => 1,
        Severity::Info => 0,
    }
}

/// Ascending order of two events on a column of the table.
fn event_order(key: &str, a: &TimelineEvent, b: &TimelineEvent) -> std::cmp::Ordering {
    use super::types::text_order;
    match key {
        "severity" => severity_rank(a.severity).cmp(&severity_rank(b.severity)),
        "source" => source_label_fr(a.source).cmp(source_label_fr(b.source)),
        "title" => text_order(&a.title, &b.title),
        "detail" => text_order(&a.detail, &b.detail),
        "date" => a.timestamp.cmp(&b.timestamp),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Correlated events listed before « voir tout ».
const CORRELATED_SHOWN: usize = 20;

/// An event the modal asks the table to select next: source and index.
type Selection = (&'static str, usize);

fn search_id() -> egui::Id {
    egui::Id::new("forensic_search")
}

fn pending_selection_id() -> egui::Id {
    egui::Id::new("forensic_pending_selection")
}

/// Whether an event matches the text typed by the operator.
fn matches_search(event: &TimelineEvent, search_lower: &str) -> bool {
    event.title.to_lowercase().contains(search_lower)
        || event.detail.to_lowercase().contains(search_lower)
        || source_label_fr(event.source)
            .to_lowercase()
            .contains(search_lower)
}

/// Export the events shown to CSV. Returns the file written.
fn export_csv(events: &[TimelineEvent]) -> Result<std::path::PathBuf, String> {
    let headers = &["date", "severite", "source", "titre", "detail"];
    let rows: Vec<Vec<String>> = events
        .iter()
        .map(|e| {
            vec![
                e.timestamp.to_rfc3339(),
                e.severity.label().to_lowercase(),
                source_label_fr(e.source).to_string(),
                e.title.clone(),
                e.detail.clone(),
            ]
        })
        .collect();
    crate::export::export_csv_timestamped("chronologie", headers, &rows)
}

/// Source filter chips.
const SOURCE_FILTERS: &[(&str, &str)] = &[
    ("process", "PROCESSUS"),
    ("network", "R\u{00c9}SEAU"),
    ("fim", "FIM"),
    ("usb", "USB"),
    ("system", "SYST\u{00c8}ME"),
    ("vulnerability", "CVE"),
];

/// Severity filter chips.
const SEVERITY_FILTERS: &[(Severity, &str)] = &[
    (Severity::Critical, "CRITIQUE"),
    (Severity::High, "\u{00c9}LEV\u{00c9}"),
    (Severity::Medium, "MOYEN"),
    (Severity::Low, "FAIBLE"),
];

/// Render the forensic timeline tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    // The search text lives in the interface memory, like a table filter.
    let search_id = search_id();
    let mut search: String = ui.data(|d| d.get_temp(search_id)).unwrap_or_default();
    let mut export_clicked = false;

    // ── Filter bar ──────────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            if widgets::search_input(ui, &mut search, "Rechercher dans la chronologie\u{2026}")
                .changed()
            {
                state.threats.forensic_page = 0;
                state.threats.forensic_selected_event = None;
                state.threats.forensic_detail_open = false;
            }
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    export_clicked = widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD))
                        .on_hover_text("Exporter les \u{00e9}v\u{00e9}nements affich\u{00e9}s")
                        .clicked();
                },
            );
        });
        ui.add_space(theme::SPACE_SM);

        // Time range chips
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("P\u{00c9}RIODE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_SM);
            for range in TimelineRange::all() {
                let active = state.threats.forensic_time_range == *range;
                if widgets::chip_button(ui, range.label_fr(), active, theme::ACCENT).clicked() {
                    state.threats.forensic_time_range = *range;
                    state.threats.forensic_page = 0;
                    state.threats.forensic_selected_event = None;
                    state.threats.forensic_detail_open = false;
                }
            }
        });

        ui.add_space(theme::SPACE_XS);

        // Source chips (toggle)
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("SOURCE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_SM);
            for (key, label) in SOURCE_FILTERS {
                let active = state
                    .threats
                    .forensic_source_filter
                    .as_deref()
                    .is_some_and(|f| f == *key);
                if widgets::chip_button(ui, label, active, theme::INFO).clicked() {
                    if active {
                        state.threats.forensic_source_filter = None;
                    } else {
                        state.threats.forensic_source_filter = Some((*key).to_string());
                    }
                    state.threats.forensic_page = 0;
                    state.threats.forensic_selected_event = None;
                    state.threats.forensic_detail_open = false;
                }
            }
        });

        ui.add_space(theme::SPACE_XS);

        // Severity chips (toggle)
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("S\u{00c9}V\u{00c9}RIT\u{00c9}")
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_SM);
            for (sev, label) in SEVERITY_FILTERS {
                let active = state
                    .threats
                    .forensic_severity_filter
                    .as_ref()
                    .is_some_and(|f| f == sev);
                let color = severity_color(sev);
                if widgets::chip_button(ui, label, active, color).clicked() {
                    if active {
                        state.threats.forensic_severity_filter = None;
                    } else {
                        state.threats.forensic_severity_filter = Some(*sev);
                    }
                    state.threats.forensic_page = 0;
                    state.threats.forensic_selected_event = None;
                    state.threats.forensic_detail_open = false;
                }
            }
        });
    });

    ui.add_space(theme::SPACE_MD);

    // ── Build unified event list ────────────────────────────────────
    let now = Utc::now();
    let cutoff = now
        .checked_sub_signed(Duration::seconds(
            state.threats.forensic_time_range.seconds(),
        ))
        .unwrap_or(now);

    let all_events = build_timeline(state, cutoff);
    let mut events = all_events.clone();

    // Apply source filter
    if let Some(ref src) = state.threats.forensic_source_filter {
        events.retain(|e| e.source == src.as_str());
    }

    // Apply severity filter
    if let Some(ref sev) = state.threats.forensic_severity_filter {
        events.retain(|e| e.severity == *sev);
    }

    // Apply text search
    let search_lower = search.trim().to_lowercase();
    if !search_lower.is_empty() {
        events.retain(|e| matches_search(e, &search_lower));
    }
    ui.data_mut(|d| d.insert_temp(search_id, search.clone()));

    // Newest first, then the column the header asks for; equal rows keep
    // the newest-first order. The export follows what is displayed.
    events.sort_by_key(|b| std::cmp::Reverse(b.timestamp));
    let sort = widgets::table::sort_of(ui.ctx(), TABLE);
    super::types::sort_rows(&mut events, &sort, event_order);

    let total = events.len();

    if export_clicked {
        let toast = match export_csv(&events) {
            Ok(path) => widgets::toast::Toast::success(format!(
                "Chronologie export\u{00e9}e : {}",
                path.display()
            )),
            Err(e) => {
                tracing::warn!("Timeline CSV export failed: {}", e);
                widgets::toast::Toast::error("\u{00c9}chec de l'export CSV de la chronologie")
            }
        };
        state.push_toast(toast, ui.ctx());
    }

    // A correlated event clicked in the modal becomes the selection, once
    // the filters that hid it are lifted.
    let pending: Option<Selection> = ui.data(|d| d.get_temp(pending_selection_id()));
    if let Some((source, source_index)) = pending {
        ui.data_mut(|d| d.remove::<Selection>(pending_selection_id()));
        if let Some(position) = events
            .iter()
            .position(|e| e.source == source && e.source_index == source_index)
        {
            state.threats.forensic_selected_event = Some(position);
            state.threats.forensic_detail_open = true;
            state.threats.forensic_page = position / ITEMS_PER_PAGE;
        }
    }

    // ── Event count ─────────────────────────────────────────────────
    ui.label(
        egui::RichText::new(format!(
            "{} sur la p\u{00e9}riode{}",
            crate::format::count(total, "\u{00e9}v\u{00e9}nement"),
            if total == all_events.len() {
                String::new()
            } else {
                format!(
                    " (sur {} avant filtres)",
                    crate::format::int(all_events.len())
                )
            }
        ))
        .font(theme::font_body())
        .color(theme::text_secondary()),
    );
    ui.add_space(theme::SPACE_SM);

    // ── Pagination ──────────────────────────────────────────────────
    // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
    let mut position = state.threats.forensic_selected_event;
    if widgets::navigate_list(
        ui.ctx(),
        &mut position,
        total,
        &mut state.threats.forensic_detail_open,
    ) && let Some(pos) = position
    {
        state.threats.forensic_selected_event = Some(pos);
        state.threats.forensic_page = pos / ITEMS_PER_PAGE;
    }

    let total_pages = total.div_ceil(ITEMS_PER_PAGE).max(1);
    if state.threats.forensic_page >= total_pages {
        state.threats.forensic_page = total_pages.saturating_sub(1);
    }
    let start = state.threats.forensic_page.saturating_mul(ITEMS_PER_PAGE);
    let end = total.min(start.saturating_add(ITEMS_PER_PAGE));
    let page_events = &events[start..end];

    // ── DataTable ───────────────────────────────────────────────────
    widgets::data_card(ui, "Chronologie forensique", |ui: &mut egui::Ui| {
        let columns = vec![
            TableColumn {
                key: "severity",
                label: "S\u{00c9}V\u{00c9}RIT\u{00c9}",
                width: ColumnWidth::Fixed(110.0),
                sortable: true,
                align: ColumnAlign::Center,
            },
            TableColumn {
                key: "source",
                label: "SOURCE",
                width: ColumnWidth::Fixed(120.0),
                sortable: true,
                align: ColumnAlign::Center,
            },
            TableColumn {
                key: "title",
                label: "TITRE",
                width: ColumnWidth::Fill,
                sortable: true,
                align: ColumnAlign::Left,
            },
            TableColumn {
                key: "detail",
                label: "D\u{00c9}TAIL",
                width: ColumnWidth::Fixed(250.0),
                sortable: true,
                align: ColumnAlign::Left,
            },
            TableColumn {
                key: "date",
                label: "DATE",
                // "05/10/2026 11:48" at the 14px body size, plus the sort mark.
                width: ColumnWidth::Fixed(176.0),
                sortable: true,
                align: ColumnAlign::Right,
            },
        ];

        let table = DataTable::new("forensic_timeline_table", columns).selectable();
        let mut header_sort = sort.clone();
        if table.show_header(ui, &mut header_sort) {
            ui.data_mut(|d| d.insert_temp(egui::Id::new(("table_sort", TABLE)), header_sort));
            // Rows are addressed by position: a new order must not leave
            // the modal on whichever event moved into that slot.
            state.threats.forensic_selected_event = None;
            state.threats.forensic_detail_open = false;
            state.threats.forensic_page = 0;
            ui.ctx().request_repaint();
        }

        if page_events.is_empty() {
            table.show_empty(
                ui,
                if all_events.is_empty() {
                    "Aucun \u{00e9}v\u{00e9}nement dans cette p\u{00e9}riode"
                } else {
                    "Aucun \u{00e9}v\u{00e9}nement ne correspond aux filtres"
                },
            );
        } else {
            for (row_idx, evt) in page_events.iter().enumerate() {
                // Severity as a pill in its colour, like the events table.
                let sev_label = evt.severity.label();
                let source_label = source_label_fr(evt.source);
                let date = crate::format::local_datetime(evt.timestamp);

                let cells = [
                    Cell::Badge(sev_label, severity_color(&evt.severity)),
                    Cell::Text(source_label),
                    Cell::Text(&evt.title),
                    Cell::Text(&evt.detail),
                    Cell::Text(&date),
                ];

                let global_idx = start.saturating_add(row_idx);
                let selected = state.threats.forensic_selected_event == Some(global_idx);

                ui.push_id(row_idx, |ui: &mut egui::Ui| {
                    if table.show_row_cells(ui, row_idx, selected, &cells) {
                        state.threats.forensic_selected_event = Some(global_idx);
                        state.threats.forensic_detail_open = true;
                    }
                });
            }
        }
    });

    // ── Pagination controls ─────────────────────────────────────────
    if total > ITEMS_PER_PAGE {
        ui.add_space(theme::SPACE_MD);
        let mut pag = PaginationState::new(total, ITEMS_PER_PAGE);
        pag.current_page = state.threats.forensic_page.saturating_add(1);
        if widgets::pagination(ui, &mut pag) {
            state.threats.forensic_page = pag.current_page.saturating_sub(1);
        }
    }

    // ── Correlation modal ───────────────────────────────────────────
    if state.threats.forensic_detail_open
        && let Some(sel_idx) = state.threats.forensic_selected_event
    {
        if let Some(selected_event) = events.get(sel_idx).cloned() {
            show_correlation(ui, state, &selected_event, &events, &all_events);
        } else {
            // Selection index out of range — close the modal
            state.threats.forensic_selected_event = None;
            state.threats.forensic_detail_open = false;
        }
    }

    None
}

/// The selected event and what happened around it (±5 min, every source).
fn show_correlation(
    ui: &mut Ui,
    state: &mut AppState,
    selected: &TimelineEvent,
    shown: &[TimelineEvent],
    all_events: &[TimelineEvent],
) {
    let sev_color = severity_color(&selected.severity);
    let ts_str = crate::format::local_datetime_secs(selected.timestamp);

    let window = Duration::seconds(CORRELATION_WINDOW_SECS);
    let window_start = selected
        .timestamp
        .checked_sub_signed(window)
        .unwrap_or(selected.timestamp);
    let window_end = selected
        .timestamp
        .checked_add_signed(window)
        .unwrap_or(selected.timestamp);

    // From the full timeline, not the filtered one: a filter on the
    // table must not hide what happened around the event.
    let mut correlated: Vec<&TimelineEvent> = all_events
        .iter()
        .filter(|e| {
            e.timestamp >= window_start
                && e.timestamp <= window_end
                && !(e.source == selected.source && e.source_index == selected.source_index)
        })
        .collect();
    correlated.sort_by_key(|e| std::cmp::Reverse(e.timestamp));

    let show_all_id = egui::Id::new((
        "forensic_correlated_all",
        selected.source,
        selected.source_index,
    ));
    let mut show_all: bool = ui.data(|d| d.get_temp(show_all_id)).unwrap_or(false);
    let mut clicked_correlated: Option<Selection> = None;

    let actions = [
        widgets::DetailAction::primary("Ouvrir l'\u{00e9}v\u{00e9}nement", icons::ARROW_RIGHT),
        widgets::DetailAction::secondary("Copier les d\u{00e9}tails", icons::COPY),
    ];
    let action = widgets::DetailDrawer::new("forensic_correlation", &selected.title, icons::CLOCK)
        .accent(sev_color)
        .subtitle(source_label_fr(selected.source))
        .show(
            ui.ctx(),
            &mut state.threats.forensic_detail_open,
            |ui| {
                widgets::detail_section(ui, "\u{00c9}V\u{00c9}NEMENT S\u{00c9}LECTIONN\u{00c9}");
                widgets::detail_field(ui, "Horodatage", &ts_str);
                widgets::detail_field_badge(
                    ui,
                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                    selected.severity.label(),
                    sev_color,
                );
                widgets::detail_field(ui, "Source", source_label_fr(selected.source));
                widgets::detail_text(ui, "D\u{00e9}tail", &selected.detail);

                ui.add_space(theme::SPACE_MD);
                widgets::detail_section(
                    ui,
                    &format!(
                        "CORR\u{00c9}LATION (\u{00b1}5 min) \u{2014} {}",
                        crate::format::count(correlated.len(), "\u{00e9}v\u{00e9}nement")
                            .to_uppercase()
                    ),
                );

                if correlated.is_empty() {
                    ui.label(
                        egui::RichText::new(
                            "Aucun \u{00e9}v\u{00e9}nement corr\u{00e9}l\u{00e9} dans la fen\u{00ea}tre temporelle.",
                        )
                        .font(theme::font_min())
                        .color(theme::text_tertiary()),
                    );
                    return;
                }
                let limit = if show_all {
                    correlated.len()
                } else {
                    CORRELATED_SHOWN
                };
                for (i, evt) in correlated.iter().enumerate().take(limit) {
                    if correlated_row(ui, i, evt) {
                        clicked_correlated = Some((evt.source, evt.source_index));
                    }
                    ui.add_space(theme::SPACE_XS);
                }
                if correlated.len() > CORRELATED_SHOWN {
                    let label = if show_all {
                        "R\u{00e9}duire la liste".to_string()
                    } else {
                        format!(
                            "Voir tout ({} de plus)",
                            crate::format::int(correlated.len() - CORRELATED_SHOWN)
                        )
                    };
                    if widgets::ghost_button(ui, label).clicked() {
                        show_all = !show_all;
                    }
                }
            },
            &actions,
        );
    ui.data_mut(|d| d.insert_temp(show_all_id, show_all));

    match action {
        // The event's own modal, with its triage and response actions.
        Some(0) => {
            if let Some(kind) = super::types::static_kind(selected.source) {
                state.threats.forensic_detail_open = false;
                state.threats.forensic_selected_event = None;
                super::types::request_open(ui.ctx(), kind, selected.source_index);
                state.threats.active_tab = crate::dto::EdrTab::Overview;
            }
        }
        Some(_) => {
            ui.ctx().copy_text(format!(
                "Date : {}\nSource : {}\nS\u{00e9}v\u{00e9}rit\u{00e9} : {}\nTitre : {}\nD\u{00e9}tail : {}",
                ts_str,
                source_label_fr(selected.source),
                selected.severity.label(),
                selected.title,
                selected.detail,
            ));
            state.push_toast(
                widgets::toast::Toast::info("D\u{00e9}tails copi\u{00e9}s dans le presse-papiers"),
                ui.ctx(),
            );
        }
        None => {}
    }

    if let Some(selection) = clicked_correlated {
        // Lift the filters that hide it; the table selects it next frame.
        if !shown
            .iter()
            .any(|e| e.source == selection.0 && e.source_index == selection.1)
        {
            state.threats.forensic_source_filter = None;
            state.threats.forensic_severity_filter = None;
            ui.data_mut(|d| d.insert_temp(search_id(), String::new()));
        }
        ui.data_mut(|d| d.insert_temp(pending_selection_id(), selection));
        ui.ctx().request_repaint();
    }
}

/// One correlated event of the modal. Returns whether it was clicked.
fn correlated_row(ui: &mut Ui, index: usize, evt: &TimelineEvent) -> bool {
    let color = severity_color(&evt.severity);
    let frame = egui::Frame::new()
        .fill(theme::bg_tertiary())
        .corner_radius(egui::CornerRadius::same(theme::ROUNDING_SM))
        .inner_margin(egui::Margin::same(theme::SPACE_XS as i8))
        .show(ui, |ui: &mut egui::Ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(severity_icon(&evt.severity))
                        .size(theme::ICON_SM)
                        .color(color),
                );
                ui.add_space(theme::SPACE_XS);
                widgets::status_badge(ui, source_label_fr(evt.source), color);
            });
            ui.label(
                egui::RichText::new(&evt.title)
                    .font(theme::font_body())
                    .color(theme::text_primary()),
            );
            ui.label(
                egui::RichText::new(crate::format::local_day_time_secs(evt.timestamp))
                    .font(theme::font_min())
                    .color(theme::text_tertiary()),
            );
        });
    ui.interact(
        frame.response.rect,
        ui.id().with(("correlated", index)),
        egui::Sense::click(),
    )
    .on_hover_cursor(egui::CursorIcon::PointingHand)
    .on_hover_text("Afficher cet \u{00e9}v\u{00e9}nement et ses corr\u{00e9}lations")
    .clicked()
}

/// Build unified timeline from all state sources, filtered by cutoff time.
///
/// The events are the ones the assistant searches when asked about a past
/// period (`history_search`); the timeline leaves out the response actions,
/// which have their own tab, and dates an undated vulnerability to now.
fn build_timeline(state: &AppState, cutoff: DateTime<Utc>) -> Vec<TimelineEvent> {
    let mut events: Vec<TimelineEvent> = crate::history_search::events(state)
        .into_iter()
        .filter(|event| event.source != "response" && event.timestamp >= cutoff)
        .map(|event| TimelineEvent {
            timestamp: event.timestamp,
            source: event.source,
            severity: event.severity,
            // The history names a network alert by its type key.
            title: if event.source == "network" {
                super::types::network_alert_type_label(&event.title)
            } else {
                event.title
            },
            detail: event.detail,
            source_index: event.source_index,
        })
        .collect();

    for (i, v) in state.vulnerability_findings.iter().enumerate() {
        if v.discovered_at.is_none() {
            events.push(TimelineEvent {
                timestamp: Utc::now(),
                source: "vulnerability",
                severity: v.severity,
                title: format!("{} \u{2014} {}", v.cve_id, v.affected_software),
                detail: v.description.clone(),
                source_index: i,
            });
        }
    }

    events
}

/// Map severity to a color.
fn severity_color(severity: &Severity) -> egui::Color32 {
    match severity {
        Severity::Critical => theme::ERROR,
        Severity::High => theme::SEVERITY_HIGH,
        Severity::Medium => theme::SEVERITY_MEDIUM,
        Severity::Low | Severity::Info => theme::INFO,
    }
}

/// Map severity to an icon.
fn severity_icon(severity: &Severity) -> &'static str {
    match severity {
        Severity::Critical => icons::SEVERITY_CRITICAL,
        Severity::High => icons::SEVERITY_HIGH,
        Severity::Medium => icons::SEVERITY_MEDIUM,
        Severity::Low | Severity::Info => icons::SEVERITY_LOW,
    }
}

/// French label for a source key.
fn source_label_fr(source: &str) -> &'static str {
    match source {
        "process" => "PROCESSUS",
        "network" => "R\u{00c9}SEAU",
        "fim" => "FIM",
        "usb" => "USB",
        "system" => "SYST\u{00c8}ME",
        "vulnerability" => "CVE",
        _ => "AUTRE",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::widgets::data_table::{SortDirection, TableSort};

    fn event(title: &str, severity: Severity, age_min: i64) -> TimelineEvent {
        TimelineEvent {
            timestamp: Utc::now() - Duration::minutes(age_min),
            source: "process",
            severity,
            title: title.into(),
            detail: String::new(),
            source_index: 0,
        }
    }

    fn titles(events: &[TimelineEvent]) -> Vec<&str> {
        events.iter().map(|e| e.title.as_str()).collect()
    }

    #[test]
    fn severity_sorts_by_rank_and_ties_keep_the_order_shown() {
        let mut events = vec![
            event("medium", Severity::Medium, 1),
            event("critical-new", Severity::Critical, 2),
            event("low", Severity::Low, 3),
            event("critical-old", Severity::Critical, 4),
        ];
        super::super::types::sort_rows(
            &mut events,
            &TableSort::by("severity", SortDirection::Descending),
            event_order,
        );
        assert_eq!(
            titles(&events),
            ["critical-new", "critical-old", "medium", "low"]
        );
    }

    #[test]
    fn dates_sort_chronologically_and_titles_ignore_case() {
        let mut events = vec![
            event("beta", Severity::Low, 1),
            event("Alpha", Severity::Low, 30),
        ];
        super::super::types::sort_rows(
            &mut events,
            &TableSort::by("date", SortDirection::Ascending),
            event_order,
        );
        assert_eq!(titles(&events), ["Alpha", "beta"]);
        events.reverse();
        super::super::types::sort_rows(
            &mut events,
            &TableSort::by("title", SortDirection::Ascending),
            event_order,
        );
        assert_eq!(titles(&events), ["Alpha", "beta"]);
        // No column chosen: the list is left as it is.
        events.reverse();
        super::super::types::sort_rows(&mut events, &TableSort::default(), event_order);
        assert_eq!(titles(&events), ["beta", "Alpha"]);
    }
}
