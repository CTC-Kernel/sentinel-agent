// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The system inventory as the platform receives it: the machine, its
//! accounts, groups, services, listening ports, Windows updates and
//! containers (`POST /v1/agents/{id}/system-inventory`).
//!
//! An upload is either the whole inventory (`full`: every section is
//! present and replaces what the platform holds) or the sections that
//! changed since the last upload the platform accepted (`full` is false: an
//! absent section did not change). What changed, entry by entry, already
//! reaches the platform as SIEM events (`inventory_user_added`…) and, for
//! the changes an intruder leaves behind, as incidents: the upload is the
//! state, not its history.
//!
//! # Limits
//!
//! Each section fits one Firestore document (1 MiB) and the whole body the
//! platform's 5 MB, whatever the machine holds:
//!
//! | What                         | Limit                                  |
//! |------------------------------|----------------------------------------|
//! | Entries of a section         | [`MAX_ITEMS_PER_SECTION`]              |
//! | JSON of a section            | [`MAX_SECTION_BYTES`]                  |
//! | Members listed for a group   | [`MAX_GROUP_MEMBERS`]                  |
//! | Identifiers, states, codes   | [`MAX_SHORT_TEXT`] UTF-16 units        |
//! | Names, paths, descriptions   | [`MAX_TEXT`] UTF-16 units              |
//! | Commands                     | [`MAX_LONG_TEXT`] UTF-16 units         |
//!
//! The lengths are counted as JavaScript counts them (`string.length`), so
//! that a `z.string().max(n)` of the same `n` accepts every text. A section
//! cut to fit keeps its first entries, in the order of the inventory, and
//! says in `total` how many it has in all.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::hash::{Hash, Hasher};

/// Entries of one section sent at most.
pub const MAX_ITEMS_PER_SECTION: usize = 5_000;
/// Size of the JSON of one section at most, in bytes: well under the 1 MiB
/// of a Firestore document, and seven of them under the 5 MB of a request.
pub const MAX_SECTION_BYTES: usize = 512 * 1024;
/// Members of one group listed at most.
pub const MAX_GROUP_MEMBERS: usize = 500;
/// Identifiers, states, protocols, codes.
pub const MAX_SHORT_TEXT: usize = 128;
/// Names, paths, descriptions.
pub const MAX_TEXT: usize = 255;
/// Command lines of services.
pub const MAX_LONG_TEXT: usize = 1024;

/// One part of the inventory, as the platform stores it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InventorySection {
    System,
    Users,
    Groups,
    Services,
    ListeningPorts,
    Hotfixes,
    Containers,
}

impl InventorySection {
    pub const ALL: [Self; 7] = [
        Self::System,
        Self::Users,
        Self::Groups,
        Self::Services,
        Self::ListeningPorts,
        Self::Hotfixes,
        Self::Containers,
    ];

    /// Its name on the wire, and that of its document on the platform.
    pub fn name(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Users => "users",
            Self::Groups => "groups",
            Self::Services => "services",
            Self::ListeningPorts => "listening_ports",
            Self::Hotfixes => "hotfixes",
            Self::Containers => "containers",
        }
    }
}

/// `text` cut to `max` UTF-16 units, on a character boundary.
pub fn clip(text: &str, max: usize) -> String {
    let mut units = 0;
    text.chars()
        .take_while(|c| {
            units += c.len_utf16();
            units <= max
        })
        .collect()
}

fn clip_in_place(text: &mut String, max: usize) {
    if text.len() > max {
        *text = clip(text, max);
    }
}

fn clip_option(text: &mut Option<String>, max: usize) {
    if let Some(text) = text {
        clip_in_place(text, max);
    }
}

/// An entry brought within the limits of the wire.
pub trait Bounded {
    #[must_use]
    fn bounded(self) -> Self;
}

/// The machine and its operating system.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventorySystemPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    /// `Ubuntu 24.04.1 LTS`, `macOS 15.6`, `Microsoft Windows 11 Pro`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kernel: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub architecture: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub processor: Option<String>,
    /// Physical cores.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cores: Option<u32>,
    /// Logical processors.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub threads: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub booted_at: Option<DateTime<Utc>>,
}

