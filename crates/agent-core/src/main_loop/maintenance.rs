// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Housekeeping stages of the main loop: self-update, asset proposals, the
//! agent's own resource usage and the upkeep of the local database.

use std::sync::Arc;
use std::sync::atomic::Ordering;
use tracing::{debug, warn};

use super::{LoopPass, LoopState, STORAGE_MAINTENANCE_INTERVAL_SECS};
use crate::{AgentRuntime, ProposeAssetData, UPDATE_CHECK_INTERVAL_SECS};

/// Name of the background task that checks for an update and installs it.
const UPDATE_TASK: &str = "self-update";

/// Name of the background task that maintains the local database.
const STORAGE_MAINTENANCE_TASK: &str = "storage maintenance";

/// What a round of storage maintenance did.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct StorageMaintenance {
    /// Sync queue items an outage had exhausted, offered again.
    pub rearmed: usize,
    /// Exhausted sync queue items deleted after their retention.
    pub purged: usize,
    /// Sync queue items still exhausted after this round.
    pub dead: i64,
    /// Proofs, check results and queue entries past the retention period,
    /// deleted.
    pub expired: usize,
}

impl AgentRuntime {
    /// Self-update, in a background task: at once when the operator asked
    /// for it, and as a periodic check of the public release catalog. One
    /// at a time: a request made while an update runs is served after it.
    pub(crate) fn update_stage(self: &Arc<Self>, st: &mut LoopState) {
        if st.tasks.is_running(UPDATE_TASK) {
            return;
        }
        let runtime = Arc::clone(self);
        // Check for force_update flag (trigger from GUI button)
        if self.state.force_update.swap(false, Ordering::AcqRel) {
            // Release discovery is public and does not require platform
            // enrollment, so standalone installations follow the same
            // signed self-update path as connected agents.
            st.tasks.spawn(UPDATE_TASK, async move {
                if let Err(e) = runtime.run_self_update().await {
                    warn!("Self-update failed: {}", e);
                }
            });
        }
        // Periodic background update check against the public catalog.
        else if st.last_update_check.elapsed().as_secs() >= UPDATE_CHECK_INTERVAL_SECS {
            st.last_update_check = std::time::Instant::now();
            st.tasks.spawn(UPDATE_TASK, async move {
                if let Err(e) = runtime.run_scheduled_update_check().await {
                    debug!("Scheduled update check did not complete: {}", e);
                }
            });
        }
    }

    /// Upkeep of the local database, in a background task: at start-up,
    /// then every [`STORAGE_MAINTENANCE_INTERVAL_SECS`]. One round at a time.
    pub(crate) fn storage_maintenance_stage(self: &Arc<Self>, st: &mut LoopState) {
        if st.last_storage_maintenance.elapsed().as_secs() < STORAGE_MAINTENANCE_INTERVAL_SECS
            || st.tasks.is_running(STORAGE_MAINTENANCE_TASK)
        {
            return;
        }
        st.last_storage_maintenance = std::time::Instant::now();
        let runtime = Arc::clone(self);
        st.tasks.spawn(STORAGE_MAINTENANCE_TASK, async move {
            runtime.run_storage_maintenance().await;
        });
    }

