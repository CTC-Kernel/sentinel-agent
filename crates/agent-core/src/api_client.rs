//! HTTP API client for communicating with the Sentinel GRC server.
//!
//! This module provides the API client that handles:
//! - Agent enrollment
//! - Heartbeat sending
//! - Configuration retrieval
//! - Result upload

use agent_common::config::AgentConfig;
use agent_common::constants::{AGENT_VERSION, HTTP_CONNECT_TIMEOUT_SECS, HTTP_TIMEOUT_SECS};
use agent_common::error::{CommonError, Result};
use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info, warn};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Enrollment request sent to the server.
#[derive(Debug, Serialize)]
pub struct EnrollmentRequest {
    pub enrollment_token: String,
    pub hostname: String,
    pub os: String,
    pub os_version: String,
    pub machine_id: String,
    pub agent_version: String,
    pub organization_id: Option<String>,
}

/// Enrollment response from the server.
#[derive(Debug, Deserialize)]
pub struct EnrollmentResponse {
    pub agent_id: String,
    pub organization_id: String,
    pub server_certificate: String,
    pub client_certificate: String,
    pub client_key: String,
    pub certificate_expires_at: String,
    pub config: ServerAgentConfig,
    pub message: Option<String>,
}

/// Result of enrollment request, handling both success and already_enrolled cases.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum EnrollmentResult {
    Success(Box<EnrollmentResponse>),
    AlreadyEnrolled {
        agent_id: String,
        organization_id: String,
        status: String,
        message: String,
    },
}

/// Agent configuration from the server.
#[derive(Debug, Deserialize, Clone)]
pub struct ServerAgentConfig {
    #[serde(default = "default_check_interval")]
    pub check_interval_secs: u64,
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default)]
    pub enabled_checks: Vec<String>,
    #[serde(default = "default_offline_days")]
    pub offline_mode_days: u32,

    /// Whether auto-remediation is enabled.
    #[serde(default)]
    pub enable_auto_remediation: bool,

    /// Whether real-time monitoring is enabled (FIM, process, USB).
    #[serde(default)]
    pub enable_realtime_monitoring: bool,

    /// Whether process monitoring is enabled.
    #[serde(default)]
    pub enable_process_monitoring: bool,

    /// Whether network monitoring is enabled.
    #[serde(default)]
    pub enable_network_monitoring: bool,

    /// Whether software inventory is enabled.
    #[serde(default)]
    pub enable_software_inventory: bool,

    /// Whether CIS benchmarks are enabled.
    #[serde(default)]
    pub enable_cis_benchmarks: bool,

    /// Whether auto-update is enabled.
    #[serde(default = "default_true_fn")]
    pub auto_update_enabled: bool,

    /// Update channel (stable, beta, canary).
    #[serde(default = "default_update_channel")]
    pub update_channel: String,

    /// Disabled check IDs.
    #[serde(default)]
    pub disabled_checks: Vec<String>,

    /// Proxy enabled flag.
    #[serde(default)]
    pub proxy_enabled: bool,

    /// Proxy URL.
    #[serde(default)]
    pub proxy_url: Option<String>,
}

fn default_check_interval() -> u64 {
    3600
}
fn default_heartbeat_interval() -> u64 {
    60
}
fn default_log_level() -> String {
    "info".to_string()
}
fn default_offline_days() -> u32 {
    7
}
fn default_true_fn() -> bool {
    true
}
fn default_update_channel() -> String {
    "stable".to_string()
}

