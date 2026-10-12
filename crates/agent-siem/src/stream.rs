// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The system log, read as it is written.
//!
//! Reading the system log once a minute with a time window loses what is
//! written between two readings and reads some lines twice. More
//! importantly, on macOS the lines that matter most are never kept: `sudo`
//! and `sshd` log at the "info" level, which the unified log holds in
//! memory only. They can be read as they pass, not afterwards.
//!
//! | System  | Source                                              | Needs                          |
//! |---------|-----------------------------------------------------|--------------------------------|
//! | macOS   | `log stream --level info --style ndjson`             | an administrator account       |
//! | Linux   | `journalctl --follow --output=json`                  | root or group `systemd-journal`|
//! | Windows | `Get-WinEvent`, from the last record read            | administrator                  |
//!
//! Linux and macOS are read continuously through a program of the system
//! kept running; its lines are decoded ([`crate::decode`]) and queued for
//! the agent. When the agent falls behind, lines are dropped and counted
//! rather than held without bound. Windows events are asked for at every
//! pass, starting after the last record read from each channel, so none is
//! read twice and none is skipped.
//!
//! # Limits, stated plainly
//!
//! - Only the programs that matter for security are read by default (see
//!   [`SECURITY_PROGRAMS`]); the whole journal with `all_programs`.
//! - `log stream` and `journalctl` are programs of the system: their output
//!   format is not a programming interface. Lines are read tolerantly and a
//!   stream none of whose lines is understood is reported.
//! - A Linux system without systemd has no journal: declare its log files
//!   in `log_files` instead (`/var/log/auth.log`, `/var/log/secure`).

use crate::decode::{self, DecodedLog};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, SyncSender, TrySendError, sync_channel};
use std::sync::{Arc, Mutex};
use tracing::{debug, warn};

// Windows has no log stream (its events are asked for at every pass): what
// follows a stream is only used on macOS and Linux.

/// Events queued at most between two passes of the agent.
#[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
const QUEUE: usize = 20_000;
/// Lines read without one understood before the stream is reported.
#[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
const UNREADABLE_LINES_BEFORE_WARNING: u64 = 50;
/// Time given to a source to fail before it is reported as started.
#[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
const STARTUP_GRACE: std::time::Duration = std::time::Duration::from_millis(400);
/// Largest line accepted from a source.
#[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
const MAX_LINE_BYTES: usize = 256 * 1024;

/// The programs whose lines are read unless every program is asked for:
/// logins, privilege changes, account management, scheduled tasks.
pub const SECURITY_PROGRAMS: &[&str] = &[
    "sshd",
    "sshd-session",
    "sudo",
    "su",
    "login",
    "passwd",
    "chpasswd",
    "useradd",
    "usermod",
    "userdel",
    "groupadd",
    "groupdel",
    "gpasswd",
    "systemd-logind",
    "polkitd",
    "cron",
    "CRON",
    "crond",
    "screensharingd",
];

/// The Sigma `service` names the stream of this system can give.
pub fn stream_services() -> Vec<String> {
    let mut services: Vec<String> = Vec::new();
    if cfg!(target_os = "windows") {
        services.extend(decode::windows_services().iter().map(|s| (*s).to_string()));
    } else {
        services.extend(
            [
                "auth",
                "syslog",
                "sshd",
                "sudo",
                "su",
                "cron",
                "screensharingd",
            ]
            .iter()
            .map(|s| (*s).to_string()),
        );
        if cfg!(target_os = "linux") {
            services.extend(["kernel".to_string(), "auditd".to_string()]);
        }
    }
    services
}

/// The predicate given to `log stream`.
pub fn macos_predicate(all_programs: bool) -> String {
    if all_programs {
        return "eventType == logEvent".to_string();
    }
    let programs: Vec<String> = SECURITY_PROGRAMS
        .iter()
        .map(|program| format!("\"{program}\""))
        .collect();
    format!(
        "eventType == logEvent AND process IN {{{}}} AND NOT senderImagePath ENDSWITH \".dylib\"",
        programs.join(", ")
    )
}

/// The arguments given to `journalctl`.
pub fn journalctl_arguments(all_programs: bool) -> Vec<String> {
    let mut arguments: Vec<String> = ["--follow", "--output=json", "--lines=0", "--no-pager"]
        .iter()
        .map(|argument| (*argument).to_string())
        .collect();
    if !all_programs {
        // Match groups separated by `+` are alternatives.
        for program in SECURITY_PROGRAMS {
            arguments.push(format!("SYSLOG_IDENTIFIER={program}"));
            arguments.push("+".to_string());
        }
        arguments.push("_TRANSPORT=kernel".to_string());
        arguments.push("+".to_string());
        arguments.push("_TRANSPORT=audit".to_string());
    }
    arguments
}

