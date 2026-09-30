// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium data-viz kit shared by every small chart and indicator.
//!
//! One vocabulary, so a gauge on the dashboard and a bar in a table speak the
//! same visual language as the Sentinel GRC site:
//!
//! * **Ramps** — every semantic hue owns a curated two-stop gradient
//!   (`ramp`), the way the site pairs violet with fuchsia and cyan with
//!   emerald. Marks are painted along the ramp, never as a flat slab.
//! * **Glow** — marks sit on a soft halo of their own colour in dark mode,
//!   the site's coloured `shadow-*/30` rather than a grey drop.
//! * **Motion** — values ease in from zero the first time they are shown and
//!   glide between readings afterwards (`tween`). Motion only runs while a
//!   value changes, so an idle dashboard costs no frames. Continuous motion
//!   (`pulse_phase`) is reserved for live and critical signals and is
//!   throttled to ~30 fps. Everything is instant under reduced motion.

use egui::epaint::PathStroke;
use egui::{Color32, CornerRadius, Pos2, Rect, Stroke};
use std::f32::consts::{FRAC_PI_2, TAU};

use crate::{animation, theme};

// ============================================================================
// Colour ramps
// ============================================================================

/// A two-stop gradient: `from` at the start of a mark, `to` at its end.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ramp {
    pub from: Color32,
    pub to: Color32,
}

impl Ramp {
    /// Colour at `t` (0.0 = `from`, 1.0 = `to`).
    #[inline]
    pub fn at(self, t: f32) -> Color32 {
        animation::lerp_color(self.from, self.to, t)
    }

    /// The ramp's midpoint, for marks too small to show a gradient.
    #[inline]
    pub fn mid(self) -> Color32 {
        self.at(0.5)
    }
}

const fn rgb(r: u8, g: u8, b: u8) -> Color32 {
    Color32::from_rgb(r, g, b)
}

/// Curated gradient for a semantic colour, tuned for the active theme.
///
/// Dark mode uses the luminous stops (they glow on ink); light mode maps
/// each stop to its readable variant so marks keep ≥3:1 on white cards.
pub fn ramp(color: Color32) -> Ramp {
    let (from, to) = match (color.r(), color.g(), color.b()) {
        // Violet → fuchsia: the site's action gradient.
        (109, 40, 217) | (196, 181, 253) | (139, 92, 246) => (rgb(139, 92, 246), rgb(217, 70, 239)),
        // Emerald → teal: healthy, compliant.
        (43, 201, 138) | (52, 211, 153) => (rgb(52, 211, 153), rgb(45, 212, 191)),
        // Amber → orange: needs attention.
        (245, 165, 36) => (rgb(251, 191, 36), rgb(249, 115, 22)),
        (255, 176, 32) => (rgb(251, 146, 60), rgb(234, 88, 12)),
        (255, 140, 58) => (rgb(253, 186, 116), rgb(249, 115, 22)),
        // Rose → red: critical.
        (255, 97, 99) => (rgb(251, 113, 133), rgb(239, 68, 68)),
        // Cyan → blue: informational.
        (56, 166, 245) => (rgb(34, 211, 238), rgb(59, 130, 246)),
        // Cyan → emerald: the site's "Licence" / agent pairing.
        (34, 211, 238) | (6, 182, 212) => (rgb(34, 211, 238), rgb(52, 211, 153)),
        // Lavender → purple: machine reasoning.
        (167, 139, 255) => (rgb(167, 139, 255), rgb(192, 132, 252)),
        // Anything else: the hue itself, lifting toward a lighter tint.
        _ => (color, theme::color_blend_pub(color, Color32::WHITE, 0.28)),
    };
    Ramp {
        from: theme::chart_color(from),
        to: theme::chart_color(to),
    }
}

/// Ramp for a 0–100 score, following `theme::score_color`.
#[inline]
pub fn score_ramp(score: f32) -> Ramp {
    ramp(theme::score_color(score))
}

// ============================================================================
// Motion
// ============================================================================

#[derive(Clone, Copy)]
struct Tween {
    from: f32,
    to: f32,
    start: f64,
}

/// Duration of a value transition (entrance and change).
pub const TWEEN_SECS: f32 = 0.9;

/// Ease a displayed value toward `target`.
///
/// The first time an `id` is seen the value counts up from zero; later
/// changes glide from wherever the animation currently is. Repaints are
/// requested only while the value is in flight.
pub fn tween(ctx: &egui::Context, id: egui::Id, target: f32) -> f32 {
    tween_from(ctx, id, target, 0.0)
}