impl Bounded for InventorySystemPayload {
    fn bounded(mut self) -> Self {
        for text in [
            &mut self.hostname,
            &mut self.os_name,
            &mut self.os_version,
            &mut self.kernel,
            &mut self.architecture,
            &mut self.manufacturer,
            &mut self.model,
            &mut self.serial_number,
            &mut self.processor,
        ] {
            clip_option(text, MAX_TEXT);
        }
        self
    }
}

/// A local account.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryUserPayload {
    pub name: String,
    /// UID on Unix, SID on Windows.
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub home: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shell: Option<String>,
    /// Whether the account can open a session (a shell that is not
    /// `nologin`, an enabled Windows account).
    pub can_log_in: bool,
    /// Root, or a member of an administration group (`sudo`, `wheel`,
    /// `Administrators`…).
    pub privileged: bool,
}

impl Bounded for InventoryUserPayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.name, MAX_TEXT);
        clip_in_place(&mut self.id, MAX_SHORT_TEXT);
        clip_option(&mut self.group_id, MAX_SHORT_TEXT);
        clip_option(&mut self.home, MAX_TEXT);
        clip_option(&mut self.shell, MAX_TEXT);
        self
    }
}

/// A local group and its members.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryGroupPayload {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// The first [`MAX_GROUP_MEMBERS`] members.
    #[serde(default)]
    pub members: Vec<String>,
    /// The members it has in all, more than `members` lists when there are
    /// too many. Set when the entry is bounded.
    #[serde(default)]
    pub members_total: usize,
    /// Its members administer the machine.
    pub privileged: bool,
}

impl Bounded for InventoryGroupPayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.name, MAX_TEXT);
        clip_option(&mut self.id, MAX_SHORT_TEXT);
        self.members_total = self.members_total.max(self.members.len());
        self.members.truncate(MAX_GROUP_MEMBERS);
        for member in &mut self.members {
            clip_in_place(member, MAX_TEXT);
        }
        self
    }
}

/// A service, or what starts by itself (a launch item on macOS).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryServicePayload {
    pub name: String,
    /// `enabled`, `disabled`, `running`, `stopped`… as the system says it.
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

impl Bounded for InventoryServicePayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.name, MAX_TEXT);
        clip_in_place(&mut self.state, MAX_SHORT_TEXT);
        clip_option(&mut self.command, MAX_LONG_TEXT);
        self
    }
}

/// A program waiting for connections.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryPortPayload {
    /// `tcp`, `udp`, `tcp6`…
    pub protocol: String,
    pub address: String,
    pub port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub process: Option<String>,
    /// Reachable from the machine itself only (loopback address).
    pub local_only: bool,
}

impl Bounded for InventoryPortPayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.protocol, MAX_SHORT_TEXT);
        clip_in_place(&mut self.address, MAX_SHORT_TEXT);
        clip_option(&mut self.process, MAX_TEXT);
        self
    }
}

/// An update installed on Windows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryHotfixPayload {
    /// `KB5034441`.
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// The day it was installed, `2026-10-08`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_on: Option<String>,
}

impl Bounded for InventoryHotfixPayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.id, MAX_SHORT_TEXT);
        clip_option(&mut self.description, MAX_TEXT);
        clip_option(&mut self.installed_on, MAX_SHORT_TEXT);
        self
    }
}

/// A container of the host (Docker or Podman), running or not.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryContainerPayload {
    /// `docker` or `podman`.
    pub engine: String,
    pub id: String,
    pub name: String,
    pub image: String,
    /// `running`, `exited`, `created`…
    pub state: String,
    /// The account it runs as.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    /// What weakens its isolation: `privileged`, `host_root`,
    /// `engine_socket`, `escape_capability`, `host_device`,
    /// `host_processes`, `no_security_profile`.
    #[serde(default)]
    pub risks: Vec<String>,
    /// One of its risks alone lets it take the host.
    pub can_take_host: bool,
}

impl Bounded for InventoryContainerPayload {
    fn bounded(mut self) -> Self {
        clip_in_place(&mut self.engine, MAX_SHORT_TEXT);
        clip_in_place(&mut self.id, MAX_SHORT_TEXT);
        clip_in_place(&mut self.name, MAX_TEXT);
        clip_in_place(&mut self.image, MAX_TEXT);
        clip_in_place(&mut self.state, MAX_SHORT_TEXT);
        clip_option(&mut self.user, MAX_TEXT);
        for risk in &mut self.risks {
            clip_in_place(risk, MAX_SHORT_TEXT);
        }
        self
    }
}

