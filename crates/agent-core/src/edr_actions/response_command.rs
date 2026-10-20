// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! A response of the organisation's own.
//!
//! Killing a process, quarantining a file, blocking an address, locking an
//! account, isolating the host: the agent's own responses stop at the
//! machine. Opening a ticket, calling the on-call engineer, revoking a
//! token at the identity provider are the organisation's, and each has its
//! own tool. A response command is a program the organisation declares in
//! the agent's configuration; a playbook asks for it by name.
//!
//! ```json
//! "response_commands": [
//!   { "name": "open-ticket", "program": "/usr/local/bin/sentinel-ticket",
//!     "args": ["--queue", "soc"], "timeout_secs": 30 }
//! ]
//! ```
//!
//! The program receives on its standard input a JSON document saying which
//! playbook asked and what it matched (processes, addresses, files,
//! accounts). It succeeds by exiting with status 0.
//!
//! # Trust
//!
//! A playbook comes from the platform; a program run with the agent's
//! privileges must not. A playbook can therefore only *name* a command: what
//! runs is what the local configuration declares, nothing a playbook
//! carries is ever executed or passed as an argument. The program is given
//! by absolute path and run without a shell; it is refused unless it belongs
//! to root or to the agent's account (on Windows: SYSTEM, Administrators or
//! TrustedInstaller) and nobody else may write to it.

use agent_common::config::ResponseCommandConfig;
use agent_common::error::CommonError;
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use std::time::Duration;
use tracing::{info, warn};

/// Longest time a response command may be given.
const MAX_TIMEOUT_SECS: u64 = 600;
/// Largest document given to a command.
const MAX_CONTEXT_BYTES: usize = 256 * 1024;

fn commands() -> &'static RwLock<HashMap<String, ResponseCommandConfig>> {
    static COMMANDS: OnceLock<RwLock<HashMap<String, ResponseCommandConfig>>> = OnceLock::new();
    COMMANDS.get_or_init(|| RwLock::new(HashMap::new()))
}

/// Whether a name can be the name of a response command.
pub fn is_command_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '-' | '_'))
}

/// Why a program may not be run as a response, when it may not.
#[cfg(unix)]
pub(crate) fn untrusted(program: &std::path::Path) -> Option<String> {
    use std::os::unix::fs::MetadataExt;
    let metadata = match std::fs::metadata(program) {
        Ok(metadata) => metadata,
        Err(e) => return Some(format!("cannot be read: {e}")),
    };
    if !metadata.is_file() {
        return Some("is not a file".to_string());
    }
    // SAFETY: geteuid has no preconditions.
    let own = unsafe { libc::geteuid() };
    if metadata.uid() != 0 && metadata.uid() != own {
        return Some(format!("is owned by uid {}", metadata.uid()));
    }
    if metadata.mode() & 0o022 != 0 {
        return Some("is writable by its group or by everyone".to_string());
    }
    None
}

#[cfg(windows)]
pub(crate) fn untrusted(program: &std::path::Path) -> Option<String> {
    if !program.is_file() {
        return Some("is not a file".to_string());
    }
    agent_common::windows_acl::untrusted(program)
}

#[cfg(not(any(unix, windows)))]
pub(crate) fn untrusted(program: &std::path::Path) -> Option<String> {
    (!program.is_file()).then(|| "is not a file".to_string())
}

/// Why a declaration cannot be used, when it cannot.
pub fn declaration_error(command: &ResponseCommandConfig) -> Option<String> {
    program_error(&command.name, &command.program)
}

/// Why a program the configuration declares under `name` may not be run by
/// the agent, when it may not: the name is made of lower-case letters,
/// digits, `-` and `_`, the program is given by absolute path, owned by root
/// or the agent's account (on Windows: SYSTEM, Administrators or
/// TrustedInstaller), and writable by nobody else. The same rules for the
/// response commands and the watched commands.
pub fn program_error(name: &str, program: &str) -> Option<String> {
    if !is_command_name(name) {
        return Some(format!(
            "'{name}' is not a command name (lower-case letters, digits, '-' and '_')"
        ));
    }
    let path = std::path::Path::new(program);
    if !path.is_absolute() {
        return Some(format!(
            "'{name}': the program '{program}' is not given by absolute path"
        ));
    }
    untrusted(path).map(|reason| format!("'{name}': the program {program} {reason}"))
}

/// Take the response commands of the configuration. Returns the
/// declarations left out, with the reason.
pub fn configure(declared: &[ResponseCommandConfig]) -> Vec<String> {
    let mut errors = Vec::new();
    let mut accepted = HashMap::new();
    for command in declared {
        if let Some(error) = declaration_error(command) {
            errors.push(error);
        } else if accepted.contains_key(&command.name) {
            errors.push(format!("'{}' is declared twice", command.name));
        } else {
            accepted.insert(command.name.clone(), command.clone());
        }
    }
    if !accepted.is_empty() {
        info!("{} response command(s) declared", accepted.len());
    }
    *commands().write().unwrap_or_else(|e| e.into_inner()) = accepted;
    errors
}

/// Whether a response command of that name is declared.
pub fn is_declared(name: &str) -> bool {
    commands()
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .contains_key(name)
}

