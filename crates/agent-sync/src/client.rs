// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! HTTP client configuration for SaaS communication.
//!
//! This module provides configured HTTP clients for communicating with the
//! Sentinel GRC SaaS API with proper TLS, timeouts, and compression.

use crate::error::{SyncError, SyncResult};
use agent_common::config::AgentConfig;
use agent_common::constants::{
    AGENT_NAME, AGENT_VERSION, HTTP_CONNECT_TIMEOUT_SECS, HTTP_TIMEOUT_SECS,
};
use futures_util::StreamExt;
use reqwest::{Client, ClientBuilder, header, tls};
use std::time::Duration;
use tracing::debug;

/// Maximum download size in bytes (500 MB).
const MAX_DOWNLOAD_SIZE: u64 = 500 * 1024 * 1024;

/// Maximum length of response body text shown in logs.
const MAX_LOG_BODY_LEN: usize = 200;

/// Truncate a string for safe logging, appending "[truncated]" if it exceeds the limit.
fn truncate_for_log(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        // Find a valid UTF-8 char boundary at or before max_len
        let end = s
            .char_indices()
            .take_while(|&(i, _)| i <= max_len)
            .last()
            .map(|(i, _)| i)
            .unwrap_or(0);
        format!("{}... [truncated, total {} bytes]", &s[..end], s.len())
    } else {
        s.to_string()
    }
}

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
    /// Whether the client was created with mTLS identity.
    mtls_enabled: bool,
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
            tracing::error!("SECURITY: tls_verify=false is forbidden in release builds — ignoring");
            // TLS verification is always enforced in release builds regardless of config.
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
            mtls_enabled: false,
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
            tracing::error!("SECURITY: tls_verify=false is forbidden in release builds — ignoring");
            // TLS verification is always enforced in release builds regardless of config.
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
            mtls_enabled: false,
        })
    }

    /// Create a new HTTP client with mTLS for authenticated communication.
    ///
    /// This client is used after enrollment when the agent has its
    /// client certificate for mutual TLS authentication.
    ///
    /// **Note on Firebase deployment:** When the SaaS backend runs on Firebase
    /// Cloud Functions, the Google load balancer terminates TLS before the request
    /// reaches the function. This means mTLS client certificates are NOT verified
    /// at the transport layer. Authentication falls back to the `X-Agent-Certificate`
    /// header set by `with_header_auth()`. The mTLS identity is still configured here
    /// for forward-compatibility with custom server deployments that support mTLS.
    pub fn with_mtls(
        config: &AgentConfig,
        certificate_pem: &str,
        private_key_pem: &str,
    ) -> SyncResult<Self> {
        debug!("Creating HTTP client with mTLS");

        // Normalize and ensure certificate and key are in valid PEM format
        let cert = Self::ensure_pem(certificate_pem, "CERTIFICATE");
        let key = Self::ensure_pem(private_key_pem, "PRIVATE KEY");

        debug!(
            "mTLS cert format: starts_with_begin={}, len={}, key format: starts_with_begin={}, len={}",
            cert.starts_with("-----BEGIN "),
            cert.len(),
            key.starts_with("-----BEGIN "),
            key.len(),
        );

        // Combine certificate and private key into PEM identity
        let identity_pem = format!("{}\n{}", cert, key);
        let identity = match reqwest::Identity::from_pem(identity_pem.as_bytes()) {
            Ok(id) => id,
            Err(e) => {
                // If the key was wrapped as PKCS#8 ("PRIVATE KEY") but is actually PKCS#1,
                // try re-wrapping as "RSA PRIVATE KEY"
                debug!("Identity::from_pem failed with PRIVATE KEY label: {}", e);
                let key_rsa = Self::ensure_pem(private_key_pem, "RSA PRIVATE KEY");
                let identity_pem_rsa = format!("{}\n{}", cert, key_rsa);
                reqwest::Identity::from_pem(identity_pem_rsa.as_bytes()).map_err(|e2| {
                    SyncError::Certificate(format!(
                        "Invalid client certificate/key (tried PKCS#8 and PKCS#1): {}",
                        e2
                    ))
                })?
            }
        };

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
            tracing::error!("SECURITY: tls_verify=false is forbidden in release builds — ignoring");
            // TLS verification is always enforced in release builds regardless of config.
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

        let client = builder.build().map_err(|e| {
            // Extract the PEM label from the key for diagnostics (without logging key material)
            let key_label = key
                .lines()
                .next()
                .unwrap_or("(empty)")
                .trim_start_matches("-----BEGIN ")
                .trim_end_matches("-----");
            SyncError::Config(format!(
                "Failed to build mTLS HTTP client: {}. Key type: '{}', cert lines: {}, key lines: {}",
                e,
                key_label,
                cert.lines().count(),
                key.lines().count(),
            ))
        })?;

        Ok(Self {
            client,
            base_url: config.server_url.trim_end_matches('/').to_string(),
            auth_certificate: None,
            organization_id: config.organization_id.clone(),
            mtls_enabled: true,
        })
    }

    /// Ensure a credential string is in valid PEM format.
    ///
    /// Handles several common formats from server APIs:
    /// - Already valid PEM: returned after normalizing line endings
    /// - PEM with literal `\n` escape sequences (common from JSON APIs): unescaped
    /// - Raw base64 (no PEM headers): wrapped with the appropriate header/footer
    fn ensure_pem(data: &str, label: &str) -> String {
        // Step 1: Replace literal "\n" / "\r\n" escape sequences with actual newlines.
        // This handles double-escaped PEM from JSON APIs where the server returns
        // the certificate with escaped newlines (e.g., "-----BEGIN CERTIFICATE-----\\nMIIB...")
        let normalized = data
            .replace("\\r\\n", "\n")
            .replace("\\n", "\n")
            .replace("\r\n", "\n");
        let trimmed = normalized.trim();

        // Step 2: If it already has PEM headers, preserve the original label
        // (e.g., "RSA PRIVATE KEY" vs "PRIVATE KEY") and just normalize formatting
        if trimmed.starts_with("-----BEGIN ") {
            return trimmed.to_string();
        }

        // Step 3: Raw base64 — strip whitespace and wrap with PEM headers
        let clean: String = trimmed.chars().filter(|c| !c.is_whitespace()).collect();
        // Wrap in 64-char lines as per PEM spec.
        // Since we filtered to ASCII-only characters above, all chunks are
        // guaranteed to be valid UTF-8 — the expect() documents this invariant.
        let lines: Vec<&str> = clean
            .as_bytes()
            .chunks(64)
            .map(|chunk| {
                std::str::from_utf8(chunk)
                    .expect("BUG: ASCII-filtered base64 produced invalid UTF-8 chunk")
            })
            .collect();
        format!(
            "-----BEGIN {}-----\n{}\n-----END {}-----",
            label,
            lines.join("\n"),
            label
        )
    }

    /// Check if this client uses mTLS (has identity configured).
    pub fn is_mtls(&self) -> bool {
        self.mtls_enabled
    }

    /// Get the base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Build a URL for an API endpoint.
    pub fn url(&self, path: &str) -> String {
        let path = path.strip_prefix('/').unwrap_or(path);
        format!("{}/{}", self.base_url, path)
    }

    /// Get the underlying reqwest client.
    pub fn inner(&self) -> &Client {
        &self.client
    }

    /// Safely format a URL for logging by replacing the real base URL
    /// with a placeholder to avoid leaking the raw endpoint in logs.
    fn safe_log_url(&self, full_url: &str) -> String {
        full_url.replace(&self.base_url, "https://cyber-threat-consulting.com")
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
        debug!("POST {}", self.safe_log_url(&url));

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
        debug!("Base URL: '{}'", self.safe_log_url(&self.base_url));
        debug!(
            "POST {} (with bearer token, len={})",
            self.safe_log_url(&url),
            token.len()
        );

        // Trim token and strip non-ASCII characters to prevent invalid header values
        let trimmed_token: String = token
            .trim()
            .chars()
            .filter(|c| c.is_ascii() && *c != '\n' && *c != '\r')
            .collect();

        if trimmed_token.is_empty() {
            return Err(SyncError::Config(
                "Enrollment token is empty after sanitization".to_string(),
            ));
        }

        // Build the authorization header value explicitly to catch errors early
        let auth_value = format!("Bearer {}", trimmed_token);
        let auth_header = header::HeaderValue::from_str(&auth_value).map_err(|e| {
            tracing::error!(
                "Invalid authorization header value: {} (token len={})",
                e,
                trimmed_token.len()
            );
            SyncError::Config(format!(
                "Invalid enrollment token (contains invalid characters): {}",
                e
            ))
        })?;

        let response = self
            .client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ACCEPT, "application/json")
            .header(header::AUTHORIZATION, auth_header)
            .json(body)
            .send()
            .await
            .map_err(|e| {
                // Log the full error chain for debugging
                tracing::error!("Request failed: {}", e);
                if let Some(source) = std::error::Error::source(&e) {
                    tracing::error!("  caused by: {}", source);
                }
                if e.is_timeout() {
                    SyncError::Timeout
                } else if e.is_connect() {
                    SyncError::connection(e.to_string())
                } else if e.is_builder() {
                    SyncError::Config(format!("Request builder error: {}", e))
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
        debug!("GET {}", self.safe_log_url(&url));

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
        debug!(
            "GET {} (If-None-Match: {:?})",
            self.safe_log_url(&url),
            if_none_match
        );

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
            debug!(
                "Error response body: {}",
                truncate_for_log(&error_text, MAX_LOG_BODY_LEN)
            );

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
    /// Enforces a maximum download size of [`MAX_DOWNLOAD_SIZE`] bytes
    /// and streams the response to avoid buffering the entire payload in memory.
    pub async fn download(&self, url: &str) -> SyncResult<Vec<u8>> {
        // Use the URL directly if it's an absolute URL, otherwise build from base
        let full_url = if url.starts_with("https://") {
            url.to_string()
        } else if url.starts_with("http://") {
            // SECURITY: Reject plaintext HTTP downloads to prevent MITM
            return Err(SyncError::Config(
                "HTTP downloads are forbidden — only HTTPS is allowed".to_string(),
            ));
        } else {
            self.url(url)
        };

        debug!("Downloading from {}", self.safe_log_url(&full_url));

        let request = self.client.get(&full_url);

        // SECURITY: Only apply auth headers when downloading from our own server
        // to prevent credential leakage to third-party hosts
        let is_same_origin = full_url.starts_with(&self.base_url);
        let response = if is_same_origin {
            self.apply_auth(request).send().await
        } else {
            request.send().await
        }
        .map_err(|e| {
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

        // RC-2: Check Content-Length header before downloading
        if let Some(content_length) = response.content_length()
            && content_length > MAX_DOWNLOAD_SIZE
        {
            return Err(SyncError::Config(format!(
                "Download too large: {} bytes (max {} bytes)",
                content_length, MAX_DOWNLOAD_SIZE
            )));
        }

        // P-HIGH-01: Stream the response with a running byte counter
        let mut stream = response.bytes_stream();
        let mut buffer = Vec::new();
        let mut total_bytes: u64 = 0;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| SyncError::Config(format!("Failed to read download chunk: {}", e)))?;
            total_bytes += chunk.len() as u64;
            if total_bytes > MAX_DOWNLOAD_SIZE {
                return Err(SyncError::Config(format!(
                    "Download exceeded size limit: read {} bytes (max {} bytes)",
                    total_bytes, MAX_DOWNLOAD_SIZE
                )));
            }
            buffer.extend_from_slice(&chunk);
        }

        debug!("Downloaded {} bytes", total_bytes);

        Ok(buffer)
    }

    /// Send a DELETE request.
    pub async fn delete<R>(&self, path: &str) -> SyncResult<R>
    where
        R: serde::de::DeserializeOwned,
    {
        let url = self.url(path);
        debug!("DELETE {}", self.safe_log_url(&url));

        let request = self
            .client
            .delete(&url)
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

    /// Handle an HTTP response, extracting the body or error.
    async fn handle_response<R>(&self, response: reqwest::Response) -> SyncResult<R>
    where
        R: serde::de::DeserializeOwned,
    {
        let status = response.status();
        debug!("Response status: {}", status);

        if status.is_success() {
            let body_text = response.text().await.map_err(SyncError::Http)?;
            debug!(
                "Response body: {}",
                truncate_for_log(&body_text, MAX_LOG_BODY_LEN)
            );

            let body = serde_json::from_str::<R>(&body_text).map_err(|e| {
                tracing::error!(
                    "Failed to decode response body: {}. Body was: {}",
                    e,
                    truncate_for_log(&body_text, MAX_LOG_BODY_LEN)
                );
                SyncError::Serialization(e)
            })?;
            Ok(body)
        } else {
            // Try to parse error response
            let error_text = response.text().await.unwrap_or_default();
            debug!(
                "Error response body: {}",
                truncate_for_log(&error_text, MAX_LOG_BODY_LEN)
            );

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

    #[test]
    fn test_ensure_pem_already_pem() {
        let pem = "-----BEGIN CERTIFICATE-----\nMIIBxTCC...\n-----END CERTIFICATE-----";
        let result = HttpClient::ensure_pem(pem, "CERTIFICATE");
        assert_eq!(result, pem);
    }

    #[test]
    fn test_ensure_pem_raw_base64() {
        let raw = "MIIBxTCCAWugAwIBAgIUY2F0";
        let result = HttpClient::ensure_pem(raw, "CERTIFICATE");
        assert!(result.starts_with("-----BEGIN CERTIFICATE-----\n"));
        assert!(result.ends_with("\n-----END CERTIFICATE-----"));
        assert!(result.contains("MIIBxTCCAWugAwIBAgIUY2F0"));
    }

    #[test]
    fn test_ensure_pem_raw_base64_with_whitespace() {
        let raw = "  MIIBxTCC\n  AWugAwIB  \n";
        let result = HttpClient::ensure_pem(raw, "PRIVATE KEY");
        assert!(result.starts_with("-----BEGIN PRIVATE KEY-----\n"));
        assert!(result.contains("MIIBxTCCAWugAwIB"));
        // Whitespace should be stripped from the base64 content
        assert!(!result.contains("  "));
    }

    #[test]
    fn test_ensure_pem_long_base64_wraps_at_64_chars() {
        let raw = "A".repeat(128);
        let result = HttpClient::ensure_pem(&raw, "CERTIFICATE");
        let lines: Vec<&str> = result.lines().collect();
        // header + 2 data lines (64+64) + footer = 4 lines
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[1].len(), 64);
        assert_eq!(lines[2].len(), 64);
    }
}
