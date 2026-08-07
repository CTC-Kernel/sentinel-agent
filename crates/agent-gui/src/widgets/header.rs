// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Page header widget.

use egui::Ui;

use crate::theme;

/// Draw a page sub-header (subtitle + contextual help + accent line).
///
/// The breadcrumb trail is intentionally **not** rendered. The global top bar
/// already shows the current page, and the sidebar shows its domain grouping,
/// so an inert trail in the body was pure duplication — the intermediate
/// segment is a domain (a sidebar section), not a routable page, so it could
/// not be made meaningfully clickable anyway.
///
/// `breadcrumbs` and `title` are retained in the signature for call-site
/// stability (each page still declares its location in one place). The function
/// always returns `None`: nothing here is clickable.
pub fn page_header_nav(
    ui: &mut Ui,
    breadcrumbs: &[&str],
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) -> Option<usize> {
    let _ = breadcrumbs;
    page_header(ui, title, subtitle, help_text);
    None
}

/// Draw a page sub-header: optional subtitle, contextual help and an accent
/// line.
///
/// The `title` is intentionally **not** rendered here. The global top bar
/// already shows the current page name, so a body-level H1 would duplicate it.
/// The parameter is retained so each page keeps declaring its title in one
/// place at the call site.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>, help_text: Option<&str>) {
    let _ = title; // Surfaced by the global top bar, not repeated in the body.
    ui.vertical(|ui: &mut egui::Ui| {
        if subtitle.is_some() || help_text.is_some() {
            ui.horizontal(|ui: &mut egui::Ui| {
                if let Some(sub) = subtitle {
                    ui.label(
                        egui::RichText::new(sub)
                            .font(theme::font_body())
                            .color(theme::text_secondary()),
                    );
                }

                if let Some(help) = help_text {
                    ui.add_space(theme::SPACE_SM);
                    super::help_button(ui, help);
                }
            });
        }

        // Premium accent line with gradient effect
        ui.add_space(theme::SPACE_SM);
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width().min(200.0), theme::BORDER_THICK),
            egui::Sense::hover(),
        );

        if ui.is_rect_visible(rect) {
            let shimmer = if theme::is_reduced_motion() {
                0.5
            } else {
                let time = ui.input(|i| i.time);
                ((time * theme::ANIM_SKELETON_SPEED as f64).sin() * 0.5 + 0.5) as f32
            };

            // Gradient from accent to transparent
            let left_color = theme::ACCENT
                .linear_multiply(theme::OPACITY_STRONG + shimmer * theme::OPACITY_TINT);
            let right_color = theme::ACCENT.linear_multiply(theme::OPACITY_SUBTLE);

            // Draw gradient line using mesh
            use egui::epaint::{Mesh, Vertex};
            let mut mesh = Mesh::default();
            let idx = mesh.vertices.len() as u32;

            mesh.vertices.push(Vertex {
                pos: rect.left_top(),
                uv: Default::default(),
                color: left_color,
            });
            mesh.vertices.push(Vertex {
                pos: rect.right_top(),
                uv: Default::default(),
                color: right_color,
            });
            mesh.vertices.push(Vertex {
                pos: rect.right_bottom(),
                uv: Default::default(),
                color: right_color,
            });
            mesh.vertices.push(Vertex {
                pos: rect.left_bottom(),
                uv: Default::default(),
                color: left_color,
            });

            mesh.add_triangle(idx, idx + 1, idx + 2);
            mesh.add_triangle(idx + 2, idx + 3, idx);

            ui.painter().add(mesh);

            if !theme::is_reduced_motion() {
                ui.ctx()
                    .request_repaint_after(std::time::Duration::from_millis(100));
            }
        }
    });
}
