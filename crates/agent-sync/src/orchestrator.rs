// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
    /// Full sync (now acts as manual GRC sync).
    Full,
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

macro_rules! impl_sync_queue {
    ($name:ident, $entity:path, $payload:path, $sync_method:ident) => {
        async fn $name(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
            use agent_storage::SyncQueueRepository;
            let repo = SyncQueueRepository::new(&self._db);
            let pending = match repo.get_pending(50).await {
                Ok(p) => p,
                Err(e) => {
                    return Err(crate::error::SyncError::Config(format!(
                        "Failed to fetch pending {}: {}",
                        stringify!($entity),
                        e
                    )))
                }
            };

            let mut items = Vec::new();
            let mut ids = Vec::new();
            for item in pending {
                if item.entity_type == $entity {
                    match serde_json::from_str::<$payload>(&item.payload) {
                        Ok(payload) => {
                            items.push(payload);
                            ids.push(item.id);
                        }
                        Err(e) => {
                            let _ = repo
                                .record_failure(item.id, &format!("Deserialization failed: {}", e))
                                .await;
                        }
                    }
                }
            }

            if items.is_empty() {
                return Ok(0);
            }

            // Upload via AuthenticatedClient
            match client.$sync_method(items).await {
                Ok(_) => {
                    let _ = repo.remove(&ids).await;
                    Ok(ids.len() as u32)
                }
                Err(e) => {
                    for id in ids {
                        let _ = repo.record_failure(id, &e.to_string()).await;
                    }
                    Err(e)
                }
            }
        }
    };
}

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

    /// Drain only the GRC entity queues (playbooks, risks, assets, KPIs, alert rules, detection rules).
    ///
    /// Unlike `sync_full`, this does NOT re-do heartbeat/config/rules/results/audit
    /// since those are already handled by the main loop.
    ///
    /// A 500ms delay is inserted between each entity type drain to throttle HTTP
    /// requests and avoid bursting ~350 requests in rapid succession.
    pub async fn drain_grc_queues(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        let mut total = 0u32;
        let throttle = std::time::Duration::from_millis(500);

        // Enforce queue size limit before draining to prevent unbounded growth
        {
            use agent_storage::SyncQueueRepository;
            let sync_queue = SyncQueueRepository::new(&self._db);
            if let Err(e) = sync_queue.enforce_queue_limit().await {
                warn!("Failed to enforce queue limit: {}", e);
            }
        }

        // Upload locally-created GRC entities from the sync queue
        match self.sync_playbooks(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Playbooks queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_detection_rules(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Detection rules queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_risks(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Risks queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_assets(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Assets queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_kpi(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("KPI queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_alerting(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Alert rules queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        match self.sync_webhooks(client).await {
            Ok(n) => total += n,
            Err(e) => warn!("Webhooks queue drain: {}", e),
        }
        tokio::time::sleep(throttle).await;

        // Download GRC entities from SaaS into local SQLite
        match self.download_grc_entities(client).await {
            Ok(n) => {
                if n > 0 {
                    info!("Downloaded {} GRC entity records from SaaS", n);
                }
                total += n;
            }
            Err(e) => warn!("GRC entity download failed: {}", e),
        }

        Ok(total)
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
            SyncKind::Full | SyncKind::Manual => self.drain_grc_queues(client).await,
            SyncKind::Playbooks => self.sync_playbooks(client).await,
            SyncKind::DetectionRules => self.sync_detection_rules(client).await,
            SyncKind::Risks => self.sync_risks(client).await,
            SyncKind::Assets => self.sync_assets(client).await,
            SyncKind::Kpi => self.sync_kpi(client).await,
            SyncKind::Alerting => self.sync_alerting(client).await,
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

    /// Download GRC entities from the SaaS and persist them to local SQLite.
    ///
    /// This is the core of the Two-Way Sync architecture. On each full sync,
    /// we pull the authoritative state from the SaaS and upsert into local
    /// SQLite tables so the GUI can display the correct data even after a restart.
    async fn download_grc_entities(&self, client: &AuthenticatedClient) -> SyncResult<u32> {
        use agent_storage::repositories::grc::{
            AlertRuleRepository, DetectionRuleRepository, ManagedAssetRepository,
            PlaybookRepository, RiskRepository, SoftwareInventoryRepository, StoredAlertRule,
            StoredDetectionRule, StoredManagedAsset, StoredPlaybook, StoredRisk,
            StoredSoftwareInventory, StoredWebhook, WebhookRepository,
        };

        let mut count = 0u32;
        let now = chrono::Utc::now().to_rfc3339();

        // --- Risks ---
        match client.fetch_risks().await {
            Ok(risks) => {
                let repo = RiskRepository::new(&self._db);
                for r in &risks {
                    let stored = StoredRisk {
                        id: r.id.clone(),
                        title: r.title.clone(),
                        description: r.description.clone(),
                        probability: r.probability as i32,
                        impact: r.impact as i32,
                        owner: r.owner.clone(),
                        status: r.status.clone(),
                        mitigation: r.mitigation.clone(),
                        source: r.source.clone(),
                        created_at: r.created_at.to_rfc3339(),
                        updated_at: r.updated_at.unwrap_or(r.created_at).to_rfc3339(),
                        sla_target_days: r.sla_target_days.map(|v| v as i32),
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert risk {}: {}", r.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} risks from SaaS", risks.len());
            }
            Err(e) => warn!("Failed to fetch risks: {}", e),
        }

        // --- Playbooks ---
        match client.fetch_playbooks().await {
            Ok(playbooks) => {
                let repo = PlaybookRepository::new(&self._db);
                for p in &playbooks {
                    let stored = StoredPlaybook {
                        id: p.id.clone(),
                        name: p.name.clone(),
                        description: p.description.clone(),
                        trigger_type: "general".to_string(),
                        severity: "medium".to_string(),
                        steps: serde_json::to_string(&p.actions).unwrap_or_default(),
                        enabled: p.enabled,
                        created_at: p.created_at.to_rfc3339(),
                        updated_at: now.clone(),
                        synced: true,
                        conditions: serde_json::to_string(&p.conditions).unwrap_or_else(|_| "[]".to_string()),
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert playbook {}: {}", p.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} playbooks from SaaS", playbooks.len());
            }
            Err(e) => warn!("Failed to fetch playbooks: {}", e),
        }

        // --- Managed Assets ---
        match client.fetch_managed_assets().await {
            Ok(assets) => {
                let repo = ManagedAssetRepository::new(&self._db);
                for a in &assets {
                    let stored = StoredManagedAsset {
                        id: a.id.clone(),
                        ip: a.ip.clone(),
                        hostname: a.hostname.clone(),
                        mac: a.mac.clone(),
                        vendor: a.vendor.clone(),
                        device_type: a.device_type.clone(),
                        criticality: a.criticality.clone(),
                        lifecycle: a.lifecycle.clone(),
                        tags: serde_json::to_string(&a.tags).unwrap_or_else(|_| "[]".to_string()),
                        risk_score: a.risk_score,
                        vulnerability_count: a.vulnerability_count as i32,
                        open_ports: serde_json::to_string(&a.open_ports).unwrap_or_else(|_| "[]".to_string()),
                        software: serde_json::to_string(&a.software).unwrap_or_else(|_| "[]".to_string()),
                        first_seen: a.first_seen.to_rfc3339(),
                        last_seen: a.last_seen.to_rfc3339(),
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert asset {}: {}", a.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} managed assets from SaaS", assets.len());
            }
            Err(e) => warn!("Failed to fetch managed assets: {}", e),
        }

        // --- Alert Rules ---
        match client.fetch_alert_rules().await {
            Ok(rules) => {
                let repo = AlertRuleRepository::new(&self._db);
                for r in &rules {
                    let stored = StoredAlertRule {
                        id: r.id.clone(),
                        name: r.name.clone(),
                        rule_type: r.rule_type.clone(),
                        severity_threshold: r.severity_threshold.clone(),
                        detection_types: serde_json::to_string(&r.detection_types).unwrap_or_default(),
                        escalation_minutes: r.escalation_minutes.map(|v| v as i32),
                        enabled: r.enabled,
                        created_at: r.created_at.to_rfc3339(),
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert alert rule {}: {}", r.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} alert rules from SaaS", rules.len());
            }
            Err(e) => warn!("Failed to fetch alert rules: {}", e),
        }

        // --- Webhooks ---
        match client.fetch_webhooks().await {
            Ok(webhooks) => {
                let repo = WebhookRepository::new(&self._db);
                for w in &webhooks {
                    let stored = StoredWebhook {
                        id: w.id.clone(),
                        name: w.name.clone(),
                        url: w.url.clone(),
                        events: w.format.clone(),
                        secret: None,
                        enabled: w.enabled,
                        created_at: now.clone(),
                        updated_at: now.clone(),
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert webhook {}: {}", w.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} webhooks from SaaS", webhooks.len());
            }
            Err(e) => warn!("Failed to fetch webhooks: {}", e),
        }

        // --- Detection Rules ---
        match client.fetch_detection_rules().await {
            Ok(rules) => {
                let repo = DetectionRuleRepository::new(&self._db);
                for r in &rules {
                    let stored = StoredDetectionRule {
                        id: r.id.clone(),
                        name: r.name.clone(),
                        description: r.description.clone(),
                        severity: r.severity.clone(),
                        conditions: serde_json::to_string(&r.conditions).unwrap_or_default(),
                        actions: serde_json::to_string(&r.actions).unwrap_or_default(),
                        enabled: r.enabled,
                        created_at: r.created_at.to_rfc3339(),
                        last_match: r.last_match.map(|dt| dt.to_rfc3339()),
                        match_count: r.match_count as i32,
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert detection rule {}: {}", r.id, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} detection rules from SaaS", rules.len());
            }
            Err(e) => warn!("Failed to fetch detection rules: {}", e),
        }

        // --- Software Inventory ---
        match client.fetch_software_inventory().await {
            Ok(software) => {
                let repo = SoftwareInventoryRepository::new(&self._db);
                let hostname = hostname::get()
                    .ok()
                    .and_then(|h| h.into_string().ok())
                    .unwrap_or_else(|| "unknown".to_string());
                for s in &software {
                    let stored = StoredSoftwareInventory {
                        id: format!(
                            "{}-{}-{}",
                            hostname,
                            s.name,
                            s.version.as_deref().unwrap_or("unknown")
                        ),
                        hostname: hostname.clone(),
                        software_name: s.name.clone(),
                        version: s.version.clone().unwrap_or_default(),
                        vendor: s.vendor.clone().unwrap_or_default(),
                        install_date: None,
                        synced: true,
                    };
                    if let Err(e) = repo.upsert(&stored).await {
                        warn!("Failed to upsert software {}: {}", s.name, e);
                    } else {
                        count += 1;
                    }
                }
                debug!("Downloaded {} software items from SaaS", software.len());
            }
            Err(e) => warn!("Failed to fetch software inventory: {}", e),
        }

        Ok(count)
    }

    impl_sync_queue!(
        sync_playbooks,
        agent_storage::SyncEntityType::Playbook,
        crate::types::PlaybookPayload,
        sync_playbooks
    );
    impl_sync_queue!(
        sync_detection_rules,
        agent_storage::SyncEntityType::DetectionRule,
        crate::types::DetectionRulePayload,
        sync_detection_rules
    );
    impl_sync_queue!(
        sync_risks,
        agent_storage::SyncEntityType::Risk,
        crate::types::RiskPayload,
        sync_risks
    );
    impl_sync_queue!(
        sync_assets,
        agent_storage::SyncEntityType::Asset,
        crate::types::AssetPayload,
        sync_assets
    );
    impl_sync_queue!(
        sync_kpi,
        agent_storage::SyncEntityType::Kpi,
        crate::types::KpiSnapshotPayload,
        sync_kpi_snapshots
    );
    impl_sync_queue!(
        sync_alerting,
        agent_storage::SyncEntityType::AlertRule,
        crate::types::AlertRulePayload,
        sync_alert_rules
    );
    impl_sync_queue!(
        sync_webhooks,
        agent_storage::SyncEntityType::Webhook,
        crate::types::WebhookPayload,
        sync_webhooks
    );

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
