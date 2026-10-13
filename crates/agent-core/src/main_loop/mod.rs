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
//! | #  | Stage                            | Runs                                 | Shared state written                          |
//! |----|----------------------------------|--------------------------------------|-----------------------------------------------|
//! | 1  | `apply_fresh_feed_intel`         | every pass                           | feed intelligence, file hashes, network detector |
//! | 2  | `analyse_logs`                   | every pass, log analysis on          | pass: incidents; file change attribution      |
//! | 3  | `inventory_stage`                | every ten minutes, inventory on      | pass: incidents; inventory                    |
//! | 4  | `report_started_processes`       | every pass                           | pass: incidents, observed; file change attribution |
//! | 5  | `check_ransomware_canaries`      | every pass                           | pass: incidents, file changes                 |
//! | 6  | `drain_fim_alerts`               | every pass                           | pass: file changes; FIM batch                 |
//! | 7  | `match_changed_files_with_feeds` | when the batch has hashed files      | pass: incidents, file changes                 |
//! | 8  | `scan_changed_files_with_yara`   | when the batch has candidates        | pass: incidents, file changes                 |
//! | 9  | `queue_fim_batch`                | when the batch is not empty          | (queues the batch for upload)                 |
//! | 10 | `emit_fim_stats` (gui)           | every pass                           | state: daily FIM count                        |
//! | 11 | `sync_gui_siem_config` (gui)     | every pass                           | SIEM forwarder configuration                  |
//! | 12 | `incident_retry_stage`           | every minute, not standalone         | state: timer (queues the attempt)             |
//! | 13 | `heartbeat_stage`                | heartbeat interval, not standalone   | state: heartbeat task, timer, pending sync    |
//! | 14 | `collect_vuln_scan`              | when the background scan is finished | state: scan task, scan timer, open findings   |
//! | 15 | `start_vuln_scan_if_due`         | scan interval, not paused            | state: scan task                              |
//! | 16 | `security_scan_stage`            | scan interval, not paused            | pass: incidents, observed, active             |
//! | 17 | `network_static_stage`           | its interval, not paused, consent    | state: timer; pass: active                    |
//! | 18 | `network_connections_stage`      | its interval, not paused, consent    | state: timer; pass: active                    |
//! | 19 | `network_security_stage`         | its interval, not paused, consent    | pass: network alerts, observed, active        |
//! | 20 | `collect_os_logs`                | poll interval, collector enabled     | SIEM events; state: timer                     |
//! | 21 | `threat_pipeline_stage`          | when the pass gathered something     | state: rule memory (consumes the pass)        |
//! | 22 | `collect_compliance`             | when the background checks are done  | state: score, check time, policy summary      |
//! | 23 | `compliance_stage`               | check interval, not paused           | state: compliance task                        |
//! | 24 | `certificate_renewal_stage`      | daily, not standalone                | state: timer                                  |
//! | 25 | `forced_check_stage`             | operator request                     | state: scan task, compliance task             |
//! | 26 | `forced_sync_stage`              | operator request                     | state: heartbeat timer                        |
//! | 27 | `update_stage`                   | operator request, or every 6 hours   | state: timer (starts the update task)         |
//! | 28 | `forced_discovery_stage` (gui)   | operator request                     | (starts the discovery task)                   |
//! | 29 | `upload_asset_proposals`         | every pass                           | (drains the proposal queue)                   |
//! | 30 | `resource_stage`                 | every pass                           | resource monitor                              |
//!
//! # Background tasks
//!
//! | Task                        | Started by   | Collected by | After a panic                    |
//! |-----------------------------|--------------|--------------|----------------------------------|
//! | `threat intelligence feeds` | start-up     | stage 1      | logged, started again            |
//! | `platform uploads`          | start-up     | (none)       | logged, started again, next item |
//! | `vulnerability scan`        | stage 15, 25 | stage 14     | logged, next scan at its usual time |
//! | `compliance checks`         | stage 23, 25 | stage 22     | logged, next run at its usual time |
//! | `heartbeat`                 | stage 13     | stage 13     | logged, next one at its interval |
//! | `self-update`               | stage 27     | (none)       | logged                           |
//! | `network discovery`         | stage 28     | (interface)  | logged                           |
//!
//! # Order that matters
//!
//! - The response, stage 21, acts on what stages 2 to 8, 16 and 19 put in
//!   the pass: they must run before it, in the same pass. Everything a
//!   stage awaits before 21 delays the response, which is why the stages
//!   queue in the `Outbox` what they upload and what they record in the
//!   SIEM (classified by the AI model first) instead of doing it.
//! - Stages 6 to 9 share the FIM batch: drain, compare with the indicator
//!   feeds, scan, then queue for upload.
//! - Stages 2 and 4 record who the audit, or a process start, says touched
//!   a file before stage 6 reads the file changes and names their author.
//! - Stage 1 gives the network detector its indicators before stage 19,
//!   and the hashes of known malicious files before stage 7.
//! - The heartbeat (13, and 26 on request) sends the score that stage 22
//!   collected in an earlier pass. On a forced sync, the heartbeat applies
//!   the configuration and stage 26 finishes the sync and clears the flag.
//! - The heartbeat runs in a background task, with the synchronisations
//!   and the re-enrollment that may follow it. Stages 24 and 26, which talk
//!   to the platform from the loop, wait for a heartbeat in flight to end:
//!   two re-enrollments, or two synchronisations, never overlap.
//! - Stage 14 collects the scan that stage 15 or 25 started, stage 22 the
//!   checks that stage 23 or 25 started; a new run only starts once the
//!   previous one was collected. Storing and uploading the results stays
//!   in the loop, in stage 22, so that it never overlaps a forced sync.
//! - Stage 12 only queues the new attempt: the upload task sends it in its
//!   turn, so it never overlaps the upload of a new incident.
//! - Stages 16 to 19 and 22 mark the pass active, which stage 30 reads.
//! - Stages 2 to 9 run even when the agent is paused: they are the
//!   security-critical ones.

