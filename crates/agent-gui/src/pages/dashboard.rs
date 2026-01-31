//! Dashboard page -- main overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, GuiCheckStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let mut command: Option<GuiCommand> = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(ui, "Tableau de bord", Some("Vue d'ensemble de la conformit\u{00e9} et de la sant\u{00e9} de l'agent"));

        ui.add_space(theme::SPACE_MD);

        // Quick action buttons
        ui.horizontal(|ui| {
            let scan_btn = egui::Button::new(
                egui::RichText::new(format!("{}  Lancer un scan", icons::PLAY))
                    .font(theme::font_body())
                    .color(theme::TEXT_ON_ACCENT)
                    .strong(),
            )
            .fill(theme::ACCENT)
            .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
            .min_size(egui::vec2(160.0, 36.0));
            if ui.add(scan_btn).clicked() {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            let sync_btn = egui::Button::new(
                egui::RichText::new(format!("{}  Forcer la synchro", icons::SYNC))
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY)
                    .strong(),
            )
            .fill(theme::BG_ELEVATED)
            .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
            .min_size(egui::vec2(180.0, 36.0));
            if ui.add(sync_btn).clicked() {
                command = Some(GuiCommand::ForceSync);
            }
        });

        ui.add_space(theme::SPACE_LG);

        // Top row: status + compliance gauge
        let total_width = ui.available_width();
        let gap = theme::SPACE;
        let left_w = (total_width - gap) * 0.6;
        let right_w = total_width - gap - left_w;
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            ui.vertical(|ui| {
            ui.set_width(left_w);
            // Status card
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("STATUT DE L'AGENT")
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                ui.horizontal(|ui| {
                    let (status_text, status_color) = match state.summary.status {
                        GuiAgentStatus::Connected => ("Connect\u{00e9}", theme::SUCCESS),
                        GuiAgentStatus::Disconnected => {
                            ("D\u{00e9}connect\u{00e9}", theme::WARNING)
                        }
                        GuiAgentStatus::Paused => ("En pause", theme::TEXT_TERTIARY),
                        GuiAgentStatus::Scanning => ("Analyse en cours", theme::INFO),
                        GuiAgentStatus::Error => ("Erreur", theme::ERROR),
                        GuiAgentStatus::Starting => ("D\u{00e9}marrage", theme::TEXT_SECONDARY),
                    };
                    widgets::status_badge(ui, status_text, status_color);
                });

                ui.add_space(theme::SPACE_MD);
                ui.separator();
                ui.add_space(theme::SPACE_MD);

                ui.vertical(|ui| {
                    Self::info_row(ui, "Version", &state.summary.version);
                    Self::info_row(ui, "H\u{00f4}te", &state.summary.hostname);
                    if let Some(ref id) = state.summary.agent_id {
                        Self::info_row(ui, "ID Agent", &id[..8.min(id.len())]);
                    }
                    if let Some(ref org) = state.summary.organization {
                        Self::info_row(ui, "Organisation", org);
                    }

                    ui.add_space(theme::SPACE_SM);
                    if let Some(ts) = state.summary.last_check_at {
                        Self::info_row(
                            ui,
                            "Derni\u{00e8}re v\u{00e9}rif.",
                            &ts.format("%d/%m/%Y %H:%M").to_string(),
                        );
                    }
                    if let Some(ts) = state.summary.last_sync_at {
                        Self::info_row(
                            ui,
                            "Derni\u{00e8}re synchro",
                            &ts.format("%d/%m/%Y %H:%M").to_string(),
                        );
                    }
                });
            });
            }); // end left vertical

            // Compliance gauge card
            ui.vertical(|ui| {
            ui.set_width(right_w);
            widgets::card(ui, |ui| {
                ui.vertical_centered(|ui| {
                    ui.label(
                        egui::RichText::new("SCORE GLOBAL")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);
                    widgets::compliance_gauge(ui, state.summary.compliance_score, 72.0);
                    ui.add_space(theme::SPACE_SM);

                    // Trending indicator
                    if let (Some(current), Some(previous)) =
                        (state.summary.compliance_score, state.previous_compliance_score)
                    {
                        let diff = current - previous;
                        if diff.abs() > 0.1 {
                            let (arrow, color) = if diff > 0.0 {
                                (icons::ARROW_UP, theme::SUCCESS)
                            } else {
                                (icons::ARROW_DOWN, theme::ERROR)
                            };
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} {:.1}% depuis le dernier scan",
                                    arrow,
                                    diff.abs()
                                ))
                                .font(theme::font_small())
                                .color(color),
                            );
                        }
                    }
                });
            });
            }); // end right vertical
        });

        ui.add_space(theme::SPACE_LG);

        // Framework compliance breakdown
        if !state.checks.is_empty() {
            let frameworks = Self::compute_framework_scores(state);
            if !frameworks.is_empty() {
                widgets::card(ui, |ui| {
                    ui.label(
                        egui::RichText::new("CONFORMIT\u{00c9} PAR FRAMEWORK")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_MD);
                    ui.horizontal_wrapped(|ui| {
                        for (fw, pass, total) in &frameworks {
                            let pct = if *total > 0 {
                                (*pass as f32 / *total as f32) * 100.0
                            } else {
                                0.0
                            };
                            let color = theme::score_color(pct);
                            ui.vertical(|ui| {
                                ui.set_width(120.0);
                                ui.label(
                                    egui::RichText::new(fw)
                                        .font(theme::font_small())
                                        .color(theme::TEXT_SECONDARY)
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(format!("{:.0}%", pct))
                                        .size(20.0)
                                        .color(color)
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(format!("{}/{}", pass, total))
                                        .font(theme::font_small())
                                        .color(theme::TEXT_TERTIARY),
                                );
                            });
                        }
                    });
                });
                ui.add_space(theme::SPACE_LG);
            }
        }

        // Resource usage + Vulnerabilities row
        let res_w = (total_width - gap) * 0.55;
        let vuln_w = total_width - gap - res_w;
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            ui.vertical(|ui| {
            ui.set_width(res_w);
            // Resource usage
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("RESSOURCES SYST\u{00c8}ME")
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                widgets::resource_bar(
                    ui,
                    "CPU",
                    &format!("{:.1}%", state.resources.cpu_percent),
                    (state.resources.cpu_percent / 100.0) as f32,
                );
                ui.add_space(theme::SPACE_MD);
                widgets::resource_bar(
                    ui,
                    "M\u{00e9}moire",
                    &format!(
                        "{:.1}% ({:.0} / {:.0} Mo)",
                        state.resources.memory_percent,
                        state.resources.memory_used_mb,
                        state.resources.memory_total_mb,
                    ),
                    (state.resources.memory_percent / 100.0) as f32,
                );
                ui.add_space(theme::SPACE_MD);
                widgets::resource_bar(
                    ui,
                    "Disque",
                    &format!("{:.1}%", state.resources.disk_percent),
                    (state.resources.disk_percent / 100.0) as f32,
                );
            });
            }); // end resource vertical

            // Vulnerability summary
            ui.vertical(|ui| {
            ui.set_width(vuln_w);
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new("VULN\u{00c9}RABILIT\u{00c9}S")
                        .font(theme::font_small())
                        .color(theme::TEXT_TERTIARY)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                if let Some(ref vuln) = state.vulnerability_summary {
                    ui.horizontal(|ui| {
                        Self::vuln_count(ui, "Critique", vuln.critical, theme::ERROR);
                        ui.add_space(theme::SPACE_LG);
                        Self::vuln_count(ui, "\u{00c9}lev\u{00e9}e", vuln.high, theme::WARNING);
                        ui.add_space(theme::SPACE_LG);
                        Self::vuln_count(ui, "Moyenne", vuln.medium, theme::INFO);
                    });

                    ui.add_space(theme::SPACE_MD);
                    ui.separator();
                    ui.add_space(theme::SPACE_SM);

                    if let Some(ts) = vuln.last_scan_at {
                        ui.horizontal(|ui| {
                            ui.label(egui::RichText::new("Dernier scan :").font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            ui.label(egui::RichText::new(ts.format("%d/%m/%Y %H:%M").to_string()).font(theme::font_small()).color(theme::TEXT_SECONDARY));
                        });
                    }
                } else {
                    ui.add_space(theme::SPACE_MD);
                    ui.vertical_centered(|ui| {
                        ui.label(egui::RichText::new("Aucun scan r\u{00e9}cent").color(theme::TEXT_TERTIARY));
                    });
                }
            });
            }); // end vuln vertical
        });

        ui.add_space(theme::SPACE_LG);

        // Notification summary (last 3)
        if !state.notifications.is_empty() {
            widgets::card(ui, |ui| {
                ui.label(
                    egui::RichText::new(format!(
                        "{}  NOTIFICATIONS R\u{00c9}CENTES",
                        icons::BELL
                    ))
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
                );
                ui.add_space(theme::SPACE_MD);

                for notif in state.notifications.iter().take(3) {
                    ui.horizontal(|ui| {
                        let sev_color = theme::severity_color(&notif.severity);
                        widgets::status_badge(ui, &notif.severity.to_uppercase(), sev_color);
                        ui.add_space(theme::SPACE_SM);
                        ui.label(
                            egui::RichText::new(&notif.title)
                                .font(theme::font_body())
                                .color(theme::TEXT_PRIMARY)
                                .strong(),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui| {
                                ui.label(
                                    egui::RichText::new(
                                        notif.timestamp.format("%H:%M").to_string(),
                                    )
                                    .font(theme::font_small())
                                    .color(theme::TEXT_TERTIARY),
                                );
                            },
                        );
                    });
                    ui.add_space(theme::SPACE_XS);
                }
            });
            ui.add_space(theme::SPACE_LG);
        }

        // Recent activity
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("ACTIVIT\u{00c9} R\u{00c9}CENTE")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.logs.is_empty() {
                ui.add_space(theme::SPACE_MD);
                ui.vertical_centered(|ui| {
                    ui.label(egui::RichText::new("Aucun log disponible").color(theme::TEXT_TERTIARY));
                });
                ui.add_space(theme::SPACE_MD);
            } else {
                for entry in state.logs.iter().take(6) {
                    ui.horizontal(|ui| {
                        let (level_text, level_color) = match entry.level.as_str() {
                            "error" => ("ERR", theme::ERROR),
                            "warn" => ("WRN", theme::WARNING),
                            "info" => ("INF", theme::INFO),
                            _ => ("LOG", theme::TEXT_TERTIARY),
                        };

                        ui.add_space(4.0);
                        ui.label(
                            egui::RichText::new(level_text)
                                .font(theme::font_mono())
                                .color(level_color)
                                .strong()
                                .background_color(level_color.linear_multiply(0.15)),
                        );

                        ui.add_space(8.0);
                        ui.label(
                            egui::RichText::new(entry.timestamp.format("%H:%M:%S").to_string())
                                .font(theme::font_mono())
                                .color(theme::TEXT_TERTIARY),
                        );

                        ui.add_space(8.0);
                        ui.label(
                            egui::RichText::new(&entry.message)
                                .font(theme::font_body())
                                .color(theme::TEXT_PRIMARY),
                        );
                    });
                    ui.add_space(theme::SPACE_XS);
                }
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn compute_framework_scores(state: &AppState) -> Vec<(String, usize, usize)> {
        use std::collections::BTreeMap;
        let mut map: BTreeMap<String, (usize, usize)> = BTreeMap::new();
        for check in &state.checks {
            for fw in &check.frameworks {
                let entry = map.entry(fw.clone()).or_insert((0, 0));
                entry.1 += 1;
                if check.status == GuiCheckStatus::Pass {
                    entry.0 += 1;
                }
            }
        }
        map.into_iter()
            .map(|(fw, (pass, total))| (fw, pass, total))
            .collect()
    }

    fn vuln_count(ui: &mut Ui, label: &str, count: u32, color: egui::Color32) {
        ui.vertical(|ui| {
            ui.label(
                egui::RichText::new(count.to_string())
                    .size(24.0)
                    .color(color)
                    .strong(),
            );
            ui.label(
                egui::RichText::new(label.to_uppercase())
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
        });
    }

    fn info_row(ui: &mut Ui, label: &str, value: &str) {
        ui.horizontal(|ui| {
            ui.set_min_height(24.0);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_body())
                    .color(theme::TEXT_SECONDARY),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(value)
                        .font(theme::font_body())
                        .color(theme::TEXT_PRIMARY)
                        .strong(),
                );
            });
        });
        ui.add_space(2.0);
    }
}
