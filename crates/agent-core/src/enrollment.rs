// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Agent enrollment and API client initialization.

use crate::api_client::{ApiClient, EnrollmentRequest};
use crate::system_utils::{get_machine_id, get_os_version};
use agent_common::constants::AGENT_VERSION;
use agent_common::error::CommonError;
use agent_common::jwt::parse_organization_id_from_token;
use agent_sync::EnrollmentManager;
use tracing::{error, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Initialize the API client.
    pub(crate) async fn init_api_client(&self) -> Result<(), CommonError> {
        let client = ApiClient::new(&self.config)?;
        let mut api_client = self.api_client.write().await;
        *api_client = Some(client);
        Ok(())
    }

    /// Enroll the agent if not already enrolled.
    pub(crate) async fn ensure_enrolled(&self) -> Result<(), CommonError> {
        let mut api_client = self.api_client.write().await;
        let client = api_client
            .as_mut()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        // Check if already enrolled
        if client.agent_id().is_some() {
            return Ok(());
        }

        // Check if we have an agent ID in config
        if let Some(ref agent_id) = self.config.agent_id {
            client.set_agent_id(agent_id.clone());

            // Try to restore organization ID from stored credentials
            if let Some(ref db) = self.db {
                let auth_client =
                    agent_sync::AuthenticatedClient::new(self.config.clone(), db.clone());
                if let Ok(organization_id) = auth_client.organization_id().await {
                    client.set_organization_id(organization_id.to_string());
                    info!("Restored organization ID: {}", organization_id);
                }
            }

            info!("Using existing agent ID: {}", agent_id);
            return Ok(());
        }

        // Need to enroll
        let enrollment_token = self.config.enrollment_token.as_ref().ok_or_else(|| {
            CommonError::config(
                "No agent ID or enrollment token. Please configure an enrollment token.",
            )
        })?;

        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let os = std::env::consts::OS.to_string();
        let os_version = get_os_version();
        let machine_id = get_machine_id();

        let request = EnrollmentRequest {
            enrollment_token: enrollment_token.clone(),
            hostname,
            os,
            os_version,
            machine_id,
            agent_version: AGENT_VERSION.to_string(),
            organization_id: parse_organization_id_from_token(enrollment_token),
        };

        let response = client.enroll(request).await?;

        // Store credentials and organization ID in the already-held client reference
        client.set_credentials(
            response.client_certificate.clone(),
            response.client_key.clone(),
        );
        client.set_organization_id(response.organization_id.clone());

        // Drop the api_client write lock before acquiring heartbeat lock
        drop(api_client);

        // Update heartbeat interval from server config
        let mut interval = self.heartbeat_interval_secs.write().await;
        *interval = response.config.heartbeat_interval_secs.clamp(15, 3600);

        info!(
            "Enrolled successfully. Agent ID: {}, Organization ID: {}, Heartbeat interval: {}s",
            response.agent_id, response.organization_id, response.config.heartbeat_interval_secs
        );

        Ok(())
    }

    /// Attempt automatic re-enrollment after persistent authentication failures.
    ///
    /// This method:
    /// 1. Clears stale credentials from the encrypted database
    /// 2. Performs a fresh enrollment using the enrollment token
    /// 3. Updates the API client with new credentials
    /// 4. Invalidates the authenticated client cache (forces refresh)
    /// 5. Re-initializes sync services
    ///
    /// Returns `Ok(true)` on successful re-enrollment, `Ok(false)` if re-enrollment
    /// is not possible (no token), or `Err` on failure.
    pub(crate) async fn attempt_re_enrollment(&self) -> Result<bool, CommonError> {
        let db = match &self.db {
            Some(db) => db,
            None => {
                warn!("Cannot re-enroll: no database available");
                return Ok(false);
            }
        };

        let has_token = self
            .config
            .enrollment_token
            .as_ref()
            .is_some_and(|t| !t.trim().is_empty());
        if !has_token {
            warn!(
                "Cannot re-enroll: no enrollment_token in configuration. \
                 Please add a valid enrollment token to the agent config and restart."
            );
            #[cfg(target_os = "windows")]
            warn!(
                "Config file location: C:\\ProgramData\\Sentinel\\agent.json — \
                 set the \"enrollment_token\" field to the token from the SaaS console."
            );
            #[cfg(target_os = "linux")]
            warn!(
                "Config file location: /etc/sentinel/agent.json — \
                 set the \"enrollment_token\" field to the token from the SaaS console."
            );
            return Ok(false);
        }

        info!("Starting automatic re-enrollment...");

        // Use the sync-layer EnrollmentManager for the heavy lifting
        let manager = EnrollmentManager::new(&self.config, db);
        let credentials = match manager.re_enroll().await {
            Ok(creds) => creds,
            Err(e) => {
                error!("Re-enrollment failed: {}", e);
                return Err(CommonError::network(format!("Re-enrollment failed: {}", e)));
            }
        };

        // Update the API client with new credentials
        {
            let mut api_client = self.api_client.write().await;
            if let Some(ref mut client) = *api_client {
                client.set_agent_id(credentials.agent_id.to_string());
                client.set_credentials(
                    credentials.client_certificate.clone(),
                    credentials.client_private_key.clone(),
                );
                client.set_organization_id(credentials.organization_id.to_string());
            }
        }

        // Invalidate the authenticated client cache so it picks up new creds
        if let Some(ref auth_client) = self.authenticated_client {
            auth_client.invalidate().await;
        }

        // Re-initialize sync services with fresh credentials
        self.init_sync_services().await;

        info!(
            "Re-enrollment complete. New agent ID: {}, org: {}",
            credentials.agent_id, credentials.organization_id
        );

        Ok(true)
    }
}
