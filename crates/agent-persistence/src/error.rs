//! Persistence error types.

use thiserror::Error;

/// Result type for persistence operations.
pub type PersistenceResult<T> = Result<T, PersistenceError>;

/// Persistence errors.
#[derive(Debug, Error)]
pub enum PersistenceError {
    /// Backup creation failed.
    #[error("backup failed: {0}")]
    Backup(String),

    /// Restore from backup failed.
    #[error("restore failed: {0}")]
    Restore(String),

    /// Recovery operation failed.
    #[error("recovery failed: {0}")]
    Recovery(String),

    /// Integrity check failed.
    #[error("integrity check failed: {0}")]
    Integrity(String),

    /// Migration (export/import identity) failed.
    #[error("migration failed: {0}")]
    Migration(String),

    /// Key rotation failed.
    #[error("key rotation failed: {0}")]
    KeyRotation(String),

    /// Cleanup operation failed.
    #[error("cleanup failed: {0}")]
    Cleanup(String),

    /// Storage error.
    #[error("storage error: {0}")]
    Storage(#[from] agent_storage::StorageError),

    /// I/O error.
    #[error("I/O error: {0}")]
    Io(String),

    /// Serialization error.
    #[error("serialization error: {0}")]
    Serialization(String),

    /// Not found.
    #[error("not found: {0}")]
    NotFound(String),
}

impl From<std::io::Error> for PersistenceError {
    fn from(err: std::io::Error) -> Self {
        PersistenceError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for PersistenceError {
    fn from(err: serde_json::Error) -> Self {
        PersistenceError::Serialization(err.to_string())
    }
}
