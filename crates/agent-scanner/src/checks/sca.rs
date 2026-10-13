// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance policies in the SCA format.
//!
//! A policy is a YAML file listing checks; each check is a few rules about
//! the content of a file, the entries of a directory, a running process,
//! the output of a command or a value of the Windows registry. The format
//! is the one Wazuh uses for its Security Configuration Assessment, so a
//! policy written for it — an organisation's own, or a benchmark — runs on
//! the agent as it is, and its checks are scored and reported like the
//! built-in ones.
//!
//! ```yaml
//! policy:
//!   id: ssh_hardening
//!   name: Durcissement de SSH
//! requirements:                       # optional: when the policy applies
//!   condition: any
//!   rules:
//!     - 'f:/etc/ssh/sshd_config'
//! variables:
//!   $sshd: /etc/ssh/sshd_config
//! checks:
//!   - id: 1
//!     title: Connexion root interdite
//!     condition: all                  # all, any or none of the rules
//!     rules:
//!       - 'f:$sshd -> !r:^# && r:PermitRootLogin\s+no'
//!     compliance:
//!       - cis: ["5.2.10"]
//! ```
//!
//! # Rules
//!
//! | Rule                                   | True when…                                         |
//! |----------------------------------------|----------------------------------------------------|
//! | `f:/path`                              | the file exists                                    |
//! | `f:/path -> content`                   | a line of the file satisfies `content`             |
//! | `d:/dir`                               | the directory exists                               |
//! | `d:/dir -> name`                       | an entry of the directory satisfies `name`         |
//! | `d:/dir -> name -> content`            | a line of such an entry satisfies `content`        |
//! | `p:name`                               | a running process has that name                    |
//! | `c:command -> content`                 | a line of the command's output satisfies `content` |
//! | `r:KEY`                                | the registry key exists (Windows)                  |
//! | `r:KEY -> value`                       | the key has that value                             |
//! | `r:KEY -> value -> content`            | the data of that value satisfies `content` (a number is given in decimal) |
//!
//! `not ` before a rule inverts it. Several paths are separated by commas.
//!
//! `content` is one or several terms joined by ` && `, all of which one line
//! must satisfy; `!` before a term inverts it. A term is a literal (the
//! whole line, whatever the case), `r:` followed by a regular expression, or
//! `n:` followed by a regular expression with one group, `compare`, an
//! operator and a number (`n:^PASS_MAX_DAYS\s+(\d+) compare <= 365`).
//!
//! Regular expressions are in the OSSEC dialect unless the policy or the
//! check says `regex_type: pcre2`.
//!
//! # Outcome
//!
//! A rule that cannot be evaluated (the file whose content is asked for
//! does not exist, the command cannot run) is neither true nor false. A
//! check whose outcome depends on such a rule is reported as not
//! applicable, with the reason, and counts neither for nor against the
//! score.
//!
//! # Trust
//!
//! A `c:` rule runs a program with the agent's privileges: a policy file is
//! as sensitive as the agent's configuration. On Unix a file is only loaded
//! when it and its directory belong to root or to the agent's user and
//! cannot be written by anyone else. Programs are run without a shell.

use crate::check::{Check, CheckOutput, CheckRegistry};
use crate::error::ScannerResult;
use agent_common::frameworks::normalize_framework_id;
use agent_common::types::{CheckCategory, CheckDefinition, CheckSeverity};
use async_trait::async_trait;
use regex::{Regex, RegexBuilder};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{info, warn};
use yaml_rust2::{Yaml, YamlLoader};

/// Every policy check identifier starts with this.
pub const SCA_ID_PREFIX: &str = "sca_";

const MAX_POLICY_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_READ_BYTES: u64 = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES: usize = 512 * 1024;
const MAX_REGEX_SIZE: usize = 1024 * 1024;
const MAX_EVIDENCE_CHARS: usize = 300;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
/// Entries of a directory whose content is read at most for one rule.
const MAX_DIRECTORY_FILES: usize = 200;

/// The policies shipped with the agent (`crates/agent-scanner/policies`).
const BUILTIN_POLICIES: &[(&str, &str)] = &[
    ("linux.yml", include_str!("../../policies/linux.yml")),
    ("macos.yml", include_str!("../../policies/macos.yml")),
    ("windows.yml", include_str!("../../policies/windows.yml")),
];

/// Why something of the host could not be read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Unavailable {
    /// It does not exist.
    Missing,
    /// It exists, or may, but could not be read.
    Other(String),
}

/// What the rules ask of the system. A trait so that the evaluation is
/// tested against a system described in the test.
pub trait Host: Send + Sync {
    fn read_file(&self, path: &str) -> Result<String, Unavailable>;
    fn file_exists(&self, path: &str) -> bool;
    fn directory_exists(&self, path: &str) -> bool;
    /// Names of the entries of a directory.
    fn list_directory(&self, path: &str) -> Result<Vec<String>, Unavailable>;
    /// Names of the running processes.
    fn processes(&self) -> Vec<String>;
    /// Output of a command, standard output and error together.
    fn run(&self, command: &[String]) -> Result<String, Unavailable>;
    fn registry_key_exists(&self, key: &str) -> Result<bool, Unavailable>;
    /// Names and data of the values of a registry key.
    fn registry_values(&self, key: &str) -> Result<Vec<(String, String)>, Unavailable>;
}

/// The value of a rule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Truth {
    True,
    False,
    /// Could not be evaluated, and why.
    Unknown(String),
}

impl Truth {
    fn from(value: bool) -> Self {
        if value { Self::True } else { Self::False }
    }

    fn inverted(self) -> Self {
        match self {
            Self::True => Self::False,
            Self::False => Self::True,
            unknown => unknown,
        }
    }
}

/// Which regular expression dialect a policy is written in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RegexType {
    OsRegex,
    Pcre2,
}

impl RegexType {
    fn parse(text: &str) -> Result<Self, String> {
        match text.trim().to_ascii_lowercase().as_str() {
            "osregex" | "os_regex" => Ok(Self::OsRegex),
            "pcre2" | "pcre" => Ok(Self::Pcre2),
            other => Err(format!("regex_type '{other}' is not supported")),
        }
    }
}

/// Translate a regular expression of the OSSEC dialect.
///
/// In that dialect `\w`, `\d`, `\s`, `\p` (punctuation) and their upper-case
/// opposites are classes, `\.` is any character, a plain `.` is a dot, `+`
/// and `*` apply to the class before them, and `^`, `$`, `|` and
/// parentheses have their usual meaning.
pub fn osregex_to_regex(pattern: &str) -> String {
    let mut out = String::with_capacity(pattern.len() + 16);
    let mut chars = pattern.chars().peekable();
    // Whether what was just written can take `+` or `*`.
    let mut repeatable = false;
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                let class = match chars.next() {
                    Some('w') => "[A-Za-z0-9@_-]".to_string(),
                    Some('W') => "[^A-Za-z0-9@_-]".to_string(),
                    Some('d') => "[0-9]".to_string(),
                    Some('D') => "[^0-9]".to_string(),
                    Some('s') => r"\s".to_string(),
                    Some('S') => r"\S".to_string(),
                    Some('p') => r##"[()*+,\-.:;<=>?\[\]!"'#$%&|{}]"##.to_string(),
                    Some('t') => r"\t".to_string(),
                    Some('.') => ".".to_string(),
                    Some(other) => regex::escape(&other.to_string()),
                    None => r"\\".to_string(),
                };
                out.push_str(&class);
                repeatable = true;
            }
            '^' | '$' | '|' | '(' => {
                out.push(c);
                repeatable = false;
            }
            ')' => {
                out.push(c);
                repeatable = true;
            }
            '+' | '*' if repeatable => {
                out.push(c);
                repeatable = false;
            }
            other => {
                out.push_str(&regex::escape(&other.to_string()));
                repeatable = false;
            }
        }
    }
    out
}

