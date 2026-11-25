// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR response tab — response actions on a chosen target, blocked
//! addresses, quarantine and the journal of the actions asked for.
//!
//! The confirmation of an action is drawn for every tab of the module
//! ([`resolve_confirmation`]): the detail modals of the overview ask for
//! the same actions on the event they show.

use egui::Ui;

use crate::app::AppState;
use crate::dto::{
    BlockedIp, GuiNetworkAlert, PendingConfirmation, QuarantinedFile, ResponseActionType,
    ResponseLogEntry, ResponseStatus,
};
use crate::events::GuiCommand;
use crate::icons;
use crate::theme;
use crate::widgets;
use crate::widgets::modal::{ModalResult, danger_dialog};

use super::types::{network_alert_type_label, sort_bar, sort_rows, text_order};

/// How long an address blocked from the interface stays blocked.
const BLOCK_SECS: u64 = 3600;

/// Why a containment action needs the administrator mode.
const RESPONSE_REASON: &str =
    "Lancer une action de réponse (arrêt d'un processus, quarantaine, blocage)";

/// Candidates listed by a target picker before pointing to the overview.
const PICKER_ROWS: usize = 8;

/// The address a network alert lets the operator block: the remote peer.
/// Never this host's own address (`source_ip`), a loopback or an unspecified
/// one: blocking those would cut the endpoint off instead of the threat.
pub(super) fn remote_address(alert: &GuiNetworkAlert) -> Option<String> {
    let remote = alert.destination_ip.as_deref()?.trim();
    let parsed: std::net::IpAddr = remote.parse().ok()?;
    let parsed = parsed.to_canonical();
    if parsed.is_loopback() || parsed.is_unspecified() {
        return None;
    }
    let own = alert
        .source_ip
        .as_deref()
        .and_then(|ip| ip.trim().parse::<std::net::IpAddr>().ok())
        .map(|ip| ip.to_canonical());
    (own != Some(parsed)).then(|| remote.to_string())
}

/// The confirmation of a block of `ip`, seen in the alert `alert_label`.
pub(super) fn block_confirmation(ip: String, alert_label: &str) -> PendingConfirmation {
    PendingConfirmation {
        action_type: ResponseActionType::BlockIp,
        target: ip,
        detail: format!(
            "Adresse distante de l'alerte \u{00ab}\u{a0}{alert_label}\u{a0}\u{00bb}. Tout le trafic \
             avec elle sera bloqu\u{00e9} pendant une heure."
        ),
        pid: None,
    }
}

/// Ask to confirm a containment action on a target the operator chose.
/// Administrator mode first; the detail modal behind closes so the
/// confirmation is not stacked on it.
pub(super) fn request(state: &mut AppState, pending: PendingConfirmation) {
    if !state.require_admin(RESPONSE_REASON) {
        return;
    }
    state.threats.detail_open = false;
    state.threats.selected_threat = None;
    state.threats.confirm_action = Some(pending);
}

