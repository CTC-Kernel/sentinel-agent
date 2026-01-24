//! Data retention policy implementation.
//!
//! This module implements the 12-month data retention policy (NFR-C2):
//! - Proofs older than retention period are deleted
//! - Associated check results are cleaned up
//! - Sync queue entries for deleted data are removed
//! - Storage statistics are reported after cleanup

use crate::Database;
use crate::error::{StorageError, StorageResult};
use agent_common::constants::PROOF_RETENTION_DAYS;
use chrono::{DateTime, Duration, Utc};
use tracing::info;

/// Default retention period in days (12 months).
pub const DEFAULT_RETENTION_DAYS: i64 = PROOF_RETENTION_DAYS as i64;

/// Result of a retention policy execution.
#[derive(Debug, Clone)]
pub struct RetentionResult {
    /// Number of proofs deleted.
    pub proofs_deleted: usize,
    /// Number of check results deleted.
    pub check_results_deleted: usize,
    /// Number of sync queue entries deleted.
    pub sync_queue_deleted: usize,
    /// Cutoff date used for deletion.
    pub cutoff_date: DateTime<Utc>,
    /// Oldest remaining proof date (if any).
    pub oldest_remaining: Option<DateTime<Utc>>,
    /// Newest proof date (if any).
    pub newest_proof: Option<DateTime<Utc>>,
    /// Total proofs remaining after cleanup.
    pub total_proofs_remaining: i64,
    /// Total check results remaining after cleanup.
    pub total_results_remaining: i64,
    /// Execution duration in milliseconds.
    pub duration_ms: u64,
}

impl RetentionResult {
    /// Check if any data was deleted.
    pub fn had_deletions(&self) -> bool {
        self.proofs_deleted > 0 || self.check_results_deleted > 0 || self.sync_queue_deleted > 0
    }

    /// Get total items deleted.
    pub fn total_deleted(&self) -> usize {
        self.proofs_deleted + self.check_results_deleted + self.sync_queue_deleted
    }
}

/// Configuration for the retention policy.
#[derive(Debug, Clone)]
pub struct RetentionConfig {
    /// Retention period in days.
    pub retention_days: i64,
    /// Whether to delete orphaned check results (results with no proofs).
    pub delete_orphaned_results: bool,
    /// Whether to run in dry-run mode (report without deleting).
    pub dry_run: bool,
}

impl Default for RetentionConfig {
    fn default() -> Self {
        Self {
            retention_days: DEFAULT_RETENTION_DAYS,
            delete_orphaned_results: true,
            dry_run: false,
        }
    }
}

/// Minimum allowed retention period in days.
const MIN_RETENTION_DAYS: i64 = 1;

/// Maximum allowed retention period in days (10 years).
const MAX_RETENTION_DAYS: i64 = 3650;

impl RetentionConfig {
    /// Create a new config with custom retention period.
    ///
    /// # Panics
    ///
    /// Panics if `days` is less than 1 or greater than 3650 (10 years).
    /// Use `try_with_retention_days` for non-panicking version.
    pub fn with_retention_days(days: i64) -> Self {
        if days < MIN_RETENTION_DAYS {
            panic!(
                "Retention period must be at least {} day(s), got {}. This protects against accidental data deletion.",
                MIN_RETENTION_DAYS, days
            );
        }
        if days > MAX_RETENTION_DAYS {
            panic!(
                "Retention period must be at most {} days (10 years), got {}.",
                MAX_RETENTION_DAYS, days
            );
        }
        Self {
            retention_days: days,
            ..Default::default()
        }
    }

    /// Create a new config with custom retention period, returning error on invalid input.
    pub fn try_with_retention_days(days: i64) -> Result<Self, String> {
        if days < MIN_RETENTION_DAYS {
            return Err(format!(
                "Retention period must be at least {} day(s), got {}",
                MIN_RETENTION_DAYS, days
            ));
        }
        if days > MAX_RETENTION_DAYS {
            return Err(format!(
                "Retention period must be at most {} days (10 years), got {}",
                MAX_RETENTION_DAYS, days
            ));
        }
        Ok(Self {
            retention_days: days,
            ..Default::default()
        })
    }

