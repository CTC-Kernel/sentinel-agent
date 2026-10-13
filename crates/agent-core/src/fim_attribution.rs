// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Who changed a file.
//!
//! The file system says that a file changed, not who changed it. Two things
//! can say it, and neither is always there:
//!
//! - **The system's own audit**, when it is set up for the file: an audit
//!   record on Linux (`auditctl -w /etc -p wa`), an object access event on
//!   Windows (event 4663, with an audit entry on the file). These name the
//!   account and the program: the answer is exact.
//! - **The programs seen starting**, when process starts are reported
//!   (`process_event_telemetry`): a program started in the minutes before
//!   the change with the file on its command line — `sed -i … /etc/hosts`,
//!   `chmod 4755 /usr/local/bin/tool` — is the probable author. A change
//!   made by a program that does not name the file (a shell redirection, an
//!   editor opened without argument) is not attributed.
//!
//! Without either, an alert says what changed and not who: nothing is
//! invented.

use agent_common::types::FimActor;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Time a program start stays a candidate for the changes that follow.
const PROCESS_WINDOW: Duration = Duration::from_secs(10 * 60);
/// Time an audit record stays attached to its file.
const AUDIT_WINDOW: Duration = Duration::from_secs(5 * 60);
/// Entries remembered at most of each kind.
const MAX_ENTRIES: usize = 2_000;
/// Shortest path a command line is searched for: `/a` would match anything.
const MIN_PATH_CHARS: usize = 6;

struct Seen {
    at: Instant,
    /// The file (audit), or the command line (process start).
    text: String,
    actor: FimActor,
}

/// What was recently seen that can say who changed a file.
#[derive(Default)]
pub(crate) struct Attribution {
    /// Audit records: the file each one is about, and who.
    audited: VecDeque<Seen>,
    /// Program starts: the command line, and who.
    started: VecDeque<Seen>,
}

fn push(queue: &mut VecDeque<Seen>, seen: Seen, window: Duration) {
    while queue
        .front()
        .is_some_and(|oldest| seen.at.duration_since(oldest.at) > window)
        || queue.len() >= MAX_ENTRIES
    {
        queue.pop_front();
    }
    queue.push_back(seen);
}

/// The spellings a path may have on a command line or in a record: macOS
/// resolves `/etc`, `/tmp` and `/var` under `/private`.
fn spellings(path: &str) -> Vec<String> {
    let mut spellings = vec![path.to_string()];
    if let Some(short) = path.strip_prefix("/private") {
        spellings.push(short.to_string());
    }
    spellings
}

/// Whether a command line names a path as a whole word: `/etc/hosts` is not
/// named by `/etc/hosts.bak`.
fn names_path(command: &str, path: &str) -> bool {
    command.match_indices(path).any(|(start, _)| {
        let after = command[start + path.len()..].chars().next();
        let before = command[..start].chars().next_back();
        let boundary = |c: Option<char>| {
            c.is_none_or(|c| c.is_whitespace() || matches!(c, '"' | '\'' | '=' | ':' | ',' | ';'))
        };
        boundary(after) && boundary(before)
    })
}

impl Attribution {
    /// An audit record or object access event naming who touched `path`.
    pub(crate) fn audited(&mut self, path: &str, actor: FimActor, now: Instant) {
        push(
            &mut self.audited,
            Seen {
                at: now,
                text: path.to_string(),
                actor,
            },
            AUDIT_WINDOW,
        );
    }

    /// A program that started.
    pub(crate) fn started(
        &mut self,
        pid: u32,
        name: &str,
        user: Option<&str>,
        command: &str,
        now: Instant,
    ) {
        if command.trim().is_empty() {
            return;
        }
        push(
            &mut self.started,
            Seen {
                at: now,
                text: command.to_string(),
                actor: FimActor {
                    user: user.map(str::to_string),
                    process: Some(name.to_string()),
                    pid: Some(pid),
                    command: Some(command.chars().take(512).collect()),
                    exact: false,
                    source: "process_start".to_string(),
                },
            },
            PROCESS_WINDOW,
        );
    }

    /// Who changed `path`: the most recent audit record about it, else the
    /// most recent program started with it on its command line.
    pub(crate) fn actor_for(&self, path: &str, now: Instant) -> Option<FimActor> {
        let spellings = spellings(path);
        let audited = self.audited.iter().rev().find(|seen| {
            now.duration_since(seen.at) <= AUDIT_WINDOW && spellings.contains(&seen.text)
        });
        if let Some(seen) = audited {
            return Some(seen.actor.clone());
        }
        if path.chars().count() < MIN_PATH_CHARS {
            return None;
        }
        self.started
            .iter()
            .rev()
            .find(|seen| {
                now.duration_since(seen.at) <= PROCESS_WINDOW
                    && spellings
                        .iter()
                        .any(|spelling| names_path(&seen.text, spelling))
            })
            .map(|seen| seen.actor.clone())
    }
}

