//! Toast notification widget for action feedback.

use crate::icons;
use crate::theme;
use egui::{CornerRadius, Stroke, Ui, epaint::StrokeKind};

/// Toast notification level.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ToastLevel {
    Success,
    Error,
    Info,
    Warning,
}

/// Toast position on screen.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ToastPosition {
    #[default]
    BottomCenter,
    TopCenter,
    TopRight,
    BottomRight,
}

/// A single toast notification.
#[derive(Debug, Clone)]
pub struct Toast {
    pub message: String,
    pub level: ToastLevel,
    pub created_at: f64,
    pub dismissible: bool,
    pub dismissed: bool,
}

impl Toast {
    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Success,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
        }
    }
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Error,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
        }
    }
    pub fn info(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Info,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
        }
    }
    pub fn warning(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Warning,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
        }
    }
    pub fn with_time(mut self, time: f64) -> Self {
        self.created_at = time;
        self
    }
    pub fn persistent(mut self) -> Self {
        self.dismissible = false;
        self
    }
}

/// Render active toast notifications. Call this at the end of the main UI frame.
/// Returns the toasts that should remain (not yet expired or dismissed).
pub fn render_toasts(ui: &mut Ui, toasts: &[Toast]) -> Vec<Toast> {
    render_toasts_at(ui, toasts, ToastPosition::BottomCenter)
}

/// Render toasts at a specific position.
pub fn render_toasts_at(ui: &mut Ui, toasts: &[Toast], position: ToastPosition) -> Vec<Toast> {
    let current_time = ui.input(|i| i.time);
    let mut remaining = Vec::new();
    let screen = ui.available_rect_before_wrap();

    let mut y_offset = 0.0;

    for toast in toasts.iter().rev() {
        // Skip dismissed toasts
        if toast.dismissed {
            continue;
        }

        let age = current_time - toast.created_at;
        if age > theme::TOAST_DURATION_SECS {
            continue;
        }

        let mut toast_clone = toast.clone();

        // Fade in/out
        let alpha = if age < 0.2 {
            (age / 0.2) as f32
        } else if age > theme::TOAST_DURATION_SECS - 0.5 {
            ((theme::TOAST_DURATION_SECS - age) / 0.5) as f32
        } else {
            1.0
        };

        let (icon, color) = match toast.level {
            ToastLevel::Success => (icons::CIRCLE_CHECK, theme::SUCCESS),
            ToastLevel::Error => (icons::CIRCLE_XMARK, theme::ERROR),
            ToastLevel::Info => (icons::INFO, theme::INFO),
            ToastLevel::Warning => (icons::WARNING, theme::WARNING),
        };

        let text = format!("{}  {}", icon, toast.message);
        let galley = ui.painter().layout_no_wrap(
            text,
            theme::font_body(),
            theme::text_primary().linear_multiply(alpha),
        );

        // Add space for close button if dismissible
        let close_width = if toast.dismissible { 28.0 } else { 0.0 };
        let toast_width = galley.size().x + 32.0 + close_width;
        let toast_height = 44.0;

        // Calculate position based on ToastPosition
        let toast_center = match position {
            ToastPosition::BottomCenter => {
                egui::pos2(
                    screen.center().x,
                    screen.max.y - 24.0 - y_offset - toast_height / 2.0,
                )
            }
            ToastPosition::TopCenter => {
                egui::pos2(
                    screen.center().x,
                    screen.min.y + 24.0 + y_offset + toast_height / 2.0,
                )
            }
            ToastPosition::TopRight => {
                egui::pos2(
                    screen.max.x - toast_width / 2.0 - 24.0,
                    screen.min.y + 24.0 + y_offset + toast_height / 2.0,
                )
            }
            ToastPosition::BottomRight => {
                egui::pos2(
                    screen.max.x - toast_width / 2.0 - 24.0,
                    screen.max.y - 24.0 - y_offset - toast_height / 2.0,
                )
            }
        };

        let toast_rect = egui::Rect::from_center_size(
            toast_center,
            egui::vec2(toast_width, toast_height),
        );

        // Shadow (behind everything)
        let shadow = theme::premium_shadow(16, (50.0 * alpha) as u8);
        ui.painter()
            .add(shadow.as_shape(toast_rect, CornerRadius::same(12)));

        // Background with colored left accent
        ui.painter().rect(
            toast_rect,
            CornerRadius::same(12),
            theme::bg_secondary().linear_multiply(alpha * 0.98),
            Stroke::new(1.0, color.linear_multiply(alpha * 0.4)),
            StrokeKind::Inside,
        );

        // Colored accent bar on left
        let accent_rect = egui::Rect::from_min_size(
            toast_rect.min,
            egui::vec2(4.0, toast_height),
        );
        ui.painter().rect_filled(
            accent_rect,
            CornerRadius {
                nw: 12,
                sw: 12,
                ..Default::default()
            },
            color.linear_multiply(alpha),
        );

        // Text (shifted right to account for accent bar)
        let text_pos = egui::pos2(
            toast_rect.min.x + 16.0,
            toast_rect.center().y - galley.size().y / 2.0,
        );
        ui.painter().galley(
            text_pos,
            galley,
            theme::text_primary().linear_multiply(alpha),
        );

        // Close button if dismissible
        if toast.dismissible {
            let close_rect = egui::Rect::from_center_size(
                egui::pos2(toast_rect.max.x - 18.0, toast_rect.center().y),
                egui::vec2(20.0, 20.0),
            );

            // Check for click on close button
            let close_response = ui.allocate_rect(close_rect, egui::Sense::click());
            let close_hovered = close_response.hovered();

            // Draw close button
            let close_color = if close_hovered {
                theme::text_primary().linear_multiply(alpha)
            } else {
                theme::text_tertiary().linear_multiply(alpha * 0.7)
            };

            ui.painter().text(
                close_rect.center(),
                egui::Align2::CENTER_CENTER,
                icons::XMARK,
                theme::font_small(),
                close_color,
            );

            if close_response.clicked() {
                toast_clone.dismissed = true;
            }
        }

        remaining.push(toast_clone);
        y_offset += toast_height + 10.0;
        ui.ctx().request_repaint();
    }

    // Reverse to maintain order
    remaining.reverse();
    remaining
}
