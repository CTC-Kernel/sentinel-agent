//! Premium styled text input widget.

use crate::theme;
use egui::{Response, TextEdit, Ui};

/// A premium-styled single-line text input.
pub fn text_input(ui: &mut Ui, value: &mut String, placeholder: &str) -> Response {
    let desired_width = ui.available_width().min(400.0);

    ui.add_sized(
        [desired_width, 36.0],
        TextEdit::singleline(value)
            .hint_text(egui::RichText::new(placeholder).color(theme::text_tertiary()))
            .font(theme::font_body())
            .margin(egui::Margin::symmetric(12, 8))
            .desired_width(desired_width),
    )
}
