// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! System tray integration bridge.
//!
//! Manages the system tray icon alongside the egui window.
//! Close = hide window to tray; tray click = restore window.
//!
//! The tray menu mirrors all capabilities of the standalone tray mode:
//! status, version, resources, controls, logs, help, and quit.
//!
//! ## Event handling (Windows / winit compatibility)
//!
//! Uses `set_event_handler` as recommended by `tray-icon` for winit-based
//! applications.  Events are captured in a global `Arc<Mutex<VecDeque>>`
//! and drained by the poll thread, which then forwards them to eframe.

use agent_common::constants::AGENT_VERSION;
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::{debug, info, warn};
use tray_icon::{Icon, TrayIcon, TrayIconBuilder, TrayIconEvent};

/// Embedded tray icon PNG.
/// On macOS, we use a 22x22 template image for the status bar.
#[cfg(target_os = "macos")]
static TRAY_ICON_PNG: &[u8] = include_bytes!("../../../assets/icons/png/tray_22.png");
#[cfg(not(target_os = "macos"))]
static TRAY_ICON_PNG: &[u8] = include_bytes!("../../../assets/icons/png/icon_32x32.png");

/// Branding constants.
mod branding {
    pub const PRODUCT_NAME: &str = "Sentinel Agent";
    pub const COMPANY_NAME: &str = "Cyber Threat Consulting";
    pub const EMAIL: &str = "***REMOVED***";
    pub const WEBSITE: &str = "https://cyber-threat-consulting.com";
    pub const GUIDE: &str = "https://cyber-threat-consulting.com/docs";
    pub const CONSOLE: &str = "https://app.cyber-threat-consulting.com";
}

/// Commands from the tray menu.
#[derive(Debug, Clone)]
pub enum TrayAction {
    ShowWindow,
    QuickStatus,
    Pause,
    Resume,
    RunCheck,
    ForceSync,
    OpenLogs,
    OpenGuide,
    OpenConsole,
    About,
    Quit,
}

/// Tray icon menu item IDs.
mod ids {
    pub const HEADER: &str = "tray_header";
    pub const STATUS: &str = "tray_status";
    pub const VERSION: &str = "tray_version";
    pub const RESOURCES: &str = "tray_resources";
    pub const SHOW: &str = "tray_show";
    pub const QUICK_STATUS: &str = "tray_quick_status";
    pub const PAUSE: &str = "tray_pause";
    pub const RESUME: &str = "tray_resume";
    pub const CHECK: &str = "tray_check";
    pub const SYNC: &str = "tray_sync";
    pub const OPEN_LOGS: &str = "tray_open_logs";
    pub const OPEN_GUIDE: &str = "tray_open_guide";
    pub const OPEN_CONSOLE: &str = "tray_open_console";
    pub const ABOUT: &str = "tray_about";
    pub const QUIT: &str = "tray_quit";
}

// ============================================================================
// Global event queues (set_event_handler approach for winit compatibility)
// ============================================================================

/// Pending menu events captured by the global handler.
static MENU_EVENTS: OnceLock<Arc<Mutex<VecDeque<MenuEvent>>>> = OnceLock::new();

/// Pending tray icon events captured by the global handler.
static TRAY_ICON_EVENTS: OnceLock<Arc<Mutex<VecDeque<TrayIconEvent>>>> = OnceLock::new();

fn menu_events_queue() -> &'static Arc<Mutex<VecDeque<MenuEvent>>> {
    MENU_EVENTS.get_or_init(|| Arc::new(Mutex::new(VecDeque::new())))
}

fn tray_icon_events_queue() -> &'static Arc<Mutex<VecDeque<TrayIconEvent>>> {
    TRAY_ICON_EVENTS.get_or_init(|| Arc::new(Mutex::new(VecDeque::new())))
}

