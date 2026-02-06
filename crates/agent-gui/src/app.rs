//! Sentinel Agent application shell.
//!
//! Manages the eframe window, routing, state, and event channels between
//! the GUI and the agent runtime.

use std::sync::mpsc;

// ---------------------------------------------------------------------------
// macOS: toggle Dock icon visibility when hiding/showing the window.
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
mod macos_dock {
    //! Toggle macOS Dock icon by changing NSApplication activation policy.
    //!
    //! objc_msgSend must NOT be declared variadic on ARM64 -- the ABI puts
    //! variadic args on the stack, but the ObjC runtime expects registers.
    //! We use typed function-pointer transmutes instead.

    use std::ffi::c_void;

    #[link(name = "AppKit", kind = "framework")]
    unsafe extern "C" {}

    unsafe extern "C" {
        fn objc_getClass(name: *const u8) -> *mut c_void;
        fn sel_registerName(name: *const u8) -> *mut c_void;
        // Declared without args -- we transmute to the right signature.
        fn objc_msgSend();
    }

    type MsgSend0 = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
    type MsgSend1 = unsafe extern "C" fn(*mut c_void, *mut c_void, isize) -> *mut c_void;

    fn send0() -> MsgSend0 {
        unsafe { std::mem::transmute(objc_msgSend as *const ()) }
    }
    fn send1() -> MsgSend1 {
        unsafe { std::mem::transmute(objc_msgSend as *const ()) }
    }

    unsafe fn set_activation_policy(policy: isize) {
        unsafe {
            let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
            let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
            let app = send0()(cls, sel);
            let sel = sel_registerName(c"setActivationPolicy:".as_ptr() as *const _);
            send1()(app, sel, policy);
        }
    }

    /// Hide the app from the macOS Dock (Accessory policy).
    pub fn hide_dock_icon() {
        unsafe {
            set_activation_policy(1);
        }
    }

    /// Show the app in the macOS Dock (Regular policy) and activate it.
    pub fn show_dock_icon() {
        unsafe {
            set_activation_policy(0);
            let cls = objc_getClass(c"NSApplication".as_ptr() as *const _);
            let sel = sel_registerName(c"sharedApplication".as_ptr() as *const _);
            let app = send0()(cls, sel);
            let sel = sel_registerName(c"activateIgnoringOtherApps:".as_ptr() as *const _);
            send1()(app, sel, 1);
        }
    }
}

use eframe::egui;

use crate::dto::{
    AgentSummary, GuiAgentStatus, GuiCheckResult, GuiLogEntry, GuiPolicySummary, GuiResourceUsage,
    GuiSoftwarePackage, GuiVulnerabilityFinding, GuiVulnerabilitySummary,
};
use crate::enrollment::{EnrollmentCommand, EnrollmentWizard};
use crate::events::{AgentEvent, GuiCommand};
use crate::icons;
use crate::pages;
use crate::theme;
use crate::tray_bridge::{TrayAction, TrayBridge};
use crate::widgets;

// ============================================================================
// Router
// ============================================================================

/// Application pages.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Page {
    Dashboard,
    Monitoring,
    Compliance,
    Software,
    Vulnerabilities,
    FileIntegrity,
    Threats,
    AuditTrail,
    Network,
    Sync,
    Terminal,
    Discovery,
    Cartography,
    Notifications,
    Settings,
    About,
}

// ============================================================================
// App state
// ============================================================================

/// Sync history entry for the sync page.
#[derive(Debug, Clone)]
pub struct SyncHistoryEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub success: bool,
    pub message: String,
}

/// Shared application state consumed by all pages.
pub struct AppState {
    pub summary: AgentSummary,
    pub resources: GuiResourceUsage,
    pub checks: Vec<GuiCheckResult>,
    pub logs: std::collections::VecDeque<GuiLogEntry>,
    pub policy: GuiPolicySummary,
    pub vulnerability_summary: Option<GuiVulnerabilitySummary>,

    // Software inventory
    pub software_packages: Vec<GuiSoftwarePackage>,
    pub macos_apps: Vec<crate::dto::GuiMacOsApp>,

    // Vulnerability findings
    pub vulnerability_findings: Vec<GuiVulnerabilityFinding>,

    // Network state
    pub network_interfaces: u32,
    pub network_connections: u32,
    pub network_alerts: u32,
    pub primary_ip: Option<String>,
    pub primary_mac: Option<String>,
    pub last_network_scan: Option<chrono::DateTime<chrono::Utc>>,
    pub network_interface_list: Vec<crate::dto::GuiNetworkInterface>,
    pub network_connection_list: Vec<crate::dto::GuiNetworkConnection>,
    pub network_connection_search: String,

    // Sync state
    pub sync_in_progress: bool,
    pub sync_error: Option<String>,
    pub sync_history: std::collections::VecDeque<SyncHistoryEntry>,

    // Terminal state
    pub terminal_lines: std::collections::VecDeque<crate::events::TerminalLogEntry>,
    pub terminal_auto_scroll: bool,
    pub terminal_filter_level: crate::dto::LogLevel,
    pub terminal_search: String,
    pub terminal_event_count: u64,
    pub terminal_error_count: u64,

    // Discovery state
    pub discovered_devices: Vec<crate::dto::GuiDiscoveredDevice>,
    pub discovery_in_progress: bool,
    pub discovery_progress: f32,
    pub discovery_phase: String,
    pub discovery_enabled: bool,

