// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Background tasks that are watched.
//!
//! A task started with `tokio::spawn` and never joined can panic or hang
//! without anyone noticing. A [`TaskSet`] keeps every task it starts in a
//! `JoinSet` under a name: its owner calls [`TaskSet::reap`] regularly and
//! each panic is logged with that name, each task running longer than
//! expected is reported once, and a task meant to live as long as the agent
//! is started again after a panic.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use tokio::task::{AbortHandle, Id, JoinSet};
use tracing::{debug, error, warn};

/// Pause before a task that panicked is started again, doubled at each
/// consecutive panic up to [`MAX_RESTART_DELAY`].
const RESTART_DELAY: Duration = Duration::from_secs(1);

/// Longest pause between two starts of a task that keeps panicking.
const MAX_RESTART_DELAY: Duration = Duration::from_secs(60);

/// A restarted task that ran this long before panicking again is considered
/// to have recovered: its restart delay starts over.
const HEALTHY_AFTER: Duration = Duration::from_secs(300);

type TaskFuture = Pin<Box<dyn Future<Output = ()> + Send>>;
type TaskFactory = Box<dyn FnMut() -> TaskFuture + Send>;

/// What happened to a watched task since the previous [`TaskSet::reap`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TaskEvent {
    /// The task ran to its end.
    Finished { name: String },
    /// The task panicked; `restarted` when it was started again.
    Panicked {
        name: String,
        message: String,
        restarted: bool,
    },
    /// The task was aborted.
    Cancelled { name: String },
    /// The task is still running past the time it was expected to take.
    /// Reported once per task.
    Slow { name: String },
}

struct Tracked {
    name: String,
    started: Instant,
    /// How long the task may run before it is reported as slow.
    expected: Option<Duration>,
    reported_slow: bool,
    restart: Option<Restart>,
}

/// How to start again a task meant to live as long as the agent.
struct Restart {
    start: TaskFactory,
    /// Panics in a row, without a healthy run in between.
    panics: u32,
}

/// A set of named background tasks whose panics and overruns are noticed.
/// Dropping the set aborts the tasks still running.
pub struct TaskSet {
    /// Who owns the tasks, named in the logs.
    owner: &'static str,
    tasks: JoinSet<()>,
    tracked: HashMap<Id, Tracked>,
    restart_delay: Duration,
}

impl TaskSet {
    /// An empty set; `owner` names it in the logs.
    pub fn new(owner: &'static str) -> Self {
        Self {
            owner,
            tasks: JoinSet::new(),
            tracked: HashMap::new(),
            restart_delay: RESTART_DELAY,
        }
    }

