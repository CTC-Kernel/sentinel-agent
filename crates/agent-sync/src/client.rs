//! HTTP client configuration for SaaS communication.
//!
//! This module provides configured HTTP clients for communicating with the
//! Sentinel GRC SaaS API with proper TLS, timeouts, and compression.

use crate::error::{SyncError, SyncResult};
use agent_common::config::AgentConfig;
use agent_common::constants::{
    AGENT_NAME, AGENT_VERSION, HTTP_CONNECT_TIMEOUT_SECS, HTTP_TIMEOUT_SECS,
};
use reqwest::{Client, ClientBuilder, header, tls};
use std::time::Duration;
use tracing::debug;

/// Minimum TLS version for all connections (NFR-S1).
const MIN_TLS_VERSION: tls::Version = tls::Version::TLS_1_3;

/// HTTP client wrapper for SaaS communication.
#[derive(Debug, Clone)]
pub struct HttpClient {
    /// The underlying reqwest client.
    client: Client,
    /// Base URL for API requests.
    base_url: String,
    /// Client certificate for header-based auth (fallback when mTLS is unavailable).
    auth_certificate: Option<String>,
    /// Organization ID for X-Organization-Id header.
    organization_id: Option<String>,
}

impl HttpClient {
    /// Create a new HTTP client for enrollment (no mTLS).
    ///
    /// This client is used for the initial enrollment request before
    /// the agent has received its client certificate.
    pub fn for_enrollment(config: &AgentConfig) -> SyncResult<Self> {
        debug!("Creating HTTP client for enrollment");

        let mut builder = ClientBuilder::new()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
            .min_tls_version(MIN_TLS_VERSION) // NFR-S1: TLS 1.3 minimum
            .user_agent(format!("{}/{}", AGENT_NAME, AGENT_VERSION));

        // Configure TLS verification
        // SECURITY: Disabling TLS verification is only allowed in debug builds
        #[cfg(debug_assertions)]
        if !config.tls_verify {
            debug!("TLS verification disabled (development mode — debug build only)");
            builder = builder.danger_accept_invalid_certs(true);
        }
        #[cfg(not(debug_assertions))]
        if !config.tls_verify {
            tracing::warn!("tls_verify=false is ignored in release builds for security");
        }

        // Configure custom CA certificate if provided
        if let Some(ref ca_path) = config.ca_cert_path {
            debug!("Loading custom CA certificate from: {}", ca_path);
            let ca_cert = std::fs::read(ca_path).map_err(|e| {
                SyncError::Certificate(format!("Failed to read CA certificate: {}", e))
            })?;
            let cert = reqwest::Certificate::from_pem(&ca_cert)
                .map_err(|e| SyncError::Certificate(format!("Invalid CA certificate: {}", e)))?;
            builder = builder.add_root_certificate(cert);
        }

        // Configure proxy if provided
        if let Some(ref proxy_config) = config.proxy {
            debug!("Configuring proxy: {}", proxy_config.url);
            let mut proxy = reqwest::Proxy::all(&proxy_config.url)
                .map_err(|e| SyncError::Config(format!("Invalid proxy URL: {}", e)))?;

            if let (Some(user), Some(pass)) = (&proxy_config.username, &proxy_config.password) {
                proxy = proxy.basic_auth(user, pass);
            }

            builder = builder.proxy(proxy);
        }

        let client = builder
            .build()
            .map_err(|e| SyncError::Config(format!("Failed to build HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url: config.server_url.trim_end_matches('/').to_string(),
            auth_certificate: None,
            organization_id: config.organization_id.clone(),
        })
    }

    /// Create a new HTTP client with header-based authentication.
    ///
    /// This client sends the certificate via `X-Agent-Certificate` header
    /// instead of mTLS. Used as fallback when the stored certificate is not
    /// in valid PEM format (e.g., base64-encoded JSON from enrollment).
    pub fn with_header_auth(config: &AgentConfig, certificate: &str) -> SyncResult<Self> {
        debug!("Creating HTTP client with header-based auth (mTLS fallback)");

        let mut builder = ClientBuilder::new()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
            .min_tls_version(MIN_TLS_VERSION)
            .user_agent(format!("{}/{}", AGENT_NAME, AGENT_VERSION));

        #[cfg(debug_assertions)]
        if !config.tls_verify {
            debug!("TLS verification disabled (development mode — debug build only)");
            builder = builder.danger_accept_invalid_certs(true);
        }
        #[cfg(not(debug_assertions))]
        if !config.tls_verify {
            tracing::warn!("tls_verify=false is ignored in release builds for security");
        }

        if let Some(ref ca_path) = config.ca_cert_path {
            debug!("Loading custom CA certificate from: {}", ca_path);
            let ca_cert = std::fs::read(ca_path).map_err(|e| {
                SyncError::Certificate(format!("Failed to read CA certificate: {}", e))
            })?;
            let cert = reqwest::Certificate::from_pem(&ca_cert)
                .map_err(|e| SyncError::Certificate(format!("Invalid CA certificate: {}", e)))?;
            builder = builder.add_root_certificate(cert);
        }

        if let Some(ref proxy_config) = config.proxy {
            debug!("Configuring proxy: {}", proxy_config.url);
            let mut proxy = reqwest::Proxy::all(&proxy_config.url)
                .map_err(|e| SyncError::Config(format!("Invalid proxy URL: {}", e)))?;

            if let (Some(user), Some(pass)) = (&proxy_config.username, &proxy_config.password) {
                proxy = proxy.basic_auth(user, pass);
            }

            builder = builder.proxy(proxy);
        }

        let client = builder
            .build()
            .map_err(|e| SyncError::Config(format!("Failed to build HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url: config.server_url.trim_end_matches('/').to_string(),
            auth_certificate: Some(certificate.to_string()),
            organization_id: config.organization_id.clone(),
        })
    }

    /// Create a new HTTP client with mTLS for authenticated communication.
    ///
    /// This client is used after enrollment when the agent has its
    /// client certificate for mutual TLS authentication.
    pub fn with_mtls(
        config: &AgentConfig,
        certificate_pem: &str,
        private_key_pem: &str,
    ) -> SyncResult<Self> {
        debug!("Creating HTTP client with mTLS");

        // Combine certificate and private key into PKCS#12/PEM identity
        let identity_pem = format!("{}\n{}", certificate_pem, private_key_pem);
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
            SyncError::Certificate(format!("Invalid client certificate/key: {}", e))
        })?;

        let mut builder = ClientBuilder::new()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
            .min_tls_version(MIN_TLS_VERSION) // NFR-S1: TLS 1.3 minimum
            .user_agent(format!("{}/{}", AGENT_NAME, AGENT_VERSION))
            .identity(identity);

        // SECURITY: Disabling TLS verification is only allowed in debug builds
        #[cfg(debug_assertions)]
        if !config.tls_verify {
            debug!("TLS verification disabled (development mode — debug build only)");
            builder = builder.danger_accept_invalid_certs(true);
        }
        #[cfg(not(debug_assertions))]
        if !config.tls_verify {
            tracing::warn!("tls_verify=false is ignored in release builds for security");
        }

        // Configure custom CA certificate if provided
        if let Some(ref ca_path) = config.ca_cert_path {
            debug!("Loading custom CA certificate from: {}", ca_path);
            let ca_cert = std::fs::read(ca_path).map_err(|e| {
                SyncError::Certificate(format!("Failed to read CA certificate: {}", e))
            })?;
            let cert = reqwest::Certificate::from_pem(&ca_cert)
                .map_err(|e| SyncError::Certificate(format!("Invalid CA certificate: {}", e)))?;
            builder = builder.add_root_certificate(cert);
        }

        // Configure proxy if provided
        if let Some(ref proxy_config) = config.proxy {
            debug!("Configuring proxy: {}", proxy_config.url);
            let mut proxy = reqwest::Proxy::all(&proxy_config.url)
                .map_err(|e| SyncError::Config(format!("Invalid proxy URL: {}", e)))?;

            if let (Some(user), Some(pass)) = (&proxy_config.username, &proxy_config.password) {
                proxy = proxy.basic_auth(user, pass);
            }

            builder = builder.proxy(proxy);
        }

        let client = builder
            .build()
            .map_err(|e| SyncError::Config(format!("Failed to build mTLS HTTP client: {}", e)))?;

        Ok(Self {
            client,
            base_url: config.server_url.trim_end_matches('/').to_string(),
            auth_certificate: None,
            organization_id: config.organization_id.clone(),
        })
    }

