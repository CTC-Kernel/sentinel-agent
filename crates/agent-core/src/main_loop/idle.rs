// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! The pause between two passes of the main loop.

use tracing::info;

use crate::AgentRuntime;
use crate::state::RemediationRequest;

impl AgentRuntime {
    /// Wait before the next pass: one second, cut short by a remediation
    /// request from the interface (handled at once) or by the shutdown
    /// signal. Returns `false` when the loop must stop.
    pub(crate) async fn idle_until_next_pass(&self) -> bool {
        tokio::select! {
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(1)) => true,
            req = async {
                let mut rx = self.remediation_rx.lock().await;
                rx.recv().await
            } => {
                if let Some(req) = req {
                    self.handle_remediation_request(req).await;
                }
                true
            }
            _ = self.wait_for_shutdown() => {
                info!("Shutdown signal received, initiating graceful exit sequence...");
                false
            }
        }
    }

    /// A remediation the operator asked for from the interface.
    async fn handle_remediation_request(&self, req: RemediationRequest) {
        #[cfg(feature = "gui")]
        match req {
            RemediationRequest::Execute { check_id } => {
                self.remediate(&check_id).await;
            }
            RemediationRequest::Preview { check_id } => {
                self.remediate_preview(&check_id);
            }
            RemediationRequest::ApplyAi { action } => {
                self.apply_ai_remediation(action).await;
            }
        }
        #[cfg(not(feature = "gui"))]
        {
            let _ = req;
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::main_loop::testing::standalone_runtime;
    use std::time::{Duration, Instant};

    #[tokio::test]
    async fn a_shutdown_request_ends_the_wait_and_the_loop() {
        let test = standalone_runtime();
        test.runtime.request_shutdown();

        let started = Instant::now();
        assert!(!test.runtime.idle_until_next_pass().await);
        assert!(started.elapsed() < Duration::from_millis(900));
    }

    #[tokio::test]
    async fn a_quiet_second_leads_to_the_next_pass() {
        let test = standalone_runtime();

        let started = Instant::now();
        assert!(test.runtime.idle_until_next_pass().await);
        assert!(started.elapsed() >= Duration::from_millis(900));
    }

    #[cfg(feature = "gui")]
    #[tokio::test]
    async fn a_remediation_request_is_handled_without_waiting() {
        let test = standalone_runtime();
        test.runtime
            .handle()
            .remediate_preview("disk_encryption".to_string());

        let started = Instant::now();
        assert!(test.runtime.idle_until_next_pass().await);
        assert!(started.elapsed() < Duration::from_millis(900));
    }
}
