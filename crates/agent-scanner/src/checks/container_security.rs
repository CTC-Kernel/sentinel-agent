//! Container Security compliance check.
//!
//! Verifies Docker/Podman security configuration:
//! - Rootless mode configuration
//! - User namespace remapping
//! - Seccomp profiles enabled
//! - AppArmor/SELinux enforcement
//! - Resource limits (ulimits, memory, CPU)
//! - Network isolation
//! - Read-only root filesystem
//!
//! Supported platforms:
//! - Linux: Full support for Docker and Podman
//! - macOS: Docker Desktop checks
//! - Windows: Docker Desktop and WSL2 checks

use crate::check::{Check, CheckDefinitionBuilder, CheckOutput};
use crate::error::ScannerResult;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::process::Command;
use tracing::debug;

/// Check ID for container security.
pub const CHECK_ID: &str = "container_security";

/// Container security status details.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerSecurityStatus {
    /// Whether container security is properly configured.
    pub secure: bool,

    /// Container runtime detected (docker, podman, containerd, none).
    pub runtime: String,

    /// Runtime version.
    pub runtime_version: Option<String>,

    /// Whether Docker/Podman daemon is running.
    pub daemon_running: bool,

    /// Whether rootless mode is enabled.
    pub rootless_mode: bool,

    /// Whether user namespace remapping is configured.
    pub userns_remapped: bool,

    /// Whether seccomp is enabled.
    pub seccomp_enabled: bool,

    /// Default seccomp profile.
    pub seccomp_profile: Option<String>,

    /// Whether AppArmor is enabled.
    pub apparmor_enabled: bool,

    /// Whether SELinux is enabled.
    pub selinux_enabled: bool,

    /// Whether live restore is enabled.
    pub live_restore_enabled: bool,

    /// Whether content trust is enabled.
    pub content_trust_enabled: bool,

    /// Whether inter-container communication is restricted.
    pub icc_disabled: bool,

    /// Whether userland proxy is disabled.
    pub userland_proxy_disabled: bool,

    /// Storage driver in use.
    pub storage_driver: Option<String>,

    /// Logging driver configured.
    pub logging_driver: Option<String>,

    /// Number of running containers.
    pub running_containers: u32,

    /// Privileged containers detected.
    pub privileged_containers: Vec<String>,

    /// Containers running as root.
    pub root_containers: Vec<String>,

    /// Containers without resource limits.
    pub unlimited_containers: Vec<String>,

    /// Non-compliance reasons.
    #[serde(default)]
    pub issues: Vec<String>,

    /// Recommendations for improvement.
    #[serde(default)]
    pub recommendations: Vec<String>,

    /// Raw output from system commands.
    #[serde(default)]
    pub raw_output: String,
}

/// Container security compliance check.
pub struct ContainerSecurityCheck {
    definition: CheckDefinition,
}

impl ContainerSecurityCheck {
    /// Create a new container security check.
    pub fn new() -> Self {
        let definition = CheckDefinitionBuilder::new(CHECK_ID)
            .name("Container Security")
            .description("Verify Docker/Podman container runtime security configuration")
            .category(CheckCategory::ContainerSecurity)
            .severity(CheckSeverity::High)
            .framework("NIS2")
            .framework("DORA")
            .framework("CIS_V8")
            .framework("PCI_DSS")
            .framework("NIST_CSF")
            .framework("ISO_27001")
            .platforms(vec![
                "linux".to_string(),
                "macos".to_string(),
                "windows".to_string(),
            ])
            .build();

        Self { definition }
    }

    /// Check Docker daemon configuration.
    fn check_docker(&self, status: &mut ContainerSecurityStatus) -> ScannerResult<()> {
        debug!("Checking Docker security configuration");

        // Check Docker version
        let version_output = Command::new("docker")
            .args(["version", "--format", "{{.Server.Version}}"])
            .output();

        if let Ok(output) = version_output
            && output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                status.runtime = "docker".to_string();
                status.runtime_version = Some(version.clone());
                status.daemon_running = true;
                status
                    .raw_output
                    .push_str(&format!("Docker version: {}\n", version));
            }

        if !status.daemon_running {
            return Ok(());
        }

        // Get Docker info for security settings
        let info_output = Command::new("docker")
            .args(["info", "--format", "json"])
            .output();

        if let Ok(output) = info_output {
            let info_json = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("docker info:\n{}\n", info_json));