/// [`tween`] with an explicit entrance value (e.g. the previous reading).
pub fn tween_from(ctx: &egui::Context, id: egui::Id, target: f32, entrance: f32) -> f32 {
    if theme::is_reduced_motion() || !target.is_finite() {
        return target;
    }
    let now = ctx.input(|i| i.time);
    let eval = |tw: Tween| {
        let p = ((now - tw.start) as f32 / TWEEN_SECS).clamp(0.0, 1.0);
        (tw.from + (tw.to - tw.from) * animation::ease_out(p), p)
    };
    let tw = match ctx.data(|d| d.get_temp::<Tween>(id)) {
        None => Tween {
            from: entrance,
            to: target,
            start: now,
        },
        Some(tw) if (tw.to - target).abs() > f32::EPSILON => Tween {
            from: eval(tw).0,
            to: target,
            start: now,
        },
        Some(tw) => tw,
    };
    ctx.data_mut(|d| d.insert_temp(id, tw));
    let (value, progress) = eval(tw);
    if progress < 1.0 {
        ctx.request_repaint();
    }
    value
}

/// Progress (0…1) of the value transition for `id`, for effects that only
/// play while a mark is moving (the sheen on a filling bar).
pub fn tween_progress(ctx: &egui::Context, id: egui::Id) -> f32 {
    if theme::is_reduced_motion() {
        return 1.0;
    }
    let now = ctx.input(|i| i.time);
    ctx.data(|d| d.get_temp::<Tween>(id))
        .map_or(1.0, |tw| ((now - tw.start) as f32 / TWEEN_SECS).clamp(0.0, 1.0))
}

/// A 0…1 breathing phase for live and critical indicators.
///
/// Throttled to ~30 fps; returns a steady 1.0 under reduced motion.
pub fn pulse_phase(ctx: &egui::Context) -> f32 {
    if theme::is_reduced_motion() {
        return 1.0;
    }
    ctx.request_repaint_after(std::time::Duration::from_millis(33));
    let t = ctx.input(|i| i.time) as f32;
    (t * TAU / 1.8).sin() * 0.5 + 0.5
}

// ============================================================================
// Painters
// ============================================================================

fn arc_points(center: Pos2, radius: f32, start: f32, sweep: f32) -> Vec<Pos2> {
    let steps = ((sweep.abs() / TAU) * 96.0).ceil().max(2.0) as usize;
    (0..=steps)
        .map(|i| {
            let a = start + sweep * i as f32 / steps as f32;
            center + egui::vec2(a.cos(), a.sin()) * radius
        })
        .collect()
}

/// Fraction (0…1) of the way around an arc that `pos` sits at.
fn arc_t(center: Pos2, start: f32, sweep: f32, pos: Pos2) -> f32 {
    if sweep.abs() < f32::EPSILON {
        return 0.0;
    }
    let angle = (pos.y - center.y).atan2(pos.x - center.x);
    let rel = (angle - start).rem_euclid(TAU);
    (rel / sweep.abs()).clamp(0.0, 1.0)
}

/// A ring track: the recessed groove a gauge's arc runs in.
pub fn paint_ring_track(painter: &egui::Painter, center: Pos2, radius: f32, width: f32) {
    painter.circle_stroke(center, radius, Stroke::new(width, theme::bg_tertiary()));
    // A hairline on the inner lip reads as depth, not as a second ring.
    painter.circle_stroke(
        center,
        radius - width * 0.5,
        Stroke::new(
            theme::BORDER_HAIRLINE,
            theme::overlay_color().linear_multiply(0.06),
        ),
    );
}

/// A gradient arc with a glow halo and round caps, starting at 12 o'clock
/// and sweeping clockwise through `fraction` of a full turn.
pub fn paint_arc(
    painter: &egui::Painter,
    center: Pos2,
    radius: f32,
    width: f32,
    fraction: f32,
    ramp: Ramp,
) {
    paint_arc_span(painter, center, radius, width, -FRAC_PI_2, fraction * TAU, ramp);
}

