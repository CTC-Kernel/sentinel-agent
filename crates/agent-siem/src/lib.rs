//! Agent SIEM - Security Information and Event Management Integration
//!
//! Provides SIEM forwarding capabilities for the Sentinel GRC Agent:
//!
//! ## Supported Formats
//! - **CEF** (Common Event Format) - ArcSight, QRadar
//! - **LEEF** (Log Event Extended Format) - IBM QRadar
//! - **JSON** - Splunk, Elastic, Azure Sentinel
//!
//! ## Supported Transports
//! - **Syslog** - RFC 5424 over UDP/TCP/TLS
//! - **HTTP** - Splunk HEC, Azure Sentinel, Elastic
//!
//! # Example
//!
//! ```ignore
//! use agent_siem::{SiemForwarder, SiemConfig, SiemFormat, SiemTransport};
//!
//! let config = SiemConfig {
//!     enabled: true,
//!     format: SiemFormat::Cef,
//!     transport: SiemTransport::Syslog {
//!         host: "siem.company.com".to_string(),
//!         port: 514,
//!         protocol: SyslogProtocol::Tcp,
//!         tls: true,
//!     },
//!     batch_size: 100,
//!     flush_interval_secs: 30,
//! };
//!
//! let forwarder = SiemForwarder::new(config)?;
//! forwarder.send_event(&event).await?;
//! ```

pub mod error;
pub mod formats;
pub mod transports;

pub use error::{SiemError, SiemResult};
pub use formats::{CefFormatter, JsonFormatter, LeefFormatter, SiemFormatter};
pub use transports::{HttpTransport, SiemTransportTrait, SyslogTransport};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// SIEM event to be forwarded.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiemEvent {
    /// Event timestamp.
    pub timestamp: DateTime<Utc>,
    /// Event severity (0-10, where 10 is most severe).
    pub severity: u8,
    /// Event category.
    pub category: EventCategory,
    /// Event name/type.
    pub name: String,
    /// Detailed description.
    pub description: String,
    /// Source host.
    pub source_host: String,
    /// Source IP (if applicable).
    pub source_ip: Option<String>,
    /// Destination IP (if applicable).
    pub destination_ip: Option<String>,
    /// Destination port (if applicable).
    pub destination_port: Option<u16>,
    /// User involved (if applicable).
    pub user: Option<String>,
    /// Process name (if applicable).
    pub process_name: Option<String>,
    /// Process ID (if applicable).
    pub process_id: Option<u32>,
    /// File path (if applicable).
    pub file_path: Option<String>,
    /// Additional custom fields.
    pub custom_fields: serde_json::Value,
    /// Unique event ID.
    pub event_id: String,
    /// Agent version.
    pub agent_version: String,
}

/// Event category for SIEM classification.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventCategory {
    /// Compliance check result.
    Compliance,
    /// Security alert.
    Security,
    /// Network activity.
    Network,
    /// File integrity monitoring.
    FileIntegrity,
    /// System event.
    System,
    /// Authentication event.
    Authentication,
    /// Configuration change.
    Configuration,
    /// Vulnerability detection.
    Vulnerability,
}

impl std::fmt::Display for EventCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Compliance => write!(f, "Compliance"),
            Self::Security => write!(f, "Security"),
            Self::Network => write!(f, "Network"),
            Self::FileIntegrity => write!(f, "FileIntegrity"),
            Self::System => write!(f, "System"),
            Self::Authentication => write!(f, "Authentication"),
            Self::Configuration => write!(f, "Configuration"),
            Self::Vulnerability => write!(f, "Vulnerability"),
        }
    }
}

/// SIEM output format.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SiemFormat {
    /// Common Event Format (ArcSight).
    Cef,
    /// Log Event Extended Format (IBM QRadar).
    Leef,
    /// Generic JSON (Splunk, ELK, Azure Sentinel).
    Json,
}

/// Syslog protocol.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SyslogProtocol {
    Udp,
    Tcp,
}

/// SIEM transport configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SiemTransport {
    /// Syslog transport (RFC 5424).
    Syslog {
        host: String,
        port: u16,
        protocol: SyslogProtocol,
        tls: bool,
    },
    /// HTTP transport (Splunk HEC, Azure Sentinel).
    Http {
        url: String,
        auth_token: Option<String>,
        auth_header: Option<String>,
        verify_tls: bool,
    },
}

/// SIEM forwarder configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiemConfig {
    /// Whether SIEM forwarding is enabled.
    pub enabled: bool,
    /// Output format.
    pub format: SiemFormat,
    /// Transport configuration.
    pub transport: SiemTransport,
    /// Batch size for bulk uploads.
    pub batch_size: usize,
    /// Flush interval in seconds.
    pub flush_interval_secs: u64,
    /// Minimum severity to forward (0-10).
    pub min_severity: u8,
    /// Event categories to include (empty = all).
    pub include_categories: Vec<EventCategory>,
    /// Custom fields to add to all events.
    pub custom_fields: serde_json::Value,
}

