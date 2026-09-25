// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Premium animated radar chart for tray-lite dashboard.

use egui::{Color32, Painter, Pos2, Stroke, Ui, Vec2};
use std::f32::consts::TAU;

/// A radar axis data point.
pub struct RadarPoint {
    pub label: String,
    pub value: f32, // 0.0 to 1.0
    pub color: Color32,
}

pub struct TrayRadar {
    pub points: Vec<RadarPoint>,
}

impl TrayRadar {
    pub fn new(
        compliance: f32,
        threats: f32,         // 1.0 = safe, 0.0 = high threat
        vulnerabilities: f32, // 1.0 = safe, 0.0 = high vuln
        resources: f32,       // 1.0 = low usage, 0.0 = saturated
        network: f32,         // 1.0 = stable, 0.0 = alerts
    ) -> Self {
        use crate::theme;
        Self {
            points: vec![
                RadarPoint {
                    label: "CONFORMITÉ".to_string(),
                    value: compliance,
                    color: theme::ACCENT,
                },
                RadarPoint {
                    label: "MENACES".to_string(),
                    value: threats,
                    color: theme::ERROR,
                },
                RadarPoint {
                    label: "VULN".to_string(),
                    value: vulnerabilities,
                    color: theme::WARNING,
                },
                RadarPoint {
                    label: "RESSOURCES".to_string(),
                    value: resources,
                    color: theme::SUCCESS,
                },
                RadarPoint {
                    label: "RÉSEAU".to_string(),
                    value: network,
                    color: theme::INFO,
                },
            ],
        }
    }

