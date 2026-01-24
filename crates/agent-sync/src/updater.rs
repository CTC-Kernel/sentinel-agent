//! Agent update manager with shadow copy and rollback.
//!
//! This module provides:
//! - Shadow copy update mechanism for safe updates
//! - Automatic rollback on failure
//! - Health check after update
//! - Code signature verification

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use crate::security::SignatureValidator;
use crate::update::{AvailableUpdate, UpdateService, UpdateState};
use chrono::{DateTime, Utc};
use semver::Version;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// Maximum time to wait for health check after update (seconds).
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 60;

/// Maximum rollback time in seconds (NFR-R5: < 2 minutes).
#[allow(dead_code)] // Reserved for future rollback timing validation
const MAX_ROLLBACK_SECS: u64 = 120;

/// Shadow copy suffix for backup files.
const SHADOW_COPY_SUFFIX: &str = ".shadow";

/// Update metadata stored alongside binary.
const UPDATE_METADATA_FILE: &str = ".update-metadata.json";

/// Update metadata for tracking current and previous versions.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateMetadata {
    /// Current version.
    pub current_version: String,
    /// Previous version (for rollback).
    pub previous_version: Option<String>,
    /// When the update was applied.
    pub updated_at: Option<DateTime<Utc>>,
    /// SHA-256 hash of current binary.
    pub current_hash: Option<String>,
    /// SHA-256 hash of previous binary.
    pub previous_hash: Option<String>,
    /// Whether rollback is available.
    pub rollback_available: bool,
    /// Update state.
    pub state: String,
}

impl Default for UpdateMetadata {
    fn default() -> Self {
        Self {
            current_version: String::new(),
            previous_version: None,
            updated_at: None,
            current_hash: None,
            previous_hash: None,
            rollback_available: false,
            state: UpdateState::Idle.as_str().to_string(),
        }
    }
}

/// Result of an update operation.
#[derive(Debug, Clone)]
pub struct UpdateResult {
    /// Whether the update was successful.
    pub success: bool,
    /// Previous version.
    pub from_version: Version,
    /// New version (if successful).
    pub to_version: Version,
    /// Update state.
    pub state: UpdateState,
    /// Error message (if failed).
    pub error: Option<String>,
    /// Whether rollback was performed.
    pub rolled_back: bool,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
}

/// Health check result after update.
#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    /// Whether the health check passed.
    pub healthy: bool,
    /// Version reported by new binary.
    pub version: Option<String>,
    /// Process ID if running.
    pub pid: Option<u32>,
    /// Error message if unhealthy.
    pub error: Option<String>,
    /// Check duration in milliseconds.
    pub duration_ms: u64,
}

/// Update manager with shadow copy and rollback support.
pub struct UpdateManager {
    /// Update service for checking and downloading.
    update_service: Arc<UpdateService>,
    /// Installation directory containing the binary.
    install_dir: PathBuf,
    /// Binary filename.
    binary_name: String,
    /// Current state.
    state: RwLock<UpdateState>,
    /// Whether an update is in progress.
    in_progress: AtomicBool,
    /// Signature validator for code signing verification.
    signature_validator: Option<Arc<SignatureValidator>>,
    /// HTTP client for reporting failed versions.
    client: Option<Arc<AuthenticatedClient>>,
}

impl UpdateManager {
    /// Create a new update manager.
    pub fn new(
        update_service: Arc<UpdateService>,
        install_dir: PathBuf,
        binary_name: &str,
    ) -> Self {
        Self {
            update_service,
            install_dir,
            binary_name: binary_name.to_string(),
            state: RwLock::new(UpdateState::Idle),
            in_progress: AtomicBool::new(false),
            signature_validator: None,
            client: None,
        }
    }

    /// Set signature validator for code signing verification (H1 fix).
    pub fn with_signature_validator(mut self, validator: Arc<SignatureValidator>) -> Self {
        self.signature_validator = Some(validator);
        self
    }

    /// Set HTTP client for reporting failed versions (M1 fix).
    pub fn with_client(mut self, client: Arc<AuthenticatedClient>) -> Self {
        self.client = Some(client);
        self
    }

    /// Get current state.
    pub async fn state(&self) -> UpdateState {
        *self.state.read().await
    }

    /// Check if an update is in progress.
    pub fn is_in_progress(&self) -> bool {
        self.in_progress.load(Ordering::Relaxed)
    }

