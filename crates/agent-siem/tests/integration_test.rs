// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Integration tests for agent-siem.
//!
//! Tests SIEM event construction, formatting (CEF, LEEF, JSON),
//! syslog message formatting, and forwarder configuration.

use agent_siem::{
    CefFormatter, EventCategory, JsonFormatter, LeefFormatter, SiemConfig, SiemEvent, SiemFormat,
    SiemFormatter, SiemForwarder, SiemTransport, SiemTransportTrait, SyslogProtocol,
    SyslogTransport,
};
use chrono::Utc;

/// Helper: build a representative SiemEvent with all fields populated.
fn sample_event() -> SiemEvent {
    SiemEvent {
        timestamp: Utc::now(),
        severity: 7,
        category: EventCategory::Security,
        name: "Malware Detected".to_string(),
        description: "Suspicious process detected on endpoint".to_string(),
        source_host: "workstation-01".to_string(),
        source_ip: Some("192.168.1.100".to_string()),
        destination_ip: Some("10.0.0.5".to_string()),
        destination_port: Some(443),
        user: Some("john.doe".to_string()),
        process_name: Some("suspicious.exe".to_string()),
        process_id: Some(1234),
        file_path: Some("C:\\Users\\john\\suspicious.exe".to_string()),
        custom_fields: serde_json::json!({"check_id": "av-scan", "risk": "high"}),
        event_id: "evt-int-001".to_string(),
        agent_version: "2.0.0-test".to_string(),
    }
}

// ── 1. SiemConfig default values ──────────────────────────────────────────

#[test]
fn config_default_values() {
    let config = SiemConfig::default();

    assert!(!config.enabled, "SIEM should be disabled by default");
    assert_eq!(config.format, SiemFormat::Json);
    assert_eq!(config.batch_size, 100);
    assert_eq!(config.flush_interval_secs, 30);
    assert_eq!(config.min_severity, 0);
    assert!(config.include_categories.is_empty());

    // Transport should default to Syslog localhost:514 TCP without TLS
    match &config.transport {
        SiemTransport::Syslog {
            host,
            port,
            protocol,
            tls,
        } => {
            assert_eq!(host, "localhost");
            assert_eq!(*port, 514);
            assert_eq!(*protocol, SyslogProtocol::Tcp);
            assert!(!tls);
        }
        other => panic!("Expected Syslog transport, got: {:?}", other),
    }
}

// ── 2. SiemEvent construction with all fields ─────────────────────────────

#[test]
fn event_construction_all_fields() {
    let event = sample_event();

    assert_eq!(event.severity, 7);
    assert_eq!(event.category, EventCategory::Security);
    assert_eq!(event.name, "Malware Detected");
    assert_eq!(event.source_host, "workstation-01");
    assert_eq!(event.source_ip.as_deref(), Some("192.168.1.100"));
    assert_eq!(event.destination_ip.as_deref(), Some("10.0.0.5"));
    assert_eq!(event.destination_port, Some(443));
    assert_eq!(event.user.as_deref(), Some("john.doe"));
    assert_eq!(event.process_name.as_deref(), Some("suspicious.exe"));
    assert_eq!(event.process_id, Some(1234));
    assert!(event.file_path.is_some());
    assert_eq!(event.event_id, "evt-int-001");
    assert_eq!(event.agent_version, "2.0.0-test");

    // Clone should work (derives Clone)
    let cloned = event.clone();
    assert_eq!(cloned.name, event.name);
}

// ── 3. CEF formatting output structure ────────────────────────────────────

#[test]
fn cef_format_structure() {
    let formatter = CefFormatter::new();
    let event = sample_event();
    let output = formatter.format(&event).expect("CEF formatting failed");

    assert!(
        output.starts_with("CEF:"),
        "CEF output must start with 'CEF:' — got: {}",
        &output[..output.len().min(40)]
    );
    // CEF header has pipe-separated fields: version|vendor|product|version|id|name|severity
    let pipes: Vec<&str> = output.splitn(8, '|').collect();
    assert!(
        pipes.len() >= 7,
        "CEF header should contain at least 7 pipe-delimited fields, got {}",
        pipes.len()
    );
    // The event name should appear in the header
    assert!(
        output.contains("Malware Detected"),
        "CEF output should contain the event name"
    );
}

// ── 4. JSON formatting produces valid JSON ────────────────────────────────

#[test]
fn json_format_valid() {
    let formatter = JsonFormatter::new();
    let event = sample_event();
    let output = formatter.format(&event).expect("JSON formatting failed");

    let parsed: serde_json::Value =
        serde_json::from_str(&output).expect("JSON output is not valid JSON");

    assert!(parsed.is_object(), "JSON output should be an object");
    // Verify key fields are present
    let obj = parsed.as_object().unwrap();
    assert!(
        obj.contains_key("name") || obj.contains_key("event_name") || obj.contains_key("msg"),
        "JSON should contain an event name field"
    );
}

// ── 5. LEEF formatting output structure ───────────────────────────────────

#[test]
fn leef_format_structure() {
    let formatter = LeefFormatter::new();
    let event = sample_event();
    let output = formatter.format(&event).expect("LEEF formatting failed");

    assert!(
        output.starts_with("LEEF:"),
        "LEEF output must start with 'LEEF:' — got: {}",
        &output[..output.len().min(40)]
    );
    // LEEF uses pipe-delimited header and tab or key=value pairs
    assert!(
        output.contains('|'),
        "LEEF header should contain pipe separators"
    );
}

// ── 6. SyslogTransport creation ───────────────────────────────────────────

#[tokio::test]
async fn syslog_transport_creation() {
    let transport = SyslogTransport::new(
        "siem.example.com".to_string(),
        1514,
        SyslogProtocol::Tcp,
        false,
    );

    // A freshly created transport should not be connected yet
    assert!(
        !transport.is_connected().await,
        "New syslog transport should not be connected before first send"
    );
}

// ── 7. SiemForwarder creation with valid config ───────────────────────────

#[test]
fn forwarder_creation_valid_config() {
    let config = SiemConfig {
        enabled: true,
        format: SiemFormat::Cef,
        transport: SiemTransport::Syslog {
            host: "siem.company.com".to_string(),
            port: 1514,
            protocol: SyslogProtocol::Tcp,
            tls: false,
        },
        ..SiemConfig::default()
    };

    let forwarder = SiemForwarder::new(config).expect("Forwarder creation should succeed");
    assert!(forwarder.is_enabled());
    assert_eq!(forwarder.config().format, SiemFormat::Cef);
}

// ── 8. EventCategory serde roundtrip ──────────────────────────────────────

#[test]
fn event_category_serde_roundtrip() {
    let categories = [
        EventCategory::Compliance,
        EventCategory::Security,
        EventCategory::Network,
        EventCategory::FileIntegrity,
        EventCategory::System,
        EventCategory::Authentication,
        EventCategory::Configuration,
        EventCategory::Vulnerability,
    ];

    for cat in &categories {
        let serialized = serde_json::to_string(cat)
            .unwrap_or_else(|e| panic!("Failed to serialize {:?}: {}", cat, e));
        let deserialized: EventCategory = serde_json::from_str(&serialized)
            .unwrap_or_else(|e| panic!("Failed to deserialize {}: {}", serialized, e));
        assert_eq!(
            *cat, deserialized,
            "Roundtrip failed for {:?} (serialized as {})",
            cat, serialized
        );
    }
}
