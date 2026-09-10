// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Security hero widget - premium clean design.

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::{Color32, RichText, Ui};

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
            Self::Pending => icons::SHIELD_CHECK,
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

/// Security posture with an explicit unknown state and readable score hierarchy.
pub fn security_hero(ui: &mut Ui, state: &AppState) {
    let status = determine_security_state(state);
    let color = theme::readable_color(status.color());
    widgets::card(ui, |ui| {
        ui.set_min_width(ui.available_width());
        ui.set_min_height(220.0);
        ui.horizontal(|ui| {
            ui.label(RichText::new(status.icon()).size(18.0).color(color));
            ui.label(
                RichText::new("POSTURE DE SÉCURITÉ")
                    .font(theme::font_small())
                    .extra_letter_spacing(1.2)
                    .color(theme::text_secondary())
                    .strong(),
            );
        });
        ui.add_space(theme::SPACE);
        ui.label(
            RichText::new(status.title())
                .size(22.0)
                .color(theme::text_primary())
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);
        ui.horizontal(|ui| {
            let score = state
                .summary
                .compliance_score
                .map(|score| format!("{:.0}", score.clamp(0.0, 100.0)))
                .unwrap_or_else(|| "—".to_owned());
            ui.label(RichText::new(score).size(48.0).color(color).strong());
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("/ 100")
                        .font(theme::font_heading())
                        .color(theme::text_tertiary()),
                );
                ui.label(
                    RichText::new("Score de conformité")
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
            });
        });
        ui.add_space(theme::SPACE_SM);
        ui.label(
            RichText::new(get_security_summary(state, status))
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_MD);
        ui.label(
            RichText::new("Consulter les contrôles  →")
                .font(theme::font_body())
                .color(theme::accent_text()),
        );
    });
}

fn determine_security_state(state: &AppState) -> SecurityState {
    // 1. Check for active threats (Critical)
    if !state.threats.suspicious_processes.is_empty() || !state.threats.usb_events.is_empty() {
        return SecurityState::Critical;
    }

    // 2. Check score thresholds
    let score = state.summary.compliance_score.unwrap_or(100.0);
    if score < 60.0 {
        return SecurityState::Critical;
    }

    // 3. Check vulnerabilities
    if let Some(ref vuln) = state.vulnerability_summary
        && vuln.critical > 0
    {
        return SecurityState::Critical;
    }

    // 4. Check for warning conditions (Attention)
    if score < 85.0 {
        return SecurityState::Attention;
    }

    if let Some(ref vuln) = state.vulnerability_summary
        && (vuln.high > 0 || vuln.medium > 10)
    {
        return SecurityState::Attention;
    }

    if state.summary.compliance_score.is_none() {
        return SecurityState::Pending;
    }
    SecurityState::Secure
}

fn get_security_summary(state: &AppState, status: SecurityState) -> String {
    match status {
        SecurityState::Pending => {
            "Lancez une analyse pour évaluer la conformité de ce poste.".to_owned()
        }
        SecurityState::Secure => {
            "Aucune menace détectée. Configuration conforme aux standards.".to_string()
        }
        SecurityState::Attention => {
            let mut reasons = Vec::new();
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
    fn missing_assessment_is_never_presented_as_secure() {
        let state = AppState::default();
        assert_eq!(determine_security_state(&state), SecurityState::Pending);
    }
    #[test]
    fn assessed_scores_preserve_severity_thresholds() {
        let mut state = AppState::default();
        for (score, expected) in [
            (59.0, SecurityState::Critical),
            (60.0, SecurityState::Attention),
            (84.0, SecurityState::Attention),
            (85.0, SecurityState::Secure),
        ] {
            state.summary.compliance_score = Some(score);
            assert_eq!(determine_security_state(&state), expected);
        }
    }
}