/// Draw the pending confirmation, whichever tab asked for it, and return
/// the command to send once confirmed.
pub(super) fn resolve_confirmation(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    let pending = state.threats.confirm_action.clone()?;
    let title = match pending.action_type {
        ResponseActionType::KillProcess => "Terminer le processus ?",
        ResponseActionType::QuarantineFile => "Mettre le fichier en quarantaine ?",
        ResponseActionType::BlockIp => "Bloquer l'adresse IP ?",
        ResponseActionType::UnblockIp => "D\u{00e9}bloquer l'adresse IP ?",
        ResponseActionType::RestoreFile => "Restaurer le fichier ?",
        ResponseActionType::IsolateHost => "Isoler le poste du r\u{00e9}seau ?",
        ResponseActionType::ReleaseHost => "Lever l'isolement du poste ?",
    };
    let message = format!(
        "Cible : {}\n\nD\u{00e9}tail : {}\n\nCette action sera enregistr\u{00e9}e dans le journal d'audit.",
        pending.target, pending.detail,
    );
    let confirm_text = match pending.action_type {
        ResponseActionType::KillProcess => "Terminer",
        ResponseActionType::QuarantineFile => "Mettre en quarantaine",
        ResponseActionType::BlockIp => "Bloquer",
        ResponseActionType::UnblockIp => "D\u{00e9}bloquer",
        ResponseActionType::RestoreFile => "Restaurer",
        ResponseActionType::IsolateHost => "Isoler",
        ResponseActionType::ReleaseHost => "Lever l'isolement",
    };

    match danger_dialog(
        ui.ctx(),
        "edr_confirm_action",
        title,
        &message,
        confirm_text,
    ) {
        ModalResult::Confirm => {}
        ModalResult::Cancel | ModalResult::Dismiss => {
            state.threats.confirm_action = None;
            return None;
        }
        ModalResult::None => return None,
    }

    let command = match &pending.action_type {
        ResponseActionType::KillProcess => GuiCommand::KillProcess {
            process_name: pending.target.clone(),
            // The process the operator chose; by name only for a
            // confirmation that carries none.
            pid: pending.pid.unwrap_or_else(|| {
                state
                    .threats
                    .suspicious_processes
                    .iter()
                    .find(|p| p.process_name == pending.target)
                    .map_or(0, |p| p.pid)
            }),
        },
        ResponseActionType::QuarantineFile => GuiCommand::QuarantineFile {
            path: pending.target.clone(),
        },
        ResponseActionType::BlockIp => GuiCommand::BlockIp {
            ip: pending.target.clone(),
            duration_secs: BLOCK_SECS,
        },
        ResponseActionType::UnblockIp => GuiCommand::UnblockIp {
            ip: pending.target.clone(),
        },
        ResponseActionType::RestoreFile => GuiCommand::RestoreQuarantinedFile {
            quarantine_id: pending.target.clone(),
        },
        // Until released by hand: an operator deciding to isolate
        // also decides when the endpoint comes back.
        ResponseActionType::IsolateHost => GuiCommand::IsolateHost { duration_secs: 0 },
        ResponseActionType::ReleaseHost => GuiCommand::ReleaseHost,
    };

    // The journal entry is created by state.rs when the agent answers
    // (`ResponseActionResult`), so none is pushed here.

    // Undoing a containment waits for the administrator mode; say so
    // instead of announcing it as sent.
    let held = command.admin_reason().is_some() && !state.security.admin_unlocked;
    let message = if held {
        format!(
            "{} sur {} : en attente du mode administrateur",
            confirm_text, pending.target
        )
    } else {
        format!(
            "Action envoy\u{00e9}e : {} sur {}",
            confirm_text, pending.target
        )
    };
    state.push_toast(widgets::toast::Toast::info(message), ui.ctx());
    state.threats.confirm_action = None;
    Some(command)
}

/// Names under which the sort orders of the three lists are kept.
const BLOCKED_TABLE: &str = "response_blocked";
const QUARANTINE_TABLE: &str = "response_quarantine";
const JOURNAL_TABLE: &str = "response_journal";

/// Addresses in numeric order when both parse, else as text.
fn address_order(a: &str, b: &str) -> std::cmp::Ordering {
    match (a.parse::<std::net::IpAddr>(), b.parse::<std::net::IpAddr>()) {
        (Ok(a), Ok(b)) => a.cmp(&b),
        _ => text_order(a, b),
    }
}

/// Ascending order of two blocked addresses on a sort key.
fn blocked_order(key: &str, a: &BlockedIp, b: &BlockedIp) -> std::cmp::Ordering {
    match key {
        "ip" => address_order(&a.ip, &b.ip),
        "since" => a.blocked_at.cmp(&b.blocked_at),
        // Soonest to lift first; a block without limit comes last.
        "until" => match (a.expires_at, b.expires_at) {
            (Some(a), Some(b)) => a.cmp(&b),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        },
        _ => std::cmp::Ordering::Equal,
    }
}

