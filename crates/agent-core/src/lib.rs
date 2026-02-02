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
pub mod cleanup;
pub mod resources;
pub mod service;
pub mod tracing_layer;

#[cfg(feature = "tray")]
pub mod tray;

use agent_common::config::AgentConfig;
use agent_common::constants::{AGENT_VERSION, DEFAULT_HEARTBEAT_INTERVAL_SECS};
use agent_common::error::CommonError;
use agent_common::types::CheckSeverity;
use agent_network::{
    DiscoveryConfig, NetworkDiscovery, NetworkManager, NetworkSecurityAlert, NetworkSnapshot,
};
use agent_scanner::{
    CheckExecutionResult, CheckRegistry, CheckRunner, CheckScoreInput, ComplianceScore,
    ScanSummary, ScanType, ScoreCalculator, SecurityMonitor, SecurityScanResult,
    VulnerabilityScanResult, VulnerabilityScanner,
    checks::{
        AdminAccountsCheck, AntivirusCheck, AuditLoggingCheck, AutoLoginCheck, BackupCheck,
        BluetoothCheck, BrowserSecurityCheck, DiskEncryptionCheck, FirewallCheck,
        GuestAccountCheck, Ipv6ConfigCheck, KernelHardeningCheck, LogRotationCheck, MfaCheck,
        ObsoleteProtocolsCheck, PasswordPolicyCheck, RemoteAccessCheck, SessionLockCheck,
        SystemUpdatesCheck, TimeSyncCheck, UsbStorageCheck,
    },
};
use agent_storage::{
    CheckResult as StorageCheckResult, CheckResultsRepository, CheckRule as StorageCheckRule,
    CheckRulesRepository, CheckStatus as StorageCheckStatus, Database, Severity as StorageSeverity,
};
use agent_sync::{AuthenticatedClient, ConfigSyncService, ResultUploader, RuleSyncService};
use api_client::{ApiClient, EnrollmentRequest, HeartbeatRequest};
use resources::ResourceMonitor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

#[cfg(feature = "gui")]
use agent_gui::dto::{
    AgentSummary, GuiAgentStatus, GuiCheckResult, GuiCheckStatus, GuiDiscoveredDevice,
    GuiNetworkConnection, GuiNetworkInterface, GuiNotification, GuiResourceUsage,
    GuiSoftwarePackage, GuiVulnerabilityFinding, GuiVulnerabilitySummary,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

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
    shutdown: ShutdownSignal,
    /// Whether the agent is paused (controlled from tray/GUI).
    paused: Arc<AtomicBool>,
    /// Whether the agent is currently scanning.
    scanning: Arc<AtomicBool>,
    resource_monitor: ResourceMonitor,
    api_client: RwLock<Option<ApiClient>>,
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
    /// Flag to trigger an immediate vulnerability check (from GUI).
    force_check: Arc<AtomicBool>,
    /// Flag to trigger an immediate sync (from GUI).
    force_sync: Arc<AtomicBool>,
    /// Flag to trigger a network discovery scan (from GUI).
    force_discovery: Arc<AtomicBool>,
    /// Flag to cancel a running discovery scan.
    discovery_cancel: Arc<AtomicBool>,
    /// Queue of discovered devices proposed as assets by the user.
    pending_asset_proposals: Arc<Mutex<Vec<ProposeAssetData>>>,
    /// Encrypted database for check result storage and sync services.
    db: Option<Arc<Database>>,
    /// Authenticated mTLS client for sync services.
    authenticated_client: Option<Arc<AuthenticatedClient>>,
    /// Compliance check registry with all 11 checks.
    check_registry: Arc<CheckRegistry>,
    /// Compliance check execution interval in seconds.
    compliance_check_interval_secs: u64,
    /// Config sync service for downloading server configuration.
    config_sync: RwLock<Option<ConfigSyncService>>,
    /// Rule sync service for downloading check rules.
    rule_sync: RwLock<Option<RuleSyncService>>,
    /// Result uploader for uploading check results to SaaS.
    result_uploader: RwLock<Option<ResultUploader>>,
}

/// A lightweight handle to the running agent that can be shared with the GUI
/// or other external controllers.
///
/// This provides a non-blocking interface to query runtime state and send
/// commands without owning the full `AgentRuntime`.
#[derive(Clone)]
pub struct RuntimeHandle {
    /// Shared shutdown signal.
    shutdown: ShutdownSignal,
    /// Whether the agent is currently paused.
    paused: Arc<AtomicBool>,
    /// Whether the agent is currently scanning.
    scanning: Arc<AtomicBool>,
    /// Flag to trigger an immediate vulnerability check.
    force_check: Arc<AtomicBool>,
    /// Flag to trigger an immediate sync (heartbeat + upload).
    force_sync: Arc<AtomicBool>,
    /// Flag to trigger a network discovery scan.
    force_discovery: Arc<AtomicBool>,
    /// Flag to cancel a running discovery scan.
    discovery_cancel: Arc<AtomicBool>,
    /// Queue of discovered devices proposed as assets.
    pending_asset_proposals: Arc<Mutex<Vec<ProposeAssetData>>>,
}

impl RuntimeHandle {
    /// Request agent shutdown.
    pub fn request_shutdown(&self) {
        info!("Shutdown requested via handle");
        self.shutdown.store(true, Ordering::SeqCst);
    }

    /// Check if shutdown has been requested.
    pub fn is_shutdown_requested(&self) -> bool {
        self.shutdown.load(Ordering::SeqCst)
    }

