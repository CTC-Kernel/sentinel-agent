use crate::theme;
use egui::{RichText, Stroke, Ui, Vec2};

/// Renders a premium "Protected" state with a pulsing animation.
///
/// * `icon` - The main icon to display (e.g. SHIELD_CHECK).
/// * `title` - Main headline (e.g. "Système Protégé").
/// * `subtitle` - Detailed reassurance (e.g. "Aucune menace détectée.").
pub fn protected_state(ui: &mut Ui, icon: &str, title: &str, subtitle: &str) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_XL);

        let reduced = theme::is_reduced_motion();
        let icon_size = theme::EMPTY_STATE_ICON; // 64.0
        let base_color = theme::SUCCESS;

        // Animation parameters
        let (pulse, ripple_pulse) = if reduced {
            (0.5_f64, 0.0_f64) // Static midpoint
        } else {
            let time = ui.input(|i| i.time);
            let pulse_speed = 2.0;
            let p = (time * pulse_speed).sin() * 0.5 + 0.5;
            let r = ((time * pulse_speed * 0.8).rem_euclid(std::f64::consts::PI * 2.0))
                .sin()
                .max(0.0);
            (p, r)
        };

        // Allocate space for the animated icon
        let (rect, _resp) =
            ui.allocate_exact_size(Vec2::splat(icon_size * 2.5), egui::Sense::hover());
        let center = rect.center();

        if !reduced {
            // 1. Outer Ring (fading, expanding)
            let max_radius = icon_size * 1.1;
            let ring_radius =
                (icon_size * 0.6) + (max_radius - (icon_size * 0.6)) * ripple_pulse as f32;
            let ring_alpha = theme::OPACITY_TINT * (1.0 - ripple_pulse as f32);

            ui.painter().circle_stroke(
                center,
                ring_radius,
                Stroke::new(theme::BORDER_THICK, base_color.linear_multiply(ring_alpha)),
            );

            // 2. Multi-layered Diffuse Glow (breathing)
            let glow_base_radius = icon_size * 0.6;
            let glow_pulse = pulse as f32;

            for i in (0..12).rev() {
                let layer_radius = glow_base_radius * (1.1 + i as f32 * 0.15 + glow_pulse * 0.1);
                let layer_alpha = theme::OPACITY_SUBTLE / (i as f32 * 0.8 + 1.0).powi(2);
                ui.painter().circle_filled(
                    center,
                    layer_radius,
                    base_color.linear_multiply(layer_alpha * (0.5 + 0.5 * glow_pulse)),
                );
            }
        } else {
            // Static glow ring when reduced motion
            ui.painter().circle_stroke(
                center,
                icon_size * 0.7,
                Stroke::new(theme::BORDER_THICK, base_color.linear_multiply(theme::OPACITY_TINT)),
            );
        }

        // 3. The Icon itself
        ui.painter().text(
            center,
            egui::Align2::CENTER_CENTER,
            icon,
            egui::FontId::proportional(icon_size),
            base_color,
        );

        ui.add_space(theme::SPACE_MD);

        // Title
        ui.label(
            RichText::new(title)
                .font(theme::font_heading())
                .color(theme::text_primary())
                .strong(),
        );

        // Subtitle
        ui.add_space(theme::SPACE_XS);
        ui.label(
            RichText::new(subtitle)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );

        ui.add_space(theme::SPACE_XL);

        if !reduced {
            ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
        }
    });
}
