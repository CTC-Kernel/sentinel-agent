// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium voice interaction widgets.

use egui::{Response, Sense, Stroke, Ui};
use crate::theme;
use crate::icons;

/// A premium, animated voice toggle button.
/// 
/// Displays a microphone icon in a circular backdrop.
/// When listening, it features a glowing cyan pulse animation.
pub fn voice_toggle_button(ui: &mut Ui, is_listening: bool) -> Response {
    let size = theme::MIN_TOUCH_TARGET + 8.0; // Slightly larger for prominence
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();
        
        let t = ui.input(|i| i.time);
        
        // --- 1. Background Aura (Pulse) ---
        if is_listening && !theme::is_reduced_motion() {
            let pulse = (t * 4.0).sin().abs() as f32; // Pulse factor 0.0 -> 1.0
            let aura_radius = (size / 2.0) + (pulse * 6.0);
            let aura_color = theme::ACCENT.linear_multiply(0.2 * (1.0 - pulse));
            
            ui.painter().circle_filled(rect.center(), aura_radius, aura_color);
        }

        // --- 2. Main Backdrop ---
        let fill_color = if is_listening {
            theme::ACCENT.linear_multiply(0.15)
        } else if is_hovered {
            theme::bg_elevated()
        } else {
            theme::bg_secondary().linear_multiply(0.5)
        };

        let border_color = if is_listening {
            theme::ACCENT
        } else if is_hovered {
            theme::text_tertiary()
        } else {
            theme::separator()
        };

        let border_width = if is_listening { theme::BORDER_THICK } else { theme::BORDER_THIN };

        ui.painter().circle(
            rect.center(),
            size / 2.0,
            fill_color,
            Stroke::new(border_width, border_color),
        );

        // --- 3. Glow (Active) ---
        if is_listening {
            let glow_color = theme::ACCENT.linear_multiply(0.3);
            ui.painter().circle_stroke(
                rect.center(),
                (size / 2.0) + 1.0,
                Stroke::new(2.0, glow_color),
            );
        }

        // --- 4. Icon ---
        let icon = if is_listening { icons::MICROPHONE } else { icons::MICROPHONE_SLASH };
        let icon_color = if is_listening {
            theme::ACCENT
        } else if is_hovered {
            theme::text_primary()
        } else {
            theme::text_secondary()
        };

        let icon_size = if is_clicked { theme::ICON_SM } else { theme::ICON_MD };

        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            egui::FontId::proportional(icon_size),
            icon_color,
        );

        // Handle animation refresh
        if is_listening && !theme::is_reduced_motion() {
            ui.ctx().request_repaint();
        }
    }

    response.on_hover_text(if is_listening { 
        "Voice Assistant: ACTIF (cliquer pour désactiver)" 
    } else { 
        "Voice Assistant: INACTIF (cliquer pour activer)" 
    }).on_hover_cursor(egui::CursorIcon::PointingHand)
}
