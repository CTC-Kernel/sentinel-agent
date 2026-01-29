//! About page.

use egui::Ui;

use crate::theme;
use crate::widgets;

/// Company and product branding.
mod branding {
    pub const COMPANY: &str = "Cyber Threat Consulting";
    pub const PRODUCT: &str = "Sentinel Agent";
    pub const WEBSITE: &str = "https://cyber-threat-consulting.com";
    pub const DASHBOARD: &str = "https://app.cyber-threat-consulting.com";
    pub const EMAIL: &str = "contact@cyber-threat-consulting.com";
    pub const GUIDE: &str = "https://cyber-threat-consulting.com/docs/sentinel-agent";
}

pub struct AboutPage;

impl AboutPage {
    pub fn show(ui: &mut Ui) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "\u{00c0} propos",
                None,
            );

            // Brand card
            widgets::card(ui, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(theme::SPACE_LG);
                    ui.label(
                        egui::RichText::new(branding::PRODUCT)
                            .font(egui::FontId::proportional(28.0))
                            .color(theme::ACCENT)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(format!(
                            "Version {}",
                            agent_common::constants::AGENT_VERSION
                        ))
                        .font(theme::font_body())
                        .color(theme::TEXT_SECONDARY),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(branding::COMPANY)
                            .font(theme::font_body())
                            .color(theme::TEXT_PRIMARY),
                    );
                    ui.add_space(theme::SPACE_LG);
                });
            });

            ui.add_space(theme::SPACE);

            // System info
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Informations syst\u{00e8}me")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                Self::info_row(ui, "Syst\u{00e8}me d'exploitation", &format!(
                    "{} {}",
                    std::env::consts::OS,
                    std::env::consts::ARCH
                ));
                Self::info_row(ui, "\u{00c9}dition Rust", env!("CARGO_PKG_VERSION"));
            });

            ui.add_space(theme::SPACE);

            // Links
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Liens utiles")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);

                Self::link_row(ui, "Site web", branding::WEBSITE);
                Self::link_row(ui, "Tableau de bord", branding::DASHBOARD);
                Self::link_row(ui, "Guide utilisateur", branding::GUIDE);
                Self::link_row(ui, "Contact", &format!("mailto:{}", branding::EMAIL));
            });

            ui.add_space(theme::SPACE);

            // Legal
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("Mentions l\u{00e9}gales")
                        .font(theme::font_heading())
                        .color(theme::TEXT_PRIMARY),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(
                        "\u{00a9} 2024\u{2013}2026 Cyber Threat Consulting. Tous droits r\u{00e9}serv\u{00e9}s.",
                    )
                    .font(theme::font_small())
                    .color(theme::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new(
                        "Ce logiciel est la propri\u{00e9}t\u{00e9} de Cyber Threat Consulting.\n\
                         Toute reproduction ou distribution non autoris\u{00e9}e est interdite.",
                    )
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY),
                );
            });
        });
    }

    fn info_row(ui: &mut Ui, label: &str, value: &str) {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(format!("{}:", label))
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::TEXT_PRIMARY),
            );
        });
    }

    fn link_row(ui: &mut Ui, label: &str, url: &str) {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(format!("{}:", label))
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            if ui
                .link(
                    egui::RichText::new(url)
                        .font(theme::font_body())
                        .color(theme::ACCENT_LIGHT),
                )
                .clicked()
            {
                let _ = open::that(url);
            }
        });
    }
}
