// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Sigma rules on log events, and Sigma correlation rules.
//!
//! [`super::sigma`] reads the rules; this module evaluates the ones written
//! for a log source (`service: sshd`, `category: webserver`…) on the events
//! the agent reads from the system logs and from the declared log files, and
//! counts their matches for the correlation rules.
//!
//! # Correlation rules
//!
//! A correlation rule says that matches of other rules, taken together, are
//! a detection: ten failed logins from one address in five minutes, or a
//! successful login after such a burst.
//!
//! ```yaml
//! title: Attaque par force brute SSH
//! correlation:
//!   type: event_count
//!   rules:
//!     - ssh_failed_login        # the `name` or the `id` of a rule
//!   group-by:
//!     - src_ip
//!   timespan: 5m
//!   condition:
//!     gte: 8
//! level: high
//! ```
//!
//! | `type`             | Holds when, for one group, within the timespan…          |
//! |--------------------|-----------------------------------------------------------|
//! | `event_count`      | the rules matched `condition` times                       |
//! | `value_count`      | `condition.field` took `condition` distinct values        |
//! | `temporal`         | every rule listed matched (or `condition` of them)        |
//! | `temporal_ordered` | every rule listed matched, in the order they are listed   |
//!
//! - `condition` takes `gte` or `gt`. The others (`lt`, `lte`, `eq`, `neq`)
//!   describe an absence, which a stream of events cannot establish: a rule
//!   using them is refused.
//! - A match whose event lacks one of the `group-by` fields is not counted:
//!   it cannot be attributed to a group.
//! - The rules listed do not raise a detection of their own, unless the
//!   correlation says `generate: true`.
//! - A correlation may list another correlation.
//! - Time is the time of the events, not of their reading: a log read late
//!   is counted as it happened.
//! - Once a correlation holds for a group, its count starts again.
//! - `aliases` are not supported.

use super::sigma::{
    self, LoadedRules, LogCoverage, SigmaDocument, SigmaEvent, SigmaLevel, SigmaLoadReport,
    SigmaRule, scalar_text, tags_of, text_field,
};
use super::{IncidentSeverity, IncidentType, SecurityIncident};
use chrono::{DateTime, Duration, Utc};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use yaml_rust2::Yaml;

/// Groups followed at most by one correlation rule. Past it, the groups
/// without a recent match are forgotten first.
const MAX_GROUPS: usize = 10_000;
/// Distinct values remembered at most for one group of a `value_count`.
const MAX_VALUES: usize = 1_000;
/// Longest timespan a correlation may ask for.
const MAX_TIMESPAN_DAYS: i64 = 30;
/// Longest value kept in the evidence of an incident.
const MAX_EVIDENCE_CHARS: usize = 512;

/// The rules shipped with the agent (`crates/agent-scanner/rules`).
const BUILTIN_RULES: &[(&str, &str)] = &[
    ("auth.yml", include_str!("../../rules/auth.yml")),
    ("accounts.yml", include_str!("../../rules/accounts.yml")),
    ("system.yml", include_str!("../../rules/system.yml")),
    ("web.yml", include_str!("../../rules/web.yml")),
    ("windows.yml", include_str!("../../rules/windows.yml")),
    ("containers.yml", include_str!("../../rules/containers.yml")),
];

/// A log event as the rules see it.
#[derive(Debug, Clone, Copy)]
pub struct LogEvent<'a> {
    /// `logsource.service` values the event answers to (lower case):
    /// `["sshd", "auth", "syslog"]` for a line written by sshd.
    pub services: &'a [String],
    /// `logsource.category` values the event answers to (`webserver`).
    pub categories: &'a [String],
    /// Field name (lower case) to value.
    pub fields: &'a SigmaEvent,
    /// When the event happened.
    pub timestamp: DateTime<Utc>,
}

/// How a correlation rule counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CorrelationKind {
    EventCount,
    ValueCount,
    Temporal,
    TemporalOrdered,
}

impl CorrelationKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::EventCount => "event_count",
            Self::ValueCount => "value_count",
            Self::Temporal => "temporal",
            Self::TemporalOrdered => "temporal_ordered",
        }
    }
}

/// A parsed correlation rule.
#[derive(Debug)]
pub struct CorrelationRule {
    pub id: String,
    pub title: String,
    pub description: String,
    pub level: SigmaLevel,
    pub tags: Vec<String>,
    /// What another correlation refers to this one by (its `id` works too).
    pub name: Option<String>,
    pub kind: CorrelationKind,
    /// Names or identifiers of the rules counted.
    pub rules: Vec<String>,
    /// Fields (lower case) whose values a match is counted under.
    pub group_by: Vec<String>,
    pub timespan: Duration,
    /// Matches, distinct values or rules from which the correlation holds.
    pub at_least: u64,
    /// `value_count`: the field (lower case) whose distinct values count.
    pub value_field: Option<String>,
    /// Whether the rules counted also raise a detection of their own.
    pub generate: bool,
}

/// `5m`, `90s`, `1h`, `2d`, `1w`.
fn parse_timespan(text: &str) -> Result<Duration, String> {
    let text = text.trim();
    let invalid = || format!("timespan '{text}' is not a number followed by s, m, h, d or w");
    let unit = text.chars().last().ok_or_else(invalid)?;
    let number: i64 = text[..text.len() - unit.len_utf8()]
        .parse()
        .map_err(|_| invalid())?;
    let seconds = match unit {
        's' => 1,
        'm' => 60,
        'h' => 3_600,
        'd' => 86_400,
        'w' => 604_800,
        _ => return Err(invalid()),
    };
    let span = number.checked_mul(seconds).ok_or_else(invalid)?;
    if span <= 0 {
        return Err(format!("timespan '{text}' must be positive"));
    }
    if span > MAX_TIMESPAN_DAYS * 86_400 {
        return Err(format!(
            "timespan '{text}' is longer than {MAX_TIMESPAN_DAYS} days"
        ));
    }
    Ok(Duration::seconds(span))
}

fn text_list(value: &Yaml) -> Vec<String> {
    match value {
        Yaml::Array(items) => items.iter().filter_map(scalar_text).collect(),
        single => scalar_text(single).into_iter().collect(),
    }
}

