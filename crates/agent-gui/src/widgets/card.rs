//! Card container widget (elevated panel).

use egui::{Color32, CornerRadius, Frame, Margin, Stroke, Ui, epaint::StrokeKind};

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
        .show(ui, |ui| {
            add_contents(ui);
            
            // Inner Light (Bevel) - Glass effect
            if is_dark {
                ui.painter().rect_stroke(
                    ui.min_rect().shrink(1.0),
                    CornerRadius::same(theme::CARD_ROUNDING),
                    Stroke::new(1.0, Color32::from_white_alpha(15)), // Subtle white inner glow
                    StrokeKind::Inside,
                );
            }
        });

    // Hover effect: slight border highlight
    if ui.rect_contains_pointer(frame_resp.response.rect) {
        let hover_stroke = if is_dark {
            Stroke::new(1.0, Color32::from_white_alpha(30))
        } else {
            Stroke::new(1.0, Color32::from_black_alpha(20))
        };
        
        ui.painter().rect_stroke(
            frame_resp.response.rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            hover_stroke,
            StrokeKind::Inside,
        );
    }
}
