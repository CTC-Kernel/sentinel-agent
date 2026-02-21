//! Configuration synchronization service for downloading config from SaaS.
//!
//! This module provides:
//! - Downloading agent configuration from the SaaS API
//! - Merge strategy preserving local overrides
//! - Hot reload support via callbacks

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use agent_storage::{ConfigRepository, Database};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::watch;
use tracing::{debug, info, warn};

/// API response for configuration download.
///
/// The Cloud Function returns a flat JSON object with config keys at the top level
/// (e.g. `check_interval_secs`, `rules`, `config_version`).
/// We use `#[serde(flatten)]` to capture all fields into the config map.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ConfigResponse {
    /// Configuration key-value pairs (flattened from the top-level response).
    #[serde(flatten)]
    pub config: HashMap<String, serde_json::Value>,
}

/// Result of a configuration sync operation.
#[derive(Debug, Clone)]
pub struct ConfigSyncResult {
    /// Number of config entries added.
    pub added: usize,
    /// Number of config entries updated.
    pub updated: usize,
    /// Number of entries skipped (local overrides).
    pub skipped: usize,
    /// Keys that were skipped due to local overrides.
    pub skipped_keys: Vec<String>,
    /// Configuration version from server.
    pub version: Option<String>,
    /// Timestamp of sync.
    pub synced_at: DateTime<Utc>,
    /// Whether config actually changed.
    pub changed: bool,
}

/// Configuration change event.
#[derive(Debug, Clone)]
pub struct ConfigChangeEvent {
    /// Keys that changed.
    pub changed_keys: Vec<String>,
    /// Timestamp of change.
    pub timestamp: DateTime<Utc>,
}

/// Service for synchronizing agent configuration with SaaS.
pub struct ConfigSyncService {
    client: Arc<AuthenticatedClient>,
    db: Arc<Database>,
    /// Channel for notifying about config changes.
    change_sender: watch::Sender<Option<ConfigChangeEvent>>,
    /// Receiver for config change notifications.
    change_receiver: watch::Receiver<Option<ConfigChangeEvent>>,
}

impl ConfigSyncService {
    /// Create a new config sync service.
    pub fn new(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        let (change_sender, change_receiver) = watch::channel(None);
        Self {
            client,
            db,
            change_sender,
            change_receiver,
        }
    }

    /// Get a receiver for config change notifications.
    pub fn subscribe(&self) -> watch::Receiver<Option<ConfigChangeEvent>> {
        self.change_receiver.clone()
    }

    /// Sync configuration from SaaS.
    ///
    /// This method:
    /// 1. Downloads config from the server
    /// 2. Merges with local config (preserving local overrides)
    /// 3. Notifies subscribers of changes
    pub async fn sync_config(&self) -> SyncResult<ConfigSyncResult> {
        let repo = ConfigRepository::new(&self.db);
        let agent_id = self.client.agent_id().await?;

        info!("Starting config sync for agent {}", agent_id);

        // Get previous config for change detection
        let previous_config = repo.get_all_map().await?;

        // Download config from server
        let path = format!("/v1/agents/{}/config", agent_id);
        let response: ConfigResponse = self.client.get(&path).await?;

        // Extract version from the flat response (server sends config_version)
        let version = response.config.get("config_version").and_then(|v| {
            v.as_u64()
                .map(|n| n.to_string())
                .or_else(|| v.as_str().map(String::from))
        });

        debug!("Downloaded config from server (version: {:?})", version);

        // Convert JSON values to strings for storage
        let remote_config: HashMap<String, String> = response
            .config
            .into_iter()
            .map(|(k, v)| (k, serde_json::to_string(&v).unwrap_or_default()))
            .collect();

        // Merge with local config
        let merge_result = repo.merge_remote_config(remote_config).await?;

        // Get new config for change detection
        let new_config = repo.get_all_map().await?;

        // Detect changed keys
        let changed_keys: Vec<String> = new_config
            .iter()
            .filter(|(k, v)| previous_config.get(*k) != Some(v))
            .map(|(k, _)| k.clone())
            .collect();

        let changed = !changed_keys.is_empty();

        // Notify subscribers if config changed
        if changed {
            let event = ConfigChangeEvent {
                changed_keys: changed_keys.clone(),
                timestamp: Utc::now(),
            };

            if self.change_sender.send(Some(event)).is_err() {
                warn!("No subscribers for config change notification");
            }

            info!(
                "Config synced with {} changes: {:?}",
                changed_keys.len(),
                changed_keys
            );
        } else {
            debug!("Config synced, no changes detected");
        }

        Ok(ConfigSyncResult {
            added: merge_result.added,
            updated: merge_result.updated,
            skipped: merge_result.skipped,
            skipped_keys: merge_result.skipped_keys,
            version,
            synced_at: Utc::now(),
            changed,
        })
    }

    /// Force a full config sync, removing all remote config first.
    pub async fn force_sync(&self) -> SyncResult<ConfigSyncResult> {
        let repo = ConfigRepository::new(&self.db);

        info!("Force syncing config (removing old remote config)");

        // Delete all remote config first
        repo.delete_remote_config().await?;

        // Then sync
        self.sync_config().await
    }

    /// Get a specific configuration value.
    pub async fn get_config<T: for<'de> Deserialize<'de>>(
        &self,
        key: &str,
    ) -> SyncResult<Option<T>> {
        let repo = ConfigRepository::new(&self.db);
        Ok(repo.get_typed(key).await?)
    }

    /// Get a configuration value with default.
    pub async fn get_config_or_default<T: for<'de> Deserialize<'de> + Default>(
        &self,
        key: &str,
    ) -> SyncResult<T> {
        let repo = ConfigRepository::new(&self.db);
        Ok(repo.get_or_default(key).await?)
    }

