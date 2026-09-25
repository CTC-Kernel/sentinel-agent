// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Sentinel Nexus application shell.
//!
//! Manages the eframe window, routing, state, and event channels between
//! the GUI and the agent runtime.

use std::sync::mpsc;
use std::sync::{Arc, Mutex};

// ---------------------------------------------------------------------------
// macOS: toggle Dock icon visibility when hiding/showing the window.
// ---------------------------------------------------------------------------

use crate::enrollment::{EnrollmentCommand, EnrollmentWizard};
use crate::events::{AgentEvent, GuiCommand};
pub use crate::state::{AppState, SyncHistoryEntry};
use crate::tray_bridge::{TrayAction, TrayBridge};
use crate::{icons, pages, theme, widgets};
use eframe::egui;

/// Maximum per-frame delta time to prevent animation jumps on lag spikes.
const FRAME_DT_MAX: f32 = 0.05;

/// Results from background async tasks initiated by the UI.
pub enum AsyncTaskResult {
    CsvExport(bool, String),
    HtmlExport(bool, String),
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    NativeApps(Vec<crate::dto::GuiNativeApp>),
}

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
    AI,
    Reports,
    Risks,
    Assets,
    Orchestration,
    About,
}

/// Single source of truth mapping every page to its command-palette identity:
/// `(page, nav id, icon, label, category)`. Categories follow the product's
/// domain grouping so palette results read like the navigation. Used both to
/// build the palette and to resolve a selected `nav:<id>` back to a `Page`.
fn page_catalog() -> [(Page, &'static str, &'static str, &'static str, &'static str); 21] {
    use Page::*;
    [
        (
            Dashboard,
            "dashboard",
            icons::DASHBOARD,
            "Tableau de bord",
            "Vue d'ensemble",
        ),
        (
            Monitoring,
            "monitoring",
            icons::CHART_LINE,
            "Surveillance",
            "Vue d'ensemble",
        ),
        (
            Notifications,
            "notifications",
            icons::BELL,
            "Notifications",
            "Vue d'ensemble",
        ),
        (
            Threats,
            "threats",
            icons::SKULL,
            "Menaces",
            "Détection & Réponse",
        ),
        (
            Vulnerabilities,
            "vulnerabilities",
            icons::VULNERABILITIES,
            "Vulnérabilités",
            "Détection & Réponse",
        ),
        (
            FileIntegrity,
            "file_integrity",
            icons::FILE_SHIELD,
            "Intégrité des fichiers",
            "Détection & Réponse",
        ),
        (
            Network,
            "network",
            icons::NETWORK,
            "Réseau",
            "Détection & Réponse",
        ),
        (
            Compliance,
            "compliance",
            icons::COMPLIANCE,
            "Conformité",
            "Conformité & Risques",
        ),
        (
            Risks,
            "risks",
            icons::SCALE_BALANCED,
            "Risques",
            "Conformité & Risques",
        ),
        (
            Reports,
            "reports",
            icons::FILE_EXPORT,
            "Rapports",
            "Conformité & Risques",
        ),
        (
            Assets,
            "assets",
            icons::BOXES_STACKED,
            "Inventaire",
            "Actifs & Inventaire",
        ),
        (
            Software,
            "software",
            icons::SOFTWARE,
            "Logiciels & MDM",
            "Actifs & Inventaire",
        ),
        (
            Discovery,
            "discovery",
            icons::DISCOVERY,
            "Shadow IT",
            "Actifs & Inventaire",
        ),
        (
            Cartography,
            "cartography",
            icons::CARTOGRAPHY,
            "Cartographie",
            "Actifs & Inventaire",
        ),
        (
            Orchestration,
            "orchestration",
            icons::ORCHESTRATION,
            "Orchestration",
            "Automatisation",
        ),
        (
            AuditTrail,
            "audit_trail",
            icons::CLIPBOARD,
            "Journal d'audit",
            "Système",
        ),
        (Sync, "sync", icons::SYNC, "Synchronisation", "Système"),
        (Terminal, "terminal", icons::TERMINAL, "Terminal", "Système"),
        (
            Settings,
            "settings",
            icons::SETTINGS,
            "Paramètres",
            "Système",
        ),
        (About, "about", icons::ABOUT, "À propos", "Système"),
        (AI, "ai", icons::BRAIN, "Assistant IA", "Assistant"),
    ]
}

/// Build the full command list shown in the palette: one entry per page plus
/// the global actions that already have keyboard shortcuts. A standalone
/// agent has no synchronisation page and nothing to synchronise.
fn build_palette_commands(standalone: bool) -> Vec<widgets::CommandItem> {
    let mut commands: Vec<widgets::CommandItem> = page_catalog()
        .into_iter()
        .filter(|(page, ..)| !(standalone && *page == Page::Sync))
        .map(|(_, nav_id, icon, label, category)| {
            widgets::CommandItem::new(format!("nav:{nav_id}"), label)
                .icon(icon)
                .category(category)
        })
        .collect();

    commands.push(
        widgets::CommandItem::new("action:run_check", "Lancer l'analyse")
            .icon(icons::PLAY)
            .shortcut(widgets::topbar::shortcut_label(false, "R"))
            .category("Actions"),
    );
    if !standalone {
        commands.push(
            widgets::CommandItem::new("action:force_sync", "Synchroniser maintenant")
                .icon(icons::SYNC)
                .shortcut(widgets::topbar::shortcut_label(true, "S"))
                .category("Actions"),
        );
    }
    commands.push(
        widgets::CommandItem::new("action:toggle_theme", "Basculer le thème clair / sombre")
            .icon(icons::SETTINGS)
            .category("Actions"),
    );

    commands
}

/// Palette entries for the data on screen — a CVE, an asset, a package, a
/// process, a risk — each opening its page and its record. Capped per kind
/// so the palette stays a search box, not an inventory dump.
fn severity_fr(severity: crate::dto::Severity) -> &'static str {
    match severity {
        crate::dto::Severity::Critical => "Critique",
        crate::dto::Severity::High => "\u{00c9}lev\u{00e9}e",
        crate::dto::Severity::Medium => "Moyenne",
        crate::dto::Severity::Low => "Faible",
        crate::dto::Severity::Info => "Info",
    }
}

pub fn entity_commands(state: &AppState) -> Vec<widgets::CommandItem> {
    const PER_KIND: usize = 200;
    let icon_of = |wanted: Page| {
        page_catalog()
            .into_iter()
            .find(|(page, ..)| *page == wanted)
            .map(|(_, _, icon, ..)| icon)
            .unwrap_or(icons::SEARCH)
    };
    let mut items = Vec::new();
    for (i, f) in state
        .vulnerability_findings
        .iter()
        .take(PER_KIND)
        .enumerate()
    {
        items.push(
            widgets::CommandItem::new(format!("vuln:{i}"), f.cve_id.clone())
                .description(format!(
                    "{} {} \u{00b7} {}",
                    f.affected_software,
                    f.affected_version,
                    severity_fr(f.severity)
                ))
                .icon(icon_of(Page::Vulnerabilities))
                .category("Vuln\u{00e9}rabilit\u{00e9}s"),
        );
    }
    for (i, a) in state.assets.assets.iter().take(PER_KIND).enumerate() {
        items.push(
            widgets::CommandItem::new(
                format!("asset:{i}"),
                a.hostname.clone().unwrap_or_else(|| a.ip.clone()),
            )
            .description(format!("{} \u{00b7} {}", a.ip, a.device_type))
            .icon(icon_of(Page::Assets))
            .category("Inventaire"),
        );
    }
    for (i, p) in state.software.packages.iter().take(PER_KIND).enumerate() {
        items.push(
            widgets::CommandItem::new(format!("package:{i}"), p.name.clone())
                .description(p.version.clone())
                .icon(icon_of(Page::Software))
                .category("Logiciels"),
        );
    }
    for (i, p) in state
        .threats
        .suspicious_processes
        .iter()
        .take(PER_KIND)
        .enumerate()
    {
        items.push(
            widgets::CommandItem::new(format!("process:{i}"), p.process_name.clone())
                .description(format!("PID {} \u{00b7} {}", p.pid, p.reason))
                .icon(icon_of(Page::Threats))
                .category("Menaces"),
        );
    }
    for (i, r) in state.risks.entries.iter().take(PER_KIND).enumerate() {
        items.push(
            widgets::CommandItem::new(format!("risk:{i}"), r.title.clone())
                .description(format!("Score {} \u{00b7} {}", r.score(), r.owner))
                .icon(icon_of(Page::Risks))
                .category("Risques"),
        );
    }
    items
}

