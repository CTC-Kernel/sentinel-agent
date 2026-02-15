//! System tray icon and menu for the Sentinel GRC Agent.
//!
//! Provides a lightweight, responsive system tray interface for monitoring
//! and controlling the agent on macOS and Windows.
//!
//! ## Features
//! - Real-time status updates with auto-refresh
//! - Immediate check execution from menu
//! - Resource usage display
//! - Professional UI with localized labels
//!
//! ## Architecture
//! Uses async channels for non-blocking menu event handling.

use crate::ShutdownSignal;
use agent_common::constants::AGENT_VERSION;
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc;
use tracing::{debug, error, info, warn};
use tray_icon::{Icon, TrayIcon, TrayIconBuilder};

// ============================================================================
// Constants
// ============================================================================

/// Status refresh interval in seconds.
const STATUS_REFRESH_INTERVAL_SECS: u64 = 30;

/// Branding URLs for the agent.
pub mod branding {
    use super::company_info;

    /// Main website URL.
    pub const WEBSITE: &str = "https://cyber-threat-consulting.com";
    /// User guide URL.
    pub const GUIDE: &str = "https://cyber-threat-consulting.com/docs";

    /// Product name (re-exported from company_info).
    pub const PRODUCT_NAME: &str = company_info::PRODUCT_NAME;
    /// Company name (re-exported from company_info).
    pub const COMPANY_NAME: &str = company_info::COMPANY_NAME;
    /// Email (re-exported from company_info).
    pub const EMAIL: &str = company_info::EMAIL;
}

/// Company and product information.
mod company_info {
    pub const COMPANY_NAME: &str = "Cyber Threat Consulting";
    pub const PRODUCT_NAME: &str = "Sentinel Agent";
    pub const EMAIL: &str = "***REMOVED***";
}

/// Menu item identifiers.
mod menu_ids {
    pub const HEADER: &str = "header";
    pub const STATUS: &str = "status";
    pub const VERSION: &str = "version";
    pub const RESOURCES: &str = "resources";
    pub const PAUSE: &str = "pause";
    pub const RESUME: &str = "resume";
    pub const CHECK_NOW: &str = "check_now";
    pub const OPEN_LOGS: &str = "open_logs";
    pub const OPEN_DASHBOARD: &str = "open_dashboard";
    pub const OPEN_WEBSITE: &str = "open_website";
    pub const OPEN_GUIDE: &str = "open_guide";
    pub const ABOUT: &str = "about";
    pub const QUIT: &str = "quit";
}

// ============================================================================
// Types
// ============================================================================

/// Agent status for tray display.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentTrayStatus {
    /// Agent is running normally.
    Active,
    /// Agent is paused by user.
    Paused,
    /// Agent encountered an error.
    Error,
    /// Agent is syncing with server.
    Syncing,
    /// Agent is performing a check.
    Checking,
}

impl AgentTrayStatus {
    /// Get the tooltip text for this status.
    pub fn tooltip(&self) -> String {
        let status_text = match self {
            Self::Active => "Actif",
            Self::Paused => "En pause",
            Self::Error => "Erreur",
            Self::Syncing => "Synchronisation",
            Self::Checking => "Vérification en cours",
        };
        format!("{} - {}", branding::PRODUCT_NAME, status_text)
    }

    /// Get the status icon character.
    pub fn icon(&self) -> &'static str {
        match self {
            Self::Active => "●",   // Green dot
            Self::Paused => "◐",   // Half circle
            Self::Error => "◉",    // Error dot
            Self::Syncing => "◌",  // Sync circle
            Self::Checking => "◎", // Checking
        }
    }

    /// Get status text with icon.
    pub fn display_text(&self) -> String {
        let (icon, text) = match self {
            Self::Active => ("✓", "Actif"),
            Self::Paused => ("⏸", "En pause"),
            Self::Error => ("⚠", "Erreur"),
            Self::Syncing => ("⟳", "Synchronisation..."),
            Self::Checking => ("◎", "Vérification..."),
        };
        format!("{} {}", icon, text)
    }
}

/// Commands that can be sent from the tray to the agent.
#[derive(Debug, Clone)]
pub enum TrayCommand {
    /// Pause agent operations.
    Pause,
    /// Resume agent operations.
    Resume,
    /// Run an immediate check.
    CheckNow,
    /// Open the premium tray popup GUI.
    OpenTrayPopup,
    /// Open logs folder.
    OpenLogs,
    /// Open website in browser.
    OpenWebsite,
    /// Open user guide in browser.
    OpenGuide,
    /// Show about dialog.
    About,
    /// Shutdown the agent.
    Shutdown,
}

