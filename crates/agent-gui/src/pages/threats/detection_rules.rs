// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection rules sub-tab — the rules shipped with the agent and the
//! organisation's own: conditions, responses, matches, live testing.

use chrono::Utc;
use egui::Ui;
use uuid::Uuid;

use crate::app::AppState;
use crate::detection_catalog;
use crate::dto::{
    DetectionCondition, DetectionConditionType, DetectionRule, PlaybookActionType, Severity,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::modal;

/// Editing state of the rule form, new or existing rule.
struct RuleForm {
    /// The rule being edited; `None` for a new one.
    editing: Option<DetectionRule>,
    name: String,
    description: String,
    severity_idx: usize,
    conditions: Vec<DetectionCondition>,
    actions: Vec<PlaybookActionType>,
}

impl RuleForm {
    const fn empty() -> Self {
        Self {
            editing: None,
            name: String::new(),
            description: String::new(),
            severity_idx: 2, // Medium by default
            conditions: Vec::new(),
            actions: Vec::new(),
        }
    }

    fn reset(&mut self) {
        *self = Self::empty();
    }

    fn load(&mut self, rule: &DetectionRule) {
        *self = Self {
            editing: Some(rule.clone()),
            name: rule.name.clone(),
            description: rule.description.clone(),
            severity_idx: SEVERITY_OPTIONS
                .iter()
                .position(|s| *s == rule.severity)
                .unwrap_or(2),
            conditions: rule.conditions.clone(),
            // Only the responses a rule can carry out are offered.
            actions: rule
                .actions
                .iter()
                .copied()
                .filter(|a| RULE_ACTIONS.contains(a))
                .collect(),
        };
    }
}

thread_local! {
    static FORM: std::cell::RefCell<RuleForm> = const { std::cell::RefCell::new(RuleForm::empty()) };
}

const SEVERITY_OPTIONS: &[Severity] = &[
    Severity::Critical,
    Severity::High,
    Severity::Medium,
    Severity::Low,
];

/// The responses a rule can carry out on what it found. Notifying is not one:
/// every match is notified. Locking an account and running a command need a
/// parameter a rule has no place for: playbooks do that.
const RULE_ACTIONS: &[PlaybookActionType] = &[
    PlaybookActionType::KillProcess,
    PlaybookActionType::QuarantineFile,
    PlaybookActionType::BlockIp,
    PlaybookActionType::IsolateHost,
    PlaybookActionType::SendSiemAlert,
];

/// What a response acts on, as the form explains it.
fn action_help(action: PlaybookActionType) -> &'static str {
    match action {
        PlaybookActionType::KillProcess => {
            "Arrête les processus trouvés (conditions sur le nom ou la ligne de commande)."
        }
        PlaybookActionType::QuarantineFile => {
            "Met en quarantaine le fichier modifié (condition sur un chemin surveillé)."
        }
        PlaybookActionType::BlockIp => {
            "Bloque une heure l'adresse distante (condition sur un port), plus longtemps en cas de récidive."
        }
        PlaybookActionType::IsolateHost => {
            "Coupe le poste du réseau pendant une heure, la plateforme reste joignable."
        }
        PlaybookActionType::SendSiemAlert => {
            "Exige l'envoi au SIEM externe configuré : la réponse échoue s'il n'y en a pas."
        }
        _ => "",
    }
}

/// What a condition's value is, as its input's placeholder says it.
fn condition_placeholder(condition_type: DetectionConditionType) -> &'static str {
    match condition_type {
        DetectionConditionType::ProcessNameContains => "Nom ou partie du nom (xmrig)\u{2026}",
        DetectionConditionType::CommandLineContains => {
            "Extrait de la commande (-encodedcommand)\u{2026}"
        }
        DetectionConditionType::NetworkPort => "Port distant (4444)",
        DetectionConditionType::FimPathMatch => {
            "Partie d'un chemin surveillé (/etc/sudoers)\u{2026}"
        }
        DetectionConditionType::SeverityLevel => "low, medium, high ou critical",
    }
}

