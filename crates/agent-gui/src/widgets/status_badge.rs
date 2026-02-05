//! Pill-shaped status badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge with premium contrast and styling.
///
/// `text` is the badge label.
/// `color` is the semantic color (will be softened for better visual comfort).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let padding = Vec2::new(theme::SPACE_SM, theme::SPACE_XS);
    
    // Softer approach: muted background with better text contrast
    let bg_color = color.linear_multiply(0.10); // Even more subtle background for contrast
    let border_color = color.linear_multiply(0.3);   // Subtle border
    let text_color = color; // Use the semantic color for text instead of white
    
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        theme::font_small(),
        text_color,
    );
    // Use strong font manually or wrap in RichText if possible, but status_badge uses galley directly.
    // Let's modify the font to be slightly bolder if possible, or just rely on the 10% bg.
    // Since we're using galley, let's just ensure the bg is very light.

    let text_size = galley.size();
    let desired_size = text_size + padding * 2.0;

    // Allocate space
    let (rect, _) = ui.allocate_exact_size(desired_size, egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let radius = (rect.height() / 2.0).round() as u8;
        
        // Soft background with subtle border
        ui.painter().rect_filled(
            rect,
            CornerRadius::same(radius),
            bg_color,
        );

        // Subtle border for definition
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(radius),
            egui::Stroke::new(0.5, border_color),
            egui::StrokeKind::Inside,
        );

        // Draw text centered with semantic color
        let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
        ui.painter().galley(text_pos, galley, text_color);
    }
}
