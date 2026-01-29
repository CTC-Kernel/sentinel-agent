//! Clean uninstall and reinstall preparation.
//!
//! Handles secure removal of all agent data and preparation for reinstallation.

use crate::error::{PersistenceError, PersistenceResult};
use agent_common::config::AgentConfig;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Result of a cleanup operation.
#[derive(Debug, Clone)]
pub struct CleanupResult {
    /// Files and directories that were removed.
    pub removed: Vec<String>,
    /// Files and directories that failed to remove.
    pub failed: Vec<(String, String)>,
    /// Whether the cleanup was complete.
    pub complete: bool,
}

/// Manages clean uninstall and reinstall preparation.
pub struct CleanupManager {
    /// Data directory.
    data_dir: PathBuf,
}

impl CleanupManager {
    /// Create a new cleanup manager using the default data directory.
    pub fn new() -> Self {
        Self {
            data_dir: AgentConfig::platform_data_dir(),
        }
    }

    /// Create a new cleanup manager with a custom data directory.
    pub fn with_data_dir(data_dir: &Path) -> Self {
        Self {
            data_dir: data_dir.to_path_buf(),
        }
    }

    /// Perform a clean uninstall - remove all agent data.
    ///
    /// This removes:
    /// - Database file
    /// - Encryption key file
    /// - Backup files
    /// - Log files
    /// - Configuration cache
    /// - The data directory itself
    pub fn clean_uninstall(&self) -> CleanupResult {
        info!("Starting clean uninstall from: {}", self.data_dir.display());

        let mut removed = Vec::new();
        let mut failed = Vec::new();

        if !self.data_dir.exists() {
            info!("Data directory does not exist, nothing to clean");
            return CleanupResult {
                removed,
                failed,
                complete: true,
            };
        }

        // Securely remove sensitive files first (overwrite before delete)
        let sensitive_files = [
            self.data_dir.join(agent_common::constants::DB_FILE_NAME),
            self.data_dir.join(".sentinel-key"),
            #[cfg(windows)]
            self.data_dir.join("key.dpapi"),
        ];

        for path in &sensitive_files {
            if path.exists() {
                match self.secure_delete(path) {
                    Ok(()) => {
                        removed.push(path.display().to_string());
                        debug!("Securely deleted: {}", path.display());
                    }
                    Err(e) => {
                        warn!("Failed to securely delete {}: {}", path.display(), e);
                        failed.push((path.display().to_string(), e.to_string()));
                    }
                }
            }
        }

        // Remove WAL and journal files
        let wal_files = [
            self.data_dir.join("agent.db-wal"),
            self.data_dir.join("agent.db-shm"),
            self.data_dir.join("agent.db-journal"),
        ];

        for path in &wal_files {
            if path.exists() {
                match fs::remove_file(path) {
                    Ok(()) => removed.push(path.display().to_string()),
                    Err(e) => {
                        failed.push((path.display().to_string(), e.to_string()));
                    }
                }
            }
        }

        // Remove backup directory
        let backup_dir = self.data_dir.join("backups");
        if backup_dir.exists() {
            match fs::remove_dir_all(&backup_dir) {
                Ok(()) => {
                    removed.push(backup_dir.display().to_string());
                    info!("Removed backup directory");
                }
                Err(e) => {
                    warn!("Failed to remove backup directory: {}", e);
                    failed.push((backup_dir.display().to_string(), e.to_string()));
                }
            }
        }

        // Remove log files
        let log_file = self.data_dir.join(agent_common::constants::LOG_FILE_NAME);
        if log_file.exists() {
            match fs::remove_file(&log_file) {
                Ok(()) => removed.push(log_file.display().to_string()),
                Err(e) => {
                    failed.push((log_file.display().to_string(), e.to_string()));
                }
            }
        }

        // Remove pre-restore backup if exists
        let pre_restore = self.data_dir.join("agent.pre-restore.db");
        if pre_restore.exists() {
            match fs::remove_file(&pre_restore) {
                Ok(()) => removed.push(pre_restore.display().to_string()),
                Err(e) => {
                    failed.push((pre_restore.display().to_string(), e.to_string()));
                }
            }
        }

        // Try to remove the data directory itself (will succeed only if empty)
        match fs::remove_dir(&self.data_dir) {
            Ok(()) => {
                removed.push(self.data_dir.display().to_string());
                info!("Removed data directory: {}", self.data_dir.display());
            }
            Err(e) => {
                debug!(
                    "Data directory not removed (may contain remaining files): {}",
                    e
                );
                // Try remove_dir_all as fallback
                match fs::remove_dir_all(&self.data_dir) {
                    Ok(()) => {
                        removed.push(self.data_dir.display().to_string());
                    }
                    Err(e) => {
                        failed.push((self.data_dir.display().to_string(), e.to_string()));
                    }
                }
            }
        }

        let complete = failed.is_empty();

        if complete {
            info!("Clean uninstall completed: {} items removed", removed.len());
        } else {
            warn!(
                "Clean uninstall partially completed: {} removed, {} failed",
                removed.len(),
                failed.len()
            );
        }

        CleanupResult {
            removed,
            failed,
            complete,
        }
    }

