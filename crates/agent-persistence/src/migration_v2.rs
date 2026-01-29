//! Schema migration v2 for Sentinel Agent GUI and extended features.
//!
//! Adds tables for:
//! - `agent_events` - Structured agent event log
//! - `notifications` - GUI notification storage
//! - `policy_snapshots` - Point-in-time policy compliance snapshots

use agent_storage::StorageError;
use rusqlite::Connection;
use tracing::{debug, error, info};

/// Schema version for v2 migration.
pub const V2_SCHEMA_VERSION: i32 = 2;

/// V2 migration SQL (up).
const V2_UP: &str = r#"
    -- Agent events log
    -- Stores structured events for GUI activity display and audit trail
    CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info'
            CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        title TEXT NOT NULL,
        detail TEXT,                -- JSON blob with event-specific data
        source TEXT,                -- Module or subsystem that generated the event
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_events_severity ON agent_events(severity);

    -- GUI notifications
    -- Stores notifications displayed to the user in the desktop interface
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info'
            CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        read INTEGER NOT NULL DEFAULT 0,
        action TEXT,                -- Optional action URL or command
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        read_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    -- Policy compliance snapshots
    -- Stores point-in-time snapshots of policy compliance for trend tracking
    CREATE TABLE IF NOT EXISTS policy_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_type TEXT NOT NULL DEFAULT 'periodic'
            CHECK (snapshot_type IN ('periodic', 'manual', 'on_change')),
        total_policies INTEGER NOT NULL DEFAULT 0,
        passing INTEGER NOT NULL DEFAULT 0,
        failing INTEGER NOT NULL DEFAULT 0,
        errors INTEGER NOT NULL DEFAULT 0,
        pending INTEGER NOT NULL DEFAULT 0,
        compliance_score REAL,       -- Overall score 0-100
        detail TEXT,                 -- JSON blob with per-policy breakdown
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_policy_snapshots_created_at ON policy_snapshots(created_at);
    CREATE INDEX IF NOT EXISTS idx_policy_snapshots_type ON policy_snapshots(snapshot_type);
"#;

/// V2 migration SQL (down / rollback).
const V2_DOWN: &str = r#"
    DROP INDEX IF EXISTS idx_policy_snapshots_type;
    DROP INDEX IF EXISTS idx_policy_snapshots_created_at;
    DROP TABLE IF EXISTS policy_snapshots;

    DROP INDEX IF EXISTS idx_notifications_created_at;
    DROP INDEX IF EXISTS idx_notifications_read;
    DROP TABLE IF EXISTS notifications;

    DROP INDEX IF EXISTS idx_agent_events_severity;
    DROP INDEX IF EXISTS idx_agent_events_created_at;
    DROP INDEX IF EXISTS idx_agent_events_type;
    DROP TABLE IF EXISTS agent_events;
"#;

/// Run v2 migrations on the given connection.
///
/// This is idempotent -- it checks schema_version before applying.
pub fn run_v2_migrations(conn: &mut Connection) -> Result<(), StorageError> {
    // Check current schema version
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            StorageError::Migration(format!("Failed to query schema version: {}", e))
        })?;

    if current_version >= V2_SCHEMA_VERSION {
        debug!(
            "V2 schema already applied (current: v{})",
            current_version
        );
        return Ok(());
    }

    info!(
        "Applying v2 migration (current schema: v{})",
        current_version
    );

    let tx = conn.transaction().map_err(|e| {
        StorageError::Migration(format!("Failed to start v2 migration transaction: {}", e))
    })?;

    // Execute the migration SQL
    if let Err(e) = tx.execute_batch(V2_UP) {
        error!("V2 migration failed: {}. Rolling back...", e);
        return Err(StorageError::Migration(format!(
            "V2 migration failed: {}",
            e
        )));
    }

    // Record the migration
    if let Err(e) = tx.execute(
        "INSERT INTO schema_version (version, name) VALUES (?, ?)",
        [&V2_SCHEMA_VERSION.to_string(), "v2_gui_features"],
    ) {
        error!("Failed to record v2 migration: {}", e);
        return Err(StorageError::Migration(format!(
            "Failed to record v2 migration: {}",
            e
        )));
    }

    tx.commit().map_err(|e| {
        StorageError::Migration(format!("Failed to commit v2 migration: {}", e))
    })?;

    info!("V2 migration applied successfully (now at schema v{})", V2_SCHEMA_VERSION);
    Ok(())
}

