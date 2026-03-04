// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! System utility functions for OS detection and machine identification.

/// Get the OS version string.
pub fn get_os_version() -> String {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/os-release")
            .ok()
            .and_then(|content| {
                content
                    .lines()
                    .find(|line| line.starts_with("VERSION_ID="))
                    .map(|line| {
                        line.trim_start_matches("VERSION_ID=")
                            .trim_matches('"')
                            .to_string()
                    })
            })
            .unwrap_or_else(|| "unknown".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        agent_common::process::silent_command("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        // Read ProductName from the registry via `reg query`
        agent_common::process::silent_command("cmd")
            .args(["/C", "reg query \"HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\" /v ProductName"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| {
                // Output contains "ProductName    REG_SZ    Windows 11 Pro"
                s.lines()
                    .find(|l| l.contains("ProductName"))
                    .and_then(|l| l.split("REG_SZ").nth(1))
                    .map(|v| v.trim().to_string())
            })
            .unwrap_or_else(|| "unknown".to_string())
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        "unknown".to_string()
    }
}

/// Get a unique machine identifier.
pub fn get_machine_id() -> String {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/machine-id")
            .map(|id| id.trim().to_string())
            .unwrap_or_else(|_| generate_fallback_machine_id())
    }

    #[cfg(target_os = "macos")]
    {
        agent_common::process::silent_command("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .and_then(|content| {
                content
                    .lines()
                    .find(|line| line.contains("IOPlatformUUID"))
                    .and_then(|line| line.split('"').nth(3).map(|s| s.to_string()))
            })
            .unwrap_or_else(generate_fallback_machine_id)
    }

    #[cfg(target_os = "windows")]
    {
        // Use Windows registry or WMI for machine ID
        generate_fallback_machine_id()
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        generate_fallback_machine_id()
    }
}

/// Generate a fallback machine ID based on hostname and a random component.
fn generate_fallback_machine_id() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);
    // Use username for additional entropy (stable across restarts, unlike timestamps)
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_default();
    username.hash(&mut hasher);

    format!("{:016x}", hasher.finish())
}
