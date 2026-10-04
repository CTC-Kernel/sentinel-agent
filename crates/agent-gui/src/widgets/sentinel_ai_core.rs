// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium "Jarvis" style AI core visualization for the dashboard.
//!
//! Uses custom egui painting with multiple layers of rotation and pulsing
//! to create a high-fidelity holographic effect representing the Sentinel AI.

use egui::{Color32, Painter, Pos2, Stroke, Ui, Vec2};
use std::f32::consts::TAU;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VoiceState {
    Idle,
    /// Listening on the microphone. The inner value is the normalized RMS level
    /// (0.0 = silence, 1.0 = clipping) used to animate the indicator.
    Listening(f32),
    Speaking(f32), // volume level for waveform
}

/// A high-fidelity animated AI core widget.
pub struct SentinelAICore {
    /// Posture score (0.0 to 100.0) used to tint the core if needed.
    pub score: f32,
    /// Whether the AI is currently "processing" (increases animation speed).
    pub is_processing: bool,
    /// Voice interaction state.
    pub voice_state: VoiceState,
}

impl SentinelAICore {
    pub fn new(score: f32) -> Self {
        Self {
            score,
            is_processing: false,
            voice_state: VoiceState::Idle,
        }
    }

    pub fn processing(mut self, processing: bool) -> Self {
        self.is_processing = processing;
        self
    }

    pub fn voice(mut self, voice_state: VoiceState) -> Self {
        self.voice_state = voice_state;
        self
    }

    pub fn show(&self, ui: &mut Ui, radius: f32) -> egui::Response {
        let size = Vec2::splat(radius * 3.2); // Reserve the full ripple envelope.
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());

        if ui.is_rect_visible(rect) {
            let painter = ui.painter();
            let center = rect.center();
            let reduced = crate::theme::is_reduced_motion();
            let active = self.is_processing || !matches!(self.voice_state, VoiceState::Idle);
            // Accumulate only while working. Idle cores remain still, and resuming
            // continues their phase instead of jumping to wall-clock time.
            let phase_id = response.id.with("activity_phase");
            let mut phase = ui.data(|data| data.get_temp::<f32>(phase_id).unwrap_or(0.0));
            if active && !reduced {
                phase += ui.input(|i| i.stable_dt).min(0.05)
                    * if self.is_processing { 2.0 } else { 1.0 };
                ui.data_mut(|data| data.insert_temp(phase_id, phase));
            }
            let t = if reduced { 0.0 } else { phase };

            // 1. Aura / Glow Background
            self.draw_aura(painter, center, radius, t);

            // 2. Rotating Rings
            self.draw_rings(painter, center, radius, t);

            // 3. Central Core
            self.draw_core(painter, center, radius, t);

            // Static at rest and under reduced motion, animated only when active.
            self.draw_orbitals(painter, center, radius, t, Vec2::ZERO);

            // 5. Crosshair / HUD elements
            self.draw_hud(painter, center, radius);

            if response.has_focus() {
                painter.circle_stroke(rect.center(), radius * 1.08, crate::theme::focus_ring());
            }

            // Ambient motion: paced, not redrawn at the display rate.
            if active {
                crate::animation::request_ambient_repaint(ui.ctx());
            }
        }

