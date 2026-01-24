//! Network data synchronization.
//!
//! Handles efficient synchronization of network data:
//! - Delta calculation (only send changes)
//! - Smart scheduling with jitter to prevent thundering herd
//! - Deployment group staggering

mod delta;
mod scheduler;

pub use delta::DeltaCalculator;
pub use scheduler::{NetworkScheduler, ScheduledTask, TaskType};

use crate::error::NetworkResult;
use crate::types::{DnsConfiguration, NetworkDelta, NetworkInterface, NetworkSnapshot};
use chrono::Utc;
use sha2::{Digest, Sha256};
use tracing::debug;

/// Synchronization manager for network data.
pub struct SyncManager {
    delta_calculator: DeltaCalculator,
    last_snapshot: Option<NetworkSnapshot>,
}

impl SyncManager {
    /// Create a new sync manager.
    pub fn new() -> Self {
        Self {
            delta_calculator: DeltaCalculator::new(),
            last_snapshot: None,
        }
    }

    /// Process a new snapshot and return delta if there are changes.
    pub fn process_snapshot(
        &mut self,
        snapshot: NetworkSnapshot,
    ) -> NetworkResult<Option<NetworkDelta>> {
        let delta = if let Some(ref last) = self.last_snapshot {
            // Calculate delta
            let delta = self.delta_calculator.calculate(last, &snapshot)?;

            // Only return delta if there are actual changes
            if self.delta_has_changes(&delta) {
                debug!("Network snapshot has changes, returning delta");
                Some(delta)
            } else {
                debug!("No changes in network snapshot");
                None
            }
        } else {
            // First snapshot - create full delta
            debug!("First network snapshot, creating full delta");
            Some(self.create_full_delta(&snapshot))
        };

        // Store current snapshot for next comparison
        self.last_snapshot = Some(snapshot);

        Ok(delta)
    }

    /// Force a full sync (ignore delta).
    pub fn force_full_sync(&mut self, snapshot: &NetworkSnapshot) -> NetworkDelta {
        self.create_full_delta(snapshot)
    }

    /// Check if a delta has any changes.
    fn delta_has_changes(&self, delta: &NetworkDelta) -> bool {
        !delta.added_interfaces.is_empty()
            || !delta.removed_interfaces.is_empty()
            || !delta.changed_interfaces.is_empty()
            || delta.dns_changed.is_some()
            || delta.routes_changed
    }

    /// Create a full delta from a snapshot (for initial sync).
    fn create_full_delta(&self, snapshot: &NetworkSnapshot) -> NetworkDelta {
        NetworkDelta {
            timestamp: Utc::now(),
            added_interfaces: snapshot.interfaces.clone(),
            removed_interfaces: Vec::new(),
            changed_interfaces: Vec::new(),
            connections: snapshot.connections.clone(),
            dns_changed: Some(snapshot.dns.clone()),
            routes_changed: true,
            routes: Some(snapshot.routes.clone()),
            hash: snapshot.hash.clone(),
        }
    }

    /// Get the last snapshot hash for comparison.
    pub fn last_hash(&self) -> Option<&str> {
        self.last_snapshot.as_ref().map(|s| s.hash.as_str())
    }

    /// Calculate a hash for comparison.
    pub fn calculate_hash(interfaces: &[NetworkInterface], dns: &DnsConfiguration) -> String {
        let mut hasher = Sha256::new();

        // Hash interfaces (sorted for consistency)
        let mut sorted: Vec<_> = interfaces.iter().collect();
        sorted.sort_by(|a, b| a.name.cmp(&b.name));

        for iface in sorted {
            hasher.update(iface.name.as_bytes());
            if let Some(ref mac) = iface.mac_address {
                hasher.update(mac.as_bytes());
            }
            for ip in &iface.ipv4_addresses {
                hasher.update(ip.as_bytes());
            }
        }

        // Hash DNS
        for server in &dns.servers {
            hasher.update(server.as_bytes());
        }

        hex::encode(hasher.finalize())
    }
}

impl Default for SyncManager {
    fn default() -> Self {
        Self::new()
    }
}
