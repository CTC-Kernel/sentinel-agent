//! Card container widget (elevated panel).

use egui::{Frame, Margin, Rounding, Stroke, Ui, epaint::Shadow, Vec2};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Frame::new()
        .fill(theme::BG_SECONDARY)
        .rounding(Rounding::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(theme::SPACE))
        .stroke(Stroke::new(0.5, theme::BORDER))
        .shadow(Shadow {
            offset: Vec2::new(0.0, 2.0),
            blur: 8.0,
            spread: 0.0,
            color: egui::Color32::from_black_alpha(40),
        })
        .show(ui, add_contents);
}
