// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reusable search + filter chip bar widget.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// A horizontal bar with a search text input, filter chips, and optional result count.
///
/// Usage (builder pattern):
/// ```ignore
/// let toggled = SearchFilterBar::new(&mut my_search, "Rechercher…")
///     .chip("CONFORME", is_active, theme::SUCCESS)
///     .chip("NON-CONFORME", other_active, theme::ERROR)
///     .result_count(42)
///     .show(ui);
/// ```
pub struct SearchFilterBar<'a> {
    search: &'a mut String,
    placeholder: &'a str,
    chips: Vec<(&'a str, bool, egui::Color32)>,
    count: Option<usize>,
    action: Option<String>,
}

impl<'a> SearchFilterBar<'a> {
    pub fn new(search: &'a mut String, placeholder: &'a str) -> Self {
        Self {
            search,
            placeholder,
            chips: Vec::new(),
            count: None,
            action: None,
        }
    }

    /// Add a filter chip.  `active` = currently selected.
    pub fn chip(mut self, label: &'a str, active: bool, color: egui::Color32) -> Self {
        self.chips.push((label, active, color));
        self
    }

    /// Show a result count on the right side.
    pub fn result_count(mut self, n: usize) -> Self {
        self.count = Some(n);
        self
    }

    /// A ghost action on the trailing edge, next to the result count: the
    /// place for an export that applies to the filtered list, so it sits on
    /// the row it acts on rather than on a row of its own.
    pub fn action(mut self, label: impl Into<String>) -> Self {
        self.action = Some(label.into());
        self
    }

    /// Render the bar. Returns `Some(index)` of a chip that was toggled, or `None`.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        self.show_with_action(ui).0
    }

    /// [`show`](Self::show), also reporting whether the trailing action was clicked.
    pub fn show_with_action(self, ui: &mut Ui) -> (Option<usize>, bool) {
        let mut toggled: Option<usize> = None;
        let mut action_clicked = false;

        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            // Search field: framed and prefixed with a magnifier, matching the
            // global search in the top bar. A bare TextEdit here read as a
            // stray line of text next to the filter chips.
            let search_width = 260.0_f32.min(ui.available_width());
            let (field, _) = ui.allocate_exact_size(
                Vec2::new(search_width, theme::SEARCH_INPUT_HEIGHT),
                egui::Sense::hover(),
            );
            let radius = CornerRadius::same(theme::ROUNDING_MD);
            ui.painter().rect(
                field,
                radius,
                theme::bg_tertiary(),
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                egui::StrokeKind::Inside,
            );
            ui.painter().text(
                egui::pos2(field.left() + theme::SPACE_SM, field.center().y),
                egui::Align2::LEFT_CENTER,
                crate::icons::SEARCH,
                theme::font_icon(theme::ICON_XS),
                theme::text_tertiary(),
            );
            let text_rect = egui::Rect::from_min_max(
                egui::pos2(field.left() + theme::SPACE_LG + 2.0, field.top()),
                egui::pos2(field.right() - 32.0, field.bottom()),
            );
            let editor = ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
                // Clip the editor to the framed field so a long placeholder or
                // value cannot spill past the rounded edge.
                ui.set_clip_rect(text_rect);
                ui.add_sized(
                    text_rect.size(),
                    egui::TextEdit::singleline(self.search)
                        .hint_text(
                            egui::RichText::new(self.placeholder).color(theme::text_tertiary()),
                        )
                        .font(theme::font_body_sm())
                        .text_color(theme::text_primary())
                        .frame(false)
                        .desired_width(text_rect.width()),
                )
            });

            if !self.search.is_empty() {
                let clear_rect = egui::Rect::from_center_size(
                    egui::pos2(field.right() - 16.0, field.center().y),
                    Vec2::splat(28.0),
                );
                let clear = ui
                    .put(clear_rect, egui::Button::new("×").frame(false))
                    .on_hover_text("Effacer la recherche");
                clear.widget_info(|| {
                    egui::WidgetInfo::labeled(
                        egui::WidgetType::Button,
                        ui.is_enabled(),
                        "Effacer la recherche",
                    )
                });
                if clear.clicked() {
                    self.search.clear();
                    editor.inner.request_focus();
                }
            }

            ui.add_space(theme::SPACE_SM);

            // Chips — unified with badge design system
            for (idx, (label, active, color)) in self.chips.iter().enumerate() {
                let (bg, fg) = if *active {
                    (theme::badge_bg(*color), theme::badge_text(*color))
                } else {
                    (egui::Color32::TRANSPARENT, theme::badge_text(*color))
                };

                let border_color = theme::badge_border(*color);

                let btn = egui::Button::new(
                    egui::RichText::new(if *active {
                        format!("✓ {label}")
                    } else {
                        (*label).to_owned()
                    })
                    .font(theme::font_label())
                    .color(fg),
                )
                .fill(bg)
                .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, border_color))
                .corner_radius(CornerRadius::same(theme::BADGE_ROUNDING))
                .min_size(Vec2::new(0.0, theme::SEARCH_INPUT_HEIGHT));

                let response = ui.add(btn);
                response.widget_info(|| {
                    egui::WidgetInfo::selected(
                        egui::WidgetType::SelectableLabel,
                        ui.is_enabled(),
                        *active,
                        *label,
                    )
                });

                // Subtle border emphasis on hover
                if response.hovered() && !*active {
                    let rect = response.rect;
                    ui.painter().rect_stroke(
                        rect,
                        CornerRadius::same(theme::BADGE_ROUNDING),
                        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(*color)),
                        egui::StrokeKind::Inside,
                    );
                }

                if response.clicked() {
                    toggled = Some(idx);
                }
            }

            // Trailing edge: action, then the result count beside it
            if self.count.is_some() || self.action.is_some() {
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        if let Some(label) = self.action.as_deref()
                            && crate::widgets::ghost_button(ui, label).clicked()
                        {
                            action_clicked = true;
                        }
                        if let Some(n) = self.count {
                            ui.label(
                                egui::RichText::new(crate::format::count(n, "résultat"))
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary()),
                            );
                        }
                    },
                );
            }
        });

        (toggled, action_clicked)
    }
}
