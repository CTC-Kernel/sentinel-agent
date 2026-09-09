// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Navigation sidebar.
//!
//! Two shapes, one component: a labelled column at `SIDEBAR_WIDTH`, and an
//! icon rail at `SIDEBAR_RAIL_WIDTH` for operators who want the screen back.
//! Both share the same rows, the same active treatment, and the same footer,
//! so collapsing changes the density and nothing else.
//!
//! Brand marks live in the top bar, not here — repeating them above the
//! navigation cost ~190px of vertical space and pushed half the sections
//! below the fold on a laptop.

use chrono::{DateTime, Utc};
use egui::{CornerRadius, Margin, Ui, Vec2};

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

/// Everything the sidebar renders, gathered so the call site reads as data.
pub struct SidebarContext<'a> {
    /// Page currently routed to.
    pub current: &'a Page,
    /// A compliance scan is running.
    pub scanning: bool,
    /// Unread notification count, shown as a badge.
    pub unread_notifications: u32,
    /// Platform sync state, shown in the footer.
    pub sync: &'a SidebarSyncState,
    /// Tenant name, shown in the footer.
    pub organization: Option<&'a str>,
    /// Local model is loaded and ready.
    pub ai_ready: bool,
    /// Voice assistant is listening.
    pub voice_active: bool,
    /// Render as an icon rail instead of a labelled column.
    pub collapsed: bool,
}

/// One navigation section: an uppercase eyebrow and its rows.
struct NavSection {
    label: &'static str,
    items: &'static [(Page, &'static str, &'static str)],
}

/// Navigation grouped by the operator's mental model: what is happening now,
/// then the SOC domain, then GRC, then asset posture, then tooling.
fn nav_sections() -> [NavSection; 5] {
    [
        NavSection {
            label: "VUE D'ENSEMBLE",
            items: &[
                (Page::Dashboard, icons::DASHBOARD, "Tableau de bord"),
                (Page::Monitoring, icons::CHART_LINE, "Surveillance"),
                (Page::Notifications, icons::BELL, "Notifications"),
            ],
        },
        NavSection {
            label: "D\u{00c9}TECTION & R\u{00c9}PONSE",
            items: &[
                (Page::Threats, icons::SKULL, "Menaces"),
                (
                    Page::Vulnerabilities,
                    icons::VULNERABILITIES,
                    "Vuln\u{00e9}rabilit\u{00e9}s",
                ),
                (
                    Page::FileIntegrity,
                    icons::FILE_SHIELD,
                    "Int\u{00e9}grit\u{00e9} des fichiers",
                ),
                (Page::Network, icons::NETWORK, "R\u{00e9}seau"),
            ],
        },
        NavSection {
            label: "CONFORMIT\u{00c9} & RISQUES",
            items: &[
                (Page::Compliance, icons::COMPLIANCE, "Conformit\u{00e9}"),
                (Page::Risks, icons::SCALE_BALANCED, "Risques"),
                (Page::Reports, icons::FILE_EXPORT, "Rapports"),
            ],
        },
        NavSection {
            label: "ACTIFS & INVENTAIRE",
            items: &[
                (Page::Assets, icons::BOXES_STACKED, "Inventaire"),
                (Page::Software, icons::SOFTWARE, "Logiciels & MDM"),
                (Page::Discovery, icons::DISCOVERY, "Shadow IT"),
                (Page::Cartography, icons::CARTOGRAPHY, "Cartographie"),
            ],
        },
        NavSection {
            label: "SYST\u{00c8}ME",
            items: &[
                (Page::AuditTrail, icons::CLIPBOARD, "Journal d'audit"),
                (Page::Sync, icons::SYNC, "Synchronisation"),
                (Page::Terminal, icons::TERMINAL, "Terminal"),
            ],
        },
    ]
}

/// Rows pinned to the bottom, above the workspace footer.
const FOOTER_ITEMS: &[(Page, &str, &str)] = &[
    (Page::Settings, icons::SETTINGS, "Param\u{00e8}tres"),
    (Page::About, icons::ABOUT, "\u{00c0} propos"),
];

/// Horizontal inset of a nav row from the sidebar edges.
const ROW_INSET: f32 = 8.0;
/// Left padding inside a nav row, before the icon.
const ROW_PADDING: f32 = 10.0;
/// Width reserved for the icon column, so labels align down the column.
const ICON_COLUMN: f32 = 22.0;
/// Height of the pinned footer, reserved before the scroll area is laid out:
/// a rule, two nav rows and the status strip.
const FOOTER_RESERVE: f32 = theme::BORDER_THIN
    + theme::SPACE_XS * 2.0
    + theme::NAV_ITEM_HEIGHT * 2.0
    + 2.0
    + 34.0
    + theme::SPACE_XS
    + theme::SPACE_SM;

