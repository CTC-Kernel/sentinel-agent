// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
            ui.add_space(theme::BORDER_THICK);
            let (icon, color) = match validation.status {
                InputValidation::Invalid => (
                    crate::icons::CIRCLE_XMARK,
                    theme::readable_color(theme::ERROR),
                ),
                InputValidation::Warning => {
                    (crate::icons::WARNING, theme::readable_color(theme::WARNING))
                }
                InputValidation::Valid => (
                    crate::icons::CIRCLE_CHECK,
                    theme::readable_color(theme::SUCCESS),
                ),
                InputValidation::None => ("", theme::text_tertiary()),
            };
            ui.horizontal(|ui: &mut egui::Ui| {
                if !icon.is_empty() {
                    ui.label(
                        egui::RichText::new(icon)
                            .font(theme::font_label())
                            .color(color),
                    );
                    ui.add_space(theme::BORDER_THICK);
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
            ui.add_space(theme::BORDER_THICK);
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
    let desired_width = ui.available_width().min(theme::MODAL_WIDTH);
    let input_height = theme::INPUT_HEIGHT;

    // Determine border color based on validation
    let (border_color, icon_color) = match &validation {
        InputValidation::None => (theme::border(), None),
        InputValidation::Valid => (
            theme::readable_color(theme::SUCCESS),
            Some(theme::readable_color(theme::SUCCESS)),
        ),
        InputValidation::Invalid => (
            theme::readable_color(theme::ERROR),
            Some(theme::readable_color(theme::ERROR)),
        ),
        InputValidation::Warning => (
            theme::readable_color(theme::WARNING),
            Some(theme::readable_color(theme::WARNING)),
        ),
    };

    // Calculate space needed for icons
    let clear_space = if clearable && !value.is_empty() {
        theme::TAB_BADGE_WIDTH
    } else {
        0.0
    };
    let validation_space = if validation != InputValidation::None {
        theme::ICON_LG
    } else {
        0.0
    };
    let right_padding = clear_space + validation_space + theme::SPACE_SM;

    // Container frame. A click on the padding focuses the editor, so the
    // whole field is the target, not only the text inside it.
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(desired_width, input_height), Sense::click());

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);

        // A field sits one step above the canvas, not in a well below it:
        // bg_deep is the terminal's inset surface, and using it here made
        // every form look like a console on top of a card.
        let fill = if response.hovered() {
            theme::bg_elevated()
        } else {
            theme::bg_tertiary()
        };
        painter.rect(
            rect,
            egui::CornerRadius::same(theme::INPUT_ROUNDING),
            fill,
            egui::Stroke::new(theme::BORDER_THIN, border_color),
            egui::epaint::StrokeKind::Inside,
        );
    }

    // Text edit area (slightly inset)
    let text_rect = egui::Rect::from_min_size(
        rect.min + egui::vec2(theme::SPACE_MD, theme::SPACE_XS),
        egui::vec2(
            desired_width - theme::SPACE_LG - right_padding,
            input_height - theme::SPACE_SM,
        ),
    );

    let text_response = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
        ui.set_clip_rect(text_rect.intersect(ui.clip_rect()));
        ui.add_sized(
            text_rect.size(),
            egui::TextEdit::singleline(value)
                .hint_text(egui::RichText::new(placeholder).color(theme::text_tertiary()))
                .font(theme::font_body())
                .margin(egui::Margin::symmetric(
                    0,
                    (theme::SPACE_XS + theme::BORDER_THICK) as i8,
                ))
                .frame(false)
                .desired_width(text_rect.width()),
        )
    });
    if response.clicked() {
        text_response.inner.request_focus();
    }

    // Focus ring when the editor is active (WCAG 2.4.7). The editor owns
    // the focus, not the frame, so it is asked rather than the frame.
    if text_response.inner.has_focus() && ui.is_rect_visible(rect) {
        ui.painter().rect_stroke(
            rect,
            egui::CornerRadius::same(theme::INPUT_ROUNDING),
            theme::focus_ring(),
            egui::epaint::StrokeKind::Inside,
        );
    }

    // Validation icon
    if let Some(color) = icon_color {
        let icon = match validation {
            InputValidation::Valid => icons::CIRCLE_CHECK,
            InputValidation::Invalid => icons::CIRCLE_XMARK,
            InputValidation::Warning => icons::WARNING,
            InputValidation::None => "",
        };

        let icon_pos = egui::pos2(rect.max.x - clear_space - theme::ICON_MD, rect.center().y);

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
            egui::pos2(rect.max.x - theme::SPACE, rect.center().y),
            egui::vec2(theme::ICON_MD, theme::ICON_MD),
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
            theme::badge_text(theme::WARNING)
        } else {
            theme::text_tertiary()
        };

        ui.painter().text(
            egui::pos2(rect.max.x - theme::SPACE_SM, rect.max.y + theme::SPACE_XS),
            egui::Align2::RIGHT_TOP,
            count_text,
            theme::font_label(),
            count_color,
        );
    }

    text_response.inner
}

