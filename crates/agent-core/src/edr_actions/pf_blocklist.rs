// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! IP blocklist on macOS, enforced by pf.
//!
//! Every blocked address is one rule of the anchor
//! `com.apple/sentinel-blocklist`. The anchor is rewritten as a whole from the
//! blocklist recorded in the agent's data directory, so unblocking one address
//! leaves the others in force, and a restart can load the rules again (pf rules
//! do not survive a reboot).
//!
//! pf is enabled with a reference token (`pfctl -E`) that is released
//! (`pfctl -X`) once nothing is blocked any more: rules loaded while pf is
//! disabled filter nothing.
//!
//! The rules and the `pfctl` arguments are built by pure functions and `pfctl`
//! is reached through [`Pfctl`], so all of this is unit-tested without root, on
//! any development machine.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;
use tracing::{debug, warn};

/// pf anchor holding the block rules. macOS' default ruleset evaluates every
/// anchor under `com.apple/`, so `/etc/pf.conf` is left untouched; rules in a
/// top-level anchor would be loaded but never evaluated.
pub(super) const PF_ANCHOR: &str = "com.apple/sentinel-blocklist";

/// The blocklist in force, as recorded on disk.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub(super) struct Blocklist {
    /// Addresses dropped by the anchor.
    #[serde(default)]
    pub blocked: BTreeSet<IpAddr>,
    /// Token returned when enabling pf, needed to release that enable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pf_token: Option<String>,
}

// ── Rules and pfctl arguments ───────────────────────────────────────────────

/// pf rules of the blocklist anchor: one per blocked address.
///
/// `quick` ends the evaluation on a match. Without it pf applies the last
/// matching rule, so a `pass` in an anchor evaluated later would let the
/// address through.
pub(super) fn pf_rules(blocked: &BTreeSet<IpAddr>) -> String {
    let mut rules =
        String::from("# Sentinel GRC - blocked IP addresses. Managed by the agent, do not edit.\n");
    for ip in blocked {
        rules.push_str(&format!("block drop quick from {ip} to any\n"));
    }
    rules
}

fn pfctl_args(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| (*arg).to_string()).collect()
}

/// Replace the rules of the anchor with those of `rules_file`.
pub(super) fn load_args(rules_file: &Path) -> Vec<String> {
    pfctl_args(&["-a", PF_ANCHOR, "-f", &rules_file.to_string_lossy()])
}

/// Empty the anchor. Other anchors are left alone.
pub(super) fn flush_args() -> Vec<String> {
    pfctl_args(&["-a", PF_ANCHOR, "-F", "all"])
}

/// Enable pf and take a reference on that enable.
pub(super) fn enable_args() -> Vec<String> {
    pfctl_args(&["-E"])
}

/// Release the reference `token`; pf is disabled once none is left.
pub(super) fn release_args(token: &str) -> Vec<String> {
    pfctl_args(&["-X", token])
}

/// Drop the states of connections from, then to, `ip`: a packet matching a
/// state is passed without evaluating the rules.
pub(super) fn kill_states_args(ip: IpAddr) -> [Vec<String>; 2] {
    let anywhere = if ip.is_ipv6() { "::/0" } else { "0.0.0.0/0" };
    let ip = ip.to_string();
    [
        pfctl_args(&["-k", &ip]),
        pfctl_args(&["-k", anywhere, "-k", &ip]),
    ]
}

/// Extract the reference token printed by `pfctl -E` (`Token : 1234`).
pub(super) fn pf_token(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (label, value) = line.split_once(':')?;
        let value = value.trim();
        (label.trim().eq_ignore_ascii_case("token")
            && !value.is_empty()
            && value.bytes().all(|b| b.is_ascii_digit()))
        .then(|| value.to_string())
    })
}

// ── pfctl ───────────────────────────────────────────────────────────────────

