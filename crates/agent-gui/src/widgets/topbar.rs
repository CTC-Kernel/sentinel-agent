// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Global top bar.
//!
//! One strip carries the whole application chrome: brand, sidebar toggle,
//! current location, global search, agent health, and the primary action.
//! Its leading segment is painted in the sidebar's surface so the two form a
//! continuous "L" of chrome around the content.
//!
//! Everything is laid out from explicit rects rather than nested egui layouts:
//! the search field has to stay optically centred while the trailing cluster
//! grows and shrinks, which right-to-left layouts cannot express.

use egui::{Align2, Color32, CornerRadius, Rect, Sense, Stroke, Ui, Vec2, pos2, vec2};

use crate::icons;
use crate::theme;

/// What the top bar renders this frame.
pub struct TopBarContext<'a> {
    /// Icon of the current page.
    pub page_icon: &'a str,
    /// Label of the current page.
    pub page_label: &'a str,
    /// Section the current page belongs to, shown as a breadcrumb parent.
    pub page_section: Option<&'a str>,
    /// Tenant name.
    pub organization: Option<&'a str>,
    /// Unread notification count.
    pub unread: u32,
    /// A platform sync is running.
    pub syncing: bool,
    /// A compliance scan is running.
    pub scanning: bool,
    /// Dark theme is active.
    pub dark_mode: bool,
    /// Sidebar is collapsed to a rail.
    pub sidebar_collapsed: bool,
    /// Width of the sidebar right now, so the brand segment lines up with it.
    pub sidebar_width: f32,
}

/// Something the operator asked for from the top bar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TopBarAction {
    /// Collapse or expand the navigation sidebar.
    ToggleSidebar,
    /// Open the ⌘K command palette.
    OpenPalette,
    /// Run a compliance scan now.
    RunCheck,
    /// Force a platform sync now.
    ForceSync,
    /// Switch between the light and dark themes.
    ToggleTheme,
    /// Go to the notifications page.
    OpenNotifications,
    /// Go to the assistant page.
    OpenAssistant,
}

/// Height of an interactive control inside the bar.
const CONTROL_H: f32 = 34.0;
/// Square hit area of an icon button.
const ICON_BTN: f32 = 34.0;
/// Preferred width of the search field.
const SEARCH_W: f32 = 380.0;
/// Width below which the search field collapses to an icon.
const SEARCH_MIN_W: f32 = 150.0;

/// Render the top bar and return the action the operator triggered, if any.
pub fn top_bar(ctx: &egui::Context, cx: &TopBarContext<'_>) -> Option<TopBarAction> {
    let mut action = None;

    egui::TopBottomPanel::top("global_top_bar")
        .exact_height(theme::TOPBAR_HEIGHT)
        .frame(
            egui::Frame::new()
                .fill(theme::bg_secondary())
                .inner_margin(egui::Margin::ZERO),
        )
        .show(ctx, |ui: &mut Ui| {
            let rect = ui.max_rect();

            // Brand segment shares the sidebar's surface, so chrome reads as
            // one continuous shape instead of two stacked bars.
            let brand = Rect::from_min_size(rect.min, vec2(cx.sidebar_width, rect.height()));
            ui.painter()
                .rect_filled(brand, CornerRadius::ZERO, theme::bg_sidebar());
            ui.painter().vline(
                brand.right() - 0.5,
                rect.y_range(),
                Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            );
            ui.painter().hline(
                rect.x_range(),
                rect.bottom() - 0.5,
                Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            );

            if let Some(a) = brand_segment(ui, brand, cx) {
                action = Some(a);
            }

            let content = Rect::from_min_max(
                pos2(brand.right() + theme::SPACE, rect.top()),
                pos2(rect.right() - theme::SPACE, rect.bottom()),
            );

            // Trailing cluster first: it claims the space it needs, and the
            // location + search then share what is left. It is told what the
            // page title needs, so on a small window the workspace chip
            // yields before the title does — "Men" is not a page name.
            let min_search = ICON_BTN + theme::SPACE_LG + theme::SPACE_MD;
            let title_w = location_width(ui, cx, false);
            let (trailing_left, trailing_action) =
                trailing_cluster(ui, content, cx, title_w + min_search);
            if trailing_action.is_some() {
                action = trailing_action;
            }

            let available = Rect::from_min_max(content.min, pos2(trailing_left, content.bottom()));
            let show_parent = location_width(ui, cx, true) + min_search <= available.width();
            let location_w = location_width(ui, cx, show_parent);
            let location = Rect::from_min_size(
                available.min,
                vec2(location_w.min(available.width()), available.height()),
            );
            location_segment(ui, location, cx, show_parent);

            let search_left = location.right() + theme::SPACE_LG;
            let search_room = available.right() - search_left - theme::SPACE_MD;
            if search_room >= SEARCH_MIN_W {
                let width = search_room.min(SEARCH_W);
                let search = Rect::from_center_size(
                    pos2(search_left + width / 2.0, available.center().y),
                    vec2(width, CONTROL_H),
                );
                if search_field(ui, search) {
                    action = Some(TopBarAction::OpenPalette);
                }
            } else if search_room >= ICON_BTN {
                let btn = Rect::from_center_size(
                    pos2(search_left + ICON_BTN / 2.0, available.center().y),
                    Vec2::splat(ICON_BTN),
                );
                if icon_button(ui, btn, icons::SEARCH, "Rechercher", false).clicked() {
                    action = Some(TopBarAction::OpenPalette);
                }
            }
        });

    action
}

