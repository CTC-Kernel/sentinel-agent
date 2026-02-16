//! Sync service initialization and configuration management.

use agent_sync::{
    AuditSyncService, CommandResultsService, ConfigSyncService, ResultUploader, RuleSyncService,
};
use tracing::{debug, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Initialize sync services after enrollment is verified.
    pub(crate) async fn init_sync_services(&self) {
        let (db, auth_client) = match (&self.db, &self.authenticated_client) {
            (Some(db), Some(client)) => (db.clone(), client.clone()),
            _ => {
                debug!(
                    "Database or authenticated client not available, skipping sync service init"
                );
                return;
            }
        };

        // Initialize config sync
        let config_sync = ConfigSyncService::new(auth_client.clone(), db.clone());
        *self.config_sync.write().await = Some(config_sync);

        // Initialize rule sync
        let rule_sync = RuleSyncService::new(auth_client.clone(), db.clone());
        *self.rule_sync.write().await = Some(rule_sync);

        // Initialize result uploader
        let result_uploader = ResultUploader::new(auth_client.clone(), db.clone());
        *self.result_uploader.write().await = Some(result_uploader);

        // Initialize audit sync
        let audit_sync = AuditSyncService::new(auth_client.clone(), db.clone());
        *self.audit_sync.write().await = Some(audit_sync);

        // Initialize command results service
        let command_results = CommandResultsService::new(auth_client.clone());
        *self.command_results.write().await = Some(command_results);

        info!("Initialized sync services (config, rules, results, audit, commands)");

        // Seed built-in check rules so the FK constraint is satisfied
        self.seed_builtin_check_rules().await;

        // Initial rule sync (will overwrite built-in rules with server versions)
        if let Some(ref rule_sync) = *self.rule_sync.read().await {
            match rule_sync.sync_if_needed().await {
                Ok(result) => info!(
                    "Initial rule sync: {} rules synced (cache_hit: {})",
                    result.rules_synced, result.cache_hit
                ),
                Err(e) => warn!("Initial rule sync failed: {}", e),
            }
        }
    }

    /// Apply configuration changes received from the server.
    pub(crate) async fn apply_config_changes(&self) {
        let config_sync = self.config_sync.read().await;
        if let Some(ref config_sync) = *config_sync {
            match config_sync.sync_config().await {
                Ok(result) => {
                    if result.changed {
                        info!(
                            "Config sync: {} added, {} updated, {} skipped",
                            result.added, result.updated, result.skipped
                        );

                        // Apply heartbeat interval change if present
                        if let Ok(Some(interval)) = config_sync
                            .get_config::<u64>(agent_sync::config_keys::HEARTBEAT_INTERVAL_SECS)
                            .await
                        {
                            let interval = interval.clamp(15, 3600);
                            let mut current = self.heartbeat_interval_secs.write().await;
                            if *current != interval {
                                info!("Heartbeat interval updated: {}s → {}s", *current, interval);
                                *current = interval;
                            }
                        }

                        // Apply active frameworks change if present
                        if let Ok(Some(frameworks)) = config_sync
                            .get_config::<Vec<String>>(agent_sync::config_keys::ACTIVE_FRAMEWORKS)
                            .await
                        {
                            let mut current = self
                                .active_frameworks
                                .write()
                                .unwrap_or_else(|e| e.into_inner());
                            if current.as_ref() != Some(&frameworks) {
                                info!(
                                    "Active frameworks updated: {:?} → {:?}",
                                    current, frameworks
                                );
                                *current = Some(frameworks);
                            }
                        }

                        // Apply FIM config changes
                        if let Ok(Some(fim_config)) = config_sync
                            .get_config::<agent_fim::FimConfig>(agent_sync::config_keys::FIM_CONFIG)
                            .await
                        {
                            let mut guard = self.fim_engine.write().await;
                            if let Some(fim_engine) = guard.as_mut() {
                                if fim_engine.update_config(fim_config.clone()).await.is_ok() {
                                    info!("FIM engine configuration updated.");
                                } else {
                                    warn!("Failed to update FIM engine configuration.");
                                }
                            }
                        }

                        // Apply SIEM config changes
                        if let Ok(Some(siem_config)) = config_sync
                            .get_config::<agent_siem::SiemConfig>(agent_sync::config_keys::SIEM_CONFIG)
                            .await
                        {
                            let mut siem_forwarder_guard = self.siem_forwarder.write().await;
                            if let Some(ref mut siem_forwarder) = *siem_forwarder_guard {
                                if siem_forwarder.update_config(siem_config.clone()).is_ok() {
                                    info!("SIEM forwarder configuration updated.");
                                } else {
                                    warn!("Failed to update SIEM forwarder configuration.");
                                }
                            }
                        }

                    } else {
                        debug!("Config sync: no changes");
                    }
                }
                Err(e) => warn!("Config sync failed: {}", e),
            }
        }
    }

    /// Get the count of pending sync items for the heartbeat.
    pub(crate) async fn get_pending_sync_count(&self) -> i64 {
        let uploader = self.result_uploader.read().await;
        if let Some(ref uploader) = *uploader {
            uploader.pending_count().await.unwrap_or(0)
        } else {
            0
        }
    }
}
