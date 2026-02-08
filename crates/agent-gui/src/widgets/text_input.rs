//! Premium styled text input widget.

use crate::icons;
use crate::theme;
use egui::{Response, Sense, Ui};

/// Validation state for text input.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum InputValidation {
    #[default]
    None,
    Valid,
    /// Invalid with an optional error message displayed below the input.
    Invalid,
    Warning,
}

/// Validation state with an error message for display.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ValidationState {
    pub status: InputValidation,
    pub message: Option<String>,
}

impl ValidationState {
    pub fn none() -> Self {
        Self {
            status: InputValidation::None,
            message: None,
        }
    }
    pub fn valid() -> Self {
        Self {
            status: InputValidation::Valid,
            message: None,
        }
    }
    pub fn invalid(msg: impl Into<String>) -> Self {
        Self {
            status: InputValidation::Invalid,
            message: Some(msg.into()),
        }
    }
    pub fn warning(msg: impl Into<String>) -> Self {
        Self {
            status: InputValidation::Warning,
            message: Some(msg.into()),
        }
    }
}

/// A form field wrapper that renders label + input + validation error + help text.
/// Returns the inner response from the input widget.
pub fn form_field(
    ui: &mut Ui,
    label: &str,
    value: &mut String,
    placeholder: &str,
    validation: &ValidationState,
    help: Option<&str>,
) -> Response {
    ui.vertical(|ui: &mut egui::Ui| {
        // Label
        ui.label(
            egui::RichText::new(label.to_uppercase())
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_TIGHT)
                .strong(),
        );
        ui.add_space(theme::SPACE_XS);

        // Input
        let response = text_input_with_options(
            ui,
            value,
            placeholder,
            validation.status.clone(),
            true,
            None,
        );

        // Validation error message
        if let Some(ref msg) = validation.message {
            ui.add_space(2.0);
            let (icon, color) = match validation.status {
                InputValidation::Invalid => (crate::icons::CIRCLE_XMARK, theme::ERROR),
                InputValidation::Warning => (crate::icons::WARNING, theme::WARNING),
                InputValidation::Valid => (crate::icons::CIRCLE_CHECK, theme::SUCCESS),
                InputValidation::None => ("", theme::text_tertiary()),
            };
            ui.horizontal(|ui: &mut egui::Ui| {
                if !icon.is_empty() {
                    ui.label(
                        egui::RichText::new(icon)
                            .font(theme::font_label())
                            .color(color),
                    );
                    ui.add_space(2.0);
                }
                ui.label(
                    egui::RichText::new(msg.as_str())
                        .font(theme::font_label())
                        .color(color),
                );
            });
        }

        // Help text
        if let Some(help_text) = help {
            ui.add_space(2.0);
            ui.label(
                egui::RichText::new(help_text)
                    .font(theme::font_label())
                    .color(theme::text_tertiary()),
            );
        }

        response
    })
    .inner
}

/// A premium-styled single-line text input.
pub fn text_input(ui: &mut Ui, value: &mut String, placeholder: &str) -> Response {
    text_input_with_options(ui, value, placeholder, InputValidation::None, false, None)
}

/// A premium-styled text input with clear button.
pub fn text_input_clearable(ui: &mut Ui, value: &mut String, placeholder: &str) -> Response {
    text_input_with_options(ui, value, placeholder, InputValidation::None, true, None)
}

/// A premium-styled text input with validation state.
pub fn text_input_validated(
    ui: &mut Ui,
    value: &mut String,
    placeholder: &str,
    validation: InputValidation,
) -> Response {
    text_input_with_options(ui, value, placeholder, validation, true, None)
}

/// A premium-styled text input with character limit.
pub fn text_input_with_limit(
    ui: &mut Ui,
    value: &mut String,
    placeholder: &str,
    max_chars: usize,
) -> Response {
    text_input_with_options(
        ui,
        value,
        placeholder,
        InputValidation::None,
        true,
        Some(max_chars),
    )
}

