//! Dashboard page -- premium AAA overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
#[cfg(feature = "llm_simple")]
use crate::llm_panel::LLMStatusWidget;
use crate::theme;
use crate::widgets;

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Tableau de bord"],
            "Tableau de bord",
            Some("CENTRE DE PILOTAGE GRC"),
            Some(
                "Vue d'ensemble de votre posture de sécurité. Pilotez conformité, vulnérabilités et menaces en temps réel.",
            ),
        );

        ui.add_space(theme::SPACE_MD);

        // ══════════════════════════════════════════════════════════════════
        // ORGANIZATION BANNER (Premium)
        // ══════════════════════════════════════════════════════════════════
        if let Some(cmd) = widgets::org_banner(ui, state) {
            command = Some(cmd);
        }

        ui.add_space(theme::SPACE_LG);

        // ══════════════════════════════════════════════════════════════════
        // SECURITY HERO + COMPLIANCE SCORE (Side by side on large screens)
        // ══════════════════════════════════════════════════════════════════
        let hero_grid = widgets::ResponsiveGrid::new(400.0, theme::SPACE);
        let hero_items = vec![0, 1];

        hero_grid.show(ui, &hero_items, |ui, width, &idx| {
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(width);
                match idx {
                    0 => {
                        // Enhanced Security Hero
                        widgets::security_hero(ui, state);
                    }
                    _ => {
                        // Compliance Score Card with Trend
                        Self::compliance_score_card(ui, state);
                    }
                }
            });
        });

        ui.add_space(theme::SPACE_LG);

        // ══════════════════════════════════════════════════════════════════
        // SPARKLINE METRICS ROW (4 cards)
        // ══════════════════════════════════════════════════════════════════
        let metrics_grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
        let metric_items = vec![0, 1, 2, 3];

        metrics_grid.show(ui, &metric_items, |ui, width, &idx| {
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(width);
                match idx {
                    0 => Self::cpu_sparkline_card(ui, state),
                    1 => Self::memory_sparkline_card(ui, state),
                    2 => Self::checks_summary_card(ui, state),
                    _ => Self::vulnerabilities_summary_card(ui, state),
                }
            });
        });

        ui.add_space(theme::SPACE_LG);

        // ══════════════════════════════════════════════════════════════════
        // COMMAND CENTER + ACTIVITY FEED (Side by side)
        // ══════════════════════════════════════════════════════════════════
        let bottom_grid = widgets::ResponsiveGrid::new(400.0, theme::SPACE);
        let bottom_items = vec![0, 1];

        bottom_grid.show(ui, &bottom_items, |ui, width, &idx| {
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(width);
                match idx {
                    0 => {
                        if let Some(cmd) = Self::command_center(ui, state) {
                            command = Some(cmd);
                        }
                    }
                    _ => {
                        widgets::card(ui, |ui: &mut egui::Ui| {
                            widgets::activity_feed(ui, state, 5);
                        });
                    }
                }
            });
        });

        ui.add_space(theme::SPACE_XL);
        command
    }

    // ──────────────────────────────────────────────────────────────────────
    // COMPLIANCE SCORE CARD
    // ──────────────────────────────────────────────────────────────────────
    fn compliance_score_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("INDICE DE CONFORMITÉ GLOBAL")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                // Gauge
                widgets::compliance_gauge(ui, state.summary.compliance_score, 48.0);

                ui.add_space(theme::SPACE_SM);

                // Trend indicator
                if let (Some(current), Some(previous)) = (
                    state.summary.compliance_score,
                    state.previous_compliance_score,
                ) {
                    let diff = current - previous;
                    let (arrow, color, text) = if diff > 0.5 {
                        ("▲", theme::SUCCESS, format!("+{:.1}%", diff))
                    } else if diff < -0.5 {
                        ("▼", theme::ERROR, format!("{:.1}%", diff))
                    } else {
                        ("→", theme::text_tertiary(), "stable".to_string())
                    };

                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(arrow)
                                .font(theme::font_body())
                                .color(color),
                        );
                        ui.label(
                            egui::RichText::new(text)
                                .font(theme::font_min())
                                .color(color),
                        );
                        ui.label(
                            egui::RichText::new("vs précédent")
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                        );
                    });
                }

                // Frameworks active
                if let Some(ref frameworks) = state.summary.active_frameworks
                    && !frameworks.is_empty()
                {
                    ui.add_space(theme::SPACE_SM);
                    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                        for fw in frameworks.iter().take(3) {
                            widgets::status_badge(ui, fw, theme::ACCENT);
                            ui.add_space(theme::SPACE_XS);
                        }
                    });
                }
            });
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // CPU SPARKLINE CARD
    // ──────────────────────────────────────────────────────────────────────
    fn cpu_sparkline_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            let config = widgets::SparklineConfig {
                color: theme::ACCENT,
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque→Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let cpu_data: Vec<[f64; 2]> = state.monitoring.cpu_history.iter().copied().collect();
            widgets::sparkline_with_value(
                ui,
                "CPU",
                &format!("{:.1}%", state.resources.cpu_percent),
                &cpu_data,
                &config,
            );
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // MEMORY SPARKLINE CARD
    // ──────────────────────────────────────────────────────────────────────
    fn memory_sparkline_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            let config = widgets::SparklineConfig {
                color: theme::INFO,
                fill: true,
                show_trend: true,
                show_stats: false,
            };

            // PERF: VecDeque→Vec copy every frame; cost is minimal (~300 * 16 = 4.8KB).
            let mem_data: Vec<[f64; 2]> = state.monitoring.memory_history.iter().copied().collect();
            widgets::sparkline_with_value(
                ui,
                "MÉMOIRE",
                &format!("{:.1}%", state.resources.memory_percent),
                &mem_data,
                &config,
            );
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // CHECKS SUMMARY CARD
    // ──────────────────────────────────────────────────────────────────────
    fn checks_summary_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("CONTRÔLES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            let total = state.policy.total_policies;
            let passing = state.policy.passing;

            // Big number
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

            // Progress bar
            let fraction = if total > 0 {
                passing as f32 / total as f32
            } else {
                0.0
            };
            Self::mini_progress_bar(ui, fraction, theme::SUCCESS);

            ui.add_space(theme::SPACE_XS);

            // Status text
            let status_text = if state.policy.failing > 0 {
                format!("{} échec(s)", state.policy.failing)
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
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // VULNERABILITIES SUMMARY CARD
    // ──────────────────────────────────────────────────────────────────────
    fn vulnerabilities_summary_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("VULNÉRABILITÉS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            if let Some(ref vuln) = state.vulnerability_summary {
                let total = vuln.critical + vuln.high + vuln.medium + vuln.low;

                // Critical count (highlighted if > 0)
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

                // Mini stats row
                ui.horizontal(|ui: &mut egui::Ui| {
                    Self::mini_stat(ui, &format!("{}", vuln.high), "élevées", theme::WARNING);
                    ui.add_space(theme::SPACE_SM);
                    Self::mini_stat(ui, &format!("{}", total), "total", theme::text_secondary());
                });
            } else {
                // No scan yet
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icons::SHIELD_CHECK)
                            .size(20.0)
                            .color(theme::text_tertiary()),
                    );
                    ui.label(
                        egui::RichText::new("Scan requis")
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // COMMAND CENTER
    // ──────────────────────────────────────────────────────────────────────
    fn command_center(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::BOLT)
                        .size(12.0)
                        .color(theme::ACCENT),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new("CENTRE DE COMMANDE")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
            });

            ui.add_space(theme::SPACE_MD);

            // Action buttons row
            ui.horizontal(|ui: &mut egui::Ui| {
                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                if widgets::button::primary_button_loading(
                    ui,
                    format!(
                        "{}  {}",
                        icons::PLAY,
                        if is_scanning {
                            "SCAN EN COURS..."
                        } else {
                            "SCAN"
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
                if widgets::button::secondary_button_loading(
                    ui,
                    format!(
                        "{}  {}",
                        icons::SYNC,
                        if is_syncing {
                            "SYNCHRONISATION..."
                        } else {
                            "SYNCHRONISER"
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
                    format!("{}  EXPORTER", icons::DOWNLOAD),
                    true,
                    false,
                )
                .clicked()
                {
                    Self::export_dashboard_csv(state);
                }
            });

            ui.add_space(theme::SPACE_LG);

            // Recent actions / status
            ui.label(
                egui::RichText::new("ÉTAT DU SYSTÈME")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong(),
            );

            ui.add_space(theme::SPACE_SM);

            // Status items
            Self::status_item(
                ui,
                icons::CHECK,
                "Agent",
                match state.summary.status {
                    GuiAgentStatus::Connected => "Opérationnel",
                    GuiAgentStatus::Scanning => "Analyse en cours",
                    GuiAgentStatus::Syncing => "Synchronisation",
                    GuiAgentStatus::Disconnected => "Déconnecté",
                    GuiAgentStatus::Paused => "Suspendu",
                    _ => "En attente",
                },
                match state.summary.status {
                    GuiAgentStatus::Connected => theme::SUCCESS,
                    GuiAgentStatus::Scanning | GuiAgentStatus::Syncing => theme::INFO,
                    GuiAgentStatus::Disconnected => theme::WARNING,
                    GuiAgentStatus::Error => theme::ERROR,
                    _ => theme::text_tertiary(),
                },
            );

            if let Some(last_check) = state.summary.last_check_at {
                let elapsed = chrono::Utc::now().signed_duration_since(last_check);
                let elapsed_text = if elapsed.num_minutes() < 1 {
                    "à l'instant".to_string()
                } else if elapsed.num_minutes() < 60 {
                    format!("il y a {} min", elapsed.num_minutes())
                } else {
                    format!("il y a {}h", elapsed.num_hours())
                };
                Self::status_item(
                    ui,
                    icons::CLOCK,
                    "Dernier scan",
                    &elapsed_text,
                    theme::text_secondary(),
                );
            }

            // Uptime
            let uptime_hours = state.summary.uptime_secs / 3600;
            let uptime_mins = (state.summary.uptime_secs % 3600) / 60;
            Self::status_item(
                ui,
                icons::BOLT,
                "Uptime",
                &format!("{}h {}m", uptime_hours, uptime_mins),
                theme::ACCENT,
            );

            // LLM Status
            #[cfg(feature = "llm_simple")]
            {
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new("INTELLIGENCE IA")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                let llm_widget = LLMStatusWidget::new(None);
                llm_widget.show(ui);
            }
        });

        command
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
            let rounding = egui::CornerRadius::same(2);

            // Track
            painter.rect_filled(rect, rounding, theme::bg_tertiary());

            // Fill
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

    fn status_item(ui: &mut Ui, icon: &str, label: &str, value: &str, color: egui::Color32) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(egui::RichText::new(icon).size(10.0).color(color));
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_secondary()),
            );
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(value)
                            .font(theme::font_label())
                            .color(color),
                    );
                },
            );
        });
        ui.add_space(theme::SPACE_XS);
    }

    fn export_dashboard_csv(state: &AppState) {
        let headers = &["metrique", "valeur", "unite"];
        let mut rows = vec![
            vec!["Conformité".to_string(), state.summary.compliance_score.map(|s| format!("{:.1}", s)).unwrap_or_default(), "%".to_string()],
            vec!["CPU".to_string(), format!("{:.1}", state.resources.cpu_percent), "%".to_string()],
            vec!["Mémoire".to_string(), format!("{:.1}", state.resources.memory_percent), "%".to_string()],
            vec!["Politiques totales".to_string(), state.policy.total_policies.to_string(), "".to_string()],
            vec!["Politiques conformes".to_string(), state.policy.passing.to_string(), "".to_string()],
        ];

        if let Some(ref vuln) = state.vulnerability_summary {
            rows.push(vec!["Vulnérabilités Critiques".to_string(), vuln.critical.to_string(), "".to_string()]);
            rows.push(vec!["Vulnérabilités Élevées".to_string(), vuln.high.to_string(), "".to_string()]);
        }

        let path = crate::export::default_export_path("dashboard_summary.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}
