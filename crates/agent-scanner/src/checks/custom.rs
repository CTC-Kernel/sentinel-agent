// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Custom compliance checks declared in TOML files.
//!
//! An organisation adds its own controls without rebuilding the agent: every
//! `*.toml` file of the checks directory (`<data dir>/checks.d`) declares one
//! or more checks, which then run, score and report like the built-in ones.
//!
//! ```toml
//! [[check]]
//! id = "custom_ssh_root_login"        # must start with "custom_"
//! name = "Connexion root par SSH désactivée"
//! description = "sshd ne doit pas accepter de connexion directe en root."
//! severity = "high"                   # critical, high, medium, low, info
//! category = "remote_access"          # optional, "general" by default
//! frameworks = ["ISO27001", "CIS"]    # optional
//! platforms = ["linux", "macos"]      # optional, every platform by default
//!
//! [check.file_content]                # exactly one probe per check
//! path = "/etc/ssh/sshd_config"
//! matches = '^\s*PermitRootLogin\s+no\b'
//! ```
//!
//! # Probes
//!
//! | Probe          | Passes when…                                                    |
//! |----------------|-----------------------------------------------------------------|
//! | `file_exists`  | the path exists (or not, with `exists = false`)                 |
//! | `file_content` | the file `matches` a regular expression, or has no line matching `not_matches` |
//! | `file_mode`    | (Unix) no permission bit beyond `max_mode`, and `owner_uid` if given |
//! | `command`      | the program exits with `exit_code` (0 by default) and its output `stdout_matches` / does not match `stdout_not_matches` |
//!
//! Regular expressions are matched line by line (`^` and `$` are line
//! boundaries).
//!
//! # Trust
//!
//! A `command` probe runs a program with the agent's privileges, so a check
//! file is as sensitive as the agent's configuration. On Unix a file is only
//! loaded when it and its directory belong to root or to the agent's user and
//! cannot be written by anyone else. Programs are given by absolute path and
//! run without a shell.

use crate::check::{Check, CheckOutput, CheckRegistry};
use crate::error::{ScannerError, ScannerResult};
use agent_common::frameworks::normalize_framework_id;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use regex::{Regex, RegexBuilder};
use serde::Deserialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

/// Every custom check identifier starts with this, so it can never replace a
/// built-in check.
pub const CUSTOM_ID_PREFIX: &str = "custom_";

