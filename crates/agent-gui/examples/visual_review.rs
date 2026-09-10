// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT
//! Render the real application with isolated synthetic data and save a review PNG.
//! cargo run -p agent-gui --example visual_review -- /tmp/sentinel.png [--light] [--empty] [--compact]
//! No runtime agent is connected. Preferences are not persisted.
use agent_gui::{SentinelApp, dto::*, events::AgentEvent, state::GuiPreferences};
use std::sync::mpsc;

struct Review {
    components: bool,
    light: bool,
    app: SentinelApp,
    output: String,
    requested: bool,
    finished: bool,
    resized: bool,
    target_size: egui::Vec2,
    start: std::time::Instant,
    _events: mpsc::Sender<AgentEvent>,
    _commands: mpsc::Receiver<agent_gui::events::GuiCommand>,
    _enrollment: mpsc::Receiver<agent_gui::enrollment::EnrollmentCommand>,
}
impl eframe::App for Review {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        if self.finished {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            return;
        }
        let screenshot = ctx.input(|i| {
            i.events.iter().find_map(|event| {
                if let egui::Event::Screenshot { image, .. } = event {
                    Some(image.clone())
                } else {
                    None
                }
            })
        });
        if let Some(image) = screenshot {
            let bytes: Vec<u8> = image.pixels.iter().flat_map(|p| p.to_array()).collect();
            image::save_buffer(
                &self.output,
                &bytes,
                image.width() as u32,
                image.height() as u32,
                image::ColorType::Rgba8,
            )
            .expect("save review image");
            self.finished = true;
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            return;
        }
        if self.components {
            agent_gui::theme::apply_theme(ctx, !self.light);
            component_review(ctx);
        } else {
            self.app.update(ctx, frame);
        }
        // The application expands its splash window after startup; apply the
        // review dimensions after that transition, before requesting the image.
        if !self.resized && self.start.elapsed().as_secs_f32() > 5.0 {
            ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(self.target_size));
            self.resized = true;
        }
        if !self.requested && self.start.elapsed().as_secs_f32() > 9.0 {
            ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(Default::default()));
            self.requested = true;
        }
        ctx.request_repaint_after(std::time::Duration::from_millis(50));
    }
}
fn main() -> Result<(), eframe::Error> {
    let args: Vec<String> = std::env::args().collect();
    let output = args.get(1).expect("output PNG path").clone();
    let light = args.iter().any(|a| a == "--light");
    let empty = args.iter().any(|a| a == "--empty");
    let compact = args.iter().any(|a| a == "--compact");
    let (tx, rx) = mpsc::channel();
    let (commands, command_rx) = mpsc::channel();
    let (enroll, enroll_rx) = mpsc::channel();
    if !empty {
        let now = chrono::Utc::now();
        tx.send(AgentEvent::StatusChanged {
            summary: AgentSummary {
                status: GuiAgentStatus::Connected,
                organization: Some("ATELIER · DÉMONSTRATION".into()),
                hostname: "POSTE-DEMO-01".into(),
                compliance_score: Some(87.0),
                last_check_at: Some(now),
                last_sync_at: Some(now),
                policy_summary: Some(GuiPolicySummary {
                    total_policies: 48,
                    passing: 42,
                    failing: 6,
                    errors: 0,
                    pending: 0,
                }),
                ..Default::default()
            },
        })
        .unwrap();
        tx.send(AgentEvent::VulnerabilityUpdate {
            summary: GuiVulnerabilitySummary {
                critical: 2,
                high: 5,
                medium: 8,
                low: 3,
                last_scan_at: Some(now),
            },
        })
        .unwrap();
        for i in 0..48 {
            tx.send(AgentEvent::CheckCompleted {
                result: GuiCheckResult {
                    check_id: format!("demo-{i}"),
                    name: format!("Contrôle de démonstration {}", i + 1),
                    category: "system".into(),
                    status: if i < 42 {
                        GuiCheckStatus::Pass
                    } else {
                        GuiCheckStatus::Fail
                    },
                    severity: Severity::Medium,
                    score: Some(if i < 42 { 100 } else { 0 }),
                    message: None,
                    details: None,
                    executed_at: Some(now),
                    frameworks: vec![],
                },
            })
            .unwrap();
        }
        let samples = tx.clone();
        std::thread::spawn(move || {
            for i in 0..40 {
                samples
                    .send(AgentEvent::ResourceUpdate {
                        usage: GuiResourceUsage {
                            cpu_percent: 22.0 + (i as f64 * 0.32).sin() * 9.0,
                            memory_percent: 43.0 + (i as f64 * 0.12).sin() * 3.0,
                            uptime_secs: i * 5,
                            memory_total_mb: 16384,
                            memory_used_mb: 7200,
                            ..Default::default()
                        },
                    })
                    .unwrap();
                std::thread::sleep(std::time::Duration::from_millis(150));
            }
        });
        tx.send(AgentEvent::NetworkUpdate {
            interfaces_count: 3,
            connections_count: 24,
            alerts_count: 1,
            primary_ip: None,
            primary_mac: None,
        })
        .unwrap();
    }
    let mut app = SentinelApp::new(true, rx, commands, enroll);
    app.apply_persisted_preferences(GuiPreferences {
        dark_mode: !light,
        ..Default::default()
    });
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size(if compact {
                [1024.0, 900.0]
            } else {
                [1440.0, 1060.0]
            })
            .with_title("Sentinel · revue visuelle"),
        renderer: eframe::Renderer::Wgpu,
        persist_window: false,
        ..Default::default()
    };
    eframe::run_native(
        "Sentinel Review",
        options,
        Box::new(move |cc| {
            agent_gui::theme::configure_fonts(&cc.egui_ctx);
            Ok(Box::new(Review {
                components: args.iter().any(|arg| arg == "--components"),
                light,
                app,
                output,
                requested: false,
                finished: false,
                resized: false,
                target_size: if compact {
                    egui::vec2(1024.0, 800.0)
                } else {
                    egui::vec2(1440.0, 1000.0)
                },
                start: std::time::Instant::now(),
                _events: tx,
                _commands: command_rx,
                _enrollment: enroll_rx,
            }))
        }),
    )
}

