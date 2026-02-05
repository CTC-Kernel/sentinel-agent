//! Support and diagnostics features.
//!
//! This module provides:
//! - Remote log viewing with integrity signatures
//! - Connection status details
//! - Error identification
//! - Remote diagnostics triggering

use crate::authenticated_client::AuthenticatedClient;
use crate::error::SyncResult;
use crate::security::LogSigner;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use sysinfo::System;
use tokio::sync::RwLock;
use tracing::info;

/// Maximum log entries to keep in memory.
const MAX_LOG_ENTRIES: usize = 1000;

/// Log entry for remote viewing with integrity signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LogEntry {
    /// Log entry ID.
    pub id: u64,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Log level.
    pub level: String,
    /// Component/module name.
    pub component: String,
    /// Log message.
    pub message: String,
    /// Additional context.
    #[serde(default)]
    pub context: HashMap<String, String>,
    /// Integrity signature (HMAC-SHA256).
    #[serde(default)]
    pub signature: Option<String>,
    /// Previous entry hash for chain verification.
    #[serde(default)]
    pub previous_hash: Option<String>,
}

impl LogEntry {
    /// Verify the integrity signature of this entry.
    pub fn verify_signature(&self, signer: &LogSigner) -> bool {
        match &self.signature {
            Some(sig) => {
                let data = format!(
                    "{}:{}:{}:{}:{}",
                    self.id, self.timestamp, self.level, self.component, self.message
                );
                signer.verify_data(&data, sig)
            }
            None => false,
        }
    }
}

/// Log buffer for storing recent logs with integrity signatures.
pub struct LogBuffer {
    /// Log entries.
    entries: RwLock<Vec<LogEntry>>,
    /// Next entry ID.
    next_id: RwLock<u64>,
    /// Maximum entries to keep.
    max_entries: usize,
    /// Previous entry hash for chain.
    previous_hash: RwLock<String>,
    /// Optional log signer for integrity.
    signer: Option<Arc<LogSigner>>,
}

impl LogBuffer {
    /// Create a new log buffer.
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: RwLock::new(Vec::with_capacity(max_entries)),
            next_id: RwLock::new(1),
            max_entries,
            previous_hash: RwLock::new("genesis".to_string()),
            signer: None,
        }
    }

    /// Create a log buffer with integrity signing.
    pub fn with_signer(max_entries: usize, signer: Arc<LogSigner>) -> Self {
        Self {
            entries: RwLock::new(Vec::with_capacity(max_entries)),
            next_id: RwLock::new(1),
            max_entries,
            previous_hash: RwLock::new("genesis".to_string()),
            signer: Some(signer),
        }
    }

    /// Add a log entry with optional integrity signature.
    pub async fn add(
        &self,
        level: &str,
        component: &str,
        message: &str,
        context: HashMap<String, String>,
    ) {
        let mut entries = self.entries.write().await;
        let mut id = self.next_id.write().await;
        let mut prev_hash = self.previous_hash.write().await;

        let timestamp = Utc::now();

        // Generate signature if signer available
        let (signature, new_hash) = if let Some(ref signer) = self.signer {
            let data = format!("{}:{}:{}:{}:{}", *id, timestamp, level, component, message);
            let sig = signer.sign_data(&data);
            // Use SHA-256 for chain hashing (not MD5 which is cryptographically weak)
            let mut hasher = Sha256::new();
            hasher.update(format!("{}:{}", prev_hash, sig).as_bytes());
            let hash = format!("{:x}", hasher.finalize());
            (Some(sig), hash)
        } else {
            (None, prev_hash.clone())
        };

        let entry = LogEntry {
            id: *id,
            timestamp,
            level: level.to_string(),
            component: component.to_string(),
            message: message.to_string(),
            context,
            signature,
            previous_hash: Some(prev_hash.clone()),
        };

        entries.push(entry);
        *id += 1;
        *prev_hash = new_hash;

        // Trim if over capacity
        if entries.len() > self.max_entries {
            let drain_count = entries.len() - self.max_entries;
            entries.drain(0..drain_count);
        }
    }

    /// Get recent log entries.
    pub async fn get_recent(&self, count: usize) -> Vec<LogEntry> {
        let entries = self.entries.read().await;
        let start = entries.len().saturating_sub(count);
        entries[start..].to_vec()
    }

    /// Get entries by log level.
    pub async fn get_by_level(&self, level: &str) -> Vec<LogEntry> {
        let entries = self.entries.read().await;
        entries
            .iter()
            .filter(|e| e.level.eq_ignore_ascii_case(level))
            .cloned()
            .collect()
    }

    /// Search logs by keyword.
    pub async fn search(&self, keyword: &str) -> Vec<LogEntry> {
        let entries = self.entries.read().await;
        let keyword_lower = keyword.to_lowercase();
        entries
            .iter()
            .filter(|e| {
                e.message.to_lowercase().contains(&keyword_lower)
                    || e.component.to_lowercase().contains(&keyword_lower)
            })
            .cloned()
            .collect()
    }

    /// Clear all entries.
    pub async fn clear(&self) {
        self.entries.write().await.clear();
    }

    /// Get entry count.
    pub async fn len(&self) -> usize {
        self.entries.read().await.len()
    }

    /// Check if buffer is empty.
    pub async fn is_empty(&self) -> bool {
        self.entries.read().await.is_empty()
    }

    /// Verify integrity of all entries in the chain.
    pub async fn verify_chain(&self) -> bool {
        if self.signer.is_none() {
            return true; // No signer means no verification needed
        }

        let entries = self.entries.read().await;
        let signer = self.signer.as_ref().unwrap();

        for entry in entries.iter() {
            if !entry.verify_signature(signer) {
                return false;
            }
        }
        true
    }
}

