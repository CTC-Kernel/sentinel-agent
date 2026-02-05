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
            "Réseau",
            Some("CARTOGRAPHIE DES INTERFACES ET CONNEXIONS ACTIVES"),
            Some(
                "Analysez l'état des interfaces réseau et la liste des connexions actives. Les alertes DNS ou les flux vers des IPs suspectes sont mis en évidence pour faciliter l'investigation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        if state.network_interface_list.is_empty() && state.network_connection_list.is_empty() {
            ui.add_space(theme::SPACE_LG);
            widgets::protected_state(
                ui,
                icons::WARNING,
                "AUCUNE DONNÉE RÉSEAU",
                "Veuillez lancer un scan pour détecter les interfaces et les connexions.",
            );

            ui.add_space(theme::SPACE_MD);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                if widgets::button::primary_button_loading(
                    ui,
                    format!(
                        "{}  {}",
                        if is_scanning {
                            "SCAN EN COURS"
                        } else {
                            "LANCER UN SCAN"
                        },
                        icons::PLAY
                    ),
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

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    if is_scanning {
                        "SCAN EN COURS"
                    } else {
                        "LANCER LE SCAN"
                    },
                    icons::PLAY
                ),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Summary row (AAA Grade)
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

        let card_grid = widgets::ResponsiveGrid::new(280.0, theme::SPACE_SM);
        let items = vec![
            (
                "INTERFACES RÉSEAU",
                iface_count.to_string(),
                theme::ACCENT,
                icons::WIFI,
            ),
            (
                "CONNEXIONS ACTIVES",
                conn_count.to_string(),
                theme::ACCENT_LIGHT,
                icons::NETWORK,
            ),
            (
                "ALERTES FLUX",
                state.network_alerts.to_string(),
                if state.network_alerts > 0 {
                    theme::ERROR
                } else {
                    theme::SUCCESS
                },
                if state.network_alerts > 0 {
                    icons::WARNING
                } else {
                    icons::CIRCLE_CHECK
                },
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Interfaces table
        ui.push_id("interfaces_section", |ui: &mut egui::Ui| {
            Self::interfaces_table(ui, state);
        });

        ui.add_space(theme::SPACE_LG);

        // Connections table
        ui.push_id("connections_section", |ui: &mut egui::Ui| {
            Self::connections_table(ui, state);
        });

        ui.add_space(theme::SPACE_LG);

        // Security section (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("ANALYSE DE SÉCURITÉ RÉSEAU")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            ui.vertical_centered(|ui: &mut egui::Ui| {
                if state.network_alerts == 0 {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "RÉSEAU SÉCURISÉ",
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
                        egui::RichText::new(format!(
                            "{} ALERTE(S) DÉTECTÉE(S)",
                            state.network_alerts
                        ))
                        .font(theme::font_body())
                        .color(theme::ERROR)
                        .strong(),
                    );
                    ui.label(
                        egui::RichText::new("ACTIONS DE MITIGATION REQUISES IMMÉDIATEMENT")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(0.5),
                    );
                }
            });
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn interfaces_table(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("INTERFACES RÉSEAU DETECTÉES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        let export_btn = egui::Button::new(
                            egui::RichText::new(format!("{}  EXPORT CSV", icons::DOWNLOAD))
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        )
                        .fill(theme::bg_elevated())
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                        if ui.add(export_btn).clicked() && Self::export_interfaces_csv(state) {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Export CSV interfaces terminé",
                                )
                                .with_time(ui.input(|i| i.time)),
                            );
                        }
                    },
                );
            });
            ui.add_space(theme::SPACE_MD);

            if state.network_interface_list.is_empty() {
                widgets::empty_state(ui, icons::WIFI, "AUCUNE INTERFACE DÉTECTÉE", None);
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(120.0).at_least(80.0)) // Name
                    .column(Column::initial(120.0).at_least(80.0)) // Type
                    .column(Column::initial(100.0).at_least(60.0)) // Status
                    .column(Column::initial(160.0).at_least(100.0)) // IPv4
                    .column(Column::remainder()); // MAC

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("NOM")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("STATUT")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("IPV4")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("MAC")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(
                            theme::TABLE_ROW_HEIGHT,
                            state.network_interface_list.len(),
                            |mut row| {
                                let iface = &state.network_interface_list[row.index()];
                                row.col(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&iface.name)
                                            .font(theme::font_body())
                                            .color(theme::text_primary())
                                            .strong(),
                                    );
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&iface.interface_type)
                                            .font(theme::font_min())
                                            .color(theme::text_secondary()),
                                    );
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    let (label, color) = if iface.status == "up" {
                                        ("OPÉRATIONNEL", theme::SUCCESS)
                                    } else {
                                        ("HORS-LIGNE", theme::text_tertiary())
                                    };
                                    widgets::status_badge(ui, label, color);
                                });
                                row.col(|ui: &mut egui::Ui| {
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
                                row.col(|ui: &mut egui::Ui| {
                                    let mac = iface.mac_address.as_deref().unwrap_or("--");
                                    ui.label(
                                        egui::RichText::new(mac)
                                            .font(theme::font_mono())
                                            .color(theme::text_tertiary()),
                                    );
                                });
                            },
                        );
                    });
            }
        });
    }

    fn connections_table(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("CONNEXIONS ACTIVES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        let export_btn = egui::Button::new(
                            egui::RichText::new(format!("{}  EXPORT CSV", icons::DOWNLOAD))
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        )
                        .fill(theme::bg_elevated())
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                        if ui.add(export_btn).clicked() && Self::export_connections_csv(state) {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Export CSV connexions terminé",
                                )
                                .with_time(ui.input(|i| i.time)),
                            );
                        }
                    },
                );
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
                widgets::empty_state(ui, icons::NETWORK, "AUCUNE CONNEXION ACTIVE", None);
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(80.0).at_least(40.0)) // Proto
                    .column(Column::initial(200.0).at_least(100.0)) // Local
                    .column(Column::initial(200.0).at_least(100.0)) // Remote
                    .column(Column::initial(110.0).at_least(80.0)) // State
                    .column(Column::remainder()); // Process

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("PROTO")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("LOCAL")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DISTANT")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ÉTAT")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("PROCESSUS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                            let conn = &state.network_connection_list[filtered[row.index()]];
                            row.col(|ui: &mut egui::Ui| {
                                widgets::status_badge(
                                    ui,
                                    &conn.protocol,
                                    theme::bg_elevated().linear_multiply(2.0),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{}:{}",
                                        conn.local_address, conn.local_port
                                    ))
                                    .font(theme::font_mono())
                                    .color(theme::text_primary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
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
                            row.col(|ui: &mut egui::Ui| {
                                let (label, color) = match conn.state.as_str() {
                                    "ESTABLISHED" => ("ESTABLISHED", theme::SUCCESS),
                                    "LISTEN" => ("LISTEN", theme::INFO),
                                    "CLOSE_WAIT" | "TIME_WAIT" => ("CLOSED", theme::WARNING),
                                    _ => (conn.state.as_str(), theme::text_tertiary()),
                                };
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(icons::CUBE)
                                            .color(theme::text_tertiary()),
                                    );
                                    let proc_name = conn.process_name.as_deref().unwrap_or("--");
                                    ui.label(
                                        egui::RichText::new(proc_name)
                                            .font(theme::font_body())
                                            .color(theme::text_primary())
                                            .strong(),
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
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(0.5)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(28.0)
                                    .color(color.linear_multiply(0.25)),
                            );
                        },
                    );
                });
            });
        });
    }

    fn export_interfaces_csv(state: &AppState) -> bool {
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
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(()) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }

    fn export_connections_csv(state: &AppState) -> bool {
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
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(()) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
