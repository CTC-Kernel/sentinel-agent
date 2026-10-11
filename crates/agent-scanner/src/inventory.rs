// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Inventory of the system: accounts, groups, services, listening ports —
//! and what changes in it.
//!
//! Knowing what a machine holds answers the questions an incident raises:
//! which accounts exist, what starts by itself, what listens on the network.
//! Comparing two inventories answers a sharper one: what is new. An account
//! nobody created, a service installed overnight, a port that opened this
//! morning are what an intruder leaves behind to come back.
//!
//! | What            | Linux                               | macOS                                   | Windows                 |
//! |-----------------|-------------------------------------|-----------------------------------------|-------------------------|
//! | Accounts        | `/etc/passwd`                       | `dscacheutil -q user`                   | `Get-LocalUser`         |
//! | Groups          | `/etc/group`                        | `dscacheutil -q group`                  | `Get-LocalGroup`        |
//! | Services        | `systemctl list-unit-files`         | launch daemons and agents of `/Library` | `Win32_Service`         |
//! | Listening ports | `ss -lntup`                         | `lsof`, completed by `netstat`          | `Get-NetTCPConnection`  |
//!
//! # What is reported
//!
//! The first inventory is the reference: nothing in it is new. After that:
//!
//! | Change                                             | Reported as        |
//! |----------------------------------------------------|--------------------|
//! | Account created with the identifier of root        | critical incident  |
//! | Account whose identifier becomes that of root      | critical incident  |
//! | Account added to an administration group           | high incident      |
//! | Account created; account given a login shell       | medium incident    |
//! | Service installed, or its command changed          | medium incident    |
//! | Port listening on the network, not seen for a week | medium incident    |
//! | Anything else (removals, local ports, known ports) | recorded only      |
//!
//! # Limits, stated plainly
//!
//! - The inventory is taken at intervals: something created and removed
//!   between two inventories is not seen (the log rules and the file
//!   integrity monitor see it as it happens).
//! - On macOS the services are the launch items of `/Library`; those of the
//!   system volume and of user folders are not listed. An agent that is
//!   not root sees the listening ports of its own account only, unless it
//!   has the Local Network permission: since macOS 15, `netstat` answers
//!   nothing to a program without it.
//! - On Windows the collection is done through PowerShell.

use crate::security::{IncidentSeverity, IncidentType, SecurityIncident};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

/// Time during which a listening port already seen is not new again.
pub const PORT_MEMORY_DAYS: i64 = 7;
/// Entries of one kind kept at most.
const MAX_ENTRIES: usize = 5_000;

/// Groups whose members administer the machine, or as good as.
const PRIVILEGED_GROUPS: &[&str] = &[
    "sudo",
    "wheel",
    "admin",
    "root",
    "adm",
    "docker",
    "lxd",
    "libvirt",
    "shadow",
    "disk",
    "administrators",
    "administrateurs",
];