    /// Check if this client uses mTLS (has identity configured).
    pub fn is_mtls(&self) -> bool {
        // Note: reqwest doesn't expose whether identity is set,
        // so we track this separately in AuthenticatedClient
        false
    }

    /// Get the base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Build a URL for an API endpoint.
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    /// Get the underlying reqwest client.
    pub fn inner(&self) -> &Client {
        &self.client
    }

    /// Apply authentication headers (X-Agent-Certificate, X-Organization-Id).
    fn apply_auth(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let mut b = builder;
        if let Some(ref cert) = self.auth_certificate {
            b = b.header("X-Agent-Certificate", cert);
        }
        if let Some(ref org_id) = self.organization_id {
            b = b.header("X-Organization-Id", org_id);
        }
        b
    }

    /// Send a POST request with JSON body.
    pub async fn post_json<T, R>(&self, path: &str, body: &T) -> SyncResult<R>
    where
        T: serde::Serialize,
        R: serde::de::DeserializeOwned,
    {
        let url = self.url(path);
        debug!("POST {}", url);

        let request = self
            .client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCEPT, "application/json")
            .json(body);

        let response = self.apply_auth(request).send().await.map_err(|e| {
            if e.is_timeout() {
                SyncError::Timeout
            } else if e.is_connect() {
                SyncError::connection(e.to_string())
            } else {
                SyncError::Http(e)
            }
        })?;

