use crate::theme;
use egui::{RichText, Ui};

/// Renders a premium empty state with an icon, title, and optional description and action.
pub fn empty_state(ui: &mut Ui, icon: &str, title: &str, description: Option<&str>) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_XL);

        // Icon with animated subtle breathing effect
        let time = ui.input(|i| i.time);
        let pulse = ((time * 1.2).sin() * 0.5 + 0.5) as f32;
        let icon_alpha = 0.4 + pulse * 0.2;
        
        ui.label(
            RichText::new(icon)
                .size(64.0)
                .color(theme::text_tertiary().linear_multiply(icon_alpha)),
        );
        
        // Request repaint for smooth animation
        ui.ctx().request_repaint();

        ui.add_space(theme::SPACE_MD);

        // Title
        ui.label(
            RichText::new(title)
                .font(theme::font_heading())
                .color(theme::text_secondary())
                .strong(),
        );

        // Description
        if let Some(desc) = description {
            ui.add_space(theme::SPACE_XS);
            ui.label(
                RichText::new(desc)
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
        }

        ui.add_space(theme::SPACE_XL);
    });
}
