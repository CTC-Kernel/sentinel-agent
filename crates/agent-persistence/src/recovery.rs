//! Database recovery and integrity checking.
//!
//! Provides integrity verification, database repair, and recovery from backup
//! for corrupted or damaged databases.

use crate::backup::BackupManager;
use crate::error::{PersistenceError, PersistenceResult};
use agent_storage::{Database, DatabaseConfig, KeyManager};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{error, info};

/// Result of an integrity check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityReport {
    /// Whether the database passed integrity checks.
    pub passed: bool,
    /// Individual check results.
    pub checks: Vec<IntegrityCheck>,
    /// Timestamp of the check.
    pub checked_at: chrono::DateTime<chrono::Utc>,
    /// Recommended action if check failed.
    pub recommendation: Option<RecoveryAction>,
}

/// Individual integrity check result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityCheck {
    /// Check name.
    pub name: String,
    /// Whether this check passed.
    pub passed: bool,
    /// Detail message.
    pub detail: String,
}

/// Recommended recovery action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryAction {
    /// No action needed.
    None,
    /// Run VACUUM to rebuild database.
    Vacuum,
    /// Restore from latest backup.
    RestoreFromBackup,
    /// Re-enroll the agent.
    ReEnroll,
}

/// Manages database recovery operations.
pub struct RecoveryManager<'a> {
    db_path: &'a Path,
    key_manager: &'a KeyManager,
}

impl<'a> RecoveryManager<'a> {
    /// Create a new recovery manager.
    pub fn new(db_path: &'a Path, key_manager: &'a KeyManager) -> Self {
        Self {
            db_path,
            key_manager,
        }
    }

    /// Run a full integrity check on the database.
    pub fn check_integrity(&self) -> PersistenceResult<IntegrityReport> {
        let mut checks = Vec::new();
        let now = chrono::Utc::now();

        // Check 1: File exists
        let file_exists = self.db_path.exists();
        checks.push(IntegrityCheck {
            name: "file_exists".to_string(),
            passed: file_exists,
            detail: if file_exists {
                format!("Database file found at {}", self.db_path.display())
            } else {
                format!("Database file missing: {}", self.db_path.display())
            },
        });

        if !file_exists {
            return Ok(IntegrityReport {
                passed: false,
                checks,
                checked_at: now,
                recommendation: Some(RecoveryAction::RestoreFromBackup),
            });
        }

        // Check 2: File is not empty
        let file_size = std::fs::metadata(self.db_path)
            .map(|m| m.len())
            .unwrap_or(0);
        let not_empty = file_size > 0;
        checks.push(IntegrityCheck {
            name: "file_not_empty".to_string(),
            passed: not_empty,
            detail: format!("Database file size: {} bytes", file_size),
        });

        if !not_empty {
            return Ok(IntegrityReport {
                passed: false,
                checks,
                checked_at: now,
                recommendation: Some(RecoveryAction::RestoreFromBackup),
            });
        }

        // Check 3: Can open with encryption key
        let config = DatabaseConfig {
            path: self.db_path.to_path_buf(),
            create_if_missing: false,
        };
        match Database::open(config, self.key_manager) {
            Ok(db) => {
                checks.push(IntegrityCheck {
                    name: "encryption_valid".to_string(),
                    passed: true,
                    detail: "Database decryption successful".to_string(),
                });

                // Check 4: SQLite integrity_check
                let integrity_ok =
                    tokio::runtime::Runtime::new()
                        .map_err(|e| {
                            PersistenceError::Recovery(format!("Failed to create runtime: {}", e))
                        })?
                        .block_on(async {
                            db.with_connection(|conn| {
                                let result: String = conn
                                    .query_row("PRAGMA integrity_check", [], |row| row.get(0))
                                    .map_err(|e| {
                                        agent_storage::StorageError::Query(format!(
                                            "integrity_check failed: {}",
                                            e
                                        ))
                                    })?;
                                Ok(result)
                            })
                            .await
                        })
                        .unwrap_or_else(|_| "error".to_string());

                let sqlite_ok = integrity_ok == "ok";
                checks.push(IntegrityCheck {
                    name: "sqlite_integrity".to_string(),
                    passed: sqlite_ok,
                    detail: format!("PRAGMA integrity_check: {}", integrity_ok),
                });

                // Check 5: Schema version is valid
                let schema_ok =
                    tokio::runtime::Runtime::new()
                        .map_err(|e| {
                            PersistenceError::Recovery(format!("Failed to create runtime: {}", e))
                        })?
                        .block_on(async {
                            db.with_connection(|conn| {
                                let version: i32 = conn
                                    .query_row(
                                        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                                        [],
                                        |row| row.get(0),
                                    )
                                    .unwrap_or(0);
                                Ok(version)
                            })
                            .await
                        })
                        .unwrap_or(0);

                let version_ok = schema_ok > 0;
                checks.push(IntegrityCheck {
                    name: "schema_version".to_string(),
                    passed: version_ok,
                    detail: format!("Schema version: {}", schema_ok),
                });

                let all_passed = checks.iter().all(|c| c.passed);
                let recommendation = if all_passed {
                    None
                } else if !sqlite_ok {
                    Some(RecoveryAction::Vacuum)
                } else {
                    Some(RecoveryAction::RestoreFromBackup)
                };

                Ok(IntegrityReport {
                    passed: all_passed,
                    checks,
                    checked_at: now,
                    recommendation,
                })
            }
            Err(e) => {
                checks.push(IntegrityCheck {
                    name: "encryption_valid".to_string(),
                    passed: false,
                    detail: format!("Failed to open database: {}", e),
                });

                Ok(IntegrityReport {
                    passed: false,
                    checks,
                    checked_at: now,
                    recommendation: Some(RecoveryAction::RestoreFromBackup),
                })
            }
        }
    }

