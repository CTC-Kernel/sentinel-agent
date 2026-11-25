// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Risks, assets, alert rules and webhooks edited from the interface.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use super::{CommandContext, expected};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    // Every command of this group but the webhook test writes to the local
    // database. Without it the handlers did nothing and said nothing, while
    // the page had already shown the change as made.
    if ctx.db.is_none() && !matches!(command, GuiCommand::TestWebhook { .. }) {
        report_no_database(&ctx.events);
        return;
    }
    match command {
        GuiCommand::SaveRisk { risk } => save_risk(ctx, risk).await,
        GuiCommand::SaveRisks { risks } => {
            for risk in risks {
                save_risk(ctx, Box::new(risk)).await;
            }
        }
        GuiCommand::DeleteRisk { risk_id } => delete_risk(ctx, risk_id).await,
        GuiCommand::SaveAsset { asset } => save_asset(ctx, asset).await,
        GuiCommand::UpdateAssetLifecycle {
            asset_id,
            lifecycle,
        } => update_asset_lifecycle(ctx, asset_id, lifecycle).await,
        GuiCommand::SaveAlertRule { rule } => save_alert_rule(ctx, rule).await,
        GuiCommand::DeleteAlertRule { rule_id } => delete_alert_rule(ctx, rule_id).await,
        GuiCommand::SaveWebhook { webhook } => save_webhook(ctx, webhook).await,
        GuiCommand::DeleteWebhook { webhook_id } => delete_webhook(ctx, webhook_id).await,
        GuiCommand::TestWebhook { webhook_id } => test_webhook(ctx, webhook_id).await,
        other => super::misrouted("grc", &other),
    }
}

/// The entry could not be written to the local database.
pub(super) const NOT_STORED: &str = "non enregistr\u{00e9} sur ce poste";
/// The entry is stored here but could not be queued for the platform.
pub(super) const NOT_QUEUED: &str = "non transmis \u{00e0} la plateforme";

/// Tell the operator that nothing can be kept: the local database of the
/// agent could not be opened when it started.
pub(super) fn report_no_database(events: &std::sync::mpsc::Sender<AgentEvent>) {
    let _ = events.send(AgentEvent::Notification {
        notification: agent_gui::dto::GuiNotification::error(
            "Base locale indisponible",
            "La modification n'a pas \u{00e9}t\u{00e9} enregistr\u{00e9}e : la base de donn\u{00e9}es locale \
             de l'agent n'a pas pu \u{00ea}tre ouverte. Red\u{00e9}marrez l'agent ; si le probl\u{00e8}me \
             persiste, consultez ses journaux.",
        ),
    });
}

/// Send the risk register back as the database holds it: after a change
/// that could not be written, the page shows what is really kept.
async fn resend_risks(db: &agent_storage::Database, events: &std::sync::mpsc::Sender<AgentEvent>) {
    if let Some(risks) = agent_core::gui_bridge::risks_snapshot_event(db).await {
        let _ = events.send(risks);
    }
}

/// Tell the operator that an entry the interface announced as saved was
/// not: the page shows its success toast when the command leaves, before
/// anything is written.
pub(super) fn report_not_saved(
    events: &std::sync::mpsc::Sender<AgentEvent>,
    what: &str,
    stage: &str,
    error: &dyn std::fmt::Display,
) {
    let _ = events.send(AgentEvent::Notification {
        notification: agent_gui::dto::GuiNotification::error(
            format!("{what} : enregistrement incomplet"),
            format!("{what} : {stage} ({error})."),
        ),
    });
}

