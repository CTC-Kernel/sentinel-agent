//! Data table widget for displaying tabular data.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Sort direction for table columns.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum SortDirection {
    #[default]
    None,
    Ascending,
    Descending,
}

impl SortDirection {
    fn icon(&self) -> Option<&'static str> {
        match self {
            SortDirection::None => None,
            SortDirection::Ascending => Some(icons::CHEVRON_UP),
            SortDirection::Descending => Some(icons::CHEVRON_DOWN),
        }
    }

    fn toggle(&self) -> Self {
        match self {
            SortDirection::None => SortDirection::Ascending,
            SortDirection::Ascending => SortDirection::Descending,
            SortDirection::Descending => SortDirection::None,
        }
    }
}

/// Table column definition.
#[derive(Debug, Clone)]
pub struct TableColumn<'a> {
    pub key: &'a str,
    pub label: &'a str,
    pub width: ColumnWidth,
    pub sortable: bool,
    pub align: ColumnAlign,
}

/// Column width specification.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ColumnWidth {
    /// Fixed pixel width.
    Fixed(f32),
    /// Percentage of available width.
    Percent(f32),
    /// Auto-size based on content.
    Auto,
    /// Fill remaining space.
    Fill,
}

/// Column text alignment.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ColumnAlign {
    #[default]
    Left,
    Center,
    Right,
}

impl<'a> TableColumn<'a> {
    /// Create a new table column.
    pub fn new(key: &'a str, label: &'a str) -> Self {
        Self {
            key,
            label,
            width: ColumnWidth::Auto,
            sortable: false,
            align: ColumnAlign::Left,
        }
    }

    /// Set the column width.
    pub fn width(mut self, width: ColumnWidth) -> Self {
        self.width = width;
        self
    }

    /// Make the column sortable.
    pub fn sortable(mut self) -> Self {
        self.sortable = true;
        self
    }

    /// Set the column alignment.
    pub fn align(mut self, align: ColumnAlign) -> Self {
        self.align = align;
        self
    }
}

/// Table sort state.
#[derive(Debug, Clone, Default)]
pub struct TableSort {
    pub column: Option<String>,
    pub direction: SortDirection,
}

impl TableSort {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn by(column: &str, direction: SortDirection) -> Self {
        Self {
            column: Some(column.to_string()),
            direction,
        }
    }
}

/// Data table widget.
pub struct DataTable<'a> {
    #[allow(dead_code)]
    id: egui::Id,
    columns: Vec<TableColumn<'a>>,
    row_height: f32,
    header_height: f32,
    striped: bool,
    hoverable: bool,
    selectable: bool,
    bordered: bool,
}

impl<'a> DataTable<'a> {
    /// Create a new data table.
    pub fn new(id: impl std::hash::Hash, columns: Vec<TableColumn<'a>>) -> Self {
        Self {
            id: egui::Id::new(id),
            columns,
            row_height: 48.0,
            header_height: 44.0,
            striped: true,
            hoverable: true,
            selectable: false,
            bordered: false,
        }
    }

    /// Set the row height.
    pub fn row_height(mut self, height: f32) -> Self {
        self.row_height = height;
        self
    }

    /// Disable striped rows.
    pub fn no_stripes(mut self) -> Self {
        self.striped = false;
        self
    }

    /// Enable row selection.
    pub fn selectable(mut self) -> Self {
        self.selectable = true;
        self
    }

    /// Add borders between cells.
    pub fn bordered(mut self) -> Self {
        self.bordered = true;
        self
    }

    /// Calculate column widths based on available space.
    fn calculate_widths(&self, available_width: f32) -> Vec<f32> {
        let mut widths: Vec<f32> = vec![0.0; self.columns.len()];
        let mut remaining = available_width;
        let mut fill_count = 0;
        let mut auto_indices = Vec::new();

        // First pass: calculate fixed and percent widths
        for (i, col) in self.columns.iter().enumerate() {
            match col.width {
                ColumnWidth::Fixed(w) => {
                    widths[i] = w;
                    remaining -= w;
                }
                ColumnWidth::Percent(p) => {
                    let w = available_width * (p / 100.0);
                    widths[i] = w;
                    remaining -= w;
                }
                ColumnWidth::Auto => {
                    auto_indices.push(i);
                }
                ColumnWidth::Fill => {
                    fill_count += 1;
                }
            }
        }

        // Second pass: distribute remaining space
        let auto_width = if !auto_indices.is_empty() {
            let auto_total = remaining * 0.6; // Auto columns get 60% of remaining
            remaining -= auto_total;
            auto_total / auto_indices.len() as f32
        } else {
            0.0
        };

        for i in auto_indices {
            widths[i] = auto_width.max(60.0); // Minimum 60px for auto columns
        }

        let fill_width = if fill_count > 0 {
            remaining.max(0.0) / fill_count as f32
        } else {
            0.0
        };

        for (i, col) in self.columns.iter().enumerate() {
            if matches!(col.width, ColumnWidth::Fill) {
                widths[i] = fill_width.max(60.0);
            }
        }

        widths
    }

