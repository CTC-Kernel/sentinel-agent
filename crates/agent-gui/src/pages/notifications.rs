// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Notifications page -- list, alert rules, and webhooks management.

use egui::Ui;

/// Width reserved for the severity badge, so row titles line up.
const NOTIF_BADGE_COLUMN: f32 = 84.0;

use crate::app::AppState;
use crate::dto::{AlertRule, AlertRuleType, Severity, WebhookConfig};
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
            &["Vue d'ensemble", "Notifications"],
            "Notifications",
            Some("Alertes, avertissements et informations de l'agent"),
            Some(
                "Restez inform\u{00e9} des \u{00e9}v\u{00e9}nements importants n\u{00e9}cessitant votre attention. Les alertes de scan, les rapports de conformit\u{00e9} et les messages syst\u{00e8}me sont archiv\u{00e9}s ici.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Tab bar
        let unread = state.notifications.iter().filter(|n| !n.read).count();
        let tabs = vec![
            widgets::Tab::new("Notifications")
                .icon(icons::BELL)
                .badge(unread as u32),
            widgets::Tab::new("R\u{00e8}gles d'alerte").icon(icons::SHIELD_CHECK),
            widgets::Tab::new("Webhooks").icon(icons::GLOBE),
        ];
        if let Some(new_tab) = widgets::TabBar::new(tabs, state.notifications_active_tab).show(ui) {
            state.notifications_active_tab = new_tab;
        }

        ui.add_space(theme::SPACE_MD);

        match state.notifications_active_tab {
            0 => {
                command = Self::show_notifications_tab(ui, state);
            }
            1 => {
                command = Self::show_alert_rules_tab(ui, state);
            }
            2 => {
                command = Self::show_webhooks_tab(ui, state);
            }
            _ => {}
        }

        command
    }

    // ──────────────────────────────────────────────────────────────────────
    // TAB 0: NOTIFICATIONS (existing list)
    // ──────────────────────────────────────────────────────────────────────
    fn show_notifications_tab(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        // Summary + mark all read button
        ui.horizontal(|ui: &mut egui::Ui| {
            let total = state.notifications.len();
            let unread = state.notifications.iter().filter(|n| !n.read).count();

            ui.label(
                egui::RichText::new(format!(
                    "{} \u{00b7} {} non lue{}",
                    crate::format::count(total, "notification"),
                    crate::format::int(unread),
                    crate::format::plural_suffix(unread)
                ))
                .font(theme::font_body())
                .color(theme::text_secondary()),
            );

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if !state.notifications.is_empty()
                        && widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked()
                    {
                        let success = Self::export_notifications_csv(state);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Export CSV notifications r\u{00e9}ussi",
                                )
                                .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("\u{00c9}chec de l'export CSV")
                                    .with_time(time),
                            );
                        }
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
                            // Invalidate selection as the list was mutated
                            state.selected_notification = None;
                            state.notification_detail_open = false;
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
            const NOTIF_PER_PAGE: usize = 20;
            let (nf_start, nf_len, _) = widgets::page_window(
                state.notifications.len(),
                NOTIF_PER_PAGE,
                &mut state.notifications_page,
            );
            for (offset, notif) in state
                .notifications
                .iter()
                .skip(nf_start)
                .take(nf_len)
                .enumerate()
            {
                let idx = nf_start + offset;
                let severity = theme::severity_color(&notif.severity);
                // Unread rows sit on an opaque tint of their severity with a
                // bar on the leading edge; read rows fall back to the plain
                // surface, so the unread ones are the only thing that pops.
                let (fill, stroke) = if notif.read {
                    (
                        theme::bg_secondary(),
                        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                    )
                } else {
                    (
                        theme::tinted_surface(severity),
                        egui::Stroke::new(
                            theme::BORDER_THIN,
                            theme::color_blend_pub(theme::bg_secondary(), severity, 0.45),
                        ),
                    )
                };

                let resp = egui::Frame::new()
                    .fill(fill)
                    .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                    .inner_margin(egui::Margin::same(theme::SPACE as i8))
                    .stroke(stroke)
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            // Fixed badge column, so titles align down the
                            // list whatever the severity word's width.
                            ui.allocate_ui_with_layout(
                                egui::vec2(NOTIF_BADGE_COLUMN, theme::ICON_MD),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    ui.set_min_width(NOTIF_BADGE_COLUMN);
                                    widgets::status_badge(
                                        ui,
                                        &notif.severity.to_uppercase(),
                                        severity,
                                    );
                                },
                            );

                            ui.vertical(|ui: &mut egui::Ui| {
                                let title = egui::RichText::new(&notif.title)
                                    .font(theme::font_body())
                                    .color(theme::text_primary());
                                ui.label(if notif.read { title } else { title.strong() });
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

                let row_rect = resp.response.rect;
                let rounding = egui::CornerRadius::same(theme::CARD_ROUNDING);
                if !notif.read {
                    // Paint the whole rounded row, clipped to a strip on the
                    // leading edge: the bar inherits the corner radius exactly.
                    let strip = egui::Rect::from_min_size(
                        row_rect.left_top(),
                        egui::vec2(theme::ACCENT_BAR_WIDTH, row_rect.height()),
                    );
                    ui.painter()
                        .with_clip_rect(strip)
                        .rect_filled(row_rect, rounding, severity);
                }

                let click_resp = resp.response.interact(egui::Sense::click());
                if click_resp.hovered() {
                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                    ui.painter().rect_stroke(
                        row_rect,
                        rounding,
                        egui::Stroke::new(theme::BORDER_THIN, theme::border()),
                        egui::StrokeKind::Inside,
                    );
                }
                if click_resp.clicked() {
                    state.selected_notification = Some(idx);
                    state.notification_detail_open = true;
                }

                ui.add_space(theme::SPACE_SM);
            }

            // Keyboard: ↑/↓ walk the displayed order, Enter opens the drawer.
            let mut position = state.selected_notification;
            if widgets::navigate_list(
                ui.ctx(),
                &mut position,
                state.notifications.len(),
                &mut state.notification_detail_open,
            ) && let Some(pos) = position
            {
                state.selected_notification = Some(pos);
                state.notifications_page = pos / NOTIF_PER_PAGE;
            }

            widgets::paginate_controls(
                ui,
                state.notifications.len(),
                NOTIF_PER_PAGE,
                &mut state.notifications_page,
            );
        }

        ui.add_space(theme::SPACE_XL);

        Self::detail_drawer(ui, state, &mut command);

        command
    }

    // ──────────────────────────────────────────────────────────────────────
    // TAB 1: ALERT RULES
    // ──────────────────────────────────────────────────────────────────────
    fn show_alert_rules_tab(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        // New rule button
        ui.horizontal(|ui: &mut egui::Ui| {
            if widgets::primary_button(
                ui,
                format!("{}  Nouvelle r\u{00e8}gle", icons::PLUS),
                !state.alerting.editing_rule,
            )
            .clicked()
            {
                state.alerting.editing_rule = true;
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Inline edit form
        if state.alerting.editing_rule {
            Self::alert_rule_form(ui, state, &mut command);
            ui.add_space(theme::SPACE_MD);
        }

        // Rules table
        if state.alerting.rules.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::SHIELD_CHECK,
                    "Aucune r\u{00e8}gle d'alerte",
                    Some("Cr\u{00e9}ez des r\u{00e8}gles pour automatiser la gestion des alertes."),
                );
            });
        } else {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.push_id("alert_rules_table", |ui: &mut egui::Ui| {
                    use widgets::table;

                    table::fluid(
                        ui,
                        &[
                            table::Col::fluid(160.0, 2.0), // Nom
                            table::Col::fluid(140.0, 1.5), // Type
                            table::Col::fluid(90.0, 0.5),  // Escalade
                            table::Col::fixed(72.0),       // Activé
                            table::Col::fixed(64.0),       // Actions
                        ],
                    )
                    .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "NOM");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "TYPE");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ESCALADE");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIV\u{00c9}");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIONS");
                        });
                    })
                    .body(|mut body| {
                        // Collect indices to avoid borrow issues
                        let rule_count = state.alerting.rules.len();
                        for i in 0..rule_count {
                            body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                                let rule = &state.alerting.rules[i];
                                let rule_id = rule.id.to_string();

                                row.col(|ui: &mut egui::Ui| {
                                    table::cell_strong(ui, &rule.name);
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    table::cell_secondary(ui, rule.rule_type.label_fr());
                                });
                                row.col(|ui: &mut egui::Ui| match rule.escalation_minutes {
                                    Some(m) => {
                                        table::cell_secondary(ui, &format!("{}min", m));
                                    }
                                    None => {
                                        table::cell_empty(ui);
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    let mut enabled = rule.enabled;
                                    if widgets::toggle_switch(ui, &mut enabled).changed() {
                                        // Toggling requires mutating — store via memory flag
                                        ui.memory_mut(|m| {
                                            m.data.insert_temp(
                                                egui::Id::new(format!("toggle_rule_{}", i)),
                                                enabled,
                                            );
                                        });
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    if widgets::button::icon_button_with_color(
                                        ui,
                                        icons::TRASH,
                                        Some("Supprimer"),
                                        theme::readable_color(theme::ERROR),
                                    )
                                    .clicked()
                                    {
                                        ui.memory_mut(|m| {
                                            m.data.insert_temp(
                                                egui::Id::new("delete_rule_id"),
                                                rule_id,
                                            );
                                        });
                                    }
                                });
                            });
                        }
                    });
                });
            });

            // Process deferred toggle actions
            for i in 0..state.alerting.rules.len() {
                let toggle_id = egui::Id::new(format!("toggle_rule_{}", i));
                if let Some(new_val) = ui.memory(|m| m.data.get_temp::<bool>(toggle_id)) {
                    state.alerting.rules[i].enabled = new_val;
                    ui.memory_mut(|m| m.data.remove::<bool>(toggle_id));
                    let mut updated = state.alerting.rules[i].clone();
                    updated.enabled = new_val;
                    command = Some(GuiCommand::SaveAlertRule {
                        rule: Box::new(updated),
                    });
                }
            }

            // Process deferred delete
            let delete_id_str: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("delete_rule_id")));
            if let Some(ref rid) = delete_id_str {
                state.alerting.rules.retain(|r| r.id.to_string() != *rid);
                command = Some(GuiCommand::DeleteAlertRule {
                    rule_id: rid.clone(),
                });
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("delete_rule_id")));
            }
        }

        ui.add_space(theme::SPACE_XL);
        command
    }

    /// Inline form for creating a new alert rule.
    fn alert_rule_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let form_id = ui.id().with("alert_rule_form");

        // Form state stored in egui memory
        let mut name: String = ui
            .memory(|m| m.data.get_temp(form_id.with("name")))
            .unwrap_or_default();
        let mut rule_type_idx: usize = ui
            .memory(|m| m.data.get_temp(form_id.with("type_idx")))
            .unwrap_or(0);
        let mut severity_idx: usize = ui
            .memory(|m| m.data.get_temp(form_id.with("sev_idx")))
            .unwrap_or(0);
        let mut escalation_str: String = ui
            .memory(|m| m.data.get_temp(form_id.with("escalation")))
            .unwrap_or_default();
        let mut enabled: bool = ui
            .memory(|m| m.data.get_temp(form_id.with("enabled")))
            .unwrap_or(true);

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("NOUVELLE R\u{00c8}GLE D'ALERTE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            widgets::form::fields(ui, |ui: &mut egui::Ui| {
                widgets::form::field(ui, "Nom", 300.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut name, "Nom de la r\u{00e8}gle…");
                });
                widgets::form::field(ui, "Type", 200.0, |ui: &mut egui::Ui| {
                    let all_types = AlertRuleType::all();
                    let type_labels: Vec<&str> = all_types.iter().map(|t| t.label_fr()).collect();
                    widgets::dropdown_width(
                        ui,
                        "rule_type_combo",
                        &type_labels,
                        &mut rule_type_idx,
                        200.0,
                    );
                });
                widgets::form::field(
                    ui,
                    "S\u{00e9}v\u{00e9}rit\u{00e9}",
                    150.0,
                    |ui: &mut egui::Ui| {
                        let sev_labels =
                            ["CRITIQUE", "\u{00c9}LEV\u{00c9}", "MOYEN", "FAIBLE", "INFO"];
                        widgets::dropdown_width(
                            ui,
                            "rule_severity_combo",
                            &sev_labels,
                            &mut severity_idx,
                            150.0,
                        );
                    },
                );
                widgets::form::field(ui, "Escalade (min)", 120.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut escalation_str, "30");
                });
                widgets::form::field(ui, "Activ\u{00e9}", 72.0, |ui: &mut egui::Ui| {
                    widgets::toggle_switch(ui, &mut enabled);
                });
            });

            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                let can_save = !name.trim().is_empty();
                if widgets::primary_button(ui, format!("{}  Enregistrer", icons::CHECK), can_save)
                    .clicked()
                    && can_save
                {
                    let all_types = AlertRuleType::all();
                    let rule_type = all_types[rule_type_idx.min(all_types.len().saturating_sub(1))];
                    let severity = match severity_idx {
                        0 => Severity::Critical,
                        1 => Severity::High,
                        2 => Severity::Medium,
                        3 => Severity::Low,
                        _ => Severity::Info,
                    };
                    let escalation = escalation_str.trim().parse::<u32>().ok();

                    let rule = AlertRule {
                        id: uuid::Uuid::new_v4(),
                        name: name.trim().to_string(),
                        rule_type,
                        severity_threshold: Some(severity),
                        detection_types: Vec::new(),
                        escalation_minutes: escalation,
                        enabled,
                        created_at: chrono::Utc::now(),
                    };

                    state.alerting.rules.push(rule.clone());
                    *command = Some(GuiCommand::SaveAlertRule {
                        rule: Box::new(rule),
                    });
                    state.alerting.editing_rule = false;

                    // Clear form
                    ui.memory_mut(|m| {
                        m.data.remove::<String>(form_id.with("name"));
                        m.data.remove::<usize>(form_id.with("type_idx"));
                        m.data.remove::<usize>(form_id.with("sev_idx"));
                        m.data.remove::<String>(form_id.with("escalation"));
                        m.data.remove::<bool>(form_id.with("enabled"));
                    });
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, "Annuler").clicked() {
                    state.alerting.editing_rule = false;
                    ui.memory_mut(|m| {
                        m.data.remove::<String>(form_id.with("name"));
                        m.data.remove::<usize>(form_id.with("type_idx"));
                        m.data.remove::<usize>(form_id.with("sev_idx"));
                        m.data.remove::<String>(form_id.with("escalation"));
                        m.data.remove::<bool>(form_id.with("enabled"));
                    });
                }
            });
        });

        // Persist form state
        ui.memory_mut(|m| {
            m.data.insert_temp(form_id.with("name"), name);
            m.data.insert_temp(form_id.with("type_idx"), rule_type_idx);
            m.data.insert_temp(form_id.with("sev_idx"), severity_idx);
            m.data
                .insert_temp(form_id.with("escalation"), escalation_str);
            m.data.insert_temp(form_id.with("enabled"), enabled);
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // TAB 2: WEBHOOKS
    // ──────────────────────────────────────────────────────────────────────
    fn show_webhooks_tab(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        // New webhook button
        ui.horizontal(|ui: &mut egui::Ui| {
            if widgets::primary_button(
                ui,
                format!("{}  Nouveau webhook", icons::PLUS),
                !state.alerting.editing_webhook,
            )
            .clicked()
            {
                state.alerting.editing_webhook = true;
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Inline form
        if state.alerting.editing_webhook {
            Self::webhook_form(ui, state, &mut command);
            ui.add_space(theme::SPACE_MD);
        }

        // Webhooks table
        if state.alerting.webhooks.is_empty() {
            widgets::card(ui, |ui: &mut egui::Ui| {
                widgets::empty_state(
                    ui,
                    icons::GLOBE,
                    "Aucun webhook configur\u{00e9}",
                    Some(
                        "Ajoutez des webhooks pour envoyer les alertes vers Slack, Teams ou d'autres services.",
                    ),
                );
            });
        } else {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.push_id("webhooks_table", |ui: &mut egui::Ui| {
                    use widgets::table;

                    table::fluid(
                        ui,
                        &[
                            table::Col::fluid(120.0, 1.0), // Nom
                            table::Col::fluid(160.0, 3.0), // URL
                            table::Col::fluid(72.0, 0.0),  // Format
                            table::Col::fluid(116.0, 0.5), // Dernier envoi
                            table::Col::fixed(72.0),       // Activé
                            table::Col::fixed(148.0),      // Actions
                        ],
                    )
                    .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "NOM");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "URL");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "FORMAT");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "DERNIER ENVOI");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIV\u{00c9}");
                        });
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIONS");
                        });
                    })
                    .body(|mut body| {
                        let wh_count = state.alerting.webhooks.len();
                        for i in 0..wh_count {
                            body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                                let wh = &state.alerting.webhooks[i];
                                let wh_id = wh.id.to_string();

                                row.col(|ui: &mut egui::Ui| {
                                    table::cell_strong(ui, &wh.name);
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    // The cell truncates with the full URL on hover.
                                    table::cell_small(ui, &wh.url);
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    widgets::status_badge(
                                        ui,
                                        &wh.format.to_uppercase(),
                                        theme::INFO,
                                    );
                                });
                                row.col(|ui: &mut egui::Ui| match wh.last_sent {
                                    Some(dt) => {
                                        table::cell_muted(
                                            ui,
                                            &dt.format("%d/%m/%Y %H:%M").to_string(),
                                        );
                                    }
                                    None => {
                                        table::cell_empty(ui);
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    let mut enabled = wh.enabled;
                                    if widgets::toggle_switch(ui, &mut enabled).changed() {
                                        ui.memory_mut(|m| {
                                            m.data.insert_temp(
                                                egui::Id::new(format!("toggle_wh_{}", i)),
                                                enabled,
                                            );
                                        });
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    ui.horizontal(|ui: &mut egui::Ui| {
                                        if widgets::ghost_button(
                                            ui,
                                            format!("{}  Tester", icons::PLAY),
                                        )
                                        .clicked()
                                        {
                                            ui.memory_mut(|m| {
                                                m.data.insert_temp(
                                                    egui::Id::new("test_wh_id"),
                                                    wh_id.clone(),
                                                );
                                            });
                                        }
                                        if widgets::button::icon_button_with_color(
                                            ui,
                                            icons::TRASH,
                                            Some("Supprimer"),
                                            theme::readable_color(theme::ERROR),
                                        )
                                        .clicked()
                                        {
                                            ui.memory_mut(|m| {
                                                m.data.insert_temp(
                                                    egui::Id::new("delete_wh_id"),
                                                    wh_id.clone(),
                                                );
                                            });
                                        }
                                    });
                                });
                            });
                        }
                    });
                });
            });

            // Process deferred toggle actions
            for i in 0..state.alerting.webhooks.len() {
                let toggle_id = egui::Id::new(format!("toggle_wh_{}", i));
                if let Some(new_val) = ui.memory(|m| m.data.get_temp::<bool>(toggle_id)) {
                    state.alerting.webhooks[i].enabled = new_val;
                    ui.memory_mut(|m| m.data.remove::<bool>(toggle_id));
                    let updated = state.alerting.webhooks[i].clone();
                    command = Some(GuiCommand::SaveWebhook {
                        webhook: Box::new(updated),
                    });
                }
            }

            // Process deferred test
            let test_id: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("test_wh_id")));
            if let Some(ref wid) = test_id {
                command = Some(GuiCommand::TestWebhook {
                    webhook_id: wid.clone(),
                });
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("test_wh_id")));
            }

            // Process deferred delete
            let delete_id: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("delete_wh_id")));
            if let Some(ref wid) = delete_id {
                state.alerting.webhooks.retain(|w| w.id.to_string() != *wid);
                command = Some(GuiCommand::DeleteWebhook {
                    webhook_id: wid.clone(),
                });
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("delete_wh_id")));
            }
        }

        ui.add_space(theme::SPACE_XL);
        command
    }

    /// Inline form for creating a new webhook.
    fn webhook_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let form_id = ui.id().with("webhook_form");

        let mut name: String = ui
            .memory(|m| m.data.get_temp(form_id.with("name")))
            .unwrap_or_default();
        let mut url: String = ui
            .memory(|m| m.data.get_temp(form_id.with("url")))
            .unwrap_or_default();
        let mut format_idx: usize = ui
            .memory(|m| m.data.get_temp(form_id.with("format_idx")))
            .unwrap_or(0);
        let mut enabled: bool = ui
            .memory(|m| m.data.get_temp(form_id.with("enabled")))
            .unwrap_or(true);

        let format_options = ["slack", "teams", "generic"];
        let format_labels = ["Slack", "Teams", "G\u{00e9}n\u{00e9}rique"];

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("NOUVEAU WEBHOOK")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            widgets::form::fields(ui, |ui: &mut egui::Ui| {
                widgets::form::field(ui, "Nom", 260.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut name, "Nom du webhook…");
                });
                widgets::form::field(ui, "URL", 380.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut url, "https://hooks.example.com/…");
                });
                widgets::form::field(ui, "Format", 150.0, |ui: &mut egui::Ui| {
                    widgets::dropdown_width(
                        ui,
                        "webhook_format_combo",
                        &format_labels,
                        &mut format_idx,
                        150.0,
                    );
                });
                widgets::form::field(ui, "Activ\u{00e9}", 72.0, |ui: &mut egui::Ui| {
                    widgets::toggle_switch(ui, &mut enabled);
                });
            });

            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                let can_save = !name.trim().is_empty() && !url.trim().is_empty();
                if widgets::primary_button(ui, format!("{}  Enregistrer", icons::CHECK), can_save)
                    .clicked()
                    && can_save
                {
                    let webhook = WebhookConfig {
                        id: uuid::Uuid::new_v4(),
                        name: name.trim().to_string(),
                        url: url.trim().to_string(),
                        format: format_options
                            [format_idx.min(format_options.len().saturating_sub(1))]
                        .to_string(),
                        enabled,
                        last_sent: None,
                        error: None,
                    };

                    state.alerting.webhooks.push(webhook.clone());
                    *command = Some(GuiCommand::SaveWebhook {
                        webhook: Box::new(webhook),
                    });
                    state.alerting.editing_webhook = false;

                    // Clear form
                    ui.memory_mut(|m| {
                        m.data.remove::<String>(form_id.with("name"));
                        m.data.remove::<String>(form_id.with("url"));
                        m.data.remove::<usize>(form_id.with("format_idx"));
                        m.data.remove::<bool>(form_id.with("enabled"));
                    });
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, "Annuler").clicked() {
                    state.alerting.editing_webhook = false;
                    ui.memory_mut(|m| {
                        m.data.remove::<String>(form_id.with("name"));
                        m.data.remove::<String>(form_id.with("url"));
                        m.data.remove::<usize>(form_id.with("format_idx"));
                        m.data.remove::<bool>(form_id.with("enabled"));
                    });
                }
            });
        });

        // Persist form state
        ui.memory_mut(|m| {
            m.data.insert_temp(form_id.with("name"), name);
            m.data.insert_temp(form_id.with("url"), url);
            m.data.insert_temp(form_id.with("format_idx"), format_idx);
            m.data.insert_temp(form_id.with("enabled"), enabled);
        });
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
            actions.push(widgets::DetailAction::primary(
                "Marquer comme lue",
                icons::CHECK,
            ));
        }
        actions.push(widgets::DetailAction::danger("Supprimer", icons::TRASH));

        let action = widgets::DetailDrawer::new("notification_detail", "Notification", icons::BELL)
            .accent(sev_color)
            .subtitle(&title)
            .show(
                ui.ctx(),
                &mut state.notification_detail_open,
                |ui| {
                    widgets::detail_section(ui, "NOTIFICATION");
                    widgets::detail_field(ui, "Titre", &title);
                    widgets::detail_field_badge(
                        ui,
                        "Sévérité",
                        &severity.to_uppercase(),
                        sev_color,
                    );
                    widgets::detail_field(ui, "Date", &ts);
                    widgets::detail_field_badge(ui, "Lue", read_label, read_color);

                    widgets::detail_section(ui, "CONTENU");
                    widgets::detail_text(ui, "Message", &body);

                    if let Some(ref act) = action_url {
                        widgets::detail_field(ui, "Action associée", act);
                    }
                },
                &actions,
            );

        if let Some(idx) = action {
            if !read && idx == 0 {
                if let Some(n) = state.notifications.get_mut(selected) {
                    n.read = true;
                }
                state.unread_notification_count = state.unread_notification_count.saturating_sub(1);
                *command = Some(GuiCommand::MarkNotificationRead {
                    notification_id: notif_id.clone(),
                });
            } else if (read && idx == 0) || (!read && idx == 1) {
                state.notifications.remove(selected);
                state.notification_detail_open = false;
                state.selected_notification = None;
                *command = Some(GuiCommand::DeleteNotification {
                    notification_id: notif_id,
                });
            }
        }
    }

    fn export_notifications_csv(state: &AppState) -> bool {
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
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}
