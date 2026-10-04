// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Ransomware canary files: deployment at start-up and conversion of a
//! tampered decoy folder into a security incident.
//!
//! The decoys themselves live in [`agent_fim::canary`].

use agent_common::config::AgentConfig;
use agent_fim::canary::{self, CanaryIncident, CanaryManager, CanaryTamper};
use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

use super::AgentRuntime;

/// FIM change type carried to the playbook engine when decoys are encrypted,
/// so a playbook can react to it with a "file change" condition.
pub const PLAYBOOK_CHANGE_TYPE: &str = "ransomware_canary";

/// Incidents waiting between the watcher and the main loop.
const INCIDENT_QUEUE: usize = 64;

fn manifest_path() -> std::path::PathBuf {
    AgentConfig::platform_data_dir().join("canaries.json")
}

/// Whether a playbook should be given the chance to respond: only when the
/// decoys were encrypted, never for a mere removal.
pub(crate) fn triggers_response(incident: &CanaryIncident) -> bool {
    incident.tamper == CanaryTamper::Encrypted
}

/// Describe a tampered decoy folder as a security incident.
pub(crate) fn incident_from(canary: &CanaryIncident) -> SecurityIncident {
    let protected = canary
        .folder
        .parent()
        .unwrap_or(canary.folder.as_path())
        .display();
    let evidence = serde_json::json!({
        "detection": "ransomware_canary",
        "folder": canary.folder,
        "tamper": canary.tamper,
        "modified": canary.modified,
        "missing": canary.missing,
        "foreign": canary.foreign,
        "while_stopped": canary.while_stopped,
    });

    let incident = match canary.tamper {
        CanaryTamper::Encrypted => {
            let when = if canary.while_stopped {
                " pendant que l'agent était arrêté"
            } else {
                ""
            };
            SecurityIncident::new(
                IncidentType::Malware,
                IncidentSeverity::Critical,
                "Ransomware suspecté : fichiers leurres chiffrés",
                format!(
                    "Des fichiers leurres placés dans {protected} ont été modifiés ou renommés{when} \
                     ({} modifié(s), {} disparu(s), {} fichier(s) inconnu(s) apparu(s)). Personne \
                     n'ouvre ces fichiers : un programme est en train de chiffrer ce dossier. \
                     Isolez le poste du réseau et vérifiez les sauvegardes.",
                    canary.modified.len(),
                    canary.missing.len(),
                    canary.foreign.len()
                ),
            )
            .with_confidence(95)
        }
        CanaryTamper::Removed => SecurityIncident::new(
            IncidentType::UnauthorizedChange,
            IncidentSeverity::Medium,
            "Fichiers leurres anti-ransomware supprimés",
            format!(
                "Les fichiers leurres de {protected} ont été supprimés ou déplacés, sans autre \
                 modification. La cause habituelle est un nettoyage manuel. De nouveaux leurres \
                 seront déposés au prochain démarrage de l'agent."
            ),
        )
        .with_confidence(40),
    };
    let mut incident = incident.with_evidence(evidence);
    incident.detected_at = canary.detected_at;
    incident
}

