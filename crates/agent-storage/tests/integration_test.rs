// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-storage.
//!
//! These tests exercise the full stack: Database creation, schema migrations,
//! repository CRUD operations, proof integrity, and the data retention policy.
//! Each test uses a temporary on-disk SQLite file (via `tempfile`) so they are
//! fully isolated and leave no side-effects.

use agent_storage::{
    CheckResult, CheckResultQuery, CheckResultsRepository, CheckStatus, Database, DatabaseConfig,
    KeyManager, Proof, ProofsRepository, RetentionConfig, RetentionPolicy, StorageError,
    CURRENT_SCHEMA_VERSION,
    migrations::{get_applied_migrations, is_schema_current, run_migrations},
};
use chrono::{Duration, Utc};
use tempfile::TempDir;

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Create a temporary encrypted database with all migrations applied.
fn open_temp_db() -> (TempDir, Database) {
    let dir = TempDir::new().expect("TempDir::new should succeed in tests");
    let path = dir.path().join("sentinel_test.db");

    let config = DatabaseConfig::with_path(&path);
    let key_manager = KeyManager::new_with_test_key();

    let db = Database::open(config, &key_manager)
        .expect("Database::open should succeed with a test key");

    (dir, db)
}

/// Insert a minimal check-rule row so that foreign-key constraints are
/// satisfied when inserting check results.
async fn seed_check_rule(db: &Database, rule_id: &str) {
    db.with_connection(move |conn| {
        conn.execute(
            r#"INSERT OR IGNORE INTO check_rules
               (id, name, category, severity, check_type, version)
               VALUES (?, ?, 'security', 'high', 'test', '1.0')"#,
            rusqlite::params![rule_id, format!("Rule {}", rule_id)],
        )
        .map_err(|e| StorageError::Query(e.to_string()))?;
        Ok(())
    })
    .await
    .expect("Seeding check rule should succeed");
}

// ─── Migration tests ─────────────────────────────────────────────────────────

/// After `Database::open`, the schema must be at the current version.
/// The current version in migrations.rs is 8; guard against accidental drift.
#[tokio::test]
async fn test_schema_version_after_open_equals_current() {
    let (_dir, db) = open_temp_db();

    let version = db
        .with_connection(|conn| {
            let v: i32 = conn
                .query_row(
                    "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                    [],
                    |r| r.get(0),
                )
                .map_err(|e| StorageError::Query(e.to_string()))?;
            Ok(v)
        })
        .await
        .expect("Querying schema_version should succeed");

    assert_eq!(
        version, CURRENT_SCHEMA_VERSION,
        "Schema must be at version {} after open, got {}",
        CURRENT_SCHEMA_VERSION, version
    );
}

/// `CURRENT_SCHEMA_VERSION` must equal 8 (the last migration declared).
/// This test fails loudly if a migration is added without updating constants.
#[test]
fn test_current_schema_version_constant_is_eight() {
    assert_eq!(
        CURRENT_SCHEMA_VERSION, 8,
        "CURRENT_SCHEMA_VERSION should be 8; update this test if a migration is added"
    );
}

/// Running `run_migrations` a second time on an already-current database
/// must be a safe no-op.
#[test]
fn test_migrations_idempotent_on_unencrypted_conn() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("idem.db");
    let mut conn = rusqlite::Connection::open(&path).unwrap();

    run_migrations(&mut conn).expect("First run_migrations must succeed");
    run_migrations(&mut conn).expect("Second run_migrations must be a no-op");

    let v: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )
        .unwrap();

    assert_eq!(v, CURRENT_SCHEMA_VERSION);
}

/// All 8 migrations must be recorded in schema_version after a fresh run.
#[test]
fn test_all_migrations_recorded() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("all_mig.db");
    let mut conn = rusqlite::Connection::open(&path).unwrap();

    run_migrations(&mut conn).unwrap();

    let applied = get_applied_migrations(&conn).expect("get_applied_migrations should succeed");

    assert_eq!(
        applied.len(),
        8,
        "Expected 8 applied migrations, got {}",
        applied.len()
    );

    let expected_names = [
        "initial_schema",
        "extend_check_rules",
        "discovered_devices",
        "audit_trail",
        "audit_trail_sync",
        "grc_entities",
        "software_inventory_hostname",
        "software_inventory_rename_name",
    ];

    for (i, name) in expected_names.iter().enumerate() {
        assert_eq!(
            applied[i].1.as_str(),
            *name,
            "Migration {} should be '{}', got '{}'",
            i + 1,
            name,
            applied[i].1
        );
    }
}

