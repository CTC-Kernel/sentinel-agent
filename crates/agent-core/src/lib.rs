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
use agent_gui::dto::{GuiDiscoveredDevice, GuiPolicySummary};
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
            #[cfg(feature = "gui")]
            self.sync_gui_siem_config().await;

            // 2. Heartbeat & Config Sync (a standalone agent has nobody to report to)
            self.heartbeat_stage(&mut st).await;

            // 3. Vulnerability Scanning — runs in its own task so that a long
            //    scan (inventory, OSV lookups, AI analysis, uploads) never delays
            //    heartbeats. At most one scan runs at a time: a new one is only
            //    started once the previous task handle has been collected here.
            self.collect_vuln_scan(&mut st).await;

            self.start_vuln_scan_if_due(&mut st, &pass);

            // Run security scan if interval has passed (skip when paused)
            self.security_scan_stage(&mut st, &mut pass).await;

            // Network collection/detection only with the platform's consent
            // (timers are left as-is so collection resumes at once when re-enabled).
            let network_allowed = self.state.network_monitoring_enabled();

            // Run network static info collection if interval has passed (skip when paused)
            self.network_static_stage(&mut st, &mut pass, network_allowed)
                .await;

            // Run network connection scan if interval has passed (skip when paused)
            self.network_connections_stage(&mut st, &mut pass, network_allowed)
                .await;

            // Run network security detection if interval has passed (skip when paused)
            self.network_security_stage(&mut st, &mut pass, network_allowed)
                .await;

            // ── Log collection & correlation ──
            self.collect_os_logs(&mut st).await;

            // ── Autonomous threat pipeline ──
            self.threat_pipeline_stage(&mut st, &mut pass).await;

            // Run compliance checks if interval has passed (skip when paused)
            self.compliance_stage(&mut st, &mut pass).await;

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
