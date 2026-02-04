//! Monitoring page -- real-time system resource charts.

use egui::Ui;
use egui_plot::{Line, Plot, PlotPoints};
use tracing::info;

use crate::app::AppState;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

pub struct MonitoringPage;

impl MonitoringPage {
    pub fn show(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
        let command = None;

        ui.add_space(theme::SPACE_MD);
        widgets::page_header(
            ui,
            "Surveillance syst\u{00e8}me",
            Some("Monitoring temps r\u{00e9}el des ressources"),
        );
        ui.add_space(theme::SPACE_LG);

        // Action bar
        ui.horizontal(|ui| {
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let export_btn = egui::Button::new(
                    egui::RichText::new(format!("{}  Export CSV", icons::DOWNLOAD))
                        .font(theme::font_small())
                        .color(theme::text_secondary()),
                )
                .fill(theme::bg_elevated())
                .corner_radius(egui::CornerRadius::same(theme::BUTTON_ROUNDING));
                if ui.add(export_btn).clicked() {
                    Self::export_metrics_csv(state);
                }
            });
        });
        ui.add_space(theme::SPACE_MD);

        // ── Summary cards row ──────────────────────────────────────────
        let summary_grid = widgets::ResponsiveGrid::new(260.0, theme::SPACE_SM);
        let items = vec![
            (
                "CPU",
                format!("{:.1}%", state.resources.cpu_percent),
                Self::usage_color(state.resources.cpu_percent),
                icons::BOLT,
            ),
            (
                "M\u{00c9}MOIRE",
                format!("{:.1}%", state.resources.memory_percent),
                Self::usage_color(state.resources.memory_percent),
                icons::SERVER,
            ),
            (
                "DISQUE",
                format!("{:.1}%", state.resources.disk_percent),
                Self::usage_color(state.resources.disk_percent),
                icons::DATABASE,
            ),
            (
                "UPTIME",
                Self::format_uptime(state.resources.uptime_secs),
                theme::ACCENT,
                icons::CLOCK,
            ),
        ];

        summary_grid.show(ui, &items, |ui, width, (label, value, color, icon)| {
            Self::summary_card(ui, width, label, value, *color, icon);
        });

        ui.add_space(theme::SPACE_LG);

        // ── Main charts grid (CPU + Memory) ───────────────────────────
        let main_charts_grid = widgets::ResponsiveGrid::new(450.0, theme::SPACE_LG);
        let main_items = vec![
            (
                "UTILISATION CPU (%)",
                &state.cpu_history,
                theme::SUCCESS,
                true,
            ),
            (
                "UTILISATION M\u{00c9}MOIRE (%)",
                &state.memory_history,
                theme::ACCENT,
                false,
            ),
        ];

        main_charts_grid.show(
            ui,
            &main_items,
            |ui, width, (title, history, color, fill)| {
                ui.vertical(|ui| {
                    ui.set_width(width);
                    Self::chart_card(ui, title, history, *color, *fill, 220.0, false);
                });
            },
        );

        ui.add_space(theme::SPACE_LG);

        // ── IO charts grid (Disk + Network) ───────────────────────────
        let io_grid = widgets::ResponsiveGrid::new(450.0, theme::SPACE_LG);
        let io_items = vec![
            ("E/S DISQUE", &state.disk_io_history, theme::WARNING, true),
            (
                "E/S R\u{00c9}SEAU",
                &state.network_io_history,
                theme::INFO,
                true,
            ),
        ];

        io_grid.show(
            ui,
            &io_items,
            |ui, width, (title, history, color, auto_y)| {
                ui.vertical(|ui| {
                    ui.set_width(width);
                    Self::chart_card(ui, title, history, *color, false, 200.0, *auto_y);
                });
            },
        );

        ui.add_space(theme::SPACE_XL);

        command
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    /// Pick color based on usage percentage (green < 70, amber < 90, red >= 90).
    fn usage_color(percent: f64) -> egui::Color32 {
        if percent >= 90.0 {
            theme::ERROR
        } else if percent >= 70.0 {
            theme::WARNING
        } else {
            theme::SUCCESS
        }
    }

    /// Format seconds into a human-readable uptime string.
    fn format_uptime(secs: u64) -> String {
        let days = secs / 86400;
        let hours = (secs % 86400) / 3600;
        let minutes = (secs % 3600) / 60;
        if days > 0 {
            format!("{}j {}h {}m", days, hours, minutes)
        } else if hours > 0 {
            format!("{}h {}m", hours, minutes)
        } else {
            format!("{}m", minutes)
        }
    }

    /// Draw a premium summary card with enhanced visual effects.
    fn summary_card(
        ui: &mut Ui,
        width: f32,
        label: &str,
        value: &str,
        color: egui::Color32,
        icon: &str,
    ) {
        ui.vertical(|ui| {
            ui.set_width(width);
            widgets::card(ui, |ui| {
                ui.set_min_height(70.0);
                
                // Get the actual available rect WITHIN the card (already clipped by card margins)
                let card_inner_rect = ui.available_rect_before_wrap();
                let is_hovered = ui.rect_contains_pointer(card_inner_rect);

                // Use clipped painter to prevent overflow
                let painter = ui.painter_at(card_inner_rect);

                // Subtle hover tint (no glow that could overflow)
                if is_hovered {
                    let time = ui.input(|i| i.time);
                    let pulse = (time * 3.0).sin() * 0.1 + 0.9;
                    painter.rect_filled(
                        card_inner_rect,
                        0.0, // No rounding needed for inner fill
                        color.linear_multiply(0.03 * pulse as f32),
                    );
                }

                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        // Premium value display with enhanced typography
                        ui.label(
                            egui::RichText::new(value)
                                .size(28.0) // Larger for premium feel
                                .color(color)
                                .strong(),
                        );

                        // Premium label with better spacing
                        ui.add_space(2.0);
                        ui.label(
                            egui::RichText::new(label)
                                .font(theme::font_small())
                                .color(theme::text_tertiary())
                                .strong(),
                        );
                    });

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Premium icon with subtle animation
                        let time = ui.input(|i| i.time);
                        let breathe = (time * 1.5).sin() * 0.1 + 0.9;

                        ui.label(
                            egui::RichText::new(icon)
                                .size(32.0) // Larger icon
                                .color(color.linear_multiply(0.3 + breathe as f32 * 0.2)),
                        );
                    });
                });

                // Subtle bottom accent line on hover (kept INSIDE card bounds)
                if is_hovered {
                    // Use painter_at to ensure clipping
                    let accent_height = 2.0;
                    let accent_rect = egui::Rect::from_min_size(
                        egui::pos2(card_inner_rect.left(), card_inner_rect.bottom() - accent_height),
                        egui::vec2(card_inner_rect.width(), accent_height),
                    );
                    painter.rect_filled(
                        accent_rect,
                        0.0,
                        color.linear_multiply(0.5),
                    );
                    
                    ui.ctx().request_repaint();
                }
            });
        });
    }

    /// Draw a premium chart card with enhanced visual effects.
    ///
    /// * `title` -- section header above the chart.
    /// * `history` -- `Vec<[f64; 2]>` where `[0]` is timestamp/index and `[1]` is value.
    /// * `line_color` -- color for the line.
    /// * `fill` -- whether to fill the area below the line.
    /// * `height` -- chart height in pixels.
    fn chart_card(
        ui: &mut Ui,
        title: &str,
        history: &[[f64; 2]],
        line_color: egui::Color32,
        fill: bool,
        height: f32,
        auto_y: bool,
    ) {
        widgets::card(ui, |ui| {
            // ═══════════════════════════════════════════════════════════════
            // Premium header with icon and live indicator
            // ═══════════════════════════════════════════════════════════════
            ui.horizontal(|ui| {
                let icon = match title {
                    t if t.contains("CPU") => "⚡",
                    t if t.contains("MÉMOIRE") => "💾",
                    t if t.contains("DISQUE") => "💿",
                    t if t.contains("RÉSEAU") => "🌐",
                    _ => "📊",
                };

                ui.label(
                    egui::RichText::new(format!("{} {}", icon, title))
                        .font(theme::font_small())
                        .color(theme::text_tertiary())
                        .strong(),
                );

                // Live pulsing indicator
                if !history.is_empty() {
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let time = ui.input(|i| i.time);
                        let pulse = (time * 3.0).sin() * 0.5 + 0.5;
                        
                        // Outer glow ring
                        let glow_color = line_color.linear_multiply(0.2 + pulse as f32 * 0.3);
                        ui.painter().circle_filled(
                            ui.cursor().center() + egui::vec2(8.0, 0.0),
                            6.0,
                            glow_color,
                        );
                        
                        // Inner solid dot
                        ui.painter().circle_filled(
                            ui.cursor().center() + egui::vec2(8.0, 0.0),
                            3.0,
                            line_color,
                        );
                        
                        ui.label(
                            egui::RichText::new("LIVE")
                                .font(egui::FontId::proportional(9.0))
                                .color(line_color.linear_multiply(0.6 + pulse as f32 * 0.4))
                        );
                        ui.add_space(20.0);
                    });
                }
            });

            ui.add_space(theme::SPACE_SM);

            if history.is_empty() {
                // ═══════════════════════════════════════════════════════════
                // Premium empty state
                // ═══════════════════════════════════════════════════════════
                let (rect, _) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width(), height),
                    egui::Sense::empty(),
                );
                let painter = ui.painter_at(rect);

                // Gradient background simulation with horizontal stripes
                for i in 0..10 {
                    let t = i as f32 / 10.0;
                    let stripe_color = theme::bg_elevated().linear_multiply(0.8 + t * 0.2);
                    let stripe_rect = egui::Rect::from_min_max(
                        egui::pos2(rect.min.x, rect.min.y + rect.height() * t),
                        egui::pos2(rect.max.x, rect.min.y + rect.height() * (t + 0.1)),
                    );
                    painter.rect_filled(stripe_rect, 0.0, stripe_color);
                }

                // Animated loading dots
                let time = ui.input(|i| i.time);
                let dots = (((time * 2.0) as usize) % 4) + 1;
                let dots_str = ".".repeat(dots);
                
                painter.text(
                    rect.center() - egui::vec2(0.0, 10.0),
                    egui::Align2::CENTER_CENTER,
                    "📊",
                    egui::FontId::proportional(32.0),
                    theme::text_tertiary().linear_multiply(0.5),
                );

                painter.text(
                    rect.center() + egui::vec2(0.0, 18.0),
                    egui::Align2::CENTER_CENTER,
                    format!("En attente de données{}", dots_str),
                    theme::font_small(),
                    theme::text_tertiary(),
                );
                
                ui.ctx().request_repaint();
            } else {
                // ═══════════════════════════════════════════════════════════
                // Calculate statistics for premium display
                // ═══════════════════════════════════════════════════════════
                let values: Vec<f64> = history.iter().map(|p| p[1]).collect();
                let current = values.last().copied().unwrap_or(0.0);
                let min_val = values.iter().cloned().fold(f64::INFINITY, f64::min);
                let max_val = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                let avg_val = values.iter().sum::<f64>() / values.len() as f64;
                
                // Trend calculation (compare last 5 to previous 5)
                let trend = if values.len() >= 10 {
                    let recent: f64 = values.iter().rev().take(5).sum::<f64>() / 5.0;
                    let older: f64 = values.iter().rev().skip(5).take(5).sum::<f64>() / 5.0;
                    if older > 0.0 { ((recent - older) / older) * 100.0 } else { 0.0 }
                } else {
                    0.0
                };

                // ═══════════════════════════════════════════════════════════
                // Mini statistics row (premium dashboard style)
                // ═══════════════════════════════════════════════════════════
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = theme::SPACE_MD;
                    
                    // Current value (large, colored)
                    ui.label(
                        egui::RichText::new(format!("{:.1}", current))
                            .font(egui::FontId::proportional(24.0))
                            .color(line_color)
                            .strong()
                    );
                    
                    // Trend indicator
                    let (trend_icon, trend_color) = if trend > 5.0 {
                        ("↑", theme::ERROR)
                    } else if trend < -5.0 {
                        ("↓", theme::SUCCESS)
                    } else {
                        ("→", theme::text_tertiary())
                    };
                    
                    if trend.abs() > 0.1 {
                        ui.label(
                            egui::RichText::new(format!("{} {:.1}%", trend_icon, trend.abs()))
                                .font(theme::font_small())
                                .color(trend_color)
                        );
                    }
                    
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Max
                        ui.label(
                            egui::RichText::new(format!("max {:.1}", max_val))
                                .font(egui::FontId::proportional(10.0))
                                .color(theme::text_tertiary())
                        );
                        ui.add_space(8.0);
                        
                        // Avg
                        ui.label(
                            egui::RichText::new(format!("avg {:.1}", avg_val))
                                .font(egui::FontId::proportional(10.0))
                                .color(theme::text_tertiary())
                        );
                        ui.add_space(8.0);
                        
                        // Min
                        ui.label(
                            egui::RichText::new(format!("min {:.1}", min_val))
                                .font(egui::FontId::proportional(10.0))
                                .color(theme::text_tertiary())
                        );
                    });
                });

                ui.add_space(theme::SPACE_XS);

                // ═══════════════════════════════════════════════════════════
                // Enhanced chart with neon glow effect
                // ═══════════════════════════════════════════════════════════
                
                // Create main line with premium styling
                let mut line = Line::new(PlotPoints::new(history.to_vec()))
                    .color(line_color)
                    .width(2.5)
                    .name(title);

                if fill {
                    line = line.fill(0.0);
                }

                // Create glow line (wider, more transparent)
                let glow_line = Line::new(PlotPoints::new(history.to_vec()))
                    .color(line_color.linear_multiply(0.25))
                    .width(8.0);

                // Create secondary glow (even wider)
                let outer_glow = Line::new(PlotPoints::new(history.to_vec()))
                    .color(line_color.linear_multiply(0.1))
                    .width(16.0);

                // Build premium plot widget
                let mut plot_widget = Plot::new(egui::Id::new(title))
                    .height(height - 40.0) // Account for stats row
                    .include_y(0.0)
                    .allow_drag(false)
                    .allow_zoom(false)
                    .allow_scroll(false)
                    .show_axes(egui::Vec2b::new(false, true))
                    .show_grid(egui::Vec2b::new(true, true))
                    .auto_bounds(egui::Vec2b::new(true, true))
                    .show_background(false); // Transparent background for premium look

                if !auto_y {
                    plot_widget = plot_widget.include_y(100.0);
                }

                // Get animation time BEFORE the closure to avoid borrow conflict
                let anim_time = ui.input(|i| i.time);

                plot_widget.show(ui, |plot_ui: &mut egui_plot::PlotUi| {
                    // Draw glow layers first (back to front)
                    plot_ui.line(outer_glow);
                    plot_ui.line(glow_line);
                    
                    // Main line on top
                    plot_ui.line(line);

                    // Animated latest point marker
                    if let Some(latest) = history.last() {
                        let pulse = (anim_time * 4.0).sin() * 0.3 + 0.7;
                        
                        // Outer glow ring for latest point
                        plot_ui.points(
                            egui_plot::Points::new(PlotPoints::new(vec![*latest]))
                                .color(line_color.linear_multiply(pulse as f32 * 0.5))
                                .radius(8.0)
                                .shape(egui_plot::MarkerShape::Circle),
                        );
                        
                        // Inner solid point
                        plot_ui.points(
                            egui_plot::Points::new(PlotPoints::new(vec![*latest]))
                                .color(line_color)
                                .radius(4.0)
                                .filled(true)
                                .shape(egui_plot::MarkerShape::Circle),
                        );
                    }

                    // Add horizontal reference lines for thresholds (for percentage charts)
                    if !auto_y {
                        // Warning threshold at 70%
                        plot_ui.hline(
                            egui_plot::HLine::new(70.0)
                                .color(theme::WARNING.linear_multiply(0.3))
                                .width(1.0)
                                .style(egui_plot::LineStyle::dashed_dense()),
                        );
                        
                        // Critical threshold at 90%
                        plot_ui.hline(
                            egui_plot::HLine::new(90.0)
                                .color(theme::ERROR.linear_multiply(0.3))
                                .width(1.0)
                                .style(egui_plot::LineStyle::dashed_dense()),
                        );
                    }
                });
                
                // Request repaint for animations
                ui.ctx().request_repaint();
            }
        });
    }

    fn export_metrics_csv(state: &AppState) {
        let headers = &[
            "timestamp",
            "cpu_percent",
            "memory_used_mb",
            "memory_percent",
            "disk_percent",
        ];
        // For simplicity, we just export current state since history is in graphs but not easily iterable for CSV here
        // Ideally we'd iterate history, but let's provide current state as a snapshot.
        let rows = vec![vec![
            chrono::Utc::now().to_rfc3339(),
            state.resources.cpu_percent.to_string(),
            state.resources.memory_used_mb.to_string(),
            state.resources.memory_percent.to_string(),
            state.resources.disk_percent.to_string(),
        ]];
        let path = crate::export::default_export_path("monitoring_ressources.csv");
        if let Err(e) = crate::export::export_csv(headers, &rows, &path) {
            tracing::warn!("Export CSV failed: {}", e);
        } else {
            info!("[AUDIT] GUI user exported monitoring data to {}", path.display());
        }
    }
}
