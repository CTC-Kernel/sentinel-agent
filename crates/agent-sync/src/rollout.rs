//! Staged rollout and version management.
//!
//! This module provides:
//! - Staged rollout deployment (1% -> 10% -> 50% -> 100%)
//! - Version blocking for faulty releases
//! - Manual update triggering
//! - Update policy synchronization

use crate::authenticated_client::AuthenticatedClient;
use crate::error::{SyncError, SyncResult};
use crate::update::{RolloutGroup, UpdatePolicy};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Rollout status from SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RolloutStatus {
    /// Version being rolled out.
    pub version: String,
    /// Current rollout percentage.
    pub percentage: u8,
    /// Current rollout group.
    pub current_group: String,
    /// Whether rollout is paused.
    #[serde(default)]
    pub paused: bool,
    /// Failure rate threshold.
    #[serde(default)]
    pub failure_rate_threshold: f32,
    /// Current failure rate.
    #[serde(default)]
    pub current_failure_rate: f32,
    /// Started at timestamp.
    pub started_at: Option<DateTime<Utc>>,
}

/// Agent's rollout assignment from SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RolloutAssignment {
    /// Agent's rollout group.
    pub group: String,
    /// Percentage within group (for sub-group targeting).
    pub percentage_rank: u8,
    /// Whether eligible for current rollout.
    pub eligible: bool,
    /// Assigned at timestamp.
    pub assigned_at: DateTime<Utc>,
}

/// Blocked version information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BlockedVersion {
    /// Blocked version string.
    pub version: String,
    /// Reason for blocking.
    pub reason: String,
    /// Who blocked it.
    pub blocked_by: String,
    /// When it was blocked.
    pub blocked_at: DateTime<Utc>,
}

/// Update policy configuration from SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PolicyConfig {
    /// Update policy.
    pub policy: String,
    /// Deferred days (if policy is Deferred).
    #[serde(default)]
    pub deferred_days: u32,
    /// Maintenance window start hour (0-23).
    #[serde(default)]
    pub maintenance_window_start: Option<u8>,
    /// Maintenance window end hour (0-23).
    #[serde(default)]
    pub maintenance_window_end: Option<u8>,
    /// Days of week for updates (0=Sun, 6=Sat).
    #[serde(default)]
    pub maintenance_days: Vec<u8>,
}

impl PolicyConfig {
    /// Convert to UpdatePolicy enum.
    pub fn to_update_policy(&self) -> UpdatePolicy {
        UpdatePolicy::from_str(&self.policy).unwrap_or_default()
    }

    /// Check if current time is within maintenance window.
    pub fn is_maintenance_window(&self) -> bool {
        let now = Utc::now();
        let hour = now.hour() as u8;
        let weekday = now.weekday().num_days_from_sunday() as u8;

        // Check day of week
        if !self.maintenance_days.is_empty() && !self.maintenance_days.contains(&weekday) {
            return false;
        }

        // Check hour window
        match (self.maintenance_window_start, self.maintenance_window_end) {
            (Some(start), Some(end)) => {
                if start <= end {
                    hour >= start && hour < end
                } else {
                    // Window crosses midnight
                    hour >= start || hour < end
                }
            }
            _ => true, // No window configured means always allowed
        }
    }
}

/// Manual update command from SaaS.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ManualUpdateCommand {
    /// Command ID for tracking.
    pub command_id: String,
    /// Target version to update to.
    pub target_version: String,
    /// Whether to bypass policy.
    #[serde(default)]
    pub bypass_policy: bool,
    /// Issued by administrator.
    pub issued_by: String,
    /// When command was issued.
    pub issued_at: DateTime<Utc>,
}

/// Emergency rollback command from SaaS (M2 fix).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EmergencyRollbackCommand {
    /// Command ID for tracking.
    pub command_id: String,
    /// Affected version to rollback from.
    pub affected_version: String,
    /// Reason for emergency rollback.
    pub reason: String,
    /// Who issued the command.
    pub issued_by: String,
    /// When command was issued.
    pub issued_at: DateTime<Utc>,
}

/// Service for managing rollout and version policies.
pub struct RolloutService {
    client: Arc<AuthenticatedClient>,
    /// Current rollout assignment.
    assignment: RwLock<Option<RolloutAssignment>>,
    /// Blocked versions cache.
    blocked_versions: RwLock<HashSet<String>>,
    /// Current policy configuration.
    policy_config: RwLock<Option<PolicyConfig>>,
    /// Pending manual update command.
    pending_command: RwLock<Option<ManualUpdateCommand>>,
    /// Pending emergency rollback command (M2).
    emergency_rollback: RwLock<Option<EmergencyRollbackCommand>>,
    /// Current agent version for checking if blocked (M3).
    current_version: RwLock<Option<String>>,
}

