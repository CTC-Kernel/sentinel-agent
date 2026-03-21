// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Agent Core - Core functionality for the Sentinel GRC Agent.
//!
//! This crate provides the main agent runtime, including:
//! - Service management (Windows Service / Linux systemd)
//! - Agent lifecycle management
//! - Configuration loading and validation
//! - Clean uninstallation support
//! - Resource monitoring and limits
//! - System tray interface (macOS/Windows) -- behind `tray` feature
//! - API client for server communication
//!
//! # Feature Flags
//!
//! - `tray` (default) -- enable system tray icon (tray-icon + muda + tao)
//! - `gui` -- enable v2 desktop GUI support (agent-gui + agent-persistence)

pub mod api_client;
pub mod audit_trail;
pub mod cleanup;
pub mod events;
#[cfg(feature = "llm")]
pub mod llm_service;
pub mod logging;
pub mod resources;
pub mod self_protection;
pub mod service;
pub mod siem_enrichment;
pub mod state;
#[cfg(feature = "gui")]
pub mod sync_converters;
pub mod system_utils;
pub mod tracing_layer;
pub mod update_manager;

// Domain modules (impl AgentRuntime split)
mod asset_sync;
mod compliance;
pub mod edr_actions;
mod enrollment;
mod gui_bridge;
mod risk_generation;
mod heartbeat;
mod network_ops;
pub mod playbook_engine;
mod remediation_ops;
mod scanning;
mod self_update;
mod sync_init;
pub mod threat_pipeline;

#[cfg(feature = "tray")]
pub mod tray;

// Re-export logging functions for backward compatibility.
#[cfg(feature = "gui")]
pub use logging::init_logging_with_terminal;
pub use logging::{init_logging, set_tracing_level};

use agent_common::config::{AgentConfig, SecureConfig};
use agent_common::constants::{AGENT_VERSION, DEFAULT_HEARTBEAT_INTERVAL_SECS};
use agent_common::error::CommonError;
use agent_network::NetworkManager;
#[cfg(feature = "gui")]
use agent_network::{DiscoveryConfig, NetworkDiscovery};
#[cfg(feature = "gui")]
use agent_scanner::RemediationEngine;
use agent_scanner::{
    CheckRegistry, SecurityMonitor, UsbMonitor, VulnerabilityScanner,
    checks::{
        AdminAccountsCheck, AntivirusCheck, AuditLoggingCheck, AutoLoginCheck, BackupCheck,
        BluetoothCheck, BrowserSecurityCheck, CertificateValidationCheck, ContainerSecurityCheck,
        DiskEncryptionCheck, DnsSecurityCheck, FirewallCheck, GpoAuditPolicyCheck,
        GpoLockoutPolicyCheck, GpoPasswordPolicyCheck, GuestAccountCheck, Ipv6ConfigCheck,
        KernelHardeningCheck, LdapSecurityCheck, LinuxHardeningCheck, LogRotationCheck, MfaCheck,
        ObsoleteProtocolsCheck, PasswordPolicyCheck, PrivilegedGroupsCheck, RemoteAccessCheck,
        SecureBootCheck, SessionLockCheck, SshHardeningCheck, SystemUpdatesCheck, TimeSyncCheck,
        UpdateStatusCheck, UsbStorageCheck, WindowsHardeningCheck,
    },
};
use agent_storage::Database;
use agent_sync::{
    AuditSyncService, AuthenticatedClient, CommandResultsService, ConfigSyncService,
    ResultUploader, RuleSyncService, SyncOrchestrator,
};
use api_client::ApiClient;
use resources::ResourceMonitor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{RwLock, mpsc};
use tracing::{debug, error, info, warn};

// Import orphaned modules
use agent_fim::FimEngine;
use agent_siem::SiemForwarder;

