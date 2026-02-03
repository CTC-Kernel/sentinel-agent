//! Software page -- installed software inventory with tabs.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SoftwarePage;

/// Active tab on the software page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SoftwareTab {
    Packages,
    Applications,
}

impl SoftwarePage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Logiciels",
            Some("Inventaire complet des applications install\u{00e9}es et suivi des versions"),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar
        ui.horizontal(|ui| {
            if widgets::button::primary_button(ui, format!("{}  Lancer le scan", icons::PLAY)).clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Tab bar
        let active = if state.software_active_tab == 1 {
            SoftwareTab::Applications
        } else {
            SoftwareTab::Packages
        };
        ui.horizontal(|ui| {
            if Self::tab_button(
                ui,
                &format!("{} Paquets", icons::SOFTWARE),
                active == SoftwareTab::Packages,
            ) {
                state.software_active_tab = 0;
            }
            ui.add_space(theme::SPACE_SM);
            if Self::tab_button(
                ui,
                &format!("{} Applications", icons::CUBE),
                active == SoftwareTab::Applications,
            ) {
                state.software_active_tab = 1;
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Search filter bar (shared for both tabs)
        let search_lower = state.software_search.to_lowercase();

        match active {
            SoftwareTab::Packages => Self::show_packages(ui, state, &search_lower),
            SoftwareTab::Applications => Self::show_macos_apps(ui, state, &search_lower),
        }

        ui.add_space(theme::SPACE_XL);

        command
    }

    // -- Tab: Paquets (Homebrew) --

    fn show_packages(ui: &mut Ui, state: &mut AppState, search_lower: &str) {
        // Filter
        let filtered: Vec<usize> = state
            .software_packages
            .iter()
            .enumerate()
            .filter(|(_, p)| {
                if search_lower.is_empty() {
                    return true;
                }
                let haystack = format!(
                    "{} {} {}",
                    p.name.to_lowercase(),
                    p.version.to_lowercase(),
                    p.publisher.as_deref().unwrap_or("").to_lowercase(),
                );
                haystack.contains(search_lower)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        // Summary cards
        let total = state.software_packages.len() as u32;
        let up_to_date = state
            .software_packages
            .iter()
            .filter(|p| p.up_to_date)
            .count() as u32;
        let outdated = total - up_to_date;

        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(
                ui,
                card_w,
                "TOTAL",
                &total.to_string(),
                theme::text_primary(),
                icons::CUBE,
            );
            Self::summary_card(
                ui,
                card_w,
                "\u{00c0} JOUR",
                &up_to_date.to_string(),
                theme::SUCCESS,
                icons::CIRCLE_CHECK,
            );
            Self::summary_card(
                ui,
                card_w,
                "OBSOL\u{00c8}TES",
                &outdated.to_string(),
                if outdated > 0 {
                    theme::WARNING
                } else {
                    theme::text_tertiary()
                },
                icons::ARROW_UP,
            );
        });

        ui.add_space(theme::SPACE_MD);

        widgets::SearchFilterBar::new(
            &mut state.software_search,
            "Rechercher (nom, version, \u{00e9}diteur)...",
        )
        .result_count(result_count)
        .show(ui);

        ui.add_space(theme::SPACE_SM);

        // CSV export
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_packages_csv(state, &filtered);
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        // Packages table
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("PAQUETS HOMEBREW")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::SOFTWARE,
                    "Aucun paquet correspondant",
                    Some(
                        "Modifiez votre recherche ou aucun paquet n'a \u{00e9}t\u{00e9} d\u{00e9}tect\u{00e9}.",
                    ),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(150.0).range(100.0..=400.0).at_least(100.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(120.0).at_least(100.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::remainder());

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| {
                            ui.strong("NOM DU LOGICIEL");
                        });
                        header.col(|ui| {
                            ui.strong("VERSION");
                        });
                        header.col(|ui| {
                            ui.strong("\u{00c9}DITEUR");
                        });
                        header.col(|ui| {
                            ui.strong("STATUT");
                        });
                        header.col(|ui| {
                            ui.strong("MAJ DISPONIBLE");
                        });
                    })
                    .body(|body| {
                        body.rows(40.0, filtered.len(), |mut row| {
                            let pkg = &state.software_packages[filtered[row.index()]];
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&pkg.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&pkg.version)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui| {
                                let publisher = pkg.publisher.as_deref().unwrap_or("--");
                                ui.label(
                                    egui::RichText::new(publisher)
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui| {
                                if pkg.up_to_date {
                                    widgets::status_badge(
                                        ui,
                                        &format!("{} \u{00c0} JOUR", icons::CHECK),
                                        theme::SUCCESS.linear_multiply(0.8),
                                    );
                                } else {
                                    widgets::status_badge(
                                        ui,
                                        &format!("{} OBSOL\u{00c8}TE", icons::ARROW_UP),
                                        theme::WARNING.linear_multiply(0.8),
                                    );
                                }
                            });
                            row.col(|ui| {
                                if let Some(latest) = &pkg.latest_version {
                                    if !pkg.up_to_date {
                                        ui.label(
                                            egui::RichText::new(format!(
                                                "{} {}",
                                                icons::ARROW_RIGHT,
                                                latest
                                            ))
                                            .font(theme::font_mono())
                                            .color(theme::ACCENT_LIGHT)
                                            .strong(),
                                        );
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

    fn show_macos_apps(ui: &mut Ui, state: &mut AppState, search_lower: &str) {
        let filtered: Vec<usize> = state
            .macos_apps
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if search_lower.is_empty() {
                    return true;
                }
                let haystack = format!(
                    "{} {} {}",
                    a.name.to_lowercase(),
                    a.version.to_lowercase(),
                    a.publisher.to_lowercase(),
                );
                haystack.contains(search_lower)
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();
        let total = state.macos_apps.len() as u32;

        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(
                ui,
                card_w,
                "APPLICATIONS",
                &total.to_string(),
                theme::ACCENT,
                icons::CUBE,
            );
            Self::summary_card(
                ui,
                card_w,
                "SOURCE",
                "macOS",
                theme::text_secondary(),
                icons::SETTINGS,
            );
            Self::summary_card(
                ui,
                card_w,
                "R\u{00c9}PERTOIRE",
                "/Applications",
                theme::text_secondary(),
                icons::DATABASE,
            );
        });

        ui.add_space(theme::SPACE_MD);

        widgets::SearchFilterBar::new(
            &mut state.software_search,
            "Rechercher (nom, version, \u{00e9}diteur)...",
        )
        .result_count(result_count)
        .show(ui);

        ui.add_space(theme::SPACE_SM);

        // CSV export
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_apps_csv(state, &filtered);
                }
            });
        });

        ui.add_space(theme::SPACE_SM);

        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("APPLICATIONS macOS")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::CUBE,
                    "Aucune application correspondante",
                    Some("Modifiez votre recherche."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(180.0).range(120.0..=400.0).at_least(120.0))
                    .column(Column::initial(90.0).at_least(70.0))
                    .column(Column::initial(200.0).at_least(140.0))
                    .column(Column::remainder());

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| {
                            ui.strong("APPLICATION");
                        });
                        header.col(|ui| {
                            ui.strong("VERSION");
                        });
                        header.col(|ui| {
                            ui.strong("BUNDLE ID");
                        });
                        header.col(|ui| {
                            ui.strong("\u{00c9}DITEUR");
                        });
                    })
                    .body(|body| {
                        body.rows(36.0, filtered.len(), |mut row| {
                            let app = &state.macos_apps[filtered[row.index()]];
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&app.name)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&app.version)
                                        .font(theme::font_mono())
                                        .color(theme::text_secondary()),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&app.bundle_id)
                                        .font(theme::font_mono())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui| {
                                let pub_text = if app.publisher.len() > 50 {
                                    format!("{}...", &app.publisher[..47])
                                } else {
                                    app.publisher.clone()
                                };
                                ui.label(
                                    egui::RichText::new(pub_text)
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                );
                            });
                        });
                    });
            }
        });
    }

    // -- CSV export helpers --

    fn export_packages_csv(state: &AppState, indices: &[usize]) {
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
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }

    fn export_apps_csv(state: &AppState, indices: &[usize]) {
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
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }

    // -- Shared helpers --

    fn tab_button(ui: &mut Ui, label: &str, active: bool) -> bool {
        let text_color = if active {
            theme::text_on_accent()
        } else {
            theme::text_secondary()
        };
        let bg = if active {
            theme::ACCENT
        } else {
            theme::bg_elevated()
        };
        let btn = egui::Button::new(
            egui::RichText::new(label)
                .font(theme::font_body())
                .color(text_color)
                .strong(),
        )
        .fill(bg)
        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
        .min_size(egui::vec2(140.0, 36.0));
        ui.add(btn).clicked()
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new(value).size(24.0).color(color).strong());
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }
}