impl AgentRuntime {
    /// Deploy the decoys and start watching them, or remove them when the
    /// protection is turned off.
    pub(crate) async fn start_ransomware_canaries(&self) {
        let manager = Arc::new(CanaryManager::new(manifest_path()));

        if !self.state.ransomware_canaries.load(Ordering::Acquire) {
            *self.canary_rx.lock().await = None;
            let to_clean = Arc::clone(&manager);
            match tokio::task::spawn_blocking(move || to_clean.remove_all()).await {
                Ok(0) => {}
                Ok(removed) => info!(
                    "Ransomware canaries are off: {} decoy folder(s) removed",
                    removed
                ),
                Err(e) => warn!("Failed to remove ransomware canaries: {}", e),
            }
            return;
        }

        let to_deploy = Arc::clone(&manager);
        let report =
            match tokio::task::spawn_blocking(move || to_deploy.deploy(&canary::default_targets()))
                .await
            {
                Ok(report) => report,
                Err(e) => {
                    warn!("Failed to deploy ransomware canaries: {}", e);
                    return;
                }
            };
        for skipped in &report.skipped {
            debug!("Ransomware canary not deployed: {}", skipped);
        }
        info!(
            "Ransomware canaries: {} decoy folder(s) in place, {} location(s) skipped",
            report.active,
            report.skipped.len()
        );

        let (tx, rx) = mpsc::channel(INCIDENT_QUEUE);
        // Tampering found at start-up goes through the same queue.
        for incident in report.incidents {
            if let Err(e) = tx.try_send(incident) {
                warn!("Ransomware canary incident dropped: {}", e);
            }
        }
        *self.canary_rx.lock().await = Some(rx);

        if report.active == 0 {
            return;
        }
        // Each start owns its flag: a restart must not revive the watcher it
        // has just stopped.
        let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));
        *self
            .canary_shutdown
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = Arc::clone(&shutdown);
        tokio::spawn(async move {
            if let Err(e) = canary::watch(manager, tx, shutdown).await {
                warn!("Ransomware canary watcher stopped with error: {}", e);
            }
        });
    }

    /// Tampered decoy folders reported since the last call.
    pub(crate) async fn take_canary_incidents(&self) -> Vec<CanaryIncident> {
        let mut incidents = Vec::new();
        if let Some(rx) = self.canary_rx.lock().await.as_mut() {
            while let Ok(incident) = rx.try_recv() {
                incidents.push(incident);
            }
        }
        incidents
    }

    /// Stop watching the decoys (they stay in place for the next start).
    pub(crate) fn stop_ransomware_canaries(&self) {
        self.canary_shutdown
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .store(true, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::path::PathBuf;

    fn canary(tamper: CanaryTamper) -> CanaryIncident {
        CanaryIncident {
            folder: PathBuf::from("/Users/alice/Documents/.0-archives-1a2b3c"),
            tamper,
            modified: vec![PathBuf::from(
                "/Users/alice/Documents/.0-archives-1a2b3c/contrat-signe.pdf",
            )],
            missing: Vec::new(),
            foreign: Vec::new(),
            detected_at: Utc::now(),
            while_stopped: false,
        }
    }

    #[test]
    fn encrypted_decoys_are_a_critical_malware_incident_that_triggers_playbooks() {
        let canary = canary(CanaryTamper::Encrypted);
        let incident = incident_from(&canary);

        assert_eq!(incident.incident_type, IncidentType::Malware);
        assert_eq!(incident.severity, IncidentSeverity::Critical);
        assert_eq!(incident.confidence, 95);
        assert!(incident.description.contains("/Users/alice/Documents"));
        assert!(!incident.description.contains(".0-archives"));
        assert_eq!(incident.evidence["detection"], "ransomware_canary");
        assert_eq!(incident.evidence["tamper"], "encrypted");
        assert_eq!(incident.detected_at, canary.detected_at);
        assert!(triggers_response(&canary));
    }

    #[test]
    fn tampering_found_at_start_says_the_agent_was_stopped() {
        let mut canary = canary(CanaryTamper::Encrypted);
        canary.while_stopped = true;
        let incident = incident_from(&canary);
        assert!(
            incident
                .description
                .contains("pendant que l'agent était arrêté")
        );
        assert_eq!(incident.evidence["while_stopped"], true);
    }

    #[test]
    fn removed_decoys_are_a_medium_change_that_triggers_no_response() {
        let canary = canary(CanaryTamper::Removed);
        let incident = incident_from(&canary);

        assert_eq!(incident.incident_type, IncidentType::UnauthorizedChange);
        assert_eq!(incident.severity, IncidentSeverity::Medium);
        assert!(!triggers_response(&canary));
    }
}
