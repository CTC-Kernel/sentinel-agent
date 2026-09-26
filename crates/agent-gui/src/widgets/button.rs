// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium button widgets.

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, WidgetText, epaint::StrokeKind};

use crate::animation;
use crate::theme;

/// Position content independently from the surrounding layout direction.
///
/// Buttons are frequently rendered inside right-to-left action bars. Using the
/// parent layout's alignment there made their labels drift to an edge instead
/// of remaining optically centred in the hit target.
fn centered_in(content_size: egui::Vec2, rect: egui::Rect) -> egui::Pos2 {
    rect.center() - content_size * 0.5
}

/// Button size variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ButtonSize {
    Small,
    #[default]
    Medium,
    Large,
}

/// A primary action with a high-contrast fill, elevation and animated hover.
pub fn primary_button(ui: &mut Ui, text: impl Into<WidgetText>, enabled: bool) -> Response {
    draw_premium_button(ui, text, true, enabled, false)
}

/// A primary button with loading state.
pub fn primary_button_loading(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    enabled: bool,
    loading: bool,
) -> Response {
    draw_premium_button(ui, text, true, enabled, loading)
}

/// A secondary button (outline/ghost) with premium transparent look.
pub fn secondary_button(ui: &mut Ui, text: impl Into<WidgetText>, enabled: bool) -> Response {
    draw_premium_button(ui, text, false, enabled, false)
}

/// A secondary button with loading state.
pub fn secondary_button_loading(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    enabled: bool,
    loading: bool,
) -> Response {
    draw_premium_button(ui, text, false, enabled, loading)
}