/// Ascending order of two quarantined files on a sort key.
fn quarantine_order(key: &str, a: &QuarantinedFile, b: &QuarantinedFile) -> std::cmp::Ordering {
    match key {
        "path" => text_order(&a.original_path, &b.original_path),
        "size" => a.size_bytes.cmp(&b.size_bytes),
        "date" => a.quarantined_at.cmp(&b.quarantined_at),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Where an action stands, in the order an operator follows it.
fn status_rank(status: ResponseStatus) -> u8 {
    match status {
        ResponseStatus::Pending => 0,
        ResponseStatus::InProgress => 1,
        ResponseStatus::Failed => 2,
        ResponseStatus::Success => 3,
    }
}

/// Ascending order of two journal entries on a sort key.
fn journal_order(key: &str, a: &ResponseLogEntry, b: &ResponseLogEntry) -> std::cmp::Ordering {
    match key {
        "date" => a.timestamp.cmp(&b.timestamp),
        "action" => text_order(a.action_type.label_fr(), b.action_type.label_fr()),
        "target" => text_order(&a.target, &b.target),
        "status" => status_rank(a.status).cmp(&status_rank(b.status)),
        _ => std::cmp::Ordering::Equal,
    }
}

/// Which target list the action row has open.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Picker {
    Process,
    File,
    Address,
}

/// One target a picker offers: what it is, what is known of it, and the
/// confirmation its button asks for.
struct Candidate {
    title: String,
    detail: String,
    pending: PendingConfirmation,
}

/// Suspicious processes that can be terminated: a known PID, not authorized.
fn process_candidates(state: &AppState) -> Vec<Candidate> {
    state
        .threats
        .suspicious_processes
        .iter()
        .filter(|p| p.pid != 0 && !p.allowlisted)
        .map(|p| {
            let detail = format!(
                "PID {} \u{2014} Confiance : {}\u{202f}% \u{2014} {}",
                p.pid,
                p.confidence,
                crate::format::local_datetime(p.detected_at)
            );
            Candidate {
                title: p.process_name.clone(),
                detail: detail.clone(),
                pending: PendingConfirmation {
                    action_type: ResponseActionType::KillProcess,
                    target: p.process_name.clone(),
                    detail,
                    pid: Some(p.pid),
                },
            }
        })
        .collect()
}

/// Files of the integrity alerts still to triage, once each. A deleted file
/// is no longer there to be moved.
fn file_candidates(state: &AppState) -> Vec<Candidate> {
    let mut seen = std::collections::HashSet::new();
    state
        .fim
        .alerts
        .iter()
        .filter(|a| {
            !a.acknowledged && !a.allowlisted && a.change_type != crate::dto::FimChangeType::Deleted
        })
        .filter(|a| seen.insert(a.path.clone()))
        .map(|a| {
            let detail = format!(
                "Changement d\u{00e9}tect\u{00e9} le {}",
                crate::format::local_datetime(a.timestamp)
            );
            Candidate {
                title: a.path.clone(),
                detail: detail.clone(),
                pending: PendingConfirmation {
                    action_type: ResponseActionType::QuarantineFile,
                    target: a.path.clone(),
                    detail,
                    pid: None,
                },
            }
        })
        .collect()
}

/// Remote addresses of the network alerts, once each, minus the ones
/// already blocked.
fn address_candidates(state: &AppState) -> Vec<Candidate> {
    let mut seen = std::collections::HashSet::new();
    state
        .network
        .alerts
        .iter()
        .filter(|a| !a.allowlisted)
        .filter_map(|a| remote_address(a).map(|ip| (a, ip)))
        .filter(|(_, ip)| !state.threats.blocked_ips.iter().any(|b| &b.ip == ip))
        .filter(|(_, ip)| seen.insert(ip.clone()))
        .map(|(a, ip)| {
            let label = network_alert_type_label(&a.alert_type);
            Candidate {
                title: ip.clone(),
                detail: format!(
                    "{} \u{2014} {}",
                    label,
                    crate::format::local_datetime(a.detected_at)
                ),
                pending: block_confirmation(ip, &label),
            }
        })
        .collect()
}

fn section_label(ui: &mut Ui, text: String) {
    ui.label(
        egui::RichText::new(text)
            .font(theme::font_label())
            .color(theme::text_tertiary())
            .extra_letter_spacing(theme::TRACKING_NORMAL)
            .strong(),
    );
}

/// The action row. No button acts on a target of its own choosing: the
/// first three open the list of targets, the operator picks one.
fn actions_card(ui: &mut Ui, state: &mut AppState) {
    let picker_id = ui.make_persistent_id("edr_response_picker");
    let mut picker: Option<Picker> = ui.data(|d| d.get_temp(picker_id));
    let processes = process_candidates(state);
    let files = file_candidates(state);
    let addresses = address_candidates(state);
    let mut chosen: Option<PendingConfirmation> = None;

    widgets::data_card(ui, "Actions de réponse", |ui: &mut egui::Ui| {
        section_label(ui, "ACTIONS DE R\u{00c9}PONSE".to_string());
        ui.label(
            egui::RichText::new(
                "Choisissez la cible avant d'agir. Les m\u{00ea}mes actions sont propos\u{00e9}es \
                 dans le d\u{00e9}tail de chaque \u{00e9}v\u{00e9}nement de la vue d'ensemble.",
            )
            .font(theme::font_min())
            .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_SM);

        ui.horizontal_wrapped(|ui: &mut egui::Ui| {
            for (kind, label, icon, count, none) in [
                (
                    Picker::Process,
                    "Terminer un processus\u{2026}",
                    icons::CIRCLE_XMARK,
                    processes.len(),
                    "Aucun processus suspect \u{00e0} terminer",
                ),
                (
                    Picker::File,
                    "Mettre un fichier en quarantaine\u{2026}",
                    icons::FILE_SHIELD,
                    files.len(),
                    "Aucun fichier modifi\u{00e9} \u{00e0} traiter",
                ),
                (
                    Picker::Address,
                    "Bloquer une adresse\u{2026}",
                    icons::LOCK,
                    addresses.len(),
                    "Aucune adresse distante dans les alertes r\u{00e9}seau",
                ),
            ] {
                let response =
                    widgets::button::secondary_button(ui, format!("{icon}  {label}"), count > 0)
                        .on_disabled_hover_text(none);
                if response.clicked() {
                    picker = if picker == Some(kind) {
                        None
                    } else {
                        Some(kind)
                    };
                }
                ui.add_space(theme::SPACE_SM);
            }

            // Isolate / release the endpoint: the target is this host.
            if state.summary.host_isolated {
                if widgets::button::secondary_button(
                    ui,
                    format!("{}  Lever l'isolement", icons::UNLOCK),
                    true,
                )
                .clicked()
                {
                    chosen = Some(PendingConfirmation {
                        action_type: ResponseActionType::ReleaseHost,
                        target: "Ce poste".to_string(),
                        detail: "Le poste retrouve un acc\u{00e8}s complet au r\u{00e9}seau."
                            .to_string(),
                        pid: None,
                    });
                }
            } else if widgets::button::destructive_button(
                ui,
                format!("{}  Isoler le poste", icons::NETWORK),
                true,
            )
            .clicked()
            {
                chosen = Some(PendingConfirmation {
                    action_type: ResponseActionType::IsolateHost,
                    target: "Ce poste".to_string(),
                    detail: isolation_detail(state.summary.standalone).to_string(),
                    pid: None,
                });
            }
        });

        let (candidates, heading, action) = match picker {
            Some(Picker::Process) => (&processes, "PROCESSUS \u{00c0} TERMINER", "Terminer"),
            Some(Picker::File) => (
                &files,
                "FICHIER \u{00c0} METTRE EN QUARANTAINE",
                "Quarantaine",
            ),
            Some(Picker::Address) => (&addresses, "ADRESSE \u{00c0} BLOQUER", "Bloquer 1\u{a0}h"),
            None => return,
        };
        if candidates.is_empty() {
            picker = None;
            return;
        }
        ui.add_space(theme::SPACE_MD);
        section_label(ui, heading.to_string());
        ui.add_space(theme::SPACE_XS);
        for (index, candidate) in candidates.iter().take(PICKER_ROWS).enumerate() {
            ui.push_id(("candidate", index), |ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.set_max_width((ui.available_width() - 170.0).max(160.0));
                        ui.label(
                            egui::RichText::new(&candidate.title)
                                .font(theme::font_body())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            egui::RichText::new(&candidate.detail)
                                .font(theme::font_min())
                                .color(theme::text_tertiary()),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            if widgets::button::destructive_button(ui, action, true).clicked() {
                                chosen = Some(candidate.pending.clone());
                            }
                        },
                    );
                });
            });
            ui.add_space(theme::SPACE_XS);
        }
        if candidates.len() > PICKER_ROWS {
            ui.label(
                egui::RichText::new(format!(
                    "{} de plus : ouvrez l'\u{00e9}v\u{00e9}nement dans la vue d'ensemble pour agir dessus.",
                    crate::format::count(candidates.len() - PICKER_ROWS, "cible"),
                ))
                .font(theme::font_min())
                .color(theme::text_tertiary()),
            );
        }
    });

    ui.data_mut(|d| match picker {
        Some(kind) => {
            d.insert_temp(picker_id, kind);
        }
        None => d.remove::<Picker>(picker_id),
    });

    if let Some(pending) = chosen {
        match pending.action_type {
            // Isolating is offered to every operator, as before; lifting
            // it is held for the administrator when the command leaves.
            ResponseActionType::IsolateHost | ResponseActionType::ReleaseHost => {
                state.threats.confirm_action = Some(pending);
            }
            _ => request(state, pending),
        }
    }
}

