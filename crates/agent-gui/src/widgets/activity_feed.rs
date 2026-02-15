//! Live activity feed widget with animated entries.

use egui::{Color32, CornerRadius, RichText, Ui, Vec2};

use crate::app::AppState;
use crate::icons;
use crate::theme;

/// Activity event type for display.
#[derive(Debug, Clone)]
pub enum ActivityEventType {
    CheckPassed,
    CheckFailed,
    VulnerabilityDetected,
    SyncCompleted,
    ScanStarted,
    ScanCompleted,
    Error,
    Info,
}

impl ActivityEventType {
    pub fn color(&self) -> Color32 {
        match self {
            Self::CheckPassed | Self::SyncCompleted | Self::ScanCompleted => theme::SUCCESS,
            Self::CheckFailed | Self::Error => theme::ERROR,
            Self::VulnerabilityDetected => theme::WARNING,
            Self::ScanStarted | Self::Info => theme::ACCENT,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            Self::CheckPassed => icons::CHECK,
            Self::CheckFailed => icons::SEVERITY_CRITICAL,
            Self::VulnerabilityDetected => icons::VULNERABILITIES,
            Self::SyncCompleted => icons::SYNC,
            Self::ScanStarted => icons::PLAY,
            Self::ScanCompleted => icons::COMPLIANCE,
            Self::Error => icons::WARNING,
            Self::Info => icons::INFO_CIRCLE,
        }
    }
}

/// A single activity event.
#[derive(Debug, Clone)]
pub struct ActivityEvent {
    pub event_type: ActivityEventType,
    pub title: String,
    pub detail: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Renders the premium activity feed.
pub fn activity_feed(ui: &mut Ui, state: &AppState, max_items: usize) {
    ui.vertical(|ui: &mut egui::Ui| {
        // Header
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(RichText::new(icons::STREAM).size(theme::ICON_XS).color(theme::accent_text()));
            ui.add_space(theme::SPACE_XS);
            ui.label(
                RichText::new("ACTIVITÉ EN DIRECT")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(0.5)
                    .strong(),
            );

            // Live indicator
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    let pulse = if theme::is_reduced_motion() {
                        1.0
                    } else {
                        let time = ui.input(|i| i.time);
                        ((time * 2.0).sin() * 0.5 + 0.5) as f32
                    };

                    ui.label(
                        RichText::new("●")
                            .size(theme::STATUS_DOT_SIZE)
                            .color(theme::SUCCESS.linear_multiply(theme::OPACITY_MEDIUM + theme::OPACITY_MEDIUM * pulse)),
                    );
                    ui.label(
                        RichText::new("EN DIRECT")
                            .font(theme::font_label())
                            .color(theme::readable_color(theme::SUCCESS)),
                    );

                    if !theme::is_reduced_motion() {
                        ui.ctx().request_repaint_after(std::time::Duration::from_millis(100));
                    }
                },
            );
        });

        ui.add_space(theme::SPACE_SM);

        let fingerprint = (state.logs.len(), state.sync.history.len());
        let cache_id = ui.id().with("activity_feed_cache");
        let fp_id = ui.id().with("activity_feed_fp");
        let prev_fp: Option<(usize, usize)> = ui.memory(|mem| mem.data.get_temp(fp_id));
        let events: Vec<ActivityEvent> = if prev_fp.as_ref() == Some(&fingerprint) {
            ui.memory(|mem| mem.data.get_temp(cache_id)).unwrap_or_default()
        } else {
            let built = build_events_from_state(state);
            ui.memory_mut(|mem| {
                mem.data.insert_temp(fp_id, fingerprint);
                mem.data.insert_temp(cache_id, built.clone());
            });
            built
        };

        if events.is_empty() {
            // Empty state
            ui.vertical_centered(|ui: &mut egui::Ui| {
                ui.add_space(theme::SPACE_MD);
                ui.label(
                    RichText::new(icons::STREAM)
                        .size(theme::ICON_LG)
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_XS);
                ui.label(
                    RichText::new("Aucune activité récente")
                        .font(theme::font_min())
                        .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_MD);
            });
        } else {
            // Event list
            for (idx, event) in events.iter().take(max_items).enumerate() {
                activity_row(ui, event, idx);
                if idx < max_items - 1 && idx < events.len() - 1 {
                    ui.add_space(theme::SPACE_XS);
                }
            }
        }
    });
}

