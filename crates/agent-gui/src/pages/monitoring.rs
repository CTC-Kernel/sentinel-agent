// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Surveillance & SIEM page -- premium AAA monitoring dashboard.
//!
//! Integrates real-time resource monitoring with SIEM log collection,
//! event analytics, and security statistics. Features three operational
//! views: Resources, SIEM Journal, and Statistics.

use egui::{RichText, Ui};
use egui_plot::{Line, Plot, PlotPoints};
use tracing::info;

use crate::app::AppState;
use crate::dto::{SiemLogSeverity, SiemLogSource};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

// ── Constants ───────────────────────────────────────────────────────────────
#[allow(dead_code)]
const RESOURCE_CRITICAL_THRESHOLD: f64 = 90.0;
#[allow(dead_code)]
const RESOURCE_WARNING_THRESHOLD: f64 = 70.0;
#[allow(dead_code)]
const CHART_HEIGHT: f32 = 190.0;
const SUMMARY_CARD_MIN_HEIGHT: f32 = theme::SUMMARY_CARD_MIN_HEIGHT;
const LOGS_PER_PAGE: usize = 50;

pub struct MonitoringPage;

impl MonitoringPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Surveillance"],
            "Surveillance & SIEM",
            Some("CENTRE DE SURVEILLANCE TEMPS RÉEL ET INTÉGRATION SIEM"),
            Some(
                "Monitoring des ressources système, collecte et analyse des journaux de sécurité, statistiques d'événements SIEM.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Tab bar with action buttons
        ui.horizontal(|ui: &mut egui::Ui| {
            let tab_defs: &[(&str, &str)] = &[
                (icons::DATABASE, "Journal SIEM"),
                (icons::CHART_AREA, "Statistiques"),
            ];

            for (i, (icon, label)) in tab_defs.iter().enumerate() {
                let active = state.monitoring.active_tab == i;
                let text = format!("{}  {}", icon, label);
                if widgets::chip_button(ui, &text, active, theme::ACCENT).clicked() {
                    state.monitoring.active_tab = i;
                }
                ui.add_space(theme::SPACE_XS);
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::button::secondary_button(
                        ui,
                        format!("{}  CSV", icons::DOWNLOAD),
                        true,
                    )
                    .clicked()
                    {
                        Self::export_metrics_csv(state);
                    }
                },
            );
        });
        ui.add_space(theme::SPACE_LG);

        match state.monitoring.active_tab {
            0 => command = Self::siem_logs_tab(ui, state),
            1 => Self::siem_stats_tab(ui, state),
            _ => {}
        }

        ui.add_space(theme::SPACE_XL);
        command
    }

    // ════════════════════════════════════════════════════════════════════════
    // SIEM Logs Tab
    // ════════════════════════════════════════════════════════════════════════

    fn siem_logs_tab(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let command = None;

        // Check if SIEM features are enabled
        let siem_active = state.settings.siem_enabled || state.settings.log_collector_enabled;

        if !siem_active {
            Self::siem_disabled_state(ui);
            return None;
        }

        // ── Status bar ─────────────────────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Connection status
                let (status_icon, status_label, status_color) = if state.siem.stats.connected {
                    (icons::CIRCLE_CHECK, "CONNECTÉ", theme::SUCCESS)
                } else if state.settings.siem_enabled {
                    (icons::WARNING, "DÉCONNECTÉ", theme::WARNING)
                } else {
                    (icons::INFO_CIRCLE, "COLLECTE LOCALE", theme::INFO)
                };
                ui.label(
                    RichText::new(format!("{}  {}", status_icon, status_label))
                        .font(theme::font_label())
                        .color(theme::readable_color(status_color))
                        .strong()
                        .extra_letter_spacing(theme::TRACKING_TIGHT),
                );

                ui.add_space(theme::SPACE_LG);

                // Event count
                ui.label(
                    RichText::new(format!(
                        "{}  {} événements",
                        icons::DATABASE,
                        state.siem.log_entries.len()
                    ))
                    .font(theme::font_label())
                    .color(theme::text_secondary()),
                );

                ui.add_space(theme::SPACE_LG);

                // EPS rate
                if state.siem.stats.events_per_minute > 0.0 {
                    ui.label(
                        RichText::new(format!(
                            "{}  {:.1} evt/min",
                            icons::BOLT,
                            state.siem.stats.events_per_minute
                        ))
                        .font(theme::font_label())
                        .color(theme::text_secondary()),
                    );
                }

                // Right side: auto-scroll toggle
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            RichText::new("AUTO")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                        widgets::toggle_switch(ui, &mut state.siem.auto_scroll);
                    },
                );
            });
        });

        ui.add_space(theme::SPACE_SM);

        // ── Search and filters ─────────────────────────────────────────────
        ui.horizontal(|ui: &mut egui::Ui| {
            // Search input
            let search_width = (ui.available_width() - 300.0).max(200.0);
            ui.add_sized(
                [search_width, theme::MIN_TOUCH_TARGET],
                egui::TextEdit::singleline(&mut state.siem.search)
                    .hint_text(format!(
                        "{}  Rechercher dans les journaux...",
                        icons::SEARCH
                    ))
                    .font(theme::font_body()),
            );

            ui.add_space(theme::SPACE_SM);

            // Source filter dropdown
            let source_label = state
                .siem
                .source_filter
                .map(|s| s.label())
                .unwrap_or("Source");
            if widgets::chip_button(
                ui,
                &format!("{}  {}", icons::FILTER, source_label),
                state.siem.source_filter.is_some(),
                theme::INFO,
            )
            .clicked()
            {
                // Cycle through sources: None -> System -> Auth -> App -> Firewall -> None
                state.siem.source_filter = match state.siem.source_filter {
                    None => Some(SiemLogSource::System),
                    Some(SiemLogSource::System) => Some(SiemLogSource::Auth),
                    Some(SiemLogSource::Auth) => Some(SiemLogSource::Application),
                    Some(SiemLogSource::Application) => Some(SiemLogSource::Firewall),
                    Some(SiemLogSource::Firewall) => None,
                };
                state.siem.logs_page = 0;
            }

            ui.add_space(theme::SPACE_XS);

            // Severity filter
            let severity_label = state
                .siem
                .severity_filter
                .map(|s| s.full_label())
                .unwrap_or("Sévérité");
            if widgets::chip_button(
                ui,
                &format!("{}  {}", icons::WARNING, severity_label),
                state.siem.severity_filter.is_some(),
                theme::WARNING,
            )
            .clicked()
            {
                state.siem.severity_filter = match state.siem.severity_filter {
                    None => Some(SiemLogSeverity::Critical),
                    Some(SiemLogSeverity::Critical) => Some(SiemLogSeverity::Error),
                    Some(SiemLogSeverity::Error) => Some(SiemLogSeverity::Warning),
                    Some(SiemLogSeverity::Warning) => Some(SiemLogSeverity::Notice),
                    Some(SiemLogSeverity::Notice) => Some(SiemLogSeverity::Info),
                    Some(SiemLogSeverity::Info) => None,
                };
                state.siem.logs_page = 0;
            }

            // Clear filters
            if state.siem.source_filter.is_some()
                || state.siem.severity_filter.is_some()
                || !state.siem.search.is_empty()
            {
                ui.add_space(theme::SPACE_XS);
                if widgets::ghost_button(ui, format!("{}  Réinitialiser", icons::XMARK)).clicked()
                {
                    state.siem.source_filter = None;
                    state.siem.severity_filter = None;
                    state.siem.search.clear();
                    state.siem.logs_page = 0;
                }
            }
        });

        ui.add_space(theme::SPACE_SM);

        // ── Log well ───────────────────────────────────────────────────────
        let search_lower = state.siem.search.to_lowercase();
        let filtered: Vec<&crate::dto::GuiSiemLogEntry> = state
            .siem
            .log_entries
            .iter()
            .filter(|e| {
                if let Some(src) = state.siem.source_filter
                    && e.source != src
                {
                    return false;
                }
                if let Some(sev) = state.siem.severity_filter
                    && e.severity < sev
                {
                    return false;
                }
                if !search_lower.is_empty() {
                    let msg_lower = e.message.to_lowercase();
                    let cat_lower = e.category.to_lowercase();
                    if !msg_lower.contains(&search_lower) && !cat_lower.contains(&search_lower) {
                        return false;
                    }
                }
                true
            })
            .collect();

        let total = filtered.len();
        let total_pages = (total + LOGS_PER_PAGE - 1).max(1) / LOGS_PER_PAGE.max(1);
        if state.siem.logs_page >= total_pages {
            state.siem.logs_page = total_pages.saturating_sub(1);
        }

        let page_start = state.siem.logs_page * LOGS_PER_PAGE;
        let page_entries: Vec<&&crate::dto::GuiSiemLogEntry> = filtered
            .iter()
            .skip(page_start)
            .take(LOGS_PER_PAGE)
            .collect();

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                RichText::new(format!(
                    "JOURNAL DES ÉVÉNEMENTS  —  {} résultat{}",
                    total,
                    if total != 1 { "s" } else { "" }
                ))
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            if page_entries.is_empty() {
                ui.add_space(theme::SPACE_LG);
                widgets::empty_state_compact(
                    ui,
                    icons::DATABASE,
                    "Aucun événement — les événements SIEM apparaîtront ici en temps réel.",
                );
                ui.add_space(theme::SPACE_LG);
            } else {
                // Log table
                let available_w = ui.available_width();
                let time_w = 70.0_f32;
                let sev_w = 42.0_f32;
                let src_w = 90.0_f32;
                let msg_w =
                    (available_w - time_w - sev_w - src_w - theme::SPACE_SM * 4.0).max(150.0);

                // Header row
                ui.horizontal(|ui: &mut egui::Ui| {
                    let header_style = |text: &str| -> RichText {
                        RichText::new(text)
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(theme::TRACKING_TIGHT)
                    };
                    ui.add_sized([time_w, 16.0], egui::Label::new(header_style("HEURE")));
                    ui.add_sized([sev_w, 16.0], egui::Label::new(header_style("SEV")));
                    ui.add_sized([src_w, 16.0], egui::Label::new(header_style("SOURCE")));
                    ui.add_sized([msg_w, 16.0], egui::Label::new(header_style("MESSAGE")));
                });

                widgets::divider_thin(ui);

                // Log entries
                egui::ScrollArea::vertical()
                    .id_salt("siem_log_well")
                    .max_height(450.0)
                    .auto_shrink(false)
                    .stick_to_bottom(state.siem.auto_scroll)
                    .show(ui, |ui: &mut egui::Ui| {
                        for entry in &page_entries {
                            let is_selected = state
                                .siem
                                .selected_log
                                .map(|idx| {
                                    state
                                        .siem
                                        .log_entries
                                        .get(idx)
                                        .map(|e| e.id == entry.id)
                                        .unwrap_or(false)
                                })
                                .unwrap_or(false);

                            let row_bg = if is_selected {
                                theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE)
                            } else {
                                egui::Color32::TRANSPARENT
                            };

                            egui::Frame::new()
                                .fill(row_bg)
                                .inner_margin(egui::Margin::symmetric(0, 2))
                                .show(ui, |ui: &mut egui::Ui| {
                                    ui.horizontal(|ui: &mut egui::Ui| {
                                        ui.set_min_height(24.0);

                                        // Time
                                        let time_str =
                                            entry.timestamp.format("%H:%M:%S").to_string();
                                        ui.add_sized(
                                            [time_w, 20.0],
                                            egui::Label::new(
                                                RichText::new(&time_str)
                                                    .font(theme::font_mono_sm())
                                                    .color(theme::text_tertiary()),
                                            ),
                                        );

                                        // Severity badge
                                        let (sev_color, sev_label) =
                                            Self::severity_style(&entry.severity);
                                        let badge_variant = match entry.severity {
                                            SiemLogSeverity::Critical | SiemLogSeverity::Error => {
                                                widgets::badge::BadgeVariant::Error
                                            }
                                            SiemLogSeverity::Warning => {
                                                widgets::badge::BadgeVariant::Warning
                                            }
                                            SiemLogSeverity::Notice => {
                                                widgets::badge::BadgeVariant::Info
                                            }
                                            SiemLogSeverity::Info => {
                                                widgets::badge::BadgeVariant::Neutral
                                            }
                                        };
                                        let _ = sev_color; // used for future enhancements
                                        ui.add_sized([sev_w, 20.0], |ui: &mut egui::Ui| {
                                            widgets::badge_variant(ui, sev_label, badge_variant)
                                        });

                                        // Source
                                        ui.add_sized(
                                            [src_w, 20.0],
                                            egui::Label::new(
                                                RichText::new(entry.source.label())
                                                    .font(theme::font_label())
                                                    .color(theme::text_secondary()),
                                            ),
                                        );

                                        // Message (truncated) — use char boundary to avoid UTF-8 panic
                                        let msg_display = if entry.message.len() > 120 {
                                            let mut end = 120;
                                            while !entry.message.is_char_boundary(end) {
                                                end -= 1;
                                            }
                                            format!("{}…", &entry.message[..end])
                                        } else {
                                            entry.message.clone()
                                        };
                                        ui.add_sized(
                                            [msg_w, 20.0],
                                            egui::Label::new(
                                                RichText::new(&msg_display)
                                                    .font(theme::font_mono_sm())
                                                    .color(theme::text_primary()),
                                            )
                                            .truncate(),
                                        );
                                    });
                                });

                            // Subtle separator
                            let rect = ui.max_rect();
                            let sep_y = ui.cursor().top();
                            ui.painter().hline(
                                rect.left()..=rect.right(),
                                sep_y,
                                egui::Stroke::new(
                                    theme::BORDER_HAIRLINE,
                                    theme::separator().linear_multiply(0.3),
                                ),
                            );
                        }
                    });
            }
        });

        // Pagination
        if total_pages > 1 {
            ui.add_space(theme::SPACE_SM);
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.with_layout(
                    egui::Layout::centered_and_justified(egui::Direction::LeftToRight),
                    |ui: &mut egui::Ui| {
                        let mut pag_state = widgets::PaginationState::new(total, LOGS_PER_PAGE);
                        pag_state.current_page = state.siem.logs_page + 1; // 1-indexed
                        pag_state.total_pages = total_pages;
                        if widgets::pagination_compact(ui, &mut pag_state) {
                            state.siem.logs_page = pag_state.current_page.saturating_sub(1); // back to 0-indexed
                        }
                    },
                );
            });
        }

        // Request periodic repaint for real-time updates
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(2000));

        command
    }

    // ════════════════════════════════════════════════════════════════════════
    // SIEM Statistics Tab
    // ════════════════════════════════════════════════════════════════════════

    fn siem_stats_tab(ui: &mut Ui, state: &AppState) {
        let siem_active = state.settings.siem_enabled || state.settings.log_collector_enabled;

        if !siem_active {
            Self::siem_disabled_state(ui);
            return;
        }

        let stats = &state.siem.stats;

        // ── KPI cards ──────────────────────────────────────────────────────
        let stats_grid = widgets::ResponsiveGrid::new(220.0, theme::SPACE_SM);
        let stats_items = vec![
            (
                "ÉVÉNEMENTS ENVOYÉS",
                Self::format_large_number(stats.events_sent),
                theme::SUCCESS,
                icons::CLOUD_ARROW_UP,
            ),
            (
                "ÉVÉNEMENTS PERDUS",
                Self::format_large_number(stats.events_dropped),
                if stats.events_dropped > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::WARNING,
            ),
            (
                "TAMPON EN COURS",
                format!("{}", stats.events_buffered),
                theme::INFO,
                icons::DATABASE,
            ),
            (
                "DÉBIT (evt/min)",
                format!("{:.1}", stats.events_per_minute),
                theme::accent_text(),
                icons::BOLT,
            ),
        ];

        stats_grid.show(
            ui,
            &stats_items,
            |ui, width, (label, value, color, icon)| {
                Self::summary_card(ui, width, label, value, *color, icon);
            },
        );

        ui.add_space(theme::SPACE_LG);

        // ── Connection & Config status ─────────────────────────────────────
        let info_grid = widgets::ResponsiveGrid::new(450.0, theme::SPACE_LG);
        let info_items = vec![("connection", 0), ("distribution", 1)];

        info_grid.show(ui, &info_items, |ui, width, (_key, idx)| {
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(width);
                match idx {
                    0 => Self::connection_status_card(ui, state),
                    1 => Self::category_distribution_card(ui, stats),
                    _ => {}
                }
            });
        });

        ui.add_space(theme::SPACE_LG);

        // ── Hardware Resources ─────────────────────────────────────────────
        let cpu_data: Vec<[f64; 2]> = state.monitoring.cpu_history.iter().copied().collect();
        let mem_data: Vec<[f64; 2]> = state.monitoring.memory_history.iter().copied().collect();
        let cpu_current = cpu_data.last().copied().unwrap_or([0.0, 0.0])[1];
        let mem_current = mem_data.last().copied().unwrap_or([0.0, 0.0])[1];

        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.set_width((ui.available_width() - theme::SPACE_MD) / 2.0);
                Self::premium_chart_card(
                    ui,
                    "PROCESSEUR (CPU)",
                    "%",
                    &cpu_data,
                    Self::usage_color(cpu_current),
                    false, // Percentage based (0-100)
                );
            });
            ui.add_space(theme::SPACE_MD);
            ui.vertical(|ui| {
                Self::premium_chart_card(
                    ui,
                    "MÉMOIRE (RAM)",
                    "%",
                    &mem_data,
                    Self::usage_color(mem_current),
                    false, // Percentage based
                );
            });
        });

        ui.add_space(theme::SPACE_LG);

        // ── Forwarding config summary ──────────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                RichText::new("CONFIGURATION DU TRANSFERT")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                Self::config_pill(ui, "FORMAT", &state.settings.siem_format);
                ui.add_space(theme::SPACE_MD);
                Self::config_pill(ui, "TRANSPORT", &state.settings.siem_transport);
                ui.add_space(theme::SPACE_MD);
                let dest = if state.settings.siem_destination.is_empty() {
                    "Non configuré"
                } else {
                    &state.settings.siem_destination
                };
                Self::config_pill(ui, "DESTINATION", dest);
            });

            if let Some(last) = stats.last_sent_at {
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    RichText::new(format!(
                        "Dernier envoi : {}",
                        last.format("%d/%m/%Y %H:%M:%S UTC")
                    ))
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
                );
            }
        });

        // Periodic repaint
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(5000));
    }

    // ════════════════════════════════════════════════════════════════════════
    // Premium Chart Card (reserved for future dashboard upgrade)
    // ════════════════════════════════════════════════════════════════════════

    #[allow(dead_code)]
    fn premium_chart_card(
        ui: &mut Ui,
        title: &str,
        unit: &str,
        history: &[[f64; 2]],
        line_color: egui::Color32,
        auto_y: bool,
    ) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            // ── Header with live indicator ──────────────────────────────────
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    RichText::new(title)
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong()
                        .extra_letter_spacing(theme::TRACKING_NORMAL),
                );

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if !history.is_empty() {
                            let dot_color = if theme::is_reduced_motion() {
                                theme::readable_color(theme::SUCCESS)
                            } else {
                                let time = ui.input(|i| i.time);
                                let pulse = ((time * 1.5).sin() * 0.5 + 0.5) as f32;
                                theme::readable_color(theme::SUCCESS)
                                    .linear_multiply(0.5 + pulse * 0.5)
                            };
                            ui.label(RichText::new("●").size(theme::ICON_MICRO).color(dot_color));
                            if !theme::is_reduced_motion() {
                                ui.ctx().request_repaint();
                            }
                        }
                    },
                );
            });

            ui.add_space(theme::SPACE_XS);

            if history.is_empty() {
                Self::empty_chart_state(ui, CHART_HEIGHT);
                return;
            }

            let values: Vec<f64> = history.iter().map(|p| p[1]).collect();
            let current = values.last().copied().unwrap_or(0.0);
            let min_val = values
                .iter()
                .copied()
                .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                .unwrap_or(0.0);
            let max_val = values
                .iter()
                .copied()
                .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
                .unwrap_or(0.0);
            let avg_val = if values.is_empty() {
                0.0
            } else {
                values.iter().sum::<f64>() / values.len() as f64
            };

            // ── Current value display ──────────────────────────────────────
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    RichText::new(format!("{:.1}", current))
                        .font(theme::font_card_value())
                        .color(line_color)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        RichText::new(unit)
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                });
            });

            ui.add_space(theme::SPACE_XS);

            // ── Chart ──────────────────────────────────────────────────────
            let chart_height = CHART_HEIGHT - 80.0;

            let mut plot = Plot::new(egui::Id::new(format!("prem_chart_{}", title)))
                .height(chart_height)
                .include_y(0.0)
                .allow_drag(false)
                .allow_zoom(false)
                .allow_scroll(false)
                .allow_boxed_zoom(false)
                .allow_double_click_reset(false)
                .show_axes(egui::Vec2b::new(false, false))
                .show_grid(egui::Vec2b::new(false, true))
                .auto_bounds(egui::Vec2b::new(true, true))
                .show_background(false);

            if !auto_y {
                plot = plot.include_y(100.0);
            }

            let current_time = ui.ctx().input(|i| i.time);
            let history_pts = history.to_vec();
            let is_pct = !auto_y;

            plot.show(ui, |plot_ui| {
                // Threshold reference lines (only for percentage charts)
                if is_pct {
                    // Warning threshold (70%)
                    let warn_pts = vec![
                        [
                            history_pts.first().map(|p| p[0]).unwrap_or(0.0),
                            RESOURCE_WARNING_THRESHOLD,
                        ],
                        [
                            history_pts.last().map(|p| p[0]).unwrap_or(1.0),
                            RESOURCE_WARNING_THRESHOLD,
                        ],
                    ];
                    plot_ui.line(
                        Line::new(PlotPoints::new(warn_pts))
                            .color(theme::WARNING.linear_multiply(0.2))
                            .width(0.5)
                            .style(egui_plot::LineStyle::dashed_dense()),
                    );

                    // Critical threshold (90%)
                    let crit_pts = vec![
                        [
                            history_pts.first().map(|p| p[0]).unwrap_or(0.0),
                            RESOURCE_CRITICAL_THRESHOLD,
                        ],
                        [
                            history_pts.last().map(|p| p[0]).unwrap_or(1.0),
                            RESOURCE_CRITICAL_THRESHOLD,
                        ],
                    ];
                    plot_ui.line(
                        Line::new(PlotPoints::new(crit_pts))
                            .color(theme::ERROR.linear_multiply(0.2))
                            .width(0.5)
                            .style(egui_plot::LineStyle::dashed_dense()),
                    );
                }

                // Gradient fill under curve
                plot_ui.line(
                    Line::new(PlotPoints::new(history_pts.clone()))
                        .color(line_color.linear_multiply(theme::OPACITY_SUBTLE))
                        .fill(0.0),
                );

                // Main data line
                plot_ui.line(
                    Line::new(PlotPoints::new(history_pts))
                        .color(line_color)
                        .width(1.8),
                );

                // Current value point with glow
                if let Some(&latest) = history.last() {
                    let pulse = if theme::is_reduced_motion() {
                        0.5
                    } else {
                        ((current_time * 2.5).sin() * 0.5 + 0.5) as f32
                    };

                    // Outer glow
                    plot_ui.points(
                        egui_plot::Points::new(PlotPoints::new(vec![latest]))
                            .color(line_color.linear_multiply(0.15 + pulse * 0.15))
                            .radius(6.0),
                    );

                    // Core point
                    plot_ui.points(
                        egui_plot::Points::new(PlotPoints::new(vec![latest]))
                            .color(line_color)
                            .radius(2.5),
                    );
                }
            });

            ui.add_space(theme::SPACE_XS);

            // ── Statistics bar ──────────────────────────────────────────────
            ui.horizontal(|ui: &mut egui::Ui| {
                let stat_style = |label: &str, value: f64| -> (String, egui::Color32) {
                    (format!("{}  {:.1}", label, value), theme::text_tertiary())
                };

                let (min_text, min_color) = stat_style("MIN", min_val);
                let (avg_text, avg_color) = stat_style("MOY", avg_val);
                let (max_text, max_color) = stat_style("MAX", max_val);

                for (text, color) in [
                    (min_text, min_color),
                    (avg_text, avg_color),
                    (max_text, max_color),
                ] {
                    ui.label(
                        RichText::new(text)
                            .font(theme::font_label())
                            .color(color)
                            .strong()
                            .extra_letter_spacing(theme::TRACKING_TIGHT),
                    );
                    ui.add_space(theme::SPACE_MD);
                }
            });
        });

        // Repaint for chart animation
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(1000));
    }

    // ════════════════════════════════════════════════════════════════════════
    // Sub-components
    // ════════════════════════════════════════════════════════════════════════

    fn connection_status_card(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                RichText::new("ÉTAT DE LA CONNEXION")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            // Connection status indicator
            let stats = &state.siem.stats;
            let (status_text, status_color) = if stats.connected {
                ("Connecté au SIEM distant", theme::SUCCESS)
            } else if state.settings.siem_enabled {
                ("En attente de connexion...", theme::WARNING)
            } else {
                ("Transfert SIEM désactivé", theme::text_tertiary())
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                let dot_size = 10.0_f32;
                let (dot_rect, _) =
                    ui.allocate_exact_size(egui::vec2(dot_size, dot_size), egui::Sense::hover());
                ui.painter().circle_filled(
                    dot_rect.center(),
                    dot_size / 2.0,
                    theme::readable_color(status_color),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    RichText::new(status_text)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                );
            });

            ui.add_space(theme::SPACE_MD);

            // Log collector status
            let collector_status = if state.settings.log_collector_enabled {
                let sources: Vec<&str> = state
                    .settings
                    .log_collector_sources
                    .iter()
                    .map(|s| s.as_str())
                    .collect();
                format!(
                    "Collecteur actif — sources : {}",
                    if sources.is_empty() {
                        "aucune".to_string()
                    } else {
                        sources.join(", ")
                    }
                )
            } else {
                "Collecteur de logs désactivé".to_string()
            };

            ui.label(
                RichText::new(collector_status)
                    .font(theme::font_label())
                    .color(theme::text_secondary()),
            );

            if stats.uptime_secs > 0 {
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    RichText::new(format!(
                        "Uptime SIEM : {}",
                        Self::format_uptime(stats.uptime_secs)
                    ))
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
                );
            }
        });
    }

    fn category_distribution_card(ui: &mut Ui, stats: &crate::dto::GuiSiemStats) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                RichText::new("RÉPARTITION PAR CATÉGORIE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if stats.category_counts.is_empty() {
                widgets::empty_state_compact(
                    ui,
                    icons::CHART_PIE,
                    "Aucune donnée — les catégories d'événements apparaîtront ici.",
                );
            } else {
                let total: u32 = stats.category_counts.iter().map(|(_, c)| c).sum();
                let colors = [
                    theme::ACCENT,
                    theme::SUCCESS,
                    theme::WARNING,
                    theme::INFO,
                    theme::ERROR,
                    theme::SEVERITY_MEDIUM,
                ];

                for (i, (category, count)) in stats.category_counts.iter().enumerate() {
                    let pct = if total > 0 {
                        *count as f32 / total as f32
                    } else {
                        0.0
                    };
                    let bar_color = colors[i % colors.len()];

                    ui.horizontal(|ui: &mut egui::Ui| {
                        // Category label
                        ui.add_sized(
                            [100.0, 20.0],
                            egui::Label::new(
                                RichText::new(category)
                                    .font(theme::font_label())
                                    .color(theme::text_secondary())
                                    .strong(),
                            ),
                        );

                        // Progress bar
                        let bar_width = (ui.available_width() - 60.0).max(50.0);
                        let (bar_rect, _) = ui
                            .allocate_exact_size(egui::vec2(bar_width, 14.0), egui::Sense::hover());

                        if ui.is_rect_visible(bar_rect) {
                            let painter = ui.painter_at(bar_rect);
                            // Background
                            painter.rect_filled(
                                bar_rect,
                                egui::CornerRadius::same(3),
                                theme::bg_tertiary(),
                            );
                            // Fill
                            let fill_rect = egui::Rect::from_min_size(
                                bar_rect.min,
                                egui::vec2(bar_rect.width() * pct, bar_rect.height()),
                            );
                            painter.rect_filled(fill_rect, egui::CornerRadius::same(3), bar_color);
                        }

                        // Count
                        ui.label(
                            RichText::new(format!("{}", count))
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });

                    ui.add_space(theme::SPACE_XS);
                }
            }
        });
    }

    fn siem_disabled_state(ui: &mut Ui) {
        ui.add_space(theme::SPACE_XL);
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.add_space(theme::SPACE_LG);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.label(
                    RichText::new(icons::SHARE_NODES)
                        .size(48.0)
                        .color(theme::text_tertiary().linear_multiply(0.5)),
                );
                ui.add_space(theme::SPACE_MD);
                ui.label(
                    RichText::new("Intégration SIEM désactivée")
                        .font(theme::font_heading())
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    RichText::new(
                        "Activez le collecteur de logs ou le transfert SIEM dans les paramètres pour accéder au journal des événements et aux statistiques.",
                    )
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_LG);
                ui.label(
                    RichText::new(format!("{}  Configuration > Intégration SIEM", icons::SETTINGS))
                        .font(theme::font_label())
                        .color(theme::accent_text())
                        .strong(),
                );
            });
            ui.add_space(theme::SPACE_LG);
        });
    }

    fn config_pill(ui: &mut Ui, label: &str, value: &str) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.label(
                RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .strong()
                    .extra_letter_spacing(theme::TRACKING_TIGHT),
            );
            ui.add_space(theme::SPACE_XS);
            egui::Frame::new()
                .fill(theme::bg_tertiary())
                .corner_radius(egui::CornerRadius::same(theme::ROUNDING_SM))
                .inner_margin(egui::Margin::symmetric(
                    theme::SPACE_SM as i32 as i8,
                    theme::SPACE_XS as i32 as i8,
                ))
                .show(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        RichText::new(value)
                            .font(theme::font_mono_sm())
                            .color(theme::text_primary())
                            .strong(),
                    );
                });
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Shared helpers
    // ════════════════════════════════════════════════════════════════════════

    #[allow(dead_code)]
    fn usage_color(percent: f64) -> egui::Color32 {
        if percent >= RESOURCE_CRITICAL_THRESHOLD {
            theme::ERROR
        } else if percent >= RESOURCE_WARNING_THRESHOLD {
            theme::WARNING
        } else {
            theme::SUCCESS
        }
    }

    fn severity_style(severity: &SiemLogSeverity) -> (egui::Color32, &'static str) {
        match severity {
            SiemLogSeverity::Critical => (theme::ERROR, "CRT"),
            SiemLogSeverity::Error => (theme::ERROR, "ERR"),
            SiemLogSeverity::Warning => (theme::WARNING, "WRN"),
            SiemLogSeverity::Notice => (theme::INFO, "NTC"),
            SiemLogSeverity::Info => (theme::text_tertiary(), "INF"),
        }
    }

    fn format_uptime(secs: u64) -> String {
        let days = secs / agent_common::constants::SECS_PER_DAY;
        let hours = (secs % agent_common::constants::SECS_PER_DAY) / 3600;
        let minutes = (secs % 3600) / 60;
        if days > 0 {
            format!("{}j {}h {}m", days, hours, minutes)
        } else if hours > 0 {
            format!("{}h {}m", hours, minutes)
        } else {
            format!("{}m", minutes)
        }
    }

    fn format_large_number(n: u64) -> String {
        if n >= 1_000_000 {
            format!("{:.1}M", n as f64 / 1_000_000.0)
        } else if n >= 1_000 {
            format!("{:.1}K", n as f64 / 1_000.0)
        } else {
            format!("{}", n)
        }
    }

    /// Premium summary card - clean Apple-style design
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
                ui.set_min_height(SUMMARY_CARD_MIN_HEIGHT);

                let response =
                    ui.interact(ui.max_rect(), ui.id().with(label), egui::Sense::hover());

                let safe_color = theme::readable_color(color);
                ui.horizontal(|ui: &mut egui::Ui| {
                    // Left: Value and label
                    ui.vertical(|ui: &mut egui::Ui| {
                        let value_color = if response.hovered() {
                            safe_color
                        } else {
                            safe_color.linear_multiply(theme::OPACITY_STRONG)
                        };

                        ui.label(
                            RichText::new(value)
                                .font(theme::font_card_value())
                                .color(value_color)
                                .strong(),
                        );
                        ui.label(
                            RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });

                    // Right: Icon
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            let icon_alpha = if response.hovered() {
                                theme::OPACITY_MEDIUM
                            } else {
                                theme::OPACITY_DISABLED
                            };
                            ui.label(
                                RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(safe_color.linear_multiply(icon_alpha)),
                            );
                        },
                    );
                });

                // Bottom accent line on hover
                if response.hovered() {
                    let rect = ui.max_rect();
                    let line_y = rect.bottom() - 1.5;

                    ui.painter().hline(
                        rect.left() + theme::CARD_GLOW_INSET
                            ..=rect.right() - theme::CARD_GLOW_INSET,
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

    #[allow(dead_code)]
    fn empty_chart_state(ui: &mut Ui, height: f32) {
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), height - 60.0),
            egui::Sense::hover(),
        );

        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);

            // Subtle grid lines
            let grid_color = theme::border().linear_multiply(theme::OPACITY_MODERATE);
            for i in 1..4 {
                let y = rect.min.y + (rect.height() * i as f32 / 4.0);
                painter.line_segment(
                    [egui::pos2(rect.min.x, y), egui::pos2(rect.max.x, y)],
                    egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
                );
            }

            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                "En attente de données...",
                theme::font_min(),
                theme::text_tertiary(),
            );
        }
    }

    fn export_metrics_csv(state: &AppState) {
        let headers = &[
            "timestamp",
            "cpu_percent",
            "memory_percent",
            "disk_io_kbps",
            "network_io_kbps",
        ];
        let now = chrono::Utc::now();
        let boot_time = now - chrono::Duration::seconds(state.resources.uptime_secs as i64);

        let rows: Vec<Vec<String>> = state
            .monitoring
            .cpu_history
            .iter()
            .enumerate()
            .map(|(i, [t, cpu])| {
                let timestamp = boot_time + chrono::Duration::milliseconds((t * 1000.0) as i64);

                let mem = state
                    .monitoring
                    .memory_history
                    .get(i)
                    .map(|v| v[1])
                    .unwrap_or(0.0);
                let disk = state
                    .monitoring
                    .disk_io_history
                    .get(i)
                    .map(|v| v[1])
                    .unwrap_or(0.0);
                let net = state
                    .monitoring
                    .network_io_history
                    .get(i)
                    .map(|v| v[1])
                    .unwrap_or(0.0);

                vec![
                    timestamp.to_rfc3339(),
                    format!("{:.2}", cpu),
                    format!("{:.2}", mem),
                    format!("{:.2}", disk),
                    format!("{:.2}", net),
                ]
            })
            .collect();

        let path = crate::export::default_export_path("surveillance_ressources.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        } else {
            info!(
                "[AUDIT] GUI user exported monitoring data to {}",
                path.display()
            );
        }
    }
}
