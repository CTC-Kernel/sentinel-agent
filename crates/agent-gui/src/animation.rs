// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Animation utilities for premium GUI polish.
//!
//! Provides easing functions, color interpolation, and animated value
//! helpers. All functions respect the reduced-motion accessibility setting.

use egui::Color32;

use crate::theme;

// ============================================================================
// Repaint pacing
// ============================================================================

/// Frame interval for ambient motion: breathing dots, the AI core's orbit.
///
/// Motion this slow looks the same at 30 fps as at the display's 60-120 Hz,
/// and an agent that sits open all day should not redraw at full rate for
/// decoration.
pub const AMBIENT_FRAME: std::time::Duration = std::time::Duration::from_millis(33);

/// Schedule the next frame of an ambient animation. Does nothing under
/// reduced motion, where ambient animations are static.
#[inline]
pub fn request_ambient_repaint(ctx: &egui::Context) {
    if !theme::is_reduced_motion() {
        ctx.request_repaint_after(AMBIENT_FRAME);
    }
}

// ============================================================================
// Easing functions  (input `t` in 0.0..=1.0, output 0.0..=1.0)
// ============================================================================

/// Smooth ease-in-out (cubic).  Starts and ends slowly.
#[inline]
pub fn ease_in_out(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}

/// Ease-out (cubic).  Fast start, slow finish — feels responsive.
#[inline]
pub fn ease_out(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    1.0 - (1.0 - t).powi(3)
}

/// Ease-in (cubic).  Slow start, fast finish.
#[inline]
pub fn ease_in(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * t
}

/// Apple-style spring overshoot.  Overshoots slightly then settles.
/// Good for page transitions and modal entrance.
#[inline]
pub fn spring(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    // Approximation of a spring with slight overshoot
    let c4 = (2.0 * std::f32::consts::PI) / 3.0;
    if t == 0.0 || t == 1.0 {
        t
    } else {
        (2.0_f32).powf(-10.0 * t) * ((t * 10.0 - 0.75) * c4).sin() + 1.0
    }
}

