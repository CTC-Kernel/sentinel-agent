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

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Pilotage", "Logiciels"],
            "Inventaire Logiciel",
            Some("CATALOGUE DES APPLICATIONS ET COMPOSANTS SYSTÈME INSTALLÉS SUR L'HÔTE"),
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
                    if is_scanning {
                        "SCAN EN COURS"
                    } else {
                        "ACTUALISER L'INVENTAIRE"
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

        // Tab bar (AAA Grade)
        let active = state.software.active_tab;
        ui.horizontal(|ui: &mut egui::Ui| {
            if Self::tab_button(
                ui,
                &format!("{} DÉPENDANCES ET PAQUETS", icons::SOFTWARE),
                active == SoftwareTab::Packages,
            ) {
                state.software.active_tab = SoftwareTab::Packages;
            }
            ui.add_space(theme::SPACE_SM);
            if Self::tab_button(
                ui,
                &format!("{} APPLICATIONS UTILISATEUR", icons::CUBE),
                active == SoftwareTab::Applications,
            ) {
                state.software.active_tab = SoftwareTab::Applications;
            }
        });

        ui.add_space(theme::SPACE_LG);

        let search_id = ui.id().with("software_search_cache");
        let search_upper: String = ui.memory(|mem| {
            mem.data.get_temp::<(String, String)>(search_id)
                .filter(|(orig, _)| orig == &state.software.search)
                .map(|(_, upper)| upper)
        }).unwrap_or_else(|| {
            let upper = state.software.search.to_uppercase();
            ui.memory_mut(|mem| mem.data.insert_temp(search_id, (state.software.search.clone(), upper.clone())));
            upper
        });

        match active {
            SoftwareTab::Packages => Self::show_packages(ui, state, &search_upper, &mut command),
            SoftwareTab::Applications => Self::show_macos_apps(ui, state, &search_upper, &mut command),
        }

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.software.selected_package {
            match state.software.active_tab {
                SoftwareTab::Packages => {
                    if sel_idx < state.software.packages.len() {
                        let pkg = state.software.packages[sel_idx].clone();
                        let actions = vec![
                            widgets::DetailAction::primary("Mettre \u{00e0} jour", icons::DOWNLOAD)
                                .enabled(!pkg.up_to_date),
                            widgets::DetailAction::secondary("D\u{00e9}tails", icons::INFO),
                        ];

                        let drawer_action = widgets::DetailDrawer::new("software_pkg_detail", &pkg.name, icons::SOFTWARE)
                            .accent(if pkg.up_to_date { theme::SUCCESS } else { theme::WARNING })
                            .subtitle(&pkg.version)
                            .show(ui.ctx(), &mut state.software.detail_open, |ui| {
                                widgets::detail_section(ui, "LOGICIEL");
                                widgets::detail_field(ui, "Nom", &pkg.name);
                                widgets::detail_mono(ui, "Version actuelle", &pkg.version);
                                widgets::detail_field(ui, "\u{00c9}diteur", pkg.publisher.as_deref().unwrap_or("--"));
                                if let Some(ref installed) = pkg.installed_at {
                                    widgets::detail_field(ui, "Date d'installation", &installed.format("%d/%m/%Y").to_string());
                                }
                                if pkg.up_to_date {
                                    widgets::detail_field_badge(ui, "\u{00c0} jour", "OUI", theme::SUCCESS);
                                } else {
                                    widgets::detail_field_badge(ui, "\u{00c0} jour", "NON", theme::WARNING);
                                }
                                if let Some(ref latest) = pkg.latest_version {
                                    widgets::detail_mono(ui, "Derni\u{00e8}re version disponible", latest);
                                }
                            }, &actions);

                        if let Some(action_idx) = drawer_action {
                            match action_idx {
                                0 => command = Some(GuiCommand::CheckUpdate),
                                1 => {}
                                _ => {}
                            }
                        }
                    }
                }
                SoftwareTab::Applications => {
                    if sel_idx < state.software.macos_apps.len() {
                        let app = state.software.macos_apps[sel_idx].clone();
                        let actions = vec![
                            widgets::DetailAction::secondary("Ouvrir dans Finder", icons::FOLDER),
                        ];

                        let _drawer_action = widgets::DetailDrawer::new("software_app_detail", &app.name, icons::CUBE)
                            .accent(theme::ACCENT)
                            .subtitle(&app.bundle_id)
                            .show(ui.ctx(), &mut state.software.detail_open, |ui| {
                                widgets::detail_section(ui, "APPLICATION MACOS");
                                widgets::detail_field(ui, "Nom", &app.name);
                                widgets::detail_mono(ui, "Version", &app.version);
                                widgets::detail_mono(ui, "Bundle ID", &app.bundle_id);
                                widgets::detail_field(ui, "\u{00c9}diteur", &app.publisher);
                                widgets::detail_mono(ui, "Chemin", &app.path);
                            }, &actions);
                    }
                }
            }
        }

        command
    }

    // -- Tab: Paquets (Homebrew) --

    fn show_packages(ui: &mut Ui, state: &mut AppState, search_upper: &str, _command: &mut Option<GuiCommand>) {
        let filtered: Vec<usize> = state
            .software
            .packages
            .iter()
            .enumerate()
            .filter(|(_, p)| {
                if search_upper.is_empty() {
                    return true;
                }
                let haystack = format!(
                    "{} {} {}",
                    p.name.to_uppercase(),
                    p.version.to_uppercase(),
                    p.publisher.as_deref().unwrap_or("").to_uppercase(),
                );
                haystack.contains(search_upper)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

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
                        .size(14.0),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(format!(
                        "Couverture des mises \u{00e0} jour : {:.0}%",
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

        widgets::SearchFilterBar::new(
            &mut state.software.search,
            "Rechercher un paquet, une version ou un éditeur...",
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
                        let success = Self::export_packages_csv(state, &filtered);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV réussi")
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

        // Packages table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REGISTRE DES PAQUETS ET DÉPENDANCES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::SOFTWARE,
                    "AUCUNE OCCURRENCE TROUV\u{00c9}E",
                    Some("Ajustez vos crit\u{00e8}res de recherche ou actualisez l'inventaire."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let mut clicked_idx: Option<usize> = None;

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(200.0).at_least(150.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(150.0).at_least(120.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(100.0).at_least(90.0))
                    .column(Column::remainder());

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("D\u{00c9}SIGNATION")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("VERSION")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("\u{00c9}DITEUR / ORIGINE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("\u{00c9}TAT")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ACTIONS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CIBLE DE MAJ")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                            let real_idx = filtered[row.index()];
                            let pkg = &state.software.packages[real_idx];
                            row.col(|ui: &mut egui::Ui| {
                                let response = ui.vertical(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&pkg.name)
                                            .font(theme::font_body())
                                            .color(theme::text_primary())
                                            .strong(),
                                    );
                                    if let Some(ref installed) = pkg.installed_at {
                                        ui.label(
                                            egui::RichText::new(format!(
                                                "Install\u{00e9} le {}",
                                                installed.format("%d/%m/%Y")
                                            ))
                                            .font(theme::font_min())
                                            .color(theme::text_tertiary()),
                                        );
                                    }
                                }).response.interact(egui::Sense::click());
                                if response.clicked() {
                                    clicked_idx = Some(real_idx);
                                }
                                if response.hovered() {
                                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                                }
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&pkg.version)
                                        .font(theme::font_mono())
                                        .size(11.0)
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let publisher = pkg.publisher.as_deref().unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(publisher.to_uppercase())
                                        .font(theme::font_min())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                if pkg.up_to_date {
                                    widgets::status_badge(ui, "CONFORME", theme::SUCCESS);
                                } else {
                                    widgets::status_badge(ui, "OBSOL\u{00c8}TE", theme::WARNING);
                                }
                            });
                            row.col(|ui: &mut egui::Ui| {
                                if widgets::ghost_button(ui, format!("{}  D\u{00c9}TAILS", icons::EYE)).clicked() {
                                    clicked_idx = Some(real_idx);
                                }
                            });
                            row.col(|ui: &mut egui::Ui| {
                                if let Some(latest) = &pkg.latest_version {
                                    if !pkg.up_to_date {
                                        ui.horizontal(|ui: &mut egui::Ui| {
                                            ui.label(
                                                egui::RichText::new(icons::ARROW_RIGHT)
                                                    .color(theme::ACCENT)
                                                    .strong(),
                                            );
                                            ui.label(
                                                egui::RichText::new(latest)
                                                    .font(theme::font_mono())
                                                    .size(11.0)
                                                    .color(theme::ACCENT)
                                                    .strong(),
                                            );
                                        });
                                    } else {
                                        ui.label(
                                            egui::RichText::new("--").color(theme::text_tertiary()),
                                        );
                                    }
                                } else {
                                    ui.label(
                                        egui::RichText::new("--").color(theme::text_tertiary()),
                                    );
                                }
                            });
                        });
                    });

                if let Some(idx) = clicked_idx {
                    state.software.selected_package = Some(idx);
                    state.software.detail_open = true;
                }
            }
        });
    }

    // -- Tab: Applications (macOS native) --

    fn show_macos_apps(ui: &mut Ui, state: &mut AppState, search_upper: &str, _command: &mut Option<GuiCommand>) {
        let filtered: Vec<usize> = state
            .software
            .macos_apps
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if search_upper.is_empty() {
                    return true;
                }
                let haystack = format!(
                    "{} {} {}",
                    a.name.to_uppercase(),
                    a.version.to_uppercase(),
                    a.publisher.to_uppercase(),
                );
                haystack.contains(search_upper)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();
        let total = state.software.macos_apps.len() as u32;

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
                "macOS".to_string(),
                theme::text_secondary(),
                icons::SETTINGS,
            ),
            (
                "PÉRIMÈTRE D'AUDIT",
                "/Applications".to_string(),
                theme::text_secondary(),
                icons::DATABASE,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_MD);

        widgets::SearchFilterBar::new(
            &mut state.software.search,
            "Rechercher une application, un bundle ou un éditeur...",
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
                        let success = Self::export_apps_csv(state, &filtered);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV réussi")
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

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("REGISTRE DES APPLICATIONS NATIVES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::CUBE,
                    "AUCUNE ENTIT\u{00c9} IDENTIFI\u{00c9}E",
                    Some(
                        "Veuillez patienter pendant la fin de la synchronisation de l'inventaire.",
                    ),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let mut clicked_idx: Option<usize> = None;

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(200.0).range(140.0..=500.0))
                    .column(Column::initial(90.0).at_least(80.0))
                    .column(Column::initial(200.0).at_least(160.0))
                    .column(Column::remainder())
                    .column(Column::initial(100.0).at_least(90.0));

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("POINT D'ENTR\u{00c9}E")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("VERSION")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("IDENTIFIANT (BUNDLE ID)")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CERTIFICAT D'\u{00c9}DITEUR")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                            let real_idx = filtered[row.index()];
                            let app = &state.software.macos_apps[real_idx];
                            row.col(|ui: &mut egui::Ui| {
                                let response = ui.label(
                                    egui::RichText::new(&app.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                ).interact(egui::Sense::click());
                                if response.clicked() {
                                    clicked_idx = Some(real_idx);
                                }
                                if response.hovered() {
                                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                                }
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&app.version)
                                        .font(theme::font_mono())
                                        .size(11.0)
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&app.bundle_id)
                                        .font(theme::font_mono())
                                        .size(10.0)
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                let pub_text = if app.publisher.chars().count() > 64 {
                                    let truncated: String =
                                        app.publisher.chars().take(61).collect();
                                    format!("{}...", truncated)
                                } else {
                                    app.publisher.clone()
                                };
                                ui.label(
                                    egui::RichText::new(pub_text.to_uppercase())
                                        .font(theme::font_min())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                if widgets::ghost_button(ui, format!("{}  D\u{00c9}TAILS", icons::EYE)).clicked() {
                                    clicked_idx = Some(real_idx);
                                }
                            });
                        });
                    });

                if let Some(idx) = clicked_idx {
                    state.software.selected_package = Some(idx);
                    state.software.detail_open = true;
                }
            }
        });
    }

    // -- CSV export helpers --

    fn export_packages_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["nom", "version", "editeur", "a_jour", "derniere_version"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let p = &state.software.packages[i];
                vec![
                    p.name.clone(),
                    p.version.clone(),
                    p.publisher.clone().unwrap_or_default(),
                    if p.up_to_date { "Oui" } else { "Non" }.to_string(),
                    p.latest_version.clone().unwrap_or_default(),
                ]
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

    fn export_apps_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["nom", "version", "bundle_id", "editeur", "chemin"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let a = &state.software.macos_apps[i];
                vec![
                    a.name.clone(),
                    a.version.clone(),
                    a.bundle_id.clone(),
                    a.publisher.clone(),
                    a.path.clone(),
                ]
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
                                .extra_letter_spacing(0.5)
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
