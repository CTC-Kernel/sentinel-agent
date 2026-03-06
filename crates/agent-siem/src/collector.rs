// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! System log collector for SIEM integration.
//!
//! Collects system logs from platform-specific sources and converts them
//! to [`SiemEvent`] for forwarding to external SIEM platforms.
//!
//! ## Supported Sources
//! - **macOS**: Unified log (`log stream`), `/var/log/system.log`
//! - **Linux**: journald (`journalctl`), `/var/log/syslog`, `/var/log/auth.log`
//! - **Windows**: Windows Event Log via `wevtutil`

use crate::{EventCategory, SiemEvent};
use agent_common::constants::AGENT_VERSION;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use tokio::sync::RwLock;
use tracing::{debug, warn};

/// Maximum number of raw log entries to buffer before processing.
const MAX_LOG_BUFFER: usize = 5000;

/// Log source type.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LogSource {
    /// System/kernel logs.
    System,
    /// Authentication/security logs.
    Auth,
    /// Application logs.
    Application,
    /// Firewall logs.
    Firewall,
}

impl std::fmt::Display for LogSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::System => write!(f, "system"),
            Self::Auth => write!(f, "auth"),
            Self::Application => write!(f, "application"),
            Self::Firewall => write!(f, "firewall"),
        }
    }
}

/// A raw log entry before normalization.
#[derive(Debug, Clone)]
pub struct RawLogEntry {
    /// Raw log line.
    pub message: String,
    /// Source of the log.
    pub source: LogSource,
    /// Timestamp (if parsed from the log).
    pub timestamp: Option<DateTime<Utc>>,
    /// Hostname from which the log originated.
    pub hostname: Option<String>,
    /// Process name (if extracted).
    pub process: Option<String>,
    /// Process ID (if extracted).
    pub pid: Option<u32>,
}

/// Configuration for the log collector.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogCollectorConfig {
    /// Whether log collection is enabled.
    pub enabled: bool,
    /// Which log sources to collect.
    pub sources: Vec<LogSource>,
    /// How far back to look on first collection (seconds).
    pub lookback_secs: u64,
    /// Collection interval in seconds.
    pub poll_interval_secs: u64,
    /// Minimum severity keywords to include.
    pub severity_filter: Vec<String>,
}

impl Default for LogCollectorConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            sources: vec![LogSource::System, LogSource::Auth],
            lookback_secs: 300,
            poll_interval_secs: 60,
            severity_filter: vec![
                "error".to_string(),
                "warning".to_string(),
                "critical".to_string(),
                "alert".to_string(),
                "fail".to_string(),
                "denied".to_string(),
            ],
        }
    }
}

/// System log collector.
pub struct LogCollector {
    config: LogCollectorConfig,
    buffer: RwLock<VecDeque<RawLogEntry>>,
    last_collection: RwLock<Option<DateTime<Utc>>>,
    hostname: String,
}

