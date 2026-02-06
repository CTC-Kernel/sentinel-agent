//! Command palette / spotlight search widget.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Key, Sense};

/// A command/action item in the palette.
#[derive(Debug, Clone)]
pub struct CommandItem {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub shortcut: Option<String>,
    pub category: Option<String>,
}

impl CommandItem {
    /// Create a new command item.
    pub fn new(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            description: None,
            icon: None,
            shortcut: None,
            category: None,
        }
    }

    /// Add a description.
    pub fn description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    /// Add an icon.
    pub fn icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    /// Add a keyboard shortcut display.
    pub fn shortcut(mut self, shortcut: impl Into<String>) -> Self {
        self.shortcut = Some(shortcut.into());
        self
    }

    /// Add a category for grouping.
    pub fn category(mut self, category: impl Into<String>) -> Self {
        self.category = Some(category.into());
        self
    }
}

/// Command palette state.
#[derive(Default)]
pub struct CommandPaletteState {
    pub open: bool,
    pub query: String,
    pub selected_index: usize,
}

impl CommandPaletteState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Open the palette.
    pub fn open(&mut self) {
        self.open = true;
        self.query.clear();
        self.selected_index = 0;
    }

    /// Close the palette.
    pub fn close(&mut self) {
        self.open = false;
        self.query.clear();
        self.selected_index = 0;
    }

    /// Toggle the palette.
    pub fn toggle(&mut self) {
        if self.open {
            self.close();
        } else {
            self.open();
        }
    }
}

/// Command palette widget.
pub struct CommandPalette<'a> {
    commands: &'a [CommandItem],
    placeholder: String,
    max_results: usize,
}

impl<'a> CommandPalette<'a> {
    /// Create a new command palette.
    pub fn new(commands: &'a [CommandItem]) -> Self {
        Self {
            commands,
            placeholder: "Rechercher une commande...".to_string(),
            max_results: 10,
        }
    }

    /// Set the placeholder text.
    pub fn placeholder(mut self, text: impl Into<String>) -> Self {
        self.placeholder = text.into();
        self
    }

    /// Set max results to show.
    pub fn max_results(mut self, max: usize) -> Self {
        self.max_results = max;
        self
    }

    /// Filter commands by query.
    fn filter_commands(&self, query: &str) -> Vec<&CommandItem> {
        if query.is_empty() {
            return self.commands.iter().take(self.max_results).collect();
        }

        let query_lower = query.to_lowercase();
        let mut results: Vec<(&CommandItem, i32)> = self
            .commands
            .iter()
            .filter_map(|cmd| {
                let label_lower = cmd.label.to_lowercase();
                let desc_lower = cmd
                    .description
                    .as_ref()
                    .map(|d| d.to_lowercase())
                    .unwrap_or_default();
                let cat_lower = cmd
                    .category
                    .as_ref()
                    .map(|c| c.to_lowercase())
                    .unwrap_or_default();

                // Score based on match quality
                let mut score = 0;

                if label_lower.starts_with(&query_lower) {
                    score += 100;
                } else if label_lower.contains(&query_lower) {
                    score += 50;
                }

                if desc_lower.contains(&query_lower) {
                    score += 25;
                }

                if cat_lower.contains(&query_lower) {
                    score += 10;
                }

                if score > 0 {
                    Some((cmd, score))
                } else {
                    None
                }
            })
            .collect();

        // Sort by score (descending)
        results.sort_by(|a, b| b.1.cmp(&a.1));

        results
            .into_iter()
            .take(self.max_results)
            .map(|(cmd, _)| cmd)
            .collect()
    }

