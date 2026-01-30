//! Sentinel Agent application shell.
//!
//! Manages the eframe window, routing, state, and event channels between
//! the GUI and the agent runtime.

use std::sync::mpsc;

use eframe::egui;

use crate::dto::{
    AgentSummary, GuiAgentStatus, GuiCheckResult, GuiLogEntry, GuiPolicySummary,
    GuiResourceUsage, GuiSoftwarePackage, GuiVulnerabilityFinding, GuiVulnerabilitySummary,
};
use crate::enrollment::{EnrollmentCommand, EnrollmentWizard};
use crate::events::{AgentEvent, GuiCommand};
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
    Compliance,
    Software,
    Vulnerabilities,
    Network,
    Sync,
    Logs,
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
    pub logs: Vec<GuiLogEntry>,
    pub policy: GuiPolicySummary,
    pub vulnerability_summary: Option<GuiVulnerabilitySummary>,

    // Software inventory
    pub software_packages: Vec<GuiSoftwarePackage>,

    // Vulnerability findings
    pub vulnerability_findings: Vec<GuiVulnerabilityFinding>,

    // Network state
    pub network_interfaces: u32,
    pub network_connections: u32,
    pub network_alerts: u32,
    pub primary_ip: Option<String>,
    pub primary_mac: Option<String>,
    pub last_network_scan: Option<chrono::DateTime<chrono::Utc>>,

    // Sync state
    pub sync_in_progress: bool,
    pub sync_error: Option<String>,
    pub sync_history: Vec<SyncHistoryEntry>,

    // Settings state
    pub is_paused: bool,
    pub server_url: String,
    pub check_interval_secs: u64,
    pub heartbeat_interval_secs: u64,
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
            },
            resources: GuiResourceUsage {
                cpu_percent: 0.0,
                memory_percent: 0.0,
                memory_used_mb: 0,
                memory_total_mb: 0,
                disk_iops: 0,
                uptime_secs: 0,
                disk_percent: 0.0,
            },
            checks: Vec::new(),
            logs: Vec::new(),
            policy: GuiPolicySummary {
                total_policies: 0,
                passing: 0,
                failing: 0,
                errors: 0,
                pending: 0,
            },
            vulnerability_summary: None,
            software_packages: Vec::new(),
            vulnerability_findings: Vec::new(),
            network_interfaces: 0,
            network_connections: 0,
            network_alerts: 0,
            primary_ip: None,
            primary_mac: None,
            last_network_scan: None,
            sync_in_progress: false,
            sync_error: None,
            sync_history: Vec::new(),
            is_paused: false,
            server_url: agent_common::constants::DEFAULT_SERVER_URL.to_string(),
            check_interval_secs: agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
            heartbeat_interval_secs: agent_common::constants::DEFAULT_HEARTBEAT_INTERVAL_SECS,
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

    // Channels to/from agent runtime.
    event_rx: mpsc::Receiver<AgentEvent>,
    command_tx: mpsc::Sender<GuiCommand>,

    // Enrollment channel (sent back to runtime).
    enrollment_tx: mpsc::Sender<EnrollmentCommand>,

    // Tray bridge (optional -- only on desktop).
    _tray: Option<TrayBridge>,

    // Window visibility (close = hide).
    visible: bool,
}

