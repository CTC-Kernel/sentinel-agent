use egui::{RichText, Ui};
use crate::theme;

/// Renders a premium empty state with an icon, title, and optional description and action.
pub fn empty_state(
    ui: &mut Ui,
    icon: &str,
    title: &str,
    description: Option<&str>,
) {
    ui.vertical_centered(|ui| {
        ui.add_space(theme::SPACE_XL);
        
        // Icon with a subtle glow or large size
        ui.label(RichText::new(icon).size(64.0).color(theme::text_tertiary().linear_multiply(0.5)));
        
        ui.add_space(theme::SPACE_MD);
        
        // Title
        ui.label(RichText::new(title).font(theme::font_heading()).color(theme::text_secondary()).strong());
        
        // Description
        if let Some(desc) = description {
            ui.add_space(theme::SPACE_XS);
            ui.label(RichText::new(desc).font(theme::font_small()).color(theme::text_tertiary()));
        }
        
        ui.add_space(theme::SPACE_XL);
    });
}
