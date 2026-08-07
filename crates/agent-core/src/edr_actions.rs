// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! EDR response actions -- kill process, quarantine file, block IP.
//!
//! These functions perform actual host-level security response actions invoked
//! by the playbook engine or directly from the GUI.

use agent_common::error::CommonError;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// Directories whose contents must never be quarantined or restored into.
///
/// The filesystem root is deliberately absent: `Path::starts_with("/")` matches
/// every absolute path, so root is handled separately in
/// [`is_protected_target`].
const SYSTEM_CRITICAL_DIRS: &[&str] = &[
    "/bin",
    "/sbin",
    "/usr/bin",
    "/usr/sbin",
    "/usr/lib",
    "/System",
    "/Library/LaunchDaemons",
    "/Library/LaunchAgents",
    r"C:\Windows",
    r"C:\Program Files",
];

/// Directory where quarantined files are stored.
fn quarantine_dir() -> PathBuf {
    directories::BaseDirs::new()
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(std::env::temp_dir)
        .join("sentinel-grc")
        .join("quarantine")
}

/// Canonicalized paths that belong to the agent itself or to the operating
/// system, and must never be moved into (or restored out of) quarantine.
///
/// Anti-Draper: playbooks are authored on the platform and stored locally
/// verbatim, so without this guard a single playbook naming the agent's own
/// binary as a quarantine target would disable the fleet in one sync.
/// Non-existent paths are dropped by canonicalization -- they cannot be a
/// quarantine target anyway, since `quarantine_file` requires the file to exist.
fn protected_paths() -> Vec<PathBuf> {
    let mut paths = vec![
        agent_common::config::AgentConfig::platform_config_path(),
        agent_common::config::AgentConfig::platform_data_dir(),
        quarantine_dir(),
    ];

    if let Ok(exe) = std::env::current_exe() {
        paths.push(exe);
    }

    paths.extend(crate::logging::log_dir_candidates());
    paths.extend(SYSTEM_CRITICAL_DIRS.iter().map(PathBuf::from));

    paths.iter().filter_map(|p| p.canonicalize().ok()).collect()
}

/// Whether `target` is, or lives inside, a protected path.
///
/// `target` must already be canonicalized so symlinks cannot be used to slip a
/// protected path past the comparison.
fn is_protected_target(target: &Path, protected: &[PathBuf]) -> bool {
    // A file sitting directly at the filesystem root is system-critical.
    // Handled here because listing "/" as a prefix would match everything.
    if target.parent() == Some(Path::new("/")) {
        return true;
    }
    // `starts_with` is component-wise, so "/usr/bindings" does not match
    // "/usr/bin".
    protected
        .iter()
        .any(|p| target == p || target.starts_with(p))
}

