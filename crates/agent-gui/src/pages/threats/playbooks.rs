//! Playbooks sub-tab — automated response playbooks, templates, and execution log.

use chrono::Utc;
use egui::Ui;
use uuid::Uuid;

use crate::app::AppState;
use crate::dto::{
    Playbook, PlaybookAction, PlaybookActionType, PlaybookCondition, PlaybookConditionType,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::data_table::{ColumnAlign, ColumnWidth, DataTable, TableColumn, TableSort};

/// Pre-configured playbook template descriptor.
struct PlaybookTemplate {
    icon: &'static str,
    name: &'static str,
    description: &'static str,
    conditions: Vec<PlaybookCondition>,
    actions: Vec<PlaybookAction>,
}

fn templates() -> Vec<PlaybookTemplate> {
    vec![
        PlaybookTemplate {
            icon: icons::SKULL,
            name: "Ransomware",
            description: "D\u{00e9}tecte les processus li\u{00e9}s au chiffrement malveillant et les termine imm\u{00e9}diatement.",
            conditions: vec![PlaybookCondition {
                condition_type: PlaybookConditionType::ProcessNameMatch,
                operator: "contient".to_string(),
                value: "encrypt|ransom".to_string(),
            }],
            actions: vec![
                PlaybookAction {
                    action_type: PlaybookActionType::KillProcess,
                    parameters: String::new(),
                },
                PlaybookAction {
                    action_type: PlaybookActionType::CreateNotification,
                    parameters: String::new(),
                },
            ],
        },
        PlaybookTemplate {
            icon: icons::MICROCHIP,
            name: "Crypto-miner",
            description: "D\u{00e9}tecte les processus de minage de cryptomonnaie et les arr\u{00ea}te.",
            conditions: vec![PlaybookCondition {
                condition_type: PlaybookConditionType::ProcessNameMatch,
                operator: "contient".to_string(),
                value: "xmrig|minerd|cgminer".to_string(),
            }],
            actions: vec![PlaybookAction {
                action_type: PlaybookActionType::KillProcess,
                parameters: String::new(),
            }],
        },
        PlaybookTemplate {
            icon: icons::GLOBE,
            name: "Exfiltration",
            description: "D\u{00e9}tecte les tentatives d'exfiltration de donn\u{00e9}es et bloque la source.",
            conditions: vec![PlaybookCondition {
                condition_type: PlaybookConditionType::NetworkAlertType,
                operator: "\u{00e9}gal".to_string(),
                value: "exfiltration".to_string(),
            }],
            actions: vec![
                PlaybookAction {
                    action_type: PlaybookActionType::BlockIp,
                    parameters: String::new(),
                },
                PlaybookAction {
                    action_type: PlaybookActionType::SendSiemAlert,
                    parameters: String::new(),
                },
            ],
        },
        PlaybookTemplate {
            icon: icons::LOCK,
            name: "Brute-force",
            description: "D\u{00e9}tecte les attaques par force brute et bloque l'adresse source.",
            conditions: vec![PlaybookCondition {
                condition_type: PlaybookConditionType::NetworkAlertType,
                operator: "\u{00e9}gal".to_string(),
                value: "brute_force".to_string(),
            }],
            actions: vec![
                PlaybookAction {
                    action_type: PlaybookActionType::BlockIp,
                    parameters: String::new(),
                },
                PlaybookAction {
                    action_type: PlaybookActionType::CreateNotification,
                    parameters: String::new(),
                },
            ],
        },
    ]
}

/// Inline editing state for the new-playbook form.
struct InlinePlaybookForm {
    name: String,
    description: String,
    conditions: Vec<PlaybookCondition>,
    actions: Vec<PlaybookAction>,
}

/// Render the playbooks tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command: Option<GuiCommand> = None;

    // ── Templates card ──────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("TEMPLATES PR\u{00c9}-CONFIGUR\u{00c9}S")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        let tpls = templates();
        let grid = widgets::ResponsiveGrid::new(240.0, theme::SPACE_SM);
        let items: Vec<usize> = (0..tpls.len()).collect();

        grid.show(ui, &items, |ui, width, &idx| {
            let tpl = &tpls[idx];
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_width(width);

                egui::Frame::new()
                    .fill(theme::bg_tertiary())
                    .corner_radius(egui::CornerRadius::same(theme::ROUNDING_LG))
                    .inner_margin(egui::Margin::same(theme::SPACE as i8))
                    .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(tpl.icon)
                                    .size(theme::ICON_MD)
                                    .color(theme::ACCENT),
                            );
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new(tpl.name)
                                    .font(theme::font_body())
                                    .color(theme::text_primary())
                                    .strong(),
                            );
                        });
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new(tpl.description)
                                .font(theme::font_min())
                                .color(theme::text_secondary()),
                        );
                        ui.add_space(theme::SPACE_SM);

                        let already_installed = state
                            .threats
                            .playbooks
                            .iter()
                            .any(|p| p.name == tpl.name && p.is_template);

                        if already_installed {
                            widgets::status_badge(ui, "INSTALL\u{00c9}", theme::SUCCESS);
                        } else if widgets::primary_button(
                            ui,
                            format!("{}  Installer", icons::DOWNLOAD),
                            true,
                        )
                        .clicked()
                        {
                            state.threats.playbooks.push(Playbook {
                                id: Uuid::new_v4(),
                                name: tpl.name.to_string(),
                                description: tpl.description.to_string(),
                                enabled: true,
                                conditions: tpl.conditions.clone(),
                                actions: tpl.actions.clone(),
                                created_at: Utc::now(),
                                last_triggered: None,
                                trigger_count: 0,
                                is_template: true,
                            });
                        }
                    });
            });
        });
    });

    ui.add_space(theme::SPACE_MD);

    // ── Active playbooks card ───────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(format!(
                    "PLAYBOOKS ACTIFS ({})",
                    state.threats.playbooks.len()
                ))
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
            );

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::primary_button(
                        ui,
                        format!("{}  Nouveau Playbook", icons::PLUS),
                        !state.threats.playbook_editing,
                    )
                    .clicked()
                    {
                        state.threats.playbook_editing = true;
                    }
                },
            );
        });
        ui.add_space(theme::SPACE_SM);

        if state.threats.playbooks.is_empty() {
            widgets::empty_state(
                ui,
                icons::CLIPBOARD_LIST,
                "AUCUN PLAYBOOK",
                Some("Installez un template ou cr\u{00e9}ez un playbook personnalis\u{00e9}."),
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
                    key: "conditions",
                    label: "CONDITIONS",
                    width: ColumnWidth::Fixed(180.0),
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "actions",
                    label: "ACTIONS",
                    width: ColumnWidth::Fixed(180.0),
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "triggered",
                    label: "D\u{00c9}CLENCH\u{00c9}",
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

            let table = DataTable::new("playbooks_table", columns);
            let mut sort = TableSort::default();
            table.show_header(ui, &mut sort);

            // Collect IDs and toggle state changes to apply after iteration
            let mut toggle_commands: Vec<(String, bool)> = Vec::new();
            let mut delete_id: Option<String> = None;

            for (row_idx, pb) in state.threats.playbooks.iter().enumerate() {
                let conds = pb
                    .conditions
                    .iter()
                    .map(|c| c.condition_type.label_fr())
                    .collect::<Vec<_>>()
                    .join(", ");
                let acts = pb
                    .actions
                    .iter()
                    .map(|a| a.action_type.label_fr())
                    .collect::<Vec<_>>()
                    .join(", ");
                let triggered = pb
                    .last_triggered
                    .map(|t| format!("{} ({}x)", t.format("%d/%m %H:%M"), pb.trigger_count))
                    .unwrap_or_else(|| "\u{2014}".to_string());

                let cells: Vec<&str> = vec![&pb.name, &conds, &acts, &triggered, ""];

                ui.push_id(row_idx, |ui: &mut egui::Ui| {
                    table.show_row(ui, row_idx, false, &cells);

                    // Override the last cell with a toggle + delete
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let mut enabled = pb.enabled;
                        if widgets::toggle_switch(ui, &mut enabled).changed() {
                            toggle_commands.push((pb.id.to_string(), enabled));
                        }
                        ui.add_space(theme::SPACE_XS);
                        if widgets::ghost_button(
                            ui,
                            icons::TRASH.to_string(),
                        )
                        .clicked()
                        {
                            delete_id = Some(pb.id.to_string());
                        }
                    });
                });
            }

            // Apply toggle commands
            for (id, enabled) in toggle_commands {
                if let Some(pb) = state.threats.playbooks.iter_mut().find(|p| p.id.to_string() == id) {
                    pb.enabled = enabled;
                }
                command = Some(GuiCommand::TogglePlaybook {
                    playbook_id: id,
                    enabled,
                });
            }

            // Apply delete
            if let Some(ref id) = delete_id {
                state.threats.playbooks.retain(|p| p.id.to_string() != *id);
                command = Some(GuiCommand::DeletePlaybook {
                    playbook_id: id.clone(),
                });
            }
        }
    });

    ui.add_space(theme::SPACE_MD);

    // ── Inline new playbook form ────────────────────────────────────
    if state.threats.playbook_editing {
        show_playbook_form(ui, state, &mut command);
        ui.add_space(theme::SPACE_MD);
    }

    // ── Execution log card ──────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(format!(
                "JOURNAL D'EX\u{00c9}CUTION ({})",
                state.threats.playbook_log.len()
            ))
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.playbook_log.is_empty() {
            widgets::empty_state(
                ui,
                icons::LIST,
                "AUCUNE EX\u{00c9}CUTION",
                Some("Les d\u{00e9}clenchements de playbooks seront enregistr\u{00e9}s ici."),
            );
        } else {
            let columns = vec![
                TableColumn {
                    key: "playbook",
                    label: "PLAYBOOK",
                    width: ColumnWidth::Fixed(180.0),
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "event",
                    label: "\u{00c9}V\u{00c9}NEMENT",
                    width: ColumnWidth::Fill,
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "actions",
                    label: "ACTIONS",
                    width: ColumnWidth::Fixed(180.0),
                    sortable: false,
                    align: ColumnAlign::Left,
                },
                TableColumn {
                    key: "result",
                    label: "R\u{00c9}SULTAT",
                    width: ColumnWidth::Fixed(100.0),
                    sortable: false,
                    align: ColumnAlign::Center,
                },
                TableColumn {
                    key: "date",
                    label: "DATE",
                    width: ColumnWidth::Fixed(130.0),
                    sortable: false,
                    align: ColumnAlign::Right,
                },
            ];

            let table = DataTable::new("playbook_log_table", columns);
            let mut sort = TableSort::default();
            table.show_header(ui, &mut sort);

            let page_size = 15;
            let entries: Vec<_> = state.threats.playbook_log.iter().take(page_size).collect();

            for (row_idx, entry) in entries.iter().enumerate() {
                let actions_str = entry.actions_executed.join(", ");
                let (result_label, result_color) = if entry.success {
                    ("Succ\u{00e8}s", theme::SUCCESS)
                } else {
                    ("\u{00c9}chec", theme::ERROR)
                };
                let date = entry.triggered_at.format("%d/%m/%Y %H:%M").to_string();
                let result_cell = format!(
                    "{} {}",
                    if entry.success { icons::CHECK } else { icons::CIRCLE_XMARK },
                    result_label
                );

                let cells: Vec<&str> = vec![
                    &entry.playbook_name,
                    &entry.trigger_event,
                    &actions_str,
                    &result_cell,
                    &date,
                ];

                ui.push_id(format!("log_{}", row_idx), |ui: &mut egui::Ui| {
                    table.show_row(ui, row_idx, false, &cells);
                });

                // Show error detail if present
                if let Some(ref err) = entry.error {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.add_space(theme::SPACE_LG);
                        ui.label(
                            egui::RichText::new(format!("{} {}", icons::WARNING, err))
                                .font(theme::font_min())
                                .color(result_color),
                        );
                    });
                }
            }
        }
    });

    command
}

