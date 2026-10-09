// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Consistent workspace introductions and editorial section hierarchy.
use crate::{icons, theme};
use egui::{RichText, Ui};

pub fn page_header_nav(
    ui: &mut Ui,
    breadcrumbs: &[&str],
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) -> Option<usize> {
    workspace_header(
        ui,
        breadcrumbs.first().copied().unwrap_or("Sentinel"),
        breadcrumbs.last().copied().unwrap_or(title),
        title,
        subtitle,
        help_text,
    );
    None
}

pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>, help_text: Option<&str>) {
    workspace_header(ui, "Sentinel", title, title, subtitle, help_text);
}

fn workspace_header(
    ui: &mut Ui,
    section: &str,
    destination: &str,
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) {
    let icon = match destination {
        "Tableau de bord" => icons::DASHBOARD,
        "Surveillance" => icons::CHART_LINE,
        "Notifications" => icons::BELL,
        "Menaces" => icons::SHIELD_VIRUS,
        "Vulnérabilités" => icons::VULNERABILITIES,
        "FIM" => icons::FILE_SHIELD,
        "Réseau" => icons::NETWORK,
        "Conformité" => icons::CLIPBOARD_CHECK,
        "Risques" => icons::SCALE_BALANCED,
        "Rapports" => icons::FILE_EXPORT,
        "Inventaire" => icons::BOXES_STACKED,
        "Logiciels" => icons::SOFTWARE,
        "Détection" => icons::DISCOVERY,
        "Cartographie" => icons::CARTOGRAPHY,
        "Synchronisation" => icons::SYNC,
        "Journal d'audit" => icons::CLIPBOARD,
        "Configuration" => icons::GEAR,
        "Terminal" => icons::TERMINAL,
        "À propos" => icons::ABOUT,
        _ => icons::SHIELD,
    };
    let width = ui.available_width();
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = theme::SPACE_MD;
        let emblem = width >= 540.0;
        if emblem {
            super::instrument_glyph(ui, icon, theme::ACCENT, 64.0);
        }
        ui.vertical(|ui| {
            ui.set_width((width - if emblem { 64.0 + theme::SPACE_MD } else { 0.0 }).max(1.0));
            eyebrow(ui, &section.to_uppercase());
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(title)
                        .font(theme::font_h1())
                        .color(theme::text_primary()),
                );
                if let Some(help) = help_text {
                    super::help_button(ui, help);
                }
            });
            if let Some(lead) = subtitle {
                ui.label(
                    RichText::new(lead)
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
            }
        });
    });
}

pub fn section_header(ui: &mut Ui, title: &str, caption: Option<&str>) {
    ui.add_space(theme::SPACE_LG);
    ui.horizontal(|ui| {
        let (marker, _) = ui.allocate_exact_size(egui::vec2(3.0, 18.0), egui::Sense::hover());
        ui.painter().rect_filled(marker, 1.5, theme::accent_text());
        ui.add_space(theme::SPACE_XS);
        ui.label(
            RichText::new(title)
                .font(theme::font_h3())
                .color(theme::text_primary()),
        );
        let remaining = ui.available_width();
        if remaining > 24.0 {
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(remaining, 1.0), egui::Sense::hover());
            ui.painter().hline(
                rect.x_range(),
                rect.center().y,
                egui::Stroke::new(0.5_f32, theme::border_subtle()),
            );
        }
    });
    if let Some(caption) = caption {
        ui.add_space(theme::SPACE_XS);
        ui.label(
            RichText::new(caption)
                .font(theme::font_body())
                .color(theme::text_tertiary()),
        );
    }
    ui.add_space(theme::SPACE_MD);
}

pub fn eyebrow(ui: &mut Ui, text: &str) {
    ui.label(
        RichText::new(text)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_WIDE),
    );
}
