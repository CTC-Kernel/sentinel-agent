//! Premium toggle switch widget (iOS-style).

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, Vec2};

use crate::theme;

/// Draw a premium iOS-style toggle switch.
///
/// Returns the [`Response`] for the toggle interaction.
pub fn toggle_switch(ui: &mut Ui, on: &mut bool) -> Response {
    let desired_size = Vec2::new(44.0, 24.0);
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
            Color32::from_rgb(60, 60, 67)
        } else {
            Color32::from_rgb(200, 200, 206)
        };
        let bg_on = theme::SUCCESS;
        let bg_color = lerp_color(bg_off, bg_on, anim_progress);
        
        // Track
        let track_rect = rect;
        let rounding = CornerRadius::same((rect.height() / 2.0) as u8);
        
        // Track shadow/glow when on
        if anim_progress > 0.5 {
            let glow_alpha = (anim_progress - 0.5) * 2.0 * 0.15;
            ui.painter().rect_filled(
                track_rect.expand(2.0),
                CornerRadius::same((rect.height() / 2.0 + 2.0) as u8),
                bg_on.linear_multiply(glow_alpha),
            );
        }
        
        // Track background
        ui.painter().rect_filled(track_rect, rounding, bg_color);
        
        // Track border (subtle)
        let border_alpha = if is_hovered { 0.3 } else { 0.15 };
        ui.painter().rect_stroke(
            track_rect,
            rounding,
            Stroke::new(0.5, Color32::from_white_alpha((border_alpha * 255.0) as u8)),
            egui::StrokeKind::Inside,
        );
        
        // Knob
        let knob_radius = (rect.height() / 2.0) - 2.0;
        let knob_x = egui::lerp(
            rect.left() + knob_radius + 2.0..=rect.right() - knob_radius - 2.0,
            anim_progress,
        );
        let knob_center = egui::pos2(knob_x, rect.center().y);
        
        // Knob shadow
        ui.painter().circle_filled(
            knob_center + Vec2::new(0.0, 1.0),
            knob_radius,
            Color32::from_black_alpha(30),
        );
        
        // Knob main
        let knob_color = Color32::WHITE;
        ui.painter().circle_filled(knob_center, knob_radius, knob_color);
        
        // Knob highlight (top arc effect)
        let highlight_pulse = if is_hovered {
            let pulse = (time * 2.0).sin() * 0.1 + 0.9;
            pulse as f32
        } else {
            1.0
        };
        ui.painter().circle_stroke(
            knob_center,
            knob_radius - 1.0,
            Stroke::new(1.0, Color32::from_white_alpha((50.0 * highlight_pulse) as u8)),
        );
        
        // Request repaint for smooth animation
        ui.ctx().request_repaint();
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

/// Linearly interpolate between two colors.
fn lerp_color(a: Color32, b: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    Color32::from_rgba_unmultiplied(
        ((a.r() as f32) * (1.0 - t) + (b.r() as f32) * t) as u8,
        ((a.g() as f32) * (1.0 - t) + (b.g() as f32) * t) as u8,
        ((a.b() as f32) * (1.0 - t) + (b.b() as f32) * t) as u8,
        ((a.a() as f32) * (1.0 - t) + (b.a() as f32) * t) as u8,
    )
}
