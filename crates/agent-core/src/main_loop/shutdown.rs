// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! What the agent does once the main loop has stopped.

use agent_common::constants::AGENT_VERSION;
use tracing::{debug, info};

use super::LoopState;
use crate::resources::ResourceUsage;
use crate::{AgentRuntime, api_client, resources, system_utils};

/// The last heartbeat of a run, telling the platform the agent goes offline.
fn offline_heartbeat_request(
    usage: &ResourceUsage,
    last_compliance_check_at: Option<chrono::DateTime<chrono::Utc>>,
    compliance_score: Option<f64>,
) -> api_client::HeartbeatRequest {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    api_client::HeartbeatRequest {
        timestamp: chrono::Utc::now().to_rfc3339(),
        agent_version: AGENT_VERSION.to_string(),
        status: "offline".to_string(),
        hostname: hostname.clone(),
        os_info: format!(
            "{} {}",
            std::env::consts::OS,
            system_utils::get_os_version()
        ),
        cpu_percent: usage.cpu_percent,
        memory_bytes: usage.memory_bytes,
        memory_percent: resources::get_system_resources().memory_percent,
        memory_total_bytes: resources::get_system_resources().memory_total_bytes,
        disk_percent: resources::get_system_resources().disk_percent,
        disk_used_bytes: resources::get_system_resources().disk_used_bytes,
        disk_total_bytes: resources::get_system_resources().disk_total_bytes,
        disk_io_kbps: usage.disk_kbps,
        network_bytes_sent: 0,
        network_bytes_recv: 0,
        uptime_seconds: usage.uptime_ms / 1000,
        ip_address: None,
        last_check_at: last_compliance_check_at.map(|dt| dt.to_rfc3339()),
        compliance_score,
        pending_sync_count: 0,
        self_check_result: None,
        processes: vec![],
        connections: vec![],
        llm_status: None,
        llm_inference_count: None,
        detection_rules: vec![],
        playbooks: vec![],
    }
}

impl AgentRuntime {
    /// Graceful shutdown: stop the background scan, flush the check
    /// results, tell the platform the agent goes offline, stop the watchers.
    pub(crate) async fn shutdown_sequence(&self, st: &mut LoopState) {
        info!("Performing final cleanup and data flush...");

        // 0. Do not keep scanning/uploading while shutting down.
        if let Some(task) = st.vuln_scan_task.take() {
            task.abort();
        }

        // 1. Flush pending check results
        if !self.config.standalone {
            info!("Flushing pending check results to server...");
            self.upload_check_results().await;
        }

        // 2. Send final 'offline' heartbeat if possible
        let api_client = self.api_client.read().await;
        if let Some(client) = api_client.as_ref() {
            let usage = self.resource_monitor.get_usage();
            let request =
                offline_heartbeat_request(&usage, st.last_compliance_check_at, st.compliance_score);

            if let Err(e) = client.send_heartbeat(request).await {
                debug!("Could not send final offline heartbeat: {}", e);
            }
        }

        // 3. Stop FIM engine
        {
            let fim_engine = self.fim_engine.read().await;
            if let Some(engine) = fim_engine.as_ref() {
                engine.stop();
            }
        }
        self.stop_ransomware_canaries();
        self.stop_process_telemetry();

        // 4. Close database handle (implicit by Drop, but we can log it)
        info!("Closing database and terminating runtime.");

        info!("Agent shutdown complete");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_loop::testing::standalone_runtime;
    use std::time::Instant;

    #[test]
    fn the_last_heartbeat_says_offline_and_carries_the_last_score() {
        let usage = ResourceUsage {
            cpu_percent: 1.5,
            memory_bytes: 64 * 1024 * 1024,
            disk_kbps: 12,
            network_io_bytes: 0,
            uptime_ms: 125_000,
        };
        let checked_at = chrono::DateTime::parse_from_rfc3339("2026-10-01T08:30:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);

        let request = offline_heartbeat_request(&usage, Some(checked_at), Some(87.5));

        assert_eq!(request.status, "offline");
        assert_eq!(request.agent_version, AGENT_VERSION);
        assert_eq!(request.uptime_seconds, 125);
        assert_eq!(request.memory_bytes, 64 * 1024 * 1024);
        assert_eq!(request.compliance_score, Some(87.5));
        assert_eq!(
            request.last_check_at.as_deref(),
            Some(checked_at.to_rfc3339().as_str())
        );
        assert_eq!(request.pending_sync_count, 0);
        assert!(request.processes.is_empty() && request.connections.is_empty());
    }

    #[tokio::test]
    async fn shutdown_stops_the_background_scan() {
        let test = standalone_runtime();
        let mut st = LoopState::starting_at(Instant::now(), 6 * 3600, 3600);
        let scan = tokio::spawn(std::future::pending());
        let abort = scan.abort_handle();
        st.vuln_scan_task = Some(scan);

        test.runtime.shutdown_sequence(&mut st).await;

        assert!(st.vuln_scan_task.is_none());
        tokio::task::yield_now().await;
        assert!(abort.is_finished());
    }
}
