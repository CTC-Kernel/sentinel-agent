// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network discovery asked for from the interface: a scan of the subnet of
//! the primary IPv4 address, run in its own task.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use agent_gui::dto::GuiDiscoveredDevice;
use agent_gui::events::AgentEvent;
use agent_network::{DiscoveryConfig, NetworkDiscovery};
use tracing::{info, warn};

use crate::{AgentRuntime, network_ops};

impl AgentRuntime {
    /// Start the network discovery the operator asked for: only the subnet
    /// of the primary IPv4 address is scanned, in a task of its own.
    pub(crate) async fn forced_discovery_stage(&self) {
        if self.state.force_discovery.swap(false, Ordering::AcqRel) {
            info!("Network discovery scan triggered");
            let cancel = self.state.discovery_cancel.clone();

            if let Some(ref tx) = self.gui_event_tx {
                let tx = tx.clone();
                let db_clone = self.db.clone();
                let sync_client = self.authenticated_client.clone();

                // Only the subnet of the primary IPv4 address is scanned:
                // never a guessed range.
                let subnet = if self.state.network_monitoring_enabled() {
                    let network_manager = self.network_manager.read().await;
                    match network_manager.collect_snapshot().await {
                        Ok(snapshot) => {
                            let subnet =
                                network_ops::discovery_subnet(snapshot.primary_ip.as_deref());
                            if subnet.is_none() {
                                warn!(
                                    "Network discovery aborted: no primary IPv4 address \
                                     (primary IP: {:?})",
                                    snapshot.primary_ip
                                );
                            }
                            subnet.ok_or("Aucune adresse IPv4 principale : découverte annulée")
                        }
                        Err(e) => {
                            warn!(
                                "Network discovery aborted: network information unavailable: {}",
                                e
                            );
                            Err("Informations réseau indisponibles : découverte annulée")
                        }
                    }
                } else {
                    info!("Network discovery skipped: network monitoring disabled by the platform");
                    Err("Découverte réseau désactivée par la politique de la plateforme")
                };

                match subnet {
                    Err(reason) => {
                        if let Err(e) = tx.send(AgentEvent::DiscoveryProgress {
                            phase: reason.to_string(),
                            progress: 0.0,
                            devices_found: 0,
                        }) {
                            warn!("Failed to send discovery progress: {}", e);
                        }
                    }
                    Ok(subnet) => {
                        tokio::spawn(async move {
                            let config = DiscoveryConfig::default();
                            let discovery = NetworkDiscovery::new(config);

                            let disc_cancel = discovery.cancel_handle();
                            let cancel_watcher = cancel.clone();
                            let done = Arc::new(AtomicBool::new(false));
                            let done_watcher = done.clone();
                            tokio::spawn(async move {
                                loop {
                                    if done_watcher.load(Ordering::Relaxed) {
                                        break;
                                    }
                                    if cancel_watcher.load(Ordering::Relaxed) {
                                        disc_cancel.store(true, Ordering::Relaxed);
                                        break;
                                    }
                                    tokio::time::sleep(tokio::time::Duration::from_millis(200))
                                        .await;
                                }
                            });

                            if let Err(e) = tx.send(AgentEvent::DiscoveryProgress {
                                phase: "Scan ARP en cours...".to_string(),
                                progress: 0.1,
                                devices_found: 0,
                            }) {
                                warn!("Failed to send discovery progress: {}", e);
                            }

                            let scan_result = discovery.scan(&subnet).await;
                            done.store(true, Ordering::Relaxed);
                            match scan_result {
                                Ok(result) => {
                                    let devices: Vec<GuiDiscoveredDevice> = result
                                        .devices
                                        .iter()
                                        .map(|d| GuiDiscoveredDevice {
                                            ip: d.ip.clone(),
                                            mac: d.mac.clone(),
                                            hostname: d.hostname.clone(),
                                            vendor: d.vendor.clone(),
                                            device_type: format!("{}", d.device_type),
                                            open_ports: d.open_ports.clone(),
                                            first_seen: d.first_seen,
                                            last_seen: d.last_seen,
                                            is_gateway: d.is_gateway,
                                            subnet: d.subnet.clone(),
                                        })
                                        .collect();
                                    info!(
                                        "Discovery complete: {} devices in {}ms",
                                        devices.len(),
                                        result.scan_duration_ms
                                    );

                                    if let Some(ref db) = db_clone {
                                        let repo = agent_storage::repositories::DiscoveredDevicesRepository::new(db);
                                        let stored: Vec<agent_storage::repositories::StoredDevice> =
                                            devices
                                                .iter()
                                                .map(|d| {
                                                    agent_storage::repositories::StoredDevice {
                                                        ip: d.ip.clone(),
                                                        mac: d.mac.clone(),
                                                        hostname: d.hostname.clone(),
                                                        vendor: d.vendor.clone(),
                                                        device_type: d.device_type.clone(),
                                                        open_ports: d.open_ports.clone(),
                                                        first_seen: d.first_seen,
                                                        last_seen: d.last_seen,
                                                        is_gateway: d.is_gateway,
                                                        subnet: d.subnet.clone(),
                                                    }
                                                })
                                                .collect();
                                        if let Err(e) = repo.upsert_batch(&stored).await {
                                            warn!("Failed to persist discovered devices: {}", e);
                                        } else {
                                            info!(
                                                "Persisted {} discovered devices to database",
                                                stored.len()
                                            );
                                        }
                                    }

                                    // Sync discovered devices to the platform
                                    if let Some(ref client) = sync_client {
                                        let payloads: Vec<agent_sync::DiscoveredAssetPayload> =
                                            devices
                                                .iter()
                                                .map(|d| agent_sync::DiscoveredAssetPayload {
                                                    ip: d.ip.clone(),
                                                    hostname: d.hostname.clone(),
                                                    mac_address: d.mac.clone(),
                                                    vendor: d.vendor.clone(),
                                                    device_type: Some(d.device_type.to_string()),
                                                    open_ports: d.open_ports.clone(),
                                                    is_gateway: Some(d.is_gateway),
                                                    subnet: Some(d.subnet.clone()),
                                                    first_seen: Some(d.first_seen),
                                                    last_seen: Some(d.last_seen),
                                                    source: Some("network_discovery".to_string()),
                                                })
                                                .collect();
                                        network_ops::upload_discovered_devices(client, &payloads)
                                            .await;
                                    }

                                    if let Err(e) = tx.send(AgentEvent::DiscoveryUpdate { devices })
                                    {
                                        warn!("Failed to send discovery update: {}", e);
                                    }
                                }
                                Err(e) => {
                                    warn!("Discovery scan failed: {}", e);
                                    if let Err(e2) = tx.send(AgentEvent::DiscoveryProgress {
                                        phase: format!("Erreur: {}", e),
                                        progress: 0.0,
                                        devices_found: 0,
                                    }) {
                                        warn!("Failed to send discovery error progress: {}", e2);
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}
