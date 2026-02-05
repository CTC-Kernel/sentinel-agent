//! Network data collectors.
//!
//! Platform-specific collectors for network information:
//! - Interfaces: IP addresses, MAC addresses, status
//! - Connections: Active TCP/UDP connections with process info
//! - Routes: Routing table entries
//! - DNS: DNS server configuration

mod connections;
mod dns;
mod interfaces;
mod routes;

pub use connections::ConnectionCollector;
pub use dns::DnsCollector;
pub use interfaces::InterfaceCollector;
pub use routes::RouteCollector;

use crate::error::NetworkResult;
use crate::types::{
    DnsConfiguration, NetworkConnection, NetworkInterface, NetworkSnapshot, RouteEntry,
};
use chrono::Utc;
use sha2::{Digest, Sha256};
use tracing::{debug, warn};

/// Main network collector that orchestrates all sub-collectors.
pub struct NetworkCollector {
    interface_collector: InterfaceCollector,
    connection_collector: ConnectionCollector,
    route_collector: RouteCollector,
    dns_collector: DnsCollector,
}

impl NetworkCollector {
    /// Create a new network collector.
    pub fn new() -> Self {
        Self {
            interface_collector: InterfaceCollector::new(),
            connection_collector: ConnectionCollector::new(),
            route_collector: RouteCollector::new(),
            dns_collector: DnsCollector::new(),
        }
    }

    /// Collect a full network snapshot.
    pub async fn collect_snapshot(&self) -> NetworkResult<NetworkSnapshot> {
        debug!("Collecting network snapshot");

        // Collect all data in parallel using tokio::join!
        let (interfaces, connections, routes, dns) = tokio::join!(
            async {
                self.interface_collector
                    .collect()
                    .await
                    .unwrap_or_else(|e| {
                        warn!("Failed to collect interfaces: {}", e);
                        Vec::new()
                    })
            },
            async {
                self.connection_collector
                    .collect()
                    .await
                    .unwrap_or_else(|e| {
                        warn!("Failed to collect connections: {}", e);
                        Vec::new()
                    })
            },
            async {
                self.route_collector.collect().await.unwrap_or_else(|e| {
                    warn!("Failed to collect routes: {}", e);
                    Vec::new()
                })
            },
            async {
                self.dns_collector.collect().await.unwrap_or_else(|e| {
                    warn!("Failed to collect DNS config: {}", e);
                    DnsConfiguration::default()
                })
            }
        );

        // Determine primary IP and MAC
        let (primary_ip, primary_mac) = Self::find_primary_interface(&interfaces);

        // Calculate hash for delta comparison
        let hash = Self::calculate_hash(&interfaces, &dns);

        let snapshot = NetworkSnapshot {
            timestamp: Utc::now(),
            interfaces,
            connections,
            routes,
            dns,
            primary_ip,
            primary_mac,
            hash,
        };

        debug!(
            "Network snapshot collected: {} interfaces, {} connections, {} routes",
            snapshot.interfaces.len(),
            snapshot.connections.len(),
            snapshot.routes.len()
        );

        Ok(snapshot)
    }

    /// Collect only static info (interfaces, routes, DNS).
    pub async fn collect_static_info(
        &self,
    ) -> NetworkResult<(Vec<NetworkInterface>, Vec<RouteEntry>, DnsConfiguration)> {
        let interfaces = self.interface_collector.collect().await?;
        let routes = self.route_collector.collect().await?;
        let dns = self.dns_collector.collect().await?;
        Ok((interfaces, routes, dns))
    }

    /// Collect only active connections.
    pub async fn collect_connections(&self) -> NetworkResult<Vec<NetworkConnection>> {
        self.connection_collector.collect().await
    }

    /// Find the primary interface (first non-loopback with IPv4).
    fn find_primary_interface(interfaces: &[NetworkInterface]) -> (Option<String>, Option<String>) {
        for iface in interfaces {
            if iface.is_virtual {
                continue;
            }
            if !iface.ipv4_addresses.is_empty() {
                let ip = iface.ipv4_addresses.first().cloned();
                let mac = iface.mac_address.clone();
                return (ip, mac);
            }
        }
        (None, None)
    }

    /// Calculate hash for delta comparison.
    fn calculate_hash(interfaces: &[NetworkInterface], dns: &DnsConfiguration) -> String {
        let mut hasher = Sha256::new();

        // Hash interfaces (sorted for consistency)
        let mut sorted_interfaces: Vec<_> = interfaces.iter().collect();
        sorted_interfaces.sort_by(|a, b| a.name.cmp(&b.name));

        for iface in sorted_interfaces {
            hasher.update(iface.name.as_bytes());
            if let Some(ref mac) = iface.mac_address {
                hasher.update(mac.as_bytes());
            }
            for ip in &iface.ipv4_addresses {
                hasher.update(ip.as_bytes());
            }
        }

        // Hash DNS config
        for server in &dns.servers {
            hasher.update(server.as_bytes());
        }

        hex::encode(hasher.finalize())
    }
}

impl Default for NetworkCollector {
    fn default() -> Self {
        Self::new()
    }
}
