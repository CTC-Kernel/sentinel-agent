//! 24-hour event timeline painter.

use chrono::Utc;
use egui::Ui;

use crate::theme;
use crate::widgets;

use super::types::ThreatEvent;

/// Number of half-hour buckets in 24 hours.
const BUCKET_COUNT: usize = 48;

/// Render a 24-hour event timeline bar.
pub(super) fn event_timeline(ui: &mut Ui, threats: &[ThreatEvent]) {
    let now = Utc::now();
    let secs_24h: i64 = agent_common::constants::SECS_PER_DAY as i64;

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("CHRONOLOGIE DES \u{00c9}V\u{00c9}NEMENTS (24H)")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        // Build buckets: count events + track max severity per bucket
        let mut counts = [0u32; BUCKET_COUNT];
        let mut max_severity = [0u8; BUCKET_COUNT]; // 0=none, 1=low, 2=medium, 3=high, 4=critical

        for t in threats {
            let age_secs = (now - t.timestamp).num_seconds();
            if age_secs < 0 || age_secs >= secs_24h {
                continue;
            }
            let bucket = ((secs_24h - age_secs) as usize * BUCKET_COUNT) / secs_24h as usize;
            let bucket = bucket.min(BUCKET_COUNT - 1);
            counts[bucket] += 1;

            let sev_rank = match t.severity {
                "critical" => 4,
                "high" => 3,
                "medium" => 2,
                "low" => 1,
                _ => 1,
            };
            if sev_rank > max_severity[bucket] {
                max_severity[bucket] = sev_rank;
            }
        }

        let max_count = counts.iter().copied().max().unwrap_or(1).max(1);

        // Draw timeline bar
        let bar_height = 40.0_f32;
        let available_w = ui.available_width();
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(available_w, bar_height),
            egui::Sense::hover(),
        );

        if ui.is_rect_visible(rect) {
            let painter = ui.painter_at(rect);
            let rounding = egui::CornerRadius::same(theme::ROUNDING_SM);
            painter.rect_filled(rect, rounding, theme::bg_tertiary());

            let bucket_w = available_w / BUCKET_COUNT as f32;
            for (i, (&count, &sev)) in counts.iter().zip(max_severity.iter()).enumerate() {
                if count == 0 {
                    continue;
                }

                let color = match sev {
                    4 => theme::ERROR,
                    3 => theme::SEVERITY_HIGH,
                    2 => theme::WARNING,
                    _ => theme::INFO,
                };

                let bar_h = (count as f32 / max_count as f32) * (bar_height - 4.0);
                let x = rect.min.x + i as f32 * bucket_w;
                let bar_rect = egui::Rect::from_min_size(
                    egui::pos2(x + 0.5, rect.max.y - bar_h - 2.0),
                    egui::vec2(bucket_w - 1.0, bar_h),
                );
                painter.rect_filled(bar_rect, theme::ROUNDING_SM, color);
            }

            // Current time marker (accent vertical line on right edge)
            let reduced = theme::is_reduced_motion();
            let marker_x = rect.max.x - 1.0;
            let marker_alpha = if reduced {
                theme::OPACITY_STRONG
            } else {
                let t = ui.input(|i| i.time);
                (0.6 + (t * 2.5).sin() as f32 * 0.4).clamp(0.4, 1.0)
            };
            painter.vline(
                marker_x,
                rect.y_range(),
                egui::Stroke::new(2.0, theme::ACCENT.linear_multiply(marker_alpha)),
            );
        }

        // Hour labels
        ui.add_space(theme::SPACE_XS);
        ui.horizontal(|ui: &mut egui::Ui| {
            let labels = ["00:00", "06:00", "12:00", "18:00", "Maintenant"];
            let positions = [0.0, 0.25, 0.5, 0.75, 1.0];
            let label_area_w = available_w;

            for (label, &pos) in labels.iter().zip(positions.iter()) {
                let x_offset = pos * label_area_w;
                let align = if pos < 0.5 {
                    egui::Align2::LEFT_TOP
                } else if pos > 0.9 {
                    egui::Align2::RIGHT_TOP
                } else {
                    egui::Align2::CENTER_TOP
                };

                let label_rect = ui.min_rect();
                ui.painter().text(
                    egui::pos2(label_rect.min.x + x_offset, label_rect.min.y),
                    align,
                    *label,
                    theme::font_caption(),
                    theme::text_tertiary(),
                );
            }
            // Reserve space for the label row
            ui.allocate_exact_size(egui::vec2(available_w, 12.0), egui::Sense::hover());
        });
    });
}
