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
        let icon_alpha = if theme::is_reduced_motion() {
            theme::OPACITY_DISABLED + theme::OPACITY_TINT
        } else {
            let time = ui.input(|i| i.time);
            let pulse = ((time * theme::ANIM_PULSE_SPEED as f64).sin() * 0.5 + 0.5) as f32;
            // Limit breathing animation to ~10fps
            ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
            theme::OPACITY_DISABLED + pulse * theme::OPACITY_TINT
        };

        ui.label(
            RichText::new(icon)
                .size(theme::EMPTY_STATE_ICON)
                .color(theme::accent_text().linear_multiply(icon_alpha)),
        );

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
            ui.label(RichText::new(icon).size(theme::ICON_SM).color(theme::text_tertiary()));
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
                .size(theme::PENDING_SPINNER_SIZE)
                .color(theme::text_tertiary()),
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
        let size = theme::PENDING_SPINNER_SIZE;
        let (rect, _) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());

        let center = rect.center();
        let radius = size / 2.0 - theme::SPACE_XS;

        if theme::is_reduced_motion() {
            // Static spinner: just show all dots at full opacity
            let painter = ui.painter_at(rect);
            let num_dots: usize = 8;
            for i in 0..num_dots {
                let angle = (i as f32 / num_dots as f32) * std::f32::consts::TAU;
                let pos = center + egui::vec2(radius * angle.cos(), radius * angle.sin());
                painter.circle_filled(pos, theme::SPACE_XS, theme::ACCENT);
            }
        } else {
            // Draw spinning arc
            let time = ui.input(|i| i.time) as f32;
            let painter = ui.painter_at(rect);
            let num_dots: usize = 8;
            for i in 0..num_dots {
                let angle = time * theme::ANIM_SPINNER_SPEED as f32 + (i as f32 / num_dots as f32) * std::f32::consts::TAU;
                let alpha = theme::OPACITY_TINT + (i as f32 / num_dots as f32) * theme::OPACITY_STRONG;
                let pos = center + egui::vec2(radius * angle.cos(), radius * angle.sin());
                painter.circle_filled(pos, theme::SPACE_XS, theme::ACCENT.linear_multiply(alpha));
            }
            ui.ctx().request_repaint_after(std::time::Duration::from_millis(50));
        }

        ui.add_space(theme::SPACE_MD);

        ui.label(
            RichText::new(message)
                .font(theme::font_body())
                .color(theme::text_secondary()),
        );

        ui.add_space(theme::SPACE_XL);
    });
}