    // Cartography state
    pub graph_layout: Option<crate::pages::cartography::GraphLayout>,
    pub graph_zoom: f32,
    pub graph_pan: egui::Vec2,
    pub graph_selected_device: Option<String>,

    // Settings state
    pub is_paused: bool,
    pub server_url: String,
    pub check_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
    pub log_level: crate::dto::LogLevel,
    pub dark_mode: bool,
    pub update_status: crate::dto::UpdateStatus,

    // Software page tab state
    pub software_active_tab: crate::dto::SoftwareTab,

    // Search/filter state per page
    pub compliance_search: String,
    pub compliance_status_filter: Option<crate::dto::GuiCheckStatus>,
    pub compliance_group_by: crate::dto::ComplianceGroupBy,
    pub vulnerability_search: String,
    pub vulnerability_severity_filter: Option<crate::dto::Severity>,
    pub software_search: String,
    pub discovery_search: String,

    // Notifications
    pub notifications: Vec<crate::dto::GuiNotification>,
    pub unread_notification_count: u32,

    // Compliance trending
    pub previous_compliance_score: Option<f32>,

    // Monitoring history (VecDeque for O(1) removal at front)
    pub cpu_history: std::collections::VecDeque<[f64; 2]>,
    pub memory_history: std::collections::VecDeque<[f64; 2]>,
    pub disk_io_history: std::collections::VecDeque<[f64; 2]>,
    pub network_io_history: std::collections::VecDeque<[f64; 2]>,

    // FIM (File Integrity Monitoring)
    pub fim_monitored_count: u32,
    pub fim_changes_today: u32,
    pub fim_alerts: std::collections::VecDeque<crate::dto::GuiFimAlert>,
    pub fim_search: String,
    pub fim_filter: Option<String>,

    // Threats / Security events
    pub suspicious_processes: std::collections::VecDeque<crate::dto::GuiSuspiciousProcess>,
    pub usb_events: std::collections::VecDeque<crate::dto::GuiUsbEvent>,
    pub threats_search: String,
    pub threats_filter: Option<String>,
    pub audit_trail_search: String,
    pub audit_trail_filter: Option<String>,

    // Toast notifications
    pub toasts: Vec<crate::widgets::toast::Toast>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            summary: AgentSummary {
                status: GuiAgentStatus::Starting,
                version: agent_common::constants::AGENT_VERSION.to_string(),
                hostname: hostname_or_unknown(),
                agent_id: None,
                organization: None,
                compliance_score: None,
                last_check_at: None,
                last_sync_at: None,
                pending_sync_count: 0,
                uptime_secs: 0,
                active_frameworks: None,
            },
            resources: GuiResourceUsage {
                cpu_percent: 0.0,
                memory_percent: 0.0,
                memory_used_mb: 0,
                memory_total_mb: 0,
                disk_iops: 0,
                uptime_secs: 0,
                disk_percent: 0.0,
                network_io_bytes: 0,
            },
            checks: Vec::new(),
            logs: std::collections::VecDeque::new(),
            policy: GuiPolicySummary {
                total_policies: 0,
                passing: 0,
                failing: 0,
                errors: 0,
                pending: 0,
            },
            vulnerability_summary: None,
            software_packages: Vec::new(),
            macos_apps: Vec::new(),
            vulnerability_findings: Vec::new(),
            network_interfaces: 0,
            network_connections: 0,
            network_alerts: 0,
            primary_ip: None,
            primary_mac: None,
            last_network_scan: None,
            network_interface_list: Vec::new(),
            network_connection_list: Vec::new(),
            network_connection_search: String::new(),
            terminal_lines: std::collections::VecDeque::new(),
            terminal_auto_scroll: true,
            terminal_filter_level: crate::dto::LogLevel::Info,
            terminal_search: String::new(),
            terminal_event_count: 0,
            terminal_error_count: 0,
            sync_in_progress: false,
            sync_error: None,
            sync_history: std::collections::VecDeque::new(),
            discovered_devices: Vec::new(),
            discovery_in_progress: false,
            discovery_progress: 0.0,
            discovery_phase: String::new(),
            discovery_enabled: false,
            graph_layout: None,
            graph_zoom: 1.0,
            graph_pan: egui::Vec2::ZERO,
            graph_selected_device: None,
            is_paused: false,
            server_url: agent_common::constants::DEFAULT_SERVER_URL.to_string(),
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            heartbeat_interval_secs: agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS,
            log_level: crate::dto::LogLevel::Info,
            dark_mode: true,
            update_status: crate::dto::UpdateStatus::Idle,
            software_active_tab: crate::dto::SoftwareTab::default(),
            compliance_search: String::new(),
            compliance_status_filter: None,
            compliance_group_by: crate::dto::ComplianceGroupBy::default(),
            vulnerability_search: String::new(),
            vulnerability_severity_filter: None,
            software_search: String::new(),
            discovery_search: String::new(),
            notifications: Vec::new(),
            unread_notification_count: 0,
            previous_compliance_score: None,
            cpu_history: std::collections::VecDeque::new(),
            memory_history: std::collections::VecDeque::new(),
            disk_io_history: std::collections::VecDeque::new(),
            network_io_history: std::collections::VecDeque::new(),
            fim_monitored_count: 0,
            fim_changes_today: 0,
            fim_alerts: std::collections::VecDeque::new(),
            fim_search: String::new(),
            fim_filter: None,
            suspicious_processes: std::collections::VecDeque::new(),
            usb_events: std::collections::VecDeque::new(),
            threats_search: String::new(),
            threats_filter: None,
            audit_trail_search: String::new(),
            audit_trail_filter: None,
            toasts: Vec::new(),
        }
    }
}