impl LogCollector {
    /// Create a new log collector.
    pub fn new(config: LogCollectorConfig) -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        Self {
            config,
            buffer: RwLock::new(VecDeque::new()),
            last_collection: RwLock::new(None),
            hostname,
        }
    }

    /// Collect logs from all configured sources.
    pub async fn collect(&self) -> Vec<SiemEvent> {
        if !self.config.enabled {
            return Vec::new();
        }

        let since = {
            let last = self.last_collection.read().await;
            last.unwrap_or_else(|| {
                Utc::now() - chrono::Duration::seconds(self.config.lookback_secs as i64)
            })
        };

        let mut raw_entries = Vec::new();

        for source in &self.config.sources {
            match self.collect_source(*source, &since).await {
                Ok(entries) => {
                    debug!(
                        "Collected {} entries from {} logs",
                        entries.len(),
                        source
                    );
                    raw_entries.extend(entries);
                }
                Err(e) => {
                    warn!("Failed to collect {} logs: {}", source, e);
                }
            }
        }

        // Update last collection timestamp
        {
            let mut last = self.last_collection.write().await;
            *last = Some(Utc::now());
        }

        // Buffer management
        {
            let mut buffer = self.buffer.write().await;
            for entry in &raw_entries {
                if buffer.len() >= MAX_LOG_BUFFER {
                    buffer.pop_front();
                }
                buffer.push_back(entry.clone());
            }
        }

        // Convert to SIEM events
        raw_entries
            .into_iter()
            .filter(|e| self.matches_severity_filter(e))
            .map(|e| self.to_siem_event(e))
            .collect()
    }

    /// Check if a log entry matches the severity filter.
    fn matches_severity_filter(&self, entry: &RawLogEntry) -> bool {
        if self.config.severity_filter.is_empty() {
            return true;
        }
        let msg_lower = entry.message.to_lowercase();
        self.config
            .severity_filter
            .iter()
            .any(|keyword| msg_lower.contains(keyword))
    }

    /// Convert a raw log entry to a SIEM event.
    fn to_siem_event(&self, entry: RawLogEntry) -> SiemEvent {
        let category = match entry.source {
            LogSource::Auth => EventCategory::Authentication,
            LogSource::Firewall => EventCategory::Network,
            LogSource::System => EventCategory::System,
            LogSource::Application => EventCategory::System,
        };

        let severity = classify_severity(&entry.message);

        SiemEvent {
            timestamp: entry.timestamp.unwrap_or_else(Utc::now),
            severity,
            category,
            name: format!("{}_log_event", entry.source),
            description: entry.message.clone(),
            source_host: entry
                .hostname
                .unwrap_or_else(|| self.hostname.clone()),
            source_ip: None,
            destination_ip: None,
            destination_port: None,
            user: extract_user(&entry.message),
            process_name: entry.process,
            process_id: entry.pid,
            file_path: None,
            custom_fields: serde_json::json!({
                "log_source": entry.source.to_string(),
                "raw_message": entry.message,
            }),
            event_id: uuid::Uuid::new_v4().to_string(),
            agent_version: AGENT_VERSION.to_string(),
        }
    }

    /// Collect logs from a specific source.
    async fn collect_source(
        &self,
        source: LogSource,
        since: &DateTime<Utc>,
    ) -> Result<Vec<RawLogEntry>, String> {
        #[cfg(target_os = "macos")]
        {
            self.collect_macos(source, since).await
        }
        #[cfg(target_os = "linux")]
        {
            self.collect_linux(source, since).await
        }
        #[cfg(target_os = "windows")]
        {
            self.collect_windows(source, since).await
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            let _ = (source, since);
            Ok(Vec::new())
        }
    }

    /// Collect logs on macOS via `log show`.
    #[cfg(target_os = "macos")]
    async fn collect_macos(
        &self,
        source: LogSource,
        since: &DateTime<Utc>,
    ) -> Result<Vec<RawLogEntry>, String> {
        let since_str = since.format("%Y-%m-%d %H:%M:%S%z").to_string();

        let predicate = match source {
            LogSource::System => "subsystem == \"com.apple.system\"",
            LogSource::Auth => "category == \"auth\" OR subsystem == \"com.apple.Authorization\"",
            LogSource::Firewall => "subsystem == \"com.apple.alf\"",
            LogSource::Application => "subsystem != \"com.apple.system\"",
        };

        let output = agent_common::process::silent_async_command("log")
            .args([
                "show",
                "--style",
                "compact",
                "--start",
                &since_str,
                "--predicate",
                predicate,
                "--last",
                &format!("{}s", self.config.lookback_secs),
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to run `log show`: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "log show failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(parse_macos_log(&stdout, source))
    }

    /// Collect logs on Linux via journalctl or log files.
    #[cfg(target_os = "linux")]
    async fn collect_linux(
        &self,
        source: LogSource,
        since: &DateTime<Utc>,
    ) -> Result<Vec<RawLogEntry>, String> {
        let since_str = since.format("%Y-%m-%d %H:%M:%S").to_string();

        // Try journalctl first
        let unit = match source {
            LogSource::System => Some("--priority=0..4"), // emerg..warning
            LogSource::Auth => None,                      // use log file
            LogSource::Firewall => None,                  // use log file
            LogSource::Application => None,
        };

        if let Some(priority) = unit {
            let output = agent_common::process::silent_async_command("journalctl")
                .args([
                    "--since",
                    &since_str,
                    "--no-pager",
                    "--output=short-iso",
                    priority,
                ])
                .output()
                .await
                .map_err(|e| format!("Failed to run journalctl: {}", e))?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                return Ok(parse_syslog_lines(&stdout, source));
            }
        }

        // Fallback to reading log files
        let log_path = match source {
            LogSource::System => "/var/log/syslog",
            LogSource::Auth => "/var/log/auth.log",
            LogSource::Firewall => "/var/log/kern.log",
            LogSource::Application => "/var/log/messages",
        };

        match tokio::fs::read_to_string(log_path).await {
            Ok(content) => {
                let lines = tail_lines(&content, 500);
                Ok(parse_syslog_lines(&lines, source))
            }
            Err(e) => Err(format!("Cannot read {}: {}", log_path, e)),
        }
    }

    /// Collect logs on Windows via wevtutil.
    #[cfg(target_os = "windows")]
    async fn collect_windows(
        &self,
        source: LogSource,
        since: &DateTime<Utc>,
    ) -> Result<Vec<RawLogEntry>, String> {
        let channel = match source {
            LogSource::System => "System",
            LogSource::Auth => "Security",
            LogSource::Firewall => "Microsoft-Windows-Windows Firewall With Advanced Security/Firewall",
            LogSource::Application => "Application",
        };

        // Build XPath query for events since the given time
        let ms_since = (Utc::now() - *since).num_milliseconds().max(1) as u64;
        let query = format!(
            "*[System[TimeCreated[timediff(@SystemTime) <= {}]]]",
            ms_since
        );

        let output = agent_common::process::silent_async_command("wevtutil")
            .args(["qe", channel, "/q", &query, "/f:text", "/c:200"])
            .output()
            .await
            .map_err(|e| format!("Failed to run wevtutil: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "wevtutil failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(parse_windows_events(&stdout, source))
    }

    /// Get buffered raw log entries count.
    pub async fn buffer_size(&self) -> usize {
        self.buffer.read().await.len()
    }

    /// Check if collection is enabled.
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }
}

/// Classify severity from log message keywords.
fn classify_severity(message: &str) -> u8 {
    let lower = message.to_lowercase();
    if lower.contains("critical")
        || lower.contains("emergency")
        || lower.contains("panic")
    {
        9
    } else if lower.contains("error") || lower.contains("fail") {
        7
    } else if lower.contains("warning") || lower.contains("warn") {
        5
    } else if lower.contains("denied") || lower.contains("unauthorized") {
        6
    } else if lower.contains("notice") {
        3
    } else {
        2
    }
}

/// Extract a username from common log patterns.
fn extract_user(message: &str) -> Option<String> {
    // "user=XXX" pattern
    if let Some(idx) = message.find("user=") {
        let rest = &message[idx + 5..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == ',' || c == ';')
            .unwrap_or(rest.len());
        let user = &rest[..end];
        if !user.is_empty() {
            return Some(user.to_string());
        }
    }
    // "for user XXX" pattern
    if let Some(idx) = message.find("for user ") {
        let rest = &message[idx + 9..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == ',' || c == ';')
            .unwrap_or(rest.len());
        let user = &rest[..end];
        if !user.is_empty() {
            return Some(user.to_string());
        }
    }
    None
}

/// Parse macOS unified log output lines.
#[cfg(target_os = "macos")]
fn parse_macos_log(output: &str, source: LogSource) -> Vec<RawLogEntry> {
    output
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with("Timestamp"))
        .map(|line| RawLogEntry {
            message: line.to_string(),
            source,
            timestamp: None, // Could parse from line prefix
            hostname: None,
            process: None,
            pid: None,
        })
        .collect()
}

