use agent_storage::repositories::{
    command_results::CommandResultRepository,
    grc::{AlertRuleRepository, StoredAlertRule},
};
use agent_storage::{
    Database, DatabaseConfig, KeyManager, SyncEntityType, SyncQueueEntry, SyncQueueRepository,
};
fn open(path: &std::path::Path) -> Database {
    Database::open(
        DatabaseConfig::with_path(path),
        &KeyManager::new_with_key(b"01234567890123456789012345678901"),
    )
    .unwrap()
}
fn rule(id: &str, synced: bool) -> StoredAlertRule {
    StoredAlertRule {
        id: id.into(),
        name: id.into(),
        rule_type: "SeverityThreshold".into(),
        severity_threshold: Some("info".into()),
        detection_types: "[]".into(),
        escalation_minutes: Some(0),
        enabled: true,
        created_at: "2026-09-27T00:00:00Z".into(),
        synced,
    }
}
#[tokio::test]
async fn command_result_survives_restart_and_requires_matching_ack() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    {
        let db = open(&path);
        let repo = CommandResultRepository::new(&db, "agent-a");
        repo.store("command/non-uuid", "outcome").await.unwrap();
        assert!(repo.store("command/non-uuid", "different").await.is_err());
    }
    let db = open(&path);
    let repo = CommandResultRepository::new(&db, "agent-a");
    assert_eq!(
        repo.pending(50).await.unwrap(),
        vec![("command/non-uuid".into(), "outcome".into())]
    );
    assert!(
        CommandResultRepository::new(&db, "agent-b")
            .pending(50)
            .await
            .unwrap()
            .is_empty()
    );
    repo.acknowledge("command/non-uuid", "different")
        .await
        .unwrap();
    assert_eq!(repo.pending(50).await.unwrap().len(), 1);
    repo.acknowledge("command/non-uuid", "outcome")
        .await
        .unwrap();
    assert!(repo.pending(50).await.unwrap().is_empty());
}
#[tokio::test]
async fn alert_snapshot_keeps_offline_edits_and_deletes_absent_synced_rows() {
    let dir = tempfile::tempdir().unwrap();
    let db = open(&dir.path().join("db"));
    let repo = AlertRuleRepository::new(&db);
    let queue = SyncQueueRepository::new(&db);
    repo.upsert(&rule("remote", true)).await.unwrap();
    repo.upsert(&rule("local", false)).await.unwrap();
    repo.upsert(&rule("queued", true)).await.unwrap();
    queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::AlertRule,
            "queued",
            "{}",
        ))
        .await
        .unwrap();
    repo.reconcile_remote(&[], true).await.unwrap();
    let rows = repo.get_all().await.unwrap();
    assert_eq!(rows.len(), 2);
    assert!(!rows.iter().any(|r| r.id == "remote"));
    let mut changed = rule("local", true);
    changed.name = "stale remote".into();
    repo.reconcile_remote(&[changed], false).await.unwrap();
    assert_eq!(
        repo.get_all()
            .await
            .unwrap()
            .iter()
            .find(|r| r.id == "local")
            .unwrap()
            .name,
        "local"
    );
    queue
        .delete_grc(SyncEntityType::AlertRule, "queued")
        .await
        .unwrap();
    repo.reconcile_remote(&[rule("queued", true)], true)
        .await
        .unwrap();
    assert!(
        !repo
            .get_all()
            .await
            .unwrap()
            .iter()
            .any(|r| r.id == "queued")
    );
    assert_eq!(
        queue
            .get_pending_for(SyncEntityType::AlertRuleDelete, 50)
            .await
            .unwrap()
            .len(),
        1
    );
}
#[tokio::test]
async fn grc_tombstones_survive_restart_and_queue_limits() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    {
        let db = open(&path);
        let queue = SyncQueueRepository::new(&db);
        for kind in [
            SyncEntityType::Risk,
            SyncEntityType::AlertRule,
            SyncEntityType::Webhook,
        ] {
            queue
                .enqueue(&SyncQueueEntry::new(kind, kind.as_str(), "{}"))
                .await
                .unwrap();
            queue.delete_grc(kind, kind.as_str()).await.unwrap();
        }
    }
    let db = open(&path);
    let queue = SyncQueueRepository::new(&db);
    let rows = queue.get_pending(50).await.unwrap();
    assert_eq!(rows.len(), 3);
    assert!(
        rows.iter()
            .all(|r| r.entity_type.as_str().ends_with("_delete"))
    );
    db.with_connection(|c| {c.execute_batch("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10001) INSERT INTO sync_queue(entity_type,entity_id,payload,priority) SELECT 'risk',CAST(x AS TEXT),'{}',20 FROM n").unwrap();Ok(())}).await.unwrap();
    queue.enforce_queue_limit().await.unwrap();
    for kind in [
        SyncEntityType::RiskDelete,
        SyncEntityType::AlertRuleDelete,
        SyncEntityType::WebhookDelete,
    ] {
        assert_eq!(queue.get_pending_for(kind, 50).await.unwrap().len(), 1);
    }
}

