// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR response actions -- kill process, quarantine file, block IP.
//!
//! These functions perform actual host-level security response actions invoked
//! by the playbook engine or directly from the GUI.

use agent_common::error::CommonError;
use tracing::{info, warn};

/// Kill a process by name and PID.
pub async fn kill_process(process_name: &str, pid: u32) -> Result<(), CommonError> {
    // Anti-Draper protection: Prevent the agent from killing itself
    let my_pid = std::process::id();
    if pid == my_pid {
        warn!(
            "Anti-Draper triggered: Attempted to kill own process (PID: {})",
            pid
        );
        return Err(CommonError::internal(
            "Anti-Draper protection: Cannot terminate the Sentinel Agent process",
        ));
    }

    info!(
        "Attempting to kill process '{}' (PID: {})",
        process_name, pid
    );

    #[cfg(target_os = "macos")]
    {
        let output = agent_common::process::silent_async_command("kill")
            .arg("-9")
            .arg(pid.to_string())
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute kill: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!("kill failed: {}", stderr)));
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = agent_common::process::silent_async_command("kill")
            .arg("-9")
            .arg(pid.to_string())
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute kill: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!("kill failed: {}", stderr)));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = agent_common::process::silent_async_command("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute taskkill: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!(
                "taskkill failed: {}",
                stderr
            )));
        }
    }

    info!(
        "Successfully killed process '{}' (PID: {})",
        process_name, pid
    );
    Ok(())
}

/// Quarantine a file by moving it to a secure quarantine directory.
///
/// Returns the quarantine ID that can be used to restore the file later.
pub async fn quarantine_file(path: &str) -> Result<String, CommonError> {
    let source = std::path::Path::new(path);
    if !source.exists() {
        return Err(CommonError::internal(format!("File not found: {}", path)));
    }

    // SECURITY: Canonicalize path to resolve symlinks and prevent path traversal
    let source = source.canonicalize().map_err(|e| {
        CommonError::internal(format!("Failed to resolve path '{}': {}", path, e))
    })?;

    // Create quarantine directory under the local data directory
    let quarantine_dir = directories::BaseDirs::new()
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("sentinel-grc")
        .join("quarantine");

    tokio::fs::create_dir_all(&quarantine_dir)
        .await
        .map_err(|e| CommonError::internal(format!("Failed to create quarantine dir: {}", e)))?;

    let quarantine_id = uuid::Uuid::new_v4().to_string();
    let dest = quarantine_dir.join(&quarantine_id);

    // Store original path metadata so we can restore later
    let metadata_path = quarantine_dir.join(format!("{}.meta", quarantine_id));
    let metadata = serde_json::json!({
        "original_path": path,
        "quarantined_at": chrono::Utc::now().to_rfc3339(),
        "file_name": source.file_name().map(|n| n.to_string_lossy().to_string()),
    });
    tokio::fs::write(
        &metadata_path,
        serde_json::to_string_pretty(&metadata).unwrap_or_default(),
    )
    .await
    .map_err(|e| CommonError::internal(format!("Failed to write quarantine metadata: {}", e)))?;

    // Move the file to quarantine
    tokio::fs::rename(source, &dest)
        .await
        .map_err(|e| CommonError::internal(format!("Failed to quarantine file: {}", e)))?;

    info!("Quarantined file '{}' as '{}'", path, quarantine_id);
    Ok(quarantine_id)
}

/// Restore a quarantined file to its original location.
pub async fn restore_quarantined_file(quarantine_id: &str) -> Result<(), CommonError> {
    // SECURITY: Validate quarantine_id to prevent path traversal (must be UUID format)
    if !quarantine_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(CommonError::internal(
            "Invalid quarantine ID: must contain only alphanumeric characters and hyphens",
        ));
    }

    let quarantine_dir = directories::BaseDirs::new()
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("sentinel-grc")
        .join("quarantine");

    let quarantined_file = quarantine_dir.join(quarantine_id);
    let metadata_path = quarantine_dir.join(format!("{}.meta", quarantine_id));

    if !quarantined_file.exists() {
        return Err(CommonError::internal(format!(
            "Quarantined file not found: {}",
            quarantine_id
        )));
    }

    // Read metadata for original path
    let metadata_str = tokio::fs::read_to_string(&metadata_path)
        .await
        .map_err(|e| CommonError::internal(format!("Failed to read quarantine metadata: {}", e)))?;
    let metadata: serde_json::Value = serde_json::from_str(&metadata_str).map_err(|e| {
        CommonError::internal(format!("Failed to parse quarantine metadata: {}", e))
    })?;

    let original_path = metadata
        .get("original_path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| CommonError::internal("Missing original_path in metadata"))?;

    // SECURITY: Validate the restore path is not a system-critical location
    let restore_path = std::path::Path::new(original_path);
    let canonical_parent = restore_path.parent().and_then(|p| p.canonicalize().ok());
    if let Some(ref parent) = canonical_parent {
        let parent_str = parent.to_string_lossy();
        if parent_str == "/" || parent_str == "/bin" || parent_str == "/sbin" || parent_str == "/usr/bin" || parent_str == "/usr/sbin" {
            return Err(CommonError::internal(format!(
                "Refusing to restore file to system-critical directory: {}",
                original_path
            )));
        }
    }

    // Restore file to its original location
    tokio::fs::rename(&quarantined_file, original_path)
        .await
        .map_err(|e| CommonError::internal(format!("Failed to restore file: {}", e)))?;

    // Clean up metadata file
    let _ = tokio::fs::remove_file(&metadata_path).await;

    info!(
        "Restored quarantined file '{}' to '{}'",
        quarantine_id, original_path
    );
    Ok(())
}

