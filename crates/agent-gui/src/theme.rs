// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

/// Detect OS-level dark-mode preference (prefers-color-scheme).
///
/// Returns `true` if the OS is set to dark mode.  Falls back to `true` (dark)
/// when detection is unavailable.
pub fn detect_os_dark_mode() -> bool {
    #[cfg(target_os = "macos")]
    {
        // macOS: "Dark" is returned when dark mode is active.
        agent_common::process::silent_command("defaults")
            .args(["read", "-g", "AppleInterfaceStyle"])
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                String::from_utf8(out.stdout).ok()
            })
            .map(|s| s.trim().eq_ignore_ascii_case("Dark"))
            .unwrap_or(true) // If key doesn't exist → light mode absent → assume dark
    }
    #[cfg(target_os = "windows")]
    {
        // Windows: AppsUseLightTheme = 0 means dark mode.
        agent_common::process::silent_command("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                "/v",
                "AppsUseLightTheme",
            ])
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                let text = String::from_utf8(out.stdout).ok()?;
                // Value is REG_DWORD: 0x0 = dark, 0x1 = light
                if text.contains("0x0") {
                    Some(true)
                } else {
                    Some(false)
                }
            })
            .unwrap_or(true)
    }
    #[cfg(target_os = "linux")]
    {
        // GNOME/GTK: "prefer-dark" in the color-scheme setting.
        agent_common::process::silent_command("gsettings")
            .args(["get", "org.gnome.desktop.interface", "color-scheme"])
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                String::from_utf8(out.stdout).ok()
            })
            .map(|s| s.trim().contains("dark"))
            .unwrap_or(true)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        true
    }
}

/// Detect OS-level reduced-motion preference.
pub fn detect_reduced_motion() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Check macOS "Reduce motion" accessibility setting via defaults
        agent_common::process::silent_command("defaults")
            .args(["read", "com.apple.universalaccess", "reduceMotion"])
            .output()
            .ok()
            .and_then(|out| String::from_utf8(out.stdout).ok())
            .map(|s| s.trim() == "1")
            .unwrap_or(false)
    }
    #[cfg(target_os = "windows")]
    {
        // Check Windows "Turn off all unnecessary animations" via registry
        agent_common::process::silent_command("reg")
            .args([
                "query",
                r"HKCU\Control Panel\Desktop",
                "/v",
                "UserPreferencesMask",
            ])
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                let text = String::from_utf8(out.stdout).ok()?;
                // UserPreferencesMask is a REG_BINARY; byte 1 bit 1 controls animations.
                // If the value contains hex bytes and bit 1 of byte[1] is 0 → animations off.
                // Fallback: check SPI_GETCLIENTAREAANIMATION via PowerShell as more reliable.
                drop(text);
                None
            })
            .unwrap_or_else(|| {
                // Fallback: PowerShell SystemParametersInfo query
                agent_common::process::silent_command("powershell")
                    .args([
                        "-NoProfile",
                        "-Command",
                        "[System.Windows.Forms.SystemInformation]::IsClientAreaAnimationEnabled",
                    ])
                    .output()
                    .ok()
                    .and_then(|out| String::from_utf8(out.stdout).ok())
                    .map(|s| s.trim().eq_ignore_ascii_case("false"))
                    .unwrap_or(false)
            })
    }
    #[cfg(target_os = "linux")]
    {
        // Check GNOME/GTK "enable-animations" setting via gsettings
        agent_common::process::silent_command("gsettings")
            .args(["get", "org.gnome.desktop.interface", "enable-animations"])
            .output()
            .ok()
            .and_then(|out| {
                if !out.status.success() {
                    return None;
                }
                String::from_utf8(out.stdout).ok()
            })
            .map(|s| s.trim() == "false")
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

// ============================================================================
// Brand / semantic colors
// ============================================================================
//
// Every hue exists twice: a bright variant tuned for dark surfaces and a
// deepened variant tuned for light surfaces. `readable_color()` picks the
// right one, so a call site never has to think about the active theme.
//
// Contrast contract (verified by the tests at the bottom of this file):
//   • text_primary / text_secondary  ≥ 7:1 (WCAG AAA) on every surface
//   • text_tertiary and semantic text ≥ 4.5:1 (WCAG AA) on every surface
//   • border()                        ≥ 3:1 (WCAG 1.4.11) on every surface

/// Primary accent — Sentinel sovereign blue.
pub const ACCENT: Color32 = Color32::from_rgb(38, 97, 239); // #2661EF
/// Accent tuned for text and icons on dark surfaces.
pub const ACCENT_LIGHT: Color32 = Color32::from_rgb(107, 165, 255); // #6BA5FF
/// Accent hover state (one step deeper than `ACCENT`).
pub const ACCENT_HOVER: Color32 = Color32::from_rgb(31, 85, 219); // #1F55DB
/// Accent pressed state.
pub const ACCENT_PRESSED: Color32 = Color32::from_rgb(26, 74, 196); // #1A4AC4
/// Accent tuned for text and icons on light surfaces.
pub const ACCENT_DEEP: Color32 = Color32::from_rgb(29, 79, 216); // #1D4FD8

/// Success — emerald.
pub const SUCCESS: Color32 = Color32::from_rgb(43, 201, 138); // #2BC98A
/// Warning — amber.
pub const WARNING: Color32 = Color32::from_rgb(245, 165, 36); // #F5A524
/// Error — signal red.
pub const ERROR: Color32 = Color32::from_rgb(255, 97, 99); // #FF6163
/// Info — azure.
pub const INFO: Color32 = Color32::from_rgb(56, 166, 245); // #38A6F5
/// Severity-high — saturated amber, one step hotter than `WARNING`.
pub const SEVERITY_HIGH: Color32 = Color32::from_rgb(255, 176, 32); // #FFB020
/// Severity-medium — burnt orange, visually distinct from `WARNING`.
pub const SEVERITY_MEDIUM: Color32 = Color32::from_rgb(255, 140, 58); // #FF8C3A
/// Assistant / AI — violet, the one hue reserved for machine reasoning.
pub const AI: Color32 = Color32::from_rgb(167, 139, 255); // #A78BFF

// Light-mode counterparts (deepened for ≥4.5:1 on white and near-white).
const ACCENT_ON_LIGHT: Color32 = Color32::from_rgb(29, 79, 216); // #1D4FD8
const SUCCESS_ON_LIGHT: Color32 = Color32::from_rgb(8, 108, 74); // #086C4A
const WARNING_ON_LIGHT: Color32 = Color32::from_rgb(138, 87, 0); // #8A5700
const ERROR_ON_LIGHT: Color32 = Color32::from_rgb(196, 38, 43); // #C4262B
const INFO_ON_LIGHT: Color32 = Color32::from_rgb(11, 107, 181); // #0B6BB5
const SEVERITY_HIGH_ON_LIGHT: Color32 = Color32::from_rgb(125, 81, 0); // #7D5100
const SEVERITY_MEDIUM_ON_LIGHT: Color32 = Color32::from_rgb(155, 63, 8); // #9B3F08
const AI_ON_LIGHT: Color32 = Color32::from_rgb(109, 75, 216); // #6D4BD8

// ============================================================================
// Surface colors (dynamic – depends on active theme)
// ============================================================================
//
// Six evenly-stepped surfaces form the elevation ladder. Each step is a small,
// *perceptually even* lift so depth reads as depth instead of as banding:
//
//   deep  <  sidebar  <  primary  <  secondary  <  tertiary  <  elevated

/// Window / app background — the canvas everything else sits on.
#[inline]
pub fn bg_primary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(12, 15, 21) // #0C0F15
    } else {
        Color32::from_rgb(242, 245, 250) // #F2F5FA
    }
}

/// Card / panel background (one step above the canvas).
#[inline]
pub fn bg_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(19, 22, 30) // #13161E
    } else {
        Color32::from_rgb(255, 255, 255) // #FFFFFF
    }
}

/// Elevated surface — popovers, menus, hovered rows, modals.
#[inline]
pub fn bg_elevated() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(35, 40, 51) // #232833
    } else {
        Color32::from_rgb(228, 233, 242) // #E4E9F2
    }
}

/// Tertiary surface — inputs, chips, segmented controls, table headers.
#[inline]
pub fn bg_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(26, 30, 40) // #1A1E28
    } else {
        Color32::from_rgb(237, 241, 247) // #EDF1F7
    }
}

/// Sidebar background — recessed relative to the canvas so the navigation
/// reads as chrome, not content.
#[inline]
pub fn bg_sidebar() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(9, 11, 17) // #090B11
    } else {
        Color32::from_rgb(247, 249, 252) // #F7F9FC
    }
}

