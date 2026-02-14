//! State management for the Sentinel GRC Agent.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};

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
    /// Dynamic log level (0=error, 1=warn, 2=info, 3=debug, 4=trace).
    pub log_level: Arc<AtomicU8>,
    /// Channel for sending remediation requests from GUI to the background loop.
    pub remediation_tx: tokio::sync::mpsc::Sender<RemediationRequest>,
}

/// A request to remediate or preview a check.
#[derive(Debug, Clone)]
pub enum RemediationRequest {
    /// Execute remediation for a check.
    Execute { check_id: String },
    /// Generate and emit a preview for a check.
    Preview { check_id: String },
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
}
