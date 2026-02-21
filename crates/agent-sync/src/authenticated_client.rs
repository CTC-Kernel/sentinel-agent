//! Authenticated HTTP client with mTLS and certificate management.
//!
//! This module provides an authenticated client that:
//! - Uses mTLS for all communication (NFR-S1)
//! - Manages certificate lifecycle (renewal before expiry)
//! - Handles authentication errors gracefully

use crate::client::HttpClient;
use crate::credentials::CredentialsRepository;
use crate::error::{SyncError, SyncResult};
use crate::types::{
    CertificateRenewalRequest, CertificateRenewalResponse, GenericSyncResponse,
    IncidentReportResponse, SecurityIncidentReport, StoredCredentials,
    VulnerabilityFinding, VulnerabilityUploadRequest, VulnerabilityUploadResponse,
    // Playbook sync
    PlaybookPayload, PlaybookSyncRequest, PlaybookSyncResponse,
    PlaybookLogPayload, PlaybookLogSyncRequest,
    // Detection rule sync
    DetectionRulePayload, DetectionRuleSyncRequest,
    DetectionMatchPayload, DetectionMatchSyncRequest,
    // Risk sync
    RiskPayload, RiskSyncRequest, RiskSyncResponse,
    // Asset sync
    AssetPayload, AssetSyncRequest, AssetSyncResponse,
    // KPI sync
    KpiSnapshotPayload, KpiSyncRequest,
    // Alert rule sync
    AlertRulePayload, AlertRuleSyncRequest,
    // Webhook sync
    WebhookPayload, WebhookSyncRequest,
    // FIM sync
    FimAlertPayload, FimAlertSyncRequest,
    // USB sync
    UsbEventPayload, UsbEventSyncRequest,
    // Software sync
    SoftwarePayload, SoftwareSyncRequest, SoftwareSyncResponse,
    // Network sync
    NetworkSnapshotRequest, NetworkSnapshotResponse,
    // Discovered asset sync
    DiscoveredAssetPayload, DiscoveredAssetResponse,
    // Log upload
    LogEntryPayload, LogUploadRequest, LogUploadResponse,
};
use agent_common::config::AgentConfig;
use agent_storage::Database;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Days before expiry to trigger certificate renewal.
const RENEWAL_THRESHOLD_DAYS: i64 = 30;

/// Authenticated HTTP client with automatic certificate management.
///
/// This client wraps `HttpClient` and provides:
/// - Automatic mTLS configuration using stored credentials
/// - Certificate expiration checking
/// - Automatic certificate renewal when approaching expiry
pub struct AuthenticatedClient {
    config: AgentConfig,
    db: Arc<Database>,
    /// Cached mTLS client and credentials.
    state: RwLock<ClientState>,
}

/// Internal state for the authenticated client.
struct ClientState {
    /// The mTLS HTTP client.
    client: Option<HttpClient>,
    /// Cached credentials.
    credentials: Option<StoredCredentials>,
    /// When the client was last refreshed.
    last_refresh: Option<DateTime<Utc>>,
}

impl AuthenticatedClient {
    /// Create a new authenticated client.
    ///
    /// The client will load credentials from the database and create
    /// an mTLS client on first use.
    pub fn new(config: AgentConfig, db: Arc<Database>) -> Self {
        Self {
            config,
            db,
            state: RwLock::new(ClientState {
                client: None,
                credentials: None,
                last_refresh: None,
            }),
        }
    }

    /// Get the agent ID from stored credentials.
    pub async fn agent_id(&self) -> SyncResult<Uuid> {
        let credentials = self.ensure_credentials().await?;
        Ok(credentials.agent_id)
    }

    /// Get the organization ID from stored credentials.
    pub async fn organization_id(&self) -> SyncResult<Uuid> {
        let credentials = self.ensure_credentials().await?;
        Ok(credentials.organization_id)
    }

    /// Check if the agent is enrolled.
    pub async fn is_enrolled(&self) -> SyncResult<bool> {
        let repo = CredentialsRepository::new(&self.db);
        repo.is_enrolled().await
    }

    /// Get the certificate expiration date.
    pub async fn certificate_expires_at(&self) -> SyncResult<DateTime<Utc>> {
        let credentials = self.ensure_credentials().await?;
        Ok(credentials.certificate_expires_at)
    }

    /// Check if the certificate needs renewal.
    pub async fn needs_renewal(&self) -> SyncResult<bool> {
        let credentials = self.ensure_credentials().await?;
        Ok(credentials.certificate_expires_within(RENEWAL_THRESHOLD_DAYS))
    }