/// Why a condition cannot be saved, if it cannot.
fn condition_error(condition: &DetectionCondition) -> Option<&'static str> {
    let value = condition.value.trim();
    if value.is_empty() {
        return Some("Valeur vide");
    }
    match condition.condition_type {
        DetectionConditionType::NetworkPort if value.parse::<u16>().map_or(true, |p| p == 0) => {
            Some("Un port de 1 à 65535")
        }
        DetectionConditionType::SeverityLevel
            if !matches!(
                value.to_lowercase().as_str(),
                "low" | "medium" | "high" | "critical"
            ) =>
        {
            Some("low, medium, high ou critical")
        }
        _ => None,
    }
}

/// A severity value stored as an enum key ("critical"), in French.
fn severity_value_fr(value: &str) -> &str {
    match value {
        "critical" => "critique",
        "high" => "élevée",
        "medium" => "moyenne",
        "low" => "faible",
        other => other,
    }
}

/// The conditions of a rule, grouped by kind: « Ligne de commande contient :
/// a, b · Port réseau : 4444 ».
fn conditions_summary(conditions: &[DetectionCondition]) -> String {
    let mut groups: Vec<(DetectionConditionType, Vec<&str>)> = Vec::new();
    for condition in conditions {
        let value = if condition.condition_type == DetectionConditionType::SeverityLevel {
            severity_value_fr(condition.value.as_str())
        } else {
            condition.value.as_str()
        };
        match groups
            .iter_mut()
            .find(|(kind, _)| *kind == condition.condition_type)
        {
            Some((_, values)) => values.push(value),
            None => groups.push((condition.condition_type, vec![value])),
        }
    }
    groups
        .into_iter()
        .map(|(kind, values)| format!("{} : {}", kind.label_fr(), values.join(", ")))
        .collect::<Vec<_>>()
        .join(" \u{00b7} ")
}

/// The responses of a rule, as the list says them.
fn actions_summary(actions: &[PlaybookActionType]) -> String {
    let labels: Vec<&str> = actions
        .iter()
        .filter(|a| RULE_ACTIONS.contains(a))
        .map(|a| a.label_fr())
        .collect();
    if labels.is_empty() {
        "Réponse : aucune, la règle détecte et notifie".to_string()
    } else {
        format!("Réponse : {}", labels.join(", "))
    }
}

fn severity_rank(severity: Severity) -> u8 {
    match severity {
        Severity::Critical => 0,
        Severity::High => 1,
        Severity::Medium => 2,
        Severity::Low => 3,
        Severity::Info => 4,
    }
}

/// The filters of the list.
const FILTERS: &[&str] = &["Toutes", "Par défaut", "Personnalisées"];