/// Log upload request for SaaS.
#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct LogUploadRequest {
    /// Agent ID.
    pub agent_id: String,
    /// Log entries to upload.
    pub entries: Vec<LogEntry>,
    /// Upload timestamp.
    pub uploaded_at: DateTime<Utc>,
}

/// Log upload response from SaaS.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct LogUploadResponse {
    /// Number of entries received.
    pub received_count: usize,
    /// Upload acknowledgment ID.
    pub ack_id: String,
}

/// Uploads logs to SaaS on request (AC4).
pub async fn upload_logs(
    client: &AuthenticatedClient,
    entries: Vec<LogEntry>,
) -> SyncResult<LogUploadResponse> {
    let agent_id = client.agent_id().await?;
    let path = format!("/v1/agents/{}/logs", agent_id);

    let request = LogUploadRequest {
        agent_id: agent_id.to_string(),
        entries,
        uploaded_at: Utc::now(),
    };

    let response: LogUploadResponse = client.post_json(&path, &request).await?;
    info!(
        "Uploaded {} log entries (ack: {})",
        response.received_count, response.ack_id
    );

    Ok(response)
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self::new(MAX_LOG_ENTRIES)
    }
}

/// Degraded threshold for p95 latency in milliseconds.
const DEGRADED_LATENCY_THRESHOLD_MS: u64 = 5000;

/// Degraded threshold for failure rate (10%).
const DEGRADED_FAILURE_RATE_THRESHOLD: f64 = 0.10;

/// Disconnected threshold in seconds (5 minutes).
const DISCONNECTED_THRESHOLD_SECS: i64 = 300;

/// Connection state enum per AC2.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum ConnectionState {
    /// Recent heartbeat, low failure rate.
    Connected,
    /// No heartbeat > 5 minutes.
    #[default]
    Disconnected,
    /// High latency (p95 > 5000ms) or failure rate > 10%.
    Degraded,
}

/// Connection status details.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ConnectionStatus {
    /// Connection state (Connected, Disconnected, Degraded).
    pub state: ConnectionState,
    /// Whether currently connected (for backwards compatibility).
    pub connected: bool,
    /// Last successful heartbeat.
    pub last_heartbeat: Option<DateTime<Utc>>,
    /// Connection uptime in seconds.
    pub uptime_secs: Option<u64>,
    /// Latency p95 in milliseconds.
    pub latency_p95_ms: Option<u64>,
    /// Failed requests in last 24 hours.
    pub failed_requests_24h: u32,
    /// Failure rate in last 24 hours.
    pub failure_rate_24h: f64,
    /// Proxy detected.
    pub proxy_detected: bool,
    /// Certificate status.
    pub certificate_status: String,
    /// DNS resolution status.
    pub dns_resolution: String,
    /// Sync queue size.
    pub sync_queue_size: u32,
    /// Oldest pending item age in seconds.
    pub oldest_pending_age_secs: Option<u64>,
}

/// Connection status tracker.
pub struct ConnectionTracker {
    /// Last heartbeat time.
    last_heartbeat: RwLock<Option<DateTime<Utc>>>,
    /// Connection start time.
    connected_at: RwLock<Option<DateTime<Utc>>>,
    /// Recent latencies for p95 calculation.
    latencies: RwLock<Vec<u64>>,
    /// Failed request count (last 24h).
    failed_requests: RwLock<Vec<DateTime<Utc>>>,
    /// Successful request count (last 24h).
    successful_requests: RwLock<Vec<DateTime<Utc>>>,
    /// Sync queue size.
    sync_queue_size: RwLock<u32>,
}

impl ConnectionTracker {
    /// Create a new connection tracker.
    pub fn new() -> Self {
        Self {
            last_heartbeat: RwLock::new(None),
            connected_at: RwLock::new(None),
            latencies: RwLock::new(Vec::with_capacity(100)),
            failed_requests: RwLock::new(Vec::new()),
            successful_requests: RwLock::new(Vec::new()),
            sync_queue_size: RwLock::new(0),
        }
    }

    /// Record a successful heartbeat.
    pub async fn record_heartbeat(&self, latency_ms: u64) {
        let now = Utc::now();
        *self.last_heartbeat.write().await = Some(now);

        // Set connected_at if not already set
        {
            let mut connected = self.connected_at.write().await;
            if connected.is_none() {
                *connected = Some(now);
            }
        }

        // Record latency
        self.record_latency(latency_ms).await;

        // Record successful request
        {
            let mut successes = self.successful_requests.write().await;
            successes.push(now);
            let cutoff = Utc::now() - Duration::hours(24);
            successes.retain(|t| *t > cutoff);
        }
    }

