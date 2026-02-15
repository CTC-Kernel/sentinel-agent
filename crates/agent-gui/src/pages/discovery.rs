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
            &["Sys & Network", "Découverte"],
            "Reconnaissance Réseau",
            Some("IDENTIFICATION ET CARTOGRAPHIE DES ACTIFS SUR LE PÉRIMÈTRE LOCAL"),
            Some(
                "Identifiez les nouveaux équipements sur votre segment réseau. Le scan ARP et ICMP permet de détecter les noms d'hôtes et les constructeurs pour enrichir votre inventaire d'actifs.",
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
                        cmd = Some(crate::events::GuiCommand::StartDiscovery);
                    }
                }

                ui.add_space(theme::SPACE_MD);

                // AAA Progress System
                if is_scanning {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.add_space(6.0);
                        let progress = state.discovery.progress;
                        let bar_width = 300.0;
                        let bar_height = 4.0;
                        let (bar_rect, _) = ui.allocate_exact_size(
                            egui::Vec2::new(bar_width, bar_height),
                            egui::Sense::hover(),
                        );

                        if ui.is_rect_visible(bar_rect) {
                            let reduced = theme::is_reduced_motion();

                            ui.painter().rect_filled(
                                bar_rect,
                                egui::CornerRadius::same(2),
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
                                            theme::ACCENT.linear_multiply(alpha * (0.8 + pulse * 0.2)),
                                        );
                                    }
                                }

                                // Solid fill
                                ui.painter().rect_filled(
                                    fill_rect,
                                    egui::CornerRadius::same(2),
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
                                            egui::CornerRadius::same(2),
                                            egui::Color32::from_white_alpha(40),
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
                                    .extra_letter_spacing(0.5)
                                    .strong(),
                            );
                            ui.label(
                                egui::RichText::new(format!("{:.0}% COMPLET", progress * 100.0))
                                    .font(theme::font_label())
                                    .color(theme::ACCENT)
                                    .strong(),
                            );
                        });
                    });
                }

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{}", state.discovery.devices.len()))
                                .font(theme::font_stat())
                                .color(theme::text_primary())
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new("ACTIFS DÉTECTÉS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(0.5)
                                .strong(),
                        );
                    },
                );
            });
        });

        ui.add_space(theme::SPACE_MD);

        let search_id = ui.id().with("discovery_search_cache");
        let search_upper: String = ui.memory(|mem| {
            mem.data.get_temp::<(String, String)>(search_id)
                .filter(|(orig, _)| orig == &state.discovery.search)
                .map(|(_, upper)| upper)
        }).unwrap_or_else(|| {
            let upper = state.discovery.search.to_uppercase();
            ui.memory_mut(|mem| mem.data.insert_temp(search_id, (state.discovery.search.clone(), upper.clone())));
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
                let haystack = format!(
                    "{} {} {}",
                    d.ip.to_uppercase(),
                    d.hostname.as_deref().unwrap_or("").to_uppercase(),
                    d.vendor.as_deref().unwrap_or("").to_uppercase(),
                );
                haystack.contains(&search_upper)
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

        ui.add_space(theme::SPACE_SM);

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
                                crate::widgets::toast::Toast::success("Export CSV découverte terminé")
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

        ui.add_space(theme::SPACE_SM);

        // Device table (AAA Grade)
        if filtered.is_empty() && !state.discovery.in_progress {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_XL);
                    widgets::protected_state(
                        ui,
                        icons::NETWORK,
                        "AUCUNE ENTITÉ DÉTECTÉE",
                        "Veuillez initier un scan pour identifier les actifs présents sur votre segment réseau.",
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
                    .column(Column::initial(130.0).at_least(100.0)) // IP
                    .column(Column::initial(180.0).range(120.0..=400.0)) // Hostname
                    .column(Column::initial(140.0).at_least(120.0)) // MAC
                    .column(Column::initial(140.0).at_least(100.0)) // Vendor
                    .column(Column::initial(100.0).at_least(80.0)) // Type
                    .column(Column::initial(120.0).at_least(80.0)) // Ports
                    .column(Column::initial(110.0).at_least(90.0)) // Last seen
                    .column(Column::remainder()); // Actions

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ADRESSE IP")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("NOM D'HÔTE (DNS/NETBIOS)")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ADRESSE MAC")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CONSTRUCTEUR")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE D'ACTIF")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("SERVICES")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DERNIÈRE VUE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("OPÉRATIONS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(48.0, filtered.len(), |mut row| {
                            let row_idx = row.index();
                            let dev_idx = filtered[row_idx];
                            let device = &state.discovery.devices[dev_idx];

                            row.set_selected(state.discovery.selected_device == Some(dev_idx));

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&device.ip)
                                        .font(theme::font_mono())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
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
                                        .font(theme::font_mono())
                                        .size(11.0)
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
                                        .font(theme::font_mono())
                                        .size(11.0)
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let ago = chrono::Utc::now()
                                    .signed_duration_since(device.last_seen);
                                let text = if ago.num_hours() < 1 {
                                    format!("il y a {}m", ago.num_minutes().max(1))
                                } else if ago.num_hours() < 24 {
                                    format!("il y a {}h", ago.num_hours())
                                } else {
                                    device.last_seen.format("%d/%m %H:%M").to_string()
                                };
                                ui.label(
                                    egui::RichText::new(text)
                                        .font(theme::font_small())
                                        .color(if ago.num_hours() < 1 {
                                            theme::SUCCESS
                                        } else if ago.num_hours() < 24 {
                                            theme::WARNING
                                        } else {
                                            theme::text_secondary()
                                        }),
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

        Self::detail_drawer(ui, state);

        cmd
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState) {
        let selected = match state.discovery.selected_device {
            Some(idx) if idx < state.discovery.devices.len() => idx,
            _ => return,
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
        let first_seen = device.first_seen.format("%d/%m/%Y %H:%M").to_string();
        let last_seen = device.last_seen.format("%d/%m/%Y %H:%M").to_string();
        let (type_label, type_color) = device_type_badge(&device_type);

        let actions = [
            widgets::DetailAction::primary("Scanner les ports", icons::SEARCH),
            widgets::DetailAction::danger("Bloquer", icons::LOCK),
        ];

        let _action = widgets::DetailDrawer::new("discovery_detail", "Appareil", icons::NETWORK)
            .accent(type_color)
            .subtitle(&ip)
            .show(ui.ctx(), &mut state.discovery.detail_open, |ui| {
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
                    widgets::detail_field_badge(ui, "Passerelle", "NON", theme::text_tertiary());
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
            }, &actions);
    }

    fn export_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["ip", "hostname", "mac", "vendor", "type", "ports"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let d = &state.discovery.devices[i];
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
        "phone" => ("TÉLÉPHONE", theme::ACCENT_LIGHT),
        "switch" => ("SWITCH", theme::INFO),
        _ => ("INCONNU", theme::WARNING),
    }
}
