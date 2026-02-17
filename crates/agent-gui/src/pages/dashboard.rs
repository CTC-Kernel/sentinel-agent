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
const INDICATOR_CARD_MIN_HEIGHT: f32 = 96.0;
/// Minimum inner height for bottom-row cards (recommendations + feed).
const BOTTOM_CARD_MIN_HEIGHT: f32 = 200.0;

/// Actions returned by the dashboard page.
pub enum DashboardAction {
    /// Forward a runtime command to the agent.
    Command(GuiCommand),
    /// Navigate to a specific page.
    NavigateTo(Page),
}

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<DashboardAction> {
        let mut action: Option<DashboardAction> = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Tableau de bord"],
            "Tableau de bord",
            Some("CENTRE DE PILOTAGE GRC"),
            Some(
                "Vue d'ensemble de votre posture de s\u{00e9}curit\u{00e9}. Pilotez conformit\u{00e9}, vuln\u{00e9}rabilit\u{00e9}s et menaces en temps r\u{00e9}el.",
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

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // SECURITY HERO + AI POSTURE SCORE (Side by side on large screens)
        // ══════════════════════════════════════════════════════════════════
        ui.push_id("hero_grid", |ui| {
            let hero_grid = widgets::ResponsiveGrid::new(400.0, theme::SPACE);
            let hero_items = vec![0, 1];

            hero_grid.show(ui, &hero_items, |ui, width, &idx| {
                ui.vertical(|ui: &mut egui::Ui| {
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
                            if click.hovered() {
                                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                            }
                            if click.clicked() {
                                action = Some(DashboardAction::NavigateTo(Page::Compliance));
                            }
                        }
                        _ => {
                            if Self::ai_posture_score_card(ui, state) {
                                action = Some(DashboardAction::NavigateTo(Page::AI));
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
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_width(width);
                    match idx {
                        0 => {
                            if let Some(nav) = Self::compact_recommendations_card(ui, state) {
                                action = Some(nav);
                            }
                        }
                        _ => {
                            let clicked =
                                widgets::clickable_card(ui, "activity_feed_click", |ui: &mut egui::Ui| {
                                    ui.set_min_width(ui.available_width());
                                    ui.set_min_height(BOTTOM_CARD_MIN_HEIGHT);
                                    widgets::activity_feed(ui, state, ACTIVITY_FEED_LIMIT);
                                })
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
    fn action_bar(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.horizontal(|ui: &mut egui::Ui| {
            // Left: Action buttons
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    icons::PLAY,
                    if is_scanning { "SCAN EN COURS..." } else { "SCAN" }
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
            if widgets::button::secondary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    icons::SYNC,
                    if is_syncing { "SYNC..." } else { "SYNCHRONISER" }
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
                format!("{}  EXPORTER", icons::DOWNLOAD),
                true,
                false,
            )
            .clicked()
            {
                Self::export_dashboard_csv(state);
            }

            // Right: Compact system status
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    // Uptime
                    let uptime_hours = state.summary.uptime_secs / 3600;
                    let uptime_mins = (state.summary.uptime_secs % 3600) / 60;
                    ui.label(
                        egui::RichText::new(format!("{}h{}m", uptime_hours, uptime_mins))
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
                            format!("{}min", elapsed.num_minutes())
                        } else {
                            format!("{}h", elapsed.num_hours())
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
                        GuiAgentStatus::Disconnected => ("D\u{00e9}connect\u{00e9}", theme::WARNING),
                        GuiAgentStatus::Error => ("Erreur", theme::ERROR),
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

    // ──────────────────────────────────────────────────────────────────────
    // AI POSTURE SCORE CARD (clickable → AI page)
    // ──────────────────────────────────────────────────────────────────────
    fn ai_posture_score_card(ui: &mut Ui, state: &AppState) -> bool {
        let ai_score = LLMPanel::compute_ai_score(state);
        let risk_label = LLMPanel::risk_label(ai_score);
        let risk_color = theme::score_color(ai_score);

        widgets::clickable_card(ui, "ai_score_card", |ui: &mut egui::Ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(220.0);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("SCORE DE S\u{00c9}CURIT\u{00c9} IA")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                // Gauge
                widgets::compliance_gauge(ui, Some(ai_score), AI_GAUGE_RADIUS);

                ui.add_space(theme::SPACE_SM);

                // Risk badge
                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(ui, risk_label, risk_color);
                });

                ui.add_space(theme::SPACE_MD);

                // 4-component breakdown
                let compliance_pct = state.summary.compliance_score.unwrap_or(50.0);
                let threat_count = state.threats.suspicious_processes.len()
                    + state.threats.system_incidents.len();
                let vuln_count = state.vulnerability_findings.len();
                let alert_count = state.network.alerts.len();

                let components: &[(&str, f32, &str)] = &[
                    ("Conformit\u{00e9}", compliance_pct, "40%"),
                    ("Menaces", 100.0 - (threat_count as f32 * 10.0).min(100.0), "20%"),
                    ("Vuln\u{00e9}rabilit\u{00e9}s", 100.0 - (vuln_count as f32 * 5.0).min(100.0), "25%"),
                    ("R\u{00e9}seau", 100.0 - (alert_count as f32 * 15.0).min(100.0), "15%"),
                ];

                for (label, score, weight) in components {
                    let color = theme::score_color(*score);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} ({})", label, weight))
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(format!("{:.0}%", score))
                                        .font(theme::font_small())
                                        .color(color)
                                        .strong(),
                                );
                            },
                        );
                    });
                }
            });
        })
        .clicked()
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
                widgets::protected_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "POSTURE S\u{00c9}CURIS\u{00c9}E",
                    "Aucune recommandation. Contr\u{00f4}les conformes.",
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
                        icons::BRAIN, total, icons::ARROW_RIGHT
                    )
                } else {
                    format!(
                        "{}  Analyse compl\u{00e8}te {}",
                        icons::BRAIN, icons::ARROW_RIGHT
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
                color: theme::accent_text(),
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque->Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let cpu_data: Vec<[f64; 2]> = state.monitoring.cpu_history.iter().copied().collect();
            widgets::sparkline_with_value(
                ui,
                "CPU",
                &format!("{:.1}%", state.resources.cpu_percent),
                &cpu_data,
                &config,
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
                color: theme::INFO,
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque->Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let mem_data: Vec<[f64; 2]> =
                state.monitoring.memory_history.iter().copied().collect();
            widgets::sparkline_with_value(
                ui,
                "M\u{00c9}MOIRE",
                &format!("{:.1}%", state.resources.memory_percent),
                &mem_data,
                &config,
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
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            let total = state.policy.total_policies;
            let passing = state.policy.passing;

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{}/{}", passing, total))
                        .font(theme::font_card_value())
                        .color(if passing == total {
                            theme::SUCCESS
                        } else {
                            theme::text_primary()
                        })
                        .strong(),
                );
            });

            ui.add_space(theme::SPACE_XS);

            let fraction = if total > 0 {
                passing as f32 / total as f32
            } else {
                0.0
            };
            Self::mini_progress_bar(ui, fraction, theme::SUCCESS);

            ui.add_space(theme::SPACE_XS);

            let status_text = if state.policy.failing > 0 {
                format!("{} \u{00e9}chec(s)", state.policy.failing)
            } else {
                "Tous conformes".to_string()
            };
            ui.label(
                egui::RichText::new(status_text)
                    .font(theme::font_label())
                    .color(if state.policy.failing > 0 {
                        theme::WARNING
                    } else {
                        theme::SUCCESS
                    }),
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
                    Self::mini_stat(ui, &format!("{}", vuln.high), "\u{00e9}lev\u{00e9}es", theme::WARNING);
                    ui.add_space(theme::SPACE_SM);
                    Self::mini_stat(ui, &format!("{}", total), "total", theme::text_secondary());
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
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let proc_count = state.threats.suspicious_processes.len();
            let usb_count = state.threats.usb_events.len();
            let net_alerts = state.network.alerts.len();
            let fim_unacked = state.fim.alerts.iter().filter(|a| !a.acknowledged).count();
            let total = proc_count + usb_count + net_alerts + fim_unacked;

            let (color, label) = if total == 0 {
                (theme::SUCCESS, "Aucune menace")
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
                    egui::RichText::new(format!("{}", state.fim.monitored_count))
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
                egui::RichText::new(format!("{} modification(s) aujourd'hui", changes))
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
                    egui::RichText::new("alerte(s)")
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
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let total = state.software.packages.len();
            let up_to_date = state.software.packages.iter().filter(|p| p.up_to_date).count();
            let coverage = if total > 0 {
                (up_to_date as f32 / total as f32) * 100.0
            } else {
                100.0
            };

            let color = if coverage >= SOFTWARE_COVERAGE_GOOD {
                theme::SUCCESS
            } else if coverage >= SOFTWARE_COVERAGE_WARN {
                theme::WARNING
            } else {
                theme::ERROR
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{:.0}%", coverage))
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

            ui.add_space(theme::SPACE_XS);
            let outdated = total - up_to_date;
            if outdated > 0 {
                ui.label(
                    egui::RichText::new(format!("{} mise(s) \u{00e0} jour requise(s)", outdated))
                        .font(theme::font_label())
                        .color(theme::readable_color(theme::WARNING)),
                );
            } else {
                ui.label(
                    egui::RichText::new("Tous les composants conformes")
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
                    egui::RichText::new(format!("{}  TENDANCES & INDICATEURS CL\u{00c9}S", icons::CHART_AREA))
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
                        .map(|v| if v == 1 { KpiPeriod::NinetyDays } else { KpiPeriod::ThirtyDays })
                        .unwrap_or(state.kpi.period)
                });

                for period in [KpiPeriod::ThirtyDays, KpiPeriod::NinetyDays] {
                    let active = current_period == period;
                    if widgets::chip_button(ui, period.label_fr(), active, theme::ACCENT).clicked() {
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
                    .map(|v| if v == 1 { KpiPeriod::NinetyDays } else { KpiPeriod::ThirtyDays })
                    .unwrap_or(state.kpi.period)
            });

            let cutoff = chrono::Utc::now()
                - chrono::Duration::seconds(i64::from(selected_period.days()).saturating_mul(SECS_PER_DAY));

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
                let last = filtered.last().expect("filtered is non-empty");
                let current_compliance = format!("{:.0}%", last.compliance_score);
                let current_incidents = last.incident_count.to_string();
                let current_vulns = last.open_vulns.to_string();
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
                                    let (arrow, color) = Self::kpi_trend_arrow(compliance_trend, true);
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
                                    let (arrow, color) = Self::kpi_trend_arrow(incident_trend, false);
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
                                    let sla_color = theme::score_color(current_sla);
                                    egui::Frame::new()
                                        .fill(theme::bg_tertiary().linear_multiply(theme::OPACITY_TINT))
                                        .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
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
                                                    egui::RichText::new(format!("{:.0}%", current_sla))
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
                                                widgets::mini_gauge(ui, current_sla / 100.0, sla_color, KPI_GAUGE_SIZE);
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
            .fill(theme::bg_tertiary().linear_multiply(theme::OPACITY_TINT))
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
            .show(ui, |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(label)
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
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

        let avg_first = first_half.iter().map(|s| extract(s)).sum::<f32>()
            / first_half.len().max(1) as f32;
        let avg_second = second_half.iter().map(|s| extract(s)).sum::<f32>()
            / second_half.len().max(1) as f32;

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

    fn export_dashboard_csv(state: &AppState) {
        let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let headers = &["metrique", "valeur", "unite", "horodatage"];
        let mut rows = vec![
            vec!["Conformit\u{00e9}".to_string(), state.summary.compliance_score.map(|s| format!("{:.1}", s)).unwrap_or_default(), "%".to_string(), timestamp.clone()],
            vec!["CPU".to_string(), format!("{:.1}", state.resources.cpu_percent), "%".to_string(), timestamp.clone()],
            vec!["M\u{00e9}moire".to_string(), format!("{:.1}", state.resources.memory_percent), "%".to_string(), timestamp.clone()],
            vec!["Politiques totales".to_string(), state.policy.total_policies.to_string(), "".to_string(), timestamp.clone()],
            vec!["Politiques conformes".to_string(), state.policy.passing.to_string(), "".to_string(), timestamp.clone()],
        ];

        if let Some(ref vuln) = state.vulnerability_summary {
            rows.push(vec!["Vuln\u{00e9}rabilit\u{00e9}s Critiques".to_string(), vuln.critical.to_string(), "".to_string(), timestamp.clone()]);
            rows.push(vec!["Vuln\u{00e9}rabilit\u{00e9}s \u{00c9}lev\u{00e9}es".to_string(), vuln.high.to_string(), "".to_string(), timestamp]);
        }

        let path = crate::export::default_export_path("dashboard_summary.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}