/// Queue an entry for the platform. A failure used to be dropped
/// (`let _ = repo.enqueue(..)`): the entry then never left the endpoint and
/// nobody was told. It is logged and reported to the operator.
async fn queue_for_sync<P: serde::Serialize>(
    db: &agent_storage::Database,
    events: &std::sync::mpsc::Sender<AgentEvent>,
    entity: agent_storage::SyncEntityType,
    id: String,
    payload: &P,
    what: &str,
) -> bool {
    let queued = match serde_json::to_string(payload) {
        Ok(json) => agent_storage::SyncQueueRepository::new(db)
            .enqueue(&agent_storage::SyncQueueEntry::new(entity, id, json))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    match queued {
        Ok(()) => true,
        Err(e) => {
            warn!("Failed to queue {:?} for sync: {}", entity, e);
            report_not_saved(events, what, NOT_QUEUED, &e);
            false
        }
    }
}

/// Save or update a risk entry.
async fn save_risk(ctx: &mut CommandContext, risk: Box<agent_gui::dto::RiskEntry>) {
    info!("[AUDIT] GUI saved risk entry: {}", risk.title);
    let payload = agent_core::sync_converters::risk_to_payload(&risk);
    // Persist to dedicated SQLite table for offline resilience
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let risk_clone = risk.clone();
        let payload_clone = payload.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("save risk", expected::SHORT, async move {
                let stored = agent_storage::repositories::grc::StoredRisk {
                    id: risk_clone.id.to_string(),
                    title: risk_clone.title.clone(),
                    description: risk_clone.description.clone(),
                    probability: risk_clone.probability as i32,
                    impact: risk_clone.impact as i32,
                    owner: risk_clone.owner.clone(),
                    status: format!("{}", risk_clone.status),
                    mitigation: risk_clone.mitigation.clone(),
                    source: risk_clone.source.clone(),
                    created_at: risk_clone.created_at.to_rfc3339(),
                    updated_at: risk_clone.updated_at.to_rfc3339(),
                    sla_target_days: risk_clone.sla_target_days.map(|v| v as i32),
                    synced: false,
                };
                let repo = agent_storage::repositories::grc::RiskRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist risk to SQLite: {}", e);
                    report_not_saved(&tx, "Le risque", NOT_STORED, &e);
                    resend_risks(&db_clone, &tx).await;
                }
                // Also queue for remote sync
                queue_for_sync(
                    &db_clone,
                    &tx,
                    agent_storage::SyncEntityType::Risk,
                    risk_clone.id.to_string(),
                    &payload_clone,
                    "Le risque",
                )
                .await;
            });
    }
}

/// Delete a risk entry.
async fn delete_risk(ctx: &mut CommandContext, risk_id: String) {
    info!("[AUDIT] GUI deleted risk entry: {}", risk_id);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rid = risk_id.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("delete risk", expected::SHORT, async move {
                let repo = agent_storage::SyncQueueRepository::new(&db_clone);
                if let Err(e) = repo
                    .delete_grc(agent_storage::SyncEntityType::Risk, &rid)
                    .await
                {
                    warn!("Failed to durably delete risk: {}", e);
                    // The page already removed it: say it is still there,
                    // and show it again.
                    report_not_saved(&tx, "La suppression du risque", NOT_STORED, &e);
                    resend_risks(&db_clone, &tx).await;
                }
            });
    }
}

/// Save or update a managed asset.
async fn save_asset(ctx: &mut CommandContext, asset: Box<agent_gui::dto::ManagedAsset>) {
    info!(
        "[AUDIT] GUI saved asset: {} ({})",
        asset.hostname.as_deref().unwrap_or("?"),
        asset.ip
    );
    let payload = agent_core::sync_converters::asset_to_payload(&asset);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let asset_clone = asset.clone();
        let payload_clone = payload.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("save asset", expected::SHORT, async move {
                let stored = agent_storage::repositories::grc::StoredManagedAsset {
                    id: asset_clone.id.to_string(),
                    ip: asset_clone.ip.clone(),
                    hostname: asset_clone.hostname.clone(),
                    mac: asset_clone.mac.clone(),
                    vendor: asset_clone.vendor.clone(),
                    device_type: asset_clone.device_type.clone(),
                    criticality: format!("{}", asset_clone.criticality),
                    lifecycle: format!("{}", asset_clone.lifecycle),
                    tags: serde_json::to_string(&asset_clone.tags)
                        .unwrap_or_else(|_| "[]".to_string()),
                    risk_score: asset_clone.risk_score as f64,
                    vulnerability_count: asset_clone.vulnerability_count as i32,
                    open_ports: serde_json::to_string(&asset_clone.open_ports)
                        .unwrap_or_else(|_| "[]".to_string()),
                    software: serde_json::to_string(&asset_clone.software)
                        .unwrap_or_else(|_| "[]".to_string()),
                    first_seen: asset_clone.first_seen.to_rfc3339(),
                    last_seen: asset_clone.last_seen.to_rfc3339(),
                    synced: false,
                };
                let repo = agent_storage::repositories::grc::ManagedAssetRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist asset to SQLite: {}", e);
                    report_not_saved(&tx, "L'actif", NOT_STORED, &e);
                }
                queue_for_sync(
                    &db_clone,
                    &tx,
                    agent_storage::SyncEntityType::Asset,
                    asset_clone.id.to_string(),
                    &payload_clone,
                    "L'actif",
                )
                .await;
            });
    }
}

