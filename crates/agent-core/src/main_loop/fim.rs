// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! File integrity stage of the main loop: the alerts of the FIM engine are
//! read on every pass (security-critical even when paused), shown, handed to
//! the threat pipeline and sent in one batch.

use agent_common::constants::AGENT_VERSION;
#[cfg(feature = "gui")]
use agent_gui::dto::{FimChangeType as GuiFimChangeType, GuiFimAlert};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use tracing::{info, warn};

use super::{LoopPass, LoopState};
use crate::{AgentRuntime, api_client, siem_enrichment};

/// File changes of one pass, collected first and sent together: one request
/// per alert runs into the platform's rate limit (429).
#[derive(Default)]
pub(crate) struct FimBatch {
    /// Structured alerts for the platform.
    pub payloads: Vec<agent_sync::types::FimAlertPayload>,
    /// Files created or changed, to scan with the YARA rules.
    pub yara_candidates: Vec<String>,
    /// One incident report per alert, summarized when there are several.
    pub reports: Vec<api_client::SecurityIncidentReport>,
}

impl AgentRuntime {
    /// Read every pending alert of the FIM engine: interface, threat
    /// pipeline of this pass, SIEM. What must be uploaded is returned as a
    /// batch.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    pub(crate) async fn drain_fim_alerts(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
    ) -> FimBatch {
        let mut batch = FimBatch::default();
        {
            let mut rx_guard = self.fim_rx.lock().await;
            if let Some(rx) = rx_guard.as_mut() {
                while let Ok(alert) = rx.try_recv() {
                    info!("FIM Alert: {:?} on {}", alert.change, alert.path.display());

                    let report = api_client::SecurityIncidentReport {
                        incident_type: api_client::IncidentType::UnauthorizedChange,
                        severity: api_client::Severity::Medium,
                        title: format!("File Integrity Alert: {}", alert.path.display()),
                        description: format!(
                            "File {} was modified. Change type: {:?}.",
                            alert.path.display(),
                            alert.change
                        ),
                        evidence: serde_json::json!({
                            "path": alert.path,
                            "change_type": alert.change,
                            "old_hash": alert.old_hash,
                            "new_hash": alert.new_hash,
                            "timestamp": alert.timestamp,
                        }),
                        confidence: 100,
                        detected_at: chrono::Utc::now().to_rfc3339(),
                    };

                    #[cfg(feature = "gui")]
                    {
                        let gui_change_type = match alert.change {
                            agent_common::types::FimChangeType::Created => {
                                GuiFimChangeType::Created
                            }
                            agent_common::types::FimChangeType::Modified => {
                                GuiFimChangeType::Modified
                            }
                            agent_common::types::FimChangeType::Deleted => {
                                GuiFimChangeType::Deleted
                            }
                            agent_common::types::FimChangeType::PermissionChanged => {
                                GuiFimChangeType::PermissionChanged
                            }
                            agent_common::types::FimChangeType::Renamed => {
                                GuiFimChangeType::Renamed
                            }
                        };
                        self.emit_gui_event(AgentEvent::FimAlert {
                            alert: GuiFimAlert {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: alert.path.to_string_lossy().to_string(),
                                change_type: gui_change_type,
                                old_hash: alert.old_hash.clone(),
                                new_hash: alert.new_hash.clone(),
                                timestamp: alert.timestamp,
                                acknowledged: false,
                                allowlisted: false,
                            },
                        });
                        let today = chrono::Utc::now().timestamp().max(0) as u64
                            / agent_common::constants::SECS_PER_DAY;
                        if today != st.gui.fim_last_day {
                            st.gui.fim_changes_today = 0;
                            st.gui.fim_last_day = today;
                        }
                        st.gui.fim_changes_today = st.gui.fim_changes_today.saturating_add(1);
                    }

                    pass.fim_alerts.push((
                        alert.path.to_string_lossy().to_string(),
                        format!("{}", alert.change),
                    ));
                    if matches!(
                        alert.change,
                        agent_common::types::FimChangeType::Created
                            | agent_common::types::FimChangeType::Modified
                            | agent_common::types::FimChangeType::Renamed
                    ) {
                        batch
                            .yara_candidates
                            .push(alert.path.to_string_lossy().to_string());
                    }

                    // Collect for batched uploads (avoid per-alert HTTP requests → 429)
                    batch
                        .payloads
                        .push(agent_sync::types::FimAlertPayload::from(alert.clone()));

                    // Forward to SIEM (always record for platform, optionally send to external)
                    let siem_description = report.description.clone();
                    batch.reports.push(report);
                    let siem_guard = self.siem_forwarder.read().await;
                    if let Some(siem) = siem_guard.as_ref() {
                        let mut event = agent_siem::SiemEvent {
                            timestamp: chrono::Utc::now(),
                            severity: 5,
                            category: agent_siem::EventCategory::FileIntegrity,
                            name: "File Integrity Change".to_string(),
                            description: siem_description,
                            source_host: hostname::get()
                                .map(|h| h.to_string_lossy().to_string())
                                .unwrap_or_default(),
                            source_ip: None,
                            destination_ip: None,
                            destination_port: None,
                            user: None,
                            process_name: None,
                            process_id: None,
                            file_path: Some(alert.path.to_string_lossy().to_string()),
                            custom_fields: serde_json::Value::Null,
                            event_id: uuid::Uuid::new_v4().to_string(),
                            agent_version: AGENT_VERSION.to_string(),
                        };

                        // Enrich with AI classification before forwarding
                        #[cfg(feature = "llm")]
                        {
                            if let Some(ref llm_svc) = self.llm_service {
                                siem_enrichment::enrich_siem_event(&mut event, llm_svc).await;
                            }
                        }
                        #[cfg(not(feature = "llm"))]
                        {
                            siem_enrichment::enrich_siem_event(&mut event).await;
                        }

                        // Always record for platform SIEM tab
                        siem.record_event(event.clone()).await;

                        // Optionally forward to external SIEM
                        if siem.is_enabled()
                            && let Err(e) = siem.send_event(&event).await
                        {
                            warn!("Failed to forward FIM event to external SIEM: {}", e);
                        }
                    }
                }
            }
        }
        batch
    }
}
