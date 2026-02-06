//! Tab navigation widget.

use crate::theme;
use egui::{Color32, CornerRadius, Sense, Ui};

/// Tab style variant.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum TabStyle {
    #[default]
    Underline,
    Pills,
    Boxed,
}

/// A single tab definition.
pub struct Tab<'a> {
    pub label: &'a str,
    pub icon: Option<&'a str>,
    pub badge: Option<u32>,
    pub disabled: bool,
}

impl<'a> Tab<'a> {
    pub fn new(label: &'a str) -> Self {
        Self {
            label,
            icon: None,
            badge: None,
            disabled: false,
        }
    }

    pub fn icon(mut self, icon: &'a str) -> Self {
        self.icon = Some(icon);
        self
    }

    pub fn badge(mut self, count: u32) -> Self {
        self.badge = Some(count);
        self
    }

    pub fn disabled(mut self) -> Self {
        self.disabled = true;
        self
    }
}

/// Tab bar widget.
pub struct TabBar<'a> {
    tabs: Vec<Tab<'a>>,
    selected: usize,
    style: TabStyle,
    full_width: bool,
}

impl<'a> TabBar<'a> {
    /// Create a new tab bar with the given tabs.
    pub fn new(tabs: Vec<Tab<'a>>, selected: usize) -> Self {
        Self {
            tabs,
            selected,
            style: TabStyle::Underline,
            full_width: false,
        }
    }

