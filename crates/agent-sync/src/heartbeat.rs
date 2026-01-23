//! Heartbeat mechanism for agent health monitoring.
//!
//! This module provides periodic heartbeat sending with:
//! - System metrics collection (CPU, memory)
//! - Exponential backoff retry on failures
//! - Offline mode triggering after consecutive failures
//! - Command processing from heartbeat responses

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use crate::types::{AgentCommand, HeartbeatRequest, HeartbeatResponse, SelfCheckResult};
use agent_common::constants::{
    AGENT_VERSION, DEFAULT_HEARTBEAT_INTERVAL_SECS, MAX_SYNC_RETRIES,
    RETRY_BACKOFF_BASE_MS, RETRY_BACKOFF_MAX_MS,
};
use chrono::{DateTime, Utc};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tokio::sync::RwLock;
use tokio::time::{interval, sleep};
use tracing::{debug, error, info, warn};

/// Number of consecutive failures before triggering offline mode.
const OFFLINE_MODE_THRESHOLD: u32 = 3;

/// Heartbeat service for periodic health reporting.
pub struct HeartbeatService {
    client: Arc<AuthenticatedClient>,
    /// Current heartbeat interval.
    interval_secs: RwLock<u64>,
    /// Consecutive failure count.
    consecutive_failures: AtomicU32,
    /// Whether the agent is in offline mode.
    offline_mode: AtomicBool,
    /// Last successful heartbeat timestamp.
    last_success: RwLock<Option<DateTime<Utc>>>,
    /// Last check execution timestamp (for heartbeat payload).
    last_check_at: RwLock<Option<DateTime<Utc>>>,
    /// Current compliance score (for heartbeat payload).
    compliance_score: RwLock<Option<f32>>,
    /// Pending sync count (for heartbeat payload).
    pending_sync_count: AtomicU32,
    /// Self-check result to send on first heartbeat.
    self_check_result: RwLock<Option<SelfCheckResult>>,
    /// System info for metrics collection.
    sys: RwLock<System>,
}

impl HeartbeatService {
    /// Create a new heartbeat service.
    pub fn new(client: Arc<AuthenticatedClient>) -> Self {
        Self {
            client,
            interval_secs: RwLock::new(DEFAULT_HEARTBEAT_INTERVAL_SECS),
            consecutive_failures: AtomicU32::new(0),
            offline_mode: AtomicBool::new(false),
            last_success: RwLock::new(None),
            last_check_at: RwLock::new(None),
            compliance_score: RwLock::new(None),
            pending_sync_count: AtomicU32::new(0),
            self_check_result: RwLock::new(None),
            sys: RwLock::new(System::new_all()),
        }
    }

    /// Set the heartbeat interval.
    pub async fn set_interval(&self, secs: u64) {
        let mut interval = self.interval_secs.write().await;
        *interval = secs;
        info!("Heartbeat interval set to {} seconds", secs);
    }

    /// Get the current heartbeat interval.
    pub async fn interval(&self) -> u64 {
        *self.interval_secs.read().await
    }

    /// Check if the agent is in offline mode.
    pub fn is_offline(&self) -> bool {
        self.offline_mode.load(Ordering::SeqCst)
    }

    /// Get the last successful heartbeat timestamp.
    pub async fn last_success(&self) -> Option<DateTime<Utc>> {
        *self.last_success.read().await
    }

    /// Get consecutive failure count.
    pub fn consecutive_failures(&self) -> u32 {
        self.consecutive_failures.load(Ordering::SeqCst)
    }

    /// Update the last check timestamp.
    pub async fn set_last_check_at(&self, timestamp: DateTime<Utc>) {
        let mut last = self.last_check_at.write().await;
        *last = Some(timestamp);
    }

    /// Update the compliance score.
    pub async fn set_compliance_score(&self, score: f32) {
        let mut current = self.compliance_score.write().await;
        *current = Some(score);
    }

    /// Update the pending sync count.
    pub fn set_pending_sync_count(&self, count: u32) {
        self.pending_sync_count.store(count, Ordering::SeqCst);
    }

    /// Set the self-check result to send on next heartbeat.
    pub async fn set_self_check_result(&self, result: SelfCheckResult) {
        let mut current = self.self_check_result.write().await;
        *current = Some(result);
    }

