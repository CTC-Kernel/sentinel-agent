//! Checkbox and radio button widgets.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Checkbox size variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum CheckboxSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl CheckboxSize {
    fn dimensions(&self) -> (f32, egui::FontId) {
        match self {
            CheckboxSize::Small => (16.0, theme::font_small()),
            CheckboxSize::Medium => (20.0, theme::font_body()),
            CheckboxSize::Large => (24.0, theme::font_body()),
        }
    }
}

/// A premium styled checkbox.
pub struct Checkbox<'a> {
    label: &'a str,
    size: CheckboxSize,
    disabled: bool,
    indeterminate: bool,
}

impl<'a> Checkbox<'a> {
    /// Create a new checkbox with a label.
    pub fn new(label: &'a str) -> Self {
        Self {
            label,
            size: CheckboxSize::Medium,
            disabled: false,
            indeterminate: false,
        }
    }

    /// Set the checkbox size.
    pub fn size(mut self, size: CheckboxSize) -> Self {
        self.size = size;
        self
    }

    /// Disable the checkbox.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }

    /// Set indeterminate state (for parent checkboxes).
    pub fn indeterminate(mut self) -> Self {
        self.indeterminate = true;
        self
    }

    /// Show the checkbox. Returns true if state changed.
    pub fn show(self, ui: &mut Ui, checked: &mut bool) -> bool {
        let mut changed = false;
        let (box_size, font) = self.size.dimensions();

        let sense = if self.disabled {
            Sense::hover()
        } else {
            Sense::click()
        };

        let total_width = box_size
            + theme::SPACE_SM
            + ui.painter()
                .layout_no_wrap(self.label.to_string(), font.clone(), Color32::WHITE)
                .size()
                .x;

        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(total_width, box_size.max(theme::MIN_TOUCH_TARGET)), sense);

        if ui.is_rect_visible(rect) {
            let is_hovered = response.hovered() && !self.disabled;
            let box_rect = egui::Rect::from_min_size(
                egui::pos2(rect.min.x, rect.center().y - box_size / 2.0),
                egui::vec2(box_size, box_size),
            );

            // Box background
            let (bg_color, border_color) = if self.disabled {
                (theme::bg_tertiary(), theme::border())
            } else if *checked || self.indeterminate {
                (theme::ACCENT, theme::ACCENT)
            } else if is_hovered {
                (theme::hover_bg(), theme::ACCENT)
            } else {
                (theme::bg_secondary(), theme::border())
            };

            ui.painter().rect(
                box_rect,
                CornerRadius::same(4),
                bg_color,
                egui::Stroke::new(theme::BORDER_MEDIUM, border_color),
                egui::epaint::StrokeKind::Inside,
            );

            // Check mark or indeterminate mark
            let icon_color = if self.disabled {
                theme::text_tertiary()
            } else {
                theme::text_on_accent()
            };

            if self.indeterminate {
                // Horizontal line for indeterminate
                let line_y = box_rect.center().y;
                let padding = box_size * 0.25;
                ui.painter().line_segment(
                    [
                        egui::pos2(box_rect.min.x + padding, line_y),
                        egui::pos2(box_rect.max.x - padding, line_y),
                    ],
                    egui::Stroke::new(theme::BORDER_THICK, icon_color),
                );
            } else if *checked {
                ui.painter().text(
                    box_rect.center(),
                    egui::Align2::CENTER_CENTER,
                    icons::CHECK,
                    theme::font_small(),
                    icon_color,
                );
            }

            // Label
            let label_color = if self.disabled {
                theme::text_tertiary()
            } else {
                theme::text_primary()
            };

            ui.painter().text(
                egui::pos2(box_rect.max.x + theme::SPACE_SM, rect.center().y),
                egui::Align2::LEFT_CENTER,
                self.label,
                font,
                label_color,
            );

            // Focus ring
            if response.has_focus() {
                ui.painter().rect_stroke(
                    box_rect.expand(2.0),
                    CornerRadius::same(6),
                    egui::Stroke::new(theme::BORDER_THICK, theme::ACCENT.linear_multiply(theme::OPACITY_MEDIUM)),
                    egui::epaint::StrokeKind::Outside,
                );
            }
        }

        if !self.disabled && response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        if response.clicked() && !self.disabled {
            *checked = !*checked;
            changed = true;
        }

        changed
    }
}

/// A premium styled radio button.
pub struct RadioButton<'a> {
    label: &'a str,
    size: CheckboxSize,
    disabled: bool,
}

impl<'a> RadioButton<'a> {
    /// Create a new radio button with a label.
    pub fn new(label: &'a str) -> Self {
        Self {
            label,
            size: CheckboxSize::Medium,
            disabled: false,
        }
    }

