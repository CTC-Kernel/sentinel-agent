// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Process utilities for cross-platform command execution.
//!
//! On Windows, spawning `cmd.exe` or `powershell.exe` from a GUI-subsystem
//! process causes a visible console window to flash.  [`silent_command`]
//! applies `CREATE_NO_WINDOW` (0x0800_0000) automatically on Windows so that
//! child console processes remain invisible.

use std::process::{Command, Output, Stdio};
use std::time::Duration;

/// Parse JSON output from PowerShell commands into a `Vec<serde_json::Value>`.
///
/// Handles three PowerShell quirks:
/// - Empty stdout (no results) → returns empty vec
/// - Single object `{...}` (one result) → wraps in vec
/// - Array `[{...}, ...]` (multiple results) → returns as-is
pub fn parse_powershell_json_array(stdout: &str) -> Result<Vec<serde_json::Value>, String> {
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }
    serde_json::from_str::<Vec<serde_json::Value>>(trimmed)
        .or_else(|_| serde_json::from_str::<serde_json::Value>(trimmed).map(|v| vec![v]))
        .map_err(|e| e.to_string())
}

/// Interpret a PowerShell JSON value as a boolean.
///
/// PowerShell often returns `0`/`1` or `"True"`/`"False"` instead of JSON `true`/`false`.
pub fn ps_json_as_bool(value: &serde_json::Value) -> Option<bool> {
    match value {
        serde_json::Value::Bool(b) => Some(*b),
        serde_json::Value::Number(n) => n.as_i64().map(|v| v != 0),
        serde_json::Value::String(s) => match s.to_lowercase().as_str() {
            "true" | "1" => Some(true),
            "false" | "0" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

/// Create a [`Command`] that will **not** flash a console window on Windows.
///
/// On non-Windows platforms this is identical to [`Command::new`].
///
/// On Windows the command is configured with:
/// - `CREATE_NO_WINDOW` creation flag to suppress console windows
/// - Explicit `Stdio` pipes for stdout/stderr so output is always captured
/// - Null stdin to prevent child processes from blocking on input
pub fn silent_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Stdio;
        // CREATE_NO_WINDOW — prevents the child process from creating a
        // visible console window, even when the parent is a GUI-subsystem app.
        cmd.creation_flags(0x0800_0000);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
    }

    cmd
}

/// Async variant of [`silent_command`] returning a [`tokio::process::Command`].
///
/// Use this inside `async fn` blocks where you need `.output().await`.
pub fn silent_async_command(program: &str) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut cmd = tokio::process::Command::new(program);

    #[cfg(windows)]
    {
        use std::process::Stdio;
        cmd.creation_flags(0x0800_0000);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
    }

    cmd
}

/// Run a command to its end, or give up once `limit` has passed.
///
/// `Ok(None)` means the command did not finish in time. Everything it started
/// has then been killed, including programs that outlived the command itself:
/// such a program keeps the output pipes open, and waiting for the pipes to
/// close is exactly what never ends. Dropping the returned future before it
/// finishes cleans up the same way.
///
/// The wait never blocks the async runtime, unlike
/// `silent_command(..).output()` inside an `async fn`.
///
/// Build `command` with [`silent_async_command`]. Its output is captured and
/// its input is closed, whatever the command was configured with.
pub async fn output_within(
    mut command: tokio::process::Command,
    limit: Duration,
) -> std::io::Result<Option<Output>> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    // The leader of its own process group: the group is what gets killed.
    #[cfg(unix)]
    command.process_group(0);

    let child = command.spawn()?;
    let mut started = ProcessTree::of(&child);

    match tokio::time::timeout(limit, child.wait_with_output()).await {
        Ok(result) => {
            started.finished = result.is_ok();
            result.map(Some)
        }
        Err(_) => Ok(None),
    }
}

/// A command and everything it started. Dropping it kills them all, unless
/// the command came to its end first.
struct ProcessTree {
    #[cfg(unix)]
    group: Option<libc::pid_t>,
    #[cfg(windows)]
    job: Option<Job>,
    finished: bool,
}

impl ProcessTree {
    fn of(child: &tokio::process::Child) -> Self {
        #[cfg(not(any(unix, windows)))]
        let _ = child;
        Self {
            #[cfg(unix)]
            group: child.id().and_then(|pid| libc::pid_t::try_from(pid).ok()),
            #[cfg(windows)]
            job: child.raw_handle().and_then(Job::holding),
            finished: false,
        }
    }
}

impl Drop for ProcessTree {
    fn drop(&mut self) {
        if self.finished {
            return;
        }
        #[cfg(unix)]
        if let Some(group) = self.group {
            // SAFETY: `killpg` takes two integers and touches no memory. The
            // group is the one `output_within` created for this command; it
            // exists for as long as one of its processes does.
            unsafe {
                libc::killpg(group, libc::SIGKILL);
            }
        }
        #[cfg(windows)]
        if let Some(job) = &self.job {
            job.terminate();
        }
    }
}

