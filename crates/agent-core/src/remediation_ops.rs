// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Automated remediation operations (GUI-only).

#[cfg(feature = "gui")]
use crate::AgentRuntime;
#[cfg(feature = "gui")]
use std::sync::Arc;
#[cfg(feature = "gui")]
use tracing::{info, warn};

/// Maximum time allowed for a single remediation action (5 minutes).
#[cfg(feature = "gui")]
const REMEDIATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);

/// Run a remediation action on a blocking thread with a timeout.
///
/// Extracted as a free function so that the `spawn_blocking` closure
/// captures only owned (`'static`) values and doesn't borrow `&self`.
#[cfg(feature = "gui")]
async fn run_remediation(
    engine: Arc<agent_scanner::RemediationEngine>,
    action: agent_common::types::RemediationAction,
) -> Option<agent_common::types::RemediationResult> {
    let handle = tokio::task::spawn_blocking(move || engine.execute(&action));
    match tokio::time::timeout(REMEDIATION_TIMEOUT, handle).await {
        Ok(Ok(r)) => Some(r),
        Ok(Err(e)) => {
            warn!("Remediation task panicked: {}", e);
            None
        }
        Err(_) => {
            warn!("Remediation timed out after {:?}", REMEDIATION_TIMEOUT);
            None
        }
    }
}

#[cfg(feature = "gui")]
impl AgentRuntime {
    /// Execute remediation for a specific check.
    pub async fn remediate(&self, check_id: &str) -> bool {
        info!("Applying remediation for check \'{}\'", check_id);

        let actions = self.remediation_engine.get_platform_remediation(check_id);
        if let Some(action) = actions.first() {
            let engine = Arc::clone(&self.remediation_engine);
            let result = match run_remediation(engine, (*action).clone()).await {
                Some(r) => r,
                None => {
                    self.emit_notification(
                        "Remédiation Expirée",
                        &format!(
                            "La remédiation pour \'{}\' a échoué ou a dépassé le délai.",
                            check_id
                        ),
                        "error",
                    );
                    return false;
                }
            };

            // Audit the action
            if let Some(audit) = &self.audit_trail {
                audit
                    .log(
                        crate::audit_trail::AuditAction::RemediationApplied {
                            check_id: check_id.to_string(),
                        },
                        "user",
                        Some(format!(
                            "Status: {:?}, Duration: {}ms, Output: {}",
                            result.status, result.duration_ms, result.output
                        )),
                    )
                    .await;
            }

            let success = matches!(
                result.status,
                agent_common::types::remediation::RemediationStatus::Success
            );

        if success {
            #[cfg(feature = "voice")]
            if let Some(voice) = &self.voice_service {
                voice.play_beep();
            }

            self.emit_notification(
                "Remédiation Réussie",
                &format!("Le contrôle \'{}\' a été corrigé avec succès.", check_id),
                "success",
            );
            } else {
                self.emit_notification(
                    "Échec de Remédiation",
                    &format!(
                        "Impossible de corriger \'{}\' : {}",
                        check_id,
                        result.error.unwrap_or_default()
                    ),
                    "error",
                );
            }

            // Force a re-check to update status
            self.state
                .force_check
                .store(true, std::sync::atomic::Ordering::Release);

            success
        } else {
            // ...
            false
        }
    }

    /// Execute an AI-generated remediation action.
    /// This requires the action to have is_ai_generated set to true.
    pub async fn apply_ai_remediation(&self, action: agent_common::types::RemediationAction) -> bool {
        if !action.is_ai_generated {
            warn!("apply_ai_remediation called with non-AI action for '{}'", action.check_id);
            return false;
        }

        info!("Applying AI-generated remediation for '{}'", action.check_id);

        let engine = Arc::clone(&self.remediation_engine);
        let check_id = action.check_id.clone();
        
        let result = match run_remediation(engine, action).await {
            Some(r) => r,
            None => {
                self.emit_notification(
                    "Remédiation IA Expirée",
                    &format!("La remédiation IA pour '{}' a échoué.", check_id),
                    "error",
                );
                return false;
            }
        };

        // Audit the AI action
        if let Some(audit) = &self.audit_trail {
            audit
                .log(
                    crate::audit_trail::AuditAction::AIInteraction { prompt_preview: format!("Apply AI Fix for {}", check_id) },
                    "user",
                    Some(format!(
                        "Status: {:?}, Output: {}",
                        result.status, result.output
                    )),
                )
                .await;
        }

        let success = matches!(
            result.status,
            agent_common::types::remediation::RemediationStatus::Success
        );

        if success {
            #[cfg(feature = "voice")]
            if let Some(voice) = &self.voice_service {
                voice.play_beep();
            }

            self.emit_notification(
                "Correctif IA Appliqué",
                &format!("Le correctif suggéré pour '{}' a été appliqué.", check_id),
                "success",
            );
        } else {
            self.emit_notification(
                "Échec du Correctif IA",
                &format!("L'application du correctif IA pour '{}' a échoué.", check_id),
                "error",
            );
        }

        // Force reload
        self.state.force_check.store(true, std::sync::atomic::Ordering::Release);
        
        success
    }

    /// Preview remediation for a specific check.
    pub fn remediate_preview(&self, check_id: &str) {
        info!("Generating remediation preview for check \'{}\'", check_id);

        let actions = self.remediation_engine.get_platform_remediation(check_id);

        if let Some(action) = actions.first() {
            let preview_text = format!(
                "## Audit Visuel : {}\n\n**Action :** {}\n**Commande :** `{}`\n**Risque :** {}\n**Redémarrage requis :** {}\n\n> [!NOTE]\n> Cliquez sur 'Recours / Remédiation' pour exécuter ce script. Des privilèges Administrateur peuvent être requis.",
                action.description,
                action.description,
                action.script,
                action.risk_level.label(),
                if action.requires_reboot { "Oui" } else { "Non" }
            );

            self.emit_gui_event(agent_gui::events::AgentEvent::Notification {
                notification: agent_gui::dto::GuiNotification {
                    id: uuid::Uuid::new_v4(),
                    title: format!("Aperçu : {}", check_id),
                    body: preview_text,
                    severity: "info".to_string(),
                    timestamp: chrono::Utc::now(),
                    read: false,
                    action: None,
                },
            });
        } else {
            self.emit_notification(
                "Aperçu Indisponible",
                &format!("Aucun aperçu disponible pour le contrôle \'{}\'.", check_id),
                "info",
            );
        }
    }
}
