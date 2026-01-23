//! Credential storage repository.
//!
//! This module handles secure storage and retrieval of enrollment credentials
//! using the agent_config table in the encrypted SQLite database.

use crate::error::{SyncError, SyncResult};
use crate::types::StoredCredentials;
use agent_storage::Database;
use chrono::{DateTime, Utc};
use tracing::{debug, info};
use uuid::Uuid;

/// Key names for credentials stored in agent_config table.
mod keys {
    pub const AGENT_ID: &str = "credentials.agent_id";
    pub const ORGANIZATION_ID: &str = "credentials.organization_id";
    pub const CLIENT_CERTIFICATE: &str = "credentials.client_certificate";
    pub const CLIENT_PRIVATE_KEY: &str = "credentials.client_private_key";
    pub const CERTIFICATE_EXPIRES_AT: &str = "credentials.certificate_expires_at";
    pub const SERVER_FINGERPRINTS: &str = "credentials.server_fingerprints";
    pub const ENROLLED_AT: &str = "credentials.enrolled_at";
}

/// Repository for managing agent credentials.
pub struct CredentialsRepository<'a> {
    db: &'a Database,
}

impl<'a> CredentialsRepository<'a> {
    /// Create a new credentials repository.
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Store credentials after successful enrollment.
    pub async fn store(&self, credentials: &StoredCredentials) -> SyncResult<()> {
        debug!("Storing credentials for agent {}", credentials.agent_id);

        self.db
            .with_connection(|conn| {
                // Store all credential fields
                let fields = [
                    (keys::AGENT_ID, credentials.agent_id.to_string()),
                    (
                        keys::ORGANIZATION_ID,
                        credentials.organization_id.to_string(),
                    ),
                    (
                        keys::CLIENT_CERTIFICATE,
                        credentials.client_certificate.clone(),
                    ),
                    (
                        keys::CLIENT_PRIVATE_KEY,
                        credentials.client_private_key.clone(),
                    ),
                    (
                        keys::CERTIFICATE_EXPIRES_AT,
                        credentials.certificate_expires_at.to_rfc3339(),
                    ),
                    (
                        keys::SERVER_FINGERPRINTS,
                        serde_json::to_string(&credentials.server_fingerprints)
                            .map_err(|e| agent_storage::StorageError::Query(e.to_string()))?,
                    ),
                    (keys::ENROLLED_AT, credentials.enrolled_at.to_rfc3339()),
                ];

                for (key, value) in fields {
                    conn.execute(
                        r#"
                        INSERT INTO agent_config (key, value, source)
                        VALUES (?1, ?2, 'local')
                        ON CONFLICT (key) DO UPDATE SET
                            value = excluded.value,
                            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                        "#,
                        [key, &value],
                    )
                    .map_err(|e| {
                        agent_storage::StorageError::Query(format!(
                            "Failed to store credential {}: {}",
                            key, e
                        ))
                    })?;
                }

                Ok(())
            })
            .await?;

        info!("Credentials stored successfully for agent {}", credentials.agent_id);
        Ok(())
    }