/// Heartbeat request sent to the server.
#[derive(Debug, Serialize)]
pub struct HeartbeatRequest {
    pub timestamp: String,
    pub agent_version: String,
    pub status: String,
    pub hostname: String,
    pub os_info: String,
    pub cpu_percent: f64,
    pub memory_bytes: u64,
    pub memory_percent: f64,
    pub memory_total_bytes: u64,
    pub disk_percent: f64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub network_bytes_sent: u64,
    pub network_bytes_recv: u64,
    pub uptime_seconds: u64,
    pub ip_address: Option<String>,
    pub last_check_at: Option<String>,
    pub compliance_score: Option<f64>,
    pub pending_sync_count: u32,
    pub self_check_result: Option<serde_json::Value>,
    #[serde(default)]
    pub processes: Vec<AgentProcess>,
    #[serde(default)]
    pub connections: Vec<AgentConnection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentProcess {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub memory_bytes: u64,
    pub user: String,
    pub command_line: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentConnection {
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub protocol: String,
    pub state: String,
    pub process_name: Option<String>,
    pub pid: Option<u32>,
}

/// Heartbeat response from the server.
#[derive(Debug, Deserialize)]
pub struct HeartbeatResponse {
    pub acknowledged: bool,
    pub server_time: String,
    #[serde(default)]
    pub commands: Vec<AgentCommand>,
    #[serde(default)]
    pub config_changed: bool,
    #[serde(default)]
    pub rules_changed: bool,
}

/// Allowed server command types. Any command not in this list will be rejected.
const ALLOWED_COMMANDS: &[&str] = &[
    "force_sync",
    "run_checks",
    "revoke",
    "diagnostics",
    "update",
];

/// Command from the server.
#[derive(Debug, Deserialize)]
pub struct AgentCommand {
    pub id: String,
    #[serde(rename = "type")]
    pub command_type: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

impl AgentCommand {
    /// Validate that this command is an allowed type.
    /// Returns true if the command_type is in the whitelist, false otherwise.
    pub fn is_valid(&self) -> bool {
        ALLOWED_COMMANDS.contains(&self.command_type.as_str())
    }
}

/// Full configuration response from the server.
#[derive(Debug, Deserialize)]
pub struct ConfigResponse {
    pub config_version: u32,
    pub check_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub log_level: String,
    #[serde(default)]
    pub enabled_checks: Vec<String>,
    pub offline_mode_days: u32,
    pub rules_version: u32,
    #[serde(default)]
    pub rules: Vec<CheckRule>,
}

/// Check rule from the server.
#[derive(Debug, Deserialize, Clone)]
pub struct CheckRule {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub rule_type: String,
    pub framework: String,
    pub control_id: String,
    pub check_command: Option<String>,
    pub expected_result: Option<String>,
    pub remediation: Option<String>,
    pub severity: String,
    #[serde(default)]
    pub platforms: Vec<String>,
}

/// Result upload request.
#[derive(Debug, Serialize)]
pub struct ResultRequest {
    pub check_id: String,
    pub framework: String,
    pub control_id: String,
    pub status: String,
    pub evidence: serde_json::Value,
    pub timestamp: String,
    pub duration_ms: u64,
}

/// Result upload response.
#[derive(Debug, Deserialize)]
pub struct ResultResponse {
    pub result_id: String,
    pub acknowledged: bool,
}

/// Software entry for inventory upload.
#[derive(Debug, Serialize)]
pub struct SoftwareEntry {
    pub name: String,
    pub version: String,
    pub vendor: Option<String>,
}

/// Wrapper for sensitive credential strings that are securely erased on drop.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
struct SecretString(String);

impl std::fmt::Debug for SecretString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("[REDACTED]")
    }
}

/// API client for Sentinel GRC server communication.
#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    agent_id: Option<String>,
    /// Client certificate for X-Agent-Certificate header authentication.
    client_certificate: Option<SecretString>,
    /// Client private key for HMAC signature authentication.
    client_key: Option<SecretString>,
    /// Organization ID for X-Organization-Id header authentication.
    organization_id: Option<String>,
}