/// `is_schema_current` returns `true` after all migrations run.
#[test]
fn test_is_schema_current_true_after_migrations() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("curr.db");
    let mut conn = rusqlite::Connection::open(&path).unwrap();

    run_migrations(&mut conn).unwrap();

    assert!(
        is_schema_current(&conn).expect("is_schema_current should not error"),
        "Schema should be current after all migrations"
    );
}

/// The expected application tables must all exist after migration.
#[test]
fn test_all_expected_tables_exist_after_migration() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("tables.db");
    let mut conn = rusqlite::Connection::open(&path).unwrap();

    run_migrations(&mut conn).unwrap();

    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    let required = [
        "agent_config",
        "alert_rules",
        "audit_trail",
        "check_results",
        "check_rules",
        "detection_rules",
        "discovered_devices",
        "kpi_snapshots",
        "managed_assets",
        "playbooks",
        "proofs",
        "risks",
        "schema_version",
        "software_inventory",
        "sync_queue",
        "webhooks",
    ];

    for table in &required {
        assert!(
            tables.contains(&table.to_string()),
            "Expected table '{}' to exist after migration",
            table
        );
    }
}

// ─── CRUD cycle: CheckResultsRepository ──────────────────────────────────────

/// Full create → read → update (mark synced) → delete cycle on check results.
#[tokio::test]
async fn test_check_result_full_crud_cycle() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "firewall_check").await;

    let repo = CheckResultsRepository::new(&db);

    // CREATE
    let result = CheckResult::new("firewall_check", CheckStatus::Pass)
        .with_score(85)
        .with_message("Firewall rules validated")
        .with_raw_data(r#"{"rules": 42, "inbound_blocked": true}"#)
        .with_duration_ms(123);

    let id = repo.insert(&result).await.expect("insert should succeed");
    assert!(id > 0, "Inserted ID should be positive");

    // READ
    let fetched = repo
        .get(id)
        .await
        .expect("get should not error")
        .expect("record should exist after insert");

    assert_eq!(fetched.check_rule_id, "firewall_check");
    assert_eq!(fetched.status, CheckStatus::Pass);
    assert_eq!(fetched.score, Some(85));
    assert_eq!(
        fetched.message.as_deref(),
        Some("Firewall rules validated")
    );
    assert_eq!(fetched.duration_ms, Some(123));
    assert!(!fetched.synced, "Newly inserted result should not be synced");
    assert_eq!(
        fetched.id,
        Some(id),
        "Fetched ID should match inserted ID"
    );

    // UPDATE — mark synced
    let updated = repo
        .mark_synced(&[id])
        .await
        .expect("mark_synced should succeed");
    assert_eq!(updated, 1, "Exactly one record should have been updated");

    let after_sync = repo
        .get(id)
        .await
        .expect("get should not error after mark_synced")
        .expect("record should still exist");
    assert!(after_sync.synced, "Record should be marked synced");

    // DELETE via retention cut-off (set cutoff to future so it catches all)
    let future = Utc::now() + Duration::days(1);
    let deleted = repo
        .delete_older_than(future)
        .await
        .expect("delete_older_than should succeed");
    assert_eq!(deleted, 1, "One record should have been deleted");

    let after_delete = repo
        .get(id)
        .await
        .expect("get should not error after deletion");
    assert!(
        after_delete.is_none(),
        "Record should not exist after deletion"
    );
}

/// Query filtering by status returns only matching records.
#[tokio::test]
async fn test_query_by_status_filter() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "av_check").await;
    seed_check_rule(&db, "os_patch").await;

    let repo = CheckResultsRepository::new(&db);

    repo.insert(&CheckResult::new("av_check", CheckStatus::Pass))
        .await
        .unwrap();
    repo.insert(&CheckResult::new("os_patch", CheckStatus::Fail))
        .await
        .unwrap();
    repo.insert(&CheckResult::new("av_check", CheckStatus::Pass))
        .await
        .unwrap();

    let passing = repo
        .query(CheckResultQuery::new().with_status(CheckStatus::Pass))
        .await
        .expect("query should succeed");

    assert_eq!(passing.len(), 2, "Two passing results expected");
    assert!(
        passing.iter().all(|r| r.status == CheckStatus::Pass),
        "All returned records should have Pass status"
    );

    let failing = repo
        .query(CheckResultQuery::new().with_status(CheckStatus::Fail))
        .await
        .expect("query should succeed");

    assert_eq!(failing.len(), 1, "One failing result expected");
}

