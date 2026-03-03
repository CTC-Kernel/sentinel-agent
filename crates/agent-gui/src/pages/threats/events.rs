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
use crate::widgets::data_table::{ColumnAlign, ColumnWidth, DataTable, TableColumn, TableSort};
use crate::widgets::pagination::PaginationState;

use super::mitre;
use super::types::{build_threat_list, kind_badge, severity_display};

const ITEMS_PER_PAGE: usize = 25;

/// Render the events tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let command = None;

    // ── Search bar + severity filter ────────────────────────────────
    ui.horizontal(|ui: &mut egui::Ui| {
        // Search input
        let search_width = (ui.available_width() - 200.0).max(200.0);
        ui.add_sized(
            egui::vec2(search_width, theme::MIN_TOUCH_TARGET),
            egui::TextEdit::singleline(&mut state.threats.search)
                .hint_text("Rechercher un \u{00e9}v\u{00e9}nement...")
                .font(theme::font_body()),
        );

        ui.add_space(theme::SPACE_SM);

        // Severity dropdown filter
        let severity_labels = [
            "TOUTES",
            "CRITIQUE",
            "\u{00c9}LEV\u{00c9}E",
            "MOYENNE",
            "FAIBLE",
        ];
        let mut severity_idx = match state.threats.events_severity_filter {
            None => 0,
            Some(Severity::Critical) => 1,
            Some(Severity::High) => 2,
            Some(Severity::Medium) => 3,
            Some(Severity::Low) | Some(Severity::Info) => 4,
        };
        if widgets::dropdown(
            ui,
            "events_severity_filter",
            &severity_labels,
            &mut severity_idx,
        ) {
            state.threats.events_severity_filter = match severity_idx {
                1 => Some(Severity::Critical),
                2 => Some(Severity::High),
                3 => Some(Severity::Medium),
                4 => Some(Severity::Low),
                _ => None,
            };
            state.threats.events_page = 0;
        }
    });

    ui.add_space(theme::SPACE_MD);

    // ── Build & filter threat list ──────────────────────────────────
    let mut threats = build_threat_list(state);

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

    // Sort by timestamp descending (newest first)
    threats.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let total = threats.len();

    // ── Pagination ──────────────────────────────────────────────────
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
            key: "severity",
            label: "S\u{00c9}V\u{00c9}RIT\u{00c9}",
            width: ColumnWidth::Fixed(80.0),
            sortable: false,
            align: ColumnAlign::Center,
        },
        TableColumn {
            key: "type",
            label: "TYPE",
            width: ColumnWidth::Fixed(100.0),
            sortable: false,
            align: ColumnAlign::Left,
        },
        TableColumn {
            key: "title",
            label: "TITRE",
            width: ColumnWidth::Fill,
            sortable: false,
            align: ColumnAlign::Left,
        },
        TableColumn {
            key: "mitre",
            label: "MITRE",
            width: ColumnWidth::Fixed(120.0),
            sortable: false,
            align: ColumnAlign::Center,
        },
        TableColumn {
            key: "confidence",
            label: "CONFIANCE",
            width: ColumnWidth::Fixed(85.0),
            sortable: false,
            align: ColumnAlign::Center,
        },
        TableColumn {
            key: "date",
            label: "DATE",
            width: ColumnWidth::Fixed(130.0),
            sortable: false,
            align: ColumnAlign::Right,
        },
    ];

    let table = DataTable::new("edr_events_table", columns).selectable();
    let mut _sort = TableSort::default();
    table.show_header(ui, &mut _sort);

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

            // MITRE technique lookup
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
            let mitre_id = mitre::mitre_mapping(threat.kind, &subtype)
                .map(|t| t.id.to_string())
                .unwrap_or_else(|| "\u{2014}".to_string());

            let confidence = threat
                .confidence
                .map(|c| format!("{}%", c))
                .unwrap_or_else(|| "\u{2014}".to_string());

            let date = threat.timestamp.format("%d/%m/%Y %H:%M").to_string();

            let sev_cell = format!("{} {}", sev_icon, sev_label);
            let cells: Vec<&str> = vec![
                &sev_cell,
                kind_label,
                &threat.title,
                &mitre_id,
                &confidence,
                &date,
            ];

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

            let actions = [widgets::DetailAction::secondary(
                "Copier les d\u{00e9}tails",
                icons::COPY,
            )];

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
                                    &format!("{}%", conf),
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
