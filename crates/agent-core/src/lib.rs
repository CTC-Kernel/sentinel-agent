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
#[cfg(feature = "gui")]
pub mod llm_stream;
pub mod logging;
mod main_loop;
pub mod resources;
pub mod self_protection;
pub mod service;
pub mod siem_enrichment;
#[cfg(feature = "voice")]
pub mod sounds;
pub mod state;
#[cfg(feature = "gui")]
pub mod sync_converters;
pub mod system_utils;
pub mod tracing_layer;
pub mod update_manager;
#[cfg(feature = "voice")]
pub mod voice;

/// Stub module so that `agent_core::voice::VoiceService` is always a valid type,
/// regardless of whether the `voice` feature is enabled.
#[cfg(not(feature = "voice"))]
pub mod voice {
    /// No-op VoiceService used when the `voice` feature is disabled.
    /// This type is never instantiated (voice_service = None) but must exist for type resolution.
    pub struct VoiceService;
    impl VoiceService {
        pub async fn start_listening(&self) {}
        pub fn speak(&self, _text: &str) {}
    }
}

// Domain modules (impl AgentRuntime split)
mod asset_sync;
mod compliance;
mod configure_cmd;
pub mod edr_actions;
mod enrollment;
mod gui_bridge;
mod heartbeat;
pub mod host_isolation;
pub mod mdm;
mod network_ops;
pub mod playbook_engine;
pub mod privileged;
mod process_telemetry;
mod ransomware_canary;
pub mod threat_intel_feeds;
#[cfg(feature = "gui")]
pub use scanning::export_sbom;
mod remediation_ops;
mod risk_generation;
mod scanning;
mod self_update;
mod sync_init;
pub mod threat_pipeline;
pub mod triage_allowlist;
mod vuln_upload;
mod yara_scan;

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
    GuiDiscoveredDevice, GuiPolicySummary, GuiSuspiciousProcess, GuiUsbEvent,
    GuiVulnerabilitySummary, UsbEventType as GuiUsbEventType,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;

/// Register every built-in compliance check into `registry`.
///
/// This is the single source of truth for which checks ship with the agent, so
/// the runtime and the framework-coherence tests observe an identical set
/// (21 base + 5 directory + 4 hardening + 4 advanced = 34 total).
pub fn register_builtin_checks(registry: &mut CheckRegistry) {
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
}

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

/// Interval between background checks of the release catalog (6 hours).
const UPDATE_CHECK_INTERVAL_SECS: u64 = 6 * 60 * 60;

