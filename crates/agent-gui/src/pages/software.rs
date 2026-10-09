// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Software page -- installed software inventory with tabs.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SoftwarePage;

use crate::dto::SoftwareTab;

impl SoftwarePage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
        let _ = widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "Logiciels"],
            "Inventaire Logiciel",
            Some("Applications et composants système installés sur cet hôte."),
            Some(
                "Consultez la liste exhaustive des paquets système et des applications installées. Le système vérifie automatiquement si vos logiciels sont à jour pour réduire la surface d'attaque.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Tab bar — the Applications tab exists on macOS and Windows only.
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        if state.software.active_tab == SoftwareTab::Applications {
            state.software.active_tab = SoftwareTab::Packages;
        }
        let active = state.software.active_tab;
        ui.horizontal(|ui: &mut egui::Ui| {
            if Self::tab_button(
                ui,
                &format!("{}  Dépendances et paquets", icons::SOFTWARE),
                active == SoftwareTab::Packages,
            ) {
                state.software.active_tab = SoftwareTab::Packages;
                state.software.selected_package = None;
                state.software.detail_open = false;
            }
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            {
                ui.add_space(theme::SPACE_SM);
                if Self::tab_button(
                    ui,
                    &format!("{}  Applications utilisateur", icons::CUBE),
                    active == SoftwareTab::Applications,
                ) {
                    state.software.active_tab = SoftwareTab::Applications;
                    state.software.selected_package = None;
                    state.software.detail_open = false;
                }
            }
            ui.add_space(theme::SPACE_SM);
            if Self::tab_button(
                ui,
                &format!("{}  Extensions de navigateur", icons::PLUG),
                active == SoftwareTab::Extensions,
            ) {
                state.software.active_tab = SoftwareTab::Extensions;
                state.software.selected_package = None;
                state.software.detail_open = false;
            }
        });

        ui.add_space(theme::SPACE_LG);

        let search_id = ui.id().with("software_search_cache");
        let search_upper: String = ui
            .memory(|mem| {
                mem.data
                    .get_temp::<(String, String)>(search_id)
                    .filter(|(orig, _)| orig == &state.software.search)
                    .map(|(_, upper)| upper)
            })
            .unwrap_or_else(|| {
                let upper = state.software.search.to_uppercase();
                ui.memory_mut(|mem| {
                    mem.data
                        .insert_temp(search_id, (state.software.search.clone(), upper.clone()))
                });
                upper
            });

        match active {
            SoftwareTab::Packages => Self::show_packages(ui, state, &search_upper, &mut command),
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            SoftwareTab::Applications => {
                Self::show_native_apps(ui, state, &search_upper, &mut command)
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            SoftwareTab::Applications => { /* unreachable on unsupported platforms */ }
            SoftwareTab::Extensions => Self::show_extensions(ui, state, &search_upper),
        }

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.software.selected_package {
            match state.software.active_tab {
                SoftwareTab::Packages => {
                    if sel_idx < state.software.packages.len() {
                        let pkg = state.software.packages[sel_idx].clone();
                        let mut actions = Vec::new();
                        if !pkg.up_to_date {
                            actions.push(widgets::DetailAction::primary(
                                "Mettre \u{00e0} jour",
                                icons::DOWNLOAD,
                            ));
                        }
                        actions.push(widgets::DetailAction::secondary(
                            "D\u{00e9}tails",
                            icons::INFO,
                        ));

                        let drawer_action = widgets::DetailDrawer::new(
                            "software_pkg_detail",
                            &pkg.name,
                            icons::SOFTWARE,
                        )
                        .accent(if pkg.up_to_date {
                            theme::SUCCESS
                        } else {
                            theme::WARNING
                        })
                        .subtitle(&pkg.version)
                        .show(
                            ui.ctx(),
                            &mut state.software.detail_open,
                            |ui| {
                                widgets::detail_section(ui, "LOGICIEL");
                                widgets::detail_field(ui, "Nom", &pkg.name);
                                widgets::detail_mono(ui, "Version actuelle", &pkg.version);
                                widgets::detail_field(
                                    ui,
                                    "\u{00c9}diteur",
                                    pkg.publisher.as_deref().unwrap_or("--"),
                                );
                                if let Some(ref installed) = pkg.installed_at {
                                    widgets::detail_field(
                                        ui,
                                        "Date d'installation",
                                        &crate::format::local_date(*installed),
                                    );
                                }
                                if pkg.up_to_date {
                                    widgets::detail_field_badge(
                                        ui,
                                        "\u{00c0} jour",
                                        "OUI",
                                        theme::SUCCESS,
                                    );
                                } else {
                                    widgets::detail_field_badge(
                                        ui,
                                        "\u{00c0} jour",
                                        "NON",
                                        theme::WARNING,
                                    );
                                }
                                if let Some(ref latest) = pkg.latest_version {
                                    widgets::detail_mono(
                                        ui,
                                        "Derni\u{00e8}re version disponible",
                                        latest,
                                    );
                                }
                            },
                            &actions,
                        );

                        if let Some(action_idx) = drawer_action
                            && !pkg.up_to_date
                            && action_idx == 0
                        {
                            let safe_name = pkg.name.replace('\'', "'\\''");
                            let cmd = platform_upgrade_command(&safe_name);
                            ui.ctx().copy_text(cmd);
                            let time = ui.input(|i| i.time);
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Commande de mise \u{00e0} jour copi\u{00e9}e dans le presse-papiers",
                                )
                                .with_time(time),
                            );
                        }
                    }
                }
                #[cfg(any(target_os = "macos", target_os = "windows"))]
                SoftwareTab::Applications => {
                    if sel_idx < state.software.native_apps.len() {
                        let app = state.software.native_apps[sel_idx].clone();

                        let open_label = if cfg!(target_os = "macos") {
                            "Ouvrir dans Finder"
                        } else {
                            "Ouvrir dans l'Explorateur"
                        };
                        let section_label = if cfg!(target_os = "macos") {
                            "APPLICATION MACOS"
                        } else {
                            "APPLICATION WINDOWS"
                        };
                        let id_label = if cfg!(target_os = "macos") {
                            "Bundle ID"
                        } else {
                            "Identifiant produit"
                        };

                        let actions =
                            vec![widgets::DetailAction::secondary(open_label, icons::FOLDER)];

                        let drawer_action = widgets::DetailDrawer::new(
                            "software_app_detail",
                            &app.name,
                            icons::CUBE,
                        )
                        .accent(theme::ACCENT)
                        .subtitle(&app.bundle_id)
                        .show(
                            ui.ctx(),
                            &mut state.software.detail_open,
                            |ui| {
                                widgets::detail_section(ui, section_label);
                                widgets::detail_field(ui, "Nom", &app.name);
                                widgets::detail_mono(ui, "Version", &app.version);
                                widgets::detail_mono(ui, id_label, &app.bundle_id);
                                widgets::detail_field(ui, "\u{00c9}diteur", &app.publisher);
                                widgets::detail_mono(ui, "Chemin", &app.path);
                            },
                            &actions,
                        );

                        if let Some(0) = drawer_action {
                            let path = std::path::Path::new(&app.path);
                            if path.is_absolute() {
                                #[cfg(target_os = "macos")]
                                let result = agent_common::process::silent_command("open")
                                    .args(["-R", &app.path])
                                    .spawn();
                                #[cfg(target_os = "windows")]
                                let result = agent_common::process::silent_command("explorer")
                                    .args(["/select,", &app.path])
                                    .spawn();
                                if let Err(e) = result {
                                    tracing::warn!("Failed to reveal in file manager: {}", e);
                                    let time = ui.input(|i| i.time);
                                    state.toasts.push(
                                        crate::widgets::toast::Toast::error(
                                            "Impossible d'ouvrir le gestionnaire de fichiers",
                                        )
                                        .with_time(time),
                                    );
                                }
                            } else {
                                tracing::warn!("Refused to open non-absolute path: {}", app.path);
                            }
                        }
                    }
                }
                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                SoftwareTab::Applications => { /* unreachable on unsupported platforms */ }
                SoftwareTab::Extensions => {
                    if let Some(extension) = state.software.browser_extensions.get(sel_idx) {
                        let (label, color) = reach_display(extension.reach);
                        let action = widgets::DetailDrawer::new("extension_detail", &extension.name, icons::PLUG)
                            .accent(color)
                            .subtitle("Permissions, provenance et profil d’installation")
                            .show(ui.ctx(), &mut state.software.detail_open, |ui| {
                                widgets::detail_field_badge(ui, "Portée", label, color);
                                widgets::detail_mono(ui, "Identifiant", &extension.id);
                                widgets::detail_field(ui, "Version", &extension.version);
                                widgets::detail_field(ui, "Navigateur", &extension.browser);
                                widgets::detail_field(ui, "Utilisateur", &extension.user);
                                widgets::detail_field(ui, "Profil", &extension.profile);
                                widgets::detail_field(ui, "État", match extension.enabled {
                                    Some(true) => "Activée", Some(false) => "Désactivée", None => "Non communiqué",
                                });
                                widgets::detail_field(ui, "Provenance", if extension.from_store { "Magasin du navigateur" } else { "Hors magasin / origine à vérifier" });
                                widgets::detail_section(ui, "Permissions à examiner");
                                if extension.reasons.is_empty() {
                                    widgets::detail_text(ui, "", "Aucune permission sensible signalée par l’inventaire.");
                                }
                                for reason in &extension.reasons { widgets::detail_text(ui, "", reason); }
                                widgets::detail_section(ui, "Vérification conseillée");
                                widgets::detail_text(ui, "", "La portée décrit des capacités, pas un verdict de malveillance. Vérifiez l’éditeur, la nécessité des permissions et le profil concerné dans le gestionnaire d’extensions du navigateur.");
                            }, &[widgets::DetailAction::secondary("Copier l’identifiant", icons::COPY)]);
                        if action == Some(0) {
                            ui.ctx().copy_text(extension.id.clone());
                        }
                    }
                }
            }
        }

        command
    }

    // -- Tab: Extensions de navigateur --

    fn show_extensions(ui: &mut Ui, state: &mut AppState, search_upper: &str) {
        let filtered = filtered_extensions(&state.software.browser_extensions, search_upper);
        let total = state.software.browser_extensions.len();
        let extended = state
            .software
            .browser_extensions
            .iter()
            .filter(|e| e.reach == crate::dto::Severity::High)
            .count();

        widgets::data_card(ui, "Portée des extensions", |ui: &mut egui::Ui| {
            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(crate::format::int(total as u64))
                        .font(theme::font_card_value())
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.label(
                    egui::RichText::new(if total > 1 {
                        "extensions installées"
                    } else {
                        "extension installée"
                    })
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_MD);
                if extended > 0 {
                    widgets::status_badge(
                        ui,
                        &format!("{extended} à portée étendue"),
                        theme::SEVERITY_HIGH,
                    );
                }
            });
            ui.add_space(theme::SPACE_SM);
            ui.label(
                egui::RichText::new(
                    "La portée indique ce qu'une extension peut faire avec les permissions \
                     qu'elle a obtenues (lire tous les sites, les cookies, le trafic…). Ce n'est \
                     pas un verdict : un bloqueur de publicité a une portée étendue. Vérifiez \
                     d'abord celles que personne ne reconnaît ou installées hors magasin.",
                )
                .font(theme::font_min())
                .color(theme::text_secondary()),
            );
        });

        ui.add_space(theme::SPACE_MD);

        let _ = widgets::SearchFilterBar::new(
            &mut state.software.search,
            "Rechercher une extension, un navigateur ou un utilisateur…",
        )
        .result_count(filtered.len())
        .show(ui);

        ui.add_space(theme::SPACE_SM);

        widgets::data_card(ui, "Extensions de navigateur", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("EXTENSIONS DE NAVIGATEUR")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if total == 0 {
                widgets::empty_state(
                    ui,
                    icons::PLUG,
                    "Aucune extension inventoriée",
                    Some(
                        "L'inventaire est relevé à chaque analyse des vulnérabilités, dans les profils Chrome, Edge, Brave, Chromium et Firefox de chaque utilisateur.",
                    ),
                );
                return;
            }
            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::PLUG,
                    "Aucun résultat",
                    Some("Ajustez votre recherche pour voir les extensions."),
                );
                return;
            }

            use widgets::table;
            const EXTENSIONS_PER_PAGE: usize = 25;
            let (page_start, page_len, _) = widgets::page_window(
                filtered.len(),
                EXTENSIONS_PER_PAGE,
                &mut state.software.extensions_page,
            );

            table::fluid_clickable(
                ui,
                &[
                    table::Col::fluid(170.0, 2.0), // Extension
                    table::Col::fluid(110.0, 1.0), // Navigateur
                    table::Col::fluid(90.0, 0.5),  // Utilisateur
                    table::Col::fluid(80.0, 0.5),  // Version
                    table::Col::fluid(96.0, 0.0),  // Portée
                    table::Col::fluid(180.0, 4.0), // Pourquoi
                ],
            )
            .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                for title in [
                    "EXTENSION",
                    "NAVIGATEUR",
                    "UTILISATEUR",
                    "VERSION",
                    "PORTÉE",
                    "POURQUOI",
                ] {
                    header.col(|ui| {
                        table::header_cell(ui, title);
                    });
                }
            })
            .body(|body| {
                body.rows(theme::TABLE_DATA_ROW_HEIGHT, page_len, |mut row| {
                    let Some(&real_idx) = filtered.get(page_start + row.index()) else {
                        return;
                    };
                    let Some(extension) = state.software.browser_extensions.get(real_idx) else {
                        return;
                    };
                    row.col(|ui| {
                        table::cell_stack(ui, &extension.name, &extension.id);
                    });
                    row.col(|ui| {
                        table::cell_stack(ui, &extension.browser, &extension.profile);
                    });
                    row.col(|ui| {
                        table::cell(ui, &extension.user);
                    });
                    row.col(|ui| {
                        table::cell_mono_muted(ui, &extension.version);
                    });
                    row.col(|ui| {
                        let (label, color) = reach_display(extension.reach);
                        widgets::status_badge(ui, label, color);
                        if extension.enabled == Some(false) {
                            ui.add_space(theme::SPACE_XS);
                            widgets::status_badge(ui, "INACTIVE", theme::text_tertiary());
                        }
                    });
                    row.col(|ui| {
                        if extension.reasons.is_empty() {
                            table::cell_muted(ui, "Aucune permission sensible");
                        } else {
                            // The row shows one line: the full list on hover.
                            table::cell_small(ui, &extension.reasons.join(" · "))
                                .on_hover_text(extension.reasons.join("\n"));
                        }
                    });
                    if table::row_interaction(
                        &row,
                        state.software.selected_package == Some(real_idx),
                    ) {
                        state.software.selected_package = Some(real_idx);
                        state.software.detail_open = true;
                    }
                });
            });
            let mut position = state
                .software
                .selected_package
                .and_then(|idx| filtered.iter().position(|&i| i == idx));
            if widgets::navigate_list(
                ui.ctx(),
                &mut position,
                filtered.len(),
                &mut state.software.detail_open,
            ) {
                state.software.selected_package = position.and_then(|p| filtered.get(p).copied());
                if let Some(pos) = position {
                    state.software.extensions_page = pos / EXTENSIONS_PER_PAGE;
                }
            }

            widgets::paginate_controls(
                ui,
                filtered.len(),
                EXTENSIONS_PER_PAGE,
                &mut state.software.extensions_page,
            );
        });
    }

    // -- Tab: Paquets (Homebrew) --

    fn show_packages(
        ui: &mut Ui,
        state: &mut AppState,
        search_upper: &str,
        command: &mut Option<GuiCommand>,
    ) {
        let filtered: Vec<usize> = state
            .software
            .packages
            .iter()
            .enumerate()
            .filter(|(_, p)| {
                if search_upper.is_empty() {
                    return true;
                }
                p.name.to_uppercase().contains(search_upper)
                    || p.version.to_uppercase().contains(search_upper)
                    || p.publisher
                        .as_deref()
                        .unwrap_or("")
                        .to_uppercase()
                        .contains(search_upper)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        const SW_PER_PAGE: usize = 50;
        let (pkg_start, pkg_len, _) = widgets::page_window(
            filtered.len(),
            SW_PER_PAGE,
            &mut state.software.packages_page,
        );

        // Summary cards (AAA Grade)
        let total = state.software.packages.len() as u32;
        let up_to_date = state
            .software
            .packages
            .iter()
            .filter(|p| p.up_to_date)
            .count() as u32;
        let outdated = total.saturating_sub(up_to_date);

        let card_grid = widgets::ResponsiveGrid::new(280.0, theme::SPACE_SM);
        let items = vec![
            (
                "COMPOSANTS DÉTECTÉS",
                total.to_string(),
                theme::text_primary(),
                icons::CUBE,
            ),
            (
                "VERSIONS CONFORMES",
                up_to_date.to_string(),
                theme::SUCCESS,
                icons::CIRCLE_CHECK,
            ),
            (
                "MISES À JOUR REQUISES",
                outdated.to_string(),
                if outdated > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::ARROW_UP,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            if Self::summary_card(ui, width, label, value, *color, icon) {
                widgets::open_data_panel(ui.ctx(), "Paquets et dépendances");
            }
        });

        ui.add_space(theme::SPACE_MD);

        Self::updates_card(ui, &state.software.packages);

        ui.add_space(theme::SPACE_MD);

        ui.horizontal(|ui: &mut egui::Ui| {
            if widgets::button::secondary_button(
                ui,
                format!("{}  SBOM CycloneDX", icons::DOWNLOAD),
                !state.software.packages.is_empty(),
            )
            .on_hover_text(
                "Exporte l'inventaire logiciel et ses vulnérabilités au format CycloneDX 1.5 (JSON), sur le Bureau.",
            )
            .clicked()
            {
                *command = Some(GuiCommand::ExportSbom);
            }
        });

        ui.add_space(theme::SPACE_SM);

        let (_, export) = widgets::SearchFilterBar::new(
            &mut state.software.search,
            "Rechercher un paquet, une version ou un éditeur…",
        )
        .result_count(result_count)
        .action(format!("{}  CSV", icons::DOWNLOAD))
        .show_with_action(ui);
        if export {
            let success = Self::export_packages_csv(state, &filtered);
            let time = ui.input(|i| i.time);
            if success {
                state.toasts.push(
                    crate::widgets::toast::Toast::success("Export CSV réussi").with_time(time),
                );
            } else {
                state.toasts.push(
                    crate::widgets::toast::Toast::error("Échec de l'export CSV").with_time(time),
                );
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Packages table (AAA Grade)
        widgets::data_card(ui, "Paquets et dépendances", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REGISTRE DES PAQUETS ET DÉPENDANCES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                || state.sync.in_progress;

            if filtered.is_empty() {
                if state.software.packages.is_empty() && is_loading {
                    ui.push_id("software_packages_skeletons", |ui: &mut egui::Ui| {
                        let cols = 5;
                        let column_widths = [200.0, 100.0, 150.0, 100.0, 100.0];
                        for _ in 0..5 {
                            crate::widgets::skeleton::skeleton_table_row(ui, cols, &column_widths);
                            ui.add_space(theme::SPACE_MD);
                        }
                    });
                } else {
                    widgets::empty_state(
                        ui,
                        icons::SOFTWARE,
                        "Aucune occurrence trouv\u{00e9}e",
                        Some(
                            "Ajustez vos crit\u{00e8}res de recherche ou actualisez l'inventaire.",
                        ),
                    );
                }
            } else {
                use widgets::table;

                let mut clicked_idx: Option<usize> = None;
                let selected = state.software.selected_package;

                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fluid(160.0, 3.0), // Désignation
                        table::Col::fluid(90.0, 1.0),  // Version
                        table::Col::fluid(120.0, 1.5), // Éditeur / origine
                        table::Col::fluid(96.0, 0.0),  // État
                        table::Col::fluid(100.0, 1.0), // Cible de MAJ
                        table::Col::fixed(88.0),       // Actions
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "D\u{00c9}SIGNATION");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "VERSION");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "\u{00c9}DITEUR / ORIGINE");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "\u{00c9}TAT");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "CIBLE DE MAJ");
                    });
                    header.col(|_ui: &mut egui::Ui| {}); // Actions
                })
                .body(|body| {
                    body.rows(theme::TABLE_DATA_ROW_HEIGHT, pkg_len, |mut row| {
                        let Some(&real_idx) = filtered.get(pkg_start + row.index()) else {
                            return;
                        };
                        let Some(pkg) = state.software.packages.get(real_idx) else {
                            return;
                        };
                        let is_selected = selected == Some(real_idx);
                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            let installed = pkg
                                .installed_at
                                .map(|dt| {
                                    format!("Install\u{00e9} le {}", crate::format::local_date(dt))
                                })
                                .unwrap_or_default();
                            table::cell_stack(ui, &pkg.name, &installed);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if pkg.version.is_empty() {
                                table::cell_empty(ui);
                            } else {
                                table::cell_mono(ui, &pkg.version);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| match pkg.publisher.as_deref() {
                            Some(publisher) if !publisher.is_empty() => {
                                table::cell_muted(ui, publisher);
                            }
                            _ => {
                                table::cell_empty(ui);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if pkg.up_to_date {
                                widgets::status_badge(ui, "CONFORME", theme::SUCCESS);
                            } else {
                                widgets::status_badge(ui, "OBSOL\u{00c8}TE", theme::WARNING);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| match &pkg.latest_version {
                            Some(latest) if !pkg.up_to_date => {
                                table::cell_colored(
                                    ui,
                                    &format!("{} {}", icons::ARROW_RIGHT, latest),
                                    theme::accent_text(),
                                );
                            }
                            _ => {
                                table::cell_empty(ui);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if widgets::ghost_button(ui, format!("{}  D\u{00e9}tails", icons::EYE))
                                .clicked()
                            {
                                clicked_idx = Some(real_idx);
                            }
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked_idx = Some(real_idx);
                        }
                    });
                });

                if let Some(idx) = clicked_idx {
                    state.software.selected_package = Some(idx);
                    state.software.detail_open = true;
                }

                // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer,
                // and the page follows the selection.
                let mut position = state
                    .software
                    .selected_package
                    .and_then(|real| filtered.iter().position(|&r| r == real));
                if widgets::navigate_list(
                    ui.ctx(),
                    &mut position,
                    filtered.len(),
                    &mut state.software.detail_open,
                ) && let Some(pos) = position
                {
                    state.software.selected_package = Some(filtered[pos]);
                    state.software.packages_page = pos / SW_PER_PAGE;
                }
                widgets::paginate_controls(
                    ui,
                    filtered.len(),
                    SW_PER_PAGE,
                    &mut state.software.packages_page,
                );
            }
        });
    }

    // -- Tab: Applications (native apps — macOS & Windows) --

    /// Update coverage beside the packages to update, so the card says
    /// both how far behind the fleet is and where to start.
    fn updates_card(ui: &mut Ui, packages: &[crate::dto::GuiSoftwarePackage]) {
        let total = packages.len();
        let current = packages.iter().filter(|p| p.up_to_date).count();
        widgets::data_card(ui, "Mises à jour", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("MISES À JOUR")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);
            let columns = ui.available_width() >= 720.0;
            let gap = theme::SPACE_XL;
            let column_w = if columns {
                (ui.available_width() - gap) / 2.0
            } else {
                ui.available_width()
            };
            let layout = if columns {
                egui::Layout::left_to_right(egui::Align::Min)
            } else {
                egui::Layout::top_down(egui::Align::Min)
            };
            ui.with_layout(layout, |ui| {
                let inner = ui.spacing().item_spacing;
                ui.spacing_mut().item_spacing = egui::vec2(gap, theme::SPACE_LG);
                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing = inner;
                    ui.set_width(column_w);
                    update_coverage(ui, current, total);
                });
                ui.vertical(|ui| {
                    ui.spacing_mut().item_spacing = inner;
                    ui.set_width(column_w);
                    outdated_list(ui, packages);
                });
            });
        });
    }

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn show_native_apps(
        ui: &mut Ui,
        state: &mut AppState,
        search_upper: &str,
        _command: &mut Option<GuiCommand>,
    ) {
        let filtered: Vec<usize> = state
            .software
            .native_apps
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if search_upper.is_empty() {
                    return true;
                }
                a.name.to_uppercase().contains(search_upper)
                    || a.version.to_uppercase().contains(search_upper)
                    || a.publisher.to_uppercase().contains(search_upper)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();
        let total = state.software.native_apps.len() as u32;

        const SW_PER_PAGE: usize = 50;
        let (app_start, app_len, _) =
            widgets::page_window(filtered.len(), SW_PER_PAGE, &mut state.software.native_page);

        let (os_label, audit_scope) = if cfg!(target_os = "macos") {
            ("macOS", "/Applications")
        } else {
            ("Windows", "Program Files")
        };

        // One context strip: the system and the audited folder are facts
        // about the inventory, not metrics, and read oddly as giant figures.
        widgets::data_card(ui, "Applications installées", |ui: &mut egui::Ui| {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    egui::RichText::new(crate::format::int(total))
                        .font(theme::font_h2())
                        .color(theme::accent_text()),
                );
                ui.label(
                    egui::RichText::new(if total > 1 {
                        "applications installées"
                    } else {
                        "application installée"
                    })
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_MD);
                widgets::status_badge(ui, &format!("{}  {os_label}", icons::DESKTOP), theme::INFO);
                widgets::status_badge(
                    ui,
                    &format!("{}  {audit_scope}", icons::DATABASE),
                    theme::ACCENT,
                );
            });
        });

        ui.add_space(theme::SPACE_MD);

        let (_, export) = widgets::SearchFilterBar::new(
            &mut state.software.search,
            "Rechercher une application, un bundle ou un éditeur…",
        )
        .result_count(result_count)
        .action(format!("{}  CSV", icons::DOWNLOAD))
        .show_with_action(ui);
        if export {
            let success = Self::export_apps_csv(state, &filtered);
            let time = ui.input(|i| i.time);
            if success {
                state.toasts.push(
                    crate::widgets::toast::Toast::success("Export CSV réussi").with_time(time),
                );
            } else {
                state.toasts.push(
                    crate::widgets::toast::Toast::error("Échec de l'export CSV").with_time(time),
                );
            }
        }

        ui.add_space(theme::SPACE_SM);

        widgets::data_card(ui, "Applications natives", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REGISTRE DES APPLICATIONS NATIVES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let is_loading = state.summary.status == crate::dto::GuiAgentStatus::Starting
                || state.summary.status == crate::dto::GuiAgentStatus::Syncing
                || state.sync.in_progress;

            if filtered.is_empty() {
                if state.software.native_apps.is_empty() && is_loading {
                    ui.push_id("software_apps_skeletons", |ui: &mut egui::Ui| {
                        let cols = 4;
                        let column_widths = [200.0, 90.0, 200.0, 100.0];
                        for _ in 0..5 {
                            crate::widgets::skeleton::skeleton_table_row(ui, cols, &column_widths);
                            ui.add_space(theme::SPACE_MD);
                        }
                    });
                } else {
                    widgets::empty_state(
                        ui,
                        icons::CUBE,
                        "Aucune entit\u{00e9} identifi\u{00e9}e",
                        Some(
                            "Veuillez patienter pendant la fin de la synchronisation de l'inventaire.",
                        ),
                    );
                }
            } else {
                use widgets::table;

                let mut clicked_idx: Option<usize> = None;
                let selected = state.software.selected_package;

                table::fluid_clickable(
                    ui,
                    &[
                        table::Col::fluid(160.0, 2.0), // Point d'entrée
                        table::Col::fluid(90.0, 0.5),  // Version
                        table::Col::fluid(140.0, 2.0), // Identifiant
                        table::Col::fluid(140.0, 1.5), // Certificat d'éditeur
                        table::Col::fixed(88.0),       // Actions
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "APPLICATION");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "VERSION");
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(
                            ui,
                            if cfg!(target_os = "macos") {
                                "IDENTIFIANT (BUNDLE ID)"
                            } else {
                                "IDENTIFIANT PRODUIT"
                            },
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        table::header_cell(ui, "\u{00c9}DITEUR");
                    });
                    header.col(|_ui: &mut egui::Ui| {}); // Actions
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT, app_len, |mut row| {
                        let Some(&real_idx) = filtered.get(app_start + row.index()) else {
                            return;
                        };
                        let Some(app) = state.software.native_apps.get(real_idx) else {
                            return;
                        };
                        let is_selected = selected == Some(real_idx);
                        row.set_selected(is_selected);

                        row.col(|ui: &mut egui::Ui| {
                            table::cell_strong(ui, &app.name);
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if app.version.is_empty() {
                                table::cell_empty(ui);
                            } else {
                                table::cell_mono(ui, &app.version);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if app.bundle_id.is_empty() {
                                table::cell_empty(ui);
                            } else {
                                table::cell_mono_muted(ui, &app.bundle_id);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if app.publisher.is_empty() {
                                table::cell_empty(ui);
                            } else {
                                table::cell_muted(ui, &app.publisher);
                            }
                        });
                        row.col(|ui: &mut egui::Ui| {
                            if widgets::ghost_button(ui, format!("{}  D\u{00e9}tails", icons::EYE))
                                .clicked()
                            {
                                clicked_idx = Some(real_idx);
                            }
                        });

                        if table::row_interaction(&row, is_selected) {
                            clicked_idx = Some(real_idx);
                        }
                    });
                });

                if let Some(idx) = clicked_idx {
                    state.software.selected_package = Some(idx);
                    state.software.detail_open = true;
                }

                widgets::paginate_controls(
                    ui,
                    filtered.len(),
                    SW_PER_PAGE,
                    &mut state.software.native_page,
                );
            }
        });
    }

    // -- CSV export helpers --

    fn export_packages_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["nom", "version", "editeur", "a_jour", "derniere_version"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let p = state.software.packages.get(i)?;
                Some(vec![
                    p.name.clone(),
                    p.version.clone(),
                    p.publisher.clone().unwrap_or_default(),
                    if p.up_to_date { "Oui" } else { "Non" }.to_string(),
                    p.latest_version.clone().unwrap_or_default(),
                ])
            })
            .collect();
        let path = crate::export::default_export_path("logiciels_paquets.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn export_apps_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["nom", "version", "identifiant", "editeur", "chemin"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .filter_map(|&i| {
                let a = state.software.native_apps.get(i)?;
                Some(vec![
                    a.name.clone(),
                    a.version.clone(),
                    a.bundle_id.clone(),
                    a.publisher.clone(),
                    a.path.clone(),
                ])
            })
            .collect();
        let path = crate::export::default_export_path("logiciels_apps.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }

    // -- Shared helpers (AAA Grade) --

    fn tab_button(ui: &mut Ui, label: &str, active: bool) -> bool {
        widgets::chip_button(ui, label, active, theme::ACCENT).clicked()
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
}

/// Generate a platform-appropriate package upgrade command.
fn software_column_title(ui: &mut Ui, icon: &str, title: &str) {
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
}

fn update_coverage(ui: &mut Ui, current: usize, total: usize) {
    software_column_title(ui, icons::SHIELD_CHECK, "Couverture des mises à jour");
    let ratio = current as f32 / total.max(1) as f32;
    let color = if ratio >= 0.9 {
        theme::SUCCESS
    } else if ratio >= 0.7 {
        theme::SEVERITY_MEDIUM
    } else {
        theme::ERROR
    };
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(crate::format::pct(ratio * 100.0, 0))
                .font(theme::font_h2())
                .color(theme::readable_color(color)),
        );
        ui.label(
            egui::RichText::new(format!("{current} / {total} paquets à jour"))
                .font(theme::font_caption())
                .color(theme::text_secondary()),
        );
    });
    ui.add_space(theme::SPACE_XS);
    let height = 8.0;
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if ui.is_rect_visible(rect) {
        let radius = egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);
        ui.painter().rect_filled(rect, radius, theme::bg_tertiary());
        if total > 0 {
            let split = rect.width() * ratio;
            ui.painter().rect_filled(
                egui::Rect::from_min_size(rect.min, egui::vec2(split, height)),
                radius,
                theme::readable_color(theme::SUCCESS),
            );
            if current < total {
                ui.painter().rect_filled(
                    egui::Rect::from_min_max(
                        egui::pos2(rect.left() + split + 2.0, rect.top()),
                        rect.right_bottom(),
                    ),
                    radius,
                    theme::readable_color(theme::SEVERITY_MEDIUM),
                );
            }
        }
    }
    ui.add_space(theme::SPACE_XS);
    ui.horizontal(|ui| {
        for (label, count, color) in [
            ("À jour", current, theme::SUCCESS),
            ("En retard", total - current, theme::SEVERITY_MEDIUM),
        ] {
            let (dot, _) = ui.allocate_exact_size(egui::vec2(10.0, 10.0), egui::Sense::hover());
            ui.painter()
                .circle_filled(dot.center(), 4.0, theme::readable_color(color));
            ui.label(
                egui::RichText::new(format!("{label} {count}"))
                    .font(theme::font_caption())
                    .color(theme::text_secondary()),
            );
            ui.add_space(theme::SPACE_SM);
        }
    });
}

