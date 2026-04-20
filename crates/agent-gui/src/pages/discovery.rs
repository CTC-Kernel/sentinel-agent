// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
        widgets::page_header_nav(
            ui,
            &["Shadow IT", "D\u{00e9}tection"],
            "D\u{00e9}tection Shadow IT",
            Some(
                "IDENTIFICATION DES \u{00c9}QUIPEMENTS NON AUTORIS\u{00c9}S SUR LE P\u{00c9}RIM\u{00c8}TRE R\u{00c9}SEAU",
            ),
            Some(
                "Scannez votre r\u{00e9}seau pour d\u{00e9}tecter les \u{00e9}quipements non r\u{00e9}f\u{00e9}renc\u{00e9}s dans l\u{2019}inventaire. Les appareils inconnus repr\u{00e9}sentent un risque de s\u{00e9}curit\u{00e9} (Shadow IT).",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Control bar (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                let is_scanning = state.discovery.in_progress;

                let btn_response = if is_scanning {
                    widgets::primary_button(
                        ui,
                        format!("{}  INTERROMPRE LE SCAN", icons::TRASH),
                        state.security.admin_unlocked,
                    )
                } else if state.security.admin_unlocked {
                    widgets::primary_button(
                        ui,
                        format!("{}  LANCER LA DÉCOUVERTE", icons::PLAY),
                        true,
                    )
                } else {
                    // Disabled button for non-admin users
                    widgets::primary_button(
                        ui,
                        format!("{}  LANCER LA DÉCOUVERTE", icons::LOCK),
                        false,
                    )
                };

                if btn_response.clicked() {
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
                                            theme::ACCENT.linear_multiply(alpha),
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
                                            theme::ACCENT
                                                .linear_multiply(alpha * (0.8 + pulse * 0.2)),
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
                                            theme::overlay_color()
                                                .linear_multiply(theme::OPACITY_TINT),
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
                                egui::RichText::new(format!("{:.0}% COMPLET", progress * 100.0))
                                    .font(theme::font_label())
                                    .color(theme::accent_text())
                                    .strong(),
                            );
                        });
                    });
                }
            });
        });

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
                Self::kpi_card(ui, width, label, value, *color, icon);
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
        let filtered: Vec<usize> = state
            .discovery
            .devices
            .iter()
            .enumerate()
            .filter(|(_, d)| {
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

        let result_count = filtered.len();

        widgets::SearchFilterBar::new(
            &mut state.discovery.search,
            "Filtrer par adresse IP, nom d'hôte ou constructeur...",
        )
        .result_count(result_count)
        .show(ui);

        ui.add_space(theme::SPACE_MD);

        // Action Buttons (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let success = Self::export_csv(state, &filtered);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Export CSV découverte terminé",
                                )
                                .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("Échec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Device table (AAA Grade)
        if filtered.is_empty() && !state.discovery.in_progress {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_XL);
                    widgets::protected_state(
                        ui,
                        icons::NETWORK,
                        "AUCUN \u{00c9}QUIPEMENT D\u{00c9}TECT\u{00c9}",
                        "Lancez un scan pour identifier les appareils non autoris\u{00e9}s sur votre r\u{00e9}seau (Shadow IT).",
                    );
                    ui.add_space(theme::SPACE_XL);
                });
            });
        } else if !filtered.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(110.0).range(80.0..=160.0)) // IP
                    .column(Column::initial(140.0).range(80.0..=400.0)) // Hostname
                    .column(Column::initial(120.0).range(80.0..=160.0)) // MAC
                    .column(Column::initial(110.0).range(70.0..=200.0)) // Vendor
                    .column(Column::initial(80.0).range(60.0..=120.0)) // Type
                    .column(Column::initial(80.0).range(60.0..=140.0)) // Ports
                    .column(Column::initial(90.0).range(70.0..=130.0)) // Last seen
                    .column(Column::remainder()); // Actions

                table
                    .header(theme::TABLE_INLINE_HEADER_HEIGHT, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ADRESSE IP")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("NOM D'HÔTE (DNS/NETBIOS)")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ADRESSE MAC")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CONSTRUCTEUR")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE D'ACTIF")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("SERVICES")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DERNIÈRE VUE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("OPÉRATIONS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                    })
                    .body(|body| {
                        let now = chrono::Utc::now();
                        body.rows(theme::TABLE_DATA_ROW_HEIGHT, filtered.len(), |mut row| {
                            let row_idx = row.index();
                            let Some(&dev_idx) = filtered.get(row_idx) else {
                                return;
                            };
                            let Some(device) = state.discovery.devices.get(dev_idx) else {
                                return;
                            };

                            row.set_selected(state.discovery.selected_device == Some(dev_idx));

                            let is_authorized =
                                state.assets.assets.iter().any(|a| a.ip == device.ip);
                            row.col(|ui: &mut egui::Ui| {
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&device.ip)
                                            .font(theme::font_mono())
                                            .color(theme::text_primary())
                                            .strong(),
                                    );
                                    if is_authorized {
                                        widgets::status_badge(
                                            ui,
                                            "AUTORIS\u{00c9}",
                                            theme::SUCCESS,
                                        );
                                    } else {
                                        widgets::status_badge(ui, "SHADOW", theme::ERROR);
                                    }
                                });
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let text = device.hostname.as_deref().unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(text)
                                        .font(theme::font_body())
                                        .color(theme::text_primary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let text = device.mac.as_deref().unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(text)
                                        .font(theme::font_mono_sm())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let text = device.vendor.as_deref().unwrap_or("Non identifié");
                                ui.label(
                                    egui::RichText::new(text.to_uppercase())
                                        .font(theme::font_min())
                                        .color(theme::text_secondary())
                                        .strong(),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let (label, color) = device_type_badge(&device.device_type);
                                widgets::status_badge(ui, label, color);
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let ports_str = if device.open_ports.is_empty() {
                                    "--".to_string()
                                } else {
                                    device
                                        .open_ports
                                        .iter()
                                        .take(3)
                                        .map(|p| p.to_string())
                                        .collect::<Vec<_>>()
                                        .join(", ")
                                };
                                ui.label(
                                    egui::RichText::new(&ports_str)
                                        .font(theme::font_mono_sm())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let ago = now.signed_duration_since(device.last_seen);
                                let text = if ago.num_hours() < 1 {
                                    format!("il y a {}m", ago.num_minutes().max(1))
                                } else if ago.num_hours() < 24 {
                                    format!("il y a {}h", ago.num_hours())
                                } else {
                                    device.last_seen.format("%d/%m %H:%M").to_string()
                                };
                                ui.label(
                                    egui::RichText::new(text).font(theme::font_small()).color(
                                        theme::readable_color(if ago.num_hours() < 1 {
                                            theme::SUCCESS
                                        } else if ago.num_hours() < 24 {
                                            theme::WARNING
                                        } else {
                                            theme::text_secondary()
                                        }),
                                    ),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                if widgets::chip_button(
                                    ui,
                                    &format!("{}  COPIER IP", icons::COPY),
                                    false,
                                    theme::ACCENT,
                                )
                                .clicked()
                                {
                                    ui.ctx().copy_text(device.ip.clone());
                                }
                            });

                            if row.response().clicked() {
                                state.discovery.selected_device = Some(dev_idx);
                                state.discovery.detail_open = true;
                            }
                        });
                    });
            });
        }

        ui.add_space(theme::SPACE_XL);

        if let Some(drawer_cmd) = Self::detail_drawer(ui, state) {
            cmd = Some(drawer_cmd);
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
        let first_seen = device.first_seen.format("%d/%m/%Y %H:%M").to_string();
        let last_seen = device.last_seen.format("%d/%m/%Y %H:%M").to_string();
        let (type_label, type_color) = device_type_badge(&device_type);

        // Check whether this device is already imported as a managed asset.
        let already_imported = state.assets.assets.iter().any(|a| a.ip == ip);

        let mut actions = vec![
            widgets::DetailAction::primary("Autoriser cet \u{00e9}quipement", icons::PLUS),
            widgets::DetailAction::primary("Scanner les ports", icons::SEARCH),
            widgets::DetailAction::danger("Bloquer", icons::LOCK),
        ];

        // Grey-out the import button when already imported.
        if already_imported {
            actions[0] =
                widgets::DetailAction::secondary("\u{00c9}quipement autoris\u{00e9}", icons::CHECK);
        }

        let action = widgets::DetailDrawer::new("discovery_detail", "Appareil", icons::NETWORK)
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
                        widgets::detail_field(ui, "Fournisseur", v);
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
            if action_idx == 0 && !already_imported {
                // "Ajouter aux actifs" — create a ManagedAsset from the
                // discovered device and queue it for persistence.
                let criticality = crate::pages::AssetsPage::infer_criticality_from_device(
                    is_gateway,
                    &open_ports,
                );

                let asset = crate::dto::ManagedAsset {
                    id: uuid::Uuid::new_v4(),
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
                        "Device ajout\u{00e9} aux actifs g\u{00e9}r\u{00e9}s",
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
                state.toasts.push(
                    crate::widgets::toast::Toast::success("\u{00c9}quipement bloqu\u{00e9}")
                        .with_time(time),
                );
                state.discovery.detail_open = false;
                return Some(crate::events::GuiCommand::BlockIp {
                    ip: ip.clone(),
                    duration_secs: 0,
                });
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
    ) {
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
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
            });
        });
    }

    fn export_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["ip", "hostname", "mac", "vendor", "type", "ports"];
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

fn device_type_badge(device_type: &str) -> (&str, egui::Color32) {
    match device_type {
        "router" => ("ROUTEUR", theme::ACCENT),
        "server" => ("SERVEUR", theme::SUCCESS),
        "workstation" => ("POSTE", theme::INFO),
        "printer" => ("IMPRIMANTE", theme::INFO),
        "iot" => ("IOT", theme::WARNING),
        "phone" => ("TÉLÉPHONE", theme::accent_text()),
        "switch" => ("SWITCH", theme::INFO),
        _ => ("INCONNU", theme::WARNING),
    }
}
