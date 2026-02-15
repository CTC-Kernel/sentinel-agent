//! Circular compliance score gauge widget - clean Apple-style design.

use egui::{Pos2, Ui, Vec2};
use std::f32::consts::PI;

use crate::theme;

/// Draw a clean circular compliance gauge.
///
/// `score` is expected in range 0..=100.
pub fn compliance_gauge(ui: &mut Ui, score: Option<f32>, radius: f32) {
    let desired_size = Vec2::splat(radius * 2.0 + theme::SPACE);
    let (rect, _response) = ui.allocate_exact_size(desired_size, egui::Sense::hover());
    let center = rect.center();
    let painter = ui.painter_at(rect);

    let track_color = theme::bg_tertiary();
    let stroke_width = theme::GAUGE_STROKE;

    // Background track
    painter.circle_stroke(center, radius, egui::Stroke::new(stroke_width, track_color));

    match score {
        Some(value) => {
            let clamped = value.clamp(0.0, 100.0);
            let color = theme::score_color(clamped);

            let start_angle = -PI / 2.0;
            let sweep = (clamped / 100.0) * 2.0 * PI;
            let segments = 48;

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
                let points_glow = points.clone();
                painter.add(egui::Shape::line(
                    points_glow,
                    egui::Stroke::new(stroke_width + theme::SPACE_XS, color.linear_multiply(theme::OPACITY_TINT)),
                ));

                let last_point = *points.last().unwrap();
                painter.add(egui::Shape::line(
                    points,
                    egui::Stroke::new(stroke_width, color),
                ));

                painter.circle_filled(last_point, stroke_width * 0.5, color);
                painter.circle_filled(
                    last_point,
                    stroke_width * 0.25,
                    theme::text_on_accent(),
                );
            }

            // Score text
            painter.text(
                center + Vec2::new(0.0, -theme::SPACE_XS),
                egui::Align2::CENTER_CENTER,
                format!("{:.0}%", clamped),
                theme::font_card_value(),
                color,
            );
            painter.text(
                center + Vec2::new(0.0, theme::SPACE),
                egui::Align2::CENTER_CENTER,
                "CONFORMITÉ",
                theme::font_caption(),
                theme::text_tertiary(),
            );
        }
        None => {
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                "--",
                theme::font_card_value(),
                theme::text_tertiary(),
            );
        }
    }
}
