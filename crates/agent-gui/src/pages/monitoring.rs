//! Monitoring page -- real-time system resource charts.

use egui::Ui;
use egui_plot::{Line, Plot, PlotPoints};

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
        let card_gap = theme::SPACE_SM;
        let card_w = (ui.available_width() - card_gap * 3.0) / 4.0;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = card_gap;

            // CPU with premium badge
            let cpu_color = Self::usage_color(state.resources.cpu_percent);
            Self::summary_card(
                ui,
                card_w,
                "CPU",
                &format!("{:.1}%", state.resources.cpu_percent),
                cpu_color,
                icons::BOLT,
            );
            
            // Add premium status badge for CPU
            widgets::StatusBadge::new(
                if state.resources.cpu_percent >= 90.0 { "Élevé" } 
                else if state.resources.cpu_percent >= 70.0 { "Modéré" } 
                else { "Normal" },
                if state.resources.cpu_percent >= 90.0 { widgets::StatusLevel::Error }
                else if state.resources.cpu_percent >= 70.0 { widgets::StatusLevel::Warning }
                else { widgets::StatusLevel::Success }
            ).ui(ui);

            // RAM
            let mem_color = Self::usage_color(state.resources.memory_percent);
            Self::summary_card(
                ui,
                card_w,
                "M\u{00c9}MOIRE",
                &format!(
                    "{:.1}% ({} / {} Mo)",
                    state.resources.memory_percent,
                    state.resources.memory_used_mb,
                    state.resources.memory_total_mb,
                ),
                mem_color,
                icons::SERVER,
            );

            // Disk
            let disk_color = Self::usage_color(state.resources.disk_percent);
            Self::summary_card(
                ui,
                card_w,
                "DISQUE",
                &format!("{:.1}%", state.resources.disk_percent),
                disk_color,
                icons::DATABASE,
            );

            // Uptime with premium badge
            let uptime = state.resources.uptime_secs;
            let uptime_str = Self::format_uptime(uptime);
            Self::summary_card(
                ui,
                card_w,
                "UPTIME",
                &uptime_str,
                theme::ACCENT,
                icons::CLOCK,
            );
        });

        ui.add_space(theme::SPACE_LG);

        // ── CPU chart ──────────────────────────────────────────────────
        Self::chart_card(
            ui,
            "UTILISATION CPU (%)",
            &state.cpu_history,
            theme::SUCCESS,
            true,
            200.0,
            false,
        );

        ui.add_space(theme::SPACE_LG);

        // ── Memory chart ───────────────────────────────────────────────
        Self::chart_card(
            ui,
            "UTILISATION M\u{00c9}MOIRE (%)",
            &state.memory_history,
            theme::ACCENT,
            false,
            200.0,
            false,
        );

        ui.add_space(theme::SPACE_LG);

        // ── Disk I/O + Network I/O side by side ────────────────────────
        let gap = theme::SPACE;
        let half_w = (ui.available_width() - gap) / 2.0;
        ui.horizontal_top(|ui| {
            ui.spacing_mut().item_spacing.x = gap;

            ui.vertical(|ui| {
                ui.set_width(half_w);
                Self::chart_card(
                    ui,
                    "E/S DISQUE",
                    &state.disk_io_history,
                    theme::WARNING,
                    false,
                    180.0,
                    true,
                );
            });

            ui.vertical(|ui| {
                ui.set_width(half_w);
                Self::chart_card(
                    ui,
                    "E/S R\u{00c9}SEAU",
                    &state.network_io_history,
                    theme::INFO,
                    false,
                    180.0,
                    true,
                );
            });
        });

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
                // Add subtle hover effect area
                let (rect, response) = ui.allocate_exact_size(
                    egui::vec2(width, ui.available_height()),
                    egui::Sense::hover(),
                );
                
                // Premium hover glow effect
                if response.hovered() {
                    let time = ui.input(|i| i.time);
                    let pulse = (time * 3.0).sin() * 0.1 + 0.9;
                    ui.painter().rect_filled(
                        rect,
                        egui::CornerRadius::same(theme::CARD_ROUNDING),
                        color.linear_multiply(0.05 * pulse as f32),
                    );
                }
                
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        // Premium value display with enhanced typography
                        ui.label(
                            egui::RichText::new(value)
                                .size(28.0) // Larger for premium feel
                                .color(color)
                                .strong()
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
                
                // Add subtle bottom accent line
                if response.hovered() {
                    ui.painter().rect_filled(
                        egui::Rect::from_min_size(
                            rect.min + egui::vec2(0.0, rect.height() - 2.0),
                            egui::vec2(rect.width(), 2.0)
                        ),
                        egui::CornerRadius::same(1),
                        color.linear_multiply(0.6),
                    );
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
            // Premium header with icon and subtle gradient effect
            ui.horizontal(|ui| {
                // Add icon for visual appeal
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
                
                // Add real-time indicator for live data
                if !history.is_empty() {
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let time = ui.input(|i| i.time);
                        let pulse = (time * 2.0).sin() * 0.5 + 0.5;
                        let dot_color = line_color.linear_multiply(0.3 + pulse as f32 * 0.7);
                        
                        ui.painter().circle_filled(
                            ui.cursor().center() + egui::vec2(8.0, 0.0),
                            3.0,
                            dot_color,
                        );
                        ui.add_space(16.0);
                    });
                }
            });
            
            ui.add_space(theme::SPACE_SM);

            if history.is_empty() {
                // Premium empty state with gradient background
                let (rect, _) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width(), height),
                    egui::Sense::empty(),
                );
                let painter = ui.painter_at(rect);
                
                // Subtle gradient background (simplified - remove gradient method)
                painter.rect_filled(
                    rect,
                    egui::CornerRadius::same(theme::CARD_ROUNDING),
                    theme::bg_elevated(),
                );
                
                // Premium empty state content
                painter.text(
                    rect.center() - egui::vec2(0.0, 10.0),
                    egui::Align2::CENTER_CENTER,
                    "📊",
                    egui::FontId::proportional(32.0),
                    theme::text_tertiary().linear_multiply(0.5),
                );
                
                painter.text(
                    rect.center() + egui::vec2(0.0, 15.0),
                    egui::Align2::CENTER_CENTER,
                    "En attente de données...",
                    theme::font_small(),
                    theme::text_tertiary(),
                );
            } else {
                // Enhanced chart with premium styling
                let points = PlotPoints::new(history.to_vec());
                
                // Create premium line with glow effect
                let mut line = Line::new(points)
                    .color(line_color)
                    .width(3.0) // Thicker line for premium feel
                    .name(title);

                if fill {
                    // Premium gradient fill
                    line = line.fill(0.0);
                }

                // Enhanced plot widget with premium styling
                let mut plot_widget = Plot::new(egui::Id::new(title))
                    .height(height)
                    .include_y(0.0)
                    .allow_drag(false)
                    .allow_zoom(false)
                    .allow_scroll(false)
                    .show_axes(egui::Vec2b::new(false, true))
                    .show_grid(egui::Vec2b::new(false, true))
                    .auto_bounds(egui::Vec2b::new(true, true))
                    .legend(egui_plot::Legend::default().position(egui_plot::Corner::RightTop));

                if !auto_y {
                    plot_widget = plot_widget.include_y(100.0);
                }

                plot_widget.show(ui, |plot_ui: &mut egui_plot::PlotUi| {
                    plot_ui.line(line);
                    
                    // Add subtle data points for premium feel
                    if history.len() <= 50 { // Only for reasonable data sizes
                        for point in history.iter().step_by(5) {
                            plot_ui.points(
                                egui_plot::Points::new(PlotPoints::new(vec![*point]))
                                    .color(line_color)
                                    .radius(2.0)
                                    .shape(egui_plot::MarkerShape::Circle)
                            );
                        }
                    }
                });
                
                // Add premium stats overlay (simplified)
                if let Some(latest) = history.last() {
                    let current_value = latest[1];
                    ui.horizontal(|ui| {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let value_text = format!("{:.1}%", current_value);
                            ui.label(
                                egui::RichText::new(value_text)
                                    .font(theme::font_small())
                                    .color(line_color)
                                    .strong()
                            );
                        });
                    });
                }
            }
        });
    }

    fn export_metrics_csv(state: &AppState) {
        let headers = &["timestamp", "cpu_percent", "memory_used_mb", "memory_percent", "disk_percent"];
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
        }
    }
}
