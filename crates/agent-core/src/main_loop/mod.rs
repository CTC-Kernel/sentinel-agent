// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The agent's main loop: [`AgentRuntime::run`](crate::AgentRuntime::run),
//! one stage at a time.
//!
//! `run` starts the engines (see `startup`), then calls `run_pass` about once
//! a second until shutdown. `LoopState` is what the stages remember from one
//! pass to the next; `LoopPass` is what the detection stages of a pass hand
//! to the threat pipeline of that same pass.
//!
//! Work that must not hold a pass back runs in background tasks kept in
//! `LoopState::tasks`, a [`TaskSet`](crate::supervised_tasks::TaskSet): each
//! pass starts by reaping them, which logs a panic and starts again a task
//! meant to live as long as the agent (the indicator feeds).
//!
//! # Stages of a pass
//!
//! | #  | Stage                          | Runs                                 | Shared state written                          |
//! |----|--------------------------------|--------------------------------------|-----------------------------------------------|
//! | 1  | `apply_fresh_feed_intel`       | every pass                           | feed intelligence, network detector           |
//! | 2  | `report_started_processes`     | every pass                           | pass: incidents, observed                     |
//! | 3  | `check_ransomware_canaries`    | every pass                           | pass: incidents, file changes                 |
//! | 4  | `drain_fim_alerts`             | every pass                           | pass: file changes; FIM batch; SIEM events    |
//! | 5  | `scan_changed_files_with_yara` | when the batch has candidates        | pass: incidents, file changes                 |
//! | 6  | `upload_fim_batch`             | when the batch is not empty          | (consumes the batch)                          |
//! | 7  | `emit_fim_stats` (gui)         | every pass                           | state: daily FIM count                        |
//! | 8  | `sync_gui_siem_config` (gui)   | every pass                           | SIEM forwarder configuration                  |
//! | 9  | `heartbeat_stage`              | heartbeat interval, not standalone   | state: heartbeat timer, pending sync count    |
//! | 10 | `collect_vuln_scan`            | when the background scan is finished | state: scan task, scan timer, open findings   |
//! | 11 | `start_vuln_scan_if_due`       | scan interval, not paused            | state: scan task                              |
//! | 12 | `security_scan_stage`          | scan interval, not paused            | pass: incidents, observed, active             |
//! | 13 | `network_static_stage`         | its interval, not paused, consent    | state: timer; pass: active                    |
//! | 14 | `network_connections_stage`    | its interval, not paused, consent    | state: timer; pass: active                    |
//! | 15 | `network_security_stage`       | its interval, not paused, consent    | pass: network alerts, observed, active        |
//! | 16 | `collect_os_logs`              | poll interval, collector enabled     | SIEM events; state: timer                     |
//! | 17 | `threat_pipeline_stage`        | when the pass gathered something     | state: rule memory (consumes the pass)        |
//! | 18 | `compliance_stage`             | check interval, not paused           | state: score, check time, policy summary      |
//! | 19 | `certificate_renewal_stage`    | daily, not standalone                | state: timer                                  |
//! | 20 | `forced_check_stage`           | operator request                     | state: scan task, score, timers               |
//! | 21 | `forced_sync_stage`            | operator request                     | state: heartbeat timer                        |
//! | 22 | `update_stage`                 | operator request, or every 6 hours   | state: timer                                  |
//! | 23 | `forced_discovery_stage` (gui) | operator request                     | (spawns the discovery task)                   |
//! | 24 | `upload_asset_proposals`       | every pass                           | (drains the proposal queue)                   |
//! | 25 | `resource_stage`               | every pass                           | resource monitor                              |
//!
//! # Order that matters
//!
//! - The response, stage 17, acts on what stages 2 to 5, 12 and 15 put in
//!   the pass: they must run before it, in the same pass. Everything a
//!   stage awaits before 17 (uploads included) delays the response.
//! - Stages 4, 5 and 6 share the FIM batch: drain, scan, then upload.
//! - Stage 1 gives the network detector its indicators before stage 15.
//! - The heartbeat (9, and 21 on request) sends the score that stages 18
//!   and 20 computed in an earlier pass. On a forced sync, stage 9 applies
//!   the configuration and stage 21 finishes the sync and clears the flag.
//! - Stage 10 collects the scan that stage 11 or 20 started; a new scan
//!   only starts once the previous one was collected.
//! - Stages 12 to 15, 18 and 20 mark the pass active, which stage 25 reads.
//! - Stages 2 to 6 run even when the agent is paused: they are the
//!   security-critical ones.