fn draw_premium_button(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    is_primary: bool,
    enabled: bool,
    loading: bool,
) -> Response {
    let text = text.into();
    // Buttons carry a heavier weight than body copy: a label is a target, and
    // at 13px the weight is what makes it read as one.
    let font = if is_primary {
        theme::font_body_strong()
    } else {
        theme::font_body_medium()
    };

    let text_galley = text.into_galley(ui, Some(egui::TextWrapMode::Extend), f32::INFINITY, font);

    // Premium sizing
    let padding = ui.spacing().button_padding;
    let mut desired_size = text_galley.size() + padding * 2.0;

    // Add space for loading spinner
    if loading {
        desired_size.x += theme::SPINNER_SIZE + theme::SPACE_SM;
    }

    // Enforce minimum premium height and width
    desired_size.y = desired_size.y.max(theme::BUTTON_HEIGHT);
    desired_size.x = desired_size.x.max(theme::BUTTON_MIN_WIDTH);

    let (rect, response) = ui.allocate_exact_size(
        desired_size,
        if enabled && !loading {
            Sense::click()
        } else {
            Sense::hover()
        },
    );

    response.widget_info(|| {
        egui::WidgetInfo::labeled(
            egui::WidgetType::Button,
            enabled && !loading && ui.is_enabled(),
            text_galley.text(),
        )
    });

    if ui.is_rect_visible(rect) {
        // State interaction
        let is_hovered = enabled && !loading && response.hovered();
        let is_clicked = enabled && !loading && response.is_pointer_button_down_on();
        let hover_t = animation::animate_hover(ui.ctx(), response.id.with("hover"), is_hovered);

        // ─── Colors ───
        let (bg_fill, bg_stroke, text_color) = if is_primary {
            // Smooth hover animation for primary button

            // Primary: Filled Accent
            let fill = if !enabled && !loading {
                theme::ACCENT.linear_multiply(theme::OPACITY_DISABLED)
            } else if is_clicked {
                theme::ACCENT_PRESSED
            } else {
                animation::lerp_color(theme::ACCENT, theme::ACCENT_HOVER, hover_t)
            };
            (
                fill,
                Stroke::NONE,
                if enabled || loading {
                    theme::text_on_accent()
                } else {
                    theme::text_on_accent().linear_multiply(theme::OPACITY_MEDIUM)
                },
            )
        } else {
            // Secondary: Bordered / Surface
            // A resting fill, not transparency: on a card surface a
            // transparent secondary button reads as a link, not a control.
            let fill = if !enabled {
                Color32::TRANSPARENT
            } else if is_clicked {
                theme::bg_elevated()
            } else {
                animation::lerp_color(theme::bg_tertiary(), theme::hover_bg_neutral(), hover_t)
            };

            let stroke = if !enabled {
                Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle())
            } else if is_hovered {
                Stroke::new(
                    theme::BORDER_THIN,
                    theme::ACCENT.linear_multiply(theme::OPACITY_MODERATE),
                )
            } else {
                Stroke::new(theme::BORDER_THIN, theme::border())
            };

            let text = if !enabled {
                theme::text_tertiary()
            } else if is_clicked || is_hovered {
                theme::text_primary()
            } else {
                theme::text_secondary()
            };

            (fill, stroke, text)
        };

        // ─── Shadows ───
        // Painted before the fill below, so the button sits on its shadow.
        if is_primary && enabled && !loading && !is_clicked {
            theme::paint_elevation(
                ui.painter(),
                rect,
                CornerRadius::same(theme::BUTTON_ROUNDING),
                theme::Elevation::Level1,
                1.0,
            );
        }

        // ─── Background Paint ───
        ui.painter().rect(
            rect,
            CornerRadius::same(theme::BUTTON_ROUNDING),
            bg_fill,
            bg_stroke,
            StrokeKind::Inside,
        );

        // A restrained top-edge reflection separates controls from flat
        // labels, while the hover halo makes the hit target easier to track
        // across dense SOC screens without moving its layout box.
        if enabled {
            let highlight = if is_primary {
                theme::text_on_accent()
            } else {
                theme::overlay_color()
            };
            ui.painter().line_segment(
                [
                    rect.left_top() + egui::vec2(f32::from(theme::BUTTON_ROUNDING), 0.5),
                    rect.right_top() + egui::vec2(-f32::from(theme::BUTTON_ROUNDING), 0.5),
                ],
                Stroke::new(
                    theme::BORDER_HAIRLINE,
                    highlight.linear_multiply(if is_primary { 0.22 } else { 0.08 }),
                ),
            );
            if hover_t > 0.0 {
                ui.painter().rect_stroke(
                    rect.expand(1.0),
                    CornerRadius::same(theme::BUTTON_ROUNDING + 1),
                    Stroke::new(
                        theme::BORDER_HAIRLINE,
                        theme::accent_text().linear_multiply(0.28 * hover_t),
                    ),
                    StrokeKind::Outside,
                );
            }
        }

        // ─── Focus Ring (WCAG 2.4.7) ───
        if response.has_focus() {
            ui.painter().rect_stroke(
                rect.expand(2.0),
                CornerRadius::same(theme::BUTTON_ROUNDING + 2),
                theme::focus_ring(),
                StrokeKind::Outside,
            );
        }

        // The solid sapphire surface supplies contrast without a second,
        // embossed border competing with the keyboard focus ring.

        // ─── Loading Spinner ───
        if loading {
            let spinner_rect = egui::Rect::from_center_size(
                rect.center() - egui::vec2((text_galley.size().x + theme::SPACE_SM) / 2.0, 0.0),
                egui::vec2(theme::SPINNER_SIZE, theme::SPINNER_SIZE),
            );

            // Draw background track circle (subtle)
            ui.painter().circle_stroke(
                spinner_rect.center(),
                theme::SPINNER_RADIUS,
                Stroke::new(
                    theme::BORDER_MEDIUM,
                    text_color.linear_multiply(theme::OPACITY_TINT),
                ),
            );

            if theme::is_reduced_motion() {
                // Static arc when reduced motion
                ui.painter().circle_stroke(
                    spinner_rect.center(),
                    theme::SPINNER_RADIUS,
                    Stroke::new(theme::BORDER_THICK, text_color),
                );
            } else {
                // Continuous rotation using real time
                let time = ui.input(|i| i.time);
                let angle = (time * std::f64::consts::TAU * theme::ANIM_SPINNER_SPEED) as f32;

                let num_segments = 12;
                let arc_length = std::f32::consts::PI * 1.5;
                for i in 0..num_segments {
                    let t0 = i as f32 / num_segments as f32;
                    let t1 = (i + 1) as f32 / num_segments as f32;
                    let segment_angle = angle + t0 * arc_length;
                    let next_angle = angle + t1 * arc_length;
                    let alpha = t1;

                    let p1 = spinner_rect.center()
                        + egui::vec2(
                            theme::SPINNER_RADIUS * segment_angle.cos(),
                            theme::SPINNER_RADIUS * segment_angle.sin(),
                        );
                    let p2 = spinner_rect.center()
                        + egui::vec2(
                            theme::SPINNER_RADIUS * next_angle.cos(),
                            theme::SPINNER_RADIUS * next_angle.sin(),
                        );

                    ui.painter().line_segment(
                        [p1, p2],
                        Stroke::new(theme::BORDER_THICK, text_color.linear_multiply(alpha)),
                    );
                }

                ui.ctx().request_repaint();
            }
        }

        // ─── Text Paint ───
        let text_pos = if loading {
            rect.center()
                + egui::vec2(
                    (theme::SPINNER_SIZE + theme::SPACE_SM - text_galley.size().x) / 2.0,
                    -text_galley.size().y / 2.0,
                )
        } else {
            centered_in(text_galley.size(), rect)
        };
        ui.painter().galley(text_pos, text_galley, text_color);
    }

    if !enabled || loading {
        response.on_hover_cursor(egui::CursorIcon::NotAllowed)
    } else {
        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    }
}