/// Parse one correlation rule document.
pub fn parse_correlation(document: &Yaml) -> Result<CorrelationRule, String> {
    let title =
        text_field(document, "title").ok_or_else(|| "correlation has no title".to_string())?;
    let correlation = &document["correlation"];
    if correlation.as_hash().is_none() {
        return Err("'correlation' is not a map".to_string());
    }
    if !correlation["aliases"].is_badvalue() {
        return Err("'aliases' are not supported".to_string());
    }

    let kind = match text_field(correlation, "type")
        .map(|kind| kind.to_ascii_lowercase())
        .as_deref()
    {
        Some("event_count") => CorrelationKind::EventCount,
        Some("value_count") => CorrelationKind::ValueCount,
        Some("temporal") => CorrelationKind::Temporal,
        Some("temporal_ordered") => CorrelationKind::TemporalOrdered,
        Some(other) => return Err(format!("correlation type '{other}' is not supported")),
        None => return Err("correlation has no type".to_string()),
    };

    let rules = text_list(&correlation["rules"]);
    if rules.is_empty() {
        return Err("correlation lists no rule".to_string());
    }
    let group_by: Vec<String> = text_list(&correlation["group-by"])
        .into_iter()
        .map(|field| field.trim().to_ascii_lowercase())
        .collect();
    let timespan = text_field(correlation, "timespan")
        .or_else(|| text_field(correlation, "timeframe"))
        .ok_or_else(|| "correlation has no timespan".to_string())
        .and_then(|text| parse_timespan(&text))?;

    let condition = &correlation["condition"];
    let mut threshold = None;
    if let Some(entries) = condition.as_hash() {
        for (key, value) in entries {
            let key = key.as_str().unwrap_or_default().to_ascii_lowercase();
            let number = || {
                value
                    .as_i64()
                    .and_then(|number| u64::try_from(number).ok())
                    .ok_or_else(|| format!("condition '{key}' takes a positive number"))
            };
            match key.as_str() {
                "gte" => threshold = Some(number()?),
                "gt" => threshold = Some(number()?.saturating_add(1)),
                "field" => {}
                "lt" | "lte" | "eq" | "neq" => {
                    return Err(format!(
                        "condition '{key}' describes an absence and is not supported \
                         (use gte or gt)"
                    ));
                }
                other => return Err(format!("condition '{other}' is not supported")),
            }
        }
    }
    let temporal = matches!(
        kind,
        CorrelationKind::Temporal | CorrelationKind::TemporalOrdered
    );
    let at_least = match (threshold, temporal) {
        (Some(0), _) => return Err("condition must be at least 1".to_string()),
        (Some(threshold), _) => threshold,
        // Every rule listed, by default.
        (None, true) => rules.len() as u64,
        (None, false) => return Err("correlation has no condition (gte or gt)".to_string()),
    };
    if temporal && (rules.len() < 2 || at_least > rules.len() as u64) {
        return Err(format!(
            "a {} correlation needs at least two rules and a condition no larger than their number",
            kind.as_str()
        ));
    }

    let value_field = text_field(condition, "field").map(|field| field.to_ascii_lowercase());
    if kind == CorrelationKind::ValueCount && value_field.is_none() {
        return Err("a value_count correlation needs condition.field".to_string());
    }

    let generate = [&correlation["generate"], &document["generate"]]
        .into_iter()
        .find_map(Yaml::as_bool)
        .unwrap_or(false);

    Ok(CorrelationRule {
        id: text_field(document, "id").unwrap_or_else(|| title.clone()),
        description: text_field(document, "description").unwrap_or_default(),
        level: text_field(document, "level")
            .map(|level| SigmaLevel::parse(&level))
            .unwrap_or(SigmaLevel::Medium),
        tags: tags_of(document),
        name: text_field(document, "name"),
        title,
        kind,
        rules,
        group_by,
        timespan,
        at_least,
        value_field,
        generate,
    })
}

/// What a correlation counted when it held.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CorrelationHit {
    pub kind: CorrelationKind,
    /// Matches, distinct values or rules counted.
    pub count: u64,
    pub timespan_secs: i64,
    /// The group: field and value.
    pub group: Vec<(String, String)>,
}

/// A rule or a correlation that holds for an event.
#[derive(Debug, Clone)]
pub struct Detection {
    pub rule_id: String,
    pub title: String,
    pub description: String,
    pub level: SigmaLevel,
    pub tags: Vec<String>,
    /// Set for a correlation.
    pub correlation: Option<CorrelationHit>,
}

impl Detection {
    /// MITRE ATT&CK technique identifiers among the tags.
    pub fn attack_techniques(&self) -> Vec<String> {
        sigma::attack_techniques(&self.tags)
    }

    /// Whether the detection is worth an incident. `low` and
    /// `informational` rules describe ordinary activity worth recording,
    /// not something to act on.
    pub fn is_incident(&self) -> bool {
        self.level >= SigmaLevel::Medium
    }
}

/// What feeds a correlation: a rule or another correlation, by index.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Source {
    Rule(usize),
    Correlation(usize),
}

struct LogRule {
    rule: SigmaRule,
    /// Whether a match is a detection of its own.
    alerts: bool,
}

/// What one group of a correlation has seen within the timespan.
#[derive(Default)]
struct Window {
    /// `event_count`: when the matches happened.
    times: VecDeque<DateTime<Utc>>,
    /// `value_count`: when each value was last seen.
    values: HashMap<String, DateTime<Utc>>,
    /// `temporal`: when each listed rule last matched.
    per_rule: Vec<Option<DateTime<Utc>>>,
    latest: Option<DateTime<Utc>>,
}

struct Correlation {
    rule: CorrelationRule,
    /// The listed rules, in the order they are listed.
    sources: Vec<Source>,
    /// Whether holding is a detection of its own.
    alerts: bool,
    groups: HashMap<Vec<String>, Window>,
}

