//! Domain-specific sub-states for AppState.
//!
//! Each struct groups related fields by functional domain (network, discovery,
//! terminal, etc.) to keep `AppState` maintainable.

use std::collections::VecDeque;
use eframe::egui;

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

/// Network interfaces, connections, and alert data.
pub struct NetworkState {
    pub interface_count: u32,
    pub connection_count: u32,
    pub alert_count: u32,
    pub primary_ip: Option<String>,
    pub primary_mac: Option<String>,
    pub last_scan: Option<chrono::DateTime<chrono::Utc>>,
    pub interfaces: Vec<crate::dto::GuiNetworkInterface>,
    pub connections: Vec<crate::dto::GuiNetworkConnection>,
    pub alerts: VecDeque<crate::dto::GuiNetworkAlert>,
    pub search: String,
    pub selected_connection: Option<usize>,
    pub selected_alert: Option<usize>,
    pub detail_open: bool,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            interface_count: 0,
            connection_count: 0,
            alert_count: 0,
            primary_ip: None,
            primary_mac: None,
            last_scan: None,
            interfaces: Vec::new(),
            connections: Vec::new(),
            alerts: VecDeque::with_capacity(200),
            search: String::new(),
            selected_connection: None,
            selected_alert: None,
            detail_open: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/// Network discovery scan state.
#[derive(Default)]
pub struct DiscoveryState {
    pub devices: Vec<crate::dto::GuiDiscoveredDevice>,
    pub in_progress: bool,
    pub progress: f32,
    pub phase: String,
    pub enabled: bool,
    pub search: String,
    pub selected_device: Option<usize>,
    pub detail_open: bool,
}

// ---------------------------------------------------------------------------
// Cartography
// ---------------------------------------------------------------------------

/// Graph viewport state for the network cartography page.
pub struct CartographyState {
    pub layout: Option<crate::pages::cartography::GraphLayout>,
    pub zoom: f32,
    pub pan: egui::Vec2,
    pub selected_device: Option<String>,
}

impl Default for CartographyState {
    fn default() -> Self {
        Self {
            layout: None,
            zoom: 1.0,
            pan: egui::Vec2::ZERO,
            selected_device: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------

/// Real-time terminal / log viewer state.
pub struct TerminalState {
    pub lines: VecDeque<crate::events::TerminalLogEntry>,
    pub auto_scroll: bool,
    pub filter_level: crate::dto::LogLevel,
    pub search: String,
    pub event_count: u64,
    pub error_count: u64,
    pub selected_log: Option<usize>,
    pub detail_open: bool,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            lines: VecDeque::with_capacity(500),
            auto_scroll: true,
            filter_level: crate::dto::LogLevel::Info,
            search: String::new(),
            event_count: 0,
            error_count: 0,
            selected_log: None,
            detail_open: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/// Synchronisation state.
pub struct SyncState {
    pub in_progress: bool,
    pub error: Option<String>,
// Removed: pub history: VecDeque<super::app::SyncHistoryEntry>,
    pub history: VecDeque<SyncHistoryEntry>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            in_progress: false,
            error: None,
            history: VecDeque::with_capacity(50),
        }
    }
}

// ---------------------------------------------------------------------------
// FIM (File Integrity Monitoring)
// ---------------------------------------------------------------------------

/// FIM alerts and counters.
pub struct FimState {
    pub monitored_count: u32,
    pub changes_today: u32,
    pub alerts: VecDeque<crate::dto::GuiFimAlert>,
    pub search: String,
    pub filter: Option<String>,
    pub selected_alert: Option<usize>,
    pub detail_open: bool,
}

impl Default for FimState {
    fn default() -> Self {
        Self {
            monitored_count: 0,
            changes_today: 0,
            alerts: VecDeque::with_capacity(500),
            search: String::new(),
            filter: None,
            selected_alert: None,
            detail_open: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

/// Suspicious process and USB event data.
pub struct ThreatsState {
    pub suspicious_processes: VecDeque<crate::dto::GuiSuspiciousProcess>,
    pub usb_events: VecDeque<crate::dto::GuiUsbEvent>,
    pub system_incidents: VecDeque<crate::dto::GuiSystemIncident>,
    pub search: String,
    pub filter: Option<String>,
    pub selected_threat: Option<usize>,
    pub detail_open: bool,
}

impl Default for ThreatsState {
    fn default() -> Self {
        Self {
            suspicious_processes: VecDeque::with_capacity(200),
            usb_events: VecDeque::with_capacity(200),
            system_incidents: VecDeque::with_capacity(200),
            search: String::new(),
            filter: None,
            selected_threat: None,
            detail_open: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Monitoring history
// ---------------------------------------------------------------------------

/// Time-series history for the monitoring page charts.
pub struct MonitoringHistory {
    pub cpu_history: VecDeque<[f64; 2]>,
    pub memory_history: VecDeque<[f64; 2]>,
    pub disk_io_history: VecDeque<[f64; 2]>,
    pub network_io_history: VecDeque<[f64; 2]>,
}

impl Default for MonitoringHistory {
    fn default() -> Self {
        Self {
            cpu_history: VecDeque::with_capacity(300),
            memory_history: VecDeque::with_capacity(300),
            disk_io_history: VecDeque::with_capacity(300),
            network_io_history: VecDeque::with_capacity(300),
        }
    }
}

// ---------------------------------------------------------------------------
// Compliance filter
// ---------------------------------------------------------------------------

/// Compliance page filter/search state.
#[derive(Default)]
pub struct ComplianceFilter {
    pub search: String,
    pub status_filter: Option<crate::dto::GuiCheckStatus>,
    pub group_by: crate::dto::ComplianceGroupBy,
    pub selected_check: Option<usize>,
    pub detail_open: bool,
}


// ---------------------------------------------------------------------------
// AI / Intelligence Artificielle
// ---------------------------------------------------------------------------

/// AI analysis page state.
#[derive(Default)]
pub struct AiState {
    pub selected_recommendation: Option<usize>,
    pub detail_open: bool,
    pub filter: Option<String>,
    pub search: String,
}

// ---------------------------------------------------------------------------
// Vulnerability filter
// ---------------------------------------------------------------------------

/// Vulnerability page filter/search state.
#[derive(Default)]
pub struct VulnerabilityFilter {
    pub search: String,
    pub severity_filter: Option<crate::dto::Severity>,
    pub selected_vuln: Option<usize>,
    pub detail_open: bool,
}

// ---------------------------------------------------------------------------
// Software
// ---------------------------------------------------------------------------

/// Software inventory state.
#[derive(Default)]
pub struct SoftwareState {
    pub packages: Vec<crate::dto::GuiSoftwarePackage>,
    pub macos_apps: Vec<crate::dto::GuiMacOsApp>,
    pub active_tab: crate::dto::SoftwareTab,
    pub search: String,
    pub selected_package: Option<usize>,
    pub detail_open: bool,
}


// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/// Agent configuration / settings state.
pub struct SettingsState {
    pub is_paused: bool,
    pub server_url: String,
    pub architecture_url: String,
    pub check_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub log_level: crate::dto::LogLevel,
    pub dark_mode: bool,
    pub update_status: crate::dto::UpdateStatus,
    /// SHA-256 hash of the admin password for danger zone access.
    pub admin_password_sha256: String,
    /// Whether the SIEM forwarder is enabled.
    pub siem_enabled: bool,
    /// SIEM output format (CEF, LEEF, JSON).
    pub siem_format: String,
    /// SIEM transport protocol (Syslog, HTTP).
    pub siem_transport: String,
    /// SIEM destination address (host:port or URL).
    pub siem_destination: String,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            is_paused: false,
            server_url: agent_common::constants::DEFAULT_SERVER_URL.to_string(),
            architecture_url: format!("{}/voxel", crate::pages::about::branding::CONSOLE),
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            heartbeat_interval_secs: agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS,
            log_level: crate::dto::LogLevel::Info,
            dark_mode: true,
            update_status: crate::dto::UpdateStatus::Idle,
            // SHA-256 of "admin" — should be changed on first deployment
            admin_password_sha256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918".to_string(),
            siem_enabled: false,
            siem_format: "CEF".to_string(),
            siem_transport: "Syslog".to_string(),
            siem_destination: String::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/// Security state (RBAC / Auth lock).
#[derive(Default)]
pub struct SecurityState {
    /// Is the admin mode currently unlocked?
    pub admin_unlocked: bool,
    /// Timestamp of last unlock (for auto-lock timeouts).
    pub last_unlock: Option<chrono::DateTime<chrono::Utc>>,
}

// ---------------------------------------------------------------------------
// Main AppState
// ---------------------------------------------------------------------------

/// Sync history entry for the sync page.
#[derive(Debug, Clone)]
pub struct SyncHistoryEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub success: bool,
    pub message: String,
}

/// Shared application state consumed by all pages.
///
/// Fields are grouped into domain sub-structs to keep the struct manageable.
pub struct AppState {
    pub summary: crate::dto::AgentSummary,
    pub checks: Vec<crate::dto::GuiCheckResult>,
    pub policy: crate::dto::GuiPolicySummary,
    pub resources: crate::dto::GuiResourceUsage,
    pub vulnerability_summary: Option<crate::dto::GuiVulnerabilitySummary>,
    pub vulnerability_findings: Vec<crate::dto::GuiVulnerabilityFinding>,
    pub logs: VecDeque<crate::dto::GuiLogEntry>,
    pub toasts: Vec<crate::widgets::toast::Toast>,
    pub unread_notification_count: u32,

    // Channel to send async task results back to the main thread
    pub async_task_tx: Option<std::sync::mpsc::SyncSender<super::app::AsyncTaskResult>>,

    pub monitoring: MonitoringHistory,
    pub network: NetworkState,
    pub discovery: DiscoveryState,
    pub cartography: CartographyState,
    pub terminal: TerminalState,
    pub sync: SyncState,
    pub fim: FimState,
    pub threats: ThreatsState,
    pub software: SoftwareState,
    pub settings: SettingsState,
    pub security: SecurityState,
    pub compliance: ComplianceFilter,
    pub vulnerability: VulnerabilityFilter,
    pub ai: AiState,

    pub notifications: Vec<crate::dto::GuiNotification>,
    pub selected_notification: Option<usize>,
    pub notification_detail_open: bool,
    pub previous_compliance_score: Option<f32>,
    pub audit_trail_search: String,
    pub audit_trail_filter: Option<String>,
    pub selected_audit_entry: Option<usize>,
    pub audit_detail_open: bool,
    pub reduced_motion: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            summary: crate::dto::AgentSummary::default(),
            checks: Vec::new(),
            policy: crate::dto::GuiPolicySummary::default(),
            resources: crate::dto::GuiResourceUsage::default(),
            vulnerability_summary: None,
            vulnerability_findings: Vec::new(),
            logs: VecDeque::with_capacity(200),
            toasts: Vec::new(),
            unread_notification_count: 0,
            async_task_tx: None,

            monitoring: MonitoringHistory::default(),
            network: NetworkState::default(),
            discovery: DiscoveryState::default(),
            cartography: CartographyState::default(),
            terminal: TerminalState::default(),
            sync: SyncState::default(),
            fim: FimState::default(),
            threats: ThreatsState::default(),
            software: SoftwareState::default(),
            settings: SettingsState::default(),
            security: SecurityState::default(),
            compliance: ComplianceFilter::default(),
            vulnerability: VulnerabilityFilter::default(),
            ai: AiState::default(),

            notifications: Vec::new(),
            selected_notification: None,
            notification_detail_open: false,
            previous_compliance_score: None,
            audit_trail_search: String::new(),
            audit_trail_filter: None,
            selected_audit_entry: None,
            audit_detail_open: false,
            reduced_motion: false,
        }
    }
}

impl AppState {
    /// Push a toast notification with the current egui time.
    pub fn push_toast(&mut self, toast: crate::widgets::toast::Toast, ctx: &egui::Context) {
        let time = ctx.input(|i| i.time);
        self.toasts.push(toast.with_time(time));
    }

    /// Compute radar chart scores (compliance, threats, vulns, resources, network).
    /// Each score is normalized to 0.0..=1.0 where 1.0 is best.
    /// Maximum thresholds for radar score normalization.
    const RADAR_MAX_THREATS: f32 = 10.0;
    const RADAR_MAX_VULNS: f32 = 20.0;
    const RADAR_MAX_ALERTS: f32 = 5.0;

    pub fn radar_scores(&self) -> (f32, f32, f32, f32, f32) {
        let compliance = self.summary.compliance_score.unwrap_or(0.0) / 100.0;
        let threats = 1.0 - (self.threats.suspicious_processes.len() as f32 / Self::RADAR_MAX_THREATS).min(1.0);
        let vulns = 1.0 - (self.vulnerability_findings.len() as f32 / Self::RADAR_MAX_VULNS).min(1.0);
        let resources = 1.0 - (self.resources.cpu_percent as f32 / 100.0).min(1.0);
        let network = 1.0 - (self.network.alert_count as f32 / Self::RADAR_MAX_ALERTS).min(1.0);
        (compliance, threats, vulns, resources, network)
    }

    /// Process an event from the agent runtime.
    /// 
    /// This method centralizes all state updates and ensures reactive computation
    /// of summary statistics. Each event handler updates the appropriate sub-state
    /// and triggers necessary recomputations.
    pub fn apply_event(&mut self, event: crate::events::AgentEvent) {
        use crate::events::AgentEvent;

        match event {
            AgentEvent::StatusChanged { summary } => {
                // Preserve previous score for dashboard trend indicators
                self.previous_compliance_score = self.summary.compliance_score;
                self.summary = summary;
            }
            AgentEvent::CheckCompleted { result } => {
                self.update_check_result(result);
                self.recompute_policy();
                self.summary.last_check_at = Some(chrono::Utc::now());
            }
            AgentEvent::ResourceUpdate { usage } => {
                self.update_resource_usage(usage);
            }
            AgentEvent::Notification { notification } => {
                self.add_notification(notification);
            }
            AgentEvent::SyncStatus {
                syncing,
                pending_count,
                last_sync_at,
                error,
            } => {
                self.update_sync_status(syncing, pending_count, last_sync_at, error);
            }
            AgentEvent::NetworkUpdate {
                interfaces_count,
                connections_count,
                alerts_count,
                primary_ip,
                primary_mac,
            } => {
                self.update_network_summary(interfaces_count, connections_count, alerts_count, primary_ip, primary_mac);
            }
            AgentEvent::NetworkDetailUpdate {
                interfaces,
                connections,
            } => {
                self.network.interfaces = interfaces;
                self.network.connections = connections;
                // Invalidate selection — data was fully replaced
                self.network.selected_connection = None;
                self.network.detail_open = false;
            }
            AgentEvent::NetworkSecurityAlert { alert } => {
                self.network.alerts.push_front(alert);
                self.network.alerts.truncate(200);
                // Invalidate alert selection — push_front shifted all indices
                self.network.selected_alert = None;
            }
            AgentEvent::VulnerabilityUpdate { summary } => {
                self.vulnerability_summary = Some(summary);
            }
            AgentEvent::SoftwareUpdate { packages } => {
                self.software.packages = packages;
                self.software.selected_package = None;
                self.software.detail_open = false;
            }
            AgentEvent::VulnerabilityFindings { findings } => {
                self.vulnerability_findings = findings;
                self.vulnerability.selected_vuln = None;
                self.vulnerability.detail_open = false;
            }
            AgentEvent::TerminalLog { entry } => {
                self.add_terminal_log(entry);
            }
            AgentEvent::DiscoveryUpdate { devices } => {
                self.discovery.devices = devices;
                self.discovery.in_progress = false;
                self.discovery.progress = 1.0;
                self.discovery.phase = "Terminée".to_string();
                self.discovery.selected_device = None;
                self.discovery.detail_open = false;
                self.cartography.layout = None;
            }
            AgentEvent::DiscoveryProgress {
                phase,
                progress,
                ..
            } => {
                self.discovery.in_progress = true;
                self.discovery.phase = phase;
                self.discovery.progress = progress;
            }
            AgentEvent::EnrollmentResult {
                success,
                message: _,
                agent_id,
            } => {
                if success && let Some(id) = agent_id {
                    self.summary.agent_id = Some(id);
                }
            }
            AgentEvent::FimAlert { alert } => {
                self.fim.alerts.push_front(alert);
                self.fim.alerts.truncate(500);
                // Invalidate selection — push_front shifted indices
                self.fim.selected_alert = None;
            }
            AgentEvent::UsbEvent { event } => {
                self.threats.usb_events.push_front(event);
                self.threats.usb_events.truncate(200);
                // Invalidate threat selection — push_front shifted source indices
                self.threats.selected_threat = None;
            }
            AgentEvent::SuspiciousProcess { process } => {
                self.threats.suspicious_processes.push_front(process);
                self.threats.suspicious_processes.truncate(200);
                self.threats.selected_threat = None;
            }
            AgentEvent::SystemIncident { incident } => {
                self.threats.system_incidents.push_front(incident);
                self.threats.system_incidents.truncate(200);
                self.threats.selected_threat = None;
            }
            AgentEvent::FimStats {
                monitored_count,
                changes_today,
            } => {
                self.fim.monitored_count = monitored_count;
                self.fim.changes_today = changes_today;
            }
            AgentEvent::ShuttingDown => {}
            AgentEvent::UpdateStatusChanged { status } => {
                self.settings.update_status = status;
            }
            AgentEvent::SiemConfigUpdate {
                enabled,
                format,
                transport,
                destination,
            } => {
                self.settings.siem_enabled = enabled;
                self.settings.siem_format = format;
                self.settings.siem_transport = transport;
                self.settings.siem_destination = destination;
            }
        }

        // Single recompute at end of every event
        self.recompute_summary_stats();
    }

    /// Update check results and maintain history
    fn update_check_result(&mut self, result: crate::dto::GuiCheckResult) {
        if let Some(existing) = self
            .checks
            .iter_mut()
            .find(|c| c.check_id == result.check_id)
        {
            *existing = result;
        } else {
            self.checks.push(result);
        }
    }

    /// Update resource usage with history management
    fn update_resource_usage(&mut self, usage: crate::dto::GuiResourceUsage) {
        const MAX_HISTORY: usize = 300;
        let t = usage.uptime_secs as f64;

        if usage.cpu_percent > 0.0 {
            self.monitoring.cpu_history.push_back([t, usage.cpu_percent]);
            while self.monitoring.cpu_history.len() > MAX_HISTORY {
                self.monitoring.cpu_history.pop_front();
            }
        }
        if usage.memory_percent > 0.0 {
            self.monitoring.memory_history.push_back([t, usage.memory_percent]);
            while self.monitoring.memory_history.len() > MAX_HISTORY {
                self.monitoring.memory_history.pop_front();
            }
        }
        if usage.disk_kbps > 0 {
            self.monitoring.disk_io_history.push_back([t, usage.disk_kbps as f64]);
            while self.monitoring.disk_io_history.len() > MAX_HISTORY {
                self.monitoring.disk_io_history.pop_front();
            }
        }
        if usage.network_io_bytes > 0 {
            self.monitoring.network_io_history.push_back([t, usage.network_io_bytes as f64 / 1024.0]);
            while self.monitoring.network_io_history.len() > MAX_HISTORY {
                self.monitoring.network_io_history.pop_front();
            }
        }

        self.resources = usage;
    }

    /// Add notification and maintain log history
    fn add_notification(&mut self, notification: crate::dto::GuiNotification) {
        self.logs.push_front(crate::dto::GuiLogEntry {
            id: notification.id,
            timestamp: notification.timestamp,
            level: notification.severity.clone(),
            message: notification.title.clone(),
            source: None,
        });
        self.logs.truncate(200);
        
        self.notifications.push(notification);
        self.notifications.truncate(100);
    }

    /// Update synchronization status with history
    fn update_sync_status(
        &mut self,
        syncing: bool,
        pending_count: u32,
        last_sync_at: Option<chrono::DateTime<chrono::Utc>>,
        error: Option<String>,
    ) {
        self.sync.in_progress = syncing;
        self.summary.pending_sync_count = pending_count;
        
        if let Some(ts) = last_sync_at {
            self.summary.last_sync_at = Some(ts);
            self.sync.history.push_front(SyncHistoryEntry {
                timestamp: ts,
                success: error.is_none(),
                message: error
                    .clone()
                    .unwrap_or_else(|| "Synchronisation terminée".to_string()),
            });
            self.sync.history.truncate(50);
        }
        self.sync.error = error;
    }

    /// Update network summary information
    fn update_network_summary(
        &mut self,
        interfaces_count: u32,
        connections_count: u32,
        alerts_count: u32,
        primary_ip: Option<String>,
        primary_mac: Option<String>,
    ) {
        self.network.interface_count = interfaces_count;
        self.network.connection_count = connections_count;
        self.network.alert_count = alerts_count;
        self.network.primary_ip = primary_ip;
        self.network.primary_mac = primary_mac;
        self.network.last_scan = Some(chrono::Utc::now());
    }

    /// Add terminal log entry with statistics
    fn add_terminal_log(&mut self, entry: crate::events::TerminalLogEntry) {
        self.terminal.event_count += 1;
        if entry.level == "ERROR" {
            self.terminal.error_count += 1;
        }
        self.terminal.lines.push_back(entry);
        while self.terminal.lines.len() > 500 {
            self.terminal.lines.pop_front();
        }
    }

    /// Close all detail drawers (called on page navigation).
    pub fn close_all_drawers(&mut self) {
        self.network.detail_open = false;
        self.network.selected_connection = None;
        self.network.selected_alert = None;
        self.software.detail_open = false;
        self.software.selected_package = None;
        self.vulnerability.detail_open = false;
        self.vulnerability.selected_vuln = None;
        self.threats.detail_open = false;
        self.threats.selected_threat = None;
        self.fim.detail_open = false;
        self.fim.selected_alert = None;
        self.compliance.detail_open = false;
        self.compliance.selected_check = None;
        self.ai.detail_open = false;
        self.ai.selected_recommendation = None;
        self.notification_detail_open = false;
        self.selected_notification = None;
        self.audit_detail_open = false;
        self.selected_audit_entry = None;
    }

    /// Recompute summary statistics reactively
    fn recompute_summary_stats(&mut self) {
        // Note: compliance_score is already computed with severity weights
        // by recompute_policy(). Do NOT overwrite it with an unweighted ratio.

        // Update counts that exist in AgentSummary
        // Note: Some fields like vulnerability_count, software_count, etc.
        // may need to be added to the AgentSummary struct in the future
        // For now, we'll skip the non-existent fields

        // Update notification count (count only unread notifications)
        self.unread_notification_count = self.notifications.iter().filter(|n| !n.read).count() as u32;
    }

    fn recompute_policy(&mut self) {
        use crate::dto::{GuiCheckStatus, GuiPolicySummary};
        let total = self.checks.len() as u32;
        let (mut passing, mut failing, mut errors) = (0u32, 0u32, 0u32);
        let mut weighted_pass = 0.0_f32;
        let mut weighted_total = 0.0_f32;
        for c in &self.checks {
            let w = c.severity.weight();
            match c.status {
                GuiCheckStatus::Pass => {
                    passing += 1;
                    weighted_pass += w;
                    weighted_total += w;
                }
                GuiCheckStatus::Fail => {
                    failing += 1;
                    weighted_total += w;
                }
                GuiCheckStatus::Error => {
                    errors += 1;
                    weighted_pass += w * 0.5;
                    weighted_total += w;
                }
                _ => {} // Skipped/Pending excluded from score
            }
        }
        let pending = total - passing - failing - errors;

        self.summary.compliance_score = if weighted_total > 0.0 {
            Some((weighted_pass / weighted_total) * 100.0)
        } else {
            None
        };

        let summary = GuiPolicySummary {
            total_policies: total,
            passing,
            failing,
            errors,
            pending,
        };

        self.policy = summary;
        self.summary.policy_summary = Some(summary);
    }
}
