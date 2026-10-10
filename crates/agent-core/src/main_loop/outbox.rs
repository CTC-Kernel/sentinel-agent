// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Uploads the main loop does not wait for.
//!
//! What a stage has to send to the platform is queued here and sent by a
//! background task, one item at a time and in the order it was queued. A
//! slow or unreachable platform then delays the uploads, not the detection
//! stages nor the playbooks that follow them in the pass.

use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use agent_scanner::SecurityIncident;
use tokio::sync::mpsc;
use tracing::{debug, error, warn};

use crate::AgentRuntime;
use crate::supervised_tasks::TaskSet;

/// Name of the background task that sends the queued uploads.
pub(crate) const OUTBOX_TASK: &str = "platform uploads";

/// Items the queue holds before a stage has to wait for room: when the
/// platform is that far behind, the loop is slowed down rather than the
/// uploads dropped.
const OUTBOX_CAPACITY: usize = 256;

/// How long a shutdown waits for the queued uploads to leave.
const OUTBOX_FLUSH_TIMEOUT: Duration = Duration::from_secs(10);

/// Something to send to the platform.
#[derive(Debug)]
pub(crate) enum Outbound {
    /// A security incident; `what` names it in the log when the upload fails.
    Incident {
        incident: Box<SecurityIncident>,
        what: &'static str,
    },
}

/// The queue of uploads, and the count of those not sent yet.
pub(crate) struct Outbox {
    queue: mpsc::Sender<Outbound>,
    /// Shared with the sending task, and with the one that replaces it
    /// after a panic.
    queued: Arc<tokio::sync::Mutex<mpsc::Receiver<Outbound>>>,
    /// Items queued or being sent.
    unsent: Arc<AtomicUsize>,
}

/// Counts an item as sent when dropped, even if sending it panicked.
struct Sent(Arc<AtomicUsize>);

impl Drop for Sent {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
    }
}

