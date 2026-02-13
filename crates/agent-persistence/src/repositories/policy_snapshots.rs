//! Policy snapshots repository for compliance trend tracking.
//!
//! Stores point-in-time snapshots of policy compliance status,
//! enabling the GUI to display compliance history and trends.

use agent_storage::{Database, StorageError, StorageResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// Type of policy snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotType {
    /// Periodically captured snapshot.
    Periodic,
    /// Manually triggered snapshot.
    Manual,
    /// Snapshot captured on compliance change.
    OnChange,
}

impl SnapshotType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SnapshotType::Periodic => "periodic",
            SnapshotType::Manual => "manual",
            SnapshotType::OnChange => "on_change",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "periodic" => Some(SnapshotType::Periodic),
            "manual" => Some(SnapshotType::Manual),
            "on_change" => Some(SnapshotType::OnChange),
            _ => None,
        }
    }
}

/// A policy compliance snapshot record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicySnapshot {
    /// Unique identifier (auto-generated).
    pub id: Option<i64>,
    /// Type of snapshot.
    pub snapshot_type: SnapshotType,
    /// Total number of active policies.
    pub total_policies: i32,
    /// Number of policies passing.
    pub passing: i32,
    /// Number of policies failing.
    pub failing: i32,
    /// Number of policies with errors.
    pub errors: i32,
    /// Number of policies not yet evaluated.
    pub pending: i32,
    /// Overall compliance score (0-100).
    pub compliance_score: Option<f64>,
    /// Optional JSON detail blob with per-policy breakdown.
    pub detail: Option<String>,
    /// Timestamp (ISO 8601 UTC).
    pub created_at: DateTime<Utc>,
}

impl PolicySnapshot {
    /// Create a new periodic snapshot.
    pub fn periodic(
        total_policies: i32,
        passing: i32,
        failing: i32,
        errors: i32,
        pending: i32,
    ) -> Self {
        let score = if total_policies > 0 {
            Some((passing as f64 / total_policies as f64) * 100.0)
        } else {
            None
        };

        Self {
            id: None,
            snapshot_type: SnapshotType::Periodic,
            total_policies,
            passing,
            failing,
            errors,
            pending,
            compliance_score: score,
            detail: None,
            created_at: Utc::now(),
        }
    }

    /// Set the detail JSON blob.
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Set the snapshot type.
    pub fn with_type(mut self, snapshot_type: SnapshotType) -> Self {
        self.snapshot_type = snapshot_type;
        self
    }
}

/// Repository for policy snapshot CRUD operations.
pub struct PolicySnapshotsRepository<'a> {
    db: &'a Database,
}