// ============================================================================
// NEW BUTTON VARIANTS
// ============================================================================

/// A destructive/danger button (red) for dangerous actions.
pub fn destructive_button(ui: &mut Ui, text: impl Into<WidgetText>, enabled: bool) -> Response {
    draw_destructive_button(ui, text, enabled, false)
}

/// A destructive button with loading state.
pub fn destructive_button_loading(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    enabled: bool,
    loading: bool,
) -> Response {
    draw_destructive_button(ui, text, enabled, loading)
}

fn draw_destructive_button(
    ui: &mut Ui,
    text: impl Into<WidgetText>,
    enabled: bool,
    loading: bool,
) -> Response {
    let text = text.into();
    let font = theme::font_body();

    let text_galley = text.into_galley(ui, Some(egui::TextWrapMode::Extend), f32::INFINITY, font);

    let padding = ui.spacing().button_padding;
    let mut desired_size = text_galley.size() + padding * 2.0;
    if loading {
        desired_size.x += theme::ICON_MD;
    }
    desired_size.y = desired_size.y.max(theme::BUTTON_HEIGHT);
    desired_size.x = desired_size.x.max(theme::BUTTON_MIN_WIDTH);

    let (rect, response) = ui.allocate_exact_size(
        desired_size,
        if enabled && !loading {
            Sense::click()
        } else {
            Sense::hover()
        },
    );

    response.widget_info(|| {
        egui::WidgetInfo::labeled(
            egui::WidgetType::Button,
            enabled && !loading && ui.is_enabled(),
            text_galley.text(),
        )
    });

    if ui.is_rect_visible(rect) {
        let is_hovered = enabled && !loading && response.hovered();
        let is_clicked = enabled && !loading && response.is_pointer_button_down_on();

        let fill = if !enabled {
            theme::ERROR.linear_multiply(theme::OPACITY_DISABLED)
        } else if is_clicked {
            theme::ERROR.linear_multiply(theme::OPACITY_PRESSED)
        } else if is_hovered {
            theme::ERROR.linear_multiply(theme::OPACITY_HOVER)
        } else {
            theme::ERROR
        };

        let text_color = if enabled {
            theme::text_on_accent()
        } else {
            theme::text_on_accent().linear_multiply(theme::OPACITY_MEDIUM)
        };

        // Shadow
        if enabled && !loading && !is_clicked {
            let shadow = theme::shadow_sm();
            ui.painter()
                .add(shadow.as_shape(rect, CornerRadius::same(theme::BUTTON_ROUNDING)));
        }

        // Background
        ui.painter().rect(
            rect,
            CornerRadius::same(theme::BUTTON_ROUNDING),
            fill,
            Stroke::NONE,
            StrokeKind::Inside,
        );

        // Focus Ring (WCAG 2.4.7)
        if response.has_focus() {
            ui.painter().rect_stroke(
                rect.expand(2.0),
                CornerRadius::same(theme::BUTTON_ROUNDING + 2),
                theme::focus_ring(),
                StrokeKind::Outside,
            );
        }

        // Loading spinner
        if loading {
            draw_spinner(ui, rect, text_galley.size(), text_color);
        }

        // Text
        let text_pos = if loading {
            centered_in(
                text_galley.size(),
                rect.shrink2(egui::vec2(theme::ICON_MD, 0.0)),
            )
        } else {
            centered_in(text_galley.size(), rect)
        };
        ui.painter().galley(text_pos, text_galley, text_color);
    }

    if !enabled || loading {
        response.on_hover_cursor(egui::CursorIcon::NotAllowed)
    } else {
        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    }
}