/// Shells that give no session.
const NO_LOGIN_SHELLS: &[&str] = &["nologin", "false", "sync", "halt", "shutdown"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserAccount {
    pub name: String,
    /// Numeric identifier (Unix), or security identifier (Windows).
    pub id: String,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub home: Option<String>,
    #[serde(default)]
    pub shell: Option<String>,
    /// Whether the account can open a session: a real shell on Unix, an
    /// enabled account on Windows.
    pub can_log_in: bool,
}

impl UserAccount {
    /// Whether the account has the identifier of root.
    pub fn is_root_equivalent(&self) -> bool {
        self.id == "0"
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GroupEntry {
    pub name: String,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub members: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServiceEntry {
    pub name: String,
    /// `enabled`, `disabled`, `static`… (systemd), `installed` (launchd),
    /// the start mode (Windows).
    pub state: String,
    /// What the service runs, when the system says it.
    #[serde(default)]
    pub command: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct ListeningPort {
    /// `tcp` or `udp`.
    pub protocol: String,
    pub address: String,
    pub port: u16,
    #[serde(default)]
    pub process: Option<String>,
}

impl ListeningPort {
    /// Whether the port only answers on the machine itself.
    pub fn is_local_only(&self) -> bool {
        let address = self.address.trim_matches(['[', ']']);
        address.starts_with("127.") || address == "::1" || address == "localhost"
    }

    /// What identifies the listener across restarts: the protocol, the port
    /// and the program, not the address it binds this time.
    fn key(&self) -> String {
        format!(
            "{}/{}/{}",
            self.protocol,
            self.port,
            self.process.as_deref().unwrap_or("?")
        )
    }
}

/// What the system holds at one moment.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct SystemInventory {
    #[serde(default)]
    pub collected_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub users: Vec<UserAccount>,
    #[serde(default)]
    pub groups: Vec<GroupEntry>,
    #[serde(default)]
    pub services: Vec<ServiceEntry>,
    #[serde(default)]
    pub listening_ports: Vec<ListeningPort>,
}

impl SystemInventory {
    /// Whether nothing at all was collected (every source failed).
    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
            && self.groups.is_empty()
            && self.services.is_empty()
            && self.listening_ports.is_empty()
    }
}

/// One difference between two inventories.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InventoryChange {
    UserAdded(UserAccount),
    UserRemoved(UserAccount),
    /// The identifier or the shell of an account changed.
    UserChanged {
        before: UserAccount,
        after: UserAccount,
    },
    GroupMemberAdded {
        group: String,
        member: String,
    },
    GroupMemberRemoved {
        group: String,
        member: String,
    },
    ServiceAdded(ServiceEntry),
    ServiceRemoved(ServiceEntry),
    ServiceChanged {
        before: ServiceEntry,
        after: ServiceEntry,
    },
    /// A listener that was not there; `known` when it was seen in the last
    /// days (a program that comes and goes).
    PortOpened {
        port: ListeningPort,
        known: bool,
    },
    PortClosed(ListeningPort),
}

fn is_privileged_group(name: &str) -> bool {
    PRIVILEGED_GROUPS.contains(&name.to_ascii_lowercase().as_str())
}

impl InventoryChange {
    /// The change in one sentence.
    pub fn describe(&self) -> String {
        match self {
            Self::UserAdded(user) => {
                format!("Account '{}' (id {}) was created", user.name, user.id)
            }
            Self::UserRemoved(user) => format!("Account '{}' was removed", user.name),
            Self::UserChanged { before, after } => format!(
                "Account '{}' changed: id {} -> {}, shell {} -> {}",
                after.name,
                before.id,
                after.id,
                before.shell.as_deref().unwrap_or("-"),
                after.shell.as_deref().unwrap_or("-")
            ),
            Self::GroupMemberAdded { group, member } => {
                format!("Account '{member}' was added to group '{group}'")
            }
            Self::GroupMemberRemoved { group, member } => {
                format!("Account '{member}' was removed from group '{group}'")
            }
            Self::ServiceAdded(service) => format!(
                "Service '{}' was installed ({}){}",
                service.name,
                service.state,
                service
                    .command
                    .as_ref()
                    .map_or_else(String::new, |command| format!(": {command}"))
            ),
            Self::ServiceRemoved(service) => format!("Service '{}' was removed", service.name),
            Self::ServiceChanged { before, after } => format!(
                "Service '{}' changed: {} -> {}{}",
                after.name,
                before.state,
                after.state,
                if before.command == after.command {
                    String::new()
                } else {
                    format!(
                        ", command {} -> {}",
                        before.command.as_deref().unwrap_or("-"),
                        after.command.as_deref().unwrap_or("-")
                    )
                }
            ),
            Self::PortOpened { port, .. } => format!(
                "Port {}/{} is now listening on {}{}",
                port.port,
                port.protocol,
                port.address,
                port.process
                    .as_ref()
                    .map_or_else(String::new, |process| format!(" ({process})"))
            ),
            Self::PortClosed(port) => {
                format!(
                    "Port {}/{} is no longer listening",
                    port.port, port.protocol
                )
            }
        }
    }

    /// Short name of the kind of change, for the evidence and the SIEM.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::UserAdded(_) => "user_added",
            Self::UserRemoved(_) => "user_removed",
            Self::UserChanged { .. } => "user_changed",
            Self::GroupMemberAdded { .. } => "group_member_added",
            Self::GroupMemberRemoved { .. } => "group_member_removed",
            Self::ServiceAdded(_) => "service_added",
            Self::ServiceRemoved(_) => "service_removed",
            Self::ServiceChanged { .. } => "service_changed",
            Self::PortOpened { .. } => "port_opened",
            Self::PortClosed(_) => "port_closed",
        }
    }

    /// The severity of the change when it is worth an incident.
    fn severity(&self) -> Option<IncidentSeverity> {
        match self {
            Self::UserAdded(user) if user.is_root_equivalent() => Some(IncidentSeverity::Critical),
            Self::UserAdded(_) => Some(IncidentSeverity::Medium),
            Self::UserChanged { before, after }
                if after.is_root_equivalent() && !before.is_root_equivalent() =>
            {
                Some(IncidentSeverity::Critical)
            }
            Self::UserChanged { before, after } if after.can_log_in && !before.can_log_in => {
                Some(IncidentSeverity::Medium)
            }
            Self::GroupMemberAdded { group, .. } if is_privileged_group(group) => {
                Some(IncidentSeverity::High)
            }
            Self::ServiceAdded(_) => Some(IncidentSeverity::Medium),
            Self::ServiceChanged { before, after } if before.command != after.command => {
                Some(IncidentSeverity::Medium)
            }
            Self::PortOpened { port, known } if !known && !port.is_local_only() => {
                Some(IncidentSeverity::Medium)
            }
            _ => None,
        }
    }

    /// The incident for a change that is worth one.
    pub fn incident(&self) -> Option<SecurityIncident> {
        let severity = self.severity()?;
        let (title, technique) = match self {
            Self::UserAdded(user) if user.is_root_equivalent() => (
                format!("Account created with the identifier of root: {}", user.name),
                "T1136.001",
            ),
            Self::UserAdded(user) => (format!("Account created: {}", user.name), "T1136.001"),
            Self::UserChanged { after, .. } if after.is_root_equivalent() => (
                format!("Account given the identifier of root: {}", after.name),
                "T1098",
            ),
            Self::UserChanged { after, .. } => (
                format!("Account given a login shell: {}", after.name),
                "T1098",
            ),
            Self::GroupMemberAdded { group, member } => (
                format!("Account added to an administration group: {member} in {group}"),
                "T1098",
            ),
            Self::ServiceAdded(service) => {
                (format!("Service installed: {}", service.name), "T1543")
            }
            Self::ServiceChanged { after, .. } => (
                format!("Command of a service changed: {}", after.name),
                "T1543",
            ),
            Self::PortOpened { port, .. } => (
                format!("New listening port: {}/{}", port.port, port.protocol),
                "T1571",
            ),
            _ => return None,
        };
        Some(
            SecurityIncident::new(
                IncidentType::UnauthorizedChange,
                severity,
                title,
                format!("{}.", self.describe()),
            )
            .with_confidence(70)
            .with_evidence(serde_json::json!({
                "detection": "inventory",
                "change": self.kind(),
                "attack_techniques": [technique],
                "detail": self.detail(),
            })),
        )
    }

    fn detail(&self) -> serde_json::Value {
        match self {
            Self::UserAdded(user) | Self::UserRemoved(user) => serde_json::json!(user),
            Self::UserChanged { before, after } => {
                serde_json::json!({ "before": before, "after": after })
            }
            Self::GroupMemberAdded { group, member }
            | Self::GroupMemberRemoved { group, member } => {
                serde_json::json!({ "group": group, "member": member })
            }
            Self::ServiceAdded(service) | Self::ServiceRemoved(service) => {
                serde_json::json!(service)
            }
            Self::ServiceChanged { before, after } => {
                serde_json::json!({ "before": before, "after": after })
            }
            Self::PortOpened { port, known } => serde_json::json!({ "port": port, "known": known }),
            Self::PortClosed(port) => serde_json::json!(port),
        }
    }
}