/// Update asset lifecycle state.
async fn update_asset_lifecycle(
    ctx: &mut CommandContext,
    asset_id: String,
    lifecycle: agent_gui::dto::AssetLifecycle,
) {
    info!(
        "[AUDIT] GUI updated asset lifecycle {}: {:?}",
        asset_id, lifecycle
    );
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let aid = asset_id.clone();
        let status = format!("{}", lifecycle);
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("update asset lifecycle", expected::SHORT, async move {
                let repo = agent_storage::repositories::grc::ManagedAssetRepository::new(&db_clone);
                match repo.get_all().await {
                    Ok(mut all) => {
                        if let Some(asset) = all.iter_mut().find(|a| a.id == aid) {
                            asset.lifecycle = status;
                            asset.last_seen = chrono::Utc::now().to_rfc3339();
                            asset.synced = false;
                            if let Err(e) = repo.upsert(asset).await {
                                tracing::warn!("Failed to update asset lifecycle: {}", e);
                                report_not_saved(&tx, "L'actif", NOT_STORED, &e);
                            }
                            // Queue for remote sync
                            let payload = agent_sync::types::AssetPayload {
                                id: asset.id.clone(),
                                ip: asset.ip.clone(),
                                hostname: asset.hostname.clone(),
                                mac: asset.mac.clone(),
                                vendor: asset.vendor.clone(),
                                device_type: asset.device_type.clone(),
                                criticality: asset.criticality.clone(),
                                lifecycle: asset.lifecycle.clone(),
                                tags: serde_json::from_str(&asset.tags).unwrap_or_default(),
                                risk_score: asset.risk_score,
                                vulnerability_count: asset.vulnerability_count as u32,
                                open_ports: serde_json::from_str(&asset.open_ports)
                                    .unwrap_or_default(),
                                software: serde_json::from_str(&asset.software).unwrap_or_default(),
                                first_seen: chrono::DateTime::parse_from_rfc3339(&asset.first_seen)
                                    .map(|dt| dt.with_timezone(&chrono::Utc))
                                    .unwrap_or_else(|_| chrono::Utc::now()),
                                last_seen: chrono::DateTime::parse_from_rfc3339(&asset.last_seen)
                                    .map(|dt| dt.with_timezone(&chrono::Utc))
                                    .unwrap_or_else(|_| chrono::Utc::now()),
                            };
                            queue_for_sync(
                                &db_clone,
                                &tx,
                                agent_storage::SyncEntityType::Asset,
                                asset.id.clone(),
                                &payload,
                                "L'actif",
                            )
                            .await;
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load assets for lifecycle update: {}", e);
                        report_not_saved(&tx, "L'actif", NOT_STORED, &e);
                    }
                }
            });
    }
}