/// Runs `pfctl`. A trait so the sequence of commands is tested without root.
pub(super) trait Pfctl {
    /// Run `pfctl` with `args`. On failure, return what it printed.
    async fn run(&self, args: &[String]) -> Result<String, String>;
}

/// The system's `pfctl`.
#[cfg(target_os = "macos")]
pub(super) struct SystemPfctl;

#[cfg(target_os = "macos")]
impl Pfctl for SystemPfctl {
    async fn run(&self, args: &[String]) -> Result<String, String> {
        // Absolute path: the agent runs as root and must not pick up another
        // `pfctl` from the PATH it was started with.
        let output = agent_common::process::silent_async_command("/sbin/pfctl")
            .args(args)
            .output()
            .await
            .map_err(|e| format!("pfctl could not be started: {e}"))?;
        let printed = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        if output.status.success() {
            Ok(printed)
        } else {
            Err(format!(
                "pfctl {} failed: {}",
                args.join(" "),
                printed.trim()
            ))
        }
    }
}

// ── State on disk ───────────────────────────────────────────────────────────

/// Where the blocklist is recorded and its pf rules are written.
pub(super) struct Store {
    state: PathBuf,
    rules: PathBuf,
}

impl Store {
    pub(super) fn in_dir(dir: &Path) -> Self {
        Self {
            state: dir.join("ip_blocklist.json"),
            rules: dir.join("ip_blocklist.pf.conf"),
        }
    }

    /// The agent's data directory: unlike `/tmp`, other local users cannot
    /// create files in it.
    #[cfg(target_os = "macos")]
    pub(super) fn system() -> Self {
        Self::in_dir(&agent_common::config::AgentConfig::platform_data_dir())
    }

    async fn load(&self) -> Blocklist {
        match tokio::fs::read(&self.state).await {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|e| {
                warn!(
                    "Recorded IP blocklist is unreadable ({}); starting from an empty one",
                    e
                );
                Blocklist::default()
            }),
            Err(_) => Blocklist::default(),
        }
    }

    async fn save(&self, blocklist: &Blocklist) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(blocklist)
            .map_err(|e| format!("cannot serialize the IP blocklist: {e}"))?;
        write_private(&self.state, &json).await
    }
}

/// Write `contents` to `path`, readable by the agent only.
///
/// The data goes to a file created exclusively, which then replaces `path`:
/// a link planted at either name is replaced, never written through, and a
/// crash cannot leave a half-written file behind.
async fn write_private(path: &Path, contents: &[u8]) -> Result<(), String> {
    let failed = |e: std::io::Error| format!("cannot write {}: {e}", path.display());

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(failed)?;
    }
    let mut staging = path.as_os_str().to_owned();
    staging.push(".tmp");
    let staging = PathBuf::from(staging);
    // Left over from an interrupted write.
    let _ = tokio::fs::remove_file(&staging).await;

    let mut options = tokio::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options.open(&staging).await.map_err(failed)?;
    let written = async {
        file.write_all(contents).await?;
        file.flush().await?;
        drop(file);
        tokio::fs::rename(&staging, path).await
    }
    .await;
    if written.is_err() {
        let _ = tokio::fs::remove_file(&staging).await;
    }
    written.map_err(failed)
}

async fn remove_if_present(path: &Path) -> Result<(), String> {
    match tokio::fs::remove_file(path).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("cannot delete {}: {e}", path.display())),
    }
}

// ── Blocking and unblocking ─────────────────────────────────────────────────

/// Serializes the changes: each one reads the recorded blocklist, edits it and
/// rewrites the anchor from the result.
static CHANGES: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Block `ip`, in addition to the addresses already blocked.
pub(super) async fn block(pf: &impl Pfctl, store: &Store, ip: IpAddr) -> Result<(), String> {
    let _changes = CHANGES.lock().await;
    let current = store.load().await;
    let mut blocked = current.blocked.clone();
    blocked.insert(ip);
    apply(pf, store, &current, blocked).await?;

    // Connections opened before the rule was loaded keep their state.
    for args in kill_states_args(ip) {
        if let Err(e) = pf.run(&args).await {
            debug!("States of {} not dropped: {}", ip, e);
        }
    }
    Ok(())
}

