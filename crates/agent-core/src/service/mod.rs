//! Service management for the Sentinel GRC Agent.
//!
//! This module provides platform-specific service implementations:
//! - Windows: Windows Service (SCM)
//! - Linux: systemd service
//! - macOS: launchd (future)

#[cfg(windows)]
mod windows;

#[cfg(windows)]
pub use windows::*;

#[cfg(unix)]
mod unix;

#[cfg(unix)]
pub use unix::*;

/// Service name used for registration.
pub const SERVICE_NAME: &str = "SentinelGRCAgent";

/// Service display name shown in service managers.
pub const SERVICE_DISPLAY_NAME: &str = "Sentinel GRC Agent";

/// Service description.
pub const SERVICE_DESCRIPTION: &str =
    "Endpoint compliance monitoring agent for Sentinel GRC platform";

/// Service state enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceState {
    /// Service is stopped.
    Stopped,
    /// Service is starting.
    Starting,
    /// Service is running.
    Running,
    /// Service is stopping.
    Stopping,
    /// Service is paused.
    Paused,
}

impl std::fmt::Display for ServiceState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceState::Stopped => write!(f, "Stopped"),
            ServiceState::Starting => write!(f, "Starting"),
            ServiceState::Running => write!(f, "Running"),
            ServiceState::Stopping => write!(f, "Stopping"),
            ServiceState::Paused => write!(f, "Paused"),
        }
    }
}

/// Service control commands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceCommand {
    /// Start the service.
    Start,
    /// Stop the service.
    Stop,
    /// Pause the service (Windows only).
    Pause,
    /// Continue after pause (Windows only).
    Continue,
}

/// Result type for service operations.
pub type ServiceResult<T> = Result<T, ServiceError>;

/// Service operation errors.
#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    /// Service is already installed.
    #[error("service is already installed")]
    AlreadyInstalled,

    /// Service is not installed.
    #[error("service is not installed")]
    NotInstalled,

    /// Service is already running.
    #[error("service is already running")]
    AlreadyRunning,

    /// Service is not running.
    #[error("service is not running")]
    NotRunning,

    /// Permission denied.
    #[error("permission denied: {0}")]
    PermissionDenied(String),

    /// System error.
    #[error("system error: {0}")]
    System(String),

    /// Platform not supported.
    #[error("operation not supported on this platform")]
    NotSupported,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_state_display() {
        assert_eq!(ServiceState::Stopped.to_string(), "Stopped");
        assert_eq!(ServiceState::Running.to_string(), "Running");
        assert_eq!(ServiceState::Starting.to_string(), "Starting");
        assert_eq!(ServiceState::Stopping.to_string(), "Stopping");
        assert_eq!(ServiceState::Paused.to_string(), "Paused");
    }

    #[test]
    fn test_service_constants() {
        assert!(!SERVICE_NAME.is_empty());
        assert!(!SERVICE_DISPLAY_NAME.is_empty());
        assert!(!SERVICE_DESCRIPTION.is_empty());
    }
}