    /// Renew the client certificate.
    ///
    /// This should be called when the certificate is approaching expiry.
    /// Returns the new expiration date on success.
    pub async fn renew_certificate(&self) -> SyncResult<DateTime<Utc>> {
        let credentials = self.ensure_credentials().await?;
        let agent_id = credentials.agent_id;

        info!("Initiating certificate renewal for agent {}", agent_id);

        // Create client for renewal (uses current certificate)
        let client = self.get_client().await?;

        // Request certificate renewal
        let request = CertificateRenewalRequest {
            agent_id,
            reason: "approaching_expiry".to_string(),
        };

        let response: CertificateRenewalResponse = client
            .post_json(
                &format!("/v1/agents/{}/certificate/renew", agent_id),
                &request,
            )
            .await?;

        // Update stored credentials
        let repo = CredentialsRepository::new(&self.db);
        repo.update_certificate(
            &response.client_certificate,
            &response.client_private_key,
            response.certificate_expires_at,
        )
        .await?;

        // Update server fingerprints if provided
        if !response.server_fingerprints.is_empty() {
            repo.update_server_fingerprints(&response.server_fingerprints)
                .await?;
        }

        // Invalidate cached client to force refresh with new certificate
        {
            let mut state = self.state.write().await;
            state.client = None;
            state.credentials = None;
            state.last_refresh = None;
        }

        info!(
            "Certificate renewed successfully. New expiry: {}",
            response.certificate_expires_at
        );

        Ok(response.certificate_expires_at)
    }

    /// Check certificate and renew if needed.
    ///
    /// This is a convenience method that checks expiration and renews
    /// automatically if within the renewal threshold.
    pub async fn check_and_renew_if_needed(&self) -> SyncResult<()> {
        if self.needs_renewal().await? {
            let expires_at = self.certificate_expires_at().await?;
            warn!("Certificate expires at {}, initiating renewal", expires_at);
            self.renew_certificate().await?;
        }
        Ok(())
    }

    /// Send a POST request with JSON body.
    pub async fn post_json<T, R>(&self, path: &str, body: &T) -> SyncResult<R>
    where
        T: serde::Serialize,
        R: serde::de::DeserializeOwned,
    {
        let client = self.get_client().await?;
        client.post_json(path, body).await
    }

    /// Send a GET request.
    pub async fn get<R>(&self, path: &str) -> SyncResult<R>
    where
        R: serde::de::DeserializeOwned,
    {
        let client = self.get_client().await?;
        client.get(path).await
    }

    /// Send a GET request with ETag support for conditional fetch.
    ///
    /// Returns `Ok(None)` if the server returns 304 Not Modified.
    /// Returns `Ok(Some((response, etag)))` if the server returns new data.
    pub async fn get_with_etag<R>(
        &self,
        path: &str,
        if_none_match: Option<&str>,
    ) -> SyncResult<Option<(R, Option<String>)>>
    where
        R: serde::de::DeserializeOwned,
    {
        let client = self.get_client().await?;
        client.get_with_etag(path, if_none_match).await
    }

    /// Download binary data from a URL.
    ///
    /// Used for downloading update packages.
    pub async fn download(&self, url: &str) -> SyncResult<Vec<u8>> {
        let client = self.get_client().await?;
        client.download(url).await
    }

    // ========================================================================
    // Vulnerability and Incident Upload Methods
    // ========================================================================

    /// Upload vulnerability findings to the SaaS.
    ///
    /// Sends detected vulnerabilities to the cloud for storage and alerting.
    /// The SaaS will deduplicate by CVE+package+agent combination.
    pub async fn upload_vulnerabilities(
        &self,
        vulnerabilities: Vec<VulnerabilityFinding>,
        scan_type: &str,
    ) -> SyncResult<VulnerabilityUploadResponse> {
        if vulnerabilities.is_empty() {
            return Ok(VulnerabilityUploadResponse {
                received_count: 0,
                created_count: 0,
                updated_count: 0,
                skipped_count: 0,
            });
        }

        let agent_id = self.agent_id().await?;
        info!(
            "Uploading {} vulnerabilities for agent {}",
            vulnerabilities.len(),
            agent_id
        );

        let request = VulnerabilityUploadRequest {
            vulnerabilities,
            scan_type: scan_type.to_string(),
        };

        let response: VulnerabilityUploadResponse = self
            .post_json(
                &format!("/v1/agents/{}/vulnerabilities", agent_id),
                &request,
            )
            .await?;

        info!(
            "Vulnerability upload complete: {} created, {} updated, {} skipped",
            response.created_count, response.updated_count, response.skipped_count
        );

        Ok(response)
    }