    /// Load stored credentials.
    ///
    /// Returns `None` if agent is not enrolled.
    pub async fn load(&self) -> SyncResult<Option<StoredCredentials>> {
        debug!("Loading credentials from database");

        Ok(self.db
            .with_connection(|conn| {
                // Check if agent_id exists (indicates enrollment)
                let agent_id_str: Option<String> = conn
                    .query_row(
                        "SELECT value FROM agent_config WHERE key = ?",
                        [keys::AGENT_ID],
                        |row| row.get(0),
                    )
                    .ok();

                let Some(agent_id_str) = agent_id_str else {
                    debug!("No credentials found - agent not enrolled");
                    return Ok(None);
                };

                // Load all credential fields
                let get_value = |key: &str| -> agent_storage::StorageResult<String> {
                    conn.query_row(
                        "SELECT value FROM agent_config WHERE key = ?",
                        [key],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        agent_storage::StorageError::Query(format!(
                            "Missing credential field {}: {}",
                            key, e
                        ))
                    })
                };

                let agent_id = Uuid::parse_str(&agent_id_str).map_err(|e| {
                    agent_storage::StorageError::Query(format!("Invalid agent_id: {}", e))
                })?;

                let organization_id =
                    Uuid::parse_str(&get_value(keys::ORGANIZATION_ID)?).map_err(|e| {
                        agent_storage::StorageError::Query(format!("Invalid organization_id: {}", e))
                    })?;

                let certificate_expires_at =
                    DateTime::parse_from_rfc3339(&get_value(keys::CERTIFICATE_EXPIRES_AT)?)
                        .map_err(|e| {
                            agent_storage::StorageError::Query(format!(
                                "Invalid certificate_expires_at: {}",
                                e
                            ))
                        })?
                        .with_timezone(&Utc);

                let enrolled_at = DateTime::parse_from_rfc3339(&get_value(keys::ENROLLED_AT)?)
                    .map_err(|e| {
                        agent_storage::StorageError::Query(format!("Invalid enrolled_at: {}", e))
                    })?
                    .with_timezone(&Utc);

                let server_fingerprints: Vec<String> =
                    serde_json::from_str(&get_value(keys::SERVER_FINGERPRINTS)?).map_err(|e| {
                        agent_storage::StorageError::Query(format!(
                            "Invalid server_fingerprints JSON: {}",
                            e
                        ))
                    })?;

                let credentials = StoredCredentials {
                    agent_id,
                    organization_id,
                    client_certificate: get_value(keys::CLIENT_CERTIFICATE)?,
                    client_private_key: get_value(keys::CLIENT_PRIVATE_KEY)?,
                    certificate_expires_at,
                    server_fingerprints,
                    enrolled_at,
                };

                debug!("Credentials loaded for agent {}", credentials.agent_id);
                Ok(Some(credentials))
            })
            .await?)
    }

    /// Check if the agent is enrolled.
    pub async fn is_enrolled(&self) -> SyncResult<bool> {
        self.db
            .with_connection(|conn| {
                let count: i32 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM agent_config WHERE key = ?",
                        [keys::AGENT_ID],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        agent_storage::StorageError::Query(format!(
                            "Failed to check enrollment: {}",
                            e
                        ))
                    })?;

                Ok(count > 0)
            })
            .await
            .map_err(SyncError::from)
    }

    /// Get the agent ID if enrolled.
    pub async fn get_agent_id(&self) -> SyncResult<Option<Uuid>> {
        self.db
            .with_connection(|conn| {
                let agent_id_str: Option<String> = conn
                    .query_row(
                        "SELECT value FROM agent_config WHERE key = ?",
                        [keys::AGENT_ID],
                        |row| row.get(0),
                    )
                    .ok();

                match agent_id_str {
                    Some(s) => {
                        let id = Uuid::parse_str(&s).map_err(|e| {
                            agent_storage::StorageError::Query(format!("Invalid agent_id: {}", e))
                        })?;
                        Ok(Some(id))
                    }
                    None => Ok(None),
                }
            })
            .await
            .map_err(SyncError::from)
    }

    /// Update the client certificate (for renewal).
    pub async fn update_certificate(
        &self,
        certificate: &str,
        private_key: &str,
        expires_at: DateTime<Utc>,
    ) -> SyncResult<()> {
        debug!("Updating certificate (expires: {})", expires_at);

        self.db
            .with_connection(|conn| {
                let updates = [
                    (keys::CLIENT_CERTIFICATE, certificate.to_string()),
                    (keys::CLIENT_PRIVATE_KEY, private_key.to_string()),
                    (keys::CERTIFICATE_EXPIRES_AT, expires_at.to_rfc3339()),
                ];

                for (key, value) in updates {
                    let rows = conn
                        .execute(
                            r#"
                            UPDATE agent_config
                            SET value = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                            WHERE key = ?1
                            "#,
                            [key, &value],
                        )
                        .map_err(|e| {
                            agent_storage::StorageError::Query(format!(
                                "Failed to update {}: {}",
                                key, e
                            ))
                        })?;

                    if rows == 0 {
                        return Err(agent_storage::StorageError::Query(format!(
                            "Credential key {} not found",
                            key
                        )));
                    }
                }

                Ok(())
            })
            .await?;

        info!("Certificate updated successfully");
        Ok(())
    }

    /// Update server fingerprints (for certificate rotation).
    pub async fn update_server_fingerprints(&self, fingerprints: &[String]) -> SyncResult<()> {
        debug!("Updating server fingerprints: {:?}", fingerprints);

        let json = serde_json::to_string(fingerprints)?;

        self.db
            .with_connection(move |conn| {
                let rows = conn
                    .execute(
                        r#"
                        UPDATE agent_config
                        SET value = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                        WHERE key = ?1
                        "#,
                        [keys::SERVER_FINGERPRINTS, &json],
                    )
                    .map_err(|e| {
                        agent_storage::StorageError::Query(format!(
                            "Failed to update server fingerprints: {}",
                            e
                        ))
                    })?;

                if rows == 0 {
                    return Err(agent_storage::StorageError::Query(
                        "Server fingerprints key not found".to_string(),
                    ));
                }

                Ok(())
            })
            .await?;

        info!("Server fingerprints updated");
        Ok(())
    }

    /// Clear all credentials (for unenrollment).
    pub async fn clear(&self) -> SyncResult<()> {
        debug!("Clearing all credentials");

        self.db
            .with_connection(|conn| {
                conn.execute(
                    "DELETE FROM agent_config WHERE key LIKE 'credentials.%'",
                    [],
                )
                .map_err(|e| {
                    agent_storage::StorageError::Query(format!("Failed to clear credentials: {}", e))
                })?;

                Ok(())
            })
            .await?;

        info!("Credentials cleared");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{Database, DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, db)
    }

    fn create_test_credentials() -> StoredCredentials {
        StoredCredentials {
            agent_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            client_certificate: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----"
                .to_string(),
            client_private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----"
                .to_string(),
            certificate_expires_at: Utc::now() + chrono::Duration::days(365),
            server_fingerprints: vec!["sha256:abc123".to_string()],
            enrolled_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_store_and_load_credentials() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let loaded = repo.load().await.unwrap().unwrap();
        assert_eq!(loaded.agent_id, credentials.agent_id);
        assert_eq!(loaded.organization_id, credentials.organization_id);
        assert_eq!(loaded.client_certificate, credentials.client_certificate);
    }

    #[tokio::test]
    async fn test_is_enrolled_false() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        assert!(!repo.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_is_enrolled_true() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        assert!(repo.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_get_agent_id() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        assert!(repo.get_agent_id().await.unwrap().is_none());

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let agent_id = repo.get_agent_id().await.unwrap().unwrap();
        assert_eq!(agent_id, credentials.agent_id);
    }

    #[tokio::test]
    async fn test_update_certificate() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let new_expires = Utc::now() + chrono::Duration::days(730);
        repo.update_certificate("new-cert", "new-key", new_expires)
            .await
            .unwrap();

        let loaded = repo.load().await.unwrap().unwrap();
        assert_eq!(loaded.client_certificate, "new-cert");
        assert_eq!(loaded.client_private_key, "new-key");
    }

    #[tokio::test]
    async fn test_update_server_fingerprints() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let new_fps = vec!["sha256:new1".to_string(), "sha256:new2".to_string()];
        repo.update_server_fingerprints(&new_fps).await.unwrap();

        let loaded = repo.load().await.unwrap().unwrap();
        assert_eq!(loaded.server_fingerprints, new_fps);
    }

    #[tokio::test]
    async fn test_clear_credentials() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();
        assert!(repo.is_enrolled().await.unwrap());

        repo.clear().await.unwrap();
        assert!(!repo.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_load_not_enrolled() {
        let (_temp_dir, db) = create_test_db().await;
        let repo = CredentialsRepository::new(&db);

        let loaded = repo.load().await.unwrap();
        assert!(loaded.is_none());
    }
}
