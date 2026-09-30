// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR events tab — DataTable of all security events with sorting and pagination.

use egui::Ui;

use crate::app::AppState;
use crate::dto::Severity;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{
    ColumnAlign, ColumnWidth, DataTable, SortDirection, TableColumn, TableSort,
};
use crate::widgets::pagination::PaginationState;

use super::mitre;
use super::types::{ThreatEvent, build_threat_list, kind_badge, severity_display};

const ITEMS_PER_PAGE: usize = 25;

/// Render the events tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command = None;

    let old_filter = state.threats.events_status_filter;
    ui.horizontal_wrapped(|ui| {
        for (index, label) in ["Tous", "À traiter", "Acquittés", "Autorisés"]
            .iter()
            .enumerate()
        {
            ui.selectable_value(&mut state.threats.events_status_filter, index, *label);
        }
        if widgets::button::ghost_button(ui, "Gérer les autorisations →").clicked() {
            state.threats.active_tab = crate::dto::EdrTab::Authorizations;
        }
    });
    if old_filter != state.threats.events_status_filter {
        state.threats.events_page = 0;
        state.threats.selected_threat = None;
        state.threats.detail_open = false;
    }
    let previous_search = state.threats.search.clone();
    let previous_severity = state.threats.events_severity_filter;
    // ── Search and severity chips ───────────────────────────────────
    let current = state.threats.events_severity_filter;
    let chips = [
        ("Critique", Severity::Critical, theme::ERROR),
        ("\u{00c9}lev\u{00e9}e", Severity::High, theme::SEVERITY_HIGH),
        ("Moyenne", Severity::Medium, theme::WARNING),
        ("Faible", Severity::Low, theme::INFO),
    ];
    let mut bar = widgets::SearchFilterBar::new(
        &mut state.threats.search,
        "Rechercher un \u{00e9}v\u{00e9}nement…",
    );
    for (label, severity, color) in chips {
        bar = bar.chip(label, current == Some(severity), color);
    }
    if let Some(idx) = bar.show(ui) {
        let picked = chips[idx].1;
        state.threats.events_severity_filter = if current == Some(picked) {
            None
        } else {
            Some(picked)
        };
        state.threats.events_page = 0;
    }

    ui.add_space(theme::SPACE_MD);

    // ── Build & filter threat list ──────────────────────────────────
    if previous_search != state.threats.search
        || previous_severity != state.threats.events_severity_filter
    {
        state.threats.selected_threat = None;
        state.threats.detail_open = false;
        state.threats.events_page = 0;
    }
    let mut threats = build_threat_list(state);
    threats.retain(|t| match state.threats.events_status_filter {
        1 => t.needs_triage(),
        2 => t.acknowledged && !t.allowlisted,
        3 => t.allowlisted,
        _ => true,
    });

    // Apply severity filter
    if let Some(ref sev) = state.threats.events_severity_filter {
        let sev_str = sev.as_str();
        threats.retain(|t| t.severity == sev_str);
    }

    // Apply text search
    let search_lower = state.threats.search.to_lowercase();
    if !search_lower.is_empty() {
        threats.retain(|t| {
            t.title.to_lowercase().contains(&search_lower)
                || t.description.to_lowercase().contains(&search_lower)
                || t.kind.contains(&search_lower)
        });
    }

    sort_threats(&mut threats, &state.threats.events_sort);

    let total = threats.len();

    // ── Pagination ──────────────────────────────────────────────────
    // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
    let mut position = state.threats.selected_threat;
    if widgets::navigate_list(
        ui.ctx(),
        &mut position,
        total,
        &mut state.threats.detail_open,
    ) && let Some(pos) = position
    {
        state.threats.selected_threat = Some(pos);
        state.threats.events_page = pos / ITEMS_PER_PAGE;
    }

    let total_pages = total.div_ceil(ITEMS_PER_PAGE).max(1);
    if state.threats.events_page >= total_pages {
        state.threats.events_page = total_pages.saturating_sub(1);
    }
    let start = state.threats.events_page.saturating_mul(ITEMS_PER_PAGE);
    let end = total.min(start.saturating_add(ITEMS_PER_PAGE));
    let page_threats = &threats[start..end];

    // ── DataTable ───────────────────────────────────────────────────
    let columns = vec![
        TableColumn {
            key: "status",
            label: "STATUT",
            width: ColumnWidth::Fixed(105.0),
            sortable: true,
            align: ColumnAlign::Left,
        },
        TableColumn {
            key: "severity",
            label: "S\u{00c9}V\u{00c9}RIT\u{00c9}",
            width: ColumnWidth::Fixed(110.0),
            sortable: true,
            align: ColumnAlign::Center,
        },
        TableColumn {
            key: "type",
            label: "TYPE",
            width: ColumnWidth::Fixed(120.0),
            sortable: true,
            align: ColumnAlign::Left,
        },
        TableColumn {
            key: "title",
            label: "TITRE",
            width: ColumnWidth::Fill,
            sortable: true,
            align: ColumnAlign::Left,
        },
        TableColumn {
            key: "date",
            label: "DATE",
            width: ColumnWidth::Fixed(150.0),
            sortable: true,
            align: ColumnAlign::Right,
        },
    ];

    let table = DataTable::new("edr_events_table", columns).selectable();
    let previous_sort = state.threats.events_sort.clone();
    if table.show_header(ui, &mut state.threats.events_sort) {
        // Clearing a column returns to newest first. The date column already
        // is that default, so from there a click flips it to oldest first
        // instead of clearing to the very order it was showing.
        if state.threats.events_sort.column.is_none() {
            state.threats.events_sort = if previous_sort.column.as_deref() == Some("date") {
                TableSort::by("date", SortDirection::Ascending)
            } else {
                crate::state::default_events_sort()
            };
        }
        // Rows are addressed by position: a new order must not leave the
        // detail modal pointing at whichever event moved into that slot.
        state.threats.selected_threat = None;
        state.threats.detail_open = false;
        state.threats.events_page = 0;
    }

    if page_threats.is_empty() {
        table.show_empty(
            ui,
            "Aucun \u{00e9}v\u{00e9}nement de s\u{00e9}curit\u{00e9}",
        );
    } else {
        for (row_idx, threat) in page_threats.iter().enumerate() {
            let (sev_icon, _) = severity_display(threat.severity);
            let sev_label = match threat.severity {
                "critical" => "Critique",
                "high" => "\u{00c9}lev\u{00e9}",
                "medium" => "Moyen",
                _ => "Faible",
            };
            let (kind_label, _) = kind_badge(threat.kind);

            let date = threat.timestamp.format("%d/%m/%Y %H:%M").to_string();

            let sev_cell = format!("{} {}", sev_icon, sev_label);
            let status = if threat.allowlisted {
                "Autorisé"
            } else if threat.acknowledged {
                "Acquitté"
            } else {
                "À traiter"
            };
            let cells: Vec<&str> = vec![status, &sev_cell, kind_label, &threat.title, &date];

            let global_idx = start.saturating_add(row_idx);
            let selected = state.threats.selected_threat == Some(global_idx);

            if table.show_row(ui, row_idx, selected, &cells) {
                state.threats.selected_threat = Some(global_idx);
                state.threats.detail_open = true;
            }
        }
    }

    // ── Pagination controls ─────────────────────────────────────────
    ui.add_space(theme::SPACE_MD);
    let mut pag = PaginationState::new(total, ITEMS_PER_PAGE);
    pag.current_page = state.threats.events_page.saturating_add(1); // PaginationState is 1-indexed
    if widgets::pagination(ui, &mut pag) {
        state.threats.events_page = pag.current_page.saturating_sub(1);
    }

    ui.add_space(theme::SPACE_XL);

    // ── Detail drawer ────────────────────────────────────────────────
    if state.threats.detail_open {
        if let Some(sel) = state.threats.selected_threat
            && let Some(threat) = threats.get(sel)
        {
            let sev_color = match threat.severity {
                "critical" => theme::ERROR,
                "high" => theme::SEVERITY_HIGH,
                "medium" => theme::WARNING,
                _ => theme::INFO,
            };
            let (kind_label, _) = kind_badge(threat.kind);
            let ts = threat.timestamp.format("%d/%m/%Y %H:%M:%S").to_string();

            // MITRE lookup
            let subtype = match threat.kind {
                "network" => threat.title.to_lowercase(),
                "system" => threat.description.to_lowercase(),
                "process" => format!(
                    "{} {}",
                    threat.title,
                    threat.command_line.as_deref().unwrap_or("")
                )
                .to_lowercase(),
                _ => String::new(),
            };
            let mitre_info = mitre::mitre_mapping(threat.kind, &subtype);

            let actions = vec![
                widgets::DetailAction::secondary("Copier les détails", icons::COPY),
                widgets::DetailAction::primary("Acquitter", icons::CHECK).enabled(
                    !threat.acknowledged && !threat.allowlisted && threat.kind != "vulnerability",
                ),
                widgets::DetailAction::secondary("Ouvrir le module", icons::SEARCH),
            ];
            let drawer_action =
                widgets::DetailDrawer::new("events_detail", &threat.title, icons::LIST)
                    .accent(sev_color)
                    .subtitle(kind_label)
                    .show(
                        ui.ctx(),
                        &mut state.threats.detail_open,
                        |ui| {
                            widgets::detail_section(
                                ui,
                                "\u{00c9}V\u{00c9}NEMENT DE S\u{00c9}CURIT\u{00c9}",
                            );
                            widgets::detail_field(ui, "Titre", &threat.title);
                            widgets::detail_field_badge(ui, "Type", kind_label, sev_color);
                            widgets::detail_field_badge(
                                ui,
                                "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                threat.severity,
                                sev_color,
                            );
                            widgets::detail_field(ui, "Date", &ts);

                            if let Some(conf) = threat.confidence {
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}\u{202f}%", conf),
                                    theme::readable_color(sev_color),
                                );
                            }

                            widgets::detail_section(ui, "D\u{00c9}TAILS");
                            widgets::detail_text(ui, "Description", &threat.description);

                            if let Some(ref cmd) = threat.command_line {
                                widgets::detail_mono(ui, "Ligne de commande", cmd);
                            }

                            if let Some(ref mitre) = mitre_info {
                                widgets::detail_section(ui, "MITRE ATT&CK");
                                widgets::detail_field(ui, "Technique", mitre.id);
                                widgets::detail_field(ui, "Nom", mitre.name_fr);
                                widgets::detail_field(ui, "Tactique", mitre.tactic.label_fr());
                            }
                        },
                        &actions,
                    );

            if drawer_action == Some(1)
                && state.acknowledge_threat_item(threat.kind, threat.source_index)
            {
                // Keep the platform in sync, as the FIM page does.
                if threat.kind == "fim"
                    && let Some(alert) = state.fim.alerts.get(threat.source_index)
                {
                    command = Some(GuiCommand::AcknowledgeFimAlert {
                        alert_id: alert.id.clone(),
                        path: alert.path.clone(),
                        timestamp: alert.timestamp,
                    });
                }
                state.threats.detail_open = false;
                state.threats.selected_threat = None;
                state.push_toast(
                    widgets::toast::Toast::success("Événement acquitté"),
                    ui.ctx(),
                );
            }
            if drawer_action == Some(2) {
                use crate::app::Page;
                state.threats.detail_open = false;
                state.threats.selected_threat = None;
                state.pending_navigation = Some(match threat.kind {
                    "network" => {
                        state.network.active_section = 1;
                        Page::Network
                    }
                    "fim" => Page::FileIntegrity,
                    "vulnerability" => Page::Vulnerabilities,
                    _ => {
                        state.threats.active_tab = crate::dto::EdrTab::Overview;
                        Page::Threats
                    }
                });
            }
            if let Some(0) = drawer_action {
                let details = format!(
                    "Type: {}\nTitre: {}\nS\u{00e9}v\u{00e9}rit\u{00e9}: {}\nDescription: {}\nDate: {}",
                    kind_label, threat.title, threat.severity, threat.description, ts,
                );
                ui.ctx().copy_text(details);
            }
        } else {
            // Selection out of range — close drawer
            state.threats.selected_threat = None;
            state.threats.detail_open = false;
        }
    }

    command
}