impl<'a> PolicySnapshotsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Insert a new snapshot.
    pub async fn insert(&self, snapshot: &PolicySnapshot) -> StorageResult<i64> {
        let snapshot_type = snapshot.snapshot_type.as_str().to_string();
        let total_policies = snapshot.total_policies;
        let passing = snapshot.passing;
        let failing = snapshot.failing;
        let errors = snapshot.errors;
        let pending = snapshot.pending;
        let compliance_score = snapshot.compliance_score;
        let detail = snapshot.detail.clone();
        let created_at = snapshot.created_at.to_rfc3339();

        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                    INSERT INTO policy_snapshots
                    (snapshot_type, total_policies, passing, failing, errors, pending, compliance_score, detail, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![
                        snapshot_type,
                        total_policies,
                        passing,
                        failing,
                        errors,
                        pending,
                        compliance_score,
                        detail,
                        created_at
                    ],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to insert policy snapshot: {}", e))
                })?;

                let id = conn.last_insert_rowid();
                debug!("Inserted policy snapshot with ID: {}", id);
                Ok(id)
            })
            .await
    }

    /// Get the most recent snapshots.
    pub async fn get_recent(&self, limit: i64) -> StorageResult<Vec<PolicySnapshot>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, snapshot_type, total_policies, passing, failing, errors,
                               pending, compliance_score, detail, created_at
                        FROM policy_snapshots
                        ORDER BY created_at DESC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([limit], Self::row_to_snapshot)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get the latest snapshot.
    pub async fn get_latest(&self) -> StorageResult<Option<PolicySnapshot>> {
        let results = self.get_recent(1).await?;
        Ok(results.into_iter().next())
    }

    /// Get snapshots within a date range (for trend charts).
    pub async fn get_range(
        &self,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> StorageResult<Vec<PolicySnapshot>> {
        let from_str = from.to_rfc3339();
        let to_str = to.to_rfc3339();

        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, snapshot_type, total_policies, passing, failing, errors,
                               pending, compliance_score, detail, created_at
                        FROM policy_snapshots
                        WHERE created_at >= ? AND created_at <= ?
                        ORDER BY created_at ASC
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map(rusqlite::params![from_str, to_str], Self::row_to_snapshot)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Delete snapshots older than the specified date.
    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> StorageResult<usize> {
        let before_str = before.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "DELETE FROM policy_snapshots WHERE created_at < ?",
                        [&before_str],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete old snapshots: {}", e))
                    })?;

                info!(
                    "Deleted {} policy snapshots older than {}",
                    count, before_str
                );
                Ok(count)
            })
            .await
    }

    /// Count total snapshots.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM policy_snapshots", [], |row| {
                        row.get(0)
                    })
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count snapshots: {}", e))
                    })?;
                Ok(count)
            })
            .await
    }

    /// Convert a database row to a PolicySnapshot.
    fn row_to_snapshot(row: &rusqlite::Row<'_>) -> rusqlite::Result<PolicySnapshot> {
        let id: i64 = row.get(0)?;
        let snapshot_type_str: String = row.get(1)?;
        let snapshot_type = SnapshotType::parse_str(&snapshot_type_str).unwrap_or_else(|| {
            tracing::warn!(
                "Unknown snapshot type '{}' in database, falling back to Periodic",
                snapshot_type_str
            );
            SnapshotType::Periodic
        });

        let created_at_str: String = row.get(9)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                tracing::warn!(
                    "Malformed timestamp '{}' in policy_snapshots: {}, using current time",
                    created_at_str,
                    e
                );
                Utc::now()
            });

        Ok(PolicySnapshot {
            id: Some(id),
            snapshot_type,
            total_policies: row.get(2)?,
            passing: row.get(3)?,
            failing: row.get(4)?,
            errors: row.get(5)?,
            pending: row.get(6)?,
            compliance_score: row.get(7)?,
            detail: row.get(8)?,
            created_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migration_v2::run_v2_migrations;
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        db.with_connection_mut(|conn| {
            run_v2_migrations(conn).map_err(|e| StorageError::Migration(e.to_string()))
        })
        .await
        .unwrap();

        (temp_dir, db)
    }

    #[tokio::test]
    async fn test_insert_and_get_recent() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = PolicySnapshotsRepository::new(&db);

        let snapshot = PolicySnapshot::periodic(10, 8, 1, 1, 0);
        let id = repo.insert(&snapshot).await.unwrap();
        assert!(id > 0);

        let recent = repo.get_recent(10).await.unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].total_policies, 10);
        assert_eq!(recent[0].passing, 8);
    }

    #[tokio::test]
    async fn test_get_latest() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = PolicySnapshotsRepository::new(&db);

        repo.insert(&PolicySnapshot::periodic(5, 3, 2, 0, 0))
            .await
            .unwrap();
        repo.insert(&PolicySnapshot::periodic(10, 9, 1, 0, 0))
            .await
            .unwrap();

        let latest = repo.get_latest().await.unwrap().unwrap();
        assert_eq!(latest.total_policies, 10);
    }

    #[tokio::test]
    async fn test_compliance_score_calculation() {
        let snapshot = PolicySnapshot::periodic(10, 8, 1, 1, 0);
        assert!((snapshot.compliance_score.unwrap() - 80.0).abs() < f64::EPSILON);

        let empty = PolicySnapshot::periodic(0, 0, 0, 0, 0);
        assert!(empty.compliance_score.is_none());
    }

    #[tokio::test]
    async fn test_snapshot_type_roundtrip() {
        assert_eq!(SnapshotType::Periodic.as_str(), "periodic");
        assert_eq!(SnapshotType::Manual.as_str(), "manual");
        assert_eq!(SnapshotType::OnChange.as_str(), "on_change");

        assert_eq!(
            SnapshotType::parse_str("periodic"),
            Some(SnapshotType::Periodic)
        );
        assert_eq!(SnapshotType::parse_str("invalid"), None);
    }

    #[tokio::test]
    async fn test_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = PolicySnapshotsRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);

        repo.insert(&PolicySnapshot::periodic(5, 5, 0, 0, 0))
            .await
            .unwrap();

        assert_eq!(repo.count().await.unwrap(), 1);
    }
}