/// A Windows job object: the system's own record of a process and of all it
/// starts, which stays valid when the first process is gone.
#[cfg(windows)]
struct Job(windows::Win32::Foundation::HANDLE);

// SAFETY: a job handle is not tied to the thread that opened it.
#[cfg(windows)]
unsafe impl Send for Job {}

#[cfg(windows)]
impl Job {
    /// A job holding `process` and, from now on, whatever it starts.
    fn holding(process: std::os::windows::io::RawHandle) -> Option<Self> {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::JobObjects::{AssignProcessToJobObject, CreateJobObjectW};
        use windows::core::PCWSTR;

        // SAFETY: an unnamed job with default security, no pointer involved.
        let job = Self(unsafe { CreateJobObjectW(None, PCWSTR::null()) }.ok()?);
        // SAFETY: both handles are open: the job was just created, and the
        // caller holds the child whose handle `process` is.
        unsafe { AssignProcessToJobObject(job.0, HANDLE(process)) }.ok()?;
        Some(job)
    }

    fn terminate(&self) {
        // SAFETY: the handle stays open until `drop`.
        let _ = unsafe { windows::Win32::System::JobObjects::TerminateJobObject(self.0, 1) };
    }
}

#[cfg(windows)]
impl Drop for Job {
    fn drop(&mut self) {
        // SAFETY: the handle was opened by `holding` and is closed only here.
        let _ = unsafe { windows::Win32::Foundation::CloseHandle(self.0) };
    }
}

