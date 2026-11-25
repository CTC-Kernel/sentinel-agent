// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Asset management page — CMDB-lite with lifecycle and criticality tracking.

use egui::Ui;

use chrono::Utc;
use uuid::Uuid;

use crate::app::AppState;
use crate::dto::{AssetCriticality, AssetLifecycle, ManagedAsset};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Key of the "decommission this asset" confirmation dialog.
const DECOMMISSION_CONFIRM: &str = "asset_decommission_confirm";

/// Device types the form offers, as discovery reports them.
const DEVICE_TYPES: &[&str] = &[
    "workstation",
    "server",
    "router",
    "switch",
    "firewall",
    "printer",
    "phone",
    "iot",
    "nas",
    "camera",
    "unknown",
];

/// The fields of the inline form that creates or edits an asset.
struct InlineAssetForm {
    hostname: String,
    ip: String,
    device_type: String,
    criticality_idx: usize,
}

impl InlineAssetForm {
    const fn empty() -> Self {
        Self {
            hostname: String::new(),
            ip: String::new(),
            device_type: String::new(),
            criticality_idx: 2, // Medium by default
        }
    }
}

thread_local! {
    static FORM: std::cell::RefCell<InlineAssetForm> =
        const { std::cell::RefCell::new(InlineAssetForm::empty()) };
}

/// Why the form cannot be saved, or `None` when it can. `editing` is the
/// identifier of the asset being edited, which may keep its own address.
fn form_error(ip: &str, editing: Option<&str>, assets: &[ManagedAsset]) -> Option<&'static str> {
    let ip = ip.trim();
    if ip.is_empty() {
        return Some("L'adresse IP est obligatoire.");
    }
    if ip.parse::<std::net::IpAddr>().is_err() {
        return Some("Adresse IP invalide (exemple : 192.168.1.10).");
    }
    if assets
        .iter()
        .any(|a| a.ip == ip && Some(a.id.as_str()) != editing)
    {
        return Some("Un actif porte déjà cette adresse IP.");
    }
    None
}

/// The lifecycle "Promouvoir" leads to, or `None` at the end of the path.
fn promoted(lifecycle: AssetLifecycle) -> Option<AssetLifecycle> {
    match lifecycle {
        AssetLifecycle::Unauthorized => Some(AssetLifecycle::Discovered),
        AssetLifecycle::Discovered => Some(AssetLifecycle::Qualified),
        AssetLifecycle::Qualified => Some(AssetLifecycle::Monitored),
        AssetLifecycle::Monitored | AssetLifecycle::Decommissioned => None,
    }
}

/// Ordering helpers for the sortable tables of the asset and network pages.
pub(super) mod order {
    use std::cmp::Ordering;

    use crate::widgets::table;

    /// Text, whatever its case.
    pub fn text(a: &str, b: &str) -> Ordering {
        a.to_lowercase().cmp(&b.to_lowercase())
    }

    /// A value that is there: neither missing nor blank.
    fn present(value: Option<&str>) -> Option<&str> {
        value.filter(|v| !v.trim().is_empty())
    }

    /// Text with the missing or empty values last.
    pub fn opt_text(a: Option<&str>, b: Option<&str>) -> Ordering {
        match (present(a), present(b)) {
            (Some(a), Some(b)) => text(a, b),
            (Some(_), None) => Ordering::Less,
            (None, Some(_)) => Ordering::Greater,
            (None, None) => Ordering::Equal,
        }
    }

    /// Addresses by value, not by spelling: `10.0.0.9` before `10.0.0.10`.
    /// IPv4 before IPv6; what is not an address last, as text.
    pub fn ip(a: &str, b: &str) -> Ordering {
        use std::net::IpAddr;
        match (a.trim().parse::<IpAddr>(), b.trim().parse::<IpAddr>()) {
            (Ok(a), Ok(b)) => a.cmp(&b),
            (Ok(_), Err(_)) => Ordering::Less,
            (Err(_), Ok(_)) => Ordering::Greater,
            (Err(_), Err(_)) => opt_text(Some(a), Some(b)),
        }
    }

    /// Runs of digits and of anything else: `["24", ".", "8"]`.
    fn runs(value: &str) -> Vec<&str> {
        let mut out = Vec::new();
        let mut start = 0;
        let mut digits: Option<bool> = None;
        for (index, ch) in value.char_indices() {
            let is_digit = ch.is_ascii_digit();
            if digits.is_some_and(|d| d != is_digit) {
                out.push(&value[start..index]);
                start = index;
            }
            digits = Some(is_digit);
        }
        if start < value.len() {
            out.push(&value[start..]);
        }
        out
    }

    /// Versions and identifiers by their numbers: `1.9` before `1.10`,
    /// `KB999` before `KB1000`. The rest compares as text.
    pub fn version(a: &str, b: &str) -> Ordering {
        let (left, right) = (runs(a.trim()), runs(b.trim()));
        for (x, y) in left.iter().zip(&right) {
            let numeric = x.starts_with(|c: char| c.is_ascii_digit())
                && y.starts_with(|c: char| c.is_ascii_digit());
            let ordering = if numeric {
                let (x, y) = (x.trim_start_matches('0'), y.trim_start_matches('0'));
                x.len().cmp(&y.len()).then_with(|| x.cmp(y))
            } else {
                text(x, y)
            };
            if ordering != Ordering::Equal {
                return ordering;
            }
        }
        left.len().cmp(&right.len())
    }