/// Block an IP address using the system firewall.
///
/// If `duration_secs` is greater than 0, the IP will be automatically unblocked
/// after the specified duration.
pub async fn block_ip(ip: &str, duration_secs: u64) -> Result<(), CommonError> {
    info!("Blocking IP '{}' for {} seconds", ip, duration_secs);

    // Firewall operations require elevated privileges
    if !crate::service::is_admin() {
        return Err(CommonError::internal(
            "Elevated privileges required to modify firewall rules",
        ));
    }

    // Validate IP format first
    let parsed_ip: std::net::IpAddr = ip
        .parse()
        .map_err(|_| CommonError::internal(format!("Invalid IP address: {}", ip)))?;

    // Anti-Draper protection: Prevent blocking localhost or the backend server
    // SECURITY: Use parsed IP to prevent bypass via alternative representations
    // (e.g., 0.0.0.0, ::ffff:127.0.0.1, 0:0:0:0:0:0:0:1)
    if parsed_ip.is_loopback() || parsed_ip.is_unspecified() {
        warn!(
            "Anti-Draper triggered: Attempted to block localhost ({})",
            ip
        );
        return Err(CommonError::internal(
            "Anti-Draper protection: Cannot block localhost",
        ));
    }

    if let Ok(config) = agent_common::config::AgentConfig::load(None) {
        // Parse the server URL host and compare at IP level
        if let Ok(url) = url::Url::parse(&config.server_url) {
            if let Some(host) = url.host_str() {
                if host == ip || host == parsed_ip.to_string() {
                    warn!(
                        "Anti-Draper triggered: Attempted to block backend API server ({})",
                        ip
                    );
                    return Err(CommonError::internal(
                        "Anti-Draper protection: Cannot block the backend API server",
                    ));
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Use pf (packet filter) on macOS
        let rule = format!("block drop from {} to any\n", ip);
        let anchor_file = format!("/tmp/sentinel_block_{}.conf", ip.replace(['.', ':'], "_"));
        tokio::fs::write(&anchor_file, &rule)
            .await
            .map_err(|e| CommonError::internal(format!("Failed to write pf rule: {}", e)))?;

        let output = agent_common::process::silent_async_command("pfctl")
            .args(["-a", "sentinel", "-f", &anchor_file])
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to apply pf rule: {}", e)))?;

        if !output.status.success() {
            warn!(
                "pfctl returned non-zero; IP block may require root: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = agent_common::process::silent_async_command("iptables")
            .args(["-A", "INPUT", "-s", ip, "-j", "DROP"])
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute iptables: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!(
                "iptables failed: {}",
                stderr
            )));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let rule_name = format!("SentinelBlock_{}", ip.replace('.', "_").replace(':', "_"));
        let output = agent_common::process::silent_async_command("netsh")
            .args([
                "advfirewall",
                "firewall",
                "add",
                "rule",
                &format!("name={}", rule_name),
                "dir=in",
                "action=block",
                &format!("remoteip={}", ip),
            ])
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute netsh: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!("netsh failed: {}", stderr)));
        }
    }

    // Schedule automatic unblock if duration > 0
    if duration_secs > 0 {
        let ip_owned = ip.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(duration_secs)).await;
            if let Err(e) = unblock_ip(&ip_owned).await {
                warn!("Failed to auto-unblock IP '{}': {}", ip_owned, e);
            }
        });
    }

    info!("Successfully blocked IP '{}'", ip);
    Ok(())
}

/// Unblock a previously blocked IP address.
pub async fn unblock_ip(ip: &str) -> Result<(), CommonError> {
    info!("Unblocking IP '{}'", ip);

    #[cfg(target_os = "macos")]
    {
        let anchor_file = format!("/tmp/sentinel_block_{}.conf", ip.replace(['.', ':'], "_"));
        let _ = tokio::fs::remove_file(&anchor_file).await;
        let _ = agent_common::process::silent_async_command("pfctl")
            .args(["-a", "sentinel", "-F", "all"])
            .output()
            .await;
    }

    #[cfg(target_os = "linux")]
    {
        let output = agent_common::process::silent_async_command("iptables")
            .args(["-D", "INPUT", "-s", ip, "-j", "DROP"])
            .output()
            .await
            .map_err(|e| CommonError::internal(format!("Failed to execute iptables: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommonError::internal(format!(
                "iptables unblock failed: {}",
                stderr
            )));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let rule_name = format!("SentinelBlock_{}", ip.replace('.', "_").replace(':', "_"));
        let _ = agent_common::process::silent_async_command("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                &format!("name={}", rule_name),
            ])
            .output()
            .await;
    }

    info!("Successfully unblocked IP '{}'", ip);
    Ok(())
}
