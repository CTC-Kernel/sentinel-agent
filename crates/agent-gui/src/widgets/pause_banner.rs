// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Strip under the top bar while protection is paused.
//!
//! A pause turns scanning, detection and automatic response off. The state
//! used to be visible only on the settings card that started it; this strip
//! says so on every page, with the time protection resumes on its own and a
//! way to resume now.

use crate::icons;
use crate::theme;
use crate::widgets;

/// Height of the strip.
pub const PAUSE_BANNER_HEIGHT: f32 = 44.0;

/// Draw the strip as a top panel. Returns `true` when "Reprendre
/// maintenant" was clicked.
pub fn pause_banner(
    ctx: &egui::Context,
    resumes_at: Option<chrono::DateTime<chrono::Utc>>,
) -> bool {
    let tint = theme::readable_color(theme::WARNING);
    let mut resume = false;
    egui::TopBottomPanel::top("pause_banner")
        .exact_height(PAUSE_BANNER_HEIGHT)
        .frame(
            egui::Frame::new()
                .fill(theme::tinted_surface(theme::WARNING))
                .inner_margin(egui::Margin::symmetric(theme::SPACE as i8, 0)),
        )
        .show(ctx, |ui| {
            ui.horizontal_centered(|ui| {
                let until = resumes_at
                    .map(|at| format!(" — reprise automatique à {}", crate::format::local_time(at)))
                    .unwrap_or_default();
                ui.label(
                    egui::RichText::new(format!(
                        "{}  Protection en pause : aucune analyse ni détection{until}",
                        icons::WARNING
                    ))
                    .font(theme::font_body_strong())
                    .color(tint),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    resume = widgets::secondary_button(
                        ui,
                        format!("{}  Reprendre maintenant", icons::PLAY),
                        true,
                    )
                    .clicked();
                });
            });
        });
    resume
}
