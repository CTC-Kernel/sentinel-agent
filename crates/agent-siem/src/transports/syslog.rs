//! Syslog transport (RFC 5424).
//!
//! Supports UDP, TCP, and TLS connections to syslog servers.

use super::SiemTransportTrait;
use crate::{SiemError, SiemResult, SyslogProtocol};
use async_trait::async_trait;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::RwLock;
use tracing::debug;

/// Syslog transport.
pub struct SyslogTransport {
    host: String,
    port: u16,
    protocol: SyslogProtocol,
    tls: bool,
    tcp_connection: Arc<RwLock<Option<TcpStream>>>,
    udp_socket: Arc<RwLock<Option<UdpSocket>>>,
    facility: u8,
    hostname: String,
    app_name: String,
}

impl SyslogTransport {
    /// Create a new syslog transport.
    pub fn new(host: String, port: u16, protocol: SyslogProtocol, tls: bool) -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        Self {
            host,
            port,
            protocol,
            tls,
            tcp_connection: Arc::new(RwLock::new(None)),
            udp_socket: Arc::new(RwLock::new(None)),
            facility: 16, // local0
            hostname,
            app_name: "sentinel-agent".to_string(),
        }
    }

    /// Set the syslog facility (0-23).
    pub fn with_facility(mut self, facility: u8) -> Self {
        self.facility = facility.min(23);
        self
    }

    /// Set the application name.
    pub fn with_app_name(mut self, app_name: String) -> Self {
        self.app_name = app_name;
        self
    }

    /// Build RFC 5424 syslog message.
    fn build_syslog_message(&self, severity: u8, message: &str) -> String {
        let priority = (self.facility * 8) + severity.min(7);
        let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ");
        let pid = std::process::id();

        // RFC 5424 format:
        // <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
        format!(
            "<{}>1 {} {} {} {} - - {}",
            priority, timestamp, self.hostname, self.app_name, pid, message
        )
    }

    /// Ensure TCP connection is established.
    async fn ensure_tcp_connection(&self) -> SiemResult<()> {
        let mut conn = self.tcp_connection.write().await;

        if conn.is_some() {
            return Ok(());
        }

        let addr = format!("{}:{}", self.host, self.port);
        debug!("Connecting to syslog server: {}", addr);

        if self.tls {
            // TLS syslog requires additional TLS dependencies — reject instead of silently downgrading
            return Err(SiemError::ConfigError(
                "TLS syslog is not yet implemented. Use plain TCP syslog or configure a TLS-terminating proxy.".to_string(),
            ));
        }

        match TcpStream::connect(&addr).await {
            Ok(stream) => {
                *conn = Some(stream);
                debug!("Connected to syslog server");
                Ok(())
            }
            Err(e) => Err(SiemError::ConnectionError(format!(
                "Failed to connect to syslog server {}: {}",
                addr, e
            ))),
        }
    }

    /// Ensure UDP socket is bound.
    async fn ensure_udp_socket(&self) -> SiemResult<()> {
        let mut socket = self.udp_socket.write().await;

        if socket.is_some() {
            return Ok(());
        }

        match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => {
                *socket = Some(s);
                debug!("UDP socket bound for syslog");
                Ok(())
            }
            Err(e) => Err(SiemError::ConnectionError(format!(
                "Failed to bind UDP socket: {}",
                e
            ))),
        }
    }

    /// Send via TCP.
    async fn send_tcp(&self, message: &str) -> SiemResult<usize> {
        self.ensure_tcp_connection().await?;

        let mut conn = self.tcp_connection.write().await;
        let stream = conn.as_mut().ok_or_else(|| {
            SiemError::ConnectionError("TCP connection not established".to_string())
        })?;

        // Add newline for TCP syslog (octet-counting or newline framing)
        let data = format!("{}\n", message);
        let bytes = data.as_bytes();

        match stream.write_all(bytes).await {
            Ok(()) => Ok(bytes.len()),
            Err(e) => {
                // Clear connection so it reconnects next time
                *conn = None;
                Err(SiemError::SendError(format!("Failed to send: {}", e)))
            }
        }
    }

    /// Send via UDP.
    async fn send_udp(&self, message: &str) -> SiemResult<usize> {
        self.ensure_udp_socket().await?;

        let socket = self.udp_socket.read().await;
        let socket = socket.as_ref().ok_or_else(|| {
            SiemError::ConnectionError("UDP socket not bound".to_string())
        })?;

        let addr = format!("{}:{}", self.host, self.port);
        let bytes = message.as_bytes();

        match socket.send_to(bytes, &addr).await {
            Ok(sent) => Ok(sent),
            Err(e) => Err(SiemError::SendError(format!(
                "Failed to send UDP: {}",
                e
            ))),
        }
    }
}

#[async_trait]
impl SiemTransportTrait for SyslogTransport {
    async fn send(&self, data: &str) -> SiemResult<usize> {
        // Build syslog message (severity 6 = informational)
        let message = self.build_syslog_message(6, data);

        match self.protocol {
            SyslogProtocol::Tcp => self.send_tcp(&message).await,
            SyslogProtocol::Udp => self.send_udp(&message).await,
        }
    }

    async fn is_connected(&self) -> bool {
        match self.protocol {
            SyslogProtocol::Tcp => self.tcp_connection.read().await.is_some(),
            SyslogProtocol::Udp => true, // UDP is connectionless
        }
    }

    fn name(&self) -> &'static str {
        "Syslog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_syslog_message_format() {
        let transport = SyslogTransport::new(
            "localhost".to_string(),
            514,
            SyslogProtocol::Tcp,
            false,
        );

        let message = transport.build_syslog_message(6, "Test message");

        // Should start with priority in angle brackets
        assert!(message.starts_with('<'));
        assert!(message.contains("Test message"));
        assert!(message.contains("sentinel-agent"));
    }

    #[test]
    fn test_syslog_priority_calculation() {
        // Priority = Facility * 8 + Severity
        // local0 (16) * 8 + informational (6) = 134
        let transport = SyslogTransport::new(
            "localhost".to_string(),
            514,
            SyslogProtocol::Tcp,
            false,
        );

        let message = transport.build_syslog_message(6, "Test");
        assert!(message.starts_with("<134>"));
    }

    #[test]
    fn test_facility_setting() {
        let transport = SyslogTransport::new(
            "localhost".to_string(),
            514,
            SyslogProtocol::Tcp,
            false,
        )
        .with_facility(1); // user-level

        let message = transport.build_syslog_message(6, "Test");
        // user (1) * 8 + info (6) = 14
        assert!(message.starts_with("<14>"));
    }
}
