// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The Windows registry keys a program uses to start by itself.
//!
//! On Windows, what runs at start-up, at logon or inside every process is
//! decided by a handful of registry values. Malware that wants to survive a
//! restart writes one of them. They are read at every security scan and
//! compared with what they held before: a value added or changed is
//! reported.
//!
//! | Location                                              | What it does                               |
//! |-------------------------------------------------------|--------------------------------------------|
//! | `…\CurrentVersion\Run`, `RunOnce` (machine and users) | programs started at logon                  |
//! | `…\Policies\Explorer\Run`                             | programs started at logon, by policy       |
//! | `…\Winlogon` (`Shell`, `Userinit`, `Taskman`)         | the session's shell and its initialisation |
//! | `…\Windows` (`AppInit_DLLs`, `LoadAppInit_DLLs`)      | libraries loaded into every process        |
//! | `…\Control\Lsa` (authentication, notification, security packages) | libraries loaded by the logon service |
//! | `…\Session Manager` (`BootExecute`), `AppCertDlls`    | programs run before the session starts     |
//! | `…\Image File Execution Options\*` (`Debugger`)       | a program run in place of another          |
//! | `exefile\shell\open\command`                          | what runs when any program is started      |
//!
//! The first reading is the reference. Removals are not reported.
//!
//! # Limits, stated plainly
//!
//! - The registry is read at intervals with `reg query`: a value written and
//!   removed between two readings is not seen.
//! - Services are not read here: the system inventory follows them, with
//!   their command.
//! - This has not been run on Windows: the reading of `reg query` output is
//!   tested on examples of it.

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tracing::{debug, info, warn};

/// Values read at most from one key.
const MAX_VALUES_PER_KEY: usize = 500;
/// Changes reported at most by one reading.
const MAX_CHANGES_PER_READING: usize = 25;

const RUN: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
const RUN_ONCE: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce";
const IFEO: &str =
    r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options";

/// A registry location read, and what a change in it means.
struct Watched {
    key: &'static str,
    /// The values read; empty for every value of the key.
    values: &'static [&'static str],
    what: &'static str,
    technique: &'static str,
    severity: IncidentSeverity,
}

const WATCHED: &[Watched] = &[
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        values: &[],
        what: "a program started at every logon",
        technique: "T1547.001",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
        values: &[],
        what: "a program started at the next logon",
        technique: "T1547.001",
        severity: IncidentSeverity::Medium,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        values: &[],
        what: "a program started at every logon",
        technique: "T1547.001",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce",
        values: &[],
        what: "a program started at the next logon",
        technique: "T1547.001",
        severity: IncidentSeverity::Medium,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run",
        values: &[],
        what: "a program started at every logon, by policy",
        technique: "T1547.001",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
        values: &["Shell", "Userinit", "Taskman"],
        what: "the program that opens the session",
        technique: "T1547.004",
        severity: IncidentSeverity::Critical,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows",
        values: &["AppInit_DLLs", "LoadAppInit_DLLs"],
        what: "a library loaded into every process",
        technique: "T1546.010",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Lsa",
        values: &[
            "Authentication Packages",
            "Notification Packages",
            "Security Packages",
        ],
        what: "a library loaded by the logon service",
        technique: "T1547.002",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager",
        values: &["BootExecute"],
        what: "a program run before the session starts",
        technique: "T1547.001",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\AppCertDlls",
        values: &[],
        what: "a library loaded into every process that starts another",
        technique: "T1546.009",
        severity: IncidentSeverity::High,
    },
    Watched {
        key: r"HKEY_LOCAL_MACHINE\SOFTWARE\Classes\exefile\shell\open\command",
        values: &[],
        what: "what runs when any program is started",
        technique: "T1546.001",
        severity: IncidentSeverity::Critical,
    },
];

/// What a value of the registry is known by: its key and its name.
fn entry(key: &str, value: &str) -> String {
    format!("{key}\\{value}")
}

/// How the registry is read. A trait so that the comparison is tested
/// against a registry described in the test.
pub trait RegistryReader: Send + Sync {
    /// Names and data of the values of a key; `None` when the key does not
    /// exist or cannot be read.
    fn values(&self, key: &str) -> Option<Vec<(String, String)>>;
    /// The sub-keys of `key` holding a value `name`, with its data.
    fn subkeys_with_value(&self, key: &str, name: &str) -> Vec<(String, String)>;
    /// The security identifiers of the user hives loaded.
    fn user_sids(&self) -> Vec<String>;
}

