// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Automatic risk generation from compliance check failures.
//! Risks are persisted to SQLite, queued for platform sync, and pushed to the GUI.

use agent_common::types::{CheckSeverity, CheckStatus};
use agent_scanner::CheckExecutionResult;
use tracing::{debug, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Auto-generate risks from failing compliance checks and queue for sync.
    ///
    /// Called after each compliance scan cycle. Generates risks for Critical/High
    /// severity failures, deduplicates by title, persists to SQLite, enqueues for
    /// platform upload, and emits GUI events so the risks page updates in real time.
    pub(crate) async fn auto_generate_risks(&self, check_results: &[CheckExecutionResult]) {
        let db = match self.db.as_ref() {
            Some(db) => db,
            None => return,
        };

        let now = chrono::Utc::now();
        let risk_repo = agent_storage::repositories::grc::RiskRepository::new(db);

        // Load existing risks to deduplicate
        let existing_risks = match risk_repo.get_all().await {
            Ok(risks) => risks,
            Err(e) => {
                warn!("Failed to load existing risks for dedup: {}", e);
                Vec::new()
            }
        };
        let existing_titles: std::collections::HashSet<String> =
            existing_risks.iter().map(|r| r.title.clone()).collect();

        let mut new_count = 0u32;
        #[cfg(feature = "gui")]
        let mut new_gui_risks: Vec<agent_gui::dto::RiskEntry> = Vec::new();

        for exec in check_results {
            if exec.result.status != CheckStatus::Fail {
                continue;
            }

            // Look up the definition for severity and name via check_registry
            let check = match self.check_registry.get(&exec.result.check_id) {
                Some(c) => c,
                None => continue,
            };
            let def = check.definition();

            // Only generate risks for Critical and High severity failures
            let (prob, impact, sla_days) = match def.severity {
                CheckSeverity::Critical => (4_u8, 5_u8, 30_u32),
                CheckSeverity::High => (3, 4, 30),
                _ => continue,
            };

            let title = format!("Contrôle défaillant : {}", def.name);
            if existing_titles.contains(&title) {
                continue;
            }

            let risk_id = uuid::Uuid::new_v4();
            let description = exec.result.message.clone().unwrap_or_else(|| {
                format!(
                    "Le contrôle {} a échoué lors du scan de conformité",
                    def.name
                )
            });

            let stored = agent_storage::repositories::grc::StoredRisk {
                id: risk_id.to_string(),
                title: title.clone(),
                description: description.clone(),
                probability: i32::from(prob),
                impact: i32::from(impact),
                owner: String::new(),
                status: "open".to_string(),
                mitigation: String::new(),
                source: "compliance".to_string(),
                created_at: now.to_rfc3339(),
                updated_at: now.to_rfc3339(),
                sla_target_days: Some(sla_days as i32),
                synced: false,
            };

            if let Err(e) = risk_repo.upsert(&stored).await {
                warn!("Failed to persist auto-generated risk: {}", e);
                continue;
            }

            // Queue for platform sync
            let payload = agent_sync::types::RiskPayload {
                id: risk_id.to_string(),
                title: title.clone(),
                description: description.clone(),
                probability: prob,
                impact,
                owner: String::new(),
                status: "open".to_string(),
                mitigation: String::new(),
                source: "compliance".to_string(),
                created_at: now,
                updated_at: Some(now),
                sla_target_days: Some(sla_days),
            };

            if let Ok(json) = serde_json::to_string(&payload) {
                let sync_repo = agent_storage::SyncQueueRepository::new(db);
                let entry = agent_storage::SyncQueueEntry::new(
                    agent_storage::SyncEntityType::Risk,
                    risk_id.to_string(),
                    json,
                );
                let _ = sync_repo.enqueue(&entry).await;
            }

            new_count += 1;

            // Collect for GUI notification
            #[cfg(feature = "gui")]
            new_gui_risks.push(agent_gui::dto::RiskEntry {
                id: risk_id,
                title,
                description,
                probability: prob,
                impact,
                owner: String::new(),
                status: agent_gui::dto::RiskStatus::Open,
                mitigation: String::new(),
                source: "compliance".to_string(),
                created_at: now,
                updated_at: now,
                sla_target_days: Some(sla_days),
            });
        }

        if new_count > 0 {
            info!(
                "Auto-generated {} new risk(s) from compliance failures",
                new_count
            );

            // Push to GUI so the risks page updates immediately
            #[cfg(feature = "gui")]
            if !new_gui_risks.is_empty() {
                self.emit_gui_event(agent_gui::events::AgentEvent::RisksLoaded {
                    risks: new_gui_risks,
                });
            }
        } else {
            debug!("No new risks to auto-generate from compliance results");
        }

        // Also load all existing risks from SQLite into GUI on first run
        #[cfg(feature = "gui")]
        {
            static INITIAL_LOAD: std::sync::atomic::AtomicBool =
                std::sync::atomic::AtomicBool::new(false);
            if !INITIAL_LOAD.swap(true, std::sync::atomic::Ordering::SeqCst)
                && let Ok(all_stored) = risk_repo.get_all().await {
                    let gui_risks: Vec<agent_gui::dto::RiskEntry> = all_stored
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
        }
    }
}