        self.handle_response(response).await
    }

    /// Send a POST request with JSON body and bearer token authentication.
    pub async fn post_json_with_token<T, R>(
        &self,
        path: &str,
        body: &T,
        token: &str,
    ) -> SyncResult<R>
    where
        T: serde::Serialize,
        R: serde::de::DeserializeOwned,
    {
        let url = self.url(path);
        debug!("Base URL: '{}'", self.base_url);
        debug!("POST {} (with bearer token)", url);

        // Trim token to prevent invalid header values (e.g. newlines)
        let trimmed_token = token.trim();

        let response = self
            .client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCEPT, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", trimmed_token))
            .json(body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    SyncError::Timeout
                } else if e.is_connect() {
                    SyncError::connection(e.to_string())
                } else {
                    SyncError::Http(e)
                }
            })?;

        self.handle_response(response).await
    }

    /// Send a GET request.
    pub async fn get<R>(&self, path: &str) -> SyncResult<R>
    where
        R: serde::de::DeserializeOwned,
    {
        let url = self.url(path);
        debug!("GET {}", url);

        let request = self
            .client
            .get(&url)
            .header(header::ACCEPT, "application/json");

        let response = self.apply_auth(request).send().await.map_err(|e| {
            if e.is_timeout() {
                SyncError::Timeout
            } else if e.is_connect() {
                SyncError::connection(e.to_string())
            } else {
                SyncError::Http(e)
            }
        })?;

        self.handle_response(response).await
    }

    /// Send a GET request with optional If-None-Match header for conditional fetch.
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
        let url = self.url(path);
        debug!("GET {} (If-None-Match: {:?})", url, if_none_match);

        let mut request = self
            .client
            .get(&url)
            .header(header::ACCEPT, "application/json");

        // Add If-None-Match header if we have an ETag
        if let Some(etag) = if_none_match {
            request = request.header(header::IF_NONE_MATCH, etag);
        }

        let response = self.apply_auth(request).send().await.map_err(|e| {
            if e.is_timeout() {
                SyncError::Timeout
            } else if e.is_connect() {
                SyncError::connection(e.to_string())
            } else {
                SyncError::Http(e)
            }
        })?;

        let status = response.status();
        debug!("Response status: {}", status);

        // Handle 304 Not Modified
        if status == reqwest::StatusCode::NOT_MODIFIED {
            debug!("Server returned 304 Not Modified");
            return Ok(None);
        }

        // Extract ETag from response headers
        let etag = response
            .headers()
            .get(header::ETAG)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        if status.is_success() {
            let body = response.json::<R>().await?;
            Ok(Some((body, etag)))
        } else {
            // Try to parse error response
            let error_text = response.text().await.unwrap_or_default();
            debug!("Error response body: {}", error_text);

            if let Ok(api_error) =
                serde_json::from_str::<crate::types::ApiErrorResponse>(&error_text)
            {
                Err(SyncError::server(status.as_u16(), api_error.message))
            } else {
                Err(SyncError::server(status.as_u16(), error_text))
            }
        }
    }

    /// Download binary data from a URL.
    ///
    /// This is used for downloading update packages.
    pub async fn download(&self, url: &str) -> SyncResult<Vec<u8>> {
        // Use the URL directly if it's an absolute URL, otherwise build from base
        let full_url = if url.starts_with("http://") || url.starts_with("https://") {
            url.to_string()
        } else {
            self.url(url)
        };

        debug!("Downloading from {}", full_url);

        let request = self.client.get(&full_url);
        let response = self.apply_auth(request).send().await.map_err(|e| {
            if e.is_timeout() {
                SyncError::Timeout
            } else if e.is_connect() {
                SyncError::connection(e.to_string())
            } else {
                SyncError::Http(e)
            }
        })?;

        let status = response.status();
        if !status.is_success() {
            return Err(SyncError::server(
                status.as_u16(),
                format!("Download failed: {}", status),
            ));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| SyncError::Config(format!("Failed to read download response: {}", e)))?;

        debug!("Downloaded {} bytes", bytes.len());

        Ok(bytes.to_vec())
    }

    /// Handle an HTTP response, extracting the body or error.
    async fn handle_response<R>(&self, response: reqwest::Response) -> SyncResult<R>
    where
        R: serde::de::DeserializeOwned,
    {
        let status = response.status();
        debug!("Response status: {}", status);

        if status.is_success() {
            let body_text = response.text().await.map_err(SyncError::Http)?;
            debug!("Response body: {}", body_text);

            let body = serde_json::from_str::<R>(&body_text).map_err(|e| {
                tracing::error!("Failed to decode response body: {}. Body was: {}", e, body_text);
                SyncError::Serialization(e)
            })?;
            Ok(body)
        } else {
            // Try to parse error response
            let error_text = response.text().await.unwrap_or_default();
            debug!("Error response body: {}", error_text);

            // Try to parse as API error
            if let Ok(api_error) =
                serde_json::from_str::<crate::types::ApiErrorResponse>(&error_text)
            {
                // Handle specific error codes
                match api_error.code.as_str() {
                    "INVALID_TOKEN" | "TOKEN_EXPIRED" => {
                        return Err(SyncError::InvalidToken(api_error.message));
                    }
                    "ALREADY_ENROLLED" => {
                        // Try to extract agent_id from details
                        let agent_id = api_error
                            .details
                            .as_ref()
                            .and_then(|d| d.get("agent_id"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        return Err(SyncError::AlreadyEnrolled(agent_id));
                    }
                    _ => {
                        return Err(SyncError::server(status.as_u16(), api_error.message));
                    }
                }
            }

            Err(SyncError::server(status.as_u16(), error_text))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> AgentConfig {
        AgentConfig {
            server_url: "https://api.test.com".to_string(),
            tls_verify: false, // For testing
            ..Default::default()
        }
    }

    #[test]
    fn test_client_creation_for_enrollment() {
        let config = test_config();
        let client = HttpClient::for_enrollment(&config);
        assert!(client.is_ok());
    }

    #[test]
    fn test_url_building() {
        let config = test_config();
        let client = HttpClient::for_enrollment(&config).unwrap();

        assert_eq!(
            client.url("/v1/agents/enroll"),
            "https://api.test.com/v1/agents/enroll"
        );
    }

    #[test]
    fn test_url_building_trailing_slash() {
        let config = AgentConfig {
            server_url: "https://api.test.com/".to_string(),
            tls_verify: false,
            ..Default::default()
        };
        let client = HttpClient::for_enrollment(&config).unwrap();

        // Trailing slash should be trimmed
        assert_eq!(
            client.url("/v1/agents/enroll"),
            "https://api.test.com/v1/agents/enroll"
        );
    }

    #[test]
    fn test_base_url() {
        let config = test_config();
        let client = HttpClient::for_enrollment(&config).unwrap();

        assert_eq!(client.base_url(), "https://api.test.com");
    }
}
