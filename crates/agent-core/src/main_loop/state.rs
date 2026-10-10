// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the main loop remembers from one pass to the next.

use std::time::{Duration, Instant};

use agent_common::error::CommonError;
use agent_scanner::VulnerabilityScanResult;

use crate::supervised_tasks::TaskSet;
use crate::threat_pipeline::RuleHitMemory;
use crate::{FIRST_UPDATE_CHECK_DELAY_SECS, UPDATE_CHECK_INTERVAL_SECS};

/// Interval between certificate renewal checks (daily).
pub(crate) const CERT_CHECK_INTERVAL_SECS: u64 = 24 * 3600;

/// `interval_secs` before `now`, so that a stage is due on the first pass.
/// Falls back to `now` on a clock that cannot go that far back.
fn already_due(now: Instant, interval_secs: u64) -> Instant {
    now.checked_sub(Duration::from_secs(interval_secs))
        .unwrap_or(now)
}

/// Schedule, running jobs and last results of the main loop.
pub(crate) struct LoopState {
    pub last_heartbeat: Instant,
    pub last_vuln_scan: Instant,
    /// Background vulnerability scan (see `VulnScanJob`); `Some` while running.
    pub vuln_scan_task:
        Option<tokio::task::JoinHandle<Result<VulnerabilityScanResult, CommonError>>>,
    pub last_compliance_check: Instant,
    pub last_cert_check: Instant,
    pub last_update_check: Instant,
    pub last_security_scan: Instant,
    pub last_network_static: Instant,
    pub last_network_connections: Instant,
    pub last_network_security: Instant,
    pub network_static_interval: Duration,
    pub network_connection_interval: Duration,
    pub network_security_interval: Duration,
    /// Log collector timer: OS event logs are polled at the configured interval.
    pub last_log_collection: Instant,
    pub compliance_score: Option<f64>,
    pub last_compliance_check_at: Option<chrono::DateTime<chrono::Utc>>,
    /// What the custom detection rules have already reported.
    pub rule_hit_memory: RuleHitMemory,
    /// Background tasks started by the loop; reaped at each pass, so a panic
    /// is logged and a task meant to keep running is started again.
    pub tasks: TaskSet,
    #[cfg(feature = "gui")]
    pub gui: GuiLoopState,
}

/// Values cached for the desktop interface between two passes.
#[cfg(feature = "gui")]
pub(crate) struct GuiLoopState {
    /// Updated after each heartbeat.
    pub cached_pending_sync: u32,
    /// Updated after each compliance check.
    pub cached_policy_summary: Option<agent_gui::dto::GuiPolicySummary>,
    pub kpi_open_vulns: u32,
    pub last_check_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_resource_update: Instant,
    pub fim_changes_today: u32,
    pub fim_last_day: u64,
    /// Fingerprints of the incidents reported by the previous scan. A
    /// persistent condition is re-detected on every scan; only notify when
    /// it is new (or reappears after having cleared).
    pub previous_incidents: std::collections::HashSet<String>,
    pub last_network_alert_count: u32,
}

impl LoopState {
    /// Schedule of a loop starting at `now`: the vulnerability scan and the
    /// compliance check are due on the first pass, the update check shortly
    /// after start-up, everything else one interval later.
    pub(crate) fn starting_at(
        now: Instant,
        vuln_scan_interval_secs: u64,
        check_interval_secs: u64,
    ) -> Self {
        Self {
            last_heartbeat: now,
            last_vuln_scan: already_due(now, vuln_scan_interval_secs),
            vuln_scan_task: None,
            last_compliance_check: already_due(now, check_interval_secs),
            last_cert_check: now,
            last_update_check: already_due(
                now,
                UPDATE_CHECK_INTERVAL_SECS - FIRST_UPDATE_CHECK_DELAY_SECS,
            ),
            last_security_scan: now,
            last_network_static: now,
            last_network_connections: now,
            last_network_security: now,
            network_static_interval: Duration::ZERO,
            network_connection_interval: Duration::ZERO,
            network_security_interval: Duration::ZERO,
            last_log_collection: now,
            compliance_score: None,
            last_compliance_check_at: None,
            rule_hit_memory: RuleHitMemory::default(),
            tasks: TaskSet::new("main loop"),
            #[cfg(feature = "gui")]
            gui: GuiLoopState {
                cached_pending_sync: 0,
                cached_policy_summary: None,
                kpi_open_vulns: 0,
                last_check_at: None,
                last_resource_update: now,
                fim_changes_today: 0,
                fim_last_day: chrono::Utc::now().timestamp().max(0) as u64
                    / agent_common::constants::SECS_PER_DAY,
                previous_incidents: std::collections::HashSet::new(),
                last_network_alert_count: 0,
            },
        }
    }

