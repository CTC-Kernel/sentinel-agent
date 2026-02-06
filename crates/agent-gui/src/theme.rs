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

/// Extension trait to restore chaining methods for FontId.
pub trait FontIdExt {
    fn size(self, size: f32) -> Self;
    fn strong(self) -> Self;
}

impl FontIdExt for FontId {
    fn size(mut self, size: f32) -> Self {
        self.size = size;
        self
    }
    fn strong(self) -> Self {
        // Note: egui doesn't support font weights directly, so strong() just returns self.
        // Actual bold styling should be done via RichText::strong()
        self
    }
}

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

/// Success green (Refined Mint - more premium/professional).
pub const SUCCESS: Color32 = Color32::from_rgb(52, 199, 89); // Apple System Green
/// Warning orange (Refined Amber).
pub const WARNING: Color32 = Color32::from_rgb(255, 159, 10); // Apple System Orange
/// Error red (Refined Crimson).
pub const ERROR: Color32 = Color32::from_rgb(255, 69, 58); // Apple System Red
/// Info blue (Refined Azure).
pub const INFO: Color32 = Color32::from_rgb(10, 132, 255); // Apple System Blue
/// Severity-high amber (high contrast).
pub const SEVERITY_HIGH: Color32 = Color32::from_rgb(255, 214, 10); // Apple System Yellow
/// Severity-medium (Sophisticated Orange).
pub const SEVERITY_MEDIUM: Color32 = Color32::from_rgb(255, 159, 10);

// ============================================================================
// Surface colors (dynamic – depends on active theme)
// ============================================================================

/// Window / app background.
#[inline]
pub fn bg_primary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(3, 3, 5) // Deep Midnight OLED
    } else {
        Color32::from_rgb(242, 242, 247) // System Gray 6 Light
    }
}

/// Card / panel background.
#[inline]
pub fn bg_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(12, 12, 15) // Deep Charcoal
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

#[inline]
pub fn bg_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(28, 28, 30) // System Gray 6 Dark
    } else {
        Color32::from_rgb(229, 229, 234) // System Gray 5 Light
    }
}

/// Sidebar background.
#[inline]
pub fn bg_sidebar() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(7, 7, 10) // Slightly lighter than background for depth
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
/// Note: Light mode uses darker gray for WCAG AA contrast (4.5:1 ratio on white).
#[inline]
pub fn text_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(99, 99, 102) // System Gray 2
    } else {
        Color32::from_rgb(115, 115, 120) // Darker gray for WCAG AA contrast (~4.5:1 on white)
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
// Semantic font sizes (use these instead of inline FontId::proportional())
// ============================================================================

/// Card large value font (26px - for metric numbers).
pub fn font_card_value() -> FontId {
    FontId::new(26.0, egui::FontFamily::Proportional)
}

/// Stat/metric font (20px - for dashboard numbers).
pub fn font_stat() -> FontId {
    FontId::new(20.0, egui::FontFamily::Proportional)
}

/// Label font (11px - for labels and annotations, WCAG accessible minimum).
pub fn font_label() -> FontId {
    FontId::new(11.0, egui::FontFamily::Proportional)
}

/// Minimum readable font (11px - minimum for accessibility).
pub fn font_min() -> FontId {
    FontId::new(11.0, egui::FontFamily::Proportional)
}

/// Caption font (10px - use sparingly, only for decorative/non-essential text).
pub fn font_caption() -> FontId {
    FontId::new(10.0, egui::FontFamily::Proportional)
}

// ============================================================================
// Letter spacing constants
// ============================================================================

/// Tight letter spacing (labels, small text).
pub const TRACKING_TIGHT: f32 = 0.3;
/// Normal letter spacing (body, buttons).
pub const TRACKING_NORMAL: f32 = 0.5;
/// Wide letter spacing (section headers, uppercase labels).
pub const TRACKING_WIDE: f32 = 1.0;

// ============================================================================
// Opacity constants (use with .linear_multiply())
// ============================================================================

/// Extremely subtle (borders, dividers).
pub const OPACITY_SUBTLE: f32 = 0.08;
/// Muted (disabled elements, backgrounds).
pub const OPACITY_MUTED: f32 = 0.25;
/// Medium (hover states, secondary elements).
pub const OPACITY_MEDIUM: f32 = 0.5;
/// Strong (active states, emphasis).
pub const OPACITY_STRONG: f32 = 0.85;

// ============================================================================
// Table constants
// ============================================================================

/// Minimum table row height for readability and touch targets.
pub const TABLE_ROW_HEIGHT: f32 = 36.0;
/// Alternating row tint alpha.
pub const TABLE_ALT_ROW_ALPHA: u8 = 6;

/// Get alternating row background color.
pub fn table_row_bg(row_index: usize) -> Color32 {
    if row_index.is_multiple_of(2) {
        Color32::TRANSPARENT
    } else if is_dark_mode() {
        Color32::from_white_alpha(TABLE_ALT_ROW_ALPHA)
    } else {
        Color32::from_black_alpha(TABLE_ALT_ROW_ALPHA)
    }
}

/// Get row hover highlight color.
pub fn table_row_hover() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(15)
    } else {
        Color32::from_black_alpha(10)
    }
}

