//! Check rules repository for storing compliance check definitions.
//!
//! This module provides CRUD operations for check rules with support for:
//! - Upsert semantics for sync from SaaS
//! - ETag-based cache validation
//! - Framework filtering (NIS2, DORA, RGPD)
//! - Enabled/disabled rule management

use crate::Database;
use crate::error::{StorageError, StorageResult};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// Severity level for a compliance check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl Severity {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Critical => "critical",
            Severity::High => "high",
            Severity::Medium => "medium",
            Severity::Low => "low",
            Severity::Info => "info",
        }
    }

    /// Parse from database string representation.
    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "critical" => Some(Severity::Critical),
            "high" => Some(Severity::High),
            "medium" => Some(Severity::Medium),
            "low" => Some(Severity::Low),
            "info" => Some(Severity::Info),
            _ => None,
        }
    }

    /// Get the weight for scoring calculations.
    pub fn weight(&self) -> f64 {
        match self {
            Severity::Critical => 4.0,
            Severity::High => 3.0,
            Severity::Medium => 2.0,
            Severity::Low => 1.0,
            Severity::Info => 0.5,
        }
    }
}

/// A compliance check rule definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRule {
    /// Unique rule identifier.
    pub id: String,
    /// Human-readable rule name.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// Rule category (e.g., "security", "encryption").
    pub category: String,
    /// Severity level.
    pub severity: Severity,
    /// Whether the rule is enabled.
    pub enabled: bool,
    /// Check type identifier (maps to Check implementation).
    pub check_type: String,
    /// Check-specific parameters as JSON.
    pub parameters: Option<serde_json::Value>,
    /// Regulatory frameworks this rule maps to.
    pub frameworks: Vec<String>,
    /// Rule version string.
    pub version: String,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
    /// Command to execute for this check.
    pub check_command: Option<String>,
    /// Expected result of the check command.
    pub expected_result: Option<String>,
    /// Remediation instructions if the check fails.
    pub remediation: Option<String>,
    /// Platforms this rule applies to (stored as JSON array).
    pub platforms: Option<Vec<String>>,
    /// Associated control identifier.
    pub control_id: Option<String>,
}

impl CheckRule {
    /// Create a new check rule.
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        category: impl Into<String>,
        severity: Severity,
        check_type: impl Into<String>,
        version: impl Into<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: id.into(),
            name: name.into(),
            description: None,
            category: category.into(),
            severity,
            enabled: true,
            check_type: check_type.into(),
            parameters: None,
            frameworks: Vec::new(),
            version: version.into(),
            created_at: now,
            updated_at: now,
            check_command: None,
            expected_result: None,
            remediation: None,
            platforms: None,
            control_id: None,
        }
    }

    /// Set the description.
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Set the parameters.
    pub fn with_parameters(mut self, parameters: serde_json::Value) -> Self {
        self.parameters = Some(parameters);
        self
    }

    /// Set the frameworks.
    pub fn with_frameworks(mut self, frameworks: Vec<String>) -> Self {
        self.frameworks = frameworks;
        self
    }

    /// Set enabled status.
    pub fn with_enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    /// Set the check command.
    pub fn with_check_command(mut self, check_command: impl Into<String>) -> Self {
        self.check_command = Some(check_command.into());
        self
    }

    /// Set the expected result.
    pub fn with_expected_result(mut self, expected_result: impl Into<String>) -> Self {
        self.expected_result = Some(expected_result.into());
        self
    }

    /// Set the remediation instructions.
    pub fn with_remediation(mut self, remediation: impl Into<String>) -> Self {
        self.remediation = Some(remediation.into());
        self
    }

    /// Set the platforms.
    pub fn with_platforms(mut self, platforms: Vec<String>) -> Self {
        self.platforms = Some(platforms);
        self
    }

    /// Set the control ID.
    pub fn with_control_id(mut self, control_id: impl Into<String>) -> Self {
        self.control_id = Some(control_id.into());
        self
    }
}

/// Cache metadata for check rules.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleCacheMetadata {
    /// ETag from last successful sync.
    pub etag: Option<String>,
    /// Timestamp of last successful sync.
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Number of rules in cache.
    pub rule_count: i64,
}

