// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Watched commands stage of the main loop (see [`crate::command_monitor`]):
//! the commands run in background tasks, never in the pass; each pass
//! collects the runs that ended and starts the commands whose time has come.

use agent_scanner::SecurityIncident;
use std::time::Instant;
use tracing::{info, warn};

use super::job::Job;
use super::{LoopPass, LoopState};
use crate::AgentRuntime;
use crate::command_monitor::{self, CommandRun};

/// Name of the background task of a watched command.
const COMMAND_TASK: &str = "watched command";

impl AgentRuntime {
    /// Collect the watched commands that ended, then start those that are
    /// due.
    pub(crate) async fn command_monitor_stage(&self, st: &mut LoopState, pass: &mut LoopPass) {
        let mut ended = Vec::new();
        st.command_jobs
            .retain_mut(|(name, job)| match job.finished() {
                None => true,
                Some(run) => {
                    ended.push((name.clone(), run));
                    false
                }
            });
        for (name, run) in ended {
            match run {
                Some(run) => self.report_command_run(pass, run).await,
                // The task panicked or was stopped: the next run is due at
                // its usual time.
                None => {
                    self.command_monitors
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .finished(&name, Some("ended without an output"));
                }
            }
        }

        let due = self
            .command_monitors
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .due(Instant::now());
        for config in due {
            let name = config.name.clone();
            let job = Job::start(&mut st.tasks, COMMAND_TASK, command_monitor::run(config));
            st.command_jobs.push((name, job));
        }
    }

    /// One run of a watched command: its lines to the log rules, its change
    /// to the platform, the interface and the threat pipeline of this pass.
    pub(crate) async fn report_command_run(&self, pass: &mut LoopPass, run: CommandRun) {
        let new_failure = self
            .command_monitors
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .finished(&run.name, run.error.as_deref());
        if let Some(error) = &run.error {
            if new_failure {
                warn!("Watched command '{}' not run: {}", run.name, error);
            }
            return;
        }

        self.add_log_events(command_monitor::events(&run.name, &run.output));

        if !run.report_changes {
            return;
        }
        let change = {
            let monitors = self
                .command_monitors
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            let previous = monitors.previous_output(&run.name);
            if previous.is_none() {
                info!(
                    "Watched command '{}': its first output is the reference",
                    run.name
                );
            }
            if previous.as_deref() != Some(run.output.as_str()) {
                monitors.keep_output(&run.name, &run.output);
            }
            command_monitor::output_change(
                &run.name,
                &run.program,
                previous.as_deref(),
                &run.output,
            )
        };
        if let Some(incident) = change {
            self.report_command_change(pass, incident).await;
        }
    }

    async fn report_command_change(&self, pass: &mut LoopPass, incident: SecurityIncident) {
        warn!("{}", incident.title);
        self.queue_incident(&incident, "watched command incident")
            .await;
        #[cfg(feature = "gui")]
        {
            self.emit_system_incident(&incident);
            self.emit_notification("Sortie de commande modifiée", &incident.title, "warning");
            pass.kpi_incident_count = pass.kpi_incident_count.saturating_add(1);
        }
        pass.incidents.push(incident);
    }
}

#[cfg(test)]
mod tests {
    use crate::command_monitor::CommandRun;
    use crate::main_loop::LoopPass;
    use crate::main_loop::outbox::Outbound;
    use crate::main_loop::testing::standalone_runtime_with;

    fn run(name: &str, output: &str) -> CommandRun {
        CommandRun {
            name: name.to_string(),
            program: "/usr/bin/ss".to_string(),
            report_changes: true,
            output: output.to_string(),
            error: None,
        }
    }

    /// The first output is the reference; the next one that differs is
    /// reported, to the platform and to the threat pipeline of the pass.
    #[tokio::test]
    async fn a_changed_output_reaches_the_pipeline_once_there_is_a_reference() {
        let dir = tempfile::tempdir().unwrap();
        let name = "ports".to_string();
        let test = standalone_runtime_with(|_| {});
        // The outputs are kept in a directory of this test.
        *test.runtime.command_monitors.lock().unwrap() =
            crate::command_monitor::CommandMonitors::new(&[])
                .0
                .with_state_dir(dir.path().into());
        let mut pass = LoopPass::new(false);

        test.runtime
            .report_command_run(&mut pass, run(&name, "LISTEN 0.0.0.0:22\n"))
            .await;
        assert!(pass.incidents.is_empty());
        test.runtime
            .report_command_run(&mut pass, run(&name, "LISTEN 0.0.0.0:22\n"))
            .await;
        assert!(pass.incidents.is_empty());

        test.runtime
            .report_command_run(
                &mut pass,
                run(&name, "LISTEN 0.0.0.0:22\nLISTEN 0.0.0.0:4444\n"),
            )
            .await;
        assert_eq!(pass.incidents.len(), 1);
        assert!(pass.has_flagged_activity());
        match test.runtime.outbox.take_queued().await.as_slice() {
            [Outbound::Incident { what, .. }] => assert_eq!(*what, "watched command incident"),
            other => panic!("expected one queued incident, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_command_that_could_not_run_reports_nothing() {
        let test = standalone_runtime_with(|_| {});
        let mut pass = LoopPass::new(false);
        let mut failed = run("broken", "");
        failed.error = Some("did not finish in 60s".to_string());

        test.runtime.report_command_run(&mut pass, failed).await;

        assert!(pass.incidents.is_empty());
        assert_eq!(test.runtime.outbox.unsent(), 0);
    }
}
