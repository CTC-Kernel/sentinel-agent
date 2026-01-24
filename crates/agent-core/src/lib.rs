//! Agent Core - Core functionality for the Sentinel GRC Agent.
//!
//! This crate provides the main agent runtime, including:
//! - Service management (Windows Service / Linux systemd)
//! - Agent lifecycle management
//! - Configuration loading and validation
//! - Clean uninstallation support
//! - Resource monitoring and limits
//! - System tray interface (macOS/Windows)
//! - API client for server communication

pub mod api_client;
pub mod cleanup;
pub mod resources;
pub mod service;
pub mod tray;

use agent_common::config::AgentConfig;
use agent_common::constants::{AGENT_VERSION, DEFAULT_HEARTBEAT_INTERVAL_SECS};
use agent_common::error::CommonError;
use agent_scanner::{
    ScanType, SecurityMonitor, SecurityScanResult, VulnerabilityScanResult, VulnerabilityScanner,
};
use api_client::{ApiClient, EnrollmentRequest, HeartbeatRequest};
use resources::ResourceMonitor;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Default vulnerability scan interval (6 hours).
const DEFAULT_VULN_SCAN_INTERVAL_SECS: u64 = 6 * 60 * 60;

/// Default security scan interval (5 minutes).
const DEFAULT_SECURITY_SCAN_INTERVAL_SECS: u64 = 5 * 60;

/// Shutdown signal for graceful termination.
pub type ShutdownSignal = Arc<AtomicBool>;

/// Agent runtime managing the main execution loop.
pub struct AgentRuntime {
    config: AgentConfig,
    shutdown: ShutdownSignal,
    resource_monitor: ResourceMonitor,
    api_client: RwLock<Option<ApiClient>>,
    heartbeat_interval_secs: RwLock<u64>,
    /// Vulnerability scanner for package vulnerability detection.
    vulnerability_scanner: VulnerabilityScanner,
    /// Security monitor for incident detection.
    security_monitor: SecurityMonitor,
    /// Vulnerability scan interval in seconds.
    vuln_scan_interval_secs: u64,
    /// Security scan interval in seconds.
    security_scan_interval_secs: u64,
}

impl AgentRuntime {
    /// Create a new agent runtime with the given configuration.
    pub fn new(config: AgentConfig) -> Self {
        let resource_monitor = ResourceMonitor::new();
        let vulnerability_scanner = VulnerabilityScanner::new();
        let security_monitor = SecurityMonitor::new();

        info!(
            "Initialized vulnerability scanner ({} scanners available)",
            vulnerability_scanner.scanner_count()
        );

        Self {
            config,
            shutdown: Arc::new(AtomicBool::new(false)),
            resource_monitor,
            api_client: RwLock::new(None),
            heartbeat_interval_secs: RwLock::new(DEFAULT_HEARTBEAT_INTERVAL_SECS),
            vulnerability_scanner,
            security_monitor,
            vuln_scan_interval_secs: DEFAULT_VULN_SCAN_INTERVAL_SECS,
            security_scan_interval_secs: DEFAULT_SECURITY_SCAN_INTERVAL_SECS,
        }
    }

