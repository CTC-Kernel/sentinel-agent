//! Sync orchestrator - coordinates sync operations.
//!
//! Provides centralized control over sync operations including:
//! - Manual sync triggering
//! - Sync status tracking
//! - Sync history
//! - Conflict resolution coordination

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use crate::offline::{CircuitBreaker, OfflineTracker};
use agent_storage::Database;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Sync operation kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncKind {
    /// Full sync (heartbeat + results + config + rules).
    Full,
    /// Heartbeat only.
    Heartbeat,
    /// Results upload only.
    Results,
    /// Configuration sync only.
    Config,
    /// Rules sync only.
    Rules,
    /// Audit trail sync only.
    Audit,
    /// Manual sync triggered by user.
    Manual,
    /// Playbook sync.
    Playbooks,
    /// Detection rules sync.
    DetectionRules,
    /// Risk register sync.
    Risks,
    /// Asset inventory sync.
    Assets,
    /// KPI snapshot sync.
    Kpi,
    /// Alert rule sync.
    Alerting,
}

impl SyncKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncKind::Full => "full",
            SyncKind::Heartbeat => "heartbeat",
            SyncKind::Results => "results",
            SyncKind::Config => "config",
            SyncKind::Rules => "rules",
            SyncKind::Audit => "audit",
            SyncKind::Manual => "manual",
            SyncKind::Playbooks => "playbooks",
            SyncKind::DetectionRules => "detection_rules",
            SyncKind::Risks => "risks",
            SyncKind::Assets => "assets",
            SyncKind::Kpi => "kpi",
            SyncKind::Alerting => "alerting",
        }
    }
}

/// Status of a sync operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// Sync has not been attempted yet.
    Idle,
    /// Sync is currently in progress.
    InProgress,
    /// Last sync completed successfully.
    Success,
    /// Last sync failed.
    Failed,
    /// Sync was skipped (e.g., circuit breaker open).
    Skipped,
}

/// A sync history entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncHistoryEntry {
    /// Unique identifier for this sync event.
    pub id: String,
    /// What kind of sync was performed.
    pub kind: SyncKind,
    /// Result status.
    pub status: SyncStatus,
    /// When the sync started.
    pub started_at: DateTime<Utc>,
    /// When the sync completed.
    pub completed_at: Option<DateTime<Utc>>,
    /// Duration in milliseconds.
    pub duration_ms: Option<u64>,
    /// Number of items synced.
    pub items_synced: u32,
    /// Error message if failed.
    pub error: Option<String>,
    /// Conflicts resolved during this sync.
    pub conflicts_resolved: u32,
}

/// Current sync status summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusSummary {
    /// Current status.
    pub status: SyncStatus,
    /// Last successful sync time.
    pub last_success_at: Option<DateTime<Utc>>,
    /// Last sync attempt time.
    pub last_attempt_at: Option<DateTime<Utc>>,
    /// Last error message.
    pub last_error: Option<String>,
    /// Total items pending sync.
    pub pending_items: u32,
    /// Whether the agent is currently offline.
    pub is_offline: bool,
    /// Circuit breaker state description.
    pub circuit_breaker: String,
}

/// Maximum sync history entries to keep.
const MAX_HISTORY_ENTRIES: usize = 100;

/// Orchestrates sync operations between agent and SaaS.
pub struct SyncOrchestrator {
    _db: Arc<Database>,
    /// Current sync status.
    status: RwLock<SyncStatus>,
    /// Sync history log.
    history: RwLock<Vec<SyncHistoryEntry>>,
    /// Last successful sync timestamp.
    last_success: RwLock<Option<DateTime<Utc>>>,
    /// Last error message.
    last_error: RwLock<Option<String>>,
    /// Circuit breaker for sync operations.
    circuit_breaker: CircuitBreaker,
    /// Offline tracker.
    offline_tracker: OfflineTracker,
}

