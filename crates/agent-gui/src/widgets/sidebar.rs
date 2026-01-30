//! Navigation sidebar widget.

use egui::{CornerRadius, Margin, Stroke, Ui, Vec2};

use crate::app::Page;
use crate::theme;

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    pub fn show(ui: &mut Ui, current: &Page) -> Option<Page> {
        let mut selected: Option<Page> = None;

        egui::Frame {
            fill: theme::BG_SIDEBAR,
            inner_margin: Margin::same(0),
            stroke: Stroke::new(0.5, theme::BORDER),
            ..Default::default()
        }
        .show(ui, |ui| {
                ui.set_min_width(theme::SIDEBAR_WIDTH);
                ui.set_max_width(theme::SIDEBAR_WIDTH);

                // Logo / brand section
                ui.add_space(theme::SPACE_XL);
                ui.vertical_centered(|ui| {
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new("SENTINEL")
                            .font(theme::font_title())
                            .color(theme::ACCENT)
                            .strong(),
                    );
                    ui.label(
                        egui::RichText::new("GRC AGENT")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_XL);
                });

                ui.vertical(|ui| {
                    ui.set_width(theme::SIDEBAR_WIDTH);
                    
                    // Group: Principal
                    ui.add_space(theme::SPACE_SM);
                    Self::section_label(ui, "PILOTAGE");
                    
                    let main_items: &[(Page, &str, &str)] = &[
                        (Page::Dashboard, "⛁", "Tableau de bord"),
                        (Page::Compliance, "✓", "Conformit\u{00e9}"),
                        (Page::Software, "📦", "Logiciels"),
                        (Page::Vulnerabilities, "☢", "Vuln\u{00e9}rabilit\u{00e9}s"),
                    ];

                    for (page, icon, label) in main_items {
                        if Self::nav_item(ui, icon, label, current == page) {
                            selected = Some(page.clone());
                        }
                    }

                    ui.add_space(theme::SPACE);
                    Self::section_label(ui, "SYS & NETWORK");

                    let sys_items: &[(Page, &str, &str)] = &[
                        (Page::Network, "🌐", "R\u{00e9}seau"),
                        (Page::Sync, "🔄", "Synchronisation"),
                        (Page::Logs, "📋", "Journaux"),
                    ];

                    for (page, icon, label) in sys_items {
                        if Self::nav_item(ui, icon, label, current == page) {
                            selected = Some(page.clone());
                        }
                    }

                    ui.with_layout(egui::Layout::bottom_up(egui::Align::Min), |ui| {
                        ui.add_space(theme::SPACE_XL);
                        
                        let bottom_items: &[(Page, &str, &str)] = &[
                            (Page::About, "ⓘ", "\u{00c0} propos"),
                            (Page::Settings, "⚙", "Param\u{00e8}tres"),
                        ];

                        for (page, icon, label) in bottom_items {
                            if Self::nav_item(ui, icon, label, current == page) {
                                selected = Some(page.clone());
                            }
                        }
                        
                        ui.add_space(theme::SPACE_SM);
                        ui.separator();
                    });
                });
            });

        selected
    }

    fn section_label(ui: &mut Ui, text: &str) {
        ui.add_space(theme::SPACE_XS);
        ui.horizontal(|ui| {
            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new(text)
                    .font(theme::font_small())
                    .color(theme::TEXT_TERTIARY)
                    .strong(),
            );
        });
        ui.add_space(theme::SPACE_XS);
    }

    fn nav_item(ui: &mut Ui, icon: &str, label: &str, is_current: bool) -> bool {
        let text_color = if is_current {
            theme::TEXT_PRIMARY
        } else {
            theme::TEXT_SECONDARY
        };
        
        let bg_fill = if is_current {
            theme::ACCENT.linear_multiply(0.12)
        } else {
            egui::Color32::TRANSPARENT
        };

        let (rect, response) = ui.allocate_exact_size(Vec2::new(theme::SIDEBAR_WIDTH, 42.0), egui::Sense::click());
        
        if ui.is_rect_visible(rect) {
            // Background tint on hover or active
            if is_current || response.hovered() {
                let fill = if is_current { bg_fill } else { theme::BG_ELEVATED.linear_multiply(0.5) };
                ui.painter().rect_filled(rect.shrink2(Vec2::new(8.0, 4.0)), CornerRadius::same(theme::BUTTON_ROUNDING), fill);
            }

            // Selected indicator (vertical bar)
            if is_current {
                let bar_rect = egui::Rect::from_min_max(
                    rect.left_top() + Vec2::new(4.0, 10.0),
                    rect.left_bottom() + Vec2::new(7.0, -10.0),
                );
                ui.painter().rect_filled(bar_rect, CornerRadius::same(1), theme::ACCENT);
            }

            // Icon and label - placed manually to avoid interaction deadzones
            let icon_pos = rect.left_top() + Vec2::new(20.0, 21.0);
            ui.painter().text(
                icon_pos,
                egui::Align2::LEFT_CENTER,
                icon,
                egui::FontId::proportional(16.0),
                if is_current { theme::ACCENT } else { theme::TEXT_TERTIARY },
            );

            let label_pos = rect.left_top() + Vec2::new(20.0 + 16.0 + 8.0, 21.0);
            ui.painter().text(
                label_pos,
                egui::Align2::LEFT_CENTER,
                label,
                theme::font_body(),
                text_color,
            );
        }

        response.clicked()
    }
}