    /// Get a clone of the shutdown signal.
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.shutdown.clone()
    }

    /// Signal the agent to shut down.
    pub fn request_shutdown(&self) {
        info!("Shutdown requested");
        self.shutdown.store(true, Ordering::SeqCst);
    }

    /// Check if shutdown has been requested.
    pub fn is_shutdown_requested(&self) -> bool {
        self.shutdown.load(Ordering::SeqCst)
    }

    /// Get current resource usage for heartbeat.
    pub fn get_resource_usage(&self) -> resources::ResourceUsage {
        self.resource_monitor.get_usage()
    }

    /// Initialize the API client.
    async fn init_api_client(&self) -> Result<(), CommonError> {
        let client = ApiClient::new(&self.config)?;
        let mut api_client = self.api_client.write().await;
        *api_client = Some(client);
        Ok(())
    }

    /// Enroll the agent if not already enrolled.
    async fn ensure_enrolled(&self) -> Result<(), CommonError> {
        let mut api_client = self.api_client.write().await;
        let client = api_client
            .as_mut()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        // Check if already enrolled
        if client.agent_id().is_some() {
            return Ok(());
        }

        // Check if we have an agent ID in config
        if let Some(ref agent_id) = self.config.agent_id {
            client.set_agent_id(agent_id.clone());
            info!("Using existing agent ID: {}", agent_id);
            return Ok(());
        }

        // Need to enroll
        let enrollment_token = self.config.enrollment_token.as_ref().ok_or_else(|| {
            CommonError::config(
                "No agent ID or enrollment token. Please configure an enrollment token.",
            )
        })?;

        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let os = std::env::consts::OS.to_string();
        let os_version = get_os_version();
        let machine_id = get_machine_id();

        let request = EnrollmentRequest {
            enrollment_token: enrollment_token.clone(),
            hostname,
            os,
            os_version,
            machine_id,
            agent_version: AGENT_VERSION.to_string(),
        };

        let response = client.enroll(request).await?;

        // Update heartbeat interval from server config
        let mut interval = self.heartbeat_interval_secs.write().await;
        *interval = response.config.heartbeat_interval_secs;

        info!(
            "Enrolled successfully. Agent ID: {}, Heartbeat interval: {}s",
            response.agent_id, response.config.heartbeat_interval_secs
        );

        Ok(())
    }

    /// Send a heartbeat to the server.
    async fn send_heartbeat(&self) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let usage = self.resource_monitor.get_usage();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let request = HeartbeatRequest {
            timestamp: chrono::Utc::now().to_rfc3339(),
            agent_version: AGENT_VERSION.to_string(),
            status: "online".to_string(),
            hostname,
            os_info: format!("{} {}", std::env::consts::OS, get_os_version()),
            cpu_percent: usage.cpu_percent,
            memory_bytes: usage.memory_bytes,
            last_check_at: None,    // TODO: Track last check time
            compliance_score: None, // TODO: Track compliance score
            pending_sync_count: 0,  // TODO: Track pending syncs
            self_check_result: None,
        };

        let response = client.send_heartbeat(request).await?;

        // Handle commands if any
        for cmd in response.commands {
            info!("Received command: {} ({})", cmd.command_type, cmd.id);
            // TODO: Execute commands
        }

        // Check if config/rules need refresh
        if response.config_changed || response.rules_changed {
            info!("Server indicates config or rules have changed");
            // TODO: Fetch updated config/rules
        }

        Ok(())
    }

    /// Run a vulnerability scan and upload results.
    async fn run_vulnerability_scan(&self) -> Result<VulnerabilityScanResult, CommonError> {
        info!("Starting vulnerability scan...");

        let result = self
            .vulnerability_scanner
            .scan(ScanType::Packages)
            .await
            .map_err(|e| CommonError::config(format!("Vulnerability scan failed: {}", e)))?;

        info!(
            "Vulnerability scan complete: {} findings from {} packages",
            result.vulnerabilities.len(),
            result.packages_scanned
        );

        // Upload results if we have findings
        if !result.vulnerabilities.is_empty()
            && let Err(e) = self.upload_vulnerabilities(&result).await
        {
            warn!("Failed to upload vulnerability findings: {}", e);
        }

        Ok(result)
    }

    /// Upload vulnerability findings to the server.
    async fn upload_vulnerabilities(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        // Convert scanner findings to API types
        let vulnerabilities: Vec<serde_json::Value> = scan_result
            .vulnerabilities
            .iter()
            .map(|v| {
                serde_json::json!({
                    "package_name": v.package_name,
                    "installed_version": v.installed_version,
                    "available_version": v.available_version,
                    "cve_id": v.cve_id,
                    "cvss_score": v.cvss_score,
                    "severity": format!("{}", v.severity),
                    "description": v.description,
                    "remediation": v.remediation,
                    "detected_at": v.detected_at.to_rfc3339(),
                })
            })
            .collect();

        let payload = serde_json::json!({
            "vulnerabilities": vulnerabilities,
            "scan_type": format!("{:?}", scan_result.scan_type).to_lowercase(),
        });

        let url = format!("/v1/agents/{}/vulnerabilities", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!("Uploaded {} vulnerability findings", vulnerabilities.len());
        Ok(())
    }

    /// Run a security scan and upload incidents.
    async fn run_security_scan(&self) -> Result<SecurityScanResult, CommonError> {
        debug!("Running security scan...");

        let result = self
            .security_monitor
            .scan()
            .await
            .map_err(|e| CommonError::config(format!("Security scan failed: {}", e)))?;

        if !result.incidents.is_empty() {
            info!(
                "Security scan detected {} incidents",
                result.incidents.len()
            );

            // Upload incidents
            for incident in &result.incidents {
                if let Err(e) = self.upload_incident(incident).await {
                    warn!("Failed to upload incident: {}", e);
                }
            }
        } else {
            debug!("Security scan clean: no incidents detected");
        }

        Ok(result)
    }

    /// Upload a security incident to the server.
    async fn upload_incident(
        &self,
        incident: &agent_scanner::SecurityIncident,
    ) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "incident_type": format!("{}", incident.incident_type),
            "severity": format!("{}", incident.severity),
            "title": incident.title,
            "description": incident.description,
            "evidence": incident.evidence,
            "confidence": incident.confidence,
            "detected_at": incident.detected_at.to_rfc3339(),
        });

        let url = format!("/v1/agents/{}/incidents", agent_id);
        let response: serde_json::Value = client.post(&url, &payload).await?;

        let incident_id = response
            .get("incident_id")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        info!(
            "Reported incident '{}' (type: {}, ID: {})",
            incident.title, incident.incident_type, incident_id
        );

        Ok(())
    }

    /// Run the agent main loop.
    pub async fn run(&self) -> Result<(), CommonError> {
        info!("Starting Sentinel GRC Agent v{}", AGENT_VERSION);
        info!("Server URL: {}", self.config.server_url);
        info!(
            "Check interval: {} seconds",
            self.config.check_interval_secs
        );
        info!(
            "Vulnerability scan interval: {} seconds",
            self.vuln_scan_interval_secs
        );
        info!(
            "Security scan interval: {} seconds",
            self.security_scan_interval_secs
        );

        // Check startup time is within limits
        self.resource_monitor.check_startup_time();

        // Initialize API client
        self.init_api_client().await?;

        // Ensure we're enrolled
        match self.ensure_enrolled().await {
            Ok(()) => info!("Agent enrollment verified"),
            Err(e) => {
                warn!("Enrollment failed: {}. Running in offline mode.", e);
                // Continue running in offline mode
            }
        }

        // Log initial resource usage
        let usage = self.resource_monitor.get_usage();
        debug!(
            "Initial resource usage: CPU={:.2}%, MEM={}MB",
            usage.cpu_percent,
            usage.memory_bytes / (1024 * 1024)
        );

        // Track last operation times
        let mut last_heartbeat = std::time::Instant::now();
        let mut last_vuln_scan = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(self.vuln_scan_interval_secs))
            .unwrap_or_else(std::time::Instant::now);

        let heartbeat_interval = *self.heartbeat_interval_secs.read().await;

        // Run initial security scan on startup (quick check)
        info!("Running initial security scan...");
        if let Err(e) = self.run_security_scan().await {
            warn!("Initial security scan failed: {}", e);
        }
        let mut last_security_scan = std::time::Instant::now();

        // Main agent loop
        while !self.is_shutdown_requested() {
            let mut is_active = false;

            // Check resource limits periodically
            if !self.resource_monitor.check_limits(is_active) {
                debug!("Resource limits check triggered warning");
            }

            // Send heartbeat if interval has passed
            if last_heartbeat.elapsed().as_secs() >= heartbeat_interval {
                match self.send_heartbeat().await {
                    Ok(()) => {
                        debug!("Heartbeat sent successfully");
                    }
                    Err(e) => {
                        warn!("Failed to send heartbeat: {}", e);
                    }
                }
                last_heartbeat = std::time::Instant::now();
            }

            // Run vulnerability scan if interval has passed
            if last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs {
                is_active = true;
                match self.run_vulnerability_scan().await {
                    Ok(result) => {
                        if !result.vulnerabilities.is_empty() {
                            info!(
                                "Vulnerability scan found {} issues",
                                result.vulnerabilities.len()
                            );
                        }
                    }
                    Err(e) => {
                        warn!("Vulnerability scan failed: {}", e);
                    }
                }
                last_vuln_scan = std::time::Instant::now();
            }

            // Run security scan if interval has passed
            if last_security_scan.elapsed().as_secs() >= self.security_scan_interval_secs {
                is_active = true;
                match self.run_security_scan().await {
                    Ok(result) => {
                        if !result.incidents.is_empty() {
                            warn!(
                                "Security scan detected {} incident(s)!",
                                result.incidents.len()
                            );
                        }
                    }
                    Err(e) => {
                        warn!("Security scan failed: {}", e);
                    }
                }
                last_security_scan = std::time::Instant::now();
            }

            // Update resource limits check with active status
            if is_active && !self.resource_monitor.check_limits(is_active) {
                debug!("Resource limits exceeded during active scan");
            }

            // Sleep for a short interval before checking shutdown again
            tokio::select! {
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => {}
                _ = self.wait_for_shutdown() => {
                    info!("Shutdown signal received");
                    break;
                }
            }
        }

        info!("Agent shutdown complete");
        Ok(())
    }

    /// Wait for shutdown signal.
    async fn wait_for_shutdown(&self) {
        while !self.is_shutdown_requested() {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }
}

/// Get the OS version string.
fn get_os_version() -> String {
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
        "10".to_string() // TODO: Get actual Windows version
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        "unknown".to_string()
    }
}

/// Get a unique machine identifier.
fn get_machine_id() -> String {
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

/// Initialize logging based on configuration.
pub fn init_logging(log_level: &str) {
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level));

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_runtime_creation() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);
        assert!(!runtime.is_shutdown_requested());
    }

    #[test]
    fn test_shutdown_signal() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);

        assert!(!runtime.is_shutdown_requested());
        runtime.request_shutdown();
        assert!(runtime.is_shutdown_requested());
    }

    #[test]
    fn test_shutdown_signal_clone() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);
        let signal = runtime.shutdown_signal();

        assert!(!signal.load(Ordering::SeqCst));
        runtime.request_shutdown();
        assert!(signal.load(Ordering::SeqCst));
    }
}
