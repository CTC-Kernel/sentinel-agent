//! Rule synchronization service for downloading check rules from SaaS.
//!
//! This module provides:
//! - Downloading check rules from the SaaS API
//! - ETag-based delta sync for efficiency
//! - 7-day cache validity with graceful fallback
//! - Batch upsert for rule updates

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use agent_storage::{CheckRule, CheckRulesRepository, Database, Severity};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

/// API response for check rules download.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RulesResponse {
    /// List of check rules.
    pub rules: Vec<ApiCheckRule>,
    /// ETag for delta sync.
    pub etag: Option<String>,
    /// Total number of rules.
    pub total_count: i64,
}

/// Check rule from API response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApiCheckRule {
    /// Unique rule identifier.
    pub id: String,
    /// Human-readable rule name.
    pub name: String,
    /// Optional description.
    #[serde(default)]
    pub description: Option<String>,
    /// Rule category.
    pub category: String,
    /// Severity level.
    pub severity: String,
    /// Whether the rule is enabled.
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Check type identifier.
    pub check_type: String,
    /// Check-specific parameters.
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
    /// Regulatory frameworks.
    #[serde(default)]
    pub frameworks: Vec<String>,
    /// Rule version.
    pub version: String,
    /// Creation timestamp.
    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    #[serde(default = "Utc::now")]
    pub updated_at: DateTime<Utc>,
    /// Command to execute for this check.
    #[serde(default)]
    pub check_command: Option<String>,
    /// Expected result of the check command.
    #[serde(default)]
    pub expected_result: Option<String>,
    /// Remediation instructions if the check fails.
    #[serde(default)]
    pub remediation: Option<String>,
    /// Platforms this rule applies to.
    #[serde(default)]
    pub platforms: Option<Vec<String>>,
    /// Associated control identifier.
    #[serde(default)]
    pub control_id: Option<String>,
}

fn default_enabled() -> bool {
    true
}

impl From<ApiCheckRule> for CheckRule {
    fn from(api: ApiCheckRule) -> Self {
        let severity = Severity::parse_str(&api.severity).unwrap_or_else(|| {
            tracing::warn!(
                "Unknown API check rule severity '{}', falling back to Medium",
                api.severity
            );
            Severity::Medium
        });

        CheckRule {
            id: api.id,
            name: api.name,
            description: api.description,
            category: api.category,
            severity,
            enabled: api.enabled,
            check_type: api.check_type,
            parameters: api.parameters,
            frameworks: api.frameworks,
            version: api.version,
            created_at: api.created_at,
            updated_at: api.updated_at,
            check_command: api.check_command,
            expected_result: api.expected_result,
            remediation: api.remediation,
            platforms: api.platforms,
            control_id: api.control_id,
        }
    }
}

/// Result of a rule sync operation.
#[derive(Debug, Clone)]
pub struct RuleSyncResult {
    /// Number of rules synced.
    pub rules_synced: usize,
    /// Whether the cache was used (304 Not Modified).
    pub cache_hit: bool,
    /// New ETag if rules were downloaded.
    pub new_etag: Option<String>,
    /// Timestamp of sync.
    pub synced_at: DateTime<Utc>,
    /// Any warning messages.
    pub warnings: Vec<String>,
}

/// Service for synchronizing check rules with SaaS.
pub struct RuleSyncService {
    client: Arc<AuthenticatedClient>,
    db: Arc<Database>,
}

impl RuleSyncService {
    /// Create a new rule sync service.
    pub fn new(client: Arc<AuthenticatedClient>, db: Arc<Database>) -> Self {
        Self { client, db }
    }

    /// Sync rules from SaaS with ETag-based delta sync.
    ///
    /// This method:
    /// 1. Checks if current ETag matches (304 Not Modified)
    /// 2. Downloads rules if changed
    /// 3. Upserts rules to local database
    /// 4. Updates cache metadata
    /// 5. Falls back to cached rules on failure
    pub async fn sync_rules(&self) -> SyncResult<RuleSyncResult> {
        let repo = CheckRulesRepository::new(&self.db);
        let agent_id = self.client.agent_id().await?;

        info!("Starting rule sync for agent {}", agent_id);

        // Get current cache metadata for ETag
        let cache_metadata = repo.get_cache_metadata().await?;
        let current_etag = cache_metadata.etag.clone();

        // Build request path
        let path = format!("/v1/agents/{}/rules", agent_id);

        // Try to download rules
        match self.download_rules(&path, current_etag.as_deref()).await {
            Ok(Some((response, new_etag))) => {
                // Rules changed, upsert them
                let rules: Vec<CheckRule> =
                    response.rules.into_iter().map(CheckRule::from).collect();

                let count = repo.upsert_batch(&rules).await?;
                repo.update_cache_metadata(new_etag.as_deref()).await?;

                info!(
                    "Synced {} rules from SaaS (new etag: {:?})",
                    count, new_etag
                );

                Ok(RuleSyncResult {
                    rules_synced: count,
                    cache_hit: false,
                    new_etag,
                    synced_at: Utc::now(),
                    warnings: Vec::new(),
                })
            }
            Ok(None) => {
                // 304 Not Modified - cache is still valid
                repo.update_cache_metadata(current_etag.as_deref()).await?;

                debug!("Rules cache is up to date (304 Not Modified)");

                Ok(RuleSyncResult {
                    rules_synced: 0,
                    cache_hit: true,
                    new_etag: current_etag,
                    synced_at: Utc::now(),
                    warnings: Vec::new(),
                })
            }
            Err(e) => {
                // Download failed, check if we can use cache
                if repo.is_cache_valid().await? {
                    warn!("Rule download failed, using cached rules: {}", e);

                    Ok(RuleSyncResult {
                        rules_synced: 0,
                        cache_hit: true,
                        new_etag: current_etag,
                        synced_at: Utc::now(),
                        warnings: vec![format!("Download failed, using cache: {}", e)],
                    })
                } else {
                    error!("Rule download failed and no valid cache available: {}", e);
                    Err(e)
                }
            }
        }
    }