    /// One round of storage maintenance.
    ///
    /// Sync queue: the items an outage exhausted get their attempts back,
    /// those abandoned for longer than the retention are deleted, and what
    /// stays exhausted is counted and logged, so that it never goes unseen.
    /// Then the retention policy, which nothing applied before.
    pub(crate) async fn run_storage_maintenance(&self) -> StorageMaintenance {
        let mut done = StorageMaintenance::default();
        let Some(db) = self.db.as_ref() else {
            return done;
        };

        let queue = agent_storage::SyncQueueRepository::new(db);
        match queue.rearm_transiently_exhausted().await {
            Ok(rearmed) => done.rearmed = rearmed,
            Err(e) => warn!("Exhausted sync queue items could not be re-armed: {}", e),
        }
        match queue
            .purge_exhausted_older_than(agent_storage::EXHAUSTED_RETENTION_DAYS)
            .await
        {
            Ok(purged) => done.purged = purged,
            Err(e) => warn!("Abandoned sync queue items could not be purged: {}", e),
        }
        match queue.exhausted_count().await {
            Ok(dead) => {
                done.dead = dead;
                if dead > 0 {
                    warn!(
                        "{} sync queue item(s) were refused by the platform and are no longer \
                         sent; they are deleted {} days after their last attempt",
                        dead,
                        agent_storage::EXHAUSTED_RETENTION_DAYS
                    );
                }
            }
            Err(e) => warn!("Exhausted sync queue items could not be counted: {}", e),
        }

        // Retention (12 months): proofs past it, the check results they
        // leave without any proof, and their queue entries.
        match agent_storage::RetentionPolicy::new(db).execute().await {
            Ok(result) => done.expired = result.total_deleted(),
            Err(e) => warn!("Retention policy could not be applied: {}", e),
        }

        done
    }

    /// Send to the platform the discovered devices the operator proposed
    /// as assets since the last pass.
    pub(crate) async fn upload_asset_proposals(&self) {
        let proposals: Vec<ProposeAssetData> = {
            match self.pending_asset_proposals.lock() {
                Ok(mut queue) => queue.drain(..).collect(),
                Err(_) => Vec::new(),
            }
        };
        for proposal in proposals {
            if let Err(e) = self.upload_proposed_asset(&proposal).await {
                warn!("Failed to propose asset {}: {}", proposal.ip, e);
            }
        }
    }