    /// Show the table header.
    pub fn show_header(&self, ui: &mut Ui, sort: &mut TableSort) -> bool {
        let mut sort_changed = false;
        let available_width = ui.available_width();
        let widths = self.calculate_widths(available_width);

        // Header background
        let header_rect = ui.allocate_space(egui::vec2(available_width, self.header_height)).1;

        if ui.is_rect_visible(header_rect) {
            ui.painter().rect_filled(
                header_rect,
                CornerRadius {
                    nw: 8,
                    ne: 8,
                    ..Default::default()
                },
                theme::bg_tertiary(),
            );
        }

        // Draw header cells
        ui.allocate_new_ui(egui::UiBuilder::new().max_rect(header_rect), |ui| {
            ui.horizontal(|ui| {
                for (i, col) in self.columns.iter().enumerate() {
                    let width = widths[i];
                    let is_sorted = sort.column.as_deref() == Some(col.key);

                    let sense = if col.sortable {
                        Sense::click()
                    } else {
                        Sense::hover()
                    };

                    let (cell_rect, response) =
                        ui.allocate_exact_size(egui::vec2(width, self.header_height), sense);

                    if ui.is_rect_visible(cell_rect) {
                        let is_hovered = response.hovered() && col.sortable;

                        // Hover effect
                        if is_hovered {
                            ui.painter().rect_filled(
                                cell_rect,
                                0,
                                theme::hover_bg().linear_multiply(0.5),
                            );
                        }

                        // Label
                        let text_color = if is_sorted {
                            theme::ACCENT
                        } else {
                            theme::text_secondary()
                        };

                        let align = match col.align {
                            ColumnAlign::Left => egui::Align2::LEFT_CENTER,
                            ColumnAlign::Center => egui::Align2::CENTER_CENTER,
                            ColumnAlign::Right => egui::Align2::RIGHT_CENTER,
                        };

                        let text_x = match col.align {
                            ColumnAlign::Left => cell_rect.min.x + 12.0,
                            ColumnAlign::Center => cell_rect.center().x,
                            ColumnAlign::Right => cell_rect.max.x - 12.0,
                        };

                        ui.painter().text(
                            egui::pos2(text_x, cell_rect.center().y),
                            align,
                            col.label,
                            theme::font_small(),
                            text_color,
                        );

                        // Sort indicator
                        if col.sortable {
                            let sort_icon = if is_sorted {
                                sort.direction.icon()
                            } else if is_hovered {
                                Some(icons::CHEVRON_UP)
                            } else {
                                None
                            };

                            if let Some(icon) = sort_icon {
                                let icon_alpha = if is_sorted { 1.0 } else { 0.5 };
                                ui.painter().text(
                                    egui::pos2(cell_rect.max.x - 20.0, cell_rect.center().y),
                                    egui::Align2::CENTER_CENTER,
                                    icon,
                                    theme::font_label(),
                                    text_color.linear_multiply(icon_alpha),
                                );
                            }
                        }

                        // Border
                        if self.bordered && i < self.columns.len() - 1 {
                            ui.painter().line_segment(
                                [
                                    egui::pos2(cell_rect.max.x, cell_rect.min.y + 8.0),
                                    egui::pos2(cell_rect.max.x, cell_rect.max.y - 8.0),
                                ],
                                egui::Stroke::new(1.0, theme::border()),
                            );
                        }
                    }

                    // Handle sort click
                    if response.clicked() && col.sortable {
                        if is_sorted {
                            sort.direction = sort.direction.toggle();
                            if sort.direction == SortDirection::None {
                                sort.column = None;
                            }
                        } else {
                            sort.column = Some(col.key.to_string());
                            sort.direction = SortDirection::Ascending;
                        }
                        sort_changed = true;
                    }
                }
            });
        });

        sort_changed
    }

