// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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
use tokio_rustls::client::TlsStream;
use tracing::debug;

/// Syslog transport.
pub struct SyslogTransport {
    host: String,
    port: u16,
    protocol: SyslogProtocol,
    tls: bool,
    tcp_connection: Arc<RwLock<Option<TcpStream>>>,
    tls_connection: Arc<RwLock<Option<TlsStream<TcpStream>>>>,
    udp_socket: Arc<RwLock<Option<UdpSocket>>>,
    client_cert: Option<String>,
    client_key: Option<String>,
    facility: u8,
    hostname: String,
    app_name: String,
}

impl SyslogTransport {
    /// Create a new syslog transport.
    ///
    /// When `tls` is `true`, the transport connects via TCP and wraps the
    /// connection in a TLS layer using the platform's trusted certificate
    /// store (via `rustls-platform-verifier`).
    pub fn new(
        host: String,
        port: u16,
        protocol: SyslogProtocol,
        tls: bool,
        client_cert: Option<String>,
        client_key: Option<String>,
    ) -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        Self {
            host,
            port,
            protocol,
            tls,
            client_cert,
            client_key,
            tcp_connection: Arc::new(RwLock::new(None)),
            tls_connection: Arc::new(RwLock::new(None)),
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

    /// Frame `data` as one syslog message of the given RFC 5424 severity
    /// and send it over the configured protocol.
    async fn send_message(&self, severity: u8, data: &str) -> SiemResult<usize> {
        let message = self.build_syslog_message(severity, data);

        if self.tls {
            return self.send_tls(&message).await;
        }

        match self.protocol {
            SyslogProtocol::Tcp => self.send_tcp(&message).await,
            SyslogProtocol::Udp => self.send_udp(&message).await,
        }
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
        debug!("Connecting to syslog server via TCP: {}", addr);

        match TcpStream::connect(&addr).await {
            Ok(stream) => {
                *conn = Some(stream);
                debug!("Connected to syslog server (TCP)");
                Ok(())
            }
            Err(e) => Err(SiemError::ConnectionError(format!(
                "Failed to connect to syslog server {}: {}",
                addr, e
            ))),
        }
    }

    /// Ensure TLS connection is established over TCP.
    async fn ensure_tls_connection(&self) -> SiemResult<()> {
        let mut conn = self.tls_connection.write().await;

        if conn.is_some() {
            return Ok(());
        }

        let addr = format!("{}:{}", self.host, self.port);
        debug!("Connecting to syslog server via TLS: {}", addr);

        // Connect TCP first
        let tcp_stream = TcpStream::connect(&addr).await.map_err(|e| {
            SiemError::ConnectionError(format!(
                "Failed to connect to syslog server {}: {}",
                addr, e
            ))
        })?;

        // Build TLS config using platform certificate verifier and enforcing modern TLS
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let verifier = rustls_platform_verifier::Verifier::new(Arc::clone(&provider))
            .map_err(|e| SiemError::ConfigError(format!("Failed to create TLS verifier: {}", e)))?;
        let verifier = Arc::new(verifier);

        let mut tls_config = rustls::ClientConfig::builder_with_provider(provider.clone())
            .with_protocol_versions(&[&rustls::version::TLS13, &rustls::version::TLS12])
            .map_err(|e| SiemError::ConfigError(format!("TLS protocol config error: {}", e)))?
            .dangerous()
            .with_custom_certificate_verifier(verifier.clone())
            .with_no_client_auth();

        // Handle mTLS if certificates are provided
        if let (Some(cert_pem), Some(key_pem)) = (&self.client_cert, &self.client_key) {
            // Parse PEM
            let mut cert_reader = std::io::BufReader::new(cert_pem.as_bytes());
            let cert_chain = rustls_pemfile::certs(&mut cert_reader)
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| {
                    SiemError::ConfigError(format!("Failed to parse client cert: {}", e))
                })?;

            let mut key_reader = std::io::BufReader::new(key_pem.as_bytes());
            let key = rustls_pemfile::private_key(&mut key_reader)
                .map_err(|e| SiemError::ConfigError(format!("Failed to parse client key: {}", e)))?
                .ok_or_else(|| {
                    SiemError::ConfigError("No private key found in client_key".into())
                })?;

            tls_config = rustls::ClientConfig::builder_with_provider(Arc::clone(&provider))
                .with_protocol_versions(&[&rustls::version::TLS13, &rustls::version::TLS12])
                .map_err(|e| SiemError::ConfigError(format!("TLS protocol config error: {}", e)))?
                .dangerous()
                .with_custom_certificate_verifier(verifier)
                .with_client_auth_cert(cert_chain, key)
                .map_err(|e| SiemError::ConfigError(format!("Failed to set mTLS cert: {}", e)))?;

            debug!("mTLS enabled for Syslog transport");
        }

        let connector = tokio_rustls::TlsConnector::from(Arc::new(tls_config));

        let server_name =
            rustls::pki_types::ServerName::try_from(self.host.clone()).map_err(|e| {
                SiemError::ConfigError(format!("Invalid TLS server name '{}': {}", self.host, e))
            })?;

        let tls_stream = connector
            .connect(server_name, tcp_stream)
            .await
            .map_err(|e| {
                SiemError::ConnectionError(format!(
                    "TLS handshake failed with syslog server {}: {}",
                    addr, e
                ))
            })?;

        debug!("Connected to syslog server (TLS)");
        *conn = Some(tls_stream);
        Ok(())
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

    /// Send via TLS over TCP.
    async fn send_tls(&self, message: &str) -> SiemResult<usize> {
        self.ensure_tls_connection().await?;

        let mut conn = self.tls_connection.write().await;
        let stream = conn.as_mut().ok_or_else(|| {
            SiemError::ConnectionError("TLS connection not established".to_string())
        })?;

        let data = format!("{}\n", message);
        let bytes = data.as_bytes();

        match stream.write_all(bytes).await {
            Ok(()) => Ok(bytes.len()),
            Err(e) => {
                // Clear connection so it reconnects next time
                *conn = None;
                Err(SiemError::SendError(format!(
                    "Failed to send via TLS: {}",
                    e
                )))
            }
        }
    }

    /// Send via UDP.
    async fn send_udp(&self, message: &str) -> SiemResult<usize> {
        self.ensure_udp_socket().await?;

        let socket = self.udp_socket.read().await;
        let socket = socket
            .as_ref()
            .ok_or_else(|| SiemError::ConnectionError("UDP socket not bound".to_string()))?;

        let addr = format!("{}:{}", self.host, self.port);
        let bytes = message.as_bytes();

        match socket.send_to(bytes, &addr).await {
            Ok(sent) => Ok(sent),
            Err(e) => Err(SiemError::SendError(format!("Failed to send UDP: {}", e))),
        }
    }
}

/// RFC 5424 severity of data that carries none: informational.
const SYSLOG_INFORMATIONAL: u8 = 6;

/// RFC 5424 severity (0 emergency to 7 debug, lower is worse) of an event
/// severity (0 to 10, higher is worse). Every message used to leave as
/// informational, so a receiver filtering or alerting on the syslog
/// priority never saw a critical event as one.
fn syslog_severity(event_severity: u8) -> u8 {
    match event_severity {
        9.. => 2,   // critical
        7..=8 => 3, // error
        5..=6 => 4, // warning
        3..=4 => 5, // notice
        _ => SYSLOG_INFORMATIONAL,
    }
}

#[async_trait]
impl SiemTransportTrait for SyslogTransport {
    async fn send(&self, data: &str) -> SiemResult<usize> {
        // Data without a severity of its own: informational.
        self.send_message(SYSLOG_INFORMATIONAL, data).await
    }