/// Rollback v2 migration.
pub fn rollback_v2_migration(conn: &mut Connection) -> Result<(), StorageError> {
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            StorageError::Migration(format!("Failed to query schema version: {}", e))
        })?;

    if current_version < V2_SCHEMA_VERSION {
        debug!("V2 migration not applied, nothing to rollback");
        return Ok(());
    }

    info!("Rolling back v2 migration");

    let tx = conn.transaction().map_err(|e| {
        StorageError::Migration(format!("Failed to start rollback transaction: {}", e))
    })?;

    tx.execute_batch(V2_DOWN).map_err(|e| {
        StorageError::Migration(format!("V2 rollback failed: {}", e))
    })?;

    tx.execute(
        "DELETE FROM schema_version WHERE version = ?",
        [V2_SCHEMA_VERSION],
    )
    .map_err(|e| {
        StorageError::Migration(format!("Failed to remove v2 migration record: {}", e))
    })?;

    tx.commit().map_err(|e| {
        StorageError::Migration(format!("Failed to commit v2 rollback: {}", e))
    })?;

    info!("V2 migration rolled back successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::run_migrations;
    use tempfile::TempDir;

    fn create_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let mut conn = Connection::open(&db_path).unwrap();
        // Apply v1 migrations first
        run_migrations(&mut conn).unwrap();
        (temp_dir, conn)
    }

    #[test]
    fn test_run_v2_migrations() {
        let (_temp_dir, mut conn) = create_test_db();

        run_v2_migrations(&mut conn).unwrap();

        // Verify schema version
        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, V2_SCHEMA_VERSION);

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"agent_events".to_string()));
        assert!(tables.contains(&"notifications".to_string()));
        assert!(tables.contains(&"policy_snapshots".to_string()));
    }

    #[test]
    fn test_v2_migrations_idempotent() {
        let (_temp_dir, mut conn) = create_test_db();

        run_v2_migrations(&mut conn).unwrap();
        run_v2_migrations(&mut conn).unwrap();

        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, V2_SCHEMA_VERSION);
    }

    #[test]
    fn test_v2_rollback() {
        let (_temp_dir, mut conn) = create_test_db();

        run_v2_migrations(&mut conn).unwrap();
        rollback_v2_migration(&mut conn).unwrap();

        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 1); // Back to v1

        // Verify v2 tables are gone
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(!tables.contains(&"agent_events".to_string()));
        assert!(!tables.contains(&"notifications".to_string()));
        assert!(!tables.contains(&"policy_snapshots".to_string()));
    }

    #[test]
    fn test_agent_events_table() {
        let (_temp_dir, mut conn) = create_test_db();
        run_v2_migrations(&mut conn).unwrap();

        // Insert an event
        conn.execute(
            "INSERT INTO agent_events (event_type, severity, title, detail, source) VALUES (?, ?, ?, ?, ?)",
            ["check_completed", "info", "Disk encryption check passed", r#"{"check_id": "disk_encryption"}"#, "scanner"],
        )
        .unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM agent_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_notifications_table() {
        let (_temp_dir, mut conn) = create_test_db();
        run_v2_migrations(&mut conn).unwrap();

        conn.execute(
            "INSERT INTO notifications (id, title, body, severity) VALUES (?, ?, ?, ?)",
            ["notif-001", "Check Failed", "Firewall check failed", "warning"],
        )
        .unwrap();

        let title: String = conn
            .query_row(
                "SELECT title FROM notifications WHERE id = ?",
                ["notif-001"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(title, "Check Failed");
    }

    #[test]
    fn test_policy_snapshots_table() {
        let (_temp_dir, mut conn) = create_test_db();
        run_v2_migrations(&mut conn).unwrap();

        conn.execute(
            "INSERT INTO policy_snapshots (snapshot_type, total_policies, passing, failing, compliance_score) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params!["periodic", 10, 8, 2, 80.0],
        )
        .unwrap();

        let score: f64 = conn
            .query_row(
                "SELECT compliance_score FROM policy_snapshots WHERE snapshot_type = ?",
                ["periodic"],
                |row| row.get(0),
            )
            .unwrap();
        assert!((score - 80.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_severity_constraint() {
        let (_temp_dir, mut conn) = create_test_db();
        run_v2_migrations(&mut conn).unwrap();

        // Valid severity
        let result = conn.execute(
            "INSERT INTO agent_events (event_type, severity, title) VALUES (?, ?, ?)",
            ["test", "critical", "Test event"],
        );
        assert!(result.is_ok());

        // Invalid severity should fail
        let result = conn.execute(
            "INSERT INTO agent_events (event_type, severity, title) VALUES (?, ?, ?)",
            ["test", "invalid_severity", "Test event"],
        );
        assert!(result.is_err());
    }
}
