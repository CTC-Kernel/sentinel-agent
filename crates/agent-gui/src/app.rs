//! Sentinel Agent application shell.
//!
//! Manages the eframe window, routing, state, and event channels between
//! the GUI and the agent runtime.

use std::sync::mpsc;

// ---------------------------------------------------------------------------
// macOS: toggle Dock icon visibility when hiding/showing the window.
// ---------------------------------------------------------------------------

use eframe::egui;
pub use crate::state::{AppState, SyncHistoryEntry};
use crate::enrollment::{EnrollmentCommand, EnrollmentWizard};
use crate::events::{AgentEvent, GuiCommand};
use crate::{icons, pages, theme, widgets};
use crate::tray_bridge::{TrayAction, TrayBridge};

/// Maximum per-frame delta time to prevent animation jumps on lag spikes.
const FRAME_DT_MAX: f32 = 0.05;

/// Results from background async tasks initiated by the UI.
pub enum AsyncTaskResult {
    CsvExport(bool, String),
    #[cfg(target_os = "macos")]
    MacOsApps(Vec<crate::dto::GuiMacOsApp>),
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
    About,
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
    event_rx: mpsc::Receiver<AgentEvent>,
    command_tx: mpsc::Sender<GuiCommand>,

    // Enrollment channel (sent back to runtime).
    enrollment_tx: mpsc::Sender<EnrollmentCommand>,

    // Async task results channel (internal UI tasks).
    async_results_rx: mpsc::Receiver<AsyncTaskResult>,

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

    /// Theme switch transition (0.0 = switching, 1.0 = complete).
    theme_transition: f32,
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

