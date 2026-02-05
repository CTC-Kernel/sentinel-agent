//! Responsive layout helpers for fluid grids and wrapping.

use egui::Ui;

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
            gap: 16.0,
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
        let (cols, item_width) = self.calculate(ui);

        if cols == 1 {
            // Stack vertically
            ui.vertical(|ui: &mut egui::Ui| {
                ui.spacing_mut().item_spacing.y = self.gap;
                for item in items {
                    render_fn(ui, item_width, item);
                }
            });
        } else {
            // Use rows
            ui.vertical(|ui: &mut egui::Ui| {
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
}