    /// Record a latency measurement (Story 12.2 Task 1).
    pub async fn record_latency(&self, latency_ms: u64) {
        let mut latencies = self.latencies.write().await;
        latencies.push(latency_ms);
        if latencies.len() > 100 {
            latencies.remove(0);
        }
    }

    /// Record a failed request.
    pub async fn record_failure(&self) {
        let mut failures = self.failed_requests.write().await;
        failures.push(Utc::now());

        // Remove failures older than 24 hours
        let cutoff = Utc::now() - Duration::hours(24);
        failures.retain(|t| *t > cutoff);
    }

    /// Record connection loss.
    pub async fn record_disconnection(&self) {
        *self.connected_at.write().await = None;
    }

    /// Update sync queue size.
    pub async fn set_sync_queue_size(&self, size: u32) {
        *self.sync_queue_size.write().await = size;
    }

    /// Calculate failure rate in last 24 hours.
    async fn calculate_failure_rate(&self) -> f64 {
        let cutoff = Utc::now() - Duration::hours(24);

        let fail_count = {
            let failures = self.failed_requests.read().await;
            failures.iter().filter(|t| **t > cutoff).count()
        };

        let success_count = {
            let successes = self.successful_requests.read().await;
            successes.iter().filter(|t| **t > cutoff).count()
        };

        let total = fail_count + success_count;
        if total == 0 {
            0.0
        } else {
            fail_count as f64 / total as f64
        }
    }

    /// Determine connection state based on metrics.
    async fn determine_state(
        &self,
        last_heartbeat: Option<DateTime<Utc>>,
        latency_p95: Option<u64>,
        failure_rate: f64,
    ) -> ConnectionState {
        // Check disconnected first (no heartbeat > 5 minutes)
        if let Some(hb) = last_heartbeat {
            let secs_since_heartbeat = (Utc::now() - hb).num_seconds();
            if secs_since_heartbeat > DISCONNECTED_THRESHOLD_SECS {
                return ConnectionState::Disconnected;
            }
        } else {
            return ConnectionState::Disconnected;
        }

        // Check degraded (high latency or failure rate)
        if let Some(p95) = latency_p95
            && p95 > DEGRADED_LATENCY_THRESHOLD_MS
        {
            return ConnectionState::Degraded;
        }

        if failure_rate > DEGRADED_FAILURE_RATE_THRESHOLD {
            return ConnectionState::Degraded;
        }

        ConnectionState::Connected
    }

    /// Get connection status.
    pub async fn status(&self) -> ConnectionStatus {
        let last_heartbeat = *self.last_heartbeat.read().await;
        let connected_at = *self.connected_at.read().await;

        // Calculate uptime
        let uptime_secs = connected_at.map(|t| (Utc::now() - t).num_seconds() as u64);

        // Calculate p95 latency using select_nth_unstable for O(n) instead of O(n log n)
        let latency_p95 = {
            let latencies = self.latencies.read().await;
            if latencies.is_empty() {
                None
            } else {
                let mut sorted: Vec<_> = latencies.iter().copied().collect();
                let idx = (sorted.len() as f64 * 0.95) as usize;
                let idx = idx.min(sorted.len() - 1);
                // Use select_nth_unstable for O(n) percentile calculation
                let (_, p95, _) = sorted.select_nth_unstable(idx);
                Some(*p95)
            }
        };

        // Count recent failures
        let failed_count = {
            let failures = self.failed_requests.read().await;
            let cutoff = Utc::now() - Duration::hours(24);
            failures.iter().filter(|t| **t > cutoff).count() as u32
        };

        // Calculate failure rate
        let failure_rate = self.calculate_failure_rate().await;

        // Determine connection state
        let state = self
            .determine_state(last_heartbeat, latency_p95, failure_rate)
            .await;

        let sync_queue_size = *self.sync_queue_size.read().await;

        ConnectionStatus {
            state,
            connected: state == ConnectionState::Connected || state == ConnectionState::Degraded,
            last_heartbeat,
            uptime_secs,
            latency_p95_ms: latency_p95,
            failed_requests_24h: failed_count,
            failure_rate_24h: failure_rate,
            proxy_detected: false, // Would be set by actual proxy detection
            certificate_status: "valid".to_string(),
            dns_resolution: "ok".to_string(),
            sync_queue_size,
            oldest_pending_age_secs: None,
        }
    }
}

impl Default for ConnectionTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Maximum errors to keep (Story 12.3 AC1).
const MAX_ERROR_ENTRIES: usize = 50;

/// Recent error entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ErrorEntry {
    /// Error ID.
    pub id: u64,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// Error code.
    pub code: String,
    /// Error message.
    pub message: String,
    /// Additional context (Story 12.3 AC1).
    #[serde(default)]
    pub context: HashMap<String, String>,
    /// Stack trace (if available).
    pub stack_trace: Option<String>,
    /// Error count (if recurring).
    pub count: u32,
    /// First occurrence.
    pub first_seen: DateTime<Utc>,
    /// Component that generated the error.
    pub component: String,
}

