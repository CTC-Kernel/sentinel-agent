//! Asset management page — CMDB-lite with lifecycle and criticality tracking.

use egui::Ui;
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
use crate::dto::{AssetCriticality, AssetLifecycle, ManagedAsset};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Asset management page.
pub struct AssetsPage;

impl AssetsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Gouvernance", "Actifs"],
            "Gestion des Actifs",
            Some("INVENTAIRE CMDB ET SUIVI DU CYCLE DE VIE DES \u{00c9}QUIPEMENTS"),
            Some(
                "Centralisez l\u{2019}inventaire de vos actifs IT. Classez-les par criticit\u{00e9}, suivez leur cycle de vie et enrichissez-les depuis la d\u{00e9}couverte r\u{00e9}seau.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Summary cards
        let total = state.assets.assets.len();
        let critical_count = state
            .assets
            .assets
            .iter()
            .filter(|a| a.criticality == AssetCriticality::Critical)
            .count();
        let monitored_count = state
            .assets
            .assets
            .iter()
            .filter(|a| a.lifecycle == AssetLifecycle::Monitored)
            .count();
        let decommissioned_count = state
            .assets
            .assets
            .iter()
            .filter(|a| a.lifecycle == AssetLifecycle::Decommissioned)
            .count();

        let card_grid = widgets::ResponsiveGrid::new(200.0, theme::SPACE_SM);
        let items = vec![
            (
                "TOTAL",
                total.to_string(),
                theme::text_primary(),
                icons::BOXES_STACKED,
            ),
            (
                "CRITIQUES",
                critical_count.to_string(),
                if critical_count > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_CRITICAL,
            ),
            (
                "SURVEILL\u{00c9}S",
                monitored_count.to_string(),
                if monitored_count > 0 {
                    theme::SUCCESS
                } else {
                    theme::text_tertiary()
                },
                icons::EYE,
            ),
            (
                "D\u{00c9}COMMISSION\u{00c9}S",
                decommissioned_count.to_string(),
                theme::text_tertiary(),
                icons::TRASH,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_MD);

        // Action bar
        ui.horizontal(|ui: &mut egui::Ui| {
            let discoverable = state
                .discovery
                .devices
                .iter()
                .filter(|d| {
                    !state.assets.assets.iter().any(|a| a.ip == d.ip)
                })
                .count();

            if state.security.admin_unlocked {
                let label = if discoverable > 0 {
                    format!(
                        "{}  IMPORTER DEPUIS D\u{00c9}COUVERTE ({})",
                        icons::DOWNLOAD, discoverable
                    )
                } else {
                    format!(
                        "{}  IMPORTER DEPUIS D\u{00c9}COUVERTE",
                        icons::DOWNLOAD
                    )
                };
                if widgets::primary_button(ui, label, discoverable > 0).clicked() {
                    Self::import_from_discovery(state);
                    state.push_toast(
                        crate::widgets::toast::Toast::success(
                            "Actifs import\u{00e9}s depuis la d\u{00e9}couverte r\u{00e9}seau",
                        ),
                        ui.ctx(),
                    );
                }
            } else {
                widgets::primary_button(
                    ui,
                    format!("{}  IMPORTER DEPUIS D\u{00c9}COUVERTE", icons::LOCK),
                    false,
                );
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let filtered = Self::filtered_indices(state);
                        Self::export_csv(state, &filtered);
                        state.push_toast(
                            crate::widgets::toast::Toast::info("Export CSV en cours..."),
                            ui.ctx(),
                        );
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Search + filters
        let crit_active =
            state.assets.criticality_filter == Some(AssetCriticality::Critical);
        let high_active =
            state.assets.criticality_filter == Some(AssetCriticality::High);
        let med_active =
            state.assets.criticality_filter == Some(AssetCriticality::Medium);
        let low_active =
            state.assets.criticality_filter == Some(AssetCriticality::Low);

        let filtered = Self::filtered_indices(state);
        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.assets.search,
            "Rechercher par nom, IP, type ou \u{00e9}tiquette...",
        )
        .chip("CRITIQUE", crit_active, theme::ERROR)
        .chip("\u{00c9}LEV\u{00c9}E", high_active, theme::SEVERITY_HIGH)
        .chip("MOYENNE", med_active, theme::WARNING)
        .chip("FAIBLE", low_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some(AssetCriticality::Critical),
                1 => Some(AssetCriticality::High),
                2 => Some(AssetCriticality::Medium),
                3 => Some(AssetCriticality::Low),
                _ => None,
            };
            if state.assets.criticality_filter == target {
                state.assets.criticality_filter = None;
            } else {
                state.assets.criticality_filter = target;
            }
        }

        ui.add_space(theme::SPACE_XS);

        // Lifecycle filter chips
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("CYCLE DE VIE :")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            for lc in AssetLifecycle::all() {
                let active = state.assets.lifecycle_filter == Some(*lc);
                if widgets::chip_button(ui, lc.label_fr(), active, theme::ACCENT).clicked() {
                    if state.assets.lifecycle_filter == Some(*lc) {
                        state.assets.lifecycle_filter = None;
                    } else {
                        state.assets.lifecycle_filter = Some(*lc);
                    }
                }
            }
        });

        ui.add_space(theme::SPACE_SM);

        // Asset table
        let filtered = Self::filtered_indices(state);

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("INVENTAIRE DES ACTIFS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                if state.assets.assets.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::BOXES_STACKED,
                        "AUCUN ACTIF ENREGISTR\u{00c9}",
                        Some("Importez des actifs depuis la d\u{00e9}couverte r\u{00e9}seau ou ajoutez-les manuellement."),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::BOXES_STACKED,
                        "AUCUN R\u{00c9}SULTAT",
                        Some("Modifiez vos crit\u{00e8}res de recherche ou de filtrage."),
                    );
                }
            } else {
                Self::render_asset_table(ui, state, &filtered);
            }
        });

        ui.add_space(theme::SPACE_XL);

        // Detail drawer
        Self::detail_drawer(ui, state, &mut command);

        command
    }

    fn filtered_indices(state: &AppState) -> Vec<usize> {
        let search_lower = state.assets.search.to_lowercase();
        state
            .assets
            .assets
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {} {} {}",
                        a.hostname.as_deref().unwrap_or("").to_lowercase(),
                        a.ip.to_lowercase(),
                        a.device_type.to_lowercase(),
                        a.tags.join(" ").to_lowercase()
                    );
                    if !haystack.contains(&search_lower) {
                        return false;
                    }
                }
                if let Some(crit) = &state.assets.criticality_filter
                    && a.criticality != *crit
                {
                    return false;
                }
                if let Some(lc) = &state.assets.lifecycle_filter
                    && a.lifecycle != *lc
                {
                    return false;
                }
                true
            })
            .map(|(i, _)| i)
            .collect()
    }

    fn render_asset_table(ui: &mut Ui, state: &mut AppState, indices: &[usize]) {
        let mut clicked_idx: Option<usize> = None;

        ui.push_id("assets_table", |ui: &mut egui::Ui| {
            let ctx = ui.ctx().clone();
            let table = TableBuilder::new(ui)
                .striped(false)
                .resizable(true)
                .sense(egui::Sense::click())
                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                .column(Column::initial(160.0).range(100.0..=300.0))
                .column(Column::initial(120.0).at_least(90.0))
                .column(Column::initial(100.0).at_least(80.0))
                .column(Column::initial(90.0).at_least(70.0))
                .column(Column::initial(110.0).at_least(90.0))
                .column(Column::initial(80.0).at_least(60.0))
                .column(Column::remainder());

            table
                .header(30.0, |mut header| {
                    for label in [
                        "NOM",
                        "IP",
                        "TYPE",
                        "CRITICIT\u{00c9}",
                        "CYCLE DE VIE",
                        "SCORE",
                        "DERNI\u{00c8}RE VUE",
                    ] {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(label)
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(theme::TRACKING_NORMAL),
                            );
                        });
                    }
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, indices.len(), |mut row| {
                        let row_idx = row.index();
                        let real_idx = indices[row_idx];
                        let asset = &state.assets.assets[real_idx];
                        let is_selected = state.assets.selected_asset == Some(real_idx);
                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            let name = asset
                                .hostname
                                .as_deref()
                                .unwrap_or(&asset.ip);
                            ui.label(
                                egui::RichText::new(name)
                                    .font(theme::font_body())
                                    .color(theme::accent_text())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(&asset.ip)
                                    .font(theme::font_mono())
                                    .color(theme::text_primary()),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(asset.device_type.to_uppercase())
                                    .font(theme::font_label())
                                    .color(theme::text_secondary())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) =
                                Self::criticality_display(&asset.criticality);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) =
                                Self::lifecycle_display(&asset.lifecycle);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let score_pct = (asset.risk_score * 10.0).min(100.0);
                            let score_color = if asset.risk_score >= 8.0 {
                                theme::ERROR
                            } else if asset.risk_score >= 5.0 {
                                theme::WARNING
                            } else {
                                theme::SUCCESS
                            };
                            ui.label(
                                egui::RichText::new(format!("{:.1}", asset.risk_score))
                                    .font(theme::font_body())
                                    .color(theme::readable_color(theme::score_color(
                                        100.0 - score_pct,
                                    )))
                                    .strong(),
                            );
                            let _ = score_color;
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let ago =
                                chrono::Utc::now().signed_duration_since(asset.last_seen);
                            let text = if ago.num_hours() < 1 {
                                format!("il y a {}m", ago.num_minutes().max(1))
                            } else if ago.num_hours() < 24 {
                                format!("il y a {}h", ago.num_hours())
                            } else {
                                asset.last_seen.format("%d/%m %H:%M").to_string()
                            };
                            ui.label(
                                egui::RichText::new(text)
                                    .font(theme::font_small())
                                    .color(theme::readable_color(if ago.num_hours() < 1 {
                                        theme::SUCCESS
                                    } else if ago.num_hours() < 24 {
                                        theme::WARNING
                                    } else {
                                        theme::text_secondary()
                                    })),
                            );
                        });

                        if row.response().clicked() {
                            clicked_idx = Some(real_idx);
                        }
                        if row.response().hovered() {
                            ctx.set_cursor_icon(egui::CursorIcon::PointingHand);
                        }
                    });
                });
        });

        if let Some(idx) = clicked_idx {
            state.assets.selected_asset = Some(idx);
            state.assets.detail_open = true;
        }
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let selected = match state.assets.selected_asset {
            Some(idx) if idx < state.assets.assets.len() => idx,
            _ => return,
        };

        let asset = state.assets.assets[selected].clone();
        let (crit_label, crit_color) = Self::criticality_display(&asset.criticality);
        let (lc_label, lc_color) = Self::lifecycle_display(&asset.lifecycle);

        let actions = vec![
            widgets::DetailAction::primary("Promouvoir", icons::ARROW_UP),
            widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
        ];

        let drawer_action = widgets::DetailDrawer::new(
            "asset_detail",
            asset.hostname.as_deref().unwrap_or(&asset.ip),
            icons::BOXES_STACKED,
        )
        .accent(crit_color)
        .subtitle(&asset.ip)
        .show(
            ui.ctx(),
            &mut state.assets.detail_open,
            |ui| {
                widgets::detail_section(ui, "ACTIF");
                if let Some(ref hostname) = asset.hostname {
                    widgets::detail_field(ui, "Nom d\u{2019}h\u{00f4}te", hostname);
                }
                widgets::detail_mono(ui, "Adresse IP", &asset.ip);
                if let Some(ref mac) = asset.mac {
                    widgets::detail_mono(ui, "Adresse MAC", mac);
                }
                if let Some(ref vendor) = asset.vendor {
                    widgets::detail_field(ui, "Constructeur", vendor);
                }
                widgets::detail_field(ui, "Type", &asset.device_type.to_uppercase());
                widgets::detail_field_badge(ui, "Criticit\u{00e9}", crit_label, crit_color);
                widgets::detail_field_badge(ui, "Cycle de vie", lc_label, lc_color);

                widgets::detail_section(ui, "S\u{00c9}CURIT\u{00c9}");
                let risk_color = if asset.risk_score >= 8.0 {
                    theme::ERROR
                } else if asset.risk_score >= 5.0 {
                    theme::WARNING
                } else {
                    theme::SUCCESS
                };
                widgets::detail_field_colored(
                    ui,
                    "Score de risque",
                    &format!("{:.1}", asset.risk_score),
                    theme::readable_color(risk_color),
                );
                widgets::detail_field(
                    ui,
                    "Vuln\u{00e9}rabilit\u{00e9}s",
                    &asset.vulnerability_count.to_string(),
                );

                if !asset.open_ports.is_empty() {
                    let ports_str = asset
                        .open_ports
                        .iter()
                        .map(|p| p.to_string())
                        .collect::<Vec<_>>()
                        .join(", ");
                    widgets::detail_mono(ui, "Ports ouverts", &ports_str);
                }

                if !asset.software.is_empty() {
                    widgets::detail_section(ui, "LOGICIELS");
                    for sw in asset.software.iter().take(20) {
                        widgets::detail_field(ui, "", sw);
                    }
                    if asset.software.len() > 20 {
                        widgets::detail_field(
                            ui,
                            "",
                            &format!("... et {} autres", asset.software.len().saturating_sub(20)),
                        );
                    }
                }

                if !asset.tags.is_empty() {
                    widgets::detail_section(ui, "\u{00c9}TIQUETTES");
                    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                        for tag in &asset.tags {
                            widgets::status_badge(ui, tag, theme::ACCENT);
                            ui.add_space(theme::SPACE_XS);
                        }
                    });
                }

                widgets::detail_section(ui, "TEMPORALIT\u{00c9}");
                widgets::detail_field(
                    ui,
                    "Premi\u{00e8}re d\u{00e9}tection",
                    &asset.first_seen.format("%d/%m/%Y %H:%M").to_string(),
                );
                widgets::detail_field(
                    ui,
                    "Derni\u{00e8}re d\u{00e9}tection",
                    &asset.last_seen.format("%d/%m/%Y %H:%M").to_string(),
                );
            },
            &actions,
        );

        if let Some(action_idx) = drawer_action {
            match action_idx {
                0 => {
                    // Promote lifecycle: Discovered -> Qualified -> Monitored
                    if selected < state.assets.assets.len() {
                        let new_lifecycle = match state.assets.assets[selected].lifecycle {
                            AssetLifecycle::Discovered => AssetLifecycle::Qualified,
                            AssetLifecycle::Qualified => AssetLifecycle::Monitored,
                            other => other,
                        };
                        state.assets.assets[selected].lifecycle = new_lifecycle;
                        let asset_id =
                            state.assets.assets[selected].id.to_string();
                        *command = Some(GuiCommand::UpdateAssetLifecycle {
                            asset_id,
                            lifecycle: new_lifecycle,
                        });
                    }
                }
                1 => {
                    // Export single asset
                    Self::export_csv(state, &[selected]);
                    state.push_toast(
                        crate::widgets::toast::Toast::info("Export CSV en cours..."),
                        ui.ctx(),
                    );
                }
                _ => {}
            }
        }
    }

    /// Import discovered devices as managed assets (skip already-imported IPs).
    fn import_from_discovery(state: &mut AppState) {
        let existing_ips: std::collections::HashSet<String> = state
            .assets
            .assets
            .iter()
            .map(|a| a.ip.clone())
            .collect();

        let now = chrono::Utc::now();
        let max_assets = 1000_usize;

        for device in &state.discovery.devices {
            if state.assets.assets.len() >= max_assets {
                break;
            }
            if existing_ips.contains(&device.ip) {
                continue;
            }
            state.assets.assets.push(ManagedAsset {
                id: uuid::Uuid::new_v4(),
                ip: device.ip.clone(),
                hostname: device.hostname.clone(),
                mac: device.mac.clone(),
                vendor: device.vendor.clone(),
                device_type: device.device_type.clone(),
                criticality: AssetCriticality::Medium,
                lifecycle: AssetLifecycle::Discovered,
                tags: Vec::new(),
                risk_score: 0.0,
                vulnerability_count: 0,
                open_ports: device.open_ports.clone(),
                software: Vec::new(),
                first_seen: device.first_seen,
                last_seen: device.last_seen,
            });
            let _ = now;
        }
    }

    fn criticality_display(crit: &AssetCriticality) -> (&'static str, egui::Color32) {
        match crit {
            AssetCriticality::Critical => ("CRITIQUE", theme::ERROR),
            AssetCriticality::High => ("\u{00c9}LEV\u{00c9}E", theme::SEVERITY_HIGH),
            AssetCriticality::Medium => ("MOYENNE", theme::WARNING),
            AssetCriticality::Low => ("FAIBLE", theme::INFO),
        }
    }

    fn lifecycle_display(lc: &AssetLifecycle) -> (&'static str, egui::Color32) {
        match lc {
            AssetLifecycle::Discovered => ("D\u{00c9}COUVERT", theme::INFO),
            AssetLifecycle::Qualified => ("QUALIFI\u{00c9}", theme::ACCENT),
            AssetLifecycle::Monitored => ("SURVEILL\u{00c9}", theme::SUCCESS),
            AssetLifecycle::Decommissioned => ("D\u{00c9}COMMISSIONN\u{00c9}", theme::text_tertiary()),
        }
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

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let a = &state.assets.assets[i];
                vec![
                    a.hostname.clone().unwrap_or_default(),
                    a.ip.clone(),
                    a.device_type.clone(),
                    a.criticality.label_fr().to_string(),
                    a.lifecycle.label_fr().to_string(),
                    format!("{:.1}", a.risk_score),
                    a.vulnerability_count.to_string(),
                    a.last_seen.format("%d/%m/%Y %H:%M").to_string(),
                    a.tags.join(", "),
                ]
            })
            .collect();

        if let Some(tx) = state.async_task_tx.clone() {
            std::thread::spawn(move || {
                let headers = &[
                    "nom",
                    "ip",
                    "type",
                    "criticite",
                    "cycle_vie",
                    "score_risque",
                    "vulnerabilites",
                    "derniere_vue",
                    "etiquettes",
                ];
                let path = crate::export::default_export_path("actifs.csv");
                match crate::export::export_csv(headers, &rows, &path) {
                    Ok(()) => {
                        if let Err(e) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            true,
                            "Export CSV actifs r\u{00e9}ussi".to_string(),
                        )) {
                            tracing::warn!("Failed to send CSV export success: {}", e);
                        }
                    }
                    Err(e) => {
                        if let Err(send_err) = tx.send(crate::app::AsyncTaskResult::CsvExport(
                            false,
                            format!("\u{00c9}chec export : {}", e),
                        )) {
                            tracing::warn!("Failed to send CSV export error: {}", send_err);
                        }
                    }
                }
            });
        } else {
            tracing::error!("Dysfonctionnement interne: Canal async non disponible");
        }
    }
}
