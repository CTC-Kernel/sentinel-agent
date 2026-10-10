// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Scan stages of the main loop: the background vulnerability scan and the
//! periodic security scan.

use agent_common::types::UsbEvent;
#[cfg(feature = "gui")]
use agent_gui::dto::{
    GuiSuspiciousProcess, GuiUsbEvent, GuiVulnerabilitySummary, UsbEventType as GuiUsbEventType,
};
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_scanner::SecurityIncident;
use agent_scanner::SecurityScanResult;
#[cfg(feature = "gui")]
use agent_scanner::VulnerabilityScanResult;
#[cfg(feature = "gui")]
use std::sync::atomic::Ordering;
use tracing::{debug, error, info, warn};

use super::{LoopPass, LoopState};
use crate::AgentRuntime;
#[cfg(feature = "gui")]
use crate::triage_allowlist;

/// What identifies an incident from one security scan to the next.
#[cfg(feature = "gui")]
fn incident_fingerprint(incident: &SecurityIncident) -> String {
    format!(
        "{}|{}|{}|{}",
        incident.incident_type, incident.title, incident.description, incident.evidence
    )
}

/// Whether the incident is about a process, shown in the process view.
#[cfg(feature = "gui")]
fn is_process_incident(incident: &SecurityIncident) -> bool {
    incident.incident_type == agent_scanner::IncidentType::SuspiciousProcess
        || incident.incident_type == agent_scanner::IncidentType::CryptoMiner
}