/// Save or update an alert rule.
async fn save_alert_rule(ctx: &mut CommandContext, rule: Box<agent_gui::dto::AlertRule>) {
    info!("[AUDIT] GUI saved alert rule: {}", rule.name);
    let payload = agent_core::sync_converters::alert_rule_to_payload(&rule);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rule_clone = rule.clone();
        let payload_clone = payload.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("save alert rule", expected::SHORT, async move {
                let stored = agent_storage::repositories::grc::StoredAlertRule {
                    id: rule_clone.id.to_string(),
                    name: rule_clone.name.clone(),
                    rule_type: rule_clone.rule_type.as_str().to_string(),
                    severity_threshold: rule_clone
                        .severity_threshold
                        .map(|s| s.as_str().to_string()),
                    detection_types: serde_json::to_string(&rule_clone.detection_types)
                        .unwrap_or_default(),
                    escalation_minutes: rule_clone.escalation_minutes.map(|v| v as i32),
                    enabled: rule_clone.enabled,
                    created_at: rule_clone.created_at.to_rfc3339(),
                    synced: false,
                };
                let repo = agent_storage::repositories::grc::AlertRuleRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist alert rule to SQLite: {}", e);
                    report_not_saved(&tx, "La r\u{00e8}gle d'alerte", NOT_STORED, &e);
                }
                queue_for_sync(
                    &db_clone,
                    &tx,
                    agent_storage::SyncEntityType::AlertRule,
                    rule_clone.id.to_string(),
                    &payload_clone,
                    "La r\u{00e8}gle d'alerte",
                )
                .await;
                // Reload and emit AlertingLoaded
                crate::emit_alerting_loaded_from_db(&db_clone, &tx).await;
            });
    }
}

/// Delete an alert rule.
async fn delete_alert_rule(ctx: &mut CommandContext, rule_id: String) {
    info!("[AUDIT] GUI deleted alert rule: {}", rule_id);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rid = rule_id.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("delete alert rule", expected::SHORT, async move {
                let repo = agent_storage::SyncQueueRepository::new(&db_clone);
                if let Err(e) = repo
                    .delete_grc(agent_storage::SyncEntityType::AlertRule, &rid)
                    .await
                {
                    warn!("Failed to durably delete alert rule: {}", e);
                    report_not_saved(
                        &tx,
                        "La suppression de la r\u{00e8}gle d'alerte",
                        NOT_STORED,
                        &e,
                    );
                }
                // Reload and emit AlertingLoaded
                crate::emit_alerting_loaded_from_db(&db_clone, &tx).await;
            });
    }
}

/// Save or update a webhook config.
async fn save_webhook(ctx: &mut CommandContext, webhook: Box<agent_gui::dto::WebhookConfig>) {
    // Same rule as the settings form, enforced where the
    // destination is stored: https, no credentials, no
    // loopback / link-local / metadata target.
    if let Err(e) = agent_common::webhook::validate_webhook_url(&webhook.url) {
        warn!("[AUDIT] Webhook '{}' refused: {}", webhook.name, e);
        let _ = ctx.events.send(AgentEvent::Notification {
            notification: agent_gui::dto::GuiNotification::error(
                "Webhook refusé",
                format!(
                    "Le webhook « {} » n'a pas été enregistré. {}",
                    webhook.name, e
                ),
            ),
        });
        return;
    }
    info!("[AUDIT] GUI saved webhook: {}", webhook.name);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let wh_clone = webhook.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("save webhook", expected::SHORT, async move {
                let now = chrono::Utc::now().to_rfc3339();
                let stored = agent_storage::repositories::grc::StoredWebhook {
                    id: wh_clone.id.to_string(),
                    name: wh_clone.name.clone(),
                    url: wh_clone.url.clone(),
                    events: wh_clone.format.clone(),
                    secret: None,
                    enabled: wh_clone.enabled,
                    created_at: now.clone(),
                    updated_at: now,
                    synced: false,
                };
                let repo = agent_storage::repositories::grc::WebhookRepository::new(&db_clone);
                if let Err(e) = repo.upsert(&stored).await {
                    warn!("Failed to persist webhook to SQLite: {}", e);
                    report_not_saved(&tx, "Le webhook", NOT_STORED, &e);
                }
                let payload = agent_core::sync_converters::webhook_to_payload(&wh_clone);
                queue_for_sync(
                    &db_clone,
                    &tx,
                    agent_storage::SyncEntityType::Webhook,
                    wh_clone.id.to_string(),
                    &payload,
                    "Le webhook",
                )
                .await;
                // Reload and emit AlertingLoaded
                crate::emit_alerting_loaded_from_db(&db_clone, &tx).await;
            });
    }
}

