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
    }
}
