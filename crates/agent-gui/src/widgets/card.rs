//! Card container widget (elevated panel).

use egui::{Color32, CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    let frame_resp = Frame::new()
        .fill(theme::BG_SECONDARY)
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(16))
        .stroke(egui::Stroke::new(0.5, theme::BORDER))
        .show(ui, |ui| {
            add_contents(ui);
        });

    // Subtle hover highlight on the actual card rect
    if ui.rect_contains_pointer(frame_resp.response.rect) {
        ui.painter().rect_filled(
            frame_resp.response.rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            Color32::from_white_alpha(4),
        );
    }
}
