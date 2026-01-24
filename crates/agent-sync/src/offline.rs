//! Offline mode management and sync queue.
//!
//! This module provides:
//! - 7-day offline autonomy tracking
//! - Sync queue with exponential backoff retry
//! - Circuit breaker pattern for reliability
//! - Conflict resolution strategies

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Maximum offline autonomy period in days (NFR-R4).
const MAX_OFFLINE_DAYS: i64 = 7;

/// Maximum retry duration in hours (NFR-R6).
const MAX_RETRY_HOURS: i64 = 24;

/// Initial retry delay in seconds.
const INITIAL_RETRY_DELAY_SECS: u64 = 1;

/// Maximum retry delay in seconds (1 hour).
const MAX_RETRY_DELAY_SECS: u64 = 3600;

/// Consecutive failures before circuit breaker opens.
const CIRCUIT_BREAKER_THRESHOLD: u32 = 5;

/// Circuit breaker open duration in seconds.
const CIRCUIT_BREAKER_OPEN_SECS: u64 = 300;

/// Sync entity type in the queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncEntityType {
    CheckResult,
    Proof,
    Heartbeat,
    Config,
}

impl SyncEntityType {
    /// Convert to database string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncEntityType::CheckResult => "check_result",
            SyncEntityType::Proof => "proof",
            SyncEntityType::Heartbeat => "heartbeat",
            SyncEntityType::Config => "config",
        }
    }

    /// Parse from database string representation.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "check_result" => Some(SyncEntityType::CheckResult),
            "proof" => Some(SyncEntityType::Proof),
            "heartbeat" => Some(SyncEntityType::Heartbeat),
            "config" => Some(SyncEntityType::Config),
            _ => None,
        }
    }
}

/// An item in the sync queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncQueueItem {
    /// Unique identifier.
    pub id: i64,
    /// Entity type.
    pub entity_type: SyncEntityType,
    /// Entity identifier.
    pub entity_id: i64,
    /// Serialized payload.
    pub payload: String,
    /// Priority (higher = more urgent).
    pub priority: i32,
    /// Number of retry attempts.
    pub attempts: u32,
    /// Maximum retry attempts.
    pub max_attempts: u32,
    /// Last attempt timestamp.
    pub last_attempt_at: Option<DateTime<Utc>>,
    /// Last error message.
    pub last_error: Option<String>,
    /// Queue entry timestamp.
    pub created_at: DateTime<Utc>,
    /// Next retry timestamp.
    pub next_retry_at: DateTime<Utc>,
}

impl SyncQueueItem {
    /// Calculate next retry delay using exponential backoff.
    pub fn calculate_next_retry(&self) -> DateTime<Utc> {
        let delay_secs = std::cmp::min(
            INITIAL_RETRY_DELAY_SECS * (2u64.pow(self.attempts)),
            MAX_RETRY_DELAY_SECS,
        );
        Utc::now() + Duration::seconds(delay_secs as i64)
    }

    /// Check if this item should be retried.
    ///
    /// Returns false (and logs warning) if:
    /// - Max attempts reached
    /// - 24-hour retry window expired
    pub fn should_retry(&self) -> bool {
        if self.attempts >= self.max_attempts {
            warn!(
                "Sync queue item {} (type={:?}, entity={}) exceeded max attempts ({})",
                self.id, self.entity_type, self.entity_id, self.max_attempts
            );
            return false;
        }

        // Check if within 24-hour retry window
        let max_retry_time = self.created_at + Duration::hours(MAX_RETRY_HOURS);
        if Utc::now() >= max_retry_time {
            warn!(
                "Sync queue item {} (type={:?}, entity={}) expired after {} hours without successful sync",
                self.id, self.entity_type, self.entity_id, MAX_RETRY_HOURS
            );
            return false;
        }

        true
    }

    /// Check if ready for retry now.
    pub fn is_ready_for_retry(&self) -> bool {
        self.should_retry() && Utc::now() >= self.next_retry_at
    }
}