/// The entries of one section, and how many there are in all.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryList<T> {
    pub items: Vec<T>,
    /// Entries of the section, `items` and those left out to fit the
    /// limits.
    pub total: usize,
}

impl<T: Bounded + Serialize> InventoryList<T> {
    /// The first of `entries` that fit the limits of a section, each
    /// brought within the limits of an entry.
    pub fn fitted(entries: Vec<T>) -> Self {
        let total = entries.len();
        let mut items = Vec::new();
        // `{"items":[],"total":5000}`, with room to spare.
        let mut bytes: usize = 32;
        for entry in entries {
            if items.len() == MAX_ITEMS_PER_SECTION {
                break;
            }
            let entry = entry.bounded();
            // The entry and the comma that follows it.
            let size = serde_json::to_vec(&entry).map_or(usize::MAX, |json| json.len() + 1);
            if bytes.saturating_add(size) > MAX_SECTION_BYTES {
                break;
            }
            bytes += size;
            items.push(entry);
        }
        Self { items, total }
    }
}

impl<T> InventoryList<T> {
    /// Whether entries were left out to fit the limits.
    pub fn is_truncated(&self) -> bool {
        self.total > self.items.len()
    }
}

/// The whole inventory, entries not yet brought within the limits: what
/// [`SystemInventoryUpload::full`] is made from.
#[derive(Debug, Clone, Default)]
pub struct SystemInventoryParts {
    pub collected_at: DateTime<Utc>,
    pub system: Option<InventorySystemPayload>,
    pub users: Vec<InventoryUserPayload>,
    pub groups: Vec<InventoryGroupPayload>,
    pub services: Vec<InventoryServicePayload>,
    pub listening_ports: Vec<InventoryPortPayload>,
    pub hotfixes: Vec<InventoryHotfixPayload>,
    pub containers: Vec<InventoryContainerPayload>,
}

/// Request body of `POST /v1/agents/{id}/system-inventory`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SystemInventoryUpload {
    /// When the inventory was taken.
    pub collected_at: DateTime<Utc>,
    /// Every section is present and replaces what the platform holds;
    /// `false`: the sections absent did not change.
    pub full: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<InventorySystemPayload>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub users: Option<InventoryList<InventoryUserPayload>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub groups: Option<InventoryList<InventoryGroupPayload>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub services: Option<InventoryList<InventoryServicePayload>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub listening_ports: Option<InventoryList<InventoryPortPayload>>,
    /// Windows only; empty elsewhere.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hotfixes: Option<InventoryList<InventoryHotfixPayload>>,
    /// Hosts with Docker or Podman; empty elsewhere.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub containers: Option<InventoryList<InventoryContainerPayload>>,
}

/// The fingerprint of each section of an upload: two inventories whose
/// section has the same fingerprint send the same section.
pub type InventoryFingerprints = BTreeMap<InventorySection, u64>;

fn fingerprint<T: Serialize>(value: &T) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    serde_json::to_vec(value)
        .unwrap_or_default()
        .hash(&mut hasher);
    hasher.finish()
}

impl SystemInventoryUpload {
    /// The whole inventory, within the limits.
    pub fn full(parts: SystemInventoryParts) -> Self {
        Self {
            collected_at: parts.collected_at,
            full: true,
            // An inventory where the system could not be described still
            // replaces the description the platform holds.
            system: Some(parts.system.unwrap_or_default().bounded()),
            users: Some(InventoryList::fitted(parts.users)),
            groups: Some(InventoryList::fitted(parts.groups)),
            services: Some(InventoryList::fitted(parts.services)),
            listening_ports: Some(InventoryList::fitted(parts.listening_ports)),
            hotfixes: Some(InventoryList::fitted(parts.hotfixes)),
            containers: Some(InventoryList::fitted(parts.containers)),
        }
    }

    /// The sections present.
    pub fn sections(&self) -> BTreeSet<InventorySection> {
        self.fingerprints().into_keys().collect()
    }

