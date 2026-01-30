//! Network Discovery page — scan, discover, and propose assets.

use egui::Ui;
use egui_extras::{Column, TableBuilder};
use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct DiscoveryPage;

impl DiscoveryPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<crate::events::GuiCommand> {
        let mut cmd: Option<crate::events::GuiCommand> = None;

        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "D\u{00e9}couverte R\u{00e9}seau",
                    Some("Scanner et cartographier les appareils du r\u{00e9}seau local"),
                );
                ui.add_space(theme::SPACE_LG);

                // Control bar
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        let btn_label = if state.discovery_in_progress {
                            "ARR\u{00ca}TER LE SCAN"
                        } else {
                            "LANCER LE SCAN"
                        };
                        let btn_color = if state.discovery_in_progress {
                            theme::ERROR
                        } else {
                            theme::ACCENT
                        };

                        let btn = egui::Button::new(
                            egui::RichText::new(btn_label)
                                .font(theme::font_body())
                                .strong()
                                .color(theme::TEXT_ON_ACCENT),
                        )
                        .fill(btn_color)
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                        if ui.add(btn).clicked() {
                            if state.discovery_in_progress {
                                cmd = Some(crate::events::GuiCommand::StopDiscovery);
                            } else {
                                cmd = Some(crate::events::GuiCommand::StartDiscovery);
                            }
                        }

                        ui.add_space(theme::SPACE_MD);

                        // Progress
                        if state.discovery_in_progress {
                            ui.add_space(theme::SPACE_SM);
                            let progress = state.discovery_progress;
                            let bar_width = 200.0;
                            let (bar_rect, _) = ui.allocate_exact_size(
                                egui::Vec2::new(bar_width, 6.0),
                                egui::Sense::hover(),
                            );
                            if ui.is_rect_visible(bar_rect) {
                                ui.painter().rect_filled(
                                    bar_rect,
                                    egui::CornerRadius::same(3),
                                    theme::BG_ELEVATED,
                                );
                                let fill_rect = egui::Rect::from_min_size(
                                    bar_rect.min,
                                    egui::Vec2::new(bar_width * progress, 6.0),
                                );
                                ui.painter().rect_filled(
                                    fill_rect,
                                    egui::CornerRadius::same(3),
                                    theme::ACCENT,
                                );
                            }
                            ui.add_space(theme::SPACE_SM);
                            ui.label(
                                egui::RichText::new(&state.discovery_phase)
                                    .font(theme::font_small())
                                    .color(theme::TEXT_SECONDARY),
                            );
                        }

                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new(format!(
                                "{} appareil(s) d\u{00e9}couvert(s)",
                                state.discovered_devices.len()
                            ))
                            .font(theme::font_body())
                            .color(theme::TEXT_SECONDARY),
                        );
                    });
                });

                ui.add_space(theme::SPACE_MD);

                // Device table
                if state.discovered_devices.is_empty() && !state.discovery_in_progress {
                    // Empty state
                    widgets::card(ui, |ui| {
                        ui.vertical_centered(|ui| {
                            ui.add_space(theme::SPACE_XL * 2.0);
                            ui.label(
                                egui::RichText::new("Aucun appareil d\u{00e9}couvert")
                                    .font(theme::font_heading())
                                    .color(theme::TEXT_TERTIARY),
                            );
                            ui.add_space(theme::SPACE_SM);
                            ui.label(
                                egui::RichText::new(
                                    "Lancez un scan pour cartographier votre r\u{00e9}seau",
                                )
                                .font(theme::font_body())
                                .color(theme::TEXT_TERTIARY),
                            );
                            ui.add_space(theme::SPACE_XL * 2.0);
                        });
                    });
                } else if !state.discovered_devices.is_empty() {
                    // Device table using TableBuilder
                    widgets::card(ui, |ui| {
                        let table = TableBuilder::new(ui)
                            .striped(true)
                            .resizable(true)
                            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                            .column(Column::initial(100.0).at_least(80.0)) // IP
                            .column(Column::initial(140.0).at_least(100.0)) // Hostname
                            .column(Column::initial(140.0).at_least(100.0)) // MAC
                            .column(Column::initial(100.0).at_least(80.0)) // Vendor
                            .column(Column::initial(80.0).at_least(60.0))  // Type
                            .column(Column::initial(100.0).at_least(80.0)) // Ports
                            .column(Column::remainder()); // Actions

                        table
                            .header(28.0, |mut header| {
                                header.col(|ui| { ui.strong("IP"); });
                                header.col(|ui| { ui.strong("HOSTNAME"); });
                                header.col(|ui| { ui.strong("MAC"); });
                                header.col(|ui| { ui.strong("VENDOR"); });
                                header.col(|ui| { ui.strong("TYPE"); });
                                header.col(|ui| { ui.strong("PORTS"); });
                                header.col(|ui| { ui.strong("ACTIONS"); });
                            })
                            .body(|body| {
                                body.rows(32.0, state.discovered_devices.len(), |mut row| {
                                    let device = &state.discovered_devices[row.index()];
                                    
                                    row.col(|ui| {
                                        ui.label(egui::RichText::new(&device.ip).font(theme::font_mono()).color(theme::TEXT_PRIMARY));
                                    });
                                    row.col(|ui| {
                                        let text = device.hostname.as_deref().unwrap_or("-");
                                        ui.label(text);
                                    });
                                    row.col(|ui| {
                                        let text = device.mac.as_deref().unwrap_or("-");
                                        ui.label(egui::RichText::new(text).font(theme::font_mono()).color(theme::TEXT_TERTIARY));
                                    });
                                    row.col(|ui| {
                                        let text = device.vendor.as_deref().unwrap_or("Inconnu");
                                        ui.label(egui::RichText::new(text).font(theme::font_small()));
                                    });
                                    row.col(|ui| {
                                        let (label, color) = device_type_badge(&device.device_type);
                                        let badge = egui::Button::new(egui::RichText::new(label).font(theme::font_small()).color(color))
                                            .fill(color.linear_multiply(0.15))
                                            .corner_radius(egui::CornerRadius::same(4))
                                            .sense(egui::Sense::hover());
                                        ui.add(badge);
                                    });
                                    row.col(|ui| {
                                        let ports_str = if device.open_ports.is_empty() {
                                            "-".to_string()
                                        } else {
                                            device.open_ports.iter().take(4).map(|p| p.to_string()).collect::<Vec<_>>().join(", ")
                                        };
                                        ui.label(egui::RichText::new(&ports_str).font(theme::font_mono()).color(theme::TEXT_TERTIARY));
                                    });
                                    row.col(|ui| {
                                        let propose_btn = egui::Button::new(
                                            egui::RichText::new("+ Actif")
                                                .font(theme::font_small())
                                                .color(theme::ACCENT),
                                        )
                                        .fill(theme::ACCENT.linear_multiply(0.1))
                                        .corner_radius(egui::CornerRadius::same(4));
                                        if ui.add(propose_btn).clicked() {
                                            cmd = Some(crate::events::GuiCommand::ProposeAsset {
                                                ip: device.ip.clone(),
                                                hostname: device.hostname.clone(),
                                                device_type: device.device_type.clone(),
                                            });
                                        }
                                    });
                                });
                            });
                    });
                }

                ui.add_space(theme::SPACE_XL);
            });

        cmd
    }
}

fn device_type_badge(device_type: &str) -> (&str, egui::Color32) {
    match device_type {
        "router" => ("Routeur", theme::ACCENT),
        "server" => ("Serveur", theme::SUCCESS),
        "workstation" => ("Poste", theme::TEXT_PRIMARY),
        "printer" => ("Imprimante", theme::TEXT_TERTIARY),
        "iot" => ("IoT", theme::WARNING),
        "phone" => ("T\u{00e9}l\u{00e9}phone", theme::ACCENT_LIGHT),
        "switch" => ("Switch", theme::INFO),
        _ => ("Inconnu", theme::TEXT_SECONDARY),
    }
}
