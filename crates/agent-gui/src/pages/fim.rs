//! File Integrity Monitoring (FIM) page -- events and summary.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{FimChangeType, GuiAgentStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct FimPage;

impl FimPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Intégrité fichiers"],
            "Intégrité des fichiers",
            Some("SURVEILLANCE DE L’INTÉGRITÉ DES FICHIERS SYSTÈME ET DES CONFIGURATIONS"),
            Some(
                "Surveillez en temps réel les modifications apportées aux fichiers critiques et aux fichiers de configuration. Toute création, suppression ou modification de permission génère une alerte.",
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
                        "LANCER LE SCAN FIM"
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

        // Summary row (AAA Grade)
        let monitored = state.fim_monitored_count;
        let changes_today = state.fim_changes_today;
        let active_alerts = state.fim_alerts.iter().filter(|a| !a.acknowledged).count();

        let card_grid = widgets::ResponsiveGrid::new(280.0, theme::SPACE_SM);
        let items = vec![
            (
                "FICHIERS SURVEILLÉS",
                monitored.to_string(),
                theme::ACCENT,
                "\u{f15b}", // fa-file
            ),
            (
                "MODIFICATIONS /24H",
                changes_today.to_string(),
                if changes_today > 0 {
                    theme::WARNING
                } else {
                    theme::SUCCESS
                },
                icons::CLOCK,
            ),
            (
                "ALERTES ACTIVES",
                active_alerts.to_string(),
                if active_alerts > 0 {
                    theme::ERROR
                } else {
                    theme::SUCCESS
                },
                icons::WARNING,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let created_active = state.fim_filter.as_deref() == Some("created");
        let modified_active = state.fim_filter.as_deref() == Some("modified");
        let deleted_active = state.fim_filter.as_deref() == Some("deleted");
        let perm_active = state.fim_filter.as_deref() == Some("permission_changed");

        let search_lower = state.fim_search.to_lowercase();
        let filtered: Vec<usize> = state
            .fim_alerts
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                if !search_lower.is_empty() {
                    let haystack =
                        format!("{} {}", a.path.to_lowercase(), a.change_type.as_str());
                    if !haystack.contains(&search_lower) {
                        return false;
                    }
                }
                if let Some(ref filter) = state.fim_filter {
                    a.change_type.as_str() == filter.as_str()
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.fim_search,
            "RECHERCHER (CHEMIN, TYPE DE MODIFICATION)...",
        )
        .chip("CRÉÉ", created_active, theme::SUCCESS)
        .chip("MODIFIÉ", modified_active, theme::WARNING)
        .chip("SUPPRIMÉ", deleted_active, theme::ERROR)
        .chip("PERMISSIONS", perm_active, theme::INFO)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some("created"),
                1 => Some("modified"),
                2 => Some("deleted"),
                3 => Some("permission_changed"),
                _ => None,
            };
            if state.fim_filter.as_deref() == target {
                state.fim_filter = None;
            } else {
                state.fim_filter = target.map(|s| s.to_string());
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Action Buttons (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  EXPORT CSV", icons::DOWNLOAD)).clicked() {
                        let success = Self::export_events_csv(state, &filtered);
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

        // Events table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("ÉVÉNEMENTS FIM RÉCENTS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.fim_alerts.is_empty() {
                widgets::protected_state(
                    ui,
                    icons::FILE_SHIELD,
                    "INTÉGRITÉ CONFIRMÉE",
                    "Tous les fichiers critiques sont sous surveillance. Aucune anomalie détectée.",
                );
            } else if filtered.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::FILTER,
                    "AUCUN RÉSULTAT",
                    Some("Aucun événement ne correspond à vos critères de recherche."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(150.0).at_least(100.0)) // Timestamp
                    .column(Column::remainder().at_least(180.0)) // File path
                    .column(Column::initial(130.0).at_least(90.0)) // Change type
                    .column(Column::initial(110.0).at_least(80.0)); // Action

                table
                    .header(30.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("HORODATAGE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("FICHIER")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("ACTIONS")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT + 12.0, filtered.len(), |mut row| {
                            let idx = filtered[row.index()];

                            row.col(|ui: &mut egui::Ui| {
                                let ts = state.fim_alerts[idx]
                                    .timestamp
                                    .format("%d/%m/%Y %H:%M:%S")
                                    .to_string();
                                ui.label(
                                    egui::RichText::new(ts)
                                        .font(theme::font_mono())
                                        .size(11.0)
                                        .color(theme::text_secondary()),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                let path = &state.fim_alerts[idx].path;
                                let display_path = if path.len() > 60 {
                                    format!("...{}", &path[path.len() - 57..])
                                } else {
                                    path.clone()
                                };
                                ui.horizontal(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(icons::FILE)
                                            .color(theme::text_tertiary()),
                                    );
                                    ui.label(
                                        egui::RichText::new(display_path)
                                            .font(theme::font_body())
                                            .color(theme::text_primary())
                                            .strong(),
                                    )
                                    .on_hover_text(path);
                                });
                            });

                            row.col(|ui: &mut egui::Ui| {
                                let (label, color) =
                                    Self::change_type_display(&state.fim_alerts[idx].change_type);
                                widgets::status_badge(ui, label, color);
                            });

                            row.col(|ui: &mut egui::Ui| {
                                let alert = &state.fim_alerts[idx];
                                if alert.acknowledged {
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "{}  ACQUITTÉ",
                                            icons::CIRCLE_CHECK
                                        ))
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                    );
                                } else {
                                    if widgets::chip_button(ui, &format!("{}  ACQUITTER", icons::CHECK), false, theme::ACCENT).clicked() {
                                        let alert_id = state.fim_alerts[idx].id.clone();
                                        state.fim_alerts[idx].acknowledged = true;
                                        command =
                                            Some(GuiCommand::AcknowledgeFimAlert { alert_id });
                                    }
                                }
                            });
                        });
                    });
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ── Helpers ──────────────────────────────────────────────────────────

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

    fn change_type_display(change_type: &FimChangeType) -> (&'static str, egui::Color32) {
        match change_type {
            FimChangeType::Created => ("CRÉÉ", theme::SUCCESS),
            FimChangeType::Modified => ("MODIFIÉ", theme::WARNING),
            FimChangeType::Deleted => ("SUPPRIMÉ", theme::ERROR),
            FimChangeType::PermissionChanged => ("PERMISSIONS", theme::INFO),
            FimChangeType::Renamed => ("RENOMMÉ", theme::WARNING),
        }
    }

    fn export_events_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &["chemin", "modification", "date", "statut"];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let e = &state.fim_alerts[i];
                vec![
                    e.path.clone(),
                    e.change_type.to_string(),
                    e.timestamp.to_rfc3339(),
                    if e.acknowledged {
                        "Acquitté"
                    } else {
                        "Non acquitté"
                    }
                    .to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("fim_events.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
