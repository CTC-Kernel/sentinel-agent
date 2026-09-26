// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Sparkline widget — mini time-series painted directly, no plot machinery.
//!
//! The previous version drew through `egui_plot` with a translucent fill.
//! egui composites in linear space, so that fill rendered as a saturated
//! slab under the line rather than a wash; a plot also brought axes, drag
//! and zoom state for a 32-pixel chart. Painting the polyline and a mesh
//! whose alpha fades to nothing at the baseline gives the soft area fill
//! the design asks for, at a fraction of the cost.

use egui::{Color32, Pos2, RichText, Stroke, Ui, Vec2};

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

/// Peak alpha of the area fill, right under the line.
const FILL_ALPHA: f32 = 88.0;
/// Room kept inside the rect so the end dot and line width are not clipped.
const INSET: f32 = 3.0;

/// Renders a sparkline: a 1.5 px line over a gradient area, with a dot on
/// the latest value. The y axis starts at zero, so a flat line at 60 % and
/// one at 5 % do not look alike.
pub fn sparkline(
    ui: &mut Ui,
    _id_salt: &str,
    data: &[[f64; 2]],
    size: Vec2,
    config: &SparklineConfig,
) {
    let (rect, response) = ui.allocate_exact_size(size, egui::Sense::hover());
    if !ui.is_rect_visible(rect) {
        return;
    }
    let painter = ui.painter_at(rect);

    if data.len() < 2 {
        // Empty state: a faint surface with two guide lines, so the card
        // keeps its shape while the history fills.
        painter.rect_filled(rect, theme::PROGRESS_BAR_ROUNDING, theme::bg_tertiary());
        for i in 1..3 {
            let y = rect.min.y + (rect.height() * i as f32 / 3.0);
            painter.line_segment(
                [
                    egui::pos2(rect.min.x + 4.0, y),
                    egui::pos2(rect.max.x - 4.0, y),
                ],
                Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            );
        }
        if rect.width() >= 120.0 && rect.height() >= 32.0 {
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                if data.is_empty() {
                    "En attente de mesures"
                } else {
                    "Historique en cours"
                },
                theme::font_small(),
                theme::text_tertiary(),
            );
        }
        return;
    }

    // Sanitize data: filter out any non-finite (NaN / Inf) samples
    let valid_data: Vec<[f64; 2]> = data
        .iter()
        .filter(|p| p[0].is_finite() && p[1].is_finite())
        .copied()
        .collect();

    if valid_data.len() < 2 {
        return;
    }

    let (x0, x1) = valid_data.iter().fold((f64::MAX, f64::MIN), |(lo, hi), p| {
        (lo.min(p[0]), hi.max(p[0]))
    });
    let y_min = valid_data.iter().map(|p| p[1]).fold(0.0_f64, f64::min);
    let y_max = valid_data.iter().map(|p| p[1]).fold(0.0_f64, f64::max);
    let x_span = (x1 - x0).max(f64::EPSILON);
    // 8 % headroom so the peak never touches the top edge.
    let y_span = ((y_max - y_min) * 1.08).max(f64::EPSILON);

    let plot = rect.shrink(INSET);
    let to_pos = |p: &[f64; 2]| -> Pos2 {
        egui::pos2(
            plot.left() + ((p[0] - x0) / x_span) as f32 * plot.width(),
            plot.bottom() - ((p[1] - y_min) / y_span) as f32 * plot.height(),
        )
    };
    let points: Vec<Pos2> = valid_data.iter().map(to_pos).collect();
    let baseline = plot.bottom() - ((0.0 - y_min) / y_span) as f32 * plot.height();

    // Two quiet reference lines make slope and volatility easier to judge at
    // a glance, especially when several KPI cards are compared side-by-side.
    for fraction in [0.33_f32, 0.66] {
        let y = plot.top() + plot.height() * fraction;
        painter.line_segment(
            [egui::pos2(plot.left(), y), egui::pos2(plot.right(), y)],
            Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
        );
    }

    if config.fill {
        // One quad per segment, alpha proportional to height so the wash
        // reads as a vertical gradient from the line down to the baseline.
        let mut mesh = egui::Mesh::default();
        for p in &points {
            let height = ((baseline - p.y) / plot.height().max(1.0)).clamp(0.0, 1.0);
            mesh.colored_vertex(
                *p,
                theme::with_alpha(config.color, (FILL_ALPHA * height) as u8),
            );
            mesh.colored_vertex(
                egui::pos2(p.x, baseline),
                theme::with_alpha(config.color, 0),
            );
        }
        for i in 0..points.len() - 1 {
            let a = (2 * i) as u32;
            mesh.add_triangle(a, a + 1, a + 2);
            mesh.add_triangle(a + 1, a + 3, a + 2);
        }
        painter.add(egui::Shape::mesh(mesh));
    }

    if theme::is_dark_mode() {
        painter.add(egui::Shape::line(
            points.clone(),
            Stroke::new(4.0_f32, theme::with_alpha(config.color, 24)),
        ));
    }
    painter.add(egui::Shape::line(
        points.clone(),
        Stroke::new(1.75_f32, config.color),
    ));

    if let Some(last) = points.last() {
        painter.circle_filled(*last, 4.5_f32, theme::with_alpha(config.color, 70));
        painter.circle_filled(*last, 2.5_f32, config.color);
    }

    // Reveal the closest sample without making a miniature chart draggable.
    if let Some(pointer) = response.hover_pos()
        && let Some((index, point)) = points
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| (a.x - pointer.x).abs().total_cmp(&(b.x - pointer.x).abs()))
    {
        painter.line_segment(
            [
                egui::pos2(point.x, plot.top()),
                egui::pos2(point.x, plot.bottom()),
            ],
            Stroke::new(theme::BORDER_HAIRLINE, theme::text_tertiary()),
        );
        painter.circle_filled(*point, 4.0, theme::bg_secondary());
        painter.circle_stroke(*point, 4.0, Stroke::new(1.5_f32, config.color));
        response.on_hover_ui(|ui| {
            ui.label(format!(
                "Valeur : {}",
                crate::format::decimal(data[index][1], 1)
            ));
        });
    }
}