    /// Start a task that runs once. A panic is logged by [`Self::reap`].
    pub fn spawn<F>(&mut self, name: impl Into<String>, future: F) -> AbortHandle
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.track(name.into(), None, None, Box::pin(future))
    }

    /// Start a task that runs once and should be done within `expected`:
    /// past that time it is reported as slow, once, and left running.
    pub fn spawn_expected<F>(
        &mut self,
        name: impl Into<String>,
        expected: Duration,
        future: F,
    ) -> AbortHandle
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.track(name.into(), Some(expected), None, Box::pin(future))
    }

    /// Start a task meant to live as long as its owner. When it panics it is
    /// started again with `start`, after a pause that grows while it keeps
    /// panicking. A task that returns is not started again.
    pub fn spawn_restartable<F, Fut>(&mut self, name: impl Into<String>, mut start: F)
    where
        F: FnMut() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        let first: TaskFuture = Box::pin(start());
        let restart = Restart {
            start: Box::new(move || Box::pin(start())),
            panics: 0,
        };
        self.track(name.into(), None, Some(restart), first);
    }

    fn track(
        &mut self,
        name: String,
        expected: Option<Duration>,
        restart: Option<Restart>,
        future: TaskFuture,
    ) -> AbortHandle {
        let handle = self.tasks.spawn(future);
        self.tracked.insert(
            handle.id(),
            Tracked {
                name,
                started: Instant::now(),
                expected,
                reported_slow: false,
                restart,
            },
        );
        handle
    }

    /// Number of tasks still running (or waiting to be reaped).
    pub fn len(&self) -> usize {
        self.tracked.len()
    }

    /// Whether no task is running.
    pub fn is_empty(&self) -> bool {
        self.tracked.is_empty()
    }

    /// Whether a task with this name is running.
    pub fn is_running(&self, name: &str) -> bool {
        self.tracked.values().any(|task| task.name == name)
    }

    /// Collect the tasks that ended and look for the ones that overrun.
    /// Never waits. Panics and overruns are logged here; the events are
    /// returned for the owner that has more to do about them.
    pub fn reap(&mut self) -> Vec<TaskEvent> {
        let mut events = Vec::new();
        while let Some(joined) = self.tasks.try_join_next_with_id() {
            let (id, failure) = match joined {
                Ok((id, ())) => (id, None),
                Err(error) => (error.id(), Some(error)),
            };
            let Some(task) = self.tracked.remove(&id) else {
                continue;
            };
            events.push(self.ended(task, failure));
        }
        for task in self.tracked.values_mut() {
            if let Some(expected) = task.expected
                && !task.reported_slow
                && task.started.elapsed() > expected
            {
                task.reported_slow = true;
                warn!(
                    "[{}] background task '{}' still running after {}s (expected under {}s)",
                    self.owner,
                    task.name,
                    task.started.elapsed().as_secs(),
                    expected.as_secs()
                );
                events.push(TaskEvent::Slow {
                    name: task.name.clone(),
                });
            }
        }
        events
    }

    /// Log how `task` ended and start it again when it panicked and can be.
    fn ended(&mut self, task: Tracked, failure: Option<tokio::task::JoinError>) -> TaskEvent {
        let ran_for = task.started.elapsed();
        let Some(failure) = failure else {
            debug!(
                "[{}] background task '{}' finished after {:?}",
                self.owner, task.name, ran_for
            );
            return TaskEvent::Finished { name: task.name };
        };
        let payload = match failure.try_into_panic() {
            Ok(payload) => payload,
            Err(_) => {
                debug!(
                    "[{}] background task '{}' cancelled after {:?}",
                    self.owner, task.name, ran_for
                );
                return TaskEvent::Cancelled { name: task.name };
            }
        };
        let message = panic_message(payload.as_ref());
        error!(
            "[{}] background task '{}' panicked after {:?}: {}",
            self.owner, task.name, ran_for, message
        );
        let restarted = task.restart.is_some();
        if let Some(restart) = task.restart {
            self.restart(task.name.clone(), restart, ran_for);
        }
        TaskEvent::Panicked {
            name: task.name,
            message,
            restarted,
        }
    }

    /// Start a task again after a panic, after a pause that doubles while
    /// the panics follow each other.
    fn restart(&mut self, name: String, mut restart: Restart, ran_for: Duration) {
        restart.panics = if ran_for >= HEALTHY_AFTER {
            1
        } else {
            restart.panics.saturating_add(1)
        };
        let delay = restart_delay(self.restart_delay, restart.panics);
        warn!(
            "[{}] background task '{}' starts again in {:?} (panic #{} in a row)",
            self.owner, name, delay, restart.panics
        );
        let next = (restart.start)();
        let delayed: TaskFuture = Box::pin(async move {
            tokio::time::sleep(delay).await;
            next.await;
        });
        self.track(name, None, Some(restart), delayed);
    }

    /// Stop watching the tasks and let them run to their end, on their own.
    pub fn detach(&mut self) {
        self.tracked.clear();
        self.tasks.detach_all();
    }

    /// Abort every task and wait for them to be gone.
    pub async fn shutdown(&mut self) {
        self.tracked.clear();
        self.tasks.shutdown().await;
    }
}

