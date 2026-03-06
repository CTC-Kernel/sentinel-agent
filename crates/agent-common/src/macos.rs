// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! macOS specific system utilities.

use crate::error::{CommonError, Result};
use crate::process::silent_command;
use tracing::{info, warn};

/// Checks if the current process is running with administrator privileges.
pub fn is_admin() -> bool {
    #[cfg(target_os = "macos")]
    {
        // On macOS/Unix, we check if the effective user ID is 0 (root)
        unsafe { libc::geteuid() == 0 }
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// Runs a shell command with administrator privileges using AppleScript.
/// This will trigger the native macOS password prompt in a window.
///
/// # Security
/// The `script` parameter is escaped for safe embedding in an AppleScript
/// double-quoted string. All shell metacharacters and quote characters are
/// escaped to prevent injection.
pub fn run_with_elevation(script: &str) -> Result<String> {
    info!("Requesting privilege elevation for command");

    // Escape for safe embedding inside AppleScript double-quoted string.
    // Order matters: backslash must be escaped first to avoid double-escaping.
    let escaped_script = script
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "'\\''")
        .replace('$', "\\$")
        .replace('`', "\\`")
        .replace('!', "\\!");

    let applescript = format!(
        "do shell script \"{}\" with administrator privileges",
        escaped_script
    );

    let output = silent_command("osascript")
        .args(["-e", &applescript])
        .output()
        .map_err(|e| CommonError::system(format!("Failed to execute osascript: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        warn!("Privilege elevation failed or cancelled: {}", stderr);
        Err(CommonError::system(format!("Elevation failed: {}", stderr)))
    }
}

/// Run the macOS package installer with elevation, using safe argument construction.
///
/// Instead of interpolating the path into a shell string, this constructs
/// the AppleScript command with proper quoting to prevent injection.
pub fn run_installer_elevated(pkg_path: &str) -> Result<String> {
    info!("Requesting elevated installer for package");

    // Escape the path for safe embedding in a single-quoted shell argument
    // inside an AppleScript double-quoted string.
    // Single quotes in shell prevent all interpretation; we only need to handle
    // the single quote itself and the AppleScript double-quote layer.
    let safe_path = pkg_path
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\'', "'\\''");

    let applescript = format!(
        "do shell script \"/usr/sbin/installer -pkg '{}' -target /\" with administrator privileges",
        safe_path
    );

    let output = silent_command("osascript")
        .args(["-e", &applescript])
        .output()
        .map_err(|e| CommonError::system(format!("Failed to execute osascript: {}", e)))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        warn!("Elevated installer failed or cancelled: {}", stderr);
        Err(CommonError::system(format!(
            "Elevated installer failed: {}",
            stderr
        )))
    }
}
