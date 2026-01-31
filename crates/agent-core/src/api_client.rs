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

/// Enrollment request sent to the server.
#[derive(Debug, Serialize)]
pub struct EnrollmentRequest {
    pub enrollment_token: String,
    pub hostname: String,
    pub os: String,
    pub os_version: String,
    pub machine_id: String,
    pub agent_version: String,
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
    pub uptime_seconds: u64,
    pub ip_address: Option<String>,
    pub last_check_at: Option<String>,
    pub compliance_score: Option<f64>,
    pub pending_sync_count: u32,
    pub self_check_result: Option<serde_json::Value>,
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

/// Command from the server.
#[derive(Debug, Deserialize)]
pub struct AgentCommand {
    pub id: String,
    #[serde(rename = "type")]
    pub command_type: String,
    #[serde(default)]
    pub payload: serde_json::Value,
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

/// API client for Sentinel GRC server communication.
pub struct ApiClient {
    client: Client,
    base_url: String,
    agent_id: Option<String>,
    /// Client certificate for X-Agent-Certificate header authentication.
    client_certificate: Option<String>,
    /// Client private key for HMAC signature authentication.
    client_key: Option<String>,
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

        // Configure TLS
        if !config.tls_verify {
            warn!("TLS certificate verification is disabled");
            builder = builder.danger_accept_invalid_certs(true);
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
            client_certificate: config.client_certificate.clone(),
            client_key: config.client_key.clone(),
            organization_id: None, // Will be set after enrollment
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
    pub fn set_credentials(&mut self, certificate: String, key: String) {
        self.client_certificate = Some(certificate);
        self.client_key = Some(key);
    }

    /// Set the organization ID after enrollment.
    pub fn set_organization_id(&mut self, organization_id: String) {
        self.organization_id = Some(organization_id);
    }

    /// Add authentication headers to a request builder.
    fn authenticate(
        &self,
        builder: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        let mut builder = if let Some(ref cert) = self.client_certificate {
            builder.header("X-Agent-Certificate", cert)
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
        info!("Enrolling agent at {}", url);

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

        let enrollment: EnrollmentResponse = response.json().await.map_err(|e| {
            CommonError::network(format!("Failed to parse enrollment response: {}", e))
        })?;

        // Store the agent ID
        self.agent_id = Some(enrollment.agent_id.clone());

        if let Some(ref msg) = enrollment.message {
            info!("Enrollment message: {}", msg);
        }

        info!(
            "Agent enrolled successfully with ID: {}",
            enrollment.agent_id
        );
        Ok(enrollment)
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
            uptime_seconds: 3600,
            ip_address: Some("192.168.1.100".to_string()),
            last_check_at: Some("2024-01-01T00:00:00Z".to_string()),
            compliance_score: Some(85.0),
            pending_sync_count: 0,
            self_check_result: None,
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
}
