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
