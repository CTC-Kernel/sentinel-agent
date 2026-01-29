//! System tray integration bridge.
//!
//! Manages the system tray icon alongside the egui window.
//! Close = hide window to tray; tray click = restore window.

use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tray_icon::{Icon, TrayIcon, TrayIconBuilder};
use tracing::{debug, info};

/// Embedded 32x32 tray icon PNG.
static TRAY_ICON_PNG: &[u8] = include_bytes!("../../../assets/icons/png/icon_32x32.png");

/// Commands from the tray menu.
#[derive(Debug, Clone)]
pub enum TrayAction {
    ShowWindow,
    Quit,
}

/// Tray icon menu item IDs.
mod ids {
    pub const SHOW: &str = "tray_show";
    pub const QUIT: &str = "tray_quit";
}

/// System tray wrapper that works alongside the egui window.
pub struct TrayBridge {
    _tray_icon: TrayIcon,
}

impl TrayBridge {
    /// Create the tray icon and menu.
    pub fn new() -> Result<Self, String> {
        let show_item =
            MenuItem::with_id(ids::SHOW, "Ouvrir Sentinel Agent", true, None);
        let quit_item =
            MenuItem::with_id(ids::QUIT, "Quitter", true, None);

        let menu = Menu::new();
        menu.append(&show_item)
            .map_err(|e| format!("menu show: {}", e))?;
        menu.append(&PredefinedMenuItem::separator())
            .map_err(|e| format!("menu sep: {}", e))?;
        menu.append(&quit_item)
            .map_err(|e| format!("menu quit: {}", e))?;

        let icon = Self::load_icon()?;

        let tray_icon = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("Sentinel Agent")
            .with_icon(icon)
            .build()
            .map_err(|e| format!("tray build: {}", e))?;

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
        let img = image::load_from_memory(TRAY_ICON_PNG)
            .map_err(|e| format!("load icon: {}", e))?;
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();
        Icon::from_rgba(rgba.into_raw(), w, h).map_err(|e| format!("icon rgba: {}", e))
    }
}
