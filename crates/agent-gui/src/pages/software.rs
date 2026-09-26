// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Software page -- installed software inventory with tabs.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
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

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    icons::PLAY,
                    if is_scanning {
                        "Analyse en cours"
                    } else {
                        "Actualiser l'inventaire"
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
        ui.add_space(theme::SPACE_MD);

        // Tab bar — the Applications tab exists on macOS and Windows only,
        // and a bar with one tab is a label pretending to be a control.
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        if state.software.active_tab == SoftwareTab::Applications {
            state.software.active_tab = SoftwareTab::Packages;
        }
        let active = state.software.active_tab;
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        {
            ui.horizontal(|ui: &mut egui::Ui| {
                if Self::tab_button(
                    ui,
                    &format!("{} Dépendances et paquets", icons::SOFTWARE),
                    active == SoftwareTab::Packages,
                ) {
                    state.software.active_tab = SoftwareTab::Packages;
                    state.software.selected_package = None;
                    state.software.detail_open = false;
                }
                ui.add_space(theme::SPACE_SM);
                if Self::tab_button(
                    ui,
                    &format!("{} APPLICATIONS UTILISATEUR", icons::CUBE),
                    active == SoftwareTab::Applications,
                ) {
                    state.software.active_tab = SoftwareTab::Applications;
                    state.software.selected_package = None;
                    state.software.detail_open = false;
                }
            });

            ui.add_space(theme::SPACE_LG);
        }

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
                                        &installed.format("%d/%m/%Y").to_string(),
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
            }
        }

        command
    }

    // -- Tab: Paquets (Homebrew) --

    fn show_packages(
        ui: &mut Ui,
        state: &mut AppState,
        search_upper: &str,
        _command: &mut Option<GuiCommand>,
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
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_MD);

        // Update coverage indicator (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            let coverage_pct = if total > 0 {
                (up_to_date as f32 / total as f32) * 100.0
            } else {
                0.0
            };
            let coverage_ratio = if total > 0 {
                up_to_date as f32 / total as f32
            } else {
                0.0
            };

            let (coverage_color, coverage_style) = if coverage_pct >= 90.0 {
                (theme::SUCCESS, widgets::ProgressStyle::Success)
            } else if coverage_pct >= 70.0 {
                (theme::WARNING, widgets::ProgressStyle::Warning)
            } else {
                (theme::ERROR, widgets::ProgressStyle::Error)
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::SHIELD_CHECK)
                        .color(coverage_color.linear_multiply(theme::OPACITY_STRONG))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(format!(
                        "Couverture des mises \u{00e0} jour : {:.0}\u{202f}%",
                        coverage_pct
                    ))
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(format!("({}/{} conformes)", up_to_date, total))
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            });
            ui.add_space(theme::SPACE_XS);
            widgets::progress_bar_styled(ui, coverage_ratio, coverage_style, None);
        });

        ui.add_space(theme::SPACE_MD);

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
        widgets::card(ui, |ui: &mut egui::Ui| {
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
                                .map(|dt| format!("Install\u{00e9} le {}", dt.format("%d/%m/%Y")))
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
                                table::cell_muted(ui, &publisher.to_uppercase());
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

        let card_grid = widgets::ResponsiveGrid::new(280.0, theme::SPACE_SM);
        let items = vec![
            (
                "APPLICATIONS UTILISATEUR",
                total.to_string(),
                theme::ACCENT,
                icons::CUBE,
            ),
            (
                "SYSTÈME EXPLOITATION",
                os_label.to_string(),
                theme::text_secondary(),
                icons::SETTINGS,
            ),
            (
                "PÉRIMÈTRE D'AUDIT",
                audit_scope.to_string(),
                theme::text_secondary(),
                icons::DATABASE,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
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

        widgets::card(ui, |ui: &mut egui::Ui| {
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
                        table::header_cell(ui, "POINT D'ENTR\u{00c9}E");
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
                        table::header_cell(ui, "CERTIFICAT D'\u{00c9}DITEUR");
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
                                table::cell_muted(ui, &app.publisher.to_uppercase());
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

    #[cfg(any(target_os = "macos", target_os = "windows"))]
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
}

/// Generate a platform-appropriate package upgrade command.
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
