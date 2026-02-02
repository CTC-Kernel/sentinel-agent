//! Terminal Activity Monitor -- real-time view of all agent background activity.

use egui::{Color32, Ui};
use egui_extras::{Column, TableBuilder};

use crate::app::AppState;
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
    pub fn show(ui: &mut Ui, state: &mut AppState) {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Terminal",
            Some("Flux temps-r\u{00e9}el de l'activit\u{00e9} de l'agent"),
        );
        ui.add_space(theme::SPACE_LG);

        // ── Stats bar ──
        Self::stats_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // ── Filter bar ──
        Self::filter_bar(ui, state);
        ui.add_space(theme::SPACE_MD);

        // ── Terminal viewport ──
        Self::terminal_viewport(ui, state);

        ui.add_space(theme::SPACE_XL);
    }

    // ------------------------------------------------------------------
    // Stats bar
    // ------------------------------------------------------------------

    fn stats_bar(ui: &mut Ui, state: &AppState) {
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                // Uptime
                let uptime_secs = state.resources.uptime_secs;
                let hours = uptime_secs / 3600;
                let mins = (uptime_secs % 3600) / 60;
                let secs = uptime_secs % 60;
                Self::stat_item(
                    ui,
                    "Dur\u{00e9}e",
                    &format!("{:02}h {:02}m {:02}s", hours, mins, secs),
                    theme::ACCENT_LIGHT,
                );

                ui.add_space(theme::SPACE_LG);

                // Total events
                Self::stat_item(
                    ui,
                    "\u{00c9}v\u{00e9}nements",
                    &state.terminal_event_count.to_string(),
                    theme::text_primary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Events per minute (rough estimate)
                let epm = if uptime_secs > 0 {
                    (state.terminal_event_count as f64 / (uptime_secs as f64 / 60.0)) as u64
                } else {
                    0
                };
                Self::stat_item(
                    ui,
                    "\u{00c9}v./min",
                    &epm.to_string(),
                    theme::text_secondary(),
                );

                ui.add_space(theme::SPACE_LG);

                // Errors
                Self::stat_item(
                    ui,
                    "Erreurs",
                    &state.terminal_error_count.to_string(),
                    if state.terminal_error_count > 0 {
                        theme::ERROR
                    } else {
                        theme::SUCCESS
                    },
                );
            });
        });
    }

    fn stat_item(ui: &mut Ui, label: &str, value: &str, color: Color32) {
        ui.vertical(|ui| {
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
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
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Niveau :")
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);

                for (i, name) in LEVEL_NAMES.iter().enumerate() {
                    let selected = i == state.terminal_filter_level;
                    let color = level_color(name);
                    let btn_text = egui::RichText::new(*name)
                        .font(theme::font_small())
                        .strong()
                        .color(if selected {
                            theme::text_on_accent()
                        } else {
                            color
                        });

                    let btn = egui::Button::new(btn_text)
                        .fill(if selected {
                            color.linear_multiply(0.6)
                        } else {
                            theme::bg_elevated()
                        })
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));

                    if ui.add(btn).clicked() {
                        state.terminal_filter_level = i;
                    }
                    ui.add_space(2.0);
                }

                ui.add_space(theme::SPACE_MD);

                // Search field
                ui.label(
                    egui::RichText::new("Recherche :")
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_XS);
                let search_edit = egui::TextEdit::singleline(&mut state.terminal_search)
                    .desired_width(180.0)
                    .font(theme::font_mono())
                    .hint_text("filtrer...");
                ui.add(search_edit);
            });
        });
    }

    // ------------------------------------------------------------------
    // Terminal viewport
    // ------------------------------------------------------------------

    fn terminal_viewport(ui: &mut Ui, state: &mut AppState) {
        let terminal_bg = theme::bg_deep();
        let filter_level = state.terminal_filter_level;
        let search_lower = state.terminal_search.to_lowercase();

        // Collect filtered lines
        let filtered: Vec<_> = state
            .terminal_lines
            .iter()
            .filter(|e| {
                let entry_level = level_index(&e.level);
                if entry_level < filter_level {
                    return false;
                }
                if !search_lower.is_empty() {
                    let hay = format!("{} {} {}", e.level, e.target, e.message).to_lowercase();
                    if !hay.contains(&search_lower) {
                        return false;
                    }
                }
                true
            })
            .collect();

        let _line_count = filtered.len();

        egui::Frame::new()
            .fill(terminal_bg)
            .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
            .inner_margin(egui::Margin::same(12))
            .shadow(theme::premium_shadow(12, 40))
            .show(ui, |ui| {
                ui.set_min_height(380.0);

                if filtered.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_XL * 3.0);
                        ui.label(
                            egui::RichText::new("Aucun \u{00e9}v\u{00e9}nement \u{00e0} afficher")
                                .font(theme::font_body())
                                .color(theme::text_tertiary()),
                        );
                    });
                    return;
                }

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .max_scroll_height(400.0)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(100.0).at_least(80.0)) // Heure
                    .column(Column::initial(70.0).at_least(60.0)) // Niveau
                    .column(Column::initial(150.0).at_least(100.0)) // Cible
                    .column(Column::remainder()); // Message

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| {
                            ui.strong("HEURE");
                        });
                        header.col(|ui| {
                            ui.strong("NIVEAU");
                        });
                        header.col(|ui| {
                            ui.strong("CIBLE");
                        });
                        header.col(|ui| {
                            ui.strong("MESSAGE");
                        });
                    })
                    .body(|body| {
                        body.rows(24.0, filtered.len(), |mut row| {
                            let entry = filtered[row.index()];
                            let ts = entry.timestamp.format("%H:%M:%S%.3f").to_string();
                            let color = level_color(&entry.level);
                            let target_short = shorten_target(&entry.target);

                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&ts)
                                        .font(theme::font_mono())
                                        .color(theme::text_tertiary()),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(format!("{:5}", entry.level))
                                        .font(theme::font_mono())
                                        .color(color)
                                        .strong(),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(target_short)
                                        .font(theme::font_mono())
                                        .color(theme::ACCENT_LIGHT.linear_multiply(0.6)),
                                );
                            });
                            row.col(|ui| {
                                ui.label(
                                    egui::RichText::new(&entry.message)
                                        .font(theme::font_mono())
                                        .color(theme::text_primary()),
                                );
                            });
                        });
                    });
            });
    }
}

/// Shorten a module target path for display.
/// e.g. "agent_core::api_client" -> "api_client"
fn shorten_target(target: &str) -> &str {
    target.rsplit("::").next().unwrap_or(target)
}