/// Audit records of one event come as several lines sharing a number: the
/// system call says who (`exe`, `auid`), the path records say on what.
/// This keeps the halves until both are there.
#[derive(Default)]
pub(crate) struct AuditEvents {
    /// Event number to who made the call.
    callers: std::collections::HashMap<String, FimActor>,
    order: VecDeque<String>,
}

/// The account of an audit record: the login account when it is set (the
/// person behind a `sudo`), else the account the call ran as.
fn audit_user(fields: &std::collections::HashMap<String, String>) -> Option<String> {
    let unset = |id: &str| id == "4294967295" || id == "-1" || id.is_empty();
    ["auid", "uid"]
        .iter()
        .filter_map(|name| fields.get(*name))
        .find(|id| !unset(id))
        .map(|id| format!("uid {id}"))
}

impl AuditEvents {
    /// Read one decoded audit record. Returns the file and who touched it
    /// once a path record meets the call record of the same event.
    pub(crate) fn read(
        &mut self,
        fields: &std::collections::HashMap<String, String>,
    ) -> Option<(String, FimActor)> {
        let id = fields.get("audit_id")?;
        match fields.get("type").map(String::as_str) {
            Some("SYSCALL") => {
                let actor = FimActor {
                    user: audit_user(fields),
                    process: fields.get("exe").or_else(|| fields.get("comm")).cloned(),
                    pid: fields.get("pid").and_then(|pid| pid.parse().ok()),
                    command: None,
                    exact: true,
                    source: "audit".to_string(),
                };
                if self.callers.insert(id.clone(), actor).is_none() {
                    self.order.push_back(id.clone());
                }
                while self.order.len() > MAX_ENTRIES {
                    if let Some(oldest) = self.order.pop_front() {
                        self.callers.remove(&oldest);
                    }
                }
                None
            }
            Some("PATH") => {
                let name = fields.get("name").filter(|name| name.starts_with('/'))?;
                // The parent directory of a created or deleted file has its
                // own record: it is the file that is asked about.
                if fields.get("nametype").is_some_and(|kind| kind == "PARENT") {
                    return None;
                }
                let actor = self.callers.get(id)?.clone();
                Some((name.clone(), actor))
            }
            _ => None,
        }
    }
}

