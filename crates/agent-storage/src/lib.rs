//! Agent Storage - SQLite-based encrypted local storage.
//!
//! This crate provides secure, encrypted storage for the Sentinel GRC Agent.
//! All data is encrypted at rest using SQLCipher with AES-256-CBC.
//!
//! # Features
//!
//! - SQLCipher encryption with AES-256-CBC
//! - Machine-specific key derivation
//! - Secure key storage (DPAPI on Windows, file with 0600 on Linux)
//! - Async database access via tokio-rusqlite
//!
//! # Example
//!
//! ```no_run
//! use agent_storage::{Database, DatabaseConfig, KeyManager};
//!
//! // Initialize key manager (loads or creates encryption key)
//! let key_manager = KeyManager::new().expect("Failed to initialize key manager");
//!
//! // Open encrypted database
//! let config = DatabaseConfig::default();
//! let db = Database::open(config, &key_manager).expect("Failed to open database");
//! ```

pub mod database;
pub mod error;
pub mod key;
pub mod migrations;
pub mod repositories;
pub mod retention;

pub use database::{Database, DatabaseConfig};
pub use error::{StorageError, StorageResult};
pub use key::KeyManager;
pub use migrations::{CURRENT_SCHEMA_VERSION, run_migrations};
pub use repositories::{
    CheckResultsRepository, CheckRulesRepository, ConfigRepository, ProofsRepository,
    check_results::{CheckResult, CheckResultQuery, CheckStatus},
    check_rules::{CheckRule, RuleCacheMetadata, Severity},
    config::{ConfigEntry, ConfigSource, MergeResult},
    proofs::{IntegrityStatus, Proof, ProofStats},
};
pub use retention::{RetentionConfig, RetentionPolicy, RetentionResult, StorageStats};

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_full_database_workflow() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database with encryption
        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();

        let db = Database::open(config, &key_manager).unwrap();

        // Create a table and insert data
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime
            .block_on(async {
                db.with_connection(|conn| {
                    conn.execute_batch(
                        "CREATE TABLE IF NOT EXISTS config (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    )",
                    )
                    .map_err(|e| StorageError::Query(e.to_string()))?;

                    conn.execute(
                        "INSERT INTO config (key, value) VALUES (?, ?)",
                        ["server_url", "https://app.cyber-threat-consulting.com"],
                    )
                    .map_err(|e| StorageError::Query(e.to_string()))?;

                    Ok(())
                })
                .await
            })
            .unwrap();

        // Query the data back
        let value: String = runtime
            .block_on(async {
                db.with_connection(|conn| {
                    conn.query_row(
                        "SELECT value FROM config WHERE key = ?",
                        ["server_url"],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(e.to_string()))
                })
                .await
            })
            .unwrap();

        assert_eq!(value, "https://app.cyber-threat-consulting.com");
    }
}
