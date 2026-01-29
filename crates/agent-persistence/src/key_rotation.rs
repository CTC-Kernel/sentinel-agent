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
use tracing::{error, info, warn};

/// Result of a key rotation operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyRotationResult {
    /// Whether rotation was successful.
    pub success: bool,
    /// When the rotation occurred.
    pub rotated_at: DateTime<Utc>,
    /// Detail message.
    pub detail: String,
    /// Whether a backup was created before rotation.
    pub backup_created: bool,
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
    /// 1. Creates a backup of the current database
    /// 2. Opens the database with the old key
    /// 3. Rekeys the database to the new key
    /// 4. Verifies the new key works
    pub fn rotate_key(
        &self,
        old_key_manager: &KeyManager,
        new_key_manager: &KeyManager,
    ) -> PersistenceResult<KeyRotationResult> {
        info!("Starting database key rotation");

        // Step 1: Create a backup before rotation
        let backup_created = match BackupManager::new(self.db_path) {
            Ok(backup_manager) => {
                match backup_manager.create_backup(BackupReason::PreKeyRotation) {
                    Ok(metadata) => {
                        info!("Pre-rotation backup created: {}", metadata.id);
                        true
                    }
                    Err(e) => {
                        warn!("Failed to create pre-rotation backup: {}", e);
                        false
                    }
                }
            }
            Err(e) => {
                warn!("Failed to initialize backup manager: {}", e);
                false
            }
        };

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
        let new_key = new_key_manager.get_database_key().map_err(|e| {
            PersistenceError::KeyRotation(format!("Failed to get new key: {}", e))
        })?;

        let new_key_hex: String = new_key.iter().map(|b| format!("{:02x}", b)).collect();

        let rekey_result = tokio::runtime::Runtime::new()
            .map_err(|e| {
                PersistenceError::KeyRotation(format!("Failed to create runtime: {}", e))
            })?
            .block_on(async {
                db.with_connection(|conn| {
                    conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\"", new_key_hex))
                        .map_err(|e| StorageError::Encryption(format!("Rekey failed: {}", e)))?;
                    Ok(())
                })
                .await
            });

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
                            detail: "Key rotation completed successfully".to_string(),
                            backup_created,
                        })
                    }
                    Err(e) => {
                        error!(
                            "Key rotation verification failed: {}. Database may need recovery.",
                            e
                        );
                        Err(PersistenceError::KeyRotation(format!(
                            "Verification after rotation failed: {}",
                            e
                        )))
                    }
                }
            }
            Err(e) => {
                error!("Key rotation failed: {}", e);
                Err(PersistenceError::KeyRotation(format!(
                    "Rekey operation failed: {}",
                    e
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

        let result = manager.rotate_key(&old_key_manager, &new_key_manager).unwrap();
        assert!(result.success);

        // Verify data is still accessible with new key
        let config = DatabaseConfig::with_path(&db_path);
        let db = Database::open(config, &new_key_manager).unwrap();

        let value: String = tokio::runtime::Runtime::new().unwrap().block_on(async {
            db.with_connection(|conn| {
                conn.query_row(
                    "SELECT value FROM agent_config WHERE key = 'test'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| StorageError::Query(e.to_string()))
            })
            .await
        }).unwrap();

        assert_eq!(value, "value");
    }

    #[test]
    fn test_rotate_key_old_key_fails() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database with old key
        let old_key_manager = KeyManager::new_with_test_key();
        let config = DatabaseConfig::with_path(&db_path);
        let _db = Database::open(config, &old_key_manager).unwrap();
        drop(_db);

        // Rotate to new key
        let new_key_manager = KeyManager::new_with_key(b"new_key_for_rotation_testing_32!");
        let manager = KeyRotationManager::new(&db_path);
        manager.rotate_key(&old_key_manager, &new_key_manager).unwrap();

        // Old key should fail
        let config = DatabaseConfig {
            path: db_path,
            create_if_missing: false,
        };
        let result = Database::open(config, &old_key_manager);
        assert!(result.is_err());
    }
}
