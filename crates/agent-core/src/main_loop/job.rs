// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! A piece of work the main loop starts in a background task and collects
//! in a later pass.

use std::future::Future;

use tokio::sync::oneshot;
use tokio::task::AbortHandle;

use crate::supervised_tasks::TaskSet;

/// Work running in a task of the loop's [`TaskSet`], from its start to the
/// pass that collects its outcome. The task set logs a panic; the loop sees
/// a job that ended without an outcome.
pub(crate) struct Job<T> {
    outcome: oneshot::Receiver<T>,
    abort: AbortHandle,
}

impl<T: Send + 'static> Job<T> {
    /// Run `work` in a task of `tasks` called `name`.
    pub(crate) fn start(
        tasks: &mut TaskSet,
        name: &'static str,
        work: impl Future<Output = T> + Send + 'static,
    ) -> Self {
        let (done, outcome) = oneshot::channel();
        let abort = tasks.spawn(name, async move {
            // Nobody is waiting any more when the loop has stopped.
            let _ = done.send(work.await);
        });
        Self { outcome, abort }
    }

    /// `None` while the work is running; then its outcome, itself `None`
    /// when the task ended without one (it panicked or was aborted).
    pub(crate) fn finished(&mut self) -> Option<Option<T>> {
        match self.outcome.try_recv() {
            Ok(outcome) => Some(Some(outcome)),
            Err(oneshot::error::TryRecvError::Empty) => None,
            Err(oneshot::error::TryRecvError::Closed) => Some(None),
        }
    }

    /// Stop the work.
    pub(crate) fn abort(&self) {
        self.abort.abort();
    }

    /// Whether the task has ended, with or without an outcome.
    #[cfg(test)]
    pub(crate) fn is_over(&self) -> bool {
        self.abort.is_finished()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn until_over<T: Send + 'static>(job: &Job<T>) {
        while !job.is_over() {
            tokio::task::yield_now().await;
        }
    }

    #[tokio::test]
    async fn the_outcome_is_handed_over_once_the_work_is_done() {
        let mut tasks = TaskSet::new("test");
        let (go, wait) = oneshot::channel::<()>();
        let mut job = Job::start(&mut tasks, "sum", async move {
            let _ = wait.await;
            2 + 2
        });

        assert_eq!(job.finished(), None);
        go.send(()).unwrap();
        until_over(&job).await;

        assert_eq!(job.finished(), Some(Some(4)));
    }

    #[tokio::test]
    async fn work_that_panics_ends_without_an_outcome() {
        let mut tasks = TaskSet::new("test");
        let mut job: Job<u32> = Job::start(&mut tasks, "broken", async { panic!("bug") });
        until_over(&job).await;

        assert_eq!(job.finished(), Some(None));
    }

    #[tokio::test]
    async fn aborted_work_ends_without_an_outcome() {
        let mut tasks = TaskSet::new("test");
        let mut job: Job<u32> = Job::start(&mut tasks, "endless", std::future::pending());

        job.abort();
        until_over(&job).await;

        assert_eq!(job.finished(), Some(None));
    }
}
