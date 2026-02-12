//! Tooltip wrapper widget with premium styling.

use crate::theme;
use egui::{CornerRadius, Ui};

/// Tooltip position relative to the target.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum TooltipPosition {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

/// A premium styled tooltip.
pub struct Tooltip<'a> {
    text: &'a str,
    position: TooltipPosition,
    max_width: f32,
}

impl<'a> Tooltip<'a> {
    /// Create a new tooltip with the given text.
    pub fn new(text: &'a str) -> Self {
        Self {
            text,
            position: TooltipPosition::Top,
            max_width: 250.0,
        }
    }

    /// Set the tooltip position.
    pub fn position(mut self, pos: TooltipPosition) -> Self {
        self.position = pos;
        self
    }

    /// Set the maximum width.
    pub fn max_width(mut self, width: f32) -> Self {
        self.max_width = width;
        self
    }

    /// Show the tooltip for a response.
    pub fn show(self, ui: &Ui, response: &egui::Response) {
        if response.hovered() {
            show_tooltip_at(
                ui.ctx(),
                response.rect,
                self.text,
                self.position,
                self.max_width,
            );
        }
    }
}

/// Show a tooltip at a specific rect.
pub fn show_tooltip_at(
    ctx: &egui::Context,
    rect: egui::Rect,
    text: &str,
    position: TooltipPosition,
    max_width: f32,
) {
    let layer_id = egui::LayerId::new(egui::Order::Tooltip, egui::Id::new("premium_tooltip"));

    let galley = ctx.fonts(|fonts| {
        fonts.layout(
            text.to_string(),
            theme::font_small(),
            theme::text_primary(),
            max_width,
        )
    });

    let padding = egui::vec2(10.0, 6.0);
    let tooltip_size = galley.size() + padding * 2.0;

    // Calculate position
    let tooltip_pos = match position {
        TooltipPosition::Top => egui::pos2(
            rect.center().x - tooltip_size.x / 2.0,
            rect.min.y - tooltip_size.y - 8.0,
        ),
        TooltipPosition::Bottom => {
            egui::pos2(rect.center().x - tooltip_size.x / 2.0, rect.max.y + 8.0)
        }
        TooltipPosition::Left => egui::pos2(
            rect.min.x - tooltip_size.x - 8.0,
            rect.center().y - tooltip_size.y / 2.0,
        ),
        TooltipPosition::Right => {
            egui::pos2(rect.max.x + 8.0, rect.center().y - tooltip_size.y / 2.0)
        }
    };

    // Keep tooltip on screen
    let screen = ctx.screen_rect();
    let tooltip_pos = egui::pos2(
        tooltip_pos
            .x
            .clamp(screen.min.x + 4.0, screen.max.x - tooltip_size.x - 4.0),
        tooltip_pos
            .y
            .clamp(screen.min.y + 4.0, screen.max.y - tooltip_size.y - 4.0),
    );

    let tooltip_rect = egui::Rect::from_min_size(tooltip_pos, tooltip_size);

    ctx.layer_painter(layer_id)
        .add(theme::premium_shadow(8, 40).as_shape(tooltip_rect, CornerRadius::same(6)));

    ctx.layer_painter(layer_id).rect(
        tooltip_rect,
        CornerRadius::same(6),
        theme::bg_elevated(),
        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()),
        egui::epaint::StrokeKind::Inside,
    );

    ctx.layer_painter(layer_id)
        .galley(tooltip_pos + padding, galley, theme::text_primary());
}

/// Extension trait to add tooltip to responses.
pub trait ResponseTooltipExt {
    /// Add a premium styled tooltip to this response.
    fn premium_tooltip(self, text: &str) -> Self;

    /// Add a premium styled tooltip with position.
    fn premium_tooltip_at(self, text: &str, position: TooltipPosition) -> Self;
}

impl ResponseTooltipExt for egui::Response {
    fn premium_tooltip(self, text: &str) -> Self {
        if self.hovered() {
            show_tooltip_at(&self.ctx, self.rect, text, TooltipPosition::Top, 250.0);
        }
        self
    }

    fn premium_tooltip_at(self, text: &str, position: TooltipPosition) -> Self {
        if self.hovered() {
            show_tooltip_at(&self.ctx, self.rect, text, position, 250.0);
        }
        self
    }
}

/// Simple tooltip wrapper function.
pub fn tooltip(ui: &Ui, response: &egui::Response, text: &str) {
    Tooltip::new(text).show(ui, response);
}

/// Info icon with tooltip.
pub fn info_tooltip(ui: &mut Ui, text: &str) {
    let (rect, response) = ui.allocate_exact_size(egui::vec2(16.0, 16.0), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let color = if response.hovered() {
            theme::ACCENT
        } else {
            theme::text_tertiary()
        };

        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            crate::icons::INFO,
            theme::font_small(),
            color,
        );
    }

    Tooltip::new(text)
        .position(TooltipPosition::Top)
        .show(ui, &response);
}

/// Help icon with tooltip (question mark style).
pub fn help_tooltip(ui: &mut Ui, text: &str) {
    let (rect, response) = ui.allocate_exact_size(egui::vec2(18.0, 18.0), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();

        // Circle background
        ui.painter().circle(
            rect.center(),
            8.0,
            if is_hovered {
                theme::ACCENT.linear_multiply(theme::OPACITY_TINT)
            } else {
                egui::Color32::TRANSPARENT
            },
            egui::Stroke::new(
                1.0,
                if is_hovered {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                },
            ),
        );

        // Question mark
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            "?",
            theme::font_small(),
            if is_hovered {
                theme::ACCENT
            } else {
                theme::text_tertiary()
            },
        );
    }

    Tooltip::new(text).show(ui, &response);
}
