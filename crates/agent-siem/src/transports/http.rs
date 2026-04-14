// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! HTTP transport for SIEM integration.
//!
//! Supports:
//! - Splunk HEC (HTTP Event Collector)
//! - Azure Sentinel (Log Analytics)
//! - Elastic (bulk API)
//! - Generic HTTP/HTTPS endpoints
//!
//! Uses reqwest for full HTTPS/TLS support with retry logic.

use super::SiemTransportTrait;
use crate::{SiemError, SiemResult};
use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tracing::{debug, warn};

/// Maximum number of retry attempts for transient failures.
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff (milliseconds).
const BASE_RETRY_DELAY_MS: u64 = 500;

/// HTTP transport for SIEM integration.
pub struct HttpTransport {
    url: String,
    auth_token: Option<String>,
    auth_header: Option<String>,
    #[cfg_attr(not(test), allow(dead_code))]
    verify_tls: bool,
    connected: AtomicBool,
    client: reqwest::Client,
}

impl HttpTransport {
    /// Create a new HTTP transport.
    pub fn new(
        url: String,
        auth_token: Option<String>,
        auth_header: Option<String>,
        verify_tls: bool,
    ) -> Self {
        #[allow(unused_mut)]
        let mut builder = reqwest::Client::builder()
            .min_tls_version(reqwest::tls::Version::TLS_1_2)
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10));

        // SECURITY: Disabling TLS verification is only allowed in debug builds
        #[cfg(debug_assertions)]
        if !verify_tls {
            debug!("TLS verification disabled (development mode — debug build only)");
            builder = builder.danger_accept_invalid_certs(true);
        }
        #[cfg(not(debug_assertions))]
        if !verify_tls {
            warn!("SECURITY: verify_tls=false is forbidden in release builds — ignoring");
        }

        let client = builder.build().unwrap_or_else(|_| reqwest::Client::new());

        Self {
            url,
            auth_token,
            auth_header,
            verify_tls,
            connected: AtomicBool::new(false),
            client,
        }
    }

    /// Create an HTTP transport configured for Splunk HEC.
    pub fn for_splunk(url: String, hec_token: String) -> Self {
        Self::new(url, Some(hec_token), Some("Splunk".to_string()), true)
    }

    /// Create an HTTP transport configured for Azure Sentinel.
    pub fn for_azure_sentinel(workspace_id: String, shared_key: String) -> Self {
        let url = format!(
            "https://{}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01",
            workspace_id
        );
        Self::new(url, Some(shared_key), Some("SharedKey".to_string()), true)
    }

    /// Create an HTTP transport configured for Elastic.
    pub fn for_elastic(url: String, api_key: Option<String>) -> Self {
        Self::new(url, api_key, Some("ApiKey".to_string()), true)
    }

    /// Send data with retry logic and exponential backoff.
    async fn send_with_retry(&self, data: &str) -> SiemResult<usize> {
        let mut last_error = None;

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let delay = BASE_RETRY_DELAY_MS * 2u64.pow(attempt - 1);
                debug!(
                    "Retry attempt {}/{} after {}ms",
                    attempt, MAX_RETRIES, delay
                );
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }

            match self.send_once(data).await {
                Ok(bytes) => return Ok(bytes),
                Err(e) => {
                    // Don't retry on auth errors or config errors
                    if matches!(e, SiemError::AuthError(_) | SiemError::ConfigError(_)) {
                        return Err(e);
                    }
                    warn!("SIEM HTTP send attempt {} failed: {}", attempt + 1, e);
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| SiemError::SendError("All retries exhausted".to_string())))
    }

    /// Single send attempt.
    async fn send_once(&self, data: &str) -> SiemResult<usize> {
        let mut request = self
            .client
            .post(&self.url)
            .header("Content-Type", "application/json")
            .body(data.to_string());

        // Add authorization header
        if let (Some(token), Some(header_type)) = (&self.auth_token, &self.auth_header) {
            request = request.header("Authorization", format!("{} {}", header_type, token));
        } else if let Some(ref token) = self.auth_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let data_len = data.len();

        let response = request.send().await.map_err(|e| {
            self.connected.store(false, Ordering::SeqCst);
            if e.is_connect() {
                SiemError::ConnectionError(format!("Failed to connect to {}: {}", self.url, e))
            } else if e.is_timeout() {
                SiemError::Timeout
            } else {
                SiemError::SendError(format!("Request failed: {}", e))
            }
        })?;

        let status = response.status();

        match status.as_u16() {
            200..=299 => {
                self.connected.store(true, Ordering::SeqCst);
                debug!("HTTP {} - {} bytes sent", status, data_len);
                Ok(data_len)
            }
            401 | 403 => {
                self.connected.store(false, Ordering::SeqCst);
                Err(SiemError::AuthError(format!(
                    "Authentication failed (HTTP {})",
                    status
                )))
            }
            429 => Err(SiemError::RateLimitExceeded),
            _ => {
                let body = response.text().await.unwrap_or_default();
                Err(SiemError::SendError(format!(
                    "HTTP {} - {}",
                    status,
                    body.chars().take(200).collect::<String>()
                )))
            }
        }
    }
}

#[async_trait]
impl SiemTransportTrait for HttpTransport {
    async fn send(&self, data: &str) -> SiemResult<usize> {
        self.send_with_retry(data).await
    }

    async fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    fn name(&self) -> &'static str {
        "HTTP"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_transport_creation() {
        let transport = HttpTransport::new(
            "https://siem.example.com/api/events".to_string(),
            Some("token123".to_string()),
            Some("Bearer".to_string()),
            true,
        );

        assert_eq!(transport.url, "https://siem.example.com/api/events");
        assert_eq!(transport.auth_token, Some("token123".to_string()));
        assert!(transport.verify_tls);
    }

    #[test]
    fn test_splunk_transport() {
        let transport = HttpTransport::for_splunk(
            "https://splunk.example.com:8088/services/collector".to_string(),
            "hec-token-123".to_string(),
        );

        assert_eq!(transport.auth_header, Some("Splunk".to_string()));
        assert_eq!(transport.auth_token, Some("hec-token-123".to_string()));
    }

    #[test]
    fn test_azure_sentinel_transport() {
        let transport = HttpTransport::for_azure_sentinel(
            "workspace-id-123".to_string(),
            "shared-key-456".to_string(),
        );

        assert!(transport.url.contains("workspace-id-123"));
        assert!(transport.url.contains("opinsights.azure.com"));
    }

    #[test]
    fn test_elastic_transport() {
        let transport = HttpTransport::for_elastic(
            "https://elastic.example.com:9200/_bulk".to_string(),
            Some("api-key-789".to_string()),
        );

        assert_eq!(transport.auth_header, Some("ApiKey".to_string()));
    }
}