/// Full-featured text input with all options.
pub fn text_input_with_options(
    ui: &mut Ui,
    value: &mut String,
    placeholder: &str,
    validation: InputValidation,
    clearable: bool,
    max_chars: Option<usize>,
) -> Response {
    let desired_width = ui.available_width().min(400.0);
    let input_height = 40.0;

    // Determine border color based on validation
    let (border_color, icon_color) = match &validation {
        InputValidation::None => (theme::border(), None),
        InputValidation::Valid => (theme::SUCCESS, Some(theme::SUCCESS)),
        InputValidation::Invalid => (theme::ERROR, Some(theme::ERROR)),
        InputValidation::Warning => (theme::WARNING, Some(theme::WARNING)),
    };

    // Calculate space needed for icons
    let clear_space = if clearable && !value.is_empty() {
        28.0
    } else {
        0.0
    };
    let validation_space = if validation != InputValidation::None {
        24.0
    } else {
        0.0
    };
    let right_padding = clear_space + validation_space + 8.0;

    // Container frame
    let (rect, response) = ui.allocate_exact_size(
        egui::vec2(desired_width, input_height),
        Sense::click_and_drag(),
    );

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);

        // Background
        painter.rect(
            rect,
            egui::CornerRadius::same(theme::BUTTON_ROUNDING),
            theme::bg_secondary(),
            egui::Stroke::new(1.5, border_color),
            egui::epaint::StrokeKind::Inside,
        );

        // Focus ring when active
        if response.has_focus() {
            painter.rect_stroke(
                rect.expand(2.0),
                egui::CornerRadius::same(theme::BUTTON_ROUNDING + 2),
                egui::Stroke::new(2.0, theme::ACCENT.linear_multiply(0.5)),
                egui::epaint::StrokeKind::Outside,
            );
        }
    }

    // Text edit area (slightly inset)
    let text_rect = egui::Rect::from_min_size(
        rect.min + egui::vec2(12.0, 4.0),
        egui::vec2(desired_width - 24.0 - right_padding, input_height - 8.0),
    );

    let text_response = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
        ui.add_sized(
            text_rect.size(),
            egui::TextEdit::singleline(value)
                .hint_text(egui::RichText::new(placeholder).color(theme::text_tertiary()))
                .font(theme::font_body())
                .margin(egui::Margin::symmetric(0, 6))
                .frame(false)
                .desired_width(text_rect.width()),
        )
    });

    // Validation icon
    if let Some(color) = icon_color {
        let icon = match validation {
            InputValidation::Valid => icons::CIRCLE_CHECK,
            InputValidation::Invalid => icons::CIRCLE_XMARK,
            InputValidation::Warning => icons::WARNING,
            InputValidation::None => "",
        };

        let icon_pos = egui::pos2(rect.max.x - clear_space - 20.0, rect.center().y);

        ui.painter().text(
            icon_pos,
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_body(),
            color,
        );
    }

    // Clear button
    if clearable && !value.is_empty() {
        let clear_rect = egui::Rect::from_center_size(
            egui::pos2(rect.max.x - 16.0, rect.center().y),
            egui::vec2(20.0, 20.0),
        );

        let clear_response = ui.allocate_rect(clear_rect, Sense::click());
        let clear_hovered = clear_response.hovered();

        let clear_color = if clear_hovered {
            theme::text_primary()
        } else {
            theme::text_tertiary()
        };

        ui.painter().text(
            clear_rect.center(),
            egui::Align2::CENTER_CENTER,
            icons::XMARK,
            theme::font_small(),
            clear_color,
        );

        if clear_response.clicked() {
            value.clear();
        }
    }

    // Character count if max_chars is set
    if let Some(max) = max_chars {
        let char_count = value.chars().count();
        let count_text = format!("{}/{}", char_count, max);
        let count_color = if char_count > max {
            theme::ERROR
        } else if char_count > max * 9 / 10 {
            theme::WARNING
        } else {
            theme::text_tertiary()
        };

        ui.painter().text(
            egui::pos2(rect.max.x - 8.0, rect.max.y + 4.0),
            egui::Align2::RIGHT_TOP,
            count_text,
            theme::font_label(),
            count_color,
        );
    }

    text_response.inner
}

/// Search input with icon.
pub fn search_input(ui: &mut Ui, value: &mut String, placeholder: &str) -> Response {
    let desired_width = ui.available_width().min(400.0);
    let input_height = 40.0;

    let (rect, _) = ui.allocate_exact_size(egui::vec2(desired_width, input_height), Sense::hover());

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);

        // Background
        painter.rect(
            rect,
            egui::CornerRadius::same(theme::BUTTON_ROUNDING),
            theme::bg_secondary(),
            egui::Stroke::new(1.0, theme::border()),
            egui::epaint::StrokeKind::Inside,
        );

        // Search icon
        painter.text(
            egui::pos2(rect.min.x + 14.0, rect.center().y),
            egui::Align2::LEFT_CENTER,
            icons::SEARCH,
            theme::font_body(),
            theme::text_tertiary(),
        );
    }

    // Text edit area (after search icon)
    let text_rect = egui::Rect::from_min_size(
        rect.min + egui::vec2(36.0, 4.0),
        egui::vec2(desired_width - 72.0, input_height - 8.0),
    );

    let text_response = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
        ui.add_sized(
            text_rect.size(),
            egui::TextEdit::singleline(value)
                .hint_text(egui::RichText::new(placeholder).color(theme::text_tertiary()))
                .font(theme::font_body())
                .margin(egui::Margin::symmetric(0, 6))
                .frame(false)
                .desired_width(text_rect.width()),
        )
    });

    // Clear button when there's text
    if !value.is_empty() {
        let clear_rect = egui::Rect::from_center_size(
            egui::pos2(rect.max.x - 16.0, rect.center().y),
            egui::vec2(20.0, 20.0),
        );

        let clear_response = ui.allocate_rect(clear_rect, Sense::click());
        let clear_hovered = clear_response.hovered();

        ui.painter().text(
            clear_rect.center(),
            egui::Align2::CENTER_CENTER,
            icons::XMARK,
            theme::font_small(),
            if clear_hovered {
                theme::text_primary()
            } else {
                theme::text_tertiary()
            },
        );

        if clear_response.clicked() {
            value.clear();
        }
    }

    text_response.inner
}