    /// Create a tab bar from simple string labels.
    pub fn from_labels(labels: &[&'a str], selected: usize) -> Self {
        let tabs = labels.iter().map(|l| Tab::new(l)).collect();
        Self::new(tabs, selected)
    }

    /// Set the tab style.
    pub fn style(mut self, style: TabStyle) -> Self {
        self.style = style;
        self
    }

    /// Make tabs expand to fill available width.
    pub fn full_width(mut self) -> Self {
        self.full_width = true;
        self
    }

    /// Show the tab bar and return the new selected index if changed.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        match self.style {
            TabStyle::Underline => self.show_underline(ui),
            TabStyle::Pills => self.show_pills(ui),
            TabStyle::Boxed => self.show_boxed(ui),
        }
    }

    fn show_underline(self, ui: &mut Ui) -> Option<usize> {
        let mut new_selection = None;
        let available_width = ui.available_width();
        let tab_count = self.tabs.len();

        ui.horizontal(|ui| {
            for (i, tab) in self.tabs.iter().enumerate() {
                let is_selected = i == self.selected;
                let tab_width = if self.full_width {
                    available_width / tab_count as f32
                } else {
                    0.0 // Auto-size
                };

                if let Some(idx) = self.render_underline_tab(ui, tab, is_selected, tab_width)
                    && idx == i {
                        new_selection = Some(i);
                    }
            }
        });

        // Draw underline for the entire tab bar
        let rect = ui.min_rect();
        ui.painter().line_segment(
            [
                egui::pos2(rect.min.x, rect.max.y),
                egui::pos2(rect.max.x, rect.max.y),
            ],
            egui::Stroke::new(1.0, theme::border()),
        );

        new_selection
    }

    fn render_underline_tab(
        &self,
        ui: &mut Ui,
        tab: &Tab,
        is_selected: bool,
        fixed_width: f32,
    ) -> Option<usize> {
        let font = theme::font_body();
        let mut content_width = 0.0;

        // Calculate content width
        if let Some(_icon) = tab.icon {
            content_width += 20.0; // Icon width + spacing
        }
        content_width += ui
            .painter()
            .layout_no_wrap(tab.label.to_string(), font.clone(), Color32::WHITE)
            .size()
            .x;
        if tab.badge.is_some() {
            content_width += 28.0; // Badge width + spacing
        }

        let padding = egui::vec2(16.0, 12.0);
        let tab_width = if fixed_width > 0.0 {
            fixed_width
        } else {
            content_width + padding.x * 2.0
        };
        let tab_height = 40.0;

        let (rect, response) = ui.allocate_exact_size(
            egui::vec2(tab_width, tab_height),
            if tab.disabled {
                Sense::hover()
            } else {
                Sense::click()
            },
        );

        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);
            let is_hovered = response.hovered() && !tab.disabled;

            // Text color
            let text_color = if tab.disabled {
                theme::text_tertiary()
            } else if is_selected {
                theme::ACCENT
            } else if is_hovered {
                theme::text_primary()
            } else {
                theme::text_secondary()
            };

            let mut x = rect.min.x + padding.x;

            // Icon
            if let Some(icon) = tab.icon {
                painter.text(
                    egui::pos2(x, rect.center().y),
                    egui::Align2::LEFT_CENTER,
                    icon,
                    theme::font_body(),
                    text_color,
                );
                x += 20.0;
            }

            // Label
            painter.text(
                egui::pos2(x, rect.center().y),
                egui::Align2::LEFT_CENTER,
                tab.label,
                font,
                text_color,
            );

            // Badge
            if let Some(count) = tab.badge {
                let badge_text = if count > 99 {
                    "99+".to_string()
                } else {
                    count.to_string()
                };
                let badge_rect = egui::Rect::from_center_size(
                    egui::pos2(rect.max.x - padding.x - 10.0, rect.center().y),
                    egui::vec2(20.0, 18.0),
                );
                painter.rect_filled(badge_rect, CornerRadius::same(9), theme::ERROR);
                painter.text(
                    badge_rect.center(),
                    egui::Align2::CENTER_CENTER,
                    badge_text,
                    theme::font_label(),
                    Color32::WHITE,
                );
            }

            // Selected underline
            if is_selected {
                let underline_rect = egui::Rect::from_min_size(
                    egui::pos2(rect.min.x, rect.max.y - 2.0),
                    egui::vec2(rect.width(), 2.0),
                );
                painter.rect_filled(underline_rect, CornerRadius::ZERO, theme::ACCENT);
            }
        }

        if response.clicked() && !tab.disabled {
            Some(0) // Signal that this tab was clicked
        } else {
            None
        }
    }

    fn show_pills(self, ui: &mut Ui) -> Option<usize> {
        let mut new_selection = None;

        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = theme::SPACE_XS;

            for (i, tab) in self.tabs.iter().enumerate() {
                let is_selected = i == self.selected;

                let (bg, text_color) = if tab.disabled {
                    (Color32::TRANSPARENT, theme::text_tertiary())
                } else if is_selected {
                    (theme::ACCENT, Color32::WHITE)
                } else {
                    (Color32::TRANSPARENT, theme::text_secondary())
                };

                let mut text = String::new();
                if let Some(icon) = tab.icon {
                    text.push_str(icon);
                    text.push_str("  ");
                }
                text.push_str(tab.label);

                let galley = ui
                    .painter()
                    .layout_no_wrap(text.clone(), theme::font_body(), text_color);

                let padding = egui::vec2(12.0, 6.0);
                let size = galley.size() + padding * 2.0;
                let (rect, response) = ui.allocate_exact_size(
                    size,
                    if tab.disabled {
                        Sense::hover()
                    } else {
                        Sense::click()
                    },
                );

                if ui.is_rect_visible(rect) {
                    let is_hovered = response.hovered() && !tab.disabled;

                    let actual_bg = if is_hovered && !is_selected {
                        theme::hover_bg()
                    } else {
                        bg
                    };

                    ui.painter().rect(
                        rect,
                        CornerRadius::same(theme::BUTTON_ROUNDING),
                        actual_bg,
                        if is_selected || tab.disabled {
                            egui::Stroke::NONE
                        } else {
                            egui::Stroke::new(1.0, theme::border())
                        },
                        egui::epaint::StrokeKind::Inside,
                    );

                    ui.painter().galley(
                        rect.min + padding,
                        galley,
                        if is_selected {
                            Color32::WHITE
                        } else if is_hovered {
                            theme::text_primary()
                        } else {
                            text_color
                        },
                    );

                    // Badge
                    if let Some(count) = tab.badge {
                        let badge_text = if count > 9 { "9+" } else { &count.to_string() };
                        let badge_pos = egui::pos2(rect.max.x - 6.0, rect.min.y + 6.0);
                        ui.painter()
                            .circle_filled(badge_pos, 8.0, theme::ERROR);
                        ui.painter().text(
                            badge_pos,
                            egui::Align2::CENTER_CENTER,
                            badge_text,
                            theme::font_label(),
                            Color32::WHITE,
                        );
                    }
                }

                if response.clicked() && !tab.disabled {
                    new_selection = Some(i);
                }
            }
        });

        new_selection
    }

    fn show_boxed(self, ui: &mut Ui) -> Option<usize> {
        let mut new_selection = None;
        let available_width = ui.available_width();
        let tab_count = self.tabs.len();

        // Container frame
        egui::Frame::new()
            .fill(theme::bg_tertiary())
            .corner_radius(CornerRadius::same(theme::BUTTON_ROUNDING))
            .inner_margin(egui::Margin::same(4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 4.0;

                    let tab_width =
                        (available_width - 8.0 - (tab_count - 1) as f32 * 4.0) / tab_count as f32;

                    for (i, tab) in self.tabs.iter().enumerate() {
                        let is_selected = i == self.selected;

                        let (rect, response) = ui.allocate_exact_size(
                            egui::vec2(tab_width, 32.0),
                            if tab.disabled {
                                Sense::hover()
                            } else {
                                Sense::click()
                            },
                        );

                        if ui.is_rect_visible(rect) {
                            let is_hovered = response.hovered() && !tab.disabled;

                            let bg = if tab.disabled {
                                Color32::TRANSPARENT
                            } else if is_selected {
                                theme::bg_secondary()
                            } else if is_hovered {
                                theme::hover_bg()
                            } else {
                                Color32::TRANSPARENT
                            };

                            let text_color = if tab.disabled {
                                theme::text_tertiary()
                            } else if is_selected {
                                theme::text_primary()
                            } else {
                                theme::text_secondary()
                            };

                            // Background
                            if bg != Color32::TRANSPARENT {
                                ui.painter().rect(
                                    rect,
                                    CornerRadius::same(theme::BUTTON_ROUNDING - 2),
                                    bg,
                                    if is_selected {
                                        egui::Stroke::new(0.5, theme::border())
                                    } else {
                                        egui::Stroke::NONE
                                    },
                                    egui::epaint::StrokeKind::Inside,
                                );

                                // Shadow for selected
                                if is_selected {
                                    let shadow = theme::premium_shadow(4, 15);
                                    ui.painter().add(shadow.as_shape(
                                        rect,
                                        CornerRadius::same(theme::BUTTON_ROUNDING - 2),
                                    ));
                                }
                            }

                            // Content
                            let mut content = String::new();
                            if let Some(icon) = tab.icon {
                                content.push_str(icon);
                                content.push_str("  ");
                            }
                            content.push_str(tab.label);

                            ui.painter().text(
                                rect.center(),
                                egui::Align2::CENTER_CENTER,
                                content,
                                theme::font_body(),
                                text_color,
                            );
                        }

                        if response.clicked() && !tab.disabled {
                            new_selection = Some(i);
                        }
                    }
                });
            });

        new_selection
    }
}

/// Simple tab bar from string labels.
pub fn tabs(ui: &mut Ui, labels: &[&str], selected: &mut usize) -> bool {
    if let Some(new_idx) = TabBar::from_labels(labels, *selected).show(ui) {
        *selected = new_idx;
        true
    } else {
        false
    }
}

/// Tab bar with pills style.
pub fn tabs_pills(ui: &mut Ui, labels: &[&str], selected: &mut usize) -> bool {
    if let Some(new_idx) = TabBar::from_labels(labels, *selected)
        .style(TabStyle::Pills)
        .show(ui)
    {
        *selected = new_idx;
        true
    } else {
        false
    }
}

/// Tab bar with boxed/segmented control style.
pub fn tabs_boxed(ui: &mut Ui, labels: &[&str], selected: &mut usize) -> bool {
    if let Some(new_idx) = TabBar::from_labels(labels, *selected)
        .style(TabStyle::Boxed)
        .show(ui)
    {
        *selected = new_idx;
        true
    } else {
        false
    }
}
