//! Proof storage repository with SHA-256 integrity verification.
//!
//! This module provides tamper-evident storage for compliance proofs:
//! - SHA-256 hash computed from (check_result_id + data + created_at)
//! - ISO 8601 UTC timestamps
//! - Integrity verification by recomputing hash
//! - Linked to check results via foreign key

use crate::error::{StorageError, StorageResult};
use crate::Database;
use chrono::{DateTime, Utc};
use hex;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::{debug, info, warn};

/// A compliance proof record with integrity hash.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proof {
    /// Unique identifier (auto-generated).
    pub id: Option<i64>,
    /// Reference to the check result this proof belongs to.
    pub check_result_id: i64,
    /// Proof data as JSON.
    pub data: String,
    /// SHA-256 integrity hash (hex-encoded).
    pub hash: String,
    /// Timestamp of creation (ISO 8601 UTC).
    pub created_at: DateTime<Utc>,
    /// Whether this proof has been synced to SaaS.
    pub synced: bool,
}

impl Proof {
    /// Create a new proof with computed integrity hash.
    ///
    /// The hash is computed as SHA-256(check_result_id || data || created_at).
    pub fn new(check_result_id: i64, data: impl Into<String>) -> Self {
        let data = data.into();
        let created_at = Utc::now();
        let hash = Self::compute_hash(check_result_id, &data, &created_at);

        Self {
            id: None,
            check_result_id,
            data,
            hash,
            created_at,
            synced: false,
        }
    }

    /// Create a proof with a specific timestamp (for testing or migration).
    pub fn with_timestamp(
        check_result_id: i64,
        data: impl Into<String>,
        created_at: DateTime<Utc>,
    ) -> Self {
        let data = data.into();
        let hash = Self::compute_hash(check_result_id, &data, &created_at);

        Self {
            id: None,
            check_result_id,
            data,
            hash,
            created_at,
            synced: false,
        }
    }

    /// Compute SHA-256 integrity hash from proof components.
    ///
    /// Hash = SHA-256(check_result_id || data || created_at)
    /// where created_at is in RFC 3339 format.
    pub fn compute_hash(check_result_id: i64, data: &str, created_at: &DateTime<Utc>) -> String {
        let mut hasher = Sha256::new();

        // Hash components in order: check_result_id, data, timestamp
        hasher.update(check_result_id.to_le_bytes());
        hasher.update(data.as_bytes());
        hasher.update(created_at.to_rfc3339().as_bytes());

        let result = hasher.finalize();
        hex::encode(result)
    }

    /// Verify the integrity of this proof by recomputing the hash.
    ///
    /// Returns true if the stored hash matches the computed hash.
    pub fn verify_integrity(&self) -> bool {
        let computed_hash = Self::compute_hash(self.check_result_id, &self.data, &self.created_at);
        self.hash == computed_hash
    }

    /// Get the hash as bytes (for binary comparisons).
    pub fn hash_bytes(&self) -> Result<Vec<u8>, hex::FromHexError> {
        hex::decode(&self.hash)
    }
}

/// Result of integrity verification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IntegrityStatus {
    /// Proof integrity verified successfully.
    Valid,
    /// Proof has been tampered with (hash mismatch).
    Tampered {
        expected_hash: String,
        actual_hash: String,
    },
    /// Proof not found.
    NotFound,
}

/// Repository for proof CRUD operations with integrity verification.
pub struct ProofsRepository<'a> {
    db: &'a Database,
}