impl ApiClient {
    /// Create a new API client.
    pub fn new(config: &AgentConfig) -> Result<Self> {
        let mut builder = ClientBuilder::new()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
            .user_agent(format!("SentinelAgent/{}", AGENT_VERSION));

        // SECURITY: TLS bypass only allowed in debug builds for development.
        #[cfg(debug_assertions)]
        if !config.tls_verify {
            warn!(
                "DANGER: TLS certificate verification bypassed (debug build only). Never use in production!"
            );
            builder = builder.danger_accept_invalid_certs(true);
        }
        #[cfg(not(debug_assertions))]
        if !config.tls_verify {
            warn!(
                "Ignoring tls_verify=false: TLS bypass is disabled in release builds for security."
            );
        }

        // Configure proxy if present
        if let Some(ref proxy_config) = config.proxy {
            let mut proxy = reqwest::Proxy::all(&proxy_config.url)
                .map_err(|e| CommonError::network(format!("Invalid proxy URL: {}", e)))?;

            if let (Some(username), Some(password)) =
                (&proxy_config.username, &proxy_config.password)
            {
                proxy = proxy.basic_auth(username, password);
            }

            builder = builder.proxy(proxy);
        }

        let client = builder
            .build()
            .map_err(|e| CommonError::network(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url: config.server_url.trim_end_matches('/').to_string(),
            agent_id: config.agent_id.clone(),
            client_certificate: config.client_certificate.as_ref().map(|s| SecretString(s.clone())),
            client_key: config.client_key.as_ref().map(|s| SecretString(s.clone())),
            organization_id: config.organization_id.clone(),
        })
    }

    /// Set the agent ID after enrollment.
    pub fn set_agent_id(&mut self, agent_id: String) {
        self.agent_id = Some(agent_id);
    }

    /// Get the current agent ID.
    pub fn agent_id(&self) -> Option<&str> {
        self.agent_id.as_deref()
    }

    /// Set client credentials for authentication after enrollment.
    /// Credentials are securely zeroed on drop.
    pub fn set_credentials(&mut self, certificate: String, key: String) {
        self.client_certificate = Some(SecretString(certificate));
        self.client_key = Some(SecretString(key));
    }

    /// Set the organization ID after enrollment.
    pub fn set_organization_id(&mut self, organization_id: String) {
        self.organization_id = Some(organization_id);
    }

    /// Add authentication headers to a request builder.
    fn authenticate(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let mut builder = if let Some(ref cert) = self.client_certificate {
            builder.header("X-Agent-Certificate", &cert.0)
        } else {
            builder
        };

        // Add organization ID header if available
        if let Some(ref org_id) = self.organization_id {
            builder = builder.header("X-Organization-Id", org_id);
        }

        builder
    }

    /// Enroll the agent with the server.
    pub async fn enroll(&mut self, request: EnrollmentRequest) -> Result<EnrollmentResponse> {
        let url = format!("{}/v1/agents/enroll", self.base_url);
        info!("Base URL: '{}'", self.base_url);
        info!("Enrolling agent at '{}'", url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Enrollment request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            error!("Enrollment failed with status {}: {}", status, error_text);
            return Err(CommonError::network(format!(
                "Enrollment failed: {} - {}",
                status, error_text
            )));
        }

        let result: EnrollmentResult = response.json().await.map_err(|e| {
            CommonError::network(format!("Failed to parse enrollment response: {}", e))
        })?;

        match result {
            EnrollmentResult::Success(enrollment) => {
                // Store the agent ID
                self.agent_id = Some(enrollment.agent_id.clone());

                if let Some(ref msg) = enrollment.message {
                    info!("Enrollment message: {}", msg);
                }

                info!(
                    "Agent enrolled successfully with ID: {}",
                    enrollment.agent_id
                );
                Ok(*enrollment)
            }
            EnrollmentResult::AlreadyEnrolled {
                message, agent_id, ..
            } => {
                error!("Agent already enrolled: {}", message);
                // Return a specific error kind so prompt logic can handle it?
                // For now, map to validation error which is fatal.
                Err(CommonError::validation(format!(
                    "Agent already enrolled with ID {}. Please uninstall with --purge to re-enroll.",
                    agent_id
                )))
            }
        }
    }