fn activity_row(ui: &mut Ui, event: &ActivityEvent, _idx: usize) {
    let color = event.event_type.color();
    let icon = event.event_type.icon();

    // Row background with subtle hover
    let desired_height = 36.0;
    let available_width = ui.available_width();
    let (rect, response) = ui.allocate_exact_size(
        Vec2::new(available_width, desired_height),
        egui::Sense::hover(),
    );

    if ui.is_rect_visible(rect) {
        let painter = ui.painter_at(rect);

        // Hover background
        if response.hovered() {
            painter.rect_filled(
                rect,
                CornerRadius::same(theme::ROUNDING_SM),
                theme::hover_bg(),
            );
        }

        // Left color indicator bar
        let bar_rect = egui::Rect::from_min_size(rect.left_top(), Vec2::new(3.0, rect.height()));
        painter.rect_filled(bar_rect, CornerRadius::same(2), color.linear_multiply(theme::OPACITY_STRONG));

        // Icon
        let icon_pos = egui::pos2(rect.left() + 16.0, rect.center().y);
        painter.text(
            icon_pos,
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_body(),
            color,
        );

        // Title
        let title_pos = egui::pos2(rect.left() + 32.0, rect.center().y - 6.0);
        painter.text(
            title_pos,
            egui::Align2::LEFT_CENTER,
            &event.title,
            theme::font_min(),
            theme::text_primary(),
        );

        // Detail (if any)
        if let Some(ref detail) = event.detail {
            let detail_pos = egui::pos2(rect.left() + 32.0, rect.center().y + 8.0);
            painter.text(
                detail_pos,
                egui::Align2::LEFT_CENTER,
                detail,
                theme::font_label(),
                theme::text_tertiary(),
            );
        }

        // Timestamp
        let elapsed = chrono::Utc::now().signed_duration_since(event.timestamp);
        let time_text = if elapsed.num_seconds() < 60 {
            "à l'instant".to_string()
        } else if elapsed.num_minutes() < 60 {
            format!("{}m", elapsed.num_minutes())
        } else {
            format!("{}h", elapsed.num_hours())
        };

        let time_pos = egui::pos2(rect.right() - 8.0, rect.center().y);
        painter.text(
            time_pos,
            egui::Align2::RIGHT_CENTER,
            &time_text,
            theme::font_label(),
            theme::text_tertiary(),
        );
    }
}

fn build_events_from_state(state: &AppState) -> Vec<ActivityEvent> {
    let mut events = Vec::new();

    // Add log entries as events
    for log in state.logs.iter().take(10) {
        let event_type = match log.level.as_str() {
            "error" => ActivityEventType::Error,
            "warn" => ActivityEventType::VulnerabilityDetected,
            _ => ActivityEventType::Info,
        };

        events.push(ActivityEvent {
            event_type,
            title: truncate_string(&log.message, 40),
            detail: log.source.clone(),
            timestamp: log.timestamp,
        });
    }

    // Add sync history
    for entry in state.sync.history.iter().take(3) {
        events.push(ActivityEvent {
            event_type: if entry.success {
                ActivityEventType::SyncCompleted
            } else {
                ActivityEventType::Error
            },
            title: if entry.success {
                "Synchronisation réussie".to_string()
            } else {
                "Échec de synchronisation".to_string()
            },
            detail: Some(entry.message.clone()),
            timestamp: entry.timestamp,
        });
    }

    // Sort by timestamp (most recent first)
    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    events
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_len.saturating_sub(3)).collect();
        format!("{}...", truncated)
    }
}
