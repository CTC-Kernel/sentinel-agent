//! Network module error types.

use thiserror::Error;

/// Network module result type.
pub type NetworkResult<T> = Result<T, NetworkError>;

/// Network module errors.
#[derive(Debug, Error)]
pub enum NetworkError {
    /// Failed to collect network interfaces.
    #[error("Failed to collect network interfaces: {0}")]
    InterfaceCollection(String),

    /// Failed to collect network connections.
    #[error("Failed to collect network connections: {0}")]
    ConnectionCollection(String),

    /// Failed to collect routing table.
    #[error("Failed to collect routing table: {0}")]
    RouteCollection(String),

    /// Failed to collect DNS configuration.
    #[error("Failed to collect DNS configuration: {0}")]
    DnsCollection(String),

    /// Platform not supported.
    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),

    /// Command execution failed.
    #[error("Command execution failed: {0}")]
    CommandFailed(String),

    /// Parse error.
    #[error("Parse error: {0}")]
    ParseError(String),

    /// I/O error.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization error.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Detection error.
    #[error("Detection error: {0}")]
    Detection(String),

    /// Sync error.
    #[error("Sync error: {0}")]
    Sync(String),
}

impl NetworkError {
    /// Check if the error is recoverable (can retry).
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            NetworkError::CommandFailed(_) | NetworkError::Io(_) | NetworkError::Sync(_)
        )
    }
}
