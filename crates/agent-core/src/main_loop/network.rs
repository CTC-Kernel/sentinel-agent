// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network collection and detection stages of the main loop.

#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use tracing::{info, warn};

use super::LoopState;
use crate::AgentRuntime;

impl AgentRuntime {
    /// Start the network collection timers with the staggered intervals of
    /// the network manager.
    pub(crate) async fn start_network_schedule(&self, st: &mut LoopState) {
        let (network_static_interval, network_connection_interval, network_security_interval) = {
            let mut network_manager = self.network_manager.write().await;
            let static_interval = network_manager.next_static_interval();
            let conn_interval = network_manager.next_connection_interval();
            let sec_interval = network_manager.next_security_interval();
            info!(
                "Network collection intervals: static={:.0}s, connections={:.0}s, security={:.0}s",
                static_interval.as_secs_f64(),
                conn_interval.as_secs_f64(),
                sec_interval.as_secs_f64()
            );
            (static_interval, conn_interval, sec_interval)
        };

        // Initialize network timing with staggered delays
        st.start_network_schedule(
            std::time::Instant::now(),
            network_static_interval,
            network_connection_interval,
            network_security_interval,
        );
    }

    /// Collect the network state once at start-up, upload it and run the
    /// detection on it. Bounded to 30 seconds so a slow collection does not
    /// hold the main loop back.
    pub(crate) async fn run_initial_network_collection(&self) {
        if !self.state.network_monitoring_enabled() {
            info!(
                "Initial network collection skipped: network monitoring disabled by the platform"
            );
        } else {
            info!("Running initial network collection...");
            match tokio::time::timeout(
                std::time::Duration::from_secs(30),
                self.run_network_collection(),
            )
            .await
            {
                Ok(inner) => match inner {
                    Ok(snapshot) => {
                        #[cfg(feature = "gui")]
                        {
                            let (interfaces, connections) =
                                Self::snapshot_to_gui_network(&snapshot);
                            self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                                interfaces,
                                connections,
                            });
                        }
                        if let Err(e) = self.upload_network_snapshot(&snapshot).await {
                            warn!("Failed to upload initial network snapshot: {}", e);
                            #[cfg(feature = "gui")]
                            self.emit_gui_event(AgentEvent::SyncStatus {
                                syncing: false,
                                pending_count: 0,
                                last_sync_at: None,
                                error: Some(format!("Network upload failed: {}", e)),
                            });
                        }
                        // Run initial network security detection
                        match self.run_network_security_detection(&snapshot).await {
                            Ok(alerts) => {
                                #[cfg(feature = "gui")]
                                for alert in &alerts {
                                    self.emit_network_security_alert_to_gui(alert);
                                }
                                self.upload_network_alerts(&alerts).await;
                            }
                            Err(e) => warn!("Initial network security detection failed: {}", e),
                        }
                    }
                    Err(e) => warn!("Initial network collection failed: {}", e),
                },
                Err(_) => {
                    warn!("Initial network collection timed out after 30s, continuing without it")
                }
            }
        }
    }
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    use std::sync::atomic::Ordering;

    #[tokio::test]
    async fn initial_collection_is_skipped_without_the_platforms_consent() {
        let test = standalone_runtime();
        test.runtime
            .state
            .network_monitoring
            .store(false, Ordering::Release);

        test.runtime.run_initial_network_collection().await;

        // Nothing was collected: the interface received no network detail.
        assert!(test.events.try_recv().is_err());
    }
}
