// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

        if state.summary.standalone {
            ui.add_space(theme::SPACE_MD);
            widgets::page_header_nav(
                ui,
                &["Syst\u{00e8}me", "Synchronisation"],
                "Synchronisation",
                Some("Aucune plateforme : ce poste est prot\u{00e9}g\u{00e9} en autonomie."),
                None,
            );
            ui.add_space(theme::SPACE_LG);
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::hero_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "Mode autonome",
                    "Les analyses, alertes et journaux restent sur ce poste. Rien n'est \
                     transmis, rien n'est \u{00e0} synchroniser.",
                    theme::SUCCESS,
                );
                ui.vertical_centered(|ui: &mut egui::Ui| {
                    if widgets::secondary_button(
                        ui,
                        format!("{}  Connecter \u{00e0} une plateforme", icons::LINK),
                        true,
                    )
                    .clicked()
                    {
                        command = Some(GuiCommand::ConnectToPlatform);
                    }
                    ui.add_space(theme::SPACE_SM);
                });
            });
            return command;
        }

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Système", "Synchronisation"],
            "Synchronisation",
            Some(
                "Gestion de la connectivit\u{00e9} et transfert de donn\u{00e9}es avec le serveur.",
            ),
            Some(
                "Gérez la synchronisation des données avec le serveur Sentinel central. Vérifiez l'état de la connexion et forcez une mise à jour manuelle des politiques et référentiels.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Status card: the state, three health figures, the recent run of
        // transfers, then the action. It used to be one date and a button.
        widgets::data_card(ui, "État de la synchronisation", |ui: &mut egui::Ui| {
            let (state_label, state_color) = if state.sync.in_progress {
                ("Synchronisation en cours", theme::INFO)
            } else if state.sync.error.is_some() {
                ("Dernier transfert en échec", theme::ERROR)
            } else if state.summary.pending_sync_count > 0 {
                ("Éléments en attente d'envoi", theme::SEVERITY_MEDIUM)
            } else {
                ("À jour avec la plateforme", theme::SUCCESS)
            };
            ui.horizontal(|ui: &mut egui::Ui| {
                widgets::icon_tile(ui, icons::CLOUD_ARROW_UP, state_color, 40.0);
                ui.add_space(theme::SPACE_SM);
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new("ÉTAT DE LA CONNEXION")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .extra_letter_spacing(theme::TRACKING_NORMAL)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new(state_label)
                            .font(theme::font_h3())
                            .color(theme::readable_color(state_color)),
                    );
                });
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if widgets::primary_button_loading(
                            ui,
                            format!("{}  Synchroniser maintenant", icons::SYNC),
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

            ui.add_space(theme::SPACE_MD);
            let history = &state.sync.history;
            let successes = history.iter().filter(|h| h.success).count();
            let last_sync = state
                .summary
                .last_sync_at
                .map(|at| crate::format::ago(chrono::Utc::now(), at))
                .unwrap_or_else(|| "jamais".to_owned());
            let pending = state.summary.pending_sync_count;
            let rate = if history.is_empty() {
                "—".to_owned()
            } else {
                crate::format::pct(successes as f32 / history.len() as f32 * 100.0, 0)
            };
            let figures = [
                ("DERNIÈRE SYNCHRONISATION", last_sync, theme::text_primary()),
                (
                    "EN ATTENTE D'ENVOI",
                    crate::format::int(pending),
                    if pending > 0 {
                        theme::readable_color(theme::SEVERITY_MEDIUM)
                    } else {
                        theme::text_primary()
                    },
                ),
                (
                    "TRANSFERTS RÉUSSIS",
                    rate,
                    if successes == history.len() {
                        theme::readable_color(theme::SUCCESS)
                    } else {
                        theme::readable_color(theme::SEVERITY_MEDIUM)
                    },
                ),
            ];
            widgets::ResponsiveGrid::new(180.0, theme::SPACE_SM).show(
                ui,
                &figures,
                |ui, width, (label, value, color)| {
                    egui::Frame::new()
                        .fill(theme::bg_tertiary())
                        .corner_radius(theme::ROUNDING_MD)
                        .inner_margin(theme::SPACE_MD)
                        .show(ui, |ui| {
                            ui.set_width(width - theme::SPACE_MD * 2.0);
                            ui.label(
                                egui::RichText::new(*label)
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary()),
                            );
                            ui.label(
                                egui::RichText::new(value.as_str())
                                    .font(theme::font_h3())
                                    .color(*color),
                            );
                        });
                },
            );

            if !history.is_empty() {
                ui.add_space(theme::SPACE_MD);
                transfer_strip(ui, history);
            }

            if let Some(ref err) = state.sync.error {
                ui.add_space(theme::SPACE_MD);
                egui::Frame::new()
                    .fill(theme::tinted_surface(theme::ERROR))
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_SM))
                    .inner_margin(egui::Margin::symmetric(
                        theme::SPACE_SM as i8,
                        theme::SPACE_XS as i8,
                    ))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} Erreur : {}", icons::WARNING, err))
                                .font(theme::font_small())
                                .color(theme::readable_color(theme::ERROR)),
                        );
                    });
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Sync history
        widgets::data_card(ui, "Historique des transferts", |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("HISTORIQUE DES TRANSFERTS")
                    .font(theme::font_small())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
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
                use widgets::table;

                table::fluid(
                    ui,
                    &[
                        table::Col::fixed(32.0),       // Icône d'état
                        table::Col::fluid(80.0, 0.0),  // Heure
                        table::Col::fluid(200.0, 1.0), // Message
                    ],
                )
                .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                    header.col(|_| {});
                    header.col(|ui| {
                        table::header_cell(ui, "HEURE");
                    });
                    header.col(|ui| {
                        table::header_cell(ui, "MESSAGE");
                    });
                })
                .body(|body| {
                    body.rows(
                        theme::TABLE_ROW_HEIGHT,
                        state.sync.history.len(),
                        |mut row| {
                            let Some(entry) = state.sync.history.get(row.index()) else {
                                return;
                            };

                            row.col(|ui| {
                                let (icon, color) = if entry.success {
                                    (icons::CIRCLE_CHECK, theme::SUCCESS)
                                } else {
                                    (icons::CIRCLE_XMARK, theme::ERROR)
                                };
                                ui.label(
                                    egui::RichText::new(icon)
                                        .size(theme::ICON_SM + theme::BORDER_THICK)
                                        .color(color),
                                );
                            });

                            row.col(|ui| {
                                table::cell_mono_muted(
                                    ui,
                                    &entry.timestamp.format("%H:%M:%S").to_string(),
                                );
                            });

                            row.col(|ui| {
                                table::cell(ui, &entry.message);
                            });
                        },
                    );
                });
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }
}

/// The recent transfers, oldest to newest, as a strip of green and red
/// ticks with their time on hover.
fn transfer_strip(
    ui: &mut Ui,
    history: &std::collections::VecDeque<crate::state::SyncHistoryEntry>,
) {
    ui.label(
        egui::RichText::new("TRANSFERTS RÉCENTS")
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
    ui.add_space(theme::SPACE_XS);
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;
        // History is newest first; the strip reads left to right in time.
        for entry in history.iter().take(40).rev() {
            let color = if entry.success {
                theme::SUCCESS
            } else {
                theme::ERROR
            };
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(10.0, 24.0), egui::Sense::hover());
            ui.painter()
                .rect_filled(rect, 3.0, theme::readable_color(color));
            response.on_hover_text(format!(
                "{} · {}",
                entry
                    .timestamp
                    .with_timezone(&chrono::Local)
                    .format("%d/%m %H:%M"),
                entry.message
            ));
        }
    });
}
