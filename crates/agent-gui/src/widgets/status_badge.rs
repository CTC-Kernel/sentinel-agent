//! Pill-shaped status badges — premium soft tinted style.
//!
//! Uses `theme::badge_*()` helpers for consistent colors across all badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge with premium soft-tinted styling.
///
/// `text` is the badge label.
/// `color` is the semantic color (SUCCESS, WARNING, ERROR, INFO, ACCENT, etc.).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let h_pad = 8.0;
    let v_pad = 3.0;

    let bg_color = theme::badge_bg(color);
    let border_color = theme::badge_border(color);
    let text_color = theme::badge_text(color);

    let galley = ui
        .painter()
        .layout_no_wrap(text.to_string(), theme::font_small(), text_color);

    let text_size = galley.size();
    let desired_size = Vec2::new(
        text_size.x + h_pad * 2.0,
        (text_size.y + v_pad * 2.0).max(18.0),
    );

    let (rect, _) = ui.allocate_exact_size(desired_size, egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let radius = (rect.height() / 2.0).round() as u8;

        // Soft tinted background
        ui.painter()
            .rect_filled(rect, CornerRadius::same(radius), bg_color);

        // Subtle border for definition
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(radius),
            egui::Stroke::new(0.5, border_color),
            egui::StrokeKind::Inside,
        );

        // Centered text
        let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
        ui.painter().galley(text_pos, galley, text_color);
    }
}
