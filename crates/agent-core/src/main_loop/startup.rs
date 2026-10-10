// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the agent sets up once, before the first pass of the main loop.

#[cfg(feature = "gui")]
use agent_gui::dto::GuiDiscoveredDevice;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_storage::repositories::StoredDevice;
#[cfg(feature = "gui")]
use tracing::{debug, info, warn};

use crate::AgentRuntime;

/// A device of the last network discovery, as the interface shows it.
#[cfg(feature = "gui")]
fn gui_device(stored: StoredDevice) -> GuiDiscoveredDevice {
    GuiDiscoveredDevice {
        ip: stored.ip,
        mac: stored.mac,
        hostname: stored.hostname,
        vendor: stored.vendor,
        device_type: stored.device_type,
        open_ports: stored.open_ports,
        first_seen: stored.first_seen,
        last_seen: stored.last_seen,
        is_gateway: stored.is_gateway,
        subnet: stored.subnet,
    }
}

impl AgentRuntime {
    /// Show the devices of the last network discovery, kept in the database.
    #[cfg(feature = "gui")]
    pub(crate) async fn load_cached_discovery(&self) {
        if let Some(ref db) = self.db {
            let repo = agent_storage::repositories::DiscoveredDevicesRepository::new(db);
            match repo.get_all().await {
                Ok(stored) if !stored.is_empty() => {
                    let devices: Vec<GuiDiscoveredDevice> =
                        stored.into_iter().map(gui_device).collect();
                    info!(
                        "Loaded {} cached discovered devices from database",
                        devices.len()
                    );
                    self.emit_gui_event(AgentEvent::DiscoveryUpdate { devices });
                }
                Ok(_) => {
                    debug!("No cached discovery results in database");
                }
                Err(e) => {
                    warn!("Failed to load cached discovery results: {}", e);
                }
            }
        }
    }
}

#[cfg(all(test, feature = "gui"))]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use agent_storage::repositories::DiscoveredDevicesRepository;

    fn printer() -> StoredDevice {
        let seen = chrono::DateTime::parse_from_rfc3339("2026-10-01T08:30:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        StoredDevice {
            ip: "192.168.7.20".to_string(),
            mac: Some("00:11:22:33:44:55".to_string()),
            hostname: Some("imprimante-accueil".to_string()),
            vendor: Some("Brother".to_string()),
            device_type: "printer".to_string(),
            open_ports: vec![80, 631],
            first_seen: seen,
            last_seen: seen,
            is_gateway: false,
            subnet: "192.168.7.0/24".to_string(),
        }
    }

    #[tokio::test]
    async fn cached_devices_are_shown_at_start_up() {
        let test = standalone_runtime();
        DiscoveredDevicesRepository::new(&test.db)
            .upsert_batch(&[printer()])
            .await
            .unwrap();

        test.runtime.load_cached_discovery().await;

        match test.events.try_recv() {
            Ok(AgentEvent::DiscoveryUpdate { devices }) => {
                assert_eq!(devices.len(), 1);
                assert_eq!(devices[0].ip, "192.168.7.20");
                assert_eq!(devices[0].hostname.as_deref(), Some("imprimante-accueil"));
                assert_eq!(devices[0].open_ports, vec![80, 631]);
                assert_eq!(devices[0].subnet, "192.168.7.0/24");
            }
            other => panic!("expected the cached devices, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn an_empty_cache_sends_nothing() {
        let test = standalone_runtime();
        test.runtime.load_cached_discovery().await;
        assert!(test.events.try_recv().is_err());
    }
}