/// Lay a page body out as a centred column of `measure` px, inset by `side`.
///
/// Used instead of `Frame::inner_margin` because egui margins are `i8`: on a
/// wide display the gutter needed to centre 1560px of content overflows them.
fn content_column(ui: &mut egui::Ui, side: f32, measure: f32, body: impl FnOnce(&mut egui::Ui)) {
    ui.horizontal_top(|ui: &mut egui::Ui| {
        ui.add_space(side);
        ui.vertical(|ui: &mut egui::Ui| {
            ui.set_max_width(measure);
            ui.set_min_width(measure);
            body(ui);
        });
    });
}

/// Width the overlay scrollbar needs on the trailing edge, so right-aligned
/// content is not clipped by it.
const SCROLLBAR_GUTTER: f32 = 10.0;

/// Lay a page body out the way the shell does: a column bounded by
/// `CONTENT_MAX_WIDTH`, inset by the page gutter and the scrollbar gutter.
///
/// Past the bound the content centres instead of stretching, because a
/// 3000px-wide table row is unreadable however premium it looks. The preview
/// harness calls this too, so a capture measures what the shell shows.
pub fn page_column(ui: &mut egui::Ui, body: impl FnOnce(&mut egui::Ui)) {
    let gutter = theme::SPACE_LG;
    let full = ui.available_width();
    let measure = (full - gutter * 2.0 - SCROLLBAR_GUTTER).min(theme::CONTENT_MAX_WIDTH);
    let side = ((full - measure - SCROLLBAR_GUTTER) / 2.0).max(gutter);
    content_column(ui, side, measure, body);
}

// ============================================================================
// App state
// ============================================================================

