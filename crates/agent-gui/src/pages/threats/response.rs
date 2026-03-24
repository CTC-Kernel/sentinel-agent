// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR response tab — quick actions, quarantine queue, and response action log.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{PendingConfirmation, ResponseActionType, ResponseStatus};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::modal::{ModalResult, danger_dialog};

/// Render the response tab.
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let mut command = None;

    // ── Quick Actions Card ──────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new("ACTIONS RAPIDES")
                .font(theme::font_label())
                .color(theme::text_tertiary())
                .extra_letter_spacing(theme::TRACKING_NORMAL)
                .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal(|ui: &mut egui::Ui| {
            // Kill process button
            let has_processes = !state.threats.suspicious_processes.is_empty();
            if widgets::button::destructive_button(
                ui,
                format!("{}  Terminer le processus", icons::CIRCLE_XMARK),
                has_processes,
            )
            .clicked()
            {
                // Pick the most suspicious process (highest confidence)
                if let Some(p) = state.threats.suspicious_processes.front() {
                    state.threats.confirm_action = Some(PendingConfirmation {
                        action_type: ResponseActionType::KillProcess,
                        target: p.process_name.clone(),
                        detail: format!("PID {} \u{2014} Confiance: {}%", p.pid, p.confidence),
                    });
                }
            }

            ui.add_space(theme::SPACE_SM);

            // Quarantine file button
            let has_fim_alerts = state.fim.alerts.iter().any(|a| !a.acknowledged);
            if widgets::button::secondary_button(
                ui,
                format!("{}  Quarantaine fichier", icons::FILE_SHIELD),
                has_fim_alerts,
            )
            .clicked()
            {
                // Pick from first unacknowledged FIM alert if available
                if let Some(f) = state.fim.alerts.iter().find(|a| !a.acknowledged) {
                    state.threats.confirm_action = Some(PendingConfirmation {
                        action_type: ResponseActionType::QuarantineFile,
                        target: f.path.clone(),
                        detail: format!(
                            "Changement d\u{00e9}tect\u{00e9} le {}",
                            f.timestamp.format("%d/%m/%Y %H:%M")
                        ),
                    });
                }
            }

            ui.add_space(theme::SPACE_SM);

            // Block IP button
            let has_net_alerts = !state.network.alerts.is_empty();
            if widgets::button::destructive_button(
                ui,
                format!("{}  Bloquer IP", icons::LOCK),
                has_net_alerts,
            )
            .clicked()
            {
                // Pick the first network alert with a source IP
                if let Some(alert) = state.network.alerts.iter().find(|a| a.source_ip.is_some()) {
                    let ip = alert.source_ip.as_deref().unwrap_or("--").to_string();
                    state.threats.confirm_action = Some(PendingConfirmation {
                        action_type: ResponseActionType::BlockIp,
                        target: ip,
                        detail: format!("Source de l'alerte: {}", alert.description),
                    });
                }
            }
        });
    });

    ui.add_space(theme::SPACE_MD);

    // ── Confirmation Modal ──────────────────────────────────────────
    if let Some(pending) = state.threats.confirm_action.clone() {
        let title = match pending.action_type {
            ResponseActionType::KillProcess => "Terminer le processus ?",
            ResponseActionType::QuarantineFile => "Quarantaine du fichier ?",
            ResponseActionType::BlockIp => "Bloquer l'adresse IP ?",
            ResponseActionType::UnblockIp => "D\u{00e9}bloquer l'adresse IP ?",
            ResponseActionType::RestoreFile => "Restaurer le fichier ?",
        };
        let message = format!(
            "Cible : {}\n\nD\u{00e9}tail : {}\n\nCette action sera enregistr\u{00e9}e dans le journal d'audit.",
            pending.target, pending.detail,
        );
        let confirm_text = match pending.action_type {
            ResponseActionType::KillProcess => "Terminer",
            ResponseActionType::QuarantineFile => "Quarantaine",
            ResponseActionType::BlockIp => "Bloquer",
            ResponseActionType::UnblockIp => "D\u{00e9}bloquer",
            ResponseActionType::RestoreFile => "Restaurer",
        };

        let result = danger_dialog(
            ui.ctx(),
            "edr_confirm_action",
            title,
            &message,
            confirm_text,
        );

        match result {
            ModalResult::Confirm => {
                let time = ui.input(|i| i.time);
                command = match &pending.action_type {
                    ResponseActionType::KillProcess => {
                        let pid = state
                            .threats
                            .suspicious_processes
                            .iter()
                            .find(|p| p.process_name == pending.target)
                            .map(|p| p.pid)
                            .unwrap_or(0);
                        Some(GuiCommand::KillProcess {
                            process_name: pending.target.clone(),
                            pid,
                        })
                    }
                    ResponseActionType::QuarantineFile => Some(GuiCommand::QuarantineFile {
                        path: pending.target.clone(),
                    }),
                    ResponseActionType::BlockIp => {
                        Some(GuiCommand::BlockIp {
                            ip: pending.target.clone(),
                            duration_secs: 3600, // 1 hour default
                        })
                    }
                    ResponseActionType::UnblockIp => Some(GuiCommand::UnblockIp {
                        ip: pending.target.clone(),
                    }),
                    ResponseActionType::RestoreFile => Some(GuiCommand::RestoreQuarantinedFile {
                        quarantine_id: pending.target.clone(),
                    }),
                };

                // Response log entry is created by state.rs when
                // ResponseActionResult arrives, so we do not push here
                // to avoid duplicates.

                state.toasts.push(
                    crate::widgets::toast::Toast::info(format!(
                        "Action envoy\u{00e9}e : {} sur {}",
                        confirm_text, pending.target
                    ))
                    .with_time(time),
                );
                state.threats.confirm_action = None;
            }
            ModalResult::Cancel | ModalResult::Dismiss => {
                state.threats.confirm_action = None;
            }
            ModalResult::None => {}
        }
    }

    // ── Quarantine Queue ────────────────────────────────────────────
    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(format!(
                "FILE DE QUARANTAINE ({})",
                state.threats.quarantine_queue.len()
            ))
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.quarantine_queue.is_empty() {
            widgets::empty_state(
                ui,
                icons::SHIELD_CHECK,
                "AUCUN FICHIER EN QUARANTAINE",
                Some("Les fichiers mis en quarantaine appara\u{00ee}tront ici."),
            );
        } else {
            for file in state.threats.quarantine_queue.iter() {
                if file.restored {
                    continue;
                }
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icons::FILE)
                            .size(theme::ICON_SM)
                            .color(theme::readable_color(theme::WARNING)),
                    );
                    ui.add_space(theme::SPACE_XS);

                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(&file.original_path)
                                .font(theme::font_body())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            egui::RichText::new(format!(
                                "SHA-256: {} \u{2014} {} \u{2014} {}",
                                &file.sha256.chars().take(16).collect::<String>(),
                                file.reason,
                                file.quarantined_at.format("%d/%m/%Y %H:%M"),
                            ))
                            .font(theme::font_min())
                            .color(theme::text_tertiary()),
                        );
                    });

                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            if widgets::ghost_button(ui, format!("{}  Restaurer", icons::UNDO))
                                .clicked()
                            {
                                state.threats.confirm_action = Some(PendingConfirmation {
                                    action_type: ResponseActionType::RestoreFile,
                                    target: file.id.to_string(),
                                    detail: format!(
                                        "Restaurer {} vers {}",
                                        file.sha256.chars().take(8).collect::<String>(),
                                        file.original_path
                                    ),
                                });
                            }
                        },
                    );
                });
                ui.add_space(theme::SPACE_XS);
            }
        }
    });

    ui.add_space(theme::SPACE_MD);

    // ── Response Action Log ─────────────────────────────────────────
    let mut unblock_ip: Option<String> = None;

    widgets::card(ui, |ui: &mut egui::Ui| {
        ui.label(
            egui::RichText::new(format!(
                "JOURNAL DES ACTIONS ({})",
                state.threats.response_log.len()
            ))
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.response_log.is_empty() {
            widgets::empty_state(
                ui,
                icons::LIST,
                "AUCUNE ACTION",
                Some(
                    "Les actions de r\u{00e9}ponse ex\u{00e9}cut\u{00e9}es seront enregistr\u{00e9}es ici.",
                ),
            );
        } else {
            let page_size = 15;
            let total_pages = state.threats.response_log.len().div_ceil(page_size).max(1);
            if state.threats.response_page >= total_pages {
                state.threats.response_page = total_pages.saturating_sub(1);
            }
            let start = state.threats.response_page.saturating_mul(page_size);
            let entries: Vec<_> = state
                .threats
                .response_log
                .iter()
                .skip(start)
                .take(page_size)
                .collect();

            for entry in &entries {
                let (icon, color) = match entry.status {
                    ResponseStatus::Pending => (icons::CLOCK, theme::WARNING),
                    ResponseStatus::InProgress => (icons::PLAY, theme::INFO),
                    ResponseStatus::Success => (icons::CHECK, theme::SUCCESS),
                    ResponseStatus::Failed => (icons::CIRCLE_XMARK, theme::ERROR),
                };

                // Capture target for unblock button (closures cannot mutate outer command)
                let is_block_ip_success = entry.action_type == ResponseActionType::BlockIp
                    && entry.status == ResponseStatus::Success;
                let entry_target = entry.target.clone();

                ui.horizontal(|ui: &mut egui::Ui| {
                    // Status icon with color bar
                    ui.label(egui::RichText::new(icon).size(theme::ICON_SM).color(color));
                    ui.add_space(theme::SPACE_XS);

                    // Action type badge
                    widgets::status_badge(ui, entry.action_type.label_fr(), color);
                    ui.add_space(theme::SPACE_SM);

                    // Target + details
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(&entry.target)
                                .font(theme::font_body())
                                .color(theme::text_primary()),
                        );
                        if let Some(ref details) = entry.details {
                            ui.label(
                                egui::RichText::new(details)
                                    .font(theme::font_min())
                                    .color(theme::text_tertiary()),
                            );
                        }
                    });

                    // Timestamp + status + operator + unblock button
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            // Unblock button for completed BlockIp actions
                            if is_block_ip_success {
                                if widgets::ghost_button(
                                    ui,
                                    format!("{}  D\u{00e9}bloquer", icons::UNLOCK),
                                )
                                .clicked()
                                {
                                    unblock_ip = Some(entry_target.clone());
                                }
                                ui.add_space(theme::SPACE_SM);
                            }

                            ui.label(
                                egui::RichText::new(
                                    entry.timestamp.format("%d/%m/%Y %H:%M").to_string(),
                                )
                                .font(theme::font_label())
                                .color(theme::text_tertiary()),
                            );
                            ui.add_space(theme::SPACE_SM);
                            widgets::status_badge(ui, entry.status.label_fr(), color);
                            ui.add_space(theme::SPACE_SM);
                            ui.label(
                                egui::RichText::new(&entry.operator)
                                    .font(theme::font_label())
                                    .color(theme::text_secondary()),
                            );
                        },
                    );
                });
                ui.add_space(theme::SPACE_XS);
            }

            // Simple pagination
            if state.threats.response_log.len() > page_size {
                ui.add_space(theme::SPACE_SM);
                let mut pag = crate::widgets::pagination::PaginationState::new(
                    state.threats.response_log.len(),
                    page_size,
                );
                pag.current_page = state.threats.response_page.saturating_add(1);
                if widgets::pagination(ui, &mut pag) {
                    state.threats.response_page = pag.current_page.saturating_sub(1);
                }
            }
        }
    });

    // Apply unblock command after the card closure
    if let Some(ip) = unblock_ip {
        command = Some(GuiCommand::UnblockIp { ip });
    }

    command
}
