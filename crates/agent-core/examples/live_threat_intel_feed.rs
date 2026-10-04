//! Read-only live download of one indicator feed; prints how many addresses
//! and domains it yields. Nothing about the host is sent.
//!
//! `cargo run -p agent-core --example live_threat_intel_feed -- <url> [text|stix|taxii]`
use agent_common::config::{ThreatIntelFeed, ThreatIntelFeedFormat};
use agent_core::threat_intel_feeds::fetch_feed;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let url = args.next().ok_or("usage: <url> [text|stix|taxii]")?;
    let format = match args.next().as_deref() {
        None | Some("text") => ThreatIntelFeedFormat::Text,
        Some("stix") => ThreatIntelFeedFormat::Stix,
        Some("taxii") => ThreatIntelFeedFormat::Taxii,
        Some(other) => return Err(format!("unknown format '{other}'").into()),
    };
    let feed = ThreatIntelFeed {
        name: "live".to_string(),
        url,
        format,
        authorization: None,
        refresh_hours: 12,
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("sentinel-grc-agent")
        .build()?;
    let indicators = fetch_feed(&client, &feed).await?;
    println!(
        "{}",
        serde_json::json!({
            "addresses": indicators.ips.len(),
            "domains": indicators.domains.len(),
            "sample_addresses": indicators.ips.iter().take(3).collect::<Vec<_>>(),
            "sample_domains": indicators.domains.iter().take(3).collect::<Vec<_>>(),
        })
    );
    Ok(())
}
