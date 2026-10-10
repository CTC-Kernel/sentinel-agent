// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Housekeeping stages of the main loop: self-update, asset proposals and
//! the agent's own resource usage.

use std::sync::atomic::Ordering;
use tracing::{debug, warn};

use super::LoopState;
use crate::{AgentRuntime, UPDATE_CHECK_INTERVAL_SECS};

impl AgentRuntime {
    /// Self-update: at once when the operator asked for it, and as a
    /// periodic background check of the public release catalog.
    pub(crate) async fn update_stage(&self, st: &mut LoopState) {
        // Check for force_update flag (trigger from GUI button)
        if self.state.force_update.swap(false, Ordering::AcqRel) {
            // Release discovery is public and does not require platform
            // enrollment, so standalone installations follow the same
            // signed self-update path as connected agents.
            if let Err(e) = self.run_self_update().await {
                warn!("Self-update failed: {}", e);
            }
        }

        // Periodic background update check against the public catalog.
        if st.last_update_check.elapsed().as_secs() >= UPDATE_CHECK_INTERVAL_SECS {
            st.last_update_check = std::time::Instant::now();
            if let Err(e) = self.run_scheduled_update_check().await {
                debug!("Scheduled update check did not complete: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::time::Instant;

    #[tokio::test]
    async fn no_update_check_before_its_interval_or_a_request() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let scheduled = Instant::now();
        st.last_update_check = scheduled;

        test.runtime.update_stage(&mut st).await;

        assert_eq!(st.last_update_check, scheduled);
        assert!(!test.runtime.state.force_update.load(Ordering::Acquire));
    }
}
