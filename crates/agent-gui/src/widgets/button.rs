//! Premium button widgets.

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, WidgetText, epaint::StrokeKind};

use crate::theme;

/// A premium primary button with gradient, shadow, and hover effects.
pub fn primary_button(ui: &mut Ui, text: impl Into<WidgetText>, enabled: bool) -> Response {
    draw_premium_button(ui, text, true, enabled)
}

/// A secondary button (outline/ghost) with premium transparent look.
pub fn secondary_button(ui: &mut Ui, text: impl Into<WidgetText>, enabled: bool) -> Response {
    draw_premium_button(ui, text, false, enabled)
}

fn draw_premium_button(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    is_primary: bool,
    enabled: bool,
) -> Response {
    let text = text.into();
    let font = theme::font_body();

    let text_galley = text.into_galley(ui, Some(egui::TextWrapMode::Extend), f32::INFINITY, font);

    // Premium sizing
    let padding = ui.spacing().button_padding;
    let mut desired_size = text_galley.size() + padding * 2.0;

    // Enforce minimum premium height and width
    desired_size.y = desired_size.y.max(36.0); // 36px height
    desired_size.x = desired_size.x.max(120.0); // Minimum width for consistent look

    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    if ui.is_rect_visible(rect) {
        // State interaction
        let is_hovered = enabled && response.hovered();
        let is_clicked = enabled && response.is_pointer_button_down_on();

        // ─── Colors ───
        let (bg_fill, bg_stroke, text_color) = if is_primary {
            // Primary: Filled Accent
            let fill = if !enabled {
                theme::ACCENT.linear_multiply(0.4)
            } else if is_clicked {
                theme::ACCENT.linear_multiply(0.8)
            } else if is_hovered {
                theme::ACCENT_HOVER
            } else {
                theme::ACCENT
            };
            (fill, Stroke::NONE, if enabled { Color32::WHITE } else { Color32::from_white_alpha(150) })
        } else {
            // Secondary: Bordered / Surface
            let fill = if !enabled {
                Color32::TRANSPARENT
            } else if is_clicked {
                theme::bg_elevated().linear_multiply(0.9)
            } else if is_hovered {
                theme::bg_elevated()
            } else {
                Color32::TRANSPARENT
            };

            // Border logic
            let stroke = if !enabled {
                Stroke::new(1.0, theme::border().linear_multiply(0.5))
            } else if is_secondary_outline_visible(ui, is_hovered) {
                Stroke::new(1.0, theme::text_tertiary())
            } else {
                Stroke::new(1.0, theme::border())
            };

            let text = if !enabled {
                theme::text_tertiary().linear_multiply(0.5)
            } else if is_clicked || is_hovered {
                theme::text_primary()
            } else {
                theme::text_secondary()
            };

            (fill, stroke, text)
        };

        // ─── Shadows ───
        if is_primary && enabled && !is_clicked {
            let shadow = theme::premium_shadow(6, 20);
            ui.painter().add(shadow.as_shape(rect, CornerRadius::same(theme::BUTTON_ROUNDING)));
        }

        // ─── Background Paint ───
        ui.painter().rect(
            rect,
            CornerRadius::same(theme::BUTTON_ROUNDING),
            bg_fill,
            bg_stroke,
            StrokeKind::Inside,
        );

        // ─── Inner Bevel / Highlight (Primary Only) ───
        if is_primary && enabled {
            let stroke_color = Color32::from_white_alpha(30);
            ui.painter().rect_stroke(
                rect.shrink(1.0),
                CornerRadius::same(theme::BUTTON_ROUNDING),
                Stroke::new(1.0, stroke_color),
                StrokeKind::Inside,
            );
        }

        // ─── Text Paint ───
        let text_pos = ui
            .layout()
            .align_size_within_rect(text_galley.size(), rect)
            .min;
        ui.painter().galley(text_pos, text_galley, text_color);
    }

    if !enabled {
        response.on_hover_cursor(egui::CursorIcon::NotAllowed)
    } else {
        response
    }
}

/// Helper to determine if secondary border should be emphasized
fn is_secondary_outline_visible(_ui: &Ui, hovered: bool) -> bool {
    hovered || theme::is_dark_mode() // Always show outline in dark mode for contrast? Or just subtle.
}
