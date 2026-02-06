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
        let active = state.software_active_tab;
        ui.horizontal(|ui: &mut egui::Ui| {
            if Self::tab_button(
                ui,
                &format!("{} DÉPENDANCES ET PAQUETS", icons::SOFTWARE),
                active == SoftwareTab::Packages,
            ) {
                state.software_active_tab = SoftwareTab::Packages;
            }
            ui.add_space(theme::SPACE_SM);
            if Self::tab_button(
                ui,
                &format!("{} APPLICATIONS UTILISATEUR", icons::CUBE),
                active == SoftwareTab::Applications,
            ) {
                state.software_active_tab = SoftwareTab::Applications;
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Search filter bar (shared for both tabs)
        let search_upper = state.software_search.to_uppercase();

        match active {
            SoftwareTab::Packages => Self::show_packages(ui, state, &search_upper),
            SoftwareTab::Applications => Self::show_macos_apps(ui, state, &search_upper),
        }

        ui.add_space(theme::SPACE_XL);

        command
    }

    // -- Tab: Paquets (Homebrew) --

    fn show_packages(ui: &mut Ui, state: &mut AppState, search_upper: &str) {
        let filtered: Vec<usize> = state
            .software_packages
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
        let total = state.software_packages.len() as u32;
        let up_to_date = state
            .software_packages
            .iter()
            .filter(|p| p.up_to_date)
            .count() as u32;
        let outdated = total - up_to_date;

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

        widgets::SearchFilterBar::new(
            &mut state.software_search,
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
                    "AUCUNE OCCURRENCE TROUVÉE",
                    Some("Ajustez vos critères de recherche ou actualisez l'inventaire."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(220.0).at_least(150.0))
                    .column(Column::initial(110.0).at_least(80.0))
                    .column(Column::initial(180.0).at_least(120.0))
                    .column(Column::initial(110.0).at_least(90.0))
                    .column(Column::remainder());

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DÉSIGNATION")
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
                                egui::RichText::new("ÉDITEUR / ORIGINE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ÉTAT")
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
                            let pkg = &state.software_packages[filtered[row.index()]];
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&pkg.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
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
                                    widgets::status_badge(ui, "OBSOLÈTE", theme::WARNING);
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
            }
        });
    }

    // -- Tab: Applications (macOS native) --

    fn show_macos_apps(ui: &mut Ui, state: &mut AppState, search_upper: &str) {
        let filtered: Vec<usize> = state
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
        let total = state.macos_apps.len() as u32;

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
            &mut state.software_search,
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
                    "AUCUNE ENTITÉ IDENTIFIÉE",
                    Some(
                        "Veuillez patienter pendant la fin de la synchronisation de l'inventaire.",
                    ),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(220.0).range(140.0..=500.0)) // Application
                    .column(Column::initial(100.0).at_least(80.0)) // Version
                    .column(Column::initial(250.0).at_least(160.0)) // Bundle ID
                    .column(Column::remainder()); // Publisher

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("POINT D'ENTRÉE")
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
                                egui::RichText::new("CERTIFICAT D'ÉDITEUR")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT, filtered.len(), |mut row| {
                            let app = &state.macos_apps[filtered[row.index()]];
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&app.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
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
                                let pub_text = if app.publisher.len() > 64 {
                                    format!("{}...", &app.publisher[..61])
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
                        });
                    });
            }
        });
    }

    // -- CSV export helpers --

    fn export_packages_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["nom", "version", "editeur", "a_jour", "derniere_version"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let p = &state.software_packages[i];
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
                let a = &state.macos_apps[i];
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
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(color)
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
                                    .size(28.0)
                                    .color(color.linear_multiply(0.25)),
                            );
                        },
                    );
                });
            });
        });
    }
}