/// Deep / inset background — terminal, canvas, code blocks.
#[inline]
pub fn bg_deep() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(5, 7, 11) // #05070B
    } else {
        Color32::from_rgb(239, 242, 248) // #EFF2F8
    }
}

// ============================================================================
// Text colors (dynamic)
// ============================================================================

/// Primary text (high emphasis) — ≥12.9:1 on every surface, WCAG AAA.
#[inline]
pub fn text_primary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(237, 240, 245) // #EDF0F5
    } else {
        Color32::from_rgb(16, 20, 28) // #10141C
    }
}

/// Secondary text (medium emphasis) — ≥6.3:1 on every surface, AAA on cards.
#[inline]
pub fn text_secondary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(180, 188, 201) // #B4BCC9
    } else {
        Color32::from_rgb(67, 75, 91) // #434B5B
    }
}

/// Tertiary text (low emphasis: timestamps, hints, units) — ≥4.5:1, WCAG AA.
///
/// Deliberately not AAA: forcing 7:1 here would collapse it onto
/// `text_secondary()` and destroy the three-step hierarchy. Weight and size
/// carry the rest of the distinction.
#[inline]
pub fn text_tertiary() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(147, 155, 169) // #939BA9
    } else {
        Color32::from_rgb(93, 102, 118) // #5D6676
    }
}

/// Text on accent-filled surfaces.
#[inline]
pub fn text_on_accent() -> Color32 {
    Color32::WHITE
}

/// Choose black or white text for maximum contrast on a given background.
///
/// Computes WCAG relative luminance and picks whichever (black or white)
/// yields the highest contrast ratio.
#[inline]
pub fn text_on_color(bg: Color32) -> Color32 {
    // Crossover: (1+0.05)/(lum+0.05) vs (lum+0.05)/(0+0.05) → lum ≈ 0.179
    if relative_luminance(bg) > 0.179 {
        Color32::BLACK
    } else {
        Color32::WHITE
    }
}

/// WCAG 2.x relative luminance (sRGB, BT.709 coefficients).
#[inline]
pub fn relative_luminance(color: Color32) -> f32 {
    fn srgb_lin(c: u8) -> f32 {
        let s = c as f32 / 255.0;
        if s <= 0.04045 {
            s / 12.92
        } else {
            ((s + 0.055) / 1.055).powf(2.4)
        }
    }
    0.2126 * srgb_lin(color.r()) + 0.7152 * srgb_lin(color.g()) + 0.0722 * srgb_lin(color.b())
}

/// WCAG contrast ratio between two opaque colors (1.0 … 21.0).
#[inline]
pub fn contrast_ratio(a: Color32, b: Color32) -> f32 {
    let (la, lb) = (relative_luminance(a), relative_luminance(b));
    let (hi, lo) = if la > lb { (la, lb) } else { (lb, la) };
    (hi + 0.05) / (lo + 0.05)
}

/// Accent-colored text — readable in both themes.
#[inline]
pub fn accent_text() -> Color32 {
    if is_dark_mode() {
        ACCENT_LIGHT
    } else {
        ACCENT_DEEP
    }
}

// ============================================================================
// Border / separator (dynamic)
// ============================================================================

/// Control border — meets WCAG 1.4.11 (≥3:1) on every surface.
///
/// Use for anything whose boundary carries meaning: inputs, secondary
/// buttons, checkboxes, focusable containers.
#[inline]
pub fn border() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(114, 123, 141) // #727B8D
    } else {
        Color32::from_rgb(121, 129, 143) // #79818F
    }
}

/// Decorative hairline — card edges, table rules, chrome seams.
///
/// Intentionally below the 3:1 control threshold: these edges describe
/// grouping, never a control, so subtlety wins.
#[inline]
pub fn border_subtle() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgb(43, 49, 62) // #2B313E
    } else {
        Color32::from_rgb(221, 227, 236) // #DDE3EC
    }
}

/// Separator line between groups of controls (≥3:1, WCAG 1.4.11).
#[inline]
pub fn separator() -> Color32 {
    border()
}

/// Theme-aware overlay color (white in dark mode, black in light mode).
/// Use with `.linear_multiply(alpha)` for consistent overlays.
#[inline]
pub fn overlay_color() -> Color32 {
    if is_dark_mode() {
        Color32::WHITE
    } else {
        Color32::BLACK
    }
}

// ============================================================================
// Spacing constants
// ============================================================================

/// Base spacing unit (4px).
pub const SPACE_MICRO: f32 = 2.0;
/// Extra-small spacing unit (4px).
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
/// Section spacing (48px) — between major blocks on a page.
pub const SPACE_2XL: f32 = 48.0;
/// Page spacing (64px) — around hero and empty states.
pub const SPACE_3XL: f32 = 64.0;

/// Sidebar width (expanded).
pub const SIDEBAR_WIDTH: f32 = 244.0;
/// Sidebar width when collapsed to an icon rail.
pub const SIDEBAR_RAIL_WIDTH: f32 = 64.0;
/// Window width below which the sidebar collapses to the rail on its own.
/// A 244px column on a 960px window leaves 690px for a data table.
pub const SIDEBAR_BREAKPOINT: f32 = 1120.0;
/// Global top bar height.
pub const TOPBAR_HEIGHT: f32 = 56.0;
/// Maximum content measure. Beyond this, tables and prose stop stretching and
/// centre instead — an unbounded line length is unreadable on wide displays.
pub const CONTENT_MAX_WIDTH: f32 = 1560.0;

/// Radius scale — one step per component scale, so nothing looks borrowed.
///
/// `XS` accent bars · `SM` chips and hover fills · `MD` inputs and small
/// buttons · `LG` buttons and menus · `XL` cards · `FULL` pills.
/// Extra-small element rounding (accent bars, tiny indicators).
pub const ROUNDING_XS: u8 = 3;
/// Small element rounding (checkboxes, inline tags, hover backgrounds).
pub const ROUNDING_SM: u8 = 6;
/// Medium element rounding (tooltips, pagination buttons, focus rings).
pub const ROUNDING_MD: u8 = 8;
/// Large element rounding (buttons, menus, drawers).
pub const ROUNDING_LG: u8 = 10;
/// Extra-large element rounding (cards, modals).
pub const ROUNDING_XL: u8 = 14;
/// Card rounding radius.
pub const CARD_ROUNDING: u8 = ROUNDING_XL;
/// Button rounding radius.
pub const BUTTON_ROUNDING: u8 = ROUNDING_LG;
/// Badge rounding radius (pill-shaped).
pub const BADGE_ROUNDING: u8 = 100;
/// Minimum badge height for consistent pill shape.
pub const BADGE_MIN_HEIGHT: f32 = 20.0;

/// Left accent indicator bar width (activity feed, timeline).
pub const ACCENT_BAR_WIDTH: f32 = 3.0;

// ============================================================================
// Color blending (public helper)
// ============================================================================

/// Public color blend: mix `base` → `tint` at `ratio` (0.0 = base, 1.0 = tint).
#[inline]
pub fn color_blend_pub(base: Color32, tint: Color32, ratio: f32) -> Color32 {
    color_blend(base, tint, ratio)
}

// ============================================================================
// Badge color helpers — Apple-inspired soft tinted badges
// ============================================================================

/// Blend two colors at a given ratio (opaque result).  `ratio=0` → pure base,
/// `ratio=1` → pure tint.
#[inline]
fn color_blend(base: Color32, tint: Color32, ratio: f32) -> Color32 {
    let inv = 1.0 - ratio;
    Color32::from_rgb(
        (base.r() as f32 * inv + tint.r() as f32 * ratio) as u8,
        (base.g() as f32 * inv + tint.g() as f32 * ratio) as u8,
        (base.b() as f32 * inv + tint.b() as f32 * ratio) as u8,
    )
}

/// Badge background: soft tinted wash of the semantic color.
///
/// Dark mode blends the hue into the tertiary surface; light mode blends it
/// into white. Either way the result is opaque, so badges stack predictably
/// over striped table rows.
#[inline]
pub fn badge_bg(color: Color32) -> Color32 {
    if is_dark_mode() {
        color_blend(bg_tertiary(), color, 0.16)
    } else {
        color_blend(Color32::WHITE, color, 0.13)
    }
}

