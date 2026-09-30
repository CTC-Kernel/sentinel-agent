// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detail modal — the premium centred dialog every page opens on a row click.
//!
//! The builder keeps its historical `DetailDrawer` name so the pages that call
//! it did not have to change, but it no longer slides in from the edge: a
//! 420px column squeezed hashes, paths and CVE prose until they spilled out.
//! The modal is centred, sized from the window, and lays every field out on a
//! label/value grid whose values wrap instead of overflowing.

use crate::icons;
use crate::theme;
use crate::widgets::button;
use egui::{Color32, CornerRadius, Ui};

/// Width of a standard detail modal.
pub const DETAIL_MODAL_WIDTH: f32 = 720.0;
/// Width of a wide detail modal (tables, timelines, long evidence).
pub const DETAIL_MODAL_WIDTH_WIDE: f32 = 960.0;
/// Share of the window height the modal may cover before its body scrolls.
const MAX_HEIGHT_RATIO: f32 = 0.86;
/// Share of the window width the modal may cover.
const MAX_WIDTH_RATIO: f32 = 0.92;
/// Below this content width, fields stack their label above their value.
const STACKED_FIELD_BREAKPOINT: f32 = 440.0;
/// How far the modal rises while it fades in.
const ENTRY_RISE: f32 = 12.0;

/// Historical name, kept for callers that sized content from it.
pub const DRAWER_WIDTH: f32 = DETAIL_MODAL_WIDTH;

/// Action button style for the detail modal.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActionStyle {
    Primary,
    Secondary,
    Danger,
}

/// An action button in the detail modal footer.
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

/// A centred detail modal builder.
pub struct DetailDrawer<'a> {
    id: egui::Id,
    title: &'a str,
    icon: &'a str,
    accent_color: Color32,
    subtitle: Option<&'a str>,
    width: f32,
}

