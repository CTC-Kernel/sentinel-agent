//! Configuration repository for storing agent settings.
//!
//! This module provides CRUD operations for agent configuration with support for:
//! - Local vs remote config source tracking
//! - Merge strategy (local overrides preserved)
//! - Hot reload without restart

use crate::error::{StorageError, StorageResult};
use crate::Database;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info};

/// Source of a configuration value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfigSource {
    /// Configuration set locally (file or CLI).
    Local,
    /// Configuration synced from SaaS.
    Remote,
}

impl ConfigSource {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            ConfigSource::Local => "local",
            ConfigSource::Remote => "remote",
        }
    }

    /// Parse from database string representation.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "local" => Some(ConfigSource::Local),
            "remote" => Some(ConfigSource::Remote),
            _ => None,
        }
    }
}

/// A configuration entry record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigEntry {
    /// Configuration key.
    pub key: String,
    /// Configuration value (JSON string).
    pub value: String,
    /// When this entry was last updated.
    pub updated_at: DateTime<Utc>,
    /// When this entry was last synced from remote.
    pub synced_at: Option<DateTime<Utc>>,
    /// Source of this configuration value.
    pub source: ConfigSource,
}

impl ConfigEntry {
    /// Create a new local config entry.
    pub fn local(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
            updated_at: Utc::now(),
            synced_at: None,
            source: ConfigSource::Local,
        }
    }

    /// Create a new remote config entry.
    pub fn remote(key: impl Into<String>, value: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            key: key.into(),
            value: value.into(),
            updated_at: now,
            synced_at: Some(now),
            source: ConfigSource::Remote,
        }
    }

    /// Parse the value as a specific type.
    pub fn parse<T: for<'de> Deserialize<'de>>(&self) -> Option<T> {
        serde_json::from_str(&self.value).ok()
    }

    /// Check if this is a local override.
    pub fn is_local_override(&self) -> bool {
        self.source == ConfigSource::Local
    }
}

/// Result of a configuration merge operation.
#[derive(Debug, Clone)]
pub struct MergeResult {
    /// Number of new entries added.
    pub added: usize,
    /// Number of entries updated.
    pub updated: usize,
    /// Number of entries skipped (local overrides preserved).
    pub skipped: usize,
    /// Keys that were skipped due to local overrides.
    pub skipped_keys: Vec<String>,
}

/// Repository for configuration CRUD operations.
pub struct ConfigRepository<'a> {
    db: &'a Database,
}

