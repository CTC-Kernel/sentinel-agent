//! Agent self-integrity verification.
//!
//! This module provides self-integrity checking at startup to detect
//! tampered binaries. The agent computes a SHA-256 hash of its own
//! executable and compares it against the expected value.
//!
//! # Integrity Verification Flow
//!
//! 1. On first run (installation), the binary hash is computed and stored
//! 2. On subsequent runs, the hash is recomputed and verified
//! 3. If verification fails, a critical error is logged
//! 4. The result is included in the first heartbeat
//!
//! # Expected Hash Sources (priority order)
//!
//! 1. Environment variable `SENTINEL_EXPECTED_HASH` (for testing/deployment)
//! 2. Stored hash in agent_config table (set during installation)
//! 3. Downloaded from SaaS during enrollment

use crate::error::{SyncError, SyncResult};
use crate::types::SelfCheckResult;
use agent_storage::Database;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::PathBuf;
use std::time::Instant;
use tracing::{debug, error, info, warn};

/// Configuration key for stored expected hash.
const EXPECTED_HASH_KEY: &str = "integrity.expected_hash";

/// Environment variable for expected hash override.
const EXPECTED_HASH_ENV: &str = "SENTINEL_EXPECTED_HASH";

/// Maximum time allowed for integrity check (1 second per NFR).
const MAX_CHECK_DURATION_MS: u128 = 1000;

/// Agent self-integrity checker.
pub struct IntegrityChecker {
    /// Path to the executable being checked.
    executable_path: PathBuf,
}

impl IntegrityChecker {
    /// Create a new integrity checker for the current executable.
    pub fn new() -> SyncResult<Self> {
        let executable_path = std::env::current_exe().map_err(|e| {
            SyncError::Config(format!("Failed to get current executable path: {}", e))
        })?;

        debug!("Integrity checker for: {}", executable_path.display());

        Ok(Self { executable_path })
    }

    /// Create an integrity checker for a specific path (for testing).
    pub fn for_path(path: PathBuf) -> Self {
        Self {
            executable_path: path,
        }
    }

    /// Perform the integrity check.
    ///
    /// Returns a `SelfCheckResult` suitable for inclusion in heartbeat.
    /// Does NOT exit on failure - caller decides how to handle.
    pub async fn check(&self, db: &Database) -> SelfCheckResult {
        let start = Instant::now();

        // Compute current binary hash
        let current_hash = match self.compute_hash() {
            Ok(hash) => hash,
            Err(e) => {
                error!("Failed to compute binary hash: {}", e);
                return SelfCheckResult {
                    passed: false,
                    binary_hash: String::new(),
                    error: Some(format!("Failed to compute hash: {}", e)),
                };
            }
        };

        debug!("Current binary hash: {}", current_hash);

        // Get expected hash
        let expected_hash = match self.get_expected_hash(db).await {
            Ok(Some(hash)) => hash,
            Ok(None) => {
                // First run - store the current hash as expected
                info!("First run detected, storing binary hash for future verification");
                if let Err(e) = self.store_expected_hash(db, &current_hash).await {
                    warn!("Failed to store expected hash: {}", e);
                }
                // First run is considered successful
                let duration = start.elapsed();
                self.log_timing(duration.as_millis());
                return SelfCheckResult {
                    passed: true,
                    binary_hash: current_hash,
                    error: None,
                };
            }
            Err(e) => {
                error!("Failed to get expected hash: {}", e);
                return SelfCheckResult {
                    passed: false,
                    binary_hash: current_hash,
                    error: Some(format!("Failed to get expected hash: {}", e)),
                };
            }
        };

        // Compare hashes using constant-time comparison to prevent timing side-channel
        let passed = {
            let a = current_hash.to_lowercase();
            let b = expected_hash.to_lowercase();
            a.len() == b.len() && a.as_bytes().iter().zip(b.as_bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
        };

        let duration = start.elapsed();
        self.log_timing(duration.as_millis());

        if passed {
            info!("Binary integrity verified successfully");
            SelfCheckResult {
                passed: true,
                binary_hash: current_hash,
                error: None,
            }
        } else {
            error!("BINARY INTEGRITY CHECK FAILED!");
            error!("Expected hash: {}", expected_hash);
            error!("Current hash:  {}", current_hash);
            error!("The agent binary may have been tampered with.");

            let error_msg = format!(
                "Hash mismatch: expected {}, got {}",
                Self::hash_preview(&expected_hash),
                Self::hash_preview(&current_hash)
            );

            SelfCheckResult {
                passed: false,
                binary_hash: current_hash,
                error: Some(error_msg),
            }
        }
    }

    /// Compute SHA-256 hash of the executable.
    pub fn compute_hash(&self) -> SyncResult<String> {
        let file = File::open(&self.executable_path).map_err(|e| {
            SyncError::Config(format!(
                "Failed to open executable {}: {}",
                self.executable_path.display(),
                e
            ))
        })?;

        let mut reader = BufReader::with_capacity(1024 * 1024, file); // 1MB buffer
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];

        loop {
            let bytes_read = reader
                .read(&mut buffer)
                .map_err(|e| SyncError::Config(format!("Failed to read executable: {}", e)))?;

            if bytes_read == 0 {
                break;
            }

            hasher.update(&buffer[..bytes_read]);
        }

        let hash = hasher.finalize();
        Ok(format!("sha256:{}", hex::encode(hash)))
    }