/// [`paint_arc`] over an explicit `start` angle and `sweep` (radians).
pub fn paint_arc_span(
    painter: &egui::Painter,
    center: Pos2,
    radius: f32,
    width: f32,
    start: f32,
    sweep: f32,
    ramp: Ramp,
) {
    if sweep.abs() < 0.001 {
        return;
    }
    let points = arc_points(center, radius, start, sweep);
    let color_at = move |pos: Pos2| ramp.at(arc_t(center, start, sweep, pos));

    if theme::is_dark_mode() {
        // Halo: a wide, faint copy of the arc in its own colours.
        painter.add(egui::Shape::line(
            points.clone(),
            PathStroke::new_uv(width * 2.4, move |_, pos| {
                theme::with_alpha(color_at(pos), 34)
            }),
        ));
    }
    painter.add(egui::Shape::line(
        points.clone(),
        PathStroke::new_uv(width, move |_, pos| color_at(pos)),
    ));
    // Round caps.
    if let (Some(first), Some(last)) = (points.first(), points.last()) {
        painter.circle_filled(*first, width * 0.5, ramp.from);
        painter.circle_filled(*last, width * 0.5, ramp.to);
        // A lit bead on the leading edge marks where the value is.
        painter.circle_filled(
            *last,
            width * 0.22,
            Color32::from_white_alpha(if theme::is_dark_mode() { 210 } else { 235 }),
        );
    }
}

/// A horizontal gradient bar in a recessed track.
///
/// `sheen` (0…1) sweeps a soft highlight across the fill while it is still
/// moving; pass `1.0` (or the result of [`tween_progress`]) — at 1.0 the
/// sheen is gone, so a settled bar stays a quiet measurement.
pub fn paint_bar(painter: &egui::Painter, rect: Rect, fraction: f32, ramp: Ramp, sheen: f32) {
    let radius = rect.height() * 0.5;
    let rounding = CornerRadius::same(radius.round() as u8);
    painter.rect_filled(rect, rounding, theme::bg_tertiary());
    painter.rect_stroke(
        rect,
        rounding,
        Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
        egui::StrokeKind::Inside,
    );

    let fraction = fraction.clamp(0.0, 1.0);
    if fraction <= 0.0 {
        return;
    }
    let fill = Rect::from_min_size(
        rect.min,
        egui::vec2((rect.width() * fraction).max(rect.height()), rect.height()),
    );
    // The gradient spans the whole track, so 30 % and 90 % bars show
    // different ends of the ramp — colour carries magnitude too.
    let end = ramp.at(fraction);

    if theme::is_dark_mode() {
        let glow = egui::epaint::Shadow {
            offset: [0, 0],
            blur: (rect.height() * 1.6) as u8,
            spread: 0,
            color: theme::with_alpha(end, 60),
        };
        painter.add(glow.as_shape(fill, rounding));
    }
    theme::paint_gradient_rect(painter, fill, radius, ramp.from, end);

    // Glass highlight along the top half.
    let gloss = Rect::from_min_max(
        fill.min + egui::vec2(radius * 0.6, 0.5),
        egui::pos2(fill.right() - radius * 0.6, fill.center().y),
    );
    if gloss.width() > 2.0 {
        painter.rect_filled(
            gloss,
            CornerRadius::same((gloss.height() * 0.5) as u8),
            Color32::from_white_alpha(if theme::is_dark_mode() { 22 } else { 60 }),
        );
    }

    if sheen < 1.0 && fill.width() > rect.height() * 2.0 {
        let x = fill.left() + fill.width() * animation::ease_in_out(sheen);
        let band = fill.height() * 3.0;
        let alpha = (90.0 * (1.0 - sheen)) as u8;
        theme::paint_gradient_hairline(
            painter,
            fill.center().y,
            egui::Rangef::new(
                (x - band).max(fill.left() + radius),
                (x + band).min(fill.right() - radius),
            ),
            Color32::from_white_alpha(alpha),
        );
    }
}

/// A status dot with a soft halo; `pulse` (0…1, see [`pulse_phase`]) makes
/// the halo breathe outward for live signals. Pass `None` for a still dot.
pub fn paint_status_dot(
    painter: &egui::Painter,
    center: Pos2,
    radius: f32,
    color: Color32,
    pulse: Option<f32>,
) {
    let color = theme::chart_color(color);
    if let Some(p) = pulse {
        let ring = radius * (1.4 + 1.1 * (1.0 - p));
        painter.circle_filled(center, ring, theme::with_alpha(color, (60.0 * p) as u8));
    } else if theme::is_dark_mode() {
        painter.circle_filled(center, radius * 1.9, theme::with_alpha(color, 36));
    }
    painter.circle_filled(center, radius, color);
    painter.circle_filled(
        center - egui::vec2(radius * 0.3, radius * 0.3),
        radius * 0.35,
        Color32::from_white_alpha(90),
    );
}

