//! Alert/Banner widget for displaying important messages.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Alert severity levels.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum AlertLevel {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

impl AlertLevel {
    fn colors(&self) -> (Color32, Color32, Color32) {
        // Returns (background, border, text/icon color)
        // Uses badge_bg/badge_border for opaque, readable tinted backgrounds.
        let semantic = match self {
            AlertLevel::Info => theme::INFO,
            AlertLevel::Success => theme::SUCCESS,
            AlertLevel::Warning => theme::WARNING,
            AlertLevel::Error => theme::ERROR,
        };
        (
            theme::badge_bg(semantic),
            theme::badge_border(semantic),
            theme::badge_text(semantic),
        )
    }

    fn icon(&self) -> &'static str {
        match self {
            AlertLevel::Info => icons::INFO,
            AlertLevel::Success => icons::CIRCLE_CHECK,
            AlertLevel::Warning => icons::WARNING,
            AlertLevel::Error => icons::CIRCLE_XMARK,
        }
    }
}

/// Alert widget for displaying important messages.
pub struct Alert<'a> {
    level: AlertLevel,
    title: Option<&'a str>,
    message: &'a str,
    dismissible: bool,
    action: Option<(&'a str, bool)>, // (label, primary)
    icon: Option<&'a str>,
    compact: bool,
}

impl<'a> Alert<'a> {
    /// Create a new alert with a message.
    pub fn new(message: &'a str) -> Self {
        Self {
            level: AlertLevel::Info,
            title: None,
            message,
            dismissible: false,
            action: None,
            icon: None,
            compact: false,
        }
    }

    /// Set the alert level/severity.
    pub fn level(mut self, level: AlertLevel) -> Self {
        self.level = level;
        self
    }

    /// Add a title to the alert.
    pub fn title(mut self, title: &'a str) -> Self {
        self.title = Some(title);
        self
    }

    /// Make the alert dismissible.
    pub fn dismissible(mut self) -> Self {
        self.dismissible = true;
        self
    }

    /// Add an action button.
    pub fn action(mut self, label: &'a str, primary: bool) -> Self {
        self.action = Some((label, primary));
        self
    }

    /// Override the default icon.
    pub fn icon(mut self, icon: &'a str) -> Self {
        self.icon = Some(icon);
        self
    }

    /// Use compact styling (smaller padding).
    pub fn compact(mut self) -> Self {
        self.compact = true;
        self
    }

    /// Show the alert. Returns (dismissed, action_clicked).
    pub fn show(self, ui: &mut Ui) -> AlertResult {
        let mut result = AlertResult::default();
        let (bg_color, border_color, accent_color) = self.level.colors();
        let icon = self.icon.unwrap_or_else(|| self.level.icon());

        let padding = if self.compact { theme::SPACE_MD } else { theme::SPACE };
        let available_width = ui.available_width();

        egui::Frame::new()
            .fill(bg_color)
            .corner_radius(CornerRadius::same(theme::BUTTON_ROUNDING))
            .stroke(egui::Stroke::new(theme::BORDER_THIN, border_color))
            .inner_margin(egui::Margin::same(padding as i8))
            .show(ui, |ui| {
                ui.set_width(available_width - padding * 2.0);

                ui.horizontal(|ui| {
                    // Icon
                    ui.label(
                        egui::RichText::new(icon)
                            .font(if self.compact {
                                theme::font_body()
                            } else {
                                theme::font_heading()
                            })
                            .color(accent_color),
                    );

                    ui.add_space(theme::SPACE_MD);

                    // Content
                    ui.vertical(|ui| {
                        // Title
                        if let Some(title) = self.title {
                            ui.label(
                                egui::RichText::new(title)
                                    .font(theme::font_body())
                                    .color(theme::text_primary())
                                    .strong(),
                            );
                            ui.add_space(theme::SPACE_XS);
                        }

                        // Message
                        ui.label(
                            egui::RichText::new(self.message)
                                .font(if self.compact {
                                    theme::font_small()
                                } else {
                                    theme::font_body()
                                })
                                .color(theme::text_secondary()),
                        );

                        // Action button
                        if let Some((label, primary)) = self.action {
                            ui.add_space(theme::SPACE_MD);

                            let button_bg = if primary {
                                accent_color
                            } else {
                                Color32::TRANSPARENT
                            };
                            let button_text = if primary {
                                theme::text_on_accent()
                            } else {
                                accent_color
                            };

                            let galley = ui.painter().layout_no_wrap(
                                label.to_string(),
                                theme::font_small(),
                                button_text,
                            );

                            let button_size = galley.size() + egui::vec2(theme::SPACE_LG, theme::SPACE_MD);
                            let (button_rect, button_response) =
                                ui.allocate_exact_size(button_size, Sense::click());

                            if ui.is_rect_visible(button_rect) {
                                let is_hovered = button_response.hovered();

                                let bg = if is_hovered {
                                    if primary {
                                        accent_color.linear_multiply(theme::OPACITY_HOVER)
                                    } else {
                                        accent_color.linear_multiply(theme::OPACITY_SUBTLE)
                                    }
                                } else {
                                    button_bg
                                };

                                ui.painter().rect(
                                    button_rect,
                                    CornerRadius::same(theme::BUTTON_ROUNDING),
                                    bg,
                                    if primary {
                                        egui::Stroke::NONE
                                    } else {
                                        egui::Stroke::new(theme::BORDER_THIN, accent_color)
                                    },
                                    egui::epaint::StrokeKind::Inside,
                                );

                                ui.painter().galley(
                                    button_rect.min + egui::vec2(theme::SPACE_MD, theme::SPACE_XS + 2.0),
                                    galley,
                                    button_text,
                                );
                            }

                            if button_response.has_focus() {
                                ui.painter().rect_stroke(
                                    button_rect.expand(2.0),
                                    egui::CornerRadius::same(theme::BUTTON_ROUNDING + 2),
                                    theme::focus_ring(),
                                    egui::epaint::StrokeKind::Outside,
                                );
                            }

                            if button_response.hovered() {
                                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                            }

                            if button_response.clicked() {
                                result.action_clicked = true;
                            }
                        }
                    });

                    // Spacer
                    ui.add_space((ui.available_width() - theme::SPACE_LG).max(0.0));

                    // Dismiss button (meets MIN_TOUCH_TARGET)
                    if self.dismissible {
                        let (close_rect, close_response) =
                            ui.allocate_exact_size(egui::vec2(theme::MIN_TOUCH_TARGET, theme::MIN_TOUCH_TARGET), Sense::click());

                        if ui.is_rect_visible(close_rect) {
                            let is_hovered = close_response.hovered();
                            let close_color = if is_hovered {
                                theme::text_primary()
                            } else {
                                theme::text_tertiary()
                            };

                            if is_hovered {
                                ui.painter().rect_filled(
                                    close_rect,
                                    CornerRadius::same(theme::SPACE_XS as u8),
                                    theme::hover_bg(),
                                );
                            }

                            // Focus Ring (WCAG 2.4.7)
                            if close_response.has_focus() {
                                ui.painter().rect_stroke(
                                    close_rect.expand(2.0),
                                    CornerRadius::same(theme::SPACE_XS as u8 + 2),
                                    theme::focus_ring(),
                                    egui::epaint::StrokeKind::Outside,
                                );
                            }

                            ui.painter().text(
                                close_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                icons::XMARK,
                                theme::font_small(),
                                close_color,
                            );
                        }

                        if close_response.hovered() {
                            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                        }

                        if close_response.clicked() {
                            result.dismissed = true;
                        }
                    }
                });
            });

        result
    }
}

