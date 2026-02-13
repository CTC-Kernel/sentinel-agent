//! Progress indicators (bars, steps, circular).

use crate::theme;
use egui::{Color32, CornerRadius, Ui};

/// Progress bar style.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum ProgressStyle {
    #[default]
    Default,
    Success,
    Warning,
    Error,
    Gradient,
}

/// A determinate progress bar.
pub fn progress_bar(ui: &mut Ui, progress: f32) -> egui::Response {
    progress_bar_styled(ui, progress, ProgressStyle::Default, None)
}

/// A progress bar with label.
pub fn progress_bar_with_label(ui: &mut Ui, progress: f32, label: &str) -> egui::Response {
    progress_bar_styled(ui, progress, ProgressStyle::Default, Some(label))
}

/// A styled progress bar.
pub fn progress_bar_styled(
    ui: &mut Ui,
    progress: f32,
    style: ProgressStyle,
    label: Option<&str>,
) -> egui::Response {
    let height = theme::PROGRESS_BAR_HEIGHT;
    let width = ui.available_width();
    let progress = progress.clamp(0.0, 1.0);

    let (rect, response) = ui.allocate_exact_size(egui::vec2(width, height), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);
        let rounding = CornerRadius::same(theme::PROGRESS_BAR_ROUNDING);

        // Track background
        painter.rect_filled(rect, rounding, theme::bg_tertiary());

        // Fill
        if progress > 0.0 {
            let fill_width = rect.width() * progress;
            let fill_rect = egui::Rect::from_min_size(rect.min, egui::vec2(fill_width, height));

            let fill_color = match style {
                ProgressStyle::Default => theme::ACCENT,
                ProgressStyle::Success => theme::SUCCESS,
                ProgressStyle::Warning => theme::WARNING,
                ProgressStyle::Error => theme::ERROR,
                ProgressStyle::Gradient => {
                    // Gradient from warning to success based on progress
                    let r = (theme::WARNING.r() as f32 * (1.0 - progress)
                        + theme::SUCCESS.r() as f32 * progress).clamp(0.0, 255.0) as u8;
                    let g = (theme::WARNING.g() as f32 * (1.0 - progress)
                        + theme::SUCCESS.g() as f32 * progress).clamp(0.0, 255.0) as u8;
                    let b = (theme::WARNING.b() as f32 * (1.0 - progress)
                        + theme::SUCCESS.b() as f32 * progress).clamp(0.0, 255.0) as u8;
                    Color32::from_rgb(r, g, b)
                }
            };

            painter.rect_filled(fill_rect, rounding, fill_color);

            // Animated shine effect (skipped when reduced motion)
            if !theme::is_reduced_motion() {
                let time = ui.input(|i| i.time) as f32;
                let shine_pos = ((time * theme::ANIM_SKELETON_SPEED) % 1.0) * rect.width();
                let shine_width = theme::SPACE_XL + theme::SPACE_SM;
                let shine_rect = egui::Rect::from_min_size(
                    egui::pos2(rect.min.x + shine_pos - shine_width / 2.0, rect.min.y),
                    egui::vec2(shine_width, height),
                )
                .intersect(fill_rect);

                if shine_rect.width() > 0.0 {
                    painter.rect_filled(shine_rect, rounding, Color32::from_white_alpha((theme::OPACITY_SUBTLE * 255.0) as u8));
                }
            }
        }
    }

    // Label below the bar
    if let Some(label_text) = label {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(label_text)
                    .font(theme::font_small())
                    .color(theme::text_secondary()),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(
                    egui::RichText::new(format!("{}%", (progress * 100.0) as u32))
                        .font(theme::font_small())
                        .color(theme::text_secondary())
                        .strong(),
                );
            });
        });
    }

    response
}

/// An indeterminate progress bar (animated).
pub fn progress_bar_indeterminate(ui: &mut Ui) -> egui::Response {
    let height = theme::PROGRESS_BAR_HEIGHT_THIN;
    let width = ui.available_width();

    let (rect, response) = ui.allocate_exact_size(egui::vec2(width, height), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);
        let rounding = CornerRadius::same(theme::PROGRESS_BAR_HEIGHT_THIN as u8 / 2);

        // Track background
        painter.rect_filled(rect, rounding, theme::bg_tertiary());

        if theme::is_reduced_motion() {
            // Static centered bar when reduced motion
            let bar_width = rect.width() * theme::INDETERMINATE_BAR_RATIO;
            let bar_x = rect.min.x + (rect.width() - bar_width) / 2.0;
            let bar_rect = egui::Rect::from_min_size(egui::pos2(bar_x, rect.min.y), egui::vec2(bar_width, height));
            painter.rect_filled(bar_rect, rounding, theme::ACCENT);
        } else {
            // Animated fill
            let time = ui.input(|i| i.time) as f32;
            let cycle = (time * theme::ANIM_INDETERMINATE_SPEED) % 2.0;

            let bar_width = rect.width() * theme::INDETERMINATE_BAR_RATIO;
            let bar_x = if cycle < 1.0 {
                rect.min.x + (rect.width() - bar_width) * cycle
            } else {
                rect.min.x + (rect.width() - bar_width) * (2.0 - cycle)
            };

            let bar_rect = egui::Rect::from_min_size(egui::pos2(bar_x, rect.min.y), egui::vec2(bar_width, height));
            painter.rect_filled(bar_rect, rounding, theme::ACCENT);

            ui.ctx().request_repaint_after(std::time::Duration::from_millis(50));
        }
    }

    response
}