/// Who a Windows object access event (4663, 4656, 4660) says touched a file.
pub(crate) fn windows_object_access(
    fields: &std::collections::HashMap<String, String>,
) -> Option<(String, FimActor)> {
    if !matches!(
        fields.get("eventid").map(String::as_str),
        Some("4663" | "4656" | "4660")
    ) {
        return None;
    }
    let path = fields
        .get("objectname")
        .filter(|name| name.contains('\\') && !name.starts_with("\\REGISTRY"))?;
    let user = match (
        fields.get("subjectdomainname"),
        fields.get("subjectusername"),
    ) {
        (Some(domain), Some(user)) if !domain.is_empty() => Some(format!("{domain}\\{user}")),
        (_, Some(user)) => Some(user.clone()),
        _ => None,
    };
    Some((
        path.clone(),
        FimActor {
            user,
            process: fields.get("processname").cloned(),
            pid: fields
                .get("processid")
                .and_then(|pid| u32::from_str_radix(pid.trim_start_matches("0x"), 16).ok()),
            command: None,
            exact: true,
            source: "event_log".to_string(),
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn record(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect()
    }

    #[test]
    fn a_program_started_with_the_file_on_its_command_line_is_the_probable_author() {
        let mut attribution = Attribution::default();
        let start = Instant::now();
        attribution.started(100, "ls", Some("alice"), "ls -la /etc", start);
        attribution.started(4242, "sed", Some("root"), "sed -i s/a/b/ /etc/hosts", start);
        attribution.started(4300, "cat", Some("bob"), "cat /etc/hosts.bak", start);

        let actor = attribution
            .actor_for("/etc/hosts", start + Duration::from_secs(2))
            .unwrap();
        assert_eq!(actor.label(), "sed (root)");
        assert_eq!(actor.pid, Some(4242));
        assert!(!actor.exact);
        assert_eq!(actor.source, "process_start");

        // The resolved spelling macOS gives the file is the same file.
        assert!(
            attribution
                .actor_for("/private/etc/hosts", start + Duration::from_secs(2))
                .is_some()
        );
        // Another file, or the same one long after: nobody.
        assert!(attribution.actor_for("/etc/passwd", start).is_none());
        assert!(
            attribution
                .actor_for(
                    "/etc/hosts",
                    start + PROCESS_WINDOW + Duration::from_secs(1)
                )
                .is_none()
        );
        // A path too short to mean anything on a command line.
        attribution.started(1, "ls", None, "ls /etc", start);
        assert!(attribution.actor_for("/etc", start).is_none());
    }

    #[test]
    fn a_path_is_named_only_as_a_whole() {
        assert!(names_path("vim /etc/hosts", "/etc/hosts"));
        assert!(names_path("cp x '/etc/hosts'", "/etc/hosts"));
        assert!(names_path("tee --output=/etc/hosts", "/etc/hosts"));
        assert!(!names_path("vim /etc/hosts.bak", "/etc/hosts"));
        assert!(!names_path("vim /backup/etc/hosts", "/etc/hosts"));
    }

    #[test]
    fn the_audit_of_the_system_is_exact_and_comes_first() {
        let mut attribution = Attribution::default();
        let start = Instant::now();
        attribution.started(4242, "sed", Some("root"), "sed -i x /etc/hosts", start);
        attribution.audited(
            "/etc/hosts",
            FimActor {
                user: Some("uid 1000".to_string()),
                process: Some("/usr/bin/vim".to_string()),
                exact: true,
                source: "audit".to_string(),
                ..Default::default()
            },
            start,
        );
        let actor = attribution.actor_for("/etc/hosts", start).unwrap();
        assert!(actor.exact);
        assert_eq!(actor.label(), "/usr/bin/vim (uid 1000)");
        // The record is about that file only.
        assert!(attribution.actor_for("/etc/hostname", start).is_none());
    }

    #[test]
    fn the_two_halves_of_an_audit_event_are_put_together() {
        let mut events = AuditEvents::default();
        let call = record(&[
            ("type", "SYSCALL"),
            ("audit_id", "4567"),
            ("exe", "/usr/bin/vim"),
            ("comm", "vim"),
            ("pid", "812"),
            ("uid", "0"),
            ("auid", "1000"),
        ]);
        assert!(events.read(&call).is_none());
        // The directory of the file has its own record.
        let parent = record(&[
            ("type", "PATH"),
            ("audit_id", "4567"),
            ("name", "/etc/"),
            ("nametype", "PARENT"),
        ]);
        assert!(events.read(&parent).is_none());
        let path = record(&[
            ("type", "PATH"),
            ("audit_id", "4567"),
            ("name", "/etc/hosts"),
            ("nametype", "NORMAL"),
        ]);
        let (file, actor) = events.read(&path).unwrap();
        assert_eq!(file, "/etc/hosts");
        // The person who logged in, not the account sudo gave them.
        assert_eq!(actor.user.as_deref(), Some("uid 1000"));
        assert_eq!(actor.process.as_deref(), Some("/usr/bin/vim"));
        assert_eq!(actor.pid, Some(812));
        assert!(actor.exact);

        // A path record whose call was never seen says nothing; a daemon
        // has no login account.
        let orphan = record(&[("type", "PATH"), ("audit_id", "9"), ("name", "/etc/x")]);
        assert!(events.read(&orphan).is_none());
        let daemon = record(&[("uid", "0"), ("auid", "4294967295")]);
        assert_eq!(audit_user(&daemon).as_deref(), Some("uid 0"));
    }

    #[test]
    fn a_windows_object_access_event_names_the_file_and_who() {
        let event = record(&[
            ("eventid", "4663"),
            ("objectname", r"C:\Windows\System32\drivers\etc\hosts"),
            ("processname", r"C:\Windows\System32\notepad.exe"),
            ("processid", "0x1a2c"),
            ("subjectusername", "bob"),
            ("subjectdomainname", "PC-01"),
        ]);
        let (file, actor) = windows_object_access(&event).unwrap();
        assert_eq!(file, r"C:\Windows\System32\drivers\etc\hosts");
        assert_eq!(actor.user.as_deref(), Some(r"PC-01\bob"));
        assert_eq!(actor.pid, Some(0x1a2c));
        assert!(actor.exact);

        let registry = record(&[
            ("eventid", "4663"),
            ("objectname", r"\REGISTRY\MACHINE\SOFTWARE"),
        ]);
        assert!(windows_object_access(&registry).is_none());
        let logon = record(&[("eventid", "4624"), ("objectname", r"C:\x")]);
        assert!(windows_object_access(&logon).is_none());
    }

    #[test]
    fn what_is_remembered_is_bounded() {
        let mut attribution = Attribution::default();
        let start = Instant::now();
        for n in 0..MAX_ENTRIES + 500 {
            attribution.started(n as u32, "tool", None, &format!("tool /srv/file{n}"), start);
        }
        assert_eq!(attribution.started.len(), MAX_ENTRIES);
        assert!(attribution.actor_for("/srv/file0", start).is_none());
        assert!(
            attribution
                .actor_for(&format!("/srv/file{}", MAX_ENTRIES + 499), start)
                .is_some()
        );
    }
}
