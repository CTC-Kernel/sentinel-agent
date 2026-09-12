// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Form layout: the label and the control, placed the same way on every
//! form.
//!
//! The inline "create" forms (asset, alert rule, webhook, playbook,
//! detection rule) each arranged their own rows: labels of different widths
//! pushed each field's control to a different x, and a row of stacked
//! fields at fixed widths ran past the card on a 1360px window, folding the
//! last label letter by letter. These helpers give a form two shapes and
//! nothing else: a label column with the control beside it ([`row`]), or
//! stacked fields that wrap ([`fields`] + [`field`]).

use egui::Ui;

use crate::theme;

/// Width of the label column in a [`row`] form.
pub const LABEL_COLUMN: f32 = 112.0;

/// The eyebrow label above or beside a control.
pub fn label(ui: &mut Ui, text: &str) {
    ui.add(
        egui::Label::new(
            egui::RichText::new(text)
                .font(theme::font_label())
                .color(theme::text_secondary()),
        )
        .truncate()
        .selectable(false),
    );
}

/// A label column and, beside it, the control `add` draws. Every row of a
/// form shares the column, so the controls line up.
pub fn row(ui: &mut Ui, text: &str, add: impl FnOnce(&mut Ui)) {
    ui.horizontal(|ui| {
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(LABEL_COLUMN, theme::INPUT_HEIGHT),
            egui::Sense::hover(),
        );
        ui.painter().text(
            egui::pos2(rect.left(), rect.center().y),
            egui::Align2::LEFT_CENTER,
            text,
            theme::font_label(),
            theme::text_secondary(),
        );
        ui.vertical(|ui| {
            ui.set_max_width(ui.available_width());
            add(ui);
        });
    });
    ui.add_space(theme::SPACE_XS);
}

/// A row of stacked fields (label above control) that wraps when the card
/// is too narrow for all of them side by side. Fields align on their top
/// edge, so the labels of a text input, a dropdown and a switch sit on one
/// line whatever the height of the control under them.
pub fn fields(ui: &mut Ui, add: impl FnOnce(&mut Ui)) {
    ui.with_layout(
        egui::Layout::left_to_right(egui::Align::Min).with_main_wrap(true),
        |ui| {
            ui.spacing_mut().item_spacing = egui::vec2(theme::SPACE, theme::SPACE_MD);
            add(ui);
        },
    );
}

/// One stacked field of `width` points: the label, then the control.
///
/// Inside [`fields`], the width is what the row wraps on; the control is
/// bounded to it, so a text input never takes the whole line.
pub fn field(ui: &mut Ui, text: &str, width: f32, add: impl FnOnce(&mut Ui)) {
    let width = width.min(ui.available_width().max(theme::MIN_TOUCH_TARGET * 2.0));
    // The row wraps on the size asked for, and the field's height is only
    // known once its control has been drawn: ask for last frame's height
    // (a label over an input until then), then draw into the slot.
    let id = ui.id().with(("form_field", text));
    let remembered: Option<f32> = ui.data(|data| data.get_temp(id));
    let expected = remembered
        .unwrap_or(theme::font_label().size + theme::SPACE_XS * 2.0 + theme::INPUT_HEIGHT);
    let (slot, _) = ui.allocate_exact_size(egui::vec2(width, expected), egui::Sense::hover());
    let mut child = ui.new_child(
        egui::UiBuilder::new()
            .max_rect(egui::Rect::from_min_size(
                slot.min,
                egui::vec2(width, f32::INFINITY),
            ))
            .layout(egui::Layout::top_down(egui::Align::Min)),
    );
    child.set_width(width);
    label(&mut child, text);
    child.add_space(theme::SPACE_XS);
    add(&mut child);
    let used = child.min_rect().height();
    if (used - expected).abs() > 0.5 {
        ui.data_mut(|data| data.insert_temp(id, used));
        ui.ctx().request_repaint();
    }
}

/// The form's action row: primary action first, then the rest.
pub fn actions(ui: &mut Ui, add: impl FnOnce(&mut Ui)) {
    ui.add_space(theme::SPACE_SM);
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = theme::SPACE_SM;
        add(ui);
    });
}
