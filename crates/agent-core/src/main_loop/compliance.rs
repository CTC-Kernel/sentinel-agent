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
#[cfg(feature = "gui")]
use tracing::warn;
use tracing::{error, info};

use super::job::Job;
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
    checks: Job<ComplianceOutcome>,
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
        Self {
            checks: Job::start(tasks, COMPLIANCE_TASK, checks),
            forced,
        }
    }

    /// `None` while the checks are running; then their outcome, itself
    /// `None` when the task ended without one (it panicked or was aborted).
    fn finished(&mut self) -> Option<Option<ComplianceOutcome>> {
        self.checks.finished()
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
                {
                    self.publish_compliance(st, &check_results, &score, still_scanning);
                    let (incidents, open_vulns) = (pass.kpi_incident_count, st.gui.kpi_open_vulns);
                    self.record_kpi_snapshot(st.compliance_score, incidents, open_vulns)
                        .await;
                }
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

    /// Show the results of a compliance run: each check, the notification
    /// and the status. `still_scanning` keeps the agent
    /// shown as scanning when another scan is running.
    #[cfg(feature = "gui")]
    fn publish_compliance(
        &self,
        st: &mut LoopState,
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
        self.emit_notification("Conformité vérifiée", &message, severity);
        self.emit_status_update(
            st.gui.last_check_at,
            st.compliance_score,
            st.gui.cached_pending_sync,
            st.gui.cached_policy_summary,
        );
    }

    /// Take the KPI snapshot of a compliance run: shown on the dashboard and
    /// stored, so the trends survive a restart.
    #[cfg(feature = "gui")]
    ///
    /// Takes the figures by value: the loop state is not shared across an
    /// await.
    pub(crate) async fn record_kpi_snapshot(
        &self,
        compliance_score: Option<f64>,
        incident_count: u32,
        open_vulns: u32,
    ) {
        let sla = match self.db.as_ref() {
            Some(db) => match agent_storage::repositories::grc::RiskRepository::new(db)
                .get_all()
                .await
            {
                Ok(risks) => remediation_sla_pct(&risks, chrono::Utc::now()),
                Err(e) => {
                    warn!("Risks not read for the remediation SLA: {}", e);
                    None
                }
            },
            None => None,
        };
        let snapshot = self.emit_kpi_snapshot(compliance_score, incident_count, open_vulns, 0, sla);
        let Some(db) = self.db.as_ref() else {
            return;
        };
        let stored = agent_storage::repositories::grc::StoredKpiSnapshot {
            id: 0,
            timestamp: snapshot.timestamp.to_rfc3339(),
            compliance_score: f64::from(snapshot.compliance_score),
            incident_count: i32::try_from(snapshot.incident_count).unwrap_or(i32::MAX),
            open_vulns: i32::try_from(snapshot.open_vulns).unwrap_or(i32::MAX),
            closed_vulns: i32::try_from(snapshot.closed_vulns).unwrap_or(i32::MAX),
            remediation_sla_pct: f64::from(snapshot.remediation_sla_pct),
            synced: false,
        };
        if let Err(e) = agent_storage::repositories::grc::KpiSnapshotRepository::new(db)
            .insert(&stored)
            .await
        {
            warn!("KPI snapshot not stored: {}", e);
        }
        self.prune_kpi_snapshots(db).await;
    }

    /// Keep the KPI table bounded: see [`kpi_rows_to_prune`].
    #[cfg(feature = "gui")]
    async fn prune_kpi_snapshots(&self, db: &agent_storage::Database) {
        let repo = agent_storage::repositories::grc::KpiSnapshotRepository::new(db);
        let stored = match repo.get_all().await {
            Ok(stored) => stored,
            Err(e) => {
                warn!("KPI snapshots not read for pruning: {}", e);
                return;
            }
        };
        for id in kpi_rows_to_prune(&stored, chrono::Utc::now()) {
            if let Err(e) = repo.delete(id).await {
                warn!("KPI snapshot {} not pruned: {}", id, e);
                return;
            }
        }
    }

    /// Show the KPI snapshots of the previous sessions: the last one of each
    /// day over [`KPI_HISTORY_DAYS`], oldest first.
    #[cfg(feature = "gui")]
    pub(crate) async fn load_kpi_history(&self) {
        let Some(db) = self.db.as_ref() else {
            return;
        };
        let stored = match agent_storage::repositories::grc::KpiSnapshotRepository::new(db)
            .get_all()
            .await
        {
            Ok(stored) => stored,
            Err(e) => {
                warn!("KPI history not loaded: {}", e);
                return;
            }
        };
        let history = kpi_history(&stored, chrono::Utc::now());
        info!("Loaded {} KPI snapshots from database", history.len());
        for snapshot in history {
            self.emit_gui_event(AgentEvent::KpiSnapshot {
                snapshot: Box::new(snapshot),
            });
        }
    }
}

