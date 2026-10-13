// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The inventory of the system, taken at intervals, and what changes in it
//! (see [`agent_scanner::inventory`]).
//!
//! Every change is recorded as a SIEM event; the ones an intruder leaves
//! behind (an account, a service, a listening port) raise an incident that
//! follows the same path as any other.

use agent_common::config::AgentConfig;
use agent_common::constants::AGENT_VERSION;
use agent_scanner::SecurityIncident;
use agent_scanner::inventory::{InventoryChange, InventoryState};
use agent_siem::{EventCategory, SiemEvent};
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

use super::AgentRuntime;

/// Time between two inventories.
const INVENTORY_EVERY: Duration = Duration::from_secs(10 * 60);
/// Changes reported at most from one inventory: a system update that
/// replaces every service must not raise a hundred incidents.
const MAX_INCIDENTS_PER_INVENTORY: usize = 15;

/// When the inventory was last taken, and what it held.
pub(crate) struct InventoryWatch {
    state: InventoryState,
    last: Option<Instant>,
    path: std::path::PathBuf,
}

impl InventoryWatch {
    pub(crate) fn new() -> Self {
        let path = AgentConfig::platform_data_dir().join("inventory.json");
        Self {
            state: InventoryState::load(&path),
            last: None,
            path,
        }
    }
}

fn record(change: &InventoryChange, incident: Option<&SecurityIncident>, host: &str) -> SiemEvent {
    use agent_scanner::IncidentSeverity;
    let severity = match incident.map(|incident| incident.severity) {
        Some(IncidentSeverity::Critical) => 10,
        Some(IncidentSeverity::High) => 8,
        Some(IncidentSeverity::Medium) => 5,
        Some(IncidentSeverity::Low) | None => 3,
    };
    SiemEvent {
        timestamp: chrono::Utc::now(),
        severity,
        category: EventCategory::Configuration,
        name: format!("inventory_{}", change.kind()),
        description: change.describe(),
        source_host: host.to_string(),
        source_ip: None,
        destination_ip: None,
        destination_port: None,
        user: None,
        process_name: None,
        process_id: None,
        file_path: None,
        custom_fields: serde_json::json!({ "detection": "inventory", "change": change.kind() }),
        event_id: uuid::Uuid::new_v4().to_string(),
        agent_version: AGENT_VERSION.to_string(),
    }
}

/// Turn the changes of one inventory into incidents and SIEM events.
fn report(changes: &[InventoryChange], host: &str) -> (Vec<SecurityIncident>, Vec<SiemEvent>) {
    let mut incidents = Vec::new();
    let mut records = Vec::new();
    let mut withheld = 0usize;
    for change in changes {
        let incident = change.incident();
        records.push(record(change, incident.as_ref(), host));
        match incident {
            Some(incident) if incidents.len() < MAX_INCIDENTS_PER_INVENTORY => {
                incidents.push(incident);
            }
            Some(_) => withheld += 1,
            None => {}
        }
    }
    if withheld > 0 {
        warn!(
            "{} more inventory changes are recorded but not raised as incidents (limit of {})",
            withheld, MAX_INCIDENTS_PER_INVENTORY
        );
    }
    (incidents, records)
}

impl AgentRuntime {
    /// Take the inventory when its time has come and report what changed.
    pub(crate) async fn inventory_pass(&self) -> (Vec<SecurityIncident>, Vec<SiemEvent>) {
        {
            let mut guard = self.inventory.lock().unwrap_or_else(|e| e.into_inner());
            let Some(watch) = guard.as_mut() else {
                return (Vec::new(), Vec::new());
            };
            if watch.last.is_some_and(|at| at.elapsed() < INVENTORY_EVERY) {
                return (Vec::new(), Vec::new());
            }
            watch.last = Some(Instant::now());
        }
        // Files are read and system tools run: off the asynchronous threads.
        let current = match tokio::task::spawn_blocking(agent_scanner::inventory::collect).await {
            Ok(current) => current,
            Err(e) => {
                warn!("Inventory failed: {}", e);
                return (Vec::new(), Vec::new());
            }
        };
        if current.is_empty() {
            debug!("Inventory: nothing could be collected");
            return (Vec::new(), Vec::new());
        }

        let mut guard = self.inventory.lock().unwrap_or_else(|e| e.into_inner());
        let Some(watch) = guard.as_mut() else {
            return (Vec::new(), Vec::new());
        };
        let first = watch.state.inventory.is_none();
        let (users, services, ports) = (
            current.users.len(),
            current.services.len(),
            current.listening_ports.len(),
        );
        let changes = watch.state.update(current, chrono::Utc::now());
        if let Err(e) = watch.state.save(&watch.path) {
            warn!("Failed to save the inventory: {}", e);
        }
        if first {
            info!(
                "First inventory taken: {} accounts, {} services, {} listening ports",
                users, services, ports
            );
        } else if !changes.is_empty() {
            info!("Inventory: {} change(s)", changes.len());
        }
        let host = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_default();
        report(&changes, &host)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::inventory::{ServiceEntry, UserAccount};

    fn account(name: &str, id: &str) -> InventoryChange {
        InventoryChange::UserAdded(UserAccount {
            name: name.to_string(),
            id: id.to_string(),
            group_id: None,
            home: None,
            shell: Some("/bin/bash".to_string()),
            can_log_in: true,
        })
    }

    #[test]
    fn every_change_is_recorded_and_the_notable_ones_raised() {
        let removed = InventoryChange::ServiceRemoved(ServiceEntry {
            name: "old".to_string(),
            state: "enabled".to_string(),
            command: None,
        });
        let (incidents, records) = report(&[account("toor", "0"), removed], "host");
        assert_eq!(records.len(), 2);
        assert_eq!(incidents.len(), 1);
        assert_eq!(records[0].name, "inventory_user_added");
        assert_eq!(records[0].severity, 10);
        assert_eq!(records[1].name, "inventory_service_removed");
        assert_eq!(records[1].severity, 3);
        assert_eq!(records[1].category, EventCategory::Configuration);
    }

    #[test]
    fn one_inventory_raises_a_bounded_number_of_incidents() {
        let changes: Vec<InventoryChange> = (0..MAX_INCIDENTS_PER_INVENTORY + 10)
            .map(|n| account(&format!("user{n}"), &format!("{}", 2_000 + n)))
            .collect();
        let (incidents, records) = report(&changes, "host");
        assert_eq!(incidents.len(), MAX_INCIDENTS_PER_INVENTORY);
        assert_eq!(records.len(), changes.len());
    }
}
