//! Page header widget.

use egui::Ui;

use crate::theme;

/// Draw a page header with title and optional subtitle.
pub fn page_header(ui: &mut Ui, title: &str, subtitle: Option<&str>) {
    ui.vertical(|ui| {
        ui.label(
            egui::RichText::new(title)
                .font(theme::font_comex())
                .color(theme::text_primary())
                .strong(),
        );
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
            let time = ui.input(|i| i.time);
            let shimmer = ((time * 1.5).sin() * 0.5 + 0.5) as f32;
            
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
            
            ui.ctx().request_repaint();
        }
    });
}
