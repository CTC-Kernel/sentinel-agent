//! Horizontal resource usage bar (CPU, memory).

use egui::{CornerRadius, Rect, Ui, Vec2};

use crate::theme;

/// Draw a horizontal resource usage bar with label.
///
/// `label` is the resource name (e.g. "CPU").
/// `value` is the current usage string (e.g. "12.3%").
/// `fraction` is 0.0..=1.0.
pub fn resource_bar(ui: &mut Ui, label: &str, value: &str, fraction: f32) {
    let bar_height = 6.0;
    let full_width = ui.available_width();

    ui.horizontal(|ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::text_secondary()),
        );
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_small())
                        .color(theme::text_primary()),
                );
            },
        );
    });

    let (rect, _) = ui.allocate_exact_size(Vec2::new(full_width, bar_height), egui::Sense::empty());
    let painter = ui.painter_at(rect);
    let rounding = CornerRadius::same(3);

    // Track.
    // Track.
    let track_color = theme::bg_secondary().linear_multiply(0.5);
    painter.rect_filled(rect, rounding, track_color);
    painter.rect_stroke(
        rect,
        rounding,
        egui::Stroke::new(1.0, theme::border()),
        egui::StrokeKind::Inside,
    );

    // Fill.
    let clamped = fraction.clamp(0.0, 1.0);
    if clamped > 0.0 {
        let base_color = if clamped > 0.9 {
            theme::ERROR
        } else if clamped > 0.7 {
            theme::WARNING
        } else {
            theme::ACCENT
        };

        let fill_width = rect.width() * clamped;
        let fill_rect = Rect::from_min_size(rect.min, Vec2::new(fill_width, bar_height));

        // Gradient effect: Split into top (lighter) and bottom (base)
        let top_half = Rect::from_min_size(fill_rect.min, Vec2::new(fill_width, bar_height / 2.0));
        let bot_half = Rect::from_min_size(
            fill_rect.left_center(),
            Vec2::new(fill_width, bar_height / 2.0),
        );

        painter.rect_filled(
            top_half,
            CornerRadius {
                nw: 3,
                ne: 3,
                sw: 0,
                se: 0,
            },
            base_color.linear_multiply(1.3),
        );
        painter.rect_filled(
            bot_half,
            CornerRadius {
                nw: 0,
                ne: 0,
                sw: 3,
                se: 3,
            },
            base_color,
        );
    }
}
