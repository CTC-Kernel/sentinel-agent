// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Splash screen shown for the first seconds after launch.
//!
//! A widget rather than a method on the app, so the preview harness can
//! render it and the first thing a user sees can be reviewed like any
//! other surface.

use crate::theme;

/// Draw the splash for `elapsed` seconds since launch.
pub fn splash_screen(ctx: &egui::Context, elapsed: f32) {
    // Respect reduced-motion: skip fade animations, show static splash.
    let (alpha, progress) = if theme::is_reduced_motion() {
        (1.0_f32, (elapsed / theme::SPLASH_DURATION).min(1.0))
    } else {
        let a = if elapsed < theme::SPLASH_FADE_IN {
            elapsed / theme::SPLASH_FADE_IN
        } else if elapsed > theme::SPLASH_FADE_OUT_START {
            1.0 - ((elapsed - theme::SPLASH_FADE_OUT_START) / theme::SPLASH_FADE_OUT_DURATION)
                .min(1.0)
        } else {
            1.0
        };
        (a, (elapsed / theme::SPLASH_DURATION).min(1.0))
    };
    egui::CentralPanel::default()
        .frame(egui::Frame::new().fill(theme::bg_primary()))
        .show(ctx, |ui: &mut egui::Ui| {
            let size = ui.available_size();
            ui.allocate_new_ui(
                egui::UiBuilder::new().max_rect(egui::Rect::from_center_size(
                    egui::pos2(size.x / 2.0, size.y / 2.0),
                    egui::vec2(theme::SPLASH_CONTENT_WIDTH, theme::SPLASH_CONTENT_HEIGHT),
                )),
                |ui: &mut egui::Ui| {
                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        // Logo image
                        // Tint white, not text_primary: tinting with the
                        // light theme's near-black text colour multiplied
                        // the mark to black instead of fading it.
                        let logo = egui::Image::from_bytes(
                            "bytes://ia_logo",
                            include_bytes!("../../assets/IA.png"),
                        )
                        .max_width(theme::ENROLLMENT_LOGO_WIDTH)
                        .tint(egui::Color32::WHITE.linear_multiply(alpha));
                        ui.add(logo);

                        ui.add_space(theme::SPACE_LG);

                        // SENTINEL
                        ui.label(
                            egui::RichText::new("SENTINEL")
                                .font(theme::font_splash())
                                .color(theme::text_primary().linear_multiply(alpha))
                                .extra_letter_spacing(theme::TRACKING_WIDE * 4.0),
                        );

                        ui.add_space(theme::SPACE_XS);

                        // GRC AGENT
                        ui.label(
                            egui::RichText::new("GRC AGENT")
                                .font(theme::font_label())
                                .color(theme::accent_text().linear_multiply(alpha))
                                .extra_letter_spacing(theme::TRACKING_WIDE * 3.0),
                        );

                        ui.add_space(theme::SPACE_XL);

                        // Progress bar (animated, or static under reduced motion)
                        let bar_w = theme::SPLASH_PROGRESS_WIDTH;
                        let bar_h = theme::PROGRESS_BAR_HEIGHT_THIN;
                        let (bar_rect, _) =
                            ui.allocate_exact_size(egui::vec2(bar_w, bar_h), egui::Sense::empty());
                        let painter = ui.painter_at(bar_rect);
                        painter.rect_filled(
                            bar_rect,
                            egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                            theme::bg_tertiary(),
                        );
                        let fill_rect = egui::Rect::from_min_size(
                            bar_rect.min,
                            egui::vec2(bar_w * progress, bar_h),
                        );
                        painter.rect_filled(
                            fill_rect,
                            egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                            theme::ACCENT.linear_multiply(alpha),
                        );

                        ui.add_space(theme::SPACE_LG);

                        // CYBER THREAT CONSULTING
                        ui.label(
                            egui::RichText::new("CYBER THREAT CONSULTING")
                                .font(theme::font_micro())
                                .color(theme::text_tertiary().linear_multiply(alpha))
                                .extra_letter_spacing(theme::TRACKING_WIDE * 2.0),
                        );
                    });
                },
            );
        });
}