/// The differences between two inventories.
///
/// A kind of entry that `after` could not collect at all (its list is empty
/// while `before` had some) is skipped: a command that failed is not the
/// removal of every account.
pub fn diff(
    before: &SystemInventory,
    after: &SystemInventory,
    known_ports: &BTreeMap<String, DateTime<Utc>>,
) -> Vec<InventoryChange> {
    let mut changes = Vec::new();

    if !after.users.is_empty() || before.users.is_empty() {
        let old: BTreeMap<&str, &UserAccount> =
            before.users.iter().map(|u| (u.name.as_str(), u)).collect();
        let new: BTreeMap<&str, &UserAccount> =
            after.users.iter().map(|u| (u.name.as_str(), u)).collect();
        for (name, user) in &new {
            match old.get(name) {
                None => changes.push(InventoryChange::UserAdded((*user).clone())),
                Some(previous) if previous.id != user.id || previous.shell != user.shell => {
                    changes.push(InventoryChange::UserChanged {
                        before: (*previous).clone(),
                        after: (*user).clone(),
                    });
                }
                Some(_) => {}
            }
        }
        for (name, user) in &old {
            if !new.contains_key(name) {
                changes.push(InventoryChange::UserRemoved((*user).clone()));
            }
        }
    }

    if !after.groups.is_empty() || before.groups.is_empty() {
        let members = |inventory: &SystemInventory| -> BTreeSet<(String, String)> {
            inventory
                .groups
                .iter()
                .flat_map(|group| {
                    group
                        .members
                        .iter()
                        .map(|member| (group.name.clone(), member.clone()))
                })
                .collect()
        };
        let (old, new) = (members(before), members(after));
        for (group, member) in new.difference(&old) {
            changes.push(InventoryChange::GroupMemberAdded {
                group: group.clone(),
                member: member.clone(),
            });
        }
        for (group, member) in old.difference(&new) {
            changes.push(InventoryChange::GroupMemberRemoved {
                group: group.clone(),
                member: member.clone(),
            });
        }
    }

    if !after.services.is_empty() || before.services.is_empty() {
        let old: BTreeMap<&str, &ServiceEntry> = before
            .services
            .iter()
            .map(|s| (s.name.as_str(), s))
            .collect();
        let new: BTreeMap<&str, &ServiceEntry> = after
            .services
            .iter()
            .map(|s| (s.name.as_str(), s))
            .collect();
        for (name, service) in &new {
            match old.get(name) {
                None => changes.push(InventoryChange::ServiceAdded((*service).clone())),
                Some(previous) if *previous != *service => {
                    changes.push(InventoryChange::ServiceChanged {
                        before: (*previous).clone(),
                        after: (*service).clone(),
                    });
                }
                Some(_) => {}
            }
        }
        for (name, service) in &old {
            if !new.contains_key(name) {
                changes.push(InventoryChange::ServiceRemoved((*service).clone()));
            }
        }
    }

    if !after.listening_ports.is_empty() || before.listening_ports.is_empty() {
        let keys = |inventory: &SystemInventory| -> BTreeMap<String, ListeningPort> {
            inventory
                .listening_ports
                .iter()
                .map(|port| (port.key(), port.clone()))
                .collect()
        };
        let (old, new) = (keys(before), keys(after));
        for (key, port) in &new {
            if !old.contains_key(key) {
                changes.push(InventoryChange::PortOpened {
                    port: port.clone(),
                    known: known_ports.contains_key(key),
                });
            }
        }
        for (key, port) in &old {
            if !new.contains_key(key) {
                changes.push(InventoryChange::PortClosed(port.clone()));
            }
        }
    }
    changes
}

/// The inventory kept between two collections, and the listeners seen
/// recently.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct InventoryState {
    #[serde(default)]
    pub inventory: Option<SystemInventory>,
    /// Listeners seen, and when they were last seen.
    #[serde(default)]
    pub known_ports: BTreeMap<String, DateTime<Utc>>,
}

impl InventoryState {
    /// Read the state kept in `path` (empty when there is none).
    pub fn load(path: &Path) -> Self {
        std::fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    /// Write the state to `path`, readable by the agent only: the list of
    /// accounts and services of a machine is not for every account to read.
    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut tmp = path.as_os_str().to_owned();
        tmp.push(".tmp");
        let tmp = std::path::PathBuf::from(tmp);
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let bytes = serde_json::to_vec(self).map_err(std::io::Error::other)?;
        std::io::Write::write_all(&mut options.open(&tmp)?, &bytes)?;
        std::fs::rename(&tmp, path)
    }

    /// Record a new inventory and return what changed since the previous
    /// one. The first inventory is the reference: it changes nothing.
    pub fn update(&mut self, current: SystemInventory, now: DateTime<Utc>) -> Vec<InventoryChange> {
        let oldest = now - chrono::Duration::days(PORT_MEMORY_DAYS);
        self.known_ports.retain(|_, seen| *seen > oldest);
        let changes = match &self.inventory {
            Some(previous) => diff(previous, &current, &self.known_ports),
            None => Vec::new(),
        };
        for port in &current.listening_ports {
            self.known_ports.insert(port.key(), now);
        }
        // What could not be collected this time keeps its previous value, so
        // that the next collection is compared with something.
        let mut current = current;
        if let Some(previous) = &self.inventory {
            if current.users.is_empty() {
                current.users.clone_from(&previous.users);
            }
            if current.groups.is_empty() {
                current.groups.clone_from(&previous.groups);
            }
            if current.services.is_empty() {
                current.services.clone_from(&previous.services);
            }
            if current.listening_ports.is_empty() {
                current
                    .listening_ports
                    .clone_from(&previous.listening_ports);
            }
        }
        self.inventory = Some(current);
        changes
    }
}

fn can_log_in(shell: Option<&str>) -> bool {
    shell.is_some_and(|shell| {
        let name = shell.rsplit('/').next().unwrap_or(shell);
        !shell.trim().is_empty() && !NO_LOGIN_SHELLS.contains(&name)
    })
}

