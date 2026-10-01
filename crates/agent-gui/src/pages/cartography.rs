// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network Cartography — 2D force-directed graph of discovered devices.

use crate::app::AppState;
use crate::dto::GuiDiscoveredDevice;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use egui::{Color32, Pos2, Ui, Vec2};

// ── Page-local constants ────────────────────────────────────────────────────
const CANVAS_HEIGHT: f32 = theme::CANVAS_MIN_HEIGHT;
const GRID_DIVISIONS: usize = 8;
const ZOOM_SCROLL_FACTOR: f32 = 0.002;
const ZOOM_MIN: f32 = 0.3;
const ZOOM_MAX: f32 = 3.0;
const NODE_RADIUS_GATEWAY: f32 = 18.0;
const NODE_RADIUS_DEFAULT: f32 = 14.0;
const NODE_LABEL_OFFSET_Y: f32 = 6.0;
const LAYOUT_INITIAL_RADIUS: f32 = 150.0;
const FORCE_REPULSION: f32 = 5000.0;
const FORCE_ATTRACTION: f32 = 0.005;
const FORCE_DAMPING: f32 = 0.9;
const FORCE_CENTER_GRAVITY: f32 = 0.01;
const FORCE_MIN_DIST_SQ: f32 = 100.0;
const FORCE_MAX_VELOCITY: f32 = 10.0;
const CONVERGENCE_THRESHOLD: f32 = 0.1;

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
        if state.discovery.devices.is_empty() {
            ui.add_space(theme::SPACE_LG);
            widgets::empty_state(
                ui,
                icons::CARTOGRAPHY,
                "Aucun actif découvert",
                Some(
                    "Veuillez lancer une découverte réseau pour cartographier votre infrastructure.",
                ),
            );
            return None;
        }

        ui.add_space(theme::SPACE_XS);
        widgets::page_header_nav(
            ui,
            &["Actifs & inventaire", "Cartographie"],
            "Cartographie Réseau",
            Some("Visualisation topologique et relations entre actifs."),
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
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
                        .strong(),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Reset layout button
                    if widgets::secondary_button(ui, "Réinitialiser", true).clicked() {
                        state.cartography.layout = None;
                        state.cartography.zoom = 1.0;
                        state.cartography.pan = Vec2::ZERO;
                    }

                    ui.add_space(theme::SPACE_MD);

                    // Zoom indicators (AAA)
                    ui.label(
                        egui::RichText::new(format!(
                            "ZOOM: {:.0}\u{202f}%",
                            state.cartography.zoom * 100.0
                        ))
                        .font(theme::font_label())
                        .color(theme::text_tertiary())
                        .strong(),
                    )
                    .on_hover_text(if cfg!(target_os = "macos") {
                        "⌘ + molette pour zoomer · glisser pour déplacer"
                    } else {
                        "Ctrl + molette pour zoomer · glisser pour déplacer"
                    });
                    ui.add_space(theme::SPACE_SM);
                    ui.label(
                        egui::RichText::new(if cfg!(target_os = "macos") {
                            "⌘ + molette · glisser"
                        } else {
                            "Ctrl + molette · glisser"
                        })
                        .font(theme::font_small())
                        .color(theme::text_tertiary()),
                    );

                    ui.add_space(theme::SPACE_LG);

                    // Open 3D view button
                    if widgets::primary_button(
                        ui,
                        format!("{}  Vue 3D", icons::EXTERNAL_LINK),
                        true,
                    )
                    .clicked()
                    {
                        if state.settings.architecture_url.starts_with("https://") {
                            if let Err(e) = open::that(&state.settings.architecture_url) {
                                tracing::warn!("Failed to open URL: {}", e);
                            }
                        } else {
                            tracing::warn!(
                                "Refused to open non-HTTPS URL: {}",
                                state.settings.architecture_url
                            );
                        }
                    }

                    ui.add_space(theme::SPACE_MD);

                    // Export CSV
                    if widgets::ghost_button(ui, format!("{}  CSV", icons::DOWNLOAD)).clicked() {
                        let success = Self::export_csv(state);
                        let time = ui.input(|i| i.time);
                        if success {
                            state.toasts.push(
                                crate::widgets::toast::Toast::success(
                                    "Export CSV cartographie r\u{00e9}ussi",
                                )
                                .with_time(time),
                            );
                        } else {
                            state.toasts.push(
                                crate::widgets::toast::Toast::error("\u{00c9}chec de l'export CSV")
                                    .with_time(time),
                            );
                        }
                    }
                });
            });
        });

        ui.add_space(theme::SPACE_MD);

        // Invalidate layout if device list changed
        let device_count = state.discovery.devices.len();
        if state
            .cartography
            .layout
            .as_ref()
            .is_some_and(|l| l.nodes.len() != device_count)
        {
            state.cartography.layout = None;
            state.cartography.selected_device = None;
        }

        // Build graph layout if needed (avoid cloning on every frame)
        if state.cartography.layout.is_none() {
            let layout = build_initial_layout(&state.discovery.devices);
            state.cartography.layout = Some(layout);
        }
        let layout = state.cartography.layout.as_mut()?;

        // Run force simulation only if not yet converged
        if !layout.converged {
            run_force_simulation(layout);
        }

        // Graph viewport (AAA Grade)
        let canvas_size = egui::Vec2::new(ui.available_width(), CANVAS_HEIGHT);
        let (response, painter) = ui.allocate_painter(canvas_size, egui::Sense::click_and_drag());
        let rect = response.rect;

        // Sophisticated background (AAA)
        painter.rect_filled(
            rect,
            egui::CornerRadius::same(theme::CARD_ROUNDING),
            theme::bg_deep(),
        );

        // Focus ring for keyboard navigation (WCAG 2.4.7)
        if response.has_focus() {
            painter.rect_stroke(
                rect,
                egui::CornerRadius::same(theme::CARD_ROUNDING),
                theme::focus_ring(),
                egui::epaint::StrokeKind::Inside,
            );
        }

        // Background grid simulation (Subtle institutional lines)
        let grid_color = theme::border().linear_multiply(theme::OPACITY_SUBTLE);
        for i in 1..GRID_DIVISIONS {
            let x = rect.min.x + (rect.width() * i as f32 / GRID_DIVISIONS as f32);
            painter.line_segment(
                [egui::pos2(x, rect.min.y), egui::pos2(x, rect.max.y)],
                egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
            );
            let y = rect.min.y + (rect.height() * i as f32 / GRID_DIVISIONS as f32);
            painter.line_segment(
                [egui::pos2(rect.min.x, y), egui::pos2(rect.max.x, y)],
                egui::Stroke::new(theme::BORDER_HAIRLINE, grid_color),
            );
        }

        // Handle pan
        if response.dragged() {
            state.cartography.pan += response.drag_delta();
        }

        // Zoom: Ctrl (⌘) + wheel, or a pinch, while the pointer is over the
        // map. A plain wheel scrolls the page, as it does everywhere else;
        // before, every wheel tick anywhere on the page also zoomed the map
        // it was scrolling past.
        if response.hovered() {
            let (wheel, pinch) = ui.input_mut(|input| {
                let wheel = if input.modifiers.command {
                    let delta = input.smooth_scroll_delta.y;
                    input.smooth_scroll_delta.y = 0.0;
                    delta
                } else {
                    0.0
                };
                (wheel, input.zoom_delta())
            });
            let zoom = (state.cartography.zoom + wheel * ZOOM_SCROLL_FACTOR) * pinch;
            state.cartography.zoom = zoom.clamp(ZOOM_MIN, ZOOM_MAX);
        }

        // Fit the graph to the canvas, then apply the operator's zoom: the
        // simulation settles in a few hundred units while the canvas is
        // wider than a thousand, which left nine nodes huddled mid-map.
        let (fit, graph_center) = fit_to_canvas(layout, rect);
        let zoom = fit * state.cartography.zoom;
        let center = rect.center().to_vec2() + state.cartography.pan - graph_center * zoom;

        // Relationships carry information: preserve contrast against the chart surface.
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
                    egui::Stroke::new(theme::BORDER_THIN, theme::border()),
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
            // Sized in screen space, so fitting a small graph does not
            // inflate the discs along with the distances.
            let base_radius = if node.device.is_gateway {
                NODE_RADIUS_GATEWAY
            } else {
                NODE_RADIUS_DEFAULT
            } * state.cartography.zoom.clamp(0.7, 1.4);
            let breathing = if theme::is_reduced_motion() {
                0.5
            } else {
                (anim_time * 1.5 + i as f64 * 0.1).sin().powi(2) as f32
            };

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

            // 3. Node body: a tinted disc with the device type's icon, so
            // the map reads without the legend.
            painter.circle_filled(screen_pos, base_radius, theme::tinted_surface(color));
            painter.circle_stroke(
                screen_pos,
                base_radius,
                egui::Stroke::new(
                    if is_selected {
                        theme::BORDER_THICK
                    } else {
                        theme::BORDER_MEDIUM
                    },
                    theme::readable_color(color),
                ),
            );
            painter.text(
                screen_pos,
                egui::Align2::CENTER_CENTER,
                device_type_icon(&node.device),
                theme::font_icon(base_radius * 0.9),
                theme::readable_color(color),
            );

            // 4. Label on a plate, readable over edges and grid.
            let label = node
                .device
                .hostname
                .as_deref()
                .unwrap_or(&node.device.ip)
                .to_owned();
            let galley =
                painter.layout_no_wrap(label, theme::font_caption(), theme::text_primary());
            let plate = egui::Rect::from_center_size(
                Pos2::new(
                    screen_pos.x,
                    screen_pos.y + base_radius + NODE_LABEL_OFFSET_Y + galley.size().y / 2.0,
                ),
                galley.size() + egui::vec2(theme::SPACE_SM * 2.0, theme::SPACE_XS),
            );
            painter.rect_filled(
                plate,
                theme::ROUNDING_SM,
                theme::bg_secondary().linear_multiply(0.92),
            );
            painter.galley(
                plate.center() - galley.size() / 2.0,
                galley,
                theme::text_primary(),
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
                        .extra_letter_spacing(theme::TRACKING_NORMAL)
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
                    let (dot_rect, _) = ui.allocate_exact_size(
                        egui::Vec2::splat(theme::STATUS_DOT_SIZE),
                        egui::Sense::hover(),
                    );
                    ui.painter().circle_filled(
                        dot_rect.center(),
                        theme::STATUS_DOT_SIZE / 2.0,
                        color,
                    );
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

        // The selected device opens in the detail modal, like every other
        // detail in the app; it used to unfold as a card under the map,
        // below the fold on most windows.
        if let Some(selected_ip) = state.cartography.selected_device.clone()
            && let Some(device) = state
                .discovery
                .devices
                .iter()
                .find(|d| d.ip == selected_ip)
                .cloned()
        {
            let mut open = true;
            let title = device.hostname.as_deref().unwrap_or(&device.ip);
            let color = device_type_color(&device.device_type);
            let actions = [widgets::DetailAction::secondary(
                "Copier l'adresse IP",
                icons::COPY,
            )];
            let action = widgets::DetailDrawer::new(
                "cartography_device_detail",
                title,
                device_type_icon(&device),
            )
            .accent(color)
            .subtitle(&device.ip)
            .show(
                ui.ctx(),
                &mut open,
                |ui| {
                    widgets::detail_section(ui, "APPAREIL");
                    widgets::detail_mono(ui, "Adresse IP", &device.ip);
                    if let Some(mac) = &device.mac {
                        widgets::detail_mono(ui, "Adresse MAC", mac);
                    }
                    widgets::detail_field(
                        ui,
                        "Constructeur",
                        device.vendor.as_deref().unwrap_or("Non identifié"),
                    );
                    widgets::detail_field_badge(
                        ui,
                        "Type",
                        device_type_name(&device.device_type),
                        color,
                    );
                    if device.is_gateway {
                        widgets::detail_field_badge(ui, "Rôle", "Passerelle", theme::ACCENT);
                    }
                    widgets::detail_field(ui, "Sous-réseau", &device.subnet);

                    widgets::detail_section(ui, "EXPOSITION");
                    if device.open_ports.is_empty() {
                        widgets::detail_field(ui, "Ports ouverts", "Aucun port ouvert détecté");
                    } else {
                        widgets::detail_mono(
                            ui,
                            "Ports ouverts",
                            &device
                                .open_ports
                                .iter()
                                .map(|p| p.to_string())
                                .collect::<Vec<_>>()
                                .join(", "),
                        );
                    }

                    widgets::detail_section(ui, "ACTIVITÉ");
                    widgets::detail_field(
                        ui,
                        "Première détection",
                        &device.first_seen.format("%d/%m/%Y %H:%M").to_string(),
                    );
                    widgets::detail_field(
                        ui,
                        "Dernière détection",
                        &device.last_seen.format("%d/%m/%Y %H:%M").to_string(),
                    );
                },
                &actions,
            );
            if action == Some(0) {
                ui.ctx().copy_text(device.ip.clone());
                let time = ui.input(|i| i.time);
                state.toasts.push(
                    crate::widgets::toast::Toast::success("Adresse IP copiée").with_time(time),
                );
            }
            if !open {
                state.cartography.selected_device = None;
            }
        }

        ui.add_space(theme::SPACE_XL);
        // Only request repaint while the force simulation is still converging
        if !layout.converged {
            ui.ctx().request_repaint();
        }
        None
    }

    fn export_csv(state: &AppState) -> bool {
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
        match crate::export::export_csv(headers, &rows, &path) {
            Ok(_) => true,
            Err(e) => {
                tracing::warn!("Export CSV failed: {}", e);
                false
            }
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
        "phone" => theme::accent_text(),
        _ => theme::text_secondary(),
    }
}