/// Inline form to create a new playbook.
fn show_playbook_form(ui: &mut Ui, state: &mut AppState, command: &mut Option<GuiCommand>) {
    // Use a thread-local for form state so it persists across frames
    thread_local! {
        static FORM: std::cell::RefCell<InlinePlaybookForm> = const { std::cell::RefCell::new(InlinePlaybookForm {
            name: String::new(),
            description: String::new(),
            conditions: Vec::new(),
            actions: Vec::new(),
        }) };
    }

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("NOUVEAU PLAYBOOK")
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
                widgets::text_input(ui, &mut f.name, "Nom du playbook...");
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
            ui.add_space(theme::SPACE_SM);

            // Conditions section
            ui.label(
                egui::RichText::new("CONDITIONS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.add_space(theme::SPACE_XS);

            let condition_types = PlaybookConditionType::all();
            let cond_labels: Vec<&str> = condition_types.iter().map(|c| c.label_fr()).collect();

            let mut remove_cond_idx: Option<usize> = None;
            for (i, cond) in f.conditions.iter_mut().enumerate() {
                ui.push_id(format!("cond_{}", i), |ui: &mut egui::Ui| {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let mut idx = condition_types
                            .iter()
                            .position(|c| *c == cond.condition_type)
                            .unwrap_or(0);
                        if widgets::dropdown(ui, "cond_type", &cond_labels, &mut idx)
                            && let Some(ct) = condition_types.get(idx)
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
                f.conditions.push(PlaybookCondition {
                    condition_type: PlaybookConditionType::ProcessNameMatch,
                    operator: "contient".to_string(),
                    value: String::new(),
                });
            }

            ui.add_space(theme::SPACE_SM);

            // Actions section
            ui.label(
                egui::RichText::new("ACTIONS")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL),
            );
            ui.add_space(theme::SPACE_XS);

            let action_types = PlaybookActionType::all();
            let action_labels: Vec<&str> = action_types.iter().map(|a| a.label_fr()).collect();

            let mut remove_action_idx: Option<usize> = None;
            for (i, action) in f.actions.iter_mut().enumerate() {
                ui.push_id(format!("action_{}", i), |ui: &mut egui::Ui| {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let mut idx = action_types
                            .iter()
                            .position(|a| *a == action.action_type)
                            .unwrap_or(0);
                        if widgets::dropdown(ui, "action_type", &action_labels, &mut idx)
                            && let Some(at) = action_types.get(idx)
                        {
                            action.action_type = *at;
                        }
                        ui.add_space(theme::SPACE_XS);
                        if widgets::ghost_button(ui, icons::TRASH.to_string()).clicked() {
                            remove_action_idx = Some(i);
                        }
                    });
                });
            }
            if let Some(idx) = remove_action_idx
                && idx < f.actions.len()
            {
                f.actions.remove(idx);
            }

            if widgets::ghost_button(
                ui,
                format!("{}  Ajouter une action", icons::PLUS),
            )
            .clicked()
            {
                f.actions.push(PlaybookAction {
                    action_type: PlaybookActionType::KillProcess,
                    parameters: String::new(),
                });
            }

            ui.add_space(theme::SPACE_MD);

            // Save / Cancel
            ui.horizontal(|ui: &mut egui::Ui| {
                let can_save =
                    !f.name.trim().is_empty() && !f.conditions.is_empty() && !f.actions.is_empty();

                if widgets::primary_button(
                    ui,
                    format!("{}  Enregistrer", icons::SAVE),
                    can_save,
                )
                .clicked()
                    && can_save
                {
                    let playbook = Playbook {
                        id: Uuid::new_v4(),
                        name: f.name.trim().to_string(),
                        description: f.description.trim().to_string(),
                        enabled: true,
                        conditions: f.conditions.clone(),
                        actions: f.actions.clone(),
                        created_at: Utc::now(),
                        last_triggered: None,
                        trigger_count: 0,
                        is_template: false,
                    };

                    *command = Some(GuiCommand::SavePlaybook {
                        playbook: Box::new(playbook.clone()),
                    });
                    state.threats.playbooks.push(playbook);
                    state.threats.playbook_editing = false;

                    // Reset form
                    f.name.clear();
                    f.description.clear();
                    f.conditions.clear();
                    f.actions.clear();
                }

                ui.add_space(theme::SPACE_SM);

                if widgets::ghost_button(
                    ui,
                    format!("{}  Annuler", icons::XMARK),
                )
                .clicked()
                {
                    state.threats.playbook_editing = false;
                    f.name.clear();
                    f.description.clear();
                    f.conditions.clear();
                    f.actions.clear();
                }
            });
        });
    });
}