    /// Report a security incident to the SaaS.
    ///
    /// Sends a detected security incident to the cloud for immediate alerting
    /// and potential automated response (playbook triggering).
    pub async fn report_incident(
        &self,
        incident: SecurityIncidentReport,
    ) -> SyncResult<IncidentReportResponse> {
        let agent_id = self.agent_id().await?;
        info!(
            "Reporting incident '{}' ({:?}) for agent {}",
            incident.title, incident.incident_type, agent_id
        );

        let response: IncidentReportResponse = self
            .post_json(&format!("/v1/agents/{}/incidents", agent_id), &incident)
            .await?;

        info!(
            "Incident reported: {} (playbook triggered: {})",
            response.incident_id, response.playbook_triggered
        );

        Ok(response)
    }

    /// Report multiple security incidents to the SaaS.
    ///
    /// Convenience method to report multiple incidents. Each incident
    /// is reported individually to ensure proper tracking.
    pub async fn report_incidents(
        &self,
        incidents: Vec<SecurityIncidentReport>,
    ) -> SyncResult<Vec<IncidentReportResponse>> {
        let mut responses = Vec::with_capacity(incidents.len());

        for incident in incidents {
            match self.report_incident(incident).await {
                Ok(response) => responses.push(response),
                Err(e) => {
                    warn!("Failed to report incident: {}", e);
                    // Continue with other incidents
                }
            }
        }

        Ok(responses)
    }

    /// Report the result of a command execution.
    pub async fn report_command_result(
        &self,
        command_id: &str,
        result: crate::types::CommandResultRequest,
    ) -> SyncResult<()> {
        let agent_id = self.agent_id().await?;
        debug!(
            "Reporting result for command {} on agent {}",
            command_id, agent_id
        );

        let _: serde_json::Value = self
            .post_json(
                &format!("/v1/agents/{}/commands/{}/results", agent_id, command_id),
                &result,
            )
            .await?;

        Ok(())
    }