/// Navigation sidebar.
pub struct Sidebar;

impl Sidebar {
    /// Render the sidebar. Returns the newly selected page, if any.
    pub fn show(ui: &mut Ui, ctx: &SidebarContext<'_>) -> Option<Page> {
        let mut selected: Option<Page> = None;
        let width = Self::width(ctx.collapsed);

        egui::Frame {
            fill: egui::Color32::TRANSPARENT,
            inner_margin: Margin::same(0),
            ..Default::default()
        }
        .show(ui, |ui: &mut egui::Ui| {
            ui.set_min_width(width);
            ui.set_max_width(width);
            ui.spacing_mut().item_spacing.y = 1.0;

            let full = ui.max_rect();
            let footer_top = full.bottom() - FOOTER_RESERVE;

            egui::ScrollArea::vertical()
                .auto_shrink(egui::Vec2b::new(false, false))
                .max_height((footer_top - full.top()).max(0.0))
                .show(ui, |ui: &mut egui::Ui| {
                    ui.add_space(theme::SPACE_MD);

                    for section in nav_sections() {
                        Self::section_label(ui, section.label, ctx.collapsed, width);
                        for (page, icon, label) in section.items {
                            let badge = (*page == Page::Notifications
                                && ctx.unread_notifications > 0)
                                .then_some(ctx.unread_notifications);
                            if Self::nav_row(
                                ui,
                                NavRow {
                                    icon,
                                    label,
                                    is_current: ctx.current == page,
                                    badge,
                                    trailing: None,
                                    width,
                                    collapsed: ctx.collapsed,
                                },
                            ) {
                                selected = Some(page.clone());
                            }
                        }
                        ui.add_space(theme::SPACE_MD);
                    }

                    // ── Assistant ────────────────────────────────────
                    Self::section_label(ui, "ASSISTANT", ctx.collapsed, width);
                    let (ai_label, ai_color) = Self::ai_status(ctx);
                    if Self::nav_row(
                        ui,
                        NavRow {
                            icon: icons::BRAIN,
                            label: "Assistant IA",
                            is_current: ctx.current == &Page::AI,
                            badge: None,
                            trailing: Some(TrailingDot {
                                color: ai_color,
                                label: ai_label,
                                pulsing: ctx.voice_active,
                            }),
                            width,
                            collapsed: ctx.collapsed,
                        },
                    ) {
                        selected = Some(Page::AI);
                    }

                    ui.add_space(theme::SPACE_MD);
                });

            // ── Pinned footer ────────────────────────────────────────
            let footer = egui::Rect::from_min_max(
                egui::pos2(full.left(), footer_top),
                egui::pos2(full.right(), full.bottom()),
            );
            let mut footer_ui = ui.new_child(
                egui::UiBuilder::new()
                    .max_rect(footer)
                    .layout(egui::Layout::top_down(egui::Align::Min)),
            );
            footer_ui.spacing_mut().item_spacing.y = 1.0;
            if let Some(page) = Self::footer(&mut footer_ui, ctx, width) {
                selected = Some(page);
            }
        });

        selected
    }

    /// Pixel width of the sidebar in its current shape.
    pub fn width(collapsed: bool) -> f32 {
        if collapsed {
            theme::SIDEBAR_RAIL_WIDTH
        } else {
            theme::SIDEBAR_WIDTH
        }
    }

    /// Paint the sidebar's vertical gradient and its trailing seam.
    ///
    /// Called by the shell so the gradient covers the full panel height,
    /// including the area under the scroll area.
    pub fn paint_background(ui: &Ui, rect: egui::Rect) {
        use egui::epaint::{Mesh, Vertex};
        if !ui.is_rect_visible(rect) {
            return;
        }
        let (top, bottom) = theme::sidebar_gradient();
        let mut mesh = Mesh::default();
        for (pos, color) in [
            (rect.left_top(), top),
            (rect.right_top(), top),
            (rect.right_bottom(), bottom),
            (rect.left_bottom(), bottom),
        ] {
            mesh.vertices.push(Vertex {
                pos,
                uv: Default::default(),
                color,
            });
        }
        mesh.add_triangle(0, 1, 2);
        mesh.add_triangle(2, 3, 0);
        ui.painter().add(mesh);

        ui.painter().vline(
            rect.right() - 0.5,
            rect.y_range(),
            egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
        );
    }

