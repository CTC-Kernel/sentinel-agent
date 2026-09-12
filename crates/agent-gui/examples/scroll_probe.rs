// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT
//! Headless probe: render every page the way the shell does, send a wheel
//! tick over the content, and report whether the page scrolled.
//!
//! `cargo run -p agent-gui --all-features --example scroll_probe`
#![allow(clippy::type_complexity)]

// The preview fixtures, whole; the probe only needs `seed` and `select_tab`.
#[allow(dead_code)]
#[path = "preview/fixtures.rs"]
mod fixtures;

use agent_gui::app::AppState;
use agent_gui::{pages, theme};
use eframe::egui;

const PAGES: &[(&str, usize)] = &[
    ("dashboard", 0),
    ("monitoring", 0),
    ("monitoring", 1),
    ("compliance", 0),
    ("compliance", 1),
    ("software", 0),
    ("vulnerabilities", 0),
    ("fim", 0),
    ("threats", 0),
    ("threats", 1),
    ("threats", 2),
    ("threats", 3),
    ("threats", 4),
    ("threats", 5),
    ("threats", 6),
    ("audit", 0),
    ("network", 0),
    ("discovery", 0),
    ("cartography", 0),
    ("assets", 0),
    ("risks", 0),
    ("reports", 0),
    ("reports", 1),
    ("reports", 2),
    ("reports", 3),
    ("notifications", 0),
    ("notifications", 1),
    ("notifications", 2),
    ("sync", 0),
    ("terminal", 0),
    ("settings", 0),
    ("about", 0),
    ("ai", 0),
    ("ai", 1),
    ("ai", 2),
];

fn real_page(ui: &mut egui::Ui, page: &str, state: &mut AppState) {
    match page {
        "compliance" => {
            pages::CompliancePage::show(ui, state);
        }
        "vulnerabilities" => {
            pages::VulnerabilitiesPage::show(ui, state);
        }
        "threats" => {
            pages::ThreatsPage::show(ui, state);
        }
        "settings" => {
            pages::SettingsPage::show(ui, state);
        }
        "assets" => {
            pages::AssetsPage::show(ui, state);
        }
        "network" => {
            pages::NetworkPage::show(ui, state);
        }
        "monitoring" => {
            pages::MonitoringPage::show(ui, state);
        }
        "about" => {
            pages::AboutPage::show(ui);
        }
        "ai" => {
            agent_gui::llm_panel::LLMPanel.show(ui, state);
        }
        "notifications" => {
            pages::NotificationsPage::show(ui, state);
        }
        "reports" => {
            pages::ReportsPage::show(ui, state);
        }
        "risks" => {
            pages::RisksPage::show(ui, state);
        }
        "discovery" => {
            pages::DiscoveryPage::show(ui, state);
        }
        "cartography" => {
            pages::CartographyPage::show(ui, state);
        }
        "terminal" => {
            pages::TerminalPage::show(ui, state);
        }
        "audit" => {
            pages::AuditTrailPage::show(ui, state);
        }
        "fim" => {
            pages::FimPage::show(ui, state);
        }
        "software" => {
            pages::SoftwarePage::show(ui, state);
        }
        "sync" => {
            pages::SyncPage::show(ui, state);
        }
        _ => {
            pages::DashboardPage::show(ui, state);
        }
    }
}

/// Vertical position of the first text shape whose content starts with
/// `needle`, in the shapes egui produced for a frame.
fn text_y(shapes: &[egui::epaint::ClippedShape], needle: &str) -> Option<f32> {
    shapes.iter().find_map(|clipped| match &clipped.shape {
        egui::Shape::Text(text) if text.galley.text().starts_with(needle) => Some(text.pos.y),
        _ => None,
    })
}

/// Open the command palette over the dashboard, search the CVE catalogue and
/// wheel over the result list: the rows must move.
fn probe_palette(width: f32, height: f32) -> bool {
    use agent_gui::widgets;
    let ctx = egui::Context::default();
    theme::configure_fonts(&ctx);
    theme::apply_theme(&ctx, true);
    let mut state = Box::new(AppState::default());
    fixtures::seed(&mut state);
    let mut palette = widgets::CommandPaletteState::new();
    palette.open();
    palette.query = "cve".to_string();
    let commands = agent_gui::app::entity_commands(&state);
    let mut frame = |events: Vec<egui::Event>| {
        let out = ctx.run(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(width, height),
                )),
                events,
                ..Default::default()
            },
            |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    ui.label("page");
                });
                widgets::CommandPalette::new(&commands)
                    .max_results(commands.len())
                    .show(ctx, &mut palette);
            },
        );
        out.shapes
    };
    for _ in 0..3 {
        frame(vec![]);
    }
    let pointer = egui::pos2(width / 2.0, height * 0.2 + 260.0);
    let before = frame(vec![egui::Event::PointerMoved(pointer)]);
    let first = before
        .iter()
        .find_map(|c| match &c.shape {
            egui::Shape::Text(t) if t.galley.text().starts_with("CVE-") => {
                Some(t.galley.text().to_owned())
            }
            _ => None,
        })
        .expect("a CVE row is listed");
    let y0 = text_y(&before, &first).unwrap();
    let mut after = Vec::new();
    for _ in 0..3 {
        after = frame(vec![egui::Event::MouseWheel {
            unit: egui::MouseWheelUnit::Point,
            delta: egui::vec2(0.0, -120.0),
            modifiers: egui::Modifiers::NONE,
        }]);
    }
    for _ in 0..8 {
        after = frame(vec![]);
    }
    let y1 = text_y(&after, &first);
    let moved = y1.is_none_or(|y| y < y0 - 1.0);
    println!(
        "{:<6} palette          {first} y {y0:.0} -> {}",
        if moved { "ok" } else { "STUCK" },
        y1.map_or("gone".to_owned(), |y| format!("{y:.0}"))
    );
    moved
}

