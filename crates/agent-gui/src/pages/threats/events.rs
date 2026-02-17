//! EDR events tab — DataTable of all security events with sorting and pagination.

use egui::Ui;

use crate::app::AppState;
use crate::dto::Severity;
use crate::events::GuiCommand;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{ColumnAlign, ColumnWidth, DataTable, TableColumn, TableSort};
use crate::widgets::pagination::PaginationState;

use super::mitre;
use super::types::{build_threat_list, severity_display, kind_badge};

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
        let severity_labels = ["TOUTES", "CRITIQUE", "\u{00c9}LEV\u{00c9}E", "MOYENNE", "FAIBLE"];
        let mut severity_idx = match state.threats.events_severity_filter {
            None => 0,
            Some(Severity::Critical) => 1,
            Some(Severity::High) => 2,
            Some(Severity::Medium) => 3,
            Some(Severity::Low) | Some(Severity::Info) => 4,
        };
        if widgets::dropdown(ui, "events_severity_filter", &severity_labels, &mut severity_idx) {
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
    let search_lower = state.threats.search.to_ascii_lowercase();
    if !search_lower.is_empty() {
        threats.retain(|t| {
            let haystack = format!(
                "{} {} {}",
                t.title.to_lowercase(),
                t.description.to_lowercase(),
                t.kind,
            );
            haystack.contains(&search_lower)
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
    let start = state.threats.events_page * ITEMS_PER_PAGE;
    let page_threats = &threats[start..total.min(start + ITEMS_PER_PAGE)];

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
    let mut sort = TableSort::default();
    table.show_header(ui, &mut sort);

    if page_threats.is_empty() {
        table.show_empty(ui, "Aucun \u{00e9}v\u{00e9}nement de s\u{00e9}curit\u{00e9}");
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
                "network" => threat.title.to_ascii_lowercase(),
                "system" => threat.description.to_ascii_lowercase(),
                "process" => format!("{} {}", threat.title, threat.command_line.as_deref().unwrap_or("")).to_ascii_lowercase(),
                _ => String::new(),
            };
            let mitre_id = mitre::mitre_mapping(threat.kind, &subtype)
                .map(|t| t.id.to_string())
                .unwrap_or_else(|| "\u{2014}".to_string());

            let confidence = threat.confidence
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

            let global_idx = start + row_idx;
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
    pag.current_page = state.threats.events_page + 1; // PaginationState is 1-indexed
    if widgets::pagination(ui, &mut pag) {
        state.threats.events_page = pag.current_page.saturating_sub(1);
    }

    command
}