/// Start a task that nobody will join, and log its panic if it has one.
/// For the few tasks that have no owner to reap them. The handle returned
/// resolves to the panic message, `None` when the task ended normally.
pub fn spawn_logged<F>(name: &'static str, future: F) -> tokio::task::JoinHandle<Option<String>>
where
    F: Future<Output = ()> + Send + 'static,
{
    let task = tokio::spawn(future);
    tokio::spawn(async move {
        let payload = task.await.err()?.try_into_panic().ok()?;
        let message = panic_message(payload.as_ref());
        error!("background task '{}' panicked: {}", name, message);
        Some(message)
    })
}

/// Pause before the start that follows panic number `panics` in a row.
fn restart_delay(base: Duration, panics: u32) -> Duration {
    let doublings = panics.saturating_sub(1).min(16);
    base.saturating_mul(1u32 << doublings)
        .min(MAX_RESTART_DELAY)
}

/// The text of a panic, when it carries one.
pub fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        (*text).to_string()
    } else if let Some(text) = payload.downcast_ref::<String>() {
        text.clone()
    } else {
        "panic without a message".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// Reap until `wanted` events came in, for at most two seconds.
    async fn events(set: &mut TaskSet, wanted: usize) -> Vec<TaskEvent> {
        let mut seen = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(2);
        while seen.len() < wanted && Instant::now() < deadline {
            seen.extend(set.reap());
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        seen
    }

    fn fast_restarts(owner: &'static str) -> TaskSet {
        let mut set = TaskSet::new(owner);
        set.restart_delay = Duration::from_millis(5);
        set
    }

    #[tokio::test]
    async fn a_finished_task_is_reaped_under_its_name() {
        let mut set = TaskSet::new("test");
        set.spawn("upload", async {});
        assert!(set.is_running("upload"));

        assert_eq!(
            events(&mut set, 1).await,
            vec![TaskEvent::Finished {
                name: "upload".to_string()
            }]
        );
        assert!(set.is_empty());
    }

    #[tokio::test]
    async fn a_panic_is_reported_with_the_task_name_and_message() {
        let mut set = TaskSet::new("test");
        set.spawn("kill process", async {
            panic!("pid went away");
        });

        assert_eq!(
            events(&mut set, 1).await,
            vec![TaskEvent::Panicked {
                name: "kill process".to_string(),
                message: "pid went away".to_string(),
                restarted: false,
            }]
        );
        assert_eq!(set.len(), 0);
    }

    #[tokio::test]
    async fn a_formatted_panic_message_is_kept() {
        let mut set = TaskSet::new("test");
        let attempt = 3;
        set.spawn("report", async move {
            panic!("attempt {attempt} failed");
        });

        match events(&mut set, 1).await.as_slice() {
            [TaskEvent::Panicked { message, .. }] => assert_eq!(message, "attempt 3 failed"),
            other => panic!("expected one panic, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_restartable_task_starts_again_after_a_panic() {
        let mut set = fast_restarts("test");
        let starts = Arc::new(AtomicU32::new(0));
        let counter = Arc::clone(&starts);
        set.spawn_restartable("outbox", move || {
            let run = counter.fetch_add(1, Ordering::SeqCst);
            async move {
                if run == 0 {
                    panic!("first run fails");
                }
                // The second run stays up.
                std::future::pending::<()>().await;
            }
        });

        let seen = events(&mut set, 1).await;
        assert_eq!(
            seen,
            vec![TaskEvent::Panicked {
                name: "outbox".to_string(),
                message: "first run fails".to_string(),
                restarted: true,
            }]
        );
        // Started again, and still watched under the same name.
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(starts.load(Ordering::SeqCst), 2);
        assert!(set.is_running("outbox"));
        assert!(set.reap().is_empty());
    }

    #[tokio::test]
    async fn a_restartable_task_that_returns_is_not_started_again() {
        let mut set = fast_restarts("test");
        let starts = Arc::new(AtomicU32::new(0));
        let counter = Arc::clone(&starts);
        set.spawn_restartable("feeds", move || {
            counter.fetch_add(1, Ordering::SeqCst);
            async {}
        });

        assert_eq!(
            events(&mut set, 1).await,
            vec![TaskEvent::Finished {
                name: "feeds".to_string()
            }]
        );
        tokio::time::sleep(Duration::from_millis(30)).await;
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        assert!(set.is_empty());
    }

    #[tokio::test]
    async fn an_overrunning_task_is_reported_once_and_left_running() {
        let mut set = TaskSet::new("test");
        set.spawn_expected(
            "model download",
            Duration::from_millis(10),
            std::future::pending(),
        );

        assert_eq!(
            events(&mut set, 1).await,
            vec![TaskEvent::Slow {
                name: "model download".to_string()
            }]
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(set.reap().is_empty());
        assert!(set.is_running("model download"));
    }

    #[tokio::test]
    async fn an_aborted_task_is_reported_as_cancelled() {
        let mut set = TaskSet::new("test");
        let handle = set.spawn("discovery", std::future::pending());
        handle.abort();

        assert_eq!(
            events(&mut set, 1).await,
            vec![TaskEvent::Cancelled {
                name: "discovery".to_string()
            }]
        );
    }

    #[tokio::test]
    async fn shutdown_stops_everything() {
        let mut set = TaskSet::new("test");
        let running = Arc::new(AtomicU32::new(0));
        let flag = Arc::clone(&running);
        set.spawn("worker", async move {
            flag.store(1, Ordering::SeqCst);
            std::future::pending::<()>().await;
        });
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert_eq!(running.load(Ordering::SeqCst), 1);

        set.shutdown().await;

        assert!(set.is_empty());
        assert!(set.reap().is_empty());
    }

    #[tokio::test]
    async fn detached_tasks_run_to_their_end_without_the_set() {
        let mut set = TaskSet::new("test");
        let done = Arc::new(AtomicU32::new(0));
        let flag = Arc::clone(&done);
        set.spawn("isolate host", async move {
            tokio::time::sleep(Duration::from_millis(30)).await;
            flag.store(1, Ordering::SeqCst);
        });

        set.detach();
        assert!(set.is_empty());
        drop(set);

        tokio::time::sleep(Duration::from_millis(120)).await;
        assert_eq!(done.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_task_without_an_owner_still_has_its_panic_logged() {
        let watcher = spawn_logged("dispatcher", async {
            panic!("handler bug");
        });
        assert_eq!(watcher.await.unwrap().as_deref(), Some("handler bug"));

        let watcher = spawn_logged("listener", async {});
        assert_eq!(watcher.await.unwrap(), None);
    }

    #[test]
    fn the_restart_delay_doubles_up_to_a_minute() {
        let base = Duration::from_secs(1);
        assert_eq!(restart_delay(base, 1), Duration::from_secs(1));
        assert_eq!(restart_delay(base, 2), Duration::from_secs(2));
        assert_eq!(restart_delay(base, 4), Duration::from_secs(8));
        assert_eq!(restart_delay(base, 7), MAX_RESTART_DELAY);
        assert_eq!(restart_delay(base, u32::MAX), MAX_RESTART_DELAY);
    }
}