const MAX_ID_CHARS: usize = 80;
const MAX_CHECK_FILE_BYTES: u64 = 1024 * 1024;
const MAX_PROBED_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_STDOUT_BYTES: usize = 256 * 1024;
const MAX_EVIDENCE_CHARS: usize = 2000;
const MAX_REGEX_SIZE: usize = 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_SECS: u64 = 10;
const MAX_COMMAND_TIMEOUT_SECS: u64 = 120;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CheckFile {
    #[serde(default)]
    check: Vec<CheckSpec>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CheckSpec {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    severity: CheckSeverity,
    #[serde(default)]
    category: Option<CheckCategory>,
    #[serde(default)]
    frameworks: Vec<String>,
    #[serde(default)]
    platforms: Vec<String>,
    #[serde(default)]
    pass_message: Option<String>,
    #[serde(default)]
    fail_message: Option<String>,
    #[serde(default)]
    file_exists: Option<FileExistsSpec>,
    #[serde(default)]
    file_content: Option<FileContentSpec>,
    #[serde(default)]
    file_mode: Option<FileModeSpec>,
    #[serde(default)]
    command: Option<CommandSpec>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileExistsSpec {
    path: PathBuf,
    #[serde(default = "default_true")]
    exists: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum IfMissing {
    #[default]
    Fail,
    Pass,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileContentSpec {
    path: PathBuf,
    #[serde(default)]
    matches: Option<String>,
    #[serde(default)]
    not_matches: Option<String>,
    #[serde(default)]
    if_missing: IfMissing,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileModeSpec {
    path: PathBuf,
    /// Octal permissions, e.g. "0640".
    max_mode: String,
    #[serde(default)]
    owner_uid: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CommandSpec {
    program: PathBuf,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    exit_code: Option<i32>,
    #[serde(default)]
    stdout_matches: Option<String>,
    #[serde(default)]
    stdout_not_matches: Option<String>,
    #[serde(default)]
    timeout_secs: Option<u64>,
}

fn default_true() -> bool {
    true
}

/// A validated probe, ready to run.
#[derive(Debug)]
enum Probe {
    FileExists {
        path: PathBuf,
        exists: bool,
    },
    FileContent {
        path: PathBuf,
        matches: Option<Regex>,
        not_matches: Option<Regex>,
        if_missing: IfMissing,
    },
    FileMode {
        path: PathBuf,
        max_mode: u32,
        owner_uid: Option<u32>,
    },
    Command {
        program: PathBuf,
        args: Vec<String>,
        exit_code: i32,
        stdout_matches: Option<Regex>,
        stdout_not_matches: Option<Regex>,
        timeout: Duration,
    },
}

/// A compliance check declared in a TOML file.
#[derive(Debug)]
pub struct CustomCheck {
    definition: CheckDefinition,
    probe: Probe,
    pass_message: String,
    fail_message: String,
}

fn compile(pattern: &str) -> Result<Regex, String> {
    RegexBuilder::new(pattern)
        .multi_line(true)
        .size_limit(MAX_REGEX_SIZE)
        .build()
        .map_err(|e| format!("invalid regular expression '{pattern}': {e}"))
}

/// Whether a path is absolute on Unix (`/etc/hosts`) or on Windows
/// (`C:\Windows`, `\\server\share`), whatever system reads the file: one
/// check file may hold checks for several platforms.
fn is_absolute_anywhere(path: &Path) -> bool {
    let text = path.to_string_lossy();
    let bytes = text.as_bytes();
    let drive = bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/');
    text.starts_with('/') || text.starts_with("\\\\") || drive
}

fn absolute(path: &Path, what: &str) -> Result<PathBuf, String> {
    if is_absolute_anywhere(path) {
        Ok(path.to_path_buf())
    } else {
        Err(format!(
            "{what} must be an absolute path, got '{}'",
            path.display()
        ))
    }
}

impl CustomCheck {
    /// Validate a declaration.
    fn from_spec(spec: CheckSpec) -> Result<Self, String> {
        let id = spec.id.trim().to_string();
        let suffix = id
            .strip_prefix(CUSTOM_ID_PREFIX)
            .ok_or_else(|| format!("id '{id}' must start with '{CUSTOM_ID_PREFIX}'"))?;
        let valid_id = !suffix.is_empty()
            && id.len() <= MAX_ID_CHARS
            && suffix
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_');
        if !valid_id {
            return Err(format!(
                "id '{id}' may only contain lowercase letters, digits and '_' after \
                 '{CUSTOM_ID_PREFIX}' ({MAX_ID_CHARS} characters at most)"
            ));
        }
        let name = spec.name.trim().to_string();
        if name.is_empty() {
            return Err(format!("check '{id}' has no name"));
        }

        let mut frameworks = Vec::new();
        for framework in &spec.frameworks {
            let canonical = normalize_framework_id(framework)
                .ok_or_else(|| format!("check '{id}': unknown framework '{framework}'"))?;
            if !frameworks.iter().any(|known| known == canonical) {
                frameworks.push(canonical.to_string());
            }
        }
        let mut platforms = Vec::new();
        for platform in &spec.platforms {
            let platform = platform.trim().to_ascii_lowercase();
            if !matches!(platform.as_str(), "windows" | "linux" | "macos") {
                return Err(format!(
                    "check '{id}': unknown platform '{platform}' (windows, linux or macos)"
                ));
            }
            platforms.push(platform);
        }

        let probes = [
            spec.file_exists.is_some(),
            spec.file_content.is_some(),
            spec.file_mode.is_some(),
            spec.command.is_some(),
        ]
        .iter()
        .filter(|declared| **declared)
        .count();
        if probes != 1 {
            return Err(format!(
                "check '{id}' must declare exactly one probe (file_exists, file_content, \
                 file_mode or command), found {probes}"
            ));
        }

        let in_check = |e: String| format!("check '{id}': {e}");
        let probe = if let Some(probe) = spec.file_exists {
            Probe::FileExists {
                path: absolute(&probe.path, "file_exists.path").map_err(in_check)?,
                exists: probe.exists,
            }
        } else if let Some(probe) = spec.file_content {
            if probe.matches.is_none() && probe.not_matches.is_none() {
                return Err(in_check(
                    "file_content needs 'matches' or 'not_matches'".to_string(),
                ));
            }
            Probe::FileContent {
                path: absolute(&probe.path, "file_content.path").map_err(in_check)?,
                matches: probe
                    .matches
                    .as_deref()
                    .map(compile)
                    .transpose()
                    .map_err(in_check)?,
                not_matches: probe
                    .not_matches
                    .as_deref()
                    .map(compile)
                    .transpose()
                    .map_err(in_check)?,
                if_missing: probe.if_missing,
            }
        } else if let Some(probe) = spec.file_mode {
            let max_mode = u32::from_str_radix(probe.max_mode.trim(), 8)
                .ok()
                .filter(|mode| *mode <= 0o7777)
                .ok_or_else(|| {
                    in_check(format!(
                        "file_mode.max_mode '{}' is not an octal permission such as \"0640\"",
                        probe.max_mode
                    ))
                })?;
            Probe::FileMode {
                path: absolute(&probe.path, "file_mode.path").map_err(in_check)?,
                max_mode,
                owner_uid: probe.owner_uid,
            }
        } else if let Some(probe) = spec.command {
            let timeout_secs = probe.timeout_secs.unwrap_or(DEFAULT_COMMAND_TIMEOUT_SECS);
            if timeout_secs == 0 || timeout_secs > MAX_COMMAND_TIMEOUT_SECS {
                return Err(in_check(format!(
                    "command.timeout_secs must be between 1 and {MAX_COMMAND_TIMEOUT_SECS}"
                )));
            }
            Probe::Command {
                program: absolute(&probe.program, "command.program").map_err(in_check)?,
                args: probe.args,
                exit_code: probe.exit_code.unwrap_or(0),
                stdout_matches: probe
                    .stdout_matches
                    .as_deref()
                    .map(compile)
                    .transpose()
                    .map_err(in_check)?,
                stdout_not_matches: probe
                    .stdout_not_matches
                    .as_deref()
                    .map(compile)
                    .transpose()
                    .map_err(in_check)?,
                timeout: Duration::from_secs(timeout_secs),
            }
        } else {
            return Err(in_check("no probe declared".to_string()));
        };

        let message = |custom: Option<String>, default: String| {
            custom
                .map(|m| m.trim().to_string())
                .filter(|m| !m.is_empty())
                .unwrap_or(default)
        };
        Ok(Self {
            pass_message: message(spec.pass_message, format!("{name}: compliant")),
            fail_message: message(spec.fail_message, format!("{name}: not compliant")),
            definition: CheckDefinition {
                id,
                name,
                description: spec.description.trim().to_string(),
                category: spec.category.unwrap_or(CheckCategory::General),
                severity: spec.severity,
                frameworks,
                enabled: true,
                platforms,
                parameters: json!({ "custom": true }),
                nfr_duration_ms: None,
            },
            probe,
        })
    }

    fn output(&self, passed: bool, evidence: serde_json::Value) -> CheckOutput {
        let output = if passed {
            CheckOutput::pass(&self.pass_message, evidence)
        } else {
            CheckOutput::fail(&self.fail_message, evidence)
        };
        output.with_metadata("custom", "true")
    }
}

/// Keep evidence short enough for the proof and the report.
fn excerpt(text: &str) -> String {
    let mut excerpt: String = text.chars().take(MAX_EVIDENCE_CHARS).collect();
    if text.chars().count() > MAX_EVIDENCE_CHARS {
        excerpt.push('…');
    }
    excerpt
}

/// Read a file to probe, up to the size cap.
fn read_probed_file(path: &Path) -> std::io::Result<String> {
    use std::io::Read;
    let mut bytes = Vec::new();
    std::fs::File::open(path)?
        .take(MAX_PROBED_FILE_BYTES)
        .read_to_end(&mut bytes)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[async_trait]
impl Check for CustomCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        match &self.probe {
            Probe::FileExists { path, exists } => {
                let found = path.exists();
                Ok(self.output(
                    found == *exists,
                    json!({ "probe": "file_exists", "path": path, "exists": found, "expected": exists }),
                ))
            }
            Probe::FileContent {
                path,
                matches,
                not_matches,
                if_missing,
            } => {
                let content = match read_probed_file(path) {
                    Ok(content) => content,
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                        return Ok(self.output(
                            *if_missing == IfMissing::Pass,
                            json!({ "probe": "file_content", "path": path, "missing": true }),
                        ));
                    }
                    Err(e) => {
                        return Err(ScannerError::CheckExecution(format!(
                            "cannot read {}: {e}",
                            path.display()
                        )));
                    }
                };
                let required = matches.as_ref().map(|regex| regex.find(&content));
                let forbidden = not_matches.as_ref().and_then(|regex| regex.find(&content));
                let passed = required.as_ref().is_none_or(Option::is_some) && forbidden.is_none();
                Ok(self.output(
                    passed,
                    json!({
                        "probe": "file_content",
                        "path": path,
                        "matched": required.flatten().map(|m| excerpt(m.as_str())),
                        "forbidden_match": forbidden.map(|m| excerpt(m.as_str())),
                    }),
                ))
            }
            Probe::FileMode {
                path,
                max_mode,
                owner_uid,
            } => file_mode_output(self, path, *max_mode, *owner_uid),
            Probe::Command {
                program,
                args,
                exit_code,
                stdout_matches,
                stdout_not_matches,
                timeout,
            } => {
                let mut command =
                    agent_common::process::silent_async_command(&program.to_string_lossy());
                command.args(args).kill_on_drop(true);
                let output = tokio::time::timeout(*timeout, command.output())
                    .await
                    .map_err(|_| {
                        ScannerError::Timeout(
                            u64::try_from(timeout.as_millis()).unwrap_or(u64::MAX),
                        )
                    })?
                    .map_err(|e| {
                        ScannerError::CheckExecution(format!(
                            "cannot run {}: {e}",
                            program.display()
                        ))
                    })?;
                let stdout_bytes = &output.stdout[..output.stdout.len().min(MAX_STDOUT_BYTES)];
                let stdout = String::from_utf8_lossy(stdout_bytes);
                let actual_code = output.status.code();
                let passed = actual_code == Some(*exit_code)
                    && stdout_matches
                        .as_ref()
                        .is_none_or(|regex| regex.is_match(&stdout))
                    && stdout_not_matches
                        .as_ref()
                        .is_none_or(|regex| !regex.is_match(&stdout));
                Ok(self.output(
                    passed,
                    json!({
                        "probe": "command",
                        "program": program,
                        "args": args,
                        "exit_code": actual_code,
                        "expected_exit_code": exit_code,
                        "stdout": excerpt(stdout.trim()),
                    }),
                ))
            }
        }
    }
}

#[cfg(unix)]
fn file_mode_output(
    check: &CustomCheck,
    path: &Path,
    max_mode: u32,
    owner_uid: Option<u32>,
) -> ScannerResult<CheckOutput> {
    use std::os::unix::fs::MetadataExt;
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(check.output(
                false,
                json!({ "probe": "file_mode", "path": path, "missing": true }),
            ));
        }
        Err(e) => {
            return Err(ScannerError::CheckExecution(format!(
                "cannot read {}: {e}",
                path.display()
            )));
        }
    };
    let mode = metadata.mode() & 0o7777;
    let passed = mode & !max_mode == 0 && owner_uid.is_none_or(|uid| metadata.uid() == uid);
    Ok(check.output(
        passed,
        json!({
            "probe": "file_mode",
            "path": path,
            "mode": format!("{mode:04o}"),
            "max_mode": format!("{max_mode:04o}"),
            "owner_uid": metadata.uid(),
            "expected_owner_uid": owner_uid,
        }),
    ))
}

#[cfg(not(unix))]
fn file_mode_output(
    _check: &CustomCheck,
    _path: &Path,
    _max_mode: u32,
    _owner_uid: Option<u32>,
) -> ScannerResult<CheckOutput> {
    Err(ScannerError::PlatformNotSupported(
        "file_mode probes need Unix permissions".to_string(),
    ))
}

/// Parse the checks declared in one TOML document.
///
/// Returns the valid checks and one message per invalid declaration; a
/// document that is not valid TOML yields no check at all.
pub fn parse_checks(document: &str) -> (Vec<CustomCheck>, Vec<String>) {
    let file: CheckFile = match toml::from_str(document) {
        Ok(file) => file,
        Err(e) => return (Vec::new(), vec![format!("invalid check file: {e}")]),
    };
    let mut checks = Vec::new();
    let mut errors = Vec::new();
    for spec in file.check {
        match CustomCheck::from_spec(spec) {
            Ok(check) => checks.push(check),
            Err(e) => errors.push(e),
        }
    }
    (checks, errors)
}

/// Whether a check file (or its directory) can be trusted: owned by root or
/// by the agent's user, and writable by nobody else.
#[cfg(unix)]
pub(crate) fn is_trusted(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::MetadataExt;
    let metadata = std::fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("is a symbolic link".to_string());
    }
    // SAFETY: geteuid has no preconditions.
    let own_uid = unsafe { libc::geteuid() };
    if metadata.uid() != 0 && metadata.uid() != own_uid {
        return Err(format!("is owned by uid {}", metadata.uid()));
    }
    if metadata.mode() & 0o022 != 0 {
        return Err("is writable by its group or by everyone".to_string());
    }
    Ok(())
}

#[cfg(not(unix))]
pub(crate) fn is_trusted(path: &Path) -> Result<(), String> {
    let metadata = std::fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("is a symbolic link".to_string());
    }
    Ok(())
}

