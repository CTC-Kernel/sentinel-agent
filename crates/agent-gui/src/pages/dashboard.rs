// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Dashboard page -- premium AAA overview.

use egui::Ui;

use crate::app::{AppState, Page};
use crate::dto::{GuiAgentStatus, KpiPeriod};
use crate::events::GuiCommand;
use crate::icons;
use crate::llm_panel::{self, LLMPanel};
use crate::theme;
use crate::widgets;

/// Threshold for threat count requiring attention (warning level).
const THREATS_WARNING_THRESHOLD: usize = 3;
/// Threshold for FIM changes per day considered safe (no warning).
const FIM_SAFE_THRESHOLD: u32 = 5;
/// Threshold for network alerts requiring attention (warning level).
const NETWORK_ALERT_WARNING_THRESHOLD: u32 = 2;
/// Software coverage percentage above which is considered good.
const SOFTWARE_COVERAGE_GOOD: f32 = 90.0;
/// Software coverage percentage above which is considered acceptable.
const SOFTWARE_COVERAGE_WARN: f32 = 70.0;
/// AI posture gauge radius in the hero card.
const AI_GAUGE_RADIUS: f32 = 48.0;
/// Maximum recommendations shown on dashboard.
const DASHBOARD_MAX_RECOMMENDATIONS: usize = 3;
/// Minimum card width for bottom grid (recommendations + feed).
const BOTTOM_GRID_MIN_WIDTH: f32 = 340.0;
/// Height of a compact recommendation row.
const COMPACT_REC_ROW_HEIGHT: f32 = 36.0;
/// Maximum items shown in the activity feed widget.
const ACTIVITY_FEED_LIMIT: usize = 5;
/// Sparkline height in the KPI trends section.
const KPI_SPARKLINE_HEIGHT: f32 = 48.0;
/// Mini gauge size in the KPI trends section.
const KPI_GAUGE_SIZE: f32 = 56.0;
/// Seconds per day for KPI period filtering.
const SECS_PER_DAY: i64 = 86_400;
/// Minimum inner height for indicator cards (ensures uniform row height).
/// Inner height of the eight indicator cards. Fixed rather than derived so
/// the grid reads as a grid: the tallest card (a value plus two sub-stats)
/// sets it, and the sparkline cards grow their chart to match.
const INDICATOR_CARD_MIN_HEIGHT: f32 = 136.0;
/// Chart height that fills an indicator card under its header row.
const INDICATOR_CHART_HEIGHT: f32 = INDICATOR_CARD_MIN_HEIGHT - 56.0;
/// Minimum inner height for bottom-row cards (recommendations + feed).
const BOTTOM_CARD_MIN_HEIGHT: f32 = 200.0;
/// Minimum inner height for the AI posture score hero card.
const AI_SCORE_CARD_MIN_HEIGHT: f32 = 220.0;

/// Actions returned by the dashboard page.
pub enum DashboardAction {
    /// Forward a runtime command to the agent.
    Command(GuiCommand),
    /// Navigate to a specific page.
    NavigateTo(Page),
}

pub struct DashboardPage;

fn resource_value(value: f64, observed: bool) -> String {
    if observed && value.is_finite() {
        crate::format::pct(value, 1)
    } else {
        "—".to_owned()
    }
}

