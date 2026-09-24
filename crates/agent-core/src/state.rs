// Copyright (c) 2024-2026 Cyber Threat Consulting
// SPDX-License-Identifier: MIT

//! State management for the Sentinel GRC Agent.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU64, Ordering};

/// Runtime state indicators and flags.
pub struct RuntimeState {
    pub shutdown: Arc<AtomicBool>,
    pub paused: Arc<AtomicBool>,
    pub scanning: Arc<AtomicBool>,
    pub syncing: Arc<AtomicBool>,
    pub force_check: Arc<AtomicBool>,
    pub force_sync: Arc<AtomicBool>,
    pub force_discovery: Arc<AtomicBool>,
    pub force_update: Arc<AtomicBool>,
    pub discovery_cancel: Arc<AtomicBool>,
    /// Dynamic check interval in seconds (GUI-adjustable).
    pub check_interval_secs: Arc<AtomicU64>,
    /// Dynamic log level (0=trace, 1=debug, 2=info, 3=warn, 4=error).
    pub log_level: Arc<AtomicU8>,
    /// Channel for sending remediation requests from GUI to the background loop.
    pub remediation_tx: tokio::sync::mpsc::Sender<RemediationRequest>,
    /// Whether the SIEM forwarder is enabled.
    pub siem_enabled: Arc<AtomicBool>,
    /// SIEM output format (CEF, LEEF, JSON).
    pub siem_format: std::sync::Mutex<String>,
    /// SIEM transport protocol (Syslog, HTTP).
    pub siem_transport: std::sync::Mutex<String>,
    /// SIEM destination address (host:port or URL).
    pub siem_destination: std::sync::Mutex<String>,
    /// Whether the SIEM log collector is enabled.
    pub log_collector_enabled: Arc<AtomicBool>,
    /// Active log sources for the collector.
    pub log_collector_sources: std::sync::Mutex<Vec<String>>,
    /// Log collector polling interval in seconds.
    pub log_collector_poll_secs: Arc<AtomicU64>,
    /// Whether the LLM model is currently loaded (relaxes resource limits).
    pub llm_loaded: Arc<AtomicBool>,
    /// Network monitoring consent (platform `enable_network_monitoring`):
    /// when false, no network snapshot, connection list, network detection
    /// upload or LAN discovery. True until the platform says otherwise.
    pub network_monitoring: Arc<AtomicBool>,
    /// Last vulnerability scan results (cached for AI analysis context).
    pub last_vuln_findings:
        Arc<tokio::sync::RwLock<Option<agent_scanner::VulnerabilityScanResult>>>,
}

/// A request to remediate or preview a check.
#[derive(Debug, Clone)]
pub enum RemediationRequest {
    /// Execute remediation for a check.
    Execute { check_id: String },
    /// Generate and emit a preview for a check.
    Preview { check_id: String },
    /// Execute an AI-generated remediation action.
    ApplyAi {
        action: agent_common::types::RemediationAction,
    },
}

impl RuntimeState {
    pub fn new() -> (Self, tokio::sync::mpsc::Receiver<RemediationRequest>) {
        let (tx, rx) = tokio::sync::mpsc::channel(32);
        (
            Self {
                shutdown: Arc::new(AtomicBool::new(false)),
                paused: Arc::new(AtomicBool::new(false)),
                scanning: Arc::new(AtomicBool::new(false)),
                syncing: Arc::new(AtomicBool::new(false)),
                force_check: Arc::new(AtomicBool::new(false)),
                force_sync: Arc::new(AtomicBool::new(false)),
                force_discovery: Arc::new(AtomicBool::new(false)),
                force_update: Arc::new(AtomicBool::new(false)),
                discovery_cancel: Arc::new(AtomicBool::new(false)),
                check_interval_secs: Arc::new(AtomicU64::new(
                    agent_common::constants::DEFAULT_CHECK_INTERVAL_SECS,
                )),
                log_level: Arc::new(AtomicU8::new(2)), // info
                remediation_tx: tx,
                siem_enabled: Arc::new(AtomicBool::new(false)),
                siem_format: std::sync::Mutex::new("CEF".to_string()),
                siem_transport: std::sync::Mutex::new("Syslog".to_string()),
                siem_destination: std::sync::Mutex::new(String::new()),
                log_collector_enabled: Arc::new(AtomicBool::new(true)),
                log_collector_sources: std::sync::Mutex::new(vec![
                    "system".to_string(),
                    "auth".to_string(),
                    "application".to_string(),
                    "firewall".to_string(),
                ]),
                log_collector_poll_secs: Arc::new(AtomicU64::new(60)),
                llm_loaded: Arc::new(AtomicBool::new(false)),
                network_monitoring: Arc::new(AtomicBool::new(true)),
                last_vuln_findings: Arc::new(tokio::sync::RwLock::new(None)),
            },
            rx,
        )
    }

    pub fn is_shutdown(&self) -> bool {
        self.shutdown.load(Ordering::SeqCst)
    }

    pub fn request_shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }

    pub fn set_check_interval(&self, secs: u64) {
        self.check_interval_secs.store(secs, Ordering::Release);
    }

    pub fn get_check_interval(&self) -> u64 {
        self.check_interval_secs.load(Ordering::Acquire)
    }

    pub fn set_log_level(&self, level: u8) {
        self.log_level.store(level, Ordering::Release);
    }

    pub fn get_log_level(&self) -> u8 {
        self.log_level.load(Ordering::Acquire)
    }

    /// Whether network monitoring is allowed by the platform.
    pub fn network_monitoring_enabled(&self) -> bool {
        self.network_monitoring.load(Ordering::Acquire)
    }

    /// Apply the platform `enable_network_monitoring` value. `None` (the
    /// platform did not set it) keeps the current behaviour. Returns the
    /// previous value when it changed.
    pub fn apply_network_monitoring(&self, value: Option<bool>) -> Option<bool> {
        let enabled = value?;
        let previous = self.network_monitoring.swap(enabled, Ordering::AcqRel);
        (previous != enabled).then_some(previous)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_monitoring_defaults_on_and_absent_value_keeps_it() {
        let (state, _rx) = RuntimeState::new();
        assert!(state.network_monitoring_enabled());
        assert_eq!(state.apply_network_monitoring(None), None);
        assert!(state.network_monitoring_enabled());

        assert_eq!(state.apply_network_monitoring(Some(false)), Some(true));
        assert!(!state.network_monitoring_enabled());
        // Absent later: the last explicit value stays.
        assert_eq!(state.apply_network_monitoring(None), None);
        assert!(!state.network_monitoring_enabled());
        // Same value again: no change reported.
        assert_eq!(state.apply_network_monitoring(Some(false)), None);

        assert_eq!(state.apply_network_monitoring(Some(true)), Some(false));
        assert!(state.network_monitoring_enabled());
    }
}