impl SentinelApp {
    /// Create a new `SentinelApp`.
    ///
    /// # Arguments
    /// * `enrolled` -- Whether the agent is already enrolled.
    /// * `event_rx` -- Channel receiving events from the runtime.
    /// * `command_tx` -- Channel sending commands to the runtime.
    /// * `enrollment_tx` -- Channel sending enrollment commands.
    pub fn new(
        enrolled: bool,
        event_rx: mpsc::Receiver<AgentEvent>,
        command_tx: mpsc::Sender<GuiCommand>,
        enrollment_tx: mpsc::Sender<EnrollmentCommand>,
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
            event_rx,
            command_tx,
            enrollment_tx,
            _tray: tray,
            visible: true,
        }
    }

    /// Configure the eframe `NativeOptions`.
    pub fn native_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel Agent")
                .with_inner_size([1040.0, 700.0])
                .with_min_inner_size([720.0, 480.0]),
            ..Default::default()
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
                    self.state.resources = usage;
                }
                AgentEvent::Notification { notification } => {
                    // Add as log entry for now
                    self.state.logs.insert(
                        0,
                        GuiLogEntry {
                            id: notification.id,
                            timestamp: notification.timestamp,
                            level: notification.severity.clone(),
                            message: notification.title.clone(),
                            source: None,
                        },
                    );
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
                        self.state.sync_history.insert(
                            0,
                            SyncHistoryEntry {
                                timestamp: ts,
                                success: error.is_none(),
                                message: error.clone().unwrap_or_else(|| {
                                    "Synchronisation termin\u{00e9}e".to_string()
                                }),
                            },
                        );
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
                AgentEvent::VulnerabilityUpdate { summary } => {
                    self.state.vulnerability_summary = Some(summary);
                }
                AgentEvent::SoftwareUpdate { packages } => {
                    self.state.software_packages = packages;
                }
                AgentEvent::VulnerabilityFindings { findings } => {
                    self.state.vulnerability_findings = findings;
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
                AgentEvent::ShuttingDown => {
                    // Runtime is shutting down
                }
            }
        }
    }

    /// Handle tray menu actions.
    fn process_tray_actions(&mut self) {
        for action in TrayBridge::poll_events() {
            match action {
                TrayAction::ShowWindow => {
                    self.visible = true;
                    // Request focus (egui/eframe doesn't directly expose this,
                    // but setting visible will redraw).
                }
                TrayAction::Quit => {
                    let _ = self.command_tx.send(GuiCommand::Shutdown);
                    // eframe will exit on the next frame via ctx.send_viewport_cmd
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
}

// ============================================================================
// eframe::App implementation
// ============================================================================

impl eframe::App for SentinelApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Apply theme once.
        if !self.theme_applied {
            theme::apply_theme(ctx);
            self.theme_applied = true;
        }

        // Process incoming events.
        self.process_events();
        self.process_tray_actions();

        // Handle close = hide (instead of quit).
        if ctx.input(|i| i.viewport().close_requested()) {
            // Prevent actual close, hide instead.
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            self.visible = false;
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
                .frame(egui::Frame::new().fill(theme::BG_PRIMARY))
                .show(ctx, |ui| {
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

        // ── Main UI ──

        // Sidebar
        egui::SidePanel::left("sidebar")
            .exact_width(theme::SIDEBAR_WIDTH)
            .frame(egui::Frame::new().fill(theme::BG_SIDEBAR))
            .show(ctx, |ui| {
                if let Some(new_page) = widgets::Sidebar::show(ui, &self.page) {
                    self.page = new_page;
                }
            });

        // Content area
        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::BG_PRIMARY)
                    .inner_margin(egui::Margin::same(24)),
            )
            .show(ctx, |ui| match self.page {
                Page::Dashboard => {
                    pages::DashboardPage::show(ui, &self.state);
                }
                Page::Compliance => {
                    pages::CompliancePage::show(ui, &self.state);
                }
                Page::Software => {
                    pages::SoftwarePage::show(ui, &self.state);
                }
                Page::Vulnerabilities => {
                    pages::VulnerabilitiesPage::show(ui, &self.state);
                }
                Page::Network => {
                    pages::NetworkPage::show(ui, &self.state);
                }
                Page::Sync => {
                    if let Some(cmd) = pages::SyncPage::show(ui, &self.state) {
                        self.send_command(cmd);
                    }
                }
                Page::Logs => {
                    pages::LogsPage::show(ui, &self.state);
                }
                Page::Settings => {
                    if let Some(cmd) = pages::SettingsPage::show(ui, &mut self.state) {
                        if matches!(cmd, GuiCommand::Shutdown) {
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                        self.send_command(cmd);
                    }
                }
                Page::About => {
                    pages::AboutPage::show(ui);
                }
            });

        // Request periodic repaint for event processing.
        ctx.request_repaint_after(std::time::Duration::from_millis(250));
    }
}