impl<'a> ProofsRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Insert a new proof.
    ///
    /// The proof's hash is verified before insertion to ensure data integrity.
    pub async fn insert(&self, proof: &Proof) -> StorageResult<i64> {
        // Verify hash is valid before inserting
        if !proof.verify_integrity() {
            return Err(StorageError::Integrity(
                "Proof hash does not match computed hash".to_string(),
            ));
        }

        let check_result_id = proof.check_result_id;
        let data = proof.data.clone();
        let hash = proof.hash.clone();
        let created_at = proof.created_at.to_rfc3339();
        let synced = if proof.synced { 1 } else { 0 };

        self.db
            .with_connection(|conn| {
                conn.execute(
                    r#"
                    INSERT INTO proofs (check_result_id, data, hash, created_at, synced)
                    VALUES (?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![check_result_id, data, hash, created_at, synced],
                )
                .map_err(|e| StorageError::Query(format!("Failed to insert proof: {}", e)))?;

                let id = conn.last_insert_rowid();
                debug!("Inserted proof with ID: {} (hash: {}...)", id, &hash[..16]);
                Ok(id)
            })
            .await
    }

    /// Get a proof by ID.
    pub async fn get(&self, id: i64) -> StorageResult<Option<Proof>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, check_result_id, data, hash, created_at, synced
                        FROM proofs
                        WHERE id = ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let result = stmt
                    .query_row([id], |row| Ok(Self::row_to_proof(row)?))
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to query proof: {}", e)))?;

                Ok(result)
            })
            .await
    }

    /// Get all proofs for a check result.
    pub async fn get_by_check_result(&self, check_result_id: i64) -> StorageResult<Vec<Proof>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, check_result_id, data, hash, created_at, synced
                        FROM proofs
                        WHERE check_result_id = ?
                        ORDER BY created_at DESC
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([check_result_id], |row| Ok(Self::row_to_proof(row)?))
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect results: {}", e)))?;

                Ok(results)
            })
            .await
    }

    /// Verify the integrity of a proof by ID.
    pub async fn verify_integrity(&self, id: i64) -> StorageResult<IntegrityStatus> {
        let proof = self.get(id).await?;

        match proof {
            Some(p) => {
                if p.verify_integrity() {
                    Ok(IntegrityStatus::Valid)
                } else {
                    let expected = Proof::compute_hash(p.check_result_id, &p.data, &p.created_at);
                    warn!(
                        "Proof {} integrity check failed! Expected: {}, Stored: {}",
                        id, expected, p.hash
                    );
                    Ok(IntegrityStatus::Tampered {
                        expected_hash: expected,
                        actual_hash: p.hash,
                    })
                }
            }
            None => Ok(IntegrityStatus::NotFound),
        }
    }

    /// Verify integrity of all proofs for a check result.
    pub async fn verify_all_for_result(
        &self,
        check_result_id: i64,
    ) -> StorageResult<Vec<(i64, IntegrityStatus)>> {
        let proofs = self.get_by_check_result(check_result_id).await?;

        let mut results = Vec::new();
        for proof in proofs {
            let id = proof.id.unwrap_or(0);
            let status = if proof.verify_integrity() {
                IntegrityStatus::Valid
            } else {
                let expected =
                    Proof::compute_hash(proof.check_result_id, &proof.data, &proof.created_at);
                IntegrityStatus::Tampered {
                    expected_hash: expected,
                    actual_hash: proof.hash,
                }
            };
            results.push((id, status));
        }

        Ok(results)
    }

    /// Get unsynced proofs for upload.
    pub async fn get_unsynced(&self, limit: i64) -> StorageResult<Vec<Proof>> {
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, check_result_id, data, hash, created_at, synced
                        FROM proofs
                        WHERE synced = 0
                        ORDER BY created_at ASC
                        LIMIT ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([limit], |row| Ok(Self::row_to_proof(row)?))
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect results: {}", e)))?;

                Ok(results)
            })
            .await
    }

    /// Mark proofs as synced.
    pub async fn mark_synced(&self, ids: &[i64]) -> StorageResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }

        let ids = ids.to_vec();
        self.db
            .with_connection(move |conn| {
                let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
                let sql = format!(
                    "UPDATE proofs SET synced = 1 WHERE id IN ({})",
                    placeholders.join(", ")
                );

                let params: Vec<&dyn rusqlite::ToSql> =
                    ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

                let count = conn
                    .execute(&sql, params.as_slice())
                    .map_err(|e| StorageError::Query(format!("Failed to mark synced: {}", e)))?;

                info!("Marked {} proofs as synced", count);
                Ok(count)
            })
            .await
    }

    /// Delete proofs older than the specified date.
    ///
    /// Note: This is typically called by the data retention policy.
    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> StorageResult<usize> {
        let before_str = before.to_rfc3339();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute("DELETE FROM proofs WHERE created_at < ?", [&before_str])
                    .map_err(|e| StorageError::Query(format!("Failed to delete old proofs: {}", e)))?;

                info!("Deleted {} proofs older than {}", count, before_str);
                Ok(count)
            })
            .await
    }

    /// Count total proofs.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM proofs", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count proofs: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Get storage statistics (count, total size, oldest/newest).
    pub async fn get_stats(&self) -> StorageResult<ProofStats> {
        self.db
            .with_connection(|conn| {
                let (count, total_size): (i64, i64) = conn
                    .query_row(
                        "SELECT COUNT(*), COALESCE(SUM(LENGTH(data)), 0) FROM proofs",
                        [],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to get stats: {}", e)))?;

                let oldest: Option<String> = conn
                    .query_row(
                        "SELECT MIN(created_at) FROM proofs",
                        [],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to get oldest: {}", e)))?
                    .flatten();

                let newest: Option<String> = conn
                    .query_row(
                        "SELECT MAX(created_at) FROM proofs",
                        [],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to get newest: {}", e)))?
                    .flatten();

                let oldest_at = oldest.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                let newest_at = newest.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                });

                Ok(ProofStats {
                    count,
                    total_data_bytes: total_size,
                    oldest_at,
                    newest_at,
                })
            })
            .await
    }

    /// Convert a database row to a Proof.
    fn row_to_proof(row: &rusqlite::Row<'_>) -> rusqlite::Result<Proof> {
        let id: i64 = row.get(0)?;
        let check_result_id: i64 = row.get(1)?;

        let created_at_str: String = row.get(4)?;
        let created_at = match DateTime::parse_from_rfc3339(&created_at_str) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(e) => {
                warn!(
                    "Failed to parse timestamp '{}' for proof {} (result_id={}): {}. Using current time. This may affect retention policy calculations.",
                    created_at_str, id, check_result_id, e
                );
                Utc::now()
            }
        };

        let synced_int: i32 = row.get(5)?;

        Ok(Proof {
            id: Some(id),
            check_result_id,
            data: row.get(2)?,
            hash: row.get(3)?,
            created_at,
            synced: synced_int != 0,
        })
    }
}

