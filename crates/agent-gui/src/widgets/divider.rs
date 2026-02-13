//! Divider/separator widget with various styles.

use crate::theme;
use egui::{Color32, Ui};

/// Divider style variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum DividerStyle {
    #[default]
    Solid,
    Dashed,
    Dotted,
    Gradient,
}

/// Divider orientation.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum DividerOrientation {
    #[default]
    Horizontal,
    Vertical,
}

/// A divider/separator widget.
pub struct Divider<'a> {
    style: DividerStyle,
    orientation: DividerOrientation,
    color: Option<Color32>,
    thickness: f32,
    margin: f32,
    label: Option<&'a str>,
}

impl<'a> Divider<'a> {
    /// Create a new horizontal divider.
    pub fn horizontal() -> Self {
        Self {
            style: DividerStyle::Solid,
            orientation: DividerOrientation::Horizontal,
            color: None,
            thickness: 1.0,
            margin: theme::SPACE_MD,
            label: None,
        }
    }

    /// Create a new vertical divider.
    pub fn vertical() -> Self {
        Self {
            style: DividerStyle::Solid,
            orientation: DividerOrientation::Vertical,
            color: None,
            thickness: 1.0,
            margin: theme::SPACE_MD,
            label: None,
        }
    }

    /// Set the divider style.
    pub fn style(mut self, style: DividerStyle) -> Self {
        self.style = style;
        self
    }

    /// Set the divider color.
    pub fn color(mut self, color: Color32) -> Self {
        self.color = Some(color);
        self
    }

    /// Set the divider thickness.
    pub fn thickness(mut self, thickness: f32) -> Self {
        self.thickness = thickness;
        self
    }

    /// Set the vertical margin (for horizontal dividers).
    pub fn margin(mut self, margin: f32) -> Self {
        self.margin = margin;
        self
    }

    /// Add a centered label to the divider.
    pub fn label(mut self, label: &'a str) -> Self {
        self.label = Some(label);
        self
    }

    /// Show the divider.
    pub fn show(self, ui: &mut Ui) -> egui::Response {
        let color = self.color.unwrap_or_else(theme::border);

        match self.orientation {
            DividerOrientation::Horizontal => self.show_horizontal(ui, color),
            DividerOrientation::Vertical => self.show_vertical(ui, color),
        }
    }

    fn show_horizontal(self, ui: &mut Ui, color: Color32) -> egui::Response {
        ui.add_space(self.margin);

        let available_width = ui.available_width();

        if let Some(label_text) = self.label {
            // Divider with label
            let response = ui.horizontal(|ui| {
                let label_galley = ui.painter().layout_no_wrap(
                    label_text.to_string(),
                    theme::font_small(),
                    theme::text_tertiary(),
                );
                let label_width = label_galley.size().x + 16.0; // Add padding
                let line_width = (available_width - label_width) / 2.0;

                // Left line
                self.draw_line(ui, line_width, true, color);

                // Label
                ui.add_space(theme::SPACE_SM);
                ui.label(
                    egui::RichText::new(label_text)
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_SM);

                // Right line
                self.draw_line(ui, line_width, true, color);
            });

            ui.add_space(self.margin);
            response.response
        } else {
            // Simple divider
            let (rect, response) = ui.allocate_exact_size(
                egui::vec2(available_width, self.thickness),
                egui::Sense::hover(),
            );

            if ui.is_rect_visible(rect) {
                self.draw_line_at(ui, rect, true, color);
            }

            ui.add_space(self.margin);
            response
        }
    }

    fn show_vertical(self, ui: &mut Ui, color: Color32) -> egui::Response {
        let available_height = ui.available_height().min(200.0); // Reasonable default

        let (rect, response) = ui.allocate_exact_size(
            egui::vec2(self.thickness + self.margin * 2.0, available_height),
            egui::Sense::hover(),
        );

        if ui.is_rect_visible(rect) {
            let line_rect = egui::Rect::from_min_max(
                egui::pos2(rect.center().x - self.thickness / 2.0, rect.min.y),
                egui::pos2(rect.center().x + self.thickness / 2.0, rect.max.y),
            );
            self.draw_line_at(ui, line_rect, false, color);
        }

        response
    }

    fn draw_line(&self, ui: &mut Ui, length: f32, horizontal: bool, color: Color32) {
        let size = if horizontal {
            egui::vec2(length, self.thickness)
        } else {
            egui::vec2(self.thickness, length)
        };

        let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());

