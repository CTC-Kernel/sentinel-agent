//! Agent self-update system.
//!
//! This module provides:
//! - Checking for available updates from SaaS
//! - Downloading and verifying update packages
//! - Shadow copy update mechanism with rollback
//! - Staged rollout support

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::{debug, error, info, warn};

/// Default update check interval in seconds (4 hours).
pub const DEFAULT_UPDATE_CHECK_INTERVAL_SECS: u64 = 4 * 60 * 60;

/// Update policy defining how the agent handles updates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum UpdatePolicy {
    /// Updates are applied automatically when available.
    #[default]
    Automatic,
    /// Updates require manual approval from administrator.
    ManualApproval,
    /// Updates are deferred for a specified number of days.
    Deferred,
    /// Updates are disabled (only for non-mandatory updates).
    Disabled,
}

impl UpdatePolicy {
    /// Parse from string.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "automatic" | "auto" => Some(UpdatePolicy::Automatic),
            "manual" | "manual_approval" => Some(UpdatePolicy::ManualApproval),
            "deferred" => Some(UpdatePolicy::Deferred),
            "disabled" => Some(UpdatePolicy::Disabled),
            _ => None,
        }
    }

    /// Convert to string.
    pub fn as_str(&self) -> &'static str {
        match self {
            UpdatePolicy::Automatic => "automatic",
            UpdatePolicy::ManualApproval => "manual_approval",
            UpdatePolicy::Deferred => "deferred",
            UpdatePolicy::Disabled => "disabled",
        }
    }
}

/// Rollout group for staged deployment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum RolloutGroup {
    /// Canary group (1% of fleet).
    Canary,
    /// Early adopter group (10% of fleet).
    EarlyAdopter,
    /// Majority group (50% of fleet).
    Majority,
    /// General availability (100% of fleet).
    #[default]
    GeneralAvailability,
}

impl RolloutGroup {
    /// Get the percentage of fleet in this group.
    pub fn percentage(&self) -> u8 {
        match self {
            RolloutGroup::Canary => 1,
            RolloutGroup::EarlyAdopter => 10,
            RolloutGroup::Majority => 50,
            RolloutGroup::GeneralAvailability => 100,
        }
    }

    /// Parse from string.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "canary" => Some(RolloutGroup::Canary),
            "early_adopter" | "early" => Some(RolloutGroup::EarlyAdopter),
            "majority" => Some(RolloutGroup::Majority),
            "general_availability" | "ga" | "all" => Some(RolloutGroup::GeneralAvailability),
            _ => None,
        }
    }
}

/// Response from update check endpoint.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UpdateCheckResponse {
    /// Whether an update is available.
    pub available: bool,
    /// New version (if available).
    pub version: Option<String>,
    /// Release notes markdown (if available).
    pub release_notes: Option<String>,
    /// Whether this update is mandatory (security fix).
    #[serde(default)]
    pub mandatory: bool,
    /// SHA-256 hash of the update package.
    pub sha256: Option<String>,
    /// Download URL for the update package.
    pub download_url: Option<String>,
    /// Package size in bytes.
    pub package_size: Option<u64>,
    /// Rollout group this agent belongs to.
    pub rollout_group: Option<String>,
    /// When the update was released.
    pub released_at: Option<DateTime<Utc>>,
    /// Minimum required version to update from.
    pub min_from_version: Option<String>,
}

/// Information about an available update.
#[derive(Debug, Clone)]
pub struct AvailableUpdate {
    /// Current version.
    pub current_version: Version,
    /// New version.
    pub new_version: Version,
    /// Whether this update is mandatory.
    pub mandatory: bool,
    /// Release notes.
    pub release_notes: Option<String>,
    /// SHA-256 hash of the package.
    pub sha256: String,
    /// Download URL.
    pub download_url: String,
    /// Package size in bytes.
    pub package_size: u64,
    /// Rollout group.
    pub rollout_group: RolloutGroup,
    /// Release timestamp.
    pub released_at: DateTime<Utc>,
}

