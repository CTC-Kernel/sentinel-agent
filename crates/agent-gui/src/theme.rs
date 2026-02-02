//! Design system: Apple-inspired theme for Sentinel Agent.
//!
//! Supports both dark and light themes. Surface / text colors are
//! provided as functions that return the correct value for the active
//! theme.  Semantic colors (accent, success, warning, error, info)
//! remain constants shared by both themes.

use std::cell::Cell;

use egui::{
    Color32, CornerRadius, FontId, Margin, Stroke, Style, TextStyle, Vec2, Visuals, epaint::Shadow,
};

// ============================================================================
// Theme mode (thread-local – GUI is single-threaded)
// ============================================================================

thread_local! {
    static IS_DARK: Cell<bool> = const { Cell::new(true) };
}

/// Set the active theme mode.
pub fn set_dark_mode(dark: bool) {
    IS_DARK.with(|c| c.set(dark));
}

/// Query the active theme mode.
pub fn is_dark_mode() -> bool {
    IS_DARK.with(|c| c.get())
}

// ============================================================================
// Brand / semantic colors (shared between themes)
// ============================================================================

/// Primary accent (Sentinel brand blue – aligned with web app).
pub const ACCENT: Color32 = Color32::from_rgb(74, 127, 199); // #4a7fc7
/// Secondary accent (lighter brand blue).
pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(96, 144, 249); // brand-400
/// Accent hover state.
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(82, 140, 210);

/// Success teal-green.
pub const SUCCESS: Color32 = Color32::from_rgb(77, 184, 138); // #4db88a
/// Warning amber.
pub const WARNING: Color32 = Color32::from_rgb(217, 160, 61); // #d9a03d
/// Error red.
pub const ERROR: Color32 = Color32::from_rgb(224, 96, 96); // #e06060
/// Info cyan-blue.
pub const INFO: Color32 = Color32::from_rgb(75, 163, 204); // #4ba3cc
/// Severity-high amber (web app risk amber).
pub const SEVERITY_HIGH: Color32 = Color32::from_rgb(200, 127, 26); // #c87f1a

// ============================================================================
// Surface colors (dynamic – depends on active theme)
// ============================================================================

/// Window / app background.
#[inline]
pub fn bg_primary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(18, 18, 20)
    } else {
        Color32::from_rgb(246, 246, 248)
    }
}

/// Card / panel background.
#[inline]
pub fn bg_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(28, 28, 30)
    } else {
        Color32::WHITE
    }
}

/// Elevated surface (hover, modal).
#[inline]
pub fn bg_elevated() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(38, 38, 40)
    } else {
        Color32::from_rgb(232, 232, 236)
    }
}

/// Sidebar background.
#[inline]
pub fn bg_sidebar() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(14, 14, 16)
    } else {
        Color32::from_rgb(240, 240, 242)
    }
}

/// Deep/inset background (terminal, canvas).
#[inline]
pub fn bg_deep() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(10, 10, 12)
    } else {
        Color32::from_rgb(232, 232, 236)
    }
}

// ============================================================================
// Text colors (dynamic)
// ============================================================================

/// Primary text (high emphasis).
#[inline]
pub fn text_primary() -> Color32 {
    if is_dark_mode() {
        Color32::WHITE
    } else {
        Color32::from_rgb(26, 26, 28)
    }
}

/// Secondary text (medium emphasis).
#[inline]
pub fn text_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(174, 174, 178)
    } else {
        Color32::from_rgb(107, 107, 112)
    }
}

/// Tertiary / disabled text.
#[inline]
pub fn text_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(99, 99, 102)
    } else {
        Color32::from_rgb(158, 158, 163)
    }
}

/// Text on accent background (white in both themes).
#[inline]
pub fn text_on_accent() -> Color32 {
    Color32::WHITE
}

// ============================================================================
// Border / separator (dynamic)
// ============================================================================

/// Subtle border.
#[inline]
pub fn border() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(54, 54, 56)
    } else {
        Color32::from_rgb(216, 216, 220)
    }
}

/// Separator line.
#[inline]
pub fn separator() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(44, 44, 48)
    } else {
        Color32::from_rgb(226, 226, 230)
    }
}

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

/// COMEX-ready header font (28px Extra-Bold/strong).
pub fn font_comex() -> FontId {
    FontId::new(28.0, egui::FontFamily::Proportional)
}

// ============================================================================
// Style application
// ============================================================================