    /// The fingerprint of each section present.
    ///
    /// The start time of the machine is left out: it moves by a second
    /// from one reading to the next on some systems, and a restart of the
    /// machine restarts the agent, which sends the whole inventory. So is
    /// the memory below the gibibyte: the kernel reserves a few megabytes
    /// more or less from one version to the next.
    pub fn fingerprints(&self) -> InventoryFingerprints {
        let mut prints = InventoryFingerprints::new();
        if let Some(system) = &self.system {
            let stable = InventorySystemPayload {
                booted_at: None,
                memory_bytes: system.memory_bytes.map(|bytes| (bytes + (1 << 29)) >> 30),
                ..system.clone()
            };
            prints.insert(InventorySection::System, fingerprint(&stable));
        }
        let lists = [
            (
                InventorySection::Users,
                self.users.as_ref().map(fingerprint),
            ),
            (
                InventorySection::Groups,
                self.groups.as_ref().map(fingerprint),
            ),
            (
                InventorySection::Services,
                self.services.as_ref().map(fingerprint),
            ),
            (
                InventorySection::ListeningPorts,
                self.listening_ports.as_ref().map(fingerprint),
            ),
            (
                InventorySection::Hotfixes,
                self.hotfixes.as_ref().map(fingerprint),
            ),
            (
                InventorySection::Containers,
                self.containers.as_ref().map(fingerprint),
            ),
        ];
        prints.extend(
            lists
                .into_iter()
                .filter_map(|(section, print)| print.map(|print| (section, print))),
        );
        prints
    }

    /// The same inventory with only `sections`: an upload of what changed.
    #[must_use]
    pub fn only(&self, sections: &BTreeSet<InventorySection>) -> Self {
        let keep = |section| sections.contains(&section);
        Self {
            collected_at: self.collected_at,
            full: false,
            system: self
                .system
                .clone()
                .filter(|_| keep(InventorySection::System)),
            users: self.users.clone().filter(|_| keep(InventorySection::Users)),
            groups: self
                .groups
                .clone()
                .filter(|_| keep(InventorySection::Groups)),
            services: self
                .services
                .clone()
                .filter(|_| keep(InventorySection::Services)),
            listening_ports: self
                .listening_ports
                .clone()
                .filter(|_| keep(InventorySection::ListeningPorts)),
            hotfixes: self
                .hotfixes
                .clone()
                .filter(|_| keep(InventorySection::Hotfixes)),
            containers: self
                .containers
                .clone()
                .filter(|_| keep(InventorySection::Containers)),
        }
    }

    /// The sections cut to fit the limits.
    pub fn truncated_sections(&self) -> Vec<InventorySection> {
        let mut truncated = Vec::new();
        let mut check = |section, cut: Option<bool>| {
            if cut == Some(true) {
                truncated.push(section);
            }
        };
        check(
            InventorySection::Users,
            self.users.as_ref().map(InventoryList::is_truncated),
        );
        check(
            InventorySection::Groups,
            self.groups.as_ref().map(InventoryList::is_truncated),
        );
        check(
            InventorySection::Services,
            self.services.as_ref().map(InventoryList::is_truncated),
        );
        check(
            InventorySection::ListeningPorts,
            self.listening_ports
                .as_ref()
                .map(InventoryList::is_truncated),
        );
        check(
            InventorySection::Hotfixes,
            self.hotfixes.as_ref().map(InventoryList::is_truncated),
        );
        check(
            InventorySection::Containers,
            self.containers.as_ref().map(InventoryList::is_truncated),
        );
        truncated
    }
}