/// The first packages behind their latest version, current → latest.
fn outdated_list(ui: &mut Ui, packages: &[crate::dto::GuiSoftwarePackage]) {
    software_column_title(ui, icons::ARROW_UP, "À mettre à jour");
    let outdated: Vec<_> = packages.iter().filter(|p| !p.up_to_date).collect();
    if outdated.is_empty() {
        ui.label(
            egui::RichText::new("Tous les paquets sont à jour.")
                .font(theme::font_caption())
                .color(theme::text_tertiary()),
        );
        return;
    }
    const SHOWN: usize = 4;
    for package in outdated.iter().take(SHOWN) {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(&package.name)
                    .font(theme::font_body())
                    .color(theme::text_primary()),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if let Some(latest) = &package.latest_version {
                    ui.label(
                        egui::RichText::new(latest)
                            .font(theme::font_mono_sm())
                            .color(theme::readable_color(theme::SUCCESS)),
                    );
                    ui.label(
                        egui::RichText::new("→")
                            .font(theme::font_caption())
                            .color(theme::text_tertiary()),
                    );
                }
                ui.label(
                    egui::RichText::new(&package.version)
                        .font(theme::font_mono_sm())
                        .color(theme::text_secondary()),
                );
            });
        });
    }
    if outdated.len() > SHOWN {
        ui.label(
            egui::RichText::new(format!(
                "+ {} autres dans la liste ci-dessous",
                outdated.len() - SHOWN
            ))
            .font(theme::font_caption())
            .color(theme::text_tertiary()),
        );
    }
}

