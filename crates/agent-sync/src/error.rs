//! Sync-specific error types.
//!
//! This module defines errors that can occur during SaaS communication.

use thiserror::Error;

/// Errors that can occur during sync operations.
#[derive(Debug, Error)]
pub enum SyncError {
    /// HTTP request failed.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// Server returned an error response.
    #[error("Server error (status {status}): {message}")]
    ServerError {
        /// HTTP status code.
        status: u16,
        /// Error message from server.
        message: String,
    },

    /// Invalid or expired enrollment token.
    #[error("Invalid or expired enrollment token: {0}")]
    InvalidToken(String),

    /// Agent already enrolled.
    #[error("Agent already enrolled with ID: {0}")]
    AlreadyEnrolled(String),

    /// Agent not enrolled.
    #[error("Agent not enrolled. Please enroll first.")]
    NotEnrolled,

    /// Certificate error.
    #[error("Certificate error: {0}")]
    Certificate(String),

    /// Storage error.
    #[error("Storage error: {0}")]
    Storage(#[from] agent_storage::StorageError),

    /// Serialization error.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    Config(String),

    /// Network timeout.
    #[error("Request timed out")]
    Timeout,

    /// Connection refused or unavailable.
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    /// Server certificate validation failed.
    #[error("Server certificate validation failed: {0}")]
    CertificateValidation(String),
}

/// Result type for sync operations.
pub type SyncResult<T> = Result<T, SyncError>;

impl SyncError {
    /// Check if this error is retryable.
    pub fn is_retryable(&self) -> bool {
        match self {
            SyncError::Http(e) => e.is_timeout() || e.is_connect(),
            SyncError::ServerError { status, .. } => {
                // Retry on 5xx errors and 429 (rate limit)
                *status >= 500 || *status == 429
            }
            SyncError::Timeout | SyncError::ConnectionFailed(_) => true,
            // Non-retryable errors
            SyncError::InvalidToken(_)
            | SyncError::AlreadyEnrolled(_)
            | SyncError::NotEnrolled
            | SyncError::Certificate(_)
            | SyncError::Storage(_)
            | SyncError::Serialization(_)
            | SyncError::Config(_)
            | SyncError::CertificateValidation(_) => false,
        }
    }

    /// Create a server error from status and message.
    pub fn server(status: u16, message: impl Into<String>) -> Self {
        SyncError::ServerError {
            status,
            message: message.into(),
        }
    }

    /// Create a config error.
    pub fn config(message: impl Into<String>) -> Self {
        SyncError::Config(message.into())
    }

    /// Create a connection failed error.
    pub fn connection(message: impl Into<String>) -> Self {
        SyncError::ConnectionFailed(message.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_error_display() {
        let err = SyncError::server(401, "Unauthorized");
        assert_eq!(err.to_string(), "Server error (status 401): Unauthorized");
    }

    #[test]
    fn test_is_retryable_timeout() {
        let err = SyncError::Timeout;
        assert!(err.is_retryable());
    }

    #[test]
    fn test_is_retryable_connection() {
        let err = SyncError::connection("refused");
        assert!(err.is_retryable());
    }

    #[test]
    fn test_is_retryable_server_500() {
        let err = SyncError::server(500, "Internal Server Error");
        assert!(err.is_retryable());
    }

    #[test]
    fn test_is_retryable_server_429() {
        let err = SyncError::server(429, "Too Many Requests");
        assert!(err.is_retryable());
    }

    #[test]
    fn test_not_retryable_invalid_token() {
        let err = SyncError::InvalidToken("expired".to_string());
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_not_retryable_server_400() {
        let err = SyncError::server(400, "Bad Request");
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_not_retryable_already_enrolled() {
        let err = SyncError::AlreadyEnrolled("agent-123".to_string());
        assert!(!err.is_retryable());
    }
}
