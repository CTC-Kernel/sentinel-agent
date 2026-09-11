// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Security hero widget - premium clean design.

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::{Color32, RichText, Ui, Vec2};

/// Security state categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityState {
    Pending,
    Secure,
    Attention,
    Critical,
}

impl SecurityState {
    pub fn color(&self) -> Color32 {
        match self {
            Self::Pending => theme::INFO,
            Self::Secure => theme::SUCCESS,
            Self::Attention => theme::WARNING,
            Self::Critical => theme::ERROR,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            Self::Pending => icons::SHIELD,
            Self::Secure => icons::SHIELD_CHECK,
            Self::Attention => icons::WARNING,
            Self::Critical => icons::SKULL,
        }
    }

    pub fn title(&self) -> &'static str {
        match self {
            Self::Pending => "Évaluation en attente",
            Self::Secure => "Poste de travail protégé",
            Self::Attention => "Vigilance recommandée",
            Self::Critical => "Alerte de sécurité critique",
        }
    }
}

/// Renders the premium security hero component - clean Apple-style.
pub fn security_hero(ui: &mut Ui, state: &AppState) {
    let security_state = determine_security_state(state);
    let base_color = security_state.color();

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.set_min_width(ui.available_width());
        ui.set_min_height(220.0);
        ui.vertical_centered(|ui: &mut egui::Ui| {
            ui.add_space(theme::SPACE_MD);

            let icon_size = 44.0;
            let container_size = icon_size * 2.0;
            let (rect, _resp) =
                ui.allocate_exact_size(Vec2::splat(container_size), egui::Sense::hover());
            let center = rect.center();
            let painter = ui.painter_at(rect);

            // Outer glow ring (theme-aware soft halo)
            painter.circle_filled(
                center,
                icon_size * 1.05,
                base_color.linear_multiply(theme::OPACITY_TINT * 0.5),
            );

            // Main background circle with glass-like fill
            painter.circle_filled(
                center,
                icon_size * 0.9,
                base_color.linear_multiply(theme::OPACITY_SUBTLE),
            );

            // Top highlight arc for glass depth
            painter.circle_stroke(
                center,
                icon_size * 0.9,
                egui::Stroke::new(
                    theme::BORDER_MEDIUM,
                    base_color.linear_multiply(theme::OPACITY_MODERATE),
                ),
            );

            // Icon with subtle shadow (theme-aware)
            painter.text(
                center + Vec2::new(1.0, 1.5),
                egui::Align2::CENTER_CENTER,
                security_state.icon(),
                theme::font_icon(icon_size),
                theme::overlay_color().linear_multiply(theme::OPACITY_TINT),
            );
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                security_state.icon(),
                theme::font_icon(icon_size),
                theme::readable_color(base_color),
            );

            ui.add_space(theme::SPACE_MD);

            // Title
            ui.label(
                RichText::new(security_state.title())
                    .font(theme::font_heading())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .color(theme::text_primary())
                    .strong(),
            );

            // Score display
            if let Some(score) = state
                .summary
                .compliance_score
                .filter(|score| score.is_finite())
            {
                ui.add_space(theme::SPACE_XS);

                let score_color = theme::readable_color(theme::score_color(score));
                // One layout job, so score and delta centre together under
                // the title instead of hugging the left edge.
                let mut job = egui::text::LayoutJob::default();
                job.append(
                    &format!("Conformité · {}", crate::format::pct(score, 0)),
                    0.0,
                    egui::TextFormat {
                        font_id: theme::font_heading(),
                        color: score_color,
                        ..Default::default()
                    },
                );
                if let Some(prev) = state.previous_compliance_score {
                    let diff: f32 = score - prev;
                    if diff.abs() > 0.5 {
                        let (arrow, arrow_color) = if diff > 0.0 {
                            ("\u{25b2}", theme::readable_color(theme::SUCCESS))
                        } else {
                            ("\u{25bc}", theme::readable_color(theme::ERROR))
                        };
                        job.append(
                            &format!("{arrow} {}", crate::format::decimal(diff.abs(), 1)),
                            theme::SPACE_SM,
                            egui::TextFormat {
                                font_id: theme::font_label(),
                                color: arrow_color,
                                valign: egui::Align::Center,
                                ..Default::default()
                            },
                        );
                    }
                }
                ui.label(job);
            }

            ui.add_space(theme::SPACE_XS);

            // Summary text
            ui.label(
                RichText::new(get_security_summary(state, security_state))
                    .font(theme::font_body())
                    .color(theme::text_tertiary()),
            );

            ui.add_space(theme::SPACE_SM);
        });
    });
}