/// Delete a webhook config.
async fn delete_webhook(ctx: &mut CommandContext, webhook_id: String) {
    info!("[AUDIT] GUI deleted webhook: {}", webhook_id);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let wid = webhook_id.clone();
        let tx = ctx.events.clone();
        ctx.tasks
            .spawn_expected("delete webhook", expected::SHORT, async move {
                let repo = agent_storage::SyncQueueRepository::new(&db_clone);
                if let Err(e) = repo
                    .delete_grc(agent_storage::SyncEntityType::Webhook, &wid)
                    .await
                {
                    warn!("Failed to durably delete webhook: {}", e);
                    report_not_saved(&tx, "La suppression du webhook", NOT_STORED, &e);
                }
                // Reload and emit AlertingLoaded
                crate::emit_alerting_loaded_from_db(&db_clone, &tx).await;
            });
    }
}

/// Test a webhook by sending a test payload.
async fn test_webhook(ctx: &mut CommandContext, webhook_id: String) {
    info!("[AUDIT] GUI requested webhook test: {}", webhook_id);
    let tx = ctx.events.clone();
    let db_clone = ctx.db.clone();
    let wid = webhook_id.clone();
    ctx.tasks.spawn_expected("test webhook", expected::SHORT, async move {
        // Load webhook from SQLite
        let webhook_opt = if let Some(ref db_arc) = db_clone {
            let repo = agent_storage::repositories::grc::WebhookRepository::new(db_arc);
            match repo.get_all().await {
                Ok(all) => all.into_iter().find(|w| w.id == wid),
                Err(e) => {
                    warn!("Failed to load webhooks from SQLite: {}", e);
                    None
                }
            }
        } else {
            None
        };

        let notification = if let Some(ref wh) = webhook_opt
            && let Err(e) = agent_common::webhook::validate_webhook_url(&wh.url)
        {
            agent_gui::dto::GuiNotification::error(
                "Test webhook refusé",
                format!("Le webhook « {} » n'a pas été contacté. {}", wh.name, e),
            )
        } else if let Some(wh) = webhook_opt {
            // The stored `events` column carries the format.
            let payload =
                agent_common::webhook::test_payload(&wh.events, &chrono::Utc::now().to_rfc3339());
            // No redirects: a 30x towards an internal address is the
            // classic way around the destination check above.
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap_or_default();
            match client.post(&wh.url).json(&payload).send().await {
                Ok(resp) if resp.status().is_success() => agent_gui::dto::GuiNotification::info(
                    "Test webhook r\u{00e9}ussi",
                    format!(
                        "Le webhook '{}' a r\u{00e9}pondu avec succ\u{00e8}s (HTTP {}).",
                        wh.name,
                        resp.status()
                    ),
                ),
                Ok(resp) => agent_gui::dto::GuiNotification::error(
                    "Test webhook \u{00e9}chou\u{00e9}",
                    format!(
                        "Le webhook '{}' a r\u{00e9}pondu avec le code HTTP {}.",
                        wh.name,
                        resp.status()
                    ),
                ),
                Err(e) => {
                    warn!("Webhook test '{}' failed: {}", wh.name, e);
                    let cause = if e.is_timeout() {
                        "le serveur n'a pas répondu dans les 10 secondes"
                    } else if e.is_connect() {
                        "connexion impossible (adresse, pare-feu ou certificat)"
                    } else {
                        "erreur réseau ; le détail est dans les journaux de l'agent"
                    };
                    agent_gui::dto::GuiNotification::error(
                        "Test webhook \u{00e9}chou\u{00e9}",
                        format!(
                            "Impossible de contacter le webhook « {} » : {}.",
                            wh.name, cause
                        ),
                    )
                }
            }
        } else {
            agent_gui::dto::GuiNotification::error(
                "Webhook introuvable",
                format!(
                    "Aucun webhook avec l'identifiant '{}' n'a \u{00e9}t\u{00e9} trouv\u{00e9}.",
                    wid
                ),
            )
        };

        let _ = tx.send(AgentEvent::Notification { notification });
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_storage::{
        Database, DatabaseConfig, KeyManager, SyncEntityType, SyncQueueRepository,
    };

    fn open_db(dir: &tempfile::TempDir) -> Database {
        let key = KeyManager::new_with_key(b"01234567890123456789012345678901");
        Database::open(DatabaseConfig::with_path(dir.path().join("test.db")), &key).unwrap()
    }

    /// A failed enqueue was discarded after the interface had announced
    /// the save: it must reach the operator.
    #[tokio::test]
    async fn a_failed_enqueue_is_reported_to_the_operator() {
        let dir = tempfile::tempdir().unwrap();
        let db = open_db(&dir);
        let (tx, rx) = std::sync::mpsc::channel();
        let payload = serde_json::json!({ "id": "r-1" });

        let queued = queue_for_sync(
            &db,
            &tx,
            SyncEntityType::Risk,
            "r-1".to_string(),
            &payload,
            "Le risque",
        )
        .await;
        assert!(queued);
        assert!(rx.try_recv().is_err(), "nothing to report on success");
        assert_eq!(SyncQueueRepository::new(&db).count().await.unwrap(), 1);

        // Make the queue unusable.
        db.with_connection(|conn| {
            conn.execute_batch("DROP TABLE sync_queue;")
                .map_err(|e| agent_storage::StorageError::Query(e.to_string()))
        })
        .await
        .unwrap();

        let queued = queue_for_sync(
            &db,
            &tx,
            SyncEntityType::Risk,
            "r-2".to_string(),
            &payload,
            "Le risque",
        )
        .await;
        assert!(!queued);
        match rx.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.severity, "error");
                assert!(notification.title.starts_with("Le risque"));
                assert!(notification.body.contains("non transmis"));
            }
            other => panic!("expected an error notification, got {other:?}"),
        }
    }

    /// Without a database the handlers returned without a word, the page
    /// having already announced the save.
    #[tokio::test]
    async fn without_a_database_the_operator_is_told_nothing_was_saved() {
        let (mut ctx, events) = crate::gui_commands::testing::context();

        handle(
            &mut ctx,
            GuiCommand::DeleteRisk {
                risk_id: "r-1".to_string(),
            },
        )
        .await;

        match events.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.severity, "error");
                assert_eq!(notification.title, "Base locale indisponible");
            }
            other => panic!("expected an error notification, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_risk_deletion_that_fails_is_reported_and_the_risk_is_shown_again() {
        let dir = tempfile::tempdir().unwrap();
        let db = std::sync::Arc::new(open_db(&dir));
        let now = chrono::Utc::now().to_rfc3339();
        agent_storage::repositories::grc::RiskRepository::new(&db)
            .upsert(&agent_storage::repositories::grc::StoredRisk {
                id: "r-1".to_string(),
                title: "Rançongiciel".to_string(),
                description: String::new(),
                probability: 3,
                impact: 4,
                owner: String::new(),
                status: "open".to_string(),
                mitigation: String::new(),
                source: "manual".to_string(),
                created_at: now.clone(),
                updated_at: now,
                sla_target_days: None,
                synced: false,
            })
            .await
            .unwrap();
        // Make the deletion impossible.
        db.with_connection(|conn| {
            conn.execute_batch("DROP TABLE sync_queue;")
                .map_err(|e| agent_storage::StorageError::Query(e.to_string()))
        })
        .await
        .unwrap();
        let (mut ctx, events) = crate::gui_commands::testing::context();
        ctx.db = Some(std::sync::Arc::clone(&db));

        handle(
            &mut ctx,
            GuiCommand::DeleteRisk {
                risk_id: "r-1".to_string(),
            },
        )
        .await;

        let mut received = Vec::new();
        for _ in 0..500 {
            received.extend(events.try_iter());
            if received.len() >= 2 {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert!(received.iter().any(|event| matches!(
            event,
            AgentEvent::Notification { notification }
                if notification.title == "La suppression du risque : enregistrement incomplet"
        )));
        assert!(received.iter().any(|event| matches!(
            event,
            AgentEvent::RisksSnapshot { risks } if risks.iter().any(|risk| risk.id == "r-1")
        )));
    }
}
