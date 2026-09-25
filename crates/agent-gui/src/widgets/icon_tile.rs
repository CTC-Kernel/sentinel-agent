// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Consistent semantic icon container used across command surfaces.

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, Vec2};

use crate::theme;

/// Paint a compact, tinted icon tile and return its hover response.
///
/// Centralising this treatment prevents pages from inventing subtly different
/// icon boxes, borders and glyph sizes for the same visual hierarchy.
pub fn icon_tile(ui: &mut Ui, icon: &str, color: Color32, size: f32) -> Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), Sense::hover());
    if !ui.is_rect_visible(rect) {
        return response;
    }

    let hover = crate::animation::animate_hover(
        ui.ctx(),
        response.id.with("icon_tile_hover"),
        response.hovered(),
    );
    let fill =
        crate::animation::lerp_color(theme::badge_bg(color), theme::tinted_surface(color), hover);
    let radius = CornerRadius::same(theme::ROUNDING_MD);

    if hover > 0.0 && theme::is_dark_mode() {
        ui.painter().rect_stroke(
            rect.expand(2.0),
            CornerRadius::same(theme::ROUNDING_MD + 2),
            Stroke::new(
                theme::BORDER_THICK,
                theme::with_alpha(color, (20.0 * hover) as u8),
            ),
            egui::StrokeKind::Outside,
        );
    }
    ui.painter().rect(
        rect,
        radius,
        fill,
        Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(color)),
        egui::StrokeKind::Inside,
    );
    ui.painter().line_segment(
        [
            rect.left_top() + egui::vec2(7.0, 0.5),
            rect.right_top() + egui::vec2(-7.0, 0.5),
        ],
        Stroke::new(theme::BORDER_HAIRLINE, theme::with_alpha(color, 80)),
    );
    ui.painter().text(
        rect.center(),
        egui::Align2::CENTER_CENTER,
        icon,
        theme::font_icon(size * 0.43),
        theme::readable_color(color),
    );

    response
}
