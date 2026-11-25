// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Administrator dialog: unlock, first password, password change.
//!
//! One modal for the whole application. Any page, the tray menu or an
//! assistant suggestion asks for it through `AppState::require_admin` or by
//! sending a command that needs the administrator mode; the dialog explains
//! why, and the held command goes out as soon as the session opens. It
//! replaces the settings-only window that left the rest of the interface
//! clickable behind it and the disabled "· admin" buttons elsewhere.
//!
//! When the agent runs in a background service and this interface is its
//! companion (`SecurityState::service`), the service is the one that knows
//! the password: the dialog sends it there and waits for the answer,
//! instead of checking it against the interface's own copy of the hash.

use crate::admin_auth::{self, Verification};
use crate::app::AppState;
use crate::icons;
use crate::theme;
use crate::widgets;

/// What happened in the dialog this frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DialogOutcome {
    /// Still open, or not shown.
    Pending,
    /// The administrator session is now open.
    Unlocked,
    /// A new password was stored for an already unlocked session.
    PasswordChanged,
    /// Closed without unlocking.
    Cancelled,
}

const DIALOG_WIDTH: f32 = 420.0;

/// Draw the dialog when one is requested.
pub fn show(ctx: &egui::Context, state: &mut AppState) -> DialogOutcome {
    let Some(reason) = state.security.unlock_reason.clone() else {
        return DialogOutcome::Pending;
    };
    let setting_password = state.security.changing_password || !state.admin_password_configured();

    let mut outcome = DialogOutcome::Pending;
    let width = DIALOG_WIDTH.min(ctx.content_rect().width() - theme::SPACE_LG * 2.0);
    let modal = egui::Modal::new(egui::Id::new("admin_dialog"))
        .backdrop_color(theme::backdrop_color(theme::BACKDROP_ALPHA))
        .frame(
            egui::Frame::new()
                .fill(theme::bg_secondary())
                .corner_radius(egui::CornerRadius::same(theme::CARD_ROUNDING))
                .stroke(egui::Stroke::new(
                    theme::BORDER_HAIRLINE,
                    theme::border_subtle(),
                ))
                .shadow(theme::Elevation::Level4.ambient())
                .inner_margin(egui::Margin::same(theme::SPACE_LG as i8)),
        )
        .show(ctx, |ui| {
            ui.set_width(width);
            header(
                ui,
                setting_password,
                state.security.changing_password,
                &reason,
            );
            ui.add_space(theme::SPACE_MD);
            outcome = if let Some(step) = service_step(ui, state) {
                step
            } else if setting_password {
                password_form(ui, state)
            } else {
                unlock_form(ui, state)
            };
        });

    if outcome == DialogOutcome::Pending && modal.should_close() {
        outcome = DialogOutcome::Cancelled;
    }
    if outcome != DialogOutcome::Pending {
        state.security.close_dialog();
        state.security.service_waiting = None;
        state.security.service_outcome = None;
    }
    outcome
}

/// How long the dialog waits for the service before giving the form back.
const SERVICE_ANSWER_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);

/// Hand an administrator request to the shell, which sends it to the
/// service; the dialog waits for the answer.
fn ask_service(state: &mut AppState, request: crate::events::GuiCommand) {
    state.security.form.error = None;
    state.security.service_outcome = None;
    state.security.service_request = Some(request);
    state.security.service_waiting = Some(std::time::Instant::now());
}

/// The typed password, on its way to the service.
fn typed_password(state: &AppState) -> crate::events::Secret {
    crate::events::Secret::new(state.security.form.password.as_str())
}