/// Workflow rank of an event: to triage first, then acknowledged, then authorized.
fn status_rank(t: &ThreatEvent) -> u8 {
    if t.allowlisted {
        2
    } else if t.acknowledged {
        1
    } else {
        0
    }
}

fn severity_rank(severity: &str) -> u8 {
    match severity {
        "critical" => 3,
        "high" => 2,
        "medium" => 1,
        _ => 0,
    }
}

/// Order the events for the table. Ties, and a cleared sort, fall back to
/// newest first so the order never flickers between frames.
fn sort_threats(threats: &mut [ThreatEvent], sort: &TableSort) {
    use std::cmp::Ordering;
    let newest_first = |a: &ThreatEvent, b: &ThreatEvent| b.timestamp.cmp(&a.timestamp);
    let key: Option<fn(&ThreatEvent, &ThreatEvent) -> Ordering> = match sort.column.as_deref() {
        Some("status") => Some(|a, b| status_rank(a).cmp(&status_rank(b))),
        Some("severity") => Some(|a, b| severity_rank(a.severity).cmp(&severity_rank(b.severity))),
        Some("type") => Some(|a, b| kind_badge(a.kind).0.cmp(kind_badge(b.kind).0)),
        Some("title") => Some(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase())),
        Some("date") => Some(|a, b| a.timestamp.cmp(&b.timestamp)),
        _ => None,
    };
    match (key, sort.direction) {
        (Some(key), SortDirection::Ascending) => {
            threats.sort_by(|a, b| key(a, b).then_with(|| newest_first(a, b)))
        }
        (Some(key), SortDirection::Descending) => {
            threats.sort_by(|a, b| key(b, a).then_with(|| newest_first(a, b)))
        }
        _ => threats.sort_by(newest_first),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    fn event(title: &str, severity: &'static str, age_min: i64) -> ThreatEvent {
        ThreatEvent {
            kind: "process",
            severity,
            title: title.into(),
            timestamp: Utc::now() - Duration::minutes(age_min),
            ..Default::default()
        }
    }

    fn titles(threats: &[ThreatEvent]) -> Vec<&str> {
        threats.iter().map(|t| t.title.as_str()).collect()
    }

    #[test]
    fn default_order_is_newest_first() {
        let mut threats = vec![event("old", "low", 30), event("new", "low", 1)];
        sort_threats(&mut threats, &crate::state::default_events_sort());
        assert_eq!(titles(&threats), ["new", "old"]);
    }

    #[test]
    fn severity_sorts_by_rank_not_alphabetically() {
        let mut threats = vec![
            event("medium", "medium", 1),
            event("critical", "critical", 2),
            event("low", "low", 3),
            event("high", "high", 4),
        ];
        sort_threats(
            &mut threats,
            &TableSort::by("severity", SortDirection::Descending),
        );
        assert_eq!(titles(&threats), ["critical", "high", "medium", "low"]);
        sort_threats(
            &mut threats,
            &TableSort::by("severity", SortDirection::Ascending),
        );
        assert_eq!(titles(&threats), ["low", "medium", "high", "critical"]);
    }

    #[test]
    fn ties_fall_back_to_newest_first() {
        let mut threats = vec![event("older", "high", 10), event("newer", "high", 2)];
        sort_threats(
            &mut threats,
            &TableSort::by("severity", SortDirection::Ascending),
        );
        assert_eq!(titles(&threats), ["newer", "older"]);
    }

    #[test]
    fn status_puts_events_to_triage_first() {
        let mut acknowledged = event("acknowledged", "low", 1);
        acknowledged.acknowledged = true;
        let mut authorized = event("authorized", "low", 2);
        authorized.allowlisted = true;
        let mut threats = vec![authorized, acknowledged, event("triage", "low", 3)];
        sort_threats(
            &mut threats,
            &TableSort::by("status", SortDirection::Ascending),
        );
        assert_eq!(titles(&threats), ["triage", "acknowledged", "authorized"]);
    }
}
