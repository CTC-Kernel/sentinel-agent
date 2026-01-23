//! Scanner error types.

use thiserror::Error;

/// Result type for scanner operations.
pub type ScannerResult<T> = Result<T, ScannerError>;

/// Errors that can occur during scanner operations.
#[derive(Debug, Error)]
pub enum ScannerError {
    /// Check execution error.
    #[error("Check execution failed: {0}")]
    CheckExecution(String),

    /// Check timeout error.
    #[error("Check timed out after {0}ms")]
    Timeout(u64),

    /// Check not found error.
    #[error("Check not found: {0}")]
    CheckNotFound(String),

    /// Check disabled error.
    #[error("Check is disabled: {0}")]
    CheckDisabled(String),

    /// Platform not supported error.
    #[error("Check not supported on this platform: {0}")]
    PlatformNotSupported(String),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    Config(String),

    /// Storage error.
    #[error("Storage error: {0}")]
    Storage(String),

    /// Scheduler error.
    #[error("Scheduler error: {0}")]
    Scheduler(String),

    /// Proof generation error.
    #[error("Proof generation failed: {0}")]
    ProofGeneration(String),

    /// Command execution error.
    #[error("Command execution failed: {0}")]
    Command(String),

    /// Parse error.
    #[error("Parse error: {0}")]
    Parse(String),

    /// Unsupported operation error.
    #[error("Unsupported: {0}")]
    Unsupported(String),

    /// Internal error.
    #[error("Internal error: {0}")]
    Internal(String),
}

impl ScannerError {
    /// Check if the error is recoverable.
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            ScannerError::Timeout(_)
                | ScannerError::CheckExecution(_)
                | ScannerError::Storage(_)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = ScannerError::Timeout(30000);
        assert_eq!(err.to_string(), "Check timed out after 30000ms");

        let err = ScannerError::CheckNotFound("disk_encryption".to_string());
        assert_eq!(err.to_string(), "Check not found: disk_encryption");
    }

    #[test]
    fn test_is_recoverable() {
        assert!(ScannerError::Timeout(1000).is_recoverable());
        assert!(ScannerError::CheckExecution("failed".to_string()).is_recoverable());
        assert!(!ScannerError::CheckNotFound("test".to_string()).is_recoverable());
        assert!(!ScannerError::Config("invalid".to_string()).is_recoverable());
    }
}