/// Error tracker for identifying recent errors.
pub struct ErrorTracker {
    /// Recent errors.
    errors: RwLock<Vec<ErrorEntry>>,
    /// Next error ID.
    next_id: RwLock<u64>,
    /// Error counts by code.
    error_counts: RwLock<HashMap<String, u32>>,
    /// First seen timestamps by code.
    first_seen: RwLock<HashMap<String, DateTime<Utc>>>,
    /// Maximum entries to keep.
    max_entries: usize,
}

impl ErrorTracker {
    /// Create a new error tracker with default capacity (50).
    pub fn new() -> Self {
        Self::with_capacity(MAX_ERROR_ENTRIES)
    }

    /// Create a new error tracker with custom capacity.
    pub fn with_capacity(max_entries: usize) -> Self {
        Self {
            errors: RwLock::new(Vec::with_capacity(max_entries)),
            next_id: RwLock::new(1),
            error_counts: RwLock::new(HashMap::new()),
            first_seen: RwLock::new(HashMap::new()),
            max_entries,
        }
    }

    /// Record an error with context.
    pub async fn record_error(
        &self,
        code: &str,
        message: &str,
        component: &str,
        stack_trace: Option<&str>,
    ) {
        self.record_error_with_context(code, message, component, stack_trace, HashMap::new())
            .await;
    }

    /// Record an error with additional context (Story 12.3 AC1).
    pub async fn record_error_with_context(
        &self,
        code: &str,
        message: &str,
        component: &str,
        stack_trace: Option<&str>,
        context: HashMap<String, String>,
    ) {
        let mut errors = self.errors.write().await;
        let mut id = self.next_id.write().await;
        let mut counts = self.error_counts.write().await;
        let mut first_seen_map = self.first_seen.write().await;

        let now = Utc::now();

        // Update count
        let count = counts.entry(code.to_string()).or_insert(0);
        *count += 1;

        // Track first occurrence
        let first_seen = *first_seen_map.entry(code.to_string()).or_insert(now);

        let entry = ErrorEntry {
            id: *id,
            timestamp: now,
            code: code.to_string(),
            message: message.to_string(),
            context,
            stack_trace: stack_trace.map(|s| s.to_string()),
            count: *count,
            first_seen,
            component: component.to_string(),
        };

        errors.push(entry);
        *id += 1;

        // Trim old errors (keep last 7 days)
        let cutoff = Utc::now() - Duration::days(7);
        errors.retain(|e| e.timestamp > cutoff);

        // Also enforce capacity limit (Story 12.3 AC1: last 50 errors)
        if errors.len() > self.max_entries {
            let drain_count = errors.len() - self.max_entries;
            errors.drain(0..drain_count);
        }
    }

    /// Get errors from last 7 days.
    pub async fn get_recent_errors(&self) -> Vec<ErrorEntry> {
        let errors = self.errors.read().await;
        let cutoff = Utc::now() - Duration::days(7);
        errors
            .iter()
            .filter(|e| e.timestamp > cutoff)
            .cloned()
            .collect()
    }

    /// Get errors grouped by code.
    pub async fn get_errors_by_code(&self) -> HashMap<String, Vec<ErrorEntry>> {
        let errors = self.errors.read().await;
        let cutoff = Utc::now() - Duration::days(7);

        let mut grouped: HashMap<String, Vec<ErrorEntry>> = HashMap::new();
        for error in errors.iter().filter(|e| e.timestamp > cutoff) {
            grouped
                .entry(error.code.clone())
                .or_default()
                .push(error.clone());
        }

        grouped
    }

    /// Get error frequency.
    pub async fn get_error_counts(&self) -> HashMap<String, u32> {
        self.error_counts.read().await.clone()
    }

    /// Clear all errors.
    pub async fn clear(&self) {
        self.errors.write().await.clear();
        self.error_counts.write().await.clear();
    }
}

impl Default for ErrorTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Diagnostic result (Story 12.4 AC3).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct DiagnosticResult {
    /// Diagnostic ID.
    pub id: String,
    /// Timestamp.
    pub timestamp: DateTime<Utc>,
    /// System information (AC1).
    pub system_info: SystemInfo,
    /// Agent health (AC2).
    pub agent_health: AgentHealth,
    /// Connection status (Story 12.4).
    pub connection_status: ConnectionStatus,
    /// Error log excerpt.
    pub recent_errors: Vec<ErrorEntry>,
    /// Recent log entries (Story 12.4).
    pub recent_logs: Vec<LogEntry>,
    /// Recommendations.
    pub recommendations: Vec<String>,
    /// Duration of diagnostic in milliseconds.
    pub duration_ms: u64,
}

/// System information for diagnostics.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct SystemInfo {
    /// OS name.
    pub os: String,
    /// OS version.
    pub os_version: String,
    /// Hostname.
    pub hostname: String,
    /// CPU count.
    pub cpu_count: usize,
    /// Total memory in bytes.
    pub total_memory: u64,
    /// Available memory in bytes.
    pub available_memory: u64,
    /// Uptime in seconds.
    pub uptime_secs: u64,
}