/// The values of every watched location: `KEY\name` to data.
pub fn snapshot(reader: &dyn RegistryReader) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    let mut read = |key: &str, wanted: &[&str]| {
        let Some(found) = reader.values(key) else {
            return;
        };
        for (name, data) in found.into_iter().take(MAX_VALUES_PER_KEY) {
            if wanted.is_empty() || wanted.iter().any(|w| w.eq_ignore_ascii_case(&name)) {
                values.insert(entry(key, &name), data);
            }
        }
    };
    for watched in WATCHED {
        read(watched.key, watched.values);
    }
    for sid in reader.user_sids() {
        read(&format!(r"HKEY_USERS\{sid}\{RUN}"), &[]);
        read(&format!(r"HKEY_USERS\{sid}\{RUN_ONCE}"), &[]);
    }
    for (subkey, data) in reader
        .subkeys_with_value(IFEO, "Debugger")
        .into_iter()
        .take(MAX_VALUES_PER_KEY)
    {
        values.insert(entry(&subkey, "Debugger"), data);
    }
    values
}

/// A value added or changed in a watched location.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistryChange {
    /// `KEY\name`.
    pub entry: String,
    /// The data before, `None` when the value did not exist.
    pub before: Option<String>,
    pub after: String,
}

/// What a change in a location means, by the location.
fn meaning(entry: &str) -> (&'static str, &'static str, IncidentSeverity) {
    let upper = entry.to_ascii_uppercase();
    if upper.starts_with(&IFEO.to_ascii_uppercase()) {
        return (
            "a program run in place of another",
            "T1546.012",
            IncidentSeverity::High,
        );
    }
    if upper.starts_with("HKEY_USERS\\") {
        let once = upper.contains("\\RUNONCE\\");
        return (
            if once {
                "a program started at the next logon of a user"
            } else {
                "a program started at every logon of a user"
            },
            "T1547.001",
            if once {
                IncidentSeverity::Medium
            } else {
                IncidentSeverity::High
            },
        );
    }
    WATCHED
        .iter()
        // The longest key first: `Session Manager\AppCertDlls` before
        // `Session Manager`.
        .filter(|watched| upper.starts_with(&format!("{}\\", watched.key.to_ascii_uppercase())))
        .max_by_key(|watched| watched.key.len())
        .map_or(
            ("a start-up location", "T1547", IncidentSeverity::Medium),
            |watched| (watched.what, watched.technique, watched.severity),
        )
}

impl RegistryChange {
    /// The incident the change is reported as.
    pub fn incident(&self) -> SecurityIncident {
        let (what, technique, severity) = meaning(&self.entry);
        let (title, description) = match &self.before {
            None => (
                format!("Registry start-up value added: {}", self.entry),
                format!(
                    "{} was added with the data \"{}\". This location sets {}.",
                    self.entry, self.after, what
                ),
            ),
            Some(before) => (
                format!("Registry start-up value changed: {}", self.entry),
                format!(
                    "{} changed from \"{}\" to \"{}\". This location sets {}.",
                    self.entry, before, self.after, what
                ),
            ),
        };
        SecurityIncident::new(
            IncidentType::UnauthorizedChange,
            severity,
            title,
            description,
        )
        .with_confidence(75)
        .with_evidence(serde_json::json!({
            "detection": "registry",
            "entry": self.entry,
            "before": self.before,
            "after": self.after,
            "attack_techniques": [technique],
        }))
    }
}