    /// Pause agent operations.
    pub fn pause(&self) {
        info!("Agent paused via handle");
        self.paused.store(true, Ordering::Release);
    }

    /// Resume agent operations.
    pub fn resume(&self) {
        info!("Agent resumed via handle");
        self.paused.store(false, Ordering::Release);
    }

    /// Check if the agent is paused.
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Acquire)
    }

    /// Check if the agent is currently scanning.
    pub fn is_scanning(&self) -> bool {
        self.scanning.load(Ordering::Acquire)
    }

    /// Trigger an immediate vulnerability check.
    pub fn trigger_check(&self) {
        info!("Immediate check requested via handle");
        self.force_check.store(true, Ordering::Release);
    }

    /// Trigger an immediate sync (heartbeat + upload).
    pub fn trigger_sync(&self) {
        info!("Immediate sync requested via handle");
        self.force_sync.store(true, Ordering::Release);
    }

    /// Trigger a network discovery scan.
    pub fn trigger_discovery(&self) {
        info!("Network discovery requested via handle");
        self.discovery_cancel.store(false, Ordering::Release);
        self.force_discovery.store(true, Ordering::Release);
    }

    /// Cancel a running network discovery scan.
    pub fn cancel_discovery(&self) {
        info!("Network discovery cancellation requested via handle");
        self.discovery_cancel.store(true, Ordering::Release);
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

    /// Get a clone of the shutdown signal.
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.shutdown.clone()
    }
}

impl AgentRuntime {
    /// Create a new agent runtime with the given configuration.
    pub fn new(config: AgentConfig) -> Self {
        let resource_monitor = ResourceMonitor::new();
        let vulnerability_scanner = VulnerabilityScanner::new();
        let security_monitor = SecurityMonitor::new();
        let network_manager = NetworkManager::new();

        // Register all 21 compliance checks
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
        let check_registry = Arc::new(registry);

        info!("Registered {} compliance checks", check_registry.count());
        info!(
            "Initialized vulnerability scanner ({} scanners available)",
            vulnerability_scanner.scanner_count()
        );
        info!("Initialized network manager with smart scheduling");

        let compliance_check_interval_secs = config.check_interval_secs;

        Self {
            config,
            shutdown: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            scanning: Arc::new(AtomicBool::new(false)),
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
            force_check: Arc::new(AtomicBool::new(false)),
            force_sync: Arc::new(AtomicBool::new(false)),
            force_discovery: Arc::new(AtomicBool::new(false)),
            discovery_cancel: Arc::new(AtomicBool::new(false)),
            pending_asset_proposals: Arc::new(Mutex::new(Vec::new())),
            db: None,
            authenticated_client: None,
            check_registry,
            compliance_check_interval_secs,
            config_sync: RwLock::new(None),
            rule_sync: RwLock::new(None),
            result_uploader: RwLock::new(None),
        }
    }

    /// Set the database and create an authenticated client for sync services.
    ///
    /// This enables compliance result storage, config/rule sync, and result upload.
    pub fn with_database(mut self, db: Arc<Database>) -> Self {
        let auth_client = Arc::new(AuthenticatedClient::new(self.config.clone(), db.clone()));
        self.db = Some(db);
        self.authenticated_client = Some(auth_client);
        self
    }

    /// Set the GUI event sender for pushing live data to the desktop UI.
    #[cfg(feature = "gui")]
    pub fn set_gui_event_tx(&mut self, tx: std::sync::mpsc::Sender<AgentEvent>) {
        self.gui_event_tx = Some(tx);
    }

    /// Emit a GUI event (no-op if GUI feature is disabled or no sender set).
    #[cfg(feature = "gui")]
    fn emit_gui_event(&self, event: AgentEvent) {
        if let Some(ref tx) = self.gui_event_tx {
            let _ = tx.send(event);
        }
    }

    /// Build and emit the current agent summary to the GUI.
    #[cfg(feature = "gui")]
    fn emit_status_update(
        &self,
        last_check_at: Option<chrono::DateTime<chrono::Utc>>,
        compliance_score: Option<f64>,
    ) {
        let usage = self.resource_monitor.get_usage();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let status = if self.is_paused() {
            GuiAgentStatus::Paused
        } else if self.scanning.load(Ordering::Acquire) {
            GuiAgentStatus::Scanning
        } else if self.authenticated_client.is_none() {
            GuiAgentStatus::Disconnected
        } else {
            GuiAgentStatus::Connected
        };

        let summary = AgentSummary {
            status,
            version: AGENT_VERSION.to_string(),
            hostname,
            agent_id: self.config.agent_id.clone(),
            organization: None,
            compliance_score: compliance_score.map(|s| s as f32),
            last_check_at,
            last_sync_at: None,
            pending_sync_count: 0,
            uptime_secs: usage.uptime_ms / 1000,
        };

        self.emit_gui_event(AgentEvent::StatusChanged { summary });
    }

    /// Emit resource usage update to the GUI.
    #[cfg(feature = "gui")]
    fn emit_resource_update(&self) {
        let usage = self.resource_monitor.get_usage();
        let sys = resources::get_system_resources();
        self.emit_gui_event(AgentEvent::ResourceUpdate {
            usage: GuiResourceUsage {
                cpu_percent: sys.cpu_percent,
                memory_percent: sys.memory_percent,
                memory_used_mb: sys.memory_used_bytes / (1024 * 1024),
                memory_total_mb: sys.memory_total_bytes / (1024 * 1024),
                disk_iops: usage.disk_iops,
                uptime_secs: usage.uptime_ms / 1000,
                disk_percent: sys.disk_percent,
            },
        });
    }

