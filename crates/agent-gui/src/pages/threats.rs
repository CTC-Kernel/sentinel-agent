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
    /// Source type: "process", "usb", or "fim".
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
}

pub struct ThreatsPage;

impl ThreatsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Menaces"],
            "Menaces Détectées",
            Some("ANALYSE DES ÉVÉNEMENTS SUSPECTS ET CORRÉLATION IA"),
            Some(
                "Consultez le flux consolidé des événements suspects (processus anormaux, clés USB non autorisées, modifications FIM). Le score de confiance IA aide à distinguer les faux positifs des menaces réelles.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary counts (AAA Grade) ──────────────────────────────────
        let process_count = state.threats.suspicious_processes.len();
        let usb_count = state.threats.usb_events.len();
        let fim_unack_count = state.fim.alerts.iter().filter(|a| !a.acknowledged).count();
        let network_alert_count = state.network.alerts.len();
        let risk_score = Self::compute_risk_score(
            state,
            process_count,
            usb_count,
            fim_unack_count,
            network_alert_count,
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

        // ── Search / filter bar (AAA Grade) ─────────────────────────────
        let proc_active = state.threats.filter.as_deref() == Some("process");
        let net_active = state.threats.filter.as_deref() == Some("network");
        let usb_active = state.threats.filter.as_deref() == Some("usb");
        let fim_active = state.threats.filter.as_deref() == Some("fim");

        // Dirty-tracking: only rebuild + sort threat list when source data changes
        let cache_id = ui.make_persistent_id("threats_cache");
        let fingerprint = (
            state.threats.suspicious_processes.len(),
            state.threats.usb_events.len(),
            state.fim.alerts.len(),
            state.network.alerts.len(),
            state.threats.filter.clone(),
            state.threats.search.clone(),
        );
        let prev_fingerprint: Option<(usize, usize, usize, usize, Option<String>, String)> =
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

            let search_lower = state.threats.search.to_lowercase();
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
            "RECHERCHER (PROCESSUS, RÉSEAU, USB, FICHIER)...",
        )
        .chip("PROCESSUS", proc_active, theme::ERROR)
        .chip("RÉSEAU", net_active, theme::SEVERITY_HIGH)
        .chip("USB", usb_active, theme::WARNING)
        .chip("FIM", fim_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("process"),
                1 => Some("network"),
                2 => Some("usb"),
                3 => Some("fim"),
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
                    .extra_letter_spacing(0.5)
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
                for threat in &threats {
                    Self::threat_row(ui, threat);
                    ui.add_space(theme::SPACE_XS);
                }
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ====================================================================
    // Internal helpers
    // ====================================================================

    /// Compute a risk score (0-100) that prioritizes critical process threats.
    /// 
    /// Critical processes have the highest weight (40 points each),
    /// followed by unacknowledged FIM alerts (15 points each),
    /// then USB events (5 points each), then regular suspicious processes (10 points each).
    fn compute_risk_score(
        state: &AppState,
        processes: usize,
        usb: usize,
        fim_unack: usize,
        network_alerts: usize,
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

        // Weighted formula with critical event prioritization
        let raw = (critical_processes as u32)
            .saturating_mul(40) // Critical processes: highest weight
            .saturating_add((critical_net as u32).saturating_mul(35)) // Critical network alerts
            .saturating_add((regular_processes as u32).saturating_mul(10)) // Regular processes
            .saturating_add((regular_net as u32).saturating_mul(12)) // Regular network alerts
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
        for p in &state.threats.suspicious_processes {
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
            });
        }

        // USB events
        for u in &state.threats.usb_events {
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
            });
        }

        // FIM alerts
        for f in &state.fim.alerts {
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
            });
        }

        // Network security alerts
        for alert in &state.network.alerts {
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

    /// Render a single threat row with left severity accent bar.
    fn threat_row(ui: &mut Ui, threat: &ThreatEvent) {
        let (sev_icon, sev_color) = Self::severity_display(threat.severity);
        let (kind_label, kind_color) = Self::kind_badge(threat.kind);

        let accent_bar_width = 3.0_f32;
        let frame_resp = egui::Frame::new()
            .fill(theme::bg_elevated().linear_multiply(theme::OPACITY_MEDIUM))
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
                    // Severity icon
                    ui.label(
                        egui::RichText::new(sev_icon)
                            .size(theme::ICON_MD)
                            .color(sev_color),
                    );

                    ui.add_space(theme::SPACE_SM);

                    // Event type badge
                    widgets::status_badge(ui, kind_label, kind_color);

                    ui.add_space(theme::SPACE_SM);

                    // Title + description + command line
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

                    // Right side: timestamp + optional confidence
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            // Timestamp
                            ui.label(
                                egui::RichText::new(format!(
                                    "{}  {}",
                                    icons::CLOCK,
                                    threat.timestamp.format("%d/%m/%Y %H:%M"),
                                ))
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                            );

                            // Confidence badge (process events only)
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

        // Paint severity accent bar on the left edge
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

                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        let value_color = if response.hovered() {
                            color
                        } else {
                            color.linear_multiply(theme::OPACITY_STRONG)
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
                                .extra_letter_spacing(0.5)
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
                                    .color(color.linear_multiply(icon_alpha)),
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
                        .color(theme::SUCCESS),
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
                                    .color(theme::SUCCESS.linear_multiply(pulse_alpha)),
                            );
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("EN DIRECT")
                                    .font(theme::font_label())
                                    .color(
                                        theme::SUCCESS
                                            .linear_multiply(theme::OPACITY_HOVER_SOFT),
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
            let sectors: [(&str, f32, egui::Align2); 4] = [
                ("PROCESSUS", -TAU / 4.0, egui::Align2::CENTER_BOTTOM),
                ("USB", 0.0, egui::Align2::LEFT_CENTER),
                ("FIM", TAU / 4.0, egui::Align2::CENTER_TOP),
                ("R\u{00c9}SEAU", TAU / 2.0, egui::Align2::RIGHT_CENTER),
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
                    "usb" => 0.0,
                    "fim" => TAU / 4.0,
                    "network" => TAU / 2.0,
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
                egui::Color32::WHITE.linear_multiply(theme::OPACITY_MODERATE),
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
                    ui.add_space(2.0);
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