/// Search input with icon, at the width the caller has.
pub fn search_input(ui: &mut Ui, value: &mut String, placeholder: &str) -> Response {
    SearchInput::new(value, placeholder).show(ui).response
}

/// What a [`SearchInput`] reports for the frame.
pub struct SearchInputResponse {
    /// The editor's response: `changed()`, `has_focus()`, `lost_focus()`.
    pub response: Response,
    /// Enter was pressed while the field had focus.
    pub submitted: bool,
    /// The value was emptied this frame, by the clear button or Escape.
    pub cleared: bool,
}

/// The one search field of the product.
///
/// A framed, magnifier-prefixed editor with a focus ring, a clear button
/// once there is something to clear, and Escape to empty it without
/// leaving it. Every search on every page is this widget, so the field the
/// user learns on the vulnerabilities page is the field they meet in the
/// terminal, the log well and the palette.
pub struct SearchInput<'a> {
    value: &'a mut String,
    placeholder: &'a str,
    width: Option<f32>,
    height: f32,
    font: Option<egui::FontId>,
    id_salt: Option<egui::Id>,
    autofocus: bool,
}

impl<'a> SearchInput<'a> {
    pub fn new(value: &'a mut String, placeholder: &'a str) -> Self {
        Self {
            value,
            placeholder,
            width: None,
            height: theme::INPUT_HEIGHT,
            font: None,
            id_salt: None,
            autofocus: false,
        }
    }

    /// Exact width; the default fills the available width.
    pub fn width(mut self, width: f32) -> Self {
        self.width = Some(width);
        self
    }

    /// Field height; [`theme::SEARCH_INPUT_HEIGHT`] for a filter row, the
    /// default [`theme::INPUT_HEIGHT`] for a form.
    pub fn height(mut self, height: f32) -> Self {
        self.height = height;
        self
    }

    /// Text font; the body font by default.
    pub fn font(mut self, font: egui::FontId) -> Self {
        self.font = Some(font);
        self
    }

    /// Stable id when several fields share a parent.
    pub fn id_salt(mut self, salt: impl std::hash::Hash) -> Self {
        self.id_salt = Some(egui::Id::new(salt));
        self
    }

    /// Take keyboard focus as soon as the field appears.
    pub fn autofocus(mut self, autofocus: bool) -> Self {
        self.autofocus = autofocus;
        self
    }

