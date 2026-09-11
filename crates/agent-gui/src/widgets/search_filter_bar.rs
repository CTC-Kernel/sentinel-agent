// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Reusable search + filter chip bar widget.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// Narrowest the search field goes before the chips wrap under it.
const SEARCH_MIN_WIDTH: f32 = 240.0;
/// Widest it goes on a large display.
const SEARCH_MAX_WIDTH: f32 = 460.0;

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
            // The shared search field, sized to the row: two fifths of the
            // bar on a wide window, never narrower than a readable
            // placeholder, never wider than a comfortable line.
            let search_width = (ui.available_width() * 0.42)
                .clamp(SEARCH_MIN_WIDTH, SEARCH_MAX_WIDTH)
                .min(ui.available_width());
            crate::widgets::SearchInput::new(self.search, self.placeholder)
                .width(search_width)
                .height(theme::SEARCH_INPUT_HEIGHT)
                .show(ui);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_clears_the_focused_search_without_leaving_it() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let mut search = String::from("serveur");
        let mut frame = |events| {
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(640.0, 200.0),
                    )),
                    events,
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        SearchFilterBar::new(&mut search, "Rechercher un équipement").show(ui);
                    });
                },
            );
        };
        frame(vec![]);
        let position = egui::pos2(80.0, 22.0);
        frame(vec![
            egui::Event::PointerMoved(position),
            egui::Event::PointerButton {
                pos: position,
                button: egui::PointerButton::Primary,
                pressed: true,
                modifiers: egui::Modifiers::NONE,
            },
        ]);
        frame(vec![egui::Event::PointerButton {
            pos: position,
            button: egui::PointerButton::Primary,
            pressed: false,
            modifiers: egui::Modifiers::NONE,
        }]);
        let focused = ctx.memory(|memory| memory.focused());
        assert!(focused.is_some());
        frame(vec![egui::Event::Key {
            key: egui::Key::Escape,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers: egui::Modifiers::NONE,
        }]);
        assert!(search.is_empty());
        assert_eq!(ctx.memory(|memory| memory.focused()), focused);
    }
}
