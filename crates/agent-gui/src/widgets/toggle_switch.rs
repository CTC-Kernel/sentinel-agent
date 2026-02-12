//! Premium toggle switch widget (iOS-style).

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, Vec2};

use crate::animation;
use crate::theme;

/// Draw a premium iOS-style toggle switch.
///
/// Returns the [`Response`] for the toggle interaction.
pub fn toggle_switch(ui: &mut Ui, on: &mut bool) -> Response {
    // Allocate MIN_TOUCH_TARGET height for accessibility, but draw at SWITCH_HEIGHT
    let desired_size = Vec2::new(theme::SWITCH_WIDTH, theme::MIN_TOUCH_TARGET);
    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    if response.clicked() {
        *on = !*on;
    }

    if ui.is_rect_visible(rect) {
        let time = ui.input(|i| i.time);
        let is_hovered = response.hovered();

        // Animation progress (smooth transition)
        let animation_id = response.id.with("anim");
        let anim_progress = ui.ctx().animate_bool(animation_id, *on);

        // Colors
        let bg_off = if theme::is_dark_mode() {
            theme::SWITCH_OFF_DARK
        } else {
            theme::SWITCH_OFF_LIGHT
        };
        let bg_on = theme::SUCCESS;
        let bg_color = animation::lerp_color(bg_off, bg_on, anim_progress);

        // Track (centered vertically within the touch target)
        let track_rect = egui::Rect::from_center_size(
            rect.center(),
            Vec2::new(theme::SWITCH_WIDTH, theme::SWITCH_HEIGHT),
        );
        let rounding = CornerRadius::same((track_rect.height() / 2.0).min(255.0) as u8);

        // Track shadow/glow when on
        if anim_progress > 0.5 {
            let glow_alpha = (anim_progress - 0.5) * 2.0 * theme::OPACITY_TINT;
            ui.painter().rect_filled(
                track_rect.expand(theme::BORDER_THICK),
                CornerRadius::same((track_rect.height() / 2.0 + theme::BORDER_THICK).min(255.0) as u8),
                bg_on.linear_multiply(glow_alpha),
            );
        }

        // Track background
        ui.painter().rect_filled(track_rect, rounding, bg_color);

        // Track border (subtle)
        let border_alpha = if is_hovered { theme::OPACITY_MUTED } else { theme::OPACITY_TINT };
        ui.painter().rect_stroke(
            track_rect,
            rounding,
            Stroke::new(theme::BORDER_HAIRLINE, Color32::from_white_alpha((border_alpha * 255.0_f32).clamp(0.0, 255.0) as u8)),
            egui::StrokeKind::Inside,
        );

        // Knob
        let knob_radius = (track_rect.height() / 2.0) - theme::BORDER_THICK;
        let knob_x = egui::lerp(
            track_rect.left() + knob_radius + theme::BORDER_THICK..=track_rect.right() - knob_radius - theme::BORDER_THICK,
            anim_progress,
        );
        let knob_center = egui::pos2(knob_x, track_rect.center().y);

        // Knob shadow
        ui.painter().circle_filled(
            knob_center + Vec2::new(0.0, 1.0),
            knob_radius,
            Color32::from_black_alpha(theme::SUBTLE_HIGHLIGHT_ALPHA),
        );

        // Knob main
        let knob_color = Color32::WHITE;
        ui.painter()
            .circle_filled(knob_center, knob_radius, knob_color);

        // Knob highlight (top arc effect)
        let highlight_pulse = if is_hovered {
            animation::pulse(time, theme::ANIM_PULSE_SPEED, 0.8, 1.0)
        } else {
            1.0
        };
        ui.painter().circle_stroke(
            knob_center,
            knob_radius - theme::BORDER_THIN,
            Stroke::new(
                theme::BORDER_THIN,
                Color32::from_white_alpha((theme::KNOB_HIGHLIGHT_BASE * highlight_pulse).clamp(0.0, 255.0) as u8),
            ),
        );

        // Focus ring for keyboard navigation
        if response.has_focus() {
            ui.painter().rect_stroke(
                track_rect,
                rounding,
                theme::focus_ring(),
                egui::StrokeKind::Outside,
            );
        }

        // Only request repaint while animation is still transitioning
        if anim_progress > 0.0 && anim_progress < 1.0 {
            ui.ctx().request_repaint();
        }
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

