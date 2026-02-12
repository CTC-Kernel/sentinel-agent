//! Badge widget — Apple-inspired soft tinted badges.
//!
//! All badges use the unified color helpers from `theme::badge_bg()`,
//! `theme::badge_text()`, and `theme::badge_border()` for consistent
//! premium appearance across light and dark modes.

use crate::theme;
use egui::{Color32, CornerRadius, Ui};

/// Badge semantic variant.
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
    /// Returns the semantic base color for this variant.
    fn base_color(&self) -> Color32 {
        match self {
            BadgeVariant::Default => theme::ACCENT,
            BadgeVariant::Success => theme::SUCCESS,
            BadgeVariant::Warning => theme::WARNING,
            BadgeVariant::Error => theme::ERROR,
            BadgeVariant::Info => theme::INFO,
            BadgeVariant::Neutral => theme::text_tertiary(),
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
    /// Returns `(h_padding, v_padding, font)`.
    fn dimensions(&self) -> (f32, f32, egui::FontId) {
        match self {
            BadgeSize::Small => (6.0, 2.0, theme::font_label()),
            BadgeSize::Medium => (8.0, 3.0, theme::font_small()),
            BadgeSize::Large => (10.0, 4.0, theme::font_body()),
        }
    }
}

/// A badge widget for displaying counts, statuses, and labels.
///
/// Renders as a soft-tinted pill with contrasting text.
pub struct Badge<'a> {
    text: &'a str,
    variant: BadgeVariant,
    size: BadgeSize,
    outline: bool,
}

impl<'a> Badge<'a> {
    pub fn new(text: &'a str) -> Self {
        Self {
            text,
            variant: BadgeVariant::Default,
            size: BadgeSize::Medium,
            outline: false,
        }
    }

    pub fn variant(mut self, variant: BadgeVariant) -> Self {
        self.variant = variant;
        self
    }

    pub fn size(mut self, size: BadgeSize) -> Self {
        self.size = size;
        self
    }

    /// Outline mode: transparent bg with colored border + text.
    pub fn outline(mut self) -> Self {
        self.outline = true;
        self
    }

    pub fn show(self, ui: &mut Ui) -> egui::Response {
        let (h_pad, v_pad, font) = self.size.dimensions();
        let base = self.variant.base_color();

        let text_color = theme::badge_text(base);

        let galley =
            ui.painter()
                .layout_no_wrap(self.text.to_string(), font.clone(), text_color);

        let text_size = galley.size();
        let badge_w = text_size.x + h_pad * 2.0;
        let badge_h = (text_size.y + v_pad * 2.0).max(theme::ICON_SM + 2.0);

        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(badge_w, badge_h), egui::Sense::hover());

        if ui.is_rect_visible(rect) {
            let rounding = CornerRadius::same((badge_h / 2.0).min(255.0) as u8);

            if self.outline {
                // Outline: transparent bg, colored border
                ui.painter().rect(
                    rect,
                    rounding,
                    Color32::TRANSPARENT,
                    egui::Stroke::new(theme::BORDER_THIN, theme::badge_border(base)),
                    egui::epaint::StrokeKind::Inside,
                );
            } else {
                // Filled: soft tinted bg + subtle border
                ui.painter()
                    .rect_filled(rect, rounding, theme::badge_bg(base));
                ui.painter().rect_stroke(
                    rect,
                    rounding,
                    egui::Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(base)),
                    egui::epaint::StrokeKind::Inside,
                );
            }

            // Centered text
            let text_pos = ui.layout().align_size_within_rect(text_size, rect).min;
            ui.painter().galley(text_pos, galley, text_color);
        }

        response
    }
}

// ============================================================================
// Convenience functions
// ============================================================================

/// Default badge.
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

/// Count badge (notification pill).
pub fn badge_count(ui: &mut Ui, count: u32) -> egui::Response {
    let text = if count > 99 {
        "99+".to_string()
    } else {
        count.to_string()
    };
    Badge::new(&text)
        .variant(BadgeVariant::Error)
        .size(BadgeSize::Small)
        .show(ui)
}

/// Pill badge (alias — all badges are pill-shaped now).
pub fn badge_pill(ui: &mut Ui, text: &str, variant: BadgeVariant) -> egui::Response {
    Badge::new(text).variant(variant).show(ui)
}

/// Outlined badge.
pub fn badge_outline(ui: &mut Ui, text: &str, variant: BadgeVariant) -> egui::Response {
    Badge::new(text).variant(variant).outline().show(ui)
}

// ============================================================================
// Status dots
// ============================================================================

/// Status dot indicator (no text).
pub fn status_dot(ui: &mut Ui, color: Color32) -> egui::Response {
    let size = theme::STATUS_DOT_SIZE;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        ui.painter().circle_filled(rect.center(), size / 2.0, color);
    }

    response
}

/// Animated status dot with subtle pulse.
pub fn status_dot_animated(ui: &mut Ui, color: Color32, pulse: bool) -> egui::Response {
    let size = theme::STATUS_DOT_SIZE;
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(size + theme::SPACE_XS, size + theme::SPACE_XS), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let center = rect.center();

        if pulse && !theme::is_reduced_motion() {
            let t = ui.input(|i| i.time);
            let alpha = ((t * theme::ANIM_PULSE_SPEED as f64).cos() * 0.4 + 0.6) as f32;

            // Subtle outer glow ring
            ui.painter().circle_filled(
                center,
                size / 2.0 + theme::BORDER_THICK,
                color.linear_multiply(alpha * theme::OPACITY_TINT),
            );
            ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
        }

        ui.painter().circle_filled(center, size / 2.0, color);
    }

    response
}
