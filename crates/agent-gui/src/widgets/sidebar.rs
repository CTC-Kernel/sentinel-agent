//! Navigation sidebar widget.

use chrono::{DateTime, Utc};
use egui::{Color32, CornerRadius, Margin, Ui, Vec2};

use crate::app::Page;
use crate::icons;
use crate::theme;

/// Sync state passed to the sidebar for the status indicator.
pub struct SidebarSyncState {
    pub syncing: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    pub fn show(
        ui: &mut Ui,
        current: &Page,
        scanning: bool,
        unread_notifications: u32,
        sync_state: &SidebarSyncState,
    ) -> Option<Page> {
        let mut selected: Option<Page> = None;

        egui::Frame {
            fill: egui::Color32::TRANSPARENT, // We paint manually
            inner_margin: Margin::same(0),
            ..Default::default()
        }
        .show(ui, |ui| {
            ui.set_min_width(theme::SIDEBAR_WIDTH);
            ui.set_max_width(theme::SIDEBAR_WIDTH);

            // Paint gradient background
            let rect = ui.max_rect();
            let is_dark = theme::is_dark_mode();
            
            if ui.is_rect_visible(rect) {
                use egui::epaint::{Mesh, Vertex};
                let mut mesh = Mesh::default();
                
                let (top_col, bot_col) = if is_dark {
                    (
                        Color32::from_rgb(25, 25, 30), // Lighter top (Spotlight)
                        Color32::from_rgb(5, 5, 8)     // Deep bottom
                    )
                } else {
                    (
                         Color32::from_rgb(245, 245, 250),
                         Color32::from_rgb(230, 230, 235)
                    )
                };

                // Tricky: we need correct indices for 2 triangles forming the rect
                let idx = mesh.vertices.len() as u32;
                mesh.vertices.push(Vertex { pos: rect.left_top(), uv: Default::default(), color: top_col });
                mesh.vertices.push(Vertex { pos: rect.right_top(), uv: Default::default(), color: top_col });
                mesh.vertices.push(Vertex { pos: rect.right_bottom(), uv: Default::default(), color: bot_col });
                mesh.vertices.push(Vertex { pos: rect.left_bottom(), uv: Default::default(), color: bot_col });
                
                mesh.add_triangle(idx, idx + 1, idx + 2);
                mesh.add_triangle(idx + 2, idx + 3, idx);
                
                ui.painter().add(mesh);
            }

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
                                ui.label(
                                    egui::RichText::new(icons::CIRCLE)
                                        .size(10.0)
                                        .color(theme::ACCENT.linear_multiply(alpha)),
                                );
                            }
                        });
                        ui.label(
                            egui::RichText::new("GRC AGENT")
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
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
                                ui.painter().rect_filled(
                                    badge_rect,
                                    CornerRadius::same(8),
                                    theme::ERROR,
                                );
                                ui.painter().text(
                                    badge_rect.center(),
                                    egui::Align2::CENTER_CENTER,
                                    &badge_text,
                                    egui::FontId::proportional(9.0),
                                    theme::text_on_accent(),
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
                            (Page::Monitoring, icons::CHART_LINE, "Surveillance"),
                            (Page::Compliance, icons::COMPLIANCE, "Conformit\u{00e9}"),
                            (Page::Software, icons::SOFTWARE, "Logiciels"),
                            (
                                Page::Vulnerabilities,
                                icons::VULNERABILITIES,
                                "Vuln\u{00e9}rabilit\u{00e9}s",
                            ),
                            (
                                Page::FileIntegrity,
                                icons::FILE_SHIELD,
                                "Int\u{00e9}grit\u{00e9} fichiers",
                            ),
                            (Page::Threats, icons::SKULL, "Menaces"),
                            (Page::Notifications, icons::BELL, "Notifications"),
                        ];

                        for (page, icon, label) in main_items {
                            let badge = if *page == Page::Notifications && unread_notifications > 0
                            {
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
                        let sync_height = 44.0; // dot+label + timestamp + spacing
                        let bottom_height = sync_height
                            + 42.0 * 2.0
                            + theme::SPACE_SM * 2.0
                            + theme::SPACE_XL
                            + 2.0;
                        let remaining = ui.available_height() - bottom_height;
                        if remaining > 0.0 {
                            ui.add_space(remaining);
                        } else {
                            ui.add_space(theme::SPACE);
                        }

                        Self::sync_indicator(ui, sync_state);
                        ui.add_space(theme::SPACE_SM);

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
                    .color(theme::text_tertiary())
                    .strong(),
            );
        });
        ui.add_space(theme::SPACE_XS);
    }

    fn nav_item(ui: &mut Ui, icon: &str, label: &str, is_current: bool) -> bool {
        Self::nav_item_with_badge(ui, icon, label, is_current, None)
    }

    fn nav_item_with_badge(
        ui: &mut Ui,
        icon: &str,
        label: &str,
        is_current: bool,
        badge: Option<u32>,
    ) -> bool {
        let text_color = if is_current {
            theme::text_primary()
        } else {
            theme::text_secondary()
        };

        let bg_fill = if is_current {
            theme::ACCENT.linear_multiply(0.12)
        } else {
            egui::Color32::TRANSPARENT
        };

        let (rect, response) =
            ui.allocate_exact_size(Vec2::new(theme::SIDEBAR_WIDTH, 42.0), egui::Sense::click());

        if ui.is_rect_visible(rect) {
            // Background tint on hover or active
            if is_current || response.hovered() {
                let fill = if is_current {
                    bg_fill
                } else {
                    theme::bg_elevated().linear_multiply(0.5)
                };
                ui.painter().rect_filled(
                    rect.shrink2(Vec2::new(8.0, 2.0)), // Slightly tighter vertical shrink
                    CornerRadius::same(theme::BUTTON_ROUNDING),
                    fill,
                );
            }

            // Icon and label - centered vertically
            // Removed vertical bar for cleaner macOS look

            let icon_pos = rect.left_center() + Vec2::new(20.0, -8.0); // Adjust Y to center icon
            ui.painter().text(
                icon_pos,
                egui::Align2::LEFT_TOP,
                icon,
                egui::FontId::proportional(16.0),
                if is_current {
                    theme::ACCENT
                } else {
                    theme::text_tertiary()
                },
            );

            let label_pos = rect.left_center() + Vec2::new(20.0 + 16.0 + 10.0, -6.5); // Adjust Y to center text
            ui.painter().text(
                label_pos,
                egui::Align2::LEFT_TOP,
                label,
                theme::font_body(),
                text_color,
            );

            // Badge
            if let Some(count) = badge {
                if count > 0 {
                    let badge_text = if count > 9 {
                        "9+".to_string()
                    } else {
                        count.to_string()
                    };
                    let badge_center = rect.right_center() + Vec2::new(-24.0, 0.0);
                    let badge_rect =
                        egui::Rect::from_center_size(badge_center, Vec2::new(20.0, 16.0));
                    ui.painter()
                        .rect_filled(badge_rect, CornerRadius::same(8), theme::ERROR);
                    ui.painter().text(
                        badge_center,
                        egui::Align2::CENTER_CENTER,
                        &badge_text,
                        egui::FontId::proportional(10.0),
                        theme::text_on_accent(),
                    );
                }
            }
        }

        response.clicked()
    }

    /// Premium sync status indicator with animated dot, label, and relative timestamp.
    fn sync_indicator(ui: &mut Ui, state: &SidebarSyncState) {
        let now = Utc::now();
        let t = ui.input(|i| i.time);

        // Determine visual state
        let (dot_color, label, pulse_speed): (egui::Color32, &str, f64) = if state.syncing {
            (theme::ACCENT, "Synchronisation...", 3.0)
        } else if state.error.is_some() {
            (theme::ERROR, "Erreur sync", 0.0)
        } else if let Some(last) = state.last_sync_at {
            let age_secs = (now - last).num_seconds();
            if age_secs < 300 {
                (theme::SUCCESS, "Synchronis\u{00e9}", 1.0)
            } else {
                (theme::WARNING, "En attente", 0.0)
            }
        } else {
            (theme::text_tertiary(), "Non synchronis\u{00e9}", 0.0)
        };

        // Pulse animation (cosine ease)
        let alpha = if pulse_speed > 0.0 {
            0.5 + 0.5 * (t * pulse_speed * std::f64::consts::TAU).cos() as f32
        } else {
            1.0
        };

        // Row 1: dot + label
        let row_response = ui.horizontal(|ui| {
            ui.add_space(theme::SPACE_MD + 8.0);
            // Animated dot
            let (dot_rect, _) = ui.allocate_exact_size(Vec2::new(8.0, 8.0), egui::Sense::empty());
            ui.painter()
                .circle_filled(dot_rect.center(), 4.0, dot_color.linear_multiply(alpha));
            // Subtle glow on synced/syncing
            if pulse_speed > 0.0 {
                ui.painter().circle_filled(
                    dot_rect.center(),
                    6.0,
                    dot_color.linear_multiply(alpha * 0.15),
                );
            }
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(label)
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
        });

        // Tooltip on error
        if let Some(ref err) = state.error {
            row_response.response.on_hover_text(err);
        }

        // Row 2: relative timestamp
        if let Some(last) = state.last_sync_at {
            ui.horizontal(|ui| {
                ui.add_space(theme::SPACE_MD + 8.0 + 8.0 + theme::SPACE_XS);
                ui.label(
                    egui::RichText::new(Self::relative_time_fr(now, last))
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                );
            });
        }
    }

    /// Format a relative time difference in French.
    fn relative_time_fr(now: DateTime<Utc>, then: DateTime<Utc>) -> String {
        let secs = (now - then).num_seconds().max(0);
        if secs < 60 {
            "\u{00e0} l'instant".into()
        } else if secs < 3600 {
            format!("il y a {} min", secs / 60)
        } else if secs < 86400 {
            format!("il y a {} h", secs / 3600)
        } else {
            format!("il y a {} j", secs / 86400)
        }
    }
}