    async fn send_event(&self, data: &str, severity: u8) -> SiemResult<usize> {
        self.send_message(syslog_severity(severity), data).await
    }

    /// One syslog message per event, each with its own priority: joined in
    /// a single message, only the first line had a header and all shared
    /// one severity.
    async fn send_batch(&self, events: &[(u8, String)]) -> SiemResult<usize> {
        let mut sent = 0;
        for (severity, data) in events {
            sent += self.send_message(syslog_severity(*severity), data).await?;
        }
        Ok(sent)
    }

    async fn is_connected(&self) -> bool {
        if self.tls {
            return self.tls_connection.read().await.is_some();
        }

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
            None,
            None,
        );

        let message = transport.build_syslog_message(6, "Test message");

        // Should start with priority in angle brackets
        assert!(message.starts_with('<'));
        assert!(message.contains("Test message"));
        assert!(message.contains("sentinel-agent"));
    }

    #[test]
    fn the_syslog_severity_follows_the_event_severity() {
        assert_eq!(syslog_severity(10), 2);
        assert_eq!(syslog_severity(9), 2);
        assert_eq!(syslog_severity(8), 3);
        assert_eq!(syslog_severity(7), 3);
        assert_eq!(syslog_severity(6), 4);
        assert_eq!(syslog_severity(5), 4);
        assert_eq!(syslog_severity(4), 5);
        assert_eq!(syslog_severity(3), 5);
        assert_eq!(syslog_severity(2), 6);
        assert_eq!(syslog_severity(0), 6);
        assert_eq!(syslog_severity(200), 2);
    }

