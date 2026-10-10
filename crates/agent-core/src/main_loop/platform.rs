// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Stages of the main loop that talk to the platform: heartbeat and the
//! synchronisations that follow it. A standalone agent runs none of them.

use agent_common::error::CommonError;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tracing::{debug, error, info, warn};

use super::job::Job;
use super::{CERT_CHECK_INTERVAL_SECS, LoopState};
use crate::AgentRuntime;

/// Name of the background task that sends the heartbeat.
const HEARTBEAT_TASK: &str = "heartbeat";

/// What a heartbeat reads from the loop state, copied when it starts.
#[derive(Clone, Copy)]
struct HeartbeatInput {
    compliance_score: Option<f64>,
    last_compliance_check_at: Option<chrono::DateTime<chrono::Utc>>,
    #[cfg(feature = "gui")]
    last_check_at: Option<chrono::DateTime<chrono::Utc>>,
    #[cfg(feature = "gui")]
    policy_summary: Option<agent_gui::dto::GuiPolicySummary>,
}

impl HeartbeatInput {
    fn from_state(st: &LoopState) -> Self {
        Self {
            compliance_score: st.compliance_score,
            last_compliance_check_at: st.last_compliance_check_at,
            #[cfg(feature = "gui")]
            last_check_at: st.gui.last_check_at,
            #[cfg(feature = "gui")]
            policy_summary: st.gui.cached_policy_summary,
        }
    }
}

/// What to do about re-enrollment after an authentication failure.
#[derive(Debug, PartialEq, Eq)]
enum ReEnrollment {
    /// Try now.
    Attempt,
    /// The previous attempt is too recent.
    Cooldown { remaining_secs: u64 },
    /// Every attempt was used; `log` when it is time to say so again.
    Exhausted { log: bool },
    /// Not enough consecutive failures yet.
    NotYet,
}

/// Pause before re-enrollment attempt number `attempts` (0-based):
/// 30 seconds, 2 minutes, then 10 minutes.
fn re_enrollment_cooldown_secs(attempts: u32) -> u64 {
    match attempts {
        0 => 30,
        1 => 120,
        _ => 600,
    }
}

