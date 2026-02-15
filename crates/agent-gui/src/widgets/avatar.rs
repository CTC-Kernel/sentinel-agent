//! Avatar widget for displaying user/entity identities.

use crate::theme;
use egui::{Color32, CornerRadius, Ui};

/// Avatar size variants.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum AvatarSize {
    XSmall,
    Small,
    #[default]
    Medium,
    Large,
    XLarge,
}

impl AvatarSize {
    fn pixels(&self) -> f32 {
        match self {
            AvatarSize::XSmall => 24.0,
            AvatarSize::Small => 32.0,
            AvatarSize::Medium => 40.0,
            AvatarSize::Large => 56.0,
            AvatarSize::XLarge => 80.0,
        }
    }

    fn font(&self) -> egui::FontId {
        match self {
            AvatarSize::XSmall => theme::font_label(),
            AvatarSize::Small => theme::font_small(),
            AvatarSize::Medium => theme::font_body(),
            AvatarSize::Large => theme::font_heading(),
            AvatarSize::XLarge => theme::font_title(),
        }
    }
}

/// Avatar shape.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum AvatarShape {
    #[default]
    Circle,
    Rounded,
    Square,
}

/// Avatar status indicator.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AvatarStatus {
    Online,
    Away,
    Busy,
    Offline,
}

impl AvatarStatus {
    fn color(&self) -> Color32 {
        match self {
            AvatarStatus::Online => theme::SUCCESS,
            AvatarStatus::Away => theme::WARNING,
            AvatarStatus::Busy => theme::ERROR,
            AvatarStatus::Offline => theme::INFO,
        }
    }
}

/// An avatar widget for displaying user/entity identities.
pub struct Avatar<'a> {
    name: &'a str,
    size: AvatarSize,
    shape: AvatarShape,
    color: Option<Color32>,
    status: Option<AvatarStatus>,
    icon: Option<&'a str>,
}

impl<'a> Avatar<'a> {
    /// Create a new avatar with initials from the name.
    pub fn new(name: &'a str) -> Self {
        Self {
            name,
            size: AvatarSize::Medium,
            shape: AvatarShape::Circle,
            color: None,
            status: None,
            icon: None,
        }
    }

    /// Create an avatar with an icon instead of initials.
    pub fn icon(icon: &'a str) -> Self {
        Self {
            name: "",
            size: AvatarSize::Medium,
            shape: AvatarShape::Circle,
            color: None,
            status: None,
            icon: Some(icon),
        }
    }

    /// Set the avatar size.
    pub fn size(mut self, size: AvatarSize) -> Self {
        self.size = size;
        self
    }

    /// Set the avatar shape.
    pub fn shape(mut self, shape: AvatarShape) -> Self {
        self.shape = shape;
        self
    }

    /// Set a custom background color.
    pub fn color(mut self, color: Color32) -> Self {
        self.color = Some(color);
        self
    }

    /// Add a status indicator.
    pub fn status(mut self, status: AvatarStatus) -> Self {
        self.status = Some(status);
        self
    }

    /// Generate initials from name.
    fn initials(&self) -> String {
        let words: Vec<&str> = self.name.split_whitespace().collect();
        match words.len() {
            0 => "?".to_string(),
            1 => words[0].chars().take(2).collect::<String>().to_uppercase(),
            _ => {
                let first = words[0].chars().next().unwrap_or('?');
                let last = words[words.len() - 1].chars().next().unwrap_or('?');
                format!("{}{}", first, last).to_uppercase()
            }
        }
    }

    /// Generate a color from the name (for consistency).
    fn generate_color(&self) -> Color32 {
        if let Some(color) = self.color {
            return color;
        }

        // Generate a consistent color from the name hash
        let mut hash: u32 = 0;
        for c in self.name.chars() {
            hash = hash.wrapping_mul(31).wrapping_add(c as u32);
        }

        theme::AVATAR_COLORS[(hash as usize) % theme::AVATAR_COLORS.len()]
    }

