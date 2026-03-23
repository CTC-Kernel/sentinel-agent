// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Asset synchronization from SQLite to GUI state.
//! Loads stored assets on startup and after platform sync, pushing them to the GUI.

use super::AgentRuntime;

impl AgentRuntime {
    /// Load all managed assets from SQLite and push them to the GUI.
    ///
    /// Called after GRC sync to ensure the Assets page reflects the latest data
    /// from both local storage and platform downloads.
    #[cfg(feature = "gui")]
    pub(crate) async fn sync_assets_to_gui(&self) {
        use tracing::{info, warn};
        let db = match self.db.as_ref() {
            Some(db) => db,
            None => return,
        };

        let repo = agent_storage::repositories::grc::ManagedAssetRepository::new(db);
        let stored = match repo.get_all().await {
            Ok(assets) => assets,
            Err(e) => {
                warn!("Failed to load assets from SQLite: {}", e);
                return;
            }
        };

        if stored.is_empty() {
            return;
        }

        let gui_assets: Vec<agent_gui::dto::ManagedAsset> = stored
            .iter()
            .filter_map(|s| {
                let id = uuid::Uuid::parse_str(&s.id).ok()?;
                let first_seen = chrono::DateTime::parse_from_rfc3339(&s.created_at)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let last_seen = chrono::DateTime::parse_from_rfc3339(&s.updated_at)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());

                let criticality = match s.criticality.as_str() {
                    "critical" | "Critical" => agent_gui::dto::AssetCriticality::Critical,
                    "high" | "High" => agent_gui::dto::AssetCriticality::High,
                    "low" | "Low" => agent_gui::dto::AssetCriticality::Low,
                    _ => agent_gui::dto::AssetCriticality::Medium,
                };
                let lifecycle = match s.status.as_str() {
                    "qualified" | "Qualified" => agent_gui::dto::AssetLifecycle::Qualified,
                    "monitored" | "Monitored" => agent_gui::dto::AssetLifecycle::Monitored,
                    "decommissioned" | "Decommissioned" => {
                        agent_gui::dto::AssetLifecycle::Decommissioned
                    }
                    _ => agent_gui::dto::AssetLifecycle::Discovered,
                };

                Some(agent_gui::dto::ManagedAsset {
                    id,
                    ip: s.location.clone(),
                    hostname: if s.name == s.location {
                        None
                    } else {
                        Some(s.name.clone())
                    },
                    mac: None,
                    vendor: None,
                    device_type: s.asset_type.clone(),
                    criticality,
                    lifecycle,
                    tags: Vec::new(),
                    risk_score: 0.0,
                    vulnerability_count: 0,
                    open_ports: Vec::new(),
                    software: Vec::new(),
                    first_seen,
                    last_seen,
                })
            })
            .collect();

        if !gui_assets.is_empty() {
            info!("Loaded {} asset(s) from SQLite into GUI", gui_assets.len());
            self.emit_gui_event(agent_gui::events::AgentEvent::AssetsLoaded {
                assets: gui_assets,
            });
        }

        // Also load playbooks from SQLite
        let pb_repo = agent_storage::repositories::grc::PlaybookRepository::new(db);
        if let Ok(stored_pbs) = pb_repo.get_all().await {
            let playbooks = crate::threat_pipeline::stored_playbooks_to_dto(&stored_pbs);
            if !playbooks.is_empty() {
                info!("Loaded {} playbook(s) from SQLite into GUI", playbooks.len());
                self.emit_gui_event(agent_gui::events::AgentEvent::PlaybooksLoaded { playbooks });
            }
        }

        // Also load detection rules from SQLite
        let rule_repo = agent_storage::repositories::grc::DetectionRuleRepository::new(db);
        if let Ok(stored_rules) = rule_repo.get_all().await {
            let rules = crate::threat_pipeline::stored_rules_to_dto(&stored_rules);
            if !rules.is_empty() {
                info!("Loaded {} detection rule(s) from SQLite into GUI", rules.len());
                self.emit_gui_event(agent_gui::events::AgentEvent::DetectionRulesLoaded { rules });
            }
        }

        // Also load alert rules and webhooks from SQLite
        {
            let alert_repo = agent_storage::repositories::grc::AlertRuleRepository::new(db);
            let webhook_repo = agent_storage::repositories::grc::WebhookRepository::new(db);
            let stored_rules = alert_repo.get_all().await.unwrap_or_default();
            let stored_webhooks = webhook_repo.get_all().await.unwrap_or_default();

            let gui_rules: Vec<agent_gui::dto::AlertRule> = stored_rules
                .iter()
                .filter_map(|s| {
                    let id = uuid::Uuid::parse_str(&s.id).ok()?;
                    let severity_threshold = match s.severity.as_str() {
                        "critical" | "Critical" => Some(agent_gui::dto::Severity::Critical),
                        "high" | "High" => Some(agent_gui::dto::Severity::High),
                        "low" | "Low" => Some(agent_gui::dto::Severity::Low),
                        "info" | "Info" => Some(agent_gui::dto::Severity::Info),
                        _ => Some(agent_gui::dto::Severity::Medium),
                    };
                    let rule_type = match s.description.as_str() {
                        "TypeFilter" => agent_gui::dto::AlertRuleType::TypeFilter,
                        "EscalationDelay" => agent_gui::dto::AlertRuleType::EscalationDelay,
                        _ => agent_gui::dto::AlertRuleType::SeverityThreshold,
                    };
                    let detection_types: Vec<String> =
                        serde_json::from_str(&s.condition).unwrap_or_default();
                    let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
                        .map(|dt| dt.with_timezone(&chrono::Utc))
                        .unwrap_or_else(|_| chrono::Utc::now());

                    Some(agent_gui::dto::AlertRule {
                        id,
                        name: s.name.clone(),
                        rule_type,
                        severity_threshold,
                        detection_types,
                        escalation_minutes: None,
                        enabled: s.enabled,
                        created_at,
                    })
                })
                .collect();

            let gui_webhooks: Vec<agent_gui::dto::WebhookConfig> = stored_webhooks
                .iter()
                .filter_map(|s| {
                    let id = uuid::Uuid::parse_str(&s.id).ok()?;
                    Some(agent_gui::dto::WebhookConfig {
                        id,
                        name: s.name.clone(),
                        url: s.url.clone(),
                        format: s.events.clone(),
                        enabled: s.enabled,
                        last_sent: None,
                        error: None,
                    })
                })
                .collect();

            if !gui_rules.is_empty() || !gui_webhooks.is_empty() {
                info!(
                    "Loaded {} alert rule(s) and {} webhook(s) from SQLite into GUI",
                    gui_rules.len(),
                    gui_webhooks.len()
                );
                self.emit_alerting_loaded(gui_rules, gui_webhooks);
            }
        }