/// Delay before the first background update check after start-up, so a
/// freshly installed or relaunched agent settles before looking again.
const FIRST_UPDATE_CHECK_DELAY_SECS: u64 = 2 * 60;

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
    api_client: Arc<RwLock<Option<ApiClient>>>,
    /// Heartbeat interval in seconds (dynamic).
    heartbeat_interval_secs: RwLock<u64>,
    /// Vulnerability scanner for package vulnerability detection.
    vulnerability_scanner: Arc<VulnerabilityScanner>,
    /// Security monitor for incident detection.
    security_monitor: SecurityMonitor,
    /// USB device monitor for tracking connections/disconnections.
    usb_monitor: std::sync::Mutex<UsbMonitor>,
    /// Network manager for network collection and detection.
    network_manager: RwLock<NetworkManager>,
    /// Network alerts recently uploaded (re-upload cooldown).
    network_alert_cooldown: std::sync::Mutex<agent_network::detection::AlertCooldown>,
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
    /// Threat intelligence pushed by the platform through configuration sync.
    platform_threat_intel: RwLock<Option<agent_network::ThreatIntelligence>>,
    /// Threat intelligence of the configured indicator feeds.
    feed_threat_intel: RwLock<Option<agent_network::ThreatIntelligence>>,
    /// Fresh feed intelligence waiting for the main loop to apply it.
    pending_feed_intel: threat_intel_feeds::PendingIntel,
    /// YARA helper (`None`: not installed, or no rules).
    yara: std::sync::Mutex<Option<agent_scanner::security::yara::YaraScanner>>,
    /// Source of process start events (`None`: option off or unavailable).
    process_telemetry: std::sync::Mutex<Option<process_telemetry::ProcessTelemetry>>,
    /// Tampered ransomware canary folders (`None`: protection off).
    canary_rx: tokio::sync::Mutex<Option<mpsc::Receiver<agent_fim::canary::CanaryIncident>>>,
    /// Stops the current ransomware canary watcher (one flag per start).
    canary_shutdown: std::sync::Mutex<Arc<std::sync::atomic::AtomicBool>>,
    /// LLM service for AI-powered analysis (feature-gated).
    #[cfg(feature = "llm")]
    llm_service: Option<Arc<llm_service::LLMService>>,
    /// Voice service for auditory feedback and speech interface.
    #[cfg(feature = "voice")]
    voice_service: Option<Arc<voice::VoiceService>>,
    /// Consecutive authentication failure count for re-enrollment tracking.
    auth_failure_count: std::sync::atomic::AtomicU32,
    re_enrollment_attempts: std::sync::atomic::AtomicU32,
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

    /// Replace the local triage authorizations applied to notifications,
    /// detection rules and playbooks.
    pub fn set_allowlist_rules(&self, rules: Vec<agent_gui::dto::AllowlistRule>) {
        info!(
            "Triage authorizations updated via handle: {} rule(s)",
            rules.len()
        );
        self.state.set_allowlist_rules(rules);
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
        self.state
            .siem_enabled
            .store(enabled, std::sync::atomic::Ordering::Release);
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

    /// Trigger an AI-generated remediation.
    pub fn apply_ai_remediation(&self, action: agent_common::types::RemediationAction) {
        if let Err(e) = self
            .state
            .remediation_tx
            .try_send(state::RemediationRequest::ApplyAi { action })
        {
            warn!("Failed to send AI remediation request: {}", e);
        }
    }

    /// Get a clone of the shutdown signal.
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.state.shutdown.clone()
    }

    /// Signal LLM loaded/unloaded from the handle (e.g., from the command processor).
    pub fn set_llm_loaded(&self, loaded: bool) {
        self.state
            .llm_loaded
            .store(loaded, std::sync::atomic::Ordering::Release);
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
        let vulnerability_scanner = VulnerabilityScanner::new().with_exploit_intel_cache(
            AgentConfig::platform_data_dir()
                .join("cache")
                .join("exploit-intel"),
        );
        let mut security_monitor = SecurityMonitor::new();
        let sigma =
            security_monitor.load_sigma_rules(&AgentConfig::platform_data_dir().join("sigma.d"));
        if sigma.loaded > 0 || !sigma.errors.is_empty() {
            info!(
                "Sigma rules: {} loaded, {} for another log source or system, {} refused",
                sigma.loaded,
                sigma.not_applicable,
                sigma.errors.len()
            );
        }
        for error in &sigma.errors {
            warn!("Sigma rule not loaded: {}", error);
        }
        let usb_monitor = UsbMonitor::new();
        let network_manager = NetworkManager::new();

        let (state, rx) = state::RuntimeState::new();
        state.set_check_interval(config.check_interval_secs);
        state
            .ransomware_canaries
            .store(config.ransomware_canaries, Ordering::Release);
        let state = Arc::new(state);
        let (events_mgr, _rx) = events::EventManager::new(None);
        let events = Arc::new(events_mgr);

        // Register all compliance checks (21 base + 5 directory + 4 hardening + 4 advanced = 34 total)
        let mut registry = CheckRegistry::new();
        register_builtin_checks(&mut registry);
        // The organisation's own checks, declared in TOML files.
        agent_scanner::checks::custom::register_custom_checks(
            &mut registry,
            &AgentConfig::platform_data_dir().join("checks.d"),
        );

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
            api_client: Arc::new(RwLock::new(None)),
            heartbeat_interval_secs: RwLock::new(DEFAULT_HEARTBEAT_INTERVAL_SECS),
            vulnerability_scanner: Arc::new(vulnerability_scanner),
            security_monitor,
            usb_monitor: std::sync::Mutex::new(usb_monitor),
            network_manager: RwLock::new(network_manager),
            network_alert_cooldown: std::sync::Mutex::new(
                agent_network::detection::AlertCooldown::default(),
            ),
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
            platform_threat_intel: RwLock::new(None),
            feed_threat_intel: RwLock::new(None),
            pending_feed_intel: Arc::new(std::sync::Mutex::new(None)),
            yara: std::sync::Mutex::new(None),
            process_telemetry: std::sync::Mutex::new(None),
            canary_rx: tokio::sync::Mutex::new(None),
            canary_shutdown: std::sync::Mutex::new(Arc::new(std::sync::atomic::AtomicBool::new(
                false,
            ))),
            organization_name: RwLock::new(None),
            #[cfg(feature = "llm")]
            llm_service: None,
            #[cfg(feature = "voice")]
            voice_service: None,
            auth_failure_count: std::sync::atomic::AtomicU32::new(0),
            re_enrollment_attempts: std::sync::atomic::AtomicU32::new(0),
            last_re_enrollment_attempt: std::sync::atomic::AtomicU64::new(0),
        }
    }

    /// Set the database and create an authenticated client for sync services.
    pub fn with_database(mut self, db: Arc<Database>) -> Self {
        self.db = Some(db.clone());
        // A standalone agent has no platform to authenticate against: with no
        // client, every upload and sync path in the runtime stays dormant.
        if !self.config.standalone {
            let auth_client = Arc::new(AuthenticatedClient::new(self.config.0.clone(), db.clone()));
            self.authenticated_client = Some(auth_client);
        }

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

    /// Set the voice service for holographic feedback.
    #[cfg(feature = "voice")]
    pub fn with_voice_service(mut self, service: Arc<voice::VoiceService>) -> Self {
        self.voice_service = Some(service);
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

    /// Signal that the LLM model is loaded/unloaded, adjusting memory limits.
    pub fn set_llm_loaded(&self, loaded: bool) {
        self.resource_monitor.set_llm_loaded(loaded);
        self.state.llm_loaded.store(loaded, Ordering::Release);
        if loaded {
            info!(
                "LLM model loaded — resource memory limit raised to {}MB",
                self.resource_monitor.effective_memory_limit() / (1024 * 1024)
            );
        } else {
            info!(
                "LLM model unloaded — resource memory limit restored to {}MB",
                self.resource_monitor.effective_memory_limit() / (1024 * 1024)
            );
        }
    }

    /// Wait for shutdown signal.
    async fn wait_for_shutdown(&self) {
        while !self.is_shutdown_requested() {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    }

    /// Connect to the platform: API client, enrollment (with a probe
    /// heartbeat and an immediate re-enrollment on a stale identity) and
    /// the sync services. Never called in standalone mode.
    async fn run_platform_startup(&self) -> Result<(), CommonError> {
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
                                self.re_enrollment_attempts.store(0, Ordering::Release);
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
                        warn!(
                            "Enrollment health check failed (non-auth: {}), proceeding",
                            e
                        );
                        true
                    }
                };

                if enrollment_valid {
                    self.init_sync_services().await;
                } else {
                    warn!("Skipping sync service init — enrollment invalid");
                    warn!(
                        "To fix this, add a valid enrollment_token to {} and restart the agent.",
                        agent_common::config::AgentConfig::platform_config_path().display()
                    );
                }
            }
            Err(e) => {
                warn!("Enrollment failed: {}. Running in offline mode.", e);
                // Continue running in offline mode
            }
        }

        Ok(())
    }

    pub async fn run(&self) -> Result<(), CommonError> {
        // Reset startup timer so it measures from run() start, not from
        // AgentRuntime construction (which may include a failed GUI attempt).
        self.resource_monitor.reset_startup_time();

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

        // Honor timed IP unblocks whose in-memory timers died with the previous
        // process: expired blocks are lifted now, the rest are rescheduled.
        crate::edr_actions::reconcile_pending_blocks().await;
        // Same for a host isolation: lifted if it expired, applied again if not.
        crate::host_isolation::reconcile_host_isolation().await;

        if self.config.standalone {
            // ── Standalone: no platform, local protection only ──
            info!(
                "Standalone mode: no enrollment, heartbeat, upload or remote command; \
                 detection, file integrity, compliance and scanning run locally"
            );
            // The bundled check rules back the results table's foreign key;
            // the platform normally seeds them through the sync services.
            self.seed_builtin_check_rules().await;
        } else {
            self.run_platform_startup().await?;
        }

        // Last network monitoring consent received from the platform: must be
        // known before the first network collection.
        self.load_persisted_network_consent().await;

        // Log initial resource usage
        let usage = self.resource_monitor.get_usage();
        debug!(
            "Initial resource usage: CPU={:.2}%, MEM={}MB",
            usage.cpu_percent,
            usage.memory_bytes / (1024 * 1024)
        );

        // Emit initial GUI state
        #[cfg(feature = "gui")]
        {
            self.emit_status_update(None, None, 0, None);
            self.emit_resource_update(None);
        }

        #[cfg(feature = "gui")]
        self.load_cached_discovery().await;

        // Load persisted GRC data (playbooks, detection rules, assets, alert rules) into GUI
        #[cfg(feature = "gui")]
        self.sync_assets_to_gui().await;

        // Schedule and last results of the loop: vulnerability scan and
        // compliance check on the first pass, update check shortly after.
        let mut st = main_loop::LoopState::starting_at(
            std::time::Instant::now(),
            self.vuln_scan_interval_secs,
            self.state.get_check_interval(),
        );

        // Run initial security scan on startup (quick check)
        info!("Running initial security scan...");
        if let Err(e) = self.run_security_scan().await {
            warn!("Initial security scan failed: {}", e);
        }
        st.last_security_scan = std::time::Instant::now();

        // Initialize network collection with staggered start
        self.start_network_schedule(&mut st).await;

        // Log collector timer — polls OS event logs at the configured interval
        st.last_log_collection = std::time::Instant::now();

        // Run initial network collection (with 30s timeout to avoid blocking the main loop)
        self.run_initial_network_collection().await;

        // Initialize FIM engine
        self.start_fim_engine().await;

        // Ransomware canary files (or their removal when the option is off)
        self.start_ransomware_canaries().await;

        // Process starts reported by the operating system, when the option is on
        self.start_process_telemetry();

        // YARA rules, when the helper is installed and rules are present
        self.start_yara();

        // Indicator feeds (block lists, STIX, TAXII), when any is configured
        self.start_threat_intel_feeds();

        // Initialize SIEM forwarder (disabled by default).
        self.init_siem_forwarder().await;

        // Initialize log collector for OS event log ingestion
        self.init_log_collector().await;

        // Initialize correlation engine with default rules
        self.init_correlation_engine().await;

        info!("Agent main loop started");
        loop {
            // Check for shutdown signal
            if self.state.shutdown.load(Ordering::Acquire) {
                info!("Shutdown requested, stopping main loop");
                #[cfg(feature = "gui")]
                self.emit_gui_event(AgentEvent::ShuttingDown);
                break;
            }

            // What this pass gathers on its way to the threat pipeline.
            let mut pass = main_loop::LoopPass::new(self.is_paused());

            // Indicator feeds refreshed in the background
            self.apply_fresh_feed_intel().await;

            // Processes started since the last pass, evaluated as they start
            self.report_started_processes(&mut pass).await;

            // 0. Ransomware canaries (always — security-critical even when paused)
            self.check_ransomware_canaries(&mut pass).await;

            // 1. Process FIM alerts (always — security-critical even when paused)
            //    Collect all pending alerts first, then batch-upload to avoid 429 rate limits.
            let fim_batch = self.drain_fim_alerts(&mut st, &mut pass).await;

            // YARA: scan the files just created or changed
            self.scan_changed_files_with_yara(&mut pass, &fim_batch.yara_candidates)
                .await;

            // Batch-upload collected FIM alerts and report summary incident
            self.upload_fim_batch(fim_batch).await;

            // 1b. Emit FIM stats to GUI periodically
            #[cfg(feature = "gui")]
            self.emit_fim_stats(&mut st).await;

            // 1b. Sync GUI SIEM config changes to the actual forwarder
            // Only enable external SIEM transport if a real destination is configured.
            #[cfg(feature = "gui")]
            {
                let gui_enabled = self.state.siem_enabled.load(Ordering::Acquire);
                let has_destination = self
                    .state
                    .siem_destination
                    .lock()
                    .map(|d| !d.is_empty())
                    .unwrap_or(false);
                // Don't activate external transport without a configured destination
                let effective_enabled = gui_enabled && has_destination;
                let mut siem_guard = self.siem_forwarder.write().await;
                if let Some(ref mut siem) = *siem_guard
                    && siem.is_enabled() != effective_enabled
                {
                    let mut new_config = siem.config().clone();
                    new_config.enabled = effective_enabled;
                    if let Ok(fmt) = self.state.siem_format.lock() {
                        new_config.format = match fmt.as_str() {
                            "CEF" => agent_siem::SiemFormat::Cef,
                            "LEEF" => agent_siem::SiemFormat::Leef,
                            _ => agent_siem::SiemFormat::Json,
                        };
                    }
                    if has_destination
                        && let Ok(dest) = self.state.siem_destination.lock()
                        && let Ok(tr) = self.state.siem_transport.lock()
                    {
                        match tr.as_str() {
                            "HTTP" => {
                                new_config.transport = agent_siem::SiemTransport::Http {
                                    url: dest.clone(),
                                    auth_token: None,
                                    auth_header: None,
                                    verify_tls: true,
                                    client_cert: None,
                                    client_key: None,
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
                                    client_cert: None,
                                    client_key: None,
                                };
                            }
                        }
                    }
                    if let Err(e) = siem.update_config(new_config) {
                        warn!("Failed to apply GUI SIEM config: {}", e);
                    } else if effective_enabled {
                        info!("SIEM forwarder config synced from GUI (enabled=true)");
                    }
                }
            }

            // 2. Heartbeat & Config Sync (a standalone agent has nobody to report to)
            if !self.config.standalone
                && st.last_heartbeat.elapsed().as_secs()
                    >= *self.heartbeat_interval_secs.read().await
            {
                st.last_heartbeat = std::time::Instant::now();
                match self
                    .send_heartbeat(st.compliance_score, st.last_compliance_check_at)
                    .await
                {
                    Ok(_) => {
                        debug!("Heartbeat sent successfully");

                        // Reset auth failure counter on successful heartbeat
                        if self.auth_failure_count.load(Ordering::Acquire) > 0 {
                            info!("Connection restored, resetting authentication failure counter");
                            self.auth_failure_count.store(0, Ordering::Release);
                            self.re_enrollment_attempts.store(0, Ordering::Release);
                        }

                        #[cfg(feature = "gui")]
                        {
                            st.gui.cached_pending_sync = self.get_pending_sync_count().await as u32;
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
                                st.gui.last_check_at,
                                st.compliance_score,
                                st.gui.cached_pending_sync,
                                st.gui.cached_policy_summary,
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
                        if let Some(ref client) = self.authenticated_client
                            && let Some(ref siem) = *self.siem_forwarder.read().await
                        {
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
                    Err(e) => {
                        warn!("Heartbeat failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification("Heartbeat échoué", &format!("{}", e), "warning");
                        if e.is_auth_error() {
                            let failures =
                                self.auth_failure_count.fetch_add(1, Ordering::AcqRel) + 1;
                            warn!("Authentication error (consecutive failure #{})", failures);

                            // Attempt re-enrollment with exponential backoff
                            let attempts = self.re_enrollment_attempts.load(Ordering::Acquire);
                            if failures >= Self::AUTH_FAILURE_THRESHOLD
                                && attempts < Self::MAX_RE_ENROLLMENT_ATTEMPTS
                            {
                                let now_secs = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();
                                let last_attempt =
                                    self.last_re_enrollment_attempt.load(Ordering::Acquire);

                                // Exponential backoff: 30s, 120s, 600s based on attempt number
                                let attempt_index = attempts;
                                let cooldown_secs: u64 = match attempt_index {
                                    0 => 30,
                                    1 => 120,
                                    _ => 600,
                                };

                                if now_secs.saturating_sub(last_attempt) >= cooldown_secs {
                                    self.last_re_enrollment_attempt
                                        .store(now_secs, Ordering::Release);
                                    self.re_enrollment_attempts.fetch_add(1, Ordering::AcqRel);
                                    info!(
                                        "Initiating automatic re-enrollment (attempt {})",
                                        attempt_index + 1
                                    );
                                    match self.attempt_re_enrollment().await {
                                        Ok(true) => {
                                            info!(
                                                "Re-enrollment succeeded, resetting auth failure counter"
                                            );
                                            self.auth_failure_count.store(0, Ordering::Relaxed);
                                            self.re_enrollment_attempts.store(0, Ordering::Release);
                                            #[cfg(feature = "gui")]
                                            self.emit_notification(
                                                "Ré-enregistrement réussi",
                                                "L'agent a été ré-enregistré avec succès auprès du serveur.",
                                                "info",
                                            );
                                        }
                                        Ok(false) => {
                                            self.re_enrollment_attempts.store(
                                                Self::MAX_RE_ENROLLMENT_ATTEMPTS,
                                                Ordering::Release,
                                            );
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
                                        cooldown_secs
                                            .saturating_sub(now_secs.saturating_sub(last_attempt))
                                    );
                                }
                            } else if attempts >= Self::MAX_RE_ENROLLMENT_ATTEMPTS {
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

            // 3. Vulnerability Scanning — runs in its own task so that a long
            //    scan (inventory, OSV lookups, AI analysis, uploads) never delays
            //    heartbeats. At most one scan runs at a time: a new one is only
            //    started once the previous task handle has been collected here.
            if st.vuln_scan_task.as_ref().is_some_and(|t| t.is_finished())
                && let Some(task) = st.vuln_scan_task.take()
            {
                st.last_vuln_scan = std::time::Instant::now();
                match task.await {
                    Ok(Ok(result)) => {
                        let count = result.vulnerabilities.len();
                        if count > 0 {
                            info!("Vulnerability scan found {} issues", count);
                        }
                        #[cfg(feature = "gui")]
                        {
                            let exploited = result
                                .vulnerabilities
                                .iter()
                                .filter(|v| v.is_known_exploited())
                                .count();
                            let severity = if exploited > 0 {
                                "error"
                            } else if count > 0 {
                                "warning"
                            } else {
                                "info"
                            };
                            let mut message = format!(
                                "{} vulnérabilités détectées sur {} paquets",
                                count, result.packages_scanned
                            );
                            if exploited > 0 {
                                message.push_str(&format!(
                                    ", dont {} exploitée{} activement (CISA KEV)",
                                    exploited,
                                    if exploited > 1 { "s" } else { "" }
                                ));
                            }
                            self.emit_notification(
                                "Scan vulnérabilités terminé",
                                &message,
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
                                exploit_intel: self.build_exploit_intel_status(&result),
                            });
                            // Browser extensions are part of the software
                            // inventory and refreshed with it.
                            let extensions =
                                agent_scanner::browser_extensions::installed_extensions().await;
                            self.emit_gui_event(AgentEvent::BrowserExtensions {
                                extensions: self.build_browser_extensions(&extensions),
                            });
                            st.gui.kpi_open_vulns = count as u32;
                            st.gui.last_check_at = Some(chrono::Utc::now());
                        }
                    }
                    Ok(Err(e)) => {
                        warn!("Vulnerability scan failed: {}", e);
                        #[cfg(feature = "gui")]
                        self.emit_notification(
                            "Scan vulnérabilités échoué",
                            &format!("{}", e),
                            "error",
                        );
                    }
                    Err(join_error) => {
                        error!("Vulnerability scan task aborted: {}", join_error);
                    }
                }
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(false, Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                }
            }

            if !pass.is_paused
                && st.vuln_scan_task.is_none()
                && st.last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs
            {
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                }
                st.vuln_scan_task = Some(tokio::spawn(self.vuln_scan_job().run()));
            }

            // Run security scan if interval has passed (skip when paused)
            if !pass.is_paused
                && st.last_security_scan.elapsed().as_secs() >= self.security_scan_interval_secs
            {
                pass.is_active = true;
                match self.run_security_scan().await {
                    Ok(result) => {
                        let count = result.incidents.len();
                        if count > 0 {
                            warn!("Security scan detected {} incident(s)!", count);
                            #[cfg(feature = "gui")]
                            {
                                let authorizations = self.state.allowlist_snapshot();
                                let current: std::collections::HashSet<String> = result
                                    .incidents
                                    .iter()
                                    // Authorized incidents are still reported to the GUI
                                    // (shown as "Autorisé") but never notified.
                                    .filter(|i| {
                                        !triage_allowlist::incident_is_authorized(
                                            &authorizations,
                                            i,
                                        )
                                    })
                                    .map(|i| {
                                        format!(
                                            "{}|{}|{}|{}",
                                            i.incident_type, i.title, i.description, i.evidence
                                        )
                                    })
                                    .collect();
                                let new_count =
                                    current.difference(&st.gui.previous_incidents).count();
                                st.gui.previous_incidents = current;
                                if new_count > 0 {
                                    self.emit_notification(
                                        "Incidents de sécurité détectés",
                                        &format!("{} nouvel(s) incident(s) détecté(s)", new_count),
                                        "error",
                                    );
                                }
                                for incident in &result.incidents {
                                    let is_process = incident.incident_type
                                        == agent_scanner::IncidentType::SuspiciousProcess
                                        || incident.incident_type
                                            == agent_scanner::IncidentType::CryptoMiner;
                                    // Process detections are reported once, as a
                                    // SuspiciousProcess: a duplicate SystemIncident
                                    // could not be covered by a process authorization
                                    // and was counted twice.
                                    if !is_process {
                                        self.emit_system_incident(incident);
                                    }

                                    if is_process {
                                        let process_name = incident
                                            .evidence
                                            .get("process_name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();
                                        let pid: u32 = incident
                                            .evidence
                                            .get("pid")
                                            .and_then(|v| v.as_u64())
                                            .and_then(|v| v.try_into().ok())
                                            .unwrap_or(0);
                                        let command_line = incident
                                            .evidence
                                            .get("path")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string();
                                        self.emit_gui_event(AgentEvent::SuspiciousProcess {
                                            process: GuiSuspiciousProcess {
                                                process_name,
                                                pid,
                                                command_line,
                                                reason: incident.description.clone(),
                                                confidence: incident.confidence,
                                                detected_at: incident.detected_at,
                                                ai_confidence: None,
                                                is_false_positive: None,
                                                ai_analysis: None,
                                                acknowledged: false,
                                                allowlisted: false,
                                            },
                                        });
                                    }
                                }
                            }
                        }

                        // Accumulate incidents for threat pipeline
                        #[cfg(feature = "gui")]
                        {
                            pass.kpi_incident_count =
                                pass.kpi_incident_count.saturating_add(count as u32);
                        }
                        pass.incidents.extend(result.incidents.iter().cloned());
                        pass.observed.add_processes(&result.processes);

                        if count == 0 {
                            // A clean periodic scan is not news: logging it avoids a
                            // notification every few minutes.
                            debug!("Security scan: no incident detected");
                            #[cfg(feature = "gui")]
                            st.gui.previous_incidents.clear();
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
                            acknowledged: false,
                            allowlisted: false,
                        },
                    });
                }

                st.last_security_scan = std::time::Instant::now();
            }

            // Network collection/detection only with the platform's consent
            // (timers are left as-is so collection resumes at once when re-enabled).
            let network_allowed = self.state.network_monitoring_enabled();

            // Run network static info collection if interval has passed (skip when paused)
            if !pass.is_paused
                && network_allowed
                && st.last_network_static.elapsed() >= st.network_static_interval
            {
                pass.is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len())
                                    .unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len())
                                    .unwrap_or(u32::MAX),
                                alerts_count: st.gui.last_network_alert_count,
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
                st.last_network_static = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                st.network_static_interval = network_manager.next_static_interval();
            }

            // Run network connection scan if interval has passed (skip when paused)
            if !pass.is_paused
                && network_allowed
                && st.last_network_connections.elapsed() >= st.network_connection_interval
            {
                pass.is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            self.emit_gui_event(AgentEvent::NetworkUpdate {
                                interfaces_count: u32::try_from(snapshot.interfaces.len())
                                    .unwrap_or(u32::MAX),
                                connections_count: u32::try_from(snapshot.connections.len())
                                    .unwrap_or(u32::MAX),
                                alerts_count: st.gui.last_network_alert_count,
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
                st.last_network_connections = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                st.network_connection_interval = network_manager.next_connection_interval();
            }

            // Run network security detection if interval has passed (skip when paused)
            if !pass.is_paused
                && network_allowed
                && st.last_network_security.elapsed() >= st.network_security_interval
            {
                pass.is_active = true;
                match self.run_network_collection().await {
                    Ok(snapshot) => {
                        pass.observed.add_connections(&snapshot.connections);
                        #[cfg(feature = "gui")]
                        let mut alert_count: u32 = 0;
                        match self.run_network_security_detection(&snapshot).await {
                            Ok(alerts) => {
                                #[cfg(feature = "gui")]
                                {
                                    alert_count = u32::try_from(alerts.len()).unwrap_or(u32::MAX);
                                }
                                #[cfg(feature = "gui")]
                                for alert in &alerts {
                                    self.emit_network_security_alert_to_gui(alert);
                                }
                                self.upload_network_alerts(&alerts).await;

                                // Accumulate network alerts for threat pipeline
                                pass.network_alerts.extend(alerts.iter().cloned());
                            }
                            Err(e) => {
                                warn!("Network security detection failed: {}", e);
                            }
                        }
                        #[cfg(feature = "gui")]
                        {
                            st.gui.last_network_alert_count = alert_count;
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
                st.last_network_security = std::time::Instant::now();
                let mut network_manager = self.network_manager.write().await;
                st.network_security_interval = network_manager.next_security_interval();
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

                if collector_enabled && st.last_log_collection.elapsed().as_secs() >= poll_secs {
                    let collector_guard = self.log_collector.read().await;
                    if let Some(ref collector) = *collector_guard {
                        let siem_events = collector.collect().await;
                        if !siem_events.is_empty() {
                            debug!(
                                "Log collector gathered {} events from OS logs",
                                siem_events.len()
                            );

                            // Push collected events to the desktop GUI
                            #[cfg(feature = "gui")]
                            {
                                self.emit_siem_log_batch(siem_events.clone());

                                // Build category counts for stats
                                let mut cat_map: std::collections::HashMap<String, u32> =
                                    std::collections::HashMap::new();
                                for ev in &siem_events {
                                    *cat_map.entry(format!("{:?}", ev.category)).or_insert(0) += 1;
                                }
                                let siem_connected = self
                                    .state
                                    .siem_enabled
                                    .load(std::sync::atomic::Ordering::Acquire);
                                self.emit_siem_stats(
                                    siem_events.len() as u64,
                                    siem_connected,
                                    siem_events.len() as f32 / (poll_secs.max(1) as f32 / 60.0),
                                    cat_map.into_iter().collect(),
                                );
                            }

                            // Record all events for platform sync, then optionally forward to external SIEM
                            let siem_guard = self.siem_forwarder.read().await;
                            if let Some(siem) = siem_guard.as_ref() {
                                for event in &siem_events {
                                    // Always record for platform (SIEM tab in SaaS)
                                    siem.record_event(event.clone()).await;

                                    // Additionally forward to external SIEM if configured
                                    if siem.is_enabled()
                                        && let Err(e) = siem.send_event(event).await
                                    {
                                        warn!(
                                            "Failed to forward log event to external SIEM: {}",
                                            e
                                        );
                                    }
                                }
                            }
                            drop(siem_guard);

                            // Run events through correlation engine
                            let corr_guard = self.correlation_engine.read().await;
                            if let Some(ref engine) = *corr_guard {
                                let alerts = engine.process_events(&siem_events).await;
                                if !alerts.is_empty() {
                                    warn!("Correlation engine triggered {} alert(s)", alerts.len());

                                    // Forward correlation alerts to SIEM (record for platform + optional external)
                                    let siem_guard = self.siem_forwarder.read().await;
                                    if let Some(siem) = siem_guard.as_ref() {
                                        let host = hostname::get()
                                            .map(|h| h.to_string_lossy().to_string())
                                            .unwrap_or_default();
                                        for alert in &alerts {
                                            let event = engine.alert_to_event(alert, &host);
                                            siem.record_event(event.clone()).await;
                                            if siem.is_enabled()
                                                && let Err(e) = siem.send_event(&event).await
                                            {
                                                warn!(
                                                    "Failed to forward correlation alert to external SIEM: {}",
                                                    e
                                                );
                                            }
                                        }
                                    }
                                    drop(siem_guard);

                                    // Upload correlation alerts as security incidents
                                    for alert in &alerts {
                                        if let Some(ref client) = self.authenticated_client {
                                            use agent_sync::types::{
                                                IncidentType as SyncIncidentType,
                                                Severity as SyncSeverity,
                                            };
                                            let incident_type = match alert.rule_id.as_str() {
                                                "brute_force" | "windows_logon_failure_burst" => {
                                                    SyncIncidentType::CredentialTheft
                                                }
                                                "privilege_escalation" => {
                                                    SyncIncidentType::PrivilegeEscalation
                                                }
                                                "file_integrity_burst"
                                                | "windows_audit_log_cleared"
                                                | "windows_account_changes" => {
                                                    SyncIncidentType::UnauthorizedChange
                                                }
                                                "windows_service_install_burst" => {
                                                    SyncIncidentType::Malware
                                                }
                                                "windows_firewall_changes" => {
                                                    SyncIncidentType::FirewallDisabled
                                                }
                                                "network_scan" | "critical_errors" => {
                                                    SyncIncidentType::SuspiciousProcess
                                                }
                                                _ => SyncIncidentType::SuspiciousProcess,
                                            };
                                            let severity = if alert.severity >= 8 {
                                                SyncSeverity::Critical
                                            } else if alert.severity >= 6 {
                                                SyncSeverity::High
                                            } else {
                                                SyncSeverity::Medium
                                            };
                                            let report =
                                                agent_sync::types::SecurityIncidentReport {
                                                    incident_type,
                                                    severity,
                                                    title: alert.rule_name.clone(),
                                                    description: format!(
                                                        "{} ({} events in {}s)",
                                                        alert.description,
                                                        alert.event_count,
                                                        (alert.last_event - alert.first_event)
                                                            .num_seconds()
                                                    ),
                                                    evidence: serde_json::json!({
                                                        "rule_id": alert.rule_id,
                                                        "event_count": alert.event_count,
                                                        "sample_event_ids": alert.sample_event_ids,
                                                    }),
                                                    confidence: 80,
                                                    detected_at: alert.generated_at,
                                                };
                                            if let Err(e) = client.report_incident(report).await {
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
                    st.last_log_collection = std::time::Instant::now();
                }
            }

            // ── Autonomous threat pipeline ──
            // Evaluate detection rules against accumulated threat data from this
            // iteration (security scan incidents, network alerts, FIM alerts)
            // and against the activity observed, flagged or not. Playbooks act
            // on the host: they only run on what an engine flagged.
            let flagged_activity = pass.has_flagged_activity();
            if flagged_activity || !pass.observed.is_empty() {
                // Authorized events still reach the SIEM below (audit trail) but
                // never match detection rules nor trigger playbooks.
                let allowlist = self.state.allowlist_snapshot();
                let (triaged_incidents, triaged_network, triaged_fim) =
                    triage_allowlist::unauthorized_pipeline_inputs(
                        &allowlist,
                        &pass.incidents,
                        &pass.network_alerts,
                        &pass.fim_alerts,
                    );
                let unauthorized_activity = triage_allowlist::unauthorized_observed(
                    &allowlist,
                    std::mem::take(&mut pass.observed),
                );
                let threat_context = threat_pipeline::build_threat_context(
                    &triaged_incidents,
                    &triaged_network,
                    &triaged_fim,
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

                    if flagged_activity {
                        let pb_repo = agent_storage::repositories::grc::PlaybookRepository::new(db);
                        match pb_repo.get_all().await {
                            Ok(stored_pbs) => {
                                playbooks = threat_pipeline::stored_playbooks_to_dto(&stored_pbs);
                                debug!("Loaded {} playbooks for pipeline", playbooks.len());
                            }
                            Err(e) => warn!("Failed to load playbooks for pipeline: {}", e),
                        }
                    }
                }

                if !detection_rules.is_empty() || !playbooks.is_empty() {
                    let siem_delivery = self.siem_forwarder.read().await;
                    let pipeline_result = threat_pipeline::run_threat_pipeline(
                        &detection_rules,
                        &playbooks,
                        &threat_context,
                        &unauthorized_activity,
                        &mut st.rule_hit_memory,
                        #[cfg(feature = "gui")]
                        &self.gui_event_tx,
                        #[cfg(not(feature = "gui"))]
                        &None,
                        #[cfg(feature = "llm")]
                        self.llm_service.as_ref().map(|s| s.as_ref()),
                        self.audit_trail.as_ref(),
                        siem_delivery.as_ref(),
                    )
                    .await;
                    drop(siem_delivery);

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
                    for inc in &pass.incidents {
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
                        if siem.is_enabled()
                            && let Err(e) = siem.send_event(&event).await
                        {
                            warn!(
                                "Failed to forward security incident to external SIEM: {}",
                                e
                            );
                        }
                    }

                    // Network alerts → SIEM
                    for alert in &pass.network_alerts {
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
                        if siem.is_enabled()
                            && let Err(e) = siem.send_event(&event).await
                        {
                            warn!("Failed to forward network alert to external SIEM: {}", e);
                        }
                    }

                    if !pass.incidents.is_empty() || !pass.network_alerts.is_empty() {
                        info!(
                            "Forwarded {} security incidents and {} network alerts to SIEM",
                            pass.incidents.len(),
                            pass.network_alerts.len(),
                        );
                    }
                }
                drop(siem_guard);
            }

            // Run compliance checks if interval has passed (skip when paused)
            if !pass.is_paused
                && st.last_compliance_check.elapsed().as_secs() >= self.state.get_check_interval()
            {
                pass.is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                }

                let (check_results, score) = self.run_compliance_checks().await;
                st.compliance_score = Some(score.score);
                st.last_compliance_check_at = Some(chrono::Utc::now());

                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                // Auto-generate risks from failing checks and queue for platform sync
                self.auto_generate_risks(&check_results).await;

                #[cfg(feature = "gui")]
                {
                    let total = u32::try_from(score.total_count).unwrap_or(u32::MAX);
                    st.gui.cached_policy_summary = Some(GuiPolicySummary {
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
                    st.gui.last_check_at = Some(chrono::Utc::now());
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
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                    self.emit_kpi_snapshot(
                        st.compliance_score,
                        pass.kpi_incident_count,
                        st.gui.kpi_open_vulns,
                        0,
                    );
                }

                st.last_compliance_check = std::time::Instant::now();
            }

            // Certificate renewal check (daily)
            if !self.config.standalone
                && st.last_cert_check.elapsed().as_secs() >= main_loop::CERT_CHECK_INTERVAL_SECS
            {
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
                                        self.re_enrollment_attempts.store(0, Ordering::Release);
                                    }
                                    Ok(false) => {
                                        warn!("Cannot re-enroll: no enrollment token configured")
                                    }
                                    Err(re_err) => error!(
                                        "Re-enrollment after certificate expiry failed: {}",
                                        re_err
                                    ),
                                }
                            }
                        }
                    }
                }
                st.last_cert_check = std::time::Instant::now();
            }

            // Check for force_check flag (GUI "Vérifier maintenant" button)
            if self.state.force_check.load(Ordering::Acquire) {
                info!("Force check triggered");
                pass.is_active = true;
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(true, Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                }

                // The vulnerability scan runs in the background task; its
                // results are published when the task is collected above.
                if st.vuln_scan_task.is_none() {
                    st.vuln_scan_task = Some(tokio::spawn(self.vuln_scan_job().run()));
                } else {
                    info!("Vulnerability scan already running, not starting another one");
                }

                let (check_results, score) = self.run_compliance_checks().await;
                st.compliance_score = Some(score.score);
                st.last_compliance_check_at = Some(chrono::Utc::now());
                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                #[cfg(feature = "gui")]
                {
                    let total = u32::try_from(score.total_count).unwrap_or(u32::MAX);
                    st.gui.cached_policy_summary = Some(GuiPolicySummary {
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
                    st.gui.last_check_at = Some(chrono::Utc::now());
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
                    // Still "scanning" while the vulnerability task runs.
                    self.state
                        .scanning
                        .store(st.vuln_scan_task.is_some(), Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                    self.emit_kpi_snapshot(
                        st.compliance_score,
                        pass.kpi_incident_count,
                        st.gui.kpi_open_vulns,
                        0,
                    );
                }
                st.last_vuln_scan = std::time::Instant::now();
                st.last_compliance_check = std::time::Instant::now();
                self.state.force_check.store(false, Ordering::Release);
            }

            // A sync request in standalone mode has nothing to sync: say so
            // once in the interface instead of spinning against no server.
            if self.config.standalone && self.state.force_sync.swap(false, Ordering::AcqRel) {
                info!("Sync requested in standalone mode: no platform, nothing to send");
                #[cfg(feature = "gui")]
                self.emit_gui_event(AgentEvent::SyncStatus {
                    syncing: false,
                    pending_count: 0,
                    last_sync_at: None,
                    error: Some(
                        "Mode autonome : aucune plateforme à synchroniser. Les données restent sur ce poste."
                            .to_string(),
                    ),
                });
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
                    .send_heartbeat(st.compliance_score, st.last_compliance_check_at)
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
                st.last_heartbeat = std::time::Instant::now();
                #[cfg(feature = "gui")]
                {
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                    self.emit_resource_update(None);
                }
                self.state.force_sync.store(false, Ordering::Release);
            }

            // Check for force_update flag (trigger from GUI button)
            if self.state.force_update.swap(false, Ordering::AcqRel) {
                // Release discovery is public and does not require platform
                // enrollment, so standalone installations follow the same
                // signed self-update path as connected agents.
                if let Err(e) = self.run_self_update().await {
                    warn!("Self-update failed: {}", e);
                }
            }

            // Periodic background update check against the public catalog.
            if st.last_update_check.elapsed().as_secs() >= UPDATE_CHECK_INTERVAL_SECS {
                st.last_update_check = std::time::Instant::now();
                if let Err(e) = self.run_scheduled_update_check().await {
                    debug!("Scheduled update check did not complete: {}", e);
                }
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

                    // Only the subnet of the primary IPv4 address is scanned:
                    // never a guessed range.
                    let subnet = if self.state.network_monitoring_enabled() {
                        let network_manager = self.network_manager.read().await;
                        match network_manager.collect_snapshot().await {
                            Ok(snapshot) => {
                                let subnet =
                                    network_ops::discovery_subnet(snapshot.primary_ip.as_deref());
                                if subnet.is_none() {
                                    warn!(
                                        "Network discovery aborted: no primary IPv4 address \
                                         (primary IP: {:?})",
                                        snapshot.primary_ip
                                    );
                                }
                                subnet.ok_or("Aucune adresse IPv4 principale : découverte annulée")
                            }
                            Err(e) => {
                                warn!(
                                    "Network discovery aborted: network information unavailable: {}",
                                    e
                                );
                                Err("Informations réseau indisponibles : découverte annulée")
                            }
                        }
                    } else {
                        info!(
                            "Network discovery skipped: network monitoring disabled by the platform"
                        );
                        Err("Découverte réseau désactivée par la politique de la plateforme")
                    };

                    match subnet {
                        Err(reason) => {
                            if let Err(e) = tx.send(AgentEvent::DiscoveryProgress {
                                phase: reason.to_string(),
                                progress: 0.0,
                                devices_found: 0,
                            }) {
                                warn!("Failed to send discovery progress: {}", e);
                            }
                        }
                        Ok(subnet) => {
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
                                        tokio::time::sleep(tokio::time::Duration::from_millis(200))
                                            .await;
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
                                            let stored: Vec<
                                                agent_storage::repositories::StoredDevice,
                                            > = devices
                                                .iter()
                                                .map(|d| {
                                                    agent_storage::repositories::StoredDevice {
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
                                                    }
                                                })
                                                .collect();
                                            if let Err(e) = repo.upsert_batch(&stored).await {
                                                warn!(
                                                    "Failed to persist discovered devices: {}",
                                                    e
                                                );
                                            } else {
                                                info!(
                                                    "Persisted {} discovered devices to database",
                                                    stored.len()
                                                );
                                            }
                                        }

                                        // Sync discovered devices to the platform
                                        if let Some(ref client) = sync_client {
                                            let payloads: Vec<agent_sync::DiscoveredAssetPayload> =
                                                devices
                                                    .iter()
                                                    .map(|d| agent_sync::DiscoveredAssetPayload {
                                                        ip: d.ip.clone(),
                                                        hostname: d.hostname.clone(),
                                                        mac_address: d.mac.clone(),
                                                        vendor: d.vendor.clone(),
                                                        device_type: Some(
                                                            d.device_type.to_string(),
                                                        ),
                                                        open_ports: d.open_ports.clone(),
                                                        is_gateway: Some(d.is_gateway),
                                                        subnet: Some(d.subnet.clone()),
                                                        first_seen: Some(d.first_seen),
                                                        last_seen: Some(d.last_seen),
                                                        source: Some(
                                                            "network_discovery".to_string(),
                                                        ),
                                                    })
                                                    .collect();
                                            network_ops::upload_discovered_devices(
                                                client, &payloads,
                                            )
                                            .await;
                                        }

                                        if let Err(e) =
                                            tx.send(AgentEvent::DiscoveryUpdate { devices })
                                        {
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
                                            warn!(
                                                "Failed to send discovery error progress: {}",
                                                e2
                                            );
                                        }
                                    }
                                }
                            });
                        }
                    }
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

            // Sync LLM loaded flag from runtime state to resource monitor
            self.resource_monitor
                .set_llm_loaded(self.state.llm_loaded.load(Ordering::Acquire));

            if pass.is_active {
                self.resource_monitor
                    .check_limits_with_usage(&usage, pass.is_active);
            }

            // Periodically push resource usage to the GUI (every 1 second)
            #[cfg(feature = "gui")]
            if st.gui.last_resource_update.elapsed().as_secs() >= 1 {
                self.emit_resource_update(Some(usage));
                st.gui.last_resource_update = std::time::Instant::now();
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
                            state::RemediationRequest::ApplyAi { action } => {
                                self.apply_ai_remediation(action).await;
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

        // 0. Do not keep scanning/uploading while shutting down.
        if let Some(task) = st.vuln_scan_task.take() {
            task.abort();
        }

        // 1. Flush pending check results
        if !self.config.standalone {
            info!("Flushing pending check results to server...");
            self.upload_check_results().await;
        }

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
                last_check_at: st.last_compliance_check_at.map(|dt| dt.to_rfc3339()),
                compliance_score: st.compliance_score,
                pending_sync_count: 0,
                self_check_result: None,
                processes: vec![],
                connections: vec![],
                llm_status: None,
                llm_inference_count: None,
                detection_rules: vec![],
                playbooks: vec![],
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
        self.stop_ransomware_canaries();
        self.stop_process_telemetry();

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

#[cfg(feature = "gui")]
pub mod remote_ai;
