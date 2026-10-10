// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Compliance stages of the main loop: the periodic check and the one the
//! operator asks for.

#[cfg(feature = "gui")]
use agent_gui::dto::GuiPolicySummary;
#[cfg(feature = "gui")]
use agent_gui::events::AgentEvent;
use agent_scanner::{CheckExecutionResult, ComplianceScore};
use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tokio::sync::oneshot;
use tracing::{error, info};

use super::{LoopPass, LoopState};
use crate::AgentRuntime;
use crate::supervised_tasks::TaskSet;

/// Name of the background task that runs the compliance checks.
const COMPLIANCE_TASK: &str = "compliance checks";

/// What a compliance run produces: the result of each check and the score.
type ComplianceOutcome = (Vec<CheckExecutionResult>, ComplianceScore);

/// The compliance checks running in the background, from their start to the
/// pass that collects their results.
pub(crate) struct ComplianceTask {
    outcome: oneshot::Receiver<ComplianceOutcome>,
    /// Asked for by the operator: it generates no risks, and the forced
    /// check ends with it.
    forced: bool,
}

impl ComplianceTask {
    /// Run `checks` in a task of `tasks`.
    pub(crate) fn start(
        tasks: &mut TaskSet,
        forced: bool,
        checks: impl Future<Output = ComplianceOutcome> + Send + 'static,
    ) -> Self {
        let (done, outcome) = oneshot::channel();
        tasks.spawn(COMPLIANCE_TASK, async move {
            // Nobody is waiting any more when the loop has stopped.
            let _ = done.send(checks.await);
        });
        Self { outcome, forced }
    }