/// Sidebar toggle, product mark and wordmark.
fn brand_segment(ui: &mut Ui, rect: Rect, cx: &TopBarContext<'_>) -> Option<TopBarAction> {
    let mut action = None;
    let center_y = rect.center().y;

    let toggle = Rect::from_center_size(
        pos2(rect.left() + theme::SPACE_MD + ICON_BTN / 2.0, center_y),
        Vec2::splat(ICON_BTN),
    );
    let tooltip = if cx.sidebar_collapsed {
        "Déployer la navigation"
    } else {
        "Réduire la navigation"
    };
    if icon_button(ui, toggle, icons::BARS, tooltip, false).clicked() {
        action = Some(TopBarAction::ToggleSidebar);
    }

    // The wordmark is the first thing clipped when the rail is narrow.
    let mark_x = toggle.right() + theme::SPACE_SM;
    let room = rect.right() - mark_x - theme::SPACE_SM;
    if room < 70.0 {
        return action;
    }

    let logo = Rect::from_center_size(pos2(mark_x + 13.0, center_y), Vec2::splat(26.0));
    egui::Image::from_bytes("bytes://ia_brand", include_bytes!("../../assets/IA.png"))
        .corner_radius(CornerRadius::same(theme::ROUNDING_SM))
        .paint_at(ui, logo);

    let text_x = logo.right() + theme::SPACE_SM;
    ui.painter().text(
        pos2(text_x, center_y - 7.0),
        Align2::LEFT_CENTER,
        "SENTINEL",
        theme::font_body_strong(),
        theme::text_primary(),
    );
    ui.painter().text(
        pos2(text_x, center_y + 7.0),
        Align2::LEFT_CENTER,
        "GRC AGENT",
        theme::font_micro(),
        theme::text_tertiary(),
    );

    action
}

/// Width the location breadcrumb wants, so the search field can be placed after it.
fn location_width(ui: &Ui, cx: &TopBarContext<'_>, with_parent: bool) -> f32 {
    let title = ui.painter().layout_no_wrap(
        cx.page_label.to_owned(),
        theme::font_h3(),
        theme::text_primary(),
    );
    let parent = cx
        .page_section
        .filter(|_| with_parent)
        .map_or(0.0, |section| {
            ui.painter()
                .layout_no_wrap(
                    section.to_owned(),
                    theme::font_body(),
                    theme::text_tertiary(),
                )
                .size()
                .x
                + theme::SPACE_MD
        });
    theme::ICON_SM + theme::SPACE_SM + parent + title.size().x + theme::SPACE_SM
}