impl AppState {
    /// Push a toast notification with the current egui time.
    pub fn push_toast(&mut self, toast: crate::widgets::toast::Toast, ctx: &egui::Context) {
        let time = ctx.input(|i| i.time);
        self.toasts.push(toast.with_time(time));
        // Keep at most 5 toasts visible (remove oldest first)
        while self.toasts.len() > 5 {
            self.toasts.remove(0);
        }
    }
}

fn hostname_or_unknown() -> String {
    hostname::get()
        .map(|h: std::ffi::OsString| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "inconnu".to_string())
}

// ============================================================================
// SentinelApp
// ============================================================================

/// Main eframe application.
pub struct SentinelApp {
    page: Page,
    state: AppState,
    enrolled: bool,
    enrollment_wizard: EnrollmentWizard,
    theme_applied: bool,

    /// Track previous dark_mode to detect toggles.
    last_dark_mode: bool,

    // Channels to/from agent runtime.
    event_rx: mpsc::Receiver<AgentEvent>,
    command_tx: mpsc::Sender<GuiCommand>,

    // Enrollment channel (sent back to runtime).
    enrollment_tx: mpsc::Sender<EnrollmentCommand>,

    // Tray bridge (optional -- only on desktop).
    _tray: Option<TrayBridge>,

    // Window visibility (close = hide).
    visible: bool,

    // Flag to bypass "hide to tray" and actually quit.
    quit_requested: bool,

    // Splash screen timing.
    splash_start: std::time::Instant,
    splash_done: bool,

    /// Whether to show the premium "Satellite" tray dashboard view.
    show_tray_satellite: bool,

    /// Page transition animation progress (0.0 = just switched, 1.0 = fully visible).
    page_transition: f32,
}

impl SentinelApp {
    /// Create a new `SentinelApp`.
    pub fn new(
        enrolled: bool,
        event_rx: std::sync::mpsc::Receiver<crate::events::AgentEvent>,
        command_tx: std::sync::mpsc::Sender<crate::events::GuiCommand>,
        enrollment_tx: std::sync::mpsc::Sender<crate::enrollment::EnrollmentCommand>,
    ) -> Self {
        Self::new_with_mode(enrolled, event_rx, command_tx, enrollment_tx, false)
    }

    /// Create a new SentinelApp instance with tray popup mode.
    pub fn new_tray_popup(
        enrolled: bool,
        event_rx: std::sync::mpsc::Receiver<crate::events::AgentEvent>,
        command_tx: std::sync::mpsc::Sender<crate::events::GuiCommand>,
        enrollment_tx: std::sync::mpsc::Sender<crate::enrollment::EnrollmentCommand>,
    ) -> Self {
        Self::new_with_mode(enrolled, event_rx, command_tx, enrollment_tx, true)
    }

    /// Internal constructor with mode flag.
    fn new_with_mode(
        enrolled: bool,
        event_rx: std::sync::mpsc::Receiver<crate::events::AgentEvent>,
        command_tx: std::sync::mpsc::Sender<crate::events::GuiCommand>,
        enrollment_tx: std::sync::mpsc::Sender<crate::enrollment::EnrollmentCommand>,
        is_tray_popup: bool,
    ) -> Self {
        let tray = TrayBridge::new().ok();
        if tray.is_none() {
            tracing::warn!("System tray not available");
        }

        Self {
            page: Page::Dashboard,
            state: AppState::default(),
            enrolled,
            enrollment_wizard: EnrollmentWizard::default(),
            theme_applied: false,
            last_dark_mode: true,
            event_rx,
            command_tx,
            enrollment_tx,
            _tray: tray,
            visible: true,
            quit_requested: false,
            splash_start: std::time::Instant::now(),
            splash_done: false,
            show_tray_satellite: is_tray_popup,
            page_transition: 1.0,
        }
    }

