// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Real-time process detection: the operating system reports every process
//! start, and each one goes through the detection rules at once instead of
//! waiting for the next periodic scan.
//!
//! The event sources live in [`agent_scanner::security::process_events`].

use agent_scanner::SecurityIncident;
use agent_scanner::security::process_events::{ProcessEventSource, ProcessStart};
use std::sync::mpsc::{Receiver, sync_channel};
use tracing::{info, warn};

use super::AgentRuntime;

/// Process starts waiting between the source and the main loop.
const EVENT_QUEUE: usize = 4096;
/// Process starts evaluated per pass of the main loop, so a burst (a build,
/// an installer) cannot hold the loop.
const MAX_EVENTS_PER_PASS: usize = 1000;

/// A running event source and the events it has produced.
pub(crate) struct ProcessTelemetry {
    source: ProcessEventSource,
    events: Receiver<ProcessStart>,
}

impl AgentRuntime {
    /// Start reporting process starts, when the option is on. A source that
    /// cannot start leaves the periodic scan as the only detection.
    pub(crate) fn start_process_telemetry(&self) {
        if !self.config.process_event_telemetry {
            return;
        }
        let (tx, events) = sync_channel(EVENT_QUEUE);
        match ProcessEventSource::start(tx) {
            Ok(source) => {
                info!(
                    "Process starts are evaluated in real time ({})",
                    source.kind()
                );
                *self
                    .process_telemetry
                    .lock()
                    .unwrap_or_else(|e| e.into_inner()) = Some(ProcessTelemetry { source, events });
            }
            Err(e) => warn!(
                "Real-time process detection unavailable ({}): the periodic scan remains",
                e
            ),
        }
    }

    /// The processes started since the last call and the incidents they raise.
    /// The starts themselves go to the custom detection rules, which apply to
    /// every process and not only to the suspicious ones.
    pub(crate) fn take_process_starts(&self) -> (Vec<ProcessStart>, Vec<SecurityIncident>) {
        let guard = self
            .process_telemetry
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let Some(telemetry) = guard.as_ref() else {
            return (Vec::new(), Vec::new());
        };
        let starts: Vec<ProcessStart> = telemetry
            .events
            .try_iter()
            .take(MAX_EVENTS_PER_PASS)
            .collect();
        let incidents = starts
            .iter()
            .flat_map(|start| self.security_monitor.analyze_process_start(start))
            .collect();
        (starts, incidents)
    }

    /// Stop the event source.
    pub(crate) fn stop_process_telemetry(&self) {
        if let Some(telemetry) = self
            .process_telemetry
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
        {
            telemetry.source.stop();
        }
    }
}
