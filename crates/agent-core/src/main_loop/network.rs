// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network collection and detection stages of the main loop.

#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use tracing::{info, warn};

use super::outbox::Outbound;
use super::{LoopPass, LoopState};
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

    /// Collect the static network information (interfaces, routes, DNS)
    /// when its interval has passed, and upload it. Skipped when paused or
    /// without the platform's consent.
    pub(crate) async fn network_static_stage(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
        network_allowed: bool,
    ) {
        if !pass.is_paused
            && network_allowed
            && st.last_network_static.elapsed() >= st.network_static_interval
        {
            pass.is_active = true;
            match self.run_network_collection().await {
                Ok(snapshot) => {
                    #[cfg(feature = "gui")]
                    {
                        self.emit_gui_event(AgentEvent::NetworkUpdate {
                            interfaces_count: u32::try_from(snapshot.interfaces.len())
                                .unwrap_or(u32::MAX),
                            connections_count: u32::try_from(snapshot.connections.len())
                                .unwrap_or(u32::MAX),
                            alerts_count: st.gui.last_network_alert_count,
                            primary_ip: snapshot.primary_ip.clone(),
                            primary_mac: snapshot.primary_mac.clone(),
                        });
                        let (interfaces, connections) = Self::snapshot_to_gui_network(&snapshot);
                        self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                            interfaces,
                            connections,
                        });
                    }
                    self.outbox
                        .push(Outbound::NetworkSnapshot {
                            snapshot: Box::new(snapshot),
                            what: "network snapshot",
                        })
                        .await;
                }
                Err(e) => {
                    warn!("Network static collection failed: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: None,
                        error: Some(format!("Network static collection error: {}", e)),
                    });
                }
            }
            st.last_network_static = std::time::Instant::now();
            let mut network_manager = self.network_manager.write().await;
            st.network_static_interval = network_manager.next_static_interval();
        }
    }

    /// Collect the active connections when their interval has passed, and
    /// upload them. Skipped when paused or without the platform's consent.
    pub(crate) async fn network_connections_stage(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
        network_allowed: bool,
    ) {
        if !pass.is_paused
            && network_allowed
            && st.last_network_connections.elapsed() >= st.network_connection_interval
        {
            pass.is_active = true;
            match self.run_network_collection().await {
                Ok(snapshot) => {
                    #[cfg(feature = "gui")]
                    {
                        self.emit_gui_event(AgentEvent::NetworkUpdate {
                            interfaces_count: u32::try_from(snapshot.interfaces.len())
                                .unwrap_or(u32::MAX),
                            connections_count: u32::try_from(snapshot.connections.len())
                                .unwrap_or(u32::MAX),
                            alerts_count: st.gui.last_network_alert_count,
                            primary_ip: snapshot.primary_ip.clone(),
                            primary_mac: snapshot.primary_mac.clone(),
                        });
                        let (interfaces, connections) = Self::snapshot_to_gui_network(&snapshot);
                        self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                            interfaces,
                            connections,
                        });
                    }
                    self.outbox
                        .push(Outbound::NetworkSnapshot {
                            snapshot: Box::new(snapshot),
                            what: "network connections",
                        })
                        .await;
                }
                Err(e) => {
                    warn!("Network connection collection failed: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: None,
                        error: Some(format!("Network connection collection error: {}", e)),
                    });
                }
            }
            st.last_network_connections = std::time::Instant::now();
            let mut network_manager = self.network_manager.write().await;
            st.network_connection_interval = network_manager.next_connection_interval();
        }
    }

    /// Run the network detection when its interval has passed: the alerts
    /// are shown, uploaded and handed to the threat pipeline of this pass
    /// with the connections observed. Skipped when paused or without the
    /// platform's consent.
    pub(crate) async fn network_security_stage(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
        network_allowed: bool,
    ) {
        if !pass.is_paused
            && network_allowed
            && st.last_network_security.elapsed() >= st.network_security_interval
        {
            pass.is_active = true;
            match self.run_network_collection().await {
                Ok(snapshot) => {
                    pass.observed.add_connections(&snapshot.connections);
                    #[cfg(feature = "gui")]
                    let mut alert_count: u32 = 0;
                    match self.run_network_security_detection(&snapshot).await {
                        Ok(alerts) => {
                            #[cfg(feature = "gui")]
                            {
                                alert_count = u32::try_from(alerts.len()).unwrap_or(u32::MAX);
                            }
                            #[cfg(feature = "gui")]
                            for alert in &alerts {
                                self.emit_network_security_alert_to_gui(alert);
                            }
                            if !alerts.is_empty() {
                                self.outbox
                                    .push(Outbound::NetworkAlerts(alerts.clone()))
                                    .await;
                            }

                            // Accumulate network alerts for threat pipeline
                            pass.network_alerts.extend(alerts.iter().cloned());
                        }
                        Err(e) => {
                            warn!("Network security detection failed: {}", e);
                        }
                    }
                    #[cfg(feature = "gui")]
                    {
                        st.gui.last_network_alert_count = alert_count;
                        self.emit_gui_event(AgentEvent::NetworkUpdate {
                            interfaces_count: u32::try_from(snapshot.interfaces.len())
                                .unwrap_or(u32::MAX),
                            connections_count: u32::try_from(snapshot.connections.len())
                                .unwrap_or(u32::MAX),
                            alerts_count: alert_count,
                            primary_ip: snapshot.primary_ip.clone(),
                            primary_mac: snapshot.primary_mac.clone(),
                        });
                        let (interfaces, connections) = Self::snapshot_to_gui_network(&snapshot);
                        self.emit_gui_event(AgentEvent::NetworkDetailUpdate {
                            interfaces,
                            connections,
                        });
                    }
                }
                Err(e) => {
                    warn!("Network collection for security scan failed: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_gui_event(AgentEvent::SyncStatus {
                        syncing: false,
                        pending_count: 0,
                        last_sync_at: None,
                        error: Some(format!("Network security scan collection error: {}", e)),
                    });
                }
            }
            st.last_network_security = std::time::Instant::now();
            let mut network_manager = self.network_manager.write().await;
            st.network_security_interval = network_manager.next_security_interval();
        }
    }
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    use crate::main_loop::{LoopPass, LoopState};
    use std::sync::atomic::Ordering;
    use std::time::{Duration, Instant};

    /// A state whose three network collections are overdue.
    fn overdue() -> (LoopState, Instant) {
        let started = Instant::now() - Duration::from_secs(3600);
        (LoopState::starting_at(started, 6 * 3600, 3600), started)
    }

    #[tokio::test]
    async fn connection_collection_needs_consent_and_a_running_agent() {
        let test = standalone_runtime();
        let (mut st, started) = overdue();

        let mut pass = LoopPass::new(false);
        test.runtime
            .network_connections_stage(&mut st, &mut pass, false)
            .await;
        let mut paused = LoopPass::new(true);
        test.runtime
            .network_connections_stage(&mut st, &mut paused, true)
            .await;

        assert!(!pass.is_active && !paused.is_active);
        assert_eq!(st.last_network_connections, started);
    }

    #[tokio::test]
    async fn network_detection_needs_consent_and_a_running_agent() {
        let test = standalone_runtime();
        let (mut st, started) = overdue();

        let mut pass = LoopPass::new(false);
        test.runtime
            .network_security_stage(&mut st, &mut pass, false)
            .await;
        let mut paused = LoopPass::new(true);
        test.runtime
            .network_security_stage(&mut st, &mut paused, true)
            .await;

        assert!(!pass.is_active && !paused.is_active);
        assert!(pass.network_alerts.is_empty() && pass.observed.is_empty());
        assert_eq!(st.last_network_security, started);
    }

    #[tokio::test]
    async fn static_collection_needs_consent_and_a_running_agent() {
        let test = standalone_runtime();
        let (mut st, started) = overdue();

        let mut pass = LoopPass::new(false);
        test.runtime
            .network_static_stage(&mut st, &mut pass, false)
            .await;
        assert!(!pass.is_active);

        let mut paused = LoopPass::new(true);
        test.runtime
            .network_static_stage(&mut st, &mut paused, true)
            .await;
        assert!(!paused.is_active);
        // The timer is left as it was, so collection resumes at once.
        assert_eq!(st.last_network_static, started);
    }

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
