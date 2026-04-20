// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-fim.
//!
//! Tests File Integrity Monitoring (FIM) engine,
//! baseline management, and change detection.

use agent_fim::baseline::{compute_blake3, compute_file_baseline};
use agent_fim::policy::{build_policy, validate_policy};
use agent_fim::{FimConfig, FimEngine};
use std::io::Write;
use tempfile::NamedTempFile;
use tokio::sync::mpsc;

/// FimEngine creation with default config yields a valid, running engine.
#[tokio::test]
async fn engine_creation_with_defaults() {
    let (tx, _rx) = mpsc::channel(16);
    let engine = FimEngine::with_defaults(tx);

    assert!(
        engine.is_running(),
        "engine should be running after creation"
    );
    assert_eq!(engine.baseline_count(), 0, "baseline should start empty");
}

/// FIM policy built from defaults contains watched paths and sane debounce.
#[test]
fn policy_defaults_are_valid() {
    let policy = build_policy(None, None);

    assert!(
        !policy.watched_paths.is_empty(),
        "default policy should have watched paths"
    );
    assert!(policy.recursive, "default policy should be recursive");
    assert!(policy.debounce_ms >= 100, "debounce should be >= 100ms");
}

/// validate_policy reports warnings for non-existent paths.
#[test]
fn policy_validation_reports_missing_paths() {
    let policy = FimConfig {
        watched_paths: vec![std::path::PathBuf::from("/non/existent/path/abc123")],
        ignore_patterns: vec![],
        recursive: true,
        debounce_ms: 500,
    };

    let warnings = validate_policy(&policy);
    assert!(!warnings.is_empty(), "should warn about non-existent path");
    assert!(
        warnings[0].contains("does not exist"),
        "warning should mention path does not exist"
    );
}

/// Baseline count starts at zero for a freshly created engine.
#[tokio::test]
async fn baseline_count_starts_at_zero() {
    let (tx, _rx) = mpsc::channel(16);
    let engine = FimEngine::new(
        FimConfig {
            watched_paths: vec![],
            ignore_patterns: vec![],
            recursive: false,
            debounce_ms: 500,
        },
        tx,
    );

    assert_eq!(engine.baseline_count(), 0);
}

/// Hash computation is deterministic: hashing the same file twice yields identical results.
#[test]
fn hash_computation_is_deterministic() {
    let mut tmp = NamedTempFile::new().expect("failed to create temp file");
    write!(tmp, "sentinel-fim test payload").expect("failed to write");
    tmp.flush().expect("failed to flush");

    let hash1 = compute_blake3(tmp.path()).expect("first hash failed");
    let hash2 = compute_blake3(tmp.path()).expect("second hash failed");

    assert_eq!(hash1, hash2, "BLAKE3 hash must be deterministic");
    assert!(!hash1.is_empty(), "hash should not be empty");

    // Verify compute_file_baseline also produces consistent hash
    let baseline = compute_file_baseline(tmp.path()).expect("baseline failed");
    assert_eq!(baseline.hash, hash1, "baseline hash must match raw BLAKE3");
    assert_eq!(baseline.path, tmp.path());
}

/// FimEngine start/stop lifecycle toggles the running flag correctly.
#[tokio::test]
async fn engine_start_stop_lifecycle() {
    let dir = tempfile::tempdir().expect("failed to create temp dir");
    // Write a file so the baseline has something to scan
    std::fs::write(dir.path().join("test.txt"), "hello").expect("write failed");

    let (tx, _rx) = mpsc::channel(16);
    let engine = FimEngine::new(
        FimConfig {
            watched_paths: vec![dir.path().to_path_buf()],
            ignore_patterns: vec![],
            recursive: true,
            debounce_ms: 500,
        },
        tx,
    );

    assert!(engine.is_running(), "engine should be running before start");

    engine.start().await.expect("start failed");
    assert!(engine.is_running(), "engine should be running after start");
    assert!(
        engine.baseline_count() > 0,
        "baseline should contain the test file"
    );

    engine.stop();
    assert!(
        !engine.is_running(),
        "engine should not be running after stop"
    );
}

/// Config update restarts the watcher with the new policy.
#[tokio::test]
async fn config_update_applies_new_policy() {
    let dir = tempfile::tempdir().expect("failed to create temp dir");
    std::fs::write(dir.path().join("a.txt"), "aaa").expect("write failed");

    let (tx, _rx) = mpsc::channel(16);
    let engine = FimEngine::new(
        FimConfig {
            watched_paths: vec![],
            ignore_patterns: vec![],
            recursive: false,
            debounce_ms: 500,
        },
        tx,
    );

    // Initially no baseline entries because no watched paths
    assert_eq!(engine.baseline_count(), 0);

    // Update config to watch the temp directory
    let new_policy = FimConfig {
        watched_paths: vec![dir.path().to_path_buf()],
        ignore_patterns: vec![],
        recursive: true,
        debounce_ms: 500,
    };

    engine
        .update_config(new_policy)
        .await
        .expect("update_config failed");
    assert!(
        engine.is_running(),
        "engine should be running after config update"
    );
    assert!(
        engine.baseline_count() > 0,
        "baseline should reflect new watched path"
    );
}
