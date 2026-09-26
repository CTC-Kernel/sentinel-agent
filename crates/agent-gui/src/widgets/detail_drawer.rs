// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Slide-in detail drawer — premium AAA right-side panel.
//!
//! Renders a glass-morphism slide-in drawer from the right edge of the screen.
//! Used across all pages to display detail views when clicking on table rows,
//! alerts, list items, etc.

use crate::icons;
use crate::theme;
use crate::widgets::button;
use egui::{Color32, CornerRadius, Ui};

/// Detail drawer width.
pub const DRAWER_WIDTH: f32 = 420.0;

/// Action button style for the detail drawer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActionStyle {
    Primary,
    Secondary,
    Danger,
}

/// An action button in the detail drawer.
pub struct DetailAction {
    pub label: String,
    pub icon: &'static str,
    pub style: ActionStyle,
    pub enabled: bool,
    pub loading: bool,
}

impl DetailAction {
    pub fn primary(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Primary,
            enabled: true,
            loading: false,
        }
    }

    pub fn secondary(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Secondary,
            enabled: true,
            loading: false,
        }
    }

    pub fn danger(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Danger,
            enabled: true,
            loading: false,
        }
    }

    pub fn enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    pub fn loading(mut self, loading: bool) -> Self {
        self.loading = loading;
        self
    }
}

/// A slide-in detail drawer builder.
pub struct DetailDrawer<'a> {
    id: egui::Id,
    title: &'a str,
    icon: &'a str,
    accent_color: Color32,
    subtitle: Option<&'a str>,
}

impl<'a> DetailDrawer<'a> {
    pub fn new(id: impl std::hash::Hash, title: &'a str, icon: &'a str) -> Self {
        Self {
            id: egui::Id::new(id),
            title,
            icon,
            accent_color: theme::ACCENT,
            subtitle: None,
        }
    }

    pub fn accent(mut self, color: Color32) -> Self {
        self.accent_color = color;
        self
    }

    pub fn subtitle(mut self, sub: &'a str) -> Self {
        self.subtitle = Some(sub);
        self
    }

