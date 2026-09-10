// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Consistent editorial hierarchy for every workspace page.
use crate::theme;
use egui::Ui;

pub fn page_header_nav(
    ui: &mut Ui,
    breadcrumbs: &[&str],
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) -> Option<usize> {
    if let Some(domain) = breadcrumbs.first() {
        ui.label(
            egui::RichText::new(domain.to_uppercase())
                .font(theme::font_small())
                .color(theme::accent_text())
                .extra_letter_spacing(1.4)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);
    }
    page_header(ui, title, subtitle, help_text);
    None
}

pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>, help_text: Option<&str>) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            egui::RichText::new(title)
                .size(28.0)
                .color(theme::text_primary())
                .strong(),
        );
        if let Some(help) = help_text {
            super::help_button(ui, help);
        }
    });
    if let Some(subtitle) = subtitle {
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(subtitle)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
    }
    ui.add_space(theme::SPACE);
}
