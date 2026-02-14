//! Monitoring page -- real-time system resource charts.
//! Premium clean design - Apple-inspired, no fake glow effects.

use egui::{RichText, Ui};
use egui_plot::{Line, Plot, PlotPoints};
use tracing::info;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct MonitoringPage;

impl MonitoringPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Monitoring"],
            "Surveillance Système",
            Some("MONITORAGE DES RESSOURCES ET DES PERFORMANCES EN TEMPS RÉEL"),
            Some(
                "Visualisez la charge CPU, l'utilisation de la mémoire et l'activité réseau de l'agent.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar
        ui.horizontal(|ui: &mut egui::Ui| {
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
        ui.add_space(theme::SPACE_MD);

        // Summary cards row
        let summary_grid = widgets::ResponsiveGrid::new(240.0, theme::SPACE_SM);
        let items = vec![
            (
                "CHARGE CPU",
                format!("{:.1}%", state.resources.cpu_percent),
                Self::usage_color(state.resources.cpu_percent),
                icons::BOLT,
            ),
            (
                "MÉMOIRE VIVE",
                format!("{:.1}%", state.resources.memory_percent),
                Self::usage_color(state.resources.memory_percent),
                icons::SERVER,
            ),
            (
                "DISQUE SYSTÈME",
                format!("{:.1}%", state.resources.disk_percent),
                Self::usage_color(state.resources.disk_percent),
                icons::DATABASE,
            ),
            (
                "UPTIME AGENT",
                Self::format_uptime(state.resources.uptime_secs),
                theme::ACCENT,
                icons::CLOCK,
            ),
        ];

        summary_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Main charts grid (CPU + Memory)
        let cpu_data: Vec<[f64; 2]> = state.monitoring.cpu_history.iter().copied().collect();
        let mem_data: Vec<[f64; 2]> = state.monitoring.memory_history.iter().copied().collect();

        let main_charts_grid = widgets::ResponsiveGrid::new(450.0, theme::SPACE_LG);
        let main_items: Vec<(&str, &[[f64; 2]], egui::Color32, bool)> = vec![
            ("CPU", &cpu_data, theme::SUCCESS, true),
            ("MÉMOIRE", &mem_data, theme::ACCENT, true),
        ];

        main_charts_grid.show(
            ui,
            &main_items,
            |ui, width, (title, history, color, fill)| {
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_width(width);
                    Self::chart_card(ui, title, history, *color, *fill, 220.0, false);
                });
            },
        );

        ui.add_space(theme::SPACE_LG);

        // IO charts grid (Disk + Network)
        let disk_data: Vec<[f64; 2]> = state.monitoring.disk_io_history.iter().copied().collect();
        let net_data: Vec<[f64; 2]> = state
            .monitoring
            .network_io_history
            .iter()
            .copied()
            .collect();

        let io_grid = widgets::ResponsiveGrid::new(450.0, theme::SPACE_LG);
        let io_items: Vec<(&str, &[[f64; 2]], egui::Color32, bool)> = vec![
            ("FLUX DISQUE (kB/s)", &disk_data, theme::WARNING, true),
            ("FLUX RÉSEAU", &net_data, theme::INFO, true),
        ];

        io_grid.show(
            ui,
            &io_items,
            |ui, width, (title, history, color, auto_y)| {
                ui.vertical(|ui: &mut egui::Ui| {
                    ui.set_width(width);
                    Self::chart_card(ui, title, history, *color, true, 200.0, *auto_y);
                });
            },
        );

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    fn usage_color(percent: f64) -> egui::Color32 {
        if percent >= 90.0 {
            theme::ERROR
        } else if percent >= 70.0 {
            theme::WARNING
        } else {
            theme::SUCCESS
        }
    }

    fn format_uptime(secs: u64) -> String {
        let days = secs / 86400;
        let hours = (secs % 86400) / 3600;
        let minutes = (secs % 3600) / 60;
        if days > 0 {
            format!("{}j {}h {}m", days, hours, minutes)
        } else if hours > 0 {
            format!("{}h {}m", hours, minutes)
        } else {
            format!("{}m", minutes)
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
                ui.set_min_height(72.0);

                let response =
                    ui.interact(ui.max_rect(), ui.id().with(label), egui::Sense::hover());

                ui.horizontal(|ui: &mut egui::Ui| {
                    // Left: Value and label
                    ui.vertical(|ui: &mut egui::Ui| {
                        // Value with accent color
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
                                .extra_letter_spacing(0.4)
                                .strong(),
                        );
                    });

                    // Right: Icon
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

    /// Premium chart card - clean design with proper egui_plot
    fn chart_card(
        ui: &mut Ui,
        title: &str,
        history: &[[f64; 2]],
        line_color: egui::Color32,
        fill: bool,
        height: f32,
        auto_y: bool,
    ) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            // Header
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(title)
                        .font(theme::font_min())
                        .color(theme::text_secondary())
                        .strong()
                        .extra_letter_spacing(0.3),
                );

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if !history.is_empty() {
                            // Simple live dot
                            let time = ui.input(|i| i.time);
                            let pulse = ((time * 1.5).sin() * 0.5 + 0.5) as f32;

                            ui.label(
                                egui::RichText::new("●")
                                    .size(6.0)
                                    .color(theme::SUCCESS.linear_multiply(0.4 + pulse * 0.3)),
                            );
                        }
                    },
                );
            });

            ui.add_space(theme::SPACE_SM);

            if history.is_empty() {
                Self::empty_chart_state(ui, height);
            } else {
                Self::render_chart_with_stats(ui, title, history, line_color, fill, height, auto_y);
            }
        });
    }

    fn empty_chart_state(ui: &mut Ui, height: f32) {
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), height),
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

    fn render_chart_with_stats(
        ui: &mut Ui,
        title: &str,
        history: &[[f64; 2]],
        line_color: egui::Color32,
        fill: bool,
        height: f32,
        auto_y: bool,
    ) {
        let values: Vec<f64> = history.iter().map(|p| p[1]).collect();
        let current = values.last().copied().unwrap_or(0.0);

        // Current value only - cleaner design
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.vertical(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(format!("{:.1}", current))
                        .font(theme::font_card_value())
                        .color(line_color)
                        .strong(),
                );
                ui.label(
                    RichText::new("ACTUEL")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                if title.contains("DISQUE") || title.contains("R\u{00c9}SEAU") {
                    ui.label(
                        RichText::new("kB/s")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        // Chart - clean rendering with egui_plot
        let chart_height = height - 70.0;

        let mut plot = Plot::new(egui::Id::new(format!(
            "chart_{}",
            history.as_ptr() as usize
        )))
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

        // Get time before entering the closure to avoid borrowing conflicts
        let current_time = ui.ctx().input(|i| i.time);

        plot.show(ui, |plot_ui| {
            // Fill under line (subtle)
            if fill {
                plot_ui.line(
                    Line::new(PlotPoints::new(history.to_vec()))
                        .color(line_color.linear_multiply(theme::OPACITY_SUBTLE))
                        .fill(0.0),
                );
            }

            // Main line - crisp
            plot_ui.line(
                Line::new(PlotPoints::new(history.to_vec()))
                    .color(line_color)
                    .width(1.5),
            );

            // Simple current point with pulse
            if let Some(&latest) = history.last() {
                let pulse = ((current_time * 3.0).sin() * 0.5 + 0.5) as f32;

                // Outer glow
                plot_ui.points(
                    egui_plot::Points::new(PlotPoints::new(vec![latest]))
                        .color(line_color.linear_multiply(0.2 + pulse * 0.2))
                        .radius(6.0),
                );

                // Core point
                plot_ui.points(
                    egui_plot::Points::new(PlotPoints::new(vec![latest]))
                        .color(line_color)
                        .radius(3.0),
                );
            }
        });

        // Charts update every second; no need for max-FPS repainting
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(1000));
    }

    fn export_metrics_csv(state: &AppState) {
        let headers = &["timestamp", "cpu_percent", "memory_percent", "disk_percent"];
        let rows = vec![vec![
            chrono::Utc::now().to_rfc3339(),
            state.resources.cpu_percent.to_string(),
            state.resources.memory_percent.to_string(),
            state.resources.disk_percent.to_string(),
        ]];
        let path = crate::export::default_export_path("monitoring_ressources.csv");
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
