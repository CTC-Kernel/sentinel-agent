//! Pill-shaped status badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge.
///
/// `text` is the badge label.
/// `color` is the badge fill color (text will be white).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let padding = Vec2::new(theme::SPACE_SM, theme::SPACE_XS);
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        theme::font_small(),
        theme::TEXT_ON_ACCENT,
    );
    let text_size = galley.size();
    let desired = text_size + padding * 2.0;
    let (rect, _) = ui.allocate_exact_size(desired, egui::Sense::hover());
    let painter = ui.painter_at(rect);

    painter.rect_filled(rect, CornerRadius::same(theme::BADGE_ROUNDING), color);
    painter.galley(
        rect.min + padding,
        galley,
        theme::TEXT_ON_ACCENT,
    );
}
