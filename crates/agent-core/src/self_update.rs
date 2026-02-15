//! Self-update management.

use agent_common::constants::AGENT_VERSION;
use agent_common::error::CommonError;
#[cfg(feature = "gui")]
use agent_common::types::UpdateStatus;
use std::sync::Arc;
use tracing::{error, info};

use super::AgentRuntime;

impl AgentRuntime {
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

                #[cfg(feature = "gui")]
                self.emit_gui_event(agent_gui::events::AgentEvent::UpdateStatusChanged {
                    status: UpdateStatus::Downloading(0.0),
                });

                if let Err(e) = update_manager.perform_update(info).await {
                    error!("Self-update failed: {}", e);
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
