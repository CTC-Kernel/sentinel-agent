//! Monitoring page -- real-time system resource charts.

use egui::Ui;
use egui_plot::{Line, Plot, PlotPoints};

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct MonitoringPage;

impl MonitoringPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Surveillance syst\u{00e8}me",
            Some("Monitoring temps r\u{00e9}el des ressources"),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary cards row ──────────────────────────────────────────
        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 3.0) / 4.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;

            // CPU
            let cpu_color = Self::usage_color(state.resources.cpu_percent);
            Self::summary_card(
                ui,
                card_w,
                "CPU",
                &format!("{:.1}%", state.resources.cpu_percent),
                cpu_color,
                icons::BOLT,
            );

            // RAM
            let mem_color = Self::usage_color(state.resources.memory_percent);
            Self::summary_card(
                ui,
                card_w,
                "M\u{00c9}MOIRE",
                &format!(
                    "{:.1}% ({} / {} Mo)",
                    state.resources.memory_percent,
                    state.resources.memory_used_mb,
                    state.resources.memory_total_mb,
                ),
                mem_color,
                icons::SERVER,
            );

            // Disk
            let disk_color = Self::usage_color(state.resources.disk_percent);
            Self::summary_card(
                ui,
                card_w,
                "DISQUE",
                &format!("{:.1}%", state.resources.disk_percent),
                disk_color,
                icons::DATABASE,
            );

            // Uptime
            let uptime = state.resources.uptime_secs;
            let uptime_str = Self::format_uptime(uptime);
            Self::summary_card(
                ui,
                card_w,
                "UPTIME",
                &uptime_str,
                theme::ACCENT,
                icons::CLOCK,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // ── CPU chart ──────────────────────────────────────────────────
        Self::chart_card(
            ui,
            "UTILISATION CPU (%)",
            &state.cpu_history,
            theme::SUCCESS,
            true,
            200.0,
        );

        ui.add_space(theme::SPACE_LG);

        // ── Memory chart ───────────────────────────────────────────────
        Self::chart_card(
            ui,
            "UTILISATION M\u{00c9}MOIRE (%)",
            &state.memory_history,
            theme::ACCENT,
            false,
            200.0,
        );

        ui.add_space(theme::SPACE_LG);

        // ── Disk I/O + Network I/O side by side ────────────────────────
        let gap = theme::SPACE;
        let half_w = (ui.available_width() - gap) / 2.0;
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;

            ui.vertical(|ui| {
                ui.set_width(half_w);
                Self::chart_card(
                    ui,
                    "E/S DISQUE",
                    &state.disk_io_history,
                    theme::WARNING,
                    false,
                    180.0,
                );
            });

            ui.vertical(|ui| {
                ui.set_width(half_w);
                Self::chart_card(
                    ui,
                    "E/S R\u{00c9}SEAU",
                    &state.network_io_history,
                    theme::INFO,
                    false,
                    180.0,
                );
            });
        });

        ui.add_space(theme::SPACE_XL);
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    /// Pick color based on usage percentage (green < 70, amber < 90, red >= 90).
    fn usage_color(percent: f64) -> egui::Color32 {
        if percent >= 90.0 {
            theme::ERROR
        } else if percent >= 70.0 {
            theme::WARNING
        } else {
            theme::SUCCESS
        }
    }

    /// Format seconds into a human-readable uptime string.
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

    /// Draw a small summary card (icon + value + label).
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

    /// Draw a chart card with a line plot inside.
    ///
    /// * `title` -- section header above the chart.
    /// * `history` -- `Vec<[f64; 2]>` where `[0]` is timestamp/index and `[1]` is value.
    /// * `line_color` -- color for the line.
    /// * `fill` -- whether to fill the area below the line.
    /// * `height` -- chart height in pixels.
    fn chart_card(
        ui: &mut Ui,
        title: &str,
        history: &[[f64; 2]],
        line_color: egui::Color32,
        fill: bool,
        height: f32,
    ) {
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new(title)
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            if history.is_empty() {
                // Empty state
                let (rect, _) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width(), height),
                    egui::Sense::empty(),
                );
                let painter = ui.painter_at(rect);
                painter.rect_filled(
                    rect,
                    egui::CornerRadius::same(theme::CARD_ROUNDING),
                    theme::bg_elevated(),
                );
                painter.text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    "En attente de donn\u{00e9}es\u{2026}",
                    theme::font_small(),
                    theme::text_tertiary(),
                );
            } else {
                let points = PlotPoints::new(history.to_vec());
                let mut line = Line::new(points).color(line_color).width(2.0).name(title);

                if fill {
                    line = line.fill(0.0);
                }

                let plot_widget = Plot::new(egui::Id::new(title))
                    .height(height)
                    .include_y(0.0)
                    .include_y(100.0)
                    .allow_drag(false)
                    .allow_zoom(false)
                    .allow_scroll(false)
                    .show_axes(egui::Vec2b::new(false, true))
                    .show_grid(egui::Vec2b::new(false, true))
                    .auto_bounds(egui::Vec2b::new(true, false));

                plot_widget.show(ui, |plot_ui| {
                    plot_ui.line(line);
                });
            }
        });
    }
}