/// Map a semantic color to the variant calibrated for the active theme.
///
/// The eight brand hues have hand-tuned light-mode counterparts (each verified
/// ≥4.5:1 on white); anything else falls back to a luminance-driven
/// adjustment so ad-hoc colors still stay legible.
#[inline]
fn theme_variant(color: Color32) -> Color32 {
    if is_dark_mode() {
        // The filled accent is too deep to read as text on a dark surface;
        // every other hue is already tuned for it.
        return if color == ACCENT { ACCENT_LIGHT } else { color };
    }
    match (color.r(), color.g(), color.b()) {
        (38, 97, 239) | (107, 165, 255) => ACCENT_ON_LIGHT, // ACCENT / ACCENT_LIGHT
        (43, 201, 138) => SUCCESS_ON_LIGHT,
        (245, 165, 36) => WARNING_ON_LIGHT,
        (255, 97, 99) => ERROR_ON_LIGHT,
        (56, 166, 245) => INFO_ON_LIGHT,
        (255, 176, 32) => SEVERITY_HIGH_ON_LIGHT,
        (255, 140, 58) => SEVERITY_MEDIUM_ON_LIGHT,
        (167, 139, 255) => AI_ON_LIGHT,
        _ => darken_for_light_bg(color),
    }
}

/// Darken an arbitrary color until it clears WCAG AA on a white surface.
///
/// Used only for colors outside the brand palette (avatar hues, plot series,
/// user-supplied tints); the brand hues use their hand-tuned counterparts.
fn darken_for_light_bg(color: Color32) -> Color32 {
    const TARGET: f32 = 4.6; // A hair over AA, to survive rounding.
    let mut candidate = color;
    for step in 1..=24 {
        if contrast_ratio(candidate, Color32::WHITE) >= TARGET {
            break;
        }
        let factor = 1.0 - (step as f32 * 0.04);
        candidate = Color32::from_rgb(
            (color.r() as f32 * factor) as u8,
            (color.g() as f32 * factor) as u8,
            (color.b() as f32 * factor) as u8,
        );
    }
    candidate
}

/// Badge text: readable color with strong contrast on `badge_bg()`.
#[inline]
pub fn badge_text(color: Color32) -> Color32 {
    theme_variant(color)
}

