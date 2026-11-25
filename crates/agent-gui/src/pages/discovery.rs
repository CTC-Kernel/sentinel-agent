// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network Discovery page -- scan, discover, and propose assets.

use crate::app::AppState;
use crate::icons;
use crate::pages::assets::order;
use crate::theme;
use crate::theme::LinearFade as _;
use crate::widgets;
use egui::Ui;

/// Key of the "block this device" confirmation dialog.
const BLOCK_CONFIRM: &str = "discovery_block_confirm";

pub struct DiscoveryPage;

impl DiscoveryPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<crate::events::GuiCommand> {
        let mut cmd: Option<crate::events::GuiCommand> = None;

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "D\u{00e9}tection"],
            "D\u{00e9}tection Shadow IT",
            Some(
                "\u{00c9}quipements non autoris\u{00e9}s d\u{00e9}tect\u{00e9}s sur le p\u{00e9}rim\u{00e8}tre r\u{00e9}seau.",
            ),
            Some(
                "Scannez votre r\u{00e9}seau pour d\u{00e9}tecter les \u{00e9}quipements non r\u{00e9}f\u{00e9}renc\u{00e9}s dans l\u{2019}inventaire. Les appareils inconnus repr\u{00e9}sentent un risque de s\u{00e9}curit\u{00e9} (Shadow IT).",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Control bar (AAA Grade)
        ui.scope(|ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                let is_scanning = state.discovery.in_progress;

                // Discovery probes the network, so it is an administrator
                // action. Locked, the button stays clickable: it asks for the
                // password instead of sitting greyed out with "· admin".
                let unlocked = state.security.admin_unlocked;
                let lock = if unlocked {
                    String::new()
                } else {
                    format!("  {}", icons::LOCK)
                };
                let btn_response = if is_scanning {
                    widgets::primary_button(
                        ui,
                        format!("{}  Interrompre l'analyse{lock}", icons::STOP),
                        true,
                    )
                } else {
                    widgets::primary_button(
                        ui,
                        format!("{}  Lancer la découverte{lock}", icons::PLAY),
                        true,
                    )
                };
                let btn_response = if unlocked {
                    btn_response
                } else {
                    btn_response.on_hover_text("Nécessite le mode administrateur")
                };

                if btn_response.clicked()
                    && state.require_admin("Lancer ou interrompre la découverte réseau")
                {
                    if is_scanning {
                        cmd = Some(crate::events::GuiCommand::StopDiscovery);
                    } else {
                        // Clear stale selection before starting a new scan
                        state.discovery.selected_device = None;
                        state.discovery.detail_open = false;
                        cmd = Some(crate::events::GuiCommand::StartDiscovery);
                    }
                }

                ui.add_space(theme::SPACE_MD);

                // AAA Progress System
                if is_scanning {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.add_space(theme::SPACE_XS);
                        let progress = state.discovery.progress;
                        let bar_width = theme::SPLASH_PROGRESS_WIDTH;
                        let bar_height = theme::PROGRESS_BAR_HEIGHT_THIN;
                        let (bar_rect, _) = ui.allocate_exact_size(
                            egui::Vec2::new(bar_width, bar_height),
                            egui::Sense::hover(),
                        );

                        if ui.is_rect_visible(bar_rect) {
                            let reduced = theme::is_reduced_motion();

                            ui.painter().rect_filled(
                                bar_rect,
                                egui::CornerRadius::same(theme::ROUNDING_XS),
                                theme::bg_elevated(),
                            );

                            let fill_width = bar_width * progress;
                            if fill_width > 0.0 {
                                let fill_rect = egui::Rect::from_min_size(
                                    bar_rect.min,
                                    egui::Vec2::new(fill_width, bar_height),
                                );

                                if reduced {
                                    // Static glow — no pulse animation
                                    for i in 1..4 {
                                        let expansion = i as f32 * 2.0;
                                        let alpha = 0.12 / (i as f32);
                                        ui.painter().rect_filled(
                                            fill_rect.expand(expansion),
                                            egui::CornerRadius::same(theme::ROUNDING_SM),
                                            theme::ACCENT.linear_fade(alpha),
                                        );
                                    }
                                } else {
                                    let time = ui.input(|i| i.time);
                                    let pulse = (((time * 2.0).sin() * 0.5 + 0.5) as f32).powi(2);

                                    for i in 1..4 {
                                        let expansion = i as f32 * 2.0;
                                        let alpha = 0.12 / (i as f32);
                                        ui.painter().rect_filled(
                                            fill_rect.expand(expansion),
                                            egui::CornerRadius::same(theme::ROUNDING_SM),
                                            theme::ACCENT.linear_fade(alpha * (0.8 + pulse * 0.2)),
                                        );
                                    }
                                }

                                // Solid fill
                                ui.painter().rect_filled(
                                    fill_rect,
                                    egui::CornerRadius::same(theme::ROUNDING_XS),
                                    theme::ACCENT,
                                );

                                // Shimmer — skip when reduced motion
                                if !reduced {
                                    let time = ui.input(|i| i.time);
                                    let shimmer_x =
                                        (time * 0.4).fract() as f32 * (fill_width + 40.0) - 20.0;
                                    let shimmer_rect = egui::Rect::from_min_size(
                                        bar_rect.min + egui::vec2(shimmer_x, 0.0),
                                        egui::vec2(20.0, bar_height),
                                    );
                                    let visible_shimmer = shimmer_rect.intersect(fill_rect);
                                    if visible_shimmer.is_positive() {
                                        ui.painter().rect_filled(
                                            visible_shimmer,
                                            egui::CornerRadius::same(theme::ROUNDING_XS),
                                            theme::overlay_color().linear_fade(theme::OPACITY_TINT),
                                        );
                                    }
                                }
                            }
                            if !reduced {
                                ui.ctx().request_repaint();
                            }
                        }

                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(state.discovery.phase.to_uppercase())
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                                    .strong(),
                            );
                            ui.label(
                                egui::RichText::new(format!(
                                    "{:.0}\u{202f}% COMPLET",
                                    progress * 100.0
                                ))
                                .font(theme::font_label())
                                .color(theme::accent_text())
                                .strong(),
                            );
                        });
                    });
                }
            });
        });

        // A scan that was refused or failed says why, until the next one.
        if let Some(reason) = state.discovery.error.clone() {
            ui.add_space(theme::SPACE_SM);
            widgets::alert::Alert::new(&reason)
                .level(widgets::alert::AlertLevel::Error)
                .title("Découverte non effectuée")
                .compact()
                .show(ui);
        }

        ui.add_space(theme::SPACE_SM);

        // Shadow IT KPI cards
        {
            let total = state.discovery.devices.len();
            let asset_ips: std::collections::HashSet<&str> =
                state.assets.assets.iter().map(|a| a.ip.as_str()).collect();
            let authorized = state
                .discovery
                .devices
                .iter()
                .filter(|d| asset_ips.contains(d.ip.as_str()))
                .count();
            let shadow = total.saturating_sub(authorized);

            let card_grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
            let items = vec![
                (
                    "D\u{00c9}TECT\u{00c9}S",
                    total.to_string(),
                    theme::text_primary(),
                    icons::NETWORK,
                ),
                (
                    "SHADOW IT",
                    shadow.to_string(),
                    if shadow > 0 {
                        theme::ERROR
                    } else {
                        theme::text_tertiary()
                    },
                    icons::SEVERITY_CRITICAL,
                ),
                (
                    "AUTORIS\u{00c9}S",
                    authorized.to_string(),
                    if authorized > 0 {
                        theme::SUCCESS
                    } else {
                        theme::text_tertiary()
                    },
                    icons::CHECK,
                ),
            ];

            card_grid.show(ui, &items, |ui, width, item| {
                let (label, value, color, icon) = item;
                if Self::kpi_card(ui, width, label, value, *color, icon) {
                    widgets::open_data_panel(ui.ctx(), "Équipements découverts");
                    state.discovery.search.clear();
                    state.discovery.shadow_filter = match *label {
                        "SHADOW IT" => Some(true),
                        "AUTORIS\u{00c9}S" => Some(false),
                        _ => None,
                    };
                }
            });
        }

        ui.add_space(theme::SPACE_MD);

        let search_id = ui.id().with("discovery_search_cache");
        let search_upper: String = ui
            .memory(|mem| {
                mem.data
                    .get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.discovery.search)
                    .map(|(_, upper)| upper)
            })
            .unwrap_or_else(|| {
                let upper = state.discovery.search.to_uppercase();
                ui.memory_mut(|mem| {
                    mem.data
                        .insert_temp(search_id, (state.discovery.search.clone(), upper.clone()))
                });
                upper
            });
        let authorized_ips: std::collections::HashSet<&str> =
            state.assets.assets.iter().map(|a| a.ip.as_str()).collect();
        let shadow_filter = state.discovery.shadow_filter;
        let mut filtered: Vec<usize> = state
            .discovery
            .devices
            .iter()
            .enumerate()
            .filter(|(_, d)| {
                if let Some(shadow_only) = shadow_filter
                    && authorized_ips.contains(d.ip.as_str()) == shadow_only
                {
                    return false;
                }
                if search_upper.is_empty() {
                    return true;
                }
                d.ip.to_uppercase().contains(&search_upper)
                    || d.hostname
                        .as_deref()
                        .unwrap_or("")
                        .to_uppercase()
                        .contains(&search_upper)
                    || d.vendor
                        .as_deref()
                        .unwrap_or("")
                        .to_uppercase()
                        .contains(&search_upper)
            })
            .map(|(i, _)| i)
            .collect();
        order::sort(ui.ctx(), "discovery_devices", &mut filtered, |key, a, b| {
            let (a, b) = (&state.discovery.devices[a], &state.discovery.devices[b]);
            match key {
                // Unauthorised first: what needs a decision leads.
                "status" => authorized_ips
                    .contains(a.ip.as_str())
                    .cmp(&authorized_ips.contains(b.ip.as_str())),
                _ => compare_devices(key, a, b),
            }
        });

        // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
        // The selection is an index in `devices`; the keys walk `filtered`.
        let mut position = state
            .discovery
            .selected_device
            .and_then(|real| filtered.iter().position(|&i| i == real));
        if widgets::navigate_list(
            ui.ctx(),
            &mut position,
            filtered.len(),
            &mut state.discovery.detail_open,
        ) && let Some(pos) = position
        {
            state.discovery.selected_device = Some(filtered[pos]);
        }

        let result_count = filtered.len();

        let (toggled, export) = widgets::SearchFilterBar::new(
            &mut state.discovery.search,
            "Filtrer par adresse IP, nom d'hôte ou constructeur…",
        )
        .chip("Shadow IT", shadow_filter == Some(true), theme::ERROR)
        .chip("Autorisés", shadow_filter == Some(false), theme::SUCCESS)
        .result_count(result_count)
        .action(format!("{}  CSV", icons::DOWNLOAD))
        .show_with_action(ui);
        if let Some(index) = toggled {
            let target = Some(index == 0);
            state.discovery.shadow_filter = if shadow_filter == target {
                None
            } else {
                target
            };
        }
        if export {
            let success = Self::export_csv(state, &filtered);
            let time = ui.input(|i| i.time);
            if success {
                state.toasts.push(
                    crate::widgets::toast::Toast::success("Export CSV découverte terminé")
                        .with_time(time),
                );
            } else {
                state.toasts.push(
                    crate::widgets::toast::Toast::error("Échec de l'export CSV").with_time(time),
                );
            }
        }

        ui.add_space(theme::SPACE_MD);

        // Device table (AAA Grade)
        if filtered.is_empty() && !state.discovery.in_progress {
            widgets::data_card(ui, "Équipements découverts", |ui: &mut egui::Ui| {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_XL);
                    if state.discovery.devices.is_empty() {
                        widgets::empty_state(
                            ui,
                            icons::NETWORK,
                            "Aucun \u{00e9}quipement d\u{00e9}tect\u{00e9}",
                            Some("Lancez un scan pour identifier les appareils non autoris\u{00e9}s sur votre r\u{00e9}seau (Shadow IT)."),
                        );
                    } else {
                        // Devices exist: the search or the filter hides them.
                        widgets::empty_state(
                            ui,
                            icons::SEARCH,
                            "Aucun r\u{00e9}sultat",
                            Some("Aucun \u{00e9}quipement ne correspond \u{00e0} la recherche ou au filtre."),
                        );
                        if widgets::ghost_button(ui, "Effacer la recherche").clicked() {
                            state.discovery.search.clear();
                            state.discovery.shadow_filter = None;
                        }
                    }
                    ui.add_space(theme::SPACE_XL);
                });
            });
        } else if !filtered.is_empty() {
            widgets::data_card(ui, "Équipements découverts", |ui: &mut egui::Ui| {
                use widgets::table;

                let mut clicked_idx: Option<usize> = None;
                let mut copied = false;
                let mut resorted = false;
                let selected = state.discovery.selected_device;

                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fluid(120.0, 1.0), // Adresse IP / MAC
                        table::Col::fluid(84.0, 0.0),  // Statut
                        table::Col::fluid(120.0, 2.5), // Nom d'hôte
                        table::Col::fluid(116.0, 1.5), // Constructeur: header whole
                        table::Col::fluid(116.0, 0.0), // Type d'actif: header and "COMMUTATEUR" whole
                        table::Col::fluid(96.0, 0.8),  // Services
                        table::Col::fluid(104.0, 0.5), // Dernière vue
                        table::Col::fixed(56.0),       // Copier: one icon button
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    if order::headers(
                        &mut header,
                        "discovery_devices",
                        &[
                            ("ADRESSE IP / MAC", Some("ip")),
                            ("STATUT", Some("status")),
                            ("NOM D'HÔTE", Some("hostname")),
                            ("CONSTRUCTEUR", Some("vendor")),
                            ("TYPE D'ACTIF", Some("type")),
                            ("SERVICES", Some("ports")),
                            ("DERNIÈRE VUE", Some("last_seen")),
                            ("", None),
                        ],
                    ) {
                        resorted = true;
                    }
                })
                .body(|body| {
                    let now = chrono::Utc::now();
                    body.rows(theme::TABLE_DATA_ROW_HEIGHT, filtered.len(), |mut row| {
                        let Some(&dev_idx) = filtered.get(row.index()) else {
                            return;
                        };
                        let Some(device) = state.discovery.devices.get(dev_idx) else {
                            return;
                        };
                        let is_selected = selected == Some(dev_idx);
                        row.set_selected(is_selected);

                        let is_authorized = state.assets.assets.iter().any(|a| a.ip == device.ip);

                        row.col(|ui| {
                            table::cell_stack_mono(
                                ui,
                                &device.ip,
                                device.mac.as_deref().unwrap_or_default(),
                            );
                        });
                        row.col(|ui| {
                            if is_authorized {
                                widgets::status_badge(ui, "AUTORIS\u{00c9}", theme::SUCCESS);
                            } else {
                                widgets::status_badge(ui, "SHADOW", theme::ERROR);
                            }
                        });
                        row.col(|ui| {
                            match device.hostname.as_deref() {
                                Some(name) => table::cell(ui, name),
                                None => table::cell_empty(ui),
                            };
                        });
                        row.col(|ui| {
                            let vendor = device.vendor.as_deref().unwrap_or("Non identifié");
                            table::cell_small(ui, &vendor.to_uppercase());
                        });
                        row.col(|ui| {
                            let (label, color) = device_type_badge(&device.device_type);
                            widgets::status_badge(ui, label, color);
                        });
                        row.col(|ui| {
                            if device.open_ports.is_empty() {
                                table::cell_empty(ui);
                            } else {
                                let ports_str = device
                                    .open_ports
                                    .iter()
                                    .take(3)
                                    .map(|p| p.to_string())
                                    .collect::<Vec<_>>()
                                    .join(", ");
                                table::cell_mono_muted(ui, &ports_str);
                            }
                        });
                        row.col(|ui| {
                            let ago = now.signed_duration_since(device.last_seen);
                            let text = if ago.num_hours() < 24 {
                                crate::format::ago(now, device.last_seen)
                            } else {
                                crate::format::local_day_time(device.last_seen)
                            };
                            let color = theme::readable_color(if ago.num_hours() < 1 {
                                theme::SUCCESS
                            } else if ago.num_hours() < 24 {
                                theme::WARNING
                            } else {
                                theme::text_secondary()
                            });
                            table::cell_colored(ui, &text, color).on_hover_text(
                                crate::format::local_datetime_secs(device.last_seen),
                            );
                        });
                        row.col(|ui| {
                            // An action, not a filter: a quiet button, not a chip.
                            if widgets::button::icon_button(
                                ui,
                                icons::COPY,
                                Some("Copier l'adresse IP"),
                            )
                            .clicked()
                            {
                                ui.ctx().copy_text(device.ip.clone());
                                copied = true;
                            }
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked_idx = Some(dev_idx);
                        }
                    });
                });

                // The selection is an index in `devices`: it follows its row.
                let _ = resorted;
                if copied {
                    state.push_toast(
                        crate::widgets::toast::Toast::success("Adresse IP copiée"),
                        ui.ctx(),
                    );
                } else if let Some(idx) = clicked_idx {
                    state.discovery.selected_device = Some(idx);
                    state.discovery.detail_open = true;
                }
            });
        }

        ui.add_space(theme::SPACE_XL);

        if let Some(drawer_cmd) = Self::detail_drawer(ui, state) {
            cmd = Some(drawer_cmd);
        }

        if let Some(block_cmd) =
            super::block_confirm::resolve(ui, state, BLOCK_CONFIRM, "Bloquer l'\u{00e9}quipement ?")
        {
            cmd = Some(block_cmd);
        }

        cmd
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState) -> Option<crate::events::GuiCommand> {
        let selected = match state.discovery.selected_device {
            Some(idx) if idx < state.discovery.devices.len() => idx,
            _ => return None,
        };

        let device = &state.discovery.devices[selected];
        let ip = device.ip.clone();
        let mac = device.mac.clone();
        let hostname = device.hostname.clone();
        let vendor = device.vendor.clone();
        let device_type = device.device_type.clone();
        let subnet = device.subnet.clone();
        let is_gateway = device.is_gateway;
        let open_ports = device.open_ports.clone();
        let first_seen_ts = device.first_seen;
        let last_seen_ts = device.last_seen;
        let first_seen = crate::format::local_datetime(device.first_seen);
        let last_seen = crate::format::local_datetime(device.last_seen);
        let (type_label, type_color) = device_type_badge(&device_type);

        // Check whether this device is already imported as a managed asset.
        let already_imported = state.assets.assets.iter().any(|a| a.ip == ip);

        let mut actions = vec![
            widgets::DetailAction::primary("Autoriser cet \u{00e9}quipement", icons::PLUS),
            // It copies the command: the agent does not run nmap itself.
            widgets::DetailAction::secondary("Copier la commande nmap", icons::COPY),
            widgets::DetailAction::danger("Bloquer", icons::LOCK),
        ];

        // Grey-out the import button when already imported.
        if already_imported {
            actions[0] =
                widgets::DetailAction::secondary("\u{00c9}quipement autoris\u{00e9}", icons::CHECK)
                    .enabled(false);
        }

        let title = hostname.clone().unwrap_or_else(|| ip.clone());
        let action = widgets::DetailDrawer::new("discovery_detail", &title, icons::NETWORK)
            .accent(type_color)
            .subtitle(&ip)
            .show(
                ui.ctx(),
                &mut state.discovery.detail_open,
                |ui| {
                    widgets::detail_section(ui, "APPAREIL DÉCOUVERT");
                    widgets::detail_mono(ui, "Adresse IP", &ip);
                    if let Some(ref m) = mac {
                        widgets::detail_mono(ui, "Adresse MAC", m);
                    }
                    if let Some(ref h) = hostname {
                        widgets::detail_field(ui, "Nom d'hôte", h);
                    }
                    if let Some(ref v) = vendor {
                        widgets::detail_field(ui, "Constructeur", v);
                    }
                    widgets::detail_field_badge(ui, "Type d'appareil", type_label, type_color);
                    widgets::detail_mono(ui, "Sous-réseau", &subnet);

                    widgets::detail_section(ui, "RÉSEAU");
                    if is_gateway {
                        widgets::detail_field_badge(ui, "Passerelle", "OUI", theme::ACCENT);
                    } else {
                        widgets::detail_field_badge(
                            ui,
                            "Passerelle",
                            "NON",
                            theme::text_tertiary(),
                        );
                    }
                    if open_ports.is_empty() {
                        widgets::detail_field(ui, "Ports ouverts", "Aucun");
                    } else {
                        let ports_str = open_ports
                            .iter()
                            .map(|p| p.to_string())
                            .collect::<Vec<_>>()
                            .join(", ");
                        widgets::detail_mono(ui, "Ports ouverts", &ports_str);
                    }

                    widgets::detail_section(ui, "TEMPORALITÉ");
                    widgets::detail_field(ui, "Première détection", &first_seen);
                    widgets::detail_field(ui, "Dernière détection", &last_seen);
                },
                &actions,
            );

        if let Some(action_idx) = action {
            let time = ui.ctx().input(|i| i.time);
            // Authorising a device is an administrator action, here as on
            // the inventory page.
            if action_idx == 0
                && !already_imported
                && state.require_admin("Autoriser un appareil découvert dans l'inventaire")
            {
                // "Ajouter aux actifs" — create a ManagedAsset from the
                // discovered device and queue it for persistence.
                let criticality = crate::pages::AssetsPage::infer_criticality_from_device(
                    is_gateway,
                    &open_ports,
                );

                let asset = crate::dto::ManagedAsset {
                    id: uuid::Uuid::new_v4().to_string(),
                    ip: ip.clone(),
                    hostname: hostname.clone(),
                    mac: mac.clone(),
                    vendor: vendor.clone(),
                    device_type: device_type.clone(),
                    criticality,
                    lifecycle: crate::dto::AssetLifecycle::Discovered,
                    tags: Vec::new(),
                    risk_score: 0.0,
                    vulnerability_count: 0,
                    open_ports: open_ports.clone(),
                    software: Vec::new(),
                    first_seen: first_seen_ts,
                    last_seen: last_seen_ts,
                };

                state.assets.assets.push(asset.clone());
                state.assets.pending_asset_saves.push(asset);
                state.toasts.push(
                    crate::widgets::toast::Toast::success(
                        "\u{00c9}quipement ajout\u{00e9} aux actifs g\u{00e9}r\u{00e9}s",
                    )
                    .with_time(time),
                );
                state.discovery.detail_open = false;
            } else if action_idx == 1 {
                let safe_ip = ip.replace('\'', "'\\''");
                let nmap_cmd = format!("nmap -sV '{}'", safe_ip);
                ui.ctx().copy_text(nmap_cmd);
                state.toasts.push(
                    crate::widgets::toast::Toast::info(
                        "Commande nmap copi\u{00e9}e dans le presse-papiers",
                    )
                    .with_time(time),
                );
            } else if action_idx == 2 {
                // A permanent block: ask first. Nothing is sent, and nothing
                // is announced, until the operator confirms.
                super::block_confirm::ask(ui.ctx(), BLOCK_CONFIRM, ip.clone());
                state.discovery.detail_open = false;
            }
        }
        None
    }

    fn kpi_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) -> bool {
        widgets::metric_card(ui, width, label, value, color, icon)
    }

    fn export_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["ip", "nom_hote", "mac", "constructeur", "type", "ports"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let d = state.discovery.devices.get(i)?;
                Some(vec![
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
                ])
            })
            .collect();
        let path = crate::export::default_export_path("decouverte.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}

/// Order two devices under a column key, ascending. The status column
/// depends on the inventory and is ordered by the page.
fn compare_devices(
    key: &str,
    a: &crate::dto::GuiDiscoveredDevice,
    b: &crate::dto::GuiDiscoveredDevice,
) -> std::cmp::Ordering {
    match key {
        "ip" => order::ip(&a.ip, &b.ip),
        "hostname" => order::opt_text(a.hostname.as_deref(), b.hostname.as_deref()),
        "vendor" => order::opt_text(a.vendor.as_deref(), b.vendor.as_deref()),
        "type" => order::text(
            device_type_badge(&a.device_type).0,
            device_type_badge(&b.device_type).0,
        ),
        // By how many ports answer, then by the lowest of them.
        "ports" => a
            .open_ports
            .len()
            .cmp(&b.open_ports.len())
            .then_with(|| a.open_ports.cmp(&b.open_ports)),
        "last_seen" => a.last_seen.cmp(&b.last_seen),
        _ => std::cmp::Ordering::Equal,
    }
}

fn device_type_badge(device_type: &str) -> (&str, egui::Color32) {
    match device_type {
        "router" => ("ROUTEUR", theme::ACCENT),
        "server" => ("SERVEUR", theme::SUCCESS),
        "workstation" => ("POSTE", theme::INFO),
        "printer" => ("IMPRIMANTE", theme::INFO),
        "iot" => ("IOT", theme::WARNING),
        "phone" => ("TÉLÉPHONE", theme::accent_text()),
        "switch" => ("COMMUTATEUR", theme::INFO),
        _ => ("INCONNU", theme::WARNING),
    }
}