// ============================================================================
// Glass morphism helpers
// ============================================================================

/// Semi-transparent card background for glass effect.
pub fn glass_card_bg() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgba_premultiplied(18, 18, 20, 220)
    } else {
        Color32::from_rgba_premultiplied(255, 255, 255, 230)
    }
}

/// Glass card border (brighter top-left edge).
pub fn glass_border_top() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(20)
    } else {
        Color32::from_white_alpha(180)
    }
}

/// Glass card border (darker bottom-right edge).
pub fn glass_border_bottom() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(5)
    } else {
        Color32::from_black_alpha(15)
    }
}

// ============================================================================
// Animation helpers
// ============================================================================

/// Duration for page fade transitions.
pub const PAGE_TRANSITION_DURATION: f32 = 0.15;
/// Duration for toast notification display.
pub const TOAST_DURATION_SECS: f64 = 3.0;

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

    // Selection / Focus (accessibility: visible focus ring)
    visuals.selection.bg_fill = ACCENT.linear_multiply(0.2);
    visuals.selection.stroke = Stroke::new(2.0, ACCENT); // 2px for WCAG-compliant focus visibility

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

/// Color for a severity string - follows visual hierarchy:
/// critical (red) > high (amber) > medium (orange) > low (blue) > info (gray)
pub fn severity_color(severity: &str) -> Color32 {
    match severity {
        "critical" => ERROR,         // #FF3B30 Red
        "high" => SEVERITY_HIGH,     // #FFCC00 Amber
        "medium" => SEVERITY_MEDIUM, // #FF9F0A Orange
        "low" => INFO,               // #007AFF Blue
        "info" => text_secondary(),
        _ => text_secondary(),
    }
}

// ============================================================================
// Accessibility helpers
// ============================================================================

/// Focus ring stroke for interactive elements (WCAG 2.4.7 compliant).
pub fn focus_ring() -> egui::Stroke {
    egui::Stroke::new(2.0, ACCENT)
}

/// Focus ring for dark backgrounds.
pub fn focus_ring_light() -> egui::Stroke {
    egui::Stroke::new(2.0, ACCENT_LIGHT)
}

/// Disabled element opacity multiplier.
pub const DISABLED_OPACITY: f32 = 0.4;

/// Get a disabled version of a color.
pub fn disabled_color(color: Color32) -> Color32 {
    color.linear_multiply(DISABLED_OPACITY)
}

/// Hover background for interactive elements.
#[inline]
pub fn hover_bg() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(10)
    } else {
        Color32::from_black_alpha(8)
    }
}

/// Active/pressed background for interactive elements.
#[inline]
pub fn active_bg() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(20)
    } else {
        Color32::from_black_alpha(15)
    }
}

/// Selected item background.
#[inline]
pub fn selected_bg() -> Color32 {
    ACCENT.linear_multiply(if is_dark_mode() { 0.15 } else { 0.12 })
}

// ============================================================================
// Interactive element sizing (touch targets)
// ============================================================================

/// Minimum touch target size for accessibility (44x44 on mobile, 32x32 on desktop).
pub const MIN_TOUCH_TARGET: f32 = 32.0;

/// Standard button height.
pub const BUTTON_HEIGHT: f32 = 36.0;

/// Large button height.
pub const BUTTON_HEIGHT_LG: f32 = 44.0;

/// Small button height.
pub const BUTTON_HEIGHT_SM: f32 = 28.0;

/// Input field height.
pub const INPUT_HEIGHT: f32 = 40.0;

// ============================================================================
// Z-index / layer ordering
// ============================================================================

/// Toast notification z-order.
pub const Z_TOAST: egui::Order = egui::Order::Foreground;

/// Modal backdrop z-order.
pub const Z_MODAL_BACKDROP: egui::Order = egui::Order::Foreground;

/// Modal window z-order.
pub const Z_MODAL_WINDOW: egui::Order = egui::Order::Foreground;

/// Dropdown/popover z-order.
pub const Z_DROPDOWN: egui::Order = egui::Order::Foreground;
