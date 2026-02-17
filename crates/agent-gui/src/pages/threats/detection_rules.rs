//! Detection rules sub-tab — custom detection rules with condition matching and live testing.

use chrono::Utc;
use egui::Ui;
use uuid::Uuid;

use crate::app::AppState;
use crate::dto::{
    DetectionCondition, DetectionConditionType, DetectionRule, PlaybookActionType, Severity,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{ColumnAlign, ColumnWidth, DataTable, TableColumn, TableSort};

/// Inline editing state for the new-rule form.
struct InlineRuleForm {
    name: String,
    description: String,
    severity_idx: usize,
    conditions: Vec<DetectionCondition>,
    actions: Vec<PlaybookActionType>,
}

const SEVERITY_OPTIONS: &[Severity] = &[
    Severity::Critical,
    Severity::High,
    Severity::Medium,
    Severity::Low,
];

/// Render the detection rules tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command: Option<GuiCommand> = None;

    // ── Summary ─────────────────────────────────────────────────────
    let active_count = state
        .threats
        .detection_rules
        .iter()
        .filter(|r| r.enabled)
        .count();
    let total_matches: u64 = state
        .threats
        .detection_rules
        .iter()
        .map(|r| u64::from(r.match_count))
        .sum();

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!(
                    "{} r\u{00e8}gles actives, {} correspondances",
                    active_count, total_matches
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
                        format!("{}  Nouvelle R\u{00e8}gle", icons::PLUS),
                        !state.threats.detection_rule_editing,
                    )
                    .clicked()
                    {
                        state.threats.detection_rule_editing = true;
                    }
                },
            );
        });
    });

    ui.add_space(theme::SPACE_MD);

    // ── Inline new rule form ────────────────────────────────────────
    if state.threats.detection_rule_editing {
        show_rule_form(ui, state, &mut command);
        ui.add_space(theme::SPACE_MD);
    }

    // ── Rules table ─────────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(format!(
                "R\u{00c8}GLES DE D\u{00c9}TECTION ({})",
                state.threats.detection_rules.len()
            ))
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.detection_rules.is_empty() {
            widgets::empty_state(
                ui,
                icons::CROSSHAIRS,
                "AUCUNE R\u{00c8}GLE",
                Some("Cr\u{00e9}ez une r\u{00e8}gle de d\u{00e9}tection personnalis\u{00e9}e pour surveiller des indicateurs sp\u{00e9}cifiques."),
            );
        } else {
            let columns = vec![
                TableColumn {
                    key: "name",
                    label: "NOM",
                    width: ColumnWidth::Fill,
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "severity",
                    label: "S\u{00c9}V\u{00c9}RIT\u{00c9}",
                    width: ColumnWidth::Fixed(100.0),
                    sortable: false,
                    align: ColumnAlign::Center,
                },
                TableColumn {
                    key: "conditions",
                    label: "CONDITIONS",
                    width: ColumnWidth::Fixed(200.0),
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "matches",
                    label: "CORRESPONDANCES",
                    width: ColumnWidth::Fixed(130.0),
                    sortable: false,
                    align: ColumnAlign::Center,
                },
                TableColumn {
                    key: "enabled",
                    label: "ACTIV\u{00c9}",
                    width: ColumnWidth::Fixed(80.0),
                    sortable: false,
                    align: ColumnAlign::Center,
                },
            ];

            let table = DataTable::new("detection_rules_table", columns);
            let mut sort = TableSort::default();
            table.show_header(ui, &mut sort);

            let mut toggle_commands: Vec<(String, bool)> = Vec::new();
            let mut delete_id: Option<String> = None;

            for (row_idx, rule) in state.threats.detection_rules.iter().enumerate() {
                let sev_label = rule.severity.label();
                let conds = rule
                    .conditions
                    .iter()
                    .map(|c| format!("{}: {}", c.condition_type.label_fr(), c.value))
                    .collect::<Vec<_>>()
                    .join(", ");
                let matches_str = format!(
                    "{}{}",
                    rule.match_count,
                    rule.last_match
                        .map(|t| format!(" ({})", t.format("%d/%m %H:%M")))
                        .unwrap_or_default()
                );

                let cells: Vec<&str> = vec![&rule.name, sev_label, &conds, &matches_str, ""];

                ui.push_id(format!("rule_{}", row_idx), |ui: &mut egui::Ui| {
                    table.show_row(ui, row_idx, false, &cells);

                    ui.horizontal(|ui: &mut egui::Ui| {
                        let mut enabled = rule.enabled;
                        if widgets::toggle_switch(ui, &mut enabled).changed() {
                            toggle_commands.push((rule.id.to_string(), enabled));
                        }
                        ui.add_space(theme::SPACE_XS);
                        if widgets::ghost_button(ui, icons::TRASH.to_string()).clicked() {
                            delete_id = Some(rule.id.to_string());
                        }
                    });
                });
            }

            // Apply toggle commands
            for (id, enabled) in toggle_commands {
                if let Some(rule) = state
                    .threats
                    .detection_rules
                    .iter_mut()
                    .find(|r| r.id.to_string() == id)
                {
                    rule.enabled = enabled;
                }
                command = Some(GuiCommand::ToggleDetectionRule {
                    rule_id: id,
                    enabled,
                });
            }

            // Apply delete
            if let Some(ref id) = delete_id {
                state
                    .threats
                    .detection_rules
                    .retain(|r| r.id.to_string() != *id);
                command = Some(GuiCommand::DeleteDetectionRule {
                    rule_id: id.clone(),
                });
            }
        }
    });

    command
}