fn compile(pattern: &str, regex_type: RegexType) -> Result<Regex, String> {
    let translated = match regex_type {
        RegexType::OsRegex => osregex_to_regex(pattern),
        RegexType::Pcre2 => pattern.to_string(),
    };
    RegexBuilder::new(&translated)
        .case_insensitive(regex_type == RegexType::OsRegex)
        .size_limit(MAX_REGEX_SIZE)
        .build()
        .map_err(|e| format!("invalid pattern '{pattern}': {e}"))
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Comparison {
    Lt,
    Lte,
    Eq,
    Ne,
    Gte,
    Gt,
}

impl Comparison {
    fn parse(operator: &str) -> Option<Self> {
        Some(match operator {
            "<" => Self::Lt,
            "<=" => Self::Lte,
            "==" | "=" => Self::Eq,
            "!=" => Self::Ne,
            ">=" => Self::Gte,
            ">" => Self::Gt,
            _ => return None,
        })
    }

    fn holds(self, left: f64, right: f64) -> bool {
        match self {
            Self::Lt => left < right,
            Self::Lte => left <= right,
            Self::Eq => (left - right).abs() < f64::EPSILON,
            Self::Ne => (left - right).abs() >= f64::EPSILON,
            Self::Gte => left >= right,
            Self::Gt => left > right,
        }
    }
}

/// How one term is matched against a line.
#[derive(Debug, Clone)]
enum Pattern {
    /// The whole line, whatever the case.
    Equals(String),
    Matches(Regex),
    /// The number the group captures, compared with a value.
    Number(Regex, Comparison, f64),
}

impl Pattern {
    fn parse(text: &str, regex_type: RegexType) -> Result<Self, String> {
        let text = text.trim();
        if let Some(pattern) = text.strip_prefix("r:") {
            return compile(pattern, regex_type).map(Self::Matches);
        }
        if let Some(rest) = text.strip_prefix("n:") {
            let (pattern, comparison) = rest
                .rsplit_once(" compare ")
                .ok_or_else(|| format!("'{text}' has no 'compare'"))?;
            let mut parts = comparison.split_whitespace();
            let operator = parts
                .next()
                .and_then(Comparison::parse)
                .ok_or_else(|| format!("'{text}' has no comparison operator"))?;
            let value = parts
                .next()
                .and_then(|value| value.parse::<f64>().ok())
                .ok_or_else(|| format!("'{text}' compares with something that is not a number"))?;
            let regex = compile(pattern.trim(), regex_type)?;
            if regex.captures_len() < 2 {
                return Err(format!("'{text}' has no group to take the number from"));
            }
            return Ok(Self::Number(regex, operator, value));
        }
        if let Some(prefix) = ["<:", ">:"]
            .iter()
            .find(|prefix| text.starts_with(**prefix))
        {
            return Err(format!("the '{prefix}' comparison is not supported"));
        }
        Ok(Self::Equals(
            text.strip_prefix("=:").unwrap_or(text).to_string(),
        ))
    }

    fn matches(&self, line: &str) -> bool {
        match self {
            Self::Equals(text) => line.trim().eq_ignore_ascii_case(text),
            Self::Matches(regex) => regex.is_match(line),
            Self::Number(regex, comparison, value) => regex
                .captures(line)
                .and_then(|captures| captures.get(1))
                .and_then(|number| number.as_str().trim().parse::<f64>().ok())
                .is_some_and(|number| comparison.holds(number, *value)),
        }
    }
}

/// Terms one line must all satisfy.
#[derive(Debug, Clone)]
struct Content {
    terms: Vec<(bool, Pattern)>,
}

impl Content {
    fn parse(text: &str, regex_type: RegexType) -> Result<Self, String> {
        let terms = text
            .split(" && ")
            .map(|term| {
                let term = term.trim();
                // `!r:…` inverts a term; a literal starting with `!` is rare
                // enough that the dialect has no way to write it either.
                match term.strip_prefix('!') {
                    Some(inverted) => Pattern::parse(inverted, regex_type).map(|p| (true, p)),
                    None => Pattern::parse(term, regex_type).map(|p| (false, p)),
                }
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self { terms })
    }

    fn line_matches(&self, line: &str) -> bool {
        self.terms
            .iter()
            .all(|(inverted, pattern)| pattern.matches(line) != *inverted)
    }

    /// The first line of `text` satisfying every term.
    fn find<'a>(&self, text: &'a str) -> Option<&'a str> {
        text.lines().find(|line| self.line_matches(line))
    }
}

#[derive(Debug, Clone)]
enum Target {
    File {
        paths: Vec<String>,
        content: Option<Content>,
    },
    Directory {
        paths: Vec<String>,
        names: Option<Content>,
        content: Option<Content>,
    },
    Process(Pattern),
    Command {
        command: Vec<String>,
        content: Option<Content>,
    },
    Registry {
        key: String,
        value: Option<String>,
        content: Option<Content>,
    },
}

/// One parsed rule.
#[derive(Debug, Clone)]
pub struct Rule {
    source: String,
    negated: bool,
    target: Target,
}

/// Split a command line into its program and arguments: spaces separate,
/// single and double quotes group. No shell is involved.
pub fn split_command(line: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut word = String::new();
    let mut quote: Option<char> = None;
    let mut started = false;
    let mut chars = line.chars();
    while let Some(c) = chars.next() {
        match (quote, c) {
            (Some(open), c) if c == open => quote = None,
            (None, '"' | '\'') => {
                quote = Some(c);
                started = true;
            }
            (None | Some('"'), '\\') => {
                if let Some(next) = chars.next() {
                    word.push(next);
                    started = true;
                }
            }
            (None, c) if c.is_whitespace() => {
                if started || !word.is_empty() {
                    words.push(std::mem::take(&mut word));
                }
                started = false;
            }
            (_, c) => {
                word.push(c);
                started = true;
            }
        }
    }
    if started || !word.is_empty() {
        words.push(word);
    }
    words
}

