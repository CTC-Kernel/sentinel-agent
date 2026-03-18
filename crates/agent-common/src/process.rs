// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Process utilities for cross-platform command execution.
//!
//! On Windows, spawning `cmd.exe` or `powershell.exe` from a GUI-subsystem
//! process causes a visible console window to flash.  [`silent_command`]
//! applies `CREATE_NO_WINDOW` (0x0800_0000) automatically on Windows so that
//! child console processes remain invisible.

use std::process::Command;

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
        .or_else(|_| {
            serde_json::from_str::<serde_json::Value>(trimmed).map(|v| vec![v])
        })
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
