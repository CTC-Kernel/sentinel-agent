//! Network Cartography — 2D force-directed graph of discovered devices.

use crate::app::AppState;
use crate::dto::{GuiAgentStatus, GuiDiscoveredDevice};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::{Color32, Pos2, Ui, Vec2};

/// Node in the force-directed graph.
#[derive(Clone)]
struct GraphNode {
    pos: Pos2,
    vel: Vec2,
    device: GuiDiscoveredDevice,
    pinned: bool,
}

/// Edge between two nodes.
struct GraphEdge {
    source: usize,
    target: usize,
}

pub struct CartographyPage;

impl CartographyPage {
    pub fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
        let mut command = None;

        if state.discovery.devices.is_empty() {
            ui.add_space(theme::SPACE_LG);
            widgets::protected_state(
                ui,
                icons::WARNING,
                "AUCUN ACTIF DÉCOUVERT",
                "Veuillez lancer une découverte réseau pour cartographier votre infrastructure.",
            );
            return None;
        }

        ui.add_space(theme::SPACE_MD);
        widgets::page_header_nav(
            ui,
            &["Sys & Network", "Cartographie"],
            "Cartographie Réseau",
            Some("VISUALISATION TOPOLOGIQUE ET ANALYSE DES RELATIONS INTER-ACTIFS"),
            Some(
                "Explorez les relations entre les actifs de votre réseau. Les noeuds représentent les machines et les liens indiquent les interactions détectées. Utilisez le zoom et le panoramique pour naviguer.",
            ),
        );
        ui.add_space(theme::SPACE_LG);

        // Control bar (AAA Grade)
        ui.push_id("cartography_controls", |ui: &mut egui::Ui| {
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "{} NOEUD(S) RÉSEAU",
                            state.discovery.devices.len()
                        ))
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Reset layout button
                    if widgets::secondary_button(ui, "RÉINITIALISER", true).clicked() {
                        state.cartography.layout = None;
                        state.cartography.zoom = 1.0;
                        state.cartography.pan = Vec2::ZERO;
                    }

                    ui.add_space(theme::SPACE_MD);

