//! Database backup and restore.
//!
//! Provides encrypted backup creation, restoration, listing, and automatic
//! backup scheduling for the agent database.

use crate::error::{PersistenceError, PersistenceResult};
use agent_common::config::AgentConfig;
use chrono::{DateTime, Utc};
use flate2::Compression;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Maximum number of backups to retain.
const MAX_BACKUPS: usize = 5;

/// Backup file extension.
const BACKUP_EXTENSION: &str = "backup.gz";

/// Backup metadata file extension.
const METADATA_EXTENSION: &str = "backup.meta.json";

/// Backup metadata stored alongside each backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    /// Unique backup identifier.
    pub id: String,
    /// When the backup was created.
    pub created_at: DateTime<Utc>,
    /// Reason for the backup.
    pub reason: BackupReason,
    /// SHA-256 hash of the compressed backup data.
    pub hash: String,
    /// Size of the compressed backup in bytes.
    pub compressed_size: u64,
    /// Size of the original database in bytes.
    pub original_size: u64,
    /// Schema version at time of backup.
    pub schema_version: i32,
    /// Agent version at time of backup.
    pub agent_version: String,
}

/// Reason for creating a backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupReason {
    /// Scheduled automatic backup.
    Scheduled,
    /// Manual backup requested by user/admin.
    Manual,
    /// Backup before migration.
    PreMigration,
    /// Backup before key rotation.
    PreKeyRotation,
    /// Backup before update.
    PreUpdate,
}

/// Manages database backups.
pub struct BackupManager {
    /// Directory where backups are stored.
    backup_dir: PathBuf,
    /// Path to the database file.
    db_path: PathBuf,
}

impl BackupManager {
    /// Create a new backup manager.
    pub fn new(db_path: &Path) -> PersistenceResult<Self> {
        let backup_dir = Self::default_backup_dir();

        if !backup_dir.exists() {
            fs::create_dir_all(&backup_dir).map_err(|e| {
                PersistenceError::Backup(format!(
                    "Failed to create backup directory {}: {}",
                    backup_dir.display(),
                    e
                ))
            })?;
            debug!("Created backup directory: {}", backup_dir.display());
        }

        Ok(Self {
            backup_dir,
            db_path: db_path.to_path_buf(),
        })
    }

    /// Create a new backup manager with a custom backup directory.
    pub fn with_backup_dir(db_path: &Path, backup_dir: &Path) -> PersistenceResult<Self> {
        if !backup_dir.exists() {
            fs::create_dir_all(backup_dir)?;
        }

        Ok(Self {
            backup_dir: backup_dir.to_path_buf(),
            db_path: db_path.to_path_buf(),
        })
    }

    /// Create a new backup of the database.
    pub fn create_backup(&self, reason: BackupReason) -> PersistenceResult<BackupMetadata> {
        if !self.db_path.exists() {
            return Err(PersistenceError::Backup(format!(
                "Database file not found: {}",
                self.db_path.display()
            )));
        }

        let backup_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        let backup_filename = format!(
            "sentinel-{}-{}.{}",
            now.format("%Y%m%d-%H%M%S"),
            &backup_id.chars().take(8).collect::<String>(),
            BACKUP_EXTENSION
        );
        let metadata_filename = format!(
            "sentinel-{}-{}.{}",
            now.format("%Y%m%d-%H%M%S"),
            &backup_id.chars().take(8).collect::<String>(),
            METADATA_EXTENSION
        );

        let backup_path = self.backup_dir.join(&backup_filename);
        let metadata_path = self.backup_dir.join(&metadata_filename);

        info!("Creating backup: {}", backup_path.display());

        // Read the database file
        let db_data = fs::read(&self.db_path)
            .map_err(|e| PersistenceError::Backup(format!("Failed to read database: {}", e)))?;
        let original_size = db_data.len() as u64;

        // Compress with gzip
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(&db_data)
            .map_err(|e| PersistenceError::Backup(format!("Failed to compress backup: {}", e)))?;
        let compressed = encoder.finish().map_err(|e| {
            PersistenceError::Backup(format!("Failed to finalize compression: {}", e))
        })?;

        // Calculate hash of compressed data
        let mut hasher = Sha256::new();
        hasher.update(&compressed);
        let hash = hex::encode(hasher.finalize());

        // Write compressed backup
        fs::write(&backup_path, &compressed)
            .map_err(|e| PersistenceError::Backup(format!("Failed to write backup: {}", e)))?;

        // Set restrictive permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = fs::Permissions::from_mode(0o600);
            if let Err(e) = fs::set_permissions(&backup_path, permissions) {
                tracing::warn!("Failed to set backup file permissions to 0600: {}", e);
            }
        }

        let metadata = BackupMetadata {
            id: backup_id,
            created_at: now,
            reason,
            hash,
            compressed_size: compressed.len() as u64,
            original_size,
            schema_version: agent_storage::CURRENT_SCHEMA_VERSION,
            agent_version: agent_common::constants::AGENT_VERSION.to_string(),
        };

