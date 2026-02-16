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
        widgets::page_header_nav(
            ui,
            &["Sys & Network", "Réseau"],
            "Réseau",
            Some("CARTOGRAPHIE DES INTERFACES ET CONNEXIONS ACTIVES"),
            Some(
                "Analysez l'état des interfaces réseau et la liste des connexions actives. Les alertes DNS ou les flux vers des IPs suspectes sont mis en évidence pour faciliter l'investigation.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        if state.network.interfaces.is_empty() && state.network.connections.is_empty() {
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
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // ── Connection state + Protocol + Alert type distribution ───────
        {
            widgets::card(ui, |ui: &mut egui::Ui| {
                // ── A. Connection state distribution ──
                ui.label(
                    egui::RichText::new("DISTRIBUTION DES CONNEXIONS PAR ÉTAT")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                let mut established: usize = 0;
                let mut listen: usize = 0;
                let mut time_wait: usize = 0;
                let mut other_state: usize = 0;

                for conn in &state.network.connections {
                    match conn.state.as_str() {
                        "ESTABLISHED" => established += 1,
                        "LISTEN" => listen += 1,
                        "TIME_WAIT" | "CLOSE_WAIT" => time_wait += 1,
                        _ => other_state += 1,
                    }
                }

                ui.horizontal(|ui: &mut egui::Ui| {
                    let states: &[(&str, usize, egui::Color32)] = &[
                        ("ESTABLISHED", established, theme::SUCCESS),
                        ("LISTEN", listen, theme::INFO),
                        ("TIME_WAIT", time_wait, theme::WARNING),
                        ("AUTRES", other_state, theme::text_tertiary()),
                    ];
                    for (label, count, color) in states {
                        widgets::status_badge(
                            ui,
                            &format!("{}: {}", label, count),
                            *color,
                        );
                        ui.add_space(theme::SPACE_SM);
                    }
                });

                ui.add_space(theme::SPACE_MD);

                // ── B. Protocol distribution ──
                ui.label(
                    egui::RichText::new("DISTRIBUTION PAR PROTOCOLE")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);

                let mut tcp_count: usize = 0;
                let mut udp_count: usize = 0;
                for conn in &state.network.connections {
                    match conn.protocol.to_uppercase().as_str() {
                        "TCP" | "TCP4" | "TCP6" => tcp_count += 1,
                        "UDP" | "UDP4" | "UDP6" => udp_count += 1,
                        _ => {}
                    }
                }
                let proto_total = tcp_count.saturating_add(udp_count).max(1);

                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(
                        ui,
                        &format!("TCP: {}", tcp_count),
                        theme::ACCENT,
                    );
                    ui.add_space(theme::SPACE_SM);
                    widgets::status_badge(
                        ui,
                        &format!("UDP: {}", udp_count),
                        theme::accent_text(),
                    );
                });
                ui.add_space(theme::SPACE_XS);

                let tcp_ratio = tcp_count as f32 / proto_total as f32;
                // Mini stacked bar for TCP/UDP ratio
                let bar_height = theme::PROGRESS_BAR_HEIGHT;
                let bar_width = ui.available_width();
                let (rect, _) = ui.allocate_exact_size(
                    egui::vec2(bar_width, bar_height),
                    egui::Sense::hover(),
                );
                if ui.is_rect_visible(rect) {
                    let painter = ui.painter_at(rect);
                    let rounding =
                        egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
                    painter.rect_filled(rect, rounding, theme::bg_tertiary());

                    if tcp_count > 0 {
                        let tcp_w = tcp_ratio * bar_width;
                        let tcp_rect = egui::Rect::from_min_size(
                            rect.min,
                            egui::vec2(tcp_w, bar_height),
                        );
                        painter.rect_filled(tcp_rect, rounding, theme::ACCENT);
                    }
                    if udp_count > 0 {
                        let udp_w = (1.0 - tcp_ratio) * bar_width;
                        let udp_rect = egui::Rect::from_min_size(
                            egui::pos2(
                                rect.min.x + tcp_ratio * bar_width,
                                rect.min.y,
                            ),
                            egui::vec2(udp_w, bar_height),
                        );
                        painter.rect_filled(udp_rect, rounding, theme::accent_text());
                    }
                }

                // ── C. Alert type distribution ──
                if !state.network.alerts.is_empty() {
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new("DISTRIBUTION DES ALERTES PAR TYPE")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_SM);

                    // Count alert types
                    let mut alert_type_counts: Vec<(String, usize, egui::Color32)> =
                        Vec::new();
                    for alert in state.network.alerts.iter() {
                        let (label, color) =
                            Self::alert_type_label_color(&alert.alert_type);
                        if let Some(existing) = alert_type_counts
                            .iter_mut()
                            .find(|(l, _, _)| *l == label)
                        {
                            existing.1 += 1;
                        } else {
                            alert_type_counts.push((label, 1, color));
                        }
                    }

                    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                        for (label, count, color) in &alert_type_counts {
                            widgets::status_badge(
                                ui,
                                &format!("{}: {}", label, count),
                                *color,
                            );
                            ui.add_space(theme::SPACE_SM);
                        }
                    });
                }
            });
        }

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
        ui.push_id("security_alerts_section", |ui: &mut egui::Ui| {
            Self::security_alerts_section(ui, state);
        });

        ui.add_space(theme::SPACE_XL);

        let ctx = ui.ctx().clone();
        if state.network.detail_open {
            if let Some(sel) = state.network.selected_connection {
                if sel < state.network.connections.len() {
                    let conn = state.network.connections[sel].clone();
                    let (state_label, state_color) = match conn.state.as_str() {
                        "ESTABLISHED" => ("ESTABLISHED", theme::SUCCESS),
                        "LISTEN" => ("LISTEN", theme::INFO),
                        "CLOSE_WAIT" | "TIME_WAIT" => ("CLOSED", theme::WARNING),
                        _ => (conn.state.as_str(), theme::WARNING),
                    };
                    let title = format!(
                        "{}:{}",
                        conn.local_address, conn.local_port
                    );
                    let actions = [
                        widgets::DetailAction::secondary("Copier", icons::COPY),
                        widgets::DetailAction::danger("Bloquer", icons::LOCK),
                    ];
                    let drawer_action = widgets::DetailDrawer::new("net_conn_detail", &title, icons::NETWORK)
                        .accent(theme::ACCENT)
                        .subtitle("Connexion r\u{00e9}seau")
                        .show(&ctx, &mut state.network.detail_open, |ui| {
                            widgets::detail_section(ui, "CONNEXION R\u{00c9}SEAU");
                            widgets::detail_field_badge(ui, "Protocole", &conn.protocol, theme::INFO);
                            widgets::detail_mono(ui, "Adresse locale", &conn.local_address);
                            widgets::detail_field(ui, "Port local", &conn.local_port.to_string());
                            widgets::detail_mono(
                                ui,
                                "Adresse distante",
                                conn.remote_address.as_deref().unwrap_or("--"),
                            );
                            widgets::detail_field(
                                ui,
                                "Port distant",
                                &conn.remote_port.map(|p| p.to_string()).unwrap_or_else(|| "--".to_string()),
                            );
                            widgets::detail_field_badge(ui, "\u{00c9}tat", state_label, state_color);
                            widgets::detail_field(
                                ui,
                                "Processus",
                                conn.process_name.as_deref().unwrap_or("--"),
                            );
                        }, &actions);
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
                        } else if action_idx == 1 {
                            state.network.detail_open = false;
                        }
                    }
                }
            } else if let Some(sel) = state.network.selected_alert
                && sel < state.network.alerts.len()
            {
                let alert = state.network.alerts[sel].clone();
                let (type_label, type_color) = Self::alert_type_label_color(&alert.alert_type);
                let sev_color = match alert.severity {
                    crate::dto::Severity::Critical => theme::ERROR,
                    crate::dto::Severity::High => theme::SEVERITY_HIGH,
                    crate::dto::Severity::Medium => theme::WARNING,
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
                let actions = [
                    widgets::DetailAction::primary("Acquitter", icons::CHECK),
                    widgets::DetailAction::secondary("Investiguer", icons::SEARCH),
                    widgets::DetailAction::danger("Ignorer", icons::EYE_SLASH),
                ];
                let drawer_action = widgets::DetailDrawer::new("net_alert_detail", &type_label, icons::WARNING)
                    .accent(type_color)
                    .subtitle("Alerte r\u{00e9}seau")
                    .show(&ctx, &mut state.network.detail_open, |ui| {
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
                            &alert.destination_port.map(|p| p.to_string()).unwrap_or_else(|| "--".to_string()),
                        );
                        widgets::detail_field_colored(
                            ui,
                            "Confiance",
                            &format!("{}%", alert.confidence),
                            conf_color,
                        );
                        widgets::detail_field(
                            ui,
                            "Date de d\u{00e9}tection",
                            &alert.detected_at.format("%d/%m/%Y %H:%M:%S").to_string(),
                        );
                    }, &actions);
                if let Some(action_idx) = drawer_action {
                    let time = ctx.input(|i| i.time);
                    if action_idx == 0 {
                        state.network.detail_open = false;
                        state.toasts.push(
                            crate::widgets::toast::Toast::success("Alerte acquitt\u{00e9}e")
                                .with_time(time),
                        );
                    } else if action_idx == 1 {
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
                    } else if action_idx == 2 {
                        state.network.detail_open = false;
                        state.network.selected_alert = None;
                    }
                }
            }
        }

        command
    }

    fn interfaces_table(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("INTERFACES RÉSEAU DETECTÉES")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::ghost_button(ui, format!("{}  EXPORT CSV", icons::DOWNLOAD))
                            .clicked()
                            && Self::export_interfaces_csv(state)
                        {
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

            if state.network.interfaces.is_empty() {
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
                            state.network.interfaces.len(),
                            |mut row| {
                                let iface = &state.network.interfaces[row.index()];
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
                                        ("HORS-LIGNE", theme::WARNING)
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
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::ghost_button(ui, format!("{}  EXPORT CSV", icons::DOWNLOAD))
                            .clicked()
                            && Self::export_connections_csv(state)
                        {
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

            let search_id = ui.id().with("network_search_cache");
            let search_lower: String = ui.memory(|mem| {
                mem.data.get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.network.search)
                    .map(|(_, lower)| lower)
            }).unwrap_or_else(|| {
                let lower = state.network.search.to_ascii_lowercase();
                ui.memory_mut(|mem| mem.data.insert_temp(search_id, (state.network.search.clone(), lower.clone())));
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

            widgets::SearchFilterBar::new(&mut state.network.search, "Rechercher...")
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
                    .sense(egui::Sense::click())
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(80.0).at_least(40.0))
                    .column(Column::initial(200.0).at_least(100.0))
                    .column(Column::initial(200.0).at_least(100.0))
                    .column(Column::initial(110.0).at_least(80.0))
                    .column(Column::remainder());

                let mut clicked_conn: Option<usize> = None;

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
                                egui::RichText::new("\u{00c9}TAT")
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
                            let real_idx = filtered[row.index()];
                            let conn = &state.network.connections[real_idx];
                            row.col(|ui: &mut egui::Ui| {
                                widgets::status_badge(
                                    ui,
                                    &conn.protocol,
                                    theme::INFO,
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
                                    _ => (conn.state.as_str(), theme::WARNING),
                                };
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(icons::CUBE)
                                            .color(theme::readable_color(theme::INFO)),
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

                            if row.response().clicked() {
                                clicked_conn = Some(real_idx);
                            }
                        });
                    });

                if let Some(idx) = clicked_conn {
                    state.network.selected_connection = Some(idx);
                    state.network.selected_alert = None;
                    state.network.detail_open = true;
                }
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
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
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
            });
        });
    }

    fn security_alerts_section(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
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
                        "RÉSEAU SÉCURISÉ",
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
                        egui::RichText::new(format!(
                            "{} ALERTE(S) DÉTECTÉE(S)",
                            state.network.alert_count
                        ))
                        .font(theme::font_body())
                        .color(theme::readable_color(theme::ERROR))
                        .strong(),
                    );
                    ui.label(
                        egui::RichText::new("ACTIONS DE MITIGATION REQUISES IMMÉDIATEMENT")
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
                        egui::RichText::new(format!(
                            "{} ALERTE(S) DÉTECTÉE(S)",
                            state.network.alerts.len()
                        ))
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
            other => (other.to_uppercase(), theme::INFO),
        }
    }

    fn alert_row(ui: &mut Ui, alert: &crate::dto::GuiNetworkAlert, idx: usize) -> bool {
        let (type_label, type_color) = Self::alert_type_label_color(&alert.alert_type);

        let frame_resp = egui::Frame::NONE
            .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
            .corner_radius(egui::CornerRadius::same(theme::SPACE_XS as u8))
            .fill(type_color.linear_multiply(theme::OPACITY_SUBTLE))
            .stroke(egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                type_color.linear_multiply(theme::OPACITY_MUTED),
            ))
            .show(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    widgets::status_badge(ui, &type_label, type_color);

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
                                    egui::RichText::new(format!("SRC: {}", src))
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            }
                            if let Some(dst) = &alert.destination_ip {
                                let dst_str = if let Some(port) = alert.destination_port {
                                    format!("DST: {}:{}", dst, port)
                                } else {
                                    format!("DST: {}", dst)
                                };
                                ui.label(
                                    egui::RichText::new(dst_str)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            }
                            ui.label(
                                egui::RichText::new(format!("Confiance: {}%", alert.confidence))
                                    .font(theme::font_min())
                                    .color(theme::text_tertiary()),
                            );
                            ui.label(
                                egui::RichText::new(
                                    alert.detected_at.format("%H:%M:%S").to_string(),
                                )
                                .font(theme::font_min())
                                .color(theme::text_tertiary()),
                            );
                        });
                    });
                });
            });

        let rect = frame_resp.response.rect;
        ui.interact(rect, ui.id().with(("net_alert_click", idx)), egui::Sense::click())
            .clicked()
    }

    fn export_interfaces_csv(state: &AppState) -> bool {
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
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(()) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