    /// Prepare for reinstallation by clearing credentials but keeping config.
    ///
    /// This removes enrollment credentials so the agent can re-enroll,
    /// but keeps the database structure and configuration.
    pub fn prepare_reinstall(&self) -> PersistenceResult<()> {
        info!("Preparing for reinstallation");

        let db_path = self.data_dir.join(agent_common::constants::DB_FILE_NAME);

        if !db_path.exists() {
            info!("No database found, ready for fresh install");
            return Ok(());
        }

        // Remove the encryption key so a new one will be generated
        let key_paths = [
            self.data_dir.join(".sentinel-key"),
            #[cfg(windows)]
            self.data_dir.join("key.dpapi"),
        ];

        for path in &key_paths {
            if path.exists() {
                self.secure_delete(path).map_err(|e| {
                    PersistenceError::Cleanup(format!(
                        "Failed to remove key file {}: {}",
                        path.display(),
                        e
                    ))
                })?;
                debug!("Removed key file: {}", path.display());
            }
        }

        // Remove the database file (credentials are inside)
        if db_path.exists() {
            self.secure_delete(&db_path).map_err(|e| {
                PersistenceError::Cleanup(format!("Failed to remove database: {}", e))
            })?;
        }

        // Remove WAL files
        for ext in &["db-wal", "db-shm", "db-journal"] {
            let wal_path = self.data_dir.join(format!("agent.{}", ext));
            if wal_path.exists() {
                let _ = fs::remove_file(&wal_path);
            }
        }

        info!("Reinstallation preparation complete");
        Ok(())
    }

    /// Securely delete a file by overwriting with zeros before removing.
    fn secure_delete(&self, path: &Path) -> Result<(), std::io::Error> {
        if let Ok(metadata) = fs::metadata(path) {
            let size = metadata.len() as usize;
            if size > 0 {
                // Overwrite with zeros
                let zeros = vec![0u8; size];
                fs::write(path, &zeros)?;

                // Sync to disk
                let file = fs::OpenOptions::new().write(true).open(path)?;
                file.sync_all()?;
            }
        }

        fs::remove_file(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_clean_uninstall_empty_dir() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path().join("sentinel-data");
        fs::create_dir_all(&data_dir).unwrap();

        let manager = CleanupManager::with_data_dir(&data_dir);
        let result = manager.clean_uninstall();

        assert!(result.complete);
        assert!(!data_dir.exists());
    }

    #[test]
    fn test_clean_uninstall_with_files() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path().join("sentinel-data");
        fs::create_dir_all(&data_dir).unwrap();

        // Create some test files
        fs::write(data_dir.join("agent.db"), b"database content").unwrap();
        fs::write(data_dir.join(".sentinel-key"), b"secret key content").unwrap();
        fs::write(data_dir.join("agent.log"), b"log content").unwrap();

        let manager = CleanupManager::with_data_dir(&data_dir);
        let result = manager.clean_uninstall();

        assert!(result.complete);
        assert!(!data_dir.exists());
        assert!(result.removed.len() >= 3);
    }

    #[test]
    fn test_clean_uninstall_nonexistent_dir() {
        let manager = CleanupManager::with_data_dir(Path::new("/nonexistent/path"));
        let result = manager.clean_uninstall();

        assert!(result.complete);
        assert!(result.removed.is_empty());
    }

    #[test]
    fn test_prepare_reinstall() {
        let temp_dir = TempDir::new().unwrap();
        let data_dir = temp_dir.path().join("sentinel-data");
        fs::create_dir_all(&data_dir).unwrap();

        // Create test files
        fs::write(data_dir.join("agent.db"), b"database").unwrap();
        fs::write(data_dir.join(".sentinel-key"), b"key").unwrap();

        let manager = CleanupManager::with_data_dir(&data_dir);
        manager.prepare_reinstall().unwrap();

        // Database and key should be removed
        assert!(!data_dir.join("agent.db").exists());
        assert!(!data_dir.join(".sentinel-key").exists());

        // Data directory should still exist
        assert!(data_dir.exists());
    }
}