/// Badge border: subtle opaque definition line.
#[inline]
pub fn badge_border(color: Color32) -> Color32 {
    if is_dark_mode() {
        color_blend(bg_tertiary(), color, 0.32)
    } else {
        color_blend(Color32::WHITE, color, 0.28)
    }
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
pub const OPACITY_SUBTLE: f32 = 0.15;
/// Badge/tinted backgrounds.
pub const OPACITY_TINT: f32 = 0.15;
/// Muted (disabled elements, backgrounds).
pub const OPACITY_MUTED: f32 = 0.25;
/// Moderate (overlay effects, grid lines, secondary fills).
pub const OPACITY_MODERATE: f32 = 0.3;
/// Disabled interactive elements (increased for better visibility).
pub const OPACITY_DISABLED: f32 = 0.55;
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
/// Double extra-large icon (about hero, network splash).
pub const ICON_2XL: f32 = 48.0;
/// Inline icon in body text context.
pub const ICON_INLINE: f32 = 14.0;
/// Micro icon (tiny status indicators, breathing dots).
pub const ICON_MICRO: f32 = 6.0;

// ============================================================================
// Window / layout constants
// ============================================================================

/// Default window width.
pub const WINDOW_WIDTH: f32 = 1360.0;
/// Default window height.
pub const WINDOW_HEIGHT: f32 = 820.0;
/// Minimum window width.
pub const WINDOW_MIN_WIDTH: f32 = 960.0;
/// Minimum window height.
pub const WINDOW_MIN_HEIGHT: f32 = 600.0;
/// Tray popup width (satellite mode).
pub const TRAY_WIDTH: f32 = 320.0;
/// Tray popup height (satellite mode).
pub const TRAY_HEIGHT: f32 = 480.0;
/// Tray popup max height (expanded view).
pub const TRAY_POPUP_MAX_HEIGHT: f32 = 500.0;
/// Tray popup min width.
pub const TRAY_POPUP_MIN_WIDTH: f32 = 350.0;
/// Tray popup max width.
pub const TRAY_POPUP_MAX_WIDTH: f32 = 600.0;
/// Tray radar visualization size.
pub const TRAY_RADAR_SIZE: f32 = 240.0;
/// Tray satellite quick-stat card width.
pub const TRAY_SATELLITE_CARD_WIDTH: f32 = 135.0;

// ============================================================================
// Backdrop / overlay constants
// ============================================================================

/// Modal backdrop alpha (0-255).
pub const BACKDROP_ALPHA: u8 = 168;

/// Backdrop color (navy-tinted in dark mode for brand depth, black in light mode).
#[inline]
pub fn backdrop_color(alpha: u8) -> Color32 {
    if is_dark_mode() {
        // Navy-tinted backdrop matching the dark theme palette
        Color32::from_rgba_premultiplied(4, 6, 14, alpha)
    } else {
        Color32::from_black_alpha(alpha)
    }
}

// ============================================================================
// Table constants
// ============================================================================

/// Minimum table row height for readability and touch targets.
pub const TABLE_ROW_HEIGHT: f32 = 36.0;
/// Compact row height for dense / terminal-like tables.
pub const TABLE_COMPACT_ROW_HEIGHT: f32 = 22.0;
/// Data table row height (generous padding for premium feel).
pub const TABLE_DATA_ROW_HEIGHT: f32 = 44.0;
/// Data table header height (used by DataTable widget).
pub const TABLE_HEADER_HEIGHT: f32 = 38.0;
/// Inline / compact table header height (raw TableBuilder tables).
pub const TABLE_INLINE_HEADER_HEIGHT: f32 = 30.0;
/// Data table empty state height.
pub const TABLE_EMPTY_HEIGHT: f32 = 120.0;
/// Alternating row tint alpha (visible stripe differentiation).
pub const TABLE_ALT_ROW_ALPHA: u8 = 10;
/// Blend of the overlay colour into the surface for alternate table rows.
pub const TABLE_ALT_ROW_BLEND: f32 = 0.04;

/// Get alternating row background color.
pub fn table_row_bg(row_index: usize) -> Color32 {
    if row_index.is_multiple_of(2) {
        Color32::TRANSPARENT
    } else {
        // Opaque: white at 4 % alpha composited in linear space came out as a
        // slab of mid-grey, which is what every striped table looked like.
        color_blend(bg_secondary(), overlay_color(), TABLE_ALT_ROW_BLEND)
    }
}

/// Get row hover highlight color (visible semi-transparent tint).
pub fn table_row_hover() -> Color32 {
    hover_bg()
}

// ============================================================================
// Glass morphism helpers
// ============================================================================

/// Frosted surface for floating chrome (command palette, tray popup).
pub fn glass_card_bg() -> Color32 {
    if is_dark_mode() {
        Color32::from_rgba_premultiplied(19, 22, 30, 232)
    } else {
        Color32::from_rgba_premultiplied(255, 255, 255, 240)
    }
}

/// Lit edge of a glass surface (top-left).
pub fn glass_border_top() -> Color32 {
    if is_dark_mode() {
        Color32::from_white_alpha(20)
    } else {
        Color32::from_white_alpha(200)
    }
}

/// Shaded edge of a glass surface (bottom-right).
pub fn glass_border_bottom() -> Color32 {
    if is_dark_mode() {
        Color32::from_black_alpha(40)
    } else {
        Color32::from_black_alpha(16)
    }
}

// ============================================================================
// Animation helpers
// ============================================================================

/// Duration for page fade transitions.
pub const PAGE_TRANSITION_DURATION: f32 = 0.18;

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
// Typography — Inter (UI) + JetBrains Mono (data), 3-weight system
// ============================================================================
//
// egui has no synthetic bolding: a weight is a *font family*. The design
// system therefore registers one family per weight and exposes semantic
// helpers instead of raw `FontId::proportional()` calls, so weight and size
// always travel together and stay consistent across the 20 pages.
//
// Scale (1.25 modular, 13px base — the density a dense security console
// needs while staying above the 11px accessibility floor):
//
//   micro 10 · caption 11 · label 11 · body_sm 12 · body 13 · body_lg 15
//   h3 16 · h2 20 · h1 26 · display 34
//
// Numerals are tabular in every weight (the `tnum` feature is baked into the
// shipped subsets), so metric cards and table columns never jitter as values
// change.

/// Family name for the medium (500) UI weight.
pub const FAMILY_UI_MEDIUM: &str = "ui_medium";
/// Family name for the semibold (600) UI weight.
pub const FAMILY_UI_SEMIBOLD: &str = "ui_semibold";
/// Family name for the bold (700) UI weight.
pub const FAMILY_UI_BOLD: &str = "ui_bold";
/// Family name for the medium (500) monospace weight.
pub const FAMILY_MONO_MEDIUM: &str = "mono_medium";

/// Inter Regular (400) — body copy, long-form text.
#[inline]
pub fn family_regular() -> egui::FontFamily {
    egui::FontFamily::Proportional
}

/// Inter Medium (500) — labels, table cells, secondary emphasis.
#[inline]
pub fn family_medium() -> egui::FontFamily {
    egui::FontFamily::Name(FAMILY_UI_MEDIUM.into())
}

/// Inter SemiBold (600) — headings, buttons, active navigation.
#[inline]
pub fn family_semibold() -> egui::FontFamily {
    egui::FontFamily::Name(FAMILY_UI_SEMIBOLD.into())
}

/// Inter Bold (700) — display numbers, hero titles.
#[inline]
pub fn family_bold() -> egui::FontFamily {
    egui::FontFamily::Name(FAMILY_UI_BOLD.into())
}

/// JetBrains Mono Medium (500) — emphasised technical values.
#[inline]
pub fn family_mono_medium() -> egui::FontFamily {
    egui::FontFamily::Name(FAMILY_MONO_MEDIUM.into())
}

// ── Type scale ──────────────────────────────────────────────────────────

/// Size step: micro annotations (10px) — use sparingly, never for prose.
pub const TEXT_MICRO: f32 = 10.0;
/// Size step: caption / label (11px) — the accessibility floor.
pub const TEXT_CAPTION: f32 = 11.0;
/// Size step: dense body (12px) — table cells, chips.
pub const TEXT_BODY_SM: f32 = 12.0;
/// Size step: body (13px) — the default reading size.
pub const TEXT_BODY: f32 = 13.0;
/// Size step: lead body (15px) — subtitles, drawer intros.
pub const TEXT_BODY_LG: f32 = 15.0;
/// Size step: section heading (16px).
pub const TEXT_H3: f32 = 16.0;
/// Size step: page / card title (20px).
pub const TEXT_H2: f32 = 20.0;
/// Size step: page display title (26px).
pub const TEXT_H1: f32 = 26.0;
/// Size step: hero / splash display (34px).
pub const TEXT_DISPLAY: f32 = 34.0;

// ── Semantic helpers ────────────────────────────────────────────────────

/// Hero / splash display type (34px bold).
pub fn font_display() -> FontId {
    FontId::new(TEXT_DISPLAY, family_bold())
}

/// Page display title (26px bold).
pub fn font_h1() -> FontId {
    FontId::new(TEXT_H1, family_bold())
}

/// Page / card title (20px semibold).
pub fn font_h2() -> FontId {
    FontId::new(TEXT_H2, family_semibold())
}

/// Section heading (16px semibold).
pub fn font_h3() -> FontId {
    FontId::new(TEXT_H3, family_semibold())
}

/// Page title (20px semibold) — alias kept for call-site stability.
pub fn font_title() -> FontId {
    font_h2()
}

/// Section heading (16px semibold).
pub fn font_heading() -> FontId {
    font_h3()
}

/// Body text (13px regular) — the default.
pub fn font_body() -> FontId {
    FontId::new(TEXT_BODY, family_regular())
}

/// Body text with medium weight (13px) — emphasis inside dense layouts.
pub fn font_body_medium() -> FontId {
    FontId::new(TEXT_BODY, family_medium())
}

/// Body text with semibold weight (13px) — buttons, active items.
pub fn font_body_strong() -> FontId {
    FontId::new(TEXT_BODY, family_semibold())
}

/// Lead body (15px regular) — subtitles and short intros.
pub fn font_body_lg() -> FontId {
    FontId::new(TEXT_BODY_LG, family_regular())
}

/// Dense body (12px regular) — table cells, secondary rows.
pub fn font_body_sm() -> FontId {
    FontId::new(TEXT_BODY_SM, family_regular())
}

/// Dense body, medium weight (12px) — table headers, chips.
pub fn font_body_sm_medium() -> FontId {
    FontId::new(TEXT_BODY_SM, family_medium())
}

/// Small text (11px regular).
pub fn font_small() -> FontId {
    FontId::new(TEXT_CAPTION, family_regular())
}

/// Caption (11px regular) — timestamps, helper text.
pub fn font_caption() -> FontId {
    font_small()
}

/// Minimum readable font (11px) — accessibility floor.
pub fn font_min() -> FontId {
    font_small()
}

/// Label (11px medium) — form labels, eyebrow text, uppercase section titles.
pub fn font_label() -> FontId {
    FontId::new(TEXT_CAPTION, family_medium())
}

/// Micro annotation (10px medium) — axis ticks, badge counters.
pub fn font_micro() -> FontId {
    FontId::new(TEXT_MICRO, family_medium())
}

/// Dashboard stat (20px semibold, tabular figures).
pub fn font_stat() -> FontId {
    FontId::new(TEXT_H2, family_semibold())
}

/// Card metric value (26px bold, tabular figures).
pub fn font_card_value() -> FontId {
    FontId::new(TEXT_H1, family_bold())
}

/// COMEX-ready header (30px bold).
pub fn font_comex() -> FontId {
    FontId::new(30.0, family_bold())
}

/// Splash screen title (34px bold).
pub fn font_splash() -> FontId {
    font_display()
}

/// Monospace (12px) — hashes, IPs, CVE ids, paths, terminal output.
pub fn font_mono() -> FontId {
    FontId::new(TEXT_BODY_SM, egui::FontFamily::Monospace)
}

/// Small monospace (11px).
pub fn font_mono_sm() -> FontId {
    FontId::new(TEXT_CAPTION, egui::FontFamily::Monospace)
}

/// Monospace with medium weight (12px) — emphasised technical values.
pub fn font_mono_strong() -> FontId {
    FontId::new(TEXT_BODY_SM, family_mono_medium())
}

/// Icon glyph at an explicit size (Font Awesome resolves through the fallback
/// chain of every registered family).
pub fn font_icon(size: f32) -> FontId {
    FontId::new(size, family_regular())
}

/// Icon glyph rendered at semibold optical weight, for active/selected states.
pub fn font_icon_strong(size: f32) -> FontId {
    FontId::new(size, family_semibold())
}

// ============================================================================
// Style application
// ============================================================================

/// Register the application's font stack.
///
/// Three families are layered so that every glyph resolves without tofu:
/// 1. **Inter** (subset, `tnum` baked in) for UI text — one registered family
///    per weight, because egui cannot synthesise bold.
/// 2. **JetBrains Mono NL** for technical values — ligature-free on purpose so
///    hashes, CVE ids and IPs read literally.
/// 3. **Font Awesome 6 Solid** plus an OS symbol font as fallbacks on every
///    family, so an icon glyph works inside any weight.
pub fn configure_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();

    // ── Embedded UI + data typefaces ────────────────────────────────
    static INTER_REGULAR: &[u8] = include_bytes!("../assets/fonts/Inter-Regular.ttf");
    static INTER_MEDIUM: &[u8] = include_bytes!("../assets/fonts/Inter-Medium.ttf");
    static INTER_SEMIBOLD: &[u8] = include_bytes!("../assets/fonts/Inter-SemiBold.ttf");
    static INTER_BOLD: &[u8] = include_bytes!("../assets/fonts/Inter-Bold.ttf");
    static MONO_REGULAR: &[u8] = include_bytes!("../assets/fonts/JetBrainsMono-Regular.ttf");
    static MONO_MEDIUM: &[u8] = include_bytes!("../assets/fonts/JetBrainsMono-Medium.ttf");
    static FA_SOLID: &[u8] = include_bytes!("../assets/fonts/fa-solid-900.ttf");

    // Inter's hhea ascent (0.97em) is generous; trimming the line box keeps
    // dense tables and nav rows optically centred without clipping accents.
    let ui_tweak = egui::FontTweak {
        scale: 1.0,
        y_offset_factor: -0.01,
        y_offset: 0.0,
        baseline_offset_factor: -0.0333,
    };
    // Font Awesome's cap height (0.84em) overshoots Inter's (0.73em); nudging
    // the glyphs down aligns icon centres with the text they label.
    let icon_tweak = egui::FontTweak {
        scale: 0.92,
        y_offset_factor: 0.04,
        y_offset: 0.0,
        baseline_offset_factor: 0.0,
    };

    for (name, bytes) in [
        ("ui_regular", INTER_REGULAR),
        (FAMILY_UI_MEDIUM, INTER_MEDIUM),
        (FAMILY_UI_SEMIBOLD, INTER_SEMIBOLD),
        (FAMILY_UI_BOLD, INTER_BOLD),
    ] {
        fonts.font_data.insert(
            name.to_owned(),
            std::sync::Arc::new(egui::FontData::from_static(bytes).tweak(ui_tweak)),
        );
    }
    for (name, bytes) in [
        ("mono_regular", MONO_REGULAR),
        (FAMILY_MONO_MEDIUM, MONO_MEDIUM),
    ] {
        fonts
            .font_data
            .insert(name.to_owned(), egui::FontData::from_static(bytes).into());
    }
    fonts.font_data.insert(
        "fa_solid".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(FA_SOLID).tweak(icon_tweak)),
    );

    // ── System symbol font (last-resort Unicode fallback) ───────────
    let system_symbols = load_system_symbol_font();
    if let Some(data) = system_symbols {
        fonts.font_data.insert(
            "system_symbols".to_owned(),
            egui::FontData::from_owned(data).into(),
        );
    }
    let has_symbols = fonts.font_data.contains_key("system_symbols");

    // ── Families: primary face first, then the shared fallback chain ─
    let fallbacks = |primary: &str| {
        let mut chain = vec![primary.to_owned(), "fa_solid".to_owned()];
        if has_symbols {
            chain.push("system_symbols".to_owned());
        }
        // egui's bundled faces close the chain so an unexpected codepoint
        // degrades to a glyph rather than a blank box.
        chain.extend([
            "Ubuntu-Light".to_owned(),
            "NotoEmoji-Regular".to_owned(),
            "emoji-icon-font".to_owned(),
        ]);
        chain
    };

    fonts
        .families
        .insert(egui::FontFamily::Proportional, fallbacks("ui_regular"));
    fonts
        .families
        .insert(egui::FontFamily::Monospace, fallbacks("mono_regular"));
    for name in [FAMILY_UI_MEDIUM, FAMILY_UI_SEMIBOLD, FAMILY_UI_BOLD] {
        fonts
            .families
            .insert(egui::FontFamily::Name(name.into()), fallbacks(name));
    }
    fonts.families.insert(
        egui::FontFamily::Name(FAMILY_MONO_MEDIUM.into()),
        fallbacks(FAMILY_MONO_MEDIUM),
    );

    ctx.set_fonts(fonts);
}

