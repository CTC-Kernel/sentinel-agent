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
pub mod state;
pub mod system_utils;
pub mod tracing_layer;
pub mod update_manager;

// Domain modules (impl AgentRuntime split)
mod compliance;
mod enrollment;
mod gui_bridge;
mod heartbeat;
mod network_ops;
mod remediation_ops;
mod scanning;
mod self_update;
mod sync_init;

#[cfg(feature = "tray")]
pub mod tray;

// Re-export logging functions for backward compatibility.
pub use logging::{init_logging, set_tracing_level};
#[cfg(feature = "gui")]
pub use logging::init_logging_with_terminal;

use agent_common::config::AgentConfig;
use agent_common::constants::{AGENT_VERSION, DEFAULT_HEARTBEAT_INTERVAL_SECS};
use agent_common::error::CommonError;
#[cfg(feature = "gui")]
use agent_network::{DiscoveryConfig, NetworkDiscovery};
use agent_network::NetworkManager;
#[cfg(feature = "gui")]
use agent_scanner::RemediationEngine;
use agent_scanner::{
    CheckRegistry, SecurityMonitor, VulnerabilityScanner,
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
use agent_sync::{AuthenticatedClient, ConfigSyncService, ResultUploader, RuleSyncService, AuditSyncService, CommandResultsService};
use api_client::ApiClient;
use resources::ResourceMonitor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

// Import orphaned modules
use agent_fim::FimEngine;
use agent_siem::SiemForwarder;

#[cfg(feature = "gui")]
use agent_gui::dto::{
    FimChangeType as GuiFimChangeType, GuiDiscoveredDevice, GuiFimAlert, GuiPolicySummary,
    GuiSuspiciousProcess, GuiVulnerabilitySummary,
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
    config: AgentConfig,
    resource_monitor: ResourceMonitor,
    api_client: RwLock<Option<ApiClient>>,
    /// Heartbeat interval in seconds (dynamic).
    heartbeat_interval_secs: RwLock<u64>,
    /// Vulnerability scanner for package vulnerability detection.
    vulnerability_scanner: VulnerabilityScanner,
    /// Security monitor for incident detection.
    security_monitor: SecurityMonitor,
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
    /// FIM alert receiver.
    fim_rx: tokio::sync::Mutex<Option<mpsc::Receiver<agent_common::types::FimAlert>>>,
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

    /// Set the dynamic log level (0=error, 1=warn, 2=info, 3=debug, 4=trace).
    pub fn set_log_level(&self, level: u8) {
        self.state.set_log_level(level);
        let level_str = match level {
            0 => "error",
            1 => "warn",
            2 => "info",
            3 => "debug",
            _ => "trace",
        };
        info!("Log level updated to {} via handle", level_str);
        set_tracing_level(level_str);
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
    /// Create a new agent runtime with the given configuration.
    pub fn new(config: AgentConfig) -> Self {
        let resource_monitor = ResourceMonitor::new();
        let vulnerability_scanner = VulnerabilityScanner::new();
        let security_monitor = SecurityMonitor::new();
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
            fim_rx: tokio::sync::Mutex::new(None),
            organization_name: RwLock::new(None),
        }
    }

    /// Set the database and create an authenticated client for sync services.
    pub fn with_database(mut self, db: Arc<Database>) -> Self {
        let auth_client = Arc::new(AuthenticatedClient::new(self.config.clone(), db.clone()));
        self.db = Some(db.clone());
        self.authenticated_client = Some(auth_client);

        let trail = Arc::new(audit_trail::LocalAuditTrail::new(db));
        self.audit_trail = Some(trail.clone());

        let (events_mgr, _gui_event_rx) = events::EventManager::new(Some(trail.clone()));
        let events = Arc::new(events_mgr);
        self.events = events;

        self
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
            Ok(()) => {
                info!("Agent enrollment verified");
                // Initialize sync services now that we're enrolled
                self.init_sync_services().await;
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
        let mut fim_last_day: u64 = chrono::Utc::now().timestamp().max(0) as u64 / agent_common::constants::SECS_PER_DAY;

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

        // Run initial network collection
        info!("Running initial network collection...");
        match self.run_network_collection().await {
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
                        for alert in alerts {
                            if let Err(e) = self.upload_network_alert(&alert).await {
                                warn!("Failed to upload network alert: {}", e);
                            }
                        }
                    }
                    Err(e) => warn!("Initial network security detection failed: {}", e),
                }
            }
            Err(e) => warn!("Initial network collection failed: {}", e),
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
            match SiemForwarder::new(config) {
                Ok(forwarder) => {
                    let mut siem_guard = self.siem_forwarder.write().await;
                    *siem_guard = Some(forwarder);
                    info!("SIEM forwarder initialized (disabled by default)");
                }
                Err(e) => error!("Failed to initialize SIEM forwarder: {}", e),
            }
        }

        info!("Agent main loop started");
        loop {
            // Check for shutdown signal
            if self.state.shutdown.load(Ordering::Acquire) {
                info!("Shutdown requested, stopping main loop");
                break;
            }

            // Check resource limits periodically
            self.resource_monitor.check_limits(true);

            let mut is_active = false;

            // 1. Process FIM alerts
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
                                alert.path.display(), alert.change
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
                                agent_common::types::FimChangeType::Created => GuiFimChangeType::Created,
                                agent_common::types::FimChangeType::Modified => GuiFimChangeType::Modified,
                                agent_common::types::FimChangeType::Deleted => GuiFimChangeType::Deleted,
                                agent_common::types::FimChangeType::PermissionChanged => GuiFimChangeType::PermissionChanged,
                                agent_common::types::FimChangeType::Renamed => GuiFimChangeType::Renamed,
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
                            let today = chrono::Utc::now().timestamp().max(0) as u64 / agent_common::constants::SECS_PER_DAY;
                            if today != fim_last_day {
                                fim_changes_today = 0;
                                fim_last_day = today;
                            }
                            fim_changes_today = fim_changes_today.saturating_add(1);
                        }

                        // Send to SaaS
                        if let Some(client) = self.api_client.read().await.as_ref()
                            && let Err(e) = client.report_incident(report.clone()).await
                        {
                            error!("Failed to report FIM incident to SaaS: {}", e);
                        }

                        // Forward to SIEM
                        let siem_guard = self.siem_forwarder.read().await;
                        if let Some(siem) = siem_guard.as_ref()
                            && siem.is_enabled()
                        {
                            let event = agent_siem::SiemEvent {
                                timestamp: chrono::Utc::now(),
                                severity: 5,
                                category: agent_siem::EventCategory::FileIntegrity,
                                name: "File Integrity Change".to_string(),
                                description: report.description,
                                source_host: hostname::get().map(|h| h.to_string_lossy().to_string()).unwrap_or_default(),
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

                            if let Err(e) = siem.send_event(&event).await {
                                warn!("Failed to forward FIM event to SIEM: {}", e);
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
                    let today = chrono::Utc::now().timestamp().max(0) as u64 / agent_common::constants::SECS_PER_DAY;
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

            // 2. Heartbeat & Config Sync
            if last_heartbeat.elapsed().as_secs() >= *self.heartbeat_interval_secs.read().await {
                last_heartbeat = std::time::Instant::now();
                match self
                    .send_heartbeat(compliance_score, last_compliance_check_at)
                    .await
                {
                    Ok(_) => {
                        debug!("Heartbeat sent successfully");

                        #[cfg(feature = "gui")]
                        {
                            cached_pending_sync = self.get_pending_sync_count().await as u32;
                        }

                        if self.state.force_sync.load(Ordering::Acquire) {
                            info!("Forced sync requested via heartbeat command");
                            self.apply_config_changes().await;
                            self.state.force_sync.store(false, Ordering::Release);
                        }
                        #[cfg(feature = "gui")]
                        {
                            self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                    }
                    Err(e) => {
                        warn!("Heartbeat failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
                        if e.to_string().contains("401") || e.to_string().contains("403") {
                            warn!("Authentication error, attempting re-enrollment logic...");
                        }
                    }
                }
            }

            // 3. Vulnerability Scanning
            if last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs {
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                                    agent_scanner::vulnerability::Severity::Critical => critical = critical.saturating_add(1),
                                    agent_scanner::vulnerability::Severity::High => high = high.saturating_add(1),
                                    agent_scanner::vulnerability::Severity::Medium => medium = medium.saturating_add(1),
                                    agent_scanner::vulnerability::Severity::Low => low = low.saturating_add(1),
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

            // Run security scan if interval has passed
            if last_security_scan.elapsed().as_secs() >= self.security_scan_interval_secs {
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
                                    if incident.incident_type == agent_scanner::IncidentType::SuspiciousProcess
                                        || incident.incident_type == agent_scanner::IncidentType::CryptoMiner
                                    {
                                        let process_name = incident.evidence.get("process_name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();
                                        let command_line = incident.evidence.get("path")
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
                                            },
                                        });
                                    }
                                }
                            }
                        } else {
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
                last_security_scan = std::time::Instant::now();
            }

            // Run network static info collection if interval has passed
            if last_network_static.elapsed() >= current_network_static_interval {
                is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len()).unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len()).unwrap_or(u32::MAX),
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

            // Run network connection scan if interval has passed
            if last_network_connections.elapsed() >= current_network_connection_interval {
                is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len()).unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len()).unwrap_or(u32::MAX),
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

            // Run network security detection if interval has passed
            if last_network_security.elapsed() >= current_network_security_interval {
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
                                for alert in alerts {
                                    if let Err(e) = self.upload_network_alert(&alert).await {
                                        warn!("Failed to upload network alert: {}", e);
                                    }
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
                                interfaces_count: u32::try_from(snapshot.interfaces.len()).unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len()).unwrap_or(u32::MAX),
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

            // Run compliance checks if interval has passed (dynamic from GUI settings)
            if last_compliance_check_time.elapsed().as_secs() >= self.state.get_check_interval()
            {
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                            total.saturating_sub(passed.saturating_add(failed).saturating_add(errored))
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
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                        Err(e) => warn!("Certificate renewal check failed: {}", e),
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
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                                    agent_scanner::Severity::Critical => critical += 1,
                                    agent_scanner::Severity::High => high += 1,
                                    agent_scanner::Severity::Medium => medium += 1,
                                    agent_scanner::Severity::Low => low += 1,
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
                            total.saturating_sub(passed.saturating_add(failed).saturating_add(errored))
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
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
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
                    self.emit_status_update(last_check_at, compliance_score, cached_pending_sync, cached_policy_summary);
                    self.emit_resource_update(None);
                }
                self.state.force_sync.store(false, Ordering::Release);
            }

            // Check for force_update flag (trigger from GUI button)
            if self.state.force_update.swap(false, Ordering::AcqRel)
                && let Err(e) = self.run_self_update().await {
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
                        tokio::spawn(async move {
                            loop {
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

                        match discovery.scan(&subnet).await {
                            Ok(result) => {
                                let devices: Vec<GuiDiscoveredDevice> = result
                                    .devices
                                    .iter()
                                    .map(|d| GuiDiscoveredDevice {
                                        ip: d.ip.clone(),
                                        mac: d.mac.clone(),
                                        hostname: d.hostname.clone(),
                                        vendor: d.vendor.clone(),
                                        device_type: format!("{:?}", d.device_type),
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
                os_info: format!("{} {}", std::env::consts::OS, system_utils::get_os_version()),
                cpu_percent: usage.cpu_percent,
                memory_bytes: usage.memory_bytes,
                memory_percent: resources::get_system_resources().memory_percent,
                memory_total_bytes: resources::get_system_resources().memory_total_bytes,
                disk_percent: resources::get_system_resources().disk_percent,
                disk_used_bytes: resources::get_system_resources().disk_used_bytes,
                disk_total_bytes: resources::get_system_resources().disk_total_bytes,
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
