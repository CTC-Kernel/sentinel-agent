//! System tray integration bridge.
//!
//! Manages the system tray icon alongside the egui window.
//! Close = hide window to tray; tray click = restore window.

use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tracing::{debug, info};
use tray_icon::{Icon, TrayIcon, TrayIconBuilder};

/// Embedded tray icon PNG.
/// On macOS, we use a 22x22 template image for the status bar.
#[cfg(target_os = "macos")]
static TRAY_ICON_PNG: &[u8] = include_bytes!("../../../assets/icons/png/tray_22.png");
#[cfg(not(target_os = "macos"))]
static TRAY_ICON_PNG: &[u8] = include_bytes!("../../../assets/icons/png/icon_32x32.png");

/// Commands from the tray menu.
#[derive(Debug, Clone)]
pub enum TrayAction {
    ShowWindow,
    QuickStatus,
    RunCheck,
    ForceSync,
    Quit,
}

/// Tray icon menu item IDs.
mod ids {
    pub const SHOW: &str = "tray_show";
    pub const QUICK_STATUS: &str = "tray_quick_status";
    pub const CHECK: &str = "tray_check";
    pub const SYNC: &str = "tray_sync";
    pub const QUIT: &str = "tray_quit";
}

/// System tray wrapper that works alongside the egui window.
pub struct TrayBridge {
    _tray_icon: TrayIcon,
}

impl TrayBridge {
    /// Create the tray icon and menu.
    pub fn new() -> Result<Self, String> {
        let show_item = MenuItem::with_id(ids::SHOW, "\u{25cf} Ouvrir Sentinel Agent", true, None);
        let quick_item = MenuItem::with_id(
            ids::QUICK_STATUS,
            "\u{1f6f0} Dashboard Radar Premium",
            true,
            None,
        );
        let check_item = MenuItem::with_id(
            ids::CHECK,
            "\u{1f6e1} V\u{00e9}rifier la conformit\u{00e9}",
            true,
            None,
        );
        let sync_item = MenuItem::with_id(
            ids::SYNC,
            "\u{2601} Synchroniser les donn\u{00e9}es",
            true,
            None,
        );
        let quit_item = MenuItem::with_id(ids::QUIT, "\u{23fb} Quitter", true, None);

        let menu = Menu::new();
        menu.append(&show_item)
            .map_err(|e| format!("menu show: {}", e))?;
        menu.append(&quick_item)
            .map_err(|e| format!("menu quick: {}", e))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| format!("menu sep1: {}", e))?;
        menu.append(&check_item)
            .map_err(|e| format!("menu check: {}", e))?;
        menu.append(&sync_item)
            .map_err(|e| format!("menu sync: {}", e))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| format!("menu sep2: {}", e))?;
        menu.append(&quit_item)
            .map_err(|e| format!("menu quit: {}", e))?;

        let icon = Self::load_icon()?;

        let tray_icon = if cfg!(target_os = "macos") {
            TrayIconBuilder::new()
                .with_menu(Box::new(menu))
                .with_tooltip("Sentinel Agent")
                .with_icon(icon)
                .with_icon_as_template(true)
                .build()
                .map_err(|e| format!("tray build: {}", e))?
        } else {
            TrayIconBuilder::new()
                .with_menu(Box::new(menu))
                .with_tooltip("Sentinel Agent")
                .with_icon(icon)
                .build()
                .map_err(|e| format!("tray build: {}", e))?
        };

        info!("System tray icon created");
        Ok(Self {
            _tray_icon: tray_icon,
        })
    }

    /// Poll pending menu events and return actions.
    pub fn poll_events() -> Vec<TrayAction> {
        let rx = MenuEvent::receiver();
        let mut actions = Vec::new();

        while let Ok(event) = rx.try_recv() {
            match event.id().0.as_str() {
                ids::SHOW => {
                    debug!("Tray: show window requested");
                    actions.push(TrayAction::ShowWindow);
                }
                ids::QUICK_STATUS => {
                    debug!("Tray: quick status requested");
                    actions.push(TrayAction::QuickStatus);
                }
                ids::CHECK => {
                    debug!("Tray: run check requested");
                    actions.push(TrayAction::RunCheck);
                }
                ids::SYNC => {
                    debug!("Tray: force sync requested");
                    actions.push(TrayAction::ForceSync);
                }
                ids::QUIT => {
                    info!("Tray: quit requested");
                    actions.push(TrayAction::Quit);
                }
                other => {
                    debug!("Tray: unknown menu event {}", other);
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