/// Outcome of loading the custom checks.
#[derive(Debug, Default)]
pub struct CustomCheckReport {
    /// Identifiers of the checks registered.
    pub registered: Vec<String>,
    /// Files or declarations left out, with the reason.
    pub errors: Vec<String>,
}

/// Register the checks declared in the `*.toml` files of `dir`.
///
/// A missing directory is not an error. A declaration reusing the identifier
/// of a check already registered is refused.
pub fn register_custom_checks(registry: &mut CheckRegistry, dir: &Path) -> CustomCheckReport {
    let mut report = CustomCheckReport::default();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return report;
    };
    if let Err(reason) = is_trusted(dir) {
        report
            .errors
            .push(format!("{}: directory ignored, it {reason}", dir.display()));
        return report;
    }

    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "toml"))
        .collect();
    files.sort();

    for file in files {
        if let Err(reason) = is_trusted(&file) {
            report
                .errors
                .push(format!("{}: file ignored, it {reason}", file.display()));
            continue;
        }
        let too_large = std::fs::metadata(&file).is_ok_and(|m| m.len() > MAX_CHECK_FILE_BYTES);
        if too_large {
            report
                .errors
                .push(format!("{}: file ignored, it is too large", file.display()));
            continue;
        }
        let document = match std::fs::read_to_string(&file) {
            Ok(document) => document,
            Err(e) => {
                report.errors.push(format!("{}: {e}", file.display()));
                continue;
            }
        };
        let (checks, errors) = parse_checks(&document);
        report.errors.extend(
            errors
                .into_iter()
                .map(|e| format!("{}: {e}", file.display())),
        );
        for check in checks {
            let id = check.definition.id.clone();
            if registry.get(&id).is_some() {
                report.errors.push(format!(
                    "{}: check '{id}' is already defined",
                    file.display()
                ));
                continue;
            }
            registry.register(Arc::new(check));
            report.registered.push(id);
        }
    }

    if !report.registered.is_empty() {
        info!(
            "Registered {} custom compliance check(s) from {}",
            report.registered.len(),
            dir.display()
        );
    }
    for error in &report.errors {
        warn!("Custom compliance check not loaded: {}", error);
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    fn one(document: &str) -> CustomCheck {
        let (mut checks, errors) = parse_checks(document);
        assert!(errors.is_empty(), "unexpected errors: {errors:?}");
        assert_eq!(checks.len(), 1);
        checks.remove(0)
    }

    fn error(document: &str) -> String {
        let (checks, errors) = parse_checks(document);
        assert!(checks.is_empty(), "the declaration should be refused");
        assert_eq!(errors.len(), 1, "{errors:?}");
        errors.into_iter().next().unwrap()
    }

    fn content_check(path: &Path, probe: &str) -> String {
        format!(
            "[[check]]\nid = \"custom_test\"\nname = \"Test\"\nseverity = \"high\"\n\
             [check.file_content]\npath = '{}'\n{probe}\n",
            path.display()
        )
    }

    #[test]
    fn declaration_becomes_a_regular_check_definition() {
        let check = one(r#"
            [[check]]
            id = "custom_ssh_root_login"
            name = " Connexion root par SSH désactivée "
            description = "sshd ne doit pas accepter root."
            severity = "high"
            category = "remote_access"
            frameworks = ["iso 27001", "CIS", "ISO27001"]
            platforms = ["Linux", "macos"]

            [check.file_content]
            path = "/etc/ssh/sshd_config"
            matches = '^\s*PermitRootLogin\s+no\b'
        "#);
        let definition = check.definition();
        assert_eq!(definition.id, "custom_ssh_root_login");
        assert_eq!(definition.name, "Connexion root par SSH désactivée");
        assert_eq!(definition.severity, CheckSeverity::High);
        assert_eq!(definition.category, CheckCategory::RemoteAccess);
        assert_eq!(
            definition.frameworks,
            ["ISO_27001", "CIS_V8"],
            "canonical, once each"
        );
        assert_eq!(definition.platforms, ["linux", "macos"]);
        assert!(definition.enabled);
    }

    /// The example shipped in `config/` is the documentation users copy from:
    /// it must load without a single error.
    #[test]
    fn shipped_example_file_is_valid() {
        let example = include_str!("../../../../config/checks.example.toml");
        let (checks, errors) = parse_checks(example);
        assert!(errors.is_empty(), "{errors:?}");
        let ids: Vec<&str> = checks.iter().map(|c| c.definition().id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "custom_ssh_root_login",
                "custom_no_rhosts",
                "custom_shadow_permissions",
                "custom_guest_account_disabled",
                "custom_uac_enabled",
            ]
        );
    }

    #[test]
    fn absolute_paths_of_either_system_are_accepted() {
        for path in [
            "/etc/hosts",
            r"C:\Windows\System32\reg.exe",
            "D:/tools/x.exe",
            r"\\srv\share\x",
        ] {
            assert!(is_absolute_anywhere(Path::new(path)), "{path}");
        }
        for path in ["etc/hosts", "reg.exe", r"C:reg.exe", r"..\x", ""] {
            assert!(!is_absolute_anywhere(Path::new(path)), "{path}");
        }
    }

    #[test]
    fn invalid_declarations_are_refused_with_the_reason() {
        let base = "[[check]]\nname = \"N\"\nseverity = \"low\"\n";
        let probe = "[check.file_exists]\npath = \"/etc/hosts\"\n";

        assert!(error(&format!("{base}id = \"firewall\"\n{probe}")).contains("must start with"));
        assert!(error(&format!("{base}id = \"custom_Bad-Id\"\n{probe}")).contains("lowercase"));
        assert!(error(&format!("{base}id = \"custom_\"\n{probe}")).contains("lowercase"));
        assert!(error(&format!("{base}id = \"custom_a\"\n")).contains("exactly one probe"));
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n{probe}[check.command]\nprogram = \"/bin/true\"\n"
            ))
            .contains("found 2")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\nframeworks = [\"COBIT\"]\n{probe}"
            ))
            .contains("unknown framework 'COBIT'")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\nplatforms = [\"solaris\"]\n{probe}"
            ))
            .contains("unknown platform")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n[check.file_exists]\npath = \"etc/hosts\"\n"
            ))
            .contains("absolute path")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n[check.file_content]\npath = \"/etc/hosts\"\nmatches = \"(\"\n"
            ))
            .contains("invalid regular expression")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n[check.file_content]\npath = \"/etc/hosts\"\n"
            ))
            .contains("needs 'matches' or 'not_matches'")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n[check.command]\nprogram = \"true\"\n"
            ))
            .contains("absolute path")
        );
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\n[check.command]\nprogram = \"/bin/true\"\ntimeout_secs = 0\n"
            ))
            .contains("timeout_secs")
        );
        // A typo in a key is an error, not a silently ignored setting.
        assert!(
            error(&format!(
                "{base}id = \"custom_a\"\nseverty = \"high\"\n{probe}"
            ))
            .contains("invalid check file")
        );
        assert!(error("this is not toml").contains("invalid check file"));
    }

    #[test]
    fn one_bad_declaration_does_not_discard_the_others() {
        let (checks, errors) = parse_checks(
            "[[check]]\nid = \"custom_ok\"\nname = \"Ok\"\nseverity = \"low\"\n\
             [check.file_exists]\npath = \"/etc/hosts\"\n\
             [[check]]\nid = \"bad\"\nname = \"Bad\"\nseverity = \"low\"\n\
             [check.file_exists]\npath = \"/etc/hosts\"\n",
        );
        assert_eq!(checks.len(), 1);
        assert_eq!(errors.len(), 1);
        assert!(parse_checks("").0.is_empty() && parse_checks("").1.is_empty());
    }

    #[tokio::test]
    async fn file_exists_probe() {
        let dir = tempfile::tempdir().unwrap();
        let present = dir.path().join("present");
        std::fs::write(&present, "x").unwrap();
        let declare = |path: &Path, exists: bool| {
            format!(
                "[[check]]\nid = \"custom_test\"\nname = \"Test\"\nseverity = \"low\"\n\
                 pass_message = \"présent\"\nfail_message = \"absent\"\n\
                 [check.file_exists]\npath = '{}'\nexists = {exists}\n",
                path.display()
            )
        };

        let output = one(&declare(&present, true)).execute().await.unwrap();
        assert!(output.passed);
        assert_eq!(output.message, "présent");
        assert_eq!(
            output.metadata.get("custom").map(String::as_str),
            Some("true")
        );

        let output = one(&declare(&dir.path().join("absent"), true))
            .execute()
            .await
            .unwrap();
        assert!(!output.passed);
        assert_eq!(output.message, "absent");

        assert!(
            one(&declare(&dir.path().join("absent"), false))
                .execute()
                .await
                .unwrap()
                .passed
        );
        assert!(
            !one(&declare(&present, false))
                .execute()
                .await
                .unwrap()
                .passed
        );
    }

    #[tokio::test]
    async fn file_content_probe_matches_line_by_line() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("sshd_config");
        std::fs::write(
            &config,
            "# comment\nPort 22\nPermitRootLogin no\nPasswordAuthentication yes\n",
        )
        .unwrap();

        let required = one(&content_check(
            &config,
            r"matches = '^PermitRootLogin\s+no$'",
        ));
        let output = required.execute().await.unwrap();
        assert!(output.passed);
        assert_eq!(output.raw_data["matched"], "PermitRootLogin no");
        assert_eq!(output.message, "Test: compliant");

        let forbidden = one(&content_check(
            &config,
            r"not_matches = '^PasswordAuthentication\s+yes'",
        ));
        let output = forbidden.execute().await.unwrap();
        assert!(!output.passed);
        assert_eq!(
            output.raw_data["forbidden_match"],
            "PasswordAuthentication yes"
        );
        assert_eq!(output.message, "Test: not compliant");

        let both = one(&content_check(
            &config,
            "matches = '^Port 22$'\nnot_matches = '^PermitRootLogin\\s+yes'",
        ));
        assert!(both.execute().await.unwrap().passed);
    }

    #[tokio::test]
    async fn missing_file_fails_unless_declared_acceptable() {
        let dir = tempfile::tempdir().unwrap();
        let absent = dir.path().join("absent.conf");

        let strict = one(&content_check(&absent, "matches = 'x'"));
        let output = strict.execute().await.unwrap();
        assert!(!output.passed);
        assert_eq!(output.raw_data["missing"], true);

        let lenient = one(&content_check(
            &absent,
            "not_matches = 'x'\nif_missing = \"pass\"",
        ));
        assert!(lenient.execute().await.unwrap().passed);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn file_mode_probe_refuses_extra_permission_bits_and_wrong_owner() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("secret");
        std::fs::write(&secret, "x").unwrap();
        let owner = std::fs::metadata(&secret).unwrap().uid();
        let declare = |max_mode: &str, extra: &str| {
            format!(
                "[[check]]\nid = \"custom_test\"\nname = \"Test\"\nseverity = \"high\"\n\
                 [check.file_mode]\npath = '{}'\nmax_mode = \"{max_mode}\"\n{extra}\n",
                secret.display()
            )
        };

        std::fs::set_permissions(&secret, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(one(&declare("0640", "")).execute().await.unwrap().passed);
        assert!(
            one(&declare("0640", &format!("owner_uid = {owner}")))
                .execute()
                .await
                .unwrap()
                .passed
        );
        let wrong_owner = one(&declare(
            "0640",
            &format!("owner_uid = {}", owner.wrapping_add(1)),
        ));
        assert!(!wrong_owner.execute().await.unwrap().passed);

        std::fs::set_permissions(&secret, std::fs::Permissions::from_mode(0o644)).unwrap();
        let output = one(&declare("0640", "")).execute().await.unwrap();
        assert!(!output.passed, "world-readable exceeds 0640");
        assert_eq!(output.raw_data["mode"], "0644");

        assert!(error(&declare("rw-r-----", "")).contains("octal permission"));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn command_probe_checks_exit_code_and_output() {
        let declare = |probe: &str| {
            format!(
                "[[check]]\nid = \"custom_test\"\nname = \"Test\"\nseverity = \"medium\"\n\
                 [check.command]\n{probe}\n"
            )
        };

        let echo = one(&declare(
            "program = \"/bin/echo\"\nargs = [\"GuestEnabled\", \"0\"]\nstdout_matches = '0$'",
        ));
        let output = echo.execute().await.unwrap();
        assert!(output.passed);
        assert_eq!(output.raw_data["stdout"], "GuestEnabled 0");
        assert_eq!(output.raw_data["exit_code"], 0);

        let unwanted = one(&declare(
            "program = \"/bin/echo\"\nargs = [\"enabled\"]\nstdout_not_matches = 'enabled'",
        ));
        assert!(!unwanted.execute().await.unwrap().passed);

        // No shell: the argument is passed as is, not interpreted.
        let literal = one(&declare(
            "program = \"/bin/echo\"\nargs = [\"$(id)\"]\nstdout_matches = '^\\$\\(id\\)$'",
        ));
        assert!(literal.execute().await.unwrap().passed);

        let expected_failure = one(&declare("program = \"/usr/bin/false\"\nexit_code = 1"));
        assert!(expected_failure.execute().await.unwrap().passed);
        let unexpected_failure = one(&declare("program = \"/usr/bin/false\""));
        assert!(!unexpected_failure.execute().await.unwrap().passed);

        let slow = one(&declare(
            "program = \"/bin/sleep\"\nargs = [\"5\"]\ntimeout_secs = 1",
        ));
        assert!(matches!(
            slow.execute().await,
            Err(ScannerError::Timeout(1000))
        ));

        let absent = one(&declare("program = \"/nonexistent/program\""));
        assert!(matches!(
            absent.execute().await,
            Err(ScannerError::CheckExecution(_))
        ));
    }

    fn write_checks(dir: &Path, file: &str, id: &str) -> PathBuf {
        let path = dir.join(file);
        std::fs::write(
            &path,
            format!(
                "[[check]]\nid = \"{id}\"\nname = \"N\"\nseverity = \"low\"\n\
                 [check.file_exists]\npath = \"/etc/hosts\"\n"
            ),
        )
        .unwrap();
        path
    }

    #[test]
    fn directory_is_loaded_in_file_order_and_duplicates_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        write_checks(dir.path(), "b.toml", "custom_second");
        write_checks(dir.path(), "a.toml", "custom_first");
        write_checks(dir.path(), "c.toml", "custom_first");
        write_checks(dir.path(), "notes.txt", "custom_ignored");
        std::fs::write(dir.path().join("d.toml"), "not toml").unwrap();

        let mut registry = CheckRegistry::new();
        let report = register_custom_checks(&mut registry, dir.path());
        assert_eq!(report.registered, ["custom_first", "custom_second"]);
        assert_eq!(report.errors.len(), 2, "{:?}", report.errors);
        assert!(report.errors[0].contains("already defined"));
        assert!(report.errors[1].contains("invalid check file"));
        assert!(registry.get("custom_first").is_some());
        assert!(registry.get("custom_ignored").is_none());

        let report = register_custom_checks(&mut registry, &dir.path().join("absent"));
        assert!(report.registered.is_empty() && report.errors.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn files_others_can_write_are_not_trusted() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let open = write_checks(dir.path(), "open.toml", "custom_open");
        std::fs::set_permissions(&open, std::fs::Permissions::from_mode(0o666)).unwrap();
        let real = write_checks(dir.path(), "real.toml", "custom_real");
        std::os::unix::fs::symlink(&real, dir.path().join("link.toml")).unwrap();

        let mut registry = CheckRegistry::new();
        let report = register_custom_checks(&mut registry, dir.path());
        assert_eq!(report.registered, ["custom_real"]);
        assert_eq!(report.errors.len(), 2, "{:?}", report.errors);
        assert!(report.errors.iter().any(|e| e.contains("symbolic link")));
        assert!(report.errors.iter().any(|e| e.contains("writable by")));

        // A directory anyone can write to is ignored as a whole.
        std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o777)).unwrap();
        let mut registry = CheckRegistry::new();
        let report = register_custom_checks(&mut registry, dir.path());
        assert!(report.registered.is_empty());
        assert!(report.errors[0].contains("directory ignored"));
        std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
    }
}
