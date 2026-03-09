// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Automated remediation operations (GUI-only).

#[cfg(feature = "gui")]
use crate::AgentRuntime;
#[cfg(feature = "gui")]
use std::sync::Arc;
#[cfg(feature = "gui")]
use tracing::{info, warn};

#[cfg(feature = "gui")]
impl AgentRuntime {
    /// Maximum time allowed for a single remediation action (5 minutes).
    const REMEDIATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);

    /// Execute remediation for a specific check.
    pub async fn remediate(&self, check_id: &str) -> bool {
        info!("Applying remediation for check \'{}\'", check_id);

        let actions = self.remediation_engine.get_platform_remediation(check_id);
        if let Some(action) = actions.first() {
            let engine = Arc::clone(&self.remediation_engine);
            let action = action.clone();
            let result = match tokio::time::timeout(
                Self::REMEDIATION_TIMEOUT,
                tokio::task::spawn_blocking(move || engine.execute(&action)),
            )
            .await
            {
                Ok(Ok(r)) => r,
                Ok(Err(e)) => {
                    warn!("Remediation task panicked for '{}': {}", check_id, e);
                    return false;
                }
                Err(_) => {
                    warn!("Remediation for '{}' timed out after {:?}", check_id, Self::REMEDIATION_TIMEOUT);
                    self.emit_notification(
                        "Remédiation Expirée",
                        &format!("La remédiation pour \'{}\' a dépassé le délai maximum.", check_id),
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

            // Notify GUI
            if success {
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
            warn!("No remediation action found for check '{}'", check_id);
            self.emit_notification(
                "Remédiation Indisponible",
                &format!(
                    "Aucun script de remédiation automatisé n'est configuré pour \'{}\'.",
                    check_id
                ),
                "warning",
            );
            false
        }
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