    /// `None` while the checks are running; then their outcome, itself
    /// `None` when the task ended without one (it panicked or was aborted).
    fn finished(&mut self) -> Option<Option<ComplianceOutcome>> {
        match self.outcome.try_recv() {
            Ok(outcome) => Some(Some(outcome)),
            Err(oneshot::error::TryRecvError::Empty) => None,
            Err(oneshot::error::TryRecvError::Closed) => Some(None),
        }
    }
}

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
    /// Start the periodic compliance checks when their interval has passed
    /// (skipped when paused, or while checks are already running).
    pub(crate) fn compliance_stage(self: &Arc<Self>, st: &mut LoopState, pass: &LoopPass) {
        if !pass.is_paused
            && st.compliance_task.is_none()
            && st.last_compliance_check.elapsed().as_secs() >= self.state.get_check_interval()
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
            self.start_compliance_checks(st, false);
        }
    }

    /// The check the operator asked for ("Vérifier maintenant"): start the
    /// vulnerability scan unless one is running, and the compliance checks,
    /// paused or not. Checks already running are left to finish first.
    pub(crate) fn forced_check_stage(self: &Arc<Self>, st: &mut LoopState) {
        if self.state.force_check.load(Ordering::Acquire) && st.compliance_task.is_none() {
            info!("Force check triggered");
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

            self.start_compliance_checks(st, true);
        }
    }

    /// Run the compliance checks in a background task of the loop: with
    /// dozens of checks, some of them slow, they take minutes.
    fn start_compliance_checks(self: &Arc<Self>, st: &mut LoopState, forced: bool) {
        let runtime = Arc::clone(self);
        st.compliance_task = Some(ComplianceTask::start(&mut st.tasks, forced, async move {
            runtime.run_compliance_checks().await
        }));
    }

    /// Collect the compliance checks once they are done: results are
    /// stored, uploaded, turned into risks (periodic check only) and shown.
    /// A forced check ends here.
    pub(crate) async fn collect_compliance(&self, st: &mut LoopState, pass: &mut LoopPass) {
        let Some(outcome) = st
            .compliance_task
            .as_mut()
            .and_then(ComplianceTask::finished)
        else {
            return;
        };
        let forced = st.compliance_task.take().is_some_and(|task| task.forced);
        // Still "scanning" while the vulnerability task of a forced check runs.
        #[cfg(feature = "gui")]
        let still_scanning = forced && st.vuln_scan_task.is_some();
        match outcome {
            Some((check_results, score)) => {
                pass.is_active = true;
                st.compliance_score = Some(score.score);
                st.last_compliance_check_at = Some(chrono::Utc::now());

                self.store_check_results(&check_results).await;
                self.upload_check_results().await;

                if !forced {
                    // Auto-generate risks from failing checks and queue for platform sync
                    self.auto_generate_risks(&check_results).await;
                }

                #[cfg(feature = "gui")]
                self.publish_compliance(st, pass, &check_results, &score, still_scanning);
            }
            // The panic itself is logged by the task set, under the task's
            // name.
            None => {
                error!("Compliance check task aborted");
                #[cfg(feature = "gui")]
                {
                    self.state.scanning.store(still_scanning, Ordering::Release);
                    self.emit_status_update(
                        st.gui.last_check_at,
                        st.compliance_score,
                        st.gui.cached_pending_sync,
                        st.gui.cached_policy_summary,
                    );
                }
            }
        }
        if forced {
            st.last_vuln_scan = std::time::Instant::now();
            self.state.force_check.store(false, Ordering::Release);
        }
        st.last_compliance_check = std::time::Instant::now();
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

    /// Give `st` a compliance task that has already ended as `checks` does.
    async fn finished_checks(
        st: &mut LoopState,
        forced: bool,
        checks: impl Future<Output = ComplianceOutcome> + Send + 'static,
    ) {
        let task = ComplianceTask::start(&mut st.tasks, forced, checks);
        while !st.tasks.is_empty() {
            tokio::task::yield_now().await;
            st.tasks.reap();
        }
        st.compliance_task = Some(task);
    }

    fn overdue_state() -> LoopState {
        LoopState::starting_at(Instant::now(), 6 * 3600, 0)
    }

    /// A state whose compliance checks are due, as at start-up. `None` on a
    /// clock too young to be set one interval back (Windows shortly after
    /// boot): the first checks then wait a full interval.
    fn due_state(runtime: &AgentRuntime) -> Option<LoopState> {
        let interval = runtime.state.get_check_interval();
        let st = LoopState::starting_at(Instant::now(), 6 * 3600, interval);
        (st.last_compliance_check.elapsed().as_secs() >= interval).then_some(st)
    }

    #[tokio::test]
    async fn finished_checks_are_collected_into_the_state() {
        let test = standalone_runtime();
        let mut st = overdue_state();
        let before = st.last_compliance_check;
        finished_checks(&mut st, false, async {
            (Vec::new(), score(91.25, 31, 3, 0, 34))
        })
        .await;
        let mut pass = LoopPass::new(false);

        test.runtime.collect_compliance(&mut st, &mut pass).await;

        assert!(st.compliance_task.is_none());
        assert_eq!(st.compliance_score, Some(91.25));
        assert!(st.last_compliance_check_at.is_some());
        assert!(st.last_compliance_check > before);
        // The pass that collects is the one whose resource usage is checked.
        assert!(pass.is_active);
        #[cfg(feature = "gui")]
        {
            assert!(!test.runtime.state.scanning.load(Ordering::Acquire));
            assert_eq!(st.gui.cached_policy_summary.map(|s| s.failing), Some(3));
        }
    }

    #[tokio::test]
    async fn a_forced_check_ends_when_its_checks_are_collected() {
        let test = standalone_runtime();
        let mut st = overdue_state();
        test.runtime
            .state
            .force_check
            .store(true, Ordering::Release);
        let scheduled_scan = st.last_vuln_scan;
        finished_checks(&mut st, true, async {
            (Vec::new(), score(70.0, 24, 10, 0, 34))
        })
        .await;

        test.runtime
            .collect_compliance(&mut st, &mut LoopPass::new(true))
            .await;

        assert!(!test.runtime.state.force_check.load(Ordering::Acquire));
        assert_eq!(st.compliance_score, Some(70.0));
        // The next periodic vulnerability scan counts from the forced check.
        assert!(st.last_vuln_scan > scheduled_scan);
    }

    #[tokio::test]
    async fn checks_that_panic_are_collected_as_aborted_and_reported() {
        use crate::supervised_tasks::TaskEvent;
        let test = standalone_runtime();
        let mut st = overdue_state();
        let before = st.last_compliance_check;
        let task = ComplianceTask::start(&mut st.tasks, false, async { panic!("check bug") });
        let mut reported = Vec::new();
        while reported.is_empty() {
            tokio::task::yield_now().await;
            reported = st.tasks.reap();
        }
        st.compliance_task = Some(task);
        let mut pass = LoopPass::new(false);

        test.runtime.collect_compliance(&mut st, &mut pass).await;

        assert_eq!(
            reported,
            vec![TaskEvent::Panicked {
                name: COMPLIANCE_TASK.to_string(),
                message: "check bug".to_string(),
                restarted: false,
            }]
        );
        // No result, and the next run waits for its usual interval.
        assert!(st.compliance_task.is_none());
        assert_eq!(st.compliance_score, None);
        assert!(st.last_compliance_check > before);
        assert!(!pass.is_active);
    }

    #[tokio::test]
    async fn running_checks_are_left_alone() {
        let test = standalone_runtime();
        let mut st = overdue_state();
        let before = st.last_compliance_check;
        st.compliance_task = Some(ComplianceTask::start(
            &mut st.tasks,
            false,
            std::future::pending(),
        ));

        test.runtime
            .collect_compliance(&mut st, &mut LoopPass::new(false))
            .await;

        assert!(st.compliance_task.is_some());
        assert_eq!(st.last_compliance_check, before);
        st.tasks.shutdown().await;
    }

    #[tokio::test]
    async fn due_checks_start_in_the_background_once() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let Some(mut st) = due_state(&runtime) else {
            return;
        };

        runtime.compliance_stage(&mut st, &LoopPass::new(false));
        assert!(st.compliance_task.is_some());
        assert!(st.tasks.is_running(COMPLIANCE_TASK));
        // Still running at the next pass: no second run next to the first,
        // not even a forced one.
        runtime.compliance_stage(&mut st, &LoopPass::new(false));
        runtime.state.force_check.store(true, Ordering::Release);
        runtime.forced_check_stage(&mut st);
        assert_eq!(st.tasks.len(), 1);
        assert!(st.vuln_scan_task.is_none());

        // Stopped before they are ever polled: nothing is checked by this test.
        st.tasks.shutdown().await;
    }

    #[tokio::test]
    async fn nothing_is_forced_unless_the_operator_asked() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);

        runtime.forced_check_stage(&mut st);

        assert!(st.compliance_task.is_none());
        assert!(st.vuln_scan_task.is_none());
        assert_eq!(st.compliance_score, None);
    }

    #[tokio::test]
    async fn no_compliance_run_while_paused_or_before_its_interval() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);

        // Due, but the agent is paused.
        if let Some(mut st) = due_state(&runtime) {
            runtime.compliance_stage(&mut st, &LoopPass::new(true));
            assert!(st.compliance_task.is_none());
        }

        // Running, but checked a moment ago.
        let mut interval = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        interval.last_compliance_check = Instant::now();
        runtime.compliance_stage(&mut interval, &LoopPass::new(false));
        assert!(interval.compliance_task.is_none());
    }
}