    /// Set a local configuration override.
    pub async fn set_local_override(&self, key: &str, value: &str) -> SyncResult<()> {
        let repo = ConfigRepository::new(&self.db);
        repo.set(key, value).await?;
        Ok(())
    }

    /// Remove a local override (allows remote value to take effect).
    pub async fn remove_local_override(&self, key: &str) -> SyncResult<bool> {
        let repo = ConfigRepository::new(&self.db);

        // Only delete if it's a local override
        if repo.has_local_override(key).await? {
            repo.delete(key).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get all configuration as a map.
    pub async fn get_all_config(&self) -> SyncResult<HashMap<String, String>> {
        let repo = ConfigRepository::new(&self.db);
        Ok(repo.get_all_map().await?)
    }

    /// Get list of local overrides.
    pub async fn get_local_overrides(&self) -> SyncResult<Vec<String>> {
        let repo = ConfigRepository::new(&self.db);
        let overrides = repo.get_local_overrides().await?;
        Ok(overrides.into_iter().map(|e| e.key).collect())
    }

    /// Check if a specific key has a local override.
    pub async fn has_local_override(&self, key: &str) -> SyncResult<bool> {
        let repo = ConfigRepository::new(&self.db);
        Ok(repo.has_local_override(key).await?)
    }
}

/// Standard configuration keys used by the agent.
pub mod config_keys {
    /// Check execution interval in seconds.
    pub const CHECK_INTERVAL_SECS: &str = "check_interval_secs";
    /// Heartbeat interval in seconds.
    pub const HEARTBEAT_INTERVAL_SECS: &str = "heartbeat_interval_secs";
    /// List of enabled check IDs.
    pub const ENABLED_CHECKS: &str = "enabled_checks";
    /// Log level (debug, info, warn, error).
    pub const LOG_LEVEL: &str = "log_level";
    /// Maximum CPU usage percentage.
    pub const MAX_CPU_PERCENT: &str = "max_cpu_percent";
    /// Maximum memory usage in bytes.
    pub const MAX_MEMORY_BYTES: &str = "max_memory_bytes";
    /// List of active compliance frameworks.
    pub const ACTIVE_FRAMEWORKS: &str = "active_frameworks";
    /// Sync retry interval in seconds.
    pub const SYNC_RETRY_INTERVAL_SECS: &str = "sync_retry_interval_secs";
    /// Maximum sync queue size.
    pub const MAX_SYNC_QUEUE_SIZE: &str = "max_sync_queue_size";
    /// FIM configuration key.
    pub const FIM_CONFIG: &str = "fim_config";
    /// SIEM configuration key.
    pub const SIEM_CONFIG: &str = "siem_config";
    /// USB policy configuration key.
    pub const USB_POLICY: &str = "usb_policy";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_response_deserialization() {
        // Server returns flat config (matching Cloud Function format)
        let json = r#"{
            "config_version": 1,
            "check_interval_secs": 3600,
            "heartbeat_interval_secs": 300,
            "enabled_checks": ["disk_encryption", "antivirus"],
            "log_level": "info",
            "rules_version": 1,
            "rules": []
        }"#;

        let response: ConfigResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.config.len(), 7);

        let interval = response.config.get("check_interval_secs").unwrap();
        assert_eq!(interval.as_i64(), Some(3600));

        let version = response.config.get("config_version").unwrap();
        assert_eq!(version.as_u64(), Some(1));
    }

    #[test]
    fn test_config_response_minimal() {
        let json = r#"{}"#;

        let response: ConfigResponse = serde_json::from_str(json).unwrap();
        assert!(response.config.is_empty());
    }

    #[test]
    fn test_config_sync_result() {
        let result = ConfigSyncResult {
            added: 3,
            updated: 2,
            skipped: 1,
            skipped_keys: vec!["local_key".to_string()],
            version: Some("1.0".to_string()),
            synced_at: Utc::now(),
            changed: true,
        };

        assert!(result.changed);
        assert_eq!(result.added + result.updated, 5);
    }

    #[test]
    fn test_config_change_event() {
        let event = ConfigChangeEvent {
            changed_keys: vec!["key1".to_string(), "key2".to_string()],
            timestamp: Utc::now(),
        };

        assert_eq!(event.changed_keys.len(), 2);
    }

    #[test]
    fn test_config_keys_constants() {
        assert_eq!(config_keys::CHECK_INTERVAL_SECS, "check_interval_secs");
        assert_eq!(
            config_keys::HEARTBEAT_INTERVAL_SECS,
            "heartbeat_interval_secs"
        );
        assert_eq!(config_keys::ENABLED_CHECKS, "enabled_checks");
        assert_eq!(config_keys::LOG_LEVEL, "log_level");
    }

    #[test]
    fn test_json_value_to_string_conversion() {
        let config: HashMap<String, serde_json::Value> = serde_json::from_str(
            r#"{
                "int_val": 42,
                "str_val": "hello",
                "arr_val": [1, 2, 3],
                "bool_val": true
            }"#,
        )
        .unwrap();

        let string_config: HashMap<String, String> = config
            .into_iter()
            .map(|(k, v)| (k, serde_json::to_string(&v).unwrap_or_default()))
            .collect();

        assert_eq!(string_config.get("int_val"), Some(&"42".to_string()));
        assert_eq!(string_config.get("str_val"), Some(&"\"hello\"".to_string()));
        assert_eq!(string_config.get("arr_val"), Some(&"[1,2,3]".to_string()));
        assert_eq!(string_config.get("bool_val"), Some(&"true".to_string()));
    }
}