    /// Measure the agent's own resource usage: checked against its limits
    /// when this pass ran a scan or a collection, and shown in the
    /// interface every second.
    #[cfg_attr(not(feature = "gui"), allow(unused_variables))]
    pub(crate) fn resource_stage(&self, st: &mut LoopState, pass: &LoopPass) {
        let usage = self.resource_monitor.get_usage();

        // Sync LLM loaded flag from runtime state to resource monitor
        self.resource_monitor
            .set_llm_loaded(self.state.llm_loaded.load(Ordering::Acquire));

        if pass.is_active {
            self.resource_monitor
                .check_limits_with_usage(&usage, pass.is_active);
        }

        // Periodically push resource usage to the GUI (every 1 second)
        #[cfg(feature = "gui")]
        if st.gui.last_resource_update.elapsed().as_secs() >= 1 {
            self.emit_resource_update(Some(usage));
            st.gui.last_resource_update = std::time::Instant::now();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::time::Instant;

    #[tokio::test]
    async fn proposed_assets_are_taken_from_the_queue() {
        let test = standalone_runtime();
        let handle = test.runtime.handle();
        handle.propose_asset("192.168.7.20".to_string(), None, "printer".to_string());
        handle.propose_asset(
            "192.168.7.1".to_string(),
            Some("box".to_string()),
            "router".to_string(),
        );

        test.runtime.upload_asset_proposals().await;

        assert!(
            test.runtime
                .pending_asset_proposals
                .lock()
                .unwrap()
                .is_empty()
        );
    }

    /// Queue an item and exhaust its single attempt with `error`.
    async fn exhausted_item(runtime: &AgentRuntime, entity_id: &str, error: &str) {
        let db = runtime.db.as_ref().unwrap();
        let queue = agent_storage::SyncQueueRepository::new(db);
        let entry = agent_storage::SyncQueueEntry::new(
            agent_storage::SyncEntityType::CheckResult,
            entity_id,
            "{}",
        )
        .with_max_attempts(1);
        let id = queue.enqueue(&entry).await.unwrap();
        queue.record_failure(id, error).await.unwrap();
    }

    #[tokio::test]
    async fn maintenance_rearms_what_an_outage_exhausted_and_counts_the_rest() {
        let test = standalone_runtime();
        exhausted_item(&test.runtime, "1", "Request timed out").await;
        exhausted_item(&test.runtime, "2", "Server error (status 400): refused").await;

        let done = test.runtime.run_storage_maintenance().await;

        assert_eq!(done.rearmed, 1);
        assert_eq!(done.purged, 0);
        assert_eq!(done.dead, 1);
    }

    #[tokio::test]
    async fn maintenance_applies_the_retention_policy() {
        use agent_storage::{
            CheckResult, CheckResultsRepository, CheckStatus, Proof, ProofsRepository,
        };
        let test = standalone_runtime();
        test.db
            .with_connection(|conn| {
                conn.execute(
                    "INSERT INTO check_rules (id, name, category, severity, check_type, version) \
                     VALUES ('test_rule', 'Test Rule', 'security', 'high', 'test', '1.0')",
                    [],
                )
                .map_err(|e| agent_storage::StorageError::Query(e.to_string()))
            })
            .await
            .unwrap();
        let results = CheckResultsRepository::new(&test.db);
        let proofs = ProofsRepository::new(&test.db);
        for days_ago in [400, 1] {
            let at = chrono::Utc::now() - chrono::Duration::days(days_ago);
            let result = CheckResult::new("test_rule", CheckStatus::Pass).with_executed_at(at);
            let id = results.insert(&result).await.unwrap();
            proofs
                .insert(&Proof::with_timestamp(id, "{}", at))
                .await
                .unwrap();
        }

        let done = test.runtime.run_storage_maintenance().await;

        // The proof older than 12 months and the check result it belonged to.
        assert_eq!(done.expired, 2);
        assert_eq!(proofs.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn storage_maintenance_runs_at_the_first_pass_then_waits() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);

        runtime.storage_maintenance_stage(&mut st);
        assert!(st.last_storage_maintenance.elapsed().as_secs() < 60);
        let started = st.last_storage_maintenance;

        runtime.storage_maintenance_stage(&mut st);
        assert_eq!(st.last_storage_maintenance, started);
        st.tasks.shutdown().await;
    }

    #[tokio::test]
    async fn the_resource_monitor_follows_the_llm_flag() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let idle = test.runtime.resource_monitor.effective_memory_limit();
        test.runtime.state.llm_loaded.store(true, Ordering::Release);

        test.runtime.resource_stage(&mut st, &LoopPass::new(false));

        // A loaded model raises the memory the agent may use.
        assert!(test.runtime.resource_monitor.effective_memory_limit() > idle);
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn resource_usage_is_shown_at_most_once_a_second() {
        use agent_gui::events::AgentEvent;
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        st.gui.last_resource_update = Instant::now() - std::time::Duration::from_secs(2);

        test.runtime.resource_stage(&mut st, &LoopPass::new(false));
        assert!(matches!(
            test.events.try_recv(),
            Ok(AgentEvent::ResourceUpdate { .. })
        ));

        test.runtime.resource_stage(&mut st, &LoopPass::new(false));
        assert!(test.events.try_recv().is_err());
    }

    #[tokio::test]
    async fn no_update_check_before_its_interval_or_a_request() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let scheduled = Instant::now();
        st.last_update_check = scheduled;

        runtime.update_stage(&mut st);

        assert_eq!(st.last_update_check, scheduled);
        assert!(st.tasks.is_empty());
        assert!(!runtime.state.force_update.load(Ordering::Acquire));
    }

    #[tokio::test]
    async fn a_requested_update_runs_in_the_background_one_at_a_time() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        st.last_update_check = Instant::now();
        runtime.state.force_update.store(true, Ordering::Release);

        runtime.update_stage(&mut st);
        assert!(st.tasks.is_running(UPDATE_TASK));
        assert!(!runtime.state.force_update.load(Ordering::Acquire));

        // Asked again while the first one runs: served once it is over.
        runtime.state.force_update.store(true, Ordering::Release);
        runtime.update_stage(&mut st);
        assert_eq!(st.tasks.len(), 1);
        assert!(runtime.state.force_update.load(Ordering::Acquire));

        // Stopped before it is ever polled: nothing is downloaded by this test.
        st.tasks.shutdown().await;
    }
}
