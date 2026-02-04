//! Network Discovery page -- scan, discover, and propose assets.

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::Ui;
use egui_extras::{Column, TableBuilder};

pub struct DiscoveryPage;

impl DiscoveryPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<crate::events::GuiCommand> {
        let mut cmd: Option<crate::events::GuiCommand> = None;

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
                        .color(theme::text_on_accent()),
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
                    let bar_height = 6.0;
                    let (bar_rect, _) = ui
                        .allocate_exact_size(egui::Vec2::new(bar_width, bar_height), egui::Sense::hover());
                    
                    if ui.is_rect_visible(bar_rect) {
                        let time = ui.input(|i| i.time);
                        let pulse = ((time * 3.0).sin() * 0.5 + 0.5) as f32;
                        
                        // Track background
                        ui.painter().rect_filled(
                            bar_rect,
                            egui::CornerRadius::same(3),
                            theme::bg_elevated(),
                        );
                        
                        // Animated fill with gradient
                        let fill_width = bar_width * progress;
                        if fill_width > 0.0 {
                            let fill_rect = egui::Rect::from_min_size(
                                bar_rect.min,
                                egui::Vec2::new(fill_width, bar_height),
                            );
                            
                            // Glow behind fill
                            ui.painter().rect_filled(
                                fill_rect.expand(1.5),
                                egui::CornerRadius::same(4),
                                theme::ACCENT.linear_multiply(0.2 + pulse * 0.1),
                            );
                            
                            // Main fill with gradient (using two halves)
                            let top_half = egui::Rect::from_min_size(
                                fill_rect.min,
                                egui::Vec2::new(fill_width, bar_height / 2.0),
                            );
                            let bot_half = egui::Rect::from_min_size(
                                fill_rect.left_center(),
                                egui::Vec2::new(fill_width, bar_height / 2.0),
                            );
                            
                            ui.painter().rect_filled(
                                top_half,
                                egui::CornerRadius { nw: 3, ne: 3, sw: 0, se: 0 },
                                theme::ACCENT.linear_multiply(1.2),
                            );
                            ui.painter().rect_filled(
                                bot_half,
                                egui::CornerRadius { nw: 0, ne: 0, sw: 3, se: 3 },
                                theme::ACCENT,
                            );
                            
                            // Shimmer effect (moving highlight)
                            let shimmer_x = (time * 0.5).fract() as f32 * fill_width;
                            let shimmer_rect = egui::Rect::from_min_size(
                                fill_rect.min + egui::Vec2::new(shimmer_x - 10.0, 0.0),
                                egui::Vec2::new(20.0, bar_height),
                            );
                            if shimmer_rect.intersects(fill_rect) {
                                ui.painter().rect_filled(
                                    shimmer_rect.intersect(fill_rect),
                                    egui::CornerRadius::same(3),
                                    egui::Color32::from_white_alpha(30),
                                );
                            }
                        }
                        
                        ui.ctx().request_repaint();
                    }
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(&state.discovery_phase)
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                }

                ui.add_space(theme::SPACE_LG);
                ui.label(
                    egui::RichText::new(format!(
                        "{} appareil(s) d\u{00e9}couvert(s)",
                        state.discovered_devices.len()
                    ))
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Search / filter
        let search_lower = state.discovery_search.to_lowercase();
        let filtered: Vec<usize> = state
            .discovered_devices
            .iter()
            .enumerate()
            .filter(|(_, d)| {
                if search_lower.is_empty() {
                    return true;
                }
                let haystack = format!(
                    "{} {} {}",
                    d.ip.to_lowercase(),
                    d.hostname.as_deref().unwrap_or("").to_lowercase(),
                    d.vendor.as_deref().unwrap_or("").to_lowercase(),
                );
                haystack.contains(&search_lower)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        widgets::SearchFilterBar::new(
            &mut state.discovery_search,
            "Rechercher (IP, hostname, vendor)...",
        )
        .result_count(result_count)
        .show(ui);

        ui.add_space(theme::SPACE_SM);

        // CSV export
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_csv(state, &filtered);
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        // Device table
        if filtered.is_empty() && !state.discovery_in_progress {
            widgets::card(ui, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(theme::SPACE_XL * 2.0);
                    ui.label(
                        egui::RichText::new("Aucun appareil d\u{00e9}couvert")
                            .font(theme::font_heading())
                            .color(theme::text_tertiary()),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(
                            "Lancez un scan pour cartographier votre r\u{00e9}seau",
                        )
                        .font(theme::font_body())
                        .color(theme::text_tertiary()),
                    );
                    ui.add_space(theme::SPACE_XL * 2.0);
                });
            });
        } else if !filtered.is_empty() {
            widgets::card(ui, |ui| {
                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(140.0).at_least(100.0))
                    .column(Column::initial(140.0).at_least(100.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(80.0).at_least(60.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::remainder());

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| {
                            ui.strong("IP");
                        });
                        header.col(|ui| {
                            ui.strong("HOSTNAME");
                        });
                        header.col(|ui| {
                            ui.strong("MAC");
                        });
                        header.col(|ui| {
                            ui.strong("VENDOR");
                        });
                        header.col(|ui| {
                            ui.strong("TYPE");
                        });
                        header.col(|ui| {
                            ui.strong("PORTS");
                        });
                        header.col(|ui| {
                            ui.strong("ACTIONS");
                        });
                    })
                    .body(|body| {
                        body.rows(32.0, filtered.len(), |mut row| {
                            let device = &state.discovered_devices[filtered[row.index()]];

                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&device.ip)
                                        .font(theme::font_mono())
                                        .color(theme::text_primary()),
                                );
                            });
                            row.col(|ui| {
                                let text = device.hostname.as_deref().unwrap_or("-");
                                ui.label(text);
                            });
                            row.col(|ui| {
                                let text = device.mac.as_deref().unwrap_or("-");
                                ui.label(
                                    egui::RichText::new(text)
                                        .font(theme::font_mono())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui| {
                                let text = device.vendor.as_deref().unwrap_or("Inconnu");
                                ui.label(egui::RichText::new(text).font(theme::font_small()));
                            });
                            row.col(|ui| {
                                let (label, color) = device_type_badge(&device.device_type);
                                let badge = egui::Button::new(
                                    egui::RichText::new(label)
                                        .font(theme::font_small())
                                        .color(color),
                                )
                                .fill(color.linear_multiply(0.15))
                                .corner_radius(egui::CornerRadius::same(4))
                                .sense(egui::Sense::hover());
                                ui.add(badge);
                            });
                            row.col(|ui| {
                                let ports_str = if device.open_ports.is_empty() {
                                    "-".to_string()
                                } else {
                                    device
                                        .open_ports
                                        .iter()
                                        .take(4)
                                        .map(|p| p.to_string())
                                        .collect::<Vec<_>>()
                                        .join(", ")
                                };
                                ui.label(
                                    egui::RichText::new(&ports_str)
                                        .font(theme::font_mono())
                                        .color(theme::text_tertiary()),
                                );
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

        cmd
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let headers = &["ip", "hostname", "mac", "vendor", "type", "ports"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let d = &state.discovered_devices[i];
                vec![
                    d.ip.clone(),
                    d.hostname.clone().unwrap_or_default(),
                    d.mac.clone().unwrap_or_default(),
                    d.vendor.clone().unwrap_or_default(),
                    d.device_type.clone(),
                    d.open_ports
                        .iter()
                        .map(|p| p.to_string())
                        .collect::<Vec<_>>()
                        .join(", "),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("decouverte.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}

fn device_type_badge(device_type: &str) -> (&str, egui::Color32) {
    match device_type {
        "router" => ("Routeur", theme::ACCENT),
        "server" => ("Serveur", theme::SUCCESS),
        "workstation" => ("Poste", theme::text_primary()),
        "printer" => ("Imprimante", theme::text_tertiary()),
        "iot" => ("IoT", theme::WARNING),
        "phone" => ("T\u{00e9}l\u{00e9}phone", theme::ACCENT_LIGHT),
        "switch" => ("Switch", theme::INFO),
        _ => ("Inconnu", theme::text_secondary()),
    }
}