    /// Show the drawer. Returns the index of the clicked action button, if any.
    /// The `content` closure renders the body, and `actions` renders the action buttons.
    /// `open` is set to false when the drawer is dismissed.
    pub fn show(
        self,
        ctx: &egui::Context,
        open: &mut bool,
        content: impl FnOnce(&mut Ui),
        actions: &[DetailAction],
    ) -> Option<usize> {
        if !*open {
            return None;
        }

        let mut clicked_action: Option<usize> = None;
        let mut should_close = false;

        let screen = ctx.screen_rect();

        // Responsive width: cap at DRAWER_WIDTH but never exceed 35% of screen
        let drawer_width = DRAWER_WIDTH.min(screen.width() * 0.35).max(280.0);

        // Slide-in animation (respects reduced motion)
        let anim_id = self.id.with("drawer_anim");
        let anim_t = if theme::is_reduced_motion() {
            1.0
        } else {
            ctx.animate_value_with_time(anim_id, 1.0, theme::ANIM_NORMAL)
        };

        let backdrop_alpha = (theme::BACKDROP_ALPHA as f32 / 2.0 * anim_t) as u8;
        let prev_open_id = self.id.with("prev_open");
        let return_focus_id = self.id.with("return_focus");
        let was_open_prev =
            ctx.memory(|mem| mem.data.get_temp::<bool>(prev_open_id).unwrap_or(false));
        if !was_open_prev {
            let focused = ctx.memory(|mem| mem.focused());
            ctx.memory_mut(|mem| mem.data.insert_temp(return_focus_id, focused));
        }
        ctx.memory_mut(|mem| mem.data.insert_temp(prev_open_id, true));
        let drawer_x = screen.max.x - drawer_width * anim_t;

        // Drawer panel — slide in from right with animation
        let modal = egui::Modal::new(self.id.with("modal"))
            .area(
                egui::Area::new(egui::Id::new("drawer_panel").with(self.id))
                    .kind(egui::UiKind::Modal)
                    .sense(egui::Sense::hover())
                    .interactable(true)
                    .fixed_pos(egui::pos2(drawer_x, screen.min.y))
                    .order(egui::Order::Foreground),
            )
            .frame(egui::Frame::NONE)
            .backdrop_color(theme::backdrop_color(backdrop_alpha))
            .show(ctx, |ui| {
                let drawer_rect = egui::Rect::from_min_size(
                    egui::pos2(drawer_x, screen.min.y),
                    egui::vec2(drawer_width, screen.height()),
                );

                // Shadow first, then the surface on top of it: appended after
                // the fill, egui's blurred rect covers the whole drawer and
                // darkens the content it is supposed to sit behind.
                let mut shadow = theme::Elevation::Level5.ambient();
                shadow.offset = [-16, 0]; // Project leftwards, onto the page.
                ui.painter()
                    .add(shadow.as_shape(drawer_rect, CornerRadius::ZERO));

                ui.painter()
                    .rect_filled(drawer_rect, CornerRadius::ZERO, theme::bg_secondary());

                // Leading edge, tinted with the drawer's semantic colour.
                ui.painter().line_segment(
                    [drawer_rect.left_top(), drawer_rect.left_bottom()],
                    egui::Stroke::new(
                        theme::BORDER_MEDIUM,
                        theme::readable_color(self.accent_color),
                    ),
                );

                // Constrain the area UI to drawer bounds
                ui.set_clip_rect(drawer_rect);
                ui.set_min_size(egui::vec2(drawer_width, screen.height()));
                ui.set_max_size(egui::vec2(drawer_width, screen.height()));

                // Footer height, from the buttons it will hold: they wrap onto
                // as many rows as the drawer's width requires.
                let content_width = drawer_width - theme::SPACE_LG * 2.0;
                let footer_rows = if actions.is_empty() {
                    0
                } else {
                    let mut rows = 1;
                    let mut used = 0.0;
                    for action in actions {
                        let w = ui
                            .painter()
                            .layout_no_wrap(
                                format!("{}  {}", action.icon, action.label),
                                theme::font_body_strong(),
                                theme::text_primary(),
                            )
                            .size()
                            .x
                            + theme::SPACE_LG * 2.0;
                        if used > 0.0 && used + theme::SPACE_SM + w > content_width {
                            rows += 1;
                            used = w;
                        } else {
                            used += if used > 0.0 { theme::SPACE_SM } else { 0.0 } + w;
                        }
                    }
                    rows
                };
                let footer_h = if footer_rows == 0 {
                    0.0
                } else {
                    theme::SPACE_MD * 2.0
                        + footer_rows as f32 * theme::BUTTON_HEIGHT
                        + (footer_rows - 1) as f32 * theme::SPACE_SM
                };

                ui.vertical(|ui| {
                    ui.set_width(drawer_width);
                    ui.add_space(theme::SPACE_LG);

                    // Header
                    ui.horizontal(|ui| {
                        ui.add_space(theme::SPACE_LG);

                        // Icon circle
                        let icon_size = theme::ICON_XL + theme::SPACE_SM;
                        let (icon_rect, _) = ui.allocate_exact_size(
                            egui::vec2(icon_size, icon_size),
                            egui::Sense::hover(),
                        );
                        ui.painter().circle_filled(
                            icon_rect.center(),
                            icon_size / 2.0,
                            theme::tinted_surface(self.accent_color),
                        );
                        ui.painter().text(
                            icon_rect.center(),
                            egui::Align2::CENTER_CENTER,
                            self.icon,
                            theme::font_icon(theme::ICON_MD),
                            theme::readable_color(self.accent_color),
                        );

                        ui.add_space(theme::SPACE_MD);

                        ui.vertical(|ui| {
                            ui.label(
                                egui::RichText::new(self.title)
                                    .font(theme::font_h3())
                                    .color(theme::text_primary()),
                            );
                            if let Some(sub) = self.subtitle {
                                ui.label(
                                    egui::RichText::new(sub)
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                );
                            }
                        });

                        // Close button
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.add_space(theme::SPACE_LG);
                            if button::icon_button(ui, icons::XMARK, Some("Fermer")).clicked() {
                                should_close = true;
                            }
                        });
                    });

                    ui.add_space(theme::SPACE_SM);

                    // Hairline under the header, not an accent slab.
                    let divider_rect = ui
                        .allocate_space(egui::vec2(drawer_width, theme::BORDER_THIN))
                        .1;
                    if ui.is_rect_visible(divider_rect) {
                        ui.painter().rect_filled(
                            egui::Rect::from_min_size(
                                divider_rect.min + egui::vec2(theme::SPACE_LG, 0.0),
                                egui::vec2(content_width, theme::BORDER_THIN),
                            ),
                            CornerRadius::ZERO,
                            theme::border_subtle(),
                        );
                    }

                    // Body scrolls between the header and the pinned footer,
                    // so the actions stay in reach however long the detail.
                    let body_height =
                        (drawer_rect.bottom() - ui.cursor().top() - footer_h).max(0.0);
                    egui::ScrollArea::vertical()
                        .id_salt(self.id.with("scroll"))
                        .auto_shrink([false, false])
                        .max_height(body_height)
                        .show(ui, |ui| {
                            ui.set_width(drawer_width);
                            ui.add_space(theme::SPACE_MD);
                            ui.horizontal(|ui| {
                                ui.add_space(theme::SPACE_LG);
                                ui.vertical(|ui| {
                                    ui.set_width(content_width);
                                    content(ui);
                                });
                            });
                            ui.add_space(theme::SPACE_XL);
                        });

                    if footer_h > 0.0 {
                        let footer_rect = egui::Rect::from_min_size(
                            egui::pos2(drawer_rect.left(), drawer_rect.bottom() - footer_h),
                            egui::vec2(drawer_width, footer_h),
                        );
                        // The footer sits over the scrolling body: its own
                        // surface, a hairline, and a whisper of shadow above.
                        let mut shadow = theme::Elevation::Level2.ambient();
                        shadow.offset = [0, -4];
                        ui.painter()
                            .add(shadow.as_shape(footer_rect, CornerRadius::ZERO));
                        ui.painter().rect_filled(
                            footer_rect,
                            CornerRadius::ZERO,
                            theme::bg_secondary(),
                        );
                        ui.painter().hline(
                            footer_rect.x_range(),
                            footer_rect.top() + 0.5,
                            egui::Stroke::new(theme::BORDER_THIN, theme::border_subtle()),
                        );

                        let inner =
                            footer_rect.shrink2(egui::vec2(theme::SPACE_LG, theme::SPACE_MD));
                        // One row high to start with, like `horizontal_wrapped`:
                        // a wrapping row centres its items in the rect it is
                        // given, so a two-row rect would push the second row
                        // out of the footer.
                        let first_row = egui::Rect::from_min_size(
                            inner.min,
                            egui::vec2(inner.width(), theme::BUTTON_HEIGHT),
                        );
                        let mut footer = ui.new_child(
                            egui::UiBuilder::new().max_rect(first_row).layout(
                                egui::Layout::left_to_right(egui::Align::Center)
                                    .with_main_wrap(true),
                            ),
                        );
                        footer.spacing_mut().item_spacing =
                            egui::vec2(theme::SPACE_SM, theme::SPACE_SM);
                        for (idx, action) in actions.iter().enumerate() {
                            let label = format!("{}  {}", action.icon, action.label);
                            let clicked = match action.style {
                                ActionStyle::Primary => button::primary_button_loading(
                                    &mut footer,
                                    &label,
                                    action.enabled,
                                    action.loading,
                                )
                                .clicked(),
                                ActionStyle::Secondary => button::secondary_button_loading(
                                    &mut footer,
                                    &label,
                                    action.enabled,
                                    action.loading,
                                )
                                .clicked(),
                                ActionStyle::Danger => button::destructive_button_loading(
                                    &mut footer,
                                    &label,
                                    action.enabled,
                                    action.loading,
                                )
                                .clicked(),
                            };
                            if clicked {
                                clicked_action = Some(idx);
                            }
                        }
                    }
                });
            });

        should_close |= modal.should_close();
        if should_close {
            *open = false;
            if let Some(id) = ctx.memory(|mem| {
                mem.data
                    .get_temp::<Option<egui::Id>>(return_focus_id)
                    .flatten()
            }) {
                ctx.memory_mut(|mem| mem.request_focus(id));
            }
            // Reset prev_open flag so next open skips dismiss for one frame
            ctx.memory_mut(|mem| mem.data.insert_temp::<bool>(prev_open_id, false));
            // Reset animation value so drawer animates in on next open
            if !theme::is_reduced_motion() {
                ctx.animate_value_with_time(anim_id, 0.0, 0.0);
            }
        }

        clicked_action
    }
}

