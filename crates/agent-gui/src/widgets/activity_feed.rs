// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

/// What the feed's header indicator claims about the stream.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FeedLiveness {
    /// Events are arriving: the pulsing "live" badge.
    Live,
    /// The agent runs but nothing has happened yet.
    Listening,
    /// The agent is paused, starting, or failed: nothing will stream.
    Idle(&'static str),
}

fn feed_liveness(status: &crate::dto::GuiAgentStatus, has_events: bool) -> FeedLiveness {
    use crate::dto::GuiAgentStatus as S;
    match status {
        S::Paused => FeedLiveness::Idle("EN PAUSE"),
        S::Starting => FeedLiveness::Idle("DÉMARRAGE"),
        S::Error => FeedLiveness::Idle("INTERROMPU"),
        // Disconnected only means no platform: local detection still streams.
        _ if has_events => FeedLiveness::Live,
        _ => FeedLiveness::Listening,
    }
}

/// Renders the premium activity feed.
pub fn activity_feed(ui: &mut Ui, state: &AppState, max_items: usize) {
    ui.vertical(|ui: &mut egui::Ui| {
        let fingerprint = (state.logs.len(), state.sync.history.len());
        let cache_id = ui.id().with("activity_feed_cache");
        let fp_id = ui.id().with("activity_feed_fp");
        let prev_fp: Option<(usize, usize)> = ui.memory(|mem| mem.data.get_temp(fp_id));
        let events: Vec<ActivityEvent> = if prev_fp.as_ref() == Some(&fingerprint) {
            ui.memory(|mem| mem.data.get_temp(cache_id))
                .unwrap_or_default()
        } else {
            let built = build_events_from_state(state);
            ui.memory_mut(|mem| {
                mem.data.insert_temp(fp_id, fingerprint);
                mem.data.insert_temp(cache_id, built.clone());
            });
            built
        };
        let liveness = feed_liveness(&state.summary.status, !events.is_empty());

        // Header
        ui.horizontal(|ui: &mut egui::Ui| {
            ui.label(
                RichText::new(icons::STREAM)
                    .size(theme::ICON_XS)
                    .color(theme::accent_text()),
            );
            ui.add_space(theme::SPACE_XS);
            ui.label(
                RichText::new("ACTIVITÉ EN DIRECT")
                    .font(theme::font_label())
                    .color(theme::text_tertiary())
                    .extra_letter_spacing(theme::TRACKING_NORMAL)
                    .strong(),
            );

            // Stream indicator: it only pulses while events actually flow.
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui: &mut egui::Ui| {
                    let (label, dot, text) = match liveness {
                        FeedLiveness::Live => {
                            let pulse = if theme::is_reduced_motion() {
                                1.0
                            } else {
                                let time = ui.input(|i| i.time);
                                ((time * 2.0).sin() * 0.5 + 0.5) as f32
                            };
                            crate::animation::request_ambient_repaint(ui.ctx());
                            (
                                "EN DIRECT",
                                theme::SUCCESS.linear_multiply(
                                    theme::OPACITY_MEDIUM + theme::OPACITY_MEDIUM * pulse,
                                ),
                                theme::readable_color(theme::SUCCESS),
                            )
                        }
                        FeedLiveness::Listening => {
                            ("EN ÉCOUTE", theme::SUCCESS, theme::text_secondary())
                        }
                        FeedLiveness::Idle(label) => {
                            (label, theme::text_tertiary(), theme::text_tertiary())
                        }
                    };
                    ui.label(RichText::new("●").size(theme::STATUS_DOT_SIZE).color(dot));
                    ui.label(RichText::new(label).font(theme::font_label()).color(text));
                },
            );
        });

        ui.add_space(theme::SPACE_SM);

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
                    RichText::new(if liveness == FeedLiveness::Listening {
                        "Aucune activité récente · le flux s'affichera ici en temps réel"
                    } else {
                        "Aucune activité récente"
                    })
                    .font(theme::font_min())
                    .color(theme::text_tertiary()),
                );
                ui.add_space(theme::SPACE_MD);
            });
        } else {
            // Event list
            for (idx, event) in events.iter().take(max_items).enumerate() {
                activity_row(ui, event, idx);
                if idx + 1 < max_items && idx + 1 < events.len() {
                    ui.add_space(theme::SPACE_XS);
                }
            }
        }
    });
}

fn activity_row(ui: &mut Ui, event: &ActivityEvent, _idx: usize) {
    let color = theme::readable_color(event.event_type.color());
    let icon = event.event_type.icon();

    // Row background with subtle hover
    let desired_height = theme::TABLE_ROW_HEIGHT;
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
        let bar_rect = egui::Rect::from_min_size(
            rect.left_top(),
            Vec2::new(theme::ACCENT_BAR_WIDTH, rect.height()),
        );
        painter.rect_filled(
            bar_rect,
            CornerRadius::same(theme::ROUNDING_XS),
            color.linear_multiply(theme::OPACITY_STRONG),
        );

        // Icon
        let icon_pos = egui::pos2(rect.left() + theme::SPACE, rect.center().y);
        painter.text(
            icon_pos,
            egui::Align2::CENTER_CENTER,
            icon,
            theme::font_body(),
            color,
        );

        // Title
        let title_pos = egui::pos2(rect.left() + theme::SPACE_XL, rect.center().y - 6.0);
        painter.text(
            title_pos,
            egui::Align2::LEFT_CENTER,
            &event.title,
            theme::font_min(),
            theme::text_primary(),
        );

        // Detail (if any)
        if let Some(ref detail) = event.detail {
            let detail_pos = egui::pos2(
                rect.left() + theme::SPACE_XL,
                rect.center().y + theme::SPACE_SM,
            );
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

        let time_pos = egui::pos2(rect.right() - theme::SPACE_SM, rect.center().y);
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
    events.sort_by_key(|b| std::cmp::Reverse(b.timestamp));

    events
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_len.saturating_sub(3)).collect();
        format!("{}…", truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::GuiAgentStatus;

    #[test]
    fn live_badge_only_claims_live_when_events_flow() {
        assert_eq!(
            feed_liveness(&GuiAgentStatus::Connected, true),
            FeedLiveness::Live
        );
        assert_eq!(
            feed_liveness(&GuiAgentStatus::Connected, false),
            FeedLiveness::Listening
        );
        // Without a platform connection, local detection still streams.
        assert_eq!(
            feed_liveness(&GuiAgentStatus::Disconnected, true),
            FeedLiveness::Live
        );
        assert!(matches!(
            feed_liveness(&GuiAgentStatus::Paused, true),
            FeedLiveness::Idle(_)
        ));
    }
}
