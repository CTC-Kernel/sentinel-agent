// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Page sub-header.
//!
//! The page title lives in the global top bar, which is always visible; a
//! second H1 in the body would only repeat it. What the body owes the reader
//! is the one line explaining what this page is for, and a way to get help.
//!
//! The previous version drew a gradient rule under that line and animated its
//! brightness continuously, forcing a repaint every 100ms on every page for a
//! decoration nobody reads. It is gone: the space below the lead does the same
//! separating work, silently.

use egui::Ui;

use crate::theme;

/// Draw a page sub-header (lead line + contextual help).
///
/// `breadcrumbs` and `title` are retained in the signature so each page keeps
/// declaring its location in one place; both are surfaced by the top bar.
/// Always returns `None` — nothing here is clickable.
pub fn page_header_nav(
    ui: &mut Ui,
    breadcrumbs: &[&str],
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) -> Option<usize> {
    let _ = breadcrumbs;
    page_header(ui, title, subtitle, help_text);
    None
}

/// Draw a page sub-header: the lead line and its contextual help.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>, help_text: Option<&str>) {
    let _ = title; // Surfaced by the global top bar, not repeated in the body.

    if subtitle.is_none() && help_text.is_none() {
        return;
    }

    ui.horizontal(|ui: &mut Ui| {
        if let Some(lead) = subtitle {
            ui.label(
                egui::RichText::new(lead)
                    .font(theme::font_body_lg())
                    .color(theme::text_secondary()),
            );
        }
        if let Some(help) = help_text {
            ui.add_space(theme::SPACE_SM);
            super::help_button(ui, help);
        }
    });
    ui.add_space(theme::SPACE_LG);
}

/// Draw a section heading inside a page body.
///
/// Use between blocks of a long page — a heading, an optional caption, and the
/// vertical rhythm that separates it from what came before.
pub fn section_header(ui: &mut Ui, title: &str, caption: Option<&str>) {
    ui.add_space(theme::SPACE_LG);
    ui.label(
        egui::RichText::new(title)
            .font(theme::font_h3())
            .color(theme::text_primary()),
    );
    if let Some(caption) = caption {
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(caption)
                .font(theme::font_body())
                .color(theme::text_tertiary()),
        );
    }
    ui.add_space(theme::SPACE_MD);
}

/// Draw an uppercase eyebrow label — the smallest step in the heading scale.
pub fn eyebrow(ui: &mut Ui, text: &str) {
    ui.label(
        egui::RichText::new(text)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_WIDE),
    );
}
