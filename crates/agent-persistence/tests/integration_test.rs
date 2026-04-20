// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-persistence.
//!
//! Tests GUI state persistence, database migrations,
//! and data lifecycle management.

use agent_persistence::{
    BackupReason, CleanupManager, CleanupResult, HardwareChangeResult, IntegrityCheck,
    IntegrityReport, KeyRotationManager, KeyRotationSchedule, MigrationManager, RecoveryAction,
    run_v2_migrations,
};
use agent_storage::{Database, DatabaseConfig, KeyManager};
use chrono::Utc;
use tempfile::TempDir;

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Create a temporary encrypted database ready for testing.
fn open_temp_db() -> (TempDir, Database) {
    let dir = TempDir::new().expect("TempDir::new should succeed in tests");
    let path = dir.path().join("sentinel_test.db");

    let config = DatabaseConfig::with_path(&path);
    let key_manager = KeyManager::new_with_test_key();

    let db =
        Database::open(config, &key_manager).expect("Database::open should succeed with test key");

    (dir, db)
}

// ─── BackupReason ───────────────────────────────────────────────────────────

#[test]
fn backup_reason_enum_variants_exist() {
    // Verify all expected variants are constructible and Debug-formattable.
    let reasons = [
        BackupReason::Scheduled,
        BackupReason::Manual,
        BackupReason::PreMigration,
        BackupReason::PreKeyRotation,
        BackupReason::PreUpdate,
    ];

    for reason in &reasons {
        let debug = format!("{:?}", reason);
        assert!(!debug.is_empty(), "BackupReason debug should be non-empty");
    }
}

#[test]
fn backup_reason_serializes_as_snake_case() {
    let json = serde_json::to_string(&BackupReason::PreKeyRotation)
        .expect("BackupReason should serialize");
    assert_eq!(json, r#""pre_key_rotation""#);
}

// ─── KeyRotationSchedule ───────────────────────────────────────────────────

#[test]
fn key_rotation_schedule_default_values() {
    let schedule = KeyRotationSchedule::default();

    assert_eq!(schedule.interval_days, 90);
    assert!(schedule.last_rotation.is_none());
    assert!(!schedule.auto_rotate);
}

#[test]
fn key_rotation_schedule_due_when_never_rotated() {
    let mut schedule = KeyRotationSchedule::default();
    // With auto_rotate disabled, rotation is never due.
    assert!(!schedule.is_rotation_due());

    // Enable auto-rotation; with no last_rotation, it should be due.
    schedule.auto_rotate = true;
    assert!(schedule.is_rotation_due());
}

#[test]
fn key_rotation_schedule_record_rotation_updates_timestamp() {
    let mut schedule = KeyRotationSchedule {
        interval_days: 30,
        last_rotation: None,
        auto_rotate: true,
    };

    assert!(schedule.last_rotation.is_none());
    schedule.record_rotation();
    assert!(schedule.last_rotation.is_some());
}

// ─── CleanupResult ──────────────────────────────────────────────────────────

#[test]
fn cleanup_result_default_construction() {
    let result = CleanupResult {
        removed: Vec::new(),
        failed: Vec::new(),
        complete: true,
    };

    assert!(result.removed.is_empty());
    assert!(result.failed.is_empty());
    assert!(result.complete);
}

#[test]
fn cleanup_manager_with_temp_dir() {
    let dir = TempDir::new().expect("TempDir::new should succeed");
    let manager = CleanupManager::with_data_dir(dir.path());

    // Running clean_uninstall on an empty temp dir should succeed and report complete.
    let result = manager.clean_uninstall();
    assert!(result.complete);
}

// ─── IntegrityReport ────────────────────────────────────────────────────────

#[test]
fn integrity_report_construction() {
    let report = IntegrityReport {
        passed: true,
        checks: vec![
            IntegrityCheck {
                name: "page_count".to_string(),
                passed: true,
                detail: "OK".to_string(),
            },
            IntegrityCheck {
                name: "foreign_keys".to_string(),
                passed: true,
                detail: "No violations".to_string(),
            },
        ],
        checked_at: Utc::now(),
        recommendation: None,
    };

    assert!(report.passed);
    assert_eq!(report.checks.len(), 2);
    assert!(report.recommendation.is_none());
}

#[test]
fn integrity_report_with_recovery_recommendation() {
    let report = IntegrityReport {
        passed: false,
        checks: vec![IntegrityCheck {
            name: "integrity_check".to_string(),
            passed: false,
            detail: "database disk image is malformed".to_string(),
        }],
        checked_at: Utc::now(),
        recommendation: Some(RecoveryAction::RestoreFromBackup),
    };

    assert!(!report.passed);
    assert!(matches!(
        report.recommendation,
        Some(RecoveryAction::RestoreFromBackup)
    ));
}

// ─── MigrationManager ──────────────────────────────────────────────────────

#[test]
fn migration_manager_is_constructible() {
    // MigrationManager is a unit struct; verify it exists and is usable.
    let _manager = MigrationManager;
    let debug = format!(
        "{:?}",
        HardwareChangeResult {
            changed: false,
            previous_machine_id: None,
            current_machine_id: Some("test-machine".to_string()),
            detail: "No change detected".to_string(),
        }
    );
    assert!(debug.contains("test-machine"));
}

// ─── V2 Migrations ─────────────────────────────────────────────────────────

#[tokio::test]
async fn run_v2_migrations_on_fresh_database() {
    let (_dir, db) = open_temp_db();

    // Run v2 migrations through the database connection.
    db.with_connection_mut(|conn| {
        run_v2_migrations(conn).map_err(|e| {
            agent_storage::StorageError::Migration(format!("v2 migration failed: {}", e))
        })
    })
    .await
    .expect("v2 migrations should succeed on a fresh database");

    // Verify the tables were created by inserting a row into each.
    db.with_connection(|conn| {
        conn.execute(
            "INSERT INTO agent_events (event_type, severity, title) VALUES ('test', 'info', 'test event')",
            [],
        )
        .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;

        conn.execute(
            "INSERT INTO notifications (id, title, body, severity) VALUES ('n1', 'Test', 'body', 'info')",
            [],
        )
        .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;

        conn.execute(
            "INSERT INTO policy_snapshots (total_policies, passing, failing, snapshot_type) \
             VALUES (10, 8, 2, 'manual')",
            [],
        )
        .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;

        Ok(())
    })
    .await
    .expect("Inserting rows into v2 tables should succeed after migration");
}

// ─── Repository construction ────────────────────────────────────────────────

#[tokio::test]
async fn repositories_are_constructible() {
    use agent_persistence::{EventsRepository, NotificationsRepository, PolicySnapshotsRepository};

    let (_dir, db) = open_temp_db();

    // Run v2 migrations so the tables exist.
    db.with_connection_mut(|conn| {
        run_v2_migrations(conn).map_err(|e| {
            agent_storage::StorageError::Migration(format!("v2 migration failed: {}", e))
        })
    })
    .await
    .expect("v2 migrations should succeed");

    // Verify each repository can be constructed from the database.
    let _events_repo = EventsRepository::new(&db);
    let _notifications_repo = NotificationsRepository::new(&db);
    let _policy_snapshots_repo = PolicySnapshotsRepository::new(&db);
}

// ─── KeyRotationManager ────────────────────────────────────────────────────

#[test]
fn key_rotation_manager_creation() {
    let dir = TempDir::new().expect("TempDir::new should succeed");
    let db_path = dir.path().join("sentinel.db");

    let _manager = KeyRotationManager::new(&db_path);
}