    /// Send a heartbeat to the server.
    pub async fn send_heartbeat(&self, request: HeartbeatRequest) -> Result<HeartbeatResponse> {
        let agent_id = self
            .agent_id
            .as_ref()
            .ok_or_else(|| CommonError::validation("Agent ID not set. Must enroll first."))?;

        let url = format!("{}/v1/agents/{}/heartbeat", self.base_url, agent_id);
        debug!("Sending heartbeat to {}", url);

        let builder = self.authenticate(self.client.post(&url).json(&request));

        let response = builder
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Heartbeat request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            warn!("Heartbeat failed with status {}: {}", status, error_text);
            return Err(CommonError::network(format!(
                "Heartbeat failed: {} - {}",
                status, error_text
            )));
        }

        let heartbeat: HeartbeatResponse = response.json().await.map_err(|e| {
            CommonError::network(format!("Failed to parse heartbeat response: {}", e))
        })?;

        debug!("Heartbeat acknowledged at {}", heartbeat.server_time);

        if !heartbeat.commands.is_empty() {
            info!("Received {} commands from server", heartbeat.commands.len());
        }

        Ok(heartbeat)
    }

    /// Get agent configuration from the server.
    pub async fn get_config(&self) -> Result<ConfigResponse> {
        let agent_id = self
            .agent_id
            .as_ref()
            .ok_or_else(|| CommonError::validation("Agent ID not set. Must enroll first."))?;

        let url = format!("{}/v1/agents/{}/config", self.base_url, agent_id);
        debug!("Fetching config from {}", url);

        let builder = self.authenticate(self.client.get(&url));

        let response = builder
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Config request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(CommonError::network(format!(
                "Config fetch failed: {} - {}",
                status, error_text
            )));
        }

        let config: ConfigResponse = response
            .json()
            .await
            .map_err(|e| CommonError::network(format!("Failed to parse config response: {}", e)))?;

        info!(
            "Received config version {} with {} rules",
            config.config_version,
            config.rules.len()
        );

        Ok(config)
    }

    /// Upload a check result to the server.
    pub async fn upload_result(&self, request: ResultRequest) -> Result<ResultResponse> {
        let agent_id = self
            .agent_id
            .as_ref()
            .ok_or_else(|| CommonError::validation("Agent ID not set. Must enroll first."))?;

        let url = format!("{}/v1/agents/{}/results", self.base_url, agent_id);
        debug!("Uploading result to {}", url);

        let builder = self.authenticate(self.client.post(&url).json(&request));

        let response = builder
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Result upload failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(CommonError::network(format!(
                "Result upload failed: {} - {}",
                status, error_text
            )));
        }

        let result: ResultResponse = response
            .json()
            .await
            .map_err(|e| CommonError::network(format!("Failed to parse result response: {}", e)))?;

        debug!("Result uploaded with ID: {}", result.result_id);

        Ok(result)
    }

    /// Check server health.
    pub async fn health_check(&self) -> Result<bool> {
        let url = format!("{}/v1/health", self.base_url);
        debug!("Health check at {}", url);

        let builder = self.authenticate(self.client.get(&url));

        let response = builder
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Health check failed: {}", e)))?;

        Ok(response.status().is_success())
    }

    /// Upload software inventory to the server.
    pub async fn upload_software_inventory(
        &self,
        software: &[SoftwareEntry],
    ) -> Result<serde_json::Value> {
        let agent_id = self
            .agent_id
            .as_ref()
            .ok_or_else(|| CommonError::validation("Agent ID not set"))?;

        let payload = serde_json::json!({
            "software": software,
            "scan_timestamp": chrono::Utc::now().to_rfc3339(),
        });

        let url = format!("/v1/agents/{}/software", agent_id);
        self.post(&url, &payload).await
    }

    /// Generic POST request with JSON body and response.
    pub async fn post<T, R>(&self, path: &str, body: &T) -> Result<R>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);
        debug!("POST {}", url);

        let builder = self.authenticate(self.client.post(&url).json(body));

        let response = builder
            .send()
            .await
            .map_err(|e| CommonError::network(format!("POST request failed: {}", e)))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(CommonError::network(format!(
                "POST {} failed: {} - {}",
                path, status, error_text
            )));
        }

        let result: R = response
            .json()
            .await
            .map_err(|e| CommonError::network(format!("Failed to parse response: {}", e)))?;

        Ok(result)
    }

    /// Fetch the latest release information from the update server.
    pub async fn get_latest_release_info(&self) -> Result<agent_common::types::UpdateInfo> {
        let url = "https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/release-info.json";
        debug!("Fetching release info from {}", url);

        let response =
            self.client.get(url).send().await.map_err(|e| {
                CommonError::network(format!("Failed to fetch release info: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(CommonError::network(format!(
                "Failed to fetch release info: status {}",
                response.status()
            )));
        }

        let info: agent_common::types::UpdateInfo = response
            .json()
            .await
            .map_err(|e| CommonError::network(format!("Failed to parse release info: {}", e)))?;

        Ok(info)
    }

    /// Download a file from a URL to the specified path.
    pub async fn download_file(&self, url: &str, destination: &std::path::Path) -> Result<()> {
        debug!("Downloading {} to {:?}", url, destination);

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Download failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CommonError::network(format!(
                "Download failed: status {}",
                response.status()
            )));
        }

        let content = response
            .bytes()
            .await
            .map_err(|e| CommonError::network(format!("Failed to read download body: {}", e)))?;

        std::fs::write(destination, content)
            .map_err(|e| CommonError::io(format!("Failed to save download: {}", e)))?;

        Ok(())
    }

    /// Fetch a small text file (e.g., a checksum).
    pub async fn fetch_text(&self, url: &str) -> Result<String> {
        debug!("Fetching text from {}", url);

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| CommonError::network(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(CommonError::network(format!(
                "Request failed: status {}",
                response.status()
            )));
        }

        let text = response
            .text()
            .await
            .map_err(|e| CommonError::network(format!("Failed to read response body: {}", e)))?;

        Ok(text.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enrollment_request_serialization() {
        let request = EnrollmentRequest {
            enrollment_token: "test-token".to_string(),
            hostname: "test-host".to_string(),
            os: "linux".to_string(),
            os_version: "22.04".to_string(),
            machine_id: "machine-123".to_string(),
            agent_version: "1.0.0".to_string(),
            organization_id: Some("org-123".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("enrollment_token"));
        assert!(json.contains("test-token"));
    }

    #[test]
    fn test_heartbeat_request_serialization() {
        let request = HeartbeatRequest {
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            agent_version: "1.0.0".to_string(),
            status: "online".to_string(),
            hostname: "test-host".to_string(),
            os_info: "Linux 5.15".to_string(),
            cpu_percent: 25.5,
            memory_bytes: 1024 * 1024 * 512,
            memory_percent: 45.2,
            memory_total_bytes: 16 * 1024 * 1024 * 1024,
            disk_percent: 62.5,
            disk_used_bytes: 250 * 1024 * 1024 * 1024,
            disk_total_bytes: 400 * 1024 * 1024 * 1024,
            network_bytes_sent: 0,
            network_bytes_recv: 0,
            uptime_seconds: 0,
            ip_address: None,
            last_check_at: None,
            compliance_score: None,
            pending_sync_count: 0,
            self_check_result: None,
            processes: vec![],
            connections: vec![],
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("timestamp"));
        assert!(json.contains("cpu_percent"));
        assert!(json.contains("memory_percent"));
        assert!(json.contains("memory_total_bytes"));
        assert!(json.contains("disk_percent"));
        assert!(json.contains("disk_used_bytes"));
        assert!(json.contains("disk_total_bytes"));
        assert!(json.contains("uptime_seconds"));
        assert!(json.contains("ip_address"));
    }

    #[test]
    fn test_enrollment_result_deserialization() {
        // Test success case
        let success_json = r#"{
            "agent_id": "550e8400-e29b-41d4-a716-446655440000",
            "organization_id": "org-1",
            "server_certificate": "cert",
            "client_certificate": "client-cert",
            "client_key": "key",
            "certificate_expires_at": "2025-01-01T00:00:00Z",
            "config": {
                "check_interval_secs": 3600,
                "heartbeat_interval_secs": 60,
                "log_level": "info",
                "enabled_checks": [],
                "offline_mode_days": 7
            }
        }"#;

        let result: EnrollmentResult = serde_json::from_str(success_json).unwrap();
        match result {
            EnrollmentResult::Success(r) => {
                assert_eq!(r.agent_id, "550e8400-e29b-41d4-a716-446655440000")
            }
            _ => panic!("Expected success"),
        }

        // Test already enrolled case
        let exists_json = r#"{
            "agent_id": "550e8400-e29b-41d4-a716-446655440000",
            "organization_id": "org-1",
            "status": "already_enrolled",
            "message": "Agent already registered"
        }"#;

        let result: EnrollmentResult = serde_json::from_str(exists_json).unwrap();
        match result {
            EnrollmentResult::AlreadyEnrolled {
                agent_id, status, ..
            } => {
                assert_eq!(agent_id, "550e8400-e29b-41d4-a716-446655440000");
                assert_eq!(status, "already_enrolled");
            }
            _ => panic!("Expected already_enrolled"),
        }
    }

    #[test]
    fn test_agent_command_validation() {
        // Valid commands
        let valid_commands = vec![
            AgentCommand {
                id: "1".to_string(),
                command_type: "force_sync".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "2".to_string(),
                command_type: "run_checks".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "3".to_string(),
                command_type: "revoke".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "4".to_string(),
                command_type: "diagnostics".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "5".to_string(),
                command_type: "update".to_string(),
                payload: serde_json::Value::Null,
            },
        ];

        for cmd in valid_commands {
            assert!(cmd.is_valid(), "Command {} should be valid", cmd.command_type);
        }

        // Invalid commands (not in whitelist)
        let invalid_commands = vec![
            AgentCommand {
                id: "1".to_string(),
                command_type: "execute_shell".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "2".to_string(),
                command_type: "rm_rf".to_string(),
                payload: serde_json::Value::Null,
            },
            AgentCommand {
                id: "3".to_string(),
                command_type: "download_malware".to_string(),
                payload: serde_json::Value::Null,
            },
        ];

        for cmd in invalid_commands {
            assert!(!cmd.is_valid(), "Command {} should be invalid", cmd.command_type);
        }
    }

    #[test]
    fn test_server_agent_config_defaults() {
        let json = r#"{}"#;
        let config: ServerAgentConfig = serde_json::from_str(json).unwrap();

        assert_eq!(config.check_interval_secs, 3600);
        assert_eq!(config.heartbeat_interval_secs, 60);
        assert_eq!(config.log_level, "info");
        assert!(config.enabled_checks.is_empty());
        assert_eq!(config.offline_mode_days, 7);
        assert!(config.auto_update_enabled);
        assert_eq!(config.update_channel, "stable");
        assert!(!config.enable_auto_remediation);
        assert!(!config.enable_realtime_monitoring);
    }

    #[test]
    fn test_server_agent_config_full() {
        let json = r#"{
            "check_interval_secs": 7200,
            "heartbeat_interval_secs": 120,
            "log_level": "debug",
            "enabled_checks": ["disk_encryption", "firewall"],
            "offline_mode_days": 14,
            "enable_auto_remediation": true,
            "enable_realtime_monitoring": true,
            "enable_process_monitoring": true,
            "enable_network_monitoring": true,
            "auto_update_enabled": false,
            "update_channel": "beta",
            "disabled_checks": ["usb_storage"],
            "proxy_enabled": true,
            "proxy_url": "http://proxy.example.com:8080"
        }"#;

        let config: ServerAgentConfig = serde_json::from_str(json).unwrap();

        assert_eq!(config.check_interval_secs, 7200);
        assert_eq!(config.heartbeat_interval_secs, 120);
        assert_eq!(config.log_level, "debug");
        assert_eq!(config.enabled_checks, vec!["disk_encryption", "firewall"]);
        assert_eq!(config.offline_mode_days, 14);
        assert!(config.enable_auto_remediation);
        assert!(config.enable_realtime_monitoring);
        assert!(config.enable_process_monitoring);
        assert!(config.enable_network_monitoring);
        assert!(!config.auto_update_enabled);
        assert_eq!(config.update_channel, "beta");
        assert_eq!(config.disabled_checks, vec!["usb_storage"]);
        assert!(config.proxy_enabled);
        assert_eq!(config.proxy_url, Some("http://proxy.example.com:8080".to_string()));
    }

    #[test]
    fn test_heartbeat_response_deserialization() {
        let json = r#"{
            "acknowledged": true,
            "server_time": "2024-01-01T12:00:00Z",
            "commands": [
                {"id": "cmd-1", "type": "force_sync", "payload": null}
            ],
            "config_changed": true,
            "rules_changed": false
        }"#;

        let response: HeartbeatResponse = serde_json::from_str(json).unwrap();
        assert!(response.acknowledged);
        assert_eq!(response.server_time, "2024-01-01T12:00:00Z");
        assert_eq!(response.commands.len(), 1);
        assert!(response.config_changed);
        assert!(!response.rules_changed);
    }

    #[test]
    fn test_heartbeat_response_minimal() {
        let json = r#"{
            "acknowledged": true,
            "server_time": "2024-01-01T12:00:00Z"
        }"#;

        let response: HeartbeatResponse = serde_json::from_str(json).unwrap();
        assert!(response.acknowledged);
        assert!(response.commands.is_empty());
        assert!(!response.config_changed);
        assert!(!response.rules_changed);
    }

    #[test]
    fn test_config_response_deserialization() {
        let json = r#"{
            "config_version": 5,
            "check_interval_secs": 3600,
            "heartbeat_interval_secs": 60,
            "log_level": "info",
            "enabled_checks": ["disk_encryption"],
            "offline_mode_days": 7,
            "rules_version": 10,
            "rules": [
                {
                    "id": "rule-1",
                    "name": "Test Rule",
                    "type": "registry",
                    "framework": "NIS2",
                    "control_id": "AC-1",
                    "severity": "high",
                    "platforms": ["windows"]
                }
            ]
        }"#;

        let config: ConfigResponse = serde_json::from_str(json).unwrap();
        assert_eq!(config.config_version, 5);
        assert_eq!(config.rules_version, 10);
        assert_eq!(config.rules.len(), 1);
        assert_eq!(config.rules[0].name, "Test Rule");
        assert_eq!(config.rules[0].framework, "NIS2");
    }

    #[test]
    fn test_result_request_serialization() {
        let request = ResultRequest {
            check_id: "disk_encryption".to_string(),
            framework: "NIS2".to_string(),
            control_id: "AC-17".to_string(),
            status: "pass".to_string(),
            evidence: serde_json::json!({"encryption_enabled": true}),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            duration_ms: 150,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("disk_encryption"));
        assert!(json.contains("NIS2"));
        assert!(json.contains("pass"));
        assert!(json.contains("duration_ms"));
    }

    #[test]
    fn test_software_entry_serialization() {
        let entry = SoftwareEntry {
            name: "Firefox".to_string(),
            version: "120.0".to_string(),
            vendor: Some("Mozilla".to_string()),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("Firefox"));
        assert!(json.contains("120.0"));
        assert!(json.contains("Mozilla"));
    }

    #[test]
    fn test_check_rule_deserialization() {
        let json = r#"{
            "id": "rule-123",
            "name": "Password Policy Check",
            "type": "script",
            "framework": "DORA",
            "control_id": "IA-5",
            "check_command": "pwpolicy getaccountpolicies",
            "expected_result": "minChars=12",
            "remediation": "Set minimum password length to 12",
            "severity": "medium",
            "platforms": ["macos", "linux"]
        }"#;

        let rule: CheckRule = serde_json::from_str(json).unwrap();
        assert_eq!(rule.id, "rule-123");
        assert_eq!(rule.name, "Password Policy Check");
        assert_eq!(rule.rule_type, "script");
        assert_eq!(rule.framework, "DORA");
        assert_eq!(rule.severity, "medium");
        assert_eq!(rule.platforms, vec!["macos", "linux"]);
        assert!(rule.check_command.is_some());
        assert!(rule.remediation.is_some());
    }
}
