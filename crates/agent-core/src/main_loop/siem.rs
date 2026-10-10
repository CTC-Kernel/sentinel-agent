// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! SIEM stages of the main loop: the forwarder, the OS log collector and the
//! correlation engine.

use agent_siem::SiemForwarder;
#[cfg(feature = "gui")]
use std::sync::atomic::Ordering;
use tracing::{debug, error, info, warn};

use super::LoopState;
use crate::AgentRuntime;

/// The output format behind the label shown in the interface (JSON unless
/// CEF or LEEF).
#[cfg(feature = "gui")]
fn siem_format_from_label(label: &str) -> agent_siem::SiemFormat {
    match label {
        "CEF" => agent_siem::SiemFormat::Cef,
        "LEEF" => agent_siem::SiemFormat::Leef,
        _ => agent_siem::SiemFormat::Json,
    }
}

/// The transport behind the interface's choice: an HTTP collector at
/// `destination`, or syslog over TCP to `host[:port]` (port 514 by default).
#[cfg(feature = "gui")]
fn siem_transport_from_gui(transport: &str, destination: &str) -> agent_siem::SiemTransport {
    match transport {
        "HTTP" => agent_siem::SiemTransport::Http {
            url: destination.to_string(),
            auth_token: None,
            auth_header: None,
            verify_tls: true,
            client_cert: None,
            client_key: None,
        },
        _ => {
            let parts: Vec<&str> = destination.splitn(2, ':').collect();
            let host = parts.first().unwrap_or(&"localhost").to_string();
            let port = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(514);
            agent_siem::SiemTransport::Syslog {
                host,
                port,
                protocol: agent_siem::SyslogProtocol::Tcp,
                tls: false,
                client_cert: None,
                client_key: None,
            }
        }
    }
}

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

    /// Apply the SIEM settings chosen in the interface to the forwarder.
    /// The external transport is only enabled with a real destination.
    #[cfg(feature = "gui")]
    pub(crate) async fn sync_gui_siem_config(&self) {
        let gui_enabled = self.state.siem_enabled.load(Ordering::Acquire);
        let has_destination = self
            .state
            .siem_destination
            .lock()
            .map(|d| !d.is_empty())
            .unwrap_or(false);
        // Don't activate external transport without a configured destination
        let effective_enabled = gui_enabled && has_destination;
        let mut siem_guard = self.siem_forwarder.write().await;
        if let Some(ref mut siem) = *siem_guard
            && siem.is_enabled() != effective_enabled
        {
            let mut new_config = siem.config().clone();
            new_config.enabled = effective_enabled;
            if let Ok(fmt) = self.state.siem_format.lock() {
                new_config.format = siem_format_from_label(fmt.as_str());
            }
            if has_destination
                && let Ok(dest) = self.state.siem_destination.lock()
                && let Ok(tr) = self.state.siem_transport.lock()
            {
                new_config.transport = siem_transport_from_gui(tr.as_str(), &dest);
            }
            if let Err(e) = siem.update_config(new_config) {
                warn!("Failed to apply GUI SIEM config: {}", e);
            } else if effective_enabled {
                info!("SIEM forwarder config synced from GUI (enabled=true)");
            }
        }
    }

    /// Collect the OS event logs when the collector is enabled and its poll
    /// interval has passed: interface, SIEM, then the correlation engine,
    /// whose alerts are recorded and reported as incidents.
    pub(crate) async fn collect_os_logs(&self, st: &mut LoopState) {
        let poll_secs = self
            .state
            .log_collector_poll_secs
            .load(std::sync::atomic::Ordering::Acquire);
        let collector_enabled = self
            .state
            .log_collector_enabled
            .load(std::sync::atomic::Ordering::Acquire);

        if collector_enabled && st.last_log_collection.elapsed().as_secs() >= poll_secs {
            let collector_guard = self.log_collector.read().await;
            if let Some(ref collector) = *collector_guard {
                let siem_events = collector.collect().await;
                if !siem_events.is_empty() {
                    debug!(
                        "Log collector gathered {} events from OS logs",
                        siem_events.len()
                    );

                    // Push collected events to the desktop GUI
                    #[cfg(feature = "gui")]
                    {
                        self.emit_siem_log_batch(siem_events.clone());

                        // Build category counts for stats
                        let mut cat_map: std::collections::HashMap<String, u32> =
                            std::collections::HashMap::new();
                        for ev in &siem_events {
                            *cat_map.entry(format!("{:?}", ev.category)).or_insert(0) += 1;
                        }
                        let siem_connected = self
                            .state
                            .siem_enabled
                            .load(std::sync::atomic::Ordering::Acquire);
                        self.emit_siem_stats(
                            siem_events.len() as u64,
                            siem_connected,
                            siem_events.len() as f32 / (poll_secs.max(1) as f32 / 60.0),
                            cat_map.into_iter().collect(),
                        );
                    }

                    // Record all events for platform sync, then optionally forward to external SIEM
                    let siem_guard = self.siem_forwarder.read().await;
                    if let Some(siem) = siem_guard.as_ref() {
                        for event in &siem_events {
                            // Always record for platform (SIEM tab in SaaS)
                            siem.record_event(event.clone()).await;

                            // Additionally forward to external SIEM if configured
                            if siem.is_enabled()
                                && let Err(e) = siem.send_event(event).await
                            {
                                warn!("Failed to forward log event to external SIEM: {}", e);
                            }
                        }
                    }
                    drop(siem_guard);

                    // Run events through correlation engine
                    let corr_guard = self.correlation_engine.read().await;
                    if let Some(ref engine) = *corr_guard {
                        let alerts = engine.process_events(&siem_events).await;
                        if !alerts.is_empty() {
                            warn!("Correlation engine triggered {} alert(s)", alerts.len());

                            // Forward correlation alerts to SIEM (record for platform + optional external)
                            let siem_guard = self.siem_forwarder.read().await;
                            if let Some(siem) = siem_guard.as_ref() {
                                let host = hostname::get()
                                    .map(|h| h.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                for alert in &alerts {
                                    let event = engine.alert_to_event(alert, &host);
                                    siem.record_event(event.clone()).await;
                                    if siem.is_enabled()
                                        && let Err(e) = siem.send_event(&event).await
                                    {
                                        warn!(
                                            "Failed to forward correlation alert to external SIEM: {}",
                                            e
                                        );
                                    }
                                }
                            }
                            drop(siem_guard);

                            // Upload correlation alerts as security incidents
                            for alert in &alerts {
                                if let Some(ref client) = self.authenticated_client {
                                    use agent_sync::types::{
                                        IncidentType as SyncIncidentType, Severity as SyncSeverity,
                                    };
                                    let incident_type = match alert.rule_id.as_str() {
                                        "brute_force" | "windows_logon_failure_burst" => {
                                            SyncIncidentType::CredentialTheft
                                        }
                                        "privilege_escalation" => {
                                            SyncIncidentType::PrivilegeEscalation
                                        }
                                        "file_integrity_burst"
                                        | "windows_audit_log_cleared"
                                        | "windows_account_changes" => {
                                            SyncIncidentType::UnauthorizedChange
                                        }
                                        "windows_service_install_burst" => {
                                            SyncIncidentType::Malware
                                        }
                                        "windows_firewall_changes" => {
                                            SyncIncidentType::FirewallDisabled
                                        }
                                        "network_scan" | "critical_errors" => {
                                            SyncIncidentType::SuspiciousProcess
                                        }
                                        _ => SyncIncidentType::SuspiciousProcess,
                                    };
                                    let severity = if alert.severity >= 8 {
                                        SyncSeverity::Critical
                                    } else if alert.severity >= 6 {
                                        SyncSeverity::High
                                    } else {
                                        SyncSeverity::Medium
                                    };
                                    let report = agent_sync::types::SecurityIncidentReport {
                                        incident_type,
                                        severity,
                                        title: alert.rule_name.clone(),
                                        description: format!(
                                            "{} ({} events in {}s)",
                                            alert.description,
                                            alert.event_count,
                                            (alert.last_event - alert.first_event).num_seconds()
                                        ),
                                        evidence: serde_json::json!({
                                            "rule_id": alert.rule_id,
                                            "event_count": alert.event_count,
                                            "sample_event_ids": alert.sample_event_ids,
                                        }),
                                        confidence: 80,
                                        detected_at: alert.generated_at,
                                    };
                                    if let Err(e) = client.report_incident(report).await {
                                        warn!("Failed to upload correlation alert: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    drop(corr_guard);
                }
            }
            drop(collector_guard);
            st.last_log_collection = std::time::Instant::now();
        }
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

    #[cfg(feature = "gui")]
    #[test]
    fn interface_labels_map_to_formats() {
        use super::siem_format_from_label;
        use agent_siem::SiemFormat;
        assert_eq!(siem_format_from_label("CEF"), SiemFormat::Cef);
        assert_eq!(siem_format_from_label("LEEF"), SiemFormat::Leef);
        assert_eq!(siem_format_from_label("JSON"), SiemFormat::Json);
        assert_eq!(siem_format_from_label("anything else"), SiemFormat::Json);
    }

    #[cfg(feature = "gui")]
    #[test]
    fn a_syslog_destination_is_split_into_host_and_port() {
        use super::siem_transport_from_gui;
        use agent_siem::SiemTransport;
        match siem_transport_from_gui("Syslog", "siem.example.org:6514") {
            SiemTransport::Syslog {
                host, port, tls, ..
            } => {
                assert_eq!(
                    (host.as_str(), port, tls),
                    ("siem.example.org", 6514, false)
                );
            }
            SiemTransport::Http { .. } => panic!("expected syslog"),
        }
        // No port, or an unreadable one: the syslog default.
        for destination in ["siem.example.org", "siem.example.org:syslog"] {
            match siem_transport_from_gui("Syslog", destination) {
                SiemTransport::Syslog { host, port, .. } => {
                    assert_eq!((host.as_str(), port), ("siem.example.org", 514));
                }
                SiemTransport::Http { .. } => panic!("expected syslog"),
            }
        }
    }

    #[cfg(feature = "gui")]
    #[test]
    fn an_http_destination_is_kept_whole_and_verified() {
        use super::siem_transport_from_gui;
        use agent_siem::SiemTransport;
        match siem_transport_from_gui("HTTP", "https://hec.example.org:8088/services/collector") {
            SiemTransport::Http {
                url,
                verify_tls,
                auth_token,
                ..
            } => {
                assert_eq!(url, "https://hec.example.org:8088/services/collector");
                assert!(verify_tls);
                assert!(auth_token.is_none());
            }
            SiemTransport::Syslog { .. } => panic!("expected http"),
        }
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn the_forwarder_is_enabled_only_with_a_destination() {
        let test = standalone_runtime();
        test.runtime.init_siem_forwarder().await;
        let state = &test.runtime.state;
        state.siem_enabled.store(true, Ordering::Release);

        // Enabled in the interface, but nowhere to send to.
        state.siem_destination.lock().unwrap().clear();
        test.runtime.sync_gui_siem_config().await;
        assert!(
            !test
                .runtime
                .siem_forwarder
                .read()
                .await
                .as_ref()
                .unwrap()
                .is_enabled()
        );

        *state.siem_destination.lock().unwrap() = "siem.example.org:6514".to_string();
        *state.siem_transport.lock().unwrap() = "Syslog".to_string();
        *state.siem_format.lock().unwrap() = "CEF".to_string();
        test.runtime.sync_gui_siem_config().await;
        let forwarder = test.runtime.siem_forwarder.read().await;
        let siem = forwarder.as_ref().unwrap();
        assert!(siem.is_enabled());
        assert_eq!(siem.config().format, agent_siem::SiemFormat::Cef);
        assert_eq!(siem.config().destination_label(), "siem.example.org:6514");
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
