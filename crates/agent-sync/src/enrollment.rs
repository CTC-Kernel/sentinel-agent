//! Agent enrollment with the SaaS platform.
//!
//! This module implements the enrollment flow where an agent registers itself
//! with the Sentinel GRC SaaS using a registration token and receives
//! credentials for mTLS communication.
//!
//! # Enrollment Flow
//!
//! 1. Administrator generates a registration token in the SaaS console
//! 2. Token is placed in agent configuration (`enrollment_token` field)
//! 3. Agent starts and detects it's not enrolled (no stored credentials)
//! 4. Agent calls `/v1/agents/enroll` with the token
//! 5. SaaS validates token and returns agent credentials (ID, certificate)
//! 6. Agent stores credentials securely in the encrypted database
//! 7. Subsequent restarts use stored credentials (no re-enrollment)

use crate::client::HttpClient;
use crate::credentials::CredentialsRepository;
use crate::error::{SyncError, SyncResult};
use crate::types::{EnrollmentRequest, StoredCredentials};
use agent_common::config::AgentConfig;
use agent_common::constants::AGENT_VERSION;
use agent_storage::Database;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Enrollment manager for agent registration.
pub struct EnrollmentManager<'a> {
    config: &'a AgentConfig,
    db: &'a Database,
}

impl<'a> EnrollmentManager<'a> {
    /// Create a new enrollment manager.
    pub fn new(config: &'a AgentConfig, db: &'a Database) -> Self {
        Self { config, db }
    }

    /// Ensure the agent is enrolled.
    ///
    /// This is the main entry point for enrollment logic:
    /// - If already enrolled, returns the stored credentials
    /// - If not enrolled and token is provided, performs enrollment
    /// - If not enrolled and no token, returns an error
    ///
    /// # Returns
    /// - `Ok(credentials)` if enrolled (existing or new)
    /// - `Err(SyncError::NotEnrolled)` if no token provided
    /// - `Err(...)` for other errors
    pub async fn ensure_enrolled(&self) -> SyncResult<StoredCredentials> {
        let credentials_repo = CredentialsRepository::new(self.db);

        // Check if already enrolled
        if let Some(credentials) = credentials_repo.load().await? {
            info!("Agent already enrolled with ID: {}", credentials.agent_id);

            // Check certificate expiration
            if credentials.is_certificate_expired() {
                warn!(
                    "Certificate expired at {}",
                    credentials.certificate_expires_at
                );
                warn!("Certificate has expired. Agent needs re-enrollment.");
                return Err(SyncError::Certificate("Agent certificate has expired. Re-enrollment required.".to_string()));
            } else if credentials.certificate_expires_within(30) {
                warn!(
                    "Certificate expires soon ({}), renewal recommended",
                    credentials.certificate_expires_at
                );
            }

            return Ok(credentials);
        }

        // Not enrolled - need enrollment token
        let token = self
            .config
            .enrollment_token
            .as_ref()
            .ok_or_else(|| SyncError::NotEnrolled)?;

        info!("Agent not enrolled. Starting enrollment with token.");

        // Perform enrollment
        let credentials = self.enroll(token).await?;

        // Store credentials
        credentials_repo.store(&credentials).await?;

        info!("Enrollment successful. Agent ID: {}", credentials.agent_id);
        Ok(credentials)
    }

    /// Perform enrollment with the SaaS.
    async fn enroll(&self, token: &str) -> SyncResult<StoredCredentials> {
        let client = HttpClient::for_enrollment(self.config)?;

        // Gather system information
        let hostname = get_hostname();
        let os = get_os_name();
        let os_version = get_os_version();
        let machine_id = get_machine_id();

        debug!(
            "Enrolling agent: hostname={}, os={}, os_version={}, machine_id={:?}",
            hostname, os, os_version, machine_id
        );

        let request = EnrollmentRequest {
            enrollment_token: token.to_string(),
            hostname,
            os,
            os_version,
            agent_version: AGENT_VERSION.to_string(),
            machine_id,
        };

        // Call enrollment endpoint
        let result: crate::types::EnrollmentResult = client
            .post_json_with_token("/v1/agents/enroll", &request, token)
            .await?;

        let response = match result {
            crate::types::EnrollmentResult::Success(r) => r,
            crate::types::EnrollmentResult::AlreadyEnrolled {
                status: _,
                message,
                agent_id,
                ..
            } => {
                // For already enrolled agents, we can't proceed without certificates.
                // The user needs to re-enroll (wipe DB) or recover certificates.
                // Returning a specific error helps the UI/CLI show a better message.
                tracing::error!("Agent already enrolled: {} (ID: {})", message, agent_id);
                return Err(SyncError::AlreadyEnrolled(agent_id.to_string()));
            }
        };

        debug!(
            "Enrollment response: agent_id={}, org_id={}, cert_expires={}",
            response.agent_id, response.organization_id, response.certificate_expires_at
        );

        // Convert to stored credentials
        let credentials = StoredCredentials::from_enrollment(response);

        Ok(credentials)
    }

    /// Check if the agent is enrolled.
    pub async fn is_enrolled(&self) -> SyncResult<bool> {
        let credentials_repo = CredentialsRepository::new(self.db);
        credentials_repo.is_enrolled().await
    }

