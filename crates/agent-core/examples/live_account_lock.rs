//! Locks then unlocks a local account, for real. Run as root on a test
//! machine, with the name of an account created for the purpose:
//! `cargo run -p agent-core --example live_account_lock -- <account>`
use agent_core::edr_actions::account::{disable_account, enable_account};

fn state(user: &str) -> String {
    let output = std::process::Command::new("passwd")
        .args(["-S", user])
        .output()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default();
    output.split_whitespace().nth(1).unwrap_or("?").to_string()
}

#[tokio::main]
async fn main() -> Result<(), String> {
    let user = std::env::args()
        .nth(1)
        .ok_or("usage: live_account_lock <account>")?;
    let before = state(&user);

    // What must be refused, whatever the machine.
    let root = disable_account("root", 60)
        .await
        .err()
        .map(|e| e.to_string());
    let absent = disable_account("no-such-account-here", 60)
        .await
        .err()
        .map(|e| e.to_string());

    disable_account(&user, 0).await.map_err(|e| e.to_string())?;
    let locked = state(&user);
    // Locked twice: left as it is.
    disable_account(&user, 0).await.map_err(|e| e.to_string())?;
    enable_account(&user).await.map_err(|e| e.to_string())?;
    let unlocked = state(&user);
    // Not locked by the agent any more: not the agent's to unlock.
    let again = enable_account(&user).await.err().map(|e| e.to_string());

    println!(
        "{}",
        serde_json::json!({
            "before": before, "locked": locked, "unlocked": unlocked,
            "root_refused": root, "absent_refused": absent, "second_unlock_refused": again,
        })
    );
    Ok(())
}
