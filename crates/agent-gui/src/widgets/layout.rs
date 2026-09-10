// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Responsive layout helpers for fluid grids and wrapping.

use egui::Ui;

use crate::theme;

/// Helper to create a responsive grid that adapts the number of columns
/// based on available width and a minimum item size.
pub struct ResponsiveGrid {
    pub min_item_width: f32,
    pub gap: f32,
}

impl Default for ResponsiveGrid {
    fn default() -> Self {
        Self {
            min_item_width: 300.0,
            gap: theme::SPACE,
        }
    }
}

impl ResponsiveGrid {
    /// Create a new grid with custom parameters.
    pub fn new(min_item_width: f32, gap: f32) -> Self {
        Self {
            min_item_width,
            gap,
        }
    }

    /// Calculate the optimal number of columns and the actual item width.
    pub fn calculate(&self, ui: &Ui) -> (usize, f32) {
        // Subtract a small buffer for scrollbars to prevent horizontal overflow
        let total_width = (ui.available_width() - 12.0).max(0.0);

        // Calculate max columns that can fit
        let mut cols =
            ((total_width + self.gap) / (self.min_item_width + self.gap)).floor() as usize;
        cols = cols.max(1);

        // Calculate item width based on actual columns
        let item_width = (total_width - (self.gap * (cols - 1) as f32)) / cols as f32;

        (cols, item_width)
    }

    /// Columns for `count` items, and the width each gets.
    ///
    /// Never an empty column: two cards on a wide display share the row
    /// instead of sitting at minimum width beside 600px of nothing. And never
    /// a lone orphan on the last row when one column fewer balances the rows:
    /// four stat cards at three columns become two by two, not three and one.
    pub fn columns_for(&self, ui: &Ui, count: usize) -> (usize, f32) {
        let (max_cols, _) = self.calculate(ui);
        let mut cols = max_cols.min(count.max(1));
        if count > cols {
            // Same number of rows, fullest last row: 7 cards at 5 columns
            // become 4 + 3, 8 become 4 + 4, 4 at 3 become 2 + 2.
            let rows = count.div_ceil(cols);
            let fullness = |c: usize| (count - (rows - 1) * c) as f32 / c as f32;
            cols = (max_cols.saturating_sub(2).max(2)..=cols)
                .filter(|&c| count.div_ceil(c) == rows)
                .max_by(|&a, &b| {
                    fullness(a)
                        .partial_cmp(&fullness(b))
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then(a.cmp(&b))
                })
                .unwrap_or(cols);
        }
        let total = (ui.available_width() - 12.0).max(0.0);
        (cols, (total - self.gap * (cols - 1) as f32) / cols as f32)
    }

    /// Render items in a responsive grid.
    ///
    /// # Arguments
    /// * `ui` - The egui UI context.
    /// * `items` - A slice of data items.
    /// * `render_fn` - A closure that renders a single item.
    pub fn show<T, F>(&self, ui: &mut Ui, items: &[T], mut render_fn: F)
    where
        F: FnMut(&mut Ui, f32, &T),
    {
        let (cols, item_width) = self.columns_for(ui, items.len());

        ui.vertical_centered_justified(|ui: &mut egui::Ui| {
            ui.spacing_mut().item_spacing.y = self.gap;

            for row_chunk in items.chunks(cols) {
                ui.horizontal_top(|ui: &mut egui::Ui| {
                    ui.spacing_mut().item_spacing.x = self.gap;
                    for item in row_chunk {
                        render_fn(ui, item_width, item);
                    }
                });
            }
        });
    }
}
