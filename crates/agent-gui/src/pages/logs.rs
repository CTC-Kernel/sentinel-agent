//! Logs page -- recent agent activity.

use egui::Ui;

use crate::app::AppState;
use crate::theme;
use crate::widgets;

pub struct LogsPage;

impl LogsPage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Journaux d'activit\u{00e9}",
                    Some("Historique des \u{00e9}v\u{2022}nements syst\u{00e8}me et actions de l'agent"),
                );
                ui.add_space(theme::SPACE_LG);

                // Controls
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(format!("󰄐 {} entr\u{00e9}es r\u{00e9}centes", state.logs.len()))
                                .font(theme::font_body())
                                .color(theme::TEXT_SECONDARY),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui
                                .button(
                                    egui::RichText::new("󰉋  OUVRIR LE DOSSIER")
                                        .font(theme::font_small())
                                        .strong(),
                                )
                                .clicked()
                            {
                                Self::open_logs_folder();
                            }
                        });
                    });
                });

                ui.add_space(theme::SPACE_MD);

                // Log entries
                widgets::card(ui, |ui| {
                    ui.set_min_height(400.0);
                    if state.logs.is_empty() {
                        ui.vertical_centered(|ui| {
                            ui.add_space(theme::SPACE_XL);
                            ui.label(
                                egui::RichText::new("Aucun journal disponible")
                                    .color(theme::TEXT_TERTIARY),
                            );
                            ui.add_space(theme::SPACE_XL);
                        });
                    } else {
                        ui.vertical(|ui| {
                            for entry in &state.logs {
                                ui.horizontal_top(|ui| {
                                    ui.set_min_height(24.0);
                                    
                                    // Timestamp
                                    ui.label(
                                        egui::RichText::new(entry.timestamp.format("%H:%M:%S").to_string())
                                            .font(theme::font_mono())
                                            .color(theme::TEXT_TERTIARY),
                                    );
                                    ui.add_space(4.0);

                                    // Level badge
                                    let (level_text, level_color) = match entry.level.as_str() {
                                        "error" => (" ERR ", theme::ERROR),
                                        "warn" => (" WRN ", theme::WARNING),
                                        "info" => (" INF ", theme::INFO),
                                        "debug" => (" DBG ", theme::TEXT_TERTIARY),
                                        _ => (" ??? ", theme::TEXT_SECONDARY),
                                    };
                                    
                                    ui.painter().rect_filled(
                                        ui.available_rect_before_wrap().shrink2(egui::vec2(ui.available_width() - 42.0, 4.0)),
                                        egui::CornerRadius::same(4),
                                        level_color.linear_multiply(0.2),
                                    );
                                    
                                    ui.label(
                                        egui::RichText::new(level_text)
                                            .font(theme::font_mono())
                                            .color(level_color)
                                            .strong(),
                                    );

                                    // Source module
                                    if let Some(ref src) = entry.source {
                                        ui.label(
                                            egui::RichText::new(format!("{}:", src.to_uppercase()))
                                                .font(theme::font_mono())
                                                .color(theme::ACCENT_LIGHT.linear_multiply(0.8))
                                                .strong(),
                                        );
                                    }

                                    // Message
                                    ui.label(
                                        egui::RichText::new(&entry.message)
                                            .font(theme::font_mono())
                                            .color(theme::TEXT_PRIMARY),
                                    );
                                });
                                ui.add_space(2.0);
                            }
                        });
                    }
                });
                
                ui.add_space(theme::SPACE_XL);
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
