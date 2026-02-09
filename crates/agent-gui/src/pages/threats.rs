//! Threats page -- consolidated security threats and events.

use chrono::{DateTime, Utc};
use egui::Ui;

use crate::app::AppState;
use crate::dto::{FimChangeType, GuiAgentStatus, UsbEventType};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

// ============================================================================
// Unified threat event (used only internally for merging & sorting)
// ============================================================================

/// A unified representation of any security threat, regardless of source.
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
        let risk_score = Self::compute_risk_score(process_count, usb_count, fim_unack_count);

        let card_gap = theme::SPACE_SM;
        let card_w = ((ui.available_width() - card_gap * 3.0) / 4.0).max(0.0);
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(
                ui,
                card_w,
                "PROCESSUS SUSPECTS",
                &process_count.to_string(),
                if process_count > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::BUG,
            );
            Self::summary_card(
                ui,
                card_w,
                "ÉVÉNEMENTS USB",
                &usb_count.to_string(),
                if usb_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::PLUG,
            );
            Self::summary_card(
                ui,
                card_w,
                "ALERTES FIM",
                &fim_unack_count.to_string(),
                if fim_unack_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::EYE,
            );
            Self::summary_card(
                ui,
                card_w,
                "SCORE DE RISQUE",
                &risk_score.to_string(),
                Self::risk_score_color(risk_score),
                icons::BOLT,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // ── Search / filter bar (AAA Grade) ─────────────────────────────
        let proc_active = state.threats.filter.as_deref() == Some("process");
        let usb_active = state.threats.filter.as_deref() == Some("usb");
        let fim_active = state.threats.filter.as_deref() == Some("fim");

        // PERF: threat list rebuilt every frame — consider caching with dirty tracking
        let mut threats = Self::build_threat_list(state);

        // Apply filter
        if let Some(ref filter) = state.threats.filter {
            threats.retain(|t| t.kind == filter.as_str());
        }

        // Apply search
        let search_lower = state.threats.search.to_lowercase();
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

        // Sort by timestamp (most recent first)
        threats.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let result_count = threats.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.threats.search,
            "RECHERCHER (PROCESSUS, FICHIER, PÉRIPHÉRIQUE)...",
        )
        .chip("PROCESSUS", proc_active, theme::ERROR)
        .chip("USB", usb_active, theme::WARNING)
        .chip("FIM", fim_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("process"),
                1 => Some("usb"),
                2 => Some("fim"),
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
                        Self::export_threats_csv(&threats);
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

    /// Compute a simple risk score (0-100) based on event counts.
    fn compute_risk_score(processes: usize, usb: usize, fim_unack: usize) -> u32 {
        // Weighted formula: suspicious processes are highest risk,
        // then unacknowledged FIM alerts, then USB events.
        let raw = (processes as u32)
            .saturating_mul(25)
            .saturating_add((fim_unack as u32).saturating_mul(15))
            .saturating_add((usb as u32).saturating_mul(5));
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
            _ => (icons::SEVERITY_LOW, theme::text_tertiary()),
        }
    }

    /// French badge label for a threat kind.
    fn kind_badge(kind: &str) -> (&'static str, egui::Color32) {
        match kind {
            "process" => ("PROCESSUS", theme::ERROR),
            "usb" => ("USB", theme::WARNING),
            "fim" => ("FIM", theme::INFO),
            _ => ("AUTRE", theme::text_tertiary()),
        }
    }

    /// Render a single threat row inside the threat feed card.
    fn threat_row(ui: &mut Ui, threat: &ThreatEvent) {
        let (sev_icon, sev_color) = Self::severity_display(threat.severity);
        let (kind_label, kind_color) = Self::kind_badge(threat.kind);

        egui::Frame::new()
            .fill(theme::bg_elevated().linear_multiply(0.5)) // Glassy feel
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(12))
            .stroke(egui::Stroke::new(0.5, theme::border()))
            .show(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    // Severity icon
                    ui.label(egui::RichText::new(sev_icon).size(20.0).color(sev_color));

                    ui.add_space(theme::SPACE_SM);

                    // Event type badge
                    widgets::status_badge(ui, kind_label, kind_color);

                    ui.add_space(theme::SPACE_SM);

                    // Title + description
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
                            color.linear_multiply(0.85)
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
                            let icon_alpha = if response.hovered() { 0.5 } else { 0.25 };
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(28.0)
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
                        rect.left() + 10.0..=rect.right() - 10.0,
                        line_y,
                        egui::Stroke::new(2.5, color),
                    );

                    // Outer glow
                    ui.painter().hline(
                        rect.left() + 5.0..=rect.right() - 5.0,
                        line_y,
                        egui::Stroke::new(4.0, color.linear_multiply(0.15)),
                    );

                    ui.ctx().request_repaint();
                }
            });
        });
    }

    fn render_threat_radar(ui: &mut Ui, threats: &[ThreatEvent]) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("RADAR DE DÉTECTION (TEMPS RÉEL)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let available_w = ui.available_width();
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(available_w, 280.0), egui::Sense::hover());
            let painter = ui.painter_at(rect);
            let center = rect.center();
            let radius = 120.0;

            // Draw radar background (concentric circles)
            let grid_color = theme::border().linear_multiply(0.3);
            for i in 1..=4 {
                painter.circle_stroke(
                    center,
                    radius * (i as f32 / 4.0),
                    egui::Stroke::new(0.5, grid_color),
                );
            }

            // Crosshair
            painter.line_segment(
                [
                    egui::pos2(center.x - radius, center.y),
                    egui::pos2(center.x + radius, center.y),
                ],
                egui::Stroke::new(0.5, grid_color),
            );
            painter.line_segment(
                [
                    egui::pos2(center.x, center.y - radius),
                    egui::pos2(center.x, center.y + radius),
                ],
                egui::Stroke::new(0.5, grid_color),
            );

            // Sweeping line animation
            let time = ui.input(|i| i.time);
            let angle = (time * 1.5) as f32 % std::f32::consts::TAU;
            let sweep_pos = center + egui::vec2(angle.cos(), angle.sin()) * radius;

            // Sweep trail (subtle arc)
            painter.line_segment(
                [center, sweep_pos],
                egui::Stroke::new(1.5, theme::SUCCESS.linear_multiply(0.6)),
            );

            // Draw threats as blips
            for (i, threat) in threats.iter().enumerate() {
                // Pseudo-random position based on title hash for stability
                let mut hasher = std::collections::hash_map::DefaultHasher::new();
                use std::hash::{Hash, Hasher};
                threat.title.hash(&mut hasher);
                let seed = hasher.finish();

                let t_angle = (seed % 360) as f32 * (std::f32::consts::PI / 180.0);
                let t_dist = ((seed >> 8) % 100) as f32 / 100.0 * radius;
                let blip_pos = center + egui::vec2(t_angle.cos(), t_angle.sin()) * t_dist;

                let color = match threat.severity {
                    "critical" => theme::ERROR,
                    "high" => theme::SEVERITY_HIGH,
                    "medium" => theme::WARNING,
                    _ => theme::INFO,
                };

                // Interaction: sweep proximity
                let diff_angle = (angle - t_angle).abs();
                let is_near_sweep = diff_angle < 0.2 || diff_angle > (std::f32::consts::TAU - 0.2);

                let pulse = if is_near_sweep {
                    1.0
                } else {
                    ((time * 2.0 + (i as f64 * 0.5)).sin() * 0.5 + 0.5) as f32
                };

                // Glow
                painter.circle_filled(
                    blip_pos,
                    4.0 + pulse * 4.0,
                    color.linear_multiply(0.1 + pulse * 0.2),
                );
                // Core
                painter.circle_filled(blip_pos, 3.0, color);

                // Label if near sweep or hovered
                if is_near_sweep {
                    painter.text(
                        blip_pos + egui::vec2(8.0, -8.0),
                        egui::Align2::LEFT_BOTTOM,
                        &threat.title,
                        theme::font_min(),
                        theme::text_primary(),
                    );
                }
            }

            ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
        });
    }

    fn export_threats_csv(threats: &[ThreatEvent]) {
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
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}