/// Render the detection rules tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command: Option<GuiCommand> = None;

    // ── Summary ─────────────────────────────────────────────────────
    let rules = &state.threats.detection_rules;
    let total_count = rules.len();
    let active_count = rules.iter().filter(|r| r.enabled).count();
    let total_matches: u64 = rules.iter().map(|r| u64::from(r.match_count)).sum();
    let missing_defaults = detection_catalog::missing_defaults(rules);

    widgets::data_card(ui, "Moteur de détection", |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!(
                    "{} active{} sur {}, {}",
                    crate::format::count(active_count, "r\u{00e8}gle"),
                    crate::format::plural_suffix(active_count as u64),
                    total_count,
                    crate::format::count(total_matches, "correspondance"),
                ))
                .font(theme::font_body())
                .color(theme::text_primary())
                .strong(),
            );

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::primary_button(
                        ui,
                        format!("{}  Nouvelle r\u{00e8}gle", icons::PLUS),
                        !state.threats.detection_rule_editing,
                    )
                    .clicked()
                    {
                        FORM.with(|form| form.borrow_mut().reset());
                        state.threats.detection_rule_editing = true;
                    }
                    if missing_defaults > 0 {
                        ui.add_space(theme::SPACE_SM);
                        if widgets::secondary_button(
                            ui,
                            format!(
                                "{}  Restaurer les r\u{00e8}gles par d\u{00e9}faut ({missing_defaults})",
                                icons::UNDO
                            ),
                            true,
                        )
                        .on_hover_text(
                            "Réinstalle les règles livrées avec l'agent qui ont été supprimées. \
                             Celles qui restent ne changent pas.",
                        )
                        .clicked()
                        {
                            command = Some(GuiCommand::RestoreDefaultDetectionRules);
                        }
                    }
                },
            );
        });
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(
                "Une condition suffit à déclencher une règle. Les règles s'appliquent à chaque \
                 processus lancé ou en cours, à chaque connexion et aux fichiers surveillés qui \
                 changent. Chaque correspondance est notifiée, comptée et envoyée à la \
                 plateforme et au SIEM ; une même observation n'est signalée qu'une fois par \
                 jour. Les règles par défaut détectent sans agir : ajoutez une réponse en les \
                 modifiant.",
            )
            .font(theme::font_min())
            .color(theme::text_secondary()),
        );
    });

    ui.add_space(theme::SPACE_MD);

    // ── Rule form, new or edited rule ───────────────────────────────
    if state.threats.detection_rule_editing {
        show_rule_form(ui, state, &mut command);
        ui.add_space(theme::SPACE_MD);
    }

    // ── Rules list ──────────────────────────────────────────────────
    widgets::data_card(ui, "Règles de détection", |ui: &mut egui::Ui| {
        let defaults = state
            .threats
            .detection_rules
            .iter()
            .filter(|r| detection_catalog::is_default_rule_id(&r.id))
            .count();
        let customs = state.threats.detection_rules.len() - defaults;
        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            for (index, label) in FILTERS.iter().enumerate() {
                let count = match index {
                    1 => defaults,
                    2 => customs,
                    _ => defaults + customs,
                };
                if widgets::chip_button(
                    ui,
                    &format!("{label} ({count})"),
                    state.threats.detection_rule_filter == index,
                    theme::ACCENT,
                )
                .clicked()
                {
                    state.threats.detection_rule_filter = index;
                }
            }
            ui.add_space(theme::SPACE_SM);
            widgets::search_input(
                ui,
                &mut state.threats.detection_rule_search,
                "Rechercher une r\u{00e8}gle, une technique (T1003)\u{2026}",
            );
        });
        ui.add_space(theme::SPACE_SM);

        let search = state.threats.detection_rule_search.trim().to_lowercase();
        let mut shown: Vec<&DetectionRule> = state
            .threats
            .detection_rules
            .iter()
            .filter(|r| match state.threats.detection_rule_filter {
                1 => detection_catalog::is_default_rule_id(&r.id),
                2 => !detection_catalog::is_default_rule_id(&r.id),
                _ => true,
            })
            .filter(|r| {
                search.is_empty()
                    || r.name.to_lowercase().contains(&search)
                    || r.description.to_lowercase().contains(&search)
                    || r.conditions
                        .iter()
                        .any(|c| c.value.to_lowercase().contains(&search))
            })
            .collect();
        shown.sort_by(|a, b| {
            severity_rank(a.severity)
                .cmp(&severity_rank(b.severity))
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        if state.threats.detection_rules.is_empty() {
            widgets::empty_state(
                ui,
                icons::CROSSHAIRS,
                "Aucune r\u{00e8}gle",
                Some(
                    "Les r\u{00e8}gles par d\u{00e9}faut s'installent au d\u{00e9}marrage de l'agent. Vous pouvez aussi cr\u{00e9}er les v\u{00f4}tres.",
                ),
            );
            return;
        }
        if shown.is_empty() {
            widgets::empty_state(
                ui,
                icons::FILTER,
                "Aucune r\u{00e8}gle ne correspond",
                Some("Changez le filtre ou la recherche."),
            );
            return;
        }

        let mut toggle_commands: Vec<(String, bool)> = Vec::new();
        let mut delete_id: Option<String> = None;
        let mut edit_rule: Option<DetectionRule> = None;

        for (row_idx, rule) in shown.iter().enumerate() {
            let sev_color = match rule.severity {
                Severity::Critical => theme::ERROR,
                Severity::High => theme::SEVERITY_HIGH,
                Severity::Medium => theme::SEVERITY_MEDIUM,
                _ => theme::INFO,
            };
            let matches_str = format!(
                "{}{}",
                crate::format::count(rule.match_count, "correspondance"),
                rule.last_match
                    .map(|t| format!(
                        " \u{2014} Derni\u{00e8}re : {}",
                        crate::format::local_day_time(t)
                    ))
                    .unwrap_or_default()
            );

            ui.push_id(&rule.id, |ui: &mut egui::Ui| {
                egui::Frame::new()
                    .fill(if row_idx % 2 == 1 {
                        theme::table_row_bg(row_idx)
                    } else {
                        egui::Color32::TRANSPARENT
                    })
                    .inner_margin(egui::Margin::symmetric(
                        theme::SPACE_MD as i8,
                        theme::SPACE_SM as i8,
                    ))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            // Left: rule info
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.set_max_width((ui.available_width() - 150.0).max(200.0));
                                ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                                    ui.label(
                                        egui::RichText::new(&rule.name)
                                            .font(theme::font_body())
                                            .color(if rule.enabled {
                                                theme::text_primary()
                                            } else {
                                                theme::text_tertiary()
                                            })
                                            .strong(),
                                    );
                                    ui.add_space(theme::SPACE_SM);
                                    widgets::status_badge(ui, rule.severity.label(), sev_color);
                                    if detection_catalog::is_default_rule_id(&rule.id) {
                                        widgets::status_badge(ui, "PAR DÉFAUT", theme::INFO);
                                    }
                                    if !rule.enabled {
                                        widgets::status_badge(
                                            ui,
                                            "DÉSACTIVÉE",
                                            theme::text_tertiary(),
                                        );
                                    }
                                });
                                if !rule.description.trim().is_empty() {
                                    ui.label(
                                        egui::RichText::new(&rule.description)
                                            .font(theme::font_min())
                                            .color(theme::text_secondary()),
                                    );
                                }
                                ui.label(
                                    egui::RichText::new(conditions_summary(&rule.conditions))
                                        .font(theme::font_min())
                                        .color(theme::text_secondary()),
                                );
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{} \u{00b7} {}",
                                        actions_summary(&rule.actions),
                                        matches_str
                                    ))
                                    .font(theme::font_min())
                                    .color(theme::text_tertiary()),
                                );
                            });

                            // Right: toggle, edit, delete
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    if widgets::icon_button(
                                        ui,
                                        icons::TRASH,
                                        Some("Supprimer la règle"),
                                    )
                                    .clicked()
                                    {
                                        delete_id = Some(rule.id.to_string());
                                    }
                                    ui.add_space(theme::SPACE_XS);
                                    if widgets::icon_button(
                                        ui,
                                        icons::PENCIL,
                                        Some("Modifier la règle"),
                                    )
                                    .clicked()
                                    {
                                        edit_rule = Some((*rule).clone());
                                    }
                                    ui.add_space(theme::SPACE_XS);
                                    let mut enabled = rule.enabled;
                                    if widgets::toggle_switch_labeled(
                                        ui,
                                        &mut enabled,
                                        &format!("Activer {}", rule.name),
                                    )
                                    .changed()
                                    {
                                        toggle_commands.push((rule.id.to_string(), enabled));
                                    }
                                },
                            );
                        });
                    });
            });
        }

        // Apply toggle commands. Turning a rule off removes a detection:
        // administrator mode first, before the switch changes.
        for (id, enabled) in toggle_commands {
            if !enabled && !state.require_admin("Désactiver une règle de détection") {
                continue;
            }
            if let Some(rule) = state
                .threats
                .detection_rules
                .iter_mut()
                .find(|r| r.id == id)
            {
                rule.enabled = enabled;
            }
            command = Some(GuiCommand::ToggleDetectionRule {
                rule_id: id,
                enabled,
            });
        }

        // Editing can take a detection away as surely as deleting it.
        if let Some(rule) = edit_rule
            && state.require_admin("Modifier une règle de détection")
        {
            FORM.with(|form| form.borrow_mut().load(&rule));
            state.threats.detection_rule_editing = true;
        }

        // Deleting asks first; the dialog below acts.
        if let Some(id) = delete_id
            && state.require_admin("Supprimer une règle de détection")
        {
            modal::ask_confirmation(ui.ctx(), DELETE_CONFIRM, id);
        }
    });

    if let Some(id) = modal::pending_confirmation::<String>(ui.ctx(), DELETE_CONFIRM) {
        let (name, is_default) = state
            .threats
            .detection_rules
            .iter()
            .find(|r| r.id == id)
            .map_or_else(
                || (id.clone(), false),
                |r| (r.name.clone(), detection_catalog::is_default_rule_id(&r.id)),
            );
        let restore_hint = if is_default {
            " Règle livrée avec l'agent : « Restaurer les règles par défaut » la réinstalle."
        } else {
            " Cette action est irréversible."
        };
        if modal::resolve_confirmation::<String>(
            ui.ctx(),
            DELETE_CONFIRM,
            "Supprimer la règle de détection ?",
            &format!(
                "« {name} » ne détectera plus rien sur ce poste et sera supprimée de la \
                 plateforme.{restore_hint}"
            ),
            "Supprimer",
        ) {
            state.threats.detection_rules.retain(|r| r.id != id);
            command = Some(GuiCommand::DeleteDetectionRule { rule_id: id });
        }
    }

    command
}

