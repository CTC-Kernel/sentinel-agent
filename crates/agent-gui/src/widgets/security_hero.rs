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

    /// Short state name for the pill above the verdict.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Pending => "En attente",
            Self::Secure => "Prot\u{00e9}g\u{00e9}",
            Self::Attention => "Vigilance",
            Self::Critical => "Critique",
        }
    }

    pub fn title(&self) -> &'static str {
        match self {
            Self::Pending => "Évaluation en attente",
            Self::Secure => "Poste de travail protégé",
            Self::Attention => "Vigilance recommandée",
            Self::Critical => "Risque élevé à examiner",
        }
    }
}

/// Below this card width the gauge stacks above the verdict.
const HERO_STACK_WIDTH: f32 = 460.0;
/// Radius of the compliance dial.
const HERO_GAUGE_RADIUS: f32 = 64.0;

/// The dashboard's posture card: the compliance dial beside the verdict,
/// its reason, and what to deal with first.
///
/// A large state icon used to fill the card for one sentence of content;
/// the dial carries the score and the priority rows carry the numbers.
pub fn security_hero(ui: &mut Ui, state: &AppState) {
    let security_state = determine_security_state(state);

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.set_min_width(ui.available_width());
        ui.set_min_height(220.0);
        let stacked = ui.available_width() < HERO_STACK_WIDTH;
        let score = state
            .summary
            .compliance_score
            .filter(|score| score.is_finite());

        let body = |ui: &mut Ui| verdict_column(ui, state, security_state);
        if stacked {
            ui.vertical_centered(|ui| {
                widgets::compliance_gauge(ui, score, HERO_GAUGE_RADIUS);
            });
            ui.add_space(theme::SPACE_MD);
            body(ui);
        } else {
            // Both columns get explicit widths: a centred or wrapping label
            // otherwise claims the whole row and squeezes its neighbour.
            let gauge_w = HERO_GAUGE_RADIUS * 2.0 + theme::SPACE_LG;
            // The row's two item gaps count too: without them the card was
            // a dozen pixels wider than its grid cell.
            let body_w = (ui.available_width()
                - gauge_w
                - theme::SPACE_LG
                - ui.spacing().item_spacing.x * 2.0)
                .max(1.0);
            ui.horizontal_top(|ui| {
                ui.vertical(|ui| {
                    ui.set_width(gauge_w);
                    ui.add_space(theme::SPACE_SM);
                    widgets::compliance_gauge(ui, score, HERO_GAUGE_RADIUS);
                    score_delta(ui, state);
                });
                ui.add_space(theme::SPACE_LG);
                ui.vertical(|ui| {
                    ui.set_width(body_w);
                    body(ui);
                });
            });
        }
    });
}

/// Movement of the compliance score since the previous scan.
fn score_delta(ui: &mut Ui, state: &AppState) {
    let (Some(score), Some(prev)) = (
        state.summary.compliance_score,
        state.previous_compliance_score,
    ) else {
        return;
    };
    let diff: f32 = score - prev;
    if !diff.is_finite() || diff.abs() <= 0.5 {
        return;
    }
    let (arrow, color) = if diff > 0.0 {
        ("\u{25b2}", theme::SUCCESS)
    } else {
        ("\u{25bc}", theme::ERROR)
    };
    ui.vertical_centered(|ui| {
        ui.add(
            egui::Label::new(
                RichText::new(format!(
                    "{arrow} {} pt depuis la derni\u{00e8}re analyse",
                    crate::format::decimal(diff.abs(), 1)
                ))
                .font(theme::font_caption())
                .color(theme::readable_color(color)),
            )
            .wrap_mode(egui::TextWrapMode::Wrap),
        );
    });
}