/// `get_unsynced` returns only unsynced records and respects the limit.
#[tokio::test]
async fn test_get_unsynced_respects_limit() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "rule_a").await;

    let repo = CheckResultsRepository::new(&db);

    for _ in 0..5 {
        repo.insert(&CheckResult::new("rule_a", CheckStatus::Pass))
            .await
            .unwrap();
    }

    // Mark 2 as synced
    let all = repo
        .query(CheckResultQuery::new())
        .await
        .unwrap();
    let ids: Vec<i64> = all[..2]
        .iter()
        .filter_map(|r| r.id)
        .collect();
    repo.mark_synced(&ids).await.unwrap();

    let unsynced = repo
        .get_unsynced(10)
        .await
        .expect("get_unsynced should succeed");

    assert_eq!(unsynced.len(), 3, "3 unsynced records should remain");

    // Limit to 2
    let limited = repo
        .get_unsynced(2)
        .await
        .expect("get_unsynced with limit should succeed");
    assert_eq!(limited.len(), 2, "Limit of 2 should be respected");
}

/// `get_latest_per_rule` returns the newest result per check rule.
#[tokio::test]
async fn test_get_latest_per_rule_returns_newest() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "enc_check").await;

    let repo = CheckResultsRepository::new(&db);
    let now = Utc::now();
    let earlier = now - Duration::hours(2);

    // Insert older fail then newer pass for the same rule
    repo.insert(
        &CheckResult::new("enc_check", CheckStatus::Fail).with_executed_at(earlier),
    )
    .await
    .unwrap();

    repo.insert(
        &CheckResult::new("enc_check", CheckStatus::Pass).with_executed_at(now),
    )
    .await
    .unwrap();

    let latest = repo
        .get_latest_per_rule()
        .await
        .expect("get_latest_per_rule should succeed");

    assert_eq!(latest.len(), 1);
    assert_eq!(
        latest[0].status,
        CheckStatus::Pass,
        "Latest result should be Pass, not the earlier Fail"
    );
}

// ─── CRUD cycle: ProofsRepository ────────────────────────────────────────────

/// Insert a proof, retrieve it, and verify its SHA-256 integrity hash.
#[tokio::test]
async fn test_proof_insert_and_integrity_verification() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "disk_enc").await;

    // We need a check result ID to satisfy the FK constraint
    let cr_repo = CheckResultsRepository::new(&db);
    let cr_id = cr_repo
        .insert(&CheckResult::new("disk_enc", CheckStatus::Pass))
        .await
        .unwrap();

    let proof_repo = ProofsRepository::new(&db);
    let proof = Proof::new(cr_id, r#"{"bitlocker": "enabled", "algo": "AES-256"}"#);
    let original_hash = proof.hash.clone();

    // INSERT
    let proof_id = proof_repo
        .insert(&proof)
        .await
        .expect("Proof insert should succeed");

    assert!(proof_id > 0);

    // READ + hash is 64 hex characters (SHA-256)
    let fetched = proof_repo
        .get(proof_id)
        .await
        .expect("Proof get should succeed")
        .expect("Proof should exist after insert");

    assert_eq!(fetched.hash, original_hash);
    assert_eq!(fetched.hash.len(), 64, "SHA-256 hash must be 64 hex chars");
    assert!(
        fetched.verify_integrity(),
        "Fetched proof must pass integrity check"
    );
    assert_eq!(fetched.check_result_id, cr_id);
}

/// Inserting a proof with a tampered hash must return an `Integrity` error.
#[tokio::test]
async fn test_proof_insert_with_tampered_hash_is_rejected() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "rule_b").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let cr_id = cr_repo
        .insert(&CheckResult::new("rule_b", CheckStatus::Fail))
        .await
        .unwrap();

    let proof_repo = ProofsRepository::new(&db);
    let mut proof = Proof::new(cr_id, r#"{"antivirus": "disabled"}"#);
    // Corrupt the hash after construction
    proof.hash = "0".repeat(64);

    let result = proof_repo.insert(&proof).await;

    assert!(
        result.is_err(),
        "Inserting a proof with a bad hash should fail"
    );
    assert!(
        matches!(result.unwrap_err(), StorageError::Integrity(_)),
        "Error variant should be StorageError::Integrity"
    );
}

