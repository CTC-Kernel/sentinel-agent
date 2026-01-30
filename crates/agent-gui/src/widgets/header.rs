//! Page header widget.

use egui::Ui;

use crate::theme;

/// Draw a page header with title and optional subtitle.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>) {
    ui.vertical(|ui| {
        ui.label(
            egui::RichText::new(title)
                .font(theme::font_comex())
                .color(theme::TEXT_PRIMARY)
                .strong(),
        );
        if let Some(sub) = subtitle {
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(sub)
                    .font(theme::font_body())
                    .color(theme::TEXT_TERTIARY),
            );
        }
    });
}