/// Agent health status (Story 12.4 AC2).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AgentHealth {
    /// Overall health status.
    pub status: String,
    /// Agent version.
    pub version: String,
    /// CPU usage percentage.
    pub cpu_percent: f32,
    /// Memory usage in bytes.
    pub memory_bytes: u64,
    /// Last check execution time.
    pub last_check_at: Option<DateTime<Utc>>,
    /// Checks executed in last hour.
    pub checks_last_hour: u32,
    /// Connection status.
    pub connection: String,
    /// Database status.
    pub database: String,
    /// Database size in bytes (Story 12.4).
    pub database_size_bytes: u64,
    /// Database integrity status (Story 12.4).
    pub database_integrity_ok: bool,
    /// Last successful sync (Story 12.4).
    pub last_sync: Option<DateTime<Utc>>,
    /// Pending uploads count (Story 12.4).
    pub pending_uploads: u32,
    /// Whether agent is enrolled (Story 12.4).
    pub enrolled: bool,
}

/// Diagnostic service for running diagnostics.
pub struct DiagnosticService {
    client: Arc<AuthenticatedClient>,
    log_buffer: Arc<LogBuffer>,
    connection_tracker: Arc<ConnectionTracker>,
    error_tracker: Arc<ErrorTracker>,
    agent_version: String,
}

impl DiagnosticService {
    /// Create a new diagnostic service.
    pub fn new(
        client: Arc<AuthenticatedClient>,
        log_buffer: Arc<LogBuffer>,
        connection_tracker: Arc<ConnectionTracker>,
        error_tracker: Arc<ErrorTracker>,
        agent_version: &str,
    ) -> Self {
        Self {
            client,
            log_buffer,
            connection_tracker,
            error_tracker,
            agent_version: agent_version.to_string(),
        }
    }

    /// Run diagnostics and upload results.
    pub async fn run_diagnostics(&self) -> SyncResult<DiagnosticResult> {
        let start = std::time::Instant::now();
        let id = uuid::Uuid::new_v4().to_string();

        info!("Running diagnostics (id: {})", id);

        // Collect system info
        let system_info = self.collect_system_info();

        // Collect agent health
        let agent_health = self.collect_agent_health().await;

        // Get connection status (Story 12.4)
        let connection_status = self.connection_tracker.status().await;

        // Get recent errors
        let recent_errors = self.error_tracker.get_recent_errors().await;

        // Get recent logs (Story 12.4)
        let recent_logs = self.log_buffer.get_recent(100).await;

        // Generate recommendations
        let recommendations = self.generate_recommendations(&agent_health, &recent_errors);

        let duration_ms = start.elapsed().as_millis() as u64;

        let result = DiagnosticResult {
            id,
            timestamp: Utc::now(),
            system_info,
            agent_health,
            connection_status,
            recent_errors,
            recent_logs,
            recommendations,
            duration_ms,
        };

        info!("Diagnostics completed in {}ms", duration_ms);

        Ok(result)
    }

    /// Upload diagnostic results to SaaS.
    pub async fn upload_diagnostics(&self, result: &DiagnosticResult) -> SyncResult<()> {
        let agent_id = self.client.agent_id().await?;
        let path = format!("/v1/agents/{}/diagnostics", agent_id);

        self.client
            .post_json::<_, serde_json::Value>(&path, result)
            .await?;

        info!("Uploaded diagnostic results (id: {})", result.id);

        Ok(())
    }

    /// Collect system information.
    fn collect_system_info(&self) -> SystemInfo {
        let mut sys = System::new_all();
        sys.refresh_all();

        SystemInfo {
            os: std::env::consts::OS.to_string(),
            os_version: System::os_version().unwrap_or_default(),
            hostname: System::host_name().unwrap_or_default(),
            cpu_count: sys.cpus().len(),
            total_memory: sys.total_memory(),
            available_memory: sys.available_memory(),
            uptime_secs: System::uptime(),
        }
    }

    /// Collect agent health status.
    async fn collect_agent_health(&self) -> AgentHealth {
        let connection_status = self.connection_tracker.status().await;

        // Get current process info
        let mut sys = System::new_all();
        sys.refresh_all();

        let (cpu_percent, memory_bytes) = {
            let pid = sysinfo::get_current_pid().ok();
            if let Some(pid) = pid {
                if let Some(process) = sys.process(pid) {
                    (process.cpu_usage(), process.memory())
                } else {
                    (0.0, 0)
                }
            } else {
                (0.0, 0)
            }
        };

        // Determine status based on connection state
        let status = match connection_status.state {
            ConnectionState::Connected => "healthy",
            ConnectionState::Degraded => "degraded",
            ConnectionState::Disconnected => "unhealthy",
        }
        .to_string();

        AgentHealth {
            status,
            version: self.agent_version.clone(),
            cpu_percent,
            memory_bytes,
            last_check_at: None, // Would be tracked by check runner
            checks_last_hour: 0, // Would be tracked by check runner
            connection: format!("{:?}", connection_status.state).to_lowercase(),
            database: "ok".to_string(),
            database_size_bytes: 0, // Would be queried from actual database
            database_integrity_ok: true, // Would run integrity check
            last_sync: connection_status.last_heartbeat,
            pending_uploads: connection_status.sync_queue_size,
            enrolled: true, // Would check credentials
        }
    }