/// The accounts of `/etc/passwd`.
pub fn parse_passwd(content: &str) -> Vec<UserAccount> {
    content
        .lines()
        .filter(|line| !line.starts_with('#') && !line.starts_with('+'))
        .filter_map(|line| {
            let fields: Vec<&str> = line.split(':').collect();
            let (name, id) = (fields.first()?.trim(), fields.get(2)?.trim());
            if name.is_empty() || id.is_empty() {
                return None;
            }
            let field = |index: usize| {
                fields
                    .get(index)
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
            };
            let shell = field(6);
            Some(UserAccount {
                name: name.to_string(),
                id: id.to_string(),
                group_id: field(3),
                home: field(5),
                can_log_in: can_log_in(shell.as_deref()),
                shell,
            })
        })
        .take(MAX_ENTRIES)
        .collect()
}

/// The groups of `/etc/group`.
pub fn parse_group(content: &str) -> Vec<GroupEntry> {
    content
        .lines()
        .filter(|line| !line.starts_with('#') && !line.starts_with('+'))
        .filter_map(|line| {
            let fields: Vec<&str> = line.split(':').collect();
            let name = fields.first()?.trim();
            if name.is_empty() {
                return None;
            }
            Some(GroupEntry {
                name: name.to_string(),
                id: fields
                    .get(2)
                    .map(|id| id.trim().to_string())
                    .filter(|id| !id.is_empty()),
                members: fields
                    .get(3)
                    .map(|members| {
                        members
                            .split(',')
                            .map(str::trim)
                            .filter(|member| !member.is_empty())
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default(),
            })
        })
        .take(MAX_ENTRIES)
        .collect()
}

/// Records of `dscacheutil -q user|group`: `key: value` lines, a blank line
/// between two records.
fn dscache_records(output: &str) -> Vec<BTreeMap<String, String>> {
    let mut records = Vec::new();
    let mut record = BTreeMap::new();
    for line in output.lines().chain(std::iter::once("")) {
        if line.trim().is_empty() {
            if !record.is_empty() {
                records.push(std::mem::take(&mut record));
            }
            continue;
        }
        if let Some((key, value)) = line.split_once(':') {
            record.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    records
}

/// The accounts of `dscacheutil -q user`. The directory service answers
/// from several sources: an account listed twice is kept once.
pub fn parse_dscache_users(output: &str) -> Vec<UserAccount> {
    let mut seen = BTreeSet::new();
    dscache_records(output)
        .into_iter()
        .filter(|record| {
            record
                .get("name")
                .is_some_and(|name| seen.insert(name.clone()))
        })
        .filter_map(|record| {
            let shell = record.get("shell").filter(|s| !s.is_empty()).cloned();
            Some(UserAccount {
                name: record.get("name")?.clone(),
                id: record.get("uid")?.clone(),
                group_id: record.get("gid").cloned(),
                home: record.get("dir").filter(|d| !d.is_empty()).cloned(),
                can_log_in: can_log_in(shell.as_deref()),
                shell,
            })
        })
        .take(MAX_ENTRIES)
        .collect()
}

/// The groups of `dscacheutil -q group`. A group listed by several sources
/// is one group, with the members of all of them.
pub fn parse_dscache_groups(output: &str) -> Vec<GroupEntry> {
    let mut groups: BTreeMap<String, GroupEntry> = BTreeMap::new();
    for record in dscache_records(output) {
        let Some(name) = record.get("name") else {
            continue;
        };
        let group = groups.entry(name.clone()).or_insert_with(|| GroupEntry {
            name: name.clone(),
            id: record.get("gid").cloned(),
            members: Vec::new(),
        });
        let members = record
            .get("users")
            .into_iter()
            .flat_map(|users| users.split_whitespace());
        for member in members {
            if !group.members.iter().any(|known| known == member) {
                group.members.push(member.to_string());
            }
        }
    }
    groups.into_values().take(MAX_ENTRIES).collect()
}

/// The services of `systemctl list-unit-files --type=service --no-legend`:
/// `ssh.service enabled enabled`.
pub fn parse_systemctl_unit_files(output: &str) -> Vec<ServiceEntry> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let (unit, state) = (fields.next()?, fields.next()?);
            let name = unit.strip_suffix(".service")?;
            // A template (`getty@.service`) is not a service by itself.
            (!name.ends_with('@')).then(|| ServiceEntry {
                name: name.to_string(),
                state: state.to_string(),
                command: None,
            })
        })
        .take(MAX_ENTRIES)
        .collect()
}

/// The listeners of `ss -H -lntup`:
/// `tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=812,fd=3))`.
pub fn parse_ss_listeners(output: &str) -> Vec<ListeningPort> {
    let mut ports: BTreeSet<ListeningPort> = BTreeSet::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let (Some(protocol), Some(local)) = (fields.first(), fields.get(4)) else {
            continue;
        };
        if !matches!(*protocol, "tcp" | "udp") {
            continue;
        }
        let Some((address, port)) = local.rsplit_once(':') else {
            continue;
        };
        let Ok(port) = port.parse::<u16>() else {
            continue;
        };
        let process = line
            .split_once("users:((\"")
            .and_then(|(_, rest)| rest.split('"').next())
            .map(str::to_string);
        ports.insert(ListeningPort {
            protocol: (*protocol).to_string(),
            // `%lo` and the like name the interface, not the address.
            address: address.split('%').next().unwrap_or(address).to_string(),
            port,
            process,
        });
    }
    ports.into_iter().take(MAX_ENTRIES).collect()
}

/// The TCP listeners of `netstat -an -p tcp` (macOS):
/// `tcp4  0  0  127.0.0.1.631  *.*  LISTEN`.
pub fn parse_netstat_listeners(output: &str) -> Vec<ListeningPort> {
    let mut ports: BTreeSet<ListeningPort> = BTreeSet::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if !fields.first().is_some_and(|proto| proto.starts_with("tcp")) || !line.contains("LISTEN")
        {
            continue;
        }
        let Some((address, port)) = fields.get(3).and_then(|local| local.rsplit_once('.')) else {
            continue;
        };
        let Ok(port) = port.parse::<u16>() else {
            continue;
        };
        ports.insert(ListeningPort {
            protocol: "tcp".to_string(),
            address: address.to_string(),
            port,
            process: None,
        });
    }
    ports.into_iter().take(MAX_ENTRIES).collect()
}