/// The addresses blocked right now, whoever blocked them, each with its
/// unblock. Read from the agent's ledger: it survives a restart.
fn blocked_card(ui: &mut Ui, state: &mut AppState) {
    widgets::data_card(ui, "Adresses bloquées", |ui: &mut egui::Ui| {
        section_label(
            ui,
            format!(
                "ADRESSES BLOQU\u{00c9}ES ({})",
                state.threats.blocked_ips.len()
            ),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.blocked_ips.is_empty() {
            widgets::empty_state(
                ui,
                icons::SHIELD_CHECK,
                "Aucune adresse bloqu\u{00e9}e",
                Some(
                    "Les adresses bloqu\u{00e9}es par un op\u{00e9}rateur, un playbook ou une r\u{00e8}gle \
                     appara\u{00ee}tront ici, avec leur d\u{00e9}blocage.",
                ),
            );
            return;
        }

        sort_bar(
            ui,
            BLOCKED_TABLE,
            &[
                ("ip", "Adresse"),
                ("since", "Date du blocage"),
                ("until", "\u{00c9}ch\u{00e9}ance"),
            ],
        );
        ui.add_space(theme::SPACE_SM);
        let mut ordered: Vec<&BlockedIp> = state.threats.blocked_ips.iter().collect();
        sort_rows(
            &mut ordered,
            &widgets::table::sort_of(ui.ctx(), BLOCKED_TABLE),
            |key, a, b| blocked_order(key, a, b),
        );

        let mut unblock: Option<PendingConfirmation> = None;
        for (index, blocked) in ordered.into_iter().enumerate() {
            let until = match blocked.expires_at {
                Some(at) => format!("jusqu'au {}", crate::format::local_datetime(at)),
                None => "sans limite de dur\u{00e9}e".to_string(),
            };
            ui.push_id(("blocked", index), |ui| {
                ui.horizontal(|ui: &mut egui::Ui| {
                    ui.label(
                        egui::RichText::new(icons::LOCK)
                            .size(theme::ICON_SM)
                            .color(theme::readable_color(theme::ERROR)),
                    );
                    ui.add_space(theme::SPACE_XS);
                    ui.vertical(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(&blocked.ip)
                                .font(theme::font_mono())
                                .color(theme::text_primary()),
                        );
                        ui.label(
                            egui::RichText::new(format!(
                                "Bloqu\u{00e9}e le {} \u{2014} {}",
                                crate::format::local_datetime(blocked.blocked_at),
                                until
                            ))
                            .font(theme::font_min())
                            .color(theme::text_tertiary()),
                        );
                    });
                    ui.with_layout(
                        egui::Layout::right_to_left(egui::Align::Center),
                        |ui: &mut egui::Ui| {
                            if widgets::ghost_button(
                                ui,
                                format!("{}  D\u{00e9}bloquer", icons::UNLOCK),
                            )
                            .clicked()
                            {
                                unblock = Some(PendingConfirmation {
                                    action_type: ResponseActionType::UnblockIp,
                                    target: blocked.ip.clone(),
                                    detail: format!(
                                        "Le trafic avec cette adresse sera de nouveau autoris\u{00e9} \
                                         (blocage {until})."
                                    ),
                                    pid: None,
                                });
                            }
                        },
                    );
                });
            });
            ui.add_space(theme::SPACE_XS);
        }
        if let Some(pending) = unblock {
            state.threats.confirm_action = Some(pending);
        }
    });
}

