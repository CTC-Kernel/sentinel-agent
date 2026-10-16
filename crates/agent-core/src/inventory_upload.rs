// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The system inventory sent to the platform, where it is seen with that of
//! every other agent (the wire format is [`agent_sync::system_inventory`]).
//!
//! | When                                              | What is sent                |
//! |---------------------------------------------------|-----------------------------|
//! | First inventory after the agent starts            | the whole inventory         |
//! | A day after the platform last accepted the whole  | the whole inventory         |
//! | The platform asks for the whole                   | the whole, next inventory   |
//! | A section differs from what the platform accepted | the sections that differ    |
//! | Nothing differs                                   | nothing                     |
//!
//! The upload is queued like the other uploads and does not hold the loop.
//! One that fails is tried again with a later inventory: ten minutes after
//! the first failure, then twice as long each time, up to six hours, so that
//! a platform that does not take the inventory yet is not asked every ten
//! minutes. A standalone agent sends nothing.

use agent_scanner::inventory::{SystemInventory, is_privileged_group};
use agent_sync::SyncError;
use agent_sync::system_inventory::{
    InventoryContainerPayload, InventoryFingerprints, InventoryGroupPayload,
    InventoryHotfixPayload, InventoryPortPayload, InventorySection, InventoryServicePayload,
    InventorySystemPayload, InventoryUserPayload, SystemInventoryParts, SystemInventoryUpload,
};
use chrono::{DateTime, TimeDelta, Utc};
use std::collections::BTreeSet;
use tracing::{debug, info, warn};

use crate::AgentRuntime;

/// Time after which the whole inventory is sent again, changed or not: the
/// platform's copy mends itself if it lost a section.
const WHOLE_EVERY: TimeDelta = TimeDelta::hours(24);
/// Wait after a first failure.
const FIRST_RETRY: TimeDelta = TimeDelta::minutes(10);
/// Longest wait between two attempts.
const LONGEST_RETRY: TimeDelta = TimeDelta::hours(6);
/// An upload not answered after this long is taken as lost: another one
/// can be queued.
const ANSWER_WITHIN: TimeDelta = TimeDelta::minutes(30);
/// Inventories are ten minutes apart, give or take the time each takes: a
/// wait that ends within a minute of an inventory ends with it.
const INVENTORY_JITTER: TimeDelta = TimeDelta::minutes(1);

/// The accounts that are members of a group that administers the machine.
pub(crate) fn administrators(inventory: &SystemInventory) -> BTreeSet<&str> {
    inventory
        .groups
        .iter()
        .filter(|group| is_privileged_group(&group.name))
        .flat_map(|group| group.members.iter().map(String::as_str))
        .collect()
}