    /// Show the avatar.
    pub fn show(self, ui: &mut Ui) -> egui::Response {
        let size = self.size.pixels();
        let (rect, response) = ui.allocate_exact_size(egui::vec2(size, size), egui::Sense::click());

        if ui.is_rect_visible(rect) {
            let painter = ui.painter();
            let bg_color = self.generate_color();
            let text_color = theme::text_on_accent();

            // Draw background shape
            let rounding = match self.shape {
                AvatarShape::Circle => CornerRadius::same((size / 2.0).min(255.0) as u8),
                AvatarShape::Rounded => CornerRadius::same((size * 0.2).min(255.0) as u8),
                AvatarShape::Square => CornerRadius::same(0),
            };

            painter.rect_filled(rect, rounding, bg_color);

            // Draw content (icon or initials)
            let content = if let Some(icon) = self.icon {
                icon.to_string()
            } else {
                self.initials()
            };

            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                &content,
                self.size.font(),
                text_color,
            );

            // Draw status indicator
            if let Some(status) = self.status {
                let status_size = size * 0.25;
                let status_pos = egui::pos2(
                    rect.max.x - status_size / 2.0,
                    rect.max.y - status_size / 2.0,
                );

                // White border around status
                painter.circle_filled(status_pos, status_size / 2.0 + 1.5, theme::bg_primary());
                painter.circle_filled(status_pos, status_size / 2.0, status.color());
            }

            // Hover effect
            if response.hovered() {
                painter.rect(
                    rect,
                    rounding,
                    theme::overlay_color().linear_multiply(theme::OPACITY_SUBTLE),
                    egui::Stroke::NONE,
                    egui::epaint::StrokeKind::Inside,
                );
            }

            // Focus Ring (WCAG 2.4.7)
            if response.has_focus() {
                match self.shape {
                    AvatarShape::Circle => {
                        painter.circle_stroke(
                            rect.center(),
                            size / 2.0 + 3.0,
                            theme::focus_ring(),
                        );
                    }
                    _ => {
                        painter.rect_stroke(
                            rect.expand(2.0),
                            rounding,
                            theme::focus_ring(),
                            egui::epaint::StrokeKind::Outside,
                        );
                    }
                }
            }
        }

        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    }
}

/// Simple avatar from name.
pub fn avatar(ui: &mut Ui, name: &str) -> egui::Response {
    Avatar::new(name).show(ui)
}

/// Small avatar.
pub fn avatar_small(ui: &mut Ui, name: &str) -> egui::Response {
    Avatar::new(name).size(AvatarSize::Small).show(ui)
}

/// Large avatar.
pub fn avatar_large(ui: &mut Ui, name: &str) -> egui::Response {
    Avatar::new(name).size(AvatarSize::Large).show(ui)
}

/// Avatar with status.
pub fn avatar_with_status(ui: &mut Ui, name: &str, status: AvatarStatus) -> egui::Response {
    Avatar::new(name).status(status).show(ui)
}

/// Icon avatar (for entities/systems).
pub fn avatar_icon(ui: &mut Ui, icon: &str) -> egui::Response {
    Avatar::icon(icon).show(ui)
}

/// Avatar group showing multiple avatars with overlap.
pub fn avatar_group(ui: &mut Ui, names: &[&str], max_shown: usize) -> egui::Response {
    if names.is_empty() {
        let (_, response) = ui.allocate_exact_size(egui::vec2(0.0, 0.0), egui::Sense::hover());
        return response;
    }

    let size = AvatarSize::Small.pixels();
    let overlap = size * 0.3;
    let count = names.len();
    let shown = count.min(max_shown);
    let has_overflow = count > max_shown;

    let total_width = size
        + shown.saturating_sub(1) as f32 * (size - overlap)
        + if has_overflow { size - overlap } else { 0.0 };

    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(total_width, size), egui::Sense::hover());

    if ui.is_rect_visible(rect) {
        let mut x = rect.min.x;

        for name in names.iter().take(shown) {
            let avatar_rect =
                egui::Rect::from_min_size(egui::pos2(x, rect.min.y), egui::vec2(size, size));

            // Draw avatar
            let avatar = Avatar::new(name).size(AvatarSize::Small);
            let bg_color = avatar.generate_color();

            // White border for overlap clarity
            ui.painter()
                .circle_filled(avatar_rect.center(), size / 2.0 + 1.5, theme::bg_primary());
            ui.painter()
                .circle_filled(avatar_rect.center(), size / 2.0, bg_color);
            ui.painter().text(
                avatar_rect.center(),
                egui::Align2::CENTER_CENTER,
                avatar.initials(),
                AvatarSize::Small.font(),
                theme::text_on_accent(),
            );

            x += size - overlap;
        }

        // Overflow indicator
        if has_overflow {
            let overflow_count = count - max_shown;
            let overflow_rect =
                egui::Rect::from_min_size(egui::pos2(x, rect.min.y), egui::vec2(size, size));

            ui.painter().circle_filled(
                overflow_rect.center(),
                size / 2.0 + 1.5,
                theme::bg_primary(),
            );
            ui.painter()
                .circle_filled(overflow_rect.center(), size / 2.0, theme::bg_tertiary());
            ui.painter().text(
                overflow_rect.center(),
                egui::Align2::CENTER_CENTER,
                format!("+{}", overflow_count),
                AvatarSize::Small.font(),
                theme::text_secondary(),
            );
        }
    }

    response
}