    /// [`version`] with the missing or empty values last.
    pub fn opt_version(a: Option<&str>, b: Option<&str>) -> Ordering {
        match (present(a), present(b)) {
            (Some(a), Some(b)) => version(a, b),
            (a, b) => opt_text(a, b),
        }
    }

    /// The header row of a sortable table: a sortable cell for each column
    /// with a key, a plain one otherwise (nothing for an empty label).
    /// Returns true when a click changed the sort.
    pub fn headers(
        header: &mut egui_extras::TableRow<'_, '_>,
        table_name: &'static str,
        columns: &[(&str, Option<&str>)],
    ) -> bool {
        let mut changed = false;
        for (label, key) in columns {
            header.col(|ui| match key {
                Some(key) => changed |= table::header_cell_sortable(ui, label, table_name, key),
                None if label.is_empty() => {}
                None => {
                    table::header_cell(ui, label);
                }
            });
        }
        changed
    }

    /// Order `indices` by the column the header of `table_name` asks for,
    /// if any. The sort is stable: rows that compare equal keep the page's
    /// own order. `compare` orders two indices under a column key,
    /// ascending.
    pub fn sort(
        ctx: &egui::Context,
        table_name: &'static str,
        indices: &mut [usize],
        compare: impl Fn(&str, usize, usize) -> Ordering,
    ) {
        let sort = table::sort_of(ctx, table_name);
        if let Some(key) = table::sort_key(&sort) {
            indices.sort_by(|&a, &b| table::directed(&sort, compare(key, a, b)));
        }
    }
}

/// Rank of a lifecycle along its path, for sorting.
fn lifecycle_rank(lifecycle: AssetLifecycle) -> usize {
    AssetLifecycle::all()
        .iter()
        .position(|l| *l == lifecycle)
        .unwrap_or(usize::MAX)
}

