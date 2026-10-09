// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Pill-shaped status badges — premium soft tinted style.
//!
//! Uses `theme::badge_*()` helpers for consistent colors across all badges.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Draw a pill-shaped status badge with premium soft-tinted styling.
///
/// `text` is the badge label.
/// `color` is the semantic color (SUCCESS, WARNING, ERROR, INFO, ACCENT, etc.).
pub fn status_badge(ui: &mut Ui, text: &str, color: egui::Color32) {
    let h_pad = theme::SPACE_SM;
    let v_pad = theme::ACCENT_BAR_WIDTH;

    let bg_color = theme::badge_bg(color);
    let border_color = theme::badge_border(color);
    let text_color = theme::badge_text(color);

    let galley = egui::WidgetText::from(
        egui::RichText::new(text)
            .font(theme::font_label())
            .color(text_color),
    )
    .into_galley(
        ui,
        Some(egui::TextWrapMode::Truncate),
        (ui.available_width() - h_pad * 2.0 - 12.0).max(1.0),
        theme::font_label(),
    );

    let text_size = galley.size();
    let desired_size = Vec2::new(
        text_size.x + h_pad * 2.0 + 12.0,
        (text_size.y + v_pad * 2.0).max(theme::BADGE_MIN_HEIGHT),
    );

    let (rect, response) = ui.allocate_exact_size(desired_size, egui::Sense::hover());
    response.on_hover_text(text);

    if ui.is_rect_visible(rect) {
        let radius = (rect.height() / 2.0).round().min(255.0) as u8;

        // Soft tinted background
        ui.painter()
            .rect_filled(rect, CornerRadius::same(radius), bg_color);

        // Subtle border for definition
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(radius),
            egui::Stroke::new(theme::BORDER_HAIRLINE, border_color),
            egui::StrokeKind::Inside,
        );

        // An inset signal dot and explicit padding keep pills aligned in every layout.
        ui.painter().circle_filled(
            egui::pos2(rect.left() + h_pad + 3.0, rect.center().y),
            2.5,
            text_color,
        );
        let text_pos = egui::pos2(
            rect.left() + h_pad + 12.0,
            rect.center().y - text_size.y * 0.5,
        );
        ui.painter().galley(text_pos, galley, text_color);
    }
}