    /// Emit a notification to the GUI.
    #[cfg(feature = "gui")]
    fn emit_notification(&self, title: &str, body: &str, severity: &str) {
        self.emit_gui_event(AgentEvent::Notification {
            notification: GuiNotification {
                id: uuid::Uuid::new_v4(),
                title: title.to_string(),
                body: body.to_string(),
                severity: severity.to_string(),
                timestamp: chrono::Utc::now(),
                read: false,
                action: None,
            },
        });
    }

    /// Convert a `VulnerabilityScanResult` into a `Vec<GuiSoftwarePackage>` for the GUI.
    ///
    /// Each installed package is mapped to a `GuiSoftwarePackage`, with `up_to_date`
    /// set to `false` when at least one vulnerability references that package.
    #[cfg(feature = "gui")]
    fn build_software_packages(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Vec<GuiSoftwarePackage> {
        // Count vulnerabilities per package name for up_to_date flag
        let mut vuln_counts: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        for v in &scan_result.vulnerabilities {
            *vuln_counts.entry(v.package_name.clone()).or_insert(0) += 1;
        }

        scan_result
            .packages
            .iter()
            .map(|pkg| {
                let has_vulns = vuln_counts.contains_key(&pkg.name);
                GuiSoftwarePackage {
                    name: pkg.name.clone(),
                    version: pkg.version.clone(),
                    publisher: None,
                    installed_at: None,
                    up_to_date: !has_vulns,
                    latest_version: None,
                }
            })
            .collect()
    }

    /// Convert a `VulnerabilityScanResult` into a `Vec<GuiVulnerabilityFinding>` for the GUI.
    #[cfg(feature = "gui")]
    fn build_vulnerability_findings(
        &self,
        scan_result: &VulnerabilityScanResult,
    ) -> Vec<GuiVulnerabilityFinding> {
        scan_result
            .vulnerabilities
            .iter()
            .map(|v| GuiVulnerabilityFinding {
                cve_id: v.cve_id.clone().unwrap_or_else(|| "N/A".to_string()),
                affected_software: v.package_name.clone(),
                affected_version: v.installed_version.clone(),
                severity: format!("{}", v.severity).to_lowercase(),
                cvss_score: v.cvss_score,
                description: v.description.clone(),
                fix_available: v.available_version.is_some(),
                discovered_at: Some(v.detected_at),
            })
            .collect()
    }

    /// Convert a `CheckExecutionResult` into a `GuiCheckResult` for display in the GUI.
    ///
    /// Looks up the check definition in the registry to populate human-readable
    /// fields (name, category, severity, frameworks).
    #[cfg(feature = "gui")]
    fn execution_result_to_gui(&self, exec_result: &CheckExecutionResult) -> GuiCheckResult {
        let common_result = &exec_result.result;
        let check_id = &common_result.check_id;

        // Look up check definition for display metadata
        let (name, category, severity, frameworks) =
            if let Some(check) = self.check_registry.get(check_id) {
                let def = check.definition();
                (
                    def.name.clone(),
                    format!("{:?}", def.category).to_lowercase(),
                    format!("{:?}", def.severity).to_lowercase(),
                    def.frameworks.clone(),
                )
            } else {
                (
                    check_id.clone(),
                    "general".to_string(),
                    "medium".to_string(),
                    vec![],
                )
            };

        let status = match common_result.status {
            agent_common::types::CheckStatus::Pass => GuiCheckStatus::Pass,
            agent_common::types::CheckStatus::Fail => GuiCheckStatus::Fail,
            agent_common::types::CheckStatus::Error => GuiCheckStatus::Error,
            agent_common::types::CheckStatus::Skipped => GuiCheckStatus::Skipped,
            agent_common::types::CheckStatus::Pending => GuiCheckStatus::Pending,
        };

        let score = match common_result.status {
            agent_common::types::CheckStatus::Pass => Some(100),
            agent_common::types::CheckStatus::Fail => Some(0),
            _ => None,
        };

        GuiCheckResult {
            check_id: check_id.clone(),
            name,
            category,
            status,
            severity,
            score,
            message: common_result.message.clone(),
            details: if common_result.details != serde_json::Value::Null {
                Some(common_result.details.clone())
            } else {
                None
            },
            executed_at: Some(common_result.executed_at),
            frameworks,
        }
    }

    /// Convert a network snapshot into GUI DTOs for the Network page.
    #[cfg(feature = "gui")]
    fn snapshot_to_gui_network(
        snapshot: &agent_network::types::NetworkSnapshot,
    ) -> (Vec<GuiNetworkInterface>, Vec<GuiNetworkConnection>) {
        use agent_network::types::{
            ConnectionProtocol, ConnectionState, InterfaceStatus, InterfaceType,
        };

        let interfaces = snapshot
            .interfaces
            .iter()
            .map(|iface| GuiNetworkInterface {
                name: iface.name.clone(),
                mac_address: iface.mac_address.clone(),
                ipv4_addresses: iface.ipv4_addresses.clone(),
                status: match iface.status {
                    InterfaceStatus::Up => "up".to_string(),
                    InterfaceStatus::Down => "down".to_string(),
                    InterfaceStatus::Unknown => "unknown".to_string(),
                },
                interface_type: match iface.interface_type {
                    InterfaceType::Ethernet => "Ethernet".to_string(),
                    InterfaceType::WiFi => "Wi-Fi".to_string(),
                    InterfaceType::Loopback => "Loopback".to_string(),
                    InterfaceType::Virtual => "Virtual".to_string(),
                    InterfaceType::Vpn => "VPN".to_string(),
                    InterfaceType::Bridge => "Bridge".to_string(),
                    InterfaceType::Unknown => "Inconnu".to_string(),
                },
            })
            .collect();

        let connections = snapshot
            .connections
            .iter()
            .map(|conn| GuiNetworkConnection {
                protocol: match conn.protocol {
                    ConnectionProtocol::Tcp | ConnectionProtocol::Tcp6 => "TCP".to_string(),
                    ConnectionProtocol::Udp | ConnectionProtocol::Udp6 => "UDP".to_string(),
                },
                local_address: conn.local_address.clone(),
                local_port: conn.local_port,
                remote_address: conn.remote_address.clone(),
                remote_port: conn.remote_port,
                state: match conn.state {
                    ConnectionState::Established => "ESTABLISHED".to_string(),
                    ConnectionState::Listen => "LISTEN".to_string(),
                    ConnectionState::TimeWait => "TIME_WAIT".to_string(),
                    ConnectionState::CloseWait => "CLOSE_WAIT".to_string(),
                    ConnectionState::SynSent => "SYN_SENT".to_string(),
                    ConnectionState::SynReceived => "SYN_RECV".to_string(),
                    ConnectionState::FinWait1 => "FIN_WAIT1".to_string(),
                    ConnectionState::FinWait2 => "FIN_WAIT2".to_string(),
                    ConnectionState::Closing => "CLOSING".to_string(),
                    ConnectionState::LastAck => "LAST_ACK".to_string(),
                    ConnectionState::Closed => "CLOSED".to_string(),
                    ConnectionState::Unknown => "UNKNOWN".to_string(),
                },
                process_name: conn.process_name.clone(),
            })
            .collect();

        (interfaces, connections)
    }

    /// Get a lightweight handle to the runtime for sharing with the GUI or
    /// other controllers.
    pub fn handle(&self) -> RuntimeHandle {
        RuntimeHandle {
            shutdown: self.shutdown.clone(),
            paused: self.paused.clone(),
            scanning: self.scanning.clone(),
            force_check: self.force_check.clone(),
            force_sync: self.force_sync.clone(),
            force_discovery: self.force_discovery.clone(),
            discovery_cancel: self.discovery_cancel.clone(),
            pending_asset_proposals: self.pending_asset_proposals.clone(),
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

    /// Check if the agent is paused.
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Acquire)
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

            // Try to restore organization ID from stored credentials
            if let Some(ref db) = self.db {
                let auth_client =
                    agent_sync::AuthenticatedClient::new(self.config.clone(), db.clone());
                if let Ok(organization_id) = auth_client.organization_id().await {
                    client.set_organization_id(organization_id.to_string());
                    info!("Restored organization ID: {}", organization_id);
                }
            }

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

        // Store organization ID in API client for subsequent requests
        {
            let mut api_client = self.api_client.write().await;
            if let Some(client) = api_client.as_mut() {
                client.set_organization_id(response.organization_id.clone());
            }
        }

        info!(
            "Enrolled successfully. Agent ID: {}, Organization ID: {}, Heartbeat interval: {}s",
            response.agent_id, response.organization_id, response.config.heartbeat_interval_secs
        );

        Ok(())
    }

    /// Send a heartbeat to the server with real compliance data.
    ///
    /// Processes the server response: commands, config/rules sync triggers.
    async fn send_heartbeat(
        &self,
        compliance_score: Option<f64>,
        last_compliance_check: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let usage = self.resource_monitor.get_usage();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let pending_sync_count = self.get_pending_sync_count().await as u32;

        let sys_res = resources::get_system_resources();
        let request = HeartbeatRequest {
            timestamp: chrono::Utc::now().to_rfc3339(),
            agent_version: AGENT_VERSION.to_string(),
            status: "online".to_string(),
            hostname,
            os_info: format!("{} {}", std::env::consts::OS, get_os_version()),
            cpu_percent: usage.cpu_percent,
            memory_bytes: usage.memory_bytes,
            memory_percent: sys_res.memory_percent,
            memory_total_bytes: sys_res.memory_total_bytes,
            disk_percent: sys_res.disk_percent,
            disk_used_bytes: sys_res.disk_used_bytes,
            disk_total_bytes: sys_res.disk_total_bytes,
            uptime_seconds: usage.uptime_ms / 1000,
            ip_address: None,
            last_check_at: last_compliance_check.map(|dt| dt.to_rfc3339()),
            compliance_score,
            pending_sync_count,
            self_check_result: None,
        };

        let response = client.send_heartbeat(request).await?;

        // Process server commands
        for cmd in &response.commands {
            match cmd.command_type.as_str() {
                "force_sync" => {
                    info!("Server command: force_sync ({})", cmd.id);
                    self.force_sync.store(true, Ordering::Release);
                }
                "run_checks" => {
                    info!("Server command: run_checks ({})", cmd.id);
                    self.force_check.store(true, Ordering::Release);
                }
                "revoke" => {
                    warn!("Server command: revoke agent credentials ({})", cmd.id);
                    self.request_shutdown();
                }
                "diagnostics" => {
                    info!("Server command: diagnostics ({})", cmd.id);
                    // TODO: Collect and upload diagnostics
                }
                "update" => {
                    info!("Server command: update ({})", cmd.id);
                    // TODO: Trigger self-update
                }
                other => {
                    warn!("Unknown server command: {} ({})", other, cmd.id);
                }
            }
        }

        // React to config changes
        if response.config_changed {
            info!("Server indicates configuration has changed, syncing...");
            self.apply_config_changes().await;
        }

        // React to rules changes
        if response.rules_changed {
            info!("Server indicates rules have changed, syncing...");
            let rule_sync = self.rule_sync.read().await;
            if let Some(ref rule_sync) = *rule_sync {
                match rule_sync.sync_rules().await {
                    Ok(result) => info!("Rule sync complete: {} rules synced", result.rules_synced),
                    Err(e) => warn!("Rule sync failed: {}", e),
                }
            }
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

        #[cfg(feature = "gui")]
        self.emit_gui_event(AgentEvent::SyncStatus {
            syncing: false,
            pending_count: 0,
            last_sync_at: Some(chrono::Utc::now()),
            error: None,
        });

        Ok(())
    }

    /// Upload software inventory from a vulnerability scan result.
    async fn upload_software_from_scan(&self, scan_result: &VulnerabilityScanResult) {
        if scan_result.packages.is_empty() {
            debug!("No packages to upload for software inventory");
            return;
        }

        let software: Vec<api_client::SoftwareEntry> = scan_result
            .packages
            .iter()
            .map(|p| api_client::SoftwareEntry {
                name: p.name.clone(),
                version: p.version.clone(),
                vendor: None,
            })
            .collect();

        let api_client = self.api_client.read().await;
        if let Some(ref client) = *api_client {
            match client.upload_software_inventory(&software).await {
                Ok(_) => {
                    info!("Uploaded software inventory: {} packages", software.len());
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: Some(chrono::Utc::now()),
                        error: None,
                    });
                }
                Err(e) => {
                    warn!("Failed to upload software inventory: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: None,
                        error: Some(format!("Software upload failed: {}", e)),
                    });
                }
            }
        }
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

