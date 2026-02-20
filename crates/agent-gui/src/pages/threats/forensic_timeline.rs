//! Forensic timeline sub-tab — unified event timeline with filtering and correlation drawer.

use chrono::{DateTime, Duration, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::{FimChangeType, Severity, TimelineRange, UsbEventType};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{ColumnAlign, ColumnWidth, DataTable, TableColumn, TableSort};
use crate::widgets::pagination::PaginationState;

const ITEMS_PER_PAGE: usize = 25;
/// Correlation window: events within +/- 5 minutes.
const CORRELATION_WINDOW_SECS: i64 = 300;

/// A unified timeline event from any source.
struct TimelineEvent {
    timestamp: DateTime<Utc>,
    source: &'static str,
    severity: Severity,
    title: String,
    detail: String,
    /// Original source index for correlation lookup.
    _source_index: usize,
}

/// Source filter chips.
const SOURCE_FILTERS: &[(&str, &str)] = &[
    ("process", "PROCESSUS"),
    ("network", "R\u{00c9}SEAU"),
    ("fim", "FIM"),
    ("usb", "USB"),
    ("system", "SYST\u{00c8}ME"),
    ("vulnerability", "VULN\u{00c9}RA."),
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
    // ── Filter bar ──────────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
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
        .checked_sub_signed(Duration::seconds(state.threats.forensic_time_range.seconds()))
        .unwrap_or(now);

    let mut events = build_timeline(state, cutoff);

    // Apply source filter
    if let Some(ref src) = state.threats.forensic_source_filter {
        events.retain(|e| e.source == src.as_str());
    }

    // Apply severity filter
    if let Some(ref sev) = state.threats.forensic_severity_filter {
        events.retain(|e| e.severity == *sev);
    }

    // Sort by timestamp descending (newest first)
    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let total = events.len();

    // ── Event count ─────────────────────────────────────────────────
    ui.label(
        egui::RichText::new(format!(
            "{} \u{00e9}v\u{00e9}nements dans la p\u{00e9}riode",
            total
        ))
        .font(theme::font_body())
        .color(theme::text_secondary()),
    );
    ui.add_space(theme::SPACE_SM);

    // ── Pagination ──────────────────────────────────────────────────
    let total_pages = total.div_ceil(ITEMS_PER_PAGE).max(1);
    if state.threats.forensic_page >= total_pages {
        state.threats.forensic_page = total_pages.saturating_sub(1);
    }
    let start = state.threats.forensic_page.saturating_mul(ITEMS_PER_PAGE);
    let end = total.min(start.saturating_add(ITEMS_PER_PAGE));
    let page_events = &events[start..end];

    // ── DataTable ───────────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        let columns = vec![
            TableColumn {
                key: "severity",
                label: "S\u{00c9}V\u{00c9}RIT\u{00c9}",
                width: ColumnWidth::Fixed(90.0),
                sortable: false,
                align: ColumnAlign::Center,
            },
            TableColumn {
                key: "source",
                label: "SOURCE",
                width: ColumnWidth::Fixed(100.0),
                sortable: false,
                align: ColumnAlign::Center,
            },
            TableColumn {
                key: "title",
                label: "TITRE",
                width: ColumnWidth::Fill,
                sortable: false,
                align: ColumnAlign::Left,
            },
            TableColumn {
                key: "detail",
                label: "D\u{00c9}TAIL",
                width: ColumnWidth::Fixed(250.0),
                sortable: false,
                align: ColumnAlign::Left,
            },
            TableColumn {
                key: "date",
                label: "DATE",
                width: ColumnWidth::Fixed(130.0),
                sortable: false,
                align: ColumnAlign::Right,
            },
        ];

        let table = DataTable::new("forensic_timeline_table", columns).selectable();
        let mut sort = TableSort::default();
        table.show_header(ui, &mut sort);

        if page_events.is_empty() {
            table.show_empty(
                ui,
                "Aucun \u{00e9}v\u{00e9}nement dans cette p\u{00e9}riode",
            );
        } else {
            for (row_idx, evt) in page_events.iter().enumerate() {
                let sev_icon = severity_icon(&evt.severity);
                let sev_label = evt.severity.label();
                let sev_cell = format!("{} {}", sev_icon, sev_label);
                let source_label = source_label_fr(evt.source);
                let date = evt.timestamp.format("%d/%m/%Y %H:%M").to_string();

                // Truncate detail for table display (tooltip shows full text)
                let is_truncated = evt.detail.chars().count() > 60;
                let detail_display = if is_truncated {
                    let truncated: String = evt.detail.chars().take(57).collect();
                    format!("{}...", truncated)
                } else {
                    evt.detail.clone()
                };

                let cells: Vec<&str> = vec![
                    &sev_cell,
                    source_label,
                    &evt.title,
                    &detail_display,
                    &date,
                ];

                let global_idx = start.saturating_add(row_idx);
                let selected = state.threats.forensic_selected_event == Some(global_idx);

                ui.push_id(format!("ftl_{}", row_idx), |ui: &mut egui::Ui| {
                    if table.show_row(ui, row_idx, selected, &cells) {
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

    // ── Correlation drawer ──────────────────────────────────────────
    if state.threats.forensic_detail_open
        && let Some(sel_idx) = state.threats.forensic_selected_event
    {
            if let Some(selected_event) = events.get(sel_idx) {
                let sev_color = severity_color(&selected_event.severity);
                let ts_str = selected_event
                    .timestamp
                    .format("%d/%m/%Y %H:%M:%S")
                    .to_string();

                // Find correlated events (within +/- 5 min from ALL sources)
                let window_start = selected_event
                    .timestamp
                    .checked_sub_signed(Duration::seconds(CORRELATION_WINDOW_SECS))
                    .unwrap_or(selected_event.timestamp);
                let window_end = selected_event
                    .timestamp
                    .checked_add_signed(Duration::seconds(CORRELATION_WINDOW_SECS))
                    .unwrap_or(selected_event.timestamp);

                // Rebuild full (unfiltered) timeline for correlation
                let all_events = build_timeline(state, cutoff);
                let correlated: Vec<&TimelineEvent> = all_events
                    .iter()
                    .filter(|e| {
                        e.timestamp >= window_start
                            && e.timestamp <= window_end
                            && !(e.source == selected_event.source
                                && e.title == selected_event.title
                                && e.timestamp == selected_event.timestamp)
                    })
                    .collect();

                let _action = widgets::DetailDrawer::new(
                    "forensic_correlation",
                    &selected_event.title,
                    icons::CLOCK,
                )
                .accent(sev_color)
                .subtitle(source_label_fr(selected_event.source))
                .show(
                    ui.ctx(),
                    &mut state.threats.forensic_detail_open,
                    |ui| {
                        widgets::detail_section(ui, "\u{00c9}V\u{00c9}NEMENT S\u{00c9}LECTIONN\u{00c9}");
                        widgets::detail_field(ui, "Horodatage", &ts_str);
                        widgets::detail_field_badge(
                            ui,
                            "S\u{00e9}v\u{00e9}rit\u{00e9}",
                            selected_event.severity.label(),
                            sev_color,
                        );
                        widgets::detail_field(
                            ui,
                            "Source",
                            source_label_fr(selected_event.source),
                        );
                        widgets::detail_text(ui, "D\u{00e9}tail", &selected_event.detail);

                        ui.add_space(theme::SPACE_MD);
                        widgets::detail_section(
                            ui,
                            &format!(
                                "CORR\u{00c9}LATION (\u{00b1}5 min) \u{2014} {} \u{00e9}v\u{00e9}nements",
                                correlated.len()
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
                        } else {
                            for (i, evt) in correlated.iter().enumerate().take(20) {
                                ui.push_id(format!("corr_{}", i), |ui: &mut egui::Ui| {
                                    let c_color = severity_color(&evt.severity);
                                    egui::Frame::new()
                                        .fill(theme::bg_tertiary())
                                        .corner_radius(egui::CornerRadius::same(
                                            theme::ROUNDING_SM,
                                        ))
                                        .inner_margin(egui::Margin::same(
                                            theme::SPACE_XS as i8,
                                        ))
                                        .show(ui, |ui: &mut egui::Ui| {
                                            ui.horizontal(|ui: &mut egui::Ui| {
                                                ui.label(
                                                    egui::RichText::new(severity_icon(
                                                        &evt.severity,
                                                    ))
                                                    .size(theme::ICON_SM)
                                                    .color(c_color),
                                                );
                                                ui.add_space(theme::SPACE_XS);
                                                widgets::status_badge(
                                                    ui,
                                                    source_label_fr(evt.source),
                                                    c_color,
                                                );
                                            });
                                            ui.label(
                                                egui::RichText::new(&evt.title)
                                                    .font(theme::font_body())
                                                    .color(theme::text_primary()),
                                            );
                                            ui.label(
                                                egui::RichText::new(
                                                    evt.timestamp
                                                        .format("%d/%m %H:%M:%S")
                                                        .to_string(),
                                                )
                                                .font(theme::font_min())
                                                .color(theme::text_tertiary()),
                                            );
                                        });
                                    ui.add_space(theme::SPACE_XS);
                                });
                            }
                        }
                    },
                    &[],
                );
            } else {
                // Selection index out of range — close drawer
                state.threats.forensic_selected_event = None;
                state.threats.forensic_detail_open = false;
            }
    }

    None
}

/// Build unified timeline from all state sources, filtered by cutoff time.
fn build_timeline(state: &AppState, cutoff: DateTime<Utc>) -> Vec<TimelineEvent> {
    let mut events = Vec::new();

    // Suspicious processes
    for (i, p) in state.threats.suspicious_processes.iter().enumerate() {
        if p.detected_at < cutoff {
            continue;
        }
        let severity = if p.confidence >= 90 {
            Severity::Critical
        } else if p.confidence >= 70 {
            Severity::High
        } else if p.confidence >= 40 {
            Severity::Medium
        } else {
            Severity::Low
        };
        events.push(TimelineEvent {
            timestamp: p.detected_at,
            source: "process",
            severity,
            title: p.process_name.clone(),
            detail: format!("{} \u{2014} Confiance: {}%", p.reason, p.confidence),
            _source_index: i,
        });
    }

    // USB events
    for (i, u) in state.threats.usb_events.iter().enumerate() {
        if u.timestamp < cutoff {
            continue;
        }
        let severity = match u.event_type {
            UsbEventType::Connected => Severity::Medium,
            UsbEventType::Disconnected => Severity::Low,
        };
        events.push(TimelineEvent {
            timestamp: u.timestamp,
            source: "usb",
            severity,
            title: u.device_name.clone(),
            detail: format!(
                "{} \u{2014} VID:{:04X} PID:{:04X}",
                u.event_type, u.vendor_id, u.product_id,
            ),
            _source_index: i,
        });
    }

    // FIM alerts
    for (i, f) in state.fim.alerts.iter().enumerate() {
        if f.timestamp < cutoff {
            continue;
        }
        let severity = match f.change_type {
            FimChangeType::Deleted | FimChangeType::PermissionChanged => Severity::High,
            FimChangeType::Created | FimChangeType::Modified => Severity::Medium,
            FimChangeType::Renamed => Severity::Low,
        };
        events.push(TimelineEvent {
            timestamp: f.timestamp,
            source: "fim",
            severity,
            title: f.path.clone(),
            detail: format!("Changement : {}", f.change_type.label()),
            _source_index: i,
        });
    }

    // Network alerts
    for (i, a) in state.network.alerts.iter().enumerate() {
        if a.detected_at < cutoff {
            continue;
        }
        let mut desc = a.description.clone();
        if let Some(ref src) = a.source_ip {
            desc = format!("{} \u{2014} SRC: {}", desc, src);
        }
        if let Some(ref dst) = a.destination_ip {
            if let Some(port) = a.destination_port {
                desc = format!("{} \u{2014} DST: {}:{}", desc, dst, port);
            } else {
                desc = format!("{} \u{2014} DST: {}", desc, dst);
            }
        }
        events.push(TimelineEvent {
            timestamp: a.detected_at,
            source: "network",
            severity: a.severity,
            title: a.alert_type.clone(),
            detail: desc,
            _source_index: i,
        });
    }

    // System incidents
    for (i, inc) in state.threats.system_incidents.iter().enumerate() {
        if inc.detected_at < cutoff {
            continue;
        }
        events.push(TimelineEvent {
            timestamp: inc.detected_at,
            source: "system",
            severity: inc.severity,
            title: inc.title.clone(),
            detail: inc.description.clone(),
            _source_index: i,
        });
    }

    // Vulnerability findings
    for (i, v) in state.vulnerability_findings.iter().enumerate() {
        let ts = v.discovered_at.unwrap_or_else(Utc::now);
        if ts < cutoff {
            continue;
        }
        events.push(TimelineEvent {
            timestamp: ts,
            source: "vulnerability",
            severity: v.severity,
            title: format!("{} \u{2014} {}", v.cve_id, v.affected_software),
            detail: v.description.clone(),
            _source_index: i,
        });
    }

    events
}

/// Map severity to a color.
fn severity_color(severity: &Severity) -> egui::Color32 {
    match severity {
        Severity::Critical => theme::ERROR,
        Severity::High => theme::SEVERITY_HIGH,
        Severity::Medium => theme::WARNING,
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
        "vulnerability" => "VULN\u{00c9}RA.",
        _ => "AUTRE",
    }
}