/// Result of showing an alert.
#[derive(Debug, Clone, Copy, Default)]
pub struct AlertResult {
    pub dismissed: bool,
    pub action_clicked: bool,
}

/// Info alert.
pub fn alert_info(ui: &mut Ui, message: &str) -> AlertResult {
    Alert::new(message).level(AlertLevel::Info).show(ui)
}

/// Success alert.
pub fn alert_success(ui: &mut Ui, message: &str) -> AlertResult {
    Alert::new(message).level(AlertLevel::Success).show(ui)
}

/// Warning alert.
pub fn alert_warning(ui: &mut Ui, message: &str) -> AlertResult {
    Alert::new(message).level(AlertLevel::Warning).show(ui)
}

/// Error alert.
pub fn alert_error(ui: &mut Ui, message: &str) -> AlertResult {
    Alert::new(message).level(AlertLevel::Error).show(ui)
}

/// Dismissible info alert with title.
pub fn alert_info_dismissible(ui: &mut Ui, title: &str, message: &str) -> AlertResult {
    Alert::new(message)
        .level(AlertLevel::Info)
        .title(title)
        .dismissible()
        .show(ui)
}

/// Dismissible warning alert with title.
pub fn alert_warning_dismissible(ui: &mut Ui, title: &str, message: &str) -> AlertResult {
    Alert::new(message)
        .level(AlertLevel::Warning)
        .title(title)
        .dismissible()
        .show(ui)
}

/// Dismissible error alert with title.
pub fn alert_error_dismissible(ui: &mut Ui, title: &str, message: &str) -> AlertResult {
    Alert::new(message)
        .level(AlertLevel::Error)
        .title(title)
        .dismissible()
        .show(ui)
}

/// Alert with action button.
pub fn alert_with_action(
    ui: &mut Ui,
    level: AlertLevel,
    message: &str,
    action_label: &str,
) -> AlertResult {
    Alert::new(message)
        .level(level)
        .action(action_label, true)
        .show(ui)
}

/// Compact inline alert.
pub fn alert_compact(ui: &mut Ui, level: AlertLevel, message: &str) -> AlertResult {
    Alert::new(message).level(level).compact().show(ui)
}

/// Banner-style alert (full width, typically at top of page).
pub fn banner(ui: &mut Ui, level: AlertLevel, message: &str, dismissible: bool) -> AlertResult {
    let alert = Alert::new(message).level(level);
    let alert = if dismissible {
        alert.dismissible()
    } else {
        alert
    };
    alert.show(ui)
}