/// Render a labeled section header inside a detail drawer.
pub fn detail_section(ui: &mut Ui, title: &str) {
    ui.add_space(theme::SPACE_MD);
    ui.label(
        egui::RichText::new(title)
            .font(theme::font_label())
            .color(theme::text_secondary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
    ui.add_space(theme::SPACE_SM);
}

/// Render a key-value field inside a detail drawer.
pub fn detail_field(ui: &mut Ui, label: &str, value: &str) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::text_primary()),
            );
        });
    });
    ui.add_space(theme::SPACE_XS);
}

/// Render a key-value field with colored value (AAA-readable via `readable_color`).
pub fn detail_field_colored(ui: &mut Ui, label: &str, value: &str, color: Color32) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::readable_color(color))
                    .strong(),
            );
        });
    });
    ui.add_space(theme::SPACE_XS);
}

/// Render a key-value field with a badge value.
pub fn detail_field_badge(ui: &mut Ui, label: &str, value: &str, color: Color32) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            crate::widgets::status_badge(ui, value, color);
        });
    });
    ui.add_space(theme::SPACE_XS);
}

/// Render a long text field (wrapping) inside a detail drawer.
pub fn detail_text(ui: &mut Ui, label: &str, text: &str) {
    ui.label(
        egui::RichText::new(label)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_TIGHT)
            .strong(),
    );
    ui.add_space(theme::SPACE_XS);

    // Prose sits one step up the surface ladder, not in a hole: bg_deep read
    // as a terminal well around a sentence of French.
    egui::Frame::new()
        .fill(theme::bg_tertiary())
        .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
        .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
        .stroke(egui::Stroke::new(
            theme::BORDER_HAIRLINE,
            theme::border_subtle(),
        ))
        .show(ui, |ui| {
            ui.add(
                egui::Label::new(
                    egui::RichText::new(text)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                )
                .wrap_mode(egui::TextWrapMode::Wrap),
            );
        });
    ui.add_space(theme::SPACE_SM);
}

