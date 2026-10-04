// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! A live panel that can be opened in a larger, accessible detail modal.
//! The body executes exactly once per frame, including when expanded: forms,
//! filters and commands are the original controls, never a copied snapshot.

use super::{Card, DetailDrawer};
use crate::{icons, theme};
use egui::{Id, Rect, Sense, Ui};

#[derive(Clone, Default)]
struct PanelState {
    open: bool,
    rect: Option<Rect>,
    last_seen: u64,
}

/// Expand a data panel without intercepting its buttons, table rows or plots.
/// Callers in repeated lists should use `push_id` with the item's stable key.
pub fn data_card(ui: &mut Ui, title: &str, content: impl FnOnce(&mut Ui)) {
    let id = ui.next_auto_id().with(("data_card", title));
    // One scope in both modes keeps following siblings' automatic IDs stable.
    ui.scope(|ui| {
        let mut panel = ui
            .ctx()
            .data_mut(|d| d.get_temp::<PanelState>(id).unwrap_or_default());
        let ctx = ui.ctx().clone();
        let frame = ctx.cumulative_pass_nr();
        if frame > panel.last_seen + 1 {
            panel.open = false;
        }
        panel.last_seen = frame;
        let requested = ctx.data_mut(|d| {
            let key = Id::new("requested_data_panel");
            let request = d.get_temp::<(String, u64)>(key);
            if request
                .as_ref()
                .is_some_and(|(name, when)| name == title && frame <= when + 1)
            {
                d.remove::<(String, u64)>(key);
                true
            } else {
                false
            }
        });
        panel.open |= requested;
        if panel.open {
            let height = panel.rect.map_or(100.0, |r| r.height());
            Card::new().show(ui, |ui| {
                ui.set_min_height((height - theme::SPACE_MD * 2.0).max(0.0));
                ui.label(egui::RichText::new(title).color(theme::text_secondary()));
                ui.label("Panneau ouvert en vue détaillée");
            });
            DetailDrawer::new(id, title, icons::CHART_AREA)
                .wide()
                .subtitle("Données et commandes du panneau · Échap pour revenir")
                .show(&ctx, &mut panel.open, content, &[]);
        } else {
            // Register BEFORE descendants: child controls win hit testing.
            // Ignore a stale rectangle after a resize or a layout change.
            let background = panel
                .rect
                .filter(|r| {
                    (r.top() - ui.cursor().top()).abs() < 1.0
                        && (r.width() - ui.available_width()).abs() < 2.0
                })
                .map(|r| ui.interact(r, id.with("background"), Sense::click()));
            let mut expand = false;
            let rect = Card::new().interactive(true).show(ui, |ui| {
                content(ui);
                ui.add_space(theme::SPACE_SM);
                let response = super::button::ghost_button(ui, "Agrandir le panneau")
                    .on_hover_text(format!("Ouvrir {title} avec ses données et commandes"));
                expand = response.clicked();
            });
            panel.rect = Some(rect);
            if let Some(response) = background {
                response.widget_info(|| {
                    egui::WidgetInfo::labeled(
                        egui::WidgetType::Button,
                        true,
                        format!("Agrandir {title}"),
                    )
                });
                if response.has_focus() {
                    ui.painter().rect_stroke(
                        rect.expand(2.0),
                        theme::CARD_ROUNDING as f32,
                        theme::focus_ring(),
                        egui::StrokeKind::Outside,
                    );
                }
                expand |= response
                    .on_hover_cursor(egui::CursorIcon::PointingHand)
                    .clicked();
            }
            if expand {
                panel.open = true;
                ctx.request_repaint();
            }
        }
        // A drill-down requested inside this modal replaces it instead of
        // stacking two analytical panels over the page.
        if ctx
            .data_mut(|d| d.get_temp::<(String, u64)>(Id::new("requested_data_panel")))
            .is_some_and(|(name, when)| name != title && when == frame)
        {
            panel.open = false;
        }
        ctx.data_mut(|d| d.insert_temp(id, panel));
    });
}

