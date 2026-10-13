//! Reads the real system log of this machine for a few seconds; nothing is
//! written. `cargo run -p agent-siem --example live_log_stream [all]`
use agent_siem::stream::LogStream;
use std::time::{Duration, Instant};

fn main() -> Result<(), String> {
    let all_programs = std::env::args().nth(1).as_deref() == Some("all");
    let stream = LogStream::start(all_programs)?;
    let started = Instant::now();
    let mut events = 0usize;
    let mut decoded = 0usize;
    let mut programs = std::collections::BTreeMap::<String, usize>::new();
    while started.elapsed() < Duration::from_secs(4) {
        for log in stream.drain(10_000) {
            events += 1;
            decoded += usize::from(log.get("action").is_some());
            *programs.entry(log.source().to_string()).or_default() += 1;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let mut busiest: Vec<_> = programs.into_iter().collect();
    busiest.sort_by_key(|entry| std::cmp::Reverse(entry.1));
    busiest.truncate(5);
    println!(
        "{}",
        serde_json::json!({
            "source": stream.kind(),
            "all_programs": all_programs,
            "running": stream.is_running(),
            "events": events,
            "with_action": decoded,
            "dropped": stream.take_dropped(),
            "busiest": busiest,
        })
    );
    Ok(())
}