fn list(text: &str) -> Vec<String> {
    text.split(',')
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

impl Rule {
    /// Parse a rule, its variables already replaced.
    fn parse(source: &str, regex_type: RegexType) -> Result<Self, String> {
        let text = source.trim();
        let (negated, text) = match text.strip_prefix("not ") {
            Some(rest) => (true, rest.trim_start()),
            None => (false, text),
        };
        let (kind, rest) = text
            .split_once(':')
            .ok_or_else(|| format!("'{source}' has no rule type"))?;
        let content = |text: Option<&str>| -> Result<Option<Content>, String> {
            text.map(|text| Content::parse(text, regex_type))
                .transpose()
        };
        let target = match kind {
            "f" => {
                let mut parts = rest.splitn(2, " -> ");
                let paths = list(parts.next().unwrap_or(""));
                Target::File {
                    paths,
                    content: content(parts.next())?,
                }
            }
            "d" => {
                let mut parts = rest.splitn(3, " -> ");
                let paths = list(parts.next().unwrap_or(""));
                Target::Directory {
                    paths,
                    names: content(parts.next())?,
                    content: content(parts.next())?,
                }
            }
            "p" => Target::Process(Pattern::parse(rest, regex_type)?),
            "c" => {
                let mut parts = rest.splitn(2, " -> ");
                let command = split_command(parts.next().unwrap_or(""));
                Target::Command {
                    command,
                    content: content(parts.next())?,
                }
            }
            "r" => {
                let mut parts = rest.splitn(3, " -> ");
                Target::Registry {
                    key: parts.next().unwrap_or("").trim().to_string(),
                    value: parts.next().map(|value| value.trim().to_string()),
                    content: content(parts.next())?,
                }
            }
            other => return Err(format!("rule type '{other}:' is not supported")),
        };
        let empty = match &target {
            Target::File { paths, .. } | Target::Directory { paths, .. } => paths.is_empty(),
            Target::Command { command, .. } => command.is_empty(),
            Target::Registry { key, .. } => key.is_empty(),
            Target::Process(_) => rest.trim().is_empty(),
        };
        if empty {
            return Err(format!("'{source}' names nothing to look at"));
        }
        Ok(Self {
            source: source.trim().to_string(),
            negated,
            target,
        })
    }

    fn evaluate(&self, host: &dyn Host) -> Truth {
        let truth = match &self.target {
            Target::File {
                paths,
                content: None,
            } => Truth::from(paths.iter().any(|path| host.file_exists(path))),
            Target::File {
                paths,
                content: Some(content),
            } => evaluate_files(host, paths, content),
            Target::Directory {
                paths, names: None, ..
            } => Truth::from(paths.iter().any(|path| host.directory_exists(path))),
            Target::Directory {
                paths,
                names: Some(names),
                content,
            } => evaluate_directories(host, paths, names, content.as_ref()),
            Target::Process(pattern) => {
                Truth::from(host.processes().iter().any(|name| pattern.matches(name)))
            }
            Target::Command { command, content } => match host.run(command) {
                Ok(output) => match content {
                    Some(content) => Truth::from(content.find(&output).is_some()),
                    None => Truth::True,
                },
                Err(Unavailable::Missing) => {
                    Truth::Unknown(format!("command '{}' is not installed", command[0]))
                }
                Err(Unavailable::Other(reason)) => {
                    Truth::Unknown(format!("command '{}' failed: {reason}", command[0]))
                }
            },
            Target::Registry {
                key,
                value,
                content,
            } => evaluate_registry(host, key, value.as_deref(), content.as_ref()),
        };
        if self.negated {
            truth.inverted()
        } else {
            truth
        }
    }
}

fn evaluate_files(host: &dyn Host, paths: &[String], content: &Content) -> Truth {
    let mut unknown = None;
    let mut read_any = false;
    for path in paths {
        match host.read_file(path) {
            Ok(text) => {
                read_any = true;
                if content.find(&text).is_some() {
                    return Truth::True;
                }
            }
            Err(Unavailable::Missing) => {
                unknown.get_or_insert_with(|| format!("{path} does not exist"));
            }
            Err(Unavailable::Other(reason)) => {
                unknown = Some(format!("{path} cannot be read: {reason}"));
            }
        }
    }
    match unknown {
        // Read at least one of the files, none has the line: false.
        Some(_) if read_any => Truth::False,
        Some(reason) => Truth::Unknown(reason),
        None => Truth::False,
    }
}

fn evaluate_directories(
    host: &dyn Host,
    paths: &[String],
    names: &Content,
    content: Option<&Content>,
) -> Truth {
    let mut unknown = None;
    let mut listed_any = false;
    for path in paths {
        let entries = match host.list_directory(path) {
            Ok(entries) => entries,
            Err(Unavailable::Missing) => {
                unknown.get_or_insert_with(|| format!("{path} does not exist"));
                continue;
            }
            Err(Unavailable::Other(reason)) => {
                unknown = Some(format!("{path} cannot be listed: {reason}"));
                continue;
            }
        };
        listed_any = true;
        let matching = entries
            .iter()
            .filter(|name| names.line_matches(name))
            .take(MAX_DIRECTORY_FILES);
        for name in matching {
            let Some(content) = content else {
                return Truth::True;
            };
            let file = format!("{}/{name}", path.trim_end_matches('/'));
            if host
                .read_file(&file)
                .is_ok_and(|text| content.find(&text).is_some())
            {
                return Truth::True;
            }
        }
    }
    match unknown {
        Some(reason) if !listed_any => Truth::Unknown(reason),
        _ => Truth::False,
    }
}

fn evaluate_registry(
    host: &dyn Host,
    key: &str,
    value: Option<&str>,
    content: Option<&Content>,
) -> Truth {
    let Some(value) = value else {
        return match host.registry_key_exists(key) {
            Ok(exists) => Truth::from(exists),
            Err(Unavailable::Missing) => Truth::False,
            Err(Unavailable::Other(reason)) => Truth::Unknown(reason),
        };
    };
    let values = match host.registry_values(key) {
        Ok(values) => values,
        // A key that does not exist has no value: a policy that was never
        // set is the ordinary case, and it has an answer.
        Err(Unavailable::Missing) => return Truth::False,
        Err(Unavailable::Other(reason)) => return Truth::Unknown(reason),
    };
    let data = values
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(value))
        .map(|(_, data)| data);
    match (data, content) {
        (None, _) => Truth::False,
        (Some(_), None) => Truth::True,
        (Some(data), Some(content)) => Truth::from(content.line_matches(data)),
    }
}

/// How the rules of a check are combined.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Condition {
    All,
    Any,
    None,
}

impl Condition {
    fn parse(text: &str) -> Result<Self, String> {
        match text.trim().to_ascii_lowercase().as_str() {
            "all" => Ok(Self::All),
            "any" => Ok(Self::Any),
            "none" => Ok(Self::None),
            other => Err(format!("condition '{other}' is not all, any or none")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Any => "any",
            Self::None => "none",
        }
    }
}

/// The outcome of a check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Passed,
    Failed,
    /// Depends on a rule that could not be evaluated.
    NotApplicable(String),
}

/// Combine the values of the rules of a check.
pub fn combine(condition: Condition, truths: &[Truth]) -> Outcome {
    let any_true = truths.contains(&Truth::True);
    let any_false = truths.contains(&Truth::False);
    let unknown = truths.iter().find_map(|truth| match truth {
        Truth::Unknown(reason) => Some(reason.clone()),
        _ => None,
    });
    // A rule that decides the outcome by itself decides it whatever the
    // others are worth; otherwise an unknown rule leaves it undecided.
    let decided = match condition {
        Condition::All if any_false => Some(Outcome::Failed),
        Condition::Any if any_true => Some(Outcome::Passed),
        Condition::None if any_true => Some(Outcome::Failed),
        _ => None,
    };
    match (decided, unknown) {
        (Some(outcome), _) => outcome,
        (None, Some(reason)) => Outcome::NotApplicable(reason),
        (None, None) => match condition {
            Condition::All | Condition::None => Outcome::Passed,
            Condition::Any => Outcome::Failed,
        },
    }
}

/// A check of a policy, registered like a built-in check.
pub struct ScaCheck {
    definition: CheckDefinition,
    condition: Condition,
    rules: Vec<Rule>,
    host: Arc<dyn Host>,
}

fn excerpt(text: &str) -> String {
    let mut excerpt: String = text.chars().take(MAX_EVIDENCE_CHARS).collect();
    if text.chars().count() > MAX_EVIDENCE_CHARS {
        excerpt.push('…');
    }
    excerpt
}

impl ScaCheck {
    /// Evaluate the rules. Blocking: files are read and commands run.
    fn evaluate(condition: Condition, rules: &[Rule], host: &dyn Host) -> (Outcome, Vec<Truth>) {
        let truths: Vec<Truth> = rules.iter().map(|rule| rule.evaluate(host)).collect();
        (combine(condition, &truths), truths)
    }
}

#[async_trait]
impl Check for ScaCheck {
    fn definition(&self) -> &CheckDefinition {
        &self.definition
    }

    async fn execute(&self) -> ScannerResult<CheckOutput> {
        let (condition, rules, host) = (self.condition, self.rules.clone(), self.host.clone());
        let (outcome, truths) =
            tokio::task::spawn_blocking(move || Self::evaluate(condition, &rules, host.as_ref()))
                .await
                .map_err(|e| crate::error::ScannerError::Internal(e.to_string()))?;

        let evidence = json!({
            "probe": "sca",
            "condition": condition.as_str(),
            "rules": self.rules.iter().zip(&truths).map(|(rule, truth)| json!({
                "rule": excerpt(&rule.source),
                "result": match truth {
                    Truth::True => "true".to_string(),
                    Truth::False => "false".to_string(),
                    Truth::Unknown(reason) => format!("unknown: {}", excerpt(reason)),
                },
            })).collect::<Vec<_>>(),
        });
        let output = match outcome {
            Outcome::Passed => CheckOutput::pass("Every rule of the check is satisfied", evidence),
            Outcome::Failed => {
                let failing = self
                    .rules
                    .iter()
                    .zip(&truths)
                    .find(|(_, truth)| match condition {
                        Condition::All => **truth == Truth::False,
                        Condition::Any => **truth != Truth::True,
                        Condition::None => **truth == Truth::True,
                    })
                    .map_or_else(String::new, |(rule, _)| excerpt(&rule.source));
                let message = match condition {
                    Condition::None => format!("Holds, and should not: {failing}"),
                    Condition::All | Condition::Any => format!("Not satisfied: {failing}"),
                };
                CheckOutput::fail(message, evidence)
            }
            Outcome::NotApplicable(reason) => CheckOutput::not_applicable(
                format!("Not applicable: {}", excerpt(&reason)),
                evidence,
            ),
        };
        Ok(output.with_metadata("sca", "true"))
    }
}

fn text(value: &Yaml) -> Option<String> {
    match value {
        Yaml::String(text) => Some(text.trim().to_string()),
        Yaml::Integer(number) => Some(number.to_string()),
        Yaml::Real(number) => Some(number.clone()),
        Yaml::Boolean(flag) => Some(flag.to_string()),
        _ => None,
    }
    .filter(|text| !text.is_empty())
}

fn text_list(value: &Yaml) -> Vec<String> {
    match value {
        Yaml::Array(items) => items.iter().filter_map(text).collect(),
        single => text(single).into_iter().collect(),
    }
}

