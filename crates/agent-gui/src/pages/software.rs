//! Software page -- installed software inventory with tabs.

use egui::Ui;

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct SoftwarePage;

/// Active tab on the software page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SoftwareTab {
    Packages,
    Applications,
}

static mut ACTIVE_TAB: SoftwareTab = SoftwareTab::Packages;

impl SoftwarePage {
    pub fn show(ui: &mut Ui, state: &AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Logiciels",
                    Some("Inventaire complet des applications install\u{00e9}es et suivi des versions"),
                );
                ui.add_space(theme::SPACE_LG);

                // Tab bar
                let active = unsafe { ACTIVE_TAB };
                ui.horizontal(|ui| {
                    if Self::tab_button(ui, &format!("{} Paquets", icons::SOFTWARE), active == SoftwareTab::Packages) {
                        unsafe { ACTIVE_TAB = SoftwareTab::Packages; }
                    }
                    ui.add_space(theme::SPACE_SM);
                    if Self::tab_button(ui, &format!("{} Applications", icons::CUBE), active == SoftwareTab::Applications) {
                        unsafe { ACTIVE_TAB = SoftwareTab::Applications; }
                    }
                });

                ui.add_space(theme::SPACE_LG);

                let active = unsafe { ACTIVE_TAB };
                match active {
                    SoftwareTab::Packages => Self::show_packages(ui, state),
                    SoftwareTab::Applications => Self::show_macos_apps(ui, state),
                }