        Self {
            page: Page::Dashboard,
            state,
            llm_panel,
            enrolled,
            enrollment_wizard: EnrollmentWizard::default(),
            theme_applied: false,
            last_dark_mode: true,
            event_rx,
            command_tx,
            enrollment_tx,
            async_results_rx: async_rx,
            _tray: tray,
            visible: true,
            quit_requested: false,
            splash_start: std::time::Instant::now(),
            splash_done: false,
            show_tray_satellite: is_tray_popup,
            page_transition: 1.0,
            theme_transition: 1.0,
        }
    }

    /// Configure the eframe `NativeOptions`.
    pub fn native_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel Agent")
                .with_inner_size([theme::WINDOW_WIDTH, theme::WINDOW_HEIGHT])
                .with_min_inner_size([theme::WINDOW_MIN_WIDTH, theme::WINDOW_MIN_HEIGHT])
                .with_icon(Self::load_app_icon()),
            ..Default::default()
        }
    }

    /// Configure compact options for tray menu popup.
    pub fn tray_popup_options() -> eframe::NativeOptions {
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Sentinel - Vue Rapide")
                .with_inner_size([theme::SPLASH_CONTENT_WIDTH, theme::TRAY_POPUP_MAX_HEIGHT])
                .with_min_inner_size([theme::TRAY_POPUP_MIN_WIDTH, theme::SPLASH_CONTENT_HEIGHT])
                .with_max_inner_size([theme::TRAY_POPUP_MAX_WIDTH, 800.0])
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

    fn process_events(&mut self) {
        while let Ok(event) = self.event_rx.try_recv() {
            // Special handling for enrollment result in app shell
            if let crate::events::AgentEvent::EnrollmentResult { success, ref message, .. } = event {
                self.enrollment_wizard.set_result(success, message.clone());
            }

            self.state.apply_event(event);
        }
    }

    /// Handle tray menu actions.
    fn process_tray_actions(&mut self, ctx: &egui::Context) {
        for action in TrayBridge::poll_events() {
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
                            theme::TRAY_WIDTH, theme::TRAY_HEIGHT,
                        )));
                    } else {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(true));
                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
                            theme::WINDOW_WIDTH, theme::WINDOW_HEIGHT,
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

    // recompute_policy moved to state.rs

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
                            ui.label(egui::RichText::new(icons::SHIELD).color(theme::accent_text()));
                            ui.add_space(theme::SPACE_XS);
                            ui.label(
                                egui::RichText::new("RAPPORT CYBER RAPIDE")
                                    .font(theme::font_small())
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
                                            egui::vec2(theme::WINDOW_WIDTH, theme::WINDOW_HEIGHT),
                                        ));
                                    }
                                    if ui.button(icons::EXTERNAL_LINK).clicked() {
                                        self.show_tray_satellite = false;
                                        self.visible = true;
                                        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(
                                            true,
                                        ));
                                        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(
                                            egui::vec2(theme::WINDOW_WIDTH, theme::WINDOW_HEIGHT),
                                        ));
                                    }
                                },
                            );
                        });
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Radar Chart Section
                    ui.vertical(|ui: &mut egui::Ui| {
                        let (compliance, threats, vulns, resources, network) = self.state.radar_scores();

                        let radar = widgets::TrayRadar::new(
                            compliance,
                            threats,
                            vulns,
                            resources,
                            network,
                        );
                        radar.show(ui, theme::TRAY_RADAR_SIZE);
                    });

                    ui.add_space(theme::SPACE_MD);

                    // Quick Stats Cards
                    ui.horizontal(|ui: &mut egui::Ui| {
                        widgets::card(ui, |ui: &mut egui::Ui| {
                            ui.set_width(theme::TRAY_SATELLITE_CARD_WIDTH);
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(egui::RichText::new("SCORE").font(theme::font_small()));
                                ui.add_space(theme::SPACE_XS);
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{:.0}%",
                                        self.state.summary.compliance_score.unwrap_or(0.0)
                                    ))
                                    .font(theme::font_title())
                                    .color(theme::accent_text()),
                                );
                            });
                        });
                        ui.add_space(theme::SPACE_MD);
                        widgets::card(ui, |ui: &mut egui::Ui| {
                            ui.set_width(theme::TRAY_SATELLITE_CARD_WIDTH);
                            ui.vertical(|ui: &mut egui::Ui| {
                                ui.label(egui::RichText::new("MENACES").font(theme::font_small()));
                                ui.add_space(theme::SPACE_XS);
                                let count = self.state.threats.suspicious_processes.len();
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
            theme::apply_theme(ctx, self.state.settings.dark_mode);
            egui_extras::install_image_loaders(ctx);
            // Scan macOS native apps in background thread to avoid blocking first frame
            #[cfg(target_os = "macos")]
            {
                if let Some(tx) = self.state.async_task_tx.clone() {
                    std::thread::spawn(move || {
                        match crate::os::macos::software::scan_installed_apps() {
                            Ok(apps) => {
                                if let Err(e) = tx.send(AsyncTaskResult::MacOsApps(apps)) {
                                    tracing::warn!("Failed to send macOS apps result: {}", e);
                                }
                            }
                            Err(e) => {
                                tracing::warn!("Failed to scan macOS apps: {}", e);
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
        self.process_tray_actions(ctx);

        // Auto-lock admin mode after 5 minutes of inactivity.
        if self.state.security.admin_unlocked
            && let Some(last_unlock) = self.state.security.last_unlock
                && chrono::Utc::now() - last_unlock > chrono::Duration::minutes(5) {
                    self.state.security.admin_unlocked = false;
                    tracing::info!("Admin mode auto-locked after 5 minutes");
                }

        // Process async task results from background threads
        while let Ok(result) = self.async_results_rx.try_recv() {
             match result {
                 AsyncTaskResult::CsvExport(success, message) => {
                     let time = ctx.input(|i| i.time);
                     if success {
                         self.state.toasts.push(crate::widgets::toast::Toast::success(message).with_time(time));
                     } else {
                         self.state.toasts.push(crate::widgets::toast::Toast::error(message).with_time(time));
                     }
                 }
                 #[cfg(target_os = "macos")]
                 AsyncTaskResult::MacOsApps(apps) => {
                     self.state.software.macos_apps = apps;
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

        // Handle close = hide to tray (instead of quit).
        if ctx.input(|i| i.viewport().close_requested()) && !self.quit_requested {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            ctx.send_viewport_cmd(egui::ViewportCommand::Visible(false));
            self.visible = false;
            #[cfg(target_os = "macos")]
            crate::os::macos::dock::hide_icon();
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
                        if let Err(e) = self.enrollment_tx.send(cmd) {
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
        }) && new_page != self.page
        {
            // Close any open detail drawers from the old page
            self.state.close_all_drawers();
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
                    .stroke(egui::Stroke::new(theme::BORDER_HAIRLINE, theme::border())),
            )
            .show(ctx, |ui: &mut egui::Ui| {
                let scanning = self.state.summary.status == crate::dto::GuiAgentStatus::Scanning;
                let sync_state = widgets::sidebar::SidebarSyncState {
                    syncing: self.state.sync.in_progress,
                    pending_count: self.state.summary.pending_sync_count,
                    last_sync_at: self.state.summary.last_sync_at,
                    error: self.state.sync.error.clone(),
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
                    self.state.close_all_drawers();
                    self.page = new_page;
                    self.page_transition = 0.0;
                }
            });

        // Advance page transition animation
        if self.page_transition < 1.0 {
            let dt = ctx.input(|i| i.stable_dt).min(FRAME_DT_MAX);
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
                        left: theme::SPACE_LG as i8,
                        right: 0,
                        top: theme::SPACE_LG as i8,
                        bottom: theme::SPACE_LG as i8,
                    }),
            )
            .show(ctx, |ui: &mut egui::Ui| {
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
                        egui::Frame::new()
                            .inner_margin(egui::Margin {
                                left: 0,
                                right: theme::SPACE_LG as i8,
                                top: 0,
                                bottom: 0,
                            })
                            .show(ui, |ui: &mut egui::Ui| match self.page {
                                Page::Dashboard => {
                                    if let Some(action) = pages::DashboardPage::show(ui, &self.state) {
                                        match action {
                                            pages::DashboardAction::Command(cmd) => {
                                                self.send_command(cmd);
                                            }
                                            pages::DashboardAction::NavigateTo(page) => {
                                                self.page = page;
                                                self.page_transition = 0.0;
                                            }
                                        }
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
                                Page::AI => {
                                    if let Some(cmd) =
                                        self.llm_panel.show(ui, &mut self.state)
                                    {
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
        // Respect reduced-motion: skip fade animations, show static splash.
        let (alpha, progress) = if theme::is_reduced_motion() {
            (1.0_f32, (elapsed / theme::SPLASH_DURATION).min(1.0))
        } else {
            let a = if elapsed < theme::SPLASH_FADE_IN {
                elapsed / theme::SPLASH_FADE_IN
            } else if elapsed > theme::SPLASH_FADE_OUT_START {
                1.0 - ((elapsed - theme::SPLASH_FADE_OUT_START) / theme::SPLASH_FADE_OUT_DURATION).min(1.0)
            } else {
                1.0
            };
            (a, (elapsed / theme::SPLASH_DURATION).min(1.0))
        };
        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(theme::bg_primary()))
            .show(ctx, |ui: &mut egui::Ui| {
                let size = ui.available_size();
                ui.allocate_new_ui(
                    egui::UiBuilder::new().max_rect(egui::Rect::from_center_size(
                        egui::pos2(size.x / 2.0, size.y / 2.0),
                        egui::vec2(theme::SPLASH_CONTENT_WIDTH, theme::SPLASH_CONTENT_HEIGHT),
                    )),
                    |ui: &mut egui::Ui| {
                        ui.vertical_centered(|ui: &mut egui::Ui| {
                            // Logo image
                            let logo = egui::Image::from_bytes(
                                "bytes://ia_logo",
                                include_bytes!("../assets/IA.png"),
                            )
                            .max_width(theme::ENROLLMENT_LOGO_WIDTH)
                            .tint(theme::text_primary().linear_multiply(alpha));
                            ui.add(logo);

                            ui.add_space(theme::SPACE_LG);

                            // SENTINEL
                            ui.label(
                                egui::RichText::new("SENTINEL")
                                    .font(theme::font_splash())
                                    .color(theme::accent_text().linear_multiply(alpha))
                                    .strong(),
                            );

                            ui.add_space(theme::SPACE_XS);

                            // GRC AGENT
                            ui.label(
                                egui::RichText::new("GRC AGENT")
                                    .font(theme::font_heading())
                                    .color(theme::text_tertiary().linear_multiply(alpha)),
                            );

                            ui.add_space(theme::SPACE_XL);

                            // Progress bar (animated, or static under reduced motion)
                            let bar_w = theme::SPLASH_PROGRESS_WIDTH;
                            let bar_h = theme::PROGRESS_BAR_HEIGHT_THIN;
                            let (bar_rect, _) = ui.allocate_exact_size(
                                egui::vec2(bar_w, bar_h),
                                egui::Sense::empty(),
                            );
                            let painter = ui.painter_at(bar_rect);
                            painter.rect_filled(
                                bar_rect,
                                egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                                theme::border(),
                            );
                            let fill_rect = egui::Rect::from_min_size(
                                bar_rect.min,
                                egui::vec2(bar_w * progress, bar_h),
                            );
                            painter.rect_filled(
                                fill_rect,
                                egui::CornerRadius::same(theme::PROGRESS_BAR_ROUNDING),
                                theme::ACCENT.linear_multiply(alpha),
                            );

                            ui.add_space(theme::SPACE_LG);

                            // CYBER THREAT CONSULTING
                            ui.label(
                                egui::RichText::new("CYBER THREAT CONSULTING")
                                    .font(theme::font_small())
                                    .color(theme::text_tertiary().linear_multiply(alpha))
                                    .strong(),
                            );
                        });
                    },
                );
            });
    }
}
