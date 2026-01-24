//! SQLite database with SQLCipher encryption.
//!
//! This module provides encrypted database access for the Sentinel GRC Agent.
//! All data is encrypted at rest using SQLCipher with AES-256-CBC.

use crate::error::{StorageError, StorageResult};
use crate::key::KeyManager;
use crate::migrations::run_migrations;
use agent_common::config::AgentConfig;
use agent_common::constants::DB_FILE_NAME;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info};

/// Database configuration.
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    /// Path to the database file.
    pub path: PathBuf,
    /// Whether to create the database if it doesn't exist.
    pub create_if_missing: bool,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: AgentConfig::platform_data_dir().join(DB_FILE_NAME),
            create_if_missing: true,
        }
    }
}

impl DatabaseConfig {
    /// Create a new database config with a custom path.
    pub fn with_path<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
            create_if_missing: true,
        }
    }
}

/// Encrypted database manager.
///
/// Manages connections to the SQLCipher-encrypted SQLite database.
pub struct Database {
    config: DatabaseConfig,
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open or create an encrypted database.
    ///
    /// # Arguments
    /// * `config` - Database configuration
    /// * `key_manager` - Key manager for encryption key
    ///
    /// # Returns
    /// A new Database instance with an open encrypted connection.
    pub fn open(config: DatabaseConfig, key_manager: &KeyManager) -> StorageResult<Self> {
        // Ensure the data directory exists
        if let Some(parent) = config.path.parent()
            && !parent.exists()
        {
            std::fs::create_dir_all(parent).map_err(|e| {
                StorageError::Initialization(format!(
                    "Failed to create data directory {}: {}",
                    parent.display(),
                    e
                ))
            })?;
            info!("Created data directory: {}", parent.display());
        }

        // Get the encryption key
        let key = key_manager.get_database_key()?;

        // Open the database connection
        let connection = if config.create_if_missing {
            Connection::open(&config.path)
        } else {
            Connection::open_with_flags(&config.path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE)
        }
        .map_err(|e| StorageError::Connection(e.to_string()))?;

        // Set the encryption key using SQLCipher pragma
        Self::set_encryption_key(&connection, &key)?;

        // Verify encryption is working by executing a simple query
        Self::verify_encryption(&connection)?;

        // Enable WAL mode for concurrent write safety
        Self::enable_wal_mode(&connection)?;

        // Run database migrations
        let mut connection = connection;
        run_migrations(&mut connection)?;

        debug!("Opened encrypted database at: {}", config.path.display());

        Ok(Self {
            config,
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    /// Set the encryption key on a connection.
    fn set_encryption_key(conn: &Connection, key: &[u8]) -> StorageResult<()> {
        // Convert key to hex string for SQLCipher
        let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();

        // Set the key using PRAGMA key
        conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))
            .map_err(|e| {
                StorageError::Encryption(format!("Failed to set encryption key: {}", e))
            })?;

        // Configure SQLCipher settings for AES-256-CBC
        conn.execute_batch(
            r#"
            PRAGMA cipher_page_size = 4096;
            PRAGMA kdf_iter = 256000;
            PRAGMA cipher_hmac_algorithm = HMAC_SHA256;
            PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA256;
            "#,
        )
        .map_err(|e| {
            StorageError::Encryption(format!("Failed to configure cipher settings: {}", e))
        })?;

        Ok(())
    }

    /// Verify that encryption is properly configured.
    fn verify_encryption(conn: &Connection) -> StorageResult<()> {
        // Try to execute a simple query to verify the database is accessible
        conn.execute_batch("SELECT count(*) FROM sqlite_master")
            .map_err(|e| {
                StorageError::Encryption(format!(
                    "Database encryption verification failed. \
                     This may indicate an incorrect key or corrupted database: {}",
                    e
                ))
            })?;

        debug!("Database encryption verified successfully");
        Ok(())
    }

    /// Enable WAL (Write-Ahead Logging) mode for concurrent write safety.
    ///
    /// WAL mode provides better concurrency by allowing reads to proceed
    /// while writes are in progress.
    fn enable_wal_mode(conn: &Connection) -> StorageResult<()> {
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            "#,
        )
        .map_err(|e| StorageError::Initialization(format!("Failed to enable WAL mode: {}", e)))?;

        debug!("WAL mode enabled for concurrent write safety");
        Ok(())
    }

