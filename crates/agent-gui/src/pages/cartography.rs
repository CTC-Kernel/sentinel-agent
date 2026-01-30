//! Network Cartography — 2D force-directed graph of discovered devices.

use egui::{Color32, Pos2, Ui, Vec2};
use crate::app::AppState;
use crate::dto::GuiDiscoveredDevice;
use crate::icons;
use crate::theme;
use crate::widgets;

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
    pub fn show(ui: &mut Ui, state: &mut AppState) {
        egui::ScrollArea::vertical()
            .auto_shrink(egui::Vec2b::new(false, false))
            .show(ui, |ui| {
                ui.add_space(theme::SPACE_MD);
                widgets::page_header(
                    ui,
                    "Cartographie R\u{00e9}seau",
                    Some("Visualisation topologique des appareils d\u{00e9}couverts"),
                );
                ui.add_space(theme::SPACE_LG);

                // Controls bar
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(format!(
                                "{} n\u{0153}ud(s)",
                                state.discovered_devices.len()
                            ))
                            .font(theme::font_body())
                            .color(theme::TEXT_SECONDARY),
                        );

                        ui.add_space(theme::SPACE_LG);

                        // Reset layout button
                        let reset_btn = egui::Button::new(
                            egui::RichText::new("R\u{00e9}initialiser")
                                .font(theme::font_small())
                                .color(theme::TEXT_ON_ACCENT),
                        )
                        .fill(theme::ACCENT.linear_multiply(0.7))
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                        if ui.add(reset_btn).clicked() {
                            state.graph_layout = None; // Force re-layout
                            state.graph_zoom = 1.0;
                            state.graph_pan = Vec2::ZERO;
                        }

                        ui.add_space(theme::SPACE_MD);

                        // Zoom controls
                        ui.label(
                            egui::RichText::new(format!("Zoom: {:.0}%", state.graph_zoom * 100.0))
                                .font(theme::font_small())
                                .color(theme::TEXT_TERTIARY),
                        );

                        ui.add_space(theme::SPACE_LG);

                        // Open 3D view button
                        let view3d_btn = egui::Button::new(
                            egui::RichText::new(format!("Voir en 3D {}", icons::EXTERNAL_LINK))
                                .font(theme::font_small())
                                .strong()
                                .color(theme::TEXT_ON_ACCENT),
                        )
                        .fill(theme::SUCCESS.linear_multiply(0.8))
                        .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                        if ui.add(view3d_btn).clicked() {
                            let _ = open::that("https://app.cyber-threat-consulting.com/voxel");
                        }
                    });
                });

                ui.add_space(theme::SPACE_MD);

                if state.discovered_devices.is_empty() {
                    // Empty state
                    widgets::card(ui, |ui| {
                        ui.vertical_centered(|ui| {
                            ui.add_space(theme::SPACE_XL * 3.0);
                            ui.label(
                                egui::RichText::new("Aucun appareil \u{00e0} afficher")
                                    .font(theme::font_heading())
                                    .color(theme::TEXT_TERTIARY),
                            );
                            ui.add_space(theme::SPACE_SM);
                            ui.label(
                                egui::RichText::new(
                                    "Lancez une d\u{00e9}couverte r\u{00e9}seau pour g\u{00e9}n\u{00e9}rer la cartographie",
                                )
                                .font(theme::font_body())
                                .color(theme::TEXT_TERTIARY),
                            );
                            ui.add_space(theme::SPACE_XL * 3.0);
                        });
                    });
                    return;
                }

                // Build graph layout if needed
                let devices = state.discovered_devices.clone();
                let layout = state.graph_layout.get_or_insert_with(|| {
                    build_initial_layout(&devices)
                });

                // Run force simulation
                run_force_simulation(layout);

                // Graph viewport
                let canvas_size = egui::Vec2::new(ui.available_width(), 500.0);
                let (response, painter) = ui.allocate_painter(canvas_size, egui::Sense::click_and_drag());
                let rect = response.rect;

                // Dark background
                painter.rect_filled(
                    rect,
                    egui::CornerRadius::same(theme::CARD_ROUNDING),
                    Color32::from_rgb(12, 12, 14),
                );

                // Handle pan
                if response.dragged() {
                    state.graph_pan += response.drag_delta();
                }

                // Handle zoom via scroll
                let scroll = ui.input(|i| i.smooth_scroll_delta.y);
                if scroll != 0.0 {
                    state.graph_zoom = (state.graph_zoom + scroll * 0.002).clamp(0.3, 3.0);
                }

                let center = rect.center().to_vec2() + state.graph_pan;
                let zoom = state.graph_zoom;

                // Draw edges
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
                            egui::Stroke::new(1.0, theme::BORDER.linear_multiply(0.5)),
                        );
                    }
                }

                // Draw nodes
                for (i, node) in layout.nodes.iter().enumerate() {
                    let screen_pos = Pos2::new(
                        node.pos.x * zoom + center.x,
                        node.pos.y * zoom + center.y,
                    );

                    if !rect.contains(screen_pos) {
                        continue;
                    }

                    let color = device_type_color(&node.device.device_type);
                    let radius = if node.device.is_gateway { 10.0 } else { 7.0 } * zoom;

                    // Glow effect for selected
                    let is_selected = state.graph_selected_device.as_ref() == Some(&node.device.ip);
                    if is_selected {
                        painter.circle_filled(screen_pos, radius + 4.0, color.linear_multiply(0.3));
                    }

                    // Node circle
                    painter.circle_filled(screen_pos, radius, color);
                    painter.circle_stroke(screen_pos, radius, egui::Stroke::new(1.0, Color32::from_white_alpha(40)));

                    // Label
                    let label = node.device.hostname.as_deref().unwrap_or(&node.device.ip);
                    painter.text(
                        Pos2::new(screen_pos.x, screen_pos.y + radius + 10.0),
                        egui::Align2::CENTER_TOP,
                        label,
                        theme::font_small(),
                        theme::TEXT_SECONDARY,
                    );

                    // Click detection
                    let click_rect = egui::Rect::from_center_size(screen_pos, egui::Vec2::splat(radius * 2.5));
                    if response.clicked() {
                        if let Some(pointer_pos) = response.interact_pointer_pos() {
                            if click_rect.contains(pointer_pos) {
                                state.graph_selected_device = Some(node.device.ip.clone());
                            }
                        }
                    }

                    // Tooltip on hover
                    if let Some(hover_pos) = ui.input(|i| i.pointer.hover_pos()) {
                        if click_rect.contains(hover_pos) {
                            egui::show_tooltip_at_pointer(ui.ctx(), ui.layer_id(), ui.id().with(format!("node_{}", i)), |ui: &mut egui::Ui| {
                                ui.label(egui::RichText::new(&node.device.ip).strong());
                                if let Some(ref h) = node.device.hostname {
                                    ui.label(format!("Hostname: {}", h));
                                }
                                if let Some(ref v) = node.device.vendor {
                                    ui.label(format!("Vendor: {}", v));
                                }
                                ui.label(format!("Type: {}", node.device.device_type));
                                if !node.device.open_ports.is_empty() {
                                    ui.label(format!(
                                        "Ports: {}",
                                        node.device.open_ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(", ")
                                    ));
                                }
                            });
                        }
                    }
                }

                // Legend
                ui.add_space(theme::SPACE_MD);
                widgets::card(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("L\u{00e9}gende:")
                                .font(theme::font_small())
                                .strong()
                                .color(theme::TEXT_SECONDARY),
                        );
                        ui.add_space(theme::SPACE_MD);
                        for (label, color) in &[
                            ("Routeur", theme::ACCENT),
                            ("Serveur", theme::SUCCESS),
                            ("Poste", theme::TEXT_PRIMARY),
                            ("Imprimante", theme::TEXT_TERTIARY),
                            ("IoT", theme::WARNING),
                            ("Inconnu", theme::TEXT_SECONDARY),
                        ] {
                            let (dot_rect, _) = ui.allocate_exact_size(egui::Vec2::splat(8.0), egui::Sense::hover());
                            ui.painter().circle_filled(dot_rect.center(), 4.0, *color);
                            ui.label(
                                egui::RichText::new(*label)
                                    .font(theme::font_small())
                                    .color(theme::TEXT_SECONDARY),
                            );
                            ui.add_space(theme::SPACE_SM);
                        }
                    });
                });

                // Detail panel for selected device
                if let Some(ref selected_ip) = state.graph_selected_device.clone() {
                    if let Some(device) = state.discovered_devices.iter().find(|d| &d.ip == selected_ip) {
                        ui.add_space(theme::SPACE_MD);
                        widgets::card(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label(
                                    egui::RichText::new(&device.ip)
                                        .font(theme::font_heading())
                                        .strong()
                                        .color(theme::TEXT_PRIMARY),
                                );
                                ui.add_space(theme::SPACE_MD);
                                if ui.small_button(&format!("{} Fermer", icons::XMARK)).clicked() {
                                    state.graph_selected_device = None;
                                }
                            });
                            ui.add_space(theme::SPACE_SM);
                            if let Some(ref h) = device.hostname {
                                ui.label(format!("Hostname: {}", h));
                            }
                            if let Some(ref mac) = device.mac {
                                ui.label(format!("MAC: {}", mac));
                            }
                            if let Some(ref v) = device.vendor {
                                ui.label(format!("Vendor: {}", v));
                            }
                            ui.label(format!("Type: {}", device.device_type));
                            if device.is_gateway {
                                ui.label(egui::RichText::new("Passerelle d\u{00e9}tect\u{00e9}e").color(theme::ACCENT));
                            }
                            if !device.open_ports.is_empty() {
                                ui.label(format!(
                                    "Ports ouverts: {}",
                                    device.open_ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(", ")
                                ));
                            }
                        });
                    }
                }

                ui.add_space(theme::SPACE_XL);
            });
    }
}

/// A stored graph layout.
pub struct GraphLayout {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
}

fn device_type_color(device_type: &str) -> Color32 {
    match device_type {
        "router" => theme::ACCENT,
        "server" => theme::SUCCESS,
        "workstation" => theme::TEXT_PRIMARY,
        "printer" => theme::TEXT_TERTIARY,
        "iot" => theme::WARNING,
        "phone" => theme::ACCENT_LIGHT,
        _ => theme::TEXT_SECONDARY,
    }
}

fn build_initial_layout(devices: &[GuiDiscoveredDevice]) -> GraphLayout {
    let n = devices.len();
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

    for i in 0..n {
        // Connect to gateway(s)
        if !nodes[i].device.is_gateway {
            for &gw in &gateway_indices {
                edges.push(GraphEdge { source: i, target: gw });
            }
        }
        // If no gateway, connect sequential nodes to form a chain
        if gateway_indices.is_empty() && i > 0 {
            edges.push(GraphEdge { source: i - 1, target: i });
        }
    }

    GraphLayout { nodes, edges }
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
}
