//! Error types for the Sentinel GRC Agent.
//!
//! This module defines the common error types used across all agent crates.

use thiserror::Error;

/// Common error type for the agent.
///
/// All crate-specific errors should wrap or convert to this type
/// when crossing crate boundaries.
#[derive(Error, Debug)]
pub enum CommonError {
    /// Configuration-related errors.
    #[error("configuration error: {0}")]
    Config(String),

    /// I/O errors.
    #[error("I/O error: {0}")]
    Io(String),

    /// Serialization/deserialization errors.
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Validation errors.
    #[error("validation error: {0}")]
    Validation(String),

    /// Network errors.
    #[error("network error: {0}")]
    Network(String),

    /// Wrapped error with context.
    #[error("{context}: {message}")]
    Wrapped {
        /// Context describing where the error occurred.
        context: String,
        /// The error message.
        message: String,
    },

    /// System-related errors.
    #[error("system error: {0}")]
    System(String),

    /// Feature not supported.
    #[error("not supported: {0}")]
    NotSupported(String),

    /// Generic error for unexpected conditions.
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for CommonError {
    fn from(err: std::io::Error) -> Self {
        Self::Io(err.to_string())
    }
}

impl CommonError {
    /// Create a new configuration error.
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create a new validation error.
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    /// Create a new network error.
    pub fn network(msg: impl Into<String>) -> Self {
        Self::Network(msg.into())
    }

    /// Create a wrapped error with context.
    pub fn wrap(context: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Wrapped {
            context: context.into(),
            message: message.into(),
        }
    }

    /// Create a new I/O error.
    pub fn io(msg: impl Into<String>) -> Self {
        Self::Io(msg.into())
    }

    /// Create a new system error.
    pub fn system(msg: impl Into<String>) -> Self {
        Self::System(msg.into())
    }

    /// Create a new not supported error.
    pub fn not_supported(msg: impl Into<String>) -> Self {
        Self::NotSupported(msg.into())
    }

    /// Create an internal error.
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

/// Result type alias using CommonError.
pub type Result<T> = std::result::Result<T, CommonError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_error_display() {
        let err = CommonError::config("invalid server URL");
        assert_eq!(err.to_string(), "configuration error: invalid server URL");
    }

    #[test]
    fn test_validation_error_display() {
        let err = CommonError::validation("check_interval must be positive");
        assert_eq!(
            err.to_string(),
            "validation error: check_interval must be positive"
        );
    }

    #[test]
    fn test_wrapped_error_display() {
        let err = CommonError::wrap("loading config", "file not found");
        assert_eq!(err.to_string(), "loading config: file not found");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let common_err: CommonError = io_err.into();
        assert!(common_err.to_string().contains("I/O error"));
    }
}