#[tokio::test]
async fn risk_asset_webhook_remote_merges_protect_pending_edits() {
    use agent_storage::repositories::grc::{
        ManagedAssetRepository, RiskRepository, StoredManagedAsset, StoredRisk, StoredWebhook,
        WebhookRepository,
    };
    let dir = tempfile::tempdir().unwrap();
    let db = open(&dir.path().join("db"));
    let timestamp = "2026-09-27T00:00:00Z";
    let risk = StoredRisk {
        id: "opaque-risk".into(),
        title: "remote".into(),
        description: String::new(),
        probability: 2,
        impact: 3,
        owner: String::new(),
        status: "open".into(),
        mitigation: String::new(),
        source: "platform".into(),
        created_at: timestamp.into(),
        updated_at: timestamp.into(),
        sla_target_days: Some(0),
        synced: true,
    };
    let repo = RiskRepository::new(&db);
    repo.reconcile_remote(std::slice::from_ref(&risk), false)
        .await
        .unwrap();
    let mut local = risk.clone();
    local.title = "offline edit".into();
    local.synced = false;
    repo.upsert(&local).await.unwrap();
    repo.reconcile_remote(&[risk], false).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].title, "offline edit");
    let asset = StoredManagedAsset {
        id: "opaque-asset".into(),
        ip: "192.0.2.1".into(),
        hostname: None,
        mac: None,
        vendor: None,
        device_type: "server".into(),
        criticality: "high".into(),
        lifecycle: "monitored".into(),
        tags: "[]".into(),
        risk_score: 3.0,
        vulnerability_count: 1,
        open_ports: "[443]".into(),
        software: "[\"OpenSSH\"]".into(),
        first_seen: timestamp.into(),
        last_seen: timestamp.into(),
        synced: true,
    };
    let repo = ManagedAssetRepository::new(&db);
    repo.reconcile_remote(std::slice::from_ref(&asset), false)
        .await
        .unwrap();
    SyncQueueRepository::new(&db)
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::Asset,
            "opaque-asset",
            "{}",
        ))
        .await
        .unwrap();
    let mut newer = asset;
    newer.risk_score = 90.0;
    repo.reconcile_remote(&[newer], false).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].risk_score, 3.0);
    repo.reconcile_remote(&[], false).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap().len(), 1);
    let queue = SyncQueueRepository::new(&db);
    let ids: Vec<i64> = queue
        .get_pending_for(SyncEntityType::Asset, 50)
        .await
        .unwrap()
        .iter()
        .map(|r| r.id)
        .collect();
    queue
        .acknowledge_grc(&ids, SyncEntityType::Asset)
        .await
        .unwrap();
    repo.reconcile_remote(&[], true).await.unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());
    let hook = StoredWebhook {
        id: "opaque-hook".into(),
        name: "hook".into(),
        url: "https://example.test".into(),
        events: "generic".into(),
        secret: None,
        enabled: false,
        created_at: timestamp.into(),
        updated_at: timestamp.into(),
        synced: true,
    };
    let repo = WebhookRepository::new(&db);
    repo.reconcile_remote(&[hook], true).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].id, "opaque-hook");
    repo.reconcile_remote(&[], true).await.unwrap();
    assert!(repo.get_all().await.unwrap().is_empty());
}

#[tokio::test]
async fn typed_queue_drain_does_not_starve_behind_other_entity_types() {
    let dir = tempfile::tempdir().unwrap();
    let db = open(&dir.path().join("db"));
    let queue = SyncQueueRepository::new(&db);
    for n in 0..60 {
        queue
            .enqueue(&SyncQueueEntry::new(
                SyncEntityType::CheckResult,
                n.to_string(),
                "{}",
            ))
            .await
            .unwrap();
    }
    let first = queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::Risk,
            "opaque-risk",
            "first",
        ))
        .await
        .unwrap();
    let second = queue
        .enqueue(&SyncQueueEntry::new(
            SyncEntityType::Risk,
            "opaque-risk",
            "newer",
        ))
        .await
        .unwrap();
    let pending = queue
        .get_pending_for(SyncEntityType::Risk, 50)
        .await
        .unwrap();
    assert_eq!(pending.len(), 2);
    queue
        .acknowledge_grc(&[first], SyncEntityType::Risk)
        .await
        .unwrap();
    assert_eq!(
        queue
            .get_pending_for(SyncEntityType::Risk, 50)
            .await
            .unwrap()[0]
            .id,
        second
    );
}

#[tokio::test]
async fn upgrading_v9_preserves_webhook_credentials_and_format() {
    let dir = tempfile::tempdir().unwrap();
    let db = open(&dir.path().join("db"));
    db.with_connection_mut(|conn| {
        agent_storage::migrations::rollback_migration(conn, 10)?;
        conn.execute("INSERT INTO webhooks(id,name,url,token,events,enabled,verify_ssl,created_at,synced) VALUES ('legacy','hook','https://example.test','test-only-token','teams',1,1,'2026-09-27T00:00:00Z',1)", []).unwrap();
        agent_storage::run_migrations(conn)?;
        Ok(())
    }).await.unwrap();
    let repo = agent_storage::repositories::grc::WebhookRepository::new(&db);
    let rows = repo.get_all().await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].events, "teams");
    assert_eq!(rows[0].secret.as_deref(), Some("test-only-token"));
    assert_eq!(rows[0].updated_at, rows[0].created_at);
    repo.upsert(&rows[0]).await.unwrap();
    assert_eq!(repo.get_all().await.unwrap()[0].secret, rows[0].secret);
}

#[tokio::test]
async fn rejected_result_rotates_without_being_discarded() {
    let dir = tempfile::tempdir().unwrap();
    let db = open(&dir.path().join("db"));
    let repo = CommandResultRepository::new(&db, "agent-a");
    repo.store("a-rejected", "first").await.unwrap();
    repo.store("b-new", "second").await.unwrap();
    assert_eq!(repo.pending(1).await.unwrap()[0].0, "a-rejected");
    repo.mark_attempt("a-rejected").await.unwrap();
    assert_eq!(repo.pending(1).await.unwrap()[0].0, "b-new");
    assert_eq!(repo.count().await.unwrap(), 2);
}