/// The values added or changed between two readings.
pub fn changes(
    before: &BTreeMap<String, String>,
    after: &BTreeMap<String, String>,
) -> Vec<RegistryChange> {
    after
        .iter()
        .filter_map(|(entry, data)| match before.get(entry) {
            Some(previous) if previous == data => None,
            previous => Some(RegistryChange {
                entry: entry.clone(),
                before: previous.cloned(),
                after: data.clone(),
            }),
        })
        .collect()
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Saved {
    /// `None` until the first reading.
    #[serde(default)]
    values: Option<BTreeMap<String, String>>,
}

/// The watched locations, read at intervals.
pub struct RegistryMonitor {
    reader: Box<dyn RegistryReader>,
    state_path: PathBuf,
    saved: Mutex<Saved>,
}

impl RegistryMonitor {
    /// A monitor of the real registry keeping its reference in `state_path`.
    pub fn new(state_path: PathBuf) -> Self {
        Self::with_reader(Box::new(SystemRegistry), state_path)
    }

    pub fn with_reader(reader: Box<dyn RegistryReader>, state_path: PathBuf) -> Self {
        let saved = std::fs::read(&state_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            reader,
            state_path,
            saved: Mutex::new(saved),
        }
    }

    fn save(&self, saved: &Saved) {
        let write = || -> std::io::Result<()> {
            if let Some(parent) = self.state_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut tmp = self.state_path.as_os_str().to_owned();
            tmp.push(".tmp");
            let tmp = PathBuf::from(tmp);
            std::fs::write(&tmp, serde_json::to_vec(saved)?)?;
            std::fs::rename(&tmp, &self.state_path)
        };
        if let Err(e) = write() {
            warn!("Failed to save the registry reference: {}", e);
        }
    }

    /// Read the watched locations and return what was added or changed
    /// since the last reading. Blocking.
    pub fn check(&self) -> Vec<SecurityIncident> {
        let current = snapshot(self.reader.as_ref());
        let mut saved = self.saved.lock().unwrap_or_else(|e| e.into_inner());
        let found = match &saved.values {
            None => {
                info!(
                    "Registry start-up locations: {} values taken as the reference",
                    current.len()
                );
                Vec::new()
            }
            // Nothing read at all where there was something: the registry
            // could not be read, which is not every value being removed.
            Some(previous) if current.is_empty() && !previous.is_empty() => {
                debug!("Registry start-up locations could not be read");
                return Vec::new();
            }
            Some(previous) => changes(previous, &current),
        };
        if saved.values.as_ref() != Some(&current) {
            saved.values = Some(current);
            self.save(&saved);
        }
        if found.len() > MAX_CHANGES_PER_READING {
            warn!(
                "{} registry start-up values changed: only the first {} are reported",
                found.len(),
                MAX_CHANGES_PER_READING
            );
        }
        found
            .iter()
            .take(MAX_CHANGES_PER_READING)
            .map(RegistryChange::incident)
            .collect()
    }

    /// Where the reference is kept.
    pub fn state_path(&self) -> &Path {
        &self.state_path
    }
}

/// The values of every key of a `reg query … /s` output: the line of a key
/// starts at the margin, the lines of its values are indented under it.
pub fn parse_reg_query_tree(output: &str) -> Vec<(String, Vec<(String, String)>)> {
    let mut keys: Vec<(String, Vec<(String, String)>)> = Vec::new();
    for line in output.lines() {
        let line = line.trim_end();
        if line.starts_with("HKEY_") {
            keys.push((line.to_string(), Vec::new()));
        } else if line.starts_with("    ")
            && let Some((_, values)) = keys.last_mut()
        {
            values.extend(crate::checks::sca::parse_reg_query(line));
        }
    }
    keys
}

/// The registry of this system, read with `reg query`.
struct SystemRegistry;

impl SystemRegistry {
    fn query(arguments: &[&str]) -> Option<String> {
        if !cfg!(windows) {
            return None;
        }
        let output = agent_common::process::silent_command("reg")
            .arg("query")
            .args(arguments)
            .stdin(std::process::Stdio::null())
            .output()
            .ok()?;
        output
            .status
            .success()
            .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
    }
}

impl RegistryReader for SystemRegistry {
    fn values(&self, key: &str) -> Option<Vec<(String, String)>> {
        Self::query(&[key]).map(|output| crate::checks::sca::parse_reg_query(&output))
    }

    fn subkeys_with_value(&self, key: &str, name: &str) -> Vec<(String, String)> {
        Self::query(&[key, "/s", "/v", name])
            .map(|output| {
                parse_reg_query_tree(&output)
                    .into_iter()
                    .filter_map(|(subkey, values)| {
                        values
                            .into_iter()
                            .find(|(value, _)| value.eq_ignore_ascii_case(name))
                            .map(|(_, data)| (subkey, data))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn user_sids(&self) -> Vec<String> {
        Self::query(&["HKEY_USERS"])
            .map(|output| {
                output
                    .lines()
                    .filter_map(|line| line.trim().strip_prefix("HKEY_USERS\\"))
                    // The hives of people, not of the system accounts nor
                    // the class hives beside them.
                    .filter(|sid| sid.starts_with("S-1-5-21-") && !sid.ends_with("_Classes"))
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;

    const HKLM_RUN: &str = r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    const WINLOGON: &str =
        r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon";
    const USER: &str = "S-1-5-21-1111-2222-3333-1001";

    /// The values of each key: name and data.
    type Keys = HashMap<String, Vec<(String, String)>>;

    /// A registry described by the test, which the test can change.
    #[derive(Default, Clone)]
    struct FakeRegistry {
        keys: Arc<Mutex<Keys>>,
        readable: Arc<Mutex<bool>>,
    }

    impl FakeRegistry {
        fn new() -> Self {
            let registry = Self::default();
            *registry.readable.lock().unwrap() = true;
            registry.set(
                HKLM_RUN,
                "SecurityHealth",
                r"C:\Windows\System32\SecurityHealthSystray.exe",
            );
            registry.set(WINLOGON, "Shell", "explorer.exe");
            registry.set(WINLOGON, "Userinit", r"C:\Windows\system32\userinit.exe,");
            registry.set(WINLOGON, "CachedLogonsCount", "10");
            registry.set(
                &format!(r"HKEY_USERS\{USER}\{RUN}"),
                "OneDrive",
                "OneDrive.exe /background",
            );
            registry
        }

        fn set(&self, key: &str, name: &str, data: &str) {
            let mut keys = self.keys.lock().unwrap();
            let values = keys.entry(key.to_string()).or_default();
            values.retain(|(existing, _)| existing != name);
            values.push((name.to_string(), data.to_string()));
        }

        fn remove(&self, key: &str, name: &str) {
            if let Some(values) = self.keys.lock().unwrap().get_mut(key) {
                values.retain(|(existing, _)| existing != name);
            }
        }
    }

    impl RegistryReader for FakeRegistry {
        fn values(&self, key: &str) -> Option<Vec<(String, String)>> {
            if !*self.readable.lock().unwrap() {
                return None;
            }
            self.keys.lock().unwrap().get(key).cloned()
        }
        fn subkeys_with_value(&self, key: &str, name: &str) -> Vec<(String, String)> {
            if !*self.readable.lock().unwrap() {
                return Vec::new();
            }
            self.keys
                .lock()
                .unwrap()
                .iter()
                .filter(|(subkey, _)| subkey.starts_with(&format!("{key}\\")))
                .filter_map(|(subkey, values)| {
                    values
                        .iter()
                        .find(|(value, _)| value == name)
                        .map(|(_, data)| (subkey.clone(), data.clone()))
                })
                .collect()
        }
        fn user_sids(&self) -> Vec<String> {
            vec![USER.to_string()]
        }
    }

    fn monitor(registry: &FakeRegistry, dir: &tempfile::TempDir) -> RegistryMonitor {
        RegistryMonitor::with_reader(Box::new(registry.clone()), dir.path().join("registry.json"))
    }

    #[test]
    fn only_the_start_up_values_are_read() {
        let values = snapshot(&FakeRegistry::new());
        let mut entries: Vec<&str> = values.keys().map(String::as_str).collect();
        entries.sort_unstable();
        assert_eq!(entries.len(), 4, "{entries:?}");
        // Winlogon holds many values; only the ones that start a program count.
        assert!(!values.contains_key(&entry(WINLOGON, "CachedLogonsCount")));
        assert_eq!(values[&entry(WINLOGON, "Shell")], "explorer.exe");
        assert!(values.contains_key(&format!(r"HKEY_USERS\{USER}\{RUN}\OneDrive")));
    }

    #[test]
    fn the_first_reading_is_the_reference_and_what_is_added_after_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let registry = FakeRegistry::new();
        let monitor = monitor(&registry, &dir);
        assert!(monitor.check().is_empty());
        assert!(monitor.check().is_empty());

        registry.set(HKLM_RUN, "Updater", r"C:\Users\Public\update.exe -silent");
        registry.set(
            WINLOGON,
            "Shell",
            r"explorer.exe, C:\Users\Public\update.exe",
        );
        registry.set(
            &format!(r"{IFEO}\sethc.exe"),
            "Debugger",
            r"C:\Windows\System32\cmd.exe",
        );
        registry.set(
            &format!(r"HKEY_USERS\{USER}\{RUN_ONCE}"),
            "Setup",
            "setup.exe /resume",
        );
        registry.remove(HKLM_RUN, "SecurityHealth");

        let incidents = monitor.check();
        let mut found: Vec<(String, IncidentSeverity)> = incidents
            .iter()
            .map(|incident| (incident.title.clone(), incident.severity))
            .collect();
        found.sort_by(|a, b| a.0.cmp(&b.0));
        assert_eq!(found.len(), 4, "{found:?}");
        assert!(found[0].0.starts_with("Registry start-up value added: HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\sethc.exe\\Debugger"));
        assert_eq!(found[0].1, IncidentSeverity::High);
        assert!(found[1].0.ends_with(r"CurrentVersion\Run\Updater"));
        assert_eq!(found[1].1, IncidentSeverity::High);
        assert!(found[2].0.contains(r"RunOnce\Setup"));
        assert_eq!(found[2].1, IncidentSeverity::Medium);
        assert!(found[3].0.starts_with("Registry start-up value changed:"));
        assert_eq!(found[3].1, IncidentSeverity::Critical);

        let shell = incidents
            .iter()
            .find(|incident| incident.severity == IncidentSeverity::Critical)
            .unwrap();
        assert_eq!(shell.evidence["before"], "explorer.exe");
        assert_eq!(shell.evidence["attack_techniques"][0], "T1547.004");
        assert!(
            shell
                .description
                .contains("the program that opens the session")
        );
        // Reported once.
        assert!(monitor.check().is_empty());
    }

    #[test]
    fn the_reference_survives_a_restart() {
        let dir = tempfile::tempdir().unwrap();
        let registry = FakeRegistry::new();
        monitor(&registry, &dir).check();

        // Written while the agent was stopped.
        registry.set(HKLM_RUN, "Updater", r"C:\Users\Public\update.exe");
        let incidents = monitor(&registry, &dir).check();
        assert_eq!(incidents.len(), 1);
        assert!(incidents[0].title.ends_with(r"Run\Updater"));
    }

    #[test]
    fn a_registry_that_cannot_be_read_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let registry = FakeRegistry::new();
        let monitor = monitor(&registry, &dir);
        monitor.check();

        *registry.readable.lock().unwrap() = false;
        assert!(monitor.check().is_empty());
        *registry.readable.lock().unwrap() = true;
        // Nothing was forgotten meanwhile: no value looks new.
        assert!(monitor.check().is_empty());
    }

    #[test]
    fn a_change_means_what_its_location_does() {
        let of = |entry: &str| meaning(entry).0;
        assert_eq!(
            of(
                r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\AppCertDlls\x"
            ),
            "a library loaded into every process that starts another"
        );
        assert_eq!(
            of(r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\BootExecute"),
            "a program run before the session starts"
        );
        assert_eq!(
            of(r"hkey_local_machine\software\microsoft\windows\currentversion\run\x"),
            "a program started at every logon"
        );
        assert_eq!(
            of(&format!(r"HKEY_USERS\{USER}\{RUN}\x")),
            "a program started at every logon of a user"
        );
    }

    #[test]
    fn the_output_of_a_recursive_query_is_read_key_by_key() {
        let output = "\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\sethc.exe\r\n    Debugger    REG_SZ    C:\\Windows\\System32\\cmd.exe\r\n\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\utilman.exe\r\n    Debugger    REG_SZ    cmd.exe\r\n\r\nEnd of search: 2 match(es) found.\r\n";
        let keys = parse_reg_query_tree(output);
        assert_eq!(keys.len(), 2);
        assert!(keys[0].0.ends_with("sethc.exe"));
        assert_eq!(
            keys[0].1,
            [(
                "Debugger".to_string(),
                r"C:\Windows\System32\cmd.exe".to_string()
            )]
        );
        assert_eq!(keys[1].1[0].1, "cmd.exe");
    }
}
