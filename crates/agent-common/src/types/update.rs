use serde::{Deserialize, Serialize};

/// Information about a software update retrieved from remote storage.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateInfo {
    /// The version of the latest available release (e.g., "2.0.1")
    pub version: String,
    /// The release date (YYYY-MM-DD)
    pub date: String,
}

/// Status of the update process.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    /// Checking for updates.
    Idle,
    /// Update available, version number included.
    Available(String),
    /// No update available.
    UpToDate,
    /// Downloading the update. Progress from 0.0 to 1.0.
    Downloading(f32),
    /// Verifying the download.
    Verifying,
    /// Installing the update.
    Installing,
    /// Update completed successfully.
    Completed,
    /// Update failed with error message.
    Failed(String),
}
