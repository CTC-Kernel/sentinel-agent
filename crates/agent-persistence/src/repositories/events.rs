//! Events repository for structured agent event logging.
//!
//! Provides storage and retrieval of agent events displayed in the GUI
//! activity panel and used for audit trails.

use agent_storage::{Database, StorageError, StorageResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// An agent event record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    /// Unique identifier (auto-generated).
    pub id: Option<i64>,
    /// Event type (e.g., "check_completed", "sync_started", "error").
    pub event_type: String,
    /// Severity level.
    pub severity: EventSeverity,
    /// Human-readable event title.
    pub title: String,
    /// Optional JSON detail blob.
    pub detail: Option<String>,
    /// Source module or subsystem.
    pub source: Option<String>,
    /// Timestamp (ISO 8601 UTC).
    pub created_at: DateTime<Utc>,
}

/// Event severity levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl EventSeverity {
    /// Convert to database string.
    pub fn as_str(&self) -> &'static str {
        match self {
            EventSeverity::Info => "info",
            EventSeverity::Warning => "warning",
            EventSeverity::Error => "error",
            EventSeverity::Critical => "critical",
        }
    }

    /// Parse from database string.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "info" => Some(EventSeverity::Info),
            "warning" => Some(EventSeverity::Warning),
            "error" => Some(EventSeverity::Error),
            "critical" => Some(EventSeverity::Critical),
            _ => None,
        }
    }
}

impl AgentEvent {
    /// Create a new event with current timestamp.
    pub fn new(
        event_type: impl Into<String>,
        severity: EventSeverity,
        title: impl Into<String>,
    ) -> Self {
        Self {
            id: None,
            event_type: event_type.into(),
            severity,
            title: title.into(),
            detail: None,
            source: None,
            created_at: Utc::now(),
        }
    }

    /// Set the detail JSON blob.
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Set the source module.
    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        self.source = Some(source.into());
        self
    }
}

/// Repository for agent events.
pub struct EventsRepository<'a> {
    db: &'a Database,
}

impl<'a> EventsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Insert a new event.
    pub async fn insert(&self, event: &AgentEvent) -> StorageResult<i64> {
        let event_type = event.event_type.clone();
        let severity = event.severity.as_str().to_string();
        let title = event.title.clone();
        let detail = event.detail.clone();
        let source = event.source.clone();
        let created_at = event.created_at.to_rfc3339();

        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                    INSERT INTO agent_events (event_type, severity, title, detail, source, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![event_type, severity, title, detail, source, created_at],
                )
                .map_err(|e| StorageError::Query(format!("Failed to insert event: {}", e)))?;

                let id = conn.last_insert_rowid();
                debug!("Inserted agent event with ID: {}", id);
                Ok(id)
            })
            .await
    }

    /// Get recent events, newest first.
    pub async fn get_recent(&self, limit: i64) -> StorageResult<Vec<AgentEvent>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, event_type, severity, title, detail, source, created_at
                        FROM agent_events
                        ORDER BY created_at DESC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([limit], Self::row_to_event)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get events by type.
    pub async fn get_by_type(
        &self,
        event_type: &str,
        limit: i64,
    ) -> StorageResult<Vec<AgentEvent>> {
        let event_type = event_type.to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, event_type, severity, title, detail, source, created_at
                        FROM agent_events
                        WHERE event_type = ?
                        ORDER BY created_at DESC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map(rusqlite::params![event_type, limit], Self::row_to_event)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Delete events older than the specified date.
    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> StorageResult<usize> {
        let before_str = before.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "DELETE FROM agent_events WHERE created_at < ?",
                        [&before_str],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete old events: {}", e))
                    })?;

                info!("Deleted {} events older than {}", count, before_str);
                Ok(count)
            })
            .await
    }

    /// Count total events.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM agent_events", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count events: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Convert a database row to an AgentEvent.
    fn row_to_event(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgentEvent> {
        let id: i64 = row.get(0)?;
        let severity_str: String = row.get(2)?;
        let severity = EventSeverity::parse_str(&severity_str).unwrap_or_else(|| {
            tracing::warn!(
                "Unknown event severity '{}' in database, falling back to Info",
                severity_str
            );
            EventSeverity::Info
        });

        let created_at_str: String = row.get(6)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                tracing::warn!(
                    "Malformed timestamp '{}' in agent_events: {}, using current time",
                    created_at_str,
                    e
                );
                Utc::now()
            });

        Ok(AgentEvent {
            id: Some(id),
            event_type: row.get(1)?,
            severity,
            title: row.get(3)?,
            detail: row.get(4)?,
            source: row.get(5)?,
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

        // Apply v2 migrations
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
        let repo = EventsRepository::new(&db);

        let event = AgentEvent::new(
            "check_completed",
            EventSeverity::Info,
            "Disk encryption check passed",
        )
        .with_detail(r#"{"check_id": "disk_encryption"}"#)
        .with_source("scanner");

        let id = repo.insert(&event).await.unwrap();
        assert!(id > 0);

        let recent = repo.get_recent(10).await.unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].event_type, "check_completed");
        assert_eq!(recent[0].severity, EventSeverity::Info);
    }

    #[tokio::test]
    async fn test_get_by_type() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = EventsRepository::new(&db);

        repo.insert(&AgentEvent::new(
            "check_completed",
            EventSeverity::Info,
            "Check A",
        ))
        .await
        .unwrap();
        repo.insert(&AgentEvent::new(
            "sync_started",
            EventSeverity::Info,
            "Sync started",
        ))
        .await
        .unwrap();
        repo.insert(&AgentEvent::new(
            "check_completed",
            EventSeverity::Info,
            "Check B",
        ))
        .await
        .unwrap();

        let checks = repo.get_by_type("check_completed", 10).await.unwrap();
        assert_eq!(checks.len(), 2);
    }

    #[tokio::test]
    async fn test_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = EventsRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);

        repo.insert(&AgentEvent::new("test", EventSeverity::Info, "Event 1"))
            .await
            .unwrap();
        repo.insert(&AgentEvent::new("test", EventSeverity::Warning, "Event 2"))
            .await
            .unwrap();

        assert_eq!(repo.count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_event_severity_roundtrip() {
        assert_eq!(EventSeverity::Info.as_str(), "info");
        assert_eq!(EventSeverity::Warning.as_str(), "warning");
        assert_eq!(EventSeverity::Error.as_str(), "error");
        assert_eq!(EventSeverity::Critical.as_str(), "critical");

        assert_eq!(EventSeverity::parse_str("info"), Some(EventSeverity::Info));
        assert_eq!(EventSeverity::parse_str("invalid"), None);
    }
}