/// Order two assets under a column key of the inventory table, ascending.
fn compare_assets(key: &str, a: &ManagedAsset, b: &ManagedAsset) -> std::cmp::Ordering {
    match key {
        "name" => order::text(
            a.hostname.as_deref().unwrap_or(&a.ip),
            b.hostname.as_deref().unwrap_or(&b.ip),
        ),
        "ip" => order::ip(&a.ip, &b.ip),
        "type" => order::text(
            asset_type_label(&a.device_type),
            asset_type_label(&b.device_type),
        ),
        // Least critical first, so descending puts the critical on top.
        "criticality" => a.criticality.weight().total_cmp(&b.criticality.weight()),
        "lifecycle" => lifecycle_rank(a.lifecycle).cmp(&lifecycle_rank(b.lifecycle)),
        "score" => a.risk_score.total_cmp(&b.risk_score),
        "last_seen" => a.last_seen.cmp(&b.last_seen),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Asset management page.
pub struct AssetsPage;

impl AssetsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "Inventaire"],
            "Inventaire des \u{00c9}quipements",
            Some("Cycle de vie et contr\u{00f4}le des \u{00e9}quipements autoris\u{00e9}s."),
            Some(
                "G\u{00e9}rez les \u{00e9}quipements autoris\u{00e9}s sur votre r\u{00e9}seau. Suivez leur cycle de vie de la d\u{00e9}tection \u{00e0} la mise hors service, contr\u{00f4}lez leur conformit\u{00e9}.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // A page number only means something for one set of filters.
        let filters_before = (
            state.assets.search.clone(),
            state.assets.criticality_filter,
            state.assets.lifecycle_filter,
        );

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
                "D\u{00c9}COMMISSIONN\u{00c9}S",
                decommissioned_count.to_string(),
                theme::text_tertiary(),
                icons::TRASH,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            if Self::summary_card(ui, width, label, value, *color, icon) {
                widgets::open_data_panel(ui.ctx(), "Inventaire des actifs");
                state.assets.search.clear();
                state.assets.page = 0;
                state.assets.criticality_filter = if *label == "CRITIQUES" {
                    Some(AssetCriticality::Critical)
                } else {
                    None
                };
                state.assets.lifecycle_filter = match *label {
                    "SURVEILLÉS" => Some(AssetLifecycle::Monitored),
                    "DÉCOMMISSIONNÉS" => Some(AssetLifecycle::Decommissioned),
                    _ => None,
                };
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Action bar
        ui.horizontal(|ui: &mut egui::Ui| {
            let discoverable = state
                .discovery
                .devices
                .iter()
                .filter(|d| !state.assets.assets.iter().any(|a| a.ip == d.ip))
                .count();

            // Authorising devices is an administrator action. Locked, the
            // button stays clickable and asks for the password.
            let unlocked = state.security.admin_unlocked;
            let label = match (discoverable, unlocked) {
                (0, true) => format!("{}  AUTORISER DEPUIS LA D\u{00c9}TECTION", icons::DOWNLOAD),
                (n, true) => format!(
                    "{}  AUTORISER DEPUIS LA D\u{00c9}TECTION ({n})",
                    icons::DOWNLOAD
                ),
                (_, false) => format!("{}  Autoriser depuis la d\u{00e9}tection", icons::LOCK),
            };
            let response = widgets::primary_button(ui, label, discoverable > 0 || !unlocked);
            let response = if !unlocked {
                response.on_hover_text("Nécessite le mode administrateur")
            } else if discoverable == 0 {
                response
                    .on_hover_text("Tous les appareils découverts figurent déjà dans l'inventaire.")
            } else {
                response
            };
            if response.clicked()
                && state.require_admin("Autoriser des appareils découverts dans l'inventaire")
                && discoverable > 0
            {
                Self::import_from_discovery(state);
                state.push_toast(
                    crate::widgets::toast::Toast::success(
                        "Actifs import\u{00e9}s depuis la d\u{00e9}couverte r\u{00e9}seau",
                    ),
                    ui.ctx(),
                );
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::button::secondary_button(
                ui,
                format!("{}  Nouvel actif", icons::PLUS),
                !state.assets.asset_editing,
            )
            .clicked()
            {
                FORM.with(|form| *form.borrow_mut() = InlineAssetForm::empty());
                state.assets.editing_id = None;
                state.assets.asset_editing = true;
            }

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let filtered = Self::displayed_indices(ui.ctx(), state);
                        Self::export_csv(state, &filtered);
                        state.push_toast(
                            crate::widgets::toast::Toast::info("Export CSV en cours…"),
                            ui.ctx(),
                        );
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Search + filters
        let crit_active = state.assets.criticality_filter == Some(AssetCriticality::Critical);
        let high_active = state.assets.criticality_filter == Some(AssetCriticality::High);
        let med_active = state.assets.criticality_filter == Some(AssetCriticality::Medium);
        let low_active = state.assets.criticality_filter == Some(AssetCriticality::Low);

        let filtered = Self::displayed_indices(ui.ctx(), state);
        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.assets.search,
            "Rechercher par nom, IP, type ou \u{00e9}tiquette…",
        )
        .chip("Critique", crit_active, theme::ERROR)
        .chip("\u{00c9}lev\u{00e9}e", high_active, theme::SEVERITY_HIGH)
        .chip("Moyenne", med_active, theme::WARNING)
        .chip("Faible", low_active, theme::INFO)
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

        if filters_before
            != (
                state.assets.search.clone(),
                state.assets.criticality_filter,
                state.assets.lifecycle_filter,
            )
        {
            state.assets.page = 0;
        }

        ui.add_space(theme::SPACE_SM);

        // Inline new asset form
        if state.assets.asset_editing {
            Self::show_asset_form(ui, state, &mut command);
            ui.add_space(theme::SPACE_MD);
        }

        // Asset table
        let filtered = Self::displayed_indices(ui.ctx(), state);

        widgets::data_card(ui, "Inventaire des actifs", |ui: &mut egui::Ui| {
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
                        "Aucun \u{00e9}quipement autoris\u{00e9}",
                        Some(
                            "Lancez une d\u{00e9}tection Shadow IT puis autorisez les \u{00e9}quipements d\u{00e9}couverts, ou ajoutez-les manuellement.",
                        ),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::BOXES_STACKED,
                        "Aucun r\u{00e9}sultat",
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

        if let Some(decommission) = Self::resolve_decommission(ui, state) {
            command = Some(decommission);
        }

        command
    }

    /// The filtered assets in the order the table shows them: the CSV
    /// export and the keyboard follow it.
    fn displayed_indices(ctx: &egui::Context, state: &AppState) -> Vec<usize> {
        let mut indices = Self::filtered_indices(state);
        order::sort(ctx, "assets", &mut indices, |key, a, b| {
            compare_assets(key, &state.assets.assets[a], &state.assets.assets[b])
        });
        indices
    }

    fn filtered_indices(state: &AppState) -> Vec<usize> {
        let search_lower = state.assets.search.to_lowercase();
        state
            .assets
            .assets
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if !search_lower.is_empty()
                    && !a
                        .hostname
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(&search_lower)
                    && !a.ip.to_lowercase().contains(&search_lower)
                    && !a.device_type.to_lowercase().contains(&search_lower)
                    && !a
                        .tags
                        .iter()
                        .any(|tag| tag.to_lowercase().contains(&search_lower))
                {
                    return false;
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
        let mut resorted = false;

        const ASSETS_PER_PAGE: usize = 50;
        let (a_start, a_len, _) =
            widgets::page_window(indices.len(), ASSETS_PER_PAGE, &mut state.assets.page);

        ui.push_id("assets_table", |ui: &mut egui::Ui| {
            use widgets::table;

            let selected = state.assets.selected_asset;

            table::fluid_clickable(
                ui,
                &[
                    table::Col::fluid(140.0, 2.0), // Nom
                    table::Col::fluid(110.0, 1.0), // IP
                    table::Col::fluid(116.0, 0.5), // Type: "Poste de travail" whole
                    table::Col::fluid(96.0, 0.0),  // Criticité
                    table::Col::fluid(140.0, 0.0), // Cycle de vie: "DÉCOMMISSIONNÉ" whole
                    table::Col::fixed(96.0),       // Score: bar and value
                    table::Col::fluid(110.0, 1.0), // Dernière vue
                ],
            )
            .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                if order::headers(
                    &mut header,
                    "assets",
                    &[
                        ("NOM", Some("name")),
                        ("IP", Some("ip")),
                        ("TYPE", Some("type")),
                        ("CRITICIT\u{00c9}", Some("criticality")),
                        ("CYCLE DE VIE", Some("lifecycle")),
                        ("SCORE", Some("score")),
                        ("DERNI\u{00c8}RE VUE", Some("last_seen")),
                    ],
                ) {
                    resorted = true;
                }
            })
            .body(|body| {
                let now = chrono::Utc::now();
                body.rows(theme::TABLE_ROW_HEIGHT, a_len, |mut row| {
                    let row_idx = a_start + row.index();
                    let Some(&real_idx) = indices.get(row_idx) else {
                        return;
                    };
                    let Some(asset) = state.assets.assets.get(real_idx) else {
                        return;
                    };
                    let is_selected = selected == Some(real_idx);
                    row.set_selected(is_selected);

                    row.col(|ui| {
                        let name = asset.hostname.as_deref().unwrap_or(&asset.ip);
                        if table::cell_link(ui, name).clicked() {
                            clicked_idx = Some(real_idx);
                        }
                    });

                    row.col(|ui| {
                        table::cell_mono(ui, &asset.ip);
                    });

                    row.col(|ui| {
                        table::cell_styled(
                            ui,
                            asset_type_label(&asset.device_type),
                            theme::font_label(),
                            theme::text_secondary(),
                        );
                    });

                    row.col(|ui| {
                        let (label, color) = Self::criticality_display(&asset.criticality);
                        widgets::status_badge(ui, label, color);
                    });

                    row.col(|ui| {
                        let (label, color) = Self::lifecycle_display(&asset.lifecycle);
                        widgets::status_badge(ui, label, color);
                    });

                    row.col(|ui| {
                        table::cell_score_bar(
                            ui,
                            &crate::format::decimal(asset.risk_score, 0),
                            asset.risk_score.clamp(0.0, 100.0) / 100.0,
                            theme::readable_color(risk_score_color(asset.risk_score)),
                        );
                    });

                    row.col(|ui| {
                        let ago = now.signed_duration_since(asset.last_seen);
                        let text = if ago.num_hours() < 24 {
                            crate::format::ago(now, asset.last_seen)
                        } else {
                            crate::format::local_day_time(asset.last_seen)
                        };
                        let color = theme::readable_color(if ago.num_hours() < 1 {
                            theme::SUCCESS
                        } else if ago.num_hours() < 24 {
                            theme::WARNING
                        } else {
                            theme::text_secondary()
                        });
                        table::cell_styled(ui, &text, theme::font_small(), color)
                            .on_hover_text(crate::format::local_datetime_secs(asset.last_seen));
                    });

                    if table::row_interaction(&row, is_selected) {
                        clicked_idx = Some(real_idx);
                    }
                });
            });
        });

        if resorted {
            state.assets.page = 0;
        }
        if let Some(idx) = clicked_idx {
            state.assets.selected_asset = Some(idx);
            state.assets.detail_open = true;
        }

        // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
        // and the page follows the selection.
        let mut position = state
            .assets
            .selected_asset
            .and_then(|real| indices.iter().position(|&r| r == real));
        if widgets::navigate_list(
            ui.ctx(),
            &mut position,
            indices.len(),
            &mut state.assets.detail_open,
        ) && let Some(pos) = position
        {
            state.assets.selected_asset = Some(indices[pos]);
            state.assets.page = pos / ASSETS_PER_PAGE;
        }

        widgets::paginate_controls(ui, indices.len(), ASSETS_PER_PAGE, &mut state.assets.page);
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let selected = match state.assets.selected_asset {
            Some(idx) if idx < state.assets.assets.len() => idx,
            _ => return,
        };

        let asset = state.assets.assets[selected].clone();
        let (crit_label, crit_color) = Self::criticality_display(&asset.criticality);
        let (lc_label, lc_color) = Self::lifecycle_display(&asset.lifecycle);

        let next_lifecycle = promoted(asset.lifecycle);
        let actions = vec![
            widgets::DetailAction::primary("Promouvoir", icons::ARROW_UP)
                .enabled(next_lifecycle.is_some()),
            widgets::DetailAction::secondary("Modifier", icons::PENCIL),
            widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD),
            widgets::DetailAction::danger("Décommissionner", icons::TRASH)
                .enabled(asset.lifecycle != AssetLifecycle::Decommissioned),
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
                widgets::detail_field(ui, "Type", asset_type_label(&asset.device_type));
                widgets::detail_field_badge(ui, "Criticit\u{00e9}", crit_label, crit_color);
                widgets::detail_field_badge(ui, "Cycle de vie", lc_label, lc_color);

                ui.add_space(theme::SPACE_SM);
                widgets::detail_section(ui, "S\u{00c9}CURIT\u{00c9}");
                widgets::detail_field_colored(
                    ui,
                    "Score de risque",
                    &format!("{} / 100", crate::format::decimal(asset.risk_score, 0)),
                    theme::readable_color(risk_score_color(asset.risk_score)),
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
                    ui.add_space(theme::SPACE_SM);
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
                    ui.add_space(theme::SPACE_SM);
                    widgets::detail_section(ui, "\u{00c9}TIQUETTES");
                    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                        for tag in &asset.tags {
                            widgets::status_badge(ui, tag, theme::ACCENT);
                            ui.add_space(theme::SPACE_XS);
                        }
                    });
                }

                ui.add_space(theme::SPACE_SM);
                widgets::detail_section(ui, "TEMPORALIT\u{00c9}");
                widgets::detail_field(
                    ui,
                    "Premi\u{00e8}re d\u{00e9}tection",
                    &crate::format::local_datetime(asset.first_seen),
                );
                widgets::detail_field(
                    ui,
                    "Derni\u{00e8}re d\u{00e9}tection",
                    &crate::format::local_datetime(asset.last_seen),
                );
            },
            &actions,
        );

        if let Some(action_idx) = drawer_action {
            match action_idx {
                0 => {
                    // Promote lifecycle: Unauthorized -> Discovered -> Qualified -> Monitored
                    if let Some(new_lifecycle) = next_lifecycle {
                        state.assets.assets[selected].lifecycle = new_lifecycle;
                        *command = Some(GuiCommand::UpdateAssetLifecycle {
                            asset_id: asset.id.clone(),
                            lifecycle: new_lifecycle,
                        });
                        state.push_toast(
                            crate::widgets::toast::Toast::success(format!(
                                "Cycle de vie : {}",
                                new_lifecycle.label_fr()
                            )),
                            ui.ctx(),
                        );
                    }
                }
                1 => {
                    // Edit in the inline form, filled with this asset.
                    FORM.with(|form| {
                        *form.borrow_mut() = InlineAssetForm {
                            hostname: asset.hostname.clone().unwrap_or_default(),
                            ip: asset.ip.clone(),
                            device_type: asset.device_type.clone(),
                            criticality_idx: AssetCriticality::all()
                                .iter()
                                .position(|c| *c == asset.criticality)
                                .unwrap_or(2),
                        };
                    });
                    state.assets.editing_id = Some(asset.id.clone());
                    state.assets.asset_editing = true;
                    state.assets.detail_open = false;
                }
                2 => {
                    // Export single asset
                    Self::export_csv(state, &[selected]);
                    state.push_toast(
                        crate::widgets::toast::Toast::info("Export CSV en cours…"),
                        ui.ctx(),
                    );
                }
                3 => {
                    // Ask first: nothing changes until the operator confirms.
                    widgets::modal::ask_confirmation(
                        ui.ctx(),
                        DECOMMISSION_CONFIRM,
                        asset.id.clone(),
                    );
                    state.assets.detail_open = false;
                }
                _ => {}
            }
        }
    }

    /// Draw the pending decommission confirmation, if any, and return the
    /// lifecycle change to send once confirmed.
    fn resolve_decommission(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let asset_id =
            widgets::modal::pending_confirmation::<String>(ui.ctx(), DECOMMISSION_CONFIRM)?;
        let name = state
            .assets
            .assets
            .iter()
            .find(|a| a.id == asset_id)
            .map(|a| a.hostname.clone().unwrap_or_else(|| a.ip.clone()))
            .unwrap_or_default();
        let confirmed = widgets::modal::resolve_confirmation::<String>(
            ui.ctx(),
            DECOMMISSION_CONFIRM,
            "Décommissionner l'actif ?",
            &format!(
                "{name} sortira du périmètre surveillé. Il reste dans l'inventaire, \
                 au cycle de vie « Décommissionné »."
            ),
            "Décommissionner",
        );
        if !confirmed {
            return None;
        }
        let asset = state.assets.assets.iter_mut().find(|a| a.id == asset_id)?;
        asset.lifecycle = AssetLifecycle::Decommissioned;
        state.push_toast(
            crate::widgets::toast::Toast::success("Actif décommissionné"),
            ui.ctx(),
        );
        Some(GuiCommand::UpdateAssetLifecycle {
            asset_id,
            lifecycle: AssetLifecycle::Decommissioned,
        })
    }

    /// Import discovered devices as managed assets (skip already-imported IPs).
    ///
    /// Each new asset is added to `state.assets.assets` for immediate GUI
    /// display **and** to `state.assets.pending_asset_saves` so that the app
    /// update loop persists them to SQLite via `SaveAsset` commands.
    fn import_from_discovery(state: &mut AppState) {
        let existing_ips: std::collections::HashSet<String> =
            state.assets.assets.iter().map(|a| a.ip.clone()).collect();

        let max_assets = 1000_usize;

        for device in &state.discovery.devices {
            if state.assets.assets.len() >= max_assets {
                break;
            }
            if existing_ips.contains(&device.ip) {
                continue;
            }

            let criticality = Self::infer_criticality(device);

            let asset = ManagedAsset {
                id: uuid::Uuid::new_v4().to_string(),
                ip: device.ip.clone(),
                hostname: device.hostname.clone(),
                mac: device.mac.clone(),
                vendor: device.vendor.clone(),
                device_type: device.device_type.clone(),
                criticality,
                lifecycle: AssetLifecycle::Discovered,
                tags: Vec::new(),
                risk_score: 0.0,
                vulnerability_count: 0,
                open_ports: device.open_ports.clone(),
                software: Vec::new(),
                first_seen: device.first_seen,
                last_seen: device.last_seen,
            };

            state.assets.assets.push(asset.clone());
            state.assets.pending_asset_saves.push(asset);
        }
    }

    /// Infer asset criticality from discovered device characteristics.
    ///
    /// - Gateway devices → `Critical`
    /// - Devices with sensitive ports (22, 80, 443, 445, 3389) → `High`
    /// - Devices with any open port → `Medium`
    /// - Everything else → `Low`
    fn infer_criticality(device: &crate::dto::GuiDiscoveredDevice) -> AssetCriticality {
        Self::infer_criticality_from_device(device.is_gateway, &device.open_ports)
    }

    /// Public helper so other pages (e.g. discovery detail drawer) can compute
    /// criticality without needing a full `GuiDiscoveredDevice` reference.
    pub fn infer_criticality_from_device(is_gateway: bool, open_ports: &[u16]) -> AssetCriticality {
        if is_gateway {
            return AssetCriticality::Critical;
        }

        const SENSITIVE_PORTS: &[u16] = &[22, 80, 443, 445, 3389];
        if open_ports.iter().any(|p| SENSITIVE_PORTS.contains(p)) {
            return AssetCriticality::High;
        }

        if !open_ports.is_empty() {
            return AssetCriticality::Medium;
        }

        AssetCriticality::Low
    }

    fn criticality_display(crit: &AssetCriticality) -> (&'static str, egui::Color32) {
        match crit {
            AssetCriticality::Critical => ("CRITIQUE", theme::ERROR),
            AssetCriticality::High => ("\u{00c9}LEV\u{00c9}E", theme::SEVERITY_HIGH),
            AssetCriticality::Medium => ("MOYENNE", theme::SEVERITY_MEDIUM),
            AssetCriticality::Low => ("FAIBLE", theme::INFO),
        }
    }

    fn lifecycle_display(lc: &AssetLifecycle) -> (&'static str, egui::Color32) {
        match lc {
            AssetLifecycle::Unauthorized => ("NON AUTORIS\u{00c9}", theme::ERROR),
            AssetLifecycle::Discovered => ("D\u{00c9}COUVERT", theme::INFO),
            AssetLifecycle::Qualified => ("QUALIFI\u{00c9}", theme::ACCENT),
            AssetLifecycle::Monitored => ("SURVEILL\u{00c9}", theme::SUCCESS),
            AssetLifecycle::Decommissioned => {
                ("D\u{00c9}COMMISSIONN\u{00c9}", theme::text_tertiary())
            }
        }
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) -> bool {
        widgets::metric_card(ui, width, label, value, color, icon)
    }

    /// Inline form that creates a managed asset, or edits the one named by
    /// `state.assets.editing_id`.
    fn show_asset_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let editing = state.assets.editing_id.clone();
        // The asset being edited left the inventory: nothing to edit.
        if let Some(id) = &editing
            && !state.assets.assets.iter().any(|a| &a.id == id)
        {
            state.assets.editing_id = None;
            state.assets.asset_editing = false;
            return;
        }

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(if editing.is_some() {
                    "MODIFIER L'ACTIF"
                } else {
                    "NOUVEL ACTIF"
                })
                .font(theme::font_label())
                .color(theme::accent_text())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            FORM.with(|form| {
                let mut f = form.borrow_mut();

                // Hostname
                widgets::form::row(ui, "Nom", |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut f.hostname, "Nom d'h\u{00f4}te…");
                });

                // IP address
                widgets::form::row(ui, "IP", |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut f.ip, "192.168.1.10");
                });

                // Device type: the known types, plus the one a hand-entered
                // or synchronised asset already carries.
                widgets::form::row(ui, "Type", |ui: &mut egui::Ui| {
                    let mut keys: Vec<&str> = DEVICE_TYPES.to_vec();
                    let current = f.device_type.trim().to_ascii_lowercase();
                    let mut index = keys.iter().position(|key| {
                        *key == current || (current.is_empty() && *key == "unknown")
                    });
                    let custom = f.device_type.clone();
                    if index.is_none() {
                        keys.push(&custom);
                        index = Some(keys.len() - 1);
                    }
                    let mut index = index.unwrap_or(0);
                    let labels: Vec<&str> = keys.iter().map(|key| asset_type_label(key)).collect();
                    if widgets::dropdown(ui, "asset_type", &labels, &mut index)
                        && let Some(key) = keys.get(index)
                    {
                        f.device_type = (*key).to_string();
                    }
                });

                // Criticality dropdown
                widgets::form::row(ui, "Criticit\u{00e9}", |ui: &mut egui::Ui| {
                    let crit_labels: Vec<&str> = AssetCriticality::all()
                        .iter()
                        .map(|c| c.label_fr())
                        .collect();
                    widgets::dropdown(ui, "asset_crit", &crit_labels, &mut f.criticality_idx);
                });

                let error = form_error(&f.ip, editing.as_deref(), &state.assets.assets);
                // Nothing typed yet is not an error worth printing.
                if let Some(message) = error
                    && !f.ip.trim().is_empty()
                {
                    ui.add_space(theme::SPACE_XS);
                    ui.label(
                        egui::RichText::new(format!("{}  {message}", icons::WARNING))
                            .font(theme::font_small())
                            .color(theme::readable_color(theme::ERROR)),
                    );
                }
                ui.add_space(theme::SPACE_SM);

                // Save / Cancel
                ui.horizontal(|ui: &mut egui::Ui| {
                    let can_save = error.is_none();

                    if widgets::primary_button(
                        ui,
                        format!("{}  Enregistrer", icons::SAVE),
                        can_save,
                    )
                    .clicked()
                        && can_save
                    {
                        let criticality = AssetCriticality::all()
                            .get(f.criticality_idx)
                            .copied()
                            .unwrap_or(AssetCriticality::Medium);
                        let hostname = if f.hostname.trim().is_empty() {
                            None
                        } else {
                            Some(f.hostname.trim().to_string())
                        };
                        let device_type = if f.device_type.trim().is_empty() {
                            "unknown".to_string()
                        } else {
                            f.device_type.trim().to_string()
                        };
                        let now = Utc::now();
                        let existing = editing
                            .as_ref()
                            .and_then(|id| state.assets.assets.iter_mut().find(|a| &a.id == id));
                        let asset = match existing {
                            // Editing keeps everything the form does not show.
                            Some(asset) => {
                                asset.ip = f.ip.trim().to_string();
                                asset.hostname = hostname;
                                asset.device_type = device_type;
                                asset.criticality = criticality;
                                asset.clone()
                            }
                            None => {
                                let asset = ManagedAsset {
                                    id: Uuid::new_v4().to_string(),
                                    ip: f.ip.trim().to_string(),
                                    hostname,
                                    mac: None,
                                    vendor: None,
                                    device_type,
                                    criticality,
                                    lifecycle: AssetLifecycle::Discovered,
                                    tags: Vec::new(),
                                    risk_score: 0.0,
                                    vulnerability_count: 0,
                                    open_ports: Vec::new(),
                                    software: Vec::new(),
                                    first_seen: now,
                                    last_seen: now,
                                };
                                state.assets.assets.push(asset.clone());
                                asset
                            }
                        };

                        *command = Some(GuiCommand::SaveAsset {
                            asset: Box::new(asset),
                        });
                        state.push_toast(
                            crate::widgets::toast::Toast::success(if editing.is_some() {
                                "Actif modifié"
                            } else {
                                "Actif ajouté à l'inventaire"
                            }),
                            ui.ctx(),
                        );
                        state.assets.asset_editing = false;
                        state.assets.editing_id = None;
                        *f = InlineAssetForm::empty();
                    }

                    ui.add_space(theme::SPACE_SM);

                    if widgets::ghost_button(ui, format!("{}  Annuler", icons::XMARK)).clicked() {
                        state.assets.asset_editing = false;
                        state.assets.editing_id = None;
                        *f = InlineAssetForm::empty();
                    }
                });
            });
        });
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let a = state.assets.assets.get(i)?;
                Some(vec![
                    a.hostname.clone().unwrap_or_default(),
                    a.ip.clone(),
                    asset_type_label(&a.device_type).to_string(),
                    a.criticality.label_fr().to_string(),
                    a.lifecycle.label_fr().to_string(),
                    format!("{:.1}", a.risk_score),
                    a.vulnerability_count.to_string(),
                    crate::format::local_datetime(a.last_seen),
                    a.tags.join(", "),
                ])
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