impl Outbox {
    pub(crate) fn new() -> Self {
        let (queue, queued) = mpsc::channel(OUTBOX_CAPACITY);
        Self {
            queue,
            queued: Arc::new(tokio::sync::Mutex::new(queued)),
            unsent: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Queue `item` for upload. Returns at once unless the queue is full.
    pub(crate) async fn push(&self, item: Outbound) {
        self.unsent.fetch_add(1, Ordering::AcqRel);
        if self.queue.send(item).await.is_err() {
            // The receiver lives as long as the outbox: not reachable.
            self.unsent.fetch_sub(1, Ordering::AcqRel);
            error!("Upload queue closed: item dropped");
        }
    }

    /// Number of items queued or being sent.
    pub(crate) fn unsent(&self) -> usize {
        self.unsent.load(Ordering::Acquire)
    }

    /// Send the queued items with `send`, one at a time, for as long as the
    /// outbox lives.
    async fn drain<F, Fut>(
        queued: Arc<tokio::sync::Mutex<mpsc::Receiver<Outbound>>>,
        unsent: Arc<AtomicUsize>,
        mut send: F,
    ) where
        F: FnMut(Outbound) -> Fut,
        Fut: Future<Output = ()>,
    {
        let mut queued = queued.lock().await;
        while let Some(item) = queued.recv().await {
            let _sent = Sent(Arc::clone(&unsent));
            send(item).await;
        }
    }

    /// Wait until every queued item was sent, for at most `timeout`.
    /// Returns the number of items left.
    async fn wait_until_empty(&self, timeout: Duration) -> usize {
        let deadline = Instant::now() + timeout;
        while self.unsent() > 0 && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        self.unsent()
    }

    /// Take what is queued, for the tests that check what a stage sends.
    #[cfg(test)]
    pub(crate) async fn take_queued(&self) -> Vec<Outbound> {
        let mut queued = self.queued.lock().await;
        let mut items = Vec::new();
        while let Ok(item) = queued.try_recv() {
            self.unsent.fetch_sub(1, Ordering::AcqRel);
            items.push(item);
        }
        items
    }
}

impl AgentRuntime {
    /// Start the task that sends the queued uploads; it is started again
    /// if it panics, and goes on with the next item.
    pub(crate) fn start_outbox(self: &Arc<Self>, tasks: &mut TaskSet) {
        let runtime = Arc::clone(self);
        tasks.spawn_restartable(OUTBOX_TASK, move || {
            let runtime = Arc::clone(&runtime);
            let queued = Arc::clone(&runtime.outbox.queued);
            let unsent = Arc::clone(&runtime.outbox.unsent);
            async move {
                Outbox::drain(queued, unsent, |item| runtime.send_outbound(item)).await;
            }
        });
    }

    /// Send one queued item to the platform.
    async fn send_outbound(&self, item: Outbound) {
        match item {
            Outbound::Incident { incident, what } => {
                if let Err(e) = self.upload_incident(&incident).await {
                    error!("Failed to upload {}: {}", what, e);
                }
            }
        }
    }

    /// Queue a security incident for upload; `what` names it in the log
    /// when the upload fails.
    pub(crate) async fn queue_incident(&self, incident: &SecurityIncident, what: &'static str) {
        self.outbox
            .push(Outbound::Incident {
                incident: Box::new(incident.clone()),
                what,
            })
            .await;
    }

    /// Give the queued uploads a last chance to leave before shutdown.
    pub(crate) async fn flush_outbox(&self) {
        let left = self.outbox.wait_until_empty(OUTBOX_FLUSH_TIMEOUT).await;
        if left > 0 {
            warn!(
                "{} queued upload(s) not sent within {}s of shutdown",
                left,
                OUTBOX_FLUSH_TIMEOUT.as_secs()
            );
        } else {
            debug!("Upload queue empty");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use crate::supervised_tasks::TaskEvent;
    use agent_scanner::{IncidentSeverity, IncidentType};
    use std::sync::Mutex;

    fn incident(title: &str) -> Outbound {
        Outbound::Incident {
            incident: Box::new(SecurityIncident {
                incident_type: IncidentType::Malware,
                severity: IncidentSeverity::High,
                title: title.to_string(),
                description: String::new(),
                evidence: serde_json::Value::Null,
                confidence: 90,
                detected_at: chrono::Utc::now(),
            }),
            what: "test incident",
        }
    }

    fn title(item: &Outbound) -> String {
        match item {
            Outbound::Incident { incident, .. } => incident.title.clone(),
        }
    }

    /// Start a task draining `outbox` into `sent`; an item titled "poison"
    /// makes it panic.
    fn drain_into(outbox: &Outbox, tasks: &mut TaskSet, sent: &Arc<Mutex<Vec<String>>>) {
        let queued = Arc::clone(&outbox.queued);
        let unsent = Arc::clone(&outbox.unsent);
        let sent = Arc::clone(sent);
        tasks.spawn_restartable(OUTBOX_TASK, move || {
            let queued = Arc::clone(&queued);
            let unsent = Arc::clone(&unsent);
            let sent = Arc::clone(&sent);
            async move {
                Outbox::drain(queued, unsent, |item| {
                    let sent = Arc::clone(&sent);
                    async move {
                        let title = title(&item);
                        assert!(title != "poison", "cannot send this one");
                        sent.lock().unwrap().push(title);
                    }
                })
                .await;
            }
        });
    }

    #[tokio::test]
    async fn queued_items_are_sent_in_order() {
        let outbox = Outbox::new();
        let mut tasks = TaskSet::new("test");
        let sent = Arc::new(Mutex::new(Vec::new()));
        for name in ["first", "second", "third"] {
            outbox.push(incident(name)).await;
        }
        assert_eq!(outbox.unsent(), 3);

        drain_into(&outbox, &mut tasks, &sent);

        assert_eq!(outbox.wait_until_empty(Duration::from_secs(2)).await, 0);
        assert_eq!(*sent.lock().unwrap(), ["first", "second", "third"]);
        tasks.shutdown().await;
    }

    #[tokio::test]
    async fn a_panic_on_one_item_does_not_stop_the_next_ones() {
        let outbox = Outbox::new();
        let mut tasks = TaskSet::new("test");
        let sent = Arc::new(Mutex::new(Vec::new()));
        for name in ["before", "poison", "after"] {
            outbox.push(incident(name)).await;
        }

        drain_into(&outbox, &mut tasks, &sent);
        // The panic is noticed, and the task started again.
        let mut reported = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(5);
        while outbox.unsent() > 0 && Instant::now() < deadline {
            reported.extend(tasks.reap());
            tokio::time::sleep(Duration::from_millis(20)).await;
        }

        assert_eq!(*sent.lock().unwrap(), ["before", "after"]);
        assert!(matches!(
            reported.as_slice(),
            [TaskEvent::Panicked { name, restarted: true, .. }] if name == OUTBOX_TASK
        ));
        tasks.shutdown().await;
    }

    #[tokio::test]
    async fn a_shutdown_gives_up_on_a_queue_nobody_empties() {
        let outbox = Outbox::new();
        outbox.push(incident("stuck")).await;

        let left = outbox.wait_until_empty(Duration::from_millis(120)).await;

        assert_eq!(left, 1);
    }

    #[tokio::test]
    async fn the_runtime_sends_what_was_queued() {
        let test = standalone_runtime();
        let runtime = Arc::new(test.runtime);
        let mut tasks = TaskSet::new("test");
        let malware = SecurityIncident {
            incident_type: IncidentType::Malware,
            severity: IncidentSeverity::High,
            title: "Fichier malveillant".to_string(),
            description: String::new(),
            evidence: serde_json::Value::Null,
            confidence: 90,
            detected_at: chrono::Utc::now(),
        };
        runtime.queue_incident(&malware, "YARA incident").await;
        assert_eq!(runtime.outbox.unsent(), 1);

        runtime.start_outbox(&mut tasks);
        runtime.flush_outbox().await;

        assert_eq!(runtime.outbox.unsent(), 0);
        assert!(tasks.is_running(OUTBOX_TASK));
        tasks.shutdown().await;
    }
}