fn check_status(state: &AppState) -> (String, egui::Color32) {
    let policy = &state.policy;
    if policy.failing > 0 {
        (
            crate::format::count(policy.failing, "échec"),
            theme::WARNING,
        )
    } else if policy.errors > 0 {
        (crate::format::count(policy.errors, "erreur"), theme::ERROR)
    } else if state.summary.status == GuiAgentStatus::Scanning {
        ("Analyse en cours".to_owned(), theme::INFO)
    } else if policy.pending > 0 {
        (
            format!("{} en attente", crate::format::int(policy.pending)),
            theme::INFO,
        )
    } else if policy.total_policies == 0 {
        ("Évaluation en attente".to_owned(), theme::text_tertiary())
    } else if policy.passing == policy.total_policies {
        ("Tous conformes".to_owned(), theme::SUCCESS)
    } else {
        ("Résultats incomplets".to_owned(), theme::INFO)
    }
}

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<DashboardAction> {
        let mut action: Option<DashboardAction> = None;

        ui.add_space(theme::SPACE_XS);
        let _ = widgets::page_header_nav(
            ui,
            &["Vue d'ensemble", "Tableau de bord"],
            "Tableau de bord",
            Some("Posture de sécurité et de conformité de ce poste, en temps réel."),
            Some(
                "Les indicateurs sont recalcul\u{00e9}s \u{00e0} chaque analyse. Utilisez « Analyser » pour \u{00e9}valuer imm\u{00e9}diatement conformit\u{00e9}, vuln\u{00e9}rabilit\u{00e9}s et menaces.",
            ),
        );

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // ORGANIZATION BANNER (Premium)
        // ══════════════════════════════════════════════════════════════════
        if let Some(cmd) = widgets::org_banner(ui, state) {
            action = Some(DashboardAction::Command(cmd));
        }

        ui.add_space(theme::SPACE_SM);

        // ══════════════════════════════════════════════════════════════════
        // ACTION BAR (inline — Scan, Sync, Export + system status)
        // ══════════════════════════════════════════════════════════════════
        if let Some(cmd) = Self::action_bar(ui, state) {
            action = Some(DashboardAction::Command(cmd));
        }

        ui.add_space(theme::SPACE_SM);

        // Persistent operational pulse: three concise, actionable signals
        // answer “what is protected, what needs attention, and can I act?”
        // before the operator reaches the analytical cards below.
        if let Some(target) = Self::operational_pulse(ui, state) {
            action = Some(DashboardAction::NavigateTo(target));
        }

        ui.add_space(theme::SPACE_LG);

        // ══════════════════════════════════════════════════════════════════
        // SECURITY HERO + AI POSTURE SCORE (Side by side on large screens)
        // ══════════════════════════════════════════════════════════════════
        ui.push_id("hero_grid", |ui| {
            let hero_grid = widgets::ResponsiveGrid::new(400.0, theme::SPACE);
            let hero_items = vec![0, 1];

            hero_grid.show(ui, &hero_items, |ui, width, &idx| {
                // Staggered entry (hero first)
                let alpha =
                    ui.ctx()
                        .animate_value_with_time(ui.id().with(idx), 1.0, theme::ANIM_NORMAL);

                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_opacity(alpha);
                    ui.set_width(width);
                    match idx {
                        0 => {
                            // security_hero uses card() internally — overlay click sense
                            let r = ui.scope(|ui| {
                                widgets::security_hero(ui, state);
                            });
                            let click = ui.interact(
                                r.response.rect,
                                ui.id().with("hero_security_click"),
                                egui::Sense::click(),
                            );
                            click.widget_info(|| {
                                egui::WidgetInfo::labeled(
                                    egui::WidgetType::Button,
                                    ui.is_enabled(),
                                    "Consulter les détails de sécurité",
                                )
                            });
                            if click.hovered() {
                                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                            }
                            if click.clicked() {
                                let target = if !state.threats.suspicious_processes.is_empty()
                                    || !state.threats.usb_events.is_empty()
                                {
                                    Page::Threats
                                } else if state
                                    .vulnerability_summary
                                    .as_ref()
                                    .is_some_and(|v| v.critical > 0 || v.high > 0)
                                {
                                    Page::Vulnerabilities
                                } else {
                                    Page::Compliance
                                };
                                action = Some(DashboardAction::NavigateTo(target));
                            }
                        }
                        _ => {
                            if let Some(act) = Self::ai_posture_score_card(ui, state) {
                                action = Some(act);
                            }
                        }
                    }
                });
            });
        });

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // UNIFIED INDICATORS (8 cards: metrics + security in single grid)
        // ══════════════════════════════════════════════════════════════════
        ui.push_id("indicators_grid", |ui| {
            let grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE);
            let items = vec![0, 1, 2, 3, 4, 5, 6, 7];

            grid.show(ui, &items, |ui, width, &idx| {
                // Staggered entry (delay based on index)
                let delay = 0.1 + (idx as f32 * 0.05);
                let alpha =
                    (ui.ctx()
                        .animate_value_with_time(ui.id().with(idx), 1.0, theme::ANIM_NORMAL)
                        * (1.0 / delay))
                        .min(1.0);

                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_opacity(alpha);
                    ui.set_width(width);
                    let clicked = match idx {
                        0 => Self::cpu_sparkline_card(ui, state),
                        1 => Self::memory_sparkline_card(ui, state),
                        2 => Self::checks_summary_card(ui, state),
                        3 => Self::vulnerabilities_summary_card(ui, state),
                        4 => Self::threats_indicator_card(ui, state),
                        5 => Self::fim_indicator_card(ui, state),
                        6 => Self::network_health_card(ui, state),
                        _ => Self::software_coverage_card(ui, state),
                    };
                    if clicked {
                        let page = match idx {
                            0 | 1 => Page::Monitoring,
                            2 => Page::Compliance,
                            3 => Page::Vulnerabilities,
                            4 => Page::Threats,
                            5 => Page::FileIntegrity,
                            6 => Page::Network,
                            _ => Page::Software,
                        };
                        action = Some(DashboardAction::NavigateTo(page));
                    }
                });
            });
        });

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // KPI TRENDS & KEY INDICATORS
        // ══════════════════════════════════════════════════════════════════
        Self::kpi_trends_card(ui, state);

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // BOTTOM ROW: RECOMMENDATIONS + ACTIVITY FEED (Side by side)
        // ══════════════════════════════════════════════════════════════════
        ui.push_id("bottom_grid", |ui| {
            let bottom_grid = widgets::ResponsiveGrid::new(BOTTOM_GRID_MIN_WIDTH, theme::SPACE);
            let bottom_items = vec![0, 1];

            bottom_grid.show(ui, &bottom_items, |ui, width, &idx| {
                // Staggered entry (delay based on index)
                let delay = 0.3 + (idx as f32 * 0.1);
                let alpha =
                    (ui.ctx()
                        .animate_value_with_time(ui.id().with(idx), 1.0, theme::ANIM_NORMAL)
                        * (1.0 / delay))
                        .min(1.0);

                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_opacity(alpha);
                    ui.set_width(width);
                    match idx {
                        0 => {
                            if let Some(nav) = Self::compact_recommendations_card(ui, state) {
                                action = Some(nav);
                            }
                        }
                        _ => {
                            let clicked = widgets::clickable_card(
                                ui,
                                "activity_feed_click",
                                |ui: &mut egui::Ui| {
                                    ui.set_min_width(ui.available_width());
                                    ui.set_min_height(BOTTOM_CARD_MIN_HEIGHT);
                                    widgets::activity_feed(ui, state, ACTIVITY_FEED_LIMIT);
                                },
                            )
                            .clicked();
                            if clicked {
                                action = Some(DashboardAction::NavigateTo(Page::AuditTrail));
                            }
                        }
                    }
                });
            });
        });

        ui.add_space(theme::SPACE);
        action
    }

    // ──────────────────────────────────────────────────────────────────────
    // ACTION BAR (replaces Command Center — flat inline strip)
    // ──────────────────────────────────────────────────────────────────────
    fn action_bar(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.horizontal(|ui: &mut egui::Ui| {
            // Left: Action buttons
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    icons::PLAY,
                    if is_scanning {
                        "Analyse en cours…"
                    } else {
                        "Analyser"
                    }
                ),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            let is_syncing = state.summary.status == GuiAgentStatus::Syncing;
            if !state.summary.standalone
                && widgets::button::secondary_button_loading(
                    ui,
                    format!(
                        "{}  {}",
                        icons::SYNC,
                        if is_syncing {
                            "Synchronisation…"
                        } else {
                            "Synchroniser"
                        }
                    ),
                    !is_syncing,
                    is_syncing,
                )
                .clicked()
            {
                command = Some(GuiCommand::RunSync);
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::button::secondary_button_loading(
                ui,
                format!("{}  Exporter", icons::DOWNLOAD),
                true,
                false,
            )
            .clicked()
            {
                let success = Self::export_dashboard_csv(state);
                let time = ui.input(|i| i.time);
                if success {
                    state.toasts.push(
                        crate::widgets::toast::Toast::success(
                            "Export CSV du tableau de bord r\u{00e9}ussi",
                        )
                        .with_time(time),
                    );
                } else {
                    state.toasts.push(
                        crate::widgets::toast::Toast::error("\u{00c9}chec de l'export CSV")
                            .with_time(time),
                    );
                }
            }

            // Right: Compact system status
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    // Uptime
                    ui.label(
                        egui::RichText::new(crate::format::duration_short(
                            state.summary.uptime_secs,
                        ))
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                    );
                    ui.label(
                        egui::RichText::new(icons::BOLT)
                            .size(theme::ICON_XS)
                            .color(theme::accent_text()),
                    );

                    ui.add_space(theme::SPACE_MD);

                    // Last scan
                    if let Some(last_check) = state.summary.last_check_at {
                        let elapsed = chrono::Utc::now().signed_duration_since(last_check);
                        let elapsed_text = if elapsed.num_minutes() < 1 {
                            "\u{00e0} l'instant".to_string()
                        } else if elapsed.num_minutes() < 60 {
                            format!("{}{}min", elapsed.num_minutes(), crate::format::THIN_SPACE)
                        } else {
                            format!("{}{}h", elapsed.num_hours(), crate::format::THIN_SPACE)
                        };
                        ui.label(
                            egui::RichText::new(elapsed_text)
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                        );
                        ui.label(
                            egui::RichText::new(icons::CLOCK)
                                .size(theme::ICON_XS)
                                .color(theme::text_tertiary()),
                        );

                        ui.add_space(theme::SPACE_MD);
                    }

                    // Agent status badge
                    let (status_text, status_color) = match state.summary.status {
                        GuiAgentStatus::Connected => ("Op\u{00e9}rationnel", theme::SUCCESS),
                        GuiAgentStatus::Scanning => ("Analyse", theme::INFO),
                        GuiAgentStatus::Syncing => ("Sync", theme::INFO),
                        GuiAgentStatus::Disconnected => {
                            ("D\u{00e9}connect\u{00e9}", theme::WARNING)
                        }
                        GuiAgentStatus::Error => ("Erreur", theme::ERROR),
                        GuiAgentStatus::Standalone => ("Autonome", theme::SUCCESS),
                        _ => ("Attente", theme::text_tertiary()),
                    };
                    widgets::status_badge(ui, status_text, status_color);
                },
            );
        });

        ui.add_space(theme::SPACE_XS);
        widgets::divider_thin(ui);

        command
    }

    /// Compact command-centre rail linking live posture signals to their
    /// operational destinations. The grid folds naturally on narrow windows.
    fn operational_pulse(ui: &mut Ui, state: &AppState) -> Option<Page> {
        let protected = matches!(
            state.summary.status,
            GuiAgentStatus::Connected | GuiAgentStatus::Standalone | GuiAgentStatus::Scanning
        );
        let controls = if state.policy.total_policies == 0 {
            "En attente".to_owned()
        } else {
            format!(
                "{} / {}",
                crate::format::int(state.policy.passing),
                crate::format::int(state.policy.total_policies)
            )
        };
        let exposures = state
            .vulnerability_summary
            .as_ref()
            .map_or(0, |summary| summary.critical + summary.high);
        let exposure_value = if state.vulnerability_summary.is_none() {
            "En attente d’analyse".to_owned()
        } else if exposures == 0 {
            "Aucune critique".to_owned()
        } else {
            crate::format::count(exposures, "priorité")
        };
        let items = [
            (
                Page::Monitoring,
                icons::SHIELD_CHECK,
                "AGENT",
                if protected { "Active" } else { "À vérifier" }.to_owned(),
                if protected {
                    theme::SUCCESS
                } else {
                    theme::WARNING
                },
            ),
            (
                Page::Compliance,
                icons::CLIPBOARD_CHECK,
                "CONTRÔLES",
                controls,
                check_status(state).1,
            ),
            (
                Page::Vulnerabilities,
                icons::CROSSHAIRS,
                "EXPOSITION",
                exposure_value,
                if state.vulnerability_summary.is_none() {
                    theme::text_tertiary()
                } else if exposures == 0 {
                    theme::SUCCESS
                } else {
                    theme::ERROR
                },
            ),
        ];
        let mut selected = None;

        ui.push_id("operational_pulse", |ui| {
            widgets::ResponsiveGrid::new(158.0, theme::SPACE_SM).show(
                ui,
                &items,
                |ui, width, (page, icon, label, value, color)| {
                    ui.set_width(width);
                    let response =
                        widgets::clickable_card(ui, ("pulse", label), |ui: &mut egui::Ui| {
                            ui.set_min_height(44.0);
                            ui.horizontal(|ui| {
                                widgets::icon_tile(ui, icon, *color, 34.0);
                                ui.add_space(theme::SPACE_XS);
                                ui.vertical(|ui| {
                                    ui.label(
                                        egui::RichText::new(*label)
                                            .font(theme::font_micro())
                                            .color(theme::text_tertiary())
                                            .extra_letter_spacing(theme::TRACKING_WIDE),
                                    );
                                    ui.label(
                                        egui::RichText::new(value.as_str())
                                            .font(theme::font_body_strong())
                                            .color(theme::text_primary()),
                                    );
                                });
                            });
                        });
                    response.widget_info(|| {
                        egui::WidgetInfo::labeled(
                            egui::WidgetType::Button,
                            ui.is_enabled(),
                            format!("{label} : {value}"),
                        )
                    });
                    if response.clicked() {
                        selected = Some(page.clone());
                    }
                },
            );
        });

        selected
    }

    // ──────────────────────────────────────────────────────────────────────
    // AI POSTURE SCORE CARD (clickable → AI page)
    // ──────────────────────────────────────────────────────────────────────
    fn ai_posture_score_card(ui: &mut Ui, state: &mut AppState) -> Option<DashboardAction> {
        let ai_score = LLMPanel::compute_ai_score(state);
        let security_state = widgets::determine_security_state(state);
        let risk_label = security_state.title();
        let risk_color = security_state.color();

        let mut nav_action = None;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(AI_SCORE_CARD_MIN_HEIGHT);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("ASSISTANT S\u{00c9}CURIT\u{00c9} IA")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                let mut voice_state = crate::widgets::sentinel_ai_core::VoiceState::Idle;
                if state.ai.is_listening {
                    voice_state =
                        crate::widgets::sentinel_ai_core::VoiceState::Listening(state.ai.mic_level);
                } else if state.ai.is_speaking {
                    voice_state = crate::widgets::sentinel_ai_core::VoiceState::Speaking(0.8); // simulated volume
                }

                // Sentinel AI Core (Jarvis-style) - Make it clickable
                let core_response = widgets::SentinelAICore::new(ai_score)
                    .processing(state.ai.is_processing)
                    .voice(voice_state)
                    .show(ui, AI_GAUGE_RADIUS);

                if core_response.clicked() {
                    nav_action = Some(DashboardAction::NavigateTo(Page::AI));
                }

                ui.add_space(theme::SPACE_SM);

                // Risk badge, centred like the title and the core above it
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    widgets::status_badge(ui, risk_label, risk_color);
                });

                ui.add_space(theme::SPACE_MD);

                // Inline Chat Input
                ui.horizontal(|ui: &mut egui::Ui| {
                    // PREMIUM Voice Toggle
                    if widgets::voice_toggle_button(ui, state.ai.is_listening).clicked() {
                        state.ai.is_listening = !state.ai.is_listening;
                        state.ai.voice_reply_pending = false;
                        // Turn off speaking if we start listening
                        if state.ai.is_listening {
                            state.ai.is_speaking = false;
                        }
                        nav_action =
                            Some(DashboardAction::Command(GuiCommand::SetVoiceListening {
                                enabled: state.ai.is_listening,
                            }));
                    }

                    ui.add_space(theme::SPACE_XS);
                    let chat = widgets::ChatInput::new(
                        &mut state.ai.input_text,
                        "Demander \u{00e0} Jarvis…",
                    )
                    .processing(state.ai.is_processing)
                    .id_salt("dashboard_jarvis_prompt")
                    .show(ui);
                    let can_send = chat.send;

                    if can_send {
                        let prompt = state.ai.input_text.trim().to_string();
                        state.ai.chat_history.push(crate::dto::LlmChatMessage {
                            role: crate::dto::ChatRole::User,
                            content: prompt.clone(),
                            timestamp: chrono::Utc::now(),
                            processing_time_ms: None,
                        });
                        state.ai.input_text.clear();
                        state.ai.is_processing = true;
                        state.ai.active_tab = crate::dto::LlmTab::Assistant;

                        // Force transition
                        #[cfg(feature = "render")]
                        {
                            state.pending_navigation = Some(Page::AI);
                        }
                        nav_action = Some(DashboardAction::Command(GuiCommand::LlmPrompt {
                            prompt,
                            context: None,
                            speak_response: state.ai.voice_conversation_enabled,
                        }));
                        // Dashboard questions participate in the same hands-free
                        // loop as the full assistant: reopen the mic only after
                        // the spoken answer has actually completed.
                        state.ai.voice_reply_pending = state.ai.voice_conversation_enabled;
                    }
                });
            });
        });

        nav_action
    }

    // ──────────────────────────────────────────────────────────────────────
    // COMPACT RECOMMENDATIONS CARD (bottom-left panel)
    // ──────────────────────────────────────────────────────────────────────
    fn compact_recommendations_card(ui: &mut Ui, state: &AppState) -> Option<DashboardAction> {
        let recommendations = LLMPanel::build_recommendations(state);
        let total = recommendations.len();

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(BOTTOM_CARD_MIN_HEIGHT);
            // Section header
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::BRAIN)
                        .size(theme::ICON_XS)
                        .color(theme::accent_text()),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("RECOMMANDATIONS IA")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                if total > 0 {
                    ui.add_space(theme::SPACE_XS);
                    widgets::badge_count(ui, total as u32);
                }
            });

            ui.add_space(theme::SPACE_SM);

            if recommendations.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::INFO,
                    "Aucune recommandation",
                    Some("Aucune action proposée à partir des résultats disponibles."),
                );
            } else {
                // Compact recommendation rows
                for rec in recommendations.iter().take(DASHBOARD_MAX_RECOMMENDATIONS) {
                    Self::compact_recommendation_row(ui, rec);
                    ui.add_space(theme::SPACE_XS);
                }

                // "See all" button
                ui.add_space(theme::SPACE_SM);
                let btn_text = if total > DASHBOARD_MAX_RECOMMENDATIONS {
                    format!(
                        "{}  Voir les {} recommandations {}",
                        icons::BRAIN,
                        total,
                        icons::ARROW_RIGHT
                    )
                } else {
                    format!(
                        "{}  Analyse compl\u{00e8}te {}",
                        icons::BRAIN,
                        icons::ARROW_RIGHT
                    )
                };
                if widgets::ghost_button(ui, btn_text).clicked() {
                    // Cannot return from inside card closure — use egui memory flag
                    ui.memory_mut(|m| m.data.insert_temp(egui::Id::new("dashboard_nav_ai"), true));
                }
            }
        });

        // Check navigation flag outside the card closure
        let navigate = ui.memory(|m| {
            m.data
                .get_temp::<bool>(egui::Id::new("dashboard_nav_ai"))
                .unwrap_or(false)
        });
        if navigate {
            ui.memory_mut(|m| m.data.insert_temp(egui::Id::new("dashboard_nav_ai"), false));
            return Some(DashboardAction::NavigateTo(Page::AI));
        }

        None
    }

    /// Render a single compact recommendation row with accent bar.
    fn compact_recommendation_row(ui: &mut Ui, rec: &llm_panel::Recommendation) {
        let sev_color = theme::severity_color_typed(&rec.severity);

        ui.horizontal(|ui: &mut egui::Ui| {
            // Left accent bar
            let (bar_rect, _) = ui.allocate_exact_size(
                egui::vec2(theme::ACCENT_BAR_WIDTH, COMPACT_REC_ROW_HEIGHT),
                egui::Sense::hover(),
            );
            if ui.is_rect_visible(bar_rect) {
                ui.painter().rect_filled(
                    bar_rect,
                    egui::CornerRadius::same(theme::ROUNDING_XS),
                    sev_color,
                );
            }

            ui.add_space(theme::SPACE_SM);

            // Content
            ui.vertical(|ui: &mut egui::Ui| {
                // Top line: severity badge + title
                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(ui, rec.severity.label(), sev_color);
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(&rec.title)
                            .font(theme::font_small())
                            .color(theme::text_primary())
                            .strong(),
                    );
                });
                // Bottom line: subtitle
                ui.label(
                    egui::RichText::new(&rec.subtitle)
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // CPU SPARKLINE CARD (clickable → Monitoring)
    // ──────────────────────────────────────────────────────────────────────
    fn cpu_sparkline_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "cpu_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            let config = widgets::SparklineConfig {
                color: theme::SUCCESS,
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque->Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let cpu_data: Vec<[f64; 2]> = state.monitoring.cpu_history.iter().copied().collect();
            widgets::sparkline_card_body(
                ui,
                "CPU",
                &resource_value(state.resources.cpu_percent, !cpu_data.is_empty()),
                &cpu_data,
                &config,
                INDICATOR_CHART_HEIGHT,
            );
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // MEMORY SPARKLINE CARD (clickable → Monitoring)
    // ──────────────────────────────────────────────────────────────────────
    fn memory_sparkline_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "memory_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            let config = widgets::SparklineConfig {
                color: theme::AI,
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque->Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let mem_data: Vec<[f64; 2]> = state.monitoring.memory_history.iter().copied().collect();
            widgets::sparkline_card_body(
                ui,
                "M\u{00c9}MOIRE",
                &resource_value(state.resources.memory_percent, !mem_data.is_empty()),
                &mem_data,
                &config,
                INDICATOR_CHART_HEIGHT,
            );
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // CHECKS SUMMARY CARD (clickable → Compliance)
    // ──────────────────────────────────────────────────────────────────────
    fn checks_summary_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "checks_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("CONTR\u{00d4}LES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            let total = state.policy.total_policies;
            let passing = state.policy.passing;

            if total == 0 {
                if state.summary.status == GuiAgentStatus::Scanning {
                    widgets::skeleton_text(ui, 100.0);
                } else {
                    ui.label(
                        egui::RichText::new("—")
                            .font(theme::font_card_value())
                            .color(theme::text_tertiary()),
                    );
                }
            } else {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!("{}/{}", passing, total))
                            .font(theme::font_card_value())
                            .color(
                                if passing == total
                                    && state.policy.errors == 0
                                    && state.policy.pending == 0
                                {
                                    theme::SUCCESS
                                } else {
                                    theme::text_primary()
                                },
                            )
                            .strong(),
                    );
                });
            }

            ui.add_space(theme::SPACE_XS);

            let fraction = if total > 0 {
                passing as f32 / total as f32
            } else {
                0.0
            };
            Self::mini_progress_bar(ui, fraction, theme::SUCCESS);

            ui.add_space(theme::SPACE_XS);

            let (status_text, status_color) = check_status(state);
            ui.label(
                egui::RichText::new(status_text)
                    .font(theme::font_label())
                    .color(theme::readable_color(status_color)),
            );
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // VULNERABILITIES SUMMARY CARD (clickable → Vulnerabilities)
    // ──────────────────────────────────────────────────────────────────────
    fn vulnerabilities_summary_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "vulns_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("VULN\u{00c9}RABILIT\u{00c9}S")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            if let Some(ref vuln) = state.vulnerability_summary {
                let total = vuln.critical + vuln.high + vuln.medium + vuln.low;
                let critical_color = if vuln.critical > 0 {
                    theme::ERROR
                } else {
                    theme::SUCCESS
                };

                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!("{}", vuln.critical))
                            .font(theme::font_card_value())
                            .color(critical_color)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("critiques")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });

                ui.add_space(theme::SPACE_XS);

                ui.horizontal(|ui: &mut egui::Ui| {
                    Self::mini_stat(
                        ui,
                        &format!("{}", vuln.high),
                        "\u{00e9}lev\u{00e9}es",
                        theme::WARNING,
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::mini_stat(ui, &format!("{}", total), "total", theme::text_secondary());
                });
            } else if state.summary.status == GuiAgentStatus::Scanning {
                ui.vertical(|ui| {
                    widgets::skeleton_text(ui, 80.0);
                    ui.add_space(theme::SPACE_XS);
                    ui.horizontal(|ui| {
                        widgets::skeleton(ui, 40.0, 20.0);
                        ui.add_space(theme::SPACE_SM);
                        widgets::skeleton(ui, 40.0, 20.0);
                    });
                });
            } else {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icons::SHIELD_CHECK)
                            .size(theme::ICON_MD)
                            .color(theme::text_tertiary()),
                    );
                    ui.label(
                        egui::RichText::new("Scan requis")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });
            }
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // THREATS INDICATOR CARD (clickable → Threats)
    // ──────────────────────────────────────────────────────────────────────
    fn threats_indicator_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "threats_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("MENACES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let proc_count = state.threats.suspicious_processes.len();
            let usb_count = state.threats.usb_events.len();
            let net_alerts = state.network.alerts.len();
            let fim_unacked = state.fim.alerts.iter().filter(|a| !a.acknowledged).count();
            let total = proc_count + usb_count + net_alerts + fim_unacked;

            let (color, label) = if total == 0 {
                (theme::text_secondary(), "Aucune alerte reçue")
            } else if total <= THREATS_WARNING_THRESHOLD {
                (theme::WARNING, "Attention requise")
            } else {
                (theme::ERROR, "Alerte critique")
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{}", total))
                        .font(theme::font_card_value())
                        .color(color)
                        .strong(),
                );
                ui.label(
                    egui::RichText::new("actives")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });

            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_label())
                    .color(color),
            );
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // FIM INDICATOR CARD (clickable → FileIntegrity)
    // ──────────────────────────────────────────────────────────────────────
    fn fim_indicator_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "fim_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("INT\u{00c9}GRIT\u{00c9} FICHIERS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let changes = state.fim.changes_today;
            let color = if changes == 0 {
                theme::SUCCESS
            } else if changes <= FIM_SAFE_THRESHOLD {
                theme::WARNING
            } else {
                theme::ERROR
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(crate::format::int(state.fim.monitored_count))
                        .font(theme::font_card_value())
                        .color(theme::accent_text())
                        .strong(),
                );
                ui.label(
                    egui::RichText::new("surveill\u{00e9}s")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });

            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(format!(
                    "{} aujourd'hui",
                    crate::format::count(changes, "modification")
                ))
                .font(theme::font_label())
                .color(color),
            );
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // NETWORK HEALTH CARD (clickable → Network)
    // ──────────────────────────────────────────────────────────────────────
    fn network_health_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "network_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("R\u{00c9}SEAU")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let alerts = state.network.alert_count;
            let color = if alerts == 0 {
                theme::SUCCESS
            } else if alerts <= NETWORK_ALERT_WARNING_THRESHOLD {
                theme::WARNING
            } else {
                theme::ERROR
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{}", alerts))
                        .font(theme::font_card_value())
                        .color(color)
                        .strong(),
                );
                ui.label(
                    egui::RichText::new(if alerts == 1 { "alerte" } else { "alertes" })
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });

            ui.add_space(theme::SPACE_XS);

            ui.horizontal(|ui: &mut egui::Ui| {
                Self::mini_stat(
                    ui,
                    &state.network.interface_count.to_string(),
                    "interfaces",
                    theme::text_secondary(),
                );
                ui.add_space(theme::SPACE_SM);
                Self::mini_stat(
                    ui,
                    &state.network.connection_count.to_string(),
                    "connexions",
                    theme::text_secondary(),
                );
            });
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // SOFTWARE COVERAGE CARD (clickable → Software)
    // ──────────────────────────────────────────────────────────────────────
    fn software_coverage_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "software_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            ui.label(
                egui::RichText::new("LOGICIELS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let total = state.software.packages.len();
            let up_to_date;

            if total == 0 {
                ui.label(
                    egui::RichText::new("—")
                        .font(theme::font_card_value())
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("Inventaire non disponible")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
                return;
            } else {
                up_to_date = state
                    .software
                    .packages
                    .iter()
                    .filter(|p| p.up_to_date)
                    .count();
                let coverage = (up_to_date as f32 / total as f32) * 100.0;

                let color = if coverage >= SOFTWARE_COVERAGE_GOOD {
                    theme::SUCCESS
                } else if coverage >= SOFTWARE_COVERAGE_WARN {
                    theme::WARNING
                } else {
                    theme::ERROR
                };

                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(crate::format::pct(coverage, 0))
                            .font(theme::font_card_value())
                            .color(color)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("\u{00e0} jour")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });

                ui.add_space(theme::SPACE_XS);
                Self::mini_progress_bar(ui, coverage / 100.0, color);
            }

            ui.add_space(theme::SPACE_XS);
            let outdated = total - up_to_date;
            if outdated > 0 {
                ui.label(
                    egui::RichText::new(format!(
                        "{} mise{s} \u{00e0} jour requise{s}",
                        crate::format::int(outdated),
                        s = crate::format::plural_suffix(outdated)
                    ))
                    .font(theme::font_label())
                    .color(theme::readable_color(theme::WARNING)),
                );
            } else {
                ui.label(
                    egui::RichText::new("Tous les logiciels à jour")
                        .font(theme::font_label())
                        .color(theme::readable_color(theme::SUCCESS)),
                );
            }
        })
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // KPI TRENDS CARD
    // ──────────────────────────────────────────────────────────────────────
    fn kpi_trends_card(ui: &mut egui::Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());

            // Header + period selector
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!(
                        "{}  TENDANCES & INDICATEURS CL\u{00c9}S",
                        icons::CHART_AREA
                    ))
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
                );

                ui.add_space(theme::SPACE_MD);

                // Period chips stored via egui memory (state.kpi.period is immutable here)
                let period_id = ui.id().with("kpi_period_selection");
                let current_period: KpiPeriod = ui.memory(|mem| {
                    mem.data
                        .get_temp::<u8>(period_id)
                        .map(|v| {
                            if v == 1 {
                                KpiPeriod::NinetyDays
                            } else {
                                KpiPeriod::ThirtyDays
                            }
                        })
                        .unwrap_or(state.kpi.period)
                });

                for period in [KpiPeriod::ThirtyDays, KpiPeriod::NinetyDays] {
                    let active = current_period == period;
                    if widgets::chip_button(ui, period.label_fr(), active, theme::ACCENT).clicked()
                    {
                        let val = match period {
                            KpiPeriod::ThirtyDays => 0u8,
                            KpiPeriod::NinetyDays => 1u8,
                        };
                        ui.memory_mut(|mem| mem.data.insert_temp(period_id, val));
                    }
                }
            });

            ui.add_space(theme::SPACE_MD);

            // Filter snapshots by period
            let period_id = ui.id().with("kpi_period_selection");
            let selected_period: KpiPeriod = ui.memory(|mem| {
                mem.data
                    .get_temp::<u8>(period_id)
                    .map(|v| {
                        if v == 1 {
                            KpiPeriod::NinetyDays
                        } else {
                            KpiPeriod::ThirtyDays
                        }
                    })
                    .unwrap_or(state.kpi.period)
            });

            let cutoff = chrono::Utc::now()
                - chrono::Duration::seconds(
                    i64::from(selected_period.days()).saturating_mul(SECS_PER_DAY),
                );

            let filtered: Vec<&crate::dto::KpiSnapshot> = state
                .kpi
                .snapshots
                .iter()
                .filter(|s| s.timestamp >= cutoff)
                .collect();

            if filtered.is_empty() {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new(format!("{}  Donn\u{00e9}es insuffisantes", icons::INFO))
                            .font(theme::font_body())
                            .color(theme::text_tertiary()),
                    );
                    ui.label(
                        egui::RichText::new("Les indicateurs appara\u{00ee}tront apr\u{00e8}s plusieurs jours de collecte.")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                    ui.add_space(theme::SPACE_MD);
                });
            } else {
                // Build sparkline data vectors
                let compliance_vals: Vec<[f64; 2]> = filtered
                    .iter()
                    .enumerate()
                    .map(|(i, s)| [i as f64, s.compliance_score as f64])
                    .collect();
                let incident_vals: Vec<[f64; 2]> = filtered
                    .iter()
                    .enumerate()
                    .map(|(i, s)| [i as f64, s.incident_count as f64])
                    .collect();
                let vulns_vals: Vec<[f64; 2]> = filtered
                    .iter()
                    .enumerate()
                    .map(|(i, s)| [i as f64, s.open_vulns as f64])
                    .collect();

                // Current values (last snapshot)
                let Some(last) = filtered.last() else {
                    return;
                };
                let current_compliance = crate::format::pct(last.compliance_score, 0);
                let current_incidents = crate::format::int(last.incident_count);
                let current_vulns = crate::format::int(last.open_vulns);
                let current_sla = last.remediation_sla_pct;

                // Compute trends (first half avg vs second half avg)
                let mid = filtered.len() / 2;
                let compliance_trend = Self::kpi_trend(&filtered, mid, |s| s.compliance_score);
                let incident_trend = Self::kpi_trend(&filtered, mid, |s| s.incident_count as f32);
                let vulns_trend = Self::kpi_trend(&filtered, mid, |s| s.open_vulns as f32);
                let sla_trend = Self::kpi_trend(&filtered, mid, |s| s.remediation_sla_pct);

                // Render 4 KPI cards in a responsive grid
                ui.push_id("kpi_trends_grid", |ui: &mut egui::Ui| {
                    let grid = widgets::ResponsiveGrid::new(180.0, theme::SPACE);
                    let items = vec![0, 1, 2, 3];

                    grid.show(ui, &items, |ui, width, &idx| {
                        ui.vertical(|ui: &mut egui::Ui| {
                            ui.set_width(width);
                            match idx {
                                0 => {
                                    // Score conformite
                                    let (arrow, color) =
                                        Self::kpi_trend_arrow(compliance_trend, true);
                                    Self::kpi_sparkline_cell(
                                        ui,
                                        "Score conformit\u{00e9}",
                                        &current_compliance,
                                        arrow,
                                        color,
                                        &compliance_vals,
                                        theme::SUCCESS,
                                    );
                                }
                                1 => {
                                    // Incidents
                                    let (arrow, color) =
                                        Self::kpi_trend_arrow(incident_trend, false);
                                    Self::kpi_sparkline_cell(
                                        ui,
                                        "Incidents",
                                        &current_incidents,
                                        arrow,
                                        color,
                                        &incident_vals,
                                        theme::WARNING,
                                    );
                                }
                                2 => {
                                    // Vulnerabilites ouvertes
                                    let (arrow, color) = Self::kpi_trend_arrow(vulns_trend, false);
                                    Self::kpi_sparkline_cell(
                                        ui,
                                        "Vuln\u{00e9}rabilit\u{00e9}s ouvertes",
                                        &current_vulns,
                                        arrow,
                                        color,
                                        &vulns_vals,
                                        theme::ERROR,
                                    );
                                }
                                _ => {
                                    // SLA remediation (mini gauge)
                                    let (arrow, color) = Self::kpi_trend_arrow(sla_trend, true);
                                    let sla_color =
                                        theme::readable_color(theme::score_color(current_sla));
                                    egui::Frame::new()
                                        .fill(theme::bg_tertiary())
                                        .corner_radius(egui::CornerRadius::same(
                                            theme::CARD_ROUNDING,
                                        ))
                                        .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
                                        .show(ui, |ui: &mut egui::Ui| {
                                            ui.label(
                                                egui::RichText::new("SLA rem\u{00e9}diation")
                                                    .font(theme::font_label())
                                                    .color(theme::text_tertiary())
                                                    .strong(),
                                            );
                                            ui.add_space(theme::SPACE_XS);
                                            ui.horizontal(|ui: &mut egui::Ui| {
                                                ui.label(
                                                    egui::RichText::new(format!(
                                                        "{:.0}\u{202f}%",
                                                        current_sla
                                                    ))
                                                    .font(theme::font_card_value())
                                                    .color(sla_color)
                                                    .strong(),
                                                );
                                                ui.label(
                                                    egui::RichText::new(arrow)
                                                        .font(theme::font_body())
                                                        .color(color),
                                                );
                                            });
                                            ui.add_space(theme::SPACE_XS);
                                            ui.vertical_centered(|ui: &mut egui::Ui| {
                                                widgets::mini_gauge(
                                                    ui,
                                                    current_sla,
                                                    sla_color,
                                                    KPI_GAUGE_SIZE,
                                                );
                                            });
                                        });
                                }
                            }
                        });
                    });
                });
            }
        });
    }

    /// Render a single KPI sparkline cell with label, value, trend arrow, and chart.
    fn kpi_sparkline_cell(
        ui: &mut egui::Ui,
        label: &str,
        value: &str,
        trend_arrow: &str,
        trend_color: egui::Color32,
        data: &[[f64; 2]],
        line_color: egui::Color32,
    ) {
        egui::Frame::new()
            .fill(theme::bg_tertiary())
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
            .show(ui, |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(label)
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_TIGHT)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(value)
                            .font(theme::font_card_value())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new(trend_arrow)
                            .font(theme::font_body())
                            .color(trend_color),
                    );
                });
                ui.add_space(theme::SPACE_XS);

                let config = widgets::SparklineConfig {
                    color: line_color,
                    fill: true,
                    show_trend: false,
                    show_stats: false,
                };
                widgets::sparkline(
                    ui,
                    label,
                    data,
                    egui::Vec2::new(ui.available_width(), KPI_SPARKLINE_HEIGHT),
                    &config,
                );
            });
    }

    /// Compute trend direction: average of second half minus average of first half.
    /// Returns positive if increasing, negative if decreasing, zero if flat.
    fn kpi_trend(
        snapshots: &[&crate::dto::KpiSnapshot],
        mid: usize,
        extract: fn(&crate::dto::KpiSnapshot) -> f32,
    ) -> f32 {
        if snapshots.len() < 2 {
            return 0.0;
        }
        let first_half = &snapshots[..mid.max(1)];
        let second_half = &snapshots[mid.max(1)..];

        let avg_first =
            first_half.iter().map(|s| extract(s)).sum::<f32>() / first_half.len().max(1) as f32;
        let avg_second =
            second_half.iter().map(|s| extract(s)).sum::<f32>() / second_half.len().max(1) as f32;

        avg_second - avg_first
    }

    /// Return (arrow_str, color) based on trend direction.
    /// `up_is_good`: true for compliance/SLA (up=green), false for incidents/vulns (up=red).
    fn kpi_trend_arrow(trend: f32, up_is_good: bool) -> (&'static str, egui::Color32) {
        const TREND_THRESHOLD: f32 = 0.5;
        if trend > TREND_THRESHOLD {
            if up_is_good {
                ("\u{2191}", theme::SUCCESS) // up arrow, green
            } else {
                ("\u{2191}", theme::ERROR) // up arrow, red
            }
        } else if trend < -TREND_THRESHOLD {
            if up_is_good {
                ("\u{2193}", theme::ERROR) // down arrow, red
            } else {
                ("\u{2193}", theme::SUCCESS) // down arrow, green
            }
        } else {
            ("\u{2192}", theme::text_tertiary()) // right arrow, neutral
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────

    fn mini_progress_bar(ui: &mut Ui, fraction: f32, color: egui::Color32) {
        let height = 4.0;
        let width = ui.available_width();
        let (rect, _) =
            ui.allocate_exact_size(egui::Vec2::new(width, height), egui::Sense::hover());

        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);
            let rounding = egui::CornerRadius::same(theme::ROUNDING_XS);

            painter.rect_filled(rect, rounding, theme::bg_tertiary());

            if fraction > 0.0 {
                let fill_width = rect.width() * fraction.clamp(0.0, 1.0);
                let fill_rect =
                    egui::Rect::from_min_size(rect.min, egui::Vec2::new(fill_width, height));
                painter.rect_filled(fill_rect, rounding, color);
            }
        }
    }

    fn mini_stat(ui: &mut Ui, value: &str, label: &str, color: egui::Color32) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(color)
                    .strong(),
            );
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_caption())
                    .color(theme::text_tertiary()),
            );
        });
    }

    fn export_dashboard_csv(state: &AppState) -> bool {
        let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let headers = &["metrique", "valeur", "unite", "horodatage"];
        let mut rows = vec![
            vec![
                "Conformit\u{00e9}".to_string(),
                state
                    .summary
                    .compliance_score
                    .map(|s| format!("{:.1}", s))
                    .unwrap_or_default(),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "CPU".to_string(),
                format!("{:.1}", state.resources.cpu_percent),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "M\u{00e9}moire".to_string(),
                format!("{:.1}", state.resources.memory_percent),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "Politiques totales".to_string(),
                state.policy.total_policies.to_string(),
                "".to_string(),
                timestamp.clone(),
            ],
            vec![
                "Politiques conformes".to_string(),
                state.policy.passing.to_string(),
                "".to_string(),
                timestamp.clone(),
            ],
        ];

        if let Some(ref vuln) = state.vulnerability_summary {
            rows.push(vec![
                "Vuln\u{00e9}rabilit\u{00e9}s Critiques".to_string(),
                vuln.critical.to_string(),
                "".to_string(),
                timestamp.clone(),
            ]);
            rows.push(vec![
                "Vuln\u{00e9}rabilit\u{00e9}s \u{00c9}lev\u{00e9}es".to_string(),
                vuln.high.to_string(),
                "".to_string(),
                timestamp,
            ]);
        }

        let path = crate::export::default_export_path("dashboard_summary.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}

#[cfg(test)]
mod status_tests {
    use super::*;

    #[test]
    fn zero_usage_is_only_displayed_after_a_measurement() {
        assert_eq!(resource_value(0.0, false), "—");
        assert_eq!(resource_value(f64::NAN, true), "—");
        assert_eq!(resource_value(0.0, true), crate::format::pct(0.0, 1));
    }

    #[test]
    fn conformity_requires_complete_successful_results() {
        let mut state = AppState::default();
        assert_eq!(check_status(&state).0, "Évaluation en attente");
        state.policy.total_policies = 2;
        state.policy.passing = 1;
        assert_eq!(check_status(&state).0, "Résultats incomplets");
        state.policy.pending = 1;
        assert!(check_status(&state).0.contains("en attente"));
        state.policy.pending = 0;
        state.policy.errors = 1;
        assert_eq!(check_status(&state).1, theme::ERROR);
        state.policy.errors = 0;
        state.policy.passing = 2;
        assert_eq!(check_status(&state).0, "Tous conformes");
    }
}