/// Parse syslog-format lines (Linux/generic).
#[cfg(target_os = "linux")]
fn parse_syslog_lines(output: &str, source: LogSource) -> Vec<RawLogEntry> {
    output
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with("--"))
        .map(|line| {
            // Typical syslog: "Mon DD HH:MM:SS hostname process[pid]: message"
            let parts: Vec<&str> = line.splitn(5, ' ').collect();
            let (hostname, process, pid) = if parts.len() >= 5 {
                let host = Some(parts[3].to_string());
                // Parse "process[pid]:" from parts[4]
                let proc_str = parts[4];
                let (proc_name, proc_pid) = if let Some(bracket) = proc_str.find('[') {
                    let name = &proc_str[..bracket];
                    let pid_str = &proc_str[bracket + 1..];
                    let pid = pid_str
                        .find(']')
                        .and_then(|end| pid_str[..end].parse::<u32>().ok());
                    (Some(name.to_string()), pid)
                } else {
                    (None, None)
                };
                (host, proc_name, proc_pid)
            } else {
                (None, None, None)
            };

            RawLogEntry {
                message: line.to_string(),
                source,
                timestamp: None,
                hostname,
                process,
                pid,
            }
        })
        .collect()
}

/// Parse Windows Event Log text output.
#[cfg(target_os = "windows")]
fn parse_windows_events(output: &str, source: LogSource) -> Vec<RawLogEntry> {
    // wevtutil text format separates events by blank lines
    let mut entries = Vec::new();
    let mut current_message = String::new();

    for line in output.lines() {
        if line.trim().is_empty() && !current_message.is_empty() {
            entries.push(RawLogEntry {
                message: current_message.trim().to_string(),
                source,
                timestamp: None,
                hostname: None,
                process: None,
                pid: None,
            });
            current_message.clear();
        } else {
            if !current_message.is_empty() {
                current_message.push(' ');
            }
            current_message.push_str(line.trim());
        }
    }
    if !current_message.is_empty() {
        entries.push(RawLogEntry {
            message: current_message.trim().to_string(),
            source,
            timestamp: None,
            hostname: None,
            process: None,
            pid: None,
        });
    }

    entries
}

