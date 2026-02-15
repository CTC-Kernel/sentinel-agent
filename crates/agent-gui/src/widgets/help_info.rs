//! Contextual help widget.

use crate::icons;
use crate::theme;
use egui::Ui;

/// Draw a small help icon with a tooltip.
pub fn help_button(ui: &mut Ui, help_text: &str) {
    let text = egui::RichText::new(icons::INFO_CIRCLE)
        .font(theme::font_body())
        .color(theme::readable_color(theme::INFO));

    let response = ui.add(egui::Label::new(text).sense(egui::Sense::hover()));

    response.on_hover_ui(|ui: &mut egui::Ui| {
        ui.set_max_width(theme::TOOLTIP_MAX_WIDTH);
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new("AIDE CONTEXTUELLE")
                .font(theme::font_min())
                .color(theme::accent_text())
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

        if let Some(rest) = line.strip_prefix("- ") {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(egui::RichText::new("•").color(theme::accent_text()));
                render_line(ui, rest);
            });
        } else {
            render_line(ui, line);
        }
    }
}

/// Get the substring before the given byte position, safe for UTF-8.
/// `pos` must be a valid char boundary (as returned by `str::find`).
fn safe_split_at(s: &str, pos: usize) -> (&str, &str) {
    // str::find() always returns valid char boundaries, but guard anyway
    if s.is_char_boundary(pos) {
        s.split_at(pos)
    } else {
        (s, "")
    }
}

fn render_line(ui: &mut Ui, line: &str) {
    ui.horizontal_wrapped(|ui: &mut egui::Ui| {
        ui.spacing_mut().item_spacing.x = 0.0;

        let mut current = line;
        while !current.is_empty() {
            if let Some(start) = current.find("**") {
                // Text before bold
                let (before, after_marker) = safe_split_at(current, start);
                if !before.is_empty() {
                    ui.label(
                        egui::RichText::new(before)
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                }
                let remaining = &after_marker[2..]; // "**" is always 2 ASCII bytes
                if let Some(end) = remaining.find("**") {
                    // Bold text
                    let (bold_text, after_bold) = safe_split_at(remaining, end);
                    ui.label(
                        egui::RichText::new(bold_text)
                            .font(theme::font_body())
                            .color(theme::text_primary())
                            .strong(),
                    );
                    current = &after_bold[2..]; // skip closing "**"
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
                let (before, after_marker) = safe_split_at(current, start);
                if !before.is_empty() {
                    ui.label(
                        egui::RichText::new(before)
                            .font(theme::font_body())
                            .color(theme::text_primary()),
                    );
                }
                let remaining = &after_marker[1..]; // "`" is always 1 ASCII byte
                if let Some(end) = remaining.find('`') {
                    // Code text
                    let (code_text, after_code) = safe_split_at(remaining, end);
                    let code_color = theme::accent_text();
                    ui.add(egui::Label::new(
                        egui::RichText::new(code_text)
                            .font(theme::font_mono())
                            .color(code_color)
                            .background_color(theme::bg_tertiary()),
                    ));
                    current = &after_code[1..]; // skip closing "`"
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
