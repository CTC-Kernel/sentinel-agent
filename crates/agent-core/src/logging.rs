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

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level));
    let (filter_layer, reload_handle) = tracing_subscriber::reload::Layer::new(filter);

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter_layer)
        .init();

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

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level));
    let (filter_layer, reload_handle) = tracing_subscriber::reload::Layer::new(filter);

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(gui_layer)
        .with(filter_layer)
        .init();

    let _ = TRACING_RELOAD_FN.set(Box::new(move |level: &str| {
        let new_filter = EnvFilter::try_new(level)
            .map_err(|e| format!("Invalid tracing level '{}': {}", level, e))?;
        reload_handle
            .reload(new_filter)
            .map_err(|e| format!("{}", e))
    }));

    bridge
}
