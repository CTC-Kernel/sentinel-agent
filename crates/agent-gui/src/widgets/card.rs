//! Card container widget (elevated panel).

use egui::{CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// Draw a card container, returns the inner response.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    let is_dark = theme::is_dark_mode();

    // Base shadow: stronger in light mode to lift off white background
    let shadow = if is_dark {
        theme::shadow_md()
    } else {
        theme::shadow_sm()
    };

    let frame_resp = Frame::new()
        .fill(theme::bg_secondary())
        .corner_radius(CornerRadius::same(theme::CARD_ROUNDING))
        .inner_margin(Margin::same(theme::SPACE_LG as i8))
        .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border()))
        .shadow(shadow)
        .show(ui, |ui: &mut egui::Ui| {
            add_contents(ui);
        });

    // Glassmorphism: subtle top-edge highlight for volume and depth
    {
        let rect = frame_resp.response.rect;
        let painter = ui.painter_at(rect);
        
        let r = f32::from(theme::CARD_ROUNDING);
        let color = theme::glass_border_top();
        let stroke = egui::Stroke::new(theme::BORDER_THIN, color);
        
        // Build a path for the top-inner highlight (inner lip)
        // It starts at the beginning of the top-left curve and ends at the end of the top-right curve
        let mut points = Vec::new();
        let segments = 8;
        
        // Top-left arc (from PI to 1.5*PI)
        for i in 0..=segments {
            let t = i as f32 / segments as f32;
            let angle = std::f32::consts::PI + (std::f32::consts::PI * 0.5 * t);
            points.push(egui::pos2(
                rect.left() + r + r * angle.cos() + 1.0,
                rect.top() + r + r * angle.sin() + 1.0,
            ));
        }
        
        // Top-right arc (from 1.5*PI to 2.0*PI)
        for i in 0..=segments {
            let t = i as f32 / segments as f32;
            let angle = (std::f32::consts::PI * 1.5) + (std::f32::consts::PI * 0.5 * t);
            points.push(egui::pos2(
                rect.right() - r + r * angle.cos() - 1.0,
                rect.top() + r + r * angle.sin() + 1.0,
            ));
        }
        
        painter.add(egui::Shape::line(points, stroke));
    }

    // Premium hover effect: elevated shadow + subtle accent border glow
    if ui.rect_contains_pointer(frame_resp.response.rect) {
        let rect = frame_resp.response.rect;
        let hover_shadow = if is_dark {
            theme::shadow_lg()
        } else {
            theme::shadow_md()
        };
        ui.painter().add(
            hover_shadow.as_shape(rect, CornerRadius::same(theme::CARD_ROUNDING)),
        );
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(
                theme::BORDER_THIN,
                theme::ACCENT.linear_multiply(theme::OPACITY_MUTED),
            ),
            egui::epaint::StrokeKind::Outside,
        );
    }
}