/// A lower-case identifier made of letters, digits and `_`.
fn identifier(raw: &str) -> String {
    let mut id = String::with_capacity(raw.len());
    for c in raw.trim().chars() {
        if c.is_ascii_alphanumeric() {
            id.push(c.to_ascii_lowercase());
        } else if !id.ends_with('_') {
            id.push('_');
        }
    }
    id.trim_matches('_').to_string()
}

/// The frameworks a check counts for, from its `compliance` section, and
/// that section as it is.
fn compliance_of(check: &Yaml) -> (Vec<String>, serde_json::Value) {
    let mut frameworks: Vec<String> = Vec::new();
    let mut references = serde_json::Map::new();
    for entry in check["compliance"].as_vec().into_iter().flatten() {
        for (key, value) in entry.as_hash().into_iter().flatten() {
            let Some(key) = key.as_str() else { continue };
            references.insert(key.to_string(), json!(text_list(value)));
            // `cis_csc_v8`, `pci_dss_v4.0`, `nist_800_53`: the name without
            // its version, then with it.
            let family = key.split("_v").next().unwrap_or(key);
            let known = normalize_framework_id(key)
                .or_else(|| normalize_framework_id(family))
                .or_else(|| key.starts_with("cis").then_some("CIS_V8"));
            if let Some(framework) = known
                && !frameworks.iter().any(|f| f == framework)
            {
                frameworks.push(framework.to_string());
            }
        }
    }
    (frameworks, serde_json::Value::Object(references))
}

fn replace_variables(rule: &str, variables: &[(String, String)]) -> String {
    variables
        .iter()
        .fold(rule.to_string(), |rule, (name, value)| {
            rule.replace(name, value)
        })
}

fn parse_rules(
    section: &Yaml,
    variables: &[(String, String)],
    regex_type: RegexType,
) -> Result<Vec<Rule>, String> {
    let rules = text_list(&section["rules"]);
    if rules.is_empty() {
        return Err("no rule".to_string());
    }
    rules
        .iter()
        .map(|rule| Rule::parse(&replace_variables(rule, variables), regex_type))
        .collect()
}

/// A parsed policy: its checks, and the declarations left out.
#[derive(Debug)]
pub struct Policy {
    pub id: String,
    pub name: String,
    /// The platforms the policy says it is for (empty: every platform).
    pub platforms: Vec<String>,
    requirements: Option<(Condition, Vec<Rule>)>,
    checks: Vec<(CheckDefinition, Condition, Vec<Rule>)>,
    pub errors: Vec<String>,
}

impl Policy {
    /// Number of checks the policy holds.
    pub fn check_count(&self) -> usize {
        self.checks.len()
    }

    /// Whether the policy applies to this system: its platforms, then its
    /// `requirements`. `Err` with the reason when it does not.
    pub fn applies(&self, host: &dyn Host) -> Result<(), String> {
        let platform = std::env::consts::OS;
        if !self.platforms.is_empty() && !self.platforms.iter().any(|p| p == platform) {
            return Err(format!("written for {}", self.platforms.join(", ")));
        }
        let Some((condition, rules)) = &self.requirements else {
            return Ok(());
        };
        match ScaCheck::evaluate(*condition, rules, host).0 {
            Outcome::Passed => Ok(()),
            Outcome::Failed => Err("its requirements are not met".to_string()),
            Outcome::NotApplicable(reason) => {
                Err(format!("its requirements cannot be evaluated: {reason}"))
            }
        }
    }
}

/// Parse a policy file.
pub fn parse_policy(yaml: &str) -> Result<Policy, String> {
    let documents = YamlLoader::load_from_str(yaml).map_err(|e| format!("invalid YAML: {e}"))?;
    let document = documents.first().ok_or_else(|| "empty file".to_string())?;
    let policy = &document["policy"];
    let id = text(&policy["id"])
        .map(|id| identifier(&id))
        .filter(|id| !id.is_empty())
        .ok_or_else(|| "policy has no id".to_string())?;
    let name = text(&policy["name"]).unwrap_or_else(|| id.clone());
    let policy_regex = match text(&policy["regex_type"]) {
        Some(kind) => RegexType::parse(&kind)?,
        None => RegexType::OsRegex,
    };
    let platforms: Vec<String> = text_list(&policy["platforms"])
        .into_iter()
        .map(|platform| platform.to_ascii_lowercase())
        .collect();

    // Longest names first, so `$dir` does not eat the start of `$dirs`.
    let mut variables: Vec<(String, String)> = document["variables"]
        .as_hash()
        .into_iter()
        .flatten()
        .filter_map(|(name, value)| Some((name.as_str()?.to_string(), text(value)?)))
        .filter(|(name, _)| name.starts_with('$'))
        .collect();
    variables.sort_by_key(|(name, _)| std::cmp::Reverse(name.len()));

    let requirements = &document["requirements"];
    let requirements = if requirements.is_badvalue() {
        None
    } else {
        let condition = Condition::parse(&text(&requirements["condition"]).unwrap_or_default())
            .map_err(|e| format!("requirements: {e}"))?;
        let rules = parse_rules(requirements, &variables, policy_regex)
            .map_err(|e| format!("requirements: {e}"))?;
        Some((condition, rules))
    };

    let mut checks = Vec::new();
    let mut errors = Vec::new();
    for check in document["checks"].as_vec().into_iter().flatten() {
        let Some(check_id) = text(&check["id"]) else {
            errors.push("a check has no id".to_string());
            continue;
        };
        let parsed = (|| -> Result<_, String> {
            let title = text(&check["title"]).ok_or_else(|| "no title".to_string())?;
            let condition = Condition::parse(&text(&check["condition"]).unwrap_or_default())?;
            let regex_type = match text(&check["regex_type"]) {
                Some(kind) => RegexType::parse(&kind)?,
                None => policy_regex,
            };
            let rules = parse_rules(check, &variables, regex_type)?;
            let severity = match text(&check["severity"]) {
                Some(severity) => serde_json::from_value::<CheckSeverity>(json!(severity))
                    .map_err(|_| format!("severity '{severity}' is not known"))?,
                None => CheckSeverity::Medium,
            };
            let category = match text(&check["category"]) {
                Some(category) => serde_json::from_value::<CheckCategory>(json!(category))
                    .map_err(|_| format!("category '{category}' is not known"))?,
                None => CheckCategory::General,
            };
            let (frameworks, compliance) = compliance_of(check);
            let definition = CheckDefinition {
                id: format!("{SCA_ID_PREFIX}{id}_{}", identifier(&check_id)),
                name: title,
                description: text(&check["description"]).unwrap_or_default(),
                category,
                severity,
                frameworks,
                enabled: true,
                platforms: platforms.clone(),
                parameters: json!({
                    "sca": true,
                    "policy": id,
                    "policy_name": name,
                    "rationale": text(&check["rationale"]),
                    "remediation": text(&check["remediation"]),
                    "compliance": compliance,
                }),
                nfr_duration_ms: None,
            };
            Ok((definition, condition, rules))
        })();
        match parsed {
            Ok(check) => checks.push(check),
            Err(e) => errors.push(format!("check {check_id}: {e}")),
        }
    }
    if checks.is_empty() && errors.is_empty() {
        return Err("policy has no check".to_string());
    }
    Ok(Policy {
        id,
        name,
        platforms,
        requirements,
        checks,
        errors,
    })
}

/// Outcome of loading policies.
#[derive(Debug, Default)]
pub struct ScaReport {
    /// Policies whose checks were registered, with their number.
    pub policies: Vec<(String, usize)>,
    /// Policies that do not apply to this system, and why.
    pub skipped: Vec<String>,
    /// Files or checks left out, with the reason.
    pub errors: Vec<String>,
}

impl ScaReport {
    /// Number of checks registered.
    pub fn checks(&self) -> usize {
        self.policies.iter().map(|(_, count)| count).sum()
    }
}

fn register_policy(
    registry: &mut CheckRegistry,
    policy: Policy,
    label: &str,
    host: &Arc<dyn Host>,
    report: &mut ScaReport,
) {
    report
        .errors
        .extend(policy.errors.iter().map(|e| format!("{label}: {e}")));
    if let Err(reason) = policy.applies(host.as_ref()) {
        report.skipped.push(format!("{label}: {reason}"));
        return;
    }
    let mut registered = 0;
    for (definition, condition, rules) in policy.checks {
        if registry.get(&definition.id).is_some() {
            report.errors.push(format!(
                "{label}: check '{}' is already defined",
                definition.id
            ));
            continue;
        }
        registry.register(Arc::new(ScaCheck {
            definition,
            condition,
            rules,
            host: Arc::clone(host),
        }));
        registered += 1;
    }
    if registered > 0 {
        report.policies.push((policy.id, registered));
    }
}

