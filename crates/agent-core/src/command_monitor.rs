// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Programs run at intervals whose output is watched (`command_monitors`
//! option), as Wazuh's `command` and `full_command` log sources.
//!
//! The organisation declares a program to run every so often: the
//! listening ports, the last logons, a check of its own. Each line of its
//! output goes to the log rules as an event of the service named after the
//! command, so a Sigma rule with `logsource: service: <name>` applies to it.
//! When the output differs from the previous run, the change is reported
//! with the lines that changed (`report_changes`, on by default).
//!
//! # Limits, stated plainly
//!
//! - The program is declared in the local configuration only, by absolute
//!   path, run without a shell, and refused when it is not owned by root (or
//!   the agent's account) or can be written by others: the rules of the
//!   response commands. It is checked again before every run.
//! - 256 KiB of output are read at most, and the program is given a minute.
//!   A program that exits with an error still has its output read: `grep`
//!   says "nothing found" that way.
//! - The output of the previous run is kept in the agent's data directory,
//!   readable by the agent's account only, so a change made while the agent
//!   was stopped is reported at its first run.

use agent_common::config::{AgentConfig, CommandMonitorConfig};
use agent_scanner::{IncidentSeverity, IncidentType, SecurityIncident};
use std::time::{Duration, Instant};
use tracing::{debug, warn};

use crate::edr_actions::response_command::{program_error, untrusted};

/// Longest a watched command may run.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(60);
/// Output read at most from one run.
const MAX_OUTPUT_BYTES: usize = 256 * 1024;
/// Shortest interval between two runs of one command.
const MIN_INTERVAL_SECS: u64 = 60;

/// One declared command, and the state of its runs.
struct Monitored {
    config: CommandMonitorConfig,
    last_start: Option<Instant>,
    running: bool,
    /// The last failure reported, so that a failure repeated at every run
    /// is logged once.
    last_error: Option<String>,
}

/// The commands of the configuration and when they ran.
pub(crate) struct CommandMonitors {
    monitors: Vec<Monitored>,
    /// Where the output of each command's last run is kept.
    state_dir: std::path::PathBuf,
}

impl CommandMonitors {
    /// Take the declarations of the configuration. Returns the ones left
    /// out, with the reason.
    pub(crate) fn new(declared: &[CommandMonitorConfig]) -> (Self, Vec<String>) {
        let mut monitors: Vec<Monitored> = Vec::new();
        let mut errors = Vec::new();
        for config in declared {
            if let Some(error) = program_error(&config.name, &config.program) {
                errors.push(error);
            } else if monitors.iter().any(|m| m.config.name == config.name) {
                errors.push(format!("'{}' is declared twice", config.name));
            } else {
                let mut config = config.clone();
                config.interval_secs = config.interval_secs.max(MIN_INTERVAL_SECS);
                monitors.push(Monitored {
                    config,
                    last_start: None,
                    running: false,
                    last_error: None,
                });
            }
        }
        let state_dir = AgentConfig::platform_data_dir().join("commands");
        (
            Self {
                monitors,
                state_dir,
            },
            errors,
        )
    }

    /// Keep the outputs in `dir` instead of the agent's data directory.
    #[cfg(test)]
    pub(crate) fn with_state_dir(mut self, dir: std::path::PathBuf) -> Self {
        self.state_dir = dir;
        self
    }

    /// Where the output of the last run of `name` is kept.
    fn output_path(&self, name: &str) -> std::path::PathBuf {
        self.state_dir.join(format!("{name}.out"))
    }

    /// The output of the last run of `name`, `None` before the first.
    pub(crate) fn previous_output(&self, name: &str) -> Option<String> {
        std::fs::read_to_string(self.output_path(name)).ok()
    }

