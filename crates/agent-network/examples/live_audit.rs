//! Read-only live smoke test. No discovery, upload, firewall or remediation action.
use agent_network::NetworkManager;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut manager = NetworkManager::new();
    for sample in 0..4 {
        let connections = manager.collect_connections().await?;
        manager.record_connections_for_beaconing(&connections);
        let alerts = manager.detect_threats(&connections).await?;
        println!(
            "{}",
            serde_json::json!({"sample":sample,"connections":connections.len(),"alerts":alerts.iter().map(|a| serde_json::json!({"type":format!("{:?}",a.alert_type),"severity":format!("{:?}",a.severity),"confidence":a.confidence,"reason":a.evidence.get("detection_reason")})).collect::<Vec<_>>() })
        );
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }
    Ok(())
}
