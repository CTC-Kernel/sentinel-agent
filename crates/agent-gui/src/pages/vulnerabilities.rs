//! Vulnerabilities page -- vulnerability findings and summary.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, Severity};

use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct VulnerabilitiesPage;

impl VulnerabilitiesPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Pilotage", "Vulnérabilités"],
            "Vulnérabilités",
            Some("ANALYSE DYNAMIQUE DES FAILLES ET EXPOSITION AUX CVE"),
            Some(
                "Identifiez les failles de sécurité connues (CVE) affectant vos logiciels. Le score critique (V3) priorise les vulnérabilités les plus dangereuses nécessitant une mise à jour immédiate.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar (AAA Grade)
        ui.horizontal(|ui: &mut egui::Ui| {
            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
            if widgets::button::primary_button_loading(
                ui,
                format!(
                    "{}  {}",
                    if is_scanning {
                        "SCAN EN COURS"
                    } else {
                        "LANCER LE SCAN"
                    },
                    icons::PLAY
                ),
                !is_scanning,
                is_scanning,
            )
            .clicked()
            {
                command = Some(GuiCommand::RunCheck);
            }

            ui.add_space(theme::SPACE_SM);

            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let search_lower = state.vulnerability.search.to_lowercase();
                        let filtered_indices: Vec<usize> = state
                            .vulnerability_findings
                            .iter()
                            .enumerate()
                            .filter(|(_, f)| {
                                if !search_lower.is_empty() {
                                    let haystack = format!(
                                        "{} {} {}",
                                        f.cve_id.to_lowercase(),
                                        f.affected_software.to_lowercase(),
                                        f.description.to_lowercase()
                                    );
                                    if !haystack.contains(&search_lower) {
                                        return false;
                                    }
                                }
                                if let Some(ref sev) = state.vulnerability.severity_filter {
                                    f.severity == *sev
                                } else {
                                    true
                                }
                            })
                            .map(|(i, _)| i)
                            .collect();
                        let success = Self::export_csv(state, &filtered_indices);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV réussi")
                                    .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("Échec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_MD);

        // Summary cards row (AAA Grade)
        let summary = state.vulnerability_summary.as_ref();
        let critical = summary.map_or(0, |s| s.critical);
        let high = summary.map_or(0, |s| s.high);
        let medium = summary.map_or(0, |s| s.medium);
        let low = summary.map_or(0, |s| s.low);

        let card_grid = widgets::ResponsiveGrid::new(230.0, theme::SPACE_SM);
        let items = vec![
            (
                "CRITIQUES",
                critical.to_string(),
                if critical > 0 {
                    theme::ERROR
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_CRITICAL,
            ),
            (
                "ÉLEVÉES",
                high.to_string(),
                if high > 0 {
                    theme::SEVERITY_HIGH
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_HIGH,
            ),
            (
                "MOYENNES",
                medium.to_string(),
                if medium > 0 {
                    theme::SEVERITY_MEDIUM
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_MEDIUM,
            ),
            (
                "FAIBLES",
                low.to_string(),
                if low > 0 {
                    theme::INFO
                } else {
                    theme::text_tertiary()
                },
                icons::SEVERITY_LOW,
            ),
        ];

        card_grid.show(ui, &items, |ui, width, item| {
            let (label, value, color, icon) = item;
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_MD);

        // Coverage and distribution indicators (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("INDICATEURS DE COUVERTURE")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            let total_findings = state.vulnerability_findings.len();
            let fix_available_count = state
                .vulnerability_findings
                .iter()
                .filter(|v| v.fix_available)
                .count();

            // A. Fix availability ratio
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::WRENCH)
                        .color(theme::accent_text().linear_multiply(theme::OPACITY_STRONG))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                let fix_pct = if total_findings > 0 {
                    (fix_available_count as f32 / total_findings as f32) * 100.0
                } else {
                    0.0
                };
                ui.label(
                    egui::RichText::new(format!(
                        "Correctifs disponibles : {}/{} ({:.0}%)",
                        fix_available_count, total_findings, fix_pct
                    ))
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
                );
            });
            ui.add_space(theme::SPACE_XS);
            let fix_ratio = if total_findings > 0 {
                fix_available_count as f32 / total_findings as f32
            } else {
                0.0
            };
            let fix_style = if fix_ratio >= 0.8 {
                widgets::ProgressStyle::Success
            } else if fix_ratio >= 0.5 {
                widgets::ProgressStyle::Warning
            } else {
                widgets::ProgressStyle::Error
            };
            widgets::progress_bar_styled(ui, fix_ratio, fix_style, None);

            ui.add_space(theme::SPACE_MD);

            // B. Remediation coverage
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::SHIELD_CHECK)
                        .color(theme::readable_color(theme::SUCCESS))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                let remediation_pct = if total_findings > 0 {
                    (fix_available_count as f32 / total_findings as f32) * 100.0
                } else {
                    100.0
                };
                ui.label(
                    egui::RichText::new(format!(
                        "Couverture de rem\u{00e9}diation : {:.0}%",
                        remediation_pct
                    ))
                    .font(theme::font_body())
                    .color(theme::text_primary())
                    .strong(),
                );
            });
            ui.add_space(theme::SPACE_XS);
            let remediation_ratio = if total_findings > 0 {
                fix_available_count as f32 / total_findings as f32
            } else {
                1.0
            };
            widgets::progress_bar_styled(ui, remediation_ratio, widgets::ProgressStyle::Gradient, None);

            ui.add_space(theme::SPACE_MD);

            // C. Average CVSS score
            let (cvss_sum, cvss_count) = state
                .vulnerability_findings
                .iter()
                .fold((0.0_f32, 0_u32), |(sum, count), v| {
                    if let Some(score) = v.cvss_score {
                        (sum + score, count + 1)
                    } else {
                        (sum, count)
                    }
                });
            let avg_cvss = if cvss_count > 0 {
                cvss_sum / cvss_count as f32
            } else {
                0.0
            };
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new(icons::GAUGE_HIGH)
                        .color(theme::readable_color(theme::score_color(100.0 - avg_cvss * 10.0)))
                        .size(theme::ICON_INLINE),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(format!("Score CVSS moyen : {:.1}", avg_cvss))
                        .font(theme::font_body())
                        .color(theme::text_primary())
                        .strong(),
                );
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(format!("({} CVE avec score)", cvss_count))
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            });
        });

        ui.add_space(theme::SPACE_LG);

        // Search / filter bar (AAA Grade)
        let crit_active = state.vulnerability.severity_filter == Some(Severity::Critical);
        let high_active = state.vulnerability.severity_filter == Some(Severity::High);
        let med_active = state.vulnerability.severity_filter == Some(Severity::Medium);
        let low_active = state.vulnerability.severity_filter == Some(Severity::Low);

        let search_id = ui.id().with("vuln_search_cache");
        let search_lower: String = ui.memory(|mem| {
            mem.data.get_temp::<(String, String)>(search_id)
                .filter(|(orig, _)| orig == &state.vulnerability.search)
                .map(|(_, lower)| lower)
        }).unwrap_or_else(|| {
            let lower = state.vulnerability.search.to_lowercase();
            ui.memory_mut(|mem| mem.data.insert_temp(search_id, (state.vulnerability.search.clone(), lower.clone())));
            lower
        });

        let toggled = widgets::SearchFilterBar::new(
            &mut state.vulnerability.search,
            "RECHERCHER (CVE, LOGICIEL, DESCRIPTION)...",
        )
        .chip("CRITIQUE", crit_active, theme::ERROR)
        .chip("ÉLEVÉE", high_active, theme::SEVERITY_HIGH)
        .chip("MOYENNE", med_active, theme::SEVERITY_MEDIUM)
        .chip("FAIBLE", low_active, theme::INFO)
        .show(ui);

        if let Some(idx) = toggled {
            let target = match idx {
                0 => Some(Severity::Critical),
                1 => Some(Severity::High),
                2 => Some(Severity::Medium),
                3 => Some(Severity::Low),
                _ => None,
            };
            if state.vulnerability.severity_filter == target {
                state.vulnerability.severity_filter = None;
            } else {
                state.vulnerability.severity_filter = target;
            }
        }

        ui.add_space(theme::SPACE_SM);

        // Vulnerability findings table (AAA Grade)
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new("FAILLES DE SÉCURITÉ IDENTIFIÉES")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );
            ui.add_space(theme::SPACE_MD);

            Self::show_findings(ui, state, &search_lower, &mut command);
        });

        ui.add_space(theme::SPACE_XL);

        if let Some(sel_idx) = state.vulnerability.selected_vuln
            && sel_idx < state.vulnerability_findings.len()
        {
                let finding = state.vulnerability_findings[sel_idx].clone();
                let (sev_label, sev_color) = Self::severity_display(&finding.severity);
                let cvss_color = if let Some(s) = finding.cvss_score {
                    if s > 7.0 { theme::ERROR } else if s > 4.0 { theme::WARNING } else { theme::SUCCESS }
                } else {
                    theme::text_tertiary()
                };

                let mut actions = Vec::new();
                if finding.fix_available {
                    actions.push(
                        widgets::DetailAction::primary("Appliquer le correctif", icons::WRENCH),
                    );
                }
                actions.push(widgets::DetailAction::secondary("Ignorer", icons::XMARK));
                actions.push(widgets::DetailAction::secondary("Exporter", icons::DOWNLOAD));

                let cve_display = &finding.cve_id;
                let drawer_action = widgets::DetailDrawer::new("vuln_detail", cve_display, icons::VULNERABILITIES)
                    .accent(sev_color)
                    .subtitle(&finding.affected_software)
                    .show(ui.ctx(), &mut state.vulnerability.detail_open, |ui| {
                        widgets::detail_section(ui, "VULN\u{00c9}RABILIT\u{00c9}");
                        widgets::detail_mono(ui, "CVE ID", cve_display);
                        widgets::detail_field(ui, "Logiciel affect\u{00e9}", &finding.affected_software);
                        widgets::detail_field(ui, "Version affect\u{00e9}e", &finding.affected_version);
                        widgets::detail_field_badge(ui, "S\u{00e9}v\u{00e9}rit\u{00e9}", sev_label, sev_color);
                        if let Some(s) = finding.cvss_score {
                            widgets::detail_field_colored(ui, "Score CVSS", &format!("{:.1}", s), theme::readable_color(cvss_color));
                        }
                        widgets::detail_text(ui, "Description", &finding.description);

                        widgets::detail_section(ui, "REM\u{00c9}DIATION");
                        if finding.fix_available {
                            widgets::detail_field_badge(ui, "Fix disponible", "OUI", theme::SUCCESS);
                        } else {
                            widgets::detail_field_badge(ui, "Fix disponible", "NON", theme::ERROR);
                        }
                        if let Some(dt) = finding.discovered_at {
                            widgets::detail_field(ui, "Date de d\u{00e9}couverte", &dt.format("%d/%m/%Y %H:%M").to_string());
                        }
                    }, &actions);

                if let Some(action_idx) = drawer_action {
                    // Offset: when fix_available, index 0=fix, 1=ignore, 2=export
                    // When !fix_available, index 0=ignore, 1=export
                    let fix_offset = if finding.fix_available { 1 } else { 0 };
                    if finding.fix_available && action_idx == 0 {
                        let safe_name = finding.affected_software.replace('\'', "'\\''");
                        let cmd = platform_upgrade_command(&safe_name);
                        ui.ctx().copy_text(cmd);
                        let time = ui.input(|i| i.time);
                        state.toasts.push(
                            crate::widgets::toast::Toast::success(
                                "Commande de mise \u{00e0} jour copi\u{00e9}e dans le presse-papiers",
                            )
                            .with_time(time),
                        );
                    } else if action_idx == fix_offset {
                        state.vulnerability.detail_open = false;
                    } else if action_idx == fix_offset + 1 {
                        let success = Self::export_csv(state, &[sel_idx]);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success("Export CSV r\u{00e9}ussi")
                                    .with_time(time),
                            );
                        }
                    }
                }
            }

        command
    }

    fn show_findings(ui: &mut Ui, state: &mut AppState, search_lower: &str, _command: &mut Option<GuiCommand>) {
        let filtered: Vec<usize> = state
            .vulnerability_findings
            .iter()
            .enumerate()
            .filter(|(_, f)| {
                if !search_lower.is_empty() {
                    let haystack = format!(
                        "{} {} {}",
                        f.cve_id.to_lowercase(),
                        f.affected_software.to_lowercase(),
                        f.description.to_lowercase()
                    );
                    if !haystack.contains(search_lower) {
                        return false;
                    }
                }
                if let Some(ref sev) = state.vulnerability.severity_filter {
                    f.severity == *sev
                } else {
                    true
                }
            })
            .map(|(i, _)| i)
            .collect();

        if state.vulnerability_findings.is_empty() {
            widgets::protected_state(
                ui,
                icons::SHIELD_CHECK,
                "AUCUNE VULNÉRABILITÉ DÉTECTÉE",
                "Le syst\u{00e8}me est \u{00e0} jour et ne pr\u{00e9}sente aucune faille connue \u{00e0} ce jour.",
            );
        } else if filtered.is_empty() {
            widgets::empty_state(
                ui,
                icons::VULNERABILITIES,
                "AUCUN R\u{00c9}SULTAT",
                Some("Ajustez vos filtres de recherche pour voir les vuln\u{00e9}rabilit\u{00e9}s."),
            );
        } else {
            use egui_extras::{Column, TableBuilder};

            let mut clicked_idx: Option<usize> = None;

            let table = TableBuilder::new(ui)
                .striped(false)
                .resizable(true)
                .cell_layout(egui::Layout::left_to_right(egui::Align::Center))
                .column(Column::initial(100.0).at_least(80.0))
                .column(Column::initial(120.0).at_least(100.0))
                .column(Column::initial(80.0).at_least(60.0))
                .column(Column::initial(60.0).at_least(50.0))
                .column(Column::remainder())
                .column(Column::initial(100.0).at_least(90.0));

            table
                .header(28.0, |mut header| {
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("IDENTIFIANT")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("LOGICIEL AFF\u{00c9}RENT")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("S\u{00c9}V\u{00c9}RIT\u{00c9}")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("SCORE CVSS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ANALYSE ET CORRECTIFS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                    header.col(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ACTIONS")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(theme::TRACKING_NORMAL),
                        );
                    });
                })
                .body(|body| {
                    body.rows(theme::TABLE_ROW_HEIGHT + 16.0, filtered.len(), |mut row| {
                        let real_idx = filtered[row.index()];
                        let finding = &state.vulnerability_findings[real_idx];

                        row.col(|ui: &mut egui::Ui| {
                            let cve_label = &finding.cve_id;
                            let response = ui.label(
                                egui::RichText::new(cve_label)
                                    .font(theme::font_mono())
                                    .color(theme::accent_text())
                                    .strong(),
                            ).interact(egui::Sense::click());
                            if response.clicked() {
                                clicked_idx = Some(real_idx);
                            }
                            if response.hovered() {
                                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                            }
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&finding.affected_software)
                                        .font(theme::font_body())
                                        .color(theme::text_primary())
                                        .strong(),
                                );
                                ui.label(
                                    egui::RichText::new(&finding.affected_version)
                                        .font(theme::font_label())
                                        .color(theme::text_tertiary())
                                        .strong(),
                                );
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            let (label, color) = Self::severity_display(&finding.severity);
                            widgets::status_badge(ui, label, color);
                        });

                        row.col(|ui: &mut egui::Ui| {
                            if let Some(s) = finding.cvss_score {
                                ui.label(
                                    egui::RichText::new(format!("{:.1}", s))
                                        .font(theme::font_body())
                                        .color(theme::readable_color(theme::score_color(100.0 - s * 10.0)))
                                        .strong(),
                                );
                            } else {
                                ui.label(egui::RichText::new("--").color(theme::text_tertiary()));
                            }
                        });

                        row.col(|ui: &mut egui::Ui| {
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(
                                    egui::RichText::new(&finding.description)
                                        .font(theme::font_small())
                                        .color(theme::text_secondary()),
                                );
                                if finding.fix_available {
                                    ui.add_space(theme::SPACE_MICRO);
                                    widgets::status_badge(ui, "CORRECTIF DISPONIBLE", theme::SUCCESS);
                                }
                                if let Some(dt) = finding.discovered_at {
                                    ui.add_space(theme::SPACE_MICRO);
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "{} {}",
                                            icons::CLOCK,
                                            dt.format("%d/%m/%Y %H:%M")
                                        ))
                                        .font(theme::font_min())
                                        .color(theme::text_tertiary()),
                                    );
                                }
                            });
                        });

                        row.col(|ui: &mut egui::Ui| {
                            if widgets::ghost_button(ui, format!("{}  D\u{00c9}TAILS", icons::EYE)).clicked() {
                                clicked_idx = Some(real_idx);
                            }
                        });
                    });
                });

            if let Some(idx) = clicked_idx {
                state.vulnerability.selected_vuln = Some(idx);
                state.vulnerability.detail_open = true;
            }
        }
    }

    /// Draw a summary card (AAA Grade)
    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        let safe_color = theme::readable_color(color);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_width(width);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(value)
                                .font(theme::font_card_value())
                                .color(safe_color)
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .extra_letter_spacing(theme::TRACKING_NORMAL)
                                .strong(),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            ui.label(
                                egui::RichText::new(icon)
                                    .size(theme::ICON_XL)
                                    .color(safe_color.linear_multiply(theme::OPACITY_DISABLED)),
                            );
                        },
                    );
                });
            });
        });
    }

    fn severity_display(severity: &Severity) -> (&'static str, egui::Color32) {
        match severity {
            Severity::Critical => ("CRITIQUE", theme::ERROR),
            Severity::High => ("\u{00c9}LEV\u{00c9}E", theme::SEVERITY_HIGH),
            Severity::Medium => ("MOYENNE", theme::SEVERITY_MEDIUM),
            Severity::Low => ("FAIBLE", theme::INFO),
            Severity::Info => ("INFO", theme::text_tertiary()),
        }
    }

    fn export_csv(state: &AppState, indices: &[usize]) -> bool {
        let headers = &[
            "cve_id",
            "logiciel",
            "version",
            "severite",
            "cvss",
            "description",
            "fix_disponible",
        ];
        let rows: Vec<Vec<String>> = indices
            .iter()
            .map(|&i| {
                let f = &state.vulnerability_findings[i];
                vec![
                    f.cve_id.clone(),
                    f.affected_software.clone(),
                    f.affected_version.clone(),
                    f.severity.to_string(),
                    f.cvss_score.map_or("--".into(), |s| format!("{:.1}", s)),
                    f.description.clone(),
                    if f.fix_available { "Oui" } else { "Non" }.to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("vulnerabilites.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}

/// Generate a platform-appropriate package upgrade command.
fn platform_upgrade_command(safe_name: &str) -> String {
    if cfg!(target_os = "macos") {
        format!("# Vérifier le nom du paquet avant exécution :\nbrew upgrade '{}'", safe_name)
    } else if cfg!(target_os = "linux") {
        format!("# Vérifier le gestionnaire de paquets :\nsudo apt upgrade '{}' || sudo dnf upgrade '{}'", safe_name, safe_name)
    } else if cfg!(target_os = "windows") {
        format!("# Vérifier l'ID Winget :\nwinget upgrade '{}'", safe_name)
    } else {
        format!("# Mettez a jour '{}' manuellement", safe_name)
    }
}
