//! Threats page -- consolidated security threats and events.

use chrono::{DateTime, Utc};
use egui::Ui;

use crate::app::AppState;
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
        widgets::page_header(
            ui,
            "Menaces",
            Some(
                "Vue consolid\u{00e9}e des menaces et \u{00e9}v\u{00e9}nements de s\u{00e9}curit\u{00e9}",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary counts ──────────────────────────────────────────────
        let process_count = state.suspicious_processes.len();
        let usb_count = state.usb_events.len();
        let fim_unack_count = state.fim_alerts.iter().filter(|a| !a.acknowledged).count();
        let risk_score = Self::compute_risk_score(process_count, usb_count, fim_unack_count);

        // 4-card summary row
        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 3.0) / 4.0;
        ui.horizontal(|ui| {
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
                "\u{00c9}V\u{00c9}NEMENTS USB",
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

        // ── Search / filter bar ─────────────────────────────────────────
        let proc_active = state.threats_filter.as_deref() == Some("process");
        let usb_active = state.threats_filter.as_deref() == Some("usb");
        let fim_active = state.threats_filter.as_deref() == Some("fim");

        // Build consolidated threat list
        let mut threats = Self::build_threat_list(state);

        // Apply filter
        if let Some(ref filter) = state.threats_filter {
            threats.retain(|t| t.kind == filter.as_str());
        }

        // Apply search
        let search_lower = state.threats_search.to_lowercase();
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
            &mut state.threats_search,
            "Rechercher (processus, fichier, p\u{00e9}riph\u{00e9}rique)...",
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
            if state.threats_filter.as_deref() == target {
                state.threats_filter = None;
            } else {
                state.threats_filter = target.map(|s| s.to_string());
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Action bar: Scan & Export
        ui.horizontal(|ui| {
            if widgets::button::primary_button(ui, format!("{}  Lancer le scan", icons::PLAY))
                .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  Export CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_threats_csv(&threats);
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        // ── Threat feed ─────────────────────────────────────────────────
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("FIL DE MENACES")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if threats.is_empty() {
                widgets::protected_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "Aucune menace d\u{00e9}tect\u{00e9}e",
                    "Le syst\u{00e8}me ne pr\u{00e9}sente aucun \u{00e9}v\u{00e9}nement de s\u{00e9}curit\u{00e9} suspect.",
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
        let raw = (processes as u32) * 25 + (fim_unack as u32) * 15 + (usb as u32) * 5;
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
        for p in &state.suspicious_processes {
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
        for u in &state.usb_events {
            let severity = match u.event_type.as_str() {
                "connected" => "medium",
                "disconnected" => "low",
                _ => "low",
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
        for f in &state.fim_alerts {
            let severity = match f.change_type.as_str() {
                "deleted" | "permission_changed" => "high",
                "created" => "medium",
                "modified" => "medium",
                "renamed" => "low",
                _ => "low",
            };
            events.push(ThreatEvent {
                kind: "fim",
                severity,
                title: f.path.clone(),
                description: format!(
                    "Changement d\u{00e9}tect\u{00e9} : {}{}",
                    Self::change_type_label(&f.change_type),
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
    fn change_type_label(change_type: &str) -> &'static str {
        match change_type {
            "created" => "cr\u{00e9}ation",
            "modified" => "modification",
            "deleted" => "suppression",
            "permission_changed" => "permissions modifi\u{00e9}es",
            "renamed" => "renommage",
            _ => "inconnu",
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
            .fill(theme::bg_elevated())
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(12))
            .stroke(egui::Stroke::new(0.5, theme::border()))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // Severity icon
                    ui.label(egui::RichText::new(sev_icon).size(20.0).color(sev_color));

                    ui.add_space(theme::SPACE_SM);

                    // Event type badge
                    widgets::status_badge(ui, kind_label, kind_color);

                    ui.add_space(theme::SPACE_SM);

                    // Title + description
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new(&threat.title)
                                .font(theme::font_body())
                                .color(theme::text_primary())
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(&threat.description)
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                    });

                    // Right side: timestamp + optional confidence
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Timestamp
                        ui.label(
                            egui::RichText::new(format!(
                                "{}  {}",
                                icons::CLOCK,
                                threat.timestamp.format("%d/%m/%Y %H:%M"),
                            ))
                            .font(theme::font_small())
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
                    });
                });
            });
    }

    /// Draw a summary card (same pattern as other pages).
    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new(value).size(24.0).color(color).strong());
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }

    fn export_threats_csv(threats: &[ThreatEvent]) {
        let headers = &["kind", "severity", "title", "description", "timestamp", "confidence"];
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
