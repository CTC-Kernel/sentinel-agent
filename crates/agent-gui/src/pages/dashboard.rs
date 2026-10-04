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

/// Threshold for FIM changes per day considered safe (no warning).
const FIM_SAFE_THRESHOLD: u32 = 5;
/// Threshold for network alerts requiring attention (warning level).
const NETWORK_ALERT_WARNING_THRESHOLD: u32 = 2;
/// Software coverage percentage above which is considered good.
const SOFTWARE_COVERAGE_GOOD: f32 = 90.0;
/// Software coverage percentage above which is considered acceptable.
const SOFTWARE_COVERAGE_WARN: f32 = 70.0;
/// AI posture gauge radius in the hero card.
const AI_GAUGE_RADIUS: f32 = 30.0;
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
const AI_SCORE_CARD_MIN_HEIGHT: f32 = 252.0;

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

        // The verdict is the first content, before tenant context and tools.
        let available = ui.available_width();
        if available >= 940.0 {
            let gap = theme::SPACE;
            let assistant_width = ((available - gap) * 0.36).max(330.0);
            let verdict_width = available - gap - assistant_width;
            ui.horizontal_top(|ui| {
                ui.spacing_mut().item_spacing.x = gap;
                ui.vertical(|ui| {
                    ui.set_width(verdict_width);
                    if let Some(target) = Self::posture_panel(ui, state) {
                        action = Some(DashboardAction::NavigateTo(target));
                    }
                });
                ui.vertical(|ui| {
                    ui.set_width(assistant_width);
                    if let Some(next) = Self::ai_posture_score_card(ui, state) {
                        action = Some(next);
                    }
                });
            });
        } else {
            if let Some(target) = Self::posture_panel(ui, state) {
                action = Some(DashboardAction::NavigateTo(target));
            }
        }

        ui.add_space(theme::SPACE);
        if let Some(target) = Self::operational_pulse(ui, state) {
            action = Some(DashboardAction::NavigateTo(target));
        }
        ui.add_space(theme::SPACE_SM);
        if available < 940.0 {
            egui::CollapsingHeader::new("Assistant Sentinel · Poser une question")
                .id_salt("dashboard_assistant_compact")
                .show(ui, |ui| {
                    if let Some(next) = Self::ai_posture_score_card(ui, state) {
                        action = Some(next);
                    }
                });
        }
        crate::pages::security_navigation(ui, state);
        widgets::section_header(
            ui,
            "Télémétrie du poste",
            Some("Ressources et couverture des contrôles"),
        );

        // ══════════════════════════════════════════════════════════════════
        // UNIFIED INDICATORS (8 cards: metrics + security in single grid)
        // ══════════════════════════════════════════════════════════════════
        ui.push_id("indicators_grid", |ui| {
            let grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE);
            let items = vec![3, 4, 2, 5, 0, 1, 6, 7];

            grid.show(ui, &items, |ui, width, &idx| {
                ui.vertical(|ui: &mut egui::Ui| {
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
                    if clicked && idx <= 1 {
                        super::resource_detail::open(ui.ctx(), idx == 1);
                    } else if clicked {
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
                ui.vertical(|ui: &mut egui::Ui| {
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

        widgets::section_header(ui, "Connexion et exports", None);
        if let Some(command) = widgets::org_banner(ui, state) {
            action = Some(DashboardAction::Command(command));
        }
        ui.add_space(theme::SPACE_SM);
        if let Some(command) = Self::action_bar(ui, state) {
            action = Some(DashboardAction::Command(command));
        }
        ui.add_space(theme::SPACE);
        super::resource_detail::show(ui.ctx(), state);
        action
    }

    fn posture_panel(ui: &mut Ui, state: &AppState) -> Option<Page> {
        widgets::security_hero(ui, state);
        ui.ctx().data_mut(|d| {
            let key = egui::Id::new("posture_navigation");
            let page = d.get_temp::<Page>(key);
            d.remove::<Page>(key);
            page
        })
    }

    // ──────────────────────────────────────────────────────────────────────
    // ACTION BAR (replaces Command Center — flat inline strip)
    // ──────────────────────────────────────────────────────────────────────
    fn action_bar(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            // Left: Action buttons

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
        });

        ui.add_space(theme::SPACE_XS);
        widgets::divider_thin(ui);

        command
    }

    /// Posture strip: agent, controls and exposure, each a tile that says
    /// how it stands, why, and opens its page. It also carries the agent's
    /// status, last scan and uptime, which used to sit as a loose line
    /// beside the action buttons.
    fn operational_pulse(ui: &mut Ui, state: &AppState) -> Option<Page> {
        let tiles = [
            pulse_agent(state),
            pulse_controls(state),
            pulse_exposure(state),
        ];
        let mut selected = None;

        ui.push_id("operational_pulse", |ui| {
            widgets::ResponsiveGrid::new(220.0, theme::SPACE_SM).show(
                ui,
                &tiles,
                |ui, width, tile| {
                    ui.set_width(width);
                    let response =
                        widgets::clickable_card(ui, ("pulse", tile.label), |ui: &mut egui::Ui| {
                            ui.set_min_height(PULSE_TILE_HEIGHT);
                            ui.horizontal(|ui| {
                                widgets::icon_tile(ui, tile.icon, tile.color, 28.0);
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(tile.label)
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary())
                                        .extra_letter_spacing(theme::TRACKING_WIDE),
                                );
                                ui.with_layout(
                                    egui::Layout::right_to_left(egui::Align::Center),
                                    |ui| {
                                        ui.label(
                                            egui::RichText::new(icons::ARROW_RIGHT)
                                                .size(theme::ICON_XS)
                                                .color(theme::text_tertiary()),
                                        );
                                    },
                                );
                            });
                            ui.add_space(theme::SPACE_SM);
                            ui.label(
                                egui::RichText::new(&tile.value)
                                    .font(theme::font_h2())
                                    .color(theme::readable_color(tile.color)),
                            );
                            ui.add_space(theme::SPACE_XS);
                            // A tile without a bar keeps its slot, so the three
                            // tiles line up however their content differs.
                            if tile.segments.is_empty() {
                                // Allocated like the bar, so it gets the same item spacing.
                                ui.allocate_exact_size(
                                    egui::vec2(ui.available_width(), PULSE_BAR_HEIGHT),
                                    egui::Sense::hover(),
                                );
                            } else {
                                segmented_bar(ui, &tile.segments);
                            }
                            ui.add_space(theme::SPACE_XS);
                            for line in &tile.details {
                                ui.label(
                                    egui::RichText::new(line)
                                        .font(theme::font_caption())
                                        .color(theme::text_secondary()),
                                );
                            }
                        });
                    response.widget_info(|| {
                        egui::WidgetInfo::labeled(
                            egui::WidgetType::Button,
                            ui.is_enabled(),
                            format!(
                                "{} : {} — {}",
                                tile.label,
                                tile.value,
                                tile.details.join(", ")
                            ),
                        )
                    });
                    if response.clicked() {
                        selected = Some(tile.page.clone());
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

        let mut nav_action = None;

        widgets::data_card(ui, "Analyse assistée", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(AI_SCORE_CARD_MIN_HEIGHT);
            ui.vertical(|ui: &mut egui::Ui| {
                widgets::eyebrow(ui, "ASSISTANT SENTINEL");
                ui.add_space(theme::SPACE_SM);
                let voice_state = if state.ai.is_listening {
                    crate::widgets::sentinel_ai_core::VoiceState::Listening(state.ai.mic_level)
                } else if state.ai.is_speaking {
                    // Speech activity is known, but no output amplitude is measured.
                    crate::widgets::sentinel_ai_core::VoiceState::Speaking(0.0)
                } else {
                    crate::widgets::sentinel_ai_core::VoiceState::Idle
                };
                ui.horizontal(|ui| {
                    let core = widgets::SentinelAICore::new(ai_score)
                        .processing(state.ai.is_processing)
                        .voice(voice_state)
                        .show(ui, AI_GAUGE_RADIUS);
                    if core.clicked() {
                        nav_action = Some(DashboardAction::NavigateTo(Page::AI));
                    }
                    ui.vertical(|ui| {
                        ui.set_width(ui.available_width().max(1.0));
                        ui.label(
                            egui::RichText::new("Analyse assistée")
                                .font(theme::font_h3())
                                .color(theme::text_primary()),
                        );
                        let status = if state.ai.is_listening {
                            "Écoute en cours"
                        } else if state.ai.is_speaking {
                            "Réponse vocale"
                        } else if state.ai.is_processing {
                            "Analyse en cours"
                        } else if state.ai.model_status.is_ready {
                            "Modèle local prêt"
                        } else {
                            "Modèle non chargé"
                        };
                        ui.label(
                            egui::RichText::new(status)
                                .font(theme::font_caption())
                                .color(theme::text_secondary()),
                        );
                    });
                });
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(
                        "Interrogez les résultats et préparez votre prochaine intervention.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_MD);

                // Inline Chat Input
                ui.horizontal(|ui: &mut egui::Ui| {
                    // PREMIUM Voice Toggle
                    if widgets::voice_toggle_button(ui, state.ai.is_listening).clicked()
                        && let Some(command) = LLMPanel::toggle_dictation(state)
                    {
                        nav_action = Some(DashboardAction::Command(command));
                    }

                    ui.add_space(theme::SPACE_XS);
                    let chat =
                        widgets::ChatInput::new(&mut state.ai.input_text, "Poser une question…")
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
                ui.add_space(theme::SPACE_SM);
                if widgets::ghost_button(
                    ui,
                    format!("Voir les recommandations  {}", icons::ARROW_RIGHT),
                )
                .clicked()
                {
                    state.ai.active_tab = crate::dto::LlmTab::Recommendations;
                    nav_action = Some(DashboardAction::NavigateTo(Page::AI));
                }
            });
        });

        nav_action
    }

    // ──────────────────────────────────────────────────────────────────────
    // COMPACT RECOMMENDATIONS CARD (bottom-left panel)
    // ──────────────────────────────────────────────────────────────────────
    fn compact_recommendations_card(ui: &mut Ui, state: &mut AppState) -> Option<DashboardAction> {
        let recommendations = LLMPanel::build_recommendations(state);
        let total = recommendations.len();

        widgets::data_card(ui, "Recommandations IA", |ui: &mut egui::Ui| {
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
                for (idx, rec) in recommendations
                    .iter()
                    .take(DASHBOARD_MAX_RECOMMENDATIONS)
                    .enumerate()
                {
                    if Self::compact_recommendation_row(ui, rec) {
                        state.ai.selected_recommendation = Some(idx);
                        state.ai.detail_open = true;
                        state.ai.active_tab = crate::dto::LlmTab::Recommendations;
                        ui.memory_mut(|m| {
                            m.data.insert_temp(egui::Id::new("dashboard_nav_ai"), true)
                        });
                    }
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
    fn compact_recommendation_row(ui: &mut Ui, rec: &llm_panel::Recommendation) -> bool {
        let sev_color = theme::severity_color_typed(&rec.severity);

        let row = ui.horizontal(|ui: &mut egui::Ui| {
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
                ui.set_width(ui.available_width().max(1.0));
                // Top line: severity badge + title
                ui.horizontal_wrapped(|ui: &mut egui::Ui| {
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
        ui.interact(
            row.response.rect,
            row.response.id.with("open_recommendation"),
            egui::Sense::click(),
        )
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text("Examiner cette recommandation")
        .clicked()
    }

    // ──────────────────────────────────────────────────────────────────────
    // CPU SPARKLINE CARD (clickable → Monitoring)
    // ──────────────────────────────────────────────────────────────────────
    fn cpu_sparkline_card(ui: &mut Ui, state: &AppState) -> bool {
        widgets::clickable_card(ui, "cpu_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(INDICATOR_CARD_MIN_HEIGHT);
            let config = widgets::SparklineConfig {
                color: theme::INFO,
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
                                    theme::readable_color(theme::SUCCESS)
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
                            .color(theme::readable_color(critical_color))
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

            let (total, critical) = state.security_attention_counts();
            let (color, label) = if total == 0 {
                (theme::text_secondary(), "Aucun événement à traiter")
            } else if critical > 0 {
                (theme::ERROR, "Sévérité critique à examiner")
            } else {
                (theme::WARNING, "Événements à examiner")
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{}", total))
                        .font(theme::font_card_value())
                        .color(theme::readable_color(color))
                        .strong(),
                );
                ui.label(
                    egui::RichText::new("à traiter")
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });

            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::readable_color(color)),
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
                .color(theme::readable_color(color)),
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
                        .color(theme::readable_color(color))
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
                            .color(theme::readable_color(color))
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
        widgets::data_card(ui, "Tendances et indicateurs clés", |ui: &mut egui::Ui| {
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
                                                    .color(theme::readable_color(sla_color))
                                                    .strong(),
                                                );
                                                ui.label(
                                                    egui::RichText::new(arrow)
                                                        .font(theme::font_body())
                                                        .color(theme::readable_color(color)),
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
                    .color(theme::readable_color(color))
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

/// Inner height of a posture tile: header, value, bar and two detail lines.
const PULSE_TILE_HEIGHT: f32 = 116.0;
/// Height of the proportion bar under a posture tile's value.
const PULSE_BAR_HEIGHT: f32 = 6.0;

/// One tile of the posture strip.
struct PulseTile {
    page: Page,
    icon: &'static str,
    label: &'static str,
    value: String,
    color: egui::Color32,
    /// Proportions for the bar under the value; empty for no bar.
    segments: Vec<(u64, egui::Color32)>,
    details: Vec<String>,
}

fn pulse_agent(state: &AppState) -> PulseTile {
    let (value, color) = match state.summary.status {
        GuiAgentStatus::Connected => ("Op\u{00e9}rationnel", theme::SUCCESS),
        GuiAgentStatus::Standalone => ("Autonome", theme::SUCCESS),
        GuiAgentStatus::Scanning => ("Analyse en cours", theme::INFO),
        GuiAgentStatus::Syncing => ("Synchronisation", theme::INFO),
        GuiAgentStatus::Disconnected => ("Hors connexion", theme::WARNING),
        GuiAgentStatus::Paused => ("En pause", theme::WARNING),
        GuiAgentStatus::Error => ("En erreur", theme::ERROR),
        GuiAgentStatus::Starting => ("D\u{00e9}marrage", theme::INFO),
    };
    let last_scan = match state.summary.last_check_at {
        Some(at) => format!(
            "Derni\u{00e8}re analyse {}",
            crate::format::ago(chrono::Utc::now(), at)
        ),
        None => "Aucune analyse encore".to_owned(),
    };
    PulseTile {
        page: Page::Monitoring,
        icon: icons::SHIELD_CHECK,
        label: "AGENT",
        value: value.to_owned(),
        color,
        segments: Vec::new(),
        details: vec![
            last_scan,
            format!(
                "Actif depuis {}",
                crate::format::duration_short(state.summary.uptime_secs)
            ),
        ],
    }
}

fn pulse_controls(state: &AppState) -> PulseTile {
    let policy = &state.policy;
    let (status, color) = check_status(state);
    if policy.total_policies == 0 {
        return PulseTile {
            page: Page::Compliance,
            icon: icons::CLIPBOARD_CHECK,
            label: "CONTR\u{00d4}LES",
            value: "En attente".to_owned(),
            color: theme::text_tertiary(),
            segments: Vec::new(),
            details: vec!["Aucun contr\u{00f4}le \u{00e9}valu\u{00e9}".to_owned()],
        };
    }
    PulseTile {
        page: Page::Compliance,
        icon: icons::CLIPBOARD_CHECK,
        label: "CONTR\u{00d4}LES",
        value: format!(
            "{} / {}",
            crate::format::int(policy.passing),
            crate::format::int(policy.total_policies)
        ),
        color,
        segments: vec![
            (policy.passing as u64, theme::SUCCESS),
            (policy.failing as u64, theme::SEVERITY_MEDIUM),
            (policy.errors as u64, theme::ERROR),
            (policy.pending as u64, theme::INFO),
        ],
        details: vec![
            status,
            "conformes sur le total \u{00e9}valu\u{00e9}".to_owned(),
        ],
    }
}

fn pulse_exposure(state: &AppState) -> PulseTile {
    let Some(vuln) = state.vulnerability_summary.as_ref() else {
        return PulseTile {
            page: Page::Vulnerabilities,
            icon: icons::CROSSHAIRS,
            label: "EXPOSITION",
            value: "En attente".to_owned(),
            color: theme::text_tertiary(),
            segments: Vec::new(),
            details: vec!["En attente d\u{2019}analyse des CVE".to_owned()],
        };
    };
    let priorities = vuln.critical + vuln.high;
    let (value, color) = if priorities == 0 {
        ("Aucune priorit\u{00e9}".to_owned(), theme::SUCCESS)
    } else {
        (
            crate::format::count(priorities, "priorit\u{00e9}"),
            if vuln.critical > 0 {
                theme::ERROR
            } else {
                theme::SEVERITY_HIGH
            },
        )
    };
    let breakdown = [
        (vuln.critical, "critique"),
        (vuln.high, "\u{00e9}lev\u{00e9}e"),
        (vuln.medium, "moyenne"),
        (vuln.low, "faible"),
    ]
    .iter()
    .filter(|(n, _)| *n > 0)
    .map(|(n, word)| crate::format::count(*n, word))
    .collect::<Vec<_>>();
    PulseTile {
        page: Page::Vulnerabilities,
        icon: icons::CROSSHAIRS,
        label: "EXPOSITION",
        value,
        color,
        segments: vec![
            (vuln.critical as u64, theme::ERROR),
            (vuln.high as u64, theme::SEVERITY_HIGH),
            (vuln.medium as u64, theme::SEVERITY_MEDIUM),
            (vuln.low as u64, theme::INFO),
        ],
        details: vec![
            if breakdown.is_empty() {
                "Aucune CVE connue".to_owned()
            } else {
                breakdown.join(" \u{00b7} ")
            },
            "CVE critiques et \u{00e9}lev\u{00e9}es".to_owned(),
        ],
    }
}

/// A thin bar split in proportion to each count, gaps between segments.
fn segmented_bar(ui: &mut Ui, segments: &[(u64, egui::Color32)]) {
    let height = PULSE_BAR_HEIGHT;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if !ui.is_rect_visible(rect) {
        return;
    }
    let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
    let painter = ui.painter();
    painter.rect_filled(rect, radius, theme::bg_tertiary());
    let total: u64 = segments.iter().map(|(n, _)| *n).sum();
    if total == 0 {
        return;
    }
    let live: Vec<_> = segments.iter().filter(|(n, _)| *n > 0).collect();
    let gap = 2.0;
    let usable = rect.width() - gap * (live.len().saturating_sub(1)) as f32;
    let mut x = rect.left();
    for (n, color) in live {
        let w = usable * (*n as f32 / total as f32);
        painter.rect_filled(
            egui::Rect::from_min_size(egui::pos2(x, rect.top()), egui::vec2(w, height)),
            radius,
            theme::readable_color(*color),
        );
        x += w + gap;
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