/// Load embedded icon font (Font Awesome 6 Solid) + system symbol fallback.
pub fn configure_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();

    // ── Embedded Font Awesome 6 Free Solid ──────────────────────────
    static FA_SOLID: &[u8] = include_bytes!("../assets/fonts/fa-solid-900.ttf");
    fonts.font_data.insert(
        "fa_solid".to_owned(),
        egui::FontData::from_static(FA_SOLID).into(),
    );
    // Add as fallback so FA codepoints (Private Use Area) resolve automatically.
    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
        family.push("fa_solid".to_owned());
    }
    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
        family.push("fa_solid".to_owned());
    }

    // ── System symbol fonts (for any remaining Unicode symbols) ─────
    #[cfg(target_os = "macos")]
    {
        let paths = [
            "/System/Library/Fonts/Apple Symbols.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ];
        for path in &paths {
            if let Ok(data) = std::fs::read(path) {
                fonts.font_data.insert(
                    "system_symbols".to_owned(),
                    egui::FontData::from_owned(data).into(),
                );
                if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
                    family.push("system_symbols".to_owned());
                }
                if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
                    family.push("system_symbols".to_owned());
                }
                break;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(data) = std::fs::read("C:\\Windows\\Fonts\\seguisym.ttf") {
            fonts.font_data.insert(
                "system_symbols".to_owned(),
                egui::FontData::from_owned(data).into(),
            );
            if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
                family.push("system_symbols".to_owned());
            }
            if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
                family.push("system_symbols".to_owned());
            }
        }
    }

    ctx.set_fonts(fonts);
}

/// Apply the Sentinel theme to an egui context.
///
/// Pass `true` for the dark theme, `false` for the light theme.
pub fn apply_theme(ctx: &egui::Context, dark: bool) {
    // Update global mode first so that color functions return the right values.
    set_dark_mode(dark);

    let mut style = Style::default();

    // Text styles
    style.text_styles.insert(TextStyle::Heading, font_heading());
    style.text_styles.insert(TextStyle::Body, font_body());
    style.text_styles.insert(TextStyle::Button, font_body());
    style.text_styles.insert(TextStyle::Small, font_small());
    style.text_styles.insert(TextStyle::Monospace, font_mono());

    // Spacing
    style.spacing.item_spacing = Vec2::new(SPACE_SM, SPACE_SM);
    style.spacing.window_margin = Margin::same(20);
    style.spacing.button_padding = Vec2::new(SPACE_MD, SPACE_SM);
    style.spacing.indent = SPACE;

    // Visuals
    let mut visuals = if dark {
        Visuals::dark()
    } else {
        Visuals::light()
    };

    // Panel
    visuals.panel_fill = bg_primary();
    visuals.window_fill = bg_secondary();

    let btn_rounding = CornerRadius::same(BUTTON_ROUNDING);

    // Widgets idle
    visuals.widgets.noninteractive.bg_fill = bg_secondary();
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, text_secondary());
    visuals.widgets.noninteractive.corner_radius = btn_rounding;
    visuals.widgets.noninteractive.bg_stroke = Stroke::NONE;

    // Widgets hovered
    visuals.widgets.hovered.bg_fill = bg_elevated();
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, text_primary());
    visuals.widgets.hovered.corner_radius = btn_rounding;
    visuals.widgets.hovered.bg_stroke = Stroke::NONE;

    // Widgets active
    visuals.widgets.active.bg_fill = ACCENT;
    visuals.widgets.active.fg_stroke = Stroke::new(1.0, text_on_accent());
    visuals.widgets.active.corner_radius = btn_rounding;

    // Widgets inactive (buttons)
    visuals.widgets.inactive.bg_fill = bg_elevated();
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, text_primary());
    visuals.widgets.inactive.corner_radius = btn_rounding;
    visuals.widgets.inactive.bg_stroke = Stroke::NONE;

    // Selection
    visuals.selection.bg_fill = ACCENT.linear_multiply(0.2);
    visuals.selection.stroke = Stroke::new(1.0, ACCENT);

    // Window
    visuals.window_corner_radius = CornerRadius::same(CARD_ROUNDING);
    visuals.window_shadow = if dark {
        premium_shadow(16, 80)
    } else {
        premium_shadow(8, 30)
    };
    visuals.window_stroke = if dark {
        Stroke::NONE
    } else {
        Stroke::new(0.5, border())
    };

    // Misc
    visuals.popup_shadow = if dark {
        premium_shadow(8, 60)
    } else {
        premium_shadow(4, 20)
    };
    visuals.resize_corner_size = 8.0;
    visuals.hyperlink_color = ACCENT_LIGHT;
    visuals.faint_bg_color = bg_elevated();
    visuals.extreme_bg_color = if dark {
        Color32::from_rgb(14, 14, 16)
    } else {
        Color32::from_rgb(250, 250, 252)
    };
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
        "skipped" => text_tertiary(),
        _ => text_secondary(),
    }
}

/// Color for a severity string.
pub fn severity_color(severity: &str) -> Color32 {
    match severity {
        "critical" => ERROR,
        "high" => SEVERITY_HIGH,
        "medium" => WARNING,
        "low" => INFO,
        "info" => text_secondary(),
        _ => text_secondary(),
    }
}
