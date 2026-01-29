//! Notifications repository for GUI notification storage.
//!
//! Provides CRUD operations for user-facing notifications displayed
//! in the desktop interface notification panel.

use agent_storage::{Database, StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// A notification record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    /// Unique identifier (UUID string).
    pub id: String,
    /// Notification title.
    pub title: String,
    /// Notification body.
    pub body: String,
    /// Severity level.
    pub severity: NotificationSeverity,
    /// Whether the notification has been read.
    pub read: bool,
    /// Optional action URL or command.
    pub action: Option<String>,
    /// Timestamp of creation (ISO 8601 UTC).
    pub created_at: DateTime<Utc>,
    /// Timestamp when the notification was read.
    pub read_at: Option<DateTime<Utc>>,
}

/// Notification severity levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl NotificationSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            NotificationSeverity::Info => "info",
            NotificationSeverity::Warning => "warning",
            NotificationSeverity::Error => "error",
            NotificationSeverity::Critical => "critical",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "info" => Some(NotificationSeverity::Info),
            "warning" => Some(NotificationSeverity::Warning),
            "error" => Some(NotificationSeverity::Error),
            "critical" => Some(NotificationSeverity::Critical),
            _ => None,
        }
    }
}

impl Notification {
    /// Create a new notification.
    pub fn new(
        id: impl Into<String>,
        title: impl Into<String>,
        body: impl Into<String>,
        severity: NotificationSeverity,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            body: body.into(),
            severity,
            read: false,
            action: None,
            created_at: Utc::now(),
            read_at: None,
        }
    }

    /// Set an action URL or command.
    pub fn with_action(mut self, action: impl Into<String>) -> Self {
        self.action = Some(action.into());
        self
    }
}

/// Repository for notification CRUD operations.
pub struct NotificationsRepository<'a> {
    db: &'a Database,
}

