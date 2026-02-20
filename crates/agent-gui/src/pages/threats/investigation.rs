//! EDR investigation tab — IOC search, cross-source correlation, and process chain viewer.

use chrono::{DateTime, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::IocSearchType;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

use super::mitre;
use super::types::{severity_display, network_alert_type_label};

/// A single IOC search result across all data sources.
struct IocSearchResult {
    source: &'static str,
    title: String,
    match_description: String,
    severity: &'static str,
    timestamp: DateTime<Utc>,
    mitre_id: Option<&'static str>,
}

/// Render the investigation tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    // ── IOC search bar ──────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
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
            let ioc_labels = ["Adresse IP", "Domaine", "Hash (SHA-256)", "Processus", "CVE"];
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
                IocSearchType::Ip => "192.168.1.100, 10.0.0.1...",
                IocSearchType::Domain => "example.com, malware.xyz...",
                IocSearchType::Hash => "SHA-256 hash...",
                IocSearchType::Process => "powershell, curl, nc...",
                IocSearchType::Cve => "CVE-2024-XXXXX...",
            };
            let input_width = (ui.available_width() - 120.0).max(200.0);
            ui.add_sized(
                egui::vec2(input_width, theme::MIN_TOUCH_TARGET),
                egui::TextEdit::singleline(&mut state.threats.ioc_search)
                    .hint_text(hint)
                    .font(theme::font_body()),
            );

            ui.add_space(theme::SPACE_SM);

            if widgets::button::primary_button(ui, format!("{}  RECHERCHER", icons::SEARCH), true).clicked()
                || (ui.input(|i| i.key_pressed(egui::Key::Enter)) && !state.threats.ioc_search.is_empty())
            {
                // Search is triggered — results computed below
            }
        });
    });

    ui.add_space(theme::SPACE_MD);

    // ── Perform IOC search across all sources ───────────────────────
    let query = state.threats.ioc_search.trim().to_lowercase();
    if query.is_empty() {
        widgets::empty_state(
            ui,
            icons::SEARCH,
            "AUCUNE RECHERCHE",
            Some("Entrez un indicateur de compromission (IP, hash, domaine, processus ou CVE) pour lancer une recherche multi-sources."),
        );
        state.threats.ioc_results_count = 0;
        return None;
    }

    let results = search_ioc(state, &query, state.threats.ioc_type);
    state.threats.ioc_results_count = results.len();

    // ── Results panel ───────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!("R\u{00c9}SULTATS ({} correspondances)", results.len()))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
        });
        ui.add_space(theme::SPACE_SM);

        if results.is_empty() {
            widgets::empty_state(
                ui,
                icons::SHIELD_CHECK,
                "AUCUNE CORRESPONDANCE",
                Some("Aucun \u{00e9}v\u{00e9}nement ne correspond \u{00e0} cet indicateur dans les sources de d\u{00e9}tection."),
            );
        } else {
            for result in &results {
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
                                        egui::RichText::new(
                                            result.timestamp.format("%d/%m/%Y %H:%M").to_string(),
                                        )
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

                // Accent bar
                let rect = frame_resp.response.rect;
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

    None
}

/// Search all AppState collections for IOC matches.
fn search_ioc(state: &AppState, query: &str, ioc_type: IocSearchType) -> Vec<IocSearchResult> {
    let mut results = Vec::new();

    match ioc_type {
        IocSearchType::Ip => {
            // Search network alerts by source_ip / destination_ip
            for alert in &state.network.alerts {
                let src_match = alert.source_ip.as_deref()
                    .is_some_and(|ip| ip.to_lowercase().contains(query));
                let dst_match = alert.destination_ip.as_deref()
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
                            alert.destination_port.map(|p| p.to_string()).unwrap_or_else(|| "--".to_string()),
                        ),
                        severity: alert.severity.as_str(),
                        timestamp: alert.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                    });
                }
            }
        }
        IocSearchType::Domain => {
            // Search network alerts descriptions for domain matches
            for alert in &state.network.alerts {
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
                    });
                }
            }
        }
        IocSearchType::Hash => {
            // Search FIM alerts by old_hash / new_hash
            for alert in &state.fim.alerts {
                let old_match = alert.old_hash.as_deref()
                    .is_some_and(|h| h.to_lowercase().contains(query));
                let new_match = alert.new_hash.as_deref()
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
                    });
                }
            }
        }
        IocSearchType::Process => {
            // Search suspicious processes by name / command line
            for proc in &state.threats.suspicious_processes {
                if proc.process_name.to_lowercase().contains(query)
                    || proc.command_line.to_lowercase().contains(query)
                {
                    let subtype = format!("{} {}", proc.process_name, proc.command_line).to_lowercase();
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
                            "{} \u{2014} Confiance: {}%",
                            proc.reason, proc.confidence,
                        ),
                        severity,
                        timestamp: proc.detected_at,
                        mitre_id: mitre.map(|m| m.id),
                    });
                }
            }
            // Also search system incidents
            for inc in &state.threats.system_incidents {
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
                    });
                }
            }
        }
        IocSearchType::Cve => {
            // Search vulnerability findings by CVE ID
            for vuln in &state.vulnerability_findings {
                if vuln.cve_id.to_lowercase().contains(query) {
                    results.push(IocSearchResult {
                        source: "VULN\u{00c9}RA.",
                        title: format!("{} \u{2014} {}", vuln.cve_id, vuln.affected_software),
                        match_description: vuln.description.clone(),
                        severity: vuln.severity.as_str(),
                        timestamp: vuln.discovered_at.unwrap_or_else(Utc::now),
                        mitre_id: None,
                    });
                }
            }
        }
    }

    // Sort by timestamp descending
    results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    results
}
