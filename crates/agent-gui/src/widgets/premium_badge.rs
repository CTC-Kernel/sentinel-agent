//! Premium badge widgets with animations and effects similar to the hero badge.

use egui::{Color32, CornerRadius, Response, RichText, Sense, Stroke, Ui, Vec2};
use crate::theme;

/// A premium animated badge with glow effects, similar to the hero badge.
pub struct PremiumBadge {
    text: String,
    color: Color32,
    size: BadgeSize,
    animated: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum BadgeSize {
    Small,
    Medium,
    Large,
}

impl PremiumBadge {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            color: theme::ACCENT,
            size: BadgeSize::Medium,
            animated: true,
        }
    }

    pub fn color(mut self, color: Color32) -> Self {
        self.color = color;
        self
    }

    pub fn size(mut self, size: BadgeSize) -> Self {
        self.size = size;
        self
    }

    pub fn animated(mut self, animated: bool) -> Self {
        self.animated = animated;
        self
    }

    pub fn ui(self, ui: &mut Ui) -> Response {
        let (text_size, padding, corner_radius) = match self.size {
            BadgeSize::Small => (10.0, Vec2::new(8.0, 4.0), 8.0),
            BadgeSize::Medium => (12.0, Vec2::new(12.0, 6.0), 10.0),
            BadgeSize::Large => (14.0, Vec2::new(16.0, 8.0), 12.0),
        };

        let _text = RichText::new(&self.text)
            .size(text_size)
            .color(theme::text_on_accent())
            .strong();

        let desired_size = ui.painter().layout_no_wrap(self.text.clone(), theme::font_body(), theme::text_on_accent()).size() + padding * 2.0;

        let (rect, response) = ui.allocate_exact_size(desired_size, Sense::hover());

        // Background with subtle gradient effect
        let bg_color = if response.hovered() {
            self.color.linear_multiply(1.1)
        } else {
            self.color
        };

        ui.painter().rect_filled(
            rect,
            CornerRadius::same(corner_radius as u8),
            bg_color,
        );

        // Animated glow effect
        if self.animated {
            let time = ui.input(|i| i.time);
            let pulse = (time * 2.0).sin() * 0.3 + 0.7;
            
            ui.painter().rect_stroke(
                rect.expand(1.0),
                CornerRadius::same((corner_radius + 1.0) as u8),
                Stroke::new(1.0, self.color.linear_multiply(0.3 * pulse as f32)),
                egui::StrokeKind::Inside,
            );
        }

        // Text
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            self.text,
            theme::font_body(),
            theme::text_on_accent(),
        );

        response
    }
}

/// A status badge with premium styling and contextual colors.
pub struct StatusBadge {
    status: String,
    level: StatusLevel,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StatusLevel {
    Success,
    Warning,
    Error,
    Info,
    Neutral,
}

impl StatusBadge {
    pub fn new(status: impl Into<String>, level: StatusLevel) -> Self {
        Self {
            status: status.into(),
            level,
        }
    }

    pub fn ui(self, ui: &mut Ui) -> Response {
        let color = match self.level {
            StatusLevel::Success => theme::SUCCESS,
            StatusLevel::Warning => theme::WARNING,
            StatusLevel::Error => theme::ERROR,
            StatusLevel::Info => theme::INFO,
            StatusLevel::Neutral => theme::ACCENT,
        };

        PremiumBadge::new(self.status)
            .color(color)
            .size(BadgeSize::Small)
            .animated(self.level != StatusLevel::Neutral)
            .ui(ui)
    }
}

/// A compliance score badge with premium styling and color coding.
pub struct ComplianceBadge {
    score: f32,
}

impl ComplianceBadge {
    pub fn new(score: f32) -> Self {
        Self { score }
    }

    pub fn ui(self, ui: &mut Ui) -> Response {
        let (color, text) = if self.score >= 85.0 {
            (theme::SUCCESS, format!("Excellent {:.0}%", self.score))
        } else if self.score >= 60.0 {
            (theme::WARNING, format!("Bon {:.0}%", self.score))
        } else {
            (theme::ERROR, format!("Critique {:.0}%", self.score))
        };

        PremiumBadge::new(text)
            .color(color)
            .size(BadgeSize::Medium)
            .animated(true)
            .ui(ui)
    }
}