/// Install global event handlers once.  Must be called before any tray icon
/// is created so that `OnceCell`-based handlers inside `tray-icon` / `muda`
/// are initialised to our closures rather than to `None`.
fn install_event_handlers() {
    let menu_q = menu_events_queue().clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        info!("MENU EVENT HANDLER: id={}", event.id().0);
        if let Ok(mut q) = menu_q.lock() {
            q.push_back(event);
        }
    }));

    let tray_q = tray_icon_events_queue().clone();
    TrayIconEvent::set_event_handler(Some(move |event: TrayIconEvent| {
        debug!("TRAY ICON EVENT HANDLER: {:?}", event);
        if let Ok(mut q) = tray_q.lock() {
            q.push_back(event);
        }
    }));
}

/// System tray wrapper that works alongside the egui window.
pub struct TrayBridge {
    _tray_icon: TrayIcon,
    status_item: MenuItem,
    resources_item: MenuItem,
    pause_item: MenuItem,
    resume_item: MenuItem,
}

impl TrayBridge {
    /// Create the tray icon and full menu.
    pub fn new() -> Result<Self, String> {
        // Install set_event_handler BEFORE building the tray icon so that
        // the OnceCell inside muda / tray-icon is set to our handler.
        install_event_handlers();

        let m = |e: muda::Error| e.to_string();

        // === Header Section ===
        let header_item = MenuItem::with_id(
            ids::HEADER,
            format!("─── {} ───", branding::PRODUCT_NAME.to_uppercase()),
            false,
            None,
        );
        let status_item = MenuItem::with_id(ids::STATUS, "✓ Actif", false, None);
        let version_item = MenuItem::with_id(
            ids::VERSION,
            format!("Version {}", AGENT_VERSION),
            false,
            None,
        );
        let resources_item =
            MenuItem::with_id(ids::RESOURCES, "CPU: --% | Mémoire: -- MB", false, None);

        // === Show / Dashboard ===
        let show_item = MenuItem::with_id(ids::SHOW, "● Ouvrir Sentinel Agent", true, None);
        let quick_item = MenuItem::with_id(ids::QUICK_STATUS, "🛡️  Radar Sécurité", true, None);

        // === Control Section ===
        let pause_item = MenuItem::with_id(ids::PAUSE, "⏸  Mettre en pause", true, None);
        let resume_item = MenuItem::with_id(ids::RESUME, "▶  Reprendre", false, None);
        let check_item = MenuItem::with_id(ids::CHECK, "🔄  Vérifier maintenant", true, None);
        let sync_item = MenuItem::with_id(ids::SYNC, "☁  Synchroniser", true, None);

        // === Resources Section ===
        let logs_item = MenuItem::with_id(ids::OPEN_LOGS, "📁  Ouvrir les logs", true, None);

        // === Help Submenu ===
        let help_submenu = Submenu::new("❓  Aide", true);
        let guide_item = MenuItem::with_id(ids::OPEN_GUIDE, "📖  Guide utilisateur", true, None);
        let console_item = MenuItem::with_id(ids::OPEN_CONSOLE, "🌐  Console", true, None);
        let about_item = MenuItem::with_id(ids::ABOUT, "ℹ️  À propos", true, None);

        help_submenu.append(&guide_item).map_err(&m)?;
        help_submenu.append(&console_item).map_err(&m)?;
        help_submenu
            .append(&PredefinedMenuItem::separator())
            .map_err(&m)?;
        help_submenu.append(&about_item).map_err(&m)?;

        let quit_item = MenuItem::with_id(ids::QUIT, "⏻  Quitter", true, None);

        // === Build Menu ===
        let menu = Menu::new();

        // Header section
        menu.append(&header_item).map_err(&m)?;
        menu.append(&status_item).map_err(&m)?;
        menu.append(&version_item).map_err(&m)?;
        menu.append(&resources_item).map_err(&m)?;
        menu.append(&PredefinedMenuItem::separator()).map_err(&m)?;

        // Window controls
        menu.append(&show_item).map_err(&m)?;
        menu.append(&quick_item).map_err(&m)?;
        menu.append(&PredefinedMenuItem::separator()).map_err(&m)?;

        // Agent controls
        menu.append(&pause_item).map_err(&m)?;
        menu.append(&resume_item).map_err(&m)?;
        menu.append(&check_item).map_err(&m)?;
        menu.append(&sync_item).map_err(&m)?;
        menu.append(&PredefinedMenuItem::separator()).map_err(&m)?;

        // Resources
        menu.append(&logs_item).map_err(&m)?;
        menu.append(&PredefinedMenuItem::separator()).map_err(&m)?;

        // Help
        menu.append(&help_submenu).map_err(&m)?;
        menu.append(&PredefinedMenuItem::separator()).map_err(&m)?;

        // Quit
        menu.append(&quit_item).map_err(&m)?;

        let icon = Self::load_icon()?;

        let tray_icon = if cfg!(target_os = "macos") {
            TrayIconBuilder::new()
                .with_menu(Box::new(menu))
                .with_tooltip("Sentinel Agent — Actif")
                .with_icon(icon)
                .with_icon_as_template(true)
                .build()
                .map_err(|e| format!("tray build: {}", e))?
        } else {
            TrayIconBuilder::new()
                .with_menu(Box::new(menu))
                .with_menu_on_left_click(true)
                .with_tooltip("Sentinel Agent — Actif")
                .with_icon(icon)
                .build()
                .map_err(|e| format!("tray build: {}", e))?
        };

        info!("System tray icon created (full menu, event handlers installed)");
        Ok(Self {
            _tray_icon: tray_icon,
            status_item,
            resources_item,
            pause_item,
            resume_item,
        })
    }

