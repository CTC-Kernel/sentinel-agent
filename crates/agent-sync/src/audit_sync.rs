//! Agent Audit Trail Synchronization Service.
//!
//! This service is responsible for periodically syncing local audit trail
//! entries to the SaaS. It tracks which entries have been synced and
//! handles retries and backoff.

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use crate::types::AuditTrailEntry;
use agent_storage::Database;
use std::sync::Arc;
use tracing::{debug, error, info};

/// Service for syncing local audit trail to the SaaS.
pub struct AuditSyncService {
    client: Arc<AuthenticatedClient>,
    db: Arc<Database>,
}

impl AuditSyncService {
    /// Create a new audit sync service.
    pub fn new(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        Self { client, db }
    }

    /// Sync unsynced audit entries to the SaaS.
    ///
    /// Returns the number of entries successfully synced.
    pub async fn sync(&self) -> SyncResult<u32> {
        // 1. Fetch unsynced entries from local storage
        let stored_entries = self.fetch_unsynced_entries().await?;

        if stored_entries.is_empty() {
            return Ok(0);
        }

        let ids: Vec<i64> = stored_entries.iter().filter_map(|e| e.id).collect();
        let api_entries: Vec<AuditTrailEntry> = stored_entries.iter().map(|e| {
            AuditTrailEntry {
                action: e.action_type.clone(),
                actor: e.actor.clone(),
                details: e.details.clone(),
                timestamp: e.timestamp,
                metadata: serde_json::from_str(&e.action_data).unwrap_or_default(),
            }
        }).collect();

        debug!("Syncing {} audit entries to SaaS", api_entries.len());

        // 2. Upload to SaaS
        match self.client.sync_audit_trail(api_entries).await {
            Ok(server_count) => {
                info!("Successfully synced {} audit entries to SaaS", server_count);
                
                // 3. Mark as synced in local storage
                self.mark_as_synced(&ids).await?;
                
                Ok(server_count)
            }
            Err(e) => {
                error!("Failed to sync audit entries: {}", e);
                Err(e)
            }
        }
    }

    /// Fetch unsynced audit entries from local storage.
    async fn fetch_unsynced_entries(&self) -> SyncResult<Vec<agent_storage::StoredAuditEntry>> {
        use agent_storage::AuditTrailRepository;
        
        let repo = AuditTrailRepository::new(&self.db);
        repo.fetch_unsynced(50).await.map_err(|e| {
            crate::error::SyncError::Config(format!("Failed to fetch unsynced audit entries: {}", e))
        })
    }

    /// Mark entries as synced in local storage.
    async fn mark_as_synced(&self, ids: &[i64]) -> SyncResult<()> {
        use agent_storage::AuditTrailRepository;
        
        let repo = AuditTrailRepository::new(&self.db);
        repo.mark_synced(ids).await.map_err(|e| {
            crate::error::SyncError::Config(format!("Failed to mark audit entries as synced: {}", e))
        })
    }
}
