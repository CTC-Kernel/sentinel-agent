// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR overview tab — summary cards, severity distribution, radar, and threat feed.

use std::collections::hash_map::DefaultHasher;
use std::f32::consts::TAU;
use std::hash::{Hash, Hasher};

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, Severity, UsbEventType};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::pagination::PaginationState;

use super::types::{
    self, ThreatEvent, build_threat_list, change_type_label, compute_risk_score, kind_badge,
    network_alert_type_label, risk_score_color, severity_display, system_incident_type_label,
};

/// Render the overview tab content.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command = None;

    // No inner ScrollArea — the parent in app.rs already wraps everything.
    {
        // Build once: the command radar is deliberately the first operational
        // surface on this page and every section below reuses the same snapshot.
        let all_threats = build_threat_list(state);

        // ── Threat command radar — always above metrics and analytics ────────
        render_threat_radar(ui, &all_threats);
        ui.add_space(theme::SPACE_LG);

        // ── Summary counts (AAA Grade) ──────────────────────────────────
        let process_count = state.threats.suspicious_processes.len();
        let usb_count = state.threats.usb_events.len();
        let fim_unack_count = state.fim.alerts.iter().filter(|a| !a.acknowledged).count();
        let network_alert_count = state.network.alerts.len();
        let system_count = state.threats.system_incidents.len();
        let vuln_count = state.vulnerability_findings.len();
        let risk_score = compute_risk_score(
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
                if process_count > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::BUG,
            ),
            (
                "ALERTES RÉSEAU",
                network_alert_count.to_string(),
                if network_alert_count > 0 {
                    theme::SEVERITY_HIGH
                } else {
                    theme::text_tertiary()
                },
                icons::NETWORK,
            ),
            (
                "ÉVÉNEMENTS USB",
                usb_count.to_string(),
                if usb_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::PLUG,
            ),
            (
                "ALERTES FIM",
                fim_unack_count.to_string(),
                if fim_unack_count > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::EYE,
            ),
            (
                "INCIDENTS SYSTÈME",
                system_count.to_string(),
                if system_count > 0 {
                    theme::SEVERITY_HIGH
                } else {
                    theme::text_tertiary()
                },
                icons::SHIELD,
            ),
            (
                "VULNÉRABILITÉS",
                vuln_count.to_string(),
                if vuln_count > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::SHIELD_VIRUS,
            ),
            (
                "SCORE DE RISQUE",
                risk_score.to_string(),
                risk_score_color(risk_score),
                icons::BOLT,
            ),
        ];

        let summary_grid = widgets::ResponsiveGrid::new(180.0, theme::SPACE_SM);
        summary_grid.show(
            ui,
            &summary_items,
            |ui, width, (label, value, color, icon)| {
                summary_card(ui, width, label, value, *color, icon);
            },
        );

        ui.add_space(theme::SPACE_LG);

        // ── Severity distribution bar + Detection coverage ──────────────
        {
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
                    let bar_height = theme::PROGRESS_BAR_HEIGHT + 4.0;
                    let bar_width = ui.available_width();
                    let (rect, _) = ui.allocate_exact_size(
                        egui::vec2(bar_width, bar_height),
                        egui::Sense::hover(),
                    );
                    if ui.is_rect_visible(rect) {
                        let painter = ui.painter_at(rect);
                        let rounding = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
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

                    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                        let items: &[(&str, usize, egui::Color32)] = &[
                            ("Critique", critical_count, theme::ERROR),
                            ("Élevé", high_count, theme::SEVERITY_HIGH),
                            ("Moyen", medium_count, theme::WARNING),
                            ("Faible", low_count, theme::INFO),
                        ];
                        for (label, count, color) in items {
                            widgets::status_badge(ui, &format!("{}: {}", label, count), *color);
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

                // Detection coverage: check each subsystem is active
                let scan_ran = state.summary.last_check_at.is_some();
                let has_process = scan_ran;
                let has_usb = scan_ran;
                let has_fim = state.fim.monitored_count > 0;
                let has_network =
                    !state.network.connections.is_empty() || state.network.interface_count > 0;
                let has_system = scan_ran;
                let has_vuln = state.vulnerability_summary.is_some();

                let active_sources = [
                    has_process,
                    has_usb,
                    has_fim,
                    has_network,
                    has_system,
                    has_vuln,
                ]
                .iter()
                .filter(|&&v| v)
                .count();

                let coverage_color = if active_sources == 6 {
                    theme::SUCCESS
                } else if active_sources >= 4 {
                    theme::WARNING
                } else {
                    theme::ERROR
                };
                ui.label(
                    egui::RichText::new(format!("{}/6 sources actives", active_sources,))
                        .font(theme::font_body())
                        .color(coverage_color)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);

                let sources: &[(&str, &str, bool)] = &[
                    ("Processus", icons::BUG, has_process),
                    ("USB", icons::PLUG, has_usb),
                    ("FIM", icons::FILE_SHIELD, has_fim),
                    ("Réseau", icons::NETWORK, has_network),
                    ("Système", icons::SHIELD, has_system),
                    ("Vulnérabilités", icons::SHIELD_VIRUS, has_vuln),
                ];
                ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                    for (label, icon, active) in sources {
                        let color = if *active {
                            theme::SUCCESS
                        } else {
                            theme::text_tertiary()
                        };
                        ui.label(egui::RichText::new(*icon).size(theme::ICON_SM).color(color));
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

        ui.add_space(theme::SPACE_MD);

        // ── 24h Event Timeline ──────────────────────────────────────────
        super::timeline::event_timeline(ui, &all_threats);

        ui.add_space(theme::SPACE_MD);

        // ── MITRE ATT&CK Coverage Mini-map ──────────────────────────────
        super::mitre::mitre_minimap(ui, &all_threats);

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
        // Hash collection lengths (catches additions/removals that change size).
        state
            .threats
            .suspicious_processes
            .len()
            .hash(&mut fp_hasher);
        state.threats.usb_events.len().hash(&mut fp_hasher);
        state.threats.system_incidents.len().hash(&mut fp_hasher);
        state.fim.alerts.len().hash(&mut fp_hasher);
        state.network.alerts.len().hash(&mut fp_hasher);
        state.vulnerability_findings.len().hash(&mut fp_hasher);
        // Hash front-item identity for each collection — catches push_front/pop_back
        // rotations where length is constant but source_index values become stale.
        if let Some(f) = state.threats.suspicious_processes.front() {
            f.detected_at.timestamp_millis().hash(&mut fp_hasher);
        }
        if let Some(f) = state.threats.usb_events.front() {
            f.timestamp.timestamp_millis().hash(&mut fp_hasher);
        }
        if let Some(f) = state.threats.system_incidents.front() {
            f.detected_at.timestamp_millis().hash(&mut fp_hasher);
        }
        if let Some(f) = state.fim.alerts.front() {
            f.timestamp.timestamp_millis().hash(&mut fp_hasher);
        }
        if let Some(f) = state.network.alerts.front() {
            f.detected_at.timestamp_millis().hash(&mut fp_hasher);
        }
        if let Some(f) = state.vulnerability_findings.first() {
            f.cve_id.hash(&mut fp_hasher);
        }
        state.threats.filter.hash(&mut fp_hasher);
        state.threats.search.hash(&mut fp_hasher);
        let fingerprint: u64 = fp_hasher.finish();
        let prev_fingerprint: Option<u64> = ui.memory(|mem| mem.data.get_temp(cache_id));
        let cached_threats_id = ui.make_persistent_id("threats_cached_list");

        let cache_changed = prev_fingerprint.as_ref() != Some(&fingerprint);
        let threats: Vec<ThreatEvent> = if !cache_changed {
            ui.memory(|mem| mem.data.get_temp(cached_threats_id))
                .unwrap_or_default()
        } else {
            // Reuse the already-built all_threats instead of calling build_threat_list again.
            let mut list = all_threats.clone();

            if let Some(ref filter) = state.threats.filter {
                list.retain(|t| t.kind == filter.as_str());
            }

            let search_lower = state.threats.search.to_lowercase();
            if !search_lower.is_empty() {
                list.retain(|t| {
                    t.title.to_lowercase().contains(&search_lower)
                        || t.description.to_lowercase().contains(&search_lower)
                        || t.kind.contains(&search_lower)
                });
            }

            list.sort_by_key(|b| std::cmp::Reverse(b.timestamp));

            ui.memory_mut(|mem| {
                mem.data.insert_temp(cache_id, fingerprint);
                mem.data.insert_temp(cached_threats_id, list.clone());
            });
            list
        };

        // When the filtered list changes (new data, search, filter), invalidate selection.
        if cache_changed {
            state.threats.selected_threat = None;
            state.threats.detail_open = false;
        }

        let result_count = threats.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.threats.search,
            "Rechercher un processus, une alerte réseau, USB, FIM…",
        )
        .chip("Processus", proc_active, theme::ERROR)
        .chip("Réseau", net_active, theme::SEVERITY_HIGH)
        .chip("USB", usb_active, theme::WARNING)
        .chip("FIM", fim_active, theme::INFO)
        .chip("Système", sys_active, theme::SEVERITY_HIGH)
        .chip("Vulnéra.", vuln_active, theme::ERROR)
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
            // Clear selection when filter changes — indices are no longer valid
            state.threats.selected_threat = None;
            state.threats.detail_open = false;
            state.threats.overview_page = 0;
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
                        "Analyse en cours"
                    } else {
                        "Lancer l'analyse"
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
                        let success = types::export_threats_csv(&threats);
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

        // ── Threat feed (AAA Grade) with pagination ─────────────────────
        let feed_page_size: usize = 25;
        let feed_total = threats.len();
        let feed_total_pages = feed_total.div_ceil(feed_page_size).max(1);
        if state.threats.overview_page >= feed_total_pages {
            state.threats.overview_page = feed_total_pages.saturating_sub(1);
        }
        let feed_start = state.threats.overview_page.saturating_mul(feed_page_size);
        let feed_end = feed_total.min(feed_start.saturating_add(feed_page_size));
        let page_threats = &threats[feed_start..feed_end];

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
                    "Aucune menace identifiée",
                    "Le système ne présente aucun événement de sécurité suspect à ce jour.",
                );
            } else {
                for (local_idx, threat) in page_threats.iter().enumerate() {
                    let global_idx = feed_start.saturating_add(local_idx);
                    if threat_row(ui, threat, global_idx) {
                        state.threats.selected_threat = Some(global_idx);
                        state.threats.detail_open = true;
                    }
                    ui.add_space(theme::SPACE_XS);
                }
            }
        });

        // Threat feed pagination
        if feed_total > feed_page_size {
            ui.add_space(theme::SPACE_MD);
            let mut pag = PaginationState::new(feed_total, feed_page_size);
            pag.current_page = state.threats.overview_page.saturating_add(1);
            if widgets::pagination(ui, &mut pag) {
                state.threats.overview_page = pag.current_page.saturating_sub(1);
            }
        }

        // Handle active drawer selection at the end of scroll area or outside
        ui.add_space(theme::SPACE_XL);

        let ctx = ui.ctx().clone();
        if let Some(sel) = state.threats.selected_threat
            && sel < threats.len()
        {
            let threat = &threats[sel];
            match threat.kind {
                "process" => {
                    if threat.source_index < state.threats.suspicious_processes.len() {
                        let p = &state.threats.suspicious_processes[threat.source_index];
                        let conf_color = if p.confidence >= 90 {
                            theme::ERROR
                        } else if p.confidence >= 70 {
                            theme::SEVERITY_HIGH
                        } else if p.confidence >= 40 {
                            theme::WARNING
                        } else {
                            theme::INFO
                        };
                        let has_ai = p.ai_analysis.is_some();
                        let mut actions = Vec::new();
                        if !has_ai {
                            actions.push(widgets::DetailAction::primary(
                                "Classifier avec l'IA",
                                icons::BRAIN,
                            ));
                        }
                        actions.push(widgets::DetailAction::secondary(
                            "Ignorer",
                            icons::EYE_SLASH,
                        ));
                        actions.push(widgets::DetailAction::primary("Signaler", icons::FLAG));
                        let drawer_action = widgets::DetailDrawer::new(
                            "threat_detail",
                            &p.process_name,
                            icons::BUG,
                        )
                        .accent(conf_color)
                        .subtitle("Processus suspect")
                        .show(
                            &ctx,
                            &mut state.threats.detail_open,
                            |ui| {
                                widgets::detail_section(ui, "INFORMATIONS DU PROCESSUS");
                                widgets::detail_field(ui, "Nom", &p.process_name);
                                widgets::detail_mono(ui, "Ligne de commande", &p.command_line);
                                widgets::detail_text(ui, "Raison de d\u{00e9}tection", &p.reason);
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}\u{202f}%", p.confidence),
                                    theme::readable_color(conf_color),
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &p.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                                );

                                // AI Analysis section
                                if let Some(ref analysis) = p.ai_analysis {
                                    widgets::detail_section(ui, "ANALYSE IA");
                                    if let Some(confidence) = p.ai_confidence {
                                        let c = if confidence >= 80 {
                                            theme::SUCCESS
                                        } else if confidence >= 50 {
                                            theme::WARNING
                                        } else {
                                            theme::ERROR
                                        };
                                        widgets::detail_field_badge(
                                            ui,
                                            "Confiance IA",
                                            &format!("{}\u{202f}%", confidence),
                                            c,
                                        );
                                    }
                                    if let Some(fp) = p.is_false_positive {
                                        widgets::detail_field_badge(
                                            ui,
                                            "Faux positif",
                                            if fp { "OUI" } else { "NON" },
                                            if fp { theme::WARNING } else { theme::SUCCESS },
                                        );
                                    }
                                    widgets::detail_text(ui, "Analyse", analysis);
                                }
                            },
                            &actions,
                        );
                        if let Some(action_idx) = drawer_action {
                            let time = ctx.input(|i| i.time);
                            let mut next = 0_usize;
                            let ai_idx = if !has_ai {
                                let i = next;
                                next += 1;
                                Some(i)
                            } else {
                                None
                            };
                            let ignore_idx = next;
                            let report_idx = next + 1;
                            if ai_idx == Some(action_idx) {
                                let desc = format!(
                                    "Processus suspect: {} — Commande: {} — Raison: {}",
                                    p.process_name, p.command_line, p.reason,
                                );
                                command = Some(GuiCommand::LlmClassifyThreat {
                                    event_description: desc,
                                    target_id: format!("process#{}", threat.source_index),
                                });
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "Analyse IA en cours\u{2026}",
                                    )
                                    .with_time(time),
                                );
                            } else if action_idx == ignore_idx {
                                state.threats.detail_open = false;
                                state.threats.selected_threat = None;
                            } else if action_idx == report_idx {
                                let details = format!(
                                    "Processus: {}\nCommande: {}\nRaison: {}\nConfiance: {}\u{202f}%",
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
                            UsbEventType::Blocked => theme::ERROR,
                        };
                        let actions = [
                            widgets::DetailAction::primary("Autoriser", icons::CHECK),
                            widgets::DetailAction::danger("Bloquer", icons::LOCK),
                        ];
                        let drawer_action =
                            widgets::DetailDrawer::new("threat_detail", &u.device_name, icons::USB)
                                .accent(ev_color)
                                .subtitle("\u{00c9}v\u{00e9}nement USB")
                                .show(
                                    &ctx,
                                    &mut state.threats.detail_open,
                                    |ui| {
                                        widgets::detail_section(ui, "\u{00c9}V\u{00c9}NEMENT USB");
                                        widgets::detail_field(
                                            ui,
                                            "P\u{00e9}riph\u{00e9}rique",
                                            &u.device_name,
                                        );
                                        widgets::detail_field(
                                            ui,
                                            "Vendor ID",
                                            &format!("0x{:04X}", u.vendor_id),
                                        );
                                        widgets::detail_field(
                                            ui,
                                            "Product ID",
                                            &format!("0x{:04X}", u.product_id),
                                        );
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
                                    },
                                    &actions,
                                );
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
                        let has_ai = inc.ai_analysis.is_some();
                        let mut actions = Vec::new();
                        if !has_ai {
                            actions.push(widgets::DetailAction::primary(
                                "Classifier avec l'IA",
                                icons::BRAIN,
                            ));
                        }
                        actions.push(widgets::DetailAction::secondary("Acquitter", icons::CHECK));
                        actions.push(widgets::DetailAction::primary("Signaler", icons::FLAG));
                        let drawer_action =
                            widgets::DetailDrawer::new("threat_detail", &inc.title, icons::SHIELD)
                                .accent(sev_color)
                                .subtitle("Incident syst\u{00e8}me")
                                .show(
                                    &ctx,
                                    &mut state.threats.detail_open,
                                    |ui| {
                                        widgets::detail_section(ui, "INCIDENT SYST\u{00c8}ME");
                                        widgets::detail_field(
                                            ui,
                                            "Type",
                                            system_incident_type_label(&inc.incident_type),
                                        );
                                        widgets::detail_text(ui, "Description", &inc.description);
                                        widgets::detail_field_colored(
                                            ui,
                                            "Confiance",
                                            &format!("{}\u{202f}%", inc.confidence),
                                            theme::readable_color(sev_color),
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
                                            &inc.detected_at
                                                .format("%d/%m/%Y %H:%M:%S")
                                                .to_string(),
                                        );

                                        // AI Analysis section
                                        if let Some(ref analysis) = inc.ai_analysis {
                                            widgets::detail_section(ui, "ANALYSE IA");
                                            if let Some(confidence) = inc.ai_confidence {
                                                let c = if confidence >= 80 {
                                                    theme::SUCCESS
                                                } else if confidence >= 50 {
                                                    theme::WARNING
                                                } else {
                                                    theme::ERROR
                                                };
                                                widgets::detail_field_badge(
                                                    ui,
                                                    "Confiance IA",
                                                    &format!("{}\u{202f}%", confidence),
                                                    c,
                                                );
                                            }
                                            if let Some(fp) = inc.is_false_positive {
                                                widgets::detail_field_badge(
                                                    ui,
                                                    "Faux positif",
                                                    if fp { "OUI" } else { "NON" },
                                                    if fp {
                                                        theme::WARNING
                                                    } else {
                                                        theme::SUCCESS
                                                    },
                                                );
                                            }
                                            widgets::detail_text(ui, "Analyse", analysis);
                                        }
                                    },
                                    &actions,
                                );
                        if let Some(action_idx) = drawer_action {
                            let time = ctx.input(|i| i.time);
                            let mut next = 0_usize;
                            let ai_idx = if !has_ai {
                                let i = next;
                                next += 1;
                                Some(i)
                            } else {
                                None
                            };
                            let ack_idx = next;
                            let report_idx = next + 1;
                            if ai_idx == Some(action_idx) {
                                let desc = format!(
                                    "Incident système: {} — Type: {} — Description: {}",
                                    inc.title, inc.incident_type, inc.description,
                                );
                                command = Some(GuiCommand::LlmClassifyThreat {
                                    event_description: desc,
                                    target_id: format!("incident#{}", threat.source_index),
                                });
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "Analyse IA en cours\u{2026}",
                                    )
                                    .with_time(time),
                                );
                            } else if action_idx == ack_idx {
                                state.threats.detail_open = false;
                                state.threats.selected_threat = None;
                                state.toasts.push(
                                    crate::widgets::toast::Toast::success(
                                        "Incident acquitt\u{00e9}",
                                    )
                                    .with_time(time),
                                );
                            } else if action_idx == report_idx {
                                let details = format!(
                                    "Incident: {}\nType: {}\nDescription: {}\nConfiance: {}\u{202f}%",
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
                        let actions = [widgets::DetailAction::primary(
                            "Voir d\u{00e9}tails",
                            icons::EYE,
                        )];
                        let drawer_title = format!("{} \u{2014} {}", v.cve_id, v.affected_software);
                        let drawer_action = widgets::DetailDrawer::new(
                            "threat_detail",
                            &drawer_title,
                            icons::SHIELD_VIRUS,
                        )
                        .accent(sev_color)
                        .subtitle("Vuln\u{00e9}rabilit\u{00e9}")
                        .show(
                            &ctx,
                            &mut state.threats.detail_open,
                            |ui| {
                                widgets::detail_section(ui, "VULN\u{00c9}RABILIT\u{00c9}");
                                widgets::detail_field(ui, "CVE", &v.cve_id);
                                widgets::detail_field(ui, "Logiciel", &v.affected_software);
                                widgets::detail_field(ui, "Version", &v.affected_version);
                                if let Some(cvss) = v.cvss_score {
                                    widgets::detail_field_colored(
                                        ui,
                                        "Score CVSS",
                                        &crate::format::decimal(cvss, 1),
                                        theme::readable_color(sev_color),
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
                            },
                            &actions,
                        );
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
                        let actions = [widgets::DetailAction::secondary(
                            "Copier le chemin",
                            icons::COPY,
                        )];
                        let drawer_action =
                            widgets::DetailDrawer::new("threat_detail", &f.path, icons::FILE)
                                .accent(sev_color)
                                .subtitle("Alerte d'int\u{00e9}grit\u{00e9}")
                                .show(
                                    &ctx,
                                    &mut state.threats.detail_open,
                                    |ui| {
                                        widgets::detail_section(ui, "ALERTE FIM");
                                        widgets::detail_mono(ui, "Chemin", &f.path);
                                        widgets::detail_field(
                                            ui,
                                            "Type de changement",
                                            change_type_label(f.change_type),
                                        );
                                        if let Some(ref old) = f.old_hash {
                                            widgets::detail_mono(
                                                ui,
                                                "Hash pr\u{00e9}c\u{00e9}dent",
                                                old,
                                            );
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
                                            if f.acknowledged {
                                                "Acquitt\u{00e9}"
                                            } else {
                                                "Non acquitt\u{00e9}"
                                            },
                                            if f.acknowledged {
                                                theme::SUCCESS
                                            } else {
                                                sev_color
                                            },
                                        );
                                    },
                                    &actions,
                                );
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
                        let has_ai = a.ai_analysis.is_some();
                        let mut actions = Vec::new();
                        if !has_ai {
                            actions.push(widgets::DetailAction::primary(
                                "\u{00c9}valuer avec l'IA",
                                icons::BRAIN,
                            ));
                        }
                        actions.push(widgets::DetailAction::secondary(
                            "Copier les d\u{00e9}tails",
                            icons::COPY,
                        ));
                        let alert_label = network_alert_type_label(&a.alert_type);
                        let drawer_action =
                            widgets::DetailDrawer::new("threat_detail", &alert_label, icons::WIFI)
                                .accent(sev_color)
                                .subtitle("Alerte r\u{00e9}seau")
                                .show(
                                    &ctx,
                                    &mut state.threats.detail_open,
                                    |ui| {
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
                                            widgets::detail_field(
                                                ui,
                                                "Port destination",
                                                &port.to_string(),
                                            );
                                        }
                                        widgets::detail_field_colored(
                                            ui,
                                            "Confiance",
                                            &format!("{}\u{202f}%", a.confidence),
                                            theme::readable_color(sev_color),
                                        );
                                        widgets::detail_field(
                                            ui,
                                            "Date de d\u{00e9}tection",
                                            &a.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                                        );

                                        // AI Analysis section
                                        if let Some(ref analysis) = a.ai_analysis {
                                            widgets::detail_section(ui, "ANALYSE IA");
                                            if let Some(confidence) = a.ai_confidence {
                                                let c = if confidence >= 80 {
                                                    theme::SUCCESS
                                                } else if confidence >= 50 {
                                                    theme::WARNING
                                                } else {
                                                    theme::ERROR
                                                };
                                                widgets::detail_field_badge(
                                                    ui,
                                                    "Confiance IA",
                                                    &format!("{}\u{202f}%", confidence),
                                                    c,
                                                );
                                            }
                                            if let Some(fp) = a.is_false_positive {
                                                widgets::detail_field_badge(
                                                    ui,
                                                    "Faux positif",
                                                    if fp { "OUI" } else { "NON" },
                                                    if fp {
                                                        theme::WARNING
                                                    } else {
                                                        theme::SUCCESS
                                                    },
                                                );
                                            }
                                            widgets::detail_text(ui, "Analyse", analysis);
                                        }
                                    },
                                    &actions,
                                );
                        if let Some(action_idx) = drawer_action {
                            let time = ctx.input(|i| i.time);
                            let mut next = 0_usize;
                            let ai_idx = if !has_ai {
                                let i = next;
                                next += 1;
                                Some(i)
                            } else {
                                None
                            };
                            let copy_idx = next;
                            if ai_idx == Some(action_idx) {
                                let desc = format!(
                                    "Alerte réseau: {} — {} — Source: {} — Destination: {}:{}",
                                    alert_label,
                                    a.description,
                                    a.source_ip.as_deref().unwrap_or("--"),
                                    a.destination_ip.as_deref().unwrap_or("--"),
                                    a.destination_port
                                        .map(|p| p.to_string())
                                        .unwrap_or_else(|| "--".to_string()),
                                );
                                command = Some(GuiCommand::LlmClassifyThreat {
                                    event_description: desc,
                                    target_id: format!("alert#{}", threat.source_index),
                                });
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "Analyse IA en cours\u{2026}",
                                    )
                                    .with_time(time),
                                );
                            } else if action_idx == copy_idx {
                                let details = format!(
                                    "Type: {}\nDescription: {}\nSource: {}\nDestination: {}:{}\nConfiance: {}\u{202f}%",
                                    alert_label,
                                    a.description,
                                    a.source_ip.as_deref().unwrap_or("--"),
                                    a.destination_ip.as_deref().unwrap_or("--"),
                                    a.destination_port
                                        .map(|p| p.to_string())
                                        .unwrap_or_else(|| "--".to_string()),
                                    a.confidence,
                                );
                                ctx.copy_text(details);
                                state.toasts.push(
                                    crate::widgets::toast::Toast::info(
                                        "D\u{00e9}tails copi\u{00e9}s dans le presse-papiers",
                                    )
                                    .with_time(time),
                                );
                            }
                        }
                    }
                }
                _ => {
                    state.threats.detail_open = false;
                    state.threats.selected_threat = None;
                }
            }
        }
    }

    command
}

