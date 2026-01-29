//! Navigation sidebar widget.

use egui::{Frame, Margin, Rounding, Stroke, Ui, Vec2};

use crate::app::Page;
use crate::theme;

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    pub fn show(ui: &mut Ui, current: &Page) -> Option<Page> {
        let mut selected: Option<Page> = None;

        Frame::new()
            .fill(theme::BG_SIDEBAR)
            .inner_margin(Margin::symmetric(theme::SPACE_SM, theme::SPACE))
            .stroke(Stroke::new(0.5, theme::BORDER))
            .show(ui, |ui| {
                ui.set_min_width(theme::SIDEBAR_WIDTH);
                ui.set_max_width(theme::SIDEBAR_WIDTH);

                // Logo / brand
                ui.vertical_centered(|ui| {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new("SENTINEL")
                            .font(theme::font_title())
                            .color(theme::ACCENT)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("Agent GRC")
                            .font(theme::font_small())
                            .color(theme::TEXT_SECONDARY),
                    );
                    ui.add_space(theme::SPACE);
                });

                ui.separator();
                ui.add_space(theme::SPACE_SM);

                // Navigation items
                let items: &[(Page, &str, &str)] = &[
                    (Page::Dashboard, "\u{1f3e0}", "Tableau de bord"),
                    (Page::Compliance, "\u{2705}", "Conformit\u{00e9}"),
                    (Page::Network, "\u{1f310}", "R\u{00e9}seau"),
                    (Page::Sync, "\u{1f504}", "Synchronisation"),
                    (Page::Logs, "\u{1f4cb}", "Journaux"),
                ];

                for (page, icon, label) in items {
                    let is_current = current == page;
                    if Self::nav_item(ui, icon, label, is_current) {
                        selected = Some(page.clone());
                    }
                }

                ui.add_space(theme::SPACE_LG);
                ui.separator();
                ui.add_space(theme::SPACE_SM);

                // Bottom items
                let bottom_items: &[(Page, &str, &str)] = &[
                    (Page::Settings, "\u{2699}\u{fe0f}", "Param\u{00e8}tres"),
                    (Page::About, "\u{2139}\u{fe0f}", "\u{00c0} propos"),
                ];

                for (page, icon, label) in bottom_items {
                    let is_current = current == page;
                    if Self::nav_item(ui, icon, label, is_current) {
                        selected = Some(page.clone());
                    }
                }
            });

        selected
    }

    fn nav_item(ui: &mut Ui, icon: &str, label: &str, is_current: bool) -> bool {
        let text_color = if is_current {
            theme::ACCENT
        } else {
            theme::TEXT_SECONDARY
        };
        let bg = if is_current {
            theme::ACCENT.linear_multiply(0.12)
        } else {
            egui::Color32::TRANSPARENT
        };

        let btn = egui::Button::new(
            egui::RichText::new(format!("  {}  {}", icon, label))
                .font(theme::font_body())
                .color(text_color),
        )
        .fill(bg)
        .rounding(Rounding::same(theme::BUTTON_ROUNDING))
        .stroke(Stroke::NONE)
        .min_size(Vec2::new(theme::SIDEBAR_WIDTH - theme::SPACE, 36.0));

        ui.add(btn).clicked()
    }
}
