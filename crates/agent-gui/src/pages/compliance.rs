//! Compliance page -- check results and policy overview.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, GuiCheckStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct CompliancePage;

impl CompliancePage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Conformit\u{00e9}",
            Some("Suivi des contrôles et alignement avec les référentiels de sécurité"),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar
        ui.horizontal(|ui| {
            if widgets::button::primary_button(ui, format!("{}  Lancer le scan", icons::PLAY), state.summary.status != GuiAgentStatus::Scanning)
                .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Active Frameworks indicator
        if let Some(frameworks) = &state.summary.active_frameworks
            && !frameworks.is_empty()
        {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Frameworks actifs :")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                for fw in frameworks {
                    widgets::status_badge(ui, fw, theme::INFO);
                    ui.add_space(theme::SPACE_XS);
                }
            });
            ui.add_space(theme::SPACE_MD);
        }

        // Summary cards row
        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 3.0) / 4.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;
            Self::summary_card(
                ui,
                card_w,
                "TOTAL",
                &state.policy.total_policies.to_string(),
                theme::text_primary(),
                icons::SQUARE,
            );
            Self::summary_card(
                ui,
                card_w,
                "CONFORME",
                &state.policy.passing.to_string(),
                theme::SUCCESS,
                icons::CIRCLE_CHECK,
            );
            Self::summary_card(
                ui,
                card_w,
                "NON-CONFORME",
                &state.policy.failing.to_string(),
                theme::ERROR,
                icons::CIRCLE_XMARK,
            );
            Self::summary_card(
                ui,
                card_w,
                "ERREURS",
                &state.policy.errors.to_string(),
                theme::WARNING,
                icons::WARNING,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar
        let pass_active = state.compliance_status_filter == Some(0);
        let fail_active = state.compliance_status_filter == Some(1);
        let err_active = state.compliance_status_filter == Some(2);

        // Filter the checks
        let search_lower = state.compliance_search.to_lowercase();
        let filtered: Vec<usize> = state
            .checks
            .iter()
            .enumerate()
            .filter(|(_, c)| {
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {} {}",
                        c.name.to_lowercase(),
                        c.category.to_lowercase(),
                        c.check_id.to_lowercase(),
                    );
                    if !haystack.contains(&search_lower) {
                        return false;
                    }
                }
                match state.compliance_status_filter {
                    Some(0) => c.status == GuiCheckStatus::Pass,
                    Some(1) => c.status == GuiCheckStatus::Fail,
                    Some(2) => c.status == GuiCheckStatus::Error,
                    _ => true,
                }
            })
            .map(|(i, _)| i)
            .collect();

        let result_count = filtered.len();

        let toggled = widgets::SearchFilterBar::new(
            &mut state.compliance_search,
            "Rechercher (nom, cat\u{00e9}gorie, ID)...",
        )
        .chip("CONFORME", pass_active, theme::SUCCESS)
        .chip("NON-CONFORME", fail_active, theme::ERROR)
        .chip("ERREUR", err_active, theme::WARNING)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target: Option<u8> = match idx {
                0 => Some(0),
                1 => Some(1),
                2 => Some(2),
                _ => None,
            };
            // Toggle off if already active
            if state.compliance_status_filter == target {
                state.compliance_status_filter = None;
            } else {
                state.compliance_status_filter = target;
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Group-by buttons
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new("Grouper par :")
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
            ui.add_space(theme::SPACE_XS);
            for (val, label) in [(0u8, "Aucun"), (1, "Cat\u{00e9}gorie"), (2, "Framework")] {
                let active = state.compliance_group_by == val;
                let (bg, fg) = if active {
                    (theme::ACCENT, theme::text_on_accent())
                } else {
                    (theme::bg_elevated(), theme::text_secondary())
                };
                let btn = egui::Button::new(
                    egui::RichText::new(label)
                        .font(theme::font_small())
                        .color(fg)
                        .strong(),
                )
                .fill(bg)
                .corner_radius(egui::CornerRadius::same(theme::BADGE_ROUNDING))
                .min_size(egui::vec2(0.0, 22.0));
                if ui.add(btn).clicked() {
                    state.compliance_group_by = val;
                }
            }

            // CSV export button on the right
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_csv(state, &filtered);
                }
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Check results table
        widgets::card(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("R\u{00c9}SULTATS D\u{00c9}TAILL\u{00c9}S")
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if !state.checks.is_empty() {
                        ui.label(
                            egui::RichText::new(format!("{} contr\u{00f4}les", result_count))
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                    }
                });
            });
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                // Smart Empty State
                if state.compliance_status_filter == Some(1) {
                    // Filter = Fail
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "Conformité Totale",
                        "Tous les contrôles respectent la politique de sécurité.",
                    );
                } else if state.checks.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "Aucune politique",
                        Some("En attente de synchronisation des politiques..."),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "Aucune vérification correspondante",
                        Some("Modifiez vos filtres pour voir les résultats."),
                    );
                }
            } else if state.compliance_group_by == 0 {
                // Flat table
                ui.push_id("compliance_table_flat", |ui| {
                    Self::render_check_table(ui, state, &filtered, &mut command);
                });
            } else {
                // Grouped display
                let groups = Self::build_groups(state, &filtered);
                for (group_name, indices) in &groups {
                    let pass_count = indices
                        .iter()
                        .filter(|&&i| state.checks[i].status == GuiCheckStatus::Pass)
                        .count();
                    let total = indices.len();
                    let pct = if total > 0 {
                        (pass_count as f32 / total as f32) * 100.0
                    } else {
                        0.0
                    };

                    ui.add_space(theme::SPACE_SM);
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(group_name)
                                .font(theme::font_heading())
                                .color(theme::text_primary())
                                .strong(),
                        );
                        ui.add_space(theme::SPACE_SM);
                        let score_color = theme::score_color(pct);
                        widgets::status_badge(
                            ui,
                            &format!("{:.0}% ({}/{})", pct, pass_count, total),
                            score_color,
                        );
                    });
                    ui.add_space(theme::SPACE_XS);

                    ui.push_id(format!("compliance_group_{}", group_name), |ui| {
                        Self::render_check_table(ui, state, indices, &mut command);
                    });
                    ui.add_space(theme::SPACE_SM);
                }
            }
        });

        ui.add_space(theme::SPACE_XL);

        command
    }

    fn build_groups(state: &AppState, indices: &[usize]) -> Vec<(String, Vec<usize>)> {
        use std::collections::BTreeMap;
        let mut map: BTreeMap<String, Vec<usize>> = BTreeMap::new();
        for &i in indices {
            let check = &state.checks[i];
            let key = if state.compliance_group_by == 1 {
                check.category.clone()
            } else {
                // Group by framework -- a check can appear in multiple frameworks
                if check.frameworks.is_empty() {
                    "Sans framework".to_string()
                } else {
                    check.frameworks.first().cloned().unwrap_or_default()
                }
            };
            map.entry(key).or_default().push(i);
        }
        // If grouping by framework and a check has multiple frameworks, it only appears once (first).
        map.into_iter().collect()
    }

    fn render_check_table(
        ui: &mut Ui,
        state: &AppState,
        indices: &[usize],
        command: &mut Option<GuiCommand>,
    ) {
        use egui_extras::{Column, TableBuilder};

        // Pre-compute expanded states
        let expanded_states: std::collections::HashMap<String, bool> = indices
            .iter()
            .map(|&i| {
                let check = &state.checks[i];
                let id = ui.make_persistent_id(&check.check_id);
                let expanded = ui.memory(|mem| mem.data.get_temp::<bool>(id).unwrap_or(false));
                (check.check_id.clone(), expanded)
            })
            .collect();

        let table = TableBuilder::new(ui)
            .striped(false)
            .resizable(true)
            .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
            .column(Column::initial(180.0).range(120.0..=400.0).at_least(120.0))
            .column(Column::initial(120.0).at_least(80.0))
            .column(Column::initial(120.0).at_least(80.0))
            .column(Column::initial(100.0).at_least(70.0))
            .column(Column::initial(60.0).at_least(40.0))
            .column(Column::remainder());

        table
            .header(28.0, |mut header| {
                header.col(|ui| {
                    ui.strong("V\u{00c9}RIFICATION");
                });
                header.col(|ui| {
                    ui.strong("CAT\u{00c9}GORIE");
                });
                header.col(|ui| {
                    ui.strong("STATUT");
                });
                header.col(|ui| {
                    ui.strong("S\u{00c9}V\u{00c9}RIT\u{00c9}");
                });
                header.col(|ui| {
                    ui.strong("SCORE");
                });
                header.col(|ui| {
                    ui.strong("FRAMEWORKS");
                });
            })
            .body(|mut body| {
                for &idx in indices {
                    let check = &state.checks[idx];
                    let expanded = *expanded_states.get(&check.check_id).unwrap_or(&false);
                    let row_height = if expanded { 120.0 } else { 40.0 };

                    body.row(row_height, |mut row| {
                        row.col(|ui| {
                            ui.vertical(|ui| {
                                let response = ui
                                    .label(
                                        egui::RichText::new(&check.name)
                                            .font(theme::font_body())
                                            .color(theme::text_primary())
                                            .strong(),
                                    )
                                    .interact(egui::Sense::click());

                                if response.clicked() {
                                    let id = ui.make_persistent_id(&check.check_id);
                                    ui.memory_mut(|mem| mem.data.insert_temp(id, !expanded));
                                }

                                if expanded {
                                    ui.add_space(theme::SPACE_XS);
                                    if let Some(msg) = &check.message {
                                        ui.label(
                                            egui::RichText::new(msg)
                                                .color(theme::text_secondary())
                                                .font(theme::font_small()),
                                        );
                                    }

                                    if let Some(details) = &check.details
                                        && let Some(issues) =
                                            details.get("issues").and_then(|i| i.as_array())
                                    {
                                        for issue in issues.iter() {
                                            ui.horizontal(|ui| {
                                                ui.label(
                                                    egui::RichText::new("\u{2022}")
                                                        .color(theme::ERROR),
                                                );
                                                ui.label(
                                                    egui::RichText::new(issue.as_str().unwrap_or(
                                                        "Probl\u{00e8}me d\u{00e9}tect\u{00e9}",
                                                    ))
                                                    .color(theme::text_secondary())
                                                    .font(theme::font_small()),
                                                );
                                            });
                                        }
                                    }

                                    // Remediation for failing checks
                                    if check.status == GuiCheckStatus::Fail
                                        || check.status == GuiCheckStatus::Error
                                    {
                                        let hint = remediation_hint(&check.category);
                                        if !hint.is_empty() {
                                            ui.add_space(theme::SPACE_XS);
                                            ui.horizontal(|ui| {
                                                ui.label(
                                                    egui::RichText::new(icons::WRENCH)
                                                        .color(theme::INFO),
                                                );
                                                ui.label(
                                                    egui::RichText::new(hint)
                                                        .font(theme::font_small())
                                                        .color(theme::INFO),
                                                );
                                            });
                                        }

                                        // Remediation action buttons
                                        ui.add_space(theme::SPACE_XS);
                                        ui.horizontal(|ui| {
                                            let preview_btn = egui::Button::new(
                                                egui::RichText::new(format!(
                                                    "{}  Aper\u{00e7}u",
                                                    icons::EYE
                                                ))
                                                .font(theme::font_small())
                                                .color(theme::text_on_accent())
                                                .strong(),
                                            )
                                            .fill(theme::INFO)
                                            .corner_radius(egui::CornerRadius::same(
                                                theme::BADGE_ROUNDING,
                                            ))
                                            .min_size(egui::vec2(80.0, 24.0));
                                            if ui.add(preview_btn).clicked() {
                                                *command = Some(GuiCommand::RemediatePreview {
                                                    check_id: check.check_id.clone(),
                                                });
                                            }

                                            ui.add_space(theme::SPACE_SM);

                                            let fix_btn = egui::Button::new(
                                                egui::RichText::new(format!(
                                                    "{}  Corriger",
                                                    icons::WRENCH_FA
                                                ))
                                                .font(theme::font_small())
                                                .color(theme::text_on_accent())
                                                .strong(),
                                            )
                                            .fill(theme::SUCCESS)
                                            .corner_radius(egui::CornerRadius::same(
                                                theme::BADGE_ROUNDING,
                                            ))
                                            .min_size(egui::vec2(90.0, 24.0));
                                            if ui.add(fix_btn).clicked() {
                                                *command = Some(GuiCommand::Remediate {
                                                    check_id: check.check_id.clone(),
                                                });
                                            }
                                        });
                                    }
                                }
                            });
                        });

                        row.col(|ui| {
                            ui.label(
                                egui::RichText::new(&check.category)
                                    .font(theme::font_small())
                                    .color(theme::text_secondary()),
                            );
                        });

                        row.col(|ui| {
                            let (label, color) = Self::status_display(&check.status);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui| {
                            let color = theme::severity_color(&check.severity);
                            ui.horizontal(|ui| {
                                ui.painter().circle_filled(
                                    ui.available_rect_before_wrap().min + egui::vec2(6.0, 10.0),
                                    3.0,
                                    color,
                                );
                                ui.add_space(14.0);
                                ui.label(
                                    egui::RichText::new(check.severity.to_uppercase())
                                        .font(theme::font_small())
                                        .color(color)
                                        .strong(),
                                );
                            });
                        });

                        row.col(|ui| {
                            if let Some(s) = check.score {
                                ui.label(
                                    egui::RichText::new(format!("{:.0}%", s))
                                        .font(theme::font_body())
                                        .color(theme::score_color(s as f32))
                                        .strong(),
                                );
                            } else {
                                ui.label(egui::RichText::new("--").color(theme::text_tertiary()));
                            }
                        });

                        row.col(|ui| {
                            ui.horizontal_wrapped(|ui| {
                                for fw in &check.frameworks {
                                    ui.label(
                                        egui::RichText::new(fw)
                                            .font(theme::font_small())
                                            .color(theme::text_secondary())
                                            .background_color(theme::bg_elevated()),
                                    );
                                    ui.add_space(theme::SPACE_XS);
                                }
                            });
                        });
                    });
                }
            });
    }

    fn export_csv(state: &AppState, indices: &[usize]) {
        let headers = &[
            "check_id",
            "nom",
            "categorie",
            "statut",
            "severite",
            "score",
            "frameworks",
        ];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let c = &state.checks[i];
                let (st, _) = Self::status_display(&c.status);
                vec![
                    c.check_id.clone(),
                    c.name.clone(),
                    c.category.clone(),
                    st.to_string(),
                    c.severity.clone(),
                    c.score.map_or("--".into(), |s| format!("{}", s)),
                    c.frameworks.join(", "),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("conformite.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }

    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new(value).size(24.0).color(color).strong());
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.4)),
                        );
                    });
                });
            });
        });
    }

    fn status_display(status: &GuiCheckStatus) -> (&'static str, egui::Color32) {
        match status {
            GuiCheckStatus::Pass => ("CONFORME", theme::SUCCESS),
            GuiCheckStatus::Fail => ("NON-CONFORME", theme::ERROR),
            GuiCheckStatus::Error => ("ERREUR", theme::ERROR),
            GuiCheckStatus::Skipped => ("IGNOR\u{00c9}", theme::text_tertiary()),
            GuiCheckStatus::Pending => ("EN ATTENTE", theme::WARNING),
            GuiCheckStatus::Running => ("EN COURS", theme::INFO),
        }
    }
}

fn remediation_hint(category: &str) -> &'static str {
    match category {
        "encryption" => {
            "Activez le chiffrement du disque (FileVault) dans les Preferences Systeme."
        }
        "firewall" => "Activez le pare-feu dans Preferences Systeme > Securite.",
        "updates" => "Installez les mises a jour en attente.",
        "antivirus" => "Verifiez que votre solution antivirus est active et a jour.",
        "passwords" => "Renforcez la politique de mots de passe.",
        "screen_lock" => "Configurez le verrouillage automatique de l'ecran.",
        "network" => "Verifiez la configuration reseau et les regles de pare-feu.",
        _ => "",
    }
}
