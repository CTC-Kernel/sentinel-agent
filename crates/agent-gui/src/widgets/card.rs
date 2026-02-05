//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Stroke, Ui, epaint::StrokeKind};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    let is_dark = theme::is_dark_mode();

    // Base shadow: stronger in light mode to lift off white background
    let shadow = if is_dark {
        theme::premium_shadow(12, 40)
    } else {
        theme::premium_shadow(8, 20)
    };

    let frame_resp = Frame::new()
        .fill(theme::bg_secondary())
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(32)) // Airy padding
        .stroke(egui::Stroke::new(0.5, theme::border()))
        .shadow(shadow)
        .clip(true) // Ensure content doesn't overflow rounded corners
        .show(ui, |ui| {
            add_contents(ui);
        });

    // Subtle hover effect: just slightly brighter border, no glow
    if ui.rect_contains_pointer(frame_resp.response.rect) {
        let hover_stroke = if is_dark {
            Stroke::new(1.0, theme::border().linear_multiply(1.5))
        } else {
            Stroke::new(1.0, theme::border().linear_multiply(0.7))
        };

        ui.painter().rect_stroke(
            frame_resp.response.rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            hover_stroke,
            StrokeKind::Inside,
        );
    }
}