/// Answer to an upload of the system inventory.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct SystemInventoryResponse {
    /// The platform could not apply the sections sent (it holds no
    /// inventory of the agent to complete): the next upload is the whole
    /// inventory.
    #[serde(default)]
    pub full_snapshot_required: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn user(name: &str, id: &str) -> InventoryUserPayload {
        InventoryUserPayload {
            name: name.to_string(),
            id: id.to_string(),
            group_id: None,
            home: Some(format!("/home/{name}")),
            shell: Some("/bin/bash".to_string()),
            can_log_in: true,
            privileged: false,
        }
    }

    fn service(name: &str, command: &str) -> InventoryServicePayload {
        InventoryServicePayload {
            name: name.to_string(),
            state: "enabled".to_string(),
            command: Some(command.to_string()),
        }
    }

    fn parts() -> SystemInventoryParts {
        SystemInventoryParts {
            collected_at: "2026-10-16T09:00:00Z".parse().unwrap(),
            system: Some(InventorySystemPayload {
                hostname: Some("web-01".to_string()),
                os_name: Some("Ubuntu 24.04.1 LTS".to_string()),
                kernel: Some("6.8.0-45-generic".to_string()),
                memory_bytes: Some(16 * (1 << 30) - 200 * (1 << 20)),
                booted_at: Some("2026-10-15T07:00:00Z".parse().unwrap()),
                ..Default::default()
            }),
            users: vec![user("root", "0"), user("alice", "1000")],
            groups: vec![InventoryGroupPayload {
                name: "sudo".to_string(),
                id: Some("27".to_string()),
                members: vec!["alice".to_string()],
                members_total: 0,
                privileged: true,
            }],
            services: vec![service("ssh.service", "/usr/sbin/sshd -D")],
            listening_ports: vec![InventoryPortPayload {
                protocol: "tcp".to_string(),
                address: "0.0.0.0".to_string(),
                port: 22,
                process: Some("sshd".to_string()),
                local_only: false,
            }],
            hotfixes: Vec::new(),
            containers: vec![InventoryContainerPayload {
                engine: "docker".to_string(),
                id: "0123456789ab".to_string(),
                name: "proxy".to_string(),
                image: "nginx:1.27".to_string(),
                state: "running".to_string(),
                user: Some("root".to_string()),
                risks: vec!["engine_socket".to_string()],
                can_take_host: true,
            }],
        }
    }

    #[test]
    fn a_full_upload_carries_every_section_as_the_platform_reads_it() {
        let upload = SystemInventoryUpload::full(parts());
        let wire = serde_json::to_value(&upload).unwrap();
        assert_eq!(wire["collected_at"], "2026-10-16T09:00:00Z");
        assert_eq!(wire["full"], true);
        assert_eq!(wire["system"]["hostname"], "web-01");
        // What the system did not say is left out, not sent as null.
        assert!(wire["system"].get("serial_number").is_none());
        assert_eq!(
            wire["users"],
            json!({"items": [
                {"name": "root", "id": "0", "home": "/home/root", "shell": "/bin/bash", "can_log_in": true, "privileged": false},
                {"name": "alice", "id": "1000", "home": "/home/alice", "shell": "/bin/bash", "can_log_in": true, "privileged": false}
            ], "total": 2})
        );
        assert_eq!(
            wire["groups"]["items"][0],
            json!({"name": "sudo", "id": "27", "members": ["alice"], "members_total": 1, "privileged": true})
        );
        assert_eq!(
            wire["listening_ports"]["items"][0],
            json!({"protocol": "tcp", "address": "0.0.0.0", "port": 22, "process": "sshd", "local_only": false})
        );
        // An empty section is sent: it empties what the platform holds.
        assert_eq!(wire["hotfixes"], json!({"items": [], "total": 0}));
        assert_eq!(
            wire["containers"]["items"][0]["risks"],
            json!(["engine_socket"])
        );
        assert_eq!(upload.sections().len(), InventorySection::ALL.len());
        let names: Vec<&str> = InventorySection::ALL.iter().map(|s| s.name()).collect();
        for name in names {
            assert!(wire.get(name).is_some(), "{name} missing");
        }
        // And it reads back as it was sent.
        let back: SystemInventoryUpload = serde_json::from_value(wire).unwrap();
        assert_eq!(back, upload);
    }

    #[test]
    fn an_upload_of_what_changed_leaves_the_other_sections_out() {
        let upload = SystemInventoryUpload::full(parts());
        let changed = BTreeSet::from([InventorySection::Users, InventorySection::ListeningPorts]);
        let partial = upload.only(&changed);
        let wire = serde_json::to_value(&partial).unwrap();
        assert_eq!(wire["full"], false);
        assert_eq!(wire["users"]["total"], 2);
        assert_eq!(wire["listening_ports"]["total"], 1);
        for absent in ["system", "groups", "services", "hotfixes", "containers"] {
            assert!(wire.get(absent).is_none(), "{absent} sent");
        }
        assert_eq!(partial.sections(), changed);
    }

    #[test]
    fn texts_are_cut_as_javascript_counts_them() {
        assert_eq!(clip("abc", 2), "ab");
        assert_eq!(clip("abc", 5), "abc");
        // `é` is one unit, `𝄞` two: never half a character.
        assert_eq!(clip("é𝄞x", 2), "é");
        assert_eq!(clip("é𝄞x", 3), "é𝄞");

        let long = "x".repeat(5_000);
        let mut parts = parts();
        parts.services = vec![service(&long, &long)];
        parts.users[0].name = "é".repeat(400);
        let upload = SystemInventoryUpload::full(parts);
        let service = &upload.services.as_ref().unwrap().items[0];
        assert_eq!(service.name.len(), MAX_TEXT);
        assert_eq!(
            service.command.as_deref().map(str::len),
            Some(MAX_LONG_TEXT)
        );
        let name = &upload.users.as_ref().unwrap().items[0].name;
        assert_eq!(name.encode_utf16().count(), MAX_TEXT);
    }

    #[test]
    fn a_crowded_group_lists_its_first_members_and_says_how_many() {
        let group = InventoryGroupPayload {
            name: "users".to_string(),
            id: None,
            members: (0..MAX_GROUP_MEMBERS + 20)
                .map(|n| format!("user{n}"))
                .collect(),
            members_total: 0,
            privileged: false,
        }
        .bounded();
        assert_eq!(group.members.len(), MAX_GROUP_MEMBERS);
        assert_eq!(group.members_total, MAX_GROUP_MEMBERS + 20);
        // Bounding twice changes nothing.
        assert_eq!(group.clone().bounded(), group);
    }

    #[test]
    fn a_section_too_large_keeps_what_fits_and_says_it_was_cut() {
        // Services with a command of the longest kept: about 1 KiB each.
        let services: Vec<InventoryServicePayload> = (0..2_000)
            .map(|n| service(&format!("unit{n:04}.service"), &"c".repeat(2_000)))
            .collect();
        let list = InventoryList::fitted(services);
        assert_eq!(list.total, 2_000);
        assert!(list.is_truncated());
        assert!(list.items.len() > 400 && list.items.len() < 2_000);
        // The first entries, in their order.
        assert_eq!(list.items[0].name, "unit0000.service");
        assert_eq!(list.items[1].name, "unit0001.service");
        assert!(serde_json::to_vec(&list).unwrap().len() <= MAX_SECTION_BYTES);

        let mut parts = parts();
        parts.services = (0..2_000)
            .map(|n| service(&format!("unit{n}"), &"c".repeat(2_000)))
            .collect();
        let upload = SystemInventoryUpload::full(parts);
        assert_eq!(upload.truncated_sections(), [InventorySection::Services]);
    }

    #[test]
    fn a_section_of_many_small_entries_stops_at_the_entry_limit() {
        let ports: Vec<InventoryPortPayload> = (0..MAX_ITEMS_PER_SECTION + 1)
            .map(|n| InventoryPortPayload {
                protocol: "udp".to_string(),
                address: "0.0.0.0".to_string(),
                port: u16::try_from(n % 65_536).unwrap(),
                process: None,
                local_only: false,
            })
            .collect();
        let list = InventoryList::fitted(ports);
        assert_eq!(list.items.len(), MAX_ITEMS_PER_SECTION);
        assert_eq!(list.total, MAX_ITEMS_PER_SECTION + 1);
    }

    #[test]
    fn the_largest_upload_fits_the_platform_request() {
        // Every section at its byte limit: under the 5 MB of the platform.
        let mut parts = parts();
        parts.users = (0..MAX_ITEMS_PER_SECTION)
            .map(|n| InventoryUserPayload {
                home: Some("h".repeat(MAX_TEXT)),
                shell: Some("s".repeat(MAX_TEXT)),
                ..user(&format!("{n:0>255}"), &n.to_string())
            })
            .collect();
        parts.groups = (0..50)
            .map(|n| InventoryGroupPayload {
                name: format!("group{n}"),
                id: None,
                members: (0..MAX_GROUP_MEMBERS)
                    .map(|m| format!("{m:0>200}"))
                    .collect(),
                members_total: 0,
                privileged: false,
            })
            .collect();
        parts.services = (0..MAX_ITEMS_PER_SECTION)
            .map(|n| service(&format!("{n:0>255}"), &"c".repeat(MAX_LONG_TEXT)))
            .collect();
        parts.listening_ports = (0..MAX_ITEMS_PER_SECTION)
            .map(|n| InventoryPortPayload {
                protocol: "tcp".to_string(),
                address: "a".repeat(MAX_SHORT_TEXT),
                port: 1,
                process: Some(format!("{n:0>255}")),
                local_only: false,
            })
            .collect();
        parts.hotfixes = (0..MAX_ITEMS_PER_SECTION)
            .map(|n| InventoryHotfixPayload {
                id: format!("KB{n:0>126}"),
                description: Some("d".repeat(MAX_TEXT)),
                installed_on: Some("2026-10-08".to_string()),
            })
            .collect();
        parts.containers = (0..MAX_ITEMS_PER_SECTION)
            .map(|n| InventoryContainerPayload {
                engine: "docker".to_string(),
                id: format!("{n:0>12}"),
                name: "n".repeat(MAX_TEXT),
                image: "i".repeat(MAX_TEXT),
                state: "running".to_string(),
                user: Some("u".repeat(MAX_TEXT)),
                risks: vec!["privileged".to_string(), "host_root".to_string()],
                can_take_host: true,
            })
            .collect();
        let upload = SystemInventoryUpload::full(parts);
        let body = serde_json::to_vec(&upload).unwrap();
        assert!(body.len() < 5_000_000, "{} bytes", body.len());
        for section in [
            serde_json::to_vec(&upload.users).unwrap(),
            serde_json::to_vec(&upload.groups).unwrap(),
            serde_json::to_vec(&upload.services).unwrap(),
            serde_json::to_vec(&upload.listening_ports).unwrap(),
            serde_json::to_vec(&upload.hotfixes).unwrap(),
            serde_json::to_vec(&upload.containers).unwrap(),
        ] {
            assert!(section.len() <= MAX_SECTION_BYTES);
        }
    }

    #[test]
    fn a_section_keeps_its_fingerprint_until_it_changes() {
        let first = SystemInventoryUpload::full(parts());
        let same = SystemInventoryUpload::full(SystemInventoryParts {
            collected_at: "2026-10-16T09:10:00Z".parse().unwrap(),
            ..parts()
        });
        // Taken ten minutes later, nothing changed.
        assert_eq!(first.fingerprints(), same.fingerprints());

        let mut more = parts();
        more.users.push(user("backup", "1001"));
        let more = SystemInventoryUpload::full(more);
        let differs: Vec<InventorySection> = InventorySection::ALL
            .into_iter()
            .filter(|section| first.fingerprints()[section] != more.fingerprints()[section])
            .collect();
        assert_eq!(differs, [InventorySection::Users]);
    }

    #[test]
    fn the_start_time_and_megabytes_of_memory_do_not_change_the_system() {
        let first = SystemInventoryUpload::full(parts());
        let mut moved = parts();
        let system = moved.system.as_mut().unwrap();
        system.booted_at = Some("2026-10-15T07:00:01Z".parse().unwrap());
        system.memory_bytes = Some(16 * (1 << 30) - 180 * (1 << 20));
        let moved = SystemInventoryUpload::full(moved);
        assert_eq!(first.fingerprints(), moved.fingerprints());

        let mut upgraded = parts();
        upgraded.system.as_mut().unwrap().memory_bytes = Some(32 * (1 << 30));
        let upgraded = SystemInventoryUpload::full(upgraded);
        assert_ne!(
            first.fingerprints()[&InventorySection::System],
            upgraded.fingerprints()[&InventorySection::System]
        );
    }

    #[test]
    fn the_answer_may_ask_for_the_whole_inventory() {
        let asked: SystemInventoryResponse =
            serde_json::from_value(json!({"full_snapshot_required": true, "stored": 3})).unwrap();
        assert!(asked.full_snapshot_required);
        let plain: SystemInventoryResponse =
            serde_json::from_value(json!({"received_sections": 2})).unwrap();
        assert!(!plain.full_snapshot_required);
    }
}
