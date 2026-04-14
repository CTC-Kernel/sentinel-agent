// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-common.
//!
//! Tests configuration parsing, constants, process utilities,
//! and type constructors.

use agent_common::config::AgentConfig;
use agent_common::config::SecureConfig;
use agent_common::constants::{
    AGENT_NAME, AGENT_VERSION, DEFAULT_CHECK_INTERVAL_SECS, DEFAULT_HEARTBEAT_INTERVAL_SECS,
    DEFAULT_OFFLINE_MODE_DAYS,
};
use agent_common::process::ps_json_as_bool;
use agent_common::types::{CheckResult, CheckStatus, Severity};

// ---------------------------------------------------------------------------
// 1. AgentConfig defaults match constants
// ---------------------------------------------------------------------------

#[test]
fn config_defaults_match_constants() {
    let config = AgentConfig::default();

    assert_eq!(config.check_interval_secs, DEFAULT_CHECK_INTERVAL_SECS);
    assert_eq!(
        config.heartbeat_interval_secs,
        DEFAULT_HEARTBEAT_INTERVAL_SECS
    );
    assert_eq!(config.offline_mode_days, DEFAULT_OFFLINE_MODE_DAYS);
    assert_eq!(config.log_level, "info");
    assert!(config.tls_verify);
    assert!(config.agent_id.is_none());
    assert!(config.enrollment_token.is_none());
    assert!(config.active_frameworks.is_none());
}

// ---------------------------------------------------------------------------
// 2. AgentConfig serde roundtrip
// ---------------------------------------------------------------------------

#[test]
fn config_serde_roundtrip() {
    let original = AgentConfig {
        server_url: "https://example.com/api".to_string(),
        check_interval_secs: 900,
        heartbeat_interval_secs: 30,
        offline_mode_days: 14,
        log_level: "debug".to_string(),
        ..AgentConfig::default()
    };

    let json = serde_json::to_string(&original).expect("serialize");
    let restored: AgentConfig = serde_json::from_str(&json).expect("deserialize");

    assert_eq!(original.server_url, restored.server_url);
    assert_eq!(original.check_interval_secs, restored.check_interval_secs);
    assert_eq!(
        original.heartbeat_interval_secs,
        restored.heartbeat_interval_secs
    );
    assert_eq!(original.offline_mode_days, restored.offline_mode_days);
    assert_eq!(original.log_level, restored.log_level);
}

// ---------------------------------------------------------------------------
// 3. CheckStatus enum variants
// ---------------------------------------------------------------------------

#[test]
fn check_status_variants_serialize_correctly() {
    let cases: Vec<(CheckStatus, &str)> = vec![
        (CheckStatus::Pass, "\"pass\""),
        (CheckStatus::Fail, "\"fail\""),
        (CheckStatus::Error, "\"error\""),
        (CheckStatus::Skipped, "\"skipped\""),
        (CheckStatus::Pending, "\"pending\""),
    ];

    for (status, expected_json) in cases {
        let json = serde_json::to_string(&status).expect("serialize");
        assert_eq!(
            json, expected_json,
            "serialization mismatch for {:?}",
            status
        );

        let parsed: CheckStatus = serde_json::from_str(expected_json).expect("deserialize");
        assert_eq!(
            parsed, status,
            "deserialization mismatch for {}",
            expected_json
        );
    }
}

// ---------------------------------------------------------------------------
// 4. CheckResult construction and field access
// ---------------------------------------------------------------------------

#[test]
fn check_result_constructors() {
    let pass = CheckResult::pass("encryption_check");
    assert_eq!(pass.status, CheckStatus::Pass);
    assert_eq!(pass.check_id, "encryption_check");
    assert!(pass.message.is_none());
    assert!(!pass.synced);

    let fail = CheckResult::fail("firewall_check", "Firewall disabled");
    assert_eq!(fail.status, CheckStatus::Fail);
    assert_eq!(fail.check_id, "firewall_check");
    assert_eq!(fail.message.as_deref(), Some("Firewall disabled"));

    let err = CheckResult::error("update_check", "Timeout");
    assert_eq!(err.status, CheckStatus::Error);
    assert_eq!(err.message.as_deref(), Some("Timeout"));
}