/// Locate an OS-provided symbol font for codepoints outside the bundled subsets.
fn load_system_symbol_font() -> Option<Vec<u8>> {
    #[cfg(target_os = "macos")]
    const PATHS: &[&str] = &[
        "/System/Library/Fonts/Apple Symbols.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ];
    #[cfg(target_os = "windows")]
    const PATHS: &[&str] = &["C:\\Windows\\Fonts\\seguisym.ttf"];
    #[cfg(target_os = "linux")]
    const PATHS: &[&str] = &[
        "/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf",
        "/usr/share/fonts/noto/NotoSansSymbols2-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ];
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    const PATHS: &[&str] = &[];

    PATHS.iter().find_map(|path| std::fs::read(path).ok())
}

/// Apply the Sentinel theme to an egui context.
///
/// Pass `true` for the dark theme, `false` for the light theme.
pub fn apply_theme(ctx: &egui::Context, dark: bool) {
    // Update global mode first so that color functions return the right values.
    set_dark_mode(dark);

    let mut style = Style::default();

    // ── Text styles ────────────────────────────────────────────────
    // `Heading` and `Button` map to the semibold family so egui's own
    // widgets inherit the type system instead of falling back to regular.
    style.text_styles.insert(TextStyle::Heading, font_h3());
    style.text_styles.insert(TextStyle::Body, font_body());
    style
        .text_styles
        .insert(TextStyle::Button, font_body_medium());
    style.text_styles.insert(TextStyle::Small, font_small());
    style.text_styles.insert(TextStyle::Monospace, font_mono());

    // ── Spacing ────────────────────────────────────────────────────
    style.spacing.item_spacing = Vec2::new(SPACE_SM, SPACE_SM);
    style.spacing.window_margin = Margin::same(SPACE as i8);
    style.spacing.menu_margin = Margin::same(SPACE_XS as i8);
    style.spacing.button_padding = Vec2::new(SPACE_MD, SPACE_SM);
    style.spacing.indent = SPACE_LG;
    style.spacing.interact_size = Vec2::new(MIN_TOUCH_TARGET, BUTTON_HEIGHT_SM);
    style.spacing.icon_width = ICON_SM;
    style.spacing.icon_width_inner = ICON_XS;
    style.spacing.tooltip_width = TOOLTIP_MAX_WIDTH;

    // Overlay scrollbars: thin, floating, out of the way until pointed at.
    style.spacing.scroll = egui::style::ScrollStyle {
        bar_width: 8.0,
        handle_min_length: 24.0,
        bar_inner_margin: 4.0,
        bar_outer_margin: 2.0,
        floating: true,
        floating_width: 4.0,
        floating_allocated_width: 0.0,
        foreground_color: false,
        dormant_background_opacity: 0.0,
        active_background_opacity: 0.25,
        interact_background_opacity: 0.5,
        dormant_handle_opacity: 0.28,
        active_handle_opacity: 0.7,
        interact_handle_opacity: 0.95,
    };

    // ── Visuals ────────────────────────────────────────────────────
    let mut visuals = if dark {
        Visuals::dark()
    } else {
        Visuals::light()
    };

    visuals.panel_fill = bg_primary();
    visuals.window_fill = bg_secondary();
    visuals.override_text_color = None;
    visuals.text_cursor.stroke = Stroke::new(BORDER_MEDIUM, accent_text());

    let control_radius = CornerRadius::same(BUTTON_ROUNDING);

    // Non-interactive: labels, separators, frames.
    visuals.widgets.noninteractive.bg_fill = bg_secondary();
    visuals.widgets.noninteractive.weak_bg_fill = bg_secondary();
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, text_secondary());
    visuals.widgets.noninteractive.corner_radius = control_radius;
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(BORDER_HAIRLINE, border_subtle());

    // Inactive: the resting state of buttons and inputs. A visible boundary
    // here is what WCAG 1.4.11 asks for, so the border is the strong one.
    visuals.widgets.inactive.bg_fill = bg_tertiary();
    visuals.widgets.inactive.weak_bg_fill = bg_tertiary();
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, text_primary());
    visuals.widgets.inactive.corner_radius = control_radius;
    visuals.widgets.inactive.bg_stroke = Stroke::new(BORDER_HAIRLINE, border_subtle());
    visuals.widgets.inactive.expansion = 0.0;

    // Hovered: accent-tinted wash plus a hint of accent in the border.
    visuals.widgets.hovered.bg_fill = hover_bg();
    visuals.widgets.hovered.weak_bg_fill = hover_bg();
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, text_primary());
    visuals.widgets.hovered.corner_radius = control_radius;
    visuals.widgets.hovered.bg_stroke =
        Stroke::new(BORDER_THIN, ACCENT.linear_multiply(OPACITY_MODERATE));
    visuals.widgets.hovered.expansion = 0.0;

    // Active: pressed / engaged.
    visuals.widgets.active.bg_fill = ACCENT;
    visuals.widgets.active.weak_bg_fill = active_bg();
    visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, text_on_accent());
    visuals.widgets.active.corner_radius = control_radius;
    visuals.widgets.active.bg_stroke = Stroke::NONE;
    visuals.widgets.active.expansion = 0.0;

    // Open: menus and combo boxes while their popup is showing.
    visuals.widgets.open.bg_fill = bg_elevated();
    visuals.widgets.open.weak_bg_fill = bg_elevated();
    visuals.widgets.open.fg_stroke = Stroke::new(1.0_f32, text_primary());
    visuals.widgets.open.corner_radius = control_radius;
    visuals.widgets.open.bg_stroke = Stroke::new(BORDER_THIN, border());

    // Selection / focus — a 2px accent ring, always visible (WCAG 2.4.7).
    visuals.selection.bg_fill = ACCENT.linear_multiply(if dark { 0.32 } else { 0.22 });
    visuals.selection.stroke = Stroke::new(BORDER_THICK, accent_text());

    // Windows, popups and menus.
    visuals.window_corner_radius = CornerRadius::same(ROUNDING_XL);
    visuals.menu_corner_radius = CornerRadius::same(ROUNDING_LG);
    visuals.window_shadow = Elevation::Level4.ambient();
    visuals.window_stroke = Stroke::new(BORDER_HAIRLINE, border_subtle());
    visuals.popup_shadow = Elevation::Level3.ambient();

    visuals.resize_corner_size = 10.0;
    visuals.hyperlink_color = accent_text();
    visuals.faint_bg_color = if dark {
        Color32::from_white_alpha(TABLE_ALT_ROW_ALPHA)
    } else {
        Color32::from_black_alpha(TABLE_ALT_ROW_ALPHA)
    };
    // egui paints every bare TextEdit with `extreme_bg_color`. Pointing it at
    // bg_deep made unstyled search fields disappear into the canvas — a field
    // belongs one step above the surface it sits on, not below it. The
    // terminal asks for bg_deep explicitly where it wants the inset look.
    visuals.extreme_bg_color = bg_tertiary();
    visuals.warn_fg_color = readable_color(WARNING);
    visuals.error_fg_color = readable_color(ERROR);
    visuals.striped = false; // Zebra striping is opt-in, per table.
    visuals.slider_trailing_fill = true;
    visuals.handle_shape = egui::style::HandleShape::Circle;
    visuals.image_loading_spinners = true;

    style.visuals = visuals;
    style.animation_time = ANIM_FAST;
    style.interaction.selectable_labels = true;
    style.interaction.tooltip_delay = 0.4;
    style.interaction.tooltip_grace_time = 0.2;
    ctx.set_style(style);
}