/// Colour of an asset risk score. The platform sends it on a 0-100 scale
/// (higher is worse); the page used to read it as 0-10, so every asset
/// above 10 showed as maximum risk.
fn risk_score_color(score: f32) -> egui::Color32 {
    if score >= 75.0 {
        theme::ERROR
    } else if score >= 50.0 {
        theme::SEVERITY_HIGH
    } else if score >= 25.0 {
        theme::SEVERITY_MEDIUM
    } else {
        theme::SUCCESS
    }
}

/// French name of an asset type as discovery reports it; a free-text type
/// entered by hand is shown as typed.
fn asset_type_label(kind: &str) -> &str {
    match kind.to_ascii_lowercase().as_str() {
        "workstation" | "desktop" | "laptop" => "Poste de travail",
        "server" => "Serveur",
        "router" | "gateway" => "Routeur",
        "switch" => "Commutateur",
        "printer" => "Imprimante",
        "phone" | "mobile" => "Mobile",
        "iot" => "IoT / embarqué",
        "nas" | "storage" => "Stockage",
        "firewall" => "Pare-feu",
        "camera" => "Caméra",
        "unknown" | "" => "Non identifié",
        _ => kind,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(id: &str, ip: &str) -> ManagedAsset {
        ManagedAsset {
            id: id.to_string(),
            ip: ip.to_string(),
            hostname: None,
            mac: None,
            vendor: None,
            device_type: "server".to_string(),
            criticality: AssetCriticality::Medium,
            lifecycle: AssetLifecycle::Discovered,
            tags: Vec::new(),
            risk_score: 0.0,
            vulnerability_count: 0,
            open_ports: Vec::new(),
            software: Vec::new(),
            first_seen: Utc::now(),
            last_seen: Utc::now(),
        }
    }

    #[test]
    fn the_form_wants_a_real_address_that_no_other_asset_has() {
        let assets = vec![asset("a", "192.168.1.10")];
        assert!(form_error("", None, &assets).is_some());
        assert!(form_error("abc", None, &assets).is_some());
        assert!(form_error("192.168.1.10", None, &assets).is_some());
        assert_eq!(form_error(" 192.168.1.11 ", None, &assets), None);
        assert_eq!(form_error("fe80::1", None, &assets), None);
        // The asset being edited keeps its own address.
        assert_eq!(form_error("192.168.1.10", Some("a"), &assets), None);
        assert!(form_error("192.168.1.10", Some("b"), &assets).is_some());
    }

    #[test]
    fn addresses_sort_by_value_and_versions_by_their_numbers() {
        use std::cmp::Ordering::{Equal, Greater, Less};
        assert_eq!(order::ip("10.0.0.9", "10.0.0.10"), Less);
        assert_eq!(order::ip("192.168.1.2", "192.168.1.100"), Less);
        assert_eq!(order::ip("192.168.10.1", "192.168.9.1"), Greater);
        assert_eq!(order::ip("10.0.0.1", " 10.0.0.1 "), Equal);
        // IPv4 before IPv6, anything else last.
        assert_eq!(order::ip("192.168.1.1", "fe80::1"), Less);
        assert_eq!(order::ip("fe80::1", "inconnu"), Less);
        assert_eq!(order::ip("*", "10.0.0.1"), Greater);

        assert_eq!(order::version("1.9", "1.10"), Less);
        assert_eq!(order::version("24.08", "24.8"), Equal);
        assert_eq!(order::version("2.0.0", "2.0"), Greater);
        assert_eq!(order::version("KB999", "KB1000"), Less);
        assert_eq!(
            order::version("3.0.2-0ubuntu1.15", "3.0.2-0ubuntu1.9"),
            Greater
        );
        assert_eq!(order::opt_version(None, Some("1.0")), Greater);

        assert_eq!(order::text("alpha", "Beta"), Less);
        assert_eq!(order::opt_text(Some(""), Some("zeta")), Greater);
        assert_eq!(order::opt_text(None, None), Equal);
    }

    #[test]
    fn assets_sort_by_rank_not_by_label() {
        use std::cmp::Ordering::{Greater, Less};
        let mut critical = asset("a", "10.0.0.10");
        critical.criticality = AssetCriticality::Critical;
        critical.lifecycle = AssetLifecycle::Monitored;
        critical.risk_score = 9.0;
        let mut low = asset("b", "10.0.0.9");
        low.criticality = AssetCriticality::Low;
        low.lifecycle = AssetLifecycle::Discovered;
        low.risk_score = 80.0;
        assert_eq!(compare_assets("criticality", &critical, &low), Greater);
        assert_eq!(compare_assets("lifecycle", &critical, &low), Greater);
        assert_eq!(compare_assets("score", &critical, &low), Less);
        assert_eq!(compare_assets("ip", &critical, &low), Greater);
        // Without a host name, the name column falls back on the address.
        assert_eq!(compare_assets("name", &critical, &low), Less);
    }

    #[test]
    fn promotion_stops_at_monitored() {
        assert_eq!(
            promoted(AssetLifecycle::Unauthorized),
            Some(AssetLifecycle::Discovered)
        );
        assert_eq!(
            promoted(AssetLifecycle::Qualified),
            Some(AssetLifecycle::Monitored)
        );
        assert_eq!(promoted(AssetLifecycle::Monitored), None);
        assert_eq!(promoted(AssetLifecycle::Decommissioned), None);
    }

    #[test]
    fn every_offered_type_has_a_french_name() {
        for key in DEVICE_TYPES {
            assert_ne!(asset_type_label(key), *key, "{key}");
        }
    }
}