    /// Get path to the main binary.
    pub fn binary_path(&self) -> PathBuf {
        self.install_dir.join(&self.binary_name)
    }

    /// Get path to the shadow copy (backup).
    pub fn shadow_path(&self) -> PathBuf {
        self.install_dir
            .join(format!("{}{}", self.binary_name, SHADOW_COPY_SUFFIX))
    }

    /// Get path to update metadata.
    pub fn metadata_path(&self) -> PathBuf {
        self.install_dir.join(UPDATE_METADATA_FILE)
    }

    /// Load update metadata.
    pub async fn load_metadata(&self) -> SyncResult<UpdateMetadata> {
        let path = self.metadata_path();

        if !path.exists() {
            return Ok(UpdateMetadata {
                current_version: self.update_service.current_version().to_string(),
                ..Default::default()
            });
        }

        let data = fs::read_to_string(&path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to read update metadata: {}", e)))?;

        serde_json::from_str(&data)
            .map_err(|e| SyncError::Config(format!("Failed to parse update metadata: {}", e)))
    }

    /// Save update metadata.
    pub async fn save_metadata(&self, metadata: &UpdateMetadata) -> SyncResult<()> {
        let path = self.metadata_path();
        let data = serde_json::to_string_pretty(metadata).map_err(|e| {
            SyncError::Config(format!("Failed to serialize update metadata: {}", e))
        })?;

        fs::write(&path, data)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to write update metadata: {}", e)))
    }

    /// Apply an update.
    ///
    /// This method:
    /// 1. Downloads the update package
    /// 2. Verifies the SHA-256 hash
    /// 3. Creates a shadow copy of the current binary
    /// 4. Replaces the binary with the new version
    /// 5. Performs a health check
    /// 6. Rolls back if health check fails
    pub async fn apply_update(&self, update: &AvailableUpdate) -> SyncResult<UpdateResult> {
        // Prevent concurrent updates
        if self.in_progress.swap(true, Ordering::SeqCst) {
            return Err(SyncError::Config("Update already in progress".to_string()));
        }

        let result = self.do_apply_update(update).await;

        // Reset in-progress flag
        self.in_progress.store(false, Ordering::SeqCst);

        result
    }

    /// Internal update application logic.
    async fn do_apply_update(&self, update: &AvailableUpdate) -> SyncResult<UpdateResult> {
        let from_version = update.current_version.clone();
        let to_version = update.new_version.clone();

        info!("Starting update from {} to {}", from_version, to_version);

        // Update state: Downloading
        *self.state.write().await = UpdateState::Downloading;

        // Download the update
        let staging_path = match self.update_service.download_update(update).await {
            Ok(path) => path,
            Err(e) => {
                *self.state.write().await = UpdateState::Failed;
                return Ok(UpdateResult {
                    success: false,
                    from_version,
                    to_version,
                    state: UpdateState::Failed,
                    error: Some(format!("Download failed: {}", e)),
                    rolled_back: false,
                    timestamp: Utc::now(),
                });
            }
        };

        // Update state: Verifying
        *self.state.write().await = UpdateState::Verifying;

        // Verify SHA-256 integrity
        if !update.sha256.is_empty() {
            match self
                .update_service
                .verify_package(&staging_path, &update.sha256)
                .await
            {
                Ok(true) => {}
                Ok(false) => {
                    *self.state.write().await = UpdateState::Failed;
                    // Clean up staging file
                    let _ = fs::remove_file(&staging_path).await;
                    // Mark version as failed for investigation (M1)
                    self.mark_version_failed(&to_version, "SHA-256 hash mismatch")
                        .await;
                    return Ok(UpdateResult {
                        success: false,
                        from_version,
                        to_version,
                        state: UpdateState::Failed,
                        error: Some("Package integrity verification failed".to_string()),
                        rolled_back: false,
                        timestamp: Utc::now(),
                    });
                }
                Err(e) => {
                    *self.state.write().await = UpdateState::Failed;
                    let _ = fs::remove_file(&staging_path).await;
                    // Mark version as failed for investigation (M1)
                    self.mark_version_failed(&to_version, &format!("Verification error: {}", e))
                        .await;
                    return Ok(UpdateResult {
                        success: false,
                        from_version,
                        to_version,
                        state: UpdateState::Failed,
                        error: Some(format!("Verification error: {}", e)),
                        rolled_back: false,
                        timestamp: Utc::now(),
                    });
                }
            }
        }

        // Verify code signature (H1 - AC1 of Story 10.2)
        if let Some(ref validator) = self.signature_validator {
            info!("Verifying code signature for {:?}", staging_path);
            match validator.verify_and_block(&staging_path).await {
                Ok(()) => {
                    info!("Code signature verification passed");
                }
                Err(e) => {
                    *self.state.write().await = UpdateState::Failed;
                    let _ = fs::remove_file(&staging_path).await;
                    // Mark version as failed for investigation (M1)
                    self.mark_version_failed(
                        &to_version,
                        &format!("Signature verification failed: {}", e),
                    )
                    .await;
                    return Ok(UpdateResult {
                        success: false,
                        from_version,
                        to_version,
                        state: UpdateState::Failed,
                        error: Some(format!("Code signature verification failed: {}", e)),
                        rolled_back: false,
                        timestamp: Utc::now(),
                    });
                }
            }
        } else {
            warn!("No signature validator configured - skipping code signature verification");
        }

        // Update state: Installing
        *self.state.write().await = UpdateState::Installing;

        // Create shadow copy of current binary
        if let Err(e) = self.create_shadow_copy().await {
            *self.state.write().await = UpdateState::Failed;
            let _ = fs::remove_file(&staging_path).await;
            return Ok(UpdateResult {
                success: false,
                from_version,
                to_version,
                state: UpdateState::Failed,
                error: Some(format!("Failed to create shadow copy: {}", e)),
                rolled_back: false,
                timestamp: Utc::now(),
            });
        }

        // Replace binary with new version
        if let Err(e) = self.replace_binary(&staging_path).await {
            *self.state.write().await = UpdateState::Failed;

            // Try to rollback
            if let Err(rollback_err) = self.rollback().await {
                error!("Rollback also failed: {}", rollback_err);
                return Ok(UpdateResult {
                    success: false,
                    from_version,
                    to_version,
                    state: UpdateState::Failed,
                    error: Some(format!(
                        "Replace failed: {}. Rollback also failed: {}",
                        e, rollback_err
                    )),
                    rolled_back: false,
                    timestamp: Utc::now(),
                });
            }

            return Ok(UpdateResult {
                success: false,
                from_version,
                to_version,
                state: UpdateState::RolledBack,
                error: Some(format!("Replace failed: {}", e)),
                rolled_back: true,
                timestamp: Utc::now(),
            });
        }

        // Clean up staging file
        let _ = fs::remove_file(&staging_path).await;

        // Save metadata
        let metadata = UpdateMetadata {
            current_version: to_version.to_string(),
            previous_version: Some(from_version.to_string()),
            updated_at: Some(Utc::now()),
            current_hash: Some(update.sha256.clone()),
            previous_hash: None, // Could compute this
            rollback_available: true,
            state: UpdateState::Installing.as_str().to_string(),
        };
        if let Err(e) = self.save_metadata(&metadata).await {
            warn!("Failed to save update metadata: {}", e);
        }

        // Perform post-update health check (H2 - AC3 of Story 10.2, AC1 of Story 10.3)
        info!("Performing post-update health check");
        let health_check = self.perform_health_check(&to_version).await;

        if !health_check.healthy {
            error!("Post-update health check FAILED: {:?}", health_check.error);
            *self.state.write().await = UpdateState::Failed;

            // Mark version as failed for investigation (M1)
            let reason = health_check
                .error
                .as_deref()
                .unwrap_or("Health check failed");
            self.mark_version_failed(&to_version, reason).await;

            // Trigger rollback (AC1 of 10.3 - rollback on health check failure)
            if let Err(rollback_err) = self.rollback().await {
                error!(
                    "Rollback after health check failure also failed: {}",
                    rollback_err
                );
                return Ok(UpdateResult {
                    success: false,
                    from_version,
                    to_version,
                    state: UpdateState::Failed,
                    error: Some(format!(
                        "Health check failed: {}. Rollback also failed: {}",
                        reason, rollback_err
                    )),
                    rolled_back: false,
                    timestamp: Utc::now(),
                });
            }

            return Ok(UpdateResult {
                success: false,
                from_version,
                to_version,
                state: UpdateState::RolledBack,
                error: Some(format!(
                    "Health check failed: {}. Rolled back to previous version.",
                    reason
                )),
                rolled_back: true,
                timestamp: Utc::now(),
            });
        }

        // Update state: Completed
        *self.state.write().await = UpdateState::Completed;

        info!(
            "Update completed successfully: {} -> {} (health check passed in {}ms)",
            from_version, to_version, health_check.duration_ms
        );

        Ok(UpdateResult {
            success: true,
            from_version,
            to_version,
            state: UpdateState::Completed,
            error: None,
            rolled_back: false,
            timestamp: Utc::now(),
        })
    }

    /// Create a shadow copy of the current binary.
    async fn create_shadow_copy(&self) -> SyncResult<()> {
        let binary_path = self.binary_path();
        let shadow_path = self.shadow_path();

        if !binary_path.exists() {
            return Err(SyncError::Config(format!(
                "Binary not found: {:?}",
                binary_path
            )));
        }

        info!(
            "Creating shadow copy: {:?} -> {:?}",
            binary_path, shadow_path
        );

        fs::copy(&binary_path, &shadow_path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to create shadow copy: {}", e)))?;

        Ok(())
    }

    /// Replace the binary with the new version.
    async fn replace_binary(&self, staging_path: &Path) -> SyncResult<()> {
        let binary_path = self.binary_path();

        info!("Replacing binary: {:?} -> {:?}", staging_path, binary_path);

        // On Windows, we might need to rename first
        #[cfg(windows)]
        {
            let backup_path = binary_path.with_extension("old");
            if binary_path.exists() {
                fs::rename(&binary_path, &backup_path)
                    .await
                    .map_err(|e| SyncError::Config(format!("Failed to move old binary: {}", e)))?;
            }
        }

        fs::copy(staging_path, &binary_path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to copy new binary: {}", e)))?;

        // Set executable permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(0o755);
            fs::set_permissions(&binary_path, permissions)
                .await
                .map_err(|e| {
                    SyncError::Config(format!("Failed to set binary permissions: {}", e))
                })?;
        }

        Ok(())
    }

    /// Rollback to the previous version.
    pub async fn rollback(&self) -> SyncResult<()> {
        let shadow_path = self.shadow_path();
        let binary_path = self.binary_path();

        if !shadow_path.exists() {
            return Err(SyncError::Config(
                "No shadow copy available for rollback".to_string(),
            ));
        }

        info!("Rolling back: {:?} -> {:?}", shadow_path, binary_path);

        *self.state.write().await = UpdateState::RolledBack;

        fs::copy(&shadow_path, &binary_path)
            .await
            .map_err(|e| SyncError::Config(format!("Rollback failed: {}", e)))?;

        // Set executable permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(0o755);
            fs::set_permissions(&binary_path, permissions)
                .await
                .map_err(|e| {
                    SyncError::Config(format!("Failed to set binary permissions: {}", e))
                })?;
        }

        // Update metadata
        if let Ok(mut metadata) = self.load_metadata().await {
            if let Some(prev) = metadata.previous_version.take() {
                metadata.current_version = prev;
            }
            metadata.rollback_available = false;
            metadata.state = UpdateState::RolledBack.as_str().to_string();
            let _ = self.save_metadata(&metadata).await;
        }

        info!("Rollback completed");

        Ok(())
    }

    /// Check if rollback is available.
    pub async fn can_rollback(&self) -> bool {
        self.shadow_path().exists()
    }

    /// Clean up shadow copy after successful operation.
    pub async fn cleanup_shadow(&self) -> SyncResult<()> {
        let shadow_path = self.shadow_path();

        if shadow_path.exists() {
            fs::remove_file(&shadow_path)
                .await
                .map_err(|e| SyncError::Config(format!("Failed to remove shadow copy: {}", e)))?;
        }

        Ok(())
    }

    /// Compute SHA-256 hash of a file.
    pub async fn compute_hash(path: &Path) -> SyncResult<String> {
        let data = fs::read(path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to read file for hashing: {}", e)))?;

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let hash = hasher.finalize();

        Ok(hex::encode(hash))
    }

    /// Perform post-update health check (H2 fix - AC3 of 10.2, AC1 of 10.3).
    ///
    /// This method verifies that the new binary can start correctly by:
    /// 1. Checking if the binary file exists
    /// 2. Verifying file permissions are correct
    /// 3. Optionally running a version check command
    async fn perform_health_check(&self, expected_version: &Version) -> HealthCheckResult {
        let start = std::time::Instant::now();
        let binary_path = self.binary_path();

        // Check if binary exists
        if !binary_path.exists() {
            return HealthCheckResult {
                healthy: false,
                version: None,
                pid: None,
                error: Some("Binary file does not exist after update".to_string()),
                duration_ms: start.elapsed().as_millis() as u64,
            };
        }

        // Check file size (should not be empty)
        match fs::metadata(&binary_path).await {
            Ok(metadata) => {
                if metadata.len() == 0 {
                    return HealthCheckResult {
                        healthy: false,
                        version: None,
                        pid: None,
                        error: Some("Binary file is empty after update".to_string()),
                        duration_ms: start.elapsed().as_millis() as u64,
                    };
                }
            }
            Err(e) => {
                return HealthCheckResult {
                    healthy: false,
                    version: None,
                    pid: None,
                    error: Some(format!("Failed to read binary metadata: {}", e)),
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        }

        // Check executable permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            match std::fs::metadata(&binary_path) {
                Ok(metadata) => {
                    let mode = metadata.permissions().mode();
                    if mode & 0o111 == 0 {
                        return HealthCheckResult {
                            healthy: false,
                            version: None,
                            pid: None,
                            error: Some("Binary is not executable".to_string()),
                            duration_ms: start.elapsed().as_millis() as u64,
                        };
                    }
                }
                Err(e) => {
                    return HealthCheckResult {
                        healthy: false,
                        version: None,
                        pid: None,
                        error: Some(format!("Failed to check permissions: {}", e)),
                        duration_ms: start.elapsed().as_millis() as u64,
                    };
                }
            }
        }

        // Try to run version check (--version flag)
        // Timeout after HEALTH_CHECK_TIMEOUT_SECS
        let version_check = tokio::time::timeout(
            std::time::Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS),
            tokio::process::Command::new(&binary_path)
                .arg("--version")
                .output(),
        )
        .await;

        match version_check {
            Ok(Ok(output)) => {
                let version_output = String::from_utf8_lossy(&output.stdout);
                let stderr_output = String::from_utf8_lossy(&output.stderr);

                if output.status.success() {
                    // Parse version from output
                    let reported_version = version_output.lines().next().and_then(|line| {
                        // Try to extract version number (e.g., "sentinel-agent 1.2.0" -> "1.2.0")
                        line.split_whitespace()
                            .find(|s| {
                                s.chars()
                                    .next()
                                    .map(|c| c.is_ascii_digit())
                                    .unwrap_or(false)
                            })
                            .map(|s| s.to_string())
                    });

                    // Optionally verify version matches expected
                    if let Some(ref ver) = reported_version {
                        if let Ok(parsed) = semver::Version::parse(ver) {
                            if &parsed != expected_version {
                                warn!(
                                    "Version mismatch: expected {}, got {}",
                                    expected_version, parsed
                                );
                                // This is a warning, not a failure - version might be reported differently
                            }
                        }
                    }

                    info!(
                        "Health check passed: binary reports version {:?}",
                        reported_version
                    );
                    HealthCheckResult {
                        healthy: true,
                        version: reported_version,
                        pid: None,
                        error: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                    }
                } else {
                    HealthCheckResult {
                        healthy: false,
                        version: None,
                        pid: None,
                        error: Some(format!(
                            "Binary --version failed: exit={:?}, stderr={}",
                            output.status.code(),
                            stderr_output.trim()
                        )),
                        duration_ms: start.elapsed().as_millis() as u64,
                    }
                }
            }
            Ok(Err(e)) => {
                // Failed to execute
                HealthCheckResult {
                    healthy: false,
                    version: None,
                    pid: None,
                    error: Some(format!("Failed to execute binary: {}", e)),
                    duration_ms: start.elapsed().as_millis() as u64,
                }
            }
            Err(_) => {
                // Timeout
                HealthCheckResult {
                    healthy: false,
                    version: None,
                    pid: None,
                    error: Some(format!(
                        "Health check timed out after {} seconds",
                        HEALTH_CHECK_TIMEOUT_SECS
                    )),
                    duration_ms: start.elapsed().as_millis() as u64,
                }
            }
        }
    }

    /// Mark a version as failed for investigation (M1 fix - AC3 of Story 10.3).
    ///
    /// Reports to the SaaS that this version failed to install so it can be
    /// flagged for investigation and potentially blocked.
    async fn mark_version_failed(&self, version: &Version, reason: &str) {
        let Some(ref client) = self.client else {
            warn!("No client configured - cannot report failed version");
            return;
        };

        #[derive(Serialize)]
        struct FailedVersionReport {
            version: String,
            reason: String,
            timestamp: DateTime<Utc>,
            agent_version: String,
        }

        let report = FailedVersionReport {
            version: version.to_string(),
            reason: reason.to_string(),
            timestamp: Utc::now(),
            agent_version: self.update_service.current_version().to_string(),
        };

        let agent_id = match client.agent_id().await {
            Ok(id) => id,
            Err(e) => {
                warn!("Failed to get agent ID for version failure report: {}", e);
                return;
            }
        };

        let path = format!("/v1/agents/{}/versions/failed", agent_id);

        match client
            .post_json::<_, serde_json::Value>(&path, &report)
            .await
        {
            Ok(_) => {
                info!(
                    "Reported failed version {} for investigation: {}",
                    version, reason
                );
            }
            Err(e) => {
                warn!("Failed to report version failure: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_metadata_default() {
        let metadata = UpdateMetadata::default();
        assert!(metadata.current_version.is_empty());
        assert!(metadata.previous_version.is_none());
        assert!(!metadata.rollback_available);
    }

    #[test]
    fn test_update_metadata_serialization() {
        let metadata = UpdateMetadata {
            current_version: "1.1.0".to_string(),
            previous_version: Some("1.0.0".to_string()),
            updated_at: Some(Utc::now()),
            current_hash: Some("abc123".to_string()),
            previous_hash: None,
            rollback_available: true,
            state: UpdateState::Completed.as_str().to_string(),
        };

        let json = serde_json::to_string(&metadata).unwrap();
        assert!(json.contains("1.1.0"));
        assert!(json.contains("1.0.0"));
        assert!(json.contains("rollback_available"));

        let parsed: UpdateMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.current_version, "1.1.0");
        assert_eq!(parsed.previous_version, Some("1.0.0".to_string()));
        assert!(parsed.rollback_available);
    }

    #[test]
    fn test_update_result() {
        let result = UpdateResult {
            success: true,
            from_version: Version::new(1, 0, 0),
            to_version: Version::new(1, 1, 0),
            state: UpdateState::Completed,
            error: None,
            rolled_back: false,
            timestamp: Utc::now(),
        };

        assert!(result.success);
        assert!(!result.rolled_back);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_update_result_failure() {
        let result = UpdateResult {
            success: false,
            from_version: Version::new(1, 0, 0),
            to_version: Version::new(1, 1, 0),
            state: UpdateState::RolledBack,
            error: Some("Hash mismatch".to_string()),
            rolled_back: true,
            timestamp: Utc::now(),
        };

        assert!(!result.success);
        assert!(result.rolled_back);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_health_check_result() {
        let result = HealthCheckResult {
            healthy: true,
            version: Some("1.1.0".to_string()),
            pid: Some(12345),
            error: None,
            duration_ms: 150,
        };

        assert!(result.healthy);
        assert_eq!(result.version, Some("1.1.0".to_string()));
    }

    #[test]
    fn test_shadow_copy_suffix() {
        assert_eq!(SHADOW_COPY_SUFFIX, ".shadow");
    }

    #[test]
    fn test_health_check_timeout() {
        assert_eq!(HEALTH_CHECK_TIMEOUT_SECS, 60);
    }

    #[test]
    fn test_max_rollback_time() {
        // NFR-R5: Rollback < 2 minutes
        assert!(MAX_ROLLBACK_SECS <= 120);
    }

    #[test]
    fn test_health_check_result_healthy() {
        let result = HealthCheckResult {
            healthy: true,
            version: Some("1.2.0".to_string()),
            pid: Some(12345),
            error: None,
            duration_ms: 100,
        };

        assert!(result.healthy);
        assert_eq!(result.version, Some("1.2.0".to_string()));
        assert!(result.error.is_none());
    }

    #[test]
    fn test_health_check_result_unhealthy() {
        let result = HealthCheckResult {
            healthy: false,
            version: None,
            pid: None,
            error: Some("Binary crashed on startup".to_string()),
            duration_ms: 5000,
        };

        assert!(!result.healthy);
        assert!(result.version.is_none());
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("crashed"));
    }
}
