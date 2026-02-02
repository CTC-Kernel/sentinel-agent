//! Pill-shaped status badges.

use egui::{Color32, CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge.
///
/// `text` is the badge label.
/// `color` is the badge fill color (text will be white).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let padding = Vec2::new(theme::SPACE_MD, theme::SPACE_XS); // More horizontal padding
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        theme::font_small(),
        Color32::WHITE, // Always white text on badges
    );
    let text_size = galley.size();
    let desired_size = text_size + padding * 2.0;
    
    // Allocate space
    let (rect, _) = ui.allocate_exact_size(desired_size, egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        // Draw capsule background
        let radius = (rect.height() / 2.0).round() as u8;
        ui.painter().rect_filled(
            rect,
             CornerRadius::same(radius), // Capsule shape
            color,
        );
        
        // Optional: subtle border for definition
        ui.painter().rect_stroke(
            rect,
             CornerRadius::same(radius),
             egui::Stroke::new(1.0, Color32::from_white_alpha(30)),
             egui::StrokeKind::Inside,
        );

        // Draw text centered
        let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
        ui.painter().galley(text_pos, galley, Color32::WHITE);
    }
}