// AppState and SyncHistoryEntry moved to state.rs

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
    llm_panel: crate::llm_panel::LLMPanel,

    /// Track previous dark_mode to detect toggles.
    last_dark_mode: bool,

    // Channels to/from agent runtime.
    event_rx: Arc<Mutex<mpsc::Receiver<AgentEvent>>>,
    command_tx: mpsc::Sender<GuiCommand>,

    // Enrollment channel (sent back to runtime).
    enrollment_tx: mpsc::Sender<EnrollmentCommand>,

    // Async task results channel (internal UI tasks).
    async_results_rx: Arc<Mutex<mpsc::Receiver<AsyncTaskResult>>>,

    // Tray actions channel
    tray_action_tx: mpsc::Sender<crate::tray_bridge::TrayAction>,
    tray_action_rx: Arc<Mutex<mpsc::Receiver<crate::tray_bridge::TrayAction>>>,

    // Tray bridge (optional -- only on desktop).
    tray: Option<TrayBridge>,

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

    /// Theme switch transition (0.0 = switching, 1.0 = complete).
    theme_transition: f32,

    /// Command palette (⌘K / Ctrl+K) — global search over pages and actions.
    command_palette: widgets::CommandPaletteState,

    /// The window was below `SIDEBAR_BREAKPOINT` last frame.
    narrow_layout: bool,
    /// The operator re-opened the sidebar while the window was narrow.
    /// Cleared whenever the breakpoint is crossed, so the saved preference
    /// comes back the moment the window is wide again.
    narrow_expanded: bool,
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
        let tray = match TrayBridge::new() {
            Ok(t) => Some(t),
            Err(e) => {
                tracing::warn!("System tray not available: {}", e);
                None
            }
        };

        // Create channel for internal async UI tasks
        let (async_tx, async_rx) = mpsc::sync_channel(1000);
        let state = AppState {
            async_task_tx: Some(async_tx),
            ..Default::default()
        };

        let llm_panel = crate::llm_panel::LLMPanel;

        let (tray_action_tx, tray_action_rx) = mpsc::channel();

        Self {
            page: Page::Dashboard,
            state,
            llm_panel,
            enrolled,
            enrollment_wizard: EnrollmentWizard::default(),
            theme_applied: false,
            last_dark_mode: true,
            event_rx: Arc::new(Mutex::new(event_rx)),
            command_tx,
            enrollment_tx,
            async_results_rx: Arc::new(Mutex::new(async_rx)),
            tray_action_tx,
            tray_action_rx: Arc::new(Mutex::new(tray_action_rx)),
            tray,
            visible: true,
            quit_requested: false,
            splash_start: std::time::Instant::now(),
            splash_done: false,
            show_tray_satellite: is_tray_popup,
            page_transition: 1.0,
            theme_transition: 1.0,
            command_palette: widgets::CommandPaletteState::new(),
            narrow_layout: false,
            narrow_expanded: false,
        }
    }

    /// Apply persisted GUI preferences loaded from eframe storage.
    ///
    /// Called once at startup from the `run_native` closure before the first
    /// frame is rendered.  Also re-sends the relevant `GuiCommand`s so the
    /// agent-core runtime picks up the restored values.
    pub fn apply_persisted_preferences(&mut self, prefs: crate::state::GuiPreferences) {
        prefs.apply_to(&mut self.state);
        self.last_dark_mode = self.state.settings.dark_mode;

        // Re-send ALL commands to agent-core so runtime matches restored prefs.
        // Send unconditionally (even when disabled) to ensure runtime state is consistent.
        self.send_command(GuiCommand::UpdateCheckInterval {
            interval_secs: self.state.settings.check_interval_secs,
        });
        self.send_command(GuiCommand::SetLogLevel {
            level: self.state.settings.log_level.index() as u8,
        });
        self.send_command(GuiCommand::UpdateSiemConfig {
            enabled: self.state.settings.siem_enabled,
            format: self.state.settings.siem_format.clone(),
            transport: self.state.settings.siem_transport.clone(),
            destination: self.state.settings.siem_destination.clone(),
        });
        self.send_command(GuiCommand::UpdateLogCollectorConfig {
            enabled: self.state.settings.log_collector_enabled,
            sources: self.state.settings.log_collector_sources.clone(),
            poll_interval_secs: self.state.settings.log_collector_poll_secs,
        });
        if self.state.discovery.enabled {
            self.send_command(GuiCommand::StartDiscovery);
        }
    }

    /// Configure the eframe `NativeOptions`.
    ///
    /// Uses wgpu as the renderer which supports software rendering on systems
    /// without a GPU (Windows Server, headless VMs, Remote Desktop).
    /// wgpu automatically falls back to DirectX WARP (software rasterizer)
    /// when no hardware GPU is available, unlike glow/OpenGL which crashes.
    pub fn native_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            renderer: eframe::Renderer::Wgpu,
            persistence_path: Some(Self::preferences_dir()),
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel Nexus")
                .with_inner_size([theme::WINDOW_WIDTH, theme::WINDOW_HEIGHT])
                .with_min_inner_size([theme::WINDOW_MIN_WIDTH, theme::WINDOW_MIN_HEIGHT])
                .with_icon(Self::load_app_icon()),
            ..Default::default()
        }
    }

    /// Configure compact options for tray menu popup.
    pub fn tray_popup_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            renderer: eframe::Renderer::Wgpu,
            persistence_path: Some(Self::preferences_dir()),
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel Nexus - Vue rapide")
                .with_inner_size([theme::SPLASH_CONTENT_WIDTH, theme::TRAY_POPUP_MAX_HEIGHT])
                .with_min_inner_size([theme::TRAY_POPUP_MIN_WIDTH, theme::SPLASH_CONTENT_HEIGHT])
                .with_max_inner_size([theme::TRAY_POPUP_MAX_WIDTH, 800.0])
                .with_icon(Self::load_app_icon())
                .with_decorations(false)
                // Transparent native windows produce black or undefined
                // backgrounds on a number of Linux Wayland compositors.
                .with_transparent(!cfg!(target_os = "linux")),
            ..Default::default()
        }
    }

    /// Directory where eframe persists GUI preferences (dark mode, SIEM, etc.).
    fn preferences_dir() -> std::path::PathBuf {
        directories::ProjectDirs::from("com", "CyberThreatConsulting", "SentinelAgent")
            .map(|dirs| dirs.data_local_dir().to_path_buf())
            .unwrap_or_else(|| {
                // Fallback to platform data dir
                agent_common::config::AgentConfig::platform_data_dir().join("gui")
            })
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

    fn process_events(&mut self) {
        let mut resume_conversation = false;
        {
            let rx = match self.event_rx.lock() {
                Ok(rx) => rx,
                Err(poisoned) => {
                    tracing::error!(
                        "GUI event channel lock was poisoned; recovering queued events"
                    );
                    poisoned.into_inner()
                }
            };
            while let Ok(event) = rx.try_recv() {
                // Special handling for enrollment result in app shell
                if let crate::events::AgentEvent::EnrollmentResult {
                    success,
                    ref message,
                    ..
                } = event
                {
                    self.enrollment_wizard.set_result(success, message.clone());
                }

                if self.state.ai.voice_alerts_enabled
                    && let crate::events::AgentEvent::Notification { notification } = &event
                    && matches!(
                        notification.severity.to_ascii_lowercase().as_str(),
                        "warning" | "high" | "error" | "critical"
                    )
                {
                    let spoken = format!(
                        "Alerte Sentinel. {}. {}",
                        notification.title, notification.body
                    );
                    if !self.state.ai.pending_voice_alerts.contains(&spoken) {
                        if self.state.ai.pending_voice_alerts.len() >= 8 {
                            self.state.ai.pending_voice_alerts.pop_front();
                        }
                        self.state.ai.pending_voice_alerts.push_back(spoken);
                    }
                }
                if matches!(
                    &event,
                    crate::events::AgentEvent::VoiceStatus { speaking: false }
                ) && self.state.ai.voice_conversation_enabled
                    && self.state.ai.voice_reply_pending
                {
                    self.state.ai.voice_reply_pending = false;
                    resume_conversation = true;
                }

                self.state.apply_event(event);
            }
        }

        // Commands are sent after releasing the event receiver lock: voice
        // callbacks can emit new GUI events immediately and must never contend
        // with the drain loop above.
        if resume_conversation && !self.state.ai.is_listening {
            self.state.ai.is_listening = true;
            self.send_command(GuiCommand::SetVoiceListening { enabled: true });
        } else if self.state.ai.voice_alerts_enabled
            && !self.state.ai.is_processing
            && !self.state.ai.is_listening
            && !self.state.ai.is_speaking
            && !self.state.ai.voice_reply_pending
            && !self.state.ai.pending_voice_alerts.is_empty()
        {
            let total = self.state.ai.pending_voice_alerts.len();
            let mut alerts = Vec::with_capacity(total.min(3));
            for _ in 0..total.min(3) {
                if let Some(alert) = self.state.ai.pending_voice_alerts.pop_front() {
                    alerts.push(alert);
                }
            }
            let mut text = alerts.join(". ");
            if total > 3 {
                text.push_str(&format!(
                    ". {} autres alertes restent disponibles dans Sentinel Nexus.",
                    total - 3
                ));
            }
            // Optimistic state prevents another frame from dispatching a second
            // batch before the runtime's VoiceStatus event reaches the GUI.
            self.state.ai.is_speaking = true;
            self.send_command(GuiCommand::SpeakNotification { text });
        } else if !self.state.ai.voice_alerts_enabled {
            self.state.ai.pending_voice_alerts.clear();
        }
    }

    /// Handle tray menu actions.
    fn process_tray_actions(&mut self, ctx: &egui::Context) {
        let rx = self.tray_action_rx.clone();
        let rx_lock = match rx.lock() {
            Ok(rx) => rx,
            Err(poisoned) => {
                tracing::error!("Tray action channel lock was poisoned; recovering queued actions");
                poisoned.into_inner()
            }
        };
        while let Ok(action) = rx_lock.try_recv() {
            match action {
                TrayAction::ShowWindow => {
                    self.show_tray_satellite = false;
                    #[cfg(target_os = "macos")]
                    crate::os::macos::dock::show_icon();
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
                            theme::TRAY_WIDTH,
                            theme::TRAY_HEIGHT,
                        )));
                    } else {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(true));
                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
                            theme::WINDOW_WIDTH,
                            theme::WINDOW_HEIGHT,
                        )));
                    }
                }
                TrayAction::Pause => {
                    self.send_command(GuiCommand::Pause);
                    if let Some(ref tray) = self.tray {
                        tray.set_paused(true);
                    }
                }
                TrayAction::Resume => {
                    self.send_command(GuiCommand::Resume);
                    if let Some(ref tray) = self.tray {
                        tray.set_paused(false);
                    }
                }
                TrayAction::RunCheck => {
                    self.send_command(GuiCommand::RunCheck);
                }
                TrayAction::ForceSync => {
                    self.send_command(GuiCommand::ForceSync);
                }
                TrayAction::OpenLogs => {
                    crate::tray_bridge::open_logs_folder();
                }
                TrayAction::OpenGuide => {
                    crate::tray_bridge::open_guide();
                }
                TrayAction::OpenConsole => {
                    crate::tray_bridge::open_console();
                }
                TrayAction::About => {
                    crate::tray_bridge::open_about();
                }
                TrayAction::ToggleJarvis => {
                    self.state.jarvis_visible = !self.state.jarvis_visible;
                }
                TrayAction::Quit => {
                    self.quit_requested = true;
                    self.send_command(GuiCommand::Shutdown);
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
        }
    }

    /// Push latest resource metrics to the tray menu.
    fn update_tray_info(&self) {
        if let Some(ref tray) = self.tray {
            tray.update_resources(
                self.state.resources.cpu_percent,
                self.state.resources.memory_used_mb,
            );
            tray.set_jarvis_checked(self.state.jarvis_visible);
            tray.set_standalone(self.state.summary.standalone);
        }
    }

    fn send_command(&self, cmd: GuiCommand) {
        if let Err(e) = self.command_tx.send(cmd) {
            tracing::warn!("Failed to send GUI command: {}", e);
        }
    }

    /// Render the premium satellite tray view.
    /// Compact tray popup: one glance at the agent's posture, two ways out.
    fn show_tray_satellite_view(&mut self, ctx: &egui::Context) {
        let restore_window = |ctx: &egui::Context| {
            ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(true));
            ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
                theme::WINDOW_WIDTH,
                theme::WINDOW_HEIGHT,
            )));
        };

        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(egui::Margin::same(theme::SPACE_MD as i8)),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                ui.vertical(|ui: &mut egui::Ui| {
                    // ── Header ──────────────────────────────────────
                    ui.horizontal(|ui: &mut egui::Ui| {
                        ui.label(
                            egui::RichText::new(icons::SHIELD)
                                .font(theme::font_icon(theme::ICON_SM))
                                .color(theme::accent_text()),
                        );
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new("Aperçu de la posture")
                                .font(theme::font_body_strong())
                                .color(theme::text_primary()),
                        );
                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui: &mut egui::Ui| {
                                if widgets::icon_button(ui, icons::XMARK, Some("Fermer")).clicked()
                                {
                                    self.show_tray_satellite = false;
                                    restore_window(ctx);
                                }
                                if widgets::icon_button(
                                    ui,
                                    icons::EXTERNAL_LINK,
                                    Some("Ouvrir la fenêtre complète"),
                                )
                                .clicked()
                                {
                                    self.show_tray_satellite = false;
                                    self.visible = true;
                                    restore_window(ctx);
                                }
                            },
                        );
                    });

                    ui.add_space(theme::SPACE_SM);

                    // ── Radar ───────────────────────────────────────
                    let (compliance, threats, vulns, resources, network) =
                        self.state.radar_scores();
                    let radar_response =
                        widgets::TrayRadar::new(compliance, threats, vulns, resources, network)
                            .show(ui, theme::TRAY_RADAR_SIZE);
                    if radar_response.clicked() {
                        self.show_tray_satellite = false;
                        self.visible = true;
                        self.navigate_to(Page::Dashboard);
                        restore_window(ctx);
                    }

                    ui.add_space(theme::SPACE_MD);

                    let posture = ((compliance + threats + vulns + resources + network) / 5.0)
                        .clamp(0.0, 1.0);
                    let (posture_label, posture_color, posture_detail) = if posture >= 0.85 {
                        (
                            "POSTURE MAÎTRISÉE",
                            theme::SUCCESS,
                            "Aucune dérive majeure détectée",
                        )
                    } else if posture >= 0.65 {
                        (
                            "VIGILANCE REQUISE",
                            theme::WARNING,
                            "Des écarts nécessitent une revue",
                        )
                    } else {
                        (
                            "ACTION PRIORITAIRE",
                            theme::ERROR,
                            "Ouvrez le cockpit pour investiguer",
                        )
                    };
                    egui::Frame::new()
                        .fill(theme::tinted_surface(posture_color))
                        .stroke(egui::Stroke::new(
                            theme::BORDER_HAIRLINE,
                            theme::readable_color(posture_color)
                                .linear_multiply(theme::OPACITY_MEDIUM),
                        ))
                        .corner_radius(egui::CornerRadius::same(theme::ROUNDING_MD))
                        .inner_margin(egui::Margin::symmetric(12, 9))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                widgets::status_dot(ui, posture_color);
                                ui.vertical(|ui| {
                                    ui.label(
                                        egui::RichText::new(posture_label)
                                            .font(theme::font_label())
                                            .color(theme::readable_color(posture_color))
                                            .strong(),
                                    );
                                    ui.label(
                                        egui::RichText::new(posture_detail)
                                            .font(theme::font_micro())
                                            .color(theme::text_secondary()),
                                    );
                                });
                            });
                        });

                    ui.add_space(theme::SPACE_SM);

                    // ── Two headline numbers ────────────────────────
                    let threat_count = self.state.threats.suspicious_processes.len();
                    let stats: [(&str, String, egui::Color32); 2] = [
                        (
                            "Conformité",
                            format!(
                                "{:.0}\u{202f}%",
                                self.state.summary.compliance_score.unwrap_or(0.0)
                            ),
                            theme::score_color(self.state.summary.compliance_score.unwrap_or(0.0)),
                        ),
                        (
                            "Menaces",
                            threat_count.to_string(),
                            if threat_count > 0 {
                                theme::ERROR
                            } else {
                                theme::SUCCESS
                            },
                        ),
                    ];
                    ui.horizontal(|ui: &mut egui::Ui| {
                        for (label, value, color) in stats {
                            widgets::Card::new().padding(theme::SPACE_MD).show(
                                ui,
                                |ui: &mut egui::Ui| {
                                    ui.set_width(theme::TRAY_SATELLITE_CARD_WIDTH);
                                    ui.label(
                                        egui::RichText::new(label.to_uppercase())
                                            .font(theme::font_micro())
                                            .color(theme::text_tertiary())
                                            .extra_letter_spacing(theme::TRACKING_WIDE),
                                    );
                                    ui.add_space(theme::SPACE_XS);
                                    ui.label(
                                        egui::RichText::new(value)
                                            .font(theme::font_stat())
                                            .color(theme::readable_color(color)),
                                    );
                                },
                            );
                            ui.add_space(theme::SPACE_SM);
                        }
                    });

                    ui.add_space(theme::SPACE_MD);

                    ui.vertical_centered(|ui: &mut egui::Ui| {
                        if widgets::primary_button(ui, "Lancer une analyse complète", true)
                            .clicked()
                        {
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
    /// Persist GUI preferences to eframe storage on shutdown & periodically.
    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        let prefs = crate::state::GuiPreferences::from_state(&self.state);
        if let Ok(json) = serde_json::to_string(&prefs) {
            storage.set_string("gui_preferences", json);
        }
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Apply theme once on first frame, and re-apply when dark_mode toggles.
        if !self.theme_applied {
            theme::configure_fonts(ctx);
            theme::apply_theme(ctx, self.state.settings.dark_mode);
            egui_extras::install_image_loaders(ctx);
            // Scan native apps in background thread to avoid blocking first frame
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            {
                if let Some(tx) = self.state.async_task_tx.clone() {
                    std::thread::spawn(move || {
                        let result = {
                            #[cfg(target_os = "macos")]
                            {
                                crate::os::macos::software::scan_installed_apps()
                            }
                            #[cfg(target_os = "windows")]
                            {
                                crate::os::windows::software::scan_installed_apps()
                            }
                        };
                        match result {
                            Ok(apps) => {
                                if let Err(e) = tx.send(AsyncTaskResult::NativeApps(apps)) {
                                    tracing::warn!("Failed to send native apps result: {}", e);
                                }
                            }
                            Err(e) => {
                                tracing::warn!("Failed to scan native apps: {}", e);
                            }
                        }
                    });
                }
            }
            // Detect OS-level reduced motion preference
            self.state.reduced_motion = theme::detect_reduced_motion();
            theme::set_reduced_motion(self.state.reduced_motion);
            self.theme_applied = true;
            self.last_dark_mode = self.state.settings.dark_mode;

            // Wake the UI when the runtime speaks, instead of polling both
            // channels ten times a second forever. An endpoint agent that
            // repaints at 10 Hz while nothing happens is a fan-noise
            // generator on every laptop it protects.
            Self::wake_on_message(ctx, &self.event_rx);
            Self::wake_on_message(ctx, &self.async_results_rx);

            // A listener without an actual tray would leak a polling thread
            // and could never produce an event (common on headless Linux).
            if self.tray.is_some() {
                let ctx_clone = ctx.clone();
                let action_tx = self.tray_action_tx.clone();
                std::thread::spawn(move || {
                    loop {
                        let actions = crate::tray_bridge::TrayBridge::poll_events();
                        for action in actions {
                            let _ = action_tx.send(action.clone());
                            match action {
                                crate::tray_bridge::TrayAction::ShowWindow
                                | crate::tray_bridge::TrayAction::QuickStatus => {
                                    ctx_clone
                                        .send_viewport_cmd(egui::ViewportCommand::Visible(true));
                                    ctx_clone.send_viewport_cmd(egui::ViewportCommand::Focus);
                                }
                                _ => {
                                    ctx_clone.request_repaint();
                                }
                            }
                        }
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }
                });
            }
        } else if self.state.settings.dark_mode != self.last_dark_mode {
            theme::apply_theme(ctx, self.state.settings.dark_mode);
            self.last_dark_mode = self.state.settings.dark_mode;
            // Start theme transition animation (brief fade-out/fade-in)
            if !self.state.reduced_motion {
                self.theme_transition = 0.0;
            }
        }

        // Advance theme transition animation
        if self.theme_transition < 1.0 {
            let dt = ctx.input(|i| i.stable_dt).min(FRAME_DT_MAX);
            self.theme_transition = (self.theme_transition + dt / theme::ANIM_NORMAL).min(1.0);
            ctx.request_repaint();
        }

        // Process incoming events.
        self.process_events();

        // Jarvis Widget Viewport (standalone window)
        if self.state.jarvis_visible {
            let viewport_id = egui::ViewportId::from_hash_of("jarvis_widget");
            let builder = egui::ViewportBuilder::default()
                .with_title("Jarvis AI Assistant")
                .with_inner_size([400.0, 600.0])
                .with_decorations(false)
                .with_transparent(!cfg!(target_os = "linux"))
                .with_always_on_top();

            ctx.show_viewport_immediate(viewport_id, builder, |ctx, _class| {
                self.show_jarvis_widget(ctx);
            });
        }

        self.update_tray_info();
        self.process_tray_actions(ctx);

        // Drain pending asset saves (from bulk import or discovery drawer).
        // Each asset is sent as a SaveAsset command so it is persisted to SQLite.
        while let Some(asset) = self.state.assets.pending_asset_saves.pop() {
            self.send_command(GuiCommand::SaveAsset {
                asset: Box::new(asset),
            });
        }

        // Process page navigation requests from child pages
        if let Some(target_page) = self.state.pending_navigation.take() {
            self.page = target_page;
        }

        // Auto-lock admin mode after 5 minutes of inactivity.
        if self.state.security.admin_unlocked
            && let Some(last_unlock) = self.state.security.last_unlock
            && chrono::Utc::now() - last_unlock > chrono::Duration::minutes(5)
        {
            self.state.security.admin_unlocked = false;
            tracing::info!("Admin mode auto-locked after 5 minutes");
        }

        // Process async task results from background threads
        {
            let rx = match self.async_results_rx.lock() {
                Ok(rx) => rx,
                Err(poisoned) => {
                    tracing::error!(
                        "Async result channel lock was poisoned; recovering queued results"
                    );
                    poisoned.into_inner()
                }
            };
            while let Ok(result) = rx.try_recv() {
                match result {
                    AsyncTaskResult::CsvExport(success, message) => {
                        let time = ctx.input(|i| i.time);
                        if success {
                            self.state.toasts.push(
                                crate::widgets::toast::Toast::success(message).with_time(time),
                            );
                        } else {
                            self.state
                                .toasts
                                .push(crate::widgets::toast::Toast::error(message).with_time(time));
                        }
                    }
                    AsyncTaskResult::HtmlExport(success, message) => {
                        let time = ctx.input(|i| i.time);
                        if success {
                            self.state.toasts.push(
                                crate::widgets::toast::Toast::success(message).with_time(time),
                            );
                        } else {
                            self.state
                                .toasts
                                .push(crate::widgets::toast::Toast::error(message).with_time(time));
                        }
                    }
                    #[cfg(any(target_os = "macos", target_os = "windows"))]
                    AsyncTaskResult::NativeApps(apps) => {
                        self.state.software.native_apps = apps;
                    }
                }
            }
        }

        // ── Splash screen (first ~2.5 seconds) ──
        if !self.splash_done && !self.show_tray_satellite {
            let elapsed = self.splash_start.elapsed().as_secs_f32();
            if elapsed < theme::SPLASH_DURATION {
                self.show_splash(ctx, elapsed);
                ctx.request_repaint();
                return;
            }
            self.splash_done = true;
        }

        // Hide only when the application can actually be restored from a
        // tray. Otherwise close normally instead of creating a ghost process.
        if ctx.input(|i| i.viewport().close_requested()) && !self.quit_requested {
            if self.tray.is_some() {
                ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
                ctx.send_viewport_cmd(egui::ViewportCommand::Visible(false));
                self.visible = false;
                #[cfg(target_os = "macos")]
                crate::os::macos::dock::hide_icon();
            } else {
                self.quit_requested = true;
                self.send_command(GuiCommand::Shutdown);
            }
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
                                    if self.enrollment_wizard.restart_requested {
                                        // The platform connection is on disk;
                                        // the relaunched agent starts connected.
                                        self.quit_requested = true;
                                        self.send_command(GuiCommand::Restart);
                                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                                    }
                                }
                            }
                            EnrollmentCommand::Cancel => {
                                if self.state.summary.standalone {
                                    // Connecting later was optional: back to
                                    // the protected, standalone interface.
                                    self.enrolled = true;
                                } else {
                                    // Exit the app if user cancels enrollment.
                                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                                }
                            }
                            _ => {}
                        }
                        if let Err(e) = self.enrollment_tx.send(cmd.clone()) {
                            tracing::warn!("Failed to send enrollment command: {}", e);
                        }
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
        }) {
            self.navigate_to(new_page);
        }

        // Cmd+R = Run check, Cmd+Shift+S = Force sync
        if ctx.input(|i| i.modifiers.command && !i.modifiers.shift && i.key_pressed(egui::Key::R)) {
            self.send_command(GuiCommand::RunCheck);
        }
        if ctx.input(|i| i.modifiers.command && i.modifiers.shift && i.key_pressed(egui::Key::S)) {
            self.send_command(GuiCommand::ForceSync);
        }

        // Cmd+K / Ctrl+K = toggle the command palette (global search).
        if widgets::check_palette_shortcut(ctx) {
            self.command_palette.toggle();
        }

        // Global top bar (full width, above the sidebar): persistent location,
        // search, primary action, sync, notifications, assistant, theme.
        self.show_top_bar(ctx);

        let mut navigate: Option<Page> = None;

        // Sidebar. Width animates so collapsing reads as one motion rather
        // than a jump cut; the gradient is painted by the widget across the
        // full panel, including behind the scroll area.
        let target_width = widgets::Sidebar::width(self.sidebar_collapsed_now(ctx));
        let sidebar_width = if self.state.reduced_motion {
            target_width
        } else {
            ctx.animate_value_with_time(
                egui::Id::new("sidebar_width"),
                target_width,
                theme::ANIM_NORMAL,
            )
        };
        egui::SidePanel::left("sidebar")
            .exact_width(sidebar_width)
            .frame(egui::Frame::new().inner_margin(egui::Margin::ZERO))
            .show(ctx, |ui: &mut egui::Ui| {
                widgets::Sidebar::paint_background(ui, ui.max_rect());
                let sync_state = widgets::sidebar::SidebarSyncState {
                    syncing: self.state.sync.in_progress,
                    pending_count: self.state.summary.pending_sync_count,
                    last_sync_at: self.state.summary.last_sync_at,
                    error: self.state.sync.error.clone(),
                };
                let sidebar_ctx = widgets::SidebarContext {
                    current: &self.page,
                    scanning: self.state.summary.status == crate::dto::GuiAgentStatus::Scanning,
                    unread_notifications: self.state.unread_notification_count,
                    sync: &sync_state,
                    organization: self.state.summary.organization.as_deref(),
                    standalone: self.state.summary.standalone,
                    ai_ready: self.state.ai.model_status.is_ready,
                    voice_active: self.state.voice_active,
                    // Mid-animation the rail is already narrow enough that
                    // labels would be clipped, so switch shape at the midpoint.
                    collapsed: sidebar_width
                        < (theme::SIDEBAR_WIDTH + theme::SIDEBAR_RAIL_WIDTH) / 2.0,
                };
                if let Some(new_page) = widgets::Sidebar::show(ui, &sidebar_ctx) {
                    navigate = Some(new_page);
                }
            });
        if let Some(page) = navigate.take() {
            self.navigate_to(page);
        }

        // Advance page transition animation
        if self.page_transition < 1.0 {
            let dt = ctx.input(|i| i.stable_dt).min(FRAME_DT_MAX);
            self.page_transition =
                (self.page_transition + dt / theme::PAGE_TRANSITION_DURATION).min(1.0);
            ctx.request_repaint();
        }

        // Content area – Scrollbar sits flush at the window edge (macOS-style).
        // Content gets a right margin via the inner Frame so it never touches
        // the scrollbar.
        egui::CentralPanel::default()
            .frame(
                egui::Frame::new()
                    .fill(theme::bg_primary())
                    .inner_margin(egui::Margin {
                        left: 0,
                        right: 0, // Scrollbar stays flush with the window edge.
                        top: theme::SPACE_LG as i8,
                        bottom: theme::SPACE_LG as i8,
                    }),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                // A restrained spatial grid and brand glow make the central
                // canvas read as the Nexus command surface, rather than a
                // stack of disconnected utility panels.
                theme::paint_workspace_backdrop(ui.painter(), ui.max_rect());

                // Apply page transition and theme transition fade-in
                let page_alpha = if self.state.reduced_motion {
                    1.0
                } else {
                    self.page_transition
                };
                let theme_alpha = self.theme_transition;
                let combined_alpha = page_alpha * theme_alpha;
                if combined_alpha < 1.0 {
                    ui.set_opacity(combined_alpha);
                }

                egui::ScrollArea::vertical()
                    .auto_shrink(egui::Vec2b::new(false, false))
                    .show(ui, |ui: &mut egui::Ui| {
                        page_column(ui, |ui: &mut egui::Ui| match self.page {
                            Page::Dashboard => {
                                if let Some(action) =
                                    pages::DashboardPage::show(ui, &mut self.state)
                                {
                                    match action {
                                        pages::DashboardAction::Command(cmd) => {
                                            if matches!(cmd, GuiCommand::ConnectToPlatform) {
                                                self.start_platform_connection();
                                            } else {
                                                self.send_command(cmd);
                                            }
                                        }
                                        pages::DashboardAction::NavigateTo(page) => {
                                            self.navigate_to(page);
                                        }
                                    }
                                }
                            }
                            Page::Monitoring => {
                                if let Some(cmd) = pages::MonitoringPage::show(ui, &mut self.state)
                                {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Compliance => {
                                if let Some(cmd) = pages::CompliancePage::show(ui, &mut self.state)
                                {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Software => {
                                if let Some(cmd) = pages::SoftwarePage::show(ui, &mut self.state) {
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
                                if let Some(cmd) = pages::ThreatsPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::AuditTrail => {
                                if let Some(cmd) = pages::AuditTrailPage::show(ui, &mut self.state)
                                {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Network => {
                                if let Some(cmd) = pages::NetworkPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Sync => {
                                if let Some(cmd) = pages::SyncPage::show(ui, &self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Terminal => {
                                if let Some(cmd) = pages::TerminalPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Discovery => {
                                if let Some(cmd) = pages::DiscoveryPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Cartography => {
                                if let Some(cmd) = pages::CartographyPage::show(ui, &mut self.state)
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
                                if let Some(cmd) = pages::SettingsPage::show(ui, &mut self.state) {
                                    if matches!(cmd, GuiCommand::ConnectToPlatform) {
                                        self.start_platform_connection();
                                    } else {
                                        if matches!(cmd, GuiCommand::Shutdown) {
                                            self.quit_requested = true;
                                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                                        }
                                        self.send_command(cmd);
                                    }
                                }
                            }
                            Page::About => {
                                if let Some(cmd) = pages::AboutPage::show(ui) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Reports => {
                                if let Some(cmd) = pages::ReportsPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Risks => {
                                if let Some(cmd) = pages::RisksPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Assets => {
                                if let Some(cmd) = pages::AssetsPage::show(ui, &mut self.state) {
                                    self.send_command(cmd);
                                }
                            }
                            Page::Orchestration => {
                                pages::OrchestrationPage::show(ui);
                            }
                            Page::AI => {
                                if let Some(cmd) = self.llm_panel.show(ui, &mut self.state) {
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

        // Command palette (⌘K) — rendered last so it overlays everything.
        if self.command_palette.open {
            let mut commands = build_palette_commands(self.state.summary.standalone);
            commands.extend(entity_commands(&self.state));
            let selected = widgets::CommandPalette::new(&commands)
                .placeholder("Rechercher une page, une action, une CVE, un actif…")
                .max_results(commands.len())
                .show(ctx, &mut self.command_palette);
            if let Some(id) = selected {
                self.handle_palette_command(&id);
            }
        }

        // Channels wake the UI on their own (see `wake_on_message`). This is
        // the safety net for the few things that are time-based rather than
        // event-based: the admin auto-lock, relative timestamps, uptime.
        ctx.request_repaint_after(std::time::Duration::from_secs(1));
    }
}

impl SentinelApp {
    /// Persistent global top bar.
    ///
    /// Carries the chrome that must be reachable from every page: brand and
    /// sidebar toggle, current location, global search, agent health,
    /// workspace context and the primary action. Page bodies keep their own
    /// sub-headers for page-specific controls.
    fn show_top_bar(&mut self, ctx: &egui::Context) {
        let (icon, label, section) = page_catalog()
            .into_iter()
            .find(|(p, ..)| *p == self.page)
            .map(|(_, _, icon, label, section)| (icon, label, Some(section)))
            .unwrap_or((icons::DASHBOARD, "Sentinel", None));

        let collapsed = self.sidebar_collapsed_now(ctx);
        let action = widgets::top_bar(
            ctx,
            &widgets::TopBarContext {
                page_icon: icon,
                page_label: label,
                page_section: section,
                organization: self.state.summary.organization.as_deref(),
                standalone: self.state.summary.standalone,
                unread: self.state.unread_notification_count,
                syncing: self.state.sync.in_progress,
                scanning: self.state.summary.status == crate::dto::GuiAgentStatus::Scanning,
                dark_mode: self.state.settings.dark_mode,
                sidebar_collapsed: collapsed,
                sidebar_width: widgets::Sidebar::width(collapsed),
            },
        );

        match action {
            Some(widgets::TopBarAction::ToggleSidebar) => {
                if self.narrow_layout {
                    self.narrow_expanded = !self.narrow_expanded;
                } else {
                    self.state.settings.sidebar_collapsed = !self.state.settings.sidebar_collapsed;
                }
            }
            Some(widgets::TopBarAction::OpenPalette) => self.command_palette.open(),
            Some(widgets::TopBarAction::RunCheck) => self.send_command(GuiCommand::RunCheck),
            Some(widgets::TopBarAction::ForceSync) => self.send_command(GuiCommand::ForceSync),
            Some(widgets::TopBarAction::ToggleTheme) => {
                self.state.settings.dark_mode = !self.state.settings.dark_mode;
            }
            Some(widgets::TopBarAction::OpenNotifications) => self.navigate_to(Page::Notifications),
            Some(widgets::TopBarAction::OpenAssistant) => self.navigate_to(Page::AI),
            None => {}
        }
    }

    /// Whether the sidebar is a rail this frame: the saved preference on a
    /// wide window; below the breakpoint, collapsed unless re-opened.
    fn sidebar_collapsed_now(&mut self, ctx: &egui::Context) -> bool {
        let narrow = ctx.screen_rect().width() < theme::SIDEBAR_BREAKPOINT;
        if narrow != self.narrow_layout {
            self.narrow_layout = narrow;
            self.narrow_expanded = false;
        }
        if narrow {
            !self.narrow_expanded
        } else {
            self.state.settings.sidebar_collapsed
        }
    }

    /// Replace the receiver behind `slot` with one fed by a forwarding
    /// thread that wakes `ctx` after every message.
    ///
    /// The slot keeps its type, so the frame loop drains it exactly as
    /// before; the only difference is that a message now arrives with a
    /// repaint request attached instead of waiting for the next poll.
    fn wake_on_message<T: Send + 'static>(
        ctx: &egui::Context,
        slot: &Arc<Mutex<mpsc::Receiver<T>>>,
    ) {
        let (tx, rx) = mpsc::channel();
        let upstream = match slot.lock() {
            Ok(mut guard) => std::mem::replace(&mut *guard, rx),
            Err(poisoned) => {
                tracing::error!("GUI wake bridge channel was poisoned; recovering receiver");
                let mut guard = poisoned.into_inner();
                std::mem::replace(&mut *guard, rx)
            }
        };
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            for msg in upstream {
                if tx.send(msg).is_err() {
                    break;
                }
                ctx.request_repaint();
            }
        });
    }

    /// Route to `page`, closing any drawer the previous page had open and
    /// restarting the enter transition.
    fn navigate_to(&mut self, page: Page) {
        if page == self.page {
            return;
        }
        self.state.close_all_drawers();
        self.page = page;
        self.page_transition = 0.0;
    }

    /// Dispatch a command selected from the command palette.
    ///
    /// Ids are either `nav:<page>` (navigate) or `action:<name>` (side effect).
    fn handle_palette_command(&mut self, id: &str) {
        // Data results: `kind:index` into the state the palette was built from.
        if let Some((kind, idx)) = id
            .split_once(':')
            .and_then(|(kind, idx)| idx.parse::<usize>().ok().map(|idx| (kind, idx)))
        {
            match kind {
                "vuln" => {
                    self.navigate_to(Page::Vulnerabilities);
                    self.state.vulnerability.selected_vuln = Some(idx);
                    self.state.vulnerability.detail_open = true;
                    return;
                }
                "asset" => {
                    self.navigate_to(Page::Assets);
                    self.state.assets.selected_asset = Some(idx);
                    self.state.assets.detail_open = true;
                    return;
                }
                "package" => {
                    self.navigate_to(Page::Software);
                    self.state.software.active_tab = crate::dto::SoftwareTab::Packages;
                    self.state.software.selected_package = Some(idx);
                    self.state.software.detail_open = true;
                    return;
                }
                "process" => {
                    // The threat lists are rebuilt and re-sorted per frame, so
                    // the record is reached through the search rather than an
                    // index that would not survive the next rebuild.
                    if let Some(p) = self.state.threats.suspicious_processes.get(idx) {
                        self.state.threats.search = p.process_name.clone();
                    }
                    self.navigate_to(Page::Threats);
                    self.state.threats.active_tab = crate::dto::EdrTab::Events;
                    self.state.threats.events_page = 0;
                    return;
                }
                "risk" => {
                    self.navigate_to(Page::Risks);
                    self.state.risks.selected_risk = Some(idx);
                    self.state.risks.detail_open = true;
                    return;
                }
                _ => {}
            }
        }

        if let Some(nav_id) = id.strip_prefix("nav:") {
            if let Some((page, ..)) = page_catalog()
                .into_iter()
                .find(|(_, cat_id, ..)| *cat_id == nav_id)
                && page != self.page
            {
                self.state.close_all_drawers();
                self.page = page;
                self.page_transition = 0.0;
            }
            return;
        }

        match id {
            "action:run_check" => self.send_command(GuiCommand::RunCheck),
            "action:force_sync" => self.send_command(GuiCommand::ForceSync),
            // Flipping the flag makes the next frame re-apply the theme
            // (see the `dark_mode != last_dark_mode` branch in `update`).
            "action:toggle_theme" => {
                self.state.settings.dark_mode = !self.state.settings.dark_mode;
            }
            _ => {}
        }
    }

    /// Open the platform connection wizard from a standalone agent. The
    /// runtime enrolls in the background; the connection is live at the next
    /// start, the wizard says so.
    fn start_platform_connection(&mut self) {
        self.enrollment_wizard = EnrollmentWizard::for_platform_connection();
        self.enrolled = false;
    }

    /// Render the splash screen.
    fn show_splash(&self, ctx: &egui::Context, elapsed: f32) {
        widgets::splash_screen(ctx, elapsed);
    }

    /// Render the standalone premium Jarvis AI widget.
    fn show_jarvis_widget(&mut self, ctx: &egui::Context) {
        // Apply themes specifically for the viewport
        theme::apply_theme(ctx, self.state.settings.dark_mode);

        egui::CentralPanel::default()
            .frame(
                egui::Frame::NONE
                    .fill(theme::bg_primary().linear_multiply(0.85))
                    .corner_radius(theme::ROUNDING_LG)
                    .outer_margin(1.0)
                    .stroke(egui::Stroke::new(
                        1.0_f32,
                        theme::ACCENT.linear_multiply(0.5),
                    )),
            )
            .show(ctx, |ui| {
                ui.vertical(|ui| {
                    // --- Header: Premium Jarvis Branding ---
                    ui.add_space(theme::SPACE_MD);
                    ui.horizontal(|ui| {
                        ui.add_space(theme::SPACE_MD);

                        // Voice Status Icon (Simple)
                        let voice_icon_color = if self.state.ai.is_listening {
                            theme::ACCENT
                        } else {
                            theme::text_tertiary()
                        };
                        ui.label(
                            egui::RichText::new(icons::MICROPHONE)
                                .color(voice_icon_color)
                                .font(theme::font_title()),
                        );
                        ui.add_space(theme::SPACE_XS);
                        ui.label(
                            egui::RichText::new("ASSISTANT JARVIS")
                                .font(theme::font_title())
                                .strong(),
                        );

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.add_space(theme::SPACE_MD);

                            // Close button
                            if ui.button(icons::XMARK).clicked() {
                                self.state.jarvis_visible = false;
                            }

                            ui.add_space(theme::SPACE_SM);

                            // PREMIUM Voice Toggle
                            if widgets::voice_toggle_button(ui, self.state.ai.is_listening)
                                .clicked()
                            {
                                self.state.ai.is_listening = !self.state.ai.is_listening;
                                self.state.ai.voice_reply_pending = false;
                                self.send_command(GuiCommand::SetVoiceListening {
                                    enabled: self.state.ai.is_listening,
                                });
                            }
                        });
                    });

                    ui.add_space(theme::SPACE_SM);
                    ui.separator();
                    ui.add_space(theme::SPACE_MD);

                    // --- Central Visualization: Sentinel AI Core ---
                    let ai_score = crate::llm_panel::LLMPanel::compute_ai_score(&self.state);

                    ui.vertical_centered(|ui| {
                        let mut voice_state = crate::widgets::sentinel_ai_core::VoiceState::Idle;
                        if self.state.ai.is_listening {
                            voice_state = crate::widgets::sentinel_ai_core::VoiceState::Listening(
                                self.state.ai.mic_level,
                            );
                        } else if self.state.ai.is_speaking {
                            voice_state =
                                crate::widgets::sentinel_ai_core::VoiceState::Speaking(0.8);
                        }

                        let core = widgets::SentinelAICore::new(ai_score)
                            .processing(self.state.ai.is_processing)
                            .voice(voice_state);

                        core.show(ui, 60.0);

                        ui.add_space(theme::SPACE_SM);

                        // Microphone level indicator — only while listening, so the
                        // user gets live feedback that their voice is being captured.
                        if self.state.ai.is_listening {
                            let bar_width = 160.0;
                            let bar_height = 6.0;
                            let (rect, _) = ui.allocate_exact_size(
                                egui::vec2(bar_width, bar_height),
                                egui::Sense::hover(),
                            );
                            let painter = ui.painter();
                            painter.rect_filled(
                                rect,
                                egui::CornerRadius::same(3),
                                theme::bg_tertiary(),
                            );
                            let level = self.state.ai.mic_level.clamp(0.0, 1.0);
                            let filled_width = bar_width * level;
                            if filled_width > 0.5 {
                                let filled_rect = egui::Rect::from_min_size(
                                    rect.min,
                                    egui::vec2(filled_width, bar_height),
                                );
                                painter.rect_filled(
                                    filled_rect,
                                    egui::CornerRadius::same(3),
                                    theme::ACCENT_LIGHT,
                                );
                            }
                            ui.ctx().request_repaint();
                            ui.add_space(theme::SPACE_XS);
                        }

                        let risk_label = crate::llm_panel::LLMPanel::risk_label(ai_score);
                        let risk_color = theme::score_color(ai_score);
                        widgets::status_badge(ui, risk_label, risk_color);
                    });

                    ui.add_space(theme::SPACE_LG);

                    // --- Chat History Area (Simplified) ---
                    egui::ScrollArea::vertical()
                        .stick_to_bottom(true)
                        .auto_shrink([false; 2])
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.add_space(theme::SPACE_MD);
                                ui.vertical(|ui| {
                                    for msg in &self.state.ai.chat_history {
                                        crate::llm_panel::LLMPanel::render_chat_message(ui, msg);
                                        ui.add_space(theme::SPACE_SM);
                                    }

                                    if self.state.ai.is_processing {
                                        crate::llm_panel::LLMPanel::render_processing_indicator(ui);
                                        ui.add_space(theme::SPACE_SM);
                                    }
                                });
                                ui.add_space(theme::SPACE_MD);
                            });
                        });

                    ui.add_space(theme::SPACE_SM);

                    // --- Footer: Compact Chat Input ---
                    widgets::card(ui, |ui| {
                        ui.horizontal(|ui| {
                            let text_edit =
                                egui::TextEdit::singleline(&mut self.state.ai.input_text)
                                    .hint_text("Demander à Jarvis…")
                                    .font(theme::font_body())
                                    .desired_width(ui.available_width() - 40.0);

                            let response = ui.add_enabled(!self.state.ai.is_processing, text_edit);

                            let enter_pressed = response.lost_focus()
                                && ui.input(|i| i.key_pressed(egui::Key::Enter));

                            let can_send = !self.state.ai.is_processing
                                && !self.state.ai.input_text.trim().is_empty();

                            // Auto-send once Whisper has transcribed the user's speech —
                            // without this the Jarvis widget's input field would fill up
                            // but the prompt would never reach the LLM.
                            let voice_auto_send = self.state.ai.pending_voice_send && can_send;
                            if voice_auto_send {
                                self.state.ai.pending_voice_send = false;
                            }

                            let send_clicked = ui
                                .add_enabled(
                                    can_send,
                                    egui::Button::new(
                                        egui::RichText::new(icons::PAPER_PLANE)
                                            .color(theme::accent_text()),
                                    )
                                    .frame(false),
                                )
                                .clicked();

                            if (send_clicked || enter_pressed || voice_auto_send) && can_send {
                                let prompt = self.state.ai.input_text.trim().to_string();
                                self.state.ai.chat_history.push(crate::dto::LlmChatMessage {
                                    role: crate::dto::ChatRole::User,
                                    content: prompt.clone(),
                                    timestamp: chrono::Utc::now(),
                                    processing_time_ms: None,
                                });
                                self.state.ai.input_text.clear();
                                self.state.ai.is_processing = true;

                                self.send_command(GuiCommand::LlmPrompt {
                                    prompt,
                                    context: None,
                                    speak_response: voice_auto_send
                                        || self.state.ai.voice_conversation_enabled,
                                });
                                self.state.ai.voice_reply_pending =
                                    self.state.ai.voice_conversation_enabled;
                            }
                        });
                    });
                    ui.add_space(theme::SPACE_MD);
                });
            });

        // Request repaint to ensure smooth animations
        ctx.request_repaint();
    }
}

#[cfg(test)]
mod wake_on_message_tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn orchestration_is_available_in_the_page_catalog() {
        assert!(
            page_catalog().iter().any(|(page, id, _, _, _)| {
                *page == Page::Orchestration && *id == "orchestration"
            })
        );
    }

    #[test]
    fn forwards_the_message_and_requests_a_frame() {
        let ctx = egui::Context::default();
        let (tx, rx) = mpsc::channel::<u32>();
        let slot = Arc::new(Mutex::new(rx));
        SentinelApp::wake_on_message(&ctx, &slot);

        tx.send(7)
            .expect("forwarder thread owns the upstream receiver");
        let got = slot
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(2))
            .expect("message forwarded into the slot");
        assert_eq!(got, 7);
        // The forwarder sends first and requests the frame second — the
        // order that can never lose a wake — so the flag may land a moment
        // after the message does. Without it the UI would sit on the event
        // until the 1 s safety tick.
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while !ctx.has_requested_repaint() {
            assert!(
                std::time::Instant::now() < deadline,
                "forwarder never requested a repaint"
            );
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    #[test]
    fn stops_quietly_when_the_ui_side_is_dropped() {
        let ctx = egui::Context::default();
        let (tx, rx) = mpsc::channel::<u32>();
        let slot = Arc::new(Mutex::new(rx));
        SentinelApp::wake_on_message(&ctx, &slot);
        drop(slot);
        // The forwarder's send fails and it exits; the producer must not panic.
        assert!(tx.send(1).is_ok());
    }
}