    /// Get the agent ID if enrolled.
    pub async fn get_agent_id(&self) -> SyncResult<Option<Uuid>> {
        let credentials_repo = CredentialsRepository::new(self.db);
        credentials_repo.get_agent_id().await
    }

    /// Get stored credentials if enrolled.
    pub async fn get_credentials(&self) -> SyncResult<Option<StoredCredentials>> {
        let credentials_repo = CredentialsRepository::new(self.db);
        credentials_repo.load().await
    }

    /// Clear enrollment (for testing or unenrollment).
    pub async fn unenroll(&self) -> SyncResult<()> {
        let credentials_repo = CredentialsRepository::new(self.db);
        credentials_repo.clear().await?;
        info!("Agent unenrolled");
        Ok(())
    }
}

/// Get the system hostname.
fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Get OS name (linux, darwin, windows).
fn get_os_name() -> String {
    std::env::consts::OS.to_string()
}

/// Get OS version string.
fn get_os_version() -> String {
    let info = os_info::get();
    format!("{} ({})", info.version(), std::env::consts::ARCH)
}

/// Get machine identifier for detecting re-enrollment.
#[cfg(target_os = "linux")]
fn get_machine_id() -> Option<String> {
    std::fs::read_to_string("/etc/machine-id")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg(target_os = "windows")]
fn get_machine_id() -> Option<String> {
    // On Windows, use the MachineGuid from registry
    use std::process::Command;

    Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Cryptography",
            "/v",
            "MachineGuid",
        ])
        .output()
        .ok()
        .and_then(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Parse the registry output to extract MachineGuid
            for line in stdout.lines() {
                if line.contains("MachineGuid") {
                    if let Some(guid) = line.split_whitespace().last() {
                        return Some(guid.to_string());
                    }
                }
            }
            None
        })
}

#[cfg(target_os = "macos")]
fn get_machine_id() -> Option<String> {
    // On macOS, use IOPlatformUUID
    use std::process::Command;

    Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()
        .and_then(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("IOPlatformUUID") {
                    // Extract the UUID from format: "IOPlatformUUID" = "UUID-HERE"
                    if let Some(start) = line.find('"') {
                        let rest = line.get(start + 1..).unwrap_or("");
                        if let Some(end) = rest.rfind('"') {
                            let inner = rest.get(..end).unwrap_or("");
                            // Find the second quoted string (the UUID)
                            if let Some(uuid_start) = inner.rfind('"') {
                                return inner.get(uuid_start + 1..).map(|s| s.to_string());
                            }
                        }
                    }
                }
            }
            None
        })
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn get_machine_id() -> Option<String> {
    None
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

    fn test_config() -> AgentConfig {
        AgentConfig {
            server_url: "https://api.test.com".to_string(),
            enrollment_token: None,
            tls_verify: false,
            ..Default::default()
        }
    }

    #[test]
    fn test_get_hostname() {
        let hostname = get_hostname();
        assert!(!hostname.is_empty());
    }

    #[test]
    fn test_get_os_name() {
        let os_name = get_os_name();
        assert!(!os_name.is_empty());
        // Should be one of the known OS types
        assert!(os_name == "linux" || os_name == "macos" || os_name == "windows");
    }

    #[test]
    fn test_get_os_version() {
        let os_version = get_os_version();
        assert!(!os_version.is_empty());
        // Should contain arch
        assert!(
            os_version.contains("x86_64")
                || os_version.contains("aarch64")
                || os_version.contains("arm")
                || os_version.contains(std::env::consts::ARCH)
        );
    }

    #[tokio::test]
    async fn test_is_enrolled_false() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        assert!(!manager.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_get_agent_id_not_enrolled() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        assert!(manager.get_agent_id().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_ensure_enrolled_no_token() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        let result = manager.ensure_enrolled().await;
        assert!(matches!(result, Err(SyncError::NotEnrolled)));
    }

    #[tokio::test]
    async fn test_get_credentials_not_enrolled() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        let credentials = manager.get_credentials().await.unwrap();
        assert!(credentials.is_none());
    }

    #[tokio::test]
    async fn test_unenroll() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        // Store some credentials first
        let credentials_repo = CredentialsRepository::new(&db);
        let credentials = StoredCredentials {
            agent_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            client_certificate: "cert".to_string(),
            client_private_key: "key".to_string(),
            certificate_expires_at: chrono::Utc::now() + chrono::Duration::days(365),
            server_fingerprints: vec![],
            enrolled_at: chrono::Utc::now(),
        };
        credentials_repo.store(&credentials).await.unwrap();

        assert!(manager.is_enrolled().await.unwrap());

        manager.unenroll().await.unwrap();

        assert!(!manager.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_ensure_enrolled_uses_stored_credentials() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let manager = EnrollmentManager::new(&config, &db);

        // Store credentials
        let credentials_repo = CredentialsRepository::new(&db);
        let stored = StoredCredentials {
            agent_id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            client_certificate: "cert".to_string(),
            client_private_key: "key".to_string(),
            certificate_expires_at: chrono::Utc::now() + chrono::Duration::days(365),
            server_fingerprints: vec![],
            enrolled_at: chrono::Utc::now(),
        };
        credentials_repo.store(&stored).await.unwrap();

        // ensure_enrolled should return stored credentials without calling API
        let result = manager.ensure_enrolled().await.unwrap();
        assert_eq!(result.agent_id, stored.agent_id);
    }
}