/// Days of KPI history shown again at startup: the dashboard's longest period.
#[cfg(feature = "gui")]
const KPI_HISTORY_DAYS: i64 = 90;

/// Days during which every KPI snapshot is kept; beyond, one per day.
#[cfg(feature = "gui")]
const KPI_FULL_DETAIL_DAYS: i64 = 7;

/// Days after which a KPI snapshot is dropped.
#[cfg(feature = "gui")]
const KPI_RETENTION_DAYS: i64 = 400;

/// Identifiers of the stored snapshots to delete so the table stays bounded:
/// those older than [`KPI_RETENTION_DAYS`], those whose date cannot be read,
/// and, beyond [`KPI_FULL_DETAIL_DAYS`], all but the last one of each day.
#[cfg(feature = "gui")]
fn kpi_rows_to_prune(
    stored: &[agent_storage::repositories::grc::StoredKpiSnapshot],
    now: chrono::DateTime<chrono::Utc>,
) -> Vec<i64> {
    let detail_cutoff = now - chrono::Duration::days(KPI_FULL_DETAIL_DAYS);
    let retention_cutoff = now - chrono::Duration::days(KPI_RETENTION_DAYS);
    let mut prune = Vec::new();
    // Last snapshot of each day older than the detail window: (date, id).
    let mut kept_per_day: std::collections::BTreeMap<
        chrono::NaiveDate,
        (chrono::DateTime<chrono::Utc>, i64),
    > = std::collections::BTreeMap::new();
    for row in stored {
        let Ok(at) = chrono::DateTime::parse_from_rfc3339(&row.timestamp) else {
            prune.push(row.id);
            continue;
        };
        let at = at.with_timezone(&chrono::Utc);
        if at < retention_cutoff {
            prune.push(row.id);
        } else if at < detail_cutoff {
            match kept_per_day.get_mut(&at.date_naive()) {
                // Later the same day (or the same instant, stored later):
                // this row replaces the one kept so far.
                Some(kept) if (at, row.id) >= *kept => {
                    prune.push(kept.1);
                    *kept = (at, row.id);
                }
                Some(_) => prune.push(row.id),
                None => {
                    kept_per_day.insert(at.date_naive(), (at, row.id));
                }
            }
        }
    }
    prune.sort_unstable();
    prune
}

/// The stored snapshots to show at startup: the last one of each day over
/// the last [`KPI_HISTORY_DAYS`], oldest first. A row whose date cannot be
/// read is left out.
#[cfg(feature = "gui")]
fn kpi_history(
    stored: &[agent_storage::repositories::grc::StoredKpiSnapshot],
    now: chrono::DateTime<chrono::Utc>,
) -> Vec<agent_gui::dto::KpiSnapshot> {
    let cutoff = now - chrono::Duration::days(KPI_HISTORY_DAYS);
    let mut by_day = std::collections::BTreeMap::new();
    for row in stored {
        let Ok(at) = chrono::DateTime::parse_from_rfc3339(&row.timestamp) else {
            continue;
        };
        let at = at.with_timezone(&chrono::Utc);
        if at < cutoff || at > now {
            continue;
        }
        let snapshot = agent_gui::dto::KpiSnapshot {
            timestamp: at,
            compliance_score: row.compliance_score as f32,
            incident_count: u32::try_from(row.incident_count).unwrap_or(0),
            open_vulns: u32::try_from(row.open_vulns).unwrap_or(0),
            closed_vulns: u32::try_from(row.closed_vulns).unwrap_or(0),
            remediation_sla_pct: row.remediation_sla_pct as f32,
        };
        let latest = by_day
            .entry(at.date_naive())
            .or_insert_with(|| snapshot.clone());
        if snapshot.timestamp >= latest.timestamp {
            *latest = snapshot;
        }
    }
    by_day.into_values().collect()
}