    /// Enable dry-run mode.
    pub fn dry_run(mut self) -> Self {
        self.dry_run = true;
        self
    }

    /// Disable orphaned results cleanup.
    pub fn keep_orphaned_results(mut self) -> Self {
        self.delete_orphaned_results = false;
        self
    }
}

/// Data retention policy manager.
pub struct RetentionPolicy<'a> {
    db: &'a Database,
    config: RetentionConfig,
}

impl<'a> RetentionPolicy<'a> {
    /// Create a new retention policy with default configuration.
    pub fn new(db: &'a Database) -> Self {
        Self {
            db,
            config: RetentionConfig::default(),
        }
    }

    /// Create a new retention policy with custom configuration.
    pub fn with_config(db: &'a Database, config: RetentionConfig) -> Self {
        Self { db, config }
    }

    /// Execute the retention policy.
    ///
    /// This will:
    /// 1. Delete proofs older than the retention period
    /// 2. Delete check results that have no remaining proofs (if enabled)
    /// 3. Delete sync queue entries for deleted entities
    /// 4. Return statistics about the cleanup
    pub async fn execute(&self) -> StorageResult<RetentionResult> {
        let start = std::time::Instant::now();
        let cutoff_date = Utc::now() - Duration::days(self.config.retention_days);

        info!(
            "Executing retention policy: deleting data older than {} (retention: {} days, dry_run: {})",
            cutoff_date.to_rfc3339(),
            self.config.retention_days,
            self.config.dry_run
        );

        if self.config.dry_run {
            return self.execute_dry_run(cutoff_date, start).await;
        }

        let cutoff_str = cutoff_date.to_rfc3339();
        let delete_orphaned = self.config.delete_orphaned_results;

        self.db
            .with_connection_mut(move |conn| {
                // Start transaction for atomic cleanup
                let tx = conn.transaction().map_err(|e| {
                    StorageError::Query(format!("Failed to start retention transaction: {}", e))
                })?;

                // Step 1: Get IDs of proofs to delete (for sync queue cleanup)
                let proof_ids: Vec<i64> = {
                    let mut stmt = tx
                        .prepare("SELECT id FROM proofs WHERE created_at < ?")
                        .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                    stmt.query_map([&cutoff_str], |row| row.get(0))
                        .map_err(|e| StorageError::Query(format!("Failed to query proofs: {}", e)))?
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| StorageError::Query(format!("Failed to collect proof IDs: {}", e)))?
                };

                // Step 2: Get IDs of check results that will be orphaned
                let orphaned_result_ids: Vec<i64> = if delete_orphaned {
                    let mut stmt = tx
                        .prepare(
                            r#"
                            SELECT DISTINCT cr.id
                            FROM check_results cr
                            INNER JOIN proofs p ON p.check_result_id = cr.id
                            WHERE p.created_at < ?
                            AND NOT EXISTS (
                                SELECT 1 FROM proofs p2
                                WHERE p2.check_result_id = cr.id
                                AND p2.created_at >= ?
                            )
                            "#,
                        )
                        .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                    stmt.query_map([&cutoff_str, &cutoff_str], |row| row.get(0))
                        .map_err(|e| StorageError::Query(format!("Failed to query orphaned results: {}", e)))?
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| StorageError::Query(format!("Failed to collect result IDs: {}", e)))?
                } else {
                    Vec::new()
                };

                // Step 3: Delete sync queue entries for proofs being deleted
                let sync_queue_deleted = if !proof_ids.is_empty() {
                    let placeholders: String = proof_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    let sql = format!(
                        "DELETE FROM sync_queue WHERE entity_type = 'proof' AND entity_id IN ({})",
                        placeholders
                    );
                    let params: Vec<&dyn rusqlite::ToSql> = proof_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
                    tx.execute(&sql, params.as_slice())
                        .map_err(|e| StorageError::Query(format!("Failed to delete sync queue (proofs): {}", e)))?
                } else {
                    0
                };

                // Step 4: Delete sync queue entries for check results being deleted
                let sync_queue_deleted = if delete_orphaned && !orphaned_result_ids.is_empty() {
                    let placeholders: String = orphaned_result_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    let sql = format!(
                        "DELETE FROM sync_queue WHERE entity_type = 'check_result' AND entity_id IN ({})",
                        placeholders
                    );
                    let params: Vec<&dyn rusqlite::ToSql> = orphaned_result_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
                    sync_queue_deleted + tx.execute(&sql, params.as_slice())
                        .map_err(|e| StorageError::Query(format!("Failed to delete sync queue (results): {}", e)))?
                } else {
                    sync_queue_deleted
                };

                // Step 5: Delete old proofs
                let proofs_deleted = tx
                    .execute("DELETE FROM proofs WHERE created_at < ?", [&cutoff_str])
                    .map_err(|e| StorageError::Query(format!("Failed to delete proofs: {}", e)))?;

                // Step 6: Delete orphaned check results (cascade will handle proofs)
                let check_results_deleted = if delete_orphaned && !orphaned_result_ids.is_empty() {
                    let placeholders: String = orphaned_result_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    let sql = format!("DELETE FROM check_results WHERE id IN ({})", placeholders);
                    let params: Vec<&dyn rusqlite::ToSql> = orphaned_result_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
                    tx.execute(&sql, params.as_slice())
                        .map_err(|e| StorageError::Query(format!("Failed to delete check results: {}", e)))?
                } else {
                    0
                };

                // Step 7: Get remaining statistics
                let total_proofs_remaining: i64 = tx
                    .query_row("SELECT COUNT(*) FROM proofs", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count proofs: {}", e)))?;

                let total_results_remaining: i64 = tx
                    .query_row("SELECT COUNT(*) FROM check_results", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count results: {}", e)))?;

                let oldest_remaining: Option<String> = tx
                    .query_row("SELECT MIN(created_at) FROM proofs", [], |row| row.get(0))
                    .ok();

                let newest_proof: Option<String> = tx
                    .query_row("SELECT MAX(created_at) FROM proofs", [], |row| row.get(0))
                    .ok();

                // Commit transaction
                tx.commit().map_err(|e| {
                    StorageError::Query(format!("Failed to commit retention transaction: {}", e))
                })?;

                let duration_ms = start.elapsed().as_millis() as u64;

                let oldest_remaining = oldest_remaining.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                let newest_proof = newest_proof.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                info!(
                    "Retention policy complete: deleted {} proofs, {} check results, {} sync queue entries in {}ms",
                    proofs_deleted, check_results_deleted, sync_queue_deleted, duration_ms
                );

                Ok(RetentionResult {
                    proofs_deleted,
                    check_results_deleted,
                    sync_queue_deleted,
                    cutoff_date,
                    oldest_remaining,
                    newest_proof,
                    total_proofs_remaining,
                    total_results_remaining,
                    duration_ms,
                })
            })
            .await
    }