    /// Download rules from the API with optional ETag.
    ///
    /// Uses HTTP If-None-Match header for true delta sync support.
    ///
    /// Returns:
    /// - `Ok(Some((response, etag)))` if rules were downloaded
    /// - `Ok(None)` if 304 Not Modified
    /// - `Err(e)` on failure
    async fn download_rules(
        &self,
        path: &str,
        etag: Option<&str>,
    ) -> SyncResult<Option<(RulesResponse, Option<String>)>> {
        debug!(
            "Downloading rules from {} (If-None-Match: {:?})",
            path, etag
        );

        // Use the new get_with_etag method that properly sends If-None-Match header
        match self
            .client
            .get_with_etag::<RulesResponse>(path, etag)
            .await?
        {
            Some((response, response_etag)) => {
                // Server returned new data
                // Use the ETag from the response header, or fall back to the one in the body
                let new_etag = response_etag.or_else(|| response.etag.clone());

                debug!(
                    "Downloaded {} rules (etag: {:?})",
                    response.total_count, new_etag
                );

                Ok(Some((response, new_etag)))
            }
            None => {
                // Server returned 304 Not Modified
                // Validate that we actually have cached rules before accepting
                let repo = CheckRulesRepository::new(&self.db);
                let cached_count = repo.count().await.unwrap_or(0);

                if cached_count == 0 {
                    // Cache is empty but server says not modified - force refresh
                    warn!("Server returned 304 but rule cache is empty. Forcing full refresh.");
                    // Fetch without If-None-Match by calling client directly (avoid recursion)
                    let response: RulesResponse = self.client.get(path).await?;
                    let new_etag = response.etag.clone();
                    debug!(
                        "Forced download of {} rules (etag: {:?})",
                        response.total_count, new_etag
                    );
                    return Ok(Some((response, new_etag)));
                }

                debug!(
                    "Rules unchanged (304 Not Modified), {} rules in cache",
                    cached_count
                );
                Ok(None)
            }
        }
    }

    /// Force a full sync, ignoring ETag.
    pub async fn force_sync(&self) -> SyncResult<RuleSyncResult> {
        let repo = CheckRulesRepository::new(&self.db);
        let agent_id = self.client.agent_id().await?;

        info!("Force syncing rules for agent {}", agent_id);

        let path = format!("/v1/agents/{}/rules", agent_id);
        let response: RulesResponse = self.client.get(&path).await?;

        let rules: Vec<CheckRule> = response.rules.into_iter().map(CheckRule::from).collect();

        let count = repo.upsert_batch(&rules).await?;
        repo.update_cache_metadata(response.etag.as_deref()).await?;

        info!("Force synced {} rules (etag: {:?})", count, response.etag);

        Ok(RuleSyncResult {
            rules_synced: count,
            cache_hit: false,
            new_etag: response.etag,
            synced_at: Utc::now(),
            warnings: Vec::new(),
        })
    }

    /// Get rules from cache without syncing.
    pub async fn get_cached_rules(&self) -> SyncResult<Vec<CheckRule>> {
        let repo = CheckRulesRepository::new(&self.db);
        Ok(repo.get_enabled().await?)
    }

    /// Get all rules from cache (including disabled).
    pub async fn get_all_cached_rules(&self) -> SyncResult<Vec<CheckRule>> {
        let repo = CheckRulesRepository::new(&self.db);
        Ok(repo.get_all().await?)
    }

    /// Check if local cache is valid (within 7 days).
    pub async fn is_cache_valid(&self) -> SyncResult<bool> {
        let repo = CheckRulesRepository::new(&self.db);
        Ok(repo.is_cache_valid().await?)
    }

    /// Get cache metadata.
    pub async fn get_cache_metadata(&self) -> SyncResult<CacheMetadata> {
        let repo = CheckRulesRepository::new(&self.db);
        let metadata = repo.get_cache_metadata().await?;
        let is_valid = repo.is_cache_valid().await?;

        Ok(CacheMetadata {
            etag: metadata.etag,
            last_sync_at: metadata.last_sync_at,
            rule_count: metadata.rule_count,
            is_valid,
        })
    }