    /// Start the network collection timers at `now` with their first intervals.
    pub(crate) fn start_network_schedule(
        &mut self,
        now: Instant,
        static_interval: Duration,
        connection_interval: Duration,
        security_interval: Duration,
    ) {
        self.last_network_static = now;
        self.last_network_connections = now;
        self.last_network_security = now;
        self.network_static_interval = static_interval;
        self.network_connection_interval = connection_interval;
        self.network_security_interval = security_interval;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VULN_SCAN_INTERVAL_SECS: u64 = 6 * 3600;
    const CHECK_INTERVAL_SECS: u64 = 3600;

    /// A start far enough from the clock's origin for every stage to be
    /// scheduled in the past.
    fn start() -> Instant {
        Instant::now() + Duration::from_secs(24 * 3600)
    }

    fn state(now: Instant) -> LoopState {
        LoopState::starting_at(now, VULN_SCAN_INTERVAL_SECS, CHECK_INTERVAL_SECS)
    }

    #[test]
    fn scans_and_compliance_are_due_on_the_first_pass() {
        let now = start();
        let st = state(now);
        assert_eq!(
            now.duration_since(st.last_vuln_scan).as_secs(),
            VULN_SCAN_INTERVAL_SECS
        );
        assert_eq!(
            now.duration_since(st.last_compliance_check).as_secs(),
            CHECK_INTERVAL_SECS
        );
        assert!(st.vuln_scan_task.is_none());
    }

    #[test]
    fn first_update_check_waits_for_the_start_up_delay() {
        let now = start();
        let st = state(now);
        let waited = now.duration_since(st.last_update_check).as_secs();
        assert_eq!(
            UPDATE_CHECK_INTERVAL_SECS - waited,
            FIRST_UPDATE_CHECK_DELAY_SECS
        );
    }

    #[test]
    fn periodic_stages_wait_a_full_interval() {
        let now = start();
        let st = state(now);
        assert_eq!(st.last_heartbeat, now);
        assert_eq!(st.last_cert_check, now);
        assert_eq!(st.last_security_scan, now);
        assert_eq!(st.last_log_collection, now);
        assert_eq!(st.compliance_score, None);
        assert_eq!(st.last_compliance_check_at, None);
    }

    #[test]
    fn network_schedule_restarts_its_timers() {
        let now = start();
        let mut st = state(now);
        let later = now + Duration::from_secs(40);
        st.start_network_schedule(
            later,
            Duration::from_secs(900),
            Duration::from_secs(60),
            Duration::from_secs(300),
        );
        assert_eq!(st.last_network_static, later);
        assert_eq!(st.last_network_connections, later);
        assert_eq!(st.last_network_security, later);
        assert_eq!(st.network_static_interval, Duration::from_secs(900));
        assert_eq!(st.network_connection_interval, Duration::from_secs(60));
        assert_eq!(st.network_security_interval, Duration::from_secs(300));
        // The other timers are left alone.
        assert_eq!(st.last_heartbeat, now);
        assert_eq!(st.last_log_collection, now);
    }

    #[test]
    fn a_clock_too_young_for_the_interval_schedules_from_now() {
        let now = Instant::now();
        assert_eq!(already_due(now, u64::MAX), now);
    }
}
