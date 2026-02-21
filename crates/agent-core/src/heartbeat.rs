//! Heartbeat communication and server command processing.

use agent_common::constants::AGENT_VERSION;
use agent_common::error::CommonError;
use crate::api_client::HeartbeatRequest;
use crate::system_utils::get_os_version;
use std::sync::atomic::Ordering;
use tracing::{error, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Send a heartbeat to the server with real compliance data.
    ///
    /// Processes the server response: commands, config/rules sync triggers.
    pub(crate) async fn send_heartbeat(
        &self,
        compliance_score: Option<f64>,
        last_compliance_check: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), CommonError> {
        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let usage = self.resource_monitor.get_usage();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let pending_sync_count = self.get_pending_sync_count().await as u32;

        let sys_res = crate::resources::get_system_resources();
        let processes = self.resource_monitor.get_processes();
        let connections = self.resource_monitor.get_connections();

        // Get total network bytes since boot
        let network_bytes = {
            match self.resource_monitor.get_networks().lock() {
                Ok(networks) => networks
                    .values()
                    .map(|data| (data.transmitted(), data.received()))
                    .fold((0, 0), |acc, (t, r)| (acc.0 + t, acc.1 + r)),
                Err(e) => {
                    warn!("Failed to lock network monitor (mutex poisoned): {}", e);
                    (0, 0)
                }
            }
        };

        // Check module status for self_check_result
        let fim_status = if let Some(engine) = self.fim_engine.read().await.as_ref() {
            if engine.is_running() { "active" } else { "inactive" }
        } else {
            "not_configured"
        };

        let siem_status = if let Some(forwarder) = self.siem_forwarder.read().await.as_ref() {
            if forwarder.is_enabled() { "active" } else { "inactive" }
        } else {
            "not_configured"
        };

        let self_check_result = Some(serde_json::json!({
            "fim_engine": { "status": fim_status },
            "siem_forwarder": { "status": siem_status }
        }));

        let request = HeartbeatRequest {
            timestamp: chrono::Utc::now().to_rfc3339(),
            agent_version: AGENT_VERSION.to_string(),
            status: "online".to_string(),
            hostname,
            os_info: format!("{} {}", std::env::consts::OS, get_os_version()),
            cpu_percent: usage.cpu_percent,
            memory_bytes: usage.memory_bytes,
            memory_percent: sys_res.memory_percent,
            memory_total_bytes: sys_res.memory_total_bytes,
            disk_percent: sys_res.disk_percent,
            disk_used_bytes: sys_res.disk_used_bytes,
            disk_total_bytes: sys_res.disk_total_bytes,
            disk_io_kbps: usage.disk_kbps,
            network_bytes_sent: network_bytes.0,
            network_bytes_recv: network_bytes.1,
            uptime_seconds: usage.uptime_ms / 1000,
            ip_address: None,
            last_check_at: last_compliance_check.map(|dt| dt.to_rfc3339()),
            compliance_score,
            pending_sync_count,
            self_check_result,
            processes,
            connections,
        };

        let response = client.send_heartbeat(request).await?;

        // Update organization name if returned
        if let Some(ref org_name) = response.organization_name {
            let mut current_org = self.organization_name.write().await;
            if current_org.as_ref() != Some(org_name) {
                info!("Organization name updated: {:?}", org_name);
                *current_org = Some(org_name.clone());
            }
        }

        // Update last sync timestamp
        {
            let mut last_sync = self.last_sync_at.write().await;
            let now = chrono::Utc::now();
            *last_sync = Some(now);

            #[cfg(feature = "gui")]
            self.emit_gui_event(agent_gui::events::AgentEvent::StatusChanged {
                summary: agent_gui::dto::AgentSummary {
                    status: if self.is_paused() {
                        agent_gui::dto::GuiAgentStatus::Paused
                    } else if self.state.scanning.load(Ordering::Acquire) {
                        agent_gui::dto::GuiAgentStatus::Scanning
                    } else {
                        agent_gui::dto::GuiAgentStatus::Connected
                    },
                    version: AGENT_VERSION.to_string(),
                    hostname: hostname::get()
                        .map(|h| h.to_string_lossy().to_string())
                        .unwrap_or_else(|_| "unknown".to_string()),
                    agent_id: self.config.agent_id.clone(),
                    organization: self.organization_name.try_read().ok().and_then(|g| g.clone()),
                    compliance_score: compliance_score.map(|s| s as f32),
                    last_check_at: last_compliance_check,
                    last_sync_at: Some(now),
                    pending_sync_count,
                    uptime_secs: usage.uptime_ms / 1000,
                    active_frameworks: self
                        .active_frameworks
                        .read()
                        .unwrap_or_else(|e| e.into_inner())
                        .clone(),
                    policy_summary: None,
                }
            });

            #[cfg(feature = "gui")]
            self.emit_gui_event(agent_gui::events::AgentEvent::SyncStatus {
                syncing: false,
                pending_count: pending_sync_count,
                last_sync_at: Some(now),
                error: None,
            });
        }

        // Process server commands
        if !response.commands.is_empty() {
            let command_results = self.command_results.read().await;
            if let Some(ref service) = *command_results {
                for cmd in &response.commands {
                    if !cmd.is_valid() {
                        warn!(
                            "Rejecting unknown/disallowed server command type '{}' (id={})",
                            cmd.command_type, cmd.id
                        );
                        if let Err(e) = service
                            .report_failure(
                                &cmd.id,
                                "Unknown or disallowed command type".to_string(),
                            )
                            .await
                        {
                            error!("Failed to report command rejection to server: {}", e);
                        }
                        continue;
                    }

                    info!(
                        "Processing server command: {} (id={})",
                        cmd.command_type, cmd.id
                    );
                    let result = match cmd.command_type.as_str() {
                        "force_sync" => {
                            self.state.force_sync.store(true, Ordering::Release);
                            service
                                .report_success(&cmd.id, Some("Sync triggered".to_string()))
                                .await
                        }
                        "run_checks" => {
                            self.state.force_check.store(true, Ordering::Release);
                            service
                                .report_success(
                                    &cmd.id,
                                    Some("Compliance scan triggered".to_string()),
                                )
                                .await
                        }
                        "revoke" => {
                            warn!("Server command: revoke agent credentials ({})", cmd.id);
                            self.request_shutdown();
                            service
                                .report_success(&cmd.id, Some("Shutdown initiated".to_string()))
                                .await
                        }
                        "diagnostics" => {
                            info!("Server command: diagnostics ({})", cmd.id);
                            let usage = self.resource_monitor.get_usage();
                            let sys = crate::resources::get_system_resources();
                            let fim_status = if let Some(engine) = self.fim_engine.read().await.as_ref() {
                                if engine.is_running() { "active" } else { "inactive" }
                            } else {
                                "not_configured"
                            };
                            let siem_status = if let Some(fwd) = self.siem_forwarder.read().await.as_ref() {
                                if fwd.is_enabled() { "active" } else { "inactive" }
                            } else {
                                "not_configured"
                            };
                            let diagnostics = serde_json::json!({
                                "system": {
                                    "hostname": hostname::get().map(|h| h.to_string_lossy().to_string()).unwrap_or_default(),
                                    "os": format!("{} {}", std::env::consts::OS, get_os_version()),
                                    "arch": std::env::consts::ARCH,
                                    "cpu_percent": sys.cpu_percent,
                                    "memory_percent": sys.memory_percent,
                                    "memory_total_mb": sys.memory_total_bytes / (1024 * 1024),
                                    "disk_percent": sys.disk_percent,
                                },
                                "agent": {
                                    "version": AGENT_VERSION,
                                    "uptime_secs": usage.uptime_ms / 1000,
                                    "paused": self.is_paused(),
                                    "scanning": self.state.scanning.load(Ordering::Acquire),
                                    "check_interval_secs": self.state.get_check_interval(),
                                },
                                "modules": {
                                    "fim": fim_status,
                                    "siem": siem_status,
                                    "enrolled": self.authenticated_client.is_some(),
                                },
                            });
                            service
                                .report_success(
                                    &cmd.id,
                                    Some(diagnostics.to_string()),
                                )
                                .await
                        }
                        "update" => {
                            info!("Server command: update ({})", cmd.id);
                            self.state.force_update.store(true, Ordering::Release);
                            service
                                .report_success(&cmd.id, Some("Update triggered".to_string()))
                                .await
                        }
                        other => {
                            warn!("Unknown server command: {} ({})", other, cmd.id);
                            service
                                .report_failure(&cmd.id, format!("Unknown command: {}", other))
                                .await
                        }
                    };

                    if let Err(e) = result {
                        warn!("Failed to report command result for {}: {}", cmd.id, e);
                    }
                }
            } else {
                warn!("Received commands but CommandResultsService is not initialized");
            }
        }

        // React to config changes
        if response.config_changed {
            info!("Server indicates configuration has changed, syncing...");
            self.apply_config_changes().await;
        }

        // React to rules changes
        if response.rules_changed {
            info!("Server indicates rules have changed, syncing...");
            let rule_sync = self.rule_sync.read().await;
            if let Some(ref rule_sync) = *rule_sync {
                match rule_sync.sync_rules().await {
                    Ok(result) => info!("Rule sync complete: {} rules synced", result.rules_synced),
                    Err(e) => warn!("Rule sync failed: {}", e),
                }
            }
        }

        Ok(())
    }
}
