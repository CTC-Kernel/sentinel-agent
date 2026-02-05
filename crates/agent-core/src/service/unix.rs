//! Unix/Linux service implementation for the Sentinel GRC Agent.
//!
//! This module provides systemd integration for Linux systems.
//! The actual service management is handled by systemd, this module
//! provides helper functions for installation and status checking.

use super::{ServiceError, ServiceResult, ServiceState};
use std::fs;
use std::path::Path;
use std::process::Command;
use tracing::{info, warn};

/// systemd service name (matches SERVICE_NAME pattern but lowercase for Linux conventions).
pub const SYSTEMD_SERVICE_NAME: &str = "sentinel-agent";

/// systemd unit file path.
const SYSTEMD_UNIT_PATH: &str = "/etc/systemd/system/sentinel-agent.service";

/// systemd unit file content template.
///
/// Paths are consistent with cleanup.rs:
/// - Install: /opt/sentinel-grc
/// - Data: /var/lib/sentinel-grc
/// - Logs: /var/log/sentinel-grc
const SYSTEMD_UNIT_TEMPLATE: &str = r#"[Unit]
Description=Sentinel GRC Agent - Agent de conformite endpoint
Documentation=https://docs.sentinel-grc.com
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart={executable_path} --service
Restart=always
RestartSec=10
WatchdogSec=120

# Dedicated service user
User=sentinel-grc
Group=sentinel-grc
WorkingDirectory=/opt/sentinel-grc
Environment=RUST_LOG=info

# Filesystem access
ReadWritePaths=/var/lib/sentinel-grc /var/log/sentinel-grc /etc/sentinel

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelModules=true
ProtectKernelTunables=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
RemoveIPC=true
SystemCallArchitectures=native

# Capabilities (network discovery, filesystem scanning)
CapabilityBoundingSet=CAP_NET_RAW CAP_DAC_READ_SEARCH
AmbientCapabilities=CAP_NET_RAW CAP_DAC_READ_SEARCH

# System call filter (allowlist)
SystemCallFilter=@system-service
SystemCallFilter=~@mount @reboot @swap @debug @obsolete

# Resource limits
MemoryMax=150M
MemoryHigh=100M
CPUQuota=10%
TasksMax=64
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
"#;

/// Run as a foreground process (not as a daemon).
///
/// On Linux, the actual daemonization is handled by systemd.
/// This function runs the agent in foreground mode, suitable for
/// being managed by systemd.
pub fn run_as_service() -> ServiceResult<()> {
    // On Unix, we just run the main loop directly
    // systemd handles the service lifecycle
    info!("Running as systemd service");

    // The actual agent loop would be run here
    // For now, this is a placeholder that will be integrated
    // with the AgentRuntime in the main binary

    Ok(())
}

