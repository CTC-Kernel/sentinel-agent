// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Who changed a watched file, from the audit of the system (Linux,
//! `fim_whodata` option).
//!
//! The agent adds a watch rule to auditd for every watched path, under its
//! own key, and removes them when it stops. auditd then writes, for every
//! write or attribute change under those paths, the call that made it (the
//! account, the program, the process) and the path; the log analysis reads
//! them from auditd's log, and [`crate::fim_attribution`] pairs them with
//! the file changes that follow.
//!
//! # Limits, stated plainly
//!
//! - Linux only. On Windows the same answer needs an audit entry (SACL) on
//!   every watched directory and the object access policy; the agent does
//!   not set them up, and reads the events when an administrator did.
//! - The agent installs nothing: no auditd, no audit policy, no change to
//!   the backlog or the failure mode. When auditd does not run, nothing is
//!   added and the alerts keep the probable author, when there is one.
//! - A rule left by an agent that was killed stays until the next start of
//!   the agent (which finds it already there) or of the machine.

use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{debug, info, warn};

/// The key of the agent's rules: it tells them apart from the
/// administrator's, and their records from the others.
pub(crate) const AUDIT_KEY: &str = "sentinel_fim";

/// Where auditd writes its records.
pub(crate) const AUDIT_LOG: &str = "/var/log/audit/audit.log";

/// The arguments of `auditctl` that add (`-w`) or remove (`-W`) the watch of
/// `path` for writes and attribute changes.
fn watch_arguments(path: &Path, add: bool) -> Vec<String> {
    vec![
        if add { "-w" } else { "-W" }.to_string(),
        path.to_string_lossy().to_string(),
        "-p".to_string(),
        "wa".to_string(),
        "-k".to_string(),
        AUDIT_KEY.to_string(),
    ]
}

/// Whether `auditctl -s` describes an audit that is on and has a daemon
/// writing its records (`enabled 1` or `2`, `pid` not 0).
fn audit_collects(status: &str) -> bool {
    let value = |name: &str| {
        status.lines().find_map(|line| {
            let mut words = line.split_whitespace();
            (words.next() == Some(name))
                .then(|| words.next())
                .flatten()
                .and_then(|value| value.parse::<u64>().ok())
        })
    };
    matches!(value("enabled"), Some(1 | 2)) && value("pid").is_some_and(|pid| pid > 0)
}

/// Whether auditctl refused a rule because the same one is there already:
/// left by an agent that was stopped without removing its rules.
fn already_there(stderr: &str) -> bool {
    stderr.contains("Rule exists")
}

/// `auditctl`, where the distributions put it.
fn auditctl() -> Option<PathBuf> {
    ["/usr/sbin/auditctl", "/sbin/auditctl"]
        .iter()
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

/// The watch rules the agent added, removed when it stops.
pub(crate) struct AuditWatches {
    auditctl: PathBuf,
    watched: Vec<PathBuf>,
}

impl AuditWatches {
    /// Add a watch rule for each path of `paths` that exists. Returns why
    /// none could be added: no auditctl, no auditd, not root.
    pub(crate) fn install(paths: &[PathBuf]) -> Result<Self, String> {
        if !crate::service::is_admin() {
            return Err("the agent does not run as root".to_string());
        }
        let auditctl = auditctl().ok_or("auditctl is not installed (package auditd)")?;
        let status = Command::new(&auditctl)
            .arg("-s")
            .output()
            .map_err(|e| format!("auditctl -s: {e}"))?;
        // A container without the right to the kernel audit gets
        // "Operation not permitted" here.
        if !status.status.success() {
            return Err(format!(
                "auditctl -s: {}",
                String::from_utf8_lossy(&status.stderr).trim()
            ));
        }
        if !audit_collects(&String::from_utf8_lossy(&status.stdout)) {
            return Err("auditd is not running, or the audit is off".to_string());
        }
        let mut watched = Vec::new();
        for path in paths.iter().filter(|path| path.exists()) {
            match Command::new(&auditctl)
                .args(watch_arguments(path, true))
                .output()
            {
                Ok(output)
                    if output.status.success()
                        || already_there(&String::from_utf8_lossy(&output.stderr)) =>
                {
                    watched.push(path.clone());
                }
                Ok(output) => warn!(
                    "Audit watch on {} not added: {}",
                    path.display(),
                    String::from_utf8_lossy(&output.stderr).trim()
                ),
                Err(e) => warn!("Audit watch on {} not added: {}", path.display(), e),
            }
        }
        if watched.is_empty() {
            return Err("no watched path could be added to the audit".to_string());
        }
        info!(
            "FIM: the system audit names who changes {} watched path(s) (key {})",
            watched.len(),
            AUDIT_KEY
        );
        Ok(Self { auditctl, watched })
    }

    /// Remove the rules the agent added.
    pub(crate) fn remove(&self) {
        for path in &self.watched {
            match Command::new(&self.auditctl)
                .args(watch_arguments(path, false))
                .output()
            {
                Ok(output) if output.status.success() => {}
                Ok(output) => debug!(
                    "Audit watch on {} not removed: {}",
                    path.display(),
                    String::from_utf8_lossy(&output.stderr).trim()
                ),
                Err(e) => debug!("Audit watch on {} not removed: {}", path.display(), e),
            }
        }
        info!("FIM: audit watches removed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_watch_is_added_and_removed_under_the_agents_key() {
        let path = Path::new("/etc");
        assert_eq!(
            watch_arguments(path, true),
            ["-w", "/etc", "-p", "wa", "-k", "sentinel_fim"]
        );
        assert_eq!(watch_arguments(path, false)[0], "-W");
    }

    #[test]
    fn rules_are_added_only_when_auditd_collects() {
        let running = "enabled 1\nfailure 1\npid 612\nrate_limit 0\nbacklog_limit 8192\n";
        assert!(audit_collects(running));
        // Immutable rules (2) still collect.
        assert!(audit_collects(&running.replace("enabled 1", "enabled 2")));
        // The audit is on but no daemon writes the records down.
        assert!(!audit_collects(&running.replace("pid 612", "pid 0")));
        assert!(!audit_collects(&running.replace("enabled 1", "enabled 0")));
        assert!(!audit_collects(""));
    }

    #[test]
    fn a_rule_left_by_a_previous_run_counts_as_added() {
        assert!(already_there(
            "Error sending add rule data request (Rule exists)"
        ));
        assert!(!already_there(
            "Error sending add rule data request (Operation not permitted)"
        ));
    }
}
