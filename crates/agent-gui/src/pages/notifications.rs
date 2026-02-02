//! Notifications page -- list and manage notifications.

use egui::Ui;

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct NotificationsPage;

impl NotificationsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) {
        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Notifications",
            Some("Alertes, avertissements et informations de l'agent"),
        );
        ui.add_space(theme::SPACE_LG);

        // Summary + mark all read button
        ui.horizontal(|ui| {
            let total = state.notifications.len();
            let unread = state.notifications.iter().filter(|n| !n.read).count();

            ui.label(
                egui::RichText::new(format!("{} notification(s), {} non lue(s)", total, unread))
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if unread > 0 {
                    let btn = egui::Button::new(
                        egui::RichText::new(format!("{}  Tout marquer comme lu", icons::CHECK))
                            .font(theme::font_small())
                            .color(theme::text_on_accent())
                            .strong(),
                    )
                    .fill(theme::ACCENT)
                    .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                    if ui.add(btn).clicked() {
                        for n in &mut state.notifications {
                            n.read = true;
                        }
                        state.unread_notification_count = 0;
                    }
                }
            });
        });

        ui.add_space(theme::SPACE_MD);

        if state.notifications.is_empty() {
            widgets::card(ui, |ui| {
                widgets::empty_state(
                    ui,
                    icons::BELL,
                    "Aucune notification",
                    Some("Les alertes et informations de l'agent appara\u{00ee}tront ici."),
                );
            });
        } else {
            for notif in &state.notifications {
                let border_color = theme::severity_color(&notif.severity);
                let bg = if notif.read {
                    theme::bg_secondary()
                } else {
                    theme::bg_elevated()
                };

                egui::Frame::new()
                    .fill(bg)
                    .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                    .inner_margin(egui::Margin::same(16))
                    .stroke(egui::Stroke::new(
                        if notif.read { 0.5 } else { 1.0 },
                        if notif.read {
                            theme::border()
                        } else {
                            border_color
                        },
                    ))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            // Severity badge
                            widgets::status_badge(ui, &notif.severity.to_uppercase(), border_color);

                            ui.add_space(theme::SPACE_SM);

                            // Unread indicator
                            if !notif.read {
                                ui.painter().circle_filled(
                                    ui.available_rect_before_wrap().min + egui::vec2(0.0, 8.0),
                                    4.0,
                                    theme::ACCENT,
                                );
                                ui.add_space(12.0);
                            }

                            ui.vertical(|ui| {
                                ui.label(
                                    egui::RichText::new(&notif.title)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                                if !notif.body.is_empty() {
                                    ui.label(
                                        egui::RichText::new(&notif.body)
                                            .font(theme::font_small())
                                            .color(theme::text_secondary()),
                                    );
                                }
                            });

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    ui.label(
                                        egui::RichText::new(
                                            notif.timestamp.format("%d/%m/%Y %H:%M").to_string(),
                                        )
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                    );
                                },
                            );
                        });
                    });

                ui.add_space(theme::SPACE_SM);
            }
        }

        ui.add_space(theme::SPACE_XL);
    }
}