    pub fn show(self, ui: &mut Ui) -> SearchInputResponse {
        let width = self
            .width
            .unwrap_or_else(|| ui.available_width())
            .min(ui.available_width())
            .max(theme::MIN_TOUCH_TARGET * 2.0);
        let (field, frame_response) =
            ui.allocate_exact_size(egui::vec2(width, self.height), Sense::hover());
        let editor_id = ui.id().with(
            self.id_salt
                .unwrap_or_else(|| egui::Id::new("search_editor")),
        );
        let focused = ui.memory(|memory| memory.has_focus(editor_id));
        let radius = egui::CornerRadius::same(theme::INPUT_ROUNDING);
        let mut cleared = false;

        // Escape empties a focused field but leaves the focus where it is, so
        // a second query can be typed straight away.
        if focused
            && !self.value.is_empty()
            && ui.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        {
            self.value.clear();
            cleared = true;
        }

        if ui.is_rect_visible(field) {
            let painter = ui.painter();
            let fill = if frame_response.hovered() || focused {
                theme::bg_elevated()
            } else {
                theme::bg_tertiary()
            };
            painter.rect(
                field,
                radius,
                fill,
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                egui::epaint::StrokeKind::Inside,
            );
            painter.text(
                egui::pos2(field.left() + theme::SPACE_MD, field.center().y),
                egui::Align2::LEFT_CENTER,
                icons::SEARCH,
                theme::font_icon(theme::ICON_XS),
                if focused {
                    theme::accent_text()
                } else {
                    theme::text_tertiary()
                },
            );
        }

        // Room for the clear button on the trailing edge, whether or not it
        // is showing, so the text does not jump when it appears.
        let clear_slot = theme::MIN_TOUCH_TARGET;
        let text_rect = egui::Rect::from_min_max(
            egui::pos2(
                field.left() + theme::SPACE_MD + theme::ICON_XS + theme::SPACE_SM,
                field.top(),
            ),
            egui::pos2(field.right() - clear_slot, field.bottom()),
        );
        let font = self.font.unwrap_or_else(theme::font_body_sm);
        let editor = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
            // Clip the editor to the frame: a long value scrolls under the
            // magnifier and the clear button instead of painting over them.
            ui.set_clip_rect(text_rect.intersect(ui.clip_rect()));
            ui.add_sized(
                text_rect.size(),
                egui::TextEdit::singleline(self.value)
                    .id(editor_id)
                    .hint_text(egui::RichText::new(self.placeholder).color(theme::text_tertiary()))
                    .font(font)
                    .vertical_align(egui::Align::Center)
                    .text_color(theme::text_primary())
                    .frame(false)
                    .margin(egui::Margin::ZERO)
                    .desired_width(text_rect.width()),
            )
        });
        let response = editor.inner;
        if self.autofocus && !response.has_focus() {
            response.request_focus();
        }
        response.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::TextEdit,
                ui.is_enabled(),
                self.placeholder,
            )
        });

        if response.has_focus() {
            ui.memory_mut(|memory| {
                memory.set_focus_lock_filter(
                    editor_id,
                    egui::EventFilter {
                        horizontal_arrows: true,
                        vertical_arrows: false,
                        escape: !self.value.is_empty(),
                        ..Default::default()
                    },
                )
            });
            ui.painter().rect_stroke(
                field,
                radius,
                theme::focus_ring(),
                egui::epaint::StrokeKind::Inside,
            );
        }
        let submitted = response.has_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));

        if !self.value.is_empty() {
            let clear_rect = egui::Rect::from_center_size(
                egui::pos2(field.right() - clear_slot / 2.0, field.center().y),
                egui::vec2(clear_slot - theme::SPACE_XS, self.height - theme::SPACE_XS),
            );
            let clear = ui
                .put(
                    clear_rect,
                    egui::Button::new(
                        egui::RichText::new(icons::XMARK)
                            .font(theme::font_icon(theme::ICON_XS))
                            .color(theme::text_tertiary()),
                    )
                    .frame(false),
                )
                .on_hover_text("Effacer la recherche · Échap");
            clear.widget_info(|| {
                egui::WidgetInfo::labeled(
                    egui::WidgetType::Button,
                    ui.is_enabled(),
                    "Effacer la recherche",
                )
            });
            if clear.hovered() {
                ui.painter().text(
                    clear_rect.center(),
                    egui::Align2::CENTER_CENTER,
                    icons::XMARK,
                    theme::font_icon(theme::ICON_XS),
                    theme::text_primary(),
                );
            }
            if clear.clicked() {
                self.value.clear();
                cleared = true;
                response.request_focus();
            }
        }

        // The inset editor must not move the next widget inside the field.
        ui.advance_cursor_after_rect(field);

        SearchInputResponse {
            response,
            submitted,
            cleared,
        }
    }
}

/// What a [`PasswordInput`] reports for the frame.
pub struct PasswordInputResponse {
    /// The editor's response.
    pub response: Response,
    /// Enter was pressed while the field had focus.
    pub submitted: bool,
}

/// A secret field: the product's framed input with a lock, the value
/// masked, and an eye control that reveals it while it is needed.
///
/// The enrolment token, the administrator password and the unlock dialog
/// each drew a bare `TextEdit` beside a loose eye button; this is the one
/// field they share.
pub struct PasswordInput<'a> {
    value: &'a mut String,
    placeholder: &'a str,
    revealed: &'a mut bool,
    width: Option<f32>,
    id_salt: Option<egui::Id>,
    autofocus: bool,
    mono: bool,
}

impl<'a> PasswordInput<'a> {
    pub fn new(value: &'a mut String, placeholder: &'a str, revealed: &'a mut bool) -> Self {
        Self {
            value,
            placeholder,
            revealed,
            width: None,
            id_salt: None,
            autofocus: false,
            mono: true,
        }
    }

    /// Exact width; the default fills the available width.
    pub fn width(mut self, width: f32) -> Self {
        self.width = Some(width);
        self
    }

