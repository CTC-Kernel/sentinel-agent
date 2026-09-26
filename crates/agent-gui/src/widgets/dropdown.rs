// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Dropdown/Select widget for single or multiple selection.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// A dropdown/select widget.
pub struct Dropdown<'a, T> {
    id: egui::Id,
    options: &'a [T],
    selected: usize,
    display_fn: Box<dyn Fn(&T) -> String + 'a>,
    placeholder: String,
    width: Option<f32>,
    searchable: bool,
}

impl<'a, T> Dropdown<'a, T> {
    /// Create a new dropdown with options and currently selected index.
    pub fn new(id: impl std::hash::Hash, options: &'a [T], selected: usize) -> Self
    where
        T: ToString,
    {
        Self {
            id: egui::Id::new(id),
            options,
            selected,
            display_fn: Box::new(|item| item.to_string()),
            placeholder: "Sélectionner…".to_string(),
            width: None,
            searchable: false,
        }
    }

    /// Set a custom display function for options.
    pub fn display_fn(mut self, f: impl Fn(&T) -> String + 'a) -> Self {
        self.display_fn = Box::new(f);
        self
    }

    /// Set the placeholder text when nothing is selected.
    pub fn placeholder(mut self, text: impl Into<String>) -> Self {
        self.placeholder = text.into();
        self
    }

    /// Set a fixed width.
    pub fn width(mut self, width: f32) -> Self {
        self.width = Some(width);
        self
    }

    /// Enable search/filter functionality.
    pub fn searchable(mut self) -> Self {
        self.searchable = true;
        self
    }

    /// Show the dropdown and return the new selected index if changed.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        let mut new_selection = None;
        let is_open = ui.memory(|mem| mem.data.get_temp::<bool>(self.id).unwrap_or(false));
        let search_id = self.id.with("search");

        let width = self.width.unwrap_or(
            ui.available_width()
                .min(theme::DROPDOWN_MAX_HEIGHT + theme::DROPDOWN_POPUP_MARGIN),
        );
        let height = theme::INPUT_HEIGHT;

        // Main button
        let (rect, response) = ui.allocate_exact_size(egui::vec2(width, height), Sense::click());

        let display_text = if self.selected < self.options.len() {
            (self.display_fn)(&self.options[self.selected])
        } else {
            self.placeholder.clone()
        };
        response.widget_info(|| {
            egui::WidgetInfo::labeled(egui::WidgetType::ComboBox, ui.is_enabled(), &display_text)
        });

        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);
            let is_hovered = response.hovered();

            // Background
            let bg_color = if is_open {
                theme::bg_elevated()
            } else if is_hovered {
                theme::hover_bg()
            } else {
                theme::bg_secondary()
            };

            painter.rect(
                rect,
                CornerRadius::same(theme::INPUT_ROUNDING),
                bg_color,
                egui::Stroke::new(
                    theme::BORDER_THIN,
                    if is_open {
                        theme::ACCENT
                    } else {
                        theme::border()
                    },
                ),
                egui::epaint::StrokeKind::Inside,
            );

            // Focus ring for keyboard navigation (WCAG 2.4.7 compliant)
            if response.has_focus() {
                painter.rect_stroke(
                    rect.expand(theme::BORDER_THICK),
                    CornerRadius::same(theme::INPUT_ROUNDING),
                    theme::focus_ring(),
                    egui::StrokeKind::Outside,
                );
            }

            let text_color = if self.selected < self.options.len() {
                theme::text_primary()
            } else {
                theme::text_tertiary()
            };

            let mut job = egui::text::LayoutJob::simple_singleline(
                display_text.clone(),
                theme::font_body(),
                text_color,
            );
            job.wrap.max_width = (rect.width() - theme::SPACE_MD - theme::SPACE * 2.0).max(0.0);
            job.wrap.max_rows = 1;
            job.wrap.break_anywhere = true;
            let galley = ui.fonts(|fonts| fonts.layout_job(job));
            painter.galley(
                egui::pos2(
                    rect.min.x + theme::SPACE_MD,
                    rect.center().y - galley.size().y / 2.0,
                ),
                galley,
                text_color,
            );

            // Chevron icon
            let chevron = if is_open {
                icons::CHEVRON_UP
            } else {
                icons::CHEVRON_DOWN
            };