impl Default for SiemConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            format: SiemFormat::Json,
            transport: SiemTransport::Syslog {
                host: "localhost".to_string(),
                port: 514,
                protocol: SyslogProtocol::Tcp,
                tls: false,
            },
            batch_size: 100,
            flush_interval_secs: 30,
            min_severity: 0,
            include_categories: Vec::new(),
            custom_fields: serde_json::Value::Null,
        }
    }
}

/// SIEM forwarder statistics.
#[derive(Debug, Clone, Default)]
pub struct SiemStats {
    /// Total events sent.
    pub events_sent: u64,
    /// Total events dropped.
    pub events_dropped: u64,
    /// Total bytes sent.
    pub bytes_sent: u64,
    /// Last successful send timestamp.
    pub last_success: Option<DateTime<Utc>>,
    /// Last error message.
    pub last_error: Option<String>,
    /// Connection status.
    pub is_connected: bool,
}

/// Main SIEM forwarder.
pub struct SiemForwarder {
    config: SiemConfig,
    formatter: Box<dyn SiemFormatter + Send + Sync>,
    transport: Box<dyn SiemTransportTrait + Send + Sync>,
    buffer: Arc<RwLock<Vec<SiemEvent>>>,
    stats: Arc<RwLock<SiemStats>>,
}

impl SiemForwarder {
    /// Create a new SIEM forwarder.
    pub fn new(config: SiemConfig) -> SiemResult<Self> {
        let formatter: Box<dyn SiemFormatter + Send + Sync> = match config.format {
            SiemFormat::Cef => Box::new(CefFormatter::new()),
            SiemFormat::Leef => Box::new(LeefFormatter::new()),
            SiemFormat::Json => Box::new(JsonFormatter::new()),
        };

        let transport: Box<dyn SiemTransportTrait + Send + Sync> = match &config.transport {
            SiemTransport::Syslog {
                host,
                port,
                protocol,
                tls,
            } => Box::new(SyslogTransport::new(host.clone(), *port, *protocol, *tls)),
            SiemTransport::Http {
                url,
                auth_token,
                auth_header,
                verify_tls,
            } => Box::new(HttpTransport::new(
                url.clone(),
                auth_token.clone(),
                auth_header.clone(),
                *verify_tls,
            )),
        };

        info!(
            "SIEM forwarder initialized: format={:?}, transport={:?}",
            config.format,
            match &config.transport {
                SiemTransport::Syslog { host, port, .. } => format!("syslog://{}:{}", host, port),
                SiemTransport::Http { url, .. } => url.clone(),
            }
        );

        Ok(Self {
            config,
            formatter,
            transport,
            buffer: Arc::new(RwLock::new(Vec::new())),
            stats: Arc::new(RwLock::new(SiemStats::default())),
        })
    }

    /// Send a single event.
    pub async fn send_event(&self, event: &SiemEvent) -> SiemResult<()> {
        if !self.config.enabled {
            debug!("SIEM forwarding disabled, skipping event");
            return Ok(());
        }

        // Check severity filter
        if event.severity < self.config.min_severity {
            debug!(
                "Event severity {} below threshold {}, skipping",
                event.severity, self.config.min_severity
            );
            return Ok(());
        }

        // Check category filter
        if !self.config.include_categories.is_empty()
            && !self.config.include_categories.contains(&event.category)
        {
            debug!(
                "Event category {:?} not in include list, skipping",
                event.category
            );
            return Ok(());
        }

        // Format the event
        let formatted = self.formatter.format(event)?;

        // Send via transport
        match self.transport.send(&formatted).await {
            Ok(bytes_sent) => {
                let mut stats = self.stats.write().await;
                stats.events_sent = stats.events_sent.saturating_add(1);
                stats.bytes_sent = stats.bytes_sent.saturating_add(bytes_sent as u64);
                stats.last_success = Some(Utc::now());
                stats.is_connected = true;
                stats.last_error = None;
                debug!("Event sent successfully: {} bytes", bytes_sent);
                Ok(())
            }
            Err(e) => {
                let mut stats = self.stats.write().await;
                stats.events_dropped = stats.events_dropped.saturating_add(1);
                stats.is_connected = false;
                stats.last_error = Some(e.to_string());
                error!("Failed to send event: {}", e);
                Err(e)
            }
        }
    }