/// Repository for check rules CRUD operations.
pub struct CheckRulesRepository<'a> {
    db: &'a Database,
}

impl<'a> CheckRulesRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Upsert a check rule (insert or update).
    ///
    /// This uses INSERT OR REPLACE semantics for sync operations.
    pub async fn upsert(&self, rule: &CheckRule) -> StorageResult<()> {
        let id = rule.id.clone();
        let name = rule.name.clone();
        let description = rule.description.clone();
        let category = rule.category.clone();
        let severity = rule.severity.as_str().to_string();
        let enabled = if rule.enabled { 1 } else { 0 };
        let check_type = rule.check_type.clone();
        let parameters = rule
            .parameters
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_default());
        let frameworks =
            serde_json::to_string(&rule.frameworks).unwrap_or_else(|_| "[]".to_string());
        let version = rule.version.clone();
        let created_at = rule.created_at.to_rfc3339();
        let updated_at = rule.updated_at.to_rfc3339();
        let check_command = rule.check_command.clone();
        let expected_result = rule.expected_result.clone();
        let remediation = rule.remediation.clone();
        let platforms = rule
            .platforms
            .as_ref()
            .map(|p| serde_json::to_string(p).unwrap_or_else(|_| "[]".to_string()));
        let control_id = rule.control_id.clone();

        self.db
            .with_connection(move |conn| {
                conn.execute(
                    r#"
                    INSERT OR REPLACE INTO check_rules
                    (id, name, description, category, severity, enabled, check_type,
                     parameters, frameworks, version, created_at, updated_at,
                     check_command, expected_result, remediation, platforms, control_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![
                        id,
                        name,
                        description,
                        category,
                        severity,
                        enabled,
                        check_type,
                        parameters,
                        frameworks,
                        version,
                        created_at,
                        updated_at,
                        check_command,
                        expected_result,
                        remediation,
                        platforms,
                        control_id,
                    ],
                )
                .map_err(|e| StorageError::Query(format!("Failed to upsert check rule: {}", e)))?;

                debug!("Upserted check rule: {}", id);
                Ok(())
            })
            .await
    }

    /// Upsert multiple rules in a transaction.
    pub async fn upsert_batch(&self, rules: &[CheckRule]) -> StorageResult<usize> {
        if rules.is_empty() {
            return Ok(0);
        }

        let rules = rules.to_vec();
        self.db
            .with_connection_mut(move |conn| {
                let tx = conn.transaction().map_err(|e| {
                    StorageError::Query(format!("Failed to start transaction: {}", e))
                })?;

                for rule in &rules {
                    let parameters = rule
                        .parameters
                        .as_ref()
                        .map(|p| serde_json::to_string(p).unwrap_or_default());
                    let frameworks = serde_json::to_string(&rule.frameworks)
                        .unwrap_or_else(|_| "[]".to_string());
                    let platforms = rule
                        .platforms
                        .as_ref()
                        .map(|p| serde_json::to_string(p).unwrap_or_else(|_| "[]".to_string()));

                    tx.execute(
                        r#"
                        INSERT OR REPLACE INTO check_rules
                        (id, name, description, category, severity, enabled, check_type,
                         parameters, frameworks, version, created_at, updated_at,
                         check_command, expected_result, remediation, platforms, control_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        "#,
                        rusqlite::params![
                            rule.id,
                            rule.name,
                            rule.description,
                            rule.category,
                            rule.severity.as_str(),
                            if rule.enabled { 1 } else { 0 },
                            rule.check_type,
                            parameters,
                            frameworks,
                            rule.version,
                            rule.created_at.to_rfc3339(),
                            rule.updated_at.to_rfc3339(),
                            rule.check_command,
                            rule.expected_result,
                            rule.remediation,
                            platforms,
                            rule.control_id,
                        ],
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to upsert rule {}: {}", rule.id, e))
                    })?;
                }

                tx.commit().map_err(|e| {
                    StorageError::Query(format!("Failed to commit transaction: {}", e))
                })?;

                let count = rules.len();
                info!("Upserted {} check rules in batch", count);
                Ok(count)
            })
            .await
    }

    /// Get a check rule by ID.
    pub async fn get(&self, id: &str) -> StorageResult<Option<CheckRule>> {
        let id = id.to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, name, description, category, severity, enabled, check_type,
                               parameters, frameworks, version, created_at, updated_at,
                               check_command, expected_result, remediation, platforms, control_id
                        FROM check_rules
                        WHERE id = ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let result = stmt
                    .query_row([&id], Self::row_to_check_rule)
                    .optional()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to query check rule: {}", e))
                    })?;

                Ok(result)
            })
            .await
    }

    /// Get all check rules.
    pub async fn get_all(&self) -> StorageResult<Vec<CheckRule>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, name, description, category, severity, enabled, check_type,
                               parameters, frameworks, version, created_at, updated_at,
                               check_command, expected_result, remediation, platforms, control_id
                        FROM check_rules
                        ORDER BY category, severity DESC, name
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], Self::row_to_check_rule)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get only enabled check rules.
    pub async fn get_enabled(&self) -> StorageResult<Vec<CheckRule>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, name, description, category, severity, enabled, check_type,
                               parameters, frameworks, version, created_at, updated_at,
                               check_command, expected_result, remediation, platforms, control_id
                        FROM check_rules
                        WHERE enabled = 1
                        ORDER BY category, severity DESC, name
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], Self::row_to_check_rule)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get check rules by framework.
    pub async fn get_by_framework(&self, framework: &str) -> StorageResult<Vec<CheckRule>> {
        let framework = framework.to_string();
        self.db
            .with_connection(move |conn| {
                // Use JSON functions to search in frameworks array
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, name, description, category, severity, enabled, check_type,
                               parameters, frameworks, version, created_at, updated_at,
                               check_command, expected_result, remediation, platforms, control_id
                        FROM check_rules
                        WHERE frameworks LIKE ?
                        ORDER BY category, severity DESC, name
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let pattern = format!("%\"{}%", framework);
                let results = stmt
                    .query_map([&pattern], Self::row_to_check_rule)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Get check rules by category.
    pub async fn get_by_category(&self, category: &str) -> StorageResult<Vec<CheckRule>> {
        let category = category.to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT id, name, description, category, severity, enabled, check_type,
                               parameters, frameworks, version, created_at, updated_at,
                               check_command, expected_result, remediation, platforms, control_id
                        FROM check_rules
                        WHERE category = ?
                        ORDER BY severity DESC, name
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([&category], Self::row_to_check_rule)
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to collect results: {}", e))
                    })?;

                Ok(results)
            })
            .await
    }

    /// Enable or disable a rule.
    pub async fn set_enabled(&self, id: &str, enabled: bool) -> StorageResult<bool> {
        let id = id.to_string();
        let enabled_val = if enabled { 1 } else { 0 };
        let updated_at = Utc::now().to_rfc3339();

        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute(
                        "UPDATE check_rules SET enabled = ?, updated_at = ? WHERE id = ?",
                        rusqlite::params![enabled_val, updated_at, id],
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to update rule: {}", e)))?;

                Ok(count > 0)
            })
            .await
    }

    /// Delete a check rule.
    pub async fn delete(&self, id: &str) -> StorageResult<bool> {
        let id = id.to_string();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute("DELETE FROM check_rules WHERE id = ?", [&id])
                    .map_err(|e| StorageError::Query(format!("Failed to delete rule: {}", e)))?;

                if count > 0 {
                    info!("Deleted check rule: {}", id);
                }
                Ok(count > 0)
            })
            .await
    }

    /// Delete all check rules (for full resync).
    pub async fn delete_all(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let count = conn
                    .execute("DELETE FROM check_rules", [])
                    .map_err(|e| StorageError::Query(format!("Failed to delete rules: {}", e)))?;

                info!("Deleted all {} check rules", count);
                Ok(count)
            })
            .await
    }

    /// Count total check rules.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM check_rules", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count rules: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Count enabled check rules.
    pub async fn count_enabled(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM check_rules WHERE enabled = 1",
                        [],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        StorageError::Query(format!("Failed to count enabled rules: {}", e))
                    })?;
                Ok(count)
            })
            .await
    }

    /// Get cache metadata (stored in agent_config).
    pub async fn get_cache_metadata(&self) -> StorageResult<RuleCacheMetadata> {
        self.db
            .with_connection(|conn| {
                let etag: Option<String> = conn
                    .query_row(
                        "SELECT value FROM agent_config WHERE key = 'rules_etag'",
                        [],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to get etag: {}", e)))?;

                let last_sync_str: Option<String> = conn
                    .query_row(
                        "SELECT value FROM agent_config WHERE key = 'rules_last_sync'",
                        [],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to get last sync: {}", e)))?;

                let last_sync_at = last_sync_str
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                let rule_count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM check_rules", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count rules: {}", e)))?;

                Ok(RuleCacheMetadata {
                    etag,
                    last_sync_at,
                    rule_count,
                })
            })
            .await
    }

    /// Update cache metadata after successful sync.
    pub async fn update_cache_metadata(&self, etag: Option<&str>) -> StorageResult<()> {
        let etag = etag.map(String::from);
        let now = Utc::now().to_rfc3339();

        self.db
            .with_connection(move |conn| {
                // Update last sync timestamp
                conn.execute(
                    r#"
                    INSERT OR REPLACE INTO agent_config (key, value, updated_at, source)
                    VALUES ('rules_last_sync', ?, ?, 'local')
                    "#,
                    [&now, &now],
                )
                .map_err(|e| StorageError::Query(format!("Failed to update last sync: {}", e)))?;

                // Update etag if provided
                if let Some(etag_value) = etag {
                    conn.execute(
                        r#"
                        INSERT OR REPLACE INTO agent_config (key, value, updated_at, source)
                        VALUES ('rules_etag', ?, ?, 'local')
                        "#,
                        [&etag_value, &now],
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to update etag: {}", e)))?;
                }

                debug!("Updated rules cache metadata");
                Ok(())
            })
            .await
    }

    /// Check if the cache is valid (within 7 days).
    pub async fn is_cache_valid(&self) -> StorageResult<bool> {
        let metadata = self.get_cache_metadata().await?;

        // No cached data
        if metadata.rule_count == 0 {
            return Ok(false);
        }

        // Check if last sync was within 7 days
        if let Some(last_sync) = metadata.last_sync_at {
            let seven_days_ago = Utc::now() - chrono::Duration::days(7);
            Ok(last_sync > seven_days_ago)
        } else {
            Ok(false)
        }
    }

    /// Convert a database row to a CheckRule.
    fn row_to_check_rule(row: &rusqlite::Row<'_>) -> rusqlite::Result<CheckRule> {
        let severity_str: String = row.get(4)?;
        let severity = Severity::parse_str(&severity_str).unwrap_or_else(|| {
            tracing::warn!(
                "Unknown check rule severity '{}' in database, falling back to Medium",
                severity_str
            );
            Severity::Medium
        });

        let enabled_int: i32 = row.get(5)?;

        let parameters_str: Option<String> = row.get(7)?;
        let parameters = parameters_str.and_then(|s| serde_json::from_str(&s).ok());

        let frameworks_str: Option<String> = row.get(8)?;
        let frameworks: Vec<String> = frameworks_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        let created_at_str: String = row.get(10)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                tracing::warn!(
                    "Failed to parse created_at timestamp '{}': {}, using current time",
                    created_at_str, e
                );
                Utc::now()
            });

        let updated_at_str: String = row.get(11)?;
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|e| {
                tracing::warn!(
                    "Failed to parse updated_at timestamp '{}': {}, using current time",
                    updated_at_str, e
                );
                Utc::now()
            });

        let platforms_str: Option<String> = row.get(15)?;
        let platforms = platforms_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(CheckRule {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            severity,
            enabled: enabled_int != 0,
            check_type: row.get(6)?,
            parameters,
            frameworks,
            version: row.get(9)?,
            created_at,
            updated_at,
            check_command: row.get(12)?,
            expected_result: row.get(13)?,
            remediation: row.get(14)?,
            platforms,
            control_id: row.get(16)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, db)
    }

    #[tokio::test]
    async fn test_upsert_and_get() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        let rule = CheckRule::new(
            "disk_encryption",
            "Disk Encryption Check",
            "security",
            Severity::Critical,
            "disk_encryption",
            "1.0",
        )
        .with_description("Verifies disk encryption is enabled")
        .with_frameworks(vec!["NIS2".to_string(), "DORA".to_string()]);

        repo.upsert(&rule).await.unwrap();

        let retrieved = repo.get("disk_encryption").await.unwrap().unwrap();
        assert_eq!(retrieved.id, "disk_encryption");
        assert_eq!(retrieved.name, "Disk Encryption Check");
        assert_eq!(retrieved.severity, Severity::Critical);
        assert!(retrieved.enabled);
        assert_eq!(retrieved.frameworks.len(), 2);
    }

    #[tokio::test]
    async fn test_upsert_updates_existing() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        let rule = CheckRule::new(
            "test_rule",
            "Original Name",
            "security",
            Severity::Low,
            "test",
            "1.0",
        );
        repo.upsert(&rule).await.unwrap();

        // Update the rule
        let updated_rule = CheckRule::new(
            "test_rule",
            "Updated Name",
            "security",
            Severity::High,
            "test",
            "2.0",
        );
        repo.upsert(&updated_rule).await.unwrap();

        let retrieved = repo.get("test_rule").await.unwrap().unwrap();
        assert_eq!(retrieved.name, "Updated Name");
        assert_eq!(retrieved.severity, Severity::High);
        assert_eq!(retrieved.version, "2.0");

        // Should still only have one rule
        assert_eq!(repo.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_upsert_batch() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        let rules = vec![
            CheckRule::new("rule1", "Rule 1", "security", Severity::High, "test", "1.0"),
            CheckRule::new(
                "rule2",
                "Rule 2",
                "security",
                Severity::Medium,
                "test",
                "1.0",
            ),
            CheckRule::new(
                "rule3",
                "Rule 3",
                "compliance",
                Severity::Low,
                "test",
                "1.0",
            ),
        ];

        let count = repo.upsert_batch(&rules).await.unwrap();
        assert_eq!(count, 3);
        assert_eq!(repo.count().await.unwrap(), 3);
    }

    #[tokio::test]
    async fn test_get_all() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "rule1",
            "Rule 1",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(&CheckRule::new(
            "rule2",
            "Rule 2",
            "compliance",
            Severity::Low,
            "test",
            "1.0",
        ))
        .await
        .unwrap();

        let rules = repo.get_all().await.unwrap();
        assert_eq!(rules.len(), 2);
    }

    #[tokio::test]
    async fn test_get_enabled() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "enabled_rule",
            "Enabled",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(
            &CheckRule::new(
                "disabled_rule",
                "Disabled",
                "security",
                Severity::High,
                "test",
                "1.0",
            )
            .with_enabled(false),
        )
        .await
        .unwrap();

        let enabled = repo.get_enabled().await.unwrap();
        assert_eq!(enabled.len(), 1);
        assert_eq!(enabled[0].id, "enabled_rule");
    }

    #[tokio::test]
    async fn test_get_by_framework() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(
            &CheckRule::new(
                "nis2_rule",
                "NIS2 Rule",
                "security",
                Severity::High,
                "test",
                "1.0",
            )
            .with_frameworks(vec!["NIS2".to_string()]),
        )
        .await
        .unwrap();
        repo.upsert(
            &CheckRule::new(
                "dora_rule",
                "DORA Rule",
                "security",
                Severity::High,
                "test",
                "1.0",
            )
            .with_frameworks(vec!["DORA".to_string()]),
        )
        .await
        .unwrap();
        repo.upsert(
            &CheckRule::new(
                "both_rule",
                "Both Rule",
                "security",
                Severity::High,
                "test",
                "1.0",
            )
            .with_frameworks(vec!["NIS2".to_string(), "DORA".to_string()]),
        )
        .await
        .unwrap();

        let nis2_rules = repo.get_by_framework("NIS2").await.unwrap();
        assert_eq!(nis2_rules.len(), 2);

        let dora_rules = repo.get_by_framework("DORA").await.unwrap();
        assert_eq!(dora_rules.len(), 2);
    }

    #[tokio::test]
    async fn test_get_by_category() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "sec1",
            "Security 1",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(&CheckRule::new(
            "sec2",
            "Security 2",
            "security",
            Severity::Low,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(&CheckRule::new(
            "comp1",
            "Compliance 1",
            "compliance",
            Severity::Medium,
            "test",
            "1.0",
        ))
        .await
        .unwrap();

        let security_rules = repo.get_by_category("security").await.unwrap();
        assert_eq!(security_rules.len(), 2);

        let compliance_rules = repo.get_by_category("compliance").await.unwrap();
        assert_eq!(compliance_rules.len(), 1);
    }

    #[tokio::test]
    async fn test_set_enabled() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "test_rule",
            "Test",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();

        // Disable
        let updated = repo.set_enabled("test_rule", false).await.unwrap();
        assert!(updated);

        let rule = repo.get("test_rule").await.unwrap().unwrap();
        assert!(!rule.enabled);

        // Enable
        repo.set_enabled("test_rule", true).await.unwrap();
        let rule = repo.get("test_rule").await.unwrap().unwrap();
        assert!(rule.enabled);
    }

    #[tokio::test]
    async fn test_delete() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "test_rule",
            "Test",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();

        let deleted = repo.delete("test_rule").await.unwrap();
        assert!(deleted);

        let rule = repo.get("test_rule").await.unwrap();
        assert!(rule.is_none());

        // Delete non-existent
        let deleted = repo.delete("nonexistent").await.unwrap();
        assert!(!deleted);
    }

    #[tokio::test]
    async fn test_delete_all() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        repo.upsert(&CheckRule::new(
            "rule1",
            "Rule 1",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(&CheckRule::new(
            "rule2",
            "Rule 2",
            "security",
            Severity::Low,
            "test",
            "1.0",
        ))
        .await
        .unwrap();

        let deleted = repo.delete_all().await.unwrap();
        assert_eq!(deleted, 2);
        assert_eq!(repo.count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_cache_metadata() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        // Initially no cache
        let metadata = repo.get_cache_metadata().await.unwrap();
        assert!(metadata.etag.is_none());
        assert!(metadata.last_sync_at.is_none());
        assert_eq!(metadata.rule_count, 0);

        // Add a rule and update metadata
        repo.upsert(&CheckRule::new(
            "test",
            "Test",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.update_cache_metadata(Some("abc123")).await.unwrap();

        let metadata = repo.get_cache_metadata().await.unwrap();
        assert_eq!(metadata.etag, Some("abc123".to_string()));
        assert!(metadata.last_sync_at.is_some());
        assert_eq!(metadata.rule_count, 1);
    }

    #[tokio::test]
    async fn test_is_cache_valid() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        // No cache = invalid
        assert!(!repo.is_cache_valid().await.unwrap());

        // Add rule and update metadata
        repo.upsert(&CheckRule::new(
            "test",
            "Test",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.update_cache_metadata(Some("etag")).await.unwrap();

        // Now cache should be valid (just synced)
        assert!(repo.is_cache_valid().await.unwrap());
    }

    #[tokio::test]
    async fn test_severity_weight() {
        assert_eq!(Severity::Critical.weight(), 4.0);
        assert_eq!(Severity::High.weight(), 3.0);
        assert_eq!(Severity::Medium.weight(), 2.0);
        assert_eq!(Severity::Low.weight(), 1.0);
        assert_eq!(Severity::Info.weight(), 0.5);
    }

    #[tokio::test]
    async fn test_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);
        assert_eq!(repo.count_enabled().await.unwrap(), 0);

        repo.upsert(&CheckRule::new(
            "rule1",
            "Rule 1",
            "security",
            Severity::High,
            "test",
            "1.0",
        ))
        .await
        .unwrap();
        repo.upsert(
            &CheckRule::new("rule2", "Rule 2", "security", Severity::Low, "test", "1.0")
                .with_enabled(false),
        )
        .await
        .unwrap();

        assert_eq!(repo.count().await.unwrap(), 2);
        assert_eq!(repo.count_enabled().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_parameters_json() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CheckRulesRepository::new(&db);

        let params = serde_json::json!({
            "min_password_length": 12,
            "require_complexity": true
        });

        let rule = CheckRule::new(
            "password_policy",
            "Password Policy",
            "security",
            Severity::High,
            "password_policy",
            "1.0",
        )
        .with_parameters(params.clone());

        repo.upsert(&rule).await.unwrap();

        let retrieved = repo.get("password_policy").await.unwrap().unwrap();
        assert_eq!(retrieved.parameters, Some(params));
    }
}
