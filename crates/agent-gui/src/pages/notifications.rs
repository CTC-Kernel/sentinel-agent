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

/// Rule types the form offers. Escalation is left out: the agent keeps no
/// acknowledgement state, so such a rule would never fire.
const RULE_TYPES: [AlertRuleType; 2] =
    [AlertRuleType::SeverityThreshold, AlertRuleType::TypeFilter];

/// Severities of the threshold field, most severe first.
const SEVERITIES: [Severity; 5] = [
    Severity::Critical,
    Severity::High,
    Severity::Medium,
    Severity::Low,
    Severity::Info,
];

/// Incident types the agent raises, as it reports them, with their labels.
const INCIDENT_TYPES: [(&str, &str); 10] = [
    ("malware", "Logiciel malveillant"),
    ("suspicious_process", "Processus suspect"),
    ("unauthorized_change", "Modification non autorisée"),
    ("data_exfiltration", "Exfiltration de données"),
    ("crypto_miner", "Minage de cryptomonnaie"),
    ("reverse_shell", "Shell inversé"),
    ("credential_theft", "Vol d'identifiants"),
    ("privilege_escalation", "Élévation de privilèges"),
    ("firewall_disabled", "Pare-feu désactivé"),
    ("antivirus_disabled", "Antivirus désactivé"),
];