impl SyncOrchestrator {
    /// Create a new sync orchestrator.
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            _db: db,
            status: RwLock::new(SyncStatus::Idle),
            history: RwLock::new(Vec::new()),
            last_success: RwLock::new(None),
            last_error: RwLock::new(None),
            circuit_breaker: CircuitBreaker::new(),
            offline_tracker: OfflineTracker::new(),
        }
    }

    /// Trigger a manual sync.
    ///
    /// Returns the sync history entry when complete.
    pub async fn manual_sync(&self, client: &AuthenticatedClient) -> SyncResult<SyncHistoryEntry> {
        info!("Manual sync triggered");
        self.execute_sync(SyncKind::Manual, client).await
    }

    /// Execute a sync operation of the given kind.
    pub async fn execute_sync(
        &self,
        kind: SyncKind,
        client: &AuthenticatedClient,
    ) -> SyncResult<SyncHistoryEntry> {
        // Check circuit breaker
        if !self.circuit_breaker.is_allowed().await {
            let entry = self
                .record_history_async(
                    kind,
                    SyncStatus::Skipped,
                    0,
                    0,
                    Some("Circuit breaker open".to_string()),
                    0,
                )
                .await;
            return Ok(entry);
        }

        // Mark as in-progress
        *self.status.write().await = SyncStatus::InProgress;
        let started_at = Utc::now();

        debug!("Starting sync: {:?}", kind);

        // Perform the sync operations based on kind
        let result = match kind {
            SyncKind::Heartbeat => self.sync_heartbeat(client).await,
            SyncKind::Results => self.sync_results(client).await,
            SyncKind::Config => self.sync_config(client).await,
            SyncKind::Rules => self.sync_rules(client).await,
            SyncKind::Audit => self.sync_audit(client).await,
            SyncKind::Full | SyncKind::Manual => self.sync_full(client).await,
            // New axes — individual sync methods will be wired in future batches.
            SyncKind::Playbooks
            | SyncKind::DetectionRules
            | SyncKind::Risks
            | SyncKind::Assets
            | SyncKind::Kpi
            | SyncKind::Alerting => {
                debug!("Sync kind {:?} not yet wired in orchestrator", kind);
                Ok(0)
            }
        };

        let duration_ms = (Utc::now() - started_at).num_milliseconds().max(0) as u64;

        match result {
            Ok(items_synced) => {
                self.circuit_breaker.record_success().await;
                self.offline_tracker.exit_offline_mode().await;
                *self.status.write().await = SyncStatus::Success;
                *self.last_success.write().await = Some(Utc::now());
                *self.last_error.write().await = None;

                let entry = self
                    .record_history_async(
                        kind,
                        SyncStatus::Success,
                        items_synced,
                        duration_ms,
                        None,
                        0,
                    )
                    .await;

                info!(
                    "Sync completed: {} items in {}ms",
                    items_synced, duration_ms
                );
                Ok(entry)
            }
            Err(e) => {
                self.circuit_breaker.record_failure().await;

                // Check if we should enter offline mode
                if e.is_retryable() {
                    self.offline_tracker.enter_offline_mode().await;
                }

                *self.status.write().await = SyncStatus::Failed;
                let error_msg = e.to_string();
                *self.last_error.write().await = Some(error_msg.clone());

                let _entry = self
                    .record_history_async(
                        kind,
                        SyncStatus::Failed,
                        0,
                        duration_ms,
                        Some(error_msg),
                        0,
                    )
                    .await;

                warn!("Sync failed: {}", e);
                Err(e)
            }
        }
    }

    /// Get the current sync status summary.
    pub async fn status(&self) -> SyncStatusSummary {
        let status = *self.status.read().await;
        let last_success_at = *self.last_success.read().await;
        let last_error = self.last_error.read().await.clone();
        let offline_status = self.offline_tracker.status().await;
        let cb_state = self.circuit_breaker.state().await;

        let last_attempt_at = {
            let history = self.history.read().await;
            history.first().map(|e| e.started_at)
        };

        SyncStatusSummary {
            status,
            last_success_at,
            last_attempt_at,
            last_error,
            pending_items: offline_status.queued_item_count,
            is_offline: offline_status.is_offline,
            circuit_breaker: format!("{:?}", cb_state),
        }
    }

    /// Get sync history entries (newest first).
    pub async fn history(&self, limit: usize) -> Vec<SyncHistoryEntry> {
        let history = self.history.read().await;
        history.iter().take(limit).cloned().collect()
    }

    /// Get the offline tracker reference.
    pub fn offline_tracker(&self) -> &OfflineTracker {
        &self.offline_tracker
    }

    /// Get the circuit breaker reference.
    pub fn circuit_breaker(&self) -> &CircuitBreaker {
        &self.circuit_breaker
    }

    /// Perform a full sync (heartbeat + results + config + rules).
    async fn sync_full(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        let mut total = 0u32;

        // Heartbeat first
        match self.sync_heartbeat(client).await {
            Ok(n) => total += n,
            Err(e) => {
                warn!("Heartbeat sync failed during full sync: {}", e);
                return Err(e);
            }
        }

        // Config sync
        match self.sync_config(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Config sync failed during full sync: {}", e),
        }

        // Rules sync
        match self.sync_rules(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Rules sync failed during full sync: {}", e),
        }

        // Results upload
        match self.sync_results(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Results sync failed during full sync: {}", e),
        }

        // Audit sync
        match self.sync_audit(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Audit sync failed during full sync: {}", e),
        }

        Ok(total)
    }

    /// Sync audit trail.
    async fn sync_audit(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        use crate::types::AuditTrailEntry;
        use agent_storage::AuditTrailRepository;

        // 1. Fetch unsynced entries from local storage
        let repo = AuditTrailRepository::new(&self._db);
        let stored_entries = repo.fetch_unsynced(50).await.map_err(|e| {
            crate::error::SyncError::Config(format!(
                "Failed to fetch unsynced audit entries: {}",
                e
            ))
        })?;

        if stored_entries.is_empty() {
            return Ok(0);
        }

        let ids: Vec<i64> = stored_entries.iter().filter_map(|e| e.id).collect();
        let api_entries: Vec<AuditTrailEntry> = stored_entries
            .iter()
            .map(|e| AuditTrailEntry {
                action: e.action_type.clone(),
                actor: e.actor.clone(),
                details: e.details.clone(),
                timestamp: e.timestamp,
                metadata: serde_json::from_str(&e.action_data).unwrap_or_default(),
            })
            .collect();

        debug!("Syncing {} audit entries to SaaS", api_entries.len());

        // 2. Upload to SaaS
        let server_count = client.sync_audit_trail(api_entries).await?;
        info!("Successfully synced {} audit entries to SaaS", server_count);

        // 3. Mark as synced in local storage
        repo.mark_synced(&ids).await.map_err(|e| {
            crate::error::SyncError::Config(format!(
                "Failed to mark audit entries as synced: {}",
                e
            ))
        })?;

        Ok(server_count)
    }

    /// Sync heartbeat.
    async fn sync_heartbeat(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        let agent_id = client.agent_id().await?;
        debug!("Sending heartbeat for agent {}", agent_id);

        let request = crate::types::HeartbeatRequest {
            timestamp: Utc::now(),
            agent_version: agent_common::constants::AGENT_VERSION.to_string(),
            status: "active".to_string(),
            hostname: hostname::get()
                .ok()
                .and_then(|h| h.into_string().ok())
                .unwrap_or_else(|| "unknown".to_string()),
            os_info: std::env::consts::OS.to_string(),
            cpu_percent: 0.0,
            memory_bytes: 0,
            last_check_at: None,
            compliance_score: None,
            pending_sync_count: 0,
            self_check_result: None,
            memory_percent: None,
            memory_total_bytes: None,
            disk_percent: None,
            disk_used_bytes: None,
            disk_total_bytes: None,
            uptime_seconds: None,
            ip_address: None,
            network_bytes_sent: None,
            network_bytes_recv: None,
            processes: Vec::new(),
            connections: Vec::new(),
        };

        let _response: crate::types::HeartbeatResponse = client
            .post_json(&format!("/v1/agents/{}/heartbeat", agent_id), &request)
            .await?;

        Ok(1)
    }

    /// Sync configuration.
    async fn sync_config(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        let agent_id = client.agent_id().await?;
        debug!("Syncing config for agent {}", agent_id);

        let _config: serde_json::Value = client
            .get(&format!("/v1/agents/{}/config", agent_id))
            .await?;

        Ok(1)
    }

    /// Sync rules.
    async fn sync_rules(&self, _client: &AuthenticatedClient) -> SyncResult<u32> {
        // Rules are included in config response
        Ok(0)
    }

    /// Sync pending results.
    async fn sync_results(&self, _client: &AuthenticatedClient) -> SyncResult<u32> {
        // Query pending results from DB and upload them
        // For now, return 0 as the sync queue processing is handled separately
        Ok(0)
    }

    /// Record a sync history entry.
    async fn record_history_async(
        &self,
        kind: SyncKind,
        status: SyncStatus,
        items_synced: u32,
        duration_ms: u64,
        error: Option<String>,
        conflicts_resolved: u32,
    ) -> SyncHistoryEntry {
        let now = Utc::now();
        let entry = SyncHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            kind,
            status,
            started_at: now - chrono::Duration::milliseconds(duration_ms as i64),
            completed_at: Some(now),
            duration_ms: Some(duration_ms),
            items_synced,
            error,
            conflicts_resolved,
        };

        let mut history = self.history.write().await;
        history.insert(0, entry.clone());
        if history.len() > MAX_HISTORY_ENTRIES {
            history.truncate(MAX_HISTORY_ENTRIES);
        }

        entry
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Arc<Database>) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, Arc::new(db))
    }

    #[tokio::test]
    async fn test_orchestrator_initial_status() {
        let (_temp_dir, db) = create_test_db().await;
        let orchestrator = SyncOrchestrator::new(db);

        let status = orchestrator.status().await;
        assert_eq!(status.status, SyncStatus::Idle);
        assert!(status.last_success_at.is_none());
        assert!(!status.is_offline);
    }

    #[tokio::test]
    async fn test_orchestrator_history_empty() {
        let (_temp_dir, db) = create_test_db().await;
        let orchestrator = SyncOrchestrator::new(db);

        let history = orchestrator.history(10).await;
        assert!(history.is_empty());
    }

    #[test]
    fn test_sync_kind_as_str() {
        assert_eq!(SyncKind::Full.as_str(), "full");
        assert_eq!(SyncKind::Heartbeat.as_str(), "heartbeat");
        assert_eq!(SyncKind::Results.as_str(), "results");
        assert_eq!(SyncKind::Config.as_str(), "config");
        assert_eq!(SyncKind::Rules.as_str(), "rules");
        assert_eq!(SyncKind::Manual.as_str(), "manual");
        assert_eq!(SyncKind::Playbooks.as_str(), "playbooks");
        assert_eq!(SyncKind::DetectionRules.as_str(), "detection_rules");
        assert_eq!(SyncKind::Risks.as_str(), "risks");
        assert_eq!(SyncKind::Assets.as_str(), "assets");
        assert_eq!(SyncKind::Kpi.as_str(), "kpi");
        assert_eq!(SyncKind::Alerting.as_str(), "alerting");
    }

    #[test]
    fn test_sync_history_entry_creation() {
        let entry = SyncHistoryEntry {
            id: "test".to_string(),
            kind: SyncKind::Manual,
            status: SyncStatus::Success,
            started_at: Utc::now(),
            completed_at: Some(Utc::now()),
            duration_ms: Some(150),
            items_synced: 5,
            error: None,
            conflicts_resolved: 0,
        };

        assert_eq!(entry.kind, SyncKind::Manual);
        assert_eq!(entry.status, SyncStatus::Success);
        assert_eq!(entry.items_synced, 5);
    }
}
