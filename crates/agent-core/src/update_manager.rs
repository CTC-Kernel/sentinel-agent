use crate::api_client::ApiClient;
use agent_common::error::{CommonError, Result};
use agent_common::types::UpdateInfo;
use semver::Version;
use std::process::Command;
use std::sync::Arc;
use tracing::{debug, error, info};

/// Orchestrates the agent self-update process.
pub struct UpdateManager {
    api_client: Arc<ApiClient>,
    current_version: String,
}

impl UpdateManager {
    /// Create a new UpdateManager.
    pub fn new(api_client: Arc<ApiClient>, current_version: String) -> Self {
        Self {
            api_client,
            current_version,
        }
    }

    /// Check if a newer version is available.
    pub async fn check_for_update(&self) -> Result<Option<UpdateInfo>> {
        debug!(
            "Checking for updates (current version: {})",
            self.current_version
        );
        let latest_info = self.api_client.get_latest_release_info().await?;

        let current = Version::parse(&self.current_version).map_err(|e| {
            CommonError::validation(format!(
                "Invalid current version '{}': {}",
                self.current_version, e
            ))
        })?;
        let latest = Version::parse(&latest_info.version).map_err(|e| {
            CommonError::validation(format!(
                "Invalid latest version '{}' from server: {}",
                latest_info.version, e
            ))
        })?;

        if latest > current {
            info!(
                "Update available: {} (current: {})",
                latest_info.version, self.current_version
            );
            Ok(Some(latest_info))
        } else {
            debug!("Agent is up to date (latest: {})", latest_info.version);
            Ok(None)
        }
    }

    /// Perform the full update process: download, verify, and execute installer.
    ///
    /// This function will likely result in the agent being terminated as the
    /// installer takes over and replaces the binary.
    pub async fn perform_update(&self, info: UpdateInfo) -> Result<()> {
        info!("Starting update process to version {}", info.version);

        // 1. Determine platform-specific package details
        let (package_name, checksum_file) = self.get_platform_package_details()?;
        let folder = self.get_platform_folder();

        // 2. Download checksum
        let checksum_url = format!(
            "https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/{}/{}",
            folder, checksum_file
        );
        debug!("Fetching checksum from {}", checksum_url);
        let expected_checksum = self.api_client.fetch_text(&checksum_url).await?;

        // 3. Download package
        let package_url = format!(
            "https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/{}/{}",
            folder, package_name
        );

        // Use a unique temporary directory to prevent TOCTOU attacks
        let temp_dir = tempfile::tempdir()
            .map_err(|e| CommonError::io(format!("Failed to create temp directory: {}", e)))?;
        let download_path = temp_dir.path().join(package_name);

        info!("Downloading update package to {:?}", download_path);
        self.api_client
            .download_file(&package_url, &download_path)
            .await?;

        // 4. Verify checksum
        info!("Verifying package checksum...");
        self.verify_checksum(&download_path, &expected_checksum)?;

        // 5. Trigger installer
        info!("Triggering system installer...");
        self.trigger_installer(&download_path)?;

        Ok(())
    }

