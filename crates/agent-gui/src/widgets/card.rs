//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Stroke, Ui};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Frame::new()
        .fill(theme::BG_SECONDARY)
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(20)) // Increased padding for premium feel
        .stroke(Stroke::new(0.5, theme::BORDER))
        .shadow(theme::premium_shadow(12, 40))
        .show(ui, |ui| {
            // Apply a very subtle glow on hover
            if ui.rect_contains_pointer(ui.max_rect()) {
                 let rect = ui.max_rect().expand(1.0);
                 ui.painter().rect_stroke(rect, CornerRadius::same(theme::CARD_ROUNDING), theme::glow_stroke(theme::ACCENT), egui::StrokeKind::Inside);
            }
            add_contents(ui);
        });
}