        if ui.is_rect_visible(rect) {
            self.draw_line_at(ui, rect, horizontal, color);
        }
    }

    fn draw_line_at(&self, ui: &Ui, rect: egui::Rect, horizontal: bool, color: Color32) {
        let painter = ui.painter();

        match self.style {
            DividerStyle::Solid => {
                painter.rect_filled(rect, 0, color);
            }
            DividerStyle::Dashed => {
                let dash_length = 8.0;
                let gap_length = 4.0;

                if horizontal {
                    let mut x = rect.min.x;
                    while x < rect.max.x {
                        let end_x = (x + dash_length).min(rect.max.x);
                        painter.line_segment(
                            [
                                egui::pos2(x, rect.center().y),
                                egui::pos2(end_x, rect.center().y),
                            ],
                            egui::Stroke::new(self.thickness, color),
                        );
                        x += dash_length + gap_length;
                    }
                } else {
                    let mut y = rect.min.y;
                    while y < rect.max.y {
                        let end_y = (y + dash_length).min(rect.max.y);
                        painter.line_segment(
                            [
                                egui::pos2(rect.center().x, y),
                                egui::pos2(rect.center().x, end_y),
                            ],
                            egui::Stroke::new(self.thickness, color),
                        );
                        y += dash_length + gap_length;
                    }
                }
            }
            DividerStyle::Dotted => {
                let dot_spacing = 6.0;

                if horizontal {
                    let mut x = rect.min.x;
                    while x < rect.max.x {
                        painter.circle_filled(
                            egui::pos2(x, rect.center().y),
                            self.thickness,
                            color,
                        );
                        x += dot_spacing;
                    }
                } else {
                    let mut y = rect.min.y;
                    while y < rect.max.y {
                        painter.circle_filled(
                            egui::pos2(rect.center().x, y),
                            self.thickness,
                            color,
                        );
                        y += dot_spacing;
                    }
                }
            }
            DividerStyle::Gradient => {
                // Gradient from transparent to color to transparent
                if horizontal {
                    let segments = 20;
                    let segment_width = rect.width() / segments as f32;

                    for i in 0..segments {
                        let t = i as f32 / segments as f32;
                        let alpha = if t < 0.5 { t * 2.0 } else { (1.0 - t) * 2.0 };
                        let segment_color = color.linear_multiply(alpha);

                        let segment_rect = egui::Rect::from_min_max(
                            egui::pos2(rect.min.x + i as f32 * segment_width, rect.min.y),
                            egui::pos2(rect.min.x + (i + 1) as f32 * segment_width, rect.max.y),
                        );
                        painter.rect_filled(segment_rect, 0, segment_color);
                    }
                } else {
                    let segments = 20;
                    let segment_height = rect.height() / segments as f32;

                    for i in 0..segments {
                        let t = i as f32 / segments as f32;
                        let alpha = if t < 0.5 { t * 2.0 } else { (1.0 - t) * 2.0 };
                        let segment_color = color.linear_multiply(alpha);

                        let segment_rect = egui::Rect::from_min_max(
                            egui::pos2(rect.min.x, rect.min.y + i as f32 * segment_height),
                            egui::pos2(rect.max.x, rect.min.y + (i + 1) as f32 * segment_height),
                        );
                        painter.rect_filled(segment_rect, 0, segment_color);
                    }
                }
            }
        }
    }
}

/// Simple horizontal divider.
pub fn divider(ui: &mut Ui) -> egui::Response {
    Divider::horizontal().show(ui)
}

/// Horizontal divider with label.
pub fn divider_with_label(ui: &mut Ui, label: &str) -> egui::Response {
    Divider::horizontal().label(label).show(ui)
}

/// Dashed horizontal divider.
pub fn divider_dashed(ui: &mut Ui) -> egui::Response {
    Divider::horizontal().style(DividerStyle::Dashed).show(ui)
}

/// Vertical divider.
pub fn divider_vertical(ui: &mut Ui) -> egui::Response {
    Divider::vertical().show(ui)
}

/// Gradient divider (fades at edges).
pub fn divider_gradient(ui: &mut Ui) -> egui::Response {
    Divider::horizontal().style(DividerStyle::Gradient).show(ui)
}

/// Section divider with larger margins.
pub fn section_divider(ui: &mut Ui) -> egui::Response {
    Divider::horizontal().margin(theme::SPACE_LG).show(ui)
}

/// Thin divider with minimal margins.
pub fn divider_thin(ui: &mut Ui) -> egui::Response {
    Divider::horizontal()
        .thickness(0.5)
        .margin(theme::SPACE_SM)
        .show(ui)
}