/// Renders a sparkline with value label and trend.
pub fn sparkline_with_value(
    ui: &mut Ui,
    label: &str,
    value: &str,
    data: &[[f64; 2]],
    config: &SparklineConfig,
) {
    sparkline_card_body(ui, label, value, data, config, 32.0);
}

/// [`sparkline_with_value`] with the chart at `chart_height`, for a card
/// whose height is set by its neighbours rather than by the chart.
pub fn sparkline_card_body(
    ui: &mut Ui,
    label: &str,
    value: &str,
    data: &[[f64; 2]],
    config: &SparklineConfig,
    chart_height: f32,
) {
    ui.vertical(|ui: &mut egui::Ui| {
        // Header with label and value
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_TIGHT)
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
                            ("▲", theme::readable_color(theme::ERROR))
                        } else if last < prev * 0.95 {
                            ("▼", theme::readable_color(theme::SUCCESS))
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
        sparkline(
            ui,
            label,
            data,
            Vec2::new(available_width, chart_height),
            config,
        );

        // Stats row (optional)
        if config.show_stats && !data.is_empty() {
            ui.add_space(theme::SPACE_XS);
            let y_values: Vec<f64> = data.iter().map(|p| p[1]).collect();
            let avg = y_values.iter().sum::<f64>() / y_values.len() as f64;
            let max = y_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    RichText::new(format!("Moy: {:.0}\u{202f}%", avg))
                        .font(theme::font_label())
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    RichText::new(format!("Max: {:.0}\u{202f}%", max))
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
        theme::font_icon(size * 0.2),
        theme::text_primary(),
    );
}
