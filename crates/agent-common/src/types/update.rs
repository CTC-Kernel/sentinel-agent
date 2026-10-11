// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
    /// No update operation is running.
    Idle,
    /// Querying the public release catalog.
    Checking,
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

/// What the release server publishes next to an update package, signed with
/// the update key: which release the package is, and its exact content.
///
/// A signature over the package alone proves who built it, not which release
/// it is. Whoever controls the release server could announce a new version
/// and serve an older package, validly signed and with known flaws. Signing
/// the version together with the package's hash closes that.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateManifest {
    /// Version of the release (e.g. "4.0.44").
    pub version: String,
    /// File name of the package as published (e.g. "SentinelAgent-latest.pkg").
    pub package: String,
    /// SHA-256 of the package, hex.
    pub sha256: String,
    /// Size of the package in bytes.
    pub size: u64,
}

impl UpdateManifest {
    /// The bytes the signature covers.
    ///
    /// Built from the fields rather than from the JSON text, so the file may
    /// be re-indented, trimmed or re-encoded on its way without breaking the
    /// signature. [`UpdateManifest::validate`] keeps the fields free of line
    /// breaks, so two different manifests never produce the same message.
    pub fn signed_message(&self) -> Vec<u8> {
        format!(
            "sentinel-update-manifest-v1\n{}\n{}\n{}\n{}\n",
            self.version,
            self.package,
            self.sha256.to_ascii_lowercase(),
            self.size
        )
        .into_bytes()
    }

    /// Reject fields that are not what they claim to be. On failure, says
    /// which one.
    pub fn validate(&self) -> Result<(), String> {
        let version_ok = !self.version.is_empty()
            && self
                .version
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '+'));
        if !version_ok {
            return Err(format!(
                "unusable version '{}'",
                self.version.escape_debug()
            ));
        }
        let package_ok = !self.package.is_empty()
            && !self.package.starts_with('.')
            && self
                .package
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
        if !package_ok {
            return Err(format!(
                "unusable package name '{}'",
                self.package.escape_debug()
            ));
        }
        if self.sha256.len() != 64 || !self.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("SHA-256 is not 64 hexadecimal characters".to_string());
        }
        if self.size == 0 {
            return Err("package size is zero".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod manifest_tests {
    use super::*;

    fn manifest() -> UpdateManifest {
        UpdateManifest {
            version: "4.0.44".to_string(),
            package: "SentinelAgent-latest.pkg".to_string(),
            sha256: "AB".repeat(32),
            size: 1024,
        }
    }

    /// Signer (`cargo xtask manifest`) and agent share this function; the
    /// format is still pinned here, because changing it silently would make
    /// every deployed agent refuse the next release.
    #[test]
    fn signed_message_format_is_stable() {
        assert_eq!(
            String::from_utf8(manifest().signed_message()).unwrap(),
            format!(
                "sentinel-update-manifest-v1\n4.0.44\nSentinelAgent-latest.pkg\n{}\n1024\n",
                "ab".repeat(32)
            )
        );
    }

    #[test]
    fn a_well_formed_manifest_is_accepted() {
        assert_eq!(manifest().validate(), Ok(()));
        let prerelease = UpdateManifest {
            version: "4.1.0-rc.1+build.7".to_string(),
            package: "sentinel-agent-latest.x86_64.rpm".to_string(),
            ..manifest()
        };
        assert_eq!(prerelease.validate(), Ok(()));
    }

    #[test]
    fn fields_that_could_shift_the_signed_lines_are_refused() {
        let shifted = UpdateManifest {
            version: "4.0.44\nSentinelAgent-latest.pkg".to_string(),
            ..manifest()
        };
        assert!(shifted.validate().is_err());
        let path = UpdateManifest {
            package: "../SentinelAgent-latest.pkg".to_string(),
            ..manifest()
        };
        assert!(path.validate().is_err());
    }

    #[test]
    fn a_wrong_hash_or_an_empty_package_is_refused() {
        let short = UpdateManifest {
            sha256: "abcd".to_string(),
            ..manifest()
        };
        assert!(short.validate().is_err());
        let empty = UpdateManifest {
            size: 0,
            ..manifest()
        };
        assert!(empty.validate().is_err());
    }
}
