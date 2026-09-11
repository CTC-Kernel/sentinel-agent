// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The assistant's prompt field: one framed line with a send control.
//!
//! The dashboard card and the assistant page both ask the model a question;
//! before this widget each drew a bare `TextEdit` beside a transparent
//! button, which read as a stray underline. Now both draw the same field,
//! with the same focus ring, the same disabled look while the model is
//! busy, and Enter sending without dropping the focus.

use egui::{Response, Sense, Ui};

use crate::icons;
use crate::theme;

/// What the field reports for the frame.
pub struct ChatInputResponse {
    /// The editor's response.
    pub response: Response,
    /// The user asked to send: Enter in the field, or the send button.
    /// Only reported when there is something to send and nothing running.
    pub send: bool,
}

pub struct ChatInput<'a> {
    value: &'a mut String,
    placeholder: &'a str,
    processing: bool,
    id_salt: egui::Id,
}

impl<'a> ChatInput<'a> {
    pub fn new(value: &'a mut String, placeholder: &'a str) -> Self {
        Self {
            value,
            placeholder,
            processing: false,
            id_salt: egui::Id::new("chat_input"),
        }
    }

    /// The model is answering: the field is read-only and the send control
    /// becomes a spinner.
    pub fn processing(mut self, processing: bool) -> Self {
        self.processing = processing;
        self
    }

    /// Stable id when several fields share a parent.
    pub fn id_salt(mut self, salt: impl std::hash::Hash) -> Self {
        self.id_salt = egui::Id::new(salt);
        self
    }

    pub fn show(self, ui: &mut Ui) -> ChatInputResponse {
        let height = theme::INPUT_HEIGHT;
        let width = ui.available_width().max(theme::MIN_TOUCH_TARGET * 3.0);
        let (field, frame_response) =
            ui.allocate_exact_size(egui::vec2(width, height), Sense::hover());
        let editor_id = ui.id().with(self.id_salt);
        let focused = ui.memory(|memory| memory.has_focus(editor_id));
        let radius = egui::CornerRadius::same(theme::INPUT_ROUNDING);
        let can_send = !self.processing && !self.value.trim().is_empty();

        if ui.is_rect_visible(field) {
            let fill = if self.processing {
                theme::bg_tertiary().linear_multiply(theme::OPACITY_PRESSED)
            } else if frame_response.hovered() || focused {
                theme::bg_elevated()
            } else {
                theme::bg_tertiary()
            };
            ui.painter().rect(
                field,
                radius,
                fill,
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                egui::epaint::StrokeKind::Inside,
            );
            ui.painter().text(
                egui::pos2(field.left() + theme::SPACE_MD, field.center().y),
                egui::Align2::LEFT_CENTER,
                icons::WAND_SPARKLES,
                theme::font_icon(theme::ICON_XS),
                if focused {
                    theme::readable_color(theme::AI)
                } else {
                    theme::text_tertiary()
                },
            );
        }

        // The send control's slot on the trailing edge.
        let slot = height;
        let text_rect = egui::Rect::from_min_max(
            egui::pos2(
                field.left() + theme::SPACE_MD + theme::ICON_XS + theme::SPACE_SM,
                field.top(),
            ),
            egui::pos2(field.right() - slot - theme::SPACE_XS, field.bottom()),
        );
        let editor = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
            ui.set_clip_rect(text_rect.intersect(ui.clip_rect()));
            ui.add_enabled(
                !self.processing,
                egui::TextEdit::singleline(self.value)
                    .id(editor_id)
                    .hint_text(egui::RichText::new(self.placeholder).color(theme::text_tertiary()))
                    .font(theme::font_body())
                    .vertical_align(egui::Align::Center)
                    .text_color(theme::text_primary())
                    .frame(false)
                    .margin(egui::Margin::ZERO)
                    .desired_width(text_rect.width())
                    .min_size(text_rect.size()),
            )
        });
        let response = editor.inner;
        response.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::TextEdit,
                ui.is_enabled(),
                self.placeholder,
            )
        });

        if response.has_focus() {
            ui.painter().rect_stroke(
                field,
                radius,
                theme::focus_ring(),
                egui::epaint::StrokeKind::Inside,
            );
        }

        // Enter sends from the field itself; the focus stays so the next
        // question can be typed without reaching for the mouse.
        let enter = response.has_focus()
            && ui.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Enter));

        let send_rect = egui::Rect::from_center_size(
            egui::pos2(field.right() - slot / 2.0, field.center().y),
            egui::Vec2::splat(theme::MIN_TOUCH_TARGET - theme::SPACE_XS),
        );
        let mut send = enter && can_send;
        if self.processing {
            spinner(ui, send_rect.center(), theme::ICON_SM / 2.0);
        } else {
            let button = ui
                .put(send_rect, SendButton { enabled: can_send })
                .on_hover_text(if can_send {
                    "Envoyer · Entrée"
                } else {
                    "Saisissez une question pour l'envoyer"
                });
            button.widget_info(|| {
                egui::WidgetInfo::labeled(egui::WidgetType::Button, can_send, "Envoyer")
            });
            if button.clicked() && can_send {
                send = true;
                response.request_focus();
            }
        }

        ui.advance_cursor_after_rect(field);
        ChatInputResponse { response, send }
    }
}