/// Files held in quarantine, each with its restore.
fn quarantine_card(ui: &mut Ui, state: &mut AppState) {
    widgets::data_card(ui, "Quarantaine", |ui: &mut egui::Ui| {
        section_label(
            ui,
            format!(
                "FILE DE QUARANTAINE ({})",
                state.threats.quarantined_count()
            ),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.quarantined_count() == 0 {
            widgets::empty_state(
                ui,
                icons::SHIELD_CHECK,
                "Aucun fichier en quarantaine",
                Some("Les fichiers mis en quarantaine appara\u{00ee}tront ici."),
            );
            return;
        }
        sort_bar(
            ui,
            QUARANTINE_TABLE,
            &[("path", "Chemin"), ("size", "Taille"), ("date", "Date")],
        );
        ui.add_space(theme::SPACE_SM);
        let mut ordered: Vec<&QuarantinedFile> = state
            .threats
            .quarantine_queue
            .iter()
            .filter(|file| !file.restored)
            .collect();
        sort_rows(
            &mut ordered,
            &widgets::table::sort_of(ui.ctx(), QUARANTINE_TABLE),
            |key, a, b| quarantine_order(key, a, b),
        );

        let mut restore: Option<PendingConfirmation> = None;
        for file in ordered {
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
                            "SHA-256\u{a0}: {} \u{2014} {} \u{2014} {} \u{2014} {}",
                            if file.sha256.is_empty() {
                                "non calcul\u{e9}e".to_string()
                            } else {
                                file.sha256.chars().take(16).collect::<String>()
                            },
                            crate::format::bytes(file.size_bytes),
                            file.reason,
                            crate::format::local_datetime(file.quarantined_at),
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
                            restore = Some(PendingConfirmation {
                                action_type: ResponseActionType::RestoreFile,
                                target: file.id.to_string(),
                                detail: format!("Restaurer vers {}", file.original_path),
                                pid: None,
                            });
                        }
                    },
                );
            });
            ui.add_space(theme::SPACE_XS);
        }
        if let Some(pending) = restore {
            state.threats.confirm_action = Some(pending);
        }
    });
}

