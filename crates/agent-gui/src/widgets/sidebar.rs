//! Navigation sidebar widget.

use egui::{CornerRadius, Margin, Ui, Vec2};

use crate::app::Page;
use crate::icons;
use crate::theme;

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    pub fn show(ui: &mut Ui, current: &Page, scanning: bool, unread_notifications: u32) -> Option<Page> {
        let mut selected: Option<Page> = None;

        egui::Frame {
            fill: theme::BG_SIDEBAR,
            inner_margin: Margin::same(0),
            ..Default::default()
        }
        .show(ui, |ui| {
                ui.set_min_width(theme::SIDEBAR_WIDTH);
                ui.set_max_width(theme::SIDEBAR_WIDTH);

                egui::ScrollArea::vertical()
                    .auto_shrink(egui::Vec2b::new(false, false))
                    .show(ui, |ui| {

                // Logo / brand section
                ui.add_space(theme::SPACE);
                ui.vertical_centered(|ui| {
                    // IA.png logo
                    let logo = egui::Image::from_bytes(
                        "bytes://ia_sidebar",
                        include_bytes!("../../assets/IA.png"),
                    )
                    .max_width(56.0);
                    ui.add(logo);

                    ui.add_space(theme::SPACE_SM);

                    ui.horizontal(|ui| {
                        ui.add_space(ui.available_width() / 4.0);
                        ui.label(
                            egui::RichText::new("SENTINEL")
                                .font(theme::font_title())
                                .color(theme::ACCENT)
                                .strong(),
                        );
                        if scanning {
                            let t = ui.input(|i| i.time);
                            let alpha = ((t * 2.5).cos() * 0.5 + 0.5) as f32;
                            ui.label(egui::RichText::new(icons::CIRCLE).size(10.0).color(theme::ACCENT.linear_multiply(alpha)));
                        }
                    });
                    ui.label(
                        egui::RichText::new("GRC AGENT")
                            .font(theme::font_small())
                            .color(theme::TEXT_TERTIARY)
                            .strong(),
                    );

                    // Bell badge with unread count
                    if unread_notifications > 0 {
                        ui.add_space(theme::SPACE_SM);
                        ui.horizontal(|ui| {
                            ui.add_space(theme::SIDEBAR_WIDTH / 2.0 - 30.0);
                            let bell_response = ui.label(
                                egui::RichText::new(icons::BELL)
                                    .size(16.0)
                                    .color(theme::WARNING),
                            );
                            // Draw count badge
                            let badge_text = if unread_notifications > 9 {
                                "9+".to_string()
                            } else {
                                unread_notifications.to_string()
                            };
                            let badge_rect = egui::Rect::from_min_size(
                                bell_response.rect.right_top() + egui::vec2(-4.0, -4.0),
                                egui::vec2(16.0, 16.0),
                            );
                            ui.painter().rect_filled(badge_rect, CornerRadius::same(8), theme::ERROR);
                            ui.painter().text(
                                badge_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                &badge_text,
                                egui::FontId::proportional(9.0),
                                theme::TEXT_ON_ACCENT,
                            );
                        });
                    }

                    ui.add_space(theme::SPACE_LG);
                });

                ui.vertical(|ui| {
                    ui.set_width(theme::SIDEBAR_WIDTH);

                    // Group: Principal
                    ui.add_space(theme::SPACE_SM);
                    Self::section_label(ui, "PILOTAGE");

                    let main_items: &[(Page, &str, &str)] = &[
                        (Page::Dashboard, icons::DASHBOARD, "Tableau de bord"),
                        (Page::Compliance, icons::COMPLIANCE, "Conformit\u{00e9}"),
                        (Page::Software, icons::SOFTWARE, "Logiciels"),
                        (Page::Vulnerabilities, icons::VULNERABILITIES, "Vuln\u{00e9}rabilit\u{00e9}s"),
                        (Page::Notifications, icons::BELL, "Notifications"),
                    ];

                    for (page, icon, label) in main_items {
                        let badge = if *page == Page::Notifications && unread_notifications > 0 {
                            Some(unread_notifications)
                        } else {
                            None
                        };
                        if Self::nav_item_with_badge(ui, icon, label, current == page, badge) {
                            selected = Some(page.clone());
                        }
                    }

                    ui.add_space(theme::SPACE);
                    Self::section_label(ui, "SYS & NETWORK");

                    let sys_items: &[(Page, &str, &str)] = &[
                        (Page::Network, icons::NETWORK, "R\u{00e9}seau"),
                        (Page::Discovery, icons::DISCOVERY, "D\u{00e9}couverte"),
                        (Page::Cartography, icons::CARTOGRAPHY, "Cartographie"),
                        (Page::Sync, icons::SYNC, "Synchronisation"),
                        (Page::Terminal, icons::TERMINAL, "Terminal"),
                    ];

                    for (page, icon, label) in sys_items {
                        if Self::nav_item(ui, icon, label, current == page) {
                            selected = Some(page.clone());
                        }
                    }

                    // Flexible spacer: push bottom items down when space allows,
                    // but never overlap -- ScrollArea handles overflow.
                    let bottom_height = 42.0 * 2.0 + theme::SPACE_SM + theme::SPACE_XL + 2.0;
                    let remaining = ui.available_height() - bottom_height;
                    if remaining > 0.0 {
                        ui.add_space(remaining);
                    } else {
                        ui.add_space(theme::SPACE);
                    }

                    ui.separator();
                    ui.add_space(theme::SPACE_SM);

                    let bottom_items: &[(Page, &str, &str)] = &[
                        (Page::Settings, icons::SETTINGS, "Param\u{00e8}tres"),
                        (Page::About, icons::ABOUT, "\u{00c0} propos"),
                    ];

                    for (page, icon, label) in bottom_items {
                        if Self::nav_item(ui, icon, label, current == page) {
                            selected = Some(page.clone());
                        }
                    }

                    ui.add_space(theme::SPACE_XL);
                });
                }); // end ScrollArea
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
        Self::nav_item_with_badge(ui, icon, label, is_current, None)
    }

    fn nav_item_with_badge(ui: &mut Ui, icon: &str, label: &str, is_current: bool, badge: Option<u32>) -> bool {
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

            // Badge
            if let Some(count) = badge {
                if count > 0 {
                    let badge_text = if count > 9 { "9+".to_string() } else { count.to_string() };
                    let badge_center = rect.right_center() + Vec2::new(-24.0, 0.0);
                    let badge_rect = egui::Rect::from_center_size(badge_center, Vec2::new(20.0, 16.0));
                    ui.painter().rect_filled(badge_rect, CornerRadius::same(8), theme::ERROR);
                    ui.painter().text(
                        badge_center,
                        egui::Align2::CENTER_CENTER,
                        &badge_text,
                        egui::FontId::proportional(10.0),
                        theme::TEXT_ON_ACCENT,
                    );
                }
            }
        }

        response.clicked()
    }
}