                ui.add_space(theme::SPACE_XL);
            });
    }

    // ── Tab: Paquets (Homebrew) ──────────────────────────────────────

    fn show_packages(ui: &mut Ui, state: &AppState) {
        // Summary cards
        let total = state.software_packages.len() as u32;
        let up_to_date = state
            .software_packages
            .iter()
            .filter(|p| p.up_to_date)
            .count() as u32;
        let outdated = total - up_to_date;

        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(ui, card_w, "TOTAL", &total.to_string(), theme::TEXT_PRIMARY, icons::CUBE);
            Self::summary_card(ui, card_w, "\u{00c0} JOUR", &up_to_date.to_string(), theme::SUCCESS, icons::CIRCLE_CHECK);
            Self::summary_card(ui, card_w, "OBSOL\u{00c8}TES", &outdated.to_string(), if outdated > 0 { theme::WARNING } else { theme::TEXT_TERTIARY }, icons::ARROW_UP);
        });

        ui.add_space(theme::SPACE_LG);

        // Packages table
        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("PAQUETS HOMEBREW")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.software_packages.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::SOFTWARE,
                    "Aucun paquet recens\u{00e9}",
                    Some("L'inventaire logiciel est en cours de constitution ou aucun paquet n'a \u{00e9}t\u{00e9} d\u{00e9}tect\u{00e9}."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(150.0).range(100.0..=400.0).at_least(100.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::initial(120.0).at_least(100.0))
                    .column(Column::initial(100.0).at_least(80.0))
                    .column(Column::remainder());

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| { ui.strong("NOM DU LOGICIEL"); });
                        header.col(|ui| { ui.strong("VERSION"); });
                        header.col(|ui| { ui.strong("\u{00c9}DITEUR"); });
                        header.col(|ui| { ui.strong("STATUT"); });
                        header.col(|ui| { ui.strong("MAJ DISPONIBLE"); });
                    })
                    .body(|body| {
                        body.rows(40.0, state.software_packages.len(), |mut row| {
                            let pkg = &state.software_packages[row.index()];
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&pkg.name).font(theme::font_body()).color(theme::TEXT_PRIMARY).strong());
                            });
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&pkg.version).font(theme::font_mono()).color(theme::TEXT_SECONDARY));
                            });
                            row.col(|ui| {
                                let publisher = pkg.publisher.as_deref().unwrap_or("--");
                                ui.label(egui::RichText::new(publisher).font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            });
                            row.col(|ui| {
                                if pkg.up_to_date {
                                    widgets::status_badge(ui, &format!("{} \u{00c0} JOUR", icons::CHECK), theme::SUCCESS.linear_multiply(0.8));
                                } else {
                                    widgets::status_badge(ui, &format!("{} OBSOL\u{00c8}TE", icons::ARROW_UP), theme::WARNING.linear_multiply(0.8));
                                }
                            });
                            row.col(|ui| {
                                if let Some(latest) = &pkg.latest_version {
                                    if !pkg.up_to_date {
                                        ui.label(egui::RichText::new(format!("{} {}", icons::ARROW_RIGHT, latest)).font(theme::font_mono()).color(theme::ACCENT_LIGHT).strong());
                                    } else {
                                        ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                    }
                                } else {
                                    ui.label(egui::RichText::new("--").color(theme::TEXT_TERTIARY));
                                }
                            });
                        });
                    });
            }
        });
    }

    // ── Tab: Applications (macOS native) ─────────────────────────────

    fn show_macos_apps(ui: &mut Ui, state: &AppState) {
        let total = state.macos_apps.len() as u32;

        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 2.0) / 3.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(ui, card_w, "APPLICATIONS", &total.to_string(), theme::ACCENT, icons::CUBE);
            Self::summary_card(ui, card_w, "SOURCE", "macOS", theme::TEXT_SECONDARY, icons::SETTINGS);
            Self::summary_card(ui, card_w, "R\u{00c9}PERTOIRE", "/Applications", theme::TEXT_SECONDARY, icons::DATABASE);
        });

        ui.add_space(theme::SPACE_LG);

        widgets::card(ui, |ui| {
            ui.label(
                egui::RichText::new("APPLICATIONS macOS")
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            if state.macos_apps.is_empty() {
                widgets::empty_state(
                    ui,
                    icons::CUBE,
                    "Aucune application d\u{00e9}tect\u{00e9}e",
                    Some("Le scan du r\u{00e9}pertoire /Applications n'a trouv\u{00e9} aucune application."),
                );
            } else {
                use egui_extras::{Column, TableBuilder};

                let table = TableBuilder::new(ui)
                    .striped(true)
                    .resizable(true)
                    .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                    .column(Column::initial(180.0).range(120.0..=400.0).at_least(120.0)) // Name
                    .column(Column::initial(90.0).at_least(70.0))  // Version
                    .column(Column::initial(200.0).at_least(140.0)) // Bundle ID
                    .column(Column::remainder()); // Publisher

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| { ui.strong("APPLICATION"); });
                        header.col(|ui| { ui.strong("VERSION"); });
                        header.col(|ui| { ui.strong("BUNDLE ID"); });
                        header.col(|ui| { ui.strong("\u{00c9}DITEUR"); });
                    })
                    .body(|body| {
                        body.rows(36.0, state.macos_apps.len(), |mut row| {
                            let app = &state.macos_apps[row.index()];
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&app.name).font(theme::font_body()).color(theme::TEXT_PRIMARY).strong());
                            });
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&app.version).font(theme::font_mono()).color(theme::TEXT_SECONDARY));
                            });
                            row.col(|ui| {
                                ui.label(egui::RichText::new(&app.bundle_id).font(theme::font_mono()).color(theme::TEXT_TERTIARY));
                            });
                            row.col(|ui| {
                                let pub_text = if app.publisher.len() > 50 {
                                    format!("{}...", &app.publisher[..47])
                                } else {
                                    app.publisher.clone()
                                };
                                ui.label(egui::RichText::new(pub_text).font(theme::font_small()).color(theme::TEXT_TERTIARY));
                            });
                        });
                    });
            }
        });
    }

    // ── Shared helpers ───────────────────────────────────────────────

    fn tab_button(ui: &mut Ui, label: &str, active: bool) -> bool {
        let text_color = if active { theme::TEXT_ON_ACCENT } else { theme::TEXT_SECONDARY };
        let bg = if active { theme::ACCENT } else { theme::BG_ELEVATED };
        let btn = egui::Button::new(
            egui::RichText::new(label)
                .font(theme::font_body())
                .color(text_color)
                .strong(),
        )
        .fill(bg)
        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING))
        .min_size(egui::vec2(140.0, 36.0));
        ui.add(btn).clicked()
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
}
