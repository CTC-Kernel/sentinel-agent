//! Loading and error state widgets for data pages.

use crate::theme;
use egui::{Color32, CornerRadius, Ui};

/// Render a shimmer/skeleton loading placeholder.
pub fn loading_skeleton(ui: &mut Ui, rows: usize) {
    let time = ui.input(|i| i.time) as f32;
    let avail_width = ui.available_width();

    for i in 0..rows {
        let row_rect = ui.allocate_space(egui::vec2(avail_width, 36.0)).1;

        // Shimmer effect: moving highlight
        let phase = (time * 1.5 + i as f32 * 0.15).sin() * 0.5 + 0.5;
        let base_alpha = 0.06 + phase * 0.04;
        let fill = if theme::is_dark_mode() {
            Color32::from_white_alpha((base_alpha * 255.0).clamp(0.0, 255.0) as u8)
        } else {
            Color32::from_black_alpha((base_alpha * 255.0).clamp(0.0, 255.0) as u8)
        };

        ui.painter()
            .rect_filled(row_rect, CornerRadius::same(6), fill);

        // Simulate columns with varying widths
        let col_widths = [0.15, 0.25, 0.35, 0.15];
        let mut x = row_rect.min.x + 8.0;
        for &w in &col_widths {
            let col_rect = egui::Rect::from_min_size(
                egui::pos2(x, row_rect.min.y + 10.0),
                egui::vec2(avail_width * w - 16.0, 16.0),
            );
            let col_alpha = base_alpha * 1.5;
            let col_fill = if theme::is_dark_mode() {
                Color32::from_white_alpha((col_alpha * 255.0).clamp(0.0, 255.0) as u8)
            } else {
                Color32::from_black_alpha((col_alpha * 255.0).clamp(0.0, 255.0) as u8)
            };
            ui.painter()
                .rect_filled(col_rect, CornerRadius::same(4), col_fill);
            x += avail_width * w;
        }
    }

    ui.ctx().request_repaint();
}

/// Render an error state with icon, message, and optional retry button.
pub fn error_state(ui: &mut Ui, message: &str) -> bool {
    let mut retry = false;

    ui.vertical_centered(|ui| {
        ui.add_space(40.0);

        // Error icon
        ui.label(
            egui::RichText::new("\u{f06a}") // fa-circle-exclamation
                .font(egui::FontId::proportional(40.0))
                .color(theme::ERROR.linear_multiply(0.7)),
        );

        ui.add_space(12.0);

        ui.label(
            egui::RichText::new("Erreur de chargement")
                .font(theme::font_heading())
                .color(theme::text_primary()),
        );

        ui.add_space(4.0);

        ui.label(
            egui::RichText::new(message)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );

        ui.add_space(16.0);

        if crate::widgets::button::secondary_button(ui, "Réessayer", true).clicked() {
            retry = true;
        }

        ui.add_space(40.0);
    });

    retry
}
