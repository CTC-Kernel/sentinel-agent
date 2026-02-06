//! SIEM transport implementations.
//!
//! Supports multiple transport protocols:
//! - Syslog (RFC 5424) over UDP/TCP/TLS
//! - HTTP/HTTPS (Splunk HEC, Azure Sentinel, Elastic)

mod http;
mod syslog;

pub use http::HttpTransport;
pub use syslog::SyslogTransport;

use crate::SiemResult;
use async_trait::async_trait;

/// Trait for SIEM transports.
#[async_trait]
pub trait SiemTransportTrait: Send + Sync {
    /// Send data to the SIEM.
    /// Returns the number of bytes sent.
    async fn send(&self, data: &str) -> SiemResult<usize>;

    /// Check if the transport is connected.
    async fn is_connected(&self) -> bool;

    /// Get the transport name.
    fn name(&self) -> &'static str;
}
