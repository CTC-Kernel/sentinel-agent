// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Common constants for the Sentinel GRC Agent.

/// Agent version string.
pub const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Agent name.
pub const AGENT_NAME: &str = "sentinel-grc-agent";

/// Default heartbeat interval in seconds.
pub const DEFAULT_HEARTBEAT_INTERVAL_SECS: u64 = 60;

/// Default check interval in seconds (1 hour).
pub const DEFAULT_CHECK_INTERVAL_SECS: u64 = 3600;

/// Maximum offline mode duration in days.
pub const MAX_OFFLINE_MODE_DAYS: u32 = 30;

/// Default offline mode duration in days.
pub const DEFAULT_OFFLINE_MODE_DAYS: u32 = 7;

/// Proof retention period in days (12 months).
pub const PROOF_RETENTION_DAYS: u32 = 365;

/// Maximum check execution time in seconds.
pub const MAX_CHECK_TIMEOUT_SECS: u64 = 30;

/// Maximum number of retries for sync operations.
pub const MAX_SYNC_RETRIES: u32 = 5;

/// Base backoff duration for retries in milliseconds.
pub const RETRY_BACKOFF_BASE_MS: u64 = 1000;

/// Maximum backoff duration for retries in milliseconds.
pub const RETRY_BACKOFF_MAX_MS: u64 = 300_000; // 5 minutes

/// Database file name.
pub const DB_FILE_NAME: &str = "agent.db";

/// Configuration file name.
pub const CONFIG_FILE_NAME: &str = "agent.json";

/// Firebase project ID used to construct default URLs.
///
/// Override at runtime via the `server_url` field in `agent.json`.
/// **Open-source users**: replace with your own Firebase project ID.
pub const FIREBASE_PROJECT_ID: &str = "YOUR_FIREBASE_PROJECT_ID";

/// Firebase Storage bucket.
///
/// **Open-source users**: replace with your own Firebase Storage bucket.
pub const FIREBASE_STORAGE_BUCKET: &str = "YOUR_FIREBASE_PROJECT_ID.firebasestorage.app";

/// Default server URL (Firebase Cloud Functions).
///
/// This is the **API** endpoint used by the agent for enrollment, heartbeats,
/// and data uploads.  It is *not* the web dashboard URL visible to end users.
/// **Open-source users**: replace with your own Cloud Functions endpoint.
pub const DEFAULT_SERVER_URL: &str =
    "https://YOUR_REGION-YOUR_FIREBASE_PROJECT_ID.cloudfunctions.net/agentApi";

/// Base URL for release artifacts in Firebase Storage.
///
/// **Open-source users**: replace with your own releases path.
pub const RELEASES_BASE_URL: &str =
    "https://storage.googleapis.com/YOUR_FIREBASE_PROJECT_ID.firebasestorage.app/releases/agent";

/// Log file name.
pub const LOG_FILE_NAME: &str = "agent.log";

/// Maximum log file size in bytes (10 MB).
pub const MAX_LOG_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// Number of log files to retain.
pub const LOG_FILES_TO_RETAIN: u32 = 5;

/// HTTP request timeout in seconds.
pub const HTTP_TIMEOUT_SECS: u64 = 30;

/// HTTP connection timeout in seconds.
pub const HTTP_CONNECT_TIMEOUT_SECS: u64 = 10;

/// Seconds per day (86 400).
pub const SECS_PER_DAY: u64 = 86_400;

#[cfg(windows)]
/// Default installation directory on Windows.
pub const DEFAULT_INSTALL_DIR: &str = "\\Program Files\\Sentinel";

#[cfg(windows)]
/// Default data directory on Windows.
pub const DEFAULT_DATA_DIR: &str = "\\ProgramData\\Sentinel";

#[cfg(not(windows))]
/// Default installation directory on Linux.
pub const DEFAULT_INSTALL_DIR: &str = "/opt/sentinel-grc";

#[cfg(not(windows))]
/// Default data directory on Linux.
pub const DEFAULT_DATA_DIR: &str = "/var/lib/sentinel-grc";

// Compile-time assertions to ensure constants have valid values
const _: () = {
    assert!(DEFAULT_HEARTBEAT_INTERVAL_SECS > 0);
    assert!(DEFAULT_CHECK_INTERVAL_SECS > 0);
    assert!(DEFAULT_OFFLINE_MODE_DAYS > 0);
    assert!(PROOF_RETENTION_DAYS > 0);
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants_are_defined() {
        assert!(!AGENT_VERSION.is_empty());
        assert!(!AGENT_NAME.is_empty());
        // Values are validated at compile time via const assertion above
        assert_eq!(DEFAULT_CHECK_INTERVAL_SECS, 3600);
        assert_eq!(DEFAULT_OFFLINE_MODE_DAYS, 7);
    }
}