/// Return the last N lines of a string.
#[cfg(target_os = "linux")]
fn tail_lines(content: &str, n: usize) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_collector_config_default() {
        let config = LogCollectorConfig::default();
        assert!(!config.enabled);
        assert!(config.sources.contains(&LogSource::System));
        assert!(config.sources.contains(&LogSource::Auth));
        assert_eq!(config.poll_interval_secs, 60);
    }

    #[test]
    fn test_classify_severity() {
        assert_eq!(classify_severity("CRITICAL error in module"), 9);
        assert_eq!(classify_severity("error: connection refused"), 7);
        assert_eq!(classify_severity("WARNING: disk space low"), 5);
        assert_eq!(classify_severity("connection denied for user"), 6);
        assert_eq!(classify_severity("info: all systems nominal"), 2);
    }

    #[test]
    fn test_extract_user() {
        assert_eq!(
            extract_user("login failed for user=admin from 10.0.0.1"),
            Some("admin".to_string())
        );
        assert_eq!(
            extract_user("authentication for user john from 192.168.1.1"),
            Some("john".to_string())
        );
        assert_eq!(
            extract_user("no user info here"),
            None
        );
    }

    #[test]
    fn test_log_source_display() {
        assert_eq!(LogSource::System.to_string(), "system");
        assert_eq!(LogSource::Auth.to_string(), "auth");
        assert_eq!(LogSource::Firewall.to_string(), "firewall");
    }

    #[test]
    fn test_severity_filter() {
        let config = LogCollectorConfig::default();
        let collector = LogCollector::new(config);

        let matching = RawLogEntry {
            message: "error: disk failure detected".to_string(),
            source: LogSource::System,
            timestamp: None,
            hostname: None,
            process: None,
            pid: None,
        };
        assert!(collector.matches_severity_filter(&matching));

        let not_matching = RawLogEntry {
            message: "info: routine check complete".to_string(),
            source: LogSource::System,
            timestamp: None,
            hostname: None,
            process: None,
            pid: None,
        };
        assert!(!collector.matches_severity_filter(&not_matching));
    }
}
