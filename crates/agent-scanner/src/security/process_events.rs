// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Real-time process start events.
//!
//! The periodic process scan only sees what is running when it looks: a
//! process that lives a few seconds between two scans is never evaluated.
//! This module asks the operating system to report every process start as
//! it happens, so the detection rules run on each of them.
//!
//! | System  | Source                                                             | Needs |
//! |---------|--------------------------------------------------------------------|-------|
//! | macOS   | Endpoint Security `exec` events, through the system's `eslogger`    | root, Full Disk Access |
//! | Windows | `Win32_ProcessStartTrace` (kernel process trace), through PowerShell | administrator |
//! | Linux   | kernel process connector (netlink), feature `proc-connector`        | root |
//!
//! # Limits, stated plainly
//!
//! - macOS: `eslogger` is a system tool, not a programming interface; Apple
//!   may change its output. Lines are read tolerantly, and a stream whose
//!   lines can no longer be read is reported. A native Endpoint Security
//!   client needs an entitlement granted by Apple.
//! - Windows: the command line and path are read just after the start
//!   event; a process that has already exited is reported with its name only.
//! - Linux: the connector reports the process identifier; its details are
//!   read from `/proc` at once, with the same limit for very short processes.
//!   The source is behind the `proc-connector` feature until it has been
//!   built and exercised on Linux.
//!
//! When a source cannot start, the periodic scan remains the only detection:
//! nothing else changes.

use super::process_monitor::ProcessInfo;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::mpsc::SyncSender;
use std::sync::{Arc, Mutex};
use tracing::{debug, info, warn};

/// A process that has just started.
#[derive(Debug, Clone)]
pub struct ProcessStart {
    pub process: ProcessInfo,
    /// Executable of the process that started it, when the source gives it.
    pub parent_image: Option<String>,
}

/// Lines read without a single one understood before the stream is reported
/// as unreadable (its format has probably changed).
const UNREADABLE_LINES_BEFORE_WARNING: u64 = 50;

/// Time given to a source to fail before it is reported as started.
const STARTUP_GRACE: std::time::Duration = std::time::Duration::from_millis(300);

/// Largest line accepted from a source (an `exec` event with its environment
/// can be large; anything beyond this is not an event).
const MAX_LINE_BYTES: usize = 1024 * 1024;

