//! Pagination widget for navigating through pages of data.

use crate::icons;
use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Pagination style variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum PaginationStyle {
    #[default]
    Default,
    Minimal,
    Compact,
}

/// Pagination state.
#[derive(Debug, Clone)]
pub struct PaginationState {
    pub current_page: usize,
    pub total_pages: usize,
    pub items_per_page: usize,
    pub total_items: usize,
}

impl PaginationState {
    /// Create a new pagination state.
    pub fn new(total_items: usize, items_per_page: usize) -> Self {
        let total_pages = total_items.div_ceil(items_per_page);
        Self {
            current_page: 1,
            total_pages: total_pages.max(1),
            items_per_page,
            total_items,
        }
    }

    /// Get the start index for the current page (0-based).
    pub fn start_index(&self) -> usize {
        (self.current_page - 1) * self.items_per_page
    }

    /// Get the end index for the current page (exclusive, 0-based).
    pub fn end_index(&self) -> usize {
        (self.start_index() + self.items_per_page).min(self.total_items)
    }

    /// Check if there's a previous page.
    pub fn has_prev(&self) -> bool {
        self.current_page > 1
    }

    /// Check if there's a next page.
    pub fn has_next(&self) -> bool {
        self.current_page < self.total_pages
    }

    /// Go to the previous page.
    pub fn prev(&mut self) {
        if self.has_prev() {
            self.current_page -= 1;
        }
    }

    /// Go to the next page.
    pub fn next(&mut self) {
        if self.has_next() {
            self.current_page += 1;
        }
    }

    /// Go to a specific page.
    pub fn go_to(&mut self, page: usize) {
        self.current_page = page.clamp(1, self.total_pages);
    }

    /// Update total items (recalculates total pages).
    pub fn set_total_items(&mut self, total: usize) {
        self.total_items = total;
        self.total_pages = total.div_ceil(self.items_per_page);
        self.total_pages = self.total_pages.max(1);
        self.current_page = self.current_page.clamp(1, self.total_pages);
    }
}

/// Pagination widget.
pub struct Pagination {
    style: PaginationStyle,
    show_info: bool,
    show_first_last: bool,
    max_visible_pages: usize,
}

impl Default for Pagination {
    fn default() -> Self {
        Self::new()
    }
}

impl Pagination {
    /// Create a new pagination widget.
    pub fn new() -> Self {
        Self {
            style: PaginationStyle::Default,
            show_info: true,
            show_first_last: true,
            max_visible_pages: 7,
        }
    }

    /// Set the pagination style.
    pub fn style(mut self, style: PaginationStyle) -> Self {
        self.style = style;
        self
    }

    /// Hide the info text (showing X-Y of Z).
    pub fn hide_info(mut self) -> Self {
        self.show_info = false;
        self
    }

    /// Hide first/last page buttons.
    pub fn hide_first_last(mut self) -> Self {
        self.show_first_last = false;
        self
    }

    /// Set max visible page numbers.
    pub fn max_visible(mut self, max: usize) -> Self {
        self.max_visible_pages = max.max(5);
        self
    }

    /// Show the pagination. Returns true if page changed.
    pub fn show(self, ui: &mut Ui, state: &mut PaginationState) -> bool {
        match self.style {
            PaginationStyle::Default => self.show_default(ui, state),
            PaginationStyle::Minimal => self.show_minimal(ui, state),
            PaginationStyle::Compact => self.show_compact(ui, state),
        }
    }

    fn show_default(&self, ui: &mut Ui, state: &mut PaginationState) -> bool {
        let mut changed = false;

        ui.horizontal(|ui| {
            // Info text
            if self.show_info && state.total_items > 0 {
                let start = state.start_index() + 1;
                let end = state.end_index();
                ui.label(
                    egui::RichText::new(format!("{}-{} sur {}", start, end, state.total_items))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                );
                ui.add_space(16.0);
            }

            // First page button
            if self.show_first_last
                && self.nav_button(ui, icons::CHEVRON_LEFT, true, state.current_page > 1)
            {
                state.go_to(1);
                changed = true;
            }

            // Previous button
            if self.nav_button(ui, icons::CHEVRON_LEFT, false, state.has_prev()) {
                state.prev();
                changed = true;
            }

            ui.add_space(4.0);

            // Page numbers
            let visible_pages = self.calculate_visible_pages(state);
            for (i, page) in visible_pages.iter().enumerate() {
                match page {
                    Some(p) => {
                        let is_current = *p == state.current_page;
                        if self.page_button(ui, *p, is_current) && !is_current {
                            state.go_to(*p);
                            changed = true;
                        }
                    }
                    None => {
                        // Ellipsis
                        ui.label(
                            egui::RichText::new("...")
                                .font(theme::font_body())
                                .color(theme::text_tertiary()),
                        );
                    }
                }

                if i < visible_pages.len() - 1 {
                    ui.add_space(2.0);
                }
            }

            ui.add_space(4.0);

            // Next button
            if self.nav_button(ui, icons::CHEVRON_RIGHT, false, state.has_next()) {
                state.next();
                changed = true;
            }

            // Last page button
            if self.show_first_last
                && self.nav_button(
                    ui,
                    icons::CHEVRON_RIGHT,
                    true,
                    state.current_page < state.total_pages,
                )
            {
                state.go_to(state.total_pages);
                changed = true;
            }
        });

        changed
    }

    fn show_minimal(&self, ui: &mut Ui, state: &mut PaginationState) -> bool {
        let mut changed = false;

        ui.horizontal(|ui| {
            // Previous
            if self.nav_button(ui, icons::CHEVRON_LEFT, false, state.has_prev()) {
                state.prev();
                changed = true;
            }

            // Current / Total
            ui.label(
                egui::RichText::new(format!("{} / {}", state.current_page, state.total_pages))
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );

            // Next
            if self.nav_button(ui, icons::CHEVRON_RIGHT, false, state.has_next()) {
                state.next();
                changed = true;
            }
        });

        changed
    }

