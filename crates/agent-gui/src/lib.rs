//! Agent GUI - Desktop interface for the Sentinel GRC Agent.
//!
//! This crate provides both the data contracts (DTOs, events) and the full
//! egui/eframe desktop GUI for the Sentinel Agent.
//!
//! # Feature flags
//!
//! - `render` (default) - Includes the egui/eframe rendering code, theme,
//!   widgets, pages, and application shell.
//! - Without `render` - Only the DTO and event types are available.

pub mod dto;
pub mod events;

#[cfg(feature = "render")]
pub mod theme;
#[cfg(feature = "render")]
pub mod widgets;
#[cfg(feature = "render")]
pub mod pages;
#[cfg(feature = "render")]
pub mod enrollment;
#[cfg(feature = "render")]
pub mod app;
#[cfg(feature = "render")]
pub mod tray_bridge;

#[cfg(feature = "render")]
pub use app::SentinelApp;

/// Launch the Sentinel Agent GUI window.
///
/// This function blocks the calling thread (it runs the eframe event loop).
/// The agent runtime should be spawned in a background thread before calling this.
#[cfg(feature = "render")]
pub fn run_gui(
    enrolled: bool,
    event_rx: std::sync::mpsc::Receiver<events::AgentEvent>,
    command_tx: std::sync::mpsc::Sender<events::GuiCommand>,
    enrollment_tx: std::sync::mpsc::Sender<enrollment::EnrollmentCommand>,
) -> Result<(), eframe::Error> {
    let sentinel_app = app::SentinelApp::new(enrolled, event_rx, command_tx, enrollment_tx);
    let options = app::SentinelApp::native_options();

    eframe::run_native(
        "Sentinel Agent",
        options,
        Box::new(move |_cc| Ok(Box::new(sentinel_app))),
    )
}
