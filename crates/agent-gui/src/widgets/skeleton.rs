//! Skeleton loading placeholders for content loading states.

use crate::animation;
use crate::theme;
use egui::{CornerRadius, Ui};

/// Skeleton shape variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum SkeletonShape {
    #[default]
    Rectangle,
    Circle,
    Rounded,
}

/// A skeleton loading placeholder.
pub struct Skeleton {
    width: f32,
    height: f32,
    shape: SkeletonShape,
    animated: bool,
    /// Optional delay before showing (in seconds). Allocates space but renders nothing until elapsed.
    delay_secs: Option<f64>,
}

impl Skeleton {
    /// Create a new skeleton with given dimensions.
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            width,
            height,
            shape: SkeletonShape::Rectangle,
            animated: true,
            delay_secs: None,
        }
    }

    /// Create a text line skeleton.
    pub fn text(width: f32) -> Self {
        Self::new(width, 14.0).shape(SkeletonShape::Rounded)
    }

    /// Create a paragraph skeleton (multiple lines).
    pub fn paragraph(lines: usize, width: f32) -> Vec<Self> {
        (0..lines)
            .map(|i| {
                let line_width = if i == lines - 1 {
                    width * 0.6 // Last line shorter
                } else {
                    width
                };
                Self::text(line_width)
            })
            .collect()
    }

    /// Create a circle skeleton (for avatars).
    pub fn circle(size: f32) -> Self {
        Self::new(size, size).shape(SkeletonShape::Circle)
    }

    /// Create a card skeleton.
    pub fn card(width: f32, height: f32) -> Self {
        Self::new(width, height).shape(SkeletonShape::Rounded)
    }

    /// Set the skeleton shape.
    pub fn shape(mut self, shape: SkeletonShape) -> Self {
        self.shape = shape;
        self
    }

    /// Disable animation.
    pub fn static_mode(mut self) -> Self {
        self.animated = false;
        self
    }

    /// Add a delay before showing the skeleton (prevents flash for fast loads).
    /// Uses `theme::SKELETON_DELAY_MS` by default when called without args.
    pub fn with_delay(mut self) -> Self {
        self.delay_secs = Some(crate::theme::SKELETON_DELAY_MS as f64 / 1000.0);
        self
    }

    /// Show the skeleton.
    pub fn show(self, ui: &mut Ui) -> egui::Response {
        let (rect, response) =
            ui.allocate_exact_size(egui::vec2(self.width, self.height), egui::Sense::hover());

        // Check delay: use an ID-based start time stored in egui memory
        if let Some(delay) = self.delay_secs {
            let delay_id = egui::Id::new("skeleton_delay")
                .with(rect.min.x as u32)
                .with(rect.min.y as u32);
            let now = ui.input(|i| i.time);
            let start_time: f64 =
                ui.memory(|mem| mem.data.get_temp::<f64>(delay_id).unwrap_or(now));
            if start_time == now {
                ui.memory_mut(|mem| mem.data.insert_temp(delay_id, now));
            }
            if now - start_time < delay {
                ui.ctx().request_repaint();
                return response;
            }
        }

        // Respect reduced-motion preference
        let animated = self.animated && !crate::theme::is_reduced_motion();

        if ui.is_rect_visible(rect) {
            let base_color = if theme::is_dark_mode() {
                theme::SKELETON_BASE_DARK
            } else {
                theme::SKELETON_BASE_LIGHT
            };

            let color = if animated {
                let t = ui.input(|i| i.time);
                let pulse = ((t as f32 * theme::ANIM_SKELETON_SPEED).sin() * 0.5 + 0.5).clamp(0.0, 1.0);
                let highlight = if theme::is_dark_mode() {
                    theme::SKELETON_HIGHLIGHT_DARK
                } else {
                    theme::SKELETON_HIGHLIGHT_LIGHT
                };

                // Interpolate between base and highlight
                animation::lerp_color(base_color, highlight, pulse)
            } else {
                base_color
            };

            let rounding = match self.shape {
                SkeletonShape::Rectangle => CornerRadius::same(theme::SPACE_XS as u8),
                SkeletonShape::Circle => CornerRadius::same((self.width / 2.0).min(255.0) as u8),
                SkeletonShape::Rounded => CornerRadius::same(theme::BUTTON_ROUNDING),
            };

            ui.painter().rect_filled(rect, rounding, color);

            if animated {
                ui.ctx().request_repaint();
            }
        }

        response
    }
}