/// Open a named panel from an associated metric on this page.
pub fn open_data_panel(ctx: &egui::Context, title: &str) {
    let frame = ctx.cumulative_pass_nr();
    ctx.data_mut(|d| d.insert_temp(Id::new("requested_data_panel"), (title.to_owned(), frame)));
    ctx.request_repaint();
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Harness {
        ctx: egui::Context,
        id: Id,
        child: Rect,
        calls: usize,
        clicks: usize,
    }
    impl Harness {
        fn new() -> Self {
            let ctx = egui::Context::default();
            theme::configure_fonts(&ctx);
            Self {
                ctx,
                id: Id::NULL,
                child: Rect::NOTHING,
                calls: 0,
                clicks: 0,
            }
        }
        fn frame(&mut self, events: Vec<egui::Event>) {
            let ctx = self.ctx.clone();
            let _ = ctx.run(
                egui::RawInput {
                    screen_rect: Some(Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::vec2(960.0, 700.0),
                    )),
                    time: Some(ctx.cumulative_pass_nr() as f64 / 30.0),
                    events,
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        self.id = ui.next_auto_id().with(("data_card", "Mesures"));
                        data_card(ui, "Mesures", |ui| {
                            self.calls += 1;
                            ui.set_min_height(100.0);
                            ui.label(format!("Mesure {}", self.calls));
                            let response = ui.button("Commande du panneau");
                            self.child = response.rect;
                            self.clicks += usize::from(response.clicked());
                        });
                    });
                },
            );
        }
        fn is_open(&self) -> bool {
            self.ctx
                .data_mut(|d| d.get_temp::<PanelState>(self.id).unwrap().open)
        }
        fn click(&mut self, pos: egui::Pos2) {
            for pressed in [true, false] {
                self.frame(vec![
                    egui::Event::PointerMoved(pos),
                    egui::Event::PointerButton {
                        pos,
                        button: egui::PointerButton::Primary,
                        pressed,
                        modifiers: egui::Modifiers::NONE,
                    },
                ]);
            }
        }
    }

    #[test]
    fn child_button_keeps_its_action_without_opening_the_panel() {
        let mut h = Harness::new();
        h.frame(vec![]);
        h.frame(vec![]);
        h.click(h.child.center());
        assert_eq!(h.clicks, 1);
        assert!(!h.is_open());
    }

    #[test]
    fn card_background_opens_live_content_once_per_pass() {
        let mut h = Harness::new();
        h.frame(vec![]);
        h.frame(vec![]);
        let rect = h
            .ctx
            .data_mut(|d| d.get_temp::<PanelState>(h.id).unwrap().rect.unwrap());
        h.click(rect.right_top() + egui::vec2(-20.0, 20.0));
        assert!(h.is_open());
        let before = h.calls;
        h.frame(vec![]);
        assert_eq!(h.calls, before + 1);
        assert!(h.is_open());
        // The command is also usable in the modal.
        for _ in 0..10 {
            h.frame(vec![]);
        }
        h.click(h.child.center());
        assert_eq!(h.clicks, 1);
    }

    #[test]
    fn named_metric_opens_panel_and_escape_returns_to_page() {
        let mut h = Harness::new();
        h.frame(vec![]);
        open_data_panel(&h.ctx, "Mesures");
        h.frame(vec![]);
        h.frame(vec![]);
        assert!(h.is_open());
        h.frame(vec![egui::Event::Key {
            key: egui::Key::Escape,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers: egui::Modifiers::NONE,
        }]);
        assert!(!h.is_open());
    }

    #[test]
    fn focused_panel_opens_with_enter() {
        let mut h = Harness::new();
        h.frame(vec![]);
        h.frame(vec![]);
        h.ctx
            .memory_mut(|m| m.request_focus(h.id.with("background")));
        h.frame(vec![egui::Event::Key {
            key: egui::Key::Enter,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers: egui::Modifiers::NONE,
        }]);
        assert!(h.is_open());
    }
}
