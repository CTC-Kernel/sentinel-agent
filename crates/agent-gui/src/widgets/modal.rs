//! Modal and dialog widgets for confirmations and forms.

use crate::icons;
use crate::theme;
use crate::widgets::button;
use egui::{Color32, CornerRadius, Ui};

/// Modal dialog result.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModalResult {
    None,
    Confirm,
    Cancel,
    Dismiss,
}

/// Modal dialog type/style.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ModalStyle {
    #[default]
    Info,
    Warning,
    Danger,
    Success,
}

/// A modal dialog builder.
pub struct Modal {
    id: egui::Id,
    title: String,
    message: Option<String>,
    style: ModalStyle,
    confirm_text: String,
    cancel_text: Option<String>,
    show_close: bool,
    width: f32,
}

impl Modal {
    /// Create a new modal with the given ID and title.
    pub fn new(id: impl std::hash::Hash, title: impl Into<String>) -> Self {
        Self {
            id: egui::Id::new(id),
            title: title.into(),
            message: None,
            style: ModalStyle::Info,
            confirm_text: "Confirmer".to_string(),
            cancel_text: Some("Annuler".to_string()),
            show_close: true,
            width: 400.0,
        }
    }

    /// Set the modal message/body text.
    pub fn message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    /// Set the modal style.
    pub fn style(mut self, style: ModalStyle) -> Self {
        self.style = style;
        self
    }

    /// Set the confirm button text.
    pub fn confirm_text(mut self, text: impl Into<String>) -> Self {
        self.confirm_text = text.into();
        self
    }

    /// Set the cancel button text (None to hide cancel button).
    pub fn cancel_text(mut self, text: Option<String>) -> Self {
        self.cancel_text = text;
        self
    }

    /// Whether to show the close (X) button.
    pub fn show_close(mut self, show: bool) -> Self {
        self.show_close = show;
        self
    }

    /// Set the modal width.
    pub fn width(mut self, width: f32) -> Self {
        self.width = width;
        self
    }

    /// Open the modal.
    pub fn open(ctx: &egui::Context, id: impl std::hash::Hash) {
        ctx.memory_mut(|mem| mem.data.insert_temp(egui::Id::new(id), true));
    }

    /// Close the modal.
    pub fn close(ctx: &egui::Context, id: impl std::hash::Hash) {
        ctx.memory_mut(|mem| mem.data.insert_temp(egui::Id::new(id), false));
    }

    /// Check if the modal is open.
    pub fn is_open(ctx: &egui::Context, id: impl std::hash::Hash) -> bool {
        ctx.memory(|mem| {
            mem.data
                .get_temp::<bool>(egui::Id::new(id))
                .unwrap_or(false)
        })
    }

    /// Show the modal and return the result.
    pub fn show(self, ctx: &egui::Context) -> ModalResult {
        let is_open = ctx.memory(|mem| mem.data.get_temp::<bool>(self.id).unwrap_or(false));

        if !is_open {
            return ModalResult::None;
        }

        let mut result = ModalResult::None;

        // Keyboard: Escape to dismiss, Enter to confirm
        if self.show_close && ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            result = ModalResult::Dismiss;
        }
        if ctx.input(|i| i.key_pressed(egui::Key::Enter)) {
            result = ModalResult::Confirm;
        }

        // Backdrop
        let screen = ctx.screen_rect();
        egui::Area::new(egui::Id::new("modal_backdrop").with(self.id))
            .fixed_pos(screen.min)
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                let backdrop_response = ui.allocate_response(screen.size(), egui::Sense::click());

                // Dark backdrop
                ui.painter().rect_filled(
                    screen,
                    CornerRadius::ZERO,
                    Color32::from_black_alpha(180),
                );

