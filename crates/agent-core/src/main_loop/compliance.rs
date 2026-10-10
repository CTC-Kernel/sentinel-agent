// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance stages of the main loop: the periodic check and the one the
//! operator asks for.

#[cfg(feature = "gui")]
use agent_gui::dto::GuiPolicySummary;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
#[cfg(feature = "gui")]
use agent_scanner::{CheckExecutionResult, ComplianceScore};
use std::sync::atomic::Ordering;
use tracing::info;

use super::{LoopPass, LoopState};
use crate::AgentRuntime;

/// The checks of a compliance run counted by outcome; what is neither
/// passed, failed nor in error is pending.
#[cfg(feature = "gui")]
fn policy_summary(score: &ComplianceScore) -> GuiPolicySummary {
    let total = u32::try_from(score.total_count).unwrap_or(u32::MAX);
    GuiPolicySummary {
        total_policies: total,
        passing: u32::try_from(score.passed_count).unwrap_or(u32::MAX),
        failing: u32::try_from(score.failed_count).unwrap_or(u32::MAX),
        errors: u32::try_from(score.error_count).unwrap_or(u32::MAX),
        pending: {
            let passed = u32::try_from(score.passed_count).unwrap_or(u32::MAX);
            let failed = u32::try_from(score.failed_count).unwrap_or(u32::MAX);
            let errored = u32::try_from(score.error_count).unwrap_or(u32::MAX);
            total.saturating_sub(passed.saturating_add(failed).saturating_add(errored))
        },
    }
}

/// Notification shown when a compliance run ends: its text and its
/// severity (a warning below 80 %).
#[cfg(feature = "gui")]
fn compliance_notification(score: &ComplianceScore) -> (String, &'static str) {
    (
        format!(
            "Score: {:.1}% ({} passés, {} échoués)",
            score.score, score.passed_count, score.failed_count
        ),
        if score.score >= 80.0 {
            "info"
        } else {
            "warning"
        },
    )
}

impl AgentRuntime {
    /// Run the compliance checks when their interval has passed (skipped
    /// when paused): results are stored, uploaded, turned into risks and
    /// shown.
    pub(crate) async fn compliance_stage(&self, st: &mut LoopState, pass: &mut LoopPass) {
        if !pass.is_paused
            && st.last_compliance_check.elapsed().as_secs() >= self.state.get_check_interval()
        {
            pass.is_active = true;
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

            let (check_results, score) = self.run_compliance_checks().await;
            st.compliance_score = Some(score.score);
            st.last_compliance_check_at = Some(chrono::Utc::now());

            self.store_check_results(&check_results).await;
            self.upload_check_results().await;

            // Auto-generate risks from failing checks and queue for platform sync
            self.auto_generate_risks(&check_results).await;

            #[cfg(feature = "gui")]
            self.publish_compliance(st, pass, &check_results, &score, false);

            st.last_compliance_check = std::time::Instant::now();
        }
    }

    /// The check the operator asked for ("Vérifier maintenant"): start the
    /// vulnerability scan unless one is running, then run the compliance
    /// checks at once, paused or not.
    pub(crate) async fn forced_check_stage(&self, st: &mut LoopState, pass: &mut LoopPass) {
        if self.state.force_check.load(Ordering::Acquire) {
            info!("Force check triggered");
            pass.is_active = true;
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

            // The vulnerability scan runs in the background task; its
            // results are published when the task is collected by the loop.
            if st.vuln_scan_task.is_none() {
                self.start_vuln_scan(st);
            } else {
                info!("Vulnerability scan already running, not starting another one");
            }

            let (check_results, score) = self.run_compliance_checks().await;
            st.compliance_score = Some(score.score);
            st.last_compliance_check_at = Some(chrono::Utc::now());
            self.store_check_results(&check_results).await;
            self.upload_check_results().await;

            #[cfg(feature = "gui")]
            {
                // Still "scanning" while the vulnerability task runs.
                let still_scanning = st.vuln_scan_task.is_some();
                self.publish_compliance(st, pass, &check_results, &score, still_scanning);
            }
            st.last_vuln_scan = std::time::Instant::now();
            st.last_compliance_check = std::time::Instant::now();
            self.state.force_check.store(false, Ordering::Release);
        }
    }

