//! Pill-shaped status badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge with premium contrast and styling.
///
/// `text` is the badge label.
/// `color` is the semantic color (will be used for background with high-contrast text).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let padding = Vec2::new(theme::SPACE_SM, theme::SPACE_XS);
    
    // Premium approach: full color background with white text for maximum contrast
    let bg_color = color;
    let text_color = theme::text_on_accent(); // Always white for premium contrast
    
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
        
        // Premium filled background
        ui.painter().rect_filled(
            rect,
            CornerRadius::same(radius),
            bg_color,
        );

        // Premium subtle border for depth
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(radius),
            egui::Stroke::new(0.5, theme::border()),
            egui::StrokeKind::Inside,
        );

        // Draw text centered with semantic color
        let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
        ui.painter().galley(text_pos, galley, text_color);
    }
}