                    // Zoom indicators (AAA)
                    ui.label(
                        egui::RichText::new(format!(
                            "ZOOM: {:.0}%",
                            state.cartography.zoom * 100.0
                        ))
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong(),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Open 3D view button
                    if widgets::primary_button(ui, format!("VUE 3D {}", icons::EXTERNAL_LINK), true)
                        .clicked()
                        && let Err(e) = open::that(&state.settings.architecture_url) {
                            tracing::warn!("Failed to open URL: {}", e);
                        }

                    ui.add_space(theme::SPACE_MD);

                    // Export CSV
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        Self::export_csv(state);
                    }

                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            let is_scanning = state.summary.status == GuiAgentStatus::Scanning;
                            if widgets::button::primary_button_loading(
                                ui,
                                format!(
                                    "{}  {}",
                                    if is_scanning {
                                        "SCAN EN COURS"
                                    } else {
                                        "LANCER LE SCAN"
                                    },
                                    icons::PLAY
                                ),
                                !is_scanning,
                                is_scanning,
                            )
                            .clicked()
                            {
                                command = Some(GuiCommand::RunCheck);
                            }
                        },
                    );
                });
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Build graph layout if needed (avoid cloning on every frame)
        if state.cartography.layout.is_none() {
            let layout = build_initial_layout(&state.discovery.devices);
            state.cartography.layout = Some(layout);
        }
        let layout = state.cartography.layout.as_mut().expect("layout was just initialized above");

        // Run force simulation only if not yet converged
        if !layout.converged {
            run_force_simulation(layout);
        }

        // Graph viewport (AAA Grade)
        let canvas_size = egui::Vec2::new(ui.available_width(), 500.0);
        let (response, painter) = ui.allocate_painter(canvas_size, egui::Sense::click_and_drag());
        let rect = response.rect;

        // Sophisticated background (AAA)
        painter.rect_filled(
            rect,
            egui::CornerRadius::same(theme::CARD_ROUNDING),
            theme::bg_deep(),
        );

        // Background grid simulation (Subtle institutional lines)
        let grid_color = theme::border().linear_multiply(theme::OPACITY_SUBTLE);
        for i in 1..8 {
            let x = rect.min.x + (rect.width() * i as f32 / 8.0);
            painter.line_segment(
                [egui::pos2(x, rect.min.y), egui::pos2(x, rect.max.y)],
                egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
            );
            let y = rect.min.y + (rect.height() * i as f32 / 8.0);
            painter.line_segment(
                [egui::pos2(rect.min.x, y), egui::pos2(rect.max.x, y)],
                egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
            );
        }

        // Handle pan
        if response.dragged() {
            state.cartography.pan += response.drag_delta();
        }

        // Handle zoom via scroll
        let scroll = ui.input(|i| i.smooth_scroll_delta.y);
        if scroll != 0.0 {
            state.cartography.zoom = (state.cartography.zoom + scroll * 0.002).clamp(0.3, 3.0);
        }

        let center = rect.center().to_vec2() + state.cartography.pan;
        let zoom = state.cartography.zoom;

        // Draw edges (AAA grade subtlety)
        for edge in &layout.edges {
            if edge.source < layout.nodes.len() && edge.target < layout.nodes.len() {
                let p1 = Pos2::new(
                    layout.nodes[edge.source].pos.x * zoom + center.x,
                    layout.nodes[edge.source].pos.y * zoom + center.y,
                );
                let p2 = Pos2::new(
                    layout.nodes[edge.target].pos.x * zoom + center.x,
                    layout.nodes[edge.target].pos.y * zoom + center.y,
                );
                painter.line_segment(
                    [p1, p2],
                    egui::Stroke::new(theme::BORDER_THIN, theme::border().linear_multiply(theme::OPACITY_TINT)),
                );
            }
        }

        let anim_time = ui.input(|i| i.time);

        // Draw nodes (AAA Glow System)
        for (i, node) in layout.nodes.iter().enumerate() {
            let screen_pos = Pos2::new(node.pos.x * zoom + center.x, node.pos.y * zoom + center.y);

            if !rect.contains(screen_pos) {
                continue;
            }

            let color = device_type_color(&node.device.device_type);
            let base_radius = if node.device.is_gateway { 10.0 } else { 7.0 } * zoom;
            let breathing = (anim_time * 1.5 + i as f64 * 0.1).sin().powi(2) as f32;

            // 1. Ambient Ambient Glow
            painter.circle_filled(
                screen_pos,
                base_radius * (1.5 + 0.3 * breathing),
                color.linear_multiply(0.08 + 0.04 * breathing),
            );

            // 2. Core Glow for Gateway or Selected
            let is_selected = state.cartography.selected_device.as_ref() == Some(&node.device.ip);
            if is_selected || node.device.is_gateway {
                let intensity = if is_selected { 0.4 } else { 0.2 };
                painter.circle_filled(
                    screen_pos,
                    base_radius * 2.0,
                    color.linear_multiply(intensity * breathing),
                );
            }

            // 3. Node Body (Glassy / Solid)
            painter.circle_filled(screen_pos, base_radius, color);
            painter.circle_stroke(
                screen_pos,
                base_radius,
                egui::Stroke::new(theme::BORDER_THIN, egui::Color32::from_white_alpha(100)),
            );

            // 4. Label (Institutional AAA)
            let label = node
                .device
                .hostname
                .as_deref()
                .unwrap_or(&node.device.ip)
                .to_uppercase();
            painter.text(
                Pos2::new(screen_pos.x, screen_pos.y + base_radius + 12.0),
                egui::Align2::CENTER_TOP,
                label,
                theme::font_label(),
                theme::text_tertiary(),
            );

            // Click interaction
            let click_radius = base_radius * 2.0;
            let interact_rect =
                egui::Rect::from_center_size(screen_pos, egui::Vec2::splat(click_radius));
            if response.clicked()
                && interact_rect
                    .contains(ui.input(|i| i.pointer.interact_pos().unwrap_or(Pos2::ZERO)))
            {
                state.cartography.selected_device = Some(node.device.ip.clone());
            }
        }

        // Legend (AAA Institutional)
        ui.add_space(theme::SPACE_MD);
        widgets::card(ui, |ui: &mut egui::Ui| {
            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(
                    egui::RichText::new("LÉGENDE INFRASTRUCTURE")
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .extra_letter_spacing(0.5)
                        .strong(),
                );
                ui.add_space(theme::SPACE_MD);
                let legend_items = [
                    ("PASSERELLE", theme::ACCENT),
                    ("SERVEUR", theme::SUCCESS),
                    ("POSTE CLIENT", theme::text_primary()),
                    ("PÉRIPHÉRIQUE", theme::text_tertiary()),
                    ("IOT / EMBARQUÉ", theme::WARNING),
                    ("NON IDENTIFIÉ", theme::text_secondary()),
                ];
                for (label, color) in legend_items {
                    let (dot_rect, _) =
                        ui.allocate_exact_size(egui::vec2(8.0, 8.0), egui::Sense::hover());
                    ui.painter().circle_filled(dot_rect.center(), 4.0, color);
                    ui.label(
                        egui::RichText::new(label)
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong(),
                    );
                    ui.add_space(theme::SPACE_SM);
                }
            });
        });

        // Selected Object Detail Panel (AAA Grade)
        if let Some(ref selected_ip) = state.cartography.selected_device.clone()
            && let Some(device) = state
                .discovery
                .devices
                .iter()
                .find(|d| &d.ip == selected_ip)
        {
            ui.add_space(theme::SPACE_MD);
            widgets::card(ui, |ui: &mut egui::Ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(&device.ip)
                            .font(theme::font_body())
                            .strong()
                            .color(theme::text_primary()),
                    );
                    ui.add_space(theme::SPACE_LG);

                    if let Some(ref h) = device.hostname {
                        ui.label(
                            egui::RichText::new(h.to_uppercase())
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    }

                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            if widgets::icon_button(ui, icons::XMARK, Some("Fermer")).clicked() {
                                state.cartography.selected_device = None;
                            }
                        },
                    );
                });

                ui.add_space(theme::SPACE_MD);
                ui.separator();
                ui.add_space(theme::SPACE_MD);

                egui::Grid::new("device_detail_grid")
                    .spacing(egui::vec2(24.0, 8.0))
                    .show(ui, |ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new("ADRESSE MAC")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                        ui.label(
                            egui::RichText::new(device.mac.as_deref().unwrap_or("--"))
                                .font(egui::FontId::monospace(11.0)),
                        );
                        ui.end_row();

                        ui.label(
                            egui::RichText::new("CONSTRUCTEUR")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                        ui.label(
                            egui::RichText::new(device.vendor.as_deref().unwrap_or("--")).strong(),
                        );
                        ui.end_row();

                        ui.label(
                            egui::RichText::new("CLASSIFICATION")
                                .font(theme::font_label())
                                .color(theme::text_tertiary())
                                .strong()
                                .extra_letter_spacing(0.5),
                        );
                        ui.label(egui::RichText::new(device.device_type.to_uppercase()).strong());
                        ui.end_row();
                    });

                if device.is_gateway {
                    ui.add_space(theme::SPACE_MD);
                    widgets::status_badge(ui, "CENTRAL GATEWAY", theme::ACCENT);
                }

                if !device.open_ports.is_empty() {
                    ui.add_space(theme::SPACE_MD);
                    ui.label(
                        egui::RichText::new("VECTEURS D'EXPOSITION (PORTS OUVERTS)")
                            .font(theme::font_label())
                            .color(theme::text_tertiary())
                            .strong()
                            .extra_letter_spacing(0.5),
                    );
                    ui.add_space(2.0);
                    ui.label(
                        device
                            .open_ports
                            .iter()
                            .map(|p| p.to_string())
                            .collect::<Vec<_>>()
                            .join(", "),
                    );
                }
            });
        }

        ui.add_space(theme::SPACE_XL);
        // Only request repaint while the force simulation is still converging
        if !layout.converged {
            ui.ctx().request_repaint();
        }
        command
    }

    fn export_csv(state: &AppState) {
        let headers = &["ip", "hostname", "mac", "vendor", "type", "passerelle"];
        let rows: Vec<Vec<String>> = state
            .discovery
            .devices
            .iter()
            .map(|d| {
                vec![
                    d.ip.clone(),
                    d.hostname.clone().unwrap_or_default(),
                    d.mac.clone().unwrap_or_default(),
                    d.vendor.clone().unwrap_or_default(),
                    d.device_type.clone(),
                    if d.is_gateway { "Oui" } else { "Non" }.to_string(),
                ]
            })
            .collect();
        let path = crate::export::default_export_path("cartographie_reseau.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        }
    }
}