    /// Keep the output of this run of `name`, for the next to compare with,
    /// readable by the agent's account only.
    pub(crate) fn keep_output(&self, name: &str, output: &str) {
        let path = self.output_path(name);
        let write = || -> std::io::Result<()> {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut tmp = path.as_os_str().to_owned();
            tmp.push(".tmp");
            let tmp = std::path::PathBuf::from(tmp);
            std::fs::write(&tmp, output)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))?;
            }
            std::fs::rename(&tmp, &path)
        };
        if let Err(e) = write() {
            warn!("Output of watched command '{}' not kept: {}", name, e);
        }
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.monitors.is_empty()
    }

    /// The commands whose time has come, now counted as running: a command
    /// still running is not started a second time.
    pub(crate) fn due(&mut self, now: Instant) -> Vec<CommandMonitorConfig> {
        self.monitors
            .iter_mut()
            .filter(|m| {
                !m.running
                    && m.last_start.is_none_or(|at| {
                        now.duration_since(at) >= Duration::from_secs(m.config.interval_secs)
                    })
            })
            .map(|m| {
                m.running = true;
                m.last_start = Some(now);
                m.config.clone()
            })
            .collect()
    }

    /// A run of `name` ended, with `error` when it failed. Returns whether
    /// the failure is new and worth logging.
    pub(crate) fn finished(&mut self, name: &str, error: Option<&str>) -> bool {
        let Some(monitor) = self.monitors.iter_mut().find(|m| m.config.name == name) else {
            return false;
        };
        monitor.running = false;
        let new = error.is_some_and(|e| monitor.last_error.as_deref() != Some(e));
        monitor.last_error = error.map(str::to_string);
        new
    }
}

/// What one run of a watched command gave.
pub(crate) struct CommandRun {
    pub name: String,
    pub program: String,
    pub report_changes: bool,
    /// Standard output, cut at 256 KiB.
    pub output: String,
    /// Why the run gave no output: not started, refused, timed out.
    pub error: Option<String>,
}

/// Run a watched command and read its output. Never fails: what went wrong
/// is in [`CommandRun::error`].
pub(crate) async fn run(config: CommandMonitorConfig) -> CommandRun {
    let (output, error) = match read_output(&config).await {
        Ok(output) => (output, None),
        Err(error) => (String::new(), Some(error)),
    };
    CommandRun {
        name: config.name,
        program: config.program,
        report_changes: config.report_changes,
        output,
        error,
    }
}

