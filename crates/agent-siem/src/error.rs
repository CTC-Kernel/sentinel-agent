//! SIEM error types.

use thiserror::Error;

/// SIEM-related errors.
#[derive(Debug, Error)]
pub enum SiemError {
    /// Event formatting error.
    #[error("Failed to format event: {0}")]
    FormatError(String),

    /// Transport connection error.
    #[error("Connection error: {0}")]
    ConnectionError(String),

    /// Transport send error.
    #[error("Send error: {0}")]
    SendError(String),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// Serialization error.
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    /// IO error.
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// TLS error.
    #[error("TLS error: {0}")]
    TlsError(String),

    /// Authentication error.
    #[error("Authentication error: {0}")]
    AuthError(String),

    /// Rate limit exceeded.
    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    /// Timeout error.
    #[error("Operation timed out")]
    Timeout,
}

/// Result type for SIEM operations.
pub type SiemResult<T> = Result<T, SiemError>;
