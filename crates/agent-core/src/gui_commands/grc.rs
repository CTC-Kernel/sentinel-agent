// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Risks, assets, alert rules and webhooks edited from the interface.

use agent_gui::events::{AgentEvent, GuiCommand};
use tracing::{info, warn};

use super::{CommandContext, expected};

/// Run one command of this group.
pub(crate) async fn handle(ctx: &mut CommandContext, command: GuiCommand) {
    match command {
        GuiCommand::SaveRisk { risk } => save_risk(ctx, risk).await,
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

/// Save or update a risk entry.
async fn save_risk(ctx: &mut CommandContext, risk: Box<agent_gui::dto::RiskEntry>) {
    info!("[AUDIT] GUI saved risk entry: {}", risk.title);
    let payload = agent_core::sync_converters::risk_to_payload(&risk);
    // Persist to dedicated SQLite table for offline resilience
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let risk_clone = risk.clone();
        let payload_clone = payload.clone();
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
                }
                // Also queue for remote sync
                if let Ok(json) = serde_json::to_string(&payload_clone) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Risk,
                        risk_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
            });
    }
}

/// Delete a risk entry.
async fn delete_risk(ctx: &mut CommandContext, risk_id: String) {
    info!("[AUDIT] GUI deleted risk entry: {}", risk_id);
    if let Some(ref db_arc) = ctx.db {
        let db_clone = std::sync::Arc::clone(db_arc);
        let rid = risk_id.clone();
        ctx.tasks
            .spawn_expected("delete risk", expected::SHORT, async move {
                let repo = agent_storage::SyncQueueRepository::new(&db_clone);
                if let Err(e) = repo
                    .delete_grc(agent_storage::SyncEntityType::Risk, &rid)
                    .await
                {
                    warn!("Failed to durably delete risk: {}", e);
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
                }
                if let Ok(json) = serde_json::to_string(&payload_clone) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Asset,
                        asset_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
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
                            if let Ok(json) = serde_json::to_string(&payload) {
                                let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                                let entry = agent_storage::SyncQueueEntry::new(
                                    agent_storage::SyncEntityType::Asset,
                                    asset.id.clone(),
                                    json,
                                );
                                let _ = repo2.enqueue(&entry).await;
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to load assets for lifecycle update: {}", e);
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
                }
                if let Ok(json) = serde_json::to_string(&payload_clone) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::AlertRule,
                        rule_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
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
                }
                let payload = agent_core::sync_converters::webhook_to_payload(&wh_clone);
                if let Ok(json) = serde_json::to_string(&payload) {
                    let repo2 = agent_storage::SyncQueueRepository::new(&db_clone);
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Webhook,
                        wh_clone.id.to_string(),
                        json,
                    );
                    let _ = repo2.enqueue(&entry).await;
                }
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