/// Current location: section › page.
fn location_segment(ui: &mut Ui, rect: Rect, cx: &TopBarContext<'_>, with_parent: bool) {
    let painter = ui.painter().with_clip_rect(rect);
    let center_y = rect.center().y;
    let mut x = rect.left();

    painter.text(
        pos2(x, center_y),
        Align2::LEFT_CENTER,
        cx.page_icon,
        theme::font_icon(theme::ICON_SM),
        theme::accent_text(),
    );
    x += theme::ICON_SM + theme::SPACE_SM;

    if let Some(section) = cx.page_section.filter(|_| with_parent) {
        let galley = painter.layout_no_wrap(
            section.to_owned(),
            theme::font_body(),
            theme::text_tertiary(),
        );
        painter.galley(
            pos2(x, center_y - galley.size().y / 2.0),
            galley.clone(),
            theme::text_tertiary(),
        );
        x += galley.size().x + theme::SPACE_SM;
        painter.text(
            pos2(x, center_y),
            Align2::LEFT_CENTER,
            "/",
            theme::font_body(),
            theme::text_tertiary(),
        );
        x += theme::SPACE_SM + 3.0;
    }

    painter.text(
        pos2(x, center_y),
        Align2::LEFT_CENTER,
        cx.page_label,
        theme::font_h3(),
        theme::text_primary(),
    );
}