impl Correlation {
    /// Count a match of `source` at `at`. Returns what was counted when the
    /// correlation holds.
    fn count(
        &mut self,
        source: Source,
        fields: &SigmaEvent,
        at: DateTime<Utc>,
    ) -> Option<CorrelationHit> {
        let mut key = Vec::with_capacity(self.rule.group_by.len());
        for field in &self.rule.group_by {
            key.push(fields.get(field).filter(|value| !value.is_empty())?.clone());
        }
        let position = self.sources.iter().position(|listed| *listed == source)?;
        let oldest = at - self.rule.timespan;

        if !self.groups.contains_key(&key) && self.groups.len() >= MAX_GROUPS {
            self.groups
                .retain(|_, window| window.latest.is_some_and(|latest| latest > oldest));
            if self.groups.len() >= MAX_GROUPS {
                return None;
            }
        }
        let rules_listed = self.sources.len();
        let window = self.groups.entry(key.clone()).or_default();
        window.latest = Some(window.latest.map_or(at, |latest| latest.max(at)));

        let count = match self.rule.kind {
            CorrelationKind::EventCount => {
                window.times.retain(|time| *time > oldest);
                window.times.push_back(at);
                window.times.len() as u64
            }
            CorrelationKind::ValueCount => {
                let value = self
                    .rule
                    .value_field
                    .as_ref()
                    .and_then(|field| fields.get(field))
                    .filter(|value| !value.is_empty())?;
                window.values.retain(|_, time| *time > oldest);
                if window.values.len() < MAX_VALUES || window.values.contains_key(value) {
                    window.values.insert(value.clone(), at);
                }
                window.values.len() as u64
            }
            CorrelationKind::Temporal => {
                window.per_rule.resize(rules_listed, None);
                window.per_rule[position] = Some(at);
                window
                    .per_rule
                    .iter()
                    .filter(|time| time.is_some_and(|time| time > oldest))
                    .count() as u64
            }
            CorrelationKind::TemporalOrdered => {
                window.per_rule.resize(rules_listed, None);
                let recent = |time: Option<DateTime<Utc>>| time.filter(|time| *time > oldest);
                // A rule counts only once the one listed before it has matched.
                let in_order = position == 0
                    || recent(window.per_rule[position - 1]).is_some_and(|before| before <= at);
                if in_order {
                    window.per_rule[position] = Some(at);
                    // What follows has to happen again, after this match.
                    for later in window.per_rule.iter_mut().skip(position + 1) {
                        *later = None;
                    }
                }
                window
                    .per_rule
                    .iter()
                    .map_while(|time| recent(*time))
                    .count() as u64
            }
        };
        if count < self.rule.at_least {
            return None;
        }
        // The correlation holds: its count starts again for this group.
        self.groups.remove(&key);
        Some(CorrelationHit {
            kind: self.rule.kind,
            count,
            timespan_secs: self.rule.timespan.num_seconds(),
            group: self.rule.group_by.iter().cloned().zip(key).collect(),
        })
    }
}

/// The log rules and correlation rules evaluated on this endpoint.
#[derive(Default)]
pub struct LogRuleEngine {
    rules: Vec<LogRule>,
    correlations: Vec<Correlation>,
    /// Rules by the `service` they are written for.
    by_service: HashMap<String, Vec<usize>>,
    /// Rules written for a `category` and no service.
    by_category: HashMap<String, Vec<usize>>,
    /// Rules written for the operating system as a whole.
    every_log: Vec<usize>,
    /// Correlations counting each source.
    counted_by: HashMap<Source, Vec<usize>>,
}

impl LogRuleEngine {
    /// Build the engine. A correlation listing a rule that is not there, or
    /// listing itself through others, is left out with the reason.
    pub fn new(rules: Vec<SigmaRule>, correlations: Vec<CorrelationRule>) -> (Self, Vec<String>) {
        let (engine, errors, _) = Self::with_absent(rules, correlations, &HashSet::new());
        (engine, errors)
    }

