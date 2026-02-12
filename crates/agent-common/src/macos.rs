//! macOS specific system utilities.

use std::process::Command;
use tracing::{info, warn};
use crate::error::{CommonError, Result};

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

/// Runs a command with administrator privileges using AppleScript.
/// This will trigger the native macOS password prompt in a window.
pub fn run_with_elevation(script: &str) -> Result<String> {
    info!("Requesting privilege elevation for command: {}", script);

    // Escape double quotes and backslashes for AppleScript strings
    let escaped_script = script.replace('\\', "\\\\").replace('"', "\\\"");
    
    // AppleScript command: do shell script "..." with administrator privileges
    // Note: AppleScript strings MUST use double quotes. Single quotes are not valid string delimiters.
    let applescript = format!("do shell script \"{}\" with administrator privileges", escaped_script);

    let output = Command::new("osascript")
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

#[cfg(test)]
mod tests {
    // Tests are omitted here as they would trigger interactive prompts on macOS
    // but the formatting logic is tested in agent-core previously and verified.
}