        // Write metadata
        let metadata_json = serde_json::to_string_pretty(&metadata)?;
        fs::write(&metadata_path, metadata_json).map_err(|e| {
            PersistenceError::Backup(format!("Failed to write backup metadata: {}", e))
        })?;

        info!(
            "Backup created: {} ({} bytes compressed from {} bytes)",
            backup_path.display(),
            metadata.compressed_size,
            metadata.original_size
        );

        // Clean up old backups
        self.cleanup_old_backups()?;

        Ok(metadata)
    }

    /// Restore the database from a backup.
    pub fn restore_backup(&self, backup_id: &str) -> PersistenceResult<()> {
        let backups = self.list_backups()?;
        let metadata = backups.iter().find(|b| b.id == backup_id).ok_or_else(|| {
            PersistenceError::NotFound(format!("Backup not found: {}", backup_id))
        })?;

        // Find the backup file by matching the creation timestamp and UUID prefix
        let backup_filename = format!(
            "sentinel-{}-{}.{}",
            metadata.created_at.format("%Y%m%d-%H%M%S"),
            &metadata.id.chars().take(8).collect::<String>(),
            BACKUP_EXTENSION
        );
        let backup_path = self.backup_dir.join(&backup_filename);

        if !backup_path.exists() {
            return Err(PersistenceError::NotFound(format!(
                "Backup file not found: {}",
                backup_path.display()
            )));
        }

        info!("Restoring backup: {}", backup_path.display());

        // Read and verify the backup
        let compressed = fs::read(&backup_path)
            .map_err(|e| PersistenceError::Restore(format!("Failed to read backup: {}", e)))?;

        // Verify hash
        let mut hasher = Sha256::new();
        hasher.update(&compressed);
        let hash = hex::encode(hasher.finalize());
        if hash != metadata.hash {
            return Err(PersistenceError::Integrity(format!(
                "Backup hash mismatch: expected {}, got {}",
                metadata.hash, hash
            )));
        }

        // Decompress with streaming size limit to prevent decompression bombs
        const MAX_DECOMPRESSED_SIZE: usize = 10 * 1024 * 1024 * 1024; // 10 GB
        let mut db_data = Vec::new();
        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut total_read = 0usize;
        let mut buf = [0u8; 65536]; // 64KB buffer
        loop {
            let n = decoder.read(&mut buf).map_err(|e| {
                PersistenceError::Restore(format!("Failed to decompress backup: {}", e))
            })?;
            if n == 0 {
                break;
            }
            total_read += n;
            if total_read > MAX_DECOMPRESSED_SIZE {
                return Err(PersistenceError::Restore(format!(
                    "Decompressed backup exceeds maximum size of {} bytes",
                    MAX_DECOMPRESSED_SIZE
                )));
            }
            db_data.extend_from_slice(&buf[..n]);
        }

        // Create a backup of the current database before restoring
        if self.db_path.exists() {
            let pre_restore_path = self.db_path.with_extension("pre-restore.db");
            fs::copy(&self.db_path, &pre_restore_path).map_err(|e| {
                PersistenceError::Restore(format!(
                    "Failed to backup current database before restore: {}",
                    e
                ))
            })?;
            debug!(
                "Pre-restore backup saved to: {}",
                pre_restore_path.display()
            );
        }

        // Write restored database
        fs::write(&self.db_path, &db_data).map_err(|e| {
            PersistenceError::Restore(format!("Failed to write restored database: {}", e))
        })?;

        info!(
            "Database restored from backup {} ({} bytes)",
            backup_id,
            db_data.len()
        );

        Ok(())
    }

    /// List all available backups, sorted by creation date (newest first).
    pub fn list_backups(&self) -> PersistenceResult<Vec<BackupMetadata>> {
        let mut backups = Vec::new();

        if !self.backup_dir.exists() {
            return Ok(backups);
        }

        for entry in fs::read_dir(&self.backup_dir).map_err(|e| {
            PersistenceError::Backup(format!("Failed to read backup directory: {}", e))
        })? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().is_some() {
                // Look for .json metadata files
                if path.to_string_lossy().ends_with(METADATA_EXTENSION) {
                    match fs::read_to_string(&path) {
                        Ok(content) => match serde_json::from_str::<BackupMetadata>(&content) {
                            Ok(metadata) => backups.push(metadata),
                            Err(e) => {
                                warn!("Failed to parse backup metadata {}: {}", path.display(), e);
                            }
                        },
                        Err(e) => {
                            warn!("Failed to read backup metadata {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }

        // Sort by creation date, newest first
        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(backups)
    }

    /// Schedule an automatic backup (creates if enough time has passed).
    ///
    /// Returns `Some(metadata)` if a backup was created, `None` if skipped.
    pub fn auto_backup(
        &self,
        min_interval_hours: u32,
    ) -> PersistenceResult<Option<BackupMetadata>> {
        let backups = self.list_backups()?;

        // Check if a recent backup exists
        if let Some(latest) = backups.first() {
            let elapsed = Utc::now() - latest.created_at;
            if elapsed.num_hours() < min_interval_hours as i64 {
                debug!(
                    "Skipping auto-backup: last backup was {} hours ago (min interval: {} hours)",
                    elapsed.num_hours(),
                    min_interval_hours
                );
                return Ok(None);
            }
        }

        let metadata = self.create_backup(BackupReason::Scheduled)?;
        Ok(Some(metadata))
    }

    /// Remove old backups keeping only the most recent ones.
    fn cleanup_old_backups(&self) -> PersistenceResult<()> {
        let backups = self.list_backups()?;

        if backups.len() <= MAX_BACKUPS {
            return Ok(());
        }

        // Remove oldest backups
        for backup in backups.iter().skip(MAX_BACKUPS) {
            let backup_filename = format!(
                "sentinel-{}-{}.{}",
                backup.created_at.format("%Y%m%d-%H%M%S"),
                &backup.id.chars().take(8).collect::<String>(),
                BACKUP_EXTENSION
            );
            let metadata_filename = format!(
                "sentinel-{}-{}.{}",
                backup.created_at.format("%Y%m%d-%H%M%S"),
                &backup.id.chars().take(8).collect::<String>(),
                METADATA_EXTENSION
            );

            let backup_path = self.backup_dir.join(&backup_filename);
            let metadata_path = self.backup_dir.join(&metadata_filename);

            if let Err(e) = fs::remove_file(&backup_path)
                && e.kind() != std::io::ErrorKind::NotFound
            {
                warn!("Failed to remove old backup {}: {}", backup_path.display(), e);
            }
            if let Err(e) = fs::remove_file(&metadata_path)
                && e.kind() != std::io::ErrorKind::NotFound
            {
                warn!("Failed to remove old backup metadata {}: {}", metadata_path.display(), e);
            }

            debug!("Removed old backup: {}", backup.id);
        }

        info!(
            "Cleaned up {} old backups, keeping {}",
            backups.len() - MAX_BACKUPS,
            MAX_BACKUPS
        );

        Ok(())
    }

    /// Get the default backup directory.
    fn default_backup_dir() -> PathBuf {
        AgentConfig::platform_data_dir().join("backups")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_db(temp_dir: &TempDir) -> PathBuf {
        let db_path = temp_dir.path().join("test.db");
        fs::write(&db_path, b"test database content for backup testing").unwrap();
        db_path
    }

    #[test]
    fn test_create_and_list_backups() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();

        // Create a backup
        let metadata = manager.create_backup(BackupReason::Manual).unwrap();
        assert!(!metadata.id.is_empty());
        assert!(!metadata.hash.is_empty());
        assert!(metadata.compressed_size > 0);
        assert!(metadata.original_size > 0);

        // List backups
        let backups = manager.list_backups().unwrap();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].id, metadata.id);
    }

    #[test]
    fn test_restore_backup() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");
        let original_content = fs::read(&db_path).unwrap();

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();

        // Create backup
        let metadata = manager.create_backup(BackupReason::Manual).unwrap();

        // Modify the database
        fs::write(&db_path, b"modified content").unwrap();
        assert_ne!(fs::read(&db_path).unwrap(), original_content);

        // Restore
        manager.restore_backup(&metadata.id).unwrap();

        // Verify content matches original
        assert_eq!(fs::read(&db_path).unwrap(), original_content);
    }

    #[test]
    fn test_restore_verifies_hash() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();
        let metadata = manager.create_backup(BackupReason::Manual).unwrap();

        // Corrupt the backup file
        let backup_filename = format!(
            "sentinel-{}-{}.{}",
            metadata.created_at.format("%Y%m%d-%H%M%S"),
            &metadata.id.chars().take(8).collect::<String>(),
            BACKUP_EXTENSION
        );
        let backup_path = backup_dir.join(&backup_filename);
        fs::write(&backup_path, b"corrupted data").unwrap();

        // Restore should fail
        let result = manager.restore_backup(&metadata.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_auto_backup_skips_recent() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();

        // First auto-backup should create one
        let result = manager.auto_backup(24).unwrap();
        assert!(result.is_some());

        // Second auto-backup within interval should skip
        let result = manager.auto_backup(24).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_backup_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();

        let result = manager.restore_backup("nonexistent-id");
        assert!(matches!(result, Err(PersistenceError::NotFound(_))));
    }

    #[test]
    fn test_empty_backup_list() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = create_test_db(&temp_dir);
        let backup_dir = temp_dir.path().join("backups");

        let manager = BackupManager::with_backup_dir(&db_path, &backup_dir).unwrap();

        let backups = manager.list_backups().unwrap();
        assert!(backups.is_empty());
    }
}