    /// Update the status text in the tray menu.
    pub fn set_status(&self, text: &str) {
        self.status_item.set_text(text);
    }

    /// Update the resource info line.
    pub fn update_resources(&self, cpu_percent: f64, memory_mb: u64) {
        let text = format!("CPU: {:.1}% | Mémoire: {} MB", cpu_percent, memory_mb);
        self.resources_item.set_text(&text);
    }

    /// Set paused state (toggles pause/resume menu items).
    pub fn set_paused(&self, paused: bool) {
        self.pause_item.set_enabled(!paused);
        self.resume_item.set_enabled(paused);
        if paused {
            self.status_item.set_text("⏸ En pause");
        } else {
            self.status_item.set_text("✓ Actif");
        }
    }

    /// Drain pending tray and menu events and return actions.
    ///
    /// Events are captured by the global `set_event_handler` closures and
    /// buffered in `Arc<Mutex<VecDeque>>`.  This method drains those queues
    /// from any thread.
    pub fn poll_events() -> Vec<TrayAction> {
        let mut actions = Vec::new();

        // 1. Drain TrayIconEvent queue (icon clicks)
        if let Ok(mut q) = tray_icon_events_queue().lock() {
            while let Some(event) = q.pop_front() {
                if let TrayIconEvent::Click {
                    button: tray_icon::MouseButton::Left,
                    button_state: tray_icon::MouseButtonState::Up,
                    ..
                } = event
                {
                    debug!("Tray icon left-clicked, showing window");
                    actions.push(TrayAction::ShowWindow);
                }
            }
        }

        // 2. Drain MenuEvent queue (menu item clicks)
        if let Ok(mut q) = menu_events_queue().lock() {
            while let Some(event) = q.pop_front() {
                let id_str = event.id().0.as_str();
                debug!("Processing tray menu event: id={}", id_str);
                match id_str {
                    ids::SHOW => {
                        debug!("Tray: show window requested");
                        actions.push(TrayAction::ShowWindow);
                    }
                    ids::QUICK_STATUS => {
                        debug!("Tray: quick status requested");
                        actions.push(TrayAction::QuickStatus);
                    }
                    ids::PAUSE => {
                        info!("Tray: pause requested");
                        actions.push(TrayAction::Pause);
                    }
                    ids::RESUME => {
                        info!("Tray: resume requested");
                        actions.push(TrayAction::Resume);
                    }
                    ids::CHECK => {
                        debug!("Tray: run check requested");
                        actions.push(TrayAction::RunCheck);
                    }
                    ids::SYNC => {
                        debug!("Tray: force sync requested");
                        actions.push(TrayAction::ForceSync);
                    }
                    ids::OPEN_LOGS => {
                        info!("Tray: open logs requested");
                        actions.push(TrayAction::OpenLogs);
                    }
                    ids::OPEN_GUIDE => {
                        info!("Tray: open guide requested");
                        actions.push(TrayAction::OpenGuide);
                    }
                    ids::OPEN_CONSOLE => {
                        info!("Tray: open console requested");
                        actions.push(TrayAction::OpenConsole);
                    }
                    ids::ABOUT => {
                        info!("Tray: about requested");
                        actions.push(TrayAction::About);
                    }
                    ids::QUIT => {
                        info!("Tray: quit requested");
                        actions.push(TrayAction::Quit);
                    }
                    _ => {
                        debug!("Tray: unhandled menu item clicked: {}", id_str);
                    }
                }
            }
        }

        actions
    }

