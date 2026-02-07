//! Data cleanup functions for agent uninstallation.
//!
//! This module handles cleanup of agent data during uninstallation,
//! with options to preserve certain data categories.

use std::fs;
use std::path::Path;
use tracing::{info, warn};

/// Paths to clean up on Windows.
#[cfg(windows)]
mod paths {
    pub const CONFIG_DIR: &str = r"C:\ProgramData\Sentinel";
    pub const LOG_DIR: &str = r"C:\ProgramData\Sentinel\logs";
    pub const DATA_DIR: &str = r"C:\ProgramData\Sentinel\data";
    pub const INSTALL_DIR: &str = r"C:\Program Files\Sentinel";
}

/// Paths to clean up on Unix/Linux.
/// Note: These paths must be consistent with service/unix.rs SYSTEMD_UNIT_TEMPLATE
#[cfg(unix)]
mod paths {
    pub const CONFIG_DIR: &str = "/etc/sentinel";
    pub const LOG_DIR: &str = "/var/log/sentinel-grc";
    pub const DATA_DIR: &str = "/var/lib/sentinel-grc";
    pub const INSTALL_DIR: &str = "/opt/sentinel-grc";
}

/// Options for cleanup operation.
#[derive(Debug, Clone, Default)]
pub struct CleanupOptions {
    /// Remove all data including config, logs, and database.
    pub purge: bool,
    /// Keep log files even with purge enabled.
    pub keep_logs: bool,
}

/// Result of cleanup operation.
#[derive(Debug)]
pub struct CleanupResult {
    /// Directories removed.
    pub removed_dirs: Vec<String>,
    /// Directories preserved.
    pub preserved_dirs: Vec<String>,
    /// Files removed.
    pub removed_files: usize,
    /// Errors encountered (non-fatal).
    pub errors: Vec<String>,
}

impl CleanupResult {
    fn new() -> Self {
        Self {
            removed_dirs: Vec::new(),
            preserved_dirs: Vec::new(),
            removed_files: 0,
            errors: Vec::new(),
        }
    }
}

/// Perform data cleanup based on options.
///
/// # Arguments
/// * `options` - Cleanup options specifying what to remove/preserve.
///
/// # Returns
/// A `CleanupResult` summarizing what was cleaned up.
pub fn cleanup_data(options: &CleanupOptions) -> CleanupResult {
    let mut result = CleanupResult::new();

    if !options.purge {
        // Default uninstall: only remove service, preserve all data
        info!("Preserving configuration, logs, and database (use --purge to remove)");
        result.preserved_dirs.push(paths::CONFIG_DIR.to_string());
        result.preserved_dirs.push(paths::LOG_DIR.to_string());
        result.preserved_dirs.push(paths::DATA_DIR.to_string());
        return result;
    }

    // Purge mode: remove data based on options
    info!("Purging agent data...");

    // Remove database directory
    if let Err(e) = remove_directory(paths::DATA_DIR) {
        result
            .errors
            .push(format!("Failed to remove data dir: {}", e));
    } else {
        result.removed_dirs.push(paths::DATA_DIR.to_string());
    }

    // Remove config directory
    if let Err(e) = remove_directory(paths::CONFIG_DIR) {
        result
            .errors
            .push(format!("Failed to remove config dir: {}", e));
    } else {
        result.removed_dirs.push(paths::CONFIG_DIR.to_string());
    }

    // Handle logs based on keep_logs flag
    if options.keep_logs {
        info!("Preserving log files at {}", paths::LOG_DIR);
        result.preserved_dirs.push(paths::LOG_DIR.to_string());
    } else if let Err(e) = remove_directory(paths::LOG_DIR) {
        result
            .errors
            .push(format!("Failed to remove log dir: {}", e));
    } else {
        result.removed_dirs.push(paths::LOG_DIR.to_string());
    }

    // Try to remove installation directory if empty
    if let Err(e) = remove_directory_if_empty(paths::INSTALL_DIR) {
        if !e.contains("not empty") {
            result
                .errors
                .push(format!("Failed to remove install dir: {}", e));
        } else {
            result.preserved_dirs.push(paths::INSTALL_DIR.to_string());
        }
    } else {
        result.removed_dirs.push(paths::INSTALL_DIR.to_string());
    }

    result
}

/// Remove a directory and all its contents.
fn remove_directory(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if !path.exists() {
        return Ok(());
    }

    fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    info!("Removed directory: {}", path.display());
    Ok(())
}

/// Remove a directory only if it's empty.
fn remove_directory_if_empty(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if !path.exists() {
        return Ok(());
    }

    // Check if directory is empty
    let is_empty = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .next()
        .is_none();

    if !is_empty {
        return Err("directory not empty".to_string());
    }

    fs::remove_dir(path).map_err(|e| e.to_string())?;
    info!("Removed empty directory: {}", path.display());
    Ok(())
}

/// Print cleanup summary to stdout (user-facing CLI output).
pub fn print_cleanup_summary(result: &CleanupResult) {
    if !result.removed_dirs.is_empty() {
        info!("Removed directories:");
        for dir in &result.removed_dirs {
            info!("  - {}", dir);
        }
    }

    if !result.preserved_dirs.is_empty() {
        info!("Preserved directories:");
        for dir in &result.preserved_dirs {
            info!("  - {}", dir);
        }
    }

    if !result.errors.is_empty() {
        warn!("Some cleanup operations failed:");
        for err in &result.errors {
            warn!("  Warning: {}", err);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cleanup_options_default() {
        let options = CleanupOptions::default();
        assert!(!options.purge);
        assert!(!options.keep_logs);
    }

    #[test]
    fn test_cleanup_without_purge() {
        let options = CleanupOptions {
            purge: false,
            keep_logs: false,
        };
        let result = cleanup_data(&options);
        // Without purge, all directories should be preserved
        assert!(result.removed_dirs.is_empty());
        assert!(!result.preserved_dirs.is_empty());
    }

    #[test]
    fn test_paths_defined() {
        assert!(!paths::CONFIG_DIR.is_empty());
        assert!(!paths::LOG_DIR.is_empty());
        assert!(!paths::DATA_DIR.is_empty());
        assert!(!paths::INSTALL_DIR.is_empty());
    }
}
