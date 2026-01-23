//! System tray icon and menu for the Sentinel GRC Agent.
//!
//! Provides a lightweight system tray interface for monitoring and controlling
//! the agent on macOS and Windows.

use crate::ShutdownSignal;
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tray_icon::{Icon, TrayIcon, TrayIconBuilder};
use tracing::{debug, error, info, warn};

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
}

impl AgentTrayStatus {
    /// Get the tooltip text for this status.
    pub fn tooltip(&self) -> &'static str {
        match self {
            Self::Active => "Sentinel GRC Agent - Actif",
            Self::Paused => "Sentinel GRC Agent - En pause",
            Self::Error => "Sentinel GRC Agent - Erreur",
            Self::Syncing => "Sentinel GRC Agent - Synchronisation...",
        }
    }
}

/// Menu item identifiers.
mod menu_ids {
    pub const STATUS: &str = "status";
    pub const PAUSE: &str = "pause";
    pub const RESUME: &str = "resume";
    pub const CHECK_NOW: &str = "check_now";
    pub const OPEN_LOGS: &str = "open_logs";
    pub const OPEN_DASHBOARD: &str = "open_dashboard";
    pub const QUIT: &str = "quit";
}

/// System tray manager for the agent.
pub struct AgentTray {
    _tray_icon: TrayIcon,
    status: Arc<std::sync::RwLock<AgentTrayStatus>>,
    paused: Arc<AtomicBool>,
    shutdown: ShutdownSignal,
    menu_items: TrayMenuItems,
}

struct TrayMenuItems {
    status_item: MenuItem,
    pause_item: MenuItem,
    resume_item: MenuItem,
}

impl AgentTray {
    /// Create a new system tray icon with menu.
    pub fn new(shutdown: ShutdownSignal) -> Result<Self, TrayError> {
        // Create menu items
        let status_item = MenuItem::with_id(
            menu_ids::STATUS,
            "Statut: Actif",
            false, // disabled - just for display
            None,
        );

        let pause_item = MenuItem::with_id(
            menu_ids::PAUSE,
            "Mettre en pause",
            true,
            None,
        );

        let resume_item = MenuItem::with_id(
            menu_ids::RESUME,
            "Reprendre",
            false, // initially disabled
            None,
        );

        let check_now_item = MenuItem::with_id(
            menu_ids::CHECK_NOW,
            "Vérifier maintenant",
            true,
            None,
        );

        let open_logs_item = MenuItem::with_id(
            menu_ids::OPEN_LOGS,
            "Ouvrir les logs",
            true,
            None,
        );

        let open_dashboard_item = MenuItem::with_id(
            menu_ids::OPEN_DASHBOARD,
            "Ouvrir le tableau de bord",
            true,
            None,
        );

        let quit_item = MenuItem::with_id(
            menu_ids::QUIT,
            "Quitter",
            true,
            None,
        );

        // Build the menu
        let menu = Menu::new();
        menu.append(&status_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator()).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&pause_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&resume_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&check_now_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator()).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&open_logs_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&open_dashboard_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&PredefinedMenuItem::separator()).map_err(|e| TrayError::MenuBuild(e.to_string()))?;
        menu.append(&quit_item).map_err(|e| TrayError::MenuBuild(e.to_string()))?;

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

        let menu_items = TrayMenuItems {
            status_item,
            pause_item,
            resume_item,
        };

        Ok(Self {
            _tray_icon: tray_icon,
            status,
            paused,
            shutdown,
            menu_items,
        })
    }

    /// Check if the agent is paused.
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    /// Set the current status and update the tray icon.
    pub fn set_status(&self, new_status: AgentTrayStatus) {
        if let Ok(mut status) = self.status.write() {
            *status = new_status;

            // Update status text
            let status_text = match new_status {
                AgentTrayStatus::Active => "Statut: Actif ✓",
                AgentTrayStatus::Paused => "Statut: En pause ⏸",
                AgentTrayStatus::Error => "Statut: Erreur ⚠",
                AgentTrayStatus::Syncing => "Statut: Sync...",
            };
            self.menu_items.status_item.set_text(status_text);
        }
    }

    /// Process a menu event.
    pub fn handle_menu_event(&self, event: &MenuEvent) {
        match event.id().0.as_str() {
            menu_ids::PAUSE => {
                info!("User requested pause");
                self.paused.store(true, Ordering::SeqCst);
                self.menu_items.pause_item.set_enabled(false);
                self.menu_items.resume_item.set_enabled(true);
                self.set_status(AgentTrayStatus::Paused);
            }
            menu_ids::RESUME => {
                info!("User requested resume");
                self.paused.store(false, Ordering::SeqCst);
                self.menu_items.pause_item.set_enabled(true);
                self.menu_items.resume_item.set_enabled(false);
                self.set_status(AgentTrayStatus::Active);
            }
            menu_ids::CHECK_NOW => {
                info!("User requested immediate check");
                // TODO: Trigger immediate check via channel
            }
            menu_ids::OPEN_LOGS => {
                info!("Opening logs folder");
                open_logs_folder();
            }
            menu_ids::OPEN_DASHBOARD => {
                info!("Opening dashboard");
                open_dashboard();
            }
            menu_ids::QUIT => {
                info!("User requested quit");
                self.shutdown.store(true, Ordering::SeqCst);
            }
            _ => {
                debug!("Unknown menu event: {:?}", event.id());
            }
        }
    }
}

/// Embedded icon data (32x32 PNG converted to RGBA)
/// This is the Sentinel logo - a shield with checkmark
static ICON_32_PNG: &[u8] = include_bytes!("../../../assets/icons/png/icon_32x32.png");

/// Create an icon for the given status.
fn create_icon(_status: AgentTrayStatus) -> Result<Icon, TrayError> {
    // Load the embedded PNG icon
    let img = image::load_from_memory(ICON_32_PNG)
        .map_err(|e| TrayError::IconCreate(format!("Failed to load icon: {}", e)))?;

    let rgba_image = img.to_rgba8();
    let (width, height) = rgba_image.dimensions();
    let rgba_data = rgba_image.into_raw();

    Icon::from_rgba(rgba_data, width, height)
        .map_err(|e| TrayError::IconCreate(e.to_string()))
}

/// Open the logs folder in the system file browser.
fn open_logs_folder() {
    #[cfg(target_os = "macos")]
    let log_path = "/var/log/sentinel-grc";

    #[cfg(target_os = "windows")]
    let log_path = r"C:\ProgramData\Sentinel\logs";

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let log_path = "/var/log/sentinel-grc";

    if let Err(e) = open::that(log_path) {
        warn!("Failed to open logs folder: {}", e);
        // Try opening parent directory if logs folder doesn't exist
        #[cfg(target_os = "macos")]
        let _ = open::that("/var/log");
        #[cfg(target_os = "windows")]
        let _ = open::that(r"C:\ProgramData\Sentinel");
    }
}

/// Open the web dashboard in the default browser.
fn open_dashboard() {
    // Opens the dedicated agent settings page in Sentinel GRC
    let dashboard_url = "https://sentinel-grc-a8701.web.app/settings?tab=agents";
    if let Err(e) = open::that(dashboard_url) {
        error!("Failed to open dashboard: {}", e);
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_tooltip() {
        assert!(AgentTrayStatus::Active.tooltip().contains("Actif"));
        assert!(AgentTrayStatus::Paused.tooltip().contains("pause"));
        assert!(AgentTrayStatus::Error.tooltip().contains("Erreur"));
    }

    #[test]
    fn test_create_icon() {
        let icon = create_icon(AgentTrayStatus::Active);
        assert!(icon.is_ok());
    }
}
