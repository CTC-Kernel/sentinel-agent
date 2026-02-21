//! Self-update management.

use agent_common::constants::AGENT_VERSION;
use agent_common::error::CommonError;
#[cfg(feature = "gui")]
use agent_common::types::UpdateStatus;
use crate::api_client::UpdateStatusReport;
use std::sync::Arc;
use tracing::{error, info, warn};

use super::AgentRuntime;

impl AgentRuntime {
    /// Report update status to the server (fire-and-forget).
    async fn report_update(&self, status: &str, version: Option<&str>, error_msg: Option<&str>) {
        let api_client = self.api_client.read().await;
        if let Some(client) = api_client.as_ref() {
            let report = UpdateStatusReport {
                status: status.to_string(),
                version: version.map(|v| v.to_string()),
                error: error_msg.map(|e| e.to_string()),
            };
            if let Err(e) = client.report_update_status(report).await {
                warn!("Failed to report update status '{}': {}", status, e);
            }
        }
    }

    /// Run the self-update process.
    pub async fn run_self_update(&self) -> Result<(), CommonError> {
        info!("Checking for self-update...");

        // Rate limiting: prevent checking more than once every 5 minutes manually
        {
            let last_check = self.last_update_check.read().await;
            if let Some(instant) = *last_check
                && instant.elapsed().as_secs() < 300
            {
                info!("Skipping update check (rate limited)");
                return Ok(());
            }
        }

        let api_client = self.api_client.read().await;
        let client = api_client
            .as_ref()
            .ok_or_else(|| CommonError::config("API client not initialized"))?;

        let update_client = Arc::new((*client).clone());
        let update_manager =
            crate::update_manager::UpdateManager::new(update_client, AGENT_VERSION.to_string());

        // Update last check timestamp
        {
            let mut last_check = self.last_update_check.write().await;
            *last_check = Some(std::time::Instant::now());
        }

        #[cfg(feature = "gui")]
        self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
            status: UpdateStatus::Idle,
        });

        // Drop the read lock before the match so we can call report_update
        drop(api_client);

        match update_manager.check_for_update().await {
            Ok(Some(info)) => {
                info!(
                    "New version available: {}. Starting update...",
                    info.version
                );
                #[cfg(feature = "gui")]
                {
                    self.emit_notification(
                        "Mise à jour disponible",
                        &format!("Téléchargement de la version {}...", info.version),
                        "info",
                    );
                    self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                        status: UpdateStatus::Available(info.version.clone()),
                    });
                }

                info!(
                    "[AUDIT] Manual update check triggered version {} download",
                    info.version
                );

                // Report downloading status to server
                self.report_update("downloading", Some(&info.version), None).await;

                #[cfg(feature = "gui")]
                self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                    status: UpdateStatus::Downloading(0.0),
                });

                // Save version before perform_update consumes info
                let target_version = info.version.clone();

                // Report installing status to server
                self.report_update("installing", Some(&target_version), None).await;

                if let Err(e) = update_manager.perform_update(info).await {
                    error!("Self-update failed: {}", e);

                    // Report failure to server
                    self.report_update("failed", Some(&target_version), Some(&format!("{}", e))).await;

                    #[cfg(feature = "gui")]
                    {
                        self.emit_notification(
                            "Échec de la mise à jour",
                            &format!("Erreur : {}", e),
                            "error",
                        );
                        self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                            status: UpdateStatus::Failed(format!("{}", e)),
                        });
                    }
                    return Err(e);
                }

                // Report success to server
                self.report_update("completed", Some(&target_version), None).await;

                info!("Self-update initiated successfully.");
                #[cfg(feature = "gui")]
                self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                    status: UpdateStatus::Completed,
                });

                Ok(())
            }
            Ok(None) => {
                info!("Agent is already up to date.");
                #[cfg(feature = "gui")]
                {
                    self.emit_notification(
                        "Agent à jour",
                        &format!("La version v{} est la plus récente.", AGENT_VERSION),
                        "info",
                    );
                    self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                        status: UpdateStatus::UpToDate,
                    });
                }
                Ok(())
            }
            Err(e) => {
                error!("Failed to check for updates: {}", e);

                // Report failure to server
                self.report_update("failed", None, Some(&format!("{}", e))).await;

                #[cfg(feature = "gui")]
                {
                    self.emit_notification(
                        "Erreur de mise à jour",
                        &format!("Impossible de vérifier les mises à jour : {}", e),
                        "error",
                    );
                    self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                        status: UpdateStatus::Failed(format!("{}", e)),
                    });
                }
                Err(e)
            }
        }
    }
}