/// A polyline stroked along `ramp` from left to right, with a halo in dark
/// mode. The workhorse of sparklines and mini line charts.
pub fn paint_gradient_line(painter: &egui::Painter, points: Vec<Pos2>, width: f32, ramp: Ramp) {
    if points.len() < 2 {
        return;
    }
    let (x0, x1) = points
        .iter()
        .fold((f32::MAX, f32::MIN), |(lo, hi), p| (lo.min(p.x), hi.max(p.x)));
    let span = (x1 - x0).max(1.0);
    let color_at = move |pos: Pos2| ramp.at((pos.x - x0) / span);
    if theme::is_dark_mode() {
        painter.add(egui::Shape::line(
            points.clone(),
            PathStroke::new_uv(width * 3.0, move |_, pos| {
                theme::with_alpha(color_at(pos), 30)
            }),
        ));
    }
    painter.add(egui::Shape::line(
        points,
        PathStroke::new_uv(width, move |_, pos| color_at(pos)),
    ));
}

/// Vertical-fade area under a line, tinted along `ramp` left to right.
pub fn paint_area(painter: &egui::Painter, points: &[Pos2], baseline: f32, ramp: Ramp, peak_alpha: f32) {
    if points.len() < 2 {
        return;
    }
    let (x0, x1) = (points[0].x, points[points.len() - 1].x);
    let span = (x1 - x0).abs().max(1.0);
    let top = points.iter().map(|p| p.y).fold(f32::MAX, f32::min);
    let depth = (baseline - top).max(1.0);
    let mut mesh = egui::Mesh::default();
    for p in points {
        let c = ramp.at((p.x - x0) / span);
        let height = ((baseline - p.y) / depth).clamp(0.0, 1.0);
        mesh.colored_vertex(*p, theme::with_alpha(c, (peak_alpha * (0.35 + 0.65 * height)) as u8));
        mesh.colored_vertex(egui::pos2(p.x, baseline), theme::with_alpha(c, 0));
    }
    for i in 0..points.len() as u32 - 1 {
        let a = 2 * i;
        mesh.add_triangle(a, a + 1, a + 2);
        mesh.add_triangle(a + 1, a + 3, a + 2);
    }
    painter.add(egui::Shape::mesh(mesh));
}

/// A vertical bar (histogram column) with a gradient from its base to its
/// top and a rounded cap.
pub fn paint_column(painter: &egui::Painter, rect: Rect, ramp: Ramp) {
    if rect.height() < 0.5 || rect.width() < 0.5 {
        return;
    }
    let r = (rect.width() * 0.5).min(4.0);
    painter.rect_filled(
        rect,
        CornerRadius {
            nw: r as u8,
            ne: r as u8,
            sw: 1,
            se: 1,
        },
        ramp.from,
    );
    // Vertical gradient via a quad mesh inset half a pixel (AA from below).
    let inner = rect.shrink2(egui::vec2(0.5, 0.0));
    let top = inner.top() + r;
    if inner.bottom() > top {
        let mut mesh = egui::Mesh::default();
        mesh.colored_vertex(egui::pos2(inner.left(), top), ramp.to);
        mesh.colored_vertex(egui::pos2(inner.right(), top), ramp.to);
        mesh.colored_vertex(inner.left_bottom(), ramp.from);
        mesh.colored_vertex(inner.right_bottom(), ramp.from);
        mesh.add_triangle(0, 1, 2);
        mesh.add_triangle(1, 3, 2);
        painter.add(egui::Shape::mesh(mesh));
        painter.rect_filled(
            Rect::from_min_max(rect.min, egui::pos2(rect.right(), top + 0.5)),
            CornerRadius {
                nw: r as u8,
                ne: r as u8,
                sw: 0,
                se: 0,
            },
            ramp.to,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ramp_stops_are_readable_on_light_cards() {
        theme::set_dark_mode(false);
        for c in [
            theme::ACCENT,
            theme::SUCCESS,
            theme::WARNING,
            theme::ERROR,
            theme::INFO,
            theme::AI,
            theme::SEVERITY_HIGH,
            theme::SEVERITY_MEDIUM,
            theme::BRAND_CYAN,
        ] {
            let r = ramp(c);
            for stop in [r.from, r.to] {
                let ratio = theme::contrast_ratio(stop, theme::bg_secondary());
                assert!(ratio >= 3.0, "{c:?} ramp stop {stop:?}: {ratio:.2}:1");
            }
        }
        theme::set_dark_mode(true);
    }

    #[test]
    fn arc_t_runs_from_start_to_end() {
        let c = Pos2::ZERO;
        let start = -FRAC_PI_2;
        assert!(arc_t(c, start, TAU * 0.5, egui::pos2(0.0, -1.0)) < 0.01);
        let quarter = arc_t(c, start, TAU * 0.5, egui::pos2(1.0, 0.0));
        assert!((quarter - 0.5).abs() < 0.01, "{quarter}");
    }
}
