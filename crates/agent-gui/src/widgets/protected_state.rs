// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! "Nothing to report" state — the screen an operator should be glad to see.

use crate::theme;
use egui::{RichText, Stroke, Ui, Vec2};

/// Diameter of the icon medallion, as a multiple of the icon size.
const MEDALLION_SCALE: f32 = 1.6;
/// Seconds per breath of the ripple.
const RIPPLE_PERIOD: f64 = 4.0;

/// Render a reassuring empty state: a medallion, a headline and one line of
/// detail.
///
/// The previous version stacked twelve translucent circles to fake a glow.
/// egui composites in linear space, so those layers accumulated into a
/// saturated green blob rather than a halo — and it pulsed twice a second,
/// which is an alarm's cadence, not an "all clear".
///
/// * `icon` - The main icon (e.g. SHIELD_CHECK).
/// * `title` - Headline (e.g. "Aucune menace détectée").
/// * `subtitle` - One line of detail.
pub fn protected_state(ui: &mut Ui, icon: &str, title: &str, subtitle: &str) {
    hero_state(ui, icon, title, subtitle, theme::SUCCESS);
}

/// Same medallion, in a semantic colour of the caller's choosing.
///
/// Use `SUCCESS` for "all clear", `INFO` or a neutral for "nothing here yet",
/// `WARNING` when the emptiness itself is the problem. Colour and icon should
/// agree: a green warning triangle tells the operator two opposite things.
pub fn hero_state(ui: &mut Ui, icon: &str, title: &str, subtitle: &str, color: egui::Color32) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_2XL);

        let reduced = theme::is_reduced_motion();
        let icon_size = theme::EMPTY_STATE_ICON;
        let accent = theme::readable_color(color);
        let medallion_radius = icon_size * MEDALLION_SCALE / 2.0;

        let (rect, _resp) =
            ui.allocate_exact_size(Vec2::splat(icon_size * 2.2), egui::Sense::hover());
        let center = rect.center();
        let painter = ui.painter();

        // One slow ripple, expanding out of the medallion and fading as it
        // goes: enough to say the agent is live, quiet enough to ignore.
        if !reduced {
            let time = ui.input(|i| i.time);
            let phase = (time / RIPPLE_PERIOD).fract() as f32;
            let radius = medallion_radius * (1.0 + phase * 0.55);
            painter.circle_stroke(
                center,
                radius,
                Stroke::new(
                    theme::BORDER_THIN,
                    theme::with_alpha(accent, (40.0 * (1.0 - phase)) as u8),
                ),
            );
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(33));
        }

        // Medallion: an opaque tint of the semantic colour, so it reads the
        // same over any surface it lands on.
        painter.circle_filled(center, medallion_radius, theme::tinted_surface(accent));
        painter.circle_stroke(
            center,
            medallion_radius,
            Stroke::new(theme::BORDER_THIN, theme::with_alpha(accent, 70)),
        );
        painter.text(
            center,
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_icon(icon_size * 0.62),
            accent,
        );

        ui.add_space(theme::SPACE_LG);
        ui.label(
            RichText::new(title)
                .font(theme::font_h2())
                .color(theme::text_primary()),
        );
        ui.add_space(theme::SPACE_XS);
        ui.label(
            RichText::new(subtitle)
                .font(theme::font_body_lg())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_2XL);
    });
}