/// The part of the dialog that belongs to the background service: its
/// answer, the wait for it, or the fact that it cannot be reached. `None`
/// when the form is to be drawn (no service, or nothing pending).
fn service_step(ui: &mut egui::Ui, state: &mut AppState) -> Option<DialogOutcome> {
    use crate::events::ServiceAdminOutcome;
    let link = state.security.service?;

    if let Some(answer) = state.security.service_outcome.take() {
        state.security.service_waiting = None;
        let error = match answer {
            ServiceAdminOutcome::Unlocked { .. } => {
                open_session(state);
                return Some(DialogOutcome::Unlocked);
            }
            ServiceAdminOutcome::PasswordSet { .. } => {
                // The interface keeps its own copy in step, for the day it
                // runs the agent itself again.
                match admin_auth::hash_password(&state.security.form.password) {
                    Ok(hash) => state.settings.admin_password_hash = hash,
                    Err(e) => tracing::warn!("Local copy of the admin hash not updated: {e}"),
                }
                tracing::info!("[AUDIT] Administrator password stored by the service");
                if state.security.changing_password {
                    return Some(DialogOutcome::PasswordChanged);
                }
                open_session(state);
                return Some(DialogOutcome::Unlocked);
            }
            ServiceAdminOutcome::Rejected { attempts_left } => {
                state.security.form.password = Default::default();
                if attempts_left > 0 {
                    format!(
                        "Mot de passe incorrect. {attempts_left} essai{} avant blocage temporaire.",
                        crate::format::plural_suffix(attempts_left)
                    )
                } else {
                    "Mot de passe incorrect.".to_string()
                }
            }
            ServiceAdminOutcome::LockedOut { retry_after_secs } => {
                state.security.form.password = Default::default();
                format!(
                    "Trop de tentatives incorrectes. Nouvel essai possible dans {}.",
                    crate::format::duration_short(retry_after_secs.max(1))
                )
            }
            ServiceAdminOutcome::NotConfigured => {
                "Le service n'a pas encore de mot de passe administrateur.".to_string()
            }
            ServiceAdminOutcome::Refused { message } => message,
            ServiceAdminOutcome::Locked => {
                "La connexion au service a été interrompue. Réessayez.".to_string()
            }
        };
        state.security.form.error = Some(error);
        return None;
    }

    if let Some(since) = state.security.service_waiting {
        if since.elapsed() > SERVICE_ANSWER_TIMEOUT {
            state.security.service_waiting = None;
            state.security.form.error =
                Some("Le service Sentinel n'a pas répondu. Réessayez.".to_string());
            return None;
        }
        ui.horizontal(|ui| {
            ui.spinner();
            ui.label(
                egui::RichText::new("Vérification par le service Sentinel…")
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
        });
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(100));
        ui.add_space(theme::SPACE_LG);
        return Some(
            if widgets::secondary_button(ui, "Annuler", true).clicked() {
                DialogOutcome::Cancelled
            } else {
                DialogOutcome::Pending
            },
        );
    }

    if !link.connected {
        ui.label(
            egui::RichText::new(
                "Service Sentinel injoignable : le mode administrateur est indisponible tant \
                 que la connexion n'est pas rétablie.",
            )
            .font(theme::font_body())
            .color(theme::readable_color(theme::WARNING)),
        );
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_secs(1));
        ui.add_space(theme::SPACE_LG);
        return Some(if widgets::secondary_button(ui, "Fermer", true).clicked() {
            DialogOutcome::Cancelled
        } else {
            DialogOutcome::Pending
        });
    }
    None
}

fn header(ui: &mut egui::Ui, setting_password: bool, changing: bool, reason: &str) {
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new(icons::LOCK)
                .size(theme::ICON_LG)
                .color(theme::accent_text()),
        );
        ui.add_space(theme::SPACE_SM);
        ui.vertical(|ui| {
            let title = match (setting_password, changing) {
                (true, true) => "Changer le mot de passe administrateur",
                (true, false) => "Définir le mot de passe administrateur",
                _ => "Mode administrateur requis",
            };
            ui.label(
                egui::RichText::new(title)
                    .font(theme::font_heading())
                    .color(theme::text_primary()),
            );
            ui.label(
                egui::RichText::new(reason)
                    .font(theme::font_body())
                    .color(theme::text_secondary()),
            );
        });
    });
}

