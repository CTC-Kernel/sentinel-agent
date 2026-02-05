//! State management for the Sentinel GRC Agent.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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
}