// The functions of this module stay short: one stage, one handler each.
// The threshold is `too-many-lines-threshold` in clippy.toml.
#![warn(clippy::too_many_lines)]

mod compliance;
mod detection;
#[cfg(feature = "gui")]
mod discovery;
mod fim;
mod idle;
mod job;
mod maintenance;
mod network;
mod outbox;
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

pub(crate) use outbox::Outbox;
pub(crate) use pass::LoopPass;
pub(crate) use state::{CERT_CHECK_INTERVAL_SECS, LoopState};

use std::sync::Arc;

use crate::AgentRuntime;

impl AgentRuntime {
    /// One pass of the main loop: every stage in the order of the table
    /// above.
    pub(crate) async fn run_pass(self: &Arc<Self>, st: &mut LoopState) {
        // Background tasks that ended since the last pass: a panic is logged,
        // a task meant to keep running is started again.
        st.tasks.reap();

        // What this pass gathers on its way to the threat pipeline.
        let mut pass = LoopPass::new(self.is_paused());

        // Indicator feeds refreshed in the background
        self.apply_fresh_feed_intel().await;

        // Log events written since the last pass, evaluated against the rules
        self.analyse_logs(&mut pass).await;

        // Accounts, services and listening ports: what changed since the
        // last inventory
        self.inventory_stage(&mut pass).await;

        // Processes started since the last pass, evaluated as they start
        self.report_started_processes(&mut pass).await;

        // 0. Ransomware canaries (always — security-critical even when paused)
        self.check_ransomware_canaries(&mut pass).await;

        // 1. Process FIM alerts (always — security-critical even when paused)
        //    Collect all pending alerts first, then batch-upload to avoid 429 rate limits.
        let fim_batch = self.drain_fim_alerts(st, &mut pass).await;

        // Indicator feeds: a created or changed file whose SHA-256 is listed
        self.match_changed_files_with_feeds(&mut pass, &fim_batch.hash_candidates)
            .await;

        // YARA: scan the files just created or changed
        self.scan_changed_files_with_yara(&mut pass, &fim_batch.yara_candidates)
            .await;

        // Batch-upload collected FIM alerts and report summary incident
        self.queue_fim_batch(fim_batch).await;

        // 1b. Emit FIM stats to GUI periodically
        #[cfg(feature = "gui")]
        self.emit_fim_stats(st).await;

        // 1b. Sync GUI SIEM config changes to the actual forwarder
        #[cfg(feature = "gui")]
        self.sync_gui_siem_config().await;

        // Incidents kept while the platform was unreachable
        self.incident_retry_stage(st).await;

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

        // Compliance checks run in a background task: collect them once
        // done, start them if their interval has passed (skip when paused)
        self.collect_compliance(st, &mut pass).await;
        self.compliance_stage(st, &pass);

        // Certificate renewal check (daily)
        self.certificate_renewal_stage(st).await;

        // Check for force_check flag (GUI "Vérifier maintenant" button)
        self.forced_check_stage(st);

        // Check for force_sync flag (GUI "Forcer la synchronisation" button)
        self.forced_sync_stage(st).await;

        // Self-update: on request, and as a periodic background check
        self.update_stage(st);

        // Check for force_discovery flag (GUI network discovery)
        #[cfg(feature = "gui")]
        self.forced_discovery_stage(&mut st.tasks).await;

        // Check for pending asset proposals
        self.upload_asset_proposals().await;

        // Periodically collect resource usage and push to GUI/Check limits
        self.resource_stage(st, &pass);
    }
}
