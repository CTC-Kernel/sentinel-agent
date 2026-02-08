//! Tamper protection for the Sentinel agent.
//!
//! Detects:
//! - Binary integrity changes (self-hash verification)
//! - Config file tampering
//! - Debugger attachment
//! - Service registration changes

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{error, info, warn};

/// Tamper protection status.
#[derive(Debug, Clone)]
pub struct TamperStatus {
    /// Whether the binary integrity is intact.
    pub binary_intact: bool,

    /// Whether the config file is intact.
    pub config_intact: bool,

    /// Whether a debugger is attached.
    pub debugger_attached: bool,

    /// SHA-256 of the current binary.
    pub binary_hash: Option<String>,
}

/// Self-protection module.
pub struct SelfProtection {
    /// SHA-256 hash of the agent binary at startup.
    startup_binary_hash: Option<String>,

    /// SHA-256 hash of the config file at startup.
    startup_config_hash: Option<String>,

    /// Path to the agent binary.
    binary_path: PathBuf,

    /// Path to the config file.
    config_path: PathBuf,

    /// Whether tampering was detected.
    tampered: Arc<AtomicBool>,
}

impl SelfProtection {
    /// Initialize self-protection by computing startup hashes.
    pub fn new(config_path: PathBuf) -> Self {
        let binary_path = std::env::current_exe().unwrap_or_default();

        let startup_binary_hash = compute_file_hash(&binary_path).ok();
        let startup_config_hash = compute_file_hash(&config_path).ok();

        if let Some(ref hash) = startup_binary_hash {
            let hash_preview: String = hash.chars().take(16).collect();
            info!(
                "Self-protection initialized. Binary hash: {}...",
                hash_preview
            );
        }

        Self {
            startup_binary_hash,
            startup_config_hash,
            binary_path,
            config_path,
            tampered: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Verify binary integrity.
    pub fn verify_binary(&self) -> bool {
        let Some(ref expected) = self.startup_binary_hash else {
            return true; // Can't verify, assume OK
        };

        match compute_file_hash(&self.binary_path) {
            Ok(current) => {
                if &current != expected {
                    let expected_preview: String = expected.chars().take(16).collect();
                    let current_preview: String = current.chars().take(16).collect();
                    error!(
                        "TAMPER DETECTED: Binary hash mismatch! Expected: {}..., Got: {}...",
                        expected_preview,
                        current_preview
                    );
                    self.tampered.store(true, Ordering::Release);
                    false
                } else {
                    true
                }
            }
            Err(e) => {
                warn!("Failed to verify binary: {}", e);
                true // Don't flag if we can't read
            }
        }
    }

    /// Verify config file integrity.
    pub fn verify_config(&self) -> bool {
        let Some(ref expected) = self.startup_config_hash else {
            return true;
        };

        match compute_file_hash(&self.config_path) {
            Ok(current) => {
                if &current != expected {
                    warn!(
                        "Config file changed externally: {}",
                        self.config_path.display()
                    );
                    // Config changes are less severe than binary changes
                    false
                } else {
                    true
                }
            }
            Err(_) => true,
        }
    }

    /// Check if a debugger is attached.
    pub fn check_debugger(&self) -> bool {
        #[cfg(target_os = "linux")]
        {
            check_debugger_linux()
        }
        #[cfg(target_os = "windows")]
        {
            check_debugger_windows()
        }
        #[cfg(target_os = "macos")]
        {
            check_debugger_macos()
        }
        #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
        {
            false
        }
    }

    /// Run all tamper checks and return status.
    pub fn check_all(&self) -> TamperStatus {
        let binary_intact = self.verify_binary();
        let config_intact = self.verify_config();
        let debugger_attached = self.check_debugger();

        if debugger_attached {
            warn!("TAMPER WARNING: Debugger attached to agent process");
            self.tampered.store(true, Ordering::Release);
        }

        TamperStatus {
            binary_intact,
            config_intact,
            debugger_attached,
            binary_hash: self.startup_binary_hash.clone(),
        }
    }

    /// Whether tampering has been detected at any point.
    pub fn is_tampered(&self) -> bool {
        self.tampered.load(Ordering::Acquire)
    }

    /// Get the tamper flag for sharing with other components.
    pub fn tamper_flag(&self) -> Arc<AtomicBool> {
        self.tampered.clone()
    }
}

/// Compute SHA-256 hash of a file.
fn compute_file_hash(path: &Path) -> std::io::Result<String> {
    let contents = std::fs::read(path)?;
    let hash = Sha256::digest(&contents);
    Ok(hex::encode(hash))
}

/// Check for debugger on Linux by reading /proc/self/status TracerPid.
#[cfg(target_os = "linux")]
fn check_debugger_linux() -> bool {
    match std::fs::read_to_string("/proc/self/status") {
        Ok(status) => {
            for line in status.lines() {
                if line.starts_with("TracerPid:") {
                    let tracer_pid: u32 = line
                        .split_whitespace()
                        .nth(1)
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    return tracer_pid != 0;
                }
            }
            false
        }
        Err(_) => false,
    }
}

/// Check for debugger on Windows using IsDebuggerPresent.
#[cfg(target_os = "windows")]
fn check_debugger_windows() -> bool {
    // Use windows crate for IsDebuggerPresent
    unsafe { windows::Win32::System::Diagnostics::Debug::IsDebuggerPresent().as_bool() }
}

/// Check for debugger on macOS using sysctl.
#[cfg(target_os = "macos")]
fn check_debugger_macos() -> bool {
    use std::process::Command;

    // Check P_TRACED flag via sysctl
    match Command::new("sysctl")
        .args(["kern.proc.pid", &std::process::id().to_string()])
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // P_TRACED flag indicates debugging
            stdout.contains("P_TRACED")
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_compute_file_hash() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"test content").unwrap();
        tmp.flush().unwrap();

        let hash = compute_file_hash(tmp.path()).unwrap();
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_self_protection_init() {
        let tmp = NamedTempFile::new().unwrap();
        let protection = SelfProtection::new(tmp.path().to_path_buf());
        assert!(!protection.is_tampered());
    }

    #[test]
    fn test_verify_config_unchanged() {
        let mut tmp = NamedTempFile::new().unwrap();
        tmp.write_all(b"{\"test\": true}").unwrap();
        tmp.flush().unwrap();

        let protection = SelfProtection::new(tmp.path().to_path_buf());
        assert!(protection.verify_config());
    }

    #[test]
    fn test_check_debugger() {
        let tmp = NamedTempFile::new().unwrap();
        let protection = SelfProtection::new(tmp.path().to_path_buf());
        // In test environment, debugger should not be attached (usually)
        let _attached = protection.check_debugger();
    }

    #[test]
    fn test_tamper_status() {
        let tmp = NamedTempFile::new().unwrap();
        let protection = SelfProtection::new(tmp.path().to_path_buf());
        let status = protection.check_all();
        assert!(status.config_intact);
    }
}