/// The TCP listeners of `lsof -nP -iTCP -sTCP:LISTEN -F cn`: a `c` line
/// names the program, the `n` lines that follow are its sockets (`n*:22`,
/// `n127.0.0.1:631`, `n[::1]:631`).
pub fn parse_lsof_listeners(output: &str) -> Vec<ListeningPort> {
    let mut ports: BTreeSet<ListeningPort> = BTreeSet::new();
    let mut command: Option<String> = None;
    for line in output.lines() {
        if let Some(name) = line.strip_prefix('c') {
            command = Some(name.to_string());
        } else if let Some(socket) = line.strip_prefix('n')
            && let Some((address, port)) = socket.rsplit_once(':')
            && let Ok(port) = port.parse::<u16>()
        {
            ports.insert(ListeningPort {
                protocol: "tcp".to_string(),
                address: address.to_string(),
                port,
                process: command.clone(),
            });
        }
    }
    ports.into_iter().take(MAX_ENTRIES).collect()
}

/// The listeners of both sources: those `lsof` names with their program,
/// and those only `netstat` shows (the sockets of other accounts, which an
/// unprivileged agent may not inspect).
pub fn merge_listeners(
    named: Vec<ListeningPort>,
    unnamed: Vec<ListeningPort>,
) -> Vec<ListeningPort> {
    let known: BTreeSet<u16> = named.iter().map(|port| port.port).collect();
    let mut ports: BTreeSet<ListeningPort> = named.into_iter().collect();
    ports.extend(
        unnamed
            .into_iter()
            .filter(|port| !known.contains(&port.port)),
    );
    ports.into_iter().collect()
}

/// The command of a launch item, from its property list converted to JSON.
pub fn launch_item_command(plist_json: &str) -> Option<String> {
    let plist: serde_json::Value = serde_json::from_str(plist_json).ok()?;
    if let Some(arguments) = plist["ProgramArguments"].as_array() {
        let words: Vec<&str> = arguments.iter().filter_map(|a| a.as_str()).collect();
        if !words.is_empty() {
            return Some(words.join(" "));
        }
    }
    plist["Program"].as_str().map(str::to_string)
}

/// Local accounts, groups, services and listeners as PowerShell prints them
/// (see [`WINDOWS_INVENTORY_SCRIPT`]).
pub fn parse_windows_inventory(json: &str) -> SystemInventory {
    let Ok(document) = serde_json::from_str::<serde_json::Value>(json) else {
        return SystemInventory::default();
    };
    // PowerShell prints a single object where a list of one is meant.
    let items = |key: &str| -> Vec<serde_json::Value> {
        match &document[key] {
            serde_json::Value::Array(items) => items.clone(),
            serde_json::Value::Null => Vec::new(),
            single => vec![single.clone()],
        }
    };
    let text = |value: &serde_json::Value| -> Option<String> {
        match value {
            serde_json::Value::String(text) if !text.trim().is_empty() => Some(text.clone()),
            serde_json::Value::Number(number) => Some(number.to_string()),
            _ => None,
        }
    };
    SystemInventory {
        collected_at: None,
        users: items("Users")
            .iter()
            .filter_map(|user| {
                Some(UserAccount {
                    name: text(&user["Name"])?,
                    id: text(&user["SID"]).unwrap_or_default(),
                    group_id: None,
                    home: None,
                    shell: None,
                    can_log_in: user["Enabled"].as_bool().unwrap_or(false),
                })
            })
            .take(MAX_ENTRIES)
            .collect(),
        groups: items("Groups")
            .iter()
            .filter_map(|group| {
                Some(GroupEntry {
                    name: text(&group["Name"])?,
                    id: text(&group["SID"]),
                    members: match &group["Members"] {
                        serde_json::Value::Array(members) => {
                            members.iter().filter_map(&text).collect()
                        }
                        single => text(single).into_iter().collect(),
                    },
                })
            })
            .take(MAX_ENTRIES)
            .collect(),
        services: items("Services")
            .iter()
            .filter_map(|service| {
                Some(ServiceEntry {
                    name: text(&service["Name"])?,
                    state: text(&service["StartMode"]).unwrap_or_default(),
                    command: text(&service["PathName"]),
                })
            })
            .take(MAX_ENTRIES)
            .collect(),
        listening_ports: items("Ports")
            .iter()
            .filter_map(|port| {
                Some(ListeningPort {
                    protocol: "tcp".to_string(),
                    address: text(&port["Address"])?,
                    port: u16::try_from(port["Port"].as_u64()?).ok()?,
                    process: text(&port["Process"]),
                })
            })
            .collect::<BTreeSet<_>>()
            .into_iter()
            .take(MAX_ENTRIES)
            .collect(),
    }
}

/// Prints the local accounts, groups with their members, services and TCP
/// listeners as one JSON object.
pub const WINDOWS_INVENTORY_SCRIPT: &str = r#"$ErrorActionPreference = 'SilentlyContinue'
$users = @(Get-LocalUser | ForEach-Object { @{ Name = $_.Name; SID = $_.SID.Value; Enabled = [bool]$_.Enabled } })
$groups = @(Get-LocalGroup | ForEach-Object {
    $members = @(Get-LocalGroupMember -Group $_ | ForEach-Object { $_.Name })
    @{ Name = $_.Name; SID = $_.SID.Value; Members = $members }
})
$services = @(Get-CimInstance Win32_Service | ForEach-Object { @{ Name = $_.Name; StartMode = $_.StartMode; PathName = $_.PathName } })
$names = @{}
Get-Process | ForEach-Object { $names[[int]$_.Id] = $_.ProcessName }
$ports = @(Get-NetTCPConnection -State Listen | ForEach-Object {
    @{ Address = $_.LocalAddress; Port = [int]$_.LocalPort; Process = $names[[int]$_.OwningProcess] }
})
@{ Users = $users; Groups = $groups; Services = $services; Ports = $ports } | ConvertTo-Json -Depth 4 -Compress
"#;