fn platform_upgrade_command(safe_name: &str) -> String {
    #[cfg(target_os = "macos")]
    {
        format!("brew upgrade '{}'", safe_name)
    }
    #[cfg(target_os = "linux")]
    {
        format!(
            "sudo apt upgrade '{}' || sudo dnf upgrade '{}'",
            safe_name, safe_name
        )
    }
    #[cfg(target_os = "windows")]
    {
        format!("winget upgrade '{}'", safe_name)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        format!("# Mettez a jour '{}' manuellement", safe_name)
    }
}

/// Indices of the extensions matching the search (name, identifier, browser,
/// user or profile), in inventory order: widest reach first.
fn filtered_extensions(
    extensions: &[crate::dto::GuiBrowserExtension],
    search_upper: &str,
) -> Vec<usize> {
    extensions
        .iter()
        .enumerate()
        .filter(|(_, e)| {
            search_upper.is_empty()
                || [&e.name, &e.id, &e.browser, &e.user, &e.profile]
                    .iter()
                    .any(|field| field.to_uppercase().contains(search_upper))
        })
        .map(|(index, _)| index)
        .collect()
}

fn reach_display(reach: crate::dto::Severity) -> (&'static str, egui::Color32) {
    match reach {
        crate::dto::Severity::Critical | crate::dto::Severity::High => {
            ("\u{00c9}TENDUE", theme::SEVERITY_HIGH)
        }
        crate::dto::Severity::Medium => ("MOD\u{00c9}R\u{00c9}E", theme::SEVERITY_MEDIUM),
        crate::dto::Severity::Low | crate::dto::Severity::Info => {
            ("LIMIT\u{00c9}E", theme::text_tertiary())
        }
    }
}

