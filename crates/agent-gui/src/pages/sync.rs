//! Sync page -- synchronization status and history.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SyncPage;

impl SyncPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Synchronisation"],
            "Synchronisation",
            Some(
                "Gestion de la connectivit\u{00e9} et transfert de donn\u{00e9}es avec le serveur",
            ),
            Some(
                "Gérez la synchronisation des données avec le serveur Sentinel central. Vérifiez l'état de la connexion et forcez une mise à jour manuelle des politiques et référentiels.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Status card
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("\u{00c9}TAT DE LA CONNEXION")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if state.sync.in_progress {
                            widgets::status_badge(
                                ui,
                                &format!("{} SYNCHRONISATION...", icons::SYNC),
                                theme::INFO,
                            );
                        } else if state.summary.pending_sync_count > 0 {
                            widgets::status_badge(
                                ui,
                                &format!(
                                    "{} {} EN ATTENTE",
                                    icons::ARROW_UP,
                                    state.summary.pending_sync_count
                                ),
                                theme::WARNING,
                            );
                        } else {
                            widgets::status_badge(
                                ui,
                                &format!("{} \u{00c0} JOUR", icons::CHECK),
                                theme::SUCCESS,
                            );
                        }
                    },
                );
            });

            ui.add_space(theme::SPACE_MD);

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.vertical(|ui: &mut egui::Ui| {
                    if let Some(ref ts) = state.summary.last_sync_at {
                        ui.label(
                            egui::RichText::new("Derni\u{00e8}re synchronisation r\u{00e9}ussie :")
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                        ui.label(
                            egui::RichText::new(
                                ts.format("%d/%m/%Y \u{00e0} %H:%M:%S").to_string(),
                            )
                            .font(theme::font_body())
                            .color(theme::text_primary())
                            .strong(),
                        );
                    } else {
                        ui.label(
                            egui::RichText::new("Aucune synchronisation effectu\u{00e9}e")
                                .color(theme::text_tertiary()),
                        );
                    }
                });

                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        // Force sync button
                        if widgets::primary_button_loading(
                            ui,
                            format!("{}  SYNCHRONISER MAINTENANT", icons::SYNC),
                            !state.sync.in_progress,
                            state.sync.in_progress,
                        )
                        .clicked()
                        {
                            command = Some(GuiCommand::ForceSync);
                        }
                    },
                );
            });

            if let Some(ref err) = state.sync.error {
                ui.add_space(theme::SPACE_MD);
                egui::Frame::new()
                    .fill(theme::ERROR.linear_multiply(theme::OPACITY_SUBTLE))
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_SM))
                    .inner_margin(egui::Margin::symmetric(theme::SPACE_SM as i8, theme::SPACE_XS as i8))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} ERREUR : {}", icons::WARNING, err))
                                .font(theme::font_small())
                                .color(theme::ERROR),
                        );
                    });
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Sync history
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("HISTORIQUE DES TRANSFERTS")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.sync.history.is_empty() {
                crate::widgets::empty_state_compact(
                    ui,
                    icons::CLOUD_ARROW_UP,
                    "Aucun historique disponible",
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(32.0).at_least(24.0)) // Status icon
                    .column(Column::initial(80.0).at_least(60.0)) // Time
                    .column(Column::remainder()); // Message

                table
                    .header(24.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.strong("");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.strong("HEURE");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.strong("MESSAGE");
                        });
                    })
                    .body(|body| {
                        body.rows(32.0, state.sync.history.len(), |mut row| {
                            let entry = &state.sync.history[row.index()];

                            row.col(|ui: &mut egui::Ui| {
                                let (icon, color) = if entry.success {
                                    (icons::CIRCLE_CHECK, theme::SUCCESS)
                                } else {
                                    (icons::CIRCLE_XMARK, theme::ERROR)
                                };
                                ui.label(egui::RichText::new(icon).size(18.0).color(color));
                            });

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(
                                        entry.timestamp.format("%H:%M:%S").to_string(),
                                    )
                                    .font(theme::font_mono())
                                    .color(theme::text_tertiary()),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&entry.message)
                                        .font(theme::font_body())
                                        .color(theme::text_primary()),
                                );
                            });
                        });
                    });
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }
}
