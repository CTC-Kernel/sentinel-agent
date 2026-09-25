// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
            row_height: theme::TABLE_DATA_ROW_HEIGHT,
            header_height: theme::TABLE_HEADER_HEIGHT,
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

    /// Disable hover highlight (for read-only informational tables).
    pub fn no_hover(mut self) -> Self {
        self.hoverable = false;
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

        // Clamp to avoid negative distribution when fixed/percent columns exceed space
        remaining = remaining.max(0.0);

        // Second pass: distribute remaining space
        let auto_width = if !auto_indices.is_empty() {
            let auto_total = remaining * if fill_count > 0 { 0.6 } else { 1.0 };
            remaining -= auto_total;
            auto_total / auto_indices.len() as f32
        } else {
            0.0
        };

        for i in auto_indices {
            widths[i] = auto_width.max(60.0); // Minimum 60px for auto columns
        }

        let fill_width = if fill_count > 0 {
            remaining / fill_count as f32
        } else {
            0.0
        };

        for (i, col) in self.columns.iter().enumerate() {
            if matches!(col.width, ColumnWidth::Fill) {
                widths[i] = fill_width.max(60.0);
            }
        }

        // Keep every column inside the table at narrow viewport widths.
        let total: f32 = widths.iter().sum();
        if total > available_width && total > 0.0 {
            let scale = available_width.max(0.0) / total;
            for width in &mut widths {
                *width *= scale;
            }
        }
        widths
    }

    /// Show the table header.
    pub fn show_header(&self, ui: &mut Ui, sort: &mut TableSort) -> bool {
        let table_id = ui.make_persistent_id(self.id);
        let mut sort_changed = false;
        let available_width = ui.available_width();
        let widths = self.calculate_widths(available_width);

        // Header background
        let header_rect = ui
            .allocate_space(egui::vec2(available_width, self.header_height))
            .1;

        if ui.is_rect_visible(header_rect) {
            ui.painter().rect_filled(
                header_rect,
                CornerRadius {
                    nw: theme::ROUNDING_MD,
                    ne: theme::ROUNDING_MD,
                    ..Default::default()
                },
                theme::bg_tertiary(),
            );
            // A neutral seam separates header from body. The previous accent
            // line drew the eye to the chrome rather than to the data.
            ui.painter().line_segment(
                [
                    egui::pos2(header_rect.min.x, header_rect.max.y - 0.5),
                    egui::pos2(header_rect.max.x, header_rect.max.y - 0.5),
                ],
                egui::Stroke::new(theme::BORDER_THIN, theme::border_subtle()),
            );
        }

        // Draw header cells
        ui.allocate_new_ui(egui::UiBuilder::new().max_rect(header_rect), |ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            ui.horizontal(|ui| {
                for (i, col) in self.columns.iter().enumerate() {
                    let width = widths[i];
                    let is_sorted = sort.column.as_deref() == Some(col.key);

                    let sense = if col.sortable {
                        Sense::click().union(Sense::hover())
                    } else {
                        Sense::hover()
                    };

                    let (_, cell_rect) = ui.allocate_space(egui::vec2(width, self.header_height));
                    let response =
                        ui.interact(cell_rect, table_id.with(("column", col.key)), sense);
                    if col.sortable {
                        response.widget_info(|| {
                            egui::WidgetInfo::labeled(
                                egui::WidgetType::Button,
                                ui.is_enabled(),
                                format!(
                                    "Trier par {} — {}",
                                    col.label,
                                    if is_sorted {
                                        match sort.direction {
                                            SortDirection::Ascending => "croissant",
                                            SortDirection::Descending => "décroissant",
                                            _ => "sans tri",
                                        }
                                    } else {
                                        "sans tri"
                                    }
                                ),
                            )
                        });
                    }

                    if ui.is_rect_visible(cell_rect) {
                        let is_focused = response.has_focus() && col.sortable;
                        let is_hovered = (response.hovered() || is_focused) && col.sortable;

                        // Hover/focus effect
                        let hover = crate::animation::animate_hover(
                            ui.ctx(),
                            response.id.with("header_hover"),
                            is_hovered,
                        );
                        let base = if is_sorted {
                            theme::selected_bg()
                        } else {
                            theme::bg_tertiary()
                        };
                        ui.painter().rect_filled(
                            cell_rect.shrink(2.0),
                            theme::ROUNDING_XS,
                            crate::animation::lerp_color(base, theme::hover_bg_neutral(), hover),
                        );

                        if is_sorted {
                            ui.painter().line_segment(
                                [
                                    egui::pos2(cell_rect.left() + theme::SPACE_MD, cell_rect.top()),
                                    egui::pos2(
                                        cell_rect.right() - theme::SPACE_MD,
                                        cell_rect.top(),
                                    ),
                                ],
                                egui::Stroke::new(theme::BORDER_MEDIUM, theme::accent_text()),
                            );
                        }

                        // Focus ring for keyboard navigation
                        if is_focused {
                            ui.painter().rect_stroke(
                                cell_rect.shrink(1.0),
                                egui::CornerRadius::same(theme::ROUNDING_XS),
                                theme::focus_ring(),
                                egui::StrokeKind::Inside,
                            );
                        }

                        // Label
                        let text_color = if is_sorted {
                            theme::accent_text()
                        } else {
                            theme::text_secondary()
                        };

                        // Header labels are clipped to their column, minus the
                        // room the sort indicator needs, so a long header can
                        // never bleed into its neighbour.
                        let reserved = if col.sortable { theme::ICON_MD } else { 0.0 };
                        paint_cell_text(
                            ui,
                            cell_rect,
                            col.align,
                            col.label,
                            theme::font_body_sm_medium(),
                            text_color,
                            reserved,
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
                                let icon_alpha = if is_sorted {
                                    1.0
                                } else {
                                    theme::OPACITY_PRESSED
                                };
                                ui.painter().text(
                                    egui::pos2(
                                        cell_rect.max.x - theme::SPACE_MD,
                                        cell_rect.center().y,
                                    ),
                                    egui::Align2::RIGHT_CENTER,
                                    icon,
                                    theme::font_icon(theme::ICON_XS),
                                    text_color.linear_multiply(icon_alpha),
                                );
                            }
                        }

                        // Border
                        if self.bordered && i < self.columns.len() - 1 {
                            ui.painter().line_segment(
                                [
                                    egui::pos2(cell_rect.max.x, cell_rect.min.y + theme::SPACE_SM),
                                    egui::pos2(cell_rect.max.x, cell_rect.max.y - theme::SPACE_SM),
                                ],
                                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                            );
                        }
                    }

                    if col.sortable && response.hovered() {
                        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                    }

                    // Handle sort click or keyboard activation (Enter/Space)
                    let keyboard_activate = response.has_focus()
                        && col.sortable
                        && ui.input(|i| {
                            i.key_pressed(egui::Key::Enter) || i.key_pressed(egui::Key::Space)
                        });
                    if (response.clicked() || keyboard_activate) && col.sortable {
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
    pub fn show_row(&self, ui: &mut Ui, row_index: usize, selected: bool, cells: &[&str]) -> bool {
        let available_width = ui.available_width();
        // Column widths are recalculated per row (acceptable in immediate-mode GUI)
        let widths = self.calculate_widths(available_width);

        let sense = if self.selectable {
            Sense::click()
        } else {
            Sense::hover()
        };

        let (row_rect, response) =
            ui.allocate_exact_size(egui::vec2(available_width, self.row_height), sense);
        if self.selectable {
            if response.gained_focus() {
                response.scroll_to_me(Some(egui::Align::Center));
            }
            response.widget_info(|| {
                egui::WidgetInfo::selected(
                    egui::WidgetType::SelectableLabel,
                    ui.is_enabled(),
                    selected,
                    cells.join(" · "),
                )
            });
        }

        let mut clicked = false;

        if ui.is_rect_visible(row_rect) {
            let is_hovered = response.hovered();
            let is_odd = row_index % 2 == 1;

            // Selection is accent-tinted; hover is neutral, so the two states
            // never read as the same thing at a glance.
            let resting = if self.striped && is_odd {
                theme::table_row_bg(row_index)
            } else {
                theme::bg_secondary()
            };
            let hover = crate::animation::animate_hover(
                ui.ctx(),
                response.id.with("row_hover"),
                is_hovered && self.hoverable,
            );
            let bg_color = if selected {
                theme::selected_bg()
            } else {
                crate::animation::lerp_color(resting, theme::hover_bg_neutral(), hover)
            };

            if bg_color != Color32::TRANSPARENT {
                ui.painter().rect_filled(row_rect, 0, bg_color);
            }
            if selected {
                ui.painter().rect_filled(
                    egui::Rect::from_min_size(
                        row_rect.left_top(),
                        egui::vec2(theme::ACCENT_BAR_WIDTH, row_rect.height()),
                    ),
                    0,
                    theme::accent_text(),
                );
            }

            // Rows remain individually scannable even when zebra striping is
            // disabled, and the inset avoids turning the table into a cage.
            ui.painter().line_segment(
                [
                    egui::pos2(row_rect.left() + theme::SPACE, row_rect.bottom() - 0.5),
                    egui::pos2(row_rect.right() - theme::SPACE, row_rect.bottom() - 0.5),
                ],
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            );

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

                paint_cell_text(
                    ui,
                    cell_rect,
                    col.align,
                    text,
                    theme::font_body(),
                    text_color,
                    0.0,
                );

                // Border
                if self.bordered && i < self.columns.len() - 1 {
                    ui.painter().line_segment(
                        [
                            egui::pos2(cell_rect.max.x, cell_rect.min.y),
                            egui::pos2(cell_rect.max.x, cell_rect.max.y),
                        ],
                        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
                    );
                }

                x += width;
            }

            // Row rule: a hairline, not the control-strength separator. Rows
            // are grouped by proximity, not fenced off from one another.
            ui.painter().line_segment(
                [
                    egui::pos2(row_rect.min.x, row_rect.max.y - 0.5),
                    egui::pos2(row_rect.max.x, row_rect.max.y - 0.5),
                ],
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            );

            // Focus ring for keyboard navigation (WCAG 2.4.7)
            if self.selectable && response.has_focus() {
                ui.painter().rect_stroke(
                    row_rect.shrink(1.0),
                    egui::CornerRadius::same(theme::ROUNDING_XS),
                    theme::focus_ring(),
                    egui::StrokeKind::Inside,
                );
            }
        }

        if self.selectable && response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        if response.clicked() {
            clicked = true;
        }

        clicked
    }

    /// Show an empty state when no data.
    pub fn show_empty(&self, ui: &mut Ui, message: &str) {
        let available_width = ui.available_width();
        let height = theme::TABLE_EMPTY_HEIGHT;

        let (rect, _) = ui.allocate_exact_size(egui::vec2(available_width, height), Sense::hover());

        if ui.is_rect_visible(rect) {
            ui.painter().rect_filled(
                rect,
                CornerRadius {
                    sw: theme::ROUNDING_MD,
                    se: theme::ROUNDING_MD,
                    ..Default::default()
                },
                theme::bg_tertiary(),
            );

            // Empty state icon
            ui.painter().text(
                egui::pos2(rect.center().x, rect.center().y - 12.0),
                egui::Align2::CENTER_CENTER,
                crate::icons::FOLDER_OPEN,
                theme::font_icon(theme::ICON_LG),
                theme::text_tertiary(),
            );
            ui.painter().text(
                egui::pos2(rect.center().x, rect.center().y + 14.0),
                egui::Align2::CENTER_CENTER,
                message,
                theme::font_body(),
                theme::text_tertiary(),
            );
        }
    }
}

/// Paint one cell's text, clipped to its column and truncated with an ellipsis.
///
/// Table cells hold hostnames, CVE ids and file paths — content whose length
/// the layout cannot predict. Without a clip rect a long value silently paints
/// across its neighbours, which is how a table stops being readable.
#[allow(clippy::too_many_arguments)]
fn paint_cell_text(
    ui: &Ui,
    cell: egui::Rect,
    align: ColumnAlign,
    text: &str,
    font: egui::FontId,
    color: Color32,
    reserved: f32,
) {
    let inner = egui::Rect::from_min_max(
        egui::pos2(cell.min.x + theme::SPACE_MD, cell.min.y),
        egui::pos2(cell.max.x - theme::SPACE_MD - reserved, cell.max.y),
    );
    if inner.width() <= 1.0 || text.is_empty() {
        return;
    }

    let painter = ui.painter();
    let mut galley = painter.layout_no_wrap(text.to_owned(), font.clone(), color);
    if galley.size().x > inner.width() {
        // The full text on hover, without registering a widget that would
        // take the hover away from the row underneath.
        if ui.rect_contains_pointer(inner) {
            egui::show_tooltip_at_pointer(
                ui.ctx(),
                ui.layer_id(),
                ui.id()
                    .with(("cell_tip", cell.min.x as i32, cell.min.y as i32)),
                |ui| {
                    ui.label(text);
                },
            );
        }
        // Truncate to what fits, leaving room for the ellipsis.
        let mut visible = text.to_owned();
        while !visible.is_empty() {
            visible.pop();
            let candidate = format!("{visible}\u{2026}");
            let trial = painter.layout_no_wrap(candidate.clone(), font.clone(), color);
            if trial.size().x <= inner.width() {
                galley = trial;
                break;
            }
        }
        if visible.is_empty() {
            return;
        }
    }

    let x = match align {
        ColumnAlign::Left => inner.min.x,
        ColumnAlign::Center => inner.center().x - galley.size().x / 2.0,
        ColumnAlign::Right => inner.max.x - galley.size().x,
    };
    painter.with_clip_rect(inner).galley(
        egui::pos2(x, cell.center().y - galley.size().y / 2.0),
        galley,
        color,
    );
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

    let table = DataTable::new("simple_table", columns).selectable();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorting_keeps_focus_when_content_is_inserted_before_the_table() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let table = DataTable::new(
            "focus_test",
            vec![TableColumn::new("host", "Équipement").sortable()],
        );
        let mut sort = TableSort::default();
        let mut target = None;
        for pass in 0..3 {
            let events = if pass == 2 {
                vec![egui::Event::Key {
                    key: egui::Key::Enter,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: egui::Modifiers::NONE,
                }]
            } else {
                vec![]
            };
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(500.0, 300.0),
                    )),
                    events,
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        if pass > 0 {
                            ui.label("Résultats actualisés");
                        }
                        let id = ui.make_persistent_id(table.id).with(("column", "host"));
                        target = Some(id);
                        table.show_header(ui, &mut sort);
                        if pass == 0 {
                            ui.memory_mut(|memory| memory.request_focus(id));
                        }
                    });
                },
            );
        }
        assert_eq!(sort.column.as_deref(), Some("host"));
        assert_eq!(sort.direction, SortDirection::Ascending);
        assert_eq!(ctx.memory(|memory| memory.focused()), target);
    }

    #[test]
    fn automatic_columns_use_the_full_table() {
        let table = DataTable::new(
            "auto",
            vec![TableColumn::new("a", "A"), TableColumn::new("b", "B")],
        );
        assert_eq!(table.calculate_widths(600.0), vec![300.0, 300.0]);
    }

    #[test]
    fn narrow_tables_keep_all_columns_within_their_bounds() {
        let table = DataTable::new(
            "narrow",
            vec![
                TableColumn::new("host", "Hôte").width(ColumnWidth::Fill),
                TableColumn::new("id", "Identifiant").width(ColumnWidth::Fixed(180.0)),
                TableColumn::new("status", "Statut").width(ColumnWidth::Percent(40.0)),
            ],
        );
        for width in [0.0, 160.0, 320.0, 640.0] {
            let columns = table.calculate_widths(width);
            assert!(
                columns
                    .iter()
                    .all(|value| value.is_finite() && *value >= 0.0)
            );
            assert!(columns.iter().sum::<f32>() <= width + 0.01);
        }
    }
}
