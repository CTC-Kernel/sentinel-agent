//! Slider widget for numeric value selection.

use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Slider style variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum SliderStyle {
    #[default]
    Default,
    Minimal,
    Stepped,
}

/// A premium styled slider widget.
pub struct Slider {
    min: f32,
    max: f32,
    step: Option<f32>,
    style: SliderStyle,
    show_value: bool,
    show_ticks: bool,
    suffix: Option<String>,
    width: Option<f32>,
    color: Option<Color32>,
}

impl Slider {
    /// Create a new slider with min and max values.
    pub fn new(min: f32, max: f32) -> Self {
        Self {
            min,
            max,
            step: None,
            style: SliderStyle::Default,
            show_value: true,
            show_ticks: false,
            suffix: None,
            width: None,
            color: None,
        }
    }

    /// Create a percentage slider (0-100).
    pub fn percentage() -> Self {
        Self::new(0.0, 100.0).suffix("%")
    }

    /// Set the step size.
    pub fn step(mut self, step: f32) -> Self {
        self.step = Some(step);
        self
    }

    /// Set the slider style.
    pub fn style(mut self, style: SliderStyle) -> Self {
        self.style = style;
        self
    }

    /// Hide the value display.
    pub fn hide_value(mut self) -> Self {
        self.show_value = false;
        self
    }

    /// Show tick marks.
    pub fn show_ticks(mut self) -> Self {
        self.show_ticks = true;
        self
    }

    /// Add a suffix to the value display.
    pub fn suffix(mut self, suffix: impl Into<String>) -> Self {
        self.suffix = Some(suffix.into());
        self
    }

    /// Set a fixed width.
    pub fn width(mut self, width: f32) -> Self {
        self.width = Some(width);
        self
    }

    /// Set a custom accent color.
    pub fn color(mut self, color: Color32) -> Self {
        self.color = Some(color);
        self
    }