    /// Collect network information and run security detection.
    async fn run_network_collection(&self) -> Result<NetworkSnapshot, CommonError> {
        debug!("Collecting network information...");

        let network_manager = self.network_manager.read().await;
        let snapshot = network_manager
            .collect_snapshot()
            .await
            .map_err(|e| CommonError::config(format!("Network collection failed: {}", e)))?;

        info!(
            "Network collection complete: {} interfaces, {} connections, {} routes",
            snapshot.interfaces.len(),
            snapshot.connections.len(),
            snapshot.routes.len()
        );

        Ok(snapshot)
    }

    /// Run network security detection.
    async fn run_network_security_detection(
        &self,
        snapshot: &NetworkSnapshot,
    ) -> Result<Vec<NetworkSecurityAlert>, CommonError> {
        debug!("Running network security detection...");

        let network_manager = self.network_manager.read().await;
        let alerts = network_manager
            .detect_threats(&snapshot.connections)
            .await
            .map_err(|e| CommonError::config(format!("Network detection failed: {}", e)))?;

        if !alerts.is_empty() {
            warn!("Network security detection found {} alerts", alerts.len());
            for alert in &alerts {
                info!(
                    "Network alert: {} (severity: {:?}, confidence: {}%)",
                    alert.title, alert.severity, alert.confidence
                );
            }
        } else {
            debug!("Network security detection clean");
        }

        Ok(alerts)
    }