/// Resource usage for display.
#[derive(Debug, Clone, Default)]
pub struct TrayResourceInfo {
    pub cpu_percent: f64,
    pub memory_mb: u64,
    pub last_check: Option<String>,
    pub compliance_score: Option<u8>,
}

// ============================================================================
// AgentTray
// ============================================================================

/// System tray manager for agent.
pub struct AgentTray {
    tray_icon: TrayIcon,
    status: Arc<std::sync::RwLock<AgentTrayStatus>>,
    paused: Arc<AtomicBool>,
    shutdown: ShutdownSignal,
    menu_items: TrayMenuItems,
    command_tx: mpsc::SyncSender<TrayCommand>,
    last_update: Arc<AtomicU64>,
}

struct TrayMenuItems {
    _header_item: MenuItem,
    status_item: MenuItem,
    _version_item: MenuItem,
    resources_item: MenuItem,
    pause_item: MenuItem,
    resume_item: MenuItem,
    check_now_item: MenuItem,
}

impl AgentTray {
    /// Create a new system tray icon with menu.
    pub fn new(shutdown: ShutdownSignal) -> Result<(Self, mpsc::Receiver<TrayCommand>), TrayError> {
        let (command_tx, command_rx) = mpsc::sync_channel(32);

        // === Header Section ===
        let header_item = MenuItem::with_id(
            menu_ids::HEADER,
            format!("─── {} ───", branding::PRODUCT_NAME.to_uppercase()),
            false,
            None,
        );

        let status_item = MenuItem::with_id(
            menu_ids::STATUS,
            AgentTrayStatus::Active.display_text(),
            false,
            None,
        );

        let version_item = MenuItem::with_id(
            menu_ids::VERSION,
            format!("Version {}", AGENT_VERSION),
            false,
            None,
        );

        let resources_item = MenuItem::with_id(
            menu_ids::RESOURCES,
            "CPU: --% | Mémoire: -- MB",
            false,
            None,
        );

        // === Control Section ===
        let pause_item = MenuItem::with_id(menu_ids::PAUSE, "⏸  Mettre en pause", true, None);
        let resume_item = MenuItem::with_id(menu_ids::RESUME, "▶  Reprendre", false, None);
        let check_now_item =
            MenuItem::with_id(menu_ids::CHECK_NOW, "🔄  Vérifier maintenant", true, None);

        // === Resources Section ===
        let open_dashboard_item =
            MenuItem::with_id(menu_ids::OPEN_DASHBOARD, "🛡️  Radar Sécurité", true, None);
        let open_logs_item =
            MenuItem::with_id(menu_ids::OPEN_LOGS, "📁  Ouvrir les logs", true, None);

        // === Help Section ===
        let help_submenu = Submenu::new("❓  Aide", true);
        let open_guide_item =
            MenuItem::with_id(menu_ids::OPEN_GUIDE, "📖  Guide utilisateur", true, None);
        let open_website_item =
            MenuItem::with_id(menu_ids::OPEN_WEBSITE, "🌐  Console", true, None);
        let about_item = MenuItem::with_id(menu_ids::ABOUT, "ℹ️  À propos", true, None);

        help_submenu
            .append(&open_guide_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        help_submenu
            .append(&open_website_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        help_submenu
            .append(&PredefinedMenuItem::separator())
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        help_submenu
            .append(&about_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        let quit_item = MenuItem::with_id(menu_ids::QUIT, "⏻  Quitter", true, None);

        // === Build Menu ===
        let menu = Menu::new();

        // Header section
        menu.append(&header_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&status_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&version_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&resources_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        // Control section
        menu.append(&pause_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&resume_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&check_now_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        // Resources section
        menu.append(&open_dashboard_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&open_logs_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        // Help section
        menu.append(&help_submenu)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        // Quit
        menu.append(&quit_item)
            .map_err(|e| TrayError::MenuBuild(e.to_string()))?;

        // Create tray icon
        let icon = create_icon(AgentTrayStatus::Active)?;

        let tray_icon = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip(AgentTrayStatus::Active.tooltip())
            .with_icon(icon)
            .build()
            .map_err(|e| TrayError::IconCreate(e.to_string()))?;

        let status = Arc::new(std::sync::RwLock::new(AgentTrayStatus::Active));
        let paused = Arc::new(AtomicBool::new(false));
        let last_update = Arc::new(AtomicU64::new(0));

        let menu_items = TrayMenuItems {
            _header_item: header_item,
            status_item,
            _version_item: version_item,
            resources_item,
            pause_item,
            resume_item,
            check_now_item,
        };

        let tray = Self {
            tray_icon,
            status,
            paused,
            shutdown,
            menu_items,
            command_tx,
            last_update,
        };

        Ok((tray, command_rx))
    }

    /// Check if the agent is paused.
    #[inline]
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Acquire)
    }

    /// Set current status and update tray icon with premium indicator.
    pub fn set_status(&self, new_status: AgentTrayStatus) {
        if let Ok(mut status) = self.status.write()
            && *status != new_status
        {
            *status = new_status;

            // Update tray icon with premium indicator
            if let Ok(new_icon) = create_icon(new_status) {
                if let Err(e) = self.tray_icon.set_icon(Some(new_icon)) {
                    warn!("Failed to update tray icon: {}", e);
                }
                if let Err(e) = self.tray_icon.set_tooltip(Some(new_status.tooltip())) {
                    warn!("Failed to update tray tooltip: {}", e);
                }
            }

            self.menu_items
                .status_item
                .set_text(new_status.display_text());
            debug!("Tray status updated: {:?}", new_status);
        }
    }

    /// Update resource display in the menu.
    pub fn update_resources(&self, info: &TrayResourceInfo) {
        let text = format!(
            "CPU: {:.1}% | Mémoire: {} MB",
            info.cpu_percent, info.memory_mb
        );
        self.menu_items.resources_item.set_text(&text);

        // Update last update timestamp
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.last_update.store(now, Ordering::Release);
    }

    /// Check if status needs refresh (for auto-update).
    pub fn needs_refresh(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let last = self.last_update.load(Ordering::Acquire);
        now.saturating_sub(last) >= STATUS_REFRESH_INTERVAL_SECS
    }

    /// Process a menu event.
    pub fn handle_menu_event(&self, event: &MenuEvent) {
        let id = event.id().0.as_str();

        match id {
            menu_ids::PAUSE => {
                info!("User requested pause");
                self.paused.store(true, Ordering::Release);
                self.menu_items.pause_item.set_enabled(false);
                self.menu_items.resume_item.set_enabled(true);
                self.menu_items.check_now_item.set_enabled(false);
                self.set_status(AgentTrayStatus::Paused);

                // Send command to agent
                if let Err(e) = self.command_tx.send(TrayCommand::Pause) {
                    error!("Failed to send Pause command: {}", e);
                }
            }

            menu_ids::RESUME => {
                info!("User requested resume");
                self.paused.store(false, Ordering::Release);
                self.menu_items.pause_item.set_enabled(true);
                self.menu_items.resume_item.set_enabled(false);
                self.menu_items.check_now_item.set_enabled(true);
                self.set_status(AgentTrayStatus::Active);

                // Send command to agent
                if let Err(e) = self.command_tx.send(TrayCommand::Resume) {
                    error!("Failed to send Resume command: {}", e);
                }
            }

            menu_ids::CHECK_NOW => {
                info!("User requested immediate check");
                self.set_status(AgentTrayStatus::Checking);

                // Send command to agent - the agent will call on_check_complete() when done
                if let Err(e) = self.command_tx.send(TrayCommand::CheckNow) {
                    error!("Failed to send CheckNow command: {}", e);
                }
            }

            menu_ids::OPEN_LOGS => {
                info!("Opening logs folder");
                open_logs_folder();
            }

            menu_ids::OPEN_DASHBOARD => {
                info!("Opening tray popup with premium radar");
                // Launch tray popup GUI directly
                if let Ok(exe) = std::env::current_exe() {
                    if let Err(e) = std::process::Command::new(exe)
                        .args(["--tray-popup"])
                        .spawn()
                    {
                        warn!("Failed to spawn tray popup: {}", e);
                    }
                } else {
                    warn!("Failed to resolve current executable path for tray popup");
                }
            }

            menu_ids::OPEN_WEBSITE => {
                info!("Opening console dashboard");
                open_url("https://app.cyber-threatconsulting.com/agentApi/dashboard");
            }

            menu_ids::OPEN_GUIDE => {
                info!("Opening user guide");
                open_url(branding::GUIDE);
            }

            menu_ids::ABOUT => {
                info!("Showing about dialog");
                show_about_dialog();
            }

            menu_ids::QUIT => {
                info!("User requested quit");
                if let Err(e) = self.command_tx.send(TrayCommand::Shutdown) {
                    error!("Failed to send Shutdown command: {}", e);
                }
                self.shutdown.store(true, Ordering::SeqCst);
            }

            _ => {
                debug!("Unhandled menu event: {}", id);
            }
        }
    }

    /// Reset to active state after a check completes.
    pub fn on_check_complete(&self, success: bool) {
        if success {
            self.set_status(AgentTrayStatus::Active);
        } else {
            self.set_status(AgentTrayStatus::Error);
        }
        self.menu_items.check_now_item.set_enabled(true);
    }

    /// Start sync with animated premium indicator.
    pub fn start_sync(&self) {
        self.set_status(AgentTrayStatus::Syncing);
    }

    /// Stop sync and return to active state.
    pub fn stop_sync(&self) {
        self.set_status(AgentTrayStatus::Active);
    }

    /// Update sync animation frame (called periodically).
    pub fn update_sync_animation(&self) {
        if let Ok(status) = self.status.read()
            && *status == AgentTrayStatus::Syncing
        {
            // Refresh icon to update animation
            if let Ok(new_icon) = create_icon(AgentTrayStatus::Syncing)
                && let Err(e) = self.tray_icon.set_icon(Some(new_icon))
            {
                warn!("Failed to update sync animation: {}", e);
            }
        }
    }
}

// ============================================================================
// Icon Management
// ============================================================================

/// Embedded icon data (44x44 PNG – macOS menu bar @2x Retina template).
static ICON_32_PNG: &[u8] = include_bytes!("../../../assets/icons/png/tray_44.png");

/// Create an icon for given status with premium sync indicator.
fn create_icon(status: AgentTrayStatus) -> Result<Icon, TrayError> {
    let base_img = image::load_from_memory(ICON_32_PNG)
        .map_err(|e| TrayError::IconCreate(format!("Failed to load icon: {}", e)))?;

    let mut rgba_image = base_img.to_rgba8();
    let (width, height) = rgba_image.dimensions();

    // Add premium sync indicator for syncing status
    if status == AgentTrayStatus::Syncing {
        add_sync_indicator(&mut rgba_image, width, height)?;
    } else if status == AgentTrayStatus::Checking {
        add_check_indicator(&mut rgba_image, width, height)?;
    } else if status == AgentTrayStatus::Error {
        add_error_indicator(&mut rgba_image, width, height)?;
    }

    let rgba_data = rgba_image.into_raw();

    Icon::from_rgba(rgba_data, width, height).map_err(|e| TrayError::IconCreate(e.to_string()))
}

/// Add animated sync indicator to tray icon.
fn add_sync_indicator(
    img: &mut image::RgbaImage,
    width: u32,
    height: u32,
) -> Result<(), TrayError> {
    let center_x = width as i32 - 6;
    let center_y = 6;
    let radius = 4;

    // Draw rotating arc for sync effect
    let time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f32();
    let angle = (time * 2.0) % (2.0 * std::f32::consts::PI);

    // Draw sync circle with arc
    for i in 0..8 {
        let theta = (i as f32 / 8.0) * 2.0 * std::f32::consts::PI;
        let next_theta = ((i + 1) as f32 / 8.0) * 2.0 * std::f32::consts::PI;

        if (theta..next_theta).contains(&angle) {
            // Active segment - bright blue
            let x = center_x + (radius as f32 * theta.cos()) as i32;
            let y = center_y + (radius as f32 * theta.sin()) as i32;

            if x >= 0 && y >= 0 && x < width as i32 && y < height as i32 {
                let pixel = img.get_pixel_mut(x as u32, y as u32);
                *pixel = image::Rgba([0, 150, 255, 255]); // Bright blue
            }
        } else {
            // Inactive segment - dim blue
            let x = center_x + (radius as f32 * theta.cos()) as i32;
            let y = center_y + (radius as f32 * theta.sin()) as i32;

            if x >= 0 && y >= 0 && x < width as i32 && y < height as i32 {
                let pixel = img.get_pixel_mut(x as u32, y as u32);
                *pixel = image::Rgba([0, 80, 150, 180]); // Dim blue
            }
        }
    }

    Ok(())
}

/// Add check indicator to tray icon.
fn add_check_indicator(
    img: &mut image::RgbaImage,
    width: u32,
    height: u32,
) -> Result<(), TrayError> {
    let center_x = width as i32 - 6;
    let center_y = 6;

    // Draw orange check indicator
    for dx in -2i32..=2i32 {
        for dy in -2i32..=2i32 {
            let x = center_x + dx;
            let y = center_y + dy;

            if x >= 0 && y >= 0 && x < width as i32 && y < height as i32 {
                let pixel = img.get_pixel_mut(x as u32, y as u32);
                *pixel = image::Rgba([255, 150, 0, 200]); // Orange
            }
        }
    }

    Ok(())
}

/// Add error indicator to tray icon.
fn add_error_indicator(
    img: &mut image::RgbaImage,
    width: u32,
    height: u32,
) -> Result<(), TrayError> {
    let center_x = width as i32 - 6;
    let center_y = 6;

    // Draw red error indicator
    for dx in -2i32..=2i32 {
        for dy in -2i32..=2i32 {
            if dx.abs() == dy.abs() || (dx == 0 && dy == 0) {
                let x = center_x + dx;
                let y = center_y + dy;

                if x >= 0 && y >= 0 && x < width as i32 && y < height as i32 {
                    let pixel = img.get_pixel_mut(x as u32, y as u32);
                    *pixel = image::Rgba([255, 50, 50, 255]); // Red
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// Platform Utilities
// ============================================================================

/// Open the logs folder in the system file browser.
fn open_logs_folder() {
    let log_path = get_logs_path();

    if let Err(e) = open::that(&log_path) {
        warn!("Failed to open logs folder: {}", e);
        // Try opening parent directory
        if let Some(parent) = log_path.parent() {
            let _ = open::that(parent);
        }
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

/// Open a URL in the default browser.
fn open_url(url: &str) {
    if let Err(e) = open::that(url) {
        error!("Failed to open URL '{}': {}", url, e);
    }
}

/// Show the about dialog.
fn show_about_dialog() {
    let version = AGENT_VERSION;
    let os_info = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);

    // Log about info
    info!(
        "\n╔══════════════════════════════════════════════════════════╗\n\
         ║  {} v{}                                  ║\n\
         ║  {}                                      ║\n\
         ╠══════════════════════════════════════════════════════════╣\n\
         ║  Système: {}                                             ║\n\
         ║  Site web: {}                            ║\n\
         ║  Contact: {}                   ║\n\
         ╚══════════════════════════════════════════════════════════╝",
        branding::PRODUCT_NAME,
        version,
        branding::COMPANY_NAME,
        os_info,
        branding::WEBSITE,
        branding::EMAIL
    );

    // Open website with version info
    let about_url = format!("{}?version={}&os={}", branding::WEBSITE, version, os_info);
    if let Err(e) = open::that(&about_url) {
        // Fallback to plain website
        let _ = open::that(branding::WEBSITE);
        debug!("Fallback to plain website URL: {}", e);
    }
}

// ============================================================================
// Errors
// ============================================================================

/// Errors that can occur with the tray icon.
#[derive(Debug, thiserror::Error)]
pub enum TrayError {
    #[error("Failed to build menu: {0}")]
    MenuBuild(String),
    #[error("Failed to create icon: {0}")]
    IconCreate(String),
    #[error("Failed to create tray: {0}")]
    TrayCreate(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_tooltip() {
        assert!(AgentTrayStatus::Active.tooltip().contains("Actif"));
        assert!(AgentTrayStatus::Paused.tooltip().contains("pause"));
        assert!(AgentTrayStatus::Error.tooltip().contains("Erreur"));
        assert!(
            AgentTrayStatus::Syncing
                .tooltip()
                .contains("Synchronisation")
        );
        assert!(AgentTrayStatus::Checking.tooltip().contains("Vérification"));
    }

    #[test]
    fn test_status_display_text() {
        let active = AgentTrayStatus::Active.display_text();
        assert!(active.contains("Actif"));
        assert!(active.contains("✓"));
    }

    #[test]
    fn test_create_icon() {
        let icon = create_icon(AgentTrayStatus::Active);
        assert!(icon.is_ok());
    }

    #[test]
    fn test_branding_urls() {
        assert!(branding::WEBSITE.starts_with("https://"));
        assert!(branding::GUIDE.starts_with("https://"));
        assert!(branding::EMAIL.contains("@"));
    }

    #[test]
    fn test_tray_resource_info_default() {
        let info = TrayResourceInfo::default();
        assert_eq!(info.cpu_percent, 0.0);
        assert_eq!(info.memory_mb, 0);
        assert!(info.last_check.is_none());
        assert!(info.compliance_score.is_none());
    }
}
