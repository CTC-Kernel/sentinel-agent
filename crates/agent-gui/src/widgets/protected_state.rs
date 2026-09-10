// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use crate::theme;
use egui::{RichText, Ui};

/// Calm confirmation state. Only use for an evaluated, successful outcome.
pub fn protected_state(ui: &mut Ui, icon: &str, title: &str, subtitle: &str) {
    ui.vertical_centered(|ui| {
        ui.add_space(theme::SPACE_LG);
        let (rect, _) = ui.allocate_exact_size(egui::vec2(56.0, 56.0), egui::Sense::hover());
        ui.painter()
            .circle_filled(rect.center(), 28.0, theme::badge_bg(theme::SUCCESS));
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_icon(24.0),
            theme::readable_color(theme::SUCCESS),
        );
        ui.add_space(theme::SPACE);
        ui.label(
            RichText::new(title)
                .font(theme::font_heading())
                .color(theme::text_primary())
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);
        ui.label(
            RichText::new(subtitle)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_LG);
    });
}
