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
}

impl FontIdExt for FontId {
    fn size(mut self, size: f32) -> Self {
        self.size = size;
        self
    }
}

// ============================================================================
// Theme mode (thread-local – GUI is single-threaded)
// ============================================================================

thread_local! {
    static IS_DARK: Cell<bool> = const { Cell::new(true) };
    static REDUCED_MOTION: Cell<bool> = const { Cell::new(false) };
}

/// Set the active theme mode.
pub fn set_dark_mode(dark: bool) {
    IS_DARK.with(|c| c.set(dark));
}

/// Query the active theme mode.
pub fn is_dark_mode() -> bool {
    IS_DARK.with(|c| c.get())
}

/// Set reduced-motion preference.
pub fn set_reduced_motion(reduced: bool) {
    REDUCED_MOTION.with(|c| c.set(reduced));
}

/// Query reduced-motion preference.
pub fn is_reduced_motion() -> bool {
    REDUCED_MOTION.with(|c| c.get())
}

/// Detect OS-level reduced-motion preference.
pub fn detect_reduced_motion() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Check macOS "Reduce motion" accessibility setting via defaults
        std::process::Command::new("defaults")
            .args(["read", "com.apple.universalaccess", "reduceMotion"])
            .output()
            .ok()
            .and_then(|out| String::from_utf8(out.stdout).ok())
            .map(|s| s.trim() == "1")
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
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
        Color32::from_rgb(16, 16, 20) // Softer dark - easier on OLED, retains depth
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
        Color32::from_rgb(12, 12, 16) // Slightly darker than primary for depth separation
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
/// Light mode: RGB(88,88,92) gives ~6.1:1 contrast on white (WCAG AAA).
#[inline]
pub fn text_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(99, 99, 102) // System Gray 2
    } else {
        Color32::from_rgb(88, 88, 92) // WCAG AAA contrast (~6.1:1 on white)
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
/// Small element rounding (checkboxes, inline tags, hover backgrounds).
pub const ROUNDING_SM: u8 = 4;
/// Medium element rounding (tooltips, pagination buttons, focus rings).
pub const ROUNDING_MD: u8 = 6;
/// Large element rounding (enrollment logo, hero buttons).
pub const ROUNDING_LG: u8 = 10;
/// Badge rounding radius (pill-shaped).
pub const BADGE_ROUNDING: u8 = 100;

// ============================================================================
// Badge color helpers — Apple-inspired soft tinted badges
// ============================================================================

/// Badge background: soft tinted wash of the semantic color.
#[inline]
pub fn badge_bg(color: Color32) -> Color32 {
    if is_dark_mode() {
        color.linear_multiply(0.15)
    } else {
        color.linear_multiply(0.10)
    }
}

/// Badge text: readable color with strong contrast on `badge_bg()`.
///
/// Dark mode: use the semantic color directly (bright on dark bg).
/// Light mode: darken the semantic color for WCAG-friendly contrast.
#[inline]
pub fn badge_text(color: Color32) -> Color32 {
    if is_dark_mode() {
        color
    } else {
        // Darken: blend toward black for readability on light tinted bg
        // Using 0.45 instead of 0.65 for deeper professional contrast (COMEX-ready)
        Color32::from_rgb(
            (color.r() as f32 * 0.45) as u8,
            (color.g() as f32 * 0.45) as u8,
            (color.b() as f32 * 0.45) as u8,
        )
    }
}

/// Badge border: subtle definition line.
#[inline]
pub fn badge_border(color: Color32) -> Color32 {
    if is_dark_mode() {
        color.linear_multiply(0.25)
    } else {
        color.linear_multiply(0.20)
    }
}


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
/// Badge/tinted backgrounds.
pub const OPACITY_TINT: f32 = 0.15;
/// Muted (disabled elements, backgrounds).
pub const OPACITY_MUTED: f32 = 0.25;
/// Moderate (overlay effects, grid lines, secondary fills).
pub const OPACITY_MODERATE: f32 = 0.3;
/// Disabled interactive elements.
pub const OPACITY_DISABLED: f32 = 0.4;
/// Medium (secondary hover, inactive chip text).
pub const OPACITY_MEDIUM: f32 = 0.5;
/// Hover multiplier for inactive chip borders.
pub const OPACITY_HOVER_SOFT: f32 = 0.6;
/// Pressed/active states on colored buttons.
pub const OPACITY_PRESSED: f32 = 0.7;
/// Hover state on colored backgrounds (destructive, etc.).
pub const OPACITY_HOVER: f32 = 0.9;
/// Strong (active states, emphasis).
pub const OPACITY_STRONG: f32 = 0.85;

// ============================================================================
// Border width constants
// ============================================================================

/// Hairline border (subtle separators, button groups).
pub const BORDER_HAIRLINE: f32 = 0.5;
/// Standard thin border.
pub const BORDER_THIN: f32 = 1.0;
/// Medium border (focus rings, emphasis).
pub const BORDER_MEDIUM: f32 = 1.5;
/// Thick border (strong focus indicators).
pub const BORDER_THICK: f32 = 2.0;

// ============================================================================
// Card hover glow constants
// ============================================================================

/// Glow line inset from card edges (main line).
pub const CARD_GLOW_INSET: f32 = 10.0;
/// Glow outer line inset from card edges (softer outer glow).
pub const CARD_GLOW_OUTER_INSET: f32 = 5.0;
/// Glow main line stroke width.
pub const CARD_GLOW_STROKE: f32 = 2.5;
/// Glow outer line stroke width.
pub const CARD_GLOW_OUTER_STROKE: f32 = 4.0;

// ============================================================================
// Icon size constants
// ============================================================================

/// Extra-small icon (inline badges, status dots).
pub const ICON_XS: f32 = 12.0;
/// Small icon (list items, compact buttons).
pub const ICON_SM: f32 = 16.0;
/// Medium icon (standard buttons, navigation).
pub const ICON_MD: f32 = 20.0;
/// Large icon (FAB buttons, headers, modal icons).
pub const ICON_LG: f32 = 24.0;
/// Extra-large icon (hero sections, empty states).
pub const ICON_XL: f32 = 32.0;

// ============================================================================
// Window / layout constants
// ============================================================================

/// Default window width.
pub const WINDOW_WIDTH: f32 = 1280.0;
/// Default window height.
pub const WINDOW_HEIGHT: f32 = 750.0;
/// Minimum window width.
pub const WINDOW_MIN_WIDTH: f32 = 800.0;
/// Minimum window height.
pub const WINDOW_MIN_HEIGHT: f32 = 600.0;
/// Tray popup width (satellite mode).
pub const TRAY_WIDTH: f32 = 320.0;
/// Tray popup height (satellite mode).
pub const TRAY_HEIGHT: f32 = 480.0;

// ============================================================================
// Backdrop / overlay constants
// ============================================================================

/// Modal backdrop alpha (0-255).
pub const BACKDROP_ALPHA: u8 = 180;

// ============================================================================
// Table constants
// ============================================================================

/// Minimum table row height for readability and touch targets.
pub const TABLE_ROW_HEIGHT: f32 = 36.0;
/// Data table row height (generous padding for premium feel).
pub const TABLE_DATA_ROW_HEIGHT: f32 = 48.0;
/// Data table header height.
pub const TABLE_HEADER_HEIGHT: f32 = 44.0;
/// Data table empty state height.
pub const TABLE_EMPTY_HEIGHT: f32 = 120.0;
/// Alternating row tint alpha (increased for better visibility).
pub const TABLE_ALT_ROW_ALPHA: u8 = 12;

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

/// Fast animation (buttons, micro-interactions) - 150ms.
pub const ANIM_FAST: f32 = 0.15;
/// Normal animation (modals, panels, transitions) - 250ms.
pub const ANIM_NORMAL: f32 = 0.25;
/// Slow animation (page transitions, skeletons, emphasis) - 400ms.
pub const ANIM_SLOW: f32 = 0.40;

/// Skeleton shimmer animation speed (radians per second).
pub const ANIM_SKELETON_SPEED: f32 = 1.5;
/// Spinner rotation speed (rotations per second).
pub const ANIM_SPINNER_SPEED: f64 = 1.5;
/// Breathing/pulse animation speed (radians per second).
pub const ANIM_PULSE_SPEED: f32 = 1.2;

/// Default toast notification display duration (info/success).
pub const TOAST_DURATION_SECS: f64 = 3.0;
/// Longer toast duration for warnings.
pub const TOAST_DURATION_WARNING_SECS: f64 = 4.5;
/// Longer toast duration for errors (need more time to read).
pub const TOAST_DURATION_ERROR_SECS: f64 = 6.0;

/// Delay before showing skeleton loading (ms). Prevents flash for fast loads.
pub const SKELETON_DELAY_MS: u64 = 200;

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
pub fn premium_shadow(blur: u8, alpha: u8) -> Shadow {
    Shadow {
        offset: [0, 4], // Slight vertical offset
        blur,
        spread: 0,
        color: Color32::from_black_alpha(alpha),
    }
}

// ============================================================================
// Elevation shadow system (5 levels — Apple/Material-inspired)
// ============================================================================

/// Level 1: Subtle hover feedback, small interactive elements.
pub fn shadow_sm() -> Shadow {
    if is_dark_mode() {
        premium_shadow(4, 12)
    } else {
        premium_shadow(4, 8)
    }
}

/// Level 2: Cards, raised panels, hover on cards.
pub fn shadow_md() -> Shadow {
    if is_dark_mode() {
        premium_shadow(8, 24)
    } else {
        premium_shadow(8, 16)
    }
}

/// Level 3: Elevated cards, floating buttons, dropdown menus.
pub fn shadow_lg() -> Shadow {
    if is_dark_mode() {
        premium_shadow(16, 48)
    } else {
        premium_shadow(12, 32)
    }
}

/// Level 4: Modals, dialog windows.
pub fn shadow_xl() -> Shadow {
    if is_dark_mode() {
        premium_shadow(24, 80)
    } else {
        premium_shadow(20, 48)
    }
}

/// Level 5: Top-level windows, full-screen overlays.
pub fn shadow_2xl() -> Shadow {
    if is_dark_mode() {
        premium_shadow(40, 96)
    } else {
        premium_shadow(32, 64)
    }
}

/// Helper for a subtle glow effect around a rect.
pub fn glow_stroke(color: Color32) -> Stroke {
    Stroke::new(BORDER_THIN, color.linear_multiply(OPACITY_MEDIUM))
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

/// Type-safe severity color using the Severity enum.
pub fn severity_color_typed(severity: &crate::dto::Severity) -> Color32 {
    match severity {
        crate::dto::Severity::Critical => ERROR,
        crate::dto::Severity::High => SEVERITY_HIGH,
        crate::dto::Severity::Medium => SEVERITY_MEDIUM,
        crate::dto::Severity::Low => INFO,
        crate::dto::Severity::Info => text_secondary(),
    }
}

/// Color for a LogLevel value.
pub fn log_level_color(level: &crate::dto::LogLevel) -> Color32 {
    match level {
        crate::dto::LogLevel::Error => ERROR,
        crate::dto::LogLevel::Warn => WARNING,
        crate::dto::LogLevel::Info => INFO,
        crate::dto::LogLevel::Debug => text_secondary(),
        crate::dto::LogLevel::Trace => text_tertiary(),
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

/// Get a disabled version of a color.
pub fn disabled_color(color: Color32) -> Color32 {
    color.linear_multiply(OPACITY_DISABLED)
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

/// Minimum button width for consistent look.
pub const BUTTON_MIN_WIDTH: f32 = 120.0;

// ============================================================================
// Widget-specific sizing constants
// ============================================================================

/// Toggle switch width (iOS-style).
pub const SWITCH_WIDTH: f32 = 44.0;
/// Toggle switch height (iOS-style).
pub const SWITCH_HEIGHT: f32 = 24.0;
/// Toggle switch thumb diameter.
pub const SWITCH_THUMB_SIZE: f32 = 18.0;

/// Floating action button diameter.
pub const FAB_SIZE: f32 = 56.0;

/// Progress bar height (default).
pub const PROGRESS_BAR_HEIGHT: f32 = 8.0;
/// Progress bar height (thin / indeterminate).
pub const PROGRESS_BAR_HEIGHT_THIN: f32 = 4.0;
/// Progress bar corner radius.
pub const PROGRESS_BAR_ROUNDING: u8 = 4;

/// Compliance gauge stroke width.
pub const GAUGE_STROKE: f32 = 8.0;
/// Circular progress indicator stroke width.
pub const CIRCULAR_PROGRESS_STROKE: f32 = 6.0;

/// Loading spinner diameter.
pub const SPINNER_SIZE: f32 = 12.0;
/// Loading spinner radius.
pub const SPINNER_RADIUS: f32 = 6.0;

/// Status dot diameter.
pub const STATUS_DOT_SIZE: f32 = 8.0;

/// Step indicator circle diameter.
pub const STEP_CIRCLE_SIZE: f32 = 24.0;

/// Tab bar row height.
pub const TAB_HEIGHT: f32 = 40.0;
/// Tab icon column width (icon + spacing).
pub const TAB_ICON_WIDTH: f32 = 20.0;
/// Tab badge pill width (underline style).
pub const TAB_BADGE_WIDTH: f32 = 28.0;

/// Dropdown option row height.
pub const DROPDOWN_ROW_HEIGHT: f32 = 32.0;
/// Dropdown popup max height before scrolling.
pub const DROPDOWN_MAX_HEIGHT: f32 = 200.0;

/// Modal default width.
pub const MODAL_WIDTH: f32 = 400.0;
/// Modal icon circle diameter.
pub const MODAL_ICON_SIZE: f32 = 48.0;
/// Modal header accent bar height.
pub const MODAL_HEADER_BAR: f32 = 4.0;

/// Empty-state hero icon size.
pub const EMPTY_STATE_ICON: f32 = 64.0;
/// Pending-state spinner size.
pub const PENDING_SPINNER_SIZE: f32 = 48.0;

/// Skeleton content card inner rounding.
pub const SKELETON_CARD_ROUNDING: u8 = 12;

// ── Toggle switch colors ──

/// Toggle switch off-state background (dark mode).
pub const SWITCH_OFF_DARK: Color32 = Color32::from_rgb(60, 60, 67);
/// Toggle switch off-state background (light mode).
pub const SWITCH_OFF_LIGHT: Color32 = Color32::from_rgb(200, 200, 206);

// ── Skeleton placeholder colors ──

/// Skeleton placeholder base color (dark mode).
pub const SKELETON_BASE_DARK: Color32 = Color32::from_rgb(45, 45, 50);
/// Skeleton placeholder base color (light mode).
pub const SKELETON_BASE_LIGHT: Color32 = Color32::from_rgb(230, 230, 235);
/// Skeleton placeholder highlight color (dark mode).
pub const SKELETON_HIGHLIGHT_DARK: Color32 = Color32::from_rgb(60, 60, 65);
/// Skeleton placeholder highlight color (light mode).
pub const SKELETON_HIGHLIGHT_LIGHT: Color32 = Color32::from_rgb(245, 245, 250);

// ── Avatar color palette ──

/// Avatar auto-generated color palette (10 pleasant hues).
pub const AVATAR_COLORS: [Color32; 10] = [
    Color32::from_rgb(99, 102, 241),  // Indigo
    Color32::from_rgb(139, 92, 246),  // Violet
    Color32::from_rgb(236, 72, 153),  // Pink
    Color32::from_rgb(244, 63, 94),   // Rose
    Color32::from_rgb(249, 115, 22),  // Orange
    Color32::from_rgb(234, 179, 8),   // Yellow
    Color32::from_rgb(34, 197, 94),   // Green
    Color32::from_rgb(20, 184, 166),  // Teal
    Color32::from_rgb(6, 182, 212),   // Cyan
    Color32::from_rgb(59, 130, 246),  // Blue
];

/// Threat radar visualization height.
pub const RADAR_HEIGHT: f32 = 360.0;
/// Threat radar main radius.
pub const RADAR_RADIUS: f32 = 140.0;

/// Tooltip max width.
pub const TOOLTIP_MAX_WIDTH: f32 = 320.0;

/// Sidebar navigation item height.
pub const NAV_ITEM_HEIGHT: f32 = 42.0;

/// Command palette popup width.
pub const COMMAND_PALETTE_WIDTH: f32 = 560.0;
/// Command palette item row height.
pub const COMMAND_PALETTE_ROW_HEIGHT: f32 = 48.0;
/// Command palette max results height before scrolling.
pub const COMMAND_PALETTE_MAX_HEIGHT: f32 = 400.0;

/// Toast notification corner radius.
pub const TOAST_ROUNDING: u8 = 12;
/// Toast notification height.
pub const TOAST_HEIGHT: f32 = 44.0;
/// Toast left accent bar width.
pub const TOAST_ACCENT_BAR: f32 = 4.0;

/// Disabled text on accent-colored surfaces (white @ ~59% opacity).
pub const DISABLED_ON_ACCENT_ALPHA: u8 = 150;
/// Subtle highlight/bevel alpha (white @ ~12% opacity).
pub const SUBTLE_HIGHLIGHT_ALPHA: u8 = 30;
/// Knob/thumb highlight base intensity for hover pulse.
pub const KNOB_HIGHLIGHT_BASE: f32 = 50.0;

/// Indeterminate progress bar animation speed (cycles per second).
pub const ANIM_INDETERMINATE_SPEED: f32 = 0.8;
/// Indeterminate progress bar fill ratio.
pub const INDETERMINATE_BAR_RATIO: f32 = 0.3;

/// Enrollment gradient background colors (center, outer).
#[inline]
pub fn enrollment_gradient() -> (Color32, Color32) {
    if is_dark_mode() {
        (
            Color32::from_rgb(20, 25, 35),  // Slight blueish center
            Color32::from_rgb(5, 5, 5),     // Deep outer
        )
    } else {
        (
            Color32::from_rgb(250, 250, 255),
            Color32::from_rgb(240, 240, 245),
        )
    }
}

/// Enrollment card/content max width.
pub const ENROLLMENT_CARD_WIDTH: f32 = 480.0;
/// Enrollment input card max width.
pub const ENROLLMENT_INPUT_WIDTH: f32 = 420.0;
/// Enrollment hero icon font size.
pub const ENROLLMENT_HERO_ICON: f32 = 48.0;
/// Enrollment logo max width.
pub const ENROLLMENT_LOGO_WIDTH: f32 = 120.0;
/// Enrollment logo glow radius.
pub const ENROLLMENT_GLOW_RADIUS: f32 = 80.0;

/// Sidebar gradient colors (returns top, bottom).
#[inline]
pub fn sidebar_gradient() -> (Color32, Color32) {
    if is_dark_mode() {
        (
            Color32::from_rgb(25, 25, 30),  // Lighter top (Spotlight)
            Color32::from_rgb(5, 5, 8),     // Deep bottom
        )
    } else {
        (
            Color32::from_rgb(245, 245, 250),
            Color32::from_rgb(230, 230, 235),
        )
    }
}

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
