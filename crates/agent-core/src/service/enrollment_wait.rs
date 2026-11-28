// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Waiting for the enrollment before the agent runs.
//!
//! The packages install and start the service before anyone enrolls the
//! agent (deb/rpm postinst, MSI, launchd). An agent that is neither enrolled
//! nor standalone has no platform to report to and no organisation whose
//! rules it applies: it waits here, logs that state once, runs no check and
//! stores nothing. It goes on by itself once `sentinel-agent enroll` (or the
//! desktop wizard) stored an identity, or the configuration switched to
//! standalone mode or received an enrollment token; `enroll` also restarts
//! the service, which then starts straight away.

use agent_common::config::AgentConfig;
use agent_storage::Database;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime};
use tracing::{info, warn};

/// How often a waiting agent looks for an identity again.
pub const ENROLLMENT_POLL_INTERVAL: Duration = Duration::from_secs(15);

/// Whether the agent has nothing to run until it is enrolled: connected
/// mode, no identity stored in the database, no agent ID in the
/// configuration and no enrollment token to enroll with by itself.
pub fn awaiting_enrollment(config: &AgentConfig, enrolled_in_db: bool) -> bool {
    !config.standalone
        && !enrolled_in_db
        && config
            .agent_id
            .as_deref()
            .is_none_or(|id| id.trim().is_empty())
        && config
            .enrollment_token
            .as_deref()
            .is_none_or(|token| token.trim().is_empty())
}

/// The message logged once when the agent starts waiting.
pub fn awaiting_enrollment_message() -> &'static str {
    "En attente d'enrôlement : aucun contrôle n'est exécuté ni enregistré tant que \
     l'agent n'est pas enrôlé. Enrôlez-le avec `sentinel-agent enroll --token <JETON> \
     --server <URL>` (ou `sentinel-agent standalone` pour une protection locale) ; \
     le service reprend automatiquement."
}

fn modified_at(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).and_then(|m| m.modified()).ok()
}

async fn is_enrolled(db: &Database, config: &AgentConfig) -> bool {
    match agent_sync::EnrollmentManager::new(config, db)
        .is_enrolled()
        .await
    {
        Ok(enrolled) => enrolled,
        Err(e) => {
            tracing::debug!("Enrollment state not readable yet: {}", e);
            false
        }
    }
}

/// Return the configuration to run with once there is something to run:
/// at once when the agent is enrolled, standalone or holds a token;
/// otherwise after waiting for one of these (the configuration is read
/// again when its file changes). `None` when `shutdown` is raised while
/// waiting.
pub async fn wait_for_enrollment(
    mut config: AgentConfig,
    db: &Database,
    shutdown: &AtomicBool,
) -> Option<AgentConfig> {
    if !awaiting_enrollment(&config, is_enrolled(db, &config).await) {
        return Some(config);
    }

    warn!("{}", awaiting_enrollment_message());
    // systemd's watchdog already counts down: keep vouching for the
    // process while it waits on purpose.
    super::watchdog::start();

    let config_path = AgentConfig::platform_config_path();
    let mut config_mtime = modified_at(&config_path);
    loop {
        let deadline = tokio::time::Instant::now() + ENROLLMENT_POLL_INTERVAL;
        while tokio::time::Instant::now() < deadline {
            if shutdown.load(Ordering::SeqCst) {
                info!("Shutdown requested while waiting for the enrollment");
                return None;
            }
            super::watchdog::beat();
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        // `enroll` writes the server URL and the CA path to the file: the
        // agent must start with them, not with what it read at start-up.
        let mtime = modified_at(&config_path);
        if mtime != config_mtime {
            config_mtime = mtime;
            match AgentConfig::load(None) {
                Ok(reloaded) => config = reloaded,
                Err(e) => warn!("Configuration not reloaded: {}", e),
            }
        }

        if !awaiting_enrollment(&config, is_enrolled(db, &config).await) {
            info!("Enrôlement détecté (ou mode autonome) : démarrage de l'agent");
            return Some(config);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connected() -> AgentConfig {
        AgentConfig {
            standalone: false,
            agent_id: None,
            enrollment_token: None,
            ..AgentConfig::default()
        }
    }

    #[test]
    fn a_fresh_install_waits_for_its_enrollment() {
        assert!(awaiting_enrollment(&connected(), false));
        let blank = AgentConfig {
            enrollment_token: Some("  ".to_string()),
            agent_id: Some(String::new()),
            ..connected()
        };
        assert!(awaiting_enrollment(&blank, false));
    }

    #[test]
    fn an_enrolled_standalone_or_tokened_agent_runs() {
        assert!(!awaiting_enrollment(&connected(), true));
        let standalone = AgentConfig {
            standalone: true,
            ..connected()
        };
        assert!(!awaiting_enrollment(&standalone, false));
        let token = AgentConfig {
            enrollment_token: Some("tok".to_string()),
            ..connected()
        };
        assert!(!awaiting_enrollment(&token, false));
        let id = AgentConfig {
            agent_id: Some("a1".to_string()),
            ..connected()
        };
        assert!(!awaiting_enrollment(&id, false));
    }

    #[test]
    fn the_message_says_how_to_go_on() {
        let message = awaiting_enrollment_message();
        assert!(message.contains("sentinel-agent enroll"));
        assert!(message.contains("En attente d'enrôlement"));
    }

    #[tokio::test]
    async fn the_wait_ends_on_shutdown_and_never_without_reason() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(
            agent_storage::DatabaseConfig::with_path(dir.path().join("agent.db")),
            &agent_storage::KeyManager::new_with_key(&[7; 32]),
        )
        .unwrap();
        let shutdown = AtomicBool::new(true);
        assert!(
            wait_for_enrollment(connected(), &db, &shutdown)
                .await
                .is_none()
        );

        let standalone = AgentConfig {
            standalone: true,
            ..connected()
        };
        let running = AtomicBool::new(false);
        assert!(
            wait_for_enrollment(standalone, &db, &running)
                .await
                .is_some()
        );
    }
}