/// Result of an update check operation.
#[derive(Debug, Clone)]
pub struct UpdateCheckResult {
    /// Whether an update is available.
    pub available: bool,
    /// Update details (if available).
    pub update: Option<AvailableUpdate>,
    /// Check timestamp.
    pub checked_at: DateTime<Utc>,
    /// Whether the update should be applied based on policy.
    pub should_apply: bool,
    /// Reason if update won't be applied.
    pub skip_reason: Option<String>,
}

/// Request payload for update check.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct UpdateCheckRequest {
    /// Current agent version.
    pub current_version: String,
    /// Operating system.
    pub os: String,
    /// Architecture.
    pub arch: String,
    /// Agent's rollout group assignment (if known).
    pub rollout_group: Option<String>,
}

/// Update state for tracking update progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateState {
    /// No update in progress.
    Idle,
    /// Checking for updates.
    Checking,
    /// Update available, waiting for policy approval.
    Pending,
    /// Downloading update package.
    Downloading,
    /// Verifying package integrity.
    Verifying,
    /// Installing update (shadow copy).
    Installing,
    /// Restarting service.
    Restarting,
    /// Update completed successfully.
    Completed,
    /// Update failed, may need rollback.
    Failed,
    /// Rolled back to previous version.
    RolledBack,
}

impl UpdateState {
    /// Convert to string.
    pub fn as_str(&self) -> &'static str {
        match self {
            UpdateState::Idle => "idle",
            UpdateState::Checking => "checking",
            UpdateState::Pending => "pending",
            UpdateState::Downloading => "downloading",
            UpdateState::Verifying => "verifying",
            UpdateState::Installing => "installing",
            UpdateState::Restarting => "restarting",
            UpdateState::Completed => "completed",
            UpdateState::Failed => "failed",
            UpdateState::RolledBack => "rolled_back",
        }
    }
}

/// Service for checking and managing agent updates.
pub struct UpdateService {
    client: Arc<AuthenticatedClient>,
    current_version: Version,
    policy: UpdatePolicy,
    rollout_group: RolloutGroup,
    /// Directory for staging updates.
    staging_dir: PathBuf,
    /// Deferred days (if policy is Deferred).
    deferred_days: u32,
}

impl UpdateService {
    /// Create a new update service.
    pub fn new(
        client: Arc<AuthenticatedClient>,
        current_version: &str,
        staging_dir: PathBuf,
    ) -> SyncResult<Self> {
        let version = Version::parse(current_version).map_err(|e| {
            SyncError::Config(format!("Invalid version '{}': {}", current_version, e))
        })?;

        Ok(Self {
            client,
            current_version: version,
            policy: UpdatePolicy::default(),
            rollout_group: RolloutGroup::default(),
            staging_dir,
            deferred_days: 7,
        })
    }

    /// Set the update policy.
    pub fn with_policy(mut self, policy: UpdatePolicy) -> Self {
        self.policy = policy;
        self
    }

    /// Set the rollout group.
    pub fn with_rollout_group(mut self, group: RolloutGroup) -> Self {
        self.rollout_group = group;
        self
    }

    /// Set deferred days (for Deferred policy).
    pub fn with_deferred_days(mut self, days: u32) -> Self {
        self.deferred_days = days;
        self
    }

    /// Get current version.
    pub fn current_version(&self) -> &Version {
        &self.current_version
    }

    /// Get current policy.
    pub fn policy(&self) -> UpdatePolicy {
        self.policy
    }

    /// Get rollout group.
    pub fn rollout_group(&self) -> RolloutGroup {
        self.rollout_group
    }

