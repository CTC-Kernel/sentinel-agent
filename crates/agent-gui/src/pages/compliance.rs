//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiCheckStatus;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

impl CompliancePage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Conformit\u{00e9}",
                    Some("R\u{00e9}sultats des v\u{00e9}rifications de s\u{00e9}curit\u{00e9} et respect des politiques"),
                );
                ui.add_space(theme::SPACE_LG);

                // Summary cards row
                let card_gap = theme::SPACE_SM;
                let card_w = (ui.available_width() - card_gap * 3.0) / 4.0;
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = card_gap;
                    Self::summary_card(ui, card_w, "TOTAL", &state.policy.total_policies.to_string(), theme::TEXT_PRIMARY, "□");
                    Self::summary_card(ui, card_w, "CONFORME", &state.policy.passing.to_string(), theme::SUCCESS, "✓");
                    Self::summary_card(ui, card_w, "NON-CONFORME", &state.policy.failing.to_string(), theme::ERROR, "✕");
                    Self::summary_card(ui, card_w, "ERREURS", &state.policy.errors.to_string(), theme::WARNING, "▲");
                });

                ui.add_space(theme::SPACE_LG);

                // Check results table
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("RÉSULTATS DÉTAILLÉS")
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if !state.checks.is_empty() {
                                ui.label(
                                    egui::RichText::new(format!("{} contrôles", state.checks.len()))
                                        .font(theme::font_small())
                                        .color(theme::TEXT_TERTIARY),
                                );
                            }
                        });
                    });
                    ui.add_space(theme::SPACE_MD);

                    if state.checks.is_empty() {
                        widgets::empty_state(
                            ui,
                            "□",
                            "Aucune vérification effectuée",
                            Some("Lancez une analyse pour vérifier la conformité de cet appareil."),
                        );
                    } else {
                        use egui_extras::{Column, TableBuilder};

                        // Pr\u{00e9}-calculer les \u{00e9}tats d'expansion pour \u{00e9}viter d'emprunter 'ui' dans le corps de la table
                        let expanded_states: std::collections::HashMap<String, bool> = state.checks.iter()
                            .map(|check| {
                                let id = ui.make_persistent_id(&check.check_id);
                                let expanded = ui.memory(|mem| mem.data.get_temp::<bool>(id).unwrap_or(false));
                                (check.check_id.clone(), expanded)
                            })
                            .collect();

                        let table = TableBuilder::new(ui)
                            .striped(true)
                            .resizable(true)
                            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                            .column(Column::initial(180.0).range(120.0..=400.0).at_least(120.0)) // Verification
                            .column(Column::initial(120.0).at_least(80.0)) // Category
                            .column(Column::initial(120.0).at_least(80.0)) // Status
                            .column(Column::initial(100.0).at_least(70.0)) // Severity
                            .column(Column::initial(60.0).at_least(40.0)) // Score
                            .column(Column::remainder()); // Frameworks

                        table
                            .header(28.0, |mut header| {
                                header.col(|ui| {
                                    ui.strong("VÉRIFICATION");
                                });
                                header.col(|ui| {
                                    ui.strong("CATÉGORIE");
                                });
                                header.col(|ui| {
                                    ui.strong("STATUT");
                                });
                                header.col(|ui| {
                                    ui.strong("SÉVÉRITÉ");
                                });
                                header.col(|ui| {
                                    ui.strong("SCORE");
                                });
                                header.col(|ui| {
                                    ui.strong("FRAMEWORKS");
                                });
                            })
                            .body(|mut body| {
                                for check in &state.checks {
                                    let expanded = *expanded_states.get(&check.check_id).unwrap_or(&false);
                                    let row_height = if expanded { 100.0 } else { 40.0 };
                                    
                                    body.row(row_height, |mut row| {
                                        row.col(|ui| {
                                            ui.vertical(|ui| {
                                                let response = ui.label(
                                                    egui::RichText::new(&check.name)
                                                        .font(theme::font_body())
                                                        .color(theme::TEXT_PRIMARY)
                                                        .strong(),
                                                ).interact(egui::Sense::click());
                                                
                                                if response.clicked() {
                                                    let id = ui.make_persistent_id(&check.check_id);
                                                    ui.memory_mut(|mem| mem.data.insert_temp(id, !expanded));
                                                }

                                                if expanded {
                                                    ui.add_space(theme::SPACE_XS);
                                                    if let Some(msg) = &check.message {
                                                        ui.label(egui::RichText::new(msg).color(theme::TEXT_SECONDARY).font(theme::font_small()));
                                                    }
                                                    
                                                    if let Some(details) = &check.details
                                                        && let Some(issues) = details.get("issues").and_then(|i| i.as_array())
                                                    {
                                                        for issue in issues.iter() {
                                                            ui.horizontal(|ui| {
                                                                ui.label(egui::RichText::new("•").color(theme::ERROR));
                                                                ui.label(egui::RichText::new(issue.as_str().unwrap_or("Problème détecté")).color(theme::TEXT_SECONDARY).font(theme::font_small()));
                                                            });
                                                        }
                                                    }
                                                }
                                            });
                                        });

                                        row.col(|ui| {
                                            ui.label(
                                                egui::RichText::new(&check.category)
                                                    .font(theme::font_small())
                                                    .color(theme::TEXT_SECONDARY),
                                            );
                                        });

                                        row.col(|ui| {
                                            let (label, color) = Self::status_display(&check.status);
                                            widgets::status_badge(ui, label, color);
                                        });

                                        row.col(|ui| {
                                            let color = theme::severity_color(&check.severity);
                                            ui.horizontal(|ui| {
                                                ui.painter().circle_filled(ui.available_rect_before_wrap().min + egui::vec2(6.0, 10.0), 3.0, color);
                                                ui.add_space(14.0);
                                                ui.label(
                                                    egui::RichText::new(check.severity.to_uppercase())
                                                        .font(theme::font_small())
                                                        .color(color)
                                                        .strong(),
                                                );
                                            });
                                        });

                                        row.col(|ui| {
                                            if let Some(s) = check.score {
                                                ui.label(
                                                    egui::RichText::new(format!("{:.0}%", s))
                                                        .font(theme::font_body())
                                                        .color(theme::score_color(s as f32))
                                                        .strong(),
                                                );
                                            } else {
                                                ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                            }
                                        });

                                        row.col(|ui| {
                                            ui.horizontal_wrapped(|ui| {
                                                for fw in &check.frameworks {
                                                    ui.label(
                                                        egui::RichText::new(fw)
                                                            .font(theme::font_small())
                                                            .color(theme::TEXT_SECONDARY)
                                                            .background_color(theme::BG_ELEVATED),
                                                    );
                                                    ui.add_space(theme::SPACE_XS);
                                                }
                                            });
                                        });
                                    });
                                }
                            });
                    }
                });
                
                ui.add_space(theme::SPACE_XL);
            });
    }

    fn summary_card(ui: &mut Ui, width: f32, label: &str, value: &str, color: egui::Color32, icon: &str) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .size(24.0)
                                .color(color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY)
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(egui::RichText::new(icon).size(28.0).color(color.linear_multiply(0.4)));
                    });
                });
            });
        });
    }


    fn status_display(status: &GuiCheckStatus) -> (&'static str, egui::Color32) {
        match status {
            GuiCheckStatus::Pass => ("CONFORME", theme::SUCCESS),
            GuiCheckStatus::Fail => ("NON-CONFORME", theme::ERROR),
            GuiCheckStatus::Error => ("ERREUR", theme::ERROR),
            GuiCheckStatus::Skipped => ("IGNOR\u{00c9}", theme::TEXT_TERTIARY),
            GuiCheckStatus::Pending => ("EN ATTENTE", theme::WARNING),
            GuiCheckStatus::Running => ("EN COURS", theme::INFO),
        }
    }
}
