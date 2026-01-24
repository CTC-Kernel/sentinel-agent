//! Check results repository for storing compliance check execution results.
//!
//! This module provides CRUD operations for check results with support for:
//! - Storing results with full context (status, score, raw_data)
//! - ISO 8601 UTC timestamps
//! - Query by date range and check type
//! - Concurrent write safety via WAL mode

use crate::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// Status of a compliance check execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    /// Check passed - endpoint is compliant
    Pass,
    /// Check failed - endpoint is non-compliant
    Fail,
    /// Check encountered an error during execution
    Error,
    /// Check was skipped (e.g., disabled or prerequisites not met)
    Skip,
    /// Check is not applicable to this endpoint
    NotApplicable,
}

impl CheckStatus {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            CheckStatus::Pass => "pass",
            CheckStatus::Fail => "fail",
            CheckStatus::Error => "error",
            CheckStatus::Skip => "skip",
            CheckStatus::NotApplicable => "not_applicable",
        }
    }

    /// Parse from database string representation.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "pass" => Some(CheckStatus::Pass),
            "fail" => Some(CheckStatus::Fail),
            "error" => Some(CheckStatus::Error),
            "skip" => Some(CheckStatus::Skip),
            "not_applicable" => Some(CheckStatus::NotApplicable),
            _ => None,
        }
    }
}

/// A compliance check result record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    /// Unique identifier (auto-generated).
    pub id: Option<i64>,
    /// Reference to the check rule that was executed.
    pub check_rule_id: String,
    /// Result status.
    pub status: CheckStatus,
    /// Compliance score (0-100), if applicable.
    pub score: Option<i32>,
    /// Human-readable result message.
    pub message: Option<String>,
    /// Raw check output data as JSON.
    pub raw_data: Option<String>,
    /// Timestamp of execution (ISO 8601 UTC).
    pub executed_at: DateTime<Utc>,
    /// Execution duration in milliseconds.
    pub duration_ms: Option<i64>,
    /// Whether this result has been synced to SaaS.
    pub synced: bool,
}

impl CheckResult {
    /// Create a new check result with current timestamp.
    pub fn new(check_rule_id: impl Into<String>, status: CheckStatus) -> Self {
        Self {
            id: None,
            check_rule_id: check_rule_id.into(),
            status,
            score: None,
            message: None,
            raw_data: None,
            executed_at: Utc::now(),
            duration_ms: None,
            synced: false,
        }
    }

    /// Set the compliance score.
    pub fn with_score(mut self, score: i32) -> Self {
        self.score = Some(score.clamp(0, 100));
        self
    }

    /// Set the result message.
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    /// Set the raw data JSON.
    pub fn with_raw_data(mut self, raw_data: impl Into<String>) -> Self {
        self.raw_data = Some(raw_data.into());
        self
    }

    /// Set the execution duration.
    pub fn with_duration_ms(mut self, duration_ms: i64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// Set the execution timestamp.
    pub fn with_executed_at(mut self, executed_at: DateTime<Utc>) -> Self {
        self.executed_at = executed_at;
        self
    }
}

/// Query options for filtering check results.
#[derive(Debug, Default)]
pub struct CheckResultQuery {
    /// Filter by check rule ID.
    pub check_rule_id: Option<String>,
    /// Filter by status.
    pub status: Option<CheckStatus>,
    /// Filter by minimum timestamp (inclusive).
    pub from_date: Option<DateTime<Utc>>,
    /// Filter by maximum timestamp (inclusive).
    pub to_date: Option<DateTime<Utc>>,
    /// Filter by sync status.
    pub synced: Option<bool>,
    /// Maximum number of results to return.
    pub limit: Option<i64>,
    /// Offset for pagination.
    pub offset: Option<i64>,
}

impl CheckResultQuery {
    /// Create a new empty query.
    pub fn new() -> Self {
        Self::default()
    }

    /// Filter by check rule ID.
    pub fn with_check_rule_id(mut self, id: impl Into<String>) -> Self {
        self.check_rule_id = Some(id.into());
        self
    }

    /// Filter by status.
    pub fn with_status(mut self, status: CheckStatus) -> Self {
        self.status = Some(status);
        self
    }

    /// Filter by date range.
    pub fn with_date_range(mut self, from: DateTime<Utc>, to: DateTime<Utc>) -> Self {
        self.from_date = Some(from);
        self.to_date = Some(to);
        self
    }

    /// Filter by sync status.
    pub fn with_synced(mut self, synced: bool) -> Self {
        self.synced = Some(synced);
        self
    }

    /// Limit number of results.
    pub fn with_limit(mut self, limit: i64) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Set pagination offset.
    pub fn with_offset(mut self, offset: i64) -> Self {
        self.offset = Some(offset);
        self
    }
}

/// Repository for check results CRUD operations.
pub struct CheckResultsRepository<'a> {
    db: &'a Database,
}