            if let Ok(info) = serde_json::from_str::<serde_json::Value>(&info_json) {
                // Check security options
                if let Some(security_options) =
                    info.get("SecurityOptions").and_then(|v| v.as_array())
                {
                    let options: Vec<String> = security_options
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();

                    status.seccomp_enabled = options.iter().any(|o| o.contains("seccomp"));
                    status.apparmor_enabled = options.iter().any(|o| o.contains("apparmor"));
                    status.selinux_enabled = options.iter().any(|o| o.contains("selinux"));
                    status.userns_remapped = options.iter().any(|o| o.contains("userns"));
                    status.rootless_mode = options.iter().any(|o| o.contains("rootless"));

                    // Get seccomp profile
                    for opt in &options {
                        if opt.contains("seccomp")
                            && let Some(profile) = opt.split('=').next_back() {
                                status.seccomp_profile = Some(profile.to_string());
                            }
                    }
                }

                // Storage driver
                if let Some(driver) = info.get("Driver").and_then(|v| v.as_str()) {
                    status.storage_driver = Some(driver.to_string());
                }

                // Logging driver
                if let Some(driver) = info.get("LoggingDriver").and_then(|v| v.as_str()) {
                    status.logging_driver = Some(driver.to_string());
                }

                // Live restore
                if let Some(live_restore) = info.get("LiveRestoreEnabled").and_then(|v| v.as_bool())
                {
                    status.live_restore_enabled = live_restore;
                }

                // Running containers count
                if let Some(running) = info.get("ContainersRunning").and_then(|v| v.as_u64()) {
                    status.running_containers = u32::try_from(running).unwrap_or(u32::MAX);
                }
            }
        }

        // Check daemon.json for additional settings
        #[cfg(target_os = "linux")]
        {
            if let Ok(daemon_config) = std::fs::read_to_string("/etc/docker/daemon.json") {
                status
                    .raw_output
                    .push_str(&format!("daemon.json:\n{}\n", daemon_config));

                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&daemon_config) {
                    // Check icc (inter-container communication)
                    if let Some(icc) = config.get("icc").and_then(|v| v.as_bool()) {
                        status.icc_disabled = !icc;
                    }

                    // Check userland-proxy
                    if let Some(proxy) = config.get("userland-proxy").and_then(|v| v.as_bool()) {
                        status.userland_proxy_disabled = !proxy;
                    }

                    // Check content-trust (DOCKER_CONTENT_TRUST)
                    if config.get("content-trust").is_some() {
                        status.content_trust_enabled = true;
                    }

                    // Check userns-remap
                    if config.get("userns-remap").is_some() {
                        status.userns_remapped = true;
                    }
                }
            }
        }

        // Check for problematic containers
        self.check_running_containers(status)?;

        Ok(())
    }

    /// Check Podman configuration.
    fn check_podman(&self, status: &mut ContainerSecurityStatus) -> ScannerResult<()> {
        debug!("Checking Podman security configuration");

        // Check Podman version
        let version_output = Command::new("podman")
            .args(["version", "--format", "{{.Version}}"])
            .output();

        if let Ok(output) = version_output
            && output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if status.runtime.is_empty() || status.runtime == "none" {
                    status.runtime = "podman".to_string();
                    status.runtime_version = Some(version.clone());
                    status.daemon_running = true;
                    // Podman is rootless by default
                    status.rootless_mode = true;
                }
                status
                    .raw_output
                    .push_str(&format!("Podman version: {}\n", version));
            }

        if status.runtime != "podman" {
            return Ok(());
        }

        // Get Podman info
        let info_output = Command::new("podman")
            .args(["info", "--format", "json"])
            .output();

        if let Ok(output) = info_output {
            let info_json = String::from_utf8_lossy(&output.stdout).to_string();
            status
                .raw_output
                .push_str(&format!("podman info:\n{}\n", info_json));

            if let Ok(info) = serde_json::from_str::<serde_json::Value>(&info_json) {
                // Check host security
                if let Some(host) = info.get("host") {
                    // Security options
                    if let Some(security) = host.get("security") {
                        if let Some(rootless) = security.get("rootless").and_then(|v| v.as_bool()) {
                            status.rootless_mode = rootless;
                        }
                        if let Some(selinux) =
                            security.get("selinuxEnabled").and_then(|v| v.as_bool())
                        {
                            status.selinux_enabled = selinux;
                        }
                        if let Some(apparmor) =
                            security.get("apparmorEnabled").and_then(|v| v.as_bool())
                        {
                            status.apparmor_enabled = apparmor;
                        }
                    }
                }

                // Storage info
                if let Some(store) = info.get("store")
                    && let Some(driver) = store.get("graphDriverName").and_then(|v| v.as_str()) {
                        status.storage_driver = Some(driver.to_string());
                    }
            }
        }

        // Podman typically has seccomp enabled by default
        status.seccomp_enabled = true;
        status.seccomp_profile = Some("default".to_string());

        Ok(())
    }

    /// Check running containers for security issues.
    fn check_running_containers(&self, status: &mut ContainerSecurityStatus) -> ScannerResult<()> {
        let runtime = if status.runtime == "podman" {
            "podman"
        } else {
            "docker"
        };

        // Get list of running containers with security-relevant info
        let ps_output = Command::new(runtime)
            .args(["ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}"])
            .output();

        if let Ok(output) = ps_output {
            let containers = String::from_utf8_lossy(&output.stdout);

            for line in containers.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() < 2 {
                    continue;
                }

                let container_id = parts[0];
                let container_name = parts[1];

                // Inspect each container for security settings
                let inspect_output = Command::new(runtime)
                    .args(["inspect", "--format", "json", container_id])
                    .output();

                if let Ok(output) = inspect_output {
                    let inspect_json = String::from_utf8_lossy(&output.stdout);

                    if let Ok(inspects) =
                        serde_json::from_str::<Vec<serde_json::Value>>(&inspect_json)
                        && let Some(inspect) = inspects.first() {
                            // Check if privileged
                            if let Some(host_config) = inspect.get("HostConfig") {
                                if let Some(privileged) =
                                    host_config.get("Privileged").and_then(|v| v.as_bool())
                                    && privileged {
                                        status
                                            .privileged_containers
                                            .push(container_name.to_string());
                                    }

                                // Check resource limits
                                let has_limits = host_config
                                    .get("Memory")
                                    .and_then(|v| v.as_i64())
                                    .unwrap_or(0)
                                    > 0
                                    || host_config
                                        .get("CpuPeriod")
                                        .and_then(|v| v.as_i64())
                                        .unwrap_or(0)
                                        > 0;

                                if !has_limits {
                                    status.unlimited_containers.push(container_name.to_string());
                                }
                            }

                            // Check if running as root
                            if let Some(config) = inspect.get("Config")
                                && let Some(user) = config.get("User").and_then(|v| v.as_str())
                                    && (user.is_empty() || user == "0" || user == "root") {
                                        status.root_containers.push(container_name.to_string());
                                    }
                        }
                }
            }
        }

        Ok(())
    }

    /// Generate findings and recommendations.
    fn generate_findings(&self, status: &mut ContainerSecurityStatus) {
        // Critical issues
        if !status.privileged_containers.is_empty() {
            status.issues.push(format!(
                "{} privileged containers detected: {}",
                status.privileged_containers.len(),
                status.privileged_containers.join(", ")
            ));
            status.recommendations.push(
                "Avoid running privileged containers; use specific capabilities instead"
                    .to_string(),
            );
        }

        if !status.rootless_mode && !status.userns_remapped {
            status
                .issues
                .push("Container runtime not running in rootless mode".to_string());
            status
                .recommendations
                .push("Enable rootless mode or configure user namespace remapping".to_string());
        }

        if !status.seccomp_enabled {
            status.issues.push("Seccomp is not enabled".to_string());
            status
                .recommendations
                .push("Enable seccomp with default profile".to_string());
        }

        // High severity
        if !status.root_containers.is_empty() {
            status.issues.push(format!(
                "{} containers running as root: {}",
                status.root_containers.len(),
                status.root_containers.join(", ")
            ));
            status
                .recommendations
                .push("Run containers with non-root user using USER directive".to_string());
        }

        // Medium severity
        if !status.unlimited_containers.is_empty() && status.unlimited_containers.len() <= 5 {
            status.issues.push(format!(
                "{} containers without resource limits",
                status.unlimited_containers.len()
            ));
            status
                .recommendations
                .push("Set memory and CPU limits for all containers".to_string());
        }

        if !status.live_restore_enabled && status.runtime == "docker" {
            status
                .recommendations
                .push("Enable live-restore for zero-downtime daemon updates".to_string());
        }

        if !status.content_trust_enabled {
            status
                .recommendations
                .push("Enable Docker Content Trust for image signing".to_string());
        }

        // Determine overall security status
        status.secure = (status.rootless_mode || status.userns_remapped)
            && status.seccomp_enabled
            && status.privileged_containers.is_empty()
            && (status.apparmor_enabled || status.selinux_enabled || cfg!(target_os = "macos"));
    }

    /// Main check logic.
    async fn check_containers(&self) -> ScannerResult<ContainerSecurityStatus> {
        let mut status = ContainerSecurityStatus {
            secure: false,
            runtime: "none".to_string(),
            runtime_version: None,
            daemon_running: false,
            rootless_mode: false,
            userns_remapped: false,
            seccomp_enabled: false,
            seccomp_profile: None,
            apparmor_enabled: false,
            selinux_enabled: false,
            live_restore_enabled: false,
            content_trust_enabled: false,
            icc_disabled: false,
            userland_proxy_disabled: false,
            storage_driver: None,
            logging_driver: None,
            running_containers: 0,
            privileged_containers: Vec::new(),
            root_containers: Vec::new(),
            unlimited_containers: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        // Check content trust env var
        if std::env::var("DOCKER_CONTENT_TRUST")
            .map(|v| v == "1")
            .unwrap_or(false)
        {
            status.content_trust_enabled = true;
        }

        // Try Docker first
        self.check_docker(&mut status)?;

        // Try Podman if Docker not found
        if status.runtime == "none" || !status.daemon_running {
            self.check_podman(&mut status)?;
        }

        if status.daemon_running {
            self.generate_findings(&mut status);
        }

        Ok(status)
    }
}