                // Close on backdrop click
                if backdrop_response.clicked() && self.show_close {
                    result = ModalResult::Dismiss;
                }
            });

        // Modal window
        egui::Area::new(egui::Id::new("modal_window").with(self.id))
            .fixed_pos(screen.center() - egui::vec2(self.width / 2.0, 150.0))
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                let modal_result = self.draw_modal(ui);
                if modal_result != ModalResult::None {
                    result = modal_result;
                }
            });

        // Close modal if action taken
        if result != ModalResult::None {
            ctx.memory_mut(|mem| mem.data.insert_temp(self.id, false));
        }

        result
    }

    fn draw_modal(&self, ui: &mut Ui) -> ModalResult {
        let mut result = ModalResult::None;

        let (icon, color) = match self.style {
            ModalStyle::Info => (icons::INFO, theme::INFO),
            ModalStyle::Warning => (icons::WARNING, theme::WARNING),
            ModalStyle::Danger => (icons::CIRCLE_XMARK, theme::ERROR),
            ModalStyle::Success => (icons::CIRCLE_CHECK, theme::SUCCESS),
        };

        // Modal frame
        egui::Frame::new()
            .fill(theme::bg_secondary())
            .corner_radius(CornerRadius::same(16))
            .shadow(theme::premium_shadow(24, 80))
            .stroke(egui::Stroke::new(1.0, theme::border()))
            .inner_margin(egui::Margin::same(0))
            .show(ui, |ui| {
                ui.set_width(self.width);

                // Header with icon and title
                ui.vertical(|ui| {
                    // Top colored bar
                    let header_rect = ui.allocate_space(egui::vec2(self.width, 4.0)).1;
                    ui.painter().rect_filled(
                        header_rect,
                        CornerRadius {
                            nw: 16,
                            ne: 16,
                            ..Default::default()
                        },
                        color,
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Icon and close button row
                    ui.horizontal(|ui| {
                        ui.add_space(theme::SPACE_LG);

                        // Icon circle
                        let icon_size = 48.0;
                        let (icon_rect, _) = ui.allocate_exact_size(
                            egui::vec2(icon_size, icon_size),
                            egui::Sense::hover(),
                        );
                        ui.painter().circle_filled(
                            icon_rect.center(),
                            icon_size / 2.0,
                            color.linear_multiply(0.15),
                        );
                        ui.painter().text(
                            icon_rect.center(),
                            egui::Align2::CENTER_CENTER,
                            icon,
                            egui::FontId::proportional(24.0),
                            color,
                        );

                        ui.add_space(theme::SPACE_MD);

                        // Title
                        ui.vertical(|ui| {
                            ui.add_space(4.0);
                            ui.label(
                                egui::RichText::new(&self.title)
                                    .font(theme::font_heading())
                                    .color(theme::text_primary())
                                    .strong(),
                            );
                        });

                        // Close button
                        if self.show_close {
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::TOP), |ui| {
                                ui.add_space(theme::SPACE_MD);
                                if button::icon_button(ui, icons::XMARK, Some("Fermer")).clicked() {
                                    result = ModalResult::Dismiss;
                                }
                            });
                        }
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Message body
                    if let Some(ref msg) = self.message {
                        ui.horizontal(|ui| {
                            ui.add_space(theme::SPACE_LG);
                            ui.add(
                                egui::Label::new(
                                    egui::RichText::new(msg)
                                        .font(theme::font_body())
                                        .color(theme::text_secondary()),
                                )
                                .wrap_mode(egui::TextWrapMode::Wrap),
                            );
                            ui.add_space(theme::SPACE_LG);
                        });
                    }

                    ui.add_space(theme::SPACE_LG);

                    // Action buttons
                    ui.horizontal(|ui| {
                        ui.add_space(theme::SPACE_LG);

                        // Cancel button
                        if let Some(ref cancel_text) = self.cancel_text {
                            if button::secondary_button(ui, cancel_text.as_str(), true).clicked() {
                                result = ModalResult::Cancel;
                            }
                            ui.add_space(theme::SPACE_SM);
                        }

                        // Confirm button
                        let confirm_response = match self.style {
                            ModalStyle::Danger => {
                                button::destructive_button(ui, self.confirm_text.as_str(), true)
                            }
                            _ => button::primary_button(ui, self.confirm_text.as_str(), true),
                        };

                        if confirm_response.clicked() {
                            result = ModalResult::Confirm;
                        }

                        ui.add_space(theme::SPACE_LG);
                    });

                    ui.add_space(theme::SPACE_LG);
                });
            });

        result
    }
}

/// A simple confirmation dialog.
pub fn confirm_dialog(
    ctx: &egui::Context,
    id: impl std::hash::Hash,
    title: &str,
    message: &str,
) -> ModalResult {
    Modal::new(id, title)
        .message(message)
        .style(ModalStyle::Warning)
        .confirm_text("Confirmer")
        .show(ctx)
}

/// A danger confirmation dialog (for destructive actions).
pub fn danger_dialog(
    ctx: &egui::Context,
    id: impl std::hash::Hash,
    title: &str,
    message: &str,
    confirm_text: &str,
) -> ModalResult {
    Modal::new(id, title)
        .message(message)
        .style(ModalStyle::Danger)
        .confirm_text(confirm_text)
        .show(ctx)
}

/// An info dialog (single OK button).
pub fn info_dialog(
    ctx: &egui::Context,
    id: impl std::hash::Hash,
    title: &str,
    message: &str,
) -> ModalResult {
    Modal::new(id, title)
        .message(message)
        .style(ModalStyle::Info)
        .confirm_text("OK")
        .cancel_text(None)
        .show(ctx)
}

/// A success dialog.
pub fn success_dialog(
    ctx: &egui::Context,
    id: impl std::hash::Hash,
    title: &str,
    message: &str,
) -> ModalResult {
    Modal::new(id, title)
        .message(message)
        .style(ModalStyle::Success)
        .confirm_text("OK")
        .cancel_text(None)
        .show(ctx)
}
