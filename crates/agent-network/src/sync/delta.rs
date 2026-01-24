//! Delta calculation for efficient network sync.
//!
//! Compares network snapshots and calculates minimal deltas
//! to reduce bandwidth and server load.

use crate::error::NetworkResult;
use crate::types::{NetworkDelta, NetworkInterface, NetworkSnapshot};
use chrono::Utc;
use std::collections::HashMap;

/// Calculator for network data deltas.
pub struct DeltaCalculator;

impl DeltaCalculator {
    /// Create a new delta calculator.
    pub fn new() -> Self {
        Self
    }

    /// Calculate delta between two snapshots.
    pub fn calculate(
        &self,
        old: &NetworkSnapshot,
        new: &NetworkSnapshot,
    ) -> NetworkResult<NetworkDelta> {
        // Build interface maps for comparison
        let old_interfaces: HashMap<&str, &NetworkInterface> = old
            .interfaces
            .iter()
            .map(|i| (i.name.as_str(), i))
            .collect();
        let new_interfaces: HashMap<&str, &NetworkInterface> = new
            .interfaces
            .iter()
            .map(|i| (i.name.as_str(), i))
            .collect();

        // Find added interfaces (in new but not in old)
        let added_interfaces: Vec<NetworkInterface> = new_interfaces
            .iter()
            .filter(|(name, _)| !old_interfaces.contains_key(*name))
            .map(|(_, iface)| (*iface).clone())
            .collect();

        // Find removed interfaces (in old but not in new)
        let removed_interfaces: Vec<String> = old_interfaces
            .iter()
            .filter(|(name, _)| !new_interfaces.contains_key(*name))
            .map(|(name, _)| name.to_string())
            .collect();

        // Find changed interfaces (exist in both but different)
        let changed_interfaces: Vec<NetworkInterface> = new_interfaces
            .iter()
            .filter_map(|(name, new_iface)| {
                if let Some(old_iface) = old_interfaces.get(name) {
                    if self.interface_changed(old_iface, new_iface) {
                        Some((*new_iface).clone())
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        // Check DNS changes
        let dns_changed = if self.dns_changed(&old.dns, &new.dns) {
            Some(new.dns.clone())
        } else {
            None
        };

        // Check route changes
        let routes_changed = self.routes_changed(&old.routes, &new.routes);

        Ok(NetworkDelta {
            timestamp: Utc::now(),
            added_interfaces,
            removed_interfaces,
            changed_interfaces,
            connections: new.connections.clone(), // Always send full connections
            dns_changed,
            routes_changed,
            routes: if routes_changed {
                Some(new.routes.clone())
            } else {
                None
            },
            hash: new.hash.clone(),
        })
    }

    /// Check if an interface has changed.
    fn interface_changed(&self, old: &NetworkInterface, new: &NetworkInterface) -> bool {
        old.mac_address != new.mac_address
            || old.ipv4_addresses != new.ipv4_addresses
            || old.ipv6_addresses != new.ipv6_addresses
            || old.status != new.status
            || old.speed_mbps != new.speed_mbps
            || old.mtu != new.mtu
    }

    /// Check if DNS configuration has changed.
    fn dns_changed(
        &self,
        old: &crate::types::DnsConfiguration,
        new: &crate::types::DnsConfiguration,
    ) -> bool {
        old.servers != new.servers
            || old.search_domains != new.search_domains
            || old.suffix != new.suffix
    }

    /// Check if routes have changed.
    fn routes_changed(
        &self,
        old: &[crate::types::RouteEntry],
        new: &[crate::types::RouteEntry],
    ) -> bool {
        if old.len() != new.len() {
            return true;
        }

        // Simple comparison - routes are considered changed if any differ
        // This could be optimized with hashing
        let old_set: std::collections::HashSet<_> = old
            .iter()
            .map(|r| (&r.destination, &r.gateway, &r.interface))
            .collect();
        let new_set: std::collections::HashSet<_> = new
            .iter()
            .map(|r| (&r.destination, &r.gateway, &r.interface))
            .collect();

        old_set != new_set
    }
}

impl Default for DeltaCalculator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{DnsConfiguration, InterfaceStatus, InterfaceType, NetworkInterface};

    fn make_interface(name: &str, ip: &str) -> NetworkInterface {
        NetworkInterface {
            name: name.to_string(),
            mac_address: Some("00:11:22:33:44:55".to_string()),
            ipv4_addresses: vec![ip.to_string()],
            ipv6_addresses: vec![],
            status: InterfaceStatus::Up,
            speed_mbps: Some(1000),
            mtu: Some(1500),
            is_virtual: false,
            interface_type: InterfaceType::Ethernet,
        }
    }

    fn make_snapshot(interfaces: Vec<NetworkInterface>) -> NetworkSnapshot {
        NetworkSnapshot {
            timestamp: Utc::now(),
            interfaces,
            connections: vec![],
            routes: vec![],
            dns: DnsConfiguration::default(),
            primary_ip: None,
            primary_mac: None,
            hash: "test".to_string(),
        }
    }

    #[test]
    fn test_no_changes() {
        let calc = DeltaCalculator::new();
        let iface = make_interface("eth0", "192.168.1.1");
        let old = make_snapshot(vec![iface.clone()]);
        let new = make_snapshot(vec![iface]);

        let delta = calc.calculate(&old, &new).unwrap();

        assert!(delta.added_interfaces.is_empty());
        assert!(delta.removed_interfaces.is_empty());
        assert!(delta.changed_interfaces.is_empty());
    }

    #[test]
    fn test_added_interface() {
        let calc = DeltaCalculator::new();
        let iface1 = make_interface("eth0", "192.168.1.1");
        let iface2 = make_interface("eth1", "192.168.1.2");

        let old = make_snapshot(vec![iface1.clone()]);
        let new = make_snapshot(vec![iface1, iface2]);

        let delta = calc.calculate(&old, &new).unwrap();

        assert_eq!(delta.added_interfaces.len(), 1);
        assert_eq!(delta.added_interfaces[0].name, "eth1");
        assert!(delta.removed_interfaces.is_empty());
    }

    #[test]
    fn test_removed_interface() {
        let calc = DeltaCalculator::new();
        let iface1 = make_interface("eth0", "192.168.1.1");
        let iface2 = make_interface("eth1", "192.168.1.2");

        let old = make_snapshot(vec![iface1.clone(), iface2]);
        let new = make_snapshot(vec![iface1]);

        let delta = calc.calculate(&old, &new).unwrap();

        assert!(delta.added_interfaces.is_empty());
        assert_eq!(delta.removed_interfaces.len(), 1);
        assert_eq!(delta.removed_interfaces[0], "eth1");
    }

    #[test]
    fn test_changed_interface() {
        let calc = DeltaCalculator::new();
        let iface_old = make_interface("eth0", "192.168.1.1");
        let iface_new = make_interface("eth0", "192.168.1.100"); // IP changed

        let old = make_snapshot(vec![iface_old]);
        let new = make_snapshot(vec![iface_new]);

        let delta = calc.calculate(&old, &new).unwrap();

        assert!(delta.added_interfaces.is_empty());
        assert!(delta.removed_interfaces.is_empty());
        assert_eq!(delta.changed_interfaces.len(), 1);
        assert_eq!(
            delta.changed_interfaces[0].ipv4_addresses[0],
            "192.168.1.100"
        );
    }
}