/// Unblock `ip`, leaving the other blocked addresses in force. Does nothing
/// when the address is not blocked.
pub(super) async fn unblock(pf: &impl Pfctl, store: &Store, ip: IpAddr) -> Result<(), String> {
    let _changes = CHANGES.lock().await;
    let current = store.load().await;
    let mut blocked = current.blocked.clone();
    if !blocked.remove(&ip) {
        return Ok(());
    }
    apply(pf, store, &current, blocked).await
}

/// Load the recorded blocklist again after a restart: neither the rules nor
/// the pf reference survive a reboot. Returns the number of blocked addresses.
pub(super) async fn restore(pf: &impl Pfctl, store: &Store) -> Result<usize, String> {
    let _changes = CHANGES.lock().await;
    let current = store.load().await;
    let count = current.blocked.len();
    if count > 0 {
        let blocked = current.blocked.clone();
        apply(pf, store, &current, blocked).await?;
    }
    Ok(count)
}

/// Make pf enforce `blocked` and record it. On failure the `previous`
/// blocklist stays in force and on record.
async fn apply(
    pf: &impl Pfctl,
    store: &Store,
    previous: &Blocklist,
    blocked: BTreeSet<IpAddr>,
) -> Result<(), String> {
    if blocked.is_empty() {
        // Nothing is blocked any more: give the pf reference back.
        load_anchor(pf, store, &blocked).await?;
        release(pf, previous.pf_token.as_deref()).await;
        // A record left behind would block the addresses again at the next
        // start.
        return remove_if_present(&store.state).await;
    }

    // A reference is taken on every change rather than kept from the first
    // one: the recorded token may predate a reboot, after which pf is disabled
    // again. It is taken before the previous one is released, so pf stays
    // enabled throughout.
    let token = pf_token(&pf.run(&enable_args()).await?);
    if token.is_none() {
        warn!("pfctl -E returned no token: pf stays enabled until the next reboot");
    }
    let next = Blocklist {
        blocked,
        pf_token: token,
    };

    let applied = match load_anchor(pf, store, &next.blocked).await {
        Ok(()) => store.save(&next).await,
        Err(e) => Err(e),
    };
    if let Err(e) = applied {
        if let Err(undo) = load_anchor(pf, store, &previous.blocked).await {
            warn!("Previous IP blocklist not loaded back: {}", undo);
        }
        release(pf, next.pf_token.as_deref()).await;
        return Err(e);
    }

    release(pf, previous.pf_token.as_deref()).await;
    Ok(())
}

/// Replace the rules of the anchor with those blocking `blocked`.
async fn load_anchor(
    pf: &impl Pfctl,
    store: &Store,
    blocked: &BTreeSet<IpAddr>,
) -> Result<(), String> {
    if blocked.is_empty() {
        pf.run(&flush_args()).await?;
        let _ = tokio::fs::remove_file(&store.rules).await;
        return Ok(());
    }
    write_private(&store.rules, pf_rules(blocked).as_bytes()).await?;
    pf.run(&load_args(&store.rules)).await.map(drop)
}

