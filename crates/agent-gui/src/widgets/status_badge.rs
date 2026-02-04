//! Pill-shaped status badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge with muted colors for better readability.
///
/// `text` is the badge label.
/// `color` is the semantic color (will be softened for background).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let padding = Vec2::new(theme::SPACE_SM, theme::SPACE_XS);
    
    // Use the semantic color for text, with a very subtle tinted background
    let bg_color = color.linear_multiply(0.15); // Very soft background tint
    let text_color = color; // Semantic color for text (more readable)
    
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        theme::font_small(),
        text_color,
    );
    let text_size = galley.size();
    let desired_size = text_size + padding * 2.0;

    // Allocate space
    let (rect, _) = ui.allocate_exact_size(desired_size, egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let radius = (rect.height() / 2.0).round() as u8;
        
        // Soft muted background (no animation)
        ui.painter().rect_filled(
            rect,
            CornerRadius::same(radius),
            bg_color,
        );

        // Subtle border for definition
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(radius),
            egui::Stroke::new(1.0, color.linear_multiply(0.3)),
            egui::StrokeKind::Inside,
        );

        // Draw text centered with semantic color
        let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
        ui.painter().galley(text_pos, galley, text_color);
    }
}