    /// Section eyebrow. In rail mode a short rule replaces the words, so the
    /// grouping survives the collapse.
    fn section_label(ui: &mut Ui, text: &str, collapsed: bool, width: f32) {
        ui.add_space(theme::SPACE_SM);
        if collapsed {
            let (rect, _) =
                ui.allocate_exact_size(Vec2::new(width, theme::BORDER_THIN), egui::Sense::hover());
            let rule = egui::Rect::from_min_size(
                egui::pos2(rect.left() + theme::SPACE_MD, rect.top()),
                egui::vec2(width - theme::SPACE_MD * 2.0, theme::BORDER_HAIRLINE),
            );
            ui.painter()
                .rect_filled(rule, CornerRadius::ZERO, theme::border_subtle());
        } else {
            let (rect, _) = ui.allocate_exact_size(Vec2::new(width, 16.0), egui::Sense::hover());
            ui.painter().text(
                egui::pos2(rect.left() + ROW_INSET + ROW_PADDING, rect.center().y),
                egui::Align2::LEFT_CENTER,
                text,
                theme::font_micro(),
                theme::text_tertiary(),
            );
        }
        ui.add_space(theme::SPACE_XS);
    }

    /// Everything a navigation row needs to draw itself.
    fn nav_row(ui: &mut Ui, row: NavRow<'_>) -> bool {
        let (rect, response) = ui.allocate_exact_size(
            Vec2::new(row.width, theme::NAV_ITEM_HEIGHT),
            egui::Sense::click(),
        );
        let hovered = response.hovered();

        if ui.is_rect_visible(rect) {
            let painter = ui.painter();
            let body = rect.shrink2(Vec2::new(ROW_INSET, theme::NAV_ITEM_INSET_V));
            let radius = CornerRadius::same(theme::ROUNDING_MD);

            // Surface: selected reads stronger than hover, same hue family.
            let fill = if row.is_current {
                theme::selected_bg()
            } else if hovered {
                theme::hover_bg_neutral()
            } else {
                egui::Color32::TRANSPARENT
            };
            if fill != egui::Color32::TRANSPARENT {
                painter.rect_filled(body, radius, fill);
            }

            // Active marker: a short accent bar bled off the left edge.
            if row.is_current {
                let bar = egui::Rect::from_min_size(
                    egui::pos2(rect.left(), body.center().y - 8.0),
                    egui::vec2(theme::ACCENT_BAR_WIDTH, 16.0),
                );
                painter.rect_filled(
                    bar,
                    CornerRadius {
                        nw: 0,
                        sw: 0,
                        ne: theme::ROUNDING_XS,
                        se: theme::ROUNDING_XS,
                    },
                    theme::accent_text(),
                );
            }

            let (icon_color, label_color, label_font) = if row.is_current {
                (
                    theme::accent_text(),
                    theme::text_primary(),
                    theme::font_body_strong(),
                )
            } else if hovered {
                (
                    theme::text_primary(),
                    theme::text_primary(),
                    theme::font_body(),
                )
            } else {
                (
                    theme::text_tertiary(),
                    theme::text_secondary(),
                    theme::font_body(),
                )
            };

            let center_y = rect.center().y;
            if row.collapsed {
                painter.text(
                    egui::pos2(rect.center().x, center_y),
                    egui::Align2::CENTER_CENTER,
                    row.icon,
                    theme::font_icon(theme::ICON_SM),
                    icon_color,
                );
                // Rail mode has no room for a count, so unread collapses to a dot.
                if row.badge.is_some() {
                    painter.circle_filled(
                        egui::pos2(rect.center().x + 9.0, center_y - 8.0),
                        3.5,
                        theme::ERROR,
                    );
                }
            } else {
                let icon_x = rect.left() + ROW_INSET + ROW_PADDING;
                painter.text(
                    egui::pos2(icon_x, center_y),
                    egui::Align2::LEFT_CENTER,
                    row.icon,
                    theme::font_icon(theme::ICON_SM),
                    icon_color,
                );

                let label_x = icon_x + ICON_COLUMN;
                let reserved =
                    row.trailing.as_ref().map_or(0.0, |_| 58.0) + row.badge.map_or(0.0, |_| 30.0);
                let available = (body.right() - label_x - theme::SPACE_SM - reserved).max(24.0);
                let galley =
                    painter.layout(row.label.to_owned(), label_font, label_color, f32::INFINITY);
                let truncated = galley.size().x > available;
                painter
                    .with_clip_rect(egui::Rect::from_min_size(
                        egui::pos2(label_x, rect.top()),
                        egui::vec2(available, rect.height()),
                    ))
                    .galley(
                        egui::pos2(label_x, center_y - galley.size().y / 2.0),
                        galley,
                        label_color,
                    );
                if truncated {
                    response.clone().on_hover_text(row.label);
                }

                if let Some(count) = row.badge {
                    Self::count_badge(ui, body, count);
                }
                if let Some(trailing) = &row.trailing {
                    Self::trailing_status(ui, body, trailing);
                }
            }

            if response.has_focus() {
                painter.rect_stroke(
                    body.expand(1.0),
                    radius,
                    theme::focus_ring(),
                    egui::epaint::StrokeKind::Outside,
                );
            }
        }

        if hovered {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            if row.collapsed {
                response.clone().on_hover_text(row.label);
            }
        }

        response.clicked()
    }

