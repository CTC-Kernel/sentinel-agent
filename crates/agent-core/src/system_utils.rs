//! System utility functions for OS detection, machine identification, and JWT parsing.

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

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
        std::process::Command::new("sw_vers")
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
        std::process::Command::new("cmd")
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
        std::process::Command::new("ioreg")
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
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .hash(&mut hasher);

    format!("{:016x}", hasher.finish())
}

/// Extract organization ID from JWT token.
pub fn parse_organization_id_from_token(token: &str) -> Option<String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    // Decode payload (2nd part) - handle URL safe base64
    if let Ok(decoded) = URL_SAFE_NO_PAD.decode(parts[1])
        && let Ok(payload_str) = String::from_utf8(decoded)
        && let Ok(json) = serde_json::from_str::<serde_json::Value>(&payload_str)
    {
        // Try standard claims
        if let Some(val) = json.get("organization_id").or_else(|| json.get("org_id"))
            && let Some(s) = val.as_str()
        {
            return Some(s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_organization_id() {
        // Create a dummy JWT with org_id
        let payload = serde_json::json!({
            "org_id": "org_12345",
            "sub": "agent_x",
            "exp": 1234567890
        });
        let payload_str = serde_json::to_string(&payload).unwrap();
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload_str);
        let token = format!("header.{}.signature", payload_b64);

        assert_eq!(
            parse_organization_id_from_token(&token),
            Some("org_12345".to_string())
        );

        // Create a dummy JWT with organization_id
        let payload2 = serde_json::json!({
            "organization_id": "org_67890",
            "sub": "agent_y"
        });
        let payload_str2 = serde_json::to_string(&payload2).unwrap();
        let payload_b64_2 = URL_SAFE_NO_PAD.encode(payload_str2);
        let token2 = format!("header.{}.signature", payload_b64_2);

        assert_eq!(
            parse_organization_id_from_token(&token2),
            Some("org_67890".to_string())
        );

        // Invalid token
        assert_eq!(parse_organization_id_from_token("invalid.token"), None);
    }
}
