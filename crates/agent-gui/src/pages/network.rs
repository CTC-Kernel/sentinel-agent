//! Network page -- interfaces, connections, alerts.

use egui::Ui;

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct NetworkPage;

impl NetworkPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "R\u{00e9}seau",
            Some("Supervision des interfaces, connexions actives et alertes de s\u{00e9}curit\u{00e9}"),
        );
        ui.add_space(theme::SPACE_LG);

        // Summary row
        let iface_count = if state.network_interface_list.is_empty() {
            state.network_interfaces
        } else {
            state.network_interface_list.len() as u32
        };
        let conn_count = if state.network_connection_list.is_empty() {
            state.network_connections
        } else {
            state.network_connection_list.len() as u32
        };
        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        let (alert_color, alert_icon) = if state.network_alerts > 0 {
            (theme::ERROR, icons::WARNING)
        } else {
            (theme::SUCCESS, icons::CIRCLE_CHECK)
        };
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(ui, card_w, "INTERFACES", &iface_count.to_string(), theme::ACCENT, icons::WIFI);
            Self::summary_card(ui, card_w, "CONNEXIONS", &conn_count.to_string(), theme::ACCENT_LIGHT, icons::NETWORK);
            Self::summary_card(ui, card_w, "ALERTES", &state.network_alerts.to_string(), alert_color, alert_icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Interfaces table
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("INTERFACES R\u{00c9}SEAU")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.network_interface_list.is_empty() {
                // Fallback to simple display
                if state.primary_ip.is_none() && state.primary_mac.is_none() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_MD);
                        ui.label(egui::RichText::new("Aucune donn\u{00e9}e r\u{00e9}seau").color(theme::text_tertiary()));
                        ui.add_space(theme::SPACE_MD);
                    });
                } else {
                    if let Some(ref ip) = state.primary_ip {
                        Self::detail_row(ui, "Adresse IP", ip, icons::ARROW_RIGHT);
                    }
                    if let Some(ref mac) = state.primary_mac {
                        Self::detail_row(ui, "Adresse MAC", mac, icons::ARROW_RIGHT);
                    }
                    if let Some(ref ts) = state.last_network_scan {
                        ui.separator();
                        Self::detail_row(ui, "Dernier scan", &ts.format("%H:%M:%S").to_string(), icons::ARROW_RIGHT);
                    }
                }
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(80.0).at_least(60.0))   // Name
                    .column(Column::initial(80.0).at_least(60.0))   // Type
                    .column(Column::initial(70.0).at_least(50.0))   // Status
                    .column(Column::initial(140.0).at_least(100.0)) // IPv4
                    .column(Column::remainder());                    // MAC

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| { ui.strong("NOM"); });
                        header.col(|ui| { ui.strong("TYPE"); });
                        header.col(|ui| { ui.strong("STATUT"); });
                        header.col(|ui| { ui.strong("IPv4"); });
                        header.col(|ui| { ui.strong("MAC"); });
                    })
                    .body(|body| {
                        body.rows(32.0, state.network_interface_list.len(), |mut row| {
                            let iface = &state.network_interface_list[row.index()];
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&iface.name).font(theme::font_mono()).color(theme::text_primary()).strong());
                            });
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&iface.interface_type).font(theme::font_small()).color(theme::text_secondary()));
                            });
                            row.col(|ui| {
                                let (label, color) = if iface.status == "up" {
                                    ("UP", theme::SUCCESS)
                                } else {
                                    ("DOWN", theme::text_tertiary())
                                };
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui| {
                                let addrs = iface.ipv4_addresses.join(", ");
                                ui.label(egui::RichText::new(if addrs.is_empty() { "--" } else { &addrs }).font(theme::font_mono()).color(theme::text_secondary()));
                            });
                            row.col(|ui| {
                                let mac = iface.mac_address.as_deref().unwrap_or("--");
                                ui.label(egui::RichText::new(mac).font(theme::font_mono()).color(theme::text_tertiary()));
                            });
                        });
                    });
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Connections table
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("CONNEXIONS ACTIVES")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
            });
            ui.add_space(theme::SPACE_SM);

            if state.network_connection_list.is_empty() {
                ui.vertical_centered(|ui| {
                    ui.add_space(theme::SPACE_MD);
                    ui.label(egui::RichText::new("Aucune connexion recens\u{00e9}e").color(theme::text_tertiary()));
                    ui.add_space(theme::SPACE_MD);
                });
            } else {
                // Search bar for connections
                let search_lower = state.network_connection_search.to_lowercase();
                let filtered: Vec<usize> = state
                    .network_connection_list
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| {
                        if search_lower.is_empty() {
                            return true;
                        }
                        let haystack = format!(
                            "{} {} {} {} {}",
                            c.protocol.to_lowercase(),
                            c.local_address.to_lowercase(),
                            c.remote_address.as_deref().unwrap_or("").to_lowercase(),
                            c.state.to_lowercase(),
                            c.process_name.as_deref().unwrap_or("").to_lowercase(),
                        );
                        haystack.contains(&search_lower)
                    })
                    .map(|(i, _)| i)
                    .collect();

                widgets::SearchFilterBar::new(
                    &mut state.network_connection_search,
                    "Filtrer les connexions...",
                )
                .result_count(filtered.len())
                .show(ui);

                ui.add_space(theme::SPACE_SM);

                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(50.0).at_least(40.0))    // Protocol
                    .column(Column::initial(160.0).at_least(100.0))  // Local
                    .column(Column::initial(160.0).at_least(100.0))  // Remote
                    .column(Column::initial(100.0).at_least(70.0))   // State
                    .column(Column::remainder());                     // Process

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| { ui.strong("PROTO"); });
                        header.col(|ui| { ui.strong("LOCAL"); });
                        header.col(|ui| { ui.strong("DISTANT"); });
                        header.col(|ui| { ui.strong("\u{00c9}TAT"); });
                        header.col(|ui| { ui.strong("PROCESSUS"); });
                    })
                    .body(|body| {
                        body.rows(28.0, filtered.len(), |mut row| {
                            let conn = &state.network_connection_list[filtered[row.index()]];
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&conn.protocol).font(theme::font_mono()).color(theme::text_secondary()));
                            });
                            row.col(|ui| {
                                ui.label(egui::RichText::new(format!("{}:{}", conn.local_address, conn.local_port)).font(theme::font_mono()).color(theme::text_primary()));
                            });
                            row.col(|ui| {
                                let remote = match (&conn.remote_address, conn.remote_port) {
                                    (Some(addr), Some(port)) => format!("{}:{}", addr, port),
                                    (Some(addr), None) => addr.clone(),
                                    _ => "--".to_string(),
                                };
                                ui.label(egui::RichText::new(remote).font(theme::font_mono()).color(theme::text_secondary()));
                            });
                            row.col(|ui| {
                                let color = match conn.state.as_str() {
                                    "ESTABLISHED" => theme::SUCCESS,
                                    "LISTEN" => theme::INFO,
                                    "CLOSE_WAIT" | "TIME_WAIT" => theme::WARNING,
                                    _ => theme::text_tertiary(),
                                };
                                ui.label(egui::RichText::new(&conn.state).font(theme::font_small()).color(color).strong());
                            });
                            row.col(|ui| {
                                let proc_name = conn.process_name.as_deref().unwrap_or("--");
                                ui.label(egui::RichText::new(proc_name).font(theme::font_small()).color(theme::text_tertiary()));
                            });
                        });
                    });
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Security section
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("S\u{00c9}CURIT\u{00c9}")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.vertical_centered(|ui| {
                if state.network_alerts == 0 {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(egui::RichText::new(icons::CIRCLE_CHECK).size(48.0).color(theme::SUCCESS.linear_multiply(0.4)));
                    ui.add_space(theme::SPACE_SM);
                    ui.label(egui::RichText::new("AUCUNE MENACE").font(theme::font_small()).color(theme::SUCCESS).strong());
                    ui.label(egui::RichText::new("Le trafic r\u{00e9}seau semble sain").font(theme::font_small()).color(theme::text_tertiary()));
                } else {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(egui::RichText::new(icons::WARNING).size(48.0).color(theme::ERROR.linear_multiply(0.4)));
                    ui.add_space(theme::SPACE_SM);
                    ui.label(egui::RichText::new(format!("{} ALERTE(S)", state.network_alerts)).font(theme::font_small()).color(theme::ERROR).strong());
                    ui.label(egui::RichText::new("Actions requises imm\u{00e9}diatement").font(theme::font_small()).color(theme::text_tertiary()));
                }
            });
        });

        ui.add_space(theme::SPACE_XL);
    }

    fn summary_card(ui: &mut Ui, width: f32, label: &str, value: &str, color: egui::Color32, icon: &str) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .size(24.0)
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(egui::RichText::new(icon).size(28.0).color(color.linear_multiply(0.4)));
                    });
                });
            });
        });
    }

    fn detail_row(ui: &mut Ui, label: &str, value: &str, icon: &str) {
        ui.horizontal(|ui| {
            ui.set_min_height(32.0);
            ui.label(egui::RichText::new(icon).font(theme::font_body()).color(theme::ACCENT).strong());
            ui.add_space(8.0);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_mono())
                        .color(theme::text_primary())
                        .strong(),
                );
            });
        });
    }
}
