// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection and response overview, based on untriaged events, not compliance.

use crate::app::AppState;
use crate::dto::{EdrTab, GuiAgentStatus, ResponseStatus};
use crate::{icons, theme, widgets};
use egui::{Color32, RichText, Ui};

fn verdict(state: &AppState) -> (&'static str, Color32) {
    let (pending, critical) = state.security_attention_counts();
    if critical > 0 {
        ("Événements critiques à traiter", theme::ERROR)
    } else if pending > 0 {
        ("Événements à examiner", theme::WARNING)
    } else {
        match state.summary.status {
            GuiAgentStatus::Starting => ("Initialisation en cours", theme::INFO),
            GuiAgentStatus::Paused => ("Agent en pause", theme::WARNING),
            GuiAgentStatus::Error => ("Agent en erreur", theme::ERROR),
            GuiAgentStatus::Disconnected => ("Agent hors connexion", theme::WARNING),
            _ => ("Aucun événement à traiter", theme::SUCCESS),
        }
    }
}

/// A compact command surface: verdict, signal constellation, and response readiness.
pub fn detection_hero(ui: &mut Ui, state: &AppState) -> Option<EdrTab> {
    let mut target = None;
    let (pending, critical) = state.security_attention_counts();
    let (title, color) = verdict(state);
    let (processes, system, network, files) = state.open_threat_counts();
    let sources = [
        ("PROCESSUS", processes),
        ("SYSTÈME", system),
        ("RÉSEAU", network),
        ("FICHIERS", files),
    ];
    ui.push_id("detection_response_hero", |ui| {
        widgets::Card::new().padding(24.0).show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(icons::SHIELD_VIRUS)
                        .size(18.0)
                        .color(theme::readable_color(theme::ACCENT)),
                );
                eyebrow(ui, "DETECTION & RESPONSE");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.label(
                        RichText::new("SENTINEL / EDR")
                            .font(theme::font_mono_sm())
                            .color(theme::text_tertiary()),
                    );
                });
            });
            ui.add_space(20.0);
            let width = ui.available_width();
            if width >= 850.0 {
                let gap = 24.0;
                let left = (width - 300.0 - gap * 2.0) * 0.52;
                let right = width - left - 300.0 - gap * 2.0;
                ui.horizontal_top(|ui| {
                    ui.spacing_mut().item_spacing.x = gap;
                    ui.vertical(|ui| {
                        ui.set_width(left);
                        if verdict_panel(ui, pending, critical, title, color) {
                            target = Some(EdrTab::Events);
                        }
                    });
                    ui.vertical(|ui| {
                        ui.set_width(300.0);
                        if signal_orbit(ui, &sources, pending, color) {
                            target = Some(EdrTab::Events);
                        }
                    });
                    ui.vertical(|ui| {
                        ui.set_width(right);
                        if let Some(tab) = response_panel(ui, state) {
                            target = Some(tab);
                        }
                    });
                });
            } else {
                if verdict_panel(ui, pending, critical, title, color) {
                    target = Some(EdrTab::Events);
                }
                ui.add_space(16.0);
                ui.vertical_centered(|ui| {
                    if signal_orbit(ui, &sources, pending, color) {
                        target = Some(EdrTab::Events);
                    }
                });
                ui.add_space(16.0);
                if let Some(tab) = response_panel(ui, state) {
                    target = Some(tab);
                }
            }
            ui.add_space(12.0);
            widgets::divider_thin(ui);
            ui.add_space(8.0);
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(icons::SHIELD_CHECK).color(theme::text_tertiary()));
                ui.label(
                    RichText::new("Événements à traiter · Hors acquittements et autorisations")
                        .font(theme::font_caption())
                        .color(theme::text_tertiary()),
                );
            });
        });
    });
    target
}

fn eyebrow(ui: &mut Ui, text: &str) {
    ui.label(
        RichText::new(text)
            .font(theme::font_label())
            .extra_letter_spacing(1.6)
            .color(theme::text_secondary()),
    );
}

