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

/// Primary accent (Apple System Blue).
pub const ACCENT: Color32 = Color32::from_rgb(0, 122, 255); // #007AFF
/// Secondary accent (lighter brand blue).
pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(90, 200, 250); // #5AC8FA (Apple System Teal/Blue mix)
/// Accent hover state.
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(0, 113, 237);

/// Success green (Apple System Green).
pub const SUCCESS: Color32 = Color32::from_rgb(52, 199, 89); // #34C759
/// Warning orange (Apple System Orange).
pub const WARNING: Color32 = Color32::from_rgb(255, 149, 0); // #FF9500
/// Error red (Apple System Red).
pub const ERROR: Color32 = Color32::from_rgb(255, 59, 48); // #FF3B30
/// Info blue (Apple System Blue / Teal).
pub const INFO: Color32 = Color32::from_rgb(0, 122, 255); // #007AFF
/// Severity-high amber (web app risk amber / System Yellow).
pub const SEVERITY_HIGH: Color32 = Color32::from_rgb(255, 204, 0); // #FFCC00

// ============================================================================
// Surface colors (dynamic – depends on active theme)
// ============================================================================

/// Window / app background.
#[inline]
pub fn bg_primary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(5, 5, 5) // Midnight Dark (OLED friendly)
    } else {
        Color32::from_rgb(242, 242, 247) // System Gray 6 Light
    }
}

/// Card / panel background.
#[inline]
pub fn bg_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(18, 18, 20) // Deep Graphite
    } else {
        Color32::WHITE
    }
}

/// Elevated surface (hover, modal).
#[inline]
pub fn bg_elevated() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(58, 58, 60) // System Gray 4 Dark
    } else {
        Color32::WHITE
    }
}

/// Sidebar background.
#[inline]
pub fn bg_sidebar() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(10, 10, 12)
    } else {
        Color32::from_rgb(235, 235, 240)
    }
}

/// Deep/inset background (terminal, canvas).
#[inline]
pub fn bg_deep() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(0, 0, 0)
    } else {
        Color32::from_rgb(245, 245, 250)
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
        Color32::BLACK
    }
}

/// Secondary text (medium emphasis).
#[inline]
pub fn text_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(142, 142, 147) // System Gray
    } else {
        Color32::from_rgb(100, 100, 105) // Darker Gray for AAA contrast on white
    }
}

/// Tertiary / disabled text.
#[inline]
pub fn text_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(99, 99, 102) // System Gray 2
    } else {
        Color32::from_rgb(140, 140, 145) // Darker than System Gray 3 for readability
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

/// Subtle border (glassy).
#[inline]
pub fn border() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(12) // Extremely subtle white
    } else {
        Color32::from_black_alpha(10)
    }
}

/// Separator line.
#[inline]
pub fn separator() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgba_premultiplied(255, 255, 255, 30)
    } else {
        Color32::from_rgba_premultiplied(0, 0, 0, 30)
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
pub const SIDEBAR_WIDTH: f32 = 250.0;

/// Card rounding radius.
pub const CARD_ROUNDING: u8 = 16;
/// Button rounding radius.
pub const BUTTON_ROUNDING: u8 = 8;
/// Badge rounding radius.
pub const BADGE_ROUNDING: u8 = 6;

// ============================================================================
// Font helpers
// ============================================================================

/// Title font (24px bold).
pub fn font_title() -> FontId {
    FontId::new(24.0, egui::FontFamily::Proportional) // SF Pro Display Bold equivalent
}

/// Heading font (17px semibold).
pub fn font_heading() -> FontId {
    FontId::new(17.0, egui::FontFamily::Proportional) // SF Pro Text Semibold equivalent
}

/// Body font (13px).
pub fn font_body() -> FontId {
    FontId::new(13.0, egui::FontFamily::Proportional) // SF Pro Text Regular equivalent
}

/// Small / caption font (11px).
pub fn font_small() -> FontId {
    FontId::new(11.0, egui::FontFamily::Proportional) // SF Pro Text Medium equivalent
}

/// Monospace font (12px).
pub fn font_mono() -> FontId {
    FontId::new(12.0, egui::FontFamily::Monospace) // SF Mono equivalent
}

/// COMEX-ready header font (32px Extra-Bold/strong).
pub fn font_comex() -> FontId {
    FontId::new(32.0, egui::FontFamily::Proportional)
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

    // Use a slightly larger corner radius for modern macOS feel
    let btn_rounding = CornerRadius::same(BUTTON_ROUNDING);

    // Widgets idle
    visuals.widgets.noninteractive.bg_fill = bg_secondary();
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, text_secondary());
    visuals.widgets.noninteractive.corner_radius = btn_rounding;
    visuals.widgets.noninteractive.bg_stroke = Stroke::NONE;

    // Widgets hovered
    visuals.widgets.hovered.bg_fill = bg_elevated(); // Slightly lighter/raised
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
    visuals.widgets.inactive.bg_stroke = Stroke::NONE; // Remove border for cleaner look

    // Selection
    visuals.selection.bg_fill = ACCENT.linear_multiply(0.2);
    visuals.selection.stroke = Stroke::new(1.0, ACCENT);

    // Window
    visuals.window_corner_radius = CornerRadius::same(CARD_ROUNDING);
    visuals.window_shadow = if dark {
        premium_shadow(40, 96) // Deeper, smoother shadow
    } else {
        premium_shadow(24, 40)
    };
    visuals.window_stroke = if dark {
        Stroke::new(0.5, Color32::from_white_alpha(15)) // Subtle light border in dark mode
    } else {
        Stroke::new(0.5, Color32::from_black_alpha(15)) // Subtle dark border in light mode
    };

    // Misc
    visuals.popup_shadow = if dark {
        premium_shadow(24, 80)
    } else {
        premium_shadow(12, 30)
    };
    visuals.resize_corner_size = 8.0;
    visuals.hyperlink_color = ACCENT_LIGHT;
    visuals.faint_bg_color = bg_elevated();
    visuals.extreme_bg_color = if dark {
        Color32::from_rgb(14, 14, 16)
    } else {
        Color32::from_rgb(250, 250, 252)
    };
    visuals.striped = false; // Striping can look dated; plain is cleaner.

    style.visuals = visuals;
    ctx.set_style(style);
}

/// Helper for a premium deep shadow.
pub fn premium_shadow(blur: u32, alpha: u8) -> Shadow {
    Shadow {
        offset: [0, 4], // Slight vertical offset
        blur: blur as u8,
        spread: 0,
        color: Color32::from_black_alpha(alpha),
    }
}

/// Helper for a subtle glow effect around a rect.
pub fn glow_stroke(color: Color32) -> Stroke {
    Stroke::new(1.0, color.linear_multiply(0.5))
}

/// Color for a compliance score value.
pub fn score_color(score: f32) -> Color32 {
    if score >= 85.0 {
        SUCCESS
    } else if score >= 60.0 {
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