/// A ghost/text button (minimal styling, just text).
pub fn ghost_button(ui: &mut Ui, text: impl Into<WidgetText>) -> Response {
    let text = text.into();
    let font = theme::font_body();

    let text_galley = text.into_galley(ui, Some(egui::TextWrapMode::Extend), f32::INFINITY, font);

    let padding = egui::vec2(theme::SPACE_SM, theme::SPACE_XS);
    let desired_size = text_galley.size() + padding * 2.0;

    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    response.widget_info(|| {
        egui::WidgetInfo::labeled(
            egui::WidgetType::Button,
            ui.is_enabled(),
            text_galley.text(),
        )
    });

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();

        let text_color = if is_clicked {
            theme::accent_text()
        } else if is_hovered {
            theme::text_primary()
        } else {
            theme::text_secondary()
        };

        // Subtle background on hover
        if is_hovered {
            ui.painter().rect_filled(
                rect,
                CornerRadius::same(theme::BUTTON_ROUNDING),
                theme::hover_bg(),
            );
        }

        // Underline on hover
        if is_hovered {
            let underline_y = rect.max.y - theme::BORDER_THICK;
            ui.painter().line_segment(
                [
                    egui::pos2(rect.min.x + padding.x, underline_y),
                    egui::pos2(rect.max.x - padding.x, underline_y),
                ],
                Stroke::new(
                    theme::BORDER_THIN,
                    text_color.linear_multiply(theme::OPACITY_PRESSED),
                ),
            );
        }

        // Focus Ring (WCAG 2.4.7)
        if response.has_focus() {
            ui.painter().rect_stroke(
                rect.expand(2.0),
                CornerRadius::same(theme::ROUNDING_LG),
                theme::focus_ring(),
                StrokeKind::Outside,
            );
        }

        let text_pos = centered_in(text_galley.size(), rect);
        ui.painter().galley(text_pos, text_galley, text_color);
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

/// An icon-only button.
pub fn icon_button(ui: &mut Ui, icon: &str, tooltip: Option<&str>) -> Response {
    icon_button_with_color(ui, icon, tooltip, theme::text_secondary())
}

/// An icon-only button with custom color.
pub fn icon_button_with_color(
    ui: &mut Ui,
    icon: &str,
    tooltip: Option<&str>,
    color: Color32,
) -> Response {
    let size = theme::MIN_TOUCH_TARGET;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();
        let hover_t =
            animation::animate_hover(ui.ctx(), response.id.with("icon_hover"), is_hovered);

        let bg_color = if is_clicked {
            theme::selected_bg()
        } else {
            animation::lerp_color(Color32::TRANSPARENT, theme::hover_bg_neutral(), hover_t)
        };
        ui.painter().rect(
            rect,
            CornerRadius::same(theme::BUTTON_ROUNDING - 2),
            bg_color,
            Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::border_subtle().linear_multiply(0.35 + hover_t * 0.65),
            ),
            StrokeKind::Inside,
        );

        // Focus Ring (WCAG 2.4.7)
        if response.has_focus() {
            ui.painter().rect_stroke(
                rect.expand(2.0),
                CornerRadius::same(theme::BUTTON_ROUNDING),
                theme::focus_ring(),
                StrokeKind::Outside,
            );
        }

        // Icon
        let icon_color = if is_clicked {
            theme::accent_text()
        } else if is_hovered {
            theme::text_primary()
        } else {
            color
        };

        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_heading(),
            icon_color,
        );
    }

    let response = response.on_hover_cursor(egui::CursorIcon::PointingHand);

    if let Some(tip) = tooltip {
        response.on_hover_text(tip)
    } else {
        response
    }
}