impl<'a> DetailDrawer<'a> {
    pub fn new(id: impl std::hash::Hash, title: &'a str, icon: &'a str) -> Self {
        Self {
            id: egui::Id::new(id),
            title,
            icon,
            accent_color: theme::ACCENT,
            subtitle: None,
            width: DETAIL_MODAL_WIDTH,
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

    /// Use the wide format, for details that carry tables or long evidence.
    pub fn wide(mut self) -> Self {
        self.width = DETAIL_MODAL_WIDTH_WIDE;
        self
    }

    /// Show the modal. Returns the index of the clicked action button, if any.
    /// The `content` closure renders the body, and `actions` the footer buttons.
    /// `open` is set to false when the modal is dismissed (close button,
    /// Escape, or a click on the backdrop).
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
        let modal_width = self
            .width
            .min(screen.width() * MAX_WIDTH_RATIO)
            .min(screen.width() - theme::SPACE_MD * 2.0)
            .max(1.0);
        let max_height = (screen.height() * MAX_HEIGHT_RATIO)
            .min(screen.height() - theme::SPACE_MD * 2.0)
            .max(1.0);

        // Fade and rise in (instant under reduced motion).
        let anim_id = self.id.with("drawer_anim");
        let anim_t = if theme::is_reduced_motion() {
            1.0
        } else {
            ctx.animate_value_with_time(anim_id, 1.0, theme::ANIM_NORMAL)
        };
        let eased = 1.0 - (1.0 - anim_t).powi(3);

        let backdrop_alpha = (theme::BACKDROP_ALPHA as f32 * anim_t) as u8;
        let prev_open_id = self.id.with("prev_open");
        let return_focus_id = self.id.with("return_focus");
        let was_open_prev =
            ctx.memory(|mem| mem.data.get_temp::<bool>(prev_open_id).unwrap_or(false));
        if !was_open_prev {
            let focused = ctx.memory(|mem| mem.focused());
            ctx.memory_mut(|mem| mem.data.insert_temp(return_focus_id, focused));
        }
        ctx.memory_mut(|mem| mem.data.insert_temp(prev_open_id, true));

        let rounding = CornerRadius::same(theme::ROUNDING_XL);
        let top_rounding = CornerRadius {
            nw: theme::ROUNDING_XL,
            ne: theme::ROUNDING_XL,
            sw: 0,
            se: 0,
        };
        let bottom_rounding = CornerRadius {
            nw: 0,
            ne: 0,
            sw: theme::ROUNDING_XL,
            se: theme::ROUNDING_XL,
        };
        let accent = self.accent_color;
        let accent_fg = theme::readable_color(accent);

        let modal = egui::Modal::new(self.id.with("modal"))
            .area(
                egui::Area::new(self.id.with("detail_modal_area"))
                    .kind(egui::UiKind::Modal)
                    .sense(egui::Sense::hover())
                    .interactable(true)
                    .anchor(
                        egui::Align2::CENTER_CENTER,
                        egui::vec2(0.0, ENTRY_RISE * (1.0 - eased)),
                    )
                    .order(egui::Order::Foreground),
            )
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_secondary())
                    .corner_radius(rounding)
                    .shadow(theme::Elevation::Level5.ambient())
                    .stroke(egui::Stroke::new(
                        theme::BORDER_THIN,
                        theme::border_subtle(),
                    ))
                    .inner_margin(egui::Margin::same(0)),
            )
            .backdrop_color(theme::backdrop_color(backdrop_alpha))
            .show(ctx, |ui| {
                ui.multiply_opacity(anim_t);
                ui.set_width(modal_width);
                ui.spacing_mut().item_spacing.y = 0.0;
                let content_width = modal_width - theme::SPACE_LG * 2.0;
                let top = ui.cursor().top();

                // ── Header, over a whisper of the item's semantic colour ──
                let header_bg = ui.painter().add(egui::Shape::Noop);
                ui.add_space(theme::SPACE_LG);
                ui.horizontal_top(|ui| {
                    ui.spacing_mut().item_spacing.x = 0.0;
                    ui.add_space(theme::SPACE_LG);

                    let icon_size = theme::ICON_2XL;
                    let (icon_rect, _) = ui.allocate_exact_size(
                        egui::vec2(icon_size, icon_size),
                        egui::Sense::hover(),
                    );
                    ui.painter().rect(
                        icon_rect,
                        CornerRadius::same(theme::ROUNDING_LG),
                        theme::tinted_surface(accent),
                        egui::Stroke::new(
                            theme::BORDER_HAIRLINE,
                            theme::color_blend_pub(theme::bg_secondary(), accent, 0.45),
                        ),
                        egui::StrokeKind::Inside,
                    );
                    ui.painter().text(
                        icon_rect.center(),
                        egui::Align2::CENTER_CENTER,
                        self.icon,
                        theme::font_icon(theme::ICON_LG),
                        accent_fg,
                    );

                    ui.add_space(theme::SPACE_MD);

                    let close_w = theme::MIN_TOUCH_TARGET;
                    let title_w =
                        (content_width - icon_size - theme::SPACE_MD * 2.0 - close_w).max(40.0);
                    ui.vertical(|ui| {
                        ui.set_width(title_w);
                        ui.spacing_mut().item_spacing.y = theme::SPACE_XS;
                        ui.add(
                            egui::Label::new(
                                egui::RichText::new(self.title)
                                    .font(theme::font_h3())
                                    .color(theme::text_primary()),
                            )
                            .wrap_mode(egui::TextWrapMode::Wrap),
                        );
                        if let Some(sub) = self.subtitle {
                            ui.add(
                                egui::Label::new(
                                    egui::RichText::new(sub)
                                        .font(theme::font_small())
                                        .color(theme::text_tertiary()),
                                )
                                .wrap_mode(egui::TextWrapMode::Wrap),
                            );
                        }
                    });

                    ui.add_space(theme::SPACE_MD);
                    if button::icon_button(ui, icons::XMARK, Some("Fermer (Échap)")).clicked() {
                        should_close = true;
                    }
                });
                ui.add_space(theme::SPACE_LG);

                let header_rect =
                    egui::Rect::from_x_y_ranges(ui.min_rect().x_range(), top..=ui.cursor().top());
                ui.painter().set(
                    header_bg,
                    egui::Shape::rect_filled(
                        header_rect,
                        top_rounding,
                        theme::color_blend_pub(theme::bg_secondary(), accent, 0.07),
                    ),
                );
                ui.painter().hline(
                    header_rect.x_range(),
                    header_rect.bottom(),
                    egui::Stroke::new(theme::BORDER_THIN, theme::border_subtle()),
                );

                // ── Footer height, from the buttons it will hold ──
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
                    theme::SPACE_MD
                } else {
                    theme::SPACE_MD * 2.0
                        + footer_rows as f32 * theme::BUTTON_HEIGHT
                        + (footer_rows - 1) as f32 * theme::SPACE_SM
                };

                // ── Body: grows with its content, scrolls past the cap ──
                let body_max = (max_height - (ui.cursor().top() - top) - footer_h).max(80.0);
                let body = egui::ScrollArea::vertical()
                    .id_salt(self.id.with("scroll"))
                    .auto_shrink([false, true])
                    .max_height(body_max)
                    .show(ui, |ui| {
                        ui.add_space(theme::SPACE_XS);
                        ui.horizontal(|ui| {
                            ui.add_space(theme::SPACE_LG);
                            ui.vertical(|ui| {
                                ui.set_width(content_width);
                                ui.spacing_mut().item_spacing.y = theme::SPACE_XS;
                                content(ui);
                            });
                        });
                        ui.add_space(theme::SPACE_LG);
                    });
                // More below: fade the last lines into the surface, so a cut
                // paragraph reads as "scroll" rather than as a clipping bug.
                let hidden_below =
                    body.content_size.y - (body.state.offset.y + body.inner_rect.height());
                if hidden_below > 1.0 {
                    let fade_h = theme::SPACE_XL.min(hidden_below);
                    let fade = egui::Rect::from_min_max(
                        egui::pos2(body.inner_rect.left(), body.inner_rect.bottom() - fade_h),
                        body.inner_rect.right_bottom(),
                    );
                    let surface = theme::bg_secondary();
                    let mut mesh = egui::Mesh::default();
                    let clear = Color32::from_rgba_premultiplied(0, 0, 0, 0);
                    mesh.colored_vertex(fade.left_top(), clear);
                    mesh.colored_vertex(fade.right_top(), clear);
                    mesh.colored_vertex(fade.left_bottom(), surface);
                    mesh.colored_vertex(fade.right_bottom(), surface);
                    mesh.add_triangle(0, 1, 2);
                    mesh.add_triangle(1, 3, 2);
                    ui.painter().add(egui::Shape::mesh(mesh));
                }

                // ── Footer, pinned under the body, actions to the right ──
                if footer_rows > 0 {
                    let footer_rect = egui::Rect::from_min_size(
                        egui::pos2(ui.min_rect().left(), ui.cursor().top()),
                        egui::vec2(modal_width, footer_h),
                    );
                    ui.painter().rect_filled(
                        footer_rect,
                        bottom_rounding,
                        theme::color_blend_pub(theme::bg_secondary(), theme::bg_primary(), 0.5),
                    );
                    ui.painter().hline(
                        footer_rect.x_range(),
                        footer_rect.top(),
                        egui::Stroke::new(theme::BORDER_THIN, theme::border_subtle()),
                    );

                    let inner = footer_rect.shrink2(egui::vec2(theme::SPACE_LG, theme::SPACE_MD));
                    // One row high to start with: a wrapping row centres its
                    // items in the rect it is given, so a taller rect would
                    // push the second row out of the footer.
                    let first_row = egui::Rect::from_min_size(
                        inner.min,
                        egui::vec2(inner.width(), theme::BUTTON_HEIGHT),
                    );
                    let mut footer =
                        ui.new_child(egui::UiBuilder::new().max_rect(first_row).layout(
                            egui::Layout::right_to_left(egui::Align::Center).with_main_wrap(true),
                        ));
                    footer.spacing_mut().item_spacing =
                        egui::vec2(theme::SPACE_SM, theme::SPACE_SM);
                    // Laid out from the right edge: walk the actions backwards
                    // so they still read in the order the page declared them.
                    for (idx, action) in actions.iter().enumerate().rev() {
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
                ui.allocate_space(egui::vec2(modal_width, footer_h));
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
            // Reset animation value so the modal animates in on next open
            if !theme::is_reduced_motion() {
                ctx.animate_value_with_time(anim_id, 0.0, 0.0);
            }
        }

        clicked_action
    }
}

/// Render a labeled section header inside a detail modal.
pub fn detail_section(ui: &mut Ui, title: &str) {
    ui.add_space(theme::SPACE_MD);
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(title)
                .font(theme::font_label())
                .color(theme::text_secondary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        // A hairline runs from the title to the edge, so sections read as
        // groups without boxing every one of them.
        let rest = ui.available_rect_before_wrap();
        let y = rest.center().y;
        ui.painter().hline(
            (rest.left() + theme::SPACE_SM)..=rest.right(),
            y,
            egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
        );
    });
    ui.add_space(theme::SPACE_SM);
}