    /// Upload network snapshot to the server.
    async fn upload_network_snapshot(&self, snapshot: &NetworkSnapshot) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "timestamp": snapshot.timestamp.to_rfc3339(),
            "interfaces": snapshot.interfaces,
            "connections": snapshot.connections,
            "routes": snapshot.routes,
            "dns": snapshot.dns,
            "primary_ip": snapshot.primary_ip,
            "primary_mac": snapshot.primary_mac,
            "hash": snapshot.hash,
        });

        let url = format!("/v1/agents/{}/network", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        debug!("Uploaded network snapshot");
        Ok(())
    }

    /// Run all compliance checks, calculate score, store results in DB.
    ///
    /// Returns the execution results and the calculated compliance score.
    async fn run_compliance_checks(&self) -> (Vec<CheckExecutionResult>, ComplianceScore) {
        info!("Running compliance checks...");

        let runner = CheckRunner::with_defaults(self.check_registry.clone());
        let results = runner.run_all().await;

        let summary = ScanSummary::from_results(&results, 0);
        info!(
            "Compliance checks complete: {} passed, {} failed, {} errors out of {} total",
            summary.passed, summary.failed, summary.errors, summary.total_checks
        );

        // Build score inputs from results + check definitions
        let score_inputs: Vec<CheckScoreInput> = results
            .iter()
            .map(|exec_result| {
                let check_id = &exec_result.result.check_id;
                let check = self.check_registry.get(check_id);
                let (severity, category, frameworks) = match check {
                    Some(c) => {
                        let def = c.definition();
                        (
                            def.severity,
                            format!("{:?}", def.category).to_lowercase(),
                            def.frameworks.clone(),
                        )
                    }
                    None => (CheckSeverity::Medium, "general".to_string(), vec![]),
                };
                CheckScoreInput {
                    result: exec_result.result.clone(),
                    severity,
                    category,
                    frameworks,
                }
            })
            .collect();

        // Calculate weighted compliance score
        let calculator = ScoreCalculator::new();
        let score = calculator.calculate(&score_inputs);

        info!(
            "Compliance score: {:.1}% (passed: {}, failed: {}, errors: {})",
            score.score, score.passed_count, score.failed_count, score.error_count
        );

        (results, score)
    }

    /// Store compliance check results in the local database.
    async fn store_check_results(&self, results: &[CheckExecutionResult]) {
        let db = match self.db {
            Some(ref db) => db,
            None => {
                debug!("No database available, skipping check result storage");
                return;
            }
        };

        let repo = CheckResultsRepository::new(db);
        let mut stored = 0;

        for exec_result in results {
            let common_result = &exec_result.result;

            // Convert agent_common::types::CheckStatus to agent_storage::CheckStatus
            let storage_status = match common_result.status {
                agent_common::types::CheckStatus::Pass => StorageCheckStatus::Pass,
                agent_common::types::CheckStatus::Fail => StorageCheckStatus::Fail,
                agent_common::types::CheckStatus::Error => StorageCheckStatus::Error,
                agent_common::types::CheckStatus::Skipped => StorageCheckStatus::Skip,
                agent_common::types::CheckStatus::Pending => StorageCheckStatus::Skip,
            };

            // Build storage check result
            let mut storage_result =
                StorageCheckResult::new(&common_result.check_id, storage_status);

            if let Some(ref msg) = common_result.message {
                storage_result = storage_result.with_message(msg.clone());
            }

            // Serialize details to raw_data JSON string
            if common_result.details != serde_json::Value::Null
                && let Ok(json_str) = serde_json::to_string(&common_result.details)
            {
                storage_result = storage_result.with_raw_data(json_str);
            }

            storage_result = storage_result.with_duration_ms(common_result.duration_ms as i64);

            match repo.insert(&storage_result).await {
                Ok(_) => stored += 1,
                Err(e) => warn!(
                    "Failed to store check result for {}: {}",
                    common_result.check_id, e
                ),
            }
        }

        info!("Stored {} check results in database", stored);
    }

    /// Upload pending check results to the SaaS platform.
    async fn upload_check_results(&self) {
        let uploader = self.result_uploader.read().await;
        if let Some(ref uploader) = *uploader {
            match uploader.upload_pending().await {
                Ok(result) => {
                    if result.uploaded > 0 {
                        info!("Uploaded {} check results to server", result.uploaded);
                    }
                }
                Err(e) => warn!("Failed to upload check results: {}", e),
            }
        }
    }

    /// Initialize sync services after enrollment is verified.
    async fn init_sync_services(&self) {
        let (db, auth_client) = match (&self.db, &self.authenticated_client) {
            (Some(db), Some(client)) => (db.clone(), client.clone()),
            _ => {
                debug!(
                    "Database or authenticated client not available, skipping sync service init"
                );
                return;
            }
        };

        // Initialize config sync
        let config_sync = ConfigSyncService::new(auth_client.clone(), db.clone());
        *self.config_sync.write().await = Some(config_sync);

        // Initialize rule sync
        let rule_sync = RuleSyncService::new(auth_client.clone(), db.clone());
        *self.rule_sync.write().await = Some(rule_sync);

        // Initialize result uploader
        let result_uploader = ResultUploader::new(auth_client.clone(), db.clone());
        *self.result_uploader.write().await = Some(result_uploader);

        info!("Initialized sync services (config, rules, results)");

        // Seed built-in check rules so the FK constraint is satisfied
        // even when rule sync fails (e.g. certificate error).
        self.seed_builtin_check_rules().await;

        // Initial rule sync (will overwrite built-in rules with server versions)
        if let Some(ref rule_sync) = *self.rule_sync.read().await {
            match rule_sync.sync_if_needed().await {
                Ok(result) => info!(
                    "Initial rule sync: {} rules synced (cache_hit: {})",
                    result.rules_synced, result.cache_hit
                ),
                Err(e) => warn!("Initial rule sync failed: {}", e),
            }
        }
    }

    /// Pre-seed the check_rules table with the 11 built-in compliance checks.
    ///
    /// This ensures the FOREIGN KEY constraint on check_results.check_rule_id
    /// is satisfied even when rule sync from the SaaS server fails.
    async fn seed_builtin_check_rules(&self) {
        let db = match self.db {
            Some(ref db) => db,
            None => return,
        };

        let repo = CheckRulesRepository::new(db);
        let checks = self.check_registry.all();

        let rules: Vec<StorageCheckRule> = checks
            .iter()
            .map(|check| {
                let def = check.definition();
                let severity = match def.severity {
                    CheckSeverity::Critical => StorageSeverity::Critical,
                    CheckSeverity::High => StorageSeverity::High,
                    CheckSeverity::Medium => StorageSeverity::Medium,
                    CheckSeverity::Low => StorageSeverity::Low,
                    CheckSeverity::Info => StorageSeverity::Info,
                };
                StorageCheckRule::new(
                    &def.id,
                    &def.name,
                    format!("{:?}", def.category).to_lowercase(),
                    severity,
                    &def.id,
                    "builtin-1.0",
                )
                .with_description(&def.description)
                .with_frameworks(def.frameworks.clone())
            })
            .collect();

        match repo.upsert_batch(&rules).await {
            Ok(count) => info!("Seeded {} built-in check rules into database", count),
            Err(e) => warn!("Failed to seed built-in check rules: {}", e),
        }
    }

    /// Apply configuration changes received from the server.
    async fn apply_config_changes(&self) {
        let config_sync = self.config_sync.read().await;
        if let Some(ref config_sync) = *config_sync {
            match config_sync.sync_config().await {
                Ok(result) => {
                    if result.changed {
                        info!(
                            "Config sync: {} added, {} updated, {} skipped",
                            result.added, result.updated, result.skipped
                        );

                        // Apply heartbeat interval change if present
                        if let Ok(Some(interval)) = config_sync
                            .get_config::<u64>(agent_sync::config_keys::HEARTBEAT_INTERVAL_SECS)
                            .await
                        {
                            let mut current = self.heartbeat_interval_secs.write().await;
                            if *current != interval {
                                info!("Heartbeat interval updated: {}s → {}s", *current, interval);
                                *current = interval;
                            }
                        }
                    } else {
                        debug!("Config sync: no changes");
                    }
                }
                Err(e) => warn!("Config sync failed: {}", e),
            }
        }
    }

    /// Get the count of pending sync items for the heartbeat.
    async fn get_pending_sync_count(&self) -> i64 {
        let uploader = self.result_uploader.read().await;
        if let Some(ref uploader) = *uploader {
            uploader.pending_count().await.unwrap_or(0)
        } else {
            0
        }
    }

    /// Upload network security alert to the server.
    async fn upload_network_alert(&self, alert: &NetworkSecurityAlert) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "alert_type": format!("{:?}", alert.alert_type),
            "severity": format!("{:?}", alert.severity),
            "title": alert.title,
            "description": alert.description,
            "connection": alert.connection,
            "evidence": alert.evidence,
            "confidence": alert.confidence,
            "detected_at": alert.detected_at.to_rfc3339(),
            "iocs_matched": alert.iocs_matched,
        });

        let url = format!("/v1/agents/{}/network/alerts", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!(
            "Reported network alert '{}' (severity: {:?})",
            alert.title, alert.severity
        );

        Ok(())
    }

    /// Upload a proposed asset (discovered device) to the server.
    async fn upload_proposed_asset(&self, proposal: &ProposeAssetData) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let agent_id = client
            .agent_id()
            .ok_or_else(|| CommonError::config("Agent not enrolled"))?;

        let payload = serde_json::json!({
            "ip": proposal.ip,
            "hostname": proposal.hostname,
            "device_type": proposal.device_type,
            "source": "agent_discovery",
        });

        let url = format!("/v1/agents/{}/discovered-assets", agent_id);
        let _response: serde_json::Value = client.post(&url, &payload).await?;

        info!("Proposed discovered device {} as asset", proposal.ip);

        #[cfg(feature = "gui")]
        self.emit_notification(
            "Actif proposé",
            &format!("Appareil {} proposé comme actif", proposal.ip),
            "info",
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

        // Emit initial GUI state
        #[cfg(feature = "gui")]
        {
            self.emit_status_update(None, None);
            self.emit_resource_update();
        }

        // Track last operation times
        let mut last_heartbeat = std::time::Instant::now();
        let mut last_vuln_scan = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(self.vuln_scan_interval_secs))
            .unwrap_or_else(std::time::Instant::now);
        // Compliance check timer: trigger immediately on first loop
        let mut last_compliance_check_time = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(
                self.compliance_check_interval_secs,
            ))
            .unwrap_or_else(std::time::Instant::now);
        // Certificate renewal timer (daily)
        let mut last_cert_check = std::time::Instant::now();
        let cert_check_interval_secs: u64 = 24 * 3600;
        #[cfg(feature = "gui")]
        let mut last_check_at: Option<chrono::DateTime<chrono::Utc>> = None;
        #[cfg(feature = "gui")]
        let mut last_gui_resource_update = std::time::Instant::now();

        let heartbeat_interval = *self.heartbeat_interval_secs.read().await;

        // Run initial security scan on startup (quick check)
        info!("Running initial security scan...");
        if let Err(e) = self.run_security_scan().await {
            warn!("Initial security scan failed: {}", e);
        }
        let mut last_security_scan = std::time::Instant::now();

        // Initialize network collection with staggered start
        let (network_static_interval, network_connection_interval, network_security_interval) = {
            let mut network_manager = self.network_manager.write().await;
            // Get initial intervals with jitter
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

        // Main agent loop
        while !self.is_shutdown_requested() {
            let mut is_active = false;

            // Check resource limits periodically (warnings are rate-limited inside check_limits)
            self.resource_monitor.check_limits(is_active);

            // Send heartbeat if interval has passed
            if last_heartbeat.elapsed().as_secs() >= heartbeat_interval {
                match self
                    .send_heartbeat(compliance_score, last_compliance_check_at)
                    .await
                {
                    Ok(()) => {
                        debug!("Heartbeat sent successfully");
                        #[cfg(feature = "gui")]
                        self.emit_notification("Heartbeat", "Heartbeat envoyé avec succès", "info");
                    }
                    Err(e) => {
                        warn!("Failed to send heartbeat: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
                    }
                }
                last_heartbeat = std::time::Instant::now();
                // Update GUI with latest status and resources
                #[cfg(feature = "gui")]
                {
                    self.emit_status_update(last_check_at, compliance_score);
                    self.emit_resource_update();
                }
            }

            // Run vulnerability scan if interval has passed
            if last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs {
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.scanning.store(true, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score);
                }
                match self.run_vulnerability_scan().await {
                    Ok(result) => {
                        let count = result.vulnerabilities.len();
                        if count > 0 {
                            info!("Vulnerability scan found {} issues", count);
                        }
                        // Upload full software inventory to server
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
                            // Emit vulnerability summary to GUI
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
                            // Emit software inventory and vulnerability findings to GUI
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
                self.scanning.store(false, Ordering::Release);
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
                            self.emit_notification(
                                "Incidents de sécurité détectés",
                                &format!("{} incident(s) détecté(s)", count),
                                "error",
                            );
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
                                interfaces_count: snapshot.interfaces.len() as u32,
                                connections_count: snapshot.connections.len() as u32,
                                alerts_count: 0,
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
                    }
                }
                last_network_static = std::time::Instant::now();
                // Get next jittered interval
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
                                interfaces_count: snapshot.interfaces.len() as u32,
                                connections_count: snapshot.connections.len() as u32,
                                alerts_count: 0,
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
                        // Only upload connections portion
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
                                    alert_count = alerts.len() as u32;
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
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: snapshot.interfaces.len() as u32,
                                connections_count: snapshot.connections.len() as u32,
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
                    }
                }
                last_network_security = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                current_network_security_interval = network_manager.next_security_interval();
            }

            // Run compliance checks if interval has passed
            if last_compliance_check_time.elapsed().as_secs() >= self.compliance_check_interval_secs
            {
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.scanning.store(true, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score);
                }

                let (check_results, score) = self.run_compliance_checks().await;
                compliance_score = Some(score.score);
                last_compliance_check_at = Some(chrono::Utc::now());

                // Store in database and upload to server
                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                #[cfg(feature = "gui")]
                {
                    // Emit individual check results to GUI
                    for exec_result in &check_results {
                        let gui_result = self.execution_result_to_gui(exec_result);
                        self.emit_gui_event(AgentEvent::CheckCompleted { result: gui_result });
                    }
                    last_check_at = Some(chrono::Utc::now());
                    self.scanning.store(false, Ordering::Release);
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
                    self.emit_status_update(last_check_at, compliance_score);
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
            if self.force_check.swap(false, Ordering::AcqRel) {
                info!("Force check triggered");
                is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.scanning.store(true, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score);
                }

                // Run vulnerability scan
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
                            // Emit vulnerability summary to GUI
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
                            // Emit software inventory and vulnerability findings to GUI
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

                // Also run compliance checks
                let (check_results, score) = self.run_compliance_checks().await;
                compliance_score = Some(score.score);
                last_compliance_check_at = Some(chrono::Utc::now());
                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                #[cfg(feature = "gui")]
                {
                    // Emit individual check results to GUI
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
                    self.scanning.store(false, Ordering::Release);
                    self.emit_status_update(last_check_at, compliance_score);
                }
                last_vuln_scan = std::time::Instant::now();
                last_compliance_check_time = std::time::Instant::now();
            }

            // Check for force_sync flag (GUI "Forcer la synchronisation" button)
            if self.force_sync.swap(false, Ordering::AcqRel) {
                info!("Force sync triggered");
                #[cfg(feature = "gui")]
                self.emit_gui_event(AgentEvent::SyncStatus {
                    syncing: true,
                    pending_count: 0,
                    last_sync_at: None,
                    error: None,
                });

                // Upload any pending check results first
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
                    self.emit_status_update(last_check_at, compliance_score);
                    self.emit_resource_update();
                }
            }

            // Check for force_discovery flag (GUI network discovery)
            #[cfg(feature = "gui")]
            if self.force_discovery.swap(false, Ordering::AcqRel) {
                info!("Network discovery scan triggered");
                let cancel = self.discovery_cancel.clone();

                if let Some(ref tx) = self.gui_event_tx {
                    let tx = tx.clone();

                    // Determine subnet from primary IP
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

                        // Link the external cancel flag to the discovery cancel handle
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

                        let _ = tx.send(AgentEvent::DiscoveryProgress {
                            phase: "Scan ARP en cours...".to_string(),
                            progress: 0.1,
                            devices_found: 0,
                        });

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
                                let _ = tx.send(AgentEvent::DiscoveryUpdate { devices });
                            }
                            Err(e) => {
                                warn!("Discovery scan failed: {}", e);
                                let _ = tx.send(AgentEvent::DiscoveryProgress {
                                    phase: format!("Erreur: {}", e),
                                    progress: 0.0,
                                    devices_found: 0,
                                });
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

            // Update resource limits check with active status
            if is_active {
                self.resource_monitor.check_limits(is_active);
            }

            // Periodically push resource usage to the GUI (every 5 seconds)
            #[cfg(feature = "gui")]
            if last_gui_resource_update.elapsed().as_secs() >= 5 {
                self.emit_resource_update();
                last_gui_resource_update = std::time::Instant::now();
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
            // Check every second instead of 100ms to reduce CPU overhead
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
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

/// Initialize logging with the GUI terminal bridge.
///
/// Returns the [`GuiTracingBridge`] so the caller can later set the GUI
/// event sender via [`GuiTracingBridge::set_sender`].
#[cfg(feature = "gui")]
pub fn init_logging_with_terminal(log_level: &str) -> tracing_layer::GuiTracingBridge {
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};

    let bridge = tracing_layer::GuiTracingBridge::new();
    let gui_layer = tracing_layer::GuiTracingLayer::new(&bridge);

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level));

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(gui_layer)
        .with(filter)
        .init();

    bridge
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
