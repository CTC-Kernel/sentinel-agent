//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiCheckStatus;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

impl CompliancePage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "Conformit\u{00e9}",
                Some("R\u{00e9}sultats des v\u{00e9}rifications de s\u{00e9}curit\u{00e9}"),
            );

            // Summary cards row
            ui.horizontal(|ui| {
                Self::summary_card(ui, "Total", &state.policy.total_policies.to_string(), theme::TEXT_PRIMARY);
                Self::summary_card(ui, "Conforme", &state.policy.passing.to_string(), theme::SUCCESS);
                Self::summary_card(ui, "Non-conforme", &state.policy.failing.to_string(), theme::ERROR);
                Self::summary_card(ui, "Erreurs", &state.policy.errors.to_string(), theme::WARNING);
                Self::summary_card(ui, "En attente", &state.policy.pending.to_string(), theme::TEXT_TERTIARY);
            });

            ui.add_space(theme::SPACE);

            // Filter / search
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Filtrer par statut:")
                        .font(theme::font_small())
                        .color(theme::TEXT_SECONDARY),
                );
                // Simple filter buttons could be expanded later
            });

            ui.add_space(theme::SPACE_SM);

            // Check results table
            widgets::card(ui, |ui| {
                if state.checks.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new("Aucune v\u{00e9}rification effectu\u{00e9}e")
                                .color(theme::TEXT_TERTIARY),
                        );
                        ui.add_space(theme::SPACE_LG);
                    });
                } else {
                    // Table header
                    ui.horizontal(|ui| {
                        ui.set_min_height(28.0);
                        Self::table_header_cell(ui, "V\u{00e9}rification", 200.0);
                        Self::table_header_cell(ui, "Cat\u{00e9}gorie", 120.0);
                        Self::table_header_cell(ui, "Statut", 90.0);
                        Self::table_header_cell(ui, "S\u{00e9}v\u{00e9}rit\u{00e9}", 90.0);
                        Self::table_header_cell(ui, "Score", 60.0);
                        Self::table_header_cell(ui, "Frameworks", 120.0);
                    });
                    ui.separator();

                    for check in &state.checks {
                        ui.horizontal(|ui| {
                            ui.set_min_height(32.0);

                            // Name
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(200.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&check.name)
                                            .font(theme::font_body())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Category
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(120.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&check.category)
                                            .font(theme::font_small())
                                            .color(theme::TEXT_SECONDARY),
                                    );
                                },
                            );

                            // Status badge
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(90.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let (label, color) = Self::status_display(&check.status);
                                    widgets::status_badge(ui, label, color);
                                },
                            );

                            // Severity
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(90.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(&check.severity)
                                            .font(theme::font_small())
                                            .color(theme::severity_color(&check.severity)),
                                    );
                                },
                            );

                            // Score
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(60.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    let score_text = check
                                        .score
                                        .map(|s| format!("{}%", s))
                                        .unwrap_or_else(|| "--".to_string());
                                    ui.label(
                                        egui::RichText::new(score_text)
                                            .font(theme::font_small())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                },
                            );

                            // Frameworks
                            ui.allocate_ui_with_layout(
                                egui::Vec2::new(120.0, 32.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    for fw in &check.frameworks {
                                        widgets::status_badge(ui, fw, theme::BG_ELEVATED);
                                    }
                                },
                            );
                        });

                        ui.separator();
                    }
                }
            });
        });
    }

    fn summary_card(ui: &mut Ui, label: &str, value: &str, color: egui::Color32) {
        widgets::card(ui, |ui| {
            ui.set_min_width(100.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_title())
                        .color(color)
                        .strong(),
                );
                ui.label(
                    egui::RichText::new(label)
                        .font(theme::font_small())
                        .color(theme::TEXT_SECONDARY),
                );
            });
        });
    }

    fn table_header_cell(ui: &mut Ui, text: &str, width: f32) {
        ui.allocate_ui_with_layout(
            egui::Vec2::new(width, 28.0),
            egui::Layout::left_to_right(egui::Align::Center),
            |ui| {
                ui.label(
                    egui::RichText::new(text)
                        .font(theme::font_small())
                        .color(theme::TEXT_SECONDARY)
                        .strong(),
                );
            },
        );
    }

    fn status_display(status: &GuiCheckStatus) -> (&'static str, egui::Color32) {
        match status {
            GuiCheckStatus::Pass => ("Conforme", theme::SUCCESS),
            GuiCheckStatus::Fail => ("Non-conforme", theme::ERROR),
            GuiCheckStatus::Error => ("Erreur", theme::ERROR),
            GuiCheckStatus::Skipped => ("Ignor\u{00e9}", theme::TEXT_TERTIARY),
            GuiCheckStatus::Pending => ("En attente", theme::WARNING),
            GuiCheckStatus::Running => ("En cours", theme::INFO),
        }
    }
}