/// One label/value row. The label keeps a fixed column; the value takes the
/// rest and wraps, so a long hash or path never spills past the modal. On a
/// narrow modal the label stacks above the value instead.
fn field_row(ui: &mut Ui, label: &str, value: impl FnOnce(&mut Ui)) {
    let total = ui.available_width();
    let label_text = egui::RichText::new(label)
        .font(theme::font_small())
        .color(theme::text_tertiary());
    if total < STACKED_FIELD_BREAKPOINT {
        ui.add(egui::Label::new(label_text).wrap_mode(egui::TextWrapMode::Wrap));
        ui.scope(|ui| {
            ui.set_max_width(total);
            value(ui);
        });
    } else {
        let gap = theme::SPACE_MD;
        let label_w = (total * 0.34).clamp(120.0, 220.0);
        let value_w = (total - label_w - gap).max(1.0);
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            ui.allocate_ui_with_layout(
                egui::vec2(label_w, 0.0),
                egui::Layout::top_down(egui::Align::Min),
                |ui| {
                    ui.set_width(label_w);
                    // Line the label's baseline up with a body-size value.
                    ui.add_space(2.0);
                    ui.add(egui::Label::new(label_text).wrap_mode(egui::TextWrapMode::Wrap));
                },
            );
            ui.add_space(gap);
            ui.allocate_ui_with_layout(
                egui::vec2(value_w, 0.0),
                egui::Layout::top_down(egui::Align::Min),
                |ui| {
                    ui.set_width(value_w);
                    value(ui);
                },
            );
        });
    }
    ui.add_space(theme::SPACE_SM);
}