/// Smooth-step (Hermite interpolation) — smoother than linear, simpler than cubic.
#[inline]
pub fn smooth_step(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

// ============================================================================
// Color interpolation
// ============================================================================

/// Linearly interpolate between two colors.
/// `t` ranges from 0.0 (= `a`) to 1.0 (= `b`).
#[inline]
pub fn lerp_color(a: Color32, b: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    Color32::from_rgba_unmultiplied(
        ((a.r() as f32) * (1.0 - t) + (b.r() as f32) * t).clamp(0.0, 255.0) as u8,
        ((a.g() as f32) * (1.0 - t) + (b.g() as f32) * t).clamp(0.0, 255.0) as u8,
        ((a.b() as f32) * (1.0 - t) + (b.b() as f32) * t).clamp(0.0, 255.0) as u8,
        ((a.a() as f32) * (1.0 - t) + (b.a() as f32) * t).clamp(0.0, 255.0) as u8,
    )
}

/// Interpolate between two colors using ease-in-out.
#[inline]
pub fn lerp_color_smooth(a: Color32, b: Color32, t: f32) -> Color32 {
    lerp_color(a, b, ease_in_out(t))
}

// ============================================================================
// Animated value helper (for smooth hover transitions, etc.)
// ============================================================================

/// Compute a smooth animated progress value between 0.0 and 1.0.
///
/// Uses egui's built-in `animate_bool` for the actual interpolation,
/// which provides frame-rate independent easing and automatically
/// requests repaints as needed.
///
/// When reduced motion is active, returns the target instantly.
#[inline]
pub fn animate_hover(ctx: &egui::Context, id: egui::Id, is_active: bool) -> f32 {
    if theme::is_reduced_motion() {
        if is_active { 1.0 } else { 0.0 }
    } else {
        smooth_step(ctx.animate_bool_with_time(id, is_active, theme::ANIM_FAST))
    }
}

/// Frame-rate-independent, monotonic damping for moving navigation markers.
/// A new target resumes from the current value; no restart, bounce or overshoot.
/// Initial layout and reduced motion always resolve immediately.
pub fn damped_value(ctx: &egui::Context, id: egui::Id, target: f32, duration: f32) -> f32 {
    let previous = ctx.data(|data| data.get_temp::<f32>(id)).unwrap_or(target);
    let value = if theme::is_reduced_motion() || duration <= 0.0 {
        target
    } else {
        let dt = ctx.input(|i| i.stable_dt).clamp(0.0, 0.05);
        let next = damped_step(previous, target, dt, duration);
        if (target - next).abs() < 0.01 {
            target
        } else {
            ctx.request_repaint();
            next
        }
    };
    ctx.data_mut(|data| data.insert_temp(id, value));
    value
}

fn damped_step(previous: f32, target: f32, dt: f32, duration: f32) -> f32 {
    previous + (target - previous) * (1.0 - (-dt * 6.0 / duration).exp())
}

/// Compute a timed animation progress (0.0 → 1.0) over `duration` seconds.
///
/// Returns 1.0 once `elapsed >= duration`.
/// Applies ease-out by default for natural deceleration.
/// Returns 1.0 instantly when reduced motion is active.
#[inline]
pub fn timed_progress(elapsed: f32, duration: f32) -> f32 {
    if theme::is_reduced_motion() || duration <= 0.0 {
        return 1.0;
    }
    let t = (elapsed / duration).clamp(0.0, 1.0);
    ease_out(t)
}

/// Pulse animation helper (breathing effect) — returns a value oscillating
/// between `min_val` and `max_val` at `speed` radians per second.
///
/// Returns `max_val` (static) when reduced motion is active.
#[inline]
pub fn pulse(time: f64, speed: f32, min_val: f32, max_val: f32) -> f32 {
    if theme::is_reduced_motion() {
        max_val
    } else {
        let t = ((time as f32 * speed).sin() * 0.5 + 0.5).clamp(0.0, 1.0);
        min_val + t * (max_val - min_val)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn damping_is_monotonic_and_resumes_toward_an_interrupted_target() {
        let mut value = 0.0;
        for _ in 0..8 {
            let next = damped_step(value, 100.0, 1.0 / 60.0, 0.22);
            assert!(next >= value && next <= 100.0);
            value = next;
        }
        for _ in 0..60 {
            let next = damped_step(value, -40.0, 1.0 / 60.0, 0.22);
            assert!(next <= value && next >= -40.0);
            value = next;
        }
        assert!((value + 40.0).abs() < 0.01);
    }

    #[test]
    fn damping_has_the_same_travel_at_60_and_120_hz() {
        let run = |fps| {
            (0..fps / 5).fold(0.0, |value, _| {
                damped_step(value, 100.0, 1.0 / fps as f32, 0.22)
            })
        };
        assert!((run(60) - run(120)).abs() < 0.001);
    }

    #[test]
    fn damped_value_is_immediate_on_first_layout_and_reduced_motion() {
        let ctx = egui::Context::default();
        let id = egui::Id::new("reduced_marker");
        assert_eq!(damped_value(&ctx, id, 40.0, 0.22), 40.0);
        theme::set_reduced_motion(true);
        let value = damped_value(&ctx, id, 90.0, 0.22);
        theme::set_reduced_motion(false);
        assert_eq!(value, 90.0);
    }

    #[test]
    fn easing_boundaries() {
        // All easing functions should map 0→0 and 1→1
        for f in [ease_in_out, ease_out, ease_in, smooth_step] {
            assert!((f(0.0) - 0.0).abs() < 1e-6, "f(0) should be 0");
            assert!((f(1.0) - 1.0).abs() < 1e-6, "f(1) should be 1");
        }
        // Spring also maps endpoints
        assert!((spring(0.0) - 0.0).abs() < 1e-6);
        assert!((spring(1.0) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn lerp_color_endpoints() {
        let a = Color32::from_rgb(0, 0, 0);
        let b = Color32::from_rgb(255, 255, 255);
        assert_eq!(lerp_color(a, b, 0.0), a);
        assert_eq!(lerp_color(a, b, 1.0), b);
    }

    #[test]
    fn lerp_color_midpoint() {
        let a = Color32::from_rgb(0, 0, 0);
        let b = Color32::from_rgb(200, 100, 50);
        let mid = lerp_color(a, b, 0.5);
        assert_eq!(mid.r(), 100);
        assert_eq!(mid.g(), 50);
        assert_eq!(mid.b(), 25);
    }

    #[test]
    fn timed_progress_clamps() {
        assert!((timed_progress(-1.0, 1.0) - 0.0).abs() < 1e-6);
        assert!((timed_progress(2.0, 1.0) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn pulse_returns_range() {
        for i in 0..100 {
            let t = i as f64 * 0.1;
            let v = pulse(t, 1.0, 0.3, 0.8);
            assert!((0.3 - 1e-6..=0.8 + 1e-6).contains(&v));
        }
    }
}