    /// Get the expected hash from configuration.
    async fn get_expected_hash(&self, db: &Database) -> SyncResult<Option<String>> {
        // Check environment variable first (highest priority)
        if let Ok(hash) = std::env::var(EXPECTED_HASH_ENV)
            && !hash.is_empty()
        {
            debug!("Using expected hash from environment variable");
            return Ok(Some(hash));
        }

        // Check database
        db.with_connection(|conn| {
            let result: Option<String> = conn
                .query_row(
                    "SELECT value FROM agent_config WHERE key = ?",
                    [EXPECTED_HASH_KEY],
                    |row| row.get(0),
                )
                .ok();

            Ok(result)
        })
        .await
        .map_err(SyncError::from)
    }

    /// Store the expected hash in configuration.
    async fn store_expected_hash(&self, db: &Database, hash: &str) -> SyncResult<()> {
        let hash = hash.to_string();
        db.with_connection(move |conn| {
            conn.execute(
                r#"
                INSERT INTO agent_config (key, value, source)
                VALUES (?1, ?2, 'local')
                ON CONFLICT (key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                "#,
                [EXPECTED_HASH_KEY, &hash],
            )
            .map_err(|e| {
                agent_storage::StorageError::Query(format!("Failed to store expected hash: {}", e))
            })?;

            Ok(())
        })
        .await
        .map_err(SyncError::from)
    }

    /// Update the expected hash (e.g., after legitimate update).
    pub async fn update_expected_hash(&self, db: &Database, hash: &str) -> SyncResult<()> {
        info!("Updating expected hash to: {}", Self::hash_preview(hash));
        self.store_expected_hash(db, hash).await
    }

    /// Get the stored expected hash (for diagnostics).
    pub async fn get_stored_hash(&self, db: &Database) -> SyncResult<Option<String>> {
        self.get_expected_hash(db).await
    }

    /// Clear the stored expected hash (for testing/reset).
    pub async fn clear_expected_hash(&self, db: &Database) -> SyncResult<()> {
        db.with_connection(|conn| {
            conn.execute(
                "DELETE FROM agent_config WHERE key = ?",
                [EXPECTED_HASH_KEY],
            )
            .map_err(|e| {
                agent_storage::StorageError::Query(format!("Failed to clear expected hash: {}", e))
            })?;

            Ok(())
        })
        .await
        .map_err(SyncError::from)
    }

    /// Log timing information and warn if too slow.
    fn log_timing(&self, duration_ms: u128) {
        if duration_ms > MAX_CHECK_DURATION_MS {
            warn!(
                "Integrity check took {}ms (exceeds {}ms limit)",
                duration_ms, MAX_CHECK_DURATION_MS
            );
        } else {
            debug!("Integrity check completed in {}ms", duration_ms);
        }
    }

    /// Get a preview of a hash for logging (security: don't log full hash).
    fn hash_preview(hash: &str) -> String {
        if hash.chars().count() > 21 {
            let s: String = hash.chars().take(21).collect();
            format!("{}...", s)
        } else {
            hash.to_string()
        }
    }

    /// Get the executable path being checked.
    pub fn executable_path(&self) -> &PathBuf {
        &self.executable_path
    }
}

impl Default for IntegrityChecker {
    fn default() -> Self {
        match Self::new() {
            Ok(c) => c,
            Err(e) => {
                // In production, we should handle this error.
                // For the Default trait, we use a dummy path that will fail gracefully
                // when check() is called, rather than panicking at creation.
                warn!(
                    "Failed to create default IntegrityChecker: {}. Using fallback.",
                    e
                );
                Self {
                    executable_path: std::path::PathBuf::from("/invalid/path/for/integrity/check"),
                }
            }
        }
    }
}

/// Perform integrity check and panic if failed.
///
/// This is a convenience function for use at startup.
/// If integrity check fails, logs critical error and panics so the panic
/// handler in main.rs can perform graceful cleanup (including key zeroization)
/// instead of skipping destructors via `process::exit`.
pub async fn verify_or_exit(db: &Database) -> SelfCheckResult {
    let checker = match IntegrityChecker::new() {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to create integrity checker: {}", e);
            error!("Agent cannot verify its integrity - aborting for safety");
            // RH-5: Use panic! instead of process::exit(1) so destructors
            // (including key zeroization) run via the panic hook in main.rs.
            panic!("integrity check failed: cannot create integrity checker: {}", e);
        }
    };

