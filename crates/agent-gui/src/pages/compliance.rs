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
                ui.horizontal(|ui| {
                    Self::summary_card(
                        ui,
                        "TOTAL",
                        &state.policy.total_policies.to_string(),
                        theme::TEXT_PRIMARY,
                        "󰓗",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "CONFORME",
                        &state.policy.passing.to_string(),
                        theme::SUCCESS,
                        "󰄲",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "NON-CONFORME",
                        &state.policy.failing.to_string(),
                        theme::ERROR,
                        "󰅙",
                    );
                    ui.add_space(theme::SPACE_SM);
                    Self::summary_card(
                        ui,
                        "ERREURS",
                        &state.policy.errors.to_string(),
                        theme::WARNING,
                        "󰀦",
                    );
                });

                ui.add_space(theme::SPACE_LG);

                // Check results table
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                       ui.label(egui::RichText::new("R\u{00c9}SULTATS D\u{00c9}TAILL\u{00c9}S").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                       ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                           if !state.checks.is_empty() {
                               ui.label(egui::RichText::new(format!("{} contrôles", state.checks.len())).font(theme::font_small()).color(theme::TEXT_TERTIARY));
                           }
                       });
                    });
                    ui.add_space(theme::SPACE_MD);

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
                            ui.set_min_height(32.0);
                            Self::table_header_cell(ui, "V\u{00c9}RIFICATION", 240.0);
                            Self::table_header_cell(ui, "CAT\u{00c9}GORIE", 140.0);
                            Self::table_header_cell(ui, "STATUT", 110.0);
                            Self::table_header_cell(ui, "S\u{00c9}V\u{00c9}RIT\u{00c9}", 100.0);
                            Self::table_header_cell(ui, "SCORE", 60.0);
                            ui.label(egui::RichText::new("FRAMEWORKS").font(theme::font_small()).color(theme::TEXT_TERTIARY).strong());
                        });
                        ui.add_space(theme::SPACE_XS);
                        ui.separator();
                        ui.add_space(theme::SPACE_SM);

                        for check in &state.checks {
                            ui.horizontal(|ui| {
                                ui.set_min_height(40.0);

                                // Name
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(240.0, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        ui.vertical(|ui| {
                                            ui.label(
                                                egui::RichText::new(&check.name)
                                                    .font(theme::font_body())
                                                    .color(theme::TEXT_PRIMARY)
                                                    .strong(),
                                            );
                                        });
                                    },
                                );

                                // Category
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(140.0, 40.0),
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
                                    egui::Vec2::new(110.0, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        let (label, color) = Self::status_display(&check.status);
                                        widgets::status_badge(ui, label, color);
                                    },
                                );

                                // Severity
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(100.0, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
                                        let color = theme::severity_color(&check.severity);
                                        ui.horizontal(|ui| {
                                            ui.painter().circle_filled(ui.available_rect_before_wrap().min + egui::vec2(6.0, 10.0), 3.0, color);
                                            ui.add_space(14.0);
                                            ui.label(
                                                egui::RichText::new(&check.severity.to_uppercase())
                                                    .font(theme::font_small())
                                                    .color(color)
                                                    .strong(),
                                            );
                                        });
                                    },
                                );

                                // Score
                                ui.allocate_ui_with_layout(
                                    egui::Vec2::new(60.0, 40.0),
                                    egui::Layout::left_to_right(egui::Align::Center),
                                    |ui| {
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
                                    },
                                );

                                // Frameworks
                                ui.horizontal(|ui| {
                                    for fw in &check.frameworks {
                                        ui.painter().rect_filled(
                                            ui.available_rect_before_wrap().shrink2(egui::vec2(ui.available_width() - 40.0, 8.0)),
                                            egui::CornerRadius::same(4),
                                            theme::BG_ELEVATED,
                                        );
                                        ui.label(egui::RichText::new(fw).font(theme::font_small()).color(theme::TEXT_SECONDARY));
                                        ui.add_space(theme::SPACE_XS);
                                    }
                                });
                            });

                            ui.add_space(theme::SPACE_XS);
                            ui.separator();
                            ui.add_space(theme::SPACE_XS);
                        }
                    }
                });
                
                ui.add_space(theme::SPACE_XL);
            });
    }

    fn summary_card(ui: &mut Ui, label: &str, value: &str, color: egui::Color32, icon: &str) {
        widgets::card(ui, |ui| {
            ui.set_min_width(160.0);
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
    }

    fn table_header_cell(ui: &mut Ui, text: &str, width: f32) {
        ui.allocate_ui_with_layout(
            egui::Vec2::new(width, 28.0),
            egui::Layout::left_to_right(egui::Align::Center),
            |ui| {
                ui.label(
                    egui::RichText::new(text)
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY)
                        .strong(),
                );
            },
        );
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
