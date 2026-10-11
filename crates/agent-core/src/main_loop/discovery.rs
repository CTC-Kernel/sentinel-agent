// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network discovery asked for from the interface: a scan of the subnet of
//! the primary IPv4 address, run in its own task.

use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;

use agent_gui::dto::GuiDiscoveredDevice;
use agent_gui::events::AgentEvent;
use agent_network::{DiscoveredDevice, DiscoveryConfig, DiscoveryResult, NetworkDiscovery};
use agent_storage::Database;
use agent_storage::repositories::StoredDevice;
use agent_sync::AuthenticatedClient;
use tracing::{info, warn};

use crate::supervised_tasks::TaskSet;
use crate::{AgentRuntime, network_ops};

/// Name of the background task that scans the network.
const DISCOVERY_TASK: &str = "network discovery";

/// A device found by the scan, as the interface shows it.
fn gui_device(d: &DiscoveredDevice) -> GuiDiscoveredDevice {
    GuiDiscoveredDevice {
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
    }
}

/// A discovered device as the database keeps it between two scans.
fn stored_device(d: &GuiDiscoveredDevice) -> StoredDevice {
    StoredDevice {
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
}

/// A discovered device as the platform receives it.
fn asset_payload(d: &GuiDiscoveredDevice) -> agent_sync::DiscoveredAssetPayload {
    agent_sync::DiscoveredAssetPayload {
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
    }
}

impl AgentRuntime {
    /// Start the network discovery the operator asked for: only the subnet
    /// of the primary IPv4 address is scanned, in a background task of
    /// `tasks`.
    pub(crate) async fn forced_discovery_stage(&self, tasks: &mut TaskSet) {
        if self.state.force_discovery.swap(false, Ordering::AcqRel) {
            info!("Network discovery scan triggered");
            let cancel = self.state.discovery_cancel.clone();

            if let Some(ref tx) = self.gui_event_tx {
                let tx = tx.clone();
                let db_clone = self.db.clone();
                let sync_client = self.authenticated_client.clone();

                match self.discovery_subnet().await {
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
                        tasks.spawn(
                            DISCOVERY_TASK,
                            run_discovery(subnet, cancel, tx, db_clone, sync_client),
                        );
                    }
                }
            }
        }
    }

    /// The subnet to scan, or why nothing is scanned. Only the subnet of
    /// the primary IPv4 address is scanned: never a guessed range.
    async fn discovery_subnet(&self) -> Result<String, &'static str> {
        if self.state.network_monitoring_enabled() {
            let network_manager = self.network_manager.read().await;
            match network_manager.collect_snapshot().await {
                Ok(snapshot) => {
                    let subnet = network_ops::discovery_subnet(snapshot.primary_ip.as_deref());
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
        }
    }
}

/// Scan `subnet` until done or cancelled by the operator, then keep, upload
/// and show the devices found.
async fn run_discovery(
    subnet: String,
    cancel: Arc<AtomicBool>,
    tx: Sender<AgentEvent>,
    db: Option<Arc<Database>>,
    sync_client: Option<Arc<AuthenticatedClient>>,
) {
    let config = DiscoveryConfig::default();
    let discovery = NetworkDiscovery::new(config);
    let watcher = watch_cancellation(cancel, discovery.cancel_handle());

    if let Err(e) = tx.send(AgentEvent::DiscoveryProgress {
        phase: "Scan ARP en cours...".to_string(),
        progress: 0.1,
        devices_found: 0,
    }) {
        warn!("Failed to send discovery progress: {}", e);
    }

    let scan_result = alongside(discovery.scan(&subnet), watcher).await;
    match scan_result {
        Ok(result) => publish_discovery(&result, &tx, db.as_ref(), sync_client.as_deref()).await,
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
}

/// Run `work` to its end with `watcher` running alongside it, in the same
/// task. The watcher is dropped when the work is done, and may end first.
async fn alongside<T>(work: impl Future<Output = T>, watcher: impl Future<Output = ()>) -> T {
    tokio::pin!(work);
    tokio::pin!(watcher);
    let mut watching = true;
    loop {
        tokio::select! {
            output = &mut work => break output,
            _ = &mut watcher, if watching => watching = false,
        }
    }
}

/// Pass the operator's cancellation on to the running scan.
async fn watch_cancellation(cancel: Arc<AtomicBool>, scan_cancel: Arc<AtomicBool>) {
    loop {
        if cancel.load(Ordering::Relaxed) {
            scan_cancel.store(true, Ordering::Relaxed);
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }
}

/// Keep the devices of a finished scan in the database, send them to the
/// platform and show them.
async fn publish_discovery(
    result: &DiscoveryResult,
    tx: &Sender<AgentEvent>,
    db: Option<&Arc<Database>>,
    sync_client: Option<&AuthenticatedClient>,
) {
    let devices: Vec<GuiDiscoveredDevice> = result.devices.iter().map(gui_device).collect();
    info!(
        "Discovery complete: {} devices in {}ms",
        devices.len(),
        result.scan_duration_ms
    );

    if let Some(db) = db {
        let repo = agent_storage::repositories::DiscoveredDevicesRepository::new(db);
        let stored: Vec<StoredDevice> = devices.iter().map(stored_device).collect();
        if let Err(e) = repo.upsert_batch(&stored).await {
            warn!("Failed to persist discovered devices: {}", e);
        } else {
            info!("Persisted {} discovered devices to database", stored.len());
        }
    }

    // Sync discovered devices to the platform
    if let Some(client) = sync_client {
        let payloads: Vec<agent_sync::DiscoveredAssetPayload> =
            devices.iter().map(asset_payload).collect();
        network_ops::upload_discovered_devices(client, &payloads).await;
    }

    if let Err(e) = tx.send(AgentEvent::DiscoveryUpdate { devices }) {
        warn!("Failed to send discovery update: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use agent_storage::repositories::DiscoveredDevicesRepository;
    use std::time::Duration;

    fn printer() -> DiscoveredDevice {
        let seen = chrono::DateTime::parse_from_rfc3339("2026-10-01T08:30:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        DiscoveredDevice {
            ip: "192.168.7.20".to_string(),
            mac: Some("00:11:22:33:44:55".to_string()),
            hostname: Some("imprimante-accueil".to_string()),
            vendor: Some("Brother".to_string()),
            device_type: agent_network::DeviceType::Printer,
            open_ports: vec![80, 631],
            first_seen: seen,
            last_seen: seen,
            is_gateway: false,
            subnet: "192.168.7.0/24".to_string(),
        }
    }

    #[test]
    fn a_device_keeps_its_identity_from_scan_to_platform() {
        let shown = gui_device(&printer());
        assert_eq!(
            shown.device_type,
            format!("{}", agent_network::DeviceType::Printer)
        );
        assert_eq!(shown.open_ports, vec![80, 631]);

        let stored = stored_device(&shown);
        assert_eq!(
            (stored.ip.as_str(), stored.subnet.as_str()),
            ("192.168.7.20", "192.168.7.0/24")
        );
        assert_eq!(stored.device_type, shown.device_type);

        let payload = asset_payload(&shown);
        assert_eq!(payload.mac_address.as_deref(), Some("00:11:22:33:44:55"));
        assert_eq!(payload.is_gateway, Some(false));
        assert_eq!(payload.source.as_deref(), Some("network_discovery"));
        assert_eq!(
            payload.device_type.as_deref(),
            Some(shown.device_type.as_str())
        );
    }

    #[tokio::test]
    async fn found_devices_are_kept_and_shown() {
        let test = standalone_runtime();
        let (tx, rx) = std::sync::mpsc::channel();
        let result = DiscoveryResult {
            devices: vec![printer()],
            scan_duration_ms: 1200,
            subnet_scanned: "192.168.7.0/24".to_string(),
            timestamp: chrono::Utc::now(),
        };

        publish_discovery(&result, &tx, Some(&test.db), None).await;

        let stored = DiscoveredDevicesRepository::new(&test.db)
            .get_all()
            .await
            .unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].hostname.as_deref(), Some("imprimante-accueil"));
        match rx.try_recv() {
            Ok(AgentEvent::DiscoveryUpdate { devices }) => assert_eq!(devices.len(), 1),
            other => panic!("expected the devices, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn discovery_is_declined_without_the_platforms_consent() {
        let test = standalone_runtime();
        test.runtime
            .state
            .network_monitoring
            .store(false, Ordering::Release);
        test.runtime
            .state
            .force_discovery
            .store(true, Ordering::Release);

        let mut tasks = TaskSet::new("test");
        test.runtime.forced_discovery_stage(&mut tasks).await;

        assert!(tasks.is_empty());
        assert!(!test.runtime.state.force_discovery.load(Ordering::Acquire));
        match test.events.try_recv() {
            Ok(AgentEvent::DiscoveryProgress {
                phase, progress, ..
            }) => {
                assert_eq!(
                    phase,
                    "Découverte réseau désactivée par la politique de la plateforme"
                );
                assert_eq!(progress, 0.0);
            }
            other => panic!("expected a refusal, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn nothing_is_scanned_unless_the_operator_asked() {
        let test = standalone_runtime();
        let mut tasks = TaskSet::new("test");
        test.runtime.forced_discovery_stage(&mut tasks).await;
        assert!(tasks.is_empty());
        assert!(test.events.try_recv().is_err());
    }

    #[tokio::test]
    async fn the_operators_cancellation_reaches_the_scan() {
        let cancel = Arc::new(AtomicBool::new(false));
        let scan_cancel = Arc::new(AtomicBool::new(false));
        let watcher = tokio::spawn(watch_cancellation(cancel.clone(), scan_cancel.clone()));

        tokio::time::sleep(Duration::from_millis(250)).await;
        assert!(!scan_cancel.load(Ordering::Relaxed));
        cancel.store(true, Ordering::Relaxed);
        watcher.await.unwrap();

        assert!(scan_cancel.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn the_watcher_is_dropped_when_the_work_is_done() {
        let work = async {
            tokio::time::sleep(Duration::from_millis(20)).await;
            7
        };
        assert_eq!(alongside(work, std::future::pending()).await, 7);
    }

    #[tokio::test]
    async fn a_watcher_that_ends_first_does_not_end_the_work() {
        let watched = Arc::new(AtomicBool::new(false));
        let flag = watched.clone();
        let work = async {
            tokio::time::sleep(Duration::from_millis(30)).await;
            "scanned"
        };
        let watcher = async move { flag.store(true, Ordering::Relaxed) };

        assert_eq!(alongside(work, watcher).await, "scanned");
        assert!(watched.load(Ordering::Relaxed));
    }
}
