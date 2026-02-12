//! Breadcrumb navigation widget.

use crate::icons;
use crate::theme;
use egui::{CornerRadius, Sense, Ui};

/// A single breadcrumb item.
#[derive(Debug, Clone)]
pub struct BreadcrumbItem<'a> {
    pub label: &'a str,
    pub icon: Option<&'a str>,
    pub clickable: bool,
}

impl<'a> BreadcrumbItem<'a> {
    /// Create a new breadcrumb item.
    pub fn new(label: &'a str) -> Self {
        Self {
            label,
            icon: None,
            clickable: true,
        }
    }

    /// Add an icon to the breadcrumb.
    pub fn icon(mut self, icon: &'a str) -> Self {
        self.icon = Some(icon);
        self
    }

    /// Make the breadcrumb non-clickable (typically the current page).
    pub fn current(mut self) -> Self {
        self.clickable = false;
        self
    }
}

/// Breadcrumb separator style.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum BreadcrumbSeparator {
    #[default]
    Chevron,
    Slash,
    Arrow,
    Dot,
}

impl BreadcrumbSeparator {
    fn symbol(&self) -> &'static str {
        match self {
            BreadcrumbSeparator::Chevron => icons::CHEVRON_RIGHT,
            BreadcrumbSeparator::Slash => "/",
            BreadcrumbSeparator::Arrow => "→",
            BreadcrumbSeparator::Dot => "•",
        }
    }
}

/// Breadcrumb navigation widget.
pub struct Breadcrumb<'a> {
    items: Vec<BreadcrumbItem<'a>>,
    separator: BreadcrumbSeparator,
    max_items: Option<usize>,
}

impl<'a> Breadcrumb<'a> {
    /// Create a new breadcrumb from items.
    pub fn new(items: Vec<BreadcrumbItem<'a>>) -> Self {
        Self {
            items,
            separator: BreadcrumbSeparator::Chevron,
            max_items: None,
        }
    }

