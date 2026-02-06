//! Page header widget.

use egui::Ui;

use crate::theme;

/// Draw a page header with breadcrumb navigation trail.
///
/// `breadcrumbs` is a list of navigation labels, e.g. `&["Pilotage", "Conformité"]`.
/// The last item is rendered as the current (non-clickable) page.
/// Returns the clicked breadcrumb index if any ancestor was clicked.
pub fn page_header_nav(
    ui: &mut Ui,
    breadcrumbs: &[&str],
    title: &str,
    subtitle: Option<&str>,
    help_text: Option<&str>,
) -> Option<usize> {
    let clicked = if breadcrumbs.len() > 1 {
        let result = super::breadcrumb_with_home(ui, breadcrumbs);
        ui.add_space(theme::SPACE_XS);
        result
    } else {
        None
    };
    page_header(ui, title, subtitle, help_text);
    clicked
}

/// Draw a page header with title, optional subtitle and contextual help.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>, help_text: Option<&str>) {
    ui.vertical(|ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                egui::RichText::new(title)
                    .font(theme::font_comex())
                    .color(theme::text_primary())
                    .strong(),
            );

            if let Some(help) = help_text {
                ui.add_space(theme::SPACE_SM);
                super::help_button(ui, help);
            }
        });

        if let Some(sub) = subtitle {
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(sub)
                    .font(theme::font_body())
                    .color(theme::text_tertiary()),
            );
        }

        // Premium accent line with gradient effect
        ui.add_space(theme::SPACE_SM);
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width().min(200.0), 2.0),
            egui::Sense::hover(),
        );

        if ui.is_rect_visible(rect) {
            let shimmer = if theme::is_reduced_motion() {
                0.5
            } else {
                let time = ui.input(|i| i.time);
                ((time * 1.5).sin() * 0.5 + 0.5) as f32
            };

            // Gradient from accent to transparent
            let left_color = theme::ACCENT.linear_multiply(0.8 + shimmer * 0.2);
            let right_color = theme::ACCENT.linear_multiply(0.1);

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
                ui.ctx().request_repaint();
            }
        }
    });
}
