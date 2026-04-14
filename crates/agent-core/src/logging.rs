// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Logging initialization and runtime level management.

/// Type-erased reload callback for the tracing filter.
///
/// We store a boxed closure instead of the concrete `reload::Handle` because the
/// handle's type parameter includes all subscriber layers, which differs between
/// `init_logging` and `init_logging_with_terminal`.
type TracingReloadFn = Box<dyn Fn(&str) -> Result<(), String> + Send + Sync>;
static TRACING_RELOAD_FN: std::sync::OnceLock<TracingReloadFn> = std::sync::OnceLock::new();

/// Dynamically change the tracing log level at runtime.
///
/// Accepts standard level strings: "error", "warn", "info", "debug", "trace".
/// Falls back silently if the tracing subscriber was not initialized with a
/// reload handle (e.g. non-GUI mode).
pub fn set_tracing_level(level: &str) {
    if let Some(reload_fn) = TRACING_RELOAD_FN.get()
        && let Err(e) = reload_fn(level)
    {
        tracing::warn!("Failed to reload tracing filter: {}", e);
    }
}

pub fn init_logging(log_level: &str) {
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};

    // Build filter: use RUST_LOG env if set, otherwise use the configured level.
    // Always suppress noisy arboard clipboard errors (benign on headless/service sessions).
    let filter_str = std::env::var("RUST_LOG").unwrap_or_else(|_| log_level.to_string());
    let filter_str = format!("{},arboard=off,eframe=warn", filter_str);
    let filter = EnvFilter::try_new(&filter_str).unwrap_or_else(|_| EnvFilter::new(log_level));
    let (filter_layer, reload_handle) = tracing_subscriber::reload::Layer::new(filter);

    // Initial log directory and file appender
    let log_dir = get_log_dir();
    let file_appender = tracing_appender::rolling::daily(&log_dir, "agent.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    // Leak the guard to keep it alive for the duration of the program
    std::mem::forget(_guard);

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .with(filter_layer)
        .try_init()
        .ok();

    let _ = TRACING_RELOAD_FN.set(Box::new(move |level: &str| {
        let new_filter = EnvFilter::try_new(level)
            .map_err(|e| format!("Invalid tracing level '{}': {}", level, e))?;
        reload_handle
            .reload(new_filter)
            .map_err(|e| format!("{}", e))
    }));
}

/// Initialize logging with the GUI terminal bridge.
///
/// Returns the [`GuiTracingBridge`] so the caller can later set the GUI
/// event sender via [`GuiTracingBridge::set_sender`].
#[cfg(feature = "gui")]
pub fn init_logging_with_terminal(log_level: &str) -> crate::tracing_layer::GuiTracingBridge {
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};

    let bridge = crate::tracing_layer::GuiTracingBridge::new();
    let gui_layer = crate::tracing_layer::GuiTracingLayer::new(&bridge);

    // Build filter: suppress noisy arboard clipboard errors (benign on headless/service sessions)
    let filter_str = std::env::var("RUST_LOG").unwrap_or_else(|_| log_level.to_string());
    let filter_str = format!("{},arboard=off,eframe=warn", filter_str);
    let filter = EnvFilter::try_new(&filter_str).unwrap_or_else(|_| EnvFilter::new(log_level));
    let (filter_layer, reload_handle) = tracing_subscriber::reload::Layer::new(filter);

    // Initial log directory and file appender
    let log_dir = get_log_dir();
    let file_appender = tracing_appender::rolling::daily(&log_dir, "agent.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    // Leak the guard to keep it alive for the duration of the program
    std::mem::forget(_guard);

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .with(gui_layer)
        .with(filter_layer)
        .try_init()
        .ok();

    let _ = TRACING_RELOAD_FN.set(Box::new(move |level: &str| {
        let new_filter = EnvFilter::try_new(level)
            .map_err(|e| format!("Invalid tracing level '{}': {}", level, e))?;
        reload_handle
            .reload(new_filter)
            .map_err(|e| format!("{}", e))
    }));

    bridge
}

fn get_log_dir() -> std::path::PathBuf {
    #[cfg(windows)]
    let primary = std::path::PathBuf::from(r"C:\ProgramData\Sentinel\logs");
    #[cfg(not(windows))]
    let primary = std::path::PathBuf::from("/var/log/sentinel");

    // Try to create and use the system-wide log directory.
    // If that fails (e.g. running as non-root), fall back to a user-local directory.
    if std::fs::create_dir_all(&primary).is_ok() && is_writable(&primary) {
        return primary;
    }

    // Fallback: ~/Library/Logs/Sentinel (macOS) or ~/.local/share/sentinel/logs (Linux)
    if let Some(dirs) = directories::ProjectDirs::from("com", "sentinel-grc", "Sentinel") {
        let fallback = dirs.data_local_dir().join("logs");
        if std::fs::create_dir_all(&fallback).is_ok() {
            return fallback;
        }
    }

    // Last resort: temp directory
    std::env::temp_dir().join("sentinel-logs")
}

/// Check if a directory is writable by attempting to create a temporary file.
fn is_writable(dir: &std::path::Path) -> bool {
    let probe = dir.join(".sentinel_write_probe");
    if std::fs::write(&probe, b"").is_ok() {
        let _ = std::fs::remove_file(&probe);
        true
    } else {
        false
    }
}
