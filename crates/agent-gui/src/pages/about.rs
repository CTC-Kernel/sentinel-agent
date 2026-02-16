//! About page.

use egui::Ui;

use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Minimum height for info/link rows.
const INFO_ROW_MIN_HEIGHT: f32 = 28.0;

/// Company and product branding.
pub mod branding {
    pub const COMPANY: &str = "Cyber Threat Consulting";
    pub const PRODUCT: &str = "Sentinel Agent";
    pub const WEBSITE: &str = "https://cyber-threat-consulting.com";
    pub const EMAIL: &str = "***REMOVED***";
    pub const GUIDE: &str = "https://cyber-threat-consulting.com/docs/sentinel-agent";
    pub const CONSOLE: &str = "https://app.cyber-threat-consulting.com";
}

pub struct AboutPage;

impl AboutPage {
    pub fn show(ui: &mut Ui) -> Option<GuiCommand> {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "\u{00c0} propos",
            Some("Informations sur le produit et support technique"),
            Some(
                "Informations sur la version de l'agent Sentinel et les crédits. En cas de support, veuillez mentionner le numéro de build et l'identifiant unique de votre installation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Brand card
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.add_space(theme::SPACE_LG);
                ui.label(
                    egui::RichText::new(icons::VULNERABILITIES)
                        .size(theme::ICON_2XL)
                        .color(theme::accent_text()),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(branding::PRODUCT)
                        .size(theme::ICON_XL)
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(format!(
                        "VERSION {}",
                        agent_common::constants::AGENT_VERSION
                    ))
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
                );
                ui.add_space(theme::SPACE_MD);
                ui.label(
                    egui::RichText::new(branding::COMPANY)
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_LG);
            });
        });

        ui.add_space(theme::SPACE);

        let total_width = ui.available_width();
        let col_gap = theme::SPACE;
        let col_w = (total_width - col_gap) * 0.5;
        ui.horizontal_top(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.x = col_gap;
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(col_w);
                // System info
                widgets::card(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("SYST\u{00c8}ME")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    Self::info_row(
                        ui,
                        "OS",
                        &format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
                        icons::ARROW_RIGHT,
                    );
                    Self::info_row(ui, "Moteur", "Rust v1.85+", icons::ARROW_RIGHT);
                    Self::info_row(ui, "Version", env!("CARGO_PKG_VERSION"), icons::ARROW_RIGHT);
                });
            }); // end left vertical

            // Links
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(col_w);
                widgets::card(ui, |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("RESSOURCES")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    Self::link_row(ui, "Site officiel", branding::WEBSITE, icons::ARROW_RIGHT);
                    Self::link_row(ui, "Documentation", branding::GUIDE, icons::ARROW_RIGHT);
                    Self::link_row(
                        ui,
                        "Support",
                        &format!("mailto:{}", branding::EMAIL),
                        icons::ARROW_RIGHT,
                    );
                });
            }); // end right vertical
        });

        ui.add_space(theme::SPACE);

        // Legal
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("MENTIONS L\u{00c9}GALES")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);
            ui.label(
                egui::RichText::new(
                    "\u{00a9} 2024\u{2013}2026 Cyber Threat Consulting. Tous droits r\u{00e9}serv\u{00e9}s.",
                )
                .font(theme::font_small())
                .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(
                    "Ce logiciel est la propri\u{00e9}t\u{00e9} exclusive de Cyber Threat Consulting. \
                     Toute reproduction ou distribution non autoris\u{00e9}e est strictement interdite.",
                )
                .font(theme::font_small())
                .color(theme::text_tertiary()),
            );
        });

        ui.add_space(theme::SPACE_XL);
        None
    }

    fn info_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.set_min_height(INFO_ROW_MIN_HEIGHT);
            ui.label(
                egui::RichText::new(icon)
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(value)
                            .font(theme::font_mono())
                            .color(theme::text_primary())
                            .strong(),
                    );
                },
            );
        });
    }

    fn link_row(ui: &mut Ui, label: &str, url: &str, icon: &str) {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.set_min_height(INFO_ROW_MIN_HEIGHT);
            ui.label(
                egui::RichText::new(icon)
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if ui
                        .link(
                            egui::RichText::new("OUVRIR")
                                .font(theme::font_small())
                                .color(theme::accent_text())
                                .strong(),
                        )
                        .clicked()
                        && (url.starts_with("https://") || url.starts_with("mailto:"))
                        && let Err(e) = open::that(url) {
                            tracing::warn!("Failed to open URL {}: {}", url, e);
                        }
                },
            );
        });
    }
}