    /// Show a table row. Returns true if clicked.
    pub fn show_row(
        &self,
        ui: &mut Ui,
        row_index: usize,
        selected: bool,
        cells: &[&str],
    ) -> bool {
        let available_width = ui.available_width();
        let widths = self.calculate_widths(available_width);

        let sense = if self.selectable {
            Sense::click()
        } else {
            Sense::hover()
        };

        let (row_rect, response) =
            ui.allocate_exact_size(egui::vec2(available_width, self.row_height), sense);

        let mut clicked = false;

        if ui.is_rect_visible(row_rect) {
            let is_hovered = response.hovered();
            let is_odd = row_index % 2 == 1;

            // Background
            let bg_color = if selected {
                theme::selected_bg()
            } else if is_hovered && self.hoverable {
                theme::hover_bg()
            } else if self.striped && is_odd {
                theme::bg_tertiary().linear_multiply(0.5)
            } else {
                Color32::TRANSPARENT
            };

            if bg_color != Color32::TRANSPARENT {
                ui.painter().rect_filled(row_rect, 0, bg_color);
            }

            // Draw cells
            let mut x = row_rect.min.x;
            for (i, col) in self.columns.iter().enumerate() {
                let width = widths[i];
                let cell_rect = egui::Rect::from_min_size(
                    egui::pos2(x, row_rect.min.y),
                    egui::vec2(width, self.row_height),
                );

                // Cell content
                let text = cells.get(i).copied().unwrap_or("");
                let text_color = theme::text_primary();

                let align = match col.align {
                    ColumnAlign::Left => egui::Align2::LEFT_CENTER,
                    ColumnAlign::Center => egui::Align2::CENTER_CENTER,
                    ColumnAlign::Right => egui::Align2::RIGHT_CENTER,
                };

                let text_x = match col.align {
                    ColumnAlign::Left => cell_rect.min.x + 12.0,
                    ColumnAlign::Center => cell_rect.center().x,
                    ColumnAlign::Right => cell_rect.max.x - 12.0,
                };

                ui.painter().text(
                    egui::pos2(text_x, cell_rect.center().y),
                    align,
                    text,
                    theme::font_body(),
                    text_color,
                );

                // Border
                if self.bordered && i < self.columns.len() - 1 {
                    ui.painter().line_segment(
                        [
                            egui::pos2(cell_rect.max.x, cell_rect.min.y),
                            egui::pos2(cell_rect.max.x, cell_rect.max.y),
                        ],
                        egui::Stroke::new(1.0, theme::border().linear_multiply(0.5)),
                    );
                }

                x += width;
            }

            // Bottom border
            ui.painter().line_segment(
                [
                    egui::pos2(row_rect.min.x, row_rect.max.y),
                    egui::pos2(row_rect.max.x, row_rect.max.y),
                ],
                egui::Stroke::new(0.5, theme::border().linear_multiply(0.5)),
            );
        }

        if response.clicked() {
            clicked = true;
        }

        clicked
    }

    /// Show an empty state when no data.
    pub fn show_empty(&self, ui: &mut Ui, message: &str) {
        let available_width = ui.available_width();
        let height = 120.0;

        let (rect, _) = ui.allocate_exact_size(egui::vec2(available_width, height), Sense::hover());

        if ui.is_rect_visible(rect) {
            ui.painter().rect_filled(
                rect,
                CornerRadius {
                    sw: 8,
                    se: 8,
                    ..Default::default()
                },
                theme::bg_secondary(),
            );

            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                message,
                theme::font_body(),
                theme::text_tertiary(),
            );
        }
    }
}

/// Helper struct for building table rows with typed data.
pub struct TableRow<'a, T> {
    data: &'a T,
    cells: Vec<String>,
}

impl<'a, T> TableRow<'a, T> {
    pub fn new(data: &'a T) -> Self {
        Self {
            data,
            cells: Vec::new(),
        }
    }

    pub fn cell(mut self, value: impl ToString) -> Self {
        self.cells.push(value.to_string());
        self
    }

    pub fn cells(&self) -> Vec<&str> {
        self.cells.iter().map(|s| s.as_str()).collect()
    }

    pub fn data(&self) -> &'a T {
        self.data
    }
}

/// Simple table from string data.
pub fn simple_table(
    ui: &mut Ui,
    headers: &[&str],
    rows: &[Vec<&str>],
    sort: &mut TableSort,
) -> Option<usize> {
    let columns: Vec<TableColumn> = headers
        .iter()
        .map(|h| TableColumn::new(h, h).sortable().width(ColumnWidth::Fill))
        .collect();

    let table = DataTable::new("simple_table", columns);

    table.show_header(ui, sort);

    let mut clicked_row = None;
    for (i, row) in rows.iter().enumerate() {
        let cells: Vec<&str> = row.to_vec();
        if table.show_row(ui, i, false, &cells) {
            clicked_row = Some(i);
        }
    }

    if rows.is_empty() {
        table.show_empty(ui, "Aucune donnée");
    }

    clicked_row
}