    #[tokio::test]
    async fn each_event_leaves_with_its_own_priority() {
        let receiver = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let port = receiver.local_addr().unwrap().port();
        let transport = SyslogTransport::new(
            "127.0.0.1".to_string(),
            port,
            SyslogProtocol::Udp,
            false,
            None,
            None,
        );
        let next = || async {
            let mut buffer = [0u8; 2048];
            let read = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                receiver.recv(&mut buffer),
            )
            .await
            .expect("a datagram")
            .unwrap();
            String::from_utf8_lossy(&buffer[..read]).to_string()
        };

        // local0 (16): priority = 16 * 8 + severity.
        transport.send_event("critical event", 10).await.unwrap();
        assert!(next().await.starts_with("<130>1 "));

        transport.send("plain data").await.unwrap();
        assert!(next().await.starts_with("<134>1 "));

        transport
            .send_batch(&[(8, "high event".to_string()), (1, "low event".to_string())])
            .await
            .unwrap();
        let high = next().await;
        assert!(high.starts_with("<131>1 ") && high.ends_with("high event"));
        let low = next().await;
        assert!(low.starts_with("<134>1 ") && low.ends_with("low event"));
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
            None,
            None,
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
            None,
            None,
        )
        .with_facility(1); // user-level

        let message = transport.build_syslog_message(6, "Test");
        // user (1) * 8 + info (6) = 14
        assert!(message.starts_with("<14>"));
    }

    #[test]
    fn test_tls_transport_creation() {
        let transport = SyslogTransport::new(
            "siem.company.com".to_string(),
            6514,
            SyslogProtocol::Tcp,
            true,
            None,
            None,
        );

        assert_eq!(transport.host, "siem.company.com");
        assert_eq!(transport.port, 6514);
        assert!(transport.tls);
    }

    #[tokio::test]
    async fn test_tls_not_connected_initially() {
        let transport = SyslogTransport::new(
            "siem.company.com".to_string(),
            6514,
            SyslogProtocol::Tcp,
            true,
            None,
            None,
        );

        // Should not be connected before first send attempt
        assert!(!transport.is_connected().await);
    }

    #[tokio::test]
    async fn test_tls_connection_failure_returns_error() {
        let transport = SyslogTransport::new(
            "nonexistent.invalid".to_string(),
            6514,
            SyslogProtocol::Tcp,
            true,
            None,
            None,
        );

        let result = transport.send("test event").await;
        assert!(result.is_err());
    }
}
