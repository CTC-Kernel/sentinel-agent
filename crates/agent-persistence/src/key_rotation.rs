// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Database encryption key rotation.
//!
//! Provides secure rotation of the SQLCipher encryption key with backup
//! before rotation and validation after rotation.

use crate::backup::{BackupManager, BackupReason};
use crate::error::{PersistenceError, PersistenceResult};
use agent_storage::{Database, DatabaseConfig, KeyManager, StorageError};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{error, info};

/// Result of a key rotation operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationResult {
    /// Whether rotation was successful.
    pub success: bool,
    /// When the rotation occurred.
    pub rotated_at: DateTime<Utc>,
    /// Detail message.
    pub detail: String,
}

/// Key rotation schedule configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationSchedule {
    /// Rotation interval in days.
    pub interval_days: u32,
    /// Last rotation timestamp.
    pub last_rotation: Option<DateTime<Utc>>,
    /// Whether automatic rotation is enabled.
    pub auto_rotate: bool,
}

impl Default for KeyRotationSchedule {
    fn default() -> Self {
        Self {
            interval_days: 90,
            last_rotation: None,
            auto_rotate: false,
        }
    }
}

impl KeyRotationSchedule {
    /// Check if rotation is due.
    pub fn is_rotation_due(&self) -> bool {
        if !self.auto_rotate {
            return false;
        }

        match self.last_rotation {
            Some(last) => {
                let elapsed = Utc::now() - last;
                elapsed.num_days() >= self.interval_days as i64
            }
            None => true,
        }
    }

    /// Record a rotation.
    pub fn record_rotation(&mut self) {
        self.last_rotation = Some(Utc::now());
    }
}

/// Manages database key rotation.
pub struct KeyRotationManager<'a> {
    db_path: &'a Path,
}

impl<'a> KeyRotationManager<'a> {
    /// Create a new key rotation manager.
    pub fn new(db_path: &'a Path) -> Self {
        Self { db_path }
    }

