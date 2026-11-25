// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR investigation tab — search of an indicator of compromise across the
//! detection sources. A result opens the event it comes from.

use chrono::{DateTime, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::IocSearchType;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

use super::mitre;
use super::types::{network_alert_type_label, severity_display};

/// A single IOC search result across all data sources.
struct IocSearchResult {
    source: &'static str,
    title: String,
    match_description: String,
    severity: &'static str,
    timestamp: DateTime<Utc>,
    mitre_id: Option<&'static str>,
    /// The event the result comes from: source collection and index in it.
    kind: &'static str,
    source_index: usize,
}

/// Name under which the sort order of the results is kept.
const RESULTS_TABLE: &str = "ioc_results";

/// Ascending order of two results on a sort key.
fn result_order(key: &str, a: &IocSearchResult, b: &IocSearchResult) -> std::cmp::Ordering {
    use super::types::{severity_rank, text_order};
    match key {
        "date" => a.timestamp.cmp(&b.timestamp),
        "severity" => severity_rank(a.severity).cmp(&severity_rank(b.severity)),
        "source" => a.source.cmp(b.source),
        "title" => text_order(&a.title, &b.title),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Render the investigation tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    // ── IOC search bar ──────────────────────────────────────────────
    widgets::data_card(
        ui,
        "Recherche d’indicateurs de compromission",
        |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("RECHERCHE D'INDICATEURS DE COMPROMISSION (IOC)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                // IOC type dropdown
                let ioc_labels = [
                    "Adresse IP",
                    "Domaine",
                    "Hash (SHA-256)",
                    "Processus",
                    "CVE",
                ];
                let mut ioc_idx = match state.threats.ioc_type {
                    IocSearchType::Ip => 0,
                    IocSearchType::Domain => 1,
                    IocSearchType::Hash => 2,
                    IocSearchType::Process => 3,
                    IocSearchType::Cve => 4,
                };
                if widgets::dropdown(ui, "ioc_type_select", &ioc_labels, &mut ioc_idx) {
                    state.threats.ioc_type = match ioc_idx {
                        0 => IocSearchType::Ip,
                        1 => IocSearchType::Domain,
                        2 => IocSearchType::Hash,
                        3 => IocSearchType::Process,
                        4 => IocSearchType::Cve,
                        _ => IocSearchType::Ip,
                    };
                }

                ui.add_space(theme::SPACE_SM);

                // Search input
                let hint = match state.threats.ioc_type {
                    IocSearchType::Ip => "192.168.1.100, 10.0.0.1…",
                    IocSearchType::Domain => "example.com, malware.xyz…",
                    IocSearchType::Hash => "SHA-256 hash…",
                    IocSearchType::Process => "powershell, curl, nc…",
                    IocSearchType::Cve => "CVE-2024-12345…",
                };
                // The search is live: no button to press.
                let input_width = ui.available_width().max(200.0);
                widgets::SearchInput::new(&mut state.threats.ioc_search, hint)
                    .width(input_width)
                    .height(theme::BUTTON_HEIGHT)
                    .font(theme::font_body())
                    .id_salt("ioc_search")
                    .show(ui);
            });
        },
    );

    ui.add_space(theme::SPACE_MD);

    // ── Perform IOC search across all sources ───────────────────────
    let query = state.threats.ioc_search.trim().to_lowercase();
    if query.is_empty() {
        widgets::empty_state(
            ui,
            icons::SEARCH,
            "Aucune recherche",
            Some(
                "Entrez un indicateur de compromission (IP, hash, domaine, processus ou CVE) pour lancer une recherche multi-sources.",
            ),
        );
        state.threats.ioc_results_count = 0;
        return None;
    }

    let mut results = search_ioc(state, &query, state.threats.ioc_type);
    state.threats.ioc_results_count = results.len();
    // Most recent first, then the key chosen in the results card.
    super::types::sort_rows(
        &mut results,
        &widgets::table::sort_of(ui.ctx(), RESULTS_TABLE),
        result_order,
    );

    // ── Results panel ───────────────────────────────────────────────
    let mut opened: Option<(&'static str, usize)> = None;
    widgets::data_card(ui, "Résultats d’investigation", |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!(
                    "R\u{00c9}SULTATS ({})",
                    crate::format::count(results.len(), "correspondance")
                ))
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
        });
        ui.add_space(theme::SPACE_SM);

        if results.len() > 1 {
            super::types::sort_bar(
                ui,
                RESULTS_TABLE,
                &[
                    ("date", "Date"),
                    ("severity", "S\u{00e9}v\u{00e9}rit\u{00e9}"),
                    ("source", "Source"),
                    ("title", "Titre"),
                ],
            );
            ui.add_space(theme::SPACE_SM);
        }

        if results.is_empty() {
            widgets::empty_state(
                ui,
                icons::SHIELD_CHECK,
                "Aucune correspondance",
                Some(
                    "Aucun \u{00e9}v\u{00e9}nement ne correspond \u{00e0} cet indicateur dans les sources de d\u{00e9}tection.",
                ),
            );
        } else {
            for (row, result) in results.iter().enumerate() {
                let (sev_icon, sev_color) = severity_display(result.severity);

                let accent_bar_width = 3.0_f32;
                let frame_resp = egui::Frame::new()
                    .fill(theme::bg_tertiary())
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG))
                    .inner_margin(egui::Margin {
                        left: (theme::SPACE + accent_bar_width) as i8,
                        right: theme::SPACE_MD as i8,
                        top: theme::SPACE_SM as i8,
                        bottom: theme::SPACE_SM as i8,
                    })
                    .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(sev_icon)
                                    .size(theme::ICON_MD)
                                    .color(sev_color),
                            );
                            ui.add_space(theme::SPACE_SM);

                            widgets::status_badge(ui, result.source, sev_color);
                            ui.add_space(theme::SPACE_SM);

                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&result.title)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(&result.match_description)
                                        .font(theme::font_min())
                                        .color(theme::text_secondary()),
                                );
                            });

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(crate::format::local_datetime(
                                            result.timestamp,
                                        ))
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary()),
                                    );

                                    if let Some(mitre) = result.mitre_id {
                                        ui.add_space(theme::SPACE_SM);
                                        widgets::status_badge(ui, mitre, theme::ACCENT);
                                    }
                                },
                            );
                        });
                    });

                // The whole row opens the event it comes from.
                let rect = frame_resp.response.rect;
                let click = ui
                    .interact(
                        rect,
                        ui.id().with(("ioc_result", row)),
                        egui::Sense::click(),
                    )
                    .on_hover_cursor(egui::CursorIcon::PointingHand)
                    .on_hover_text("Ouvrir l'\u{00e9}v\u{00e9}nement");
                if click.clicked() {
                    opened = Some((result.kind, result.source_index));
                }

                // Accent bar
                let bar_rect = egui::Rect::from_min_size(
                    rect.left_top(),
                    egui::vec2(accent_bar_width, rect.height()),
                );
                ui.painter().rect_filled(
                    bar_rect,
                    egui::CornerRadius {
                        nw: theme::ROUNDING_LG,
                        sw: theme::ROUNDING_LG,
                        ..Default::default()
                    },
                    sev_color,
                );

                ui.add_space(theme::SPACE_XS);
            }
        }
    });

    if let Some((kind, source_index)) = opened {
        super::types::request_open(ui.ctx(), kind, source_index);
        state.threats.active_tab = crate::dto::EdrTab::Overview;
    }

    None
}