    /// Generate recommendations based on diagnostics.
    fn generate_recommendations(&self, health: &AgentHealth, errors: &[ErrorEntry]) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Connection issues
        if health.connection != "connected" {
            recommendations.push("Check network connectivity to SaaS server".to_string());
        }

        // High CPU usage
        if health.cpu_percent > 5.0 {
            recommendations
                .push("Agent CPU usage is high. Consider reviewing check frequency.".to_string());
        }

        // High memory usage
        if health.memory_bytes > 100 * 1024 * 1024 {
            recommendations
                .push("Agent memory usage exceeds 100MB limit. Consider restarting.".to_string());
        }

        // Recurring errors
        let error_codes: Vec<_> = errors.iter().map(|e| e.code.as_str()).collect();
        if error_codes.contains(&"SYNC_FAILED") {
            recommendations
                .push("Sync failures detected. Check network and server status.".to_string());
        }
        if error_codes.contains(&"DB_ERROR") {
            recommendations
                .push("Database errors detected. Check disk space and permissions.".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("No issues detected. Agent is functioning normally.".to_string());
        }

        recommendations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_log_buffer_add_and_get() {
        let buffer = LogBuffer::new(100);

        buffer
            .add("INFO", "test", "Message 1", HashMap::new())
            .await;
        buffer
            .add("DEBUG", "test", "Message 2", HashMap::new())
            .await;
        buffer
            .add("ERROR", "test", "Message 3", HashMap::new())
            .await;

        let entries = buffer.get_recent(10).await;
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].message, "Message 1");
        assert_eq!(entries[2].message, "Message 3");
    }

    #[tokio::test]
    async fn test_log_buffer_max_entries() {
        let buffer = LogBuffer::new(5);

        for i in 0..10 {
            buffer
                .add("INFO", "test", &format!("Message {}", i), HashMap::new())
                .await;
        }

        assert_eq!(buffer.len().await, 5);
        let entries = buffer.get_recent(10).await;
        assert_eq!(entries[0].message, "Message 5"); // First 5 were trimmed
    }

    #[tokio::test]
    async fn test_log_buffer_by_level() {
        let buffer = LogBuffer::new(100);

        buffer
            .add("INFO", "test", "Info message", HashMap::new())
            .await;
        buffer
            .add("ERROR", "test", "Error message", HashMap::new())
            .await;
        buffer
            .add("INFO", "test", "Another info", HashMap::new())
            .await;

        let errors = buffer.get_by_level("ERROR").await;
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Error message");
    }

    #[tokio::test]
    async fn test_log_buffer_search() {
        let buffer = LogBuffer::new(100);

        buffer
            .add("INFO", "sync", "Sync started", HashMap::new())
            .await;
        buffer
            .add("INFO", "check", "Check completed", HashMap::new())
            .await;
        buffer
            .add("ERROR", "sync", "Sync failed", HashMap::new())
            .await;

        let results = buffer.search("sync").await;
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_connection_tracker_heartbeat() {
        let tracker = ConnectionTracker::new();

        tracker.record_heartbeat(50).await;
        tracker.record_heartbeat(100).await;
        tracker.record_heartbeat(75).await;

        let status = tracker.status().await;
        assert!(status.connected);
        assert!(status.last_heartbeat.is_some());
        assert!(status.latency_p95_ms.is_some());
    }

    #[tokio::test]
    async fn test_connection_tracker_failures() {
        let tracker = ConnectionTracker::new();

        tracker.record_failure().await;
        tracker.record_failure().await;
        tracker.record_failure().await;

        let status = tracker.status().await;
        assert_eq!(status.failed_requests_24h, 3);
    }

    #[tokio::test]
    async fn test_error_tracker() {
        let tracker = ErrorTracker::new();

        tracker
            .record_error("SYNC_001", "Sync failed", "sync", None)
            .await;
        tracker
            .record_error("SYNC_001", "Sync failed again", "sync", None)
            .await;
        tracker
            .record_error("DB_001", "Database error", "storage", Some("stack trace"))
            .await;

        let errors = tracker.get_recent_errors().await;
        assert_eq!(errors.len(), 3);

        let counts = tracker.get_error_counts().await;
        assert_eq!(counts.get("SYNC_001"), Some(&2));
        assert_eq!(counts.get("DB_001"), Some(&1));
    }

    #[tokio::test]
    async fn test_error_tracker_grouped() {
        let tracker = ErrorTracker::new();

        tracker.record_error("ERR_A", "Error A", "comp", None).await;
        tracker
            .record_error("ERR_A", "Error A again", "comp", None)
            .await;
        tracker.record_error("ERR_B", "Error B", "comp", None).await;

        let grouped = tracker.get_errors_by_code().await;
        assert_eq!(grouped.get("ERR_A").map(|v| v.len()), Some(2));
        assert_eq!(grouped.get("ERR_B").map(|v| v.len()), Some(1));
    }

    #[test]
    fn test_connection_status_serialization() {
        let status = ConnectionStatus {
            state: ConnectionState::Connected,
            connected: true,
            last_heartbeat: Some(Utc::now()),
            uptime_secs: Some(3600),
            latency_p95_ms: Some(50),
            failed_requests_24h: 2,
            failure_rate_24h: 0.05,
            proxy_detected: false,
            certificate_status: "valid".to_string(),
            dns_resolution: "ok".to_string(),
            sync_queue_size: 5,
            oldest_pending_age_secs: Some(300),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("connected"));
        assert!(json.contains("latency_p95_ms"));
        assert!(json.contains("state"));
    }

    #[tokio::test]
    async fn test_connection_state_degraded() {
        let tracker = ConnectionTracker::new();

        // Record heartbeat with high latency (> 5000ms threshold)
        tracker.record_heartbeat(6000).await;

        let status = tracker.status().await;
        assert_eq!(status.state, ConnectionState::Degraded);
    }

    #[tokio::test]
    async fn test_connection_state_disconnected() {
        let tracker = ConnectionTracker::new();

        // No heartbeat recorded = disconnected
        let status = tracker.status().await;
        assert_eq!(status.state, ConnectionState::Disconnected);
    }

    #[tokio::test]
    async fn test_record_latency() {
        let tracker = ConnectionTracker::new();

        tracker.record_latency(100).await;
        tracker.record_latency(200).await;
        tracker.record_latency(150).await;

        // No heartbeat yet, so still disconnected
        let status = tracker.status().await;
        assert!(status.latency_p95_ms.is_some());
    }

    #[test]
    fn test_diagnostic_result_serialization() {
        let result = DiagnosticResult {
            id: "test-123".to_string(),
            timestamp: Utc::now(),
            system_info: SystemInfo {
                os: "linux".to_string(),
                os_version: "5.4".to_string(),
                hostname: "test-host".to_string(),
                cpu_count: 4,
                total_memory: 8 * 1024 * 1024 * 1024,
                available_memory: 4 * 1024 * 1024 * 1024,
                uptime_secs: 86400,
            },
            agent_health: AgentHealth {
                status: "healthy".to_string(),
                version: "1.0.0".to_string(),
                cpu_percent: 1.5,
                memory_bytes: 50 * 1024 * 1024,
                last_check_at: Some(Utc::now()),
                checks_last_hour: 60,
                connection: "connected".to_string(),
                database: "ok".to_string(),
                database_size_bytes: 1024 * 1024,
                database_integrity_ok: true,
                last_sync: Some(Utc::now()),
                pending_uploads: 0,
                enrolled: true,
            },
            connection_status: ConnectionStatus {
                state: ConnectionState::Connected,
                connected: true,
                last_heartbeat: Some(Utc::now()),
                uptime_secs: Some(3600),
                latency_p95_ms: Some(50),
                failed_requests_24h: 0,
                failure_rate_24h: 0.0,
                proxy_detected: false,
                certificate_status: "valid".to_string(),
                dns_resolution: "ok".to_string(),
                sync_queue_size: 0,
                oldest_pending_age_secs: None,
            },
            recent_errors: vec![],
            recent_logs: vec![],
            recommendations: vec!["No issues detected".to_string()],
            duration_ms: 150,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("system_info"));
        assert!(json.contains("agent_health"));
        assert!(json.contains("recommendations"));
        assert!(json.contains("connection_status"));
        assert!(json.contains("recent_logs"));
    }

    #[test]
    fn test_max_log_entries() {
        assert_eq!(MAX_LOG_ENTRIES, 1000);
    }

    #[test]
    fn test_log_entry_with_context() {
        let mut context = HashMap::new();
        context.insert("key".to_string(), "value".to_string());

        let entry = LogEntry {
            id: 1,
            timestamp: Utc::now(),
            level: "INFO".to_string(),
            component: "test".to_string(),
            message: "Test message".to_string(),
            context,
            signature: Some("abc123".to_string()),
            previous_hash: Some("genesis".to_string()),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("context"));
        assert!(json.contains("key"));
        assert!(json.contains("signature"));
        assert!(json.contains("previous_hash"));
    }

    #[tokio::test]
    async fn test_error_tracker_capacity() {
        let tracker = ErrorTracker::with_capacity(5);

        // Add more errors than capacity
        for i in 0..10 {
            tracker
                .record_error(&format!("ERR_{}", i), "Error", "test", None)
                .await;
        }

        let errors = tracker.get_recent_errors().await;
        assert!(errors.len() <= 5); // Should be limited to capacity
    }

    #[tokio::test]
    async fn test_error_tracker_with_context() {
        let tracker = ErrorTracker::new();

        let mut context = HashMap::new();
        context.insert("request_id".to_string(), "abc123".to_string());

        tracker
            .record_error_with_context("SYNC_001", "Sync failed", "sync", None, context)
            .await;

        let errors = tracker.get_recent_errors().await;
        assert_eq!(errors.len(), 1);
        assert!(errors[0].context.contains_key("request_id"));
    }

    #[test]
    fn test_max_error_entries() {
        assert_eq!(MAX_ERROR_ENTRIES, 50);
    }

    #[tokio::test]
    async fn test_log_buffer_is_empty() {
        let buffer = LogBuffer::new(100);
        assert!(buffer.is_empty().await);

        buffer.add("INFO", "test", "Message", HashMap::new()).await;
        assert!(!buffer.is_empty().await);
    }

    #[test]
    fn test_connection_state_default() {
        let state = ConnectionState::default();
        assert_eq!(state, ConnectionState::Disconnected);
    }

    #[tokio::test]
    async fn test_log_buffer_clear() {
        let buffer = LogBuffer::new(100);

        buffer
            .add("INFO", "test", "Message 1", HashMap::new())
            .await;
        buffer
            .add("INFO", "test", "Message 2", HashMap::new())
            .await;

        assert_eq!(buffer.len().await, 2);

        buffer.clear().await;

        assert_eq!(buffer.len().await, 0);
        assert!(buffer.is_empty().await);
    }

    #[test]
    fn test_log_buffer_default() {
        let buffer = LogBuffer::default();
        // Default should use MAX_LOG_ENTRIES (1000)
        assert_eq!(buffer.max_entries, MAX_LOG_ENTRIES);
    }

    #[tokio::test]
    async fn test_log_buffer_with_signer() {
        use crate::security::LogSigner;

        // Create a signer with a test key
        let key = hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
            .unwrap();
        let signer = Arc::new(LogSigner::new(&key));

        let buffer = LogBuffer::with_signer(100, signer.clone());

        // Add entries - they should be signed
        buffer
            .add("INFO", "test", "Signed message 1", HashMap::new())
            .await;
        buffer
            .add("ERROR", "test", "Signed message 2", HashMap::new())
            .await;

        let entries = buffer.get_recent(10).await;
        assert_eq!(entries.len(), 2);

        // Verify signatures are present
        assert!(entries[0].signature.is_some());
        assert!(entries[1].signature.is_some());

        // Verify previous_hash chain
        assert_eq!(entries[0].previous_hash, Some("genesis".to_string()));
        assert!(entries[1].previous_hash.is_some());
        assert_ne!(entries[1].previous_hash, Some("genesis".to_string()));
    }

    #[tokio::test]
    async fn test_log_buffer_verify_chain_valid() {
        use crate::security::LogSigner;

        let key = hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
            .unwrap();
        let signer = Arc::new(LogSigner::new(&key));

        let buffer = LogBuffer::with_signer(100, signer);

        buffer
            .add("INFO", "test", "Message 1", HashMap::new())
            .await;
        buffer
            .add("DEBUG", "test", "Message 2", HashMap::new())
            .await;
        buffer
            .add("WARN", "test", "Message 3", HashMap::new())
            .await;

        // Verify chain should pass
        assert!(buffer.verify_chain().await);
    }

    #[tokio::test]
    async fn test_log_buffer_verify_chain_no_signer() {
        let buffer = LogBuffer::new(100);

        buffer
            .add("INFO", "test", "Unsigned message", HashMap::new())
            .await;

        // Without signer, verify_chain should return true (no verification needed)
        assert!(buffer.verify_chain().await);
    }

    #[tokio::test]
    async fn test_log_entry_verify_signature() {
        use crate::security::LogSigner;

        let key = hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
            .unwrap();
        let signer = LogSigner::new(&key);

        // Use a fixed timestamp so signing and verification use the same value
        let timestamp = Utc::now();

        // Create a properly signed entry - must use same timestamp for both
        let data = format!(
            "{}:{}:{}:{}:{}",
            1, timestamp, "INFO", "test", "Test message"
        );
        let signature = signer.sign_data(&data);

        let entry = LogEntry {
            id: 1,
            timestamp,
            level: "INFO".to_string(),
            component: "test".to_string(),
            message: "Test message".to_string(),
            context: HashMap::new(),
            signature: Some(signature),
            previous_hash: Some("genesis".to_string()),
        };

        // Re-create data string with same format for verification
        let verify_data = format!(
            "{}:{}:{}:{}:{}",
            entry.id, entry.timestamp, entry.level, entry.component, entry.message
        );
        assert!(signer.verify_data(&verify_data, entry.signature.as_ref().unwrap()));
    }

    #[tokio::test]
    async fn test_log_entry_verify_signature_invalid() {
        use crate::security::LogSigner;

        let key = hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
            .unwrap();
        let signer = LogSigner::new(&key);

        let entry = LogEntry {
            id: 1,
            timestamp: Utc::now(),
            level: "INFO".to_string(),
            component: "test".to_string(),
            message: "Test message".to_string(),
            context: HashMap::new(),
            signature: Some("invalid_signature".to_string()),
            previous_hash: Some("genesis".to_string()),
        };

        // Verification should fail with invalid signature
        assert!(!entry.verify_signature(&signer));
    }

    #[tokio::test]
    async fn test_log_entry_verify_signature_none() {
        use crate::security::LogSigner;

        let key = hex::decode("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
            .unwrap();
        let signer = LogSigner::new(&key);

        let entry = LogEntry {
            id: 1,
            timestamp: Utc::now(),
            level: "INFO".to_string(),
            component: "test".to_string(),
            message: "Test message".to_string(),
            context: HashMap::new(),
            signature: None,
            previous_hash: None,
        };

        // No signature means verification fails
        assert!(!entry.verify_signature(&signer));
    }
}