/// A running reader of the system log.
pub struct LogStream {
    kind: &'static str,
    child: Arc<Mutex<Option<Child>>>,
    queue: Mutex<Receiver<DecodedLog>>,
    dropped: Arc<AtomicU64>,
}

impl LogStream {
    /// Start reading the log of this system.
    pub fn start(all_programs: bool) -> Result<Self, String> {
        Self::start_platform(all_programs)
    }

    #[cfg(target_os = "macos")]
    fn start_platform(all_programs: bool) -> Result<Self, String> {
        let mut command = std::process::Command::new("/usr/bin/log");
        command.args([
            "stream",
            "--style",
            "ndjson",
            "--level",
            "info",
            "--type",
            "log",
            "--predicate",
            &macos_predicate(all_programs),
        ]);
        Self::from_lines("log stream", command, decode::decode_macos_entry)
    }

    #[cfg(target_os = "linux")]
    fn start_platform(all_programs: bool) -> Result<Self, String> {
        let mut command = std::process::Command::new("journalctl");
        command.args(journalctl_arguments(all_programs));
        Self::from_lines("journalctl", command, decode::decode_journal_entry)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    fn start_platform(_all_programs: bool) -> Result<Self, String> {
        Err("this system has no log stream: its events are asked for at every pass".to_string())
    }

    /// Run a program that prints one event per line and queue what `parse`
    /// understands.
    #[cfg_attr(not(any(target_os = "macos", target_os = "linux")), allow(dead_code))]
    fn from_lines(
        kind: &'static str,
        mut command: std::process::Command,
        parse: fn(&str) -> Option<DecodedLog>,
    ) -> Result<Self, String> {
        let mut child = command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("{kind} could not be started: {e}"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| format!("{kind} has no output"))?;
        let mut stderr = child.stderr.take();

        // A source refused by the system stops at once: say why instead of
        // reporting a start.
        std::thread::sleep(STARTUP_GRACE);
        if let Ok(Some(status)) = child.try_wait() {
            let mut reason = String::new();
            if let Some(stderr) = stderr.as_mut() {
                use std::io::Read;
                let _ = stderr.take(4096).read_to_string(&mut reason);
            }
            let reason = reason.lines().next().unwrap_or("").trim().to_string();
            return Err(if reason.is_empty() {
                format!("{kind} stopped at once ({status})")
            } else {
                format!("{kind} stopped at once: {reason}")
            });
        }
        let child = Arc::new(Mutex::new(Some(child)));

        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok).take(5) {
                    if !line.trim().is_empty() {
                        warn!("{} reported: {}", kind, line.trim());
                    }
                }
            });
        }

        let (tx, rx): (SyncSender<DecodedLog>, Receiver<DecodedLog>) = sync_channel(QUEUE);
        let dropped = Arc::new(AtomicU64::new(0));
        let reader_dropped = Arc::clone(&dropped);
        let reader_child = Arc::clone(&child);
        std::thread::spawn(move || {
            let (mut read, mut understood, mut warned) = (0u64, 0u64, false);
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {}
                }
                if line.len() > MAX_LINE_BYTES || line.trim().is_empty() {
                    continue;
                }
                read += 1;
                match parse(&line) {
                    Some(log) => {
                        understood += 1;
                        match tx.try_send(log) {
                            Ok(()) => {}
                            Err(TrySendError::Full(_)) => {
                                reader_dropped.fetch_add(1, Ordering::Relaxed);
                            }
                            Err(TrySendError::Disconnected(_)) => break,
                        }
                    }
                    None if !warned
                        && understood == 0
                        && read >= UNREADABLE_LINES_BEFORE_WARNING =>
                    {
                        warned = true;
                        warn!(
                            "{} output is not understood ({} lines): its format may have \
                             changed; the system log is not analysed",
                            kind, read
                        );
                    }
                    None => {}
                }
            }
            // The program ended by itself or was stopped.
            if let Ok(mut guard) = reader_child.lock()
                && let Some(mut child) = guard.take()
            {
                let _ = child.kill();
                let _ = child.wait();
            }
            debug!("{} ended after {} lines", kind, read);
        });

        Ok(Self {
            kind,
            child,
            queue: Mutex::new(rx),
            dropped,
        })
    }

    /// Short name of the mechanism, for the logs.
    pub fn kind(&self) -> &'static str {
        self.kind
    }

    /// Whether the program read from is still running.
    pub fn is_running(&self) -> bool {
        self.child
            .lock()
            .map(|mut guard| match guard.as_mut() {
                Some(child) => matches!(child.try_wait(), Ok(None)),
                None => false,
            })
            .unwrap_or(false)
    }

    /// Take up to `max` queued events.
    pub fn drain(&self, max: usize) -> Vec<DecodedLog> {
        let queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        queue.try_iter().take(max).collect()
    }

    /// Events dropped since this was last asked, because the agent fell
    /// behind.
    pub fn take_dropped(&self) -> u64 {
        self.dropped.swap(0, Ordering::Relaxed)
    }

    /// Stop the program read from.
    pub fn stop(&self) {
        if let Ok(mut guard) = self.child.lock()
            && let Some(mut child) = guard.take()
        {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for LogStream {
    fn drop(&mut self) {
        self.stop();
    }
}

/// The Windows event channels read.
pub const WINDOWS_CHANNELS: &[&str] = &[
    "Security",
    "System",
    "Application",
    "Windows PowerShell",
    "Microsoft-Windows-PowerShell/Operational",
    "Microsoft-Windows-Windows Defender/Operational",
    "Microsoft-Windows-Sysmon/Operational",
    "Microsoft-Windows-TaskScheduler/Operational",
    "Microsoft-Windows-TerminalServices-LocalSessionManager/Operational",
    "Microsoft-Windows-Windows Firewall With Advanced Security/Firewall",
];

/// Events read at most from one channel in one pass.
pub const WINDOWS_EVENTS_PER_CHANNEL: usize = 400;

/// Prints the events recorded after the bookmarks of `SENTINEL_LOG_BOOKMARKS`
/// (a JSON map of channel to record number), one JSON object per line, with
/// their data fields. A channel without a bookmark is not read: its last
/// record number is printed instead, so its history is not replayed.
pub const WINDOWS_EVENT_SCRIPT: &str = r#"$ErrorActionPreference = 'SilentlyContinue'
$bookmarks = @{}
if ($env:SENTINEL_LOG_BOOKMARKS) {
    (ConvertFrom-Json $env:SENTINEL_LOG_BOOKMARKS).PSObject.Properties | ForEach-Object { $bookmarks[$_.Name] = [long]$_.Value }
}
$channels = $env:SENTINEL_LOG_CHANNELS -split '\|'
$max = [int]$env:SENTINEL_LOG_MAX_EVENTS
foreach ($channel in $channels) {
    if (-not $bookmarks.ContainsKey($channel)) {
        $last = Get-WinEvent -LogName $channel -MaxEvents 1
        if ($?) {
            $record = 0
            if ($last) { $record = $last.RecordId }
            [Console]::Out.WriteLine((@{ Bookmark = $channel; RecordId = $record } | ConvertTo-Json -Compress))
        }
        continue
    }
    $query = "*[System[EventRecordID > $($bookmarks[$channel])]]"
    Get-WinEvent -LogName $channel -FilterXPath $query -MaxEvents $max -Oldest | ForEach-Object {
        $data = @{}
        $xml = [xml]$_.ToXml()
        foreach ($node in @($xml.Event.EventData.Data)) {
            if ($node -and $node.Name) { $data[$node.Name] = [string]$node.'#text' }
        }
        if ($xml.Event.UserData) {
            foreach ($child in $xml.Event.UserData.ChildNodes) {
                foreach ($leaf in $child.ChildNodes) {
                    if ($leaf.LocalName -and -not $data.ContainsKey($leaf.LocalName)) { $data[$leaf.LocalName] = [string]$leaf.InnerText }
                }
            }
        }
        $message = $_.Message
        if ($message -and $message.Length -gt 1024) { $message = $message.Substring(0, 1024) }
        [Console]::Out.WriteLine((@{
            Id = $_.Id; Channel = $channel; Provider = $_.ProviderName
            Time = $_.TimeCreated.ToUniversalTime().ToString('o'); Computer = $_.MachineName
            RecordId = $_.RecordId; Message = $message; Data = $data
        } | ConvertTo-Json -Compress -Depth 3))
    }
}
"#;

/// Where the reading of each Windows channel stopped.
#[derive(Debug, Default)]
pub struct WindowsEventReader {
    bookmarks: BTreeMap<String, u64>,
    state_path: Option<PathBuf>,
}

impl WindowsEventReader {
    /// A reader keeping its bookmarks in `state_path`.
    pub fn new(state_path: Option<PathBuf>) -> Self {
        let bookmarks = state_path
            .as_deref()
            .and_then(|path| std::fs::read(path).ok())
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            bookmarks,
            state_path,
        }
    }

    /// The bookmarks as the script takes them.
    pub fn bookmarks_json(&self) -> String {
        serde_json::to_string(&self.bookmarks).unwrap_or_else(|_| "{}".to_string())
    }

    /// Read the output of [`WINDOWS_EVENT_SCRIPT`]: the events, decoded, and
    /// the bookmarks moved past them.
    pub fn read_output(&mut self, output: &str) -> Vec<DecodedLog> {
        let mut logs = Vec::new();
        let before = self.bookmarks.clone();
        for line in output.lines() {
            let Ok(value) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
                continue;
            };
            let record = value["RecordId"].as_u64();
            if let (Some(channel), Some(record)) = (value["Bookmark"].as_str(), record) {
                self.bookmarks.entry(channel.to_string()).or_insert(record);
                continue;
            }
            let Some(log) = decode::decode_windows_event(&value) else {
                continue;
            };
            if let (Some(channel), Some(record)) = (value["Channel"].as_str(), record) {
                let bookmark = self.bookmarks.entry(channel.to_string()).or_insert(record);
                *bookmark = (*bookmark).max(record);
            }
            logs.push(log);
        }
        if self.bookmarks != before {
            self.save();
        }
        logs
    }

    fn save(&self) {
        let Some(path) = &self.state_path else {
            return;
        };
        if let Err(e) = write_atomically(path, &self.bookmarks) {
            warn!("Failed to save event log bookmarks: {}", e);
        }
    }

    /// Ask Windows for the events recorded since the last pass.
    #[cfg(target_os = "windows")]
    pub async fn read(&mut self) -> Result<Vec<DecodedLog>, String> {
        let mut command = agent_common::process::silent_async_command("powershell");
        command
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                WINDOWS_EVENT_SCRIPT,
            ])
            .env("SENTINEL_LOG_BOOKMARKS", self.bookmarks_json())
            .env("SENTINEL_LOG_CHANNELS", WINDOWS_CHANNELS.join("|"))
            .env(
                "SENTINEL_LOG_MAX_EVENTS",
                WINDOWS_EVENTS_PER_CHANNEL.to_string(),
            )
            .kill_on_drop(true);
        let output = tokio::time::timeout(std::time::Duration::from_secs(90), command.output())
            .await
            .map_err(|_| "reading the event log took too long".to_string())?
            .map_err(|e| format!("the event log could not be read: {e}"))?;
        Ok(self.read_output(&String::from_utf8_lossy(&output.stdout)))
    }
}