    fn load_icon() -> Result<Icon, String> {
        let img =
            image::load_from_memory(TRAY_ICON_PNG).map_err(|e| format!("load icon: {}", e))?;
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();
        Icon::from_rgba(rgba.into_raw(), w, h).map_err(|e| format!("icon rgba: {}", e))
    }
}

// ============================================================================
// Platform Utilities (used by TrayAction handlers in app.rs)
// ============================================================================

/// Open the logs folder in the system file browser.
pub fn open_logs_folder() {
    let log_path = get_logs_path();
    if let Err(e) = open::that(&log_path) {
        warn!("Failed to open logs folder: {}", e);
        if let Some(parent) = log_path.parent() {
            let _ = open::that(parent);
        }
    }
}

/// Open a URL in the default browser (HTTPS only).
pub fn open_url(url: &str) {
    if !url.starts_with("https://") {
        warn!("Refused to open non-HTTPS URL: {}", url);
        return;
    }
    if let Err(e) = open::that(url) {
        warn!("Failed to open URL '{}': {}", url, e);
    }
}

/// Open the user guide.
pub fn open_guide() {
    open_url(branding::GUIDE);
}

/// Open the web console.
pub fn open_console() {
    open_url(&format!("{}/dashboard", branding::CONSOLE));
}

/// Open the about page.
pub fn open_about() {
    let version = AGENT_VERSION;
    let os_info = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);

    info!(
        "{} v{} — {} | {} | {}",
        branding::PRODUCT_NAME,
        version,
        branding::COMPANY_NAME,
        os_info,
        branding::EMAIL,
    );

    // URL-encode the os_info (contains spaces like "windows x86_64")
    let os_encoded = os_info.replace(' ', "%20");
    let about_url = format!(
        "{}?version={}&os={}",
        branding::WEBSITE,
        version,
        os_encoded
    );
    if open::that(&about_url).is_err() {
        let _ = open::that(branding::WEBSITE);
    }
}

/// Get the platform-specific logs path.
fn get_logs_path() -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    {
        directories::BaseDirs::new()
            .map(|dirs| dirs.data_dir().join("SentinelGRC").join("logs"))
            .unwrap_or_else(|| {
                std::path::PathBuf::from("/Library/Application Support/SentinelGRC/logs")
            })
    }

    #[cfg(target_os = "windows")]
    {
        std::path::PathBuf::from(r"C:\ProgramData\Sentinel\logs")
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::path::PathBuf::from("/var/log/sentinel-grc")
    }
}
