//! Database migrations for SQLite schema management.
//!
//! This module provides versioned database migrations with support for:
//! - Sequential migration execution
//! - Idempotent operations (safe to re-run)
//! - Rollback on failure
//! - Schema version tracking

use crate::error::{StorageError, StorageResult};
use rusqlite::Connection;
use tracing::{debug, error, info, warn};

/// Current schema version (incremented with each migration).
pub const CURRENT_SCHEMA_VERSION: i32 = 1;

/// A database migration.
struct Migration {
    version: i32,
    name: &'static str,
    up: &'static str,
    down: &'static str,
}

/// All migrations in order.
const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "initial_schema",
    up: r#"
            -- Agent configuration table
            -- Stores local agent settings synced from SaaS
            CREATE TABLE IF NOT EXISTS agent_config (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                synced_at TEXT,
                source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'remote'))
            );

            -- Check rules table
            -- Stores compliance check definitions downloaded from SaaS
            CREATE TABLE IF NOT EXISTS check_rules (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
                enabled INTEGER NOT NULL DEFAULT 1,
                check_type TEXT NOT NULL,
                parameters TEXT,  -- JSON blob for check-specific config
                frameworks TEXT,  -- JSON array of framework mappings (NIS2, DORA, RGPD)
                version TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );

            -- Check results table
            -- Stores compliance check execution results
            CREATE TABLE IF NOT EXISTS check_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_rule_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'error', 'skip', 'not_applicable')),
                score INTEGER CHECK (score >= 0 AND score <= 100),
                message TEXT,
                raw_data TEXT,  -- JSON blob with detailed check output
                executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                duration_ms INTEGER,
                synced INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (check_rule_id) REFERENCES check_rules(id) ON DELETE CASCADE
            );

            -- Create index for efficient queries
            CREATE INDEX IF NOT EXISTS idx_check_results_rule_id ON check_results(check_rule_id);
            CREATE INDEX IF NOT EXISTS idx_check_results_executed_at ON check_results(executed_at);
            CREATE INDEX IF NOT EXISTS idx_check_results_synced ON check_results(synced);

            -- Proofs table
            -- Stores tamper-evident compliance evidence with SHA-256 integrity hash
            CREATE TABLE IF NOT EXISTS proofs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_result_id INTEGER NOT NULL,
                data TEXT NOT NULL,  -- JSON blob with proof evidence
                hash TEXT NOT NULL,  -- SHA-256 hash of (check_result_id + data + created_at)
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                synced INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (check_result_id) REFERENCES check_results(id) ON DELETE CASCADE
            );

            -- Create index for proof lookups
            CREATE INDEX IF NOT EXISTS idx_proofs_check_result_id ON proofs(check_result_id);
            CREATE INDEX IF NOT EXISTS idx_proofs_created_at ON proofs(created_at);
            CREATE INDEX IF NOT EXISTS idx_proofs_synced ON proofs(synced);

            -- Sync queue table
            -- Stores pending uploads for offline/retry scenarios
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL CHECK (entity_type IN ('check_result', 'proof', 'heartbeat', 'config')),
                entity_id INTEGER NOT NULL,
                payload TEXT NOT NULL,  -- JSON blob of data to sync
                priority INTEGER NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 10,
                last_attempt_at TEXT,
                last_error TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                next_retry_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );

            -- Create indexes for sync queue processing
            CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC, created_at ASC);
            CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON sync_queue(next_retry_at);
            CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
        "#,
    down: r#"
            DROP INDEX IF EXISTS idx_sync_queue_entity;
            DROP INDEX IF EXISTS idx_sync_queue_next_retry;
            DROP INDEX IF EXISTS idx_sync_queue_priority;
            DROP TABLE IF EXISTS sync_queue;

            DROP INDEX IF EXISTS idx_proofs_synced;
            DROP INDEX IF EXISTS idx_proofs_created_at;
            DROP INDEX IF EXISTS idx_proofs_check_result_id;
            DROP TABLE IF EXISTS proofs;

            DROP INDEX IF EXISTS idx_check_results_synced;
            DROP INDEX IF EXISTS idx_check_results_executed_at;
            DROP INDEX IF EXISTS idx_check_results_rule_id;
            DROP TABLE IF EXISTS check_results;

            DROP TABLE IF EXISTS check_rules;
            DROP TABLE IF EXISTS agent_config;
        "#,
}];

/// Initialize the schema_version table if it doesn't exist.
fn ensure_schema_version_table(conn: &Connection) -> StorageResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        "#,
    )
    .map_err(|e| {
        StorageError::Migration(format!("Failed to create schema_version table: {}", e))
    })?;

    debug!("Schema version table ready");
    Ok(())
}

/// Get the current schema version from the database.
fn get_schema_version(conn: &Connection) -> StorageResult<i32> {
    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| StorageError::Migration(format!("Failed to query schema version: {}", e)))?;

    Ok(version)
}

