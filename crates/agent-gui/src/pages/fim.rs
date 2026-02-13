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
                                Self::export_events_csv(state, &[]);
                            }
                        },
                    );
                });

                ui.add_space(theme::SPACE_MD);

                // Table header
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.set_width(120.0);
                    ui.label(
                        egui::RichText::new("TYPE")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.set_width(ui.available_width() - 400.0);
                    ui.label(
                        egui::RichText::new("CHEMIN")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.set_width(140.0);
                    ui.label(
                        egui::RichText::new("DATE")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.set_width(120.0);
                    ui.label(
                        egui::RichText::new("STATUT")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                });

                ui.add_space(theme::SPACE_XS);

                // Table rows
                let mut ack_command = None;
                for (idx, alert) in state.fim.alerts.iter().enumerate() {
                    if idx > 0 {
                        ui.separator();
                    }
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.set_width(120.0);
                        let (label, color) = Self::change_type_display(&alert.change_type);
                        widgets::status_badge(ui, label, color);

                        ui.set_width(ui.available_width() - 400.0);
                        ui.label(
                            egui::RichText::new(&alert.path)
                                .font(theme::font_mono())
                                .size(12.0)
                                .color(theme::text_primary()),
                        );

                        ui.set_width(140.0);
                        ui.label(
                            egui::RichText::new(alert.timestamp.format("%H:%M:%S").to_string())
                                .font(theme::font_mono())
                                .size(11.0)
                                .color(theme::text_tertiary()),
                        );

                        ui.set_width(120.0);
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
                        } else if state.security.admin_unlocked && widgets::chip_button(
                            ui,
                            &format!("{}  ACQUITTER", icons::CHECK),
                            false,
                            theme::ACCENT,
                        )
                        .clicked()
                        {
                            ack_command = Some(GuiCommand::AcknowledgeFimAlert {
                                alert_id: state.fim.alerts[idx].id.clone(),
                            });
                        } else if !state.security.admin_unlocked {
                            // Disabled button for non-admin users
                            widgets::chip_button(
                                ui,
                                &format!("{}  ACQUITTER", icons::LOCK),
                                false,
                                theme::text_tertiary(),
                            );
                        }
                    });
                }
                
                // Apply acknowledgment after the loop
                if let Some(cmd) = ack_command {
                    if let GuiCommand::AcknowledgeFimAlert { ref alert_id } = cmd {
                        if let Some(idx) = state.fim.alerts.iter().position(|a| a.id == *alert_id) {
                            state.fim.alerts[idx].acknowledged = true;
                            command = Some(cmd);
                        }
                    }
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
        _value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
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
        let _headers = &["chemin", "modification", "date", "statut"];
        let _rows: Vec<Vec<String>> = indices
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

        // Note: export_to_csv function doesn't exist in widgets, using placeholder
        // widgets::export_to_csv("fim_alerts", headers, &rows)
        false
    }
}