/// Search all AppState collections for IOC matches.
fn search_ioc(state: &AppState, query: &str, ioc_type: IocSearchType) -> Vec<IocSearchResult> {
    let mut results = Vec::new();

    match ioc_type {
        IocSearchType::Ip => {
            // Search network alerts by source_ip / destination_ip
            for (index, alert) in state.network.alerts.iter().enumerate() {
                let src_match = alert
                    .source_ip
                    .as_deref()
                    .is_some_and(|ip| ip.to_lowercase().contains(query));
                let dst_match = alert
                    .destination_ip
                    .as_deref()
                    .is_some_and(|ip| ip.to_lowercase().contains(query));
                if src_match || dst_match {
                    let mitre = mitre::mitre_mapping("network", &alert.alert_type);
                    results.push(IocSearchResult {
                        source: "R\u{00c9}SEAU",
                        title: network_alert_type_label(&alert.alert_type),
                        match_description: format!(
                            "SRC: {} \u{2192} DST: {}:{}",
                            alert.source_ip.as_deref().unwrap_or("--"),
                            alert.destination_ip.as_deref().unwrap_or("--"),
                            alert
                                .destination_port
                                .map(|p| p.to_string())
                                .unwrap_or_else(|| "--".to_string()),
                        ),
                        severity: alert.severity.as_str(),
                        timestamp: alert.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                        kind: "network",
                        source_index: index,
                    });
                }
            }
        }
        IocSearchType::Domain => {
            // Search network alerts descriptions for domain matches
            for (index, alert) in state.network.alerts.iter().enumerate() {
                if alert.description.to_lowercase().contains(query)
                    || alert.alert_type.to_lowercase().contains(query)
                {
                    let mitre = mitre::mitre_mapping("network", &alert.alert_type);
                    results.push(IocSearchResult {
                        source: "R\u{00c9}SEAU",
                        title: network_alert_type_label(&alert.alert_type),
                        match_description: alert.description.clone(),
                        severity: alert.severity.as_str(),
                        timestamp: alert.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                        kind: "network",
                        source_index: index,
                    });
                }
            }
        }
        IocSearchType::Hash => {
            // Search FIM alerts by old_hash / new_hash
            for (index, alert) in state.fim.alerts.iter().enumerate() {
                let old_match = alert
                    .old_hash
                    .as_deref()
                    .is_some_and(|h| h.to_lowercase().contains(query));
                let new_match = alert
                    .new_hash
                    .as_deref()
                    .is_some_and(|h| h.to_lowercase().contains(query));
                if old_match || new_match {
                    let mitre = mitre::mitre_mapping("fim", "");
                    results.push(IocSearchResult {
                        source: "FIM",
                        title: alert.path.clone(),
                        match_description: format!(
                            "Hash: {} \u{2192} {}",
                            alert.old_hash.as_deref().unwrap_or("--"),
                            alert.new_hash.as_deref().unwrap_or("--"),
                        ),
                        severity: "high",
                        timestamp: alert.timestamp,
                        mitre_id: mitre.map(|m| m.id),
                        kind: "fim",
                        source_index: index,
                    });
                }
            }
        }
        IocSearchType::Process => {
            // Search suspicious processes by name / command line
            for (index, proc) in state.threats.suspicious_processes.iter().enumerate() {
                if proc.process_name.to_lowercase().contains(query)
                    || proc.command_line.to_lowercase().contains(query)
                {
                    let subtype =
                        format!("{} {}", proc.process_name, proc.command_line).to_lowercase();
                    let mitre = mitre::mitre_mapping("process", &subtype);
                    let severity = if proc.confidence >= 90 {
                        "critical"
                    } else if proc.confidence >= 70 {
                        "high"
                    } else if proc.confidence >= 40 {
                        "medium"
                    } else {
                        "low"
                    };
                    results.push(IocSearchResult {
                        source: "PROCESSUS",
                        title: proc.process_name.clone(),
                        match_description: format!(
                            "{} \u{2014} Confiance: {}\u{202f}%",
                            proc.reason, proc.confidence,
                        ),
                        severity,
                        timestamp: proc.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                        kind: "process",
                        source_index: index,
                    });
                }
            }
            // Also search system incidents
            for (index, inc) in state.threats.system_incidents.iter().enumerate() {
                if inc.title.to_lowercase().contains(query)
                    || inc.description.to_lowercase().contains(query)
                {
                    let mitre = mitre::mitre_mapping("system", &inc.incident_type);
                    results.push(IocSearchResult {
                        source: "SYST\u{00c8}ME",
                        title: inc.title.clone(),
                        match_description: inc.description.clone(),
                        severity: inc.severity.as_str(),
                        timestamp: inc.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                        kind: "system",
                        source_index: index,
                    });
                }
            }
        }
        IocSearchType::Cve => {
            // Search vulnerability findings by CVE ID
            for (index, vuln) in state.vulnerability_findings.iter().enumerate() {
                if vuln.cve_id.to_lowercase().contains(query) {
                    results.push(IocSearchResult {
                        source: "CVE",
                        title: format!("{} \u{2014} {}", vuln.cve_id, vuln.affected_software),
                        match_description: vuln.description.clone(),
                        severity: vuln.severity.as_str(),
                        timestamp: vuln.discovered_at.unwrap_or_else(Utc::now),
                        mitre_id: None,
                        kind: "vulnerability",
                        source_index: index,
                    });
                }
            }
        }
    }

    // Sort by timestamp descending
    results.sort_by_key(|b| std::cmp::Reverse(b.timestamp));
    results
}