/// The actions asked for during this session and what became of them.
fn journal_card(ui: &mut Ui, state: &mut AppState) {
    widgets::data_card(ui, "Journal des actions", |ui: &mut egui::Ui| {
        section_label(
            ui,
            format!("JOURNAL DES ACTIONS ({})", state.threats.response_log.len()),
        );
        ui.add_space(theme::SPACE_SM);

        if state.threats.response_log.is_empty() {
            widgets::empty_state(
                ui,
                icons::LIST,
                "Aucune action",
                Some(
                    "Les actions de r\u{00e9}ponse lanc\u{00e9}es depuis cette session seront \
                     enregistr\u{00e9}es ici. L'historique complet est dans le journal d'audit.",
                ),
            );
            return;
        }
        if sort_bar(
            ui,
            JOURNAL_TABLE,
            &[
                ("date", "Date"),
                ("action", "Action"),
                ("target", "Cible"),
                ("status", "Statut"),
            ],
        ) {
            state.threats.response_page = 0;
        }
        ui.add_space(theme::SPACE_SM);
        // Most recent first, then the key chosen, before paging.
        let mut ordered: Vec<&ResponseLogEntry> = state.threats.response_log.iter().collect();
        sort_rows(
            &mut ordered,
            &widgets::table::sort_of(ui.ctx(), JOURNAL_TABLE),
            |key, a, b| journal_order(key, a, b),
        );

        let page_size = 15;
        let total = state.threats.response_log.len();
        let total_pages = total.div_ceil(page_size).max(1);
        if state.threats.response_page >= total_pages {
            state.threats.response_page = total_pages.saturating_sub(1);
        }
        let start = state.threats.response_page.saturating_mul(page_size);

        for entry in ordered.into_iter().skip(start).take(page_size) {
            let (icon, color) = match entry.status {
                ResponseStatus::Pending => (icons::CLOCK, theme::WARNING),
                ResponseStatus::InProgress => (icons::PLAY, theme::INFO),
                ResponseStatus::Success => (icons::CHECK, theme::SUCCESS),
                ResponseStatus::Failed => (icons::CIRCLE_XMARK, theme::ERROR),
            };

            ui.horizontal(|ui: &mut egui::Ui| {
                ui.label(egui::RichText::new(icon).size(theme::ICON_SM).color(color));
                ui.add_space(theme::SPACE_XS);
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

                // Trailing columns in fixed slots, so rows stay in line.
                ui.with_layout(
                    egui::Layout::right_to_left(egui::Align::Center),
                    |ui: &mut egui::Ui| {
                        let slot =
                            |ui: &mut egui::Ui, width: f32, add: &mut dyn FnMut(&mut egui::Ui)| {
                                ui.allocate_ui_with_layout(
                                    egui::vec2(width, theme::BUTTON_HEIGHT),
                                    egui::Layout::right_to_left(egui::Align::Center),
                                    |ui| {
                                        ui.set_width(width);
                                        add(ui);
                                    },
                                );
                            };
                        slot(ui, 128.0, &mut |ui| {
                            ui.label(
                                egui::RichText::new(crate::format::local_datetime(entry.timestamp))
                                    .font(theme::font_label())
                                    .color(theme::text_tertiary()),
                            );
                        });
                        slot(ui, 110.0, &mut |ui| {
                            widgets::status_badge(ui, entry.status.label_fr(), color);
                        });
                        slot(ui, 130.0, &mut |ui| {
                            ui.label(
                                egui::RichText::new(&entry.operator)
                                    .font(theme::font_label())
                                    .color(theme::text_secondary()),
                            );
                        });
                    },
                );
            });
            ui.add_space(theme::SPACE_XS);
        }

        if total > page_size {
            ui.add_space(theme::SPACE_SM);
            let mut pag = crate::widgets::pagination::PaginationState::new(total, page_size);
            pag.current_page = state.threats.response_page.saturating_add(1);
            if widgets::pagination(ui, &mut pag) {
                state.threats.response_page = pag.current_page.saturating_sub(1);
            }
        }
    });
}