    /// Create breadcrumb from simple string labels.
    pub fn from_labels(labels: &[&'a str]) -> Self {
        let items: Vec<BreadcrumbItem<'a>> = labels
            .iter()
            .enumerate()
            .map(|(i, label)| {
                let item = BreadcrumbItem::new(label);
                if i == labels.len() - 1 {
                    item.current()
                } else {
                    item
                }
            })
            .collect();
        Self::new(items)
    }

    /// Set the separator style.
    pub fn separator(mut self, separator: BreadcrumbSeparator) -> Self {
        self.separator = separator;
        self
    }

    /// Collapse breadcrumbs if more than max_items, showing ellipsis.
    pub fn max_items(mut self, max: usize) -> Self {
        self.max_items = Some(max);
        self
    }

    /// Show the breadcrumb and return clicked index if any.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        let mut clicked_index: Option<usize> = None;
        let total_items = self.items.len();

        // Determine which items to show
        let (show_ellipsis, visible_items): (bool, Vec<(usize, &BreadcrumbItem)>) =
            if let Some(max) = self.max_items {
                if total_items > max && max >= 3 {
                    // Show first, ellipsis, and last (max-2) items
                    let mut visible = vec![(0, &self.items[0])];
                    let skip = total_items - (max - 2);
                    for (i, item) in self.items.iter().enumerate().skip(skip) {
                        visible.push((i, item));
                    }
                    (true, visible)
                } else {
                    (false, self.items.iter().enumerate().collect())
                }
            } else {
                (false, self.items.iter().enumerate().collect())
            };

        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = theme::SPACE_XS;

            let mut first = true;
            let mut shown_ellipsis = false;

            for (original_idx, item) in visible_items {
                // Separator (except before first item)
                if !first {
                    ui.label(
                        egui::RichText::new(self.separator.symbol())
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );
                }
                first = false;

                // Show ellipsis after first item if needed
                if show_ellipsis && original_idx > 0 && !shown_ellipsis {
                    // Ellipsis button (meets MIN_TOUCH_TARGET)
                    let (rect, response) =
                        ui.allocate_exact_size(egui::vec2(theme::MIN_TOUCH_TARGET, theme::MIN_TOUCH_TARGET), Sense::click());

                    if ui.is_rect_visible(rect) {
                        let is_hovered = response.hovered();

                        if is_hovered {
                            ui.painter().rect_filled(
                                rect,
                                CornerRadius::same(theme::SPACE_XS as u8),
                                theme::hover_bg(),
                            );
                        }

                        // Focus Ring (WCAG 2.4.7)
                        if response.has_focus() {
                            ui.painter().rect_stroke(
                                rect.expand(2.0),
                                CornerRadius::same(theme::SPACE_XS as u8 + 2),
                                theme::focus_ring(),
                                egui::epaint::StrokeKind::Outside,
                            );
                        }

                        ui.painter().text(
                            rect.center(),
                            egui::Align2::CENTER_CENTER,
                            "...",
                            theme::font_body(),
                            theme::text_tertiary(),
                        );
                    }

                    response.on_hover_cursor(egui::CursorIcon::PointingHand);

                    // Separator after ellipsis
                    ui.label(
                        egui::RichText::new(self.separator.symbol())
                            .font(theme::font_small())
                            .color(theme::text_tertiary()),
                    );

                    shown_ellipsis = true;
                }

                // Breadcrumb item
                let is_current = !item.clickable;
                let text_color = if is_current {
                    theme::text_primary()
                } else {
                    theme::text_secondary()
                };

                // Calculate item width
                let mut content = String::new();
                if let Some(icon) = item.icon {
                    content.push_str(icon);
                    content.push_str("  ");
                }
                content.push_str(item.label);

                let galley =
                    ui.painter()
                        .layout_no_wrap(content.clone(), theme::font_body(), text_color);

                let padding = egui::vec2(theme::SPACE_SM, theme::SPACE_XS);
                let item_size = galley.size() + padding * 2.0;

                let sense = if item.clickable {
                    Sense::click()
                } else {
                    Sense::hover()
                };

                let (rect, response) = ui.allocate_exact_size(item_size, sense);

                if ui.is_rect_visible(rect) {
                    let is_hovered = response.hovered() && item.clickable;

                    // Background on hover
                    if is_hovered {
                        ui.painter()
                            .rect_filled(rect, CornerRadius::same(theme::SPACE_XS as u8), theme::hover_bg());
                    }

                    // Text
                    let final_color = if is_hovered {
                        theme::ACCENT
                    } else {
                        text_color
                    };

                    ui.painter().galley(
                        rect.min + padding,
                        ui.painter()
                            .layout_no_wrap(content, theme::font_body(), final_color),
                        final_color,
                    );

                    // Underline for current
                    if is_current {
                        ui.painter().line_segment(
                            [
                                egui::pos2(rect.min.x + padding.x, rect.max.y - 2.0),
                                egui::pos2(rect.max.x - padding.x, rect.max.y - 2.0),
                            ],
                            egui::Stroke::new(theme::BORDER_THICK, theme::ACCENT),
                        );
                    }

                    // Focus Ring (WCAG 2.4.7)
                    if response.has_focus() && item.clickable {
                        ui.painter().rect_stroke(
                            rect.expand(2.0),
                            CornerRadius::same(theme::SPACE_XS as u8 + 2),
                            theme::focus_ring(),
                            egui::epaint::StrokeKind::Outside,
                        );
                    }
                }

                if item.clickable && response.hovered() {
                    ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                }

                if response.clicked() && item.clickable {
                    clicked_index = Some(original_idx);
                }
            }
        });

        clicked_index
    }
}

/// Simple breadcrumb from labels.
pub fn breadcrumb(ui: &mut Ui, labels: &[&str]) -> Option<usize> {
    Breadcrumb::from_labels(labels).show(ui)
}

/// Breadcrumb with custom separator.
pub fn breadcrumb_with_separator(
    ui: &mut Ui,
    labels: &[&str],
    separator: BreadcrumbSeparator,
) -> Option<usize> {
    Breadcrumb::from_labels(labels)
        .separator(separator)
        .show(ui)
}

/// Breadcrumb with home icon as first item.
pub fn breadcrumb_with_home(ui: &mut Ui, labels: &[&str]) -> Option<usize> {
    let mut items: Vec<BreadcrumbItem> = vec![BreadcrumbItem::new("").icon(icons::HOME)];

    for (i, label) in labels.iter().enumerate() {
        let item = BreadcrumbItem::new(label);
        if i == labels.len() - 1 {
            items.push(item.current());
        } else {
            items.push(item);
        }
    }

    Breadcrumb::new(items).show(ui)
}