            painter.text(
                egui::pos2(rect.max.x - theme::SPACE, rect.center().y),
                egui::Align2::CENTER_CENTER,
                chevron,
                theme::font_small(),
                theme::text_tertiary(),
            );
        }

        if response.hovered() {
            response.clone().on_hover_text(&display_text);
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        // Toggle on click
        if response.clicked() {
            ui.memory_mut(|mem| mem.data.insert_temp(self.id, !is_open));
            if !is_open {
                ui.memory_mut(|mem| mem.data.remove::<usize>(self.id.with("highlight")));
                // Clear search when opening
                ui.memory_mut(|mem| mem.data.insert_temp::<String>(search_id, String::new()));
            }
        }

        // Dropdown popup
        if is_open {
            let popup_id = self.id.with("popup");
            // Open downwards unless the list would run off the bottom of the
            // window; flipping whenever the control sat in the lower half
            // laid the list over the fields above it for no reason.
            let list_height = (self.options.len() as f32 * theme::DROPDOWN_ROW_HEIGHT
                + if self.searchable {
                    theme::INPUT_HEIGHT + theme::SPACE_SM
                } else {
                    0.0
                }
                + theme::SPACE_SM)
                .min(theme::DROPDOWN_MAX_HEIGHT + theme::DROPDOWN_POPUP_MARGIN);
            let screen = ui.ctx().screen_rect();
            let fits_below = rect.max.y + theme::SPACE_XS + list_height <= screen.bottom();
            let fits_above = rect.min.y - theme::SPACE_XS - list_height >= screen.top();
            let above = !fits_below && fits_above;

            if ui.input_mut(|i| i.consume_key(egui::Modifiers::NONE, egui::Key::Escape)) {
                ui.memory_mut(|mem| mem.data.insert_temp(self.id, false));
                response.request_focus();
                return None;
            }
            let highlight_id = self.id.with("highlight");
            let mut highlight_idx: Option<usize> = ui.memory(|mem| mem.data.get_temp(highlight_id));

            let area = egui::Area::new(popup_id).order(egui::Order::Foreground);
            let area = if above {
                area.pivot(egui::Align2::LEFT_BOTTOM)
                    .fixed_pos(egui::pos2(rect.min.x, rect.min.y - theme::SPACE_XS))
            } else {
                area.fixed_pos(egui::pos2(rect.min.x, rect.max.y + theme::SPACE_XS))
            };
            area.show(ui.ctx(), |ui| {
                egui::Frame::new()
                    .fill(theme::bg_secondary())
                    .corner_radius(CornerRadius::same(theme::INPUT_ROUNDING))
                    .shadow(theme::Elevation::Level3.ambient())
                    .stroke(egui::Stroke::new(theme::BORDER_THIN, theme::border()))
                    .inner_margin(egui::Margin::same(theme::SPACE_XS as i8))
                    .show(ui, |ui| {
                        ui.set_width(width - theme::SPACE_SM);

                        let mut search_text = ui
                            .memory(|mem| mem.data.get_temp::<String>(search_id))
                            .unwrap_or_default();

                        // Search box if searchable
                        if self.searchable {
                            ui.horizontal(|ui| {
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(icons::SEARCH)
                                        .color(theme::text_tertiary()),
                                );
                                let response = ui.add(
                                    egui::TextEdit::singleline(&mut search_text)
                                        .hint_text("Rechercher…")
                                        .frame(false)
                                        .desired_width(width - theme::INPUT_HEIGHT),
                                );
                                if response.changed() {
                                    ui.memory_mut(|mem| {
                                        mem.data.insert_temp(search_id, search_text.clone())
                                    });
                                }
                            });
                            ui.add_space(theme::SPACE_XS);
                            ui.separator();
                        }

                        // Options
                        let search_lower = search_text.to_lowercase();
                        let max_height = theme::DROPDOWN_MAX_HEIGHT;

                        // Filter options
                        let filtered_options: Vec<(usize, &T)> = self
                            .options
                            .iter()
                            .enumerate()
                            .filter(|(_, option)| {
                                if !self.searchable || search_lower.is_empty() {
                                    return true;
                                }
                                let text = (self.display_fn)(option);
                                text.to_lowercase().contains(&search_lower)
                            })
                            .collect();

                        // Store original option indices, but navigate only the visible results.
                        // Reconcile after editing the search in this very frame.
                        if !filtered_options
                            .iter()
                            .any(|(i, _)| Some(*i) == highlight_idx)
                        {
                            highlight_idx = filtered_options.first().map(|(i, _)| *i);
                        }
                        let mut moved = false;
                        ui.input_mut(|input| {
                            for (key, down) in
                                [(egui::Key::ArrowDown, true), (egui::Key::ArrowUp, false)]
                            {
                                if input.consume_key(egui::Modifiers::NONE, key) {
                                    let position = filtered_options
                                        .iter()
                                        .position(|(i, _)| Some(*i) == highlight_idx)
                                        .unwrap_or(0);
                                    let next = if down {
                                        position
                                            .saturating_add(1)
                                            .min(filtered_options.len().saturating_sub(1))
                                    } else {
                                        position.saturating_sub(1)
                                    };
                                    highlight_idx = filtered_options.get(next).map(|(i, _)| *i);
                                    moved = true;
                                }
                            }
                            if input.consume_key(egui::Modifiers::NONE, egui::Key::Enter) {
                                new_selection = highlight_idx;
                            }
                        });
                        ui.memory_mut(|mem| {
                            if let Some(i) = highlight_idx {
                                mem.data.insert_temp(highlight_id, i);
                            } else {
                                mem.data.remove::<usize>(highlight_id);
                            }
                            if new_selection.is_some() {
                                mem.data.insert_temp(self.id, false);
                            }
                        });
                        if new_selection.is_some() {
                            response.request_focus();
                        }
                        if filtered_options.is_empty() {
                            ui.label(
                                egui::RichText::new("Aucun résultat")
                                    .color(theme::text_secondary()),
                            );
                        }
                        let row_height = theme::DROPDOWN_ROW_HEIGHT;
                        let mut scroll = egui::ScrollArea::vertical().max_height(max_height);
                        if moved
                            && let Some(position) = filtered_options
                                .iter()
                                .position(|(i, _)| Some(*i) == highlight_idx)
                        {
                            scroll = scroll.vertical_scroll_offset(
                                position as f32 * (row_height + ui.spacing().item_spacing.y),
                            );
                        }
                        scroll.show_rows(
                            ui,
                            row_height,
                            filtered_options.len(),
                            |ui, row_range| {
                                for idx in row_range {
                                    if idx >= filtered_options.len() {
                                        continue;
                                    }
                                    let (i, option) = filtered_options[idx];
                                    let text = (self.display_fn)(option);

                                    let is_selected = i == self.selected;
                                    let is_highlighted = highlight_idx == Some(i);
                                    let option_response = ui.allocate_response(
                                        egui::vec2(width - theme::SPACE, row_height),
                                        Sense::click(),
                                    );

                                    option_response.widget_info(|| {
                                        egui::WidgetInfo::selected(
                                            egui::WidgetType::SelectableLabel,
                                            ui.is_enabled(),
                                            is_selected,
                                            &text,
                                        )
                                    });
                                    if ui.is_rect_visible(option_response.rect) {
                                        let is_hovered = option_response.hovered();

                                        let bg = if is_selected {
                                            theme::selected_bg()
                                        } else if is_highlighted || is_hovered {
                                            theme::hover_bg()
                                        } else {
                                            Color32::TRANSPARENT
                                        };

                                        ui.painter().rect_filled(
                                            option_response.rect,
                                            CornerRadius::same(theme::SPACE_XS as u8),
                                            bg,
                                        );

                                        // Check mark for selected
                                        if is_selected {
                                            ui.painter().text(
                                                egui::pos2(
                                                    option_response.rect.min.x + theme::SPACE_SM,
                                                    option_response.rect.center().y,
                                                ),
                                                egui::Align2::LEFT_CENTER,
                                                icons::CHECK,
                                                theme::font_small(),
                                                theme::accent_text(),
                                            );
                                        }

                                        ui.painter().text(
                                            egui::pos2(
                                                option_response.rect.min.x
                                                    + if is_selected {
                                                        theme::TAB_BADGE_WIDTH
                                                    } else {
                                                        theme::SPACE_SM
                                                    },
                                                option_response.rect.center().y,
                                            ),
                                            egui::Align2::LEFT_CENTER,
                                            &text,
                                            theme::font_body(),
                                            if is_selected {
                                                theme::accent_text()
                                            } else {
                                                theme::text_primary()
                                            },
                                        );
                                    }

                                    if option_response.hovered() {
                                        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                                    }

                                    if option_response.clicked() {
                                        new_selection = Some(i);
                                        ui.memory_mut(|mem| mem.data.insert_temp(self.id, false));
                                    }
                                }
                            },
                        );
                    });
            });

            // Close on click outside
            if ui.input(|i| i.pointer.any_click()) && !response.hovered() {
                // Check if click was outside the popup area
                let click_pos = ui.input(|i| i.pointer.interact_pos());
                if let Some(pos) = click_pos {
                    let popup_rect = egui::Rect::from_min_size(
                        if above {
                            egui::pos2(
                                rect.min.x,
                                rect.min.y
                                    - theme::SPACE_XS
                                    - theme::DROPDOWN_MAX_HEIGHT
                                    - theme::DROPDOWN_POPUP_MARGIN,
                            )
                        } else {
                            egui::pos2(rect.min.x, rect.max.y)
                        },
                        egui::vec2(
                            width,
                            theme::DROPDOWN_MAX_HEIGHT + theme::DROPDOWN_POPUP_MARGIN,
                        ),
                    );
                    if !popup_rect.contains(pos) && !rect.contains(pos) {
                        ui.memory_mut(|mem| mem.data.insert_temp(self.id, false));
                    }
                }
            }
        }

        new_selection
    }
}