fn text(value: &serde_json::Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn number(value: &serde_json::Value) -> Option<u32> {
    value.as_u64().and_then(|n| u32::try_from(n).ok())
}

fn file_name(path: &str) -> String {
    path.rsplit(['/', '\\']).next().unwrap_or(path).to_string()
}

/// Read one `eslogger exec` line (macOS). The structure follows
/// `es_message_t`: the started program is `event.exec.target`, and
/// `process` is the program that called `exec`.
pub fn parse_eslogger_exec(line: &str) -> Option<ProcessStart> {
    let message: serde_json::Value = serde_json::from_str(line).ok()?;
    let exec = message.get("event")?.get("exec")?;
    let target = exec.get("target")?;
    let pid = number(target.get("audit_token")?.get("pid")?)?;
    let path = target
        .get("executable")
        .and_then(|executable| executable.get("path"))
        .and_then(text);
    let args: Vec<&str> = exec
        .get("args")
        .and_then(|args| args.as_array())
        .map(|args| args.iter().filter_map(|arg| arg.as_str()).collect())
        .unwrap_or_default();
    let cmdline = (!args.is_empty()).then(|| args.join(" "));
    let name = path
        .as_deref()
        .map(file_name)
        .or_else(|| args.first().map(|arg| file_name(arg)))?;
    let ppid = target
        .get("ppid")
        .and_then(number)
        .or_else(|| number(target.get("parent_audit_token")?.get("pid")?));
    let parent_image = message
        .get("process")
        .and_then(|process| process.get("executable"))
        .and_then(|executable| executable.get("path"))
        .and_then(text);

    Some(ProcessStart {
        process: ProcessInfo {
            pid,
            name,
            path,
            cmdline,
            ppid,
            user: None,
        },
        parent_image,
    })
}

/// PowerShell script reporting every process start as one JSON line
/// (Windows). `Win32_ProcessStartTrace` is fed by the kernel's process
/// trace; the path and command line are then read from `Win32_Process`.
pub const WINDOWS_TRACE_SCRIPT: &str = r#"$ErrorActionPreference = 'Stop'
Register-CimIndicationEvent -ClassName Win32_ProcessStartTrace -SourceIdentifier SentinelProcessStart
while ($true) {
  $e = Wait-Event -SourceIdentifier SentinelProcessStart
  $n = $e.SourceEventArgs.NewEvent
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($n.ProcessID)" -ErrorAction SilentlyContinue
  $pp = Get-CimInstance Win32_Process -Filter "ProcessId=$($n.ParentProcessID)" -ErrorAction SilentlyContinue
  $o = @{ pid = [int]$n.ProcessID; ppid = [int]$n.ParentProcessID; name = $n.ProcessName; path = $p.ExecutablePath; cmdline = $p.CommandLine; parent = $pp.ExecutablePath }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  Remove-Event -EventIdentifier $e.EventIdentifier
}"#;

/// Read one line of [`WINDOWS_TRACE_SCRIPT`].
pub fn parse_windows_trace(line: &str) -> Option<ProcessStart> {
    let event: serde_json::Value = serde_json::from_str(line).ok()?;
    let pid = number(event.get("pid")?)?;
    let path = event.get("path").and_then(text);
    let name = event
        .get("name")
        .and_then(text)
        .or_else(|| path.as_deref().map(file_name))?;
    Some(ProcessStart {
        process: ProcessInfo {
            pid,
            name,
            path,
            cmdline: event.get("cmdline").and_then(text),
            ppid: event.get("ppid").and_then(number).filter(|ppid| *ppid != 0),
            user: None,
        },
        parent_image: event.get("parent").and_then(text),
    })
}

/// What a process connector message says (Linux).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectorEvent {
    /// A process called `exec`: `pid` now runs a new program.
    Exec { pid: u32 },
    /// Anything else (fork, exit, uid change…).
    Other,
}

/// Read one netlink message of the kernel process connector (Linux):
/// `nlmsghdr` (16 bytes), `cn_msg` (20 bytes), then `proc_event` whose first
/// field says what happened and whose data starts at byte 16.
pub fn parse_connector_message(message: &[u8]) -> Option<ConnectorEvent> {
    const NLMSG_HEADER: usize = 16;
    const CN_MSG_HEADER: usize = 20;
    const PROC_EVENT_EXEC: u32 = 0x0000_0002;
    const EVENT_DATA: usize = 16;

    let event = message.get(NLMSG_HEADER + CN_MSG_HEADER..)?;
    let word = |offset: usize| -> Option<u32> {
        event
            .get(offset..offset + 4)
            .and_then(|bytes| bytes.try_into().ok())
            .map(u32::from_ne_bytes)
    };
    match word(0)? {
        // process_pid (the thread), process_tgid (the process).
        PROC_EVENT_EXEC => Some(ConnectorEvent::Exec {
            pid: word(EVENT_DATA + 4)?,
        }),
        _ => Some(ConnectorEvent::Other),
    }
}

/// A running source of process start events.
pub struct ProcessEventSource {
    /// Short name of the mechanism, for the logs.
    kind: &'static str,
    child: Arc<Mutex<Option<Child>>>,
    #[cfg(all(target_os = "linux", feature = "proc-connector"))]
    stop: Arc<std::sync::atomic::AtomicBool>,
}

impl ProcessEventSource {
    /// Start the source of this operating system, sending every process
    /// start to `tx`. Events are dropped when the receiver falls behind.
    pub fn start(tx: SyncSender<ProcessStart>) -> Result<Self, String> {
        Self::start_platform(tx)
    }

    #[cfg(target_os = "macos")]
    fn start_platform(tx: SyncSender<ProcessStart>) -> Result<Self, String> {
        let mut command = std::process::Command::new("/usr/bin/eslogger");
        command.arg("exec");
        Self::from_lines("eslogger", command, parse_eslogger_exec, tx)
    }