    /// Build the engine, knowing the names of the rules that were read but
    /// are not evaluated on this endpoint (`absent`). A correlation listing
    /// one of them is not for this endpoint either: it is counted (third
    /// value returned), not reported as an error.
    pub fn with_absent(
        rules: Vec<SigmaRule>,
        correlations: Vec<CorrelationRule>,
        absent: &HashSet<String>,
    ) -> (Self, Vec<String>, usize) {
        let mut errors = Vec::new();
        let mut absent = absent.clone();
        let mut not_applicable = 0;
        let mut names: HashMap<String, Source> = HashMap::new();
        for (index, rule) in rules.iter().enumerate() {
            names.insert(rule.id.clone(), Source::Rule(index));
            if let Some(name) = &rule.name {
                names.insert(name.clone(), Source::Rule(index));
            }
        }

        // Keep the correlations whose rules all exist; one may list another,
        // so a refusal is propagated until nothing changes.
        let mut kept: Vec<CorrelationRule> = correlations;
        loop {
            let mut known = names.clone();
            for (index, rule) in kept.iter().enumerate() {
                known.insert(rule.id.clone(), Source::Correlation(index));
                if let Some(name) = &rule.name {
                    known.insert(name.clone(), Source::Correlation(index));
                }
            }
            let before = kept.len();
            kept.retain(|rule| {
                match rule
                    .rules
                    .iter()
                    .find(|listed| !known.contains_key(*listed))
                {
                    Some(missing) if absent.contains(missing) => {
                        not_applicable += 1;
                        absent.extend(rule.name.clone());
                        absent.insert(rule.id.clone());
                        false
                    }
                    Some(missing) => {
                        errors.push(format!(
                            "correlation '{}': rule '{missing}' is not loaded",
                            rule.title
                        ));
                        false
                    }
                    None => true,
                }
            });
            if kept.len() == before {
                break;
            }
        }
        for (index, rule) in kept.iter().enumerate() {
            names.insert(rule.id.clone(), Source::Correlation(index));
            if let Some(name) = &rule.name {
                names.insert(name.clone(), Source::Correlation(index));
            }
        }

        let sources_of = |rule: &CorrelationRule| -> Vec<Source> {
            rule.rules.iter().map(|listed| names[listed]).collect()
        };
        let listed: Vec<Vec<Source>> = kept.iter().map(sources_of).collect();

        // A correlation listing itself, directly or through others, would
        // count its own detections for ever.
        let cyclic: HashSet<usize> = (0..kept.len())
            .filter(|start| {
                let mut seen = HashSet::new();
                let mut pending = vec![*start];
                while let Some(index) = pending.pop() {
                    for source in &listed[index] {
                        if let Source::Correlation(next) = source {
                            if next == start {
                                return true;
                            }
                            if seen.insert(*next) {
                                pending.push(*next);
                            }
                        }
                    }
                }
                false
            })
            .collect();
        for index in &cyclic {
            errors.push(format!(
                "correlation '{}' lists itself, directly or through another",
                kept[*index].title
            ));
        }
        if !cyclic.is_empty() {
            // Start again without them: the indices of the others change.
            let remaining: Vec<CorrelationRule> = kept
                .into_iter()
                .enumerate()
                .filter(|(index, _)| !cyclic.contains(index))
                .map(|(_, rule)| rule)
                .collect();
            let (engine, more, others) = Self::with_absent(rules, remaining, &absent);
            errors.extend(more);
            return (engine, errors, not_applicable + others);
        }

        // A source counted by a correlation is silent unless one of the
        // correlations counting it says `generate: true`.
        let mut counted_by: HashMap<Source, Vec<usize>> = HashMap::new();
        let mut generated: HashSet<Source> = HashSet::new();
        for (index, sources) in listed.iter().enumerate() {
            for source in sources {
                counted_by.entry(*source).or_default().push(index);
                if kept[index].generate {
                    generated.insert(*source);
                }
            }
        }
        let alerts =
            |source: Source| !counted_by.contains_key(&source) || generated.contains(&source);

        let mut engine = Self::default();
        for (index, rule) in rules.into_iter().enumerate() {
            match (&rule.service, &rule.category) {
                (Some(service), _) => engine
                    .by_service
                    .entry(service.clone())
                    .or_default()
                    .push(index),
                (None, Some(category)) => engine
                    .by_category
                    .entry(category.clone())
                    .or_default()
                    .push(index),
                (None, None) => engine.every_log.push(index),
            }
            engine.rules.push(LogRule {
                alerts: alerts(Source::Rule(index)),
                rule,
            });
        }
        for (index, (rule, sources)) in kept.into_iter().zip(listed).enumerate() {
            engine.correlations.push(Correlation {
                alerts: alerts(Source::Correlation(index)),
                rule,
                sources,
                groups: HashMap::new(),
            });
        }
        engine.counted_by = counted_by;
        (engine, errors, not_applicable)
    }

    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }

    pub fn correlation_count(&self) -> usize {
        self.correlations.len()
    }

    /// The rules and correlations that hold for an event.
    pub fn evaluate(&mut self, event: &LogEvent<'_>) -> Vec<Detection> {
        let mut candidates: Vec<usize> = self.every_log.clone();
        for service in event.services {
            if let Some(rules) = self.by_service.get(service) {
                candidates.extend(rules);
            }
        }
        for category in event.categories {
            if let Some(rules) = self.by_category.get(category) {
                candidates.extend(rules);
            }
        }

        let mut detections = Vec::new();
        let mut pending: Vec<Source> = Vec::new();
        for index in candidates {
            let LogRule { rule, alerts } = &self.rules[index];
            // A rule naming a service and a category wants both.
            let wanted_category = rule.service.is_some()
                && rule
                    .category
                    .as_ref()
                    .is_some_and(|category| !event.categories.contains(category));
            if wanted_category || !rule.matches(event.fields) {
                continue;
            }
            if *alerts {
                detections.push(Detection {
                    rule_id: rule.id.clone(),
                    title: rule.title.clone(),
                    description: rule.description.clone(),
                    level: rule.level,
                    tags: rule.tags.clone(),
                    correlation: None,
                });
            }
            pending.push(Source::Rule(index));
        }

        // Count the matches; a correlation that holds is counted in turn by
        // the correlations listing it. There is no cycle (see `new`).
        while let Some(source) = pending.pop() {
            let Some(counting) = self.counted_by.get(&source).cloned() else {
                continue;
            };
            for index in counting {
                let correlation = &mut self.correlations[index];
                let Some(hit) = correlation.count(source, event.fields, event.timestamp) else {
                    continue;
                };
                if correlation.alerts {
                    detections.push(Detection {
                        rule_id: correlation.rule.id.clone(),
                        title: correlation.rule.title.clone(),
                        description: correlation.rule.description.clone(),
                        level: correlation.rule.level,
                        tags: correlation.rule.tags.clone(),
                        correlation: Some(hit),
                    });
                }
                pending.push(Source::Correlation(index));
            }
        }
        detections
    }
}

/// The documents of the rules shipped with the agent, and the files that
/// could not be read (none, unless the build is broken).
pub fn builtin_documents() -> (Vec<SigmaDocument>, Vec<String>) {
    let mut documents = Vec::new();
    let mut errors = Vec::new();
    for (name, yaml) in BUILTIN_RULES {
        match sigma::parse_documents(yaml) {
            Ok(parsed) => documents.extend(parsed),
            Err(e) => errors.push(format!("built-in {name}: {e}")),
        }
    }
    (documents, errors)
}

fn document_id(document: &SigmaDocument) -> &str {
    match document {
        SigmaDocument::Rule(rule) => &rule.id,
        SigmaDocument::Correlation(rule) => &rule.id,
    }
}

/// Load the rules shipped with the agent and those of `dir`.
///
/// A rule of `dir` with the identifier of a shipped rule replaces it, and an
/// identifier listed in `dir/disabled-rules.txt` is not loaded: this is how
/// a shipped rule is tuned or turned off.
pub fn load(dir: &Path, coverage: &LogCoverage) -> (LoadedRules, LogRuleEngine) {
    load_for(dir, coverage, sigma::host_product())
}