/// Decide on a re-enrollment after `failures` consecutive authentication
/// failures and `attempts` re-enrollments already tried, the last one at
/// `last_attempt_secs` (epoch seconds, like `now_secs`).
fn re_enrollment_decision(
    failures: u32,
    attempts: u32,
    now_secs: u64,
    last_attempt_secs: u64,
) -> ReEnrollment {
    if failures >= AgentRuntime::AUTH_FAILURE_THRESHOLD
        && attempts < AgentRuntime::MAX_RE_ENROLLMENT_ATTEMPTS
    {
        let cooldown_secs = re_enrollment_cooldown_secs(attempts);
        let since_last = now_secs.saturating_sub(last_attempt_secs);
        if since_last >= cooldown_secs {
            ReEnrollment::Attempt
        } else {
            ReEnrollment::Cooldown {
                remaining_secs: cooldown_secs.saturating_sub(since_last),
            }
        }
    } else if attempts >= AgentRuntime::MAX_RE_ENROLLMENT_ATTEMPTS {
        ReEnrollment::Exhausted {
            log: failures.is_multiple_of(10),
        }
    } else {
        ReEnrollment::NotYet
    }
}

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
    /// Heartbeat, when its interval has passed, in a background task: a
    /// platform slow to answer, or the commands it sends back, do not hold
    /// the loop. On success the forced configuration, audit trail, GRC queue
    /// and SIEM data are synchronised; an authentication failure leads to a
    /// re-enrollment attempt. One heartbeat at a time.
    pub(crate) async fn heartbeat_stage(self: &Arc<Self>, st: &mut LoopState) {
        self.collect_heartbeat(st);
        if !self.config.standalone
            && st.heartbeat_task.is_none()
            && st.last_heartbeat.elapsed().as_secs() >= *self.heartbeat_interval_secs.read().await
        {
            st.last_heartbeat = std::time::Instant::now();
            let runtime = Arc::clone(self);
            let sent = HeartbeatInput::from_state(st);
            st.heartbeat_task = Some(Job::start(&mut st.tasks, HEARTBEAT_TASK, async move {
                runtime.heartbeat(sent).await
            }));
        }
    }

    /// Take note of a heartbeat that ended: the interface shows the number
    /// of items waiting for synchronisation it counted.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    fn collect_heartbeat(&self, st: &mut LoopState) {
        if let Some(outcome) = st.heartbeat_task.as_mut().and_then(Job::finished) {
            st.heartbeat_task = None;
            #[cfg(feature = "gui")]
            if let Some(Some(pending_sync)) = outcome {
                st.gui.cached_pending_sync = pending_sync;
            }
        }
    }

    /// One heartbeat and what follows it. Returns the number of items
    /// waiting for synchronisation when the platform accepted it.
    async fn heartbeat(&self, sent: HeartbeatInput) -> Option<u32> {
        match self
            .send_heartbeat(sent.compliance_score, sent.last_compliance_check_at)
            .await
        {
            Ok(_) => Some(self.after_heartbeat(&sent).await),
            Err(e) => {
                self.handle_heartbeat_failure(&e).await;
                None
            }
        }
    }

    /// Send the SIEM events recorded since the last heartbeat, with the
    /// forwarder's statistics, to the platform.
    async fn sync_siem_to_platform(&self) {
        if let Some(ref client) = self.authenticated_client {
            // The forwarder is released before the request leaves: the
            // loop reconfigures it at every pass and must not wait here.
            let request = {
                let forwarder = self.siem_forwarder.read().await;
                let Some(siem) = forwarder.as_ref() else {
                    return;
                };
                let stats = siem.stats().await;
                let recent = siem.take_recent_events().await;
                siem_sync_request(&recent, &stats, siem.config())
            };

            if let Err(e) = client.sync_siem_data(request).await {
                warn!("Failed to sync SIEM data to platform: {}", e);
            }
        }
    }

    /// What follows a heartbeat the platform accepted: forced configuration,
    /// interface status, audit trail, GRC queue, SIEM data. Returns the
    /// number of items waiting for synchronisation.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    async fn after_heartbeat(&self, sent: &HeartbeatInput) -> u32 {
        debug!("Heartbeat sent successfully");

        // Reset auth failure counter on successful heartbeat
        if self.auth_failure_count.load(Ordering::Acquire) > 0 {
            info!("Connection restored, resetting authentication failure counter");
            self.auth_failure_count.store(0, Ordering::Release);
            self.re_enrollment_attempts.store(0, Ordering::Release);
        }

        #[cfg(feature = "gui")]
        let pending_sync = self.get_pending_sync_count().await as u32;
        #[cfg(not(feature = "gui"))]
        let pending_sync = 0;

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
                sent.last_check_at,
                sent.compliance_score,
                pending_sync,
                sent.policy_summary,
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

        pending_sync
    }

    /// A heartbeat the platform did not accept: tell the interface and, on
    /// an authentication failure, consider re-enrolling.
    async fn handle_heartbeat_failure(&self, e: &CommonError) {
        warn!("Heartbeat failed: {}", e);
        #[cfg(feature = "gui")]
        self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
        if e.is_auth_error() {
            let failures = self.auth_failure_count.fetch_add(1, Ordering::AcqRel) + 1;
            warn!("Authentication error (consecutive failure #{})", failures);

            // Attempt re-enrollment with exponential backoff
            let attempts = self.re_enrollment_attempts.load(Ordering::Acquire);
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let last_attempt = self.last_re_enrollment_attempt.load(Ordering::Acquire);
            match re_enrollment_decision(failures, attempts, now_secs, last_attempt) {
                ReEnrollment::Attempt => {
                    self.re_enroll_after_auth_failure(attempts, now_secs).await
                }
                ReEnrollment::Cooldown { remaining_secs } => {
                    debug!(
                        "Re-enrollment cooldown active ({}s remaining)",
                        remaining_secs
                    );
                }
                // Already exceeded max attempts — log periodically
                ReEnrollment::Exhausted { log: true } => {
                    error!(
                        "Re-enrollment exhausted after {} attempts. \
                         Agent running in offline/degraded mode. \
                         Manual intervention required.",
                        Self::MAX_RE_ENROLLMENT_ATTEMPTS
                    );
                }
                ReEnrollment::Exhausted { log: false } | ReEnrollment::NotYet => {}
            }
        }
    }

    /// Re-enrollment attempt number `attempt_index` (0-based), started at
    /// `now_secs`.
    async fn re_enroll_after_auth_failure(&self, attempt_index: u32, now_secs: u64) {
        self.last_re_enrollment_attempt
            .store(now_secs, Ordering::Release);
        self.re_enrollment_attempts.fetch_add(1, Ordering::AcqRel);
        info!(
            "Initiating automatic re-enrollment (attempt {})",
            attempt_index + 1
        );
        match self.attempt_re_enrollment().await {
            Ok(true) => {
                info!("Re-enrollment succeeded, resetting auth failure counter");
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
                self.re_enrollment_attempts
                    .store(Self::MAX_RE_ENROLLMENT_ATTEMPTS, Ordering::Release);
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
                self.emit_notification("Ré-enregistrement échoué", &format!("{}", re_err), "error");
            }
        }
    }

    /// Daily check of the client certificate, renewed when it is close to
    /// expiry. A certificate the platform rejects leads to a re-enrollment.
    pub(crate) async fn certificate_renewal_stage(&self, st: &mut LoopState) {
        // Not next to a heartbeat in flight: both may re-enroll the agent.
        if !self.config.standalone
            && st.heartbeat_task.is_none()
            && st.last_cert_check.elapsed().as_secs() >= CERT_CHECK_INTERVAL_SECS
        {
            if let Some(ref auth_client) = self.authenticated_client {
                match auth_client.check_and_renew_if_needed().await {
                    Ok(()) => {
                        debug!("Certificate renewal check complete");
                    }
                    Err(e) => {
                        warn!("Certificate renewal check failed: {}", e);
                        // If renewal failed due to auth/cert error, try re-enrollment
                        if e.is_auth_error() {
                            warn!("Certificate expired or rejected, triggering re-enrollment");
                            match self.attempt_re_enrollment().await {
                                Ok(true) => {
                                    info!("Re-enrollment after certificate expiry succeeded");
                                    self.auth_failure_count.store(0, Ordering::Release);
                                    self.re_enrollment_attempts.store(0, Ordering::Release);
                                }
                                Ok(false) => {
                                    warn!("Cannot re-enroll: no enrollment token configured")
                                }
                                Err(re_err) => error!(
                                    "Re-enrollment after certificate expiry failed: {}",
                                    re_err
                                ),
                            }
                        }
                    }
                }
            }
            st.last_cert_check = std::time::Instant::now();
        }
    }

    /// The synchronisation the operator asked for ("Forcer la
    /// synchronisation"): results, GRC queue, then a heartbeat, with the
    /// outcome shown in the interface. In standalone mode it is declined.
    pub(crate) async fn forced_sync_stage(&self, st: &mut LoopState) {
        // A sync request in standalone mode has nothing to sync: say so
        // once in the interface instead of spinning against no server.
        if self.config.standalone && self.state.force_sync.swap(false, Ordering::AcqRel) {
            info!("Sync requested in standalone mode: no platform, nothing to send");
            #[cfg(feature = "gui")]
            self.emit_gui_event(AgentEvent::SyncStatus {
                syncing: false,
                pending_count: 0,
                last_sync_at: None,
                error: Some(
                    "Mode autonome : aucune plateforme à synchroniser. Les données restent sur ce poste."
                        .to_string(),
                ),
            });
        }

        // Check for force_sync flag (GUI "Forcer la synchronisation" button)
        // A heartbeat in flight ends first: the sync sends its own.
        if self.state.force_sync.load(Ordering::Acquire) && st.heartbeat_task.is_none() {
            info!("Force sync triggered");
            #[cfg(feature = "gui")]
            self.emit_gui_event(AgentEvent::SyncStatus {
                syncing: true,
                pending_count: 0,
                last_sync_at: None,
                error: None,
            });

            self.upload_check_results().await;

            // Drain GRC sync queue during force sync
            if let Some(ref client) = self.authenticated_client
                && let Some(orchestrator) = self.sync_orchestrator.read().await.as_ref()
            {
                match orchestrator.drain_grc_queues(client).await {
                    Ok(count) => {
                        if count > 0 {
                            info!("Force sync: {} GRC items synced", count);
                        }
                    }
                    Err(e) => warn!("Force sync GRC queue drain failed: {}", e),
                }
            }

            match self
                .send_heartbeat(st.compliance_score, st.last_compliance_check_at)
                .await
            {
                Ok(()) => {
                    info!("Force sync heartbeat sent");
                    #[cfg(feature = "gui")]
                    {
                        self.emit_notification(
                            "Synchronisation",
                            "Données synchronisées avec succès",
                            "info",
                        );
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: Some(chrono::Utc::now()),
                            error: None,
                        });
                    }
                }
                Err(e) => {
                    warn!("Force sync heartbeat failed: {}", e);
                    #[cfg(feature = "gui")]
                    {
                        self.emit_notification(
                            "Synchronisation échouée",
                            &format!("{}", e),
                            "error",
                        );
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: None,
                            error: Some(format!("{}", e)),
                        });
                    }
                }
            }
            st.last_heartbeat = std::time::Instant::now();
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
            self.state.force_sync.store(false, Ordering::Release);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::{standalone_runtime, unenrolled_runtime};
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

    #[test]
    fn re_enrollment_backs_off_from_seconds_to_minutes() {
        assert_eq!(re_enrollment_cooldown_secs(0), 30);
        assert_eq!(re_enrollment_cooldown_secs(1), 120);
        assert_eq!(re_enrollment_cooldown_secs(2), 600);
        assert_eq!(re_enrollment_cooldown_secs(5), 600);
    }

    #[test]
    fn the_first_authentication_failure_triggers_a_re_enrollment() {
        // Never attempted: the cooldown is long over.
        assert_eq!(
            re_enrollment_decision(1, 0, 1_700_000_000, 0),
            ReEnrollment::Attempt
        );
    }

    #[test]
    fn a_recent_attempt_delays_the_next_one() {
        let now = 1_700_000_000;
        assert_eq!(
            re_enrollment_decision(2, 0, now, now - 10),
            ReEnrollment::Cooldown { remaining_secs: 20 }
        );
        assert_eq!(
            re_enrollment_decision(3, 1, now, now - 100),
            ReEnrollment::Cooldown { remaining_secs: 20 }
        );
        assert_eq!(
            re_enrollment_decision(3, 1, now, now - 120),
            ReEnrollment::Attempt
        );
        // A last attempt in the future (clock set back) counts as just made.
        assert_eq!(
            re_enrollment_decision(3, 2, now, now + 50),
            ReEnrollment::Cooldown {
                remaining_secs: 600
            }
        );
    }

    #[test]
    fn exhausted_attempts_are_logged_every_tenth_failure() {
        let max = AgentRuntime::MAX_RE_ENROLLMENT_ATTEMPTS;
        assert_eq!(
            re_enrollment_decision(10, max, 1_700_000_000, 0),
            ReEnrollment::Exhausted { log: true }
        );
        assert_eq!(
            re_enrollment_decision(11, max, 1_700_000_000, 0),
            ReEnrollment::Exhausted { log: false }
        );
    }

    #[test]
    fn below_the_failure_threshold_nothing_happens() {
        assert_eq!(
            re_enrollment_decision(
                AgentRuntime::AUTH_FAILURE_THRESHOLD - 1,
                0,
                1_700_000_000,
                0
            ),
            ReEnrollment::NotYet
        );
    }

    #[tokio::test]
    async fn a_network_failure_does_not_count_as_an_authentication_failure() {
        let test = standalone_runtime();

        test.runtime
            .handle_heartbeat_failure(&CommonError::network("connection timed out"))
            .await;

        assert_eq!(test.runtime.auth_failure_count.load(Ordering::Acquire), 0);
        #[cfg(feature = "gui")]
        match test.events.try_recv() {
            Ok(agent_gui::events::AgentEvent::Notification { notification }) => {
                assert_eq!(notification.title, "Heartbeat échoué");
                assert_eq!(notification.severity, "warning");
            }
            other => panic!("expected a notification, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn an_authentication_failure_is_counted_once_attempts_are_exhausted() {
        let test = standalone_runtime();
        let max = AgentRuntime::MAX_RE_ENROLLMENT_ATTEMPTS;
        test.runtime
            .re_enrollment_attempts
            .store(max, Ordering::Release);

        test.runtime
            .handle_heartbeat_failure(&CommonError::auth("agent not found"))
            .await;

        assert_eq!(test.runtime.auth_failure_count.load(Ordering::Acquire), 1);
        // No new attempt was started.
        assert_eq!(
            test.runtime.re_enrollment_attempts.load(Ordering::Acquire),
            max
        );
        assert_eq!(
            test.runtime
                .last_re_enrollment_attempt
                .load(Ordering::Acquire),
            0
        );
    }

    #[tokio::test]
    async fn a_standalone_agent_has_no_certificate_to_renew() {
        let test = standalone_runtime();
        let started = Instant::now() - Duration::from_secs(2 * CERT_CHECK_INTERVAL_SECS);
        let mut st = LoopState::starting_at(started, 3600, 3600);

        test.runtime.certificate_renewal_stage(&mut st).await;

        assert_eq!(st.last_cert_check, started);
    }

    #[tokio::test]
    async fn a_standalone_agent_declines_a_forced_sync_once() {
        let test = standalone_runtime();
        let started = Instant::now() - Duration::from_secs(10);
        let mut st = LoopState::starting_at(started, 3600, 3600);
        test.runtime.state.force_sync.store(true, Ordering::Release);

        test.runtime.forced_sync_stage(&mut st).await;

        assert!(!test.runtime.state.force_sync.load(Ordering::Acquire));
        // Nothing was sent: the heartbeat timer did not move.
        assert_eq!(st.last_heartbeat, started);
        #[cfg(feature = "gui")]
        {
            match test.events.try_recv() {
                Ok(AgentEvent::SyncStatus { syncing, error, .. }) => {
                    assert!(!syncing);
                    assert!(error.is_some_and(|message| message.starts_with("Mode autonome")));
                }
                other => panic!("expected the sync status, got {:?}", other.map(|_| ())),
            }
            // Said once: the next pass has nothing to add.
            test.runtime.forced_sync_stage(&mut st).await;
            assert!(test.events.try_recv().is_err());
        }
    }

    #[tokio::test]
    async fn a_standalone_agent_sends_no_heartbeat() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let started = Instant::now() - Duration::from_secs(3600);
        let mut st = LoopState::starting_at(started, 3600, 3600);

        runtime.heartbeat_stage(&mut st).await;

        // The timer is untouched: the stage did not run.
        assert_eq!(st.last_heartbeat, started);
        assert!(st.heartbeat_task.is_none());
    }

    /// Let the background tasks of `st` run to their end.
    async fn settle(st: &mut LoopState) {
        while !st.tasks.is_empty() {
            tokio::task::yield_now().await;
            st.tasks.reap();
        }
    }

    #[tokio::test]
    async fn a_due_heartbeat_runs_in_the_background_one_at_a_time() {
        let test = unenrolled_runtime();
        let runtime = Arc::new(test.runtime);
        let started = Instant::now() - Duration::from_secs(3600);
        let mut st = LoopState::starting_at(started, 3600, 3600);

        runtime.heartbeat_stage(&mut st).await;
        assert!(st.heartbeat_task.is_some());
        assert!(st.last_heartbeat > started);
        assert!(st.tasks.is_running(HEARTBEAT_TASK));

        // Overdue again, but the first one has not ended: no second one.
        st.last_heartbeat = started;
        runtime.heartbeat_stage(&mut st).await;
        assert_eq!(st.tasks.len(), 1);

        // It ends (refused: the agent was never enrolled) and is taken note
        // of at the next pass, which may then start the next one.
        settle(&mut st).await;
        st.last_heartbeat = Instant::now();
        runtime.heartbeat_stage(&mut st).await;
        assert!(st.heartbeat_task.is_none());
        #[cfg(feature = "gui")]
        match test.events.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.title, "Heartbeat échoué");
            }
            other => panic!("expected a notification, got {:?}", other.map(|_| ())),
        }
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn an_accepted_heartbeat_updates_the_pending_sync_count() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        st.heartbeat_task = Some(Job::start(&mut st.tasks, HEARTBEAT_TASK, async { Some(7) }));
        settle(&mut st).await;

        test.runtime.collect_heartbeat(&mut st);

        assert!(st.heartbeat_task.is_none());
        assert_eq!(st.gui.cached_pending_sync, 7);
    }

    #[tokio::test]
    async fn a_forced_sync_waits_for_the_heartbeat_in_flight() {
        let test = unenrolled_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 3600, 3600);
        let before = st.last_heartbeat;
        test.runtime.state.force_sync.store(true, Ordering::Release);
        st.heartbeat_task = Some(Job::start(
            &mut st.tasks,
            HEARTBEAT_TASK,
            std::future::pending(),
        ));

        test.runtime.forced_sync_stage(&mut st).await;

        // Still requested, nothing sent yet.
        assert!(test.runtime.state.force_sync.load(Ordering::Acquire));
        assert_eq!(st.last_heartbeat, before);
        st.tasks.shutdown().await;
    }

    #[tokio::test]
    async fn the_certificate_check_waits_for_the_heartbeat_in_flight() {
        let test = unenrolled_runtime();
        let started = Instant::now() - Duration::from_secs(2 * CERT_CHECK_INTERVAL_SECS);
        let mut st = LoopState::starting_at(started, 3600, 3600);
        st.heartbeat_task = Some(Job::start(
            &mut st.tasks,
            HEARTBEAT_TASK,
            std::future::pending(),
        ));

        test.runtime.certificate_renewal_stage(&mut st).await;

        assert_eq!(st.last_cert_check, started);
        st.tasks.shutdown().await;
    }
}