fn component_review(ctx: &egui::Context) {
    use agent_gui::{theme, widgets};
    use widgets::data_table::{ColumnWidth, DataTable, SortDirection, TableColumn, TableSort};
    egui::CentralPanel::default()
        .frame(
            egui::Frame::new()
                .fill(theme::bg_primary())
                .inner_margin(32.0),
        )
        .show(ctx, |ui| {
            ui.label(
                egui::RichText::new("SENTINEL / DESIGN REVIEW")
                    .font(theme::font_label())
                    .color(theme::accent_text()),
            );
            ui.add_space(12.0);
            ui.heading("Précision, contraste et simplicité");
            ui.label("Composants réels · données de démonstration");
            ui.add_space(24.0);
            widgets::card(ui, |ui| {
                ui.label(egui::RichText::new("Actions").font(theme::font_heading()));
                ui.add_space(16.0);
                ui.horizontal_wrapped(|ui| {
                    let _ = widgets::primary_button(ui, "Lancer l’analyse", true);
                    let _ = widgets::secondary_button(ui, "Exporter le rapport", true);
                    let _ = widgets::secondary_button(ui, "Indisponible", false);
                    let _ =
                        widgets::button::primary_button_loading(ui, "Analyse en cours", true, true);
                });
                ui.add_space(16.0);
                ui.horizontal_wrapped(|ui| {
                    for (label, color) in [
                        ("Conforme", theme::SUCCESS),
                        ("À vérifier", theme::WARNING),
                        ("Critique", theme::ERROR),
                        ("En cours", theme::INFO),
                    ] {
                        widgets::status_badge(ui, label, color);
                    }
                });
            });
            ui.add_space(24.0);
            widgets::card(ui, |ui| {
                ui.label(egui::RichText::new("Équipements surveillés").font(theme::font_heading()));
                ui.add_space(16.0);
                let table = DataTable::new(
                    "review",
                    vec![
                        TableColumn::new("host", "Équipement")
                            .sortable()
                            .width(ColumnWidth::Fill),
                        TableColumn::new("team", "Équipe").width(ColumnWidth::Percent(22.0)),
                        TableColumn::new("status", "État").width(ColumnWidth::Percent(22.0)),
                        TableColumn::new("seen", "Dernière activité")
                            .sortable()
                            .width(ColumnWidth::Percent(22.0)),
                    ],
                )
                .selectable();
                let mut sort = TableSort::by("host", SortDirection::Ascending);
                table.show_header(ui, &mut sort);
                for (index, row) in [
                    ["MacBook Pro · Camille", "Design", "Conforme", "À l’instant"],
                    [
                        "Serveur Paris · 01",
                        "Infrastructure",
                        "À vérifier",
                        "Il y a 2 min",
                    ],
                    [
                        "ThinkPad · Alexandre",
                        "Finance",
                        "Conforme",
                        "Il y a 5 min",
                    ],
                    [
                        "Passerelle Lyon",
                        "Réseau",
                        "Analyse en cours",
                        "Il y a 8 min",
                    ],
                    [
                        "Serveur sauvegarde",
                        "Infrastructure",
                        "Conforme",
                        "Il y a 12 min",
                    ],
                ]
                .iter()
                .enumerate()
                {
                    table.show_row(ui, index, index == 1, row);
                }
            });
        });
}
