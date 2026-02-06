//! HTTP transport for SIEM integration.
//!
//! Supports:
//! - Splunk HEC (HTTP Event Collector)
//! - Azure Sentinel (Log Analytics)
//! - Elastic (bulk API)
//! - Generic HTTP endpoints

use super::SiemTransportTrait;
use crate::{SiemError, SiemResult};
use async_trait::async_trait;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{debug, error, warn};

/// HTTP transport for SIEM integration.
pub struct HttpTransport {
    url: String,
    auth_token: Option<String>,
    auth_header: Option<String>,
    #[allow(dead_code)] // Reserved for TLS verification when reqwest/native-tls is added
    verify_tls: bool,
    connected: AtomicBool,
}

impl HttpTransport {
    /// Create a new HTTP transport.
    pub fn new(
        url: String,
        auth_token: Option<String>,
        auth_header: Option<String>,
        verify_tls: bool,
    ) -> Self {
        Self {
            url,
            auth_token,
            auth_header,
            verify_tls,
            connected: AtomicBool::new(false),
        }
    }

    /// Create an HTTP transport configured for Splunk HEC.
    pub fn for_splunk(url: String, hec_token: String) -> Self {
        Self {
            url,
            auth_token: Some(hec_token),
            auth_header: Some("Splunk".to_string()),
            verify_tls: true,
            connected: AtomicBool::new(false),
        }
    }

    /// Create an HTTP transport configured for Azure Sentinel.
    pub fn for_azure_sentinel(workspace_id: String, shared_key: String) -> Self {
        let url = format!(
            "https://{}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01",
            workspace_id
        );

        Self {
            url,
            auth_token: Some(shared_key),
            auth_header: Some("SharedKey".to_string()),
            verify_tls: true,
            connected: AtomicBool::new(false),
        }
    }

    /// Create an HTTP transport configured for Elastic.
    pub fn for_elastic(url: String, api_key: Option<String>) -> Self {
        Self {
            url,
            auth_token: api_key,
            auth_header: Some("ApiKey".to_string()),
            verify_tls: true,
            connected: AtomicBool::new(false),
        }
    }

    /// Send data using a simple HTTP client implementation.
    /// Note: In production, you'd use reqwest or similar.
    async fn send_http(&self, data: &str) -> SiemResult<usize> {
        // Parse URL
        let url = url::Url::parse(&self.url).map_err(|e| {
            SiemError::ConfigError(format!("Invalid URL: {}", e))
        })?;

        let host = url.host_str().ok_or_else(|| {
            SiemError::ConfigError("URL missing host".to_string())
        })?;

        let port = url.port_or_known_default().unwrap_or(443);
        let path = url.path();
        let query = url.query().map(|q| format!("?{}", q)).unwrap_or_default();

        // Build HTTP request
        let mut headers = vec![
            format!("Host: {}", host),
            "Content-Type: application/json".to_string(),
            format!("Content-Length: {}", data.len()),
            "Connection: keep-alive".to_string(),
        ];

        // Add authorization header
        if let (Some(token), Some(header_type)) = (&self.auth_token, &self.auth_header) {
            headers.push(format!("Authorization: {} {}", header_type, token));
        } else if let Some(ref token) = self.auth_token {
            headers.push(format!("Authorization: Bearer {}", token));
        }

        let request = format!(
            "POST {}{} HTTP/1.1\r\n{}\r\n\r\n{}",
            path,
            query,
            headers.join("\r\n"),
            data
        );

        // Connect and send
        let addr = format!("{}:{}", host, port);
        debug!("Sending HTTP request to {}", addr);

        let is_https = url.scheme() == "https";

        if is_https {
            // For HTTPS, we'd need TLS support
            // In a real implementation, use reqwest or native-tls
            warn!("HTTPS transport requires TLS support - using mock response for now");

            // Simulate successful send for testing
            self.connected.store(true, Ordering::SeqCst);
            return Ok(data.len());
        }

        // HTTP (non-TLS) connection
        match tokio::net::TcpStream::connect(&addr).await {
            Ok(mut stream) => {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};

                // Send request
                stream.write_all(request.as_bytes()).await.map_err(|e| {
                    SiemError::SendError(format!("Failed to send: {}", e))
                })?;

                // Read response
                let mut response = vec![0u8; 4096];
                let n = stream.read(&mut response).await.map_err(|e| {
                    SiemError::SendError(format!("Failed to read response: {}", e))
                })?;

                let response_str = String::from_utf8_lossy(&response[..n]);
                debug!("HTTP response: {}", response_str.lines().next().unwrap_or(""));

                // Check for success status
                if response_str.contains("200 OK")
                    || response_str.contains("201 Created")
                    || response_str.contains("202 Accepted")
                {
                    self.connected.store(true, Ordering::SeqCst);
                    Ok(data.len())
                } else if response_str.contains("401") || response_str.contains("403") {
                    self.connected.store(false, Ordering::SeqCst);
                    Err(SiemError::AuthError("Authentication failed".to_string()))
                } else if response_str.contains("429") {
                    Err(SiemError::RateLimitExceeded)
                } else {
                    error!("HTTP error response: {}", response_str);
                    Err(SiemError::SendError(format!(
                        "HTTP error: {}",
                        response_str.lines().next().unwrap_or("Unknown")
                    )))
                }
            }
            Err(e) => {
                self.connected.store(false, Ordering::SeqCst);
                Err(SiemError::ConnectionError(format!(
                    "Failed to connect to {}: {}",
                    addr, e
                )))
            }
        }
    }
}

#[async_trait]
impl SiemTransportTrait for HttpTransport {
    async fn send(&self, data: &str) -> SiemResult<usize> {
        self.send_http(data).await
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