/// Statistics about stored proofs.
#[derive(Debug, Clone)]
pub struct ProofStats {
    /// Total number of proofs.
    pub count: i64,
    /// Total size of proof data in bytes.
    pub total_data_bytes: i64,
    /// Timestamp of oldest proof.
    pub oldest_at: Option<DateTime<Utc>>,
    /// Timestamp of newest proof.
    pub newest_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::CheckResultsRepository;
    use crate::repositories::check_results::{CheckResult, CheckStatus};
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
            Ok(())
        })
        .await
        .unwrap();

        (temp_dir, db)
    }

    async fn create_test_check_result(db: &Database) -> i64 {
        let repo = CheckResultsRepository::new(db);
        let result = CheckResult::new("disk_encryption", CheckStatus::Pass)
            .with_score(100)
            .with_message("BitLocker enabled");
        repo.insert(&result).await.unwrap()
    }

    #[tokio::test]
    async fn test_proof_hash_computation() {
        let check_result_id = 42;
        let data = r#"{"bitlocker": "enabled", "protection_status": "on"}"#;
        let timestamp = Utc::now();

        let hash1 = Proof::compute_hash(check_result_id, data, &timestamp);
        let hash2 = Proof::compute_hash(check_result_id, data, &timestamp);

        // Same inputs should produce same hash
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 produces 64 hex chars

        // Different data should produce different hash
        let hash3 = Proof::compute_hash(check_result_id, "different data", &timestamp);
        assert_ne!(hash1, hash3);
    }

    #[tokio::test]
    async fn test_proof_integrity_verification() {
        let proof = Proof::new(42, r#"{"test": "data"}"#);

        // Valid proof should verify
        assert!(proof.verify_integrity());

        // Tampered proof should not verify
        let mut tampered = proof.clone();
        tampered.data = r#"{"test": "modified"}"#.to_string();
        assert!(!tampered.verify_integrity());

        // Tampered hash should not verify
        let mut bad_hash = proof.clone();
        bad_hash.hash = "0".repeat(64);
        assert!(!bad_hash.verify_integrity());
    }

    #[tokio::test]
    async fn test_insert_and_get() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);
        let proof = Proof::new(check_result_id, r#"{"encryption": "enabled"}"#);
        let original_hash = proof.hash.clone();

        let id = repo.insert(&proof).await.unwrap();
        assert!(id > 0);

        let retrieved = repo.get(id).await.unwrap().unwrap();
        assert_eq!(retrieved.check_result_id, check_result_id);
        assert_eq!(retrieved.hash, original_hash);
        assert!(retrieved.verify_integrity());
    }

    #[tokio::test]
    async fn test_insert_invalid_hash_fails() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);
        let mut proof = Proof::new(check_result_id, r#"{"test": "data"}"#);
        proof.hash = "invalid_hash".to_string();

        let result = repo.insert(&proof).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), StorageError::Integrity(_)));
    }

    #[tokio::test]
    async fn test_get_by_check_result() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);

        // Insert multiple proofs for same result
        repo.insert(&Proof::new(check_result_id, r#"{"part": 1}"#))
            .await
            .unwrap();
        repo.insert(&Proof::new(check_result_id, r#"{"part": 2}"#))
            .await
            .unwrap();

        let proofs = repo.get_by_check_result(check_result_id).await.unwrap();
        assert_eq!(proofs.len(), 2);
    }

    #[tokio::test]
    async fn test_verify_integrity_valid() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);
        let proof = Proof::new(check_result_id, r#"{"test": "data"}"#);
        let id = repo.insert(&proof).await.unwrap();

        let status = repo.verify_integrity(id).await.unwrap();
        assert_eq!(status, IntegrityStatus::Valid);
    }

    #[tokio::test]
    async fn test_verify_integrity_not_found() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ProofsRepository::new(&db);

        let status = repo.verify_integrity(99999).await.unwrap();
        assert_eq!(status, IntegrityStatus::NotFound);
    }

    #[tokio::test]
    async fn test_mark_synced() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);
        let id1 = repo
            .insert(&Proof::new(check_result_id, r#"{"a": 1}"#))
            .await
            .unwrap();
        let id2 = repo
            .insert(&Proof::new(check_result_id, r#"{"b": 2}"#))
            .await
            .unwrap();

        // Initially unsynced
        let unsynced = repo.get_unsynced(10).await.unwrap();
        assert_eq!(unsynced.len(), 2);

        // Mark as synced
        let count = repo.mark_synced(&[id1, id2]).await.unwrap();
        assert_eq!(count, 2);

        // Should be empty now
        let unsynced = repo.get_unsynced(10).await.unwrap();
        assert!(unsynced.is_empty());
    }

    #[tokio::test]
    async fn test_delete_older_than() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);
        let now = Utc::now();
        let old_date = now - chrono::Duration::days(400);

        // Insert old proof
        repo.insert(&Proof::with_timestamp(
            check_result_id,
            r#"{"old": true}"#,
            old_date,
        ))
        .await
        .unwrap();

        // Insert recent proof
        repo.insert(&Proof::new(check_result_id, r#"{"new": true}"#))
            .await
            .unwrap();

        assert_eq!(repo.count().await.unwrap(), 2);

        // Delete older than 365 days
        let cutoff = now - chrono::Duration::days(365);
        let deleted = repo.delete_older_than(cutoff).await.unwrap();
        assert_eq!(deleted, 1);

        assert_eq!(repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);

        // Empty stats
        let stats = repo.get_stats().await.unwrap();
        assert_eq!(stats.count, 0);
        assert_eq!(stats.total_data_bytes, 0);

        // Add some proofs
        repo.insert(&Proof::new(check_result_id, r#"{"test": 1}"#))
            .await
            .unwrap();
        repo.insert(&Proof::new(check_result_id, r#"{"test": 2}"#))
            .await
            .unwrap();

        let stats = repo.get_stats().await.unwrap();
        assert_eq!(stats.count, 2);
        assert!(stats.total_data_bytes > 0);
        assert!(stats.oldest_at.is_some());
        assert!(stats.newest_at.is_some());
    }

    #[tokio::test]
    async fn test_proof_with_timestamp() {
        let timestamp = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let proof = Proof::with_timestamp(42, r#"{"test": true}"#, timestamp);

        assert_eq!(proof.created_at, timestamp);
        assert!(proof.verify_integrity());
    }

    #[tokio::test]
    async fn test_hash_bytes() {
        let proof = Proof::new(1, "test");
        let bytes = proof.hash_bytes().unwrap();
        assert_eq!(bytes.len(), 32); // SHA-256 is 32 bytes
    }

    #[tokio::test]
    async fn test_verify_all_for_result() {
        let (_temp_dir, db) = create_test_db().await;
        let check_result_id = create_test_check_result(&db).await;

        let repo = ProofsRepository::new(&db);

        repo.insert(&Proof::new(check_result_id, r#"{"a": 1}"#))
            .await
            .unwrap();
        repo.insert(&Proof::new(check_result_id, r#"{"b": 2}"#))
            .await
            .unwrap();

        let results = repo.verify_all_for_result(check_result_id).await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|(_, s)| *s == IntegrityStatus::Valid));
    }
}