impl RolloutService {
    /// Create a new rollout service.
    pub fn new(client: Arc<AuthenticatedClient>) -> Self {
        Self {
            client,
            assignment: RwLock::new(None),
            blocked_versions: RwLock::new(HashSet::new()),
            policy_config: RwLock::new(None),
            pending_command: RwLock::new(None),
            emergency_rollback: RwLock::new(None),
            current_version: RwLock::new(None),
        }
    }

    /// Set the current agent version for blocking checks (M3 fix).
    pub async fn set_current_version(&self, version: &str) {
        *self.current_version.write().await = Some(version.to_string());
    }

    /// Fetch rollout assignment from SaaS.
    pub async fn fetch_assignment(&self) -> SyncResult<RolloutAssignment> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/rollout/assignment", agent_id);

        let assignment: RolloutAssignment = self.client.get(&path).await?;

        debug!(
            "Fetched rollout assignment: group={}, eligible={}",
            assignment.group, assignment.eligible
        );

        *self.assignment.write().await = Some(assignment.clone());
        Ok(assignment)
    }

    /// Get cached rollout assignment.
    pub async fn assignment(&self) -> Option<RolloutAssignment> {
        self.assignment.read().await.clone()
    }

    /// Get rollout group from assignment.
    pub async fn rollout_group(&self) -> RolloutGroup {
        self.assignment
            .read()
            .await
            .as_ref()
            .and_then(|a| RolloutGroup::from_str(&a.group))
            .unwrap_or_default()
    }

    /// Check if agent is eligible for current rollout.
    pub async fn is_eligible_for_update(&self, version: &str) -> SyncResult<bool> {
        // Check blocked versions first
        if self.is_version_blocked(version).await {
            warn!("Version {} is blocked", version);
            return Ok(false);
        }

        // Get current assignment
        let assignment = match self.assignment.read().await.as_ref() {
            Some(a) => a.clone(),
            None => self.fetch_assignment().await?,
        };

        Ok(assignment.eligible)
    }

    /// Fetch blocked versions from SaaS.
    pub async fn fetch_blocked_versions(&self) -> SyncResult<Vec<BlockedVersion>> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/versions/blocked", agent_id);

        #[derive(Deserialize)]
        struct BlockedVersionsResponse {
            versions: Vec<BlockedVersion>,
        }

        let response: BlockedVersionsResponse = self.client.get(&path).await?;

        // Update cache
        let blocked_set: HashSet<String> = response
            .versions
            .iter()
            .map(|v| v.version.clone())
            .collect();

        *self.blocked_versions.write().await = blocked_set;

        info!("Fetched {} blocked versions", response.versions.len());

        Ok(response.versions)
    }

    /// Check if a version is blocked.
    pub async fn is_version_blocked(&self, version: &str) -> bool {
        self.blocked_versions.read().await.contains(version)
    }

    /// Fetch policy configuration from SaaS.
    pub async fn fetch_policy_config(&self) -> SyncResult<PolicyConfig> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/update-policy", agent_id);

        let config: PolicyConfig = self.client.get(&path).await?;

        debug!(
            "Fetched policy config: policy={}, deferred_days={}",
            config.policy, config.deferred_days
        );

        *self.policy_config.write().await = Some(config.clone());
        Ok(config)
    }

    /// Get cached policy configuration.
    pub async fn policy_config(&self) -> Option<PolicyConfig> {
        self.policy_config.read().await.clone()
    }

    /// Get update policy from cached configuration.
    pub async fn update_policy(&self) -> UpdatePolicy {
        self.policy_config
            .read()
            .await
            .as_ref()
            .map(|c| c.to_update_policy())
            .unwrap_or_default()
    }

    /// Check for pending manual update command.
    pub async fn check_pending_command(&self) -> SyncResult<Option<ManualUpdateCommand>> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/update-command", agent_id);

        // This endpoint returns 404 if no command pending, or the command
        match self.client.get::<ManualUpdateCommand>(&path).await {
            Ok(command) => {
                info!(
                    "Received manual update command: {} -> {}",
                    command.command_id, command.target_version
                );
                *self.pending_command.write().await = Some(command.clone());
                Ok(Some(command))
            }
            Err(SyncError::ServerError { status: 404, .. }) => {
                *self.pending_command.write().await = None;
                Ok(None)
            }
            Err(e) => Err(e),
        }
    }

    /// Acknowledge a manual update command.
    pub async fn acknowledge_command(&self, command_id: &str, success: bool, error: Option<&str>) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?;

        #[derive(Serialize)]
        struct AckRequest {
            command_id: String,
            success: bool,
            error: Option<String>,
            timestamp: DateTime<Utc>,
        }

        let request = AckRequest {
            command_id: command_id.to_string(),
            success,
            error: error.map(|s| s.to_string()),
            timestamp: Utc::now(),
        };

        let path = format!("/v1/agents/{}/update-command/ack", agent_id);
        self.client.post_json::<_, serde_json::Value>(&path, &request).await?;

        // Clear pending command
        *self.pending_command.write().await = None;

        info!(
            "Acknowledged update command {}: success={}",
            command_id, success
        );

        Ok(())
    }

    /// Get pending manual update command.
    pub async fn pending_command(&self) -> Option<ManualUpdateCommand> {
        self.pending_command.read().await.clone()
    }

    /// Check if update is allowed based on policy and maintenance window.
    pub async fn is_update_allowed(&self) -> bool {
        if let Some(config) = self.policy_config.read().await.as_ref() {
            // Check if disabled
            if config.to_update_policy() == UpdatePolicy::Disabled {
                return false;
            }

            // Check maintenance window
            if !config.is_maintenance_window() {
                debug!("Outside maintenance window");
                return false;
            }
        }

        true
    }

    /// Check if the current running version is blocked (M3 fix - AC3 of Story 10.7).
    ///
    /// If the agent is running a blocked version, it should be prompted to update.
    pub async fn is_current_version_blocked(&self) -> bool {
        let current = self.current_version.read().await;
        if let Some(ref version) = *current {
            let blocked = self.blocked_versions.read().await.contains(version);
            if blocked {
                warn!(
                    "ALERT: Agent is running blocked version {}! Update required.",
                    version
                );
            }
            blocked
        } else {
            false
        }
    }

    /// Check for emergency rollback command (M2 fix - AC4 of Story 10.4).
    ///
    /// Emergency rollback affects all agents running the affected version.
    pub async fn check_emergency_rollback(&self) -> SyncResult<Option<EmergencyRollbackCommand>> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/emergency-rollback", agent_id);

        match self.client.get::<EmergencyRollbackCommand>(&path).await {
            Ok(command) => {
                warn!(
                    "EMERGENCY ROLLBACK received: {} -> affected version {} (reason: {})",
                    command.command_id, command.affected_version, command.reason
                );
                *self.emergency_rollback.write().await = Some(command.clone());
                Ok(Some(command))
            }
            Err(SyncError::ServerError { status: 404, .. }) => {
                *self.emergency_rollback.write().await = None;
                Ok(None)
            }
            Err(e) => Err(e),
        }
    }

    /// Get pending emergency rollback command.
    pub async fn emergency_rollback(&self) -> Option<EmergencyRollbackCommand> {
        self.emergency_rollback.read().await.clone()
    }

    /// Acknowledge emergency rollback command.
    pub async fn acknowledge_emergency_rollback(
        &self,
        command_id: &str,
        success: bool,
        error: Option<&str>,
    ) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?;

        #[derive(Serialize)]
        struct AckRequest {
            command_id: String,
            success: bool,
            error: Option<String>,
            rolled_back_to: Option<String>,
            timestamp: DateTime<Utc>,
        }

        let request = AckRequest {
            command_id: command_id.to_string(),
            success,
            error: error.map(|s| s.to_string()),
            rolled_back_to: if success {
                self.current_version.read().await.clone()
            } else {
                None
            },
            timestamp: Utc::now(),
        };

        let path = format!("/v1/agents/{}/emergency-rollback/ack", agent_id);
        self.client.post_json::<_, serde_json::Value>(&path, &request).await?;

        // Clear pending command
        *self.emergency_rollback.write().await = None;

        info!(
            "Acknowledged emergency rollback {}: success={}",
            command_id, success
        );

        Ok(())
    }

    /// Check if emergency rollback applies to current version.
    pub async fn should_emergency_rollback(&self, current_version: &str) -> bool {
        if let Some(ref cmd) = *self.emergency_rollback.read().await {
            if cmd.affected_version == current_version {
                warn!(
                    "Current version {} is affected by emergency rollback: {}",
                    current_version, cmd.reason
                );
                return true;
            }
        }
        false
    }

    /// Sync all rollout information from SaaS.
    pub async fn sync(&self) -> SyncResult<()> {
        // Fetch in parallel would be better, but sequential for simplicity
        self.fetch_assignment().await?;
        self.fetch_blocked_versions().await?;
        self.fetch_policy_config().await?;
        self.check_pending_command().await?;
        self.check_emergency_rollback().await?;

        // Check if current version is blocked (M3)
        if self.is_current_version_blocked().await {
            warn!("Agent is running a blocked version - update required!");
        }

        info!("Rollout information synced");
        Ok(())
    }
}