    /// Attempt to repair the database by running VACUUM.
    pub fn repair(&self) -> PersistenceResult<bool> {
        info!("Attempting database repair via VACUUM");

        let config = DatabaseConfig {
            path: self.db_path.to_path_buf(),
            create_if_missing: false,
        };

        let db = Database::open(config, self.key_manager).map_err(|e| {
            PersistenceError::Recovery(format!("Cannot open database for repair: {}", e))
        })?;

        let result = tokio::runtime::Runtime::new()
            .map_err(|e| PersistenceError::Recovery(format!("Failed to create runtime: {}", e)))?
            .block_on(async {
                db.with_connection(|conn| {
                    conn.execute_batch("VACUUM")
                        .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?;
                    Ok(())
                })
                .await
            });

        match result {
            Ok(()) => {
                info!("Database repair (VACUUM) completed successfully");
                Ok(true)
            }
            Err(e) => {
                error!("Database repair failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Recover from the latest backup.
    pub fn recover_from_backup(&self) -> PersistenceResult<()> {
        let backup_manager = BackupManager::new(self.db_path)?;
        let backups = backup_manager.list_backups()?;

        let latest = backups.first().ok_or_else(|| {
            PersistenceError::Recovery("No backups available for recovery".to_string())
        })?;

        info!("Recovering from backup: {} (created {})", latest.id, latest.created_at);

        backup_manager.restore_backup(&latest.id)?;

        info!("Recovery from backup completed successfully");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_integrity_check_missing_file() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("nonexistent.db");
        let key_manager = KeyManager::new_with_test_key();

        let manager = RecoveryManager::new(&db_path, &key_manager);
        let report = manager.check_integrity().unwrap();

        assert!(!report.passed);
        assert!(matches!(
            report.recommendation,
            Some(RecoveryAction::RestoreFromBackup)
        ));
    }

    #[test]
    fn test_integrity_check_empty_file() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("empty.db");
        std::fs::write(&db_path, b"").unwrap();
        let key_manager = KeyManager::new_with_test_key();

        let manager = RecoveryManager::new(&db_path, &key_manager);
        let report = manager.check_integrity().unwrap();

        assert!(!report.passed);
    }

    #[test]
    fn test_integrity_check_valid_db() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let key_manager = KeyManager::new_with_test_key();

        // Create a valid database
        let config = DatabaseConfig::with_path(&db_path);
        let _db = Database::open(config, &key_manager).unwrap();

        let manager = RecoveryManager::new(&db_path, &key_manager);
        let report = manager.check_integrity().unwrap();

        assert!(report.passed);
        assert!(report.recommendation.is_none());
    }

    #[test]
    fn test_repair_valid_db() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let key_manager = KeyManager::new_with_test_key();

        let config = DatabaseConfig::with_path(&db_path);
        let _db = Database::open(config, &key_manager).unwrap();
        drop(_db);

        let manager = RecoveryManager::new(&db_path, &key_manager);
        let repaired = manager.repair().unwrap();
        assert!(repaired);
    }
}