#[cfg(test)]
mod extension_tests {
    use super::*;
    use crate::dto::{GuiBrowserExtension, Severity};

    fn extension(name: &str, browser: &str, user: &str) -> GuiBrowserExtension {
        GuiBrowserExtension {
            browser: browser.to_string(),
            user: user.to_string(),
            profile: "Default".to_string(),
            id: format!("id-{name}"),
            name: name.to_string(),
            version: "1.0".to_string(),
            reach: Severity::Low,
            reasons: Vec::new(),
            enabled: None,
            from_store: true,
        }
    }

    #[test]
    fn search_matches_name_browser_user_and_identifier() {
        let extensions = vec![
            extension("uBlock Origin", "Firefox", "alice"),
            extension("Coupon Helper", "Chrome", "bob"),
        ];
        assert_eq!(filtered_extensions(&extensions, ""), [0, 1]);
        assert_eq!(filtered_extensions(&extensions, "UBLOCK"), [0]);
        assert_eq!(filtered_extensions(&extensions, "CHROME"), [1]);
        assert_eq!(filtered_extensions(&extensions, "BOB"), [1]);
        assert_eq!(filtered_extensions(&extensions, "ID-COUPON"), [1]);
        assert!(filtered_extensions(&extensions, "SAFARI").is_empty());
    }

    #[test]
    fn reach_is_named_as_a_capability() {
        assert_eq!(reach_display(Severity::High).0, "ÉTENDUE");
        assert_eq!(reach_display(Severity::Medium).0, "MODÉRÉE");
        assert_eq!(reach_display(Severity::Low).0, "LIMITÉE");
    }
}