/// Confirmation dialog of the rule list.
const DELETE_CONFIRM: &str = "detection_rule_delete_confirm";

/// Inline form to create a detection rule or edit one.
fn show_rule_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
    widgets::card(ui, |ui: &mut egui::Ui| {
        FORM.with(|form| {
            let mut f = form.borrow_mut();

            ui.label(
                egui::RichText::new(if f.editing.is_some() {
                    "MODIFIER LA R\u{00c8}GLE DE D\u{00c9}TECTION"
                } else {
                    "NOUVELLE R\u{00c8}GLE DE D\u{00c9}TECTION"
                })
                .font(theme::font_label())
                .color(theme::accent_text())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );
            ui.add_space(theme::SPACE_SM);

            // Name
            widgets::form::row(ui, "Nom", |ui: &mut egui::Ui| {
                widgets::text_input(ui, &mut f.name, "Nom de la r\u{00e8}gle…");
            });

            // Description
            widgets::form::row(ui, "Description", |ui: &mut egui::Ui| {
                widgets::text_input(ui, &mut f.description, "Ce que la r\u{00e8}gle d\u{00e9}tecte…");
            });

            // Severity dropdown
            widgets::form::row(ui, "S\u{00e9}v\u{00e9}rit\u{00e9}", |ui: &mut egui::Ui| {
                let sev_labels: Vec<&str> = SEVERITY_OPTIONS.iter().map(|s| s.label()).collect();
                widgets::dropdown(ui, "rule_severity", &sev_labels, &mut f.severity_idx);
            });
            ui.add_space(theme::SPACE_XS);

            // Conditions
            ui.label(
                egui::RichText::new("CONDITIONS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.label(
                egui::RichText::new(
                    "Une seule suffit. Texte compar\u{00e9} sans tenir compte des majuscules.",
                )
                .font(theme::font_min())
                .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_XS);

            let cond_types = DetectionConditionType::all();
            let cond_labels: Vec<&str> = cond_types.iter().map(|c| c.label_fr()).collect();

            let mut remove_cond_idx: Option<usize> = None;
            for (i, cond) in f.conditions.iter_mut().enumerate() {
                ui.push_id(i, |ui: &mut egui::Ui| {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let mut idx = cond_types
                            .iter()
                            .position(|c| *c == cond.condition_type)
                            .unwrap_or(0);
                        if widgets::dropdown(ui, "cond_type", &cond_labels, &mut idx)
                            && let Some(ct) = cond_types.get(idx)
                        {
                            cond.condition_type = *ct;
                        }
                        ui.add_space(theme::SPACE_XS);
                        widgets::text_input(
                            ui,
                            &mut cond.value,
                            condition_placeholder(cond.condition_type),
                        );
                        ui.add_space(theme::SPACE_XS);
                        let del_resp =
                            widgets::icon_button(ui, icons::TRASH, Some("Retirer cette condition"));
                        if del_resp.clicked() {
                            remove_cond_idx = Some(i);
                        }
                        if !cond.value.is_empty()
                            && let Some(error) = condition_error(cond)
                        {
                            ui.label(
                                egui::RichText::new(error)
                                    .font(theme::font_min())
                                    .color(theme::ERROR),
                            );
                        }
                    });
                });
            }
            if let Some(idx) = remove_cond_idx
                && idx < f.conditions.len()
            {
                f.conditions.remove(idx);
            }

            if widgets::ghost_button(ui, format!("{}  Ajouter une condition", icons::PLUS))
                .clicked()
            {
                f.conditions.push(DetectionCondition {
                    condition_type: DetectionConditionType::ProcessNameContains,
                    value: String::new(),
                });
            }

            ui.add_space(theme::SPACE_SM);

            // Responses (multi-select via chips)
            ui.label(
                egui::RichText::new("R\u{00c9}PONSE (FACULTATIVE)")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.label(
                egui::RichText::new(
                    "Chaque correspondance est d\u{00e9}j\u{00e0} notifi\u{00e9}e. Une r\u{00e9}ponse agit sur ce que la r\u{00e8}gle a trouv\u{00e9}, \
                     ou est simul\u{00e9}e quand la simulation des playbooks est active.",
                )
                .font(theme::font_min())
                .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_XS);

            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                for action_type in RULE_ACTIONS {
                    let active = f.actions.contains(action_type);
                    if widgets::chip_button(ui, action_type.label_fr(), active, theme::ACCENT)
                        .on_hover_text(action_help(*action_type))
                        .clicked()
                    {
                        if active {
                            f.actions.retain(|a| a != action_type);
                        } else {
                            f.actions.push(*action_type);
                        }
                    }
                }
            });
            for action in &f.actions {
                ui.label(
                    egui::RichText::new(format!("{} : {}", action.label_fr(), action_help(*action)))
                        .font(theme::font_min())
                        .color(theme::text_secondary()),
                );
            }

            ui.add_space(theme::SPACE_MD);

            let conditions_valid =
                !f.conditions.is_empty() && f.conditions.iter().all(|c| condition_error(c).is_none());

            // Test + Save / Cancel
            ui.horizontal(|ui: &mut egui::Ui| {
                if widgets::secondary_button(
                    ui,
                    format!("{}  Tester", icons::PLAY),
                    conditions_valid,
                )
                .on_hover_text(
                    "Sur les processus signal\u{00e9}s, les connexions et les fichiers modifi\u{00e9}s \
                     connus de l'interface.",
                )
                .clicked()
                    && conditions_valid
                {
                    let count = test_rule(state, &f.conditions);
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::info(format!(
                            "{} trouv\u{00e9}e{s}",
                            crate::format::count(count, "correspondance"),
                            s = crate::format::plural_suffix(count)
                        ))
                        .with_time(time),
                    );
                }

                ui.add_space(theme::SPACE_SM);

                let can_save = !f.name.trim().is_empty() && conditions_valid;

                if widgets::primary_button(ui, format!("{}  Enregistrer", icons::SAVE), can_save)
                    .clicked()
                    && can_save
                {
                    let severity = SEVERITY_OPTIONS
                        .get(f.severity_idx)
                        .copied()
                        .unwrap_or(Severity::Medium);
                    let conditions: Vec<DetectionCondition> = f
                        .conditions
                        .iter()
                        .map(|c| DetectionCondition {
                            condition_type: c.condition_type,
                            value: c.value.trim().to_string(),
                        })
                        .collect();

                    let rule = match &f.editing {
                        // An edit keeps the rule's identity, state and matches.
                        Some(previous) => DetectionRule {
                            name: f.name.trim().to_string(),
                            description: f.description.trim().to_string(),
                            severity,
                            conditions,
                            actions: f.actions.clone(),
                            ..previous.clone()
                        },
                        None => DetectionRule {
                            id: Uuid::new_v4().to_string(),
                            name: f.name.trim().to_string(),
                            description: f.description.trim().to_string(),
                            severity,
                            conditions,
                            actions: f.actions.clone(),
                            enabled: true,
                            created_at: Utc::now(),
                            last_match: None,
                            match_count: 0,
                        },
                    };

                    *command = Some(GuiCommand::SaveDetectionRule {
                        rule: Box::new(rule.clone()),
                    });
                    match state
                        .threats
                        .detection_rules
                        .iter_mut()
                        .find(|r| r.id == rule.id)
                    {
                        Some(existing) => *existing = rule,
                        None => state.threats.detection_rules.push(rule),
                    }
                    state.threats.detection_rule_editing = false;
                    f.reset();
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, format!("{}  Annuler", icons::XMARK)).clicked() {
                    state.threats.detection_rule_editing = false;
                    f.reset();
                }
            });
        });
    });
}

