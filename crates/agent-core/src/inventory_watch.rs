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

/// Changes kept for the interface, most recent first.
const RECENT_CHANGES: usize = 200;

/// A change of the inventory as the interface lists it.
#[cfg_attr(not(feature = "gui"), allow(dead_code))]
pub(crate) struct RecentChange {
    at: chrono::DateTime<chrono::Utc>,
    label: String,
    severity: Option<agent_scanner::IncidentSeverity>,
}

/// When the inventory was last taken, and what it held.
pub(crate) struct InventoryWatch {
    state: InventoryState,
    last: Option<Instant>,
    path: std::path::PathBuf,
    /// What changed since the agent started, most recent first.
    recent: std::collections::VecDeque<RecentChange>,
}

impl InventoryWatch {
    pub(crate) fn new() -> Self {
        let path = AgentConfig::platform_data_dir().join("inventory.json");
        Self {
            state: InventoryState::load(&path),
            last: None,
            path,
            recent: std::collections::VecDeque::new(),
        }
    }

    /// Keep `changes`, taken at `at`, for the interface.
    fn remember(&mut self, changes: &[InventoryChange], at: chrono::DateTime<chrono::Utc>) {
        for change in changes {
            self.recent.push_front(RecentChange {
                at,
                label: change.describe(),
                severity: change.incident().map(|incident| incident.severity),
            });
        }
        self.recent.truncate(RECENT_CHANGES);
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
        let system = current.system.as_ref().and_then(|system| system.os_label());
        let (users, services, ports) = (
            current.users.len(),
            current.services.len(),
            current.listening_ports.len(),
        );
        let taken_at = chrono::Utc::now();
        let changes = watch.state.update(current, taken_at);
        if let Err(e) = watch.state.save(&watch.path) {
            warn!("Failed to save the inventory: {}", e);
        }
        watch.remember(&changes, taken_at);
        #[cfg(feature = "gui")]
        if let Some(inventory) = watch.gui_inventory() {
            self.emit_gui_event(agent_gui::events::AgentEvent::SystemInventory { inventory });
        }
        if first {
            info!(
                "First inventory taken: {}, {} accounts, {} services, {} listening ports",
                system.as_deref().unwrap_or("system not described"),
                users,
                services,
                ports
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

#[cfg(feature = "gui")]
impl InventoryWatch {
    /// The inventory as the interface shows it (`None`: none taken yet).
    pub(crate) fn gui_inventory(&self) -> Option<agent_gui::dto::GuiSystemInventory> {
        use agent_gui::dto;
        use agent_scanner::inventory::is_privileged_group;
        let inventory = self.state.inventory.as_ref()?;
        let administrators: std::collections::BTreeSet<&str> = inventory
            .groups
            .iter()
            .filter(|group| is_privileged_group(&group.name))
            .flat_map(|group| group.members.iter().map(String::as_str))
            .collect();
        let severity = |severity: agent_scanner::IncidentSeverity| match severity {
            agent_scanner::IncidentSeverity::Critical => dto::Severity::Critical,
            agent_scanner::IncidentSeverity::High => dto::Severity::High,
            agent_scanner::IncidentSeverity::Medium => dto::Severity::Medium,
            agent_scanner::IncidentSeverity::Low => dto::Severity::Low,
        };
        Some(dto::GuiSystemInventory {
            collected_at: inventory.collected_at,
            accounts: inventory
                .users
                .iter()
                .map(|user| dto::GuiInventoryAccount {
                    name: user.name.clone(),
                    id: user.id.clone(),
                    home: user.home.clone(),
                    shell: user.shell.clone(),
                    can_log_in: user.can_log_in,
                    privileged: user.is_root_equivalent()
                        || administrators.contains(user.name.as_str()),
                })
                .collect(),
            groups: inventory
                .groups
                .iter()
                .map(|group| dto::GuiInventoryGroup {
                    name: group.name.clone(),
                    id: group.id.clone(),
                    members: group.members.clone(),
                    privileged: is_privileged_group(&group.name),
                })
                .collect(),
            services: inventory
                .services
                .iter()
                .map(|service| dto::GuiInventoryService {
                    name: service.name.clone(),
                    state: service.state.clone(),
                    command: service.command.clone(),
                })
                .collect(),
            ports: inventory
                .listening_ports
                .iter()
                .map(|port| dto::GuiInventoryPort {
                    protocol: port.protocol.clone(),
                    address: port.address.clone(),
                    port: port.port,
                    process: port.process.clone(),
                    local_only: port.is_local_only(),
                })
                .collect(),
            changes: self
                .recent
                .iter()
                .map(|change| dto::GuiInventoryChange {
                    at: change.at,
                    label: change.label.clone(),
                    severity: change.severity.map(severity),
                })
                .collect(),
            system: inventory
                .system
                .as_ref()
                .map(|system| dto::GuiSystemDescription {
                    hostname: system.hostname.clone(),
                    os_label: system.os_label(),
                    kernel: system.kernel.clone(),
                    architecture: system.architecture.clone(),
                    manufacturer: system.manufacturer.clone(),
                    model: system.model.clone(),
                    serial_number: system.serial_number.clone(),
                    processor: system.processor.clone(),
                    cores: system.cores,
                    threads: system.threads,
                    memory_bytes: system.memory_bytes,
                    booted_at: system.booted_at,
                }),
            hotfixes: {
                let mut hotfixes: Vec<dto::GuiInventoryHotfix> = inventory
                    .hotfixes
                    .iter()
                    .map(|hotfix| dto::GuiInventoryHotfix {
                        id: hotfix.id.clone(),
                        description: hotfix.description.clone(),
                        installed_on: hotfix.installed_on.clone(),
                    })
                    .collect();
                // The days are written `2026-10-08`: their order is that of
                // the text. The ones without a day come last.
                hotfixes.sort_by(|a, b| b.installed_on.cmp(&a.installed_on));
                hotfixes
            },
            containers: inventory
                .containers
                .iter()
                .map(|container| {
                    let risks = container.settings.risks();
                    dto::GuiInventoryContainer {
                        id: container.id.clone(),
                        name: container.name.clone(),
                        image: container.image.clone(),
                        state: container.state.clone(),
                        user: container.settings.user.clone(),
                        risks: risks
                            .iter()
                            .map(|risk| risk.label_fr().to_string())
                            .collect(),
                        can_take_host: risks.iter().any(|risk| risk.is_escape()),
                    }
                })
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::inventory::{ServiceEntry, UserAccount};

    #[test]
    fn the_interface_lists_changes_in_french_most_recent_first() {
        let mut watch = InventoryWatch {
            state: InventoryState::default(),
            last: None,
            path: std::path::PathBuf::new(),
            recent: std::collections::VecDeque::new(),
        };
        let first = chrono::Utc::now() - chrono::Duration::minutes(10);
        watch.remember(&[account("backup", "1001")], first);
        watch.remember(
            &[InventoryChange::GroupMemberAdded {
                group: "sudo".to_string(),
                member: "backup".to_string(),
            }],
            chrono::Utc::now(),
        );
        let labels: Vec<&str> = watch.recent.iter().map(|c| c.label.as_str()).collect();
        assert_eq!(
            labels,
            [
                "backup ajouté au groupe sudo",
                "Compte créé : backup (identifiant 1001)"
            ]
        );
        // Both raise an incident: an account, then an administrator.
        assert!(watch.recent.iter().all(|change| change.severity.is_some()));
    }

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
    fn system_and_update_changes_are_described_in_french() {
        use agent_scanner::inventory::{Hotfix, SystemField};
        let changes = [
            InventoryChange::SystemChanged {
                field: SystemField::Memory,
                before: "16 Gio".to_string(),
                after: "32 Gio".to_string(),
            },
            InventoryChange::SystemChanged {
                field: SystemField::Kernel,
                before: "6.8.0-45".to_string(),
                after: "6.8.0-47".to_string(),
            },
            InventoryChange::HotfixRemoved(Hotfix {
                id: "KB5031356".to_string(),
                description: None,
                installed_on: None,
            }),
        ];
        let labels: Vec<String> = changes.iter().map(InventoryChange::describe).collect();
        assert_eq!(
            labels,
            [
                "Mémoire : 16 Gio → 32 Gio",
                "Noyau : 6.8.0-45 → 6.8.0-47",
                "Correctif plus installé : KB5031356"
            ]
        );
        let (incidents, records) = report(&changes, "host");
        assert!(incidents.is_empty());
        assert_eq!(records[2].name, "inventory_hotfix_removed");
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