/// [`load`] for the operating system `product` names instead of the one the
/// agent runs on.
pub fn load_for(dir: &Path, coverage: &LogCoverage, product: &str) -> (LoadedRules, LogRuleEngine) {
    let mut loaded = sigma::load_rules_for(dir, coverage, product);
    let disabled = sigma::disabled_rules(dir);

    let replaced: HashSet<String> = loaded
        .logs
        .iter()
        .map(|rule| rule.id.clone())
        .chain(loaded.correlations.iter().map(|rule| rule.id.clone()))
        .collect();
    let (builtin, errors) = builtin_documents();
    loaded.report.errors.extend(errors);
    let builtin = builtin
        .into_iter()
        .filter(|document| !replaced.contains(document_id(document)))
        .collect();
    loaded.add(builtin, coverage, &disabled, product);

    let (engine, errors, not_applicable) = LogRuleEngine::with_absent(
        std::mem::take(&mut loaded.logs),
        std::mem::take(&mut loaded.correlations),
        &loaded.absent,
    );
    loaded.report.errors.extend(errors);
    loaded.report.not_applicable += not_applicable;
    loaded.report.log_rules = engine.rule_count();
    loaded.report.correlations = engine.correlation_count();
    (loaded, engine)
}

/// What a report of [`load`] says in one line.
pub fn summary(report: &SigmaLoadReport) -> String {
    format!(
        "{} on processes, {} on logs, {} correlations, {} for another log source or system, {} refused",
        report.loaded,
        report.log_rules,
        report.correlations,
        report.not_applicable,
        report.errors.len()
    )
}

/// The kind of incident a detection is, from its ATT&CK tactics.
fn incident_type(tags: &[String]) -> IncidentType {
    let has = |tactic: &str| {
        tags.iter()
            .any(|tag| tag.eq_ignore_ascii_case(&format!("attack.{tactic}")))
    };
    if has("credential_access") || has("credential-access") {
        IncidentType::CredentialTheft
    } else if has("privilege_escalation") || has("privilege-escalation") {
        IncidentType::PrivilegeEscalation
    } else if has("exfiltration") {
        IncidentType::DataExfiltration
    } else if has("persistence") || has("defense_evasion") || has("defense-evasion") {
        IncidentType::UnauthorizedChange
    } else {
        IncidentType::SuspiciousProcess
    }
}

fn excerpt(value: &str) -> String {
    if value.chars().count() <= MAX_EVIDENCE_CHARS {
        value.to_string()
    } else {
        let cut: String = value.chars().take(MAX_EVIDENCE_CHARS).collect();
        format!("{cut}…")
    }
}

