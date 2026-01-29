//! Design system: Apple-inspired dark theme for Sentinel Agent.
//!
//! Provides colors, spacing, fonts, and style helpers used across
//! all pages and widgets.

use egui::{
    Color32, CornerRadius, FontId, Margin, Stroke, Style, TextStyle, Vec2, Visuals, epaint::Shadow,
};

// ============================================================================
// Brand colors
// ============================================================================

/// Primary accent (Sentinel blue).
pub const ACCENT: Color32 = Color32::from_rgb(0, 122, 255);
/// Secondary accent (lighter blue).
pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(64, 156, 255);
/// Accent hover state.
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(30, 144, 255);

/// Success green.
pub const SUCCESS: Color32 = Color32::from_rgb(48, 209, 88);
/// Warning amber.
pub const WARNING: Color32 = Color32::from_rgb(255, 159, 10);
/// Error red.
pub const ERROR: Color32 = Color32::from_rgb(255, 69, 58);
/// Info blue.
pub const INFO: Color32 = Color32::from_rgb(100, 210, 255);

// ============================================================================
// Surface colors (dark theme)
// ============================================================================

/// Window / app background.
pub const BG_PRIMARY: Color32 = Color32::from_rgb(22, 22, 24);
/// Card / panel background.
pub const BG_SECONDARY: Color32 = Color32::from_rgb(30, 30, 34);
/// Elevated surface (hover, modal).
pub const BG_ELEVATED: Color32 = Color32::from_rgb(38, 38, 42);
/// Sidebar background.
pub const BG_SIDEBAR: Color32 = Color32::from_rgb(26, 26, 30);

// ============================================================================
// Text colors
// ============================================================================

/// Primary text (high emphasis).
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(242, 242, 247);
/// Secondary text (medium emphasis).
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(152, 152, 157);
/// Tertiary / disabled text.
pub const TEXT_TERTIARY: Color32 = Color32::from_rgb(99, 99, 102);
/// Text on accent background.
pub const TEXT_ON_ACCENT: Color32 = Color32::WHITE;

// ============================================================================
// Border / separator
// ============================================================================

/// Subtle border.
pub const BORDER: Color32 = Color32::from_rgb(48, 48, 52);
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
pub const SIDEBAR_WIDTH: f32 = 220.0;

/// Card rounding radius (as u8 for CornerRadius).
pub const CARD_ROUNDING: u8 = 10;
/// Button rounding radius (as u8 for CornerRadius).
pub const BUTTON_ROUNDING: u8 = 8;
/// Badge rounding radius (as u8 for CornerRadius).
pub const BADGE_ROUNDING: u8 = 12;

// ============================================================================
// Font helpers
// ============================================================================

/// Title font (20px bold).
pub fn font_title() -> FontId {
    FontId::proportional(20.0)
}

/// Heading font (16px bold).
pub fn font_heading() -> FontId {
    FontId::proportional(16.0)
}

/// Body font (14px).
pub fn font_body() -> FontId {
    FontId::proportional(14.0)
}

/// Small / caption font (12px).
pub fn font_small() -> FontId {
    FontId::proportional(12.0)
}

/// Monospace font (13px).
pub fn font_mono() -> FontId {
    FontId::monospace(13.0)
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
        .insert(TextStyle::Heading, FontId::proportional(20.0));
    style
        .text_styles
        .insert(TextStyle::Body, FontId::proportional(14.0));
    style
        .text_styles
        .insert(TextStyle::Button, FontId::proportional(14.0));
    style
        .text_styles
        .insert(TextStyle::Small, FontId::proportional(12.0));
    style
        .text_styles
        .insert(TextStyle::Monospace, FontId::monospace(13.0));

    // Spacing
    style.spacing.item_spacing = Vec2::new(SPACE_SM, SPACE_SM);
    style.spacing.window_margin = Margin::same(16);
    style.spacing.button_padding = Vec2::new(SPACE_MD, SPACE_SM);
    style.spacing.indent = SPACE;

    // Visuals (dark theme)
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
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, ACCENT);

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
    visuals.selection.bg_fill = ACCENT.linear_multiply(0.3);
    visuals.selection.stroke = Stroke::new(1.0, ACCENT);

    // Window
    visuals.window_corner_radius = CornerRadius::same(CARD_ROUNDING);
    visuals.window_shadow = Shadow {
        offset: [0, 4],
        blur: 16,
        spread: 0,
        color: Color32::from_black_alpha(80),
    };
    visuals.window_stroke = Stroke::new(0.5, BORDER);

    // Misc
    visuals.popup_shadow = Shadow {
        offset: [0, 2],
        blur: 8,
        spread: 0,
        color: Color32::from_black_alpha(60),
    };
    visuals.resize_corner_size = 8.0;
    visuals.hyperlink_color = ACCENT_LIGHT;
    visuals.faint_bg_color = BG_ELEVATED;
    visuals.extreme_bg_color = Color32::from_rgb(14, 14, 16);
    visuals.striped = true;

    style.visuals = visuals;
    ctx.set_style(style);
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
