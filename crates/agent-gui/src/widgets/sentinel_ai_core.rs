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
        let size = Vec2::splat(radius * 2.2); // Extra space for aura
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());
        
        if ui.is_rect_visible(rect) {
            let painter = ui.painter();
            let mut center = rect.center();
            let reduced = crate::theme::is_reduced_motion();

            // Parallax effect on hover
            let mut parallax_offset = Vec2::ZERO;
            if !reduced
                && let Some(mouse_pos) = ui.input(|i| i.pointer.hover_pos()) {
                    let dist = center.distance(mouse_pos);
                    // If mouse is near the core, shift slightly towards mouse
                    if dist < radius * 3.0 {
                        let pull = (1.0 - (dist / (radius * 3.0))).max(0.0).powi(2);
                        parallax_offset = (mouse_pos - center) * 0.1 * pull;
                    }
                }

            // Apply parallax
            center += parallax_offset;
            
            // Time-based animation variables
            let time = if reduced { 0.0 } else { ui.input(|i| i.time) as f32 };
            let speed_mult = if self.is_processing { 2.5 } else { 1.0 };
            let t = time * speed_mult;

            // 1. Aura / Glow Background
            self.draw_aura(painter, center, radius, t);

            // 2. Rotating Rings
            self.draw_rings(painter, center, radius, t);

            // 3. Central Core
            self.draw_core(painter, center, radius, t);

            // 4. Data Orbitals (add parallax as an extra pull)
            if !reduced {
                self.draw_orbitals(painter, center, radius, t, parallax_offset);
            }

            // 5. Crosshair / HUD elements
            self.draw_hud(painter, center, radius);

            // Request next frame if animating
            if !reduced {
                ui.ctx().request_repaint();
            }
        }

        response
    }

    fn draw_aura(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        let mut base_color = theme::ACCENT;
        
        match self.voice_state {
            VoiceState::Listening(level) => {
                // Shift colour to a more "attentive" light blue/cyan,
                // brightening proportionally to the microphone level.
                base_color = theme::ACCENT_LIGHT.linear_multiply(1.0 + level * 0.5);
            }
            VoiceState::Speaking(vol) => {
                // Shift colour based on volume
                base_color = theme::ACCENT.linear_multiply(1.0 + vol * 0.5);
            }
            _ => {}
        }

        // Pulsing background wash
        let pulse = match self.voice_state {
            VoiceState::Listening(level) => (t * 1.5).sin() * 0.15 + 0.25 + level * 0.4,
            VoiceState::Speaking(vol) => 0.2 + vol * 0.4,
            _ => (t * 0.8).sin() * 0.1 + 0.15,
        };
        painter.circle_filled(center, radius * 1.3, base_color.linear_multiply(pulse * 0.5));

        // Circular wave ripples
        let passes = match self.voice_state {
            VoiceState::Speaking(vol) => 3 + (vol * 3.0) as usize,
            VoiceState::Listening(level) => 2 + (level * 4.0) as usize,
            _ => 2,
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
                Stroke::new(theme::BORDER_THIN, base_color.linear_multiply(alpha))
            );
        }
    }

    fn draw_rings(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        let color_primary = theme::ACCENT;
        let color_secondary = theme::ACCENT_LIGHT;

        // --- Outer Ring (Many small segments, slow CW) ---
        let outer_r = radius * 1.05;
        let outer_angle = t * 0.2;
        let seg_count = 32;
        for i in 0..seg_count {
            if i % 2 == 0 { continue; } // Gaps
            let start = outer_angle + (i as f32 / seg_count as f32) * TAU;
            let end = start + (0.5 / seg_count as f32) * TAU;
            self.draw_arc(painter, center, outer_r, start, end, Stroke::new(theme::BORDER_THIN, color_primary.linear_multiply(0.4)));
        }

        // --- Middle Ring (2 segments, CCW) ---
        let mid_r = radius * 0.85;
        let mid_angle = -t * 0.5;
        self.draw_arc(painter, center, mid_r, mid_angle, mid_angle + 1.2, Stroke::new(theme::BORDER_MEDIUM, color_secondary));
        self.draw_arc(painter, center, mid_r, mid_angle + TAU/2.0, mid_angle + TAU/2.0 + 1.2, Stroke::new(theme::BORDER_MEDIUM, color_secondary));

        // --- Inner Ring (4 segments, fast CW) ---
        let inner_r = radius * 0.65;
        let inner_angle = t * 1.2;
        for i in 0..4 {
            let start = inner_angle + (i as f32 / 4.0) * TAU;
            let end = start + 0.5;
            self.draw_arc(painter, center, inner_r, start, end, Stroke::new(theme::BORDER_THICK, color_primary));
        }
    }

    fn draw_core(&self, painter: &Painter, center: Pos2, radius: f32, t: f32) {
        use crate::theme;
        let score_color = theme::score_color(self.score);
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
            let pos = center + Vec2::new(angle.cos() * orbit_r, angle.sin() * orbit_r) + parallax * (i as f32 * 0.3);
            
            // Orbital dot
            painter.circle_filled(pos, 2.0, theme::ACCENT_LIGHT);
            
            // Sub-glow
            painter.circle_filled(pos, 4.0, theme::ACCENT_LIGHT.linear_multiply(0.2));
            
            // Connector line (subtle)
            painter.line_segment(
                [center, pos], 
                Stroke::new(theme::BORDER_HAIRLINE, theme::ACCENT_LIGHT.linear_multiply(0.05))
            );
        }
    }

    fn draw_hud(&self, painter: &Painter, center: Pos2, radius: f32) {
        use crate::theme;
        let color = theme::ACCENT.linear_multiply(0.3);
        
        // Crosshair lines
        let len = radius * 1.2;
        painter.line_segment([center - Vec2::new(len, 0.0), center - Vec2::new(radius * 1.1, 0.0)], Stroke::new(theme::BORDER_THIN, color));
        painter.line_segment([center + Vec2::new(len, 0.0), center + Vec2::new(radius * 1.1, 0.0)], Stroke::new(theme::BORDER_THIN, color));
        painter.line_segment([center - Vec2::new(0.0, len), center - Vec2::new(0.0, radius * 1.1)], Stroke::new(theme::BORDER_THIN, color));
        painter.line_segment([center + Vec2::new(0.0, len), center + Vec2::new(0.0, radius * 1.1)], Stroke::new(theme::BORDER_THIN, color));
    }

    /// Helper to draw a circular arc.
    fn draw_arc(&self, painter: &Painter, center: Pos2, radius: f32, start_angle: f32, end_angle: f32, stroke: Stroke) {
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