/// Kill a process by name and PID.
pub async fn kill_process(process_name: &str, pid: u32) -> Result<(), CommonError> {
    // Anti-Draper protection: reject the PIDs that would take the host or the
    // agent down with them.
    //
    // PID 0 is the critical case: `build_threat_context` defaults a missing PID
    // to 0, and `kill -9 0` signals *every process in the caller's process
    // group* -- which includes the agent itself. The `pid == my_pid` check below
    // does not catch it, because 0 is never equal to the agent's own PID.
    // PID 1 is init/launchd; killing it halts or panics the system.
    if pid == 0 || pid == 1 {
        warn!(
            "Anti-Draper triggered: refusing to kill reserved PID {} (process '{}')",
            pid, process_name
        );
        return Err(CommonError::internal(format!(
            "Anti-Draper protection: PID {} is reserved and cannot be terminated",
            pid
        )));
    }

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

    // Anti-Draper: refuse to quarantine the agent's own binary, config,
    // database, logs or quarantine store, and refuse system-critical
    // directories. This runs after canonicalization so a symlink cannot be used
    // to point at a protected path from an innocuous-looking one.
    if is_protected_target(&source, &protected_paths()) {
        warn!(
            "Anti-Draper triggered: refused to quarantine protected path '{}'",
            source.display()
        );
        return Err(CommonError::internal(format!(
            "Anti-Draper protection: refusing to quarantine protected path: {}",
            source.display()
        )));
    }

    // Create quarantine directory under the local data directory
    let quarantine_dir = quarantine_dir();

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

    let quarantine_dir = quarantine_dir();

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

    // SECURITY: Validate the restore path is not a system-critical location or
    // an agent-owned path. Shares `is_protected_target` with the quarantine
    // path so both directions enforce the same policy.
    //
    // The metadata file is attacker-influenced (it records whatever path was
    // quarantined), so this validates the *destination* rather than trusting it.
    let restore_path = Path::new(original_path);
    let protected = protected_paths();
    // The file does not exist yet at the destination, so canonicalize the
    // parent and re-attach the file name.
    let canonical_target = restore_path
        .parent()
        .and_then(|p| p.canonicalize().ok())
        .map(|parent| match restore_path.file_name() {
            Some(name) => parent.join(name),
            None => parent,
        });
    if let Some(ref target) = canonical_target
        && is_protected_target(target, &protected)
    {
        warn!(
            "Anti-Draper triggered: refused to restore into protected path '{}'",
            original_path
        );
        return Err(CommonError::internal(format!(
            "Refusing to restore file to system-critical directory: {}",
            original_path
        )));
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

/// Last-known-good resolution of the backend host.
///
/// Lets the backend guard keep working through a DNS outage instead of having
/// to choose between blocking nothing and risking the control channel.
static BACKEND_IPS: std::sync::RwLock<Option<std::collections::HashSet<std::net::IpAddr>>> =
    std::sync::RwLock::new(None);

/// Whether the configured backend host resolves to `candidate`.
///
/// The previous check compared the URL host *string* against the IP, which can
/// never match in production: the backend is configured as a hostname
/// (Firebase / Cloud Functions), so a request to block it by resolved address
/// went straight through and severed the agent's own control channel -- with no
/// way for the platform to push a correction afterwards.
async fn resolves_to_backend(server_url: &str, candidate: std::net::IpAddr) -> bool {
    let Ok(url) = url::Url::parse(server_url) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };

    // A literal IP in the config needs no resolution.
    if let Ok(configured) = host.parse::<std::net::IpAddr>() {
        return configured == candidate;
    }

    let port = url.port_or_known_default().unwrap_or(443);
    match tokio::net::lookup_host((host, port)).await {
        Ok(addrs) => {
            let resolved: std::collections::HashSet<std::net::IpAddr> =
                addrs.map(|a| a.ip()).collect();
            let matched = resolved.contains(&candidate);
            if let Ok(mut cache) = BACKEND_IPS.write() {
                *cache = Some(resolved);
            }
            matched
        }
        Err(e) => {
            // Fall back to the last successful resolution. With no cache at all
            // we cannot prove the address is safe, so refuse: a missed block is
            // recoverable, a severed control channel needs manual intervention
            // on every endpoint.
            let cached = BACKEND_IPS.read().ok().and_then(|c| c.clone());
            match cached {
                Some(ips) => {
                    warn!(
                        "Could not resolve backend host '{}' ({}); \
                         validating IP block against last-known-good resolution",
                        host, e
                    );
                    ips.contains(&candidate)
                }
                None => {
                    warn!(
                        "Could not resolve backend host '{}' ({}) and no cached \
                         resolution is available; refusing the block rather than \
                         risk severing the control channel",
                        host, e
                    );
                    true
                }
            }
        }
    }
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

    if let Ok(config) = agent_common::config::AgentConfig::load(None)
        && resolves_to_backend(&config.server_url, parsed_ip).await
    {
        warn!(
            "Anti-Draper triggered: Attempted to block backend API server ({})",
            ip
        );
        return Err(CommonError::internal(
            "Anti-Draper protection: Cannot block the backend API server",
        ));
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

    // Schedule automatic unblock if duration > 0.
    //
    // The timer below lives in memory and dies with the process. Persist the
    // deadline too: an agent that restarts between the block and its expiry
    // would otherwise leave the firewall rule in place forever, with nothing on
    // disk explaining why -- iptables and netsh rules outlive the agent, and a
    // netsh rule survives reboot.
    if duration_secs > 0 {
        let unblock_at = chrono::Utc::now().timestamp() + duration_secs as i64;
        record_pending_block(ip, unblock_at).await;

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

/// File tracking IP blocks that carry an expiry, so a restart can honor them.
/// Maps `ip -> unix_deadline_secs`.
fn pending_blocks_path() -> PathBuf {
    quarantine_dir()
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(std::env::temp_dir)
        .join("pending_ip_blocks.json")
}

async fn load_pending_blocks() -> std::collections::HashMap<String, i64> {
    match tokio::fs::read_to_string(pending_blocks_path()).await {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => std::collections::HashMap::new(),
    }
}

async fn store_pending_blocks(entries: &std::collections::HashMap<String, i64>) {
    let path = pending_blocks_path();
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    match serde_json::to_string_pretty(entries) {
        Ok(json) => {
            if let Err(e) = tokio::fs::write(&path, json).await {
                warn!("Failed to persist pending IP blocks: {}", e);
            }
        }
        Err(e) => warn!("Failed to serialize pending IP blocks: {}", e),
    }
}

/// Record (or refresh) a pending timed unblock on disk.
async fn record_pending_block(ip: &str, unblock_at_epoch_secs: i64) {
    let mut entries = load_pending_blocks().await;
    entries.insert(ip.to_string(), unblock_at_epoch_secs);
    store_pending_blocks(&entries).await;
}

/// Drop an IP from the pending-unblock ledger once it has been unblocked.
async fn clear_pending_block(ip: &str) {
    let mut entries = load_pending_blocks().await;
    if entries.remove(ip).is_some() {
        store_pending_blocks(&entries).await;
    }
}

/// Reconcile firewall state with the pending-unblock ledger after a restart.
///
/// The in-memory unblock timers die with the process, but iptables/netsh rules
/// do not. Any deadline that expired while the agent was down is unblocked
/// immediately; the rest are rescheduled for their remaining time.
///
/// Call once during agent startup.
pub async fn reconcile_pending_blocks() {
    let entries = load_pending_blocks().await;
    if entries.is_empty() {
        return;
    }

    let now = chrono::Utc::now().timestamp();
    info!(
        "Reconciling {} pending IP unblock(s) after restart",
        entries.len()
    );

    for (ip, unblock_at) in entries {
        if unblock_at <= now {
            if let Err(e) = unblock_ip(&ip).await {
                warn!("Failed to unblock expired IP '{}' at startup: {}", ip, e);
            }
        } else {
            let remaining = (unblock_at - now) as u64;
            info!("Rescheduling unblock of '{}' in {}s", ip, remaining);
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(remaining)).await;
                if let Err(e) = unblock_ip(&ip).await {
                    warn!("Failed to auto-unblock IP '{}': {}", ip, e);
                }
            });
        }
    }
}

/// Unblock a previously blocked IP address.
pub async fn unblock_ip(ip: &str) -> Result<(), CommonError> {
    info!("Unblocking IP '{}'", ip);
    clear_pending_block(ip).await;

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

    // ── kill: reserved PIDs ─────────────────────────────────────────────

    /// PID 0 is the dangerous one: `build_threat_context` defaults a missing
    /// PID to 0, and `kill -9 0` signals the caller's entire process group,
    /// taking the agent down with it. The `pid == my_pid` guard never catches
    /// it because 0 is not the agent's PID.
    #[tokio::test]
    async fn test_kill_rejects_reserved_pids() {
        for pid in [0u32, 1u32] {
            let result = kill_process("anything", pid).await;
            assert!(result.is_err(), "PID {} must be refused", pid);
            let msg = result.unwrap_err().to_string();
            assert!(
                msg.contains("reserved"),
                "PID {} should be refused as reserved, got: {}",
                pid,
                msg
            );
        }
    }

    #[tokio::test]
    async fn test_kill_rejects_own_pid() {
        let result = kill_process("sentinel-agent", std::process::id()).await;
        assert!(result.is_err(), "agent must not kill itself");
        assert!(
            result.unwrap_err().to_string().contains("Anti-Draper"),
            "self-kill should be refused by Anti-Draper"
        );
    }

    // ── protected path semantics ────────────────────────────────────────

    #[test]
    fn test_is_protected_target_is_component_wise() {
        let protected = vec![PathBuf::from("/usr/bin")];

        assert!(is_protected_target(
            Path::new("/usr/bin/sentinel"),
            &protected
        ));
        assert!(is_protected_target(Path::new("/usr/bin"), &protected));
        // A sibling directory sharing a textual prefix must NOT match. This is
        // why the guard uses Path::starts_with rather than string contains.
        assert!(!is_protected_target(
            Path::new("/usr/bindings/evil"),
            &protected
        ));
        assert!(!is_protected_target(Path::new("/tmp/evil"), &protected));
    }

    #[test]
    fn test_is_protected_target_guards_filesystem_root() {
        // Root is not in the prefix list (it would match everything), so it is
        // handled explicitly: a file directly at "/" is protected, but a file
        // nested deeper is judged on its own merits.
        let protected: Vec<PathBuf> = vec![];
        assert!(is_protected_target(Path::new("/vmlinuz"), &protected));
        assert!(!is_protected_target(Path::new("/tmp/evil"), &protected));
    }

    #[test]
    fn test_protected_paths_include_agent_binary() {
        let protected = protected_paths();
        let exe = std::env::current_exe()
            .and_then(|p| p.canonicalize())
            .expect("resolve test binary");
        assert!(
            is_protected_target(&exe, &protected),
            "the running agent binary must be protected, got {:?}",
            protected
        );
    }

    // ── quarantine: self-protection ─────────────────────────────────────

    /// The core Anti-Draper gap this guard closes: a playbook naming the
    /// agent's own binary would otherwise move it into quarantine and disable
    /// the agent on every endpoint at once.
    #[tokio::test]
    async fn test_quarantine_refuses_agent_binary() {
        let exe = std::env::current_exe().expect("resolve test binary");
        let result = quarantine_file(exe.to_str().unwrap()).await;
        assert!(result.is_err(), "must refuse to quarantine its own binary");
        let msg = result.unwrap_err().to_string();
        assert!(
            msg.contains("Anti-Draper"),
            "expected Anti-Draper refusal, got: {}",
            msg
        );
        assert!(exe.exists(), "the binary must still be in place");
    }

    #[tokio::test]
    async fn test_quarantine_refuses_own_quarantine_store() {
        // Quarantining a file already in quarantine would let a playbook
        // recursively consume the store.
        let dir = quarantine_dir();
        tokio::fs::create_dir_all(&dir).await.expect("create dir");
        let victim = dir.join("already-quarantined.bin");
        tokio::fs::write(&victim, b"x").await.expect("write");

        let result = quarantine_file(victim.to_str().unwrap()).await;
        assert!(
            result.is_err(),
            "must refuse to re-quarantine the quarantine store"
        );

        let _ = tokio::fs::remove_file(&victim).await;
    }

    /// The guard must not over-block: ordinary malware in a temp directory has
    /// to remain quarantinable, otherwise the fix breaks the product.
    #[tokio::test]
    async fn test_quarantine_still_allows_ordinary_files() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("malware.bin");
        std::fs::write(&target, b"evil").unwrap();

        let result = quarantine_file(target.to_str().unwrap()).await;
        assert!(
            result.is_ok(),
            "ordinary files must still be quarantinable, got: {:?}",
            result.err()
        );
        assert!(!target.exists(), "file should have been moved");

        if let Ok(id) = result {
            let qdir = quarantine_dir();
            let _ = tokio::fs::remove_file(qdir.join(&id)).await;
            let _ = tokio::fs::remove_file(qdir.join(format!("{}.meta", id))).await;
        }
    }

    // ── backend resolution ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_backend_match_on_literal_ip() {
        let ip: std::net::IpAddr = "203.0.113.7".parse().unwrap();
        assert!(resolves_to_backend("https://203.0.113.7/api", ip).await);

        let other: std::net::IpAddr = "203.0.113.8".parse().unwrap();
        assert!(!resolves_to_backend("https://203.0.113.7/api", other).await);
    }

    /// A hostname that cannot resolve, with no cached resolution, must fail
    /// closed. Losing the control channel needs manual intervention on every
    /// endpoint; a missed block does not.
    #[tokio::test]
    async fn test_backend_unresolvable_fails_closed() {
        if let Ok(mut cache) = BACKEND_IPS.write() {
            *cache = None;
        }
        let ip: std::net::IpAddr = "203.0.113.7".parse().unwrap();
        assert!(
            resolves_to_backend("https://invalid.invalid./api", ip).await,
            "unresolvable backend with no cache must refuse the block"
        );
    }

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
