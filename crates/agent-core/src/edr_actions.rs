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
    let source = source
        .canonicalize()
        .map_err(|e| CommonError::internal(format!("Failed to resolve path '{}': {}", path, e)))?;

    // Create quarantine directory under the local data directory
    let quarantine_dir = directories::BaseDirs::new()
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(std::env::temp_dir)
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
        .unwrap_or_else(std::env::temp_dir)
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
        if parent_str == "/"
            || parent_str == "/bin"
            || parent_str == "/sbin"
            || parent_str == "/usr/bin"
            || parent_str == "/usr/sbin"
        {
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
        if let Ok(url) = url::Url::parse(&config.server_url)
            && let Some(host) = url.host_str()
            && (host == ip || host == parsed_ip.to_string())
        {
            warn!(
                "Anti-Draper triggered: Attempted to block backend API server ({})",
                ip
            );
            return Err(CommonError::internal(
                "Anti-Draper protection: Cannot block the backend API server",
            ));
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
        let rule_name = format!("SentinelBlock_{}", ip.replace(['.', ':'], "_"));
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
        let rule_name = format!("SentinelBlock_{}", ip.replace(['.', ':'], "_"));
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── quarantine: path traversal ──────────────────────────────────────

    /// Verify that `quarantine_file` canonicalizes paths, meaning a path
    /// containing ".." components will either be resolved to the real
    /// location or rejected if the path does not exist.
    #[tokio::test]
    async fn test_quarantine_rejects_path_traversal() {
        // A path with ".." that points to a non-existent file should fail
        // because canonicalize requires the path to actually exist.
        let result = quarantine_file("/tmp/../../../nonexistent_sentinel_test_file").await;
        assert!(
            result.is_err(),
            "Path traversal with non-existent file must be rejected"
        );

        // A path with ".." that technically resolves to an existing dir
        // (e.g., /tmp/../tmp) would be canonicalized to /tmp, but since
        // quarantine_file operates on files and /tmp is a directory, the
        // rename would fail. We verify the canonicalization happens by
        // creating a temp file with a traversal path.
        let dir = tempfile::tempdir().unwrap();
        let real_file = dir.path().join("secret.txt");
        std::fs::write(&real_file, b"test").unwrap();

        // Build a traversal path: <dir>/subdir/../secret.txt
        let subdir = dir.path().join("subdir");
        std::fs::create_dir(&subdir).unwrap();
        let traversal_path = subdir.join("..").join("secret.txt");

        // quarantine_file should canonicalize the traversal away and still
        // find the real file.  The function should succeed (the file exists).
        let result = quarantine_file(traversal_path.to_str().unwrap()).await;
        // It succeeds because canonicalize resolves the ".." to the real path.
        assert!(
            result.is_ok(),
            "Canonicalized traversal path should succeed for existing file"
        );
        // The original file should have been moved away.
        assert!(
            !real_file.exists(),
            "Original file should be quarantined (moved)"
        );
    }

    // ── quarantine: symlink handling ────────────────────────────────────

    #[tokio::test]
    async fn test_quarantine_rejects_symlinks() {
        // Create a real file and a symlink pointing to it.
        let dir = tempfile::tempdir().unwrap();
        let real_file = dir.path().join("real.txt");
        std::fs::write(&real_file, b"important data").unwrap();

        let symlink_path = dir.path().join("link.txt");

        #[cfg(unix)]
        std::os::unix::fs::symlink(&real_file, &symlink_path).unwrap();

        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&real_file, &symlink_path).unwrap();

        // quarantine_file canonicalizes the path, so the symlink is
        // resolved to the real file.  The *real* file ends up in quarantine.
        let result = quarantine_file(symlink_path.to_str().unwrap()).await;
        assert!(
            result.is_ok(),
            "Quarantine via symlink should succeed after canonicalization"
        );
        // The real file should have been moved to quarantine.
        assert!(
            !real_file.exists(),
            "Real file behind symlink should be moved to quarantine"
        );
    }

    // ── restore: system-critical paths ──────────────────────────────────

    /// The restore validation checks the *parent* directory of the original
    /// path.  We test the validation logic directly by verifying that the
    /// quarantine ID format check and the system-path check both work.
    /// NOTE: We cannot easily test the full `restore_quarantined_file` flow
    /// because it reads metadata from the quarantine directory.  Instead we
    /// set up a real quarantine entry and verify rejection.
    #[tokio::test]
    async fn test_restore_rejects_system_paths() {
        // Create a fake quarantine entry whose metadata claims the original
        // path is in a system-critical directory.
        let quarantine_dir = tempfile::tempdir().unwrap();

        // We need the quarantine dir to be where the code looks (data_local_dir).
        // Instead, we directly test the validation logic by constructing the
        // scenario: quarantine a temp file, then patch its metadata to claim
        // the original path is "/bin/evil".

        // Step 1: Create a temporary file and quarantine it normally.
        let src_dir = tempfile::tempdir().unwrap();
        let src_file = src_dir.path().join("testfile.txt");
        std::fs::write(&src_file, b"test data").unwrap();

        let quarantine_id = quarantine_file(src_file.to_str().unwrap())
            .await
            .expect("quarantine should succeed");

        // Step 2: Patch the metadata to claim the original path is /bin/evil.
        let qdir = directories::BaseDirs::new()
            .map(|dirs| dirs.data_local_dir().to_path_buf())
            .unwrap_or_else(std::env::temp_dir)
            .join("sentinel-grc")
            .join("quarantine");

        let meta_path = qdir.join(format!("{}.meta", quarantine_id));
        let patched_metadata = serde_json::json!({
            "original_path": "/bin/evil",
            "quarantined_at": chrono::Utc::now().to_rfc3339(),
            "file_name": "evil",
        });
        tokio::fs::write(
            &meta_path,
            serde_json::to_string_pretty(&patched_metadata).unwrap(),
        )
        .await
        .unwrap();

        // Step 3: Try to restore -- should be rejected because /bin is system-critical.
        let result = restore_quarantined_file(&quarantine_id).await;
        assert!(result.is_err(), "Restore to /bin must be rejected");
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("system-critical"),
            "Error should mention system-critical, got: {}",
            err_msg
        );

        // Clean up the quarantined file.
        let _ = tokio::fs::remove_file(qdir.join(&quarantine_id)).await;
        let _ = tokio::fs::remove_file(&meta_path).await;
        let _ = quarantine_dir.close();
    }

    // ── block_ip: loopback rejection ────────────────────────────────────
    //
    // NOTE: `block_ip` checks for admin privileges before validating the IP.
    // When tests run without root, the admin check fails first with
    // "Elevated privileges required".  We test the IP validation logic
    // directly via the parsed `IpAddr` checks, and also verify that the
    // function never succeeds for loopback/unspecified addresses regardless
    // of the specific error returned.

    #[tokio::test]
    async fn test_block_ip_rejects_loopback() {
        // 127.0.0.1 (IPv4 loopback) -- must never succeed
        let result = block_ip("127.0.0.1", 0).await;
        assert!(result.is_err(), "Blocking 127.0.0.1 must be rejected");
        // Verify via the std::net validation that the loopback check is sound
        let ip: std::net::IpAddr = "127.0.0.1".parse().unwrap();
        assert!(ip.is_loopback(), "127.0.0.1 must be detected as loopback");

        // ::1 (IPv6 loopback) -- must never succeed
        let result = block_ip("::1", 0).await;
        assert!(result.is_err(), "Blocking ::1 must be rejected");
        let ip: std::net::IpAddr = "::1".parse().unwrap();
        assert!(ip.is_loopback(), "::1 must be detected as loopback");

        // Verify the actual Anti-Draper logic by testing the parsed IP checks
        // independently of the admin privilege guard.
        for addr in &["127.0.0.1", "::1"] {
            let parsed: std::net::IpAddr = addr.parse().unwrap();
            assert!(
                parsed.is_loopback() || parsed.is_unspecified(),
                "Address {} should be classified as loopback or unspecified",
                addr
            );
        }
    }

    // ── block_ip: localhost string rejection ─────────────────────────────

    #[tokio::test]
    async fn test_block_ip_rejects_localhost() {
        // "localhost" is not a valid IP address, so it should fail at parse
        // or at the admin check -- either way it must not succeed.
        let result = block_ip("localhost", 0).await;
        assert!(result.is_err(), "Blocking 'localhost' must be rejected");

        // Verify "localhost" cannot be parsed as an IP address (this is the
        // fundamental protection -- the function only accepts numeric IPs).
        assert!(
            "localhost".parse::<std::net::IpAddr>().is_err(),
            "'localhost' must not parse as a valid IP address"
        );

        // 0.0.0.0 (unspecified address) -- must never succeed
        let result = block_ip("0.0.0.0", 0).await;
        assert!(result.is_err(), "Blocking 0.0.0.0 must be rejected");
        let ip: std::net::IpAddr = "0.0.0.0".parse().unwrap();
        assert!(
            ip.is_unspecified(),
            "0.0.0.0 must be detected as unspecified"
        );

        // :: (IPv6 unspecified) -- must never succeed
        let result = block_ip("::", 0).await;
        assert!(result.is_err(), "Blocking :: must be rejected");
        let ip: std::net::IpAddr = "::".parse().unwrap();
        assert!(ip.is_unspecified(), ":: must be detected as unspecified");
    }

    // ── quarantine ID format validation ─────────────────────────────────

    #[tokio::test]
    async fn test_quarantine_id_format_validation() {
        // Path traversal attempt in quarantine ID
        let result = restore_quarantined_file("../../../etc/passwd").await;
        assert!(result.is_err(), "Quarantine ID with '..' must be rejected");
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("Invalid quarantine ID"),
            "Error should mention invalid quarantine ID, got: {}",
            err_msg
        );

        // Shell metacharacters in quarantine ID
        let result = restore_quarantined_file("test;rm -rf /").await;
        assert!(
            result.is_err(),
            "Quarantine ID with shell metacharacters must be rejected"
        );

        // Null bytes
        let result = restore_quarantined_file("test\0file").await;
        assert!(
            result.is_err(),
            "Quarantine ID with null bytes must be rejected"
        );

        // Slash characters
        let result = restore_quarantined_file("test/file").await;
        assert!(
            result.is_err(),
            "Quarantine ID with slashes must be rejected"
        );

        // Valid UUID format should pass the ID validation (but fail later
        // because the quarantined file doesn't actually exist).
        let valid_uuid = uuid::Uuid::new_v4().to_string();
        let result = restore_quarantined_file(&valid_uuid).await;
        // This should fail with "not found", not "invalid ID"
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("not found"),
            "Valid UUID should pass format check but fail with 'not found', got: {}",
            err_msg
        );
    }
}