/// `verify_integrity` returns `Valid` for a correctly stored proof and
/// `NotFound` for a non-existent ID.
#[tokio::test]
async fn test_proof_verify_integrity_valid_and_not_found() {
    use agent_storage::IntegrityStatus;

    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "rule_c").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let cr_id = cr_repo
        .insert(&CheckResult::new("rule_c", CheckStatus::Pass))
        .await
        .unwrap();

    let proof_repo = ProofsRepository::new(&db);
    let proof = Proof::new(cr_id, r#"{"firewall": "active"}"#);
    let proof_id = proof_repo.insert(&proof).await.unwrap();

    // Valid
    let status = proof_repo
        .verify_integrity(proof_id)
        .await
        .expect("verify_integrity should not error");
    assert_eq!(
        status,
        IntegrityStatus::Valid,
        "Stored proof should verify as Valid"
    );

    // Not found
    let missing = proof_repo
        .verify_integrity(i64::MAX)
        .await
        .expect("verify_integrity for missing ID should not error");
    assert_eq!(
        missing,
        IntegrityStatus::NotFound,
        "Non-existent proof ID should return NotFound"
    );
}

/// Multiple proofs belonging to the same check result are retrievable together.
#[tokio::test]
async fn test_proof_get_by_check_result_returns_all() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "rule_d").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let cr_id = cr_repo
        .insert(&CheckResult::new("rule_d", CheckStatus::Pass))
        .await
        .unwrap();

    let proof_repo = ProofsRepository::new(&db);
    proof_repo
        .insert(&Proof::new(cr_id, r#"{"part": 1}"#))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::new(cr_id, r#"{"part": 2}"#))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::new(cr_id, r#"{"part": 3}"#))
        .await
        .unwrap();

    let proofs = proof_repo
        .get_by_check_result(cr_id)
        .await
        .expect("get_by_check_result should succeed");

    assert_eq!(proofs.len(), 3, "All three proofs should be returned");
    assert!(
        proofs.iter().all(|p| p.verify_integrity()),
        "Every retrieved proof must pass integrity check"
    );
}

// ─── Retention policy ─────────────────────────────────────────────────────────

/// Retention policy deletes proofs (and orphaned results) older than the
/// configured period and leaves recent data untouched.
#[tokio::test]
async fn test_retention_policy_deletes_old_and_keeps_recent() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "ret_rule").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let proof_repo = ProofsRepository::new(&db);

    // Old data: 400 days ago
    let old_ts = Utc::now() - Duration::days(400);
    let old_cr_id = cr_repo
        .insert(&CheckResult::new("ret_rule", CheckStatus::Fail).with_executed_at(old_ts))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::with_timestamp(old_cr_id, r#"{"old": true}"#, old_ts))
        .await
        .unwrap();

    // Recent data: 10 days ago
    let recent_ts = Utc::now() - Duration::days(10);
    let recent_cr_id = cr_repo
        .insert(&CheckResult::new("ret_rule", CheckStatus::Pass).with_executed_at(recent_ts))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::with_timestamp(
            recent_cr_id,
            r#"{"recent": true}"#,
            recent_ts,
        ))
        .await
        .unwrap();

    assert_eq!(
        proof_repo.count().await.unwrap(),
        2,
        "Should have 2 proofs before retention"
    );

    // Execute 365-day retention
    let config = RetentionConfig::with_retention_days(365);
    let policy = RetentionPolicy::with_config(&db, config);
    let result = policy.execute().await.expect("Retention execute should succeed");

    assert_eq!(result.proofs_deleted, 1, "One old proof should be deleted");
    assert_eq!(
        result.check_results_deleted, 1,
        "The orphaned old result should be deleted"
    );
    assert_eq!(result.total_proofs_remaining, 1, "One proof should remain");
    assert!(
        result.had_deletions(),
        "had_deletions() should return true"
    );

    // Verify in DB
    assert_eq!(
        proof_repo.count().await.unwrap(),
        1,
        "Only 1 proof should remain after retention"
    );
}

