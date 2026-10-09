// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Notifications page -- list, alert rules, and webhooks management.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{AlertRule, AlertRuleType, Severity, WebhookConfig};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::modal;

/// Confirmation dialogs of the alerting tabs.
const RULE_DELETE_CONFIRM: &str = "alert_rule_delete_confirm";
const WEBHOOK_DELETE_CONFIRM: &str = "webhook_delete_confirm";

/// Webhook formats the agent can shape a message for, with their labels.
const WEBHOOK_FORMATS: [(&str, &str); 3] = [
    ("slack", "Slack"),
    ("msteams", "Teams"),
    ("generic", "JSON générique"),
];

/// Label of a stored webhook format, for the list.
fn webhook_format_label(format: &str) -> String {
    WEBHOOK_FORMATS
        .iter()
        .find(|(value, _)| *value == format)
        .map_or_else(|| format.to_uppercase(), |(_, label)| (*label).to_string())
}

pub struct NotificationsPage;

impl NotificationsPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_XS);
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
        crate::pages::security_navigation(ui, state);
        ui.add_space(theme::SPACE_MD);

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
        ui.vertical(|ui: &mut egui::Ui| {
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

            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                if !state.notifications.is_empty()
                    && widgets::ghost_button(
                        ui,
                        format!("{}  Exporter les notifications", icons::DOWNLOAD),
                    )
                    .clicked()
                {
                    let toast = match Self::export_notifications_csv(state) {
                        Ok(path) => widgets::toast::Toast::success(format!(
                            "Export CSV enregistré : {}",
                            path.display()
                        )),
                        Err(error) => {
                            widgets::toast::Toast::error(format!("Export CSV impossible : {error}"))
                        }
                    };
                    state.toasts.push(toast.with_time(ui.input(|i| i.time)));
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
            });
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
            // One card holding a dense list grouped by day: tall standalone
            // cards showed four notifications a screen and repeated "Non
            // lue" on every one. Unread is a violet dot and a bold title.
            let today = chrono::Local::now().date_naive();
            let mut current_day = None;
            widgets::data_card(ui, "Notifications", |ui: &mut egui::Ui| {
                for (offset, notif) in state
                    .notifications
                    .iter()
                    .skip(nf_start)
                    .take(nf_len)
                    .enumerate()
                {
                    let idx = nf_start + offset;
                    let day = notif.timestamp.with_timezone(&chrono::Local).date_naive();
                    if current_day != Some(day) {
                        current_day = Some(day);
                        if offset > 0 {
                            ui.add_space(theme::SPACE_SM);
                        }
                        let heading = match (today - day).num_days() {
                            0 => "AUJOURD'HUI".to_owned(),
                            1 => "HIER".to_owned(),
                            _ => day.format("%d/%m/%Y").to_string(),
                        };
                        ui.label(
                            egui::RichText::new(heading)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_XS);
                    }
                    if notification_row(ui, notif, state.selected_notification == Some(idx)) {
                        state.selected_notification = Some(idx);
                        state.notification_detail_open = true;
                    }
                }
            });

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
            widgets::data_card(ui, "Règles d’alerte", |ui: &mut egui::Ui| {
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
                                    widgets::status_badge(
                                        ui,
                                        rule.rule_type.label_fr(),
                                        theme::INFO,
                                    );
                                });
                                row.col(|ui: &mut egui::Ui| match rule.escalation_minutes {
                                    Some(m) => {
                                        table::cell_secondary(
                                            ui,
                                            &crate::format::interval(u64::from(m) * 60),
                                        );
                                    }
                                    None => {
                                        table::cell_empty(ui);
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    let mut enabled = rule.enabled;
                                    if widgets::toggle_switch_labeled(
                                        ui,
                                        &mut enabled,
                                        &format!("Activer {}", rule.name),
                                    )
                                    .changed()
                                    {
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
                                        Some("Supprimer la règle"),
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

            // Deferred delete: administrator mode, then a confirmation.
            let delete_id_str: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("delete_rule_id")));
            if let Some(rid) = delete_id_str {
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("delete_rule_id")));
                if state.require_admin("Supprimer une règle d'alerte") {
                    modal::ask_confirmation(ui.ctx(), RULE_DELETE_CONFIRM, rid);
                }
            }
        }

        if let Some(rid) = modal::pending_confirmation::<String>(ui.ctx(), RULE_DELETE_CONFIRM) {
            let name = state
                .alerting
                .rules
                .iter()
                .find(|r| r.id == rid)
                .map_or_else(|| rid.clone(), |r| r.name.clone());
            if modal::resolve_confirmation::<String>(
                ui.ctx(),
                RULE_DELETE_CONFIRM,
                "Supprimer la règle d'alerte ?",
                &format!(
                    "« {name} » ne déclenchera plus de notification ni d'escalade. \
                     Cette action est irréversible."
                ),
                "Supprimer",
            ) {
                state.alerting.rules.retain(|r| r.id != rid);
                command = Some(GuiCommand::DeleteAlertRule { rule_id: rid });
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
                    widgets::toggle_switch_labeled(ui, &mut enabled, "Activer à la création");
                });
            });

            ui.add_space(theme::SPACE_SM);

            let escalation = parse_escalation(&escalation_str);
            if escalation.is_err() {
                ui.label(egui::RichText::new("Indiquez un nombre entier de minutes supérieur à zéro, ou laissez vide pour désactiver l’escalade.")
                    .font(theme::font_small()).color(theme::readable_color(theme::ERROR)));
            }
            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                let can_save = !name.trim().is_empty() && escalation.is_ok();
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
                    let escalation = escalation.unwrap_or(None);

                    let rule = AlertRule {
                        id: uuid::Uuid::new_v4().to_string(),
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
            widgets::data_card(ui, "Webhooks", |ui: &mut egui::Ui| {
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
                                    // A webhook URL's path is its secret (Slack, Teams): show
                                    // the host only, the full URL stays in the edit form.
                                    table::cell_small(ui, &mask_webhook_url(&wh.url))
                                        .on_hover_text(
                                            "Chemin masqué : il contient le secret du webhook",
                                        );
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    widgets::status_badge(
                                        ui,
                                        &webhook_format_label(&wh.format),
                                        theme::INFO,
                                    );
                                });
                                row.col(|ui: &mut egui::Ui| match wh.last_sent {
                                    Some(dt) => {
                                        table::cell_muted(ui, &crate::format::local_datetime(dt));
                                    }
                                    None => {
                                        table::cell_empty(ui);
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    let mut enabled = wh.enabled;
                                    if widgets::toggle_switch_labeled(
                                        ui,
                                        &mut enabled,
                                        &format!("Activer {}", wh.name),
                                    )
                                    .changed()
                                    {
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
                                            Some("Supprimer le webhook"),
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

            // Process deferred toggle actions. A webhook decides where
            // security data goes: changing it needs the administrator mode,
            // asked for before the switch changes.
            for i in 0..state.alerting.webhooks.len() {
                let toggle_id = egui::Id::new(format!("toggle_wh_{}", i));
                if let Some(new_val) = ui.memory(|m| m.data.get_temp::<bool>(toggle_id)) {
                    ui.memory_mut(|m| m.data.remove::<bool>(toggle_id));
                    if !state.require_admin("Modifier la destination des alertes (webhook)") {
                        continue;
                    }
                    state.alerting.webhooks[i].enabled = new_val;
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

            // Deferred delete: administrator mode, then a confirmation.
            let delete_id: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("delete_wh_id")));
            if let Some(wid) = delete_id {
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("delete_wh_id")));
                if state.require_admin("Supprimer un webhook") {
                    modal::ask_confirmation(ui.ctx(), WEBHOOK_DELETE_CONFIRM, wid);
                }
            }
        }

        if let Some(wid) = modal::pending_confirmation::<String>(ui.ctx(), WEBHOOK_DELETE_CONFIRM) {
            let name = state
                .alerting
                .webhooks
                .iter()
                .find(|w| w.id == wid)
                .map_or_else(|| wid.clone(), |w| w.name.clone());
            if modal::resolve_confirmation::<String>(
                ui.ctx(),
                WEBHOOK_DELETE_CONFIRM,
                "Supprimer le webhook ?",
                &format!(
                    "« {name} » ne recevra plus aucune alerte. Cette action est irréversible."
                ),
                "Supprimer",
            ) {
                state.alerting.webhooks.retain(|w| w.id != wid);
                command = Some(GuiCommand::DeleteWebhook { webhook_id: wid });
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

        // One label per format the agent can actually shape a message for.
        let format_options = WEBHOOK_FORMATS.map(|(value, _)| value);
        let format_labels = WEBHOOK_FORMATS.map(|(_, label)| label);

        let url_check = agent_common::webhook::validate_webhook_url(&url);

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
                    if let Err(error) = &url_check
                        && !url.trim().is_empty()
                    {
                        ui.label(
                            egui::RichText::new(error.message_fr())
                                .font(theme::font_small())
                                .color(theme::readable_color(theme::ERROR)),
                        );
                    }
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
                    widgets::toggle_switch_labeled(ui, &mut enabled, "Activer à la création");
                });
            });

            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                let can_save = !name.trim().is_empty() && url_check.is_ok();
                let save =
                    widgets::primary_button(ui, format!("{}  Enregistrer", icons::CHECK), can_save);
                let save = if can_save {
                    save
                } else if name.trim().is_empty() {
                    save.on_hover_text("Donnez un nom au webhook.")
                } else {
                    save.on_hover_text("Saisissez une URL https:// valide.")
                };
                if save.clicked()
                    && can_save
                    && state.require_admin("Modifier la destination des alertes (webhook)")
                {
                    let webhook = WebhookConfig {
                        id: uuid::Uuid::new_v4().to_string(),
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
        let ts = crate::format::local_datetime(notif.timestamp);
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
                        notification_severity_label(&severity),
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

    fn export_notifications_csv(state: &AppState) -> Result<std::path::PathBuf, String> {
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
        crate::export::export_csv(headers, &rows, &path)?;
        Ok(path)
    }
}

fn notification_severity_label(severity: &str) -> &str {
    match severity {
        "critical" => "CRITIQUE",
        "high" => "ÉLEVÉ",
        "medium" => "MOYEN",
        "low" => "FAIBLE",
        "info" => "INFO",
        _ => severity,
    }
}

fn parse_escalation(value: &str) -> Result<Option<u32>, ()> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(None);
    }
    value
        .parse::<u32>()
        .ok()
        .filter(|minutes| *minutes > 0)
        .map(Some)
        .ok_or(())
}

