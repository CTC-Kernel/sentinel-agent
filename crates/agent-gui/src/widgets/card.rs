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
        .inner_margin(Margin::same(24)) // Balanced padding
        .stroke(egui::Stroke::new(0.5, theme::border()))
        .shadow(shadow)
        .show(ui, |ui: &mut egui::Ui| {
            add_contents(ui);
        });

    // Glassmorphism: subtle top-edge highlight for depth
    {
        let rect = frame_resp.response.rect;
        let painter = ui.painter_at(rect);

        // Top edge: bright glass-like border
        let top_line = egui::Rect::from_min_size(rect.min, egui::vec2(rect.width(), 1.0));
        painter.rect_filled(
            top_line,
            CornerRadius {
                nw: theme::CARD_ROUNDING,
                ne: theme::CARD_ROUNDING,
                ..Default::default()
            },
            theme::glass_border_top(),
        );
    }

    // Premium hover effect: brighter border + subtle glow
    if ui.rect_contains_pointer(frame_resp.response.rect) {
        let rect = frame_resp.response.rect;
        let painter = ui.painter_at(rect);

        // Elevated border on hover
        let hover_stroke = if is_dark {
            Stroke::new(1.0, theme::border().linear_multiply(2.5))
        } else {
            Stroke::new(1.0, theme::border().linear_multiply(0.5))
        };

        painter.rect_stroke(
            rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            hover_stroke,
            StrokeKind::Inside,
        );

        // Subtle accent glow on hover (only if not reduced-motion)
        if !theme::is_reduced_motion() {
            let glow_shadow = egui::epaint::Shadow {
                offset: [0, 2],
                blur: 16,
                spread: 0,
                color: theme::ACCENT.linear_multiply(if is_dark { 0.08 } else { 0.05 }),
            };
            painter.add(glow_shadow.as_shape(rect, CornerRadius::same(theme::CARD_ROUNDING)));
        }
    }
}
