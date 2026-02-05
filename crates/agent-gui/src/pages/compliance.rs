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
            "Conformité Réglementaire",
            Some("ANALYSE DES ÉCARTS ET MATRICE DE CONTRÔLES ISO 27001 / 27005"),
            Some("Évaluez votre posture de sécurité par rapport aux référentiels ISO 27001/27005. Chaque contrôle indique son statut et propose des actions de remédiation directes."),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!("{}  {}", if is_scanning { "SCAN EN COURS" } else { "LANCER L'AUDIT" }, icons::PLAY),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }
        });
        ui.add_space(theme::SPACE_MD);

        // Active Frameworks indicator (AAA)
        if let Some(frameworks) = &state.summary.active_frameworks
            && !frameworks.is_empty()
        {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("RÉFÉRENTIELS ACTIFS :")
                        .font(egui::FontId::proportional(10.0))
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.add_space(theme::SPACE_XS);
                for fw in frameworks {
                    widgets::status_badge(ui, &fw.to_uppercase(), theme::INFO);
                    ui.add_space(theme::SPACE_XS);
                }
            });
            ui.add_space(theme::SPACE_MD);
        }

        // Summary cards row (AAA Grade)
        let card_grid = widgets::ResponsiveGrid::new(230.0, theme::SPACE_SM);
        let items = vec![
            (
                "CONTRÔLES ANALYSÉS",
                state.policy.total_policies.to_string(),
                theme::text_primary(),
                icons::SQUARE,
            ),
            (
                "POINTS CONFORMES",
                state.policy.passing.to_string(),
                theme::SUCCESS,
                icons::CIRCLE_CHECK,
            ),
            (
                "NON-CONFORMITÉS",
                state.policy.failing.to_string(),
                theme::ERROR,
                icons::CIRCLE_XMARK,
            ),
            (
                "ERREURS D'AUDIT",
                state.policy.errors.to_string(),
                theme::WARNING,
                icons::WARNING,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let pass_active = state.compliance_status_filter == Some(0);
        let fail_active = state.compliance_status_filter == Some(1);
        let err_active = state.compliance_status_filter == Some(2);

        let search_lower = state.compliance_search.to_lowercase();
        let filtered: Vec<usize> = state
            .checks
            .iter()
            .enumerate()
            .filter(|(_, c)| {
                if !search_lower.is_empty() {
                    let haystack = format!("{} {} {}", c.name.to_lowercase(), c.category.to_lowercase(), c.check_id.to_lowercase());
                    if !haystack.contains(&search_lower) { return false; }
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
            "Rechercher un contrôle, un identifiant ou une catégorie...",
        )
        .chip("CONFORME", pass_active, theme::SUCCESS)
        .chip("DÉFAILLANT", fail_active, theme::ERROR)
        .chip("ERREUR", err_active, theme::WARNING)
        .result_count(result_count)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx { 0 => Some(0), 1 => Some(1), 2 => Some(2), _ => None };
            if state.compliance_status_filter == target { state.compliance_status_filter = None; }
            else { state.compliance_status_filter = target; }
        }

        ui.add_space(theme::SPACE_SM);

        // Group-by buttons (AAA Styling)
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("STRUCTURE D'AFFICHAGE :")
                    .font(egui::FontId::proportional(10.0))
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );
            ui.add_space(theme::SPACE_XS);
            for (val, label) in [(0u8, "LISTE PLATE"), (1, "PAR CATÉGORIE"), (2, "PAR RÉFÉRENTIEL")] {
                let active = state.compliance_group_by == val;
                let (btn_color, text_color) = if active {
                    (theme::ACCENT, theme::text_on_accent())
                } else {
                    (theme::bg_elevated(), theme::text_secondary())
                };
                
                let btn = egui::Button::new(
                    egui::RichText::new(label)
                        .font(egui::FontId::proportional(10.0))
                        .color(text_color)
                        .strong(),
                )
                .fill(btn_color)
                .corner_radius(egui::CornerRadius::same(theme::BADGE_ROUNDING))
                .min_size(egui::vec2(0.0, 22.0));
                
                if ui.add(btn).clicked() {
                    state.compliance_group_by = val;
                }
            }

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  CSV", icons::DOWNLOAD))
                        .font(egui::FontId::proportional(10.0))
                        .color(theme::text_tertiary())
                        .strong(),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_csv(state, &filtered);
                }
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Check results table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("MATRICE DES CONTRÔLES D'AUDIT")
                        .font(egui::FontId::proportional(10.0))
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
                    if !state.checks.is_empty() {
                        ui.label(
                            egui::RichText::new(format!("{} ÉLÉMENTS AFFICHÉS", result_count))
                                .font(egui::FontId::proportional(10.0))
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    }
                });
            });
            ui.add_space(theme::SPACE_MD);

            if filtered.is_empty() {
                if state.compliance_status_filter == Some(1) {
                    widgets::protected_state(
                        ui,
                        icons::SHIELD_CHECK,
                        "OBJECTIF DE CONFORMITÉ ATTEINT",
                        "Tous les contrôles audités sont conformes aux référentiels actifs.",
                    );
                } else if state.checks.is_empty() {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "AUCUNE BASE DE CONTRÔLES",
                        Some("En attente de synchronisation des politiques avec le serveur central..."),
                    );
                } else {
                    widgets::empty_state(
                        ui,
                        icons::COMPLIANCE,
                        "AUCUN RÉSULTAT CORRESPONDANT",
                        Some("Modifiez vos critères de recherche ou de filtrage."),
                    );
                }
            } else if state.compliance_group_by == 0 {
                ui.push_id("compliance_table_flat", |ui: &mut egui::Ui| {
                    Self::render_check_table(ui, state, &filtered, &mut command);
                });
            } else {
                let groups = Self::build_groups(state, &filtered);
                for (group_name, indices) in &groups {
                    let pass_count = indices.iter().filter(|&&i| state.checks[i].status == GuiCheckStatus::Pass).count();
                    let total = indices.len();
                    let pct = if total > 0 { (pass_count as f32 / total as f32) * 100.0 } else { 0.0 };

                    ui.add_space(theme::SPACE_SM);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(group_name.to_uppercase())
                                .font(egui::FontId::proportional(11.0))
                                .color(theme::text_primary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                        ui.add_space(theme::SPACE_SM);
                        let score_color = theme::score_color(pct);
                        widgets::status_badge(
                            ui,
                            &format!("{:.0}% CONFORMITÉ ({}/{})", pct, pass_count, total),
                            score_color,
                        );
                    });
                    ui.add_space(theme::SPACE_XS);

                    ui.push_id(format!("compliance_group_{}", group_name), |ui: &mut egui::Ui| {
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
            } else if check.frameworks.is_empty() {
                "NON CLASSÉ".to_string()
            } else {
                check.frameworks.first().cloned().unwrap_or_default()
            };
            map.entry(key).or_default().push(i);
        }
        map.into_iter().collect()
    }

    fn render_check_table(
        ui: &mut Ui,
        state: &AppState,
        indices: &[usize],
        command: &mut Option<GuiCommand>,
    ) {
        use egui_extras::{Column, TableBuilder};

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
            .column(Column::initial(250.0).range(120.0..=600.0).at_least(150.0))
            .column(Column::initial(120.0).at_least(80.0))
            .column(Column::initial(110.0).at_least(90.0))
            .column(Column::initial(100.0).at_least(90.0))
            .column(Column::initial(60.0).at_least(50.0))
            .column(Column::remainder());

        table
            .header(30.0, |mut header| {
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("DÉSIGNATION DU POINT").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("DOMAINE").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("STATUT").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("IMPACT").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("TAUX").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
                header.col(|ui: &mut egui::Ui| {
                    ui.label(egui::RichText::new("RÉFÉRENCES RÉGLEMENTAIRES").font(egui::FontId::proportional(9.0)).color(theme::text_tertiary()).strong().extra_letter_spacing(0.5));
                });
            })
            .body(|mut body| {
                for &idx in indices {
                    let check = &state.checks[idx];
                    let expanded = *expanded_states.get(&check.check_id).unwrap_or(&false);
                    let row_height = if expanded { 160.0 } else { 44.0 };

                    body.row(row_height, |mut row| {
                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.add_space(theme::SPACE_XS);
                                let response = ui
                                    .label(
                                        egui::RichText::new(&check.name)
                                            .font(egui::FontId::proportional(13.0))
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
                                                .font(egui::FontId::proportional(11.0))
                                                .color(theme::text_secondary()),
                                        );
                                    }

                                    if let Some(details) = &check.details
                                        && let Some(issues) =
                                            details.get("issues").and_then(|i| i.as_array())
                                    {
                                        for issue in issues.iter() {
                                            ui.horizontal(|ui: &mut egui::Ui| {
                                                ui.label(egui::RichText::new("•").color(theme::ERROR));
                                                ui.label(
                                                    egui::RichText::new(issue.as_str().unwrap_or("Problème détecté"))
                                                        .font(egui::FontId::proportional(10.0))
                                                        .color(theme::text_tertiary())
                                                );
                                            });
                                        }
                                    }

                                    if check.status == GuiCheckStatus::Fail || check.status == GuiCheckStatus::Error {
                                        ui.add_space(theme::SPACE_MD);
                                        ui.horizontal(|ui: &mut egui::Ui| {
                                            let preview_btn = egui::Button::new(
                                                egui::RichText::new(format!("{}  AUDIT VISUEL", icons::EYE))
                                                    .font(egui::FontId::proportional(10.0))
                                                    .color(theme::text_on_accent())
                                                    .strong(),
                                            )
                                            .fill(theme::INFO.linear_multiply(0.8))
                                            .corner_radius(egui::CornerRadius::same(theme::BADGE_ROUNDING));
                                            
                                            if ui.add(preview_btn).clicked() {
                                                *command = Some(GuiCommand::RemediatePreview { check_id: check.check_id.clone() });
                                            }

                                            ui.add_space(theme::SPACE_SM);

                                            let fix_btn = egui::Button::new(
                                                egui::RichText::new(format!("{}  RECOURS / REMÉDIATION", icons::WRENCH_FA))
                                                    .font(egui::FontId::proportional(10.0))
                                                    .color(theme::text_on_accent())
                                                    .strong(),
                                            )
                                            .fill(theme::SUCCESS.linear_multiply(0.9))
                                            .corner_radius(egui::CornerRadius::same(theme::BADGE_ROUNDING));
                                            
                                            if ui.add(fix_btn).clicked() {
                                                *command = Some(GuiCommand::Remediate { check_id: check.check_id.clone() });
                                            }
                                        });
                                    }
                                }
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(check.category.to_uppercase())
                                    .font(egui::FontId::proportional(10.0))
                                    .color(theme::text_tertiary())
                                    .strong(),
                            );
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) = Self::status_display(&check.status);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let color = theme::severity_color(&check.severity);
                            ui.horizontal(|ui: &mut egui::Ui| {
                                ui.painter().circle_filled(
                                    ui.available_rect_before_wrap().min + egui::vec2(6.0, 10.0),
                                    3.0,
                                    color,
                                );
                                ui.add_space(14.0);
                                ui.label(
                                    egui::RichText::new(check.severity.to_uppercase())
                                        .font(egui::FontId::proportional(10.0))
                                        .color(color)
                                        .strong(),
                                );
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            if let Some(s) = check.score {
                                ui.label(
                                    egui::RichText::new(format!("{:.0}%", s))
                                        .font(egui::FontId::proportional(13.0))
                                        .color(theme::score_color(s as f32))
                                        .strong(),
                                );
                            } else {
                                ui.label(egui::RichText::new("--").color(theme::text_tertiary()));
                            }
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.horizontal_wrapped(|ui: &mut egui::Ui| {
                                for fw in &check.frameworks {
                                    widgets::status_badge(ui, fw, theme::bg_elevated().linear_multiply(2.0));
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
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(egui::FontId::proportional(24.0))
                                .color(color)
                                .strong()
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(egui::FontId::proportional(10.0))
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(0.5)
                                .strong(),
                        );
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(icon)
                                .size(28.0)
                                .color(color.linear_multiply(0.25)),
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

#[allow(dead_code)]
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
