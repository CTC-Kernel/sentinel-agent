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
}

impl DetailAction {
    pub fn primary(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Primary,
            enabled: true,
        }
    }

    pub fn secondary(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Secondary,
            enabled: true,
        }
    }

    pub fn danger(label: impl Into<String>, icon: &'static str) -> Self {
        Self {
            label: label.into(),
            icon,
            style: ActionStyle::Danger,
            enabled: true,
        }
    }

    pub fn enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
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

        // Escape to close
        if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            should_close = true;
        }

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

        // Backdrop (visual only — non-interactive to avoid stealing scroll events)
        let backdrop_alpha = (theme::BACKDROP_ALPHA as f32 / 2.0 * anim_t) as u8;
        egui::Area::new(egui::Id::new("drawer_backdrop").with(self.id))
            .fixed_pos(screen.min)
            .order(egui::Order::Foreground)
            .interactable(false)
            .show(ctx, |ui| {
                ui.painter().rect_filled(
                    screen,
                    CornerRadius::ZERO,
                    Color32::from_black_alpha(backdrop_alpha),
                );
            });

        // Dismiss on click outside drawer (left of drawer edge)
        let drawer_x = screen.max.x - drawer_width * anim_t;
        if ctx.input(|i| i.pointer.primary_clicked())
            && let Some(pos) = ctx.input(|i| i.pointer.interact_pos())
            && pos.x < drawer_x
        {
            should_close = true;
        }

        // Drawer panel — slide in from right with animation
        egui::Area::new(egui::Id::new("drawer_panel").with(self.id))
            .fixed_pos(egui::pos2(drawer_x, screen.min.y))
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                let drawer_rect =
                    egui::Rect::from_min_size(egui::pos2(drawer_x, screen.min.y), egui::vec2(drawer_width, screen.height()));

                // Full-height glass background
                ui.painter().rect_filled(
                    drawer_rect,
                    CornerRadius::ZERO,
                    theme::bg_secondary(),
                );

                // Left border with accent
                ui.painter().line_segment(
                    [drawer_rect.left_top(), drawer_rect.left_bottom()],
                    egui::Stroke::new(theme::BORDER_MEDIUM, self.accent_color.linear_multiply(theme::OPACITY_MEDIUM)),
                );

                // Shadow on the left edge (theme-aware)
                let shadow_base = theme::overlay_color();
                for i in 0..10 {
                    let alpha = (10 - i) as f32 * 3.0 / 255.0;
                    let x = drawer_x - 20.0 + i as f32 * theme::SPACE_MICRO;
                    ui.painter().line_segment(
                        [egui::pos2(x, screen.min.y), egui::pos2(x, screen.max.y)],
                        egui::Stroke::new(theme::BORDER_THIN, shadow_base.linear_multiply(alpha)),
                    );
                }

                // Constrain the area UI to drawer bounds
                ui.set_clip_rect(drawer_rect);
                ui.set_min_size(egui::vec2(drawer_width, screen.height()));
                ui.set_max_size(egui::vec2(drawer_width, screen.height()));

                egui::ScrollArea::vertical()
                    .id_salt(self.id.with("scroll"))
                    .auto_shrink([false, false])
                    .max_height(screen.height())
                    .show(ui, |ui| {
                        let content_width = drawer_width - theme::SPACE_LG * 2.0;
                        ui.set_width(content_width);
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
                                self.accent_color.linear_multiply(theme::OPACITY_TINT),
                            );
                            ui.painter().text(
                                icon_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                self.icon,
                                egui::FontId::proportional(theme::ICON_MD),
                                self.accent_color,
                            );

                            ui.add_space(theme::SPACE_MD);

                            ui.vertical(|ui| {
                                ui.label(
                                    egui::RichText::new(self.title)
                                        .font(theme::font_heading())
                                        .color(theme::text_primary())
                                        .strong(),
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
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    ui.add_space(theme::SPACE_MD);
                                    if button::icon_button(ui, icons::XMARK, Some("Fermer")).clicked()
                                    {
                                        should_close = true;
                                    }
                                },
                            );
                        });

                        ui.add_space(theme::SPACE_SM);

                        // Accent divider
                        let divider_rect = ui
                            .allocate_space(egui::vec2(
                                content_width,
                                2.0,
                            ))
                            .1;
                        if ui.is_rect_visible(divider_rect) {
                            ui.painter().rect_filled(
                                divider_rect,
                                CornerRadius::same(1),
                                self.accent_color.linear_multiply(theme::OPACITY_MEDIUM),
                            );
                        }

                        ui.add_space(theme::SPACE_MD);

                        // Page-specific content
                        ui.horizontal(|ui| {
                            ui.add_space(theme::SPACE_LG);
                            ui.vertical(|ui| {
                                ui.set_width(content_width - theme::SPACE_LG);
                                content(ui);
                            });
                        });

                        // Actions
                        if !actions.is_empty() {
                            ui.add_space(theme::SPACE_LG);

                            let action_rect = ui
                                .allocate_space(egui::vec2(
                                    content_width,
                                    1.0,
                                ))
                                .1;
                            ui.painter().rect_filled(
                                action_rect,
                                CornerRadius::ZERO,
                                theme::border(),
                            );

                            ui.add_space(theme::SPACE_MD);

                            ui.horizontal(|ui| {
                                ui.add_space(theme::SPACE_SM);
                                ui.label(
                                    egui::RichText::new("ACTIONS")
                                        .font(theme::font_label())
                                        .color(theme::text_secondary())
                                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                                        .strong(),
                                );
                            });
                            ui.add_space(theme::SPACE_SM);

                            for (idx, action) in actions.iter().enumerate() {
                                ui.horizontal(|ui| {
                                    ui.add_space(theme::SPACE_SM);
                                    let label = format!("{}  {}", action.icon, action.label);
                                    let clicked = match action.style {
                                        ActionStyle::Primary => {
                                            button::primary_button(ui, &label, action.enabled)
                                                .clicked()
                                        }
                                        ActionStyle::Secondary => {
                                            button::secondary_button(ui, &label, action.enabled)
                                                .clicked()
                                        }
                                        ActionStyle::Danger => {
                                            button::destructive_button(ui, &label, action.enabled)
                                                .clicked()
                                        }
                                    };
                                    if clicked {
                                        clicked_action = Some(idx);
                                    }
                                });
                                ui.add_space(theme::SPACE_XS);
                            }
                        }

                        ui.add_space(theme::SPACE_XL);
                    });
            });

        if should_close {
            *open = false;
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

/// Render a key-value field with colored value.
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
                    .color(color)
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

    egui::Frame::new()
        .fill(theme::bg_tertiary())
        .corner_radius(CornerRadius::same(theme::ROUNDING_SM))
        .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
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

    egui::Frame::new()
        .fill(theme::bg_tertiary())
        .corner_radius(CornerRadius::same(theme::ROUNDING_SM))
        .inner_margin(egui::Margin::same(theme::SPACE_SM as i8))
        .show(ui, |ui| {
            ui.add(
                egui::Label::new(
                    egui::RichText::new(value)
                        .font(theme::font_mono())
                        .color(theme::text_primary()),
                )
                .wrap_mode(egui::TextWrapMode::Wrap),
            );
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
                egui::RichText::new(format!("{:.0}%", fraction * 100.0))
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
            CornerRadius::same(3),
            theme::bg_tertiary(),
        );
        let fill_w = rect.width() * fraction.clamp(0.0, 1.0);
        if fill_w > 0.0 {
            let fill_rect = egui::Rect::from_min_size(rect.min, egui::vec2(fill_w, bar_height));
            ui.painter()
                .rect_filled(fill_rect, CornerRadius::same(3), color);
        }
    }
    ui.add_space(theme::SPACE_SM);
}
