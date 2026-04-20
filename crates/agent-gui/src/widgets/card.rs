// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// Render a card and return its bounding rect (shared by `card` and `clickable_card`).
fn render_card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) -> egui::Rect {
    let is_dark = theme::is_dark_mode();

    // Consistent card elevation for both themes
    let shadow = theme::shadow_md();

    let frame_resp = Frame::new()
        .fill(theme::bg_secondary())
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(theme::SPACE_LG as i8))
        .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
        .shadow(shadow)
        .show(ui, |ui: &mut egui::Ui| {
            add_contents(ui);
        });

    let rect = frame_resp.response.rect;

    // Theme-adaptive surface treatment
    if is_dark {
        // Dark mode: shimmer arc + inner glow for depth and volume
        let painter = ui.painter_at(rect);
        let r = f32::from(theme::CARD_ROUNDING);

        let color_top = theme::glass_border_top();
        let stroke_top = egui::Stroke::new(theme::BORDER_MEDIUM, color_top);

        let mut points_top = Vec::new();
        let segments = 12;
        for i in 0..=segments {
            let t = i as f32 / segments as f32;
            let angle = std::f32::consts::PI + (std::f32::consts::PI * 0.5 * t);
            points_top.push(egui::pos2(
                rect.left() + r + r * angle.cos() + 1.2,
                rect.top() + r + r * angle.sin() + 1.2,
            ));
        }
        points_top.push(egui::pos2(rect.center().x, rect.top() + 1.2));
        painter.add(egui::Shape::line(points_top, stroke_top));

        painter.rect_stroke(
            rect.shrink(1.0),
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::glass_border_top().linear_multiply(theme::OPACITY_MODERATE),
            ),
            egui::epaint::StrokeKind::Inside,
        );
    } else {
        // Light mode: clean inset highlight for refined elevation (no shimmer)
        ui.painter_at(rect).rect_stroke(
            rect.shrink(0.5),
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(theme::BORDER_HAIRLINE, theme::glass_border_top()),
            egui::epaint::StrokeKind::Inside,
        );
    }

    // Premium hover effect: elevated shadow + subtle accent border glow
    let is_hovered = ui.rect_contains_pointer(rect);
    let hover_t = ui
        .ctx()
        .animate_bool_with_time(ui.id().with("card_hover").with(rect.min.x as i32).with(rect.min.y as i32), is_hovered, theme::ANIM_FAST);

    if hover_t > 0.0 {
        let hover_shadow = if is_dark {
            theme::shadow_lg()
        } else {
            theme::shadow_md()
        };
        
        let mut animated_shadow = hover_shadow;
        animated_shadow.blur = (hover_shadow.blur as f32 * hover_t) as u8;
        animated_shadow.spread = (hover_shadow.spread as f32 * hover_t) as u8;
        animated_shadow.color = animated_shadow.color.linear_multiply(hover_t);
        
        // Add animated shadow shape
        ui.painter().add(animated_shadow.as_shape(rect, CornerRadius::same(theme::CARD_ROUNDING)));
        
        // Animated border glow (subtle color multiplication) lerped via hover_t
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(
                theme::BORDER_MEDIUM,
                theme::ACCENT.linear_multiply(theme::OPACITY_TINT * hover_t),
            ),
            egui::epaint::StrokeKind::Outside,
        );
    }

    rect
}

/// Draw a card container.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    render_card(ui, add_contents);
}

/// Draw a danger/destructive card container (red-tinted).
pub fn danger_card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    let is_dark = theme::is_dark_mode();

    let shadow = if is_dark {
        theme::shadow_md()
    } else {
        theme::shadow_sm()
    };

    Frame::new()
        .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(theme::SPACE_LG as i8))
        .stroke(egui::Stroke::new(
            theme::BORDER_MEDIUM,
            theme::ERROR.linear_multiply(theme::OPACITY_MEDIUM),
        ))
        .shadow(shadow)
        .show(ui, |ui: &mut egui::Ui| {
            add_contents(ui);
        });
}

/// Draw a clickable card container. Returns a `Response` with click sensing
/// and a pointer cursor on hover.
pub fn clickable_card(
    ui: &mut Ui,
    id_salt: impl std::hash::Hash,
    add_contents: impl FnOnce(&mut Ui),
) -> egui::Response {
    let rect = render_card(ui, add_contents);
    let response = ui.interact(rect, ui.id().with(id_salt), egui::Sense::click());
    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    // Focus ring for keyboard navigation (WCAG 2.4.7)
    if response.has_focus() {
        ui.painter().rect_stroke(
            rect.expand(2.0),
            CornerRadius::same(theme::CARD_ROUNDING + 2),
            theme::focus_ring(),
            egui::epaint::StrokeKind::Outside,
        );
    }
    response
}
