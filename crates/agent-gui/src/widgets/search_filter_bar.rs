//! Reusable search + filter chip bar widget.

use egui::{CornerRadius, Ui, Vec2};

use crate::theme;

/// A horizontal bar with a search text input, filter chips, and optional result count.
///
/// Usage (builder pattern):
/// ```ignore
/// let toggled = SearchFilterBar::new(&mut my_search, "Rechercher...")
///     .chip("CONFORME", is_active, theme::SUCCESS)
///     .chip("NON-CONFORME", other_active, theme::ERROR)
///     .result_count(42)
///     .show(ui);
/// ```
pub struct SearchFilterBar<'a> {
    search: &'a mut String,
    placeholder: &'a str,
    chips: Vec<(&'a str, bool, egui::Color32)>,
    count: Option<usize>,
}

impl<'a> SearchFilterBar<'a> {
    pub fn new(search: &'a mut String, placeholder: &'a str) -> Self {
        Self {
            search,
            placeholder,
            chips: Vec::new(),
            count: None,
        }
    }

    /// Add a filter chip.  `active` = currently selected.
    pub fn chip(mut self, label: &'a str, active: bool, color: egui::Color32) -> Self {
        self.chips.push((label, active, color));
        self
    }

    /// Show a result count on the right side.
    pub fn result_count(mut self, n: usize) -> Self {
        self.count = Some(n);
        self
    }

    /// Render the bar. Returns `Some(index)` of a chip that was toggled, or `None`.
    pub fn show(self, ui: &mut Ui) -> Option<usize> {
        let mut toggled: Option<usize> = None;

        ui.horizontal(|ui: &mut egui::Ui| {
            // Search input
            let search_width = 220.0_f32.min(ui.available_width() * 0.35);
            ui.add_sized(
                Vec2::new(search_width, 28.0),
                egui::TextEdit::singleline(self.search)
                    .hint_text(self.placeholder)
                    .font(theme::font_small())
                    .text_color(theme::text_primary())
                    .desired_width(search_width),
            );

            ui.add_space(theme::SPACE_SM);

            // Chips — unified with badge design system
            for (idx, (label, active, color)) in self.chips.iter().enumerate() {
                let (bg, fg) = if *active {
                    (theme::badge_bg(*color), theme::badge_text(*color))
                } else {
                    (
                        egui::Color32::TRANSPARENT,
                        theme::badge_text(*color),
                    )
                };

                let border_color = theme::badge_border(*color);

                let btn = egui::Button::new(
                    egui::RichText::new(*label)
                        .font(theme::font_small())
                        .color(fg)
                        .strong(),
                )
                .fill(bg)
                .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, border_color))
                .corner_radius(CornerRadius::same(theme::BADGE_ROUNDING))
                .min_size(Vec2::new(0.0, theme::MIN_TOUCH_TARGET));

                let response = ui.add(btn);

                // Subtle border emphasis on hover
                if response.hovered() && !*active {
                    let rect = response.rect;
                    ui.painter().rect_stroke(
                        rect,
                        CornerRadius::same(theme::BADGE_ROUNDING),
                        egui::Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(*color)),
                        egui::StrokeKind::Inside,
                    );
                }

                if response.clicked() {
                    toggled = Some(idx);
                }
            }

            // Result count on right
            if let Some(n) = self.count {
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(format!("{} résultat(s)", n))
                                .font(theme::font_small())
                                .color(theme::text_tertiary()),
                        );
                    },
                );
            }
        });

        toggled
    }
}
