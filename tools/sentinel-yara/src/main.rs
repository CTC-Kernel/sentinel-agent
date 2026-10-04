// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! YARA scanning helper of the Sentinel GRC agent.
//!
//! ```text
//! sentinel-yara <rules directory>
//! ```
//!
//! Protocol (JSON Lines on standard output):
//!
//! 1. At start, every `*.yar` / `*.yara` file under the rules directory is
//!    compiled (each file in its own namespace) and one line reports the
//!    outcome: `{"ready":true,"rules":12,"errors":["file: message"]}`.
//!    A file that does not compile is left out; the others are kept.
//! 2. Then each line read on standard input is a file path to scan, answered
//!    by one line:
//!    `{"path":"…","matches":[{"rule":"…","namespace":"…","tags":[…],"meta":{…}}]}`
//!    or `{"path":"…","matches":[],"error":"…"}`.
//! 3. The program ends when standard input is closed.
//!
//! Nothing is written anywhere and no network is used.

use serde_json::{Value, json};
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Time allowed to scan one file.
const SCAN_TIMEOUT: Duration = Duration::from_secs(30);
/// Largest file scanned.
const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
/// Largest rule file compiled.
const MAX_RULE_FILE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_RULE_FILES: usize = 10_000;
const MAX_DEPTH: usize = 8;

/// Rule files under `dir`, sorted.
fn rule_files(dir: &Path, depth: usize, files: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if files.len() >= MAX_RULE_FILES {
            return;
        }
        let path = entry.path();
        // Symbolic links are not followed: the directory holds rules, not
        // pointers to other places.
        let Ok(metadata) = std::fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.is_dir() {
            if depth < MAX_DEPTH {
                rule_files(&path, depth + 1, files);
            }
        } else if metadata.is_file()
            && path
                .extension()
                .is_some_and(|ext| ext == "yar" || ext == "yara")
        {
            files.push(path);
        }
    }
}

/// Compile the rules of `dir`. Returns the rules and one message per file
/// left out.
fn compile_rules(dir: &Path) -> (yara_x::Rules, Vec<String>) {
    let mut files = Vec::new();
    rule_files(dir, 0, &mut files);
    files.sort();

    let mut compiler = yara_x::Compiler::new();
    let mut errors = Vec::new();
    for file in &files {
        let label = file
            .strip_prefix(dir)
            .unwrap_or(file)
            .to_string_lossy()
            .to_string();
        if std::fs::metadata(file).is_ok_and(|m| m.len() > MAX_RULE_FILE_BYTES) {
            errors.push(format!("{label}: file is too large"));
            continue;
        }
        let source = match std::fs::read_to_string(file) {
            Ok(source) => source,
            Err(e) => {
                errors.push(format!("{label}: {e}"));
                continue;
            }
        };
        // One namespace per file: two files may define a rule of the same name.
        compiler.new_namespace(&label);
        let source = yara_x::SourceCode::from(source.as_str()).with_origin(&label);
        if let Err(e) = compiler.add_source(source) {
            let first_line = e.to_string().lines().next().unwrap_or("").to_string();
            errors.push(format!("{label}: {first_line}"));
        }
    }
    (compiler.build(), errors)
}

fn meta_value(value: yara_x::MetaValue<'_>) -> Value {
    match value {
        yara_x::MetaValue::Integer(number) => json!(number),
        yara_x::MetaValue::Float(number) => json!(number),
        yara_x::MetaValue::Bool(flag) => json!(flag),
        yara_x::MetaValue::String(text) => json!(text),
        yara_x::MetaValue::Bytes(bytes) => json!(String::from_utf8_lossy(bytes)),
    }
}

/// Scan one file and describe the outcome.
fn scan(scanner: &mut yara_x::Scanner<'_>, path: &str) -> Value {
    let failure = |error: String| json!({ "path": path, "matches": [], "error": error });
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(e) => return failure(e.to_string()),
    };
    if !metadata.is_file() {
        return failure("not a regular file".to_string());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return failure("file is too large to scan".to_string());
    }
    match scanner.scan_file(path) {
        Ok(results) => {
            let matches: Vec<Value> = results
                .matching_rules()
                .map(|rule| {
                    let meta: serde_json::Map<String, Value> = rule
                        .metadata()
                        .map(|(key, value)| (key.to_string(), meta_value(value)))
                        .collect();
                    json!({
                        "rule": rule.identifier(),
                        "namespace": rule.namespace(),
                        "tags": rule.tags().map(|tag| tag.identifier().to_string()).collect::<Vec<_>>(),
                        "meta": meta,
                    })
                })
                .collect();
            json!({ "path": path, "matches": matches })
        }
        Err(e) => failure(e.to_string()),
    }
}

fn main() -> std::process::ExitCode {
    let Some(rules_dir) = std::env::args_os().nth(1).map(PathBuf::from) else {
        eprintln!("usage: sentinel-yara <rules directory>");
        return std::process::ExitCode::from(2);
    };
    let (rules, errors) = compile_rules(&rules_dir);
    let rule_count = rules.iter().count();

    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    let mut emit =
        |value: &Value| -> bool { writeln!(out, "{value}").is_ok() && out.flush().is_ok() };
    if !emit(&json!({ "ready": true, "rules": rule_count, "errors": errors })) {
        return std::process::ExitCode::FAILURE;
    }

    let mut scanner = yara_x::Scanner::new(&rules);
    scanner.set_timeout(SCAN_TIMEOUT);
    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else {
            break;
        };
        let path = line.trim_end_matches(['\r', '\n']);
        if path.is_empty() {
            continue;
        }
        if !emit(&scan(&mut scanner, path)) {
            // The agent is gone.
            break;
        }
    }
    std::process::ExitCode::SUCCESS
}
