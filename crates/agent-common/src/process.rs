// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Process utilities for cross-platform command execution.
//!
//! On Windows, spawning `cmd.exe` or `powershell.exe` from a GUI-subsystem
//! process causes a visible console window to flash.  [`silent_command`]
//! applies `CREATE_NO_WINDOW` (0x0800_0000) automatically on Windows so that
//! child console processes remain invisible.

use std::process::Command;

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
