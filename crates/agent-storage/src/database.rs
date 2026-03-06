// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
#[allow(unused_imports)]
use tracing::{debug, error, info, warn};

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
        #[cfg(windows)]
        let db_path = AgentConfig::platform_data_dir()
            .join("data")
            .join(DB_FILE_NAME);
        #[cfg(not(windows))]
        let db_path = AgentConfig::platform_data_dir().join(DB_FILE_NAME);

        Self {
            path: db_path,
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
        if let Some(parent) = config.path.parent() {
            if !parent.exists() {
                if let Err(e) = std::fs::create_dir_all(parent) {
                    error!(
                        "CRITICAL: Failed to create data directory {}: {}. This will cause a crash.",
                        parent.display(),
                        e
                    );
                    return Err(StorageError::Initialization(format!(
                        "Failed to create data directory {}: {}",
                        parent.display(),
                        e
                    )));
                }
                // Restrict directory permissions to owner-only (0700) on Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let perms = std::fs::Permissions::from_mode(0o700);
                    if let Err(e) = std::fs::set_permissions(parent, perms) {
                        warn!("Failed to set data directory permissions to 0700: {}", e);
                    }
                }
                info!("Created data directory: {}", parent.display());
            } else {
                // Check if directory is writable
                match std::fs::read_dir(parent) {
                    Ok(_) => debug!("Data directory is accessible: {}", parent.display()),
                    Err(e) => {
                        error!(
                            "CRITICAL: Data directory {} exists but is not accessible: {}. Please check Windows permissions.",
                            parent.display(),
                            e
                        );
                        return Err(StorageError::Initialization(format!(
                            "Data directory exists but is not accessible: {}",
                            e
                        )));
                    }
                }
            }
        }

        // Get the encryption key (zeroized after use via drop)
        let mut key = key_manager.get_database_key()?;

        // Open the database connection
        let open_result = if config.create_if_missing {
            Connection::open(&config.path)
        } else {
            Connection::open_with_flags(&config.path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE)
        };

        // On Windows, retry on SQLITE_BUSY / SQLITE_CANTOPEN (AV scanners, backup tools)
        #[cfg(windows)]
        let connection = {
            let max_retries = 5u32;
            let retry_delay = std::time::Duration::from_millis(100);
            let mut retry_count = 0u32;
            let mut result = open_result;
            loop {
                match result {
                    Ok(conn) => break conn,
                    Err(e) => {
                        if retry_count < max_retries {
                            retry_count += 1;
                            warn!(
                                "Database is busy or cannot be opened at {}, retrying in {:?} (attempt {}/{}): {}",
                                config.path.display(),
                                retry_delay,
                                retry_count,
                                max_retries,
                                e
                            );
                            std::thread::sleep(retry_delay);
                            result = if config.create_if_missing {
                                Connection::open(&config.path)
                            } else {
                                Connection::open_with_flags(
                                    &config.path,
                                    rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
                                )
                            };
                            continue;
                        }
                        error!(
                            "CRITICAL: Failed to open database at {} after {} retries. This usually indicates a permanent lock or permission issue: {}",
                            config.path.display(),
                            max_retries,
                            e
                        );
                        return Err(StorageError::Connection(e.to_string()));
                    }
                }
            }
        };
        #[cfg(not(windows))]
        let connection = open_result.map_err(|e| {
            error!(
                "Failed to open database at {}: {}",
                config.path.display(),
                e
            );
            StorageError::Connection(e.to_string())
        })?;

        // Set busy timeout immediately to handle concurrent access gracefully
        connection
            .busy_timeout(std::time::Duration::from_millis(5000))
            .map_err(|e| {
                StorageError::Initialization(format!("Failed to set busy timeout: {}", e))
            })?;

        // Set the encryption key using SQLCipher pragma
        Self::set_encryption_key(&connection, &key)?;

        // Zeroize key material from memory now that it's been set
        zeroize::Zeroize::zeroize(&mut key);
        drop(key);

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
    ///
    /// The key material is zeroized from memory after the PRAGMA is set to
    /// minimize the window during which the plaintext key is in heap memory.
    fn set_encryption_key(conn: &Connection, key: &[u8]) -> StorageResult<()> {
        if key.len() < 32 {
            return Err(StorageError::Encryption(format!(
                "Database key must be at least 32 bytes (256 bits), got {}",
                key.len()
            )));
        }

        // Convert key to hex in a stack-allocated buffer to avoid heap allocation
        // of sensitive material. 32 bytes → 64 hex chars + prefix (16) + suffix (2) = 82.
        const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";
        let mut pragma_buf = [0u8; 82];
        let prefix = b"PRAGMA key = \"x'";
        let suffix = b"'\"";
        pragma_buf[..prefix.len()].copy_from_slice(prefix);
        let mut offset = prefix.len();
        for &byte in key.iter().take(32) {
            pragma_buf[offset] = HEX_CHARS[(byte >> 4) as usize];
            pragma_buf[offset + 1] = HEX_CHARS[(byte & 0x0f) as usize];
            offset += 2;
        }
        pragma_buf[offset..offset + suffix.len()].copy_from_slice(suffix);
        let pragma_len = offset + suffix.len();

        // SAFETY: pragma_buf contains only ASCII hex characters and known ASCII prefix/suffix
        let pragma = std::str::from_utf8(&pragma_buf[..pragma_len])
            .expect("PRAGMA buffer is always valid ASCII");
        let result = conn.execute_batch(pragma);

        // Zeroize the key hex from the stack buffer
        zeroize::Zeroize::zeroize(&mut pragma_buf);

        result.map_err(|e| {
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
        // Force reading the database header to verify the key
        // By fetching schema version, we force SQLCipher to decrypt the first page
        let _: Result<i32, _> = conn.query_row("PRAGMA schema_version;", [], |row| row.get(0));

        // Try to execute a simple query that forces page traversal
        if let Err(e) = conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
            let _val: i32 = row.get(0)?;
            Ok(())
        }) {
            return Err(StorageError::Encryption(format!(
                "CRITICAL: Database encryption verification failed (invalid key or corrupted file): {}",
                e
            )));
        }

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
        let temp_dir = tempfile::TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_enc.db");
        let config = DatabaseConfig::with_path(&db_path);

        // Open with Key 1
        let key_manager1 = KeyManager::new_with_test_key();
        let db1 = Database::open(config.clone(), &key_manager1).expect("Failed to create db");

        // Write some data to make sure formatting happens
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                db1.with_connection(|conn| {
                    conn.execute_batch("CREATE TABLE test_enc (id INTEGER PRIMARY KEY)")
                        .unwrap();
                    Ok(())
                })
                .await
            })
            .unwrap();

        // Drop db1
        drop(db1);

        // Try opening with wrong key
        let key_manager2 = KeyManager::new_with_key(b"wrong_key_that_is_32_bytes_long!");
        let result = Database::open(config, &key_manager2);

        assert!(
            result.is_err(),
            "Database should fail to open with incorrect key"
        );
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