/// Install the systemd service.
///
/// Creates the systemd unit file and enables the service.
/// Requires root privileges.
pub fn install_service(executable_path: &str) -> ServiceResult<()> {
    // Check if already installed
    if Path::new(SYSTEMD_UNIT_PATH).exists() {
        return Err(ServiceError::AlreadyInstalled);
    }

    // Check for root privileges
    if !is_root() {
        return Err(ServiceError::PermissionDenied(
            "Root privileges required to install service".to_string(),
        ));
    }

    // Generate unit file content
    let unit_content = SYSTEMD_UNIT_TEMPLATE.replace("{executable_path}", executable_path);

    // Write unit file
    fs::write(SYSTEMD_UNIT_PATH, unit_content)
        .map_err(|e| ServiceError::System(format!("Failed to write unit file: {}", e)))?;

    // Reload systemd daemon
    let output = Command::new("systemctl")
        .args(["daemon-reload"])
        .output()
        .map_err(|e| ServiceError::System(format!("Failed to reload systemd: {}", e)))?;

    if !output.status.success() {
        warn!(
            "systemctl daemon-reload returned non-zero: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    // Enable the service
    let output = Command::new("systemctl")
        .args(["enable", "sentinel-agent.service"])
        .output()
        .map_err(|e| ServiceError::System(format!("Failed to enable service: {}", e)))?;

    if !output.status.success() {
        return Err(ServiceError::System(format!(
            "Failed to enable service: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    info!("Service installed and enabled successfully");
    Ok(())
}

/// Uninstall the systemd service.
///
/// Stops the service, disables it, and removes the unit file.
/// Requires root privileges.
pub fn uninstall_service() -> ServiceResult<()> {
    // Check if installed
    if !Path::new(SYSTEMD_UNIT_PATH).exists() {
        return Err(ServiceError::NotInstalled);
    }

    // Check for root privileges
    if !is_root() {
        return Err(ServiceError::PermissionDenied(
            "Root privileges required to uninstall service".to_string(),
        ));
    }

    // Stop the service and wait for it to actually stop
    info!("Stopping sentinel-agent service...");
    let stop_result = Command::new("systemctl")
        .args(["stop", "sentinel-agent.service"])
        .output();

    if let Err(e) = stop_result {
        warn!("Failed to send stop command: {}", e);
    }

    // Wait for service to stop (with timeout)
    const MAX_STOP_WAIT_SECS: u64 = 30;
    let start_time = std::time::Instant::now();

    loop {
        match get_service_state() {
            Ok(ServiceState::Stopped) | Ok(ServiceState::Running) => {
                // Stopped or was never running
                if matches!(get_service_state(), Ok(ServiceState::Stopped)) {
                    info!("Service stopped successfully");
                    break;
                }
            }
            Ok(ServiceState::Stopping) => {
                // Still stopping, wait more
            }
            Err(_) | Ok(_) => {
                // Service might be gone or in unknown state, proceed
                break;
            }
        }

        if start_time.elapsed().as_secs() >= MAX_STOP_WAIT_SECS {
            warn!(
                "Service did not stop within {} seconds. Proceeding with uninstall.",
                MAX_STOP_WAIT_SECS
            );
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    // Disable the service
    let _ = Command::new("systemctl")
        .args(["disable", "sentinel-agent.service"])
        .output();

    // Remove the unit file
    fs::remove_file(SYSTEMD_UNIT_PATH)
        .map_err(|e| ServiceError::System(format!("Failed to remove unit file: {}", e)))?;

    // Reload systemd daemon
    let _ = Command::new("systemctl").args(["daemon-reload"]).output();

    info!("Service uninstalled successfully");
    Ok(())
}

/// Get the current service state via systemctl.
pub fn get_service_state() -> ServiceResult<ServiceState> {
    // Check if unit file exists
    if !Path::new(SYSTEMD_UNIT_PATH).exists() {
        return Err(ServiceError::NotInstalled);
    }

    let output = Command::new("systemctl")
        .args(["is-active", "sentinel-agent.service"])
        .output()
        .map_err(|e| ServiceError::System(format!("Failed to query service status: {}", e)))?;

    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();

    Ok(match status.as_str() {
        "active" => ServiceState::Running,
        "inactive" => ServiceState::Stopped,
        "activating" => ServiceState::Starting,
        "deactivating" => ServiceState::Stopping,
        _ => ServiceState::Stopped,
    })
}

/// Start the service via systemctl.
pub fn start_service() -> ServiceResult<()> {
    if !Path::new(SYSTEMD_UNIT_PATH).exists() {
        return Err(ServiceError::NotInstalled);
    }

    let state = get_service_state()?;
    if state == ServiceState::Running {
        return Err(ServiceError::AlreadyRunning);
    }

    let output = Command::new("systemctl")
        .args(["start", "sentinel-agent.service"])
        .output()
        .map_err(|e| ServiceError::System(format!("Failed to start service: {}", e)))?;

    if !output.status.success() {
        return Err(ServiceError::System(format!(
            "Failed to start service: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    info!("Service started");
    Ok(())
}

/// Stop the service via systemctl.
pub fn stop_service() -> ServiceResult<()> {
    if !Path::new(SYSTEMD_UNIT_PATH).exists() {
        return Err(ServiceError::NotInstalled);
    }

    let state = get_service_state()?;
    if state == ServiceState::Stopped {
        return Err(ServiceError::NotRunning);
    }

    let output = Command::new("systemctl")
        .args(["stop", "sentinel-agent.service"])
        .output()
        .map_err(|e| ServiceError::System(format!("Failed to stop service: {}", e)))?;

    if !output.status.success() {
        return Err(ServiceError::System(format!(
            "Failed to stop service: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    info!("Service stopped");
    Ok(())
}

/// Check if running as root.
pub fn is_root() -> bool {
    unsafe { libc::geteuid() == 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_systemd_unit_template() {
        let content = SYSTEMD_UNIT_TEMPLATE.replace("{executable_path}", "/opt/sentinel/agent");
        assert!(content.contains("ExecStart=/opt/sentinel/agent"));
        assert!(content.contains("Restart=always"));
        assert!(content.contains("MemoryMax=150M"));
    }
}