    /// Set the radio button size.
    pub fn size(mut self, size: CheckboxSize) -> Self {
        self.size = size;
        self
    }

    /// Disable the radio button.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }

    /// Show the radio button. Returns true if clicked.
    pub fn show(self, ui: &mut Ui, selected: bool) -> bool {
        let mut clicked = false;
        let (box_size, font) = self.size.dimensions();

        let sense = if self.disabled {
            Sense::hover()
        } else {
            Sense::click()
        };

        let total_width = box_size
            + theme::SPACE_SM
            + ui.painter()
                .layout_no_wrap(self.label.to_string(), font.clone(), Color32::WHITE)
                .size()
                .x;

        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(total_width, box_size.max(theme::MIN_TOUCH_TARGET)), sense);

        if ui.is_rect_visible(rect) {
            let is_hovered = response.hovered() && !self.disabled;
            let center = egui::pos2(rect.min.x + box_size / 2.0, rect.center().y);
            let radius = box_size / 2.0;

            // Outer circle
            let (bg_color, border_color) = if self.disabled {
                (theme::bg_tertiary(), theme::border())
            } else if selected {
                (theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE), theme::ACCENT)
            } else if is_hovered {
                (theme::hover_bg(), theme::ACCENT)
            } else {
                (theme::bg_secondary(), theme::border())
            };

            ui.painter().circle(
                center,
                radius,
                bg_color,
                egui::Stroke::new(theme::BORDER_MEDIUM, border_color),
            );

            // Inner dot when selected
            if selected {
                let inner_color = if self.disabled {
                    theme::text_tertiary()
                } else {
                    theme::ACCENT
                };
                ui.painter()
                    .circle_filled(center, radius * 0.5, inner_color);
            }

            // Label
            let label_color = if self.disabled {
                theme::text_tertiary()
            } else {
                theme::text_primary()
            };

            ui.painter().text(
                egui::pos2(rect.min.x + box_size + theme::SPACE_SM, rect.center().y),
                egui::Align2::LEFT_CENTER,
                self.label,
                font,
                label_color,
            );

            // Focus ring
            if response.has_focus() {
                ui.painter().circle_stroke(
                    center,
                    radius + 3.0,
                    egui::Stroke::new(theme::BORDER_THICK, theme::ACCENT.linear_multiply(theme::OPACITY_MEDIUM)),
                );
            }
        }

        if !self.disabled && response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        if response.clicked() && !self.disabled {
            clicked = true;
        }

        clicked
    }
}

/// Radio button group.
pub struct RadioGroup<'a> {
    options: &'a [&'a str],
    disabled: bool,
    horizontal: bool,
}

impl<'a> RadioGroup<'a> {
    /// Create a new radio group.
    pub fn new(options: &'a [&'a str]) -> Self {
        Self {
            options,
            disabled: false,
            horizontal: false,
        }
    }

    /// Disable all options.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }

    /// Layout horizontally.
    pub fn horizontal(mut self) -> Self {
        self.horizontal = true;
        self
    }

    /// Show the radio group. Returns true if selection changed.
    pub fn show(self, ui: &mut Ui, selected: &mut usize) -> bool {
        let mut changed = false;
        let current_selected = *selected;
        let disabled = self.disabled;

        if self.horizontal {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = theme::SPACE;
                for (i, label) in self.options.iter().enumerate() {
                    let mut radio = RadioButton::new(label);
                    if disabled {
                        radio = radio.disabled();
                    }
                    if radio.show(ui, i == current_selected) {
                        *selected = i;
                        changed = true;
                    }
                }
            });
        } else {
            ui.vertical(|ui| {
                ui.spacing_mut().item_spacing.y = theme::SPACE_SM;
                for (i, label) in self.options.iter().enumerate() {
                    let mut radio = RadioButton::new(label);
                    if disabled {
                        radio = radio.disabled();
                    }
                    if radio.show(ui, i == current_selected) {
                        *selected = i;
                        changed = true;
                    }
                }
            });
        }

        changed
    }
}

/// Checkbox group for multi-select.
pub struct CheckboxGroup<'a> {
    options: &'a [&'a str],
    disabled: bool,
    horizontal: bool,
}

