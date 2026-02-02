//! Network discovery module.
//!
//! Discovers devices on the local network using ARP table parsing,
//! concurrent ping sweeps, and device classification — all without
//! requiring raw sockets or elevated privileges.
//!
//! # Architecture
//!
//! ```text
//! NetworkDiscovery::scan()
//!   ├─ ArpScanner        — parse system ARP table
//!   ├─ PingSweeper       — concurrent ICMP ping sweep
//!   └─ DeviceResolver    — reverse DNS + OUI vendor + classification
//! ```

pub mod arp_scanner;
pub mod device_resolver;
pub mod ping_sweep;

pub use arp_scanner::{ArpEntry, ArpScanner};
pub use device_resolver::DeviceResolver;
pub use ping_sweep::{PingSweepConfig, PingSweeper};

use crate::error::NetworkResult;
use crate::types::{DeviceType, DiscoveredDevice, DiscoveryResult};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tracing::{debug, info, warn};

/// Configuration for network discovery scans.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryConfig {
    /// Whether to run a ping sweep after ARP scan.
    pub enable_ping_sweep: bool,

    /// Ping timeout in milliseconds.
    pub ping_timeout_ms: u64,

    /// TCP ports to probe on discovered hosts.
    pub tcp_probe_ports: Vec<u16>,

    /// Maximum concurrent operations (ping / TCP probes).
    pub max_concurrent: usize,

    /// Whether to attempt reverse DNS resolution.
    pub enable_dns_resolve: bool,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        Self {
            enable_ping_sweep: true,
            ping_timeout_ms: 500,
            tcp_probe_ports: vec![22, 80, 443, 8080, 9100, 515, 631, 3306, 5432],
            max_concurrent: 50,
            enable_dns_resolve: true,
        }
    }
}

/// Current phase of a discovery scan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryPhase {
    ArpScan,
    PingSweep,
    TcpProbe,
    DnsResolve,
    Classification,
    Complete,
}

impl std::fmt::Display for DiscoveryPhase {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ArpScan => write!(f, "ARP scan"),
            Self::PingSweep => write!(f, "ping sweep"),
            Self::TcpProbe => write!(f, "TCP probe"),
            Self::DnsResolve => write!(f, "DNS resolve"),
            Self::Classification => write!(f, "classification"),
            Self::Complete => write!(f, "complete"),
        }
    }
}

/// Progress of a running discovery scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryProgress {
    pub phase: DiscoveryPhase,
    pub devices_found: usize,
    pub hosts_scanned: usize,
    pub total_hosts: usize,
}

/// Orchestrates network device discovery.
pub struct NetworkDiscovery {
    config: DiscoveryConfig,
    resolver: DeviceResolver,
    cancel: Arc<AtomicBool>,
}

