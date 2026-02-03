//! Dashboard page -- main overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Tableau de bord",
            Some("Vue d'ensemble de la conformit\u{00e9} et de la sant\u{00e9} de l'agent"),
        );

        ui.add_space(theme::SPACE_MD);

        // Quick action buttons
        ui.horizontal(|ui| {
            if widgets::button::primary_button(
                ui,
                format!("{}  Lancer un scan", icons::PLAY)
            ).clicked() {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            if widgets::button::secondary_button(
                ui,
                format!("{}  Forcer la synchro", icons::SYNC)
            ).clicked() {
                command = Some(GuiCommand::ForceSync);
            }
        });

        ui.add_space(theme::SPACE_LG);

        // ── SECURITY HERO (Full Width) ──────────────────────────────────
        widgets::security_hero(ui, state);

        ui.add_space(theme::SPACE_LG);

        // ── METRICS GRID ────────────────────────────────────────────────
        let total_width = ui.available_width();
        let gap = theme::SPACE;
        let item_w = (total_width - gap * 2.0) / 3.0;

        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;

            // 1. Agent Status
            ui.vertical(|ui| {
                ui.set_width(item_w);
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("STATUT DE L'AGENT")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    let (status_text, status_color) = match state.summary.status {
                        GuiAgentStatus::Connected => ("Connect\u{00e9}", theme::SUCCESS),
                        GuiAgentStatus::Disconnected => ("D\u{00e9}connect\u{00e9}", theme::WARNING),
                        GuiAgentStatus::Paused => ("En pause", theme::text_tertiary()),
                        GuiAgentStatus::Scanning => ("Analyse...", theme::INFO),
                        GuiAgentStatus::Error => ("Erreur", theme::ERROR),
                        GuiAgentStatus::Starting => ("D\u{00e9}marrage", theme::text_secondary()),
                    };
                    widgets::status_badge(ui, status_text, status_color);

                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new(format!("H\u{00f4}te: {}", state.summary.hostname))
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                    ui.label(
                        egui::RichText::new(format!("Version: {}", state.summary.version))
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                });
            });

            // 2. Compliance Score
            ui.vertical(|ui| {
                ui.set_width(item_w);
                widgets::card(ui, |ui| {
                    ui.vertical_centered(|ui| {
                        ui.label(
                            egui::RichText::new("SCORE GLOBAL")
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_SM);
                        widgets::compliance_gauge(ui, state.summary.compliance_score, 48.0);
                    });
                });
            });

            // 3. Resource Summary
            ui.vertical(|ui| {
                ui.set_width(item_w);
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("RESSOURCES")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    widgets::resource_bar(
                        ui,
                        "CPU",
                        &format!("{:.0}%", state.resources.cpu_percent),
                        (state.resources.cpu_percent / 100.0) as f32,
                    );
                    ui.add_space(theme::SPACE_SM);
                    widgets::resource_bar(
                        ui,
                        "MEM",
                        &format!("{:.0}%", state.resources.memory_percent),
                        (state.resources.memory_percent / 100.0) as f32,
                    );
                });
            });
        });

        ui.add_space(theme::SPACE_LG);

        // ── LOWER ROW: Vulnerabilities & Activity ───────────────────────
        let half_w = (total_width - gap) / 2.0;

        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;

            // Vulnerabilities
            ui.vertical(|ui| {
                ui.set_width(half_w);
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("VULN\u{00c9}RABILIT\u{00c9}S")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);
                    if let Some(ref vuln) = state.vulnerability_summary {
                        ui.horizontal(|ui| {
                            Self::vuln_count(ui, "Critique", vuln.critical, theme::ERROR);
                            ui.add_space(theme::SPACE_MD);
                            Self::vuln_count(ui, "\u{00c9}lev\u{00e9}e", vuln.high, theme::WARNING);
                            ui.add_space(theme::SPACE_MD);
                            Self::vuln_count(ui, "Moyenne", vuln.medium, theme::INFO);
                        });
                    } else {
                        ui.label(
                            egui::RichText::new("Aucun scan r\u{00e9}cent")
                                .color(theme::text_tertiary()),
                        );
                    }
                });
            });

            // Recent Activity
            ui.vertical(|ui| {
                ui.set_width(half_w);
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("ACTIVIT\u{00c9} R\u{00c9}CENTE")
                            .font(theme::font_small())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);

                    if state.logs.is_empty() {
                        ui.label(
                            egui::RichText::new("Aucun log disponible")
                                .color(theme::text_tertiary()),
                        );
                    } else {
                        for entry in state.logs.iter().take(4) {
                            ui.horizontal(|ui| {
                                let color = match entry.level.as_str() {
                                    "error" => theme::ERROR,
                                    "warn" => theme::WARNING,
                                    _ => theme::text_secondary(),
                                };
                                ui.label(egui::RichText::new("\u{2022}").color(color));
                                ui.label(
                                    egui::RichText::new(&entry.message)
                                        .font(theme::font_small())
                                        .color(theme::text_primary()),
                                );
                            });
                        }
                    }
                });
            });
        });

        ui.add_space(theme::SPACE_XL);

        command
    }


    fn vuln_count(ui: &mut Ui, label: &str, count: u32, color: egui::Color32) {
        let (rect, _resp) = ui.allocate_exact_size(egui::Vec2::new(80.0, 70.0), egui::Sense::hover());
        
        if ui.is_rect_visible(rect) {
            // Background with subtle tint
            ui.painter().rect_filled(
                rect,
                egui::CornerRadius::same(theme::BADGE_ROUNDING),
                color.linear_multiply(0.1),
            );
            
            // Border
            ui.painter().rect_stroke(
                rect,
                egui::CornerRadius::same(theme::BADGE_ROUNDING),
                egui::Stroke::new(1.0, color.linear_multiply(0.3)),
                egui::epaint::StrokeKind::Inside,
            );
            
            // Count
            ui.painter().text(
                rect.center() - egui::Vec2::new(0.0, 8.0),
                egui::Align2::CENTER_CENTER,
                count.to_string(),
                egui::FontId::proportional(28.0),
                color,
            );
            
            // Label
            ui.painter().text(
                rect.center() + egui::Vec2::new(0.0, 14.0),
                egui::Align2::CENTER_CENTER,
                label.to_uppercase(),
                egui::FontId::proportional(10.0),
                color.linear_multiply(0.8),
            );
        }
    }

}
