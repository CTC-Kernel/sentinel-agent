// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Navigation sidebar widget.

use chrono::{DateTime, Utc};
use egui::{CornerRadius, Ui, Vec2};

use crate::app::Page;
use crate::icons;
use crate::theme;

/// Sync state passed to the sidebar for the status indicator.
pub struct SidebarSyncState {
    pub syncing: bool,
    pub pending_count: u32,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    #[allow(clippy::too_many_arguments)]
    pub fn show(
        ui: &mut Ui,
        current: &Page,
        _scanning: bool,
        unread_notifications: u32,
        sync_state: &SidebarSyncState,
        organization: Option<&str>,
        ai_ready: bool,
        voice_active: bool,
    ) -> Option<Page> {
        let mut selected: Option<Page> = None;
        let route_id = ui.id().with("sidebar_last_route");
        let route = format!("{current:?}");
        let route_changed = ui.data_mut(|data| {
            let changed = data.get_temp::<String>(route_id).as_ref() != Some(&route);
            data.insert_temp(route_id, route);
            changed
        });

        ui.set_width(theme::SIDEBAR_WIDTH);
        ui.add_space(22.0);
        ui.horizontal(|ui| {
            ui.add_space(18.0);
            let (rect, _) = ui.allocate_exact_size(egui::vec2(32.0, 36.0), egui::Sense::hover());
            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                icons::SHIELD,
                theme::font_icon(27.0),
                theme::accent_text(),
            );
            ui.vertical(|ui| {
                ui.label(
                    egui::RichText::new("sentinel")
                        .size(23.0)
                        .strong()
                        .color(theme::text_primary()),
                );
                ui.label(
                    egui::RichText::new("SECURITY WORKSPACE")
                        .size(9.0)
                        .extra_letter_spacing(1.3)
                        .color(theme::text_tertiary()),
                );
            });
        });
        ui.add_space(18.0);
        Self::sync_indicator(ui, sync_state);
        ui.add_space(16.0);
        egui::ScrollArea::vertical()
            .id_salt("navigation_sections")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                ui.spacing_mut().item_spacing.y = 2.0;
                for (page, icon, label) in [
                    (Page::Dashboard, icons::DASHBOARD, "Vue d’ensemble"),
                    (Page::Monitoring, icons::CHART_LINE, "Surveillance"),
                    (Page::Threats, icons::SHIELD, "Menaces"),
                    (
                        Page::Vulnerabilities,
                        icons::VULNERABILITIES,
                        "Vulnérabilités",
                    ),
                    (Page::Compliance, icons::COMPLIANCE, "Conformité"),
                    (Page::Notifications, icons::BELL, "Notifications"),
                ] {
                    let badge = if page == Page::Notifications && unread_notifications > 0 {
                        Some(unread_notifications)
                    } else {
                        None
                    };
                    if Self::nav_item_with_badge(ui, icon, label, current == &page, badge) {
                        selected = Some(page);
                    }
                }
                ui.add_space(16.0);
                for (label, items) in [
                    (
                        "INVESTIGATION",
                        vec![
                            (Page::Network, icons::NETWORK, "Réseau"),
                            (
                                Page::FileIntegrity,
                                icons::FILE_SHIELD,
                                "Intégrité des fichiers",
                            ),
                            (Page::AuditTrail, icons::CLIPBOARD, "Journal d’audit"),
                            (Page::Risks, icons::SCALE_BALANCED, "Risques"),
                        ],
                    ),
                    (
                        "ACTIFS & RAPPORTS",
                        vec![
                            (Page::Assets, icons::BOXES_STACKED, "Inventaire"),
                            (Page::Software, icons::SOFTWARE, "Logiciels & MDM"),
                            (Page::Discovery, icons::DISCOVERY, "Shadow IT"),
                            (Page::Cartography, icons::CARTOGRAPHY, "Cartographie"),
                            (Page::Reports, icons::FILE_EXPORT, "Rapports"),
                        ],
                    ),
                    (
                        "OUTILS SYSTÈME",
                        vec![
                            (Page::Sync, icons::SYNC, "Synchronisation"),
                            (Page::Terminal, icons::TERMINAL, "Terminal"),
                            (Page::About, icons::ABOUT, "À propos"),
                        ],
                    ),
                ] {
                    ui.scope(|ui| {
                        ui.spacing_mut().indent = 14.0;
                        egui::CollapsingHeader::new(
                            egui::RichText::new(label)
                                .size(10.0)
                                .extra_letter_spacing(1.0)
                                .color(theme::text_secondary()),
                        )
                        .id_salt(label)
                        .open(
                            if route_changed && items.iter().any(|(page, _, _)| page == current) {
                                Some(true)
                            } else {
                                None
                            },
                        )
                        .default_open(items.iter().any(|(page, _, _)| page == current))
                        .show(ui, |ui| {
                            for (page, icon, label) in items {
                                if Self::nav_item(ui, icon, label, current == &page) {
                                    selected = Some(page);
                                }
                            }
                        });
                    });
                }
                ui.add_space(18.0);
                if Self::ai_status_item(ui, current == &Page::AI, ai_ready, voice_active) {
                    selected = Some(Page::AI);
                }
                ui.add_space(12.0);
                if Self::nav_item(
                    ui,
                    icons::SETTINGS,
                    "Paramètres",
                    current == &Page::Settings,
                ) {
                    selected = Some(Page::Settings);
                }
                if let Some(org) = organization {
                    ui.add_space(18.0);
                    ui.horizontal_wrapped(|ui| {
                        ui.add_space(18.0);
                        ui.label(
                            egui::RichText::new(org)
                                .font(theme::font_small())
                                .color(theme::text_secondary()),
                        );
                    });
                }
            });

        selected
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
            theme::ACCENT.linear_multiply(theme::OPACITY_MUTED)
        } else {
            egui::Color32::TRANSPARENT
        };

        let (rect, response) = ui.allocate_exact_size(
            Vec2::new(
                ui.available_width().min(theme::SIDEBAR_WIDTH),
                theme::NAV_ITEM_HEIGHT,
            ),
            egui::Sense::click(),
        );

        response.widget_info(|| {
            egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), label)
        });

        if ui.is_rect_visible(rect) {
            // Background tint on hover or active
            if is_current || response.hovered() {
                let fill = if is_current {
                    bg_fill
                } else {
                    theme::ACCENT.linear_multiply(theme::OPACITY_TINT)
                };

                let rect_shrunk =
                    rect.shrink2(Vec2::new(theme::NAV_ITEM_INSET_H, theme::NAV_ITEM_INSET_V));

                ui.painter().rect(
                    rect_shrunk,
                    CornerRadius::same(theme::BUTTON_ROUNDING),
                    fill,
                    egui::Stroke::NONE,
                    egui::epaint::StrokeKind::Inside,
                );

                // Active indicator bar (left accent strip)
                if is_current {
                    let bar_rect = egui::Rect::from_min_size(
                        egui::pos2(rect_shrunk.left(), rect_shrunk.top() + 6.0),
                        egui::vec2(theme::ACCENT_BAR_WIDTH, rect_shrunk.height() - 12.0),
                    );
                    ui.painter().rect_filled(
                        bar_rect,
                        CornerRadius::same(theme::ROUNDING_XS),
                        theme::accent_text(),
                    );
                }
            }

            // Icon and label - centered vertically with proper alignment
            let icon_x = rect.left() + theme::SPACE_LG;
            let icon_center_y = rect.center().y;
            ui.painter().text(
                egui::pos2(icon_x, icon_center_y),
                egui::Align2::LEFT_CENTER,
                icon,
                theme::font_heading(),
                if is_current {
                    theme::accent_text()
                } else {
                    theme::text_secondary()
                },
            );

            let label_x = icon_x + theme::ICON_MD + theme::SPACE_SM;
            ui.painter().text(
                egui::pos2(label_x, icon_center_y),
                egui::Align2::LEFT_CENTER,
                label,
                theme::font_body(),
                text_color,
            );

            // Focus ring for keyboard navigation
            if response.has_focus() {
                let rect_shrunk =
                    rect.shrink2(Vec2::new(theme::NAV_ITEM_INSET_H, theme::NAV_ITEM_INSET_V));
                ui.painter().rect_stroke(
                    rect_shrunk.expand(1.0),
                    egui::CornerRadius::same(theme::BUTTON_ROUNDING),
                    theme::focus_ring(),
                    egui::epaint::StrokeKind::Outside,
                );
            }

            // Badge (soft tinted pill)
            if let Some(count) = badge
                && count > 0
            {
                let badge_text = if count > 9 {
                    "9+".to_string()
                } else {
                    count.to_string()
                };
                let badge_center = rect.right_center() + Vec2::new(-theme::NAV_BADGE_OFFSET, 0.0);
                let badge_rect = egui::Rect::from_center_size(
                    badge_center,
                    Vec2::new(theme::NAV_BADGE_WIDTH, theme::NAV_BADGE_HEIGHT),
                );
                let rounding = CornerRadius::same(theme::BUTTON_ROUNDING);
                ui.painter()
                    .rect_filled(badge_rect, rounding, theme::badge_bg(theme::ERROR));
                ui.painter().rect_stroke(
                    badge_rect,
                    rounding,
                    egui::Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(theme::ERROR)),
                    egui::StrokeKind::Inside,
                );
                ui.painter().text(
                    badge_center,
                    egui::Align2::CENTER_CENTER,
                    &badge_text,
                    theme::font_label(),
                    theme::badge_text(theme::ERROR),
                );
            }
        }

        if response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        response.clicked()
    }

    /// Compact AI model status indicator.
    ///
    /// Shows a brain icon + "IA" label with a colored status dot and short
    /// text ("Actif" / "Inactif"). Clicking navigates to the AI page.
    fn ai_status_item(ui: &mut Ui, is_current: bool, ai_ready: bool, voice_active: bool) -> bool {
        let (status_label, dot_color) = if voice_active {
            ("Jarvis Écoute", theme::ACCENT)
        } else if ai_ready {
            ("IA Prête", theme::SUCCESS)
        } else {
            ("IA Inactive", theme::text_tertiary())
        };

        let text_color = if is_current {
            theme::text_primary()
        } else {
            theme::text_secondary()
        };

        let bg_fill = if is_current {
            theme::ACCENT.linear_multiply(theme::OPACITY_MUTED)
        } else {
            egui::Color32::TRANSPARENT
        };

        let (rect, response) = ui.allocate_exact_size(
            Vec2::new(
                ui.available_width().min(theme::SIDEBAR_WIDTH),
                theme::NAV_ITEM_HEIGHT,
            ),
            egui::Sense::click(),
        );

        if ui.is_rect_visible(rect) {
            // Background tint on hover or active
            if is_current || response.hovered() {
                let fill = if is_current {
                    bg_fill
                } else {
                    theme::ACCENT.linear_multiply(theme::OPACITY_TINT)
                };
                let rect_shrunk =
                    rect.shrink2(Vec2::new(theme::NAV_ITEM_INSET_H, theme::NAV_ITEM_INSET_V));
                ui.painter().rect(
                    rect_shrunk,
                    CornerRadius::same(theme::BUTTON_ROUNDING),
                    fill,
                    egui::Stroke::NONE,
                    egui::epaint::StrokeKind::Inside,
                );

                // Active indicator bar
                if is_current {
                    let bar_rect = egui::Rect::from_min_size(
                        egui::pos2(rect_shrunk.left(), rect_shrunk.top() + 6.0),
                        egui::vec2(theme::ACCENT_BAR_WIDTH, rect_shrunk.height() - 12.0),
                    );
                    ui.painter().rect_filled(
                        bar_rect,
                        CornerRadius::same(theme::ROUNDING_XS),
                        theme::accent_text(),
                    );
                }
            }

            // Brain icon
            let icon_x = rect.left() + theme::SPACE_LG;
            let icon_center_y = rect.center().y;
            ui.painter().text(
                egui::pos2(icon_x, icon_center_y),
                egui::Align2::LEFT_CENTER,
                icons::BRAIN,
                theme::font_heading(),
                if is_current {
                    theme::accent_text()
                } else {
                    theme::text_secondary()
                },
            );

            // "IA" label
            let label_x = icon_x + theme::ICON_MD + theme::SPACE_SM;
            ui.painter().text(
                egui::pos2(label_x, icon_center_y),
                egui::Align2::LEFT_CENTER,
                "IA",
                theme::font_body(),
                text_color,
            );

            // Status dot + status text on the right side
            let status_text_galley = ui.painter().layout_no_wrap(
                status_label.to_string(),
                theme::font_small(),
                dot_color,
            );
            let status_text_w = status_text_galley.size().x;
            let dot_radius = theme::STATUS_DOT_SIZE / 2.0;
            let right_margin = theme::SPACE_MD;
            let gap = theme::SPACE_XS;

            // Position: [...dot gap text right_margin]
            let text_right = rect.right() - right_margin;
            let text_left = text_right - status_text_w;
            let dot_cx = text_left - gap - dot_radius;

            // Draw dot (with Pulse if listening)
            if voice_active && !theme::is_reduced_motion() {
                let pulse_t = ui.input(|i| i.time);
                let pulse_alpha = ((pulse_t * 5.0).sin() * 0.5 + 0.5) as f32;
                ui.painter().circle_filled(
                    egui::pos2(dot_cx, icon_center_y),
                    dot_radius * (1.0 + pulse_alpha * 0.5),
                    dot_color.linear_multiply(pulse_alpha * 0.3),
                );
                ui.ctx().request_repaint();
            }

            ui.painter()
                .circle_filled(egui::pos2(dot_cx, icon_center_y), dot_radius, dot_color);

            // Draw status text
            ui.painter().text(
                egui::pos2(text_left, icon_center_y),
                egui::Align2::LEFT_CENTER,
                status_label,
                theme::font_small(),
                dot_color,
            );

            // Focus ring for keyboard navigation
            if response.has_focus() {
                let rect_shrunk =
                    rect.shrink2(Vec2::new(theme::NAV_ITEM_INSET_H, theme::NAV_ITEM_INSET_V));
                ui.painter().rect_stroke(
                    rect_shrunk.expand(1.0),
                    egui::CornerRadius::same(theme::BUTTON_ROUNDING),
                    theme::focus_ring(),
                    egui::epaint::StrokeKind::Outside,
                );
            }
        }

        if response.hovered() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }

        response.clicked()
    }

    /// Premium sync status indicator with animated dot, label, and relative timestamp.
    fn sync_indicator(ui: &mut Ui, state: &SidebarSyncState) {
        let now = Utc::now();
        let t = ui.input(|i| i.time);

        // Determine visual state
        let (dot_color, label, pulse_speed): (egui::Color32, String, f64) = if state.syncing {
            (theme::ACCENT, "Synchronisation...".to_string(), 3.0)
        } else if state.error.is_some() {
            (theme::ERROR, "Erreur sync".to_string(), 0.0)
        } else if let Some(last) = state.last_sync_at {
            let age_secs = (now - last).num_seconds();
            if age_secs < 120 {
                // If we have pending items, show that instead of a generic "Synchronisé"
                if state.pending_count > 0 {
                    (
                        theme::ACCENT,
                        format!("{} en attente", state.pending_count),
                        2.0,
                    )
                } else {
                    (theme::SUCCESS, "Synchronis\u{00e9}".to_string(), 1.0)
                }
            } else {
                (theme::WARNING, "En attente".to_string(), 0.0)
            }
        } else {
            (
                theme::text_tertiary(),
                "Non synchronis\u{00e9}".to_string(),
                0.0,
            )
        };

        // Pulse animation (cosine ease) — respects reduced motion
        let alpha = if pulse_speed > 0.0 && !theme::is_reduced_motion() {
            0.5 + 0.5 * (t * pulse_speed * std::f64::consts::TAU).cos() as f32
        } else {
            1.0
        };

        // Row 1: dot + label
        let row_response = ui.horizontal(|ui: &mut egui::Ui| {
            ui.add_space(theme::SPACE_MD + theme::SPACE_SM);
            // Animated dot
            let (dot_rect, _) =
                ui.allocate_exact_size(Vec2::splat(theme::STATUS_DOT_SIZE), egui::Sense::empty());
            ui.painter().circle_filled(
                dot_rect.center(),
                theme::STATUS_DOT_SIZE / 2.0,
                dot_color.linear_multiply(alpha),
            );
            // Subtle glow on synced/syncing
            if pulse_speed > 0.0 {
                ui.painter().circle_filled(
                    dot_rect.center(),
                    6.0,
                    dot_color.linear_multiply(alpha * theme::OPACITY_TINT),
                );
            }
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(&label)
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
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.add_space(
                    theme::SPACE_MD + theme::SPACE_SM + theme::STATUS_DOT_SIZE + theme::SPACE_XS,
                );
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
        if secs < 120 {
            "\u{00e0} l'instant".into()
        } else if secs < 3600 {
            format!("il y a {} min", secs / 60)
        } else if secs < agent_common::constants::SECS_PER_DAY as i64 {
            format!("il y a {} h", secs / 3600)
        } else {
            format!(
                "il y a {} j",
                secs / agent_common::constants::SECS_PER_DAY as i64
            )
        }
    }
}
