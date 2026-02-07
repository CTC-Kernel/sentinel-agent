//! Badge widget for displaying counts, statuses, and labels.

use crate::theme;
use egui::{Color32, CornerRadius, Ui};

/// Badge variant/style.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum BadgeVariant {
    #[default]
    Default,
    Success,
    Warning,
    Error,
    Info,
    Neutral,
}

impl BadgeVariant {
    fn colors(&self) -> (Color32, Color32) {
        match self {
            BadgeVariant::Default => (theme::ACCENT, Color32::WHITE),
            BadgeVariant::Success => (theme::SUCCESS, Color32::WHITE),
            BadgeVariant::Warning => (theme::WARNING, Color32::from_rgb(30, 30, 30)),
            BadgeVariant::Error => (theme::ERROR, Color32::WHITE),
            BadgeVariant::Info => (theme::INFO, Color32::WHITE),
            BadgeVariant::Neutral => (theme::bg_tertiary(), theme::text_secondary()),
        }
    }
}

/// Badge size.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum BadgeSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl BadgeSize {
    fn dimensions(&self) -> (f32, f32, egui::FontId) {
        match self {
            BadgeSize::Small => (4.0, 14.0, theme::font_label()),
            BadgeSize::Medium => (6.0, 18.0, theme::font_small()),
            BadgeSize::Large => (8.0, 22.0, theme::font_body()),
        }
    }
}

/// A badge widget for displaying counts or labels.
pub struct Badge<'a> {
    text: &'a str,
    variant: BadgeVariant,
    size: BadgeSize,
    pill: bool,
    outline: bool,
}

impl<'a> Badge<'a> {
    /// Create a new badge with the given text.
    pub fn new(text: &'a str) -> Self {
        Self {
            text,
            variant: BadgeVariant::Default,
            size: BadgeSize::Medium,
            pill: false,
            outline: false,
        }
    }

    /// Create a badge for a count.
    pub fn count(count: u32) -> Self {
        Self::new(if count > 99 { "99+" } else { "" }).count_value(count)
    }

    fn count_value(mut self, count: u32) -> Self {
        // This is a trick - we'll handle the actual text in show()
        self.text = if count > 99 { "99+" } else { "" };
        self
    }

    /// Set the badge variant/color.
    pub fn variant(mut self, variant: BadgeVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Set the badge size.
    pub fn size(mut self, size: BadgeSize) -> Self {
        self.size = size;
        self
    }

    /// Make the badge pill-shaped (fully rounded).
    pub fn pill(mut self) -> Self {
        self.pill = true;
        self
    }

    /// Make the badge outlined instead of filled.
    pub fn outline(mut self) -> Self {
        self.outline = true;
        self
    }

    /// Show the badge.
    pub fn show(self, ui: &mut Ui) -> egui::Response {
        let (padding, min_height, font) = self.size.dimensions();
        let (bg_color, text_color) = self.variant.colors();

        let galley = ui.painter().layout_no_wrap(
            self.text.to_string(),
            font.clone(),
            if self.outline { bg_color } else { text_color },
        );

        let text_width = galley.size().x;
        let badge_width = (text_width + padding * 2.0).max(min_height);
        let badge_height = min_height;

        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(badge_width, badge_height), egui::Sense::hover());

        if ui.is_rect_visible(rect) {
            let rounding = if self.pill {
                CornerRadius::same((badge_height / 2.0) as u8)
            } else {
                CornerRadius::same(4)
            };

            if self.outline {
                ui.painter().rect(
                    rect,
                    rounding,
                    Color32::TRANSPARENT,
                    egui::Stroke::new(1.0, bg_color),
                    egui::epaint::StrokeKind::Inside,
                );
            } else {
                ui.painter().rect_filled(rect, rounding, bg_color);
            }

            ui.painter().galley(
                egui::pos2(
                    rect.center().x - galley.size().x / 2.0,
                    rect.center().y - galley.size().y / 2.0,
                ),
                galley,
                if self.outline { bg_color } else { text_color },
            );
        }

        response
    }
}

/// Simple badge with text.
pub fn badge(ui: &mut Ui, text: &str) -> egui::Response {
    Badge::new(text).show(ui)
}

/// Badge with variant.
pub fn badge_variant(ui: &mut Ui, text: &str, variant: BadgeVariant) -> egui::Response {
    Badge::new(text).variant(variant).show(ui)
}

/// Success badge.
pub fn badge_success(ui: &mut Ui, text: &str) -> egui::Response {
    Badge::new(text).variant(BadgeVariant::Success).show(ui)
}

/// Error badge.
pub fn badge_error(ui: &mut Ui, text: &str) -> egui::Response {
    Badge::new(text).variant(BadgeVariant::Error).show(ui)
}

/// Warning badge.
pub fn badge_warning(ui: &mut Ui, text: &str) -> egui::Response {
    Badge::new(text).variant(BadgeVariant::Warning).show(ui)
}

/// Info badge.
pub fn badge_info(ui: &mut Ui, text: &str) -> egui::Response {
    Badge::new(text).variant(BadgeVariant::Info).show(ui)
}

/// Count badge (numeric).
pub fn badge_count(ui: &mut Ui, count: u32) -> egui::Response {
    let text = if count > 99 {
        "99+".to_string()
    } else {
        count.to_string()
    };
    Badge::new(&text)
        .variant(BadgeVariant::Error)
        .pill()
        .size(BadgeSize::Small)
        .show(ui)
}

/// Pill badge (fully rounded).
pub fn badge_pill(ui: &mut Ui, text: &str, variant: BadgeVariant) -> egui::Response {
    Badge::new(text).variant(variant).pill().show(ui)
}

/// Outlined badge.
pub fn badge_outline(ui: &mut Ui, text: &str, variant: BadgeVariant) -> egui::Response {
    Badge::new(text).variant(variant).outline().show(ui)
}

/// Status dot indicator (no text).
pub fn status_dot(ui: &mut Ui, color: Color32) -> egui::Response {
    let size = 8.0;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        ui.painter().circle_filled(rect.center(), size / 2.0, color);
    }

    response
}

/// Animated status dot with pulse effect.
pub fn status_dot_animated(ui: &mut Ui, color: Color32, pulse: bool) -> egui::Response {
    let size = 8.0;
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(size + 4.0, size + 4.0), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let center = rect.center();

        if pulse {
            let t = ui.input(|i| i.time);
            let alpha = ((t * 2.5).cos() * 0.5 + 0.5) as f32;

            // Outer glow
            ui.painter().circle_filled(
                center,
                size / 2.0 + 2.0,
                color.linear_multiply(alpha * 0.3),
            );
            ui.ctx().request_repaint();
        }

        // Main dot
        ui.painter().circle_filled(center, size / 2.0, color);
    }

    response
}
