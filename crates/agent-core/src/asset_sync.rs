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

        let mut gui_assets: Vec<agent_gui::dto::ManagedAsset> = stored
            .iter()
            .filter_map(|s| {
                let id = uuid::Uuid::parse_str(&s.id).ok()?;
                let first_seen = chrono::DateTime::parse_from_rfc3339(&s.first_seen)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());
                let last_seen = chrono::DateTime::parse_from_rfc3339(&s.last_seen)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now());

                let criticality = match s.criticality.as_str() {
                    "critical" | "Critical" => agent_gui::dto::AssetCriticality::Critical,
                    "high" | "High" => agent_gui::dto::AssetCriticality::High,
                    "low" | "Low" => agent_gui::dto::AssetCriticality::Low,
                    _ => agent_gui::dto::AssetCriticality::Medium,
                };
                let lifecycle = match s.lifecycle.as_str() {
                    "unauthorized" | "Unauthorized" => agent_gui::dto::AssetLifecycle::Unauthorized,
                    "qualified" | "Qualified" => agent_gui::dto::AssetLifecycle::Qualified,
                    "monitored" | "Monitored" => agent_gui::dto::AssetLifecycle::Monitored,
                    "decommissioned" | "Decommissioned" => {
                        agent_gui::dto::AssetLifecycle::Decommissioned
                    }
                    _ => agent_gui::dto::AssetLifecycle::Discovered,
                };

                Some(agent_gui::dto::ManagedAsset {
                    id,
                    ip: s.ip.clone(),
                    hostname: s.hostname.clone(),
                    mac: s.mac.clone(),
                    vendor: s.vendor.clone(),
                    device_type: s.device_type.clone(),
                    criticality,
                    lifecycle,
                    tags: serde_json::from_str(&s.tags).unwrap_or_default(),
                    risk_score: s.risk_score as f32,
                    vulnerability_count: s.vulnerability_count as u32,
                    open_ports: serde_json::from_str(&s.open_ports).unwrap_or_default(),
                    software: serde_json::from_str(&s.software).unwrap_or_default(),
                    first_seen,
                    last_seen,
                })
            })
            .collect();

        // Auto-register the host machine as the first asset if none exist yet.
        // The agent runs on this machine — it IS the primary managed asset.
        if gui_assets.is_empty() {
            let host_asset = self.build_host_asset();
            info!("No assets in SQLite — auto-registering host machine as first asset");

            // Persist to SQLite so it survives restarts
            let stored_host = agent_storage::repositories::grc::StoredManagedAsset {
                id: host_asset.id.to_string(),
                ip: host_asset.ip.clone(),
                hostname: host_asset.hostname.clone(),
                mac: host_asset.mac.clone(),
                vendor: host_asset.vendor.clone(),
                device_type: host_asset.device_type.clone(),
                criticality: "high".to_string(),
                lifecycle: "monitored".to_string(),
                tags: serde_json::to_string(&host_asset.tags).unwrap_or_else(|_| "[]".to_string()),
                risk_score: host_asset.risk_score as f64,
                vulnerability_count: host_asset.vulnerability_count as i32,
                open_ports: serde_json::to_string(&host_asset.open_ports).unwrap_or_else(|_| "[]".to_string()),
                software: serde_json::to_string(&host_asset.software).unwrap_or_else(|_| "[]".to_string()),
                first_seen: chrono::Utc::now().to_rfc3339(),
                last_seen: chrono::Utc::now().to_rfc3339(),
                synced: false,
            };
            if let Err(e) = repo.upsert(&stored_host).await {
                warn!("Failed to persist host asset to SQLite: {}", e);
            }

            gui_assets.push(host_asset);
        }

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
                    let severity_threshold = s.severity_threshold.as_deref().map(|sev| match sev {
                        "critical" | "Critical" => agent_gui::dto::Severity::Critical,
                        "high" | "High" => agent_gui::dto::Severity::High,
                        "low" | "Low" => agent_gui::dto::Severity::Low,
                        "info" | "Info" => agent_gui::dto::Severity::Info,
                        _ => agent_gui::dto::Severity::Medium,
                    });
                    let rule_type = match s.rule_type.as_str() {
                        "TypeFilter" => agent_gui::dto::AlertRuleType::TypeFilter,
                        "EscalationDelay" => agent_gui::dto::AlertRuleType::EscalationDelay,
                        _ => agent_gui::dto::AlertRuleType::SeverityThreshold,
                    };
                    let detection_types: Vec<String> =
                        serde_json::from_str(&s.detection_types).unwrap_or_default();
                    let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
                        .map(|dt| dt.with_timezone(&chrono::Utc))
                        .unwrap_or_else(|_| chrono::Utc::now());

                    Some(agent_gui::dto::AlertRule {
                        id,
                        name: s.name.clone(),
                        rule_type,
                        severity_threshold,
                        detection_types,
                        escalation_minutes: s.escalation_minutes.map(|v| v as u32),
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

        // Also load risks from SQLite so the Risks page is populated at startup
        let risk_repo = agent_storage::repositories::grc::RiskRepository::new(db);
        if let Ok(stored_risks) = risk_repo.get_all().await {
            let gui_risks: Vec<agent_gui::dto::RiskEntry> = stored_risks
                .iter()
                .filter_map(|s| {
                    let id = uuid::Uuid::parse_str(&s.id).ok()?;
                    let created_at = chrono::DateTime::parse_from_rfc3339(&s.created_at)
                        .map(|dt| dt.with_timezone(&chrono::Utc))
                        .unwrap_or_else(|_| chrono::Utc::now());
                    let updated_at = chrono::DateTime::parse_from_rfc3339(&s.updated_at)
                        .map(|dt| dt.with_timezone(&chrono::Utc))
                        .unwrap_or_else(|_| chrono::Utc::now());
                    let status = match s.status.as_str() {
                        "mitigating" => agent_gui::dto::RiskStatus::Mitigating,
                        "accepted" => agent_gui::dto::RiskStatus::Accepted,
                        "closed" => agent_gui::dto::RiskStatus::Closed,
                        _ => agent_gui::dto::RiskStatus::Open,
                    };
                    Some(agent_gui::dto::RiskEntry {
                        id,
                        title: s.title.clone(),
                        description: s.description.clone(),
                        probability: s.probability.clamp(1, 5) as u8,
                        impact: s.impact.clamp(1, 5) as u8,
                        owner: s.owner.clone(),
                        status,
                        mitigation: s.mitigation.clone(),
                        source: s.source.clone(),
                        created_at,
                        updated_at,
                        sla_target_days: s.sla_target_days.map(|v| v as u32),
                    })
                })
                .collect();

            if !gui_risks.is_empty() {
                info!("Loaded {} risk(s) from SQLite into GUI", gui_risks.len());
                self.emit_gui_event(agent_gui::events::AgentEvent::RisksLoaded {
                    risks: gui_risks,
                });
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
        let first_seen = chrono::DateTime::parse_from_rfc3339(&s.first_seen)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let last_seen = chrono::DateTime::parse_from_rfc3339(&s.last_seen)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let criticality = match s.criticality.as_str() {
            "critical" | "Critical" => agent_gui::dto::AssetCriticality::Critical,
            "high" | "High" => agent_gui::dto::AssetCriticality::High,
            "low" | "Low" => agent_gui::dto::AssetCriticality::Low,
            _ => agent_gui::dto::AssetCriticality::Medium,
        };
        let lifecycle = match s.lifecycle.as_str() {
            "unauthorized" | "Unauthorized" => agent_gui::dto::AssetLifecycle::Unauthorized,
            "qualified" | "Qualified" => agent_gui::dto::AssetLifecycle::Qualified,
            "monitored" | "Monitored" => agent_gui::dto::AssetLifecycle::Monitored,
            "decommissioned" | "Decommissioned" => agent_gui::dto::AssetLifecycle::Decommissioned,
            _ => agent_gui::dto::AssetLifecycle::Discovered,
        };
        agent_gui::dto::ManagedAsset {
            id,
            ip: s.ip.clone(),
            hostname: s.hostname.clone(),
            mac: s.mac.clone(),
            vendor: s.vendor.clone(),
            device_type: s.device_type.clone(),
            criticality,
            lifecycle,
            tags: serde_json::from_str(&s.tags).unwrap_or_default(),
            risk_score: s.risk_score as f32,
            vulnerability_count: s.vulnerability_count as u32,
            open_ports: serde_json::from_str(&s.open_ports).unwrap_or_default(),
            software: serde_json::from_str(&s.software).unwrap_or_default(),
            first_seen,
            last_seen,
        }
    }

    /// Build a `ManagedAsset` representing the host machine where the agent runs.
    #[cfg(feature = "gui")]
    fn build_host_asset(&self) -> agent_gui::dto::ManagedAsset {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        // Detect primary local IP address
        let ip = Self::detect_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());

        // Detect OS type for device_type
        let device_type = if cfg!(target_os = "macos") {
            "macOS".to_string()
        } else if cfg!(target_os = "windows") {
            "Windows".to_string()
        } else {
            "Linux".to_string()
        };

        let sys = crate::resources::get_system_resources();
        let ram_gb = sys.memory_total_bytes / (1024 * 1024 * 1024);
        let disk_gb = sys.disk_total_bytes / (1024 * 1024 * 1024);

        let now = chrono::Utc::now();
        agent_gui::dto::ManagedAsset {
            id: uuid::Uuid::new_v4(),
            ip,
            hostname: Some(hostname),
            mac: None,
            vendor: None,
            device_type,
            criticality: agent_gui::dto::AssetCriticality::High,
            lifecycle: agent_gui::dto::AssetLifecycle::Monitored,
            tags: vec![
                "agent-hôte".to_string(),
                format!("RAM {}Go", ram_gb),
                format!("Disque {}Go", disk_gb),
            ],
            risk_score: 0.0,
            vulnerability_count: 0,
            open_ports: Vec::new(),
            software: Vec::new(),
            first_seen: now,
            last_seen: now,
        }
    }

    /// Detect the primary local IP address (non-loopback).
    #[cfg(feature = "gui")]
    fn detect_local_ip() -> Option<String> {
        // Use a UDP socket trick to find the primary outbound interface IP.
        // Connect to a public DNS (doesn't actually send data).
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
        socket.connect("8.8.8.8:53").ok()?;
        let addr = socket.local_addr().ok()?;
        Some(addr.ip().to_string())
    }
}