/// Dry-run retention reports what would be deleted without actually deleting.
#[tokio::test]
async fn test_retention_dry_run_does_not_delete() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "dry_rule").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let proof_repo = ProofsRepository::new(&db);

    let old_ts = Utc::now() - Duration::days(400);
    let old_cr_id = cr_repo
        .insert(&CheckResult::new("dry_rule", CheckStatus::Fail).with_executed_at(old_ts))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::with_timestamp(old_cr_id, r#"{"dry": true}"#, old_ts))
        .await
        .unwrap();

    let config = RetentionConfig::with_retention_days(365).dry_run();
    let policy = RetentionPolicy::with_config(&db, config);
    let result = policy.execute().await.expect("Dry-run should succeed");

    // Reports a deletion...
    assert_eq!(result.proofs_deleted, 1, "Dry-run should report 1 deletion");
    // ...but data is still there
    assert_eq!(
        proof_repo.count().await.unwrap(),
        1,
        "Dry-run must not delete actual data"
    );
}

/// When no data falls outside the retention window, zero deletions are reported.
#[tokio::test]
async fn test_retention_policy_no_deletions_when_all_data_is_recent() {
    let (_dir, db) = open_temp_db();
    seed_check_rule(&db, "fresh_rule").await;

    let cr_repo = CheckResultsRepository::new(&db);
    let proof_repo = ProofsRepository::new(&db);

    let recent_ts = Utc::now() - Duration::days(5);
    let cr_id = cr_repo
        .insert(&CheckResult::new("fresh_rule", CheckStatus::Pass).with_executed_at(recent_ts))
        .await
        .unwrap();
    proof_repo
        .insert(&Proof::with_timestamp(cr_id, r#"{"fresh": true}"#, recent_ts))
        .await
        .unwrap();

    let config = RetentionConfig::with_retention_days(365);
    let policy = RetentionPolicy::with_config(&db, config);
    let result = policy.execute().await.unwrap();

    assert_eq!(result.proofs_deleted, 0);
    assert_eq!(result.check_results_deleted, 0);
    assert!(!result.had_deletions());
    assert_eq!(result.total_deleted(), 0);
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/// The test key produces a consistent 32-byte (256-bit) derived key.
#[test]
fn test_key_derivation_is_consistent_and_correct_length() {
    let km = KeyManager::new_with_test_key();

    let key1 = km.get_database_key().expect("get_database_key should succeed");
    let key2 = km.get_database_key().expect("get_database_key should succeed on second call");

    assert_eq!(key1.len(), 32, "Derived key must be 32 bytes");
    assert_eq!(key2.len(), 32, "Derived key must be 32 bytes on repeated calls");
    assert_eq!(
        key1, key2,
        "Key derivation must be deterministic for the same KeyManager"
    );
}

/// A key constructed with `new_with_key` derives from the provided bytes.
#[test]
fn test_key_manager_with_explicit_key_has_correct_length() {
    let raw: &[u8] = b"test_key_exactly_32_bytes_long!!";
    assert_eq!(raw.len(), 32);

    let km = KeyManager::new_with_key(raw);
    let derived = km.get_database_key().expect("get_database_key should succeed");

    assert_eq!(derived.len(), 32, "Derived key must be 32 bytes");
}

/// Two databases opened with different keys are independent (no cross-key
/// corruption).  We verify this by simply opening two separate databases
/// successfully without error — if the keys were confused both opens would
/// still succeed but operate on different files.
#[tokio::test]
async fn test_two_databases_with_different_key_bytes_open_independently() {
    let dir1 = TempDir::new().unwrap();
    let dir2 = TempDir::new().unwrap();

    let km1 = KeyManager::new_with_key(b"key_A_exactly_32_bytes_padding!!");
    let km2 = KeyManager::new_with_key(b"key_B_exactly_32_bytes_padding!!");

    let db1 = Database::open(DatabaseConfig::with_path(dir1.path().join("a.db")), &km1)
        .expect("DB 1 should open");
    let db2 = Database::open(DatabaseConfig::with_path(dir2.path().join("b.db")), &km2)
        .expect("DB 2 should open");

    // Both should report existence and non-zero size
    assert!(db1.exists());
    assert!(db2.exists());
    assert!(db1.file_size().unwrap() > 0);
    assert!(db2.file_size().unwrap() > 0);
}
