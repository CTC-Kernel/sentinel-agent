// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the agent sets up once, before the first pass of the main loop.

use agent_common::constants::AGENT_VERSION;
use agent_common::error::CommonError;
use agent_fim::FimEngine;
#[cfg(feature = "gui")]
use agent_gui::dto::GuiDiscoveredDevice;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_storage::repositories::StoredDevice;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use super::LoopState;
use crate::supervised_tasks::TaskSet;
use crate::{AgentRuntime, threat_intel_feeds};

/// Name of the background task that keeps the indicator feeds up to date.
const FEEDS_TASK: &str = "threat intelligence feeds";

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

    /// Start the file integrity engine; its alerts are read by the main loop.
    pub(crate) async fn start_fim_engine(&self) {
        let (fim_tx, fim_rx) = mpsc::channel(1000);
        let mut fim_rx_guard = self.fim_rx.lock().await;
        *fim_rx_guard = Some(fim_rx);

        let engine = FimEngine::with_defaults(fim_tx);

        if let Err(e) = engine.start().await {
            error!("Failed to start FIM engine: {}", e);
        } else {
            info!("FIM engine started successfully");
        }

        let mut fim_guard = self.fim_engine.write().await;
        *fim_guard = Some(engine);
    }

    /// Follow the configured indicator feeds (block lists, STIX, TAXII) in
    /// a background task of `tasks`, started again if it panics; the main
    /// loop applies what the feeds bring.
    pub(crate) fn start_threat_intel_feeds(&self, tasks: &mut TaskSet) {
        let feeds = threat_intel_feeds::usable_feeds(&self.config.threat_intel_feeds);
        if !feeds.is_empty() {
            info!("Following {} threat intelligence feed(s)", feeds.len());
            let pending = Arc::clone(&self.pending_feed_intel);
            let shutdown = Arc::clone(&self.state.shutdown);
            tasks.spawn_restartable(FEEDS_TASK, move || {
                threat_intel_feeds::run(feeds.clone(), Arc::clone(&pending), Arc::clone(&shutdown))
            });
        }
    }

    /// Everything that precedes the first pass: connection to the platform
    /// (unless standalone), initial scans, then the engines the loop reads
    /// from. Returns the schedule the loop starts with.
    pub(crate) async fn start_up(self: &Arc<Self>) -> Result<LoopState, CommonError> {
        self.announce_start();

        // Honor timed IP unblocks whose in-memory timers died with the previous
        // process: expired blocks are lifted now, the rest are rescheduled.
        crate::edr_actions::reconcile_pending_blocks().await;
        // Same for a host isolation: lifted if it expired, applied again if not.
        crate::host_isolation::reconcile_host_isolation().await;

        if self.config.standalone {
            // ── Standalone: no platform, local protection only ──
            info!(
                "Standalone mode: no enrollment, heartbeat, upload or remote command; \
                 detection, file integrity, compliance and scanning run locally"
            );
            // The bundled check rules back the results table's foreign key;
            // the platform normally seeds them through the sync services.
            self.seed_builtin_check_rules().await;
        } else {
            self.run_platform_startup().await?;
        }

        // Last network monitoring consent received from the platform: must be
        // known before the first network collection.
        self.load_persisted_network_consent().await;

        // Log initial resource usage
        let usage = self.resource_monitor.get_usage();
        debug!(
            "Initial resource usage: CPU={:.2}%, MEM={}MB",
            usage.cpu_percent,
            usage.memory_bytes / (1024 * 1024)
        );

        // Emit initial GUI state
        #[cfg(feature = "gui")]
        {
            self.emit_status_update(None, None, 0, None);
            self.emit_resource_update(None);
        }

        #[cfg(feature = "gui")]
        self.load_cached_discovery().await;

        // Load persisted GRC data (playbooks, detection rules, assets, alert rules) into GUI
        #[cfg(feature = "gui")]
        self.sync_assets_to_gui().await;

        // Schedule and last results of the loop: vulnerability scan and
        // compliance check on the first pass, update check shortly after.
        let mut st = LoopState::starting_at(
            std::time::Instant::now(),
            self.vuln_scan_interval_secs,
            self.state.get_check_interval(),
        );

        // Uploads are queued from here on: the task that sends them starts
        // before the first scan.
        self.start_outbox(&mut st.tasks);

        // Run initial security scan on startup (quick check)
        info!("Running initial security scan...");
        if let Err(e) = self.run_security_scan().await {
            warn!("Initial security scan failed: {}", e);
        }
        st.last_security_scan = std::time::Instant::now();

        // Initialize network collection with staggered start
        self.start_network_schedule(&mut st).await;

        // Log collector timer — polls OS event logs at the configured interval
        st.last_log_collection = std::time::Instant::now();

        // Run initial network collection (with 30s timeout to avoid blocking the main loop)
        self.run_initial_network_collection().await;

        self.start_engines(&mut st.tasks).await;

        Ok(st)
    }

    /// Restart the start-up timer, log what the agent runs with and check
    /// that it started in time.
    fn announce_start(&self) {
        // Reset startup timer so it measures from run() start, not from
        // AgentRuntime construction (which may include a failed GUI attempt).
        self.resource_monitor.reset_startup_time();

        info!("Starting Sentinel GRC Agent v{}", AGENT_VERSION);
        info!("Server URL: https://cyber-threat-consulting.com [redacted]");
        info!(
            "Check interval: {} seconds",
            self.config.check_interval_secs
        );
        info!(
            "Vulnerability scan interval: {} seconds",
            self.vuln_scan_interval_secs
        );
        info!(
            "Security scan interval: {} seconds",
            self.security_scan_interval_secs
        );

        // Check startup time is within limits
        self.resource_monitor.check_startup_time();
    }

    /// Start what the loop reads from: file integrity, ransomware canaries,
    /// process telemetry, YARA, indicator feeds, SIEM forwarder, log
    /// collector and correlation engine.
    async fn start_engines(&self, tasks: &mut TaskSet) {
        // Initialize FIM engine
        self.start_fim_engine().await;

        // Ransomware canary files (or their removal when the option is off)
        self.start_ransomware_canaries().await;

        // Process starts reported by the operating system, when the option is on
        self.start_process_telemetry();

        // YARA rules, when the helper is installed and rules are present
        self.start_yara();

        // Indicator feeds (block lists, STIX, TAXII), when any is configured
        self.start_threat_intel_feeds(tasks);

        // Initialize SIEM forwarder (disabled by default).
        self.init_siem_forwarder().await;

        // Initialize log collector for OS event log ingestion
        self.init_log_collector().await;

        // Initialize correlation engine with default rules
        self.init_correlation_engine().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::{standalone_runtime, standalone_runtime_with};
    #[cfg(feature = "gui")]
    use agent_storage::repositories::DiscoveredDevicesRepository;

    #[tokio::test]
    async fn configured_feeds_are_followed_by_a_watched_task() {
        let test = standalone_runtime_with(|config| {
            config.threat_intel_feeds = vec![agent_common::config::ThreatIntelFeed {
                name: "blocklist".to_string(),
                url: "https://feeds.example/blocklist".to_string(),
                format: Default::default(),
                authorization: None,
                refresh_hours: 12,
            }];
        });
        let mut tasks = TaskSet::new("test");

        test.runtime.start_threat_intel_feeds(&mut tasks);

        assert!(tasks.is_running(FEEDS_TASK));
        // Stopped before it is ever polled: nothing is downloaded by this test.
        tasks.shutdown().await;
    }

    #[tokio::test]
    async fn without_feeds_no_task_is_started() {
        let test = standalone_runtime();
        let mut tasks = TaskSet::new("test");

        test.runtime.start_threat_intel_feeds(&mut tasks);

        assert!(tasks.is_empty());
    }

    #[cfg(feature = "gui")]
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

    #[cfg(feature = "gui")]
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

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn an_empty_cache_sends_nothing() {
        let test = standalone_runtime();
        test.runtime.load_cached_discovery().await;
        assert!(test.events.try_recv().is_err());
    }
}
