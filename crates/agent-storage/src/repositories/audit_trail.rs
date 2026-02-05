//! Repository for persisting local audit trail entries.

use crate::database::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::Row;
use serde::{Deserialize, Serialize};
use tracing::debug;

/// A recorded audit log entry in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAuditEntry {
    pub id: Option<i64>,
    pub timestamp: DateTime<Utc>,
    pub action_type: String,
    pub action_data: String, // JSON representation of AuditAction
    pub actor: String,
    pub details: Option<String>,
}

/// Repository for the local audit trail.
pub struct AuditTrailRepository<'a> {
    db: &'a Database,
}

impl<'a> AuditTrailRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Store a new audit entry.
    pub async fn insert(&self, entry: &StoredAuditEntry) -> StorageResult<i64> {
        let entry = entry.clone();
        self.db
            .with_connection(move |conn| {
                conn.execute(
                    r#"
                    INSERT INTO audit_trail (timestamp, action_type, action_data, actor, details)
                    VALUES (?1, ?2, ?3, ?4, ?5)
                    "#,
                    rusqlite::params![
                        entry.timestamp.to_rfc3339(),
                        entry.action_type,
                        entry.action_data,
                        entry.actor,
                        entry.details,
                    ],
                )
                .map_err(|e| StorageError::Query(format!("Failed to insert audit entry: {}", e)))?;

                Ok(conn.last_insert_rowid())
            })
            .await
    }

    /// Get audit entries with pagination.
    pub async fn get_recent(&self, limit: usize, offset: usize) -> StorageResult<Vec<StoredAuditEntry>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, timestamp, action_type, action_data, actor, details
                        FROM audit_trail
                        ORDER BY timestamp DESC
                        LIMIT ?1 OFFSET ?2
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let entries = stmt
                    .query_map(rusqlite::params![limit, offset], Self::row_to_entry)
                    .map_err(|e| StorageError::Query(format!("Failed to query audit entries: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect audit entries: {}", e)))?;

                debug!("Retrieved {} audit entries from database", entries.len());
                Ok(entries)
            })
            .await
    }

    /// Count total audit entries.
    pub async fn count(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM audit_trail", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count audit entries: {}", e)))?;
                Ok(count as usize)
            })
            .await
    }

    /// Convert a database row to a StoredAuditEntry.
    fn row_to_entry(row: &Row<'_>) -> rusqlite::Result<StoredAuditEntry> {
        let timestamp_str: String = row.get(1)?;
        let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        Ok(StoredAuditEntry {
            id: Some(row.get(0)?),
            timestamp,
            action_type: row.get(2)?,
            action_data: row.get(3)?,
            actor: row.get(4)?,
            details: row.get(5)?,
        })
    }
}