/// Test detection rule conditions against what the interface knows and
/// return the match count.
fn test_rule(state: &AppState, conditions: &[DetectionCondition]) -> usize {
    let mut count = 0usize;

    for cond in conditions {
        let val = cond.value.trim().to_lowercase();
        if val.is_empty() {
            continue;
        }

        match cond.condition_type {
            DetectionConditionType::ProcessNameContains => {
                count = count.saturating_add(
                    state
                        .threats
                        .suspicious_processes
                        .iter()
                        .filter(|p| p.process_name.to_lowercase().contains(&val))
                        .count(),
                );
            }
            DetectionConditionType::CommandLineContains => {
                count = count.saturating_add(
                    state
                        .threats
                        .suspicious_processes
                        .iter()
                        .filter(|p| p.command_line.to_lowercase().contains(&val))
                        .count(),
                );
            }
            DetectionConditionType::NetworkPort => {
                if let Ok(port) = val.parse::<u16>() {
                    count = count.saturating_add(
                        state
                            .network
                            .alerts
                            .iter()
                            .filter(|a| a.destination_port == Some(port))
                            .count(),
                    );
                    count = count.saturating_add(
                        state
                            .network
                            .connections
                            .iter()
                            .filter(|c| c.remote_port == Some(port))
                            .count(),
                    );
                }
            }
            DetectionConditionType::FimPathMatch => {
                count = count.saturating_add(
                    state
                        .fim
                        .alerts
                        .iter()
                        .filter(|a| a.path.to_lowercase().contains(&val))
                        .count(),
                );
            }
            DetectionConditionType::SeverityLevel => {
                // Match system incidents with severity containing the value
                count = count.saturating_add(
                    state
                        .threats
                        .system_incidents
                        .iter()
                        .filter(|i| i.severity.as_str().contains(&val))
                        .count(),
                );
            }
        }
    }

    count
}

