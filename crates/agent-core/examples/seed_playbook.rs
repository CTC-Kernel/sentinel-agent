//! Stores a playbook in the agent's local database, as the interface does,
//! so that a standalone agent without a desktop session can be given one to
//! try a response for real. The playbook is read as JSON, in the form the
//! interface sends (`agent_gui::dto::Playbook`):
//! `cargo run -p agent-core --example seed_playbook -- playbook.json`
//!
//! Run it as the account the agent runs as, with the same
//! `SENTINEL_DATA_DIR`: the database and its key live there. Stop the agent
//! first; it reads its playbooks at every pass, so it sees the new one as
//! soon as it starts again.
use agent_storage::repositories::grc::{PlaybookRepository, StoredPlaybook};
use agent_storage::{Database, DatabaseConfig, KeyManager};

#[tokio::main]
async fn main() -> Result<(), String> {
    let path = std::env::args()
        .nth(1)
        .ok_or("usage: seed_playbook <playbook.json>")?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))?;
    let playbook: agent_gui::dto::Playbook =
        serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;

    let key_manager = KeyManager::new().map_err(|e| e.to_string())?;
    let db = Database::open(DatabaseConfig::default(), &key_manager).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let stored = StoredPlaybook {
        id: playbook.id.clone(),
        name: playbook.name.clone(),
        description: playbook.description.clone(),
        trigger_type: "general".to_string(),
        severity: "medium".to_string(),
        steps: serde_json::to_string(&playbook.actions).map_err(|e| e.to_string())?,
        enabled: playbook.enabled,
        created_at: playbook.created_at.to_rfc3339(),
        updated_at: now,
        synced: false,
        conditions: serde_json::to_string(&playbook.conditions).map_err(|e| e.to_string())?,
    };
    PlaybookRepository::new(&db)
        .upsert(&stored)
        .await
        .map_err(|e| e.to_string())?;
    let count = PlaybookRepository::new(&db)
        .get_all()
        .await
        .map_err(|e| e.to_string())?
        .len();
    println!(
        "Playbook '{}' stored ({count} in the database)",
        playbook.name
    );
    Ok(())
}