    /// Stable id when several fields share a parent.
    pub fn id_salt(mut self, salt: impl std::hash::Hash) -> Self {
        self.id_salt = Some(egui::Id::new(salt));
        self
    }

    /// Take keyboard focus as soon as the field appears.
    pub fn autofocus(mut self, autofocus: bool) -> Self {
        self.autofocus = autofocus;
        self
    }

    /// Body font instead of monospace (for a passphrase rather than a token).
    pub fn proportional(mut self) -> Self {
        self.mono = false;
        self
    }

    pub fn show(self, ui: &mut Ui) -> PasswordInputResponse {
        let width = self
            .width
            .unwrap_or_else(|| ui.available_width())
            .min(ui.available_width())
            .max(theme::MIN_TOUCH_TARGET * 3.0);
        let height = theme::INPUT_HEIGHT;
        let (field, frame_response) =
            ui.allocate_exact_size(egui::vec2(width, height), Sense::click());
        let editor_id = ui.id().with(
            self.id_salt
                .unwrap_or_else(|| egui::Id::new("password_editor")),
        );
        let focused = ui.memory(|memory| memory.has_focus(editor_id));
        let radius = egui::CornerRadius::same(theme::INPUT_ROUNDING);

        if ui.is_rect_visible(field) {
            let fill = if frame_response.hovered() || focused {
                theme::bg_elevated()
            } else {
                theme::bg_tertiary()
            };
            ui.painter().rect(
                field,
                radius,
                fill,
                egui::Stroke::new(theme::BORDER_THIN, theme::border()),
                egui::epaint::StrokeKind::Inside,
            );
            ui.painter().text(
                egui::pos2(field.left() + theme::SPACE_MD, field.center().y),
                egui::Align2::LEFT_CENTER,
                icons::LOCK,
                theme::font_icon(theme::ICON_XS),
                if focused {
                    theme::accent_text()
                } else {
                    theme::text_tertiary()
                },
            );
        }

        let slot = theme::MIN_TOUCH_TARGET;
        let text_rect = egui::Rect::from_min_max(
            egui::pos2(
                field.left() + theme::SPACE_MD + theme::ICON_XS + theme::SPACE_SM,
                field.top(),
            ),
            egui::pos2(field.right() - slot, field.bottom()),
        );
        let font = if self.mono {
            theme::font_mono()
        } else {
            theme::font_body()
        };
        let editor = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
            ui.set_clip_rect(text_rect.intersect(ui.clip_rect()));
            ui.add_sized(
                text_rect.size(),
                egui::TextEdit::singleline(self.value)
                    .id(editor_id)
                    .password(!*self.revealed)
                    .hint_text(egui::RichText::new(self.placeholder).color(theme::text_tertiary()))
                    .font(font)
                    .vertical_align(egui::Align::Center)
                    .text_color(theme::text_primary())
                    .frame(false)
                    .margin(egui::Margin::ZERO)
                    .desired_width(text_rect.width()),
            )
        });
        let response = editor.inner;
        if (self.autofocus && !response.has_focus() && !ui.input(|i| i.pointer.any_click()))
            || frame_response.clicked()
        {
            response.request_focus();
        }
        response.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::TextEdit,
                ui.is_enabled(),
                self.placeholder,
            )
        });
        if response.has_focus() {
            ui.painter().rect_stroke(
                field,
                radius,
                theme::focus_ring(),
                egui::epaint::StrokeKind::Inside,
            );
        }
        let submitted = response.has_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));

        // Reveal toggle on the trailing edge.
        let eye_rect = egui::Rect::from_center_size(
            egui::pos2(field.right() - slot / 2.0, field.center().y),
            egui::vec2(slot - theme::SPACE_XS, height - theme::SPACE_XS),
        );
        let (icon, hint) = if *self.revealed {
            (icons::EYE_SLASH, "Masquer")
        } else {
            (icons::EYE, "Afficher")
        };
        let eye = ui
            .put(
                eye_rect,
                egui::Button::new(
                    egui::RichText::new(icon)
                        .font(theme::font_icon(theme::ICON_SM))
                        .color(theme::text_tertiary()),
                )
                .frame(false),
            )
            .on_hover_text(hint);
        eye.widget_info(|| {
            egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), hint)
        });
        if eye.clicked() {
            *self.revealed = !*self.revealed;
        }

        ui.advance_cursor_after_rect(field);
        PasswordInputResponse {
            response,
            submitted,
        }
    }
}
