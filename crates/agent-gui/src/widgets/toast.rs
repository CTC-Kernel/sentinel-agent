//! Toast notification widget for action feedback.

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

/// A single toast notification.
#[derive(Debug, Clone)]
pub struct Toast {
    pub message: String,
    pub level: ToastLevel,
    pub created_at: f64,
}

impl Toast {
    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Success,
            created_at: 0.0,
        }
    }
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Error,
            created_at: 0.0,
        }
    }
    pub fn info(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Info,
            created_at: 0.0,
        }
    }
    pub fn with_time(mut self, time: f64) -> Self {
        self.created_at = time;
        self
    }
}

/// Render active toast notifications. Call this at the end of the main UI frame.
/// Returns the toasts that should remain (not yet expired).
pub fn render_toasts(ui: &mut Ui, toasts: &[Toast]) -> Vec<Toast> {
    let current_time = ui.input(|i| i.time);
    let mut remaining = Vec::new();

    let bottom_y = ui.available_rect_before_wrap().max.y - 20.0;
    let center_x = ui.available_rect_before_wrap().center().x;
    let mut y_offset = 0.0;

    for toast in toasts.iter().rev() {
        let age = current_time - toast.created_at;
        if age > theme::TOAST_DURATION_SECS {
            continue;
        }
        remaining.push(toast.clone());

        // Fade in/out
        let alpha = if age < 0.2 {
            (age / 0.2) as f32
        } else if age > theme::TOAST_DURATION_SECS - 0.5 {
            ((theme::TOAST_DURATION_SECS - age) / 0.5) as f32
        } else {
            1.0
        };

        let (icon, color) = match toast.level {
            ToastLevel::Success => ("\u{f058}", theme::SUCCESS), // fa-circle-check
            ToastLevel::Error => ("\u{f057}", theme::ERROR),     // fa-circle-xmark
            ToastLevel::Info => ("\u{f05a}", theme::INFO),       // fa-circle-info
            ToastLevel::Warning => ("\u{f071}", theme::WARNING), // fa-triangle-exclamation
        };

        let text = format!("{}  {}", icon, toast.message);
        let galley = ui.painter().layout_no_wrap(
            text,
            theme::font_body(),
            theme::text_primary().linear_multiply(alpha),
        );

        let toast_width = galley.size().x + 32.0;
        let toast_height = 40.0;
        let toast_rect = egui::Rect::from_center_size(
            egui::pos2(center_x, bottom_y - y_offset - toast_height / 2.0),
            egui::vec2(toast_width, toast_height),
        );

        // Background
        ui.painter().rect(
            toast_rect,
            CornerRadius::same(10),
            theme::bg_secondary().linear_multiply(alpha * 0.95),
            Stroke::new(1.0, color.linear_multiply(alpha * 0.3)),
            StrokeKind::Inside,
        );

        // Shadow
        let shadow = theme::premium_shadow(12, (40.0 * alpha) as u8);
        ui.painter()
            .add(shadow.as_shape(toast_rect, CornerRadius::same(10)));

        // Text
        let text_pos = toast_rect.center() - galley.size() / 2.0;
        ui.painter().galley(
            text_pos,
            galley,
            theme::text_primary().linear_multiply(alpha),
        );

        y_offset += toast_height + 8.0;
        ui.ctx().request_repaint();
    }

    remaining
}
