// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// Render a card and return its bounding rect (shared by `card` and `clickable_card`).
fn render_card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) -> egui::Rect {
    Frame::new()
        .fill(theme::bg_secondary())
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(theme::SPACE_LG as i8))
        .stroke(egui::Stroke::new(1.0_f32, theme::surface_border()))
        .shadow(theme::shadow_sm())
        .show(ui, add_contents)
        .response
        .rect
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
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(1.0_f32, theme::accent_text()),
            egui::epaint::StrokeKind::Inside,
        );
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