    /// Send a single heartbeat with retry logic.
    ///
    /// Returns the response on success, or the last error on failure.
    pub async fn send_heartbeat(&self) -> SyncResult<HeartbeatResponse> {
        let agent_id = self.client.agent_id().await?;
        let request = self.build_request().await;

        debug!("Sending heartbeat for agent {}", agent_id);

        // Try with exponential backoff
        let mut last_error = None;
        let mut backoff_ms = RETRY_BACKOFF_BASE_MS;

        for attempt in 0..=MAX_SYNC_RETRIES {
            if attempt > 0 {
                debug!("Heartbeat retry attempt {} after {}ms", attempt, backoff_ms);
                sleep(Duration::from_millis(backoff_ms)).await;
                backoff_ms = (backoff_ms * 2).min(RETRY_BACKOFF_MAX_MS);
            }

            match self
                .client
                .post_json(&format!("/v1/agents/{}/heartbeat", agent_id), &request)
                .await
            {
                Ok(response) => {
                    self.on_success().await;
                    return Ok(response);
                }
                Err(e) => {
                    if !e.is_retryable() {
                        // Non-retryable error, fail immediately
                        self.on_failure().await;
                        return Err(e);
                    }
                    last_error = Some(e);
                }
            }
        }

        // All retries exhausted
        self.on_failure().await;
        Err(last_error.unwrap_or_else(|| SyncError::Timeout))
    }

    /// Build a heartbeat request with current metrics.
    async fn build_request(&self) -> HeartbeatRequest {
        // Refresh system info
        {
            let mut sys = self.sys.write().await;
            sys.refresh_cpu_all();
            sys.refresh_memory();
        }

        let sys = self.sys.read().await;

        // Calculate CPU usage (average across all CPUs)
        let cpu_percent = sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>()
            / sys.cpus().len().max(1) as f32;

        let memory_bytes = sys.used_memory();

        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let os_info = {
            let info = os_info::get();
            format!(
                "{} {} ({})",
                info.os_type(),
                info.version(),
                std::env::consts::ARCH
            )
        };

        // Get self-check result (only sent on first heartbeat)
        let self_check_result = {
            let mut result = self.self_check_result.write().await;
            result.take()
        };

        HeartbeatRequest {
            timestamp: Utc::now(),
            agent_version: AGENT_VERSION.to_string(),
            status: if self.is_offline() {
                "offline".to_string()
            } else {
                "online".to_string()
            },
            hostname,
            os_info,
            cpu_percent,
            memory_bytes,
            last_check_at: *self.last_check_at.read().await,
            compliance_score: *self.compliance_score.read().await,
            pending_sync_count: self.pending_sync_count.load(Ordering::SeqCst),
            self_check_result,
        }
    }

    /// Handle successful heartbeat.
    async fn on_success(&self) {
        let was_offline = self.offline_mode.swap(false, Ordering::SeqCst);
        self.consecutive_failures.store(0, Ordering::SeqCst);

        let mut last = self.last_success.write().await;
        *last = Some(Utc::now());

        if was_offline {
            info!("Agent back online after heartbeat success");
        }
    }

    /// Handle failed heartbeat.
    async fn on_failure(&self) {
        let failures = self.consecutive_failures.fetch_add(1, Ordering::SeqCst) + 1;

        if failures >= OFFLINE_MODE_THRESHOLD {
            let was_offline = self.offline_mode.swap(true, Ordering::SeqCst);
            if !was_offline {
                warn!(
                    "Agent entering offline mode after {} consecutive heartbeat failures",
                    failures
                );
            }
        } else {
            warn!("Heartbeat failed ({}/{} before offline mode)", failures, OFFLINE_MODE_THRESHOLD);
        }
    }

    /// Process commands from a heartbeat response.
    pub async fn process_commands(&self, response: &HeartbeatResponse) -> Vec<AgentCommand> {
        let mut commands = Vec::new();

        for command in &response.commands {
            debug!("Received command: {:?}", command);
            commands.push(command.clone());
        }

        if response.config_changed {
            debug!("Configuration changed, sync required");
        }

        if response.rules_changed {
            debug!("Rules changed, sync required");
        }

        commands
    }

    /// Run the heartbeat loop.
    ///
    /// This method runs forever, sending heartbeats at the configured interval.
    /// Use with `tokio::spawn` or similar.
    pub async fn run(&self, shutdown: tokio::sync::watch::Receiver<bool>) {
        info!("Starting heartbeat service");

        let mut shutdown = shutdown;

        loop {
            let interval_secs = self.interval().await;
            let mut ticker = interval(Duration::from_secs(interval_secs));

            tokio::select! {
                _ = ticker.tick() => {
                    match self.send_heartbeat().await {
                        Ok(response) => {
                            let commands = self.process_commands(&response).await;
                            if !commands.is_empty() {
                                info!("Received {} commands from server", commands.len());
                                // Commands are returned for the caller to handle
                            }
                        }
                        Err(e) => {
                            error!("Heartbeat failed: {}", e);
                        }
                    }
                }
                _ = shutdown.changed() => {
                    if *shutdown.borrow() {
                        info!("Heartbeat service shutting down");
                        break;
                    }
                }
            }
        }
    }