/// Render a monospace code/path field.
pub fn detail_mono(ui: &mut Ui, label: &str, value: &str) {
    ui.label(
        egui::RichText::new(label)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_TIGHT)
            .strong(),
    );
    ui.add_space(theme::SPACE_XS);

    // A hash or an address is there to be pasted somewhere else: the copy
    // button sits beside the well rather than making the operator select it.
    ui.horizontal(|ui| {
        let copy_w = theme::MIN_TOUCH_TARGET + theme::SPACE_XS;
        let well_max = (ui.available_width() - copy_w).max(80.0);
        egui::Frame::new()
            .fill(theme::bg_deep())
            .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
            .stroke(egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::border_subtle(),
            ))
            .show(ui, |ui| {
                ui.set_max_width(well_max - theme::SPACE_MD * 2.0);
                ui.add(
                    egui::Label::new(
                        egui::RichText::new(value)
                            .font(theme::font_mono())
                            .color(theme::text_primary()),
                    )
                    .wrap_mode(egui::TextWrapMode::Wrap),
                );
            });
        ui.add_space(theme::SPACE_XS);
        crate::widgets::copy_button(ui, value, Some("Copier"));
    });
    ui.add_space(theme::SPACE_SM);
}

/// Render a progress/coverage indicator inside a detail drawer.
pub fn detail_progress(ui: &mut Ui, label: &str, fraction: f32, color: Color32) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::text_tertiary()),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                egui::RichText::new(format!("{:.0}\u{202f}%", fraction * 100.0))
                    .font(theme::font_body())
                    .color(color)
                    .strong(),
            );
        });
    });
    ui.add_space(theme::SPACE_XS);

    let bar_height = 6.0;
    let width = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(egui::vec2(width, bar_height), egui::Sense::hover());
    if ui.is_rect_visible(rect) {
        ui.painter().rect_filled(
            rect,
            CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
            theme::bg_tertiary(),
        );
        let fill_w = rect.width() * fraction.clamp(0.0, 1.0);
        if fill_w > 0.0 {
            let fill_rect = egui::Rect::from_min_size(rect.min, egui::vec2(fill_w, bar_height));
            ui.painter().rect_filled(
                fill_rect,
                CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                color,
            );
        }
    }
    ui.add_space(theme::SPACE_SM);
}