    /// Sync local audit trail entries to the SaaS.
    pub async fn sync_audit_trail(
        &self,
        entries: Vec<crate::types::AuditTrailEntry>,
    ) -> SyncResult<u32> {
        if entries.is_empty() {
            return Ok(0);
        }

        let agent_id = self.agent_id().await?;
        debug!(
            "Syncing {} audit entries for agent {}",
            entries.len(),
            agent_id
        );

        let request = crate::types::AuditTrailSyncRequest { entries };

        let response: serde_json::Value = self
            .post_json(&format!("/v1/agents/{}/audit-trail", agent_id), &request)
            .await?;

        let received_count = response
            .get("received_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;

        Ok(received_count)
    }

    // ========================================================================
    // 9 Axes Sync Methods
    // ========================================================================

    /// Sync playbook definitions to the SaaS.
    pub async fn sync_playbooks(
        &self,
        playbooks: Vec<PlaybookPayload>,
    ) -> SyncResult<PlaybookSyncResponse> {
        if playbooks.is_empty() {
            return Ok(PlaybookSyncResponse { received_count: 0, created_count: 0, updated_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Syncing {} playbooks for agent {}", playbooks.len(), agent_id);
        let request = PlaybookSyncRequest { playbooks };
        self.post_json(&format!("/v1/agents/{}/playbooks", agent_id), &request).await
    }

    /// Sync playbook execution logs to the SaaS.
    pub async fn sync_playbook_logs(
        &self,
        entries: Vec<PlaybookLogPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if entries.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        debug!("Syncing {} playbook log entries for agent {}", entries.len(), agent_id);
        let request = PlaybookLogSyncRequest { entries };
        self.post_json(&format!("/v1/agents/{}/playbook-logs", agent_id), &request).await
    }

    /// Sync detection rule definitions to the SaaS.
    pub async fn sync_detection_rules(
        &self,
        rules: Vec<DetectionRulePayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if rules.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Syncing {} detection rules for agent {}", rules.len(), agent_id);
        let request = DetectionRuleSyncRequest { rules };
        self.post_json(&format!("/v1/agents/{}/detection-rules", agent_id), &request).await
    }

    /// Sync detection rule match events to the SaaS.
    pub async fn sync_detection_matches(
        &self,
        matches: Vec<DetectionMatchPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if matches.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        debug!("Syncing {} detection matches for agent {}", matches.len(), agent_id);
        let request = DetectionMatchSyncRequest { matches };
        self.post_json(&format!("/v1/agents/{}/detection-matches", agent_id), &request).await
    }

    /// Sync risk entries to the SaaS.
    pub async fn sync_risks(
        &self,
        risks: Vec<RiskPayload>,
    ) -> SyncResult<RiskSyncResponse> {
        if risks.is_empty() {
            return Ok(RiskSyncResponse { received_count: 0, created_count: 0, updated_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Syncing {} risk entries for agent {}", risks.len(), agent_id);
        let request = RiskSyncRequest { risks };
        self.post_json(&format!("/v1/agents/{}/risks", agent_id), &request).await
    }

    /// Sync managed assets to the SaaS.
    pub async fn sync_assets(
        &self,
        assets: Vec<AssetPayload>,
    ) -> SyncResult<AssetSyncResponse> {
        if assets.is_empty() {
            return Ok(AssetSyncResponse { received_count: 0, created_count: 0, updated_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Syncing {} managed assets for agent {}", assets.len(), agent_id);
        let request = AssetSyncRequest { assets };
        self.post_json(&format!("/v1/agents/{}/managed-assets", agent_id), &request).await
    }

    /// Sync KPI snapshots to the SaaS.
    pub async fn sync_kpi_snapshots(
        &self,
        snapshots: Vec<KpiSnapshotPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if snapshots.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        debug!("Syncing {} KPI snapshots for agent {}", snapshots.len(), agent_id);
        let request = KpiSyncRequest { snapshots };
        self.post_json(&format!("/v1/agents/{}/kpi-snapshots", agent_id), &request).await
    }

    /// Sync alert rule configurations to the SaaS.
    pub async fn sync_alert_rules(
        &self,
        rules: Vec<AlertRulePayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if rules.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        debug!("Syncing {} alert rules for agent {}", rules.len(), agent_id);
        let request = AlertRuleSyncRequest { rules };
        self.post_json(&format!("/v1/agents/{}/alert-rules", agent_id), &request).await
    }

    /// Sync webhook configurations to the SaaS.
    pub async fn sync_webhooks(
        &self,
        webhooks: Vec<WebhookPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if webhooks.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        debug!("Syncing {} webhooks for agent {}", webhooks.len(), agent_id);
        let request = WebhookSyncRequest { webhooks };
        self.post_json(&format!("/v1/agents/{}/webhooks", agent_id), &request).await
    }

    // ========================================================================
    // FIM, USB, Software, Network, Discovery, Logs Sync Methods
    // ========================================================================

    /// Upload FIM alerts to the SaaS.
    ///
    /// Sends detected file integrity changes to the cloud for storage and alerting.
    pub async fn upload_fim_alerts(
        &self,
        alerts: Vec<FimAlertPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if alerts.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Uploading {} FIM alerts for agent {}", alerts.len(), agent_id);
        let request = FimAlertSyncRequest { alerts };
        self.post_json(&format!("/v1/agents/{}/fim-alerts", agent_id), &request).await
    }

    /// Upload USB events to the SaaS.
    ///
    /// Sends USB device connect/disconnect events to the cloud for monitoring.
    pub async fn upload_usb_events(
        &self,
        events: Vec<UsbEventPayload>,
    ) -> SyncResult<GenericSyncResponse> {
        if events.is_empty() {
            return Ok(GenericSyncResponse { received_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Uploading {} USB events for agent {}", events.len(), agent_id);
        let request = UsbEventSyncRequest { events };
        self.post_json(&format!("/v1/agents/{}/usb-events", agent_id), &request).await
    }

    /// Upload software inventory to the SaaS.
    ///
    /// Sends the list of installed software for compliance and vulnerability tracking.
    pub async fn upload_software_inventory(
        &self,
        software: Vec<SoftwarePayload>,
        scan_timestamp: Option<DateTime<Utc>>,
    ) -> SyncResult<SoftwareSyncResponse> {
        if software.is_empty() {
            return Ok(SoftwareSyncResponse { received_count: 0, added_count: 0, updated_count: 0 });
        }
        let agent_id = self.agent_id().await?;
        info!("Uploading {} software items for agent {}", software.len(), agent_id);
        let request = SoftwareSyncRequest { software, scan_timestamp };
        self.post_json(&format!("/v1/agents/{}/software", agent_id), &request).await
    }

    /// Upload a network snapshot to the SaaS.
    ///
    /// Sends current network interface configuration for asset tracking.
    pub async fn upload_network_snapshot(
        &self,
        request: NetworkSnapshotRequest,
    ) -> SyncResult<NetworkSnapshotResponse> {
        let agent_id = self.agent_id().await?;
        debug!("Uploading network snapshot for agent {}", agent_id);
        self.post_json(&format!("/v1/agents/{}/network", agent_id), &request).await
    }

    /// Report a discovered asset to the SaaS.
    ///
    /// Sends a newly discovered network device for CMDB validation.
    pub async fn report_discovered_asset(
        &self,
        asset: DiscoveredAssetPayload,
    ) -> SyncResult<DiscoveredAssetResponse> {
        let agent_id = self.agent_id().await?;
        debug!("Reporting discovered asset {} for agent {}", asset.ip, agent_id);
        self.post_json(&format!("/v1/agents/{}/discovered-assets", agent_id), &asset).await
    }

    /// Upload log entries to the SaaS.
    ///
    /// Sends agent log entries for centralized monitoring and diagnostics.
    pub async fn upload_logs(
        &self,
        entries: Vec<LogEntryPayload>,
    ) -> SyncResult<LogUploadResponse> {
        if entries.is_empty() {
            return Ok(LogUploadResponse { received_count: 0, ack_id: String::new() });
        }
        let agent_id = self.agent_id().await?;
        debug!("Uploading {} log entries for agent {}", entries.len(), agent_id);
        let request = LogUploadRequest { entries, uploaded_at: Some(Utc::now()) };
        self.post_json(&format!("/v1/agents/{}/logs", agent_id), &request).await
    }

    /// Download centrally managed playbooks from the SaaS.
    pub async fn download_playbooks(&self) -> SyncResult<Vec<PlaybookPayload>> {
        let agent_id = self.agent_id().await?;
        debug!("Downloading central playbooks for agent {}", agent_id);
        self.get(&format!("/v1/agents/{}/playbooks/central", agent_id)).await
    }

    /// Download centrally managed detection rules from the SaaS.
    pub async fn download_detection_rules(&self) -> SyncResult<Vec<DetectionRulePayload>> {
        let agent_id = self.agent_id().await?;
        debug!("Downloading central detection rules for agent {}", agent_id);
        self.get(&format!("/v1/agents/{}/detection-rules/central", agent_id)).await
    }

    /// Download centrally managed alert rules from the SaaS.
    pub async fn download_alert_rules(&self) -> SyncResult<Vec<AlertRulePayload>> {
        let agent_id = self.agent_id().await?;
        debug!("Downloading central alert rules for agent {}", agent_id);
        self.get(&format!("/v1/agents/{}/alert-rules/central", agent_id)).await
    }

    /// Get or create the mTLS HTTP client.
    async fn get_client(&self) -> SyncResult<HttpClient> {
        // Check if we have a valid cached client
        {
            let state = self.state.read().await;
            if let Some(ref client) = state.client {
                // Check if credentials are still valid
                if let Some(ref creds) = state.credentials
                    && !creds.is_certificate_expired()
                {
                    return Ok(client.clone());
                }
            }
        }

        // Need to create/refresh the client
        self.refresh_client().await
    }

    /// Refresh the client with current credentials.
    ///
    /// Tries mTLS first, falls back to header-based auth (X-Agent-Certificate)
    /// if the stored certificate is not in valid PEM format.
    async fn refresh_client(&self) -> SyncResult<HttpClient> {
        let credentials = self.load_credentials().await?;

        // Check if certificate is expired
        if credentials.is_certificate_expired() {
            return Err(SyncError::Certificate(format!(
                "Client certificate expired at {}",
                credentials.certificate_expires_at
            )));
        }

        // Warn if certificate is expiring soon
        if credentials.certificate_expires_within(RENEWAL_THRESHOLD_DAYS) {
            warn!(
                "Client certificate expires soon ({}). Renewal recommended.",
                credentials.certificate_expires_at
            );
        }

        debug!(
            "Creating authenticated client for agent {}",
            credentials.agent_id
        );

        // Inject organization ID from credentials into config
        // This ensures the X-Organization-Id header is set correctly
        let mut config = self.config.clone();
        config.organization_id = Some(credentials.organization_id.to_string());

        // Try mTLS first, fall back to header-based auth
        let client = match HttpClient::with_mtls(
            &config,
            &credentials.client_certificate,
            &credentials.client_private_key,
        ) {
            Ok(client) => {
                debug!("Using mTLS authentication");
                client
            }
            Err(e) => {
                debug!("mTLS not available ({}), using header-based auth", e);
                HttpClient::with_header_auth(&config, &credentials.client_certificate)?
            }
        };

        // Cache the client and credentials
        {
            let mut state = self.state.write().await;
            state.client = Some(client.clone());
            state.credentials = Some(credentials);
            state.last_refresh = Some(Utc::now());
        }

        Ok(client)
    }

    /// Load credentials from the database.
    async fn load_credentials(&self) -> SyncResult<StoredCredentials> {
        let repo = CredentialsRepository::new(&self.db);
        repo.load().await?.ok_or(SyncError::NotEnrolled)
    }

    /// Ensure credentials are loaded and return them.
    async fn ensure_credentials(&self) -> SyncResult<StoredCredentials> {
        // Check cache first
        {
            let state = self.state.read().await;
            if let Some(ref creds) = state.credentials {
                return Ok(creds.clone());
            }
        }

        // Load from database
        self.load_credentials().await
    }

    /// Invalidate the cached client (e.g., after credential update).
    pub async fn invalidate(&self) {
        let mut state = self.state.write().await;
        state.client = None;
        state.credentials = None;
        state.last_refresh = None;
        debug!("Authenticated client cache invalidated");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{DatabaseConfig, KeyManager};
    use tempfile::TempDir;

    async fn create_test_db() -> (TempDir, Arc<Database>) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = DatabaseConfig::with_path(&db_path);
        let key_manager = KeyManager::new_with_test_key();
        let db = Database::open(config, &key_manager).unwrap();

        (temp_dir, Arc::new(db))
    }

    fn test_config() -> AgentConfig {
        AgentConfig {
            server_url: "https://api.test.com".to_string(),
            tls_verify: false,
            ..Default::default()
        }
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
            server_fingerprints: vec![],
            enrolled_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_is_enrolled_false() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();
        let client = AuthenticatedClient::new(config, db);

        assert!(!client.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_is_enrolled_true() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        // Store credentials
        let repo = CredentialsRepository::new(&db);
        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let client = AuthenticatedClient::new(config, db);
        assert!(client.is_enrolled().await.unwrap());
    }

    #[tokio::test]
    async fn test_agent_id() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        // Store credentials
        let repo = CredentialsRepository::new(&db);
        let credentials = create_test_credentials();
        let expected_id = credentials.agent_id;
        repo.store(&credentials).await.unwrap();

        let client = AuthenticatedClient::new(config, db);
        assert_eq!(client.agent_id().await.unwrap(), expected_id);
    }

    #[tokio::test]
    async fn test_needs_renewal_false() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        // Store credentials with far future expiry
        let repo = CredentialsRepository::new(&db);
        let mut credentials = create_test_credentials();
        credentials.certificate_expires_at = Utc::now() + chrono::Duration::days(365);
        repo.store(&credentials).await.unwrap();

        let client = AuthenticatedClient::new(config, db);
        assert!(!client.needs_renewal().await.unwrap());
    }

    #[tokio::test]
    async fn test_needs_renewal_true() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        // Store credentials with near expiry
        let repo = CredentialsRepository::new(&db);
        let mut credentials = create_test_credentials();
        credentials.certificate_expires_at = Utc::now() + chrono::Duration::days(15);
        repo.store(&credentials).await.unwrap();

        let client = AuthenticatedClient::new(config, db);
        assert!(client.needs_renewal().await.unwrap());
    }

    #[tokio::test]
    async fn test_not_enrolled_error() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        let client = AuthenticatedClient::new(config, db);
        let result = client.agent_id().await;

        assert!(matches!(result, Err(SyncError::NotEnrolled)));
    }

    #[tokio::test]
    async fn test_invalidate() {
        let (_temp_dir, db) = create_test_db().await;
        let config = test_config();

        // Store credentials
        let repo = CredentialsRepository::new(&db);
        let credentials = create_test_credentials();
        repo.store(&credentials).await.unwrap();

        let client = AuthenticatedClient::new(config, db);

        // Load credentials to populate cache
        let _ = client.agent_id().await.unwrap();

        // Invalidate cache
        client.invalidate().await;

        // Should still work (will reload from DB)
        let _ = client.agent_id().await.unwrap();
    }
}