/// Circuit breaker state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    /// Normal operation, requests allowed.
    Closed,
    /// Too many failures, requests blocked.
    Open,
    /// Testing if system recovered.
    HalfOpen,
}

/// Circuit breaker for sync operations.
pub struct CircuitBreaker {
    /// Current state.
    state: RwLock<CircuitState>,
    /// Consecutive failure count.
    failure_count: AtomicU32,
    /// Time when circuit opened.
    opened_at: RwLock<Option<DateTime<Utc>>>,
}

impl CircuitBreaker {
    /// Create a new circuit breaker.
    pub fn new() -> Self {
        Self {
            state: RwLock::new(CircuitState::Closed),
            failure_count: AtomicU32::new(0),
            opened_at: RwLock::new(None),
        }
    }

    /// Check if requests are allowed.
    pub async fn is_allowed(&self) -> bool {
        let state = *self.state.read().await;
        match state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if we should transition to half-open
                let opened_at = self.opened_at.read().await;
                if let Some(opened) = *opened_at {
                    let elapsed = (Utc::now() - opened).num_seconds() as u64;
                    if elapsed >= CIRCUIT_BREAKER_OPEN_SECS {
                        // Transition to half-open
                        drop(opened_at);
                        *self.state.write().await = CircuitState::HalfOpen;
                        return true;
                    }
                }
                false
            }
            CircuitState::HalfOpen => true,
        }
    }

    /// Record a successful operation.
    pub async fn record_success(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
        *self.state.write().await = CircuitState::Closed;
        *self.opened_at.write().await = None;
        debug!("Circuit breaker: success recorded, state = Closed");
    }

    /// Record a failed operation.
    pub async fn record_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;

        if failures >= CIRCUIT_BREAKER_THRESHOLD {
            let mut state = self.state.write().await;
            if *state != CircuitState::Open {
                *state = CircuitState::Open;
                *self.opened_at.write().await = Some(Utc::now());
                warn!(
                    "Circuit breaker: opened after {} consecutive failures",
                    failures
                );
            }
        }
    }

    /// Get current state.
    pub async fn state(&self) -> CircuitState {
        *self.state.read().await
    }

    /// Get failure count.
    pub fn failure_count(&self) -> u32 {
        self.failure_count.load(Ordering::Relaxed)
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new()
    }
}

/// Offline mode tracker.
pub struct OfflineTracker {
    /// Whether currently offline.
    is_offline: AtomicBool,
    /// When offline mode started.
    offline_since: RwLock<Option<DateTime<Utc>>>,
    /// Last successful connection time.
    last_connected: RwLock<Option<DateTime<Utc>>>,
    /// Queued item count.
    queued_count: AtomicU32,
}

impl OfflineTracker {
    /// Create a new offline tracker.
    pub fn new() -> Self {
        Self {
            is_offline: AtomicBool::new(false),
            offline_since: RwLock::new(None),
            last_connected: RwLock::new(Some(Utc::now())),
            queued_count: AtomicU32::new(0),
        }
    }

    /// Mark as offline.
    pub async fn enter_offline_mode(&self) {
        if !self.is_offline.swap(true, Ordering::Relaxed) {
            let now = Utc::now();
            *self.offline_since.write().await = Some(now);
            info!("Entered offline mode at {}", now);
        }
    }

    /// Mark as online.
    pub async fn exit_offline_mode(&self) {
        if self.is_offline.swap(false, Ordering::Relaxed) {
            let offline_since = self.offline_since.write().await.take();
            let now = Utc::now();
            *self.last_connected.write().await = Some(now);

            if let Some(since) = offline_since {
                let duration = now - since;
                info!(
                    "Exited offline mode. Duration: {} hours, {} minutes",
                    duration.num_hours(),
                    duration.num_minutes() % 60
                );
            }
        }
    }

    /// Check if currently offline.
    pub fn is_offline(&self) -> bool {
        self.is_offline.load(Ordering::Relaxed)
    }