        response.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::Button,
                ui.is_enabled(),
                "Ouvrir l'assistant de sécurité IA",
            )
        });
        response
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .on_hover_text("Ouvrir le centre d'analyse et de recommandations IA")
    }

    fn draw_aura(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        // Violet carries the assistant identity; blue denotes live input.
        let mut base_color = theme::chart_color(theme::AI);

        match self.voice_state {
            VoiceState::Listening(level) => {
                // Blue denotes input activity without implying a healthy endpoint.
                base_color = theme::INFO.linear_multiply(1.0 + level.clamp(0.0, 1.0) * 0.35);
            }
            VoiceState::Speaking(vol) => {
                base_color = theme::chart_color(theme::AI).linear_multiply(1.0 + vol * 0.35);
            }
            _ => {}
        }

        if !theme::is_dark_mode() {
            // A material base gives the orbital lines depth on a bright card.
            // Both fills are opaque, so the core stays legible on any parent.
            painter.circle_filled(
                center + egui::vec2(0.0, 3.0),
                radius * 1.05,
                theme::color_blend(theme::bg_secondary(), theme::AI, 0.20),
            );
            painter.circle_filled(
                center,
                radius * 1.04,
                theme::color_blend(theme::bg_secondary(), theme::AI, 0.12),
            );
            painter.circle_stroke(
                center,
                radius * 1.04,
                Stroke::new(1.0_f32, theme::chart_color(theme::AI).linear_multiply(0.28)),
            );
        }

        // Pulsing background wash
        let pulse = match self.voice_state {
            VoiceState::Listening(level) => (t * 1.5).sin() * 0.15 + 0.25 + level * 0.4,
            VoiceState::Speaking(vol) => 0.2 + vol * 0.4,
            _ => (t * 0.8).sin() * 0.1 + 0.15,
        };
        // Continuous falloff gives the core a soft light instead of a solid
        // translucent disc. It remains inside the widget's reserved envelope.
        theme::paint_radial_glow(
            painter,
            center,
            radius * 1.3,
            theme::with_alpha(base_color, (pulse * 80.0).clamp(0.0, 255.0) as u8),
        );

        // Circular wave ripples
        let passes = match self.voice_state {
            VoiceState::Speaking(vol) => 3 + (vol * 3.0) as usize,
            VoiceState::Listening(level) => 2 + (level * 4.0) as usize,
            _ if self.is_processing => 2,
            _ => 0,
        };
        let speed_factor = match self.voice_state {
            VoiceState::Listening(level) => 1.2 + level * 1.5,
            _ => 0.5,
        };

        for i in 0..passes {
            let wave_t = (t * speed_factor + i as f32 * (1.0 / passes as f32)) % 1.0;
            let mut wave_r = radius * (1.0 + wave_t * 0.5);

            if let VoiceState::Speaking(vol) = self.voice_state {
                // Wave expansion relative to volume
                wave_r += vol * radius * 0.3 * (1.0 - wave_t);
            } else if let VoiceState::Listening(level) = self.voice_state {
                // Push the ripple outward as the microphone picks up energy.
                wave_r += level * radius * 0.4 * (1.0 - wave_t);
            }

            let alpha = (1.0 - wave_t) * 0.1;
            painter.circle_stroke(
                center,
                wave_r,
                Stroke::new(theme::BORDER_THIN, base_color.linear_multiply(alpha)),
            );
        }
    }

    fn draw_rings(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        let color_primary = theme::chart_color(theme::AI);
        let color_secondary = theme::accent_text();

        // --- Outer Ring (Many small segments, slow CW) ---
        let outer_r = radius * 1.05;
        let outer_angle = t * 0.2;
        let seg_count = 32;
        for i in 0..seg_count {
            if i % 2 == 0 {
                continue;
            } // Gaps
            let start = outer_angle + (i as f32 / seg_count as f32) * TAU;
            let end = start + (0.5 / seg_count as f32) * TAU;
            self.draw_arc(
                painter,
                center,
                outer_r,
                start,
                end,
                Stroke::new(theme::BORDER_THIN, color_primary.linear_multiply(0.4)),
            );
        }

        // --- Middle Ring (2 segments, CCW) ---
        let mid_r = radius * 0.85;
        let mid_angle = -t * 0.5;
        self.draw_arc(
            painter,
            center,
            mid_r,
            mid_angle,
            mid_angle + 1.2,
            Stroke::new(theme::BORDER_MEDIUM, color_secondary),
        );
        self.draw_arc(
            painter,
            center,
            mid_r,
            mid_angle + TAU / 2.0,
            mid_angle + TAU / 2.0 + 1.2,
            Stroke::new(theme::BORDER_MEDIUM, color_secondary),
        );

        // --- Inner Ring (4 segments, fast CW) ---
        let inner_r = radius * 0.65;
        let inner_angle = t * 1.2;
        for i in 0..4 {
            let start = inner_angle + (i as f32 / 4.0) * TAU;
            let end = start + 0.5;
            self.draw_arc(
                painter,
                center,
                inner_r,
                start,
                end,
                Stroke::new(theme::BORDER_THICK, color_primary),
            );
        }
    }

    fn draw_core(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        // The assistant is an interaction state, not a second security verdict.
        let score_color = match self.voice_state {
            VoiceState::Listening(_) => theme::readable_color(theme::INFO),
            _ => theme::chart_color(theme::AI),
        };
        let core_r = radius * 0.4;

        // Breathing core
        let pulse = (t * 2.0).sin() * 0.1 + 0.9;
        let active_r = core_r * pulse;

        // Inner glow
        painter.circle_filled(center, active_r, score_color.linear_multiply(0.3));

        // Solid center
        painter.circle_filled(center, active_r * 0.5, score_color);

        // White core highlight
        painter.circle_filled(center, active_r * 0.2, Color32::WHITE.linear_multiply(0.8));
    }

    fn draw_orbitals(&self, painter: &Painter, center: Pos2, radius: f32, t: f32, parallax: Vec2) {
        use crate::theme;
        let orbital_count = 6;
        for i in 0..orbital_count {
            let orbit_r = radius * (0.5 + (i as f32 * 0.15));
            let orbit_speed = 0.3 + (i as f32 * 0.2);
            let angle = t * orbit_speed + (i as f32 * 1.5);

            // Add a slight extra parallax sensitivity to the orbitals for depth
            let pos = center
                + Vec2::new(angle.cos() * orbit_r, angle.sin() * orbit_r)
                + parallax * (i as f32 * 0.3);

            // Orbital dot
            painter.circle_filled(pos, 2.0, theme::chart_color(theme::AI));

            // Sub-glow
            painter.circle_filled(pos, 4.0, theme::chart_color(theme::AI).linear_multiply(0.2));

            // Connector line (subtle)
            painter.line_segment(
                [center, pos],
                Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::chart_color(theme::AI).linear_multiply(0.05),
                ),
            );
        }
    }

    fn draw_hud(&self, painter: &Painter, center: Pos2, radius: f32) {
        use crate::theme;
        let color = theme::chart_color(theme::AI).linear_multiply(0.3);

        // Crosshair lines
        let len = radius * 1.2;
        painter.line_segment(
            [
                center - Vec2::new(len, 0.0),
                center - Vec2::new(radius * 1.1, 0.0),
            ],
            Stroke::new(theme::BORDER_THIN, color),
        );
        painter.line_segment(
            [
                center + Vec2::new(len, 0.0),
                center + Vec2::new(radius * 1.1, 0.0),
            ],
            Stroke::new(theme::BORDER_THIN, color),
        );
        painter.line_segment(
            [
                center - Vec2::new(0.0, len),
                center - Vec2::new(0.0, radius * 1.1),
            ],
            Stroke::new(theme::BORDER_THIN, color),
        );
        painter.line_segment(
            [
                center + Vec2::new(0.0, len),
                center + Vec2::new(0.0, radius * 1.1),
            ],
            Stroke::new(theme::BORDER_THIN, color),
        );
    }

    /// Helper to draw a circular arc.
    fn draw_arc(
        &self,
        painter: &Painter,
        center: Pos2,
        radius: f32,
        start_angle: f32,
        end_angle: f32,
        stroke: Stroke,
    ) {
        let points: Vec<Pos2> = (0..=10)
            .map(|i| {
                let t = i as f32 / 10.0;
                let angle = start_angle + (end_angle - start_angle) * t;
                center + Vec2::new(angle.cos() * radius, angle.sin() * radius)
            })
            .collect();
        painter.add(egui::Shape::line(points, stroke));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repaint_delay(processing: bool, voice: VoiceState, reduced: bool) -> std::time::Duration {
        let ctx = egui::Context::default();
        crate::theme::set_reduced_motion(reduced);
        let mut output = Default::default();
        for frame in 0..6 {
            output = ctx.run(
                egui::RawInput {
                    time: Some(frame as f64),
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        SentinelAICore::new(80.0)
                            .processing(processing)
                            .voice(voice)
                            .show(ui, 60.0);
                    });
                },
            );
        }
        crate::theme::set_reduced_motion(false);
        let output: egui::FullOutput = output;
        output.viewport_output[&egui::ViewportId::ROOT].repaint_delay
    }

    #[test]
    fn idle_and_reduced_motion_do_not_schedule_decorative_frames() {
        for (processing, voice, reduced) in [
            (false, VoiceState::Idle, false),
            (true, VoiceState::Idle, true),
            (false, VoiceState::Listening(0.5), true),
            (false, VoiceState::Speaking(0.5), true),
        ] {
            assert!(repaint_delay(processing, voice, reduced) >= std::time::Duration::from_secs(1));
        }
    }

    #[test]
    fn active_core_is_animated_at_the_ambient_pace() {
        for (processing, voice) in [
            (true, VoiceState::Idle),
            (false, VoiceState::Listening(0.5)),
            (false, VoiceState::Speaking(0.5)),
        ] {
            let delay = repaint_delay(processing, voice, false);
            assert!(delay < std::time::Duration::from_secs(1));
            assert!(
                delay.saturating_add(std::time::Duration::from_secs_f32(1.0 / 60.0))
                    >= crate::animation::AMBIENT_FRAME
            );
        }
    }
}