/// The process behind a process incident, read from its evidence.
#[cfg(feature = "gui")]
fn gui_suspicious_process(incident: &SecurityIncident) -> GuiSuspiciousProcess {
    let process_name = incident
        .evidence
        .get("process_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let pid: u32 = incident
        .evidence
        .get("pid")
        .and_then(|v| v.as_u64())
        .and_then(|v| v.try_into().ok())
        .unwrap_or(0);
    let command_line = incident
        .evidence
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    GuiSuspiciousProcess {
        process_name,
        pid,
        command_line,
        reason: incident.description.clone(),
        confidence: incident.confidence,
        detected_at: incident.detected_at,
        ai_confidence: None,
        is_false_positive: None,
        ai_analysis: None,
        acknowledged: false,
        allowlisted: false,
    }
}

/// A USB device event as the interface shows it.
#[cfg(feature = "gui")]
fn gui_usb_event(event: UsbEvent) -> GuiUsbEvent {
    let gui_event_type = match event.event_type {
        agent_common::types::UsbEventType::Connected => GuiUsbEventType::Connected,
        agent_common::types::UsbEventType::Disconnected => GuiUsbEventType::Disconnected,
        agent_common::types::UsbEventType::Blocked => GuiUsbEventType::Blocked,
    };
    GuiUsbEvent {
        device_name: event.device.description,
        vendor_id: event.device.vendor_id,
        product_id: event.device.product_id,
        event_type: gui_event_type,
        timestamp: event.timestamp,
        acknowledged: false,
        allowlisted: false,
    }
}

/// Notification shown when a vulnerability scan ends: its text and its
/// severity ("error" as soon as a finding is known to be exploited).
#[cfg(feature = "gui")]
fn vuln_scan_notification(
    count: usize,
    exploited: usize,
    packages_scanned: u32,
) -> (String, &'static str) {
    let severity = if exploited > 0 {
        "error"
    } else if count > 0 {
        "warning"
    } else {
        "info"
    };
    let mut message = format!(
        "{} vulnérabilités détectées sur {} paquets",
        count, packages_scanned
    );
    if exploited > 0 {
        message.push_str(&format!(
            ", dont {} exploitée{} activement (CISA KEV)",
            exploited,
            if exploited > 1 { "s" } else { "" }
        ));
    }
    (message, severity)
}

/// The findings of a scan counted by severity, for the dashboard.
#[cfg(feature = "gui")]
fn vulnerability_summary(result: &VulnerabilityScanResult) -> GuiVulnerabilitySummary {
    let mut critical = 0u32;
    let mut high = 0u32;
    let mut medium = 0u32;
    let mut low = 0u32;
    for v in &result.vulnerabilities {
        match v.severity {
            agent_scanner::vulnerability::Severity::Critical => {
                critical = critical.saturating_add(1)
            }
            agent_scanner::vulnerability::Severity::High => high = high.saturating_add(1),
            agent_scanner::vulnerability::Severity::Medium => medium = medium.saturating_add(1),
            agent_scanner::vulnerability::Severity::Low => low = low.saturating_add(1),
        }
    }
    GuiVulnerabilitySummary {
        critical,
        high,
        medium,
        low,
        last_scan_at: Some(chrono::Utc::now()),
    }
}

impl AgentRuntime {
    /// Show the result of a vulnerability scan: notification, dashboard
    /// counts, software inventory, findings and browser extensions.
    #[cfg(feature = "gui")]
    async fn publish_vuln_scan(&self, st: &mut LoopState, result: &VulnerabilityScanResult) {
        let count = result.vulnerabilities.len();
        let exploited = result
            .vulnerabilities
            .iter()
            .filter(|v| v.is_known_exploited())
            .count();
        let (message, severity) = vuln_scan_notification(count, exploited, result.packages_scanned);
        self.emit_notification("Scan vulnérabilités terminé", &message, severity);
        self.emit_gui_event(AgentEvent::VulnerabilityUpdate {
            summary: vulnerability_summary(result),
        });
        self.emit_gui_event(AgentEvent::SoftwareUpdate {
            packages: self.build_software_packages(result),
        });
        self.emit_gui_event(AgentEvent::VulnerabilityFindings {
            findings: self.build_vulnerability_findings(result),
            exploit_intel: self.build_exploit_intel_status(result),
        });
        // Browser extensions are part of the software
        // inventory and refreshed with it.
        let extensions = agent_scanner::browser_extensions::installed_extensions().await;
        self.emit_gui_event(AgentEvent::BrowserExtensions {
            extensions: self.build_browser_extensions(&extensions),
        });
        st.gui.kpi_open_vulns = count as u32;
        st.gui.last_check_at = Some(chrono::Utc::now());
    }

    /// Collect the background vulnerability scan once it has finished and
    /// show its result. The scan runs in its own task so that a long one
    /// (inventory, OSV lookups, AI analysis, uploads) never delays the loop;
    /// a new one only starts after the previous handle was collected here.
    pub(crate) async fn collect_vuln_scan(&self, st: &mut LoopState) {
        if st.vuln_scan_task.as_ref().is_some_and(|t| t.is_finished())
            && let Some(task) = st.vuln_scan_task.take()
        {
            st.last_vuln_scan = std::time::Instant::now();
            match task.await {
                Ok(Ok(result)) => {
                    let count = result.vulnerabilities.len();
                    if count > 0 {
                        info!("Vulnerability scan found {} issues", count);
                    }
                    #[cfg(feature = "gui")]
                    self.publish_vuln_scan(st, &result).await;
                }
                Ok(Err(e)) => {
                    warn!("Vulnerability scan failed: {}", e);
                    #[cfg(feature = "gui")]
                    self.emit_notification(
                        "Scan vulnérabilités échoué",
                        &format!("{}", e),
                        "error",
                    );
                }
                Err(join_error) => {
                    error!("Vulnerability scan task aborted: {}", join_error);
                }
            }
            #[cfg(feature = "gui")]
            {
                self.state.scanning.store(false, Ordering::Release);
                self.emit_status_update(
                    st.gui.last_check_at,
                    st.compliance_score,
                    st.gui.cached_pending_sync,
                    st.gui.cached_policy_summary,
                );
            }
        }
    }

    /// Start the background vulnerability scan when its interval has passed
    /// and none is running (never while paused).
    pub(crate) fn start_vuln_scan_if_due(&self, st: &mut LoopState, pass: &LoopPass) {
        if !pass.is_paused
            && st.vuln_scan_task.is_none()
            && st.last_vuln_scan.elapsed().as_secs() >= self.vuln_scan_interval_secs
        {
            #[cfg(feature = "gui")]
            {
                self.state.scanning.store(true, Ordering::Release);
                self.emit_status_update(
                    st.gui.last_check_at,
                    st.compliance_score,
                    st.gui.cached_pending_sync,
                    st.gui.cached_policy_summary,
                );
            }
            st.vuln_scan_task = Some(tokio::spawn(self.vuln_scan_job().run()));
        }
    }

    /// Periodic security scan (skipped when paused): its incidents go to
    /// the interface and the threat pipeline of this pass, then the USB
    /// devices are checked alongside.
    pub(crate) async fn security_scan_stage(&self, st: &mut LoopState, pass: &mut LoopPass) {
        if !pass.is_paused
            && st.last_security_scan.elapsed().as_secs() >= self.security_scan_interval_secs
        {
            pass.is_active = true;
            match self.run_security_scan().await {
                Ok(result) => self.record_security_scan(st, pass, &result),
                Err(e) => {
                    warn!("Security scan failed: {}", e);
                }
            }
            // Run USB device scan alongside security scan
            self.scan_usb_devices().await;

            st.last_security_scan = std::time::Instant::now();
        }
    }

    /// Hand the result of a security scan to the interface and to the
    /// threat pipeline of this pass.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    fn record_security_scan(
        &self,
        st: &mut LoopState,
        pass: &mut LoopPass,
        result: &SecurityScanResult,
    ) {
        let count = result.incidents.len();
        if count > 0 {
            warn!("Security scan detected {} incident(s)!", count);
            #[cfg(feature = "gui")]
            self.show_security_incidents(st, &result.incidents);
        }

        // Accumulate incidents for threat pipeline
        #[cfg(feature = "gui")]
        {
            pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(count as u32);
        }
        pass.incidents.extend(result.incidents.iter().cloned());
        pass.observed.add_processes(&result.processes);

        if count == 0 {
            // A clean periodic scan is not news: logging it avoids a
            // notification every few minutes.
            debug!("Security scan: no incident detected");
            #[cfg(feature = "gui")]
            st.gui.previous_incidents.clear();
        }
    }

    /// Show the incidents of a scan. A persistent condition is found again
    /// by every scan: the notification only counts what the previous scan
    /// did not report.
    #[cfg(feature = "gui")]
    fn show_security_incidents(&self, st: &mut LoopState, incidents: &[SecurityIncident]) {
        let authorizations = self.state.allowlist_snapshot();
        let current: std::collections::HashSet<String> = incidents
            .iter()
            // Authorized incidents are still reported to the GUI
            // (shown as "Autorisé") but never notified.
            .filter(|i| !triage_allowlist::incident_is_authorized(&authorizations, i))
            .map(incident_fingerprint)
            .collect();
        let new_count = current.difference(&st.gui.previous_incidents).count();
        st.gui.previous_incidents = current;
        if new_count > 0 {
            self.emit_notification(
                "Incidents de sécurité détectés",
                &format!("{} nouvel(s) incident(s) détecté(s)", new_count),
                "error",
            );
        }
        for incident in incidents {
            // Process detections are reported once, as a
            // SuspiciousProcess: a duplicate SystemIncident
            // could not be covered by a process authorization
            // and was counted twice.
            if is_process_incident(incident) {
                self.emit_gui_event(AgentEvent::SuspiciousProcess {
                    process: gui_suspicious_process(incident),
                });
            } else {
                self.emit_system_incident(incident);
            }
        }
    }

    /// Check the USB devices: what was plugged in or removed since the last
    /// scan is logged, uploaded and shown.
    async fn scan_usb_devices(&self) {
        // Collect events inside mutex scope, then release before async upload
        let usb_events = self
            .usb_monitor
            .lock()
            .ok()
            .map(|mut usb| usb.scan())
            .unwrap_or_default();

        self.report_usb_events(usb_events).await;
    }

    /// Log, upload and show USB device events.
    async fn report_usb_events(&self, usb_events: Vec<UsbEvent>) {
        for event in &usb_events {
            debug!(
                "USB event: {} ({:04X}:{:04X}) - {:?}",
                event.device.description,
                event.device.vendor_id,
                event.device.product_id,
                event.event_type
            );
        }

        // Upload USB events to SaaS (populates USB tab)
        if !usb_events.is_empty()
            && let Some(ref auth_client) = self.authenticated_client
        {
            let payloads: Vec<agent_sync::types::UsbEventPayload> =
                usb_events.iter().cloned().map(Into::into).collect();
            if let Err(e) = auth_client.upload_usb_events(payloads).await {
                warn!("Failed to upload USB events to SaaS: {}", e);
            }
        }

        #[cfg(feature = "gui")]
        for event in usb_events {
            self.emit_gui_event(AgentEvent::UsbEvent {
                event: gui_usb_event(event),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use agent_common::error::CommonError;
    use agent_scanner::{
        ScanType, SecurityIncident, Severity, VulnerabilityFinding, VulnerabilityScanResult,
    };
    use std::time::Instant;

    fn scan_result(severities: &[Severity]) -> VulnerabilityScanResult {
        let now = chrono::Utc::now();
        VulnerabilityScanResult {
            vulnerabilities: severities
                .iter()
                .enumerate()
                .map(|(i, severity)| {
                    let mut finding =
                        VulnerabilityFinding::outdated_package(format!("pkg{i}"), "1", "2", "apt");
                    finding.severity = *severity;
                    finding
                })
                .collect(),
            scan_type: ScanType::CveCheck,
            started_at: now,
            completed_at: now,
            packages_scanned: 120,
            errors: Vec::new(),
            packages: Vec::new(),
            exploit_intel: None,
        }
    }

    fn incident(incident_type: agent_scanner::IncidentType, title: &str) -> SecurityIncident {
        SecurityIncident {
            incident_type,
            severity: agent_scanner::IncidentSeverity::High,
            title: title.to_string(),
            description: format!("{title} détecté"),
            evidence: serde_json::json!({ "process_name": "xmrig", "pid": 4242, "path": "/tmp/xmrig" }),
            confidence: 90,
            detected_at: chrono::Utc::now(),
        }
    }

    fn security_scan(incidents: Vec<SecurityIncident>) -> SecurityScanResult {
        let now = chrono::Utc::now();
        SecurityScanResult {
            incidents,
            started_at: now,
            completed_at: now,
            processes_scanned: 1,
            system_checks_performed: 1,
            errors: Vec::new(),
            processes: vec![agent_scanner::security::process_monitor::ProcessInfo {
                pid: 4242,
                name: "xmrig".to_string(),
                path: Some("/tmp/xmrig".to_string()),
                cmdline: Some("/tmp/xmrig --donate-level 1".to_string()),
                ppid: Some(1),
                user: Some("alice".to_string()),
            }],
        }
    }

    #[cfg(feature = "gui")]
    fn drain(test: &crate::main_loop::testing::TestRuntime) -> Vec<AgentEvent> {
        std::iter::from_fn(|| test.events.try_recv().ok()).collect()
    }

    #[tokio::test]
    async fn scan_incidents_and_processes_reach_the_pass() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let mut pass = LoopPass::new(false);
        let firewall = incident(
            agent_scanner::IncidentType::FirewallDisabled,
            "Pare-feu désactivé",
        );

        test.runtime
            .record_security_scan(&mut st, &mut pass, &security_scan(vec![firewall]));

        assert_eq!(pass.incidents.len(), 1);
        // Every scanned process is kept for the custom detection rules.
        assert_eq!(pass.observed.processes.len(), 1);
        assert_eq!(pass.observed.processes[0].name, "xmrig");
        #[cfg(feature = "gui")]
        assert_eq!(pass.kpi_incident_count, 1);
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn a_persisting_incident_is_notified_once_and_again_after_it_cleared() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let scan = security_scan(vec![incident(
            agent_scanner::IncidentType::FirewallDisabled,
            "Pare-feu désactivé",
        )]);
        let notified = |events: &[AgentEvent]| {
            events
                .iter()
                .filter(|event| matches!(event, AgentEvent::Notification { .. }))
                .count()
        };
        let shown = |events: &[AgentEvent]| {
            events
                .iter()
                .filter(|event| matches!(event, AgentEvent::SystemIncident { .. }))
                .count()
        };

        test.runtime
            .record_security_scan(&mut st, &mut LoopPass::new(false), &scan);
        let first = drain(&test);
        assert_eq!((notified(&first), shown(&first)), (1, 1));

        // Still there at the next scan: shown, not notified again.
        test.runtime
            .record_security_scan(&mut st, &mut LoopPass::new(false), &scan);
        let second = drain(&test);
        assert_eq!((notified(&second), shown(&second)), (0, 1));

        // A clean scan forgets it; when it comes back it is news again.
        test.runtime.record_security_scan(
            &mut st,
            &mut LoopPass::new(false),
            &security_scan(Vec::new()),
        );
        assert!(st.gui.previous_incidents.is_empty());
        assert!(drain(&test).is_empty());
        test.runtime
            .record_security_scan(&mut st, &mut LoopPass::new(false), &scan);
        assert_eq!(notified(&drain(&test)), 1);
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn a_process_incident_is_shown_once_as_a_process() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let miner = incident(agent_scanner::IncidentType::CryptoMiner, "Mineur");

        test.runtime.record_security_scan(
            &mut st,
            &mut LoopPass::new(false),
            &security_scan(vec![miner]),
        );

        let events = drain(&test);
        assert!(
            !events
                .iter()
                .any(|e| matches!(e, AgentEvent::SystemIncident { .. }))
        );
        let process = events
            .iter()
            .find_map(|event| match event {
                AgentEvent::SuspiciousProcess { process } => Some(process),
                _ => None,
            })
            .expect("the process");
        assert_eq!(process.process_name, "xmrig");
        assert_eq!(process.pid, 4242);
        assert_eq!(process.command_line, "/tmp/xmrig");
    }

    #[cfg(feature = "gui")]
    #[test]
    fn a_process_without_evidence_is_shown_as_unknown() {
        let mut bare = incident(agent_scanner::IncidentType::SuspiciousProcess, "Processus");
        bare.evidence = serde_json::Value::Null;
        let process = gui_suspicious_process(&bare);
        assert_eq!(process.process_name, "unknown");
        assert_eq!(process.pid, 0);
        assert_eq!(process.command_line, "");
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn usb_events_are_shown_with_their_device() {
        let test = standalone_runtime();
        let event = UsbEvent {
            device: agent_common::types::UsbDevice {
                vendor_id: 0x0781,
                product_id: 0x5581,
                serial: None,
                description: "SanDisk Ultra".to_string(),
                class: agent_common::types::UsbDeviceClass::MassStorage,
            },
            event_type: agent_common::types::UsbEventType::Connected,
            timestamp: chrono::Utc::now(),
            allowed: false,
        };

        test.runtime.report_usb_events(vec![event]).await;

        match test.events.try_recv() {
            Ok(AgentEvent::UsbEvent { event }) => {
                assert_eq!(event.device_name, "SanDisk Ultra");
                assert_eq!((event.vendor_id, event.product_id), (0x0781, 0x5581));
                assert!(matches!(event.event_type, GuiUsbEventType::Connected));
            }
            other => panic!("expected the USB event, got {:?}", other.map(|_| ())),
        }
    }

    /// A scan task that has already finished with `outcome`.
    async fn finished_scan(
        outcome: Result<VulnerabilityScanResult, CommonError>,
    ) -> tokio::task::JoinHandle<Result<VulnerabilityScanResult, CommonError>> {
        let task = tokio::spawn(async move { outcome });
        while !task.is_finished() {
            tokio::task::yield_now().await;
        }
        task
    }

    #[cfg(feature = "gui")]
    #[test]
    fn the_scan_notification_escalates_with_exploited_findings() {
        assert_eq!(
            vuln_scan_notification(0, 0, 120),
            (
                "0 vulnérabilités détectées sur 120 paquets".to_string(),
                "info"
            )
        );
        assert_eq!(vuln_scan_notification(5, 0, 120).1, "warning");
        assert_eq!(
            vuln_scan_notification(5, 1, 120),
            (
                "5 vulnérabilités détectées sur 120 paquets, dont 1 exploitée activement (CISA KEV)"
                    .to_string(),
                "error"
            )
        );
        assert!(
            vuln_scan_notification(5, 2, 120)
                .0
                .ends_with("dont 2 exploitées activement (CISA KEV)")
        );
    }

    #[cfg(feature = "gui")]
    #[test]
    fn findings_are_counted_by_severity() {
        let summary = vulnerability_summary(&scan_result(&[
            Severity::Critical,
            Severity::High,
            Severity::High,
            Severity::Low,
        ]));
        assert_eq!(
            (summary.critical, summary.high, summary.medium, summary.low),
            (1, 2, 0, 1)
        );
        assert!(summary.last_scan_at.is_some());
    }

    #[tokio::test]
    async fn a_finished_scan_is_collected_and_its_timer_restarted() {
        let test = standalone_runtime();
        let started = Instant::now();
        let mut st = LoopState::starting_at(started, 6 * 3600, 3600);
        st.vuln_scan_task =
            Some(finished_scan(Ok(scan_result(&[Severity::High, Severity::Medium]))).await);

        test.runtime.collect_vuln_scan(&mut st).await;

        assert!(st.vuln_scan_task.is_none());
        assert!(st.last_vuln_scan >= started);
        #[cfg(feature = "gui")]
        {
            assert_eq!(st.gui.kpi_open_vulns, 2);
            assert!(st.gui.last_check_at.is_some());
            assert!(!test.runtime.state.scanning.load(Ordering::Acquire));
            match test.events.try_recv() {
                Ok(AgentEvent::Notification { notification }) => {
                    assert_eq!(notification.title, "Scan vulnérabilités terminé");
                    assert_eq!(notification.severity, "warning");
                }
                other => panic!("expected a notification, got {:?}", other.map(|_| ())),
            }
            assert!(matches!(
                test.events.try_recv(),
                Ok(AgentEvent::VulnerabilityUpdate { .. })
            ));
        }
    }

    #[tokio::test]
    async fn a_failed_scan_is_collected_without_results() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        st.vuln_scan_task = Some(finished_scan(Err(CommonError::internal("no scanner"))).await);

        test.runtime.collect_vuln_scan(&mut st).await;

        assert!(st.vuln_scan_task.is_none());
        #[cfg(feature = "gui")]
        {
            assert_eq!(st.gui.kpi_open_vulns, 0);
            match test.events.try_recv() {
                Ok(AgentEvent::Notification { notification }) => {
                    assert_eq!(notification.title, "Scan vulnérabilités échoué");
                    assert_eq!(notification.severity, "error");
                }
                other => panic!("expected a notification, got {:?}", other.map(|_| ())),
            }
        }
    }

    /// A state whose vulnerability scan is due, as at start-up. `None` on a
    /// clock too young to be set one interval back (Windows shortly after
    /// boot): the first scan then waits a full interval.
    fn due_state(runtime: &AgentRuntime) -> Option<LoopState> {
        let st = LoopState::starting_at(Instant::now(), runtime.vuln_scan_interval_secs, 3600);
        (st.last_vuln_scan.elapsed().as_secs() >= runtime.vuln_scan_interval_secs).then_some(st)
    }

    #[tokio::test]
    async fn a_due_scan_is_started_once() {
        let test = standalone_runtime();
        let Some(mut st) = due_state(&test.runtime) else {
            return;
        };

        test.runtime
            .start_vuln_scan_if_due(&mut st, &LoopPass::new(false));

        // Aborted before it is ever polled: nothing is scanned by this test.
        let task = st.vuln_scan_task.as_ref().expect("a scan task");
        task.abort();
        #[cfg(feature = "gui")]
        {
            assert!(test.runtime.state.scanning.load(Ordering::Acquire));
            assert!(matches!(
                test.events.try_recv(),
                Ok(AgentEvent::StatusChanged { .. })
            ));
        }
        // A second pass does not start another scan next to the first.
        let first = task.id();
        test.runtime
            .start_vuln_scan_if_due(&mut st, &LoopPass::new(false));
        assert_eq!(
            st.vuln_scan_task.as_ref().map(|task| task.id()),
            Some(first)
        );
    }

    #[tokio::test]
    async fn no_scan_starts_while_paused_or_before_its_interval() {
        let test = standalone_runtime();

        if let Some(mut paused) = due_state(&test.runtime) {
            test.runtime
                .start_vuln_scan_if_due(&mut paused, &LoopPass::new(true));
            assert!(paused.vuln_scan_task.is_none());
        }

        let mut not_due = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        not_due.last_vuln_scan = Instant::now();
        test.runtime
            .start_vuln_scan_if_due(&mut not_due, &LoopPass::new(false));
        assert!(not_due.vuln_scan_task.is_none());
    }

    #[tokio::test]
    async fn a_running_scan_is_left_alone() {
        let test = standalone_runtime();
        let started = Instant::now() - std::time::Duration::from_secs(60);
        let mut st = LoopState::starting_at(started, 6 * 3600, 3600);
        let scheduled = st.last_vuln_scan;
        st.vuln_scan_task = Some(tokio::spawn(std::future::pending()));

        test.runtime.collect_vuln_scan(&mut st).await;

        assert!(st.vuln_scan_task.is_some());
        assert_eq!(st.last_vuln_scan, scheduled);
        st.vuln_scan_task.take().unwrap().abort();
    }
}