    /// Get offline duration.
    pub async fn offline_duration(&self) -> Option<Duration> {
        if self.is_offline() {
            let since = self.offline_since.read().await;
            since.map(|s| Utc::now() - s)
        } else {
            None
        }
    }

    /// Check if within allowed offline period.
    ///
    /// Returns true if offline for <= 7 days (168 hours), false otherwise.
    /// The check uses hours for precision at the boundary.
    pub async fn is_within_autonomy_period(&self) -> bool {
        if let Some(duration) = self.offline_duration().await {
            // Use hours for precision: 7 days = 168 hours
            // This ensures consistent behavior at the exact 7-day boundary
            duration.num_hours() <= (MAX_OFFLINE_DAYS * 24)
        } else {
            true
        }
    }

    /// Get offline status summary.
    pub async fn status(&self) -> OfflineStatus {
        let is_offline = self.is_offline();
        let offline_since = *self.offline_since.read().await;
        let last_connected = *self.last_connected.read().await;
        let queued_count = self.queued_count.load(Ordering::Relaxed);

        let duration = if is_offline {
            offline_since.map(|s| Utc::now() - s)
        } else {
            None
        };

        OfflineStatus {
            is_offline,
            offline_since,
            last_connected,
            offline_duration_hours: duration.map(|d| d.num_hours() as u32),
            queued_item_count: queued_count,
            // Use hours for consistent boundary behavior (7 days = 168 hours)
            within_autonomy_period: duration
                .map(|d| d.num_hours() <= (MAX_OFFLINE_DAYS * 24))
                .unwrap_or(true),
        }
    }

    /// Update queued item count.
    pub fn set_queued_count(&self, count: u32) {
        self.queued_count.store(count, Ordering::Relaxed);
    }

    /// Increment queued item count.
    pub fn increment_queued(&self) {
        self.queued_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Decrement queued item count.
    pub fn decrement_queued(&self) {
        self.queued_count.fetch_sub(1, Ordering::Relaxed);
    }
}

impl Default for OfflineTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Offline status summary.
#[derive(Debug, Clone, Serialize)]
pub struct OfflineStatus {
    /// Whether currently offline.
    pub is_offline: bool,
    /// When offline mode started.
    pub offline_since: Option<DateTime<Utc>>,
    /// Last successful connection.
    pub last_connected: Option<DateTime<Utc>>,
    /// Offline duration in hours.
    pub offline_duration_hours: Option<u32>,
    /// Number of queued sync items.
    pub queued_item_count: u32,
    /// Whether within 7-day autonomy period.
    pub within_autonomy_period: bool,
}

/// Conflict resolution strategy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictStrategy {
    /// Server configuration wins.
    ServerWins,
    /// Client data wins.
    ClientWins,
    /// Use most recent timestamp.
    MostRecent,
}

/// Result of conflict resolution.
#[derive(Debug, Clone)]
pub struct ConflictResolution {
    /// Key that had conflict.
    pub key: String,
    /// Strategy used.
    pub strategy: ConflictStrategy,
    /// Value before resolution.
    pub before: String,
    /// Value after resolution.
    pub after: String,
    /// Whether manual review is needed.
    pub needs_review: bool,
}

/// Resolve configuration conflicts (server wins for config).
///
/// Note: Timestamps are accepted for API consistency but intentionally ignored.
/// Configuration uses ServerWins strategy because the SaaS is the source of truth
/// for agent configuration. This prevents local tampering from persisting.
pub fn resolve_config_conflict(
    key: &str,
    local_value: &str,
    remote_value: &str,
    local_timestamp: DateTime<Utc>,
    remote_timestamp: DateTime<Utc>,
) -> ConflictResolution {
    // Server wins for configuration - timestamps are logged but not used for decision
    if local_value != remote_value {
        debug!(
            "Config conflict for '{}': local='{}' ({}), remote='{}' ({}). Server wins.",
            key, local_value, local_timestamp, remote_value, remote_timestamp
        );
    }

    info!(
        "Config conflict resolved for '{}': server wins (local value overridden)",
        key
    );

    ConflictResolution {
        key: key.to_string(),
        strategy: ConflictStrategy::ServerWins,
        before: local_value.to_string(),
        after: remote_value.to_string(),
        needs_review: false,
    }
}