/// Run the response command `name`, giving it `context` on its standard
/// input.
pub async fn run_response_command(
    name: &str,
    context: &serde_json::Value,
) -> Result<(), CommonError> {
    use tokio::io::AsyncWriteExt;

    let command = commands()
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .get(name)
        .cloned()
        .ok_or_else(|| {
            CommonError::internal(format!(
                "no response command named '{name}' is declared in the agent's configuration"
            ))
        })?;
    // The program may have been replaced since the agent started.
    if let Some(reason) = untrusted(std::path::Path::new(&command.program)) {
        return Err(CommonError::internal(format!(
            "response command '{name}': the program {} {reason}",
            command.program
        )));
    }
    let mut document = serde_json::to_vec(context)
        .map_err(|e| CommonError::internal(format!("response command '{name}': {e}")))?;
    document.truncate(MAX_CONTEXT_BYTES);

    info!("Running response command '{}' ({})", name, command.program);
    let mut process = agent_common::process::silent_async_command(&command.program);
    process
        .args(&command.args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    let mut child = process.spawn().map_err(|e| {
        CommonError::internal(format!(
            "response command '{name}' could not be started: {e}"
        ))
    })?;
    if let Some(mut stdin) = child.stdin.take() {
        // A program that does not read its input is not an error.
        let _ = stdin.write_all(&document).await;
    }
    let timeout = Duration::from_secs(command.timeout_secs.clamp(1, MAX_TIMEOUT_SECS));
    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| {
            CommonError::internal(format!(
                "response command '{name}' did not finish in {}s and was stopped",
                timeout.as_secs()
            ))
        })?
        .map_err(|e| CommonError::internal(format!("response command '{name}' failed: {e}")))?;
    if output.status.success() {
        return Ok(());
    }
    let said = String::from_utf8_lossy(&output.stderr);
    let said = said.lines().next().unwrap_or("").trim();
    warn!(
        "Response command '{}' failed: {} {}",
        name, output.status, said
    );
    Err(CommonError::internal(format!(
        "response command '{name}' failed ({}){}{}",
        output.status,
        if said.is_empty() { "" } else { ": " },
        said.chars().take(200).collect::<String>()
    )))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    fn script(dir: &tempfile::TempDir, name: &str, body: &str) -> String {
        let path = dir.path().join(name);
        std::fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        path.to_string_lossy().to_string()
    }

    fn declared(name: &str, program: &str) -> ResponseCommandConfig {
        ResponseCommandConfig {
            name: name.to_string(),
            program: program.to_string(),
            args: Vec::new(),
            timeout_secs: 5,
        }
    }

    #[test]
    fn declarations_that_cannot_be_trusted_are_refused_with_the_reason() {
        let dir = tempfile::tempdir().unwrap();
        let good = script(&dir, "good", "exit 0");
        assert_eq!(declaration_error(&declared("open-ticket", &good)), None);

        let refused =
            |name: &str, program: &str| declaration_error(&declared(name, program)).unwrap();
        assert!(refused("Open Ticket", &good).contains("not a command name"));
        assert!(refused("x; id", &good).contains("not a command name"));
        assert!(refused("ticket", "bin/ticket").contains("not given by absolute path"));
        assert!(refused("ticket", "/nonexistent/sentinel-ticket").contains("cannot be read"));
        assert!(refused("ticket", &dir.path().to_string_lossy()).contains("is not a file"));

        // A program anyone may rewrite is anyone's program.
        let open = script(&dir, "open", "exit 0");
        std::fs::set_permissions(&open, std::fs::Permissions::from_mode(0o777)).unwrap();
        assert!(refused("ticket", &open).contains("writable by its group or by everyone"));
    }

    /// One test for the commands shared by the whole process.
    #[tokio::test]
    async fn a_declared_command_runs_with_the_context_and_an_undeclared_one_never() {
        let dir = tempfile::tempdir().unwrap();
        let received = dir.path().join("received.json");
        let record = script(
            &dir,
            "record",
            &format!(
                "cat > '{}'; echo \"$1\" >> '{}'",
                received.display(),
                received.display()
            ),
        );
        let failing = script(&dir, "failing", "echo 'queue unreachable' >&2; exit 3");
        let slow = script(&dir, "slow", "sleep 30");
        let mut with_argument = declared("record", &record);
        with_argument.args = vec!["--queue=soc".to_string()];
        let mut too_slow = declared("slow", &slow);
        too_slow.timeout_secs = 1;

        let errors = configure(&[
            with_argument,
            declared("failing", &failing),
            too_slow,
            declared("record", &record),
            declared("relative", "bin/x"),
        ]);
        assert_eq!(errors.len(), 2, "{errors:?}");
        assert!(errors.iter().any(|e| e.contains("declared twice")));
        assert!(is_declared("record") && !is_declared("relative"));

        let context = serde_json::json!({"playbook": "Brute force", "addresses": ["203.0.113.9"]});
        run_response_command("record", &context).await.unwrap();
        let received = std::fs::read_to_string(&received).unwrap();
        assert!(
            received.contains(r#""playbook":"Brute force""#),
            "{received}"
        );
        assert!(received.contains("203.0.113.9"));
        // The declared argument, and nothing of the playbook, is on the
        // command line.
        assert!(received.trim_end().ends_with("--queue=soc"));

        let error = run_response_command("failing", &context)
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("queue unreachable"), "{error}");
        let error = run_response_command("slow", &context)
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("did not finish in 1s"), "{error}");

        // What a playbook names and the configuration does not declare.
        let error = run_response_command("/bin/sh", &context)
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("no response command named"), "{error}");

        // A program opened to everyone after the agent started is refused.
        std::fs::set_permissions(&record, std::fs::Permissions::from_mode(0o777)).unwrap();
        let error = run_response_command("record", &context)
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("writable"), "{error}");
        configure(&[]);
    }
}