fn unlock_form(ui: &mut egui::Ui, state: &mut AppState) -> DialogOutcome {
    let now = chrono::Utc::now();
    if let Some(remaining) = state.security.lockout.remaining(now) {
        ui.label(
            egui::RichText::new(format!(
                "Trop de tentatives incorrectes. Nouvel essai possible dans {}.",
                crate::format::duration_short(remaining.num_seconds().max(1) as u64)
            ))
            .font(theme::font_body())
            .color(theme::readable_color(theme::ERROR)),
        );
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_secs(1));
        ui.add_space(theme::SPACE_LG);
        return if widgets::secondary_button(ui, "Fermer", true).clicked() {
            DialogOutcome::Cancelled
        } else {
            DialogOutcome::Pending
        };
    }

    ui.label(
        egui::RichText::new(format!(
            "La session administrateur reste ouverte {} puis se verrouille seule.",
            crate::format::duration_short(crate::state::SecurityState::SESSION.num_seconds() as u64)
        ))
        .font(theme::font_small())
        .color(theme::text_tertiary()),
    );
    ui.add_space(theme::SPACE_SM);

    let form = &mut state.security.form;
    let field = widgets::PasswordInput::new(
        &mut form.password,
        "Mot de passe administrateur",
        &mut form.reveal,
    )
    .width(ui.available_width())
    .id_salt("admin_dialog_password")
    .autofocus(true)
    .proportional()
    .show(ui);
    error_line(ui, form.error.as_deref());

    ui.add_space(theme::SPACE_LG);
    let (cancel, mut submit) = buttons(ui, "Déverrouiller", !form.password.is_empty());
    submit |= field.submitted && !form.password.is_empty();
    if cancel {
        return DialogOutcome::Cancelled;
    }
    if !submit {
        return DialogOutcome::Pending;
    }

    // A companion interface does not decide: the service checks the
    // password against its own hash, with its own lockout.
    if state
        .security
        .service
        .is_some_and(|link| link.admin_configured)
    {
        let request = crate::events::GuiCommand::ServiceAdminUnlock {
            password: typed_password(state),
        };
        ask_service(state, request);
        return DialogOutcome::Pending;
    }

    match admin_auth::verify_password(
        &state.security.form.password,
        &state.settings.admin_password_hash,
    ) {
        Verification::Accepted { rehash } => {
            if rehash {
                // Replace the shared-salt SHA-256 digest of earlier versions.
                match admin_auth::hash_password(&state.security.form.password) {
                    Ok(hash) => state.settings.admin_password_hash = hash,
                    Err(e) => tracing::warn!("Admin password re-hash failed: {e}"),
                }
            }
            state.security.lockout.record_success();
            if state.security.service.is_some() {
                // The service has no password yet and the interface's own
                // just proved right: hand it over, the service unlocks.
                let request = crate::events::GuiCommand::ServiceAdminSetPassword {
                    password: typed_password(state),
                };
                ask_service(state, request);
                return DialogOutcome::Pending;
            }
            open_session(state);
            DialogOutcome::Unlocked
        }
        Verification::Rejected => {
            state.security.lockout.record_failure(now);
            let left =
                admin_auth::ATTEMPTS_BEFORE_LOCKOUT.saturating_sub(state.security.lockout.failures);
            state.security.form.password = Default::default();
            state.security.form.error = Some(if left > 0 {
                format!(
                    "Mot de passe incorrect. {left} essai{} avant blocage temporaire.",
                    crate::format::plural_suffix(left)
                )
            } else {
                "Mot de passe incorrect.".to_string()
            });
            tracing::warn!(
                "[AUDIT] Failed administrator unlock ({} consecutive)",
                state.security.lockout.failures
            );
            DialogOutcome::Pending
        }
        // The stored hash vanished between frames: offer to define one.
        Verification::NotConfigured => DialogOutcome::Pending,
    }
}

