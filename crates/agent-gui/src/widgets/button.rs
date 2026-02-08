//! Premium button widgets.

use egui::{Color32, CornerRadius, Response, Sense, Stroke, Ui, WidgetText, epaint::StrokeKind};

use crate::theme;

/// Button size variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ButtonSize {
    Small,
    #[default]
    Medium,
    Large,
}

/// A premium primary button with gradient, shadow, and hover effects.
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
    let font = theme::font_body();

    let text_galley = text.into_galley(ui, Some(egui::TextWrapMode::Extend), f32::INFINITY, font);

    // Premium sizing
    let padding = ui.spacing().button_padding;
    let mut desired_size = text_galley.size() + padding * 2.0;

    // Add space for loading spinner
    if loading {
        desired_size.x += 20.0; // Space for spinner
    }

    // Enforce minimum premium height and width
    desired_size.y = desired_size.y.max(36.0); // 36px height
    desired_size.x = desired_size.x.max(120.0); // Minimum width for consistent look

    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    if ui.is_rect_visible(rect) {
        // State interaction
        let is_hovered = enabled && !loading && response.hovered();
        let is_clicked = enabled && !loading && response.is_pointer_button_down_on();

        // ─── Colors ───
        let (bg_fill, bg_stroke, text_color) = if is_primary {
            // Primary: Filled Accent
            let fill = if !enabled {
                theme::ACCENT.linear_multiply(0.4)
            } else if is_clicked {
                theme::ACCENT.linear_multiply(0.8)
            } else if is_hovered {
                theme::ACCENT_HOVER
            } else {
                theme::ACCENT
            };
            (
                fill,
                Stroke::NONE,
                if enabled {
                    Color32::WHITE
                } else {
                    Color32::from_white_alpha(150)
                },
            )
        } else {
            // Secondary: Bordered / Surface
            let fill = if !enabled {
                Color32::TRANSPARENT
            } else if is_clicked {
                theme::bg_elevated().linear_multiply(0.9)
            } else if is_hovered {
                theme::bg_elevated()
            } else {
                Color32::TRANSPARENT
            };

            // Border logic: simplified, no emphasis on hover
            let stroke = if !enabled {
                Stroke::new(1.0, theme::border().linear_multiply(0.5))
            } else {
                Stroke::new(1.0, theme::border())
            };

            let text = if !enabled {
                theme::text_tertiary().linear_multiply(0.5)
            } else if is_clicked || is_hovered {
                theme::text_primary()
            } else {
                theme::text_secondary()
            };

            (fill, stroke, text)
        };

        // ─── Shadows ───
        if is_primary && enabled && !loading && !is_clicked {
            let shadow = theme::premium_shadow(6, 20);
            ui.painter()
                .add(shadow.as_shape(rect, CornerRadius::same(theme::BUTTON_ROUNDING)));
        }

        // ─── Background Paint ───
        ui.painter().rect(
            rect,
            CornerRadius::same(theme::BUTTON_ROUNDING),
            bg_fill,
            bg_stroke,
            StrokeKind::Inside,
        );

        // ─── Inner Bevel / Highlight (Primary Only) ───
        if is_primary && enabled && !loading {
            let stroke_color = Color32::from_white_alpha(30);
            ui.painter().rect_stroke(
                rect.shrink(1.0),
                CornerRadius::same(theme::BUTTON_ROUNDING),
                Stroke::new(1.0, stroke_color),
                StrokeKind::Inside,
            );
        }

        // ─── Loading Spinner ───
        if loading {
            let spinner_rect = egui::Rect::from_center_size(
                rect.center() - egui::vec2(text_galley.size().x / 2.0 + 10.0, 0.0),
                egui::vec2(12.0, 12.0),
            );

            // Continuous rotation using real time
            let time = ui.input(|i| i.time);
            let angle = (time * std::f64::consts::TAU * 1.5) as f32; // 1.5 rotations per second

            // Draw background track circle (subtle)
            ui.painter().circle_stroke(
                spinner_rect.center(),
                6.0,
                Stroke::new(1.5, text_color.linear_multiply(0.2)),
            );

            // Draw spinning arc (270 degrees)
            let num_segments = 12;
            let arc_length = std::f32::consts::PI * 1.5; // 270 degrees
            for i in 0..num_segments {
                let t0 = i as f32 / num_segments as f32;
                let t1 = (i + 1) as f32 / num_segments as f32;
                let segment_angle = angle + t0 * arc_length;
                let next_angle = angle + t1 * arc_length;
                // Fade alpha along the arc for a premium tail effect
                let alpha = t1;

                let p1 = spinner_rect.center()
                    + egui::vec2(6.0 * segment_angle.cos(), 6.0 * segment_angle.sin());
                let p2 = spinner_rect.center()
                    + egui::vec2(6.0 * next_angle.cos(), 6.0 * next_angle.sin());

                ui.painter().line_segment(
                    [p1, p2],
                    Stroke::new(2.0, text_color.linear_multiply(alpha)),
                );
            }

            // Request continuous repaint while loading
            ui.ctx().request_repaint();
        }

        // ─── Text Paint ───
        let text_pos = if loading {
            ui.layout()
                .align_size_within_rect(text_galley.size(), rect.shrink2(egui::vec2(20.0, 0.0)))
                .min
        } else {
            ui.layout()
                .align_size_within_rect(text_galley.size(), rect)
                .min
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
        desired_size.x += 20.0;
    }
    desired_size.y = desired_size.y.max(36.0);
    desired_size.x = desired_size.x.max(120.0);

    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = enabled && !loading && response.hovered();
        let is_clicked = enabled && !loading && response.is_pointer_button_down_on();

        let fill = if !enabled {
            theme::ERROR.linear_multiply(0.4)
        } else if is_clicked {
            theme::ERROR.linear_multiply(0.7)
        } else if is_hovered {
            theme::ERROR.linear_multiply(0.9)
        } else {
            theme::ERROR
        };

        let text_color = if enabled {
            Color32::WHITE
        } else {
            Color32::from_white_alpha(150)
        };

        // Shadow
        if enabled && !loading && !is_clicked {
            let shadow = theme::premium_shadow(6, 20);
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

        // Loading spinner
        if loading {
            draw_spinner(ui, rect, text_galley.size(), text_color);
        }

        // Text
        let text_pos = if loading {
            ui.layout()
                .align_size_within_rect(text_galley.size(), rect.shrink2(egui::vec2(20.0, 0.0)))
                .min
        } else {
            ui.layout()
                .align_size_within_rect(text_galley.size(), rect)
                .min
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

    let padding = egui::vec2(8.0, 4.0);
    let desired_size = text_galley.size() + padding * 2.0;

    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();

        let text_color = if is_clicked {
            theme::ACCENT
        } else if is_hovered {
            theme::text_primary()
        } else {
            theme::text_secondary()
        };

        // Subtle background on hover
        if is_hovered {
            ui.painter().rect_filled(
                rect,
                CornerRadius::same(4),
                theme::bg_elevated().linear_multiply(0.5),
            );
        }

        // Underline on hover
        if is_hovered {
            let underline_y = rect.max.y - 2.0;
            ui.painter().line_segment(
                [
                    egui::pos2(rect.min.x + padding.x, underline_y),
                    egui::pos2(rect.max.x - padding.x, underline_y),
                ],
                Stroke::new(1.0, text_color.linear_multiply(0.5)),
            );
        }

        let text_pos = ui
            .layout()
            .align_size_within_rect(text_galley.size(), rect)
            .min;
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
    let size = 32.0;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();

        // Background on hover
        if is_hovered || is_clicked {
            let bg_color = if is_clicked {
                theme::bg_elevated()
            } else {
                theme::bg_elevated().linear_multiply(0.7)
            };
            ui.painter()
                .rect_filled(rect, CornerRadius::same(6), bg_color);
        }

        // Icon
        let icon_color = if is_clicked {
            theme::ACCENT
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

    let padding = egui::vec2(10.0, 4.0);
    let size = galley.size() + padding * 2.0;
    let size = egui::vec2(size.x, size.y.max(24.0));

    let (rect, response) = ui.allocate_exact_size(size, Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();

        let (bg, stroke, fg) = if active {
            (
                theme::badge_bg(color),
                Stroke::new(0.5, theme::badge_border(color)),
                text_col,
            )
        } else if is_hovered {
            (
                theme::badge_bg(color),
                Stroke::new(0.5, theme::badge_border(color).linear_multiply(0.6)),
                text_col,
            )
        } else {
            (
                Color32::TRANSPARENT,
                Stroke::new(0.5, theme::badge_border(color).linear_multiply(0.4)),
                text_col.linear_multiply(0.7),
            )
        };

        let rounding = CornerRadius::same((rect.height() / 2.0).min(255.0) as u8);
        ui.painter()
            .rect(rect, rounding, bg, stroke, StrokeKind::Inside);

        ui.painter()
            .text(rect.center(), egui::Align2::CENTER_CENTER, text, font, fg);
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

            let padding = egui::vec2(12.0, 6.0);
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
                    Stroke::new(0.5, theme::border()),
                    StrokeKind::Inside,
                );

                ui.painter().text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    *label,
                    font,
                    text_col,
                );
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
        rect.center() - egui::vec2(text_size.x / 2.0 + 10.0, 0.0),
        egui::vec2(12.0, 12.0),
    );

    let time = ui.input(|i| i.time);
    let angle = (time * std::f64::consts::TAU * 1.5) as f32;

    // Background track
    ui.painter().circle_stroke(
        spinner_rect.center(),
        6.0,
        Stroke::new(1.5, color.linear_multiply(0.2)),
    );

    // Spinning arc
    let num_segments = 12;
    let arc_length = std::f32::consts::PI * 1.5;
    for i in 0..num_segments {
        let t0 = i as f32 / num_segments as f32;
        let t1 = (i + 1) as f32 / num_segments as f32;
        let segment_angle = angle + t0 * arc_length;
        let next_angle = angle + t1 * arc_length;
        let alpha = t1;

        let p1 = spinner_rect.center()
            + egui::vec2(6.0 * segment_angle.cos(), 6.0 * segment_angle.sin());
        let p2 = spinner_rect.center() + egui::vec2(6.0 * next_angle.cos(), 6.0 * next_angle.sin());

        ui.painter()
            .line_segment([p1, p2], Stroke::new(2.0, color.linear_multiply(alpha)));
    }

    ui.ctx().request_repaint();
}

/// Link-style button (looks like a hyperlink).
pub fn link_button(ui: &mut Ui, text: &str) -> Response {
    let font = theme::font_body();
    let galley = ui
        .painter()
        .layout_no_wrap(text.to_string(), font.clone(), theme::ACCENT);

    let (rect, response) = ui.allocate_exact_size(galley.size(), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();

        let color = if is_hovered {
            theme::ACCENT_HOVER
        } else {
            theme::ACCENT
        };

        ui.painter().galley(rect.min, galley, color);

        // Underline on hover
        if is_hovered {
            ui.painter().line_segment(
                [
                    egui::pos2(rect.min.x, rect.max.y),
                    egui::pos2(rect.max.x, rect.max.y),
                ],
                Stroke::new(1.0, color),
            );
        }
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

/// Floating action button (FAB) - large circular button.
pub fn fab_button(ui: &mut Ui, icon: &str) -> Response {
    let size = 56.0;
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), Sense::click());

    if ui.is_rect_visible(rect) {
        let is_hovered = response.hovered();
        let is_clicked = response.is_pointer_button_down_on();

        let fill = if is_clicked {
            theme::ACCENT.linear_multiply(0.8)
        } else if is_hovered {
            theme::ACCENT_HOVER
        } else {
            theme::ACCENT
        };

        // Shadow
        if !is_clicked {
            let shadow = theme::premium_shadow(12, 40);
            ui.painter()
                .add(shadow.as_shape(rect, CornerRadius::same(size as u8 / 2)));
        }

        // Circle background
        ui.painter().circle_filled(rect.center(), size / 2.0, fill);

        // Icon
        ui.painter().text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            egui::FontId::proportional(24.0),
            Color32::WHITE,
        );
    }

    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}
