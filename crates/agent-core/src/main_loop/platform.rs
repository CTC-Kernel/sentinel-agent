// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Stages of the main loop that talk to the platform: heartbeat and the
//! synchronisations that follow it. A standalone agent runs none of them.

use std::sync::atomic::Ordering;
use tracing::{debug, error, info, warn};

use super::LoopState;
use crate::AgentRuntime;

/// What the platform receives about the SIEM: the events recorded since the
/// last synchronisation and the state of the forwarder.
fn siem_sync_request(
    recent: &[agent_siem::SiemEvent],
    stats: &agent_siem::SiemStats,
    cfg: &agent_siem::SiemConfig,
) -> agent_sync::SiemSyncRequest {
    let events: Vec<agent_sync::SiemEventPayload> = recent
        .iter()
        .map(|e| agent_sync::SiemEventPayload {
            timestamp: e.timestamp,
            severity: e.severity,
            category: format!("{}", e.category),
            name: e.name.clone(),
            description: e.description.clone(),
            source_host: e.source_host.clone(),
            source_ip: e.source_ip.clone(),
            destination_ip: e.destination_ip.clone(),
            event_id: e.event_id.clone(),
        })
        .collect();

    agent_sync::SiemSyncRequest {
        events,
        stats: agent_sync::SiemStatsPayload {
            enabled: cfg.enabled,
            format: format!("{}", cfg.format),
            transport: format!("{}", cfg.transport),
            destination: cfg.destination_label(),
            events_sent: stats.events_sent,
            events_dropped: stats.events_dropped,
            bytes_sent: stats.bytes_sent,
            is_connected: stats.is_connected,
            last_error: stats.last_error.clone(),
            reported_at: chrono::Utc::now(),
        },
    }
}