/// French name of a device type as discovery reports it.
fn device_type_name(device_type: &str) -> &str {
    match device_type {
        "router" => "Routeur",
        "server" => "Serveur",
        "workstation" => "Poste de travail",
        "printer" => "Imprimante",
        "iot" => "IoT / embarqué",
        "phone" => "Mobile",
        "switch" => "Commutateur",
        _ => "Non identifié",
    }
}

fn device_type_icon(device: &GuiDiscoveredDevice) -> &'static str {
    if device.is_gateway {
        return icons::NETWORK;
    }
    match device.device_type.as_str() {
        "router" => icons::NETWORK,
        "server" => icons::SERVER,
        "workstation" => icons::DESKTOP,
        "printer" => icons::PRINT,
        "iot" => icons::MICROCHIP,
        "phone" => icons::MOBILE,
        _ => icons::QUESTION,
    }
}

/// Scale and graph-space centre that fit every node, with room for the
/// discs and labels, inside the canvas. Never enlarges past 2.5×.
fn fit_to_canvas(layout: &GraphLayout, rect: egui::Rect) -> (f32, Vec2) {
    if layout.nodes.is_empty() {
        return (1.0, Vec2::ZERO);
    }
    let (mut min, mut max) = (Pos2::new(f32::MAX, f32::MAX), Pos2::new(f32::MIN, f32::MIN));
    for node in &layout.nodes {
        min = min.min(node.pos);
        max = max.max(node.pos);
    }
    let span = (max - min).max(Vec2::splat(1.0));
    // Horizontal room for labels, vertical room for the label under a node.
    let usable = rect.size() - Vec2::new(200.0, 110.0);
    let fit = (usable.x / span.x).min(usable.y / span.y).clamp(0.3, 2.5);
    let centre = (min.to_vec2() + max.to_vec2()) / 2.0 + Vec2::new(0.0, 10.0 / fit);
    (fit, centre)
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
        let radius = LAYOUT_INITIAL_RADIUS;
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

    GraphLayout {
        nodes,
        edges,
        converged: false,
    }
}

fn run_force_simulation(layout: &mut GraphLayout) {
    let n = layout.nodes.len();
    if n < 2 {
        return;
    }

    let repulsion = FORCE_REPULSION;
    let attraction = FORCE_ATTRACTION;
    let damping = FORCE_DAMPING;
    let center_gravity = FORCE_CENTER_GRAVITY;
    let iterations = 3;

    for _ in 0..iterations {
        // Repulsive forces between all pairs
        for i in 0..n {
            for j in (i + 1)..n {
                let dx = layout.nodes[i].pos.x - layout.nodes[j].pos.x;
                let dy = layout.nodes[i].pos.y - layout.nodes[j].pos.y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt().max(1.0);
                let force = repulsion / dist_sq.max(FORCE_MIN_DIST_SQ);
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
                if speed > FORCE_MAX_VELOCITY {
                    node.vel = node.vel / speed * FORCE_MAX_VELOCITY;
                }
                node.pos.x += node.vel.x;
                node.pos.y += node.vel.y;
            }
        }
    }

    // Check convergence: sum of velocity magnitudes
    let total_kinetic: f32 = layout.nodes.iter().map(|n| n.vel.length()).sum();
    layout.converged = total_kinetic < CONVERGENCE_THRESHOLD;
}