    fn show_compact(&self, ui: &mut Ui, state: &mut PaginationState) -> bool {
        let mut changed = false;

        ui.horizontal(|ui| {
            // Previous
            let prev_enabled = state.has_prev();
            let (prev_rect, prev_response) =
                ui.allocate_exact_size(egui::vec2(32.0, 32.0), Sense::click());

            if ui.is_rect_visible(prev_rect) {
                let color = if prev_enabled {
                    if prev_response.hovered() {
                        theme::ACCENT
                    } else {
                        theme::text_secondary()
                    }
                } else {
                    theme::text_tertiary()
                };

                ui.painter().text(
                    prev_rect.center(),
                    egui::Align2::CENTER_CENTER,
                    icons::CHEVRON_LEFT,
                    theme::font_body(),
                    color,
                );
            }

            if prev_response.clicked() && prev_enabled {
                state.prev();
                changed = true;
            }

            // Page indicator (dots)
            for p in 1..=state.total_pages.min(5) {
                let is_current = p == state.current_page || (state.current_page > 5 && p == 5);
                let size = if is_current { 8.0 } else { 6.0 };
                let color = if is_current {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                };

                let (dot_rect, _) = ui.allocate_exact_size(egui::vec2(12.0, 12.0), Sense::hover());

                if ui.is_rect_visible(dot_rect) {
                    ui.painter()
                        .circle_filled(dot_rect.center(), size / 2.0, color);
                }
            }

            // Next
            let next_enabled = state.has_next();
            let (next_rect, next_response) =
                ui.allocate_exact_size(egui::vec2(32.0, 32.0), Sense::click());

            if ui.is_rect_visible(next_rect) {
                let color = if next_enabled {
                    if next_response.hovered() {
                        theme::ACCENT
                    } else {
                        theme::text_secondary()
                    }
                } else {
                    theme::text_tertiary()
                };

                ui.painter().text(
                    next_rect.center(),
                    egui::Align2::CENTER_CENTER,
                    icons::CHEVRON_RIGHT,
                    theme::font_body(),
                    color,
                );
            }

            if next_response.clicked() && next_enabled {
                state.next();
                changed = true;
            }
        });

        changed
    }

    fn nav_button(&self, ui: &mut Ui, icon: &str, double: bool, enabled: bool) -> bool {
        let size = 32.0;
        let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

        if ui.is_rect_visible(rect) {
            let is_hovered = response.hovered() && enabled;

            // Background
            if is_hovered {
                ui.painter()
                    .rect_filled(rect, CornerRadius::same(6), theme::hover_bg());
            }

            // Icon
            let color = if enabled {
                if is_hovered {
                    theme::ACCENT
                } else {
                    theme::text_secondary()
                }
            } else {
                theme::text_tertiary()
            };

            let icon_text = if double {
                format!("{}{}", icon, icon)
            } else {
                icon.to_string()
            };

            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                &icon_text,
                theme::font_small(),
                color,
            );
        }

        response.clicked() && enabled
    }

    fn page_button(&self, ui: &mut Ui, page: usize, is_current: bool) -> bool {
        let size = 32.0;
        let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

        if ui.is_rect_visible(rect) {
            let is_hovered = response.hovered();

            // Background
            let bg = if is_current {
                theme::ACCENT
            } else if is_hovered {
                theme::hover_bg()
            } else {
                Color32::TRANSPARENT
            };

            if bg != Color32::TRANSPARENT {
                ui.painter().rect_filled(rect, CornerRadius::same(6), bg);
            }

            // Text
            let color = if is_current {
                Color32::WHITE
            } else if is_hovered {
                theme::text_primary()
            } else {
                theme::text_secondary()
            };

            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                page.to_string(),
                theme::font_body(),
                color,
            );
        }

        response.clicked()
    }

    fn calculate_visible_pages(&self, state: &PaginationState) -> Vec<Option<usize>> {
        let total = state.total_pages;
        let current = state.current_page;
        let max = self.max_visible_pages;

        if total <= max {
            // Show all pages
            return (1..=total).map(Some).collect();
        }

        let mut pages = Vec::new();

        // Always show first page
        pages.push(Some(1));

        let half = (max - 2) / 2;

        if current <= half + 2 {
            // Near start
            for p in 2..=max - 2 {
                pages.push(Some(p));
            }
            pages.push(None); // Ellipsis
        } else if current >= total - half - 1 {
            // Near end
            pages.push(None); // Ellipsis
            for p in (total - max + 3)..total {
                pages.push(Some(p));
            }
        } else {
            // Middle
            pages.push(None); // Ellipsis
            for p in (current - half + 1)..=(current + half - 1) {
                pages.push(Some(p));
            }
            pages.push(None); // Ellipsis
        }

        // Always show last page
        pages.push(Some(total));

        pages
    }
}

/// Simple pagination widget.
pub fn pagination(ui: &mut Ui, state: &mut PaginationState) -> bool {
    Pagination::new().show(ui, state)
}

/// Minimal pagination (prev/next only with counter).
pub fn pagination_minimal(ui: &mut Ui, state: &mut PaginationState) -> bool {
    Pagination::new()
        .style(PaginationStyle::Minimal)
        .show(ui, state)
}

/// Compact pagination with dots.
pub fn pagination_compact(ui: &mut Ui, state: &mut PaginationState) -> bool {
    Pagination::new()
        .style(PaginationStyle::Compact)
        .show(ui, state)
}