/// A circular progress indicator.
pub fn circular_progress(ui: &mut Ui, progress: f32, size: f32) -> egui::Response {
    circular_progress_styled(ui, progress, size, theme::ACCENT, true)
}

/// A styled circular progress indicator.
pub fn circular_progress_styled(
    ui: &mut Ui,
    progress: f32,
    size: f32,
    color: Color32,
    show_percentage: bool,
) -> egui::Response {
    let progress = progress.clamp(0.0, 1.0);
    let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);
        let center = rect.center();
        let radius = size / 2.0 - theme::SPACE_XS;
        let stroke_width = theme::CIRCULAR_PROGRESS_STROKE;

        // Background circle
        painter.circle_stroke(
            center,
            radius,
            egui::Stroke::new(stroke_width, theme::bg_tertiary()),
        );

        // Progress arc
        if progress > 0.0 {
            let start_angle = -std::f32::consts::FRAC_PI_2; // Start from top

            // Draw arc as segments
            let segments = 60;
            let arc_segments = (segments as f32 * progress) as usize;

            for i in 0..arc_segments {
                let t0 = i as f32 / segments as f32;
                let t1 = (i + 1) as f32 / segments as f32;

                let angle0 = start_angle + t0 * std::f32::consts::TAU;
                let angle1 = start_angle + t1 * std::f32::consts::TAU;

                let p0 = center + egui::vec2(radius * angle0.cos(), radius * angle0.sin());
                let p1 = center + egui::vec2(radius * angle1.cos(), radius * angle1.sin());

                painter.line_segment([p0, p1], egui::Stroke::new(stroke_width, color));
            }
        }

        // Percentage text in center
        if show_percentage {
            painter.text(
                center,
                egui::Align2::CENTER_CENTER,
                format!("{}%", (progress * 100.0) as u32),
                theme::font_heading(),
                theme::text_primary(),
            );
        }
    }

    response
}

/// A step indicator for multi-step processes.
pub fn step_indicator(ui: &mut Ui, steps: &[&str], current_step: usize) {
    let step_count = steps.len();
    let available_width = ui.available_width();
    let step_width = available_width / step_count as f32;

    ui.horizontal(|ui| {
        for (i, step_label) in steps.iter().enumerate() {
            let is_completed = i < current_step;
            let is_current = i == current_step;

            ui.vertical(|ui| {
                ui.set_width(step_width);

                // Step circle and connector
                ui.horizontal(|ui| {
                    // Left connector (except for first step)
                    if i > 0 {
                        let connector_rect = ui
                            .allocate_space(egui::vec2(step_width / 2.0 - 12.0, 2.0))
                            .1;
                        let connector_color = if is_completed || is_current {
                            theme::ACCENT
                        } else {
                            theme::bg_tertiary()
                        };
                        ui.painter().rect_filled(
                            egui::Rect::from_center_size(
                                connector_rect.center(),
                                egui::vec2(connector_rect.width(), 2.0),
                            ),
                            CornerRadius::ZERO,
                            connector_color,
                        );
                    } else {
                        ui.add_space(step_width / 2.0 - 12.0);
                    }

                    // Step circle
                    let circle_size = theme::STEP_CIRCLE_SIZE;
                    let (circle_rect, _) = ui.allocate_exact_size(
                        egui::vec2(circle_size, circle_size),
                        egui::Sense::hover(),
                    );

                    let (circle_color, text_color, border) = if is_completed {
                        (theme::ACCENT, theme::text_on_accent(), None)
                    } else if is_current {
                        (
                            theme::ACCENT.linear_multiply(theme::OPACITY_TINT),
                            theme::ACCENT,
                            Some(egui::Stroke::new(theme::BORDER_THICK, theme::ACCENT)),
                        )
                    } else {
                        (theme::bg_tertiary(), theme::text_tertiary(), None)
                    };

                    ui.painter().circle_filled(
                        circle_rect.center(),
                        circle_size / 2.0,
                        circle_color,
                    );

                    if let Some(stroke) = border {
                        ui.painter()
                            .circle_stroke(circle_rect.center(), circle_size / 2.0, stroke);
                    }

                    // Step number or check mark
                    let step_text = if is_completed {
                        "✓".to_string()
                    } else {
                        (i + 1).to_string()
                    };

                    ui.painter().text(
                        circle_rect.center(),
                        egui::Align2::CENTER_CENTER,
                        step_text,
                        theme::font_small(),
                        text_color,
                    );

                    // Right connector (except for last step)
                    if i < step_count - 1 {
                        let connector_rect = ui
                            .allocate_space(egui::vec2(step_width / 2.0 - 12.0, 2.0))
                            .1;
                        let connector_color = if is_completed {
                            theme::ACCENT
                        } else {
                            theme::bg_tertiary()
                        };
                        ui.painter().rect_filled(
                            egui::Rect::from_center_size(
                                connector_rect.center(),
                                egui::vec2(connector_rect.width(), 2.0),
                            ),
                            CornerRadius::ZERO,
                            connector_color,
                        );
                    }
                });

                // Step label
                ui.add_space(theme::SPACE_XS);
                ui.vertical_centered(|ui| {
                    let label_color = if is_current {
                        theme::text_primary()
                    } else if is_completed {
                        theme::ACCENT
                    } else {
                        theme::text_tertiary()
                    };

                    ui.label(
                        egui::RichText::new(*step_label)
                            .font(theme::font_small())
                            .color(label_color),
                    );
                });
            });
        }
    });
}