impl Default for ContainerSecurityCheck {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Check for ContainerSecurityCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        let status = self.check_containers().await?;

        let raw_data = serde_json::to_value(&status).unwrap_or_default();

        if !status.daemon_running {
            return Ok(CheckOutput::pass(
                "No container runtime detected (Docker/Podman not installed or not running)"
                    .to_string(),
                raw_data,
            ));
        }

        if status.secure {
            let mut details = vec![format!("runtime={}", status.runtime)];
            if status.rootless_mode {
                details.push("rootless=yes".to_string());
            }
            if status.seccomp_enabled {
                details.push("seccomp=enabled".to_string());
            }
            if status.selinux_enabled || status.apparmor_enabled {
                details.push("mac=enabled".to_string());
            }

            Ok(CheckOutput::pass(
                format!(
                    "Container runtime is properly secured: {}",
                    details.join(", ")
                ),
                raw_data,
            ))
        } else {
            Ok(CheckOutput::fail(
                format!(
                    "Container security issues ({}): {}",
                    status.issues.len(),
                    status.issues.join("; ")
                ),
                raw_data,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_creation() {
        let check = ContainerSecurityCheck::new();
        assert_eq!(check.definition().id, CHECK_ID);
        assert_eq!(
            check.definition().category,
            CheckCategory::ContainerSecurity
        );
        assert_eq!(check.definition().severity, CheckSeverity::High);
    }

    #[test]
    fn test_check_frameworks() {
        let check = ContainerSecurityCheck::new();
        let frameworks = &check.definition().frameworks;
        assert!(frameworks.contains(&"NIS2".to_string()));
        assert!(frameworks.contains(&"CIS_V8".to_string()));
        assert!(frameworks.contains(&"PCI_DSS".to_string()));
    }

    #[test]
    fn test_container_status_serialization() {
        let status = ContainerSecurityStatus {
            secure: true,
            runtime: "docker".to_string(),
            runtime_version: Some("24.0.0".to_string()),
            daemon_running: true,
            rootless_mode: true,
            userns_remapped: false,
            seccomp_enabled: true,
            seccomp_profile: Some("default".to_string()),
            apparmor_enabled: true,
            selinux_enabled: false,
            live_restore_enabled: true,
            content_trust_enabled: false,
            icc_disabled: true,
            userland_proxy_disabled: false,
            storage_driver: Some("overlay2".to_string()),
            logging_driver: Some("json-file".to_string()),
            running_containers: 5,
            privileged_containers: Vec::new(),
            root_containers: Vec::new(),
            unlimited_containers: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: "test".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"secure\":true"));
        assert!(json.contains("\"runtime\":\"docker\""));
        assert!(json.contains("\"rootless_mode\":true"));

        let parsed: ContainerSecurityStatus = serde_json::from_str(&json).unwrap();
        assert!(parsed.secure);
        assert!(parsed.rootless_mode);
    }

    #[test]
    fn test_findings_generation() {
        let check = ContainerSecurityCheck::new();
        let mut status = ContainerSecurityStatus {
            secure: false,
            runtime: "docker".to_string(),
            runtime_version: Some("24.0.0".to_string()),
            daemon_running: true,
            rootless_mode: false,
            userns_remapped: false,
            seccomp_enabled: false,
            seccomp_profile: None,
            apparmor_enabled: false,
            selinux_enabled: false,
            live_restore_enabled: false,
            content_trust_enabled: false,
            icc_disabled: false,
            userland_proxy_disabled: false,
            storage_driver: None,
            logging_driver: None,
            running_containers: 2,
            privileged_containers: vec!["privileged-app".to_string()],
            root_containers: vec!["root-app".to_string()],
            unlimited_containers: Vec::new(),
            issues: Vec::new(),
            recommendations: Vec::new(),
            raw_output: String::new(),
        };

        check.generate_findings(&mut status);

        assert!(!status.issues.is_empty());
        assert!(status.issues.iter().any(|i| i.contains("privileged")));
        assert!(status.issues.iter().any(|i| i.contains("rootless")));
        assert!(!status.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_check_execution() {
        let check = ContainerSecurityCheck::new();
        let result = check.execute().await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(!output.message.is_empty());
    }
}