    /// Configure the eframe `NativeOptions`.
    pub fn native_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel Agent")
                .with_inner_size([1280.0, 750.0])
                .with_min_inner_size([800.0, 600.0])
                .with_icon(Self::load_app_icon()),
            ..Default::default()
        }
    }

    /// Configure compact options for tray menu popup.
    pub fn tray_popup_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel - Vue Rapide")
                .with_inner_size([400.0, 500.0])
                .with_min_inner_size([350.0, 400.0])
                .with_max_inner_size([600.0, 800.0])
                .with_icon(Self::load_app_icon())
                .with_decorations(false) // No title bar for menu-like feel
                .with_transparent(true),
            ..Default::default()
        }
    }

    /// Decode embedded PNG app icon into egui IconData.
    fn load_app_icon() -> egui::IconData {
        static ICON_PNG: &[u8] = include_bytes!("../assets/app-icon.png");
        // Safety: the PNG is embedded at compile time via include_bytes!, so it is
        // always a valid image. This expect is unreachable unless the asset is corrupted
        // at build time, which would be a build error.
        let img = image::load_from_memory(ICON_PNG).expect("embedded app icon is valid PNG");
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();
        egui::IconData {
            rgba: rgba.into_raw(),
            width: w,
            height: h,
        }
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /// Drain incoming events from the agent runtime.
    fn process_events(&mut self) {
        while let Ok(event) = self.event_rx.try_recv() {
            match event {
                AgentEvent::StatusChanged { summary } => {
                    self.state.summary = summary;
                }
                AgentEvent::CheckCompleted { result } => {
                    // Update or insert check result
                    if let Some(existing) = self
                        .state
                        .checks
                        .iter_mut()
                        .find(|c| c.check_id == result.check_id)
                    {
                        *existing = result;
                    } else {
                        self.state.checks.push(result);
                    }
                    // Recompute policy summary
                    self.recompute_policy();
                }
                AgentEvent::ResourceUpdate { usage } => {
                    const MAX_HISTORY: usize = 300;
                    let t = self.state.resources.uptime_secs as f64;

                    // Only push valid data to monitoring history (ignore initial 0.0 values)
                    if usage.cpu_percent > 0.0 {
                        self.state.cpu_history.push_back([t, usage.cpu_percent]);
                        while self.state.cpu_history.len() > MAX_HISTORY {
                            self.state.cpu_history.pop_front();
                        }
                    }
                    if usage.memory_percent > 0.0 {
                        self.state.memory_history.push_back([t, usage.memory_percent]);
                        while self.state.memory_history.len() > MAX_HISTORY {
                            self.state.memory_history.pop_front();
                        }
                    }
                    if usage.disk_iops > 0 {
                        self.state.disk_io_history.push_back([t, usage.disk_iops as f64]);
                        while self.state.disk_io_history.len() > MAX_HISTORY {
                            self.state.disk_io_history.pop_front();
                        }
                    }
                    if usage.network_io_bytes > 0 {
                        self.state
                            .network_io_history
                            .push_back([t, usage.network_io_bytes as f64 / 1024.0]);
                        while self.state.network_io_history.len() > MAX_HISTORY {
                            self.state.network_io_history.pop_front();
                        }
                    }

                    self.state.resources = usage;
                }
                AgentEvent::Notification { notification } => {
                    // Add as log entry for now (O(1) push_front with VecDeque)
                    self.state.logs.push_front(GuiLogEntry {
                        id: notification.id,
                        timestamp: notification.timestamp,
                        level: notification.severity.clone(),
                        message: notification.title.clone(),
                        source: None,
                    });
                    // Keep max 200 log entries
                    self.state.logs.truncate(200);
                }
                AgentEvent::SyncStatus {
                    syncing,
                    pending_count,
                    last_sync_at,
                    error,
                } => {
                    self.state.sync_in_progress = syncing;
                    self.state.summary.pending_sync_count = pending_count;
                    if let Some(ts) = last_sync_at {
                        self.state.summary.last_sync_at = Some(ts);
                        self.state.sync_history.push_front(SyncHistoryEntry {
                            timestamp: ts,
                            success: error.is_none(),
                            message: error.clone().unwrap_or_else(|| {
                                "Synchronisation termin\u{00e9}e".to_string()
                            }),
                        });
                        self.state.sync_history.truncate(50);
                    }
                    self.state.sync_error = error;
                }
                AgentEvent::NetworkUpdate {
                    interfaces_count,
                    connections_count,
                    alerts_count,
                    primary_ip,
                    primary_mac,
                } => {
                    self.state.network_interfaces = interfaces_count;
                    self.state.network_connections = connections_count;
                    self.state.network_alerts = alerts_count;
                    self.state.primary_ip = primary_ip;
                    self.state.primary_mac = primary_mac;
                    self.state.last_network_scan = Some(chrono::Utc::now());
                }
                AgentEvent::NetworkDetailUpdate {
                    interfaces,
                    connections,
                } => {
                    self.state.network_interface_list = interfaces;
                    self.state.network_connection_list = connections;
                }
                AgentEvent::VulnerabilityUpdate { summary } => {
                    self.state.vulnerability_summary = Some(summary);
                }
                AgentEvent::SoftwareUpdate { packages } => {
                    self.state.software_packages = packages;
                }
                AgentEvent::VulnerabilityFindings { findings } => {
                    self.state.vulnerability_findings = findings;
                }
                AgentEvent::TerminalLog { entry } => {
                    self.state.terminal_event_count += 1;
                    if entry.level == "ERROR" {
                        self.state.terminal_error_count += 1;
                    }
                    self.state.terminal_lines.push_back(entry);
                    // Ring buffer: keep max 500 lines
                    while self.state.terminal_lines.len() > 500 {
                        self.state.terminal_lines.pop_front();
                    }
                }
                AgentEvent::DiscoveryUpdate { devices } => {
                    self.state.discovered_devices = devices;
                    self.state.discovery_in_progress = false;
                    self.state.discovery_progress = 1.0;
                    self.state.discovery_phase = "Termin\u{00e9}".to_string();
                    self.state.graph_layout = None; // Force graph re-layout
                }
                AgentEvent::DiscoveryProgress {
                    phase,
                    progress,
                    devices_found: _,
                } => {
                    self.state.discovery_phase = phase;
                    self.state.discovery_progress = progress;
                    // Don't reset devices here, they come in DiscoveryUpdate
                }
                AgentEvent::EnrollmentResult {
                    success,
                    message,
                    agent_id,
                } => {
                    self.enrollment_wizard.set_result(success, message);
                    if success && let Some(id) = agent_id {
                        self.state.summary.agent_id = Some(id);
                    }
                }
                AgentEvent::FimAlert { alert } => {
                    self.state.fim_alerts.push_front(alert);
                    self.state.fim_alerts.truncate(500);
                }
                AgentEvent::UsbEvent { event } => {
                    self.state.usb_events.push_front(event);
                    self.state.usb_events.truncate(200);
                }
                AgentEvent::SuspiciousProcess { process } => {
                    self.state.suspicious_processes.push_front(process);
                    self.state.suspicious_processes.truncate(200);
                }
                AgentEvent::FimStats {
                    monitored_count,
                    changes_today,
                } => {
                    self.state.fim_monitored_count = monitored_count;
                    self.state.fim_changes_today = changes_today;
                }
                AgentEvent::ShuttingDown => {
                    // Runtime is shutting down
                }
                AgentEvent::UpdateStatusChanged { status } => {
                    self.state.update_status = status;
                }
            }
        }
    }

    /// Handle tray menu actions.
    fn process_tray_actions(&mut self, ctx: &egui::Context) {
        for action in TrayBridge::poll_events() {
            match action {
                TrayAction::ShowWindow => {
                    self.show_tray_satellite = false;
                    #[cfg(target_os = "macos")]
                    macos_dock::show_dock_icon();
                    self.visible = true;
                    ctx.send_viewport_cmd(egui::ViewportCommand::Visible(true));
                    ctx.send_viewport_cmd(egui::ViewportCommand::Focus);
                }
                TrayAction::QuickStatus => {
                    self.show_tray_satellite = !self.show_tray_satellite;
                    if self.show_tray_satellite {
                        self.visible = true;
                        ctx.send_viewport_cmd(egui::ViewportCommand::Visible(true));
                        // Borderless satellite style
                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(false));
                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
                            320.0, 480.0,
                        )));
                    } else {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(true));
                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
                            1280.0, 750.0,
                        )));
                    }
                }
                TrayAction::RunCheck => {
                    self.send_command(GuiCommand::RunCheck);
                }
                TrayAction::ForceSync => {
                    self.send_command(GuiCommand::ForceSync);
                }
                TrayAction::Quit => {
                    self.quit_requested = true;
                    self.send_command(GuiCommand::Shutdown);
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
        }
    }

    fn recompute_policy(&mut self) {
        use crate::dto::GuiCheckStatus;
        let total = self.state.checks.len() as u32;
        let passing = self
            .state
            .checks
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Pass)
            .count() as u32;
        let failing = self
            .state
            .checks
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Fail)
            .count() as u32;
        let errors = self
            .state
            .checks
            .iter()
            .filter(|c| c.status == GuiCheckStatus::Error)
            .count() as u32;
        let pending = total - passing - failing - errors;

        self.state.policy = GuiPolicySummary {
            total_policies: total,
            passing,
            failing,
            errors,
            pending,
        };

        // Update compliance score
        if total > 0 {
            self.state.summary.compliance_score = Some((passing as f32 / total as f32) * 100.0);
        }
    }

    fn send_command(&self, cmd: GuiCommand) {
        if let Err(e) = self.command_tx.send(cmd) {
            tracing::warn!("Failed to send GUI command: {}", e);
        }
    }

    /// Render the premium satellite tray view.
    fn show_tray_satellite_view(&mut self, ctx: &egui::Context) {
        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(0.0),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                ui.vertical(|ui: &mut egui::Ui| {
                    // Title Bar (Satellite style)
                    widgets::card(ui, |ui: &mut egui::Ui| {
                        ui.horizontal(|ui: &mut egui::Ui| {
                            ui.label(egui::RichText::new(icons::SHIELD).color(theme::ACCENT));
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("RAPPORT CYBER RAPIDE")
                                    .font(theme::font_title())
                                    .size(11.0)
                                    .strong(),
                            );
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui: &mut egui::Ui| {
                                    if ui.button(icons::XMARK).clicked() {
                                        self.show_tray_satellite = false;
                                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(
                                            true,
                                        ));
                                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(
                                            egui::vec2(1280.0, 750.0),
                                        ));
                                    }
                                    if ui.button(icons::EXTERNAL_LINK).clicked() {
                                        self.show_tray_satellite = false;
                                        self.visible = true;
                                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(
                                            true,
                                        ));
                                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(
                                            egui::vec2(1280.0, 750.0),
                                        ));
                                    }
                                },
                            );
                        });
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Radar Chart Section
                    ui.vertical(|ui: &mut egui::Ui| {
                        let compliance = self.state.summary.compliance_score.unwrap_or(0.0) / 100.0;
                        let threats =
                            1.0 - (self.state.suspicious_processes.len() as f32 / 10.0).min(1.0);
                        let vulns =
                            1.0 - (self.state.vulnerability_findings.len() as f32 / 20.0).min(1.0);
                        let resources = 1.0 - (self.state.resources.cpu_percent / 100.0).min(1.0);
                        let network = 1.0 - (self.state.network_alerts as f32 / 5.0).min(1.0);

                        let radar = widgets::TrayRadar::new(
                            compliance,
                            threats,
                            vulns,
                            resources as f32,
                            network,
                        );
                        radar.show(ui, 240.0);
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Quick Stats Cards
                    ui.horizontal(|ui: &mut egui::Ui| {
                        widgets::card(ui, |ui: &mut egui::Ui| {
                            ui.set_width(135.0);
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(egui::RichText::new("SCORE").font(theme::font_small()));
                                ui.add_space(4.0);
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{:.0}%",
                                        self.state.summary.compliance_score.unwrap_or(0.0)
                                    ))
                                    .font(theme::font_title())
                                    .color(theme::ACCENT),
                                );
                            });
                        });
                        ui.add_space(theme::SPACE_MD);
                        widgets::card(ui, |ui: &mut egui::Ui| {
                            ui.set_width(135.0);
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(egui::RichText::new("MENACES").font(theme::font_small()));
                                ui.add_space(4.0);
                                let count = self.state.suspicious_processes.len();
                                ui.label(
                                    egui::RichText::new(count.to_string())
                                        .font(theme::font_title())
                                        .color(if count > 0 {
                                            theme::ERROR
                                        } else {
                                            theme::SUCCESS
                                        }),
                                );
                            });
                        });
                    });

                    ui.add_space(theme::SPACE_LG);

                    // Actions
                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        if ui.button("LANCER UNE ANALYSE COMPLÈTE").clicked() {
                            self.send_command(GuiCommand::RunCheck);
                        }
                    });
                });
            });
    }
}