// ====================================================================
// Internal rendering helpers
// ====================================================================

fn threat_row(ui: &mut Ui, threat: &ThreatEvent, idx: usize) -> bool {
    let (sev_icon, sev_color) = severity_display(threat.severity);
    let (kind_label, kind_color) = kind_badge(threat.kind);

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

                // Reserve space for right-aligned elements (~200px)
                let text_max_w = (ui.available_width() - 200.0).max(120.0);
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_max_width(text_max_w);
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
                        // Truncate long command lines to prevent overflow
                        let display_cmd: String = if cmd.chars().count() > 80 {
                            let truncated: String = cmd.chars().take(77).collect();
                            format!("{}…", truncated)
                        } else {
                            cmd.clone()
                        };
                        ui.label(
                            egui::RichText::new(display_cmd)
                                .font(theme::font_mono())
                                .color(theme::text_tertiary()),
                        )
                        .on_hover_text(cmd);
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
                            widgets::status_badge(ui, &format!("{}\u{202f}%", conf), conf_color);
                        }
                    },
                );
            });
        });

    let rect = frame_resp.response.rect;
    let click_resp = ui.interact(
        rect,
        ui.id().with(("threat_click", idx)),
        egui::Sense::click(),
    );
    if click_resp.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    let clicked = click_resp.clicked();

    let bar_rect =
        egui::Rect::from_min_size(rect.left_top(), egui::vec2(accent_bar_width, rect.height()));
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
            ui.set_min_height(theme::SUMMARY_CARD_MIN_HEIGHT);
            let response = ui.interact(ui.max_rect(), ui.id().with(label), egui::Sense::hover());

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

                ui.painter().hline(
                    rect.left() + theme::CARD_GLOW_INSET..=rect.right() - theme::CARD_GLOW_INSET,
                    line_y,
                    egui::Stroke::new(theme::CARD_GLOW_STROKE, color),
                );

                ui.painter().hline(
                    rect.left() + theme::CARD_GLOW_OUTER_INSET
                        ..=rect.right() - theme::CARD_GLOW_OUTER_INSET,
                    line_y,
                    egui::Stroke::new(
                        theme::CARD_GLOW_OUTER_STROKE,
                        color.linear_multiply(theme::OPACITY_TINT),
                    ),
                );

                ui.ctx().request_repaint();
            }
        });
    });
}