/// Build a shadow from its parts (offset, blur, spread, alpha).
///
/// Kept public for call sites that need a bespoke shadow; prefer the
/// `shadow_*` elevation helpers so depth stays consistent.
pub fn premium_shadow(blur: u8, alpha: u8) -> Shadow {
    Shadow {
        offset: [0, (blur / 4).max(1) as i8],
        blur,
        spread: 0,
        color: Color32::from_black_alpha(alpha),
    }
}

// ============================================================================
// Elevation system — five levels, two light sources
// ============================================================================
//
// Real depth needs two shadows: a wide *ambient* one for the occlusion a
// surface casts on its surroundings, and a tight *key* one for the light
// falling from above. `paint_elevation()` renders both; the `shadow_*`
// helpers return the ambient layer alone for the many call sites that hand a
// single `Shadow` to `egui::Frame`.
//
// Dark surfaces absorb black shadows, so depth there is carried mostly by the
// surface ladder and the hairline rim (see `paint_surface_rim`); the shadows
// stay deliberately restrained to avoid muddy halos.

/// Elevation step, from a resting surface to a full-screen overlay.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Elevation {
    /// Resting interactive elements, hover feedback on flat items.
    Level1,
    /// Cards and raised panels.
    Level2,
    /// Dropdowns, popovers, floating buttons.
    Level3,
    /// Modals and dialogs.
    Level4,
    /// Full-screen overlays, command palette.
    Level5,
}

impl Elevation {
    /// (ambient blur, ambient alpha, key blur, key alpha, y offset)
    const fn params(self, dark: bool) -> (u8, u8, u8, u8, i8) {
        match (self, dark) {
            (Elevation::Level1, true) => (6, 26, 2, 20, 1),
            (Elevation::Level1, false) => (6, 14, 2, 10, 1),
            (Elevation::Level2, true) => (16, 40, 4, 28, 2),
            (Elevation::Level2, false) => (14, 20, 3, 14, 2),
            (Elevation::Level3, true) => (28, 56, 8, 36, 4),
            (Elevation::Level3, false) => (24, 28, 6, 18, 4),
            (Elevation::Level4, true) => (44, 84, 12, 48, 8),
            (Elevation::Level4, false) => (40, 40, 10, 24, 8),
            (Elevation::Level5, true) => (64, 110, 18, 60, 12),
            (Elevation::Level5, false) => (56, 52, 14, 30, 12),
        }
    }

    /// The wide ambient layer, usable on its own with `egui::Frame::shadow`.
    pub fn ambient(self) -> Shadow {
        let (blur, alpha, _, _, dy) = self.params(is_dark_mode());
        Shadow {
            offset: [0, dy],
            blur,
            spread: 0,
            color: Color32::from_black_alpha(alpha),
        }
    }

    /// The tight key layer that sharpens the contact edge.
    pub fn key(self) -> Shadow {
        let (_, _, blur, alpha, dy) = self.params(is_dark_mode());
        Shadow {
            offset: [0, (dy / 2).max(1)],
            blur,
            spread: 0,
            color: Color32::from_black_alpha(alpha),
        }
    }
}

/// Both shadow layers as shapes, ready to be placed behind a surface.
///
/// Returned rather than painted because a shadow drawn *after* its surface
/// lands on top of it: callers reserve slots with `Shape::Noop` before
/// drawing, then fill them here. `intensity` (0.0…1.0) animates the lift.
pub fn elevation_shapes(
    rect: egui::Rect,
    radius: CornerRadius,
    level: Elevation,
    intensity: f32,
) -> [egui::Shape; 2] {
    let t = intensity.clamp(0.0, 1.0);
    if t <= 0.0 {
        return [egui::Shape::Noop, egui::Shape::Noop];
    }
    let mut shapes = [egui::Shape::Noop, egui::Shape::Noop];
    for (slot, mut shadow) in shapes.iter_mut().zip([level.ambient(), level.key()]) {
        shadow.blur = (shadow.blur as f32 * t) as u8;
        shadow.color = shadow.color.linear_multiply(t);
        *slot = egui::Shape::Rect(shadow.as_shape(rect, radius));
    }
    shapes
}

/// Paint both shadow layers at the current end of the paint list.
///
/// Only correct when the surface has not been drawn yet — for anything drawn
/// through `egui::Frame`, reserve slots and use `elevation_shapes` instead.
pub fn paint_elevation(
    painter: &egui::Painter,
    rect: egui::Rect,
    radius: CornerRadius,
    level: Elevation,
    intensity: f32,
) {
    for shape in elevation_shapes(rect, radius, level, intensity) {
        if !matches!(shape, egui::Shape::Noop) {
            painter.add(shape);
        }
    }
}

/// Paint the hairline rim that separates a raised surface from what is behind
/// it — the primary depth cue in dark mode, a crisp highlight in light mode.
pub fn paint_surface_rim(painter: &egui::Painter, rect: egui::Rect, radius: CornerRadius) {
    painter.rect_stroke(
        rect.shrink(0.5),
        radius,
        Stroke::new(BORDER_HAIRLINE, border_subtle()),
        egui::epaint::StrokeKind::Inside,
    );
    if is_dark_mode() {
        // A single lit edge along the top reads as a surface catching light,
        // without the full bevel that dates an interface.
        painter.line_segment(
            [
                egui::pos2(rect.left() + f32::from(radius.nw), rect.top() + 0.5),
                egui::pos2(rect.right() - f32::from(radius.ne), rect.top() + 0.5),
            ],
            Stroke::new(BORDER_HAIRLINE, Color32::from_white_alpha(14)),
        );
    }
}

/// Level 1: subtle hover feedback, small interactive elements.
pub fn shadow_sm() -> Shadow {
    Elevation::Level1.ambient()
}

/// Level 2: cards, raised panels.
pub fn shadow_md() -> Shadow {
    Elevation::Level2.ambient()
}

/// Level 3: elevated cards, floating buttons, dropdown menus.
pub fn shadow_lg() -> Shadow {
    Elevation::Level3.ambient()
}

/// Level 4: modals, dialog windows.
pub fn shadow_xl() -> Shadow {
    Elevation::Level4.ambient()
}

/// Level 5: top-level windows, full-screen overlays.
pub fn shadow_2xl() -> Shadow {
    Elevation::Level5.ambient()
}

/// Helper for a subtle glow effect around a rect.
pub fn glow_stroke(color: Color32) -> Stroke {
    Stroke::new(BORDER_THIN, color.linear_multiply(OPACITY_MEDIUM))
}

