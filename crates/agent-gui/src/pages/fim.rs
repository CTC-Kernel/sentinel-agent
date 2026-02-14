//! File Integrity Monitoring page -- FIM alerts and acknowledgments.

use egui::Ui;

use crate::app::AppState;
use crate::dto::FimChangeType;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct FimPage;

impl FimPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        let _ = widgets::page_header_nav(
            ui,
            &["Sys & Network", "FIM"],
            "Surveillance d'Intégrité",
            Some("DÉTECTION DES MODIFICATIONS FICHiers SYSTÈMES CRITIQUES"),
            Some(
                "Surveillance en temps réel des modifications de fichiers critiques. Chaque événement est horodaté et classé par type pour une analyse forensique complète.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Summary cards (AAA Grade) ───────────────────────────────────
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                let card_gap = theme::SPACE_SM;
                let card_w = ((ui.available_width() - card_gap * 3.0) / 4.0).max(0.0);
                ui.spacing_mut().item_spacing.x = card_gap;

                Self::summary_card(
                    ui,
                    card_w,
                    "FICHIERS SURVEILLÉS",
                    &state.fim.monitored_count.to_string(),
                    theme::INFO,
                    icons::FILE_SHIELD,
                );
                Self::summary_card(
                    ui,
                    card_w,
                    "MODIFICATIONS AUJOURD'HUI",
                    &state.fim.changes_today.to_string(),
                    theme::WARNING,
                    icons::PENCIL,
                );
                Self::summary_card(
                    ui,
                    card_w,
                    "ALERTEs ACTIVES",
                    &state.fim.alerts.len().to_string(),
                    theme::ERROR,
                    icons::WARNING,
                );
                Self::summary_card(
                    ui,
                    card_w,
                    "NON ACQUITTÉES",
                    &state
                        .fim
                        .alerts
                        .iter()
                        .filter(|a| !a.acknowledged)
                        .count()
                        .to_string(),
                    theme::ACCENT,
                    icons::CLOCK,
                );
            });
        });

        ui.add_space(theme::SPACE_XL);

        // ── Alerts table (AAA Grade) ─────────────────────────────────────
        if state.fim.alerts.is_empty() {
            widgets::empty_state(
                ui,
                icons::FILE_SHIELD,
                "AUCUNE ALERTE FIM",
                Some("Aucune modification de fichier critique détectée. La surveillance est active et fonctionnelle."),
            );
            ui.add_space(theme::SPACE_XL);
        } else {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new("ALERTES FIM RÉCENTES")
                            .font(theme::font_label())
                            .color(theme::text_secondary())
                            .extra_letter_spacing(0.5)
                            .strong(),
                    );
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            if widgets::chip_button(ui, "EXPORT CSV", false, theme::INFO)
                                .clicked()
                            {
                                let all_indices: Vec<usize> = (0..state.fim.alerts.len()).collect();
                                Self::export_events_csv(state, &all_indices);
                            }
                        },
                    );
                });

                ui.add_space(theme::SPACE_MD);

                // Collect ack commands before the table (borrow-safe)
                let alert_ids: Vec<String> = state.fim.alerts.iter().map(|a| a.id.clone()).collect();
                let alert_acked: Vec<bool> = state.fim.alerts.iter().map(|a| a.acknowledged).collect();
                let admin_unlocked = state.security.admin_unlocked;
                let mut ack_command = None;

                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(110.0).at_least(80.0))  // Type
                    .column(Column::remainder())                     // Path
                    .column(Column::initial(140.0).at_least(100.0)) // Date
                    .column(Column::initial(140.0).at_least(120.0)); // Status/Action

                table
                    .header(28.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("TYPE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CHEMIN")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("DATE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("STATUT")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(theme::TABLE_ROW_HEIGHT, state.fim.alerts.len(), |mut row| {
                            let idx = row.index();
                            let alert = &state.fim.alerts[idx];

                            row.col(|ui: &mut egui::Ui| {
                                let (label, color) = Self::change_type_display(&alert.change_type);
                                widgets::status_badge(ui, label, color);
                            });

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&alert.path)
                                        .font(theme::font_mono())
                                        .size(12.0)
                                        .color(theme::text_primary()),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(alert.timestamp.format("%d/%m %H:%M:%S").to_string())
                                        .font(theme::font_mono())
                                        .size(11.0)
                                        .color(theme::text_tertiary()),
                                );
                            });

                            row.col(|ui: &mut egui::Ui| {
                                if alert_acked[idx] {
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "{}  ACQUITTÉ",
                                            icons::CIRCLE_CHECK
                                        ))
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                    );
                                } else if admin_unlocked {
                                    if widgets::chip_button(
                                        ui,
                                        &format!("{}  ACQUITTER", icons::CHECK),
                                        false,
                                        theme::ACCENT,
                                    )
                                    .clicked()
                                    {
                                        ack_command = Some(idx);
                                    }
                                } else {
                                    widgets::chip_button(
                                        ui,
                                        &format!("{}  ACQUITTER", icons::LOCK),
                                        false,
                                        theme::text_tertiary(),
                                    );
                                }
                            });
                        });
                    });

                // Apply acknowledgment after the table
                if let Some(idx) = ack_command {
                    let alert_id = alert_ids[idx].clone();
                    state.fim.alerts[idx].acknowledged = true;
                    command = Some(GuiCommand::AcknowledgeFimAlert { alert_id });
                }
            });
        }

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
                                    .color(color.linear_multiply(theme::OPACITY_MUTED)),
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
                let e = &state.fim.alerts[i];
                vec![
                    e.path.clone(),
                    e.change_type.to_string(),
                    e.timestamp.to_rfc3339(),
                    if e.acknowledged { "Acquitté" } else { "En attente" }.to_string(),
                ]
            })
            .collect();

        let path = crate::export::default_export_path("fim_alertes.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV FIM failed: {}", e);
                false
            }
        }
    }
}
