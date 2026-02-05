//! Network page -- interfaces, connections, alerts.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct NetworkPage;

impl NetworkPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "R\u{00e9}seau",
            Some("Cartographie des interfaces et connexions actives"),
        );
        ui.add_space(theme::SPACE_LG);

        if state.network_interface_list.is_empty() && state.network_connection_list.is_empty() {
            ui.add_space(theme::SPACE_LG);
            widgets::protected_state(
                ui,
                icons::WARNING,
                "Aucune donn\u{00e9}e r\u{00e9}seau",
                "Veuillez lancer un scan pour d\u{00e9}tecter les interfaces et les connexions.",
            );

            ui.add_space(theme::SPACE_MD);
            ui.vertical_centered(|ui| {
                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                if widgets::button::primary_button_loading(
                    ui,
                    format!("{}  {}", if is_scanning { "Scan en cours..." } else { "Lancer un scan" }, icons::PLAY),
                    !is_scanning,
                    is_scanning,
                )
                .clicked()
                {
                    command = Some(GuiCommand::RunCheck);
                }
            });

            return command;
        }

        // Action bar
        ui.horizontal(|ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!("{}  {}", if is_scanning { "Scan en cours..." } else { "Lancer le scan" }, icons::PLAY),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

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
            Self::summary_card(
                ui,
                card_w,
                "INTERFACES",
                &iface_count.to_string(),
                theme::ACCENT,
                icons::WIFI,
            );
            Self::summary_card(
                ui,
                card_w,
                "CONNEXIONS",
                &conn_count.to_string(),
                theme::ACCENT_LIGHT,
                icons::NETWORK,
            );
            Self::summary_card(
                ui,
                card_w,
                "ALERTES",
                &state.network_alerts.to_string(),
                alert_color,
                alert_icon,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // Interfaces table
        ui.push_id("interfaces_section", |ui| {
            Self::interfaces_table(ui, state);
        });

        ui.add_space(theme::SPACE_LG);

        // Connections table
        ui.push_id("connections_section", |ui| {
            Self::connections_table(ui, state);
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
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "Réseau Sécurisé",
                        "Le trafic est analysé en temps réel. Aucun flux malveillant détecté.",
                    );
                } else {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(icons::WARNING)
                            .size(48.0)
                            .color(theme::ERROR.linear_multiply(0.4)),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(format!("{} ALERTE(S)", state.network_alerts))
                            .font(theme::font_small())
                            .color(theme::ERROR)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("Actions requises imm\u{00e9}diatement")
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                }
            });
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn interfaces_table(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("INTERFACES R\u{00c9}SEAU")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let export_btn = egui::Button::new(
                        egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    )
                    .fill(theme::bg_elevated())
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                    if ui.add(export_btn).clicked() {
                        Self::export_interfaces_csv(state);
                    }
                });
            });
            ui.add_space(theme::SPACE_MD);

            if state.network_interface_list.is_empty() {
                widgets::empty_state(ui, icons::WIFI, "Aucune interface détectée", None);
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(100.0).at_least(80.0)) // Name
                    .column(Column::initial(100.0).at_least(80.0)) // Type
                    .column(Column::initial(80.0).at_least(60.0)) // Status
                    .column(Column::initial(150.0).at_least(100.0)) // IPv4
                    .column(Column::remainder()); // MAC

                table
                    .header(32.0, |mut header| {
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("NOM")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("TYPE")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("STATUT")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("IPV4")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("MAC")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(40.0, state.network_interface_list.len(), |mut row| {
                            let iface = &state.network_interface_list[row.index()];
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&iface.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&iface.interface_type)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                );
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
                                let addr = iface
                                    .ipv4_addresses
                                    .first()
                                    .map(|s| s.as_str())
                                    .unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(addr)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui| {
                                let mac = iface.mac_address.as_deref().unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(mac)
                                        .font(theme::font_mono())
                                        .color(theme::text_tertiary()),
                                );
                            });
                        });
                    });
            }
        });
    }

    fn connections_table(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("CONNEXIONS ACTIVES")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let export_btn = egui::Button::new(
                        egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    )
                    .fill(theme::bg_elevated())
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                    if ui.add(export_btn).clicked() {
                        Self::export_connections_csv(state);
                    }
                });
            });
            ui.add_space(theme::SPACE_MD);

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

            widgets::SearchFilterBar::new(&mut state.network_connection_search, "Rechercher...")
                .result_count(filtered.len())
                .show(ui);

            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(ui, icons::NETWORK, "Aucune connexion active", None);
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(60.0).at_least(40.0)) // Proto
                    .column(Column::initial(180.0).at_least(100.0)) // Local
                    .column(Column::initial(180.0).at_least(100.0)) // Remote
                    .column(Column::initial(100.0).at_least(80.0)) // State
                    .column(Column::remainder()); // Process

                table
                    .header(32.0, |mut header| {
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("PROTO")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("LOCAL")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("DISTANT")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("\u{00c9}TAT")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui| {
                            ui.label(
                                egui::RichText::new("PROCESSUS")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(40.0, filtered.len(), |mut row| {
                            let conn = &state.network_connection_list[filtered[row.index()]];
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&conn.protocol)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary())
                                        .strong(),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{}:{}",
                                        conn.local_address, conn.local_port
                                    ))
                                    .font(theme::font_mono())
                                    .color(theme::text_primary()),
                                );
                            });
                            row.col(|ui| {
                                let remote = if let (Some(addr), Some(port)) =
                                    (&conn.remote_address, conn.remote_port)
                                {
                                    format!("{}:{}", addr, port)
                                } else if let Some(addr) = &conn.remote_address {
                                    addr.clone()
                                } else {
                                    "--".to_string()
                                };
                                ui.label(
                                    egui::RichText::new(remote)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui| {
                                let (label, color) = match conn.state.as_str() {
                                    "ESTABLISHED" => ("ESTABLISHED", theme::SUCCESS),
                                    "LISTEN" => ("LISTEN", theme::INFO),
                                    "CLOSE_WAIT" | "TIME_WAIT" => ("CLOSED", theme::WARNING),
                                    _ => (conn.state.as_str(), theme::text_tertiary()),
                                };
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui| {
                                ui.horizontal(|ui| {
                                    ui.label(
                                        egui::RichText::new(icons::CUBE)
                                            .color(theme::text_tertiary()),
                                    );
                                    let proc_name = conn.process_name.as_deref().unwrap_or("--");
                                    ui.label(
                                        egui::RichText::new(proc_name)
                                            .font(theme::font_body())
                                            .color(theme::text_primary()),
                                    );
                                });
                            });
                        });
                    });
            }
        });
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new(value).size(24.0).color(color).strong());
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }

    fn export_interfaces_csv(state: &AppState) {
        let headers = &["interface", "type", "statut", "mac", "ipv4", "ipv6"];
        let rows: Vec<Vec<String>> = state
            .network_interface_list
            .iter()
            .map(|iface| {
                vec![
                    iface.name.clone(),
                    iface.interface_type.clone(),
                    iface.status.clone(),
                    iface.mac_address.as_deref().unwrap_or("--").to_string(),
                    iface.ipv4_addresses.join(", "),
                    ["--".to_string()].join(", "), // IPv6 not explicitly in dto iface but can be added if needed
                ]
            })
            .collect();
        let path = crate::export::default_export_path("network_interfaces.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }

    fn export_connections_csv(state: &AppState) {
        let headers = &["protocole", "local", "distant", "statut", "processus"];
        let rows: Vec<Vec<String>> = state
            .network_connection_list
            .iter()
            .map(|conn| {
                vec![
                    conn.protocol.clone(),
                    format!("{}:{}", conn.local_address, conn.local_port),
                    conn.remote_address
                        .clone()
                        .map(|a| format!("{}:{}", a, conn.remote_port.unwrap_or(0)))
                        .unwrap_or_else(|| "--".to_string()),
                    conn.state.clone(),
                    conn.process_name.as_deref().unwrap_or("--").to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("network_connections.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}