    /// Sync rules only if cache is expired or empty.
    pub async fn sync_if_needed(&self) -> SyncResult<RuleSyncResult> {
        let repo = CheckRulesRepository::new(&self.db);

        if repo.is_cache_valid().await? {
            debug!("Cache is still valid, skipping sync");
            let metadata = repo.get_cache_metadata().await?;

            Ok(RuleSyncResult {
                rules_synced: 0,
                cache_hit: true,
                new_etag: metadata.etag,
                synced_at: Utc::now(),
                warnings: Vec::new(),
            })
        } else {
            info!("Cache expired or empty, syncing rules");
            self.sync_rules().await
        }
    }
}

/// Cache metadata for external consumption.
#[derive(Debug, Clone, Serialize)]
pub struct CacheMetadata {
    /// Current ETag.
    pub etag: Option<String>,
    /// Last successful sync timestamp.
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Number of cached rules.
    pub rule_count: i64,
    /// Whether cache is within 7-day validity window.
    pub is_valid: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_check_rule_deserialization() {
        let json = r#"{
            "id": "disk_encryption",
            "name": "Disk Encryption Check",
            "description": "Verifies disk encryption is enabled",
            "category": "security",
            "severity": "critical",
            "enabled": true,
            "check_type": "disk_encryption",
            "parameters": {"require_tpm": true},
            "frameworks": ["NIS2", "DORA"],
            "version": "1.0",
            "created_at": "2026-01-23T00:00:00Z",
            "updated_at": "2026-01-23T00:00:00Z"
        }"#;

        let rule: ApiCheckRule = serde_json::from_str(json).unwrap();
        assert_eq!(rule.id, "disk_encryption");
        assert_eq!(rule.severity, "critical");
        assert!(rule.enabled);
        assert_eq!(rule.frameworks.len(), 2);
    }

    #[test]
    fn test_api_check_rule_defaults() {
        let json = r#"{
            "id": "test",
            "name": "Test",
            "category": "test",
            "severity": "low",
            "check_type": "test",
            "version": "1.0"
        }"#;

        let rule: ApiCheckRule = serde_json::from_str(json).unwrap();
        assert!(rule.enabled); // default true
        assert!(rule.description.is_none());
        assert!(rule.parameters.is_none());
        assert!(rule.frameworks.is_empty());
    }

    #[test]
    fn test_api_check_rule_to_check_rule() {
        let api_rule = ApiCheckRule {
            id: "test".to_string(),
            name: "Test Rule".to_string(),
            description: Some("A test rule".to_string()),
            category: "security".to_string(),
            severity: "high".to_string(),
            enabled: true,
            check_type: "test".to_string(),
            parameters: Some(serde_json::json!({"key": "value"})),
            frameworks: vec!["NIS2".to_string()],
            version: "1.0".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            check_command: None,
            expected_result: None,
            remediation: None,
            platforms: None,
            control_id: None,
        };

        let rule: CheckRule = api_rule.into();
        assert_eq!(rule.id, "test");
        assert_eq!(rule.severity, Severity::High);
        assert_eq!(rule.frameworks.len(), 1);
    }

    #[test]
    fn test_rules_response_deserialization() {
        let json = r#"{
            "rules": [
                {
                    "id": "rule1",
                    "name": "Rule 1",
                    "category": "security",
                    "severity": "high",
                    "check_type": "test",
                    "version": "1.0"
                }
            ],
            "etag": "abc123",
            "total_count": 1
        }"#;

        let response: RulesResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.rules.len(), 1);
        assert_eq!(response.etag, Some("abc123".to_string()));
        assert_eq!(response.total_count, 1);
    }

    #[test]
    fn test_rules_response_no_etag() {
        let json = r#"{
            "rules": [],
            "total_count": 0
        }"#;

        let response: RulesResponse = serde_json::from_str(json).unwrap();
        assert!(response.etag.is_none());
    }

    #[test]
    fn test_severity_conversion() {
        assert_eq!(Severity::parse_str("critical"), Some(Severity::Critical));
        assert_eq!(Severity::parse_str("high"), Some(Severity::High));
        assert_eq!(Severity::parse_str("medium"), Some(Severity::Medium));
        assert_eq!(Severity::parse_str("low"), Some(Severity::Low));
        assert_eq!(Severity::parse_str("info"), Some(Severity::Info));
        assert_eq!(Severity::parse_str("invalid"), None);
    }

    #[test]
    fn test_rule_sync_result() {
        let result = RuleSyncResult {
            rules_synced: 10,
            cache_hit: false,
            new_etag: Some("xyz789".to_string()),
            synced_at: Utc::now(),
            warnings: Vec::new(),
        };

        assert_eq!(result.rules_synced, 10);
        assert!(!result.cache_hit);
    }

    #[test]
    fn test_cache_metadata() {
        let metadata = CacheMetadata {
            etag: Some("etag123".to_string()),
            last_sync_at: Some(Utc::now()),
            rule_count: 15,
            is_valid: true,
        };

        assert!(metadata.is_valid);
        assert_eq!(metadata.rule_count, 15);
    }
}