/// State pill, verdict, reason, then the priority rows.
fn verdict_column(ui: &mut Ui, state: &AppState, security_state: SecurityState) {
    let color = security_state.color();
    ui.add_space(theme::SPACE_XS);
    ui.horizontal(|ui| {
        ui.label(
            RichText::new(security_state.icon())
                .size(theme::ICON_SM)
                .color(theme::readable_color(color)),
        );
        widgets::status_badge(ui, security_state.label(), color);
    });
    ui.add_space(theme::SPACE_SM);
    ui.label(
        RichText::new(security_state.title())
            .font(theme::font_h2())
            .color(theme::text_primary()),
    );
    ui.add_space(theme::SPACE_XS);
    ui.add(
        egui::Label::new(
            RichText::new(get_security_summary(state, security_state))
                .font(theme::font_body())
                .color(theme::text_secondary()),
        )
        .wrap_mode(egui::TextWrapMode::Wrap),
    );

    ui.add_space(theme::SPACE_MD);
    ui.label(
        RichText::new("\u{00c0} TRAITER EN PRIORIT\u{00c9}")
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
    ui.add_space(theme::SPACE_XS);

    let rows = priority_rows(state);
    if rows.is_empty() {
        priority_row(
            ui,
            icons::SHIELD_CHECK,
            "Rien d'urgent dans les r\u{00e9}sultats disponibles",
            None,
            theme::SUCCESS,
        );
    } else {
        for (icon, label, count, color) in rows {
            priority_row(ui, icon, &label, Some(count), color);
        }
    }
}

/// What needs attention, most severe first, zero counts left out.
fn priority_rows(state: &AppState) -> Vec<(&'static str, String, usize, Color32)> {
    let (pending, critical) = state.security_attention_counts();
    let mut rows = Vec::new();
    if critical > 0 {
        rows.push((
            icons::SKULL,
            "\u{00c9}v\u{00e9}nements critiques \u{00e0} traiter".to_owned(),
            critical,
            theme::ERROR,
        ));
    }
    if let Some(vuln) = &state.vulnerability_summary {
        if vuln.critical > 0 {
            rows.push((
                icons::SHIELD_VIRUS,
                "Vuln\u{00e9}rabilit\u{00e9}s critiques".to_owned(),
                vuln.critical as usize,
                theme::ERROR,
            ));
        }
        if vuln.high > 0 {
            rows.push((
                icons::SHIELD_VIRUS,
                "Vuln\u{00e9}rabilit\u{00e9}s \u{00e9}lev\u{00e9}es".to_owned(),
                vuln.high as usize,
                theme::SEVERITY_HIGH,
            ));
        }
    }
    let failing = state.policy.failing as usize + state.policy.errors as usize;
    if failing > 0 {
        rows.push((
            icons::CLIPBOARD_CHECK,
            "Contr\u{00f4}les non conformes".to_owned(),
            failing,
            theme::SEVERITY_MEDIUM,
        ));
    }
    let other = pending.saturating_sub(critical);
    if other > 0 {
        rows.push((
            icons::BELL,
            "Autres \u{00e9}v\u{00e9}nements \u{00e0} trier".to_owned(),
            other,
            theme::INFO,
        ));
    }
    rows.truncate(3);
    rows
}

fn priority_row(ui: &mut Ui, icon: &str, label: &str, count: Option<usize>, color: Color32) {
    let ink = theme::readable_color(color);
    let height = theme::MIN_TOUCH_TARGET;
    let (rect, _) = ui.allocate_exact_size(
        Vec2::new(ui.available_width(), height),
        egui::Sense::hover(),
    );
    if !ui.is_rect_visible(rect) {
        return;
    }
    let painter = ui.painter();
    painter.rect_filled(
        rect.shrink2(Vec2::new(0.0, 2.0)),
        theme::ROUNDING_SM,
        theme::color_blend_pub(theme::bg_secondary(), color, 0.07),
    );
    painter.rect_filled(
        egui::Rect::from_min_size(
            rect.left_top() + Vec2::new(0.0, 6.0),
            Vec2::new(3.0, height - 12.0),
        ),
        2.0,
        ink,
    );
    painter.text(
        rect.left_center() + Vec2::new(theme::SPACE_MD + 4.0, 0.0),
        egui::Align2::LEFT_CENTER,
        icon,
        theme::font_icon(theme::ICON_XS),
        ink,
    );
    painter.text(
        rect.left_center()
            + Vec2::new(
                theme::SPACE_MD + 4.0 + theme::ICON_XS + theme::SPACE_SM,
                0.0,
            ),
        egui::Align2::LEFT_CENTER,
        label,
        theme::font_body(),
        theme::text_primary(),
    );
    if let Some(count) = count {
        painter.text(
            rect.right_center() - Vec2::new(theme::SPACE_MD, 0.0),
            egui::Align2::RIGHT_CENTER,
            crate::format::int(count as u64),
            theme::font_body_strong(),
            ink,
        );
    }
}

pub(crate) fn determine_security_state(state: &AppState) -> SecurityState {
    // 1. Check for active threats (Critical)
    let (pending, critical) = state.security_attention_counts();
    if critical > 0 {
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
    if pending > 0 {
        return SecurityState::Attention;
    }
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
            let (_, critical) = state.security_attention_counts();
            if critical > 0 {
                return format!("{} événement(s) de sévérité critique à examiner.", critical);
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
    #[test]
    fn ordinary_usb_activity_and_volume_alone_do_not_claim_critical_threats() {
        let mut state = AppState::default();
        state.summary.compliance_score = Some(100.0);
        for n in 0..20 {
            state.threats.usb_events.push_back(crate::dto::GuiUsbEvent {
                device_name: "Keyboard".into(),
                vendor_id: 1,
                product_id: 2,
                event_type: crate::dto::UsbEventType::Connected,
                timestamp: chrono::Utc::now(),
                acknowledged: false,
                allowlisted: false,
            });
            state.fim.alerts.push_back(crate::dto::GuiFimAlert {
                id: n.to_string(),
                path: "/tmp/log".into(),
                change_type: crate::dto::FimChangeType::Modified,
                old_hash: None,
                new_hash: None,
                timestamp: chrono::Utc::now(),
                acknowledged: false,
                allowlisted: false,
            });
        }
        assert_eq!(state.security_attention_counts(), (20, 0));
        assert_eq!(determine_security_state(&state), SecurityState::Attention);
        state.fim.alerts.clear();
        assert_eq!(state.security_attention_counts(), (0, 0));
        assert_eq!(determine_security_state(&state), SecurityState::Secure);
    }
}