impl NetworkDiscovery {
    /// Create a new discovery instance with the given configuration.
    pub fn new(config: DiscoveryConfig) -> Self {
        Self {
            config,
            resolver: DeviceResolver::new(),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Get a handle to the cancellation flag.
    pub fn cancel_handle(&self) -> Arc<AtomicBool> {
        self.cancel.clone()
    }

    /// Run a full discovery scan on the given subnet (CIDR notation).
    ///
    /// Phases: ARP scan → ping sweep → TCP probe → DNS resolve → classify.
    pub async fn scan(&self, subnet: &str) -> NetworkResult<DiscoveryResult> {
        let start = Instant::now();
        let now = Utc::now();
        info!("Starting network discovery on {}", subnet);

        // Phase 1: ARP scan
        debug!("Phase 1: ARP scan");
        let arp_entries = ArpScanner::scan().await.unwrap_or_else(|e| {
            warn!("ARP scan failed: {}", e);
            Vec::new()
        });
        debug!("ARP scan found {} entries", arp_entries.len());

        // Build initial device map from ARP entries
        let mut devices: HashMap<String, DeviceBuilder> = HashMap::new();
        for entry in &arp_entries {
            let builder = devices
                .entry(entry.ip.clone())
                .or_insert_with(|| DeviceBuilder::new(entry.ip.clone(), subnet.to_string(), now));
            if entry.mac.is_some() {
                builder.mac = entry.mac.clone();
            }
        }

        if self.cancel.load(Ordering::Relaxed) {
            return Ok(self.build_result(devices, start, subnet, now));
        }

        // Phase 2: Ping sweep (optional)
        if self.config.enable_ping_sweep {
            debug!("Phase 2: Ping sweep on {}", subnet);
            let sweep_config = PingSweepConfig {
                max_concurrent: self.config.max_concurrent,
                timeout_ms: self.config.ping_timeout_ms,
            };
            let alive_hosts = PingSweeper::sweep(subnet, &sweep_config, self.cancel.clone())
                .await
                .unwrap_or_else(|e| {
                    warn!("Ping sweep failed: {}", e);
                    Vec::new()
                });

            for ip in alive_hosts {
                devices
                    .entry(ip.clone())
                    .or_insert_with(|| DeviceBuilder::new(ip, subnet.to_string(), now));
            }
            debug!("After ping sweep: {} unique hosts", devices.len());
        }

        if self.cancel.load(Ordering::Relaxed) {
            return Ok(self.build_result(devices, start, subnet, now));
        }

        // Phase 3: TCP port probes
        if !self.config.tcp_probe_ports.is_empty() {
            debug!("Phase 3: TCP probe on {} hosts", devices.len());
            let ips: Vec<String> = devices.keys().cloned().collect();
            let semaphore = Arc::new(tokio::sync::Semaphore::new(self.config.max_concurrent));

            for ip in &ips {
                if self.cancel.load(Ordering::Relaxed) {
                    break;
                }

                let mut open_ports = Vec::new();
                let mut handles = Vec::new();

                for &port in &self.config.tcp_probe_ports {
                    let ip_clone = ip.clone();
                    let sem = semaphore.clone();
                    let cancel = self.cancel.clone();

                    let handle = tokio::spawn(async move {
                        let _permit = sem.acquire().await.ok()?;
                        if cancel.load(Ordering::Relaxed) {
                            return None;
                        }
                        let addr = format!("{}:{}", ip_clone, port);
                        let timeout = tokio::time::Duration::from_millis(500);
                        match tokio::time::timeout(timeout, tokio::net::TcpStream::connect(&addr))
                            .await
                        {
                            Ok(Ok(_)) => Some(port),
                            _ => None,
                        }
                    });
                    handles.push(handle);
                }

                for handle in handles {
                    if let Ok(Some(port)) = handle.await {
                        open_ports.push(port);
                    }
                }

                if let Some(builder) = devices.get_mut(ip) {
                    open_ports.sort();
                    builder.open_ports = open_ports;
                }
            }
        }

        if self.cancel.load(Ordering::Relaxed) {
            return Ok(self.build_result(devices, start, subnet, now));
        }

        // Phase 4: DNS resolution + vendor lookup + classification
        debug!("Phase 4: Resolve and classify {} devices", devices.len());
        let ips: Vec<String> = devices.keys().cloned().collect();
        for ip in &ips {
            if self.cancel.load(Ordering::Relaxed) {
                break;
            }

            let builder = match devices.get(ip) {
                Some(b) => b.clone(),
                None => continue,
            };

            // Vendor lookup
            let vendor = builder
                .mac
                .as_deref()
                .and_then(|mac| self.resolver.lookup_vendor(mac));

            // DNS resolution
            let hostname = if self.config.enable_dns_resolve {
                self.resolver.resolve_hostname(ip).await
            } else {
                None
            };

            // Classification
            let device_type = self.resolver.classify_device(
                ip,
                vendor.as_deref(),
                &builder.open_ports,
                hostname.as_deref(),
            );

            let is_gateway = matches!(device_type, DeviceType::Router);

            if let Some(b) = devices.get_mut(ip) {
                b.vendor = vendor;
                b.hostname = hostname;
                b.device_type = device_type;
                b.is_gateway = is_gateway;
            }
        }

        Ok(self.build_result(devices, start, subnet, now))
    }

    /// Run an ARP-only scan (fast, no ping sweep or TCP probes).
    pub async fn scan_arp_only(&self) -> NetworkResult<Vec<DiscoveredDevice>> {
        let now = Utc::now();
        info!("Starting ARP-only discovery");

        let arp_entries = ArpScanner::scan().await?;

        let mut discovered = Vec::with_capacity(arp_entries.len());
        for entry in arp_entries {
            if entry.mac.is_none() {
                continue; // skip incomplete entries
            }

            let vendor = entry
                .mac
                .as_deref()
                .and_then(|mac| self.resolver.lookup_vendor(mac));

            let device_type =
                self.resolver
                    .classify_device(&entry.ip, vendor.as_deref(), &[], None);

            let is_gateway = matches!(device_type, DeviceType::Router);

            discovered.push(DiscoveredDevice {
                ip: entry.ip,
                mac: entry.mac,
                hostname: None,
                vendor,
                device_type,
                open_ports: Vec::new(),
                first_seen: now,
                last_seen: now,
                is_gateway,
                subnet: String::new(),
            });
        }

        info!("ARP-only scan found {} devices", discovered.len());
        Ok(discovered)
    }

    /// Build the final DiscoveryResult from collected device data.
    fn build_result(
        &self,
        devices: HashMap<String, DeviceBuilder>,
        start: Instant,
        subnet: &str,
        timestamp: chrono::DateTime<Utc>,
    ) -> DiscoveryResult {
        let discovered: Vec<DiscoveredDevice> = devices.into_values().map(|b| b.build()).collect();

        let duration_ms = start.elapsed().as_millis() as u64;
        info!(
            "Discovery complete: {} devices in {}ms",
            discovered.len(),
            duration_ms
        );

        DiscoveryResult {
            devices: discovered,
            scan_duration_ms: duration_ms,
            subnet_scanned: subnet.to_string(),
            timestamp,
        }
    }
}

/// Internal builder for accumulating device info across phases.
#[derive(Debug, Clone)]
struct DeviceBuilder {
    ip: String,
    mac: Option<String>,
    hostname: Option<String>,
    vendor: Option<String>,
    device_type: DeviceType,
    open_ports: Vec<u16>,
    first_seen: chrono::DateTime<Utc>,
    last_seen: chrono::DateTime<Utc>,
    is_gateway: bool,
    subnet: String,
}

impl DeviceBuilder {
    fn new(ip: String, subnet: String, now: chrono::DateTime<Utc>) -> Self {
        Self {
            ip,
            mac: None,
            hostname: None,
            vendor: None,
            device_type: DeviceType::Unknown,
            open_ports: Vec::new(),
            first_seen: now,
            last_seen: now,
            is_gateway: false,
            subnet,
        }
    }

    fn build(self) -> DiscoveredDevice {
        DiscoveredDevice {
            ip: self.ip,
            mac: self.mac,
            hostname: self.hostname,
            vendor: self.vendor,
            device_type: self.device_type,
            open_ports: self.open_ports,
            first_seen: self.first_seen,
            last_seen: self.last_seen,
            is_gateway: self.is_gateway,
            subnet: self.subnet,
        }
    }
}