    #[cfg(target_os = "windows")]
    fn start_platform(tx: SyncSender<ProcessStart>) -> Result<Self, String> {
        let mut command = agent_common::process::silent_command("powershell");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            WINDOWS_TRACE_SCRIPT,
        ]);
        Self::from_lines("process start trace", command, parse_windows_trace, tx)
    }

    #[cfg(all(target_os = "linux", feature = "proc-connector"))]
    fn start_platform(tx: SyncSender<ProcessStart>) -> Result<Self, String> {
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        linux::start(tx, Arc::clone(&stop))?;
        Ok(Self {
            kind: "process connector",
            child: Arc::new(Mutex::new(None)),
            stop,
        })
    }

    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        all(target_os = "linux", feature = "proc-connector")
    )))]
    fn start_platform(_tx: SyncSender<ProcessStart>) -> Result<Self, String> {
        Err("no real-time process source is built in for this system".to_string())
    }

    /// Run a program that prints one event per line and forward what `parse`
    /// understands.
    #[cfg_attr(
        not(any(target_os = "macos", target_os = "windows", test)),
        allow(dead_code)
    )]
    fn from_lines(
        kind: &'static str,
        mut command: std::process::Command,
        parse: fn(&str) -> Option<ProcessStart>,
        tx: SyncSender<ProcessStart>,
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

        // A source refused by the system (not root, no Full Disk Access, not
        // administrator) stops at once: say why instead of reporting a start.
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

        // The first error line explains a refusal (not root, no Full Disk
        // Access, not administrator).
        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok).take(5) {
                    if !line.trim().is_empty() {
                        warn!("{} reported: {}", kind, line.trim());
                    }
                }
            });
        }

        let reader_child = Arc::clone(&child);
        std::thread::spawn(move || {
            let (mut read, mut understood, mut dropped, mut warned) = (0u64, 0u64, 0u64, false);
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
                    Some(start) => {
                        understood += 1;
                        if tx.try_send(start).is_err() {
                            dropped += 1;
                        }
                    }
                    None if !warned
                        && understood == 0
                        && read >= UNREADABLE_LINES_BEFORE_WARNING =>
                    {
                        warned = true;
                        warn!(
                            "{} output is not understood ({} lines): its format may have \
                             changed; only the periodic scan is detecting processes",
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
                let _ = child.wait();
            }
            info!(
                "{} stopped ({} process starts read, {} dropped while busy)",
                kind, understood, dropped
            );
        });

        Ok(Self {
            kind,
            child,
            #[cfg(all(target_os = "linux", feature = "proc-connector"))]
            stop: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }

    /// Short name of the mechanism in use.
    pub fn kind(&self) -> &'static str {
        self.kind
    }

    /// Stop the source.
    pub fn stop(&self) {
        #[cfg(all(target_os = "linux", feature = "proc-connector"))]
        self.stop.store(true, std::sync::atomic::Ordering::Release);
        if let Ok(mut guard) = self.child.lock()
            && let Some(child) = guard.as_mut()
            && let Err(e) = child.kill()
        {
            debug!("{} was already stopped: {}", self.kind, e);
        }
    }
}

impl Drop for ProcessEventSource {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Kernel process connector (netlink). Not built by default: see the module
/// documentation.
#[cfg(all(target_os = "linux", feature = "proc-connector"))]
mod linux {
    use super::{ConnectorEvent, ProcessInfo, ProcessStart, parse_connector_message};
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc::SyncSender;

    const CN_IDX_PROC: u32 = 1;
    const CN_VAL_PROC: u32 = 1;
    const PROC_CN_MCAST_LISTEN: u32 = 1;

    fn last_error(what: &str) -> String {
        format!("{what}: {}", std::io::Error::last_os_error())
    }

