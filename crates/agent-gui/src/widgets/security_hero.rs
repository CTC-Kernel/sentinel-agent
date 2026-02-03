use egui::{Color32, RichText, Stroke, Ui, Vec2};
use crate::theme;
use crate::icons;
use crate::app::AppState;

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
            Self::Secure => "Poste de travail prot\u{00e9}g\u{00e9}",
            Self::Attention => "Vigilance recommand\u{00e9}e",
            Self::Critical => "Alerte de s\u{00e9}curit\u{00e9} critique",
        }
    }
}

/// Renders the premium security hero component.
pub fn security_hero(ui: &mut Ui, state: &AppState) {
    let security_state = determine_security_state(state);
    let base_color = security_state.color();
    
    widgets::card(ui, |ui| {
        ui.vertical_centered(|ui| {
            ui.add_space(theme::SPACE_MD);
            
            // Pulsing animation logic
            let time = ui.input(|i| i.time);
            let pulse = (time * 1.5).sin() * 0.5 + 0.5;
            
            let icon_size = 48.0;
            let (rect, _resp) = ui.allocate_exact_size(Vec2::splat(icon_size * 2.2), egui::Sense::hover());
            let center = rect.center();
            
            // 1. Background glow
            ui.painter().circle_filled(
                center,
                icon_size * (0.7 + 0.1 * pulse as f32),
                base_color.linear_multiply(0.1),
            );
            
            // 2. Pulsing ring
            ui.painter().circle_stroke(
                center,
                icon_size * (0.8 + 0.2 * pulse as f32),
                Stroke::new(1.5, base_color.linear_multiply(0.3 * (1.0 - pulse as f32))),
            );
            
            // 3. Main Icon
            ui.painter().text(
                center,
                egui::Align2::CENTER_CENTER,
                security_state.icon(),
                egui::FontId::proportional(icon_size),
                base_color,
            );
            
            ui.add_space(theme::SPACE_MD);
            
            // Textual status
            ui.label(
                RichText::new(security_state.title())
                    .font(theme::font_heading())
                    .color(theme::text_primary())
                    .strong(),
            );
            
            ui.add_space(theme::SPACE_XS);
            ui.label(
                RichText::new(get_security_summary(state, security_state))
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
            
            ui.add_space(theme::SPACE_MD);
        });
    });
    
    // Smooth infinite animation
    ui.ctx().request_repaint();
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
    if let Some(ref vuln) = state.vulnerability_summary {
        if vuln.critical > 0 {
            return SecurityState::Critical;
        }
    }
    
    // 4. Check for warning conditions (Attention)
    if score < 85.0 {
        return SecurityState::Attention;
    }
    
    if let Some(ref vuln) = state.vulnerability_summary {
        if vuln.high > 0 || vuln.medium > 10 {
            return SecurityState::Attention;
        }
    }
    
    SecurityState::Secure
}

fn get_security_summary(state: &AppState, status: SecurityState) -> String {
    match status {
        SecurityState::Secure => {
            "Aucune menace d\u{00e9}tect\u{00e9}e. Votre configuration est conforme aux standards.".to_string()
        },
        SecurityState::Attention => {
            let mut reasons = Vec::new();
            if state.summary.compliance_score.unwrap_or(100.0) < 85.0 {
                reasons.push("Conformit\u{00e9} imparfaite");
            }
            if let Some(ref vuln) = state.vulnerability_summary {
                if vuln.high > 0 {
                    reasons.push("Vuln\u{00e9}rabilit\u{00e9}s \u{00e9}lev\u{00e9}es");
                }
            }
            format!("Points d'attention d\u{00e9}tect\u{00e9}s : {}.", reasons.join(", "))
        },
        SecurityState::Critical => {
            if !state.suspicious_processes.is_empty() {
                return format!("{} processus suspects d\u{00e9}tect\u{0089}s !", state.suspicious_processes.len());
            }
            if let Some(ref vuln) = state.vulnerability_summary {
                if vuln.critical > 0 {
                    return format!("{} vuln\u{00e9}rabilit\u{00e9}s CRITIQUES d\u{00e9}tect\u{00e9}es.", vuln.critical);
                }
            }
            "Niveau de protection insuffisant. Action corrective requise.".to_string()
        }
    }
}

// Internal widgets reference
use crate::widgets;