    /// Reset offline mode (e.g., after manual recovery).
    pub fn reset_offline_mode(&self) {
        self.offline_mode.store(false, Ordering::SeqCst);
        self.consecutive_failures.store(0, Ordering::SeqCst);
        info!("Offline mode reset");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_common::config::AgentConfig;
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use std::sync::Arc;
    use tempfile::TempDir;

    async fn create_test_client() -> (TempDir, Arc<AuthenticatedClient>) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let db_config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(db_config, &key_manager).unwrap();

        let config = AgentConfig {
            server_url: "https://api.test.com".to_string(),
            tls_verify: false,
            ..Default::default()
        };

        let client = AuthenticatedClient::new(config, Arc::new(db));
        (temp_dir, Arc::new(client))
    }

    #[tokio::test]
    async fn test_heartbeat_service_creation() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        assert_eq!(service.interval().await, DEFAULT_HEARTBEAT_INTERVAL_SECS);
        assert!(!service.is_offline());
        assert_eq!(service.consecutive_failures(), 0);
    }

    #[tokio::test]
    async fn test_set_interval() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        service.set_interval(120).await;
        assert_eq!(service.interval().await, 120);
    }

    #[tokio::test]
    async fn test_offline_mode_tracking() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        // Simulate failures
        for _ in 0..OFFLINE_MODE_THRESHOLD {
            service.on_failure().await;
        }

        assert!(service.is_offline());
        assert_eq!(service.consecutive_failures(), OFFLINE_MODE_THRESHOLD);

        // Reset
        service.reset_offline_mode();
        assert!(!service.is_offline());
        assert_eq!(service.consecutive_failures(), 0);
    }

    #[tokio::test]
    async fn test_success_resets_failures() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        // Simulate some failures
        service.on_failure().await;
        service.on_failure().await;
        assert_eq!(service.consecutive_failures(), 2);

        // Success resets
        service.on_success().await;
        assert_eq!(service.consecutive_failures(), 0);
        assert!(!service.is_offline());
    }

    #[tokio::test]
    async fn test_success_exits_offline_mode() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        // Enter offline mode
        for _ in 0..OFFLINE_MODE_THRESHOLD {
            service.on_failure().await;
        }
        assert!(service.is_offline());

        // Success exits offline mode
        service.on_success().await;
        assert!(!service.is_offline());
    }

    #[tokio::test]
    async fn test_last_check_at() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        let timestamp = Utc::now();
        service.set_last_check_at(timestamp).await;

        let request = service.build_request().await;
        assert_eq!(request.last_check_at, Some(timestamp));
    }

    #[tokio::test]
    async fn test_compliance_score() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        service.set_compliance_score(85.5).await;

        let request = service.build_request().await;
        assert_eq!(request.compliance_score, Some(85.5));
    }

    #[tokio::test]
    async fn test_pending_sync_count() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        service.set_pending_sync_count(10);

        let request = service.build_request().await;
        assert_eq!(request.pending_sync_count, 10);
    }

    #[tokio::test]
    async fn test_self_check_result_sent_once() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        let result = SelfCheckResult {
            passed: true,
            binary_hash: "abc123".to_string(),
            error: None,
        };
        service.set_self_check_result(result).await;

        // First request includes self-check
        let request1 = service.build_request().await;
        assert!(request1.self_check_result.is_some());

        // Second request does not
        let request2 = service.build_request().await;
        assert!(request2.self_check_result.is_none());
    }

    #[tokio::test]
    async fn test_build_request_metrics() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        let request = service.build_request().await;

        assert_eq!(request.agent_version, AGENT_VERSION);
        assert_eq!(request.status, "online");
        assert!(!request.hostname.is_empty());
        assert!(!request.os_info.is_empty());
        // CPU and memory should have some value
        assert!(request.cpu_percent >= 0.0);
        assert!(request.memory_bytes > 0);
    }

    #[tokio::test]
    async fn test_process_commands() {
        let (_temp_dir, client) = create_test_client().await;
        let service = HeartbeatService::new(client);

        let response = HeartbeatResponse {
            timestamp: Utc::now(),
            commands: vec![
                AgentCommand::ForceSync,
                AgentCommand::RunChecks {
                    check_ids: vec!["disk".to_string()],
                },
            ],
            config_changed: true,
            rules_changed: false,
        };

        let commands = service.process_commands(&response).await;
        assert_eq!(commands.len(), 2);
    }
}