impl<'a> CheckResultsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Insert a new check result.
    ///
    /// Returns the ID of the inserted record.
    pub async fn insert(&self, result: &CheckResult) -> StorageResult<i64> {
        let check_rule_id = result.check_rule_id.clone();
        let status = result.status.as_str().to_string();
        let score = result.score;
        let message = result.message.clone();
        let raw_data = result.raw_data.clone();
        let executed_at = result.executed_at.to_rfc3339();
        let duration_ms = result.duration_ms;
        let synced = if result.synced { 1 } else { 0 };

        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                    INSERT INTO check_results
                    (check_rule_id, status, score, message, raw_data, executed_at, duration_ms, synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![
                        check_rule_id,
                        status,
                        score,
                        message,
                        raw_data,
                        executed_at,
                        duration_ms,
                        synced
                    ],
                )
                .map_err(|e| StorageError::Query(format!("Failed to insert check result: {}", e)))?;

                let id = conn.last_insert_rowid();
                debug!("Inserted check result with ID: {}", id);
                Ok(id)
            })
            .await
    }

    /// Get a check result by ID.
    pub async fn get(&self, id: i64) -> StorageResult<Option<CheckResult>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, check_rule_id, status, score, message, raw_data,
                               executed_at, duration_ms, synced
                        FROM check_results
                        WHERE id = ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let result = stmt
                    .query_row([id], Self::row_to_check_result)
                    .optional()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to query check result: {}", e))
                    })?;

                Ok(result)
            })
            .await
    }

    /// Query check results with filters.
    pub async fn query(&self, query: CheckResultQuery) -> StorageResult<Vec<CheckResult>> {
        self.db
            .with_connection(move |conn| {
                let mut sql = String::from(
                    r#"
                    SELECT id, check_rule_id, status, score, message, raw_data,
                           executed_at, duration_ms, synced
                    FROM check_results
                    WHERE 1=1
                    "#,
                );

                let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

                if let Some(ref rule_id) = query.check_rule_id {
                    sql.push_str(" AND check_rule_id = ?");
                    params.push(Box::new(rule_id.clone()));
                }

                if let Some(status) = query.status {
                    sql.push_str(" AND status = ?");
                    params.push(Box::new(status.as_str().to_string()));
                }

                if let Some(from_date) = query.from_date {
                    sql.push_str(" AND executed_at >= ?");
                    params.push(Box::new(from_date.to_rfc3339()));
                }

                if let Some(to_date) = query.to_date {
                    sql.push_str(" AND executed_at <= ?");
                    params.push(Box::new(to_date.to_rfc3339()));
                }

                if let Some(synced) = query.synced {
                    sql.push_str(" AND synced = ?");
                    params.push(Box::new(if synced { 1i32 } else { 0i32 }));
                }

                sql.push_str(" ORDER BY executed_at DESC");

                if let Some(limit) = query.limit {
                    sql.push_str(&format!(" LIMIT {}", limit));
                }

                if let Some(offset) = query.offset {
                    sql.push_str(&format!(" OFFSET {}", offset));
                }

                let mut stmt = conn
                    .prepare(&sql)
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let param_refs: Vec<&dyn rusqlite::ToSql> =
                    params.iter().map(|p| p.as_ref()).collect();

                let results = stmt
                    .query_map(param_refs.as_slice(), |row| Self::row_to_check_result(row))
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get unsynced results for upload, ordered by execution time (oldest first).
    ///
    /// Uses FIFO ordering to ensure chronological consistency in sync operations.
    /// This is important for maintaining audit trail integrity on the server.
    pub async fn get_unsynced(&self, limit: i64) -> StorageResult<Vec<CheckResult>> {
        // Use a specific query with ASC ordering for FIFO sync behavior
        self.db
            .with_connection(move |conn| {
                let sql = r#"
                    SELECT id, check_rule_id, status, score, message, raw_data,
                           executed_at, duration_ms, synced
                    FROM check_results
                    WHERE synced = 0
                    ORDER BY executed_at ASC
                    LIMIT ?
                "#;

                let mut stmt = conn.prepare(sql).map_err(|e| {
                    StorageError::Query(format!("Failed to prepare unsynced query: {}", e))
                })?;

                let results = stmt
                    .query_map([limit], Self::row_to_check_result)
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to execute unsynced query: {}", e))
                    })?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect unsynced results: {}", e))
                    })?;

                debug!("Found {} unsynced check results", results.len());
                Ok(results)
            })
            .await
    }

    /// Mark results as synced.
    pub async fn mark_synced(&self, ids: &[i64]) -> StorageResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }

        let ids = ids.to_vec();
        self.db
            .with_connection(move |conn| {
                let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
                let sql = format!(
                    "UPDATE check_results SET synced = 1 WHERE id IN ({})",
                    placeholders.join(", ")
                );

                let params: Vec<&dyn rusqlite::ToSql> =
                    ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

                let count = conn
                    .execute(&sql, params.as_slice())
                    .map_err(|e| StorageError::Query(format!("Failed to mark synced: {}", e)))?;

                info!("Marked {} check results as synced", count);
                Ok(count)
            })
            .await
    }

    /// Delete check results older than the specified date.
    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> StorageResult<usize> {
        let before_str = before.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "DELETE FROM check_results WHERE executed_at < ?",
                        [&before_str],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete old results: {}", e))
                    })?;

                info!("Deleted {} check results older than {}", count, before_str);
                Ok(count)
            })
            .await
    }

    /// Count total check results.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM check_results", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count results: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Get the latest result for each check rule.
    pub async fn get_latest_per_rule(&self) -> StorageResult<Vec<CheckResult>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT cr.id, cr.check_rule_id, cr.status, cr.score, cr.message,
                               cr.raw_data, cr.executed_at, cr.duration_ms, cr.synced
                        FROM check_results cr
                        INNER JOIN (
                            SELECT check_rule_id, MAX(executed_at) as max_executed_at
                            FROM check_results
                            GROUP BY check_rule_id
                        ) latest ON cr.check_rule_id = latest.check_rule_id
                                AND cr.executed_at = latest.max_executed_at
                        ORDER BY cr.check_rule_id
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], Self::row_to_check_result)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Convert a database row to a CheckResult.
    fn row_to_check_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<CheckResult> {
        let id: i64 = row.get(0)?;
        let check_rule_id: String = row.get(1)?;

        let status_str: String = row.get(2)?;
        let status = match CheckStatus::parse_str(&status_str) {
            Some(s) => s,
            None => {
                warn!(
                    "Invalid status '{}' for check result {}, defaulting to Error",
                    status_str, id
                );
                CheckStatus::Error
            }
        };

        let executed_at_str: String = row.get(6)?;
        let executed_at = match DateTime::parse_from_rfc3339(&executed_at_str) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(e) => {
                warn!(
                    "Failed to parse timestamp '{}' for check result {}: {}. Using current time.",
                    executed_at_str, id, e
                );
                Utc::now()
            }
        };

        let synced_int: i32 = row.get(8)?;

        Ok(CheckResult {
            id: Some(id),
            check_rule_id,
            status,
            score: row.get(3)?,
            message: row.get(4)?,
            raw_data: row.get(5)?,
            executed_at,
            duration_ms: row.get(7)?,
            synced: synced_int != 0,
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

        // Insert a test rule for foreign key constraint
        db.with_connection(|conn| {
            conn.execute(
                r#"INSERT INTO check_rules (id, name, category, severity, check_type, version)
                   VALUES ('disk_encryption', 'Disk Encryption', 'security', 'critical', 'disk_encryption', '1.0')"#,
                [],
            )
            .map_err(|e| StorageError::Query(e.to_string()))?;
            conn.execute(
                r#"INSERT INTO check_rules (id, name, category, severity, check_type, version)
                   VALUES ('antivirus', 'Antivirus Check', 'security', 'high', 'antivirus', '1.0')"#,
                [],
            )
            .map_err(|e| StorageError::Query(e.to_string()))?;
            Ok(())
        })
        .await
        .unwrap();

        (temp_dir, db)
    }

    #[tokio::test]
    async fn test_insert_and_get() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        let result = CheckResult::new("disk_encryption", CheckStatus::Pass)
            .with_score(100)
            .with_message("BitLocker enabled")
            .with_raw_data(r#"{"bitlocker": "enabled"}"#)
            .with_duration_ms(150);

        let id = repo.insert(&result).await.unwrap();
        assert!(id > 0);

        let retrieved = repo.get(id).await.unwrap().unwrap();
        assert_eq!(retrieved.check_rule_id, "disk_encryption");
        assert_eq!(retrieved.status, CheckStatus::Pass);
        assert_eq!(retrieved.score, Some(100));
        assert_eq!(retrieved.message, Some("BitLocker enabled".to_string()));
        assert!(!retrieved.synced);
    }

    #[tokio::test]
    async fn test_query_by_status() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        // Insert multiple results
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("antivirus", CheckStatus::Fail))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();

        // Query only passing results
        let results = repo
            .query(CheckResultQuery::new().with_status(CheckStatus::Pass))
            .await
            .unwrap();

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.status == CheckStatus::Pass));
    }

    #[tokio::test]
    async fn test_query_by_check_rule() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("antivirus", CheckStatus::Fail))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();

        let results = repo
            .query(CheckResultQuery::new().with_check_rule_id("disk_encryption"))
            .await
            .unwrap();

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.check_rule_id == "disk_encryption"));
    }

    #[tokio::test]
    async fn test_query_by_date_range() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        let now = Utc::now();
        let yesterday = now - chrono::Duration::days(1);
        let tomorrow = now + chrono::Duration::days(1);

        repo.insert(
            &CheckResult::new("disk_encryption", CheckStatus::Pass).with_executed_at(yesterday),
        )
        .await
        .unwrap();
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass).with_executed_at(now))
            .await
            .unwrap();

        // Query for today only
        let today_start = now - chrono::Duration::hours(1);
        let results = repo
            .query(CheckResultQuery::new().with_date_range(today_start, tomorrow))
            .await
            .unwrap();

        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_mark_synced() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        let id1 = repo
            .insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();
        let id2 = repo
            .insert(&CheckResult::new("antivirus", CheckStatus::Fail))
            .await
            .unwrap();

        // Mark as synced
        let count = repo.mark_synced(&[id1, id2]).await.unwrap();
        assert_eq!(count, 2);

        // Verify synced
        let result = repo.get(id1).await.unwrap().unwrap();
        assert!(result.synced);

        // Get unsynced should be empty
        let unsynced = repo.get_unsynced(10).await.unwrap();
        assert!(unsynced.is_empty());
    }

    #[tokio::test]
    async fn test_get_unsynced() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("antivirus", CheckStatus::Fail))
            .await
            .unwrap();

        let unsynced = repo.get_unsynced(10).await.unwrap();
        assert_eq!(unsynced.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_older_than() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        let now = Utc::now();
        let old_date = now - chrono::Duration::days(400); // Older than 12 months

        repo.insert(
            &CheckResult::new("disk_encryption", CheckStatus::Pass).with_executed_at(old_date),
        )
        .await
        .unwrap();
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass).with_executed_at(now))
            .await
            .unwrap();

        // Delete results older than 365 days
        let cutoff = now - chrono::Duration::days(365);
        let deleted = repo.delete_older_than(cutoff).await.unwrap();
        assert_eq!(deleted, 1);

        // Verify only recent result remains
        let count = repo.count().await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_get_latest_per_rule() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        let now = Utc::now();
        let earlier = now - chrono::Duration::hours(1);

        // Insert older result
        repo.insert(
            &CheckResult::new("disk_encryption", CheckStatus::Fail).with_executed_at(earlier),
        )
        .await
        .unwrap();

        // Insert newer result
        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass).with_executed_at(now))
            .await
            .unwrap();

        // Insert for different rule
        repo.insert(&CheckResult::new("antivirus", CheckStatus::Pass).with_executed_at(now))
            .await
            .unwrap();

        let latest = repo.get_latest_per_rule().await.unwrap();
        assert_eq!(latest.len(), 2);

        let disk_result = latest
            .iter()
            .find(|r| r.check_rule_id == "disk_encryption")
            .unwrap();
        assert_eq!(disk_result.status, CheckStatus::Pass); // Latest is Pass
    }

    #[tokio::test]
    async fn test_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);

        repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
            .await
            .unwrap();
        repo.insert(&CheckResult::new("antivirus", CheckStatus::Fail))
            .await
            .unwrap();

        assert_eq!(repo.count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_check_status_serialization() {
        assert_eq!(CheckStatus::Pass.as_str(), "pass");
        assert_eq!(CheckStatus::Fail.as_str(), "fail");
        assert_eq!(CheckStatus::Error.as_str(), "error");
        assert_eq!(CheckStatus::Skip.as_str(), "skip");
        assert_eq!(CheckStatus::NotApplicable.as_str(), "not_applicable");

        assert_eq!(CheckStatus::parse_str("pass"), Some(CheckStatus::Pass));
        assert_eq!(CheckStatus::parse_str("invalid"), None);
    }

    #[tokio::test]
    async fn test_pagination() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckResultsRepository::new(&db);

        // Insert 5 results
        for _ in 0..5 {
            repo.insert(&CheckResult::new("disk_encryption", CheckStatus::Pass))
                .await
                .unwrap();
        }

        // Get first page
        let page1 = repo
            .query(CheckResultQuery::new().with_limit(2).with_offset(0))
            .await
            .unwrap();
        assert_eq!(page1.len(), 2);

        // Get second page
        let page2 = repo
            .query(CheckResultQuery::new().with_limit(2).with_offset(2))
            .await
            .unwrap();
        assert_eq!(page2.len(), 2);

        // Get third page (partial)
        let page3 = repo
            .query(CheckResultQuery::new().with_limit(2).with_offset(4))
            .await
            .unwrap();
        assert_eq!(page3.len(), 1);
    }
}