fn password_form(ui: &mut egui::Ui, state: &mut AppState) -> DialogOutcome {
    if !state.security.changing_password {
        ui.label(
            egui::RichText::new(
                "Aucun mot de passe administrateur n'est défini sur ce poste. Choisissez-en un : \
                 il protège la mise en pause, la désactivation des détections et les autres \
                 réglages critiques.",
            )
            .font(theme::font_body())
            .color(theme::text_secondary()),
        );
        ui.add_space(theme::SPACE_SM);
    }

    let form = &mut state.security.form;
    let first =
        widgets::PasswordInput::new(&mut form.password, "Nouveau mot de passe", &mut form.reveal)
            .width(ui.available_width())
            .id_salt("admin_dialog_new_password")
            .autofocus(true)
            .proportional()
            .show(ui);
    if !form.password.is_empty() {
        strength_meter(ui, &form.password);
    }
    ui.add_space(theme::SPACE_SM);
    let second = widgets::PasswordInput::new(
        &mut form.confirmation,
        "Confirmer le mot de passe",
        &mut form.reveal,
    )
    .width(ui.available_width())
    .id_salt("admin_dialog_confirm_password")
    .proportional()
    .show(ui);
    let hint = format!(
        "Au moins {} caractères ; une phrase de plusieurs mots est idéale.",
        admin_auth::MIN_PASSWORD_CHARS
    );
    match form.error.as_deref() {
        Some(error) => error_line(ui, Some(error)),
        None => {
            ui.add_space(theme::SPACE_XS);
            ui.label(
                egui::RichText::new(hint)
                    .font(theme::font_small())
                    .color(theme::text_tertiary()),
            );
        }
    }

    ui.add_space(theme::SPACE_LG);
    let ready = !form.password.is_empty() && !form.confirmation.is_empty();
    let label = if state.security.changing_password {
        "Enregistrer"
    } else {
        "Définir et déverrouiller"
    };
    let (cancel, mut submit) = buttons(ui, label, ready);
    submit |= ready && (first.submitted || second.submitted);
    if cancel {
        return DialogOutcome::Cancelled;
    }
    if !submit {
        return DialogOutcome::Pending;
    }

    let form = &mut state.security.form;
    if let Err(issue) = admin_auth::check_new_password(&form.password, &form.confirmation) {
        form.error = Some(issue.message());
        return DialogOutcome::Pending;
    }
    if state.security.service.is_some() {
        // Stored by the service, which answers; the local copy follows.
        let request = crate::events::GuiCommand::ServiceAdminSetPassword {
            password: typed_password(state),
        };
        ask_service(state, request);
        return DialogOutcome::Pending;
    }
    let form = &mut state.security.form;
    match admin_auth::hash_password(&form.password) {
        Ok(hash) => {
            state.settings.admin_password_hash = hash;
            state.security.lockout.record_success();
            tracing::info!("[AUDIT] Administrator password set from the GUI");
            if state.security.changing_password {
                DialogOutcome::PasswordChanged
            } else {
                open_session(state);
                DialogOutcome::Unlocked
            }
        }
        Err(e) => {
            state.security.form.error = Some(e);
            DialogOutcome::Pending
        }
    }
}

fn open_session(state: &mut AppState) {
    state.security.admin_unlocked = true;
    state.security.last_unlock = Some(chrono::Utc::now());
    tracing::info!("[AUDIT] Administrator session opened from the GUI");
}

fn error_line(ui: &mut egui::Ui, error: Option<&str>) {
    if let Some(error) = error {
        ui.add_space(theme::SPACE_XS);
        ui.label(
            egui::RichText::new(error)
                .font(theme::font_body())
                .color(theme::readable_color(theme::ERROR)),
        );
    }
}

/// Cancel and confirm, right-aligned. Returns `(cancelled, confirmed)`.
fn buttons(ui: &mut egui::Ui, confirm: &str, enabled: bool) -> (bool, bool) {
    let mut cancelled = false;
    let mut confirmed = false;
    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
        let response = widgets::primary_button(ui, confirm, enabled);
        confirmed = response.clicked();
        if !enabled {
            response.on_hover_text("Saisissez le mot de passe pour continuer.");
        }
        ui.add_space(theme::SPACE_SM);
        cancelled = widgets::secondary_button(ui, "Annuler", true).clicked();
    });
    (cancelled, confirmed)
}

/// Four segments and a word, filled with the strength of a new password.
/// Shared by this dialog and the enrolment wizard.
pub fn strength_meter(ui: &mut egui::Ui, password: &str) {
    let strength = admin_auth::strength(password);
    ui.add_space(theme::SPACE_XS);
    let (label, color) = match strength {
        0 => ("Trop faible", theme::ERROR),
        1 => ("Faible", theme::SEVERITY_HIGH),
        2 => ("Correct", theme::WARNING),
        3 => ("Solide", theme::SUCCESS),
        _ => ("Très solide", theme::SUCCESS),
    };
    ui.horizontal(|ui| {
        let segment = egui::vec2(48.0, 4.0);
        for index in 0..4u8 {
            let (rect, _) = ui.allocate_exact_size(segment, egui::Sense::hover());
            let fill = if strength > 0 && index < strength {
                theme::readable_color(color)
            } else {
                theme::bg_tertiary()
            };
            ui.painter()
                .rect_filled(rect, egui::CornerRadius::same(2), fill);
        }
        ui.add_space(theme::SPACE_SM);
        ui.label(
            egui::RichText::new(label)
                .font(theme::font_small())
                .color(theme::readable_color(color)),
        );
    });
}