fn verdict_panel(
    ui: &mut Ui,
    pending: usize,
    critical: usize,
    title: &str,
    color: Color32,
) -> bool {
    ui.add_space(12.0);
    widgets::status_badge(ui, title, color);
    ui.add_space(18.0);
    let headline = if critical > 0 {
        "Priorité à\nl’intervention."
    } else if pending > 0 {
        "Les signaux\nsous votre contrôle."
    } else {
        "Une vision claire.\nUne réponse précise."
    };
    ui.label(
        RichText::new(headline)
            .font(egui::FontId::proportional(28.0))
            .strong()
            .color(theme::text_primary()),
    );
    ui.add_space(12.0);
    ui.label(
        RichText::new(if critical > 0 {
            format!("{critical} événements critiques nécessitent votre attention.")
        } else if pending > 0 {
            format!("{pending} événements en attente de qualification.")
        } else {
            "Aucun signal en attente dans les données disponibles.".to_owned()
        })
        .font(theme::font_body())
        .color(theme::text_secondary()),
    );
    ui.add_space(20.0);
    widgets::button::primary_button(
        ui,
        format!("Ouvrir les détections  {}", icons::ARROW_RIGHT),
        true,
    )
    .clicked()
}

fn response_panel(ui: &mut Ui, state: &AppState) -> Option<EdrTab> {
    let mut target = None;
    let queued = state
        .threats
        .pending_actions
        .iter()
        .filter(|a| {
            matches!(
                a.status,
                ResponseStatus::Pending | ResponseStatus::InProgress
            )
        })
        .count();
    let failed = state
        .threats
        .pending_actions
        .iter()
        .filter(|a| a.status == ResponseStatus::Failed)
        .count();
    let playbooks = state.threats.playbooks.iter().filter(|p| p.enabled).count();
    let quarantined = state
        .threats
        .quarantine_queue
        .iter()
        .filter(|f| !f.restored)
        .count();
    egui::Frame::new()
        .fill(theme::color_blend_pub(
            theme::bg_secondary(),
            theme::ACCENT,
            0.045,
        ))
        .stroke(egui::Stroke::new(1.0_f32, theme::border_subtle()))
        .corner_radius(16)
        .inner_margin(18)
        .show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            eyebrow(ui, "RÉPONSE & CONFINEMENT");
            ui.add_space(12.0);
            for (label, value, color, tab) in [
                (
                    "Actions en attente / en cours",
                    queued,
                    theme::INFO,
                    EdrTab::Response,
                ),
                (
                    "Fichiers en quarantaine",
                    quarantined,
                    theme::WARNING,
                    EdrTab::Response,
                ),
                (
                    "Playbooks actifs",
                    playbooks,
                    theme::ACCENT,
                    EdrTab::Playbooks,
                ),
            ] {
                let row = ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(format!("{value:02}"))
                            .font(egui::FontId::proportional(26.0))
                            .color(theme::readable_color(color)),
                    );
                    ui.add_space(8.0);
                    if ui
                        .add(
                            egui::Button::new(
                                RichText::new(label)
                                    .font(theme::font_caption())
                                    .color(theme::text_secondary()),
                            )
                            .frame(false),
                        )
                        .clicked()
                    {
                        target = Some(tab);
                    }
                });
                row.response.on_hover_text(label);
                ui.add_space(6.0);
            }
            if failed > 0 {
                widgets::status_badge(ui, &format!("{failed} réponses en échec"), theme::ERROR);
            }
            ui.add_space(4.0);
            if widgets::ghost_button(ui, format!("Piloter la réponse  {}", icons::ARROW_RIGHT))
                .clicked()
            {
                target = Some(EdrTab::Response);
            }
        });
    target
}