        // Re-enqueue unsynced entities to ensure they reach the platform.
        // This covers data created before sync was properly wired.
        self.requeue_unsynced_entities(db).await;
    }

    #[cfg(feature = "gui")]
    async fn requeue_unsynced_entities(&self, db: &agent_storage::Database) {
        use tracing::{debug, info};

        let sync_repo = agent_storage::SyncQueueRepository::new(db);

        // Re-enqueue unsynced playbooks
        let pb_repo = agent_storage::repositories::grc::PlaybookRepository::new(db);
        if let Ok(pbs) = pb_repo.get_all().await {
            let mut count = 0u32;
            for pb in pbs.iter().filter(|p| !p.synced) {
                let payload = crate::sync_converters::playbook_to_payload(
                    &crate::threat_pipeline::stored_playbook_to_single_dto(pb),
                );
                if let Ok(json) = serde_json::to_string(&payload) {
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Playbook,
                        pb.id.clone(),
                        json,
                    );
                    let _ = sync_repo.enqueue(&entry).await;
                    count += 1;
                }
            }
            if count > 0 {
                info!("Re-enqueued {} unsynced playbook(s) for platform upload", count);
            }
        }

        // Re-enqueue unsynced detection rules
        let rule_repo = agent_storage::repositories::grc::DetectionRuleRepository::new(db);
        if let Ok(rules) = rule_repo.get_all().await {
            let mut count = 0u32;
            for rule in rules.iter().filter(|r| !r.synced) {
                let payload = crate::sync_converters::detection_rule_to_payload(
                    &crate::threat_pipeline::stored_rule_to_single_dto(rule),
                );
                if let Ok(json) = serde_json::to_string(&payload) {
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::DetectionRule,
                        rule.id.clone(),
                        json,
                    );
                    let _ = sync_repo.enqueue(&entry).await;
                    count += 1;
                }
            }
            if count > 0 {
                info!("Re-enqueued {} unsynced detection rule(s) for platform upload", count);
            }
        }

        // Re-enqueue unsynced assets
        let asset_repo = agent_storage::repositories::grc::ManagedAssetRepository::new(db);
        if let Ok(assets) = asset_repo.get_all().await {
            let mut count = 0u32;
            for asset in assets.iter().filter(|a| !a.synced) {
                let gui_asset = self.stored_asset_to_dto(asset);
                let payload = crate::sync_converters::asset_to_payload(&gui_asset);
                if let Ok(json) = serde_json::to_string(&payload) {
                    let entry = agent_storage::SyncQueueEntry::new(
                        agent_storage::SyncEntityType::Asset,
                        asset.id.clone(),
                        json,
                    );
                    let _ = sync_repo.enqueue(&entry).await;
                    count += 1;
                }
            }
            if count > 0 {
                info!("Re-enqueued {} unsynced asset(s) for platform upload", count);
            }
        }

        debug!("Unsynced entity re-enqueue complete");
    }

    #[cfg(feature = "gui")]
    fn stored_asset_to_dto(&self, s: &agent_storage::repositories::grc::StoredManagedAsset) -> agent_gui::dto::ManagedAsset {
        let id = uuid::Uuid::parse_str(&s.id).unwrap_or_else(|_| uuid::Uuid::new_v4());
        let first_seen = chrono::DateTime::parse_from_rfc3339(&s.created_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let last_seen = chrono::DateTime::parse_from_rfc3339(&s.updated_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let criticality = match s.criticality.as_str() {
            "critical" | "Critical" => agent_gui::dto::AssetCriticality::Critical,
            "high" | "High" => agent_gui::dto::AssetCriticality::High,
            "low" | "Low" => agent_gui::dto::AssetCriticality::Low,
            _ => agent_gui::dto::AssetCriticality::Medium,
        };
        let lifecycle = match s.status.as_str() {
            "qualified" | "Qualified" => agent_gui::dto::AssetLifecycle::Qualified,
            "monitored" | "Monitored" => agent_gui::dto::AssetLifecycle::Monitored,
            "decommissioned" | "Decommissioned" => agent_gui::dto::AssetLifecycle::Decommissioned,
            _ => agent_gui::dto::AssetLifecycle::Discovered,
        };
        agent_gui::dto::ManagedAsset {
            id,
            ip: s.location.clone(),
            hostname: if s.name == s.location { None } else { Some(s.name.clone()) },
            mac: None,
            vendor: None,
            device_type: s.asset_type.clone(),
            criticality,
            lifecycle,
            tags: Vec::new(),
            risk_score: 0.0,
            vulnerability_count: 0,
            open_ports: Vec::new(),
            software: Vec::new(),
            first_seen,
            last_seen,
        }
    }
}