    /// Show the command palette. Returns selected command ID if any.
    pub fn show(self, ctx: &egui::Context, state: &mut CommandPaletteState) -> Option<String> {
        if !state.open {
            return None;
        }

        let mut result: Option<String> = None;
        let filtered = self.filter_commands(&state.query);

        // Clamp selected index
        if state.selected_index >= filtered.len() {
            state.selected_index = filtered.len().saturating_sub(1);
        }

        // Handle keyboard
        ctx.input(|i| {
            if i.key_pressed(Key::Escape) {
                state.close();
            }
            if i.key_pressed(Key::ArrowDown) {
                state.selected_index = (state.selected_index + 1).min(filtered.len().saturating_sub(1));
            }
            if i.key_pressed(Key::ArrowUp) {
                state.selected_index = state.selected_index.saturating_sub(1);
            }
            if i.key_pressed(Key::Enter) && !filtered.is_empty() {
                if let Some(cmd) = filtered.get(state.selected_index) {
                    result = Some(cmd.id.clone());
                    state.close();
                }
            }
        });

        // Backdrop
        egui::Area::new(egui::Id::new("command_palette_backdrop"))
            .order(egui::Order::Foreground)
            .anchor(egui::Align2::LEFT_TOP, egui::vec2(0.0, 0.0))
            .show(ctx, |ui| {
                let screen = ctx.screen_rect();
                let (backdrop_rect, backdrop_response) =
                    ui.allocate_exact_size(screen.size(), Sense::click());

                if ui.is_rect_visible(backdrop_rect) {
                    ui.painter().rect_filled(
                        backdrop_rect,
                        0,
                        Color32::from_black_alpha(100),
                    );
                }

                if backdrop_response.clicked() {
                    state.close();
                }
            });

        // Palette window
        let palette_width = 560.0;
        let screen = ctx.screen_rect();
        let palette_x = (screen.width() - palette_width) / 2.0;
        let palette_y = screen.height() * 0.2;

        egui::Area::new(egui::Id::new("command_palette"))
            .order(egui::Order::Foreground)
            .fixed_pos(egui::pos2(palette_x, palette_y))
            .show(ctx, |ui| {
                egui::Frame::new()
                    .fill(theme::bg_secondary())
                    .corner_radius(CornerRadius::same(12))
                    .shadow(theme::premium_shadow(24, 80))
                    .stroke(egui::Stroke::new(1.0, theme::border()))
                    .inner_margin(egui::Margin::same(0))
                    .show(ui, |ui| {
                        ui.set_width(palette_width);

                        // Search input
                        egui::Frame::new()
                            .inner_margin(egui::Margin::same(16))
                            .show(ui, |ui| {
                                ui.horizontal(|ui| {
                                    ui.label(
                                        egui::RichText::new(icons::SEARCH)
                                            .font(theme::font_heading())
                                            .color(theme::text_tertiary()),
                                    );
                                    ui.add_space(12.0);

                                    let response = ui.add(
                                        egui::TextEdit::singleline(&mut state.query)
                                            .hint_text(&self.placeholder)
                                            .frame(false)
                                            .font(theme::font_heading())
                                            .desired_width(palette_width - 80.0),
                                    );

                                    // Auto-focus
                                    response.request_focus();
                                });
                            });

                        // Divider
                        ui.painter().line_segment(
                            [
                                egui::pos2(ui.min_rect().min.x, ui.min_rect().max.y),
                                egui::pos2(ui.min_rect().min.x + palette_width, ui.min_rect().max.y),
                            ],
                            egui::Stroke::new(1.0, theme::border()),
                        );

                        // Results
                        if !filtered.is_empty() {
                            egui::ScrollArea::vertical()
                                .max_height(400.0)
                                .show(ui, |ui| {
                                    ui.add_space(8.0);

                                    let mut current_category: Option<&str> = None;

                                    for (i, cmd) in filtered.iter().enumerate() {
                                        // Category header
                                        if let Some(cat) = &cmd.category {
                                            if current_category != Some(cat.as_str()) {
                                                current_category = Some(cat.as_str());
                                                ui.add_space(8.0);
                                                ui.horizontal(|ui| {
                                                    ui.add_space(16.0);
                                                    ui.label(
                                                        egui::RichText::new(cat.to_uppercase())
                                                            .font(theme::font_label())
                                                            .color(theme::text_tertiary()),
                                                    );
                                                });
                                                ui.add_space(4.0);
                                            }
                                        }

                                        let is_selected = i == state.selected_index;

                                        let (item_rect, item_response) = ui.allocate_exact_size(
                                            egui::vec2(palette_width, 48.0),
                                            Sense::click(),
                                        );

                                        if ui.is_rect_visible(item_rect) {
                                            let is_hovered = item_response.hovered();

                                            // Background
                                            if is_selected || is_hovered {
                                                let bg = if is_selected {
                                                    theme::ACCENT.linear_multiply(0.15)
                                                } else {
                                                    theme::hover_bg()
                                                };

                                                let inner_rect = item_rect.shrink2(egui::vec2(8.0, 2.0));
                                                ui.painter().rect_filled(
                                                    inner_rect,
                                                    CornerRadius::same(8),
                                                    bg,
                                                );
                                            }

                                            let content_rect = item_rect.shrink2(egui::vec2(16.0, 0.0));

                                            // Icon
                                            if let Some(icon) = &cmd.icon {
                                                ui.painter().text(
                                                    egui::pos2(content_rect.min.x, content_rect.center().y),
                                                    egui::Align2::LEFT_CENTER,
                                                    icon,
                                                    theme::font_body(),
                                                    if is_selected {
                                                        theme::ACCENT
                                                    } else {
                                                        theme::text_secondary()
                                                    },
                                                );
                                            }

                                            let text_x = content_rect.min.x + if cmd.icon.is_some() { 32.0 } else { 0.0 };

                                            // Label
                                            ui.painter().text(
                                                egui::pos2(text_x, content_rect.center().y - 8.0),
                                                egui::Align2::LEFT_CENTER,
                                                &cmd.label,
                                                theme::font_body(),
                                                if is_selected {
                                                    theme::ACCENT
                                                } else {
                                                    theme::text_primary()
                                                },
                                            );

                                            // Description
                                            if let Some(desc) = &cmd.description {
                                                ui.painter().text(
                                                    egui::pos2(text_x, content_rect.center().y + 8.0),
                                                    egui::Align2::LEFT_CENTER,
                                                    desc,
                                                    theme::font_small(),
                                                    theme::text_tertiary(),
                                                );
                                            }

                                            // Shortcut
                                            if let Some(shortcut) = &cmd.shortcut {
                                                let shortcut_galley = ui.painter().layout_no_wrap(
                                                    shortcut.clone(),
                                                    theme::font_label(),
                                                    theme::text_tertiary(),
                                                );
                                                let shortcut_rect = egui::Rect::from_min_size(
                                                    egui::pos2(
                                                        content_rect.max.x - shortcut_galley.size().x - 8.0,
                                                        content_rect.center().y - 10.0,
                                                    ),
                                                    shortcut_galley.size() + egui::vec2(8.0, 4.0),
                                                );
                                                ui.painter().rect_filled(
                                                    shortcut_rect,
                                                    CornerRadius::same(4),
                                                    theme::bg_tertiary(),
                                                );
                                                ui.painter().galley(
                                                    shortcut_rect.min + egui::vec2(4.0, 2.0),
                                                    shortcut_galley,
                                                    theme::text_tertiary(),
                                                );
                                            }
                                        }

                                        if item_response.clicked() {
                                            result = Some(cmd.id.clone());
                                            state.close();
                                        }

                                        if item_response.hovered() {
                                            state.selected_index = i;
                                        }
                                    }

                                    ui.add_space(8.0);
                                });
                        } else {
                            // No results
                            egui::Frame::new()
                                .inner_margin(egui::Margin::same(32))
                                .show(ui, |ui| {
                                    ui.vertical_centered(|ui| {
                                        ui.label(
                                            egui::RichText::new("Aucun résultat")
                                                .font(theme::font_body())
                                                .color(theme::text_tertiary()),
                                        );
                                    });
                                });
                        }

                        // Footer with hints
                        ui.painter().line_segment(
                            [
                                egui::pos2(ui.min_rect().min.x, ui.min_rect().max.y),
                                egui::pos2(ui.min_rect().min.x + palette_width, ui.min_rect().max.y),
                            ],
                            egui::Stroke::new(1.0, theme::border()),
                        );

                        egui::Frame::new()
                            .inner_margin(egui::Margin::same(12))
                            .show(ui, |ui| {
                                ui.horizontal(|ui| {
                                    // Navigation hint
                                    ui.label(
                                        egui::RichText::new("↑↓")
                                            .font(theme::font_label())
                                            .color(theme::text_tertiary()),
                                    );
                                    ui.label(
                                        egui::RichText::new("naviguer")
                                            .font(theme::font_small())
                                            .color(theme::text_tertiary()),
                                    );

                                    ui.add_space(16.0);

                                    // Select hint
                                    ui.label(
                                        egui::RichText::new("↵")
                                            .font(theme::font_label())
                                            .color(theme::text_tertiary()),
                                    );
                                    ui.label(
                                        egui::RichText::new("sélectionner")
                                            .font(theme::font_small())
                                            .color(theme::text_tertiary()),
                                    );

                                    ui.add_space(16.0);

                                    // Close hint
                                    ui.label(
                                        egui::RichText::new("esc")
                                            .font(theme::font_label())
                                            .color(theme::text_tertiary()),
                                    );
                                    ui.label(
                                        egui::RichText::new("fermer")
                                            .font(theme::font_small())
                                            .color(theme::text_tertiary()),
                                    );
                                });
                            });
                    });
            });

        result
    }
}

/// Check if command palette shortcut (Cmd/Ctrl+K) is pressed.
pub fn check_palette_shortcut(ctx: &egui::Context) -> bool {
    ctx.input(|i| {
        i.key_pressed(Key::K) && i.modifiers.command
    })
}
