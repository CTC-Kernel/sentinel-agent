// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! YARA scanning of files, through the `sentinel-yara` helper.
//!
//! The YARA engine (YARA-X) runs in a separate program, built from
//! `tools/sentinel-yara`: its dependencies cannot live in the agent's
//! workspace, and scanning untrusted files is better done outside the agent's
//! own process. The agent starts the helper when it finds it next to its own
//! binary and rules are present in the `yara.d` directory of its data
//! directory; without either, YARA scanning is simply off.
//!
//! The helper compiles the rules once, then answers one line per file to
//! scan (see the helper's documentation for the protocol).

use super::{IncidentSeverity, IncidentType, SecurityIncident};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Stdio};
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::Duration;
use tracing::{debug, warn};

/// Time allowed to the helper to compile the rules.
const START_TIMEOUT: Duration = Duration::from_secs(180);
/// Time allowed for one answer (the helper gives a scan 30 seconds).
const ANSWER_TIMEOUT: Duration = Duration::from_secs(45);

/// Name of the helper program.
pub const HELPER_NAME: &str = if cfg!(windows) {
    "sentinel-yara.exe"
} else {
    "sentinel-yara"
};

/// A rule that matched a file.
#[derive(Debug, Clone, PartialEq)]
pub struct YaraMatch {
    pub rule: String,
    /// The rule file, relative to the rules directory.
    pub namespace: String,
    pub tags: Vec<String>,
    /// The rule's `meta` section.
    pub meta: serde_json::Map<String, serde_json::Value>,
}

/// Outcome of starting the helper.
#[derive(Debug, Default, PartialEq)]
pub struct YaraLoadReport {
    /// Rules compiled.
    pub rules: usize,
    /// Rule files left out, with the reason.
    pub errors: Vec<String>,
}

/// Read the helper's first line.
pub(crate) fn parse_ready(line: &str) -> Option<YaraLoadReport> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    if value.get("ready")?.as_bool()? {
        Some(YaraLoadReport {
            rules: usize::try_from(value.get("rules")?.as_u64()?).ok()?,
            errors: value
                .get("errors")
                .and_then(|errors| errors.as_array())
                .map(|errors| {
                    errors
                        .iter()
                        .filter_map(|e| e.as_str())
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default(),
        })
    } else {
        None
    }
}

/// Read the helper's answer for one file.
pub(crate) fn parse_answer(line: &str) -> Result<Vec<YaraMatch>, String> {
    let value: serde_json::Value =
        serde_json::from_str(line).map_err(|e| format!("unreadable answer: {e}"))?;
    if let Some(error) = value.get("error").and_then(|e| e.as_str()) {
        return Err(error.to_string());
    }
    let matches = value
        .get("matches")
        .and_then(|matches| matches.as_array())
        .ok_or_else(|| "answer has no matches".to_string())?;
    Ok(matches
        .iter()
        .filter_map(|entry| {
            Some(YaraMatch {
                rule: entry.get("rule")?.as_str()?.to_string(),
                namespace: entry
                    .get("namespace")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string(),
                tags: entry
                    .get("tags")
                    .and_then(|tags| tags.as_array())
                    .map(|tags| {
                        tags.iter()
                            .filter_map(|t| t.as_str())
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default(),
                meta: entry
                    .get("meta")
                    .and_then(|meta| meta.as_object())
                    .cloned()
                    .unwrap_or_default(),
            })
        })
        .collect())
}

/// Where the helper is expected: the path given by `SENTINEL_YARA_HELPER`,
/// else beside the agent's own binary.
pub fn helper_path() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("SENTINEL_YARA_HELPER").map(PathBuf::from) {
        return path.is_file().then_some(path);
    }
    let beside = std::env::current_exe().ok()?.parent()?.join(HELPER_NAME);
    beside.is_file().then_some(beside)
}

/// A running helper.
pub struct YaraScanner {
    child: Child,
    stdin: ChildStdin,
    lines: Receiver<String>,
}

impl YaraScanner {
    /// Start `helper` on the rules of `rules_dir`.
    ///
    /// Both must be trusted: on Unix, owned by root or the agent's user and
    /// writable by nobody else (the helper runs with the agent's rights, and
    /// whoever writes the rules decides what is detected).
    pub fn start(helper: &Path, rules_dir: &Path) -> Result<(Self, YaraLoadReport), String> {
        for path in [helper, rules_dir] {
            crate::checks::custom::is_trusted(path)
                .map_err(|reason| format!("{} is not used: it {reason}", path.display()))?;
        }
        let mut child = std::process::Command::new(helper)
            .arg(rules_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("{} could not be started: {e}", helper.display()))?;
        let (Some(stdin), Some(stdout)) = (child.stdin.take(), child.stdout.take()) else {
            let _ = child.kill();
            return Err("the YARA helper has no input or output".to_string());
        };

        // Answers are read by a thread, so a helper that stops answering
        // cannot hang the agent.
        let (tx, lines) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if tx.send(line).is_err() {
                    break;
                }
            }
        });

        let mut scanner = Self {
            child,
            stdin,
            lines,
        };
        let report = scanner
            .next_line(START_TIMEOUT)
            .and_then(|line| {
                parse_ready(&line).ok_or_else(|| "unexpected first answer".to_string())
            })
            .map_err(|e| format!("the YARA helper did not start: {e}"))?;
        Ok((scanner, report))
    }

    fn next_line(&mut self, timeout: Duration) -> Result<String, String> {
        match self.lines.recv_timeout(timeout) {
            Ok(line) => Ok(line),
            Err(RecvTimeoutError::Timeout) => {
                // It will not be asked again: stop it.
                let _ = self.child.kill();
                Err("no answer in time".to_string())
            }
            Err(RecvTimeoutError::Disconnected) => Err("the helper has stopped".to_string()),
        }
    }

    /// The rules matching a file.
    pub fn scan(&mut self, path: &Path) -> Result<Vec<YaraMatch>, String> {
        let text = path.to_str().ok_or("path is not valid UTF-8")?;
        // One path per line: a path holding a line break cannot be sent.
        if text.contains(['\n', '\r']) {
            return Err("path contains a line break".to_string());
        }
        writeln!(self.stdin, "{text}")
            .and_then(|()| self.stdin.flush())
            .map_err(|e| format!("the helper has stopped: {e}"))?;
        let answer = self.next_line(ANSWER_TIMEOUT)?;
        parse_answer(&answer)
    }
}