    fn get_platform_folder(&self) -> &'static str {
        if cfg!(target_os = "macos") {
            "macos"
        } else if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "linux") {
            if std::path::Path::new("/etc/debian_version").exists() {
                "linux_deb"
            } else {
                "linux_rpm"
            }
        } else {
            "unknown"
        }
    }

    fn get_platform_package_details(&self) -> Result<(&'static str, &'static str)> {
        if cfg!(target_os = "macos") {
            Ok((
                "SentinelAgent-latest.pkg",
                "SentinelAgent-latest.pkg.sha256",
            ))
        } else if cfg!(target_os = "windows") {
            Ok((
                "SentinelAgentSetup-latest.msi",
                "SentinelAgentSetup-latest.msi.sha256",
            ))
        } else if cfg!(target_os = "linux") {
            if std::path::Path::new("/etc/debian_version").exists() {
                Ok((
                    "sentinel-agent-latest-amd64.deb",
                    "sentinel-agent-latest-amd64.deb.sha256",
                ))
            } else {
                Ok((
                    "sentinel-agent-latest.x86_64.rpm",
                    "sentinel-agent-latest.x86_64.rpm.sha256",
                ))
            }
        } else {
            Err(CommonError::not_supported(
                "Self-update not supported on this platform",
            ))
        }
    }

    fn verify_checksum(&self, path: &std::path::Path, expected: &str) -> Result<()> {
        use sha2::{Digest, Sha256};
        use std::io::Read;

        let mut file = std::fs::File::open(path)
            .map_err(|e| CommonError::io(format!("Failed to open package: {}", e)))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0; 65536];
        loop {
            let count = file
                .read(&mut buffer)
                .map_err(|e| CommonError::io(format!("Failed to read package: {}", e)))?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
        let hash = format!("{:x}", hasher.finalize());

        // Extract the first part of the checksum file content (which might be "hash filename")
        let expected_hash = expected
            .split_whitespace()
            .next()
            .unwrap_or(expected)
            .to_lowercase();

        // Validate hash format: must be exactly 64 hex characters (SHA-256)
        if expected_hash.len() != 64
            || !expected_hash.chars().all(|c| c.is_ascii_hexdigit())
        {
            error!(
                "Invalid SHA-256 format: expected 64 hex chars, got {} chars",
                expected_hash.len()
            );
            return Err(CommonError::validation(
                "Invalid SHA-256 checksum format",
            ));
        }

        // Use constant-time comparison to prevent timing attacks
        let ct_equal = hash.len() == expected_hash.len()
            && hash
                .as_bytes()
                .iter()
                .zip(expected_hash.as_bytes())
                .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                == 0;
        if !ct_equal {
            error!(
                "Checksum mismatch! Expected {}, got {}",
                expected_hash, hash
            );
            return Err(CommonError::validation(
                "Package checksum verification failed",
            ));
        }

        debug!("Checksum verification successful: {}", hash);
        Ok(())
    }

    fn trigger_installer(&self, path: &std::path::Path) -> Result<()> {
        let path_str = path
            .to_str()
            .ok_or_else(|| CommonError::validation("Invalid download path"))?;

        #[cfg(target_os = "macos")]
        {
            if agent_common::macos::is_admin() {
                info!("Running as root, executing: /usr/sbin/installer -pkg {} -target /", path_str);
                let output = Command::new("/usr/sbin/installer")
                    .args(["-pkg", path_str, "-target", "/"])
                    .output()
                    .map_err(|e| CommonError::system(format!("Failed to launch installer: {}", e)))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(CommonError::system(format!("Installer failed: {}", stderr)));
                }
            } else {
                info!("Not running as root, requesting elevation for installer");
                let script = format!("/usr/sbin/installer -pkg \"{}\" -target /", path_str);
                agent_common::macos::run_with_elevation(&script)?;
            }
            info!("macOS installer completed successfully");
        }

        #[cfg(target_os = "windows")]
        {
            info!("Executing: msiexec /i {} /quiet", path_str);
            Command::new("msiexec")
                .args(["/i", path_str, "/quiet"])
                .spawn()
                .map_err(|e| CommonError::system(format!("Failed to launch msiexec: {}", e)))?;
        }

        #[cfg(target_os = "linux")]
        {
            if std::path::Path::new("/etc/debian_version").exists() {
                info!("Executing: dpkg -i {}", path_str);
                Command::new("dpkg")
                    .args(["-i", path_str])
                    .spawn()
                    .map_err(|e| CommonError::system(format!("Failed to launch dpkg: {}", e)))?;
            } else {
                info!("Executing: rpm -Uvh {}", path_str);
                Command::new("rpm")
                    .args(["-Uvh", path_str])
                    .spawn()
                    .map_err(|e| CommonError::system(format!("Failed to launch rpm: {}", e)))?;
            }
        }

        info!("Installer started. The agent will be updated and restarted soon.");
        Ok(())
    }
}
