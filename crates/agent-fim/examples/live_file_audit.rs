//! Real filesystem probe confined to a temporary directory; no user files modified.
use agent_fim::{FimConfig, FimEngine};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = tempfile::tempdir()?;
    let path = directory.path().join("probe.txt");
    std::fs::write(&path, "baseline")?;
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);
    let engine = FimEngine::new(
        FimConfig {
            watched_paths: vec![directory.path().to_path_buf()],
            ignore_patterns: vec![],
            recursive: true,
            debounce_ms: 100,
        },
        tx,
    );
    engine.start().await?;
    tokio::time::sleep(Duration::from_secs(1)).await;
    std::fs::write(&path, "modified content")?;
    let expected_hash = agent_fim::baseline::compute_blake3(&path)?;
    let alert = tokio::time::timeout(Duration::from_secs(8), async {
        while let Some(alert) = rx.recv().await {
            if alert.path.ends_with("probe.txt") && alert.new_hash.as_ref() == Some(&expected_hash)
            {
                return Some(alert);
            }
        }
        None
    })
    .await?
    .ok_or("watcher stopped without reporting the modification")?;
    assert_eq!(alert.change, agent_common::types::FimChangeType::Modified);
    std::fs::remove_file(&path)?;
    tokio::time::timeout(Duration::from_secs(8), async {
        while let Some(alert) = rx.recv().await {
            if alert.path.ends_with("probe.txt")
                && alert.change == agent_common::types::FimChangeType::Deleted
            {
                return Ok::<_, &'static str>(());
            }
        }
        Err("missing deletion event")
    })
    .await??;
    engine.stop();
    engine.start().await?;
    tokio::time::sleep(Duration::from_secs(1)).await;
    std::fs::write(directory.path().join("after-restart.txt"), "new file")?;
    tokio::time::timeout(Duration::from_secs(8), async {
        while let Some(alert) = rx.recv().await {
            if alert.path.ends_with("after-restart.txt")
                && alert.change == agent_common::types::FimChangeType::Created
            {
                return Ok::<_, &'static str>(());
            }
        }
        Err("missing event after restart")
    })
    .await??;
    engine.stop();
    println!(
        "{}",
        serde_json::json!({"modified": true, "deleted": true, "created_after_restart": true, "stopped": !engine.is_running()})
    );
    Ok(())
}
