//! Read-only live process inventory and detection; no response actions or upload.
use agent_scanner::security::process_monitor::ProcessMonitor;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (incidents, count) = ProcessMonitor::new().scan_processes().await?;
    if count == 0 {
        return Err("Process inventory unavailable: zero processes observed".into());
    }
    println!(
        "{}",
        serde_json::json!({"observed_processes":count,"incidents":incidents.iter().map(|i| serde_json::json!({"type":format!("{:?}",i.incident_type),"severity":format!("{:?}",i.severity),"confidence":i.confidence})).collect::<Vec<_>>() })
    );
    Ok(())
}