/// The whole of `inventory` as the platform receives it; `now` dates an
/// inventory that does not say when it was taken.
pub(crate) fn snapshot(inventory: &SystemInventory, now: DateTime<Utc>) -> SystemInventoryUpload {
    let administrators = administrators(inventory);
    SystemInventoryUpload::full(SystemInventoryParts {
        collected_at: inventory.collected_at.unwrap_or(now),
        system: inventory
            .system
            .as_ref()
            .map(|system| InventorySystemPayload {
                hostname: system.hostname.clone(),
                os_name: system.os_name.clone(),
                os_version: system.os_version.clone(),
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
        users: inventory
            .users
            .iter()
            .map(|user| InventoryUserPayload {
                name: user.name.clone(),
                id: user.id.clone(),
                group_id: user.group_id.clone(),
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
            .map(|group| InventoryGroupPayload {
                name: group.name.clone(),
                id: group.id.clone(),
                members: group.members.clone(),
                members_total: group.members.len(),
                privileged: is_privileged_group(&group.name),
            })
            .collect(),
        services: inventory
            .services
            .iter()
            .map(|service| InventoryServicePayload {
                name: service.name.clone(),
                state: service.state.clone(),
                command: service.command.clone(),
            })
            .collect(),
        listening_ports: inventory
            .listening_ports
            .iter()
            .map(|port| InventoryPortPayload {
                protocol: port.protocol.clone(),
                address: port.address.clone(),
                port: port.port,
                process: port.process.clone(),
                local_only: port.is_local_only(),
            })
            .collect(),
        hotfixes: inventory
            .hotfixes
            .iter()
            .map(|hotfix| InventoryHotfixPayload {
                id: hotfix.id.clone(),
                description: hotfix.description.clone(),
                installed_on: hotfix.installed_on.clone(),
            })
            .collect(),
        containers: inventory
            .containers
            .iter()
            .map(|container| {
                let risks = container.settings.risks();
                InventoryContainerPayload {
                    engine: container.engine.clone(),
                    id: container.id.clone(),
                    name: container.name.clone(),
                    image: container.image.clone(),
                    state: container.state.clone(),
                    user: Some(container.settings.user.clone()).filter(|user| !user.is_empty()),
                    risks: risks
                        .iter()
                        .filter_map(|risk| {
                            serde_json::to_value(risk)
                                .ok()
                                .and_then(|code| code.as_str().map(str::to_string))
                        })
                        .collect(),
                    can_take_host: risks.iter().any(|risk| risk.is_escape()),
                }
            })
            .collect(),
    })
}

/// An upload queued, and the fingerprints of the sections it sends.
pub(crate) struct PendingInventory {
    pub(crate) upload: SystemInventoryUpload,
    prints: InventoryFingerprints,
    /// The time of the inventory it was made from: the waits count from it.
    queued_at: DateTime<Utc>,
}

/// What the platform holds of the inventory, as far as the agent knows,
/// and when to send it again.
#[derive(Debug, Default)]
pub(crate) struct InventoryUploads {
    /// The fingerprints of the sections the platform last accepted.
    accepted: InventoryFingerprints,
    /// When the platform last accepted the whole inventory.
    whole_at: Option<DateTime<Utc>>,
    /// When the upload waiting for its answer was queued.
    in_flight: Option<DateTime<Utc>>,
    /// Failures in a row.
    failures: u32,
    /// No attempt before this time.
    retry_at: Option<DateTime<Utc>>,
}

impl InventoryUploads {
    /// What to send of `snapshot`, the whole inventory taken at `now`:
    /// `None` when the platform holds it already, when an upload waits for
    /// its answer or when the last one failed too recently.
    pub(crate) fn next(
        &mut self,
        snapshot: SystemInventoryUpload,
        now: DateTime<Utc>,
    ) -> Option<PendingInventory> {
        if self.in_flight.is_some_and(|at| now - at < ANSWER_WITHIN)
            || self.retry_at.is_some_and(|at| now + INVENTORY_JITTER < at)
        {
            return None;
        }
        let mut prints = snapshot.fingerprints();
        let upload = if self
            .whole_at
            .is_none_or(|at| now + INVENTORY_JITTER - at >= WHOLE_EVERY)
        {
            snapshot
        } else {
            prints.retain(|section, print| self.accepted.get(section) != Some(print));
            if prints.is_empty() {
                return None;
            }
            let changed: BTreeSet<InventorySection> = prints.keys().copied().collect();
            snapshot.only(&changed)
        };
        self.in_flight = Some(now);
        Some(PendingInventory {
            upload,
            prints,
            queued_at: now,
        })
    }

    /// The platform accepted `pending`.
    pub(crate) fn accepted(&mut self, pending: &PendingInventory) {
        self.settled();
        if pending.upload.full {
            self.accepted.clone_from(&pending.prints);
            self.whole_at = Some(pending.queued_at);
        } else {
            self.accepted.extend(pending.prints.clone());
        }
    }

    /// The platform could not apply the sections sent: the next upload is
    /// the whole inventory.
    pub(crate) fn whole_requested(&mut self) {
        self.settled();
        self.accepted.clear();
        self.whole_at = None;
    }

    /// The platform did not take `pending`. Returns the wait before the
    /// next attempt.
    pub(crate) fn failed(&mut self, pending: &PendingInventory) -> TimeDelta {
        self.in_flight = None;
        self.failures = self.failures.saturating_add(1);
        let doublings = (self.failures - 1).min(16);
        let wait = (FIRST_RETRY * 2_i32.pow(doublings)).min(LONGEST_RETRY);
        self.retry_at = Some(pending.queued_at + wait);
        wait
    }

    /// Failures in a row.
    pub(crate) fn failures(&self) -> u32 {
        self.failures
    }

    fn settled(&mut self) {
        self.in_flight = None;
        self.failures = 0;
        self.retry_at = None;
    }
}

/// The sections, by name, for the logs.
fn names(sections: impl IntoIterator<Item = InventorySection>) -> String {
    sections
        .into_iter()
        .map(InventorySection::name)
        .collect::<Vec<_>>()
        .join(", ")
}

impl AgentRuntime {
    /// Send the system inventory queued by an inventory, and remember what
    /// the platform answered.
    pub(crate) async fn upload_system_inventory(&self, pending: PendingInventory) {
        let Some(client) = self.authenticated_client.as_ref() else {
            return;
        };
        let answer = client.upload_system_inventory(&pending.upload).await;
        let mut guard = self.inventory.lock().unwrap_or_else(|e| e.into_inner());
        let Some(watch) = guard.as_mut() else {
            return;
        };
        let uploads = &mut watch.uploads;
        match answer {
            Ok(answer) if answer.full_snapshot_required && !pending.upload.full => {
                uploads.whole_requested();
                info!(
                    "The platform asks for the whole system inventory: sent with the next inventory"
                );
            }
            Ok(_) => {
                uploads.accepted(&pending);
                let upload = &pending.upload;
                if upload.full {
                    let total = |list: Option<usize>| list.unwrap_or(0);
                    info!(
                        "System inventory sent to the platform: {} accounts, {} groups, {} services, {} listening ports, {} updates, {} containers",
                        total(upload.users.as_ref().map(|l| l.total)),
                        total(upload.groups.as_ref().map(|l| l.total)),
                        total(upload.services.as_ref().map(|l| l.total)),
                        total(upload.listening_ports.as_ref().map(|l| l.total)),
                        total(upload.hotfixes.as_ref().map(|l| l.total)),
                        total(upload.containers.as_ref().map(|l| l.total)),
                    );
                } else {
                    info!(
                        "System inventory sent to the platform, changed: {}",
                        names(upload.sections())
                    );
                }
                let truncated = upload.truncated_sections();
                if !truncated.is_empty() {
                    warn!(
                        "System inventory: {} cut to fit the platform's limits",
                        names(truncated)
                    );
                }
            }
            Err(e) => {
                let first = uploads.failures() == 0;
                let wait = uploads.failed(&pending);
                match e {
                    // The platform has no route for it yet: said once.
                    SyncError::ServerError { status: 404, .. } if first => info!(
                        "The platform does not take the system inventory yet (404): next attempt in {} min",
                        wait.num_minutes()
                    ),
                    SyncError::ServerError { status: 404, .. } => debug!(
                        "System inventory still refused by the platform (404): next attempt in {} min",
                        wait.num_minutes()
                    ),
                    e => warn!(
                        "System inventory upload failed: {}; next attempt in {} min",
                        e,
                        wait.num_minutes()
                    ),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_scanner::inventory::{
        ContainerEntry, GroupEntry, ListeningPort, ServiceEntry, SystemDescription, UserAccount,
    };

    fn at(minutes: i64) -> DateTime<Utc> {
        "2026-10-16T09:00:00Z".parse::<DateTime<Utc>>().unwrap() + TimeDelta::minutes(minutes)
    }

    fn account(name: &str, id: &str) -> UserAccount {
        UserAccount {
            name: name.to_string(),
            id: id.to_string(),
            group_id: None,
            home: Some(format!("/home/{name}")),
            shell: Some("/bin/bash".to_string()),
            can_log_in: true,
        }
    }

    fn inventory() -> SystemInventory {
        SystemInventory {
            collected_at: Some(at(0)),
            system: Some(SystemDescription {
                hostname: Some("web-01".to_string()),
                os_name: Some("Ubuntu 24.04.1 LTS".to_string()),
                memory_bytes: Some(16 << 30),
                ..Default::default()
            }),
            users: vec![
                account("root", "0"),
                account("alice", "1000"),
                account("bob", "1001"),
            ],
            groups: vec![GroupEntry {
                name: "sudo".to_string(),
                id: Some("27".to_string()),
                members: vec!["alice".to_string()],
            }],
            services: vec![ServiceEntry {
                name: "ssh.service".to_string(),
                state: "enabled".to_string(),
                command: Some("/usr/sbin/sshd -D".to_string()),
            }],
            listening_ports: vec![
                port("0.0.0.0", 22, "sshd"),
                port("127.0.0.1", 5432, "postgres"),
            ],
            hotfixes: Vec::new(),
            containers: Vec::new(),
        }
    }

    fn port(address: &str, port: u16, process: &str) -> ListeningPort {
        ListeningPort {
            protocol: "tcp".to_string(),
            address: address.to_string(),
            port,
            process: Some(process.to_string()),
        }
    }

    #[test]
    fn the_platform_sees_who_administers_the_machine() {
        let upload = snapshot(&inventory(), at(5));
        assert_eq!(upload.collected_at, at(0));
        let users = &upload.users.as_ref().unwrap().items;
        let privileged: Vec<(&str, bool)> = users
            .iter()
            .map(|user| (user.name.as_str(), user.privileged))
            .collect();
        // root by its identifier, alice by the sudo group.
        assert_eq!(
            privileged,
            [("root", true), ("alice", true), ("bob", false)]
        );
        assert!(upload.groups.as_ref().unwrap().items[0].privileged);
        let ports = &upload.listening_ports.as_ref().unwrap().items;
        assert!(!ports[0].local_only);
        assert!(ports[1].local_only);
        assert_eq!(
            upload.system.as_ref().unwrap().hostname.as_deref(),
            Some("web-01")
        );
    }

    #[test]
    fn containers_are_sent_with_what_weakens_them() {
        let mut inventory = inventory();
        let settings = agent_common::containers::ContainerSettings {
            privileged: true,
            user: "root".to_string(),
            ..Default::default()
        };
        inventory.containers.push(ContainerEntry {
            engine: "docker".to_string(),
            id: "0123456789ab".to_string(),
            name: "builder".to_string(),
            image: "docker:27-dind".to_string(),
            state: "running".to_string(),
            settings,
        });
        inventory.containers.push(ContainerEntry {
            engine: "podman".to_string(),
            id: "ba9876543210".to_string(),
            name: "web".to_string(),
            image: "nginx:1.27".to_string(),
            state: "exited".to_string(),
            settings: Default::default(),
        });
        let upload = snapshot(&inventory, at(0));
        let containers = &upload.containers.as_ref().unwrap().items;
        assert_eq!(containers[0].risks, ["privileged"]);
        assert!(containers[0].can_take_host);
        assert_eq!(containers[0].user.as_deref(), Some("root"));
        assert!(containers[1].risks.is_empty());
        assert!(!containers[1].can_take_host);
        assert_eq!(containers[1].user, None);
    }

    #[test]
    fn the_first_inventory_is_sent_whole_then_only_what_changed() {
        let mut uploads = InventoryUploads::default();
        let first = uploads.next(snapshot(&inventory(), at(0)), at(0)).unwrap();
        assert!(first.upload.full);
        assert_eq!(first.upload.sections().len(), InventorySection::ALL.len());
        uploads.accepted(&first);

        // Ten minutes later, nothing changed: nothing is sent.
        let mut same = inventory();
        same.collected_at = Some(at(10));
        assert!(uploads.next(snapshot(&same, at(10)), at(10)).is_none());

        // An account created, a port opened: those two sections only.
        let mut changed = same.clone();
        changed.users.push(account("backup", "1002"));
        changed.listening_ports.push(port("0.0.0.0", 4444, "nc"));
        let partial = uploads.next(snapshot(&changed, at(20)), at(20)).unwrap();
        assert!(!partial.upload.full);
        assert_eq!(
            partial.upload.sections(),
            BTreeSet::from([InventorySection::Users, InventorySection::ListeningPorts])
        );
        uploads.accepted(&partial);
        assert!(uploads.next(snapshot(&changed, at(30)), at(30)).is_none());

        // Back as it was: the platform is told so.
        let reverted = uploads.next(snapshot(&same, at(40)), at(40)).unwrap();
        assert_eq!(
            reverted.upload.sections(),
            BTreeSet::from([InventorySection::Users, InventorySection::ListeningPorts])
        );
    }

    #[test]
    fn the_whole_inventory_is_sent_again_every_day() {
        let mut uploads = InventoryUploads::default();
        let first = uploads.next(snapshot(&inventory(), at(0)), at(0)).unwrap();
        uploads.accepted(&first);
        assert!(
            uploads
                .next(snapshot(&inventory(), at(23 * 60)), at(23 * 60))
                .is_none()
        );
        let day = 24 * 60;
        let again = uploads
            .next(snapshot(&inventory(), at(day)), at(day))
            .unwrap();
        assert!(again.upload.full);
    }

    #[test]
    fn one_upload_at_a_time_until_it_is_answered_or_lost() {
        let mut uploads = InventoryUploads::default();
        assert!(uploads.next(snapshot(&inventory(), at(0)), at(0)).is_some());
        // Not answered yet: the next inventory queues nothing more.
        assert!(
            uploads
                .next(snapshot(&inventory(), at(10)), at(10))
                .is_none()
        );
        // Never answered (the task that sent it ended): taken as lost.
        let again = uploads
            .next(snapshot(&inventory(), at(30)), at(30))
            .unwrap();
        assert!(again.upload.full);
    }

    #[test]
    fn a_refused_upload_is_tried_again_later_and_later() {
        let mut uploads = InventoryUploads::default();
        let mut now = 0;
        let mut waits = Vec::new();
        for _ in 0..8 {
            let pending = uploads
                .next(snapshot(&inventory(), at(now)), at(now))
                .unwrap_or_else(|| panic!("no attempt at {now} min"));
            assert!(pending.upload.full);
            let wait = uploads.failed(&pending).num_minutes();
            // Not before its time.
            assert!(
                uploads
                    .next(
                        snapshot(&inventory(), at(now + wait - 2)),
                        at(now + wait - 2)
                    )
                    .is_none()
            );
            waits.push(wait);
            now += wait;
        }
        assert_eq!(waits, [10, 20, 40, 80, 160, 320, 360, 360]);
        assert_eq!(uploads.failures(), 8);

        // Accepted at last: the count starts again.
        let pending = uploads
            .next(snapshot(&inventory(), at(now)), at(now))
            .unwrap();
        uploads.accepted(&pending);
        assert_eq!(uploads.failures(), 0);
        assert_eq!(uploads.failed(&pending).num_minutes(), 10);
    }

    #[test]
    fn a_failed_partial_upload_is_sent_again_with_what_changed_since() {
        let mut uploads = InventoryUploads::default();
        let first = uploads.next(snapshot(&inventory(), at(0)), at(0)).unwrap();
        uploads.accepted(&first);

        let mut changed = inventory();
        changed.users.push(account("backup", "1002"));
        let refused = uploads.next(snapshot(&changed, at(10)), at(10)).unwrap();
        uploads.failed(&refused);

        changed.services.push(ServiceEntry {
            name: "backdoor.service".to_string(),
            state: "enabled".to_string(),
            command: Some("/tmp/.x".to_string()),
        });
        let retry = uploads.next(snapshot(&changed, at(20)), at(20)).unwrap();
        assert_eq!(
            retry.upload.sections(),
            BTreeSet::from([InventorySection::Users, InventorySection::Services])
        );
    }

    /// The real system as the platform would receive it: within the limits,
    /// and a system that does not change between two inventories (its start
    /// time read twice, for one).
    #[test]
    fn the_real_inventory_fits_the_platform_and_holds_still() {
        let first = snapshot(&agent_scanner::inventory::collect(), Utc::now());
        let body = serde_json::to_vec(&first).unwrap();
        assert!(body.len() < 5_000_000, "{} bytes", body.len());
        assert!(
            first
                .users
                .as_ref()
                .is_some_and(|users| !users.items.is_empty())
        );
        let second = snapshot(&agent_scanner::inventory::collect(), Utc::now());
        for section in [
            InventorySection::System,
            InventorySection::Users,
            InventorySection::Groups,
        ] {
            assert_eq!(
                first.fingerprints()[&section],
                second.fingerprints()[&section],
                "{} moved: {:?} then {:?}",
                section.name(),
                first.system,
                second.system
            );
        }
    }

    #[test]
    fn the_platform_may_ask_for_the_whole_inventory() {
        let mut uploads = InventoryUploads::default();
        let first = uploads.next(snapshot(&inventory(), at(0)), at(0)).unwrap();
        uploads.accepted(&first);
        let mut changed = inventory();
        changed.users.push(account("backup", "1002"));
        assert!(uploads.next(snapshot(&changed, at(10)), at(10)).is_some());

        uploads.whole_requested();
        let whole = uploads.next(snapshot(&changed, at(20)), at(20)).unwrap();
        assert!(whole.upload.full);
    }
}