    /// Get a reference to the database path.
    pub fn path(&self) -> &Path {
        &self.config.path
    }

    /// Execute a function with the database connection.
    ///
    /// This provides synchronized access to the underlying connection.
    pub async fn with_connection<F, T>(&self, f: F) -> StorageResult<T>
    where
        F: FnOnce(&Connection) -> StorageResult<T>,
    {
        let conn = self.connection.lock().await;
        f(&conn)
    }

    /// Execute a function with mutable access to the database connection.
    pub async fn with_connection_mut<F, T>(&self, f: F) -> StorageResult<T>
    where
        F: FnOnce(&mut Connection) -> StorageResult<T>,
    {
        let mut conn = self.connection.lock().await;
        f(&mut conn)
    }

    /// Check if the database file exists.
    pub fn exists(&self) -> bool {
        self.config.path.exists()
    }

    /// Get database file size in bytes.
    pub fn file_size(&self) -> StorageResult<u64> {
        std::fs::metadata(&self.config.path)
            .map(|m| m.len())
            .map_err(|e| StorageError::Io(e.to_string()))
    }
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("config", &self.config)
            .field("path", &self.config.path)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::key::KeyManager;
    use tempfile::TempDir;

    fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();

        let db = Database::open(config, &key_manager).unwrap();
        (temp_dir, db)
    }

    #[test]
    fn test_database_creation() {
        let (_temp_dir, db) = create_test_db();
        assert!(db.exists());
    }

    #[test]
    fn test_database_encryption_verification() {
        let (_temp_dir, db) = create_test_db();

        // Database should be accessible with correct key
        let result = tokio::runtime::Runtime::new().unwrap().block_on(async {
            db.with_connection(|conn| {
                conn.execute_batch("CREATE TABLE test (id INTEGER PRIMARY KEY)")
                    .map_err(|e| StorageError::Query(e.to_string()))?;
                Ok(())
            })
            .await
        });

        assert!(result.is_ok());
    }

    #[test]
    fn test_database_cannot_be_read_without_key() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("encrypted.db");

        // Create database with one key
        {
            let config = DatabaseConfig::with_path(&db_path);
            let key_manager = KeyManager::new_with_test_key();
            let db = Database::open(config, &key_manager).unwrap();

            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(async {
                    db.with_connection(|conn| {
                        conn.execute_batch(
                            "CREATE TABLE secrets (id INTEGER PRIMARY KEY, data TEXT)",
                        )
                        .map_err(|e| StorageError::Query(e.to_string()))?;
                        conn.execute("INSERT INTO secrets (data) VALUES (?)", ["secret_value"])
                            .map_err(|e| StorageError::Query(e.to_string()))?;
                        Ok(())
                    })
                    .await
                })
                .unwrap();
        }

        // Try to open with wrong key - should fail
        let config = DatabaseConfig {
            path: db_path,
            create_if_missing: false,
        };
        let wrong_key_manager = KeyManager::new_with_key(b"wrong_key_wrong_key_wrong_key_32");
        let result = Database::open(config, &wrong_key_manager);

        // Should fail because the key is wrong
        assert!(result.is_err());
    }

    #[test]
    fn test_database_config_default() {
        let config = DatabaseConfig::default();
        assert!(config.path.ends_with(DB_FILE_NAME));
        assert!(config.create_if_missing);
    }

    #[test]
    fn test_database_file_size() {
        let (_temp_dir, db) = create_test_db();

        // Force database write by creating a table
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                db.with_connection(|conn| {
                    conn.execute_batch("CREATE TABLE size_test (id INTEGER PRIMARY KEY)")
                        .map_err(|e| StorageError::Query(e.to_string()))?;
                    Ok(())
                })
                .await
            })
            .unwrap();

        let size = db.file_size().unwrap();
        assert!(size > 0);
    }
}