/// One notification as a list row: unread dot, severity stripe and pill,
/// title and body on one line each, time on the right. Returns true when
/// clicked.
fn notification_row(ui: &mut Ui, notif: &crate::dto::GuiNotification, selected: bool) -> bool {
    let severity = theme::severity_color(&notif.severity);
    let height = 56.0;
    let (rect, response) = ui.allocate_exact_size(
        egui::vec2(ui.available_width(), height),
        egui::Sense::click(),
    );
    response.widget_info(|| {
        egui::WidgetInfo::labeled(
            egui::WidgetType::Button,
            true,
            format!(
                "{}{} — {}",
                if notif.read { "" } else { "Non lue · " },
                notif.title,
                notif.body
            ),
        )
    });
    if !ui.is_rect_visible(rect) {
        return response.clicked();
    }
    let hover = crate::animation::animate_hover(ui.ctx(), response.id, response.hovered());
    let painter = ui.painter();
    let radius = egui::CornerRadius::same(theme::ROUNDING_MD);
    let base = if selected {
        theme::selected_bg()
    } else if notif.read {
        theme::bg_secondary()
    } else {
        theme::color_blend_pub(theme::bg_secondary(), severity, 0.05)
    };
    painter.rect_filled(
        rect.shrink2(egui::vec2(0.0, 2.0)),
        radius,
        crate::animation::lerp_color(base, theme::table_row_hover(), hover),
    );
    painter.rect_filled(
        egui::Rect::from_min_size(
            rect.left_top() + egui::vec2(0.0, 10.0),
            egui::vec2(3.0, height - 20.0),
        ),
        2.0,
        theme::readable_color(severity),
    );
    let mut x = rect.left() + theme::SPACE_MD;
    if !notif.read {
        painter.circle_filled(
            egui::pos2(x + 3.0, rect.center().y),
            4.0,
            theme::accent_text(),
        );
    }
    x += theme::SPACE_MD;

    // Severity pill.
    let label = notification_severity_label(&notif.severity);
    let ink = theme::badge_text(severity);
    let galley = painter.layout_no_wrap(label.to_owned(), theme::font_label(), ink);
    let pill = egui::Rect::from_min_size(
        egui::pos2(x, rect.center().y - 11.0),
        egui::vec2(galley.size().x + theme::SPACE_SM * 2.0, 22.0),
    );
    painter.rect_filled(
        pill,
        egui::CornerRadius::same(11),
        theme::badge_bg(severity),
    );
    painter.galley(pill.center() - galley.size() / 2.0, galley, ink);
    x = pill.right().max(x + 84.0) + theme::SPACE_MD;

    // Time on the right, title and body between.
    let time = notif
        .timestamp
        .with_timezone(&chrono::Local)
        .format("%H:%M")
        .to_string();
    let time_galley = painter.layout_no_wrap(time, theme::font_caption(), theme::text_tertiary());
    let time_x = rect.right() - theme::SPACE_MD - time_galley.size().x;
    painter.galley(
        egui::pos2(time_x, rect.center().y - time_galley.size().y / 2.0),
        time_galley,
        theme::text_tertiary(),
    );
    let text_rect = egui::Rect::from_min_max(
        egui::pos2(x, rect.top()),
        egui::pos2(time_x - theme::SPACE_MD, rect.bottom()),
    );
    let clip = painter.with_clip_rect(text_rect);
    let title_font = if notif.read {
        theme::font_body()
    } else {
        theme::font_body_strong()
    };
    clip.text(
        egui::pos2(x, rect.top() + 9.0),
        egui::Align2::LEFT_TOP,
        &notif.title,
        title_font,
        theme::text_primary(),
    );
    clip.text(
        egui::pos2(x, rect.bottom() - 9.0),
        egui::Align2::LEFT_BOTTOM,
        &notif.body,
        theme::font_caption(),
        theme::text_secondary(),
    );
    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response.clicked()
}

