// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! SIEM stages of the main loop: the forwarder, the OS log collector and the
//! correlation engine.

use agent_siem::SiemForwarder;
use tracing::{error, info};

use crate::AgentRuntime;

impl AgentRuntime {
    /// Create the SIEM forwarder, disabled by default. Events always reach
    /// the platform via `record_event()` and the heartbeat sync; the external
    /// transport (syslog/HTTP) is only for a third-party SIEM.
    pub(crate) async fn init_siem_forwarder(&self) {
        let config = agent_siem::SiemConfig::default();

        // Extract GUI-relevant fields before config is moved
        #[cfg(feature = "gui")]
        let siem_gui_info = {
            let format_str = match config.format {
                agent_siem::SiemFormat::Cef => "CEF",
                agent_siem::SiemFormat::Leef => "LEEF",
                agent_siem::SiemFormat::Json => "JSON",
            };
            let (transport_str, destination_str) = match &config.transport {
                agent_siem::SiemTransport::Syslog { host, port, .. } => {
                    ("Syslog".to_string(), format!("{}:{}", host, port))
                }
                agent_siem::SiemTransport::Http { url, .. } => ("HTTP".to_string(), url.clone()),
            };
            (
                config.enabled,
                format_str.to_string(),
                transport_str,
                destination_str,
            )
        };

        match SiemForwarder::new(config) {
            Ok(forwarder) => {
                #[cfg(feature = "gui")]
                {
                    let (enabled, format, transport, destination) = siem_gui_info;
                    self.emit_gui_event(agent_gui::events::AgentEvent::SiemConfigUpdate {
                        enabled,
                        format,
                        transport,
                        destination,
                    });
                }
                let mut siem_guard = self.siem_forwarder.write().await;
                *siem_guard = Some(forwarder);
                info!("SIEM forwarder initialized (disabled by default)");
            }
            Err(e) => error!("Failed to initialize SIEM forwarder: {}", e),
        }
    }

    /// Create the collector of OS event logs (Windows Event Log, syslog...)
    /// with the settings currently held by the runtime state.
    pub(crate) async fn init_log_collector(&self) {
        let collector_config = agent_siem::LogCollectorConfig {
            enabled: self
                .state
                .log_collector_enabled
                .load(std::sync::atomic::Ordering::Acquire),
            sources: vec![
                agent_siem::LogSource::System,
                agent_siem::LogSource::Auth,
                agent_siem::LogSource::Application,
                agent_siem::LogSource::Firewall,
            ],
            lookback_secs: 300,
            poll_interval_secs: self
                .state
                .log_collector_poll_secs
                .load(std::sync::atomic::Ordering::Acquire),
            ..Default::default()
        };
        let collector = agent_siem::LogCollector::new(collector_config);
        let mut guard = self.log_collector.write().await;
        *guard = Some(collector);
        info!("Log collector initialized");
    }

    /// Create the correlation engine with its default rules.
    pub(crate) async fn init_correlation_engine(&self) {
        let engine = agent_siem::CorrelationEngine::with_default_rules();
        let mut guard = self.correlation_engine.write().await;
        *guard = Some(engine);
        info!("Correlation engine initialized");
    }
}

#[cfg(test)]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    #[cfg(feature = "gui")]
    use agent_gui::events::AgentEvent;
    use std::sync::atomic::Ordering;

    #[tokio::test]
    async fn the_log_collector_follows_the_runtime_setting() {
        for enabled in [true, false] {
            let test = standalone_runtime();
            test.runtime
                .state
                .log_collector_enabled
                .store(enabled, Ordering::Release);

            test.runtime.init_log_collector().await;

            let collector = test.runtime.log_collector.read().await;
            assert_eq!(collector.as_ref().map(|c| c.is_enabled()), Some(enabled));
        }
    }

    #[tokio::test]
    async fn the_correlation_engine_is_ready_after_start_up() {
        let test = standalone_runtime();
        assert!(test.runtime.correlation_engine.read().await.is_none());

        test.runtime.init_correlation_engine().await;

        assert!(test.runtime.correlation_engine.read().await.is_some());
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn the_forwarder_starts_disabled_and_tells_the_interface() {
        let test = standalone_runtime();

        test.runtime.init_siem_forwarder().await;

        let forwarder = test.runtime.siem_forwarder.read().await;
        assert!(forwarder.as_ref().is_some_and(|siem| !siem.is_enabled()));
        match test.events.try_recv() {
            Ok(AgentEvent::SiemConfigUpdate { enabled, .. }) => assert!(!enabled),
            other => panic!(
                "expected the SIEM configuration, got {:?}",
                other.map(|_| ())
            ),
        }
    }
}
