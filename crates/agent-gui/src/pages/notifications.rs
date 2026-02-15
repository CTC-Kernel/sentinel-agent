//! Notifications page -- list and manage notifications.

use egui::Ui;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct NotificationsPage;

impl NotificationsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Notifications"],
            "Notifications",
            Some("Alertes, avertissements et informations de l'agent"),
            Some(
                "Restez informé des événements importants nécessitant votre attention. Les alertes de scan, les rapports de conformité et les messages système sont archivés ici.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Summary + mark all read button
        ui.horizontal(|ui: &mut egui::Ui| {
            let total = state.notifications.len();
            let unread = state.notifications.iter().filter(|n| !n.read).count();

            ui.label(
                egui::RichText::new(format!("{} notification(s), {} non lue(s)", total, unread))
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if !state.notifications.is_empty()
                        && widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked()
                    {
                        Self::export_notifications_csv(state);
                    }

                    if unread > 0 {
                        ui.add_space(theme::SPACE_SM);

                        if widgets::primary_button(
                            ui,
                            format!("{}  Tout marquer comme lu", icons::CHECK),
                            true,
                        )
                        .clicked()
                        {
                            for n in &mut state.notifications {
                                n.read = true;
                            }
                            state.unread_notification_count = 0;
                            command = Some(GuiCommand::MarkAllNotificationsRead);
                        }
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        if state.notifications.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::BELL,
                    "Aucune notification",
                    Some("Les alertes et informations de l'agent appara\u{00ee}tront ici."),
                );
            });
        } else {
            for (idx, notif) in state.notifications.iter().enumerate() {
                let border_color = theme::severity_color(&notif.severity);
                let bg = if notif.read {
                    theme::bg_secondary()
                } else {
                    border_color.linear_multiply(theme::OPACITY_SUBTLE)
                };

                let resp = egui::Frame::new()
                    .fill(bg)
                    .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                    .inner_margin(egui::Margin::same(theme::SPACE as i8))
                    .stroke(egui::Stroke::new(
                        if notif.read {
                            theme::BORDER_HAIRLINE
                        } else {
                            theme::BORDER_THIN
                        },
                        border_color.linear_multiply(
                            if notif.read {
                                theme::OPACITY_MODERATE
                            } else {
                                1.0
                            },
                        ),
                    ))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            widgets::status_badge(ui, &notif.severity.to_uppercase(), border_color);

                            ui.add_space(theme::SPACE_SM);

                            if !notif.read {
                                ui.painter().circle_filled(
                                    ui.available_rect_before_wrap().min + egui::vec2(0.0, 8.0),
                                    4.0,
                                    theme::ACCENT,
                                );
                                ui.add_space(theme::SPACE_MD);
                            }

                            ui.vertical(|ui: &mut egui::Ui| {
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
                                |ui: &mut egui::Ui| {
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

                if resp.response.interact(egui::Sense::click()).clicked() {
                    state.selected_notification = Some(idx);
                    state.notification_detail_open = true;
                }

                ui.add_space(theme::SPACE_SM);
            }
        }

        ui.add_space(theme::SPACE_XL);

        Self::detail_drawer(ui, state, &mut command);

        command
    }

    fn detail_drawer(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let selected = match state.selected_notification {
            Some(idx) if idx < state.notifications.len() => idx,
            _ => return,
        };

        let notif = &state.notifications[selected];
        let title = notif.title.clone();
        let body = notif.body.clone();
        let severity = notif.severity.clone();
        let ts = notif.timestamp.format("%d/%m/%Y %H:%M").to_string();
        let read = notif.read;
        let action_url = notif.action.clone();
        let notif_id = notif.id.to_string();
        let sev_color = theme::severity_color(&severity);

        let (read_label, read_color) = if read {
            ("OUI", theme::SUCCESS)
        } else {
            ("NON", theme::WARNING)
        };

        let mut actions = Vec::new();
        if !read {
            actions.push(widgets::DetailAction::primary("Marquer comme lue", icons::CHECK));
        }
        actions.push(widgets::DetailAction::danger("Supprimer", icons::TRASH));

        let action = widgets::DetailDrawer::new("notification_detail", "Notification", icons::BELL)
            .accent(sev_color)
            .subtitle(&title)
            .show(ui.ctx(), &mut state.notification_detail_open, |ui| {
                widgets::detail_section(ui, "NOTIFICATION");
                widgets::detail_field(ui, "Titre", &title);
                widgets::detail_field_badge(ui, "Sévérité", &severity.to_uppercase(), sev_color);
                widgets::detail_field(ui, "Date", &ts);
                widgets::detail_field_badge(ui, "Lue", read_label, read_color);

                widgets::detail_section(ui, "CONTENU");
                widgets::detail_text(ui, "Message", &body);

                if let Some(ref act) = action_url {
                    widgets::detail_field(ui, "Action associée", act);
                }
            }, &actions);

        if let Some(idx) = action {
            if !read && idx == 0 {
                if let Some(n) = state.notifications.get_mut(selected) {
                    n.read = true;
                }
                state.unread_notification_count = state.unread_notification_count.saturating_sub(1);
                *command = Some(GuiCommand::MarkNotificationRead { notification_id: notif_id });
            } else if (read && idx == 0) || (!read && idx == 1) {
                state.notifications.remove(selected);
                state.notification_detail_open = false;
                state.selected_notification = None;
            }
        }
    }

    fn export_notifications_csv(state: &AppState) {
        let headers = &["date", "severite", "titre", "message", "lu"];
        let rows: Vec<Vec<String>> = state
            .notifications
            .iter()
            .map(|n| {
                vec![
                    n.timestamp.to_rfc3339(),
                    n.severity.clone(),
                    n.title.clone(),
                    n.body.clone(),
                    if n.read { "Oui" } else { "Non" }.to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("notifications.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}