impl<'a> ConfigRepository<'a> {
    /// Create a new repository instance.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Get a configuration value by key.
    pub async fn get(&self, key: &str) -> StorageResult<Option<ConfigEntry>> {
        let key = key.to_string();
        self.db
            .with_connection(move |conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT key, value, updated_at, synced_at, source
                        FROM agent_config
                        WHERE key = ?
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let result = stmt
                    .query_row([&key], |row| Self::row_to_config_entry(row))
                    .optional()
                    .map_err(|e| StorageError::Query(format!("Failed to query config: {}", e)))?;

                Ok(result)
            })
            .await
    }

    /// Get a configuration value as a specific type.
    pub async fn get_typed<T: for<'de> Deserialize<'de>>(&self, key: &str) -> StorageResult<Option<T>> {
        if let Some(entry) = self.get(key).await? {
            Ok(entry.parse())
        } else {
            Ok(None)
        }
    }

    /// Get a configuration value with a default.
    pub async fn get_or_default<T: for<'de> Deserialize<'de> + Default>(&self, key: &str) -> StorageResult<T> {
        Ok(self.get_typed(key).await?.unwrap_or_default())
    }

    /// Set a configuration value (local source).
    pub async fn set(&self, key: &str, value: &str) -> StorageResult<()> {
        self.set_with_source(key, value, ConfigSource::Local).await
    }

    /// Set a configuration value with specific source.
    pub async fn set_with_source(&self, key: &str, value: &str, source: ConfigSource) -> StorageResult<()> {
        let key = key.to_string();
        let value = value.to_string();
        let source_str = source.as_str().to_string();
        let now = Utc::now().to_rfc3339();
        let synced_at = if source == ConfigSource::Remote {
            Some(now.clone())
        } else {
            None
        };

        self.db
            .with_connection(move |conn| {
                conn.execute(
                    r#"
                    INSERT OR REPLACE INTO agent_config (key, value, updated_at, synced_at, source)
                    VALUES (?, ?, ?, ?, ?)
                    "#,
                    rusqlite::params![key, value, now, synced_at, source_str],
                )
                .map_err(|e| StorageError::Query(format!("Failed to set config: {}", e)))?;

                debug!("Set config key: {} (source: {})", key, source_str);
                Ok(())
            })
            .await
    }

    /// Get all configuration entries.
    pub async fn get_all(&self) -> StorageResult<Vec<ConfigEntry>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT key, value, updated_at, synced_at, source
                        FROM agent_config
                        ORDER BY key
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], |row| Self::row_to_config_entry(row))
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect results: {}", e)))?;

                Ok(results)
            })
            .await
    }

    /// Get all configuration as a HashMap.
    pub async fn get_all_map(&self) -> StorageResult<HashMap<String, String>> {
        let entries = self.get_all().await?;
        Ok(entries.into_iter().map(|e| (e.key, e.value)).collect())
    }

    /// Get only local override entries.
    pub async fn get_local_overrides(&self) -> StorageResult<Vec<ConfigEntry>> {
        self.db
            .with_connection(|conn| {
                let mut stmt = conn
                    .prepare(
                        r#"
                        SELECT key, value, updated_at, synced_at, source
                        FROM agent_config
                        WHERE source = 'local'
                        ORDER BY key
                        "#,
                    )
                    .map_err(|e| StorageError::Query(format!("Failed to prepare query: {}", e)))?;

                let results = stmt
                    .query_map([], |row| Self::row_to_config_entry(row))
                    .map_err(|e| StorageError::Query(format!("Failed to execute query: {}", e)))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| StorageError::Query(format!("Failed to collect results: {}", e)))?;

                Ok(results)
            })
            .await
    }

    /// Merge remote configuration with local.
    ///
    /// Local overrides are preserved (not overwritten by remote values).
    pub async fn merge_remote_config(&self, remote_config: HashMap<String, String>) -> StorageResult<MergeResult> {
        // First, get all local overrides
        let local_overrides = self.get_local_overrides().await?;
        let local_keys: std::collections::HashSet<String> =
            local_overrides.iter().map(|e| e.key.clone()).collect();

        let mut added = 0;
        let mut updated = 0;
        let mut skipped = 0;
        let mut skipped_keys = Vec::new();

        for (key, value) in remote_config {
            // Skip if this key has a local override
            if local_keys.contains(&key) {
                debug!("Skipping remote config for key '{}' (local override)", key);
                skipped += 1;
                skipped_keys.push(key);
                continue;
            }

            // Check if key exists
            let existing = self.get(&key).await?;

            if existing.is_some() {
                // Update existing remote config
                self.set_with_source(&key, &value, ConfigSource::Remote).await?;
                updated += 1;
            } else {
                // Add new config
                self.set_with_source(&key, &value, ConfigSource::Remote).await?;
                added += 1;
            }
        }

        info!(
            "Merged remote config: {} added, {} updated, {} skipped (local overrides)",
            added, updated, skipped
        );

        Ok(MergeResult {
            added,
            updated,
            skipped,
            skipped_keys,
        })
    }

    /// Delete a configuration entry.
    pub async fn delete(&self, key: &str) -> StorageResult<bool> {
        let key = key.to_string();
        self.db
            .with_connection(move |conn| {
                let count = conn
                    .execute("DELETE FROM agent_config WHERE key = ?", [&key])
                    .map_err(|e| StorageError::Query(format!("Failed to delete config: {}", e)))?;

                if count > 0 {
                    info!("Deleted config key: {}", key);
                }
                Ok(count > 0)
            })
            .await
    }

    /// Delete all remote configuration (keep local overrides).
    pub async fn delete_remote_config(&self) -> StorageResult<usize> {
        self.db
            .with_connection(|conn| {
                let count = conn
                    .execute("DELETE FROM agent_config WHERE source = 'remote'", [])
                    .map_err(|e| StorageError::Query(format!("Failed to delete remote config: {}", e)))?;

                info!("Deleted {} remote config entries", count);
                Ok(count)
            })
            .await
    }

    /// Check if a key has a local override.
    pub async fn has_local_override(&self, key: &str) -> StorageResult<bool> {
        let entry = self.get(key).await?;
        Ok(entry.map(|e| e.source == ConfigSource::Local).unwrap_or(false))
    }

    /// Count configuration entries.
    pub async fn count(&self) -> StorageResult<i64> {
        self.db
            .with_connection(|conn| {
                let count: i64 = conn
                    .query_row("SELECT COUNT(*) FROM agent_config", [], |row| row.get(0))
                    .map_err(|e| StorageError::Query(format!("Failed to count config: {}", e)))?;
                Ok(count)
            })
            .await
    }

    /// Convert a database row to a ConfigEntry.
    fn row_to_config_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<ConfigEntry> {
        let source_str: String = row.get(4)?;
        let source = ConfigSource::from_str(&source_str).unwrap_or(ConfigSource::Local);

        let updated_at_str: String = row.get(2)?;
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let synced_at_str: Option<String> = row.get(3)?;
        let synced_at = synced_at_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        Ok(ConfigEntry {
            key: row.get(0)?,
            value: row.get(1)?,
            updated_at,
            synced_at,
            source,
        })
    }
}