/// The incident for a detection on a log event read from `source`.
pub fn incident(detection: &Detection, fields: &SigmaEvent, source: &str) -> SecurityIncident {
    let (severity, confidence) = match detection.level {
        SigmaLevel::Critical => (IncidentSeverity::Critical, 90),
        SigmaLevel::High => (IncidentSeverity::High, 80),
        SigmaLevel::Medium => (IncidentSeverity::Medium, 60),
        SigmaLevel::Low => (IncidentSeverity::Low, 40),
        SigmaLevel::Informational => (IncidentSeverity::Low, 20),
    };
    let mut description = if detection.description.is_empty() {
        format!(
            "La règle Sigma « {} » correspond à un événement des journaux.",
            detection.title
        )
    } else {
        detection.description.clone()
    };
    if let Some(hit) = &detection.correlation {
        let group: Vec<String> = hit
            .group
            .iter()
            .map(|(field, value)| format!("{field}={value}"))
            .collect();
        description.push_str(&format!(
            " ({} en {} s{}{})",
            hit.count,
            hit.timespan_secs,
            if group.is_empty() { "" } else { ", " },
            group.join(", ")
        ));
    }

    let mut event = serde_json::Map::new();
    let mut names: Vec<&String> = fields.keys().collect();
    names.sort();
    for name in names {
        event.insert(name.clone(), excerpt(&fields[name]).into());
    }
    let correlation = detection.correlation.as_ref().map(|hit| {
        serde_json::json!({
            "type": hit.kind.as_str(),
            "count": hit.count,
            "timespan_secs": hit.timespan_secs,
            "group": hit.group.iter().cloned().collect::<HashMap<String, String>>(),
        })
    });

    SecurityIncident::new(
        incident_type(&detection.tags),
        severity,
        format!("Sigma: {}", detection.title),
        description,
    )
    .with_confidence(confidence)
    .with_evidence(serde_json::json!({
        "detection": "sigma_log",
        "rule_id": detection.rule_id,
        "rule_title": detection.title,
        "attack_techniques": detection.attack_techniques(),
        "log_source": source,
        "event": event,
        "correlation": correlation,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAILED_LOGIN: &str = "title: Failed SSH login\nname: ssh_failed\nlevel: low\n\
        logsource:\n  service: sshd\ndetection:\n  sel:\n    action: login_failed\n  condition: sel\n";
    const LOGIN: &str = "title: SSH login\nname: ssh_login\nlevel: informational\n\
        logsource:\n  service: sshd\ndetection:\n  sel:\n    action: login_success\n  condition: sel\n";

    fn correlation(body: &str) -> String {
        format!("title: C\nlevel: high\ncorrelation:\n{body}")
    }

    fn engine(documents: &[&str]) -> LogRuleEngine {
        let (engine, errors) = try_engine(documents);
        assert!(errors.is_empty(), "{errors:?}");
        engine
    }

    fn try_engine(documents: &[&str]) -> (LogRuleEngine, Vec<String>) {
        let mut rules = Vec::new();
        let mut correlations = Vec::new();
        for document in sigma::parse_documents(&documents.join("---\n")).unwrap() {
            match document {
                SigmaDocument::Rule(rule) => rules.push(rule),
                SigmaDocument::Correlation(rule) => correlations.push(rule),
            }
        }
        LogRuleEngine::new(rules, correlations)
    }

    fn fields(pairs: &[(&str, &str)]) -> SigmaEvent {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect()
    }

    fn at(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000 + seconds, 0).unwrap()
    }

    /// Titles of what holds for an sshd event at `seconds`.
    fn sshd(engine: &mut LogRuleEngine, seconds: i64, pairs: &[(&str, &str)]) -> Vec<String> {
        let services = ["sshd".to_string(), "auth".to_string()];
        let fields = fields(pairs);
        engine
            .evaluate(&LogEvent {
                services: &services,
                categories: &[],
                fields: &fields,
                timestamp: at(seconds),
            })
            .into_iter()
            .map(|detection| detection.title)
            .collect()
    }

    fn failed(ip: &str, user: &str) -> Vec<(&'static str, String)> {
        vec![
            ("action", "login_failed".to_string()),
            ("src_ip", ip.to_string()),
            ("user", user.to_string()),
        ]
    }

    fn failure(engine: &mut LogRuleEngine, seconds: i64, ip: &str, user: &str) -> Vec<String> {
        let owned = failed(ip, user);
        let pairs: Vec<(&str, &str)> = owned.iter().map(|(k, v)| (*k, v.as_str())).collect();
        sshd(engine, seconds, &pairs)
    }

    #[test]
    fn a_rule_is_evaluated_on_the_events_of_its_log_source_only() {
        let mut engine = engine(&[FAILED_LOGIN]);
        assert_eq!(
            sshd(&mut engine, 0, &[("action", "login_failed")]),
            ["Failed SSH login"]
        );
        assert!(sshd(&mut engine, 0, &[("action", "login_success")]).is_empty());

        // The same fields from another program: not this rule's source.
        let other = ["nginx".to_string()];
        let event_fields = fields(&[("action", "login_failed")]);
        let event = LogEvent {
            services: &other,
            categories: &[],
            fields: &event_fields,
            timestamp: at(0),
        };
        assert!(engine.evaluate(&event).is_empty());
    }

    #[test]
    fn a_rule_naming_a_category_and_a_service_wants_both() {
        let mut engine = engine(&[
            "title: Both\nlogsource:\n  category: webserver\n  service: nginx\n\
             detection:\n  sel:\n    c-uri|contains: '/admin'\n  condition: sel\n",
        ]);
        let event_fields = fields(&[("c-uri", "/admin/login")]);
        let nginx = ["nginx".to_string()];
        let web = ["webserver".to_string()];
        let mut evaluate = |categories: &[String]| {
            engine
                .evaluate(&LogEvent {
                    services: &nginx,
                    categories,
                    fields: &event_fields,
                    timestamp: at(0),
                })
                .len()
        };
        assert_eq!(evaluate(&web), 1);
        assert_eq!(evaluate(&[]), 0);
    }

    #[test]
    fn matches_are_counted_per_group_within_the_timespan() {
        let mut engine = engine(&[
            FAILED_LOGIN,
            &correlation(
                "  type: event_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 5m\n  condition:\n    gte: 3\n",
            ),
        ]);
        // The rule counted is silent; the third match from one address holds.
        assert!(failure(&mut engine, 0, "203.0.113.9", "root").is_empty());
        assert!(failure(&mut engine, 10, "203.0.113.9", "admin").is_empty());
        // Another address has its own count.
        assert!(failure(&mut engine, 15, "198.51.100.7", "root").is_empty());
        assert_eq!(failure(&mut engine, 20, "203.0.113.9", "test"), ["C"]);
        // The count starts again once the correlation held.
        assert!(failure(&mut engine, 30, "203.0.113.9", "root").is_empty());
        assert!(failure(&mut engine, 40, "203.0.113.9", "root").is_empty());
        assert_eq!(failure(&mut engine, 50, "203.0.113.9", "root"), ["C"]);

        // Matches further apart than the timespan never add up.
        for step in 0..6 {
            assert!(failure(&mut engine, 1_000 + step * 200, "192.0.2.50", "root").is_empty());
        }
    }

    #[test]
    fn a_match_that_cannot_be_attributed_to_a_group_is_not_counted() {
        let mut engine = engine(&[
            FAILED_LOGIN,
            &correlation(
                "  type: event_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 5m\n  condition:\n    gte: 2\n",
            ),
        ]);
        for second in 0..5 {
            assert!(sshd(&mut engine, second, &[("action", "login_failed")]).is_empty());
        }
    }

    #[test]
    fn the_detection_says_what_was_counted() {
        let mut engine = engine(&[
            FAILED_LOGIN,
            &correlation(
                "  type: event_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 5m\n  condition:\n    gt: 1\n",
            ),
        ]);
        failure(&mut engine, 0, "203.0.113.9", "root");
        let owned = failed("203.0.113.9", "root");
        let event_fields: SigmaEvent = owned.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
        let services = ["sshd".to_string()];
        let detections = engine.evaluate(&LogEvent {
            services: &services,
            categories: &[],
            fields: &event_fields,
            timestamp: at(5),
        });
        let hit = detections[0].correlation.as_ref().unwrap();
        assert_eq!(hit.count, 2);
        assert_eq!(hit.timespan_secs, 300);
        assert_eq!(
            hit.group,
            [("src_ip".to_string(), "203.0.113.9".to_string())]
        );

        let incident = incident(&detections[0], &event_fields, "sshd");
        assert_eq!(incident.severity, IncidentSeverity::High);
        assert!(
            incident
                .description
                .contains("2 en 300 s, src_ip=203.0.113.9")
        );
        assert_eq!(incident.evidence["correlation"]["count"], 2);
        assert_eq!(incident.evidence["event"]["user"], "root");
        assert_eq!(incident.evidence["log_source"], "sshd");
    }

    #[test]
    fn distinct_values_are_counted_not_events() {
        let mut engine = engine(&[
            FAILED_LOGIN,
            &correlation(
                "  type: value_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 10m\n  condition:\n    field: user\n    gte: 3\n",
            ),
        ]);
        // The same account ten times is one value.
        for second in 0..10 {
            assert!(failure(&mut engine, second, "203.0.113.9", "root").is_empty());
        }
        assert!(failure(&mut engine, 20, "203.0.113.9", "admin").is_empty());
        assert_eq!(failure(&mut engine, 30, "203.0.113.9", "oracle"), ["C"]);
    }

    #[test]
    fn a_correlation_may_count_another_and_order_matters() {
        let burst = "title: Brute force\nname: brute\nlevel: high\ncorrelation:\n  type: event_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 5m\n  condition:\n    gte: 3\n";
        let then_login = "title: Login after brute force\nlevel: critical\ncorrelation:\n  type: temporal_ordered\n  generate: true\n  rules:\n    - brute\n    - ssh_login\n  group-by:\n    - src_ip\n  timespan: 15m\n";
        let mut engine = engine(&[FAILED_LOGIN, LOGIN, burst, then_login]);
        let login = |engine: &mut LogRuleEngine, seconds: i64, ip: &str| {
            sshd(
                engine,
                seconds,
                &[
                    ("action", "login_success"),
                    ("src_ip", ip),
                    ("user", "root"),
                ],
            )
        };

        // A login with no burst before it: the login rule alone (it is
        // generated, being listed by a correlation that says so).
        assert_eq!(login(&mut engine, 0, "203.0.113.9"), ["SSH login"]);

        failure(&mut engine, 10, "203.0.113.9", "root");
        failure(&mut engine, 11, "203.0.113.9", "root");
        assert_eq!(
            failure(&mut engine, 12, "203.0.113.9", "root"),
            ["Brute force"]
        );
        // The login that came before the burst does not complete the order…
        // the one after it does.
        let mut after = login(&mut engine, 60, "203.0.113.9");
        after.sort();
        assert_eq!(after, ["Login after brute force", "SSH login"]);
        // From another address, a login completes nothing.
        assert_eq!(login(&mut engine, 61, "198.51.100.7"), ["SSH login"]);
        // And the sequence has to happen again to hold again.
        assert_eq!(login(&mut engine, 62, "203.0.113.9"), ["SSH login"]);
    }

    #[test]
    fn every_listed_rule_within_the_timespan_in_any_order() {
        let both = correlation(
            "  type: temporal\n  rules:\n    - ssh_failed\n    - ssh_login\n  group-by:\n    - user\n  timespan: 1m\n",
        );
        let mut engine = engine(&[FAILED_LOGIN, LOGIN, &both]);
        let login = |engine: &mut LogRuleEngine, seconds: i64| {
            sshd(
                engine,
                seconds,
                &[("action", "login_success"), ("user", "root")],
            )
        };
        assert!(login(&mut engine, 0).is_empty());
        assert_eq!(failure(&mut engine, 30, "203.0.113.9", "root"), ["C"]);
        // Too far apart.
        assert!(login(&mut engine, 100).is_empty());
        assert!(failure(&mut engine, 200, "203.0.113.9", "root").is_empty());
    }

    #[test]
    fn correlations_that_cannot_work_are_refused_with_the_reason() {
        let refused = |body: &str| {
            sigma::parse_documents(&correlation(body))
                .err()
                .unwrap_or_else(|| panic!("accepted: {body}"))
        };
        let head = "  type: event_count\n  rules:\n    - r\n  timespan: 5m\n";
        assert!(refused(&format!("{head}  condition:\n    lt: 3\n")).contains("absence"));
        assert!(refused(head).contains("no condition"));
        assert!(
            refused("  type: event_count\n  rules:\n    - r\n  condition:\n    gte: 3\n")
                .contains("no timespan")
        );
        assert!(
            refused("  type: event_count\n  timespan: 5m\n  condition:\n    gte: 3\n")
                .contains("lists no rule")
        );
        assert!(
            refused("  type: sequence\n  rules:\n    - r\n  timespan: 5m\n")
                .contains("'sequence' is not supported")
        );
        assert!(
            refused("  type: event_count\n  rules:\n    - r\n  timespan: 5 minutes\n  condition:\n    gte: 3\n")
                .contains("timespan")
        );
        assert!(
            refused("  type: event_count\n  rules:\n    - r\n  timespan: 90d\n  condition:\n    gte: 3\n")
                .contains("longer than")
        );
        assert!(
            refused(
                "  type: value_count\n  rules:\n    - r\n  timespan: 5m\n  condition:\n    gte: 3\n"
            )
            .contains("condition.field")
        );
        assert!(
            refused(&format!(
                "{head}  aliases:\n    a: b\n  condition:\n    gte: 3\n"
            ))
            .contains("aliases")
        );
        assert!(
            refused("  type: temporal\n  rules:\n    - r\n  timespan: 5m\n")
                .contains("at least two rules")
        );
        assert_eq!(parse_timespan("90s").unwrap(), Duration::seconds(90));
        assert_eq!(parse_timespan("2h").unwrap(), Duration::hours(2));
    }

    #[test]
    fn a_correlation_listing_a_missing_rule_or_itself_is_left_out() {
        let count = "  type: event_count\n  group-by:\n    - src_ip\n  timespan: 5m\n  condition:\n    gte: 2\n";
        let (engine, errors) = try_engine(&[
            FAILED_LOGIN,
            &format!("title: Orphan\nname: orphan\ncorrelation:\n  rules:\n    - absent\n{count}"),
            &format!("title: Over orphan\ncorrelation:\n  rules:\n    - orphan\n{count}"),
            &format!("title: Kept\ncorrelation:\n  rules:\n    - ssh_failed\n{count}"),
        ]);
        assert_eq!(engine.correlation_count(), 1);
        assert_eq!(errors.len(), 2, "{errors:?}");
        assert!(errors.iter().any(|e| e.contains("'absent' is not loaded")));
        assert!(errors.iter().any(|e| e.contains("'orphan' is not loaded")));

        let (engine, errors) = try_engine(&[
            FAILED_LOGIN,
            &format!("title: A\nname: a\ncorrelation:\n  rules:\n    - b\n{count}"),
            &format!(
                "title: B\nname: b\ncorrelation:\n  rules:\n    - a\n    - ssh_failed\n{count}"
            ),
            &format!("title: Kept\ncorrelation:\n  rules:\n    - ssh_failed\n{count}"),
        ]);
        assert_eq!(engine.correlation_count(), 1, "{errors:?}");
        assert!(errors.iter().any(|e| e.contains("lists itself")));
    }

    #[test]
    fn the_groups_followed_are_bounded() {
        let mut engine = engine(&[
            FAILED_LOGIN,
            &correlation(
                "  type: event_count\n  rules:\n    - ssh_failed\n  group-by:\n    - src_ip\n  timespan: 1m\n  condition:\n    gte: 2\n",
            ),
        ]);
        // More addresses than groups are kept, each seen once, over a long
        // time: the old ones are forgotten and the new ones still counted.
        for n in 0..(MAX_GROUPS as i64 + 500) {
            let ip = format!("10.{}.{}.{}", n / 65_536, (n / 256) % 256, n % 256);
            failure(&mut engine, n, &ip, "root");
        }
        assert!(engine.correlations[0].groups.len() <= MAX_GROUPS);
        let late = MAX_GROUPS as i64 + 1_000;
        failure(&mut engine, late, "203.0.113.9", "root");
        assert_eq!(failure(&mut engine, late + 1, "203.0.113.9", "root"), ["C"]);
    }

    /// Every rule shipped with the agent loads, and every correlation finds
    /// the rules it lists.
    #[test]
    fn the_shipped_rules_all_load() {
        let (documents, errors) = builtin_documents();
        assert!(errors.is_empty(), "{errors:?}");
        let mut ids = HashSet::new();
        for document in &documents {
            assert!(
                ids.insert(document_id(document).to_string()),
                "duplicate id"
            );
        }

        // With every log source read, nothing is left out.
        let coverage = LogCoverage {
            services: [
                "sshd",
                "sudo",
                "su",
                "auth",
                "cron",
                "kernel",
                "syslog",
                "screensharingd",
                "security",
                "system",
                "powershell",
                "windefend",
                "containers",
            ]
            .iter()
            .map(|service| (*service).to_string())
            .collect(),
            categories: ["webserver".to_string()].into(),
        };
        let mut rules = Vec::new();
        let mut correlations = Vec::new();
        for document in documents {
            match document {
                SigmaDocument::Rule(rule) => {
                    assert!(
                        rule.service
                            .as_ref()
                            .is_some_and(|s| coverage.services.contains(s))
                            || rule
                                .category
                                .as_ref()
                                .is_some_and(|c| coverage.categories.contains(c)),
                        "'{}' is written for a log source the agent does not read",
                        rule.title
                    );
                    rules.push(rule);
                }
                SigmaDocument::Correlation(rule) => correlations.push(rule),
            }
        }
        let (rule_count, correlation_count) = (rules.len(), correlations.len());
        let (engine, errors) = LogRuleEngine::new(rules, correlations);
        assert!(errors.is_empty(), "{errors:?}");
        assert_eq!(engine.rule_count(), rule_count);
        assert_eq!(engine.correlation_count(), correlation_count);
        assert!(
            rule_count >= 35 && correlation_count >= 12,
            "{rule_count} {correlation_count}"
        );
    }

    #[test]
    fn a_rule_of_the_directory_replaces_or_disables_a_shipped_one() {
        let (documents, _) = builtin_documents();
        let shipped = documents
            .iter()
            .find_map(|document| match document {
                SigmaDocument::Rule(rule) if rule.name.as_deref() == Some("ssh_login_success") => {
                    Some(rule.id.clone())
                }
                _ => None,
            })
            .unwrap();
        let coverage = LogCoverage {
            services: ["sshd".to_string(), "sudo".to_string()].into(),
            categories: HashSet::new(),
        };
        let dir = tempfile::tempdir().unwrap();
        // The shipped rules for a log source this endpoint does not read, and
        // the correlations over them, are counted and are not errors.
        let (shipped_only, default_engine) = load(trusted(dir.path()), &coverage);
        assert!(
            shipped_only.report.errors.is_empty(),
            "{:?}",
            shipped_only.report.errors
        );
        assert!(shipped_only.report.not_applicable > 10);
        assert!(
            shipped_only
                .report
                .not_applicable_reasons
                .keys()
                .any(|reason| reason.contains("is not collected")),
            "{:?}",
            shipped_only.report.not_applicable_reasons
        );

        // The same identifier, another level: the directory's rule is used.
        std::fs::write(
            dir.path().join("login.yml"),
            format!(
                "title: Toute connexion SSH\nid: {shipped}\nname: ssh_login_success\nlevel: high\n\
                 logsource:\n  service: sshd\ndetection:\n  sel:\n    action: login_success\n  condition: sel\n"
            ),
        )
        .unwrap();
        let (loaded, mut engine) = load(trusted(dir.path()), &coverage);
        assert!(
            loaded.report.errors.is_empty(),
            "{:?}",
            loaded.report.errors
        );
        assert_eq!(engine.rule_count(), default_engine.rule_count());
        let detections = sshd_detections(&mut engine, &[("action", "login_success")]);
        assert_eq!(detections.len(), 1);
        assert_eq!(detections[0].title, "Toute connexion SSH");
        assert!(detections[0].is_incident());

        // Listed as disabled: neither version is loaded, and the correlation
        // that needs it is left out with the reason.
        std::fs::write(
            dir.path().join("disabled-rules.txt"),
            format!("# off\n{shipped}\n"),
        )
        .unwrap();
        let (loaded, mut engine) = load(trusted(dir.path()), &coverage);
        assert_eq!(engine.rule_count(), default_engine.rule_count() - 1);
        assert!(sshd_detections(&mut engine, &[("action", "login_success")]).is_empty());
        assert!(
            loaded
                .report
                .errors
                .iter()
                .any(|e| e.contains("'ssh_login_success' is not loaded")),
            "{:?}",
            loaded.report.errors
        );
    }

    /// `dir`, which only administrators may now write, as the agent's rule
    /// directory: on Windows, files written since are given back to them.
    fn trusted(dir: &Path) -> &Path {
        #[cfg(windows)]
        agent_common::windows_acl::secure_data_dir(dir).unwrap();
        dir
    }

    fn sshd_detections(engine: &mut LogRuleEngine, pairs: &[(&str, &str)]) -> Vec<Detection> {
        let services = ["sshd".to_string()];
        let fields = fields(pairs);
        engine.evaluate(&LogEvent {
            services: &services,
            categories: &[],
            fields: &fields,
            timestamp: at(0),
        })
    }

    #[test]
    fn the_incident_kind_follows_the_attack_tactic() {
        let tagged = |tag: &str| incident_type(&[tag.to_string(), "attack.t1110".to_string()]);
        assert_eq!(
            tagged("attack.credential_access"),
            IncidentType::CredentialTheft
        );
        assert_eq!(
            tagged("attack.privilege_escalation"),
            IncidentType::PrivilegeEscalation
        );
        assert_eq!(
            tagged("attack.persistence"),
            IncidentType::UnauthorizedChange
        );
        assert_eq!(
            tagged("attack.exfiltration"),
            IncidentType::DataExfiltration
        );
        assert_eq!(tagged("attack.discovery"), IncidentType::SuspiciousProcess);
    }
}