    /// Check for available updates.
    ///
    /// This method:
    /// 1. Queries the update endpoint with current version
    /// 2. Evaluates if update should be applied based on policy
    /// 3. Returns update information if available
    pub async fn check_for_updates(&self) -> SyncResult<UpdateCheckResult> {
        let agent_id = self.client.agent_id().await?;

        info!(
            "Checking for updates (current: {}, agent: {})",
            self.current_version, agent_id
        );

        // Build request
        let request = UpdateCheckRequest {
            current_version: self.current_version.to_string(),
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            rollout_group: Some(format!("{:?}", self.rollout_group).to_lowercase()),
        };

        // Query update endpoint
        let path = "/v1/updates/check";
        let response: UpdateCheckResponse = self.client.post_json(path, &request).await?;

        let checked_at = Utc::now();

        if !response.available {
            debug!("No updates available");
            return Ok(UpdateCheckResult {
                available: false,
                update: None,
                checked_at,
                should_apply: false,
                skip_reason: None,
            });
        }

        // Parse update information
        let new_version_str = response.version.as_ref().ok_or_else(|| {
            SyncError::Config("Update available but no version provided".to_string())
        })?;

        let new_version = Version::parse(new_version_str).map_err(|e| {
            SyncError::Config(format!("Invalid new version '{}': {}", new_version_str, e))
        })?;

        // Verify version is actually newer
        if new_version <= self.current_version {
            debug!(
                "Available version {} is not newer than current {}",
                new_version, self.current_version
            );
            return Ok(UpdateCheckResult {
                available: false,
                update: None,
                checked_at,
                should_apply: false,
                skip_reason: Some("Version is not newer".to_string()),
            });
        }

        // Check minimum from version requirement
        if let Some(ref min_from) = response.min_from_version {
            let min_from_version = Version::parse(min_from).map_err(|e| {
                SyncError::Config(format!("Invalid min_from_version '{}': {}", min_from, e))
            })?;

            if self.current_version < min_from_version {
                warn!(
                    "Update {} requires minimum version {}, current is {}",
                    new_version, min_from_version, self.current_version
                );
                return Ok(UpdateCheckResult {
                    available: true,
                    update: None,
                    checked_at,
                    should_apply: false,
                    skip_reason: Some(format!(
                        "Requires minimum version {}, current is {}",
                        min_from_version, self.current_version
                    )),
                });
            }
        }

        // Build update info
        let update = AvailableUpdate {
            current_version: self.current_version.clone(),
            new_version: new_version.clone(),
            mandatory: response.mandatory,
            release_notes: response.release_notes,
            sha256: response.sha256.unwrap_or_default(),
            download_url: response.download_url.unwrap_or_default(),
            package_size: response.package_size.unwrap_or(0),
            rollout_group: response
                .rollout_group
                .as_deref()
                .and_then(RolloutGroup::parse_str)
                .unwrap_or(self.rollout_group),
            released_at: response.released_at.unwrap_or_else(Utc::now),
        };

        // Evaluate policy
        let (should_apply, skip_reason) = self.evaluate_policy(&update);

        info!(
            "Update available: {} -> {} (mandatory: {}, should_apply: {})",
            self.current_version, new_version, update.mandatory, should_apply
        );

        Ok(UpdateCheckResult {
            available: true,
            update: Some(update),
            checked_at,
            should_apply,
            skip_reason,
        })
    }

    /// Evaluate update policy to determine if update should be applied.
    fn evaluate_policy(&self, update: &AvailableUpdate) -> (bool, Option<String>) {
        // Mandatory updates always apply
        if update.mandatory {
            return (true, None);
        }

        match self.policy {
            UpdatePolicy::Automatic => (true, None),
            UpdatePolicy::ManualApproval => (false, Some("Manual approval required".to_string())),
            UpdatePolicy::Deferred => {
                let defer_until =
                    update.released_at + chrono::Duration::days(self.deferred_days as i64);
                if Utc::now() >= defer_until {
                    (true, None)
                } else {
                    (
                        false,
                        Some(format!("Deferred until {}", defer_until.format("%Y-%m-%d"))),
                    )
                }
            }
            UpdatePolicy::Disabled => (false, Some("Updates are disabled".to_string())),
        }
    }

