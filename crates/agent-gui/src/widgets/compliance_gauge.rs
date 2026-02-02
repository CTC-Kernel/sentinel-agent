//! Circular compliance score gauge widget.

use egui::{Pos2, Ui, Vec2};
use std::f32::consts::PI;

use crate::theme;

/// Draw a circular compliance gauge.
///
/// `score` is expected in range 0..=100.
/// Returns the rect used so callers can position labels.
pub fn compliance_gauge(ui: &mut Ui, score: Option<f32>, radius: f32) {
    let desired_size = Vec2::splat(radius * 2.0 + 16.0);
    let (rect, _response) = ui.allocate_exact_size(desired_size, egui::Sense::empty());
    let center = rect.center();
    let painter = ui.painter_at(rect);

    let track_color = theme::border();
    let stroke_width = 6.0;

    // Background track (full circle).
    painter.circle_stroke(center, radius, egui::Stroke::new(stroke_width, track_color));

    match score {
        Some(value) => {
            let clamped = value.clamp(0.0, 100.0);
            let color = theme::score_color(clamped);

            // Arc from top (-PI/2) clockwise.
            let start_angle = -PI / 2.0;
            let sweep = (clamped / 100.0) * 2.0 * PI;
            let segments = 64;

            let points: Vec<Pos2> = (0..=segments)
                .map(|i| {
                    let t = i as f32 / segments as f32;
                    let angle = start_angle + sweep * t;
                    Pos2::new(
                        center.x + radius * angle.cos(),
                        center.y + radius * angle.sin(),
                    )
                })
                .collect();

            if points.len() >= 2 {
                painter.add(egui::Shape::line(
                    points,
                    egui::Stroke::new(stroke_width, color),
                ));
            }

            // Score text in center.
            painter.text(
                center + Vec2::new(0.0, -4.0),
                egui::Align2::CENTER_CENTER,
                format!("{:.0}%", clamped),
                theme::font_title(),
                color,
            );
            painter.text(
                center + Vec2::new(0.0, 16.0),
                egui::Align2::CENTER_CENTER,
                "Conformit\u{00e9}",
                theme::font_small(),
                theme::text_secondary(),
            );
        }
        None => {
            painter.text(
                center + Vec2::new(0.0, -4.0),
                egui::Align2::CENTER_CENTER,
                "--",
                theme::font_title(),
                theme::text_tertiary(),
            );
            painter.text(
                center + Vec2::new(0.0, 16.0),
                egui::Align2::CENTER_CENTER,
                "Conformit\u{00e9}",
                theme::font_small(),
                theme::text_secondary(),
            );
        }
    }
}