#[cfg(feature = "gui")]
use agent_gui::dto::{
    FimChangeType as GuiFimChangeType, GuiDiscoveredDevice, GuiFimAlert, GuiPolicySummary,
    GuiSuspiciousProcess, GuiUsbEvent, GuiVulnerabilitySummary, UsbEventType as GuiUsbEventType,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

#[cfg(not(feature = "gui"))]
pub struct AgentSummary {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiAgentStatus {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiCheckResult {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiCheckStatus {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiDiscoveredDevice {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiNetworkConnection {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiNetworkInterface {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiNotification {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiResourceUsage {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiSoftwarePackage {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiVulnerabilityFinding {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiVulnerabilitySummary {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
pub struct GuiSeverity {
    pub dummy: bool,
}

#[cfg(not(feature = "gui"))]
#[derive(Debug, Clone)]
pub struct AgentEvent {
    pub dummy: bool,
}

/// Default vulnerability scan interval (6 hours).
const DEFAULT_VULN_SCAN_INTERVAL_SECS: u64 = 6 * 60 * 60;


/// Default security scan interval (5 minutes).
const DEFAULT_SECURITY_SCAN_INTERVAL_SECS: u64 = 5 * 60;

/// Shutdown signal for graceful termination.
pub type ShutdownSignal = Arc<AtomicBool>;

/// Data for a proposed asset from network discovery.
#[derive(Debug, Clone)]
pub struct ProposeAssetData {
    pub ip: String,
    pub hostname: Option<String>,
    pub device_type: String,
}

/// Agent runtime managing the main execution loop.
pub struct AgentRuntime {
    config: SecureConfig,
    resource_monitor: ResourceMonitor,
    api_client: RwLock<Option<ApiClient>>,
    /// Heartbeat interval in seconds (dynamic).
    heartbeat_interval_secs: RwLock<u64>,
    /// Vulnerability scanner for package vulnerability detection.
    vulnerability_scanner: VulnerabilityScanner,
    /// Security monitor for incident detection.
    security_monitor: SecurityMonitor,
    /// USB device monitor for tracking connections/disconnections.
    usb_monitor: std::sync::Mutex<UsbMonitor>,
    /// Network manager for network collection and detection.
    network_manager: RwLock<NetworkManager>,
    /// Vulnerability scan interval in seconds.
    vuln_scan_interval_secs: u64,
    /// Security scan interval in seconds.
    security_scan_interval_secs: u64,
    /// Optional GUI event sender for pushing live data to the desktop UI.
    #[cfg(feature = "gui")]
    gui_event_tx: Option<std::sync::mpsc::Sender<AgentEvent>>,
    /// Queue of discovered devices proposed as assets by the user.
    pending_asset_proposals: Arc<Mutex<Vec<ProposeAssetData>>>,
    /// Encrypted database for check result storage and sync services.
    db: Option<Arc<Database>>,
    /// Authenticated mTLS client for sync services.
    authenticated_client: Option<Arc<AuthenticatedClient>>,
    /// Compliance check registry with all 34 checks.
    check_registry: Arc<CheckRegistry>,
    /// Active compliance frameworks (dynamic).
    active_frameworks: std::sync::RwLock<Option<Vec<String>>>,
    /// Config sync service for downloading server configuration.
    config_sync: RwLock<Option<ConfigSyncService>>,
    /// Rule sync service for downloading check rules.
    rule_sync: RwLock<Option<RuleSyncService>>,
    /// Result uploader for uploading check results to SaaS.
    result_uploader: RwLock<Option<ResultUploader>>,
    /// Audit trail sync service.
    audit_sync: RwLock<Option<AuditSyncService>>,
    /// Command results reporting service.
    command_results: RwLock<Option<CommandResultsService>>,
    /// GRC entity sync orchestrator (processes queued playbooks, risks, assets, etc.).
    sync_orchestrator: RwLock<Option<SyncOrchestrator>>,
    /// Timestamp of the last self-update check.
    last_update_check: RwLock<Option<std::time::Instant>>,
    /// Last successful sync timestamp.
    last_sync_at: RwLock<Option<chrono::DateTime<chrono::Utc>>>,
    /// Organization name retrieved from server.
    organization_name: RwLock<Option<String>>,
    /// Local audit trail for persistent logging.
    audit_trail: Option<Arc<audit_trail::LocalAuditTrail>>,
    /// Event and notification manager.
    events: Arc<events::EventManager>,
    /// Metadata and rules sync flags.
    state: Arc<state::RuntimeState>,
    /// Automated remediation engine for compliance checks.
    #[cfg(feature = "gui")]
    remediation_engine: Arc<RemediationEngine>,
    /// Receiver for remediation requests.
    remediation_rx: tokio::sync::Mutex<tokio::sync::mpsc::Receiver<state::RemediationRequest>>,
    /// FIM engine for file integrity monitoring.
    fim_engine: RwLock<Option<FimEngine>>,
    /// SIEM forwarder for security events.
    siem_forwarder: RwLock<Option<SiemForwarder>>,
    /// Log collector for OS event log ingestion (Windows Event Log, syslog, etc.).
    log_collector: RwLock<Option<agent_siem::LogCollector>>,
    /// Correlation engine for detecting patterns across collected events.
    correlation_engine: RwLock<Option<agent_siem::CorrelationEngine>>,
    /// FIM alert receiver.
    fim_rx: tokio::sync::Mutex<Option<mpsc::Receiver<agent_common::types::FimAlert>>>,
    /// LLM service for AI-powered analysis (feature-gated).
    #[cfg(feature = "llm")]
    llm_service: Option<Arc<llm_service::LLMService>>,
    /// Consecutive authentication failure count for re-enrollment tracking.
    auth_failure_count: std::sync::atomic::AtomicU32,
    /// Timestamp of the last re-enrollment attempt (epoch seconds).
    last_re_enrollment_attempt: std::sync::atomic::AtomicU64,
}

/// A lightweight handle to the running agent that can be shared with the GUI
/// or other external controllers.
#[derive(Clone)]
pub struct RuntimeHandle {
    /// Shared runtime state.
    pub state: Arc<state::RuntimeState>,
    /// Queue of discovered devices proposed as assets by the user.
    pub pending_asset_proposals: Arc<Mutex<Vec<ProposeAssetData>>>,
}

impl RuntimeHandle {
    /// Request agent shutdown.
    pub fn request_shutdown(&self) {
        info!("Shutdown requested via handle");
        self.state.shutdown.store(true, Ordering::SeqCst);
    }

    /// Check if shutdown has been requested.
    pub fn is_shutdown_requested(&self) -> bool {
        self.state.shutdown.load(Ordering::SeqCst)
    }

    /// Pause agent operations.
    pub fn pause(&self) {
        info!("Agent paused via handle");
        self.state.paused.store(true, Ordering::Release);
    }

    /// Resume agent operations.
    pub fn resume(&self) {
        info!("Agent resumed via handle");
        self.state.paused.store(false, Ordering::Release);
    }

    /// Check if the agent is paused.
    pub fn is_paused(&self) -> bool {
        self.state.paused.load(Ordering::Acquire)
    }

    /// Check if the agent is currently scanning.
    pub fn is_scanning(&self) -> bool {
        self.state.scanning.load(Ordering::Acquire)
    }

    /// Trigger an immediate vulnerability check.
    pub fn trigger_check(&self) {
        info!("Immediate check requested via handle");
        self.state.force_check.store(true, Ordering::Release);
    }

    /// Trigger an immediate sync (heartbeat + upload).
    pub fn trigger_sync(&self) {
        info!("Immediate sync requested via handle");
        self.state.force_sync.store(true, Ordering::Release);
    }

    /// Trigger a network discovery scan.
    pub fn trigger_discovery(&self) {
        info!("Network discovery requested via handle");
        self.state.discovery_cancel.store(false, Ordering::Release);
        self.state.force_discovery.store(true, Ordering::Release);
    }

    /// Trigger an immediate self-update.
    pub fn trigger_update(&self) {
        info!("Self-update requested via handle");
        self.state.force_update.store(true, Ordering::Release);
    }

    /// Cancel a running network discovery scan.
    pub fn cancel_discovery(&self) {
        info!("Network discovery cancellation requested via handle");
        self.state.discovery_cancel.store(true, Ordering::Release);
    }

    /// Propose a discovered device as an asset.
    pub fn propose_asset(&self, ip: String, hostname: Option<String>, device_type: String) {
        if let Ok(mut proposals) = self.pending_asset_proposals.lock() {
            proposals.push(ProposeAssetData {
                ip,
                hostname,
                device_type,
            });
        }
    }

    /// Set the dynamic compliance check interval.
    pub fn set_check_interval(&self, secs: u64) {
        info!("Check interval updated to {} seconds via handle", secs);
        self.state.set_check_interval(secs);
    }

    /// Set the dynamic log level (0=trace, 1=debug, 2=info, 3=warn, 4=error).
    pub fn set_log_level(&self, level: u8) {
        self.state.set_log_level(level);
        let level_str = match level {
            0 => "trace",
            1 => "debug",
            2 => "info",
            3 => "warn",
            _ => "error",
        };
        info!("Log level updated to {} via handle", level_str);
        set_tracing_level(level_str);
    }

    /// Update SIEM forwarder configuration at runtime.
    pub fn update_siem_config(
        &self,
        enabled: bool,
        format: String,
        transport: String,
        destination: String,
    ) {
        info!(
            "SIEM config updated via handle: enabled={}, format={}, transport={}, dest={}",
            enabled, format, transport, destination
        );
        self.state.siem_enabled.store(enabled, std::sync::atomic::Ordering::Release);
        if let Ok(mut fmt) = self.state.siem_format.lock() {
            *fmt = format;
        }
        if let Ok(mut tr) = self.state.siem_transport.lock() {
            *tr = transport;
        }
        if let Ok(mut dest) = self.state.siem_destination.lock() {
            *dest = destination;
        }
    }

    /// Update SIEM log collector configuration at runtime.
    pub fn update_log_collector_config(
        &self,
        enabled: bool,
        sources: &[String],
        poll_interval_secs: u64,
    ) {
        info!(
            "Log collector config updated via handle: enabled={}, sources={:?}, poll={}s",
            enabled, sources, poll_interval_secs
        );
        self.state
            .log_collector_enabled
            .store(enabled, std::sync::atomic::Ordering::Release);
        if let Ok(mut src) = self.state.log_collector_sources.lock() {
            *src = sources.to_vec();
        }
        self.state
            .log_collector_poll_secs
            .store(poll_interval_secs, std::sync::atomic::Ordering::Release);
    }

    /// Trigger remediation for a check.
    pub fn remediate(&self, check_id: String) {
        if let Err(e) = self
            .state
            .remediation_tx
            .try_send(state::RemediationRequest::Execute { check_id })
        {
            warn!("Failed to send remediation request: {}", e);
        }
    }

    /// Trigger remediation preview for a check.
    pub fn remediate_preview(&self, check_id: String) {
        if let Err(e) = self
            .state
            .remediation_tx
            .try_send(state::RemediationRequest::Preview { check_id })
        {
            warn!("Failed to send remediation preview request: {}", e);
        }
    }

    /// Get a clone of the shutdown signal.
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.state.shutdown.clone()
    }
}

impl AgentRuntime {
    /// Number of consecutive auth failures before attempting re-enrollment.
    /// Set to 1 so re-enrollment triggers on the first heartbeat auth failure
    /// (the startup probe already attempts immediate re-enrollment).
    const AUTH_FAILURE_THRESHOLD: u32 = 1;
    /// Maximum re-enrollment attempts before giving up.
    const MAX_RE_ENROLLMENT_ATTEMPTS: u32 = 6;

    /// Create a new agent runtime with the given configuration.
    pub fn new(config: AgentConfig) -> Self {
        let config = SecureConfig::from(config);
        let resource_monitor = ResourceMonitor::new();
        let vulnerability_scanner = VulnerabilityScanner::new();
        let security_monitor = SecurityMonitor::new();
        let usb_monitor = UsbMonitor::new();
        let network_manager = NetworkManager::new();

        let (state, rx) = state::RuntimeState::new();
        state.set_check_interval(config.check_interval_secs);
        let state = Arc::new(state);
        let (events_mgr, _rx) = events::EventManager::new(None);
        let events = Arc::new(events_mgr);

        // Register all compliance checks (21 base + 5 directory + 4 hardening + 4 advanced = 34 total)
        let mut registry = CheckRegistry::new();
        registry.register(Arc::new(DiskEncryptionCheck::new()));
        registry.register(Arc::new(FirewallCheck::new()));
        registry.register(Arc::new(AntivirusCheck::new()));
        registry.register(Arc::new(MfaCheck::new()));
        registry.register(Arc::new(PasswordPolicyCheck::new()));
        registry.register(Arc::new(SystemUpdatesCheck::new()));
        registry.register(Arc::new(SessionLockCheck::new()));
        registry.register(Arc::new(RemoteAccessCheck::new()));
        registry.register(Arc::new(BackupCheck::new()));
        registry.register(Arc::new(AdminAccountsCheck::new()));
        registry.register(Arc::new(ObsoleteProtocolsCheck::new()));
        registry.register(Arc::new(AuditLoggingCheck::new()));
        registry.register(Arc::new(AutoLoginCheck::new()));
        registry.register(Arc::new(BluetoothCheck::new()));
        registry.register(Arc::new(BrowserSecurityCheck::new()));
        registry.register(Arc::new(GuestAccountCheck::new()));
        registry.register(Arc::new(Ipv6ConfigCheck::new()));
        registry.register(Arc::new(KernelHardeningCheck::new()));
        registry.register(Arc::new(LogRotationCheck::new()));
        registry.register(Arc::new(TimeSyncCheck::new()));
        registry.register(Arc::new(UsbStorageCheck::new()));

        // Directory policy checks (GPO, LDAP, privileged access)
        registry.register(Arc::new(GpoPasswordPolicyCheck::new()));
        registry.register(Arc::new(GpoLockoutPolicyCheck::new()));
        registry.register(Arc::new(GpoAuditPolicyCheck::new()));
        registry.register(Arc::new(PrivilegedGroupsCheck::new()));
        registry.register(Arc::new(LdapSecurityCheck::new()));

        // System hardening checks (Windows/Linux kernel, updates)
        registry.register(Arc::new(WindowsHardeningCheck::new()));
        registry.register(Arc::new(SecureBootCheck::new()));
        registry.register(Arc::new(LinuxHardeningCheck::new()));
        registry.register(Arc::new(UpdateStatusCheck::new()));

        // Advanced security checks (DNS, SSH, containers, certificates)
        registry.register(Arc::new(DnsSecurityCheck::new()));
        registry.register(Arc::new(SshHardeningCheck::new()));
        registry.register(Arc::new(ContainerSecurityCheck::new()));
        registry.register(Arc::new(CertificateValidationCheck::new()));

        let check_registry = Arc::new(registry);

        info!("Registered {} compliance checks", check_registry.count());
        info!(
            "Initialized vulnerability scanner ({} scanners available)",
            vulnerability_scanner.scanner_count()
        );
        info!("Initialized network manager with smart scheduling");

        let active_frameworks = config.active_frameworks.clone();

        Self {
            config,
            active_frameworks: std::sync::RwLock::new(active_frameworks),
            resource_monitor,
            api_client: RwLock::new(None),
            heartbeat_interval_secs: RwLock::new(DEFAULT_HEARTBEAT_INTERVAL_SECS),
            vulnerability_scanner,
            security_monitor,
            usb_monitor: std::sync::Mutex::new(usb_monitor),
            network_manager: RwLock::new(network_manager),
            vuln_scan_interval_secs: DEFAULT_VULN_SCAN_INTERVAL_SECS,
            security_scan_interval_secs: DEFAULT_SECURITY_SCAN_INTERVAL_SECS,
            #[cfg(feature = "gui")]
            gui_event_tx: None,
            pending_asset_proposals: Arc::new(Mutex::new(Vec::new())),
            db: None,
            authenticated_client: None,
            check_registry,
            config_sync: RwLock::new(None),
            rule_sync: RwLock::new(None),
            result_uploader: RwLock::new(None),
            audit_sync: RwLock::new(None),
            command_results: RwLock::new(None),
            sync_orchestrator: RwLock::new(None),
            last_update_check: RwLock::new(None),
            last_sync_at: RwLock::new(None),
            audit_trail: None,
            events,
            state,
            #[cfg(feature = "gui")]
            remediation_engine: Arc::new(RemediationEngine::new()),
            remediation_rx: tokio::sync::Mutex::new(rx),
            fim_engine: RwLock::new(None),
            siem_forwarder: RwLock::new(None),
            log_collector: RwLock::new(None),
            correlation_engine: RwLock::new(None),
            fim_rx: tokio::sync::Mutex::new(None),
            organization_name: RwLock::new(None),
            #[cfg(feature = "llm")]
            llm_service: None,
            auth_failure_count: std::sync::atomic::AtomicU32::new(0),
            last_re_enrollment_attempt: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Set the database and create an authenticated client for sync services.
    pub fn with_database(mut self, db: Arc<Database>) -> Self {
        let auth_client = Arc::new(AuthenticatedClient::new(self.config.0.clone(), db.clone()));
        self.db = Some(db.clone());
        self.authenticated_client = Some(auth_client);

        let trail = Arc::new(audit_trail::LocalAuditTrail::new(db));
        self.audit_trail = Some(trail.clone());

        let (events_mgr, _gui_event_rx) = events::EventManager::new(Some(trail.clone()));
        let events = Arc::new(events_mgr);
        self.events = events;

        self
    }

    /// Set the LLM service for AI-powered analysis.
    #[cfg(feature = "llm")]
    pub fn with_llm_service(mut self, service: Arc<llm_service::LLMService>) -> Self {
        self.llm_service = Some(service);
        self
    }

    /// Get a reference to the LLM service (if available).
    #[cfg(feature = "llm")]
    pub fn llm_service(&self) -> Option<&Arc<llm_service::LLMService>> {
        self.llm_service.as_ref()
    }

    /// Set the GUI event sender for pushing live data to the desktop UI.
    #[cfg(feature = "gui")]
    pub fn set_gui_event_tx(&mut self, tx: std::sync::mpsc::Sender<AgentEvent>) {
        self.gui_event_tx = Some(tx);
    }

    /// Get a lightweight handle to the runtime for sharing with the GUI or
    /// other controllers.
    pub fn handle(&self) -> RuntimeHandle {
        RuntimeHandle {
            state: self.state.clone(),
            pending_asset_proposals: self.pending_asset_proposals.clone(),
        }
    }

    /// Get the authenticated sync client (if enrolled and database is set).
    pub fn sync_client(&self) -> Option<Arc<AuthenticatedClient>> {
        self.authenticated_client.clone()
    }

    /// Get a clone of the shutdown signal.
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.state.shutdown.clone()
    }

    /// Signal the agent to shut down.
    pub fn request_shutdown(&self) {
        info!("Shutdown requested");
        self.state.shutdown.store(true, Ordering::SeqCst);
    }

    /// Check if shutdown has been requested.
    pub fn is_shutdown_requested(&self) -> bool {
        self.state.shutdown.load(Ordering::SeqCst)
    }

    /// Check if the agent is paused.
    pub fn is_paused(&self) -> bool {
        self.state.paused.load(Ordering::Acquire)
    }

    /// Get current resource usage for heartbeat.
    pub fn get_resource_usage(&self) -> resources::ResourceUsage {
        self.resource_monitor.get_usage()
    }

    /// Wait for shutdown signal.
    async fn wait_for_shutdown(&self) {
        while !self.is_shutdown_requested() {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    }

    /// Run the agent main loop.
    pub async fn run(&self) -> Result<(), CommonError> {
        info!("Starting Sentinel GRC Agent v{}", AGENT_VERSION);
        info!("Server URL: https://cyber-threat-consulting.com [redacted]");
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
            Ok(()) => {
                info!("Agent enrollment verified");

                // Verify enrollment is still valid with a probe heartbeat before
                // initializing heavy sync services. If the server returns 401
                // ("Agent not found"), re-enroll immediately instead of waiting
                // for 3 heartbeat failures in the main loop.
                let enrollment_valid = match self.send_heartbeat(None, None).await {
                    Ok(()) => {
                        info!("Enrollment health check passed");
                        true
                    }
                    Err(e) if e.is_auth_error() => {
                        warn!(
                            "Enrollment health check failed ({}), attempting immediate re-enrollment",
                            e
                        );
                        match self.attempt_re_enrollment().await {
                            Ok(true) => {
                                info!("Immediate re-enrollment succeeded");
                                self.auth_failure_count.store(0, Ordering::Release);
                                true
                            }
                            Ok(false) => {
                                warn!("Cannot re-enroll: no enrollment token configured");
                                false
                            }
                            Err(re_err) => {
                                error!("Immediate re-enrollment failed: {}", re_err);
                                false
                            }
                        }
                    }
                    Err(e) => {
                        // Non-auth error (network, timeout, etc.) — proceed anyway,
                        // sync services will retry later.
                        warn!("Enrollment health check failed (non-auth: {}), proceeding", e);
                        true
                    }
                };

                if enrollment_valid {
                    self.init_sync_services().await;
                } else {
                    warn!("Skipping sync service init — enrollment invalid");
                    warn!(
                        "To fix this, add a valid enrollment_token to agent.json and restart the agent. \
                         On Windows: C:\\ProgramData\\Sentinel\\agent.json"
                    );
                }
            }
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

        // Compliance tracking variables
        let mut compliance_score: Option<f64> = None;
        let mut last_compliance_check_at: Option<chrono::DateTime<chrono::Utc>> = None;

        // Cached values for GUI status updates (updated after each heartbeat / compliance check)
        #[cfg(feature = "gui")]
        let mut cached_pending_sync: u32 = 0;
        #[cfg(feature = "gui")]
        let mut cached_policy_summary: Option<GuiPolicySummary> = None;

        // Emit initial GUI state
        #[cfg(feature = "gui")]
        {
            self.emit_status_update(None, None, 0, None);
            self.emit_resource_update(None);
        }

        // Load cached discovery results from database
        #[cfg(feature = "gui")]
        if let Some(ref db) = self.db {
            let repo = agent_storage::repositories::DiscoveredDevicesRepository::new(db);
            match repo.get_all().await {
                Ok(stored) if !stored.is_empty() => {
                    let devices: Vec<GuiDiscoveredDevice> = stored
                        .into_iter()
                        .map(|d| GuiDiscoveredDevice {
                            ip: d.ip,
                            mac: d.mac,
                            hostname: d.hostname,
                            vendor: d.vendor,
                            device_type: d.device_type,
                            open_ports: d.open_ports,
                            first_seen: d.first_seen,
                            last_seen: d.last_seen,
                            is_gateway: d.is_gateway,
                            subnet: d.subnet,
                        })
                        .collect();
                    info!(
                        "Loaded {} cached discovered devices from database",
                        devices.len()
                    );
                    self.emit_gui_event(AgentEvent::DiscoveryUpdate { devices });
                }
                Ok(_) => {
                    debug!("No cached discovery results in database");
                }
                Err(e) => {
                    warn!("Failed to load cached discovery results: {}", e);
                }
            }
        }

        // Track last operation times
        let mut last_heartbeat = std::time::Instant::now();
        let mut last_vuln_scan = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(self.vuln_scan_interval_secs))
            .unwrap_or_else(std::time::Instant::now);
        // Compliance check timer: trigger immediately on first loop
        let mut last_compliance_check_time = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(
                self.state.get_check_interval(),
            ))
            .unwrap_or_else(std::time::Instant::now);
        // Certificate renewal timer (daily)
        let mut last_cert_check = std::time::Instant::now();
        let cert_check_interval_secs: u64 = 24 * 3600;
        #[cfg(feature = "gui")]
        let mut last_check_at: Option<chrono::DateTime<chrono::Utc>> = None;
        #[cfg(feature = "gui")]
        let mut last_gui_resource_update = std::time::Instant::now();
        #[cfg(feature = "gui")]
        let mut fim_changes_today: u32 = 0;
        #[cfg(feature = "gui")]
        let mut fim_last_day: u64 =
            chrono::Utc::now().timestamp().max(0) as u64 / agent_common::constants::SECS_PER_DAY;

        // Run initial security scan on startup (quick check)
        info!("Running initial security scan...");
        if let Err(e) = self.run_security_scan().await {
            warn!("Initial security scan failed: {}", e);
        }
        let mut last_security_scan = std::time::Instant::now();

        // Initialize network collection with staggered start
        let (network_static_interval, network_connection_interval, network_security_interval) = {
            let mut network_manager = self.network_manager.write().await;
            let static_interval = network_manager.next_static_interval();
            let conn_interval = network_manager.next_connection_interval();
            let sec_interval = network_manager.next_security_interval();
            info!(
                "Network collection intervals: static={:.0}s, connections={:.0}s, security={:.0}s",
                static_interval.as_secs_f64(),
                conn_interval.as_secs_f64(),
                sec_interval.as_secs_f64()
            );
            (static_interval, conn_interval, sec_interval)
        };

        // Initialize network timing with staggered delays
        let mut last_network_static = std::time::Instant::now();
        let mut last_network_connections = std::time::Instant::now();
        let mut last_network_security = std::time::Instant::now();
        let mut current_network_static_interval = network_static_interval;
        let mut current_network_connection_interval = network_connection_interval;
        let mut current_network_security_interval = network_security_interval;
        #[cfg(feature = "gui")]
        let mut last_network_alert_count: u32 = 0;

        // Log collector timer — polls OS event logs at the configured interval
        let mut last_log_collection = std::time::Instant::now();

        // Run initial network collection (with 30s timeout to avoid blocking the main loop)
        info!("Running initial network collection...");
        match tokio::time::timeout(
            std::time::Duration::from_secs(30),
            self.run_network_collection(),
        )
        .await
        {
            Ok(inner) => match inner {
                Ok(snapshot) => {
                    #[cfg(feature = "gui")]
                    {
                        let (interfaces, connections) = Self::snapshot_to_gui_network(&snapshot);
                        self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                            interfaces,
                            connections,
                        });
                    }
                    if let Err(e) = self.upload_network_snapshot(&snapshot).await {
                        warn!("Failed to upload initial network snapshot: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: None,
                            error: Some(format!("Network upload failed: {}", e)),
                        });
                    }
                    // Run initial network security detection
                    match self.run_network_security_detection(&snapshot).await {
                        Ok(alerts) => {
                            for alert in &alerts {
                                #[cfg(feature = "gui")]
                                self.emit_network_security_alert_to_gui(alert);
                                if let Err(e) = self.upload_network_alert(alert).await {
                                    warn!("Failed to upload network alert: {}", e);
                                }
                            }
                        }
                        Err(e) => warn!("Initial network security detection failed: {}", e),
                    }
                }
                Err(e) => warn!("Initial network collection failed: {}", e),
            },
            Err(_) => {
                warn!("Initial network collection timed out after 30s, continuing without it")
            }
        }

        // Initialize FIM engine
        {
            let (fim_tx, fim_rx) = mpsc::channel(100);
            let mut fim_rx_guard = self.fim_rx.lock().await;
            *fim_rx_guard = Some(fim_rx);

            let engine = FimEngine::with_defaults(fim_tx);

            if let Err(e) = engine.start().await {
                error!("Failed to start FIM engine: {}", e);
            } else {
                info!("FIM engine started successfully");
            }

            let mut fim_guard = self.fim_engine.write().await;
            *fim_guard = Some(engine);
        }

        // Initialize SIEM forwarder with default config (disabled)
        {
            let config = agent_siem::SiemConfig::default();

            // Extract GUI-relevant fields before config is moved
            #[cfg(feature = "gui")]
            let siem_gui_info = {
                let format_str = match config.format {
                    agent_siem::SiemFormat::Cef => "CEF",
                    agent_siem::SiemFormat::Leef => "LEEF",
                    agent_siem::SiemFormat::Json => "JSON",
                };
                let (transport_str, destination_str) = match &config.transport {
                    agent_siem::SiemTransport::Syslog { host, port, .. } => {
                        ("Syslog".to_string(), format!("{}:{}", host, port))
                    }
                    agent_siem::SiemTransport::Http { url, .. } => {
                        ("HTTP".to_string(), url.clone())
                    }
                };
                (
                    config.enabled,
                    format_str.to_string(),
                    transport_str,
                    destination_str,
                )
            };

            match SiemForwarder::new(config) {
                Ok(forwarder) => {
                    #[cfg(feature = "gui")]
                    {
                        let (enabled, format, transport, destination) = siem_gui_info;
                        self.emit_gui_event(agent_gui::events::AgentEvent::SiemConfigUpdate {
                            enabled,
                            format,
                            transport,
                            destination,
                        });
                    }
                    let mut siem_guard = self.siem_forwarder.write().await;
                    *siem_guard = Some(forwarder);
                    info!("SIEM forwarder initialized (disabled by default)");
                }
                Err(e) => error!("Failed to initialize SIEM forwarder: {}", e),
            }
        }

        // Initialize log collector for OS event log ingestion
        {
            let collector_config = agent_siem::LogCollectorConfig {
                enabled: self
                    .state
                    .log_collector_enabled
                    .load(std::sync::atomic::Ordering::Acquire),
                sources: vec![
                    agent_siem::LogSource::System,
                    agent_siem::LogSource::Auth,
                    agent_siem::LogSource::Application,
                    agent_siem::LogSource::Firewall,
                ],
                lookback_secs: 300,
                poll_interval_secs: self
                    .state
                    .log_collector_poll_secs
                    .load(std::sync::atomic::Ordering::Acquire),
                ..Default::default()
            };
            let collector = agent_siem::LogCollector::new(collector_config);
            let mut guard = self.log_collector.write().await;
            *guard = Some(collector);
            info!("Log collector initialized");
        }

        // Initialize correlation engine with default rules
        {
            let engine = agent_siem::CorrelationEngine::with_default_rules();
            let mut guard = self.correlation_engine.write().await;
            *guard = Some(engine);
            info!("Correlation engine initialized");
        }

        info!("Agent main loop started");
        loop {
            // Check for shutdown signal
            if self.state.shutdown.load(Ordering::Acquire) {
                info!("Shutdown requested, stopping main loop");
                break;
            }

            let mut is_active = false;
            let is_paused = self.is_paused();

            // Threat pipeline accumulators (populated during this iteration)
            #[cfg(feature = "gui")]
            let mut pipeline_incidents: Vec<agent_scanner::SecurityIncident> = Vec::new();
            #[cfg(feature = "gui")]
            let mut pipeline_network_alerts: Vec<agent_network::NetworkSecurityAlert> = Vec::new();
            #[cfg(feature = "gui")]
            let mut pipeline_fim_alerts: Vec<(String, String)> = Vec::new();

            // 1. Process FIM alerts (always — security-critical even when paused)
            {
                let mut rx_guard = self.fim_rx.lock().await;
                if let Some(rx) = rx_guard.as_mut() {
                    while let Ok(alert) = rx.try_recv() {
                        info!("FIM Alert: {:?} on {}", alert.change, alert.path.display());

                        let report = api_client::SecurityIncidentReport {
                            incident_type: api_client::IncidentType::UnauthorizedChange,
                            severity: api_client::Severity::Medium,
                            title: format!("File Integrity Alert: {}", alert.path.display()),
                            description: format!(
                                "File {} was modified. Change type: {:?}.",
                                alert.path.display(),
                                alert.change
                            ),
                            evidence: serde_json::json!({
                                "path": alert.path,
                                "change_type": alert.change,
                                "old_hash": alert.old_hash,
                                "new_hash": alert.new_hash,
                                "timestamp": alert.timestamp,
                            }),
                            confidence: 100,
                            detected_at: chrono::Utc::now().to_rfc3339(),
                        };

                        #[cfg(feature = "gui")]
                        {
                            let gui_change_type = match alert.change {
                                agent_common::types::FimChangeType::Created => {
                                    GuiFimChangeType::Created
                                }
                                agent_common::types::FimChangeType::Modified => {
                                    GuiFimChangeType::Modified
                                }
                                agent_common::types::FimChangeType::Deleted => {
                                    GuiFimChangeType::Deleted
                                }
                                agent_common::types::FimChangeType::PermissionChanged => {
                                    GuiFimChangeType::PermissionChanged
                                }
                                agent_common::types::FimChangeType::Renamed => {
                                    GuiFimChangeType::Renamed
                                }
                            };
                            self.emit_gui_event(AgentEvent::FimAlert {
                                alert: GuiFimAlert {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    path: alert.path.to_string_lossy().to_string(),
                                    change_type: gui_change_type,
                                    old_hash: alert.old_hash.clone(),
                                    new_hash: alert.new_hash.clone(),
                                    timestamp: alert.timestamp,
                                    acknowledged: false,
                                },
                            });
                            let today = chrono::Utc::now().timestamp().max(0) as u64
                                / agent_common::constants::SECS_PER_DAY;
                            if today != fim_last_day {
                                fim_changes_today = 0;
                                fim_last_day = today;
                            }
                            fim_changes_today = fim_changes_today.saturating_add(1);

                            // Accumulate for threat pipeline
                            pipeline_fim_alerts.push((
                                alert.path.to_string_lossy().to_string(),
                                format!("{}", alert.change),
                            ));
                        }

                        // Send to SaaS as incident
                        if let Some(client) = self.api_client.read().await.as_ref()
                            && let Err(e) = client.report_incident(report.clone()).await
                        {
                            error!("Failed to report FIM incident to SaaS: {}", e);
                        }

                        // Also upload as structured FIM alert (populates FIM tab)
                        if let Some(ref auth_client) = self.authenticated_client {
                            let payload = agent_sync::types::FimAlertPayload::from(alert.clone());
                            if let Err(e) = auth_client.upload_fim_alerts(vec![payload]).await {
                                warn!("Failed to upload FIM alert to SaaS: {}", e);
                            }
                        }

                        // Forward to SIEM (always record for platform, optionally send to external)
                        let siem_guard = self.siem_forwarder.read().await;
                        if let Some(siem) = siem_guard.as_ref() {
                            let mut event = agent_siem::SiemEvent {
                                timestamp: chrono::Utc::now(),
                                severity: 5,
                                category: agent_siem::EventCategory::FileIntegrity,
                                name: "File Integrity Change".to_string(),
                                description: report.description,
                                source_host: hostname::get()
                                    .map(|h| h.to_string_lossy().to_string())
                                    .unwrap_or_default(),
                                source_ip: None,
                                destination_ip: None,
                                destination_port: None,
                                user: None,
                                process_name: None,
                                process_id: None,
                                file_path: Some(alert.path.to_string_lossy().to_string()),
                                custom_fields: serde_json::Value::Null,
                                event_id: uuid::Uuid::new_v4().to_string(),
                                agent_version: AGENT_VERSION.to_string(),
                            };

                            // Enrich with AI classification before forwarding
                            #[cfg(feature = "llm")]
                            {
                                if let Some(ref llm_svc) = self.llm_service {
                                    siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
                                }
                            }
                            #[cfg(not(feature = "llm"))]
                            {
                                siem_enrichment::enrich_siem_event(&mut event).await;
                            }

                            // Always record for platform SIEM tab
                            siem.record_event(event.clone()).await;

                            // Optionally forward to external SIEM
                            if siem.is_enabled() {
                                if let Err(e) = siem.send_event(&event).await {
                                    warn!("Failed to forward FIM event to external SIEM: {}", e);
                                }
                            }
                        }
                    }
                }
            }

            // 1b. Emit FIM stats to GUI periodically
            #[cfg(feature = "gui")]
            {
                let fim_engine = self.fim_engine.read().await;
                if let Some(engine) = fim_engine.as_ref() {
                    let today = chrono::Utc::now().timestamp().max(0) as u64
                        / agent_common::constants::SECS_PER_DAY;
                    if today != fim_last_day {
                        fim_changes_today = 0;
                        fim_last_day = today;
                    }
                    self.emit_gui_event(AgentEvent::FimStats {
                        monitored_count: u32::try_from(engine.baseline_count()).unwrap_or(u32::MAX),
                        changes_today: fim_changes_today,
                    });
                }
            }

            // 1b. Sync GUI SIEM config changes to the actual forwarder
            #[cfg(feature = "gui")]
            {
                let gui_enabled = self.state.siem_enabled.load(Ordering::Acquire);
                let mut siem_guard = self.siem_forwarder.write().await;
                if let Some(ref mut siem) = *siem_guard {
                    if siem.is_enabled() != gui_enabled {
                        let mut new_config = siem.config().clone();
                        new_config.enabled = gui_enabled;
                        if let Ok(fmt) = self.state.siem_format.lock() {
                            new_config.format = match fmt.as_str() {
                                "CEF" => agent_siem::SiemFormat::Cef,
                                "LEEF" => agent_siem::SiemFormat::Leef,
                                _ => agent_siem::SiemFormat::Json,
                            };
                        }
                        if let Ok(dest) = self.state.siem_destination.lock() {
                            if !dest.is_empty() {
                                if let Ok(tr) = self.state.siem_transport.lock() {
                                    match tr.as_str() {
                                        "HTTP" => {
                                            new_config.transport = agent_siem::SiemTransport::Http {
                                                url: dest.clone(),
                                                auth_token: None,
                                                auth_header: None,
                                                verify_tls: true,
                                            };
                                        }
                                        _ => {
                                            let parts: Vec<&str> = dest.splitn(2, ':').collect();
                                            let host = parts.first().unwrap_or(&"localhost").to_string();
                                            let port = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(514);
                                            new_config.transport = agent_siem::SiemTransport::Syslog {
                                                host,
                                                port,
                                                protocol: agent_siem::SyslogProtocol::Tcp,
                                                tls: false,
                                            };
                                        }
                                    }
                                }
                            }
                        }
                        if let Err(e) = siem.update_config(new_config) {
                            warn!("Failed to apply GUI SIEM config: {}", e);
                        } else {
                            info!("SIEM forwarder config synced from GUI (enabled={})", gui_enabled);
                        }
                    }
                }
            }

            // 2. Heartbeat & Config Sync
            if last_heartbeat.elapsed().as_secs() >= *self.heartbeat_interval_secs.read().await {
                last_heartbeat = std::time::Instant::now();
                match self
                    .send_heartbeat(compliance_score, last_compliance_check_at)
                    .await
                {
                    Ok(_) => {
                        debug!("Heartbeat sent successfully");

                        // Reset auth failure counter on successful heartbeat
                        if self.auth_failure_count.load(Ordering::Acquire) > 0 {
                            info!("Connection restored, resetting authentication failure counter");
                            self.auth_failure_count.store(0, Ordering::Release);
                        }

                        #[cfg(feature = "gui")]
                        {
                            cached_pending_sync = self.get_pending_sync_count().await as u32;
                        }

                        if self.state.force_sync.load(Ordering::Acquire) {
                            info!("Forced sync requested via heartbeat command");
                            self.apply_config_changes().await;
                            // Do NOT clear force_sync here — the dedicated force_sync
                            // block later in the loop handles the full sync cycle
                            // (upload results, heartbeat, notifications) and clears it.
                        }
                        #[cfg(feature = "gui")]
                        {
                            self.emit_status_update(
                                last_check_at,
                                compliance_score,
                                cached_pending_sync,
                                cached_policy_summary,
                            );
                            self.emit_resource_update(None);
                        }
                        if let Some(audit_sync) = self.audit_sync.read().await.as_ref() {
                            match audit_sync.sync().await {
                                Ok(count) => {
                                    if count > 0 {
                                        debug!("Synced {} audit trail entries", count);
                                    }
                                }
                                Err(e) => warn!("Audit trail sync failed: {}", e),
                            }
                        }
                        // Drain GRC sync queue: upload locally-created playbooks, risks, assets, etc.
                        if let Some(ref client) = self.authenticated_client
                            && let Some(orchestrator) = self.sync_orchestrator.read().await.as_ref()
                        {
                            match orchestrator.drain_grc_queues(client).await {
                                Ok(count) => {
                                    if count > 0 {
                                        info!("GRC sync: {} items synced", count);
                                    }
                                }
                                Err(e) => warn!("GRC sync queue drain failed: {}", e),
                            }
                        }

                        // Push assets from SQLite to GUI after GRC sync
                        #[cfg(feature = "gui")]
                        self.sync_assets_to_gui().await;

                        // Sync SIEM data to the platform
                        if let Some(ref client) = self.authenticated_client {
                            if let Some(ref siem) = *self.siem_forwarder.read().await {
                                let stats = siem.stats().await;
                                let recent = siem.take_recent_events().await;
                                let cfg = siem.config();

                                let events: Vec<agent_sync::SiemEventPayload> = recent
                                    .iter()
                                    .map(|e| agent_sync::SiemEventPayload {
                                        timestamp: e.timestamp,
                                        severity: e.severity,
                                        category: format!("{}", e.category),
                                        name: e.name.clone(),
                                        description: e.description.clone(),
                                        source_host: e.source_host.clone(),
                                        source_ip: e.source_ip.clone(),
                                        destination_ip: e.destination_ip.clone(),
                                        event_id: e.event_id.clone(),
                                    })
                                    .collect();

                                let request = agent_sync::SiemSyncRequest {
                                    events,
                                    stats: agent_sync::SiemStatsPayload {
                                        enabled: cfg.enabled,
                                        format: format!("{}", cfg.format),
                                        transport: format!("{}", cfg.transport),
                                        destination: cfg.destination_label(),
                                        events_sent: stats.events_sent,
                                        events_dropped: stats.events_dropped,
                                        bytes_sent: stats.bytes_sent,
                                        is_connected: stats.is_connected,
                                        last_error: stats.last_error.clone(),
                                        reported_at: chrono::Utc::now(),
                                    },
                                };

                                if let Err(e) = client.sync_siem_data(request).await {
                                    warn!("Failed to sync SIEM data to platform: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Heartbeat failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
                        if e.is_auth_error() {
                            let failures = self
                                .auth_failure_count
                                .fetch_add(1, Ordering::AcqRel)
                                + 1;
                            warn!(
                                "Authentication error (failure #{}/{})",
                                failures,
                                Self::MAX_RE_ENROLLMENT_ATTEMPTS
                            );

                            // Attempt re-enrollment with exponential backoff
                            if (Self::AUTH_FAILURE_THRESHOLD..=Self::MAX_RE_ENROLLMENT_ATTEMPTS).contains(&failures)
                            {
                                let now_secs = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();
                                let last_attempt = self
                                    .last_re_enrollment_attempt
                                    .load(Ordering::Acquire);

                                // Exponential backoff: 30s, 120s, 600s based on attempt number
                                let attempt_index = failures - Self::AUTH_FAILURE_THRESHOLD;
                                let cooldown_secs: u64 = match attempt_index {
                                    0 => 30,
                                    1 => 120,
                                    _ => 600,
                                };

                                if now_secs.saturating_sub(last_attempt) >= cooldown_secs {
                                    self.last_re_enrollment_attempt
                                        .store(now_secs, Ordering::Release);
                                    info!(
                                        "Initiating automatic re-enrollment (attempt {})",
                                        attempt_index + 1
                                    );
                                    match self.attempt_re_enrollment().await {
                                        Ok(true) => {
                                            info!("Re-enrollment succeeded, resetting auth failure counter");
                                            self.auth_failure_count
                                                .store(0, Ordering::Relaxed);
                                            #[cfg(feature = "gui")]
                                            self.emit_notification(
                                                "Ré-enregistrement réussi",
                                                "L'agent a été ré-enregistré avec succès auprès du serveur.",
                                                "info",
                                            );
                                        }
                                        Ok(false) => {
                                            warn!(
                                                "Re-enrollment not possible (no enrollment token). \
                                                 Agent will continue in degraded mode."
                                            );
                                        }
                                        Err(re_err) => {
                                            error!(
                                                "Re-enrollment attempt failed: {}. \
                                                 Will retry after backoff.",
                                                re_err
                                            );
                                            #[cfg(feature = "gui")]
                                            self.emit_notification(
                                                "Ré-enregistrement échoué",
                                                &format!("{}", re_err),
                                                "error",
                                            );
                                        }
                                    }
                                } else {
                                    debug!(
                                        "Re-enrollment cooldown active ({}s remaining)",
                                        cooldown_secs.saturating_sub(
                                            now_secs.saturating_sub(last_attempt)
                                        )
                                    );
                                }
                            } else if failures > Self::MAX_RE_ENROLLMENT_ATTEMPTS {
                                // Already exceeded max attempts — log periodically
                                if failures.is_multiple_of(10) {
                                    error!(
                                        "Re-enrollment exhausted after {} attempts. \
                                         Agent running in offline/degraded mode. \
                                         Manual intervention required.",
                                        Self::MAX_RE_ENROLLMENT_ATTEMPTS
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // 3. Vulnerability Scanning (skip when paused)
            if !is_paused && last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs {
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                }
                match self.run_vulnerability_scan().await {
                    Ok(result) => {
                        let count = result.vulnerabilities.len();
                        if count > 0 {
                            info!("Vulnerability scan found {} issues", count);
                        }
                        self.upload_software_from_scan(&result).await;
                        #[cfg(feature = "gui")]
                        {
                            let severity = if count > 0 { "warning" } else { "info" };
                            self.emit_notification(
                                "Scan vulnérabilités terminé",
                                &format!(
                                    "{} vulnérabilités détectées sur {} paquets",
                                    count, result.packages_scanned
                                ),
                                severity,
                            );
                            let mut critical = 0u32;
                            let mut high = 0u32;
                            let mut medium = 0u32;
                            let mut low = 0u32;
                            for v in &result.vulnerabilities {
                                match v.severity {
                                    agent_scanner::vulnerability::Severity::Critical => {
                                        critical = critical.saturating_add(1)
                                    }
                                    agent_scanner::vulnerability::Severity::High => {
                                        high = high.saturating_add(1)
                                    }
                                    agent_scanner::vulnerability::Severity::Medium => {
                                        medium = medium.saturating_add(1)
                                    }
                                    agent_scanner::vulnerability::Severity::Low => {
                                        low = low.saturating_add(1)
                                    }
                                }
                            }
                            self.emit_gui_event(AgentEvent::VulnerabilityUpdate {
                                summary: GuiVulnerabilitySummary {
                                    critical,
                                    high,
                                    medium,
                                    low,
                                    last_scan_at: Some(chrono::Utc::now()),
                                },
                            });
                            self.emit_gui_event(AgentEvent::SoftwareUpdate {
                                packages: self.build_software_packages(&result),
                            });
                            self.emit_gui_event(AgentEvent::VulnerabilityFindings {
                                findings: self.build_vulnerability_findings(&result),
                            });
                            last_check_at = Some(chrono::Utc::now());
                        }
                    }
                    Err(e) => {
                        warn!("Vulnerability scan failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification(
                            "Scan vulnérabilités échoué",
                            &format!("{}", e),
                            "error",
                        );
                    }
                }
                #[cfg(feature = "gui")]
                self.state.scanning.store(false, Ordering::Release);
                last_vuln_scan = std::time::Instant::now();
            }

            // Run security scan if interval has passed (skip when paused)
            if !is_paused
                && last_security_scan.elapsed().as_secs() >= self.security_scan_interval_secs
            {
                is_active = true;
                match self.run_security_scan().await {
                    Ok(result) => {
                        let count = result.incidents.len();
                        if count > 0 {
                            warn!("Security scan detected {} incident(s)!", count);
                            #[cfg(feature = "gui")]
                            {
                                self.emit_notification(
                                    "Incidents de sécurité détectés",
                                    &format!("{} incident(s) détecté(s)", count),
                                    "error",
                                );
                                for incident in &result.incidents {
                                    if incident.incident_type
                                        == agent_scanner::IncidentType::SuspiciousProcess
                                        || incident.incident_type
                                            == agent_scanner::IncidentType::CryptoMiner
                                    {
                                        let process_name = incident
                                            .evidence
                                            .get("process_name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();
                                        let command_line = incident
                                            .evidence
                                            .get("path")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string();
                                        self.emit_gui_event(AgentEvent::SuspiciousProcess {
                                            process: GuiSuspiciousProcess {
                                                process_name,
                                                command_line,
                                                reason: incident.description.clone(),
                                                confidence: incident.confidence,
                                                detected_at: incident.detected_at,
                                                ai_confidence: None,
                                                is_false_positive: None,
                                                ai_analysis: None,
                                            },
                                        });
                                    }
                                }
                            }
                        }

                        // Accumulate incidents for threat pipeline
                        #[cfg(feature = "gui")]
                        {
                            pipeline_incidents.extend(result.incidents.iter().cloned());
                        }

                        if count == 0 {
                            #[cfg(feature = "gui")]
                            self.emit_notification(
                                "Scan sécurité",
                                "Aucun incident détecté",
                                "info",
                            );
                        }
                    }
                    Err(e) => {
                        warn!("Security scan failed: {}", e);
                    }
                }
                // Run USB device scan alongside security scan
                // Collect events inside mutex scope, then release before async upload
                let usb_events = self
                    .usb_monitor
                    .lock()
                    .ok()
                    .map(|mut usb| usb.scan())
                    .unwrap_or_default();

                for event in &usb_events {
                    debug!(
                        "USB event: {} ({:04X}:{:04X}) - {:?}",
                        event.device.description,
                        event.device.vendor_id,
                        event.device.product_id,
                        event.event_type
                    );
                }

                // Upload USB events to SaaS (populates USB tab)
                if !usb_events.is_empty()
                    && let Some(ref auth_client) = self.authenticated_client
                {
                    let payloads: Vec<agent_sync::types::UsbEventPayload> =
                        usb_events.iter().cloned().map(Into::into).collect();
                    if let Err(e) = auth_client.upload_usb_events(payloads).await {
                        warn!("Failed to upload USB events to SaaS: {}", e);
                    }
                }

                #[cfg(feature = "gui")]
                for event in usb_events {
                    let gui_event_type = match event.event_type {
                        agent_common::types::UsbEventType::Connected => GuiUsbEventType::Connected,
                        agent_common::types::UsbEventType::Disconnected => {
                            GuiUsbEventType::Disconnected
                        }
                        agent_common::types::UsbEventType::Blocked => GuiUsbEventType::Blocked,
                    };
                    self.emit_gui_event(AgentEvent::UsbEvent {
                        event: GuiUsbEvent {
                            device_name: event.device.description,
                            vendor_id: event.device.vendor_id,
                            product_id: event.device.product_id,
                            event_type: gui_event_type,
                            timestamp: event.timestamp,
                        },
                    });
                }

                last_security_scan = std::time::Instant::now();
            }

            // Run network static info collection if interval has passed (skip when paused)
            if !is_paused && last_network_static.elapsed() >= current_network_static_interval {
                is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len())
                                    .unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len())
                                    .unwrap_or(u32::MAX),
                                alerts_count: last_network_alert_count,
                                primary_ip: snapshot.primary_ip.clone(),
                                primary_mac: snapshot.primary_mac.clone(),
                            });
                            let (interfaces, connections) =
                                Self::snapshot_to_gui_network(&snapshot);
                            self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                                interfaces,
                                connections,
                            });
                        }
                        if let Err(e) = self.upload_network_snapshot(&snapshot).await {
                            warn!("Failed to upload network snapshot: {}", e);
                            #[cfg(feature = "gui")]
                            self.emit_gui_event(AgentEvent::SyncStatus {
                                syncing: false,
                                pending_count: 0,
                                last_sync_at: None,
                                error: Some(format!("Network upload failed: {}", e)),
                            });
                        }
                    }
                    Err(e) => {
                        warn!("Network static collection failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: None,
                            error: Some(format!("Network static collection error: {}", e)),
                        });
                    }
                }
                last_network_static = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                current_network_static_interval = network_manager.next_static_interval();
            }

            // Run network connection scan if interval has passed (skip when paused)
            if !is_paused
                && last_network_connections.elapsed() >= current_network_connection_interval
            {
                is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len())
                                    .unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len())
                                    .unwrap_or(u32::MAX),
                                alerts_count: last_network_alert_count,
                                primary_ip: snapshot.primary_ip.clone(),
                                primary_mac: snapshot.primary_mac.clone(),
                            });
                            let (interfaces, connections) =
                                Self::snapshot_to_gui_network(&snapshot);
                            self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                                interfaces,
                                connections,
                            });
                        }
                        if let Err(e) = self.upload_network_snapshot(&snapshot).await {
                            warn!("Failed to upload network connections: {}", e);
                            #[cfg(feature = "gui")]
                            self.emit_gui_event(AgentEvent::SyncStatus {
                                syncing: false,
                                pending_count: 0,
                                last_sync_at: None,
                                error: Some(format!("Network upload failed: {}", e)),
                            });
                        }
                    }
                    Err(e) => {
                        warn!("Network connection collection failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: None,
                            error: Some(format!("Network connection collection error: {}", e)),
                        });
                    }
                }
                last_network_connections = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                current_network_connection_interval = network_manager.next_connection_interval();
            }

            // Run network security detection if interval has passed (skip when paused)
            if !is_paused && last_network_security.elapsed() >= current_network_security_interval {
                is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        let mut alert_count: u32 = 0;
                        match self.run_network_security_detection(&snapshot).await {
                            Ok(alerts) => {
                                #[cfg(feature = "gui")]
                                {
                                    alert_count = u32::try_from(alerts.len()).unwrap_or(u32::MAX);
                                }
                                for alert in &alerts {
                                    #[cfg(feature = "gui")]
                                    self.emit_network_security_alert_to_gui(alert);
                                    if let Err(e) = self.upload_network_alert(alert).await {
                                        warn!("Failed to upload network alert: {}", e);
                                    }
                                }

                                // Accumulate network alerts for threat pipeline
                                #[cfg(feature = "gui")]
                                {
                                    pipeline_network_alerts.extend(alerts.iter().cloned());
                                }
                            }
                            Err(e) => {
                                warn!("Network security detection failed: {}", e);
                            }
                        }
                        #[cfg(feature = "gui")]
                        {
                            last_network_alert_count = alert_count;
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len())
                                    .unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len())
                                    .unwrap_or(u32::MAX),
                                alerts_count: alert_count,
                                primary_ip: snapshot.primary_ip.clone(),
                                primary_mac: snapshot.primary_mac.clone(),
                            });
                            let (interfaces, connections) =
                                Self::snapshot_to_gui_network(&snapshot);
                            self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                                interfaces,
                                connections,
                            });
                        }
                    }
                    Err(e) => {
                        warn!("Network collection for security scan failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_gui_event(AgentEvent::SyncStatus {
                            syncing: false,
                            pending_count: 0,
                            last_sync_at: None,
                            error: Some(format!("Network security scan collection error: {}", e)),
                        });
                    }
                }
                last_network_security = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                current_network_security_interval = network_manager.next_security_interval();
            }

            // ── Log collection & correlation ──
            // Collect OS event logs and forward to SIEM + run through correlation engine
            {
                let poll_secs = self
                    .state
                    .log_collector_poll_secs
                    .load(std::sync::atomic::Ordering::Acquire);
                let collector_enabled = self
                    .state
                    .log_collector_enabled
                    .load(std::sync::atomic::Ordering::Acquire);

                if collector_enabled && last_log_collection.elapsed().as_secs() >= poll_secs {
                    let collector_guard = self.log_collector.read().await;
                    if let Some(ref collector) = *collector_guard {
                        let siem_events = collector.collect().await;
                        if !siem_events.is_empty() {
                            debug!(
                                "Log collector gathered {} events from OS logs",
                                siem_events.len()
                            );

                            // Record all events for platform sync, then optionally forward to external SIEM
                            let siem_guard = self.siem_forwarder.read().await;
                            if let Some(siem) = siem_guard.as_ref() {
                                for event in &siem_events {
                                    // Always record for platform (SIEM tab in SaaS)
                                    siem.record_event(event.clone()).await;

                                    // Additionally forward to external SIEM if configured
                                    if siem.is_enabled() {
                                        if let Err(e) = siem.send_event(event).await {
                                            warn!("Failed to forward log event to external SIEM: {}", e);
                                        }
                                    }
                                }
                            }
                            drop(siem_guard);

                            // Run events through correlation engine
                            let corr_guard = self.correlation_engine.read().await;
                            if let Some(ref engine) = *corr_guard {
                                let alerts = engine.process_events(&siem_events).await;
                                if !alerts.is_empty() {
                                    warn!(
                                        "Correlation engine triggered {} alert(s)",
                                        alerts.len()
                                    );

                                    // Forward correlation alerts to SIEM (record for platform + optional external)
                                    let siem_guard = self.siem_forwarder.read().await;
                                    if let Some(siem) = siem_guard.as_ref() {
                                        let host = hostname::get()
                                            .map(|h| h.to_string_lossy().to_string())
                                            .unwrap_or_default();
                                        for alert in &alerts {
                                            let event = engine.alert_to_event(alert, &host);
                                            siem.record_event(event.clone()).await;
                                            if siem.is_enabled() {
                                                let _ = siem.send_event(&event).await;
                                            }
                                        }
                                    }
                                    drop(siem_guard);

                                    // Upload correlation alerts as security incidents
                                    for alert in &alerts {
                                        if let Some(ref client) = self.authenticated_client {
                                            let incident_type = match alert.rule_id.as_str() {
                                                "brute_force" | "windows_logon_failure_burst" => "credential_theft",
                                                "privilege_escalation" => "privilege_escalation",
                                                "file_integrity_burst" | "windows_audit_log_cleared"
                                                    | "windows_account_changes" => "unauthorized_change",
                                                "windows_service_install_burst" => "malware",
                                                "windows_firewall_changes" => "firewall_disabled",
                                                "network_scan" | "critical_errors" | _ => "suspicious_process",
                                            };
                                            let payload = serde_json::json!({
                                                "incident_type": incident_type,
                                                "severity": if alert.severity >= 8 { "critical" }
                                                    else if alert.severity >= 6 { "high" }
                                                    else { "medium" },
                                                "title": alert.rule_name,
                                                "description": format!(
                                                    "{} ({} events in {}s)",
                                                    alert.description, alert.event_count,
                                                    (alert.last_event - alert.first_event).num_seconds()
                                                ),
                                                "evidence": {
                                                    "rule_id": alert.rule_id,
                                                    "event_count": alert.event_count,
                                                    "sample_event_ids": alert.sample_event_ids,
                                                },
                                                "confidence": 80,
                                                "detected_at": alert.generated_at.to_rfc3339(),
                                            });
                                            if let Err(e) = client.post_json::<_, serde_json::Value>(
                                                &format!("/v1/agents/{}/incidents",
                                                    self.config.agent_id.as_deref().unwrap_or("unknown")),
                                                &payload
                                            ).await {
                                                warn!("Failed to upload correlation alert: {}", e);
                                            }
                                        }
                                    }
                                }
                            }
                            drop(corr_guard);
                        }
                    }
                    drop(collector_guard);
                    last_log_collection = std::time::Instant::now();
                }
            }

            // ── Autonomous threat pipeline ──
            // Evaluate detection rules against accumulated threat data from this
            // iteration (security scan incidents, network alerts, FIM alerts).
            #[cfg(feature = "gui")]
            if !pipeline_incidents.is_empty()
                || !pipeline_network_alerts.is_empty()
                || !pipeline_fim_alerts.is_empty()
            {
                let threat_context = threat_pipeline::build_threat_context(
                    &pipeline_incidents,
                    &pipeline_network_alerts,
                    &pipeline_fim_alerts,
                );

                // Load detection rules and playbooks from the database
                let mut detection_rules: Vec<agent_gui::dto::DetectionRule> = Vec::new();
                let mut playbooks: Vec<agent_gui::dto::Playbook> = Vec::new();

                if let Some(ref db) = self.db {
                    let rule_repo =
                        agent_storage::repositories::grc::DetectionRuleRepository::new(db);
                    match rule_repo.get_all().await {
                        Ok(stored_rules) => {
                            detection_rules = threat_pipeline::stored_rules_to_dto(&stored_rules);
                            debug!(
                                "Loaded {} detection rules for pipeline",
                                detection_rules.len()
                            );
                        }
                        Err(e) => warn!("Failed to load detection rules for pipeline: {}", e),
                    }

                    let pb_repo = agent_storage::repositories::grc::PlaybookRepository::new(db);
                    match pb_repo.get_all().await {
                        Ok(stored_pbs) => {
                            playbooks = threat_pipeline::stored_playbooks_to_dto(&stored_pbs);
                            debug!("Loaded {} playbooks for pipeline", playbooks.len());
                        }
                        Err(e) => warn!("Failed to load playbooks for pipeline: {}", e),
                    }
                }

                if !detection_rules.is_empty() || !playbooks.is_empty() {
                    let pipeline_result = threat_pipeline::run_threat_pipeline(
                        &detection_rules,
                        &playbooks,
                        &threat_context,
                        &self.gui_event_tx,
                        #[cfg(feature = "llm")]
                        self.llm_service.as_ref().map(|s| s.as_ref()),
                        self.audit_trail.as_ref(),
                    )
                    .await;

                    if let Some(ref client) = self.authenticated_client {
                        // Upload detection matches to the platform
                        if !pipeline_result.rule_matches.is_empty() {
                            let match_payloads: Vec<agent_sync::DetectionMatchPayload> =
                                pipeline_result
                                    .rule_matches
                                    .iter()
                                    .map(|m| agent_sync::DetectionMatchPayload {
                                        rule_id: m.rule_id.clone(),
                                        rule_name: m.rule_name.clone(),
                                        matched_at: chrono::Utc::now(),
                                        trigger_details: m.matched_value.clone(),
                                        severity: m.severity.clone(),
                                    })
                                    .collect();
                            match client.sync_detection_matches(match_payloads).await {
                                Ok(resp) => info!(
                                    "Uploaded {} detection matches to platform",
                                    resp.received_count
                                ),
                                Err(e) => warn!("Failed to upload detection matches: {}", e),
                            }
                        }

                        // Upload playbook execution logs to the platform
                        if !pipeline_result.playbook_logs.is_empty() {
                            let log_payloads: Vec<agent_sync::PlaybookLogPayload> = pipeline_result
                                .playbook_logs
                                .iter()
                                .map(|l| agent_sync::PlaybookLogPayload {
                                    id: l.id.to_string(),
                                    playbook_id: l.playbook_id.to_string(),
                                    playbook_name: l.playbook_name.clone(),
                                    triggered_at: l.triggered_at,
                                    trigger_event: l.trigger_event.clone(),
                                    actions_executed: l.actions_executed.clone(),
                                    success: l.success,
                                    error: l.error.clone(),
                                })
                                .collect();
                            match client.sync_playbook_logs(log_payloads).await {
                                Ok(resp) => info!(
                                    "Uploaded {} playbook logs to platform",
                                    resp.received_count
                                ),
                                Err(e) => warn!("Failed to upload playbook logs: {}", e),
                            }
                        }
                    }
                }

                // Forward security incidents and network alerts to SIEM (record for platform + optional external)
                let siem_guard = self.siem_forwarder.read().await;
                if let Some(siem) = siem_guard.as_ref() {
                    let host = hostname::get()
                        .map(|h| h.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // Security incidents → SIEM
                    for inc in &pipeline_incidents {
                        let severity = match inc.severity {
                            agent_scanner::IncidentSeverity::Critical => 9,
                            agent_scanner::IncidentSeverity::High => 7,
                            agent_scanner::IncidentSeverity::Medium => 5,
                            agent_scanner::IncidentSeverity::Low => 3,
                        };
                        let process_name = inc
                            .evidence
                            .get("process_name")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let mut event = agent_siem::SiemEvent {
                            timestamp: inc.detected_at,
                            severity,
                            category: agent_siem::EventCategory::Security,
                            name: inc.title.clone(),
                            description: inc.description.clone(),
                            source_host: host.clone(),
                            source_ip: None,
                            destination_ip: None,
                            destination_port: None,
                            user: None,
                            process_name,
                            process_id: None,
                            file_path: None,
                            custom_fields: serde_json::json!({
                                "incident_type": format!("{}", inc.incident_type),
                                "confidence": inc.confidence,
                            }),
                            event_id: uuid::Uuid::new_v4().to_string(),
                            agent_version: AGENT_VERSION.to_string(),
                        };
                        #[cfg(feature = "llm")]
                        {
                            if let Some(ref llm_svc) = self.llm_service {
                                siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
                            }
                        }
                        #[cfg(not(feature = "llm"))]
                        {
                            siem_enrichment::enrich_siem_event(&mut event).await;
                        }
                        siem.record_event(event.clone()).await;
                        if siem.is_enabled() {
                            if let Err(e) = siem.send_event(&event).await {
                                warn!("Failed to forward security incident to external SIEM: {}", e);
                            }
                        }
                    }

                    // Network alerts → SIEM
                    for alert in &pipeline_network_alerts {
                        let severity = match alert.severity {
                            agent_network::AlertSeverity::Critical => 9,
                            agent_network::AlertSeverity::High => 7,
                            agent_network::AlertSeverity::Medium => 5,
                            agent_network::AlertSeverity::Low => 3,
                        };
                        let (src_ip, dst_ip, dst_port) = if let Some(ref conn) = alert.connection {
                            (
                                Some(conn.local_address.clone()),
                                conn.remote_address.clone(),
                                conn.remote_port,
                            )
                        } else {
                            (None, None, None)
                        };
                        let mut event = agent_siem::SiemEvent {
                            timestamp: alert.detected_at,
                            severity,
                            category: agent_siem::EventCategory::Network,
                            name: alert.title.clone(),
                            description: alert.description.clone(),
                            source_host: host.clone(),
                            source_ip: src_ip,
                            destination_ip: dst_ip,
                            destination_port: dst_port,
                            user: None,
                            process_name: None,
                            process_id: None,
                            file_path: None,
                            custom_fields: serde_json::json!({
                                "alert_type": format!("{}", alert.alert_type),
                                "confidence": alert.confidence,
                                "iocs_matched": alert.iocs_matched,
                            }),
                            event_id: uuid::Uuid::new_v4().to_string(),
                            agent_version: AGENT_VERSION.to_string(),
                        };
                        #[cfg(feature = "llm")]
                        {
                            if let Some(ref llm_svc) = self.llm_service {
                                siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
                            }
                        }
                        #[cfg(not(feature = "llm"))]
                        {
                            siem_enrichment::enrich_siem_event(&mut event).await;
                        }
                        siem.record_event(event.clone()).await;
                        if siem.is_enabled() {
                            if let Err(e) = siem.send_event(&event).await {
                                warn!("Failed to forward network alert to external SIEM: {}", e);
                            }
                        }
                    }

                    if !pipeline_incidents.is_empty() || !pipeline_network_alerts.is_empty() {
                        info!(
                            "Forwarded {} security incidents and {} network alerts to SIEM",
                            pipeline_incidents.len(),
                            pipeline_network_alerts.len(),
                        );
                    }
                }
                drop(siem_guard);
            }

            // Run compliance checks if interval has passed (skip when paused)
            if !is_paused
                && last_compliance_check_time.elapsed().as_secs() >= self.state.get_check_interval()
            {
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                }

                let (check_results, score) = self.run_compliance_checks().await;
                compliance_score = Some(score.score);
                last_compliance_check_at = Some(chrono::Utc::now());

                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                // Auto-generate risks from failing checks and queue for platform sync
                self.auto_generate_risks(&check_results).await;

                #[cfg(feature = "gui")]
                {
                    let total = u32::try_from(score.total_count).unwrap_or(u32::MAX);
                    cached_policy_summary = Some(GuiPolicySummary {
                        total_policies: total,
                        passing: u32::try_from(score.passed_count).unwrap_or(u32::MAX),
                        failing: u32::try_from(score.failed_count).unwrap_or(u32::MAX),
                        errors: u32::try_from(score.error_count).unwrap_or(u32::MAX),
                        pending: {
                            let passed = u32::try_from(score.passed_count).unwrap_or(u32::MAX);
                            let failed = u32::try_from(score.failed_count).unwrap_or(u32::MAX);
                            let errored = u32::try_from(score.error_count).unwrap_or(u32::MAX);
                            total.saturating_sub(
                                passed.saturating_add(failed).saturating_add(errored),
                            )
                        },
                    });

                    for exec_result in &check_results {
                        let gui_result = self.execution_result_to_gui(exec_result);
                        self.emit_gui_event(AgentEvent::CheckCompleted { result: gui_result });
                    }
                    last_check_at = Some(chrono::Utc::now());
                    self.state.scanning.store(false, Ordering::Release);
                    self.emit_notification(
                        "Compliance vérifiée",
                        &format!(
                            "Score: {:.1}% ({} passés, {} échoués)",
                            score.score, score.passed_count, score.failed_count
                        ),
                        if score.score >= 80.0 {
                            "info"
                        } else {
                            "warning"
                        },
                    );
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                }

                last_compliance_check_time = std::time::Instant::now();
            }

            // Certificate renewal check (daily)
            if last_cert_check.elapsed().as_secs() >= cert_check_interval_secs {
                if let Some(ref auth_client) = self.authenticated_client {
                    match auth_client.check_and_renew_if_needed().await {
                        Ok(()) => {
                            debug!("Certificate renewal check complete");
                        }
                        Err(e) => {
                            warn!("Certificate renewal check failed: {}", e);
                            // If renewal failed due to auth/cert error, try re-enrollment
                            if e.is_auth_error() {
                                warn!("Certificate expired or rejected, triggering re-enrollment");
                                match self.attempt_re_enrollment().await {
                                    Ok(true) => {
                                        info!("Re-enrollment after certificate expiry succeeded");
                                        self.auth_failure_count.store(0, Ordering::Release);
                                    }
                                    Ok(false) => warn!(
                                        "Cannot re-enroll: no enrollment token configured"
                                    ),
                                    Err(re_err) => error!(
                                        "Re-enrollment after certificate expiry failed: {}",
                                        re_err
                                    ),
                                }
                            }
                        }
                    }
                }
                last_cert_check = std::time::Instant::now();
            }

            // Check for force_check flag (GUI "Vérifier maintenant" button)
            if self.state.force_check.load(Ordering::Acquire) {
                info!("Force check triggered");
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                }

                match self.run_vulnerability_scan().await {
                    Ok(result) => {
                        let count = result.vulnerabilities.len();
                        info!(
                            "Force vuln check: {} findings from {} packages",
                            count, result.packages_scanned
                        );
                        self.upload_software_from_scan(&result).await;
                        #[cfg(feature = "gui")]
                        {
                            self.emit_notification(
                                "Scan vulnérabilités",
                                &format!(
                                    "{} vulnérabilités sur {} paquets",
                                    count, result.packages_scanned
                                ),
                                if count > 0 { "warning" } else { "info" },
                            );
                            let mut critical = 0u32;
                            let mut high = 0u32;
                            let mut medium = 0u32;
                            let mut low = 0u32;
                            for v in &result.vulnerabilities {
                                match v.severity {
                                    agent_scanner::Severity::Critical => {
                                        critical = critical.saturating_add(1)
                                    }
                                    agent_scanner::Severity::High => high = high.saturating_add(1),
                                    agent_scanner::Severity::Medium => {
                                        medium = medium.saturating_add(1)
                                    }
                                    agent_scanner::Severity::Low => low = low.saturating_add(1),
                                }
                            }
                            self.emit_gui_event(AgentEvent::VulnerabilityUpdate {
                                summary: GuiVulnerabilitySummary {
                                    critical,
                                    high,
                                    medium,
                                    low,
                                    last_scan_at: Some(chrono::Utc::now()),
                                },
                            });
                            self.emit_gui_event(AgentEvent::SoftwareUpdate {
                                packages: self.build_software_packages(&result),
                            });
                            self.emit_gui_event(AgentEvent::VulnerabilityFindings {
                                findings: self.build_vulnerability_findings(&result),
                            });
                        }
                    }
                    Err(e) => {
                        warn!("Force vuln check failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification(
                            "Scan vulnérabilités échoué",
                            &format!("{}", e),
                            "error",
                        );
                    }
                }

                let (check_results, score) = self.run_compliance_checks().await;
                compliance_score = Some(score.score);
                last_compliance_check_at = Some(chrono::Utc::now());
                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                #[cfg(feature = "gui")]
                {
                    let total = u32::try_from(score.total_count).unwrap_or(u32::MAX);
                    cached_policy_summary = Some(GuiPolicySummary {
                        total_policies: total,
                        passing: u32::try_from(score.passed_count).unwrap_or(u32::MAX),
                        failing: u32::try_from(score.failed_count).unwrap_or(u32::MAX),
                        errors: u32::try_from(score.error_count).unwrap_or(u32::MAX),
                        pending: {
                            let passed = u32::try_from(score.passed_count).unwrap_or(u32::MAX);
                            let failed = u32::try_from(score.failed_count).unwrap_or(u32::MAX);
                            let errored = u32::try_from(score.error_count).unwrap_or(u32::MAX);
                            total.saturating_sub(
                                passed.saturating_add(failed).saturating_add(errored),
                            )
                        },
                    });

                    for exec_result in &check_results {
                        let gui_result = self.execution_result_to_gui(exec_result);
                        self.emit_gui_event(AgentEvent::CheckCompleted { result: gui_result });
                    }
                    last_check_at = Some(chrono::Utc::now());
                    self.emit_notification(
                        "Compliance vérifiée",
                        &format!(
                            "Score: {:.1}% ({} passés, {} échoués)",
                            score.score, score.passed_count, score.failed_count
                        ),
                        if score.score >= 80.0 {
                            "info"
                        } else {
                            "warning"
                        },
                    );
                    self.state.scanning.store(false, Ordering::Release);
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                }
                last_vuln_scan = std::time::Instant::now();
                last_compliance_check_time = std::time::Instant::now();
                self.state.force_check.store(false, Ordering::Release);
            }

            // Check for force_sync flag (GUI "Forcer la synchronisation" button)
            if self.state.force_sync.load(Ordering::Acquire) {
                info!("Force sync triggered");
                #[cfg(feature = "gui")]
                self.emit_gui_event(AgentEvent::SyncStatus {
                    syncing: true,
                    pending_count: 0,
                    last_sync_at: None,
                    error: None,
                });

                self.upload_check_results().await;

                // Drain GRC sync queue during force sync
                if let Some(ref client) = self.authenticated_client
                    && let Some(orchestrator) = self.sync_orchestrator.read().await.as_ref()
                {
                    match orchestrator.drain_grc_queues(client).await {
                        Ok(count) => {
                            if count > 0 {
                                info!("Force sync: {} GRC items synced", count);
                            }
                        }
                        Err(e) => warn!("Force sync GRC queue drain failed: {}", e),
                    }
                }

                match self
                    .send_heartbeat(compliance_score, last_compliance_check_at)
                    .await
                {
                    Ok(()) => {
                        info!("Force sync heartbeat sent");
                        #[cfg(feature = "gui")]
                        {
                            self.emit_notification(
                                "Synchronisation",
                                "Données synchronisées avec succès",
                                "info",
                            );
                            self.emit_gui_event(AgentEvent::SyncStatus {
                                syncing: false,
                                pending_count: 0,
                                last_sync_at: Some(chrono::Utc::now()),
                                error: None,
                            });
                        }
                    }
                    Err(e) => {
                        warn!("Force sync heartbeat failed: {}", e);
                        #[cfg(feature = "gui")]
                        {
                            self.emit_notification(
                                "Synchronisation échouée",
                                &format!("{}", e),
                                "error",
                            );
                            self.emit_gui_event(AgentEvent::SyncStatus {
                                syncing: false,
                                pending_count: 0,
                                last_sync_at: None,
                                error: Some(format!("{}", e)),
                            });
                        }
                    }
                }
                last_heartbeat = std::time::Instant::now();
                #[cfg(feature = "gui")]
                {
                    self.emit_status_update(
                        last_check_at,
                        compliance_score,
                        cached_pending_sync,
                        cached_policy_summary,
                    );
                    self.emit_resource_update(None);
                }
                self.state.force_sync.store(false, Ordering::Release);
            }

            // Check for force_update flag (trigger from GUI button)
            if self.state.force_update.swap(false, Ordering::AcqRel)
                && let Err(e) = self.run_self_update().await
            {
                warn!("Self-update failed: {}", e);
            }

            // Check for force_discovery flag (GUI network discovery)
            #[cfg(feature = "gui")]
            if self.state.force_discovery.swap(false, Ordering::AcqRel) {
                info!("Network discovery scan triggered");
                let cancel = self.state.discovery_cancel.clone();

                if let Some(ref tx) = self.gui_event_tx {
                    let tx = tx.clone();
                    let db_clone = self.db.clone();
                    let sync_client = self.authenticated_client.clone();

                    let subnet = {
                        let network_manager = self.network_manager.read().await;
                        match network_manager.collect_snapshot().await {
                            Ok(snapshot) => snapshot
                                .primary_ip
                                .as_ref()
                                .and_then(|ip| ip.parse::<std::net::Ipv4Addr>().ok())
                                .map(|addr| {
                                    let o = addr.octets();
                                    format!("{}.{}.{}.0/24", o[0], o[1], o[2])
                                })
                                .unwrap_or_else(|| "192.168.1.0/24".to_string()),
                            Err(_) => "192.168.1.0/24".to_string(),
                        }
                    };

                    tokio::spawn(async move {
                        let config = DiscoveryConfig::default();
                        let discovery = NetworkDiscovery::new(config);

                        let disc_cancel = discovery.cancel_handle();
                        let cancel_watcher = cancel.clone();
                        let done = Arc::new(AtomicBool::new(false));
                        let done_watcher = done.clone();
                        tokio::spawn(async move {
                            loop {
                                if done_watcher.load(Ordering::Relaxed) {
                                    break;
                                }
                                if cancel_watcher.load(Ordering::Relaxed) {
                                    disc_cancel.store(true, Ordering::Relaxed);
                                    break;
                                }
                                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                            }
                        });

                        if let Err(e) = tx.send(AgentEvent::DiscoveryProgress {
                            phase: "Scan ARP en cours...".to_string(),
                            progress: 0.1,
                            devices_found: 0,
                        }) {
                            warn!("Failed to send discovery progress: {}", e);
                        }

                        let scan_result = discovery.scan(&subnet).await;
                        done.store(true, Ordering::Relaxed);
                        match scan_result {
                            Ok(result) => {
                                let devices: Vec<GuiDiscoveredDevice> = result
                                    .devices
                                    .iter()
                                    .map(|d| GuiDiscoveredDevice {
                                        ip: d.ip.clone(),
                                        mac: d.mac.clone(),
                                        hostname: d.hostname.clone(),
                                        vendor: d.vendor.clone(),
                                        device_type: format!("{}", d.device_type),
                                        open_ports: d.open_ports.clone(),
                                        first_seen: d.first_seen,
                                        last_seen: d.last_seen,
                                        is_gateway: d.is_gateway,
                                        subnet: d.subnet.clone(),
                                    })
                                    .collect();
                                info!(
                                    "Discovery complete: {} devices in {}ms",
                                    devices.len(),
                                    result.scan_duration_ms
                                );

                                if let Some(ref db) = db_clone {
                                    let repo = agent_storage::repositories::DiscoveredDevicesRepository::new(db);
                                    let stored: Vec<agent_storage::repositories::StoredDevice> =
                                        devices
                                            .iter()
                                            .map(|d| agent_storage::repositories::StoredDevice {
                                                ip: d.ip.clone(),
                                                mac: d.mac.clone(),
                                                hostname: d.hostname.clone(),
                                                vendor: d.vendor.clone(),
                                                device_type: d.device_type.clone(),
                                                open_ports: d.open_ports.clone(),
                                                first_seen: d.first_seen,
                                                last_seen: d.last_seen,
                                                is_gateway: d.is_gateway,
                                                subnet: d.subnet.clone(),
                                            })
                                            .collect();
                                    if let Err(e) = repo.upsert_batch(&stored).await {
                                        warn!("Failed to persist discovered devices: {}", e);
                                    } else {
                                        info!(
                                            "Persisted {} discovered devices to database",
                                            stored.len()
                                        );
                                    }
                                }

                                // Sync discovered devices to the platform
                                if let Some(ref client) = sync_client {
                                    let mut synced = 0u32;
                                    for d in &devices {
                                        let payload = agent_sync::DiscoveredAssetPayload {
                                            ip: d.ip.clone(),
                                            hostname: d.hostname.clone(),
                                            device_type: Some(d.device_type.clone()),
                                            source: Some("network_discovery".to_string()),
                                        };
                                        match client.report_discovered_asset(payload).await {
                                            Ok(_) => synced += 1,
                                            Err(e) => {
                                                warn!(
                                                    "Failed to sync discovered device {}: {}",
                                                    d.ip, e
                                                );
                                            }
                                        }
                                    }
                                    if synced > 0 {
                                        info!(
                                            "Synced {}/{} discovered devices to platform",
                                            synced,
                                            devices.len()
                                        );
                                    }
                                }

                                if let Err(e) = tx.send(AgentEvent::DiscoveryUpdate { devices }) {
                                    warn!("Failed to send discovery update: {}", e);
                                }
                            }
                            Err(e) => {
                                warn!("Discovery scan failed: {}", e);
                                if let Err(e2) = tx.send(AgentEvent::DiscoveryProgress {
                                    phase: format!("Erreur: {}", e),
                                    progress: 0.0,
                                    devices_found: 0,
                                }) {
                                    warn!("Failed to send discovery error progress: {}", e2);
                                }
                            }
                        }
                    });
                }
            }

            // Check for pending asset proposals
            {
                let proposals: Vec<ProposeAssetData> = {
                    match self.pending_asset_proposals.lock() {
                        Ok(mut queue) => queue.drain(..).collect(),
                        Err(_) => Vec::new(),
                    }
                };
                for proposal in proposals {
                    if let Err(e) = self.upload_proposed_asset(&proposal).await {
                        warn!("Failed to propose asset {}: {}", proposal.ip, e);
                    }
                }
            }

            // Periodically collect resource usage and push to GUI/Check limits
            let usage = self.resource_monitor.get_usage();

            if is_active {
                self.resource_monitor
                    .check_limits_with_usage(&usage, is_active);
            }

            // Periodically push resource usage to the GUI (every 1 second)
            #[cfg(feature = "gui")]
            if last_gui_resource_update.elapsed().as_secs() >= 1 {
                self.emit_resource_update(Some(usage));
                last_gui_resource_update = std::time::Instant::now();
            }

            // Sleep for a short interval before checking shutdown again
            tokio::select! {
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => {}
                req = async {
                    let mut rx = self.remediation_rx.lock().await;
                    rx.recv().await
                } => {
                    if let Some(req) = req {
                        #[cfg(feature = "gui")]
                        match req {
                            state::RemediationRequest::Execute { check_id } => {
                                self.remediate(&check_id).await;
                            }
                            state::RemediationRequest::Preview { check_id } => {
                                self.remediate_preview(&check_id);
                            }
                        }
                        #[cfg(not(feature = "gui"))]
                        {
                            let _ = req;
                        }
                    }
                }
                _ = self.wait_for_shutdown() => {
                    info!("Shutdown signal received, initiating graceful exit sequence...");
                    break;
                }
            }
        }

        // --- Graceful Shutdown Sequence ---
        info!("Performing final cleanup and data flush...");

        // 1. Flush pending check results
        info!("Flushing pending check results to server...");
        self.upload_check_results().await;

        // 2. Send final 'offline' heartbeat if possible
        let api_client = self.api_client.read().await;
        if let Some(client) = api_client.as_ref() {
            let usage = self.resource_monitor.get_usage();
            let hostname = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "unknown".to_string());

            let request = api_client::HeartbeatRequest {
                timestamp: chrono::Utc::now().to_rfc3339(),
                agent_version: AGENT_VERSION.to_string(),
                status: "offline".to_string(),
                hostname: hostname.clone(),
                os_info: format!(
                    "{} {}",
                    std::env::consts::OS,
                    system_utils::get_os_version()
                ),
                cpu_percent: usage.cpu_percent,
                memory_bytes: usage.memory_bytes,
                memory_percent: resources::get_system_resources().memory_percent,
                memory_total_bytes: resources::get_system_resources().memory_total_bytes,
                disk_percent: resources::get_system_resources().disk_percent,
                disk_used_bytes: resources::get_system_resources().disk_used_bytes,
                disk_total_bytes: resources::get_system_resources().disk_total_bytes,
                disk_io_kbps: usage.disk_kbps,
                network_bytes_sent: 0,
                network_bytes_recv: 0,
                uptime_seconds: usage.uptime_ms / 1000,
                ip_address: None,
                last_check_at: last_compliance_check_at.map(|dt| dt.to_rfc3339()),
                compliance_score,
                pending_sync_count: 0,
                self_check_result: None,
                processes: vec![],
                connections: vec![],
                llm_status: None,
                llm_inference_count: None,
            };

            if let Err(e) = client.send_heartbeat(request).await {
                debug!("Could not send final offline heartbeat: {}", e);
            }
        }

        // 3. Stop FIM engine
        {
            let fim_engine = self.fim_engine.read().await;
            if let Some(engine) = fim_engine.as_ref() {
                engine.stop();
            }
        }

        // 4. Close database handle (implicit by Drop, but we can log it)
        info!("Closing database and terminating runtime.");

        info!("Agent shutdown complete");
        Ok(())
    }
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

    #[test]
    fn test_runtime_handle_shutdown() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);
        let handle = runtime.handle();

        assert!(!handle.is_shutdown_requested());
        handle.request_shutdown();
        assert!(handle.is_shutdown_requested());
        assert!(runtime.is_shutdown_requested());
    }

    #[test]
    fn test_runtime_handle_pause_resume() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);
        let handle = runtime.handle();

        assert!(!handle.is_paused());
        handle.pause();
        assert!(handle.is_paused());
        assert!(runtime.is_paused());
        handle.resume();
        assert!(!handle.is_paused());
    }

    #[test]
    fn test_runtime_handle_clone() {
        let config = AgentConfig::default();
        let runtime = AgentRuntime::new(config);
        let handle1 = runtime.handle();
        let handle2 = handle1.clone();

        handle1.pause();
        assert!(handle2.is_paused());

        handle2.request_shutdown();
        assert!(handle1.is_shutdown_requested());
    }
}