    /// Unread-count pill, right-aligned inside a nav row.
    fn count_badge(ui: &Ui, body: egui::Rect, count: u32) {
        let text = if count > 99 {
            "99+".to_string()
        } else {
            count.to_string()
        };
        let width = theme::NAV_BADGE_WIDTH.max(text.len() as f32 * 8.0 + 10.0);
        let rect = egui::Rect::from_center_size(
            egui::pos2(
                body.right() - width / 2.0 - theme::SPACE_SM,
                body.center().y,
            ),
            Vec2::new(width, theme::NAV_BADGE_HEIGHT),
        );
        ui.painter().rect_filled(
            rect,
            CornerRadius::same(theme::BADGE_ROUNDING),
            theme::badge_bg(theme::ERROR),
        );
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            &text,
            theme::font_micro(),
            theme::badge_text(theme::ERROR),
        );
    }

    /// Status dot plus short caption, right-aligned inside a nav row.
    fn trailing_status(ui: &Ui, body: egui::Rect, trailing: &TrailingDot) {
        let painter = ui.painter();
        let galley = painter.layout_no_wrap(
            trailing.label.to_owned(),
            theme::font_micro(),
            trailing.color,
        );
        let text_right = body.right() - theme::SPACE_SM;
        let text_left = text_right - galley.size().x;
        let dot_x = text_left - theme::SPACE_XS - theme::STATUS_DOT_SIZE / 2.0;
        let center_y = body.center().y;

        if trailing.pulsing && !theme::is_reduced_motion() {
            let t = ui.input(|i| i.time);
            let pulse = ((t * 4.0).sin() * 0.5 + 0.5) as f32;
            painter.circle_filled(
                egui::pos2(dot_x, center_y),
                theme::STATUS_DOT_SIZE / 2.0 + pulse * 3.0,
                trailing.color.linear_multiply(0.25 * (1.0 - pulse)),
            );
            ui.ctx().request_repaint();
        }
        painter.circle_filled(
            egui::pos2(dot_x, center_y),
            theme::STATUS_DOT_SIZE / 2.0 - 1.0,
            trailing.color,
        );
        painter.galley(
            egui::pos2(text_left, center_y - galley.size().y / 2.0),
            galley,
            trailing.color,
        );
    }

    /// Assistant status, reduced to a colour and three words.
    fn ai_status(ctx: &SidebarContext<'_>) -> (&'static str, egui::Color32) {
        if ctx.voice_active {
            ("Écoute", theme::readable_color(theme::ACCENT))
        } else if ctx.ai_ready {
            ("Prêt", theme::readable_color(theme::SUCCESS))
        } else {
            ("Inactif", theme::text_tertiary())
        }
    }

    /// Pinned footer: settings, about, sync health and the active workspace.
    fn footer(ui: &mut Ui, ctx: &SidebarContext<'_>, width: f32) -> Option<Page> {
        let mut selected = None;

        let (rect, _) =
            ui.allocate_exact_size(Vec2::new(width, theme::BORDER_THIN), egui::Sense::hover());
        ui.painter().rect_filled(
            egui::Rect::from_min_size(
                egui::pos2(rect.left() + ROW_INSET, rect.top()),
                egui::vec2(width - ROW_INSET * 2.0, theme::BORDER_HAIRLINE),
            ),
            CornerRadius::ZERO,
            theme::border_subtle(),
        );
        ui.add_space(theme::SPACE_XS);

        for (page, icon, label) in FOOTER_ITEMS {
            if Self::nav_row(
                ui,
                NavRow {
                    icon,
                    label,
                    is_current: ctx.current == page,
                    badge: None,
                    trailing: None,
                    width,
                    collapsed: ctx.collapsed,
                },
            ) {
                selected = Some(page.clone());
            }
        }

        ui.add_space(theme::SPACE_XS);
        Self::status_strip(ui, ctx, width);
        selected
    }

    /// One line that answers "is this agent healthy right now?".
    fn status_strip(ui: &mut Ui, ctx: &SidebarContext<'_>, width: f32) {
        let (color, label, detail) = Self::sync_summary(ctx);
        let height = if ctx.collapsed { 24.0 } else { 34.0 };
        let (rect, response) =
            ui.allocate_exact_size(Vec2::new(width, height), egui::Sense::hover());
        let painter = ui.painter();
        let center_y = rect.center().y;

        if ctx.collapsed {
            painter.circle_filled(
                egui::pos2(rect.center().x, center_y),
                theme::STATUS_DOT_SIZE / 2.0,
                color,
            );
        } else {
            let dot_x = rect.left() + ROW_INSET + ROW_PADDING + theme::STATUS_DOT_SIZE / 2.0;
            painter.circle_filled(
                egui::pos2(dot_x, rect.top() + 11.0),
                theme::STATUS_DOT_SIZE / 2.0 - 1.0,
                color,
            );
            let text_x = dot_x + theme::SPACE_SM + 2.0;
            painter.text(
                egui::pos2(text_x, rect.top() + 11.0),
                egui::Align2::LEFT_CENTER,
                label,
                theme::font_micro(),
                theme::text_secondary(),
            );
            if let Some(detail) = detail {
                painter.text(
                    egui::pos2(text_x, rect.top() + 25.0),
                    egui::Align2::LEFT_CENTER,
                    detail,
                    theme::font_micro(),
                    theme::text_tertiary(),
                );
            }
        }

        let tooltip = match (&ctx.sync.error, ctx.organization) {
            (Some(err), _) => err.clone(),
            (None, Some(org)) => format!("Workspace : {org}"),
            (None, None) => "Aucun workspace".to_string(),
        };
        response.on_hover_text(tooltip);
        ui.add_space(theme::SPACE_XS);
    }

    /// Collapse sync + scan state into a colour, a label and a detail line.
    fn sync_summary(ctx: &SidebarContext<'_>) -> (egui::Color32, String, Option<String>) {
        let now = Utc::now();
        if ctx.scanning {
            return (
                theme::readable_color(theme::ACCENT),
                "Analyse en cours".to_string(),
                None,
            );
        }
        if ctx.sync.syncing {
            return (
                theme::readable_color(theme::ACCENT),
                "Synchronisation…".to_string(),
                None,
            );
        }
        if ctx.sync.error.is_some() {
            return (
                theme::readable_color(theme::ERROR),
                "Erreur de synchro".to_string(),
                Some("Survoler pour le détail".to_string()),
            );
        }
        if ctx.sync.pending_count > 0 {
            return (
                theme::readable_color(theme::WARNING),
                format!("{} en attente", ctx.sync.pending_count),
                ctx.sync
                    .last_sync_at
                    .map(|last| Self::relative_time_fr(now, last)),
            );
        }
        match ctx.sync.last_sync_at {
            Some(last) if (now - last).num_seconds() < 900 => (
                theme::readable_color(theme::SUCCESS),
                "Synchronis\u{00e9}".to_string(),
                Some(Self::relative_time_fr(now, last)),
            ),
            Some(last) => (
                theme::readable_color(theme::WARNING),
                "Synchro ancienne".to_string(),
                Some(Self::relative_time_fr(now, last)),
            ),
            None => (
                theme::text_tertiary(),
                "Non synchronis\u{00e9}".to_string(),
                None,
            ),
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

/// Parameters of a single navigation row.
struct NavRow<'a> {
    icon: &'a str,
    label: &'a str,
    is_current: bool,
    badge: Option<u32>,
    trailing: Option<TrailingDot>,
    width: f32,
    collapsed: bool,
}

/// Status dot and caption rendered at the trailing edge of a row.
struct TrailingDot {
    color: egui::Color32,
    label: &'static str,
    pulsing: bool,
}