/// Resolve rule conflicts (use version timestamp).
pub fn resolve_rule_conflict(
    rule_id: &str,
    local_version: &str,
    remote_version: &str,
    local_timestamp: DateTime<Utc>,
    remote_timestamp: DateTime<Utc>,
) -> ConflictResolution {
    // Most recent version wins
    let (winner, loser) = if remote_timestamp > local_timestamp {
        (remote_version, local_version)
    } else {
        (local_version, remote_version)
    };

    info!(
        "Rule conflict resolved for '{}': using version from {}",
        rule_id,
        if remote_timestamp > local_timestamp {
            "server"
        } else {
            "local"
        }
    );

    ConflictResolution {
        key: rule_id.to_string(),
        strategy: ConflictStrategy::MostRecent,
        before: loser.to_string(),
        after: winner.to_string(),
        needs_review: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_entity_type_conversion() {
        assert_eq!(SyncEntityType::CheckResult.as_str(), "check_result");
        assert_eq!(SyncEntityType::Proof.as_str(), "proof");
        assert_eq!(SyncEntityType::Heartbeat.as_str(), "heartbeat");
        assert_eq!(SyncEntityType::Config.as_str(), "config");

        assert_eq!(
            SyncEntityType::from_str("check_result"),
            Some(SyncEntityType::CheckResult)
        );
        assert_eq!(SyncEntityType::from_str("invalid"), None);
    }

    #[test]
    fn test_sync_queue_item_retry_calculation() {
        let item = SyncQueueItem {
            id: 1,
            entity_type: SyncEntityType::CheckResult,
            entity_id: 100,
            payload: "{}".to_string(),
            priority: 0,
            attempts: 0,
            max_attempts: 10,
            last_attempt_at: None,
            last_error: None,
            created_at: Utc::now(),
            next_retry_at: Utc::now(),
        };

        // First retry: 1 second delay
        let next = item.calculate_next_retry();
        assert!(next > Utc::now());

        // After multiple attempts, delay increases
        let mut item2 = item.clone();
        item2.attempts = 5;
        let next2 = item2.calculate_next_retry();

        // Delay should be 2^5 = 32 seconds
        let delay = (next2 - Utc::now()).num_seconds();
        assert!(delay >= 30 && delay <= 35);
    }

    #[test]
    fn test_sync_queue_item_should_retry() {
        let item = SyncQueueItem {
            id: 1,
            entity_type: SyncEntityType::CheckResult,
            entity_id: 100,
            payload: "{}".to_string(),
            priority: 0,
            attempts: 0,
            max_attempts: 10,
            last_attempt_at: None,
            last_error: None,
            created_at: Utc::now(),
            next_retry_at: Utc::now(),
        };

        assert!(item.should_retry());

        // Max attempts reached
        let mut item2 = item.clone();
        item2.attempts = 10;
        assert!(!item2.should_retry());

        // Created too long ago (beyond 24h)
        let mut item3 = item.clone();
        item3.created_at = Utc::now() - Duration::hours(25);
        assert!(!item3.should_retry());
    }

    #[tokio::test]
    async fn test_circuit_breaker_closed() {
        let cb = CircuitBreaker::new();
        assert!(cb.is_allowed().await);
        assert_eq!(cb.state().await, CircuitState::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        let cb = CircuitBreaker::new();

        // Record failures
        for _ in 0..CIRCUIT_BREAKER_THRESHOLD {
            cb.record_failure().await;
        }

        assert_eq!(cb.state().await, CircuitState::Open);
        assert!(!cb.is_allowed().await);
    }

    #[tokio::test]
    async fn test_circuit_breaker_success_resets() {
        let cb = CircuitBreaker::new();

        // Record some failures
        cb.record_failure().await;
        cb.record_failure().await;

        // Record success
        cb.record_success().await;

        assert_eq!(cb.state().await, CircuitState::Closed);
        assert_eq!(cb.failure_count(), 0);
    }

    #[tokio::test]
    async fn test_offline_tracker_enter_exit() {
        let tracker = OfflineTracker::new();

        assert!(!tracker.is_offline());

        tracker.enter_offline_mode().await;
        assert!(tracker.is_offline());

        tracker.exit_offline_mode().await;
        assert!(!tracker.is_offline());
    }

    #[tokio::test]
    async fn test_offline_tracker_duration() {
        let tracker = OfflineTracker::new();

        // Not offline - no duration
        assert!(tracker.offline_duration().await.is_none());

        // Enter offline mode
        tracker.enter_offline_mode().await;

        // Should have duration now
        let duration = tracker.offline_duration().await;
        assert!(duration.is_some());
        assert!(duration.unwrap().num_seconds() >= 0);
    }

    #[tokio::test]
    async fn test_offline_tracker_status() {
        let tracker = OfflineTracker::new();
        tracker.set_queued_count(5);

        let status = tracker.status().await;
        assert!(!status.is_offline);
        assert!(status.within_autonomy_period);
        assert_eq!(status.queued_item_count, 5);
    }

    #[tokio::test]
    async fn test_offline_tracker_within_autonomy() {
        let tracker = OfflineTracker::new();

        // Not offline - within period
        assert!(tracker.is_within_autonomy_period().await);

        // Enter offline
        tracker.enter_offline_mode().await;
        assert!(tracker.is_within_autonomy_period().await);
    }

    #[test]
    fn test_resolve_config_conflict() {
        let resolution = resolve_config_conflict(
            "check_interval",
            "3600",
            "7200",
            Utc::now() - Duration::hours(1),
            Utc::now(),
        );

        assert_eq!(resolution.strategy, ConflictStrategy::ServerWins);
        assert_eq!(resolution.after, "7200");
        assert!(!resolution.needs_review);
    }

    #[test]
    fn test_resolve_rule_conflict_remote_wins() {
        let local_time = Utc::now() - Duration::hours(1);
        let remote_time = Utc::now();

        let resolution =
            resolve_rule_conflict("disk_encryption", "1.0", "2.0", local_time, remote_time);

        assert_eq!(resolution.strategy, ConflictStrategy::MostRecent);
        assert_eq!(resolution.after, "2.0");
    }

    #[test]
    fn test_resolve_rule_conflict_local_wins() {
        let local_time = Utc::now();
        let remote_time = Utc::now() - Duration::hours(1);

        let resolution =
            resolve_rule_conflict("disk_encryption", "2.0", "1.0", local_time, remote_time);

        assert_eq!(resolution.strategy, ConflictStrategy::MostRecent);
        assert_eq!(resolution.after, "2.0");
    }

    #[test]
    fn test_max_offline_days() {
        assert_eq!(MAX_OFFLINE_DAYS, 7);
    }

    #[test]
    fn test_max_retry_hours() {
        assert_eq!(MAX_RETRY_HOURS, 24);
    }

    #[test]
    fn test_circuit_breaker_threshold() {
        assert_eq!(CIRCUIT_BREAKER_THRESHOLD, 5);
    }

    #[test]
    fn test_queued_count_operations() {
        let tracker = OfflineTracker::new();

        tracker.set_queued_count(10);
        assert_eq!(tracker.queued_count.load(Ordering::Relaxed), 10);

        tracker.increment_queued();
        assert_eq!(tracker.queued_count.load(Ordering::Relaxed), 11);

        tracker.decrement_queued();
        assert_eq!(tracker.queued_count.load(Ordering::Relaxed), 10);
    }
}