/// A small pill/chip button (for tags, filters).
///
/// Uses the unified badge color system for consistent appearance.
pub fn chip_button(ui: &mut Ui, text: &str, active: bool, color: Color32) -> Response {
    let font = theme::font_label();
    let text_col = theme::badge_text(color);

    let galley = ui
        .painter()
        .layout_no_wrap(text.to_string(), font.clone(), text_col);

    let padding = egui::vec2(theme::SPACE_SM + theme::BORDER_THICK, theme::SPACE_XS);
    let size = galley.size() + padding * 2.0;
    let size = egui::vec2(size.x, size.y.max(theme::ICON_LG));

    let (rect, response) = ui.allocate_exact_size(size, Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();

        let (bg, stroke, fg) = if active || is_hovered {
            (
                theme::badge_bg(color),
                Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(color)),
                text_col,
            )
        } else {
            (
                Color32::TRANSPARENT,
                Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(color)),
                theme::text_tertiary(),
            )
        };

        let rounding = CornerRadius::same(theme::BADGE_ROUNDING);
        ui.painter()
            .rect(rect, rounding, bg, stroke, StrokeKind::Inside);

        ui.painter()
            .text(rect.center(), egui::Align2::CENTER_CENTER, text, font, fg);

        // Focus ring for keyboard navigation
        if response.has_focus() {
            let rounding = CornerRadius::same(theme::BADGE_ROUNDING);
            ui.painter()
                .rect_stroke(rect, rounding, theme::focus_ring(), StrokeKind::Outside);
        }
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

/// A button group (horizontal row of connected buttons).
pub fn button_group(ui: &mut Ui, options: &[&str], selected: usize) -> Option<usize> {
    let mut clicked = None;

    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 0.0;

        for (i, label) in options.iter().enumerate() {
            let is_first = i == 0;
            let is_last = i == options.len() - 1;
            let is_selected = i == selected;

            let font = theme::font_label();
            let galley = ui.painter().layout_no_wrap(
                label.to_string(),
                font.clone(),
                if is_selected {
                    theme::text_on_accent()
                } else {
                    theme::text_secondary()
                },
            );

            let padding = egui::vec2(theme::SPACE_MD, theme::SPACE_XS + 2.0);
            let size = galley.size() + padding * 2.0;
            let (rect, response) = ui.allocate_exact_size(size, Sense::click());

            if ui.is_rect_visible(rect) {
                let is_hovered = response.hovered();

                // Determine corner radius based on position
                let rounding = if is_first && is_last {
                    CornerRadius::same(theme::BUTTON_ROUNDING)
                } else if is_first {
                    CornerRadius {
                        nw: theme::BUTTON_ROUNDING,
                        sw: theme::BUTTON_ROUNDING,
                        ne: 0,
                        se: 0,
                    }
                } else if is_last {
                    CornerRadius {
                        nw: 0,
                        sw: 0,
                        ne: theme::BUTTON_ROUNDING,
                        se: theme::BUTTON_ROUNDING,
                    }
                } else {
                    CornerRadius::ZERO
                };

                let (bg, text_col) = if is_selected {
                    (theme::ACCENT, theme::text_on_accent())
                } else if is_hovered {
                    (theme::bg_elevated(), theme::text_primary())
                } else {
                    (theme::bg_tertiary(), theme::text_secondary())
                };

                ui.painter().rect(
                    rect,
                    rounding,
                    bg,
                    Stroke::new(theme::BORDER_HAIRLINE, theme::border()),
                    StrokeKind::Inside,
                );

                // Focus Ring (WCAG 2.4.7)
                if response.has_focus() {
                    ui.painter().rect_stroke(
                        rect.expand(2.0),
                        rounding,
                        theme::focus_ring(),
                        StrokeKind::Outside,
                    );
                }

                ui.painter().text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    *label,
                    font,
                    text_col,
                );
            }

            if response.hovered() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }

            if response.clicked() && !is_selected {
                clicked = Some(i);
            }
        }
    });

    clicked
}

