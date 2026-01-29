//! Card container widget (elevated panel).

use egui::{Frame, Margin, CornerRadius, Stroke, Ui, epaint::Shadow};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Frame::new()
        .fill(theme::BG_SECONDARY)
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(16))
        .stroke(Stroke::new(0.5, theme::BORDER))
        .shadow(Shadow {
            offset: [0, 2],
            blur: 8,
            spread: 0,
            color: egui::Color32::from_black_alpha(40),
        })
        .show(ui, add_contents);
}
