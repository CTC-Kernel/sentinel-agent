//! Terminal Activity Monitor -- real-time view of all agent background activity.

use egui::{Color32, Ui};
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
use crate::dto::LogLevel;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Level names used for filtering buttons.
const LEVEL_NAMES: &[&str] = &["TRACE", "DEBUG", "INFO", "WARN", "ERROR"];

/// Map a level string to its display colour.
fn level_color(level: &str) -> Color32 {
    match level {
        "ERROR" => theme::ERROR,
        "WARN" => theme::WARNING,
        "INFO" => theme::ACCENT_LIGHT,
        "DEBUG" => theme::text_tertiary(),
        _ => theme::text_secondary(), // TRACE & unknown
    }
}

/// Map a level string to an index (0..4).
fn level_index(level: &str) -> usize {
    match level {
        "TRACE" => 0,
        "DEBUG" => 1,
        "INFO" => 2,
        "WARN" => 3,
        "ERROR" => 4,
        _ => 0,
    }
}

pub struct TerminalPage;

impl TerminalPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Sys & Network", "Terminal"],
            "Terminal Analytique",
            Some("FLUX EN TEMPS RÉEL DES ÉVÉNEMENTS ET DE L'ACTIVITÉ DE L'AGENT"),
            Some(
                "Suivez en temps réel l'activité technique de l'agent. Ce flux bas niveau est utile pour le diagnostic et la vérification du bon fonctionnement des modules de scan et de surveillance.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        Self::export_logs_csv(state);
                    }
                },
            );
        });
        ui.add_space(theme::SPACE_MD);

        // Stats bar
        Self::stats_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // Filter bar
        Self::filter_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // Terminal viewport
        Self::terminal_viewport(ui, state);

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ------------------------------------------------------------------
    // Stats bar
    // ------------------------------------------------------------------

    fn stats_bar(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                // Uptime
                let uptime_secs = state.resources.uptime_secs;
                let hours = uptime_secs / 3600;
                let mins = (uptime_secs % 3600) / 60;
                let secs = uptime_secs % 60;
                Self::stat_item(
                    ui,
                    "DURÉE D'ACTIVITÉ",
                    &format!("{:02}h {:02}m {:02}s", hours, mins, secs),
                    theme::ACCENT_LIGHT,
                );

                ui.add_space(theme::SPACE_LG);

                // Total events
                Self::stat_item(
                    ui,
                    "ÉVÉNEMENTS GÉNÉRÉS",
                    &state.terminal.event_count.to_string(),
                    theme::text_primary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Events per minute
                let epm = if uptime_secs > 0 {
                    (state.terminal.event_count as f64 / (uptime_secs as f64 / 60.0)) as u64
                } else {
                    0
                };
                Self::stat_item(
                    ui,
                    "DÉBIT (ÉV./MIN)",
                    &epm.to_string(),
                    theme::text_tertiary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Errors
                Self::stat_item(
                    ui,
                    "ERREURS DÉTECTÉES",
                    &state.terminal.error_count.to_string(),
                    if state.terminal.error_count > 0 {
                        theme::ERROR
                    } else {
                        theme::SUCCESS
                    },
                );
            });
        });
    }

    fn stat_item(ui: &mut Ui, label: &str, value: &str, color: Color32) {
        ui.vertical(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_heading())
                    .color(color)
                    .strong(),
            );
        });
    }

    // ------------------------------------------------------------------
    // Filter bar
    // ------------------------------------------------------------------

    fn filter_bar(ui: &mut Ui, state: &mut AppState) {
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("NIVEAU D'EXPOSITION :")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong()
                        .extra_letter_spacing(0.5),
                );
                ui.add_space(theme::SPACE_SM);

                for (i, name) in LEVEL_NAMES.iter().enumerate() {
                    let level = LogLevel::from_index(i);
                    let selected = state.terminal.filter_level == level;
                    let color = level_color(name);

                    if widgets::chip_button(ui, *name, selected, color).clicked() {
                        state.terminal.filter_level = level;
                    }
                    ui.add_space(4.0);
                }

                ui.add_space(theme::SPACE_LG);

                // Search field
                ui.label(
                    egui::RichText::new("FILTRAGE ANALYTIQUE :")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong()
                        .extra_letter_spacing(0.5),
                );
                ui.add_space(theme::SPACE_XS);
                let search_edit = egui::TextEdit::singleline(&mut state.terminal.search)
                    .desired_width(200.0)
                    .margin(egui::Margin::symmetric(8, 4))
                    .font(egui::FontId::monospace(11.0))
                    .hint_text("rechercher...");
                ui.add(search_edit);
            });
        });
    }

    // ------------------------------------------------------------------
    // Terminal viewport
    // ------------------------------------------------------------------

    fn terminal_viewport(ui: &mut Ui, state: &mut AppState) {
        let terminal_bg = theme::bg_deep();
        let filter_level_index = state.terminal.filter_level.index();
        // Cache lowercase search term once instead of per-frame allocation
        let search_lower = if state.terminal.search.is_empty() {
            String::new()
        } else {
            state.terminal.search.to_lowercase()
        };

        let filtered: Vec<_> = state
            .terminal.lines
            .iter()
            .filter(|e| {
                let entry_level = level_index(&e.level);
                if entry_level < filter_level_index {
                    return false;
                }
                if !search_lower.is_empty()
                    && !e.level.to_ascii_lowercase().contains(&search_lower)
                    && !e.target.to_ascii_lowercase().contains(&search_lower)
                    && !e.message.to_ascii_lowercase().contains(&search_lower)
                {
                    return false;
                }
                true
            })
            .collect();

        egui::Frame::new()
            .fill(terminal_bg)
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(12))
            .show(ui, |ui: &mut egui::Ui| {
                ui.set_min_height(400.0);

                if filtered.is_empty() {
                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        ui.add_space(160.0);
                        ui.label(
                            egui::RichText::new("AUCUN ÉVÉNEMENT DÉTECTÉ DANS CE FLUX")
                                .font(theme::font_min())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    return;
                }

                let table = TableBuilder::new(ui)
                    .striped(false)
                    .resizable(true)
                    .max_scroll_height(400.0)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(90.0).at_least(80.0))
                    .column(Column::initial(70.0).at_least(60.0))
                    .column(Column::initial(130.0).at_least(100.0))
                    .column(Column::remainder());

                table
                    .header(28.0, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("HEURE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("NIVEAU")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("CIBLE")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                        header.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new("MESSAGE D'ACTIVITÉ")
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary())
                                    .strong()
                                    .extra_letter_spacing(0.5),
                            );
                        });
                    })
                    .body(|body| {
                        body.rows(22.0, filtered.len(), |mut row| {
                            let entry = filtered[row.index()];
                            let ts = entry.timestamp.format("%H:%M:%S%.3f").to_string();
                            let color = level_color(&entry.level);
                            let target_short = shorten_target(&entry.target);

                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&ts)
                                        .font(egui::FontId::monospace(11.0))
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&entry.level)
                                        .font(egui::FontId::monospace(10.0))
                                        .color(color)
                                        .strong(),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(target_short)
                                        .font(egui::FontId::monospace(11.0))
                                        .color(theme::ACCENT_LIGHT.linear_multiply(0.7)),
                                );
                            });
                            row.col(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&entry.message)
                                        .font(egui::FontId::monospace(11.0))
                                        .color(theme::text_primary()),
                                );
                            });
                        });
                    });
            });
    }

    fn export_logs_csv(state: &AppState) {
        let headers = &["timestamp", "level", "target", "message"];
        let rows: Vec<Vec<String>> = state
            .terminal.lines
            .iter()
            .map(|l| {
                vec![
                    l.timestamp.to_rfc3339(),
                    l.level.clone(),
                    l.target.clone(),
                    l.message.clone(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("agent_terminal_logs.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}

/// Shorten a module target path for display.
/// e.g. "agent_core::api_client" -> "api_client"
fn shorten_target(target: &str) -> &str {
    target.rsplit("::").next().unwrap_or(target)
}