/// Show a platform-native dialog to ask the user for an enrollment token.
///
/// Returns `Some(token)` if the user entered a non-empty token, `None` if
/// cancelled or empty. Used both for initial enrollment and re-enrollment.
#[cfg(target_os = "windows")]
pub fn show_enrollment_dialog() -> Option<String> {
    let script = r#"
        Add-Type -AssemblyName Microsoft.VisualBasic
        $token = [Microsoft.VisualBasic.Interaction]::InputBox(
            "Pour enrôler cet agent, entrez le token d'enrôlement fourni par votre administrateur.`n`nVous pouvez obtenir ce token depuis:`nSentinel GRC → Paramètres → Agents → Enrôler un Agent",
            "Sentinel Agent - Enrôlement",
            ""
        )
        Write-Output $token
    "#;

    let output = silent_command("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

/// Show a platform-native dialog to ask the user for an enrollment token.
#[cfg(target_os = "macos")]
pub fn show_enrollment_dialog() -> Option<String> {
    let script = r#"
        set dialogResult to display dialog "Bienvenue dans Sentinel Agent!

Pour enrôler cet agent, entrez le token d'enrôlement fourni par votre administrateur.

Vous pouvez obtenir ce token depuis:
Sentinel GRC → Paramètres → Agents → Enrôler un Agent" default answer "" with title "Sentinel Agent - Enrôlement" with icon note buttons {"Annuler", "Enrôler"} default button "Enrôler"
        if button returned of dialogResult is "Enrôler" then
            return text returned of dialogResult
        else
            return ""
        end if
    "#;

    let output = silent_command("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .ok()?;

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() { None } else { Some(token) }
}

/// Show a platform-native dialog to ask the user for an enrollment token.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn show_enrollment_dialog() -> Option<String> {
    // Linux - try zenity, then kdialog
    let zenity = silent_command("zenity")
        .args([
            "--entry",
            "--title=Sentinel Agent - Enrôlement",
            "--text=Entrez le token d'enrôlement fourni par votre administrateur:",
        ])
        .output();

    if let Ok(output) = zenity {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    let kdialog = silent_command("kdialog")
        .args([
            "--inputbox",
            "Entrez le token d'enrôlement fourni par votre administrateur:",
            "--title",
            "Sentinel Agent - Enrôlement",
        ])
        .output();

    if let Ok(output) = kdialog {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    /// A command that stays for a minute unless something stops it.
    fn a_minute() -> tokio::process::Command {
        #[cfg(windows)]
        {
            let mut command = silent_async_command("powershell");
            command.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 60"]);
            command
        }
        #[cfg(not(windows))]
        {
            let mut command = silent_async_command("sh");
            command.args(["-c", "sleep 60"]);
            command
        }
    }

    /// A command that starts a second process lasting five minutes and writes
    /// that process's identifier in the file named by `PIDFILE`. It then
    /// waits for it, or ends at once and leaves it behind.
    fn with_a_second_process(pid_file: &std::path::Path, wait: bool) -> tokio::process::Command {
        #[cfg(windows)]
        let mut command = {
            // `-NoNewWindow`: the second process inherits the output pipes,
            // as the console opened by a `.msc` file does.
            let mut script = "$p = Start-Process ping -ArgumentList '-n','300','127.0.0.1' -PassThru -NoNewWindow; \
                              Set-Content -LiteralPath $env:PIDFILE -Value $p.Id"
                .to_string();
            if wait {
                script.push_str("; Wait-Process -Id $p.Id");
            }
            let mut command = silent_async_command("powershell");
            command.args(["-NoProfile", "-Command", &script]);
            command
        };
        #[cfg(not(windows))]
        let mut command = {
            let mut script = "sleep 300 & echo $! > \"$PIDFILE\"".to_string();
            if wait {
                script.push_str("; wait");
            }
            let mut command = silent_async_command("sh");
            command.args(["-c", &script]);
            command
        };
        command.env("PIDFILE", pid_file);
        command
    }

    /// Let `output_within` give up on a command that started a second
    /// process, then tell whether that process is still there a little later.
    ///
    /// The limit has to pass after the second process exists, and a shell can
    /// be slow to get there: PowerShell needed more than 20 s the first time
    /// it started on a CI machine. A run cut short before that point proves
    /// nothing, so it is done again with more time.
    async fn second_process_survives(wait: bool) -> bool {
        for limit in [5, 30, 120].map(Duration::from_secs) {
            let dir = tempfile::tempdir().expect("temporary directory");
            let pid_file = dir.path().join("second.pid");

            let output = output_within(with_a_second_process(&pid_file, wait), limit)
                .await
                .expect("the command starts");
            assert!(output.is_none(), "the second process holds the output open");

            let recorded = std::fs::read_to_string(&pid_file).unwrap_or_default();
            let Ok(pid) = recorded
                .trim()
                .trim_start_matches('\u{feff}')
                .parse::<u32>()
            else {
                continue;
            };
            let deadline = Instant::now() + Duration::from_secs(10);
            while is_running(pid) && Instant::now() < deadline {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            return is_running(pid);
        }
        panic!("the command never got as far as starting its second process");
    }

    fn is_running(pid: u32) -> bool {
        #[cfg(windows)]
        {
            let listing = silent_command("tasklist")
                .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
                .output()
                .expect("tasklist runs");
            String::from_utf8_lossy(&listing.stdout).contains(&format!("\"{pid}\""))
        }
        #[cfg(not(windows))]
        {
            // SAFETY: signal 0 only asks whether the process exists.
            unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
        }
    }

    #[tokio::test]
    async fn a_command_that_finishes_in_time_gives_its_output() {
        #[cfg(windows)]
        let mut command = silent_async_command("cmd");
        #[cfg(windows)]
        command.args(["/C", "echo sentinel"]);
        #[cfg(not(windows))]
        let mut command = silent_async_command("sh");
        #[cfg(not(windows))]
        command.args(["-c", "echo sentinel"]);

        let output = output_within(command, Duration::from_secs(60))
            .await
            .expect("the command starts")
            .expect("the command finishes in time");

        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "sentinel");
    }

    #[tokio::test]
    async fn a_command_that_does_not_finish_is_given_up_at_the_limit() {
        let start = Instant::now();

        let output = output_within(a_minute(), Duration::from_millis(500))
            .await
            .expect("the command starts");

        assert!(
            output.is_none(),
            "a command killed at the limit has no output"
        );
        assert!(
            start.elapsed() < Duration::from_secs(30),
            "gave up after {:?}, the command itself lasts 60s",
            start.elapsed()
        );
    }

    #[tokio::test]
    async fn waiting_for_a_command_leaves_the_runtime_free() {
        // On the single thread of this runtime, a blocking wait would keep
        // the ticker from running at all.
        let ticks = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let counter = ticks.clone();
        let ticker = tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(20)).await;
                counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
        });

        let output = output_within(a_minute(), Duration::from_millis(600)).await;
        ticker.abort();

        assert!(matches!(output, Ok(None)));
        assert!(
            ticks.load(std::sync::atomic::Ordering::Relaxed) >= 3,
            "other tasks must run while the command is awaited"
        );
    }

    #[tokio::test]
    async fn what_the_command_started_is_killed_with_it() {
        assert!(
            !second_process_survives(true).await,
            "a process outlived the command that waited for it"
        );
    }

    /// What blocked the Windows backup check: the command had ended long
    /// before, and a program it had started was holding its output open.
    #[tokio::test]
    async fn what_the_command_left_behind_is_killed_too() {
        assert!(
            !second_process_survives(false).await,
            "a process was left behind by a command that had ended"
        );
    }

    #[tokio::test]
    async fn a_program_that_does_not_exist_is_an_error_not_a_timeout() {
        let command = silent_async_command("sentinel-no-such-program");

        let result = output_within(command, Duration::from_secs(5)).await;

        assert!(result.is_err());
    }
}
