//! Copy-to-clipboard button with visual feedback.

use egui::{Response, Ui};

use crate::icons;
use crate::theme;

/// A small icon button that copies text to clipboard and shows a brief check mark.
///
/// The button shows a copy icon normally, and a green check mark for ~1.5 seconds
/// after a successful copy.
pub fn copy_button(ui: &mut Ui, text_to_copy: &str, tooltip: Option<&str>) -> Response {
    let id = ui.make_persistent_id(("copy_btn", text_to_copy));
    let copied_at: Option<f64> = ui.memory(|mem| mem.data.get_temp(id));
    let now = ui.input(|i| i.time);

    let recently_copied = copied_at.is_some_and(|t| now - t < 1.5);

    let (icon, color) = if recently_copied {
        (icons::CHECK, theme::SUCCESS)
    } else {
        (icons::COPY, theme::text_secondary())
    };

    let response = super::button::icon_button_with_color(
        ui,
        icon,
        Some(tooltip.unwrap_or(if recently_copied {
            "Copié !"
        } else {
            "Copier"
        })),
        color,
    );

    if response.clicked() && !recently_copied {
        ui.ctx().copy_text(text_to_copy.to_string());
        ui.memory_mut(|mem| mem.data.insert_temp(id, now));
        // Request repaint so the check mark eventually disappears
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(1600));
    }

    // Keep requesting repaint while showing the check mark
    if recently_copied {
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(100));
    }

    response
}

/// Inline copyable text: renders the value with a small copy button next to it.
/// Returns true if the copy button was clicked.
pub fn copyable_value(ui: &mut Ui, value: &str) -> bool {
    let mut copied = false;
    ui.horizontal(|ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(value)
                .font(egui::FontId::monospace(11.0))
                .color(theme::text_primary()),
        );
        if copy_button(ui, value, None).clicked() {
            copied = true;
        }
    });
    copied
}
