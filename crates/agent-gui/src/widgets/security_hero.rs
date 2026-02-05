//! Security hero widget - premium clean design.

use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::{Color32, RichText, Ui, Vec2};

/// Security state categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityState {
    Secure,
    Attention,
    Critical,
}

impl SecurityState {
    pub fn color(&self) -> Color32 {
        match self {
            Self::Secure => theme::SUCCESS,
            Self::Attention => theme::WARNING,
            Self::Critical => theme::ERROR,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            Self::Secure => icons::SHIELD_CHECK,
            Self::Attention => icons::WARNING,
            Self::Critical => icons::SKULL,
        }
    }

    pub fn title(&self) -> &'static str {
        match self {
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
        ui.vertical_centered(|ui: &mut egui::Ui| {
            ui.add_space(theme::SPACE_MD);

            let icon_size = 44.0;
            let container_size = icon_size * 2.0;
            let (rect, _resp) =
                ui.allocate_exact_size(Vec2::splat(container_size), egui::Sense::hover());
            let center = rect.center();
            let painter = ui.painter_at(rect);

            // Clean background circle (no fake glow)
            painter.circle_filled(center, icon_size * 0.9, base_color.linear_multiply(0.1));

            // Subtle border ring
            painter.circle_stroke(
                center,
                icon_size * 0.9,
                egui::Stroke::new(1.5, base_color.linear_multiply(0.25)),
            );

            // Icon with subtle shadow
            painter.text(
                center + Vec2::new(1.0, 1.5),
                egui::Align2::CENTER_CENTER,
                security_state.icon(),
                egui::FontId::proportional(icon_size),
                Color32::BLACK.linear_multiply(0.15),
            );
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                security_state.icon(),
                egui::FontId::proportional(icon_size),
                base_color,
            );

            ui.add_space(theme::SPACE_MD);

            // Title
            ui.label(
                RichText::new(security_state.title().to_uppercase())
                    .font(egui::FontId::proportional(12.0))
                    .extra_letter_spacing(0.6)
                    .color(theme::text_primary())
                    .strong(),
            );

            // Score display
            if let Some(score) = state.summary.compliance_score {
                ui.add_space(theme::SPACE_XS);

                let score_color = theme::score_color(score);
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        RichText::new(format!("{}%", score as i32))
                            .font(egui::FontId::proportional(18.0))
                            .color(score_color)
                            .strong(),
                    );

                    // Trend indicator
                    if let Some(prev) = state.previous_compliance_score {
                        let diff = score - prev;
                        if diff.abs() > 0.5 {
                            let (arrow, arrow_color) = if diff > 0.0 {
                                ("▲", theme::SUCCESS)
                            } else {
                                ("▼", theme::ERROR)
                            };
                            ui.label(
                                RichText::new(format!("{}{:.1}", arrow, diff.abs()))
                                    .font(egui::FontId::proportional(10.0))
                                    .color(arrow_color),
                            );
                        }
                    }
                });
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

fn determine_security_state(state: &AppState) -> SecurityState {
    // 1. Check for active threats (Critical)
    if !state.suspicious_processes.is_empty() || !state.usb_events.is_empty() {
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

    SecurityState::Secure
}

fn get_security_summary(state: &AppState, status: SecurityState) -> String {
    match status {
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
            if !state.suspicious_processes.is_empty() {
                return format!(
                    "{} processus suspects détectés !",
                    state.suspicious_processes.len()
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
