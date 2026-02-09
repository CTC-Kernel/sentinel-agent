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
            placeholder: "Sélectionner...".to_string(),
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

        let width = self.width.unwrap_or(ui.available_width().min(250.0));
        let height = theme::INPUT_HEIGHT;

        // Main button
        let (rect, response) = ui.allocate_exact_size(egui::vec2(width, height), Sense::click());

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
                CornerRadius::same(theme::BUTTON_ROUNDING),
                bg_color,
                egui::Stroke::new(
                    1.0,
                    if is_open {
                        theme::ACCENT
                    } else {
                        theme::border()
                    },
                ),
                egui::epaint::StrokeKind::Inside,
            );

            // Selected text or placeholder
            let display_text = if self.selected < self.options.len() {
                (self.display_fn)(&self.options[self.selected])
            } else {
                self.placeholder.clone()
            };

            let text_color = if self.selected < self.options.len() {
                theme::text_primary()
            } else {
                theme::text_tertiary()
            };

            painter.text(
                egui::pos2(rect.min.x + 12.0, rect.center().y),
                egui::Align2::LEFT_CENTER,
                display_text,
                theme::font_body(),
                text_color,
            );

            // Chevron icon
            let chevron = if is_open {
                icons::CHEVRON_UP
            } else {
                icons::CHEVRON_DOWN
            };

            painter.text(
                egui::pos2(rect.max.x - 16.0, rect.center().y),
                egui::Align2::CENTER_CENTER,
                chevron,
                theme::font_small(),
                theme::text_tertiary(),
            );
        }

        // Toggle on click
        if response.clicked() {
            ui.memory_mut(|mem| mem.data.insert_temp(self.id, !is_open));
            if !is_open {
                // Clear search when opening
                ui.memory_mut(|mem| mem.data.insert_temp::<String>(search_id, String::new()));
            }
        }

        // Dropdown popup
        if is_open {
            let popup_id = self.id.with("popup");
            let above = rect.min.y > ui.ctx().screen_rect().center().y;

            // Keyboard: Escape to close
            if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
                ui.memory_mut(|mem| mem.data.insert_temp(self.id, false));
            }

            // Keyboard: Arrow keys to navigate, Enter to select
            let highlight_id = self.id.with("highlight");
            let mut highlight_idx: Option<usize> = ui.memory(|mem| mem.data.get_temp(highlight_id));

            if ui.input(|i| i.key_pressed(egui::Key::ArrowDown)) {
                let next = highlight_idx
                    .map(|h| (h + 1).min(self.options.len().saturating_sub(1)))
                    .unwrap_or(0);
                highlight_idx = Some(next);
                ui.memory_mut(|mem| mem.data.insert_temp(highlight_id, next));
            }
            if ui.input(|i| i.key_pressed(egui::Key::ArrowUp)) {
                let prev = highlight_idx.map(|h| h.saturating_sub(1)).unwrap_or(0);
                highlight_idx = Some(prev);
                ui.memory_mut(|mem| mem.data.insert_temp(highlight_id, prev));
            }
            if ui.input(|i| i.key_pressed(egui::Key::Enter))
                && let Some(h) = highlight_idx {
                    new_selection = Some(h);
                    ui.memory_mut(|mem| mem.data.insert_temp(self.id, false));
                }

            egui::Area::new(popup_id)
                .order(egui::Order::Foreground)
                .fixed_pos(if above {
                    egui::pos2(rect.min.x, rect.min.y - 4.0)
                } else {
                    egui::pos2(rect.min.x, rect.max.y + 4.0)
                })
                .show(ui.ctx(), |ui| {
                    egui::Frame::new()
                        .fill(theme::bg_secondary())
                        .corner_radius(CornerRadius::same(theme::BUTTON_ROUNDING))
                        .shadow(theme::premium_shadow(16, 60))
                        .stroke(egui::Stroke::new(1.0, theme::border()))
                        .inner_margin(egui::Margin::same(4))
                        .show(ui, |ui| {
                            ui.set_width(width - 8.0);

                            let mut search_text = ui
                                .memory(|mem| mem.data.get_temp::<String>(search_id))
                                .unwrap_or_default();

                            // Search box if searchable
                            if self.searchable {
                                ui.horizontal(|ui| {
                                    ui.add_space(4.0);
                                    ui.label(
                                        egui::RichText::new(icons::SEARCH)
                                            .color(theme::text_tertiary()),
                                    );
                                    let response = ui.add(
                                        egui::TextEdit::singleline(&mut search_text)
                                            .hint_text("Rechercher...")
                                            .frame(false)
                                            .desired_width(width - 40.0),
                                    );
                                    if response.changed() {
                                        ui.memory_mut(|mem| {
                                            mem.data.insert_temp(search_id, search_text.clone())
                                        });
                                    }
                                });
                                ui.add_space(4.0);
                                ui.separator();
                            }

                            // Options
                            let search_lower = search_text.to_lowercase();
                            let max_height = 200.0;

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

                            let row_height = 32.0;
                            egui::ScrollArea::vertical()
                                .max_height(max_height)
                                .show_rows(
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
                                                egui::vec2(width - 16.0, row_height),
                                                Sense::click(),
                                            );

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
                                                    CornerRadius::same(4),
                                                    bg,
                                                );

                                                // Check mark for selected
                                                if is_selected {
                                                    ui.painter().text(
                                                        egui::pos2(
                                                            option_response.rect.min.x + 8.0,
                                                            option_response.rect.center().y,
                                                        ),
                                                        egui::Align2::LEFT_CENTER,
                                                        icons::CHECK,
                                                        theme::font_small(),
                                                        theme::ACCENT,
                                                    );
                                                }

                                                ui.painter().text(
                                                    egui::pos2(
                                                        option_response.rect.min.x
                                                            + if is_selected { 28.0 } else { 8.0 },
                                                        option_response.rect.center().y,
                                                    ),
                                                    egui::Align2::LEFT_CENTER,
                                                    &text,
                                                    theme::font_body(),
                                                    if is_selected {
                                                        theme::ACCENT
                                                    } else {
                                                        theme::text_primary()
                                                    },
                                                );
                                            }

                                            if option_response.clicked() {
                                                new_selection = Some(i);
                                                ui.memory_mut(|mem| {
                                                    mem.data.insert_temp(self.id, false)
                                                });
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
                            egui::pos2(rect.min.x, rect.min.y - 250.0)
                        } else {
                            egui::pos2(rect.min.x, rect.max.y)
                        },
                        egui::vec2(width, 250.0),
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