#[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
fn run(program: &str, arguments: &[&str]) -> Option<String> {
    let output = agent_common::process::silent_command(program)
        .args(arguments)
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Take the inventory of this system. Blocking: files are read and system
/// tools are run. What cannot be collected is left empty.
pub fn collect() -> SystemInventory {
    let mut inventory = collect_platform();
    inventory.collected_at = Some(Utc::now());
    inventory.users.sort_by(|a, b| a.name.cmp(&b.name));
    inventory.groups.sort_by(|a, b| a.name.cmp(&b.name));
    inventory.services.sort_by(|a, b| a.name.cmp(&b.name));
    inventory.listening_ports.sort();
    inventory
}

#[cfg(target_os = "linux")]
fn collect_platform() -> SystemInventory {
    let read = |path: &str| std::fs::read_to_string(path).unwrap_or_default();
    SystemInventory {
        collected_at: None,
        users: parse_passwd(&read("/etc/passwd")),
        groups: parse_group(&read("/etc/group")),
        services: run(
            "systemctl",
            &[
                "list-unit-files",
                "--type=service",
                "--no-legend",
                "--no-pager",
            ],
        )
        .map(|output| parse_systemctl_unit_files(&output))
        .unwrap_or_default(),
        listening_ports: run("ss", &["-H", "-lntup"])
            .map(|output| parse_ss_listeners(&output))
            .unwrap_or_default(),
    }
}

#[cfg(target_os = "macos")]
fn collect_platform() -> SystemInventory {
    let mut services = Vec::new();
    for directory in ["/Library/LaunchDaemons", "/Library/LaunchAgents"] {
        let Ok(entries) = std::fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten().take(MAX_ENTRIES) {
            let path = entry.path();
            if path
                .extension()
                .is_none_or(|extension| extension != "plist")
            {
                continue;
            }
            let Some(name) = path.file_stem().map(|n| n.to_string_lossy().to_string()) else {
                continue;
            };
            let command = run(
                "/usr/bin/plutil",
                &["-convert", "json", "-o", "-", &path.to_string_lossy()],
            )
            .and_then(|json| launch_item_command(&json));
            services.push(ServiceEntry {
                name,
                state: "installed".to_string(),
                command,
            });
        }
    }
    // `netstat` lists the sockets of every account but, since macOS 15,
    // answers nothing to a program without the Local Network permission;
    // `lsof` always answers, for the processes the agent may inspect (all
    // of them when it runs as root).
    let named = run(
        "/usr/sbin/lsof",
        &["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "cn"],
    )
    .map(|output| parse_lsof_listeners(&output))
    .unwrap_or_default();
    let unnamed = run("/usr/sbin/netstat", &["-an", "-p", "tcp"])
        .map(|output| parse_netstat_listeners(&output))
        .unwrap_or_default();
    SystemInventory {
        collected_at: None,
        users: run("/usr/bin/dscacheutil", &["-q", "user"])
            .map(|output| parse_dscache_users(&output))
            .unwrap_or_default(),
        groups: run("/usr/bin/dscacheutil", &["-q", "group"])
            .map(|output| parse_dscache_groups(&output))
            .unwrap_or_default(),
        services,
        listening_ports: merge_listeners(named, unnamed),
    }
}

#[cfg(target_os = "windows")]
fn collect_platform() -> SystemInventory {
    run(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            WINDOWS_INVENTORY_SCRIPT,
        ],
    )
    .map(|json| parse_windows_inventory(&json))
    .unwrap_or_default()
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn collect_platform() -> SystemInventory {
    SystemInventory::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(name: &str, id: &str, shell: &str) -> UserAccount {
        UserAccount {
            name: name.to_string(),
            id: id.to_string(),
            group_id: None,
            home: None,
            shell: Some(shell.to_string()),
            can_log_in: can_log_in(Some(shell)),
        }
    }

    fn service(name: &str, command: &str) -> ServiceEntry {
        ServiceEntry {
            name: name.to_string(),
            state: "enabled".to_string(),
            command: Some(command.to_string()),
        }
    }

    fn port(port: u16, address: &str, process: &str) -> ListeningPort {
        ListeningPort {
            protocol: "tcp".to_string(),
            address: address.to_string(),
            port,
            process: Some(process.to_string()),
        }
    }

    fn group(name: &str, members: &[&str]) -> GroupEntry {
        GroupEntry {
            name: name.to_string(),
            id: None,
            members: members.iter().map(|m| (*m).to_string()).collect(),
        }
    }

    fn baseline() -> SystemInventory {
        SystemInventory {
            collected_at: None,
            users: vec![
                user("root", "0", "/bin/bash"),
                user("alice", "1000", "/bin/bash"),
                user("www-data", "33", "/usr/sbin/nologin"),
            ],
            groups: vec![group("sudo", &["alice"]), group("audio", &[])],
            services: vec![service("ssh", "/usr/sbin/sshd -D")],
            listening_ports: vec![port(22, "0.0.0.0", "sshd")],
        }
    }

    fn at(day: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000 + day * 86_400, 0).unwrap()
    }

    fn severities(changes: &[InventoryChange]) -> Vec<(&'static str, Option<IncidentSeverity>)> {
        changes
            .iter()
            .map(|change| (change.kind(), change.incident().map(|i| i.severity)))
            .collect()
    }

    #[test]
    fn system_files_and_tool_outputs_are_read() {
        let users = parse_passwd(
            "root:x:0:0:root:/root:/bin/bash\n# comment\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n+::::::\nalice:x:1000:1000:Alice,,,:/home/alice:/bin/zsh\nbroken\n",
        );
        assert_eq!(users.len(), 3);
        assert_eq!(
            (
                users[0].name.as_str(),
                users[0].id.as_str(),
                users[0].can_log_in
            ),
            ("root", "0", true)
        );
        assert!(!users[1].can_log_in);
        assert_eq!(users[2].home.as_deref(), Some("/home/alice"));

        let groups = parse_group("root:x:0:\nsudo:x:27:alice,bob\n");
        assert_eq!(groups[1].members, ["alice", "bob"]);
        assert!(groups[0].members.is_empty());

        let ds_users = parse_dscache_users(
            "name: _www\npassword: *\nuid: 70\ngid: 70\ndir: /Library/WebServer\nshell: /usr/bin/false\ngecos: World Wide Web Server\n\nname: thibault\npassword: ********\nuid: 501\ngid: 20\ndir: /Users/thibault\nshell: /bin/zsh\ngecos: Thibault\n",
        );
        assert_eq!(ds_users.len(), 2);
        assert!(!ds_users[0].can_log_in && ds_users[1].can_log_in);
        assert_eq!(ds_users[1].id, "501");
        let ds_groups = parse_dscache_groups(
            "name: admin\npassword: *\ngid: 80\nusers: root thibault\n\nname: staff\npassword: *\ngid: 20\n\nname: admin\npassword: *\ngid: 80\nusers: root _mbsetupuser\n",
        );
        assert_eq!(ds_groups.len(), 2);
        assert_eq!(ds_groups[0].members, ["root", "thibault", "_mbsetupuser"]);
        assert!(ds_groups[1].members.is_empty());
        // The directory service answers twice for some accounts.
        let twice = parse_dscache_users(
            "name: root\nuid: 0\nshell: /bin/sh\n\nname: root\nuid: 0\nshell: /bin/sh\n",
        );
        assert_eq!(twice.len(), 1);

        let services = parse_systemctl_unit_files(
            "ssh.service                 enabled         enabled\ngetty@.service              enabled         enabled\ncron.service                enabled         enabled\nboot.mount                  generated       -\nrescue.service              static          -\n",
        );
        let names: Vec<&str> = services.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["ssh", "cron", "rescue"]);
        assert_eq!(services[2].state, "static");

        let listeners = parse_ss_listeners(
            "udp   UNCONN 0      0      127.0.0.53%lo:53        0.0.0.0:*    users:((\"systemd-resolve\",pid=612,fd=13))\n\
             tcp   LISTEN 0      4096         0.0.0.0:22        0.0.0.0:*    users:((\"sshd\",pid=812,fd=3))\n\
             tcp   LISTEN 0      511             [::]:80           [::]:*    users:((\"nginx\",pid=900,fd=6),(\"nginx\",pid=901,fd=6))\n\
             tcp   LISTEN 0      128        127.0.0.1:6010      0.0.0.0:*\n",
        );
        assert_eq!(listeners.len(), 4);
        let ssh = listeners.iter().find(|p| p.port == 22).unwrap();
        assert_eq!(
            (ssh.address.as_str(), ssh.process.as_deref()),
            ("0.0.0.0", Some("sshd"))
        );
        let dns = listeners.iter().find(|p| p.port == 53).unwrap();
        assert_eq!(
            (dns.protocol.as_str(), dns.address.as_str()),
            ("udp", "127.0.0.53")
        );
        assert!(dns.is_local_only());
        assert_eq!(
            listeners.iter().find(|p| p.port == 80).unwrap().address,
            "[::]"
        );
        assert_eq!(
            listeners.iter().find(|p| p.port == 6010).unwrap().process,
            None
        );

        // As a Mac prints them (read from a real machine).
        let named = parse_lsof_listeners(
            "p651\ncrapportd\nf11\nn*:49152\nf13\nn*:49152\np670\ncControlCenter\nf9\nn*:7000\nn[::1]:7001\n",
        );
        assert_eq!(named.len(), 3);
        let control = named.iter().find(|p| p.port == 7000).unwrap();
        assert_eq!(
            (control.address.as_str(), control.process.as_deref()),
            ("*", Some("ControlCenter"))
        );
        assert!(
            named
                .iter()
                .find(|p| p.port == 7001)
                .unwrap()
                .is_local_only()
        );
        let unnamed = parse_netstat_listeners(
            "Active Internet connections (including servers)\n\
             tcp4       0      0  127.0.0.1.631          *.*                    LISTEN\n\
             tcp46      0      0  *.7000                 *.*                    LISTEN\n\
             tcp4       0      0  192.168.1.20.52000     203.0.113.9.443        ESTABLISHED\n",
        );
        assert_eq!(unnamed.len(), 2);
        assert!(
            unnamed
                .iter()
                .find(|p| p.port == 631)
                .unwrap()
                .is_local_only()
        );
        // A port both sources list is kept once, with its program; a port
        // only `netstat` lists (another account's) is kept without one.
        let merged = merge_listeners(named, unnamed);
        assert_eq!(merged.len(), 4);
        assert_eq!(merged.iter().filter(|p| p.port == 7000).count(), 1);
        assert_eq!(merged.iter().find(|p| p.port == 631).unwrap().process, None);

        assert_eq!(
            launch_item_command(
                r#"{"Label":"x","ProgramArguments":["/usr/local/bin/tool","--daemon"]}"#
            )
            .as_deref(),
            Some("/usr/local/bin/tool --daemon")
        );
        assert_eq!(
            launch_item_command(r#"{"Label":"x","Program":"/opt/x"}"#).as_deref(),
            Some("/opt/x")
        );
        assert_eq!(launch_item_command(r#"{"Label":"x"}"#), None);
    }

    #[test]
    fn windows_output_is_read_including_single_objects() {
        let inventory = parse_windows_inventory(
            r#"{"Users":[{"Name":"Administrator","SID":"S-1-5-21-1-500","Enabled":false},{"Name":"bob","SID":"S-1-5-21-1-1001","Enabled":true}],
                "Groups":{"Name":"Administrators","SID":"S-1-5-32-544","Members":"PC\\bob"},
                "Services":[{"Name":"Spooler","StartMode":"Auto","PathName":"C:\\Windows\\System32\\spoolsv.exe"}],
                "Ports":[{"Address":"0.0.0.0","Port":445,"Process":"System"},{"Address":"0.0.0.0","Port":445,"Process":"System"}]}"#,
        );
        assert_eq!(inventory.users.len(), 2);
        assert!(!inventory.users[0].can_log_in && inventory.users[1].can_log_in);
        assert_eq!(inventory.groups[0].members, ["PC\\bob"]);
        assert_eq!(
            inventory.services[0].command.as_deref(),
            Some("C:\\Windows\\System32\\spoolsv.exe")
        );
        assert_eq!(inventory.listening_ports.len(), 1);
        assert!(parse_windows_inventory("not json").is_empty());
    }

    #[test]
    fn the_first_inventory_is_the_reference() {
        let mut state = InventoryState::default();
        assert!(state.update(baseline(), at(0)).is_empty());
        assert!(state.update(baseline(), at(0)).is_empty());
        assert_eq!(state.known_ports.len(), 1);
    }

    #[test]
    fn what_an_intruder_leaves_behind_is_reported() {
        let mut state = InventoryState::default();
        state.update(baseline(), at(0));

        let mut after = baseline();
        after.users.push(user("backup", "1001", "/bin/bash"));
        after.users.push(user("toor", "0", "/bin/bash"));
        after.users[2] = user("www-data", "33", "/bin/bash");
        after.groups[0] = group("sudo", &["alice", "backup"]);
        after.groups[1] = group("audio", &["alice"]);
        after
            .services
            .push(service("update-helper", "/tmp/.x --daemon"));
        after.services[0] = service("ssh", "/usr/local/sbin/sshd -D");
        after
            .listening_ports
            .push(port(31337, "0.0.0.0", "update-helper"));
        after
            .listening_ports
            .push(port(9000, "127.0.0.1", "php-fpm"));

        let changes = state.update(after, at(0));
        let mut found = severities(&changes);
        found.sort_by_key(|(kind, severity)| (*kind, severity.map(|s| format!("{s}"))));
        use IncidentSeverity::{Critical, High, Medium};
        assert_eq!(
            found,
            [
                ("group_member_added", None),       // alice in audio
                ("group_member_added", Some(High)), // backup in sudo
                ("port_opened", None),              // 9000 on the loopback
                ("port_opened", Some(Medium)),      // 31337 on every address
                ("service_added", Some(Medium)),
                ("service_changed", Some(Medium)), // the command of ssh
                ("user_added", Some(Critical)),    // toor, identifier 0
                ("user_added", Some(Medium)),      // backup
                ("user_changed", Some(Medium)),    // www-data given a shell
            ]
        );
        let toor = changes
            .iter()
            .filter_map(InventoryChange::incident)
            .find(|incident| incident.severity == Critical)
            .unwrap();
        assert!(toor.title.contains("toor"));
        assert_eq!(toor.evidence["detection"], "inventory");
        assert_eq!(toor.evidence["detail"]["id"], "0");
    }

    #[test]
    fn removals_are_recorded_not_raised() {
        let mut state = InventoryState::default();
        state.update(baseline(), at(0));
        let mut after = baseline();
        after.users.retain(|user| user.name != "alice");
        after.groups[0] = group("sudo", &[]);
        after.services.clear();
        after.services.push(service("cron", "/usr/sbin/cron -f"));
        after.listening_ports = vec![port(80, "127.0.0.1", "nginx")];
        let changes = state.update(after, at(0));
        let kinds: Vec<&str> = changes.iter().map(InventoryChange::kind).collect();
        for kind in [
            "user_removed",
            "group_member_removed",
            "service_removed",
            "port_closed",
        ] {
            assert!(kinds.contains(&kind), "{kind} in {kinds:?}");
        }
        assert!(
            changes
                .iter()
                .filter(|change| !matches!(change, InventoryChange::ServiceAdded(_)))
                .all(|change| change.incident().is_none())
        );
    }

    #[test]
    fn a_program_that_comes_and_goes_is_new_once_a_week() {
        let mut state = InventoryState::default();
        state.update(baseline(), at(0));
        let mut with_server = baseline();
        with_server
            .listening_ports
            .push(port(3000, "0.0.0.0", "node"));

        let opened = |changes: &[InventoryChange]| -> Vec<bool> {
            changes
                .iter()
                .filter_map(|change| match change {
                    InventoryChange::PortOpened { known, .. } => Some(*known),
                    _ => None,
                })
                .collect()
        };
        // First time: new, and raised.
        let first = state.update(with_server.clone(), at(0));
        assert_eq!(opened(&first), [false]);
        assert!(first[0].incident().is_some());
        // Stopped, started again the next day: seen before, recorded only.
        state.update(baseline(), at(0));
        let again = state.update(with_server.clone(), at(1));
        assert_eq!(opened(&again), [true]);
        assert!(again[0].incident().is_none());
        // Not seen for more than a week: new again.
        state.update(baseline(), at(1));
        let later = state.update(with_server, at(1 + PORT_MEMORY_DAYS + 1));
        assert_eq!(opened(&later), [false]);
    }

    /// A tool that fails gives an empty list: that is not the removal of
    /// every account, and the previous list is kept for the next comparison.
    #[test]
    fn a_source_that_fails_removes_nothing() {
        let mut state = InventoryState::default();
        state.update(baseline(), at(0));
        let mut failed = baseline();
        failed.users.clear();
        failed.services.clear();
        assert!(state.update(failed, at(0)).is_empty());
        assert_eq!(state.inventory.as_ref().unwrap().users.len(), 3);

        let mut after = baseline();
        after.users.push(user("backup", "1001", "/bin/bash"));
        let changes = state.update(after, at(0));
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind(), "user_added");
    }

    #[test]
    fn the_state_survives_a_restart_and_is_private() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state").join("inventory.json");
        let mut state = InventoryState::default();
        state.update(baseline(), at(0));
        state.save(&path).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }

        let mut restarted = InventoryState::load(&path);
        assert_eq!(restarted.inventory, Some(baseline()));
        let mut after = baseline();
        after.users.push(user("backup", "1001", "/bin/bash"));
        assert_eq!(restarted.update(after, at(0)).len(), 1);
        assert!(
            InventoryState::load(&dir.path().join("absent.json"))
                .inventory
                .is_none()
        );
    }

    /// The real system: it has at least the account running the tests.
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn the_real_system_has_accounts_and_groups() {
        let inventory = collect();
        assert!(inventory.collected_at.is_some());
        assert!(inventory.users.iter().any(|user| user.name == "root"));
        assert!(!inventory.groups.is_empty());
        let names: Vec<&String> = inventory.users.iter().map(|user| &user.name).collect();
        let mut sorted = names.clone();
        sorted.sort();
        assert_eq!(names, sorted);
    }
}