/// Render a premium AI-generated remediation proposal section.
pub fn detail_ai_proposal(ui: &mut Ui, explanation: &str, commands: &[String]) {
    ui.add_space(theme::SPACE_MD);

    // Header with "AI Advisor" badge
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new("CONSEILLER IA SENTINEL")
                .font(theme::font_label())
                .color(theme::accent_text())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            crate::widgets::status_badge(ui, "IA SUGGESTION", theme::ACCENT);
        });
    });
    ui.add_space(theme::SPACE_SM);

    // Explanation Box
    egui::Frame::new()
        .fill(theme::tinted_surface(theme::ACCENT))
        .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
        .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
        .stroke(egui::Stroke::new(
            theme::BORDER_HAIRLINE,
            theme::color_blend_pub(theme::bg_secondary(), theme::ACCENT, 0.35),
        ))
        .show(ui, |ui| {
            ui.add(
                egui::Label::new(
                    egui::RichText::new(explanation)
                        .font(theme::font_body())
                        .color(theme::text_primary()),
                )
                .wrap_mode(egui::TextWrapMode::Wrap),
            );
        });

    ui.add_space(theme::SPACE_SM);

    // Code Box for commands
    if !commands.is_empty() {
        ui.label(
            egui::RichText::new("SCRIPT DE RÉPARATION PROPOSÉ")
                .font(theme::font_small())
                .color(theme::text_tertiary())
                .strong(),
        );
        ui.add_space(theme::SPACE_XS);

        egui::Frame::new()
            .fill(theme::bg_deep())
            .corner_radius(CornerRadius::same(theme::ROUNDING_MD))
            .inner_margin(egui::Margin::same(theme::SPACE_MD as i8))
            .stroke(egui::Stroke::new(
                theme::BORDER_HAIRLINE,
                theme::border_subtle(),
            ))
            .show(ui, |ui| {
                for cmd in commands {
                    ui.label(
                        egui::RichText::new(format!("$ {}", cmd))
                            .font(theme::font_mono())
                            .color(theme::ACCENT_LIGHT),
                    );
                }
            });
    }

    ui.add_space(theme::SPACE_MD);
}

#[cfg(test)]
mod regression_tests {
    use super::*;
    #[test]
    fn backdrop_click_closes_without_activating_underlying_button() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let mut open = true;
        let mut underlying = egui::Rect::NOTHING;
        for frame in 0..5 {
            let pos = underlying.center();
            let events = match frame {
                3 | 4 => vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::PointerButton {
                        pos,
                        button: egui::PointerButton::Primary,
                        pressed: frame == 3,
                        modifiers: egui::Modifiers::NONE,
                    },
                ],
                _ => vec![],
            };
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(960.0, 640.0),
                    )),
                    events,
                    time: Some(frame as f64 / 60.0),
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        let response = ui.button("Action sous le panneau");
                        underlying = response.rect;
                        assert!(!response.clicked(), "drawer leaked a click to the page");
                    });
                    DetailDrawer::new("test_drawer", "Détail", "").show(
                        ctx,
                        &mut open,
                        |ui| {
                            ui.label("Contenu");
                        },
                        &[],
                    );
                },
            );
        }
        assert!(!open, "backdrop should dismiss the drawer");
    }
}