mod compliance;
mod detection;
#[cfg(feature = "gui")]
mod discovery;
mod fim;
mod idle;
mod maintenance;
mod network;
mod pass;
mod pipeline;
mod platform;
mod scans;
mod shutdown;
mod siem;
mod startup;
mod state;
#[cfg(test)]
pub(crate) mod testing;

pub(crate) use pass::LoopPass;
pub(crate) use state::{CERT_CHECK_INTERVAL_SECS, LoopState};

use crate::AgentRuntime;

impl AgentRuntime {
    /// One pass of the main loop: every stage in the order of the table
    /// above.
    pub(crate) async fn run_pass(&self, st: &mut LoopState) {
        // Background tasks that ended since the last pass: a panic is logged,
        // a task meant to keep running is started again.
        st.tasks.reap();

        // What this pass gathers on its way to the threat pipeline.
        let mut pass = LoopPass::new(self.is_paused());

        // Indicator feeds refreshed in the background
        self.apply_fresh_feed_intel().await;

        // Processes started since the last pass, evaluated as they start
        self.report_started_processes(&mut pass).await;

        // 0. Ransomware canaries (always — security-critical even when paused)
        self.check_ransomware_canaries(&mut pass).await;

        // 1. Process FIM alerts (always — security-critical even when paused)
        //    Collect all pending alerts first, then batch-upload to avoid 429 rate limits.
        let fim_batch = self.drain_fim_alerts(st, &mut pass).await;

        // YARA: scan the files just created or changed
        self.scan_changed_files_with_yara(&mut pass, &fim_batch.yara_candidates)
            .await;

        // Batch-upload collected FIM alerts and report summary incident
        self.upload_fim_batch(fim_batch).await;

        // 1b. Emit FIM stats to GUI periodically
        #[cfg(feature = "gui")]
        self.emit_fim_stats(st).await;

        // 1b. Sync GUI SIEM config changes to the actual forwarder
        #[cfg(feature = "gui")]
        self.sync_gui_siem_config().await;

        // 2. Heartbeat & Config Sync (a standalone agent has nobody to report to)
        self.heartbeat_stage(st).await;

        // 3. Vulnerability Scanning — runs in its own task so that a long
        //    scan (inventory, OSV lookups, AI analysis, uploads) never delays
        //    heartbeats. At most one scan runs at a time: a new one is only
        //    started once the previous task handle has been collected here.
        self.collect_vuln_scan(st).await;

        self.start_vuln_scan_if_due(st, &pass);

        // Run security scan if interval has passed (skip when paused)
        self.security_scan_stage(st, &mut pass).await;

        // Network collection/detection only with the platform's consent
        // (timers are left as-is so collection resumes at once when re-enabled).
        let network_allowed = self.state.network_monitoring_enabled();

        // Run network static info collection if interval has passed (skip when paused)
        self.network_static_stage(st, &mut pass, network_allowed)
            .await;

        // Run network connection scan if interval has passed (skip when paused)
        self.network_connections_stage(st, &mut pass, network_allowed)
            .await;

        // Run network security detection if interval has passed (skip when paused)
        self.network_security_stage(st, &mut pass, network_allowed)
            .await;

        // ── Log collection & correlation ──
        self.collect_os_logs(st).await;

        // ── Autonomous threat pipeline ──
        self.threat_pipeline_stage(st, &mut pass).await;

        // Run compliance checks if interval has passed (skip when paused)
        self.compliance_stage(st, &mut pass).await;

        // Certificate renewal check (daily)
        self.certificate_renewal_stage(st).await;

        // Check for force_check flag (GUI "Vérifier maintenant" button)
        self.forced_check_stage(st, &mut pass).await;

        // Check for force_sync flag (GUI "Forcer la synchronisation" button)
        self.forced_sync_stage(st).await;

        // Self-update: on request, and as a periodic background check
        self.update_stage(st).await;

        // Check for force_discovery flag (GUI network discovery)
        #[cfg(feature = "gui")]
        self.forced_discovery_stage(&mut st.tasks).await;

        // Check for pending asset proposals
        self.upload_asset_proposals().await;

        // Periodically collect resource usage and push to GUI/Check limits
        self.resource_stage(st, &pass);
    }
}