/// Search affordance that opens the command palette.
///
/// Shaped like an input rather than a button: operators reach for a search
/// box, and the keyboard hint tells them they never have to click it.
fn search_field(ui: &mut Ui, rect: Rect) -> bool {
    let response = ui.interact(rect, ui.id().with("topbar_search"), Sense::click());
    let hovered = response.hovered();
    let painter = ui.painter();
    let radius = CornerRadius::same(theme::ROUNDING_MD);

    painter.rect_filled(rect, radius, theme::bg_tertiary());
    painter.rect_stroke(
        rect,
        radius,
        Stroke::new(
            theme::BORDER_HAIRLINE,
            if hovered {
                theme::border()
            } else {
                theme::border_subtle()
            },
        ),
        egui::epaint::StrokeKind::Inside,
    );

    let center_y = rect.center().y;
    painter.text(
        pos2(rect.left() + theme::SPACE_MD, center_y),
        Align2::LEFT_CENTER,
        icons::SEARCH,
        theme::font_icon(theme::ICON_XS),
        theme::text_tertiary(),
    );

    // Chip first: the placeholder is clipped to whatever room it leaves, so
    // the two can never overlap at any bar width.
    let chip = kbd_hint(
        ui,
        pos2(rect.right() - theme::SPACE_SM, center_y),
        &palette_shortcut(),
    );
    let text_left = rect.left() + theme::SPACE_MD + 20.0;
    let room = chip.left() - theme::SPACE_SM - text_left;
    // Prefer the sentence that says what search does; fall back to the short
    // form rather than letting the long one be cut mid-word.
    let placeholder = ["Rechercher une page ou une action…", "Rechercher…"]
        .into_iter()
        .find(|text| {
            painter
                .layout_no_wrap(
                    (*text).to_owned(),
                    theme::font_body(),
                    theme::text_tertiary(),
                )
                .size()
                .x
                <= room
        });
    if let Some(placeholder) = placeholder {
        painter.text(
            pos2(text_left, center_y),
            Align2::LEFT_CENTER,
            placeholder,
            theme::font_body(),
            theme::text_tertiary(),
        );
    }

    if hovered {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response.clicked()
}

/// Right-aligned keyboard hint chip. Returns the rect it occupied.
fn kbd_hint(ui: &Ui, right_center: egui::Pos2, label: &str) -> Rect {
    let painter = ui.painter();
    let galley = painter.layout_no_wrap(
        label.to_owned(),
        theme::font_micro(),
        theme::text_tertiary(),
    );
    let rect = Rect::from_min_size(
        pos2(
            right_center.x - galley.size().x - theme::SPACE_SM,
            right_center.y - 9.0,
        ),
        vec2(galley.size().x + theme::SPACE_SM, 18.0),
    );
    painter.rect_filled(
        rect,
        CornerRadius::same(theme::ROUNDING_SM),
        theme::overlay_color().linear_multiply(0.06),
    );
    painter.galley(
        pos2(
            rect.center().x - galley.size().x / 2.0,
            rect.center().y - galley.size().y / 2.0,
        ),
        galley,
        theme::text_tertiary(),
    );
    rect
}

/// The platform's palette shortcut, spelled the way that platform spells it.
fn palette_shortcut() -> String {
    shortcut_label(false, "K")
}

/// Spell a Command/Ctrl shortcut the way the platform does: `⌘K` on macOS,
/// `Ctrl K` elsewhere, with `⇧` / `Maj` when Shift is part of it.
///
/// One helper, used by the top bar, the sidebar tooltips and the command
/// palette, so a Windows operator is never told to press a key that does
/// not exist on their keyboard.
pub fn shortcut_label(shift: bool, key: &str) -> String {
    if cfg!(target_os = "macos") {
        format!("\u{2318}{}{key}", if shift { "\u{21e7}" } else { "" })
    } else {
        format!("Ctrl {}{key}", if shift { "Maj " } else { "" })
    }
}

/// Trailing cluster, laid out right to left. Returns its left edge and any action.
fn trailing_cluster(
    ui: &mut Ui,
    content: Rect,
    cx: &TopBarContext<'_>,
    reserve_left: f32,
) -> (f32, Option<TopBarAction>) {
    let mut action = None;
    let center_y = content.center().y;
    let mut x = content.right();

    // Primary action — the one thing an operator does most from any page.
    let run_label = if cx.scanning {
        "Analyse en cours…"
    } else {
        "Lancer l'analyse"
    };
    let run_w = ui
        .painter()
        .layout_no_wrap(
            run_label.to_owned(),
            theme::font_body_strong(),
            theme::text_on_accent(),
        )
        .size()
        .x
        + theme::SPACE_LG
        + theme::ICON_XS;
    let run_rect = Rect::from_min_size(
        pos2(x - run_w, center_y - CONTROL_H / 2.0),
        vec2(run_w, CONTROL_H),
    );
    if primary_action(ui, run_rect, run_label, cx.scanning) {
        action = Some(TopBarAction::RunCheck);
    }
    x = run_rect.left() - theme::SPACE_MD;

    // Icon cluster.
    for (icon, tooltip, act, badge, spinning) in [
        (
            if cx.dark_mode {
                icons::SUN
            } else {
                icons::MOON
            },
            "Basculer le thème clair / sombre",
            TopBarAction::ToggleTheme,
            false,
            false,
        ),
        (
            icons::BRAIN,
            "Assistant IA",
            TopBarAction::OpenAssistant,
            false,
            false,
        ),
        (
            icons::BELL,
            "Notifications",
            TopBarAction::OpenNotifications,
            cx.unread > 0,
            false,
        ),
        (
            icons::SYNC,
            if cx.syncing {
                "Synchronisation en cours"
            } else {
                "Synchroniser maintenant"
            },
            TopBarAction::ForceSync,
            false,
            cx.syncing,
        ),
    ] {
        let rect =
            Rect::from_center_size(pos2(x - ICON_BTN / 2.0, center_y), Vec2::splat(ICON_BTN));
        let response = icon_button(ui, rect, icon, tooltip, spinning);
        if response.clicked() {
            action = Some(act);
        }
        if badge {
            let label = if cx.unread > 99 {
                "99+".to_string()
            } else {
                cx.unread.to_string()
            };
            let w = (label.len() as f32 * 6.0 + 8.0).max(14.0);
            let pill = Rect::from_center_size(
                pos2(rect.center().x + 9.0, rect.center().y - 8.0),
                vec2(w, 14.0),
            );
            ui.painter().rect_filled(
                pill,
                CornerRadius::same(theme::BADGE_ROUNDING),
                theme::readable_color(theme::ERROR),
            );
            ui.painter().text(
                pill.center(),
                Align2::CENTER_CENTER,
                &label,
                theme::font_micro(),
                theme::text_on_color(theme::readable_color(theme::ERROR)),
            );
        }
        x = rect.left() - theme::SPACE_XS;
    }

    // Workspace chip — context, not a control.
    if let Some(org) = cx.organization {
        x -= theme::SPACE_SM;
        let galley = ui.painter().layout_no_wrap(
            org.to_owned(),
            theme::font_body_sm_medium(),
            theme::text_secondary(),
        );
        let w = galley.size().x + theme::ICON_XS + theme::SPACE_MD + theme::SPACE_SM;
        let chip = Rect::from_min_size(
            pos2(x - w, center_y - CONTROL_H / 2.0 + 3.0),
            vec2(w, CONTROL_H - 6.0),
        );
        if chip.left() > content.left() + reserve_left {
            ui.painter().rect_filled(
                chip,
                CornerRadius::same(theme::ROUNDING_SM),
                theme::bg_tertiary(),
            );
            ui.painter().text(
                pos2(chip.left() + theme::SPACE_SM, chip.center().y),
                Align2::LEFT_CENTER,
                icons::BUILDING,
                theme::font_icon(theme::ICON_XS),
                theme::text_tertiary(),
            );
            ui.painter().galley(
                pos2(
                    chip.left() + theme::SPACE_SM + theme::ICON_XS + theme::SPACE_XS,
                    chip.center().y - galley.size().y / 2.0,
                ),
                galley,
                theme::text_secondary(),
            );
            ui.interact(chip, ui.id().with("topbar_org"), Sense::hover())
                .on_hover_text(format!("Workspace actif : {org}"));
            x = chip.left() - theme::SPACE_MD;
        }
    }

    (x, action)
}

/// Square icon button with a hover pill and a tooltip.
fn icon_button(
    ui: &mut Ui,
    rect: Rect,
    icon: &str,
    tooltip: &str,
    spinning: bool,
) -> egui::Response {
    let response = ui
        .interact(rect, ui.id().with(("topbar_icon", tooltip)), Sense::click())
        .on_hover_text(tooltip);
    let hovered = response.hovered();
    let painter = ui.painter();

    if hovered || response.is_pointer_button_down_on() {
        painter.rect_filled(
            rect,
            CornerRadius::same(theme::ROUNDING_MD),
            if response.is_pointer_button_down_on() {
                theme::active_bg()
            } else {
                theme::hover_bg_neutral()
            },
        );
    }
    if response.has_focus() {
        painter.rect_stroke(
            rect,
            CornerRadius::same(theme::ROUNDING_MD),
            theme::focus_ring(),
            egui::epaint::StrokeKind::Outside,
        );
    }

    let color = if hovered {
        theme::text_primary()
    } else {
        theme::text_secondary()
    };

    if spinning && !theme::is_reduced_motion() {
        // Rotating the glyph itself is not possible without a mesh, so the
        // running state is shown as a soft accent pulse behind it instead.
        let t = ui.input(|i| i.time);
        let pulse = ((t * theme::ANIM_SPINNER_SPEED).sin() * 0.5 + 0.5) as f32;
        painter.circle_filled(
            rect.center(),
            ICON_BTN / 2.0 - 4.0,
            theme::ACCENT.linear_multiply(0.10 + pulse * 0.18),
        );
        ui.ctx().request_repaint();
    }

    painter.text(
        rect.center(),
        Align2::CENTER_CENTER,
        icon,
        theme::font_icon(theme::ICON_SM),
        if spinning {
            theme::accent_text()
        } else {
            color
        },
    );

    if hovered {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response
}

/// Accent-filled primary action.
fn primary_action(ui: &mut Ui, rect: Rect, label: &str, busy: bool) -> bool {
    let response = ui.interact(rect, ui.id().with("topbar_primary"), Sense::click());
    let hovered = response.hovered();
    let radius = CornerRadius::same(theme::BUTTON_ROUNDING);

    let fill = if busy {
        theme::ACCENT.linear_multiply(theme::OPACITY_PRESSED)
    } else if response.is_pointer_button_down_on() {
        theme::ACCENT_PRESSED
    } else if hovered {
        theme::ACCENT_HOVER
    } else {
        theme::ACCENT
    };

    if !busy {
        theme::paint_elevation(
            ui.painter(),
            rect,
            radius,
            theme::Elevation::Level1,
            if hovered { 1.0 } else { 0.6 },
        );
    }
    ui.painter().rect_filled(rect, radius, fill);
    if response.has_focus() {
        ui.painter().rect_stroke(
            rect.expand(2.0),
            radius,
            theme::focus_ring(),
            egui::epaint::StrokeKind::Outside,
        );
    }

    let center_y = rect.center().y;
    let icon_x = rect.left() + theme::SPACE_MD;
    ui.painter().text(
        pos2(icon_x, center_y),
        Align2::LEFT_CENTER,
        if busy { icons::SPINNER } else { icons::PLAY },
        theme::font_icon(theme::ICON_XS),
        Color32::WHITE,
    );
    ui.painter().text(
        pos2(icon_x + theme::ICON_XS + theme::SPACE_XS, center_y),
        Align2::LEFT_CENTER,
        label,
        theme::font_body_strong(),
        theme::text_on_accent(),
    );

    if hovered && !busy {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    response.clicked() && !busy
}