/// Share (0–100) of the risks carrying an SLA target that respect it, or
/// `None` when no risk carries one.
///
/// A risk still open or being mitigated respects its target while it is
/// younger than the target. A closed or accepted risk respects it when it
/// was treated in time; its last update stands for the treatment date, the
/// only one the register keeps.
#[cfg(feature = "gui")]
fn remediation_sla_pct(
    risks: &[agent_storage::repositories::grc::StoredRisk],
    now: chrono::DateTime<chrono::Utc>,
) -> Option<f32> {
    let parse = |value: &str| {
        chrono::DateTime::parse_from_rfc3339(value)
            .ok()
            .map(|at| at.with_timezone(&chrono::Utc))
    };
    let mut measured = 0u32;
    let mut within = 0u32;
    for risk in risks {
        let Some(target) = risk.sla_target_days.filter(|days| *days > 0) else {
            continue;
        };
        let Some(created) = parse(&risk.created_at) else {
            continue;
        };
        let treated = matches!(
            risk.status.to_ascii_lowercase().as_str(),
            "closed" | "accepted"
        );
        let until = if treated {
            parse(&risk.updated_at).unwrap_or(now)
        } else {
            now
        };
        measured += 1;
        if until - created <= chrono::Duration::days(i64::from(target)) {
            within += 1;
        }
    }
    (measured > 0).then(|| within as f32 * 100.0 / measured as f32)
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
            .publish_compliance(&mut st, &[], &score(91.25, 31, 3, 0, 34), false);
        test.runtime
            .record_kpi_snapshot(st.compliance_score, pass.kpi_incident_count, 4)
            .await;

        assert_eq!(st.gui.cached_policy_summary.map(|s| s.passing), Some(31));
        assert!(st.gui.last_check_at.is_some());
        assert!(!test.runtime.state.scanning.load(Ordering::Acquire));
        match test.events.try_recv() {
            Ok(AgentEvent::Notification { notification }) => {
                assert_eq!(notification.title, "Conformité vérifiée");
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
                // No risk carries an SLA target: nothing to measure.
                assert!(snapshot.remediation_sla_pct < 0.0);
            }
            other => panic!("expected the KPI snapshot, got {:?}", other.map(|_| ())),
        }

        // The snapshot was stored: the next start shows it again.
        test.runtime.load_kpi_history().await;
        match test.events.try_recv() {
            Ok(AgentEvent::KpiSnapshot { snapshot }) => {
                assert_eq!(snapshot.incident_count, 2);
                assert!((snapshot.compliance_score - 91.25).abs() < 0.01);
            }
            other => panic!("expected the stored snapshot, got {:?}", other.map(|_| ())),
        }
    }

    #[cfg(feature = "gui")]
    fn stored_snapshot(
        timestamp: &str,
        incidents: i32,
    ) -> agent_storage::repositories::grc::StoredKpiSnapshot {
        agent_storage::repositories::grc::StoredKpiSnapshot {
            id: 0,
            timestamp: timestamp.to_string(),
            compliance_score: 80.0,
            incident_count: incidents,
            open_vulns: 0,
            closed_vulns: 0,
            remediation_sla_pct: -1.0,
            synced: false,
        }
    }

    #[cfg(feature = "gui")]
    #[test]
    fn kpi_history_keeps_the_last_snapshot_of_each_recent_day() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-30T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let history = kpi_history(
            &[
                stored_snapshot("2026-06-29T18:00:00+00:00", 2),
                stored_snapshot("2026-06-29T06:00:00+00:00", 1),
                stored_snapshot("2026-06-30T08:00:00+00:00", 3),
                // Older than the longest period, unreadable, in the future.
                stored_snapshot("2026-01-01T00:00:00+00:00", 9),
                stored_snapshot("hier", 9),
                stored_snapshot("2026-07-02T00:00:00+00:00", 9),
            ],
            now,
        );
        let incidents: Vec<u32> = history.iter().map(|s| s.incident_count).collect();
        assert_eq!(incidents, [2, 3]);
    }

    #[cfg(feature = "gui")]
    #[test]
    fn old_kpi_snapshots_are_thinned_to_one_a_day_then_dropped() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-30T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let row = |id: i64, timestamp: &str| {
            let mut row = stored_snapshot(timestamp, 0);
            row.id = id;
            row
        };
        let stored = [
            // Within the last days: all kept.
            row(1, "2026-06-30T06:00:00+00:00"),
            row(2, "2026-06-30T08:00:00+00:00"),
            row(3, "2026-06-25T01:00:00+00:00"),
            row(4, "2026-06-25T02:00:00+00:00"),
            // Older: only the last of each day stays (7 and 8).
            row(5, "2026-05-10T01:00:00+00:00"),
            row(6, "2026-05-10T09:00:00+00:00"),
            row(7, "2026-05-10T23:00:00+00:00"),
            row(8, "2026-05-11T04:00:00+00:00"),
            // Past the retention, and unreadable.
            row(9, "2025-01-01T00:00:00+00:00"),
            row(10, "hier"),
        ];
        assert_eq!(kpi_rows_to_prune(&stored, now), [5, 6, 9, 10]);
        // Nothing left to prune once it has been applied.
        let kept: Vec<_> = stored
            .iter()
            .filter(|row| ![5, 6, 9, 10].contains(&row.id))
            .cloned()
            .collect();
        assert!(kpi_rows_to_prune(&kept, now).is_empty());
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn pruning_deletes_the_rows_from_the_database() {
        let test = standalone_runtime();
        let repo = agent_storage::repositories::grc::KpiSnapshotRepository::new(&test.db);
        let old = chrono::Utc::now() - chrono::Duration::days(500);
        repo.insert(&stored_snapshot(&old.to_rfc3339(), 1))
            .await
            .unwrap();
        repo.insert(&stored_snapshot(&chrono::Utc::now().to_rfc3339(), 2))
            .await
            .unwrap();

        test.runtime.prune_kpi_snapshots(&test.db).await;

        let left = repo.get_all().await.unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].incident_count, 2);
    }

    #[cfg(feature = "gui")]
    #[test]
    fn the_remediation_sla_counts_the_risks_within_their_target() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-30T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let risk = |status: &str, created: &str, updated: &str, target: Option<i32>| {
            agent_storage::repositories::grc::StoredRisk {
                id: String::new(),
                title: String::new(),
                description: String::new(),
                probability: 1,
                impact: 1,
                owner: String::new(),
                status: status.to_string(),
                mitigation: String::new(),
                source: String::new(),
                created_at: created.to_string(),
                updated_at: updated.to_string(),
                sla_target_days: target,
                synced: false,
            }
        };
        let (june_1, june_5, june_25) = (
            "2026-06-01T00:00:00+00:00",
            "2026-06-05T00:00:00+00:00",
            "2026-06-25T00:00:00+00:00",
        );
        // Without any target, there is nothing to measure.
        assert_eq!(
            remediation_sla_pct(&[risk("open", june_1, june_1, None)], now),
            None
        );
        let risks = [
            // Open for 29 days against 7: late.
            risk("open", june_1, june_1, Some(7)),
            // Open for 5 days against 30: in time.
            risk("Mitigating", june_25, june_25, Some(30)),
            // Closed after 4 days against 7: in time.
            risk("Closed", june_1, june_5, Some(7)),
            // Accepted after 24 days against 7: late.
            risk("accepted", june_1, june_25, Some(7)),
            // No target, no readable date: not measured.
            risk("open", june_1, june_1, None),
            risk("open", "?", june_1, Some(7)),
        ];
        assert_eq!(remediation_sla_pct(&risks, now), Some(50.0));
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
