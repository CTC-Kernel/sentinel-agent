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
    user_approved: bool,
) -> Option<agent_common::types::RemediationResult> {
    let handle = tokio::task::spawn_blocking(move || {
        if user_approved {
            engine.execute_user_approved(&action)
        } else {
            engine.execute(&action)
        }
    });
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
            let result = match run_remediation(engine, (*action).clone(), false).await {
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
            // Nothing to run for this check on this system: said to the
            // operator, who was otherwise left with a button that did
            // nothing and no word of why.
            info!("No automatic remediation for check '{}'", check_id);
            self.emit_notification(
                "Remédiation indisponible",
                &format!(
                    "Aucune remédiation automatique n'existe pour le contrôle « {} » sur ce système. \
                     Appliquez la correction indiquée dans le détail du contrôle.",
                    check_id
                ),
                "warning",
            );
            false
        }
    }

    /// Execute an AI-generated remediation action.
    /// This requires the action to have is_ai_generated set to true.
    pub async fn apply_ai_remediation(
        &self,
        action: agent_common::types::RemediationAction,
    ) -> bool {
        if !action.is_ai_generated {
            warn!(
                "apply_ai_remediation called with non-AI action for '{}'",
                action.check_id
            );
            return false;
        }

        info!(
            "Applying AI-generated remediation for '{}'",
            action.check_id
        );

        let engine = Arc::clone(&self.remediation_engine);
        let check_id = action.check_id.clone();

        // `true`: the user reviewed and confirmed this script in the GUI
        // before ApplyAiRemediation was sent (see pages/vulnerabilities.rs).
        let result = match run_remediation(engine, action, true).await {
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
                    crate::audit_trail::AuditAction::AIInteraction {
                        prompt_preview: format!("Apply AI Fix for {}", check_id),
                    },
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
                &format!(
                    "L'application du correctif IA pour '{}' a échoué.",
                    check_id
                ),
                "error",
            );
        }

        // Force reload
        self.state
            .force_check
            .store(true, std::sync::atomic::Ordering::Release);

        success
    }

    /// Preview remediation for a specific check.
    pub fn remediate_preview(&self, check_id: &str) {
        info!("Generating remediation preview for check \'{}\'", check_id);

        let actions = self.remediation_engine.get_platform_remediation(check_id);

        // Answered either way: the interface waits for it before it lets
        // the operator confirm, and says so when nothing can be run.
        let event = match actions.first() {
            Some(action) => agent_gui::events::AgentEvent::RemediationPreview {
                check_id: check_id.to_string(),
                available: true,
                description: action.description.clone(),
                command: action.script.clone(),
                risk: match action.risk_level {
                    agent_common::types::RemediationRisk::Safe => "Faible",
                    agent_common::types::RemediationRisk::Moderate => "Mod\u{e9}r\u{e9}",
                    agent_common::types::RemediationRisk::Risky => "\u{c9}lev\u{e9}",
                }
                .to_string(),
                requires_reboot: action.requires_reboot,
            },
            None => agent_gui::events::AgentEvent::RemediationPreview {
                check_id: check_id.to_string(),
                available: false,
                description: String::new(),
                command: String::new(),
                risk: String::new(),
                requires_reboot: false,
            },
        };
        self.emit_gui_event(event);
    }
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    use agent_gui::events::AgentEvent;

    /// The request used to end without a word when the check has no
    /// automatic remediation on this system.
    #[tokio::test]
    async fn a_check_without_automatic_remediation_says_so() {
        let test = standalone_runtime();

        assert!(!test.runtime.remediate("no-such-check").await);

        let told = std::iter::from_fn(|| test.events.try_recv().ok()).any(|event| {
            matches!(
                event,
                AgentEvent::Notification { notification }
                    if notification.title == "Remédiation indisponible"
                        && notification.body.contains("no-such-check")
            )
        });
        assert!(told, "the operator is told that nothing was run");
        // Nothing changed: no check is forced.
        assert!(
            !test
                .runtime
                .state
                .force_check
                .load(std::sync::atomic::Ordering::Acquire)
        );
    }

    /// The interface waits for the preview before it lets the operator
    /// confirm: it is answered even when there is nothing to run.
    #[tokio::test]
    async fn a_preview_is_answered_even_without_remediation() {
        let test = standalone_runtime();

        test.runtime.remediate_preview("no-such-check");

        let answered = std::iter::from_fn(|| test.events.try_recv().ok()).any(|event| {
            matches!(
                event,
                AgentEvent::RemediationPreview { check_id, available: false, .. }
                    if check_id == "no-such-check"
            )
        });
        assert!(answered, "the preview says that nothing is available");
    }
}
