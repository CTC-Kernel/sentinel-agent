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
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    use agent_gui::events::AgentEvent;

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
