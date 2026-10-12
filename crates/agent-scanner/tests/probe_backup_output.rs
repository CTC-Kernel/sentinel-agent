//! TEMPORARY, probe branch only: what the backup check says on this machine.
#![cfg(windows)]

use agent_scanner::Check;
use agent_scanner::checks::BackupCheck;
use std::time::Instant;

#[tokio::test]
async fn show_what_the_backup_check_says() {
    let start = Instant::now();
    let output = BackupCheck::new().execute().await;
    println!("PROBE backup check returned after {:?}", start.elapsed());
    println!("PROBE {output:#?}");

    // What this phase of the probe expects, when it says so.
    if let Ok(expected) = std::env::var("PROBE_EXPECT") {
        let output = output.expect("the check runs");
        let backup_type = output.raw_data["backup_type"].as_str().unwrap_or("none");
        assert_eq!(backup_type, expected, "message: {}", output.message);
    }
}