/// Four source arcs, scaled against the largest open-event count. Empty lanes stay neutral.
/// The geometry is static: it never implies an active scan or invented detections.
fn signal_orbit(ui: &mut Ui, sources: &[(&str, usize); 4], pending: usize, color: Color32) -> bool {
    use std::f32::consts::{FRAC_PI_2, PI, TAU};
    let size = ui.available_width().min(300.0);
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, 264.0), egui::Sense::click());
    let painter = ui.painter_at(rect);
    let center = rect.center();
    let radius = size.min(264.0) * 0.34;
    let ink = theme::readable_color(color);
    let accent = theme::readable_color(theme::ACCENT);
    for r in [radius * 0.72, radius + 14.0, radius + 24.0] {
        painter.circle_stroke(
            center,
            r,
            egui::Stroke::new(0.6_f32, theme::border_subtle()),
        );
    }
    for tick in 0..64 {
        let a = tick as f32 / 64.0 * TAU;
        let direction = egui::vec2(a.cos(), a.sin());
        painter.line_segment(
            [
                center + direction * (radius + 17.0),
                center + direction * (radius + 20.0),
            ],
            egui::Stroke::new(1.0_f32, accent.linear_multiply(0.35)),
        );
    }
    let max = sources.iter().map(|(_, n)| *n).max().unwrap_or(0).max(1);
    for (index, (label, count)) in sources.iter().enumerate() {
        let start = -PI + index as f32 * FRAC_PI_2 + 0.14;
        let sweep = FRAC_PI_2 - 0.28;
        let arc = |length: f32| {
            (0..=40)
                .map(|step| {
                    let angle = start + length * step as f32 / 40.0;
                    center + egui::vec2(angle.cos(), angle.sin()) * radius
                })
                .collect::<Vec<_>>()
        };
        painter.add(egui::Shape::line(
            arc(sweep),
            egui::Stroke::new(4.0_f32, theme::border_subtle()),
        ));
        if *count > 0 {
            painter.add(egui::Shape::line(
                arc(sweep * *count as f32 / max as f32),
                egui::Stroke::new(4.0_f32, ink),
            ));
        }
        let angle = start + sweep * 0.5;
        let position = center + egui::vec2(angle.cos(), angle.sin()) * (radius + 12.0);
        painter.circle_filled(position, 4.0, if *count > 0 { ink } else { accent });
        let right = index == 1 || index == 2;
        let above = index < 2;
        let label_position = center
            + egui::vec2(
                if right { size * 0.48 } else { -size * 0.48 },
                if above { -116.0 } else { 116.0 },
            );
        painter.text(
            label_position,
            if right {
                egui::Align2::RIGHT_CENTER
            } else {
                egui::Align2::LEFT_CENTER
            },
            format!("{label}  {count:02}"),
            theme::font_micro(),
            theme::text_secondary(),
        );
    }
    painter.circle_filled(
        center,
        radius * 0.62,
        theme::color_blend_pub(theme::bg_secondary(), color, 0.045),
    );
    painter.text(
        center - egui::vec2(0.0, 12.0),
        egui::Align2::CENTER_CENTER,
        crate::format::int(pending as u64),
        egui::FontId::proportional(48.0),
        theme::text_primary(),
    );
    painter.text(
        center + egui::vec2(0.0, 25.0),
        egui::Align2::CENTER_CENTER,
        "À QUALIFIER",
        theme::font_micro(),
        ink,
    );
    response.widget_info(|| {
        egui::WidgetInfo::labeled(
            egui::WidgetType::Button,
            true,
            format!("{pending} événements à qualifier. Ouvrir les détections"),
        )
    });
    if response.has_focus() {
        painter.rect_stroke(
            rect.shrink(2.0),
            12,
            theme::focus_ring(),
            egui::StrokeKind::Inside,
        );
    }
    response
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text(
            "Répartition par source · Chaque arc est relatif à la source la plus chargée",
        )
        .clicked()
}
