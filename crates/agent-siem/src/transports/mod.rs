// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

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

    /// Send one formatted event of the given severity (0-10, as
    /// [`SiemEvent::severity`](crate::SiemEvent)). A transport whose protocol
    /// carries a severity of its own (syslog) derives it from this one; the
    /// others send the data as it is.
    async fn send_event(&self, data: &str, severity: u8) -> SiemResult<usize> {
        let _ = severity;
        self.send(data).await
    }

    /// Send several formatted events, each with its severity. One request
    /// with one event per line by default; a transport that frames each
    /// event (syslog) sends them one by one.
    async fn send_batch(&self, events: &[(u8, String)]) -> SiemResult<usize> {
        let batch = events
            .iter()
            .map(|(_, data)| data.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        self.send(&batch).await
    }

    /// Check if the transport is connected.
    async fn is_connected(&self) -> bool;

    /// Get the transport name.
    fn name(&self) -> &'static str;
}
