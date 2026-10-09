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
    let setting_password =
        state.security.changing_password || state.settings.admin_password_hash.is_empty();

    let mut outcome = DialogOutcome::Pending;
    let width = DIALOG_WIDTH.min(ctx.screen_rect().width() - theme::SPACE_LG * 2.0);
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
            outcome = if setting_password {
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
    }
    outcome
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