use rusqlite::OptionalExtension;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, crate::Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = crate::Database::open(config, &key_manager).unwrap();

        (temp_dir, db)
    }

    #[tokio::test]
    async fn test_set_and_get() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("test_key", "test_value").await.unwrap();

        let entry = repo.get("test_key").await.unwrap().unwrap();
        assert_eq!(entry.key, "test_key");
        assert_eq!(entry.value, "test_value");
        assert_eq!(entry.source, ConfigSource::Local);
    }

    #[tokio::test]
    async fn test_set_with_source() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set_with_source("remote_key", "remote_value", ConfigSource::Remote)
            .await
            .unwrap();

        let entry = repo.get("remote_key").await.unwrap().unwrap();
        assert_eq!(entry.source, ConfigSource::Remote);
        assert!(entry.synced_at.is_some());
    }

    #[tokio::test]
    async fn test_get_nonexistent() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        let result = repo.get("nonexistent").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_get_typed() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("int_key", "42").await.unwrap();
        repo.set("bool_key", "true").await.unwrap();
        repo.set("json_key", r#"["a", "b", "c"]"#).await.unwrap();

        let int_val: Option<i32> = repo.get_typed("int_key").await.unwrap();
        assert_eq!(int_val, Some(42));

        let bool_val: Option<bool> = repo.get_typed("bool_key").await.unwrap();
        assert_eq!(bool_val, Some(true));

        let vec_val: Option<Vec<String>> = repo.get_typed("json_key").await.unwrap();
        assert_eq!(vec_val, Some(vec!["a".to_string(), "b".to_string(), "c".to_string()]));
    }

    #[tokio::test]
    async fn test_get_or_default() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        let val: i32 = repo.get_or_default("nonexistent").await.unwrap();
        assert_eq!(val, 0);

        repo.set("existing", "100").await.unwrap();
        let val: i32 = repo.get_or_default("existing").await.unwrap();
        assert_eq!(val, 100);
    }

    #[tokio::test]
    async fn test_get_all() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("key1", "value1").await.unwrap();
        repo.set("key2", "value2").await.unwrap();

        let entries = repo.get_all().await.unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[tokio::test]
    async fn test_get_all_map() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("key1", "value1").await.unwrap();
        repo.set("key2", "value2").await.unwrap();

        let map = repo.get_all_map().await.unwrap();
        assert_eq!(map.get("key1"), Some(&"value1".to_string()));
        assert_eq!(map.get("key2"), Some(&"value2".to_string()));
    }

    #[tokio::test]
    async fn test_get_local_overrides() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("local_key", "local_value").await.unwrap();
        repo.set_with_source("remote_key", "remote_value", ConfigSource::Remote)
            .await
            .unwrap();

        let overrides = repo.get_local_overrides().await.unwrap();
        assert_eq!(overrides.len(), 1);
        assert_eq!(overrides[0].key, "local_key");
    }

    #[tokio::test]
    async fn test_merge_remote_config() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        // Set a local override
        repo.set("local_override", "local_value").await.unwrap();

        // Set an existing remote config
        repo.set_with_source("existing_remote", "old_value", ConfigSource::Remote)
            .await
            .unwrap();

        // Merge remote config
        let mut remote = HashMap::new();
        remote.insert("local_override".to_string(), "should_be_skipped".to_string());
        remote.insert("existing_remote".to_string(), "new_value".to_string());
        remote.insert("new_key".to_string(), "new_value".to_string());

        let result = repo.merge_remote_config(remote).await.unwrap();

        assert_eq!(result.added, 1);
        assert_eq!(result.updated, 1);
        assert_eq!(result.skipped, 1);
        assert!(result.skipped_keys.contains(&"local_override".to_string()));

        // Verify local override preserved
        let entry = repo.get("local_override").await.unwrap().unwrap();
        assert_eq!(entry.value, "local_value");
        assert_eq!(entry.source, ConfigSource::Local);

        // Verify remote updated
        let entry = repo.get("existing_remote").await.unwrap().unwrap();
        assert_eq!(entry.value, "new_value");

        // Verify new key added
        let entry = repo.get("new_key").await.unwrap().unwrap();
        assert_eq!(entry.value, "new_value");
        assert_eq!(entry.source, ConfigSource::Remote);
    }

    #[tokio::test]
    async fn test_delete() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("to_delete", "value").await.unwrap();
        assert!(repo.get("to_delete").await.unwrap().is_some());

        let deleted = repo.delete("to_delete").await.unwrap();
        assert!(deleted);
        assert!(repo.get("to_delete").await.unwrap().is_none());

        // Delete non-existent
        let deleted = repo.delete("nonexistent").await.unwrap();
        assert!(!deleted);
    }

    #[tokio::test]
    async fn test_delete_remote_config() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("local_key", "local").await.unwrap();
        repo.set_with_source("remote1", "value1", ConfigSource::Remote)
            .await
            .unwrap();
        repo.set_with_source("remote2", "value2", ConfigSource::Remote)
            .await
            .unwrap();

        let deleted = repo.delete_remote_config().await.unwrap();
        assert_eq!(deleted, 2);

        // Local should remain
        assert!(repo.get("local_key").await.unwrap().is_some());
        assert!(repo.get("remote1").await.unwrap().is_none());
        assert!(repo.get("remote2").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_has_local_override() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        repo.set("local_key", "local").await.unwrap();
        repo.set_with_source("remote_key", "remote", ConfigSource::Remote)
            .await
            .unwrap();

        assert!(repo.has_local_override("local_key").await.unwrap());
        assert!(!repo.has_local_override("remote_key").await.unwrap());
        assert!(!repo.has_local_override("nonexistent").await.unwrap());
    }

    #[tokio::test]
    async fn test_count() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = ConfigRepository::new(&db);

        assert_eq!(repo.count().await.unwrap(), 0);

        repo.set("key1", "value1").await.unwrap();
        repo.set("key2", "value2").await.unwrap();

        assert_eq!(repo.count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_config_entry_parse() {
        let entry = ConfigEntry::local("key", r#"{"name": "test", "count": 42}"#);

        #[derive(Deserialize, PartialEq, Debug)]
        struct TestStruct {
            name: String,
            count: i32,
        }

        let parsed: Option<TestStruct> = entry.parse();
        assert!(parsed.is_some());
        let parsed = parsed.unwrap();
        assert_eq!(parsed.name, "test");
        assert_eq!(parsed.count, 42);
    }

    #[tokio::test]
    async fn test_config_entry_is_local_override() {
        let local = ConfigEntry::local("key", "value");
        assert!(local.is_local_override());

        let remote = ConfigEntry::remote("key", "value");
        assert!(!remote.is_local_override());
    }

    #[tokio::test]
    async fn test_config_source_conversion() {
        assert_eq!(ConfigSource::Local.as_str(), "local");
        assert_eq!(ConfigSource::Remote.as_str(), "remote");

        assert_eq!(ConfigSource::from_str("local"), Some(ConfigSource::Local));
        assert_eq!(ConfigSource::from_str("remote"), Some(ConfigSource::Remote));
        assert_eq!(ConfigSource::from_str("invalid"), None);
    }
}
