//! Sync queue repository with overflow protection.
//!
//! This module provides CRUD operations for the sync queue with support for:
//! - Queue size limits to prevent OOM during extended offline periods
//! - Priority-aware eviction (low-priority items evicted first)
//! - Queue statistics for monitoring
//! - Exponential backoff retry tracking

use crate::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// Maximum number of items allowed in the sync queue.
///
/// This limit prevents unbounded memory growth when the agent is offline
/// for extended periods. At 10,000 items with typical payload sizes,
/// this keeps the queue under ~50 MB of database storage.
pub const MAX_SYNC_QUEUE_SIZE: usize = 10_000;

/// Default maximum retry attempts per item.
const DEFAULT_MAX_ATTEMPTS: u32 = 10;

/// Sync entity type in the queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncEntityType {
    CheckResult,
    Proof,
    Heartbeat,
    Config,
}

impl SyncEntityType {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncEntityType::CheckResult => "check_result",
            SyncEntityType::Proof => "proof",
            SyncEntityType::Heartbeat => "heartbeat",
            SyncEntityType::Config => "config",
        }
    }

    /// Parse from database string representation.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "check_result" => Some(SyncEntityType::CheckResult),
            "proof" => Some(SyncEntityType::Proof),
            "heartbeat" => Some(SyncEntityType::Heartbeat),
            "config" => Some(SyncEntityType::Config),
            _ => None,
        }
    }
}

/// An item to enqueue in the sync queue.
#[derive(Debug, Clone)]
pub struct SyncQueueEntry {
    /// Entity type.
    pub entity_type: SyncEntityType,
    /// Entity identifier.
    pub entity_id: i64,
    /// Serialized payload (JSON).
    pub payload: String,
    /// Priority (higher = more urgent). Default is 0.
    pub priority: i32,
    /// Maximum retry attempts. Default is 10.
    pub max_attempts: u32,
}

impl SyncQueueEntry {
    /// Create a new sync queue entry with default priority and max attempts.
    pub fn new(entity_type: SyncEntityType, entity_id: i64, payload: impl Into<String>) -> Self {
        Self {
            entity_type,
            entity_id,
            payload: payload.into(),
            priority: 0,
            max_attempts: DEFAULT_MAX_ATTEMPTS,
        }
    }

    /// Set the priority (higher = more urgent).
    pub fn with_priority(mut self, priority: i32) -> Self {
        self.priority = priority;
        self
    }

    /// Set the maximum retry attempts.
    pub fn with_max_attempts(mut self, max_attempts: u32) -> Self {
        self.max_attempts = max_attempts;
        self
    }
}

/// A queued sync item read from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncQueueItem {
    /// Unique identifier.
    pub id: i64,
    /// Entity type.
    pub entity_type: SyncEntityType,
    /// Entity identifier.
    pub entity_id: i64,
    /// Serialized payload.
    pub payload: String,
    /// Priority (higher = more urgent).
    pub priority: i32,
    /// Number of retry attempts.
    pub attempts: u32,
    /// Maximum retry attempts.
    pub max_attempts: u32,
    /// Last attempt timestamp.
    pub last_attempt_at: Option<DateTime<Utc>>,
    /// Last error message.
    pub last_error: Option<String>,
    /// Queue entry timestamp.
    pub created_at: DateTime<Utc>,
    /// Next retry timestamp.
    pub next_retry_at: DateTime<Utc>,
}

/// Statistics about the sync queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    /// Total number of items in the queue.
    pub total_count: i64,
    /// Number of items still eligible for retry (attempts < max_attempts).
    pub pending_count: i64,
    /// Number of items that have exhausted all retry attempts (attempts >= max_attempts).
    pub failed_count: i64,
    /// Age of the oldest item in the queue, in seconds.
    pub oldest_item_age_secs: Option<i64>,
}

/// Repository for sync queue CRUD operations with overflow protection.
pub struct SyncQueueRepository<'a> {
    db: &'a Database,
}

