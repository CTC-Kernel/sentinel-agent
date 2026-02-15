//! Premium badge widgets — elevated variants with subtle depth.
//!
//! Uses the same `theme::badge_*()` system as all other badges,
//! but adds a subtle shadow for visual elevation.

use crate::theme;
use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, Vec2};

/// A premium badge with subtle shadow for visual elevation.
pub struct PremiumBadge {
    text: String,
    color: Color32,
    size: BadgeSize,
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

    pub fn ui(self, ui: &mut Ui) -> Response {
        let (font, h_pad, v_pad) = match self.size {
            BadgeSize::Small => (theme::font_label(), 8.0_f32, 3.0_f32),
            BadgeSize::Medium => (theme::font_small(), 10.0, 4.0),
            BadgeSize::Large => (theme::font_body(), 12.0, 5.0),
        };

        let text_color = theme::badge_text(self.color);
        let bg_color = theme::badge_bg(self.color);
        let border_color = theme::badge_border(self.color);

        let galley = ui
            .painter()
            .layout_no_wrap(self.text.clone(), font, text_color);

        let text_size = galley.size();
        let desired_size = Vec2::new(
            text_size.x + h_pad * 2.0,
            (text_size.y + v_pad * 2.0).max(18.0),
        );

        let (rect, response) = ui.allocate_exact_size(desired_size, Sense::hover());

        if ui.is_rect_visible(rect) {
            let rounding = CornerRadius::same((rect.height() / 2.0).min(255.0) as u8);

            // Subtle shadow for depth (premium elevation)
            let shadow_color = self.color.linear_multiply(theme::OPACITY_SUBTLE);
            ui.painter()
                .rect_filled(rect.expand(1.0), rounding, shadow_color);

            // Soft tinted background
            let fill = if response.hovered() {
                // Slightly more prominent on hover
                self.color.linear_multiply(if theme::is_dark_mode() {
                    0.22
                } else {
                    0.15
                })
            } else {
                bg_color
            };
            ui.painter().rect_filled(rect, rounding, fill);

            // Subtle border
            ui.painter().rect_stroke(
                rect,
                rounding,
                Stroke::new(theme::BORDER_HAIRLINE, border_color),
                egui::StrokeKind::Inside,
            );

            // Centered text
            let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
            ui.painter().galley(text_pos, galley, text_color);
        }

        response
    }
}

/// A status badge with contextual colors.
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
            StatusLevel::Neutral => theme::INFO,
        };

        PremiumBadge::new(self.status)
            .color(color)
            .size(BadgeSize::Small)
            .ui(ui)
    }
}

/// A compliance score badge with color-coded severity.
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
            .ui(ui)
    }
}