    /// Execute in dry-run mode (report without deleting).
    async fn execute_dry_run(
        &self,
        cutoff_date: DateTime<Utc>,
        start: std::time::Instant,
    ) -> StorageResult<RetentionResult> {
        let cutoff_str = cutoff_date.to_rfc3339();
        let delete_orphaned = self.config.delete_orphaned_results;

        self.db
            .with_connection(move |conn| {
                // Count proofs that would be deleted
                let proofs_deleted: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM proofs WHERE created_at < ?",
                        [&cutoff_str],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to count proofs: {}", e)))?;

                // Count check results that would be orphaned
                let check_results_deleted: i64 = if delete_orphaned {
                    conn.query_row(
                        r#"
                        SELECT COUNT(DISTINCT cr.id)
                        FROM check_results cr
                        INNER JOIN proofs p ON p.check_result_id = cr.id
                        WHERE p.created_at < ?
                        AND NOT EXISTS (
                            SELECT 1 FROM proofs p2
                            WHERE p2.check_result_id = cr.id
                            AND p2.created_at >= ?
                        )
                        "#,
                        [&cutoff_str, &cutoff_str],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to count orphaned results: {}", e)))?
                } else {
                    0
                };

                // Count sync queue entries that would be deleted
                let sync_queue_deleted: i64 = conn
                    .query_row(
                        r#"
                        SELECT COUNT(*) FROM sync_queue sq
                        WHERE (sq.entity_type = 'proof' AND sq.entity_id IN (
                            SELECT id FROM proofs WHERE created_at < ?
                        ))
                        "#,
                        [&cutoff_str],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);

                // Get current statistics
                let total_proofs_remaining: i64 = conn
                    .query_row("SELECT COUNT(*) FROM proofs WHERE created_at >= ?", [&cutoff_str], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count remaining proofs: {}", e)))?;

                let total_results_remaining: i64 = conn
                    .query_row("SELECT COUNT(*) FROM check_results", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count results: {}", e)))?;

                let oldest_remaining: Option<String> = conn
                    .query_row(
                        "SELECT MIN(created_at) FROM proofs WHERE created_at >= ?",
                        [&cutoff_str],
                        |row| row.get(0),
                    )
                    .ok();

                let newest_proof: Option<String> = conn
                    .query_row("SELECT MAX(created_at) FROM proofs", [], |row| row.get(0))
                    .ok();

                let duration_ms = start.elapsed().as_millis() as u64;

                let oldest_remaining = oldest_remaining.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                let newest_proof = newest_proof.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                info!(
                    "Retention policy DRY RUN: would delete {} proofs, {} check results, {} sync queue entries",
                    proofs_deleted, check_results_deleted, sync_queue_deleted
                );

                Ok(RetentionResult {
                    proofs_deleted: proofs_deleted as usize,
                    check_results_deleted: check_results_deleted as usize,
                    sync_queue_deleted: sync_queue_deleted as usize,
                    cutoff_date,
                    oldest_remaining,
                    newest_proof,
                    total_proofs_remaining,
                    total_results_remaining: total_results_remaining - check_results_deleted,
                    duration_ms,
                })
            })
            .await
    }

    /// Get storage statistics without executing retention.
    pub async fn get_storage_stats(&self) -> StorageResult<StorageStats> {
        self.db
            .with_connection(|conn| {
                let proof_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM proofs", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count proofs: {}", e)))?;

                let proof_data_bytes: i64 = conn
                    .query_row(
                        "SELECT COALESCE(SUM(LENGTH(data)), 0) FROM proofs",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to sum proof data: {}", e)))?;

                let result_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM check_results", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count results: {}", e)))?;

                let sync_queue_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0))
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count sync queue: {}", e))
                    })?;

                let oldest_proof: Option<String> = conn
                    .query_row("SELECT MIN(created_at) FROM proofs", [], |row| row.get(0))
                    .ok();

                let newest_proof: Option<String> = conn
                    .query_row("SELECT MAX(created_at) FROM proofs", [], |row| row.get(0))
                    .ok();

                let oldest_proof = oldest_proof.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                let newest_proof = newest_proof.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                Ok(StorageStats {
                    proof_count,
                    proof_data_bytes,
                    result_count,
                    sync_queue_count,
                    oldest_proof,
                    newest_proof,
                })
            })
            .await
    }
}