// Helper to draw loading spinner
fn draw_spinner(ui: &Ui, rect: egui::Rect, text_size: egui::Vec2, color: Color32) {
    let spinner_rect = egui::Rect::from_center_size(
        rect.center() - egui::vec2(text_size.x / 2.0 + theme::SPACE_SM + 2.0, 0.0),
        egui::vec2(theme::SPINNER_SIZE, theme::SPINNER_SIZE),
    );

    // Background track
    ui.painter().circle_stroke(
        spinner_rect.center(),
        theme::SPINNER_RADIUS,
        Stroke::new(
            theme::BORDER_MEDIUM,
            color.linear_multiply(theme::OPACITY_TINT),
        ),
    );

    if theme::is_reduced_motion() {
        // Static circle when reduced motion
        ui.painter().circle_stroke(
            spinner_rect.center(),
            theme::SPINNER_RADIUS,
            Stroke::new(theme::BORDER_THICK, color),
        );
    } else {
        let time = ui.input(|i| i.time);
        let angle = (time * std::f64::consts::TAU * theme::ANIM_SPINNER_SPEED) as f32;

        let num_segments = 12;
        let arc_length = std::f32::consts::PI * 1.5;
        for i in 0..num_segments {
            let t0 = i as f32 / num_segments as f32;
            let t1 = (i + 1) as f32 / num_segments as f32;
            let segment_angle = angle + t0 * arc_length;
            let next_angle = angle + t1 * arc_length;
            let alpha = t1;

            let p1 = spinner_rect.center()
                + egui::vec2(
                    theme::SPINNER_RADIUS * segment_angle.cos(),
                    theme::SPINNER_RADIUS * segment_angle.sin(),
                );
            let p2 = spinner_rect.center()
                + egui::vec2(
                    theme::SPINNER_RADIUS * next_angle.cos(),
                    theme::SPINNER_RADIUS * next_angle.sin(),
                );

            ui.painter().line_segment(
                [p1, p2],
                Stroke::new(theme::BORDER_THICK, color.linear_multiply(alpha)),
            );
        }

        ui.ctx().request_repaint();
    }
}

/// Floating action button (FAB) - large circular button.
pub fn fab_button(ui: &mut Ui, icon: &str) -> Response {
    let size = theme::FAB_SIZE;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();

        let fill = if is_clicked {
            theme::ACCENT.linear_multiply(theme::OPACITY_STRONG)
        } else if is_hovered {
            theme::ACCENT_HOVER
        } else {
            theme::ACCENT
        };

        // Shadow
        if !is_clicked {
            let shadow = theme::shadow_md();
            ui.painter()
                .add(shadow.as_shape(rect, CornerRadius::same(size as u8 / 2)));
        }

        // Circle background
        ui.painter().circle_filled(rect.center(), size / 2.0, fill);

        // Focus Ring (WCAG 2.4.7)
        if response.has_focus() {
            ui.painter()
                .circle_stroke(rect.center(), size / 2.0 + 3.0, theme::focus_ring());
        }

        // Icon
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_icon(theme::ICON_LG),
            theme::text_on_accent(),
        );
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

#[cfg(test)]
mod interaction_tests {
    use super::*;

    #[test]
    fn unavailable_actions_do_not_accept_clicks_or_keyboard_focus() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let _ = ctx.run(egui::RawInput::default(), |ctx| {
            egui::CentralPanel::default().show(ctx, |ui| {
                for response in [
                    primary_button(ui, "Disabled", false),
                    primary_button_loading(ui, "Loading", true, true),
                    secondary_button(ui, "Disabled secondary", false),
                    destructive_button(ui, "Disabled destructive", false),
                    destructive_button_loading(ui, "Loading destructive", true, true),
                ] {
                    assert!(!response.sense.senses_click());
                    assert!(!response.sense.is_focusable());
                }
                assert!(primary_button(ui, "Available", true).sense.senses_click());
            });
        });
    }
    #[test]
    fn primary_action_activates_from_keyboard() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let mut id = None;
        let _ = ctx.run(egui::RawInput::default(), |ctx| {
            egui::CentralPanel::default().show(ctx, |ui| {
                id = Some(primary_button(ui, "Analyser", true).id);
            });
        });
        ctx.memory_mut(|m| m.request_focus(id.unwrap()));
        let input = egui::RawInput {
            events: vec![egui::Event::Key {
                key: egui::Key::Enter,
                physical_key: None,
                pressed: true,
                repeat: false,
                modifiers: egui::Modifiers::NONE,
            }],
            ..Default::default()
        };
        let mut clicked = false;
        let _ = ctx.run(input, |ctx| {
            egui::CentralPanel::default().show(ctx, |ui| {
                clicked = primary_button(ui, "Analyser", true).clicked();
            });
        });
        assert!(clicked);
    }
}