/// A stored graph layout.
pub struct GraphLayout {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
    /// Whether the force simulation has converged (kinetic energy below threshold).
    converged: bool,
}

fn device_type_color(device_type: &str) -> Color32 {
    match device_type {
        "router" => theme::ACCENT,
        "server" => theme::SUCCESS,
        "workstation" => theme::text_primary(),
        "printer" => theme::text_tertiary(),
        "iot" => theme::WARNING,
        "phone" => theme::ACCENT_LIGHT,
        _ => theme::text_secondary(),
    }
}

fn build_initial_layout(devices: &[GuiDiscoveredDevice]) -> GraphLayout {
    let n = devices.len();
    if n == 0 {
        return GraphLayout {
            nodes: vec![],
            edges: vec![],
            converged: true,
        };
    }
    let mut nodes = Vec::with_capacity(n);

    // Circular initial layout
    for (i, device) in devices.iter().enumerate() {
        let angle = (i as f32 / n as f32) * std::f32::consts::TAU;
        let radius = 150.0;
        let pos = Pos2::new(angle.cos() * radius, angle.sin() * radius);
        nodes.push(GraphNode {
            pos,
            vel: Vec2::ZERO,
            device: device.clone(),
            pinned: false,
        });
    }

    // Build edges: connect devices on the same subnet, and all to gateway
    let mut edges = Vec::new();
    let gateway_indices: Vec<usize> = nodes
        .iter()
        .enumerate()
        .filter(|(_, n)| n.device.is_gateway)
        .map(|(i, _)| i)
        .collect();

    for (i, node) in nodes.iter().enumerate().take(n) {
        // Connect to gateway(s)
        if !node.device.is_gateway {
            for &gw in &gateway_indices {
                edges.push(GraphEdge {
                    source: i,
                    target: gw,
                });
            }
        }
        // If no gateway, connect sequential nodes to form a chain
        if gateway_indices.is_empty() && i > 0 {
            edges.push(GraphEdge {
                source: i - 1,
                target: i,
            });
        }
    }

    GraphLayout { nodes, edges, converged: false }
}

