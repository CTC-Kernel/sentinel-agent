//! Storage error types.

use thiserror::Error;

/// Result type for storage operations.
pub type StorageResult<T> = Result<T, StorageError>;

/// Storage errors.
#[derive(Debug, Error)]
pub enum StorageError {
    /// Database initialization error.
    #[error("database initialization failed: {0}")]
    Initialization(String),

    /// Database connection error.
    #[error("database connection error: {0}")]
    Connection(String),

    /// Encryption error.
    #[error("encryption error: {0}")]
    Encryption(String),

    /// Key management error.
    #[error("key management error: {0}")]
    KeyManagement(String),

    /// Query error.
    #[error("query error: {0}")]
    Query(String),

    /// Migration error.
    #[error("migration error: {0}")]
    Migration(String),

    /// I/O error.
    #[error("I/O error: {0}")]
    Io(String),

    /// Data integrity error.
    #[error("data integrity error: {0}")]
    Integrity(String),

    /// Not found error.
    #[error("not found: {0}")]
    NotFound(String),
}

impl From<rusqlite::Error> for StorageError {
    fn from(err: rusqlite::Error) -> Self {
        StorageError::Query(err.to_string())
    }
}

impl From<std::io::Error> for StorageError {
    fn from(err: std::io::Error) -> Self {
        StorageError::Io(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = StorageError::Initialization("test error".to_string());
        assert!(err.to_string().contains("test error"));
    }

    #[test]
    fn test_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let storage_err: StorageError = io_err.into();
        assert!(matches!(storage_err, StorageError::Io(_)));
    }
}