impl AgentRuntime {
    /// Heartbeat, when its interval has passed: on success the forced
    /// configuration, audit trail, GRC queue and SIEM data are synchronised;
    /// an authentication failure leads to a re-enrollment attempt.
    pub(crate) async fn heartbeat_stage(&self, st: &mut LoopState) {
        if !self.config.standalone
            && st.last_heartbeat.elapsed().as_secs() >= *self.heartbeat_interval_secs.read().await
        {
            st.last_heartbeat = std::time::Instant::now();
            match self
                .send_heartbeat(st.compliance_score, st.last_compliance_check_at)
                .await
            {
                Ok(_) => self.after_heartbeat(st).await,
                Err(e) => {
                    warn!("Heartbeat failed: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
                    if e.is_auth_error() {
                        let failures = self.auth_failure_count.fetch_add(1, Ordering::AcqRel) + 1;
                        warn!("Authentication error (consecutive failure #{})", failures);

                        // Attempt re-enrollment with exponential backoff
                        let attempts = self.re_enrollment_attempts.load(Ordering::Acquire);
                        if failures >= Self::AUTH_FAILURE_THRESHOLD
                            && attempts < Self::MAX_RE_ENROLLMENT_ATTEMPTS
                        {
                            let now_secs = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            let last_attempt =
                                self.last_re_enrollment_attempt.load(Ordering::Acquire);

                            // Exponential backoff: 30s, 120s, 600s based on attempt number
                            let attempt_index = attempts;
                            let cooldown_secs: u64 = match attempt_index {
                                0 => 30,
                                1 => 120,
                                _ => 600,
                            };

                            if now_secs.saturating_sub(last_attempt) >= cooldown_secs {
                                self.last_re_enrollment_attempt
                                    .store(now_secs, Ordering::Release);
                                self.re_enrollment_attempts.fetch_add(1, Ordering::AcqRel);
                                info!(
                                    "Initiating automatic re-enrollment (attempt {})",
                                    attempt_index + 1
                                );
                                match self.attempt_re_enrollment().await {
                                    Ok(true) => {
                                        info!(
                                            "Re-enrollment succeeded, resetting auth failure counter"
                                        );
                                        self.auth_failure_count.store(0, Ordering::Relaxed);
                                        self.re_enrollment_attempts.store(0, Ordering::Release);
                                        #[cfg(feature = "gui")]
                                        self.emit_notification(
                                            "Ré-enregistrement réussi",
                                            "L'agent a été ré-enregistré avec succès auprès du serveur.",
                                            "info",
                                        );
                                    }
                                    Ok(false) => {
                                        self.re_enrollment_attempts.store(
                                            Self::MAX_RE_ENROLLMENT_ATTEMPTS,
                                            Ordering::Release,
                                        );
                                        warn!(
                                            "Re-enrollment not possible (no enrollment token). \
                                             Agent will continue in degraded mode."
                                        );
                                    }
                                    Err(re_err) => {
                                        error!(
                                            "Re-enrollment attempt failed: {}. \
                                             Will retry after backoff.",
                                            re_err
                                        );
                                        #[cfg(feature = "gui")]
                                        self.emit_notification(
                                            "Ré-enregistrement échoué",
                                            &format!("{}", re_err),
                                            "error",
                                        );
                                    }
                                }
                            } else {
                                debug!(
                                    "Re-enrollment cooldown active ({}s remaining)",
                                    cooldown_secs
                                        .saturating_sub(now_secs.saturating_sub(last_attempt))
                                );
                            }
                        } else if attempts >= Self::MAX_RE_ENROLLMENT_ATTEMPTS {
                            // Already exceeded max attempts — log periodically
                            if failures.is_multiple_of(10) {
                                error!(
                                    "Re-enrollment exhausted after {} attempts. \
                                     Agent running in offline/degraded mode. \
                                     Manual intervention required.",
                                    Self::MAX_RE_ENROLLMENT_ATTEMPTS
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    /// Send the SIEM events recorded since the last heartbeat, with the
    /// forwarder's statistics, to the platform.
    async fn sync_siem_to_platform(&self) {
        if let Some(ref client) = self.authenticated_client
            && let Some(ref siem) = *self.siem_forwarder.read().await
        {
            let stats = siem.stats().await;
            let recent = siem.take_recent_events().await;
            let cfg = siem.config();

            let request = siem_sync_request(&recent, &stats, cfg);

            if let Err(e) = client.sync_siem_data(request).await {
                warn!("Failed to sync SIEM data to platform: {}", e);
            }
        }
    }

    /// What follows a heartbeat the platform accepted: forced configuration,
    /// interface status, audit trail, GRC queue, SIEM data.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    async fn after_heartbeat(&self, st: &mut LoopState) {
        debug!("Heartbeat sent successfully");

        // Reset auth failure counter on successful heartbeat
        if self.auth_failure_count.load(Ordering::Acquire) > 0 {
            info!("Connection restored, resetting authentication failure counter");
            self.auth_failure_count.store(0, Ordering::Release);
            self.re_enrollment_attempts.store(0, Ordering::Release);
        }

        #[cfg(feature = "gui")]
        {
            st.gui.cached_pending_sync = self.get_pending_sync_count().await as u32;
        }

        if self.state.force_sync.load(Ordering::Acquire) {
            info!("Forced sync requested via heartbeat command");
            self.apply_config_changes().await;
            // Do NOT clear force_sync here — the dedicated force_sync
            // block later in the loop handles the full sync cycle
            // (upload results, heartbeat, notifications) and clears it.
        }
        #[cfg(feature = "gui")]
        {
            self.emit_status_update(
                st.gui.last_check_at,
                st.compliance_score,
                st.gui.cached_pending_sync,
                st.gui.cached_policy_summary,
            );
            self.emit_resource_update(None);
        }
        if let Some(audit_sync) = self.audit_sync.read().await.as_ref() {
            match audit_sync.sync().await {
                Ok(count) => {
                    if count > 0 {
                        debug!("Synced {} audit trail entries", count);
                    }
                }
                Err(e) => warn!("Audit trail sync failed: {}", e),
            }
        }
        // Drain GRC sync queue: upload locally-created playbooks, risks, assets, etc.
        if let Some(ref client) = self.authenticated_client
            && let Some(orchestrator) = self.sync_orchestrator.read().await.as_ref()
        {
            match orchestrator.drain_grc_queues(client).await {
                Ok(count) => {
                    if count > 0 {
                        info!("GRC sync: {} items synced", count);
                    }
                }
                Err(e) => warn!("GRC sync queue drain failed: {}", e),
            }
        }

        // Push assets from SQLite to GUI after GRC sync
        #[cfg(feature = "gui")]
        self.sync_assets_to_gui().await;

        // Sync SIEM data to the platform
        self.sync_siem_to_platform().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::time::{Duration, Instant};

    fn siem_event(name: &str) -> agent_siem::SiemEvent {
        agent_siem::SiemEvent {
            timestamp: chrono::Utc::now(),
            severity: 7,
            category: agent_siem::EventCategory::Network,
            name: name.to_string(),
            description: "Connexion vers une adresse malveillante".to_string(),
            source_host: "poste-compta-01".to_string(),
            source_ip: Some("10.0.0.12".to_string()),
            destination_ip: Some("203.0.113.7".to_string()),
            destination_port: Some(443),
            user: None,
            process_name: None,
            process_id: None,
            file_path: None,
            custom_fields: serde_json::Value::Null,
            event_id: "evt-1".to_string(),
            agent_version: "test".to_string(),
        }
    }

    #[test]
    fn the_siem_sync_carries_events_and_forwarder_state() {
        let cfg = agent_siem::SiemConfig::default();
        let stats = agent_siem::SiemStats {
            events_sent: 12,
            events_dropped: 1,
            bytes_sent: 4096,
            last_error: Some("connection reset".to_string()),
            is_connected: true,
            ..Default::default()
        };

        let request = siem_sync_request(&[siem_event("C2 beacon")], &stats, &cfg);

        assert_eq!(request.events.len(), 1);
        let event = &request.events[0];
        assert_eq!(event.name, "C2 beacon");
        assert_eq!(event.severity, 7);
        assert_eq!(
            event.category,
            format!("{}", agent_siem::EventCategory::Network)
        );
        assert_eq!(event.destination_ip.as_deref(), Some("203.0.113.7"));
        assert_eq!(event.event_id, "evt-1");
        assert_eq!(request.stats.enabled, cfg.enabled);
        assert_eq!(request.stats.destination, cfg.destination_label());
        assert_eq!(request.stats.events_sent, 12);
        assert_eq!(request.stats.events_dropped, 1);
        assert_eq!(request.stats.bytes_sent, 4096);
        assert!(request.stats.is_connected);
        assert_eq!(
            request.stats.last_error.as_deref(),
            Some("connection reset")
        );
    }

    #[tokio::test]
    async fn a_standalone_agent_sends_no_heartbeat() {
        let test = standalone_runtime();
        let started = Instant::now() - Duration::from_secs(3600);
        let mut st = LoopState::starting_at(started, 3600, 3600);

        test.runtime.heartbeat_stage(&mut st).await;

        // The timer is untouched: the stage did not run.
        assert_eq!(st.last_heartbeat, started);
    }
}