/// Release a pf reference. A token that predates a reboot is refused, which
/// is harmless.
async fn release(pf: &impl Pfctl, token: Option<&str>) {
    if let Some(token) = token
        && let Err(e) = pf.run(&release_args(token)).await
    {
        debug!("pf reference not released: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(value: &str) -> IpAddr {
        value.parse().unwrap()
    }

    /// Records the `pfctl` invocations instead of running them.
    #[derive(Default)]
    struct FakePfctl {
        calls: std::sync::Mutex<Vec<String>>,
        /// Invocations carrying this argument fail.
        failing: Option<&'static str>,
        /// `-E` hands out `first_token`, then `first_token + 1`…
        first_token: u64,
    }

    impl FakePfctl {
        fn failing(argument: &'static str) -> Self {
            Self {
                failing: Some(argument),
                ..Self::default()
            }
        }

        fn calls(&self) -> Vec<String> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl Pfctl for FakePfctl {
        async fn run(&self, args: &[String]) -> Result<String, String> {
            let line = args.join(" ");
            let mut calls = self.calls.lock().unwrap();
            calls.push(line.clone());
            if self
                .failing
                .is_some_and(|argument| args.iter().any(|arg| arg == argument))
            {
                return Err(format!("pfctl {line} failed: Operation not permitted"));
            }
            if line == "-E" {
                let enables = calls.iter().filter(|call| *call == "-E").count() as u64;
                return Ok(format!(
                    "pf enabled\nToken : {}\n",
                    self.first_token + enables - 1
                ));
            }
            Ok(String::new())
        }
    }

    fn rule_lines(store: &Store) -> Vec<String> {
        std::fs::read_to_string(&store.rules)
            .unwrap()
            .lines()
            .filter(|line| !line.starts_with('#'))
            .map(str::to_string)
            .collect()
    }

    fn load_line(store: &Store) -> String {
        format!(
            "-a com.apple/sentinel-blocklist -f {}",
            store.rules.display()
        )
    }

    #[test]
    fn rules_drop_each_blocked_address_and_end_the_evaluation() {
        let blocked = BTreeSet::from([ip("2001:db8::10"), ip("203.0.113.7"), ip("198.51.100.4")]);
        let rules = pf_rules(&blocked);
        let lines: Vec<&str> = rules.lines().filter(|l| !l.starts_with('#')).collect();
        assert_eq!(
            lines,
            [
                "block drop quick from 198.51.100.4 to any",
                "block drop quick from 203.0.113.7 to any",
                "block drop quick from 2001:db8::10 to any",
            ]
        );
        assert!(
            rules.ends_with('\n'),
            "pfctl needs the last line terminated"
        );
    }

    /// Parse-only (`-n`): nothing is loaded, so no privilege is needed.
    #[cfg(target_os = "macos")]
    #[test]
    fn pfctl_accepts_the_generated_rules() {
        let dir = tempfile::tempdir().unwrap();
        let rules_file = dir.path().join("ip_blocklist.pf.conf");
        let blocked = BTreeSet::from([ip("203.0.113.7"), ip("2001:db8::10")]);
        std::fs::write(&rules_file, pf_rules(&blocked)).unwrap();

        let output = std::process::Command::new("/sbin/pfctl")
            .arg("-n")
            .args(load_args(&rules_file))
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "pfctl rejected the rules: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn anchor_sits_under_com_apple_so_the_default_ruleset_evaluates_it() {
        assert!(PF_ANCHOR.starts_with("com.apple/"));
        assert_eq!(
            load_args(Path::new("/data/ip_blocklist.pf.conf")),
            [
                "-a",
                "com.apple/sentinel-blocklist",
                "-f",
                "/data/ip_blocklist.pf.conf"
            ]
        );
        assert_eq!(
            flush_args(),
            ["-a", "com.apple/sentinel-blocklist", "-F", "all"]
        );
        assert_eq!(enable_args(), ["-E"]);
        assert_eq!(release_args("42"), ["-X", "42"]);
    }

    #[test]
    fn states_are_dropped_in_both_directions() {
        let [from, to] = kill_states_args(ip("203.0.113.7"));
        assert_eq!(from, ["-k", "203.0.113.7"]);
        assert_eq!(to, ["-k", "0.0.0.0/0", "-k", "203.0.113.7"]);

        let [from, to] = kill_states_args(ip("2001:db8::10"));
        assert_eq!(from, ["-k", "2001:db8::10"]);
        assert_eq!(to, ["-k", "::/0", "-k", "2001:db8::10"]);
    }

    #[test]
    fn pf_token_is_read_from_pfctl_output() {
        assert_eq!(
            pf_token("pf enabled\nToken : 12345678901234567890\n").as_deref(),
            Some("12345678901234567890")
        );
        assert_eq!(pf_token("pfctl: pf already enabled\n"), None);
        assert_eq!(pf_token("Token : not-a-number"), None);
    }

    #[tokio::test]
    async fn blocking_enables_pf_and_loads_the_anchor() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl {
            first_token: 100,
            ..FakePfctl::default()
        };

        block(&pf, &store, ip("203.0.113.7")).await.unwrap();

        assert_eq!(
            pf.calls(),
            [
                "-E".to_string(),
                load_line(&store),
                "-k 203.0.113.7".to_string(),
                "-k 0.0.0.0/0 -k 203.0.113.7".to_string(),
            ]
        );
        assert_eq!(
            rule_lines(&store),
            ["block drop quick from 203.0.113.7 to any"]
        );
        assert_eq!(
            store.load().await,
            Blocklist {
                blocked: BTreeSet::from([ip("203.0.113.7")]),
                pf_token: Some("100".to_string()),
            }
        );
    }

    #[tokio::test]
    async fn second_block_keeps_the_first_and_holds_a_single_pf_reference() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl {
            first_token: 100,
            ..FakePfctl::default()
        };

        block(&pf, &store, ip("203.0.113.7")).await.unwrap();
        block(&pf, &store, ip("198.51.100.4")).await.unwrap();

        assert_eq!(
            rule_lines(&store),
            [
                "block drop quick from 198.51.100.4 to any",
                "block drop quick from 203.0.113.7 to any",
            ]
        );
        // The new reference is taken before the previous one is released.
        let calls = pf.calls();
        let second_enable = calls.iter().rposition(|call| call == "-E").unwrap();
        let release = calls.iter().position(|call| call == "-X 100").unwrap();
        assert!(second_enable < release);
        assert_eq!(
            calls.iter().filter(|call| call.starts_with("-X")).count(),
            1
        );
        assert_eq!(store.load().await.pf_token.as_deref(), Some("101"));
    }

    #[tokio::test]
    async fn failed_load_is_an_error_and_leaves_nothing_behind() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl {
            first_token: 100,
            ..FakePfctl::failing("-f")
        };

        let error = block(&pf, &store, ip("203.0.113.7")).await.unwrap_err();

        assert!(error.contains("Operation not permitted"), "got: {error}");
        assert_eq!(store.load().await, Blocklist::default(), "nothing recorded");
        assert_eq!(
            pf.calls(),
            [
                "-E".to_string(),
                load_line(&store),
                "-a com.apple/sentinel-blocklist -F all".to_string(),
                "-X 100".to_string(),
            ],
            "the anchor is emptied and the pf reference given back"
        );
        assert!(!store.rules.exists());
    }

    #[tokio::test]
    async fn failed_load_keeps_the_previous_blocklist_in_force() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        block(
            &FakePfctl {
                first_token: 100,
                ..FakePfctl::default()
            },
            &store,
            ip("203.0.113.7"),
        )
        .await
        .unwrap();
        let recorded = store.load().await;

        let pf = FakePfctl {
            first_token: 200,
            ..FakePfctl::failing("-f")
        };
        block(&pf, &store, ip("198.51.100.4")).await.unwrap_err();

        assert_eq!(store.load().await, recorded);
        assert_eq!(
            rule_lines(&store),
            ["block drop quick from 203.0.113.7 to any"]
        );
        let calls = pf.calls();
        assert!(calls.contains(&"-X 200".to_string()), "new reference freed");
        assert!(
            !calls.contains(&"-X 100".to_string()),
            "the reference of the blocklist in force is kept"
        );
    }

    #[tokio::test]
    async fn failed_enable_is_an_error_before_any_rule_is_loaded() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl::failing("-E");

        let error = block(&pf, &store, ip("203.0.113.7")).await.unwrap_err();

        assert!(error.contains("pfctl -E failed"), "got: {error}");
        assert_eq!(pf.calls(), ["-E"]);
        assert!(!store.rules.exists());
        assert!(!store.state.exists());
    }

    #[tokio::test]
    async fn unblocking_one_address_leaves_the_others_blocked() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl::default();
        block(&pf, &store, ip("203.0.113.7")).await.unwrap();
        block(&pf, &store, ip("198.51.100.4")).await.unwrap();

        unblock(&pf, &store, ip("203.0.113.7")).await.unwrap();

        assert_eq!(
            rule_lines(&store),
            ["block drop quick from 198.51.100.4 to any"]
        );
        assert_eq!(
            store.load().await.blocked,
            BTreeSet::from([ip("198.51.100.4")])
        );
        assert!(
            !pf.calls().iter().any(|call| call.contains("-F")),
            "the anchor is reloaded, never flushed, while addresses remain"
        );
    }

    #[tokio::test]
    async fn unblocking_the_last_address_empties_the_anchor_and_releases_pf() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        block(
            &FakePfctl {
                first_token: 100,
                ..FakePfctl::default()
            },
            &store,
            ip("203.0.113.7"),
        )
        .await
        .unwrap();

        let pf = FakePfctl::default();
        unblock(&pf, &store, ip("203.0.113.7")).await.unwrap();

        assert_eq!(
            pf.calls(),
            ["-a com.apple/sentinel-blocklist -F all", "-X 100"]
        );
        assert!(!store.rules.exists());
        assert!(!store.state.exists());
    }

    #[tokio::test]
    async fn failed_unblock_is_an_error_and_stays_on_record() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        block(&FakePfctl::default(), &store, ip("203.0.113.7"))
            .await
            .unwrap();
        let recorded = store.load().await;

        let pf = FakePfctl::failing("-F");
        unblock(&pf, &store, ip("203.0.113.7")).await.unwrap_err();

        assert_eq!(store.load().await, recorded);
    }

    #[tokio::test]
    async fn unblocking_an_address_that_is_not_blocked_touches_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let pf = FakePfctl::default();
        block(&pf, &store, ip("203.0.113.7")).await.unwrap();
        let calls_before = pf.calls();

        unblock(&pf, &store, ip("198.51.100.4")).await.unwrap();

        assert_eq!(pf.calls(), calls_before);
    }

    #[tokio::test]
    async fn restart_loads_the_recorded_blocklist_again() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        assert_eq!(restore(&FakePfctl::default(), &store).await, Ok(0));

        block(
            &FakePfctl {
                first_token: 100,
                ..FakePfctl::default()
            },
            &store,
            ip("203.0.113.7"),
        )
        .await
        .unwrap();

        let pf = FakePfctl {
            first_token: 200,
            ..FakePfctl::default()
        };
        assert_eq!(restore(&pf, &store).await, Ok(1));
        assert_eq!(
            pf.calls(),
            ["-E".to_string(), load_line(&store), "-X 100".to_string()]
        );
        assert_eq!(store.load().await.pf_token.as_deref(), Some("200"));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn rule_file_is_not_written_through_a_planted_link() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::in_dir(dir.path());
        let victim = dir.path().join("victim");
        std::fs::write(&victim, "untouched").unwrap();
        std::os::unix::fs::symlink(&victim, &store.rules).unwrap();
        std::os::unix::fs::symlink(&victim, dir.path().join("ip_blocklist.pf.conf.tmp")).unwrap();

        block(&FakePfctl::default(), &store, ip("203.0.113.7"))
            .await
            .unwrap();

        assert_eq!(std::fs::read_to_string(&victim).unwrap(), "untouched");
        assert!(
            std::fs::symlink_metadata(&store.rules)
                .unwrap()
                .file_type()
                .is_file(),
            "the link is replaced by the rule file"
        );
        assert_eq!(
            rule_lines(&store),
            ["block drop quick from 203.0.113.7 to any"]
        );
    }
}