// Import Datelike trait for weekday()
use chrono::Datelike;
use chrono::Timelike;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rollout_status_deserialization() {
        let json = r#"{
            "version": "1.2.0",
            "percentage": 10,
            "current_group": "early_adopter",
            "paused": false,
            "failure_rate_threshold": 5.0,
            "current_failure_rate": 0.5
        }"#;

        let status: RolloutStatus = serde_json::from_str(json).unwrap();
        assert_eq!(status.version, "1.2.0");
        assert_eq!(status.percentage, 10);
        assert!(!status.paused);
    }

    #[test]
    fn test_rollout_assignment_deserialization() {
        let json = r#"{
            "group": "canary",
            "percentage_rank": 50,
            "eligible": true,
            "assigned_at": "2026-01-23T12:00:00Z"
        }"#;

        let assignment: RolloutAssignment = serde_json::from_str(json).unwrap();
        assert_eq!(assignment.group, "canary");
        assert!(assignment.eligible);
    }

    #[test]
    fn test_blocked_version_serialization() {
        let blocked = BlockedVersion {
            version: "1.1.0".to_string(),
            reason: "Critical bug".to_string(),
            blocked_by: "admin@example.com".to_string(),
            blocked_at: Utc::now(),
        };

        let json = serde_json::to_string(&blocked).unwrap();
        assert!(json.contains("1.1.0"));
        assert!(json.contains("Critical bug"));
    }

    #[test]
    fn test_policy_config_deserialization() {
        let json = r#"{
            "policy": "automatic",
            "deferred_days": 7,
            "maintenance_window_start": 2,
            "maintenance_window_end": 6,
            "maintenance_days": [0, 6]
        }"#;

        let config: PolicyConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.policy, "automatic");
        assert_eq!(config.deferred_days, 7);
        assert_eq!(config.to_update_policy(), UpdatePolicy::Automatic);
    }

    #[test]
    fn test_policy_config_to_update_policy() {
        let config = PolicyConfig {
            policy: "manual_approval".to_string(),
            deferred_days: 0,
            maintenance_window_start: None,
            maintenance_window_end: None,
            maintenance_days: vec![],
        };

        assert_eq!(config.to_update_policy(), UpdatePolicy::ManualApproval);
    }

    #[test]
    fn test_manual_update_command_deserialization() {
        let json = r#"{
            "command_id": "cmd-123",
            "target_version": "1.3.0",
            "bypass_policy": true,
            "issued_by": "admin@example.com",
            "issued_at": "2026-01-23T15:30:00Z"
        }"#;

        let command: ManualUpdateCommand = serde_json::from_str(json).unwrap();
        assert_eq!(command.command_id, "cmd-123");
        assert_eq!(command.target_version, "1.3.0");
        assert!(command.bypass_policy);
    }

    #[test]
    fn test_maintenance_window_no_config() {
        let config = PolicyConfig {
            policy: "automatic".to_string(),
            deferred_days: 0,
            maintenance_window_start: None,
            maintenance_window_end: None,
            maintenance_days: vec![],
        };

        // No window configured means always allowed
        assert!(config.is_maintenance_window());
    }

    #[test]
    fn test_blocked_version_hash_set() {
        let mut blocked = HashSet::new();
        blocked.insert("1.0.0".to_string());
        blocked.insert("1.0.1".to_string());

        assert!(blocked.contains("1.0.0"));
        assert!(!blocked.contains("1.0.2"));
    }

    #[test]
    fn test_emergency_rollback_command_deserialization() {
        let json = r#"{
            "command_id": "emerg-456",
            "affected_version": "1.2.0",
            "reason": "Critical security vulnerability",
            "issued_by": "security@example.com",
            "issued_at": "2026-01-23T16:00:00Z"
        }"#;

        let command: EmergencyRollbackCommand = serde_json::from_str(json).unwrap();
        assert_eq!(command.command_id, "emerg-456");
        assert_eq!(command.affected_version, "1.2.0");
        assert_eq!(command.reason, "Critical security vulnerability");
    }
}