/// Render the response tab. The confirmation of the action chosen is drawn
/// by the module for every tab ([`resolve_confirmation`]).
pub(super) fn show(ui: &mut Ui, state: &mut AppState) -> Option<GuiCommand> {
    actions_card(ui, state);
    ui.add_space(theme::SPACE_MD);
    blocked_card(ui, state);
    ui.add_space(theme::SPACE_MD);
    quarantine_card(ui, state);
    ui.add_space(theme::SPACE_MD);
    journal_card(ui, state);
    None
}

/// What isolating the endpoint does, for the confirmation dialog.
fn isolation_detail(standalone: bool) -> &'static str {
    if standalone {
        "Tout le trafic r\u{00e9}seau sera coup\u{00e9}, sauf le DNS et le DHCP. \
         Le poste reste isol\u{00e9} jusqu'\u{00e0} la lev\u{00e9}e depuis cet \u{00e9}cran."
    } else {
        "Tout le trafic r\u{00e9}seau sera coup\u{00e9}, sauf la plateforme Sentinel GRC, \
         le DNS et le DHCP. Le poste reste isol\u{00e9} jusqu'\u{00e0} la lev\u{00e9}e, \
         depuis cet \u{00e9}cran ou depuis la plateforme."
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn alert(source: Option<&str>, destination: Option<&str>) -> GuiNetworkAlert {
        GuiNetworkAlert {
            alert_type: "c2".into(),
            severity: crate::dto::Severity::High,
            description: "Connexion suspecte".into(),
            source_ip: source.map(str::to_string),
            destination_ip: destination.map(str::to_string),
            destination_port: Some(4444),
            confidence: 90,
            detected_at: chrono::Utc::now(),
            ai_confidence: None,
            is_false_positive: None,
            ai_analysis: None,
            acknowledged: false,
            allowlisted: false,
        }
    }

    #[test]
    fn the_address_to_block_is_the_remote_peer() {
        assert_eq!(
            remote_address(&alert(Some("192.168.1.20"), Some("203.0.113.7"))).as_deref(),
            Some("203.0.113.7")
        );
    }

    /// `source_ip` is this host: blocking it would cut the endpoint off.
    #[test]
    fn a_local_or_own_address_is_never_offered_for_blocking() {
        // No remote peer: nothing to block, never the source.
        assert_eq!(remote_address(&alert(Some("192.168.1.20"), None)), None);
        // The "remote" is this host itself.
        assert_eq!(
            remote_address(&alert(Some("192.168.1.20"), Some("192.168.1.20"))),
            None
        );
        for local in [
            "127.0.0.1",
            "::1",
            "0.0.0.0",
            "::ffff:127.0.0.1",
            "pas-une-ip",
        ] {
            assert_eq!(
                remote_address(&alert(Some("192.168.1.20"), Some(local))),
                None,
                "{local}"
            );
        }
    }

    #[test]
    fn addresses_sort_numerically_and_open_ended_blocks_come_last() {
        use std::cmp::Ordering;
        assert_eq!(address_order("9.9.9.9", "10.0.0.1"), Ordering::Less);
        assert_eq!(address_order("abc", "ABD"), Ordering::Less);

        let now = chrono::Utc::now();
        let timed = BlockedIp {
            ip: "203.0.113.7".into(),
            blocked_at: now,
            expires_at: Some(now + chrono::Duration::hours(1)),
        };
        let permanent = BlockedIp {
            ip: "198.51.100.9".into(),
            blocked_at: now - chrono::Duration::hours(2),
            expires_at: None,
        };
        assert_eq!(blocked_order("until", &timed, &permanent), Ordering::Less);
        assert_eq!(blocked_order("since", &permanent, &timed), Ordering::Less);
        assert_eq!(blocked_order("ip", &permanent, &timed), Ordering::Less);
    }

    #[test]
    fn the_journal_sorts_statuses_by_progress() {
        let mut ranks = [
            ResponseStatus::Success,
            ResponseStatus::Failed,
            ResponseStatus::Pending,
            ResponseStatus::InProgress,
        ];
        ranks.sort_by_key(|status| status_rank(*status));
        assert_eq!(
            ranks,
            [
                ResponseStatus::Pending,
                ResponseStatus::InProgress,
                ResponseStatus::Failed,
                ResponseStatus::Success,
            ]
        );
    }

    #[test]
    fn candidates_never_target_this_host_and_skip_blocked_addresses() {
        let mut state = AppState::default();
        for destination in [
            Some("203.0.113.7"),
            Some("203.0.113.7"),
            None,
            Some("198.51.100.9"),
        ] {
            state
                .network
                .alerts
                .push_back(alert(Some("192.168.1.20"), destination));
        }
        state.threats.blocked_ips.push(crate::dto::BlockedIp {
            ip: "198.51.100.9".into(),
            blocked_at: chrono::Utc::now(),
            expires_at: None,
        });

        let targets: Vec<String> = address_candidates(&state)
            .into_iter()
            .map(|c| c.pending.target)
            .collect();
        assert_eq!(targets, ["203.0.113.7"]);
    }
}