    /// Details of a process, read from `/proc`.
    fn read_process(pid: u32) -> Option<ProcessInfo> {
        let base = std::path::PathBuf::from(format!("/proc/{pid}"));
        let name = std::fs::read_to_string(base.join("comm"))
            .ok()?
            .trim()
            .to_string();
        let path = std::fs::read_link(base.join("exe"))
            .ok()
            .map(|p| p.to_string_lossy().to_string());
        let cmdline = std::fs::read_to_string(base.join("cmdline"))
            .ok()
            .map(|s| s.replace('\0', " ").trim().to_string())
            .filter(|s| !s.is_empty());
        let ppid = std::fs::read_to_string(base.join("status"))
            .ok()
            .and_then(|s| {
                s.lines()
                    .find(|l| l.starts_with("PPid:"))
                    .and_then(|l| l.split_whitespace().nth(1))
                    .and_then(|v| v.parse().ok())
            });
        Some(ProcessInfo {
            pid,
            name,
            path,
            cmdline,
            ppid,
            user: None,
        })
    }

    pub(super) fn start(tx: SyncSender<ProcessStart>, stop: Arc<AtomicBool>) -> Result<(), String> {
        // SAFETY: plain socket creation; the descriptor is owned right after.
        let raw = unsafe {
            libc::socket(
                libc::PF_NETLINK,
                libc::SOCK_DGRAM | libc::SOCK_CLOEXEC,
                libc::NETLINK_CONNECTOR,
            )
        };
        if raw < 0 {
            return Err(last_error("netlink socket"));
        }
        // SAFETY: `raw` is a descriptor just returned by socket().
        let socket = unsafe { OwnedFd::from_raw_fd(raw) };

        // SAFETY: sockaddr_nl is plain data; zero is a valid starting value.
        let mut address: libc::sockaddr_nl = unsafe { std::mem::zeroed() };
        address.nl_family = libc::AF_NETLINK as libc::sa_family_t;
        address.nl_groups = CN_IDX_PROC;
        address.nl_pid = std::process::id();
        // SAFETY: valid descriptor, address and length.
        let bound = unsafe {
            libc::bind(
                socket.as_raw_fd(),
                std::ptr::addr_of!(address).cast(),
                std::mem::size_of::<libc::sockaddr_nl>() as libc::socklen_t,
            )
        };
        if bound < 0 {
            return Err(last_error("netlink bind (root is required)"));
        }

        // Subscription message: nlmsghdr, cn_msg, then the operation.
        let mut message = Vec::with_capacity(40);
        message.extend_from_slice(&40u32.to_ne_bytes()); // nlmsg_len
        message.extend_from_slice(&(libc::NLMSG_DONE as u16).to_ne_bytes()); // nlmsg_type
        message.extend_from_slice(&0u16.to_ne_bytes()); // nlmsg_flags
        message.extend_from_slice(&0u32.to_ne_bytes()); // nlmsg_seq
        message.extend_from_slice(&std::process::id().to_ne_bytes()); // nlmsg_pid
        message.extend_from_slice(&CN_IDX_PROC.to_ne_bytes()); // cn_msg.id.idx
        message.extend_from_slice(&CN_VAL_PROC.to_ne_bytes()); // cn_msg.id.val
        message.extend_from_slice(&0u32.to_ne_bytes()); // cn_msg.seq
        message.extend_from_slice(&0u32.to_ne_bytes()); // cn_msg.ack
        message.extend_from_slice(&4u16.to_ne_bytes()); // cn_msg.len
        message.extend_from_slice(&0u16.to_ne_bytes()); // cn_msg.flags
        message.extend_from_slice(&PROC_CN_MCAST_LISTEN.to_ne_bytes());
        // SAFETY: valid descriptor and buffer.
        let sent = unsafe {
            libc::send(
                socket.as_raw_fd(),
                message.as_ptr().cast(),
                message.len(),
                0,
            )
        };
        if sent < 0 {
            return Err(last_error("process connector subscription"));
        }

        // Wake up regularly to notice the stop request.
        let timeout = libc::timeval {
            tv_sec: 1,
            tv_usec: 0,
        };
        // SAFETY: valid descriptor, option value and length.
        unsafe {
            libc::setsockopt(
                socket.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_RCVTIMEO,
                std::ptr::addr_of!(timeout).cast(),
                std::mem::size_of::<libc::timeval>() as libc::socklen_t,
            );
        }

        std::thread::spawn(move || {
            let own_pid = std::process::id();
            let mut buffer = [0u8; 4096];
            while !stop.load(Ordering::Acquire) {
                // SAFETY: valid descriptor and buffer.
                let received = unsafe {
                    libc::recv(
                        socket.as_raw_fd(),
                        buffer.as_mut_ptr().cast(),
                        buffer.len(),
                        0,
                    )
                };
                let Ok(length) = usize::try_from(received) else {
                    continue; // timeout or interruption
                };
                if let Some(ConnectorEvent::Exec { pid }) =
                    parse_connector_message(&buffer[..length])
                    && pid != own_pid
                    && let Some(process) = read_process(pid)
                {
                    let _ = tx.try_send(ProcessStart {
                        process,
                        parent_image: None,
                    });
                }
            }
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ESLOGGER_EXEC: &str = r#"{"schema_version":1,"mach_time":123,"event_type":9,"version":7,
        "time":"2026-10-04T09:00:00.000000000Z",
        "process":{"audit_token":{"pid":4811,"euid":501},"ppid":4700,
                   "executable":{"path":"/bin/zsh","path_truncated":false}},
        "event":{"exec":{
            "target":{"audit_token":{"pid":4812,"euid":501,"ruid":501},"ppid":4700,
                      "executable":{"path":"/usr/bin/curl","path_truncated":false},
                      "signing_id":"com.apple.curl","is_platform_binary":true},
            "args":["curl","-s","https://example.com/x.sh"],
            "env":["HOME=/Users/alice"],
            "cwd":{"path":"/Users/alice"}}}}"#;

    #[test]
    fn eslogger_exec_events_are_read() {
        let start = parse_eslogger_exec(&ESLOGGER_EXEC.replace('\n', " ")).unwrap();
        assert_eq!(start.process.pid, 4812);
        assert_eq!(start.process.name, "curl");
        assert_eq!(start.process.path.as_deref(), Some("/usr/bin/curl"));
        assert_eq!(
            start.process.cmdline.as_deref(),
            Some("curl -s https://example.com/x.sh")
        );
        assert_eq!(start.process.ppid, Some(4700));
        assert_eq!(start.parent_image.as_deref(), Some("/bin/zsh"));
    }

    #[test]
    fn eslogger_lines_are_read_tolerantly() {
        // Fields may be missing: the identifier and a name are enough.
        let minimal = r#"{"event":{"exec":{"target":{"audit_token":{"pid":7}},"args":["/opt/tool/run","--x"]}}}"#;
        let start = parse_eslogger_exec(minimal).unwrap();
        assert_eq!(start.process.pid, 7);
        assert_eq!(start.process.name, "run");
        assert_eq!(start.process.path, None);
        assert_eq!(start.process.ppid, None);
        assert_eq!(start.parent_image, None);

        // The parent can come from its audit token.
        let token = r#"{"event":{"exec":{"target":{"audit_token":{"pid":8},"parent_audit_token":{"pid":3},"executable":{"path":"/bin/ls"}}}}}"#;
        assert_eq!(parse_eslogger_exec(token).unwrap().process.ppid, Some(3));

        // Other events, other shapes and noise are not process starts.
        for line in [
            r#"{"event":{"exit":{"stat":0}},"process":{"audit_token":{"pid":9}}}"#,
            r#"{"event":{"exec":{"target":{"audit_token":{}}}}}"#,
            r#"{"event":{"exec":{"target":{"audit_token":{"pid":10}}}}}"#,
            "eslogger: not privileged",
            "",
        ] {
            assert!(parse_eslogger_exec(line).is_none(), "{line}");
        }
    }

    #[test]
    fn windows_trace_lines_are_read() {
        let full = r#"{"cmdline":"powershell.exe -enc SQBFAFgA","parent":"C:\\Program Files\\Microsoft Office\\WINWORD.EXE","path":"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe","name":"powershell.exe","ppid":3120,"pid":4812}"#;
        let start = parse_windows_trace(full).unwrap();
        assert_eq!(start.process.pid, 4812);
        assert_eq!(start.process.name, "powershell.exe");
        assert_eq!(start.process.ppid, Some(3120));
        assert_eq!(
            start.process.cmdline.as_deref(),
            Some("powershell.exe -enc SQBFAFgA")
        );
        assert!(start.parent_image.unwrap().ends_with("WINWORD.EXE"));

        // The process had already exited when its details were read.
        let short_lived =
            r#"{"cmdline":null,"parent":null,"path":null,"name":"whoami.exe","ppid":0,"pid":5120}"#;
        let start = parse_windows_trace(short_lived).unwrap();
        assert_eq!(start.process.name, "whoami.exe");
        assert_eq!(start.process.path, None);
        assert_eq!(start.process.cmdline, None);
        assert_eq!(start.process.ppid, None);

        assert!(parse_windows_trace(r#"{"name":"x.exe"}"#).is_none());
        assert!(parse_windows_trace("Access denied").is_none());
    }

    /// A connector message: 16-byte netlink header, 20-byte connector
    /// header, then the event.
    fn connector_message(what: u32, data: &[u32]) -> Vec<u8> {
        let mut message = vec![0u8; 36];
        message.extend_from_slice(&what.to_ne_bytes());
        message.extend_from_slice(&0u32.to_ne_bytes()); // cpu
        message.extend_from_slice(&0u64.to_ne_bytes()); // timestamp
        for word in data {
            message.extend_from_slice(&word.to_ne_bytes());
        }
        message
    }

    #[test]
    fn connector_messages_give_the_process_that_called_exec() {
        // exec: thread id then process id.
        assert_eq!(
            parse_connector_message(&connector_message(2, &[4813, 4812])),
            Some(ConnectorEvent::Exec { pid: 4812 })
        );
        // fork and exit are not program starts.
        assert_eq!(
            parse_connector_message(&connector_message(1, &[10, 10, 11, 11])),
            Some(ConnectorEvent::Other)
        );
        assert_eq!(
            parse_connector_message(&connector_message(0x8000_0000, &[11, 11, 0, 0])),
            Some(ConnectorEvent::Other)
        );
        // Truncated messages are ignored.
        assert_eq!(
            parse_connector_message(&connector_message(2, &[4813])),
            None
        );
        assert_eq!(parse_connector_message(&[0u8; 20]), None);
        assert_eq!(parse_connector_message(&[]), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_line_source_forwards_what_it_understands_and_stops() {
        let (tx, rx) = std::sync::mpsc::sync_channel(8);
        let mut command = std::process::Command::new("/bin/sh");
        command.args([
            "-c",
            r#"echo 'noise'; echo '{"pid":4812,"name":"a.exe","ppid":7}'; echo '{"pid":4813,"name":"b.exe"}'; exec sleep 30"#,
        ]);
        let source =
            ProcessEventSource::from_lines("test source", command, parse_windows_trace, tx)
                .unwrap();
        assert_eq!(source.kind(), "test source");

        let timeout = std::time::Duration::from_secs(10);
        let first = rx.recv_timeout(timeout).unwrap();
        let second = rx.recv_timeout(timeout).unwrap();
        assert_eq!((first.process.pid, first.process.ppid), (4812, Some(7)));
        assert_eq!(second.process.name, "b.exe");

        // Stopping ends the program: the channel closes instead of waiting
        // for the 30 seconds.
        source.stop();
        assert!(rx.recv_timeout(timeout).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn a_source_refused_by_the_system_says_why() {
        let (tx, _rx) = std::sync::mpsc::sync_channel(1);
        let mut command = std::process::Command::new("/bin/sh");
        command.args([
            "-c",
            "echo 'Not privileged to create an ES client, need to be superuser' >&2; exit 1",
        ]);
        let error = ProcessEventSource::from_lines("eslogger", command, parse_eslogger_exec, tx)
            .err()
            .unwrap();
        assert_eq!(
            error,
            "eslogger stopped at once: Not privileged to create an ES client, need to be superuser"
        );
    }

    #[test]
    fn a_missing_program_is_an_error() {
        let (tx, _rx) = std::sync::mpsc::sync_channel(1);
        let command = std::process::Command::new("/nonexistent/process-source");
        let error = ProcessEventSource::from_lines("absent", command, parse_windows_trace, tx)
            .err()
            .unwrap();
        assert!(error.contains("absent could not be started"));
    }
}