    /// Download update package to staging directory.
    pub async fn download_update(&self, update: &AvailableUpdate) -> SyncResult<PathBuf> {
        if update.download_url.is_empty() {
            return Err(SyncError::Config("No download URL provided".to_string()));
        }

        info!(
            "Downloading update {} ({} bytes)",
            update.new_version, update.package_size
        );

        // Ensure staging directory exists
        fs::create_dir_all(&self.staging_dir)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to create staging directory: {}", e)))?;

        // Download file
        let filename = format!(
            "sentinel-agent-{}-{}-{}.bin",
            update.new_version,
            std::env::consts::OS,
            std::env::consts::ARCH
        );
        let staging_path = self.staging_dir.join(&filename);

        let response = self.client.download(&update.download_url).await?;

        let mut file = fs::File::create(&staging_path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to create staging file: {}", e)))?;

        file.write_all(&response)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to write staging file: {}", e)))?;

        file.flush()
            .await
            .map_err(|e| SyncError::Config(format!("Failed to flush staging file: {}", e)))?;

        info!("Downloaded update to {:?}", staging_path);

        Ok(staging_path)
    }

    /// Verify downloaded package integrity.
    pub async fn verify_package(&self, path: &Path, expected_hash: &str) -> SyncResult<bool> {
        if expected_hash.is_empty() {
            error!("No expected hash provided, rejecting unverifiable package");
            return Ok(false);
        }

        info!("Verifying package integrity: {:?}", path);

        let data = fs::read(path)
            .await
            .map_err(|e| SyncError::Config(format!("Failed to read package: {}", e)))?;

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let hash = hasher.finalize();
        let computed_hash = hex::encode(hash);

        // Use constant-time comparison to prevent timing side-channel attacks
        let valid = {
            let a = computed_hash.to_lowercase();
            let b = expected_hash.to_lowercase();
            a.len() == b.len() && a.as_bytes().iter().zip(b.as_bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
        };

        if valid {
            info!("Package integrity verified (SHA-256: {})", computed_hash);
        } else {
            error!(
                "Package integrity check failed! Expected: {}, Got: {}",
                expected_hash, computed_hash
            );
        }

        Ok(valid)
    }

    /// Report update result to SaaS.
    pub async fn report_update_result(
        &self,
        new_version: &Version,
        state: UpdateState,
        error_message: Option<&str>,
    ) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?;

        #[derive(Serialize)]
        struct UpdateResultReport {
            agent_id: String,
            from_version: String,
            to_version: String,
            state: String,
            error: Option<String>,
            timestamp: DateTime<Utc>,
        }

        let report = UpdateResultReport {
            agent_id: agent_id.to_string(),
            from_version: self.current_version.to_string(),
            to_version: new_version.to_string(),
            state: state.as_str().to_string(),
            error: error_message.map(|s| s.to_string()),
            timestamp: Utc::now(),
        };

        let path = format!("/v1/agents/{}/updates/result", agent_id);
        self.client
            .post_json::<_, serde_json::Value>(&path, &report)
            .await?;

        info!(
            "Reported update result: {} -> {} (state: {})",
            self.current_version,
            new_version,
            state.as_str()
        );

        Ok(())
    }
}

/// Compare two semantic versions.
pub fn is_newer_version(current: &str, new: &str) -> bool {
    match (Version::parse(current), Version::parse(new)) {
        (Ok(curr), Ok(n)) => n > curr,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_policy_from_str() {
        assert_eq!(
            UpdatePolicy::parse_str("automatic"),
            Some(UpdatePolicy::Automatic)
        );
        assert_eq!(
            UpdatePolicy::parse_str("auto"),
            Some(UpdatePolicy::Automatic)
        );
        assert_eq!(
            UpdatePolicy::parse_str("manual"),
            Some(UpdatePolicy::ManualApproval)
        );
        assert_eq!(
            UpdatePolicy::parse_str("deferred"),
            Some(UpdatePolicy::Deferred)
        );
        assert_eq!(
            UpdatePolicy::parse_str("disabled"),
            Some(UpdatePolicy::Disabled)
        );
        assert_eq!(UpdatePolicy::parse_str("invalid"), None);
    }

    #[test]
    fn test_update_policy_as_str() {
        assert_eq!(UpdatePolicy::Automatic.as_str(), "automatic");
        assert_eq!(UpdatePolicy::ManualApproval.as_str(), "manual_approval");
        assert_eq!(UpdatePolicy::Deferred.as_str(), "deferred");
        assert_eq!(UpdatePolicy::Disabled.as_str(), "disabled");
    }

    #[test]
    fn test_rollout_group_percentage() {
        assert_eq!(RolloutGroup::Canary.percentage(), 1);
        assert_eq!(RolloutGroup::EarlyAdopter.percentage(), 10);
        assert_eq!(RolloutGroup::Majority.percentage(), 50);
        assert_eq!(RolloutGroup::GeneralAvailability.percentage(), 100);
    }

    #[test]
    fn test_rollout_group_from_str() {
        assert_eq!(
            RolloutGroup::parse_str("canary"),
            Some(RolloutGroup::Canary)
        );
        assert_eq!(
            RolloutGroup::parse_str("early_adopter"),
            Some(RolloutGroup::EarlyAdopter)
        );
        assert_eq!(
            RolloutGroup::parse_str("early"),
            Some(RolloutGroup::EarlyAdopter)
        );
        assert_eq!(
            RolloutGroup::parse_str("majority"),
            Some(RolloutGroup::Majority)
        );
        assert_eq!(
            RolloutGroup::parse_str("ga"),
            Some(RolloutGroup::GeneralAvailability)
        );
        assert_eq!(
            RolloutGroup::parse_str("all"),
            Some(RolloutGroup::GeneralAvailability)
        );
        assert_eq!(RolloutGroup::parse_str("invalid"), None);
    }

    #[test]
    fn test_update_state_as_str() {
        assert_eq!(UpdateState::Idle.as_str(), "idle");
        assert_eq!(UpdateState::Checking.as_str(), "checking");
        assert_eq!(UpdateState::Pending.as_str(), "pending");
        assert_eq!(UpdateState::Downloading.as_str(), "downloading");
        assert_eq!(UpdateState::Verifying.as_str(), "verifying");
        assert_eq!(UpdateState::Installing.as_str(), "installing");
        assert_eq!(UpdateState::Restarting.as_str(), "restarting");
        assert_eq!(UpdateState::Completed.as_str(), "completed");
        assert_eq!(UpdateState::Failed.as_str(), "failed");
        assert_eq!(UpdateState::RolledBack.as_str(), "rolled_back");
    }

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("1.0.0", "1.0.1"));
        assert!(is_newer_version("1.0.0", "1.1.0"));
        assert!(is_newer_version("1.0.0", "2.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("2.0.0", "1.0.0"));
        assert!(!is_newer_version("1.0.1", "1.0.0"));
    }

    #[test]
    fn test_is_newer_version_with_prerelease() {
        assert!(is_newer_version("1.0.0-alpha", "1.0.0"));
        assert!(is_newer_version("1.0.0-alpha", "1.0.0-beta"));
        assert!(!is_newer_version("1.0.0", "1.0.0-alpha"));
    }

    #[test]
    fn test_update_check_response_deserialization() {
        let json = r#"{
            "available": true,
            "version": "1.1.0",
            "release_notes": "Bug fixes and improvements",
            "mandatory": false,
            "sha256": "abc123def456",
            "download_url": "https://example.com/update.bin",
            "package_size": 1048576,
            "rollout_group": "canary"
        }"#;

        let response: UpdateCheckResponse = serde_json::from_str(json).unwrap();
        assert!(response.available);
        assert_eq!(response.version, Some("1.1.0".to_string()));
        assert!(!response.mandatory);
        assert_eq!(response.rollout_group, Some("canary".to_string()));
    }

    #[test]
    fn test_update_check_response_minimal() {
        let json = r#"{
            "available": false
        }"#;

        let response: UpdateCheckResponse = serde_json::from_str(json).unwrap();
        assert!(!response.available);
        assert!(response.version.is_none());
        assert!(!response.mandatory);
    }

    #[test]
    fn test_update_check_request_serialization() {
        let request = UpdateCheckRequest {
            current_version: "1.0.0".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            rollout_group: Some("canary".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("current_version"));
        assert!(json.contains("1.0.0"));
        assert!(json.contains("rollout_group"));
    }

    #[test]
    fn test_default_update_check_interval() {
        assert_eq!(DEFAULT_UPDATE_CHECK_INTERVAL_SECS, 4 * 60 * 60);
    }

    #[test]
    fn test_available_update_clone() {
        let update = AvailableUpdate {
            current_version: Version::new(1, 0, 0),
            new_version: Version::new(1, 1, 0),
            mandatory: true,
            release_notes: Some("Notes".to_string()),
            sha256: "hash".to_string(),
            download_url: "https://example.com".to_string(),
            package_size: 1000,
            rollout_group: RolloutGroup::Canary,
            released_at: Utc::now(),
        };

        let cloned = update.clone();
        assert_eq!(cloned.new_version, update.new_version);
        assert_eq!(cloned.mandatory, update.mandatory);
    }
}