/// Make a semantic color readable as text on the current theme's card surface.
///
/// In dark mode, bright colors are already readable on dark backgrounds.
/// In light mode, ALL semantic colors are darkened for AAA-compliant contrast
/// (≥7:1 on typical light surfaces).
#[inline]
pub fn readable_color(color: Color32) -> Color32 {
    theme_variant(color)
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
/// critical (red) > high (amber) > medium (orange) > low (blue) > info (blue)
pub fn severity_color(severity: &str) -> Color32 {
    match severity {
        "critical" => ERROR,         // #FF3B30 Red
        "high" => SEVERITY_HIGH,     // #FFCC00 Amber
        "medium" => SEVERITY_MEDIUM, // #FF9F0A Orange
        "low" => INFO,               // #007AFF Blue
        "info" => INFO,
        _ => WARNING,
    }
}

/// Type-safe severity color using the Severity enum.
pub fn severity_color_typed(severity: &crate::dto::Severity) -> Color32 {
    match severity {
        crate::dto::Severity::Critical => ERROR,
        crate::dto::Severity::High => SEVERITY_HIGH,
        crate::dto::Severity::Medium => SEVERITY_MEDIUM,
        crate::dto::Severity::Low => INFO,
        crate::dto::Severity::Info => INFO,
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
    egui::Stroke::new(2.0_f32, ACCENT)
}

/// Focus ring for dark backgrounds.
pub fn focus_ring_light() -> egui::Stroke {
    egui::Stroke::new(2.0_f32, ACCENT_LIGHT)
}

/// Get a disabled version of a color.
pub fn disabled_color(color: Color32) -> Color32 {
    color.linear_multiply(OPACITY_DISABLED)
}

/// A color at a given alpha.
///
/// Note that egui composites in linear space, so a translucent saturated
/// hue lands much brighter than its alpha suggests. Use this for glows and
/// overlays; for state washes prefer the opaque helpers below.
#[inline]
pub fn with_alpha(color: Color32, alpha: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
}

// ── Interaction washes ──────────────────────────────────────────────────
//
// These are *opaque* mixes rather than translucent fills. egui blends in
// linear space, where a saturated blue at 16% alpha still reads as a solid
// blue band across a table row — mixing in gamma space gives the quiet tint
// the design actually calls for, and it is predictable at review time.
//
// Hover → selected → pressed form a single intensity ramp in the accent
// family, so a row's state is legible from its tint alone (WCAG 1.4.11).

/// Hover wash for interactive elements.
#[inline]
pub fn hover_bg() -> Color32 {
    color_blend(
        bg_secondary(),
        ACCENT,
        if is_dark_mode() { 0.10 } else { 0.07 },
    )
}

/// Pressed wash for interactive elements.
#[inline]
pub fn active_bg() -> Color32 {
    color_blend(
        bg_secondary(),
        ACCENT,
        if is_dark_mode() { 0.26 } else { 0.18 },
    )
}

/// Selected-row / active-nav wash.
#[inline]
pub fn selected_bg() -> Color32 {
    color_blend(
        bg_secondary(),
        ACCENT,
        if is_dark_mode() { 0.18 } else { 0.12 },
    )
}

/// Neutral hover wash for surfaces that must not read as accented
/// (table rows, list items inside an already-accented container).
#[inline]
pub fn hover_bg_neutral() -> Color32 {
    color_blend(
        bg_secondary(),
        overlay_color(),
        if is_dark_mode() { 0.07 } else { 0.05 },
    )
}

/// Tinted wash of any semantic color, for banner and inline-alert surfaces.
#[inline]
pub fn tinted_surface(color: Color32) -> Color32 {
    if is_dark_mode() {
        color_blend(bg_secondary(), color, 0.14)
    } else {
        color_blend(Color32::WHITE, color, 0.10)
    }
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
pub const BUTTON_HEIGHT_SM: f32 = 32.0;

/// Input field height.
pub const INPUT_HEIGHT: f32 = 38.0;

/// Minimum button width for consistent look.
pub const BUTTON_MIN_WIDTH: f32 = 88.0;

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
pub const TAB_HEIGHT: f32 = 38.0;
/// Tab icon column width (icon + the gap before its label).
pub const TAB_ICON_WIDTH: f32 = 24.0;
/// Tab badge pill width (underline style).
pub const TAB_BADGE_WIDTH: f32 = 28.0;

/// Dropdown option row height.
pub const DROPDOWN_ROW_HEIGHT: f32 = 34.0;
/// Dropdown popup max height before scrolling.
pub const DROPDOWN_MAX_HEIGHT: f32 = 200.0;
/// Dropdown popup margin for click-outside detection.
pub const DROPDOWN_POPUP_MARGIN: f32 = 50.0;

/// Modal default width.
pub const MODAL_WIDTH: f32 = 440.0;
/// Modal icon circle diameter.
pub const MODAL_ICON_SIZE: f32 = 48.0;
/// Modal header accent bar height.
pub const MODAL_HEADER_BAR: f32 = 4.0;
/// Modal vertical offset from screen center.
pub const MODAL_Y_OFFSET: f32 = 150.0;

/// Empty-state hero icon size.
pub const EMPTY_STATE_ICON: f32 = 64.0;
/// Pending-state spinner size.
pub const PENDING_SPINNER_SIZE: f32 = 48.0;

/// Skeleton content card inner rounding.
pub const SKELETON_CARD_ROUNDING: u8 = ROUNDING_LG;

// ── Toggle switch colors ──

/// Toggle switch off-state background (dark mode, navy-tinted).
pub const SWITCH_OFF_DARK: Color32 = Color32::from_rgb(52, 53, 62);
/// Toggle switch off-state background (light mode, cool-tinted, ≥3:1 on light surfaces).
pub const SWITCH_OFF_LIGHT: Color32 = Color32::from_rgb(140, 142, 156);

// ── Skeleton placeholder colors ──

/// Skeleton placeholder base color (dark mode, navy-tinted — visible on dark surfaces).
pub const SKELETON_BASE_DARK: Color32 = Color32::from_rgb(50, 52, 62);
/// Skeleton placeholder base color (light mode, cool-tinted).
pub const SKELETON_BASE_LIGHT: Color32 = Color32::from_rgb(218, 220, 232);
/// Skeleton placeholder highlight color (dark mode, navy-tinted — distinct from base).
pub const SKELETON_HIGHLIGHT_DARK: Color32 = Color32::from_rgb(70, 72, 82);
/// Skeleton placeholder highlight color (light mode, cool-tinted).
pub const SKELETON_HIGHLIGHT_LIGHT: Color32 = Color32::from_rgb(236, 238, 248);

// ── Avatar color palette ──

/// Choose black or white text for an avatar based on the avatar color's luminance.
///
/// Guarantees AAA contrast for initials rendered on the avatar background.
#[inline]
pub fn avatar_text_color(avatar_bg: Color32) -> Color32 {
    text_on_color(avatar_bg)
}

/// Avatar auto-generated color palette (10 pleasant hues).
pub const AVATAR_COLORS: [Color32; 10] = [
    Color32::from_rgb(99, 102, 241), // Indigo
    Color32::from_rgb(139, 92, 246), // Violet
    Color32::from_rgb(236, 72, 153), // Pink
    Color32::from_rgb(244, 63, 94),  // Rose
    Color32::from_rgb(249, 115, 22), // Orange
    Color32::from_rgb(234, 179, 8),  // Yellow
    Color32::from_rgb(34, 197, 94),  // Green
    Color32::from_rgb(20, 184, 166), // Teal
    Color32::from_rgb(6, 182, 212),  // Cyan
    Color32::from_rgb(59, 130, 246), // Blue
];

/// Threat radar visualization height.
pub const RADAR_HEIGHT: f32 = 360.0;
/// Threat radar main radius.
pub const RADAR_RADIUS: f32 = 140.0;

/// Tooltip max width.
pub const TOOLTIP_MAX_WIDTH: f32 = 320.0;
/// Tooltip padding (horizontal).
pub const TOOLTIP_PADDING_H: f32 = 10.0;
/// Tooltip padding (vertical).
pub const TOOLTIP_PADDING_V: f32 = 6.0;
/// Tooltip offset from anchor element.
pub const TOOLTIP_OFFSET: f32 = 8.0;
/// Tooltip screen edge margin.
pub const TOOLTIP_SCREEN_MARGIN: f32 = 4.0;

/// Sidebar navigation item height.
pub const NAV_ITEM_HEIGHT: f32 = 36.0;
/// Sidebar nav item horizontal inset.
pub const NAV_ITEM_INSET_H: f32 = 10.0;
/// Sidebar nav item vertical inset.
pub const NAV_ITEM_INSET_V: f32 = 1.0;
/// Sidebar badge horizontal offset from right edge.
pub const NAV_BADGE_OFFSET: f32 = 24.0;
/// Sidebar badge pill width.
pub const NAV_BADGE_WIDTH: f32 = 22.0;
/// Sidebar badge pill height.
pub const NAV_BADGE_HEIGHT: f32 = 16.0;
/// Notification badge offset from parent.
pub const BADGE_INDICATOR_OFFSET: f32 = 4.0;

/// Command palette popup width.
pub const COMMAND_PALETTE_WIDTH: f32 = 560.0;
/// Command palette item row height.
pub const COMMAND_PALETTE_ROW_HEIGHT: f32 = 48.0;
/// Command palette max results height before scrolling.
pub const COMMAND_PALETTE_MAX_HEIGHT: f32 = 400.0;

/// Toast notification corner radius.
pub const TOAST_ROUNDING: u8 = ROUNDING_LG;
/// Toast notification height.
pub const TOAST_HEIGHT: f32 = 46.0;
/// Toast left accent bar width.
pub const TOAST_ACCENT_BAR: f32 = 4.0;
/// Toast text left padding (past accent bar).
pub const TOAST_TEXT_INSET: f32 = 16.0;
/// Toast close button inset from right edge.
pub const TOAST_CLOSE_INSET: f32 = 18.0;

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

/// Pagination dot size (active page).
pub const PAGINATION_DOT_ACTIVE: f32 = 8.0;
/// Pagination dot size (inactive page).
pub const PAGINATION_DOT_INACTIVE: f32 = 6.0;
/// Pagination dot touch area.
pub const PAGINATION_DOT_TOUCH: f32 = 12.0;

/// Terminal / canvas viewport minimum height.
pub const VIEWPORT_MIN_HEIGHT: f32 = 400.0;
/// Cartography canvas height.
pub const CANVAS_MIN_HEIGHT: f32 = 500.0;
/// Summary card minimum inner height (ensures uniform row height).
pub const SUMMARY_CARD_MIN_HEIGHT: f32 = 72.0;

/// Search filter bar input height.
pub const SEARCH_INPUT_HEIGHT: f32 = 32.0;

/// Input field corner radius.
pub const INPUT_ROUNDING: u8 = ROUNDING_MD;

/// Segmented control height.
pub const SEGMENTED_CONTROL_HEIGHT: f32 = 36.0;
/// Segmented control default width.
pub const SEGMENTED_CONTROL_WIDTH: f32 = 340.0;
/// Segmented control outer rounding.
pub const SEGMENTED_CONTROL_ROUNDING: u8 = ROUNDING_LG;

/// Splash screen content width.
pub const SPLASH_CONTENT_WIDTH: f32 = 400.0;
/// Splash screen content height.
pub const SPLASH_CONTENT_HEIGHT: f32 = 360.0;
/// Splash screen progress bar width.
pub const SPLASH_PROGRESS_WIDTH: f32 = 200.0;
/// Splash screen total duration (seconds).
pub const SPLASH_DURATION: f32 = 2.5;
/// Splash fade-in duration (seconds).
pub const SPLASH_FADE_IN: f32 = 0.6;
/// Splash fade-out start time (seconds from splash start).
pub const SPLASH_FADE_OUT_START: f32 = 2.1;
/// Splash fade-out duration (seconds).
pub const SPLASH_FADE_OUT_DURATION: f32 = 0.4;

/// Enrollment gradient background colors (center, outer) - Premium sophisticated palette.
#[inline]
pub fn enrollment_gradient() -> (Color32, Color32) {
    if is_dark_mode() {
        (
            Color32::from_rgb(16, 20, 32), // Deep navy center with brand depth
            Color32::from_rgb(8, 9, 15),   // Near-black elegant outer
        )
    } else {
        (
            Color32::from_rgb(246, 248, 255), // Luminous cool-white center
            Color32::from_rgb(232, 235, 248), // Refined cool gray outer
        )
    }
}

/// Enrollment card/content max width.
pub const ENROLLMENT_CARD_WIDTH: f32 = 520.0;
/// Enrollment input card max width.
pub const ENROLLMENT_INPUT_WIDTH: f32 = 420.0;
/// Enrollment hero icon font size.
pub const ENROLLMENT_HERO_ICON: f32 = 48.0;
/// Enrollment logo max width.
pub const ENROLLMENT_LOGO_WIDTH: f32 = 120.0;
/// Enrollment logo glow radius (reduced for professional look).
pub const ENROLLMENT_GLOW_RADIUS: f32 = 60.0;

/// Sidebar gradient colors (returns top, bottom).
#[inline]
pub fn sidebar_gradient() -> (Color32, Color32) {
    if is_dark_mode() {
        (
            Color32::from_rgb(18, 20, 30), // Navy-tinted spotlight top
            Color32::from_rgb(10, 11, 18), // Deep navy bottom
        )
    } else {
        (
            Color32::from_rgb(241, 243, 253), // Cool luminous top
            Color32::from_rgb(228, 230, 244), // Refined cool bottom
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

// ============================================================================
// Accessibility contract (enforced, not asserted in prose)
// ============================================================================

#[cfg(test)]
mod contrast_tests {
    use super::*;

    /// Every surface a body of text can land on.
    fn surfaces() -> Vec<(&'static str, Color32)> {
        vec![
            ("bg_primary", bg_primary()),
            ("bg_secondary", bg_secondary()),
            ("bg_tertiary", bg_tertiary()),
            ("bg_elevated", bg_elevated()),
            ("bg_sidebar", bg_sidebar()),
            ("bg_deep", bg_deep()),
        ]
    }

    fn check(label: &str, fg: Color32, min: f32) {
        for (name, bg) in surfaces() {
            let ratio = contrast_ratio(fg, bg);
            assert!(
                ratio >= min,
                "{label} on {name}: {ratio:.2}:1 < {min}:1 (theme: {})",
                if is_dark_mode() { "dark" } else { "light" }
            );
        }
    }

    fn for_each_theme(body: impl Fn()) {
        for dark in [true, false] {
            set_dark_mode(dark);
            body();
        }
        set_dark_mode(true);
    }

    #[test]
    fn primary_and_secondary_text_meet_aaa() {
        for_each_theme(|| {
            check("text_primary", text_primary(), 7.0);
            check("text_secondary", text_secondary(), 7.0);
        });
    }

    #[test]
    fn tertiary_text_meets_aa() {
        for_each_theme(|| check("text_tertiary", text_tertiary(), 4.5));
    }

    #[test]
    fn semantic_text_meets_aa_on_every_surface() {
        for_each_theme(|| {
            for (label, color) in [
                ("ACCENT", ACCENT),
                ("SUCCESS", SUCCESS),
                ("WARNING", WARNING),
                ("ERROR", ERROR),
                ("INFO", INFO),
                ("SEVERITY_HIGH", SEVERITY_HIGH),
                ("SEVERITY_MEDIUM", SEVERITY_MEDIUM),
                ("AI", AI),
            ] {
                check(label, readable_color(color), 4.5);
            }
            check("accent_text", accent_text(), 4.5);
        });
    }

    #[test]
    fn badge_text_is_readable_on_its_own_background() {
        for_each_theme(|| {
            for (label, color) in [
                ("SUCCESS", SUCCESS),
                ("WARNING", WARNING),
                ("ERROR", ERROR),
                ("INFO", INFO),
                ("SEVERITY_HIGH", SEVERITY_HIGH),
                ("SEVERITY_MEDIUM", SEVERITY_MEDIUM),
                ("ACCENT", ACCENT),
                ("AI", AI),
            ] {
                let ratio = contrast_ratio(badge_text(color), badge_bg(color));
                assert!(
                    ratio >= 4.5,
                    "badge {label}: {ratio:.2}:1 < 4.5:1 (theme: {})",
                    if is_dark_mode() { "dark" } else { "light" }
                );
            }
        });
    }

    #[test]
    fn control_borders_meet_non_text_contrast() {
        // WCAG 1.4.11 applies against the surface a control actually rests on:
        // the canvas, a card, or an input group — not against the terminal's
        // inset black or a popover the control never appears in.
        for_each_theme(|| {
            for (name, bg) in [
                ("bg_primary", bg_primary()),
                ("bg_secondary", bg_secondary()),
                ("bg_tertiary", bg_tertiary()),
                ("bg_elevated", bg_elevated()),
            ] {
                let ratio = contrast_ratio(border(), bg);
                assert!(ratio >= 3.0, "border on {name}: {ratio:.2}:1 < 3:1");
            }
        });
    }

    #[test]
    fn text_on_accent_is_readable() {
        for accent in [ACCENT, ACCENT_HOVER, ACCENT_PRESSED] {
            let ratio = contrast_ratio(text_on_accent(), accent);
            assert!(ratio >= 4.5, "text on accent fill: {ratio:.2}:1");
        }
    }

    #[test]
    fn avatar_initials_are_readable_on_every_hue() {
        for color in AVATAR_COLORS {
            let ratio = contrast_ratio(avatar_text_color(color), color);
            assert!(ratio >= 4.5, "avatar initials: {ratio:.2}:1 on {color:?}");
        }
    }

    #[test]
    fn dark_surface_ladder_is_monotonic() {
        set_dark_mode(true);
        let ladder = [
            ("deep", relative_luminance(bg_deep())),
            ("sidebar", relative_luminance(bg_sidebar())),
            ("primary", relative_luminance(bg_primary())),
            ("secondary", relative_luminance(bg_secondary())),
            ("tertiary", relative_luminance(bg_tertiary())),
            ("elevated", relative_luminance(bg_elevated())),
        ];
        for pair in ladder.windows(2) {
            assert!(
                pair[1].1 > pair[0].1,
                "dark surface ladder not monotonic at {} -> {}",
                pair[0].0,
                pair[1].0
            );
        }
    }

    #[test]
    fn light_cards_sit_above_the_canvas() {
        set_dark_mode(false);
        assert!(relative_luminance(bg_secondary()) > relative_luminance(bg_primary()));
        assert!(relative_luminance(bg_primary()) > relative_luminance(bg_elevated()));
        set_dark_mode(true);
    }
}