/// Register the policies shipped with the agent that apply to this system.
pub fn register_builtin_policies(registry: &mut CheckRegistry, host: &Arc<dyn Host>) -> ScaReport {
    let mut report = ScaReport::default();
    for (name, yaml) in BUILTIN_POLICIES {
        match parse_policy(yaml) {
            Ok(policy) => register_policy(registry, policy, name, host, &mut report),
            Err(e) => report.errors.push(format!("built-in {name}: {e}")),
        }
    }
    report
}

/// Register the policies found in the `*.yml` / `*.yaml` files of `dir`.
/// A missing directory is not an error.
pub fn register_policies(
    registry: &mut CheckRegistry,
    dir: &Path,
    host: &Arc<dyn Host>,
) -> ScaReport {
    let mut report = ScaReport::default();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return report;
    };
    if let Err(reason) = super::custom::is_trusted(dir) {
        report
            .errors
            .push(format!("{}: directory ignored, it {reason}", dir.display()));
        return report;
    }
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|ext| ext == "yml" || ext == "yaml")
        })
        .collect();
    files.sort();

    for file in files {
        let label = file.display().to_string();
        if let Err(reason) = super::custom::is_trusted(&file) {
            report
                .errors
                .push(format!("{label}: file ignored, it {reason}"));
            continue;
        }
        if std::fs::metadata(&file).is_ok_and(|m| m.len() > MAX_POLICY_FILE_BYTES) {
            report
                .errors
                .push(format!("{label}: file ignored, it is too large"));
            continue;
        }
        let policy = std::fs::read_to_string(&file)
            .map_err(|e| e.to_string())
            .and_then(|yaml| parse_policy(&yaml));
        match policy {
            Ok(policy) => register_policy(registry, policy, &label, host, &mut report),
            Err(e) => report.errors.push(format!("{label}: {e}")),
        }
    }
    report
}

/// Say what was loaded.
pub fn log_report(report: &ScaReport, origin: &str) {
    if report.checks() > 0 {
        let policies: Vec<String> = report
            .policies
            .iter()
            .map(|(id, count)| format!("{id} ({count})"))
            .collect();
        info!(
            "Registered {} compliance check(s) from {}: {}",
            report.checks(),
            origin,
            policies.join(", ")
        );
    }
    for skipped in &report.skipped {
        info!("Compliance policy not applied: {}", skipped);
    }
    for error in &report.errors {
        warn!("Compliance policy check not loaded: {}", error);
    }
}

/// The system the agent runs on.
#[derive(Debug, Default)]
pub struct SystemHost;

impl SystemHost {
    pub fn shared() -> Arc<dyn Host> {
        Arc::new(Self)
    }
}

fn io_unavailable(error: &std::io::Error) -> Unavailable {
    match error.kind() {
        std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory => Unavailable::Missing,
        _ => Unavailable::Other(error.to_string()),
    }
}

/// Run a program and return what it printed, or kill it after the timeout.
fn run_with_timeout(command: &[String], timeout: Duration) -> Result<String, Unavailable> {
    use std::io::Read;
    use std::process::Stdio;

    let (program, arguments) = command
        .split_first()
        .ok_or_else(|| Unavailable::Other("empty command".to_string()))?;
    let mut process = agent_common::process::silent_command(program);
    process
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // A service is often started with a short PATH; administration tools
    // (`sysctl`, `modprobe`, `auditctl`) live in the `sbin` directories.
    if cfg!(unix) {
        let path = std::env::var("PATH").unwrap_or_default();
        process.env(
            "PATH",
            format!("{path}:/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin"),
        );
    }
    let mut child = process.spawn().map_err(|e| io_unavailable(&e))?;

    let capture = |stream: Option<Box<dyn Read + Send>>| {
        std::thread::spawn(move || {
            let mut text = Vec::new();
            if let Some(stream) = stream {
                let _ = stream.take(MAX_OUTPUT_BYTES as u64).read_to_end(&mut text);
            }
            text
        })
    };
    let stdout = capture(
        child
            .stdout
            .take()
            .map(|s| Box::new(s) as Box<dyn Read + Send>),
    );
    let stderr = capture(
        child
            .stderr
            .take()
            .map(|s| Box::new(s) as Box<dyn Read + Send>),
    );

    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Unavailable::Other(format!(
                    "no answer after {}s",
                    timeout.as_secs()
                )));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => return Err(Unavailable::Other(e.to_string())),
        }
    }
    let mut output = stdout.join().unwrap_or_default();
    output.extend(stderr.join().unwrap_or_default());
    Ok(String::from_utf8_lossy(&output).into_owned())
}

/// The values of a registry key as `reg query` prints them:
/// `    Name    REG_DWORD    0x1`. Numbers are given in decimal.
pub fn parse_reg_query(output: &str) -> Vec<(String, String)> {
    output
        .lines()
        .filter(|line| line.starts_with("    "))
        .filter_map(|line| {
            let mut fields = line.trim().splitn(3, "    ");
            let name = fields.next()?.trim();
            let kind = fields.next()?.trim();
            let data = fields.next().unwrap_or("").trim();
            let data = match kind {
                "REG_DWORD" | "REG_QWORD" => data
                    .strip_prefix("0x")
                    .and_then(|hex| u64::from_str_radix(hex, 16).ok())
                    .map_or_else(|| data.to_string(), |number| number.to_string()),
                _ => data.to_string(),
            };
            kind.starts_with("REG_").then(|| (name.to_string(), data))
        })
        .collect()
}

impl Host for SystemHost {
    fn read_file(&self, path: &str) -> Result<String, Unavailable> {
        use std::io::Read;
        let metadata = std::fs::metadata(path).map_err(|e| io_unavailable(&e))?;
        if !metadata.is_file() {
            return Err(Unavailable::Missing);
        }
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .and_then(|file| file.take(MAX_READ_BYTES).read_to_end(&mut bytes))
            .map_err(|e| io_unavailable(&e))?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    }

    fn file_exists(&self, path: &str) -> bool {
        std::fs::metadata(path).is_ok_and(|metadata| metadata.is_file())
    }

    fn directory_exists(&self, path: &str) -> bool {
        std::fs::metadata(path).is_ok_and(|metadata| metadata.is_dir())
    }

    fn list_directory(&self, path: &str) -> Result<Vec<String>, Unavailable> {
        let entries = std::fs::read_dir(path).map_err(|e| io_unavailable(&e))?;
        let mut names: Vec<String> = entries
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        Ok(names)
    }

    fn processes(&self) -> Vec<String> {
        let command: &[&str] = if cfg!(windows) {
            &["tasklist", "/fo", "csv", "/nh"]
        } else {
            &["ps", "-axo", "comm="]
        };
        let command: Vec<String> = command.iter().map(|part| (*part).to_string()).collect();
        let Ok(output) = run_with_timeout(&command, COMMAND_TIMEOUT) else {
            return Vec::new();
        };
        output
            .lines()
            .map(|line| {
                let name = if cfg!(windows) {
                    line.split(',').next().unwrap_or("").trim_matches('"')
                } else {
                    line.trim()
                };
                // The name of the program, without its directory.
                name.rsplit(['/', '\\']).next().unwrap_or(name).to_string()
            })
            .filter(|name| !name.is_empty())
            .collect()
    }

    fn run(&self, command: &[String]) -> Result<String, Unavailable> {
        run_with_timeout(command, COMMAND_TIMEOUT)
    }

    fn registry_key_exists(&self, key: &str) -> Result<bool, Unavailable> {
        if !cfg!(windows) {
            return Err(Unavailable::Other("no registry on this system".to_string()));
        }
        Ok(self.registry_values(key).is_ok())
    }

