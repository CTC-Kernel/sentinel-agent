//! Design system: Apple-inspired dark theme for Sentinel Agent.
//!
//! Provides colors, spacing, fonts, and style helpers used across
//! all pages and widgets.

use egui::{
    Color32, CornerRadius, FontId, Margin, Stroke, Style, TextStyle, Vec2, Visuals, epaint::Shadow,
};

// ============================================================================
// Brand colors (Premium Palette)
// ============================================================================

/// Primary accent (Sentinel blue - Apple San Francisco style).
pub const ACCENT: Color32 = Color32::from_rgb(10, 132, 255);
/// Secondary accent (lighter blue).
pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(100, 210, 255);
/// Accent hover state.
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(64, 156, 255);

/// Success green.
pub const SUCCESS: Color32 = Color32::from_rgb(48, 209, 88);
/// Warning amber.
pub const WARNING: Color32 = Color32::from_rgb(255, 159, 10);
/// Error red.
pub const ERROR: Color32 = Color32::from_rgb(255, 69, 58);
/// Info blue.
pub const INFO: Color32 = Color32::from_rgb(100, 210, 255);

// ============================================================================
// Surface colors (Deep Dark Theme)
// ============================================================================

/// Window / app background.
pub const BG_PRIMARY: Color32 = Color32::from_rgb(28, 28, 30);
/// Card / panel background.
pub const BG_SECONDARY: Color32 = Color32::from_rgb(36, 36, 38);
/// Elevated surface (hover, modal).
pub const BG_ELEVATED: Color32 = Color32::from_rgb(44, 44, 46);
/// Sidebar background.
pub const BG_SIDEBAR: Color32 = Color32::from_rgb(24, 24, 26);

// ============================================================================
// Text colors
// ============================================================================

/// Primary text (high emphasis).
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(255, 255, 255);
/// Secondary text (medium emphasis).
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(174, 174, 178);
/// Tertiary / disabled text.
pub const TEXT_TERTIARY: Color32 = Color32::from_rgb(99, 99, 102);
/// Text on accent background.
pub const TEXT_ON_ACCENT: Color32 = Color32::WHITE;

// ============================================================================
// Border / separator
// ============================================================================

/// Subtle border.
pub const BORDER: Color32 = Color32::from_rgb(54, 54, 56);
/// Separator line.
pub const SEPARATOR: Color32 = Color32::from_rgb(44, 44, 48);

// ============================================================================
// Spacing constants
// ============================================================================

/// Base spacing unit (4px).
pub const SPACE_XS: f32 = 4.0;
/// Small spacing (8px).
pub const SPACE_SM: f32 = 8.0;
/// Medium spacing (12px).
pub const SPACE_MD: f32 = 12.0;
/// Default spacing (16px).
pub const SPACE: f32 = 16.0;
/// Large spacing (24px).
pub const SPACE_LG: f32 = 24.0;
/// Extra-large spacing (32px).
pub const SPACE_XL: f32 = 32.0;

/// Sidebar width.
pub const SIDEBAR_WIDTH: f32 = 240.0;

/// Card rounding radius.
pub const CARD_ROUNDING: u8 = 12;
/// Button rounding radius.
pub const BUTTON_ROUNDING: u8 = 10;
/// Badge rounding radius.
pub const BADGE_ROUNDING: u8 = 12;

// ============================================================================
// Font helpers
// ============================================================================

/// Title font (22px bold).
pub fn font_title() -> FontId {
    FontId::new(22.0, egui::FontFamily::Proportional)
}

/// Heading font (16px semibold).
pub fn font_heading() -> FontId {
    FontId::new(16.0, egui::FontFamily::Proportional)
}

/// Body font (14px).
pub fn font_body() -> FontId {
    FontId::new(14.0, egui::FontFamily::Proportional)
}

/// Small / caption font (12px).
pub fn font_small() -> FontId {
    FontId::new(12.0, egui::FontFamily::Proportional)
}

/// Monospace font (13px).
pub fn font_mono() -> FontId {
    FontId::new(13.0, egui::FontFamily::Monospace)
}

// ============================================================================
// Style application
// ============================================================================

