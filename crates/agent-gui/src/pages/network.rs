// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Détection & réponse", "Réseau"],
            "Réseau",
            Some("Cartographie des interfaces et des connexions actives."),
            Some(
                "Analysez l'état des interfaces réseau et la liste des connexions actives. Les alertes DNS ou les flux vers des IPs suspectes sont mis en évidence pour faciliter l'investigation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        if state.network.interfaces.is_empty() && state.network.connections.is_empty() {
            ui.add_space(theme::SPACE_LG);

            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if is_scanning {
                // Show skeleton loaders during scan
                widgets::loading_skeleton(ui, 4);
                return command;
            }

            // Nothing scanned yet is a neutral state, not an all-clear: a
            // green shield here would claim a verdict the agent has not made.
            widgets::hero_state(
                ui,
                icons::NETWORK,
                "Aucune donnée réseau",
                "Lancez un scan pour cartographier les interfaces et connexions de cet endpoint.",
                theme::INFO,
            );

            ui.add_space(theme::SPACE_MD);
            ui.vertical_centered(|ui: &mut egui::Ui| {
                let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                if widgets::button::primary_button_loading(
                    ui,
                    format!(
                        "{}  {}",
                        icons::PLAY,
                        if is_scanning {
                            "Analyse en cours"
                        } else {
                            "Lancer l'analyse"
                        }
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

        // Summary row (AAA Grade)
        let iface_count = if state.network.interfaces.is_empty() {
            state.network.interface_count
        } else {
            state.network.interfaces.len().min(u32::MAX as usize) as u32
        };
        let conn_count = if state.network.connections.is_empty() {
            state.network.connection_count
        } else {
            state.network.connections.len().min(u32::MAX as usize) as u32
        };

        let card_grid = widgets::ResponsiveGrid::new(280.0, theme::SPACE_SM);
        let items = vec![
            (
                "INTERFACES RÉSEAU",
                iface_count.to_string(),
                theme::accent_text(),
                icons::WIFI,
            ),
            (
                "CONNEXIONS ACTIVES",
                conn_count.to_string(),
                theme::accent_text(),
                icons::NETWORK,
            ),
            (
                "ALERTES FLUX",
                state.network.alert_count.to_string(),
                if state.network.alert_count > 0 {
                    theme::ERROR
                } else {
                    theme::SUCCESS
                },
                if state.network.alert_count > 0 {
                    icons::WARNING
                } else {
                    icons::CIRCLE_CHECK
                },
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            if Self::summary_card(ui, width, label, value, *color, icon) {
                state.network.active_section = match *label {
                    "INTERFACES RÉSEAU" => 2,
                    "ALERTES FLUX" => 1,
                    _ => 0,
                };
            }
        });

        ui.add_space(theme::SPACE_LG);

        widgets::tabs(
            ui,
            &["Connexions", "Alertes de sécurité", "Interfaces"],
            &mut state.network.active_section,
        );
        ui.add_space(theme::SPACE_MD);
        match state.network.active_section {
            0 => {
                ui.push_id("connections_section", |ui| {
                    Self::connections_table(ui, state)
                });
            }
            1 => {
                ui.push_id("security_alerts_section", |ui| {
                    Self::security_alerts_section(ui, state)
                });
            }
            2 => {
                ui.push_id("interfaces_section", |ui| Self::interfaces_table(ui, state));
            }
            _ => state.network.active_section = 0,
        }
        ui.add_space(theme::SPACE_MD);
        // ── Connection state + Protocol + Alert type distribution ───────
        // Flows and alerts, always shown: each breakdown is a proportion bar
        // with a legend, rather than counts in pills behind a bare egui
        // collapsing header.
        Self::flows_card(ui, state);

        ui.add_space(theme::SPACE_XL);

        let ctx = ui.ctx().clone();
        if state.network.detail_open {
            if let Some(sel) = state.network.selected_connection {
                if sel < state.network.connections.len() {
                    let conn = state.network.connections[sel].clone();
                    let (state_label, state_color) = match conn.state.as_str() {
                        "ESTABLISHED" => ("ÉTABLIE", theme::SUCCESS),
                        "LISTEN" => ("EN ÉCOUTE", theme::INFO),
                        "CLOSE_WAIT" | "TIME_WAIT" => ("EN FERMETURE", theme::WARNING),
                        _ => (conn.state.as_str(), theme::WARNING),
                    };
                    let title = format!("{}:{}", conn.local_address, conn.local_port);
                    let actions = [
                        widgets::DetailAction::secondary("Copier", icons::COPY),
                        widgets::DetailAction::danger("Bloquer", icons::LOCK)
                            .enabled(conn.remote_address.is_some()),
                    ];
                    let drawer_action =
                        widgets::DetailDrawer::new("net_conn_detail", &title, icons::NETWORK)
                            .accent(theme::ACCENT)
                            .subtitle("Connexion r\u{00e9}seau")
                            .show(
                                &ctx,
                                &mut state.network.detail_open,
                                |ui| {
                                    widgets::detail_section(ui, "CONNEXION R\u{00c9}SEAU");
                                    widgets::detail_field_badge(
                                        ui,
                                        "Protocole",
                                        &conn.protocol,
                                        theme::INFO,
                                    );
                                    widgets::detail_mono(ui, "Adresse locale", &conn.local_address);
                                    widgets::detail_field(
                                        ui,
                                        "Port local",
                                        &conn.local_port.to_string(),
                                    );
                                    widgets::detail_mono(
                                        ui,
                                        "Adresse distante",
                                        conn.remote_address.as_deref().unwrap_or("--"),
                                    );
                                    widgets::detail_field(
                                        ui,
                                        "Port distant",
                                        &conn
                                            .remote_port
                                            .map(|p| p.to_string())
                                            .unwrap_or_else(|| "--".to_string()),
                                    );
                                    widgets::detail_field_badge(
                                        ui,
                                        "\u{00c9}tat",
                                        state_label,
                                        state_color,
                                    );
                                    widgets::detail_field(
                                        ui,
                                        "Processus",
                                        conn.process_name.as_deref().unwrap_or("--"),
                                    );
                                },
                                &actions,
                            );
                    if let Some(action_idx) = drawer_action {
                        let time = ctx.input(|i| i.time);
                        if action_idx == 0 {
                            let conn_str = format!(
                                "{}:{} \u{2192} {}",
                                conn.local_address,
                                conn.local_port,
                                conn.remote_address.as_deref().unwrap_or("--"),
                            );
                            ctx.copy_text(conn_str);
                            state.toasts.push(
                                crate::widgets::toast::Toast::info(
                                    "Connexion copi\u{00e9}e dans le presse-papiers",
                                )
                                .with_time(time),
                            );
                        } else if action_idx == 1
                            && let Some(ref remote_ip) = conn.remote_address
                        {
                            command = Some(GuiCommand::BlockIp {
                                ip: remote_ip.clone(),
                                duration_secs: 0,
                            });
                            state.network.detail_open = false;
                            state.toasts.push(
                                crate::widgets::toast::Toast::info("Demande de blocage envoyée")
                                    .with_time(time),
                            );
                        }
                    }
                } else {
                    // Out-of-bounds — clean up stale selection
                    state.network.selected_connection = None;
                    state.network.detail_open = false;
                }
            } else if let Some(sel) = state.network.selected_alert
                && sel < state.network.alerts.len()
            {
                let alert = state.network.alerts[sel].clone();
                let (type_label, type_color) = Self::alert_type_label_color(&alert.alert_type);
                let sev_color = match alert.severity {
                    crate::dto::Severity::Critical => theme::ERROR,
                    crate::dto::Severity::High => theme::SEVERITY_HIGH,
                    crate::dto::Severity::Medium => theme::SEVERITY_MEDIUM,
                    crate::dto::Severity::Low => theme::INFO,
                    crate::dto::Severity::Info => theme::text_tertiary(),
                };
                let conf_color = if alert.confidence >= 90 {
                    theme::ERROR
                } else if alert.confidence >= 70 {
                    theme::SEVERITY_HIGH
                } else if alert.confidence >= 40 {
                    theme::WARNING
                } else {
                    theme::INFO
                };
                let has_ai = alert.ai_analysis.is_some();
                let mut actions = Vec::new();
                if !has_ai {
                    actions.push(widgets::DetailAction::primary(
                        "\u{00c9}valuer avec l'IA",
                        icons::BRAIN,
                    ));
                }
                actions.push(
                    widgets::DetailAction::primary(
                        if alert.acknowledged {
                            "Acquittée"
                        } else {
                            "Acquitter"
                        },
                        icons::CHECK,
                    )
                    .enabled(!alert.acknowledged),
                );
                actions.push(widgets::DetailAction::secondary(
                    "Investiguer",
                    icons::SEARCH,
                ));
                actions.push(widgets::DetailAction::danger("Ignorer", icons::EYE_SLASH));
                let drawer_action =
                    widgets::DetailDrawer::new("net_alert_detail", &type_label, icons::WARNING)
                        .accent(type_color)
                        .subtitle("Alerte r\u{00e9}seau")
                        .show(
                            &ctx,
                            &mut state.network.detail_open,
                            |ui| {
                                widgets::detail_section(ui, "ALERTE R\u{00c9}SEAU");
                                widgets::detail_field_badge(ui, "Type", &type_label, type_color);
                                widgets::detail_field_badge(
                                    ui,
                                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                                    alert.severity.label(),
                                    sev_color,
                                );
                                widgets::detail_text(ui, "Description", &alert.description);
                                if let Some(ref src) = alert.source_ip {
                                    widgets::detail_mono(ui, "IP source", src);
                                }
                                if let Some(ref dst) = alert.destination_ip {
                                    widgets::detail_mono(ui, "IP destination", dst);
                                }
                                widgets::detail_field(
                                    ui,
                                    "Port",
                                    &alert
                                        .destination_port
                                        .map(|p| p.to_string())
                                        .unwrap_or_else(|| "--".to_string()),
                                );
                                widgets::detail_field_colored(
                                    ui,
                                    "Confiance",
                                    &format!("{}\u{202f}%", alert.confidence),
                                    theme::readable_color(conf_color),
                                );
                                widgets::detail_field(
                                    ui,
                                    "Date de d\u{00e9}tection",
                                    &crate::format::local_datetime_secs(alert.detected_at),
                                );

                                // AI Analysis section
                                if let Some(ref analysis) = alert.ai_analysis {
                                    widgets::detail_section(ui, "ANALYSE IA");
                                    if let Some(confidence) = alert.ai_confidence {
                                        let c = if confidence >= 80 {
                                            theme::SUCCESS
                                        } else if confidence >= 50 {
                                            theme::WARNING
                                        } else {
                                            theme::ERROR
                                        };
                                        widgets::detail_field_badge(
                                            ui,
                                            "Confiance IA",
                                            &format!("{}\u{202f}%", confidence),
                                            c,
                                        );
                                    }
                                    if let Some(fp) = alert.is_false_positive {
                                        widgets::detail_field_badge(
                                            ui,
                                            "Faux positif",
                                            if fp { "OUI" } else { "NON" },
                                            if fp { theme::WARNING } else { theme::SUCCESS },
                                        );
                                    }
                                    widgets::detail_text(ui, "Analyse", analysis);
                                }
                            },
                            &actions,
                        );
                if let Some(action_idx) = drawer_action {
                    let time = ctx.input(|i| i.time);
                    let mut next = 0_usize;
                    let ai_idx = if !has_ai {
                        let i = next;
                        next += 1;
                        Some(i)
                    } else {
                        None
                    };
                    let ack_idx = next;
                    let inv_idx = next + 1;
                    let ign_idx = next + 2;
                    if ai_idx == Some(action_idx) {
                        let desc = format!(
                            "Alerte réseau: {} — {} — Source: {} — Destination: {}",
                            type_label,
                            alert.description,
                            alert.source_ip.as_deref().unwrap_or("--"),
                            alert.destination_ip.as_deref().unwrap_or("--"),
                        );
                        command = Some(GuiCommand::LlmClassifyThreat {
                            event_description: desc,
                            target_id: crate::state::event_identity("network", &alert),
                        });
                        state.toasts.push(
                            crate::widgets::toast::Toast::info("Analyse IA en cours\u{2026}")
                                .with_time(time),
                        );
                    } else if action_idx == ack_idx {
                        state.acknowledge_threat_item("network", sel);
                        state.network.selected_alert = None;
                        state.network.detail_open = false;
                        state.toasts.push(
                            crate::widgets::toast::Toast::success("Alerte acquitt\u{00e9}e")
                                .with_time(time),
                        );
                    } else if action_idx == inv_idx {
                        let details = format!(
                            "Type: {}\nDescription: {}\nSource: {}\nDestination: {}",
                            type_label,
                            alert.description,
                            alert.source_ip.as_deref().unwrap_or("--"),
                            alert.destination_ip.as_deref().unwrap_or("--"),
                        );
                        ctx.copy_text(details);
                        state.toasts.push(
                            crate::widgets::toast::Toast::info(
                                "D\u{00e9}tails de l'alerte copi\u{00e9}s dans le presse-papiers",
                            )
                            .with_time(time),
                        );
                    } else if action_idx == ign_idx {
                        state.network.detail_open = false;
                        state.network.selected_alert = None;
                    }
                }
            } else {
                // No valid selection — clean up phantom open state
                state.network.detail_open = false;
            }
        }

        command
    }

    fn interfaces_table(ui: &mut Ui, state: &mut AppState) {
        widgets::data_card(ui, "Interfaces réseau", |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("INTERFACES R\u{00c9}SEAU D\u{00c9}TECT\u{00c9}ES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::ghost_button(ui, format!("{}  Export CSV", icons::DOWNLOAD))
                            .clicked()
                        {
                            let toast = match Self::export_interfaces_csv(state) {
                                Ok(path) => crate::widgets::toast::Toast::success(format!(
                                    "Export CSV enregistré : {}",
                                    path.display()
                                )),
                                Err(error) => crate::widgets::toast::Toast::error(format!(
                                    "Export CSV impossible : {error}"
                                )),
                            };
                            state.toasts.push(toast.with_time(ui.input(|i| i.time)));
                        }
                    },
                );
            });
            ui.add_space(theme::SPACE_MD);

            let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                || state.sync.in_progress;

            if state.network.interfaces.is_empty() {
                if is_loading {
                    ui.push_id("network_interfaces_skeletons", |ui: &mut egui::Ui| {
                        let cols = 5;
                        let column_widths =
                            [120.0, 120.0, 100.0, 160.0, ui.available_width() - 500.0];
                        for _ in 0..5 {
                            crate::widgets::skeleton::skeleton_table_row(ui, cols, &column_widths);
                            ui.add_space(theme::SPACE_MD);
                        }
                    });
                } else {
                    widgets::empty_state(
                        ui,
                        icons::WIFI,
                        "Aucune interface d\u{00e9}tect\u{00e9}e",
                        None,
                    );
                }
            } else {
                use widgets::table;

                table::fluid(
                    ui,
                    &[
                        table::Col::fluid(100.0, 1.0), // Nom
                        table::Col::fluid(80.0, 1.0),  // Type
                        table::Col::fluid(110.0, 0.0), // Statut
                        table::Col::fluid(120.0, 1.0), // IPv4
                        table::Col::fluid(140.0, 2.0), // MAC
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui| {
                        table::header_cell(ui, "NOM");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "TYPE");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "STATUT");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "IPV4");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "MAC");
                    });
                })
                .body(|body| {
                    body.rows(
                        theme::TABLE_ROW_HEIGHT,
                        state.network.interfaces.len(),
                        |mut row| {
                            let Some(iface) = state.network.interfaces.get(row.index()) else {
                                return;
                            };
                            row.col(|ui| {
                                table::cell_strong(ui, &iface.name);
                            });
                            row.col(|ui| {
                                widgets::status_badge(
                                    ui,
                                    interface_type_label(&iface.interface_type),
                                    theme::INFO,
                                );
                            });
                            row.col(|ui| {
                                let (label, color) = if iface.status == "up" {
                                    ("OPÉRATIONNEL", theme::SUCCESS)
                                } else {
                                    ("HORS-LIGNE", theme::WARNING)
                                };
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui| {
                                match iface.ipv4_addresses.first() {
                                    Some(addr) => table::cell_mono(ui, addr),
                                    None => table::cell_empty(ui),
                                };
                            });
                            row.col(|ui| {
                                match iface.mac_address.as_deref() {
                                    Some(mac) => table::cell_mono_muted(ui, mac),
                                    None => table::cell_empty(ui),
                                };
                            });
                        },
                    );
                });
            }
        });
    }

    fn connections_table(ui: &mut Ui, state: &mut AppState) {
        widgets::data_card(ui, "Connexions actives", |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("CONNEXIONS ACTIVES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::ghost_button(ui, format!("{}  Export CSV", icons::DOWNLOAD))
                            .clicked()
                        {
                            let toast = match Self::export_connections_csv(state) {
                                Ok(path) => crate::widgets::toast::Toast::success(format!(
                                    "Export CSV enregistré : {}",
                                    path.display()
                                )),
                                Err(error) => crate::widgets::toast::Toast::error(format!(
                                    "Export CSV impossible : {error}"
                                )),
                            };
                            state.toasts.push(toast.with_time(ui.input(|i| i.time)));
                        }
                    },
                );
            });
            ui.add_space(theme::SPACE_MD);

            let search_id = ui.id().with("network_search_cache");
            let search_lower: String = ui
                .memory(|mem| {
                    mem.data
                        .get_temp::<(String, String)>(search_id)
                        .filter(|(orig, _)| orig == &state.network.search)
                        .map(|(_, lower)| lower)
                })
                .unwrap_or_else(|| {
                    let lower = state.network.search.to_lowercase();
                    ui.memory_mut(|mem| {
                        mem.data
                            .insert_temp(search_id, (state.network.search.clone(), lower.clone()))
                    });
                    lower
                });
            let filtered: Vec<usize> = state
                .network
                .connections
                .iter()
                .enumerate()
                .filter(|(_, c)| {
                    if search_lower.is_empty() {
                        return true;
                    }
                    c.protocol.to_lowercase().contains(&search_lower)
                        || c.local_address.to_lowercase().contains(&search_lower)
                        || c.remote_address
                            .as_deref()
                            .unwrap_or("")
                            .to_lowercase()
                            .contains(&search_lower)
                        || c.state.to_lowercase().contains(&search_lower)
                        || c.process_name
                            .as_deref()
                            .unwrap_or("")
                            .to_lowercase()
                            .contains(&search_lower)
                })
                .map(|(i, _)| i)
                .collect();

            let previous_search = state.network.search.clone();
            widgets::SearchFilterBar::new(&mut state.network.search, "Adresse ou processus…")
                .result_count(filtered.len())
                .show(ui);
            if state.network.search != previous_search {
                state.network.connections_page = 0;
            }
            const CONN_PER_PAGE: usize = 50;
            let (nc_start, nc_len, _) = widgets::page_window(
                filtered.len(),
                CONN_PER_PAGE,
                &mut state.network.connections_page,
            );

            ui.add_space(theme::SPACE_MD);

            let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                || state.sync.in_progress;

            if filtered.is_empty() {
                if state.network.connections.is_empty() && is_loading {
                    ui.push_id("network_connections_skeletons", |ui: &mut egui::Ui| {
                        let cols = 5;
                        let column_widths =
                            [80.0, 200.0, 200.0, 110.0, ui.available_width() - 590.0];
                        for _ in 0..5 {
                            crate::widgets::skeleton::skeleton_table_row(ui, cols, &column_widths);
                            ui.add_space(theme::SPACE_MD);
                        }
                    });
                } else {
                    if state.network.search.trim().is_empty() {
                        widgets::empty_state(ui, icons::NETWORK, "Aucune connexion active", None);
                    } else {
                        widgets::empty_state(
                            ui,
                            icons::SEARCH,
                            "Aucune connexion ne correspond à la recherche",
                            Some("Essayez une autre adresse, un protocole ou un nom de processus."),
                        );
                        if widgets::ghost_button(ui, "Effacer la recherche").clicked() {
                            state.network.search.clear();
                            state.network.connections_page = 0;
                        }
                    }
                }
            } else {
                use widgets::table;

                let mut clicked_conn: Option<usize> = None;
                let selected = state.network.selected_connection;

                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fluid(64.0, 0.0),  // Proto
                        table::Col::fluid(150.0, 1.5), // Local
                        table::Col::fluid(150.0, 1.5), // Distant
                        table::Col::fluid(136.0, 0.0), // État: "EN FERMETURE" whole
                        table::Col::fluid(120.0, 2.0), // Processus
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui| {
                        table::header_cell(ui, "PROTO");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "LOCAL");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "DISTANT");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "\u{00c9}TAT");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "PROCESSUS");
                    });
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, nc_len, |mut row| {
                        let Some(&real_idx) = filtered.get(nc_start + row.index()) else {
                            return;
                        };
                        let Some(conn) = state.network.connections.get(real_idx) else {
                            return;
                        };
                        let is_selected = selected == Some(real_idx);
                        row.set_selected(is_selected);

                        row.col(|ui| {
                            widgets::status_badge(ui, &conn.protocol, theme::INFO);
                        });
                        row.col(|ui| {
                            table::cell_mono(
                                ui,
                                &format!("{}:{}", conn.local_address, conn.local_port),
                            );
                        });
                        row.col(|ui| {
                            match (&conn.remote_address, conn.remote_port) {
                                (Some(addr), Some(port)) => {
                                    table::cell_mono(ui, &format!("{}:{}", addr, port))
                                }
                                (Some(addr), None) => table::cell_mono(ui, addr),
                                (None, _) => table::cell_empty(ui),
                            };
                        });
                        row.col(|ui| {
                            if conn.state.trim().is_empty() {
                                table::cell_empty(ui);
                                return;
                            }
                            let (label, color) = match conn.state.as_str() {
                                "ESTABLISHED" => ("ÉTABLIE", theme::SUCCESS),
                                "LISTEN" => ("EN ÉCOUTE", theme::INFO),
                                "CLOSE_WAIT" | "TIME_WAIT" => ("EN FERMETURE", theme::WARNING),
                                _ => (conn.state.as_str(), theme::WARNING),
                            };
                            widgets::status_badge(ui, label, color);
                        });
                        row.col(|ui| {
                            match conn.process_name.as_deref() {
                                Some(name) => table::cell_icon(
                                    ui,
                                    icons::CUBE,
                                    theme::readable_color(theme::INFO),
                                    name,
                                ),
                                None => table::cell_empty(ui),
                            };
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked_conn = Some(real_idx);
                        }
                    });
                });

                if let Some(idx) = clicked_conn {
                    state.network.selected_connection = Some(idx);
                    state.network.selected_alert = None;
                    state.network.detail_open = true;
                }

                // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
                // and the page follows the selection.
                let mut position = state
                    .network
                    .selected_connection
                    .and_then(|real| filtered.iter().position(|&r| r == real));
                if widgets::navigate_list(
                    ui.ctx(),
                    &mut position,
                    filtered.len(),
                    &mut state.network.detail_open,
                ) && let Some(pos) = position
                {
                    state.network.selected_connection = Some(filtered[pos]);
                    state.network.connections_page = pos / CONN_PER_PAGE;
                }

                widgets::paginate_controls(
                    ui,
                    filtered.len(),
                    CONN_PER_PAGE,
                    &mut state.network.connections_page,
                );
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
    ) -> bool {
        let mut clicked = false;
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            clicked = widgets::clickable_card(ui, label, |ui: &mut egui::Ui| {
                ui.set_min_height(theme::SUMMARY_CARD_MIN_HEIGHT);
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(safe_color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(safe_color.linear_multiply(theme::OPACITY_DISABLED)),
                            );
                        },
                    );
                });
            })
            .on_hover_text("Consulter les données associées")
            .clicked();
        });
        clicked
    }

    fn security_alerts_section(ui: &mut Ui, state: &mut AppState) {
        widgets::data_card(ui, "Analyse de sécurité réseau", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("ANALYSE DE SÉCURITÉ RÉSEAU")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.network.alerts.is_empty() && state.network.alert_count == 0 {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "Réseau sécurisé",
                        "Le trafic est analysé en temps réel. Aucun flux malveillant détecté.",
                    );
                });
            } else if state.network.alerts.is_empty() {
                // Alerts count known but no details yet
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(icons::WARNING)
                            .size(theme::ICON_2XL)
                            .color(theme::ERROR.linear_multiply(theme::OPACITY_MEDIUM)),
                    );
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(alerts_detected(state.network.alert_count as usize))
                            .font(theme::font_body())
                            .color(theme::readable_color(theme::ERROR))
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("Actions de mitigation requises immédiatement")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL),
                    );
                });
            } else {
                // Show detailed alert rows
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icons::WARNING)
                            .color(theme::readable_color(theme::ERROR)),
                    );
                    ui.label(
                        egui::RichText::new(alerts_detected(state.network.alerts.len()))
                            .font(theme::font_body())
                            .color(theme::readable_color(theme::ERROR))
                            .strong(),
                    );
                });
                ui.add_space(theme::SPACE_SM);

                for (idx, alert) in state.network.alerts.iter().enumerate() {
                    if Self::alert_row(ui, alert, idx) {
                        state.network.selected_alert = Some(idx);
                        state.network.selected_connection = None;
                        state.network.detail_open = true;
                    }
                    ui.add_space(theme::SPACE_XS);
                }
            }
        });
    }

    fn flows_card(ui: &mut Ui, state: &AppState) {
        let mut by_state = [0_usize; 4];
        let (mut tcp, mut udp) = (0_usize, 0_usize);
        for conn in &state.network.connections {
            by_state[match conn.state.as_str() {
                "ESTABLISHED" => 0,
                "LISTEN" => 1,
                "TIME_WAIT" | "CLOSE_WAIT" => 2,
                _ => 3,
            }] += 1;
            if conn.protocol.to_ascii_lowercase().starts_with("tcp") {
                tcp += 1;
            } else if conn.protocol.to_ascii_lowercase().starts_with("udp") {
                udp += 1;
            }
        }
        let mut alerts: Breakdown = Vec::new();
        for alert in &state.network.alerts {
            let (label, color) = Self::alert_type_label_color(&alert.alert_type);
            match alerts.iter_mut().find(|(l, _, _)| *l == label) {
                Some(entry) => entry.1 += 1,
                None => alerts.push((label, 1, color)),
            }
        }
        alerts.sort_by_key(|a| std::cmp::Reverse(a.1));

        let states = vec![
            ("Établies".to_owned(), by_state[0], theme::SUCCESS),
            ("En écoute".to_owned(), by_state[1], theme::INFO),
            (
                "En fermeture".to_owned(),
                by_state[2],
                theme::SEVERITY_MEDIUM,
            ),
            ("Sans état".to_owned(), by_state[3], theme::text_tertiary()),
        ];
        let protocols = vec![
            ("TCP".to_owned(), tcp, theme::ACCENT),
            ("UDP".to_owned(), udp, theme::INFO),
        ];

        widgets::data_card(
            ui,
            "Répartition des flux et alertes",
            |ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("RÉPARTITION DES FLUX ET DES ALERTES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);
                let mut columns: Vec<(&str, &str, Breakdown)> = vec![
                    (icons::NETWORK, "États des connexions", states),
                    (icons::LINK, "Protocoles", protocols),
                ];
                if !alerts.is_empty() {
                    columns.push((icons::WARNING, "Alertes par type", alerts));
                }
                let gap = theme::SPACE_XL;
                let wide = ui.available_width() >= 300.0 * columns.len() as f32;
                let width = if wide {
                    (ui.available_width() - gap * (columns.len() - 1) as f32) / columns.len() as f32
                } else {
                    ui.available_width()
                };
                let layout = if wide {
                    egui::Layout::left_to_right(egui::Align::Min)
                } else {
                    egui::Layout::top_down(egui::Align::Min)
                };
                ui.with_layout(layout, |ui| {
                    let inner = ui.spacing().item_spacing;
                    ui.spacing_mut().item_spacing = egui::vec2(gap, theme::SPACE_LG);
                    for (icon, title, rows) in &columns {
                        ui.vertical(|ui| {
                            ui.spacing_mut().item_spacing = inner;
                            ui.set_width(width);
                            distribution_column(ui, icon, title, rows);
                        });
                    }
                });
            },
        );
    }

    fn alert_type_label_color(alert_type: &str) -> (String, egui::Color32) {
        match alert_type {
            "c2" => ("C2 COMMAND".to_string(), theme::ERROR),
            "mining" => ("CRYPTO MINING".to_string(), theme::ERROR),
            "exfiltration" => ("EXFILTRATION".to_string(), theme::ERROR),
            "dga" => ("DGA DÉTECTÉ".to_string(), theme::SEVERITY_HIGH),
            "beaconing" => ("BALISE C2".to_string(), theme::SEVERITY_HIGH),
            "port_scan" => ("SCAN PORTS".to_string(), theme::WARNING),
            "suspicious_port" => ("PORT SUSPECT".to_string(), theme::WARNING),
            "dns_tunneling" => ("TUNNEL DNS".to_string(), theme::SEVERITY_HIGH),
            "tor_exit" => ("SORTIE TOR".to_string(), theme::SEVERITY_HIGH),
            "rogue_dhcp" => ("DHCP PIRATE".to_string(), theme::SEVERITY_HIGH),
            "arp_spoofing" | "arp_spoof" => ("USURPATION ARP".to_string(), theme::ERROR),
            "new_device" => ("NOUVEL APPAREIL".to_string(), theme::INFO),
            "unusual_traffic" => ("TRAFIC INHABITUEL".to_string(), theme::WARNING),
            // Unknown keys still read as words, never as identifiers.
            other => (other.replace('_', " ").to_uppercase(), theme::INFO),
        }
    }

    fn alert_row(ui: &mut Ui, alert: &crate::dto::GuiNetworkAlert, idx: usize) -> bool {
        let (type_label, type_color) = Self::alert_type_label_color(&alert.alert_type);

        let frame_resp = egui::Frame::NONE
            .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
            .corner_radius(egui::CornerRadius::same(theme::SPACE_XS as u8))
            .fill(theme::tinted_surface(type_color))
            .stroke(egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::color_blend_pub(theme::bg_secondary(), type_color, 0.45),
            ))
            .show(ui, |ui: &mut egui::Ui| {
                // Every alert spans the card: rows sized to their text made
                // a ragged right edge.
                ui.set_width(ui.available_width());
                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(ui, &type_label, type_color);
                    if alert.allowlisted {
                        widgets::status_badge(ui, "Autorisée", theme::INFO);
                    } else if alert.acknowledged {
                        widgets::status_badge(ui, "Acquittée", theme::SUCCESS);
                    }

                    ui.add_space(theme::SPACE_SM);

                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(&alert.description)
                                .font(theme::font_body())
                                .color(theme::text_primary()),
                        );

                        ui.horizontal(|ui: &mut egui::Ui| {
                            if let Some(src) = &alert.source_ip {
                                ui.label(
                                    egui::RichText::new(format!("Source {}", src))
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            }
                            if let Some(dst) = &alert.destination_ip {
                                let dst_str = if let Some(port) = alert.destination_port {
                                    format!("→ {}:{}", dst, port)
                                } else {
                                    format!("→ {}", dst)
                                };
                                ui.label(
                                    egui::RichText::new(dst_str)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            }
                            ui.label(
                                egui::RichText::new(format!(
                                    "Confiance: {}\u{202f}%",
                                    alert.confidence
                                ))
                                .font(theme::font_min())
                                .color(theme::text_tertiary()),
                            );
                            ui.label(
                                egui::RichText::new(crate::format::local_time_secs(
                                    alert.detected_at,
                                ))
                                .font(theme::font_min())
                                .color(theme::text_tertiary()),
                            );
                        });
                    });
                });
            });

        let rect = frame_resp.response.rect;
        let resp = ui.interact(
            rect,
            ui.id().with(("net_alert_click", idx)),
            egui::Sense::click(),
        );
        if resp.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }
        resp.clicked()
    }

    fn export_interfaces_csv(state: &AppState) -> Result<std::path::PathBuf, String> {
        let headers = &["interface", "type", "statut", "mac", "ipv4"];
        let rows: Vec<Vec<String>> = state
            .network
            .interfaces
            .iter()
            .map(|iface| {
                vec![
                    iface.name.clone(),
                    iface.interface_type.clone(),
                    iface.status.clone(),
                    iface.mac_address.as_deref().unwrap_or("--").to_string(),
                    iface.ipv4_addresses.join(", "),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("network_interfaces.csv");
        crate::export::export_csv(headers, &rows, &path)?;
        Ok(path)
    }

    fn export_connections_csv(state: &AppState) -> Result<std::path::PathBuf, String> {
        let headers = &["protocole", "local", "distant", "statut", "processus"];
        let rows: Vec<Vec<String>> = state
            .network
            .connections
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
        crate::export::export_csv(headers, &rows, &path)?;
        Ok(path)
    }
}

/// Labelled counts with their colour, one row each.
type Breakdown = Vec<(String, usize, egui::Color32)>;

/// A breakdown as a titled proportion bar and a legend of counts and shares.
fn distribution_column(
    ui: &mut Ui,
    icon: &str,
    title: &str,
    rows: &[(String, usize, egui::Color32)],
) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(icon)
                .size(theme::ICON_XS)
                .color(theme::accent_text()),
        );
        ui.label(
            egui::RichText::new(title)
                .font(theme::font_body_strong())
                .color(theme::text_primary()),
        );
    });
    ui.add_space(theme::SPACE_SM);
    let total: usize = rows.iter().map(|(_, n, _)| n).sum();
    let height = 8.0;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if ui.is_rect_visible(rect) {
        let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
        ui.painter().rect_filled(rect, radius, theme::bg_tertiary());
        let live: Vec<_> = rows.iter().filter(|(_, n, _)| *n > 0).collect();
        let gap = 2.0;
        let usable = rect.width() - gap * live.len().saturating_sub(1) as f32;
        let mut x = rect.left();
        for (_, n, color) in live {
            let w = usable * *n as f32 / total.max(1) as f32;
            ui.painter().rect_filled(
                egui::Rect::from_min_size(egui::pos2(x, rect.top()), egui::vec2(w, height)),
                radius,
                theme::readable_color(*color),
            );
            x += w + gap;
        }
    }
    ui.add_space(theme::SPACE_SM);
    for (label, count, color) in rows {
        ui.horizontal(|ui| {
            let (dot, _) = ui.allocate_exact_size(egui::vec2(10.0, 10.0), egui::Sense::hover());
            ui.painter()
                .circle_filled(dot.center(), 4.0, theme::readable_color(*color));
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(if *count == 0 {
                        theme::text_tertiary()
                    } else {
                        theme::text_primary()
                    }),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(crate::format::pct(
                        *count as f32 / total.max(1) as f32 * 100.0,
                        0,
                    ))
                    .font(theme::font_caption())
                    .color(theme::text_tertiary()),
                );
                ui.label(
                    egui::RichText::new(count.to_string())
                        .font(theme::font_body_strong())
                        .color(theme::readable_color(*color)),
                );
            });
        });
    }
}

/// "1 alerte détectée", "3 alertes détectées".
fn alerts_detected(count: usize) -> String {
    let s = if count > 1 { "s" } else { "" };
    format!("{} alerte{s} détectée{s}", crate::format::int(count))
}

/// French name of an interface type as collectors report it.
fn interface_type_label(kind: &str) -> &str {
    match kind.to_ascii_lowercase().as_str() {
        "ethernet" => "Ethernet",
        "wifi" | "wi-fi" | "wireless" => "Wi-Fi",
        "bridge" => "Pont",
        "loopback" => "Boucle locale",
        "vpn" | "tunnel" => "Tunnel VPN",
        "virtual" => "Virtuelle",
        "cellular" => "Cellulaire",
        _ => kind,
    }
}
