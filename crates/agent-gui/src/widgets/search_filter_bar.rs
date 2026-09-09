// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reusable search + filter chip bar widget.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// A horizontal bar with a search text input, filter chips, and optional result count.
///
/// Usage (builder pattern):
/// ```ignore
/// let toggled = SearchFilterBar::new(&mut my_search, "Rechercher...")
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
}

impl<'a> SearchFilterBar<'a> {
    pub fn new(search: &'a mut String, placeholder: &'a str) -> Self {
        Self {
            search,
            placeholder,
            chips: Vec::new(),
            count: None,
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

    /// Render the bar. Returns `Some(index)` of a chip that was toggled, or `None`.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        let mut toggled: Option<usize> = None;

        ui.horizontal(|ui: &mut egui::Ui| {
            // Search field: framed and prefixed with a magnifier, matching the
            // global search in the top bar. A bare TextEdit here read as a
            // stray line of text next to the filter chips.
            let search_width = 260.0_f32.min(ui.available_width() * 0.4);
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
                egui::pos2(field.right() - theme::SPACE_SM, field.bottom()),
            );
            ui.allocate_new_ui(egui::UiBuilder::new().max_rect(text_rect), |ui| {
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
                );
            });

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
                    egui::RichText::new(*label)
                        .font(theme::font_label())
                        .color(fg),
                )
                .fill(bg)
                .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, border_color))
                .corner_radius(CornerRadius::same(theme::BADGE_ROUNDING))
                .min_size(Vec2::new(0.0, theme::SEARCH_INPUT_HEIGHT));

                let response = ui.add(btn);

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

            // Result count on right
            if let Some(n) = self.count {
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} résultat(s)", n))
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                    },
                );
            }
        });

        toggled
    }
}