/// Apply the Sentinel dark theme to an egui context.
pub fn apply_theme(ctx: &egui::Context) {
    let mut style = Style::default();

    // Text styles
    style
        .text_styles
        .insert(TextStyle::Heading, font_heading());
    style
        .text_styles
        .insert(TextStyle::Body, font_body());
    style
        .text_styles
        .insert(TextStyle::Button, font_body());
    style
        .text_styles
        .insert(TextStyle::Small, font_small());
    style
        .text_styles
        .insert(TextStyle::Monospace, font_mono());

    // Spacing
    style.spacing.item_spacing = Vec2::new(SPACE_SM, SPACE_SM);
    style.spacing.window_margin = Margin::same(20);
    style.spacing.button_padding = Vec2::new(SPACE_MD, SPACE_SM);
    style.spacing.indent = SPACE;

    // Visuals (Rich dark theme)
    let mut visuals = Visuals::dark();

    // Panel
    visuals.panel_fill = BG_PRIMARY;
    visuals.window_fill = BG_SECONDARY;

    let btn_rounding = CornerRadius::same(BUTTON_ROUNDING);

    // Widgets idle
    visuals.widgets.noninteractive.bg_fill = BG_SECONDARY;
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, TEXT_SECONDARY);
    visuals.widgets.noninteractive.corner_radius = btn_rounding;
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(0.5, BORDER);

    // Widgets hovered
    visuals.widgets.hovered.bg_fill = BG_ELEVATED;
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, TEXT_PRIMARY);
    visuals.widgets.hovered.corner_radius = btn_rounding;
    visuals.widgets.hovered.bg_stroke = Stroke::new(0.6, ACCENT);

    // Widgets active
    visuals.widgets.active.bg_fill = ACCENT;
    visuals.widgets.active.fg_stroke = Stroke::new(1.0, TEXT_ON_ACCENT);
    visuals.widgets.active.corner_radius = btn_rounding;

    // Widgets inactive (buttons)
    visuals.widgets.inactive.bg_fill = BG_ELEVATED;
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT_PRIMARY);
    visuals.widgets.inactive.corner_radius = btn_rounding;
    visuals.widgets.inactive.bg_stroke = Stroke::new(0.5, BORDER);

    // Selection
    visuals.selection.bg_fill = ACCENT.linear_multiply(0.2);
    visuals.selection.stroke = Stroke::new(1.0, ACCENT);

    // Window
    visuals.window_corner_radius = CornerRadius::same(CARD_ROUNDING);
    visuals.window_shadow = premium_shadow(16, 80);
    visuals.window_stroke = Stroke::new(0.5, BORDER);

    // Misc
    visuals.popup_shadow = premium_shadow(8, 60);
    visuals.resize_corner_size = 8.0;
    visuals.hyperlink_color = ACCENT_LIGHT;
    visuals.faint_bg_color = BG_ELEVATED;
    visuals.extreme_bg_color = Color32::from_rgb(14, 14, 16);
    visuals.striped = true;

    style.visuals = visuals;
    ctx.set_style(style);
}

/// Helper for a premium deep shadow.
pub fn premium_shadow(blur: u32, alpha: u8) -> Shadow {
    Shadow {
        offset: [0, (blur / 4) as i8],
        blur: blur as u8,
        spread: 0,
        color: Color32::from_black_alpha(alpha),
    }
}

/// Helper for a subtle glow effect around a rect.
pub fn glow_stroke(color: Color32) -> Stroke {
    Stroke::new(1.0, color.linear_multiply(0.3))
}

/// Color for a compliance score value.
pub fn score_color(score: f32) -> Color32 {
    if score >= 80.0 {
        SUCCESS
    } else if score >= 50.0 {
        WARNING
    } else {
        ERROR
    }
}

/// Color for a check status string.
pub fn status_color(status: &str) -> Color32 {
    match status {
        "pass" => SUCCESS,
        "fail" => ERROR,
        "error" => ERROR,
        "pending" | "running" => WARNING,
        "skipped" => TEXT_TERTIARY,
        _ => TEXT_SECONDARY,
    }
}

/// Color for a severity string.
pub fn severity_color(severity: &str) -> Color32 {
    match severity {
        "critical" => ERROR,
        "high" => Color32::from_rgb(255, 100, 80),
        "medium" => WARNING,
        "low" => INFO,
        "info" => TEXT_SECONDARY,
        _ => TEXT_SECONDARY,
    }
}
