//! Offline contract probe. Used by scripts/test-platform-edr.sh; never contacts a live host.
use agent_core::{sync_converters, threat_pipeline};
use agent_gui::dto::{DetectionRule, Playbook};
use agent_storage::repositories::grc::{StoredDetectionRule, StoredPlaybook};
use agent_sync::{DetectionRulePayload, PlaybookPayload};
use base64::Engine;
use serde_json::{Value, json};

fn main() {
    let args: Vec<_> = std::env::args().collect();
    assert_eq!(args.len(), 3, "edr_contract export|verify <json-file>");
    if args[1] == "export" {
        let rule: DetectionRule = serde_json::from_value(json!({
            "id": "consoleRuleNonUuid123", "name": "Encoded command", "description": "Contract fixture",
            "severity": "high", "enabled": true,
            "conditions": [{"condition_type": "command_line_contains", "value": "-enc"}],
            "actions": ["create_notification"], "created_at": "2026-09-27T12:00:00Z",
            "last_match": null, "match_count": 7
        })).unwrap();
        let playbook: Playbook = serde_json::from_value(json!({
            "id": "consolePlaybookNonUuid", "name": "Notify analyst", "description": "Contract fixture",
            "enabled": true, "conditions": [{"condition_type": "process_name_match", "operator": "any", "value": "powershell"}],
            "actions": [{"action_type": "create_notification", "parameters": "Investigate"}],
            "created_at": "2026-09-27T12:00:00Z", "last_triggered": null, "trigger_count": 0, "is_template": false
        })).unwrap();
        let result = agent_sync::types::CommandResultRequest {
            status: agent_sync::types::CommandStatus::Success,
            output: Some("contract completed".into()),
            error: None,
            completed_at: chrono::Utc::now(),
        };
        let secret = base64::engine::general_purpose::STANDARD.encode([7u8; 32]);
        let request = agent_sync::request_auth::sign_request(
            reqwest::Client::new().post("https://example.invalid/agentApi/v1/agents/test/heartbeat")
                .json(&json!({"cpu_percent": 1.0, "unicode": "é", "numeric": {"10": 1e-7, "2": 1e20}})),
            &agent_sync::request_auth::SigningSecret::new(secret.clone()),
        ).unwrap().build().unwrap();
        let signed = json!({
            "secret": secret, "method": request.method().as_str(), "path": "/v1/agents/test/heartbeat",
            "body": std::str::from_utf8(request.body().unwrap().as_bytes().unwrap()).unwrap(),
            "timestamp": request.headers()["x-request-timestamp"].to_str().unwrap(),
            "nonce": request.headers()["x-request-nonce"].to_str().unwrap(),
            "signature": request.headers()["x-agent-signature"].to_str().unwrap(),
        });
        let fixtures = json!({"rules": [sync_converters::detection_rule_to_payload(&rule)],
            "playbooks": [sync_converters::playbook_to_payload(&playbook)], "command_result": result, "signed_request": signed});
        std::fs::write(&args[2], serde_json::to_vec_pretty(&fixtures).unwrap()).unwrap();
    } else {
        assert_eq!(args[1], "verify");
        let response: Value = serde_json::from_slice(&std::fs::read(&args[2]).unwrap()).unwrap();
        let rules: Vec<DetectionRulePayload> =
            serde_json::from_value(response["rules"].clone()).unwrap();
        let playbooks: Vec<PlaybookPayload> =
            serde_json::from_value(response["playbooks"].clone()).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(playbooks.len(), 1);
        let r = &rules[0];
        let stored = StoredDetectionRule {
            id: r.id.clone(),
            name: r.name.clone(),
            description: r.description.clone(),
            severity: r.severity.clone(),
            conditions: serde_json::to_string(&r.conditions).unwrap(),
            actions: serde_json::to_string(&r.actions).unwrap(),
            enabled: r.enabled,
            created_at: r.created_at.to_rfc3339(),
            last_match: r.last_match.map(|dt| dt.to_rfc3339()),
            match_count: r.match_count as i32,
            synced: true,
        };
        let gui = threat_pipeline::stored_rules_to_dto(&[stored]);
        assert_eq!(gui.len(), 1, "Console non-UUID IDs must not disappear");
        let roundtrip = sync_converters::detection_rule_to_payload(&gui[0]);
        assert_eq!(
            serde_json::to_value(roundtrip).unwrap(),
            serde_json::to_value(r).unwrap()
        );
        assert!(!gui[0].enabled, "Console toggle must reach the agent");
        let p = &playbooks[0];
        let stored = StoredPlaybook {
            id: p.id.clone(),
            name: p.name.clone(),
            description: p.description.clone(),
            trigger_type: "general".into(),
            severity: "medium".into(),
            steps: serde_json::to_string(&p.actions).unwrap(),
            enabled: p.enabled,
            conditions: serde_json::to_string(&p.conditions).unwrap(),
            created_at: p.created_at.to_rfc3339(),
            updated_at: p.created_at.to_rfc3339(),
            synced: true,
        };
        let gui = threat_pipeline::stored_playbooks_to_dto(&[stored]);
        assert_eq!(gui.len(), 1);
        assert_eq!(
            serde_json::to_value(sync_converters::playbook_to_payload(&gui[0])).unwrap(),
            serde_json::to_value(p).unwrap()
        );
        for value in response["commands"].as_array().unwrap() {
            let command: agent_core::api_client::AgentCommand =
                serde_json::from_value(value.clone()).unwrap();
            assert!(
                command.is_valid(),
                "unsupported platform command: {}",
                command.command_type
            );
            assert!(command.is_within_bounds());
        }
        println!("Platform → Rust payloads → stored records → GUI → Rust payloads: OK");
    }
}