/// Round accent send control, dimmed while there is nothing to send.
struct SendButton {
    enabled: bool,
}

impl egui::Widget for SendButton {
    fn ui(self, ui: &mut Ui) -> Response {
        let size = egui::Vec2::splat(theme::MIN_TOUCH_TARGET - theme::SPACE_XS);
        let sense = if self.enabled {
            Sense::click()
        } else {
            Sense::hover()
        };
        let (rect, response) = ui.allocate_exact_size(size, sense);
        if ui.is_rect_visible(rect) {
            let hover = crate::animation::animate_hover(
                ui.ctx(),
                response.id.with("send_hover"),
                self.enabled && response.hovered(),
            );
            let (fill, fg) = if self.enabled {
                (
                    crate::animation::lerp_color(theme::ACCENT, theme::ACCENT_HOVER, hover),
                    theme::text_on_accent(),
                )
            } else {
                (
                    theme::bg_elevated(),
                    theme::text_tertiary().linear_multiply(theme::OPACITY_DISABLED),
                )
            };
            let radius = rect.height() / 2.0;
            ui.painter().circle_filled(rect.center(), radius, fill);
            ui.painter().text(
                rect.center() + egui::vec2(-1.0, 0.0),
                egui::Align2::CENTER_CENTER,
                icons::PAPER_PLANE,
                theme::font_icon(theme::ICON_XS),
                fg,
            );
            if response.has_focus() {
                ui.painter().circle_stroke(
                    rect.center(),
                    radius + theme::BORDER_THIN,
                    theme::focus_ring(),
                );
            }
        }
        if self.enabled && response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        } else if !self.enabled && response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::NotAllowed);
        }
        response
    }
}

/// A small arc that turns while the model works.
fn spinner(ui: &Ui, center: egui::Pos2, radius: f32) {
    let t = ui.input(|i| i.time);
    let painter = ui.painter();
    painter.circle_stroke(
        center,
        radius,
        egui::Stroke::new(theme::BORDER_THICK, theme::border_subtle()),
    );
    if theme::is_reduced_motion() {
        return;
    }
    let start = (t * theme::ANIM_SPINNER_SPEED * std::f64::consts::TAU) as f32;
    let points: Vec<egui::Pos2> = (0..=16)
        .map(|i| {
            let a = start + i as f32 / 16.0 * std::f32::consts::PI * 0.75;
            center + egui::vec2(a.cos(), a.sin()) * radius
        })
        .collect();
    painter.add(egui::Shape::line(
        points,
        egui::Stroke::new(theme::BORDER_THICK, theme::readable_color(theme::AI)),
    ));
    ui.ctx().request_repaint();
}