/// Run a single migration within a transaction.
fn run_migration(conn: &mut Connection, migration: &Migration) -> StorageResult<()> {
    info!(
        "Running migration v{}: {}",
        migration.version, migration.name
    );

    let tx = conn.transaction().map_err(|e| {
        StorageError::Migration(format!("Failed to start migration transaction: {}", e))
    })?;

    // Execute the migration SQL
    if let Err(e) = tx.execute_batch(migration.up) {
        error!(
            "Migration v{} failed: {}. Rolling back...",
            migration.version, e
        );
        // Transaction will automatically rollback on drop
        return Err(StorageError::Migration(format!(
            "Migration v{} failed: {}",
            migration.version, e
        )));
    }

    // Record the migration
    if let Err(e) = tx.execute(
        "INSERT INTO schema_version (version, name) VALUES (?, ?)",
        [&migration.version.to_string(), migration.name],
    ) {
        error!("Failed to record migration v{}: {}", migration.version, e);
        return Err(StorageError::Migration(format!(
            "Failed to record migration v{}: {}",
            migration.version, e
        )));
    }

    tx.commit().map_err(|e| {
        StorageError::Migration(format!(
            "Failed to commit migration v{}: {}",
            migration.version, e
        ))
    })?;

    info!(
        "Migration v{} ({}) applied successfully",
        migration.version, migration.name
    );
    Ok(())
}

/// Run pending migrations to bring database to current schema version.
pub fn run_migrations(conn: &mut Connection) -> StorageResult<()> {
    // Ensure schema_version table exists
    ensure_schema_version_table(conn)?;

    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| StorageError::Migration(format!("Failed to enable foreign keys: {}", e)))?;

    // Get current version
    let current_version = get_schema_version(conn)?;
    debug!("Current schema version: {}", current_version);

    if current_version >= CURRENT_SCHEMA_VERSION {
        debug!("Database schema is up to date (v{})", current_version);
        return Ok(());
    }

    info!(
        "Migrating database from v{} to v{}",
        current_version, CURRENT_SCHEMA_VERSION
    );

    // Run pending migrations
    for migration in MIGRATIONS.iter() {
        if migration.version > current_version {
            run_migration(conn, migration)?;
        }
    }

    info!(
        "Database migration complete. Now at schema version {}",
        CURRENT_SCHEMA_VERSION
    );
    Ok(())
}

/// Rollback a specific migration (for recovery/testing).
pub fn rollback_migration(conn: &mut Connection, version: i32) -> StorageResult<()> {
    let migration = MIGRATIONS
        .iter()
        .find(|m| m.version == version)
        .ok_or_else(|| StorageError::Migration(format!("Migration v{} not found", version)))?;

    let current_version = get_schema_version(conn)?;
    if version > current_version {
        warn!(
            "Migration v{} not applied (current: v{}), skipping rollback",
            version, current_version
        );
        return Ok(());
    }

    info!(
        "Rolling back migration v{}: {}",
        migration.version, migration.name
    );

    let tx = conn.transaction().map_err(|e| {
        StorageError::Migration(format!("Failed to start rollback transaction: {}", e))
    })?;

    // Execute rollback SQL
    tx.execute_batch(migration.down).map_err(|e| {
        StorageError::Migration(format!("Rollback v{} failed: {}", migration.version, e))
    })?;

    // Remove migration record
    tx.execute("DELETE FROM schema_version WHERE version = ?", [version])
        .map_err(|e| {
            StorageError::Migration(format!(
                "Failed to remove migration record v{}: {}",
                version, e
            ))
        })?;

    tx.commit().map_err(|e| {
        StorageError::Migration(format!(
            "Failed to commit rollback v{}: {}",
            migration.version, e
        ))
    })?;

    info!("Rollback of migration v{} complete", version);
    Ok(())
}

/// Check if database schema is up to date.
pub fn is_schema_current(conn: &Connection) -> StorageResult<bool> {
    ensure_schema_version_table(conn)?;
    let version = get_schema_version(conn)?;
    Ok(version >= CURRENT_SCHEMA_VERSION)
}

