// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Scan stages of the main loop: the background vulnerability scan and the
//! periodic security scan.

#[cfg(feature = "gui")]
use agent_gui::dto::GuiVulnerabilitySummary;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_scanner::VulnerabilityScanResult;
#[cfg(feature = "gui")]
use std::sync::atomic::Ordering;
use tracing::{error, info, warn};

use super::LoopState;
use crate::AgentRuntime;

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use agent_common::error::CommonError;
    use agent_scanner::{ScanType, Severity, VulnerabilityFinding, VulnerabilityScanResult};
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