fn render_threat_radar(ui: &mut Ui, threats: &[ThreatEvent]) {
    let reduced = theme::is_reduced_motion();
    let range_id = ui.make_persistent_id("threat_radar_range");
    let paused_id = ui.make_persistent_id("threat_radar_paused");
    let layers_id = ui.make_persistent_id("threat_radar_layers");
    let selected_id = ui.make_persistent_id("threat_radar_selected");
    let mut range: u8 = ui.data(|d| d.get_temp(range_id).unwrap_or(1));
    let mut paused: bool = ui.data(|d| d.get_temp(paused_id).unwrap_or(false));
    let mut layers: u8 = ui.data(|d| d.get_temp(layers_id).unwrap_or(0b11_1111));
    let mut selected: Option<usize> = ui.data(|d| d.get_temp(selected_id));

    let cutoff = chrono::Utc::now()
        - match range {
            0 => chrono::Duration::hours(1),
            2 => chrono::Duration::days(7),
            _ => chrono::Duration::hours(24),
        };
    let kind_bit = |kind: &str| match kind {
        "process" => 0,
        "system" => 1,
        "usb" => 2,
        "fim" => 3,
        "vulnerability" => 4,
        "network" => 5,
        _ => 7,
    };
    let visible: Vec<(usize, &ThreatEvent)> = threats
        .iter()
        .enumerate()
        .filter(|(_, threat)| {
            threat.timestamp >= cutoff && layers & (1 << kind_bit(threat.kind)) != 0
        })
        .collect();
    if selected.is_some_and(|index| !visible.iter().any(|(i, _)| *i == index)) {
        selected = None;
    }

    widgets::card(ui, |ui: &mut egui::Ui| {
        // Command header: range, live state and operator controls are intentionally
        // kept together so the visualization can be managed without leaving it.
        ui.horizontal_wrapped(|ui| {
            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(icons::CROSSHAIRS)
                            .size(theme::ICON_MD)
                            .color(theme::ACCENT_LIGHT),
                    );
                    ui.label(
                        egui::RichText::new("RADAR DE MENACES")
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    let live_color = if paused {
                        theme::WARNING
                    } else {
                        theme::SUCCESS
                    };
                    widgets::status_badge(
                        ui,
                        if paused { "EN PAUSE" } else { "TEMPS RÉEL" },
                        live_color,
                    );
                });
                ui.label(
                    egui::RichText::new("Corrélation multi-source · télémétrie EDR locale")
                        .font(theme::font_caption())
                        .color(theme::text_tertiary()),
                );
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let pause_label = if paused {
                    format!("{}  Reprendre", icons::PLAY)
                } else {
                    format!("{}  Pause", icons::PAUSE)
                };
                if widgets::ghost_button(ui, pause_label)
                    .on_hover_text(if paused {
                        "Relancer le balayage et les animations du radar"
                    } else {
                        "Figer le balayage sans interrompre la collecte"
                    })
                    .clicked()
                {
                    paused = !paused;
                }
                ui.add_space(theme::SPACE_SM);
                for (idx, label) in [(2, "7 j"), (1, "24 h"), (0, "1 h")] {
                    let button = egui::Button::new(
                        egui::RichText::new(label).font(theme::font_label()).color(
                            if range == idx {
                                theme::text_on_accent()
                            } else {
                                theme::text_secondary()
                            },
                        ),
                    )
                    .fill(if range == idx {
                        theme::ACCENT
                    } else {
                        theme::bg_tertiary()
                    })
                    .stroke(egui::Stroke::new(
                        theme::BORDER_HAIRLINE,
                        theme::border_subtle(),
                    ))
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_SM));
                    if ui
                        .add_sized([48.0, 30.0], button)
                        .on_hover_text("Changer la fenêtre temporelle")
                        .clicked()
                    {
                        range = idx;
                        selected = None;
                    }
                }
            });
        });

        ui.add_space(theme::SPACE_MD);
        ui.separator();
        ui.add_space(theme::SPACE_SM);

        // Layer manager. Each chip directly controls a telemetry source.
        ui.horizontal_wrapped(|ui| {
            ui.label(
                egui::RichText::new(format!("{}  COUCHES", icons::FILTER))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            let sources = [
                ("Processus", icons::BUG, 0),
                ("Système", icons::SHIELD, 1),
                ("USB", icons::PLUG, 2),
                ("FIM", icons::FILE_SHIELD, 3),
                ("Vulnérabilités", icons::SHIELD_VIRUS, 4),
                ("Réseau", icons::NETWORK, 5),
            ];
            for (label, icon, bit) in sources {
                let active = layers & (1 << bit) != 0;
                let response = ui.add(
                    egui::Button::new(
                        egui::RichText::new(format!("{icon}  {label}"))
                            .font(theme::font_label())
                            .color(if active {
                                theme::ACCENT_LIGHT
                            } else {
                                theme::text_tertiary()
                            }),
                    )
                    .selected(active),
                );
                if response
                    .on_hover_text(format!(
                        "{} la couche {label}",
                        if active { "Masquer" } else { "Afficher" }
                    ))
                    .clicked()
                {
                    layers ^= 1 << bit;
                    selected = None;
                }
            }
        });
        ui.add_space(theme::SPACE_MD);

        let available_w = ui.available_width();
        let canvas_height = theme::RADAR_HEIGHT.max(360.0);
        let (rect, _) =
            ui.allocate_exact_size(egui::vec2(available_w, canvas_height), egui::Sense::hover());
        let painter = ui.painter_at(rect);
        let center = rect.center();
        let radius = theme::RADAR_RADIUS
            .min(rect.width() * 0.31)
            .min(rect.height() * 0.39);
        let time = ui.input(|i| i.time);

        painter.rect_filled(rect, theme::ROUNDING_MD, theme::bg_deep());
        painter.circle_filled(center, radius + 34.0, theme::ACCENT.linear_multiply(0.035));
        painter.circle_filled(center, radius, theme::bg_secondary().linear_multiply(0.96));

        for i in 1..=4 {
            let r = radius * (i as f32 / 4.0);
            painter.circle_stroke(
                center,
                r,
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::ACCENT.linear_multiply(0.18)),
            );
        }
        for i in 0..12 {
            let angle = (i as f32 / 12.0) * TAU;
            painter.line_segment(
                [
                    center,
                    center + egui::vec2(angle.cos(), angle.sin()) * radius,
                ],
                egui::Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border().linear_multiply(0.24),
                ),
            );
        }

        // Radar range annotations make severity-distance semantics explicit.
        for (label, factor, color) in [
            ("CRITIQUE", 0.24, theme::ERROR),
            ("ÉLEVÉ", 0.48, theme::SEVERITY_HIGH),
            ("MOYEN", 0.70, theme::WARNING),
            ("FAIBLE", 0.91, theme::INFO),
        ] {
            painter.text(
                center + egui::vec2(7.0, -radius * factor),
                egui::Align2::LEFT_CENTER,
                label,
                theme::font_min(),
                color.linear_multiply(0.72),
            );
        }

        let sweep_angle = if reduced || paused {
            0.0
        } else {
            (time * 0.92) as f32 % TAU
        };
        if !reduced && !paused {
            for i in 0..32 {
                let trail = i as f32 / 32.0;
                let angle = sweep_angle - 0.62 * trail;
                painter.line_segment(
                    [
                        center,
                        center + egui::vec2(angle.cos(), angle.sin()) * radius,
                    ],
                    egui::Stroke::new(
                        1.7 - trail,
                        theme::SUCCESS.linear_multiply(0.34 * (1.0 - trail).powi(2)),
                    ),
                );
            }
        }

        let sector_angle = |kind: &str| match kind {
            "process" => -TAU / 4.0,
            "system" => -TAU / 12.0,
            "usb" => TAU / 12.0,
            "fim" => TAU / 4.0,
            "vulnerability" => 5.0 * TAU / 12.0,
            "network" => -5.0 * TAU / 12.0,
            _ => 0.0,
        };
        for (label, kind) in [
            ("PROCESSUS", "process"),
            ("SYSTÈME", "system"),
            ("USB", "usb"),
            ("FIM", "fim"),
            ("VULNÉRABILITÉS", "vulnerability"),
            ("RÉSEAU", "network"),
        ] {
            let angle = sector_angle(kind);
            painter.text(
                center + egui::vec2(angle.cos(), angle.sin()) * (radius + 24.0),
                egui::Align2::CENTER_CENTER,
                label,
                theme::font_min(),
                theme::text_tertiary(),
            );
        }

        for (display_index, (source_index, threat)) in visible.iter().enumerate() {
            let mut hasher = DefaultHasher::new();
            threat.title.hash(&mut hasher);
            threat.timestamp.hash(&mut hasher);
            let seed = hasher.finish();
            let angle =
                sector_angle(threat.kind) + ((seed % 1000) as f32 / 1000.0 - 0.5) * (TAU / 5.2);
            let (min, max) = match threat.severity {
                "critical" => (0.10, 0.29),
                "high" => (0.30, 0.52),
                "medium" => (0.54, 0.74),
                _ => (0.76, 0.93),
            };
            let distance = (min + ((seed >> 8) % 100) as f32 / 100.0 * (max - min)) * radius;
            let position = center + egui::vec2(angle.cos(), angle.sin()) * distance;
            let color = match threat.severity {
                "critical" => theme::ERROR,
                "high" => theme::SEVERITY_HIGH,
                "medium" => theme::WARNING,
                _ => theme::INFO,
            };
            let is_selected = selected == Some(*source_index);
            let pulse = if reduced || paused {
                0.45
            } else {
                ((time * 2.2 + display_index as f64).sin() as f32 + 1.0) * 0.5
            };
            painter.circle_filled(position, 13.0 + pulse * 5.0, color.linear_multiply(0.08));
            painter.circle_stroke(
                position,
                7.0 + pulse * 3.0,
                egui::Stroke::new(1.0, color.linear_multiply(0.55)),
            );
            painter.circle_filled(position, if is_selected { 5.5 } else { 4.0 }, color);
            if is_selected {
                painter.circle_stroke(
                    position,
                    11.0,
                    egui::Stroke::new(2.0, theme::text_primary()),
                );
            }

            let hit = egui::Rect::from_center_size(position, egui::vec2(28.0, 28.0));
            let response = ui.interact(
                hit,
                ui.make_persistent_id(("radar_blip", *source_index)),
                egui::Sense::click(),
            );
            let response = response.on_hover_ui(|ui| {
                ui.set_max_width(theme::TOOLTIP_MAX_WIDTH);
                ui.label(
                    egui::RichText::new(&threat.title)
                        .strong()
                        .color(theme::text_primary()),
                );
                ui.label(egui::RichText::new(severity_display(threat.severity)).color(color));
                ui.label(
                    egui::RichText::new(&threat.description)
                        .font(theme::font_caption())
                        .color(theme::text_secondary()),
                );
                ui.separator();
                ui.label(
                    egui::RichText::new(format!(
                        "Source : {} · {}",
                        threat.kind,
                        threat.timestamp.format("%d/%m %H:%M:%S")
                    ))
                    .font(theme::font_min())
                    .color(theme::text_tertiary()),
                );
                ui.label(
                    egui::RichText::new("Cliquer pour épingler le signal")
                        .font(theme::font_min())
                        .color(theme::ACCENT_LIGHT),
                );
            });
            if response.clicked() {
                selected = if is_selected {
                    None
                } else {
                    Some(*source_index)
                };
            }
        }

        painter.circle_filled(center, 12.0, theme::ACCENT.linear_multiply(0.16));
        painter.circle_filled(center, 5.0, theme::ACCENT);
        painter.text(
            center + egui::vec2(0.0, 22.0),
            egui::Align2::CENTER_TOP,
            "NEXUS",
            theme::font_min(),
            theme::ACCENT_LIGHT,
        );

        // At-a-glance operational telemetry is overlaid without stealing radar space.
        let critical = visible
            .iter()
            .filter(|(_, t)| t.severity == "critical")
            .count();
        let high = visible.iter().filter(|(_, t)| t.severity == "high").count();
        let telemetry = format!(
            "{} SIGNAUX   ·   {} CRITIQUES   ·   {} ÉLEVÉS   ·   6 SOURCES",
            visible.len(),
            critical,
            high
        );
        painter.text(
            rect.left_top() + egui::vec2(16.0, 14.0),
            egui::Align2::LEFT_TOP,
            telemetry,
            theme::font_label(),
            theme::text_secondary(),
        );

        if visible.is_empty() {
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                "Aucun signal sur cette fenêtre",
                theme::font_body(),
                theme::SUCCESS,
            );
        }
        if let Some(index) = selected
            && let Some(threat) = threats.get(index)
        {
            painter.text(
                rect.left_bottom() + egui::vec2(16.0, -14.0),
                egui::Align2::LEFT_BOTTOM,
                format!(
                    "SIGNAL ÉPINGLÉ  ·  {}  ·  {}",
                    severity_display(threat.severity).to_uppercase(),
                    threat.title
                ),
                theme::font_label(),
                theme::text_primary(),
            );
        }

        if !reduced && !paused {
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(40));
        }
    });

    ui.data_mut(|d| {
        d.insert_temp(range_id, range);
        d.insert_temp(paused_id, paused);
        d.insert_temp(layers_id, layers);
        if let Some(index) = selected {
            d.insert_temp(selected_id, index);
        } else {
            d.remove::<usize>(selected_id);
        }
    });
}