/// Render a key-value field inside a detail modal.
pub fn detail_field(ui: &mut Ui, label: &str, value: &str) {
    field_row(ui, label, |ui| {
        ui.add(
            egui::Label::new(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::text_primary()),
            )
            .wrap_mode(egui::TextWrapMode::Wrap),
        );
    });
}

/// Render a key-value field with colored value (AAA-readable via `readable_color`).
pub fn detail_field_colored(ui: &mut Ui, label: &str, value: &str, color: Color32) {
    field_row(ui, label, |ui| {
        ui.add(
            egui::Label::new(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::readable_color(color))
                    .strong(),
            )
            .wrap_mode(egui::TextWrapMode::Wrap),
        );
    });
}

/// Render a key-value field with a badge value.
pub fn detail_field_badge(ui: &mut Ui, label: &str, value: &str, color: Color32) {
    field_row(ui, label, |ui| {
        // A pill wants a row layout; a top-down column stretches its frame.
        ui.horizontal(|ui| {
            crate::widgets::status_badge(ui, value, color);
        });
    });
}

/// Render a long text field (wrapping) inside a detail modal.
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
            // Prose spans the modal: a frame hugging its wrapped text stopped
            // short of the edge and read as a misaligned box.
            ui.set_width(ui.available_width());
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

/// Render a progress/coverage indicator inside a detail modal.
pub fn detail_progress(ui: &mut Ui, label: &str, fraction: f32, color: Color32) {
    field_row(ui, label, |ui| {
        ui.horizontal(|ui| {
            let value = format!("{:.0}\u{202f}%", fraction * 100.0);
            let value_w = ui
                .painter()
                .layout_no_wrap(value.clone(), theme::font_body(), color)
                .size()
                .x;
            let bar_height = 6.0;
            let bar_w = (ui.available_width() - value_w - theme::SPACE_MD).max(24.0);
            let (row, _) = ui.allocate_exact_size(
                egui::vec2(bar_w, theme::font_body().size * 1.3),
                egui::Sense::hover(),
            );
            let rect = egui::Rect::from_center_size(row.center(), egui::vec2(bar_w, bar_height));
            if ui.is_rect_visible(rect) {
                ui.painter().rect_filled(
                    rect,
                    CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                    theme::bg_tertiary(),
                );
                let fill_w = rect.width() * fraction.clamp(0.0, 1.0);
                if fill_w > 0.0 {
                    let fill_rect =
                        egui::Rect::from_min_size(rect.min, egui::vec2(fill_w, bar_height));
                    ui.painter().rect_filled(
                        fill_rect,
                        CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                        color,
                    );
                }
            }
            ui.add_space(theme::SPACE_MD);
            ui.label(
                egui::RichText::new(value)
                    .font(theme::font_body())
                    .color(theme::readable_color(color))
                    .strong(),
            );
        });
    });
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

    #[test]
    fn long_values_stay_inside_the_window() {
        let ctx = egui::Context::default();
        theme::configure_fonts(&ctx);
        let screen = egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(960.0, 600.0));
        let long = "x".repeat(400);
        let mut open = true;
        for frame in 0..4 {
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(screen),
                    time: Some(frame as f64),
                    ..Default::default()
                },
                |ctx| {
                    DetailDrawer::new("overflow_modal", &long, "").show(
                        ctx,
                        &mut open,
                        |ui| {
                            for _ in 0..30 {
                                detail_field(ui, &long, &long);
                                detail_mono(ui, "Hash", &long);
                            }
                        },
                        &[DetailAction::primary(long.clone(), "")],
                    );
                },
            );
        }
        let rect = ctx
            .memory(|mem| mem.area_rect(egui::Id::new("overflow_modal").with("detail_modal_area")))
            .expect("modal area");
        assert!(
            screen.contains_rect(rect),
            "modal {rect:?} overflows the window {screen:?}"
        );
    }
}