impl Drop for YaraScanner {
    fn drop(&mut self) {
        if let Err(e) = self.child.kill() {
            debug!("YARA helper was already stopped: {}", e);
        }
        let _ = self.child.wait();
    }
}

/// Severity a rule asks for in its `meta` section: `severity` (critical,
/// high, medium, low), else `score` (0-100, as in community rule sets);
/// high when it says nothing.
fn match_severity(found: &YaraMatch) -> IncidentSeverity {
    if let Some(severity) = found.meta.get("severity").and_then(|v| v.as_str()) {
        match severity.trim().to_ascii_lowercase().as_str() {
            "critical" => return IncidentSeverity::Critical,
            "high" => return IncidentSeverity::High,
            "medium" => return IncidentSeverity::Medium,
            "low" | "info" | "informational" => return IncidentSeverity::Low,
            _ => {}
        }
    }
    match found.meta.get("score").and_then(|v| v.as_i64()) {
        Some(score) if score >= 90 => IncidentSeverity::Critical,
        Some(score) if score >= 70 => IncidentSeverity::High,
        Some(score) if score >= 40 => IncidentSeverity::Medium,
        Some(_) => IncidentSeverity::Low,
        None => IncidentSeverity::High,
    }
}

fn severity_rank(severity: IncidentSeverity) -> u8 {
    match severity {
        IncidentSeverity::Critical => 3,
        IncidentSeverity::High => 2,
        IncidentSeverity::Medium => 1,
        IncidentSeverity::Low => 0,
    }
}