async fn read_output(config: &CommandMonitorConfig) -> Result<String, String> {
    use tokio::io::AsyncReadExt;

    // The program may have been replaced since the agent started.
    if let Some(reason) = untrusted(std::path::Path::new(&config.program)) {
        return Err(format!("the program {} {reason}", config.program));
    }
    let mut child = agent_common::process::silent_async_command(&config.program)
        .args(&config.args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("could not be started: {e}"))?;
    let mut stdout = child.stdout.take().ok_or("no output to read")?;
    let read = async {
        let mut bytes = Vec::new();
        (&mut stdout)
            .take(MAX_OUTPUT_BYTES as u64)
            .read_to_end(&mut bytes)
            .await?;
        // Enough read: the rest is not waited for.
        if bytes.len() >= MAX_OUTPUT_BYTES {
            let _ = child.start_kill();
        }
        let status = child.wait().await?;
        Ok::<_, std::io::Error>((bytes, status))
    };
    let (bytes, status) = tokio::time::timeout(COMMAND_TIMEOUT, read)
        .await
        .map_err(|_| format!("did not finish in {}s", COMMAND_TIMEOUT.as_secs()))?
        .map_err(|e| format!("output not read: {e}"))?;
    if !status.success() {
        debug!(
            "Watched command '{}' exited with {}",
            config.name,
            status.code().unwrap_or(-1)
        );
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// The events of an output, one per line that holds something.
pub(crate) fn events(name: &str, output: &str) -> Vec<agent_siem::decode::DecodedLog> {
    output
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.trim().is_empty())
        .map(|line| agent_siem::decode::decode_command_line(name, line))
        .collect()
}

/// The incident for an output that differs from the previous run's.
/// `None` when it does not, or when there was no previous run to compare.
pub(crate) fn output_change(
    name: &str,
    program: &str,
    previous: Option<&str>,
    current: &str,
) -> Option<SecurityIncident> {
    let diff = agent_fim::content::diff_lines(previous?, current)?;
    Some(
        SecurityIncident::new(
            IncidentType::UnauthorizedChange,
            IncidentSeverity::Medium,
            format!("Sortie de commande modifiée : {name}"),
            format!(
                "La sortie de « {name} » ({program}) a changé depuis son passage \
                 précédent.\n{diff}"
            ),
        )
        .with_confidence(70)
        .with_evidence(serde_json::json!({
            "detection": "command_monitor",
            "command": name,
            "program": program,
            "diff": diff,
        })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn declared(name: &str, program: &str) -> CommandMonitorConfig {
        CommandMonitorConfig {
            name: name.to_string(),
            program: program.to_string(),
            args: Vec::new(),
            interval_secs: 300,
            report_changes: true,
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_command_must_be_named_and_given_by_absolute_path() {
        let (monitors, errors) = CommandMonitors::new(&[
            declared("ports", "/bin/echo"),
            declared("ports", "/bin/echo"),
            declared("Ports Now", "/bin/echo"),
            declared("relative", "echo"),
        ]);
        assert_eq!(monitors.monitors.len(), 1);
        assert_eq!(errors.len(), 3, "{errors:?}");
        assert!(errors[0].contains("declared twice"));
        assert!(errors[2].contains("absolute path"));
    }

    #[cfg(unix)]
    #[test]
    fn a_command_runs_when_due_and_never_twice_at_once() {
        let mut quick = declared("quick", "/bin/echo");
        quick.interval_secs = 1;
        let (mut monitors, _) = CommandMonitors::new(&[quick]);
        let start = Instant::now();
        assert_eq!(monitors.due(start).len(), 1);
        // Still running: not started again, whatever the time.
        assert!(monitors.due(start + Duration::from_secs(600)).is_empty());
        monitors.finished("quick", None);
        // The interval is a minute at least.
        assert!(monitors.due(start + Duration::from_secs(30)).is_empty());
        assert_eq!(monitors.due(start + Duration::from_secs(61)).len(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn a_failure_repeated_at_every_run_is_logged_once() {
        let (mut monitors, _) = CommandMonitors::new(&[declared("ports", "/bin/echo")]);
        assert!(monitors.finished("ports", Some("did not finish in 60s")));
        assert!(!monitors.finished("ports", Some("did not finish in 60s")));
        assert!(!monitors.finished("ports", None));
        assert!(monitors.finished("ports", Some("did not finish in 60s")));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn a_run_reads_the_output_of_the_program() {
        let mut echo = declared("hello", "/bin/echo");
        echo.args = vec!["first line".to_string()];
        let run = run(echo).await;
        assert_eq!(run.error, None);
        assert_eq!(run.output, "first line\n");
    }

    #[tokio::test]
    async fn a_program_that_cannot_be_run_says_why() {
        let run = run(declared("missing", "/no/such/program")).await;
        assert!(run.output.is_empty());
        assert!(run.error.is_some());
    }

    #[test]
    fn each_line_that_holds_something_is_an_event_of_the_command() {
        let events = events("ports", "LISTEN 0.0.0.0:22\n\n   \nLISTEN 0.0.0.0:4444  \n");
        assert_eq!(events.len(), 2);
        assert_eq!(events[1].get("message"), Some("LISTEN 0.0.0.0:4444"));
        assert_eq!(events[1].services, ["ports"]);
    }

    /// The first run is the reference; a run that changes nothing is silent.
    #[test]
    fn a_change_of_output_is_reported_with_its_lines() {
        let before = "LISTEN 0.0.0.0:22\n";
        let after = "LISTEN 0.0.0.0:22\nLISTEN 0.0.0.0:4444\n";
        assert!(output_change("ports", "/usr/bin/ss", None, after).is_none());
        assert!(output_change("ports", "/usr/bin/ss", Some(after), after).is_none());

        let incident = output_change("ports", "/usr/bin/ss", Some(before), after).unwrap();
        assert_eq!(incident.title, "Sortie de commande modifiée : ports");
        assert_eq!(incident.severity, IncidentSeverity::Medium);
        let diff = incident.evidence["diff"].as_str().unwrap();
        assert!(diff.contains("+LISTEN 0.0.0.0:4444"), "{diff}");
        assert_eq!(incident.evidence["detection"], "command_monitor");
    }
}
