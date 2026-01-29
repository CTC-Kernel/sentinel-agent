//! Horizontal resource usage bar (CPU, memory).

use egui::{Rect, Rounding, Ui, Vec2};

use crate::theme;

/// Draw a horizontal resource usage bar with label.
///
/// `label` is the resource name (e.g. "CPU").
/// `value` is the current usage string (e.g. "12.3%").
/// `fraction` is 0.0..=1.0.
pub fn resource_bar(ui: &mut Ui, label: &str, value: &str, fraction: f32) {
    let bar_height = 6.0;
    let full_width = ui.available_width().min(260.0);

    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::TEXT_SECONDARY),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_small())
                    .color(theme::TEXT_PRIMARY),
            );
        });
    });

    let (rect, _) = ui.allocate_exact_size(Vec2::new(full_width, bar_height), egui::Sense::hover());
    let painter = ui.painter_at(rect);
    let rounding = Rounding::same(bar_height / 2.0);

    // Track.
    painter.rect_filled(rect, rounding, theme::BORDER);

    // Fill.
    let clamped = fraction.clamp(0.0, 1.0);
    if clamped > 0.0 {
        let fill_color = if clamped > 0.9 {
            theme::ERROR
        } else if clamped > 0.7 {
            theme::WARNING
        } else {
            theme::ACCENT
        };
        let fill_rect = Rect::from_min_size(rect.min, Vec2::new(rect.width() * clamped, bar_height));
        painter.rect_filled(fill_rect, rounding, fill_color);
    }
}
