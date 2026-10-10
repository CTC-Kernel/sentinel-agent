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
pub mod supervised_tasks;
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
use agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS;
use agent_common::error::CommonError;
use agent_network::NetworkManager;
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
use tracing::{error, info, warn};

// Import orphaned modules
use agent_fim::FimEngine;
use agent_siem::SiemForwarder;

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

    /// Run the agent until shutdown is requested: start-up, then one pass of
    /// the main loop about every second (see [`main_loop`]), then the
    /// shutdown sequence.
    ///
    /// The runtime is consumed: the loop shares it with the background
    /// tasks it starts.
    pub async fn run(self) -> Result<(), CommonError> {
        Arc::new(self).run_loop().await
    }

    async fn run_loop(self: Arc<Self>) -> Result<(), CommonError> {
        let mut st = self.start_up().await?;

        info!("Agent main loop started");
        loop {
            // Check for shutdown signal
            if self.state.shutdown.load(Ordering::Acquire) {
                info!("Shutdown requested, stopping main loop");
                #[cfg(feature = "gui")]
                self.emit_gui_event(AgentEvent::ShuttingDown);
                break;
            }

            self.run_pass(&mut st).await;

            // Sleep for a short interval before checking shutdown again
            if !self.idle_until_next_pass().await {
                break;
            }
        }

        // --- Graceful Shutdown Sequence ---
        self.shutdown_sequence(&mut st).await;
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