    /// Show the results of a compliance run: each check, the notification,
    /// the status and the KPI snapshot. `still_scanning` keeps the agent
    /// shown as scanning when another scan is running.
    #[cfg(feature = "gui")]
    fn publish_compliance(
        &self,
        st: &mut LoopState,
        pass: &LoopPass,
        check_results: &[CheckExecutionResult],
        score: &ComplianceScore,
        still_scanning: bool,
    ) {
        st.gui.cached_policy_summary = Some(policy_summary(score));

        for exec_result in check_results {
            let gui_result = self.execution_result_to_gui(exec_result);
            self.emit_gui_event(AgentEvent::CheckCompleted { result: gui_result });
        }
        st.gui.last_check_at = Some(chrono::Utc::now());
        self.state.scanning.store(still_scanning, Ordering::Release);
        let (message, severity) = compliance_notification(score);
        self.emit_notification("Compliance vérifiée", &message, severity);
        self.emit_status_update(
            st.gui.last_check_at,
            st.compliance_score,
            st.gui.cached_pending_sync,
            st.gui.cached_policy_summary,
        );
        self.emit_kpi_snapshot(
            st.compliance_score,
            pass.kpi_incident_count,
            st.gui.kpi_open_vulns,
            0,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::time::Instant;

    #[cfg(feature = "gui")]
    fn score(
        value: f64,
        passed: usize,
        failed: usize,
        errors: usize,
        total: usize,
    ) -> ComplianceScore {
        ComplianceScore {
            score: value,
            previous_score: None,
            delta: None,
            passed_count: passed,
            failed_count: failed,
            error_count: errors,
            skipped_count: 0,
            total_count: total,
            category_scores: Default::default(),
            framework_scores: Default::default(),
            calculated_at: chrono::Utc::now(),
        }
    }

    #[cfg(feature = "gui")]
    #[test]
    fn checks_without_an_outcome_are_pending() {
        let summary = policy_summary(&score(75.0, 20, 6, 2, 34));
        assert_eq!(summary.total_policies, 34);
        assert_eq!(
            (summary.passing, summary.failing, summary.errors),
            (20, 6, 2)
        );
        assert_eq!(summary.pending, 6);
        // Never below zero when the counts overlap.
        assert_eq!(policy_summary(&score(100.0, 30, 6, 2, 34)).pending, 0);
    }

    #[cfg(feature = "gui")]
    #[test]
    fn a_score_below_80_is_a_warning() {
        assert_eq!(
            compliance_notification(&score(91.25, 31, 3, 0, 34)),
            ("Score: 91.2% (31 passés, 3 échoués)".to_string(), "info")
        );
        assert_eq!(
            compliance_notification(&score(80.0, 27, 7, 0, 34)).1,
            "info"
        );
        assert_eq!(
            compliance_notification(&score(79.9, 27, 7, 0, 34)).1,
            "warning"
        );
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn a_compliance_run_is_shown_with_its_summary_and_kpi() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        st.compliance_score = Some(91.25);
        st.gui.kpi_open_vulns = 4;
        test.runtime.state.scanning.store(true, Ordering::Release);
        let mut pass = LoopPass::new(false);
        pass.kpi_incident_count = 2;

        test.runtime
            .publish_compliance(&mut st, &pass, &[], &score(91.25, 31, 3, 0, 34), false);

        assert_eq!(st.gui.cached_policy_summary.map(|s| s.passing), Some(31));
        assert!(st.gui.last_check_at.is_some());
        assert!(!test.runtime.state.scanning.load(Ordering::Acquire));
        match test.events.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.title, "Compliance vérifiée");
            }
            other => panic!("expected a notification, got {:?}", other.map(|_| ())),
        }
        assert!(matches!(
            test.events.try_recv(),
            Ok(AgentEvent::StatusChanged { .. })
        ));
        match test.events.try_recv() {
            Ok(AgentEvent::KpiSnapshot { snapshot }) => {
                assert_eq!(snapshot.incident_count, 2);
                assert_eq!(snapshot.open_vulns, 4);
            }
            other => panic!("expected the KPI snapshot, got {:?}", other.map(|_| ())),
        }
    }

    #[tokio::test]
    async fn nothing_is_forced_unless_the_operator_asked() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let mut pass = LoopPass::new(false);

        test.runtime.forced_check_stage(&mut st, &mut pass).await;

        assert!(!pass.is_active);
        assert!(st.vuln_scan_task.is_none());
        assert_eq!(st.compliance_score, None);
    }

    #[tokio::test]
    async fn no_compliance_run_while_paused_or_before_its_interval() {
        let test = standalone_runtime();

        // Due, but the agent is paused.
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 0);
        let due = st.last_compliance_check;
        let mut paused = LoopPass::new(true);
        test.runtime.compliance_stage(&mut st, &mut paused).await;
        assert!(!paused.is_active);
        assert_eq!(st.last_compliance_check, due);

        // Running, but checked a moment ago.
        st.last_compliance_check = Instant::now();
        let mut pass = LoopPass::new(false);
        test.runtime.compliance_stage(&mut st, &mut pass).await;
        assert!(!pass.is_active);
        assert_eq!(st.compliance_score, None);
    }
}
