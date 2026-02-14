//! Unix/Linux service implementation for the Sentinel GRC Agent.
//!
//! This module provides systemd integration for Linux systems.
//! The actual service management is handled by systemd, this module
//! provides helper functions for installation and status checking.

use super::{ServiceError, ServiceResult, ServiceState};
use std::fs;
use std::path::Path;
use std::process::Command;
use tracing::{error, info, warn};

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

/// Run as a foreground process managed by systemd.
///
/// Loads configuration, opens the database, creates the AgentRuntime,
/// and runs the main agent loop. systemd handles the service lifecycle
/// (restart, watchdog, shutdown signals).
pub fn run_as_service() -> ServiceResult<()> {
    use agent_common::config::AgentConfig;
    use agent_storage::{Database, DatabaseConfig, KeyManager};

    info!("Running as systemd service");

    // Load configuration
    let mut config = AgentConfig::load(None).unwrap_or_else(|e| {
        warn!("No config found, using defaults: {}", e);
        AgentConfig::default()
    });

    // Initialize encrypted database
    let key_manager = KeyManager::new().map_err(|e| {
        ServiceError::System(format!("Failed to initialize key manager: {}", e))
    })?;
    let db = Database::open(DatabaseConfig::default(), &key_manager).map_err(|e| {
        ServiceError::System(format!("Failed to open database: {}", e))
    })?;

    // Create tokio runtime for async operations
    let rt = tokio::runtime::Runtime::new().map_err(|e| {
        ServiceError::System(format!("Failed to create Tokio runtime: {}", e))
    })?;

    // Load credentials if enrolled
    rt.block_on(async {
        use agent_sync::{CredentialsRepository, EnrollmentManager};

        let enrollment_manager = EnrollmentManager::new(&config, &db);
        if enrollment_manager.is_enrolled().await.unwrap_or(false) {
            let creds_repo = CredentialsRepository::new(&db);
            if let Ok(Some(creds)) = creds_repo.load().await {
                config.agent_id = Some(creds.agent_id.to_string());
                config.organization_id = Some(creds.organization_id.to_string());
                config.client_certificate = Some(creds.client_certificate.clone());
                config.client_key = Some(creds.client_private_key.clone());
                info!("Loaded credentials for agent {}", creds.agent_id);
            }
        } else {
            warn!("Agent not enrolled. Service will run in offline mode.");
        }
    });

    // Create and run the agent
    let db = std::sync::Arc::new(db);
    let runtime = crate::AgentRuntime::new(config).with_database(db);

    info!("Agent runtime initialized, starting main loop");
    rt.block_on(async {
        if let Err(e) = runtime.run().await {
            error!("Agent runtime error: {}", e);
        }
    });

    info!("Agent service stopped");
    Ok(())
}

/// Install the systemd service.
///
/// Creates the systemd unit file and enables the service.
/// Requires root privileges.
pub fn install_service(executable_path: &str) -> ServiceResult<()> {
    // Validate executable path to prevent systemd unit file injection
    // Must be absolute path with no shell special characters or injection vectors
    if !executable_path.starts_with('/')
        || executable_path.contains('\n')
        || executable_path.contains('\r')
        || executable_path.contains('$')
        || executable_path.contains('`')
        || executable_path.contains(';')
        || executable_path.contains('&')
        || executable_path.contains('|')
        || executable_path.contains('>')
        || executable_path.contains('<')
        || executable_path.contains('"')
        || executable_path.contains('\'')
        || executable_path.contains('\\')
        || executable_path.contains("..")
        || executable_path.contains("//")
        || executable_path.len() > 4096  // Reasonable path length limit
    {
        return Err(ServiceError::System(
            "Invalid executable path: must be absolute, contain no shell special characters, and be under 4096 characters".to_string(),
        ));
    }

    // Additional validation: ensure path exists and is executable
    if !Path::new(executable_path).exists() {
        return Err(ServiceError::System(
            "Executable path does not exist".to_string(),
        ));
    }

    // Check if file is executable by owner
    match std::fs::metadata(executable_path) {
        Ok(metadata) => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if metadata.permissions().mode() & 0o111 == 0 {
                    return Err(ServiceError::System(
                        "Executable file is not executable".to_string(),
                    ));
                }
            }
        }
        Err(_) => {
            return Err(ServiceError::System(
                "Cannot read executable file metadata".to_string(),
            ));
        }
    }

    // Check for root privileges
    if !is_root() {
        return Err(ServiceError::PermissionDenied(
            "Root privileges required to install service".to_string(),
        ));
    }

    // Generate unit file content
    let unit_content = SYSTEMD_UNIT_TEMPLATE.replace("{executable_path}", executable_path);

    // Atomic create — fails if file already exists (prevents TOCTOU race)
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(SYSTEMD_UNIT_PATH)
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::AlreadyExists => ServiceError::AlreadyInstalled,
            _ => ServiceError::System(format!("Failed to write unit file: {}", e)),
        })?;
    file.write_all(unit_content.as_bytes())
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
            Ok(ServiceState::Stopped) => {
                info!("Service stopped successfully");
                break;
            }
            Ok(ServiceState::Running) | Ok(ServiceState::Stopping) => {
                // Still running or stopping, wait more
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