/// Scheme and host of a webhook URL, its path replaced by dots.
fn mask_webhook_url(url: &str) -> String {
    let (scheme, rest) = url.split_once("://").unwrap_or(("", url));
    let authority = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    // Credentials before the host are a secret too.
    let host = authority.rsplit('@').next().unwrap_or(authority);
    let masked = if rest.len() > authority.len() {
        "/••••••"
    } else {
        ""
    };
    if scheme.is_empty() {
        format!("{host}{masked}")
    } else {
        format!("{scheme}://{host}{masked}")
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn webhook_urls_show_their_host_only() {
        assert_eq!(
            super::mask_webhook_url("https://hooks.slack.com/services/T0/B0/secret"),
            "https://hooks.slack.com/••••••"
        );
        assert_eq!(
            super::mask_webhook_url("https://user:pw@siem.example.org"),
            "https://siem.example.org"
        );
    }

    use super::parse_escalation;

    #[test]
    fn escalation_never_silently_discards_invalid_input() {
        assert_eq!(parse_escalation("  "), Ok(None));
        assert_eq!(parse_escalation(" 30 "), Ok(Some(30)));
        for value in ["0", "-1", "1.5", "demain", "4294967296"] {
            assert!(parse_escalation(value).is_err(), "{value}");
        }
    }
}