/// Simple skeleton rectangle.
pub fn skeleton(ui: &mut Ui, width: f32, height: f32) -> egui::Response {
    Skeleton::new(width, height).show(ui)
}

/// Skeleton text line.
pub fn skeleton_text(ui: &mut Ui, width: f32) -> egui::Response {
    Skeleton::text(width).show(ui)
}

/// Skeleton circle (avatar placeholder).
pub fn skeleton_circle(ui: &mut Ui, size: f32) -> egui::Response {
    Skeleton::circle(size).show(ui)
}

/// Skeleton card.
pub fn skeleton_card(ui: &mut Ui, width: f32, height: f32) -> egui::Response {
    Skeleton::card(width, height).show(ui)
}

/// Skeleton paragraph with multiple lines.
pub fn skeleton_paragraph(ui: &mut Ui, lines: usize, width: f32) {
    ui.vertical(|ui| {
        for skeleton in Skeleton::paragraph(lines, width) {
            skeleton.show(ui);
            ui.add_space(theme::SPACE_XS + 2.0);
        }
    });
}

/// Skeleton list item (avatar + text).
pub fn skeleton_list_item(ui: &mut Ui) {
    ui.horizontal(|ui| {
        Skeleton::circle(theme::INPUT_HEIGHT).show(ui);
        ui.add_space(theme::SPACE_MD);
        ui.vertical(|ui| {
            Skeleton::text(theme::BUTTON_MIN_WIDTH).show(ui);
            ui.add_space(theme::SPACE_XS);
            Skeleton::text(80.0).show(ui);
        });
    });
}

/// Skeleton table row.
pub fn skeleton_table_row(ui: &mut Ui, columns: usize, column_widths: &[f32]) {
    ui.horizontal(|ui| {
        for i in 0..columns {
            let width = column_widths.get(i).copied().unwrap_or(100.0);
            Skeleton::text(width).show(ui);
            if i < columns - 1 {
                ui.add_space(theme::SPACE);
            }
        }
    });
}

/// Skeleton card with content layout.
pub fn skeleton_content_card(ui: &mut Ui, width: f32) {
    egui::Frame::new()
        .fill(theme::bg_secondary())
        .corner_radius(CornerRadius::same(theme::SKELETON_CARD_ROUNDING))
        .inner_margin(egui::Margin::same(theme::SPACE as i8))
        .show(ui, |ui| {
            ui.set_width(width - theme::SPACE_XL);

            // Header
            ui.horizontal(|ui| {
                Skeleton::circle(theme::MODAL_ICON_SIZE).show(ui);
                ui.add_space(theme::SPACE_MD);
                ui.vertical(|ui| {
                    Skeleton::text(150.0).show(ui);
                    ui.add_space(theme::SPACE_XS + 2.0);
                    Skeleton::text(100.0).show(ui);
                });
            });

            ui.add_space(theme::SPACE);

            // Content
            skeleton_paragraph(ui, 3, width - theme::EMPTY_STATE_ICON);

            ui.add_space(theme::SPACE);

            // Actions
            ui.horizontal(|ui| {
                Skeleton::new(80.0, theme::MIN_TOUCH_TARGET)
                    .shape(SkeletonShape::Rounded)
                    .show(ui);
                ui.add_space(theme::SPACE_SM);
                Skeleton::new(80.0, theme::MIN_TOUCH_TARGET)
                    .shape(SkeletonShape::Rounded)
                    .show(ui);
            });
        });
}

/// Skeleton stats grid (for dashboard).
pub fn skeleton_stats_grid(ui: &mut Ui, count: usize) {
    ui.horizontal_wrapped(|ui| {
        for _ in 0..count {
            egui::Frame::new()
                .fill(theme::bg_secondary())
                .corner_radius(CornerRadius::same(theme::SKELETON_CARD_ROUNDING))
                .inner_margin(egui::Margin::same(theme::SPACE as i8))
                .show(ui, |ui| {
                    ui.set_min_width(140.0);
                    Skeleton::text(60.0).show(ui);
                    ui.add_space(theme::SPACE_SM);
                    Skeleton::new(80.0, theme::ICON_LG)
                        .shape(SkeletonShape::Rounded)
                        .show(ui);
                    ui.add_space(theme::SPACE_XS);
                    Skeleton::text(40.0).show(ui);
                });
            ui.add_space(theme::SPACE_MD);
        }
    });
}