    /// Rotate the database encryption key.
    ///
    /// This process:
    /// 1. Creates a mandatory backup of the current database (failure aborts rotation)
    /// 2. Opens the database with the old key
    /// 3. Rekeys the database to the new key
    /// 4. Verifies the new key works
    pub fn rotate_key(
        &self,
        old_key_manager: &KeyManager,
        new_key_manager: &KeyManager,
    ) -> PersistenceResult<KeyRotationResult> {
        info!("Starting database key rotation");

        // Step 1: Create a mandatory backup before rotation - failure is fatal
        let backup_manager = BackupManager::new(self.db_path).map_err(|e| {
            PersistenceError::KeyRotation(format!(
                "Cannot initialize backup manager before key rotation: {}",
                e
            ))
        })?;

        let backup_metadata = tokio::runtime::Runtime::new()
            .map_err(|e| PersistenceError::KeyRotation(format!("Failed to create runtime: {}", e)))?
            .block_on(async {
                backup_manager
                    .create_backup(old_key_manager, BackupReason::PreKeyRotation)
                    .await
            })
            .map_err(|e| {
                PersistenceError::KeyRotation(format!(
                    "CRITICAL: Pre-rotation backup failed - aborting key rotation to prevent data loss: {}",
                    e
                ))
            })?;

        info!(
            "Pre-rotation backup created successfully: {}",
            backup_metadata.id
        );

        // Step 2: Open database with old key
        let config = DatabaseConfig {
            path: self.db_path.to_path_buf(),
            create_if_missing: false,
        };

        let db = Database::open(config, old_key_manager).map_err(|e| {
            PersistenceError::KeyRotation(format!(
                "Failed to open database with current key: {}",
                e
            ))
        })?;

        // Step 3: Rekey the database
        let new_key =
            zeroize::Zeroizing::new(new_key_manager.get_database_key().map_err(|e| {
                PersistenceError::KeyRotation(format!("Failed to get new key: {}", e))
            })?);

        let new_key_hex = zeroize::Zeroizing::new(
            new_key
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>(),
        );

        let rekey_result = tokio::runtime::Runtime::new()
            .map_err(|e| PersistenceError::KeyRotation(format!("Failed to create runtime: {}", e)))?
            .block_on(async {
                db.with_connection(|conn| {
                    // Checkpoint WAL before rekeying to ensure all transactions are in the main DB
                    if let Err(e) = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);") {
                        tracing::warn!("Pre-rekey checkpoint failed (ignoring): {}", e);
                    }

                    assert!(
                        new_key_hex.chars().all(|c| c.is_ascii_hexdigit()),
                        "key must be hex-only"
                    );

                    // Build the PRAGMA in a stack-allocated buffer to avoid heap
                    // allocation of sensitive key material.
                    const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";
                    let _ = HEX_CHARS; // suppress unused warning; hex is pre-validated above
                    let prefix = b"PRAGMA rekey = \"x'";
                    let suffix = b"'\"";
                    // Max key: 64 hex chars; prefix(18) + 64 + suffix(2) = 84
                    let mut pragma_buf = [0u8; 84];
                    pragma_buf[..prefix.len()].copy_from_slice(prefix);
                    let key_bytes = new_key_hex.as_bytes();
                    pragma_buf[prefix.len()..prefix.len() + key_bytes.len()]
                        .copy_from_slice(key_bytes);
                    let end = prefix.len() + key_bytes.len();
                    pragma_buf[end..end + suffix.len()].copy_from_slice(suffix);
                    let pragma_len = end + suffix.len();

                    // SAFETY: pragma_buf contains only ASCII hex characters and known ASCII prefix/suffix
                    let pragma = std::str::from_utf8(&pragma_buf[..pragma_len])
                        .expect("PRAGMA buffer is always valid ASCII");
                    let result = conn.execute_batch(pragma);

                    // Zeroize the key hex from the stack buffer
                    zeroize::Zeroize::zeroize(&mut pragma_buf);

                    result
                        .map_err(|e| StorageError::Encryption(format!("Rekey failed: {}", e)))?;

                    // Checkpoint WAL after rekeying to clear any old key pages
                    if let Err(e) = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);") {
                        tracing::warn!("Post-rekey checkpoint failed (ignoring): {}", e);
                    }
                    Ok(())
                })
                .await
            });

        // new_key_hex is Zeroizing<String> -- automatically zeroed on drop

        match rekey_result {
            Ok(()) => {
                // Drop the old connection
                drop(db);

                // Step 4: Verify the new key works
                let verify_config = DatabaseConfig {
                    path: self.db_path.to_path_buf(),
                    create_if_missing: false,
                };

                match Database::open(verify_config, new_key_manager) {
                    Ok(_) => {
                        info!("Key rotation completed and verified successfully");
                        Ok(KeyRotationResult {
                            success: true,
                            rotated_at: Utc::now(),
                            detail: "Key rotation completed successfully with verified backup"
                                .to_string(),
                        })
                    }
                    Err(e) => {
                        error!(
                            "CRITICAL: Key rotation verification failed: {}. Database may need recovery from backup {}.",
                            e, backup_metadata.id
                        );
                        Err(PersistenceError::KeyRotation(format!(
                            "Verification after rotation failed: {}. Database backup available: {}",
                            e, backup_metadata.id
                        )))
                    }
                }
            }
            Err(e) => {
                error!(
                    "CRITICAL: Key rotation failed: {}. Database backup available: {}",
                    e, backup_metadata.id
                );
                Err(PersistenceError::KeyRotation(format!(
                    "Rekey operation failed: {}. Database backup available: {}",
                    e, backup_metadata.id
                )))
            }
        }
    }

    /// Check if rotation is needed based on schedule.
    pub fn check_schedule(&self, schedule: &KeyRotationSchedule) -> bool {
        schedule.is_rotation_due()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::DatabaseConfig;
    use tempfile::TempDir;

    #[test]
    fn test_key_rotation_schedule_default() {
        let schedule = KeyRotationSchedule::default();
        assert_eq!(schedule.interval_days, 90);
        assert!(schedule.last_rotation.is_none());
        assert!(!schedule.auto_rotate);
        assert!(!schedule.is_rotation_due());
    }

    #[test]
    fn test_key_rotation_schedule_due() {
        let mut schedule = KeyRotationSchedule {
            interval_days: 1,
            last_rotation: Some(Utc::now() - chrono::Duration::days(2)),
            auto_rotate: true,
        };

        assert!(schedule.is_rotation_due());

        schedule.record_rotation();
        assert!(!schedule.is_rotation_due());
    }

    #[test]
    fn test_key_rotation_schedule_not_due() {
        let schedule = KeyRotationSchedule {
            interval_days: 90,
            last_rotation: Some(Utc::now()),
            auto_rotate: true,
        };

        assert!(!schedule.is_rotation_due());
    }

    #[test]
    fn test_key_rotation_disabled() {
        let schedule = KeyRotationSchedule {
            interval_days: 1,
            last_rotation: Some(Utc::now() - chrono::Duration::days(100)),
            auto_rotate: false,
        };

        assert!(!schedule.is_rotation_due());
    }

    #[test]
    fn test_rotate_key() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database with old key
        let old_key_manager = KeyManager::new_with_test_key();
        let config = DatabaseConfig::with_path(&db_path);
        let db = Database::open(config, &old_key_manager).unwrap();

        // Insert some data to verify it survives rotation
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            db.with_connection(|conn| {
                conn.execute(
                    "INSERT INTO agent_config (key, value, source) VALUES ('test', 'value', 'local')",
                    [],
                )
                .map_err(|e| StorageError::Query(e.to_string()))?;
                Ok(())
            })
            .await
        }).unwrap();
        drop(db);

        // Rotate to new key
        let new_key_manager = KeyManager::new_with_key(b"new_key_for_rotation_testing_32!");
        let manager = KeyRotationManager::new(&db_path);

        let result = manager
            .rotate_key(&old_key_manager, &new_key_manager)
            .unwrap();
        assert!(result.success);

        // Verify data is still accessible with new key
        let config = DatabaseConfig::with_path(&db_path);
        let db = Database::open(config, &new_key_manager).unwrap();

        let value: String = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                db.with_connection(|conn| {
                    conn.query_row(
                        "SELECT value FROM agent_config WHERE key = 'test'",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| StorageError::Query(e.to_string()))
                })
                .await
            })
            .unwrap();

        assert_eq!(value, "value");
    }

    #[test]
    fn test_rotate_key_old_key_fails() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_rotation.db");

        // 1. Create database with old key
        let old_key_manager = KeyManager::new_with_test_key();
        let config = DatabaseConfig::with_path(&db_path);
        let db = Database::open(config.clone(), &old_key_manager)
            .expect("Opening newly created DB should succeed");

        // Write some data to format pages
        tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(async {
                db.with_connection(|conn| {
                    conn.execute_batch(
                        "CREATE TABLE IF NOT EXISTS rotation_test (id INTEGER PRIMARY KEY)",
                    )
                    .unwrap();
                    Ok(())
                })
                .await
            })
            .unwrap();
        drop(db);

        // 2. Rotate to new key
        let new_key_manager = KeyManager::new_with_key(b"new_key_that_is_32_bytes_long!!!");
        let manager = KeyRotationManager::new(&db_path);

        // This will temporarily open the DB with the old key, rekey it, and verify with the new key.
        let result = manager
            .rotate_key(&old_key_manager, &new_key_manager)
            .expect("Rotation should succeed");
        assert!(result.success);

        // 3. Try opening with OLD key - MUST FAIL
        let result = Database::open(config, &old_key_manager);
        assert!(
            result.is_err(),
            "Database should fail to open with old key after rotation"
        );

        let err_str = result.unwrap_err().to_string();
        assert!(
            err_str.contains("encryption")
                || err_str.contains("not a database")
                || err_str.contains("auth"),
            "Expected failure due to encryption, got: {}",
            err_str
        );
    }
}
