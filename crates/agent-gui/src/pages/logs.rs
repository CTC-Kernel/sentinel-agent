//! Logs page -- recent agent activity.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct LogsPage;

impl LogsPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            widgets::page_header(
                ui,
                "Journaux",
                Some("Activit\u{00e9} r\u{00e9}cente de l'agent"),
            );

            // Controls
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("{} entr\u{00e9}es", state.logs.len()))
                            .font(theme::font_body())
                            .color(theme::TEXT_SECONDARY),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .button(
                                egui::RichText::new("Ouvrir le dossier des logs")
                                    .font(theme::font_small()),
                            )
                            .clicked()
                        {
                            Self::open_logs_folder();
                        }
                    });
                });
            });

            ui.add_space(theme::SPACE_SM);

            // Log entries
            widgets::card(ui, |ui| {
                if state.logs.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new("Aucun journal disponible")
                                .color(theme::TEXT_TERTIARY),
                        );
                        ui.add_space(theme::SPACE_LG);
                    });
                } else {
                    for entry in &state.logs {
                        ui.horizontal(|ui| {
                            // Level badge
                            let (level_text, level_color) = match entry.level.as_str() {
                                "error" => ("ERR", theme::ERROR),
                                "warn" => ("WRN", theme::WARNING),
                                "info" => ("INF", theme::INFO),
                                "debug" => ("DBG", theme::TEXT_TERTIARY),
                                _ => ("???", theme::TEXT_SECONDARY),
                            };
                            ui.label(
                                egui::RichText::new(level_text)
                                    .font(theme::font_mono())
                                    .color(level_color),
                            );

                            // Timestamp
                            ui.label(
                                egui::RichText::new(entry.timestamp.format("%H:%M:%S").to_string())
                                    .font(theme::font_mono())
                                    .color(theme::TEXT_TERTIARY),
                            );

                            // Source module
                            if let Some(ref src) = entry.source {
                                ui.label(
                                    egui::RichText::new(format!("[{}]", src))
                                        .font(theme::font_mono())
                                        .color(theme::TEXT_SECONDARY),
                                );
                            }

                            // Message
                            ui.label(
                                egui::RichText::new(&entry.message)
                                    .font(theme::font_mono())
                                    .color(theme::TEXT_PRIMARY),
                            );
                        });
                    }
                }
            });
        });
    }

    fn open_logs_folder() {
        #[cfg(target_os = "macos")]
        {
            let path = directories::BaseDirs::new()
                .map(|dirs| dirs.data_dir().join("SentinelGRC").join("logs"))
                .unwrap_or_else(|| {
                    std::path::PathBuf::from("/Library/Application Support/SentinelGRC/logs")
                });
            let _ = open::that(&path);
        }
        #[cfg(target_os = "windows")]
        {
            let _ = open::that(r"C:\ProgramData\Sentinel\logs");
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            let _ = open::that("/var/log/sentinel-grc");
        }
    }
}
