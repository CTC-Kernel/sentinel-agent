// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! "Nothing to report" state — the screen an operator should be glad to see.

use crate::theme;
use egui::{RichText, Ui};

/// Render a reassuring empty state: a medallion, a headline and one line of
/// detail.
///
/// Static geometry keeps empty data from implying active monitoring.
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

        super::instrument_glyph(ui, icon, color, 104.0);

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
