//! Empty state widget for pages with no data.

use crate::theme;
use crate::widgets::button;
use egui::{RichText, Ui};

/// Renders a premium empty state with an icon, title, and optional description and action.
pub fn empty_state(ui: &mut Ui, icon: &str, title: &str, description: Option<&str>) {
    let _ = empty_state_with_action(ui, icon, title, description, None::<(&str, fn())>);
}

/// Renders an empty state with an optional action button.
/// Returns true if the action button was clicked.
pub fn empty_state_with_action<F: FnOnce()>(
    ui: &mut Ui,
    icon: &str,
    title: &str,
    description: Option<&str>,
    action: Option<(&str, F)>,
) -> bool {
    let mut clicked = false;

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

        // Limit breathing animation to ~10fps
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));

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

        // Action button
        if action.is_some() {
            ui.add_space(theme::SPACE_MD);
        }

        ui.add_space(theme::SPACE_XL);
    });

    // Handle action outside the closure to avoid borrow issues
    if let Some((label, callback)) = action {
        ui.vertical_centered(|ui| {
            if button::primary_button(ui, label, true).clicked() {
                clicked = true;
                callback();
            }
        });
    }

    clicked
}

/// A compact empty state for inline use (e.g., in tables, cards).
pub fn empty_state_compact(ui: &mut Ui, icon: &str, message: &str) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_MD);

        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(RichText::new(icon).size(16.0).color(theme::text_tertiary()));
            ui.add_space(theme::SPACE_XS);
            ui.label(
                RichText::new(message)
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
        });

        ui.add_space(theme::SPACE_MD);
    });
}

/// Empty state specifically for search results.
pub fn no_results_state(ui: &mut Ui, search_term: &str) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_LG);

        ui.label(
            RichText::new(crate::icons::SEARCH)
                .size(48.0)
                .color(theme::text_tertiary().linear_multiply(0.5)),
        );

        ui.add_space(theme::SPACE_MD);

        ui.label(
            RichText::new("Aucun résultat")
                .font(theme::font_heading())
                .color(theme::text_secondary())
                .strong(),
        );

        ui.add_space(theme::SPACE_XS);

        ui.label(
            RichText::new(format!("Aucun élément ne correspond à \"{}\"", search_term))
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );

        ui.add_space(theme::SPACE_SM);

        ui.label(
            RichText::new("Essayez avec d'autres termes ou supprimez les filtres.")
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );

        ui.add_space(theme::SPACE_LG);
    });
}

/// Empty state for loading/pending data.
pub fn pending_state(ui: &mut Ui, message: &str) {
    ui.vertical_centered(|ui: &mut egui::Ui| {
        ui.add_space(theme::SPACE_XL);

        // Animated spinner
        let time = ui.input(|i| i.time) as f32;
        let size = 48.0;
        let (rect, _) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());

        let center = rect.center();
        let radius = size / 2.0 - 4.0;

        // Draw spinning arc
        let painter = ui.painter_at(rect);
        let num_dots = 8;
        for i in 0..num_dots {
            let angle = time * 2.0 + (i as f32 / num_dots as f32) * std::f32::consts::TAU;
            let alpha = 0.2 + (i as f32 / num_dots as f32) * 0.8;
            let pos = center + egui::vec2(radius * angle.cos(), radius * angle.sin());
            painter.circle_filled(pos, 4.0, theme::ACCENT.linear_multiply(alpha));
        }

        ui.ctx().request_repaint();

        ui.add_space(theme::SPACE_MD);

        ui.label(
            RichText::new(message)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );

        ui.add_space(theme::SPACE_XL);
    });
}
