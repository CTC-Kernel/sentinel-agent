//! Domain-specific sub-states for AppState.
//!
//! Each struct groups related fields by functional domain (network, discovery,
//! terminal, etc.) to keep `AppState` maintainable.

use std::collections::VecDeque;
use eframe::egui;
use crate::dto::{GuiCheckStatus, GuiLogEntry, GuiNotification, GuiPolicySummary};

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

/// Network interfaces, connections, and alert data.
#[derive(Default)]
pub struct NetworkState {
    pub interface_count: u32,
    pub connection_count: u32,
    pub alert_count: u32,
    pub primary_ip: Option<String>,
    pub primary_mac: Option<String>,
    pub last_scan: Option<chrono::DateTime<chrono::Utc>>,
    pub interfaces: Vec<crate::dto::GuiNetworkInterface>,
    pub connections: Vec<crate::dto::GuiNetworkConnection>,
    pub search: String,
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
}

impl Default for FimState {
    fn default() -> Self {
        Self {
            monitored_count: 0,
            changes_today: 0,
            alerts: VecDeque::with_capacity(500),
            search: String::new(),
            filter: None,
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
    pub search: String,
    pub filter: Option<String>,
}

impl Default for ThreatsState {
    fn default() -> Self {
        Self {
            suspicious_processes: VecDeque::with_capacity(200),
            usb_events: VecDeque::with_capacity(200),
            search: String::new(),
            filter: None,
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
}


// ---------------------------------------------------------------------------
// Vulnerability filter
// ---------------------------------------------------------------------------

/// Vulnerability page filter/search state.
#[derive(Default)]
pub struct VulnerabilityFilter {
    pub search: String,
    pub severity_filter: Option<crate::dto::Severity>,
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
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            is_paused: false,
            server_url: agent_common::constants::DEFAULT_SERVER_URL.to_string(),
            architecture_url: "https://app.cyber-threat-consulting.com/voxel".to_string(),
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            heartbeat_interval_secs: agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS,
            log_level: crate::dto::LogLevel::Info,
            dark_mode: true,
            update_status: crate::dto::UpdateStatus::Idle,
            // SHA-256 of "admin" — should be changed on first deployment
            admin_password_sha256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918".to_string(),
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
    pub async_task_tx: Option<std::sync::mpsc::Sender<super::app::AsyncTaskResult>>,

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

    pub notifications: Vec<crate::dto::GuiNotification>,
    pub previous_compliance_score: Option<f32>,
    pub audit_trail_search: String,
    pub audit_trail_filter: Option<String>,
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

            notifications: Vec::new(),
            previous_compliance_score: None,
            audit_trail_search: String::new(),
            audit_trail_filter: None,
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

    /// Process an event from the agent runtime.
    pub fn apply_event(&mut self, event: crate::events::AgentEvent) {
        use crate::events::AgentEvent;

        match event {
            AgentEvent::StatusChanged { summary } => {
                self.summary = summary;
            }
            AgentEvent::CheckCompleted { result } => {
                if let Some(existing) = self
                    .checks
                    .iter_mut()
                    .find(|c| c.check_id == result.check_id)
                {
                    *existing = result;
                } else {
                    self.checks.push(result);
                }
                self.recompute_policy();
            }
            AgentEvent::ResourceUpdate { usage } => {
                const MAX_HISTORY: usize = 300;
                let t = self.resources.uptime_secs as f64;

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
            AgentEvent::Notification { notification } => {
                self.logs.push_front(crate::dto::GuiLogEntry {
                    id: notification.id,
                    timestamp: notification.timestamp,
                    level: notification.severity.clone(),
                    message: notification.title.clone(),
                    source: None,
                });
                self.logs.truncate(200);
            }
            AgentEvent::SyncStatus {
                syncing,
                pending_count,
                last_sync_at,
                error,
            } => {
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
            AgentEvent::NetworkUpdate {
                interfaces_count,
                connections_count,
                alerts_count,
                primary_ip,
                primary_mac,
            } => {
                self.network.interface_count = interfaces_count;
                self.network.connection_count = connections_count;
                self.network.alert_count = alerts_count;
                self.network.primary_ip = primary_ip;
                self.network.primary_mac = primary_mac;
                self.network.last_scan = Some(chrono::Utc::now());
            }
            AgentEvent::NetworkDetailUpdate {
                interfaces,
                connections,
            } => {
                self.network.interfaces = interfaces;
                self.network.connections = connections;
            }
            AgentEvent::VulnerabilityUpdate { summary } => {
                self.vulnerability_summary = Some(summary);
            }
            AgentEvent::SoftwareUpdate { packages } => {
                self.software.packages = packages;
            }
            AgentEvent::VulnerabilityFindings { findings } => {
                self.vulnerability_findings = findings;
            }
            AgentEvent::TerminalLog { entry } => {
                self.terminal.event_count += 1;
                if entry.level == "ERROR" {
                    self.terminal.error_count += 1;
                }
                self.terminal.lines.push_back(entry);
                while self.terminal.lines.len() > 500 {
                    self.terminal.lines.pop_front();
                }
            }
            AgentEvent::DiscoveryUpdate { devices } => {
                self.discovery.devices = devices;
                self.discovery.in_progress = false;
                self.discovery.progress = 1.0;
                self.discovery.phase = "Terminée".to_string();
                self.cartography.layout = None; 
            }
            AgentEvent::DiscoveryProgress {
                phase,
                progress,
                ..
            } => {
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
            }
            AgentEvent::UsbEvent { event } => {
                self.threats.usb_events.push_front(event);
                self.threats.usb_events.truncate(200);
            }
            AgentEvent::SuspiciousProcess { process } => {
                self.threats.suspicious_processes.push_front(process);
                self.threats.suspicious_processes.truncate(200);
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
        }
    }

    fn recompute_policy(&mut self) {
        use crate::dto::{GuiCheckStatus, GuiPolicySummary};
        let total = self.checks.len() as u32;
        let (mut passing, mut failing, mut errors) = (0u32, 0u32, 0u32);
        for c in &self.checks {
            match c.status {
                GuiCheckStatus::Pass => passing += 1,
                GuiCheckStatus::Fail => failing += 1,
                GuiCheckStatus::Error => errors += 1,
                _ => {}
            }
        }
        let pending = total - passing - failing - errors;

        self.summary.compliance_score = if total > 0 {
            Some((passing as f32 / total as f32) * 100.0)
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
