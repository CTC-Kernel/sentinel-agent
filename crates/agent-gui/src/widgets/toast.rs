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
    /// Custom duration override (if None, uses per-level default).
    pub duration_override: Option<f64>,
}

impl Toast {
    /// Get the display duration for this toast (per-level or custom override).
    pub fn duration(&self) -> f64 {
        if let Some(d) = self.duration_override {
            return d;
        }
        match self.level {
            ToastLevel::Error => theme::TOAST_DURATION_ERROR_SECS,
            ToastLevel::Warning => theme::TOAST_DURATION_WARNING_SECS,
            ToastLevel::Success | ToastLevel::Info => theme::TOAST_DURATION_SECS,
        }
    }
}

impl Toast {
    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Success,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
            duration_override: None,
        }
    }
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Error,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
            duration_override: None,
        }
    }
    pub fn info(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Info,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
            duration_override: None,
        }
    }
    pub fn warning(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            level: ToastLevel::Warning,
            created_at: 0.0,
            dismissible: true,
            dismissed: false,
            duration_override: None,
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
    pub fn with_duration(mut self, secs: f64) -> Self {
        self.duration_override = Some(secs);
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
        let duration = toast.duration();
        if age > duration {
            continue;
        }

        let mut toast_clone = toast.clone();

        // Fade + slide-up entrance, fade-out exit
        let entrance_duration = theme::ANIM_NORMAL as f64;
        let exit_duration = 0.5;
        let exit_start = duration - exit_duration;
        let (alpha, slide_offset) = if theme::is_reduced_motion() {
            // Instant show/hide with reduced motion
            (1.0_f32, 0.0_f32)
        } else {
            let a = if age < entrance_duration {
                (age / entrance_duration) as f32
            } else if age > exit_start {
                ((duration - age) / exit_duration) as f32
            } else {
                1.0
            };
            // Slide-up offset during entrance (slides from 12px below to 0)
            let s = if age < entrance_duration {
                theme::SPACE_MD * (1.0 - (age / entrance_duration) as f32)
            } else {
                0.0
            };
            (a, s)
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
        let close_width = if toast.dismissible { theme::MIN_TOUCH_TARGET } else { 0.0 };
        let toast_width = galley.size().x + theme::SPACE_XL + close_width;
        let toast_height = theme::TOAST_HEIGHT;

        // Calculate position based on ToastPosition (with slide-up entrance offset)
        let toast_center = match position {
            ToastPosition::BottomCenter => egui::pos2(
                screen.center().x,
                screen.max.y - theme::SPACE_LG - y_offset - toast_height / 2.0 + slide_offset,
            ),
            ToastPosition::TopCenter => egui::pos2(
                screen.center().x,
                screen.min.y + theme::SPACE_LG + y_offset + toast_height / 2.0 - slide_offset,
            ),
            ToastPosition::TopRight => egui::pos2(
                screen.max.x - toast_width / 2.0 - theme::SPACE_LG,
                screen.min.y + theme::SPACE_LG + y_offset + toast_height / 2.0 - slide_offset,
            ),
            ToastPosition::BottomRight => egui::pos2(
                screen.max.x - toast_width / 2.0 - theme::SPACE_LG,
                screen.max.y - theme::SPACE_LG - y_offset - toast_height / 2.0 + slide_offset,
            ),
        };

        let toast_rect =
            egui::Rect::from_center_size(toast_center, egui::vec2(toast_width, toast_height));

        // Shadow (behind everything)
        let shadow = theme::premium_shadow(16, (50.0 * alpha).clamp(0.0, 255.0) as u8);
        let toast_rounding = CornerRadius::same(theme::TOAST_ROUNDING);
        ui.painter()
            .add(shadow.as_shape(toast_rect, toast_rounding));

        // Background with colored left accent
        ui.painter().rect(
            toast_rect,
            toast_rounding,
            theme::bg_secondary().linear_multiply(alpha * 0.98),
            Stroke::new(theme::BORDER_THIN, color.linear_multiply(alpha * theme::OPACITY_DISABLED)),
            StrokeKind::Inside,
        );

        // Colored accent bar on left
        let accent_rect = egui::Rect::from_min_size(toast_rect.min, egui::vec2(theme::TOAST_ACCENT_BAR, toast_height));
        ui.painter().rect_filled(
            accent_rect,
            CornerRadius {
                nw: theme::TOAST_ROUNDING,
                sw: theme::TOAST_ROUNDING,
                ..Default::default()
            },
            color.linear_multiply(alpha),
        );

        // Text (shifted right to account for accent bar)
        let text_pos = egui::pos2(
            toast_rect.min.x + theme::TOAST_TEXT_INSET,
            toast_rect.center().y - galley.size().y / 2.0,
        );
        ui.painter().galley(
            text_pos,
            galley,
            theme::text_primary().linear_multiply(alpha),
        );

        // Close button if dismissible (MIN_TOUCH_TARGET for accessibility)
        if toast.dismissible {
            let close_rect = egui::Rect::from_center_size(
                egui::pos2(toast_rect.max.x - theme::TOAST_CLOSE_INSET, toast_rect.center().y),
                egui::vec2(theme::MIN_TOUCH_TARGET, theme::MIN_TOUCH_TARGET),
            );

            // Check for click on close button
            let close_response = ui.allocate_rect(close_rect, egui::Sense::click());
            let close_hovered = close_response.hovered();

            // Draw close button
            let close_color = if close_hovered {
                theme::text_primary().linear_multiply(alpha)
            } else {
                theme::text_tertiary().linear_multiply(alpha * theme::OPACITY_PRESSED)
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
