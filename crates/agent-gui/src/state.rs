//! Domain-specific sub-states for AppState.
//!
//! Each struct groups related fields by functional domain (network, discovery,
//! terminal, etc.) to keep `AppState` maintainable.

use eframe::egui;
use std::collections::VecDeque;

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
    pub history: VecDeque<super::app::SyncHistoryEntry>,
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