/// Get list of applied migrations.
pub fn get_applied_migrations(conn: &Connection) -> StorageResult<Vec<(i32, String, String)>> {
    ensure_schema_version_table(conn)?;

    let mut stmt = conn
        .prepare("SELECT version, name, applied_at FROM schema_version ORDER BY version")
        .map_err(|e| StorageError::Migration(format!("Failed to query migrations: {}", e)))?;

    let migrations = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| StorageError::Migration(format!("Failed to read migrations: {}", e)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| StorageError::Migration(format!("Failed to collect migrations: {}", e)))?;

    Ok(migrations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        (temp_dir, conn)
    }

    #[test]
    fn test_run_migrations() {
        let (_temp_dir, mut conn) = create_test_db();

        // Run migrations
        run_migrations(&mut conn).unwrap();

        // Verify schema version
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, CURRENT_SCHEMA_VERSION);

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"agent_config".to_string()));
        assert!(tables.contains(&"check_rules".to_string()));
        assert!(tables.contains(&"check_results".to_string()));
        assert!(tables.contains(&"proofs".to_string()));
        assert!(tables.contains(&"sync_queue".to_string()));
        assert!(tables.contains(&"schema_version".to_string()));
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let (_temp_dir, mut conn) = create_test_db();

        // Run migrations twice
        run_migrations(&mut conn).unwrap();
        run_migrations(&mut conn).unwrap();

        // Should still be at current version
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn test_foreign_key_constraint() {
        let (_temp_dir, mut conn) = create_test_db();
        run_migrations(&mut conn).unwrap();

        // Try to insert a check_result with invalid check_rule_id
        let result = conn.execute(
            "INSERT INTO check_results (check_rule_id, status, executed_at) VALUES (?, ?, ?)",
            ["nonexistent_rule", "pass", "2026-01-23T00:00:00Z"],
        );

        // Should fail due to foreign key constraint
        assert!(result.is_err());
    }

    #[test]
    fn test_insert_and_query_data() {
        let (_temp_dir, mut conn) = create_test_db();
        run_migrations(&mut conn).unwrap();

        // Insert a check rule
        conn.execute(
            r#"INSERT INTO check_rules (id, name, category, severity, check_type, version)
               VALUES ('disk_encryption', 'Disk Encryption Check', 'security', 'critical', 'disk_encryption', '1.0')"#,
            [],
        )
        .unwrap();

        // Insert a check result
        conn.execute(
            r#"INSERT INTO check_results (check_rule_id, status, score, executed_at)
               VALUES ('disk_encryption', 'pass', 100, '2026-01-23T12:00:00Z')"#,
            [],
        )
        .unwrap();

        // Get the result ID
        let result_id: i64 = conn
            .query_row("SELECT last_insert_rowid()", [], |row| row.get(0))
            .unwrap();

        // Insert a proof
        conn.execute(
            r#"INSERT INTO proofs (check_result_id, data, hash, created_at)
               VALUES (?, '{"bitlocker": "enabled"}', 'abc123hash', '2026-01-23T12:00:00Z')"#,
            [result_id],
        )
        .unwrap();

        // Query and verify
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM check_results WHERE status = 'pass'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Verify cascade delete
        conn.execute("DELETE FROM check_rules WHERE id = 'disk_encryption'", [])
            .unwrap();

        let result_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM check_results", [], |row| row.get(0))
            .unwrap();
        assert_eq!(result_count, 0);

        let proof_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM proofs", [], |row| row.get(0))
            .unwrap();
        assert_eq!(proof_count, 0);
    }

    #[test]
    fn test_rollback_migration() {
        let (_temp_dir, mut conn) = create_test_db();

        // Run migrations
        run_migrations(&mut conn).unwrap();
        assert_eq!(get_schema_version(&conn).unwrap(), 1);

        // Rollback
        rollback_migration(&mut conn, 1).unwrap();
        assert_eq!(get_schema_version(&conn).unwrap(), 0);

        // Verify our application tables are gone (excluding SQLite internal tables)
        let tables: Vec<String> = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table'
                 AND name NOT IN ('schema_version', 'sqlite_sequence')
                 ORDER BY name",
            )
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(
            tables.is_empty(),
            "Unexpected tables after rollback: {:?}",
            tables
        );
    }

    #[test]
    fn test_get_applied_migrations() {
        let (_temp_dir, mut conn) = create_test_db();
        run_migrations(&mut conn).unwrap();

        let migrations = get_applied_migrations(&conn).unwrap();
        assert_eq!(migrations.len(), 1);
        assert_eq!(migrations[0].0, 1);
        assert_eq!(migrations[0].1, "initial_schema");
    }

    #[test]
    fn test_sync_queue_constraints() {
        let (_temp_dir, mut conn) = create_test_db();
        run_migrations(&mut conn).unwrap();

        // Valid entity type
        conn.execute(
            "INSERT INTO sync_queue (entity_type, entity_id, payload) VALUES ('check_result', 1, '{}')",
            [],
        )
        .unwrap();

        // Invalid entity type should fail
        let result = conn.execute(
            "INSERT INTO sync_queue (entity_type, entity_id, payload) VALUES ('invalid_type', 1, '{}')",
            [],
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_check_results_status_constraint() {
        let (_temp_dir, mut conn) = create_test_db();
        run_migrations(&mut conn).unwrap();

        // Add a rule first
        conn.execute(
            "INSERT INTO check_rules (id, name, category, severity, check_type, version) VALUES ('test', 'Test', 'test', 'low', 'test', '1.0')",
            [],
        )
        .unwrap();

        // Valid status
        conn.execute(
            "INSERT INTO check_results (check_rule_id, status) VALUES ('test', 'pass')",
            [],
        )
        .unwrap();

        // Invalid status should fail
        let result = conn.execute(
            "INSERT INTO check_results (check_rule_id, status) VALUES ('test', 'invalid_status')",
            [],
        );
        assert!(result.is_err());
    }
}