/// Storage statistics.
#[derive(Debug, Clone)]
pub struct StorageStats {
    /// Total number of proofs.
    pub proof_count: i64,
    /// Total size of proof data in bytes.
    pub proof_data_bytes: i64,
    /// Total number of check results.
    pub result_count: i64,
    /// Total number of sync queue entries.
    pub sync_queue_count: i64,
    /// Timestamp of oldest proof.
    pub oldest_proof: Option<DateTime<Utc>>,
    /// Timestamp of newest proof.
    pub newest_proof: Option<DateTime<Utc>>,
}

impl StorageStats {
    /// Get proof data size in human-readable format.
    pub fn proof_data_human(&self) -> String {
        let bytes = self.proof_data_bytes as f64;
        if bytes < 1024.0 {
            format!("{} B", bytes as i64)
        } else if bytes < 1024.0 * 1024.0 {
            format!("{:.1} KB", bytes / 1024.0)
        } else if bytes < 1024.0 * 1024.0 * 1024.0 {
            format!("{:.1} MB", bytes / (1024.0 * 1024.0))
        } else {
            format!("{:.2} GB", bytes / (1024.0 * 1024.0 * 1024.0))
        }
    }

    /// Calculate data span in days.
    pub fn data_span_days(&self) -> Option<i64> {
        match (self.oldest_proof, self.newest_proof) {
            (Some(oldest), Some(newest)) => Some((newest - oldest).num_days()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::check_results::{CheckResult, CheckStatus};
    use crate::repositories::proofs::Proof;
    use crate::repositories::{CheckResultsRepository, ProofsRepository};
    use crate::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        // Insert a test rule
        db.with_connection(|conn| {
            conn.execute(
                r#"INSERT INTO check_rules (id, name, category, severity, check_type, version)
                   VALUES ('test_rule', 'Test Rule', 'security', 'high', 'test', '1.0')"#,
                [],
            )
            .map_err(|e| StorageError::Query(e.to_string()))?;
            Ok(())
        })
        .await
        .unwrap();

        (temp_dir, db)
    }

    async fn insert_test_data(db: &Database, days_ago: i64) -> (i64, i64) {
        let results_repo = CheckResultsRepository::new(db);
        let proofs_repo = ProofsRepository::new(db);

        let timestamp = Utc::now() - Duration::days(days_ago);

        let result = CheckResult::new("test_rule", CheckStatus::Pass).with_executed_at(timestamp);
        let result_id = results_repo.insert(&result).await.unwrap();

        let proof = Proof::with_timestamp(result_id, r#"{"test": true}"#, timestamp);
        let proof_id = proofs_repo.insert(&proof).await.unwrap();

        (result_id, proof_id)
    }

    #[tokio::test]
    async fn test_retention_deletes_old_data() {
        let (_temp_dir, db) = create_test_db().await;

        // Insert old data (400 days ago)
        insert_test_data(&db, 400).await;

        // Insert recent data (10 days ago)
        insert_test_data(&db, 10).await;

        let proofs_repo = ProofsRepository::new(&db);
        assert_eq!(proofs_repo.count().await.unwrap(), 2);

        // Execute retention with 365 days
        let config = RetentionConfig::with_retention_days(365);
        let policy = RetentionPolicy::with_config(&db, config);
        let result = policy.execute().await.unwrap();

        assert_eq!(result.proofs_deleted, 1);
        assert_eq!(result.check_results_deleted, 1);
        assert_eq!(proofs_repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_retention_dry_run() {
        let (_temp_dir, db) = create_test_db().await;

        // Insert old data
        insert_test_data(&db, 400).await;
        insert_test_data(&db, 10).await;

        let proofs_repo = ProofsRepository::new(&db);
        assert_eq!(proofs_repo.count().await.unwrap(), 2);

        // Execute dry run
        let config = RetentionConfig::with_retention_days(365).dry_run();
        let policy = RetentionPolicy::with_config(&db, config);
        let result = policy.execute().await.unwrap();

        // Should report deletions but not actually delete
        assert_eq!(result.proofs_deleted, 1);
        assert_eq!(proofs_repo.count().await.unwrap(), 2); // Still 2!
    }

    #[tokio::test]
    async fn test_retention_keeps_recent_data() {
        let (_temp_dir, db) = create_test_db().await;

        // Insert only recent data
        insert_test_data(&db, 10).await;
        insert_test_data(&db, 30).await;

        let proofs_repo = ProofsRepository::new(&db);
        assert_eq!(proofs_repo.count().await.unwrap(), 2);

        // Execute retention
        let config = RetentionConfig::with_retention_days(365);
        let policy = RetentionPolicy::with_config(&db, config);
        let result = policy.execute().await.unwrap();

        assert_eq!(result.proofs_deleted, 0);
        assert_eq!(result.check_results_deleted, 0);
        assert_eq!(proofs_repo.count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_retention_result_methods() {
        let result = RetentionResult {
            proofs_deleted: 5,
            check_results_deleted: 3,
            sync_queue_deleted: 2,
            cutoff_date: Utc::now(),
            oldest_remaining: None,
            newest_proof: None,
            total_proofs_remaining: 10,
            total_results_remaining: 10,
            duration_ms: 100,
        };

        assert!(result.had_deletions());
        assert_eq!(result.total_deleted(), 10);
    }

    #[tokio::test]
    async fn test_retention_no_deletions() {
        let result = RetentionResult {
            proofs_deleted: 0,
            check_results_deleted: 0,
            sync_queue_deleted: 0,
            cutoff_date: Utc::now(),
            oldest_remaining: None,
            newest_proof: None,
            total_proofs_remaining: 10,
            total_results_remaining: 10,
            duration_ms: 50,
        };

        assert!(!result.had_deletions());
        assert_eq!(result.total_deleted(), 0);
    }

    #[tokio::test]
    async fn test_storage_stats() {
        let (_temp_dir, db) = create_test_db().await;

        insert_test_data(&db, 10).await;
        insert_test_data(&db, 20).await;

        let policy = RetentionPolicy::new(&db);
        let stats = policy.get_storage_stats().await.unwrap();

        assert_eq!(stats.proof_count, 2);
        assert_eq!(stats.result_count, 2);
        assert!(stats.proof_data_bytes > 0);
        assert!(stats.oldest_proof.is_some());
        assert!(stats.newest_proof.is_some());
    }

    #[tokio::test]
    async fn test_storage_stats_human_readable() {
        let stats = StorageStats {
            proof_count: 100,
            proof_data_bytes: 1024 * 1024 * 5, // 5 MB
            result_count: 100,
            sync_queue_count: 10,
            oldest_proof: None,
            newest_proof: None,
        };

        assert_eq!(stats.proof_data_human(), "5.0 MB");

        let small_stats = StorageStats {
            proof_data_bytes: 512,
            ..stats.clone()
        };
        assert_eq!(small_stats.proof_data_human(), "512 B");

        let kb_stats = StorageStats {
            proof_data_bytes: 2048,
            ..stats.clone()
        };
        assert_eq!(kb_stats.proof_data_human(), "2.0 KB");
    }

    #[tokio::test]
    async fn test_data_span_days() {
        let now = Utc::now();
        let thirty_days_ago = now - Duration::days(30);

        let stats = StorageStats {
            proof_count: 100,
            proof_data_bytes: 1000,
            result_count: 100,
            sync_queue_count: 0,
            oldest_proof: Some(thirty_days_ago),
            newest_proof: Some(now),
        };

        assert_eq!(stats.data_span_days(), Some(30));

        let empty_stats = StorageStats {
            oldest_proof: None,
            newest_proof: None,
            ..stats
        };
        assert_eq!(empty_stats.data_span_days(), None);
    }

    #[tokio::test]
    async fn test_retention_config_builder() {
        let config = RetentionConfig::with_retention_days(180)
            .dry_run()
            .keep_orphaned_results();

        assert_eq!(config.retention_days, 180);
        assert!(config.dry_run);
        assert!(!config.delete_orphaned_results);
    }

    #[tokio::test]
    async fn test_default_retention_period() {
        assert_eq!(DEFAULT_RETENTION_DAYS, 365);

        let config = RetentionConfig::default();
        assert_eq!(config.retention_days, 365);
    }

    #[tokio::test]
    async fn test_keep_orphaned_results() {
        let (_temp_dir, db) = create_test_db().await;

        // Insert old data
        insert_test_data(&db, 400).await;

        let results_repo = CheckResultsRepository::new(&db);
        assert_eq!(results_repo.count().await.unwrap(), 1);

        // Execute retention but keep orphaned results
        let config = RetentionConfig::with_retention_days(365).keep_orphaned_results();
        let policy = RetentionPolicy::with_config(&db, config);
        let result = policy.execute().await.unwrap();

        // Proof deleted but result kept
        assert_eq!(result.proofs_deleted, 1);
        assert_eq!(result.check_results_deleted, 0);
        assert_eq!(results_repo.count().await.unwrap(), 1);
    }
}