    pub fn show(&self, ui: &mut Ui, size: f32) {
        let (rect, response) = ui.allocate_exact_size(Vec2::splat(size), egui::Sense::hover());
        let center = rect.center();
        let radius = size * 0.4;
        let painter = ui.painter();
        let posture = self.points.iter().map(|point| point.value).sum::<f32>()
            / self.points.len().max(1) as f32;
        let reduced = crate::theme::is_reduced_motion();
        let time = if reduced {
            0.0
        } else {
            ui.input(|i| i.time) as f32
        };

        // Quiet glass substrate and continuous aura: the compact popup now
        // reads as a posture instrument rather than a bare chart.
        painter.circle_filled(center, radius + 15.0, crate::theme::bg_deep());
        let mut aura = egui::epaint::Mesh::default();
        aura.vertices.push(egui::epaint::Vertex {
            pos: center,
            uv: egui::epaint::WHITE_UV,
            color: crate::theme::ACCENT.linear_multiply(0.10),
        });
        for index in 0..48_u32 {
            let angle = TAU * index as f32 / 48.0;
            aura.vertices.push(egui::epaint::Vertex {
                pos: center + Vec2::angled(angle) * (radius + 14.0),
                uv: egui::epaint::WHITE_UV,
                color: Color32::TRANSPARENT,
            });
        }
        for index in 0..48_u32 {
            aura.indices
                .extend_from_slice(&[0, index + 1, (index + 1) % 48 + 1]);
        }
        painter.add(egui::Shape::mesh(aura));

        // 1. Background Grid (Web)
        self.draw_grid(painter, center, radius, 5);

        // 2. Animated Glow Layer (skip when reduced motion)
        if !reduced {
            self.draw_glow_poly(painter, center, radius, time);
        }

        // 3. Data Polygon
        self.draw_data_poly(painter, center, radius, time);

        // 4. Labelling
        self.draw_labels(painter, center, radius);

        // Central posture score, visible at a glance from the taskbar popup.
        painter.circle_filled(center, 25.0, crate::theme::bg_elevated());
        painter.circle_stroke(
            center,
            25.0,
            Stroke::new(
                crate::theme::BORDER_THIN,
                crate::theme::score_color(posture * 100.0),
            ),
        );
        painter.text(
            center + Vec2::new(0.0, -3.0),
            egui::Align2::CENTER_CENTER,
            format!("{:.0}", posture * 100.0),
            crate::theme::font_heading(),
            crate::theme::text_primary(),
        );
        painter.text(
            center + Vec2::new(0.0, 11.0),
            egui::Align2::CENTER_CENTER,
            "POSTURE",
            crate::theme::font_micro(),
            crate::theme::text_tertiary(),
        );

        response.on_hover_text(
            self.points
                .iter()
                .map(|point| format!("{} : {:.0}%", point.label, point.value * 100.0))
                .collect::<Vec<_>>()
                .join("\n"),
        );

        if !reduced {
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(100));
        }
    }

    fn draw_grid(&self, painter: &Painter, center: Pos2, radius: f32, steps: usize) {
        use crate::theme;
        let n = self.points.len();

        // Concentric polygons
        for i in 1..=steps {
            let r = radius * (i as f32 / steps as f32);
            let mut pts = Vec::new();
            for j in 0..n {
                let angle = (j as f32 / n as f32) * TAU - TAU / 4.0;
                pts.push(center + Vec2::new(angle.cos() * r, angle.sin() * r));
            }
            pts.push(pts[0]);
            painter.add(egui::Shape::line(
                pts,
                Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border().linear_multiply(theme::OPACITY_MODERATE),
                ),
            ));
        }

        // Radial lines
        for j in 0..n {
            let angle = (j as f32 / n as f32) * TAU - TAU / 4.0;
            let end = center + Vec2::new(angle.cos() * radius, angle.sin() * radius);
            painter.line_segment(
                [center, end],
                Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border().linear_multiply(theme::OPACITY_MEDIUM),
                ),
            );
        }
    }

    fn draw_data_poly(&self, painter: &Painter, center: Pos2, radius: f32, time: f32) {
        use crate::theme;
        let n = self.points.len();
        let mut pts = Vec::new();

        for (i, p) in self.points.iter().enumerate() {
            let angle = (i as f32 / n as f32) * TAU - TAU / 4.0;
            // Add a subtle breathing animation to the value
            let pulse = (time * 1.5 + i as f32).sin() * 0.02;
            let r = radius * (p.value + pulse).clamp(0.05, 1.0);
            pts.push(center + Vec2::new(angle.cos() * r, angle.sin() * r));
        }

        // Fill with gradient-like transparency
        painter.add(egui::Shape::convex_polygon(
            pts.clone(),
            theme::ACCENT.linear_multiply(theme::OPACITY_TINT),
            Stroke::new(theme::BORDER_THICK, theme::ACCENT),
        ));

        // 3. Multi-layered diffuse dots at vertices
        for pt in pts {
            // Main dot
            painter.circle_filled(pt, 2.5, theme::ACCENT);

            // Diffuse glow
            let pulse = (time * 2.0).sin() * 0.5 + 0.5;
            for i in (0..8).rev() {
                let r = 3.0 + i as f32 * 1.5 + pulse * 2.0;
                let alpha = 0.1 / (i as f32 * 0.5 + 1.0).powi(2);
                painter.circle_filled(pt, r, theme::ACCENT.linear_multiply(alpha));
            }
        }
    }

    fn draw_glow_poly(&self, painter: &Painter, center: Pos2, radius: f32, time: f32) {
        use crate::theme;
        // Rotating semi-transparent wedge/scan line
        let scan_angle = (time * 0.5) % TAU - TAU / 4.0;
        let scan_end = center + Vec2::new(scan_angle.cos() * radius, scan_angle.sin() * radius);

        painter.line_segment(
            [center, scan_end],
            Stroke::new(
                theme::BORDER_MEDIUM,
                theme::ACCENT.linear_multiply(theme::OPACITY_DISABLED),
            ),
        );
    }

    fn draw_labels(&self, painter: &Painter, center: Pos2, radius: f32) {
        use crate::theme;
        let n = self.points.len();
        for (i, p) in self.points.iter().enumerate() {
            let angle = (i as f32 / n as f32) * TAU - TAU / 4.0;
            let label_pos =
                center + Vec2::new(angle.cos() * (radius + 25.0), angle.sin() * (radius + 20.0));

            painter.text(
                label_pos,
                egui::Align2::CENTER_CENTER,
                &p.label,
                {
                    use crate::theme::FontIdExt;
                    theme::font_small().size(9.0)
                },
                theme::text_tertiary(),
            );

            painter.text(
                label_pos + Vec2::new(0.0, 10.0),
                egui::Align2::CENTER_CENTER,
                format!("{:.0}%", p.value * 100.0),
                theme::font_micro(),
                theme::readable_color(p.color),
            );
        }
    }
}
