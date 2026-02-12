//! Sparkline widget - clean mini time-series charts using egui_plot.

use egui::{Color32, RichText, Ui, Vec2};
use egui_plot::{Line, Plot, PlotPoints};

use crate::theme;

/// Configuration for a sparkline chart.
pub struct SparklineConfig {
    /// Line color.
    pub color: Color32,
    /// Fill gradient below line.
    pub fill: bool,
    /// Show trend arrow.
    pub show_trend: bool,
    /// Show min/max labels.
    pub show_stats: bool,
}

impl Default for SparklineConfig {
    fn default() -> Self {
        Self {
            color: theme::ACCENT,
            fill: true,
            show_trend: true,
            show_stats: false,
        }
    }
}

/// Renders a clean sparkline chart using egui_plot.
pub fn sparkline(ui: &mut Ui, data: &[[f64; 2]], size: Vec2, config: &SparklineConfig) {
    if data.is_empty() {
        // Empty state
        let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);
            painter.rect_filled(rect, theme::PROGRESS_BAR_ROUNDING, theme::bg_tertiary().linear_multiply(theme::OPACITY_TINT));

            // Subtle grid lines
            let grid_color = theme::border().linear_multiply(theme::OPACITY_TINT);
            for i in 1..3 {
                let y = rect.min.y + (rect.height() * i as f32 / 3.0);
                painter.line_segment(
                    [
                        egui::pos2(rect.min.x + 4.0, y),
                        egui::pos2(rect.max.x - 4.0, y),
                    ],
                    egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
                );
            }
        }
        return;
    }

    let id = ui.id().with("sparkline");

    let plot = Plot::new(id)
        .height(size.y)
        .width(size.x)
        .show_axes(egui::Vec2b::new(false, false))
        .show_grid(false)
        .allow_drag(false)
        .allow_zoom(false)
        .allow_scroll(false)
        .allow_boxed_zoom(false)
        .allow_double_click_reset(false)
        .show_background(false)
        .include_y(0.0)
        .auto_bounds(egui::Vec2b::new(true, true));

    plot.show(ui, |plot_ui| {
        // Fill under the line
        if config.fill {
            plot_ui.line(
                Line::new(PlotPoints::new(data.to_vec()))
                    .color(config.color.linear_multiply(theme::OPACITY_SUBTLE))
                    .fill(0.0),
            );
        }

        // Soft glow layer (single, subtle)
        plot_ui.line(
            Line::new(PlotPoints::new(data.to_vec()))
                .color(config.color.linear_multiply(theme::OPACITY_MUTED))
                .width(3.0),
        );

        // Main line
        plot_ui.line(
            Line::new(PlotPoints::new(data.to_vec()))
                .color(config.color)
                .width(1.5),
        );

        // Endpoint indicator
        if let Some(&latest) = data.last() {
            plot_ui.points(
                egui_plot::Points::new(PlotPoints::new(vec![latest]))
                    .color(config.color.linear_multiply(theme::OPACITY_MODERATE))
                    .radius(5.0),
            );
            plot_ui.points(
                egui_plot::Points::new(PlotPoints::new(vec![latest]))
                    .color(config.color)
                    .radius(2.5),
            );
        }
    });
}

/// Renders a sparkline with value label and trend.
pub fn sparkline_with_value(
    ui: &mut Ui,
    label: &str,
    value: &str,
    data: &[[f64; 2]],
    config: &SparklineConfig,
) {
    ui.vertical(|ui: &mut egui::Ui| {
        // Header with label and value
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.3)
                    .strong(),
            );

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    // Trend arrow
                    if config.show_trend && data.len() >= 2 {
                        let last = data.last().map(|p| p[1]).unwrap_or(0.0);
                        let prev = data
                            .get(data.len().saturating_sub(10))
                            .map(|p| p[1])
                            .unwrap_or(last);

                        let (arrow, arrow_color) = if last > prev * 1.05 {
                            ("▲", theme::ERROR)
                        } else if last < prev * 0.95 {
                            ("▼", theme::SUCCESS)
                        } else {
                            ("→", theme::text_tertiary())
                        };

                        ui.label(
                            RichText::new(arrow)
                                .font(theme::font_label())
                                .color(arrow_color),
                        );
                    }

                    ui.label(
                        RichText::new(value)
                            .font(theme::font_body())
                            .color(config.color)
                            .strong(),
                    );
                },
            );
        });

        ui.add_space(theme::SPACE_XS);

        // Sparkline chart
        let available_width = ui.available_width();
        sparkline(ui, data, Vec2::new(available_width, 32.0), config);

        // Stats row (optional)
        if config.show_stats && !data.is_empty() {
            ui.add_space(theme::SPACE_XS);
            let y_values: Vec<f64> = data.iter().map(|p| p[1]).collect();
            let avg = y_values.iter().sum::<f64>() / y_values.len() as f64;
            let max = y_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    RichText::new(format!("Moy: {:.0}%", avg))
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    RichText::new(format!("Max: {:.0}%", max))
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
            });
        }
    });
}

/// Renders a mini donut/ring chart for a percentage value.
pub fn mini_gauge(ui: &mut Ui, value: f32, color: Color32, size: f32) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(size), egui::Sense::hover());

    if !ui.is_rect_visible(rect) {
        return;
    }

    let painter = ui.painter_at(rect);
    let center = rect.center();
    let radius = size * 0.38;
    let stroke_width = size * 0.1;

    // Background ring
    painter.circle_stroke(
        center,
        radius,
        egui::Stroke::new(stroke_width, theme::bg_tertiary()),
    );

    // Value arc
    let fraction = (value / 100.0).clamp(0.0, 1.0);
    if fraction > 0.0 {
        let start_angle = -std::f32::consts::FRAC_PI_2;
        let sweep = fraction * std::f32::consts::TAU;

        let segments = 24;
        let points: Vec<egui::Pos2> = (0..=segments)
            .map(|i| {
                let t = i as f32 / segments as f32;
                let angle = start_angle + t * sweep;
                egui::pos2(
                    center.x + angle.cos() * radius,
                    center.y + angle.sin() * radius,
                )
            })
            .collect();

        for i in 0..points.len() - 1 {
            painter.line_segment(
                [points[i], points[i + 1]],
                egui::Stroke::new(stroke_width, color),
            );
        }
    }

    // Center text
    painter.text(
        center,
        egui::Align2::CENTER_CENTER,
        format!("{:.0}", value),
        egui::FontId::proportional(size * 0.2),
        theme::text_primary(),
    );
}
