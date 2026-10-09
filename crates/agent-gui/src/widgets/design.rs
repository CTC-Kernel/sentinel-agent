// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Shared visual vocabulary for overview, operational pages and detail surfaces.

use crate::{icons, theme};
use egui::{Color32, Rect, RichText, Ui};

/// Opaque, bounded lighting: never accumulates alpha over text or adjacent panels.
pub fn surface_light(rect: Rect, base: Color32, accent: Color32) -> egui::Shape {
    let mut mesh = egui::Mesh::default();
    for position in [
        rect.left_top(),
        rect.right_top(),
        rect.right_bottom(),
        rect.left_bottom(),
    ] {
        mesh.colored_vertex(position, base);
    }
    mesh.colored_vertex(
        rect.min + rect.size() * egui::vec2(0.78, 0.25),
        theme::color_blend_pub(
            base,
            accent,
            if theme::is_dark_mode() { 0.055 } else { 0.025 },
        ),
    );
    for corner in 0..4 {
        mesh.add_triangle(corner, (corner + 1) % 4, 4);
    }
    egui::Shape::mesh(mesh)
}

/// A static instrument seal. Decorative, with no implied score or monitoring state.
pub fn instrument_glyph(ui: &mut Ui, icon: &str, color: Color32, size: f32) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());
    if !ui.is_rect_visible(rect) {
        return;
    }
    let painter = ui.painter_at(rect);
    let ink = theme::readable_color(color);
    let radius = size * 0.43;
    painter.circle_filled(rect.center(), size * 0.32, theme::tinted_surface(color));
    painter.circle_stroke(
        rect.center(),
        size * 0.33,
        egui::Stroke::new(0.8_f32, theme::badge_border(color)),
    );
    for quadrant in 0..4 {
        let start = quadrant as f32 * std::f32::consts::FRAC_PI_2 + 0.12;
        let points = (0..=12)
            .map(|i| {
                let angle = start + (std::f32::consts::FRAC_PI_2 - 0.24) * i as f32 / 12.0;
                rect.center() + egui::vec2(angle.cos(), angle.sin()) * radius
            })
            .collect();
        painter.add(egui::Shape::line(
            points,
            egui::Stroke::new(1.0_f32, theme::badge_border(color)),
        ));
    }
    painter.text(
        rect.center(),
        egui::Align2::CENTER_CENTER,
        icon,
        theme::font_icon(size * 0.32),
        ink,
    );
}

/// Consistent drill-down metrics, preserving each caller's filter/navigation action.
pub fn metric_card(
    ui: &mut Ui,
    width: f32,
    label: &str,
    value: &str,
    color: Color32,
    icon: &str,
) -> bool {
    let mut clicked = false;
    ui.vertical(|ui| {
        ui.set_width(width);
        let response = super::clickable_card(ui, ("metric", label), |ui| {
            ui.set_min_height(theme::SUMMARY_CARD_MIN_HEIGHT);
            ui.horizontal(|ui| {
                super::icon_tile(ui, icon, color, 28.0);
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.label(
                        RichText::new(icons::ARROW_RIGHT)
                            .font(theme::font_icon(12.0))
                            .color(theme::text_tertiary()),
                    );
                });
            });
            ui.add_space(theme::SPACE_SM);
            ui.label(
                RichText::new(value)
                    .font(theme::font_card_value())
                    .color(theme::readable_color(color))
                    .strong(),
            );
            ui.label(
                RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_secondary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
        });
        response.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::Button,
                ui.is_enabled(),
                format!("{label} : {value}. Afficher les éléments correspondants"),
            )
        });
        clicked = response
            .on_hover_text(format!("{label} · Afficher les éléments correspondants"))
            .clicked();
    });
    clicked
}