#[cfg(test)]
mod tests {
    use super::*;

    fn condition(kind: DetectionConditionType, value: &str) -> DetectionCondition {
        DetectionCondition {
            condition_type: kind,
            value: value.to_string(),
        }
    }

    #[test]
    fn conditions_are_listed_by_kind() {
        let summary = conditions_summary(&[
            condition(DetectionConditionType::CommandLineContains, "sekurlsa::"),
            condition(DetectionConditionType::ProcessNameContains, "mimikatz"),
            condition(DetectionConditionType::CommandLineContains, "lsadump::"),
            condition(DetectionConditionType::SeverityLevel, "high"),
        ]);
        assert_eq!(
            summary,
            "Ligne de commande contient : sekurlsa::, lsadump:: \u{00b7} Nom processus contient : \
             mimikatz \u{00b7} Niveau de s\u{00e9}v\u{00e9}rit\u{00e9} : \u{00e9}lev\u{00e9}e"
        );
    }

    #[test]
    fn a_condition_the_engine_would_ignore_cannot_be_saved() {
        use DetectionConditionType as Kind;
        assert!(condition_error(&condition(Kind::NetworkPort, "4444")).is_none());
        assert!(condition_error(&condition(Kind::NetworkPort, "ssh")).is_some());
        assert!(condition_error(&condition(Kind::NetworkPort, "0")).is_some());
        assert!(condition_error(&condition(Kind::SeverityLevel, "High")).is_none());
        assert!(condition_error(&condition(Kind::SeverityLevel, "grave")).is_some());
        assert!(condition_error(&condition(Kind::ProcessNameContains, "  ")).is_some());
    }

    #[test]
    fn a_rule_without_response_says_it_detects_and_notifies() {
        assert_eq!(
            actions_summary(&[PlaybookActionType::CreateNotification]),
            "Réponse : aucune, la règle détecte et notifie"
        );
        assert_eq!(
            actions_summary(&[PlaybookActionType::KillProcess, PlaybookActionType::BlockIp]),
            "Réponse : Terminer le processus, Bloquer IP"
        );
    }

    #[test]
    fn editing_offers_only_what_a_rule_can_do() {
        let mut rule = detection_catalog::default_rules(Utc::now()).remove(0);
        rule.actions = vec![
            PlaybookActionType::CreateNotification,
            PlaybookActionType::KillProcess,
            PlaybookActionType::RunCommand,
        ];
        let mut form = RuleForm::empty();
        form.load(&rule);
        assert_eq!(form.actions, vec![PlaybookActionType::KillProcess]);
        assert_eq!(form.conditions.len(), rule.conditions.len());
        assert_eq!(
            form.editing.as_ref().map(|r| r.id.as_str()),
            Some(rule.id.as_str())
        );
    }
}