    /// Show the slider and return true if value changed.
    pub fn show(self, ui: &mut Ui, value: &mut f32) -> bool {
        let mut changed = false;
        let accent = self.color.unwrap_or(theme::ACCENT);

        let width = self.width.unwrap_or(ui.available_width().min(300.0));
        let track_height = match self.style {
            SliderStyle::Default => 6.0,
            SliderStyle::Minimal => 4.0,
            SliderStyle::Stepped => 8.0,
        };
        let thumb_radius = match self.style {
            SliderStyle::Default => 10.0,
            SliderStyle::Minimal => 8.0,
            SliderStyle::Stepped => 12.0,
        };

        let total_height = thumb_radius * 2.0 + if self.show_ticks { 16.0 } else { 0.0 };

        ui.horizontal(|ui| {
            // Slider track area
            let (rect, response) =
                ui.allocate_exact_size(egui::vec2(width, total_height), Sense::click_and_drag());

            let track_rect = egui::Rect::from_center_size(
                egui::pos2(rect.center().x, rect.min.y + thumb_radius),
                egui::vec2(width - thumb_radius * 2.0, track_height),
            );

            // Handle interaction
            if (response.dragged() || response.clicked())
                && let Some(pos) = response.interact_pointer_pos()
            {
                let t = ((pos.x - track_rect.min.x) / track_rect.width()).clamp(0.0, 1.0);
                let mut new_value = self.min + t * (self.max - self.min);

                // Apply step
                if let Some(step) = self.step {
                    new_value = (new_value / step).round() * step;
                }

                new_value = new_value.clamp(self.min, self.max);

                if (*value - new_value).abs() > f32::EPSILON {
                    *value = new_value;
                    changed = true;
                }
            }

            if ui.is_rect_visible(rect) {
                let painter = ui.painter();
                let range = self.max - self.min;
                let t = if range.abs() > f32::EPSILON { (*value - self.min) / range } else { 0.0 };
                let thumb_x = track_rect.min.x + t * track_rect.width();
                let thumb_center = egui::pos2(thumb_x, track_rect.center().y);

                // Track background
                painter.rect_filled(
                    track_rect,
                    CornerRadius::same((track_height / 2.0).min(255.0) as u8),
                    theme::bg_tertiary(),
                );

                // Filled portion
                let filled_rect =
                    egui::Rect::from_min_max(track_rect.min, egui::pos2(thumb_x, track_rect.max.y));
                painter.rect_filled(
                    filled_rect,
                    CornerRadius::same((track_height / 2.0).min(255.0) as u8),
                    accent,
                );

                // Tick marks
                if self.show_ticks
                    && let Some(step) = self.step
                {
                    let tick_count = ((self.max - self.min) / step) as usize;
                    if tick_count > 0 {
                        for i in 0..=tick_count {
                            let tick_t = i as f32 / tick_count as f32;
                            let tick_x = track_rect.min.x + tick_t * track_rect.width();
                            let tick_y = track_rect.max.y + 8.0;

                            painter.circle_filled(
                                egui::pos2(tick_x, tick_y),
                                2.0,
                                if tick_t <= t {
                                    accent.linear_multiply(0.6)
                                } else {
                                    theme::text_tertiary()
                                },
                            );
                        }
                    }
                }

                // Thumb shadow
                if matches!(self.style, SliderStyle::Default | SliderStyle::Stepped) {
                    painter.circle_filled(
                        thumb_center + egui::vec2(0.0, 1.0),
                        thumb_radius + 1.0,
                        Color32::from_black_alpha(30),
                    );
                }

                // Thumb
                let is_hovered = response.hovered();
                let is_dragging = response.dragged();

                let thumb_color = if is_dragging {
                    accent.linear_multiply(0.9)
                } else {
                    accent
                };

                painter.circle_filled(thumb_center, thumb_radius, thumb_color);

                // Inner dot for default style
                if matches!(self.style, SliderStyle::Default) {
                    painter.circle_filled(thumb_center, 4.0, Color32::WHITE);
                }

                // Hover ring
                if is_hovered || is_dragging {
                    painter.circle_stroke(
                        thumb_center,
                        thumb_radius + 4.0,
                        egui::Stroke::new(2.0, accent.linear_multiply(0.3)),
                    );
                }
            }

            // Value display
            if self.show_value {
                ui.add_space(12.0);
                let value_text = if self.step.map(|s| s >= 1.0).unwrap_or(false) {
                    format!("{:.0}", *value)
                } else {
                    format!("{:.1}", *value)
                };
                let display = if let Some(ref suffix) = self.suffix {
                    format!("{}{}", value_text, suffix)
                } else {
                    value_text
                };
                ui.label(
                    egui::RichText::new(display)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                );
            }
        });

        changed
    }
}

/// Simple slider.
pub fn slider(ui: &mut Ui, value: &mut f32, min: f32, max: f32) -> bool {
    Slider::new(min, max).show(ui, value)
}

/// Percentage slider (0-100).
pub fn slider_percentage(ui: &mut Ui, value: &mut f32) -> bool {
    Slider::percentage().show(ui, value)
}

/// Slider with step.
pub fn slider_stepped(ui: &mut Ui, value: &mut f32, min: f32, max: f32, step: f32) -> bool {
    Slider::new(min, max)
        .step(step)
        .show_ticks()
        .show(ui, value)
}

/// Minimal style slider.
pub fn slider_minimal(ui: &mut Ui, value: &mut f32, min: f32, max: f32) -> bool {
    Slider::new(min, max)
        .style(SliderStyle::Minimal)
        .hide_value()
        .show(ui, value)
}

/// Range slider showing min/max labels.
pub fn slider_with_labels(
    ui: &mut Ui,
    value: &mut f32,
    min: f32,
    max: f32,
    min_label: &str,
    max_label: &str,
) -> bool {
    let mut changed = false;

    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(min_label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );

        changed = Slider::new(min, max).hide_value().show(ui, value);

        ui.label(
            egui::RichText::new(max_label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
    });

    changed
}