/// Letters and digits of a type name, lower-cased: the comparison the agent
/// makes, so `ReverseShell` and `reverse_shell` name the same type.
fn incident_type_key(name: &str) -> String {
    name.chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// The incident types of a rule, by their labels, for the list.
fn incident_types_summary(types: &[String]) -> String {
    types
        .iter()
        .map(|stored| {
            INCIDENT_TYPES
                .iter()
                .find(|(key, _)| incident_type_key(key) == incident_type_key(stored))
                .map_or(stored.as_str(), |(_, label)| *label)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// Names of the two tables, for their sort state.
const RULES_TABLE: &str = "alert_rules";
const WEBHOOKS_TABLE: &str = "alert_webhooks";

/// Text order that ignores case.
fn text_order(a: &str, b: &str) -> std::cmp::Ordering {
    a.to_lowercase().cmp(&b.to_lowercase())
}

/// Rank of a threshold, least severe first; no threshold comes before all.
fn threshold_rank(severity: Option<Severity>) -> u8 {
    match severity {
        None => 0,
        Some(Severity::Info) => 1,
        Some(Severity::Low) => 2,
        Some(Severity::Medium) => 3,
        Some(Severity::High) => 4,
        Some(Severity::Critical) => 5,
    }
}

/// Natural (ascending) order of two rules on a column of their table.
fn compare_rules(a: &AlertRule, b: &AlertRule, key: &str) -> std::cmp::Ordering {
    match key {
        "name" => text_order(&a.name, &b.name),
        "type" => text_order(a.rule_type.label_fr(), b.rule_type.label_fr()),
        "threshold" => {
            threshold_rank(a.severity_threshold).cmp(&threshold_rank(b.severity_threshold))
        }
        // "Tous" (no type listed) first, then by the labels shown.
        "incidents" => text_order(
            &incident_types_summary(&a.detection_types),
            &incident_types_summary(&b.detection_types),
        ),
        "enabled" => a.enabled.cmp(&b.enabled),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Natural (ascending) order of two webhooks on a column of their table.
fn compare_webhooks(a: &WebhookConfig, b: &WebhookConfig, key: &str) -> std::cmp::Ordering {
    match key {
        "name" => text_order(&a.name, &b.name),
        // As displayed: by host, never by the secret path.
        "url" => text_order(&mask_webhook_url(&a.url), &mask_webhook_url(&b.url)),
        "format" => text_order(
            &webhook_format_label(&a.format),
            &webhook_format_label(&b.format),
        ),
        // Chronological; a webhook never used comes first.
        "last_sent" => a.last_sent.cmp(&b.last_sent),
        "enabled" => a.enabled.cmp(&b.enabled),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Indices of `items` in the order `sort` asks for (stable; the stored
/// order when no column is sorted).
fn sorted_indices<T>(
    items: &[T],
    sort: &widgets::TableSort,
    compare: impl Fn(&T, &T, &str) -> std::cmp::Ordering,
) -> Vec<usize> {
    let mut order: Vec<usize> = (0..items.len()).collect();
    if let Some(key) = widgets::table::sort_key(sort) {
        order.sort_by(|&a, &b| widgets::table::directed(sort, compare(&items[a], &items[b], key)));
    }
    order
}

/// egui memory slots of the two forms.
const RULE_DRAFT: &str = "alert_rule_draft";
const WEBHOOK_DRAFT: &str = "webhook_draft";

fn load_draft<T: Clone + Default + Send + Sync + 'static>(ctx: &egui::Context, slot: &str) -> T {
    ctx.data(|d| d.get_temp(egui::Id::new(slot)))
        .unwrap_or_default()
}

fn store_draft<T: Clone + Send + Sync + 'static>(ctx: &egui::Context, slot: &str, draft: T) {
    ctx.data_mut(|d| d.insert_temp(egui::Id::new(slot), draft));
}

fn clear_draft<T: Clone + Send + Sync + 'static>(ctx: &egui::Context, slot: &str) {
    ctx.data_mut(|d| d.remove::<T>(egui::Id::new(slot)));
}

/// What the alert rule form holds while it is open.
#[derive(Debug, Clone, PartialEq)]
struct RuleDraft {
    /// Identifier and creation date of the rule being edited; `None` for a
    /// new rule.
    editing: Option<(String, chrono::DateTime<chrono::Utc>)>,
    name: String,
    /// Index into [`RULE_TYPES`].
    type_idx: usize,
    severity: Option<Severity>,
    /// Incident types, as the agent reports them.
    types: Vec<String>,
    enabled: bool,
}

impl Default for RuleDraft {
    fn default() -> Self {
        Self {
            editing: None,
            name: String::new(),
            type_idx: 0,
            severity: Some(Severity::Critical),
            types: Vec::new(),
            enabled: true,
        }
    }
}

impl RuleDraft {
    /// The form opened on an existing rule. An escalation rule, which the
    /// form no longer offers, opens as a severity threshold.
    fn of(rule: &AlertRule) -> Self {
        Self {
            editing: Some((rule.id.clone(), rule.created_at)),
            name: rule.name.clone(),
            type_idx: RULE_TYPES
                .iter()
                .position(|t| *t == rule.rule_type)
                .unwrap_or(0),
            severity: rule.severity_threshold,
            // Stored names are brought back to the keys of the selector.
            types: rule
                .detection_types
                .iter()
                .map(|stored| {
                    INCIDENT_TYPES
                        .iter()
                        .find(|(key, _)| incident_type_key(key) == incident_type_key(stored))
                        .map_or_else(|| stored.clone(), |(key, _)| (*key).to_string())
                })
                .collect(),
            enabled: rule.enabled,
        }
    }

    /// The rule the form describes. A threshold rule lists no type and
    /// always carries a severity.
    fn to_rule(&self) -> AlertRule {
        let rule_type = RULE_TYPES[self.type_idx.min(RULE_TYPES.len() - 1)];
        let by_type = rule_type == AlertRuleType::TypeFilter;
        let (id, created_at) = self
            .editing
            .clone()
            .unwrap_or_else(|| (uuid::Uuid::new_v4().to_string(), chrono::Utc::now()));
        AlertRule {
            id,
            name: self.name.trim().to_string(),
            rule_type,
            severity_threshold: if by_type {
                self.severity
            } else {
                Some(self.severity.unwrap_or(Severity::Critical))
            },
            detection_types: if by_type {
                self.types.clone()
            } else {
                Vec::new()
            },
            escalation_minutes: None,
            enabled: self.enabled,
            created_at,
        }
    }
}

/// What the webhook form holds while it is open.
#[derive(Debug, Clone, PartialEq)]
struct WebhookDraft {
    /// Identifier of the webhook being edited; `None` for a new one.
    editing: Option<String>,
    name: String,
    url: String,
    /// Index into [`WEBHOOK_FORMATS`].
    format_idx: usize,
    enabled: bool,
}

impl Default for WebhookDraft {
    fn default() -> Self {
        Self {
            editing: None,
            name: String::new(),
            url: String::new(),
            format_idx: 0,
            enabled: true,
        }
    }
}

impl WebhookDraft {
    fn of(webhook: &WebhookConfig) -> Self {
        Self {
            editing: Some(webhook.id.clone()),
            name: webhook.name.clone(),
            url: webhook.url.clone(),
            format_idx: WEBHOOK_FORMATS
                .iter()
                .position(|(value, _)| *value == webhook.format)
                // Unknown formats are sent as generic JSON.
                .unwrap_or(WEBHOOK_FORMATS.len() - 1),
            enabled: webhook.enabled,
        }
    }

    /// The webhook the form describes; an edited one keeps its identifier
    /// and the outcome of its last delivery.
    fn to_webhook(&self, previous: Option<&WebhookConfig>) -> WebhookConfig {
        WebhookConfig {
            id: self
                .editing
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            name: self.name.trim().to_string(),
            url: self.url.trim().to_string(),
            format: WEBHOOK_FORMATS[self.format_idx.min(WEBHOOK_FORMATS.len() - 1)]
                .0
                .to_string(),
            enabled: self.enabled,
            last_sent: previous.and_then(|w| w.last_sent),
            error: previous.and_then(|w| w.error.clone()),
        }
    }
}

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

            // Search and filters, kept in egui memory like the forms of the
            // other tabs.
            let search_id = egui::Id::new("notifications_search");
            let unread_id = egui::Id::new("notifications_unread_only");
            let level_id = egui::Id::new("notifications_level");
            let mut search: String = ui
                .memory(|m| m.data.get_temp(search_id))
                .unwrap_or_default();
            let mut unread_only: bool = ui.memory(|m| m.data.get_temp(unread_id)).unwrap_or(false);
            let mut level: Option<NotificationLevel> =
                ui.memory(|m| m.data.get_temp(level_id)).unwrap_or(None);
            let previous_search = search.clone();

            let filtered =
                filtered_notifications(&state.notifications, &search, unread_only, level);
            let toggled =
                widgets::SearchFilterBar::new(&mut search, "Rechercher une notification…")
                    .chip("NON LUES", unread_only, theme::ACCENT)
                    .chip(
                        "CRITIQUES",
                        level == Some(NotificationLevel::Critical),
                        theme::ERROR,
                    )
                    .chip(
                        "AVERTISSEMENTS",
                        level == Some(NotificationLevel::Warning),
                        theme::WARNING,
                    )
                    .chip(
                        "INFORMATIONS",
                        level == Some(NotificationLevel::Info),
                        theme::INFO,
                    )
                    .result_count(filtered.len())
                    .show(ui);
            if let Some(chip) = toggled {
                let picked = match chip {
                    1 => Some(NotificationLevel::Critical),
                    2 => Some(NotificationLevel::Warning),
                    3 => Some(NotificationLevel::Info),
                    _ => None,
                };
                if chip == 0 {
                    unread_only = !unread_only;
                } else if level == picked {
                    level = None;
                } else {
                    level = picked;
                }
            }
            // A changed filter starts again from the first page.
            let filter_changed = toggled.is_some() || search != previous_search;
            let filtered = if filter_changed {
                state.notifications_page = 0;
                filtered_notifications(&state.notifications, &search, unread_only, level)
            } else {
                filtered
            };
            ui.memory_mut(|m| {
                m.data.insert_temp(search_id, search);
                m.data.insert_temp(unread_id, unread_only);
                m.data.insert_temp(level_id, level);
            });
            ui.add_space(theme::SPACE_MD);

            let (nf_start, nf_len, _) = widgets::page_window(
                filtered.len(),
                NOTIF_PER_PAGE,
                &mut state.notifications_page,
            );
            // One card holding a dense list grouped by day: tall standalone
            // cards showed four notifications a screen and repeated "Non
            // lue" on every one. Unread is an accent dot and a bold title.
            // The newest notification comes first.
            let today = chrono::Local::now().date_naive();
            let mut current_day = None;
            widgets::data_card(ui, "Notifications", |ui: &mut egui::Ui| {
                if filtered.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::SEARCH,
                        "Aucun r\u{00e9}sultat",
                        Some("Modifiez votre recherche ou vos filtres."),
                    );
                    return;
                }
                for (offset, &idx) in filtered.iter().skip(nf_start).take(nf_len).enumerate() {
                    let Some(notif) = state.notifications.get(idx) else {
                        continue;
                    };
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
            let mut position = state
                .selected_notification
                .and_then(|selected| filtered.iter().position(|&idx| idx == selected));
            if widgets::navigate_list(
                ui.ctx(),
                &mut position,
                filtered.len(),
                &mut state.notification_detail_open,
            ) && let Some(pos) = position
                && let Some(&idx) = filtered.get(pos)
            {
                state.selected_notification = Some(idx);
                state.notifications_page = pos / NOTIF_PER_PAGE;
            }

            widgets::paginate_controls(
                ui,
                filtered.len(),
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
                store_draft(ui.ctx(), RULE_DRAFT, RuleDraft::default());
                state.alerting.editing_rule = true;
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Inline create / edit form
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
            let rule_order = sorted_indices(
                &state.alerting.rules,
                &widgets::table::sort_of(ui.ctx(), RULES_TABLE),
                compare_rules,
            );
            widgets::data_card(ui, "Règles d’alerte", |ui: &mut egui::Ui| {
                ui.push_id("alert_rules_table", |ui: &mut egui::Ui| {
                    use widgets::table;

                    table::fluid(
                        ui,
                        &[
                            table::Col::fluid(160.0, 2.0), // Nom
                            table::Col::fluid(150.0, 1.0), // Type
                            table::Col::fluid(90.0, 0.0),  // Seuil
                            table::Col::fluid(140.0, 2.0), // Incidents
                            table::Col::fixed(72.0),       // Activé
                            table::Col::fixed(104.0),      // Actions
                        ],
                    )
                    .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                        for (label, key) in [
                            ("NOM", "name"),
                            ("TYPE", "type"),
                            ("SEUIL", "threshold"),
                            ("INCIDENTS", "incidents"),
                            ("ACTIV\u{00c9}", "enabled"),
                        ] {
                            header.col(|ui: &mut egui::Ui| {
                                table::header_cell_sortable(ui, label, RULES_TABLE, key);
                            });
                        }
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIONS");
                        });
                    })
                    .body(|mut body| {
                        // Rows in the sorted order; `i` stays the rule's index.
                        for &i in &rule_order {
                            body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                                let rule = &state.alerting.rules[i];
                                let rule_id = rule.id.to_string();

                                row.col(|ui: &mut egui::Ui| {
                                    table::cell_strong(ui, &rule.name);
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    // Escalation rules may still come from the
                                    // platform; the agent does not evaluate them.
                                    if rule.rule_type == AlertRuleType::EscalationDelay {
                                        widgets::status_badge(
                                            ui,
                                            "Escalade · non évaluée",
                                            theme::WARNING,
                                        );
                                    } else {
                                        widgets::status_badge(
                                            ui,
                                            rule.rule_type.label_fr(),
                                            theme::INFO,
                                        );
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| match rule.severity_threshold {
                                    Some(severity) => {
                                        widgets::status_badge(
                                            ui,
                                            severity.label(),
                                            theme::severity_color_typed(&severity),
                                        );
                                    }
                                    None => {
                                        table::cell_empty(ui);
                                    }
                                });
                                row.col(|ui: &mut egui::Ui| {
                                    if rule.detection_types.is_empty() {
                                        table::cell_secondary(ui, "Tous");
                                    } else {
                                        table::cell_small(
                                            ui,
                                            &incident_types_summary(&rule.detection_types),
                                        );
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
                                    ui.horizontal(|ui: &mut egui::Ui| {
                                        if widgets::button::icon_button(
                                            ui,
                                            icons::PENCIL,
                                            Some("Modifier la règle"),
                                        )
                                        .clicked()
                                        {
                                            ui.memory_mut(|m| {
                                                m.data.insert_temp(
                                                    egui::Id::new("edit_rule_id"),
                                                    rule_id.clone(),
                                                );
                                            });
                                        }
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
                                                    rule_id.clone(),
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

            // Process deferred toggle actions. Switching a rule off silences
            // its alerts, as deleting it does: administrator mode first.
            for i in 0..state.alerting.rules.len() {
                let toggle_id = egui::Id::new(format!("toggle_rule_{}", i));
                if let Some(new_val) = ui.memory(|m| m.data.get_temp::<bool>(toggle_id)) {
                    ui.memory_mut(|m| m.data.remove::<bool>(toggle_id));
                    if !new_val && !state.require_admin("Désactiver une règle d'alerte") {
                        continue;
                    }
                    state.alerting.rules[i].enabled = new_val;
                    let updated = state.alerting.rules[i].clone();
                    command = Some(GuiCommand::SaveAlertRule {
                        rule: Box::new(updated),
                    });
                }
            }

            // Deferred edit: open the form on the rule's current values.
            let edit_id: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("edit_rule_id")));
            if let Some(rid) = edit_id {
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("edit_rule_id")));
                if let Some(rule) = state.alerting.rules.iter().find(|r| r.id == rid) {
                    store_draft(ui.ctx(), RULE_DRAFT, RuleDraft::of(rule));
                    state.alerting.editing_rule = true;
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
                    "« {name} » ne déclenchera plus aucune alerte. \
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

    /// Inline form creating an alert rule, or editing the one it was opened on.
    fn alert_rule_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let mut draft: RuleDraft = load_draft(ui.ctx(), RULE_DRAFT);
        let mut close = false;

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(if draft.editing.is_some() {
                    "MODIFIER LA R\u{00c8}GLE D'ALERTE"
                } else {
                    "NOUVELLE R\u{00c8}GLE D'ALERTE"
                })
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            let rule_type = RULE_TYPES[draft.type_idx.min(RULE_TYPES.len() - 1)];
            // A type filter may apply to every severity; a threshold rule
            // always names one.
            let mut severities: Vec<(Option<Severity>, &str)> = SEVERITIES
                .iter()
                .map(|severity| (Some(*severity), severity.label()))
                .collect();
            if rule_type == AlertRuleType::TypeFilter {
                severities.insert(0, (None, "Toutes"));
            }

            widgets::form::fields(ui, |ui: &mut egui::Ui| {
                widgets::form::field(ui, "Nom", 300.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut draft.name, "Nom de la r\u{00e8}gle…");
                });
                widgets::form::field(ui, "Type", 200.0, |ui: &mut egui::Ui| {
                    let type_labels: Vec<&str> = RULE_TYPES.iter().map(|t| t.label_fr()).collect();
                    widgets::dropdown_width(
                        ui,
                        "rule_type_combo",
                        &type_labels,
                        &mut draft.type_idx,
                        200.0,
                    );
                });
                widgets::form::field(
                    ui,
                    "S\u{00e9}v\u{00e9}rit\u{00e9} minimale",
                    150.0,
                    |ui: &mut egui::Ui| {
                        let labels: Vec<&str> =
                            severities.iter().map(|(_, label)| *label).collect();
                        let mut index = severities
                            .iter()
                            .position(|(severity, _)| *severity == draft.severity)
                            .unwrap_or(0);
                        widgets::dropdown_width(
                            ui,
                            ("rule_severity_combo", severities.len()),
                            &labels,
                            &mut index,
                            150.0,
                        );
                        draft.severity = severities[index.min(severities.len() - 1)].0;
                    },
                );
                widgets::form::field(ui, "Activ\u{00e9}", 72.0, |ui: &mut egui::Ui| {
                    widgets::toggle_switch_labeled(ui, &mut draft.enabled, "Activer la règle");
                });
            });

            if rule_type == AlertRuleType::TypeFilter {
                ui.add_space(theme::SPACE_SM);
                widgets::form::label(ui, "Types d'incident");
                ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                    for (key, label) in INCIDENT_TYPES {
                        let active = draft.types.iter().any(|t| t == key);
                        if widgets::chip_button(ui, label, active, theme::ACCENT).clicked() {
                            if active {
                                draft.types.retain(|t| t != key);
                            } else {
                                draft.types.push(key.to_string());
                            }
                        }
                    }
                });
            }

            ui.add_space(theme::SPACE_SM);

            let missing_types = rule_type == AlertRuleType::TypeFilter && draft.types.is_empty();
            if missing_types {
                ui.label(
                    egui::RichText::new("Sélectionnez au moins un type d'incident.")
                        .font(theme::font_small())
                        .color(theme::readable_color(theme::ERROR)),
                );
            }
            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                let can_save = !draft.name.trim().is_empty() && !missing_types;
                if widgets::primary_button(ui, format!("{}  Enregistrer", icons::CHECK), can_save)
                    .clicked()
                    && can_save
                    // Editing can raise a threshold or drop a type, which
                    // silences alerts as a deletion would.
                    && (draft.editing.is_none()
                        || state.require_admin("Modifier une règle d'alerte"))
                {
                    let rule = draft.to_rule();
                    match state.alerting.rules.iter_mut().find(|r| r.id == rule.id) {
                        Some(existing) => *existing = rule.clone(),
                        None => state.alerting.rules.push(rule.clone()),
                    }
                    *command = Some(GuiCommand::SaveAlertRule {
                        rule: Box::new(rule),
                    });
                    close = true;
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, "Annuler").clicked() {
                    close = true;
                }
            });
        });

        if close {
            state.alerting.editing_rule = false;
            clear_draft::<RuleDraft>(ui.ctx(), RULE_DRAFT);
        } else {
            store_draft(ui.ctx(), RULE_DRAFT, draft);
        }
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
                store_draft(ui.ctx(), WEBHOOK_DRAFT, WebhookDraft::default());
                state.alerting.editing_webhook = true;
            }
        });

        ui.add_space(theme::SPACE_MD);

        // Inline create / edit form
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
            let webhook_order = sorted_indices(
                &state.alerting.webhooks,
                &widgets::table::sort_of(ui.ctx(), WEBHOOKS_TABLE),
                compare_webhooks,
            );
            widgets::data_card(ui, "Webhooks", |ui: &mut egui::Ui| {
                ui.push_id("webhooks_table", |ui: &mut egui::Ui| {
                    use widgets::table;

                    table::fluid(
                        ui,
                        &[
                            table::Col::fluid(120.0, 1.0), // Nom
                            table::Col::fluid(160.0, 3.0), // URL
                            table::Col::fluid(72.0, 0.0),  // Format
                            table::Col::fluid(124.0, 0.5), // Dernier envoi
                            table::Col::fixed(72.0),       // Activé
                            table::Col::fixed(196.0),      // Actions
                        ],
                    )
                    .header(theme::TABLE_HEADER_HEIGHT, |mut header| {
                        for (label, key) in [
                            ("NOM", "name"),
                            ("URL", "url"),
                            ("FORMAT", "format"),
                            ("DERNIER ENVOI", "last_sent"),
                            ("ACTIV\u{00c9}", "enabled"),
                        ] {
                            header.col(|ui: &mut egui::Ui| {
                                table::header_cell_sortable(ui, label, WEBHOOKS_TABLE, key);
                            });
                        }
                        header.col(|ui: &mut egui::Ui| {
                            table::header_cell(ui, "ACTIONS");
                        });
                    })
                    .body(|mut body| {
                        // Rows in the sorted order; `i` stays the webhook's index.
                        for &i in &webhook_order {
                            body.row(theme::TABLE_ROW_HEIGHT, |mut row| {
                                let wh = &state.alerting.webhooks[i];
                                let wh_id = wh.id.to_string();

                                row.col(|ui: &mut egui::Ui| {
                                    table::cell_strong(ui, &wh.name);
                                });
                                row.col(|ui: &mut egui::Ui| {
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
                                row.col(|ui: &mut egui::Ui| match (&wh.error, wh.last_sent) {
                                    // The last delivery failed: say so, with
                                    // the reason on hover.
                                    (Some(error), _) => {
                                        ui.scope(|ui| {
                                            widgets::status_badge(
                                                ui,
                                                "Échec d'envoi",
                                                theme::ERROR,
                                            );
                                        })
                                        .response
                                        .on_hover_text(format!("Dernier envoi en échec : {error}"));
                                    }
                                    (None, Some(dt)) => {
                                        table::cell_muted(ui, &crate::format::local_datetime(dt));
                                    }
                                    (None, None) => {
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
                                        if widgets::button::icon_button(
                                            ui,
                                            icons::PENCIL,
                                            Some("Modifier le webhook"),
                                        )
                                        .clicked()
                                        {
                                            ui.memory_mut(|m| {
                                                m.data.insert_temp(
                                                    egui::Id::new("edit_wh_id"),
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

            // Deferred edit. The form shows the full URL, secret included:
            // administrator mode first.
            let edit_id: Option<String> =
                ui.memory(|m| m.data.get_temp(egui::Id::new("edit_wh_id")));
            if let Some(wid) = edit_id {
                ui.memory_mut(|m| m.data.remove::<String>(egui::Id::new("edit_wh_id")));
                if state.require_admin("Modifier la destination des alertes (webhook)")
                    && let Some(webhook) = state.alerting.webhooks.iter().find(|w| w.id == wid)
                {
                    store_draft(ui.ctx(), WEBHOOK_DRAFT, WebhookDraft::of(webhook));
                    state.alerting.editing_webhook = true;
                }
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

    /// Inline form creating a webhook, or editing the one it was opened on.
    fn webhook_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
        let mut draft: WebhookDraft = load_draft(ui.ctx(), WEBHOOK_DRAFT);
        let mut close = false;

        // One label per format the agent can actually shape a message for.
        let format_labels = WEBHOOK_FORMATS.map(|(_, label)| label);

        let url_check = agent_common::webhook::validate_webhook_url(&draft.url);

        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(if draft.editing.is_some() {
                    "MODIFIER LE WEBHOOK"
                } else {
                    "NOUVEAU WEBHOOK"
                })
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            widgets::form::fields(ui, |ui: &mut egui::Ui| {
                widgets::form::field(ui, "Nom", 260.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut draft.name, "Nom du webhook…");
                });
                widgets::form::field(ui, "URL", 380.0, |ui: &mut egui::Ui| {
                    widgets::text_input(ui, &mut draft.url, "https://hooks.example.com/…");
                    if let Err(error) = &url_check
                        && !draft.url.trim().is_empty()
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
                        &mut draft.format_idx,
                        150.0,
                    );
                });
                widgets::form::field(ui, "Activ\u{00e9}", 72.0, |ui: &mut egui::Ui| {
                    widgets::toggle_switch_labeled(ui, &mut draft.enabled, "Activer le webhook");
                });
            });

            ui.add_space(theme::SPACE_SM);

            ui.horizontal(|ui: &mut egui::Ui| {
                let can_save = !draft.name.trim().is_empty() && url_check.is_ok();
                let save =
                    widgets::primary_button(ui, format!("{}  Enregistrer", icons::CHECK), can_save);
                let save = if can_save {
                    save
                } else if draft.name.trim().is_empty() {
                    save.on_hover_text("Donnez un nom au webhook.")
                } else {
                    save.on_hover_text("Saisissez une URL https:// valide.")
                };
                if save.clicked()
                    && can_save
                    && state.require_admin("Modifier la destination des alertes (webhook)")
                {
                    let previous = draft
                        .editing
                        .as_ref()
                        .and_then(|id| state.alerting.webhooks.iter().find(|w| &w.id == id));
                    let webhook = draft.to_webhook(previous);
                    match state
                        .alerting
                        .webhooks
                        .iter_mut()
                        .find(|w| w.id == webhook.id)
                    {
                        Some(existing) => *existing = webhook.clone(),
                        None => state.alerting.webhooks.push(webhook.clone()),
                    }
                    *command = Some(GuiCommand::SaveWebhook {
                        webhook: Box::new(webhook),
                    });
                    close = true;
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, "Annuler").clicked() {
                    close = true;
                }
            });
        });

        if close {
            state.alerting.editing_webhook = false;
            clear_draft::<WebhookDraft>(ui.ctx(), WEBHOOK_DRAFT);
        } else {
            store_draft(ui.ctx(), WEBHOOK_DRAFT, draft);
        }
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

/// Severity families the notification list can be narrowed to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NotificationLevel {
    Critical,
    Warning,
    Info,
}

impl NotificationLevel {
    /// The family of a notification severity as the agent writes it.
    fn of(severity: &str) -> Self {
        match severity {
            "critical" | "error" => Self::Critical,
            "info" | "low" | "success" => Self::Info,
            _ => Self::Warning,
        }
    }
}

/// Indices of the notifications to list, newest first, for a search text,
/// the unread filter and a severity family.
fn filtered_notifications(
    notifications: &[crate::dto::GuiNotification],
    search: &str,
    unread_only: bool,
    level: Option<NotificationLevel>,
) -> Vec<usize> {
    let search = search.trim().to_lowercase();
    notifications
        .iter()
        .enumerate()
        .rev()
        .filter(|(_, n)| {
            (!unread_only || !n.read)
                && level.is_none_or(|level| NotificationLevel::of(&n.severity) == level)
                && (search.is_empty()
                    || n.title.to_lowercase().contains(&search)
                    || n.body.to_lowercase().contains(&search))
        })
        .map(|(idx, _)| idx)
        .collect()
}

fn notification_severity_label(severity: &str) -> &str {
    match severity {
        "critical" => "CRITIQUE",
        "high" => "ÉLEVÉ",
        "medium" => "MOYEN",
        "low" => "FAIBLE",
        "info" => "INFO",
        "error" => "ERREUR",
        "warning" => "AVERTISSEMENT",
        "success" => "SUCCÈS",
        _ => severity,
    }
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

    use super::*;

    fn notification(title: &str, severity: &str, read: bool) -> crate::dto::GuiNotification {
        let mut n = crate::dto::GuiNotification::info(title, "corps");
        n.severity = severity.to_string();
        n.read = read;
        n
    }

    #[test]
    fn notifications_are_listed_newest_first_and_filtered() {
        let list = vec![
            notification("Ancienne alerte", "critical", true),
            notification("Scan terminé", "info", false),
            notification("Webhook refusé", "error", false),
        ];
        assert_eq!(filtered_notifications(&list, "", false, None), [2, 1, 0]);
        assert_eq!(filtered_notifications(&list, "", true, None), [2, 1]);
        assert_eq!(
            filtered_notifications(&list, "", false, Some(NotificationLevel::Critical)),
            [2, 0]
        );
        assert_eq!(filtered_notifications(&list, " SCAN ", false, None), [1]);
        assert!(
            filtered_notifications(&list, "scan", true, Some(NotificationLevel::Critical))
                .is_empty()
        );
    }

    #[test]
    fn the_rule_form_never_produces_an_escalation_rule() {
        assert!(!RULE_TYPES.contains(&AlertRuleType::EscalationDelay));
        let escalation = AlertRule {
            id: "r1".into(),
            name: "Ancienne escalade".into(),
            rule_type: AlertRuleType::EscalationDelay,
            severity_threshold: None,
            detection_types: Vec::new(),
            escalation_minutes: Some(30),
            enabled: true,
            created_at: chrono::Utc::now(),
        };
        let edited = RuleDraft::of(&escalation).to_rule();
        assert_eq!(edited.id, "r1");
        assert_eq!(edited.created_at, escalation.created_at);
        assert_eq!(edited.rule_type, AlertRuleType::SeverityThreshold);
        assert_eq!(edited.severity_threshold, Some(Severity::Critical));
        assert_eq!(edited.escalation_minutes, None);
    }

    #[test]
    fn a_type_filter_keeps_its_types_and_a_threshold_drops_them() {
        let mut draft = RuleDraft {
            name: "  Shells  ".into(),
            type_idx: 1,
            severity: None,
            types: vec!["reverse_shell".into()],
            ..RuleDraft::default()
        };
        let rule = draft.to_rule();
        assert_eq!(rule.name, "Shells");
        assert_eq!(rule.rule_type, AlertRuleType::TypeFilter);
        assert_eq!(rule.severity_threshold, None);
        assert_eq!(rule.detection_types, ["reverse_shell"]);
        assert_eq!(RuleDraft::of(&rule).types, ["reverse_shell"]);

        draft.type_idx = 0;
        let rule = draft.to_rule();
        assert!(rule.detection_types.is_empty());
        assert_eq!(rule.severity_threshold, Some(Severity::Critical));
        assert_eq!(
            incident_types_summary(&["ReverseShell".into(), "autre".into()]),
            "Shell inversé, autre"
        );
    }

    #[test]
    fn rules_and_webhooks_sort_by_meaning_not_by_spelling() {
        use crate::widgets::{SortDirection, TableSort};
        let rule = |name: &str, severity: Option<Severity>, enabled: bool| AlertRule {
            id: name.into(),
            name: name.into(),
            rule_type: AlertRuleType::SeverityThreshold,
            severity_threshold: severity,
            detection_types: Vec::new(),
            escalation_minutes: None,
            enabled,
            created_at: chrono::Utc::now(),
        };
        let rules = [
            rule("zèbre", Some(Severity::Low), true),
            rule("Alpha", Some(Severity::Critical), false),
            rule("beta", None, true),
            rule("Gamma", Some(Severity::High), true),
        ];
        let names = |sort: &TableSort| -> Vec<&str> {
            sorted_indices(&rules, sort, compare_rules)
                .into_iter()
                .map(|i| rules[i].name.as_str())
                .collect()
        };
        assert_eq!(
            names(&TableSort::default()),
            ["zèbre", "Alpha", "beta", "Gamma"]
        );
        assert_eq!(
            names(&TableSort::by("name", SortDirection::Ascending)),
            ["Alpha", "beta", "Gamma", "zèbre"]
        );
        // By rank, not alphabetically: none, low, high, critical.
        assert_eq!(
            names(&TableSort::by("threshold", SortDirection::Ascending)),
            ["beta", "zèbre", "Gamma", "Alpha"]
        );
        assert_eq!(
            names(&TableSort::by("threshold", SortDirection::Descending)),
            ["Alpha", "Gamma", "zèbre", "beta"]
        );
        // Stable: equal rows keep their stored order.
        assert_eq!(
            names(&TableSort::by("enabled", SortDirection::Ascending)),
            ["Alpha", "zèbre", "beta", "Gamma"]
        );

        let now = chrono::Utc::now();
        let hook = |name: &str, url: &str, last_sent| WebhookConfig {
            id: name.into(),
            name: name.into(),
            url: url.into(),
            format: "slack".into(),
            enabled: true,
            last_sent,
            error: None,
        };
        let hooks = [
            hook("récent", "https://b.example/zzz", Some(now)),
            hook("jamais", "https://c.example/aaa", None),
            hook(
                "ancien",
                "https://A.example/mmm",
                Some(now - chrono::Duration::days(2)),
            ),
        ];
        let order = |key: &str| -> Vec<&str> {
            sorted_indices(
                &hooks,
                &TableSort::by(key, SortDirection::Ascending),
                compare_webhooks,
            )
            .into_iter()
            .map(|i| hooks[i].name.as_str())
            .collect()
        };
        assert_eq!(order("last_sent"), ["jamais", "ancien", "récent"]);
        assert_eq!(order("url"), ["ancien", "récent", "jamais"]);
    }

    #[test]
    fn an_edited_webhook_keeps_its_identity_and_delivery_outcome() {
        let stored = WebhookConfig {
            id: "w1".into(),
            name: "SOC".into(),
            url: "https://hooks.slack.com/services/T0/B0/secret".into(),
            format: "msteams".into(),
            enabled: false,
            last_sent: Some(chrono::Utc::now()),
            error: Some("HTTP 500".into()),
        };
        let mut draft = WebhookDraft::of(&stored);
        assert_eq!(draft.url, stored.url);
        assert_eq!(draft.format_idx, 1);
        draft.name = " SOC nuit ".into();
        let edited = draft.to_webhook(Some(&stored));
        assert_eq!(edited.id, "w1");
        assert_eq!(edited.name, "SOC nuit");
        assert_eq!(edited.format, "msteams");
        assert_eq!(edited.last_sent, stored.last_sent);
        assert_eq!(edited.error, stored.error);
        assert!(!edited.enabled);

        let created = WebhookDraft::default().to_webhook(None);
        assert!(!created.id.is_empty() && created.enabled && created.error.is_none());
    }
}
