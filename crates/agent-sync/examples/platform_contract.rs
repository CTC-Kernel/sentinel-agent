//! Synthetic, offline cross-language contracts. Never contacts a running platform.
use agent_sync::types::*;
use chrono::{DateTime, Utc};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
fn typed<T: DeserializeOwned + Serialize>(v: Value) -> Value {
    serde_json::to_value(serde_json::from_value::<T>(v).unwrap()).unwrap()
}
fn main() {
    let ts = "2026-09-27T12:00:00Z";
    let now: DateTime<Utc> = ts.parse().unwrap();
    let mut cases = serde_json::Map::new();
    cases.insert(
        "AssetsPayloadSchema".into(),
        json!({"assets":[typed::<AssetPayload>(json!({
            "id":"asset-contract", "ip":"192.0.2.1", "device_type":"server", "criticality":"high",
            "lifecycle":"monitored", "risk_score":42.5,"vulnerability_count":2,"open_ports":[443],
            "tags":["contract"],"software":["OpenSSH","Firefox"],"first_seen":ts,"last_seen":ts
        }))]}),
    );
    cases.insert("RisksPayloadSchema".into(), json!({"risks":[typed::<RiskPayload>(json!({
        "id":"risk-contract","title":"Contract","description":"Synthetic","probability":3,"impact":4,
        "owner":"owner","status":"open","mitigation":"patch","source":"agent","created_at":ts,"updated_at":ts
    }))]}));
    cases.insert("AlertRulesPayloadSchema".into(), json!({"rules":[typed::<AlertRulePayload>(json!({
        "id":"alert-contract","name":"Contract","rule_type":"SeverityThreshold","severity_threshold":"high",
        "enabled":false,"created_at":ts
    }))]}));
    cases.insert("WebhooksPayloadSchema".into(), json!({"webhooks":[typed::<WebhookPayload>(json!({
        "id":"webhook-contract","name":"Contract","url":"https://example.test/hook","format":"generic","enabled":false
    }))]}));
    cases.insert("KpiSnapshotsPayloadSchema".into(), json!({"snapshots":[typed::<KpiSnapshotPayload>(json!({
        "timestamp":ts,"compliance_score":83.5,"incident_count":2,"open_vulns":3,"closed_vulns":4,"remediation_sla_pct":95.0
    }))]}));
    cases.insert(
        "SoftwareInventoryPayloadSchema".into(),
        json!({"software":[typed::<SoftwarePayload>(json!({
            "name":"Firefox","version":"1.0","vendor":"Synthetic"
        }))]}),
    );
    cases.insert("AuditTrailEntrySchema".into(), typed::<AuditTrailEntry>(json!({
        "action":"config_changed","actor":"contract","details":null,"timestamp":ts,"metadata":{"test":true}
    })));
    cases.insert(
        "FimAlertsPayloadSchema".into(),
        json!(FimAlertSyncRequest {
            alerts: vec![FimAlertPayload {
                path: "/synthetic/config".into(),
                change_type: "modified".into(),
                severity: "medium".into(),
                baseline_hash: Some("a".repeat(64)),
                actual_hash: Some("b".repeat(64)),
                timestamp: now,
                metadata: Some(json!({"test":true}))
            }]
        }),
    );
    cases.insert(
        "UsbEventsPayloadSchema".into(),
        json!(UsbEventSyncRequest {
            events: vec![UsbEventPayload {
                device_name: "Synthetic USB".into(),
                device_type: "mass_storage".into(),
                event_type: "connected".into(),
                vendor_id: "1234".into(),
                product_id: "abcd".into(),
                serial_number: None,
                action: "allowed".into(),
                timestamp: now,
                metadata: Some(json!({"policy_violation":true,"enforcement":"monitor_only"}))
            }]
        }),
    );
    cases.insert(
        "NetworkSnapshotPayloadSchema".into(),
        json!(NetworkSnapshotRequest {
            interfaces: vec![NetworkInterfacePayload {
                name: "contract0".into(),
                mac_address: Some("02:00:00:00:00:01".into()),
                ipv4_addresses: vec!["192.0.2.1".into()],
                ipv6_addresses: vec![],
                status: Some("up".into()),
                interface_type: Some("ethernet".into())
            }],
            timestamp: Some(now),
            primary_ip: Some("192.0.2.1".into()),
            primary_mac: None,
            hash: None
        }),
    );
    cases.insert(
        "DiscoveredAssetPayloadSchema".into(),
        json!(DiscoveredAssetPayload {
            ip: "192.0.2.2".into(),
            hostname: Some("contract-host".into()),
            mac_address: None,
            vendor: None,
            device_type: Some("server".into()),
            open_ports: vec![443],
            is_gateway: Some(false),
            subnet: Some("192.0.2.0/24".into()),
            first_seen: Some(now),
            last_seen: Some(now),
            source: Some("agent".into())
        }),
    );
    cases.insert(
        "SiemSyncPayloadSchema".into(),
        json!(SiemSyncRequest {
            events: vec![SiemEventPayload {
                timestamp: now,
                severity: 7,
                category: "security".into(),
                name: "Contract".into(),
                description: "Synthetic".into(),
                source_host: "contract".into(),
                source_ip: Some("192.0.2.1".into()),
                destination_ip: None,
                event_id: "siem-contract".into()
            }],
            stats: SiemStatsPayload {
                enabled: true,
                format: "CEF".into(),
                transport: "TLS".into(),
                destination: "example.test:6514".into(),
                events_sent: 1,
                events_dropped: 0,
                bytes_sent: 100,
                is_connected: true,
                last_error: None,
                reported_at: now
            }
        }),
    );
    cases.insert(
        "ResultItemSchema".into(),
        json!(agent_sync::result_upload::CheckResultPayload {
            result_id: "contract-result-001".into(),
            check_id: "contract-check".into(),
            status: "pass".into(),
            score: Some(100),
            proof_hash: Some("a".repeat(64)),
            executed_at: now,
            duration_ms: Some(20),
            raw_data: Some(json!({"test":true})),
            category: Some("system".into()),
            severity: Some("high".into()),
            framework: Some("ISO27001".into()),
            control_id: Some("A.8.8".into())
        }),
    );
    let args: Vec<String> = std::env::args().collect();
    if args[1] == "export" {
        std::fs::write(&args[2], serde_json::to_vec_pretty(&cases).unwrap()).unwrap();
        println!("Exported {} typed contract families", cases.len());
    } else if args[1] == "verify" {
        let data: Value = serde_json::from_slice(&std::fs::read(&args[2]).unwrap()).unwrap();
        let assets: Vec<AssetPayload> = serde_json::from_value(data["assets"].clone()).unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].software, vec!["OpenSSH", "Firefox"]);
        assert_eq!(assets[0].risk_score, 61.0);
        assert_eq!(assets[0].lifecycle, "decommissioned");
        let risks: Vec<RiskPayload> = serde_json::from_value(data["risks"].clone()).unwrap();
        assert_eq!(risks[0].impact, 5);
        assert_eq!(risks[0].sla_target_days, Some(0));
        assert!(risks[0].updated_at.is_some());
        let alerts: Vec<AlertRulePayload> = serde_json::from_value(data["alerts"].clone()).unwrap();
        assert!(alerts[0].enabled);
        assert_eq!(alerts[0].severity_threshold.as_deref(), Some("info"));
        assert_eq!(alerts[0].escalation_minutes, Some(0));
        let webhooks: Vec<WebhookPayload> =
            serde_json::from_value(data["webhooks"].clone()).unwrap();
        assert!(webhooks[0].enabled);
        assert_eq!(webhooks[0].format, "slack");
        println!(
            "Platform edits to assets, risks, alerts and webhooks successfully decoded by Rust"
        );
    } else {
        panic!("usage: platform_contract export|verify FILE");
    }
}
