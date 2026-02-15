//! Organization banner widget - displays tenant info and connection status.

use egui::{CornerRadius, RichText, Ui, Vec2};

use crate::app::AppState;
use crate::dto::GuiAgentStatus;
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;

/// Renders the premium organization banner with connection status and quick actions.
pub fn org_banner(ui: &mut Ui, state: &AppState) -> Option<GuiCommand> {
    let mut command: Option<GuiCommand> = None;

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.horizontal(|ui: &mut egui::Ui| {
            // Left side: Organization info
            ui.vertical(|ui: &mut egui::Ui| {
                ui.set_min_width(ui.available_width() * 0.55);

                // Organization name with icon
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        RichText::new(icons::BUILDING)
                            .size(theme::ICON_MD)
                            .color(theme::accent_text()),
                    );
                    ui.add_space(theme::SPACE_SM);

                    let org_name = state
                        .summary
                        .organization
                        .as_deref()
                        .unwrap_or("Organisation non configurée");

                    ui.label(
                        RichText::new(org_name.to_uppercase())
                            .font(theme::font_heading())
                            .color(theme::text_primary())
                            .strong(),
                    );
                });

                ui.add_space(theme::SPACE_SM);

                // Connection status with animated pulse
                ui.horizontal(|ui: &mut egui::Ui| {
                    let is_connected = matches!(
                        state.summary.status,
                        GuiAgentStatus::Connected
                            | GuiAgentStatus::Scanning
                            | GuiAgentStatus::Syncing
                    );

                    let pulse = if theme::is_reduced_motion() {
                        1.0
                    } else {
                        let time = ui.input(|i| i.time);
                        ((time * 2.5).sin() * 0.5 + 0.5) as f32
                    };

                    let status_color = if is_connected {
                        theme::SUCCESS
                    } else if state.summary.status == GuiAgentStatus::Disconnected {
                        theme::WARNING
                    } else {
                        theme::INFO
                    };

                    // Animated status dot
                    let dot_size = 8.0;
                    let (dot_rect, _) =
                        ui.allocate_exact_size(Vec2::splat(dot_size * 2.0), egui::Sense::hover());
                    let dot_center = dot_rect.center();

                    if ui.is_rect_visible(dot_rect) {
                        // Outer glow ring
                        if is_connected {
                            ui.painter().circle_filled(
                                dot_center,
                                dot_size * (0.8 + 0.4 * pulse),
                                status_color.linear_multiply(theme::OPACITY_TINT * pulse),
                            );
                        }
                        // Main dot
                        ui.painter().circle_filled(
                            dot_center,
                            dot_size * 0.5,
                            status_color.linear_multiply(theme::OPACITY_STRONG + theme::OPACITY_TINT * pulse),
                        );
                    }

                    ui.add_space(theme::SPACE_XS);

                    let status_text = if is_connected {
                        "CONNECTÉ AU SERVEUR"
                    } else if state.summary.status == GuiAgentStatus::Disconnected {
                        "DÉCONNECTÉ"
                    } else {
                        "EN ATTENTE"
                    };

                    ui.label(
                        RichText::new(status_text)
                            .font(theme::font_label())
                            .color(theme::readable_color(status_color))
                            .extra_letter_spacing(0.3)
                            .strong(),
                    );
                });

                ui.add_space(theme::SPACE_XS);

                // Server URL and sync info
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        RichText::new(icons::NETWORK)
                            .size(11.0)
                            .color(theme::text_tertiary()),
                    );
                    ui.add_space(theme::SPACE_XS);

                    // Truncate server URL for display
                    let server_display = state
                        .settings
                        .server_url
                        .replace("https://", "")
                        .replace("http://", "");
                    let server_short = if server_display.chars().count() > 30 {
                        let truncated: String = server_display.chars().take(27).collect();
                        format!("{}...", truncated)
                    } else {
                        server_display
                    };

                    ui.label(
                        RichText::new(server_short)
                            .font(theme::font_label())
                            .color(theme::text_tertiary()),
                    );
                });

                // Last sync time
                if let Some(last_sync) = state.summary.last_sync_at {
                    ui.add_space(theme::SPACE_XS);
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            RichText::new(icons::SYNC)
                                .size(11.0)
                                .color(theme::text_tertiary()),
                        );
                        ui.add_space(theme::SPACE_XS);

                        let elapsed = chrono::Utc::now().signed_duration_since(last_sync);
                        let elapsed_text = if elapsed.num_minutes() < 1 {
                            "il y a quelques secondes".to_string()
                        } else if elapsed.num_minutes() < 60 {
                            format!("il y a {} min", elapsed.num_minutes())
                        } else {
                            format!("il y a {}h", elapsed.num_hours())
                        };

                        ui.label(
                            RichText::new(format!("Dernière sync: {}", elapsed_text))
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                        );
                    });
                }
            });

            // Separator
            let sep_rect = ui.available_rect_before_wrap();
            ui.painter().vline(
                sep_rect.left(),
                sep_rect.top()..=sep_rect.bottom(),
                egui::Stroke::new(theme::BORDER_THIN, theme::border()),
            );

            ui.add_space(theme::SPACE_MD);

            // Right side: Metrics and actions
            ui.vertical(|ui: &mut egui::Ui| {
                // Pending sync count with badge
                if state.summary.pending_sync_count > 0 {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        let pulse = if theme::is_reduced_motion() {
                            1.0
                        } else {
                            let time = ui.input(|i| i.time);
                            ((time * 1.5).sin() * theme::OPACITY_MODERATE as f64 + theme::OPACITY_PRESSED as f64) as f32
                        };

                        let badge_text = format!("{}", state.summary.pending_sync_count);

                        let badge_rect =
                            egui::Rect::from_min_size(ui.cursor().min, Vec2::new(24.0, 18.0));

                        let rounding = CornerRadius::same(9);
                        let base_bg = theme::badge_bg(theme::INFO);
                        let fade = theme::OPACITY_PRESSED + theme::OPACITY_MODERATE * pulse;
                        let bg = egui::Color32::from_rgba_unmultiplied(
                            base_bg.r(), base_bg.g(), base_bg.b(),
                            (255.0 * fade).clamp(0.0, 255.0) as u8,
                        );
                        ui.painter().rect_filled(badge_rect, rounding, bg);
                        ui.painter().rect_stroke(
                            badge_rect,
                            rounding,
                            egui::Stroke::new(theme::BORDER_HAIRLINE, theme::badge_border(theme::INFO)),
                            egui::StrokeKind::Inside,
                        );
                        ui.painter().text(
                            badge_rect.center(),
                            egui::Align2::CENTER_CENTER,
                            &badge_text,
                            theme::font_label(),
                            theme::badge_text(theme::INFO),
                        );

                        ui.add_space(28.0);
                        ui.label(
                            RichText::new("éléments en attente de sync")
                                .font(theme::font_label())
                                .color(theme::text_secondary()),
                        );

                        if !theme::is_reduced_motion() {
                            ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
                        }
                    });

                    ui.add_space(theme::SPACE_SM);
                }

                // Agent ID
                if let Some(ref agent_id) = state.summary.agent_id {
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            RichText::new("ID:")
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                        );
                        ui.add_space(theme::SPACE_XS);
                        let id_display: String = agent_id.chars().take(12).collect();
                        ui.label(
                            RichText::new(id_display)
                                .font(theme::font_mono())
                                .color(theme::accent_text()),
                        );
                    });
                    ui.add_space(theme::SPACE_SM);
                }

                // Action buttons
                ui.horizontal(|ui: &mut egui::Ui| {
                    // Open console button
                    if widgets::button::secondary_button(
                        ui,
                        format!("{}  CONSOLE", icons::EXTERNAL_LINK),
                        true,
                    )
                    .clicked()
                    {
                        // Open browser to console URL (only https)
                        let console_url = format!("{}/dashboard", state.settings.server_url);
                        if console_url.starts_with("https://") {
                            if let Err(e) = open::that(&console_url) {
                                tracing::warn!("Failed to open URL {}: {}", console_url, e);
                            }
                        } else {
                            tracing::warn!("Refused to open non-HTTPS URL: {}", console_url);
                        }
                    }

                    ui.add_space(theme::SPACE_SM);

                    // Force sync button
                    let is_syncing = state.summary.status == GuiAgentStatus::Syncing;
                    if widgets::button::primary_button_loading(
                        ui,
                        format!(
                            "{}  {}",
                            icons::SYNC,
                            if is_syncing { "SYNC..." } else { "SYNC" }
                        ),
                        !is_syncing,
                        is_syncing,
                    )
                    .clicked()
                    {
                        command = Some(GuiCommand::ForceSync);
                    }
                });
            });
        });
    });

    if !theme::is_reduced_motion() {
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
    }

    command
}