/// The incident for a file matching YARA rules: one incident per file, at
/// the severity of its most severe rule. `None` without a match.
pub fn incident(path: &Path, matches: &[YaraMatch]) -> Option<SecurityIncident> {
    let worst = matches
        .iter()
        .max_by_key(|found| severity_rank(match_severity(found)))?;
    let names: Vec<&str> = matches.iter().map(|found| found.rule.as_str()).collect();
    let description = worst
        .meta
        .get("description")
        .and_then(|v| v.as_str())
        .filter(|d| !d.trim().is_empty())
        .map(|d| format!("{} — {d}", path.display()))
        .unwrap_or_else(|| format!("{} matches YARA rule {}", path.display(), worst.rule));
    Some(
        SecurityIncident::new(
            IncidentType::Malware,
            match_severity(worst),
            format!("YARA: {}", names.join(", ")),
            description,
        )
        .with_confidence(85)
        .with_evidence(serde_json::json!({
            "detection": "yara",
            "path": path,
            "rules": matches.iter().map(|found| serde_json::json!({
                "rule": found.rule,
                "namespace": found.namespace,
                "tags": found.tags,
                "meta": found.meta,
            })).collect::<Vec<_>>(),
        })),
    )
}

/// Start the helper when it is installed and rules are present. `None` when
/// YARA scanning is off, with the reason logged when it is unexpected.
pub fn start_if_available(rules_dir: &Path) -> Option<(YaraScanner, YaraLoadReport)> {
    if !rules_dir.is_dir() {
        return None;
    }
    let Some(helper) = helper_path() else {
        warn!(
            "YARA rules are present in {} but the {} helper is not installed beside the agent",
            rules_dir.display(),
            HELPER_NAME
        );
        return None;
    };
    match YaraScanner::start(&helper, rules_dir) {
        Ok(started) => Some(started),
        Err(e) => {
            warn!("YARA scanning is off: {}", e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn helper_lines_are_read() {
        assert_eq!(
            parse_ready(
                r#"{"ready":true,"rules":2,"errors":["broken.yar: error[E009]: unknown identifier"]}"#
            ),
            Some(YaraLoadReport {
                rules: 2,
                errors: vec!["broken.yar: error[E009]: unknown identifier".to_string()],
            })
        );
        assert_eq!(parse_ready(r#"{"ready":false}"#), None);
        assert_eq!(parse_ready("usage: sentinel-yara <rules directory>"), None);

        let matches = parse_answer(
            r#"{"path":"/tmp/x","matches":[{"rule":"Test_Marker","namespace":"eicar.yar","tags":["test"],"meta":{"severity":"high","score":80}},{"rule":"Bare"}]}"#,
        )
        .unwrap();
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].rule, "Test_Marker");
        assert_eq!(matches[0].namespace, "eicar.yar");
        assert_eq!(matches[0].tags, ["test"]);
        assert_eq!(matches[0].meta["score"], 80);
        assert!(matches[1].tags.is_empty() && matches[1].meta.is_empty());

        assert!(
            parse_answer(r#"{"path":"/tmp/x","matches":[]}"#)
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            parse_answer(r#"{"path":"/tmp/x","matches":[],"error":"file is too large to scan"}"#),
            Err("file is too large to scan".to_string())
        );
        assert!(parse_answer("not json").is_err());
        assert!(parse_answer("{}").is_err());
    }

    fn found(rule: &str, meta: serde_json::Value) -> YaraMatch {
        YaraMatch {
            rule: rule.to_string(),
            namespace: "rules.yar".to_string(),
            tags: Vec::new(),
            meta: meta.as_object().cloned().unwrap_or_default(),
        }
    }

    #[test]
    fn severity_comes_from_the_rule_metadata() {
        use serde_json::json;
        let severity = |meta| match_severity(&found("r", meta));
        assert_eq!(
            severity(json!({ "severity": "Critical" })),
            IncidentSeverity::Critical
        );
        assert_eq!(
            severity(json!({ "severity": "low" })),
            IncidentSeverity::Low
        );
        // An unknown word falls back to the score, then to the default.
        assert_eq!(
            severity(json!({ "severity": "?", "score": 95 })),
            IncidentSeverity::Critical
        );
        assert_eq!(severity(json!({ "score": 75 })), IncidentSeverity::High);
        assert_eq!(severity(json!({ "score": 50 })), IncidentSeverity::Medium);
        assert_eq!(severity(json!({ "score": 10 })), IncidentSeverity::Low);
        assert_eq!(severity(json!({})), IncidentSeverity::High);
    }

    #[test]
    fn one_incident_per_file_at_its_worst_rule() {
        use serde_json::json;
        let path = Path::new("/Users/alice/Downloads/invoice.exe");
        assert!(incident(path, &[]).is_none());

        let matches = [
            found("Packed_Binary", json!({ "severity": "medium" })),
            found(
                "Known_Stealer",
                json!({ "severity": "critical", "description": "Voleur d'identifiants" }),
            ),
        ];
        let incident = incident(path, &matches).unwrap();
        assert_eq!(incident.incident_type, IncidentType::Malware);
        assert_eq!(incident.severity, IncidentSeverity::Critical);
        assert_eq!(incident.title, "YARA: Packed_Binary, Known_Stealer");
        assert_eq!(
            incident.description,
            "/Users/alice/Downloads/invoice.exe — Voleur d'identifiants"
        );
        assert_eq!(incident.evidence["detection"], "yara");
        assert_eq!(incident.evidence["rules"][1]["rule"], "Known_Stealer");

        let plain = super::incident(path, &[found("Bare", json!({}))]).unwrap();
        assert_eq!(
            plain.description,
            "/Users/alice/Downloads/invoice.exe matches YARA rule Bare"
        );
    }

    /// A stand-in helper speaking the protocol, to test the dialogue.
    #[cfg(unix)]
    fn fake_helper(dir: &Path, script: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let path = dir.join("sentinel-yara");
        std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    #[cfg(unix)]
    #[test]
    fn dialogue_with_the_helper() {
        let dir = tempfile::tempdir().unwrap();
        let rules = dir.path().join("yara.d");
        std::fs::create_dir(&rules).unwrap();
        let helper = fake_helper(
            dir.path(),
            r#"echo '{"ready":true,"rules":1,"errors":[]}'
while IFS= read -r path; do
  case "$path" in
    *bad*) echo "{\"path\":\"$path\",\"matches\":[{\"rule\":\"Bad_File\",\"namespace\":\"r.yar\",\"tags\":[],\"meta\":{}}]}" ;;
    *) echo "{\"path\":\"$path\",\"matches\":[]}" ;;
  esac
done"#,
        );

        let (mut scanner, report) = YaraScanner::start(&helper, &rules).unwrap();
        assert_eq!(
            report,
            YaraLoadReport {
                rules: 1,
                errors: Vec::new()
            }
        );
        assert!(
            scanner
                .scan(Path::new("/tmp/clean.txt"))
                .unwrap()
                .is_empty()
        );
        let matches = scanner.scan(Path::new("/tmp/bad.exe")).unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].rule, "Bad_File");
        assert!(
            scanner
                .scan(Path::new("/tmp/a\nb"))
                .unwrap_err()
                .contains("line break")
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_helper_that_is_not_one_is_refused() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let rules = dir.path().join("yara.d");
        std::fs::create_dir(&rules).unwrap();

        // Says something else than the expected first line.
        let helper = fake_helper(dir.path(), "echo 'usage: something'");
        let error = YaraScanner::start(&helper, &rules).err().unwrap();
        assert!(error.contains("did not start"), "{error}");

        // Stops at once.
        let helper = fake_helper(dir.path(), "exit 3");
        let error = YaraScanner::start(&helper, &rules).err().unwrap();
        assert!(error.contains("the helper has stopped"), "{error}");

        // Writable by everyone: not run at all.
        let helper = fake_helper(
            dir.path(),
            "echo '{\"ready\":true,\"rules\":0,\"errors\":[]}'",
        );
        std::fs::set_permissions(&helper, std::fs::Permissions::from_mode(0o777)).unwrap();
        let error = YaraScanner::start(&helper, &rules).err().unwrap();
        assert!(error.contains("writable by"), "{error}");

        // Rules anyone can write are not used either.
        let helper = fake_helper(
            dir.path(),
            "echo '{\"ready\":true,\"rules\":0,\"errors\":[]}'",
        );
        std::fs::set_permissions(&rules, std::fs::Permissions::from_mode(0o777)).unwrap();
        let error = YaraScanner::start(&helper, &rules).err().unwrap();
        assert!(error.contains("yara.d is not used"), "{error}");
        std::fs::set_permissions(&rules, std::fs::Permissions::from_mode(0o755)).unwrap();

        assert!(start_if_available(&dir.path().join("absent")).is_none());
    }
}