    let result = checker.check(db).await;

    if !result.passed {
        error!("CRITICAL: Agent binary integrity check FAILED");
        error!("The agent may have been tampered with.");
        error!("Aborting for security reasons.");
        // RH-5: Use panic! instead of process::exit(1) so destructors
        // (including key zeroization) run via the panic hook in main.rs.
        panic!("integrity check failed: binary tampered");
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{DatabaseConfig, KeyManager};
    use std::io::Write;
    use tempfile::{NamedTempFile, TempDir};

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, db)
    }

    fn create_test_binary() -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"test binary content").unwrap();
        file.flush().unwrap();
        file
    }

    #[tokio::test]
    async fn test_compute_hash() {
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        let hash = checker.compute_hash().unwrap();
        assert!(hash.starts_with("sha256:"));
        assert_eq!(hash.len(), 7 + 64); // "sha256:" + 64 hex chars
    }

    #[tokio::test]
    async fn test_compute_hash_deterministic() {
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        let hash1 = checker.compute_hash().unwrap();
        let hash2 = checker.compute_hash().unwrap();

        assert_eq!(hash1, hash2);
    }

    #[tokio::test]
    async fn test_first_run_stores_hash() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        // First check - should store hash
        let result = checker.check(&db).await;
        assert!(result.passed);
        assert!(!result.binary_hash.is_empty());
        assert!(result.error.is_none());

        // Verify hash was stored
        let stored = checker.get_stored_hash(&db).await.unwrap();
        assert!(stored.is_some());
        assert_eq!(stored.unwrap(), result.binary_hash);
    }

    #[tokio::test]
    async fn test_subsequent_run_verifies() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        // First check - stores hash
        let result1 = checker.check(&db).await;
        assert!(result1.passed);

        // Second check - verifies hash
        let result2 = checker.check(&db).await;
        assert!(result2.passed);
        assert_eq!(result1.binary_hash, result2.binary_hash);
    }

    #[tokio::test]
    async fn test_tampered_binary_fails() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        // First check - stores hash
        let result1 = checker.check(&db).await;
        assert!(result1.passed);

        // Store a different expected hash to simulate tampering
        checker
            .update_expected_hash(
                &db,
                "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            )
            .await
            .unwrap();

        // Second check - should fail
        let result2 = checker.check(&db).await;
        assert!(!result2.passed);
        assert!(result2.error.is_some());
        assert!(result2.error.unwrap().contains("Hash mismatch"));
    }

    #[tokio::test]
    async fn test_update_expected_hash() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        // Store initial hash
        let initial_hash = "sha256:initial";
        checker
            .update_expected_hash(&db, initial_hash)
            .await
            .unwrap();

        // Verify stored
        let stored = checker.get_stored_hash(&db).await.unwrap().unwrap();
        assert_eq!(stored, initial_hash);

        // Update hash
        let new_hash = "sha256:updated";
        checker.update_expected_hash(&db, new_hash).await.unwrap();

        // Verify updated
        let stored = checker.get_stored_hash(&db).await.unwrap().unwrap();
        assert_eq!(stored, new_hash);
    }

    #[tokio::test]
    async fn test_clear_expected_hash() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        // Store hash
        checker
            .update_expected_hash(&db, "sha256:test")
            .await
            .unwrap();

        // Clear hash
        checker.clear_expected_hash(&db).await.unwrap();

        // Verify cleared
        let stored = checker.get_stored_hash(&db).await.unwrap();
        assert!(stored.is_none());
    }

    #[tokio::test]
    async fn test_hash_preview() {
        let long_hash = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let preview = IntegrityChecker::hash_preview(long_hash);
        assert_eq!(preview, "sha256:e3b0c44298fc1c...");

        let short = "short";
        let preview = IntegrityChecker::hash_preview(short);
        assert_eq!(preview, "short");
    }

    #[tokio::test]
    async fn test_self_check_result_format() {
        let (_temp_dir, db) = create_test_db().await;
        let temp_file = create_test_binary();
        let checker = IntegrityChecker::for_path(temp_file.path().to_path_buf());

        let result = checker.check(&db).await;

        // Verify result can be serialized (for heartbeat)
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("passed"));
        assert!(json.contains("binary_hash"));
    }

    #[tokio::test]
    async fn test_nonexistent_file_error() {
        let checker = IntegrityChecker::for_path(PathBuf::from("/nonexistent/binary"));

        let result = checker.compute_hash();
        assert!(result.is_err());
    }

    #[test]
    fn test_executable_path() {
        let path = PathBuf::from("/test/binary");
        let checker = IntegrityChecker::for_path(path.clone());

        assert_eq!(checker.executable_path(), &path);
    }
}