fn main() {
    let width: f32 = std::env::var("PROBE_W")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1360.0);
    let height: f32 = std::env::var("PROBE_H")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(820.0);
    let mut failures = 0;
    if !probe_palette(width, height) {
        failures += 1;
    }
    let only = std::env::var("PROBE_PAGE").ok();
    let step: f32 = std::env::var("PROBE_STEP")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(48.0);
    for &(page, tab) in PAGES {
        if only.as_deref().is_some_and(|o| o != page) {
            continue;
        }
        let sweep = std::env::var("PROBE_SWEEP").is_ok();
        let pointers: Vec<egui::Pos2> = if sweep && std::env::var("PROBE_X").is_err() {
            // A grid over the content column: every cell a wheel could land on.
            let mut v = Vec::new();
            let mut y = 40.0;
            while y < height - 20.0 {
                for x in [200.0, width * 0.35, width * 0.55, width * 0.8] {
                    v.push(egui::pos2(x, y));
                }
                y += step;
            }
            v
        } else {
            vec![egui::pos2(
                std::env::var("PROBE_X")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(width * 0.55),
                std::env::var("PROBE_Y")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(height * 0.6),
            )]
        };
        let mut stuck_at: Vec<egui::Pos2> = Vec::new();
        for pointer in pointers {
            let ctx = egui::Context::default();
            theme::configure_fonts(&ctx);
            theme::apply_theme(&ctx, true);
            let mut state = Box::new(AppState::default());
            fixtures::seed(&mut state);
            fixtures::select_tab(&mut state, page, tab);
            let mut scroll_id = None;
            let mut content_height = 0.0_f32;
            let mut frame = |events: Vec<egui::Event>, state: &mut AppState| {
                let _ =
                    ctx.run(
                        egui::RawInput {
                            screen_rect: Some(egui::Rect::from_min_size(
                                egui::Pos2::ZERO,
                                egui::vec2(width, height),
                            )),
                            events,
                            ..Default::default()
                        },
                        |ctx| {
                            egui::CentralPanel::default()
                                .frame(egui::Frame::new().fill(theme::bg_primary()).inner_margin(
                                    egui::Margin::symmetric(0, theme::SPACE_LG as i8),
                                ))
                                .show(ctx, |ui| {
                                    scroll_id =
                                        Some(ui.make_persistent_id(egui::Id::new("probe_scroll")));
                                    let out = egui::ScrollArea::vertical()
                                        .id_salt("probe_scroll")
                                        .auto_shrink(egui::Vec2b::new(false, false))
                                        .show(ui, |ui| {
                                            agent_gui::app::page_column(ui, |ui| {
                                                real_page(ui, page, state)
                                            });
                                        });
                                    content_height = out.content_size.y;
                                });
                        },
                    );
            };
            // Settle caches, then hover, then a wheel tick.
            for _ in 0..3 {
                frame(vec![], &mut state);
            }
            frame(vec![egui::Event::PointerMoved(pointer)], &mut state);
            if let Some(ms) = std::env::var("PROBE_HOVER_MS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
            {
                std::thread::sleep(std::time::Duration::from_millis(ms));
                frame(vec![], &mut state);
            }
            if std::env::var("PROBE_DEBUG").is_ok() {
                let layer = ctx.layer_id_at(pointer);
                println!(
                    "  debug {page}: layer under pointer {:?}, over area {}",
                    layer.map(|l| (l.order, l.id.short_debug_format())),
                    ctx.is_pointer_over_area()
                );
            }
            for _ in 0..3 {
                frame(
                    vec![egui::Event::MouseWheel {
                        unit: egui::MouseWheelUnit::Point,
                        delta: egui::vec2(0.0, -120.0),
                        modifiers: egui::Modifiers::NONE,
                    }],
                    &mut state,
                );
            }
            for _ in 0..8 {
                frame(vec![], &mut state);
            }
            let offset = scroll_id
                .and_then(|id| egui::scroll_area::State::load(&ctx, id))
                .map(|s| s.offset.y)
                .unwrap_or(f32::NAN);
            let scrollable = content_height > height - 2.0 * theme::SPACE_LG;
            let ok = !scrollable || offset > 1.0;
            if !ok {
                stuck_at.push(pointer);
            }
            if !sweep {
                println!(
                    "{:<6} {page:<16} tab {tab}  content {content_height:>7.0}px  offset {offset:>6.1}",
                    if ok { "ok" } else { "STUCK" }
                );
            }
        }
        if !stuck_at.is_empty() {
            failures += 1;
        }
        if sweep {
            let spots: Vec<String> = stuck_at
                .iter()
                .map(|p| format!("({:.0},{:.0})", p.x, p.y))
                .collect();
            println!(
                "{:<6} {page:<16} tab {tab}  {}",
                if stuck_at.is_empty() { "ok" } else { "STUCK" },
                spots.join(" ")
            );
        }
    }
    if failures > 0 {
        eprintln!("{failures} page(s) did not scroll");
        std::process::exit(1);
    }
}
