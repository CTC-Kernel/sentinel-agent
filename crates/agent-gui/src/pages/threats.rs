//! Threats page -- consolidated security threats and events.

use std::collections::hash_map::DefaultHasher;
use std::f32::consts::TAU;
use std::hash::{Hash, Hasher};

use chrono::{DateTime, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::{FimChangeType, GuiAgentStatus, Severity, UsbEventType};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

// ============================================================================
// Unified threat event (used only internally for merging & sorting)
// ============================================================================

/// A unified representation of any security threat, regardless of source.
#[derive(Clone)]
struct ThreatEvent {
    /// Source type: "process", "usb", "fim", "network", "system", or "vulnerability".
    kind: &'static str,
    /// Severity level: "critical", "high", "medium", or "low".
    severity: &'static str,
    /// Display title (e.g. process name, device name, or file path).
    title: String,
    /// Descriptive subtitle / detail line.
    description: String,
    /// When the event occurred.
    timestamp: DateTime<Utc>,
    /// Confidence score (only relevant for suspicious process events).
    confidence: Option<u8>,
    /// Full command line (only relevant for suspicious process events).
    command_line: Option<String>,
    /// Index into the original source collection.
    source_index: usize,
}

pub struct ThreatsPage;

impl ThreatsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Sys & Network", "Menaces"],
            "Menaces Détectées",
            Some("ANALYSE DES ÉVÉNEMENTS SUSPECTS ET CORRÉLATION IA"),
            Some(
                "Consultez le flux consolid\u{00e9} des \u{00e9}v\u{00e9}nements suspects (processus anormaux, cl\u{00e9}s USB non autoris\u{00e9}es, modifications FIM, alertes r\u{00e9}seau, incidents syst\u{00e8}me, vuln\u{00e9}rabilit\u{00e9}s). Le score de confiance IA aide \u{00e0} distinguer les faux positifs des menaces r\u{00e9}elles.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary counts (AAA Grade) ──────────────────────────────────
        let process_count = state.threats.suspicious_processes.len();
        let usb_count = state.threats.usb_events.len();
        let fim_unack_count = state.fim.alerts.iter().filter(|a| !a.acknowledged).count();
        let network_alert_count = state.network.alerts.len();
        let system_count = state.threats.system_incidents.len();
        let vuln_count = state.vulnerability_findings.len();
        let risk_score = Self::compute_risk_score(
            state,
            process_count,
            usb_count,
            fim_unack_count,
            network_alert_count,
            system_count,
            vuln_count,
        );

        let summary_items = vec![
            (
                "PROCESSUS SUSPECTS",
                process_count.to_string(),
                if process_count > 0 { theme::ERROR } else { theme::text_tertiary() },
                icons::BUG,
            ),
            (
                "ALERTES RÉSEAU",
                network_alert_count.to_string(),
                if network_alert_count > 0 { theme::SEVERITY_HIGH } else { theme::text_tertiary() },
                icons::NETWORK,
            ),
            (
                "ÉVÉNEMENTS USB",
                usb_count.to_string(),
                if usb_count > 0 { theme::WARNING } else { theme::text_tertiary() },
                icons::PLUG,
            ),
            (
                "ALERTES FIM",
                fim_unack_count.to_string(),
                if fim_unack_count > 0 { theme::WARNING } else { theme::text_tertiary() },
                icons::EYE,
            ),
            (
                "INCIDENTS SYST\u{00c8}ME",
                system_count.to_string(),
                if system_count > 0 { theme::SEVERITY_HIGH } else { theme::text_tertiary() },
                icons::SHIELD,
            ),
            (
                "VULN\u{00c9}RABILIT\u{00c9}S",
                vuln_count.to_string(),
                if vuln_count > 0 { theme::ERROR } else { theme::text_tertiary() },
                icons::SHIELD_VIRUS,
            ),
            (
                "SCORE DE RISQUE",
                risk_score.to_string(),
                Self::risk_score_color(risk_score),
                icons::BOLT,
            ),
        ];

        let summary_grid = widgets::ResponsiveGrid::new(180.0, theme::SPACE_SM);
        summary_grid.show(ui, &summary_items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // ── Severity distribution bar + Detection coverage ──────────────
        {
            // Build the unfiltered threat list for severity counts
            let all_threats = Self::build_threat_list(state);
            let mut critical_count: usize = 0;
            let mut high_count: usize = 0;
            let mut medium_count: usize = 0;
            let mut low_count: usize = 0;
            for t in &all_threats {
                match t.severity {
                    "critical" => critical_count += 1,
                    "high" => high_count += 1,
                    "medium" => medium_count += 1,
                    _ => low_count += 1,
                }
            }
            let total = all_threats.len();

            widgets::card(ui, |ui: &mut egui::Ui| {
                // ── A. Severity distribution horizontal bar ──
                ui.label(
                    egui::RichText::new("DISTRIBUTION PAR SÉVÉRITÉ")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                if total == 0 {
                    ui.label(
                        egui::RichText::new("Aucun événement")
                            .font(theme::font_body())
                            .color(theme::text_tertiary()),
                    );
                } else {
                    // Stacked horizontal bar
                    let bar_height = theme::PROGRESS_BAR_HEIGHT + 4.0;
                    let bar_width = ui.available_width();
                    let (rect, _) = ui.allocate_exact_size(
                        egui::vec2(bar_width, bar_height),
                        egui::Sense::hover(),
                    );
                    if ui.is_rect_visible(rect) {
                        let painter = ui.painter_at(rect);
                        let rounding =
                            egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
                        painter.rect_filled(rect, rounding, theme::bg_tertiary());

                        let segments: &[(usize, egui::Color32)] = &[
                            (critical_count, theme::ERROR),
                            (high_count, theme::SEVERITY_HIGH),
                            (medium_count, theme::WARNING),
                            (low_count, theme::INFO),
                        ];
                        let mut x = rect.min.x;
                        for (count, color) in segments {
                            if *count > 0 {
                                let w = (*count as f32 / total as f32) * bar_width;
                                let seg_rect = egui::Rect::from_min_size(
                                    egui::pos2(x, rect.min.y),
                                    egui::vec2(w, bar_height),
                                );
                                painter.rect_filled(seg_rect, rounding, *color);
                                x += w;
                            }
                        }
                    }

                    ui.add_space(theme::SPACE_SM);

                    // Legend row with counts
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let items: &[(&str, usize, egui::Color32)] = &[
                            ("Critique", critical_count, theme::ERROR),
                            ("\u{00c9}lev\u{00e9}", high_count, theme::SEVERITY_HIGH),
                            ("Moyen", medium_count, theme::WARNING),
                            ("Faible", low_count, theme::INFO),
                        ];
                        for (label, count, color) in items {
                            widgets::status_badge(
                                ui,
                                &format!("{}: {}", label, count),
                                *color,
                            );
                            ui.add_space(theme::SPACE_SM);
                        }
                    });
                }

                ui.add_space(theme::SPACE_MD);

                // ── B. Detection coverage indicator ──
                ui.label(
                    egui::RichText::new("COUVERTURE DE DÉTECTION")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                let has_process = !state.threats.suspicious_processes.is_empty()
                    || process_count == 0;
                let has_usb = true; // USB monitoring always active
                let has_fim = state.fim.monitored_count > 0;
                let has_network = !state.network.connections.is_empty()
                    || state.network.interface_count > 0;
                let has_system = true; // System monitoring always active
                let has_vuln = state.vulnerability_summary.is_some();

                let active_sources =
                    [has_process, has_usb, has_fim, has_network, has_system, has_vuln]
                        .iter()
                        .filter(|&&v| v)
                        .count();

                ui.horizontal(|ui: &mut egui::Ui| {
                    let coverage_color = if active_sources == 6 {
                        theme::SUCCESS
                    } else if active_sources >= 4 {
                        theme::WARNING
                    } else {
                        theme::ERROR
                    };
                    ui.label(
                        egui::RichText::new(format!(
                            "{}/6 sources actives",
                            active_sources,
                        ))
                        .font(theme::font_body())
                        .color(coverage_color)
                        .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    let sources: &[(&str, &str, bool)] = &[
                        ("Processus", icons::BUG, has_process),
                        ("USB", icons::PLUG, has_usb),
                        ("FIM", icons::FILE_SHIELD, has_fim),
                        ("R\u{00e9}seau", icons::NETWORK, has_network),
                        ("Syst\u{00e8}me", icons::SHIELD, has_system),
                        ("Vuln\u{00e9}rabilit\u{00e9}s", icons::SHIELD_VIRUS, has_vuln),
                    ];
                    for (label, icon, active) in sources {
                        let color = if *active {
                            theme::SUCCESS
                        } else {
                            theme::text_tertiary()
                        };
                        ui.label(
                            egui::RichText::new(*icon)
                                .size(theme::ICON_SM)
                                .color(color),
                        );
                        ui.label(
                            egui::RichText::new(*label)
                                .font(theme::font_label())
                                .color(color),
                        );
                        ui.add_space(theme::SPACE_SM);
                    }
                });
            });
        }

        ui.add_space(theme::SPACE_LG);

        // ── Search / filter bar (AAA Grade) ─────────────────────────────
        let proc_active = state.threats.filter.as_deref() == Some("process");
        let net_active = state.threats.filter.as_deref() == Some("network");
        let usb_active = state.threats.filter.as_deref() == Some("usb");
        let fim_active = state.threats.filter.as_deref() == Some("fim");
        let sys_active = state.threats.filter.as_deref() == Some("system");
        let vuln_active = state.threats.filter.as_deref() == Some("vulnerability");

        let cache_id = ui.make_persistent_id("threats_cache");
        let mut fp_hasher = DefaultHasher::new();
        state.threats.suspicious_processes.len().hash(&mut fp_hasher);
        state.threats.usb_events.len().hash(&mut fp_hasher);
        state.threats.system_incidents.len().hash(&mut fp_hasher);
        state.fim.alerts.len().hash(&mut fp_hasher);
        state.network.alerts.len().hash(&mut fp_hasher);
        state.vulnerability_findings.len().hash(&mut fp_hasher);
        state.threats.filter.hash(&mut fp_hasher);
        state.threats.search.hash(&mut fp_hasher);
        let fingerprint: u64 = fp_hasher.finish();
        let prev_fingerprint: Option<u64> =
            ui.memory(|mem| mem.data.get_temp(cache_id));
        let cached_threats_id = ui.make_persistent_id("threats_cached_list");

        let threats: Vec<ThreatEvent> = if prev_fingerprint.as_ref() == Some(&fingerprint) {
            // Use cached list if available
            ui.memory(|mem| mem.data.get_temp(cached_threats_id)).unwrap_or_default()
        } else {
            // Rebuild, filter, search, and sort
            let mut list = Self::build_threat_list(state);

            if let Some(ref filter) = state.threats.filter {
                list.retain(|t| t.kind == filter.as_str());
            }

            let search_lower = state.threats.search.to_ascii_lowercase();
            if !search_lower.is_empty() {
                list.retain(|t| {
                    let haystack = format!(
                        "{} {} {}",
                        t.title.to_lowercase(),
                        t.description.to_lowercase(),
                        t.kind,
                    );
                    haystack.contains(&search_lower)
                });
            }

            list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

            // Cache the result
            ui.memory_mut(|mem| {
                mem.data.insert_temp(cache_id, fingerprint);
                mem.data.insert_temp(cached_threats_id, list.clone());
            });
            list
        };

        let result_count = threats.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.threats.search,
            "RECHERCHER (PROCESSUS, R\u{00c9}SEAU, USB, FIM, SYST\u{00c8}ME, VULN\u{00c9}RA.)...",
        )
        .chip("PROCESSUS", proc_active, theme::ERROR)
        .chip("R\u{00c9}SEAU", net_active, theme::SEVERITY_HIGH)
        .chip("USB", usb_active, theme::WARNING)
        .chip("FIM", fim_active, theme::INFO)
        .chip("SYST\u{00c8}ME", sys_active, theme::SEVERITY_HIGH)
        .chip("VULN\u{00c9}RA.", vuln_active, theme::ERROR)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("process"),
                1 => Some("network"),
                2 => Some("usb"),
                3 => Some("fim"),
                4 => Some("system"),
                5 => Some("vulnerability"),
                _ => None,
            };
            if state.threats.filter.as_deref() == target {
                state.threats.filter = None;
            } else {
                state.threats.filter = target.map(|s| s.to_string());
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Action bar: Scan & Export (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    if is_scanning {
                        "SCAN EN COURS"
                    } else {
                        "LANCER LE SCAN"
                    },
                    icons::PLAY
                ),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let success = Self::export_threats_csv(&threats);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV menaces terminé")
                                    .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("Échec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_LG);

        // ── Threat Radar (AAA Grade) ────────────────────────────────────
        Self::render_threat_radar(ui, &threats);

        ui.add_space(theme::SPACE_LG);

        // ── Threat feed (AAA Grade) ─────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("FIL DE SÉCURITÉ CONSOLIDÉ")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if threats.is_empty() {
                widgets::protected_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "AUCUNE MENACE IDENTIFIÉE",
                    "Le système ne présente aucun événement de sécurité suspect à ce jour.",
                );
            } else {
                for (idx, threat) in threats.iter().enumerate() {
                    if Self::threat_row(ui, threat, idx) {
                        state.threats.selected_threat = Some(idx);
                        state.threats.detail_open = true;
                    }
                    ui.add_space(theme::SPACE_XS);
                }
            }
        });

        ui.add_space(theme::SPACE_XL);

        let ctx = ui.ctx().clone();
        if let Some(sel) = state.threats.selected_threat
            && sel < threats.len()
        {
            let threat = &threats[sel];
            match threat.kind {
                "process" => {
                    if threat.source_index < state.threats.suspicious_processes.len() {
                        let p = state.threats.suspicious_processes[threat.source_index].clone();
                        let conf_color = if p.confidence >= 90 {
                            theme::ERROR
                        } else if p.confidence >= 70 {
                            theme::SEVERITY_HIGH
                        } else if p.confidence >= 40 {
                            theme::WARNING
                        } else {
                            theme::INFO
                        };
                        let actions = [
                            widgets::DetailAction::secondary("Ignorer", icons::EYE_SLASH),
                            widgets::DetailAction::primary("Signaler", icons::FLAG),
                        ];
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &p.process_name, icons::BUG)
                            .accent(conf_color)
                            .subtitle("Processus suspect")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "INFORMATIONS DU PROCESSUS");
                                widgets::detail_field(ui, "Nom", &p.process_name);
                                widgets::detail_mono(ui, "Ligne de commande", &p.command_line);
                                widgets::detail_text(ui, "Raison de d\u{00e9}tection", &p.reason);
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}%", p.confidence),
                                    conf_color,
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &p.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );
                            }, &actions);
                        if let Some(action_idx) = drawer_action {
                            let time = ctx.input(|i| i.time);
                            if action_idx == 0 {
                                state.threats.detail_open = false;
                                state.threats.selected_threat = None;
                            } else if action_idx == 1 {
                                let details = format!(
                                    "Processus: {}\nCommande: {}\nRaison: {}\nConfiance: {}%",
                                    p.process_name, p.command_line, p.reason, p.confidence,
                                );
                                ctx.copy_text(details);
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "D\u{00e9}tails du processus copi\u{00e9}s dans le presse-papiers",
                                    )
                                    .with_time(time),
                                );
                            }
                        }
                    }
                }
                "usb" => {
                    if threat.source_index < state.threats.usb_events.len() {
                        let u = state.threats.usb_events[threat.source_index].clone();
                        let ev_color = match u.event_type {
                            UsbEventType::Connected => theme::WARNING,
                            UsbEventType::Disconnected => theme::INFO,
                        };
                        let actions = [
                            widgets::DetailAction::primary("Autoriser", icons::CHECK),
                            widgets::DetailAction::danger("Bloquer", icons::LOCK),
                        ];
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &u.device_name, icons::USB)
                            .accent(ev_color)
                            .subtitle("\u{00c9}v\u{00e9}nement USB")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "\u{00c9}V\u{00c9}NEMENT USB");
                                widgets::detail_field(ui, "P\u{00e9}riph\u{00e9}rique", &u.device_name);
                                widgets::detail_field(ui, "Vendor ID", &format!("0x{:04X}", u.vendor_id));
                                widgets::detail_field(ui, "Product ID", &format!("0x{:04X}", u.product_id));
                                widgets::detail_field_badge(
                                    ui,
                                    "Type d'\u{00e9}v\u{00e9}nement",
                                    u.event_type.label(),
                                    ev_color,
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date",
                                    &u.timestamp.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );
                            }, &actions);
                        if let Some(action_idx) = drawer_action
                            && (action_idx == 0 || action_idx == 1)
                        {
                            state.threats.detail_open = false;
                            state.threats.selected_threat = None;
                        }
                    }
                }
                "system" => {
                    if threat.source_index < state.threats.system_incidents.len() {
                        let inc = state.threats.system_incidents[threat.source_index].clone();
                        let sev_color = match inc.severity {
                            Severity::Critical => theme::ERROR,
                            Severity::High => theme::SEVERITY_HIGH,
                            Severity::Medium => theme::WARNING,
                            _ => theme::INFO,
                        };
                        let actions = [
                            widgets::DetailAction::secondary("Acquitter", icons::CHECK),
                            widgets::DetailAction::primary("Signaler", icons::FLAG),
                        ];
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &inc.title, icons::SHIELD)
                            .accent(sev_color)
                            .subtitle("Incident syst\u{00e8}me")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "INCIDENT SYST\u{00c8}ME");
                                widgets::detail_field(
                                    ui,
                                    "Type",
                                    Self::system_incident_type_label(&inc.incident_type),
                                );
                                widgets::detail_text(ui, "Description", &inc.description);
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}%", inc.confidence),
                                    sev_color,
                                );
                                widgets::detail_field_badge(
                                    ui,
                                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                    inc.severity.label(),
                                    sev_color,
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &inc.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );
                            }, &actions);
                        if let Some(action_idx) = drawer_action {
                            let time = ctx.input(|i| i.time);
                            if action_idx == 0 {
                                state.threats.detail_open = false;
                                state.threats.selected_threat = None;
                                state.toasts.push(
                                    crate::widgets::toast::Toast::success("Incident acquitt\u{00e9}")
                                        .with_time(time),
                                );
                            } else if action_idx == 1 {
                                let details = format!(
                                    "Incident: {}\nType: {}\nDescription: {}\nConfiance: {}%",
                                    inc.title, inc.incident_type, inc.description, inc.confidence,
                                );
                                ctx.copy_text(details);
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "D\u{00e9}tails de l'incident copi\u{00e9}s dans le presse-papiers",
                                    )
                                    .with_time(time),
                                );
                            }
                        }
                    }
                }
                "vulnerability" => {
                    if threat.source_index < state.vulnerability_findings.len() {
                        let v = state.vulnerability_findings[threat.source_index].clone();
                        let sev_color = match v.severity {
                            Severity::Critical => theme::ERROR,
                            Severity::High => theme::SEVERITY_HIGH,
                            Severity::Medium => theme::WARNING,
                            _ => theme::INFO,
                        };
                        let actions = [
                            widgets::DetailAction::primary("Voir d\u{00e9}tails", icons::EYE),
                        ];
                        let drawer_title = format!("{} \u{2014} {}", v.cve_id, v.affected_software);
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &drawer_title, icons::SHIELD_VIRUS)
                            .accent(sev_color)
                            .subtitle("Vuln\u{00e9}rabilit\u{00e9}")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "VULN\u{00c9}RABILIT\u{00c9}");
                                widgets::detail_field(ui, "CVE", &v.cve_id);
                                widgets::detail_field(ui, "Logiciel", &v.affected_software);
                                widgets::detail_field(ui, "Version", &v.affected_version);
                                if let Some(cvss) = v.cvss_score {
                                    widgets::detail_field_colored(
                                        ui,
                                        "Score CVSS",
                                        &format!("{:.1}", cvss),
                                        sev_color,
                                    );
                                }
                                widgets::detail_field_badge(
                                    ui,
                                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                    v.severity.label(),
                                    sev_color,
                                );
                                widgets::detail_field(
                                    ui,
                                    "Correctif disponible",
                                    if v.fix_available { "Oui" } else { "Non" },
                                );
                                widgets::detail_text(ui, "Description", &v.description);
                            }, &actions);
                        if let Some(0) = drawer_action {
                            ctx.copy_text(v.cve_id.clone());
                            let time = ctx.input(|i| i.time);
                            state.toasts.push(
                                crate::widgets::toast::Toast::info(
                                    "CVE copi\u{00e9} dans le presse-papiers",
                                )
                                .with_time(time),
                            );
                        }
                    }
                }
                "fim" => {
                    if threat.source_index < state.fim.alerts.len() {
                        let f = state.fim.alerts[threat.source_index].clone();
                        let sev_color = match threat.severity {
                            "critical" | "high" => theme::ERROR,
                            "medium" => theme::WARNING,
                            _ => theme::INFO,
                        };
                        let actions = [
                            widgets::DetailAction::secondary("Copier le chemin", icons::COPY),
                        ];
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &f.path, icons::FILE)
                            .accent(sev_color)
                            .subtitle("Alerte d'int\u{00e9}grit\u{00e9}")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "ALERTE FIM");
                                widgets::detail_mono(ui, "Chemin", &f.path);
                                widgets::detail_field(
                                    ui,
                                    "Type de changement",
                                    Self::change_type_label(f.change_type),
                                );
                                if let Some(ref old) = f.old_hash {
                                    widgets::detail_mono(ui, "Hash pr\u{00e9}c\u{00e9}dent", old);
                                }
                                if let Some(ref new) = f.new_hash {
                                    widgets::detail_mono(ui, "Nouveau hash", new);
                                }
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &f.timestamp.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );
                                widgets::detail_field_badge(
                                    ui,
                                    "\u{00c9}tat",
                                    if f.acknowledged { "Acquitt\u{00e9}" } else { "Non acquitt\u{00e9}" },
                                    if f.acknowledged { theme::SUCCESS } else { sev_color },
                                );
                            }, &actions);
                        if let Some(0) = drawer_action {
                            ctx.copy_text(f.path.clone());
                            let time = ctx.input(|i| i.time);
                            state.toasts.push(
                                crate::widgets::toast::Toast::info(
                                    "Chemin copi\u{00e9} dans le presse-papiers",
                                )
                                .with_time(time),
                            );
                        }
                    }
                }
                "network" => {
                    if threat.source_index < state.network.alerts.len() {
                        let a = state.network.alerts[threat.source_index].clone();
                        let sev_color = match a.severity {
                            Severity::Critical => theme::ERROR,
                            Severity::High => theme::SEVERITY_HIGH,
                            Severity::Medium => theme::WARNING,
                            _ => theme::INFO,
                        };
                        let actions = [
                            widgets::DetailAction::secondary("Copier les d\u{00e9}tails", icons::COPY),
                        ];
                        let alert_label = Self::network_alert_type_label(&a.alert_type);
                        let drawer_action = widgets::DetailDrawer::new("threat_detail", &alert_label, icons::WIFI)
                            .accent(sev_color)
                            .subtitle("Alerte r\u{00e9}seau")
                            .show(&ctx, &mut state.threats.detail_open, |ui| {
                                widgets::detail_section(ui, "ALERTE R\u{00c9}SEAU");
                                widgets::detail_field(ui, "Type", &alert_label);
                                widgets::detail_text(ui, "Description", &a.description);
                                widgets::detail_field_badge(
                                    ui,
                                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                    a.severity.label(),
                                    sev_color,
                                );
                                if let Some(ref src) = a.source_ip {
                                    widgets::detail_mono(ui, "IP source", src);
                                }
                                if let Some(ref dst) = a.destination_ip {
                                    widgets::detail_mono(ui, "IP destination", dst);
                                }
                                if let Some(port) = a.destination_port {
                                    widgets::detail_field(ui, "Port destination", &port.to_string());
                                }
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}%", a.confidence),
                                    sev_color,
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &a.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );
                            }, &actions);
                        if let Some(0) = drawer_action {
                            let details = format!(
                                "Type: {}\nDescription: {}\nSource: {}\nDestination: {}:{}\nConfiance: {}%",
                                alert_label,
                                a.description,
                                a.source_ip.as_deref().unwrap_or("--"),
                                a.destination_ip.as_deref().unwrap_or("--"),
                                a.destination_port.map(|p| p.to_string()).unwrap_or_else(|| "--".to_string()),
                                a.confidence,
                            );
                            ctx.copy_text(details);
                            let time = ctx.input(|i| i.time);
                            state.toasts.push(
                                crate::widgets::toast::Toast::info(
                                    "D\u{00e9}tails copi\u{00e9}s dans le presse-papiers",
                                )
                                .with_time(time),
                            );
                        }
                    }
                }
                _ => {
                    state.threats.detail_open = false;
                    state.threats.selected_threat = None;
                }
            }
        }

        command
    }

    // ====================================================================
    // Internal helpers
    // ====================================================================

    /// Compute a risk score (0-100) that prioritizes critical threats across all 6 sources.
    fn compute_risk_score(
        state: &AppState,
        processes: usize,
        usb: usize,
        fim_unack: usize,
        network_alerts: usize,
        system_incidents: usize,
        vuln_count: usize,
    ) -> u32 {
        // Count critical processes (confidence > 80)
        let critical_processes = state
            .threats
            .suspicious_processes
            .iter()
            .filter(|p| p.confidence > 80)
            .count();

        let regular_processes = processes.saturating_sub(critical_processes);

        // Count critical network alerts (C2, exfiltration, mining)
        let critical_net = state
            .network
            .alerts
            .iter()
            .filter(|a| matches!(a.severity, Severity::Critical))
            .count();
        let regular_net = network_alerts.saturating_sub(critical_net);

        // Count critical system incidents
        let critical_sys = state
            .threats
            .system_incidents
            .iter()
            .filter(|i| matches!(i.severity, Severity::Critical))
            .count();
        let regular_sys = system_incidents.saturating_sub(critical_sys);

        // Count critical vulnerabilities
        let critical_vulns = state
            .vulnerability_findings
            .iter()
            .filter(|v| matches!(v.severity, Severity::Critical))
            .count();
        let high_vulns = state
            .vulnerability_findings
            .iter()
            .filter(|v| matches!(v.severity, Severity::High))
            .count();
        let _regular_vulns = vuln_count.saturating_sub(critical_vulns).saturating_sub(high_vulns);

        // Weighted formula with critical event prioritization
        let raw = (critical_processes as u32)
            .saturating_mul(40) // Critical processes: highest weight
            .saturating_add((critical_net as u32).saturating_mul(35)) // Critical network alerts
            .saturating_add((critical_sys as u32).saturating_mul(30)) // Critical system incidents
            .saturating_add((critical_vulns as u32).saturating_mul(25)) // Critical vulnerabilities
            .saturating_add((high_vulns as u32).saturating_mul(10)) // High vulnerabilities
            .saturating_add((regular_processes as u32).saturating_mul(10)) // Regular processes
            .saturating_add((regular_net as u32).saturating_mul(12)) // Regular network alerts
            .saturating_add((regular_sys as u32).saturating_mul(8)) // Regular system incidents
            .saturating_add((fim_unack as u32).saturating_mul(15)) // FIM alerts
            .saturating_add((usb as u32).saturating_mul(5)); // USB events

        raw.min(100)
    }

    /// Map risk score to a color.
    fn risk_score_color(score: u32) -> egui::Color32 {
        if score == 0 {
            theme::SUCCESS
        } else if score < 30 {
            theme::INFO
        } else if score < 60 {
            theme::WARNING
        } else {
            theme::ERROR
        }
    }

    /// Build a unified threat list from all state sources.
    fn build_threat_list(state: &AppState) -> Vec<ThreatEvent> {
        let mut events = Vec::new();

        // Suspicious processes
        for (i, p) in state.threats.suspicious_processes.iter().enumerate() {
            let severity = if p.confidence >= 90 {
                "critical"
            } else if p.confidence >= 70 {
                "high"
            } else if p.confidence >= 40 {
                "medium"
            } else {
                "low"
            };
            events.push(ThreatEvent {
                kind: "process",
                severity,
                title: p.process_name.clone(),
                description: p.reason.clone(),
                timestamp: p.detected_at,
                confidence: Some(p.confidence),
                command_line: Some(p.command_line.clone()),
                source_index: i,
            });
        }

        // USB events
        for (i, u) in state.threats.usb_events.iter().enumerate() {
            let severity = match u.event_type {
                UsbEventType::Connected => "medium",
                UsbEventType::Disconnected => "low",
            };
            events.push(ThreatEvent {
                kind: "usb",
                severity,
                title: u.device_name.clone(),
                description: format!(
                    "{} \u{2014} VID:{:04X} PID:{:04X}",
                    u.event_type, u.vendor_id, u.product_id,
                ),
                timestamp: u.timestamp,
                confidence: None,
                command_line: None,
                source_index: i,
            });
        }

        // FIM alerts
        for (i, f) in state.fim.alerts.iter().enumerate() {
            let severity = match f.change_type {
                FimChangeType::Deleted | FimChangeType::PermissionChanged => "high",
                FimChangeType::Created => "medium",
                FimChangeType::Modified => "medium",
                FimChangeType::Renamed => "low",
            };
            events.push(ThreatEvent {
                kind: "fim",
                severity,
                title: f.path.clone(),
                description: format!(
                    "Changement d\u{00e9}tect\u{00e9} : {}{}",
                    Self::change_type_label(f.change_type),
                    if f.acknowledged {
                        " (acquitt\u{00e9})"
                    } else {
                        ""
                    },
                ),
                timestamp: f.timestamp,
                confidence: None,
                command_line: None,
                source_index: i,
            });
        }

        // Network security alerts
        for (i, alert) in state.network.alerts.iter().enumerate() {
            let severity = alert.severity.as_str();
            let title = Self::network_alert_type_label(&alert.alert_type);
            let mut desc_parts = vec![alert.description.clone()];
            if let Some(ref src) = alert.source_ip {
                desc_parts.push(format!("SRC: {}", src));
            }
            if let Some(ref dst) = alert.destination_ip {
                if let Some(port) = alert.destination_port {
                    desc_parts.push(format!("DST: {}:{}", dst, port));
                } else {
                    desc_parts.push(format!("DST: {}", dst));
                }
            }
            events.push(ThreatEvent {
                kind: "network",
                severity,
                title,
                description: desc_parts.join(" \u{2014} "),
                timestamp: alert.detected_at,
                confidence: Some(alert.confidence),
                command_line: None,
                source_index: i,
            });
        }

        // System security incidents
        for (i, inc) in state.threats.system_incidents.iter().enumerate() {
            events.push(ThreatEvent {
                kind: "system",
                severity: inc.severity.as_str(),
                title: inc.title.clone(),
                description: inc.description.clone(),
                timestamp: inc.detected_at,
                confidence: Some(inc.confidence),
                command_line: None,
                source_index: i,
            });
        }

        // Vulnerability findings
        for (i, v) in state.vulnerability_findings.iter().enumerate() {
            events.push(ThreatEvent {
                kind: "vulnerability",
                severity: v.severity.as_str(),
                title: format!("{} \u{2014} {}", v.cve_id, v.affected_software),
                description: v.description.clone(),
                timestamp: v.discovered_at.unwrap_or_else(Utc::now),
                confidence: v.cvss_score.map(|s| (s * 10.0).min(100.0) as u8),
                command_line: None,
                source_index: i,
            });
        }

        events
    }

    /// French label for a FIM change type.
    fn change_type_label(change_type: FimChangeType) -> &'static str {
        match change_type {
            FimChangeType::Created => "cr\u{00e9}ation",
            FimChangeType::Modified => "modification",
            FimChangeType::Deleted => "suppression",
            FimChangeType::PermissionChanged => "permissions modifi\u{00e9}es",
            FimChangeType::Renamed => "renommage",
        }
    }

    /// Severity icon + color tuple.
    fn severity_display(severity: &str) -> (&'static str, egui::Color32) {
        match severity {
            "critical" => (icons::SEVERITY_CRITICAL, theme::ERROR),
            "high" => (icons::SEVERITY_HIGH, theme::SEVERITY_HIGH),
            "medium" => (icons::SEVERITY_MEDIUM, theme::WARNING),
            "low" => (icons::SEVERITY_LOW, theme::INFO),
            _ => (icons::SEVERITY_LOW, theme::WARNING),
        }
    }

    /// French badge label for a threat kind.
    fn kind_badge(kind: &str) -> (&'static str, egui::Color32) {
        match kind {
            "process" => ("PROCESSUS", theme::ERROR),
            "network" => ("R\u{00c9}SEAU", theme::SEVERITY_HIGH),
            "usb" => ("USB", theme::WARNING),
            "fim" => ("FIM", theme::INFO),
            "system" => ("SYST\u{00c8}ME", theme::SEVERITY_HIGH),
            "vulnerability" => ("VULN\u{00c9}RA.", theme::ERROR),
            _ => ("AUTRE", theme::WARNING),
        }
    }

    /// French label for a network alert type.
    fn network_alert_type_label(alert_type: &str) -> String {
        match alert_type {
            "c2" => "Commande & Contr\u{00f4}le (C2)".to_string(),
            "mining" => "Crypto-minage d\u{00e9}tect\u{00e9}".to_string(),
            "exfiltration" => "Exfiltration de donn\u{00e9}es".to_string(),
            "dga" => "Domaine DGA d\u{00e9}tect\u{00e9}".to_string(),
            "beaconing" => "Balise C2 d\u{00e9}tect\u{00e9}e".to_string(),
            "port_scan" => "Scan de ports".to_string(),
            "suspicious_port" => "Port suspect".to_string(),
            "dns_tunneling" => "Tunnel DNS d\u{00e9}tect\u{00e9}".to_string(),
            other => other.replace('_', " ").to_uppercase(),
        }
    }

    /// French label for a system incident type.
    fn system_incident_type_label(incident_type: &str) -> &'static str {
        match incident_type {
            "firewall_disabled" => "Pare-feu d\u{00e9}sactiv\u{00e9}",
            "antivirus_disabled" => "Antivirus d\u{00e9}sactiv\u{00e9}",
            "privilege_escalation" => "Escalade de privil\u{00e8}ges",
            "reverse_shell" => "Reverse shell d\u{00e9}tect\u{00e9}",
            "credential_theft" => "Vol d\u{2019}identifiants",
            "unauthorized_change" => "Changement non autoris\u{00e9}",
            "malware" => "Malware d\u{00e9}tect\u{00e9}",
            "crypto_miner" => "Crypto-mineur d\u{00e9}tect\u{00e9}",
            "data_exfiltration" => "Exfiltration de donn\u{00e9}es",
            "suspicious_process" => "Processus suspect",
            _ => "Incident syst\u{00e8}me",
        }
    }

    fn threat_row(ui: &mut Ui, threat: &ThreatEvent, idx: usize) -> bool {
        let (sev_icon, sev_color) = Self::severity_display(threat.severity);
        let (kind_label, kind_color) = Self::kind_badge(threat.kind);

        let accent_bar_width = 3.0_f32;
        let frame_resp = egui::Frame::new()
            .fill(theme::bg_tertiary())
            .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG))
            .inner_margin(egui::Margin {
                left: (theme::SPACE + accent_bar_width) as i8,
                right: theme::SPACE_MD as i8,
                top: theme::SPACE_MD as i8,
                bottom: theme::SPACE_MD as i8,
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

                    widgets::status_badge(ui, kind_label, kind_color);

                    ui.add_space(theme::SPACE_SM);

                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(&threat.title)
                                .font(theme::font_body())
                                .color(theme::text_primary())
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(&threat.description)
                                .font(theme::font_min())
                                .color(theme::text_secondary()),
                        );
                        if let Some(ref cmd) = threat.command_line
                            && !cmd.is_empty()
                        {
                            ui.label(
                                egui::RichText::new(cmd)
                                    .font(theme::font_mono())
                                    .color(theme::text_tertiary()),
                            );
                        }
                    });

                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(format!(
                                    "{}  {}",
                                    icons::CLOCK,
                                    threat.timestamp.format("%d/%m/%Y %H:%M"),
                                ))
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                            );

                            if let Some(conf) = threat.confidence {
                                ui.add_space(theme::SPACE_SM);
                                let conf_color = if conf >= 90 {
                                    theme::ERROR
                                } else if conf >= 70 {
                                    theme::SEVERITY_HIGH
                                } else if conf >= 40 {
                                    theme::WARNING
                                } else {
                                    theme::INFO
                                };
                                widgets::status_badge(ui, &format!("{}%", conf), conf_color);
                            }
                        },
                    );
                });
            });

        let rect = frame_resp.response.rect;
        let clicked = ui
            .interact(rect, ui.id().with(("threat_click", idx)), egui::Sense::click())
            .clicked();

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

        clicked
    }

    /// Draw a summary card (AAA Grade)
    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.set_min_height(72.0);
                let response =
                    ui.interact(ui.max_rect(), ui.id().with(label), egui::Sense::hover());

                let safe_color = theme::readable_color(color);
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        let value_color = if response.hovered() {
                            safe_color
                        } else {
                            safe_color.linear_multiply(theme::OPACITY_STRONG)
                        };

                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(value_color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            let icon_alpha = if response.hovered() {
                                theme::OPACITY_MEDIUM
                            } else {
                                theme::OPACITY_DISABLED
                            };
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(safe_color.linear_multiply(icon_alpha)),
                            );
                        },
                    );
                });

                // Bottom accent line on hover (Neon glow)
                if response.hovered() {
                    let rect = ui.max_rect();
                    let line_y = rect.bottom() - 1.5;

                    // Main line
                    ui.painter().hline(
                        rect.left() + theme::CARD_GLOW_INSET..=rect.right() - theme::CARD_GLOW_INSET,
                        line_y,
                        egui::Stroke::new(theme::CARD_GLOW_STROKE, color),
                    );

                    // Outer glow
                    ui.painter().hline(
                        rect.left() + theme::CARD_GLOW_OUTER_INSET..=rect.right() - theme::CARD_GLOW_OUTER_INSET,
                        line_y,
                        egui::Stroke::new(theme::CARD_GLOW_OUTER_STROKE, color.linear_multiply(theme::OPACITY_TINT)),
                    );

                    ui.ctx().request_repaint();
                }
            });
        });
    }

    fn render_threat_radar(ui: &mut Ui, threats: &[ThreatEvent]) {
        let reduced = theme::is_reduced_motion();

        widgets::card(ui, |ui: &mut egui::Ui| {
            // ── Header with live indicator ──
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::EYE)
                        .size(theme::ICON_SM)
                        .color(theme::readable_color(theme::SUCCESS)),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("RADAR DE DÉTECTION")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} signaux", threats.len()))
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                        );
                        if !threats.is_empty() {
                            ui.add_space(theme::SPACE_SM);
                            let pulse_alpha = if reduced {
                                theme::OPACITY_STRONG
                            } else {
                                let t = ui.input(|i| i.time);
                                (0.5 + (t * 2.0).sin() as f32 * 0.5).clamp(0.4, 1.0)
                            };
                            ui.label(
                                egui::RichText::new("\u{25cf}")
                                    .size(theme::STATUS_DOT_SIZE)
                                    .color(theme::readable_color(theme::SUCCESS).linear_multiply(pulse_alpha)),
                            );
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("EN DIRECT")
                                    .font(theme::font_label())
                                    .color(
                                        theme::readable_color(theme::SUCCESS),
                                    )
                                    .strong(),
                            );
                        }
                    },
                );
            });
            ui.add_space(theme::SPACE_MD);

            // ── Radar canvas ──
            let available_w = ui.available_width();
            let (rect, _) = ui.allocate_exact_size(
                egui::vec2(available_w, theme::RADAR_HEIGHT),
                egui::Sense::hover(),
            );
            let painter = ui.painter_at(rect);
            let center = rect.center();
            let radius = theme::RADAR_RADIUS;
            let time = ui.input(|i| i.time);

            // ─ Background: dark substrate + accent aura ─
            painter.circle_filled(center, radius + theme::SPACE, theme::bg_deep());
            painter.circle_filled(
                center,
                radius * 0.35,
                theme::ACCENT.linear_multiply(0.025),
            );

            // ─ Grid: concentric rings ─
            let grid_color = theme::border().linear_multiply(theme::OPACITY_MODERATE);
            let ring_count = 4;
            for i in 1..=ring_count {
                let r = radius * (i as f32 / ring_count as f32);
                painter.circle_stroke(
                    center,
                    r,
                    egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
                );
            }

            // ─ Radial lines (8 for premium density) ─
            for i in 0..8 {
                let angle = (i as f32 / 8.0) * TAU;
                let end = center + egui::vec2(angle.cos(), angle.sin()) * radius;
                let line_alpha = if i % 2 == 0 {
                    theme::OPACITY_MODERATE
                } else {
                    theme::OPACITY_TINT
                };
                painter.line_segment(
                    [center, end],
                    egui::Stroke::new(
                        theme::BORDER_HAIRLINE,
                        theme::border().linear_multiply(line_alpha),
                    ),
                );
            }

            // ─ Zone labels (NE quadrant, alongside rings) ─
            let zone_labels = ["CRITIQUE", "\u{00c9}LEV\u{00c9}", "MOYEN", "FAIBLE"];
            let zone_colors = [
                theme::ERROR,
                theme::SEVERITY_HIGH,
                theme::WARNING,
                theme::INFO,
            ];
            let zone_angle = TAU * 0.06;
            for (i, (label, color)) in zone_labels.iter().zip(zone_colors.iter()).enumerate() {
                let r = radius * ((i + 1) as f32 / ring_count as f32) - 6.0;
                let pos = center + egui::vec2(zone_angle.cos() * r, zone_angle.sin() * r);
                painter.text(
                    pos,
                    egui::Align2::LEFT_BOTTOM,
                    *label,
                    theme::font_caption(),
                    color.linear_multiply(theme::OPACITY_MEDIUM),
                );
            }

            // ─ Sector labels (cardinal directions) ─
            let sectors: [(&str, f32, egui::Align2); 6] = [
                ("PROCESSUS", -TAU / 4.0, egui::Align2::CENTER_BOTTOM),
                ("SYST\u{00c8}ME", -TAU / 12.0, egui::Align2::LEFT_BOTTOM),
                ("USB", TAU / 12.0, egui::Align2::LEFT_TOP),
                ("FIM", TAU / 4.0, egui::Align2::CENTER_TOP),
                ("VULN\u{00c9}RA.", 5.0 * TAU / 12.0, egui::Align2::RIGHT_TOP),
                ("R\u{00c9}SEAU", -5.0 * TAU / 12.0, egui::Align2::RIGHT_BOTTOM),
            ];
            let sector_offset = radius + theme::SPACE_LG;
            for (label, angle, align) in sectors {
                let pos = center + egui::vec2(angle.cos() * sector_offset, angle.sin() * sector_offset);
                painter.text(pos, align, label, theme::font_label(), theme::text_tertiary());
            }

            // ─ Sweep animation with fading trail ─
            if !reduced {
                let sweep_angle = (time * 1.2) as f32 % TAU;

                // Trailing lines (25 segments, quadratic alpha falloff)
                let trail_count = 25;
                let trail_arc = 0.5_f32;
                for i in 0..trail_count {
                    let t = i as f32 / trail_count as f32;
                    let a = sweep_angle - trail_arc * t;
                    let end = center + egui::vec2(a.cos(), a.sin()) * radius;
                    let alpha = 0.3 * (1.0 - t).powi(2);
                    let width = theme::BORDER_MEDIUM * (1.0 - t * 0.5);
                    painter.line_segment(
                        [center, end],
                        egui::Stroke::new(width, theme::SUCCESS.linear_multiply(alpha)),
                    );
                }

                // Leading edge (brightest)
                let lead_end =
                    center + egui::vec2(sweep_angle.cos(), sweep_angle.sin()) * radius;
                painter.line_segment(
                    [center, lead_end],
                    egui::Stroke::new(
                        theme::BORDER_THICK,
                        theme::SUCCESS.linear_multiply(theme::OPACITY_HOVER_SOFT),
                    ),
                );
            }

            // ─ Blips (severity-based positioning + glow layers) ─
            let sweep_angle = if reduced {
                0.0
            } else {
                (time * 1.2) as f32 % TAU
            };

            for (i, threat) in threats.iter().enumerate() {
                let mut hasher = DefaultHasher::new();
                threat.title.hash(&mut hasher);
                let seed = hasher.finish();

                // Sector base angle: PROCESSUS=N(-90°), USB=E(0°), FIM=S(90°), RÉSEAU=W(180°)
                let sector_base = match threat.kind {
                    "process" => -TAU / 4.0,
                    "system" => -TAU / 12.0,
                    "usb" => TAU / 12.0,
                    "fim" => TAU / 4.0,
                    "vulnerability" => 5.0 * TAU / 12.0,
                    "network" => -5.0 * TAU / 12.0,
                    _ => 0.0,
                };
                // Scatter within ±40° of sector center
                let scatter =
                    ((seed % 1000) as f32 / 1000.0 - 0.5) * (TAU / 4.5);
                let t_angle = sector_base + scatter;

                // Severity → distance from center (critical = near center = danger zone)
                let (dist_min, dist_max) = match threat.severity {
                    "critical" => (0.12, 0.30),
                    "high" => (0.30, 0.55),
                    "medium" => (0.55, 0.75),
                    _ => (0.75, 0.92),
                };
                let hash_frac = ((seed >> 8) % 100) as f32 / 100.0;
                let t_dist = (dist_min + hash_frac * (dist_max - dist_min)) * radius;
                let blip_pos = center + egui::vec2(t_angle.cos(), t_angle.sin()) * t_dist;

                let color = match threat.severity {
                    "critical" => theme::ERROR,
                    "high" => theme::SEVERITY_HIGH,
                    "medium" => theme::WARNING,
                    _ => theme::INFO,
                };

                let blip_core = match threat.severity {
                    "critical" => 5.0_f32,
                    "high" => 4.0,
                    "medium" => 3.5,
                    _ => 3.0,
                };

                // Pulse calculation
                let pulse = if reduced {
                    0.5
                } else {
                    let diff = ((sweep_angle - t_angle) % TAU + TAU) % TAU;
                    let near = !(0.25..=(TAU - 0.25)).contains(&diff);
                    if near {
                        1.0
                    } else {
                        ((time * 2.0 + i as f64 * 0.7).sin() * 0.3 + 0.5) as f32
                    }
                };

                // Glow layers (3 concentric, fading outward)
                for layer in (0..3).rev() {
                    let r = blip_core + (layer as f32 + 1.0) * 2.5 + pulse * 2.0;
                    let alpha = theme::OPACITY_SUBTLE / (layer as f32 + 1.0);
                    painter.circle_filled(blip_pos, r, color.linear_multiply(alpha));
                }

                // Inner glow
                painter.circle_filled(
                    blip_pos,
                    blip_core + pulse * 2.0,
                    color.linear_multiply(theme::OPACITY_TINT + pulse * theme::OPACITY_TINT),
                );

                // Core
                painter.circle_filled(blip_pos, blip_core, color);

                // Label on sweep proximity
                if !reduced {
                    let diff = ((sweep_angle - t_angle) % TAU + TAU) % TAU;
                    if !(0.15..=(TAU - 0.15)).contains(&diff) {
                        let label_text: String = threat.title.chars().take(24).collect();
                        let label_pos =
                            blip_pos + egui::vec2(theme::SPACE_SM, -theme::SPACE_SM);
                        let galley = painter.layout_no_wrap(
                            label_text,
                            theme::font_min(),
                            theme::text_primary(),
                        );
                        let text_rect =
                            egui::Align2::LEFT_BOTTOM.anchor_size(label_pos, galley.size());
                        let bg_rect = text_rect.expand(3.0);
                        painter.rect_filled(
                            bg_rect,
                            theme::ROUNDING_SM,
                            theme::bg_secondary().linear_multiply(theme::OPACITY_STRONG),
                        );
                        painter.galley(text_rect.min, galley, theme::text_primary());
                    }
                }
            }

            // ─ Center dot (3-layer) ─
            painter.circle_filled(
                center,
                6.0,
                theme::ACCENT.linear_multiply(theme::OPACITY_TINT),
            );
            painter.circle_filled(center, 3.0, theme::ACCENT);
            painter.circle_filled(
                center,
                1.5,
                theme::text_on_accent().linear_multiply(theme::OPACITY_MODERATE),
            );

            // Request animation repaint
            if !reduced {
                ui.ctx()
                    .request_repaint_after(std::time::Duration::from_millis(50));
            }

            // ── Legend row ──
            ui.add_space(theme::SPACE_MD);
            ui.horizontal(|ui: &mut egui::Ui| {
                let legends = [
                    ("Critique", theme::ERROR),
                    ("\u{00c9}lev\u{00e9}", theme::SEVERITY_HIGH),
                    ("Moyen", theme::WARNING),
                    ("Faible", theme::INFO),
                ];
                for (label, color) in legends {
                    ui.label(
                        egui::RichText::new("\u{25cf}")
                            .size(theme::STATUS_DOT_SIZE)
                            .color(color),
                    );
                    ui.add_space(theme::SPACE_MICRO);
                    ui.label(
                        egui::RichText::new(label)
                            .font(theme::font_label())
                            .color(theme::text_secondary()),
                    );
                    ui.add_space(theme::SPACE_MD);
                }
            });
        });
    }

    fn export_threats_csv(threats: &[ThreatEvent]) -> bool {
        let headers = &[
            "kind",
            "severity",
            "title",
            "description",
            "timestamp",
            "confidence",
        ];
        let rows: Vec<Vec<String>> = threats
            .iter()
            .map(|t| {
                vec![
                    t.kind.to_string(),
                    t.severity.to_string(),
                    t.title.clone(),
                    t.description.clone(),
                    t.timestamp.to_rfc3339(),
                    t.confidence.map(|c| c.to_string()).unwrap_or_default(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("menaces_export.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