/// Inline form to create a new detection rule.
fn show_rule_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
    thread_local! {
        static FORM: std::cell::RefCell<InlineRuleForm> = const { std::cell::RefCell::new(InlineRuleForm {
            name: String::new(),
            description: String::new(),
            severity_idx: 2, // Medium by default
            conditions: Vec::new(),
            actions: Vec::new(),
        }) };
    }

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("NOUVELLE R\u{00c8}GLE DE D\u{00c9}TECTION")
                .font(theme::font_label())
                .color(theme::ACCENT)
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        FORM.with(|form| {
            let mut f = form.borrow_mut();

            // Name
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("Nom")
                        .font(theme::font_label())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);
                widgets::text_input(ui, &mut f.name, "Nom de la r\u{00e8}gle...");
            });
            ui.add_space(theme::SPACE_XS);

            // Description
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("Description")
                        .font(theme::font_label())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);
                widgets::text_input(ui, &mut f.description, "Description...");
            });
            ui.add_space(theme::SPACE_XS);

            // Severity dropdown
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("S\u{00e9}v\u{00e9}rit\u{00e9}")
                        .font(theme::font_label())
                        .color(theme::text_secondary()),
                );
                ui.add_space(theme::SPACE_SM);
                let sev_labels: Vec<&str> = SEVERITY_OPTIONS.iter().map(|s| s.label()).collect();
                widgets::dropdown(ui, "rule_severity", &sev_labels, &mut f.severity_idx);
            });
            ui.add_space(theme::SPACE_SM);

            // Conditions
            ui.label(
                egui::RichText::new("CONDITIONS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.add_space(theme::SPACE_XS);

            let cond_types = DetectionConditionType::all();
            let cond_labels: Vec<&str> = cond_types.iter().map(|c| c.label_fr()).collect();

            let mut remove_cond_idx: Option<usize> = None;
            for (i, cond) in f.conditions.iter_mut().enumerate() {
                ui.push_id(format!("rcond_{}", i), |ui: &mut egui::Ui| {
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
                        widgets::text_input(ui, &mut cond.value, "Valeur...");
                        ui.add_space(theme::SPACE_XS);
                        if widgets::ghost_button(ui, icons::TRASH.to_string()).clicked() {
                            remove_cond_idx = Some(i);
                        }
                    });
                });
            }
            if let Some(idx) = remove_cond_idx
                && idx < f.conditions.len()
            {
                f.conditions.remove(idx);
            }

            if widgets::ghost_button(
                ui,
                format!("{}  Ajouter une condition", icons::PLUS),
            )
            .clicked()
            {
                f.conditions.push(DetectionCondition {
                    condition_type: DetectionConditionType::ProcessNameContains,
                    value: String::new(),
                });
            }

            ui.add_space(theme::SPACE_SM);

            // Actions (multi-select via chips)
            ui.label(
                egui::RichText::new("ACTIONS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.add_space(theme::SPACE_XS);

            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                for action_type in PlaybookActionType::all() {
                    let active = f.actions.contains(action_type);
                    if widgets::chip_button(ui, action_type.label_fr(), active, theme::ACCENT)
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

            ui.add_space(theme::SPACE_MD);

            // Test + Save / Cancel
            ui.horizontal(|ui: &mut egui::Ui| {
                // Test button
                if widgets::secondary_button(
                    ui,
                    format!("{}  Tester", icons::PLAY),
                    !f.conditions.is_empty(),
                )
                .clicked()
                    && !f.conditions.is_empty()
                {
                    let count = test_rule(state, &f.conditions);
                    let time = ui.input(|i| i.time);
                    state.toasts.push(
                        crate::widgets::toast::Toast::info(format!(
                            "{} correspondance(s) trouv\u{00e9}e(s)",
                            count
                        ))
                        .with_time(time),
                    );
                }

                ui.add_space(theme::SPACE_SM);

                let can_save = !f.name.trim().is_empty()
                    && !f.conditions.is_empty()
                    && !f.actions.is_empty();

                if widgets::primary_button(
                    ui,
                    format!("{}  Enregistrer", icons::SAVE),
                    can_save,
                )
                .clicked()
                    && can_save
                {
                    let severity = SEVERITY_OPTIONS
                        .get(f.severity_idx)
                        .copied()
                        .unwrap_or(Severity::Medium);

                    let rule = DetectionRule {
                        id: Uuid::new_v4(),
                        name: f.name.trim().to_string(),
                        description: f.description.trim().to_string(),
                        severity,
                        conditions: f.conditions.clone(),
                        actions: f.actions.clone(),
                        enabled: true,
                        created_at: Utc::now(),
                        last_match: None,
                        match_count: 0,
                    };

                    *command = Some(GuiCommand::SaveDetectionRule {
                        rule: Box::new(rule.clone()),
                    });
                    state.threats.detection_rules.push(rule);
                    state.threats.detection_rule_editing = false;

                    f.name.clear();
                    f.description.clear();
                    f.severity_idx = 2;
                    f.conditions.clear();
                    f.actions.clear();
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(ui, format!("{}  Annuler", icons::XMARK)).clicked() {
                    state.threats.detection_rule_editing = false;
                    f.name.clear();
                    f.description.clear();
                    f.severity_idx = 2;
                    f.conditions.clear();
                    f.actions.clear();
                }
            });
        });
    });
}

/// Test detection rule conditions against current state and return match count.
fn test_rule(state: &AppState, conditions: &[DetectionCondition]) -> usize {
    let mut count = 0usize;

    for cond in conditions {
        let val = cond.value.to_ascii_lowercase();
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
                        .filter(|p| p.process_name.to_ascii_lowercase().contains(&val))
                        .count(),
                );
            }
            DetectionConditionType::CommandLineContains => {
                count = count.saturating_add(
                    state
                        .threats
                        .suspicious_processes
                        .iter()
                        .filter(|p| p.command_line.to_ascii_lowercase().contains(&val))
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
                }
            }
            DetectionConditionType::FimPathMatch => {
                count = count.saturating_add(
                    state
                        .fim
                        .alerts
                        .iter()
                        .filter(|a| a.path.to_ascii_lowercase().contains(&val))
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
