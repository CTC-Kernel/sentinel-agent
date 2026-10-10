// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Network collection and detection stages of the main loop.

use tracing::info;

use super::LoopState;
use crate::AgentRuntime;

impl AgentRuntime {
    /// Start the network collection timers with the staggered intervals of
    /// the network manager.
    pub(crate) async fn start_network_schedule(&self, st: &mut LoopState) {
        let (network_static_interval, network_connection_interval, network_security_interval) = {
            let mut network_manager = self.network_manager.write().await;
            let static_interval = network_manager.next_static_interval();
            let conn_interval = network_manager.next_connection_interval();
            let sec_interval = network_manager.next_security_interval();
            info!(
                "Network collection intervals: static={:.0}s, connections={:.0}s, security={:.0}s",
                static_interval.as_secs_f64(),
                conn_interval.as_secs_f64(),
                sec_interval.as_secs_f64()
            );
            (static_interval, conn_interval, sec_interval)
        };

        // Initialize network timing with staggered delays
        st.start_network_schedule(
            std::time::Instant::now(),
            network_static_interval,
            network_connection_interval,
            network_security_interval,
        );
    }
}