    fn registry_values(&self, key: &str) -> Result<Vec<(String, String)>, Unavailable> {
        if !cfg!(windows) {
            return Err(Unavailable::Other("no registry on this system".to_string()));
        }
        let command = ["reg".to_string(), "query".to_string(), key.to_string()];
        let output = run_with_timeout(&command, COMMAND_TIMEOUT)?;
        // `reg` says "ERROR: The system was unable to find the specified
        // registry key or value." and prints no key.
        if !output.to_ascii_uppercase().contains("HKEY_") {
            return Err(Unavailable::Missing);
        }
        Ok(parse_reg_query(&output))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// A system described by the test.
    #[derive(Default)]
    struct FakeHost {
        files: HashMap<String, String>,
        directories: HashMap<String, Vec<String>>,
        processes: Vec<String>,
        commands: HashMap<String, Result<String, Unavailable>>,
        registry: HashMap<String, Vec<(String, String)>>,
    }

    impl FakeHost {
        fn file(mut self, path: &str, content: &str) -> Self {
            self.files.insert(path.to_string(), content.to_string());
            self
        }
        fn directory(mut self, path: &str, entries: &[&str]) -> Self {
            self.directories.insert(
                path.to_string(),
                entries.iter().map(|e| (*e).to_string()).collect(),
            );
            self
        }
        fn process(mut self, name: &str) -> Self {
            self.processes.push(name.to_string());
            self
        }
        fn command(mut self, line: &str, output: Result<&str, Unavailable>) -> Self {
            self.commands
                .insert(line.to_string(), output.map(str::to_string));
            self
        }
        fn key(mut self, key: &str, values: &[(&str, &str)]) -> Self {
            self.registry.insert(
                key.to_string(),
                values
                    .iter()
                    .map(|(n, d)| ((*n).to_string(), (*d).to_string()))
                    .collect(),
            );
            self
        }
    }

    impl Host for FakeHost {
        fn read_file(&self, path: &str) -> Result<String, Unavailable> {
            self.files.get(path).cloned().ok_or(Unavailable::Missing)
        }
        fn file_exists(&self, path: &str) -> bool {
            self.files.contains_key(path)
        }
        fn directory_exists(&self, path: &str) -> bool {
            self.directories.contains_key(path)
        }
        fn list_directory(&self, path: &str) -> Result<Vec<String>, Unavailable> {
            self.directories
                .get(path)
                .cloned()
                .ok_or(Unavailable::Missing)
        }
        fn processes(&self) -> Vec<String> {
            self.processes.clone()
        }
        fn run(&self, command: &[String]) -> Result<String, Unavailable> {
            self.commands
                .get(&command.join(" "))
                .cloned()
                .unwrap_or(Err(Unavailable::Missing))
        }
        fn registry_key_exists(&self, key: &str) -> Result<bool, Unavailable> {
            Ok(self.registry.contains_key(key))
        }
        fn registry_values(&self, key: &str) -> Result<Vec<(String, String)>, Unavailable> {
            self.registry.get(key).cloned().ok_or(Unavailable::Missing)
        }
    }

    fn truth(rule: &str, host: &FakeHost) -> Truth {
        Rule::parse(rule, RegexType::OsRegex)
            .unwrap_or_else(|e| panic!("{rule}: {e}"))
            .evaluate(host)
    }

    fn unknown(truth: &Truth) -> bool {
        matches!(truth, Truth::Unknown(_))
    }

    #[test]
    fn the_ossec_dialect_is_translated() {
        let matches = |pattern: &str, text: &str| {
            compile(pattern, RegexType::OsRegex).unwrap().is_match(text)
        };
        // Classes, and the repetitions that follow them.
        assert!(matches(
            r"^\s*PermitRootLogin\s+no",
            "  PermitRootLogin   no"
        ));
        assert!(matches(r"^\s*PASS_MAX_DAYS\s+\d+$", "PASS_MAX_DAYS 90"));
        assert!(!matches(
            r"^\s*PASS_MAX_DAYS\s+\d+$",
            "PASS_MAX_DAYS ninety"
        ));
        assert!(matches(r"\w+@\w+", "root@host-1"));
        // A plain dot is a dot; `\.` is any character.
        assert!(matches(
            r"^net.ipv4.ip_forward\s*=\s*0",
            "net.ipv4.ip_forward = 0"
        ));
        assert!(!matches(r"^net.ipv4", "netXipv4"));
        assert!(matches(r"^a\.c$", "abc"));
        // Alternatives and groups.
        assert!(matches(
            r"install /bin/true|not found",
            "modprobe: Module cramfs not found"
        ));
        assert!(matches(r"^(root|admin):", "admin:x:0:0"));
        // Punctuation, and characters that mean nothing in this dialect.
        assert!(matches(r"^\p", "#comment"));
        assert!(matches(r"^[sshd]$", "[sshd]"));
        assert!(matches(r"a+b", "a+b") && !matches(r"a+b", "aab"));
        // Whatever the case.
        assert!(matches(r"permitrootlogin", "PermitRootLogin no"));
    }

    #[test]
    fn a_file_rule_asks_for_the_file_or_for_a_line_of_it() {
        let host = FakeHost::default().file(
            "/etc/ssh/sshd_config",
            "# PermitRootLogin yes\nPermitRootLogin no\nMaxAuthTries 3\n",
        );
        assert_eq!(truth("f:/etc/ssh/sshd_config", &host), Truth::True);
        assert_eq!(truth("f:/etc/hosts.equiv", &host), Truth::False);
        assert_eq!(truth("not f:/etc/hosts.equiv", &host), Truth::True);

        let file = "f:/etc/ssh/sshd_config";
        assert_eq!(
            truth(&format!("{file} -> r:^PermitRootLogin\\s+no"), &host),
            Truth::True
        );
        // The commented line says yes, but it is a comment.
        assert_eq!(
            truth(
                &format!("{file} -> !r:^# && r:PermitRootLogin\\s+yes"),
                &host
            ),
            Truth::False
        );
        assert_eq!(
            truth(
                &format!("not {file} -> !r:^# && r:PermitRootLogin\\s+yes"),
                &host
            ),
            Truth::True
        );
        // A literal is the whole line.
        assert_eq!(
            truth(&format!("{file} -> maxauthtries 3"), &host),
            Truth::True
        );
        assert_eq!(
            truth(&format!("{file} -> MaxAuthTries"), &host),
            Truth::False
        );
        // A number taken from the line.
        let tries = |op: &str| {
            truth(
                &format!("{file} -> n:^MaxAuthTries\\s+(\\d+) compare {op}"),
                &host,
            )
        };
        assert_eq!(tries("<= 4"), Truth::True);
        assert_eq!(tries("> 3"), Truth::False);
        assert_eq!(tries("== 3"), Truth::True);

        // Asking for the content of a file that is not there has no answer,
        // inverted or not; with another file that could be read, it has.
        assert!(unknown(&truth("f:/etc/absent -> r:x", &host)));
        assert!(unknown(&truth("not f:/etc/absent -> r:x", &host)));
        assert_eq!(
            truth(
                &format!("f:/etc/absent,{} -> r:MaxAuthTries", &file[2..]),
                &host
            ),
            Truth::True
        );
        assert_eq!(
            truth(&format!("f:/etc/absent,{} -> r:nothing", &file[2..]), &host),
            Truth::False
        );
    }

    #[test]
    fn a_directory_rule_asks_for_the_directory_an_entry_or_its_content() {
        let host = FakeHost::default()
            .directory("/etc/cron.d", &["backup", "notes.txt"])
            .file(
                "/etc/cron.d/backup",
                "0 3 * * * root /usr/local/bin/backup\n",
            )
            .file("/etc/cron.d/notes.txt", "nothing\n");
        assert_eq!(truth("d:/etc/cron.d", &host), Truth::True);
        assert_eq!(truth("d:/etc/absent", &host), Truth::False);
        assert_eq!(truth("d:/etc/cron.d -> r:\\.txt$", &host), Truth::True);
        assert_eq!(truth("d:/etc/cron.d -> r:\\.sh$", &host), Truth::False);
        assert_eq!(
            truth("d:/etc/cron.d -> r:^backup$ -> r:root", &host),
            Truth::True
        );
        assert_eq!(
            truth("d:/etc/cron.d -> r:\\.txt$ -> r:root", &host),
            Truth::False
        );
        assert!(unknown(&truth("d:/etc/absent -> r:x", &host)));
    }

    #[test]
    fn process_command_and_registry_rules() {
        let host = FakeHost::default()
            .process("sshd")
            .process("auditd")
            .command(
                "sysctl net.ipv4.ip_forward",
                Ok("net.ipv4.ip_forward = 0\n"),
            )
            .command("modprobe -n -v cramfs", Ok("install /bin/true\n"))
            .command("broken", Err(Unavailable::Other("exit".to_string())))
            .key(
                r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
                &[("SMB1", "0"), ("AutoShareWks", "1")],
            );

        assert_eq!(truth("p:auditd", &host), Truth::True);
        assert_eq!(truth("p:telnetd", &host), Truth::False);
        assert_eq!(truth("not p:telnetd", &host), Truth::True);
        assert_eq!(truth("p:r:^audit", &host), Truth::True);

        assert_eq!(
            truth("c:sysctl net.ipv4.ip_forward -> r:=\\s*0$", &host),
            Truth::True
        );
        assert_eq!(
            truth(
                "c:modprobe -n -v cramfs -> r:install /bin/true|not found",
                &host
            ),
            Truth::True
        );
        assert!(unknown(&truth("c:absent-tool --version -> r:1", &host)));
        assert!(unknown(&truth("c:broken -> r:1", &host)));

        let key = r"r:HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters";
        assert_eq!(truth(key, &host), Truth::True);
        assert_eq!(
            truth(r"r:HKEY_LOCAL_MACHINE\SOFTWARE\Absent", &host),
            Truth::False
        );
        assert_eq!(truth(&format!("{key} -> smb1"), &host), Truth::True);
        assert_eq!(truth(&format!("{key} -> SMB2"), &host), Truth::False);
        assert_eq!(truth(&format!("{key} -> SMB1 -> 0"), &host), Truth::True);
        assert_eq!(truth(&format!("{key} -> SMB1 -> 1"), &host), Truth::False);
        assert_eq!(
            truth(
                &format!("{key} -> AutoShareWks -> n:^(\\d+) compare >= 1"),
                &host
            ),
            Truth::True
        );
        // A key that was never created has no value, which is an answer.
        assert_eq!(
            truth(r"r:HKEY_LOCAL_MACHINE\SOFTWARE\Absent -> Value", &host),
            Truth::False
        );
        assert_eq!(
            truth(
                r"not r:HKEY_LOCAL_MACHINE\SOFTWARE\Absent -> Value -> 1",
                &host
            ),
            Truth::True
        );
    }

    #[test]
    fn a_command_line_is_split_without_a_shell() {
        assert_eq!(
            split_command("sysctl  -n kernel.randomize_va_space"),
            ["sysctl", "-n", "kernel.randomize_va_space"]
        );
        assert_eq!(
            split_command(r#"sh -c "grep -r 'a b' /etc" last"#),
            ["sh", "-c", "grep -r 'a b' /etc", "last"]
        );
        assert_eq!(split_command("cmd ''"), ["cmd", ""]);
        assert!(split_command("   ").is_empty());
    }

    #[test]
    fn rules_are_combined_and_an_unknown_one_matters_only_when_it_decides() {
        use Truth::{False, True};
        let unknown = || Truth::Unknown("file missing".to_string());
        let na = Outcome::NotApplicable("file missing".to_string());

        assert_eq!(combine(Condition::All, &[True, True]), Outcome::Passed);
        assert_eq!(combine(Condition::All, &[True, False]), Outcome::Failed);
        assert_eq!(
            combine(Condition::All, &[False, unknown()]),
            Outcome::Failed
        );
        assert_eq!(combine(Condition::All, &[True, unknown()]), na);

        assert_eq!(combine(Condition::Any, &[False, True]), Outcome::Passed);
        assert_eq!(combine(Condition::Any, &[False, False]), Outcome::Failed);
        assert_eq!(combine(Condition::Any, &[True, unknown()]), Outcome::Passed);
        assert_eq!(combine(Condition::Any, &[False, unknown()]), na);

        assert_eq!(combine(Condition::None, &[False, False]), Outcome::Passed);
        assert_eq!(combine(Condition::None, &[False, True]), Outcome::Failed);
        assert_eq!(
            combine(Condition::None, &[True, unknown()]),
            Outcome::Failed
        );
        assert_eq!(combine(Condition::None, &[False, unknown()]), na);
    }

    const POLICY: &str = r#"
policy:
  id: "SSH hardening"
  name: Durcissement de SSH
  platforms: [linux, macos, windows]
requirements:
  title: sshd installed
  condition: any
  rules:
    - 'f:$sshd'
variables:
  $sshd: /etc/ssh/sshd_config
  $sshd_dir: /etc/ssh/sshd_config.d
checks:
  - id: 1001
    title: Connexion root interdite
    description: sshd ne doit pas accepter de connexion directe en root.
    rationale: Chaque action doit être attribuable à une personne.
    remediation: Écrire « PermitRootLogin no » dans sshd_config.
    severity: high
    category: remote_access
    compliance:
      - cis: ["5.2.10"]
      - pci_dss_v4.0: ["2.2.6"]
      - nist_800_53: ["AC-6"]
      - mitre_techniques: ["T1021"]
    condition: all
    rules:
      - 'f:$sshd -> !r:^# && r:PermitRootLogin\s+no'
      - 'not d:$sshd_dir -> r:\.conf$ -> !r:^# && r:PermitRootLogin\s+yes'
  - id: 1002
    title: Tentatives limitées
    condition: all
    rules:
      - 'f:$sshd -> n:^MaxAuthTries\s+(\d+) compare <= 4'
  - id: 1003
    title: Règle illisible
    condition: all
    rules:
      - 'x:/etc/passwd'
  - id: 1004
    title: Sans condition
    rules:
      - 'f:/etc/passwd'
"#;

    fn ssh_host(config: &str) -> Arc<dyn Host> {
        Arc::new(
            FakeHost::default()
                .file("/etc/ssh/sshd_config", config)
                .directory("/etc/ssh/sshd_config.d", &[]),
        )
    }

    #[test]
    fn a_policy_becomes_checks_with_their_frameworks_and_guidance() {
        let policy = parse_policy(POLICY).unwrap();
        assert_eq!(policy.id, "ssh_hardening");
        assert_eq!(policy.check_count(), 2);
        // The two declarations that cannot work are left out with the reason.
        assert_eq!(policy.errors.len(), 2, "{:?}", policy.errors);
        assert!(policy.errors[0].contains("check 1003") && policy.errors[0].contains("'x:'"));
        assert!(policy.errors[1].contains("check 1004") && policy.errors[1].contains("condition"));

        let (definition, condition, rules) = &policy.checks[0];
        assert_eq!(definition.id, "sca_ssh_hardening_1001");
        assert_eq!(definition.name, "Connexion root interdite");
        assert_eq!(definition.severity, CheckSeverity::High);
        assert_eq!(definition.category, CheckCategory::RemoteAccess);
        assert_eq!(definition.frameworks, ["CIS_V8", "PCI_DSS", "NIST_CSF"]);
        assert_eq!(
            definition.parameters["remediation"],
            "Écrire « PermitRootLogin no » dans sshd_config."
        );
        assert_eq!(definition.parameters["compliance"]["cis"][0], "5.2.10");
        assert_eq!(*condition, Condition::All);
        // Variables are replaced, the longer name first.
        assert!(rules[1].source.contains("d:/etc/ssh/sshd_config.d ->"));
    }

    #[tokio::test]
    async fn the_checks_of_a_policy_run_like_any_check() {
        let run = |config: &'static str| async move {
            let mut registry = CheckRegistry::new();
            let mut report = ScaReport::default();
            let host = ssh_host(config);
            register_policy(
                &mut registry,
                parse_policy(POLICY).unwrap(),
                "test",
                &host,
                &mut report,
            );
            assert_eq!(report.checks(), 2);
            let root = registry
                .get("sca_ssh_hardening_1001")
                .unwrap()
                .execute()
                .await
                .unwrap();
            let tries = registry
                .get("sca_ssh_hardening_1002")
                .unwrap()
                .execute()
                .await
                .unwrap();
            (root, tries)
        };

        let (root, tries) = run("PermitRootLogin no\nMaxAuthTries 3\n").await;
        assert!(root.passed && tries.passed);
        assert_eq!(root.raw_data["rules"][0]["result"], "true");

        let (root, tries) = run("PermitRootLogin yes\nMaxAuthTries 6\n").await;
        assert!(!root.passed && !tries.passed);
        assert!(root.message.contains("PermitRootLogin"));
        assert!(!root.is_not_applicable());

        // No MaxAuthTries line: the rule is false, the check fails.
        let (_, tries) = run("PermitRootLogin no\n").await;
        assert!(!tries.passed && !tries.is_not_applicable());
    }

    #[tokio::test]
    async fn a_check_that_cannot_be_evaluated_is_not_applicable() {
        let policy = parse_policy(
            "policy:\n  id: p\nchecks:\n  - id: 1\n    title: T\n    condition: all\n    rules:\n      - 'f:/etc/absent.conf -> r:x'\n",
        )
        .unwrap();
        let mut registry = CheckRegistry::new();
        let host: Arc<dyn Host> = Arc::new(FakeHost::default());
        register_policy(
            &mut registry,
            policy,
            "test",
            &host,
            &mut ScaReport::default(),
        );
        let output = registry.get("sca_p_1").unwrap().execute().await.unwrap();
        assert!(output.is_not_applicable());
        assert!(output.message.contains("/etc/absent.conf does not exist"));
    }

    #[test]
    fn a_policy_applies_when_its_platform_and_requirements_say_so() {
        let policy = parse_policy(POLICY).unwrap();
        assert!(policy.applies(ssh_host("x").as_ref()).is_ok());
        let without_sshd = FakeHost::default();
        assert_eq!(
            policy.applies(&without_sshd).unwrap_err(),
            "its requirements are not met"
        );

        let elsewhere = parse_policy(
            "policy:\n  id: p\n  platforms: [plan9]\nchecks:\n  - id: 1\n    title: T\n    condition: all\n    rules:\n      - 'f:/x'\n",
        )
        .unwrap();
        assert_eq!(
            elsewhere.applies(&without_sshd).unwrap_err(),
            "written for plan9"
        );
    }

    #[test]
    fn broken_policies_are_refused_with_the_reason() {
        assert!(
            parse_policy("checks: [")
                .unwrap_err()
                .contains("invalid YAML")
        );
        assert!(
            parse_policy("policy:\n  name: n\n")
                .unwrap_err()
                .contains("no id")
        );
        assert!(
            parse_policy("policy:\n  id: p\n")
                .unwrap_err()
                .contains("no check")
        );
        assert!(
            parse_policy("policy:\n  id: p\n  regex_type: posix\nchecks: []\n")
                .unwrap_err()
                .contains("regex_type")
        );
        let refused = |rule: &str| Rule::parse(rule, RegexType::OsRegex).unwrap_err();
        assert!(refused("f:").contains("names nothing"));
        assert!(
            refused("/etc/passwd").contains("no rule type")
                || refused("/etc/passwd").contains("not supported")
        );
        assert!(refused("f:/x -> n:^(\\d+)").contains("no 'compare'"));
        assert!(refused("f:/x -> n:^\\d+ compare < 3").contains("no group"));
        assert!(refused("f:/x -> n:^(\\d+) compare ~ 3").contains("operator"));
        assert!(refused("f:/x -> <:abc").contains("not supported"));
    }

    #[test]
    fn perl_style_expressions_are_used_as_written_when_the_policy_says_so() {
        let rule = Rule::parse(r"f:/etc/x -> r:^\s*Protocol\s+[12]\b", RegexType::Pcre2).unwrap();
        let host = FakeHost::default().file("/etc/x", "Protocol 2\n");
        assert_eq!(rule.evaluate(&host), Truth::True);
        // The same text in the OSSEC dialect means a literal bracket.
        assert_eq!(
            truth(r"f:/etc/x -> r:^\s*Protocol\s+[12]", &host),
            Truth::False
        );
    }

    #[test]
    fn registry_output_is_read_with_numbers_in_decimal() {
        let output = "\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa\r\n    LimitBlankPasswordUse    REG_DWORD    0x1\r\n    Authentication Packages    REG_MULTI_SZ    msv1_0\r\n    Empty    REG_SZ    \r\n    Big    REG_QWORD    0xff\r\n\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\Sub\r\n";
        let values = parse_reg_query(output);
        assert_eq!(
            values,
            [
                ("LimitBlankPasswordUse".to_string(), "1".to_string()),
                ("Authentication Packages".to_string(), "msv1_0".to_string()),
                ("Empty".to_string(), String::new()),
                ("Big".to_string(), "255".to_string()),
            ]
        );
    }

    /// The example shipped in `config/` is what users start from.
    #[test]
    fn the_shipped_example_policy_is_valid() {
        let policy = parse_policy(include_str!("../../../../config/sca.example.yml")).unwrap();
        assert!(policy.errors.is_empty(), "{:?}", policy.errors);
        assert_eq!(policy.id, "exemple_ssh");
        assert_eq!(policy.check_count(), 2);
        assert_eq!(policy.checks[0].0.frameworks, ["ISO_27001", "CIS_V8"]);
        let host = FakeHost::default().file(
            "/etc/ssh/sshd_config",
            "PermitRootLogin no\nMaxAuthTries 6\n",
        );
        assert!(
            policy.applies(&host).is_ok() || !cfg!(any(target_os = "linux", target_os = "macos"))
        );
        let outcomes: Vec<Outcome> = policy
            .checks
            .iter()
            .map(|(_, condition, rules)| ScaCheck::evaluate(*condition, rules, &host).0)
            .collect();
        assert_eq!(outcomes, [Outcome::Passed, Outcome::Failed]);
    }

    /// Every policy shipped with the agent parses whole: no check is left
    /// out, identifiers are unique, and each policy names its platform.
    #[test]
    fn the_shipped_policies_all_load() {
        let mut ids = std::collections::HashSet::new();
        let mut total = 0;
        for (name, yaml) in BUILTIN_POLICIES {
            let policy = parse_policy(yaml).unwrap_or_else(|e| panic!("{name}: {e}"));
            assert!(policy.errors.is_empty(), "{name}: {:?}", policy.errors);
            assert_eq!(policy.platforms.len(), 1, "{name}");
            assert!(name.starts_with(policy.platforms[0].as_str()), "{name}");
            for (definition, _, rules) in &policy.checks {
                assert!(
                    ids.insert(definition.id.clone()),
                    "duplicate {}",
                    definition.id
                );
                assert!(!rules.is_empty());
                assert!(!definition.description.is_empty(), "{}", definition.id);
                assert!(
                    definition.parameters["remediation"].is_string(),
                    "{}",
                    definition.id
                );
                assert_eq!(
                    definition.frameworks,
                    ["ISO_27001", "CIS_V8"],
                    "{}",
                    definition.id
                );
            }
            total += policy.check_count();
        }
        assert!(total >= 160, "{total} checks");
    }

    /// The policy of this system, and only it, is registered.
    #[test]
    fn only_the_policy_of_this_system_is_registered() {
        let mut registry = CheckRegistry::new();
        let host: Arc<dyn Host> = Arc::new(FakeHost::default());
        let report = register_builtin_policies(&mut registry, &host);
        assert!(report.errors.is_empty(), "{:?}", report.errors);
        let expected = usize::from(cfg!(any(
            target_os = "linux",
            target_os = "macos",
            target_os = "windows"
        )));
        assert_eq!(report.policies.len(), expected);
        assert_eq!(report.skipped.len(), BUILTIN_POLICIES.len() - expected);
        assert_eq!(registry.count(), report.checks());
    }

    /// The real system: a file of this test, a command every Unix has.
    #[cfg(unix)]
    #[test]
    fn the_real_system_answers_the_rules() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("app.conf");
        std::fs::write(&file, "mode = strict\nretries = 3\n").unwrap();
        let host = SystemHost;
        let path = file.to_string_lossy();
        let rule = |text: String| {
            Rule::parse(&text, RegexType::OsRegex)
                .unwrap()
                .evaluate(&host)
        };

        assert_eq!(rule(format!("f:{path}")), Truth::True);
        assert_eq!(
            rule(format!("f:{path} -> r:^mode\\s*=\\s*strict")),
            Truth::True
        );
        assert_eq!(
            rule(format!("f:{path} -> n:^retries\\s*=\\s*(\\d+) compare < 3")),
            Truth::False
        );
        assert_eq!(
            rule(format!("d:{} -> r:\\.conf$", dir.path().display())),
            Truth::True
        );
        assert_eq!(
            rule("c:echo hello world -> r:^hello".to_string()),
            Truth::True
        );
        assert!(matches!(
            rule("c:/nonexistent/sentinel-tool -> r:x".to_string()),
            Truth::Unknown(_)
        ));
        // The test itself is a running process.
        assert!(!host.processes().is_empty());
        assert!(matches!(
            rule(r"r:HKEY_LOCAL_MACHINE\SOFTWARE".to_string()),
            Truth::Unknown(_)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn a_command_that_does_not_answer_is_stopped() {
        let started = Instant::now();
        let result = run_with_timeout(
            &["sleep".to_string(), "30".to_string()],
            Duration::from_millis(200),
        );
        assert!(matches!(result, Err(Unavailable::Other(reason)) if reason.contains("no answer")));
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