fn run_force_simulation(layout: &mut GraphLayout) {
    let n = layout.nodes.len();
    if n < 2 {
        return;
    }

    let repulsion = 5000.0;
    let attraction = 0.005;
    let damping = 0.9;
    let center_gravity = 0.01;
    let iterations = 3;

    for _ in 0..iterations {
        // Repulsive forces between all pairs
        for i in 0..n {
            for j in (i + 1)..n {
                let dx = layout.nodes[i].pos.x - layout.nodes[j].pos.x;
                let dy = layout.nodes[i].pos.y - layout.nodes[j].pos.y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt().max(1.0);
                let force = repulsion / dist_sq.max(100.0);
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                if !layout.nodes[i].pinned {
                    layout.nodes[i].vel.x += fx;
                    layout.nodes[i].vel.y += fy;
                }
                if !layout.nodes[j].pinned {
                    layout.nodes[j].vel.x -= fx;
                    layout.nodes[j].vel.y -= fy;
                }
            }
        }

        // Attractive forces along edges
        for edge in &layout.edges {
            if edge.source >= n || edge.target >= n {
                continue;
            }
            let dx = layout.nodes[edge.target].pos.x - layout.nodes[edge.source].pos.x;
            let dy = layout.nodes[edge.target].pos.y - layout.nodes[edge.source].pos.y;
            let _dist = (dx * dx + dy * dy).sqrt().max(1.0);
            let fx = dx * attraction;
            let fy = dy * attraction;

            if !layout.nodes[edge.source].pinned {
                layout.nodes[edge.source].vel.x += fx;
                layout.nodes[edge.source].vel.y += fy;
            }
            if !layout.nodes[edge.target].pinned {
                layout.nodes[edge.target].vel.x -= fx;
                layout.nodes[edge.target].vel.y -= fy;
            }
        }

        // Center gravity
        for node in layout.nodes.iter_mut() {
            if !node.pinned {
                node.vel.x -= node.pos.x * center_gravity;
                node.vel.y -= node.pos.y * center_gravity;
            }
        }

        // Apply velocities with damping
        for node in layout.nodes.iter_mut() {
            if !node.pinned {
                node.vel *= damping;
                // Limit velocity
                let speed = node.vel.length();
                if speed > 10.0 {
                    node.vel = node.vel / speed * 10.0;
                }
                node.pos.x += node.vel.x;
                node.pos.y += node.vel.y;
            }
        }
    }

    // Check convergence: sum of velocity magnitudes
    let total_kinetic: f32 = layout.nodes.iter().map(|n| n.vel.length()).sum();
    layout.converged = total_kinetic < 0.1;
}