#[test]
fn check_result_builder_methods() {
    let result = CheckResult::pass("test_check")
        .with_duration(250)
        .with_details(serde_json::json!({"note": "ok"}));

    assert_eq!(result.duration_ms, 250);
    assert_eq!(result.details["note"], "ok");
}

// ---------------------------------------------------------------------------
// 5. Constants validity
// ---------------------------------------------------------------------------

#[test]
fn constants_are_valid() {
    assert!(!AGENT_VERSION.is_empty(), "AGENT_VERSION must not be empty");
    assert!(!AGENT_NAME.is_empty(), "AGENT_NAME must not be empty");
    const { assert!(DEFAULT_HEARTBEAT_INTERVAL_SECS > 0) };
    const { assert!(DEFAULT_CHECK_INTERVAL_SECS > 0) };
    const { assert!(DEFAULT_OFFLINE_MODE_DAYS > 0) };
}

// ---------------------------------------------------------------------------
// 6. ps_json_as_bool — cross-platform PowerShell JSON boolean parser
// ---------------------------------------------------------------------------

#[test]
fn ps_json_as_bool_handles_all_forms() {
    // Native JSON booleans
    assert_eq!(ps_json_as_bool(&serde_json::json!(true)), Some(true));
    assert_eq!(ps_json_as_bool(&serde_json::json!(false)), Some(false));

    // PowerShell-style string booleans
    assert_eq!(ps_json_as_bool(&serde_json::json!("True")), Some(true));
    assert_eq!(ps_json_as_bool(&serde_json::json!("False")), Some(false));
    assert_eq!(ps_json_as_bool(&serde_json::json!("true")), Some(true));
    assert_eq!(ps_json_as_bool(&serde_json::json!("false")), Some(false));

    // Numeric 0/1
    assert_eq!(ps_json_as_bool(&serde_json::json!(1)), Some(true));
    assert_eq!(ps_json_as_bool(&serde_json::json!(0)), Some(false));

    // Non-zero integers are truthy
    assert_eq!(ps_json_as_bool(&serde_json::json!(42)), Some(true));

    // Unrecognised inputs return None
    assert_eq!(ps_json_as_bool(&serde_json::json!("maybe")), None);
    assert_eq!(ps_json_as_bool(&serde_json::json!(null)), None);
    assert_eq!(ps_json_as_bool(&serde_json::json!([])), None);
}

// ---------------------------------------------------------------------------
// 7. SecureConfig wraps AgentConfig correctly
// ---------------------------------------------------------------------------

#[test]
fn secure_config_wraps_and_derefs() {
    let config = AgentConfig {
        server_url: "https://secure.example.com".to_string(),
        admin_password: Some("s3cret".to_string()),
        ..AgentConfig::default()
    };

    let secure = SecureConfig::from(config);

    // Deref gives access to inner AgentConfig fields
    assert_eq!(secure.server_url, "https://secure.example.com");
    assert_eq!(secure.admin_password.as_deref(), Some("s3cret"));
    assert_eq!(secure.check_interval_secs, DEFAULT_CHECK_INTERVAL_SECS);
}

// ---------------------------------------------------------------------------
// 8. Severity enum basic coverage
// ---------------------------------------------------------------------------

#[test]
fn severity_variants_and_helpers() {
    // All four variants exist and serialise to snake_case
    let cases: Vec<(Severity, &str)> = vec![
        (Severity::Info, "\"info\""),
        (Severity::Warning, "\"warning\""),
        (Severity::Error, "\"error\""),
        (Severity::Critical, "\"critical\""),
    ];

    for (severity, expected) in &cases {
        let json = serde_json::to_string(severity).expect("serialize");
        assert_eq!(&json, expected);
    }

    // as_str / parse_str roundtrip
    for (severity, _) in &cases {
        let s = severity.as_str();
        let parsed = Severity::parse_str(s);
        assert_eq!(
            parsed,
            Some(*severity),
            "roundtrip failed for {:?}",
            severity
        );
    }
}
