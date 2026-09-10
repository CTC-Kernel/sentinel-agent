// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Decision-oriented security workspace. All values come from runtime state.
use crate::app::{AppState, Page};
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::{icons, theme, widgets};
use egui::{Color32, RichText, Ui};

pub enum DashboardAction {
    Command(GuiCommand),
    NavigateTo(Page),
}

pub struct DashboardPage;

impl DashboardPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<DashboardAction> {
        let mut action = None;
        ui.horizontal_wrapped(|ui| {
            eyebrow(ui, "ESPACE DE SÉCURITÉ");
            ui.label(RichText::new(" / ").color(theme::text_tertiary()));
            ui.label(
                RichText::new(
                    state
                        .summary
                        .organization
                        .as_deref()
                        .unwrap_or("Poste local"),
                )
                .font(theme::font_small())
                .color(theme::text_secondary()),
            );
            if !state.summary.hostname.is_empty() {
                ui.label(
                    RichText::new(format!("·  {}", state.summary.hostname))
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            }
        });
        ui.add_space(10.0);
        ui.label(
            RichText::new("Votre centre de contrôle.")
                .size(34.0)
                .strong()
                .color(theme::text_primary()),
        );
        ui.add_space(4.0);
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new("Comprendre l’exposition. Prioriser. Agir.")
                    .size(15.0)
                    .color(theme::text_secondary()),
            );
            if let Some(last) = state.summary.last_check_at {
                ui.label(
                    RichText::new(format!(
                        "Dernière analyse · {}",
                        last.with_timezone(&chrono::Local).format("%d %b, %H:%M")
                    ))
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
                );
            }
        });
        ui.add_space(theme::SPACE_LG);
        Self::posture(ui, state, &mut action);
        ui.add_space(theme::SPACE);

        let vulnerabilities = state.vulnerability_summary.as_ref();
        let metrics = [
            (
                "Conformité",
                state
                    .summary
                    .compliance_score
                    .map(|v| format!("{v:.0}%"))
                    .unwrap_or("—".into()),
                format!(
                    "{} contrôles évalués",
                    state.policy.passing + state.policy.failing + state.policy.errors
                ),
                theme::accent_text(),
                Page::Compliance,
            ),
            (
                "Vulnérabilités prioritaires",
                vulnerabilities
                    .map(|v| (v.critical + v.high).to_string())
                    .unwrap_or("—".into()),
                "Critiques et élevées".into(),
                theme::readable_color(theme::ERROR),
                Page::Vulnerabilities,
            ),
            (
                "Signaux à investiguer",
                (state.threats.suspicious_processes.len() + state.threats.usb_events.len())
                    .to_string(),
                "Processus et événements USB".into(),
                theme::readable_color(theme::WARNING),
                Page::Threats,
            ),
            (
                "Alertes réseau",
                state.network.alert_count.to_string(),
                format!("{} connexions actives", state.network.connection_count),
                theme::accent_text(),
                Page::Network,
            ),
        ];
        widgets::ResponsiveGrid::new(210.0, 12.0).show(
            ui,
            &metrics,
            |ui, width, (label, value, caption, color, page)| {
                ui.push_id(label, |ui| {
                    ui.vertical(|ui| {
                        ui.set_width(width);
                        if widgets::clickable_card(ui, label, |ui| {
                            ui.set_min_width(ui.available_width());
                            ui.set_min_height(76.0);
                            ui.label(
                                RichText::new(*label)
                                    .font(theme::font_small())
                                    .color(theme::text_secondary()),
                            );
                            ui.add_space(8.0);
                            ui.label(RichText::new(value).size(30.0).strong().color(*color));
                            ui.label(
                                RichText::new(caption)
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary()),
                            );
                        })
                        .clicked()
                        {
                            action = Some(DashboardAction::NavigateTo(page.clone()));
                        }
                    });
                });
            },
        );
        ui.add_space(theme::SPACE_LG);
        let wide = ui.available_width() >= 850.0;
        if wide {
            ui.columns(2, |cols| {
                Self::priorities(&mut cols[0], state, &mut action);
                Self::operations(&mut cols[1], state, &mut action);
            });
        } else {
            Self::priorities(ui, state, &mut action);
            ui.add_space(theme::SPACE);
            Self::operations(ui, state, &mut action);
        }
        ui.add_space(theme::SPACE);
        Self::assistant(ui, state, &mut action);
        ui.add_space(theme::SPACE);
        egui::CollapsingHeader::new("Tendances et activité récente")
            .id_salt("dashboard_history")
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    for period in [
                        crate::dto::KpiPeriod::ThirtyDays,
                        crate::dto::KpiPeriod::NinetyDays,
                    ] {
                        if ui
                            .selectable_label(state.kpi.period == period, period.label_fr())
                            .clicked()
                        {
                            state.kpi.period = period;
                        }
                    }
                });
                let cutoff =
                    chrono::Utc::now() - chrono::Duration::days(state.kpi.period.days() as i64);
                let samples: Vec<_> = state
                    .kpi
                    .snapshots
                    .iter()
                    .filter(|s| s.timestamp >= cutoff)
                    .collect();
                if samples.len() < 2 {
                    ui.label("L’historique apparaîtra après plusieurs collectes.");
                } else {
                    let points: Vec<_> = samples
                        .iter()
                        .map(|s| [s.timestamp.timestamp() as f64, s.compliance_score as f64])
                        .collect();
                    widgets::sparkline(
                        ui,
                        "compliance_history",
                        &points,
                        egui::vec2(ui.available_width(), 100.0),
                        &widgets::SparklineConfig::default(),
                    );
                    if let Some(last) = samples.last() {
                        ui.label(format!(
                            "{} incidents · {} vulnérabilités ouvertes · {} résolues · SLA {:.0}%",
                            last.incident_count,
                            last.open_vulns,
                            last.closed_vulns,
                            last.remediation_sla_pct
                        ));
                    }
                }
                widgets::activity_feed(ui, state, 5);
            });
        ui.add_space(theme::SPACE);
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new("EXPLORER")
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
            for (label, page) in [
                ("Inventaire logiciel", Page::Software),
                ("Intégrité des fichiers", Page::FileIntegrity),
                ("Rapports", Page::Reports),
            ] {
                if widgets::ghost_button(ui, label).clicked() {
                    action = Some(DashboardAction::NavigateTo(page));
                }
            }
            if widgets::ghost_button(ui, "Exporter la synthèse").clicked() {
                let toast = if Self::export_dashboard_csv(state) {
                    widgets::toast::Toast::success("Synthèse exportée")
                } else {
                    widgets::toast::Toast::error("L’export a échoué")
                };
                state.toasts.push(toast);
            }
        });
        action
    }

    fn posture(ui: &mut Ui, state: &AppState, action: &mut Option<DashboardAction>) {
        let urgent = state
            .vulnerability_summary
            .as_ref()
            .map_or(0, |v| v.critical + v.high);
        let signals = state.threats.suspicious_processes.len() + state.threats.usb_events.len();
        let assessed = state.summary.compliance_score.is_some();
        let needs_attention = urgent > 0
            || signals > 0
            || state.policy.failing > 0
            || state
                .summary
                .compliance_score
                .is_some_and(|score| score < 85.0);
        let title = if urgent > 0 {
            format!("{urgent} vulnérabilités prioritaires à examiner.")
        } else if needs_attention {
            "Votre posture nécessite un examen.".into()
        } else if assessed {
            "Votre état de sécurité est disponible.".into()
        } else {
            "Commencez par une première analyse.".into()
        };
        let subtitle = if needs_attention {
            "Des points d’attention méritent votre examen. Retrouvez les prochaines actions ci-dessous."
        } else if assessed {
            "Consultez les contrôles et les signaux collectés pour suivre l’évolution de votre poste."
        } else {
            "Établissez votre état de référence pour révéler les vulnérabilités et les écarts de conformité."
        };
        egui::Frame::new()
            .fill(if theme::is_dark_mode() {
                Color32::from_rgb(21, 37, 57)
            } else {
                Color32::from_rgb(231, 239, 253)
            })
            .stroke(egui::Stroke::new(
                1.0_f32,
                if theme::is_dark_mode() {
                    Color32::from_rgb(48, 75, 106)
                } else {
                    Color32::from_rgb(199, 214, 238)
                },
            ))
            .corner_radius(16)
            .inner_margin(22)
            .show(ui, |ui| {
                ui.set_min_width(ui.available_width());
                ui.horizontal_wrapped(|ui| {
                    widgets::status_badge(
                        ui,
                        if needs_attention {
                            "À examiner"
                        } else if assessed {
                            "Analyse disponible"
                        } else {
                            "Évaluation en attente"
                        },
                        if needs_attention {
                            theme::WARNING
                        } else {
                            theme::INFO
                        },
                    );
                    ui.label(
                        RichText::new(&title)
                            .size(22.0)
                            .strong()
                            .color(theme::text_primary()),
                    );
                });
                ui.add_space(6.0);
                ui.label(
                    RichText::new(subtitle)
                        .font(theme::font_body())
                        .color(theme::text_secondary()),
                );
                ui.add_space(12.0);
                ui.horizontal_wrapped(|ui| {
                    let scanning = state.summary.status == GuiAgentStatus::Scanning;
                    if widgets::primary_button_loading(
                        ui,
                        if scanning {
                            "Analyse en cours…"
                        } else {
                            "Analyser ce poste"
                        },
                        !scanning,
                        scanning,
                    )
                    .clicked()
                    {
                        *action = Some(DashboardAction::Command(GuiCommand::RunCheck));
                    }
                    if widgets::ghost_button(ui, "Consulter les contrôles  →").clicked() {
                        *action = Some(DashboardAction::NavigateTo(Page::Compliance));
                    }
                });
            });
    }

    fn priorities(ui: &mut Ui, state: &AppState, action: &mut Option<DashboardAction>) {
        widgets::card(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(220.0);
            section(ui, "01", "Prochaines actions");
            ui.add_space(14.0);
            let mut count = 0;
            if let Some(v) = &state.vulnerability_summary {
                if v.critical + v.high > 0 {
                    action_row(
                        ui,
                        "01",
                        &format!(
                            "Examiner {} vulnérabilités prioritaires",
                            v.critical + v.high
                        ),
                        "Identifier les correctifs disponibles",
                        theme::ERROR,
                        Page::Vulnerabilities,
                        action,
                    );
                    count += 1;
                }
            }
            if state.policy.failing > 0 {
                action_row(
                    ui,
                    "02",
                    &format!("Résoudre {} écarts de conformité", state.policy.failing),
                    "Comprendre les contrôles en échec",
                    theme::WARNING,
                    Page::Compliance,
                    action,
                );
                count += 1;
            }
            if !state.threats.suspicious_processes.is_empty()
                || !state.threats.usb_events.is_empty()
            {
                action_row(
                    ui,
                    "03",
                    "Investiguer les signaux de sécurité",
                    "Examiner les événements et leur contexte",
                    theme::WARNING,
                    Page::Threats,
                    action,
                );
                count += 1;
            }
            if count == 0 {
                action_row(
                    ui,
                    "01",
                    if state.summary.compliance_score.is_none() {
                        "Établir votre état de référence"
                    } else {
                        "Revoir les résultats de l’analyse"
                    },
                    "Ouvrir les contrôles de conformité",
                    theme::INFO,
                    Page::Compliance,
                    action,
                );
                action_row(
                    ui,
                    "02",
                    "Consulter l’activité du poste",
                    "Accéder au journal des événements",
                    theme::INFO,
                    Page::AuditTrail,
                    action,
                );
            }
        });
    }

    fn operations(ui: &mut Ui, state: &AppState, action: &mut Option<DashboardAction>) {
        widgets::card(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.set_min_height(220.0);
            section(ui, "02", "Santé du poste");
            ui.add_space(14.0);
            let cpu: Vec<_> = state.monitoring.cpu_history.iter().copied().collect();
            let memory: Vec<_> = state.monitoring.memory_history.iter().copied().collect();
            ui.columns(2, |cols| {
                for (idx, name, data, value) in [
                    (0, "Processeur", &cpu, state.resources.cpu_percent),
                    (1, "Mémoire", &memory, state.resources.memory_percent),
                ] {
                    let ui = &mut cols[idx];
                    ui.label(
                        RichText::new(name)
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                    ui.label(
                        RichText::new(if data.is_empty() {
                            "—".into()
                        } else {
                            format!("{value:.1}%")
                        })
                        .size(24.0)
                        .color(theme::text_primary()),
                    );
                    widgets::sparkline(
                        ui,
                        name,
                        data,
                        egui::vec2(ui.available_width(), 54.0),
                        &widgets::SparklineConfig {
                            color: theme::accent_text(),
                            fill: true,
                            show_trend: false,
                            show_stats: false,
                        },
                    );
                }
            });
            ui.add_space(14.0);
            let last_sync = state
                .summary
                .last_sync_at
                .map(|t| t.with_timezone(&chrono::Local).format("%H:%M").to_string())
                .unwrap_or("En attente".into());
            ui.label(
                RichText::new(format!("Dernière synchronisation  ·  {last_sync}"))
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            ui.add_space(8.0);
            if widgets::ghost_button(ui, "Ouvrir la surveillance  →").clicked() {
                *action = Some(DashboardAction::NavigateTo(Page::Monitoring));
            }
        });
    }

    fn assistant(ui: &mut Ui, state: &AppState, action: &mut Option<DashboardAction>) {
        widgets::card(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(icons::BRAIN)
                        .size(20.0)
                        .color(theme::accent_text()),
                );
                ui.label(
                    RichText::new("Un second regard sur votre sécurité.")
                        .size(17.0)
                        .strong()
                        .color(theme::text_primary()),
                );
                widgets::status_badge(
                    ui,
                    if state.ai.model_status.is_ready {
                        "Assistant disponible"
                    } else {
                        "Assistant à configurer"
                    },
                    theme::INFO,
                );
            });
            ui.add_space(8.0);
            ui.label(RichText::new("Comprenez un résultat, explorez un risque ou préparez votre remédiation avec l’assistant.").font(theme::font_body()).color(theme::text_secondary()));
            ui.add_space(10.0);
            if widgets::ghost_button(ui, "Ouvrir l’assistant  →").clicked() {
                *action = Some(DashboardAction::NavigateTo(Page::AI));
            }
        });
    }
    fn export_dashboard_csv(state: &AppState) -> bool {
        let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let headers = &["metrique", "valeur", "unite", "horodatage"];
        let mut rows = vec![
            vec![
                "Conformit\u{00e9}".to_string(),
                state
                    .summary
                    .compliance_score
                    .map(|s| format!("{:.1}", s))
                    .unwrap_or_default(),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "CPU".to_string(),
                format!("{:.1}", state.resources.cpu_percent),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "M\u{00e9}moire".to_string(),
                format!("{:.1}", state.resources.memory_percent),
                "%".to_string(),
                timestamp.clone(),
            ],
            vec![
                "Politiques totales".to_string(),
                state.policy.total_policies.to_string(),
                "".to_string(),
                timestamp.clone(),
            ],
            vec![
                "Politiques conformes".to_string(),
                state.policy.passing.to_string(),
                "".to_string(),
                timestamp.clone(),
            ],
        ];

        if let Some(ref vuln) = state.vulnerability_summary {
            rows.push(vec![
                "Vuln\u{00e9}rabilit\u{00e9}s Critiques".to_string(),
                vuln.critical.to_string(),
                "".to_string(),
                timestamp.clone(),
            ]);
            rows.push(vec![
                "Vuln\u{00e9}rabilit\u{00e9}s \u{00c9}lev\u{00e9}es".to_string(),
                vuln.high.to_string(),
                "".to_string(),
                timestamp,
            ]);
        }

        let path = crate::export::default_export_path("dashboard_summary.csv");
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
        }
    }
}