// ============================================================================
// eframe::App implementation
// ============================================================================

impl eframe::App for SentinelApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Apply theme once on first frame, and re-apply when dark_mode toggles.
        if !self.theme_applied {
            theme::configure_fonts(ctx);
            theme::apply_theme(ctx, self.state.dark_mode);
            egui_extras::install_image_loaders(ctx);
            // Scan macOS native apps once
            self.state.macos_apps = scan_macos_apps();
            self.theme_applied = true;
            self.last_dark_mode = self.state.dark_mode;
        } else if self.state.dark_mode != self.last_dark_mode {
            theme::apply_theme(ctx, self.state.dark_mode);
            self.last_dark_mode = self.state.dark_mode;
        }

        // Process incoming events.
        self.process_events();
        self.process_tray_actions(ctx);

        // ── Splash screen (first ~2.5 seconds) ──
        if !self.splash_done && !self.show_tray_satellite {
            let elapsed = self.splash_start.elapsed().as_secs_f32();
            if elapsed < 2.5 {
                self.show_splash(ctx, elapsed);
                ctx.request_repaint();
                return;
            }
            self.splash_done = true;
        }

        // Handle close = hide to tray (instead of quit).
        if ctx.input(|i| i.viewport().close_requested()) && !self.quit_requested {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            ctx.send_viewport_cmd(egui::ViewportCommand::Visible(false));
            self.visible = false;
            #[cfg(target_os = "macos")]
            macos_dock::hide_dock_icon();
        }

        if !self.visible {
            // Don't render when hidden, but keep processing events.
            // Request a low-rate repaint so we still check tray events.
            ctx.request_repaint_after(std::time::Duration::from_secs(1));
            return;
        }

        // ── Enrollment wizard (shown instead of main UI when not enrolled) ──
        if !self.enrolled {
            egui::CentralPanel::default()
                .frame(
                    egui::Frame::new()
                        .fill(theme::bg_primary())
                        .inner_margin(0.0),
                )
                .show(ctx, |ui: &mut egui::Ui| {
                    if let Some(cmd) = self.enrollment_wizard.show(ui) {
                        match &cmd {
                            EnrollmentCommand::Finish => {
                                // If enrollment completed successfully, switch to main UI.
                                if let crate::enrollment::EnrollmentStep::Complete {
                                    success: true,
                                    ..
                                } = &self.enrollment_wizard.step
                                {
                                    self.enrolled = true;
                                }
                            }
                            EnrollmentCommand::Cancel => {
                                // Exit the app if user cancels enrollment.
                                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                            }
                            _ => {}
                        }
                        let _ = self.enrollment_tx.send(cmd);
                    }
                });
            ctx.request_repaint_after(std::time::Duration::from_millis(100));
            return;
        }

        // ── Satellite Tray View (Premium Animated Radar) ──
        if self.show_tray_satellite {
            self.show_tray_satellite_view(ctx);
            // In satellite mode, we might want to still have the main window hidden or shown.
            // For now, if satellite is on, we take over the whole frame (borderless small window style).
            return;
        }

        // ── Main UI ──

        // Keyboard shortcuts for page navigation
        if let Some(new_page) = ctx.input(|i| {
            if i.modifiers.command {
                if i.key_pressed(egui::Key::Num1) {
                    Some(Page::Dashboard)
                } else if i.key_pressed(egui::Key::Num2) {
                    Some(Page::Compliance)
                } else if i.key_pressed(egui::Key::Num3) {
                    Some(Page::Vulnerabilities)
                } else if i.key_pressed(egui::Key::Num4) {
                    Some(Page::Software)
                } else if i.key_pressed(egui::Key::Num5) {
                    Some(Page::Network)
                } else if i.key_pressed(egui::Key::Num6) {
                    Some(Page::FileIntegrity)
                } else if i.key_pressed(egui::Key::Num7) {
                    Some(Page::Threats)
                } else if i.key_pressed(egui::Key::Num8) {
                    Some(Page::Settings)
                } else {
                    None
                }
            } else {
                None
            }
        }) && new_page != self.page
        {
            self.page = new_page;
            self.page_transition = 0.0;
        }

        // Cmd+R = Run check, Cmd+Shift+S = Force sync
        if ctx.input(|i| i.modifiers.command && !i.modifiers.shift && i.key_pressed(egui::Key::R)) {
            self.send_command(GuiCommand::RunCheck);
        }
        if ctx.input(|i| i.modifiers.command && i.modifiers.shift && i.key_pressed(egui::Key::S)) {
            self.send_command(GuiCommand::ForceSync);
        }

        // Sidebar
        egui::SidePanel::left("sidebar")
            .exact_width(theme::SIDEBAR_WIDTH)
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_sidebar())
                    .stroke(egui::Stroke::new(0.5, theme::border())),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                let scanning = self.state.summary.status == crate::dto::GuiAgentStatus::Scanning;
                let sync_state = widgets::sidebar::SidebarSyncState {
                    syncing: self.state.sync_in_progress,
                    pending_count: self.state.summary.pending_sync_count,
                    last_sync_at: self.state.summary.last_sync_at,
                    error: self.state.sync_error.clone(),
                };
                if let Some(new_page) = widgets::Sidebar::show(
                    ui,
                    &self.page,
                    scanning,
                    self.state.unread_notification_count,
                    &sync_state,
                    self.state.summary.organization.as_deref(),
                ) && new_page != self.page
                {
                    self.page = new_page;
                    self.page_transition = 0.0;
                }
            });

        // Advance page transition animation
        if self.page_transition < 1.0 {
            let dt = ctx.input(|i| i.stable_dt).min(0.05);
            self.page_transition =
                (self.page_transition + dt / theme::PAGE_TRANSITION_DURATION).min(1.0);
            ctx.request_repaint();
        }

        // Content area – ScrollArea is here so the scrollbar sits at the
        // window edge while content keeps a 24 px right margin.
        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(egui::Margin {
                        left: 24,
                        right: 0,
                        top: 24,
                        bottom: 24,
                    }),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                // Apply page transition fade-in
                let transition_alpha = self.page_transition;
                if transition_alpha < 1.0 {
                    ui.set_opacity(transition_alpha);
                }

                egui::ScrollArea::vertical()
                    .auto_shrink(egui::Vec2b::new(false, false))
                    .show(ui, |ui: &mut egui::Ui| {
                        egui::Frame::new()
                            .inner_margin(egui::Margin {
                                left: 0,
                                right: 24,
                                top: 0,
                                bottom: 0,
                            })
                            .show(ui, |ui: &mut egui::Ui| match self.page {
                                Page::Dashboard => {
                                    if let Some(cmd) = pages::DashboardPage::show(ui, &self.state) {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Monitoring => {
                                    if let Some(cmd) = pages::MonitoringPage::show(ui, &self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Compliance => {
                                    if let Some(cmd) =
                                        pages::CompliancePage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Software => {
                                    if let Some(cmd) =
                                        pages::SoftwarePage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Vulnerabilities => {
                                    if let Some(cmd) =
                                        pages::VulnerabilitiesPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::FileIntegrity => {
                                    if let Some(cmd) = pages::FimPage::show(ui, &mut self.state) {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Threats => {
                                    if let Some(cmd) = pages::ThreatsPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::AuditTrail => {
                                    if let Some(cmd) =
                                        pages::AuditTrailPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Network => {
                                    if let Some(cmd) = pages::NetworkPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Sync => {
                                    if let Some(cmd) = pages::SyncPage::show(ui, &self.state) {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Terminal => {
                                    if let Some(cmd) =
                                        pages::TerminalPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Discovery => {
                                    if let Some(cmd) =
                                        pages::DiscoveryPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Cartography => {
                                    if let Some(cmd) =
                                        pages::CartographyPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Notifications => {
                                    if let Some(cmd) =
                                        pages::NotificationsPage::show(ui, &mut self.state)
                                    {
                                        self.send_command(cmd);
                                    }
                                }
                                Page::Settings => {
                                    if let Some(cmd) =
                                        pages::SettingsPage::show(ui, &mut self.state)
                                    {
                                        if matches!(cmd, GuiCommand::Shutdown) {
                                            self.quit_requested = true;
                                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                                        }
                                        self.send_command(cmd);
                                    }
                                }
                                Page::About => {
                                    if let Some(cmd) = pages::AboutPage::show(ui) {
                                        self.send_command(cmd);
                                    }
                                }
                            });
                    });
            });

        // Render toast notifications (overlay on top of content)
        if !self.state.toasts.is_empty() {
            egui::Area::new(egui::Id::new("toast_overlay"))
                .fixed_pos(egui::pos2(0.0, 0.0))
                .order(egui::Order::Foreground)
                .show(ctx, |ui: &mut egui::Ui| {
                    let screen = ctx.screen_rect();
                    ui.set_min_size(screen.size());
                    self.state.toasts = widgets::render_toasts(ui, &self.state.toasts);
                });
        }

        // Request periodic repaint for event processing.
        ctx.request_repaint_after(std::time::Duration::from_millis(100));
    }
}

impl SentinelApp {
    /// Render the splash screen.
    fn show_splash(&self, ctx: &egui::Context, elapsed: f32) {
        // Fade in over 0.6s, hold, then fade out last 0.4s.
        let alpha = if elapsed < 0.6 {
            elapsed / 0.6
        } else if elapsed > 2.1 {
            1.0 - ((elapsed - 2.1) / 0.4).min(1.0)
        } else {
            1.0
        };
        let a = (alpha * 255.0) as u8;

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(theme::bg_primary()))
            .show(ctx, |ui: &mut egui::Ui| {
                let size = ui.available_size();
                ui.allocate_new_ui(
                    egui::UiBuilder::new().max_rect(egui::Rect::from_center_size(
                        egui::pos2(size.x / 2.0, size.y / 2.0),
                        egui::vec2(400.0, 360.0),
                    )),
                    |ui: &mut egui::Ui| {
                        ui.vertical_centered(|ui: &mut egui::Ui| {
                            // Logo image
                            let logo = egui::Image::from_bytes(
                                "bytes://ia_logo",
                                include_bytes!("../assets/IA.png"),
                            )
                            .max_width(120.0)
                            .tint(egui::Color32::from_white_alpha(a));
                            ui.add(logo);

                            ui.add_space(theme::SPACE_LG);

                            // SENTINEL
                            ui.label(
                                egui::RichText::new("SENTINEL")
                                    .font(egui::FontId::proportional(36.0))
                                    .color(theme::ACCENT.linear_multiply(alpha))
                                    .strong(),
                            );

                            ui.add_space(theme::SPACE_XS);

                            // GRC AGENT
                            ui.label(
                                egui::RichText::new("GRC AGENT")
                                    .font(theme::font_heading())
                                    .color(egui::Color32::from_rgba_premultiplied(
                                        theme::text_tertiary().r(),
                                        theme::text_tertiary().g(),
                                        theme::text_tertiary().b(),
                                        a,
                                    )),
                            );

                            ui.add_space(theme::SPACE_XL);

                            // Progress bar (animated)
                            let bar_w = 200.0;
                            let bar_h = 3.0;
                            let (bar_rect, _) = ui.allocate_exact_size(
                                egui::vec2(bar_w, bar_h),
                                egui::Sense::empty(),
                            );
                            let painter = ui.painter_at(bar_rect);
                            painter.rect_filled(
                                bar_rect,
                                egui::CornerRadius::same(2),
                                egui::Color32::from_white_alpha(15),
                            );
                            let progress = (elapsed / 2.5).min(1.0);
                            let fill_rect = egui::Rect::from_min_size(
                                bar_rect.min,
                                egui::vec2(bar_w * progress, bar_h),
                            );
                            painter.rect_filled(
                                fill_rect,
                                egui::CornerRadius::same(2),
                                theme::ACCENT.linear_multiply(alpha),
                            );

                            ui.add_space(theme::SPACE_LG);

                            // CYBER THREAT CONSULTING
                            ui.label(
                                egui::RichText::new("CYBER THREAT CONSULTING")
                                    .font(theme::font_small())
                                    .color(egui::Color32::from_rgba_premultiplied(
                                        theme::text_tertiary().r(),
                                        theme::text_tertiary().g(),
                                        theme::text_tertiary().b(),
                                        a,
                                    ))
                                    .strong(),
                            );
                        });
                    },
                );
            });
    }
}

// ============================================================================
// macOS native application scanner
// ============================================================================

/// Scan /Applications for .app bundles and extract metadata from Info.plist.
fn scan_macos_apps() -> Vec<crate::dto::GuiMacOsApp> {
    let mut apps = Vec::new();

    #[cfg(target_os = "macos")]
    {
        use std::path::Path;

        let apps_dir = Path::new("/Applications");
        if let Ok(entries) = std::fs::read_dir(apps_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("app") {
                    continue;
                }
                let plist_path = path.join("Contents/Info.plist");
                if !plist_path.exists() {
                    continue;
                }

                // Parse Info.plist (XML plist)
                let name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string();

                let (version, bundle_id, publisher) =
                    parse_info_plist(&plist_path).unwrap_or_default();

                apps.push(crate::dto::GuiMacOsApp {
                    name,
                    version: if version.is_empty() {
                        "--".to_string()
                    } else {
                        version
                    },
                    bundle_id: if bundle_id.is_empty() {
                        "--".to_string()
                    } else {
                        bundle_id
                    },
                    publisher: if publisher.is_empty() {
                        "--".to_string()
                    } else {
                        publisher
                    },
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    apps.sort_by(|a: &crate::dto::GuiMacOsApp, b: &crate::dto::GuiMacOsApp| {
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    apps
}

/// Parse an Info.plist file to extract version, bundle ID, and publisher.
#[cfg(target_os = "macos")]
fn parse_info_plist(path: &std::path::Path) -> Option<(String, String, String)> {
    // Use /usr/bin/plutil to convert binary plist to XML, then parse.
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-convert", "xml1", "-o", "-"])
        .arg(path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let xml = String::from_utf8_lossy(&output.stdout);

    fn extract_key(xml: &str, key: &str) -> String {
        let needle = format!("<key>{}</key>", key);
        if let Some(pos) = xml.find(&needle) {
            let after = &xml[pos + needle.len()..];
            // Skip whitespace and find the <string> tag
            if let Some(start) = after.find("<string>") {
                let val_start = start + "<string>".len();
                if let Some(end) = after[val_start..].find("</string>") {
                    return after[val_start..val_start + end].to_string();
                }
            }
        }
        String::new()
    }

    let version = extract_key(&xml, "CFBundleShortVersionString");
    let bundle_id = extract_key(&xml, "CFBundleIdentifier");
    // Try human-readable name first, fall back to copyright
    let publisher = {
        let name = extract_key(&xml, "CFBundleGetInfoString");
        if name.is_empty() {
            extract_key(&xml, "NSHumanReadableCopyright")
        } else {
            name
        }
    };

    Some((version, bundle_id, publisher))
}
