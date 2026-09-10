// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Card container.
//!
//! Depth comes from three quiet cues stacked in order — a two-layer shadow, a
//! surface one step up the ladder, and a hairline rim with a lit top edge.
//! The previous implementation hand-drew a shimmer arc across each corner and
//! an accent glow on hover; at 20 cards on a dashboard that reads as noise,
//! and it is the single fastest way to make an interface look dated.

use egui::{CornerRadius, Frame, Margin, Ui};

use crate::theme;

/// How much a card lifts as the pointer crosses it.
const HOVER_LIFT: f32 = 0.55;

/// Card surface treatment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CardVariant {
    /// Standard raised card.
    #[default]
    Elevated,
    /// No shadow — for cards inside an already-elevated surface (drawers,
    /// modals) where a second shadow would only muddy the stack.
    Flat,
    /// Destructive context: tinted surface with a semantic border.
    Danger,
}

/// A card container, configured before it is shown.
pub struct Card {
    variant: CardVariant,
    padding: f32,
    accent: Option<egui::Color32>,
    interactive: bool,
}

impl Default for Card {
    fn default() -> Self {
        Self {
            variant: CardVariant::Elevated,
            padding: theme::SPACE_LG,
            accent: None,
            interactive: false,
        }
    }
}

impl Card {
    /// A standard elevated card.
    pub fn new() -> Self {
        Self::default()
    }

    /// Surface treatment.
    pub fn variant(mut self, variant: CardVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Inner padding, overriding the default 24px.
    pub fn padding(mut self, padding: f32) -> Self {
        self.padding = padding;
        self
    }

    /// Paint a semantic accent bar down the leading edge.
    pub fn accent(mut self, color: egui::Color32) -> Self {
        self.accent = Some(color);
        self
    }

    /// Respond to hover with a lift. Set automatically by `clickable_card`.
    pub fn interactive(mut self, interactive: bool) -> Self {
        self.interactive = interactive;
        self
    }

    /// Render the card, returning the rect it occupied.
    pub fn show(self, ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) -> egui::Rect {
        let radius = CornerRadius::same(theme::CARD_ROUNDING);
        let horizontal_parent = ui.layout().main_dir().is_horizontal();

        // Reserve the shadow slots before the surface is drawn: the card's
        // geometry is only known afterwards, and a shadow appended later
        // would paint over the content it is meant to sit behind.
        let shadow_slots: Option<[egui::layers::ShapeIdx; 4]> = (self.variant != CardVariant::Flat)
            .then(|| std::array::from_fn(|_| ui.painter().add(egui::Shape::Noop)));

        let (fill, stroke) = match self.variant {
            CardVariant::Danger => (
                theme::tinted_surface(theme::ERROR),
                egui::Stroke::new(
                    theme::BORDER_THIN,
                    theme::readable_color(theme::ERROR).linear_multiply(theme::OPACITY_MEDIUM),
                ),
            ),
            _ => (
                theme::bg_secondary(),
                egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border_subtle()),
            ),
        };

        let inner = Frame::new()
            .fill(fill)
            .corner_radius(radius)
            .inner_margin(Margin::same(self.padding as i8))
            .stroke(stroke)
            .show(ui, |ui: &mut Ui| {
                if self.accent.is_some() {
                    // Reserve the accent bar's width so text never collides
                    // with it, whatever the caller puts inside.
                    ui.add_space(theme::SPACE_XS);
                }
                // A card stacks its contents, whatever layout it was called
                // from. Without this, a card placed inside a horizontal row
                // inherits that direction and lays its own children out
                // side by side — which is not what "card" means anywhere.
                ui.with_layout(egui::Layout::top_down(egui::Align::Min), |ui: &mut Ui| {
                    // In a vertical stack a card spans its column, the way a
                    // panel is expected to; call sites had to remember
                    // `set_width` and mostly did not, leaving pages with
                    // cards sized to their longest line. Inside a horizontal
                    // row the available width is the rest of the row, so the
                    // card is left to size itself to its content.
                    if !horizontal_parent {
                        ui.set_width(ui.available_width());
                    }
                    add_contents(ui);
                });
            });

        let rect = inner.response.rect;

        if let Some(slots) = shadow_slots {
            let resting = theme::elevation_shapes(rect, radius, theme::Elevation::Level2, 1.0);
            // Hover adds a second, deeper shadow over the resting one, so the
            // card rises rather than merely darkening.
            let lift = if self.interactive {
                ui.ctx().animate_bool_with_time(
                    ui.id()
                        .with(("card_lift", rect.min.x as i32, rect.min.y as i32)),
                    ui.rect_contains_pointer(rect),
                    theme::ANIM_FAST,
                )
            } else {
                0.0
            };
            let hover =
                theme::elevation_shapes(rect, radius, theme::Elevation::Level3, lift * HOVER_LIFT);
            for (slot, shape) in slots.into_iter().zip(resting.into_iter().chain(hover)) {
                ui.painter().set(slot, shape);
            }
        }

        if self.variant != CardVariant::Danger {
            theme::paint_surface_rim(ui.painter(), rect, radius);
        }

        if let Some(color) = self.accent {
            let bar = egui::Rect::from_min_size(
                rect.left_top() + egui::vec2(0.0, f32::from(theme::CARD_ROUNDING)),
                egui::vec2(
                    theme::ACCENT_BAR_WIDTH,
                    rect.height() - f32::from(theme::CARD_ROUNDING) * 2.0,
                ),
            );
            ui.painter().rect_filled(
                bar,
                CornerRadius::same(theme::ROUNDING_XS),
                theme::readable_color(color),
            );
        }

        rect
    }
}

/// Draw a card container.
pub fn card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Card::new().show(ui, add_contents);
}

/// Draw a card with no shadow, for use inside drawers and modals.
pub fn flat_card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Card::new()
        .variant(CardVariant::Flat)
        .show(ui, add_contents);
}

/// Draw a danger/destructive card container (red-tinted).
pub fn danger_card(ui: &mut Ui, add_contents: impl FnOnce(&mut Ui)) {
    Card::new()
        .variant(CardVariant::Danger)
        .show(ui, add_contents);
}

/// Draw a clickable card container. Returns a `Response` with click sensing
/// and a pointer cursor on hover.
pub fn clickable_card(
    ui: &mut Ui,
    id_salt: impl std::hash::Hash,
    add_contents: impl FnOnce(&mut Ui),
) -> egui::Response {
    let rect = Card::new().interactive(true).show(ui, add_contents);
    let response = ui.interact(rect, ui.id().with(id_salt), egui::Sense::click());

    if response.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        // A one-pixel accent rim is enough to say "this one is actionable"
        // once the shadow has already lifted.
        ui.painter().rect_stroke(
            rect,
            CornerRadius::same(theme::CARD_ROUNDING),
            egui::Stroke::new(
                theme::BORDER_THIN,
                theme::ACCENT.linear_multiply(theme::OPACITY_MODERATE),
            ),
            egui::epaint::StrokeKind::Inside,
        );
    }

    // Focus ring for keyboard navigation (WCAG 2.4.7)
    if response.has_focus() {
        ui.painter().rect_stroke(
            rect.expand(2.0),
            CornerRadius::same(theme::CARD_ROUNDING + 2),
            theme::focus_ring(),
            egui::epaint::StrokeKind::Outside,
        );
    }
    response
}