impl<'a> CheckboxGroup<'a> {
    /// Create a new checkbox group.
    pub fn new(options: &'a [&'a str]) -> Self {
        Self {
            options,
            disabled: false,
            horizontal: false,
        }
    }

    /// Disable all options.
    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }

    /// Layout horizontally.
    pub fn horizontal(mut self) -> Self {
        self.horizontal = true;
        self
    }

    /// Show the checkbox group. Returns true if any selection changed.
    pub fn show(self, ui: &mut Ui, selected: &mut Vec<bool>) -> bool {
        // Ensure selected vec is the right size
        selected.resize(self.options.len(), false);

        let mut changed = false;
        let disabled = self.disabled;

        if self.horizontal {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = theme::SPACE;
                for (i, label) in self.options.iter().enumerate() {
                    let mut cb = Checkbox::new(label);
                    if disabled {
                        cb = cb.disabled();
                    }
                    if cb.show(ui, &mut selected[i]) {
                        changed = true;
                    }
                }
            });
        } else {
            ui.vertical(|ui| {
                ui.spacing_mut().item_spacing.y = theme::SPACE_SM;
                for (i, label) in self.options.iter().enumerate() {
                    let mut cb = Checkbox::new(label);
                    if disabled {
                        cb = cb.disabled();
                    }
                    if cb.show(ui, &mut selected[i]) {
                        changed = true;
                    }
                }
            });
        }

        changed
    }
}

/// Simple checkbox.
pub fn checkbox(ui: &mut Ui, label: &str, checked: &mut bool) -> bool {
    Checkbox::new(label).show(ui, checked)
}

/// Simple radio button.
pub fn radio(ui: &mut Ui, label: &str, selected: bool) -> bool {
    RadioButton::new(label).show(ui, selected)
}

/// Radio group from options.
pub fn radio_group(ui: &mut Ui, options: &[&str], selected: &mut usize) -> bool {
    RadioGroup::new(options).show(ui, selected)
}

/// Horizontal radio group.
pub fn radio_group_horizontal(ui: &mut Ui, options: &[&str], selected: &mut usize) -> bool {
    RadioGroup::new(options).horizontal().show(ui, selected)
}

/// Checkbox group for multi-select.
pub fn checkbox_group(ui: &mut Ui, options: &[&str], selected: &mut Vec<bool>) -> bool {
    CheckboxGroup::new(options).show(ui, selected)
}

/// Switch/toggle styled checkbox.
pub fn switch(ui: &mut Ui, label: &str, on: &mut bool) -> bool {
    let mut changed = false;
    let switch_width = theme::SWITCH_WIDTH;
    let switch_height = theme::SWITCH_HEIGHT;
    let thumb_size = theme::SWITCH_THUMB_SIZE;

    let label_galley =
        ui.painter()
            .layout_no_wrap(label.to_string(), theme::font_body(), theme::text_primary());

    let total_width = switch_width + theme::SPACE_MD + label_galley.size().x;
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(total_width, switch_height), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let switch_rect =
            egui::Rect::from_min_size(rect.min, egui::vec2(switch_width, switch_height));

        // Track
        let track_color = if *on {
            theme::ACCENT
        } else {
            theme::bg_tertiary()
        };

        ui.painter().rect_filled(
            switch_rect,
            CornerRadius::same((switch_height / 2.0).min(255.0) as u8),
            track_color,
        );

        // Thumb
        let thumb_x = if *on {
            switch_rect.max.x - thumb_size / 2.0 - 3.0
        } else {
            switch_rect.min.x + thumb_size / 2.0 + 3.0
        };

        let thumb_center = egui::pos2(thumb_x, switch_rect.center().y);

        // Thumb shadow
        ui.painter().circle_filled(
            thumb_center + egui::vec2(0.0, 1.0),
            thumb_size / 2.0,
            Color32::from_black_alpha((theme::OPACITY_SUBTLE * 255.0) as u8),
        );

        // Thumb
        ui.painter()
            .circle_filled(thumb_center, thumb_size / 2.0, Color32::WHITE);

        // Hover effect
        if is_hovered {
            ui.painter().circle_filled(
                thumb_center,
                thumb_size / 2.0 + 4.0,
                if *on {
                    theme::ACCENT.linear_multiply(theme::OPACITY_TINT)
                } else {
                    theme::text_tertiary().linear_multiply(theme::OPACITY_TINT)
                },
            );
        }

        // Label
        ui.painter().galley(
            egui::pos2(
                switch_rect.max.x + theme::SPACE_MD,
                rect.center().y - label_galley.size().y / 2.0,
            ),
            label_galley,
            theme::text_primary(),
        );

        // Focus Ring (WCAG 2.4.7)
        if response.has_focus() {
            ui.painter().rect_stroke(
                switch_rect.expand(2.0),
                egui::CornerRadius::same((switch_height / 2.0 + 2.0).min(255.0) as u8),
                theme::focus_ring(),
                egui::epaint::StrokeKind::Outside,
            );
        }
    }

    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }

    if response.clicked() {
        *on = !*on;
        changed = true;
    }

    changed
}
