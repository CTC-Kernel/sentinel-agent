//! Contextual help widget.

use crate::icons;
use crate::theme;
use egui::Ui;

/// Draw a small help icon with a tooltip.
pub fn help_button(ui: &mut Ui, help_text: &str) {
    let text = egui::RichText::new(icons::INFO_CIRCLE)
        .size(14.0)
        .color(theme::text_tertiary());

    let response = ui.add(egui::Label::new(text).sense(egui::Sense::hover()));

    response.on_hover_ui(|ui: &mut egui::Ui| {
        ui.set_max_width(320.0);
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new("AIDE CONTEXTUELLE")
                .font(theme::font_min())
                .color(theme::ACCENT)
                .strong(),
        );
        ui.add_space(theme::SPACE_XS);

        render_markdown(ui, help_text);

        ui.add_space(theme::SPACE_XS);
    });
}

/// Simple markdown renderer for tooltips.
/// Supports **bold**, `code`, and - bullets.
fn render_markdown(ui: &mut Ui, text: &str) {
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            ui.add_space(theme::SPACE_XS);
            continue;
        }

        if line.starts_with("- ") {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(egui::RichText::new("•").color(theme::ACCENT));
                render_line(ui, &line[2..]);
            });
        } else {
            render_line(ui, line);
        }
    }
}

fn render_line(ui: &mut Ui, line: &str) {
    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
        ui.spacing_mut().item_spacing.x = 0.0;

        let mut current = line;
        while !current.is_empty() {
            if let Some(start) = current.find("**") {
                // Text before bold
                if start > 0 {
                    ui.label(
                        egui::RichText::new(&current[..start])
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                }
                let remaining = &current[start + 2..];
                if let Some(end) = remaining.find("**") {
                    // Bold text
                    ui.label(
                        egui::RichText::new(&remaining[..end])
                            .font(theme::font_body())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    current = &remaining[end + 2..];
                } else {
                    // Unclosed bold
                    ui.label(
                        egui::RichText::new("**")
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                    current = remaining;
                }
            } else if let Some(start) = current.find('`') {
                // Text before code
                if start > 0 {
                    ui.label(
                        egui::RichText::new(&current[..start])
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                }
                let remaining = &current[start + 1..];
                if let Some(end) = remaining.find('`') {
                    // Code text
                    ui.add(egui::Label::new(
                        egui::RichText::new(&remaining[..end])
                            .font(egui::FontId::monospace(12.0))
                            .color(theme::ACCENT)
                            .background_color(theme::bg_tertiary()),
                    ));
                    current = &remaining[end + 1..];
                } else {
                    ui.label(
                        egui::RichText::new("`")
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                    current = remaining;
                }
            } else {
                // Plain text
                ui.label(
                    egui::RichText::new(current)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                );
                break;
            }
        }
    });
}
