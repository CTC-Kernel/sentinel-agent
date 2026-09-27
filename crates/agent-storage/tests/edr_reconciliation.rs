//! EDR snapshots must apply platform toggles/deletes without losing offline edits.
use agent_storage::repositories::grc::{
    DetectionRuleRepository, PlaybookRepository, StoredDetectionRule, StoredPlaybook,
};
use agent_storage::{
    Database, DatabaseConfig, KeyManager, SyncEntityType, SyncQueueEntry, SyncQueueRepository,
};

fn database() -> (tempfile::TempDir, Database) {
    let dir = tempfile::tempdir().unwrap();
    let db = Database::open(
        DatabaseConfig::with_path(dir.path().join("edr.db")),
        &KeyManager::new_with_key(b"01234567890123456789012345678901"),
    )
    .unwrap();
    (dir, db)
}
fn rule(id: &str, synced: bool) -> StoredDetectionRule {
    StoredDetectionRule {
        id: id.into(),
        name: id.into(),
        description: String::new(),
        severity: "high".into(),
        conditions: "[]".into(),
        actions: "[]".into(),
        enabled: true,
        created_at: "2026-09-27T00:00:00Z".into(),
        last_match: None,
        match_count: 0,
        synced,
    }
}
fn playbook(id: &str, synced: bool) -> StoredPlaybook {
    StoredPlaybook {
        id: id.into(),
        name: id.into(),
        description: String::new(),
        trigger_type: "general".into(),
        severity: "high".into(),
        steps: "[]".into(),
        enabled: true,
        created_at: "2026-09-27T00:00:00Z".into(),
        updated_at: "2026-09-27T00:00:00Z".into(),
        conditions: "[]".into(),
        synced,
    }
}

#[tokio::test]
async fn detection_snapshot_applies_updates_deletes_and_preserves_offline_changes() {
    let (_dir, db) = database();
    let repo = DetectionRuleRepository::new(&db);
    repo.upsert(&rule("remote-id", true)).await.unwrap();
    repo.upsert(&rule("deleted-on-platform", true))
        .await
        .unwrap();
    repo.upsert(&rule("local-unsent", false)).await.unwrap();
    let mut remote = rule("remote-id", true);
    remote.enabled = false;
    let mut stale = rule("local-unsent", true);
    stale.name = "stale console copy".into();
    repo.reconcile_snapshot(&[remote, stale]).await.unwrap();
    let items = repo.get_all().await.unwrap();
    assert_eq!(items.len(), 2);
    assert!(!items.iter().find(|r| r.id == "remote-id").unwrap().enabled);
    assert_eq!(
        items.iter().find(|r| r.id == "local-unsent").unwrap().name,
        "local-unsent"
    );
    repo.reconcile_snapshot(&[]).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].id, "local-unsent");
}

#[tokio::test]
async fn playbook_snapshot_applies_updates_deletes_and_preserves_offline_changes() {
    let (_dir, db) = database();
    let repo = PlaybookRepository::new(&db);
    repo.upsert(&playbook("remote", true)).await.unwrap();
    repo.upsert(&playbook("deleted", true)).await.unwrap();
    repo.upsert(&playbook("local", false)).await.unwrap();
    let mut remote = playbook("remote", true);
    remote.enabled = false;
    repo.reconcile_snapshot(&[remote]).await.unwrap();
    let items = repo.get_all().await.unwrap();
    assert_eq!(items.len(), 2);
    assert!(!items.iter().find(|p| p.id == "remote").unwrap().enabled);
    repo.reconcile_snapshot(&[]).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].id, "local");
}

#[tokio::test]
async fn upload_acknowledgment_keeps_newer_queued_edits_dirty() {
    let (_dir, db) = database();
    let repo = DetectionRuleRepository::new(&db);
    let queue = SyncQueueRepository::new(&db);
    repo.upsert(&rule("local", false)).await.unwrap();
    let first = queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::DetectionRule,
            "local",
            "{}",
        ))
        .await
        .unwrap();
    let second = queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::DetectionRule,
            "local",
            "{\"new\":true}",
        ))
        .await
        .unwrap();
    queue
        .acknowledge_grc(&[first], SyncEntityType::DetectionRule)
        .await
        .unwrap();
    assert!(!repo.get_all().await.unwrap()[0].synced);
    queue
        .acknowledge_grc(&[second], SyncEntityType::DetectionRule)
        .await
        .unwrap();
    assert!(repo.get_all().await.unwrap()[0].synced);
    assert!(queue.get_pending(10).await.unwrap().is_empty());
    repo.reconcile_snapshot(&[]).await.unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());
}

#[tokio::test]
async fn queued_record_is_protected_even_when_synced_flag_is_stale() {
    let (_dir, db) = database();
    let repo = PlaybookRepository::new(&db);
    repo.upsert(&playbook("pending", true)).await.unwrap();
    SyncQueueRepository::new(&db)
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::Playbook,
            "pending",
            "{}",
        ))
        .await
        .unwrap();
    repo.reconcile_snapshot(&[]).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap().len(), 1);
    let mut remote = playbook("pending", true);
    remote.name = "old server name".into();
    repo.reconcile_snapshot(&[remote]).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].name, "pending");
}

#[tokio::test]
async fn offline_deletion_survives_restart_and_blocks_resurrection() {
    let (dir, db) = database();
    let repo = DetectionRuleRepository::new(&db);
    repo.upsert(&rule("remote", true)).await.unwrap();
    let queue = SyncQueueRepository::new(&db);
    queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::DetectionRule,
            "remote",
            "{}",
        ))
        .await
        .unwrap();
    queue
        .delete_grc(SyncEntityType::DetectionRule, "remote")
        .await
        .unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());
    drop(db);
    let db = Database::open(
        DatabaseConfig::with_path(dir.path().join("edr.db")),
        &KeyManager::new_with_key(b"01234567890123456789012345678901"),
    )
    .unwrap();
    let pending = SyncQueueRepository::new(&db).get_pending(50).await.unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].entity_type, SyncEntityType::DetectionRuleDelete);
    let repo = DetectionRuleRepository::new(&db);
    repo.reconcile_snapshot(&[rule("remote", true)])
        .await
        .unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());

    let repo = PlaybookRepository::new(&db);
    repo.upsert(&playbook("remote", true)).await.unwrap();
    SyncQueueRepository::new(&db)
        .delete_grc(SyncEntityType::Playbook, "remote")
        .await
        .unwrap();
    repo.reconcile_snapshot(&[playbook("remote", true)])
        .await
        .unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());
}