pub(crate) fn determine_security_state(state: &AppState) -> SecurityState {
    // 1. Check for active threats (Critical)
    if !state.threats.suspicious_processes.is_empty() || !state.threats.usb_events.is_empty() {
        return SecurityState::Critical;
    }

    // 2. Check score thresholds
    let score = state
        .summary
        .compliance_score
        .filter(|score| score.is_finite());
    if score.is_some_and(|score| score < 60.0) {
        return SecurityState::Critical;
    }

    // 3. Check vulnerabilities
    if let Some(ref vuln) = state.vulnerability_summary
        && vuln.critical > 0
    {
        return SecurityState::Critical;
    }

    // 4. Check for warning conditions (Attention)
    if score.is_some_and(|score| score < 85.0) {
        return SecurityState::Attention;
    }

    if let Some(ref vuln) = state.vulnerability_summary
        && (vuln.high > 0 || vuln.medium > 10)
    {
        return SecurityState::Attention;
    }

    if state.policy.failing > 0 || state.policy.errors > 0 {
        return SecurityState::Attention;
    }
    if score.is_none() {
        SecurityState::Pending
    } else {
        SecurityState::Secure
    }
}

fn get_security_summary(state: &AppState, status: SecurityState) -> String {
    match status {
        SecurityState::Pending => {
            "Le niveau de protection sera disponible après la première évaluation.".to_string()
        }
        SecurityState::Secure => {
            "Aucun signal critique dans les résultats disponibles.".to_string()
        }
        SecurityState::Attention => {
            let mut reasons = Vec::new();
            if state.policy.failing > 0 {
                reasons.push("Contrôles non conformes");
            }
            if state.policy.errors > 0 {
                reasons.push("Contrôles en erreur");
            }
            if state.summary.compliance_score.unwrap_or(100.0) < 85.0 {
                reasons.push("Conformité imparfaite");
            }
            if let Some(ref vuln) = state.vulnerability_summary
                && vuln.high > 0
            {
                reasons.push("Vulnérabilités élevées");
            }
            if reasons.is_empty() {
                "Points d'attention détectés.".to_string()
            } else {
                format!("Attention : {}.", reasons.join(", "))
            }
        }
        SecurityState::Critical => {
            if !state.threats.suspicious_processes.is_empty() {
                return format!(
                    "{} processus suspects détectés !",
                    state.threats.suspicious_processes.len()
                );
            }
            if let Some(ref vuln) = state.vulnerability_summary
                && vuln.critical > 0
            {
                return format!("{} vulnérabilités CRITIQUES.", vuln.critical);
            }
            "Niveau de protection insuffisant.".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_or_invalid_score_never_claims_protection() {
        let mut state = AppState::default();
        for score in [None, Some(f32::NAN), Some(f32::INFINITY)] {
            state.summary.compliance_score = score;
            assert_eq!(determine_security_state(&state), SecurityState::Pending);
        }
    }

    #[test]
    fn known_vulnerabilities_override_missing_or_good_scores() {
        let mut state = AppState::default();
        for score in [None, Some(100.0)] {
            state.summary.compliance_score = score;
            for (critical, high, expected) in [
                (1, 0, SecurityState::Critical),
                (0, 1, SecurityState::Attention),
            ] {
                state.vulnerability_summary = Some(crate::dto::GuiVulnerabilitySummary {
                    critical,
                    high,
                    medium: 0,
                    low: 0,
                    last_scan_at: None,
                });
                assert_eq!(determine_security_state(&state), expected);
            }
        }
    }

    #[test]
    fn failed_checks_remain_visible_with_a_high_score() {
        let mut state = AppState::default();
        state.summary.compliance_score = Some(95.0);
        state.policy.failing = 1;
        assert_eq!(determine_security_state(&state), SecurityState::Attention);
        state.policy.failing = 0;
        state.policy.errors = 1;
        assert_eq!(determine_security_state(&state), SecurityState::Attention);
    }

    #[test]
    fn score_boundaries_preserve_alert_levels() {
        let mut state = AppState::default();
        for (score, expected) in [
            (59.9, SecurityState::Critical),
            (60.0, SecurityState::Attention),
            (84.9, SecurityState::Attention),
            (85.0, SecurityState::Secure),
        ] {
            state.summary.compliance_score = Some(score);
            assert_eq!(determine_security_state(&state), expected);
        }
    }
}