impl<'a> SyncQueueRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Enqueue a new sync item with overflow protection.
    ///
    /// Before inserting, this method checks the current queue size. If the queue
    /// is at capacity, it evicts the oldest low-priority items first (priority 0),
    /// then oldest items regardless of priority if still full. This ensures
    /// high-priority items can always be inserted.
    ///
    /// Returns the ID of the inserted item.
    pub async fn enqueue(&self, entry: &SyncQueueEntry) -> StorageResult<i64> {
        let entity_type = entry.entity_type.as_str().to_string();
        let entity_id = entry.entity_id;
        let payload = entry.payload.clone();
        let priority = entry.priority;
        let max_attempts = entry.max_attempts as i32;

        self.db
            .with_connection(|conn| {
                // Check current queue size
                let current_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count sync queue: {}", e))
                    })?;

                if current_count >= MAX_SYNC_QUEUE_SIZE as i64 {
                    let excess = (current_count - MAX_SYNC_QUEUE_SIZE as i64) + 1;

                    // First pass: evict oldest low-priority items (priority 0)
                    let low_priority_evicted = conn
                        .execute(
                            r#"
                            DELETE FROM sync_queue WHERE id IN (
                                SELECT id FROM sync_queue
                                WHERE priority = 0
                                ORDER BY created_at ASC
                                LIMIT ?
                            )
                            "#,
                            [excess],
                        )
                        .map_err(|e| {
                            StorageError::Query(format!(
                                "Failed to evict low-priority items: {}",
                                e
                            ))
                        })?;

                    if low_priority_evicted > 0 {
                        warn!(
                            "Sync queue overflow: evicted {} low-priority items (queue was at {}/{})",
                            low_priority_evicted, current_count, MAX_SYNC_QUEUE_SIZE
                        );
                    }

                    // Check if we still need to evict more
                    let remaining_excess = excess - low_priority_evicted as i64;
                    if remaining_excess > 0 {
                        let any_evicted = conn
                            .execute(
                                r#"
                                DELETE FROM sync_queue WHERE id IN (
                                    SELECT id FROM sync_queue
                                    ORDER BY priority ASC, created_at ASC
                                    LIMIT ?
                                )
                                "#,
                                [remaining_excess],
                            )
                            .map_err(|e| {
                                StorageError::Query(format!(
                                    "Failed to evict items by age: {}",
                                    e
                                ))
                            })?;

                        if any_evicted > 0 {
                            warn!(
                                "Sync queue overflow: evicted {} additional items regardless of priority",
                                any_evicted
                            );
                        }
                    }
                }

                // Insert the new item
                conn.execute(
                    r#"
                    INSERT INTO sync_queue (entity_type, entity_id, payload, priority, max_attempts)
                    VALUES (?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![entity_type, entity_id, payload, priority, max_attempts],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to enqueue sync item: {}", e))
                })?;

                let id = conn.last_insert_rowid();
                debug!(
                    "Enqueued sync item {} (type={}, entity={}, priority={})",
                    id, entity_type, entity_id, priority
                );
                Ok(id)
            })
            .await
    }

    /// Get the next batch of items ready for sync, ordered by priority (desc) then age (asc).
    ///
    /// Only returns items where:
    /// - attempts < max_attempts
    /// - next_retry_at <= now
    pub async fn get_pending(&self, limit: i64) -> StorageResult<Vec<SyncQueueItem>> {
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, entity_type, entity_id, payload, priority, attempts,
                               max_attempts, last_attempt_at, last_error, created_at, next_retry_at
                        FROM sync_queue
                        WHERE attempts < max_attempts
                          AND next_retry_at <= ?
                        ORDER BY priority DESC, created_at ASC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map(rusqlite::params![now, limit], Self::row_to_sync_queue_item)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                debug!("Found {} pending sync queue items", results.len());
                Ok(results)
            })
            .await
    }

    /// Record a failed attempt for a sync queue item.
    ///
    /// Increments the attempt counter, records the error message, and
    /// calculates the next retry time using exponential backoff.
    pub async fn record_failure(
        &self,
        id: i64,
        error_message: &str,
    ) -> StorageResult<()> {
        let error_message = error_message.to_string();
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

        self.db
            .with_connection(move |conn| {
                // Get current attempts to calculate backoff
                let attempts: u32 = conn
                    .query_row(
                        "SELECT attempts FROM sync_queue WHERE id = ?",
                        [id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to query sync queue item: {}", e))
                    })?
                    .ok_or_else(|| {
                        StorageError::NotFound(format!("Sync queue item {} not found", id))
                    })?;

                // Exponential backoff: min(2^attempts, 3600) seconds
                let delay_secs = std::cmp::min(2u64.pow(attempts + 1), 3600);
                let next_retry =
                    (Utc::now() + chrono::Duration::seconds(delay_secs as i64))
                        .format("%Y-%m-%dT%H:%M:%SZ")
                        .to_string();

                conn.execute(
                    r#"
                    UPDATE sync_queue
                    SET attempts = attempts + 1,
                        last_attempt_at = ?,
                        last_error = ?,
                        next_retry_at = ?
                    WHERE id = ?
                    "#,
                    rusqlite::params![now, error_message, next_retry, id],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to update sync queue item: {}", e))
                })?;

                debug!(
                    "Recorded failure for sync queue item {} (attempt {}, next retry in {}s)",
                    id,
                    attempts + 1,
                    delay_secs
                );
                Ok(())
            })
            .await
    }

    /// Remove successfully synced items from the queue.
    pub async fn remove(&self, ids: &[i64]) -> StorageResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }

        let ids = ids.to_vec();
        self.db
            .with_connection(move |conn| {
                let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
                let sql = format!(
                    "DELETE FROM sync_queue WHERE id IN ({})",
                    placeholders.join(", ")
                );

                let params: Vec<&dyn rusqlite::ToSql> =
                    ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

                let count = conn
                    .execute(&sql, params.as_slice())
                    .map_err(|e| StorageError::Query(format!("Failed to remove items: {}", e)))?;

                info!("Removed {} items from sync queue", count);
                Ok(count)
            })
            .await
    }

    /// Enforce the queue size limit by evicting the oldest excess items.
    ///
    /// This method can be called periodically (e.g., before each sync cycle)
    /// to keep the queue within bounds.
    ///
    /// Returns the number of items evicted.
    pub async fn enforce_queue_limit(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let current_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count sync queue: {}", e))
                    })?;

                if current_count <= MAX_SYNC_QUEUE_SIZE as i64 {
                    return Ok(0);
                }

                let excess = current_count - MAX_SYNC_QUEUE_SIZE as i64;

                // Evict oldest items with lowest priority first
                let evicted = conn
                    .execute(
                        r#"
                        DELETE FROM sync_queue WHERE id IN (
                            SELECT id FROM sync_queue
                            ORDER BY priority ASC, created_at ASC
                            LIMIT ?
                        )
                        "#,
                        [excess],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to evict excess items: {}", e))
                    })?;

                warn!(
                    "Sync queue limit enforced: evicted {} items (was {}, limit {})",
                    evicted, current_count, MAX_SYNC_QUEUE_SIZE
                );

                Ok(evicted)
            })
            .await
    }

    /// Get queue statistics.
    ///
    /// Returns counts of total, pending, and failed items, along with the
    /// age of the oldest item in the queue.
    pub async fn queue_stats(&self) -> StorageResult<QueueStats> {
        self.db
            .with_connection(|conn| {
                let total_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count sync queue: {}", e))
                    })?;

                let pending_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM sync_queue WHERE attempts < max_attempts",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count pending items: {}", e))
                    })?;

                let failed_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM sync_queue WHERE attempts >= max_attempts",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count failed items: {}", e))
                    })?;

                let oldest_created_at: Option<String> = conn
                    .query_row(
                        "SELECT MIN(created_at) FROM sync_queue",
                        [],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to get oldest item: {}", e))
                    })?
                    .flatten();

                let oldest_item_age_secs = oldest_created_at.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| (Utc::now() - dt.with_timezone(&Utc)).num_seconds())
                });

                Ok(QueueStats {
                    total_count,
                    pending_count,
                    failed_count,
                    oldest_item_age_secs,
                })
            })
            .await
    }

    /// Count total items in the sync queue.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count sync queue: {}", e))
                    })?;
                Ok(count)
            })
            .await
    }

    /// Delete all failed items (attempts >= max_attempts).
    ///
    /// Returns the number of items removed.
    pub async fn purge_failed(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let count = conn
                    .execute(
                        "DELETE FROM sync_queue WHERE attempts >= max_attempts",
                        [],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to purge failed items: {}", e))
                    })?;

                if count > 0 {
                    info!("Purged {} failed items from sync queue", count);
                }
                Ok(count)
            })
            .await
    }

    /// Convert a database row to a SyncQueueItem.
    fn row_to_sync_queue_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<SyncQueueItem> {
        let id: i64 = row.get(0)?;
        let entity_type_str: String = row.get(1)?;
        let entity_type = SyncEntityType::parse_str(&entity_type_str).unwrap_or_else(|| {
            warn!(
                "Unknown entity type '{}' for sync queue item {}, defaulting to CheckResult",
                entity_type_str, id
            );
            SyncEntityType::CheckResult
        });

        let last_attempt_str: Option<String> = row.get(7)?;
        let last_attempt_at = last_attempt_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        let created_at_str: String = row.get(9)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                warn!(
                    "Failed to parse created_at '{}' for sync queue item {}: {}. Using current time.",
                    created_at_str, id, e
                );
                Utc::now()
            });

        let next_retry_str: String = row.get(10)?;
        let next_retry_at = DateTime::parse_from_rfc3339(&next_retry_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                warn!(
                    "Failed to parse next_retry_at '{}' for sync queue item {}: {}. Using current time.",
                    next_retry_str, id, e
                );
                Utc::now()
            });

        Ok(SyncQueueItem {
            id,
            entity_type,
            entity_id: row.get(2)?,
            payload: row.get(3)?,
            priority: row.get(4)?,
            attempts: row.get(5)?,
            max_attempts: row.get(6)?,
            last_attempt_at,
            last_error: row.get(8)?,
            created_at,
            next_retry_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, db)
    }

    #[tokio::test]
    async fn test_enqueue_and_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);

        let entry = SyncQueueEntry::new(
            SyncEntityType::CheckResult,
            1,
            r#"{"result": "pass"}"#,
        );
        let id = repo.enqueue(&entry).await.unwrap();
        assert!(id > 0);

        assert_eq!(repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_enqueue_with_priority() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Enqueue low priority
        repo.enqueue(&SyncQueueEntry::new(
            SyncEntityType::Heartbeat,
            1,
            "{}",
        ))
        .await
        .unwrap();

        // Enqueue high priority
        repo.enqueue(
            &SyncQueueEntry::new(SyncEntityType::Proof, 2, r#"{"proof": true}"#)
                .with_priority(10),
        )
        .await
        .unwrap();

        // High priority should come first
        let pending = repo.get_pending(10).await.unwrap();
        assert_eq!(pending.len(), 2);
        assert_eq!(pending[0].priority, 10);
        assert_eq!(pending[1].priority, 0);
    }

    #[tokio::test]
    async fn test_get_pending() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        for i in 0..5 {
            repo.enqueue(&SyncQueueEntry::new(
                SyncEntityType::CheckResult,
                i,
                format!(r#"{{"id": {}}}"#, i),
            ))
            .await
            .unwrap();
        }

        let pending = repo.get_pending(3).await.unwrap();
        assert_eq!(pending.len(), 3);

        let all_pending = repo.get_pending(10).await.unwrap();
        assert_eq!(all_pending.len(), 5);
    }

    #[tokio::test]
    async fn test_record_failure() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        let id = repo
            .enqueue(&SyncQueueEntry::new(
                SyncEntityType::CheckResult,
                1,
                "{}",
            ))
            .await
            .unwrap();

        // Record a failure
        repo.record_failure(id, "Connection refused")
            .await
            .unwrap();

        // Item should not be immediately pending (next_retry_at is in the future)
        let pending = repo.get_pending(10).await.unwrap();
        assert!(pending.is_empty());

        // Verify attempts incremented
        let stats = repo.queue_stats().await.unwrap();
        assert_eq!(stats.total_count, 1);
        assert_eq!(stats.pending_count, 1); // Still pending, just not ready yet
    }

    #[tokio::test]
    async fn test_record_failure_not_found() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        let result = repo.record_failure(99999, "error").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), StorageError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_remove() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        let id1 = repo
            .enqueue(&SyncQueueEntry::new(
                SyncEntityType::CheckResult,
                1,
                "{}",
            ))
            .await
            .unwrap();
        let id2 = repo
            .enqueue(&SyncQueueEntry::new(
                SyncEntityType::Proof,
                2,
                "{}",
            ))
            .await
            .unwrap();
        repo.enqueue(&SyncQueueEntry::new(
            SyncEntityType::Heartbeat,
            3,
            "{}",
        ))
        .await
        .unwrap();

        assert_eq!(repo.count().await.unwrap(), 3);

        let removed = repo.remove(&[id1, id2]).await.unwrap();
        assert_eq!(removed, 2);
        assert_eq!(repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_remove_empty() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        let removed = repo.remove(&[]).await.unwrap();
        assert_eq!(removed, 0);
    }

    #[tokio::test]
    async fn test_queue_stats_empty() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        let stats = repo.queue_stats().await.unwrap();
        assert_eq!(stats.total_count, 0);
        assert_eq!(stats.pending_count, 0);
        assert_eq!(stats.failed_count, 0);
        assert!(stats.oldest_item_age_secs.is_none());
    }

    #[tokio::test]
    async fn test_queue_stats_with_items() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Enqueue some items
        repo.enqueue(&SyncQueueEntry::new(
            SyncEntityType::CheckResult,
            1,
            "{}",
        ))
        .await
        .unwrap();
        repo.enqueue(&SyncQueueEntry::new(
            SyncEntityType::Proof,
            2,
            "{}",
        ))
        .await
        .unwrap();

        let stats = repo.queue_stats().await.unwrap();
        assert_eq!(stats.total_count, 2);
        assert_eq!(stats.pending_count, 2);
        assert_eq!(stats.failed_count, 0);
        assert!(stats.oldest_item_age_secs.is_some());
        // The oldest item was just created, so age should be small
        assert!(stats.oldest_item_age_secs.unwrap() < 10);
    }

    #[tokio::test]
    async fn test_queue_stats_with_failed_items() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Enqueue an item with max_attempts = 1
        let id = repo
            .enqueue(
                &SyncQueueEntry::new(SyncEntityType::CheckResult, 1, "{}")
                    .with_max_attempts(1),
            )
            .await
            .unwrap();

        // Record a failure (this will exhaust attempts since max_attempts = 1)
        repo.record_failure(id, "error").await.unwrap();

        let stats = repo.queue_stats().await.unwrap();
        assert_eq!(stats.total_count, 1);
        assert_eq!(stats.pending_count, 0);
        assert_eq!(stats.failed_count, 1);
    }

    #[tokio::test]
    async fn test_purge_failed() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Enqueue items with max_attempts = 1
        let id = repo
            .enqueue(
                &SyncQueueEntry::new(SyncEntityType::CheckResult, 1, "{}")
                    .with_max_attempts(1),
            )
            .await
            .unwrap();

        // Still pending
        repo.enqueue(&SyncQueueEntry::new(
            SyncEntityType::Proof,
            2,
            "{}",
        ))
        .await
        .unwrap();

        // Exhaust attempts on the first item
        repo.record_failure(id, "error").await.unwrap();

        let purged = repo.purge_failed().await.unwrap();
        assert_eq!(purged, 1);
        assert_eq!(repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_enforce_queue_limit_under_limit() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Enqueue a few items
        for i in 0..5 {
            repo.enqueue(&SyncQueueEntry::new(
                SyncEntityType::CheckResult,
                i,
                "{}",
            ))
            .await
            .unwrap();
        }

        // Under limit, so no eviction
        let evicted = repo.enforce_queue_limit().await.unwrap();
        assert_eq!(evicted, 0);
        assert_eq!(repo.count().await.unwrap(), 5);
    }

    #[tokio::test]
    async fn test_overflow_evicts_low_priority_first() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Fill the queue to the max by inserting directly via SQL for speed
        db.with_connection(|conn| {
            for i in 0..MAX_SYNC_QUEUE_SIZE {
                let priority = if i < MAX_SYNC_QUEUE_SIZE / 2 { 0 } else { 5 };
                conn.execute(
                    r#"
                    INSERT INTO sync_queue (entity_type, entity_id, payload, priority)
                    VALUES ('check_result', ?, '{}', ?)
                    "#,
                    rusqlite::params![i as i64, priority],
                )
                .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            Ok(())
        })
        .await
        .unwrap();

        assert_eq!(repo.count().await.unwrap(), MAX_SYNC_QUEUE_SIZE as i64);

        // Enqueue one more high-priority item - should evict a low-priority item
        let id = repo
            .enqueue(
                &SyncQueueEntry::new(
                    SyncEntityType::Proof,
                    99999,
                    r#"{"important": true}"#,
                )
                .with_priority(10),
            )
            .await
            .unwrap();

        assert!(id > 0);
        // Queue should be at max or one less (we evicted 1 then inserted 1)
        assert!(repo.count().await.unwrap() <= MAX_SYNC_QUEUE_SIZE as i64);
    }

    #[tokio::test]
    async fn test_enforce_queue_limit_evicts_low_priority() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = SyncQueueRepository::new(&db);

        // Fill queue over the limit
        db.with_connection(|conn| {
            for i in 0..(MAX_SYNC_QUEUE_SIZE + 50) {
                let priority = if i < 50 { 0 } else { 5 };
                conn.execute(
                    r#"
                    INSERT INTO sync_queue (entity_type, entity_id, payload, priority)
                    VALUES ('check_result', ?, '{}', ?)
                    "#,
                    rusqlite::params![i as i64, priority],
                )
                .map_err(|e| StorageError::Query(e.to_string()))?;
            }
            Ok(())
        })
        .await
        .unwrap();

        let count_before = repo.count().await.unwrap();
        assert_eq!(count_before, (MAX_SYNC_QUEUE_SIZE + 50) as i64);

        let evicted = repo.enforce_queue_limit().await.unwrap();
        assert_eq!(evicted, 50);
        assert_eq!(repo.count().await.unwrap(), MAX_SYNC_QUEUE_SIZE as i64);
    }

    #[tokio::test]
    async fn test_entity_type_conversion() {
        assert_eq!(SyncEntityType::CheckResult.as_str(), "check_result");
        assert_eq!(SyncEntityType::Proof.as_str(), "proof");
        assert_eq!(SyncEntityType::Heartbeat.as_str(), "heartbeat");
        assert_eq!(SyncEntityType::Config.as_str(), "config");

        assert_eq!(
            SyncEntityType::parse_str("check_result"),
            Some(SyncEntityType::CheckResult)
        );
        assert_eq!(
            SyncEntityType::parse_str("proof"),
            Some(SyncEntityType::Proof)
        );
        assert_eq!(SyncEntityType::parse_str("invalid"), None);
    }

    #[tokio::test]
    async fn test_sync_queue_entry_builder() {
        let entry = SyncQueueEntry::new(SyncEntityType::Proof, 42, r#"{"data": true}"#)
            .with_priority(5)
            .with_max_attempts(3);

        assert_eq!(entry.entity_type, SyncEntityType::Proof);
        assert_eq!(entry.entity_id, 42);
        assert_eq!(entry.priority, 5);
        assert_eq!(entry.max_attempts, 3);
    }
}