fn write_atomically(path: &Path, value: &impl serde::Serialize) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    std::fs::write(&tmp, serde_json::to_vec(value)?)?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn printing(script: &str) -> std::process::Command {
        let mut command = std::process::Command::new("/bin/sh");
        command.args(["-c", script]);
        command
    }

    #[cfg(unix)]
    fn wait_for(stream: &LogStream, count: usize) -> Vec<DecodedLog> {
        let mut logs = Vec::new();
        for _ in 0..100 {
            logs.extend(stream.drain(1_000));
            if logs.len() >= count {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        logs
    }

    #[cfg(unix)]
    #[test]
    fn a_stream_queues_what_it_understands_and_stops() {
        let stream = LogStream::from_lines(
            "test stream",
            printing(
                r#"echo 'Filtering the log data using "process == sudo"'
echo '{"processImagePath":"/usr/bin/sudo","processID":7,"eventMessage":"   alice : TTY=ttys001 ; PWD=/ ; USER=root ; COMMAND=/bin/ls"}'
echo 'not json'
echo '{"processImagePath":"/usr/sbin/sshd","processID":8,"eventMessage":"Failed password for root from 203.0.113.9 port 4444 ssh2"}'
sleep 30"#,
            ),
            decode::decode_macos_entry,
        )
        .unwrap();
        assert_eq!(stream.kind(), "test stream");
        let logs = wait_for(&stream, 2);
        assert_eq!(logs.len(), 2);
        assert_eq!(logs[0].get("action"), Some("command"));
        assert_eq!(logs[1].get("src_ip"), Some("203.0.113.9"));
        assert!(stream.is_running());
        assert_eq!(stream.take_dropped(), 0);

        stream.stop();
        assert!(!stream.is_running());
    }

    #[cfg(unix)]
    #[test]
    fn a_stream_refused_by_the_system_says_why() {
        let error = LogStream::from_lines(
            "test stream",
            printing("echo 'log: Must be admin to run stream command' >&2; exit 1"),
            decode::decode_macos_entry,
        )
        .err()
        .unwrap();
        assert_eq!(
            error,
            "test stream stopped at once: log: Must be admin to run stream command"
        );

        let missing = LogStream::from_lines(
            "test stream",
            std::process::Command::new("/nonexistent/sentinel-log-reader"),
            decode::decode_macos_entry,
        )
        .err()
        .unwrap();
        assert!(missing.contains("could not be started"));
    }

    #[cfg(unix)]
    #[test]
    fn a_reader_that_falls_behind_drops_and_counts() {
        let script = format!(
            "i=0; while [ $i -lt {} ]; do echo '{{\"processImagePath\":\"/usr/bin/app\",\"eventMessage\":\"line\"}}'; i=$((i+1)); done; sleep 30",
            QUEUE + 300
        );
        let stream =
            LogStream::from_lines("test stream", printing(&script), decode::decode_macos_entry)
                .unwrap();
        // Nothing is taken until the program has printed everything.
        let mut dropped = 0;
        for _ in 0..200 {
            dropped += stream.take_dropped();
            if dropped >= 300 {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        assert_eq!(dropped, 300);
        assert_eq!(stream.drain(usize::MAX).len(), QUEUE);
    }

    #[test]
    fn only_the_programs_that_matter_are_asked_for_by_default() {
        let predicate = macos_predicate(false);
        assert!(predicate.contains("\"sudo\"") && predicate.contains("\"sshd-session\""));
        assert!(predicate.starts_with("eventType == logEvent AND process IN {"));
        assert_eq!(macos_predicate(true), "eventType == logEvent");

        let arguments = journalctl_arguments(false);
        assert_eq!(
            &arguments[..4],
            ["--follow", "--output=json", "--lines=0", "--no-pager"]
        );
        assert!(arguments.contains(&"SYSLOG_IDENTIFIER=sshd".to_string()));
        assert_eq!(arguments.last().unwrap(), "_TRANSPORT=audit");
        // Alternatives are separated, never doubled or trailing.
        assert!(
            !arguments
                .windows(2)
                .any(|pair| pair[0] == "+" && pair[1] == "+")
        );
        assert_eq!(journalctl_arguments(true).len(), 4);
    }

    #[test]
    fn windows_events_are_read_once_from_where_the_last_pass_stopped() {
        let dir = tempfile::tempdir().unwrap();
        let state = dir.path().join("logs").join("bookmarks.json");
        let mut reader = WindowsEventReader::new(Some(state.clone()));
        assert_eq!(reader.bookmarks_json(), "{}");

        // First pass: no event, only where each channel stands.
        let logs = reader.read_output(
            "{\"Bookmark\":\"Security\",\"RecordId\":1000}\n{\"Bookmark\":\"System\",\"RecordId\":50}\n",
        );
        assert!(logs.is_empty());
        assert_eq!(reader.bookmarks_json(), r#"{"Security":1000,"System":50}"#);

        // Next pass: the events after the bookmark, which moves past them.
        let logs = reader.read_output(
            "{\"Id\":4625,\"Channel\":\"Security\",\"RecordId\":1001,\"Data\":{\"TargetUserName\":\"admin\",\"IpAddress\":\"203.0.113.9\"}}\n\
             garbage\n\
             {\"Id\":4624,\"Channel\":\"Security\",\"RecordId\":1003,\"Data\":{}}\n\
             {\"Id\":4634,\"Channel\":\"Security\",\"RecordId\":1002,\"Data\":{}}\n",
        );
        assert_eq!(logs.len(), 3);
        assert_eq!(logs[0].get("targetusername"), Some("admin"));
        assert_eq!(logs[0].services, ["security"]);
        assert_eq!(reader.bookmarks_json(), r#"{"Security":1003,"System":50}"#);

        // The bookmarks survive a restart.
        let restarted = WindowsEventReader::new(Some(state));
        assert_eq!(
            restarted.bookmarks_json(),
            r#"{"Security":1003,"System":50}"#
        );
    }

    #[test]
    fn the_stream_names_the_services_rules_can_be_written_for() {
        let services = stream_services();
        if cfg!(target_os = "windows") {
            assert!(services.contains(&"security".to_string()));
        } else {
            assert!(
                services.contains(&"sshd".to_string()) && services.contains(&"auth".to_string())
            );
        }
    }
}
