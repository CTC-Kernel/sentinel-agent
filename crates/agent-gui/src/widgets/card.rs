//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    let is_hovered = ui.rect_contains_pointer(ui.available_rect_before_wrap());
    let bg_fill = if is_hovered {
        theme::BG_ELEVATED
    } else {
        theme::BG_SECONDARY
    };

    Frame::new()
        .fill(bg_fill)
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(20)) 
        .stroke(egui::Stroke::NONE) // Clean borderless cards
        .shadow(theme::premium_shadow(12, 40))
        .show(ui, |ui| {
            add_contents(ui);
        });
}
