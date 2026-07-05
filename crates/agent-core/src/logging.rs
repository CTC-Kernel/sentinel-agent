// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Logging initialization and runtime level management.
//!
//! All log sinks (console, rolling file, GUI terminal) are wrapped so that
//! secrets — enrollment tokens, API keys, connection strings, private keys —
//! are redacted before they ever reach disk or screen (see
//! [`agent_common::sensitive_filter`]).

use std::io::Write;

/// An [`std::io::Write`] wrapper that redacts sensitive data line by line.
///
/// Bytes are buffered until a newline, then each complete line is passed
/// through [`agent_common::filter_sensitive_data`] before being written to
/// the inner sink. Incomplete trailing data is filtered and flushed on
/// [`flush`](Write::flush) or drop, so nothing is lost on shutdown.
struct RedactingWriter<W: Write> {
    inner: W,
    buf: Vec<u8>,
}

impl<W: Write> RedactingWriter<W> {
    fn new(inner: W) -> Self {
        Self {
            inner,
            buf: Vec::new(),
        }
    }

    fn write_filtered(&mut self, bytes: &[u8]) -> std::io::Result<()> {
        match std::str::from_utf8(bytes) {
            Ok(s) => {
                let filtered = agent_common::filter_sensitive_data(s);
                self.inner.write_all(filtered.as_bytes())
            }
            // Non-UTF-8 output cannot be pattern-matched; pass through rather
            // than corrupt or drop it.
            Err(_) => self.inner.write_all(bytes),
        }
    }
}

impl<W: Write> Write for RedactingWriter<W> {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        self.buf.extend_from_slice(data);
        while let Some(pos) = self.buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = self.buf.drain(..=pos).collect();
            self.write_filtered(&line)?;
        }
        Ok(data.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        if !self.buf.is_empty() {
            let rest = std::mem::take(&mut self.buf);
            self.write_filtered(&rest)?;
        }
        self.inner.flush()
    }
}

impl<W: Write> Drop for RedactingWriter<W> {
    fn drop(&mut self) {
        let _ = self.flush();
    }
}

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
        .with(fmt::layer().with_writer(|| RedactingWriter::new(std::io::stdout())))
        .with(
            fmt::layer()
                .with_writer(move || RedactingWriter::new(non_blocking.clone()))
                .with_ansi(false),
        )
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
        .with(fmt::layer().with_writer(|| RedactingWriter::new(std::io::stdout())))
        .with(
            fmt::layer()
                .with_writer(move || RedactingWriter::new(non_blocking.clone()))
                .with_ansi(false),
        )
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
        restrict_dir_permissions(&primary);
        return primary;
    }

    // Fallback: ~/Library/Logs/Sentinel (macOS) or ~/.local/share/sentinel/logs (Linux)
    if let Some(dirs) = directories::ProjectDirs::from("com", "sentinel-grc", "Sentinel") {
        let fallback = dirs.data_local_dir().join("logs");
        if std::fs::create_dir_all(&fallback).is_ok() {
            restrict_dir_permissions(&fallback);
            return fallback;
        }
    }

    // Last resort: temp directory
    std::env::temp_dir().join("sentinel-logs")
}

/// Restrict the log directory to the owning user (0700), matching the
/// posture of the key store and database directories. Agent logs describe
/// scan findings and system configuration and must not be world-readable.
fn restrict_dir_permissions(dir: &std::path::Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700)) {
            eprintln!("Warning: failed to restrict log dir permissions: {}", e);
        }
    }
    #[cfg(not(unix))]
    {
        // On Windows, C:\ProgramData ACLs already restrict write access to
        // administrators; inherited ACLs are acceptable for log files.
        let _ = dir;
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn redact(chunks: &[&[u8]]) -> String {
        let mut out = Vec::new();
        {
            let mut w = RedactingWriter::new(&mut out);
            for chunk in chunks {
                w.write_all(chunk).unwrap();
            }
            w.flush().unwrap();
        }
        String::from_utf8(out).unwrap()
    }

    #[test]
    fn redacts_secrets_in_log_lines() {
        let line = b"INFO agent: enrolling with api_key=Sup3rS3cretT0ken now\n";
        let out = redact(&[line]);
        assert!(out.contains("***REDACTED***"), "got: {out}");
        assert!(!out.contains("Sup3rS3cretT0ken"), "got: {out}");
    }

    #[test]
    fn passes_clean_lines_through_unchanged() {
        let line = "INFO agent: heartbeat sent (latency 12ms)\n";
        assert_eq!(redact(&[line.as_bytes()]), line);
    }

    #[test]
    fn handles_lines_split_across_writes() {
        let out = redact(&[b"WARN sync: authorization: ", b"abcdef123456 rejected\n"]);
        assert!(out.contains("***REDACTED***"), "got: {out}");
        assert!(!out.contains("abcdef123456"), "got: {out}");
    }

    #[test]
    fn flushes_trailing_data_without_newline() {
        let out = redact(&[b"partial line without newline"]);
        assert_eq!(out, "partial line without newline");
    }

    #[test]
    fn passes_non_utf8_bytes_through() {
        let bytes: &[u8] = &[0xff, 0xfe, b'\n'];
        let mut out = Vec::new();
        {
            let mut w = RedactingWriter::new(&mut out);
            w.write_all(bytes).unwrap();
            w.flush().unwrap();
        }
        assert_eq!(out, bytes);
    }
}