/// Simple dropdown for string options.
pub fn dropdown(
    ui: &mut Ui,
    id: impl std::hash::Hash,
    options: &[&str],
    selected: &mut usize,
) -> bool {
    let options_owned: Vec<String> = options.iter().map(|s| s.to_string()).collect();
    if let Some(new_idx) = Dropdown::new(id, &options_owned, *selected).show(ui) {
        *selected = new_idx;
        true
    } else {
        false
    }
}

/// Dropdown with custom width.
pub fn dropdown_width(
    ui: &mut Ui,
    id: impl std::hash::Hash,
    options: &[&str],
    selected: &mut usize,
    width: f32,
) -> bool {
    let options_owned: Vec<String> = options.iter().map(|s| s.to_string()).collect();
    if let Some(new_idx) = Dropdown::new(id, &options_owned, *selected)
        .width(width)
        .show(ui)
    {
        *selected = new_idx;
        true
    } else {
        false
    }
}

#[cfg(test)]
mod regression_tests {
    use super::*;
    fn select_filtered(search: &str, keys: &[egui::Key]) -> Option<usize> {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let id = egui::Id::new("filtered_test");
        ctx.memory_mut(|m| {
            m.data.insert_temp(id, true);
            m.data.insert_temp(id.with("search"), search.to_string());
            m.data.insert_temp(id.with("highlight"), 0usize);
        });
        let mut selection = None;
        for frame in 0..3 {
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(960.0, 640.0),
                    )),
                    events: if frame == 2 {
                        keys.iter()
                            .map(|key| egui::Event::Key {
                                key: *key,
                                physical_key: None,
                                pressed: true,
                                repeat: false,
                                modifiers: egui::Modifiers::NONE,
                            })
                            .collect()
                    } else {
                        vec![]
                    },
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        selection = Dropdown::new("filtered_test", &["Alpha", "Beta", "Alpine"], 0)
                            .searchable()
                            .show(ui);
                    });
                },
            );
        }
        selection
    }
    #[test]
    fn enter_selects_visible_original_index() {
        assert_eq!(select_filtered("Beta", &[egui::Key::Enter]), Some(1));
    }
    #[test]
    fn arrows_skip_filtered_out_options() {
        assert_eq!(
            select_filtered("Al", &[egui::Key::ArrowDown, egui::Key::Enter]),
            Some(2)
        );
    }
    #[test]
    fn empty_filter_never_selects_hidden_option() {
        assert_eq!(select_filtered("missing", &[egui::Key::Enter]), None);
    }
}
