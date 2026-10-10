// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! Detection stages of the main loop: what was observed since the last pass
//! and must reach the threat pipeline. They run on every pass, paused or not.

use crate::AgentRuntime;

impl AgentRuntime {
    /// Apply the indicator feeds refreshed in the background, if any.
    pub(crate) async fn apply_fresh_feed_intel(&self) {
        let fresh_feed_intel = self
            .pending_feed_intel
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take();
        if let Some(intel) = fresh_feed_intel {
            *self.feed_threat_intel.write().await = Some(intel);
            self.apply_threat_intel().await;
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::main_loop::testing::standalone_runtime;

    #[tokio::test]
    async fn fresh_feed_intelligence_is_taken_and_kept() {
        let test = standalone_runtime();
        let intel = agent_network::ThreatIntelligence {
            malicious_ips: vec!["203.0.113.7".to_string()],
            ..Default::default()
        };
        *test.runtime.pending_feed_intel.lock().unwrap() = Some(intel);

        test.runtime.apply_fresh_feed_intel().await;

        assert!(test.runtime.pending_feed_intel.lock().unwrap().is_none());
        let kept = test.runtime.feed_threat_intel.read().await;
        assert_eq!(
            kept.as_ref().map(|intel| intel.malicious_ips.clone()),
            Some(vec!["203.0.113.7".to_string()])
        );
    }

    #[tokio::test]
    async fn without_fresh_intelligence_nothing_changes() {
        let test = standalone_runtime();
        test.runtime.apply_fresh_feed_intel().await;
        assert!(test.runtime.feed_threat_intel.read().await.is_none());
    }
}