impl<'a> NotificationsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Insert a new notification.
    pub async fn insert(&self, notification: &Notification) -> StorageResult<()> {
        let id = notification.id.clone();
        let title = notification.title.clone();
        let body = notification.body.clone();
        let severity = notification.severity.as_str().to_string();
        let read = if notification.read { 1 } else { 0 };
        let action = notification.action.clone();
        let created_at = notification.created_at.to_rfc3339();

        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                    INSERT INTO notifications (id, title, body, severity, read, action, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![id, title, body, severity, read, action, created_at],
                )
                .map_err(|e| {
                    StorageError::Query(format!("Failed to insert notification: {}", e))
                })?;

                debug!("Inserted notification: {}", id);
                Ok(())
            })
            .await
    }

    /// Get a notification by ID.
    pub async fn get(&self, id: &str) -> StorageResult<Option<Notification>> {
        let id = id.to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, title, body, severity, read, action, created_at, read_at
                        FROM notifications
                        WHERE id = ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let result = stmt
                    .query_row([&id], Self::row_to_notification)
                    .optional()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to query notification: {}", e))
                    })?;

                Ok(result)
            })
            .await
    }

    /// Get all unread notifications, newest first.
    pub async fn get_unread(&self) -> StorageResult<Vec<Notification>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, title, body, severity, read, action, created_at, read_at
                        FROM notifications
                        WHERE read = 0
                        ORDER BY created_at DESC
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], Self::row_to_notification)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get all notifications, newest first.
    pub async fn get_all(&self, limit: i64) -> StorageResult<Vec<Notification>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, title, body, severity, read, action, created_at, read_at
                        FROM notifications
                        ORDER BY created_at DESC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([limit], Self::row_to_notification)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Mark a notification as read.
    pub async fn mark_read(&self, id: &str) -> StorageResult<bool> {
        let id = id.to_string();
        let now = Utc::now().to_rfc3339();

        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "UPDATE notifications SET read = 1, read_at = ? WHERE id = ?",
                        rusqlite::params![now, id],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to mark notification read: {}", e))
                    })?;

                Ok(count > 0)
            })
            .await
    }

    /// Mark all notifications as read.
    pub async fn mark_all_read(&self) -> StorageResult<usize> {
        let now = Utc::now().to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "UPDATE notifications SET read = 1, read_at = ? WHERE read = 0",
                        [&now],
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to mark all read: {}", e)))?;

                info!("Marked {} notifications as read", count);
                Ok(count)
            })
            .await
    }

    /// Delete notifications older than the specified date.
    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> StorageResult<usize> {
        let before_str = before.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "DELETE FROM notifications WHERE created_at < ?",
                        [&before_str],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to delete old notifications: {}", e))
                    })?;

                info!("Deleted {} notifications older than {}", count, before_str);
                Ok(count)
            })
            .await
    }

    /// Count unread notifications.
    pub async fn count_unread(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM notifications WHERE read = 0",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to count unread: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Convert a database row to a Notification.
    fn row_to_notification(row: &rusqlite::Row<'_>) -> rusqlite::Result<Notification> {
        let severity_str: String = row.get(3)?;
        let severity =
            NotificationSeverity::parse_str(&severity_str).unwrap_or(NotificationSeverity::Info);

        let read_int: i32 = row.get(4)?;

        let created_at_str: String = row.get(6)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let read_at_str: Option<String> = row.get(7)?;
        let read_at = read_at_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

        Ok(Notification {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            severity,
            read: read_int != 0,
            action: row.get(5)?,
            created_at,
            read_at,
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
    async fn test_insert_and_get() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = NotificationsRepository::new(&db);

        let notif = Notification::new(
            "notif-001",
            "Check Failed",
            "Firewall check has failed",
            NotificationSeverity::Warning,
        );

        repo.insert(&notif).await.unwrap();

        let retrieved = repo.get("notif-001").await.unwrap().unwrap();
        assert_eq!(retrieved.title, "Check Failed");
        assert_eq!(retrieved.severity, NotificationSeverity::Warning);
        assert!(!retrieved.read);
    }

    #[tokio::test]
    async fn test_mark_read() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = NotificationsRepository::new(&db);

        repo.insert(&Notification::new(
            "n1",
            "Title",
            "Body",
            NotificationSeverity::Info,
        ))
        .await
        .unwrap();

        assert_eq!(repo.count_unread().await.unwrap(), 1);

        let marked = repo.mark_read("n1").await.unwrap();
        assert!(marked);

        assert_eq!(repo.count_unread().await.unwrap(), 0);

        let notif = repo.get("n1").await.unwrap().unwrap();
        assert!(notif.read);
        assert!(notif.read_at.is_some());
    }

    #[tokio::test]
    async fn test_get_unread() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = NotificationsRepository::new(&db);

        repo.insert(&Notification::new(
            "n1",
            "A",
            "Body A",
            NotificationSeverity::Info,
        ))
        .await
        .unwrap();
        repo.insert(&Notification::new(
            "n2",
            "B",
            "Body B",
            NotificationSeverity::Warning,
        ))
        .await
        .unwrap();

        repo.mark_read("n1").await.unwrap();

        let unread = repo.get_unread().await.unwrap();
        assert_eq!(unread.len(), 1);
        assert_eq!(unread[0].id, "n2");
    }

    #[tokio::test]
    async fn test_mark_all_read() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = NotificationsRepository::new(&db);

        repo.insert(&Notification::new(
            "n1",
            "A",
            "A",
            NotificationSeverity::Info,
        ))
        .await
        .unwrap();
        repo.insert(&Notification::new(
            "n2",
            "B",
            "B",
            NotificationSeverity::Info,
        ))
        .await
        .unwrap();

        let count = repo.mark_all_read().await.unwrap();
        assert_eq!(count, 2);
        assert_eq!(repo.count_unread().await.unwrap(), 0);
    }
}
