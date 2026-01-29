//! Page header widget.

use egui::Ui;

use crate::theme;

/// Draw a page header with title and optional subtitle.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>) {
    ui.label(
        egui::RichText::new(title)
            .font(theme::font_title())
            .color(theme::TEXT_PRIMARY)
            .strong(),
    );
    if let Some(sub) = subtitle {
        ui.label(
            egui::RichText::new(sub)
                .font(theme::font_body())
                .color(theme::TEXT_SECONDARY),
        );
    }
    ui.add_space(theme::SPACE);
}