    /// Queue an event for batch sending.
    pub async fn queue_event(&self, event: SiemEvent) {
        if !self.config.enabled {
            return;
        }

        let mut buffer = self.buffer.write().await;
        buffer.push(event);

        if buffer.len() >= self.config.batch_size {
            drop(buffer);
            if let Err(e) = self.flush().await {
                warn!("Failed to flush event buffer: {}", e);
            }
        }
    }

    /// Flush buffered events.
    pub async fn flush(&self) -> SiemResult<()> {
        let events = {
            let mut buffer = self.buffer.write().await;
            std::mem::take(&mut *buffer)
        };

        if events.is_empty() {
            return Ok(());
        }

        debug!("Flushing {} events to SIEM", events.len());

        // Format all events
        let formatted: Vec<String> = events
            .iter()
            .filter_map(|e| self.formatter.format(e).ok())
            .collect();

        // Send batch
        let batch = formatted.join("\n");
        match self.transport.send(&batch).await {
            Ok(bytes_sent) => {
                let mut stats = self.stats.write().await;
                let event_count = u64::try_from(events.len()).unwrap_or(u64::MAX);
                stats.events_sent = stats.events_sent.saturating_add(event_count);
                stats.bytes_sent = stats.bytes_sent.saturating_add(bytes_sent as u64);
                stats.last_success = Some(Utc::now());
                stats.is_connected = true;
                info!(
                    "Flushed {} events ({} bytes) to SIEM",
                    events.len(),
                    bytes_sent
                );
                Ok(())
            }
            Err(e) => {
                let mut stats = self.stats.write().await;
                let event_count = u64::try_from(events.len()).unwrap_or(u64::MAX);
                stats.events_dropped = stats.events_dropped.saturating_add(event_count);
                stats.is_connected = false;
                stats.last_error = Some(e.to_string());
                error!("Failed to flush events: {}", e);
                Err(e)
            }
        }
    }

    /// Get current statistics.
    pub async fn stats(&self) -> SiemStats {
        self.stats.read().await.clone()
    }

    /// Check if the forwarder is enabled.
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Update the SIEM configuration.
    pub fn update_config(&mut self, config: SiemConfig) -> SiemResult<()> {
        // If transport changed, we need to re-initialize it
        // For simplicity, we'll re-initialize everything if config changed
        let formatter: Box<dyn SiemFormatter + Send + Sync> = match config.format {
            SiemFormat::Cef => Box::new(CefFormatter::new()),
            SiemFormat::Leef => Box::new(LeefFormatter::new()),
            SiemFormat::Json => Box::new(JsonFormatter::new()),
        };

        let transport: Box<dyn SiemTransportTrait + Send + Sync> = match &config.transport {
            SiemTransport::Syslog {
                host,
                port,
                protocol,
                tls,
            } => Box::new(SyslogTransport::new(host.clone(), *port, *protocol, *tls)),
            SiemTransport::Http {
                url,
                auth_token,
                auth_header,
                verify_tls,
            } => Box::new(HttpTransport::new(
                url.clone(),
                auth_token.clone(),
                auth_header.clone(),
                *verify_tls,
            )),
        };

        info!(
            "SIEM forwarder configuration updated: format={:?}, transport={:?}",
            config.format,
            match &config.transport {
                SiemTransport::Syslog { host, port, .. } => format!("syslog://{}:{}", host, port),
                SiemTransport::Http { url, .. } => url.clone(),
            }
        );

        self.config = config;
        self.formatter = formatter;
        self.transport = transport; // Replaces the old transport
        // Note: Buffer and stats are preserved

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siem_config_default() {
        let config = SiemConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.format, SiemFormat::Json);
        assert_eq!(config.batch_size, 100);
    }

    #[test]
    fn test_event_category_display() {
        assert_eq!(format!("{}", EventCategory::Compliance), "Compliance");
        assert_eq!(format!("{}", EventCategory::Security), "Security");
        assert_eq!(format!("{}", EventCategory::Network), "Network");
    }

    #[test]
    fn test_siem_event_serialization() {
        let event = SiemEvent {
            timestamp: Utc::now(),
            severity: 7,
            category: EventCategory::Security,
            name: "Malware Detected".to_string(),
            description: "Suspicious process detected".to_string(),
            source_host: "workstation-01".to_string(),
            source_ip: Some("192.168.1.100".to_string()),
            destination_ip: None,
            destination_port: None,
            user: Some("john.doe".to_string()),
            process_name: Some("suspicious.exe".to_string()),
            process_id: Some(1234),
            file_path: Some("C:\\Users\\john\\suspicious.exe".to_string()),
            custom_fields: serde_json::json!({"check_id": "antivirus"}),
            event_id: "evt-123".to_string(),
            agent_version: "2.0.0".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Malware Detected"));
        assert!(json.contains("workstation-01"));
    }
}