fn eyebrow(ui: &mut Ui, text: &str) {
    ui.label(
        RichText::new(text)
            .size(11.0)
            .extra_letter_spacing(1.4)
            .strong()
            .color(theme::accent_text()),
    );
}
fn section(ui: &mut Ui, number: &str, title: &str) {
    ui.horizontal(|ui| {
        ui.label(
            RichText::new(number)
                .font(theme::font_mono())
                .color(theme::accent_text()),
        );
        ui.add_space(8.0);
        ui.label(
            RichText::new(title)
                .size(18.0)
                .strong()
                .color(theme::text_primary()),
        );
    });
}
fn action_row(
    ui: &mut Ui,
    number: &str,
    title: &str,
    caption: &str,
    color: Color32,
    page: Page,
    action: &mut Option<DashboardAction>,
) {
    let response = egui::Frame::new()
        .inner_margin(egui::Margin::symmetric(0, 10))
        .show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(number)
                        .font(theme::font_mono())
                        .color(theme::readable_color(color)),
                );
                ui.add_space(8.0);
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(title)
                            .font(theme::font_body())
                            .strong()
                            .color(theme::text_primary()),
                    );
                    ui.label(
                        RichText::new(caption)
                            .font(theme::font_small())
                            .color(theme::text_secondary()),
                    );
                });
            });
        })
        .response;
    let response = ui.interact(
        response.rect,
        ui.id().with(("priority", number)),
        egui::Sense::click(),
    );
    response.widget_info(|| {
        egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), title)
    });
    if response.hovered() || response.has_focus() {
        ui.painter().rect_stroke(
            response.rect,
            6,
            theme::focus_ring(),
            egui::StrokeKind::Inside,
        );
    }
    if response
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked()
    {
        *action = Some(DashboardAction::NavigateTo(page));
    }
    let (rect, _) =
        ui.allocate_exact_size(egui::vec2(ui.available_width(), 1.0), egui::Sense::hover());
    ui.painter().hline(
        rect.x_range(),
        rect.top(),
        egui::Stroke::new(1.0_f32, theme::surface_border()),
    );
}

#[cfg(test)]
mod layout_tests {
    use super::*;

    #[test]
    fn overview_fits_compact_and_wide_content_areas() {
        for width in [650.0, 900.0, 1200.0] {
            let ctx = egui::Context::default();
            let mut state = AppState::default();
            for _ in 0..2 {
                let input = egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(width, 1600.0),
                    )),
                    ..Default::default()
                };
                let _ = ctx.run(input, |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        let right = ui.max_rect().right();
                        DashboardPage::show(ui, &mut state);
                        assert!(
                            ui.min_rect().right() <= right + 1.0,
                            "content overflow at width {width}: {} > {right}",
                            ui.min_rect().right()
                        );
                    });
                });
            }
        }
    }
}
